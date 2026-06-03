window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['kcsa-compliance/compliance-frameworks'] = {
  theory: `# Compliance Frameworks para Kubernetes

## Relevância no Exame
> KCSA — Compliance and Security Frameworks (10%). O menor domínio do KCSA mas importante: entender CIS Benchmarks, kube-bench, e como frameworks regulatórios (NIST, PCI-DSS, SOC2, HIPAA) se traduzem para controles Kubernetes.

## Por que Compliance Importa em Kubernetes?

Kubernetes é usado em ambientes regulados: hospitais (HIPAA), fintechs (PCI-DSS), governos (FedRAMP), SaaS (SOC2). Compliance em K8s significa implementar controles técnicos que satisfaçam requisitos de auditores externos.

\`\`\`
Framework de Compliance:
        Regulação (ex: HIPAA)
             ↓
   Padrão/Framework (ex: NIST SP 800-53)
             ↓
   Controles Técnicos (ex: CIS Benchmark)
             ↓
   Implementação K8s (ex: kube-bench, PSA, audit logging)
             ↓
   Evidência/Auditoria (ex: relatórios, logs)
\`\`\`

## CIS Kubernetes Benchmark

O Center for Internet Security (CIS) publica benchmarks prescritivos para hardening de sistemas. O CIS Kubernetes Benchmark é o padrão de facto para segurança de clusters.

### Estrutura do CIS Benchmark

\`\`\`
CIS Kubernetes Benchmark v1.8:
├── 1. Control Plane Components
│   ├── 1.1 Master Node Configuration Files
│   ├── 1.2 API Server (25+ controles)
│   ├── 1.3 Controller Manager
│   └── 1.4 Scheduler
├── 2. etcd
│   └── 2.1-2.7 (TLS, autenticação, encriptação)
├── 3. Control Plane Configuration
│   ├── 3.1 Authentication & Authorization
│   └── 3.2 Logging
├── 4. Worker Nodes
│   ├── 4.1 Worker Node Config Files
│   └── 4.2 Kubelet (15+ controles)
├── 5. Kubernetes Policies
│   ├── 5.1 RBAC & Service Accounts
│   ├── 5.2 Pod Security Standards
│   ├── 5.3 Network Policies & CNI
│   ├── 5.4 Secrets Management
│   ├── 5.5 Extensible Admission Control
│   └── 5.7 General Policies
└── Appendix: Managed Kubernetes (EKS, GKE, AKS)
\`\`\`

### Exemplos de Controles CIS Importantes

| CIS ID | Descrição | Verificação |
|--------|-----------|------------|
| 1.2.1 | --anonymous-auth=false | kube-apiserver |
| 1.2.6 | --authorization-mode não inclui AlwaysAllow | kube-apiserver |
| 1.2.7 | --admission-plugins inclui NodeRestriction | kube-apiserver |
| 1.2.19 | Audit logging habilitado | kube-apiserver |
| 1.2.29 | Encryption at rest configurada | kube-apiserver |
| 2.1 | etcd usa TLS mútuo | etcd |
| 4.2.1 | --anonymous-auth=false no kubelet | kubelet |
| 4.2.4 | --read-only-port=0 no kubelet | kubelet |
| 5.1.3 | Minimizar wildcards em RBAC | kubectl |
| 5.2.2 | Não usar containers privilegiados | Pod Spec |

## kube-bench: Verificação Automatizada CIS

kube-bench é uma ferramenta open source da Aqua Security que verifica automaticamente a conformidade com o CIS Kubernetes Benchmark.

\`\`\`bash
# Instalar kube-bench
curl -L https://github.com/aquasecurity/kube-bench/releases/latest/download/kube-bench_linux_amd64.tar.gz | tar xzf -

# Executar scan completo (como root/privilegiado)
./kube-bench

# Escanear apenas o control plane
./kube-bench master

# Escanear apenas worker nodes
./kube-bench node

# Escanear seção específica
./kube-bench master --check 1.2.1,1.2.6

# Output em JSON para integração
./kube-bench --json | jq '.Controls[].Tests[].Results[] | select(.status == "FAIL")'

# Executar via Pod no cluster (comum em clusters gerenciados)
kubectl apply -f https://raw.githubusercontent.com/aquasecurity/kube-bench/main/job.yaml
kubectl logs job/kube-bench
\`\`\`

### Interpretando Output do kube-bench

\`\`\`
[INFO] 1 Master Node Security Configuration
[INFO] 1.2 API Server

[PASS] 1.2.1 Ensure that the --anonymous-auth argument is set to false
[FAIL] 1.2.2 Ensure that the --token-auth-file parameter is not set
      Remediation: Edit the API server pod specification...
[WARN] 1.2.3 Ensure that the --DenyServiceExternalIPs is not set
[INFO] 1.2.4 Ensure that the --kubelet-https argument is set to true

== Summary master ==
29 checks PASS
10 checks FAIL
3 checks WARN
0 checks INFO
\`\`\`

\`\`\`
Status significados:
PASS → Controle implementado corretamente
FAIL → Controle não implementado — ação necessária
WARN → Aviso — verificar manualmente se aplicável
INFO → Informativo — sem ação necessária
\`\`\`

## NIST SP 800-53 e NIST SP 800-190

### NIST SP 800-53 (Security and Privacy Controls)

Framework abrangente do governo americano com 20 famílias de controles. Para Kubernetes:

| Família | Controles K8s relevantes |
|---------|------------------------|
| AC — Access Control | RBAC, namespaces, SA tokens |
| AU — Audit & Accountability | Audit logging kube-apiserver |
| CM — Config Management | IaC, GitOps, immutable infra |
| IA — Identification & Auth | Authentication modes, OIDC |
| SC — System & Communications | NetworkPolicy, TLS, mTLS |
| SI — System & Info Integrity | Image scanning, PSA |

### NIST SP 800-190 (Application Container Security)

Específico para containers — define 5 áreas de risco:

1. **Image vulnerabilities** → Trivy scanning
2. **Image configuration defects** → PSA, admission controllers
3. **Embedded malware** → runtime security (Falco)
4. **Clear text secrets** → Secrets management, encryption at rest
5. **Use of untrusted images** → Image signing (Cosign), registry policies

## PCI-DSS para Kubernetes

PCI-DSS (Payment Card Industry Data Security Standard) é obrigatório para qualquer aplicação que processa cartões de crédito.

### Requisitos PCI-DSS Mapeados para K8s

| Req. PCI | Descrição | Implementação K8s |
|----------|-----------|-----------------|
| **1** | Firewalls de rede | NetworkPolicy (ingress/egress) |
| **2** | Não usar defaults de fornecedor | CIS Benchmark, kube-bench |
| **3** | Proteger dados do portador | Encryption at rest, Secrets KMS |
| **4** | Criptografia em trânsito | TLS, mTLS service mesh |
| **7** | Acesso restrito a dados | RBAC, namespaces, PSA |
| **8** | Identificar e autenticar | OIDC, SA tokens com RBAC |
| **10** | Log de acessos | Audit logging kube-apiserver |
| **11** | Testar sistemas/processos | kube-bench, Trivy, Falco |
| **12** | Política de segurança | Kyverno/Gatekeeper policies |

\`\`\`yaml
# Exemplo: Audit Policy para conformidade PCI-DSS
# Deve logar todas as operações em dados sensíveis
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
# Logar leitura de Secrets (dados sensíveis)
- level: RequestResponse
  verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
  resources:
  - group: ""
    resources: ["secrets"]

# Logar todas as mudanças de configuração
- level: Metadata
  verbs: ["create", "update", "patch", "delete"]
  resources:
  - group: ""
    resources: ["pods", "services", "configmaps"]
  - group: "apps"
    resources: ["deployments", "statefulsets"]

# Não logar health checks (ruído)
- level: None
  users: ["system:kube-proxy"]
  verbs: ["watch"]
  resources:
  - group: ""
    resources: ["endpoints", "services"]
\`\`\`

## SOC2 para Kubernetes

SOC2 (System and Organization Controls 2) é um framework para empresas de SaaS, avaliando 5 Trust Service Criteria (TSC):

| TSC | Descrição | Controles K8s |
|-----|-----------|--------------|
| **Security** | Proteção contra acesso não autorizado | RBAC, NetworkPolicy, PSA |
| **Availability** | Disponibilidade do sistema | HA, PodDisruptionBudgets, HPA |
| **Processing Integrity** | Processamento completo e preciso | Admission controllers, CI/CD gates |
| **Confidentiality** | Dados confidenciais protegidos | Encryption, Secrets, RBAC |
| **Privacy** | Dados pessoais protegidos | Namespace isolation, Audit logs |

## HIPAA para Kubernetes (Healthcare)

HIPAA (Health Insurance Portability and Accountability Act) protege PHI (Protected Health Information).

### Requisitos HIPAA Técnicos

| Requisito | Controle K8s |
|-----------|-------------|
| Controle de acesso único | SA por workload, RBAC granular |
| Controle de auditoria | Audit logging completo |
| Autenticação de pessoa | OIDC com MFA |
| Controles de transmissão | TLS obrigatório, NetworkPolicy |
| Controles de armazenamento | Encryption at rest (KMS) |
| Gestão automática de logoff | Token TTL, bound service accounts |

## Compliance como Código

A abordagem moderna integra compliance checks diretamente no pipeline CI/CD:

\`\`\`yaml
# pipeline de compliance (exemplo GitHub Actions)
name: K8s Compliance Check
on: [push]

jobs:
  compliance:
    steps:
    # 1. Scan de vulnerabilidades
    - name: Trivy image scan
      run: trivy image --severity CRITICAL --exit-code 1 $IMAGE

    # 2. Verificação de políticas K8s
    - name: Kyverno policy check
      run: |
        kyverno apply policies/ --resource manifests/
        # Falha se violar políticas

    # 3. CIS Benchmark check (em ambiente de staging)
    - name: kube-bench
      run: kube-bench --json > bench-results.json

    # 4. Gerar evidências para auditores
    - name: Upload compliance artifacts
      uses: actions/upload-artifact@v3
      with:
        name: compliance-evidence
        path: |
          bench-results.json
          trivy-results.json
\`\`\`

## Ferramentas de Compliance para K8s

| Ferramenta | Categoria | Uso |
|-----------|----------|-----|
| **kube-bench** | CIS Benchmark | Verificar configuração do cluster |
| **Trivy** | Vulnerability scanning | CVEs em imagens e configs |
| **Falco** | Runtime security | Detecção de comportamentos anômalos |
| **OPA/Gatekeeper** | Policy enforcement | Enforçar políticas custom |
| **Kyverno** | Policy enforcement | Políticas em YAML nativo |
| **Kubescape** | Multi-framework | NIST, NSA, MITRE em um só |

\`\`\`bash
# Kubescape: scan multi-framework
kubescape scan --framework nist-sp-800-53
kubescape scan --framework mitre
kubescape scan --framework cis-eks-t1.2.0  # Para EKS
\`\`\`

## Erros Comuns em Compliance K8s

1. **Compliance apenas como ponto no tempo** — precisa ser contínuo
2. **Controles manuais sem automação** — humanos cometem erros, scripts não
3. **Ignorar namespaces de sistema** no escopo dos controles
4. **Audit logging sem retenção adequada** — PCI exige 12 meses
5. **Não documentar exceções** — auditores precisam de justificativas formais
6. **Tratar managed K8s como self-managed** — EKS/GKE já aplicam alguns CIS por padrão

## Killer.sh Style Challenge

> **Cenário**: A empresa precisa demonstrar conformidade com PCI-DSS requisito 10 (audit logging). Configure o kube-apiserver com uma audit policy que registra todas as operações em Secrets, e use kube-bench para identificar e corrigir os 3 principais FAILs no control plane.
`,
  quiz: [
    {
      question: 'O que é o CIS Kubernetes Benchmark e quem o publica?',
      options: [
        'Um padrão de certificação Kubernetes publicado pela CNCF',
        'Um conjunto de melhores práticas de segurança publicado pelo Center for Internet Security para hardening de clusters',
        'Um framework de compliance publicado pelo NIST para ambientes governamentais',
        'Uma ferramenta de scanning publicada pela Aqua Security'
      ],
      correct: 1,
      explanation: 'O CIS (Center for Internet Security) Kubernetes Benchmark é um conjunto de recomendações prescritivas de segurança — o padrão de facto para hardening de clusters Kubernetes. Cobre API server, etcd, kubelet, RBAC, Pod Security, Network Policies. kube-bench (Aqua) é a FERRAMENTA que verifica conformidade com o benchmark.',
      reference: 'Veja "CIS Kubernetes Benchmark" na teoria — diferencie o benchmark (padrão) da ferramenta kube-bench (verificação).'
    },
    {
      question: 'Um cluster tem 10 FAILs no kube-bench. Qual é a prioridade correta de remediação?',
      options: [
        'Corrigir pela ordem numérica do ID do controle (1.2.1 antes de 4.2.1)',
        'Corrigir os FAILs do kubelet primeiro, pois são mais simples',
        'Corrigir pela severidade de impacto de segurança e facilidade de remediação',
        'Todos os FAILs têm igual prioridade no CIS Benchmark'
      ],
      correct: 2,
      explanation: 'A prioridade deve ser por impacto de segurança + facilidade de remediação. Exemplos de alta prioridade: anonymous-auth=false (simples, crítico), encryption at rest (médio, alto impacto), audit logging (médio, compliance obrigatório). Não siga cegamente a ordem numérica — avalie o risco real de cada controle.',
      reference: 'Veja a tabela "Exemplos de Controles CIS Importantes" — identifique quais controles têm maior impacto de segurança.'
    },
    {
      question: 'Qual requisito do PCI-DSS é mapeado para Audit Logging no kube-apiserver?',
      options: [
        'Requisito 1 — Firewalls de rede',
        'Requisito 3 — Proteger dados do portador de cartão',
        'Requisito 10 — Log e monitoramento de acesso',
        'Requisito 12 — Política de segurança da informação'
      ],
      correct: 2,
      explanation: 'PCI-DSS Requisito 10 exige rastrear e monitorar todos os acessos a recursos de rede e dados do portador de cartão. Em Kubernetes, isso se traduz em audit logging do kube-apiserver (especialmente para Secrets), com retenção de pelo menos 12 meses e revisão regular. O requisito 10 também exige alertas para anomalias.',
      reference: 'Veja a tabela "Requisitos PCI-DSS Mapeados para K8s" e o exemplo de AuditPolicy para PCI-DSS na teoria.'
    },
    {
      question: 'O NIST SP 800-190 é um documento específico para qual tema?',
      options: [
        'Segurança de redes em ambientes governamentais',
        'Application Container Security — riscos e controles específicos para containers',
        'Criptografia de dados em repouso para sistemas federais',
        'Identity and Access Management para cloud computing'
      ],
      correct: 1,
      explanation: 'NIST SP 800-190 "Application Container Security Guide" é específico para containers. Define 5 áreas de risco: vulnerabilidades em imagens, deficiências de configuração, malware embutido, secrets em texto claro, e uso de imagens não confiáveis. É a referência NIST diretamente aplicável a Kubernetes.',
      reference: 'Veja "NIST SP 800-190" na teoria — os 5 riscos mapeiam diretamente para ferramentas como Trivy, PSA, Falco, Cosign.'
    },
    {
      question: 'SOC2 possui 5 Trust Service Criteria. Qual critério é mais diretamente atendido por PodDisruptionBudgets e HPA?',
      options: [
        'Security — proteção contra acesso não autorizado',
        'Availability — disponibilidade do sistema conforme prometido',
        'Confidentiality — proteção de informações confidenciais',
        'Processing Integrity — processamento completo e preciso'
      ],
      correct: 1,
      explanation: 'PodDisruptionBudgets garantem disponibilidade durante manutenções planejadas (evitam derrubar muitos pods de uma vez), e HPA (Horizontal Pod Autoscaler) garante escalabilidade sob carga. Ambos endereçam o critério "Availability" do SOC2 — o sistema deve estar disponível conforme comprometido no SLA.',
      reference: 'Veja a tabela SOC2 Trust Service Criteria na teoria — cada critério tem controles K8s específicos.'
    },
    {
      question: 'Qual é a abordagem recomendada de "Compliance como Código"?',
      options: [
        'Contratar um auditor externo anualmente para verificar o cluster',
        'Fazer um relatório manual de compliance trimestralmente',
        'Integrar verificações de compliance (kube-bench, Trivy, Kyverno) no pipeline CI/CD com geração de evidências automáticas',
        'Configurar compliance uma única vez no deploy inicial e não modificar'
      ],
      correct: 2,
      explanation: '"Compliance como Código" integra verificações de segurança e conformidade diretamente no pipeline CI/CD: Trivy para scanning de imagens, Kyverno para policy validation, kube-bench para verificação CIS, com geração automática de evidências para auditores. Isso torna compliance contínuo e verificável, ao invés de um ponto no tempo.',
      reference: 'Veja "Compliance como Código" na teoria com o exemplo de pipeline GitHub Actions.'
    },
    {
      question: 'Quais são os 5 riscos de segurança definidos pelo NIST SP 800-190 para containers?',
      options: [
        'Rede, Storage, CPU, Memória, Disco',
        'Image vulnerabilities, Image config defects, Embedded malware, Clear text secrets, Untrusted images',
        'Authentication, Authorization, Encryption, Logging, Monitoring',
        'Pods, Nodes, Namespaces, Services, Ingress'
      ],
      correct: 1,
      explanation: 'O NIST SP 800-190 define 5 áreas de risco para containers: (1) Vulnerabilidades em imagens — atacar via CVEs; (2) Deficiências de configuração — misconfigured containers; (3) Malware embutido — código malicioso na imagem; (4) Secrets em texto claro — credenciais expostas; (5) Uso de imagens não confiáveis — sem verificação de origem.',
      reference: 'Veja "NIST SP 800-190" na teoria — cada risco tem uma ferramenta/controle K8s correspondente.'
    },
    {
      question: 'O que o kube-bench faz e como é tipicamente executado?',
      options: [
        'Ferramenta de load testing que verifica o desempenho do kube-apiserver',
        'Scanner que verifica automaticamente a conformidade do cluster com o CIS Kubernetes Benchmark',
        'Ferramenta de validação de manifests YAML do Kubernetes',
        'Cliente kubectl alternativo com funcionalidades de segurança adicionais'
      ],
      correct: 1,
      explanation: 'kube-bench (Aqua Security) é uma ferramenta open source que verifica automaticamente se um cluster Kubernetes está configurado conforme o CIS Kubernetes Benchmark. Pode ser executado como binário no control plane (`./kube-bench master`), como Job no cluster (`kubectl apply -f job.yaml`), ou em managed K8s como EKS/GKE.',
      reference: 'Veja "kube-bench: Verificação Automatizada CIS" — inclui exemplos de uso e interpretação do output (PASS/FAIL/WARN).'
    }
  ],
  flashcards: [
    {
      front: 'O que é o CIS Kubernetes Benchmark?',
      back: 'Conjunto prescritivo de melhores práticas de segurança publicado pelo Center for Internet Security para hardening de clusters K8s. Cobre: API server (1.2), etcd (2), kubelet (4.2), RBAC (5.1), Pod Security (5.2), Network Policies (5.3), Secrets (5.4). Verificado automaticamente pelo kube-bench.'
    },
    {
      front: 'O que é kube-bench e como verificar conformidade CIS?',
      back: 'Ferramenta open source da Aqua Security que verifica conformidade CIS automaticamente. Uso: `./kube-bench master` (control plane), `./kube-bench node` (worker), `kubectl apply -f job.yaml` (via Pod). Output: PASS/FAIL/WARN por controle com remediação sugerida.'
    },
    {
      front: 'Quais são os 5 riscos de container definidos pelo NIST SP 800-190?',
      back: '1. Image vulnerabilities (→ Trivy). 2. Image configuration defects (→ PSA, admission). 3. Embedded malware (→ Falco, runtime security). 4. Clear text secrets (→ Secrets encryption, Vault). 5. Untrusted images (→ Cosign, registry policies).'
    },
    {
      front: 'PCI-DSS Requisito 10 e Kubernetes',
      back: 'PCI Req. 10: Log e monitoramento de todos os acessos a recursos de rede e dados de cartão. K8s: Audit logging do kube-apiserver com policy que captura operações em Secrets, com retenção ≥12 meses. Também requer alertas para anomalias (Falco + AlertManager).'
    },
    {
      front: 'Quais são os 5 Trust Service Criteria do SOC2?',
      back: 'Security (acesso não autorizado → RBAC, NetworkPolicy), Availability (disponibilidade → PDB, HPA), Processing Integrity (processamento correto → admission controllers), Confidentiality (dados confidenciais → encryption, RBAC), Privacy (dados pessoais → namespace isolation, audit logs).'
    },
    {
      front: 'O que é "Compliance como Código"?',
      back: 'Integrar verificações de compliance no pipeline CI/CD: Trivy (image scanning), Kyverno (policy validation), kube-bench (CIS checks), com geração automática de evidências. Torna compliance contínuo e auditável ao invés de verificação manual pontual. Essencial para PCI-DSS, SOC2, HIPAA.'
    },
    {
      front: 'HIPAA e Kubernetes — quais controles são obrigatórios?',
      back: 'Controle de acesso único (SA por workload + RBAC), Auditoria (audit logging completo), Autenticação (OIDC com MFA), Transmissão segura (TLS obrigatório + NetworkPolicy), Armazenamento seguro (encryption at rest com KMS), Logoff automático (token TTL curto).'
    },
    {
      front: 'Qual ferramenta verifica múltiplos frameworks de compliance de uma vez?',
      back: 'Kubescape: faz scan para NIST SP 800-53, NSA/CISA K8s Hardening, MITRE ATT&CK, CIS em um único comando. Ex: `kubescape scan --framework nist-sp-800-53`. Alternativa: usar kube-bench (CIS) + Trivy (CVEs) + Falco (runtime) separadamente.'
    }
  ],
  lab: {
    scenario: 'A empresa precisa demonstrar conformidade PCI-DSS ao time de auditoria. Você deve: configurar audit logging no kube-apiserver, executar kube-bench para identificar gaps, e documentar o status de conformidade.',
    objective: 'Configurar audit logging para compliance e entender como usar kube-bench para verificação CIS.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Configurar Audit Logging para PCI-DSS',
        instruction: `Configure o kube-apiserver com uma audit policy que satisfaz o requisito PCI-DSS de rastrear acesso a dados sensíveis.

\`\`\`bash
# Criar a audit policy
sudo mkdir -p /etc/kubernetes/audit

sudo tee /etc/kubernetes/audit/policy.yaml << 'EOF'
apiVersion: audit.k8s.io/v1
kind: Policy
# Não logar requests para subresources de baixo risco
omitStages:
- RequestReceived

rules:
# CRÍTICO: Logar todas as operações em Secrets (dados sensíveis - PCI req. 10)
- level: RequestResponse
  verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
  resources:
  - group: ""
    resources: ["secrets"]

# Logar mudanças de configuração (para auditoria)
- level: Metadata
  verbs: ["create", "update", "patch", "delete"]
  resources:
  - group: ""
    resources: ["pods", "services", "serviceaccounts"]
  - group: "rbac.authorization.k8s.io"
    resources: ["roles", "rolebindings", "clusterroles", "clusterrolebindings"]

# Logar operações de autenticação
- level: Metadata
  resources:
  - group: "authentication.k8s.io"
    resources: ["tokenreviews"]

# Não logar health checks e noise
- level: None
  users:
  - "system:kube-proxy"
  - "system:nodes"
  verbs: ["watch"]
  resources:
  - group: ""
    resources: ["endpoints", "services", "pods"]

# Default: apenas metadados para outros recursos
- level: Metadata
  omitStages:
  - RequestReceived
EOF
\`\`\`

Adicionar flags ao kube-apiserver (em clusters kubeadm — /etc/kubernetes/manifests/kube-apiserver.yaml):
\`\`\`bash
# Adicionar estas flags ao kube-apiserver:
# --audit-log-path=/var/log/kubernetes/audit/audit.log
# --audit-policy-file=/etc/kubernetes/audit/policy.yaml
# --audit-log-maxage=30
# --audit-log-maxbackup=10
# --audit-log-maxsize=100

# Verificar configuração atual
sudo grep -E "audit" /etc/kubernetes/manifests/kube-apiserver.yaml 2>/dev/null || \\
  echo "Audit logging não configurado ainda"
\`\`\``,
        hints: [
          'Em clusters kubeadm, edite /etc/kubernetes/manifests/kube-apiserver.yaml — o kube-apiserver reinicia automaticamente',
          'O volume do audit log precisa ser montado no static pod manifest',
          'PCI-DSS exige retenção de 12 meses — use logrotate ou envie para SIEM externo'
        ],
        solution: `\`\`\`bash
# Criar a audit policy
sudo mkdir -p /etc/kubernetes/audit /var/log/kubernetes/audit
sudo cp policy.yaml /etc/kubernetes/audit/policy.yaml

# Em clusters kubeadm, adicionar ao kube-apiserver manifest:
# (Fazer backup primeiro!)
sudo cp /etc/kubernetes/manifests/kube-apiserver.yaml \\
  /etc/kubernetes/manifests/kube-apiserver.yaml.bak

# Adicionar as flags de audit ao spec.containers.command
# E adicionar volumes para o log e a policy

# Verificar que o arquivo de policy foi criado
ls -la /etc/kubernetes/audit/policy.yaml
cat /etc/kubernetes/audit/policy.yaml | grep "level: RequestResponse"
\`\`\``,
        verify: `\`\`\`bash
# Verificar que o arquivo de policy existe e tem conteúdo correto
ls -la /etc/kubernetes/audit/policy.yaml

# Verificar que a policy inclui Secrets com RequestResponse
grep -A3 "resources.*secrets" /etc/kubernetes/audit/policy.yaml
# Deve mostrar: level: RequestResponse com recursos secrets

# Se audit foi configurado, verificar se o log está sendo gerado
ls /var/log/kubernetes/audit/ 2>/dev/null && echo "Audit log configurado" || \\
  echo "Audit log path não criado ainda"

# Verificar configuração do kube-apiserver
kubectl get pod kube-apiserver-$(hostname) -n kube-system -o yaml 2>/dev/null | \\
  grep -E "audit" | head -5
\`\`\``
      },
      {
        title: 'Executar kube-bench e analisar resultados',
        instruction: `Execute o kube-bench via Pod no cluster (funciona em managed e self-managed) e analise os FAILs.

\`\`\`bash
# Opção 1: Executar kube-bench como Job no cluster
kubectl apply -f https://raw.githubusercontent.com/aquasecurity/kube-bench/main/job.yaml

# Aguardar conclusão
kubectl wait --for=condition=Complete job/kube-bench --timeout=120s

# Ver resultados
kubectl logs job/kube-bench

# Filtrar apenas FAILs
kubectl logs job/kube-bench | grep -E "\\[FAIL\\]|FAIL"

# Contar por categoria
kubectl logs job/kube-bench | grep -E "^== Summary"

# Limpar o Job
kubectl delete job kube-bench
\`\`\`

Opção 2: Executar binário localmente (se tiver acesso ao control plane):
\`\`\`bash
# Download
curl -L https://github.com/aquasecurity/kube-bench/releases/download/v0.7.0/kube-bench_v0.7.0_linux_amd64.tar.gz | tar xzf -

# Scan completo
sudo ./kube-bench master 2>/dev/null | grep -E "\\[FAIL\\]|\\[PASS\\]|Summary"
\`\`\``,
        hints: [
          'O Job do kube-bench precisa de permissões especiais para acessar configurações do node',
          'Em managed K8s (EKS, GKE), muitos controles de control plane são N/A ou gerenciados pelo provedor',
          'Foque nos FAILs que você pode corrigir — alguns são por design da sua configuração'
        ],
        solution: `\`\`\`bash
kubectl apply -f https://raw.githubusercontent.com/aquasecurity/kube-bench/main/job.yaml

# Aguardar e capturar logs
kubectl wait --for=condition=Complete job/kube-bench --timeout=120s
kubectl logs job/kube-bench > kube-bench-results.txt

# Analisar FAILs
grep "\\[FAIL\\]" kube-bench-results.txt
# Exemplos comuns de FAIL:
# [FAIL] 4.2.1 Ensure that the --anonymous-auth argument is set to false
# [FAIL] 4.2.4 Ensure that the --read-only-port argument is set to 0

# Ver summary
grep "Summary" -A4 kube-bench-results.txt
\`\`\``,
        verify: `\`\`\`bash
# Verificar que o Job foi criado e completou
kubectl get job kube-bench
# NAME         COMPLETIONS   DURATION   AGE
# kube-bench   1/1           ...        ...

# Verificar que há resultados nos logs
kubectl logs job/kube-bench | head -20
# Deve mostrar: [INFO] 1 Master Node Security Configuration ou similar

# Verificar que há FAILs e PASSes (qualquer cluster tem alguns)
kubectl logs job/kube-bench | grep -c "\\[PASS\\]"
kubectl logs job/kube-bench | grep -c "\\[FAIL\\]"
# Ambos devem ser > 0

# Limpar
kubectl delete job kube-bench
\`\`\``
      },
      {
        title: 'Criar relatório de conformidade para auditores',
        instruction: `Gere um relatório de conformidade que demonstra o status de segurança do cluster para fins de auditoria PCI-DSS.

\`\`\`bash
# Script para gerar relatório de compliance
cat > compliance-report.sh << 'SCRIPT'
#!/bin/bash
echo "=== RELATÓRIO DE CONFORMIDADE KUBERNETES ==="
echo "Data: $(date)"
echo "Cluster: $(kubectl cluster-info | head -1)"
echo ""

echo "--- 1. RBAC: Verificação de permissões excessivas ---"
echo "ClusterRoleBindings com cluster-admin:"
kubectl get clusterrolebindings -o json | \\
  jq -r '.items[] | select(.roleRef.name=="cluster-admin") |
    "  - \(.metadata.name): \(.subjects[0].kind)/\(.subjects[0].name)"' 2>/dev/null

echo ""
echo "--- 2. Pod Security: Namespaces com PSA configurado ---"
kubectl get namespaces -o json | \\
  jq -r '.items[] | select(.metadata.labels | keys | any(startswith("pod-security"))) |
    "\(.metadata.name): \(.metadata.labels | to_entries | map(select(.key | startswith("pod-security"))) | map("\(.key)=\(.value)") | join(", "))"' 2>/dev/null

echo ""
echo "--- 3. Secrets: Verificação de automount ---"
echo "Pods com automountServiceAccountToken: true (padrão):"
kubectl get pods -A -o json | \\
  jq -r '.items[] | select(.spec.automountServiceAccountToken != false) |
    "\(.metadata.namespace)/\(.metadata.name)"' 2>/dev/null | head -10

echo ""
echo "--- 4. Network Policies ---"
echo "Namespaces SEM NetworkPolicy (risco):"
for ns in $(kubectl get namespaces -o name | cut -d/ -f2 | grep -v kube); do
  count=$(kubectl get networkpolicy -n $ns 2>/dev/null | grep -c "NAME" || echo 0)
  if [ "$count" -le 1 ]; then
    echo "  - $ns (sem NetworkPolicy)"
  fi
done

echo ""
echo "=== FIM DO RELATÓRIO ==="
SCRIPT

chmod +x compliance-report.sh
bash compliance-report.sh
\`\`\``,
        hints: [
          'Auditores precisam de evidências — guarde os outputs em arquivo com timestamp',
          'O jq facilita filtrar JSON do kubectl — invista tempo aprendendo o básico',
          'Um bom relatório mostra tanto o que está conforme quanto o que precisa de atenção'
        ],
        solution: `\`\`\`bash
chmod +x compliance-report.sh
bash compliance-report.sh | tee compliance-$(date +%Y%m%d).txt

# Verificar seções geradas
cat compliance-$(date +%Y%m%d).txt

# Para PCI-DSS, também incluir:
# - Resultado do kube-bench (salvo anteriormente)
# - Lista de imagens com CVEs críticas (Trivy)
# - Evidência de audit logging configurado
ls -la compliance-*.txt kube-bench-results.txt 2>/dev/null
\`\`\``,
        verify: `\`\`\`bash
# Verificar que o script foi criado e é executável
ls -la compliance-report.sh
# Deve ter permissão de execução

# Verificar que o relatório foi gerado
ls compliance-*.txt 2>/dev/null && echo "Relatório gerado" || bash compliance-report.sh > compliance-test.txt

# Verificar conteúdo do relatório
grep -E "RELATÓRIO|cluster-admin|NetworkPolicy|automount" compliance-test.txt 2>/dev/null | head -10
# Deve mostrar as seções do relatório
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'kube-bench FAIL em controles que parecem já estar configurados',
      difficulty: 'medium',
      symptom: 'kube-bench reporta FAIL em `4.2.1 kubelet --anonymous-auth=false` mas o time afirma ter configurado essa flag. O kubelet parece estar rejeitando requests anônimas na prática, mas o kube-bench continua falhando.',
      diagnosis: `\`\`\`bash
# Verificar como o kubelet está configurado — há dois lugares possíveis
# 1. Flags de linha de comando (método antigo)
ps aux | grep kubelet | grep -o "\\-\\-anonymous-auth[^ ]*"

# 2. Arquivo de configuração (método moderno - preferido)
cat /var/lib/kubelet/config.yaml | grep -A5 "anonymous"
# Se usar config file, a flag de CLI pode ser ignorada!

# Ver qual método o kubelet usa
systemctl cat kubelet | grep "\-\\-config"
# Se tiver --config=/var/lib/kubelet/config.yaml:
# A configuração DEVE estar no arquivo, não em flags CLI

# Ver configuração atual completa do kubelet
kubectl get node <node-name> -o jsonpath='{.status.config}' 2>/dev/null

# kube-bench às vezes lê apenas as flags CLI e não o config file
# Verificar manualmente
curl -sk https://localhost:10250/pods 2>&1 | head -5
# Se retornar 401/403: anon-auth está DESABILITADO (correto)
# Se retornar dados: anon-auth está HABILITADO (problema!)
\`\`\``,
      solution: `\`\`\`bash
# Confirmar que config.yaml tem a configuração correta
grep -A5 "authentication" /var/lib/kubelet/config.yaml
# Deve mostrar:
# authentication:
#   anonymous:
#     enabled: false

# Se não estiver lá, adicionar:
sudo tee -a /var/lib/kubelet/config.yaml << 'EOF'
authentication:
  anonymous:
    enabled: false
  webhook:
    enabled: true
authorization:
  mode: Webhook
EOF

# Reiniciar kubelet para aplicar
sudo systemctl restart kubelet
sudo systemctl status kubelet

# Verificar que funciona
curl -sk https://localhost:10250/pods 2>&1 | head -2
# Deve retornar: Unauthorized (401) — não anônimo!

# Executar kube-bench novamente para confirmar
sudo ./kube-bench node --check 4.2.1
# Deve mostrar [PASS]

# Nota: kube-bench v0.6+ lê config file corretamente
# Se ainda falhar, atualizar kube-bench para versão mais recente
\`\`\``
    },
    {
      title: 'Audit log crescendo sem controle — disco cheio',
      difficulty: 'easy',
      symptom: 'O audit log do kube-apiserver cresceu para 50GB e está preenchendo o disco do control plane. O kube-apiserver está em loop de restart. A política de audit está configurada com `level: RequestResponse` para todos os recursos.',
      diagnosis: `\`\`\`bash
# Verificar uso de disco
df -h /var/log/kubernetes/audit/
# Filesystem ... 100% /var/log/kubernetes

# Ver tamanho dos arquivos de audit
ls -lah /var/log/kubernetes/audit/

# Verificar a audit policy atual — provavelmente muito verbosa
cat /etc/kubernetes/audit/policy.yaml
# Problema: RequestResponse para todos os recursos inclui os valores completos
# de responses, que podem ser muito grandes (ex: listar todos os pods)

# Verificar se há regra catch-all muito ampla
grep "level: RequestResponse" /etc/kubernetes/audit/policy.yaml
# Se houver sem filtro específico: problema!
\`\`\``,
      solution: `\`\`\`bash
# 1. Liberar espaço imediatamente
# Truncar o log atual (não deletar — pode haver lock)
sudo truncate -s 0 /var/log/kubernetes/audit/audit.log

# Ou remover rotações antigas
sudo rm /var/log/kubernetes/audit/audit.log.{2,3,4,5,6,7,8,9,10}

# 2. Corrigir a audit policy para ser menos verbosa
sudo tee /etc/kubernetes/audit/policy.yaml << 'EOF'
apiVersion: audit.k8s.io/v1
kind: Policy
omitStages: [RequestReceived]
rules:
# Apenas Secrets com RequestResponse (PCI requirement)
- level: RequestResponse
  resources:
  - group: ""
    resources: ["secrets"]
  verbs: ["get", "create", "update", "delete"]

# Mudanças de RBAC com Metadata (sem body)
- level: Metadata
  resources:
  - group: "rbac.authorization.k8s.io"
    resources: ["*"]
  verbs: ["create", "update", "patch", "delete"]

# Health checks: sem log
- level: None
  users: ["system:kube-proxy"]
  verbs: ["watch"]

# Default: apenas Metadata (sem body de request/response)
- level: Metadata
EOF

# 3. Configurar rotação no kube-apiserver (verificar flags)
# --audit-log-maxage=30 (30 dias)
# --audit-log-maxbackup=5 (5 arquivos)
# --audit-log-maxsize=100 (100 MB por arquivo)

# 4. Verificar que kube-apiserver reiniciou
kubectl get pod kube-apiserver-$(hostname) -n kube-system
\`\`\``
    }
  ]
};
