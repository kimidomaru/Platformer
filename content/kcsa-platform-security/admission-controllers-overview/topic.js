window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['kcsa-platform-security/admission-controllers-overview'] = {
  theory: `# Admission Controllers Overview

## Relevância no Exame
> KCSA — Platform Security (16%). Admission controllers são o mecanismo primário de enforcement de políticas em Kubernetes. O KCSA foca em entender o fluxo de admissão, tipos de webhooks, e ferramentas como OPA/Gatekeeper e Kyverno.

## O que são Admission Controllers?

Admission controllers são plugins que interceptam requisições à API do Kubernetes **após autenticação e autorização**, mas **antes da persistência no etcd**. São a última linha de defesa para garantir que apenas objetos válidos e seguros sejam criados.

### Fluxo de uma Requisição à API

\`\`\`
kubectl apply -f pod.yaml
        ↓
[1] Autenticação (quem é você?)
        ↓
[2] Autorização / RBAC (pode fazer isso?)
        ↓
[3] Admission Controllers ← AQUI
        ├── Mutating Admission Webhooks (modificam)
        ├── Validating Admission Webhooks (validam)
        ↓
[4] Persistência no etcd
        ↓
[5] Controllers/Schedulers processam
\`\`\`

### Tipos de Admission Controllers

| Tipo | Função | Exemplo |
|------|--------|---------|
| **Mutating** | Modificam o objeto antes de persistir | Injetar sidecar, adicionar labels |
| **Validating** | Aceitam ou rejeitam sem modificar | Bloquear imagens sem assinatura |
| **Hybrid** | Fazem ambos | PSA (Pod Security Admission) |

**Ordem de execução**: Mutating → Validating. Todos os Mutating precisam rodar antes dos Validating (pois os validadores precisam ver o estado final do objeto).

## Admission Controllers Nativos do Kubernetes

\`\`\`bash
# Ver admission plugins habilitados no kube-apiserver
kubectl get pod kube-apiserver-<node> -n kube-system -o yaml | \\
  grep -A1 enable-admission-plugins
\`\`\`

| Plugin | Tipo | Função |
|--------|------|--------|
| **NodeRestriction** | Validating | Kubelet só pode acessar seus próprios Pods/Node |
| **PodSecurity** | Validating | Enforça Pod Security Standards (PSS) |
| **AlwaysPullImages** | Mutating | Força pull sempre (nunca usar cache) |
| **ServiceAccount** | Mutating | Auto-monta token do SA padrão |
| **ResourceQuota** | Validating | Enforça quotas de namespace |
| **LimitRanger** | Mutating | Aplica limits/requests padrão |
| **NamespaceLifecycle** | Validating | Bloqueia criar recursos em namespaces terminando |
| **MutatingAdmission Webhook** | Mutating | Delega para webhooks externos |
| **ValidatingAdmission Webhook** | Validating | Delega para webhooks externos |

## Dynamic Admission Control: Webhooks

Webhooks permitem estender o admission sem modificar o kube-apiserver. O cluster envia requisições HTTPS para um serviço externo que decide permitir/modificar/rejeitar.

### MutatingWebhookConfiguration

\`\`\`yaml
apiVersion: admissionregistration.k8s.io/v1
kind: MutatingWebhookConfiguration
metadata:
  name: sidecar-injector
webhooks:
- name: sidecar.injection.example.com
  clientConfig:
    service:
      name: sidecar-injector-svc
      namespace: injection-system
      path: "/mutate"
    caBundle: <base64-encoded-CA>  # CA do servidor webhook
  rules:
  - operations: ["CREATE"]
    apiGroups: [""]
    apiVersions: ["v1"]
    resources: ["pods"]
  admissionReviewVersions: ["v1"]
  sideEffects: None
  failurePolicy: Fail  # Rejeitar se webhook estiver down
  namespaceSelector:   # Apenas namespaces com este label
    matchLabels:
      sidecar-injection: enabled
\`\`\`

### ValidatingWebhookConfiguration

\`\`\`yaml
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingWebhookConfiguration
metadata:
  name: policy-validator
webhooks:
- name: validate.policies.example.com
  clientConfig:
    service:
      name: policy-validator-svc
      namespace: policy-system
      path: "/validate"
    caBundle: <base64-encoded-CA>
  rules:
  - operations: ["CREATE", "UPDATE"]
    apiGroups: [""]
    apiVersions: ["v1"]
    resources: ["pods"]
  admissionReviewVersions: ["v1"]
  sideEffects: None
  failurePolicy: Fail
\`\`\`

### failurePolicy: Fail vs Ignore

\`\`\`
failurePolicy: Fail   → Se webhook estiver down/timeout: REJEITA a requisição
                        Mais seguro, mas pode causar indisponibilidade
failurePolicy: Ignore → Se webhook estiver down/timeout: PERMITE a requisição
                        Menos seguro, mas mais disponível
\`\`\`

**Regra geral de segurança**: use \`Fail\` para políticas de segurança críticas. Use \`Ignore\` para webhooks não críticos (logging, labeling).

## OPA/Gatekeeper

Open Policy Agent (OPA) é um engine de policy genérico. Gatekeeper é sua integração específica com Kubernetes.

### Arquitetura do Gatekeeper

\`\`\`
ConstraintTemplate  →  Define o schema da política (CRD customizado)
      ↓
  Constraint        →  Instância da política com parâmetros
      ↓
  Gatekeeper        →  Evalua policies usando OPA/Rego
      ↓
AdmissionWebhook   →  Gatekeeper é um ValidatingWebhook
\`\`\`

### Exemplo: Bloquear imagens privilegiadas

\`\`\`yaml
# 1. ConstraintTemplate — define o tipo de política
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8sdenyprivileged
spec:
  crd:
    spec:
      names:
        kind: K8sDenyPrivileged
  targets:
  - target: admission.k8s.gatekeeper.sh
    rego: |
      package k8sdenyprivileged

      violation[{"msg": msg}] {
        container := input.review.object.spec.containers[_]
        container.securityContext.privileged == true
        msg := sprintf("Container '%v' não pode ser privilegiado", [container.name])
      }

      violation[{"msg": msg}] {
        container := input.review.object.spec.initContainers[_]
        container.securityContext.privileged == true
        msg := sprintf("initContainer '%v' não pode ser privilegiado", [container.name])
      }
---
# 2. Constraint — instância da política
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sDenyPrivileged
metadata:
  name: deny-privileged-containers
spec:
  match:
    kinds:
    - apiGroups: [""]
      kinds: ["Pod"]
    excludedNamespaces:
    - kube-system  # Excluir namespaces do sistema
  enforcementAction: deny  # deny | warn | dryrun
\`\`\`

### Rego: Linguagem de Policy do OPA

\`\`\`rego
# Estrutura básica de uma regra Rego
package <nome>

# "violation" é o ponto de entrada para Gatekeeper
violation[{"msg": msg}] {
  # Condições: todas devem ser verdadeiras (AND implícito)
  input.review.object.spec.containers[_].securityContext.privileged == true
  msg := "Container privilegiado não permitido"
}

# Variáveis:
# input.review.object = o recurso sendo criado/modificado
# input.review.operation = CREATE, UPDATE, DELETE
# input.parameters = parâmetros da Constraint
# _ = iteração sobre todos os elementos de um array
\`\`\`

## Kyverno

Kyverno é um policy engine específico para Kubernetes — não requer aprender Rego.

### Tipos de Regras Kyverno

| Tipo | Ação | Exemplo |
|------|------|---------|
| **validate** | Rejeita ou alerta | Exigir requests/limits |
| **mutate** | Modifica o objeto | Adicionar labels padrão |
| **generate** | Cria novos recursos | NetworkPolicy padrão para namespace |
| **verifyImages** | Verifica assinaturas | Cosign signing verification |

### Exemplo: ClusterPolicy completa

\`\`\`yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-security-context
spec:
  validationFailureAction: Enforce  # Enforce | Audit
  background: true                  # Aplicar a recursos existentes
  rules:

  # Regra 1: Validate — Exigir runAsNonRoot
  - name: require-run-as-non-root
    match:
      resources:
        kinds: ["Pod"]
    exclude:
      resources:
        namespaces: ["kube-system", "monitoring"]
    validate:
      message: "Pods devem rodar como non-root (runAsNonRoot: true)"
      pattern:
        spec:
          securityContext:
            runAsNonRoot: true

  # Regra 2: Mutate — Adicionar label padrão
  - name: add-default-labels
    match:
      resources:
        kinds: ["Pod"]
    mutate:
      patchStrategicMerge:
        metadata:
          labels:
            managed-by: platform-team

  # Regra 3: Validate — Proibir imagens latest
  - name: disallow-latest-tag
    match:
      resources:
        kinds: ["Pod"]
    validate:
      message: "Tag 'latest' não é permitida. Use uma versão específica."
      foreach:
      - list: "request.object.spec.containers"
        deny:
          conditions:
            any:
            - key: "{{ element.image }}"
              operator: EndsWith
              value: ":latest"
            - key: "{{ element.image }}"
              operator: NotContains
              value: ":"
\`\`\`

### validationFailureAction: Enforce vs Audit

\`\`\`
Enforce → Rejeita a requisição (Pod não é criado)
          Usar em produção quando a política está estável

Audit   → Permite mas gera PolicyReport com violations
          Usar para validar política sem impactar produção
\`\`\`

### PolicyReport — Verificando violações

\`\`\`bash
# Ver relatório de violações (gerado pelo Kyverno)
kubectl get policyreport -A
kubectl get clusterpolicyreport

# Ver detalhes de uma violação
kubectl describe policyreport cpol-report -n production
\`\`\`

## PSA (Pod Security Admission) — Built-in

PSA é o substituto do PSP (removido em K8s 1.25), embutido no Kubernetes sem dependências externas.

\`\`\`yaml
# Ativar PSA por namespace via labels
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    # Enforce: rejeita pods não conformes
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/enforce-version: latest
    # Audit: gera evento no audit log para não conformes
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/audit-version: latest
    # Warn: alerta o usuário mas permite o pod
    pod-security.kubernetes.io/warn: restricted
    pod-security.kubernetes.io/warn-version: latest
\`\`\`

## Comparação: OPA/Gatekeeper vs Kyverno vs PSA

| Aspecto | OPA/Gatekeeper | Kyverno | PSA |
|---------|---------------|---------|-----|
| Linguagem | Rego (curva de aprendizado) | YAML nativo K8s | Nenhuma (labels) |
| Flexibilidade | Máxima | Alta | Baixa (apenas 3 levels) |
| Casos de uso | Enterprise, complexo | Médio/alto | Básico |
| Mutação | Via webhook separado | Sim, embutido | Não |
| Geração | Não | Sim | Não |
| Curva aprendizado | Alta | Baixa | Mínima |
| CNCF Graduated | Sim (OPA) | Sim | N/A (built-in) |

## Erros Comuns

1. **failurePolicy: Ignore em políticas críticas** — webhook down = política ignorada
2. **Não excluir kube-system** das políticas — quebra componentes do sistema
3. **ConstraintTemplate com Rego incorreto** — policy nunca aplica (sem erro visível)
4. **Não testar em Audit mode antes de Enforce** — quebra workloads em produção
5. **caBundle errado no webhook** — TLS failure, todas requisições rejeitadas

## Killer.sh Style Challenge

> **Cenário**: O cluster tem um ValidatingWebhookConfiguration com \`failurePolicy: Ignore\`. A equipe de segurança quer garantir que se o webhook cair, pods não conformes sejam bloqueados. Corrija a política e adicione uma regra Kyverno que proíba containers sem \`resources.limits.memory\` definido.
`,
  quiz: [
    {
      question: 'Em qual fase do processamento de uma requisição à API os Admission Controllers atuam?',
      options: [
        'Antes da autenticação — como primeiro filtro',
        'Após autenticação e autorização, mas antes da persistência no etcd',
        'Após a persistência no etcd, como validação pós-criação',
        'Simultaneamente com a autorização RBAC'
      ],
      correct: 1,
      explanation: 'O fluxo é: Autenticação → Autorização → Admission Controllers → etcd. Os admission controllers vêm APÓS o RBAC verificar se o usuário tem permissão, mas ANTES de o objeto ser persistido. Isso permite que eles modifiquem (mutating) ou rejeitem (validating) objetos que passaram pela autorização.',
      reference: 'Veja o diagrama "Fluxo de uma Requisição à API" na teoria — memorize esta sequência para o KCSA.'
    },
    {
      question: 'Qual é a diferença entre `failurePolicy: Fail` e `failurePolicy: Ignore` em um webhook?',
      options: [
        'Fail silencia erros, Ignore os registra no audit log',
        'Fail rejeita requisições quando o webhook está down, Ignore permite mesmo sem resposta do webhook',
        'Fail aplica a todos os namespaces, Ignore apenas aos selecionados',
        'Fail funciona apenas para ValidatingWebhooks, Ignore apenas para MutatingWebhooks'
      ],
      correct: 1,
      explanation: 'Com `failurePolicy: Fail`, se o servidor do webhook estiver indisponível ou der timeout, a requisição é REJEITADA — mais seguro. Com `failurePolicy: Ignore`, se o webhook falhar, a requisição é PERMITIDA — menos seguro mas mais disponível. Para políticas de segurança críticas, sempre use `Fail`.',
      reference: 'Veja "failurePolicy: Fail vs Ignore" na teoria — esta é uma pegadinha comum no exame sobre disponibilidade vs segurança.'
    },
    {
      question: 'Em Gatekeeper/OPA, qual é a relação entre ConstraintTemplate e Constraint?',
      options: [
        'São sinônimos — ConstraintTemplate e Constraint fazem a mesma coisa',
        'ConstraintTemplate define o schema/lógica (tipo), Constraint é uma instância com parâmetros específicos',
        'ConstraintTemplate aplica a namespaces, Constraint aplica ao cluster',
        'ConstraintTemplate usa YAML, Constraint usa Rego'
      ],
      correct: 1,
      explanation: 'ConstraintTemplate define o tipo de política — cria um novo CRD e contém a lógica Rego. É como uma classe. Constraint é uma instância desse CRD — especifica onde aplicar (matchLabels, namespaces) e parâmetros concretos (ex: lista de registries aprovados). É como um objeto da classe.',
      reference: 'Veja "OPA/Gatekeeper" → "Arquitetura do Gatekeeper" — o relacionamento Template→Constraint é fundamental para o KCSA.'
    },
    {
      question: 'Qual é a vantagem do Kyverno sobre OPA/Gatekeeper para times com menor expertise em policy languages?',
      options: [
        'Kyverno é mais rápido em performance de admissão',
        'Kyverno usa YAML nativo de Kubernetes, sem necessidade de aprender Rego',
        'Kyverno é gratuito enquanto OPA/Gatekeeper requer licença comercial',
        'Kyverno não precisa de instalação — já vem embutido no Kubernetes'
      ],
      correct: 1,
      explanation: 'Kyverno usa YAML puro com uma sintaxe familiar para quem já conhece Kubernetes — patterns, condições e mutações são expressas em YAML. OPA/Gatekeeper requer aprender Rego, uma linguagem declarativa especializada com curva de aprendizado significativa. Ambos são projetos CNCF graduados.',
      reference: 'Veja a tabela "Comparação: OPA/Gatekeeper vs Kyverno vs PSA" na teoria para decidir qual usar em cada contexto.'
    },
    {
      question: 'Qual é a ordem correta de execução dos tipos de admission controllers?',
      options: [
        'Validating → Mutating → PSA',
        'Mutating → Validating (todos mutating antes de qualquer validating)',
        'PSA → Mutating → Validating',
        'Todos em paralelo, sem ordem definida'
      ],
      correct: 1,
      explanation: 'A ordem é sempre: TODOS os Mutating webhooks primeiro, depois TODOS os Validating webhooks. Isso é crítico: os validadores precisam ver o objeto em seu estado FINAL após todas as mutações. Se um validador rodasse antes de um mutador, poderia rejeitar um objeto que seria corrigido pelo mutador logo depois.',
      reference: 'Veja "Tipos de Admission Controllers" na teoria — a ordem Mutating→Validating é um conceito fundamental que pode aparecer no exame.'
    },
    {
      question: 'Como a validationFailureAction "Audit" do Kyverno difere do "Enforce"?',
      options: [
        'Audit bloqueia pods e gera relatórios, Enforce apenas gera relatórios',
        'Audit permite pods não conformes mas gera PolicyReport, Enforce bloqueia imediatamente',
        'Audit aplica apenas a Deployments, Enforce aplica a todos os recursos',
        'Audit funciona apenas em modo DryRun, Enforce funciona em produção'
      ],
      correct: 1,
      explanation: '`Audit` permite que o recurso seja criado mas gera uma entrada no PolicyReport indicando a violação — útil para monitorar antes de enforçar. `Enforce` rejeita o recurso imediatamente com erro. A abordagem recomendada é: deploy em Audit → monitorar violações → corrigir workloads → mudar para Enforce.',
      reference: 'Veja "validationFailureAction: Enforce vs Audit" — esta migração gradual é uma boa prática para adoção de políticas.'
    },
    {
      question: 'Por que é importante excluir namespaces como `kube-system` nas políticas de admission de segurança?',
      options: [
        'Por performance — kube-system tem muitos pods e sobrecarregaria o webhook',
        'Por compatibilidade de versão — kube-system usa APIs mais antigas',
        'Componentes do sistema como kube-proxy, CoreDNS, etcd podem não ser conformes com PSS Restricted e seriam quebrados',
        'kube-system tem imunidade RBAC que ignora admission controllers'
      ],
      correct: 2,
      explanation: 'Componentes do sistema (kube-proxy, CoreDNS, metrics-server, CNI plugins) frequentemente precisam de configurações que violam políticas restritivas — hostNetwork, hostPath, capabilities específicas. Aplicar políticas Restricted a kube-system quebraria o cluster. Sempre exclua namespaces do sistema das políticas de admission mais restritivas.',
      reference: 'Veja "Erros Comuns" — ponto 2. O tópico Pod Security Overview também aborda este cenário com PSA no kube-system.'
    },
    {
      question: 'O que acontece com recursos já existentes no cluster quando um Kyverno ClusterPolicy em modo `Enforce` é criado?',
      options: [
        'São imediatamente deletados se violarem a política',
        'São marcados no PolicyReport mas não deletados — apenas novos creates/updates são bloqueados',
        'São automaticamente corrigidos pelo campo mutate da política',
        'São movidos para um namespace de quarentena automaticamente'
      ],
      correct: 1,
      explanation: 'Admission controllers (incluindo Kyverno e Gatekeeper) só atuam no momento da criação/atualização de recursos. Recursos existentes que violam a política ficam em execução — aparecem no PolicyReport mas não são deletados. Apenas novas operações (create, update) são afetadas. Para checar recursos existentes: `kubectl get policyreport -A`.',
      reference: 'Veja o campo `background: true` na ClusterPolicy de exemplo — ele controla se o Kyverno verifica recursos existentes para relatórios.'
    }
  ],
  flashcards: [
    {
      front: 'Qual é a ordem de execução dos Admission Controllers?',
      back: 'Autenticação → Autorização (RBAC) → Mutating Admission Webhooks → Validating Admission Webhooks → etcd. Mutating sempre antes de Validating — os validadores precisam ver o objeto em seu estado final após todas as mutações.'
    },
    {
      front: 'ConstraintTemplate vs Constraint no Gatekeeper — qual a diferença?',
      back: 'ConstraintTemplate: define o tipo de política + lógica Rego (cria um novo CRD). É a "classe". Constraint: instância do ConstraintTemplate com parâmetros e escopo (match). É o "objeto". Análogo: ConstraintTemplate=ClusterRole, Constraint=ClusterRoleBinding.'
    },
    {
      front: 'failurePolicy: Fail vs Ignore — quando usar cada um?',
      back: 'Fail: webhook down → request REJEITADA. Mais seguro, use para políticas críticas de segurança. Ignore: webhook down → request PERMITIDA. Use apenas para webhooks não críticos (labeling, logging). Nunca use Ignore em políticas de segurança.'
    },
    {
      front: 'Kyverno validationFailureAction: Enforce vs Audit',
      back: 'Enforce: bloqueia recursos não conformes imediatamente. Audit: permite recursos mas gera PolicyReport com violations. Workflow recomendado: deploy em Audit → monitorar → corrigir workloads → mudar para Enforce. Evita quebrar produção.'
    },
    {
      front: 'Quais admission controllers nativos de segurança são habilitados por padrão?',
      back: 'NodeRestriction (kubelet apenas acessa seus recursos), NamespaceLifecycle (bloqueia recursos em namespaces terminando), ResourceQuota, LimitRanger. PodSecurity (PSA) e AlwaysPullImages precisam ser habilitados explicitamente: `--enable-admission-plugins=PodSecurity,...`'
    },
    {
      front: 'O que é o PSA (Pod Security Admission)?',
      back: 'Admission controller nativo (substituto do PSP removido em K8s 1.25) que enforça Pod Security Standards por namespace via labels. Modos: enforce (bloqueia), audit (loga), warn (alerta). Levels: privileged, baseline, restricted. Ex: `pod-security.kubernetes.io/enforce: restricted`'
    },
    {
      front: 'Por que excluir kube-system das políticas de admission?',
      back: 'Componentes do sistema (kube-proxy, CoreDNS, CNI) precisam de configurações que violam PSS Restricted: hostNetwork, hostPath, capabilities específicas. Aplicar políticas restritivas a kube-system quebraria o cluster. Sempre exclua namespaces do sistema com `excludedNamespaces: [kube-system]`.'
    },
    {
      front: 'OPA/Gatekeeper vs Kyverno — principais diferenças',
      back: 'OPA/Gatekeeper: usa Rego (poderoso mas complexo), máxima flexibilidade, CNCF Graduated. Kyverno: YAML nativo K8s (sem Rego), suporta mutate/generate/verifyImages, curva menor. PSA: built-in K8s, sem instalação, apenas 3 levels de segurança, sem mutação. Para o KCSA: entenda todos os três.'
    }
  ],
  lab: {
    scenario: 'O cluster de produção precisa de políticas de admission para enforçar boas práticas de segurança: proibir containers sem limits de memória e exigir runAsNonRoot. Você usará PSA nativo e criará webhooks de validação.',
    objective: 'Configurar políticas de admission usando PSA nativo e entender como Webhooks funcionam.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Configurar PSA por namespace',
        instruction: `Configure o Pod Security Admission para enforçar diferentes níveis de segurança em diferentes namespaces.

\`\`\`bash
# Criar namespaces com diferentes níveis de segurança
kubectl create namespace ns-baseline
kubectl create namespace ns-restricted
kubectl create namespace ns-development

# Aplicar PSA enforcement
kubectl label namespace ns-baseline \\
  pod-security.kubernetes.io/enforce=baseline \\
  pod-security.kubernetes.io/enforce-version=latest

kubectl label namespace ns-restricted \\
  pod-security.kubernetes.io/enforce=restricted \\
  pod-security.kubernetes.io/enforce-version=latest \\
  pod-security.kubernetes.io/warn=restricted \\
  pod-security.kubernetes.io/warn-version=latest

# Desenvolvimento: apenas audit (sem bloqueio)
kubectl label namespace ns-development \\
  pod-security.kubernetes.io/audit=baseline \\
  pod-security.kubernetes.io/audit-version=latest
\`\`\`

Testar enforcement:
\`\`\`bash
# Tentar criar pod privilegiado no namespace baseline (deve ser BLOQUEADO)
kubectl run priv-pod --image=nginx:alpine -n ns-baseline \\
  --overrides='{"spec":{"containers":[{"name":"priv-pod","image":"nginx:alpine","securityContext":{"privileged":true}}]}}'

# Tentar criar pod privilegiado no namespace development (deve ser PERMITIDO com audit)
kubectl run priv-pod --image=nginx:alpine -n ns-development \\
  --overrides='{"spec":{"containers":[{"name":"priv-pod","image":"nginx:alpine","securityContext":{"privileged":true}}]}}'
\`\`\``,
        hints: [
          'PSS Baseline bloqueia privileged:true, hostNetwork, hostPID — mas não exige runAsNonRoot',
          'PSS Restricted exige runAsNonRoot, drop ALL, seccomp — muito mais restritivo',
          'O modo audit gera entradas no audit log mas não bloqueia pods'
        ],
        solution: `\`\`\`bash
kubectl create namespace ns-baseline
kubectl create namespace ns-restricted

kubectl label namespace ns-baseline \\
  pod-security.kubernetes.io/enforce=baseline \\
  pod-security.kubernetes.io/enforce-version=latest

kubectl label namespace ns-restricted \\
  pod-security.kubernetes.io/enforce=restricted \\
  pod-security.kubernetes.io/enforce-version=latest

# Testar: pod privilegiado DEVE ser bloqueado no ns-baseline
kubectl run priv-pod --image=nginx:alpine -n ns-baseline \\
  --overrides='{"spec":{"containers":[{"name":"priv-pod","image":"nginx:alpine","securityContext":{"privileged":true}}]}}'
# Erro esperado: pods "priv-pod" is forbidden: violates PodSecurity...

# Pod normal DEVE funcionar no ns-baseline
kubectl run normal-pod --image=nginx:alpine -n ns-baseline
\`\`\``,
        verify: `\`\`\`bash
# Verificar labels PSA nos namespaces
kubectl get namespace ns-baseline ns-restricted -o custom-columns=\\
  'NAME:.metadata.name,ENFORCE:.metadata.labels.pod-security\.kubernetes\.io/enforce'
# NAME           ENFORCE
# ns-baseline    baseline
# ns-restricted  restricted

# Verificar que pod privilegiado é bloqueado no ns-baseline
kubectl run test-priv --image=busybox -n ns-baseline \\
  --overrides='{"spec":{"containers":[{"name":"test","image":"busybox","securityContext":{"privileged":true}}]}}' \\
  2>&1 | grep -i "forbidden\\|violates"
# Saída esperada: Error from server (Forbidden): ... violates PodSecurity "baseline:latest"
\`\`\``
      },
      {
        title: 'Criar e testar um ValidatingWebhookConfiguration',
        instruction: `Entenda a estrutura de um ValidatingWebhookConfiguration criando um que aponta para um serviço (mesmo que não exista — veremos o comportamento com failurePolicy).

\`\`\`yaml
# test-webhook.yaml
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingWebhookConfiguration
metadata:
  name: test-validator
webhooks:
- name: test.validation.example.com
  clientConfig:
    service:
      name: non-existent-service
      namespace: default
      path: "/validate"
    caBundle: ""  # Vazio para teste
  rules:
  - operations: ["CREATE"]
    apiGroups: [""]
    apiVersions: ["v1"]
    resources: ["pods"]
    scope: "Namespaced"
  admissionReviewVersions: ["v1"]
  sideEffects: None
  failurePolicy: Ignore  # Começar com Ignore para não quebrar nada
  namespaceSelector:
    matchLabels:
      test-webhook: enabled
\`\`\`

\`\`\`bash
kubectl apply -f test-webhook.yaml

# Criar namespace com o label para ativar o webhook
kubectl create namespace webhook-test
kubectl label namespace webhook-test test-webhook=enabled

# Com failurePolicy: Ignore, pods devem ser criados mesmo com webhook inválido
kubectl run test-pod --image=busybox -n webhook-test -- sleep 300

# Agora mudar para Fail e ver o comportamento
kubectl patch validatingwebhookconfiguration test-validator \\
  --type='json' -p='[{"op": "replace", "path": "/webhooks/0/failurePolicy", "value": "Fail"}]'

# Tentar criar outro pod — agora deve falhar!
kubectl run test-pod2 --image=busybox -n webhook-test -- sleep 300
\`\`\``,
        hints: [
          'caBundle vazio ou inválido fará o webhook falhar — por isso failurePolicy importa muito',
          'namespaceSelector limita quais namespaces o webhook monitora',
          'Depois do laboratório, delete o webhook para não afetar o cluster: kubectl delete validatingwebhookconfiguration test-validator'
        ],
        solution: `\`\`\`bash
kubectl apply -f test-webhook.yaml

kubectl create namespace webhook-test
kubectl label namespace webhook-test test-webhook=enabled

# Com Ignore: pod criado normalmente
kubectl run test-pod --image=busybox -n webhook-test -- sleep 300
# Funciona!

# Mudar para Fail
kubectl patch validatingwebhookconfiguration test-validator \\
  --type='json' -p='[{"op": "replace", "path": "/webhooks/0/failurePolicy", "value": "Fail"}]'

# Agora pod falha porque webhook não existe mas failurePolicy é Fail
kubectl run test-pod2 --image=busybox -n webhook-test -- sleep 300
# Error: Internal error occurred: failed calling webhook...

# Limpar
kubectl delete validatingwebhookconfiguration test-validator
\`\`\``,
        verify: `\`\`\`bash
# Verificar ValidatingWebhookConfiguration criado
kubectl get validatingwebhookconfiguration test-validator
# NAME             WEBHOOKS   AGE
# test-validator   1          ...

# Verificar failurePolicy atual
kubectl get validatingwebhookconfiguration test-validator \\
  -o jsonpath='{.webhooks[0].failurePolicy}'
# Saída esperada: Fail (após o patch)

# Verificar que pod falha com Fail policy
kubectl run test-verify --image=busybox -n webhook-test -- sleep 30 2>&1 | grep -i "error\\|failed"
# Saída esperada: Error... failed calling webhook "test.validation.example.com"
\`\`\``
      },
      {
        title: 'Criar Kyverno ClusterPolicy (simulação YAML)',
        instruction: `Se Kyverno não estiver instalado, escreva e valide a estrutura da ClusterPolicy. Se estiver disponível, aplique e teste.

\`\`\`bash
# Verificar se Kyverno está instalado
kubectl get pods -n kyverno 2>/dev/null || echo "Kyverno não está instalado"

# Se Kyverno não está instalado, valide o YAML estruturalmente
cat > require-limits.yaml << 'EOF'
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-memory-limits
  annotations:
    policies.kyverno.io/title: Require Memory Limits
    policies.kyverno.io/description: >
      Todos os containers devem ter memory limits definidos
      para prevenir consumo excessivo de recursos.
spec:
  validationFailureAction: Audit
  background: true
  rules:
  - name: require-memory-limit
    match:
      resources:
        kinds:
        - Pod
    exclude:
      resources:
        namespaces:
        - kube-system
        - monitoring
        - kyverno
    validate:
      message: "Container deve ter memory limit definido"
      pattern:
        spec:
          containers:
          - resources:
              limits:
                memory: "?*"
EOF

kubectl apply -f require-limits.yaml 2>/dev/null && \\
  echo "Kyverno instalado — policy aplicada!" || \\
  echo "Kyverno não instalado — YAML validado estruturalmente"

# Se Kyverno estiver disponível, testar:
# Pod sem limits — deve gerar PolicyReport (Audit mode)
kubectl run no-limits --image=nginx:alpine -n default \\
  -- sleep 300 2>/dev/null

kubectl get policyreport -n default 2>/dev/null | head -5
\`\`\``,
        hints: [
          'validationFailureAction: Audit gera PolicyReport sem bloquear — perfeito para testar',
          'O padrão "?*" em Kyverno significa "qualquer valor não-nulo"',
          'exclude.resources.namespaces é essencial para evitar problemas com kube-system'
        ],
        solution: `\`\`\`bash
# Criar o YAML da política
cat > require-limits.yaml << 'EOF'
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-memory-limits
spec:
  validationFailureAction: Audit
  background: true
  rules:
  - name: require-memory-limit
    match:
      resources:
        kinds: [Pod]
    exclude:
      resources:
        namespaces: [kube-system, monitoring]
    validate:
      message: "Container deve ter memory limit definido"
      pattern:
        spec:
          containers:
          - resources:
              limits:
                memory: "?*"
EOF

# Tentar aplicar (funciona se Kyverno estiver instalado)
kubectl apply -f require-limits.yaml 2>/dev/null && echo "OK" || echo "Kyverno não encontrado"

# Se disponível, verificar violations
kubectl get policyreport -A 2>/dev/null | head -10
\`\`\``,
        verify: `\`\`\`bash
# Verificar que o arquivo YAML foi criado
ls -la require-limits.yaml
# -rw-r--r-- ... require-limits.yaml

# Verificar estrutura YAML é válida
kubectl apply --dry-run=client -f require-limits.yaml 2>&1
# Se Kyverno não instalado: error: no kind "ClusterPolicy" — esperado
# Se Kyverno instalado: clusterpolicy.kyverno.io/require-memory-limits created (dry-run)

# Se Kyverno instalado, verificar PolicyReport
kubectl get policyreport -A 2>/dev/null
# Deve mostrar violations de pods sem limits no modo Audit
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Webhook quebrou todos os deployments do cluster',
      difficulty: 'hard',
      symptom: 'Após instalar OPA/Gatekeeper, nenhum pod novo pode ser criado no cluster. O erro é: `Internal error occurred: failed calling webhook "validation.gatekeeper.sh": context deadline exceeded`. O time precisa restaurar a operação imediatamente.',
      diagnosis: `\`\`\`bash
# Verificar estado dos pods do Gatekeeper
kubectl get pods -n gatekeeper-system
# controller-manager pod pode estar em CrashLoopBackOff ou não Ready

# Verificar o webhook configuration
kubectl get validatingwebhookconfiguration gatekeeper-validating-webhook-configuration -o yaml | \\
  grep -E "failurePolicy|timeout|namespaceSelector"
# Se failurePolicy: Fail e Gatekeeper está down: todos os pods são bloqueados

# Verificar por que Gatekeeper está down
kubectl describe pods -n gatekeeper-system | grep -E "Error|Warning|OOMKilled"
kubectl logs -n gatekeeper-system -l control-plane=controller-manager --tail=50

# Verificar se é problema de recursos (OOM)
kubectl top pods -n gatekeeper-system
\`\`\``,
      solution: `\`\`\`bash
# AÇÃO IMEDIATA: Mudar failurePolicy para Ignore temporariamente
kubectl patch validatingwebhookconfiguration gatekeeper-validating-webhook-configuration \\
  --type='json' \\
  -p='[{"op":"replace","path":"/webhooks/0/failurePolicy","value":"Ignore"},
       {"op":"replace","path":"/webhooks/1/failurePolicy","value":"Ignore"}]'

# Isso permite que pods sejam criados enquanto Gatekeeper é corrigido

# Investigar e corrigir Gatekeeper
# Opção 1: OOM — aumentar resources
kubectl patch deployment gatekeeper-controller-manager -n gatekeeper-system \\
  --type='json' -p='[{"op":"replace","path":"/spec/template/spec/containers/0/resources/limits/memory","value":"1Gi"}]'

# Opção 2: CrashLoop por ConstraintTemplate inválido
kubectl get constraints -A
kubectl describe constraint <constraint-com-problema>

# Depois de corrigir Gatekeeper, restaurar failurePolicy: Fail
kubectl patch validatingwebhookconfiguration gatekeeper-validating-webhook-configuration \\
  --type='json' \\
  -p='[{"op":"replace","path":"/webhooks/0/failurePolicy","value":"Fail"},
       {"op":"replace","path":"/webhooks/1/failurePolicy","value":"Fail"}]'
\`\`\``
    },
    {
      title: 'Pod rejeitado por PSA mas não deveria ser',
      difficulty: 'medium',
      symptom: 'Um Deployment em produção está falhando com: `pods "app-7d8f9b-xxx" is forbidden: violates PodSecurity "restricted:latest": allowPrivilegeEscalation != false`. O desenvolvedor insiste que o container não precisa de privilégios e que o código não muda.',
      diagnosis: `\`\`\`bash
# Ver o erro completo
kubectl describe pod <pod-name> -n production
# ou
kubectl get events -n production | grep -i "forbidden\\|security\\|violates"

# Ver a configuração atual do container
kubectl get deployment myapp -n production -o yaml | \\
  grep -A20 "securityContext"

# PSS Restricted requer TODOS os seguintes:
# - securityContext.allowPrivilegeEscalation: false
# - securityContext.capabilities.drop: [ALL]
# - securityContext.runAsNonRoot: true (ou runAsUser != 0)
# - securityContext.seccompProfile.type: RuntimeDefault ou Localhost

# Ver labels de enforcement do namespace
kubectl get namespace production --show-labels | grep pod-security

# Verificar qual versão de PSS está sendo enforçada
kubectl get namespace production -o jsonpath='{.metadata.labels}'
\`\`\``,
      solution: `\`\`\`bash
# Corrigir o Deployment adicionando todos os campos necessários para PSS Restricted
kubectl patch deployment myapp -n production --type='json' -p='[
  {
    "op": "add",
    "path": "/spec/template/spec/securityContext",
    "value": {
      "runAsNonRoot": true,
      "runAsUser": 1000,
      "seccompProfile": {"type": "RuntimeDefault"}
    }
  },
  {
    "op": "add",
    "path": "/spec/template/spec/containers/0/securityContext",
    "value": {
      "allowPrivilegeEscalation": false,
      "capabilities": {"drop": ["ALL"]},
      "readOnlyRootFilesystem": true
    }
  }
]'

# Verificar que o Deployment está progredindo
kubectl rollout status deployment/myapp -n production

# Se a aplicação precisar escrever em disco, adicionar emptyDir
# (readOnlyRootFilesystem:true requer que dados temporários usem volumes)
# kubectl edit deployment myapp -n production
# Adicionar:
# volumes:
# - name: tmp
#   emptyDir: {}
# volumeMounts:
# - mountPath: /tmp
#   name: tmp

# Verificar pod Running
kubectl get pods -n production -l app=myapp
\`\`\``
    }
  ]
};
