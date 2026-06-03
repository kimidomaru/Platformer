window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['cks-cluster-setup/node-metadata'] = {

  theory: `# Node Metadata Protection

## Relevancia no CKS
> O dominio "Cluster Setup" vale **10%** do CKS. Proteger endpoints de metadados de cloud providers e critico para evitar roubo de credenciais e escalacao de privilegios a partir de pods comprometidos.

---

## O Problema: Metadata Services

Cloud providers expoe um servico de metadados em IPs link-local que fornece informacoes sensiveis sobre a instancia:

| Provider | Endpoint | Dados Sensiveis |
|----------|----------|----------------|
| **AWS** | \`169.254.169.254\` | IAM role credentials, user-data, tokens |
| **GCP** | \`metadata.google.internal\` (169.254.169.254) | Service account tokens, project info |
| **Azure** | \`169.254.169.254\` | Managed identity tokens, subscription info |

### Por que e perigoso?

Por padrao, qualquer pod pode acessar o metadata service do node onde esta rodando. Se um atacante comprometer um pod, ele pode:

1. **Roubar credenciais IAM** do node
2. **Escalar privilegios** usando as permissoes do node
3. **Acessar outros servicos cloud** (S3, databases, etc.)
4. **Mover lateralmente** para outros recursos

\`\`\`bash
# De dentro de um pod, acessar credenciais AWS
curl -s http://169.254.169.254/latest/meta-data/iam/security-credentials/
curl -s http://169.254.169.254/latest/meta-data/iam/security-credentials/<role-name>
\`\`\`

---

## Mitigacoes

### 1. NetworkPolicy para Bloquear Metadata

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-metadata-access
  namespace: default
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

Esta NetworkPolicy permite todo trafego de saida EXCETO para o IP do metadata service.

### 2. AWS IMDSv2 (Instance Metadata Service v2)

IMDSv2 exige um token para acessar metadados, dificultando acesso de pods:

\`\`\`bash
# IMDSv2 requer header com token
TOKEN=\$(curl -X PUT "http://169.254.169.254/latest/api/token" \\
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")

curl -H "X-aws-ec2-metadata-token: \$TOKEN" \\
  http://169.254.169.254/latest/meta-data/
\`\`\`

Configurar nodes para exigir IMDSv2:

\`\`\`bash
# AWS CLI: forcar IMDSv2 na instancia
aws ec2 modify-instance-metadata-options \\
  --instance-id i-1234567890abcdef0 \\
  --http-tokens required \\
  --http-put-response-hop-limit 1
\`\`\`

O \`hop-limit 1\` impede que containers (que estao a 2 hops) acessem o token.

### 3. GCP: Bloquear Metadata via Firewall

\`\`\`bash
# GKE: desabilitar legacy metadata endpoints
gcloud container clusters update CLUSTER_NAME \\
  --no-enable-legacy-metadata-endpoints

# Usar Workload Identity ao inves de node SA
gcloud container clusters update CLUSTER_NAME \\
  --workload-pool=PROJECT_ID.svc.id.goog
\`\`\`

### 4. Workload Identity (Recomendado)

Ao inves de usar credenciais do node, associe identidades diretamente aos pods:

| Provider | Solucao |
|----------|---------|
| **AWS** | EKS Pod Identity / IRSA (IAM Roles for Service Accounts) |
| **GCP** | GKE Workload Identity |
| **Azure** | AKS Workload Identity (AAD Pod Identity v2) |

Isso elimina a necessidade de acessar o metadata service.

---

## Protegendo o kubelet API

O kubelet expoe uma API na porta 10250 que tambem pode ser explorada:

\`\`\`yaml
# /var/lib/kubelet/config.yaml
authentication:
  anonymous:
    enabled: false
  webhook:
    enabled: true
authorization:
  mode: Webhook
readOnlyPort: 0
\`\`\`

- **readOnlyPort: 0** desabilita a porta read-only (10255)
- **anonymous.enabled: false** bloqueia acesso sem autenticacao
- **Webhook** delega autorizacao ao API Server

---

## Node Labels e Annotations

Informacoes em labels/annotations de nodes podem vazar dados sensiveis:

\`\`\`bash
# Verificar labels de nodes
kubectl get nodes --show-labels

# Verificar annotations (podem conter dados do cloud provider)
kubectl get node <name> -o jsonpath='{.metadata.annotations}'
\`\`\`

**Boas praticas:**
- Nao colocar informacoes sensiveis em labels/annotations
- Usar NodeRestriction admission controller para limitar o que o kubelet pode modificar
- Restringir acesso a nodes via RBAC

---

## Erros Comuns

1. **Nao bloquear 169.254.169.254** — o ataque mais simples e mais perigoso
2. **Usar IMDSv1** — tokens nao sao necessarios, qualquer curl funciona
3. **hop-limit alto no IMDSv2** — permite que containers acessem tokens
4. **Nao usar Workload Identity** — depender de credenciais do node e inseguro
5. **Porta read-only do kubelet aberta** — expoe informacoes sem autenticacao

---

## Killer.sh Style Challenge

> Pods no namespace \`untrusted\` estao acessando o metadata service AWS. Crie uma NetworkPolicy que bloqueie acesso ao IP 169.254.169.254 para todos os pods nesse namespace, mantendo outro trafego de saida permitido.
`,

  quiz: [
    {
      question: 'Qual IP e usado pelo metadata service na maioria dos cloud providers?',
      options: ['10.0.0.1', '169.254.169.254', '192.168.1.1', '172.16.0.1'],
      correct: 1,
      explanation: '169.254.169.254 e o IP link-local usado por AWS, GCP e Azure para o Instance Metadata Service. E acessivel de qualquer instancia/pod por padrao.',
      reference: 'Conceito relacionado: Cloud provider metadata services.'
    },
    {
      question: 'Qual a forma mais efetiva de bloquear acesso ao metadata service a partir de pods?',
      options: [
        'Desabilitar o metadata service no cloud provider',
        'Usar NetworkPolicy bloqueando egress para 169.254.169.254/32',
        'Configurar RBAC para pods',
        'Usar Pod Security Standards'
      ],
      correct: 1,
      explanation: 'NetworkPolicy com egress deny para 169.254.169.254/32 bloqueia efetivamente o acesso ao metadata service. E a abordagem mais direta no Kubernetes.',
      reference: 'Conceito relacionado: NetworkPolicy — egress rules.'
    },
    {
      question: 'O que o IMDSv2 da AWS exige para acessar metadados?',
      options: [
        'Certificado TLS do node',
        'Um token obtido via PUT request com TTL',
        'API key da AWS',
        'ServiceAccount do Kubernetes'
      ],
      correct: 1,
      explanation: 'IMDSv2 exige um token session-based obtido via PUT request com header X-aws-ec2-metadata-token-ttl-seconds. Isso dificulta o acesso de containers quando o hop-limit e 1.',
      reference: 'Conceito relacionado: IMDSv2 — token-based metadata access.'
    },
    {
      question: 'Qual configuracao IMDSv2 impede que containers acessem o token de metadados?',
      options: [
        'http-tokens: optional',
        'http-put-response-hop-limit: 1',
        'http-endpoint: disabled',
        'http-protocol-ipv6: disabled'
      ],
      correct: 1,
      explanation: 'Com hop-limit 1, o token PUT response so alcanca o host (1 hop). Containers estao a 2 hops (host -> bridge -> container), entao nao recebem o token.',
      reference: 'Conceito relacionado: IMDSv2 — hop limit.'
    },
    {
      question: 'O que e Workload Identity no contexto de cloud providers?',
      options: [
        'Um tipo de RBAC para pods',
        'Associacao direta de identidade IAM a pods/ServiceAccounts, sem usar credenciais do node',
        'Autenticacao de usuarios no cluster',
        'Gerenciamento de certificados TLS'
      ],
      correct: 1,
      explanation: 'Workload Identity associa identidades IAM diretamente a ServiceAccounts do Kubernetes, eliminando a necessidade de acessar credenciais do node via metadata service.',
      reference: 'Conceito relacionado: IRSA (AWS), GKE Workload Identity, AKS Workload Identity.'
    },
    {
      question: 'Qual porta do kubelet deve ser desabilitada para evitar vazamento de informacoes?',
      options: ['10250 (API principal)', '10255 (read-only)', '10256 (health)', '6443 (API Server)'],
      correct: 1,
      explanation: 'A porta 10255 e a porta read-only do kubelet que expoe informacoes sem autenticacao. Deve ser desabilitada com readOnlyPort: 0 no config do kubelet.',
      reference: 'Conceito relacionado: kubelet API — portas e seguranca.'
    },
    {
      question: 'Qual informacao sensivel um atacante pode obter do metadata service AWS?',
      options: [
        'Apenas o hostname da instancia',
        'Credenciais temporarias da IAM role associada a instancia',
        'Senhas de usuarios do Linux',
        'Chaves SSH dos outros nodes'
      ],
      correct: 1,
      explanation: 'O metadata service expoe credenciais temporarias (Access Key, Secret Key, Token) da IAM role associada a instancia. Com essas credenciais, o atacante pode acessar servicos AWS.',
      reference: 'Conceito relacionado: AWS IMDS — credential theft.'
    }
  ],

  flashcards: [
    { front: 'Qual o IP do metadata service dos cloud providers?', back: '169.254.169.254 (IP link-local). Usado por AWS, GCP e Azure para fornecer informacoes da instancia, incluindo credenciais IAM.' },
    { front: 'Como bloquear acesso ao metadata service via Kubernetes?', back: 'Criar NetworkPolicy com egress deny para 169.254.169.254/32, permitindo todo outro trafego de saida. Aplicar no namespace dos pods.' },
    { front: 'O que e IMDSv2 e por que e mais seguro?', back: 'Instance Metadata Service v2 (AWS) exige token via PUT request. Com hop-limit=1, containers (a 2 hops) nao conseguem obter o token, bloqueando acesso ao metadata.' },
    { front: 'O que e Workload Identity?', back: 'Mecanismo que associa identidades IAM diretamente a ServiceAccounts do K8s. Elimina necessidade de acessar metadata service. Disponivel como IRSA/EKS Pod Identity (AWS), Workload Identity (GCP), Workload Identity (Azure).' },
    { front: 'Quais dados sensiveis o metadata service expoe?', back: 'Credenciais IAM temporarias (access key, secret key, token), user-data (scripts de inicializacao que podem conter segredos), informacoes da instancia, tags, e informacoes de rede.' },
    { front: 'Qual a porta read-only do kubelet e como desabilita-la?', back: 'Porta 10255. Desabilitar com readOnlyPort: 0 no config.yaml do kubelet. Essa porta expoe informacoes sobre pods sem autenticacao.' },
    { front: 'O que o NodeRestriction admission controller faz?', back: 'Limita o que o kubelet pode modificar: apenas labels com prefixo node-restriction.kubernetes.io/, seu proprio Node object, e pods scheduled para ele. Evita que um node comprometido afete outros.' }
  ],

  lab: {
    scenario: 'Pods no cluster podem acessar o metadata service do cloud provider. Voce precisa proteger o cluster bloqueando esse acesso.',
    objective: 'Criar NetworkPolicies para bloquear acesso ao metadata service e verificar a protecao.',
    duration: '15-20 minutos',
    steps: [
      {
        title: 'Verificar Acesso ao Metadata Service',
        instruction: 'Crie um pod de teste e tente acessar o endpoint de metadados para confirmar que esta acessivel.',
        hints: [
          'Use um pod com curl ou wget',
          'Tente acessar http://169.254.169.254/',
          'Se estiver em ambiente cloud, o acesso provavelmente funciona'
        ],
        solution: '```bash\n# Criar pod de teste\nkubectl run metadata-test --image=curlimages/curl --rm -it --restart=Never -- \\\n  curl -s --max-time 3 http://169.254.169.254/latest/meta-data/ 2>/dev/null || echo \"Acesso bloqueado ou nao disponivel\"\n```',
        verify: '```bash\n# Se em cloud, o comando retorna dados de metadata\n# Se local, retorna timeout (esperado)\necho \"Verificar se o pod executou com sucesso\"\nkubectl get pod metadata-test 2>/dev/null || echo \"Pod completou e foi removido (--rm)\"\n```'
      },
      {
        title: 'Criar NetworkPolicy para Bloquear Metadata',
        instruction: 'Crie uma NetworkPolicy no namespace `default` que bloqueie trafego egress para 169.254.169.254 mas permita todo outro trafego.',
        hints: [
          'Use policyTypes: [\"Egress\"]',
          'Use ipBlock com cidr 0.0.0.0/0 e except 169.254.169.254/32',
          'podSelector vazio {} seleciona todos os pods'
        ],
        solution: '```bash\nkubectl apply -f - <<EOF\napiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: deny-metadata\n  namespace: default\nspec:\n  podSelector: {}\n  policyTypes:\n  - Egress\n  egress:\n  - to:\n    - ipBlock:\n        cidr: 0.0.0.0/0\n        except:\n        - 169.254.169.254/32\nEOF\n```',
        verify: '```bash\n# Verificar NetworkPolicy criada\nkubectl get networkpolicy deny-metadata\n# Saida esperada: deny-metadata com pod-selector <none>\n\nkubectl describe networkpolicy deny-metadata\n# Saida esperada: Allowing egress to 0.0.0.0/0 except 169.254.169.254/32\n```'
      },
      {
        title: 'Testar Bloqueio do Metadata',
        instruction: 'Execute novamente o pod de teste e confirme que o acesso ao metadata service esta bloqueado, enquanto outro trafego continua funcionando.',
        hints: [
          'Teste acesso ao metadata (deve falhar/timeout)',
          'Teste acesso a outro endpoint (deve funcionar)',
          'A NetworkPolicy precisa de um CNI que suporte (Calico, Cilium, etc.)'
        ],
        solution: '```bash\n# Testar acesso ao metadata (deve falhar)\nkubectl run test-blocked --image=curlimages/curl --rm -it --restart=Never -- \\\n  curl -s --max-time 3 http://169.254.169.254/ 2>/dev/null; echo \"Exit: $?\"\n\n# Testar acesso a outro servico (deve funcionar)\nkubectl run test-allowed --image=curlimages/curl --rm -it --restart=Never -- \\\n  curl -s --max-time 5 https://kubernetes.default.svc/healthz -k\n```',
        verify: '```bash\n# Verificar que a NetworkPolicy esta ativa\nkubectl get networkpolicy deny-metadata -o yaml\n# Saida esperada: egress com except 169.254.169.254/32\n\n# O teste de metadata deve ter falhado (timeout)\n# O teste de outro servico deve ter retornado resposta\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'NetworkPolicy Nao Bloqueia Metadata Service',
      difficulty: 'medium',
      symptom: 'NetworkPolicy foi criada mas pods ainda conseguem acessar 169.254.169.254.',
      diagnosis: '```bash\n# Verificar se o CNI suporta NetworkPolicies\nkubectl get pods -n kube-system | grep -E \"calico|cilium|weave\"\n\n# Verificar se a policy esta no namespace correto\nkubectl get networkpolicy -A\n\n# Verificar se o podSelector esta correto\nkubectl describe networkpolicy deny-metadata\n\n# Testar conectividade\nkubectl run test --image=curlimages/curl --rm -it --restart=Never -- \\\n  curl -v --max-time 3 http://169.254.169.254/\n```',
      solution: 'Causas comuns: 1) O CNI nao suporta NetworkPolicy (ex: Flannel sozinho nao suporta) — use Calico ou Cilium. 2) A NetworkPolicy esta em namespace errado. 3) hostNetwork: true nos pods bypassa NetworkPolicies — pods com hostNetwork acessam o metadata diretamente. 4) Falta policyTypes: [\"Egress\"] — sem isso, a policy nao afeta trafego de saida.'
    },
    {
      title: 'Pods com Workload Identity Falham ao Autenticar',
      difficulty: 'hard',
      symptom: 'Pods configurados com Workload Identity/IRSA recebem erro de autenticacao ao acessar servicos cloud.',
      diagnosis: '```bash\n# Verificar ServiceAccount do pod\nkubectl get pod <pod> -o jsonpath=\"{.spec.serviceAccountName}\"\n\n# Verificar annotations do ServiceAccount (AWS IRSA)\nkubectl get sa <sa-name> -o yaml | grep eks.amazonaws.com\n\n# Verificar se o token esta montado\nkubectl exec <pod> -- ls /var/run/secrets/eks.amazonaws.com/serviceaccount/\n\n# Verificar se o OIDC provider esta configurado (AWS)\naws eks describe-cluster --name CLUSTER --query cluster.identity.oidc\n```',
      solution: 'Para IRSA (AWS): 1) Verificar annotation eks.amazonaws.com/role-arn no ServiceAccount. 2) Verificar trust policy da IAM role (deve permitir o OIDC provider do cluster). 3) Garantir que o OIDC provider esta criado e associado ao cluster. 4) Verificar condicoes da trust policy (sub e aud). Para GKE Workload Identity: verificar annotation iam.gke.io/gcp-service-account e o binding IAM.'
    }
  ]
};
