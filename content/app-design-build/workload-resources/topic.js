window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['app-design-build/workload-resources'] = {
  theory: `# Jobs, CronJobs, DaemonSets e StatefulSets

## Job: Tarefas de Execucao Finita

Um **Job** cria um ou mais Pods e garante que um numero especificado deles seja concluido com sucesso. Diferente de Deployments, Jobs encerram quando a tarefa termina.

### Spec Completa de um Job

\`\`\`yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: processar-relatorio
  namespace: batch
spec:
  # Numero de conclusoes bem-sucedidas necessarias (padrao: 1)
  completions: 3
  # Quantos Pods rodam em paralelo (padrao: 1)
  parallelism: 2
  # Numero maximo de tentativas antes de declarar falha (padrao: 6)
  backoffLimit: 4
  # Tempo maximo em segundos para o Job completar (encerra forcado apos isso)
  activeDeadlineSeconds: 600
  # Segundos apos completar para deletar automaticamente o Job e seus Pods
  ttlSecondsAfterFinished: 3600
  template:
    spec:
      restartPolicy: OnFailure   # Obrigatorio para Jobs: Never ou OnFailure
      containers:
        - name: worker
          image: python:3.11-slim
          command: ["python", "/scripts/processar.py"]
          resources:
            requests:
              cpu: "200m"
              memory: "256Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
\`\`\`

### Modos de Execucao

| Modo | completions | parallelism | Comportamento |
|---|---|---|---|
| **Non-parallel** | 1 | 1 | Um Pod, uma execucao (padrao) |
| **Parallel fixed** | N | M | N pods total, M em paralelo |
| **Work queue** | omitido | M | M pods em paralelo ate um completar com sucesso |

### restartPolicy em Jobs

- \`OnFailure\`: Kubernetes reinicia o container no mesmo Pod ao falhar
- \`Never\`: Kubernetes cria um novo Pod ao falhar (util para debug, pois o Pod falho persiste)

---

## CronJob: Tarefas Agendadas

\`\`\`yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: backup-diario
spec:
  # Sintaxe cron padrao: minuto hora dia-do-mes mes dia-da-semana
  schedule: "0 2 * * *"   # Todo dia as 2h da manha
  # O que fazer se o Job anterior ainda estiver rodando
  concurrencyPolicy: Forbid   # Allow | Forbid | Replace
  # Quantos Jobs bem-sucedidos manter no historico (padrao: 3)
  successfulJobsHistoryLimit: 5
  # Quantos Jobs falhos manter no historico (padrao: 1)
  failedJobsHistoryLimit: 3
  # Deadline em segundos para iniciar um Job atrasado
  # Se o CronJob nao foi agendado no tempo, e skipped apos este prazo
  startingDeadlineSeconds: 300
  # Se true, suspende novos Jobs (nao afeta os em execucao)
  suspend: false
  jobTemplate:
    spec:
      backoffLimit: 2
      ttlSecondsAfterFinished: 7200
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: backup
              image: bitnami/kubectl:latest
              command:
                - /bin/sh
                - -c
                - |
                  echo "Iniciando backup em $(date)"
                  kubectl get all --all-namespaces -o yaml > /backup/cluster-state.yaml
                  echo "Backup concluido"
              resources:
                requests:
                  cpu: "100m"
                  memory: "128Mi"
                limits:
                  cpu: "200m"
                  memory: "256Mi"
\`\`\`

### Sintaxe Cron Rapida

| Expressao | Significado |
|---|---|
| \`* * * * *\` | Todo minuto |
| \`0 * * * *\` | Toda hora no minuto 0 |
| \`0 0 * * *\` | Meia-noite todo dia |
| \`0 0 * * 0\` | Domingo a meia-noite |
| \`*/5 * * * *\` | A cada 5 minutos |
| \`0 9-17 * * 1-5\` | De hora em hora das 9h-17h, seg-sex |

### concurrencyPolicy

- \`Allow\` (padrao): permite multiplos Jobs simultaneos
- \`Forbid\`: pula o novo Job se o anterior ainda estiver rodando
- \`Replace\`: cancela o Job em execucao e inicia um novo

---

## DaemonSet: Um Pod por Node

DaemonSet garante que **todos** (ou um subconjunto) dos nodes executem uma copia de um Pod. Ideal para agentes de monitoramento, logging, networking e seguranca.

\`\`\`yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: node-exporter
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: node-exporter
  updateStrategy:
    type: RollingUpdate        # RollingUpdate ou OnDelete
    rollingUpdate:
      maxUnavailable: 1        # Maximo de nodes sem o DaemonSet durante update
  template:
    metadata:
      labels:
        app: node-exporter
    spec:
      # Permite rodar em nodes com taints (ex: nodes de sistema)
      tolerations:
        - key: node-role.kubernetes.io/control-plane
          operator: Exists
          effect: NoSchedule
        - key: node-role.kubernetes.io/master
          operator: Exists
          effect: NoSchedule
      # Restringe a nodes com label especifico
      nodeSelector:
        kubernetes.io/os: linux
      hostNetwork: true          # Acessa rede do host (comum para network agents)
      hostPID: false
      containers:
        - name: node-exporter
          image: prom/node-exporter:v1.7.0
          args:
            - --path.rootfs=/host
          ports:
            - containerPort: 9100
              hostPort: 9100
              name: metrics
          resources:
            requests:
              cpu: "50m"
              memory: "64Mi"
            limits:
              cpu: "200m"
              memory: "128Mi"
          volumeMounts:
            - name: host-root
              mountPath: /host
              readOnly: true
      volumes:
        - name: host-root
          hostPath:
            path: /
      # Usa a prioridade maxima para nao ser evictado
      priorityClassName: system-node-critical
\`\`\`

### Update Strategies do DaemonSet

| Strategy | Comportamento |
|---|---|
| \`RollingUpdate\` | Atualiza Pods gradualmente (maxUnavailable define velocidade) |
| \`OnDelete\` | Atualiza apenas quando o Pod e deletado manualmente |

---

## StatefulSet: Workloads com Estado

StatefulSets gerenciam Pods que precisam de **identidade estavel** e **armazenamento persistente**.

\`\`\`yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: postgres-headless   # Servico headless obrigatorio
  replicas: 3
  selector:
    matchLabels:
      app: postgres
  # Pods sao criados em ordem: postgres-0, postgres-1, postgres-2
  # Deletados em ordem reversa
  podManagementPolicy: OrderedReady  # ou Parallel
  updateStrategy:
    type: RollingUpdate
    rollingUpdate:
      partition: 0    # Atualiza apenas Pods com ordinal >= partition (canary)
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
        - name: postgres
          image: postgres:16-alpine
          env:
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-secret
                  key: password
            - name: PGDATA
              value: /var/lib/postgresql/data/pgdata
          ports:
            - containerPort: 5432
              name: postgres
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
          resources:
            requests:
              cpu: "250m"
              memory: "512Mi"
            limits:
              cpu: "1000m"
              memory: "1Gi"
  # Cria um PVC por Pod: data-postgres-0, data-postgres-1, data-postgres-2
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        storageClassName: fast-ssd
        resources:
          requests:
            storage: 20Gi
\`\`\`

### Identidade Estavel nos StatefulSets

Cada Pod recebe:
- **Nome previsivel**: \`<statefulset-name>-<ordinal>\` (ex: postgres-0)
- **DNS estavel**: \`<pod-name>.<service-name>.<namespace>.svc.cluster.local\`
- **PVC persistente**: nao e deletado se o Pod for removido (persiste para reuso)

Necessita de um **Headless Service** (clusterIP: None) para o DNS funcionar:

\`\`\`yaml
apiVersion: v1
kind: Service
metadata:
  name: postgres-headless
spec:
  clusterIP: None      # Headless: sem IP virtual, DNS retorna IPs dos Pods
  selector:
    app: postgres
  ports:
    - port: 5432
      name: postgres
\`\`\`
`,

  quiz: [
    {
      question: 'Um Job tem completions: 5 e parallelism: 2. Como ele executa?',
      options: [
        'Executa 2 Pods em paralelo ate que 5 sejam concluidos com sucesso',
        'Executa 5 Pods em paralelo com limite de 2 tentativas',
        'Executa 2 Pods por vez, reiniciando se um falhar, ate um total de 5 tentativas',
        'Executa todos os 5 Pods de uma vez'
      ],
      correct: 0,
      explanation: 'completions: 5 define que 5 execucoes bem-sucedidas sao necessarias. parallelism: 2 define que no maximo 2 Pods rodam ao mesmo tempo. O Job cria novos Pods conforme os anteriores completam, mantendo no maximo 2 em paralelo, ate atingir 5 conclusoes bem-sucedidas.'
    },
    {
      question: 'Qual e o comportamento do concurrencyPolicy: Replace em um CronJob?',
      options: [
        'Permite multiplos Jobs rodando ao mesmo tempo',
        'Pula o agendamento se o Job anterior ainda esta rodando',
        'Cancela o Job em execucao e inicia um novo no horario agendado',
        'Espera o Job anterior terminar antes de iniciar o proximo'
      ],
      correct: 2,
      explanation: 'Replace cancela o Job atualmente em execucao e cria um novo no horario agendado. Util quando e mais importante ter a versao mais recente rodando do que garantir que o Job anterior complete. Forbid pula o novo Job. Allow permite multiplos simultaneos.'
    },
    {
      question: 'Por que DaemonSets precisam de tolerations para rodar em nodes de control-plane?',
      options: [
        'Control-plane nodes tem taints que impedem Pods regulares de serem agendados neles',
        'DaemonSets so funcionam em worker nodes por design',
        'Control-plane nodes nao tem kubelet instalado',
        'DaemonSets requerem permissoes especiais de cluster-admin'
      ],
      correct: 0,
      explanation: 'Nodes de control-plane tem taints como "node-role.kubernetes.io/control-plane:NoSchedule" para evitar que workloads regulares rodem neles. Para que um DaemonSet inclua esses nodes, precisa ter tolerations correspondentes. Isso e intencional: agentes de sistema (como Fluentd ou node-exporter) frequentemente precisam rodar em TODOS os nodes, incluindo control-plane.'
    },
    {
      question: 'Qual a diferenca entre restartPolicy: OnFailure e restartPolicy: Never em um Job?',
      options: [
        'OnFailure reinicia o container no mesmo Pod; Never cria um novo Pod ao falhar',
        'Nao ha diferenca pratica',
        'Never e invalido para Jobs',
        'OnFailure cria novos Pods; Never reinicia no mesmo Pod'
      ],
      correct: 0,
      explanation: 'OnFailure: se o container falha, o kubelet reinicia o container NO MESMO Pod (Pod persiste, apenas o container reinicia). Never: se o container falha, o Job cria um NOVO Pod (o Pod falho permanece com status Failed, util para debug). backoffLimit controla quantos Pods falhos sao tolerados antes de o Job ser marcado como falho.'
    },
    {
      question: 'O que o campo ttlSecondsAfterFinished em um Job faz?',
      options: [
        'Define o tempo maximo que o Job pode ficar em execucao',
        'Define quantos segundos apos completar (sucesso ou falha) o Job e automaticamente deletado',
        'Configura o intervalo de retry em caso de falha',
        'Define o tempo de espera entre a criacao do Job e seu inicio'
      ],
      correct: 1,
      explanation: 'ttlSecondsAfterFinished ativa o TTL Controller do Kubernetes: apos o Job completar (com sucesso ou falha), ele aguarda o numero de segundos configurado e entao deleta automaticamente o Job E seus Pods. Util para limpeza automatica em ambientes com muitos Jobs batch. Valor 0 deleta imediatamente apos completar.'
    },
    {
      question: 'Em um StatefulSet com 3 replicas, qual e a ordem de criacao e delecao dos Pods?',
      options: [
        'Criacao e delecao sao sempre em ordem aleatoria',
        'Criacao em ordem crescente (0,1,2); delecao em ordem decrescente (2,1,0)',
        'Criacao e delecao em paralelo',
        'Criacao em ordem decrescente (2,1,0); delecao em ordem crescente (0,1,2)'
      ],
      correct: 1,
      explanation: 'Com podManagementPolicy: OrderedReady (padrao), o StatefulSet cria Pods em ordem sequencial crescente (pod-0 deve estar Running e Ready antes de pod-1 ser criado, e assim por diante). Na delecao/scale-down, a ordem e reversa (pod-2 e deletado primeiro). Isso garante que dependencias entre Pods (como eleicao de lider em bancos de dados distribuidos) sejam respeitadas.'
    },
    {
      question: 'startingDeadlineSeconds: 300 em um CronJob significa que:',
      options: [
        'O Job deve completar em 300 segundos',
        'O Job aguarda 300 segundos antes de iniciar',
        'Se o Job nao puder iniciar dentro de 300 segundos do horario agendado, e marcado como missed e pulado',
        'O Job tentara por 300 segundos antes de falhar'
      ],
      correct: 2,
      explanation: 'startingDeadlineSeconds define a janela de tolerancia para inicio tardio. Se o CronJob nao conseguir criar o Job dentro dessa janela apos o horario agendado (ex: o controller estava inativo), o agendamento e marcado como "missed". Se muitos agendamentos forem perdidos (> 100), o CronJob para de criar novos Jobs ate ser inspecionado.'
    },
    {
      question: 'Como criar um Job que processa itens em indice paralelo (cada Pod processa um indice unico)?',
      options: [
        'Usar completionMode: Indexed e acessar JOB_COMPLETION_INDEX em cada Pod',
        'Usar parallelism: N e um loop no container para processar todos os itens',
        'Criar N Jobs separados manualmente',
        'Usar um DaemonSet em vez de Job para processamento paralelo'
      ],
      correct: 0,
      explanation: 'completionMode: Indexed (Indexed Job) cria um Pod para cada index de 0 a completions-1. O index e disponivel via variavel de ambiente JOB_COMPLETION_INDEX. Ideal para processamento paralelo de itens em um array ou lista, onde cada Pod sabe exatamente qual fatia processar.'
    },
    {
      question: 'Qual e a estrategia de atualizacao padrao de um DaemonSet?',
      options: [
        'Recreate - deleta todos os Pods antes de criar os novos',
        'RollingUpdate - atualiza um node por vez (com maxSurge e maxUnavailable)',
        'OnDelete - Pods sao atualizados apenas quando deletados manualmente',
        'Parallel - atualiza todos os nodes simultaneamente'
      ],
      correct: 1,
      explanation: 'DaemonSets tem dois tipos de updateStrategy: RollingUpdate (padrao, atualiza um node por vez conforme controlado por maxUnavailable) e OnDelete (Pods sao atualizados apenas quando voce os deleta manualmente). Para DaemonSets criticos como agentes de rede, OnDelete pode ser preferido para controle manual.'
    },
    {
      question: 'Um Job completou com sucesso. Como inspecionar os logs do Pod que rodou o Job apos ele ser completado?',
      options: [
        'Nao e possivel - Pods de Jobs sao deletados apos completar',
        'kubectl logs job/meu-job (o pod e mantido por padrao ate o Job ser deletado)',
        'kubectl logs --completed job/meu-job',
        'O Job mantém os logs em um ConfigMap automaticamente'
      ],
      correct: 1,
      explanation: 'Por padrao, Pods de Jobs completados ficam no estado Completed e NAO sao deletados automaticamente (a menos que ttlSecondsAfterFinished seja configurado). Voce pode acessar os logs com kubectl logs job/meu-job ou kubectl logs <pod-name>. Isso e util para debug. Use ttlSecondsAfterFinished para limpeza automatica em producao.'
    },
    {
      question: 'Como fazer um CronJob suspender temporariamente sem deletar a definicao?',
      options: [
        'kubectl delete cronjob meu-cron --keep-schedule',
        'kubectl patch cronjob meu-cron -p \'{"spec":{"suspend":true}}\'',
        'kubectl scale cronjob meu-cron --replicas=0',
        'kubectl annotate cronjob meu-cron suspend=true'
      ],
      correct: 1,
      explanation: 'O campo spec.suspend: true pausa o CronJob sem deleta-lo. Novos Jobs nao serao criados enquanto suspenso, mas Jobs em execucao continuam. Para reativar: kubectl patch cronjob meu-cron -p \'{"spec":{"suspend":false}}\'. Util para manutencao ou pausar processamento temporariamente.'
    },
    {
      question: 'Qual e a diferenca fundamental entre um DaemonSet e um Deployment?',
      options: [
        'DaemonSets nao suportam rolling updates, Deployments suportam',
        'DaemonSets garantem exatamente um Pod por node (elegivel), Deployments gerenciam um numero fixo de replicas',
        'Deployments rodam em cada node, DaemonSets rodam apenas no control-plane',
        'Nao ha diferenca pratica entre os dois'
      ],
      correct: 1,
      explanation: 'DaemonSets garantem que exatamente um Pod rode em CADA node do cluster (ou em nodes selecionados via nodeSelector). Novos nodes recebem automaticamente o Pod. Casos de uso: agentes de monitoramento, log collectors, plugins de rede, drivers de dispositivo. Deployments gerenciam N replicas distribuidas entre nodes disponiveis, sem garantia de "um por node".'
    }
  ],

  flashcards: [
    {
      front: 'Qual o restartPolicy obrigatorio para Pods de Job e quais sao as opcoes?',
      back: 'Jobs exigem restartPolicy: OnFailure ou Never. Nao podem usar Always (que e o padrao para Pods normais). OnFailure: reinicia o container no mesmo Pod. Never: cria um novo Pod ao falhar (Pod falho fica visivel para debug). O campo backoffLimit controla quantas falhas sao toleradas antes do Job ser marcado como Failed.'
    },
    {
      front: 'O que e um Headless Service e por que StatefulSets precisam de um?',
      back: 'Headless Service tem clusterIP: None. Em vez de criar um IP virtual, o DNS retorna diretamente os IPs dos Pods. StatefulSets precisam de um porque cada Pod precisa de um DNS estavel e unico no formato: <pod-name>.<service-name>.<namespace>.svc.cluster.local. Isso permite que clientes (ex: replicas de um banco de dados) se conectem a instancias especificas pelo nome.'
    },
    {
      front: 'Quais sao os tres valores de concurrencyPolicy em CronJobs e o que fazem?',
      back: 'Allow (padrao): permite multiplos Jobs do mesmo CronJob rodarem simultaneamente. Forbid: pula o novo agendamento se o Job anterior ainda esta rodando. Replace: cancela o Job em execucao e inicia um novo no horario agendado. Escolha baseada no caso de uso: tarefas idempotentes -> Allow; tarefas criticas com estado -> Forbid; tarefas de snapshot/sync -> Replace.'
    },
    {
      front: 'Como limitar um DaemonSet para rodar apenas em nodes especificos?',
      back: 'Duas formas principais: (1) nodeSelector: adiciona um campo nodeSelector ao spec.template.spec com labels que o node deve ter (ex: tipo: gpu). (2) nodeAffinity: mais expressivo, permite regras required/preferred e operadores como In, NotIn, Exists. Para incluir nodes com taints, adicione tolerations correspondentes.'
    },
    {
      front: 'O que acontece com os PVCs de um StatefulSet quando o StatefulSet e deletado?',
      back: 'Por padrao, os PVCs criados pelo volumeClaimTemplates do StatefulSet NAO sao deletados quando o StatefulSet e removido. Isso e intencional para proteger dados persistentes. Os PVCs ficam "orphaned" e precisam ser deletados manualmente. Para deletar junto, use: kubectl delete statefulset <nome> --cascade=foreground e depois delete os PVCs, ou configure persistentVolumeClaimRetentionPolicy (feature gate, Kubernetes 1.27+).'
    },
    {
      front: 'Qual a diferenca entre activeDeadlineSeconds e backoffLimit em Jobs?',
      back: 'activeDeadlineSeconds: tempo maximo TOTAL em segundos que o Job pode ficar ativo (conta desde a criacao do primeiro Pod). Se excedido, o Job inteiro e terminado com FailureReason: DeadlineExceeded, independente do backoffLimit. backoffLimit: numero maximo de Pods que podem falhar antes de o Job ser marcado como Failed. Sao mecanismos complementares: um limita por tempo, o outro por numero de falhas.'
    },
    {
      front: 'Quais sao as duas update strategies de um DaemonSet?',
      back: 'RollingUpdate (padrao): atualiza Pods gradualmente node por node. maxUnavailable controla quantos nodes podem ficar sem o Pod durante o update (padrao: 1). O controlador deleta o Pod antigo e aguarda o novo ficar Running antes de ir para o proximo node. OnDelete: o DaemonSet SÓ atualiza o Pod de um node quando o Pod e manualmente deletado (kubectl delete pod). Util para updates controlados manualmente.'
    }
  ],

  lab: {
    scenario: 'A equipe de dados precisa de tres componentes: (1) um Job para processar um relatorio one-shot, (2) um CronJob para backup diario automatico, e (3) um DaemonSet para coleta de metricas em todos os nodes do cluster.',
    objective: 'Criar e gerenciar os tres tipos de workload batch/daemon, verificar seu funcionamento e entender o ciclo de vida de cada um.',
    steps: [
      {
        title: 'Criar e monitorar um Job com paralelismo',
        instruction: `Crie um Job que simula o processamento de um relatorio com 4 tarefas paralelas (2 por vez). O Job deve ter um limite de tempo de 120 segundos e limpeza automatica apos 60 segundos de conclusao.`,
        hints: [
          'completions: 4 e parallelism: 2 cria 2 Pods de cada vez ate 4 conclusoes',
          'Use restartPolicy: Never para que Pods falhos fiquem visiveis',
          'Monitore com: kubectl get pods -l job-name=processar-relatorio --watch',
          'kubectl logs job/processar-relatorio mostra logs do primeiro Pod'
        ],
        solution: `\`\`\`yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: processar-relatorio
spec:
  completions: 4
  parallelism: 2
  backoffLimit: 2
  activeDeadlineSeconds: 120
  ttlSecondsAfterFinished: 60
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: worker
          image: busybox:1.36
          command:
            - /bin/sh
            - -c
            - |
              echo "Iniciando processamento em $(hostname) - $(date)"
              sleep $((RANDOM % 10 + 5))
              echo "Processamento concluido com sucesso"
          resources:
            requests:
              cpu: "50m"
              memory: "32Mi"
            limits:
              cpu: "100m"
              memory: "64Mi"
\`\`\`

\`\`\`bash
# Aplicar o Job
kubectl apply -f job.yaml

# Monitorar os Pods sendo criados
kubectl get pods -l job-name=processar-relatorio --watch

# Ver progresso do Job
kubectl get job processar-relatorio -w

# Ver logs de todos os Pods do Job
kubectl logs -l job-name=processar-relatorio --prefix

# Verificar status final
kubectl describe job processar-relatorio
\`\`\``
      },
      {
        title: 'Criar CronJob com politica de concorrencia',
        instruction: `Crie um CronJob que roda a cada 2 minutos (para testar rapidamente), com concurrencyPolicy: Forbid para evitar execucoes simultaneas e historico de 3 execucoes bem-sucedidas.`,
        hints: [
          'Use "*/2 * * * *" para rodar a cada 2 minutos',
          'successfulJobsHistoryLimit e failedJobsHistoryLimit controlam o historico',
          'kubectl create job --from=cronjob/<nome> <job-nome> cria um Job manual a partir do CronJob',
          'kubectl get cronjob mostra LAST SCHEDULE e ACTIVE'
        ],
        solution: `\`\`\`yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: health-check
spec:
  schedule: "*/2 * * * *"
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 1
  startingDeadlineSeconds: 60
  jobTemplate:
    spec:
      backoffLimit: 1
      ttlSecondsAfterFinished: 300
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: checker
              image: busybox:1.36
              command:
                - /bin/sh
                - -c
                - |
                  echo "Health check executado em $(date)"
                  echo "Node: $(cat /etc/hostname)"
              resources:
                requests:
                  cpu: "10m"
                  memory: "16Mi"
                limits:
                  cpu: "50m"
                  memory: "32Mi"
\`\`\`

\`\`\`bash
# Aplicar o CronJob
kubectl apply -f cronjob.yaml

# Verificar status do CronJob
kubectl get cronjob health-check -w

# Acionar manualmente (sem esperar o agendamento)
kubectl create job health-check-manual \\
  --from=cronjob/health-check

# Ver todos os Jobs criados pelo CronJob
kubectl get jobs -l app=health-check

# Suspender o CronJob temporariamente
kubectl patch cronjob health-check -p '{"spec":{"suspend":true}}'

# Reativar
kubectl patch cronjob health-check -p '{"spec":{"suspend":false}}'
\`\`\``
      },
      {
        title: 'Criar DaemonSet para coleta de metricas',
        instruction: `Crie um DaemonSet que roda um agente de coleta de metricas em todos os nodes, incluindo o control-plane. Configure tolerations apropriadas e use RollingUpdate como estrategia de atualizacao.`,
        hints: [
          'Para incluir control-plane nodes, adicione toleration para node-role.kubernetes.io/control-plane:NoSchedule',
          'hostNetwork: true permite acesso a rede do host (necessario para alguns agentes)',
          'kubectl get pods -o wide -l app=metrics-agent mostra em quais nodes esta rodando',
          'kubectl rollout status daemonset/<nome> monitora o update'
        ],
        solution: `\`\`\`yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: metrics-agent
  namespace: monitoring
  labels:
    app: metrics-agent
spec:
  selector:
    matchLabels:
      app: metrics-agent
  updateStrategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
  template:
    metadata:
      labels:
        app: metrics-agent
    spec:
      tolerations:
        - key: node-role.kubernetes.io/control-plane
          operator: Exists
          effect: NoSchedule
        - key: node-role.kubernetes.io/master
          operator: Exists
          effect: NoSchedule
      containers:
        - name: agent
          image: busybox:1.36
          command:
            - /bin/sh
            - -c
            - |
              while true; do
                echo "Coletando metricas do node $(hostname) - $(date)"
                sleep 30
              done
          resources:
            requests:
              cpu: "10m"
              memory: "16Mi"
            limits:
              cpu: "50m"
              memory: "64Mi"
\`\`\`

\`\`\`bash
# Criar namespace se nao existir
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -

# Aplicar o DaemonSet
kubectl apply -f daemonset.yaml

# Verificar distribuicao nos nodes
kubectl get pods -n monitoring -l app=metrics-agent -o wide

# Confirmar que esta em todos os nodes
kubectl get nodes
kubectl get pods -n monitoring -l app=metrics-agent --no-headers | wc -l

# Simular update (alterar a imagem)
kubectl set image daemonset/metrics-agent agent=busybox:1.36.1 -n monitoring

# Monitorar o rolling update
kubectl rollout status daemonset/metrics-agent -n monitoring
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Job fica criando Pods em loop e nunca completa',
      symptom: 'kubectl get pods mostra varios Pods do Job com STATUS "Error" ou "OOMKilled". O Job continua criando novos Pods. kubectl get job mostra COMPLETIONS como 0/1 e um numero crescente de FAILED.',
      diagnosis: `**Passo 1: Verificar status detalhado do Job**
\`\`\`bash
kubectl describe job <nome-do-job>
# Procure: "Pods Statuses", "backoffLimit", "Failed" count
\`\`\`

**Passo 2: Verificar logs dos Pods que falharam**
\`\`\`bash
# Listar todos os Pods do Job (incluindo os falhos)
kubectl get pods -l job-name=<nome-do-job>

# Ver logs do Pod que falhou
kubectl logs <nome-do-pod-falho>

# Se o container foi OOMKilled (sem logs)
kubectl describe pod <nome-do-pod-falho>
# Procure em "Last State": "OOMKilled", "Exit Code: 137"
\`\`\`

**Passo 3: Verificar os eventos do namespace**
\`\`\`bash
kubectl get events --field-selector reason=BackoffLimitExceeded
kubectl get events --sort-by='.lastTimestamp' | tail -20
\`\`\`

**Passo 4: Verificar se atingiu o backoffLimit**
\`\`\`bash
kubectl get job <nome-do-job> -o jsonpath='{.status}'
# Se status.failed >= spec.backoffLimit, o Job sera marcado como Failed
\`\`\``,
      solution: `**Causa: OOMKilled (Exit Code 137)**
\`\`\`yaml
# Aumentar os limites de memoria no spec do Job
resources:
  requests:
    memory: "256Mi"
  limits:
    memory: "512Mi"   # Aumente conforme necessario
\`\`\`

**Causa: Erro no script/comando**
\`\`\`bash
# Testar o comando interativamente
kubectl run debug --image=<mesma-imagem> --restart=Never -it --rm \\
  -- /bin/sh -c "seu-comando-aqui"
\`\`\`

**Causa: backoffLimit muito baixo**
\`\`\`bash
# Aumentar o backoffLimit se falhas sao esperadas e transientes
kubectl patch job <nome-do-job> -p '{"spec":{"backoffLimit":6}}'
\`\`\`

**Limpar Jobs travados e recriar:**
\`\`\`bash
# Deletar o Job falho (Pods sao deletados junto por padrao)
kubectl delete job <nome-do-job>

# Recriar apos corrigir o manifesto
kubectl apply -f job-corrigido.yaml

# Monitorar a nova execucao
kubectl get pods -l job-name=<nome-do-job> --watch
\`\`\``
    }
  ]
};
