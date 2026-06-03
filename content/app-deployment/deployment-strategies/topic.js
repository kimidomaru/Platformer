window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['app-deployment/deployment-strategies'] = {
  theory: `# Estrategias de Deployment

## Por que Estrategias Importam?

Em producao, atualizar uma aplicacao sem downtime e um requisito critico. Kubernetes oferece mecanismos nativos e padroes arquiteturais para diferentes necessidades de disponibilidade e controle de risco.

---

## 1. Recreate (Recriar)

A estrategia mais simples: **derruba todos os Pods antigos** antes de criar os novos.

\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: minha-api
spec:
  replicas: 3
  strategy:
    type: Recreate       # Para todos os Pods, depois cria os novos
  selector:
    matchLabels:
      app: minha-api
  template:
    metadata:
      labels:
        app: minha-api
    spec:
      containers:
        - name: api
          image: minha-api:v2.0.0
          resources:
            requests:
              cpu: "200m"
              memory: "256Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
\`\`\`

**Quando usar**: aplicacoes que nao toleram versoes mistas rodando simultaneamente (ex: mudancas de schema de banco incompativeis, single-instance com estado exclusivo).

**Desvantagem**: downtime garantido entre a delecao dos Pods antigos e a criacao dos novos.

---

## 2. RollingUpdate (Atualizacao Gradual)

Estrategia **padrao** do Kubernetes. Substitui Pods gradualmente, garantindo que a aplicacao continue disponivel durante o update.

\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: minha-api
spec:
  replicas: 4
  strategy:
    type: RollingUpdate
    rollingUpdate:
      # Maximo de Pods ACIMA do numero de replicas durante o update
      # Valor: numero absoluto ou percentual (ex: "25%")
      maxSurge: 1
      # Maximo de Pods INDISPONIVEIS durante o update
      # Valor: numero absoluto ou percentual (ex: "25%")
      maxUnavailable: 1
  selector:
    matchLabels:
      app: minha-api
  template:
    metadata:
      labels:
        app: minha-api
    spec:
      containers:
        - name: api
          image: minha-api:v2.0.0
          readinessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 5
          resources:
            requests:
              cpu: "200m"
              memory: "256Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
  # Quantas revisoes antigas manter (para rollback)
  revisionHistoryLimit: 10
\`\`\`

### maxSurge vs maxUnavailable

Com 4 replicas, maxSurge: 1, maxUnavailable: 1:

\`\`\`
Inicio: [v1][v1][v1][v1]  (4 Pods)
Passo 1: [v1][v1][v1][v1][v2]  (5 Pods = 4 + maxSurge 1)
Passo 2: [v1][v1][v2][v2]  (deleta 1 v1, v2 fica Ready)
...continua ate todos serem v2
\`\`\`

**Configuracoes comuns**:
- \`maxSurge: 1, maxUnavailable: 0\`: zero downtime, usa mais recursos temporariamente
- \`maxSurge: 0, maxUnavailable: 1\`: sem recursos extras, um Pod indisponivel por vez
- \`maxSurge: "25%", maxUnavailable: "25%"\`: equilibrio entre velocidade e disponibilidade

---

## 3. Blue/Green Deployment

Nao e nativo do Kubernetes, mas implementado com dois Deployments e um Service.

**Fluxo**:
1. Green (atual) esta recebendo trafego
2. Deploya o Blue (nova versao) sem trafego
3. Testa o Blue em isolamento
4. Muda o selector do Service para o Blue (virada instantanea)
5. Green fica em stand-by para rollback rapido

\`\`\`yaml
# Deployment VERDE (versao atual em producao)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-green
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
      slot: green
  template:
    metadata:
      labels:
        app: api
        slot: green
        version: v1.0.0
    spec:
      containers:
        - name: api
          image: minha-api:v1.0.0
          resources:
            requests:
              cpu: "200m"
              memory: "256Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
---
# Deployment AZUL (nova versao, sem trafego ainda)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-blue
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
      slot: blue
  template:
    metadata:
      labels:
        app: api
        slot: blue
        version: v2.0.0
    spec:
      containers:
        - name: api
          image: minha-api:v2.0.0
          resources:
            requests:
              cpu: "200m"
              memory: "256Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
---
# Service: inicialmente apontando para green
apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  selector:
    app: api
    slot: green     # MUDAR para "blue" para fazer a virada
  ports:
    - port: 80
      targetPort: 8080
\`\`\`

**Virada para Blue (virada instantanea)**:
\`\`\`bash
kubectl patch service api -p '{"spec":{"selector":{"slot":"blue"}}}'
\`\`\`

**Rollback instantaneo para Green**:
\`\`\`bash
kubectl patch service api -p '{"spec":{"selector":{"slot":"green"}}}'
\`\`\`

---

## 4. Canary Deployment

Envia uma **pequena porcentagem do trafego** para a nova versao antes de expandir. Permite validacao em producao com risco controlado.

\`\`\`yaml
# Deployment estavel (versao atual) - 9 replicas = ~90% do trafego
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-stable
spec:
  replicas: 9
  selector:
    matchLabels:
      app: api
      track: stable
  template:
    metadata:
      labels:
        app: api
        track: stable
    spec:
      containers:
        - name: api
          image: minha-api:v1.0.0
          resources:
            requests:
              cpu: "200m"
              memory: "256Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
---
# Deployment canary (nova versao) - 1 replica = ~10% do trafego
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-canary
spec:
  replicas: 1
  selector:
    matchLabels:
      app: api
      track: canary
  template:
    metadata:
      labels:
        app: api
        track: canary
    spec:
      containers:
        - name: api
          image: minha-api:v2.0.0
          resources:
            requests:
              cpu: "200m"
              memory: "256Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
---
# Service: seleciona AMBOS os Deployments pelo label app: api
apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  selector:
    app: api    # Seleciona pods de stable E canary
  ports:
    - port: 80
      targetPort: 8080
\`\`\`

**Promocao gradual do canary** (aumentar percentual):
\`\`\`bash
# Aumentar canary para 30% (3 de 10 total)
kubectl scale deployment api-canary --replicas=3
kubectl scale deployment api-stable --replicas=7

# Promocao completa: canary vira producao
kubectl scale deployment api-canary --replicas=10
kubectl scale deployment api-stable --replicas=0
\`\`\`

---

## 5. Rollback e Historico de Revisoes

O Kubernetes mantem um historico de revisoes do Deployment:

\`\`\`bash
# Ver historico de revisoes
kubectl rollout history deployment/minha-api

# Ver detalhes de uma revisao especifica
kubectl rollout history deployment/minha-api --revision=3

# Rollback para a revisao anterior
kubectl rollout undo deployment/minha-api

# Rollback para uma revisao especifica
kubectl rollout undo deployment/minha-api --to-revision=2

# Pausar um rollout em progresso
kubectl rollout pause deployment/minha-api

# Retomar um rollout pausado
kubectl rollout resume deployment/minha-api

# Monitorar o status do rollout
kubectl rollout status deployment/minha-api
\`\`\`

**Anotar deployments para melhor historico**:
\`\`\`bash
kubectl set image deployment/minha-api api=minha-api:v2.0.0
kubectl annotate deployment/minha-api kubernetes.io/change-cause="Deploy v2.0.0: adiciona suporte a OAuth2"
\`\`\`

---

## Deployment Conditions

O Deployment reporta condicoes de status que ajudam no troubleshooting:

| Condition | Tipo | Significado |
|---|---|---|
| \`Available\` | True | Replicas minimas disponiveis |
| \`Progressing\` | True | Rollout em progresso ou completou |
| \`ReplicaFailure\` | True | Erro ao criar replicas (ex: quota excedida) |

\`\`\`bash
kubectl get deployment minha-api -o jsonpath='{.status.conditions}' | python3 -m json.tool
\`\`\`
`,

  quiz: [
    {
      question: 'Um Deployment tem replicas: 6, maxSurge: 2, maxUnavailable: 1. Qual o maximo de Pods rodando simultaneamente durante o rolling update?',
      options: [
        '6 Pods',
        '7 Pods',
        '8 Pods (6 + maxSurge 2)',
        '5 Pods (6 - maxUnavailable 1)'
      ],
      correct: 2,
      explanation: 'maxSurge define quantos Pods ACIMA do numero de replicas podem existir durante o update. Com replicas: 6 e maxSurge: 2, o maximo de Pods simultaneos e 6 + 2 = 8. maxUnavailable: 1 significa que no minimo 5 Pods devem estar disponiveis a qualquer momento durante o update.'
    },
    {
      question: 'Qual a diferenca principal entre Blue/Green e Canary deployment?',
      options: [
        'Blue/Green usa dois Deployments; Canary usa apenas um',
        'Blue/Green e nativo do Kubernetes; Canary precisa de Istio',
        'Blue/Green faz virada instantanea de 100% do trafego; Canary distribui trafego gradualmente entre versoes',
        'Nao ha diferenca pratica entre as duas estrategias'
      ],
      correct: 2,
      explanation: 'Blue/Green: dois ambientes identicos, virada instantanea de 100% do trafego alterando o selector do Service. Zero downtime, rollback instantaneo, mas custo dobrado de recursos. Canary: nova versao recebe fracao do trafego (ex: 10%) baseado na proporcao de replicas. Permite validacao gradual em producao com risco controlado antes da promocao total.'
    },
    {
      question: 'Qual o comando para fazer rollback de um Deployment para a revisao 3 especificamente?',
      options: [
        'kubectl rollout undo deployment/app --revision=3',
        'kubectl rollout undo deployment/app --to-revision=3',
        'kubectl rollback deployment/app --revision=3',
        'kubectl deploy rollback app --version=3'
      ],
      correct: 1,
      explanation: 'O comando correto e "kubectl rollout undo deployment/<nome> --to-revision=<numero>". A flag e "--to-revision", nao "--revision" (que e usada no comando "kubectl rollout history" para ver detalhes de uma revisao). "kubectl rollout undo" sem flags volta para a revisao imediatamente anterior.'
    },
    {
      question: 'Quando e recomendado usar a estrategia Recreate em vez de RollingUpdate?',
      options: [
        'Sempre que quiser uma atualizacao mais rapida',
        'Quando a aplicacao nao tolera duas versoes rodando simultaneamente (ex: mudancas de schema de banco incompativeis)',
        'Para aplicacoes stateless em producao',
        'Quando se tem mais de 10 replicas'
      ],
      correct: 1,
      explanation: 'Recreate e recomendado quando a coexistencia de multiplas versoes causa problemas: mudancas de schema de banco incompativeis com versao anterior, mudancas em formato de mensagens de fila incompativeis, aplicacoes que assumem exclusividade de recursos. O trade-off e downtime garantido durante o update. Para a maioria das aplicacoes stateless, RollingUpdate e preferivel.'
    },
    {
      question: 'No padrao Canary com dois Deployments, como o trafego e distribuido entre stable (9 replicas) e canary (1 replica)?',
      options: [
        'Distribuicao configurada no Service com percentuais exatos',
        'Proporcionalmente ao numero de Pods: 90% para stable, 10% para canary (roteamento baseado em Pods prontos)',
        '50/50 independente do numero de replicas',
        'Todo trafego vai para o canary se ele estiver disponivel'
      ],
      correct: 1,
      explanation: 'Com o Service selecionando Pods de ambos os Deployments pelo mesmo label (ex: app: api), o kube-proxy distribui o trafego de forma proporcional ao numero de Pods prontos (endpoints). Com 9 replicas stable e 1 replica canary (10 total), o trafego e aproximadamente 90% stable / 10% canary. Isso e uma aproximacao: para controle preciso de percentual, use Istio/Gateway API.'
    },
    {
      question: 'O que o campo revisionHistoryLimit: 5 em um Deployment controla?',
      options: [
        'O numero maximo de vezes que o Deployment pode ser atualizado',
        'Quantas ReplicaSets antigas (revisoes) sao mantidas para possibilitar rollback',
        'O tempo que cada revisao e mantida em dias',
        'O numero de containers por revisao'
      ],
      correct: 1,
      explanation: 'revisionHistoryLimit controla quantas ReplicaSets antigas o Deployment mantem apos cada atualizacao. Cada revisao corresponde a uma ReplicaSet (com 0 replicas mas configuracao preservada). O padrao e 10. Valores menores economizam recursos do etcd. Definir como 0 elimina a capacidade de rollback. Sempre mantenha pelo menos 2-3 para rollback de emergencia.'
    },
    {
      question: 'kubectl rollout pause deployment/app e depois kubectl rollout resume deployment/app. Para que serve essa sequencia?',
      options: [
        'Pausa temporariamente o trafego para o Deployment',
        'Permite fazer multiplas alteracoes (imagem, env, resources) no Deployment sem disparar multiplos rollouts; resume inicia um unico rollout com todas as mudancas',
        'Congela o numero de replicas durante manutencao',
        'Pausa a liveness probe durante a atualizacao'
      ],
      correct: 1,
      explanation: 'Pausar um Deployment impede que mudancas dispararem novos rollouts imediatamente. Voce pode fazer multiplas alteracoes (kubectl set image, kubectl set env, kubectl patch resources) sem cada uma criar um rollout intermediario. Ao resumir, um unico rollout e executado com todas as mudancas acumuladas. Util para coordenar atualizacoes complexas sem rollouts parciais.'
    },
    {
      question: 'O que acontece com um Deployment que tem "progressDeadlineSeconds: 120" se o rollout nao progride por 120 segundos?',
      options: [
        'O rollout e pausado automaticamente para investigacao',
        'O Deployment e marcado com a condicao "Progressing" como False e mensagem "ProgressDeadlineExceeded"; o rollout continua tentando',
        'O Kubernetes automaticamente faz rollback para a revisao anterior',
        'O Deployment e deletado'
      ],
      correct: 1,
      explanation: '"progressDeadlineSeconds" define o tempo maximo para o rollout progredir. Se excedido, o Deployment e marcado com status condition "Progressing: False" e reason "ProgressDeadlineExceeded". Importante: o Kubernetes NAO faz rollback automatico — voce precisa detectar esse estado via "kubectl rollout status" (que retorna exit code 1) ou monitoramento e executar o rollback manualmente. Util para detectar Deployments travados (ex: imagem invalida, sem recursos no cluster).'
    },
    {
      question: 'Qual e a funcao do campo "minReadySeconds: 30" em um Deployment?',
      options: [
        'Define o tempo minimo que o Kubernetes aguarda antes de iniciar o rollout',
        'Define que um Pod novo so e considerado "pronto" apos 30 segundos sem crashes, mesmo que a readinessProbe ja passe',
        'Define o tempo maximo entre a criacao de novos Pods durante o rolling update',
        'Substitui o initialDelaySeconds da readinessProbe'
      ],
      correct: 1,
      explanation: '"minReadySeconds" define um periodo de "soak time": mesmo que a readinessProbe passe, o Pod so e considerado truly "available" apos ficar saudavel por minReadySeconds segundos sem nenhum container crashando. Isso adiciona uma camada extra de seguranca no rolling update: o Deployment nao avanca para substituir o proximo Pod ate que o novo esteja estavel por esse periodo. Util para detectar crashes rapidos que ocorrem segundos apos o inicio, antes do primeiro intervalo da readinessProbe.'
    },
    {
      question: 'Voce precisa verificar quantas revisoes de um Deployment estao armazenadas. Qual comando mostra o historico com mensagens de mudanca?',
      options: [
        'kubectl get replicaset -l app=minha-api',
        'kubectl rollout history deployment/minha-api',
        'kubectl describe deployment/minha-api | grep Revision',
        'kubectl get deployment/minha-api -o jsonpath="{.status.observedGeneration}"'
      ],
      correct: 1,
      explanation: '"kubectl rollout history deployment/<nome>" lista todas as revisoes armazenadas com o numero da revisao e o campo CHANGE-CAUSE (populado pela annotation "kubernetes.io/change-cause"). Para ver detalhes de uma revisao especifica: "kubectl rollout history deployment/<nome> --revision=2". Cada revisao corresponde a uma ReplicaSet com 0 replicas mantida no cluster. "kubectl get replicaset" mostraria as ReplicaSets mas sem o contexto de historico de rollout.'
    },
    {
      question: 'Como implementar um deploy A/B testing onde usuarios com header "X-Beta: true" sao roteados para a versao nova, sem usar service mesh?',
      options: [
        'Usar maxSurge: 50% no RollingUpdate para manter 50% dos Pods na versao antiga',
        'Nao e possivel fazer A/B testing baseado em headers sem service mesh no Kubernetes puro',
        'Usar dois Deployments com Ingress que tem regras de rota baseadas no header X-Beta',
        'Configurar o Service com dois selectors: um por versao'
      ],
      correct: 2,
      explanation: 'A/B testing baseado em headers requer roteamento de camada 7 (inspecao de headers HTTP). No Kubernetes puro, isso e possivel via Ingress: crie dois Deployments (v1 e v2) com dois Services, e configure regras de Ingress com annotations do controller (ex: nginx: "nginx.ingress.kubernetes.io/canary: true" e "nginx.ingress.kubernetes.io/canary-by-header: X-Beta"). Canary deployment simples (por proporcao de Pods) opera na camada 4 (load balancing por IPs) e nao consegue inspecionar headers HTTP.'
    },
    {
      question: 'Um Deployment com replicas: 4 esta com maxSurge: 0 e maxUnavailable: 1. Qual e a sequencia do rolling update?',
      options: [
        'Cria 1 Pod novo, derruba 1 Pod antigo, repete ate todos serem substituidos',
        'Derruba 1 Pod antigo, aguarda a criacao e prontidao de 1 Pod novo, repete ate todos serem substituidos',
        'Derruba todos os 4 Pods, depois cria 4 novos simultaneamente',
        'Cria 4 novos Pods primeiro (maxSurge), depois derruba os 4 antigos'
      ],
      correct: 1,
      explanation: 'Com maxSurge: 0, o Kubernetes NAO pode criar Pods extras acima das replicas. Com maxUnavailable: 1, pode ter no maximo 1 Pod indisponivel. Portanto a sequencia e: (1) derruba 1 Pod antigo (agora 3 disponiveis), (2) cria 1 Pod novo e aguarda ficar pronto (de volta a 4 disponiveis), (3) repete. Esta configuracao e mais conservadora em recursos mas mais lenta. Comparando com maxSurge: 1, maxUnavailable: 0 (zero downtime, cria antes de derrubar) — esta abordagem e oposta: derruba antes de criar.'
    }
  ],

  flashcards: [
    {
      front: 'O que sao maxSurge e maxUnavailable no RollingUpdate?',
      back: 'maxSurge: numero maximo de Pods ACIMA do total de replicas durante o update (cria Pods extras temporariamente). maxUnavailable: numero maximo de Pods que podem estar INDISPONIVEIS durante o update (abaixo do total de replicas). Ambos aceitam numero absoluto ou percentual. Exemplo: replicas=4, maxSurge=1, maxUnavailable=1 -> maximo 5 Pods, minimo 3 Pods prontos durante o update.'
    },
    {
      front: 'Como funciona o padrao Blue/Green no Kubernetes?',
      back: 'Dois Deployments identicos com labels distintos (slot: green, slot: blue). Um Service aponta para um deles via selector. Para fazer a virada: kubectl patch service api -p {"spec":{"selector":{"slot":"blue"}}}. Para rollback: alterar de volta para "green". Vantagens: virada instantanea, rollback em segundos. Desvantagem: custo dobrado de recursos durante a transicao. Nao e nativo do K8s, e um padrao arquitetural.'
    },
    {
      front: 'Como fazer rollback de um Deployment e ver o historico?',
      back: 'Ver historico: kubectl rollout history deployment/<nome>. Ver detalhes de revisao: kubectl rollout history deployment/<nome> --revision=2. Rollback para anterior: kubectl rollout undo deployment/<nome>. Rollback para especifica: kubectl rollout undo deployment/<nome> --to-revision=3. Monitorar: kubectl rollout status deployment/<nome>. Cada atualizacao cria uma nova revisao (ReplicaSet com 0 replicas preservada).'
    },
    {
      front: 'Quando usar Recreate vs RollingUpdate?',
      back: 'Recreate: derruba TODOS os Pods antes de criar os novos. Usar quando versoes antigas e novas NAO podem coexistir: migrations de banco incompativeis, mudancas de protocolo de mensagens, recursos exclusivos. Aceita downtime em troca de consistencia. RollingUpdate: substitui Pods gradualmente. Usar para aplicacoes stateless que toleram multiplas versoes simultaneas. Zero downtime. Padrao do Kubernetes.'
    },
    {
      front: 'Como o Canary deployment controla a porcentagem de trafego?',
      back: 'Via proporcao de replicas: o Service seleciona Pods de ambos os Deployments pelo mesmo label base (ex: app: api). O kube-proxy distribui trafego proporcionalmente aos Pods prontos. Para 10% canary: stable=9 replicas, canary=1 replica (10 total). Para aumentar: kubectl scale deployment api-canary --replicas=3; kubectl scale deployment api-stable --replicas=7. Limitacao: so aproxima percentuais. Para controle preciso, use Istio ou Gateway API com TrafficSplit.'
    },
    {
      front: 'O que e o revisionHistoryLimit e qual o valor padrao?',
      back: 'Controla quantas ReplicaSets antigas sao mantidas apos updates (cada revisao = uma ReplicaSet com 0 replicas). Padrao: 10. Valor 0: nenhuma revisao mantida, sem capacidade de rollback. Recomendado: manter pelo menos 3-5 para emergencias. Definir em projetos com muitos Deployments pode reduzir consumo de recursos no etcd. Cada ReplicaSet preservada tem sua configuracao completa de template.'
    },
    {
      front: 'Como anotar um Deployment para ter historico de mudancas legivel?',
      back: 'Use kubernetes.io/change-cause: kubectl annotate deployment/<nome> kubernetes.io/change-cause="Deploy v2.0.0: corrige bug #123 de autenticacao". Alternativa no YAML: metadata.annotations["kubernetes.io/change-cause"]: "texto". O valor aparece na coluna CHANGE-CAUSE do kubectl rollout history. Sem anotacao, a coluna fica como <none>. Boa pratica: sempre anotar antes de fazer deploy em producao para facilitar auditorias e rollbacks.'
    }
  ],

  lab: {
    scenario: 'A equipe de produto precisa deployar a versao v2.0.0 da API com zero downtime. Apos o deploy, identificou-se um bug critico e e necessario rollback rapido. Em seguida, a equipe quer testar uma estrategia Canary para a versao v3.0.0 antes de expandir para 100% dos usuarios.',
    objective: 'Executar um RollingUpdate com zero downtime, realizar rollback para a versao anterior, e implementar Canary deployment com controle gradual de trafego.',
    steps: [
      {
        title: 'Configurar e executar RollingUpdate com zero downtime',
        instruction: `Crie um Deployment v1.0.0 com 4 replicas usando RollingUpdate configurado para zero downtime (maxUnavailable: 0). Faca a atualizacao para v1.1.0, monitore o rollout e anote a mudanca para o historico.`,
        hints: [
          'maxUnavailable: 0 garante que nenhum Pod fica indisponivel durante o update',
          'Adicione uma readinessProbe para que o Deployment saiba quando o Pod esta pronto',
          'kubectl rollout status --watch para acompanhar em tempo real',
          'Anote com kubernetes.io/change-cause antes ou depois do update'
        ],
        solution: `\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  annotations:
    kubernetes.io/change-cause: "Deploy inicial v1.0.0"
spec:
  replicas: 4
  revisionHistoryLimit: 5
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0    # Zero downtime: sempre 4 Pods prontos
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: nginx:1.24-alpine
          ports:
            - containerPort: 80
          readinessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 5
            periodSeconds: 3
            failureThreshold: 3
          resources:
            requests:
              cpu: "50m"
              memory: "64Mi"
            limits:
              cpu: "100m"
              memory: "128Mi"
\`\`\`

\`\`\`bash
kubectl apply -f deployment.yaml

# Verificar que todos os 4 Pods estao prontos
kubectl get deployment api
kubectl get pods -l app=api

# Atualizar para v1.1.0 (simulado com nginx:1.25)
kubectl set image deployment/api api=nginx:1.25-alpine

# Anotar a mudanca
kubectl annotate deployment/api \\
  kubernetes.io/change-cause="Deploy v1.1.0: atualiza nginx para 1.25" \\
  --overwrite

# Monitorar o rollout
kubectl rollout status deployment/api --watch

# Verificar que nunca teve menos de 4 Pods prontos
kubectl get pods -l app=api --watch
\`\`\``
      },
      {
        title: 'Realizar rollback apos identificar bug',
        instruction: `Simule a deteccao de um bug critico na v1.1.0. Verifique o historico de revisoes e faca rollback para a versao anterior. Confirme que o rollback foi bem-sucedido.`,
        hints: [
          'kubectl rollout history mostra todas as revisoes e suas anotacoes',
          'kubectl rollout undo sem flags vai para a revisao imediatamente anterior',
          'Monitore o rollback com kubectl rollout status',
          'kubectl get pods -o wide mostra em quais nodes os Pods estao rodando'
        ],
        solution: `\`\`\`bash
# Verificar historico de revisoes com anotacoes
kubectl rollout history deployment/api

# Ver detalhes da revisao atual
kubectl rollout history deployment/api --revision=2

# Ver detalhes da revisao anterior
kubectl rollout history deployment/api --revision=1

# Simular deteccao de bug: verificar a imagem atual
kubectl get deployment api -o jsonpath='{.spec.template.spec.containers[0].image}'

# Executar rollback para a revisao anterior
kubectl rollout undo deployment/api

# Monitorar o rollback
kubectl rollout status deployment/api --watch

# Confirmar que voltou para nginx:1.24-alpine
kubectl get deployment api -o jsonpath='{.spec.template.spec.containers[0].image}'

# Verificar que todos os 4 Pods estao com a versao anterior
kubectl get pods -l app=api -o jsonpath='{range .items[*]}{.metadata.name} {.spec.containers[0].image}{"\n"}{end}'

# Anotar o rollback
kubectl annotate deployment/api \\
  kubernetes.io/change-cause="ROLLBACK: revertido de v1.1.0 por bug critico #456" \\
  --overwrite
\`\`\``
      },
      {
        title: 'Implementar Canary deployment para v2.0.0',
        instruction: `Implemente uma estrategia Canary para testar a v2.0.0 (simulada com nginx:1.25) com 10% do trafego. Verifique que o Service distribui trafego para ambos. Depois promova gradualmente para 50% e finalmente 100%.`,
        hints: [
          'O Service deve selecionar apenas o label "app: api" (sem o label "track")',
          'stable com 9 replicas + canary com 1 replica = 10% canary',
          'kubectl get endpoints api mostra todos os Pods selecionados pelo Service',
          'kubectl scale e mais rapido que editar o YAML para ajustar replicas'
        ],
        solution: `\`\`\`yaml
# Service que seleciona ambos os Deployments
apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  selector:
    app: api     # Seleciona stable E canary
  ports:
    - port: 80
      targetPort: 80
---
# Deployment STABLE: versao atual (v1.0.0)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-stable
spec:
  replicas: 9    # 90% do trafego
  selector:
    matchLabels:
      app: api
      track: stable
  template:
    metadata:
      labels:
        app: api
        track: stable
    spec:
      containers:
        - name: api
          image: nginx:1.24-alpine
          ports:
            - containerPort: 80
          resources:
            requests:
              cpu: "50m"
              memory: "64Mi"
            limits:
              cpu: "100m"
              memory: "128Mi"
---
# Deployment CANARY: nova versao (v2.0.0) - 10% do trafego
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-canary
spec:
  replicas: 1    # 10% do trafego
  selector:
    matchLabels:
      app: api
      track: canary
  template:
    metadata:
      labels:
        app: api
        track: canary
    spec:
      containers:
        - name: api
          image: nginx:1.25-alpine
          ports:
            - containerPort: 80
          resources:
            requests:
              cpu: "50m"
              memory: "64Mi"
            limits:
              cpu: "100m"
              memory: "128Mi"
\`\`\`

\`\`\`bash
kubectl apply -f canary.yaml

# Verificar que o Service enxerga todos os 10 Pods
kubectl get endpoints api
kubectl get pods -l app=api --show-labels

# Contar Pods por track
kubectl get pods -l app=api,track=stable --no-headers | wc -l
kubectl get pods -l app=api,track=canary --no-headers | wc -l

# Promover canary para 50% (5 de 10 total)
kubectl scale deployment api-canary --replicas=5
kubectl scale deployment api-stable --replicas=5

# Verificar nova distribuicao
kubectl get pods -l app=api --show-labels

# Promocao final: 100% para canary
kubectl scale deployment api-canary --replicas=10
kubectl scale deployment api-stable --replicas=0

# Verificar que apenas canary esta recebendo trafego
kubectl get pods -l app=api --show-labels
kubectl get endpoints api
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Deployment travado em progresso (Progressing condition False)',
      symptom: 'kubectl rollout status deployment/minha-api fica esperando e nunca completa. kubectl get deployment mostra READY como 2/4 ou similar. O rollout nao avanca e nao falha explicitamente.',
      diagnosis: `**Passo 1: Verificar o status do Deployment**
\`\`\`bash
kubectl get deployment minha-api
# Checar READY, UP-TO-DATE, AVAILABLE

kubectl describe deployment minha-api
# Procure nas secoes "Conditions" e "Events"
\`\`\`

**Passo 2: Verificar os Pods da nova versao**
\`\`\`bash
# Listar todos os Pods com status
kubectl get pods -l app=minha-api -o wide

# Ver Pods que nao estao prontos
kubectl get pods -l app=minha-api --field-selector=status.phase!=Running
\`\`\`

**Passo 3: Inspecionar Pods em estado problematico**
\`\`\`bash
# Ver eventos e status detalhado do Pod com problema
kubectl describe pod <nome-do-pod-com-problema>

# Ver logs do container (pode ter erro de startup)
kubectl logs <nome-do-pod-com-problema> --tail=50

# Se OOMKilled ou crashloop
kubectl logs <nome-do-pod-com-problema> --previous
\`\`\`

**Passo 4: Verificar se e um problema de recursos**
\`\`\`bash
kubectl describe node
# Procure: "Allocatable" vs "Requests" para ver se ha recursos disponiveis

kubectl get events --sort-by='.lastTimestamp' | grep -i "failed scheduling\\|insufficient"
\`\`\`

**Passo 5: Verificar a readinessProbe**
\`\`\`bash
kubectl describe pod <nome-do-pod>
# Procure: "Readiness probe failed"
# Se a probe esta falhando, o Pod nunca fica Ready
# e o rolling update nao avanca
\`\`\``,
      solution: `**Causa: readinessProbe incorreta ou muito restritiva**
\`\`\`bash
# Verificar se o endpoint da probe esta correto
kubectl exec <pod-com-problema> -- curl -v http://localhost:8080/health

# Se o path ou porta estiver errado, corrigir no Deployment
kubectl edit deployment minha-api
# Ajustar readinessProbe.httpGet.path e/ou port
\`\`\`

**Causa: Recursos insuficientes no cluster**
\`\`\`bash
# Ver por que o Pod nao foi agendado
kubectl describe pod <pod-pending>
# Mensagem: "Insufficient cpu" ou "Insufficient memory"

# Opcoes: reduzir requests no Deployment ou adicionar nodes
kubectl edit deployment minha-api
# Reduzir resources.requests.cpu e resources.requests.memory
\`\`\`

**Causa: Imagem incorreta ou nao existe**
\`\`\`bash
# Pod com status ImagePullBackOff
kubectl describe pod <pod>
# "Failed to pull image": verificar o nome/tag da imagem

# Corrigir a imagem
kubectl set image deployment/minha-api app=minha-api:v2.0.0-correto
\`\`\`

**Rollback de emergencia enquanto investiga:**
\`\`\`bash
kubectl rollout undo deployment/minha-api
kubectl rollout status deployment/minha-api
\`\`\``
    }
  ]
};
