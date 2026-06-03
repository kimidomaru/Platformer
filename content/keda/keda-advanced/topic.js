window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['keda/keda-advanced'] = {
  theory: `# KEDA Avançado — Padrões de Produção

## Relevância no Exame
> Tópicos avançados de KEDA cobertos em KubeAstronaut: ClusterTriggerAuthentication, ScaledJob com estratégias de scaling, KEDA com múltiplas fontes, integração com Service Mesh e observabilidade do próprio KEDA.

## Conceitos Avançados

### ClusterTriggerAuthentication — Credenciais Compartilhadas
Enquanto TriggerAuthentication é namespace-scoped, ClusterTriggerAuthentication é cluster-wide:

\`\`\`yaml
apiVersion: keda.sh/v1alpha1
kind: ClusterTriggerAuthentication
metadata:
  name: kafka-cluster-auth
  # Sem namespace — é cluster-scoped
spec:
  secretTargetRef:
    - parameter: sasl.user
      name: kafka-credentials
      namespace: keda  # namespace do Secret
      key: username
    - parameter: sasl.password
      name: kafka-credentials
      namespace: keda
      key: password

---
# Referenciar em ScaledObject de qualquer namespace
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: my-scaler
  namespace: team-a   # namespace diferente!
spec:
  scaleTargetRef:
    name: my-deployment
  triggers:
    - type: kafka
      metadata:
        bootstrapServers: kafka:9092
        topic: orders
        lagThreshold: "10"
      authenticationRef:
        name: kafka-cluster-auth
        kind: ClusterTriggerAuthentication  # especificar o tipo!
\`\`\`

### ScaledJob — Estratégias de Scaling Avançadas

#### Estratégia Accurate
Cria exatamente 1 Job por mensagem/item:
\`\`\`yaml
spec:
  scalingStrategy:
    strategy: accurate
    # Fórmula: targetPendingJobs = queueLength - runningJobs
\`\`\`

#### Estratégia Custom
Controle fino sobre quantos jobs criar:
\`\`\`yaml
spec:
  scalingStrategy:
    strategy: custom
    customScalingQueueLengthDeduction: 1
    # Descontar X da fila por job em execução
    customScalingRunningJobPercentage: "0.5"
    # Considerar que 50% dos jobs running ainda processam
    pendingJobCount: 100
    # Limite de jobs no estado Pending
\`\`\`

#### Rollout Strategy
\`\`\`yaml
spec:
  rollout:
    strategy: gradual   # gradual | default
    propagationPolicy: foreground
    # gradual: espera jobs anteriores completarem antes de criar novos
    # default: cria jobs imediatamente
\`\`\`

### KEDA com KEDA HTTP Add-on
O HTTP Add-on permite escalar baseado em requests HTTP em fila (scale-to-zero para APIs):

\`\`\`yaml
# Instalar HTTP Add-on
helm install http-add-on kedacore/keda-add-ons-http \\
  --namespace keda

---
# HTTPScaledObject (diferente do ScaledObject padrão)
apiVersion: http.keda.sh/v1alpha1
kind: HTTPScaledObject
metadata:
  name: api-http-scaler
  namespace: default
spec:
  hosts:
    - api.example.com
  pathPrefixes:
    - /api/
  targetPendingRequests: 100   # requests em fila por pod
  scaleTargetRef:
    deployment: api-deployment
    service: api-service
    port: 8080
  replicas:
    min: 0
    max: 30
\`\`\`

### KEDA Metrics API — Integrando com HPA Padrão
\`\`\`yaml
# Usar métricas do KEDA em um HPA padrão
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: custom-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: my-app
  minReplicas: 2
  maxReplicas: 50
  metrics:
    - type: External
      external:
        metric:
          name: s0-kafka-orders   # nome gerado pelo KEDA
          selector:
            matchLabels:
              scaledobject.keda.sh/name: my-scaler
        target:
          type: Value
          value: "10"
\`\`\`

### Observabilidade do KEDA

#### Métricas do KEDA Expostas via Prometheus
\`\`\`bash
# Métricas principais do keda-operator
keda_scaler_active                # 1 se scaler ativo, 0 se não
keda_scaler_metrics_value         # valor atual da métrica
keda_scaler_errors_total          # erros de polling
keda_scaled_object_errors_total   # erros por ScaledObject
keda_resource_totals              # total de recursos KEDA

# Verificar via port-forward
kubectl port-forward -n keda svc/keda-operator-metrics-apiserver 8080:8080
curl http://localhost:8080/metrics | grep keda_scaler
\`\`\`

#### ServiceMonitor para kube-prometheus-stack
\`\`\`yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: keda-operator
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: keda-operator
  namespaceSelector:
    matchNames:
      - keda
  endpoints:
    - port: metrics
      interval: 30s
      path: /metrics
\`\`\`

### Padrão: KEDA com Argo Rollouts
Integração com deployments progressivos:
\`\`\`yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: rollout-scaler
spec:
  scaleTargetRef:
    apiVersion: argoproj.io/v1alpha1
    kind: Rollout          # aponta para Rollout ao invés de Deployment
    name: my-rollout
  minReplicaCount: 2
  maxReplicaCount: 50
  triggers:
    - type: kafka
      metadata:
        bootstrapServers: kafka:9092
        topic: events
        lagThreshold: "15"
\`\`\`

### Padrão: Fallback Configuration
Configurar comportamento quando a fonte externa está indisponível:
\`\`\`yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: resilient-scaler
spec:
  scaleTargetRef:
    name: my-deployment
  minReplicaCount: 2
  maxReplicaCount: 50
  fallback:
    failureThreshold: 3     # falhas antes de ativar fallback
    replicas: 5             # réplicas durante fallback
  triggers:
    - type: kafka
      metadata:
        bootstrapServers: kafka:9092
        topic: orders
        lagThreshold: "10"
\`\`\`

### Padrão: KEDA com VPA (Vertical Pod Autoscaler)
Usar KEDA para escala horizontal e VPA para escala vertical:
\`\`\`yaml
# VPA para ajustar recursos dos pods
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: consumer-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: kafka-consumer
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
      - containerName: consumer
        minAllowed:
          cpu: 100m
          memory: 128Mi
        maxAllowed:
          cpu: 2
          memory: 2Gi

# ScaledObject para escala horizontal
---
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: kafka-consumer-scaler
spec:
  scaleTargetRef:
    name: kafka-consumer
  minReplicaCount: 1
  maxReplicaCount: 20
  triggers:
    - type: kafka
      metadata:
        lagThreshold: "50"
\`\`\`

### Scaling de StatefulSets
\`\`\`yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: statefulset-scaler
spec:
  scaleTargetRef:
    kind: StatefulSet
    name: redis-cluster
  minReplicaCount: 3    # mínimo para quorum
  maxReplicaCount: 9
  advanced:
    horizontalPodAutoscalerConfig:
      behavior:
        scaleDown:
          stabilizationWindowSeconds: 600  # 10min para StatefulSet
          policies:
            - type: Pods
              value: 1           # apenas 1 pod por vez (seguro para StatefulSet)
              periodSeconds: 120
  triggers:
    - type: redis
      metadata:
        address: redis-cluster:6379
        listName: tasks
        listLength: "100"
\`\`\`

## Comandos Essenciais

### Debug Avançado
\`\`\`bash
# Ver todas as métricas externas disponíveis no cluster
kubectl get --raw "/apis/external.metrics.k8s.io/v1beta1" | \\
  jq '.resources[].name'

# Ver valor atual de uma métrica específica
kubectl get --raw \\
  "/apis/external.metrics.k8s.io/v1beta1/namespaces/default/s0-kafka-orders" | \\
  jq '.items[0]'

# Verificar se webhook de admissão está respondendo
kubectl get validatingwebhookconfiguration | grep keda
kubectl get mutatingwebhookconfiguration | grep keda

# Checar certificado do webhook
kubectl get secret -n keda keda-operator-certs -o yaml | \\
  grep tls.crt | awk '{print \$2}' | base64 -d | \\
  openssl x509 -text -noout | grep "Not After"

# Forçar re-sync de um ScaledObject
kubectl patch scaledobject my-scaler --type merge \\
  -p '{"metadata":{"annotations":{"autoscaling.keda.sh/restartedAt":"'"\$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}}}'

# Ver detalhes do ScaledJob
kubectl describe scaledjob image-processor
kubectl get jobs -l scaledjob.keda.sh/name=image-processor
\`\`\`

### Gerenciamento de ClusterTriggerAuthentication
\`\`\`bash
# Listar CTA
kubectl get clustertriggerauthentication

# Verificar quais ScaledObjects usam uma CTA
kubectl get scaledobject --all-namespaces -o json | \\
  jq '.items[] | select(.spec.triggers[].authenticationRef.kind=="ClusterTriggerAuthentication") | .metadata'

# Atualizar Secret referenciado (credenciais rotacionadas)
kubectl create secret generic kafka-credentials \\
  -n keda \\
  --from-literal=username=new-user \\
  --from-literal=password=new-pass \\
  --dry-run=client -o yaml | kubectl apply -f -
# O KEDA pega automaticamente na próxima verificação
\`\`\`

## Exemplos YAML

### Pipeline Completo: Kafka → KEDA → ScaledJob → S3
\`\`\`yaml
# 1. Secret com credenciais
apiVersion: v1
kind: Secret
metadata:
  name: pipeline-creds
  namespace: processing
stringData:
  kafka-username: processor
  kafka-password: "s3cr3t"
  aws-role-arn: "arn:aws:iam::123456789:role/s3-writer"

---
# 2. TriggerAuthentication
apiVersion: keda.sh/v1alpha1
kind: TriggerAuthentication
metadata:
  name: pipeline-auth
  namespace: processing
spec:
  secretTargetRef:
    - parameter: sasl.user
      name: pipeline-creds
      key: kafka-username
    - parameter: sasl.password
      name: pipeline-creds
      key: kafka-password

---
# 3. ScaledJob para processamento
apiVersion: keda.sh/v1alpha1
kind: ScaledJob
metadata:
  name: data-processor
  namespace: processing
spec:
  jobTargetRef:
    parallelism: 1
    completions: 1
    backoffLimit: 3
    activeDeadlineSeconds: 300
    template:
      metadata:
        labels:
          app: data-processor
      spec:
        serviceAccountName: s3-writer-sa  # IRSA para AWS
        restartPolicy: Never
        containers:
          - name: processor
            image: my-data-processor:v1.2.0
            env:
              - name: KAFKA_BOOTSTRAP
                value: kafka.kafka:9092
              - name: S3_BUCKET
                value: my-data-bucket
            resources:
              requests:
                memory: 256Mi
                cpu: 250m
              limits:
                memory: 512Mi
                cpu: 500m

  maxReplicaCount: 50
  pollingInterval: 10
  successfulJobsHistoryLimit: 5
  failedJobsHistoryLimit: 3

  scalingStrategy:
    strategy: accurate

  triggers:
    - type: kafka
      metadata:
        bootstrapServers: kafka.kafka:9092
        consumerGroup: data-processors
        topic: raw-data
        lagThreshold: "1"          # 1 Job por mensagem no lag
        activationLagThreshold: "0"
        sasl: plain
      authenticationRef:
        name: pipeline-auth

---
# 4. ServiceAccount com IRSA
apiVersion: v1
kind: ServiceAccount
metadata:
  name: s3-writer-sa
  namespace: processing
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789:role/s3-writer
\`\`\`

### Configuração Multi-Cluster (KEDA + ArgoCD)
\`\`\`yaml
# ApplicationSet para deploy KEDA em múltiplos clusters
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: keda-stack
  namespace: argocd
spec:
  generators:
    - clusters:
        selector:
          matchLabels:
            needs-keda: "true"
  template:
    metadata:
      name: keda-{{name}}
    spec:
      project: infrastructure
      source:
        repoURL: https://kedacore.github.io/charts
        chart: keda
        targetRevision: 2.14.0
        helm:
          values: |
            operator:
              replicaCount: 2
            metricsServer:
              replicaCount: 2
            podDisruptionBudget:
              operator:
                minAvailable: 1
              metricServer:
                minAvailable: 1
      destination:
        server: "{{server}}"
        namespace: keda
      syncPolicy:
        automated:
          prune: true
          selfHeal: true
\`\`\`

### KEDA com KEDA HTTP Add-on para APIs
\`\`\`yaml
apiVersion: http.keda.sh/v1alpha1
kind: HTTPScaledObject
metadata:
  name: payment-api-scaler
  namespace: payments
spec:
  hosts:
    - payments.internal.company.com
  targetPendingRequests: 50    # 50 requests pendentes por pod
  scaleTargetRef:
    deployment: payment-api
    service: payment-api-svc
    port: 8080
  replicas:
    min: 0   # scale-to-zero!
    max: 100
  scalingMetric:
    requestRate:
      granularity: 1s
      targetValue: 100    # 100 req/s por pod
      window: 1m
\`\`\`

## Erros Comuns

### 1. ClusterTriggerAuthentication referenciada sem especificar kind
**Problema**: ScaledObject não encontra a autenticação e falha.
**Causa**: authenticationRef sem \`kind: ClusterTriggerAuthentication\`.
**Solução**: Sempre especificar o kind quando usar CTA.
\`\`\`yaml
authenticationRef:
  name: my-cluster-auth
  kind: ClusterTriggerAuthentication  # OBRIGATÓRIO
\`\`\`

### 2. ScaledJob acumula Jobs completados/falhos
**Causa**: successfulJobsHistoryLimit e failedJobsHistoryLimit não configurados.
**Solução**: Definir limites de histórico no ScaledJob.
\`\`\`yaml
spec:
  successfulJobsHistoryLimit: 5
  failedJobsHistoryLimit: 3
\`\`\`

### 3. Webhook de admissão recusa ScaledObject
**Causa**: Certificado do webhook expirado ou webhook não responde.
**Solução**:
\`\`\`bash
# Verificar certificado
kubectl get secret -n keda keda-operator-certs -o jsonpath='{.data.tls\\.crt}' | \\
  base64 -d | openssl x509 -text | grep "Not After"

# Renovar certificados (reinstalar KEDA resolve)
helm upgrade keda kedacore/keda -n keda --reuse-values
\`\`\`

### 4. Fallback não ativado corretamente
**Causa**: failureThreshold muito alto — a fonte fica fora por tempo insuficiente.
**Solução**: Reduzir threshold e verificar se a fonte está realmente inacessível.

### 5. StatefulSet escala muito rápido causando instabilidade
**Causa**: Políticas de scale-down muito agressivas para StatefulSets.
**Solução**: Usar \`type: Pods\` com \`value: 1\` e período alto para StatefulSets.

## Killer.sh Style Challenge

**Contexto**: Uma empresa de fintech processa transações via Kafka. Requisitos:
1. O processador de transações deve escalar baseado no lag do Kafka (grupo: \`txn-processors\`)
2. As credenciais Kafka devem ser compartilhadas por 3 namespaces (payments, fraud, analytics)
3. Em caso de falha do Kafka, manter 3 réplicas (fallback)
4. Escalar no máximo 1 pod por vez para baixo (estabilidade)
5. Máximo de 100 pods, mínimo de 2

Crie ClusterTriggerAuthentication + ScaledObject atendendo todos os requisitos.`,

  quiz: [
    {
      question: 'Qual a diferença entre TriggerAuthentication e ClusterTriggerAuthentication?',
      options: [
        'TriggerAuthentication suporta mais provedores; ClusterTriggerAuthentication é mais simples',
        'TriggerAuthentication é namespace-scoped; ClusterTriggerAuthentication é acessível por todo o cluster',
        'ClusterTriggerAuthentication só funciona com Kafka e RabbitMQ',
        'Não há diferença prática — são equivalentes'
      ],
      correct: 1,
      explanation: 'TriggerAuthentication é namespace-scoped e só pode ser referenciada por ScaledObjects do mesmo namespace. ClusterTriggerAuthentication é cluster-scoped e pode ser reutilizada por ScaledObjects de qualquer namespace — ideal para credenciais compartilhadas entre times.',
      reference: 'CRD: ClusterTriggerAuthentication — seção dedicada na teoria.'
    },
    {
      question: 'Qual campo do ScaledObject configura o comportamento quando a fonte de métricas fica indisponível?',
      options: [
        'spec.errorPolicy',
        'spec.fallback',
        'spec.recovery',
        'spec.highAvailability'
      ],
      correct: 1,
      explanation: 'O campo spec.fallback define o comportamento de degradação graciosa: failureThreshold especifica quantas falhas consecutivas ativam o fallback, e replicas especifica quantas réplicas manter durante a degradação. Sem fallback, o KEDA usa a última métrica conhecida.',
      reference: 'Config: fallback — seção "Padrão: Fallback Configuration" na teoria.'
    },
    {
      question: 'Quando usar a estratégia "accurate" no ScaledJob?',
      options: [
        'Quando você precisa processar cada mensagem exatamente uma vez, criando 1 Job por mensagem',
        'Quando você quer maximizar o throughput independente do número de mensagens',
        'Quando o job tem múltiplos containers que precisam de coordenação',
        'Apenas para workloads de machine learning com datasets grandes'
      ],
      correct: 0,
      explanation: 'A estratégia "accurate" cria exatamente 1 Job por mensagem/item na fila, subtraindo os jobs já em execução do total. É ideal para processamento one-shot onde cada mensagem deve ser processada por um job dedicado, como transformação de dados ou envio de emails.',
      reference: 'ScaledJob: estratégia accurate — seção "ScaledJob — Estratégias de Scaling Avançadas" na teoria.'
    },
    {
      question: 'Como referenciar uma ClusterTriggerAuthentication em um ScaledObject?',
      options: [
        'authenticationRef: name: my-cta (sem kind = usa CTA automaticamente)',
        'authenticationRef: name: my-cta kind: ClusterTriggerAuthentication',
        'clusterAuthenticationRef: name: my-cta',
        'authenticationRef: cluster: true name: my-cta'
      ],
      correct: 1,
      explanation: 'É OBRIGATÓRIO especificar kind: ClusterTriggerAuthentication no authenticationRef. Sem o kind, o KEDA busca um TriggerAuthentication namespace-scoped e falha. A combinação name + kind é a forma correta de referenciar recursos cluster-scoped.',
      reference: 'Erros comuns: CTA sem kind — seção "Erros Comuns" na teoria.'
    },
    {
      question: 'Para escalar um StatefulSet de forma segura com KEDA, qual política de scale-down é mais adequada?',
      options: [
        'type: Percent value: 50 — remover 50% das réplicas por período',
        'type: Pods value: 1 com período alto — apenas 1 pod por vez',
        'type: Pods value: 3 — remover até 3 pods por período para agilidade',
        'Não usar políticas — deixar o KEDA gerenciar automaticamente'
      ],
      correct: 1,
      explanation: 'StatefulSets têm garantias de ordering e identidade que tornam scale-down agressivo perigoso (pode quebrar quorum em bancos distribuídos). Usar type: Pods value: 1 com período alto (120s+) garante remoção de apenas 1 pod por vez, dando tempo para rebalanceamento.',
      reference: 'Padrão: StatefulSet — seção "Scaling de StatefulSets" na teoria.'
    },
    {
      question: 'Qual métrica do KEDA indica se um scaler está ativo (recebendo eventos)?',
      options: [
        'keda_operator_active_scalers',
        'keda_scaler_active',
        'keda_scaled_object_replicas_current',
        'keda_trigger_active_total'
      ],
      correct: 1,
      explanation: 'keda_scaler_active é uma gauge que retorna 1 quando o scaler está ativo (há eventos/mensagens) e 0 quando inativo (sem carga). É útil para alertas e dashboards — permite detectar quando workloads foram escalados para zero e estão aguardando eventos.',
      reference: 'Observabilidade: métricas do KEDA — seção "Observabilidade do KEDA" na teoria.'
    },
    {
      question: 'O que é o KEDA HTTP Add-on e qual caso de uso resolve?',
      options: [
        'Um webhook para configuração via HTTP REST API do KEDA',
        'Um componente que permite scale-to-zero para APIs HTTP baseado em requests pendentes',
        'Um proxy HTTP para rotear requests para o pod correto',
        'Uma extensão para monitorar endpoints HTTP e criar alertas'
      ],
      correct: 1,
      explanation: 'O KEDA HTTP Add-on adiciona um interceptor proxy antes das APIs. Quando 0 réplicas, o proxy faz buffer dos requests. Quando novos requests chegam, o KEDA escala de 0 para 1+ antes de encaminhar. Isso permite true scale-to-zero para APIs HTTP sem perda de requests.',
      reference: 'Componente: KEDA HTTP Add-on — seção dedicada na teoria.'
    },
    {
      question: 'Qual é o efeito de configurar successfulJobsHistoryLimit e failedJobsHistoryLimit em um ScaledJob?',
      options: [
        'Define quantos jobs simultâneos podem existir ao mesmo tempo',
        'Limita quantos Jobs completados/falhos são mantidos no histórico, evitando acúmulo',
        'Define o número máximo de tentativas por job antes de falhar',
        'Controla a retenção de logs dos jobs no Loki'
      ],
      correct: 1,
      explanation: 'Sem esses limites, Jobs completados e falhos se acumulam indefinidamente no cluster, consumindo recursos do etcd e tornando kubectl get jobs ilegível. successfulJobsHistoryLimit mantém os N últimos jobs bem-sucedidos e failedJobsHistoryLimit os N últimos falhos.',
      reference: 'ScaledJob: histórico — seção "Pipeline Completo" YAML na teoria.'
    }
  ],

  flashcards: [
    {
      front: 'Quando usar ClusterTriggerAuthentication vs TriggerAuthentication?',
      back: 'TriggerAuthentication:\n- Namespace-scoped\n- Só usada no mesmo namespace\n- Para credenciais específicas de um time\n- Mais seguro (isolamento por namespace)\n\nClusterTriggerAuthentication:\n- Cluster-scoped\n- Reutilizável em qualquer namespace\n- Para credenciais compartilhadas (Kafka central, RabbitMQ shared)\n- Requer kind: ClusterTriggerAuthentication no authenticationRef\n\nRef obrigatória:\nauthenticationRef:\n  name: my-cta\n  kind: ClusterTriggerAuthentication'
    },
    {
      front: 'O que faz o fallback do ScaledObject?',
      back: 'Configura comportamento quando fonte de métricas fica indisponível:\n\nspec:\n  fallback:\n    failureThreshold: 3   # N falhas consecutivas\n    replicas: 5           # réplicas durante fallback\n\nFluxo:\n1. Fonte fica indisponível\n2. Após failureThreshold falhas → ativa fallback\n3. Deployment mantido com N réplicas\n4. Quando fonte volta → retorna ao comportamento normal\n\nSem fallback: KEDA usa última métrica conhecida'
    },
    {
      front: 'Quais são as estratégias de scaling do ScaledJob?',
      back: 'default:\n- Cria jobs proporcionalmente ao queue length\n- Pode criar mais jobs que mensagens\n\naccurate:\n- 1 job exatamente por mensagem no lag\n- Fórmula: target = queueLen - runningJobs\n- Mais preciso para one-shot processing\n\ncustom:\n- Controle fino via customScalingQueueLengthDeduction\n- customScalingRunningJobPercentage\n- pendingJobCount (limite de jobs Pending)'
    },
    {
      front: 'Como usar KEDA para escalar StatefulSets de forma segura?',
      back: 'Usar HPA behavior com políticas conservadoras:\n\nspec:\n  scaleTargetRef:\n    kind: StatefulSet\n    name: my-statefulset\n  minReplicaCount: 3  # quorum mínimo\n  advanced:\n    horizontalPodAutoscalerConfig:\n      behavior:\n        scaleDown:\n          stabilizationWindowSeconds: 600\n          policies:\n            - type: Pods\n              value: 1    # 1 pod por vez\n              periodSeconds: 120'
    },
    {
      front: 'Quais são as principais métricas do KEDA para monitoramento?',
      back: 'keda_scaler_active\n- 1 = scaler ativo (há eventos), 0 = inativo\n\nkeda_scaler_metrics_value\n- Valor atual da métrica monitorada\n\nkeda_scaler_errors_total\n- Erros de polling da fonte\n\nkeda_scaled_object_errors_total\n- Erros por ScaledObject\n\nkeda_resource_totals\n- Total de recursos KEDA no cluster\n\nAcessar via:\nkubectl port-forward -n keda svc/keda-operator-metrics-apiserver 8080\ncurl http://localhost:8080/metrics'
    },
    {
      front: 'O que é o KEDA HTTP Add-on e como funciona?',
      back: 'Permite scale-to-zero para APIs HTTP:\n\nArquitetura:\n1. Interceptor proxy fica na frente da API\n2. Com 0 réplicas: proxy faz buffer dos requests\n3. Requests chegam → KEDA escala de 0 para 1+\n4. Requests em buffer são encaminhados\n\nHTTPScaledObject:\n- targetPendingRequests: X (requests em fila por pod)\n- hosts: domínios a interceptar\n- min/max replicas\n\nInstalação:\nhelm install http-add-on kedacore/keda-add-ons-http'
    },
    {
      front: 'Como renovar os certificados do webhook do KEDA?',
      back: '# Verificar validade do certificado\nkubectl get secret -n keda keda-operator-certs \\\n  -o jsonpath=\'{.data.tls\\.crt}\' | \\\n  base64 -d | openssl x509 -text | grep "Not After"\n\n# Renovar via helm upgrade\nhelm upgrade keda kedacore/keda \\\n  -n keda --reuse-values\n\n# Ou reinstalação limpa se necessário\nhelm uninstall keda -n keda\nhelm install keda kedacore/keda -n keda\n\n# Verificar webhook após renovação\nkubectl get validatingwebhookconfiguration | grep keda'
    },
    {
      front: 'Como forçar re-sync de um ScaledObject sem recriá-lo?',
      back: '# Adicionar annotation para forçar re-sync\nkubectl patch scaledobject my-scaler --type merge \\\n  -p \'{"metadata":{"annotations":{"autoscaling.keda.sh/restartedAt":"2024-01-01T00:00:00Z"}}}\'\n\n# Ou usar qualquer timestamp atual\nkubectl annotate scaledobject my-scaler \\\n  autoscaling.keda.sh/restartedAt="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \\\n  --overwrite\n\nÚtil quando:\n- TriggerAuthentication foi atualizada\n- Source externa voltou após downtime\n- Credenciais rotacionadas'
    }
  ],

  lab: {
    scenario: 'Você é o Platform Engineer responsável por uma plataforma de processamento de eventos. Múltiplos times (payments, analytics, fraud) consomem do mesmo cluster Kafka e precisam de escalamento automático. Você deve configurar credenciais compartilhadas e ScaledObjects para cada time, com fallback e políticas de scale-down seguras.',
    objective: 'Configurar ClusterTriggerAuthentication, múltiplos ScaledObjects com fallback, ScaledJob para processamento batch e ServiceMonitor para observabilidade do KEDA.',
    duration: '40-50 minutos',
    steps: [
      {
        title: 'Configurar ClusterTriggerAuthentication e Namespaces',
        instruction: `Crie namespaces para os times e configure credenciais compartilhadas via ClusterTriggerAuthentication, simulando credenciais Kafka compartilhadas entre múltiplos times.

Use o Redis como simulação de "fonte de eventos" (já que Kafka requer mais infraestrutura).`,
        hints: [
          'ClusterTriggerAuthentication não tem namespace na sua metadata',
          'O Secret referenciado por CTA PRECISA estar em um namespace específico — use keda ou um namespace dedicado',
          'Para testar sem Kafka real, use o Redis scaler que é mais simples de setup'
        ],
        solution: `\`\`\`bash
# Criar namespaces dos times
kubectl create namespace payments
kubectl create namespace analytics
kubectl create namespace fraud

# Criar Secret com credenciais (em namespace dedicado)
kubectl create namespace platform
kubectl create secret generic redis-credentials \\
  -n platform \\
  --from-literal=address="redis.default:6379"

# Criar ClusterTriggerAuthentication
kubectl apply -f - <<EOF
apiVersion: keda.sh/v1alpha1
kind: ClusterTriggerAuthentication
metadata:
  name: redis-cluster-auth
  # SEM namespace!
spec:
  secretTargetRef:
    - parameter: address
      name: redis-credentials
      namespace: platform
      key: address
EOF

# Verificar CTA criada
kubectl get clustertriggerauthentication
\`\`\``,
        verify: `\`\`\`bash
# Verificar namespaces
kubectl get namespaces | grep -E "payments|analytics|fraud|platform"
# Saída esperada: 4 namespaces criados

# Verificar Secret
kubectl get secret redis-credentials -n platform
# Saída esperada: redis-credentials   Opaque   1   Xs

# Verificar ClusterTriggerAuthentication
kubectl get clustertriggerauthentication redis-cluster-auth
# Saída esperada: redis-cluster-auth   Xs

# Descrever CTA
kubectl describe clustertriggerauthentication redis-cluster-auth
# Saída esperada: SecretTargetRef com address mapeado
\`\`\``
      },
      {
        title: 'Deploy de Workers por Time com ScaledObjects e Fallback',
        instruction: `Faça deploy de um worker por namespace (payments, analytics) e configure ScaledObjects usando a ClusterTriggerAuthentication criada.

Configure também fallback para manter réplicas mínimas se o Redis ficar indisponível.

- payments-worker: lista "payments-tasks", min=1, max=20, lagThreshold=3, fallback=2
- analytics-worker: lista "analytics-tasks", min=0, max=10, lagThreshold=5, fallback=1`,
        hints: [
          'Cada worker fica em seu próprio namespace',
          'authenticationRef precisa de kind: ClusterTriggerAuthentication',
          'O Redis está no namespace default — use redis.default:6379',
          'Para o fallback funcionar, simule a indisponibilidade depois'
        ],
        solution: `\`\`\`bash
# Deploy payments worker
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payments-worker
  namespace: payments
spec:
  replicas: 0
  selector:
    matchLabels:
      app: payments-worker
  template:
    metadata:
      labels:
        app: payments-worker
    spec:
      containers:
        - name: worker
          image: redis:7-alpine
          command: ["sh", "-c", "while true; do redis-cli -h redis.default RPOP payments-tasks; sleep 1; done"]
---
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: payments-scaler
  namespace: payments
spec:
  scaleTargetRef:
    name: payments-worker
  minReplicaCount: 1
  maxReplicaCount: 20
  cooldownPeriod: 60
  fallback:
    failureThreshold: 3
    replicas: 2
  triggers:
    - type: redis
      metadata:
        address: redis.default:6379
        listName: payments-tasks
        listLength: "3"
        activationListLength: "1"
      authenticationRef:
        name: redis-cluster-auth
        kind: ClusterTriggerAuthentication
EOF

# Deploy analytics worker
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: analytics-worker
  namespace: analytics
spec:
  replicas: 0
  selector:
    matchLabels:
      app: analytics-worker
  template:
    metadata:
      labels:
        app: analytics-worker
    spec:
      containers:
        - name: worker
          image: redis:7-alpine
          command: ["sh", "-c", "while true; do redis-cli -h redis.default RPOP analytics-tasks; sleep 2; done"]
---
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: analytics-scaler
  namespace: analytics
spec:
  scaleTargetRef:
    name: analytics-worker
  minReplicaCount: 0
  maxReplicaCount: 10
  cooldownPeriod: 30
  fallback:
    failureThreshold: 3
    replicas: 1
  triggers:
    - type: redis
      metadata:
        address: redis.default:6379
        listName: analytics-tasks
        listLength: "5"
        activationListLength: "2"
      authenticationRef:
        name: redis-cluster-auth
        kind: ClusterTriggerAuthentication
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verificar ScaledObjects em ambos namespaces
kubectl get scaledobject -n payments
kubectl get scaledobject -n analytics
# Saída esperada: READY = True para ambos

# Testar escalamento inserindo tasks
kubectl exec deployment/redis -- redis-cli LPUSH payments-tasks pay-{1..15}
kubectl exec deployment/redis -- redis-cli LPUSH analytics-tasks ana-{1..8}

sleep 15

kubectl get pods -n payments
# Saída esperada: payments-worker pods escalados (min 5)
kubectl get pods -n analytics
# Saída esperada: analytics-worker pods escalados

# Verificar que CTA é reutilizada
kubectl get scaledobject -n payments payments-scaler -o yaml | \\
  grep -A3 "authenticationRef"
# Saída esperada: kind: ClusterTriggerAuthentication
\`\`\``
      },
      {
        title: 'Configurar ServiceMonitor e Observabilidade do KEDA',
        instruction: `Configure o monitoramento do próprio KEDA via Prometheus, criando um ServiceMonitor para coletar métricas do keda-operator.

Depois verifique as métricas de escalamento e crie um alerta simples para erros do KEDA.`,
        hints: [
          'O KEDA expõe métricas na porta 8080 do metrics-apiserver',
          'ServiceMonitor precisa estar no namespace do kube-prometheus-stack para ser detectado',
          'Use keda_scaler_active para verificar se scalers estão ativos',
          'keda_scaler_errors_total indica problemas de conectividade com fontes'
        ],
        solution: `\`\`\`bash
# Verificar se Prometheus Operator está instalado
kubectl get crd servicemonitors.monitoring.coreos.com

# Criar ServiceMonitor para KEDA
kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: keda-operator-metrics
  namespace: monitoring
  labels:
    app: kube-prometheus-stack   # label para ser detectado
spec:
  selector:
    matchLabels:
      app: keda-operator
  namespaceSelector:
    matchNames:
      - keda
  endpoints:
    - port: metrics
      interval: 30s
      path: /metrics
      scheme: http
EOF

# Verificar métricas via port-forward
kubectl port-forward -n keda svc/keda-operator-metrics-apiserver 8080:8080 &

# Ver métricas do KEDA
curl -s http://localhost:8080/metrics | grep -E "keda_scaler_active|keda_scaler_errors"

# Criar alerta para erros do KEDA
kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: keda-alerts
  namespace: monitoring
  labels:
    app: kube-prometheus-stack
spec:
  groups:
    - name: keda
      rules:
        - alert: KEDAScalerError
          expr: increase(keda_scaler_errors_total[5m]) > 0
          for: 2m
          labels:
            severity: warning
          annotations:
            summary: "KEDA scaler error for {{ \$labels.scaledobject }}"
            description: "Scaler {{ \$labels.scaler_type }} failing for {{ \$labels.scaledobject }}"
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verificar ServiceMonitor criado
kubectl get servicemonitor -n monitoring keda-operator-metrics
# Saída esperada: keda-operator-metrics   Xm

# Verificar métricas disponíveis
curl -s http://localhost:8080/metrics | \\
  grep keda_scaler_active | head -5
# Saída esperada: keda_scaler_active{...} 0 ou 1

# Verificar PrometheusRule
kubectl get prometheusrule -n monitoring keda-alerts
# Saída esperada: keda-alerts   Xm

# Ver métricas por ScaledObject
curl -s http://localhost:8080/metrics | \\
  grep keda_scaler_metrics_value
# Saída esperada: valores numéricos por scaler

# Testar alerta verificando erros (deve ser 0 se tudo OK)
curl -s http://localhost:8080/metrics | \\
  grep keda_scaler_errors_total
# Saída esperada: keda_scaler_errors_total{...} 0
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'authenticationRef com ClusterTriggerAuthentication retorna "not found"',
      difficulty: 'easy',
      symptom: 'ScaledObject com ClusterTriggerAuthentication referenciada está com READY: False. Os logs do keda-operator mostram "TriggerAuthentication not found".',
      diagnosis: `\`\`\`bash
# Verificar se CTA existe
kubectl get clustertriggerauthentication

# Ver o authenticationRef do ScaledObject
kubectl get scaledobject my-scaler -o yaml | \\
  grep -A5 "authenticationRef"

# Checar logs do operator
kubectl logs -n keda -l app=keda-operator --tail=30 | \\
  grep -i "authentication\\|trigger auth"

# Verificar se o Secret referenciado na CTA existe
kubectl get secret -n platform my-credentials

# Checar se o namespace do Secret bate com o configurado na CTA
kubectl get clustertriggerauthentication my-cta -o yaml | \\
  grep -A5 "secretTargetRef"
\`\`\``,
      solution: `**Causa mais comum**: \`authenticationRef\` sem \`kind: ClusterTriggerAuthentication\`.

\`\`\`bash
# Verificar o ScaledObject atual
kubectl get scaledobject my-scaler -o yaml | grep -A5 authenticationRef

# Se kind está ausente, editar:
kubectl edit scaledobject my-scaler
# Corrigir para:
# authenticationRef:
#   name: my-cluster-auth
#   kind: ClusterTriggerAuthentication  ← ADICIONAR ISSO
\`\`\`

**Causa 2**: Secret referenciado não existe no namespace especificado.
\`\`\`bash
# Verificar Secret na CTA
kubectl get clustertriggerauthentication my-cta -o yaml

# Criar Secret no namespace correto (ex: platform)
kubectl create secret generic my-credentials \\
  -n platform \\
  --from-literal=username=user \\
  --from-literal=password=pass
\`\`\`

**Causa 3**: CTA existe mas no namespace errado.
\`\`\`bash
# CTA NÃO deve ter namespace
kubectl get clustertriggerauthentication -A
# Se aparecer num namespace específico, está como TriggerAuthentication (namespace-scoped)
# Recriar como ClusterTriggerAuthentication sem namespace
\`\`\``
    },
    {
      title: 'ScaledJob acumula centenas de Jobs completados no cluster',
      difficulty: 'medium',
      symptom: 'kubectl get jobs mostra centenas de Jobs com status Completed ou Failed. O namespace consome espaço excessivo no etcd e as queries de kubectl ficam lentas.',
      diagnosis: `\`\`\`bash
# Contar jobs acumulados
kubectl get jobs -n processing | wc -l

# Ver distribuição de status
kubectl get jobs -n processing -o json | \\
  jq '.items[] | .status.conditions[0].type' | sort | uniq -c

# Verificar configuração do ScaledJob
kubectl get scaledjob data-processor -n processing -o yaml | \\
  grep -E "historyLimit|successfulJobs|failedJobs"

# Ver uso de etcd (se tiver acesso)
kubectl get --raw /healthz/etcd

# Checar idade dos jobs mais antigos
kubectl get jobs -n processing --sort-by=.metadata.creationTimestamp | head -5
\`\`\``,
      solution: `**Solução imediata — Limpar jobs acumulados**:
\`\`\`bash
# Deletar jobs completados
kubectl delete jobs -n processing \\
  \$(kubectl get jobs -n processing \\
    -o go-template='{{range .items}}{{if .status.completionTime}}{{.metadata.name}} {{end}}{{end}}')

# Ou usando campo de status
kubectl get jobs -n processing -o json | \\
  jq -r '.items[] | select(.status.conditions[0].type=="Complete") | .metadata.name' | \\
  xargs kubectl delete job -n processing
\`\`\`

**Solução definitiva — Configurar limites no ScaledJob**:
\`\`\`bash
kubectl edit scaledjob data-processor -n processing
# Adicionar/corrigir:
# spec:
#   successfulJobsHistoryLimit: 5   # manter apenas últimos 5 bem-sucedidos
#   failedJobsHistoryLimit: 3       # manter apenas últimos 3 falhos
\`\`\`

**Prevenção — Template com TTL automático**:
\`\`\`yaml
spec:
  jobTargetRef:
    template:
      spec:
        # TTL automático para limpeza (K8s 1.21+)
        ttlSecondsAfterFinished: 3600  # 1 hora após completar
\`\`\``
    }
  ]
};
