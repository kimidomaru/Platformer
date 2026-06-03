window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['kcsa-security-overview/cloud-provider-security'] = {

  theory: `# Cloud Provider & Infrastructure Security

## Relevancia no KCSA
> O dominio "Overview of Cloud Native Security" vale **14%** do KCSA. Entender o modelo de seguranca dos provedores de nuvem, IAM, VPCs e como isso se integra ao Kubernetes e fundamental para o exame.

---

## Shared Responsibility Model

O **Shared Responsibility Model** define quem e responsavel por cada aspecto de seguranca.

### Em Kubernetes Self-Managed (IaaS)

| Responsabilidade | Cloud Provider | Cliente |
|-----------------|----------------|---------|
| Hardware fisico | ✅ | ❌ |
| Datacenter/rede | ✅ | ❌ |
| Hypervisor | ✅ | ❌ |
| Sistema Operacional | ❌ | ✅ |
| Container Runtime | ❌ | ✅ |
| Kubernetes Control Plane | ❌ | ✅ |
| Workloads e aplicacoes | ❌ | ✅ |
| RBAC e access control | ❌ | ✅ |

### Em Managed Kubernetes (EKS, GKE, AKS)

| Responsabilidade | Cloud Provider | Cliente |
|-----------------|----------------|---------|
| Hardware e datacenter | ✅ | ❌ |
| SO dos nodes gerenciados | ✅ (parcial) | ❌ |
| **Kubernetes Control Plane** | ✅ | ❌ |
| **etcd** | ✅ | ❌ |
| **API Server availability** | ✅ | ❌ |
| Worker nodes (SO, patches) | Depende | ✅ |
| RBAC e policies | ❌ | ✅ |
| Network Policies | ❌ | ✅ |
| Pod security | ❌ | ✅ |
| Secrets management | ❌ | ✅ |
| Workloads | ❌ | ✅ |

> **Ponto critico no KCSA:** Em managed K8s, o provedor gerencia o control plane, mas o cliente e 100% responsavel por RBAC, Pod Security Standards, Network Policies e seguranca dos workloads.

---

## IAM (Identity and Access Management) para Kubernetes

### IAM do Cloud Provider vs Kubernetes RBAC

Sao sistemas distintos que funcionam em camadas diferentes:

\`\`\`text
Cloud Provider IAM:
  Usuario AWS/GCP/Azure --> IAM Roles --> Permissao de acessar o cluster (ex: EKS:DescribeCluster)
                                          Permissao de criar VMs, redes, load balancers

Kubernetes RBAC:
  Usuario autenticado --> Roles/ClusterRoles --> Permissao de operar recursos K8s
\`\`\`

### IAM Roles para Nos Kubernetes

Nodes Kubernetes precisam de permissoes IAM para interagir com o cloud provider:

| Recurso | Exemplo de Permissao Necessaria |
|---------|--------------------------------|
| **Storage (EBS/PD)** | ec2:AttachVolume, ec2:DescribeVolumes |
| **Load Balancers** | elasticloadbalancing:CreateLoadBalancer |
| **DNS (ExternalDNS)** | route53:ChangeResourceRecordSets |
| **Container Registry** | ecr:GetAuthorizationToken, ecr:BatchGetImage |
| **Auto Scaling** | autoscaling:DescribeAutoScalingGroups |

**Boas praticas:**
- Usar **Instance Profiles** (AWS) ou **Managed Identities** (Azure) em vez de credenciais estaticas
- Principio do **menor privilegio** — cada node pool com apenas o necessario
- **Nunca armazenar IAM credentials em Pods** — usar Workload Identity

---

## Workload Identity (IRSA, Workload Identity, Managed Identity)

Permite que Pods assumam IAM roles do cloud sem credenciais estaticas:

### AWS: IRSA (IAM Roles for Service Accounts)

\`\`\`text
Pod --> ServiceAccount (com annotation) --> OIDC Provider (EKS) --> IAM Role --> AWS Services
\`\`\`

\`\`\`yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: s3-reader
  namespace: production
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789:role/S3ReadRole
\`\`\`

### GCP: Workload Identity

\`\`\`yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: gcs-reader
  annotations:
    iam.gke.io/gcp-service-account: gcs-reader@project.iam.gserviceaccount.com
\`\`\`

### Beneficios de Workload Identity

| Aspecto | Credenciais Estaticas | Workload Identity |
|---------|----------------------|-------------------|
| Rotacao | Manual | Automatica |
| Escopo | Compartilhado | Por Pod/SA |
| Auditoria | Dificil | Por SA/Pod |
| Risco de vazamento | Alto | Baixo |

---

## VPC e Isolamento de Rede

### Subnets para Kubernetes

\`\`\`text
VPC (10.0.0.0/16)
  +-- Subnet Publica (10.0.1.0/24)
  |     +-- Load Balancers
  |     +-- NAT Gateway
  |
  +-- Subnet Privada (10.0.2.0/24)
  |     +-- Worker Nodes (sem IP publico)
  |     +-- Control Plane (EKS/GKE managed)
  |
  +-- Subnet Privada (10.0.3.0/24)
        +-- Banco de dados (RDS/CloudSQL)
\`\`\`

**Boas praticas:**
- Nodes K8s em **subnets privadas** (sem acesso direto da internet)
- API Server acessivel apenas via VPN ou bastion host
- Load Balancers na subnet publica fazendo proxy para pods

### Security Groups e Firewall Rules

| Porta | Protocolo | Origem | Destino | Funcao |
|-------|-----------|--------|---------|--------|
| 6443 | TCP | Workers + Admin | Control Plane | API Server |
| 2379-2380 | TCP | Control Plane | etcd | etcd client/peer |
| 10250 | TCP | Control Plane | Workers | kubelet API |
| 30000-32767 | TCP | Clientes | Workers | NodePort Services |

---

## Protecao do Metadata API (169.254.169.254)

O **Instance Metadata Service (IMDS)** do cloud provider expoe informacoes sensiveis:

\`\`\`bash
# O que um Pod pode ver se acessar o metadata API:
curl http://169.254.169.254/latest/meta-data/
# - IAM credentials temporarias do node
# - Informacoes da instancia
# - User data (pode conter segredos)
\`\`\`

### IMDSv2 (AWS) — Protecao contra SSRF

\`\`\`text
IMDSv1: GET direto (vulneravel a SSRF)
  curl http://169.254.169.254/latest/meta-data/iam/security-credentials/

IMDSv2: Requer token primeiro (PUT para obter token)
  TOKEN=$(curl -X PUT http://169.254.169.254/latest/api/token -H "TTL: 21600")
  curl http://169.254.169.254/latest/meta-data/ -H "Token: $TOKEN"
\`\`\`

### Bloquear via NetworkPolicy

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: block-metadata-api
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

---

## Container Registries Seguros

| Registry | Tipo | Features de Seguranca |
|----------|------|----------------------|
| **Amazon ECR** | Cloud | IAM auth, image scanning, encryption at rest |
| **Google Artifact Registry** | Cloud | IAM auth, vulnerability scanning, binary authorization |
| **Azure ACR** | Cloud | AAD auth, geo-replication, content trust |
| **Harbor** | Self-hosted | RBAC, image scanning (Trivy), signing, proxy cache |
| **Docker Hub** | Publico | Rate limiting, 2FA, access tokens |

**Boas praticas:**
- Usar **registries privados** para imagens de producao
- Habilitar **image scanning** automatico
- Usar **image signing** (Cosign, Notary)
- Politicas de **pull access** por projeto/namespace
- **Never pull from :latest** em producao

---

## Encryption at Rest

Dados sensiveis devem ser encriptados em repouso:

| Recurso | Metodo | Provider |
|---------|--------|---------|
| Discos dos nodes | EBS Encryption, PD Encryption | Cloud provider |
| Volumes persistentes (PV) | StorageClass com encryption | Cloud + Kubernetes |
| Secrets no etcd | EncryptionConfiguration | Kubernetes |
| Backups | Encriptacao antes de armazenar | Operacional |

---

## Cloud-Specific Security Features

### AWS EKS
- **EKS Pod Identity** (mais moderno que IRSA)
- **EKS Security Groups for Pods** — SG por pod, nao por node
- **Amazon GuardDuty for EKS** — threat detection
- **AWS Secrets Manager** via External Secrets Operator
- **AWS PrivateLink** para API server privado

### GKE (Google Kubernetes Engine)
- **Autopilot mode** — hardening automatico
- **Binary Authorization** — validacao de imagens via policy
- **Workload Identity** — IRSA equivalente
- **Google Cloud Armor** — WAF para ingress
- **Config Connector** — gerenciar infra GCP via K8s

### AKS (Azure Kubernetes Service)
- **Managed Identity** para pods
- **Azure Policy for AKS** — policy enforcement via Gatekeeper
- **Microsoft Defender for Containers**
- **Azure Key Vault CSI Driver** — montar segredos do Key Vault
- **Azure AD integration** — autenticacao OIDC

---

## Erros Comuns no KCSA

1. **Achar que o cloud provider gerencia RBAC** — em qualquer tipo de K8s, RBAC e responsabilidade do cliente
2. **Confundir Cloud IAM com Kubernetes RBAC** — sao sistemas separados, complementares
3. **Ignorar IMDSv2** — IMDSv1 e vulneravel a SSRF, IMDSv2 requer token
4. **Nodes com acesso direto a internet** — nodes devem estar em subnets privadas
5. **Credenciais IAM hardcoded em Pods** — usar Workload Identity (IRSA/GKE WI)
`,

  quiz: [
    {
      question: 'Em um cluster EKS (managed Kubernetes), qual responsabilidade e do CLIENTE e nao da AWS?',
      options: ['Manutencao do etcd', 'Disponibilidade do API Server', 'Configuracao de RBAC e Pod Security', 'Patches do Kubernetes Control Plane'],
      correct: 2,
      explanation: 'Em managed Kubernetes (EKS, GKE, AKS), o provedor gerencia o control plane (etcd, API Server, patches). O cliente e responsavel por RBAC, Pod Security Standards, Network Policies e seguranca dos workloads.',
      reference: 'Shared Responsibility: Provider = control plane. Client = RBAC, workloads, network policies, PSS.'
    },
    {
      question: 'O que e IRSA (IAM Roles for Service Accounts) na AWS?',
      options: ['Um sistema de RBAC do EKS', 'Permite que Pods assumam IAM Roles sem credenciais estaticas via ServiceAccount + OIDC', 'Um scanner de vulnerabilidades', 'Sistema de autenticacao do kubectl'],
      correct: 1,
      explanation: 'IRSA permite que Pods usem ServiceAccounts com annotations para assumir IAM Roles do AWS via OIDC provider do EKS. Elimina a necessidade de credenciais IAM estaticas em pods.',
      reference: 'Workload Identity: IRSA (AWS), Workload Identity (GKE), Managed Identity (AKS). Elimina credenciais estaticas.'
    },
    {
      question: 'Por que pods NAO devem ter acesso ao endpoint 169.254.169.254?',
      options: ['E um IP de broadcast', 'E o metadata API do cloud provider, que pode expor IAM credentials do node', 'E o IP do kube-proxy', 'Pods nao conseguem acessar esse IP por padrao'],
      correct: 1,
      explanation: '169.254.169.254 e o Instance Metadata Service (IMDS) do cloud provider. Expoe IAM credentials temporarias do node, informacoes da instancia e user data. Um pod comprometido pode rouba-las via SSRF.',
      reference: 'IMDS = 169.254.169.254. Bloquear com NetworkPolicy egress. IMDSv2 adiciona protecao com token obrigatorio.'
    },
    {
      question: 'Qual e a principal diferenca entre IMDSv1 e IMDSv2 da AWS?',
      options: ['IMDSv2 e mais rapido', 'IMDSv2 requer um token temporario obtido via PUT antes de acessar metadados (protege contra SSRF)', 'IMDSv2 e exclusivo para EKS', 'IMDSv1 nao expoe credenciais'],
      correct: 1,
      explanation: 'IMDSv1 permite GET direto, vulneravel a Server-Side Request Forgery (SSRF). IMDSv2 requer um token obtido via PUT com TTL, tornando ataques SSRF muito mais dificeis pois o atacante nao consegue o token.',
      reference: 'IMDSv1 = vulneravel a SSRF. IMDSv2 = token obrigatorio (PUT primeiro). Habilitar IMDSv2 nos launch templates dos nodes.'
    },
    {
      question: 'Por que nodes Kubernetes devem estar em subnets privadas?',
      options: ['Para economizar custos de IP', 'Para impedir acesso direto da internet aos nodes, reduzindo a superficie de ataque', 'Porque o Kubernetes nao funciona com IPs publicos', 'Para melhorar a performance de rede'],
      correct: 1,
      explanation: 'Nodes com IPs publicos ficam diretamente expostos na internet, aumentando o risco de ataques ao kubelet, SSH e servicos rodando nos nodes. Subnets privadas so permitem acesso via NAT (saida) ou Load Balancers/proxies controlados (entrada).',
      reference: 'Nodes em subnets privadas = camada Cloud do 4C. Load Balancers na subnet publica como proxy controlado.'
    },
    {
      question: 'Qual feature do GKE valida que apenas imagens assinadas por autoridades aprovadas podem ser executadas no cluster?',
      options: ['Workload Identity', 'Binary Authorization', 'Autopilot Mode', 'Cloud Armor'],
      correct: 1,
      explanation: 'Binary Authorization (GKE) valida imagens via politicas que requerem assinaturas de autoridades aprovadas antes de permitir o deploy. E similar ao ImagePolicyWebhook no Kubernetes.',
      reference: 'Binary Authorization (GKE) = validacao de assinatura de imagens. Analogos: ImagePolicyWebhook, Kyverno verifyImages.'
    },
    {
      question: 'Qual e a vantagem de usar Workload Identity em vez de credenciais IAM estaticas em Pods?',
      options: ['E mais rapido', 'Rotacao automatica de credenciais, escopo por SA/Pod e melhor auditoria sem risco de vazamento', 'Nao e necessario configurar RBAC', 'O pod tem mais permissoes'],
      correct: 1,
      explanation: 'Workload Identity elimina credenciais estaticas: tokens sao temporarios e rotacionados automaticamente, escopo e por ServiceAccount/Pod especifico, e acoes sao auditadas com identidade clara do pod.',
      reference: 'Workload Identity: credenciais temporarias, por SA, auditaveis. Credenciais estaticas: permanentes, compartilhadas, risco de vazamento.'
    },
    {
      question: 'Qual servico AWS permite inspecao e deteccao de ameacas especifica para clusters EKS?',
      options: ['AWS Inspector', 'Amazon GuardDuty for EKS', 'AWS Shield', 'Amazon Detective'],
      correct: 1,
      explanation: 'Amazon GuardDuty for EKS analisa Kubernetes audit logs para detectar comportamentos suspeitos como acessos incomuns ao API server, escalacao de privilegios e comprometimento de pods.',
      reference: 'GuardDuty for EKS = threat detection via audit logs. Analogos: Falco (open source), Sysdig Secure.'
    }
  ],

  flashcards: [
    { front: 'O que o cloud provider gerencia em managed Kubernetes?', back: 'Control plane: etcd, API Server, controller-manager, scheduler. Patches e atualizacoes. Disponibilidade (SLA). O CLIENTE gerencia: RBAC, PSS, Network Policies, workloads, secrets e worker nodes.' },
    { front: 'O que e IRSA/Workload Identity?', back: 'Mecanismo que permite Pods assumir IAM roles do cloud via ServiceAccount + OIDC, sem credenciais estaticas. AWS: IRSA. GKE: Workload Identity. Azure: Managed Identity. Beneficio: credenciais temporarias e auditaveis.' },
    { front: 'Por que bloquear 169.254.169.254 via NetworkPolicy?', back: 'Instance Metadata Service do cloud provider. Expoe IAM credentials temporarias do node, informacoes sensiveis. Vulneravel a SSRF. Bloquear com egress NetworkPolicy excluindo 169.254.169.254/32.' },
    { front: 'IMDSv1 vs IMDSv2?', back: 'IMDSv1: GET direto, vulneravel a SSRF. IMDSv2: requer PUT para obter token temporario antes de acessar metadados, bloqueando SSRF. Configurar nos launch templates dos nodes EKS.' },
    { front: 'Por que nodes devem estar em subnets privadas?', back: 'Subnets privadas isolam nodes da internet direta. Acesso controlado via Load Balancers (entrada) e NAT Gateway (saida). Reduz superficie de ataque: sem acesso direto ao kubelet, SSH e servicos dos nodes.' },
    { front: 'Qual a diferenca entre Cloud IAM e Kubernetes RBAC?', back: 'Cloud IAM: controla acesso a recursos do cloud provider (criar VMs, acessar S3, EKS API). Kubernetes RBAC: controla acesso a recursos K8s (pods, secrets, deployments). Sao sistemas separados e complementares.' },
    { front: 'Quais features de seguranca existem em registries cloud?', back: 'ECR: IAM auth, scan automatico, encryption. Artifact Registry: IAM, scan, Binary Authorization. ACR: AAD auth, content trust, Defender. Harbor: RBAC, Trivy, signing, proxy cache. Sempre usar registries privados em producao.' },
    { front: 'Quais portas devem ser abertas entre componentes K8s?', back: '6443: API Server (TCP). 2379-2380: etcd client/peer (TCP, apenas entre control planes e API Server). 10250: kubelet API (TCP). 30000-32767: NodePort (TCP). Security groups devem restringir ao minimo necessario.' }
  ],

  lab: {
    scenario: 'Voce e um Security Engineer auditando a configuracao de cloud security de um cluster Kubernetes. Precisa verificar IAM, network isolation e protecao do metadata API.',
    objective: 'Auditar configuracoes de seguranca relacionadas ao cloud provider: IAM, acesso ao metadata API e isolamento de rede.',
    duration: '15-20 minutos',
    steps: [
      {
        title: 'Verificar se pods tem acesso ao Metadata API',
        instruction: 'Teste se pods conseguem acessar o endpoint de metadata do cloud provider (169.254.169.254). Este e um indicador de risco de SSRF e roubo de credenciais IAM.',
        hints: ['Use um pod temporario com curl ou wget', 'Timeout rapido (2-3s) pois o IP pode simplesmente nao responder em alguns ambientes'],
        solution: '```bash\n# Testar acesso ao metadata API de um pod\nkubectl run meta-test --image=alpine --restart=Never --rm -it -- \\\n  wget -qO- --timeout=3 http://169.254.169.254/ 2>&1 || echo "Acesso bloqueado ou indisponivel"\n\n# Verificar se existe NetworkPolicy bloqueando o acesso\nkubectl get networkpolicies --all-namespaces -o yaml | grep 169.254\n\n# Verificar namespace default\nkubectl get networkpolicies -n default\n```',
        verify: '```bash\n# Verificar se existem NetworkPolicies\nkubectl get networkpolicies --all-namespaces --no-headers | wc -l\n# Saida: numero de policies (0 = sem protecao)\n```'
      },
      {
        title: 'Auditar ServiceAccounts e Workload Identity',
        instruction: 'Verifique se ServiceAccounts estao usando Workload Identity (annotations IAM) e se o automount de tokens esta controlado.',
        hints: ['Procure annotations eks.amazonaws.com ou iam.gke.io', 'automountServiceAccountToken: false e uma boa pratica'],
        solution: '```bash\n# Listar ServiceAccounts com annotations de Workload Identity\nkubectl get serviceaccounts --all-namespaces -o yaml | grep -B2 "amazonaws.com/role-arn\\|gke.io/gcp-service-account\\|azure/use-managed-identity"\n\n# Verificar quais SAs tem automount habilitado (padrao)\nkubectl get serviceaccounts --all-namespaces -o jsonpath=\'{range .items[*]}{.metadata.namespace}{"/"}{.metadata.name}{" automount="}{.automountServiceAccountToken}{"\\n"}{end}\' | grep -v "false"\n\n# Ver SAs em namespaces de aplicacao\nkubectl get serviceaccounts -n default -o wide\n```',
        verify: '```bash\nkubectl get serviceaccounts --all-namespaces --no-headers | wc -l\n# Saida: numero de ServiceAccounts no cluster\n```'
      },
      {
        title: 'Verificar Isolamento de Rede dos Nodes',
        instruction: 'Identifique quais nodes tem IPs publicos e verifique as regras de firewall/security group (onde disponivel).',
        hints: ['kubectl get nodes -o wide mostra IPs externos', 'Nodes devem ter apenas IP privado (EXTERNAL-IP = <none>)'],
        solution: '```bash\n# Verificar IPs dos nodes\nkubectl get nodes -o wide\n# EXTERNAL-IP deve ser <none> para nodes em subnets privadas\n\n# Verificar detalhes de rede dos nodes\nkubectl describe nodes | grep -E "InternalIP|ExternalIP|Hostname"\n\n# Verificar se API Server tem endpoint publico\nkubectl cluster-info\n# URL do API Server - verificar se e IP privado ou publico\n\n# Verificar pods de CNI em execucao\nkubectl get pods -n kube-system | grep -E "calico|cilium|flannel|weave|aws-node"\n```',
        verify: '```bash\nkubectl get nodes -o wide | awk \'{print $1, $6, $7}\'\n# Saida: nome-do-node, IP-interno, IP-externo\n# Nodes seguros devem mostrar <none> em EXTERNAL-IP\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Pod nao consegue acessar S3 mesmo com IRSA configurado',
      difficulty: 'medium',
      symptom: 'Pod com ServiceAccount anotada com IAM Role ARN retorna "AccessDenied" ao tentar acessar bucket S3. O IAM Role tem a policy S3ReadOnly, mas o pod nao consegue autenticar.',
      diagnosis: '**1. Verificar a annotation da ServiceAccount:**\n```bash\nkubectl get sa <sa-name> -n <namespace> -o yaml | grep amazonaws\n# Deve ter: eks.amazonaws.com/role-arn: arn:aws:iam::...\n```\n\n**2. Verificar se o pod esta usando a SA correta:**\n```bash\nkubectl get pod <pod-name> -o jsonpath=\'{.spec.serviceAccountName}\'\n```\n\n**3. Verificar se o OIDC provider esta configurado no EKS:**\n```bash\naws eks describe-cluster --name <cluster> --query "cluster.identity.oidc.issuer"\n```\n\n**4. Verificar se o IAM Role tem Trust Policy correta:**\n```bash\naws iam get-role --role-name <role-name> --query "Role.AssumeRolePolicyDocument"\n# Deve conter o OIDC issuer como trusted entity\n```',
      solution: '**Causa mais comum: Trust Policy incorreta no IAM Role.**\n\nA Trust Policy deve referenciar o OIDC provider do cluster e a ServiceAccount especifica:\n\n```json\n{\n  "Version": "2012-10-17",\n  "Statement": [\n    {\n      "Effect": "Allow",\n      "Principal": {\n        "Federated": "arn:aws:iam::ACCOUNT:oidc-provider/oidc.eks.REGION.amazonaws.com/id/CLUSTER_ID"\n      },\n      "Action": "sts:AssumeRoleWithWebIdentity",\n      "Condition": {\n        "StringEquals": {\n          "oidc.eks.REGION.amazonaws.com/id/CLUSTER_ID:sub": "system:serviceaccount:NAMESPACE:SA_NAME"\n        }\n      }\n    }\n  ]\n}\n```\n\n**Verificar tambem:**\n- OIDC provider registrado na conta AWS\n- Pod usa a SA correta (spec.serviceAccountName)\n- Namespace e nome da SA na condition batem exatamente'
    },
    {
      title: 'Credenciais IAM encontradas em variaveis de ambiente de Pod',
      difficulty: 'easy',
      symptom: 'Auditoria de seguranca encontrou AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY como variaveis de ambiente em um Pod de producao. As chaves tem permissoes amplas de admin.',
      diagnosis: '**1. Confirmar a exposicao:**\n```bash\nkubectl exec <pod> -- env | grep -E "AWS_ACCESS|AWS_SECRET|AWS_SESSION"\n```\n\n**2. Verificar a origem das credenciais (ConfigMap ou Secret):**\n```bash\nkubectl get pod <pod> -o yaml | grep -A5 "envFrom\\|env:"\n```\n\n**3. Verificar se sao credenciais de longa duracao:**\n```bash\n# Credenciais IRSA tem AWS_SESSION_TOKEN (temporarias)\n# Credenciais estaticas NAO tem AWS_SESSION_TOKEN\nkubectl exec <pod> -- env | grep AWS_SESSION_TOKEN\n```\n\n**4. Verificar o nivel de acesso:**\n```bash\n# Testar permissoes (de outro pod ou maquina)\naws sts get-caller-identity  # com as credenciais encontradas\naws iam list-attached-user-policies --user-name <user>\n```',
      solution: '**Acao imediata:**\n1. **Revogar as credenciais** imediatamente no console IAM\n2. Investigar se foram usadas indevidamente (CloudTrail)\n\n**Correcao permanente — migrar para IRSA:**\n\n1. Criar IAM Role com apenas as permissoes necessarias\n2. Configurar Trust Policy para a ServiceAccount do pod\n3. Anotar a ServiceAccount:\n```bash\nkubectl annotate serviceaccount <sa-name> -n <namespace> \\\n  eks.amazonaws.com/role-arn=arn:aws:iam::ACCOUNT:role/ROLE_NAME\n```\n4. Remover as variaveis de ambiente de credenciais do Deployment\n5. Reiniciar o Pod para usar o novo token IRSA\n\n**Verificar que nao ha mais credenciais estaticas:**\n```bash\nkubectl exec <pod> -- env | grep AWS\n# Deve mostrar apenas: AWS_ROLE_ARN, AWS_WEB_IDENTITY_TOKEN_FILE (IRSA)\n# Nao deve mostrar: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY\n```'
    }
  ]
};
