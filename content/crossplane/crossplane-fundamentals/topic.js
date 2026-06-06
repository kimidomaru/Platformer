window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['crossplane/crossplane-fundamentals'] = {
  theory: `
# Crossplane Fundamentals

## Relevancia
Crossplane e um framework open-source (CNCF Graduated) que transforma o Kubernetes em um **Universal Control Plane** para infraestrutura. Em vez de usar Terraform ou CloudFormation separados, o Crossplane permite provisionar e gerenciar infraestrutura cloud (AWS, GCP, Azure) usando CRDs nativos do Kubernetes — integrando infraestrutura ao GitOps workflow.

## Conceitos Fundamentais

### O que e Crossplane?

\`\`\`
Terraform vs Crossplane:

┌──────────────────────┐    ┌──────────────────────┐
│      Terraform        │    │      Crossplane       │
├──────────────────────┤    ├──────────────────────┤
│ State file (.tfstate)│    │ Estado no K8s (etcd)  │
│ CLI (plan/apply)     │    │ kubectl apply         │
│ Modules              │    │ Compositions/XRDs     │
│ Providers            │    │ Providers (CRDs)      │
│ Workspaces           │    │ Namespaces + Claims   │
│ Separado do K8s      │    │ Nativo no K8s         │
│ Drift detection manual│   │ Continuous reconcile  │
└──────────────────────┘    └──────────────────────┘

Crossplane NAO substitui Terraform para tudo.
Crossplane brilha quando:
- Infraestrutura e gerenciada pelo mesmo time que ops K8s
- Self-service via GitOps (dev faz claim, plataforma provisiona)
- Necessidade de reconciliacao continua (drift detection nativo)
\`\`\`

### Arquitetura do Crossplane

\`\`\`
┌──────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                         │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                 Crossplane                           │    │
│  │                                                     │    │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────────┐  │    │
│  │  │  Provider  │  │Composition │  │   Function   │  │    │
│  │  │  (CRDs)    │  │ Engine     │  │ (Pipeline)   │  │    │
│  │  └─────┬──────┘  └─────┬──────┘  └──────┬───────┘  │    │
│  │        │               │                │           │    │
│  │  ┌─────▼──────────────▼────────────────▼───────┐   │    │
│  │  │           Managed Resources (MRs)           │   │    │
│  │  │  Bucket, RDSInstance, VPC, GKECluster...    │   │    │
│  │  └──────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                    ┌──────▼──────┐                           │
│                    │ProviderConfig│                          │
│                    │(credentials)│                           │
│                    └──────┬──────┘                           │
└───────────────────────────┼──────────────────────────────────┘
                            │  API calls
              ┌─────────────┼────────────────┐
              ▼             ▼                ▼
           ┌─────┐       ┌─────┐        ┌───────┐
           │ AWS │       │ GCP │        │ Azure │
           └─────┘       └─────┘        └───────┘
\`\`\`

### Camadas do Crossplane

\`\`\`
Nivel 1 — Managed Resources (MRs)
  Representacao direta de recursos cloud como CRDs
  Ex: Bucket, RDSInstance, VPCPeeringConnection
  Provisionados diretamente pelos Providers
  1:1 com recursos cloud reais

Nivel 2 — Composite Resources (XRs) e Claims
  Abstrações criadas por Platform Teams
  Ocultam complexidade do MR direto
  Ex: XDatabase (abstrai RDS + Parameter Group + SG)
  Claims = interface para desenvolvedores

Nivel 3 — Platform API (XRDs)
  Definicoes das APIs customizadas da plataforma
  XRD (CompositeResourceDefinition) define o schema
  Composition define como compor recursos
  Functions estendem logica de composicao
\`\`\`

### Managed Resources (MRs)

\`\`\`yaml
# Managed Resource — provisionamento direto de recurso cloud
apiVersion: s3.aws.upbound.io/v1beta1
kind: Bucket
metadata:
  name: my-data-bucket
  annotations:
    crossplane.io/external-name: my-data-bucket-prod-2024
spec:
  forProvider:
    region: us-east-1
    acl: private
    tags:
      Environment: production
      Team: platform
  providerConfigRef:
    name: aws-production
  deletionPolicy: Delete    # Delete | Orphan
\`\`\`

**Campos essenciais de Managed Resources:**

| Campo | Descricao |
|-------|-----------|
| \`spec.forProvider\` | Configuracoes do recurso na cloud |
| \`spec.providerConfigRef\` | Referencia ao ProviderConfig com credenciais |
| \`spec.deletionPolicy\` | O que fazer ao deletar (Delete ou Orphan o recurso real) |
| \`metadata.annotations.crossplane.io/external-name\` | Nome do recurso na cloud |
| \`status.atProvider\` | Estado atual do recurso lido da cloud |
| \`status.conditions\` | Ready/Synced conditions |

### ProviderConfig — Credenciais

\`\`\`yaml
# ProviderConfig para AWS
apiVersion: aws.upbound.io/v1beta1
kind: ProviderConfig
metadata:
  name: aws-production
spec:
  credentials:
    source: Secret
    secretRef:
      namespace: crossplane-system
      name: aws-credentials
      key: credentials
---
# Secret com credenciais AWS
apiVersion: v1
kind: Secret
metadata:
  name: aws-credentials
  namespace: crossplane-system
type: Opaque
data:
  # base64 encoded AWS credentials file format:
  # [default]
  # aws_access_key_id = AKIAXXXXXXXX
  # aws_secret_access_key = XXXXXXXXXX
  credentials: <base64-encoded>
\`\`\`

**Alternativa com IRSA (recomendado para EKS):**

\`\`\`yaml
apiVersion: aws.upbound.io/v1beta1
kind: ProviderConfig
metadata:
  name: aws-production
spec:
  credentials:
    source: IRSA    # IAM Role via ServiceAccount annotation
\`\`\`

### Instalacao

\`\`\`bash
# Instalar Crossplane via Helm
helm repo add crossplane-stable https://charts.crossplane.io/stable
helm install crossplane crossplane-stable/crossplane \\
  --namespace crossplane-system \\
  --create-namespace

# Verificar instalacao
kubectl get pods -n crossplane-system
# crossplane, crossplane-rbac-manager

# Instalar Provider AWS
kubectl apply -f - <<EOF
apiVersion: pkg.crossplane.io/v1
kind: Provider
metadata:
  name: provider-aws-s3
spec:
  package: xpkg.upbound.io/upbound/provider-aws-s3:v1.14.0
  packagePullPolicy: IfNotPresent
  revisionActivationPolicy: Automatic
EOF

# Verificar Provider
kubectl get providers
# INSTALLED=True, HEALTHY=True
\`\`\`

### Conditions dos Managed Resources

\`\`\`yaml
# Status de um MR saudavel
status:
  conditions:
    - type: Ready
      status: "True"
      reason: Available
      message: ""
    - type: Synced
      status: "True"
      reason: ReconcileSuccess

# Status com erro
status:
  conditions:
    - type: Ready
      status: "False"
      reason: Unavailable
      message: "cannot create bucket: BucketAlreadyExists"
    - type: Synced
      status: "False"
      reason: ReconcileError
\`\`\`

**Interpretando conditions:**
- **Ready=True**: Recurso existe e esta disponivel na cloud
- **Synced=True**: Ultimo reconcile foi bem-sucedido
- **Ready=False + Synced=False**: Erro no provisionamento
- **Ready=False + Synced=True**: Recurso sendo criado (Transitioning)

### Provisionamento Continuo (Drift Detection)

\`\`\`
Crossplane vs Terraform — Drift Detection

Terraform:                  Crossplane:
plan → apply → esquece      reconcile loop continuo

Alguem modifica o           Crossplane detecta
bucket manualmente    →     mudanca e REVERTE
no console AWS              automaticamente
                            (se managementPolicy != observe)

managementPolicy:
  - FullControl (default) — Crossplane gerencia tudo
  - ObserveOnly — Crossplane so observa (read-only)
\`\`\`

### Erros Comuns

1. **ProviderConfig nao encontrado** — MR referencia ProviderConfig que nao existe
2. **Credenciais invalidas** — Secret com formato incorreto de credenciais
3. **deletionPolicy: Orphan esquecido** — Recurso cloud fica orfao apos delete do MR
4. **external-name conflito** — Nome do recurso cloud ja existe em outra conta/regiao
5. **Provider nao Healthy** — Verificar imagem do provider e conectividade com cloud
6. **RBAC insuficiente** — Crossplane precisa de permissoes para gerenciar CRDs dos providers

## Killer.sh Style Challenge

> **Cenario:** Usando Crossplane, provisione um S3 Bucket na AWS com a regiao us-east-1, politica de delecao Orphan (para nao deletar acidentalmente), com tag Environment=production. Configure o ProviderConfig usando um Secret com credenciais. Verifique que o bucket esta Ready e Synced.
`,
  quiz: [
    {
      question: 'O que diferencia Crossplane de Terraform na gestao de infraestrutura?',
      options: [
        'Crossplane e mais rapido que Terraform',
        'Crossplane usa o Kubernetes como control plane com reconciliacao continua nativa; Terraform usa state file e requer runs manuais',
        'Terraform suporta mais clouds que Crossplane',
        'Crossplane e apenas para AWS'
      ],
      correct: 1,
      explanation: 'Crossplane integra gestao de infraestrutura ao Kubernetes (CRDs, kubectl, GitOps), com reconciliacao continua que detecta e corrige drift automaticamente. Terraform usa state file separado e requer execucao explicita de plan/apply.',
      reference: 'Conceito relacionado: Crossplane brilha em cenarios de self-service com Platform APIs e GitOps.'
    },
    {
      question: 'O que sao Managed Resources (MRs) no Crossplane?',
      options: [
        'Pods gerenciados pelo Crossplane',
        'CRDs que representam 1:1 recursos reais na cloud (ex: Bucket, RDSInstance, VPC)',
        'Recursos de monitoramento',
        'Configuracoes do Kubernetes'
      ],
      correct: 1,
      explanation: 'Managed Resources sao CRDs instalados pelos Providers que representam diretamente recursos cloud. Um Bucket CR corresponde a um S3 bucket real. O Crossplane reconcilia continuamente o estado desejado com o real.',
      reference: 'Conceito relacionado: spec.forProvider contem a configuracao do recurso na cloud; status.atProvider reflete o estado atual.'
    },
    {
      question: 'Para que serve o campo spec.deletionPolicy em um Managed Resource?',
      options: [
        'Definir a politica de backup',
        'Controlar se o recurso cloud real sera deletado quando o MR for deletado (Delete ou Orphan)',
        'Configurar a politica de autoscaling',
        'Definir a retencao de logs'
      ],
      correct: 1,
      explanation: 'deletionPolicy: Delete remove o recurso cloud quando o MR e deletado. deletionPolicy: Orphan remove apenas o CRD mas mantem o recurso cloud (util para prevenir delecoes acidentais em producao).',
      reference: 'Conceito relacionado: Use Orphan em recursos de dados criticos como bancos e buckets de producao.'
    },
    {
      question: 'O que significa Ready=False e Synced=True em um Managed Resource?',
      options: [
        'O recurso esta com erro permanente',
        'O recurso esta sendo criado/provisionado (estado transiente)',
        'O recurso foi deletado',
        'As credenciais estao invalidas'
      ],
      correct: 1,
      explanation: 'Ready=False + Synced=True indica que o ultimo reconcile foi bem-sucedido (sem erro de API), mas o recurso ainda nao esta disponivel — geralmente porque ainda esta sendo criado. Quando Ready=False + Synced=False, ha um erro real.',
      reference: 'Conceito relacionado: Ready=True + Synced=True e o estado saudavel esperado.'
    },
    {
      question: 'Quais sao as tres camadas principais da arquitetura Crossplane?',
      options: [
        'Pods, Services, Ingress',
        'Managed Resources (MRs), Composite Resources (XRs/Claims), Platform API (XRDs)',
        'Control Plane, Data Plane, Management Plane',
        'Providers, Operators, Controllers'
      ],
      correct: 1,
      explanation: 'Nivel 1: MRs (1:1 com recursos cloud). Nivel 2: XRs e Claims (abstracoes criadas por platform teams para esconder complexidade). Nivel 3: XRDs (definicoes das APIs da plataforma que geram os CRDs de Claims).',
      reference: 'Conceito relacionado: Claims sao a interface para desenvolvedores; XRDs definem o schema das Claims.'
    },
    {
      question: 'Para que serve o ProviderConfig no Crossplane?',
      options: [
        'Configurar a versao do Provider',
        'Definir as credenciais de acesso ao cloud provider (AWS, GCP, Azure)',
        'Configurar os limites de recursos do Provider',
        'Definir quais MRs o Provider pode criar'
      ],
      correct: 1,
      explanation: 'ProviderConfig define as credenciais usadas pelo Provider para acessar a cloud. Pode referenciar um Secret com credenciais, ou usar IRSA (AWS), Workload Identity (GCP), ou Managed Identity (Azure) para autenticacao sem senha.',
      reference: 'Conceito relacionado: MRs referenciam ProviderConfig via spec.providerConfigRef.'
    },
    {
      question: 'O que o campo crossplane.io/external-name define?',
      options: [
        'O nome do CRD no Kubernetes',
        'O nome do recurso real na cloud (ex: nome do bucket S3)',
        'O nome do Provider',
        'O nome do Composition'
      ],
      correct: 1,
      explanation: 'A annotation crossplane.io/external-name define o nome do recurso na cloud. Se nao especificado, o Crossplane usa o metadata.name do MR. Util quando o nome cloud deve ser diferente do nome K8s ou quando importando recursos existentes.',
      reference: 'Conceito relacionado: Para importar recursos existentes, definir external-name com o nome do recurso ja existente na cloud.'
    }
  ],
  flashcards: [
    {
      front: 'O que e Crossplane e qual problema ele resolve?',
      back: '**Crossplane** = Kubernetes como Universal Control Plane para infraestrutura.\n\n**Problema resolvido:**\nGerenciar infraestrutura cloud (AWS/GCP/Azure) com as mesmas ferramentas K8s (kubectl, GitOps, RBAC).\n\n**Como funciona:**\n- Providers instalam CRDs para recursos cloud\n- kubectl apply provisiona recursos reais\n- Reconciliacao continua detecta e corrige drift\n\n**Vantagens sobre Terraform:**\n- Estado no etcd (nao em state file)\n- Drift detection nativo (continuous reconcile)\n- GitOps nativo (Pull model)\n- Self-service via Claims\n- RBAC K8s para controle de acesso'
    },
    {
      front: 'Quais sao as camadas da arquitetura Crossplane?',
      back: '**Nivel 1 — Managed Resources:**\n- 1:1 com recursos cloud reais\n- Instalados pelos Providers\n- Ex: Bucket, RDSInstance, VPCSubnet\n- spec.forProvider = config da cloud\n\n**Nivel 2 — Composite Resources (XR) e Claims:**\n- Abstracoes criadas por Platform Teams\n- XR = versao cluster-scoped\n- Claim = versao namespace-scoped (para devs)\n- Escondem complexidade dos MRs\n\n**Nivel 3 — Platform API:**\n- XRD (CompositeResourceDefinition)\n- Define schema das Claims\n- Composition implementa como compor\n- Functions estendem logica'
    },
    {
      front: 'O que sao Managed Resources e quais os campos essenciais?',
      back: '**Managed Resources (MRs):**\nCRDs que representam recursos cloud 1:1.\n\n**Campos essenciais:**\n- spec.forProvider: config do recurso na cloud\n- spec.providerConfigRef: credenciais\n- spec.deletionPolicy: Delete|Orphan\n- metadata.annotations.crossplane.io/external-name: nome na cloud\n\n**Status:**\n- status.atProvider: estado atual lido da cloud\n- status.conditions:\n  - Ready=True: recurso disponivel\n  - Synced=True: ultimo reconcile OK\n\n**Exemplo:**\nBucket → S3 bucket real\nRDSInstance → RDS database real'
    },
    {
      front: 'Como funciona o deletionPolicy?',
      back: '**Delete (padrao):**\n- Deletar o MR no K8s → deleta o recurso na cloud\n- Seguro para ambientes temporarios\n- Risco: pode deletar dados acidentalmente\n\n**Orphan:**\n- Deletar o MR → remove apenas o CRD\n- Recurso cloud PERMANECE\n- Seguro para recursos com dados\n- Use em: databases, buckets de producao\n\n**Quando usar Orphan:**\n- Bancos de dados RDS\n- Buckets S3 com dados criticos\n- Qualquer recurso que voce NAO quer deletar acidentalmente\n\n**Depois de Orphan:**\nRecurso fica "unmanaged" na cloud. Gerenciar manualmente ou re-importar.'
    },
    {
      front: 'Quais conditions um Managed Resource saudavel deve ter?',
      back: '**Estado saudavel:**\n- Ready=True: recurso disponivel na cloud\n- Synced=True: ultimo reconcile OK\n\n**Criando/Transitioning:**\n- Ready=False, Synced=True\n- Normal durante provisionamento\n- Aguardar Ready=True\n\n**Erro:**\n- Ready=False, Synced=False\n- Verificar message para causa\n- Comum: credenciais invalidas, limite de quota\n\n**Verificar:**\n\`\`\`bash\nkubectl get managed\nkubectl describe bucket my-bucket\nkubectl get events --field-selector reason=CannotObserveExternalResource\n\`\`\`'
    },
    {
      front: 'Como configurar ProviderConfig com diferentes metodos de autenticacao?',
      back: '**Secret (basico):**\n\`\`\`yaml\nspec:\n  credentials:\n    source: Secret\n    secretRef:\n      name: aws-creds\n      namespace: crossplane-system\n      key: credentials\n\`\`\`\n\n**IRSA (AWS EKS — recomendado):**\n\`\`\`yaml\nspec:\n  credentials:\n    source: IRSA\n\`\`\`\nRequer annotation no ServiceAccount do Provider.\n\n**Workload Identity (GCP):**\n\`\`\`yaml\nspec:\n  credentials:\n    source: InjectedIdentity\n\`\`\`\n\n**Managed Identity (Azure):**\n\`\`\`yaml\nspec:\n  credentials:\n    source: UserAssignedManagedIdentity\n\`\`\`'
    },
    {
      front: 'Como instalar Crossplane e um Provider?',
      back: '**Instalar Crossplane:**\n\`\`\`bash\nhelm repo add crossplane-stable \\\n  https://charts.crossplane.io/stable\nhelm install crossplane \\\n  crossplane-stable/crossplane \\\n  -n crossplane-system --create-namespace\n\`\`\`\n\n**Instalar Provider:**\n\`\`\`yaml\napiVersion: pkg.crossplane.io/v1\nkind: Provider\nmetadata:\n  name: provider-aws-s3\nspec:\n  package: xpkg.upbound.io/upbound/provider-aws-s3:v1.14.0\n\`\`\`\n\n**Verificar:**\n\`\`\`bash\nkubectl get providers\n# INSTALLED=True, HEALTHY=True\nkubectl get crds | grep aws\n# CRDs dos recursos AWS instalados\n\`\`\`'
    }
  ],
  lab: {
    scenario: 'Voce tem um cluster Kubernetes (kind/minikube) sem nenhuma credencial de nuvem. Quer aprender o fluxo do Crossplane de ponta a ponta usando o provider-kubernetes, que gerencia objetos do proprio cluster como Managed Resources — assim o lab roda 100% local, sem AWS/GCP.',
    objective: 'Instalar o Crossplane via Helm, configurar o provider-kubernetes, criar um ProviderConfig e provisionar um Managed Resource (Object) de forma declarativa, entendendo o ciclo Provider -> ProviderConfig -> Managed Resource.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Instalar o Crossplane no cluster',
        instruction: 'Instale o core do Crossplane no namespace `crossplane-system` usando o Helm chart oficial e confirme que os pods estao Running.',
        hints: ['O repo Helm e https://charts.crossplane.io/stable', 'Use --create-namespace', 'O deployment principal e crossplane + crossplane-rbac-manager'],
        solution: '```bash\nhelm repo add crossplane-stable https://charts.crossplane.io/stable\nhelm repo update\nhelm install crossplane crossplane-stable/crossplane \\\n  --namespace crossplane-system --create-namespace\n\nkubectl get pods -n crossplane-system\n```',
        verify: '```bash\nkubectl get deploy -n crossplane-system\n# Saida esperada: crossplane e crossplane-rbac-manager com READY 1/1\nkubectl get crds | grep crossplane.io | head\n# Saida esperada: providers.pkg.crossplane.io, configurations.pkg.crossplane.io, etc.\n```'
      },
      {
        title: 'Instalar o provider-kubernetes',
        instruction: 'Crie um recurso `Provider` apontando para o provider-kubernetes (gerencia objetos do proprio cluster, sem credenciais de nuvem) e aguarde ficar Healthy.',
        hints: ['kind: Provider, apiVersion pkg.crossplane.io/v1', 'package: xpkg.upbound.io/crossplane-contrib/provider-kubernetes:v0.13.0', 'kubectl get provider mostra INSTALLED e HEALTHY'],
        solution: '```bash\ncat <<EOF | kubectl apply -f -\napiVersion: pkg.crossplane.io/v1\nkind: Provider\nmetadata:\n  name: provider-kubernetes\nspec:\n  package: xpkg.upbound.io/crossplane-contrib/provider-kubernetes:v0.13.0\nEOF\n\nkubectl get provider provider-kubernetes -w\n```',
        verify: '```bash\nkubectl get provider provider-kubernetes\n# Saida esperada: INSTALLED=True  HEALTHY=True\nkubectl get crds | grep kubernetes.crossplane.io\n# Saida esperada: objects.kubernetes.crossplane.io (o CRD do Managed Resource)\n```'
      },
      {
        title: 'Configurar o ProviderConfig (identidade do provider)',
        instruction: 'Crie um `ProviderConfig` que diz ao provider-kubernetes para usar a ServiceAccount do proprio pod (credentials source: InjectedIdentity), evitando qualquer secret.',
        hints: ['apiVersion kubernetes.crossplane.io/v1alpha1, kind ProviderConfig', 'spec.credentials.source: InjectedIdentity', 'O provider precisa de RBAC; em lab voce pode dar cluster-admin ao SA do provider'],
        solution: '```bash\ncat <<EOF | kubectl apply -f -\napiVersion: kubernetes.crossplane.io/v1alpha1\nkind: ProviderConfig\nmetadata:\n  name: default\nspec:\n  credentials:\n    source: InjectedIdentity\nEOF\n\n# RBAC para o SA do provider (apenas para o lab)\nSA=$(kubectl get sa -n crossplane-system -o name | grep provider-kubernetes | head -1)\nkubectl create clusterrolebinding provider-kubernetes-admin \\\n  --clusterrole=cluster-admin \\\n  --serviceaccount=crossplane-system:$(basename $SA)\n```',
        verify: '```bash\nkubectl get providerconfig.kubernetes.crossplane.io default\n# Saida esperada: o ProviderConfig "default" existe (AGE preenchido)\n```'
      },
      {
        title: 'Provisionar um Managed Resource declarativo',
        instruction: 'Crie um `Object` (Managed Resource do provider-kubernetes) que faz o Crossplane provisionar e reconciliar um ConfigMap no cluster. Edite/Delete o ConfigMap a mao e observe o Crossplane reconciliar de volta (drift correction).',
        hints: ['kind: Object, apiVersion kubernetes.crossplane.io/v1alpha2', 'spec.forProvider.manifest contem o ConfigMap desejado', 'Delete o ConfigMap e veja o Crossplane recria-lo'],
        solution: '```bash\ncat <<EOF | kubectl apply -f -\napiVersion: kubernetes.crossplane.io/v1alpha2\nkind: Object\nmetadata:\n  name: platform-config\nspec:\n  forProvider:\n    manifest:\n      apiVersion: v1\n      kind: ConfigMap\n      metadata:\n        name: platform-config\n        namespace: default\n      data:\n        owner: platform-team\n        managedBy: crossplane\n  providerConfigRef:\n    name: default\nEOF\n\n# Drift test: apague o ConfigMap e veja o Crossplane recriar\nkubectl delete configmap platform-config -n default\nsleep 5\nkubectl get configmap platform-config -n default\n```',
        verify: '```bash\nkubectl get object.kubernetes.crossplane.io platform-config\n# Saida esperada: SYNCED=True  READY=True\nkubectl get configmap platform-config -n default -o jsonpath=\'{.data.managedBy}{\"\\n\"}\'\n# Saida esperada: crossplane (recriado pelo Crossplane mesmo apos delete = drift correction)\n```'
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Managed Resource fica em Synced=False com erro de credenciais',
      difficulty: 'medium',
      symptom: 'Ao criar um MR (ex: Bucket), o status mostra Synced=False com mensagem de erro de autenticacao ou permissao.',
      diagnosis: `\`\`\`bash
# 1. Verificar conditions do MR
kubectl describe bucket my-bucket | grep -A10 "Conditions:"

# 2. Verificar se o ProviderConfig existe
kubectl get providerconfig aws-production

# 3. Verificar o Secret de credenciais
kubectl get secret aws-credentials -n crossplane-system
kubectl get secret aws-credentials -n crossplane-system -o jsonpath='{.data.credentials}' | base64 -d

# 4. Verificar logs do Provider
kubectl logs -n crossplane-system -l pkg.crossplane.io/revision=provider-aws-s3 --tail=20

# 5. Verificar eventos
kubectl get events -n crossplane-system | grep -i error | tail -10
\`\`\``,
      solution: `**Causas e solucoes:**

1. **ProviderConfig nao encontrado:** Verificar que o nome em spec.providerConfigRef.name corresponde exatamente ao nome do ProviderConfig existente.

2. **Secret com formato incorreto:** O Secret para AWS deve conter o arquivo de credenciais no formato INI: [default]\\naws_access_key_id=...\\naws_secret_access_key=... Verificar encoding base64.

3. **IAM permissions insuficientes:** As credenciais AWS precisam de permissoes para o servico usado (ex: s3:CreateBucket, s3:PutBucketTagging). Verificar IAM policy.

4. **Region incorreta:** Verificar que a regiao em spec.forProvider.region esta correta e o recurso pode ser criado nela.

5. **Provider nao instalado/saudavel:** Verificar kubectl get providers. Se HEALTHY=False, verificar imagem do provider e conectividade de rede do cluster com os endpoints da cloud.`
    },
    {
      title: 'Provider fica em estado NotInstalled ou Unhealthy',
      difficulty: 'hard',
      symptom: 'Apos instalar um Provider via kubectl apply, ele permanece em INSTALLED=False ou HEALTHY=False.',
      diagnosis: `\`\`\`bash
# 1. Verificar status do Provider
kubectl get provider provider-aws-s3 -o yaml | grep -A20 "status:"

# 2. Verificar se o pod do Provider foi criado
kubectl get pods -n crossplane-system | grep provider

# 3. Verificar eventos do Provider
kubectl describe provider provider-aws-s3 | grep -A20 "Events:"

# 4. Verificar se ha erros de pull da imagem
kubectl describe pod -n crossplane-system -l pkg.crossplane.io/revision | grep -A10 "Events:"

# 5. Verificar versao do Crossplane e compatibilidade
kubectl get deployment -n crossplane-system crossplane -o jsonpath='{.spec.template.spec.containers[0].image}'
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Imagem do package nao acessivel:** Verificar que o cluster tem acesso a xpkg.upbound.io (ou registry customizado). Verificar ImagePullSecrets se registry for privado.

2. **Versao incompativel:** Verificar compatibilidade entre versao do Crossplane e versao do Provider. Verificar na documentacao do provider as versoes suportadas.

3. **CRDs do Crossplane nao prontos:** Se o Crossplane foi instalado recentemente, aguardar os CRDs estarem prontos antes de instalar providers (kubectl wait --for=condition=Established crd/providers.pkg.crossplane.io).

4. **Sem acesso ao Kubernetes API:** O pod do Provider precisa de RBAC para criar/gerenciar os CRDs dos MRs. O crossplane-rbac-manager cria essas permissoes automaticamente.

5. **OOMKilled:** Se o provider tem muitos CRDs, pode consumir muita memoria. Aumentar limites de memoria no DeploymentRuntimeConfig.`
    }
  ]
};
