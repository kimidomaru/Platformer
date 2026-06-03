window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['kyverno/kyverno-policies'] = {
  theory: `
# Kyverno: Validate, Mutate & Generate Avancado

## Relevancia
Este topico aprofunda os tres tipos principais de rules Kyverno com tecnicas avancadas: validate com deny e foreach, mutate com JSON Patch e uso de contexto/variaveis, e generate com cloneFrom. Tambem cobre JMESPath e CEL para expressoes complexas — habilidades essenciais para construir policies robustas em producao.

## Conceitos Fundamentais

### Validate Avancado

#### Validate com Deny Conditions

\`\`\`yaml
# Negar pods com imagens usando tag "latest"
rules:
  - name: deny-latest-tag
    match:
      any:
        - resources:
            kinds: [Pod]
    validate:
      message: "Imagens com tag :latest nao sao permitidas. Use versoes especificas."
      deny:
        conditions:
          any:
            - key: "{{ images.containers.*.tag }}"
              operator: AnyIn
              value: ["latest", ""]   # Tambem bloquear tag vazia
\`\`\`

\`\`\`yaml
# Negar pods sem securityContext adequado
rules:
  - name: deny-privileged
    match:
      any:
        - resources:
            kinds: [Pod]
    validate:
      message: "Containers privilegiados nao sao permitidos."
      deny:
        conditions:
          any:
            - key: "{{ request.object.spec.containers[].securityContext.privileged }}"
              operator: AnyIn
              value: [true]
            - key: "{{ request.object.spec.initContainers[].securityContext.privileged }}"
              operator: AnyIn
              value: [true]
\`\`\`

#### Validate com Foreach

\`\`\`yaml
# Validar CADA container individualmente com foreach
rules:
  - name: check-container-limits
    match:
      any:
        - resources:
            kinds: [Pod]
    validate:
      message: "Container '{{ element.name }}' deve ter limits de CPU e memory."
      foreach:
        - list: "request.object.spec.containers"
          deny:
            conditions:
              any:
                - key: "{{ element.resources.limits.memory }}"
                  operator: Equals
                  value: ""
                - key: "{{ element.resources.limits.cpu }}"
                  operator: Equals
                  value: ""
\`\`\`

#### Validate com Context e Lookup externo

\`\`\`yaml
# Buscar dados externos (ConfigMap) para validacao
rules:
  - name: check-allowed-registries
    match:
      any:
        - resources:
            kinds: [Pod]
    context:
      - name: allowedRegistries
        configMap:
          name: allowed-registries
          namespace: kyverno
    validate:
      message: "Registry nao permitido. Registries permitidos: {{ allowedRegistries.data.list }}"
      foreach:
        - list: "request.object.spec.containers"
          deny:
            conditions:
              all:
                - key: "{{ element.image }}"
                  operator: AnyNotIn
                  value: "{{ allowedRegistries.data.list }}"
\`\`\`

### Mutate Avancado

#### patchStrategicMerge vs patchesJson6902

\`\`\`yaml
# patchStrategicMerge — merge inteligente (recomendado para a maioria dos casos)
mutate:
  patchStrategicMerge:
    spec:
      template:
        spec:
          containers:
            - (name): "*"              # Aplicar a TODOS os containers
              securityContext:
                runAsNonRoot: true
                allowPrivilegeEscalation: false

# patchesJson6902 — operacoes precisas (RFC 6902)
mutate:
  patchesJson6902: |
    - op: add
      path: /metadata/labels/env
      value: production
    - op: replace
      path: /spec/replicas
      value: 2
    - op: remove
      path: /metadata/annotations/kubectl.kubernetes.io~1last-applied-configuration
\`\`\`

#### Mutate com Variaveis e JMESPath

\`\`\`yaml
# Adicionar annotation com informacao do request
rules:
  - name: add-request-metadata
    match:
      any:
        - resources:
            kinds: [Deployment]
    mutate:
      patchStrategicMerge:
        metadata:
          annotations:
            kyverno.io/created-by: "{{ request.userInfo.username }}"
            kyverno.io/created-at: "{{ time_now_utc() }}"
            kyverno.io/namespace: "{{ request.namespace }}"
\`\`\`

\`\`\`yaml
# Mutate com context — buscar dados de ConfigMap
rules:
  - name: add-monitoring-sidecar
    match:
      any:
        - resources:
            kinds: [Deployment]
            selector:
              matchLabels:
                monitoring: "true"
    context:
      - name: sidecars
        configMap:
          name: sidecar-config
          namespace: monitoring
    mutate:
      patchStrategicMerge:
        spec:
          template:
            spec:
              containers:
                - name: prometheus-exporter
                  image: "{{ sidecars.data.exporterImage }}"
                  ports:
                    - containerPort: 9090
\`\`\`

#### Mutate com Foreach

\`\`\`yaml
# Adicionar imagePullPolicy a TODOS os containers
rules:
  - name: set-image-pull-policy
    match:
      any:
        - resources:
            kinds: [Pod]
    mutate:
      foreach:
        - list: "request.object.spec.containers"
          patchStrategicMerge:
            spec:
              containers:
                - (name): "{{ element.name }}"
                  imagePullPolicy: Always
\`\`\`

\`\`\`yaml
# Adicionar securityContext a cada container com foreach e preconditions
rules:
  - name: add-security-context
    match:
      any:
        - resources:
            kinds: [Pod]
    mutate:
      foreach:
        - list: "request.object.spec.containers"
          preconditions:
            any:
              - key: "{{ element.securityContext }}"
                operator: Equals
                value: null           # So adicionar se securityContext nao existe
          patchStrategicMerge:
            spec:
              containers:
                - (name): "{{ element.name }}"
                  securityContext:
                    runAsNonRoot: true
                    allowPrivilegeEscalation: false
                    readOnlyRootFilesystem: true
\`\`\`

### Generate Avancado

#### Generate com CloneFrom

\`\`\`yaml
# Clonar Secret de namespace source para novos namespaces
rules:
  - name: clone-registry-secret
    match:
      any:
        - resources:
            kinds: [Namespace]
    generate:
      synchronize: true
      kind: Secret
      name: registry-credentials
      namespace: "{{ request.object.metadata.name }}"
      clone:
        namespace: kyverno              # Namespace source
        name: registry-credentials     # Secret a clonar
\`\`\`

#### Generate baseado em label trigger

\`\`\`yaml
# Criar RoleBinding quando Service Account tem label especial
rules:
  - name: create-rolebinding-for-sa
    match:
      any:
        - resources:
            kinds: [ServiceAccount]
            selector:
              matchLabels:
                app.kubernetes.io/managed-by: argocd
    generate:
      apiVersion: rbac.authorization.k8s.io/v1
      kind: RoleBinding
      name: "{{ request.object.metadata.name }}-rolebinding"
      namespace: "{{ request.namespace }}"
      data:
        roleRef:
          apiGroup: rbac.authorization.k8s.io
          kind: ClusterRole
          name: edit
        subjects:
          - kind: ServiceAccount
            name: "{{ request.object.metadata.name }}"
            namespace: "{{ request.namespace }}"
\`\`\`

### Preconditions — Aplicar Rule Apenas Quando

\`\`\`yaml
# Preconditions sao checadas ANTES de executar a rule
# Se nao satisfeitas, a rule e PULADA (nao e erro)
rules:
  - name: example-with-preconditions
    match:
      any:
        - resources:
            kinds: [Deployment]
    preconditions:
      all:
        # Apenas para Deployments com mais de 1 replica
        - key: "{{ request.object.spec.replicas }}"
          operator: GreaterThanOrEquals
          value: 2
        # Apenas se nao for uma atualizacao de status
        - key: "{{ request.operation }}"
          operator: NotEquals
          value: DELETE
      any:
        # Pelo menos um desses labels
        - key: "{{ request.object.metadata.labels.tier }}"
          operator: AnyIn
          value: ["production", "staging"]
\`\`\`

### JMESPath — Expressoes Avancadas

\`\`\`yaml
# Funcoes JMESPath disponiveis no Kyverno:

# length() — tamanho de array
key: "{{ request.object.spec.containers | length(@) }}"
operator: GreaterThan
value: "0"

# contains() — verificar substring
key: "{{ contains(request.object.spec.containers[0].image, 'registry.io') }}"
operator: Equals
value: true

# starts_with() — prefixo
key: "{{ starts_with(request.object.spec.containers[0].image, 'gcr.io/') }}"

# ends_with() — sufixo
key: "{{ ends_with(request.object.spec.containers[0].image, ':latest') }}"

# split() — dividir string
key: "{{ split(request.object.spec.containers[0].image, ':')[1] }}"
operator: NotEquals
value: "latest"

# to_number() — converter string para numero
key: "{{ to_number(request.object.spec.replicas) }}"
operator: GreaterThan
value: "0"

# items() — iterar sobre objeto como array de key-value
key: "{{ items(request.object.metadata.labels, 'key', 'value') }}"
\`\`\`

### Variaveis Builtin do Kyverno

\`\`\`yaml
# request.*
{{ request.operation }}          # CREATE, UPDATE, DELETE, CONNECT
{{ request.namespace }}          # Namespace do recurso
{{ request.userInfo.username }}  # Usuario que fez o request
{{ request.userInfo.groups }}    # Grupos do usuario
{{ request.object.* }}           # Recurso sendo criado/atualizado
{{ request.oldObject.* }}        # Estado anterior (UPDATE)

# images.* (para validar imagens)
{{ images.containers.<name>.tag }}       # Tag da imagem do container
{{ images.containers.<name>.registry }}  # Registry
{{ images.containers.<name>.name }}      # Nome da imagem

# serviceAccountName / serviceAccountNamespace
{{ serviceAccountName }}         # SA que fez o request
{{ serviceAccountNamespace }}    # Namespace da SA

# element (dentro de foreach)
{{ element.name }}               # Campo do elemento iterado
{{ element.image }}

# Funcoes de tempo
{{ time_now_utc() }}             # Timestamp atual UTC
{{ time_add('1h') }}             # Adicionar tempo
\`\`\`

### Erros Comuns Avancados

1. **JMESPath syntax error** — Usar \`{{ }}\` ao inves de aspas simples para expressoes JMESPath em conditions
2. **foreach sem element** — Dentro de foreach, o item corrente e acessado como \`element\`, nao pelo nome da variavel
3. **Precondition null check** — Verificar se campo existe antes de usar: \`key: "{{ element.securityContext | to_string(@) }}" operator: Equals value: "null"\`
4. **Context lookup timing** — Context e resolvido ANTES das conditions, entao valores ficam disponiveis para uso em conditions e patterns
5. **generate sem RBAC** — O Kyverno precisa de RBAC para criar os recursos gerados; o ClusterRole kyverno precisa de permissao no tipo de recurso alvo

## Killer.sh Style Challenge

> **Cenario:** Crie uma ClusterPolicy chamada \`enforce-security\` com 3 rules: (1) validate que todos os containers em Pods NÃO usam tag "latest" — usar JMESPath images.containers.*.tag; (2) mutate para adicionar label "kyverno.io/scanned: true" em todos os Pods criados; (3) validate com foreach que cada container tem readOnlyRootFilesystem: true ou allowPrivilegeEscalation: false. Modo Audit para as validates, sempre aplicar o mutate.
`,
  quiz: [
    {
      question: 'Qual a diferenca entre validate.pattern e validate.deny?',
      options: [
        'pattern e mais rapido que deny',
        'pattern valida a ESTRUTURA do recurso com wildcards; deny usa conditions booleanas (JMESPath/CEL) para negar baseado em logica',
        'deny so funciona com foreach',
        'pattern so funciona com strings'
      ],
      correct: 1,
      explanation: 'pattern faz matching estrutural — o recurso deve CORRESPONDER ao pattern YAML. deny usa conditions com operadores (Equals, AnyIn, GreaterThan) sobre valores extraidos via JMESPath. pattern e mais legivel para estrutura; deny e necessario para logica complexa como "nao permitir containers privilegiados".',
      reference: 'Conceito relacionado: Combine pattern e deny na mesma rule para validacoes complexas.'
    },
    {
      question: 'O que sao preconditions em Kyverno e quando usar?',
      options: [
        'Preconditions sao iguais a match — filtram quais recursos a rule se aplica',
        'Preconditions sao verificadas APOS o match. Se nao satisfeitas, a rule e PULADA (sem erro). Usadas para aplicar logica condicional dentro de um match amplo.',
        'Preconditions so funcionam com generate',
        'Preconditions substituem o bloco exclude'
      ],
      correct: 1,
      explanation: 'match determina QUAIS recursos entram na rule. preconditions determinam SE a rule deve ser executada para um recurso que passou no match. Se preconditions falharem, a rule e silenciosamente ignorada — nao gera erro. Util para: "apenas mutate se campo X nao existe", "apenas gere se label Y presente".',
      reference: 'Conceito relacionado: preconditions podem usar JMESPath para logica complexa, como verificar o tamanho de arrays.'
    },
    {
      question: 'Como o foreach funciona em validate rules?',
      options: [
        'foreach itera sobre todos os namespaces',
        'foreach itera sobre uma lista JMESPath (ex: spec.containers) e aplica validate/deny/pattern a CADA elemento individualmente',
        'foreach e apenas para mutate rules',
        'foreach so funciona com arrays de strings'
      ],
      correct: 1,
      explanation: 'foreach em validate itera sobre uma lista (ex: "request.object.spec.containers") e aplica as conditions a cada elemento. O elemento corrente fica disponivel como "element". Permite validar cada container individualmente em vez de usar expressoes JMESPath complexas.',
      reference: 'Conceito relacionado: foreach tambem esta disponivel em mutate para modificar cada container individualmente.'
    },
    {
      question: 'Qual e a funcao JMESPath para verificar o tamanho de um array?',
      options: [
        'count(@)',
        'length(@)',
        'size(@)',
        'total(@)'
      ],
      correct: 1,
      explanation: 'length(@) ou length(array) retorna o numero de elementos. Exemplo: {{ request.object.spec.containers | length(@) }} retorna quantos containers o Pod tem. Outras funcoes: contains(), starts_with(), ends_with(), split(), to_number().',
      reference: 'Conceito relacionado: JMESPath e uma linguagem de query para JSON. Kyverno adiciona funcoes customizadas como time_now_utc() e items().'
    },
    {
      question: 'O que faz patchesJson6902 no mutate e quando usar em vez de patchStrategicMerge?',
      options: [
        'patchesJson6902 e mais seguro que patchStrategicMerge',
        'patchesJson6902 implementa RFC 6902 com operacoes precisas (add/replace/remove/move/copy). Usar quando precisa remover um campo, mover dados, ou fazer operacao especifica que o merge YAML nao suporta',
        'patchesJson6902 so funciona para ConfigMaps',
        'patchesJson6902 e para dados binarios'
      ],
      correct: 1,
      explanation: 'patchStrategicMerge: YAML declarativo, mais legivel, ideal para adicionar/modificar campos. patchesJson6902: operacoes explicitas (add, replace, remove, move, copy), preciso para remover campos, renomear, ou operacoes complexas. Exemplo: remover annotation kubectl.kubernetes.io/last-applied-configuration.',
      reference: 'Conceito relacionado: A maioria dos casos de mutate pode ser resolvida com patchStrategicMerge. Reserve patchesJson6902 para operacoes de remocao ou precisao.'
    },
    {
      question: 'Como acessar dados de um ConfigMap em uma Kyverno rule?',
      options: [
        'Usando kubectl configmap no pattern',
        'Usando o bloco context com configMap.name e configMap.namespace, e depois referenciar como {{ nomeDaVariavel.data.chave }}',
        'ConfigMaps nao podem ser acessados em Kyverno rules',
        'Usando uma annotation especial no ConfigMap'
      ],
      correct: 1,
      explanation: 'O bloco context permite injetar dados externos na rule. Para ConfigMap: context[].name define o nome da variavel, context[].configMap.name e namespace identificam o ConfigMap. Os dados ficam acessiveis como {{ nomeVar.data.chave }}. Tambem funciona com API Call, ImageRegistry e GlobalContextEntry.',
      reference: 'Conceito relacionado: context tambem suporta apiCall para buscar outros recursos K8s na hora da validacao.'
    },
    {
      question: 'Qual variavel builtin do Kyverno contem informacoes sobre quem fez o request?',
      options: [
        '{{ user.info }}',
        '{{ request.userInfo.username }} e {{ request.userInfo.groups }}',
        '{{ admission.user }}',
        '{{ context.requestor }}'
      ],
      correct: 1,
      explanation: 'request.userInfo contem informacoes do usuario/SA que iniciou o request: username (ex: "system:serviceaccount:default:my-sa"), groups (ex: ["system:serviceaccounts"]), uid. Util para audit trails, politicas baseadas em usuario, e exclusoes contextuais.',
      reference: 'Conceito relacionado: serviceAccountName e serviceAccountNamespace sao atalhos para a SA do request quando vem de um ServiceAccount.'
    }
  ],
  flashcards: [
    {
      front: 'Validate: pattern vs deny vs foreach — quando usar cada?',
      back: '**pattern** — Matching estrutural YAML\nRecurso deve CORRESPONDER ao YAML\nSimples, legivel, ideal para:\n- Verificar presenca de labels\n- Verificar estrutura de containers\n\n**deny** — Condicoes booleanas\nUsar JMESPath/CEL operators\nIdeal para:\n- Negar imagens com tag :latest\n- Negar containers privilegiados\n- Logica complexa com operadores\n\n**foreach** — Iteracao sobre lista\nAplicar validate a CADA elemento\nIdeal para:\n- Validar cada container separadamente\n- Dar mensagem de erro com nome do container\n- Quando JMESPath ficaria muito complexo\n\n**Combinacao:**\nPattern + deny na mesma rule\nforeach com deny conditions'
    },
    {
      front: 'JMESPath — funcoes mais usadas no Kyverno',
      back: '**Tamanho:**\n`length(array)` — numero de elementos\n\n**Strings:**\n`contains(str, substr)` — tem substring\n`starts_with(str, prefix)` — prefixo\n`ends_with(str, suffix)` — sufixo\n`split(str, delim)` — dividir\n`trim(str)` — remover espacos\n\n**Conversao:**\n`to_number(str)` — string para numero\n`to_string(obj)` — objeto para string\n`base64_decode(str)` — decodificar\n\n**Arrays:**\n`items(obj, keyVar, valVar)` — objeto para array\n`merge(a, b)` — mesclar objetos\n\n**Tempo:**\n`time_now_utc()` — timestamp atual\n`time_since(t1, t2)` — diferenca\n\n**Sintaxe em rules:**\n`{{ expressao | funcao(@) }}`'
    },
    {
      front: 'Variaveis builtin mais importantes do Kyverno',
      back: '**Request:**\n`request.operation` — CREATE/UPDATE/DELETE\n`request.namespace` — namespace do recurso\n`request.object.*` — recurso novo\n`request.oldObject.*` — recurso antigo (UPDATE)\n`request.userInfo.username` — quem fez\n`request.userInfo.groups` — grupos\n\n**Images:**\n`images.containers.<name>.tag`\n`images.containers.<name>.registry`\n`images.initContainers.<name>.tag`\n\n**Foreach:**\n`element` — elemento corrente\n`elementIndex` — indice do elemento\n\n**SA do request:**\n`serviceAccountName`\n`serviceAccountNamespace`\n\n**Tempo:**\n`time_now_utc()`'
    },
    {
      front: 'patchStrategicMerge vs patchesJson6902',
      back: '**patchStrategicMerge:**\nYAML merge inteligente\n- Adicionar campos: suporte nativo\n- Modificar campos: suporte nativo\n- Remover campos: NAO suporta diretamente\n- Mais legivel\n- Ideal para 90% dos casos\n\n**patchesJson6902 (RFC 6902):**\nOperacoes explicitas:\n```\n- op: add\n  path: /path\n  value: x\n- op: replace\n  path: /path\n  value: y\n- op: remove\n  path: /path\n- op: move\n  from: /path1\n  path: /path2\n- op: copy\n  from: /path1\n  path: /path2\n```\nUsar quando:\n- Precisa REMOVER campo\n- Operacao de move/copy\n- Precisao em array por indice'
    },
    {
      front: 'Context em Kyverno — tipos e uso',
      back: '**configMap:**\nBusca dados de um ConfigMap\n```yaml\ncontext:\n  - name: myData\n    configMap:\n      name: config\n      namespace: default\n```\nUso: `{{ myData.data.key }}`\n\n**apiCall:**\nFaz chamada a API K8s\n```yaml\ncontext:\n  - name: pods\n    apiCall:\n      urlPath: /api/v1/namespaces/{{request.namespace}}/pods\n      jmesPath: items[*].metadata.name\n```\n\n**imageRegistry:**\nBusca metadados de imagem\n```yaml\ncontext:\n  - name: imageData\n    imageRegistry:\n      reference: "{{ element.image }}"\n```\n\n**variable:**\nVariavel computada\n```yaml\ncontext:\n  - name: isProduction\n    variable:\n      value: "{{ request.namespace == \'production\' }}"\n```'
    },
    {
      front: 'Generate: synchronize e cloneFrom',
      back: '**synchronize: true:**\nKyverno mantém o recurso gerado.\nSe deletado, re-cria automaticamente.\nRecurso "pertence" ao Kyverno.\n\n**synchronize: false:**\nKyverno cria uma vez e abandona.\nRecurso pode ser modificado livremente.\n\n**data (inline):**\n```yaml\ngenerate:\n  synchronize: true\n  kind: NetworkPolicy\n  name: default-deny\n  namespace: "{{ request.object.metadata.name }}"\n  data:\n    spec:\n      podSelector: {}\n      policyTypes: [Ingress]\n```\n\n**clone (de outro recurso):**\n```yaml\ngenerate:\n  synchronize: true\n  kind: Secret\n  name: registry-creds\n  namespace: "{{ request.object.metadata.name }}"\n  clone:\n    namespace: kyverno\n    name: registry-credentials\n```\nClona o Secret do namespace kyverno\npara o novo namespace.'
    }
  ],
  lab: {
    scenario: 'Voce precisa implementar policies de seguranca avancadas no cluster: bloquear imagens com tag latest, mutar pods para adicionar securityContext adequado, e gerar recursos de seguranca em novos namespaces.',
    objective: 'Aprender validate deny com JMESPath, mutate com foreach e preconditions, e generate com cloneFrom.',
    duration: '25-30 minutos',
    steps: [
      {
        title: 'Validate avancado — bloquear tag :latest com JMESPath',
        instruction: `Crie uma ClusterPolicy de validate usando deny conditions:
1. Bloquear Pods com containers usando tag :latest ou sem tag
2. Usar variavel builtin {{ images.containers.*.tag }}
3. Modo Enforce
4. Testar com um Pod usando imagem :latest e depois com versao especifica`,
        hints: [
          'images.containers.*.tag retorna um array com as tags de todos os containers',
          'Operador AnyIn verifica se algum elemento do array esta na lista de valores',
          'String vazia tambem deve ser bloqueada (imagem sem tag usa :latest implicito)'
        ],
        solution: `\`\`\`yaml
# deny-latest-tag.yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: deny-latest-tag
  annotations:
    policies.kyverno.io/title: Deny Latest Tag
    policies.kyverno.io/severity: high
spec:
  validationFailureAction: Enforce
  background: true
  rules:
    - name: check-image-tag
      match:
        any:
          - resources:
              kinds: [Pod]
      exclude:
        any:
          - resources:
              namespaces: [kube-system, kyverno]
      validate:
        message: "Tag ':latest' ou imagens sem tag nao sao permitidas. Use uma versao especifica (ex: nginx:1.25.0)."
        deny:
          conditions:
            any:
              - key: "{{ images.containers.*.tag }}"
                operator: AnyIn
                value:
                  - "latest"
                  - ""
\`\`\`

\`\`\`bash
kubectl apply -f deny-latest-tag.yaml

# Testar: deve ser BLOQUEADO
kubectl run test-latest --image=nginx:latest -n default
# Saida esperada: ERRO - admission webhook bloqueou

# Testar: deve PASSAR
kubectl run test-versioned --image=nginx:1.25.0 -n default
# Saida esperada: pod criado com sucesso
\`\`\``,
        verify: `\`\`\`bash
# Verificar policy ativa
kubectl get clusterpolicy deny-latest-tag
# Saida esperada: READY=true VALIDATIONACTION=Enforce

# Confirmar que pod com versao especifica foi criado
kubectl get pod test-versioned
# Saida esperada: Running

# Confirmar que pod latest foi bloqueado (nao deve existir)
kubectl get pod test-latest 2>&1
# Saida esperada: "not found" ou erro

# Ver o PolicyReport com detalhes
kubectl get policyreport -n default
# Saida esperada: entrada para deny-latest-tag

# Limpar
kubectl delete pod test-versioned -n default
\`\`\``
      },
      {
        title: 'Mutate com foreach e preconditions',
        instruction: `Crie uma policy de mutate para adicionar securityContext adequado:
1. Adicionar readOnlyRootFilesystem: true a containers que NAO tem securityContext.readOnlyRootFilesystem definido
2. Usar foreach para iterar sobre containers
3. Usar preconditions para so aplicar quando o campo nao existe
4. Testar que containers ja configurados nao sao modificados`,
        hints: [
          'foreach itera sobre request.object.spec.containers',
          'preconditions usam element.* para acessar o container corrente',
          'Para verificar se campo e nulo: operator: Equals, value: null'
        ],
        solution: `\`\`\`yaml
# mutate-security-context.yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: add-readonly-rootfs
spec:
  rules:
    - name: set-readonly-rootfs
      match:
        any:
          - resources:
              kinds: [Pod]
      exclude:
        any:
          - resources:
              namespaces: [kube-system, kyverno]
      mutate:
        foreach:
          - list: "request.object.spec.containers"
            preconditions:
              all:
                - key: "{{ element.securityContext.readOnlyRootFilesystem }}"
                  operator: Equals
                  value: null    # So adicionar se nao existe
            patchStrategicMerge:
              spec:
                containers:
                  - (name): "{{ element.name }}"
                    securityContext:
                      readOnlyRootFilesystem: true
                      allowPrivilegeEscalation: false
\`\`\`

\`\`\`bash
kubectl apply -f mutate-security-context.yaml

# Criar Pod sem securityContext — deve ser mutado
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: test-mutate-sc
  namespace: default
spec:
  containers:
    - name: app
      image: nginx:1.25.0
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verificar que o securityContext foi adicionado pelo mutate
kubectl get pod test-mutate-sc -o jsonpath='{.spec.containers[0].securityContext}'
# Saida esperada: {"allowPrivilegeEscalation":false,"readOnlyRootFilesystem":true}

# Ver YAML completo do pod
kubectl get pod test-mutate-sc -o yaml | grep -A5 "securityContext:"

# Criar Pod COM securityContext proprio — NAO deve ser alterado
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: test-no-mutate
  namespace: default
spec:
  containers:
    - name: app
      image: nginx:1.25.0
      securityContext:
        readOnlyRootFilesystem: false
        runAsUser: 1000
EOF

kubectl get pod test-no-mutate -o jsonpath='{.spec.containers[0].securityContext.readOnlyRootFilesystem}'
# Saida esperada: false (manteve o valor original)

# Limpar
kubectl delete pod test-mutate-sc test-no-mutate -n default
\`\`\``
      },
      {
        title: 'Generate com CloneFrom — clonar Secret para novos namespaces',
        instruction: `Configure geração automatica de Secrets em novos namespaces:
1. Criar um Secret "registry-credentials" no namespace kyverno como source
2. Criar ClusterPolicy que clona este Secret para todo novo namespace criado
3. Usar synchronize: true para manter em sincronia
4. Criar um namespace de teste e verificar que o Secret foi clonado automaticamente`,
        hints: [
          'O Secret source deve existir ANTES de criar a policy',
          'generate.clone referencia o namespace e name do recurso source',
          'synchronize: true garante que se o clone for deletado, sera re-criado'
        ],
        solution: `\`\`\`bash
# Criar Secret source no namespace kyverno
kubectl create secret docker-registry registry-credentials \\
  --docker-server=registry.acme.io \\
  --docker-username=deploy-user \\
  --docker-password=super-secret-token \\
  -n kyverno
\`\`\`

\`\`\`yaml
# generate-registry-secret.yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: clone-registry-secret
spec:
  rules:
    - name: clone-secret
      match:
        any:
          - resources:
              kinds: [Namespace]
      exclude:
        any:
          - resources:
              names:
                - kube-system
                - kube-public
                - kyverno
                - default
      generate:
        synchronize: true
        kind: Secret
        name: registry-credentials
        namespace: "{{ request.object.metadata.name }}"
        clone:
          namespace: kyverno
          name: registry-credentials
\`\`\`

\`\`\`bash
kubectl apply -f generate-registry-secret.yaml
kubectl create namespace team-beta
sleep 5
\`\`\``,
        verify: `\`\`\`bash
# Verificar que o Secret foi clonado automaticamente
kubectl get secret registry-credentials -n team-beta
# Saida esperada: Secret "registry-credentials" no namespace team-beta

# Verificar que e do tipo docker-registry
kubectl get secret registry-credentials -n team-beta -o jsonpath='{.type}'
# Saida esperada: kubernetes.io/dockerconfigjson

# Testar synchronize: deletar o clone e ver re-criacao
kubectl delete secret registry-credentials -n team-beta
sleep 10
kubectl get secret registry-credentials -n team-beta
# Saida esperada: Secret RE-CRIADO pelo Kyverno

# Verificar labels Kyverno no recurso gerado
kubectl get secret registry-credentials -n team-beta -o jsonpath='{.metadata.labels}'
# Saida esperada: labels incluindo generate.kyverno.io/policy-name

# Limpar
kubectl delete namespace team-beta
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'JMESPath expression retorna erro de sintaxe na rule',
      difficulty: 'medium',
      symptom: 'O ClusterPolicy foi criado mas fica com READY=False. O kubectl describe mostra erro de parsing na expressao JMESPath.',
      diagnosis: `\`\`\`bash
# 1. Verificar o status do ClusterPolicy
kubectl get clusterpolicy <nome> -o yaml | grep -A10 "status:"
# Procurar por "ready: false" e mensagem de erro

# 2. Verificar conditions do ClusterPolicy
kubectl describe clusterpolicy <nome> | grep -A10 "Conditions:"

# 3. Verificar logs do admission controller
kubectl logs -n kyverno \\
  -l app.kubernetes.io/component=admission-controller \\
  --tail=30 | grep -i "error\\|parse\\|jmespath"

# 4. Testar a expressao localmente com kyverno CLI
kyverno jp query -i resource.json -q "spec.containers[].image"
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Delimitadores duplos:** Expressoes JMESPath devem usar \`{{ }}\`. Se usar dentro de um campo YAML que ja tem aspas, pode dar conflito. Usar aspas simples externas: \`'{{ expression }}'\`.

2. **Caminho inexistente:** O caminho JMESPath aponta para campo que pode nao existir (ex: spec.initContainers quando Pod nao tem initContainers). Adicionar verificacao: \`| length(@) > \`0\`\`.

3. **Operador errado para o tipo:** Usar \`AnyIn\` com valor que nao e array. \`AnyIn\` compara array vs array. Para valor unico, usar \`Equals\`.

4. **Pipe (\`|\`) no YAML:** O caractere \`|\` em YAML significa bloco literal. Em JMESPath dentro de YAML, colocar em aspas: \`key: "{{ items | length(@) }}"\`.

5. **Funcao nao disponivel:** Verificar que a funcao existe no Kyverno (nao todas as funcoes JMESPath padrao estao disponiveis; Kyverno adiciona suas proprias).`
    },
    {
      title: 'Mutate foreach nao esta atualizando todos os containers',
      difficulty: 'hard',
      symptom: 'A policy de mutate com foreach esta sendo aplicada mas apenas o primeiro container recebe a modificacao. Os demais containers ficam sem o campo mutado.',
      diagnosis: `\`\`\`bash
# 1. Criar Pod com multiplos containers e verificar
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: multi-container-test
spec:
  containers:
    - name: app1
      image: nginx:1.25.0
    - name: app2
      image: redis:7.0
    - name: app3
      image: postgres:15
EOF

# 2. Verificar securityContext de cada container
kubectl get pod multi-container-test -o jsonpath='{.spec.containers[*].securityContext}'

# 3. Verificar se o patchStrategicMerge esta correto
# O seletor (name): deve usar wildcard
kubectl get clusterpolicy <nome> -o yaml | grep -A20 "foreach:"
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Seletor de container errado no patchStrategicMerge:** O patch usa \`- (name): "{{ element.name }}"\` mas isso pode nao funcionar se o campo name nao for reconhecido como seletor de merge. Verificar que o par \`(name)\` esta correto.

2. **patchesJson6902 com indice fixo:** Se usar patchesJson6902 com \`/spec/containers/0/\` apenas modifica o primeiro container. Para foreach, usar patchStrategicMerge com \`(name)\` como discriminador.

3. **Versao do Kyverno antiga:** foreach em mutate foi melhorado em versoes recentes. Verificar versao com \`kubectl get pods -n kyverno -o jsonpath='{.items[0].spec.containers[0].image}'\`.

4. **Estrutura do patchStrategicMerge incorreta:** A estrutura deve ser:
\`\`\`yaml
mutate:
  foreach:
    - list: "request.object.spec.containers"
      patchStrategicMerge:
        spec:
          containers:
            - (name): "{{ element.name }}"
              securityContext:
                readOnlyRootFilesystem: true
\`\`\`
O caminho completo \`spec.containers\` DEVE estar no patchStrategicMerge, mesmo dentro do foreach.`
    }
  ]
};
