window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['kcna-orchestration/storage-security-concepts'] = {

  theory: `# Storage & Security Concepts

## Relevancia no KCNA
> O dominio "Container Orchestration" vale **22%** do KCNA. Conceitos de storage e seguranca sao frequentes. Entenda os recursos e como eles se integram.

---

## Storage no Kubernetes

### Volumes Efemeros vs Persistentes

| Tipo | Duracao | Uso |
|------|---------|-----|
| **emptyDir** | Vida do Pod | Cache, temp files |
| **hostPath** | Vida do Node | Logs do node (perigoso) |
| **PersistentVolume** | Independente do Pod | Dados persistentes |

### PersistentVolumes (PV) e Claims (PVC)

\`\`\`text
Admin provisionou:        Usuario solicita:         Pod usa:
PV (10Gi, RWO, fast)  <-- PVC (5Gi, RWO) --------> volumeMount
\`\`\`

### Access Modes

| Modo | Sigla | Descricao |
|------|-------|-----------|
| ReadWriteOnce | RWO | Leitura/escrita por um node |
| ReadOnlyMany | ROX | Somente leitura por multiplos nodes |
| ReadWriteMany | RWX | Leitura/escrita por multiplos nodes |
| ReadWriteOncePod | RWOP | Leitura/escrita por um unico Pod |

### StorageClass e Dynamic Provisioning

\`\`\`yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast
provisioner: kubernetes.io/aws-ebs
parameters:
  type: gp3
reclaimPolicy: Delete
volumeBindingMode: WaitForFirstConsumer
\`\`\`

Com StorageClass, PVs sao criados **automaticamente** quando um PVC e criado.

### CSI (Container Storage Interface)

Padrao para plugins de storage no K8s:
- Substitui in-tree volume plugins
- Permite vendors implementar seus proprios drivers
- Exemplos: AWS EBS CSI, GCP PD CSI, Azure Disk CSI, Ceph CSI

---

## Security Concepts

### Authentication (AuthN)

Quem voce e? Metodos:
- Certificados X.509 (mais comum)
- Bearer Tokens (ServiceAccounts)
- OIDC (OpenID Connect)
- Webhook Token Authentication

### Authorization (AuthZ)

O que voce pode fazer? Modos:
- **RBAC** (padrao): Roles + Bindings
- **ABAC**: Attribute-based (legado)
- **Node**: Restringe kubelet
- **Webhook**: Externo

### RBAC Overview

\`\`\`text
Subject (User/Group/SA) --RoleBinding--> Role --rules--> Resources + Verbs
\`\`\`

| Recurso | Escopo | Binding |
|---------|--------|---------|
| Role | Namespace | RoleBinding |
| ClusterRole | Cluster | ClusterRoleBinding |

### Pod Security Standards (PSS)

| Nivel | Descricao |
|-------|-----------|
| **Privileged** | Sem restricoes (default) |
| **Baseline** | Bloqueia privileged, hostPID, hostNetwork |
| **Restricted** | Mais restritivo: non-root, drop capabilities |

### Network Policies

Firewall L3/L4 para pods. Sem NetworkPolicy = todo trafego permitido.

### Secrets

Dados sensiveis em base64. Boas praticas:
- Encryption at rest
- RBAC restritivo
- Volume mount ao inves de env var

### Admission Controllers

Interceptam requests apos AuthN/AuthZ:
- **Mutating**: modifica o request
- **Validating**: aceita ou rejeita
- Exemplos: PodSecurity, LimitRanger, ResourceQuota
`,

  quiz: [
    {
      question: 'Qual access mode permite que um PV seja montado para leitura/escrita por multiplos nodes?',
      options: ['ReadWriteOnce (RWO)', 'ReadOnlyMany (ROX)', 'ReadWriteMany (RWX)', 'ReadWriteOncePod (RWOP)'],
      correct: 2,
      explanation: 'ReadWriteMany (RWX) permite leitura e escrita de multiplos nodes simultaneamente. Necessario para workloads distribuidos que compartilham dados.',
      reference: 'Conceito relacionado: PV Access Modes.'
    },
    {
      question: 'O que e Dynamic Provisioning no Kubernetes?',
      options: ['Provisionamento manual de PVs', 'Criacao automatica de PVs quando PVCs sao criados, usando StorageClass', 'Provisionamento de nodes', 'Alocacao dinamica de CPU'],
      correct: 1,
      explanation: 'Com StorageClass e dynamic provisioning, o Kubernetes cria PVs automaticamente quando um PVC e criado, sem intervencao do admin.',
      reference: 'Conceito relacionado: StorageClass — dynamic provisioning.'
    },
    {
      question: 'O que CSI significa no contexto de storage?',
      options: ['Container Security Interface', 'Container Storage Interface — padrao para plugins de storage', 'Cluster Service Inspector', 'Container System Installer'],
      correct: 1,
      explanation: 'CSI (Container Storage Interface) e o padrao para plugins de storage no K8s. Permite vendors (AWS, GCP, Ceph) implementar seus proprios drivers de forma padronizada.',
      reference: 'Conceito relacionado: CSI — plugins de storage.'
    },
    {
      question: 'Qual modo de autorizacao e o padrao no Kubernetes?',
      options: ['ABAC', 'RBAC', 'Webhook', 'AlwaysAllow'],
      correct: 1,
      explanation: 'RBAC (Role-Based Access Control) e o modo padrao. Usa Roles (permissoes) + Bindings (associacao a subjects) para controlar acesso.',
      reference: 'Conceito relacionado: RBAC — autorizacao.'
    },
    {
      question: 'Qual nivel do Pod Security Standards bloqueia containers rodando como root?',
      options: ['Privileged', 'Baseline', 'Restricted', 'Nenhum'],
      correct: 2,
      explanation: 'Restricted e o nivel mais restritivo: exige non-root, drop all capabilities, read-only filesystem recomendado. Baseline bloqueia privileged/hostNamespaces mas permite root.',
      reference: 'Conceito relacionado: Pod Security Standards — niveis.'
    },
    {
      question: 'Qual a diferenca entre emptyDir e PersistentVolume?',
      options: ['Nao ha diferenca', 'emptyDir morre com o Pod, PV persiste alem do Pod', 'emptyDir e mais rapido', 'PV e mais seguro'],
      correct: 1,
      explanation: 'emptyDir e efemero (criado/destruido com o Pod). PersistentVolume existe independente do Pod e persiste dados alem do ciclo de vida do Pod.',
      reference: 'Conceito relacionado: Volumes — efemeros vs persistentes.'
    },
    {
      question: 'Qual tipo de Admission Controller pode MODIFICAR um request?',
      options: ['Validating', 'Mutating', 'Authorizing', 'Authenticating'],
      correct: 1,
      explanation: 'Mutating Admission Controllers podem modificar o request (ex: injetar sidecar, adicionar labels). Validating apenas aceita ou rejeita. Mutating roda antes de Validating.',
      reference: 'Conceito relacionado: Admission Controllers — mutating vs validating.'
    }
  ],

  flashcards: [
    { front: 'Quais sao os access modes de PV?', back: 'RWO (ReadWriteOnce): um node. ROX (ReadOnlyMany): multiplos nodes read-only. RWX (ReadWriteMany): multiplos nodes read-write. RWOP (ReadWriteOncePod): um pod.' },
    { front: 'O que e StorageClass?', back: 'Define tipos de storage para provisionamento dinamico. Especifica provisioner (CSI driver), parametros e reclaimPolicy (Delete/Retain). PVCs referenciam a StorageClass.' },
    { front: 'O que e CSI?', back: 'Container Storage Interface: padrao para plugins de storage. Substitui in-tree plugins. Vendors implementam drivers (AWS EBS CSI, GCP PD CSI, Ceph CSI, etc.).' },
    { front: 'Como funciona Authentication no K8s?', back: 'Metodos: certificados X.509, bearer tokens (ServiceAccounts), OIDC, webhook. API Server verifica identidade antes de autorizacao.' },
    { front: 'Quais sao os modos de Authorization?', back: 'RBAC (padrao): Roles + Bindings. Node: restringe kubelet. ABAC: attribute-based (legado). Webhook: delega a servico externo. Recomendado: Node,RBAC.' },
    { front: 'Quais sao os niveis do Pod Security Standards?', back: 'Privileged: sem restricoes. Baseline: bloqueia privileged, hostPID, hostNetwork. Restricted: exige non-root, drop capabilities, limita volumes.' },
    { front: 'O que sao Admission Controllers?', back: 'Plugins que interceptam requests apos AuthN/AuthZ. Mutating modifica (injetar sidecar, defaults). Validating aceita/rejeita (quotas, policies). Ordem: Mutating -> Validating.' }
  ],

  lab: {
    scenario: 'Voce esta explorando conceitos de storage e seguranca no Kubernetes.',
    objective: 'Entender PV/PVC, StorageClasses, RBAC e Pod Security.',
    duration: '10-15 minutos',
    steps: [
      {
        title: 'Explorar Storage do Cluster',
        instruction: 'Liste as StorageClasses disponiveis e entenda como o provisionamento dinamico funciona.',
        hints: ['Use kubectl get storageclass', 'Verifique o provisioner', 'Identifique a StorageClass default'],
        solution: '```bash\n# Listar StorageClasses\nkubectl get storageclass\n\n# Ver detalhes\nkubectl describe storageclass\n\n# Listar PVs e PVCs existentes\nkubectl get pv\nkubectl get pvc -A\n```',
        verify: '```bash\nkubectl get storageclass\n# Saida esperada: pelo menos uma StorageClass (pode ser default)\n\nkubectl get pv 2>/dev/null; echo \"PVs listados\"\n```'
      },
      {
        title: 'Explorar RBAC',
        instruction: 'Examine o RBAC do cluster: verifique suas permissoes e os ClusterRoles built-in.',
        hints: ['Use kubectl auth can-i', 'Liste ClusterRoles built-in', 'Verifique permissoes dos roles view, edit, admin'],
        solution: '```bash\n# Suas permissoes\nkubectl auth can-i --list\n\n# ClusterRoles built-in\nkubectl get clusterroles | grep -E \"^(view|edit|admin|cluster-admin) \"\n\n# Detalhes de um role\nkubectl describe clusterrole view | head -30\n\n# Verificar permissao especifica\nkubectl auth can-i create pods\nkubectl auth can-i delete nodes\n```',
        verify: '```bash\nkubectl auth can-i create pods\n# Saida esperada: yes\n\nkubectl get clusterroles | wc -l\n# Saida esperada: numero > 30 (muitos roles built-in)\n```'
      },
      {
        title: 'Verificar Pod Security',
        instruction: 'Verifique quais namespaces tem Pod Security Standards configurados.',
        hints: ['PSS e configurado via labels no namespace', 'Procure por pod-security.kubernetes.io/', 'Verifique o modo (enforce, audit, warn)'],
        solution: '```bash\n# Verificar labels de PSS nos namespaces\nkubectl get namespaces -o json | jq \'.items[] | select(.metadata.labels[\"pod-security.kubernetes.io/enforce\"] != null) | .metadata.name\'\n\n# Ver todos os labels dos namespaces\nkubectl get ns --show-labels\n\n# Verificar PSS de um namespace especifico\nkubectl get ns kube-system -o yaml | grep pod-security\n```',
        verify: '```bash\nkubectl get ns --show-labels | head -10\n# Saida esperada: namespaces com labels pod-security (se configurados)\n\nkubectl get ns kube-system -o yaml | grep -c pod-security\n# Saida esperada: pode ser 0 (se nao configurado explicitamente)\n```'
      }
    ]
  },

  troubleshooting: []
};
