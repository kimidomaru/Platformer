window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['cluster-architecture/crds-operators'] = {
  theory: `# CRDs, Operators e Extensoes do Kubernetes

## Extendendo o Kubernetes

O Kubernetes foi projetado para ser extensivel. Voce pode adicionar novos tipos de recursos, novos comportamentos e integrar com sistemas externos sem modificar o codigo-fonte do Kubernetes. Os tres mecanismos principais sao:

| Mecanismo | Quando usar | Complexidade |
|---|---|---|
| CRD + Controller | Novos tipos de recurso com logica simples | Baixa |
| API Aggregation | Logica complexa, endpoints customizados | Alta |
| Admission Webhooks | Validacao/mutacao de recursos existentes | Media |

---

## CustomResourceDefinitions (CRDs)

Um **CRD** define um novo tipo de recurso no Kubernetes. Apos criar um CRD, voce pode criar instancias desse recurso (chamadas **Custom Resources** ou CRs) usando kubectl normalmente. O CRD descreve o schema, validacao e comportamento do novo tipo.

### Campos Essenciais do Spec do CRD

| Campo | Descricao | Exemplo |
|---|---|---|
| group | API group do recurso | mycompany.io |
| scope | Namespaced ou Cluster | Namespaced |
| names.plural | Nome usado no kubectl get | applications |
| names.singular | Nome singular | application |
| names.kind | Kind no YAML | Application |
| names.shortNames | Atalhos para kubectl | app, apps |
| names.categories | Grupos logicos | all, custom |
| versions | Lista de versoes suportadas | v1, v2 |

### Estrutura Completa de um CRD

\`\`\`yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: applications.mycompany.io    # <plural>.<group>
spec:
  group: mycompany.io
  scope: Namespaced                  # Namespaced ou Cluster
  names:
    plural: applications
    singular: application
    kind: Application
    shortNames:
    - app
    categories:
    - all                            # aparece em: kubectl get all
  versions:
  - name: v1
    served: true                     # versao exposta pela API
    storage: true                    # versao persistida no etcd (apenas uma)
    schema:
      openAPIV3Schema:
        type: object
        properties:
          spec:
            type: object
            required: ["image", "replicas"]
            properties:
              image:
                type: string
                description: "Imagem Docker da aplicacao"
              replicas:
                type: integer
                minimum: 1
                maximum: 10
              port:
                type: integer
                default: 8080
          status:
            type: object
            properties:
              availableReplicas:
                type: integer
              conditions:
                type: array
                items:
                  type: object
    additionalPrinterColumns:
    - name: Image
      type: string
      jsonPath: .spec.image
    - name: Replicas
      type: integer
      jsonPath: .spec.replicas
    - name: Age
      type: date
      jsonPath: .metadata.creationTimestamp
    subresources:
      status: {}      # Habilita subrecurso /status
      scale:          # Habilita subrecurso /scale (para HPA)
        specReplicasPath: .spec.replicas
        statusReplicasPath: .status.availableReplicas
\`\`\`

### Usando o Custom Resource

\`\`\`yaml
# Apos criar o CRD, criar instancias (Custom Resources)
apiVersion: mycompany.io/v1
kind: Application
metadata:
  name: meu-app
  namespace: production
spec:
  image: nginx:1.25
  replicas: 3
  port: 8080
\`\`\`

\`\`\`bash
# Listar CRDs existentes no cluster
kubectl get crds
kubectl get customresourcedefinitions

# Detalhar um CRD
kubectl describe crd applications.mycompany.io

# Ver o schema de validacao de um CRD
kubectl get crd applications.mycompany.io -o yaml

# Listar instancias do custom resource
kubectl get applications
kubectl get applications -n production
kubectl get app    # usando shortname

# Criar uma instancia
kubectl apply -f my-application.yaml

# Descrever uma instancia
kubectl describe application meu-app -n production

# Ver a API do custom resource
kubectl api-resources | grep mycompany.io
kubectl api-versions | grep mycompany.io
\`\`\`

---

## CRD com Multiplas Versoes e Conversion Webhooks

Um CRD pode ter multiplas versoes quando a API evolui. Apenas uma versao pode ter \`storage: true\`. Para converter objetos entre versoes diferentes automaticamente, usa-se **Conversion Webhook**.

\`\`\`yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: databases.mycompany.io
spec:
  group: mycompany.io
  scope: Namespaced
  names:
    plural: databases
    singular: database
    kind: Database
  conversion:
    strategy: Webhook           # None ou Webhook
    webhook:
      clientConfig:
        service:
          name: db-conversion-webhook
          namespace: default
          path: /convert
      conversionReviewVersions: ["v1", "v1beta1"]
  versions:
  - name: v1
    served: true
    storage: false    # versao legada, ainda servida
    schema:
      openAPIV3Schema:
        type: object
        properties:
          spec:
            type: object
            properties:
              dbVersion:
                type: string
  - name: v2
    served: true
    storage: true     # versao atual de armazenamento
    schema:
      openAPIV3Schema:
        type: object
        properties:
          spec:
            type: object
            properties:
              version:
                type: string    # renomeado de dbVersion para version
              size:
                type: string
\`\`\`

**Regras importantes sobre versoes de CRD:**

| Regra | Detalhe |
|---|---|
| Apenas uma versao com storage: true | Versao usada para persistir no etcd |
| Versoes legacy com served: true | Ainda atende requisicoes, converte automaticamente |
| Served: false | Versao depreciada, API server rejeita requisicoes |
| Conversao None | API server converte automaticamente (apenas renomear campos simples) |
| Conversao Webhook | Logica customizada de conversao via webhook |

---

## O Padrao Operator

Um **Operator** e uma combinacao de:
1. Um ou mais **CRDs** que definem os recursos gerenciados
2. Um **Controller** que observa esses recursos e age para reconciliar o estado

O Operator encapsula conhecimento operacional (como fazer backup, failover, scaling) em codigo automatizado.

### Ciclo de Vida do Operator: Observe → Analyze → Act

\`\`\`
                    ┌─────────────────┐
                    │   API Server    │
                    │  (etcd watch)   │
                    └────────┬────────┘
                             │
                    Evento: CR criado/alterado/deletado
                             │
                    ┌────────v────────┐
                    │   OBSERVE       │
                    │ Ler estado      │
                    │ desejado (CR)   │
                    └────────┬────────┘
                             │
                    ┌────────v────────┐
                    │   ANALYZE       │
                    │ Comparar com    │
                    │ estado atual    │
                    │ (diff)          │
                    └────────┬────────┘
                             │
                    ┌────────v────────┐
                    │   ACT           │
                    │ Criar/Atualizar │
                    │ /Deletar        │
                    │ recursos        │
                    └─────────────────┘
\`\`\`

### Exemplos de Operators Populares em Producao

| Operator | O que gerencia | Recurso CRD principal |
|---|---|---|
| Prometheus Operator | Prometheus + Alertmanager + regras | Prometheus, ServiceMonitor |
| cert-manager | Certificados TLS automaticos | Certificate, ClusterIssuer |
| Strimzi | Apache Kafka clusters | Kafka, KafkaTopic |
| ArgoCD | GitOps e deploy continuo | Application, AppProject |
| Velero | Backup e restore de cluster | Backup, Schedule |
| Zalando Postgres Operator | Clusters PostgreSQL HA | postgresql |
| External Secrets Operator | Sincronizacao de secrets | ExternalSecret, SecretStore |

### Frameworks para Construir Operators

\`\`\`bash
# Operator SDK (Go, Ansible, Helm)
operator-sdk init --domain mycompany.io --repo github.com/me/my-operator
operator-sdk create api --group apps --version v1 --kind MyApp --resource --controller

# Kubebuilder (Go)
kubebuilder init --domain mycompany.io
kubebuilder create api --group apps --version v1 --kind MyApp

# Metacontroller (JavaScript, Python, etc)
# Controller in any language via webhooks
\`\`\`

---

## Validacao com OpenAPI v3 Schema e CEL

### Validacao com OpenAPI v3

\`\`\`yaml
versions:
- name: v1
  served: true
  storage: true
  schema:
    openAPIV3Schema:
      type: object
      properties:
        spec:
          type: object
          required: ["engine", "version"]    # campos obrigatorios
          properties:
            engine:
              type: string
              enum: ["postgresql", "mysql", "mongodb"]  # valores permitidos
            version:
              type: string
              pattern: "^[0-9]+\\\\.[0-9]+$"           # regex de validacao
            replicas:
              type: integer
              minimum: 1
              maximum: 10
              default: 1                      # valor padrao
            config:
              type: object
              additionalProperties:
                type: string               # mapa string->string
\`\`\`

### Validacao com CEL (Common Expression Language) - K8s 1.25+

CEL permite validacoes complexas e cruzadas entre campos sem webhooks:

\`\`\`yaml
versions:
- name: v1
  served: true
  storage: true
  schema:
    openAPIV3Schema:
      type: object
      properties:
        spec:
          type: object
          properties:
            minReplicas:
              type: integer
            maxReplicas:
              type: integer
            mode:
              type: string
          x-kubernetes-validations:
          - rule: "self.maxReplicas >= self.minReplicas"
            message: "maxReplicas deve ser maior ou igual a minReplicas"
          - rule: "self.mode != 'production' || self.minReplicas >= 2"
            message: "modo production exige minimo de 2 replicas"
\`\`\`

---

## Finalizers em Custom Resources

**Finalizers** sao mecanismos para garantir que logica de cleanup ocorra antes de um recurso ser deletado. Quando um recurso com finalizers e deletado:

1. O campo \`deletionTimestamp\` e preenchido
2. O recurso nao e removido imediatamente
3. O controller deve processar o cleanup e remover o finalizer
4. Apenas quando a lista de finalizers estiver vazia o recurso e deletado

\`\`\`yaml
apiVersion: mycompany.io/v1
kind: Application
metadata:
  name: meu-app
  finalizers:
  - mycompany.io/cleanup-storage    # aguarda limpeza do storage
  - mycompany.io/deregister-lb      # aguarda desregistro do load balancer
spec:
  image: nginx:1.25
  replicas: 3
\`\`\`

\`\`\`bash
# Verificar se um recurso tem finalizers
kubectl get application meu-app -o jsonpath='{.metadata.finalizers}'

# Verificar se a delecao esta travada (deletionTimestamp preenchido)
kubectl get application meu-app -o jsonpath='{.metadata.deletionTimestamp}'

# Remover finalizer manualmente (quando o operator nao responde)
# CUIDADO: bypassa o cleanup do controller
kubectl patch application meu-app \\
  -p '{"metadata":{"finalizers":[]}}' \\
  --type=merge

# Alternativa via edit
kubectl edit application meu-app
# Apagar o conteudo de metadata.finalizers
\`\`\`

---

## Short Names e Categories em CRDs

Short names e categories facilitam o uso via kubectl:

\`\`\`yaml
spec:
  names:
    plural: applications
    singular: application
    kind: Application
    shortNames:
    - app
    - apps
    categories:
    - all           # incluido em: kubectl get all
    - myplatform    # incluido em: kubectl get myplatform
\`\`\`

\`\`\`bash
# Usando short names
kubectl get app
kubectl get apps
kubectl get app -A

# Usando categories
kubectl get all           # inclui recursos com category: all
kubectl get myplatform    # lista todos os CRs da categoria myplatform

# Ver quais recursos estao em cada category
kubectl api-resources --categories=all
\`\`\`

---

## Subresources: Status e Scale

Subresources permitem atualizar partes especificas de um recurso sem expor o objeto todo:

\`\`\`yaml
subresources:
  status: {}      # /status: apenas o controller atualiza
  scale:          # /scale: permite HPA e kubectl scale
    specReplicasPath: .spec.replicas
    statusReplicasPath: .status.availableReplicas
    labelSelectorPath: .status.labelSelector
\`\`\`

\`\`\`bash
# Com subresource status habilitado:
# O campo status so pode ser atualizado via /status endpoint
# Isso previne que usuarios alterem o status acidentalmente

# Com subresource scale habilitado:
kubectl scale application meu-app --replicas=5
kubectl autoscale application meu-app --min=2 --max=10 --cpu-percent=70
\`\`\`

---

## Interfaces de Extensao: CRI, CNI, CSI

### CRI - Container Runtime Interface

\`\`\`bash
# Ver o container runtime do node
kubectl get node <node> -o jsonpath='{.status.nodeInfo.containerRuntimeVersion}'

# Runtimes suportados via CRI:
# containerd (padrao mais comum)
# CRI-O (alternativa leve)
# Docker foi removido no K8s 1.24 (precisava do dockershim)

# Verificar o socket CRI no node
ls /var/run/containerd/containerd.sock
ls /var/run/crio/crio.sock

# Interagir via crictl (ferramenta para debugging CRI)
crictl ps                  # listar containers rodando
crictl ps -a               # listar todos (incluindo stopped)
crictl images              # listar imagens
crictl pods                # listar pods
crictl logs <container-id> # ver logs
crictl inspect <id>        # inspecionar container
crictl pull nginx:latest   # baixar imagem
\`\`\`

### CNI - Container Network Interface

\`\`\`bash
# Ver o CNI configurado no node
ls /etc/cni/net.d/
cat /etc/cni/net.d/10-calico.conflist

# Binarios CNI instalados
ls /opt/cni/bin/

# Plugins CNI populares e suas caracteristicas:
# Flannel  - simples, overlay VXLAN, sem Network Policies nativas
# Calico   - Network Policies, BGP, IPIP ou VXLAN
# Weave    - auto-descoberta, criptografia built-in
# Cilium   - eBPF-based, observabilidade avancada, L7 policies

# Verificar pods do CNI
kubectl get pods -n kube-system | grep -E "calico|flannel|weave|cilium"

# Ver logs do CNI (exemplo Calico)
kubectl logs -n kube-system -l app=calico-node --tail=50
\`\`\`

### CSI - Container Storage Interface

\`\`\`bash
# Listar CSI drivers instalados
kubectl get csidrivers
kubectl get csinodes

# Listar StorageClasses e seus provisioners
kubectl get storageclass

# Ver detalhes de um StorageClass
kubectl describe storageclass <nome>
# Campo "Provisioner:" indica o CSI driver
\`\`\`

\`\`\`yaml
# StorageClass usando CSI driver
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: pd.csi.storage.gke.io    # CSI driver do Google Persistent Disk
parameters:
  type: pd-ssd
  replication-type: none
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
\`\`\`

---

## API Aggregation Layer vs CRDs

| Caracteristica | CRDs | API Aggregation |
|---|---|---|
| Complexidade | Baixa | Alta |
| Storage | etcd do cluster | Proprio backend |
| Endpoints | Apenas CRUD | Customizados (watch, exec, etc) |
| Implementacao | Schema declarativo | Servidor Go separado |
| Exemplo | Custom operators | metrics-server, kube-apiserver |

\`\`\`yaml
# Registrar um servidor de API agregado
apiVersion: apiregistration.k8s.io/v1
kind: APIService
metadata:
  name: v1beta1.metrics.k8s.io
spec:
  service:
    name: metrics-server
    namespace: kube-system
    port: 443
  group: metrics.k8s.io
  version: v1beta1
  insecureSkipTLSVerify: true
  groupPriorityMinimum: 100
  versionPriority: 100
\`\`\`

\`\`\`bash
# Listar APIs registradas (inclui aggregated APIs)
kubectl get apiservices
kubectl get apiservices -o wide

# Verificar status das APIs aggregated
kubectl get apiservices | grep -v Local

# Exemplo: metrics-server expoe API metrics.k8s.io
kubectl top nodes
kubectl top pods -A
\`\`\`
`,

  quiz: [
    {
      question: 'Qual e o nome correto de um CRD chamado "applications" no grupo "mycompany.io"?',
      options: [
        'mycompany.io/applications',
        'applications.mycompany.io',
        'applications/mycompany.io',
        'crd/applications.mycompany.io'
      ],
      correct: 1,
      explanation: 'O campo metadata.name de um CRD segue o formato "<plural>.<group>", portanto "applications.mycompany.io". Esse e o padrao obrigatorio para nomear CRDs no Kubernetes e garante unicidade dos tipos de recursos no cluster.'
    },
    {
      question: 'O que significa "served: true" e "storage: true" no campo versions de um CRD?',
      options: [
        'served: a versao e exposta pela API; storage: a versao e usada para persistir no etcd',
        'served: a versao foi testada; storage: a versao esta em disco',
        'served: a versao e obrigatoria; storage: a versao pode ser armazenada',
        'served e storage sao sinonimos e podem ser usados intercambiavelmente'
      ],
      correct: 0,
      explanation: '"served: true" significa que o API Server aceita requisicoes para essa versao. "storage: true" indica qual versao e usada para armazenar os objetos no etcd - apenas UMA versao pode ter storage: true. Versoes legadas podem ter served: true e storage: false.'
    },
    {
      question: 'Qual e a interface que permite usar diferentes container runtimes (containerd, CRI-O) no Kubernetes?',
      options: [
        'CNI - Container Network Interface',
        'CSI - Container Storage Interface',
        'CRI - Container Runtime Interface',
        'CMI - Container Management Interface'
      ],
      correct: 2,
      explanation: 'CRI (Container Runtime Interface) e a interface que abstrai o container runtime do Kubernetes. Permite usar containerd, CRI-O ou outros runtimes compativeis. Docker foi removido como runtime nativo no K8s 1.24 (precisava do dockershim).'
    },
    {
      question: 'Qual componente de um Operator implementa o loop de reconciliacao que observa os Custom Resources?',
      options: [
        'O CRD (CustomResourceDefinition)',
        'O Controller (Operador)',
        'O API Server',
        'O Admission Webhook'
      ],
      correct: 1,
      explanation: 'O Controller (o codigo do Operator) implementa o loop de reconciliacao: observa mudancas nos Custom Resources via watch da API, compara o estado desejado com o atual, e age para aproximar o estado atual do desejado seguindo o ciclo Observe > Analyze > Act. O CRD apenas define a estrutura dos recursos.'
    },
    {
      question: 'Como remover um Custom Resource que esta travado com finalizers quando o controller nao esta funcionando?',
      options: [
        'kubectl delete --force --grace-period=0',
        'kubectl patch <resource> <name> -p \'{"metadata":{"finalizers":[]}}\' --type=merge',
        'kubectl remove finalizers <resource> <name>',
        'kubectl edit e deletar manualmente a linha dos finalizers'
      ],
      correct: 1,
      explanation: 'Para remover um recurso com finalizers quando o controller nao pode processa-los, use kubectl patch para limpar a lista de finalizers com --type=merge. Apos isso, a delecao prossegue normalmente. Opcao D (kubectl edit) tambem funciona mas e mais lenta. A opcao A (--force) nao remove finalizers.'
    },
    {
      question: 'Qual e a diferenca entre CRDs e a API Aggregation Layer para extender o Kubernetes?',
      options: [
        'CRDs sao mais poderosos e suportam qualquer operacao; Aggregation Layer e mais limitada',
        'CRDs armazenam dados no etcd e sao gerenciados pelo API Server; Aggregation Layer usa um servidor separado que implementa a logica propria',
        'API Aggregation Layer e a forma moderna e CRDs sao a forma legada',
        'Nao ha diferenca tecnica significativa entre os dois mecanismos'
      ],
      correct: 1,
      explanation: 'CRDs usam o etcd do cluster para armazenar dados e o API Server do Kubernetes para validar e servir os recursos. A API Aggregation Layer registra servidores de API separados que implementam logica propria, suportam endpoints customizados (nao apenas CRUD) e podem ter seus proprios backends de storage. O metrics-server e um exemplo de API Aggregation.'
    },
    {
      question: 'Qual campo deve ser definido no spec.names do CRD para que o shortname "app" funcione no kubectl?',
      options: [
        'shortNames em kustomization.yaml',
        'shortNames no campo names do CRD spec',
        'aliases no Chart.yaml',
        'shortcut no metadata do CRD'
      ],
      correct: 1,
      explanation: 'O campo "shortNames" esta na secao "spec.names" do CRD. Exemplo: names: { plural: applications, singular: application, kind: Application, shortNames: [app] }. Apos isso, "kubectl get app" funciona como "kubectl get applications".'
    },
    {
      question: 'O que acontece quando voce deleta um Custom Resource que tem finalizers definidos no metadata?',
      options: [
        'O recurso e deletado imediatamente ignorando os finalizers',
        'O campo deletionTimestamp e preenchido e o recurso fica em estado de delecao pendente ate os finalizers serem removidos',
        'O kubectl retorna erro e nao permite a delecao',
        'Os finalizers sao automaticamente removidos pelo API Server'
      ],
      correct: 1,
      explanation: 'Ao deletar um recurso com finalizers, o Kubernetes preenche o campo deletionTimestamp mas nao remove o objeto. O controller deve processar o cleanup e remover os finalizers da lista. Apenas quando a lista de finalizers estiver vazia o objeto e efetivamente removido do etcd.'
    },
    {
      question: 'Qual validacao CEL (Common Expression Language) verifica que maxReplicas e maior ou igual a minReplicas em um CRD?',
      options: [
        'rule: "spec.maxReplicas >= spec.minReplicas"',
        'rule: "self.maxReplicas >= self.minReplicas"',
        'rule: "$.maxReplicas >= $.minReplicas"',
        'rule: "maxReplicas >= minReplicas"'
      ],
      correct: 1,
      explanation: 'Em validacoes CEL de CRDs, o objeto atual e referenciado pela variavel "self". A expressao correta e: x-kubernetes-validations: - rule: "self.maxReplicas >= self.minReplicas". Essa feature foi introduzida no Kubernetes 1.25 como beta e permite validacoes cruzadas entre campos sem precisar de webhooks.'
    },
    {
      question: 'Qual subresource do CRD deve ser habilitado para que o HPA (HorizontalPodAutoscaler) funcione com um Custom Resource?',
      options: [
        'status: {}',
        'scale com specReplicasPath e statusReplicasPath',
        'metrics: {}',
        'autoscale: {} com minReplicas e maxReplicas'
      ],
      correct: 1,
      explanation: 'Para o HPA funcionar com um Custom Resource, o CRD deve ter o subresource "scale" habilitado com os caminhos JSONPath para spec.replicas e status.replicas. O HPA usa o endpoint /scale para ler e escrever o numero de replicas. Tambem e necessario expor metricas via metrics-server ou custom metrics API.'
    }
  ],

  flashcards: [
    {
      front: 'Qual e a convencao de nomenclatura para o metadata.name de um CRD?',
      back: 'O nome segue o formato: <plural>.<group>\n\nExemplo:\nse o grupo e "mycompany.io" e o plural e "applications",\no nome do CRD e "applications.mycompany.io"\n\nEsse padrao e obrigatorio e garante unicidade dos tipos de recursos no cluster.'
    },
    {
      front: 'O que compoe um Operator Kubernetes?',
      back: '1. CRD(s): definem os tipos de recursos gerenciados (ex: Database, Backup)\n2. Controller: codigo que implementa o loop de reconciliacao\n   - Ciclo: Observe > Analyze > Act\n   - Encapsula conhecimento operacional (backup, failover, scaling)\n\nO Operator roda como um Deployment no cluster.\nFrameworks: Operator SDK, Kubebuilder'
    },
    {
      front: 'Quais sao as tres interfaces principais de extensao do Kubernetes (CRI, CNI, CSI)?',
      back: 'CRI - Container Runtime Interface:\n  Permite usar containerd, CRI-O, etc.\n\nCNI - Container Network Interface:\n  Define como pods recebem IPs e se comunicam\n  Exemplos: Calico, Flannel, Cilium, Weave\n\nCSI - Container Storage Interface:\n  Permite usar diferentes sistemas de storage\n  Exemplos: AWS EBS CSI, GCE PD CSI, Longhorn'
    },
    {
      front: 'O que e um Finalizer em Kubernetes e para que serve?',
      back: 'Finalizer e uma chave no metadata.finalizers de um recurso que impede sua delecao ate que o controller a remova.\n\nFluxo:\n1. kubectl delete -> deletionTimestamp preenchido\n2. Controller processa cleanup\n3. Controller remove o finalizer\n4. Objeto e deletado do etcd\n\nPara desbloquear manualmente:\nkubectl patch <tipo> <nome> \\\n  -p \'{"metadata":{"finalizers":[]}}\' \\\n  --type=merge'
    },
    {
      front: 'Como listar e inspecionar CRDs instalados no cluster?',
      back: '# Listar todos os CRDs\nkubectl get crds\nkubectl get customresourcedefinitions\n\n# Ver detalhes de um CRD\nkubectl describe crd <nome-do-crd>\n\n# Ver o schema completo (YAML)\nkubectl get crd <nome> -o yaml\n\n# Listar instancias de um custom resource\nkubectl get <plural>\nkubectl get <plural> -A\n\n# Ver APIs disponíveis incluindo CRDs\nkubectl api-resources | grep <grupo>'
    },
    {
      front: 'Qual e a diferenca entre "scope: Namespaced" e "scope: Cluster" em um CRD?',
      back: 'scope: Namespaced:\n- Instancias pertencem a um namespace\n- kubectl get <resource> -n <namespace>\n- Similar a pods, services, deployments\n\nscope: Cluster:\n- Instancias sao globais (sem namespace)\n- kubectl get <resource> (sem -n)\n- Similar a nodes, persistentvolumes, clusterroles\n\nVerificar:\nkubectl get crd <nome> -o jsonpath=\'{.spec.scope}\''
    },
    {
      front: 'O que e a API Aggregation Layer e como ela difere dos CRDs?',
      back: 'API Aggregation Layer permite registrar servidores de API adicionais via APIService.\n\nDiferencas principais:\nCRDs:\n- Armazenam no etcd\n- Apenas operacoes CRUD\n- Mais simples de implementar\n\nAggregation Layer:\n- Servidor separado com logica propria\n- Endpoints customizados\n- Pode ter backend proprio\n\nExemplo: metrics-server usa Aggregation Layer\npara expor a API metrics.k8s.io'
    },
    {
      front: 'O que sao additionalPrinterColumns em um CRD?',
      back: 'Colunas extras exibidas no output do kubectl get.\n\nExemplo no CRD spec:\nadditionalPrinterColumns:\n- name: Image\n  type: string\n  jsonPath: .spec.image\n- name: Replicas\n  type: integer\n  jsonPath: .spec.replicas\n- name: Age\n  type: date\n  jsonPath: .metadata.creationTimestamp\n\nResultado: kubectl get applications mostrara\nas colunas NAME, IMAGE, REPLICAS, AGE'
    },
    {
      front: 'O que sao short names e categories em CRDs e como usar?',
      back: 'Short names sao atalhos para o nome do recurso no kubectl:\n\nspec:\n  names:\n    shortNames: [app, apps]\n    categories: [all, myplatform]\n\nUso:\nkubectl get app        # equivale a kubectl get applications\nkubectl get apps -A    # todos os namespaces\n\nCategories agrupam recursos:\nkubectl get all         # inclui recursos com category: all\nkubectl get myplatform  # todos CRs da categoria'
    },
    {
      front: 'Como funciona o subresource /scale em um CRD?',
      back: 'O subresource /scale permite que o HPA e kubectl scale funcionem\ncom Custom Resources.\n\nConfiguracao no CRD:\nsubresources:\n  scale:\n    specReplicasPath: .spec.replicas\n    statusReplicasPath: .status.availableReplicas\n    labelSelectorPath: .status.labelSelector\n\nUso:\nkubectl scale <resource> <nome> --replicas=5\nkubectl autoscale <resource> <nome> \\\n  --min=2 --max=10 --cpu-percent=70'
    },
    {
      front: 'Quais sao as ferramentas usadas para debugar containers via CRI (sem kubectl)?',
      back: 'crictl - CLI compativel com CRI (containerd, CRI-O)\n\ncrictl pods              # listar pods\ncrictl ps                # listar containers rodando\ncrictl ps -a             # todos (incluindo parados)\ncrictl logs <id>         # ver logs do container\ncrictl inspect <id>      # inspecionar container\ncrictl images            # listar imagens locais\ncrictl pull nginx        # baixar imagem\n\nUtil quando kubectl nao funciona (apiserver down)'
    },
    {
      front: 'Como usar validacao CEL em CRDs e quando foi introduzida?',
      back: 'CEL (Common Expression Language) permite validacoes cruzadas\nentre campos sem precisar de webhooks.\n\nIntroduzida: Kubernetes 1.25 (beta), 1.29 (stable)\n\nSintaxe:\nx-kubernetes-validations:\n- rule: "self.maxReplicas >= self.minReplicas"\n  message: "maxReplicas deve ser >= minReplicas"\n- rule: "self.mode != \'prod\' || self.replicas >= 2"\n  message: "producao exige 2+ replicas"\n\n"self" referencia o objeto atual na validacao.'
    }
  ],

  lab: {
    scenario: 'A equipe de plataforma precisa criar um Custom Resource para gerenciar configuracoes de banco de dados no cluster. Voce deve criar um CRD chamado "Database" no grupo "platform.io", com schema de validacao completo incluindo validacao CEL, criar instancias desse recurso, testar a validacao, e explorar as interfaces de extensao do cluster (CRI, CNI, CSI).',
    objective: 'Criar um CRD completo com schema de validacao e CEL, criar Custom Resources, testar validacoes, trabalhar com finalizers, e explorar as interfaces de extensao do cluster.',
    steps: [
      {
        title: 'Criar o CustomResourceDefinition (CRD) com schema completo',
        instruction: 'Crie um CRD chamado "databases.platform.io" com scope Namespaced, versao v1, schema completo com campos obrigatorios e opcionais, validacao CEL cruzada, short names, categories e additionalPrinterColumns.',
        hints: [
          'O nome do CRD deve ser <plural>.<group>',
          'Use openAPIV3Schema para definir o schema de validacao',
          'additionalPrinterColumns define as colunas extras no kubectl get',
          'x-kubernetes-validations permite validacao CEL entre campos',
          'Aplique com kubectl apply -f e verifique com kubectl get crds'
        ],
        solution: '```bash\ncat > /tmp/database-crd.yaml << \'EOF\'\napiVersion: apiextensions.k8s.io/v1\nkind: CustomResourceDefinition\nmetadata:\n  name: databases.platform.io\nspec:\n  group: platform.io\n  scope: Namespaced\n  names:\n    plural: databases\n    singular: database\n    kind: Database\n    shortNames:\n    - db\n    categories:\n    - all\n  versions:\n  - name: v1\n    served: true\n    storage: true\n    schema:\n      openAPIV3Schema:\n        type: object\n        properties:\n          spec:\n            type: object\n            required: ["engine", "version", "storageSize"]\n            properties:\n              engine:\n                type: string\n                enum: ["postgresql", "mysql", "mongodb"]\n              version:\n                type: string\n              storageSize:\n                type: string\n              minReplicas:\n                type: integer\n                minimum: 1\n                default: 1\n              maxReplicas:\n                type: integer\n                minimum: 1\n                default: 3\n            x-kubernetes-validations:\n            - rule: "self.maxReplicas >= self.minReplicas"\n              message: "maxReplicas deve ser maior ou igual a minReplicas"\n          status:\n            type: object\n            properties:\n              phase:\n                type: string\n              readyReplicas:\n                type: integer\n    additionalPrinterColumns:\n    - name: Engine\n      type: string\n      jsonPath: .spec.engine\n    - name: Version\n      type: string\n      jsonPath: .spec.version\n    - name: Storage\n      type: string\n      jsonPath: .spec.storageSize\n    - name: Age\n      type: date\n      jsonPath: .metadata.creationTimestamp\n    subresources:\n      status: {}\n      scale:\n        specReplicasPath: .spec.maxReplicas\n        statusReplicasPath: .status.readyReplicas\nEOF\n\n# Aplicar o CRD\nkubectl apply -f /tmp/database-crd.yaml\n\n# Verificar que o CRD foi criado e esta estabelecido\nkubectl get crds | grep platform.io\nkubectl get crd databases.platform.io -o jsonpath=\'{.status.conditions[?(@.type=="Established")].status}\'\n# Deve retornar: True\n\n# Ver APIs disponiveis\nkubectl api-resources | grep platform.io\n```'
      },
      {
        title: 'Criar Custom Resources e testar validacao do schema',
        instruction: 'Crie Custom Resources validos e tente criar recursos com dados invalidos para verificar que o schema de validacao esta funcionando. Teste o shortname "db" e as colunas customizadas.',
        hints: [
          'O apiVersion sera platform.io/v1',
          'O kind sera Database',
          'Tente criar com engine invalido para ver o erro de validacao',
          'Tente criar com maxReplicas < minReplicas para testar a validacao CEL',
          'Use kubectl get db para testar o shortname'
        ],
        solution: '```bash\n# Criar namespace\nkubectl create namespace data-team\n\n# Criar Database PostgreSQL valido\ncat > /tmp/postgres-db.yaml << \'EOF\'\napiVersion: platform.io/v1\nkind: Database\nmetadata:\n  name: postgres-main\n  namespace: data-team\nspec:\n  engine: postgresql\n  version: "15.4"\n  storageSize: "50Gi"\n  minReplicas: 2\n  maxReplicas: 5\nEOF\n\nkubectl apply -f /tmp/postgres-db.yaml\n\n# Listar usando plural e shortname\nkubectl get databases -n data-team\nkubectl get db -n data-team\nkubectl get db -A\n\n# TESTE 1: engine invalido (deve falhar)\nkubectl apply -f - <<EOF\napiVersion: platform.io/v1\nkind: Database\nmetadata:\n  name: invalid-engine\n  namespace: data-team\nspec:\n  engine: oracle\n  version: "19c"\n  storageSize: "100Gi"\nEOF\n# Esperado: The Database "invalid-engine" is invalid: spec.engine: Unsupported value: "oracle"\n\n# TESTE 2: validacao CEL - maxReplicas < minReplicas (deve falhar)\nkubectl apply -f - <<EOF\napiVersion: platform.io/v1\nkind: Database\nmetadata:\n  name: invalid-replicas\n  namespace: data-team\nspec:\n  engine: postgresql\n  version: "15.4"\n  storageSize: "10Gi"\n  minReplicas: 5\n  maxReplicas: 2\nEOF\n# Esperado: maxReplicas deve ser maior ou igual a minReplicas\n\n# TESTE 3: campo obrigatorio faltando (deve falhar)\nkubectl apply -f - <<EOF\napiVersion: platform.io/v1\nkind: Database\nmetadata:\n  name: missing-field\n  namespace: data-team\nspec:\n  engine: postgresql\n  version: "15.4"\n  # storageSize faltando!\nEOF\n# Esperado: spec.storageSize: Required value\n```'
      },
      {
        title: 'Trabalhar com Finalizers em Custom Resources',
        instruction: 'Adicione um finalizer ao Custom Resource criado, tente deletar o recurso e observe o comportamento de delecao pendente. Em seguida, remova o finalizer manualmente para desbloquear a delecao.',
        hints: [
          'Use kubectl patch para adicionar o finalizer ao metadata',
          'Observe que kubectl delete nao remove o objeto imediatamente',
          'Verifique o deletionTimestamp com kubectl get -o yaml',
          'Remova o finalizer via kubectl patch com --type=merge'
        ],
        solution: '```bash\n# Adicionar finalizer ao recurso existente\nkubectl patch database postgres-main -n data-team \\\n  -p \'{"metadata":{"finalizers":["platform.io/cleanup-storage"]}}\' \\\n  --type=merge\n\n# Verificar o finalizer foi adicionado\nkubectl get database postgres-main -n data-team \\\n  -o jsonpath=\'{.metadata.finalizers}\'\n\n# Tentar deletar o recurso (vai ficar pendente)\nkubectl delete database postgres-main -n data-team &\n\n# Em outro terminal ou apos Ctrl+C, verificar o estado\nkubectl get database postgres-main -n data-team -o yaml | grep -E "finalizers|deletionTimestamp"\n# Voce vera que deletionTimestamp foi preenchido mas o objeto ainda existe\n\n# Simular o que um controller faria: remover o finalizer\nkubectl patch database postgres-main -n data-team \\\n  -p \'{"metadata":{"finalizers":[]}}\' \\\n  --type=merge\n\n# Agora o recurso e deletado automaticamente\nkubectl get database -n data-team\n# Deve retornar: No resources found\n```'
      },
      {
        title: 'Explorar interfaces de extensao: CRI, CNI e CSI',
        instruction: 'Verifique o container runtime (CRI) usado pelos nodes, liste os plugins CNI configurados, explore os CSI drivers instalados no cluster, e use crictl para inspecionar containers.',
        hints: [
          'kubectl get nodes -o wide mostra o container runtime',
          'kubectl get pods -n kube-system mostra os pods do CNI',
          'kubectl get csidrivers lista drivers CSI',
          'kubectl get apiservices mostra APIs aggregated (como metrics)',
          'crictl precisa ser executado no node (via SSH)'
        ],
        solution: '```bash\n# Verificar CRI (container runtime) dos nodes\nkubectl get nodes -o wide\n# Coluna CONTAINER-RUNTIME mostra o runtime (ex: containerd://1.7.x)\n\n# Detalhes do runtime via describe\nkubectl describe node <node-name> | grep "Container Runtime"\n\n# Ver versao exata do container runtime\nkubectl get nodes -o jsonpath=\'{range .items[*]}{.metadata.name}{"\\t"}{.status.nodeInfo.containerRuntimeVersion}{"\\n"}{end}\'\n\n# Listar pods do CNI (geralmente no kube-system)\nkubectl get pods -n kube-system\n# Procurar por: calico, flannel, weave, cilium, etc.\n\n# Ver logs do CNI\nkubectl logs -n kube-system -l k8s-app=calico-node --tail=20 2>/dev/null || \\\nkubectl logs -n kube-system -l app=flannel --tail=20 2>/dev/null || \\\necho "Identificar o CNI instalado no cluster"\n\n# Listar CSI drivers instalados\nkubectl get csidrivers\n\n# Ver nodes com informacoes de CSI\nkubectl get csinodes\n\n# Listar StorageClasses e seus provisioners (CSI drivers)\nkubectl get storageclass\n\n# Ver APIs aggregated (API Aggregation Layer)\nkubectl get apiservices | grep -v Local\n\n# Se metrics-server estiver instalado:\nkubectl top nodes 2>/dev/null || echo "metrics-server nao instalado"\nkubectl top pods --all-namespaces 2>/dev/null\n\n# Usar crictl no node (via SSH)\n# ssh <node>\n# crictl ps\n# crictl pods\n# crictl images\n\n# Limpar recursos do lab\nkubectl delete crd databases.platform.io\nkubectl delete namespace data-team\n```'
      },
      {
        title: 'Explorar APIs do cluster e inspecionar CRDs instalados',
        instruction: 'Explore todas as APIs disponíveis no cluster incluindo as de terceiros (CRDs instalados), verifique grupos de API, e use kubectl explain para entender a estrutura de CRDs existentes.',
        hints: [
          'kubectl api-resources lista todos os recursos incluindo CRDs',
          'kubectl api-versions lista todos os grupos de API e versoes',
          'kubectl explain funciona para custom resources tambem',
          'Use --sort-by para organizar a saida de api-resources'
        ],
        solution: '```bash\n# Listar todos os recursos da API incluindo CRDs\nkubectl api-resources --sort-by=name\n\n# Filtrar por grupos especificos\nkubectl api-resources --api-group=apps\nkubectl api-resources --api-group=batch\nkubectl api-resources --api-group=storage.k8s.io\n\n# Ver todos os grupos e versoes\nkubectl api-versions\n\n# Ver apenas APIs de extensoes (CRDs)\nkubectl api-resources | grep -v "k8s.io\\|networking\\|policy\\|rbac\\|storage\\|batch\\|apps" | \\\n  grep -v "^NAME" | head -20\n\n# Verificar estrutura de um recurso (funciona com CRDs tambem)\nkubectl explain database.spec --api-version=platform.io/v1 2>/dev/null || \\\necho "CRD removido no passo anterior"\n\n# Ver CRDs instalados por terceiros (operators)\nkubectl get crds | grep -v "k8s.io"\n\n# Verificar status de um CRD (Established, NamesAccepted)\nkubectl get crd <nome-crd> -o jsonpath=\'{.status.conditions}\' | python3 -m json.tool 2>/dev/null\n\n# Ver todas as APIs em formato JSON\nkubectl get --raw /apis | python3 -m json.tool 2>/dev/null | grep "\"name\"" | head -30\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'kubectl get retorna "No resources found" para um Custom Resource recem-criado',
      symptom: 'Apos aplicar um CRD e criar uma instancia do custom resource, o comando "kubectl get <resource>" retorna "No resources found in default namespace." mesmo que a criacao nao tenha retornado erro.',
      diagnosis: '```bash\n# 1. Verificar se o CRD foi criado corretamente\nkubectl get crds | grep <seu-grupo>\n\n# 2. Verificar se o CRD esta em status Established\nkubectl get crd <nome-do-crd> \\\n  -o jsonpath=\'{.status.conditions[?(@.type=="Established")].status}\'\n# Deve retornar: True\n\n# 3. Verificar o namespace onde o recurso foi criado\nkubectl get <resource> --all-namespaces\nkubectl get <resource> -A\n\n# 4. Verificar se o scope esta correto (Namespaced vs Cluster)\nkubectl get crd <nome> -o jsonpath=\'{.spec.scope}\'\n\n# 5. Verificar o group e version corretos\nkubectl get crd <nome> -o jsonpath=\'{.spec.group}\'\nkubectl api-resources | grep <seu-grupo>\n\n# 6. Tentar com o nome plural exato definido no CRD\nkubectl get crd <nome> -o jsonpath=\'{.spec.names.plural}\'\nkubectl get <plural-correto>\n\n# 7. Ver se o recurso existe em algum namespace\nkubectl get <plural> -A\n```',
      solution: '```bash\n# Causa 1: Buscando no namespace errado\n# Se scope e Namespaced, especifique o namespace correto\nkubectl get <resource> -n <namespace-correto>\nkubectl get <resource> --all-namespaces\n\n# Causa 2: CRD com scope Cluster, passando -n incorretamente\n# Recursos Cluster-scoped nao sao namespaceds\nkubectl get <resource>  # sem -n\n\n# Causa 3: CRD ainda nao estabelecido (pode demorar alguns segundos)\nkubectl get crd <nome> \\\n  -o jsonpath=\'{.status.conditions[?(@.type=="Established")].status}\'\n# Aguardar retornar "True"\n\n# Causa 4: Nome plural incorreto no kubectl get\nkubectl get crd <nome> -o jsonpath=\'{.spec.names}\'\n# Usar o plural correto ou o shortName\n\n# Verificar onde o recurso foi realmente criado\nkubectl get <plural> -A -o wide\n\n# Verificar que o CRD foi aplicado (nao apenas validado)\nkubectl describe crd <nome> | grep -A5 "Conditions:"\n```'
    },
    {
      title: 'Custom Resource travado em delecao por causa de Finalizers',
      symptom: 'Um Custom Resource foi deletado com "kubectl delete" mas permanece no cluster por tempo indeterminado. O campo "deletionTimestamp" esta preenchido mas o objeto nao e removido. O controller pode estar com falha ou nao estar processando o finalizer.',
      diagnosis: '```bash\n# 1. Verificar se o recurso tem finalizers\nkubectl get <resource> <nome> -n <namespace> \\\n  -o jsonpath=\'{.metadata.finalizers}\'\n\n# 2. Verificar o deletionTimestamp (quando foi marcado para delecao)\nkubectl get <resource> <nome> -n <namespace> \\\n  -o jsonpath=\'{.metadata.deletionTimestamp}\'\n\n# 3. Ver o estado completo do objeto\nkubectl get <resource> <nome> -n <namespace> -o yaml | \\\n  grep -E "finalizers|deletionTimestamp|deletionGracePeriod"\n\n# 4. Verificar se o controller (Operator) esta rodando\nkubectl get pods -n <operator-namespace>\nkubectl logs -n <operator-namespace> <operator-pod> --tail=50\n\n# 5. Ver eventos do recurso\nkubectl describe <resource> <nome> -n <namespace>\nkubectl get events -n <namespace> | grep <nome>\n```',
      solution: '```bash\n# Solucao principal: Remover manualmente os finalizers\n# CUIDADO: isso bypassa o cleanup do controller\nkubectl patch <resource> <nome> \\\n  -n <namespace> \\\n  -p \'{"metadata":{"finalizers":[]}}\' \\\n  --type=merge\n\n# Verificar que o recurso foi removido\nkubectl get <resource> -n <namespace>\n\n# Alternativa: editar diretamente\nkubectl edit <resource> <nome> -n <namespace>\n# Remover o conteudo do campo finalizers:\n# finalizers: []  -> ou deletar as linhas dos finalizers\n\n# Se o operator estiver com erro (melhor abordagem):\n# 1. Investigar o erro do operator\nkubectl logs -n <operator-ns> <operator-pod> | grep -i "error\\|failed\\|panic"\n\n# 2. Corrigir o problema do operator\n# 3. O operator vai processar o finalizer e deletar o recurso corretamente\n\n# PREVENCAO no desenvolvimento do operator:\n# Implementar timeout no processamento de finalizers\n# Evitar operacoes bloqueantes infinitas no controller\n# Usar graceful degradation quando dependencias externas falham\n```'
    },
    {
      title: 'CRD com erro de validacao de schema ao aplicar Custom Resources',
      symptom: 'Ao tentar criar um Custom Resource, o kubectl retorna erros de validacao como "The Database is invalid: spec.field: Invalid value" ou "Required value". O objeto e valido visualmente mas ainda falha na criacao.',
      diagnosis: '```bash\n# 1. Ver o erro completo do kubectl apply\nkubectl apply -f meu-resource.yaml\n# Ler a mensagem de erro com atencao\n\n# 2. Verificar o schema do CRD para o campo com erro\nkubectl get crd <nome-crd> -o yaml | grep -A 50 "openAPIV3Schema"\n\n# 3. Verificar quais campos sao obrigatorios\nkubectl get crd <nome-crd> -o jsonpath=\'{.spec.versions[0].schema.openAPIV3Schema.properties.spec.required}\'\n\n# 4. Ver as restricoes de enum (valores permitidos)\nkubectl get crd <nome-crd> -o yaml | grep -A 5 "enum"\n\n# 5. Verificar validacoes CEL se houver\nkubectl get crd <nome-crd> -o yaml | grep -A 5 "x-kubernetes-validations"\n\n# 6. Usar dry-run para validar antes de aplicar\nkubectl apply -f meu-resource.yaml --dry-run=server\n\n# 7. Verificar a versao da API usada no YAML vs versoes do CRD\nkubectl get crd <nome-crd> -o jsonpath=\'{.spec.versions[*].name}\'\n```',
      solution: '```bash\n# Causa 1: Campo obrigatorio ausente\n# Adicionar o campo que esta faltando no YAML\n# Campos obrigatorios estao em spec.versions[].schema.openAPIV3Schema.properties.spec.required\n\n# Causa 2: Valor nao permitido pelo enum\n# Verificar os valores aceitos:\nkubectl get crd <nome> -o yaml | grep -B2 -A10 "enum"\n# Usar apenas os valores listados no enum\n\n# Causa 3: Falha na validacao CEL (ex: maxReplicas < minReplicas)\n# A mensagem de erro vai indicar a regra CEL que falhou\n# Ajustar os valores no YAML para satisfazer a regra\n\n# Causa 4: Tipo de dado incorreto\n# Ex: usando string onde se espera integer\n# Verificar o schema:\nkubectl get crd <nome> -o yaml | grep -A3 "replicas:"\n\n# Causa 5: apiVersion incorreto\n# O apiVersion deve ser <grupo>/<versao>\n# Ex: platform.io/v1  (nao apenas v1)\n\n# Para depurar interativamente:\nkubectl apply -f meu-resource.yaml --dry-run=server -v=8 2>&1 | tail -50\n\n# Gerar template valido baseado no CRD:\nkubectl explain database.spec\nkubectl explain database.spec.engine\n```'
    }
  ]
};
