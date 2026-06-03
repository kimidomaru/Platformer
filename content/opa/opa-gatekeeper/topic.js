window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['opa/opa-gatekeeper'] = {
  theory: `# OPA Gatekeeper — Policy as Code no Kubernetes

## Relevância no Exame
> OPA Gatekeeper é cobrado em KubeAstronaut e CKS. Foca em ConstraintTemplates (Rego), Constraints, admission webhook, audit mode e mutation policies.

## Conceitos Fundamentais

### OPA vs Gatekeeper

**OPA (Open Policy Agent)**:
- Motor de políticas genérico
- Aceita qualquer JSON como input
- Avalia regras escritas em Rego
- Usado em APIs, Terraform, Kubernetes, etc.

**Gatekeeper**:
- OPA especializado para Kubernetes
- Implementa ValidatingAdmissionWebhook
- Adiciona CRDs: ConstraintTemplate + Constraint
- Auditoria contínua dos recursos existentes
- Mutations (MutatingAdmissionWebhook)

### Fluxo de Admission com Gatekeeper

\`\`\`
kubectl apply pod.yaml
       ↓
API Server recebe request
       ↓
MutatingAdmissionWebhook (opcional)
→ Gatekeeper Mutations (adiciona labels, sidecar, etc.)
       ↓
ValidatingAdmissionWebhook
→ Gatekeeper avalia todas as Constraints ativas
→ Executa política Rego para cada Constraint
       ↓
Permitir ou Rejeitar (com mensagem de erro)
       ↓
Recurso criado no etcd (se permitido)
\`\`\`

### ConstraintTemplate — Definindo a Política (Rego)

ConstraintTemplate define:
1. O schema do novo CRD de Constraint (quais parâmetros aceita)
2. A política Rego que será executada

\`\`\`yaml
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8srequiredlabels
spec:
  crd:
    spec:
      names:
        kind: K8sRequiredLabels   # nome do CRD que será criado
      validation:
        openAPIV3Schema:
          type: object
          properties:
            labels:               # parâmetros da constraint
              type: array
              items:
                type: object
                properties:
                  key:
                    type: string
                  allowedRegex:
                    type: string

  targets:
    - target: admission.k8s.gatekeeper.sh
      rego: |
        package k8srequiredlabels

        # Função auxiliar: verifica label
        has_key(object, key) {
          _ = object[key]
        }

        # Violação: label ausente
        violation[{"msg": msg, "details": {"missing_label": label}}] {
          required := input.parameters.labels[_]
          label := required.key
          not has_key(input.review.object.metadata.labels, label)
          msg := sprintf("você deve fornecer a label: %v", [label])
        }

        # Violação: label com valor inválido
        violation[{"msg": msg}] {
          required := input.parameters.labels[_]
          label := required.key
          regex := required.allowedRegex
          value := input.review.object.metadata.labels[label]
          not re_match(regex, value)
          msg := sprintf("label %v=%v não bate com regex %v", [label, value, regex])
        }
\`\`\`

### Constraint — Aplicando a Política

Constraint instancia uma ConstraintTemplate com parâmetros específicos:

\`\`\`yaml
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sRequiredLabels      # CRD criado pelo ConstraintTemplate
metadata:
  name: require-team-label-production
spec:
  # Onde aplicar
  match:
    kinds:
      - apiGroups: ["apps"]
        kinds: ["Deployment", "StatefulSet"]
    namespaces:
      - production
      - staging
    # Excluir certos namespaces:
    excludedNamespaces:
      - kube-system
      - monitoring

  # Parâmetros para a política Rego
  parameters:
    labels:
      - key: team
        allowedRegex: "^[a-z-]+\$"
      - key: environment
        allowedRegex: "^(production|staging|development)\$"
\`\`\`

### Audit Mode — Detecção de Drift

O Gatekeeper avalia periodicamente os recursos EXISTENTES (não só novos):

\`\`\`yaml
# Configurar audit interval
apiVersion: config.gatekeeper.sh/v1alpha1
kind: Config
metadata:
  name: config
  namespace: gatekeeper-system
spec:
  sync:
    syncOnly:
      - group: ""
        version: "v1"
        kind: "Namespace"
      - group: "apps"
        version: "v1"
        kind: "Deployment"
  validation:
    traces:
      - user: "user@example.com"
        kind:
          group: "apps"
          version: "v1"
          kind: "Deployment"
\`\`\`

Violações de auditoria aparecem em \`status.violations\`:
\`\`\`bash
kubectl describe constraint require-team-label-production
# Status:
#   Violations:
#   - Message: você deve fornecer a label: team
#     Resource:
#       Kind: Deployment
#       Name: legacy-app
#       Namespace: production
\`\`\`

### Gatekeeper Mutations

Mutações modificam recursos antes da validação:

\`\`\`yaml
apiVersion: mutations.gatekeeper.sh/v1
kind: AssignMetadata
metadata:
  name: add-default-labels
spec:
  match:
    scope: Namespaced
    kinds:
      - apiGroups: ["apps"]
        kinds: ["Deployment"]
    excludedNamespaces:
      - kube-system
  location: "metadata.labels.managed-by"
  parameters:
    assign:
      value: "gatekeeper"
\`\`\`

## Comandos Essenciais

### Instalar Gatekeeper
\`\`\`bash
# Via manifest oficial
kubectl apply -f https://raw.githubusercontent.com/open-policy-agent/gatekeeper/v3.16.0/deploy/gatekeeper.yaml

# Via Helm
helm repo add gatekeeper https://open-policy-agent.github.io/gatekeeper/charts
helm install gatekeeper gatekeeper/gatekeeper \\
  --namespace gatekeeper-system \\
  --create-namespace

kubectl wait --for=condition=ready pod \\
  -l gatekeeper.sh/system=yes \\
  -n gatekeeper-system --timeout=120s
\`\`\`

### Gerenciar Constraints
\`\`\`bash
# Listar ConstraintTemplates
kubectl get constrainttemplates

# Listar Constraints por tipo
kubectl get k8srequiredlabels
kubectl get constraints  # todos os tipos

# Ver violações de uma Constraint
kubectl describe k8srequiredlabels require-team-label-production

# Modo dry-run (não bloqueia, apenas registra)
kubectl annotate constrainttemplate k8srequiredlabels \\
  "constraint.gatekeeper.sh/disable-enforcement=yes" --overwrite

# Forçar re-audit imediato
kubectl annotate config config \\
  -n gatekeeper-system \\
  "audit.gatekeeper.sh/trigger-audit=$(date +%s)" --overwrite

# Ver logs do Gatekeeper
kubectl logs -n gatekeeper-system -l control-plane=controller-manager -f
kubectl logs -n gatekeeper-system -l control-plane=audit-controller -f
\`\`\`

### Testar Políticas
\`\`\`bash
# Testar se pod é rejeitado (sem labels obrigatórias)
kubectl run no-label-pod --image=nginx -n production
# Esperado: Error - admission webhook denied: você deve fornecer a label: team

# Aplicar com labels corretas
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: compliant-app
  namespace: production
  labels:
    team: backend
    environment: production
spec:
  replicas: 1
  selector:
    matchLabels:
      app: compliant-app
  template:
    metadata:
      labels:
        app: compliant-app
    spec:
      containers:
        - name: app
          image: nginx
EOF
# Esperado: deployment.apps/compliant-app created (sem erro)
\`\`\`

## Exemplos YAML

### ConstraintTemplate: Container Limits Obrigatórios
\`\`\`yaml
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8scontainerlimits
spec:
  crd:
    spec:
      names:
        kind: K8sContainerLimits
      validation:
        openAPIV3Schema:
          type: object
          properties:
            cpu:
              type: string
            memory:
              type: string
  targets:
    - target: admission.k8s.gatekeeper.sh
      rego: |
        package k8scontainerlimits

        missing_limit(container, resource) {
          not container.resources.limits[resource]
        }

        violation[{"msg": msg}] {
          container := input.review.object.spec.containers[_]
          missing_limit(container, "cpu")
          msg := sprintf("Container %v deve ter limits.cpu definido", [container.name])
        }

        violation[{"msg": msg}] {
          container := input.review.object.spec.containers[_]
          missing_limit(container, "memory")
          msg := sprintf("Container %v deve ter limits.memory definido", [container.name])
        }
\`\`\`

### ConstraintTemplate: Allowed Image Registries
\`\`\`yaml
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8sallowedrepos
spec:
  crd:
    spec:
      names:
        kind: K8sAllowedRepos
      validation:
        openAPIV3Schema:
          type: object
          properties:
            repos:
              type: array
              items:
                type: string
  targets:
    - target: admission.k8s.gatekeeper.sh
      rego: |
        package k8sallowedrepos

        violation[{"msg": msg}] {
          container := input.review.object.spec.containers[_]
          not any_valid_repo(container.image)
          msg := sprintf("Imagem %v não é de um repositório permitido", [container.image])
        }

        any_valid_repo(image) {
          repo := input.parameters.repos[_]
          startswith(image, repo)
        }

---
# Constraint aplicando a política
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sAllowedRepos
metadata:
  name: require-approved-repos
spec:
  match:
    kinds:
      - apiGroups: [""]
        kinds: ["Pod"]
    namespaces: ["production", "staging"]
  parameters:
    repos:
      - "docker.io/company/"      # registry privado
      - "ghcr.io/company/"        # GitHub Container Registry
      - "registry.k8s.io/"        # Kubernetes oficial
\`\`\`

### Gatekeeper Mutation: Adicionar Sidecar
\`\`\`yaml
apiVersion: mutations.gatekeeper.sh/v1
kind: Assign
metadata:
  name: add-logging-sidecar
spec:
  match:
    scope: Namespaced
    kinds:
      - apiGroups: ["apps"]
        kinds: ["Deployment"]
    namespaces: ["production"]
    labelSelector:
      matchLabels:
        inject-logging: "true"
  location: "spec.template.spec.containers[name:logging-agent]"
  parameters:
    assign:
      value:
        name: logging-agent
        image: fluent/fluent-bit:2.1
        resources:
          requests:
            cpu: 50m
            memory: 64Mi
\`\`\`

## Erros Comuns

### 1. ConstraintTemplate em estado "Created" mas Constraint rejeitada
**Causa**: Erro de sintaxe Rego no template — o OPA não consegue compilar.
**Solução**: \`kubectl describe constrainttemplate k8srequiredlabels\` → ver campo Status/Errors.

### 2. Constraint em modo "dryrun" sem efeito
**Causa**: enforcementAction está como "dryrun" (registra mas não bloqueia).
**Solução**: Mudar para \`enforcementAction: deny\` quando pronto para enforcement.

### 3. Audit não encontra violações em recursos existentes
**Causa**: Tipo de recurso não está em \`config.sync.syncOnly\`.
**Solução**: Adicionar o kind na configuração de sync do Gatekeeper.

### 4. Gatekeeper webhook em modo de falha aberta
**Causa**: webhookFailurePolicy: Ignore — se Gatekeeper ficar down, admite tudo.
**Solução**: Para segurança crítica, usar \`webhookFailurePolicy: Fail\` (bloqueia se Gatekeeper indisponível).

### 5. Constraints muito amplas afetam operações do sistema
**Causa**: match sem excludedNamespaces para kube-system.
**Solução**: Sempre excluir namespaces do sistema: kube-system, gatekeeper-system, kube-public.

## Killer.sh Style Challenge

**Contexto**: O cluster precisa de governança de políticas. Você deve:
1. Instalar o Gatekeeper no cluster
2. Criar um ConstraintTemplate que exija as labels \`team\` e \`cost-center\` em todos os Deployments
3. Criar uma Constraint aplicando a política nos namespaces \`production\` e \`staging\`
4. Testar que um Deployment sem labels é rejeitado
5. Verificar violações existentes via \`kubectl describe constraint\`
6. Criar uma Constraint em modo dryrun para identificar violações sem bloquear`,

  quiz: [
    {
      question: 'O que o campo "targets[].rego" no ConstraintTemplate define?',
      options: [
        'O namespace onde a política será aplicada',
        'A política de autorização escrita em linguagem Rego executada pelo OPA',
        'Os tipos de recursos Kubernetes que serão avaliados',
        'As credenciais de acesso ao API Server para o Gatekeeper'
      ],
      correct: 1,
      explanation: 'O campo rego contém a política de admissão escrita em linguagem Rego (linguagem do OPA). É executado para cada recurso que corresponde à Constraint. A função violation[] é a principal — quando retorna algum elemento, o recurso é rejeitado com a mensagem especificada.',
      reference: 'Conceito: ConstraintTemplate — seção dedicada na teoria.'
    },
    {
      question: 'Qual é a diferença entre ConstraintTemplate e Constraint no Gatekeeper?',
      options: [
        'ConstraintTemplate é para auditoria; Constraint é para enforcement',
        'ConstraintTemplate define a política Rego reutilizável; Constraint instancia com parâmetros específicos e escopo',
        'ConstraintTemplate aplica mutations; Constraint aplica validations',
        'Não há diferença — são sinônimos para o mesmo objeto'
      ],
      correct: 1,
      explanation: 'ConstraintTemplate define O QUÊ verificar (política Rego) e cria um novo CRD. Constraint INSTANCIA esse template com: parâmetros específicos (quais labels são obrigatórias), escopo (quais namespaces, kinds) e modo de enforcement. Separa a lógica da política da sua aplicação.',
      reference: 'Conceito: ConstraintTemplate vs Constraint — seção dedicada na teoria.'
    },
    {
      question: 'O que o campo "enforcementAction: dryrun" em uma Constraint faz?',
      options: [
        'Bloqueia recursos não conformes e registra no log',
        'Registra violações no status.violations sem bloquear a criação do recurso',
        'Aplica a política apenas em ambiente de desenvolvimento',
        'Desabilita o audit automático para esta Constraint'
      ],
      correct: 1,
      explanation: 'dryrun executa a política e registra violações em status.violations da Constraint, mas NÃO bloqueia a admissão do recurso. É a forma segura de testar novas políticas em produção sem impactar workloads existentes. "deny" bloqueia; "warn" deixa passar mas emite aviso.',
      reference: 'Conceito: Audit Mode — seção dedicada na teoria.'
    },
    {
      question: 'Como verificar violações de uma Constraint em recursos existentes?',
      options: [
        'kubectl logs -n gatekeeper-system | grep violation',
        'kubectl describe constraint <name> — seção Status.Violations',
        'kubectl audit constraint <name>',
        'kubectl get violations --all-namespaces'
      ],
      correct: 1,
      explanation: 'kubectl describe constraint <name> mostra a seção Status.Violations com todos os recursos existentes que violam a política — namespace, nome e mensagem de violação. O Gatekeeper atualiza esta seção periodicamente via audit controller.',
      reference: 'Comandos: kubectl describe constraint — seção "Audit Mode" na teoria.'
    },
    {
      question: 'Por que é importante adicionar kube-system ao excludedNamespaces nas Constraints?',
      options: [
        'Por performance — Gatekeeper é mais lento ao avaliar kube-system',
        'Políticas restritivas em kube-system podem impedir operações críticas do cluster',
        'Gatekeeper não tem permissão para avaliar recursos em kube-system',
        'Labels do kube-system têm formato diferente incompatível com Rego'
      ],
      correct: 1,
      explanation: 'Componentes do sistema (kube-dns, kube-proxy, metrics-server) são criados pelo próprio Kubernetes e podem não ter as labels de negócio (team, cost-center) que uma Constraint exige. Bloquear esses recursos pode quebrar funcionalidades essenciais do cluster.',
      reference: 'Erros comuns: Constraints muito amplas — seção "Erros Comuns" na teoria.'
    },
    {
      question: 'O que o objeto "Config" do Gatekeeper em sync.syncOnly controla?',
      options: [
        'Quais usuários têm permissão para criar Constraints',
        'Quais tipos de recursos são sincronizados no cache do Gatekeeper para audit',
        'A frequência de verificação de novas violações',
        'Quais namespaces são excluídos de todas as políticas'
      ],
      correct: 1,
      explanation: 'sync.syncOnly define quais tipos de recursos o Gatekeeper mantém em cache local para o audit controller. Sem sincronização, o audit não consegue encontrar violações em recursos existentes. Por default, apenas recursos enviados via admission são avaliados — sync.syncOnly habilita verificação de recursos pré-existentes.',
      reference: 'Conceito: Audit Mode — Config object na teoria.'
    },
    {
      question: 'Qual objeto Gatekeeper usa para MODIFICAR recursos (adicionar labels, injetar sidecars) antes da validação?',
      options: [
        'Constraint com operation: mutate',
        'AssignMetadata ou Assign (Mutations CRD)',
        'ConstraintTemplate com target: mutating',
        'MutatingPolicy CRD'
      ],
      correct: 1,
      explanation: 'Gatekeeper Mutations usa CRDs específicos: AssignMetadata (para modificar metadata.labels/annotations) e Assign (para modificar qualquer campo do spec). Eles implementam o MutatingAdmissionWebhook e executam ANTES da validação, permitindo injetar valores padrão, sidecars, etc.',
      reference: 'Conceito: Mutations — seção "Gatekeeper Mutations" na teoria.'
    },
    {
      question: 'O que acontece com admission requests se o pod do Gatekeeper ficar down e webhookFailurePolicy: Fail?',
      options: [
        'Todos os recursos são admitidos normalmente (fail-open)',
        'Todos os recursos são rejeitados até o Gatekeeper voltar (fail-closed)',
        'Apenas Pods são rejeitados; outros recursos são admitidos',
        'O API Server desabilita automaticamente o webhook'
      ],
      correct: 1,
      explanation: 'Com webhookFailurePolicy: Fail, se o Gatekeeper webhook não responder, o API Server REJEITA todas as admissões que passariam pelo webhook. É mais seguro (garante que nada passa sem avaliação) mas pode causar indisponibilidade se Gatekeeper ficar down. Fail: Ignore é fail-open (menos seguro).',
      reference: 'Erros comuns: webhook failure policy — seção "Erros Comuns" na teoria.'
    }
  ],

  flashcards: [
    {
      front: 'O que é o Gatekeeper e como ele se diferencia do OPA standalone?',
      back: 'OPA standalone:\n- Motor de políticas genérico\n- Aceita qualquer JSON\n- Sem integração nativa com K8s\n- Deployment separado\n\nGatekeeper (OPA for Kubernetes):\n- Implementa ValidatingAdmissionWebhook\n- CRDs nativos: ConstraintTemplate + Constraint\n- Auditoria contínua de recursos existentes\n- MutatingAdmissionWebhook via Mutations\n- Integrado ao ciclo de admissão do K8s\n- Status de violações diretamente nos objetos K8s'
    },
    {
      front: 'Qual é a relação entre ConstraintTemplate e Constraint?',
      back: 'ConstraintTemplate:\n- Define a POLÍTICA (código Rego)\n- Cria um novo CRD (ex: K8sRequiredLabels)\n- Reutilizável — 1 template, N constraints\n- Define schema dos parâmetros\n\nConstraint:\n- INSTANCIA o template\n- Define: parâmetros, escopo, enforcement\n- Ex: K8sRequiredLabels com parâmetros\n  {labels: [{key: "team"}]}\n- Pode ter múltiplas Constraints do mesmo template\n\nAnalogicamente:\n- Template = "classe" em OO\n- Constraint = "instância" da classe'
    },
    {
      front: 'Quais são os 3 valores de enforcementAction em Constraints?',
      back: 'deny:\n- Bloqueia a criação/update do recurso\n- Retorna erro imediato ao usuário\n- Para políticas em produção\n\ndryrun:\n- NÃO bloqueia admissão\n- Registra em status.violations\n- Para testar nova política sem impacto\n- Ideal para "migrar" para deny gradualmente\n\nwarn:\n- Admite o recurso mas emite aviso\n- Aviso visível na resposta da API\n- Menos restritivo que deny\n- Para notificar sem bloquear\n\nPasso a passo recomendado: dryrun → warn → deny'
    },
    {
      front: 'Como estrutura básica de uma política Rego no Gatekeeper?',
      back: 'package k8smypolicy\n\n# violation[{"msg": msg}]: define quando há violação\n# - msg: string com mensagem de erro\n# - Se violations = empty: PERMITIDO\n# - Se violations tem itens: REJEITADO\n\nviolation[{"msg": msg}] {\n  # Condições para violação\n  container := input.review.object.spec.containers[_]\n  not container.resources.limits.memory\n  msg := sprintf("Container %v precisa de limits.memory", [container.name])\n}\n\n# Inputs disponíveis:\n# input.review.object → recurso sendo admitido\n# input.parameters → params da Constraint\n# input.review.userInfo → usuário que fez o request'
    },
    {
      front: 'Como verificar violações de Constraints existentes?',
      back: '# Ver todas as constraints e contagem de violações\nkubectl get constraints\n# Coluna VIOLATIONS mostra contagem\n\n# Ver detalhes de violações\nkubectl describe constraint require-team-label\n# Status.Violations:\n#   - Kind: Deployment\n#     Name: legacy-app\n#     Namespace: production\n#     Message: você deve fornecer a label: team\n\n# Para audit funcionar, adicionar ao Config:\nkubectl get config config -n gatekeeper-system -o yaml\n# spec.sync.syncOnly deve incluir o Kind\n\n# Forçar re-audit\nkubectl annotate config config \\\n  -n gatekeeper-system \\\n  "audit.gatekeeper.sh/trigger-audit=$(date +%s)" --overwrite'
    },
    {
      front: 'Como instalar o Gatekeeper e verificar que está funcionando?',
      back: '# Via manifest\nkubectl apply -f https://raw.githubusercontent.com/open-policy-agent/gatekeeper/v3.16.0/deploy/gatekeeper.yaml\n\n# Via Helm\nhelm repo add gatekeeper https://open-policy-agent.github.io/gatekeeper/charts\nhelm install gatekeeper gatekeeper/gatekeeper \\\n  -n gatekeeper-system --create-namespace\n\n# Verificar pods\nkubectl get pods -n gatekeeper-system\n# controller-manager (webhook), audit-controller\n\n# Verificar webhook registrado\nkubectl get validatingwebhookconfiguration | grep gatekeeper\n\n# Verificar CRDs\nkubectl get crd | grep gatekeeper.sh'
    },
    {
      front: 'O que são Gatekeeper Mutations e para que servem?',
      back: 'Mutations implementam MutatingAdmissionWebhook:\nEXECUTAM ANTES da validação\n\nCasos de uso:\n- Injetar label padrão (managed-by: gatekeeper)\n- Adicionar annotation de billing\n- Injetar sidecar (logging, security)\n- Definir resource limits default\n- Forçar imagePullPolicy: Always\n\nCRDs disponíveis:\n- AssignMetadata: modifica metadata.labels/annotations\n- Assign: modifica qualquer campo do spec\n- ModifySet: adiciona/remove items de listas\n\nExemplo:\napiVersion: mutations.gatekeeper.sh/v1\nkind: AssignMetadata\nspec:\n  location: "metadata.labels.managed-by"\n  parameters:\n    assign:\n      value: "gatekeeper"'
    },
    {
      front: 'Por que excluir kube-system das Constraints e qual o risco de não fazer?',
      back: 'Por que excluir:\n- kube-dns, kube-proxy, coredns: não têm labels de negócio\n- metrics-server, cluster-autoscaler: criados sem labels obrigatórias\n- Se bloqueados: cluster pode quebrar!\n\nRisco de NÃO excluir:\n- Nova política "labels obrigatórias" bloqueia kube-dns update\n- CoreDNS failing → DNS do cluster quebrado\n- Cluster pode ficar inutilizável\n\nSolução:\nspec:\n  match:\n    excludedNamespaces:\n      - kube-system\n      - gatekeeper-system\n      - kube-public\n      - monitoring\n      - cert-manager'
    }
  ],

  lab: {
    scenario: 'O time de plataforma precisa implementar governance de labels para garantir rastreabilidade de custos. Todos os Deployments em production devem ter as labels "team" e "cost-center". Você deve implementar isso com Gatekeeper.',
    objective: 'Instalar Gatekeeper, criar ConstraintTemplate para labels obrigatórias, aplicar Constraint em production, testar enforcement e verificar violações existentes via audit.',
    duration: '30-40 minutos',
    steps: [
      {
        title: 'Instalar Gatekeeper no Cluster',
        instruction: `Instale o Gatekeeper via Helm no namespace \`gatekeeper-system\` e verifique que os componentes estão Running.

Depois de instalar, verifique:
1. Pods do controller-manager e audit-controller
2. ValidatingWebhookConfiguration registrado
3. CRDs do Gatekeeper criados`,
        hints: [
          'O repositório Helm é gatekeeper/gatekeeper',
          'O namespace padrão é gatekeeper-system',
          'Aguarde os pods ficarem Ready antes de criar Constraints'
        ],
        solution: `\`\`\`bash
# Instalar via Helm
helm repo add gatekeeper https://open-policy-agent.github.io/gatekeeper/charts
helm repo update

helm install gatekeeper gatekeeper/gatekeeper \\
  --namespace gatekeeper-system \\
  --create-namespace \\
  --set controllerManager.dnsPolicy=ClusterFirst \\
  --set audit.dnsPolicy=ClusterFirst

kubectl wait --for=condition=ready pod \\
  -l gatekeeper.sh/system=yes \\
  -n gatekeeper-system --timeout=180s

# Criar namespace de teste
kubectl create namespace production
kubectl label namespace production env=production
\`\`\``,
        verify: `\`\`\`bash
# Verificar pods
kubectl get pods -n gatekeeper-system
# Saída esperada:
# gatekeeper-audit-xxx           1/1   Running
# gatekeeper-controller-xxx      1/1   Running
# gatekeeper-controller-xxx      1/1   Running (2 replicas)

# Verificar webhook
kubectl get validatingwebhookconfiguration | grep gatekeeper
# Saída esperada: gatekeeper-validating-webhook-configuration

# Verificar CRDs
kubectl get crd | grep gatekeeper.sh | head -5
# Saída esperada: constraints, configs, constrainttemplates, etc.
\`\`\``
      },
      {
        title: 'Criar ConstraintTemplate e Constraint',
        instruction: `Crie:
1. Um ConstraintTemplate \`K8sRequiredLabels\` que exige labels específicas em Deployments
2. Uma Constraint \`require-billing-labels\` aplicando a política em \`production\` exigindo as labels \`team\` e \`cost-center\`
3. Teste que um Deployment sem labels é rejeitado
4. Teste que um Deployment com labels corretas é aceito`,
        hints: [
          'O nome do ConstraintTemplate vira o Kind do CRD criado (K8sRequiredLabels)',
          'A Constraint usa o Kind definido pelo ConstraintTemplate',
          'O campo match.kinds deve incluir {apiGroups: ["apps"], kinds: ["Deployment"]}',
          'Sempre excluir namespaces de sistema no match.excludedNamespaces'
        ],
        solution: `\`\`\`bash
# Criar ConstraintTemplate
kubectl apply -f - <<EOF
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8srequiredlabels
spec:
  crd:
    spec:
      names:
        kind: K8sRequiredLabels
      validation:
        openAPIV3Schema:
          type: object
          properties:
            labels:
              type: array
              items:
                type: string
  targets:
    - target: admission.k8s.gatekeeper.sh
      rego: |
        package k8srequiredlabels

        violation[{"msg": msg}] {
          label := input.parameters.labels[_]
          not input.review.object.metadata.labels[label]
          msg := sprintf("Missing required label: %v", [label])
        }
EOF

# Aguardar CRD ser criado
sleep 5
kubectl get crd k8srequiredlabels.constraints.gatekeeper.sh

# Criar Constraint
kubectl apply -f - <<EOF
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sRequiredLabels
metadata:
  name: require-billing-labels
spec:
  enforcementAction: deny
  match:
    kinds:
      - apiGroups: ["apps"]
        kinds: ["Deployment"]
    namespaces:
      - production
    excludedNamespaces:
      - kube-system
      - gatekeeper-system
  parameters:
    labels:
      - team
      - cost-center
EOF

# Testar rejeição (sem labels)
kubectl create deployment no-labels-app \\
  --image=nginx -n production
# Esperado: ERRO - Missing required label: team

# Testar aceitação (com labels)
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: compliant-app
  namespace: production
  labels:
    team: backend
    cost-center: CC-001
spec:
  replicas: 1
  selector:
    matchLabels:
      app: compliant-app
  template:
    metadata:
      labels:
        app: compliant-app
    spec:
      containers:
        - name: app
          image: nginx:latest
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verificar ConstraintTemplate
kubectl get constrainttemplate k8srequiredlabels
# Saída esperada: k8srequiredlabels   Xs

# Verificar Constraint
kubectl get k8srequiredlabels require-billing-labels
# Saída esperada: require-billing-labels   deny   X  (violations count)

# Verificar que Deployment sem labels foi rejeitado
kubectl get deployment no-labels-app -n production 2>&1
# Saída esperada: Error from server (Forbidden) ou Not Found

# Verificar que Deployment com labels foi criado
kubectl get deployment compliant-app -n production
# Saída esperada: compliant-app   1/1   Running

# Ver violações existentes
kubectl describe k8srequiredlabels require-billing-labels | grep -A10 "Violations"
\`\`\``
      },
      {
        title: 'Testar Audit Mode e Adicionar Constraint DryRun',
        instruction: `Configure o audit mode para detectar violações em recursos existentes e crie uma segunda Constraint em modo dryrun para testar uma nova política sem bloquear workloads.

1. Crie um Deployment sem labels no namespace \`staging\` (simulando recurso legacy)
2. Crie uma Constraint para staging em modo dryrun
3. Verifique que o Deployment foi CRIADO (dryrun não bloqueia)
4. Verifique as violações no status da Constraint`,
        hints: [
          'staging namespace precisa ser criado antes',
          'enforcementAction: dryrun registra violações sem bloquear',
          'O audit controller verifica periodicamente — aguarde alguns minutos',
          'kubectl describe constraint mostra violações na seção Status'
        ],
        solution: `\`\`\`bash
# Criar namespace staging
kubectl create namespace staging

# Criar Deployment legacy (sem labels) antes da Constraint
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: legacy-app
  namespace: staging
  # Sem labels obrigatórias!
spec:
  replicas: 1
  selector:
    matchLabels:
      app: legacy-app
  template:
    metadata:
      labels:
        app: legacy-app
    spec:
      containers:
        - name: app
          image: nginx:latest
EOF

# Criar Constraint em dryrun para staging
kubectl apply -f - <<EOF
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sRequiredLabels
metadata:
  name: require-billing-labels-staging
spec:
  enforcementAction: dryrun  # não bloqueia!
  match:
    kinds:
      - apiGroups: ["apps"]
        kinds: ["Deployment"]
    namespaces:
      - staging
  parameters:
    labels:
      - team
      - cost-center
EOF

# Tentar criar outro deployment sem labels (deve funcionar em dryrun)
kubectl create deployment dryrun-test \\
  --image=nginx -n staging
# Esperado: deployment criado (dryrun não bloqueia)

# Aguardar audit (pode demorar 1-2 minutos)
sleep 90

# Ver violações
kubectl describe k8srequiredlabels require-billing-labels-staging
\`\`\``,
        verify: `\`\`\`bash
# Verificar que legacy-app e dryrun-test existem (não foram bloqueados)
kubectl get deployments -n staging
# Saída esperada: legacy-app, dryrun-test ambos Running

# Verificar violações na Constraint dryrun
kubectl describe k8srequiredlabels require-billing-labels-staging | \\
  grep -A15 "Violations"
# Saída esperada:
#   Violations:
#   - Kind: Deployment
#     Name: legacy-app
#     Namespace: staging
#     Message: Missing required label: team
#   - Kind: Deployment
#     Name: dryrun-test
#     ...

# Comparar com Constraint deny (production) — não deve ter violations
kubectl describe k8srequiredlabels require-billing-labels | grep "Total Violations"
# Saída esperada: 0 (pois compliant-app tem as labels)
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'ConstraintTemplate criado mas Constraint retorna "no matches for kind"',
      difficulty: 'easy',
      symptom: 'Após criar o ConstraintTemplate, ao tentar criar a Constraint com o Kind definido, o kubectl retorna "no matches for kind K8sRequiredLabels in version constraints.gatekeeper.sh/v1beta1".',
      diagnosis: `\`\`\`bash
# Verificar se CRD foi criado
kubectl get crd | grep k8srequiredlabels

# Ver status do ConstraintTemplate
kubectl describe constrainttemplate k8srequiredlabels

# Ver se há erros de compilação Rego
kubectl get constrainttemplate k8srequiredlabels -o json | \\
  jq '.status'

# Verificar logs do Gatekeeper
kubectl logs -n gatekeeper-system \\
  -l control-plane=controller-manager --tail=50 | \\
  grep -i "error\\|rego\\|compile"
\`\`\``,
      solution: `**Causa 1**: ConstraintTemplate ainda não foi processado — aguardar alguns segundos.
\`\`\`bash
# Verificar se CRD está presente
kubectl get crd k8srequiredlabels.constraints.gatekeeper.sh
# Se Not Found: aguardar 10-30s e tentar novamente

# Ver status do template
kubectl get constrainttemplate k8srequiredlabels -o yaml | grep -A10 "status:"
# Aguardar até aparecer "byPod" com status "TRUE"
\`\`\`

**Causa 2**: Erro de sintaxe Rego — template falhou ao compilar.
\`\`\`bash
kubectl describe constrainttemplate k8srequiredlabels | grep -A5 "Errors:"
# Se houver mensagem de erro Rego: corrigir a sintaxe

# Teste local da política Rego antes de aplicar:
# https://play.openpolicyagent.org/
\`\`\`

**Causa 3**: Nome do CRD não bate — spec.crd.spec.names.kind errado.
\`\`\`bash
# O Kind no ConstraintTemplate deve ser EXATAMENTE o mesmo na Constraint
kubectl get constrainttemplate k8srequiredlabels -o jsonpath='{.spec.crd.spec.names.kind}'
# Use este Kind exato na Constraint
\`\`\``
    },
    {
      title: 'Constraint bloqueia deployments do Gatekeeper em gatekeeper-system',
      difficulty: 'medium',
      symptom: 'Após criar uma Constraint muito ampla, o próprio Gatekeeper não consegue atualizar seus componentes internos. kubectl rollout restart deployment gatekeeper-controller-manager fica travado.',
      diagnosis: `\`\`\`bash
# Ver eventos do Deployment do Gatekeeper
kubectl describe deployment gatekeeper-controller-manager \\
  -n gatekeeper-system | grep -A10 "Events:"

# Ver se ReplicaSet está em Pending por admission denial
kubectl get pods -n gatekeeper-system
kubectl describe pod -n gatekeeper-system \\
  -l control-plane=controller-manager | grep -A5 "Events:"

# Ver qual Constraint está bloqueando
kubectl get constraints --all-namespaces -o json | \\
  jq '.items[] | select(.spec.match.excludedNamespaces == null or
    (.spec.match.excludedNamespaces | index("gatekeeper-system") | not)) |
    .metadata.name'
\`\`\``,
      solution: `**Solução imediata — Adicionar gatekeeper-system ao excludedNamespaces**:
\`\`\`bash
# Editar todas as Constraints problemáticas
kubectl get k8srequiredlabels -o name | while read constraint; do
  kubectl patch \$constraint --type='merge' \\
    -p '{"spec":{"match":{"excludedNamespaces":["kube-system","gatekeeper-system","kube-public"]}}}'
done
\`\`\`

**Solução de emergência — Modo dryrun temporário**:
\`\`\`bash
# Mudar todas as Constraints para dryrun temporariamente
kubectl get k8srequiredlabels -o name | while read constraint; do
  kubectl patch \$constraint --type='merge' \\
    -p '{"spec":{"enforcementAction":"dryrun"}}'
done

# Agora o rollout pode prosseguir
kubectl rollout restart deployment gatekeeper-controller-manager \\
  -n gatekeeper-system

# Após Gatekeeper estável, reverter para deny e adicionar excludedNamespaces
\`\`\``
    }
  ]
};
