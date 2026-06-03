window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['keda/keda-fundamentals'] = {
  theory: `# KEDA — Kubernetes Event-Driven Autoscaling

## Relevância no Exame
> KEDA é cobrado em exames de plataforma avançada e KubeAstronaut. Foco em ScaledObject, ScaledJob, triggers de escalamento e integração com o HPA nativo do Kubernetes.

## Conceitos Fundamentais

### O que é KEDA?
KEDA (Kubernetes Event-Driven Autoscaling) é um componente que permite escalar workloads Kubernetes baseado em **eventos externos** — não apenas CPU/memória como o HPA padrão.

Permite:
- Escalar de **0 para N** pods (scale-to-zero)
- Escalar baseado em filas, streams, métricas customizadas
- Suportar mais de 60 scalers built-in (Kafka, RabbitMQ, Redis, Azure, AWS, GCP...)

### Como o KEDA Funciona

\`\`\`
┌─────────────────────────────────────────────────────┐
│                  KEDA Architecture                   │
│                                                      │
│  External Source    KEDA Operator      K8s HPA       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │
│  │ Kafka Queue  │  │  ScaledObject│  │   HPA    │  │
│  │ RabbitMQ     │→ │  (CRD)       │→ │(managed  │  │
│  │ Redis        │  │  Metrics     │  │ by KEDA) │  │
│  │ Prometheus   │  │  Adapter     │  └────┬─────┘  │
│  └──────────────┘  └──────────────┘       │         │
│                                           ↓         │
│                                    ┌──────────────┐ │
│                                    │  Deployment  │ │
│                                    │  0..N pods   │ │
│                                    └──────────────┘ │
└─────────────────────────────────────────────────────┘
\`\`\`

**Componentes principais**:
- **keda-operator**: assiste ScaledObjects, gerencia ciclo de vida de HPA
- **keda-metrics-apiserver**: expõe métricas externas à API de métricas do K8s
- **ScaledObject**: CRD que define como e quando escalar um Deployment/StatefulSet
- **ScaledJob**: CRD para escalar Jobs (processamento batch)
- **TriggerAuthentication**: CRD para gerenciar credenciais de triggers de forma segura

### ScaledObject — O Core do KEDA

\`\`\`yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: my-scaler
  namespace: default
spec:
  scaleTargetRef:
    apiVersion: apps/v1     # opcional, default: apps/v1
    kind: Deployment        # Deployment, StatefulSet, etc.
    name: my-deployment

  # Limites de réplicas
  minReplicaCount: 0        # 0 = scale-to-zero habilitado!
  maxReplicaCount: 20

  # Cooldown (tempo antes de escalar para baixo)
  cooldownPeriod: 300       # segundos (default: 300)

  # Polling interval (frequência de checagem)
  pollingInterval: 30       # segundos (default: 30)

  # Configuração avançada do HPA
  advanced:
    horizontalPodAutoscalerConfig:
      behavior:
        scaleDown:
          stabilizationWindowSeconds: 300
          policies:
            - type: Percent
              value: 25
              periodSeconds: 60

  triggers:
    - type: kafka
      metadata:
        bootstrapServers: kafka:9092
        topic: orders
        consumerGroup: my-consumer-group
        lagThreshold: "10"   # escalar quando lag > 10 msgs/pod
\`\`\`

### Scale-to-Zero
O KEDA pode reduzir réplicas para 0 quando não há eventos, economizando recursos:
- Quando eventos chegam → KEDA escala de 0 para minReplicaCount (mínimo 1)
- Quando eventos param → após cooldownPeriod, reduz para 0
- **Importante**: quando em 0 réplicas, o HPA é removido e o KEDA gerencia diretamente

### Principais Scalers Built-in

| Scaler | Gatilho de Escala |
|--------|-------------------|
| Kafka | Consumer group lag |
| RabbitMQ | Mensagens na fila |
| Redis | Lista/Stream length |
| Prometheus | Qualquer métrica PromQL |
| CPU/Memory | Como HPA padrão |
| Cron | Horário (agendado) |
| AWS SQS | Mensagens na fila |
| Azure Service Bus | Mensagens na fila |
| GCP Pub/Sub | Mensagens não ack |
| PostgreSQL | Resultado de query SQL |
| MySQL | Resultado de query SQL |
| HTTP | Requests per second |
| GitHub Actions | Jobs aguardando runner |

### TriggerAuthentication — Gerenciando Credenciais
\`\`\`yaml
# Opção 1: Secret direto
apiVersion: keda.sh/v1alpha1
kind: TriggerAuthentication
metadata:
  name: kafka-auth
  namespace: default
spec:
  secretTargetRef:
    - parameter: username
      name: kafka-secret
      key: username
    - parameter: password
      name: kafka-secret
      key: password

---
# Opção 2: Pod Identity (recomendado para cloud)
apiVersion: keda.sh/v1alpha1
kind: TriggerAuthentication
metadata:
  name: aws-auth
spec:
  podIdentity:
    provider: aws-eks  # aws-eks, azure-workload, gcp-workload-identity
\`\`\`

### ScaledJob — Para Workloads Batch
\`\`\`yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledJob
metadata:
  name: image-processor
  namespace: default
spec:
  jobTargetRef:
    parallelism: 1
    completions: 1
    template:
      spec:
        containers:
          - name: processor
            image: my-image-processor:latest
        restartPolicy: Never

  # Quantas mensagens por Job
  maxReplicaCount: 50
  pollingInterval: 10

  # Scaling strategy
  scalingStrategy:
    strategy: accurate   # accurate | default | custom
    customScalingQueueLengthDeduction: 1
    customScalingRunningJobPercentage: "0.5"

  triggers:
    - type: rabbitmq
      metadata:
        host: amqp://rabbitmq:5672
        queueName: images-to-process
        mode: QueueLength
        value: "1"   # 1 Job por mensagem
\`\`\`

## Comandos Essenciais

### Instalação com Helm
\`\`\`bash
# Adicionar repositório KEDA
helm repo add kedacore https://kedacore.github.io/charts
helm repo update

# Instalar KEDA
helm install keda kedacore/keda \\
  --namespace keda \\
  --create-namespace \\
  --version 2.14.0

# Verificar instalação
kubectl get pods -n keda
# Saída esperada:
# keda-admission-webhooks-xxx  1/1  Running
# keda-operator-xxx            1/1  Running
# keda-operator-metrics-apiserver-xxx  1/1  Running

# Verificar CRDs instalados
kubectl get crd | grep keda
# scaledjobs.keda.sh
# scaledobjects.keda.sh
# triggerauthentications.keda.sh
# clustertriggerauthentications.keda.sh
\`\`\`

### Gerenciamento de ScaledObjects
\`\`\`bash
# Listar ScaledObjects
kubectl get scaledobjects -n default
kubectl get so -n default  # abreviação

# Descrever ScaledObject (ver status, triggers, condições)
kubectl describe scaledobject my-scaler -n default

# Ver status detalhado
kubectl get scaledobject my-scaler -n default -o yaml | \\
  grep -A20 "status:"

# Ver HPA gerenciado pelo KEDA
kubectl get hpa -n default
# Nome: keda-hpa-<scaled-object-name>

# Pausar escalamento (útil para manutenção)
kubectl annotate scaledobject my-scaler \\
  autoscaling.keda.sh/paused-replicas="3" -n default

# Remover pausa
kubectl annotate scaledobject my-scaler \\
  autoscaling.keda.sh/paused-replicas- -n default

# Listar ScaledJobs
kubectl get scaledjobs -n default
kubectl get sj -n default
\`\`\`

### Debug e Troubleshooting
\`\`\`bash
# Ver logs do KEDA operator
kubectl logs -n keda -l app=keda-operator -f

# Ver logs do metrics server
kubectl logs -n keda -l app=keda-operator-metrics-apiserver -f

# Verificar métricas externas disponíveis
kubectl get --raw "/apis/external.metrics.k8s.io/v1beta1" | jq .

# Ver valor atual de uma métrica
kubectl get --raw \\
  "/apis/external.metrics.k8s.io/v1beta1/namespaces/default/s0-kafka-orders" | jq .

# Verificar eventos relacionados ao ScaledObject
kubectl get events -n default --field-selector reason=KEDAScalerFailed
kubectl get events -n default | grep -i keda
\`\`\`

## Exemplos YAML

### Scaler de Kafka com Autenticação
\`\`\`yaml
apiVersion: v1
kind: Secret
metadata:
  name: kafka-credentials
  namespace: default
stringData:
  sasl-username: "my-user"
  sasl-password: "my-password"
  tls-ca: |
    -----BEGIN CERTIFICATE-----
    ...
    -----END CERTIFICATE-----

---
apiVersion: keda.sh/v1alpha1
kind: TriggerAuthentication
metadata:
  name: kafka-trigger-auth
  namespace: default
spec:
  secretTargetRef:
    - parameter: sasl.user
      name: kafka-credentials
      key: sasl-username
    - parameter: sasl.password
      name: kafka-credentials
      key: sasl-password
    - parameter: ca
      name: kafka-credentials
      key: tls-ca

---
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: kafka-consumer-scaler
  namespace: default
spec:
  scaleTargetRef:
    name: order-consumer
  minReplicaCount: 1
  maxReplicaCount: 30
  pollingInterval: 15
  cooldownPeriod: 60
  triggers:
    - type: kafka
      metadata:
        bootstrapServers: "kafka-0.kafka-headless:9093"
        consumerGroup: order-processors
        topic: orders
        lagThreshold: "20"
        activationLagThreshold: "5"  # lag mínimo para sair do 0
        offsetResetPolicy: latest
        allowIdleConsumers: "false"
        scaleToZeroOnInvalidOffset: "false"
        excludePersistentLag: "false"
        sasl: scram_sha256
        tls: enable
      authenticationRef:
        name: kafka-trigger-auth
\`\`\`

### Scaler de Prometheus
\`\`\`yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: prometheus-scaler
  namespace: default
spec:
  scaleTargetRef:
    name: api-deployment
  minReplicaCount: 2
  maxReplicaCount: 50
  cooldownPeriod: 120
  triggers:
    - type: prometheus
      metadata:
        serverAddress: http://prometheus-operated.monitoring:9090
        metricName: http_requests_per_second
        threshold: "100"           # escalar quando > 100 req/s por pod
        activationThreshold: "10"  # ativar saída do zero com > 10 req/s
        query: |
          sum(rate(http_requests_total{job="api-deployment"}[2m]))
        namespace: default
        ignoreNullValues: "false"
\`\`\`

### Scaler Cron (Escalamento Agendado)
\`\`\`yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: business-hours-scaler
  namespace: default
spec:
  scaleTargetRef:
    name: web-frontend
  minReplicaCount: 1
  maxReplicaCount: 20
  triggers:
    # Horário comercial: 3 réplicas mínimas
    - type: cron
      metadata:
        timezone: "America/Sao_Paulo"
        start: "0 8 * * 1-5"    # segunda a sexta, 8h
        end: "0 18 * * 1-5"     # segunda a sexta, 18h
        desiredReplicas: "5"
    # Fora do horário: 1 réplica
    # (controlado pelo minReplicaCount: 1)
\`\`\`

### ScaledObject com Múltiplos Triggers
\`\`\`yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: multi-trigger-scaler
  namespace: default
spec:
  scaleTargetRef:
    name: worker
  minReplicaCount: 0
  maxReplicaCount: 100
  triggers:
    # Trigger 1: fila RabbitMQ
    - type: rabbitmq
      metadata:
        protocol: amqp
        queueName: tasks
        mode: QueueLength
        value: "5"
      authenticationRef:
        name: rabbitmq-auth

    # Trigger 2: CPU (fallback)
    - type: cpu
      metricType: Utilization
      metadata:
        value: "70"

    # Trigger 3: Custom metric via Prometheus
    - type: prometheus
      metadata:
        serverAddress: http://prometheus:9090
        query: avg(pending_tasks_gauge)
        threshold: "50"
        metricName: pending_tasks
\`\`\`

## Erros Comuns

### 1. ScaledObject não escala para 0
**Causa**: \`minReplicaCount\` não está definido como 0, ou o Deployment tem \`HPA\` manual conflitando.
**Solução**: Confirmar \`minReplicaCount: 0\` e remover HPAs manuais para o mesmo Deployment.

### 2. KEDA não consegue ler métricas externas
**Causa**: Problemas de conectividade com a fonte externa (Kafka, RabbitMQ, etc.) ou credenciais inválidas.
**Solução**: Verificar TriggerAuthentication e testar conectividade do namespace keda.

### 3. HPA e KEDA conflitando
**Causa**: Existe um HPA manual gerenciando o mesmo Deployment que o ScaledObject.
**Solução**: O KEDA gerencia seu próprio HPA — remover qualquer HPA pré-existente antes de criar o ScaledObject.

### 4. cooldownPeriod muito alto em workloads batch
**Causa**: Pods permanecem ativos por muito tempo após fila esvaziar.
**Solução**: Reduzir \`cooldownPeriod\` (ex: 30-60s) para workloads de processamento rápido.

### 5. activationThreshold ausente com scale-to-zero
**Causa**: Com \`minReplicaCount: 0\`, sem \`activationThreshold\`, qualquer métrica > 0 ativa o scaler.
**Solução**: Definir \`activationThreshold\` para evitar cold starts desnecessários.

## Killer.sh Style Challenge

**Contexto**: Uma API de pedidos tem picos de tráfego imprevisíveis. Durante horário comercial recebe ~1000 req/s; à noite cai para ~10 req/s. O time quer:
- Escalar automaticamente baseado em métricas do Prometheus
- Mínimo de 2 pods durante horário comercial (8h-18h, seg-sex)
- Scale-to-zero permitido fora do horário comercial
- Máximo de 50 pods

Crie a configuração KEDA completa para este cenário usando múltiplos triggers.`,

  quiz: [
    {
      question: 'Qual é a principal vantagem do KEDA em relação ao HPA nativo do Kubernetes?',
      options: [
        'KEDA suporta scale-to-zero e escalamento baseado em eventos externos (Kafka, filas, etc.)',
        'KEDA é mais rápido que o HPA para escalar baseado em CPU',
        'KEDA substitui completamente o HPA e o Metrics Server',
        'KEDA permite definir réplicas fixas por horário do dia'
      ],
      correct: 0,
      explanation: 'O HPA nativo só escala baseado em CPU, memória e métricas customizadas via Metrics API. O KEDA expande isso para 60+ fontes externas (Kafka, RabbitMQ, Redis, Prometheus, SQS, etc.) e adiciona scale-to-zero — reduzir para 0 réplicas quando não há carga.',
      reference: 'Conceito: KEDA vs HPA — seção "O que é KEDA?" na teoria.'
    },
    {
      question: 'Qual CRD do KEDA deve ser usado para escalar workloads de processamento batch (Jobs)?',
      options: [
        'ScaledObject',
        'ScaledJob',
        'TriggerAuthentication',
        'BatchScaler'
      ],
      correct: 1,
      explanation: 'ScaledJob é o CRD específico para workloads batch — cria novos Jobs Kubernetes em resposta a eventos. ScaledObject é para workloads contínuos (Deployment, StatefulSet). A diferença é fundamental: ScaledJob cria novos Jobs enquanto ScaledObject ajusta réplicas de pods existentes.',
      reference: 'CRD: ScaledJob — seção "ScaledJob — Para Workloads Batch" na teoria.'
    },
    {
      question: 'O que acontece com o HPA quando um ScaledObject é configurado para minReplicaCount: 0?',
      options: [
        'O HPA é mantido mas configurado para 0 réplicas mínimas',
        'O HPA é removido quando réplicas chegam a 0; KEDA gerencia diretamente',
        'O HPA falha com erro quando tenta escalar para 0',
        'Nada muda — o HPA e o KEDA operam independentemente'
      ],
      correct: 1,
      explanation: 'Quando o ScaledObject tem minReplicaCount: 0 e as réplicas chegam a zero, o KEDA remove o HPA (pois HPA não suporta 0 réplicas mínimas) e gerencia o Deployment diretamente. Quando novos eventos chegam, o KEDA escala de 0 para 1+ e recria o HPA.',
      reference: 'Conceito: scale-to-zero — seção "Scale-to-Zero" na teoria.'
    },
    {
      question: 'Qual é o propósito do campo "activationThreshold" em um trigger do KEDA?',
      options: [
        'Define o número máximo de réplicas ao ativar o scaler',
        'Define o valor mínimo da métrica para sair do estado de 0 réplicas',
        'Define o tempo de espera antes de começar a escalar',
        'Define a frequência de polling da métrica externa'
      ],
      correct: 1,
      explanation: 'activationThreshold define o valor mínimo da métrica necessário para "acordar" o deployment de 0 réplicas. Sem isso, qualquer valor > 0 acionaria o scale-up. Com activationThreshold, evita cold starts desnecessários — por exemplo, só acordar quando o lag de Kafka ultrapassar 5 mensagens.',
      reference: 'Config: activationThreshold — exemplos de ScaledObject na teoria.'
    },
    {
      question: 'Como pausar temporariamente o escalamento automático de um ScaledObject sem deletá-lo?',
      options: [
        'kubectl delete scaledobject my-scaler --keep-hpa',
        'kubectl annotate scaledobject my-scaler autoscaling.keda.sh/paused-replicas="N"',
        'kubectl patch scaledobject my-scaler --patch "spec.paused: true"',
        'kubectl scale scaledobject my-scaler --replicas=0'
      ],
      correct: 1,
      explanation: 'A annotation autoscaling.keda.sh/paused-replicas="N" pausa o KEDA e mantém o Deployment com N réplicas fixas. Isso é útil para manutenção, deploy de emergência ou testes. Para retomar, remove-se a annotation.',
      reference: 'Comandos: pausar ScaledObject — seção "Gerenciamento de ScaledObjects" na teoria.'
    },
    {
      question: 'Qual scaler do KEDA permite escalar baseado em qualquer query PromQL?',
      options: [
        'metrics',
        'custom',
        'prometheus',
        'grafana'
      ],
      correct: 2,
      explanation: 'O scaler "prometheus" conecta diretamente ao Prometheus e executa qualquer query PromQL como gatilho de escalamento. Isso permite escalar baseado em latência, taxa de erros, filas customizadas — qualquer métrica já coletada pelo Prometheus.',
      reference: 'Scalers: prometheus — seção "Principais Scalers Built-in" e exemplos YAML na teoria.'
    },
    {
      question: 'Qual é a diferença entre "pollingInterval" e "cooldownPeriod" no ScaledObject?',
      options: [
        'pollingInterval é para CPU; cooldownPeriod é para métricas customizadas',
        'pollingInterval define a frequência de checagem da métrica; cooldownPeriod é o tempo de espera antes de escalar para baixo',
        'Ambos controlam o mesmo comportamento — são sinônimos',
        'pollingInterval define o scale-up; cooldownPeriod define o scale-down'
      ],
      correct: 1,
      explanation: 'pollingInterval (padrão: 30s) define com que frequência o KEDA consulta a fonte externa para verificar o valor da métrica. cooldownPeriod (padrão: 300s) define quanto tempo o KEDA espera após a métrica cair antes de reduzir as réplicas — evita flapping (oscilação rápida de escala).',
      reference: 'Config: pollingInterval e cooldownPeriod — seção "ScaledObject — O Core do KEDA" na teoria.'
    },
    {
      question: 'Qual CRD do KEDA gerencia credenciais de acesso às fontes externas de forma segura?',
      options: [
        'SecretProvider',
        'TriggerAuthentication',
        'ExternalSecret',
        'CredentialBinding'
      ],
      correct: 1,
      explanation: 'TriggerAuthentication é o CRD que separa as credenciais da definição do trigger. Suporta referências a Secrets Kubernetes, HashiCorp Vault, Pod Identity (AWS IRSA, Azure Workload Identity, GCP Workload Identity) — seguindo o princípio de least privilege.',
      reference: 'CRD: TriggerAuthentication — seção dedicada na teoria.'
    }
  ],

  flashcards: [
    {
      front: 'O que é KEDA e qual problema resolve?',
      back: 'KEDA (Kubernetes Event-Driven Autoscaling) resolve o limite do HPA nativo:\n\nHPA nativo: apenas CPU/memória\nKEDA: 60+ fontes externas\n\nPrincipais capacidades:\n- Scale-to-zero (0 réplicas sem carga)\n- Escalar por eventos: Kafka lag, fila RabbitMQ, Redis length, SQS\n- Qualquer métrica Prometheus\n- Agendamento por cron\n- Processamento batch com ScaledJob'
    },
    {
      front: 'Qual a diferença entre ScaledObject e ScaledJob?',
      back: 'ScaledObject:\n- Para workloads contínuos (Deployment, StatefulSet)\n- Ajusta número de réplicas de pods existentes\n- Os pods ficam rodando esperando trabalho\n- Ex: consumer de Kafka sempre ativo\n\nScaledJob:\n- Para workloads batch/one-shot\n- Cria novos Jobs para cada "unidade de trabalho"\n- Job roda, completa, e é removido\n- Ex: processar cada imagem em um Job separado'
    },
    {
      front: 'O que acontece com scale-to-zero no KEDA?',
      back: 'Com minReplicaCount: 0:\n\n1. Sem eventos → KEDA reduz para 0 réplicas após cooldownPeriod\n2. Com 0 réplicas → HPA é removido (HPA não suporta 0)\n3. KEDA gerencia o Deployment diretamente\n4. Novos eventos chegam → KEDA escala de 0 para 1 rapidamente\n5. HPA é recriado para continuar escalando\n\nDesvantagem: cold start (latência para acordar)'
    },
    {
      front: 'O que faz o TriggerAuthentication no KEDA?',
      back: 'Separa credenciais do ScaledObject:\n\nSecretTargetRef:\n- Mapeia campos de um K8s Secret para parâmetros do trigger\n- Ex: username, password, ca-cert\n\nPodIdentity:\n- AWS EKS IRSA, Azure Workload Identity, GCP Workload Identity\n- Sem secrets — usa IAM roles do pod\n\nNamespaced vs Cluster:\n- TriggerAuthentication: um namespace\n- ClusterTriggerAuthentication: todo o cluster'
    },
    {
      front: 'Como pausar um ScaledObject sem deletá-lo?',
      back: '# Pausar com N réplicas fixas\nkubectl annotate scaledobject my-scaler \\\n  autoscaling.keda.sh/paused-replicas="3"\n\n# O KEDA para de escalar\n# Deployment fica com 3 réplicas estáticas\n\n# Retomar escalamento automático\nkubectl annotate scaledobject my-scaler \\\n  autoscaling.keda.sh/paused-replicas-\n\nÚtil para:\n- Manutenção planejada\n- Emergências (evitar scale-down durante incidente)\n- Testes de carga controlados'
    },
    {
      front: 'Quais são os principais scalers do KEDA e seus gatilhos?',
      back: 'kafka → consumer group lag\nrabbitmq → mensagens na fila\nredis → list/stream length\nprometheus → qualquer PromQL\ncpu → uso de CPU (como HPA)\nmemory → uso de memória\ncron → horário agendado\naws-sqs-queue → mensagens SQS\nazure-servicebus → mensagens Service Bus\ngcp-pubsub → mensagens Pub/Sub\npostgresql → resultado de query SQL\nhttp → requests por segundo\ngithub-runner → jobs aguardando runner'
    },
    {
      front: 'O que são pollingInterval e cooldownPeriod?',
      back: 'pollingInterval (default: 30s):\n- Com que frequência o KEDA consulta a fonte\n- KEDA verifica o valor da métrica a cada N segundos\n- Menor = mais responsivo, mais carga na fonte\n\ncooldownPeriod (default: 300s):\n- Tempo de espera APÓS a métrica cair antes de reduzir réplicas\n- Evita flapping (oscilação rápida)\n- Para scale-to-zero: tempo para reduzir para 0\n- Para workloads batch: use valores menores (30-60s)'
    },
    {
      front: 'Como verificar o status de um ScaledObject e seu HPA?',
      back: '# Ver ScaledObject\nkubectl get so -n default\nkubectl describe so my-scaler -n default\n\n# Ver HPA gerenciado pelo KEDA\nkubectl get hpa -n default\n# Nome: keda-hpa-<scaled-object-name>\n\n# Ver valor atual da métrica\nkubectl get --raw \\\n  "/apis/external.metrics.k8s.io/v1beta1/namespaces/default/s0-kafka-orders"\n\n# Ver logs do operator\nkubectl logs -n keda -l app=keda-operator -f'
    }
  ],

  lab: {
    scenario: 'Configure o KEDA para escalar automaticamente um consumidor de fila baseado em mensagens pendentes. Use o Redis como fonte de eventos (lista) e observe o comportamento de scale-up e scale-down, incluindo scale-to-zero.',
    objective: 'Instalar KEDA, configurar um ScaledObject com Redis scaler, observar escalamento automático e testar scale-to-zero.',
    duration: '30-40 minutos',
    steps: [
      {
        title: 'Instalar KEDA e Redis no Cluster',
        instruction: `Instale o KEDA via Helm no namespace \`keda\` e faça deploy de um Redis simples para usar como fonte de eventos.

Verifique que todos os componentes do KEDA estão Running antes de prosseguir.`,
        hints: [
          'Use o repositório kedacore/keda do Helm',
          'Para Redis, pode usar a imagem redis:7-alpine com um Deployment simples',
          'Verifique os 3 componentes: keda-operator, keda-operator-metrics-apiserver e keda-admission-webhooks'
        ],
        solution: `\`\`\`bash
# Instalar KEDA
helm repo add kedacore https://kedacore.github.io/charts
helm repo update

helm install keda kedacore/keda \\
  --namespace keda \\
  --create-namespace

# Aguardar KEDA ficar pronto
kubectl wait --for=condition=ready pod \\
  -l app=keda-operator -n keda --timeout=120s

# Deploy Redis
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
        - name: redis
          image: redis:7-alpine
          ports:
            - containerPort: 6379
---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: default
spec:
  selector:
    app: redis
  ports:
    - port: 6379
      targetPort: 6379
EOF

kubectl wait --for=condition=ready pod -l app=redis --timeout=60s
\`\`\``,
        verify: `\`\`\`bash
# Verificar KEDA pods
kubectl get pods -n keda
# Saída esperada (todos Running):
# keda-admission-webhooks-xxx   1/1   Running
# keda-operator-xxx             1/1   Running
# keda-operator-metrics-apiserver-xxx  1/1  Running

# Verificar CRDs instalados
kubectl get crd | grep keda.sh
# Saída esperada:
# clustertriggerauthentications.keda.sh
# scaledjobs.keda.sh
# scaledobjects.keda.sh
# triggerauthentications.keda.sh

# Verificar Redis
kubectl get pods -l app=redis
# Saída esperada: redis-xxx   1/1   Running

# Testar conectividade Redis
kubectl exec -it deployment/redis -- redis-cli PING
# Saída esperada: PONG
\`\`\``
      },
      {
        title: 'Deploy do Worker e Configurar ScaledObject',
        instruction: `Faça deploy de um Deployment "worker" simples que simula processar itens de uma lista Redis.

Depois crie um ScaledObject que escale o worker baseado no tamanho da lista Redis \`tasks\`, com:
- minReplicaCount: 0 (scale-to-zero)
- maxReplicaCount: 10
- threshold: 2 (2 tasks por pod)
- cooldownPeriod: 30 (para o lab ser mais rápido)`,
        hints: [
          'O worker pode usar busybox que fica em loop consumindo items com RPOP',
          'O scaler Redis usa listName e listLength como parâmetros principais',
          'Para scale-to-zero funcionar, o worker não pode ter réplicas fixas no Deployment'
        ],
        solution: `\`\`\`bash
# Deploy do worker
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis-worker
  namespace: default
spec:
  replicas: 0  # KEDA vai controlar
  selector:
    matchLabels:
      app: redis-worker
  template:
    metadata:
      labels:
        app: redis-worker
    spec:
      containers:
        - name: worker
          image: redis:7-alpine
          command:
            - sh
            - -c
            - |
              while true; do
                item=\$(redis-cli -h redis RPOP tasks)
                if [ "\$item" != "" ] && [ "\$item" != "nil" ]; then
                  echo "Processing: \$item"
                  sleep 2
                else
                  echo "Queue empty, waiting..."
                  sleep 1
                fi
              done
EOF

# Criar ScaledObject
kubectl apply -f - <<EOF
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: redis-worker-scaler
  namespace: default
spec:
  scaleTargetRef:
    name: redis-worker
  minReplicaCount: 0
  maxReplicaCount: 10
  cooldownPeriod: 30
  pollingInterval: 5
  triggers:
    - type: redis
      metadata:
        address: redis.default:6379
        listName: tasks
        listLength: "2"
        activationListLength: "1"
EOF

# Verificar ScaledObject criado
kubectl get scaledobject redis-worker-scaler
\`\`\``,
        verify: `\`\`\`bash
# Verificar ScaledObject está ativo
kubectl get scaledobject redis-worker-scaler -n default
# Saída esperada:
# NAME                   SCALETARGETKIND   SCALETARGETNAME  MIN  MAX  ...  ACTIVE  READY
# redis-worker-scaler    apps/Deployment   redis-worker     0    10   ...  False   True

# Verificar que worker tem 0 réplicas (sem carga)
kubectl get deployment redis-worker
# Saída esperada: redis-worker   0/0   0   0

# Verificar HPA gerenciado pelo KEDA (pode não existir com 0 réplicas)
kubectl get hpa -n default
# Nota: com 0 réplicas, o HPA pode não aparecer (é comportamento esperado)

# Verificar eventos do ScaledObject
kubectl describe scaledobject redis-worker-scaler | grep -A10 "Events:"
\`\`\``
      },
      {
        title: 'Testar Scale-Up, Scale-Down e Scale-to-Zero',
        instruction: `Insira tasks na lista Redis e observe o KEDA escalando o worker automaticamente.

1. Adicione 20 tasks → deve escalar para ~10 pods (limitado pelo max)
2. Aguarde os tasks serem processados → deve descer gradualmente
3. Após a fila esvaziar + cooldown → deve retornar a 0 réplicas

Observe o comportamento em tempo real com \`watch\`.`,
        hints: [
          'Use redis-cli LPUSH para inserir tasks na lista',
          'Use watch kubectl get pods para acompanhar o escalamento',
          'O cooldownPeriod de 30s foi configurado para o lab ser mais rápido',
          'O KEDA verifica a cada 5s (pollingInterval) o tamanho da lista'
        ],
        solution: `\`\`\`bash
# Terminal 1: acompanhar pods em tempo real
watch kubectl get pods -l app=redis-worker

# Terminal 2: inserir tasks e monitorar fila

# Inserir 20 tasks na fila
kubectl exec deployment/redis -- \\
  redis-cli LPUSH tasks task-{1..20}

# Verificar tamanho da fila
kubectl exec deployment/redis -- redis-cli LLEN tasks
# Saída esperada: 20

# Aguardar KEDA escalar (pode demorar até pollingInterval = 5s)
kubectl get scaledobject redis-worker-scaler -w

# Ver réplicas do worker
kubectl get deployment redis-worker -w

# Ver HPA gerenciado pelo KEDA
kubectl get hpa keda-hpa-redis-worker-scaler -w

# Após fila esvaziar, aguardar cooldown (30s configurado)
# Worker deve retornar a 0 réplicas

# Verificar via Redis
kubectl exec deployment/redis -- redis-cli LLEN tasks
# Saída esperada: 0 (após processamento)

# Testar nova adição após scale-to-zero
sleep 40  # aguardar cooldown
kubectl exec deployment/redis -- redis-cli LPUSH tasks new-task-1
# Observe o scale-up de 0 para 1 pod
\`\`\``,
        verify: `\`\`\`bash
# Verificar que escala com carga
kubectl exec deployment/redis -- redis-cli LPUSH tasks verify-{1..10}
sleep 10
kubectl get deployment redis-worker
# Saída esperada: redis-worker   X/X  X  X  (X > 0)

# Verificar métrica externa via API
kubectl get --raw \\
  "/apis/external.metrics.k8s.io/v1beta1/namespaces/default/s0-redis-tasks" \\
  2>/dev/null | jq '.items[0].value' || echo "Metric not available (0 replicas state)"

# Após tasks serem processadas, verificar scale-to-zero
kubectl exec deployment/redis -- redis-cli DEL tasks
sleep 45  # cooldown 30s + margem
kubectl get deployment redis-worker
# Saída esperada: redis-worker   0/0   0   0

# Verificar histórico de eventos
kubectl get events -n default | grep -i "scaled\\|KEDA\\|replica" | tail -10
# Saída esperada: eventos de scale-up e scale-down registrados
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'ScaledObject não escala — READY: False',
      difficulty: 'easy',
      symptom: 'O ScaledObject está criado mas a coluna READY mostra False e o Deployment não escala, mesmo com eventos/mensagens na fonte.',
      diagnosis: `\`\`\`bash
# Verificar status do ScaledObject
kubectl describe scaledobject my-scaler -n default

# Verificar condições específicas
kubectl get scaledobject my-scaler -n default -o json | \\
  jq '.status.conditions'

# Ver erros nos logs do operator
kubectl logs -n keda -l app=keda-operator --tail=50 | \\
  grep -i "error\\|failed\\|scaler"

# Verificar conectividade com fonte externa
kubectl exec -n keda deployment/keda-operator -- \\
  nc -zv kafka.default 9092 2>&1

# Verificar TriggerAuthentication (se usado)
kubectl get triggerauthentication -n default -o yaml

# Testar credenciais manualmente
kubectl exec -n default -it debug-pod -- \\
  redis-cli -h redis -a \$PASSWORD PING
\`\`\``,
      solution: `**Causa 1**: Fonte externa inacessível (rede, DNS, firewall).
\`\`\`bash
# Testar do namespace onde o ScaledObject está
kubectl run debug --image=redis:7-alpine --rm -it -- \\
  redis-cli -h redis.default PING
# Se falhar, problema de rede/DNS
\`\`\`

**Causa 2**: TriggerAuthentication com credenciais inválidas.
\`\`\`bash
# Verificar Secret referenciado
kubectl get secret kafka-credentials -n default -o yaml

# Verificar mapeamento no TriggerAuthentication
kubectl describe triggerauthentication kafka-auth -n default

# Rotacionar credenciais se necessário
kubectl create secret generic kafka-credentials \\
  --from-literal=username=correct-user \\
  --from-literal=password=correct-pass \\
  --dry-run=client -o yaml | kubectl apply -f -
\`\`\`

**Causa 3**: Parâmetros do trigger incorretos.
\`\`\`bash
# Ver quais parâmetros cada scaler aceita
# Documentação: https://keda.sh/docs/scalers/

# Verificar logs de parsing
kubectl logs -n keda -l app=keda-operator | \\
  grep -i "invalid\\|unknown parameter"
\`\`\``
    },
    {
      title: 'KEDA causa flapping — pods oscilando constantemente',
      difficulty: 'medium',
      symptom: 'Os pods ficam escalando para cima e para baixo rapidamente (flapping). Em 5 minutos, houve 20+ eventos de scale-up e scale-down. O serviço fica instável.',
      diagnosis: `\`\`\`bash
# Ver histórico de eventos de scaling
kubectl get events -n default --sort-by=.lastTimestamp | \\
  grep -i "scaled\\|replica" | tail -20

# Ver número de réplicas ao longo do tempo
kubectl describe hpa keda-hpa-my-scaler | grep -A10 "Events:"

# Verificar cooldownPeriod configurado
kubectl get scaledobject my-scaler -o yaml | \\
  grep -i "cooldown\\|polling"

# Verificar lagThreshold e valor atual da métrica
kubectl get --raw \\
  "/apis/external.metrics.k8s.io/v1beta1/namespaces/default/s0-kafka-orders" | \\
  jq '.items[0].value'

# Ver comportamento do HPA
kubectl describe hpa keda-hpa-my-scaler | grep -A20 "Behavior:"
\`\`\``,
      solution: `**Causa 1**: cooldownPeriod muito baixo — pods sobem e descem rápido demais.
\`\`\`bash
kubectl patch scaledobject my-scaler --type merge -p '{
  "spec": {
    "cooldownPeriod": 300
  }
}'
# 300s = 5 minutos de espera antes de scale-down
\`\`\`

**Causa 2**: threshold muito próximo ao valor médio da métrica.
\`\`\`bash
# Se a métrica oscila entre 8 e 12 e o threshold é 10, haverá flapping
# Aumentar o threshold para criar margem:
kubectl patch scaledobject my-scaler --type merge -p '{
  "spec": {
    "triggers": [{
      "type": "kafka",
      "metadata": {
        "lagThreshold": "20"
      }
    }]
  }
}'
\`\`\`

**Causa 3**: Falta de stabilization window no HPA behavior.
\`\`\`bash
kubectl patch scaledobject my-scaler --type merge -p '{
  "spec": {
    "advanced": {
      "horizontalPodAutoscalerConfig": {
        "behavior": {
          "scaleDown": {
            "stabilizationWindowSeconds": 300,
            "policies": [
              {"type": "Percent", "value": 25, "periodSeconds": 60}
            ]
          },
          "scaleUp": {
            "stabilizationWindowSeconds": 30
          }
        }
      }
    }
  }
}'
\`\`\``
    }
  ]
};
