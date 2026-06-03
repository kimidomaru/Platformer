window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['sre-operations/sre-toil-automation'] = {
  theory: `
# Toil Elimination & Automacao — Reduzindo Trabalho Operacional

## Relevancia
Toil e o inimigo silencioso da produtividade SRE. Sem medir e reduzir toil ativamente, times gastam mais tempo apagando incendios do que construindo sistemas confiaveis. A automacao progressiva e a principal ferramenta para eliminar toil e escalar operacoes.

## Conceitos Fundamentais

### As 5 Caracteristicas do Toil

\`\`\`
1. MANUAL     — um humano executa (nao uma maquina)
2. REPETITIVO — a mesma tarefa, varias vezes
3. AUTOMATIZAVEL — uma maquina poderia fazer
4. SEM VALOR DURADOURO — tatico, nao estrategico
5. CRESCE COM O SERVICO — O(n), nao O(1)
\`\`\`

**Exemplos:**
\`\`\`
E Toil:                              NAO e Toil:
  Restart manual de pods               Escrever automacao
  Rotacao manual de certificados       Design de arquitetura
  Escalar servicos manualmente         Code review
  Aplicar patches manualmente          Planejamento de capacidade
  Criar tickets de on-call             Postmortem e aprendizado
  Limpar logs/disco manualmente        Construir ferramentas
\`\`\`

### Metas de Toil

\`\`\`
Google SRE:  max 50% do tempo em toil
Times maduros: < 30% do tempo em toil
Restante:    projetos de engenharia, automacao, melhorias
\`\`\`

### Medindo Toil

**Metodos de medicao:**

| Metodo | Descricao | Quando usar |
|--------|-----------|-------------|
| **Survey** | Questionario periodico ao time | Mensal/trimestral |
| **Time tracking** | Registrar tempo gasto em tarefas | Continuamente |
| **Ticket analysis** | Categorizar tickets por tipo | Revisao mensal |
| **Interrupt tracking** | Contar interrupcoes do on-call | Por turno |

**Template de survey:**
\`\`\`
Para cada tarefa operacional, classifique:
1. E manual? (sim/nao)
2. E repetitiva? (frequencia por semana)
3. Poderia ser automatizada? (sim/parcialmente/nao)
4. Tempo gasto por ocorrencia (minutos)
5. Impacto se nao feita (alto/medio/baixo)

Toil Score = (frequencia × tempo × manual) / total_horas
\`\`\`

### Piramide de Automacao

\`\`\`
         [Self-Healing]         ← sistema se corrige sozinho
        /              \\
     [Fully Automated]          ← zero intervencao humana
    /                  \\
  [Semi-Automated]              ← humano aprova, maquina executa
 /                    \\
[Documented]                    ← runbook documentado
/                      \\
[Manual]                        ← humano faz tudo ad-hoc
\`\`\`

**Cada nivel elimina mais toil:**

1. **Manual**: Ad-hoc, conhecimento tribal
2. **Documented**: Runbook escrito, reproduzivel
3. **Semi-automated**: Script + aprovacao humana
4. **Fully automated**: CronJob, Operator, pipeline
5. **Self-healing**: Auto-remediation, auto-scaling

### Automacao em Kubernetes

**HPA — Horizontal Pod Autoscaler:**
\`\`\`yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-server
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 50
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
\`\`\`

**CronJob para tarefas operacionais:**
\`\`\`yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: cleanup-old-data
  namespace: production
spec:
  schedule: "0 3 * * *"  # 3h da manha, diariamente
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: cleanup
              image: bitnami/kubectl:latest
              command:
                - /bin/sh
                - -c
                - |
                  # Limpar ConfigMaps antigos de postmortem (> 90 dias)
                  kubectl get cm -n production -l type=postmortem \\
                    --sort-by=.metadata.creationTimestamp -o name | \\
                    head -n -10 | xargs -r kubectl delete -n production
          restartPolicy: OnFailure
          serviceAccountName: cleanup-sa
\`\`\`

**Self-healing com probes:**
\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
  namespace: production
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: api
          image: myapp:v1.0
          livenessProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 15
            periodSeconds: 10
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /ready
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 5
          startupProbe:
            httpGet:
              path: /healthz
              port: 8080
            failureThreshold: 30
            periodSeconds: 10
\`\`\`

**GitOps como eliminacao de toil:**
\`\`\`
Sem GitOps (toil):
  1. Dev faz merge do PR
  2. Dev roda kubectl apply manualmente
  3. Dev verifica se deploy funcionou
  4. Dev notifica o time

Com GitOps (automatizado):
  1. Dev faz merge do PR
  2. ArgoCD detecta mudanca automaticamente
  3. ArgoCD aplica mudanca e verifica health
  4. Notificacao automatica via Slack
\`\`\`

### ROI de Automacao

\`\`\`
Decidir quando automatizar:

Tempo economizado = frequencia × tempo_manual × periodo
Custo de automatizar = horas_dev × valor_hora

ROI positivo quando:
  Tempo economizado > Custo de automatizar

Regra pratica (xkcd 1205):
  Se faz 5x/dia e leva 5 min cada:
    5 × 5 = 25 min/dia = ~10h/mes
    Automatizar se custar < 10h de dev

Considerar tambem:
  - Reducao de erros humanos
  - Consistencia (maquina faz igual toda vez)
  - Velocidade (automacao e mais rapida)
  - Escalabilidade (funciona com 10 ou 10.000)
\`\`\`

## Comandos Essenciais

\`\`\`bash
# HPA
kubectl get hpa -n production
kubectl describe hpa api-hpa -n production
kubectl autoscale deployment api-server --min=3 --max=20 --cpu-percent=70

# CronJobs
kubectl get cronjob -n production
kubectl get jobs -n production --sort-by='.status.startTime'
kubectl create job --from=cronjob/cleanup-old-data manual-cleanup -n production

# Probes / Self-healing
kubectl get pods -n production -o jsonpath='{range .items[*]}{.metadata.name}: restarts={.status.containerStatuses[0].restartCount}{"\n"}{end}'
kubectl get events -n production --field-selector reason=Unhealthy

# Verificar automacoes
kubectl get cronjob,hpa -A
\`\`\`

## Erros Comuns

1. **Automatizar sem documentar primeiro**: Documente o processo manual antes de automatizar. Automacao de processo errado amplifica erros.
2. **Automatizar demais cedo**: Comece com semi-automacao (script + aprovacao). Full automation sem confianca e arriscada.
3. **Nao medir toil**: Se voce nao mede, nao sabe se esta melhorando. Implemente tracking de toil.
4. **HPA sem limites adequados**: HPA sem maxReplicas pode escalar infinitamente e causar custos excessivos.
5. **CronJobs sem monitoramento**: CronJobs que falham silenciosamente criam divida operacional. Monitore com alertas.
6. **Ignorar toil porque "sempre foi assim"**: Toil aceito como normal e a maior barreira para melhoria.

## Killer.sh Style Challenge

**Cenario:** Identifique e elimine toil em um ambiente Kubernetes.

**Tarefas:**
1. Identifique 3 tarefas de toil no ambiente
2. Configure HPA para eliminar scaling manual
3. Crie CronJob para limpeza automatica
4. Configure probes para self-healing
5. Calcule o ROI da automacao implementada
`,
  quiz: [
    {
      question: 'Quais sao as 5 caracteristicas que definem toil?',
      options: [
        'Importante, urgente, complexo, estrategico, inovador',
        'Manual, repetitivo, automatizavel, sem valor duradouro, cresce com o servico',
        'Rapido, facil, simples, barato, previsivel',
        'Tecnico, operacional, administrativo, gerencial, financeiro'
      ],
      correct: 1,
      explanation: 'Toil tem 5 caracteristicas: Manual (humano executa), Repetitivo (mesma tarefa varias vezes), Automatizavel (maquina poderia fazer), Sem valor duradouro (tatico, nao estrategico), e Cresce com o servico (O(n), nao O(1)). Se uma tarefa tem todas essas caracteristicas, e toil.',
      reference: 'Conceito relacionado: sre-principles — meta de toil do Google SRE e max 50% do tempo.'
    },
    {
      question: 'Qual a meta do Google SRE para tempo gasto em toil?',
      options: [
        'Zero toil — todo trabalho deve ser automatizado',
        'Maximo 50% do tempo em toil, times maduros ficam abaixo de 30%',
        'Sem limite — toil e parte natural do trabalho',
        'Maximo 90% do tempo em toil'
      ],
      correct: 1,
      explanation: 'O Google SRE estabelece que no maximo 50% do tempo deve ser gasto em toil. O restante deve ser investido em projetos de engenharia, automacao e melhorias. Times maduros conseguem manter toil abaixo de 30%. Se toil passa de 50%, o time esta sendo sub-investido.',
      reference: 'Conceito relacionado: sre-oncall — on-call muito ativo e sinal de toil excessivo.'
    },
    {
      question: 'Quais sao os niveis da piramide de automacao, do mais basico ao mais avancado?',
      options: [
        'Script, API, Pipeline, Cloud, Serverless',
        'Manual, Documented, Semi-automated, Fully automated, Self-healing',
        'Dev, Test, Staging, Production, DR',
        'Code, Build, Test, Deploy, Monitor'
      ],
      correct: 1,
      explanation: 'A piramide de automacao vai de Manual (ad-hoc, conhecimento tribal) → Documented (runbook escrito) → Semi-automated (script + aprovacao) → Fully automated (CronJob, Operator, zero intervencao) → Self-healing (auto-remediation). Cada nivel elimina mais toil e reduz risco de erro humano.',
      reference: 'Conceito relacionado: sre-toil-automation — comece documentando antes de automatizar.'
    },
    {
      question: 'O que o behavior do HPA controla?',
      options: [
        'Apenas o numero maximo de replicas',
        'A velocidade e estabilidade de scale-up e scale-down, incluindo janelas de estabilizacao e politicas de escala',
        'O tipo de metrica usada para escalar',
        'A imagem do container a ser escalado'
      ],
      correct: 1,
      explanation: 'O campo behavior do HPA (v2) controla como o scaling acontece: stabilizationWindowSeconds evita flapping (escalar e desescalar rapidamente), policies definem a velocidade (ex: max 50% scale-up por minuto, max 10% scale-down). Isso evita oscilacoes e custos excessivos.',
      reference: 'Conceito relacionado: sre-capacity — HPA e uma ferramenta chave de capacity planning automatico.'
    },
    {
      question: 'Como GitOps elimina toil de deployment?',
      options: [
        'GitOps nao tem relacao com toil',
        'Automatizando o ciclo push-to-deploy: mudanca no Git e detectada, aplicada e verificada automaticamente por ArgoCD/Flux, sem intervencao manual',
        'Usando Git como backup dos manifestos',
        'Permitindo que desenvolvedores acessem kubectl direto'
      ],
      correct: 1,
      explanation: 'Sem GitOps, deploy e toil: rodar kubectl apply manualmente, verificar status, notificar time. Com GitOps (ArgoCD/Flux), o ciclo e automatizado: merge no Git → deteccao automatica → apply → health check → notificacao. Isso elimina toil de deploy e garante consistencia.',
      reference: 'Conceito relacionado: argocd-architecture — ArgoCD e a ferramenta GitOps mais popular para K8s.'
    },
    {
      question: 'Quando o ROI de automatizar uma tarefa e positivo?',
      options: [
        'Sempre — toda tarefa deve ser automatizada',
        'Quando o tempo economizado ao longo do tempo supera o custo de desenvolvimento da automacao',
        'Quando o manager autoriza',
        'Nunca — automacao e muito cara'
      ],
      correct: 1,
      explanation: 'ROI e positivo quando: tempo_economizado (frequencia × tempo_manual × periodo) > custo_automacao (horas_dev × valor_hora). Mas considere tambem: reducao de erros humanos, consistencia, velocidade e escalabilidade. Uma tarefa de 5 min feita 5x/dia = ~10h/mes. Se automatizar custa < 10h, vale a pena.',
      reference: 'Conceito relacionado: sre-toil-automation — use a regra xkcd 1205 para decidir quando automatizar.'
    },
    {
      question: 'Qual probe do Kubernetes e responsavel por reiniciar containers que travam?',
      options: [
        'readinessProbe',
        'startupProbe',
        'livenessProbe — reinicia o container quando falha repetidamente',
        'healthProbe'
      ],
      correct: 2,
      explanation: 'livenessProbe verifica se o container esta vivo. Se falha alem do failureThreshold, o kubelet reinicia o container automaticamente. Isso e self-healing: elimina o toil de reiniciar pods manualmente. readinessProbe controla trafego (nao reinicia). startupProbe protege containers lentos na inicializacao.',
      reference: 'Conceito relacionado: sre-observability — probes sao parte da estrategia de observabilidade e self-healing.'
    }
  ],
  flashcards: [
    {
      front: 'As 5 caracteristicas do toil?',
      back: '**1. Manual:** humano executa\n**2. Repetitivo:** mesma tarefa, varias vezes\n**3. Automatizavel:** maquina poderia fazer\n**4. Sem valor duradouro:** tatico, nao estrategico\n**5. Cresce com o servico:** O(n)\n\n**Metas:**\n- Google SRE: max 50% em toil\n- Times maduros: < 30%\n- Restante: engenharia e automacao\n\n**Exemplos de toil:**\n- Restart manual de pods\n- Scaling manual\n- Rotacao manual de certs\n- Limpar logs manualmente\n\n**NAO e toil:**\n- Escrever automacao\n- Code review\n- Postmortem'
    },
    {
      front: 'Piramide de automacao?',
      back: '**5 niveis (base → topo):**\n\n1. **Manual:**\n   Ad-hoc, conhecimento tribal\n\n2. **Documented:**\n   Runbook escrito e reproduzivel\n\n3. **Semi-automated:**\n   Script + aprovacao humana\n   Ex: pipeline com gate manual\n\n4. **Fully automated:**\n   Zero intervencao humana\n   Ex: CronJob, Operator, CI/CD\n\n5. **Self-healing:**\n   Sistema se corrige sozinho\n   Ex: liveness probe, HPA, auto-restart\n\n**Regra:** suba um nivel por vez\nDocumente antes de automatizar'
    },
    {
      front: 'HPA behavior policies?',
      back: '**ScaleUp:**\n```yaml\nbehavior:\n  scaleUp:\n    stabilizationWindowSeconds: 60\n    policies:\n      - type: Percent\n        value: 50      # max +50% por vez\n        periodSeconds: 60\n```\n\n**ScaleDown:**\n```yaml\n  scaleDown:\n    stabilizationWindowSeconds: 300\n    policies:\n      - type: Percent\n        value: 10      # max -10% por vez\n        periodSeconds: 60\n```\n\n**stabilizationWindow:**\nEvita flapping (escalar/desescalar rapido)\n\n**Regra pratica:**\nScale up rapido, scale down lento'
    },
    {
      front: 'ROI de automacao — quando automatizar?',
      back: '**Formula:**\n```\nTempo economizado =\n  frequencia × tempo_manual × periodo\n\nCusto = horas_dev × valor_hora\n\nROI positivo quando:\n  Tempo economizado > Custo\n```\n\n**Exemplo:**\n- Tarefa: 5 min, 5x/dia\n- Economia: 25 min/dia = ~10h/mes\n- Se automatizar custa < 10h → vale\n\n**Fatores alem do tempo:**\n- Reducao de erros humanos\n- Consistencia (maquina = sempre igual)\n- Velocidade (automacao e mais rapida)\n- Escalabilidade (10 ou 10.000)\n\n**Regra:** automatize o que faz\n> 3x/semana e leva > 5 min cada'
    },
    {
      front: 'Self-healing patterns em K8s?',
      back: '**1. Liveness Probe:**\n- Reinicia container se travar\n- httpGet, exec, tcpSocket\n\n**2. Readiness Probe:**\n- Remove pod do Service se nao pronto\n- Evita trafego para pod doente\n\n**3. HPA:**\n- Escala automaticamente\n- Baseado em CPU/mem/custom metrics\n\n**4. PodDisruptionBudget:**\n- Garante minimo de pods durante drain\n```yaml\nspec:\n  minAvailable: 2\n```\n\n**5. Anti-affinity:**\n- Distribui pods entre nodes\n- Resiliencia a falha de node\n\n**6. Restart policy:**\n- Always (default para Deployments)\n- OnFailure (para Jobs)'
    },
    {
      front: 'GitOps elimina qual tipo de toil?',
      back: '**Sem GitOps (toil):**\n1. Dev roda kubectl apply manual\n2. Dev verifica status manualmente\n3. Dev notifica time manualmente\n4. Rollback manual se falhar\n\n**Com GitOps (automatizado):**\n1. Dev faz merge do PR\n2. ArgoCD detecta mudanca\n3. ArgoCD aplica + health check\n4. Notificacao automatica\n5. Rollback automatico se falhar\n\n**Toil eliminado:**\n- Deploy manual\n- Verificacao de status\n- Notificacao de deploy\n- Rollback manual\n- Drift detection\n\n**Ferramentas:** ArgoCD, Flux, Jenkins X'
    }
  ],
  lab: {
    scenario: 'Seu time gasta 40% do tempo em tarefas operacionais repetitivas: escalar pods manualmente, limpar dados antigos e reiniciar servicos que travam. Voce precisa automatizar essas tarefas.',
    objective: 'Configurar HPA para auto-scaling, CronJob para limpeza automatica, e probes para self-healing.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Configurar HPA com Behavior Policies',
        instruction: `Configure um HPA com politicas de scale-up rapido e scale-down conservador.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-server
  minReplicas: 3
  maxReplicas: 15
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 100
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 120
EOF
\`\`\``,
        hints: [
          'scaleUp rapido permite responder a picos de trafego',
          'scaleDown lento evita remover pods durante flutuacoes temporarias',
          'stabilizationWindowSeconds e o tempo de espera antes de agir'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-server
  minReplicas: 3
  maxReplicas: 15
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
EOF
\`\`\``,
        verify: `\`\`\`bash
kubectl get hpa api-hpa -n production
# Saida esperada: NAME      REFERENCE               TARGETS   MINPODS   MAXPODS   REPLICAS
#                  api-hpa   Deployment/api-server   ...       3         15        ...

kubectl describe hpa api-hpa -n production | grep -A5 "Behavior"
# Saida esperada: ScaleUp e ScaleDown policies
\`\`\``
      },
      {
        title: 'Criar CronJob para Limpeza Automatica',
        instruction: `Crie um CronJob que limpa recursos antigos automaticamente.

\`\`\`bash
# Criar ServiceAccount com permissoes
kubectl apply -f - <<EOF
apiVersion: v1
kind: ServiceAccount
metadata:
  name: cleanup-sa
  namespace: production
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: cleanup-role
  namespace: production
rules:
  - apiGroups: [""]
    resources: ["configmaps", "pods"]
    verbs: ["get", "list", "delete"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: cleanup-binding
  namespace: production
subjects:
  - kind: ServiceAccount
    name: cleanup-sa
roleRef:
  kind: Role
  name: cleanup-role
  apiGroup: rbac.authorization.k8s.io
---
apiVersion: batch/v1
kind: CronJob
metadata:
  name: cleanup-completed-pods
  namespace: production
spec:
  schedule: "0 4 * * *"
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 1
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: cleanup-sa
          containers:
            - name: cleanup
              image: bitnami/kubectl:latest
              command:
                - /bin/sh
                - -c
                - |
                  echo "Cleaning up completed pods..."
                  kubectl delete pods -n production --field-selector=status.phase==Succeeded
                  kubectl delete pods -n production --field-selector=status.phase==Failed --ignore-not-found
                  echo "Cleanup complete"
          restartPolicy: OnFailure
EOF
\`\`\``,
        hints: [
          'O ServiceAccount precisa de permissoes para deletar recursos',
          'successfulJobsHistoryLimit mantem apenas N jobs concluidos',
          'Use --ignore-not-found para evitar erros quando nao ha pods para limpar'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: batch/v1
kind: CronJob
metadata:
  name: cleanup-completed-pods
  namespace: production
spec:
  schedule: "0 4 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: cleanup
              image: bitnami/kubectl:latest
              command: ["/bin/sh", "-c", "kubectl delete pods --field-selector=status.phase==Succeeded -n production"]
          restartPolicy: OnFailure
EOF
\`\`\``,
        verify: `\`\`\`bash
kubectl get cronjob cleanup-completed-pods -n production
# Saida esperada: NAME                      SCHEDULE    SUSPEND   ACTIVE   LAST SCHEDULE
#                  cleanup-completed-pods    0 4 * * *   False     0        <none>

# Testar execucao manual
kubectl create job --from=cronjob/cleanup-completed-pods test-cleanup -n production
kubectl get jobs -n production | grep test-cleanup
# Saida esperada: job criado
\`\`\``
      },
      {
        title: 'Configurar Self-Healing com Probes',
        instruction: `Configure probes completas para self-healing automatico.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: self-healing-app
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: self-healing-app
  template:
    metadata:
      labels:
        app: self-healing-app
    spec:
      containers:
        - name: app
          image: nginx:alpine
          ports:
            - containerPort: 80
          livenessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 10
            periodSeconds: 10
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 5
            periodSeconds: 5
            failureThreshold: 2
          startupProbe:
            httpGet:
              path: /
              port: 80
            failureThreshold: 30
            periodSeconds: 5
          resources:
            requests:
              cpu: 50m
              memory: 64Mi
            limits:
              cpu: 200m
              memory: 128Mi
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: self-healing-pdb
  namespace: production
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: self-healing-app
EOF
\`\`\``,
        hints: [
          'livenessProbe reinicia container se falhar (self-healing)',
          'readinessProbe remove pod do trafego se nao estiver pronto',
          'PodDisruptionBudget garante minimo de pods durante manutencao'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: self-healing-app
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: self-healing-app
  template:
    metadata:
      labels:
        app: self-healing-app
    spec:
      containers:
        - name: app
          image: nginx:alpine
          livenessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 10
            periodSeconds: 10
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verificar deployment criado
kubectl get deployment self-healing-app -n production
# Saida esperada: READY 3/3

# Verificar probes configuradas
kubectl get deployment self-healing-app -n production -o jsonpath='{.spec.template.spec.containers[0].livenessProbe.httpGet.path}'
# Saida esperada: /

# Verificar PDB
kubectl get pdb self-healing-pdb -n production
# Saida esperada: MIN AVAILABLE: 2
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'HPA nao escala — metricas nao disponiveis',
      difficulty: 'medium',
      symptom: 'O HPA mostra "unknown" em TARGETS e nao escala os pods, mesmo sob carga alta.',
      diagnosis: `\`\`\`bash
# Verificar status do HPA
kubectl describe hpa api-hpa -n production

# Verificar se metrics-server esta rodando
kubectl get pods -n kube-system | grep metrics-server

# Verificar se metricas estao disponiveis
kubectl top pods -n production

# Verificar eventos do HPA
kubectl get events -n production --field-selector involvedObject.name=api-hpa
\`\`\``,
      solution: `**Causas comuns:**

1. **Metrics Server nao instalado:**
\`\`\`bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
\`\`\`

2. **Metrics Server com erro TLS:** Em clusters locais, adicione flag:
\`\`\`bash
kubectl patch deployment metrics-server -n kube-system --type=json \\
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'
\`\`\`

3. **Container sem requests definidos:** HPA precisa de resources.requests para calcular utilizacao:
\`\`\`yaml
resources:
  requests:
    cpu: 100m
    memory: 128Mi
\`\`\`

4. **Custom metrics sem adapter:** Para metricas custom, instale prometheus-adapter.`
    },
    {
      title: 'CronJob falha silenciosamente',
      difficulty: 'easy',
      symptom: 'CronJob de limpeza esta configurado mas os recursos antigos nao estao sendo limpos. Nenhum erro visivel.',
      diagnosis: `\`\`\`bash
# Verificar historico de jobs
kubectl get jobs -n production --sort-by='.status.startTime' | tail -5

# Verificar logs do ultimo job
kubectl logs job/$(kubectl get jobs -n production -o name | tail -1 | cut -d/ -f2) -n production

# Verificar se o CronJob esta suspenso
kubectl get cronjob cleanup-completed-pods -n production -o jsonpath='{.spec.suspend}'

# Verificar ServiceAccount e permissoes
kubectl auth can-i delete pods -n production --as=system:serviceaccount:production:cleanup-sa
\`\`\``,
      solution: `**Causas e solucoes:**

1. **ServiceAccount sem permissoes:** O CronJob precisa de RBAC adequado:
\`\`\`bash
kubectl auth can-i delete pods -n production --as=system:serviceaccount:production:cleanup-sa
# Se "no", criar Role e RoleBinding
\`\`\`

2. **CronJob suspenso:**
\`\`\`bash
kubectl patch cronjob cleanup-completed-pods -n production -p '{"spec":{"suspend":false}}'
\`\`\`

3. **Schedule errado:** Verifique se o cron expression esta correta (timezone UTC por padrao).

4. **Job completando mas sem efeito:** O comando pode ter erro logico. Teste manualmente:
\`\`\`bash
kubectl create job --from=cronjob/cleanup-completed-pods test-manual -n production
kubectl logs job/test-manual -n production
\`\`\``
    },
    {
      title: 'Time com mais de 60% em toil mas sem budget para automatizar',
      difficulty: 'hard',
      symptom: 'O time SRE gasta 60%+ do tempo em toil. Nao ha budget de engenharia alocado para automacao porque o time esta sempre ocupado com operacoes.',
      diagnosis: `\`\`\`bash
# Quantificar toil atual
# Revisar tickets dos ultimos 30 dias
# Classificar por tipo: toil vs engenharia

# Verificar indicadores no cluster
kubectl get events -A --field-selector type=Warning --sort-by='.lastTimestamp' | wc -l
kubectl get pods -A --field-selector=status.phase!=Running | wc -l
\`\`\``,
      solution: `**Estrategia de escape:**

1. **Medir e documentar:** Rastreie toil por 2 semanas com categorias. Apresente dados concretos: "Gastamos X horas/semana em Y tarefas repetitivas."

2. **Quick wins primeiro:** Identifique tarefas que levam < 2h para automatizar:
   - CronJob para limpeza
   - HPA para scaling
   - Probes para self-healing

3. **20% rule:** Reserve 20% do tempo semanal para automacao, mesmo sem aprovacao formal. Os quick wins justificam o investimento.

4. **Calcule ROI:** "Automatizar X economiza Y horas/mes. Em 3 meses, pagou-se."

5. **Escale o problema:** Se toil > 50% persistentemente, e um problema organizacional. Escale para lideranca com dados de impacto no error budget e satisfacao do time.

6. **Toil budget:** Negocie um "toil cap" — se toil > 50%, features param automaticamente ate toil ser reduzido.`
    }
  ]
};
