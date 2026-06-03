window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['kyverno/kyverno-fundamentals'] = {
  theory: `
# Kyverno Fundamentals

## Relevancia
Kyverno e um Policy Engine nativo para Kubernetes — diferente do OPA/Gatekeeper, e escrito especificamente para K8s e usa YAML puro para definir policies (sem linguagem de programacao). E um projeto CNCF Graduated e amplamente adotado para seguranca e governanca de clusters. Essencial para qualquer track de seguranca ou platform engineering.

## Conceitos Fundamentais

### O que e Kyverno?

\`\`\`
Kyverno (grego: "governar") e um Policy Engine K8s-nativo:

                    ┌──────────────────────────────────┐
                    │         Kubernetes API Server     │
                    └──────────────┬───────────────────┘
                                   │ Admission Request
                    ┌──────────────▼───────────────────┐
                    │         Kyverno Webhook           │
                    │  ┌────────────────────────────┐  │
                    │  │    Policy Engine            │  │
                    │  │  ├─ Validate (aceitar/negar)│  │
                    │  │  ├─ Mutate (modificar)      │  │
                    │  │  ├─ Generate (criar novos)  │  │
                    │  │  └─ Verify Images (cosign)  │  │
                    │  └────────────────────────────┘  │
                    └──────────────────────────────────┘

Pontos chave:
- Policies em YAML puro (sem Rego, sem CEL especifico)
- CRDs: ClusterPolicy (cluster) e Policy (namespace)
- Background scanning para recursos existentes
- PolicyReports para auditoria
- CLI (kyverno) para testes locais
\`\`\`

### Tipos de Rules

| Tipo | Funcao | Momento |
|------|--------|---------|
| **validate** | Aceita ou rejeita recursos | Admission (mutating/validating webhook) |
| **mutate** | Modifica recursos ao criar/atualizar | Admission (mutating webhook) |
| **generate** | Cria novos recursos baseados em triggers | Post-admission |
| **verifyImages** | Verifica assinaturas de container images | Admission |

### Estrutura de um ClusterPolicy

\`\`\`yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy                  # cluster-wide (ou Policy para namespace)
metadata:
  name: require-labels
  annotations:
    policies.kyverno.io/title: Require Labels
    policies.kyverno.io/severity: medium    # low/medium/high/critical
    policies.kyverno.io/category: Best Practices
spec:
  # Como lidar com falhas do webhook
  failurePolicy: Fail                # Fail (default) ou Ignore
  # Modo: Enforce (bloqueia) ou Audit (apenas reporta)
  validationFailureAction: Enforce   # ou Audit
  background: true                   # Escanear recursos existentes
  rules:
    - name: check-for-labels         # Nome unico da rule
      match:
        any:
          - resources:
              kinds:
                - Deployment         # Tipos de recurso alvo
              namespaces:
                - "!kube-system"     # Excluir namespaces de sistema
      validate:
        message: "Deployment deve ter label 'app'."
        pattern:
          metadata:
            labels:
              app: "?*"              # Pattern: pelo menos 1 caracter
\`\`\`

### Match e Exclude — Escopo das Rules

\`\`\`yaml
spec:
  rules:
    - name: example
      match:
        any:                          # Qualquer um desses criterios
          - resources:
              kinds: [Deployment, StatefulSet]
              namespaces: ["production"]
              selector:
                matchLabels:
                  app: critical
        all:                          # Todos esses criterios
          - resources:
              operations: [CREATE, UPDATE]  # Apenas em criacao e update
      exclude:
        any:
          - resources:
              namespaces: ["kube-system", "kube-public"]
          - subjects:                 # Excluir usuarios/SAs especificos
              - kind: ServiceAccount
                name: system-admin
                namespace: kube-system
\`\`\`

### Validate — Padrao (pattern)

\`\`\`yaml
# Validar com pattern matching
validate:
  message: "Resources must have limits defined."
  pattern:
    spec:
      containers:
        - resources:
            limits:
              memory: "?*"
              cpu: "?*"

# Wildcards do Kyverno:
# ?* — pelo menos 1 caracter (nao vazio)
# *  — qualquer valor incluindo vazio
# ?  — exatamente 1 caracter
\`\`\`

### Validate — Deny com CEL/JMESPath

\`\`\`yaml
# Deny com condicao
validate:
  message: "Privileged containers are not allowed."
  deny:
    conditions:
      any:
        - key: "{{ request.object.spec.containers[].securityContext.privileged }}"
          operator: AnyIn
          value: [true]
\`\`\`

### Mutate — Adicionar campos

\`\`\`yaml
# Adicionar labels automaticamente
rules:
  - name: add-labels
    match:
      any:
        - resources:
            kinds: [Deployment]
    mutate:
      patchStrategicMerge:
        metadata:
          labels:
            managed-by: kyverno
            environment: "{{ request.namespace }}"
\`\`\`

\`\`\`yaml
# Adicionar default resource limits se nao definidos
rules:
  - name: add-default-limits
    match:
      any:
        - resources:
            kinds: [Pod]
    preconditions:
      all:
        - key: "{{ request.object.spec.containers[].resources.limits | length(@) }}"
          operator: Equals
          value: "0"
    mutate:
      foreach:
        - list: "request.object.spec.containers"
          patchStrategicMerge:
            spec:
              containers:
                - (name): "{{ element.name }}"
                  resources:
                    limits:
                      memory: 512Mi
                      cpu: 500m
\`\`\`

### Generate — Criar recursos automaticamente

\`\`\`yaml
# Criar NetworkPolicy padrao em todo namespace novo
rules:
  - name: default-deny-network
    match:
      any:
        - resources:
            kinds: [Namespace]
    generate:
      synchronize: true              # Manter sincronizado (re-criar se deletado)
      apiVersion: networking.k8s.io/v1
      kind: NetworkPolicy
      name: default-deny-all
      namespace: "{{ request.object.metadata.name }}"
      data:
        spec:
          podSelector: {}
          policyTypes:
            - Ingress
            - Egress
\`\`\`

### Instalacao do Kyverno

\`\`\`bash
# Via Helm (recomendado)
helm repo add kyverno https://kyverno.github.io/kyverno/
helm install kyverno kyverno/kyverno \\
  --namespace kyverno \\
  --create-namespace \\
  --set admissionController.replicas=3    # HA para producao

# Verificar instalacao
kubectl get pods -n kyverno
# Saida esperada:
# kyverno-admission-controller-xxx    Running
# kyverno-background-controller-xxx   Running
# kyverno-cleanup-controller-xxx      Running
# kyverno-reports-controller-xxx      Running

# Verificar CRDs instalados
kubectl get crds | grep kyverno
# ClusterPolicy, Policy, PolicyReport, ClusterPolicyReport, etc.
\`\`\`

### PolicyReport — Auditoria

\`\`\`yaml
# PolicyReports sao criados automaticamente pelo Kyverno
# para recursos que nao satisfazem policies em modo Audit

# Listar PolicyReports no namespace
kubectl get policyreport -n my-namespace

# Ver detalhes
kubectl describe policyreport cpol-require-labels -n my-namespace

# ClusterPolicyReport para recursos cluster-scoped
kubectl get clusterpolicyreport
\`\`\`

### Erros Comuns

1. **validationFailureAction Audit vs Enforce** — Em Audit, policies NAO bloqueiam; apenas geram PolicyReports. Para bloquear, usar Enforce.
2. **background: false** — Sem background scanning, policies so se aplicam a novos recursos, nao aos existentes.
3. **failurePolicy: Fail** — Se o Kyverno estiver down, admissions sao rejeitadas. Usar Ignore para nao-criticos em dev.
4. **Match muito amplo** — Match sem namespace filter pode afetar kube-system e quebrar o cluster. Sempre excluir namespaces de sistema.
5. **Pattern vs deny** — Pattern e mais simples para estrutura; deny com conditions e necessario para logica mais complexa.

## Killer.sh Style Challenge

> **Cenario:** Crie uma ClusterPolicy chamada \`require-resources\` que: (1) se aplica a Deployments e StatefulSets em todos os namespaces exceto kube-system e kube-public, (2) valida que todos os containers tem limits de CPU e memory definidos, (3) modo Enforce, (4) background scanning ativado. Teste com um Deployment sem limits.
`,
  quiz: [
    {
      question: 'Qual a diferenca entre ClusterPolicy e Policy no Kyverno?',
      options: [
        'ClusterPolicy e mais poderosa que Policy',
        'ClusterPolicy e cluster-scoped (se aplica a todos os namespaces); Policy e namespace-scoped (se aplica apenas ao seu namespace)',
        'Policy suporta mais tipos de rules que ClusterPolicy',
        'Nao ha diferenca — sao aliases'
      ],
      correct: 1,
      explanation: 'ClusterPolicy e um recurso cluster-scoped que pode se aplicar a qualquer namespace. Policy e um recurso namespace-scoped que so pode gerar policies dentro do seu proprio namespace. Para policies de seguranca globais, use sempre ClusterPolicy.',
      reference: 'Conceito relacionado: Administradores criam ClusterPolicies; times podem criar Policies no seu namespace.'
    },
    {
      question: 'Qual a diferenca entre validationFailureAction: Enforce e Audit?',
      options: [
        'Enforce e mais rapido que Audit',
        'Enforce bloqueia recursos que violam a policy; Audit apenas registra a violacao em PolicyReports sem bloquear',
        'Audit so funciona com background scanning',
        'Enforce so funciona em producao'
      ],
      correct: 1,
      explanation: 'Enforce: Kyverno rejeita o request de admission quando a policy e violada — o recurso nao e criado. Audit: o recurso e criado normalmente mas uma entrada e registrada no PolicyReport. Audit e util para detectar violacoes sem impactar workloads existentes.',
      reference: 'Conceito relacionado: Comece com Audit para validar o impacto antes de mover para Enforce.'
    },
    {
      question: 'O que significa o wildcard "?*" em um pattern Kyverno?',
      options: [
        'Qualquer valor, incluindo vazio',
        'Pelo menos um caracter (campo nao pode ser vazio ou ausente)',
        'Exatamente um caracter',
        'Um valor numerico positivo'
      ],
      correct: 1,
      explanation: '"?*" no Kyverno significa "pelo menos um caracter" — o campo deve existir e nao pode ser uma string vazia. E diferente de "*" (qualquer coisa incluindo vazio). Muito usado para validar que labels obrigatorios estao definidos.',
      reference: 'Conceito relacionado: Use "?*" para campos obrigatorios e ">=0" para valores numericos minimos.'
    },
    {
      question: 'Para que serve o campo background: true em uma ClusterPolicy?',
      options: [
        'Para executar a policy em background thread',
        'Para escanear recursos existentes no cluster e gerar PolicyReports, nao apenas novos recursos',
        'Para aplicar a policy apenas a workloads em background',
        'Para desabilitar o webhook e usar apenas scanning periodico'
      ],
      correct: 1,
      explanation: 'background: true (default) habilita o Background Controller do Kyverno para escanear recursos existentes e gerar PolicyReports. Sem isso, a policy so se aplica a novos recursos via admission webhook. Essencial para auditoria de estado atual do cluster.',
      reference: 'Conceito relacionado: Background scanning usa mais recursos do cluster. Desabilitar (false) para policies de mutacao que nao fazem sentido em recursos existentes.'
    },
    {
      question: 'Qual tipo de rule Kyverno cria automaticamente recursos novos quando um trigger acontece?',
      options: [
        'validate',
        'mutate',
        'generate',
        'verifyImages'
      ],
      correct: 2,
      explanation: 'generate cria novos recursos K8s baseados em eventos (ex: criar um Namespace dispara a criacao de uma NetworkPolicy padrao). Com synchronize: true, o Kyverno re-cria o recurso gerado se ele for deletado.',
      reference: 'Conceito relacionado: generate com synchronize: true garante que os recursos gerados permanecem em sincronia.'
    },
    {
      question: 'Qual e a diferenca entre failurePolicy: Fail e Ignore?',
      options: [
        'Fail e mais seguro para producao',
        'failurePolicy define o que acontece quando o WEBHOOK KYVERNO falha (nao quando a policy falha). Fail rejeita o admission; Ignore permite passar.',
        'Ignore e equivalente a Audit mode',
        'Fail aplica a policy a todos os recursos; Ignore so aplica a novos'
      ],
      correct: 1,
      explanation: 'failurePolicy controla o comportamento quando o WEBHOOK falha (Kyverno nao responde, timeout, etc.) — nao quando a policy valida False. Fail: admissions sao rejeitadas se o webhook nao responder. Ignore: admissions sao permitidas se o webhook nao responder. Use Fail para policies criticas de seguranca.',
      reference: 'Conceito relacionado: Para HA em producao, use replicas=3 no admission controller para minimizar falhas.'
    },
    {
      question: 'Como o Kyverno e diferente do OPA/Gatekeeper como policy engine?',
      options: [
        'Kyverno e menos poderoso que OPA',
        'Kyverno usa YAML puro nativo ao K8s (sem linguagem especial); OPA usa Rego. Kyverno suporta mutate e generate nativamente; OPA/Gatekeeper foca em validate.',
        'OPA suporta background scanning; Kyverno nao',
        'Kyverno so funciona em EKS'
      ],
      correct: 1,
      explanation: 'Kyverno: YAML puro, curva de aprendizado baixa, suporta validate/mutate/generate/verifyImages nativamente, nativo ao K8s. OPA/Gatekeeper: Rego (linguagem funcional poderosa mas complexa), foco em validate, mais flexivel para logica complexa. Kyverno e preferido para times sem experiencia em Rego.',
      reference: 'Conceito relacionado: CEL policies no K8s nativo e outra alternativa, sem webhook externo.'
    }
  ],
  flashcards: [
    {
      front: 'Quais sao os 4 tipos de rules Kyverno?',
      back: '**validate** — Aceita ou rejeita recursos\n- Pattern matching ou deny conditions\n- Modo: Enforce (bloqueia) ou Audit (reporta)\n\n**mutate** — Modifica recursos\n- patchStrategicMerge: merge YAML\n- patchesJson6902: JSON Patch RFC\n- foreach: para listas de containers\n\n**generate** — Cria novos recursos\n- Trigger: criacao de Namespace, etc.\n- synchronize: true re-cria se deletado\n\n**verifyImages** — Valida assinaturas\n- Integra com cosign/notary\n- Verifica imagens antes de criar Pods\n\n**Ordem de execucao:**\n1. Mutate (modifica)\n2. Validate (aceita/rejeita)\n3. Generate (cria novos)\n4. VerifyImages (valida imagens)'
    },
    {
      front: 'Estrutura basica de um ClusterPolicy Kyverno',
      back: '\`\`\`yaml\napiVersion: kyverno.io/v1\nkind: ClusterPolicy\nmetadata:\n  name: nome-da-policy\nspec:\n  validationFailureAction: Enforce # Audit\n  background: true\n  failurePolicy: Fail  # Ignore\n  rules:\n    - name: nome-da-rule\n      match:\n        any:\n          - resources:\n              kinds: [Deployment]\n              namespaces: ["!kube-system"]\n      exclude:\n        any:\n          - resources:\n              namespaces: [kube-public]\n      validate:  # mutate / generate\n        message: "Mensagem de erro"\n        pattern:\n          metadata:\n            labels:\n              app: "?*"\n\`\`\`'
    },
    {
      front: 'Wildcards de pattern matching no Kyverno',
      back: '**"?*"** — Pelo menos 1 caracter\n(campo obrigatorio, nao vazio)\nEx: label deve existir com valor\n\n**"*"** — Qualquer coisa ou vazio\n(campo pode existir com qualquer valor)\n\n**"?"** — Exatamente 1 caracter\n\n**Operadores numericos:**\n- ">=256Mi" — memoria minima\n- "<=2" — maximo\n- ">0" — positivo\n\n**Operators em deny conditions:**\n- Equals, NotEquals\n- GreaterThan, LessThan\n- AnyIn, AllIn, AnyNotIn\n- Contains, NotContains\n\n**Negacao em namespaces:**\n- "!kube-system" — excluir\n- "production" — incluir'
    },
    {
      front: 'Como funciona o generate com synchronize?',
      back: '**O que faz:**\nCria novos recursos K8s quando\num evento trigger ocorre.\n\n**synchronize: true:**\n- Kyverno MONITORA o recurso gerado\n- Se for deletado manualmente,\n  Kyverno o RE-CRIA automaticamente\n- O recurso "pertence" ao Kyverno\n\n**synchronize: false (default):**\n- Kyverno cria o recurso uma vez\n- Se for deletado, nao re-cria\n- O recurso pode ser modificado livremente\n\n**Casos de uso comuns:**\n- NetworkPolicy padrao em novos Namespaces\n- Secret de registry em novos Namespaces\n- LimitRange e ResourceQuota\n- ConfigMaps de configuracao base\n\n**CloneFrom (copiar de recurso existente):**\n\`\`\`yaml\ngenerate:\n  cloneFrom:\n    namespace: default\n    name: registry-secret\n\`\`\`'
    },
    {
      front: 'PolicyReport e ClusterPolicyReport — o que sao?',
      back: '**PolicyReport:**\nRecurso namespace-scoped criado pelo\nKyverno Background Controller.\n\nContem: lista de recursos que violam\npolicies em modo Audit.\n\n**ClusterPolicyReport:**\nRecurso cluster-scoped para\nrecursos cluster-scoped (Namespaces, etc.)\n\n**Campos importantes:**\n- summary.pass/fail/warn/error/skip\n- results[].policy: nome da policy violada\n- results[].resource: recurso que violou\n- results[].message: descricao da violacao\n- results[].status: pass/fail/warn\n\n**Ver reports:**\n\`\`\`bash\nkubectl get policyreport -A\nkubectl get clusterpolicyreport\n# Ferramentas: Policy Reporter UI\n\`\`\`'
    },
    {
      front: 'Como instalar e verificar o Kyverno?',
      back: '**Instalacao Helm (producao):**\n\`\`\`bash\nhelm repo add kyverno \\\n  https://kyverno.github.io/kyverno/\nhelm install kyverno kyverno/kyverno \\\n  --namespace kyverno \\\n  --create-namespace \\\n  --set admissionController.replicas=3\n\`\`\`\n\n**4 componentes principais:**\n1. admission-controller: webhook\n2. background-controller: scan existentes\n3. cleanup-controller: limpar gerados\n4. reports-controller: PolicyReports\n\n**Verificar saude:**\n\`\`\`bash\nkubectl get pods -n kyverno\nkubectl get crds | grep kyverno.io\nkubectl get clusterpolicies\n\`\`\`\n\n**Testar com kyverno CLI:**\n\`\`\`bash\nkyverno apply policy.yaml \\\n  --resource resource.yaml\n\`\`\`'
    },
    {
      front: 'match/exclude em ClusterPolicy — como funcionar o escopo?',
      back: '**match.any:** OR — qualquer criterio basta\n**match.all:** AND — todos devem ser verdadeiros\n\n**Criterios disponiveis:**\n- resources.kinds: tipos K8s\n- resources.namespaces: namespaces\n- resources.operations: CREATE/UPDATE/DELETE/CONNECT\n- resources.selector: label selectors\n- resources.annotations: annotation filters\n- subjects: usuarios/grupos/SAs\n- clusterRoles: roles do usuario\n\n**Exclude segue a mesma estrutura**\nExclui recursos que correspondem\nao criterio de exclude.\n\n**Dica:** Sempre excluir kube-system:\n\`\`\`yaml\nexclude:\n  any:\n    - resources:\n        namespaces:\n          - kube-system\n          - kube-public\n\`\`\`'
    }
  ],
  lab: {
    scenario: 'Voce e responsavel pela governanca de um cluster Kubernetes. Precisa implementar politicas basicas de seguranca e boas praticas usando Kyverno.',
    objective: 'Instalar Kyverno e criar policies de validate e mutate para governanca do cluster.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Instalar Kyverno',
        instruction: `Instale o Kyverno no cluster:
1. Adicionar o repositorio Helm do Kyverno
2. Instalar em modo standalone (1 replica para lab)
3. Verificar que todos os 4 componentes estao rodando
4. Listar os CRDs instalados pelo Kyverno`,
        hints: [
          'Use o repositorio https://kyverno.github.io/kyverno/',
          'Para lab use replicas=1; para producao use replicas=3',
          'Aguardar todos os pods ficarem Running antes de prosseguir'
        ],
        solution: `\`\`\`bash
# Adicionar repositorio
helm repo add kyverno https://kyverno.github.io/kyverno/
helm repo update

# Instalar Kyverno (modo lab com 1 replica)
helm install kyverno kyverno/kyverno \\
  --namespace kyverno \\
  --create-namespace \\
  --set admissionController.replicas=1 \\
  --set backgroundController.replicas=1 \\
  --set cleanupController.replicas=1 \\
  --set reportsController.replicas=1

# Aguardar pods ficarem prontos
kubectl wait --for=condition=Ready pods --all -n kyverno --timeout=120s
\`\`\``,
        verify: `\`\`\`bash
# Verificar todos os pods rodando
kubectl get pods -n kyverno
# Saida esperada: 4 pods em Running state
# kyverno-admission-controller-xxx
# kyverno-background-controller-xxx
# kyverno-cleanup-controller-xxx
# kyverno-reports-controller-xxx

# Verificar CRDs instalados
kubectl get crds | grep kyverno.io | head -10
# Saida esperada: clusterpolicies, policies, policyreports, etc.

# Verificar webhooks configurados
kubectl get validatingwebhookconfigurations | grep kyverno
kubectl get mutatingwebhookconfigurations | grep kyverno
# Saida esperada: webhooks kyverno registrados
\`\`\``
      },
      {
        title: 'Criar uma policy de Validate',
        instruction: `Crie uma ClusterPolicy para exigir labels obrigatorios:
1. Policy chamada require-app-label
2. Se aplica a todos Deployments exceto kube-system e kube-public
3. Valida que o label "app" existe com valor nao-vazio
4. Modo Audit (nao bloquear ainda)
5. Testar criando um Deployment sem label e verificar o PolicyReport`,
        hints: [
          'Use "?*" como pattern para campo obrigatorio nao-vazio',
          'Usar Audit primeiro para nao bloquear workloads existentes',
          'kubectl get policyreport -A mostra violacoes'
        ],
        solution: `\`\`\`yaml
# require-app-label.yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-app-label
  annotations:
    policies.kyverno.io/title: Require App Label
    policies.kyverno.io/severity: medium
    policies.kyverno.io/category: Best Practices
spec:
  validationFailureAction: Audit
  background: true
  rules:
    - name: check-app-label
      match:
        any:
          - resources:
              kinds:
                - Deployment
      exclude:
        any:
          - resources:
              namespaces:
                - kube-system
                - kube-public
      validate:
        message: "Deployment deve ter o label 'app' definido."
        pattern:
          metadata:
            labels:
              app: "?*"
\`\`\`

\`\`\`bash
kubectl apply -f require-app-label.yaml

# Criar Deployment SEM o label para testar
kubectl create deployment test-no-label --image=nginx -n default

# Aguardar background scan (pode demorar 30s-1min)
sleep 30
\`\`\``,
        verify: `\`\`\`bash
# Verificar policy criada
kubectl get clusterpolicy require-app-label
# Saida esperada: READY=true VALIDATIONACTION=Audit

# Verificar PolicyReport gerado para o namespace
kubectl get policyreport -n default
# Saida esperada: policyreport com FAIL > 0

# Ver detalhes das violacoes
kubectl describe policyreport -n default | grep -A5 "Status: fail"
# Saida esperada: resultado apontando para test-no-label

# Tentar criar Deployment SEM label em Enforce mode (mudar para testar)
kubectl patch clusterpolicy require-app-label --type='merge' \\
  -p '{"spec":{"validationFailureAction":"Enforce"}}'

kubectl create deployment test-blocked --image=nginx -n default
# Saida esperada: ERRO - admission webhook negou o request

# Limpar
kubectl delete deployment test-no-label test-blocked -n default 2>/dev/null || true
kubectl patch clusterpolicy require-app-label --type='merge' \\
  -p '{"spec":{"validationFailureAction":"Audit"}}'
\`\`\``
      },
      {
        title: 'Criar uma policy de Mutate e Generate',
        instruction: `Crie policies de Mutate e Generate:
1. Mutate: adicionar label "managed-by: kyverno" automaticamente a todos os Deployments
2. Generate: criar uma NetworkPolicy default-deny-all em todo novo Namespace
3. Testar criando um Deployment e um Namespace
4. Verificar que os recursos foram mutados/gerados automaticamente`,
        hints: [
          'patchStrategicMerge e a forma mais simples de adicionar campos',
          'generate com synchronize: true re-cria a NetworkPolicy se deletada',
          'O namespace do recurso gerado deve ser o nome do Namespace criado'
        ],
        solution: `\`\`\`yaml
# mutate-add-label.yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: add-managed-by-label
spec:
  rules:
    - name: add-label
      match:
        any:
          - resources:
              kinds: [Deployment]
      mutate:
        patchStrategicMerge:
          metadata:
            labels:
              managed-by: kyverno
---
# generate-netpol.yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: default-deny-network
spec:
  rules:
    - name: create-default-deny
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
        apiVersion: networking.k8s.io/v1
        kind: NetworkPolicy
        name: default-deny-all
        namespace: "{{ request.object.metadata.name }}"
        data:
          spec:
            podSelector: {}
            policyTypes:
              - Ingress
              - Egress
\`\`\`

\`\`\`bash
kubectl apply -f mutate-add-label.yaml
kubectl apply -f generate-netpol.yaml

# Testar mutate
kubectl create deployment test-mutate --image=nginx -n default

# Testar generate
kubectl create namespace test-kyverno
sleep 5
\`\`\``,
        verify: `\`\`\`bash
# Verificar label adicionado pelo mutate
kubectl get deployment test-mutate -n default -o jsonpath='{.metadata.labels.managed-by}'
# Saida esperada: kyverno

# Verificar NetworkPolicy gerada no novo namespace
kubectl get networkpolicy -n test-kyverno
# Saida esperada: default-deny-all

kubectl describe networkpolicy default-deny-all -n test-kyverno
# Saida esperada: policyTypes Ingress e Egress, podSelector vazio

# Testar synchronize: deletar e ver re-criacao
kubectl delete networkpolicy default-deny-all -n test-kyverno
sleep 10
kubectl get networkpolicy -n test-kyverno
# Saida esperada: default-deny-all RE-CRIADO pelo Kyverno

# Limpar
kubectl delete deployment test-mutate -n default
kubectl delete namespace test-kyverno
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Policy em Enforce mode nao esta bloqueando recursos',
      difficulty: 'easy',
      symptom: 'A ClusterPolicy esta configurada com validationFailureAction: Enforce mas recursos invalidos continuam sendo criados sem erro.',
      diagnosis: `\`\`\`bash
# 1. Verificar o status da policy
kubectl get clusterpolicy <nome>
# Verificar coluna READY e VALIDATIONACTION

# 2. Verificar se a policy esta valida
kubectl describe clusterpolicy <nome> | grep -A5 "Conditions:"
# Procurar por Ready=True

# 3. Verificar se o webhook esta ativo
kubectl get validatingwebhookconfiguration | grep kyverno
kubectl describe validatingwebhookconfiguration kyverno-resource-validating-webhook-cfg

# 4. Verificar se o recurso se encaixa no match
kubectl get clusterpolicy <nome> -o yaml | grep -A20 "match:"

# 5. Verificar logs do admission controller
kubectl logs -n kyverno -l app.kubernetes.io/component=admission-controller --tail=20
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Policy nao Ready:** Se READY=False, a policy tem erro de sintaxe. Verificar kubectl describe e corrigir o YAML.

2. **Match nao corresponde:** O recurso nao se encaixa nos criterios de match. Verificar kinds, namespaces, e operations. Usar kyverno CLI para testar: \`kyverno apply policy.yaml --resource resource.yaml\`.

3. **Namespace excluido:** O recurso esta em um namespace excluido pela policy. Verificar a secao exclude.

4. **Kyverno down:** Se o Kyverno estiver com problemas e failurePolicy: Ignore, recursos passam. Verificar kubectl get pods -n kyverno.

5. **Policy em modo Audit:** Verificar se validationFailureAction realmente esta como Enforce (nao Audit).`
    },
    {
      title: 'Generate nao esta criando recursos em namespaces existentes',
      difficulty: 'medium',
      symptom: 'Criou uma policy de generate para criar NetworkPolicy em novos Namespaces. Funciona para Namespaces novos mas os existentes nao tem a NetworkPolicy.',
      diagnosis: `\`\`\`bash
# 1. Verificar a policy
kubectl get clusterpolicy default-deny-network -o yaml | grep -A5 "generate:"

# 2. Verificar se ha PolicyReports para namespaces existentes
kubectl get policyreport -A | grep -i network

# 3. Verificar logs do background controller
kubectl logs -n kyverno \\
  -l app.kubernetes.io/component=background-controller \\
  --tail=20

# 4. Verificar se o trigger e apenas Namespace (nao se aplica retroativamente)
kubectl describe clusterpolicy default-deny-network | grep -A10 "Match:"
\`\`\``,
      solution: `**Explicacao e solucao:**

O generate com trigger em criacao de Namespace so dispara para NOVOS Namespaces criados APOS a policy existir. Namespaces existentes nao disparam o trigger.

**Solucao para namespaces existentes:**

1. **Aplicar manualmente:** Criar a NetworkPolicy em cada namespace existente via kubectl apply.

2. **Script de bootstrap:**
\`\`\`bash
for ns in \$(kubectl get namespaces -o jsonpath='{.items[*].metadata.name}'); do
  kubectl apply -f networkpolicy.yaml -n \$ns 2>/dev/null || true
done
\`\`\`

3. **Re-criar namespaces** (impraticavel em producao): Deletar e re-criar o namespace dispara o generate.

4. **Usar generate com cloneFrom** de um namespace source e re-aplicar periodicamente.

**Prevencao futura:** A policy de generate protege novos namespaces automaticamente. Para estado inicial, use IaC (GitOps) para garantir que todos os namespaces sao criados com os recursos necessarios.`
    }
  ]
};
