window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['az305-application/microservices-design'] = {
  theory: `# Design de Microserviços no Azure (AZ-305)

## Relevância no Exame
> Peso estimado **10-15%** no AZ-305. Questões sobre escolha de plataforma de containers (AKS, Container Apps, ACI), service discovery e comunicação entre microserviços.

## Plataformas para Microserviços no Azure

\`\`\`
Controle         AKS             Container Apps       ACI
    ↑          Kubernetes          Serverless K8s       Simples
    |          gerenciado         (built on K8s)        sem orq.
    |          Full control        KEDA autoscale        burst
    ↓          Complex ops         Simple ops            jobs
Simplicidade
\`\`\`

### Quando usar cada plataforma

| Cenário | Plataforma |
|---------|-----------|
| Múltiplos times, workloads heterogêneos, controle total | AKS |
| Microserviços serverless, KEDA, sem gerenciar K8s | Azure Container Apps |
| Containers de curta duração, CI/CD runners, batch | ACI |
| Long-running stateful apps, máximo controle | AKS com StatefulSets |

## Azure Container Apps — Design

\`\`\`yaml
# Container App com autoscaling via HTTP
apiVersion: 2023-05-01
kind: ContainerApp
properties:
  configuration:
    ingress:
      external: true
      targetPort: 8080
      traffic:
        - latestRevision: true
          weight: 90
        - revisionName: myapp--v2
          weight: 10      # canary 10%
  scale:
    minReplicas: 0        # scale to zero
    maxReplicas: 20
    rules:
      - name: http-rule
        http:
          metadata:
            concurrentRequests: 100
  template:
    containers:
      - name: myapp
        image: myacr.azurecr.io/myapp:v3
        resources:
          cpu: 0.5
          memory: 1Gi
        env:
          - name: DB_CONNECTION
            secretRef: db-connection
\`\`\`

### Dapr Integration em Container Apps

\`\`\`bash
# Habilitar Dapr no Container App
az containerapp update \
  --name myapp \
  --resource-group myRG \
  --enable-dapr true \
  --dapr-app-id myapp \
  --dapr-app-port 8080 \
  --dapr-app-protocol http

# Com Dapr, serviços se comunicam por nome lógico:
# POST http://localhost:3500/v1.0/invoke/payment-service/method/pay
# (Dapr resolve o endereço real automaticamente)
\`\`\`

## Padrão: Service Discovery

### AKS — DNS nativo do Kubernetes

\`\`\`
Service A → http://payment-service.payments.svc.cluster.local:8080
            ↑ nome do service ↑ namespace ↑ domínio k8s
\`\`\`

### Container Apps — Service Discovery via Container Apps Environment

\`\`\`bash
# Containers no mesmo Environment se comunicam por nome do app
# POST http://payment-service/pay
# (sem porta, sem namespace)
\`\`\`

## Padrão: Circuit Breaker

\`\`\`python
# Circuit Breaker com Resilience4j (Python: tenacity + custom)
from circuitbreaker import circuit

@circuit(failure_threshold=5, recovery_timeout=30)
def call_payment_service(order_id):
    response = requests.post(
        "http://payment-service/pay",
        json={"orderId": order_id},
        timeout=5
    )
    response.raise_for_status()
    return response.json()

# Se 5 falhas em 30s → circuit OPEN → retorna erro rápido
# Após 30s → circuit HALF-OPEN → tenta novamente
\`\`\`

## Padrão: Health Checks & Readiness

\`\`\`yaml
# Kubernetes health probes
livenessProbe:
  httpGet:
    path: /health/live
    port: 8080
  initialDelaySeconds: 30
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /health/ready
    port: 8080
  initialDelaySeconds: 5
  failureThreshold: 3
  # Endpoint retorna 200 apenas quando:
  # - DB connection ok
  # - External dependencies ok
  # - Cache warm (se necessário)
\`\`\`

## Erros Comuns de Design

1. **Microserviços muito granulares**: um microserviço por tabela é um anti-pattern. Defina por bounded context (domínio).
2. **Comunicação síncrona excessiva**: chains de chamadas HTTP síncronas aumentam latência e acoplamento. Usar async onde possível.
3. **Sem health checks**: sem liveness/readiness, Kubernetes não sabe quando reiniciar ou remover um pod do pool.
4. **Container Apps para workloads stateful**: Container Apps não têm suporte nativo a volumes persistentes complexos — usar AKS com PVs.
5. **Ignorar circuit breaker**: dependências externas que falham causam falha em cascata sem circuit breaker.

## Killer.sh Style Challenge (AZ-305)

> Uma plataforma de e-learning tem: autenticação (100k req/hora), cursos (10k req/hora), vídeos (streaming, 1M req/hora), pagamentos (5k req/hora, ACID crítico). Projete a plataforma de microserviços.
>
> **Resposta**: Azure Container Apps Environment para auth, cursos, pagamentos (serverless, scale-to-zero, KEDA). AKS para o serviço de streaming de vídeo (I/O intensivo, requires tuning de node pools). Dapr para comunicação entre serviços. Circuit breaker no serviço de pagamentos. Application Gateway + WAF na frente. Azure Front Door para CDN de vídeo.
`,

  quiz: [
    {
      question: 'Quando escolher Azure Container Apps em vez de Azure Kubernetes Service (AKS)?',
      options: [
        'Container Apps é sempre mais barato que AKS',
        'Container Apps é ideal para microserviços que se beneficiam de serverless (scale-to-zero, KEDA, Dapr) sem a complexidade operacional do Kubernetes',
        'Container Apps suporta mais workloads que AKS',
        'AKS não suporta autoscaling, por isso Container Apps é necessário'
      ],
      correct: 1,
      explanation: 'Azure Container Apps abstrai o Kubernetes (é construído sobre K8s) e oferece: scale-to-zero automático, KEDA nativo para scaling por métricas de filas/eventos, Dapr integrado para service mesh/invocation, e revisões/tráfego para canary deployments — sem você precisar gerenciar nodes, node pools ou upgrades de K8s. Use AKS quando precisar de controle total: node configurations customizadas, GPUs, networking avançado, ou workloads que não se encaixam no modelo Container Apps.',
      reference: 'Tabela de plataformas — Container Apps = serverless K8s para microserviços; AKS = K8s gerenciado para workloads complexos.'
    },
    {
      question: 'O que é o padrão Circuit Breaker e por que é essencial em microserviços?',
      options: [
        'É um mecanismo de autenticação entre microserviços',
        'Previne falhas em cascata: quando um serviço dependente falha repetidamente, o circuit breaker "abre" e retorna erro rápido sem chamar o serviço falho, protegendo o sistema',
        'É um balanceador de carga entre instâncias de um microserviço',
        'É a estratégia de deploy blue-green para microserviços'
      ],
      correct: 1,
      explanation: 'Sem Circuit Breaker: Serviço A chama Serviço B (que está lento) → A fica aguardando → threads se esgotam → A também fica lento → todo o sistema em cascata falha. Com Circuit Breaker: após N falhas, o circuito ABRE, Serviço A retorna erro imediato sem esperar B, preservando recursos. Após timeout, tenta novamente (HALF-OPEN). Isso limita o blast radius de falhas de serviços dependentes.',
      reference: 'Seção Circuit Breaker — implemente com Istio, Dapr, ou bibliotecas como tenacity (Python) ou Polly (.NET).'
    }
  ],

  flashcards: [
    {
      front: 'Quais são os princípios fundamentais de design de microserviços?',
      back: '1. **Single Responsibility**: cada serviço faz uma coisa bem (Bounded Context)\n2. **Own your data**: cada serviço tem seu próprio banco (database per service)\n3. **API-first**: contratos explícitos (OpenAPI, gRPC)\n4. **Fail gracefully**: circuit breakers, timeouts, fallbacks\n5. **Design for failure**: qualquer dependência pode falhar\n6. **Observable**: health checks, distributed tracing, structured logs\n7. **Independent deployable**: deploy sem coordenar outros times\n\n**Anti-patterns**: banco compartilhado, microserviços muito granulares, sync chains longas'
    },
    {
      front: 'Como Azure Container Apps implementa canary deployment nativamente?',
      back: '**Container Apps Revisions** = cada deploy cria uma nova revisão imutável.\n\n**Traffic splitting**:\n```bash\naz containerapp ingress traffic set \\\n  --name myapp --resource-group myRG \\\n  --revision-weight \\\n    latest=90 \\\n    myapp--previous-revision=10\n# 90% novo, 10% antigo\n```\n\n**Promoção completa**:\n```bash\n--revision-weight latest=100\n```\n\n**Rollback**:\n```bash\n--revision-weight myapp--previous-revision=100\n```\n\nSem Argo Rollouts, sem Helm — nativo no Container Apps.'
    }
  ],

  lab: {
    scenario: 'Criar um Container App com autoscaling e tráfego dividido para simular canary deployment.',
    objective: 'Explorar Azure Container Apps, revision management e traffic splitting.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Criar Container Apps Environment e primeiro app',
        instruction: 'Crie um Container Apps Environment e faça deploy de um container de teste.',
        hints: ['az containerapp env create', 'az containerapp create --image'],
        solution: `\`\`\`bash
SUFFIX=$(date +%s | tail -c 5)
az group create --name rg-microservices-lab --location eastus

# Criar Environment
az containerapp env create \
  --name microservices-env \
  --resource-group rg-microservices-lab \
  --location eastus

# Deploy primeiro app (nginx como placeholder)
az containerapp create \
  --name webapp \
  --resource-group rg-microservices-lab \
  --environment microservices-env \
  --image nginx:alpine \
  --target-port 80 \
  --ingress external \
  --min-replicas 0 \
  --max-replicas 5 \
  --cpu 0.25 --memory 0.5Gi

URL=$(az containerapp show --name webapp --resource-group rg-microservices-lab --query "properties.configuration.ingress.fqdn" -o tsv)
echo "App URL: https://$URL"
echo "SUFFIX=\${SUFFIX}" > /tmp/microlab.sh
\`\`\``,
        verify: `\`\`\`bash
az containerapp show --name webapp --resource-group rg-microservices-lab \
  --query "{Name:name,FQDN:properties.configuration.ingress.fqdn,Status:properties.provisioningState}" -o table
# Esperado: webapp, URL disponível, Succeeded
\`\`\``
      },
      {
        title: 'Simular canary com traffic splitting',
        instruction: 'Faça deploy de uma nova versão e divida o tráfego 80/20 entre v1 e v2.',
        hints: ['az containerapp update cria nova revisão', 'az containerapp ingress traffic set para split'],
        solution: `\`\`\`bash
# Deploy nova versão (nginx:1.25 como v2)
az containerapp update \
  --name webapp \
  --resource-group rg-microservices-lab \
  --image nginx:1.25 \
  --revision-suffix v2

# Listar revisões disponíveis
az containerapp revision list \
  --name webapp \
  --resource-group rg-microservices-lab \
  --query "[].{Name:name,Active:properties.active,Traffic:properties.trafficWeight}" -o table

# Dividir tráfego 80% v1 / 20% v2 (canary)
LATEST_REVISION=$(az containerapp revision list \
  --name webapp --resource-group rg-microservices-lab \
  --query "[?properties.active].name | [0]" -o tsv)

PREV_REVISION=$(az containerapp revision list \
  --name webapp --resource-group rg-microservices-lab \
  --query "[-2].name" -o tsv)

az containerapp ingress traffic set \
  --name webapp --resource-group rg-microservices-lab \
  --revision-weight "$LATEST_REVISION=20" "$PREV_REVISION=80"

echo "Canary ativo: 20% v2, 80% v1"
\`\`\``,
        verify: `\`\`\`bash
az containerapp ingress traffic show \
  --name webapp --resource-group rg-microservices-lab \
  --query "[].{Revision:revisionName,Weight:weight}" -o table
# Esperado: dois entries, somando 100%

az group delete --name rg-microservices-lab --yes --no-wait
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Container App não escala para zero apesar de min-replicas=0',
      difficulty: 'easy',
      symptom: 'Um Container App configurado com min-replicas=0 continua com pelo menos 1 réplica ativa mesmo sem tráfego, gerando custo desnecessário.',
      diagnosis: `\`\`\`bash
az containerapp show --name myapp --resource-group myRG \
  --query "properties.template.scale.{Min:minReplicas,Max:maxReplicas,Rules:rules}" -o json
\`\`\``,
      solution: `**Causas comuns**:

1. **Ingress externo sem regra de scaling**: o Container Apps precisa de uma scale rule HTTP para saber quando escalar para zero:
\`\`\`bash
az containerapp update --name myapp --resource-group myRG \
  --scale-rule-name http-scaling \
  --scale-rule-http-concurrency 100
\`\`\`

2. **Scale rule de HTTP não configurada mas Ingress habilitado**: ao criar o app com ingress sem scale rule, o Container Apps mantém 1 réplica para garantir responsividade.

3. **Dapr sidecar habilitado**: Dapr pode manter um processo ativo. Verificar se é necessário para este app.

4. **min-replicas foi atualizado mas não aplicado**: verificar se o comando de update foi bem-sucedido:
\`\`\`bash
az containerapp revision list --name myapp --resource-group myRG --query "[?properties.active]"
\`\`\``
    }
  ]
};
