window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['kcna-k8s-fundamentals/k8s-api'] = {

  theory: `# Kubernetes API & kubectl

## Relevancia no KCNA
> O dominio "Kubernetes Fundamentals" vale **46%** do KCNA. Entender a API do Kubernetes e como interagir com ela via kubectl e fundamental para todas as certificacoes.

---

## API RESTful do Kubernetes

O Kubernetes expoe uma API RESTful. Toda interacao (kubectl, controllers, operators) passa pelo API Server.

### Estrutura da URL

\`\`\`text
/api/v1/namespaces/default/pods/nginx
  |    |      |        |      |    |
  |    |      |        |      |    +-- nome do recurso
  |    |      |        |      +------- tipo de recurso
  |    |      |        +-------------- namespace
  |    |      +----------------------- recurso intermediario
  |    +------------------------------ versao
  +----------------------------------- API core group

/apis/apps/v1/namespaces/default/deployments/web
  |     |   |
  |     |   +-- versao
  |     +------ grupo da API
  +------------ APIs nao-core
\`\`\`

---

## API Groups

| Grupo | Path | Recursos |
|-------|------|----------|
| Core (\`\`\`) | /api/v1 | pods, services, configmaps, secrets, namespaces, nodes |
| apps | /apis/apps/v1 | deployments, statefulsets, daemonsets, replicasets |
| batch | /apis/batch/v1 | jobs, cronjobs |
| networking.k8s.io | /apis/networking.k8s.io/v1 | ingresses, networkpolicies |
| rbac.authorization.k8s.io | /apis/rbac.authorization.k8s.io/v1 | roles, rolebindings, clusterroles |
| storage.k8s.io | /apis/storage.k8s.io/v1 | storageclasses, volumeattachments |

---

## API Versioning

| Nivel | Estabilidade | Exemplo |
|-------|-------------|---------|
| **v1** | Estavel (GA) | apps/v1 |
| **v1beta1** | Beta (pode mudar) | flowcontrol.apiserver.k8s.io/v1beta1 |
| **v1alpha1** | Alpha (experimental) | Pode ser removido |

---

## Verbos HTTP / API

| Verbo HTTP | kubectl | Descricao |
|-----------|---------|-----------|
| GET | get, describe | Ler recurso(s) |
| POST | create, apply | Criar recurso |
| PUT | replace | Substituir recurso |
| PATCH | patch, apply | Modificar parcialmente |
| DELETE | delete | Remover recurso |
| WATCH | get -w | Observar mudancas |
| LIST | get (sem nome) | Listar recursos |

---

## kubectl Essencial

\`\`\`bash
# CRUD basico
kubectl get pods
kubectl describe pod nginx
kubectl create deployment web --image=nginx
kubectl apply -f manifest.yaml
kubectl delete pod nginx

# Informacoes do cluster
kubectl cluster-info
kubectl get nodes
kubectl api-resources
kubectl api-versions

# Logs e Debug
kubectl logs <pod>
kubectl logs <pod> -c <container>
kubectl exec -it <pod> -- /bin/sh

# Output customizado
kubectl get pods -o wide
kubectl get pods -o yaml
kubectl get pods -o json
kubectl get pods -o jsonpath='{.items[*].metadata.name}'
\`\`\`

---

## kubeconfig

Arquivo de configuracao do kubectl (default: ~/.kube/config):

\`\`\`yaml
apiVersion: v1
kind: Config
clusters:
- cluster:
    server: https://api-server:6443
    certificate-authority-data: <ca-cert>
  name: my-cluster
users:
- name: admin
  user:
    client-certificate-data: <cert>
    client-key-data: <key>
contexts:
- context:
    cluster: my-cluster
    user: admin
    namespace: default
  name: admin@my-cluster
current-context: admin@my-cluster
\`\`\`

\`\`\`bash
# Ver contexto atual
kubectl config current-context

# Listar contextos
kubectl config get-contexts

# Mudar contexto
kubectl config use-context <context-name>

# Setar namespace padrao
kubectl config set-context --current --namespace=production
\`\`\`

---

## API Discovery

\`\`\`bash
# Listar todos os tipos de recursos
kubectl api-resources

# Listar versoes de API
kubectl api-versions

# Explicar um recurso (schema)
kubectl explain pod
kubectl explain pod.spec.containers
kubectl explain deployment.spec.strategy
\`\`\`

---

## Admission Controllers

Interceptam requests apos autenticacao/autorizacao:

\`\`\`text
Request -> AuthN -> AuthZ -> Admission Controllers -> etcd
                              |
                              +-- Mutating (modifica request)
                              +-- Validating (aceita/rejeita)
\`\`\`

Exemplos: LimitRanger, ResourceQuota, PodSecurity, NodeRestriction.
`,

  quiz: [
    {
      question: 'Qual componente processa TODAS as requisicoes ao cluster Kubernetes?',
      options: ['kubelet', 'kube-proxy', 'kube-apiserver', 'etcd'],
      correct: 2,
      explanation: 'O kube-apiserver e o unico ponto de entrada para o cluster. Toda comunicacao (kubectl, controllers, kubelet) passa pela API Server.',
      reference: 'Conceito relacionado: Kubernetes Architecture — API Server.'
    },
    {
      question: 'Qual API group contem Deployments e StatefulSets?',
      options: ['core (v1)', 'apps', 'batch', 'extensions'],
      correct: 1,
      explanation: 'O grupo apps (apis/apps/v1) contem Deployments, StatefulSets, DaemonSets e ReplicaSets.',
      reference: 'Conceito relacionado: API Groups — apps.'
    },
    {
      question: 'O que significa uma API versao v1beta1?',
      options: ['Versao estavel e final', 'Beta — funcional mas pode ter breaking changes', 'Alpha — experimental', 'Deprecated'],
      correct: 1,
      explanation: 'Beta (v1beta1, v1beta2) indica que a API esta funcional e testada mas pode ter changes em versoes futuras. GA (v1) e a versao estavel final.',
      reference: 'Conceito relacionado: API Versioning — ciclo de vida.'
    },
    {
      question: 'Qual secao do kubeconfig define as credenciais de acesso?',
      options: ['clusters', 'users', 'contexts', 'preferences'],
      correct: 1,
      explanation: 'A secao users define credenciais (certificados, tokens, auth providers). clusters define endpoints. contexts combina cluster + user + namespace.',
      reference: 'Conceito relacionado: kubeconfig — estrutura.'
    },
    {
      question: 'Qual comando mostra o schema de um recurso Kubernetes?',
      options: ['kubectl describe', 'kubectl explain', 'kubectl api-resources', 'kubectl schema'],
      correct: 1,
      explanation: 'kubectl explain mostra o schema e documentacao de campos de um recurso. Ex: kubectl explain pod.spec.containers mostra campos disponiveis para containers.',
      reference: 'Conceito relacionado: kubectl explain — documentacao inline.'
    },
    {
      question: 'O que Admission Controllers fazem?',
      options: [
        'Autenticam usuarios',
        'Interceptam requests apos autenticacao/autorizacao para validar ou modificar',
        'Autorizam via RBAC',
        'Encriptam dados no etcd'
      ],
      correct: 1,
      explanation: 'Admission Controllers interceptam requests APOS AuthN/AuthZ. Mutating admission modifica requests, Validating admission aceita/rejeita. Exemplos: LimitRanger, PodSecurity.',
      reference: 'Conceito relacionado: Admission Controllers — fluxo de requests.'
    },
    {
      question: 'Qual comando muda o namespace padrao do kubectl?',
      options: [
        'kubectl set-namespace production',
        'kubectl config set-context --current --namespace=production',
        'kubectl use namespace production',
        'kubectl default-ns production'
      ],
      correct: 1,
      explanation: 'kubectl config set-context --current --namespace=production altera o namespace padrao do contexto atual. Comandos subsequentes usarao esse namespace.',
      reference: 'Conceito relacionado: kubeconfig — contextos e namespaces.'
    }
  ],

  flashcards: [
    { front: 'Quais sao os principais API groups?', back: 'Core ("", /api/v1): pods, services, secrets. apps (/apis/apps/v1): deployments, statefulsets. batch: jobs. networking.k8s.io: ingresses, networkpolicies. rbac.authorization.k8s.io: roles, bindings.' },
    { front: 'O que cada secao do kubeconfig define?', back: 'clusters: endpoints do API Server + CA. users: credenciais (certs, tokens). contexts: combina cluster + user + namespace padrao. current-context: contexto ativo.' },
    { front: 'Qual a diferenca entre API alpha, beta e GA?', back: 'Alpha (v1alpha1): experimental, pode ser removido. Beta (v1beta1): funcional, pode mudar. GA/Stable (v1): estavel, garantia de compatibilidade.' },
    { front: 'O que kubectl explain faz?', back: 'Mostra documentacao e schema de campos de um recurso. Ex: kubectl explain pod.spec.containers mostra campos disponiveis. Muito util no exame.' },
    { front: 'O que sao Admission Controllers?', back: 'Plugins que interceptam requests apos AuthN/AuthZ. Mutating: modifica o request (ex: injetar sidecar). Validating: aceita/rejeita (ex: LimitRanger, PodSecurity). Ordem: Mutating -> Validating.' },
    { front: 'Como ver todos os tipos de recursos disponíveis?', back: 'kubectl api-resources: lista todos os tipos (nome, shortname, apigroup, namespaced, kind). kubectl api-versions: lista versoes de API disponiveis.' },
    { front: 'Quais comandos kubectl mais importantes?', back: 'get (listar), describe (detalhes), create/apply (criar), delete (remover), logs (logs), exec (executar comando), explain (documentacao), config (kubeconfig).' }
  ],

  lab: {
    scenario: 'Voce esta aprendendo a interagir com a API do Kubernetes via kubectl e explorando a estrutura da API.',
    objective: 'Explorar a API do Kubernetes, API groups e comandos kubectl essenciais.',
    duration: '10-15 minutos',
    steps: [
      {
        title: 'Explorar a API',
        instruction: 'Descubra quais tipos de recursos e versoes de API estao disponiveis no cluster.',
        hints: ['Use kubectl api-resources', 'Use kubectl api-versions', 'Use kubectl explain para documentacao'],
        solution: '```bash\n# Listar todos os recursos\nkubectl api-resources | head -30\n\n# Listar versoes de API\nkubectl api-versions\n\n# Explorar schema de um Pod\nkubectl explain pod.spec --recursive | head -40\n\n# Ver detalhes de um campo\nkubectl explain deployment.spec.strategy\n```',
        verify: '```bash\nkubectl api-resources | grep -c \"true\"\n# Saida esperada: numero > 30 (recursos namespaced)\n\nkubectl api-versions | grep -c \"v1\"\n# Saida esperada: numero > 5\n```'
      },
      {
        title: 'Praticar kubectl Output',
        instruction: 'Use diferentes formatos de saida do kubectl para extrair informacoes.',
        hints: ['Use -o wide, -o yaml, -o json, -o jsonpath', 'Use custom-columns para tabelas personalizadas', 'Pratique com pods existentes'],
        solution: '```bash\n# Criar recurso de teste\nkubectl create deployment api-test --image=nginx:1.25-alpine\n\n# Diferentes formatos\nkubectl get deploy api-test -o wide\nkubectl get deploy api-test -o yaml\nkubectl get deploy api-test -o json | jq .spec.replicas\n\n# jsonpath\nkubectl get pods -o jsonpath=\"{.items[*].metadata.name}\"\n\n# custom-columns\nkubectl get pods -o custom-columns=NAME:.metadata.name,STATUS:.status.phase,NODE:.spec.nodeName\n```',
        verify: '```bash\nkubectl get deployment api-test\n# Saida esperada: api-test READY\n\nkubectl get pods -o jsonpath=\"{.items[*].metadata.name}\" | wc -w\n# Saida esperada: numero > 0\n```'
      },
      {
        title: 'Explorar kubeconfig',
        instruction: 'Examine e entenda a estrutura do kubeconfig usado pelo kubectl.',
        hints: ['Use kubectl config view', 'Identifique clusters, users e contexts', 'Mude o namespace padrao'],
        solution: '```bash\n# Ver kubeconfig (redacted)\nkubectl config view\n\n# Contexto atual\nkubectl config current-context\n\n# Listar contextos\nkubectl config get-contexts\n\n# Ver clusters\nkubectl config get-clusters\n\n# Mudar namespace padrao\nkubectl config set-context --current --namespace=kube-system\nkubectl get pods\n# Voltar para default\nkubectl config set-context --current --namespace=default\n```',
        verify: '```bash\nkubectl config current-context\n# Saida esperada: nome do contexto ativo\n\nkubectl config get-clusters | wc -l\n# Saida esperada: >= 1\n```'
      }
    ]
  },

  troubleshooting: []
};
