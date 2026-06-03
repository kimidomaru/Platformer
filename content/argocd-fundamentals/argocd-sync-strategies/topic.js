window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['argocd-fundamentals/argocd-sync-strategies'] = {
  theory: `
# ArgoCD Sync Strategies

## Relevancia
As sync strategies do ArgoCD definem **como** e **quando** as mudancas do Git sao aplicadas ao cluster. Configurar corretamente auto-sync, prune, self-heal, sync waves e hooks e crucial para um pipeline GitOps confiavel e seguro em producao.

## Conceitos Fundamentais

### Sync Manual vs Automatico

| Modo | Comportamento | Quando Usar |
|------|--------------|-------------|
| **Manual** | Requer clique na UI ou comando CLI para sync | Ambientes criticos, producao com aprovacao |
| **Automated** | ArgoCD aplica mudancas automaticamente | Staging, ambientes de dev, GitOps puro |
| **Automated + Prune** | Auto-sync + remove recursos orfaos | Ambientes onde Git e 100% source of truth |
| **Automated + Self-Heal** | Auto-sync + reverte mudancas manuais | Prevenir drift em producao |

### Sync Policy Completa

\`\`\`yaml
spec:
  syncPolicy:
    automated:
      prune: true          # deleta recursos que nao estao no Git
      selfHeal: true       # reverte mudancas manuais no cluster
      allowEmpty: false    # NAO sincroniza se Git estiver vazio (seguranca)
    retry:
      limit: 5             # tentativas de retry
      backoff:
        duration: 5s       # tempo inicial entre retries
        factor: 2          # multiplicador (5s, 10s, 20s, 40s, 80s)
        maxDuration: 3m    # tempo maximo entre retries
    syncOptions:
      - CreateNamespace=true        # cria namespace se nao existir
      - PrunePropagationPolicy=foreground  # aguarda filhos antes de deletar pais
      - PruneLast=true              # prune orfaos apos sync de novos recursos
      - ApplyOutOfSyncOnly=true     # aplica apenas recursos OutOfSync (performance)
      - ServerSideApply=true        # usa server-side apply do K8s (melhor para CRDs grandes)
      - Validate=true               # valida manifests antes de aplicar
      - RespectIgnoreDifferences=true  # respeita ignoreDifferences no auto-sync
      - Replace=false               # usa apply (nao replace) por padrao
\`\`\`

### Prune (Remocao de Recursos Orfaos)

Prune remove recursos do cluster que nao estao mais definidos no Git:

\`\`\`
Git (source of truth):         Cluster (estado real):
- Deployment/app              - Deployment/app         ✅ mantido
- Service/app-svc             - Service/app-svc        ✅ mantido
                              - ConfigMap/old-config   ❌ PRUNED (nao esta no Git)
                              - Service/legacy-svc     ❌ PRUNED (nao esta no Git)
\`\`\`

**Protecao contra prune acidental:**
\`\`\`yaml
# Anotar recursos que NUNCA devem ser pruned
metadata:
  annotations:
    argocd.argoproj.io/sync-options: Prune=false
\`\`\`

### Self-Heal (Correcao de Drift)

Self-heal reverte qualquer mudanca manual feita diretamente no cluster:

\`\`\`
1. Admin executa: kubectl scale deployment app --replicas=10
2. ArgoCD detecta: replicas (10) != Git (3) → OutOfSync
3. Self-heal atua: reverte para replicas=3
4. Resultado: cluster volta ao estado do Git
\`\`\`

### Sync Waves (Ordem de Implantacao)

Sync waves controlam a **ordem** em que recursos sao implantados. Recursos com wave menor sao criados primeiro:

\`\`\`yaml
# Wave 0 — Namespace e RBAC (primeiro)
apiVersion: v1
kind: Namespace
metadata:
  name: my-app
  annotations:
    argocd.argoproj.io/sync-wave: "0"

---
# Wave 1 — ConfigMaps e Secrets
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  annotations:
    argocd.argoproj.io/sync-wave: "1"

---
# Wave 2 — Deployments e Services
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app
  annotations:
    argocd.argoproj.io/sync-wave: "2"

---
# Wave 3 — Ingress (depois de tudo)
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  annotations:
    argocd.argoproj.io/sync-wave: "3"
\`\`\`

**Fluxo de sync waves:**
\`\`\`
Wave 0: Namespace → aguarda Healthy
Wave 1: ConfigMap, Secret → aguarda Healthy
Wave 2: Deployment, Service → aguarda Healthy
Wave 3: Ingress → aguarda Healthy
→ Sync completo!
\`\`\`

### Sync Hooks (Tarefas Pre/Post Sync)

Hooks executam Jobs ou Pods em momentos especificos do ciclo de sync:

| Hook | Quando Executa | Caso de Uso |
|------|---------------|-------------|
| **PreSync** | Antes do sync | Migracao de banco de dados, backup |
| **Sync** | Durante o sync (junto com recursos normais) | Recursos normais |
| **PostSync** | Apos sync completo + healthy | Testes de smoke, notificacoes |
| **SyncFail** | Quando o sync falha | Notificacao de falha, rollback |
| **Skip** | Nunca sincronizado | Placeholder, documentacao |

\`\`\`yaml
# Job de migracao (PreSync)
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migrate
  annotations:
    argocd.argoproj.io/hook: PreSync
    argocd.argoproj.io/hook-delete-policy: BeforeHookCreation
spec:
  template:
    spec:
      containers:
        - name: migrate
          image: my-app:v1.2.3
          command: ["./migrate.sh"]
      restartPolicy: Never

---
# Job de smoke test (PostSync)
apiVersion: batch/v1
kind: Job
metadata:
  name: smoke-test
  annotations:
    argocd.argoproj.io/hook: PostSync
    argocd.argoproj.io/hook-delete-policy: HookSucceeded
spec:
  template:
    spec:
      containers:
        - name: test
          image: curlimages/curl:latest
          command: ["curl", "-sf", "http://app-svc:8080/health"]
      restartPolicy: Never
\`\`\`

### Hook Delete Policies

| Policy | Comportamento |
|--------|--------------|
| **HookSucceeded** | Deleta o hook se completar com sucesso |
| **HookFailed** | Deleta o hook se falhar |
| **BeforeHookCreation** | Deleta hook anterior antes de criar novo (idempotente) |

### Sync Options por Recurso

\`\`\`yaml
metadata:
  annotations:
    # Nao prune este recurso
    argocd.argoproj.io/sync-options: Prune=false

    # Usar replace em vez de apply
    argocd.argoproj.io/sync-options: Replace=true

    # Nao validar este recurso
    argocd.argoproj.io/sync-options: Validate=false

    # Forcar sync (delete + create)
    argocd.argoproj.io/sync-options: Force=true

    # Server-side apply para este recurso
    argocd.argoproj.io/sync-options: ServerSideApply=true
\`\`\`

### Ignore Differences (Ignorar Diferencas)

\`\`\`yaml
spec:
  ignoreDifferences:
    # Ignorar replicas (controlado por HPA)
    - group: apps
      kind: Deployment
      jsonPointers:
        - /spec/replicas

    # Ignorar annotations adicionadas pelo cluster
    - group: ""
      kind: Service
      jqPathExpressions:
        - .metadata.annotations["service.beta.kubernetes.io/aws-load-balancer-type"]

    # Ignorar todo o status
    - group: "*"
      kind: "*"
      managedFieldsManagers:
        - kube-controller-manager
\`\`\`

## Comandos Essenciais

\`\`\`bash
# Sync manual
argocd app sync my-app

# Sync com prune
argocd app sync my-app --prune

# Sync forcado (mesmo se Synced)
argocd app sync my-app --force

# Sync de recurso especifico
argocd app sync my-app --resource :Deployment:nginx

# Sync dry-run (sem aplicar)
argocd app sync my-app --dry-run

# Ver diff
argocd app diff my-app

# Habilitar auto-sync
argocd app set my-app --sync-policy automated

# Habilitar prune
argocd app set my-app --auto-prune

# Habilitar self-heal
argocd app set my-app --self-heal

# Desabilitar auto-sync
argocd app set my-app --sync-policy none

# Ver historico de sync
argocd app history my-app

# Rollback
argocd app rollback my-app <revision>
\`\`\`

## Erros Comuns

1. **Habilitar prune sem entender o impacto**: Prune deleta recursos reais do cluster. Se um recurso for removido do Git por engano, sera deletado do cluster.
2. **Self-heal conflitando com HPA**: O HPA altera replicas, o ArgoCD reverte. Solucao: usar \`ignoreDifferences\` para /spec/replicas.
3. **Sync waves sem aguardar health**: Se um recurso na wave 1 nunca fica Healthy, as waves seguintes nunca executam. Defina timeout adequado.
4. **Hooks sem delete policy**: Jobs de hooks acumulam e causam erro "already exists" no proximo sync. Use BeforeHookCreation.
5. **allowEmpty: true em producao**: Se o repo Git for acidentalmente esvaziado, TODOS os recursos serao deletados. Mantenha false em producao.
6. **Nao usar retry**: Falhas transitorias (API server lento, quota atingida) podem ser resolvidas automaticamente com retry.

## Killer.sh Style Challenge

**Cenario:** Configure uma estrategia de deploy completa com ArgoCD usando sync waves, hooks e policies.

**Tarefas:**
1. Configure uma Application com auto-sync, prune e self-heal
2. Defina sync waves para: Namespace (0) → ConfigMap (1) → Deployment (2) → Ingress (3)
3. Adicione um PreSync hook para migracao de banco de dados
4. Adicione um PostSync hook para smoke test
5. Configure ignoreDifferences para replicas (controladas por HPA)

**Dicas:**
- Use \`argocd.argoproj.io/sync-wave\` para controlar a ordem
- Use \`argocd.argoproj.io/hook\` para Pre/Post hooks
- Sempre use \`hook-delete-policy: BeforeHookCreation\` para idempotencia
`,
  quiz: [
    {
      question: 'O que acontece quando prune esta habilitado e um recurso e removido do repositorio Git?',
      options: [
        'O recurso permanece no cluster como orfao',
        'O ArgoCD deleta o recurso do cluster automaticamente',
        'O ArgoCD marca o recurso como deprecated',
        'O recurso e movido para outro namespace'
      ],
      correct: 1,
      explanation: 'Com prune habilitado, quando um recurso e removido do Git (source of truth), o ArgoCD automaticamente deleta esse recurso do cluster no proximo sync. Sem prune, o recurso ficaria como orfao no cluster. E essencial ter cuidado com prune — remocao acidental do Git causa delecao real.',
      reference: 'Conceito relacionado: argocd-applications — o finalizer controla cleanup ao deletar a Application inteira.'
    },
    {
      question: 'Qual a funcao do self-heal no ArgoCD?',
      options: [
        'Reiniciar pods que falharam',
        'Reverter automaticamente mudancas manuais feitas no cluster para corresponder ao Git',
        'Corrigir erros de sintaxe nos manifests',
        'Atualizar a versao do ArgoCD automaticamente'
      ],
      correct: 1,
      explanation: 'Self-heal monitora o cluster continuamente e reverte qualquer mudanca feita diretamente (ex: kubectl scale, kubectl edit). Se alguem alterar um Deployment manualmente, o ArgoCD detecta a divergencia e aplica o estado do Git automaticamente, prevenindo drift.',
      reference: 'Conceito relacionado: argocd-applications — use ignoreDifferences para campos que devem ser permitidos mudar (ex: HPA replicas).'
    },
    {
      question: 'Para que servem sync waves no ArgoCD?',
      options: [
        'Para paralelizar o deploy de recursos',
        'Para controlar a ordem de implantacao dos recursos — waves menores sao aplicadas primeiro',
        'Para distribuir recursos entre clusters',
        'Para versionamento dos manifests'
      ],
      correct: 1,
      explanation: 'Sync waves definem a ordem de implantacao: recursos com wave 0 sao criados primeiro, depois wave 1, etc. O ArgoCD aguarda os recursos de uma wave ficarem Healthy antes de prosseguir para a proxima. Util para garantir que dependencias (Namespace, ConfigMap) existam antes dos Deployments.',
      reference: 'Conceito relacionado: argocd-sync-strategies — hooks (PreSync/PostSync) complementam waves para tarefas como migracoes.'
    },
    {
      question: 'Qual hook do ArgoCD e executado ANTES da sincronizacao dos recursos?',
      options: [
        'PostSync',
        'Sync',
        'PreSync',
        'SyncFail'
      ],
      correct: 2,
      explanation: 'PreSync hooks executam ANTES de qualquer recurso ser sincronizado. Sao usados para tarefas que devem acontecer antes do deploy, como migracao de banco de dados, backup ou validacao. O sync so prossegue apos o hook completar com sucesso.',
      reference: 'Conceito relacionado: argocd-sync-strategies — combine PreSync + sync waves para deploys complexos.'
    },
    {
      question: 'Qual hook-delete-policy deve ser usada para garantir idempotencia em hooks?',
      options: [
        'HookSucceeded',
        'HookFailed',
        'BeforeHookCreation',
        'AfterHookCompletion'
      ],
      correct: 2,
      explanation: 'BeforeHookCreation deleta o hook anterior antes de criar um novo. Isso garante idempotencia — se o sync for executado novamente, nao havera conflito "already exists". E a policy mais recomendada para a maioria dos hooks.',
      reference: 'Conceito relacionado: argocd-sync-strategies — sem delete policy, hooks acumulam e causam erros.'
    },
    {
      question: 'Como evitar que o self-heal conflite com o HPA (Horizontal Pod Autoscaler)?',
      options: [
        'Desabilitar o HPA',
        'Desabilitar self-heal para toda a Application',
        'Configurar ignoreDifferences para /spec/replicas no Deployment',
        'Aumentar o intervalo de reconciliacao'
      ],
      correct: 2,
      explanation: 'O HPA altera o numero de replicas automaticamente, e o self-heal tenta reverter para o valor do Git. A solucao e usar ignoreDifferences com jsonPointers: ["/spec/replicas"] para que o ArgoCD ignore diferencas nesse campo especifico, permitindo que o HPA controle as replicas.',
      reference: 'Conceito relacionado: argocd-applications — ignoreDifferences tambem e util para campos default do Kubernetes.'
    },
    {
      question: 'O que a opcao PruneLast faz no ArgoCD?',
      options: [
        'Prune apenas o ultimo recurso',
        'Garante que recursos orfaos sao deletados APOS todos os novos recursos serem sync com sucesso',
        'Prune apenas na ultima wave',
        'Desabilita prune para o ultimo sync'
      ],
      correct: 1,
      explanation: 'PruneLast garante que a remocao de recursos orfaos acontece somente apos todos os novos recursos terem sido aplicados com sucesso. Isso evita que recursos sejam deletados antes dos novos estarem prontos, prevenindo downtime durante a transicao.',
      reference: 'Conceito relacionado: argocd-sync-strategies — combine PruneLast com sync waves para deploys seguros.'
    }
  ],
  flashcards: [
    {
      front: 'Quais sao os modos de sync do ArgoCD?',
      back: '**Manual:** requer acao explicita (UI ou CLI)\n**Automated:** aplica mudancas automaticamente do Git\n\n**Opcoes do Automated:**\n- **prune: true** — deleta recursos removidos do Git\n- **selfHeal: true** — reverte mudancas manuais\n- **allowEmpty: false** — protege contra repo vazio\n\n**Retry:** tentativas automaticas em caso de falha\n```yaml\nretry:\n  limit: 5\n  backoff:\n    duration: 5s\n    factor: 2\n    maxDuration: 3m\n```'
    },
    {
      front: 'Como funcionam sync waves?',
      back: 'Sync waves controlam a ordem de deploy:\n\n```yaml\nargocd.argoproj.io/sync-wave: "0"  # primeiro\nargocd.argoproj.io/sync-wave: "1"  # segundo\nargocd.argoproj.io/sync-wave: "2"  # terceiro\n```\n\n**Fluxo:**\n1. Aplica recursos da wave 0\n2. Aguarda todos ficarem Healthy\n3. Aplica recursos da wave 1\n4. Aguarda todos ficarem Healthy\n5. Continua...\n\n**Padrao tipico:**\nWave 0: Namespace, RBAC\nWave 1: ConfigMap, Secret\nWave 2: Deployment, Service\nWave 3: Ingress'
    },
    {
      front: 'Quais sao os hooks do ArgoCD e quando cada um executa?',
      back: '| Hook | Quando | Uso |\n|------|--------|-----|\n| **PreSync** | Antes do sync | DB migration, backup |\n| **Sync** | Durante o sync | Recursos normais |\n| **PostSync** | Apos sync + healthy | Smoke test, notificacao |\n| **SyncFail** | Quando sync falha | Alerta de falha |\n| **Skip** | Nunca | Placeholder |\n\n**Delete Policies:**\n- BeforeHookCreation (recomendado)\n- HookSucceeded\n- HookFailed'
    },
    {
      front: 'O que e o problema do HPA + self-heal e como resolver?',
      back: '**Problema:**\n- HPA escala replicas: 3 → 8\n- Self-heal detecta drift: 8 != 3 (Git)\n- Self-heal reverte: 8 → 3\n- HPA escala novamente: 3 → 8\n- Loop infinito!\n\n**Solucao — ignoreDifferences:**\n```yaml\nspec:\n  ignoreDifferences:\n    - group: apps\n      kind: Deployment\n      jsonPointers:\n        - /spec/replicas\n```\n\nIsso faz o ArgoCD ignorar mudancas em replicas, permitindo que o HPA controle.'
    },
    {
      front: 'Quais sao as syncOptions mais importantes?',
      back: '```yaml\nsyncOptions:\n  - CreateNamespace=true      # cria namespace\n  - PruneLast=true            # prune apos sync\n  - ApplyOutOfSyncOnly=true   # performance\n  - ServerSideApply=true      # CRDs grandes\n  - Validate=true             # valida manifests\n  - Replace=false             # apply vs replace\n  - RespectIgnoreDifferences=true\n```\n\n**Per-resource (annotation):**\n```yaml\nargocd.argoproj.io/sync-options: Prune=false\nargocd.argoproj.io/sync-options: Replace=true\n```'
    },
    {
      front: 'Qual a diferenca entre Prune e Delete no contexto do ArgoCD?',
      back: '**Prune (auto-sync):**\n- Remove recursos do cluster que NAO estao mais no Git\n- Ocorre automaticamente durante sync (se prune: true)\n- Proteçao: annotation Prune=false no recurso\n\n**Delete (Application):**\n- Remove TODOS os recursos ao deletar a Application\n- Controlado pelo finalizer\n- --cascade=false preserva recursos\n\n**PruneLast:** garante que prune ocorre APOS novos recursos serem criados\n\n**allowEmpty: false:** impede prune total se Git estiver vazio'
    },
    {
      front: 'Como fazer rollback no ArgoCD?',
      back: '**Via CLI:**\n```bash\n# Ver historico\nargocd app history my-app\n\n# Rollback para revisao especifica\nargocd app rollback my-app 3\n```\n\n**Via Git (recomendado):**\n```bash\ngit revert HEAD\ngit push\n# ArgoCD detecta e aplica automaticamente\n```\n\n**Importante:**\n- Rollback via CLI desabilita auto-sync temporariamente\n- Rollback via git revert e preferivel (mantem historico)\n- Com auto-sync, o proximo commit do Git sera aplicado\n- Rollback NAO e um undo — e um deploy da revisao anterior'
    }
  ],
  lab: {
    scenario: 'Voce precisa configurar estrategias de sync avancadas no ArgoCD incluindo auto-sync, sync waves, hooks e protecao contra drift.',
    objective: 'Configurar Application com auto-sync/prune/self-heal, implementar sync waves para deploy ordenado, criar hooks Pre/Post sync, e configurar ignoreDifferences.',
    duration: '25-30 minutos',
    steps: [
      {
        title: 'Criar Application com Auto-Sync',
        instruction: `Crie uma Application com sync automatico, prune e self-heal habilitados.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: sync-demo
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://github.com/argoproj/argocd-example-apps.git
    targetRevision: HEAD
    path: guestbook
  destination:
    server: https://kubernetes.default.svc
    namespace: sync-demo
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
      allowEmpty: false
    retry:
      limit: 3
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 1m
    syncOptions:
      - CreateNamespace=true
      - PruneLast=true
      - ApplyOutOfSyncOnly=true
EOF
\`\`\``,
        hints: [
          'Com automated, o sync ocorre automaticamente apos o ArgoCD detectar mudancas',
          'prune: true deleta recursos que nao estao no Git',
          'selfHeal: true reverte mudancas manuais no cluster'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: sync-demo
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://github.com/argoproj/argocd-example-apps.git
    targetRevision: HEAD
    path: guestbook
  destination:
    server: https://kubernetes.default.svc
    namespace: sync-demo
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verificar Application
argocd app get sync-demo -o json | jq '{sync: .status.sync.status, health: .status.health.status}'
# Saida esperada: {"sync": "Synced", "health": "Healthy"}

# Verificar auto-sync habilitado
argocd app get sync-demo -o json | jq '.spec.syncPolicy.automated'
# Saida esperada: {"prune": true, "selfHeal": true}
\`\`\``
      },
      {
        title: 'Testar Self-Heal',
        instruction: `Faca uma mudanca manual no cluster e observe o ArgoCD corrigir automaticamente.

\`\`\`bash
# Verificar replicas atuais
kubectl get deployment -n sync-demo -o jsonpath='{.items[0].spec.replicas}'

# Forcar drift — alterar replicas manualmente
kubectl scale deployment -n sync-demo --all --replicas=5

# Verificar imediatamente
kubectl get deployment -n sync-demo -o jsonpath='{.items[0].spec.replicas}'

# Aguardar self-heal (5-15 segundos)
sleep 15

# Verificar que voltou ao valor do Git
kubectl get deployment -n sync-demo -o jsonpath='{.items[0].spec.replicas}'
\`\`\``,
        hints: [
          'O self-heal verifica o estado continuamente',
          'A correcao geralmente ocorre em 5-15 segundos',
          'Verifique os eventos da Application para ver o self-heal em acao'
        ],
        solution: `\`\`\`bash
kubectl scale deployment -n sync-demo --all --replicas=5
sleep 15
kubectl get deployment -n sync-demo -o jsonpath='{.items[0].spec.replicas}'
\`\`\``,
        verify: `\`\`\`bash
# Verificar que replicas voltaram ao valor original
kubectl get deployment -n sync-demo -o jsonpath='{.items[0].spec.replicas}'
# Saida esperada: 1 (valor original do Git)

# Verificar sync status
argocd app get sync-demo -o json | jq '.status.sync.status'
# Saida esperada: "Synced"
\`\`\``
      },
      {
        title: 'Criar Application com Sync Waves',
        instruction: `Crie manifests com sync waves para controlar a ordem de implantacao.

\`\`\`bash
# Criar Application com manifests locais que usam sync waves
kubectl apply -f - <<EOF
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: waves-demo
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://github.com/argoproj/argocd-example-apps.git
    targetRevision: HEAD
    path: sync-waves
  destination:
    server: https://kubernetes.default.svc
    namespace: waves-demo
  syncPolicy:
    syncOptions:
      - CreateNamespace=true
EOF

# Sincronizar e observar a ordem
argocd app sync waves-demo
\`\`\``,
        hints: [
          'O repo argocd-example-apps tem exemplos de sync-waves',
          'Observe a ordem dos recursos no output do sync',
          'Recursos com wave menor sao criados primeiro'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: waves-demo
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://github.com/argoproj/argocd-example-apps.git
    targetRevision: HEAD
    path: sync-waves
  destination:
    server: https://kubernetes.default.svc
    namespace: waves-demo
  syncPolicy:
    syncOptions:
      - CreateNamespace=true
EOF

argocd app sync waves-demo
\`\`\``,
        verify: `\`\`\`bash
# Verificar que a Application foi sincronizada
argocd app get waves-demo -o json | jq '.status.sync.status'
# Saida esperada: "Synced"

# Verificar recursos no namespace
kubectl get all -n waves-demo
# Saida esperada: recursos criados na ordem correta
\`\`\``
      },
      {
        title: 'Configurar ignoreDifferences',
        instruction: `Configure ignoreDifferences para evitar conflito com HPA ou campos default do Kubernetes.

\`\`\`bash
# Editar a Application sync-demo para ignorar replicas
kubectl patch application sync-demo -n argocd --type merge -p '{
  "spec": {
    "ignoreDifferences": [
      {
        "group": "apps",
        "kind": "Deployment",
        "jsonPointers": ["/spec/replicas"]
      }
    ]
  }
}'

# Agora alterar replicas nao causara OutOfSync
kubectl scale deployment -n sync-demo --all --replicas=5

# Verificar que o status permanece Synced
argocd app get sync-demo
\`\`\``,
        hints: [
          'ignoreDifferences diz ao ArgoCD para nao considerar diferencas em campos especificos',
          'jsonPointers usa RFC 6901 para referenciar campos',
          'Essencial quando HPA, VPA ou controllers externos controlam campos'
        ],
        solution: `\`\`\`bash
kubectl patch application sync-demo -n argocd --type merge -p '{
  "spec": {
    "ignoreDifferences": [
      {
        "group": "apps",
        "kind": "Deployment",
        "jsonPointers": ["/spec/replicas"]
      }
    ]
  }
}'
\`\`\``,
        verify: `\`\`\`bash
# Verificar ignoreDifferences configurado
argocd app get sync-demo -o json | jq '.spec.ignoreDifferences'
# Saida esperada: array com a configuracao de replicas

# Alterar replicas e verificar que nao causa OutOfSync
kubectl scale deployment -n sync-demo --all --replicas=5
sleep 5
argocd app get sync-demo -o json | jq '.status.sync.status'
# Saida esperada: "Synced" (ignora diferenca em replicas)
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Self-heal causa loop infinito com HPA',
      difficulty: 'medium',
      symptom: 'A Application fica alternando entre Synced e OutOfSync continuamente. Os pods sao escalados pelo HPA, revertidos pelo self-heal, e escalados novamente.',
      diagnosis: `\`\`\`bash
# Verificar se ha HPA no namespace
kubectl get hpa -n <namespace>

# Verificar eventos frequentes de sync
argocd app get my-app -o json | jq '.status.operationState.operation.sync.revision'

# Verificar replicas do Deployment vs Git
kubectl get deployment -n <namespace> -o jsonpath='{.items[0].spec.replicas}'
\`\`\``,
      solution: `**Solucao:**

Configure ignoreDifferences para o campo replicas:
\`\`\`yaml
spec:
  ignoreDifferences:
    - group: apps
      kind: Deployment
      jsonPointers:
        - /spec/replicas
\`\`\`

Tambem adicione a syncOption para respeitar no auto-sync:
\`\`\`yaml
spec:
  syncPolicy:
    syncOptions:
      - RespectIgnoreDifferences=true
\`\`\`

**Importante:** remova o campo \`replicas\` do manifest no Git se o HPA e a fonte de verdade para scaling.`
    },
    {
      title: 'Sync waves travadas — recurso nunca fica Healthy',
      difficulty: 'hard',
      symptom: 'O sync trava em uma wave especifica. Os recursos da wave seguinte nunca sao criados porque o ArgoCD aguarda os anteriores ficarem Healthy.',
      diagnosis: `\`\`\`bash
# Ver status detalhado do sync
argocd app get my-app --show-operation

# Ver recursos e seus status
argocd app resources my-app

# Verificar qual wave esta travada
argocd app get my-app -o json | jq '.status.resources[] | select(.health.status != "Healthy") | {kind: .kind, name: .name, status: .health.status}'

# Ver eventos do recurso problematico
kubectl describe <resource> -n <namespace>
\`\`\``,
      solution: `**Causas comuns:**

1. **Probe mal configurada:** Deployment com liveness/readiness probe que nunca passa. O recurso fica em Progressing indefinidamente.

2. **Imagem nao encontrada:** Se a imagem nao existe, o pod fica em ImagePullBackOff → Degraded. Waves seguintes nao executam.

3. **Dependencia circular:** Wave 1 depende de um servico que so e criado na wave 2.

**Solucoes:**
\`\`\`bash
# Sync parcial — pular a wave travada
argocd app sync my-app --resource :Deployment:healthy-app

# Timeout personalizado (nao ha timeout nativo de wave)
# Considere usar sync hooks em vez de waves para dependencias complexas

# Verificar e corrigir o recurso problematico
kubectl logs -n <namespace> <pod-with-issue>
\`\`\``
    },
    {
      title: 'PreSync hook falha e bloqueia todo o sync',
      difficulty: 'medium',
      symptom: 'O sync nunca completa porque um Job de PreSync (ex: migracao de banco) falha repetidamente.',
      diagnosis: `\`\`\`bash
# Ver status do hook
argocd app get my-app -o json | jq '.status.operationState.syncResult.resources[] | select(.hookPhase != null)'

# Ver logs do Job de hook
kubectl logs job/db-migrate -n <namespace>

# Ver estado do Job
kubectl get job db-migrate -n <namespace> -o yaml
\`\`\``,
      solution: `**Solucoes:**

1. **Corrigir o Job:** Verifique os logs e corrija o problema no script de migracao.

2. **Delete policy:** Use BeforeHookCreation para evitar conflito com Job anterior:
\`\`\`yaml
metadata:
  annotations:
    argocd.argoproj.io/hook: PreSync
    argocd.argoproj.io/hook-delete-policy: BeforeHookCreation
\`\`\`

3. **Limpar manualmente e re-sync:**
\`\`\`bash
# Deletar Job falhado
kubectl delete job db-migrate -n <namespace>

# Re-sync
argocd app sync my-app
\`\`\`

4. **Adicionar retry no Job:**
\`\`\`yaml
spec:
  backoffLimit: 3  # tentar ate 3 vezes
  template:
    spec:
      restartPolicy: OnFailure
\`\`\``
    }
  ]
};
