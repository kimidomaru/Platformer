window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['workloads/deployments'] = {

  theory: `# Deployments & Rolling Updates

## O que e um Deployment?

Um **Deployment** e um objeto que representa uma aplicacao no Kubernetes. Ele e responsavel por gerenciar os Pods que compoem essa aplicacao de forma **declarativa** — voce define o estado desejado e o Deployment Controller faz o que for necessario para que o estado atual seja igual ao desejado.

Quando criamos um Deployment, automaticamente estamos criando um **ReplicaSet**. O ReplicaSet garante que o numero de Pods desejado esteja rodando. Se um Pod morrer, o ReplicaSet cria outro para substitui-lo. O Deployment gerencia os ReplicaSets, e os ReplicaSets gerenciam os Pods.

### Hierarquia: Deployment → ReplicaSet → Pod

\`\`\`
┌─────────────────────────────────────────────────────┐
│                   DEPLOYMENT                         │
│  (gerencia versoes e estrategias de atualizacao)     │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │              REPLICASET (v2 - ativo)           │  │
│  │  (garante o numero desejado de replicas)       │  │
│  │                                                │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐     │  │
│  │  │  POD 1   │  │  POD 2   │  │  POD 3   │     │  │
│  │  │ nginx:v2 │  │ nginx:v2 │  │ nginx:v2 │     │  │
│  │  └──────────┘  └──────────┘  └──────────┘     │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │          REPLICASET (v1 - antigo, 0 replicas)  │  │
│  │  (mantido para possivel rollback)              │  │
│  └────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
\`\`\`

**Fluxo de criacao:**

\`\`\`
kubectl apply -f deployment.yaml
       │
       ▼
 Deployment Controller
       │ cria/atualiza
       ▼
   ReplicaSet
       │ cria/monitora
       ▼
  Pod 1, Pod 2, Pod 3
\`\`\`

> **Dica de prova**: Deployments sao o metodo recomendado para gerenciar aplicacoes stateless. Nunca manipule ReplicaSets diretamente quando usar Deployments.

---

## Anatomia Completa de um Deployment

\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
  labels:
    app: nginx
spec:
  replicas: 3                    # numero de Pods desejados (default: 1)
  revisionHistoryLimit: 10       # quantos ReplicaSets antigos manter (default: 10)
  progressDeadlineSeconds: 600   # tempo max para rollout (default: 600s)
  minReadySeconds: 0             # tempo que Pod deve ficar Ready antes de ser Available
  paused: false                  # se true, mudancas no template nao disparam rollout
  selector:                      # IMUTAVEL apos criacao!
    matchLabels:
      app: nginx
  strategy:
    type: RollingUpdate          # ou Recreate
    rollingUpdate:
      maxSurge: "25%"            # pods extras permitidos durante update
      maxUnavailable: "25%"      # pods que podem ficar indisponiveis
  template:                      # PodTemplateSpec
    metadata:
      labels:
        app: nginx               # DEVE corresponder ao selector
    spec:
      containers:
      - name: nginx
        image: nginx:1.25
        ports:
        - containerPort: 80
        resources:
          requests:
            cpu: "250m"
            memory: "128Mi"
          limits:
            cpu: "500m"
            memory: "256Mi"
\`\`\`

### Campos Importantes

| Campo | Default | Descricao |
|-------|---------|-----------|
| \`replicas\` | 1 | Numero desejado de Pods |
| \`selector\` | — | Seleciona quais Pods pertencem ao Deployment. **Imutavel** |
| \`strategy.type\` | RollingUpdate | Estrategia de atualizacao |
| \`revisionHistoryLimit\` | 10 | ReplicaSets antigos mantidos para rollback |
| \`progressDeadlineSeconds\` | 600 | Timeout para considerar rollout como falho |
| \`minReadySeconds\` | 0 | Tempo minimo que Pod deve ficar Ready |
| \`paused\` | false | Pausa o rollout para acumular mudancas |

> **Dica de prova**: O \`selector\` NAO pode ser alterado apos a criacao do Deployment. Ja o \`template\` pode (e e o que dispara rollouts).

---

## Criando um Deployment

### Via linha de comando (imperativo)

\`\`\`bash
# Criar deployment basico
kubectl create deployment webapp --image=nginx:1.25 --replicas=3

# Gerar YAML sem criar (essencial no exame!)
kubectl create deployment webapp --image=nginx:1.25 --replicas=3 \\
  --dry-run=client -o yaml > deployment.yaml

# Aplicar o manifesto
kubectl apply -f deployment.yaml
\`\`\`

### Diferenca entre apply e create

- \`kubectl apply\`: cria ou atualiza o recurso (declarativo, **recomendado**)
- \`kubectl create\`: cria o recurso, retorna erro se ja existir

---

## Estrategias de Atualizacao

### RollingUpdate (Padrao)

Atualiza os Pods **gradualmente**, mantendo a aplicacao disponivel durante todo o processo.

\`\`\`yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1          # ate 1 Pod extra durante update
    maxUnavailable: 2    # ate 2 Pods indisponiveis
\`\`\`

**maxSurge** — quantos Pods **a mais** podem existir alem do \`replicas\` durante o update:
- Valor inteiro: numero absoluto (ex: \`1\` = 1 pod extra)
- Porcentagem: \`"25%"\` de \`replicas\` (arredondado para cima)
- Default: 25%

**maxUnavailable** — quantos Pods podem ficar **indisponiveis** durante o update:
- Valor inteiro ou porcentagem (arredondado para baixo)
- Default: 25%
- NAO pode ser 0 se maxSurge tambem for 0

**Exemplo pratico**: Com \`replicas: 10\`, \`maxSurge: 1\`, \`maxUnavailable: 2\`:
- Pode ter ate 11 Pods no total (10 + 1)
- Pode ter ate 2 Pods indisponiveis
- O Kubernetes atualiza de 2 em 2 Pods

### Recreate

Termina **TODOS** os Pods antigos antes de criar os novos. Causa **downtime**, mas e simples.

\`\`\`yaml
strategy:
  type: Recreate    # nao tem sub-configuracoes
\`\`\`

**Quando usar Recreate:**
- Quando a aplicacao nao suporta duas versoes rodando ao mesmo tempo
- Quando ha incompatibilidade de schema no banco de dados
- Quando containers compartilham volume que nao pode ter acesso concorrente

---

## Rolling Updates na Pratica

### Atualizando a imagem

\`\`\`bash
# Metodo 1: kubectl set image
kubectl set image deployment/webapp nginx=nginx:1.26

# Metodo 2: editar diretamente
kubectl edit deployment webapp

# Metodo 3: alterar YAML e reaplicar (mais seguro)
kubectl apply -f deployment.yaml
\`\`\`

### Acompanhar o rollout

\`\`\`bash
# Status em tempo real
kubectl rollout status deployment/webapp

# Saida esperada:
# Waiting for deployment "webapp" rollout to finish: 2 of 3 updated replicas are available...
# deployment "webapp" successfully rolled out
\`\`\`

### O que dispara um rollout?

**DISPARA rollout** (muda o PodTemplateSpec):
- Alterar imagem do container
- Alterar variaveis de ambiente
- Alterar resources (requests/limits)
- Alterar labels do template
- Alterar qualquer campo em \`.spec.template\`

**NAO dispara rollout:**
- Alterar \`replicas\` (scaling imediato, sem novo ReplicaSet)
- Alterar \`minReadySeconds\`
- Alterar \`revisionHistoryLimit\`
- Alterar annotations do Deployment

---

## Rollback

### Historico de revisoes

\`\`\`bash
# Ver historico
kubectl rollout history deployment/webapp

# REVISION  CHANGE-CAUSE
# 1         <none>
# 2         <none>
# 3         <none>

# Ver detalhes de uma revisao especifica
kubectl rollout history deployment/webapp --revision=2
\`\`\`

### Fazendo rollback

\`\`\`bash
# Rollback para a revisao anterior
kubectl rollout undo deployment/webapp

# Rollback para revisao especifica
kubectl rollout undo deployment/webapp --to-revision=1
\`\`\`

> **Como funciona internamente**: O Deployment reativa o ReplicaSet da revisao anterior e escala ele de volta. O rollback em si gera uma **nova revisao** no historico.

### Registrando change-cause

\`\`\`bash
# Usando annotation para registrar motivo da mudanca
kubectl annotate deployment/webapp kubernetes.io/change-cause="upgrade to v1.26"

# Agora o historico mostra o motivo:
# REVISION  CHANGE-CAUSE
# 1         initial deployment
# 2         upgrade to v1.26
\`\`\`

---

## ReplicaSets e pod-template-hash

Cada rollout cria um **novo ReplicaSet**. O Deployment controller adiciona automaticamente uma label \`pod-template-hash\` a cada Pod e ReplicaSet para garantir unicidade.

\`\`\`bash
kubectl get replicasets -l app=nginx
# NAME                    DESIRED   CURRENT   READY
# webapp-75675f5897       3         3         3      (ativo)
# webapp-5d8f6b7c4a       0         0         0      (revisao anterior)
\`\`\`

O \`revisionHistoryLimit\` controla quantos ReplicaSets antigos (com 0 replicas) sao mantidos:
- Default: 10 (permite rollback ate 10 revisoes)
- Valor 0: nao mantem historico (nao recomendado)

---

## Rollover (Update durante Update)

Se voce atualizar o Deployment **enquanto um rollout anterior ainda esta em progresso**:

1. O Deployment cria um **novo ReplicaSet** para a nova versao
2. O ReplicaSet intermediario e **abandonado** (escala para 0)
3. O rollout continua apenas com o ReplicaSet mais recente

Isso significa que o Kubernetes e inteligente o suficiente para nao ficar preso em updates intermediarios.

---

## Scaling Proporcional

Se voce escalar o Deployment durante um rollout ativo, o Kubernetes distribui as replicas **proporcionalmente** entre os ReplicaSets:

Exemplo: durante um update de 10 replicas, se ja tem 5 no RS novo e 5 no RS antigo, e voce escala para 20, o resultado sera 10 no RS novo e 10 no antigo.

\`\`\`bash
# Manual scaling
kubectl scale deployment/webapp --replicas=5

# Autoscaling
kubectl autoscale deployment/webapp --min=3 --max=10 --cpu-percent=80
\`\`\`

---

## Pausing e Resuming

Permite acumular **multiplas mudancas** sem disparar rollouts intermediarios:

\`\`\`bash
# Pausar o deployment
kubectl rollout pause deployment/webapp

# Fazer multiplas alteracoes
kubectl set image deployment/webapp nginx=nginx:1.26
kubectl set resources deployment/webapp -c nginx \\
  --limits=cpu=200m,memory=256Mi

# Retomar — aplica TODAS as mudancas de uma vez
kubectl rollout resume deployment/webapp
\`\`\`

---

## Deployment Status e Conditions

\`\`\`bash
kubectl get deployment webapp -o yaml
\`\`\`

### Status Fields

| Campo | Descricao |
|-------|-----------|
| \`replicas\` | Total de Pods criados |
| \`updatedReplicas\` | Pods com template mais recente |
| \`readyReplicas\` | Pods prontos para receber trafego |
| \`availableReplicas\` | Pods prontos por pelo menos minReadySeconds |
| \`unavailableReplicas\` | Pods ainda sendo atualizados |

### Conditions

| Condition | Status | Significado |
|-----------|--------|-------------|
| Progressing | True | Rollout em andamento ou completado |
| Progressing | False | Rollout falhou (progressDeadlineSeconds excedido) |
| Available | True | Replicas minimas disponiveis |
| ReplicaFailure | True | Erro ao criar Pods |

### Deployment Falho

Um deployment e considerado **falho** quando nao progride dentro de \`progressDeadlineSeconds\` (default: 10 min). Causas comuns:
- Quota insuficiente
- Imagem nao encontrada (ImagePullBackOff)
- Permissoes insuficientes
- Probes falhando (CrashLoopBackOff)
- Limites de resources muito baixos

---

## Comandos Essenciais

\`\`\`bash
# Criar
kubectl create deployment webapp --image=nginx --replicas=3
kubectl create deployment webapp --image=nginx --dry-run=client -o yaml

# Gerenciar
kubectl get deployments
kubectl describe deployment webapp
kubectl get deployment webapp -o yaml

# Atualizar
kubectl set image deployment/webapp nginx=nginx:1.26
kubectl edit deployment webapp
kubectl apply -f deployment.yaml

# Rollout
kubectl rollout status deployment/webapp
kubectl rollout history deployment/webapp
kubectl rollout history deployment/webapp --revision=2
kubectl rollout undo deployment/webapp
kubectl rollout undo deployment/webapp --to-revision=1
kubectl rollout pause deployment/webapp
kubectl rollout resume deployment/webapp
kubectl rollout restart deployment/webapp

# Scale
kubectl scale deployment/webapp --replicas=5
kubectl autoscale deployment/webapp --min=2 --max=10 --cpu-percent=80

# Remover
kubectl delete deployment webapp
kubectl delete -f deployment.yaml
\`\`\`
`,

  quiz: [
    {
      question: 'Qual e a estrategia de deploy padrao no Kubernetes?',
      options: ['Recreate', 'RollingUpdate', 'Blue-Green', 'Canary'],
      correct: 1,
      explanation: 'RollingUpdate e a estrategia padrao. Ela atualiza pods gradualmente, garantindo zero downtime.'
    },
    {
      question: 'O que o parametro maxSurge controla?',
      options: [
        'Numero maximo de pods que podem falhar',
        'Numero maximo de pods extras durante o update',
        'Tempo maximo do rollout',
        'Numero maximo de revisoes no historico'
      ],
      correct: 1,
      explanation: 'maxSurge define quantos pods alem do desejado podem existir simultaneamente durante um rolling update. Default: 25%.'
    },
    {
      question: 'O que acontece se voce atualizar um Deployment enquanto um rollout anterior ainda esta em progresso?',
      options: [
        'O Kubernetes rejeita a atualizacao',
        'O rollout anterior e completado primeiro',
        'Um novo ReplicaSet e criado e o intermediario e abandonado',
        'O Deployment entra em estado de erro'
      ],
      correct: 2,
      explanation: 'O Kubernetes cria um novo ReplicaSet para a versao mais recente e abandona o ReplicaSet intermediario (rollover).'
    },
    {
      question: 'Qual campo do Deployment NAO pode ser alterado apos a criacao?',
      options: ['replicas', 'template', 'strategy', 'selector'],
      correct: 3,
      explanation: 'O .spec.selector e imutavel apos a criacao do Deployment. Tentar altera-lo resulta em erro de validacao.'
    },
    {
      question: 'Para que serve o campo revisionHistoryLimit?',
      options: [
        'Limitar o numero de Pods',
        'Definir quantos ReplicaSets antigos manter para rollback',
        'Controlar o numero maximo de rollouts por hora',
        'Limitar o historico de eventos do Deployment'
      ],
      correct: 1,
      explanation: 'revisionHistoryLimit (default: 10) controla quantos ReplicaSets antigos sao mantidos. Cada um permite rollback para aquela revisao.'
    },
    {
      question: 'Alterar o numero de replicas de um Deployment dispara um novo rollout?',
      options: [
        'Sim, sempre cria novo ReplicaSet',
        'Nao, scaling e feito sem criar novo ReplicaSet',
        'Depende da estrategia configurada',
        'Sim, mas apenas com RollingUpdate'
      ],
      correct: 1,
      explanation: 'Alterar replicas faz scaling imediato no ReplicaSet atual. Apenas mudancas no .spec.template (PodTemplateSpec) disparam rollouts.'
    },
    {
      question: 'Qual o valor padrao de progressDeadlineSeconds?',
      options: ['60 (1 minuto)', '300 (5 minutos)', '600 (10 minutos)', '1800 (30 minutos)'],
      correct: 2,
      explanation: 'O default e 600 segundos (10 minutos). Se o rollout nao progridir nesse tempo, o Deployment e marcado como falho.'
    },
    {
      question: 'Qual comando permite acumular multiplas mudancas antes de aplicar o rollout?',
      options: [
        'kubectl rollout wait',
        'kubectl rollout pause seguido de kubectl rollout resume',
        'kubectl rollout batch',
        'kubectl rollout hold'
      ],
      correct: 1,
      explanation: 'kubectl rollout pause pausa o Deployment. Voce faz as mudancas desejadas e depois kubectl rollout resume aplica tudo de uma vez.'
    },
    {
      question: 'O que a label pod-template-hash faz?',
      options: [
        'Identifica o namespace do Pod',
        'Garante unicidade entre ReplicaSets de diferentes revisoes',
        'Controla a ordem de criacao dos Pods',
        'Define prioridade de scheduling'
      ],
      correct: 1,
      explanation: 'O Deployment controller adiciona automaticamente pod-template-hash a cada Pod/ReplicaSet. O valor e o hash do PodTemplateSpec, garantindo que cada revisao tenha identificador unico.'
    },
    {
      question: 'Quando usar a estrategia Recreate?',
      options: [
        'Quando precisa de zero downtime',
        'Quando a aplicacao nao pode ter duas versoes rodando ao mesmo tempo',
        'Quando tem muitas replicas',
        'Quando usa HPA'
      ],
      correct: 1,
      explanation: 'Recreate e usado quando a aplicacao nao suporta duas versoes simultaneas (ex: incompatibilidade de schema no banco, volumes exclusivos).'
    }
  ],

  flashcards: [
    { front: 'O que e um Deployment?', back: 'Objeto que gerencia aplicacoes de forma declarativa. Cria e gerencia ReplicaSets, que por sua vez gerenciam Pods. Permite rolling updates, rollbacks, scaling e self-healing.' },
    { front: 'Deployment vs ReplicaSet', back: 'Deployment gerencia ReplicaSets e fornece rolling updates, rollbacks e historico. ReplicaSet apenas garante N replicas de um Pod. Nunca crie ReplicaSets diretamente.' },
    { front: 'maxSurge e maxUnavailable', back: 'maxSurge: pods extras permitidos durante update (default 25%). maxUnavailable: pods que podem ficar indisponiveis (default 25%). Podem ser inteiro ou porcentagem. Ambos nao podem ser 0 ao mesmo tempo.' },
    { front: 'O que dispara um rollout?', back: 'Qualquer mudanca no .spec.template (PodTemplateSpec): imagem, env vars, resources, labels do template. Mudancas em replicas, annotations do Deployment, revisionHistoryLimit NAO disparam rollout.' },
    { front: 'revisionHistoryLimit', back: 'Numero de ReplicaSets antigos mantidos para rollback (default: 10). Valor 0 = sem historico. Cada update cria novo ReplicaSet; os antigos ficam com 0 replicas.' },
    { front: 'progressDeadlineSeconds', back: 'Tempo maximo (default: 600s/10min) para o rollout progridir. Se exceder, Deployment e marcado como falho com condition Progressing=False. Nao faz auto-retry.' },
    { front: 'Como fazer rollback para revisao especifica?', back: 'kubectl rollout undo deployment/<name> --to-revision=N. Sem --to-revision, volta para a revisao anterior. O rollback gera uma nova revisao no historico.' },
    { front: 'Como pausar um rollout?', back: 'kubectl rollout pause deployment/<name>. Faca as mudancas desejadas. kubectl rollout resume deployment/<name> aplica tudo junto.' },
    { front: 'Selector e imutavel', back: 'O .spec.selector NAO pode ser alterado apos criacao do Deployment. Se precisar mudar o selector, deve deletar e recriar o Deployment.' },
    { front: 'Rollover (update durante update)', back: 'Se atualizar durante rollout ativo: novo ReplicaSet e criado, RS intermediario e abandonado (scale 0). Kubernetes nao fica preso em updates intermediarios.' },
    { front: 'Gerar YAML sem criar recurso', back: 'kubectl create deployment webapp --image=nginx --replicas=3 --dry-run=client -o yaml > deploy.yaml. Essencial no exame CKA/CKAD para ganhar tempo.' },
    { front: 'Comando rollout restart', back: 'kubectl rollout restart deployment/<name>. Recria todos os Pods do Deployment mantendo a mesma configuracao. Util para forcar reload de ConfigMaps/Secrets.' }
  ],

  lab: {
    scenario: 'Voce e responsavel por uma aplicacao web em producao que precisa ser atualizada para uma nova versao, com rollback de seguranca caso algo de errado.',
    objective: 'Dominar o ciclo de vida completo de Deployments: criacao, atualizacao, rollback, scaling e troubleshooting.',
    steps: [
      {
        title: 'Criar um Deployment',
        instruction: 'Crie um deployment chamado \`webapp\` com 3 replicas usando \`nginx:1.24\`. Defina limits de CPU (500m) e memoria (256Mi) e requests de CPU (250m) e memoria (128Mi).',
        hints: [
          'Use kubectl create deployment com --dry-run=client -o yaml para gerar o YAML base.',
          'kubectl create deployment webapp --image=nginx:1.24 --replicas=3 --dry-run=client -o yaml > webapp.yaml',
          'Edite o YAML para adicionar resources e aplique com kubectl apply -f webapp.yaml'
        ],
        solution: '```yaml\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: webapp\nspec:\n  replicas: 3\n  selector:\n    matchLabels:\n      app: webapp\n  template:\n    metadata:\n      labels:\n        app: webapp\n    spec:\n      containers:\n      - name: nginx\n        image: nginx:1.24\n        resources:\n          requests:\n            cpu: \"250m\"\n            memory: \"128Mi\"\n          limits:\n            cpu: \"500m\"\n            memory: \"256Mi\"\n```\n\n```bash\nkubectl apply -f webapp.yaml\nkubectl rollout status deployment/webapp\n```'
      },
      {
        title: 'Configurar estrategia RollingUpdate',
        instruction: 'Configure o deployment com maxSurge=1 e maxUnavailable=2. Depois atualize a imagem para nginx:1.25 e acompanhe o rollout.',
        hints: [
          'Edite o YAML adicionando strategy.type: RollingUpdate com rollingUpdate.',
          'Use kubectl rollout status para acompanhar.'
        ],
        solution: '```bash\n# Editar o deployment\nkubectl edit deployment webapp\n\n# Adicionar:\n# strategy:\n#   type: RollingUpdate\n#   rollingUpdate:\n#     maxSurge: 1\n#     maxUnavailable: 2\n\n# Atualizar imagem\nkubectl set image deployment/webapp nginx=nginx:1.25\n\n# Acompanhar\nkubectl rollout status deployment/webapp\n```'
      },
      {
        title: 'Verificar ReplicaSets e historico',
        instruction: 'Liste os ReplicaSets gerenciados pelo deployment e veja o historico de revisoes. Verifique a versao da imagem na revisao 1.',
        hints: [
          'Use kubectl get replicasets com label selector.',
          'Use kubectl rollout history com --revision para ver detalhes.'
        ],
        solution: '```bash\n# Listar ReplicaSets\nkubectl get rs -l app=webapp\n\n# Historico de revisoes\nkubectl rollout history deployment/webapp\n\n# Detalhes da revisao 1\nkubectl rollout history deployment/webapp --revision=1\n```'
      },
      {
        title: 'Rollback de emergencia',
        instruction: 'Simule um problema: atualize para nginx:inexistente (imagem que nao existe). Observe o rollout falhando, depois faca rollback para a versao anterior.',
        hints: [
          'kubectl set image deployment/webapp nginx=nginx:inexistente',
          'Observe com kubectl rollout status e kubectl get pods',
          'Use kubectl rollout undo para reverter'
        ],
        solution: '```bash\n# Simular problema\nkubectl set image deployment/webapp nginx=nginx:inexistente\n\n# Observar falha\nkubectl rollout status deployment/webapp\nkubectl get pods -l app=webapp\n# Vera pods em ImagePullBackOff\n\n# Rollback\nkubectl rollout undo deployment/webapp\nkubectl rollout status deployment/webapp\n\n# Verificar\nkubectl describe deployment webapp | grep Image\n```'
      },
      {
        title: 'Pausar, acumular mudancas e retomar',
        instruction: 'Pause o deployment. Faca duas mudancas: atualize a imagem para nginx:1.26 E altere o limit de memoria para 512Mi. Depois retome o rollout e verifique que apenas UM rollout aconteceu.',
        hints: [
          'kubectl rollout pause deployment/webapp',
          'Faca as mudancas com kubectl set image e kubectl set resources',
          'kubectl rollout resume deployment/webapp'
        ],
        solution: '```bash\n# Pausar\nkubectl rollout pause deployment/webapp\n\n# Mudancas acumuladas\nkubectl set image deployment/webapp nginx=nginx:1.26\nkubectl set resources deployment/webapp -c nginx --limits=memory=512Mi\n\n# Retomar\nkubectl rollout resume deployment/webapp\nkubectl rollout status deployment/webapp\n\n# Verificar que foi apenas 1 revisao nova\nkubectl rollout history deployment/webapp\n```'
      },
      {
        title: 'Escalar e validar disponibilidade',
        instruction: 'Escale o deployment para 10 replicas. Verifique que todos os pods estao Running e que os resources estao corretos.',
        hints: [
          'kubectl scale deployment/webapp --replicas=10',
          'Use kubectl get pods -o wide para ver distribuicao por nodes'
        ],
        solution: '```bash\n# Escalar\nkubectl scale deployment/webapp --replicas=10\n\n# Verificar\nkubectl get pods -l app=webapp -o wide\nkubectl get deployment webapp\n\n# Validar resources\nkubectl get deployment webapp -o jsonpath=\'{.spec.template.spec.containers[0].resources}\'\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Deployment travado — rollout nao progride',
      symptom: 'kubectl rollout status deployment/webapp fica esperando e nunca completa. kubectl get deployment mostra READY como 2/3 ou similar. O rollout nao avanca e nao falha explicitamente.',
      diagnosis: '```bash\n# Verificar status do deployment\nkubectl describe deployment webapp\n# Procurar por Conditions:\n# Progressing=True/False e Available=True/False\n\n# Verificar pods\nkubectl get pods -l app=webapp\n# Procurar pods em ImagePullBackOff, CrashLoopBackOff, Pending\n\n# Ver eventos\nkubectl get events --field-selector involvedObject.name=webapp --sort-by=.lastTimestamp\n\n# Verificar se progressDeadlineSeconds foi excedido\nkubectl get deployment webapp -o jsonpath=\'{.status.conditions}\' | python -m json.tool\n```',
      solution: 'Causas comuns e solucoes:\n\n1. **ImagePullBackOff**: Imagem nao encontrada. Verifique nome/tag da imagem e imagePullSecrets.\n2. **CrashLoopBackOff**: Container crasha ao iniciar. Use kubectl logs e kubectl logs --previous.\n3. **Insufficient resources**: Cluster sem CPU/memoria. Verifique kubectl describe nodes.\n4. **progressDeadlineSeconds excedido**: Aumente o valor ou investigue a causa raiz.\n\n```bash\n# Se precisar, faca rollback\nkubectl rollout undo deployment/webapp\n```'
    },
    {
      title: 'Pods do Deployment em CrashLoopBackOff apos update',
      symptom: 'Apos atualizar a imagem, os novos Pods entram em CrashLoopBackOff. Os Pods antigos foram terminados (estrategia Recreate) ou parcialmente (RollingUpdate).',
      diagnosis: '```bash\n# Ver estado dos pods\nkubectl get pods -l app=webapp\n\n# Verificar logs do container\nkubectl logs deployment/webapp\nkubectl logs deployment/webapp --previous\n\n# Verificar eventos\nkubectl describe pod <nome-do-pod-crashando>\n# Procurar: Exit Code, OOMKilled, Liveness probe failed\n```',
      solution: '```bash\n# 1. Rollback imediato\nkubectl rollout undo deployment/webapp\n\n# 2. Verificar a revisao que funcionava\nkubectl rollout history deployment/webapp\nkubectl rollout undo deployment/webapp --to-revision=<N>\n\n# 3. Diagnosticar o problema na nova versao antes de tentar novamente\n# - Verificar exit code (137=OOMKilled, 1=erro app)\n# - Verificar se ConfigMaps/Secrets existem\n# - Verificar se probes estao corretas\n```'
    },
    {
      title: 'Deployment mostra replicas mas nenhum Pod existe',
      symptom: 'kubectl get deployment mostra replicas desejadas mas kubectl get pods nao mostra Pods correspondentes.',
      diagnosis: '```bash\n# Verificar ReplicaSets\nkubectl get rs -l app=webapp\n\n# Verificar eventos do ReplicaSet\nkubectl describe rs <nome-do-replicaset>\n\n# Causas comuns:\n# - ResourceQuota excedida no namespace\n# - LimitRange rejeitando Pods sem resources\n# - PodSecurityPolicy/PodSecurityAdmission bloqueando\n\n# Verificar quotas\nkubectl get resourcequota -n <namespace>\nkubectl describe resourcequota -n <namespace>\n```',
      solution: '```bash\n# Se for quota, liberar espaco ou aumentar quota\nkubectl delete pods desnecessarios\n\n# Se for LimitRange, adicionar resources ao template\nkubectl set resources deployment/webapp -c nginx \\n  --requests=cpu=100m,memory=64Mi \\n  --limits=cpu=200m,memory=128Mi\n\n# Se for PodSecurity, verificar labels do namespace\nkubectl get namespace <ns> -o yaml\n```'
    }
  ]
};
