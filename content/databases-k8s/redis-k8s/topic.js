window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['databases-k8s/redis-k8s'] = {
  theory: `# Redis e Caching no Kubernetes

## Relevância no Exame
> Redis em Kubernetes cobre desde deploy standalone até Sentinel/Cluster mode, operadores, eviction policies, persistência e padrões de caching para KubeAstronaut.

## Conceitos Fundamentais

### Modos de Deploy do Redis

\`\`\`
Standalone:
  1 pod Redis → simples, sem HA
  Uso: caching stateless, sessões dev

Sentinel (HA sem sharding):
  1 primary + N replicas + Sentinel watches
  Sentinel detecta falha → promove réplica
  Uso: HA com até ~100GB de dados

Cluster Mode (HA com sharding):
  Dados particionados em 16384 slots entre N shards
  Cada shard: 1 primary + réplicas
  Uso: datasets grandes, alta throughput
\`\`\`

### Redis Sentinel — Arquitetura

\`\`\`
┌─────────────────────────────────────────┐
│          Redis Sentinel Setup            │
│                                          │
│  Sentinel-0  Sentinel-1  Sentinel-2     │
│      ↓            ↓            ↓        │
│  ┌─────────┐  ┌─────────┐  ┌────────┐  │
│  │ Primary │→ │Replica-1│  │Replica-2│  │
│  │ redis-0 │  │ redis-1 │  │ redis-2│  │
│  └─────────┘  └─────────┘  └────────┘  │
│                                          │
│  Failover: Sentinel vota (quorum=2)      │
│  Se primary fica offline > 30s →        │
│  Promove réplica com maior offset       │
└─────────────────────────────────────────┘
\`\`\`

### Persistência no Redis

| Opção | Mecanismo | Recovery | Performance |
|-------|-----------|----------|-------------|
| RDB | Snapshot periódico | Dados até último snapshot | Alta |
| AOF | Log de toda operação | Durabilidade quase total | Média |
| RDB+AOF | Ambos | Melhor durabilidade | Baixa |
| No persistence | Sem disco | Perda total em restart | Máxima |

Para caching: sem persistência (dados são regeneráveis)
Para session store: AOF ou RDB+AOF

### Eviction Policies — Quando Redis Fica Cheio

\`\`\`
Políticas mais usadas:

allkeys-lru:
  - Remove chaves MENOS USADAS recentemente (qualquer chave)
  - Melhor para caching onde qualquer chave pode ser evicted
  - Recomendado para cache geral

volatile-lru:
  - Remove chaves menos usadas COM TTL definido
  - Respeita chaves sem TTL (não evict)
  - Para mix de cache (com TTL) e dados persistentes (sem TTL)

allkeys-lfu:
  - Remove chaves MENOS FREQUENTEMENTE usadas
  - Melhor para padrões de hot/cold data

noeviction:
  - Retorna erro quando memória cheia
  - Para session stores críticos onde perder dados é inaceitável
  - Default do Redis
\`\`\`

### Padrões de Caching

**Cache-Aside (Lazy Loading)**:
\`\`\`
1. App verifica Redis → HIT: retorna dado
2. MISS → App busca no DB → Armazena no Redis → Retorna
Vantagem: Simples, dados no cache quando necessário
Desvantagem: Primeira request é lenta (cache miss)
\`\`\`

**Write-Through**:
\`\`\`
1. App escreve no DB
2. App escreve no Redis
Vantagem: Cache sempre atualizado
Desvantagem: Latência de escrita maior (escrita dupla)
\`\`\`

**Write-Behind (Write-Back)**:
\`\`\`
1. App escreve no Redis
2. Redis (assíncrono) escreve no DB
Vantagem: Escrita muito rápida
Desvantagem: Risco de perda de dados se Redis cair
\`\`\`

### Operadores Redis no Kubernetes

**Redis Operator (Spotahome/OT-container-kit)**:
\`\`\`yaml
apiVersion: databases.spotahome.com/v1
kind: RedisFailover  # Gerencia Sentinel + primary/replicas
\`\`\`

**Redis Enterprise Operator**:
- Para Redis Enterprise (commercial)
- Active-Active, Auto Tiering

**Bitnami Helm Chart** (mais popular para dev/prod):
\`\`\`bash
helm install redis bitnami/redis \\
  --set architecture=replication \\
  --set auth.password=redispass \\
  --set replica.replicaCount=2
\`\`\`

## Comandos Essenciais

### Deploy com Helm (Bitnami)
\`\`\`bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# Redis Standalone
helm install redis bitnami/redis \\
  --namespace cache \\
  --create-namespace \\
  --set auth.password="RedisPass123" \\
  --set master.persistence.size=8Gi

# Redis com Sentinel HA
helm install redis bitnami/redis \\
  --namespace cache \\
  --set architecture=replication \\
  --set sentinel.enabled=true \\
  --set auth.password="RedisPass123" \\
  --set replica.replicaCount=2 \\
  --set master.persistence.size=8Gi \\
  --set replica.persistence.size=8Gi

# Ver pods criados
kubectl get pods -n cache

# Obter senha
kubectl get secret redis -n cache \\
  -o jsonpath='{.data.redis-password}' | base64 -d
\`\`\`

### Operações Redis
\`\`\`bash
# Acessar Redis CLI
kubectl exec -n cache -it redis-master-0 -- \\
  redis-cli -a "RedisPass123"

# Info de uso de memória
kubectl exec -n cache redis-master-0 -- \\
  redis-cli -a "RedisPass123" INFO memory | grep -E "used_memory_human|maxmemory"

# Ver eviction policy atual
kubectl exec -n cache redis-master-0 -- \\
  redis-cli -a "RedisPass123" CONFIG GET maxmemory-policy

# Alterar eviction policy
kubectl exec -n cache redis-master-0 -- \\
  redis-cli -a "RedisPass123" CONFIG SET maxmemory-policy allkeys-lru

# Ver replicas conectadas
kubectl exec -n cache redis-master-0 -- \\
  redis-cli -a "RedisPass123" INFO replication

# Redis MONITOR (debug - muito verboso)
kubectl exec -n cache -it redis-master-0 -- \\
  redis-cli -a "RedisPass123" MONITOR

# Slow log
kubectl exec -n cache redis-master-0 -- \\
  redis-cli -a "RedisPass123" SLOWLOG GET 10
\`\`\`

### Monitoramento com redis_exporter
\`\`\`bash
# Instalar redis_exporter como sidecar ou separado
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis-exporter
  namespace: monitoring
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis-exporter
  template:
    metadata:
      labels:
        app: redis-exporter
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9121"
    spec:
      containers:
        - name: redis-exporter
          image: oliver006/redis_exporter:latest
          env:
            - name: REDIS_ADDR
              value: "redis://redis-master.cache:6379"
            - name: REDIS_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: redis
                  namespace: cache
                  key: redis-password
          ports:
            - containerPort: 9121
EOF

# Métricas principais para alertar
# redis_connected_clients > 80% do maxclients → throttle iminente
# redis_memory_used_bytes / redis_memory_max_bytes > 0.9 → eviction
# redis_rdb_last_bgsave_status != 1 → backup RDB falhou
\`\`\`

## Exemplos YAML

### Redis Standalone com Persistência
\`\`\`yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis
  namespace: cache
spec:
  serviceName: redis
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
          image: redis:7.2-alpine
          command:
            - redis-server
            - /etc/redis/redis.conf
          ports:
            - containerPort: 6379
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
          livenessProbe:
            exec:
              command:
                - redis-cli
                - -a
                - \$(REDIS_PASSWORD)
                - PING
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            exec:
              command:
                - redis-cli
                - -a
                - \$(REDIS_PASSWORD)
                - PING
            initialDelaySeconds: 5
            periodSeconds: 5
          env:
            - name: REDIS_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: redis-secret
                  key: password
          volumeMounts:
            - name: data
              mountPath: /data
            - name: config
              mountPath: /etc/redis
      volumes:
        - name: config
          configMap:
            name: redis-config
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 8Gi

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: redis-config
  namespace: cache
data:
  redis.conf: |
    requirepass \${REDIS_PASSWORD}
    maxmemory 256mb
    maxmemory-policy allkeys-lru
    appendonly yes
    appendfsync everysec
    save 900 1
    save 300 10
    save 60 10000
    loglevel notice
    bind 0.0.0.0
\`\`\`

### PodDisruptionBudget para Redis Sentinel
\`\`\`yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: redis-pdb
  namespace: cache
spec:
  selector:
    matchLabels:
      app: redis
  minAvailable: 2  # De 3 pods, sempre manter 2
\`\`\`

### NetworkPolicy para Redis (apenas backend)
\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: redis-access
  namespace: cache
spec:
  podSelector:
    matchLabels:
      app: redis
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: backend
          podSelector:
            matchLabels:
              app: api
      ports:
        - protocol: TCP
          port: 6379
\`\`\`

### PrometheusRule para Redis
\`\`\`yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: redis-alerts
  namespace: monitoring
  labels:
    app: kube-prometheus-stack
spec:
  groups:
    - name: redis
      rules:
        - alert: RedisMemoryHigh
          expr: redis_memory_used_bytes / redis_memory_max_bytes > 0.9
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "Redis memory above 90% on {{ \$labels.instance }}"

        - alert: RedisDown
          expr: redis_up == 0
          for: 1m
          labels:
            severity: critical
          annotations:
            summary: "Redis instance {{ \$labels.instance }} is down"

        - alert: RedisTooManyConnections
          expr: redis_connected_clients > 900
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "Redis has {{ \$value }} connections (limit ~1000)"
\`\`\`

## Erros Comuns

### 1. Redis em OOMKill sem maxmemory definido
**Causa**: Redis não tem limite de memória configurado — cresce até esgotar o node.
**Solução**: Sempre definir \`maxmemory\` no redis.conf E nos limits do container.
\`\`\`
limits.memory: 512Mi
redis.conf: maxmemory 400mb  # ~80% do limit do container
\`\`\`

### 2. eviction policy padrão (noeviction) para cache
**Causa**: Redis retorna ENOMEM em vez de evictar chaves antigas.
**Solução**: Para caching, usar \`allkeys-lru\` ou \`allkeys-lfu\`.

### 3. Usar Deployment em vez de StatefulSet para Redis com persistência
**Causa**: Em caso de restart, um novo pod pode receber outro PVC ou nenhum.
**Solução**: StatefulSet para Redis com AOF/RDB; emptyDir para Redis de caching puro.

### 4. Senha do Redis em texto plano no ConfigMap
**Causa**: Redis.conf com \`requirepass minhaSenha\` armazenado em ConfigMap.
**Solução**: Usar Secret e referência via env var ou volume montado com permissões restritas.

### 5. Não configurar PDB para Sentinel
**Causa**: kubectl drain pode remover sentinels suficientes para perda de quorum.
**Solução**: PDB com minAvailable: 2 para cluster de 3 sentinels.

## Killer.sh Style Challenge

**Contexto**: A aplicação usa Redis para session store e está tendo problemas de performance. O time reporta latência alta e OOM kills ocasionais.

**Tarefas**:
1. Verificar o uso atual de memória e eviction policy
2. Identificar se há evictions acontecendo (\`redis_evicted_keys_total\`)
3. Ajustar maxmemory para 80% do limit do container
4. Mudar eviction policy para \`volatile-lru\` (sessões têm TTL)
5. Verificar slow log para queries > 100ms
6. Criar PrometheusRule para alertar quando memória > 85%`,

  quiz: [
    {
      question: 'Qual eviction policy do Redis é mais adequada para um cache geral onde qualquer chave pode ser removida?',
      options: [
        'noeviction',
        'allkeys-lru',
        'volatile-lru',
        'allkeys-random'
      ],
      correct: 1,
      explanation: 'allkeys-lru remove as chaves Menos Recentemente Usadas de qualquer conjunto de chaves quando a memória está cheia. Para caching onde todos os dados são regeneráveis, é a política mais eficiente — mantém chaves "quentes" e remove chaves "frias". noeviction retorna erro ao invés de evictar.',
      reference: 'Conceito: Eviction Policies — seção dedicada na teoria.'
    },
    {
      question: 'Por que usar StatefulSet em vez de Deployment para Redis com persistência AOF/RDB?',
      options: [
        'StatefulSet é mais performático para operações de cache',
        'StatefulSet garante que o pod recrie com o mesmo PVC após restart',
        'Deployment não suporta PersistentVolumes para Redis',
        'StatefulSet configura AOF automaticamente'
      ],
      correct: 1,
      explanation: 'StatefulSet garante que ao recriar o pod (após crash ou restart), ele retorne ao mesmo PVC com os dados de AOF/RDB. Com Deployment, um pod recriado pode receber um PVC diferente (vazio) ou não ter persistência, causando perda dos dados de sessão/cache.',
      reference: 'Conceito: StatefulSet para Redis — seção "Erros Comuns" na teoria.'
    },
    {
      question: 'Qual é a diferença entre o modo Sentinel e o Cluster Mode do Redis?',
      options: [
        'Sentinel é mais recente e substitui completamente o Cluster Mode',
        'Sentinel fornece HA sem sharding; Cluster Mode fornece HA com sharding automático',
        'Sentinel usa mais memória; Cluster Mode usa menos',
        'Não há diferença prática — ambos são equivalentes para produção'
      ],
      correct: 1,
      explanation: 'Redis Sentinel monitora primary/replicas e realiza failover automático, mas sem dividir os dados — tudo fica em um único primary. Redis Cluster Mode divide automaticamente os dados em 16384 hash slots distribuídos entre múltiplos shards, permitindo datasets maiores e maior throughput.',
      reference: 'Conceito: Modos de Deploy — seção "Modos de Deploy do Redis" na teoria.'
    },
    {
      question: 'Qual padrão de caching deve ser usado quando é CRÍTICO que o cache nunca fique desatualizado (cache miss = dados inconsistentes)?',
      options: [
        'Cache-Aside (Lazy Loading)',
        'Write-Through',
        'Write-Behind (Write-Back)',
        'Read-Through'
      ],
      correct: 1,
      explanation: 'Write-Through escreve no DB E no cache simultaneamente na mesma operação. Garante que o cache sempre reflete o estado atual do banco. Cache-Aside pode ter janelas de inconsistência; Write-Behind é assíncrono e pode perder dados. Ideal para dados como configurações críticas ou saldos.',
      reference: 'Padrão: Write-Through — seção "Padrões de Caching" na teoria.'
    },
    {
      question: 'Qual a configuração correta de maxmemory para um pod Redis com limits.memory de 512Mi?',
      options: [
        'maxmemory 512mb (usar 100% do limit)',
        'maxmemory 400mb (usar ~80% do limit)',
        'maxmemory não precisa ser configurado com limits no pod',
        'maxmemory 256mb (usar 50% para margem de segurança)'
      ],
      correct: 1,
      explanation: 'Configurar maxmemory igual ao limit do container faz o Redis tentar alocar mais memória do que o cgroup permite, causando OOMKill pelo Kubernetes antes do Redis evictar chaves. Usar ~80% do limit deixa headroom para o processo Redis em si, evitando OOMKills inesperados.',
      reference: 'Erros comuns: OOMKill — seção "Erros Comuns" na teoria.'
    },
    {
      question: 'Quão muitos Sentinels são necessários para quorum e tolerância a falha de 1 Sentinel?',
      options: [
        '1 Sentinel (quorum=1)',
        '2 Sentinels (quorum=1)',
        '3 Sentinels (quorum=2)',
        '5 Sentinels (quorum=3)'
      ],
      correct: 2,
      explanation: '3 Sentinels com quorum=2 é o mínimo para tolerância a falha. Se 1 Sentinel cai, os outros 2 ainda têm quorum e podem votar para promover uma réplica. Com 2 Sentinels (quorum=1), a perda de 1 resulta em apenas 1 Sentinel ativo — que pode ter visão parcial da rede (split-brain).',
      reference: 'Arquitetura: Redis Sentinel — seção de arquitetura na teoria.'
    },
    {
      question: 'Qual é a principal vantagem do redis_exporter para monitoramento Redis em Kubernetes?',
      options: [
        'redis_exporter modifica o Redis para suportar métricas nativas do Prometheus',
        'redis_exporter expõe métricas do Redis no formato Prometheus para scraping',
        'redis_exporter é necessário para o Loki coletar logs do Redis',
        'redis_exporter armazena dados de performance do Redis no etcd'
      ],
      correct: 1,
      explanation: 'redis_exporter conecta ao Redis via redis-cli e expõe todas as métricas do comando INFO Redis (memória, conexões, operações, replication lag, keyspace) no formato Prometheus /metrics endpoint. Permite criar dashboards Grafana e PrometheusRules para alertas de saúde do Redis.',
      reference: 'Monitoramento: redis_exporter — seção "Monitoramento com redis_exporter" na teoria.'
    },
    {
      question: 'Qual comando Redis CLI mostra o lag de replicação das réplicas conectadas?',
      options: [
        'redis-cli REPLICATION STATUS',
        'redis-cli INFO replication',
        'redis-cli REPLICA LIST',
        'redis-cli CONFIG GET replication-lag'
      ],
      correct: 1,
      explanation: 'redis-cli INFO replication mostra: role (master/slave), connected_slaves, slave0/slave1 com IP, port e offset (lag em bytes). O offset do primary menos o offset da réplica indica o lag de replicação — alto lag indica problemas de rede ou primary sobrecarregado.',
      reference: 'Comandos: redis-cli INFO — seção "Operações Redis" na teoria.'
    }
  ],

  flashcards: [
    {
      front: 'Quais são os 3 modos de deploy do Redis no Kubernetes?',
      back: 'Standalone:\n- 1 pod, sem HA\n- Para dev, caching efêmero\n- Sem replica, sem Sentinel\n\nSentinel (HA sem sharding):\n- Primary + N réplicas + Sentinels\n- Failover automático via votação\n- Quorum mínimo: 3 Sentinels (quorum=2)\n- Dataset em 1 primary (até ~100GB)\n\nCluster Mode (HA com sharding):\n- Dados em 16384 hash slots\n- Distribuídos em N shards\n- Cada shard: primary + réplicas\n- Para datasets > 100GB ou alta throughput'
    },
    {
      front: 'Quais são as principais eviction policies do Redis?',
      back: 'allkeys-lru ← mais usado para cache\n- Remove QUALQUER chave menos recentemente usada\n- Bom para: cache geral, tudo é regenerável\n\nvolatile-lru\n- Remove chaves COM TTL, LRU first\n- Bom para: mix de cache (TTL) + dados persistentes (sem TTL)\n\nallkeys-lfu\n- Remove chaves menos frequentemente usadas\n- Bom para: hot/cold data bem definidos\n\nnoeviction (padrão)\n- Retorna erro ENOMEM quando cheio\n- Bom para: session stores onde perda é inaceitável\n\nConfigurar:\nCONFIG SET maxmemory-policy allkeys-lru'
    },
    {
      front: 'Qual a fórmula correta para configurar maxmemory no Redis?',
      back: 'maxmemory ≈ 80% do limits.memory do container\n\nExemplo:\nlimits.memory: 512Mi\nmaxmemory 400mb  # 78% ← correto\n\nPor que não 100%?\n- Redis usa memória além dos dados (overhead do processo)\n- Com 100%, cgroup do K8s mata o processo (OOMKill)\n  ANTES do Redis tentar evictar chaves\n- Com 80%, Redis evicta internamente com segurança\n\nVer uso atual:\nredis-cli INFO memory | grep used_memory_human\n\nVer maxmemory atual:\nredis-cli CONFIG GET maxmemory'
    },
    {
      front: 'Quais são os 3 padrões de caching e suas diferenças?',
      back: 'Cache-Aside (Lazy Loading):\n- App verifica cache → miss → busca DB → salva cache\n- Simples, cache só tem o que foi usado\n- Desvantagem: primeira request = lenta (miss)\n\nWrite-Through:\n- Escrita vai para DB E cache simultaneamente\n- Cache sempre atualizado\n- Desvantagem: latência de escrita maior\n\nWrite-Behind (Write-Back):\n- Escrita vai para cache → async para DB\n- Escrita muito rápida\n- Desvantagem: risco de perda se cache cair antes de sync\n\nEscolha: stateless cache → Cache-Aside; consistência crítica → Write-Through'
    },
    {
      front: 'Por que PodDisruptionBudget é importante para Redis Sentinel?',
      back: 'Sentinel precisa de quorum para decisões de failover.\n\nSem PDB:\nkubectl drain node-1 → pode remover 2 de 3 Sentinels\n→ Quorum perdido (precisa de 2, só tem 1)\n→ Failover IMPOSSÍVEL se primary cair\n→ Redis fica sem primary = indisponível\n\nCom PDB (minAvailable: 2 para 3 Sentinels):\nkubectl drain → BLOQUEADO se restaria < 2 Sentinels\n→ Quorum garantido\n\napiVersion: policy/v1\nkind: PodDisruptionBudget\nspec:\n  selector:\n    matchLabels:\n      app: redis\n  minAvailable: 2'
    },
    {
      front: 'Como instalar Redis com Sentinel HA via Helm?',
      back: 'helm repo add bitnami https://charts.bitnami.com/bitnami\nhelm repo update\n\nhelm install redis bitnami/redis \\\n  --namespace cache \\\n  --create-namespace \\\n  --set architecture=replication \\\n  --set sentinel.enabled=true \\\n  --set auth.password="RedisPass123" \\\n  --set replica.replicaCount=2 \\\n  --set master.persistence.size=8Gi \\\n  --set replica.persistence.size=8Gi\n\n# Verificar\nkubectl get pods -n cache\n# redis-node-0 (primary), redis-node-1, redis-node-2\n\n# Senha\nkubectl get secret redis -n cache \\\n  -o jsonpath=\'{.data.redis-password}\' | base64 -d'
    },
    {
      front: 'Como verificar saúde do Redis e replication lag?',
      back: '# Info de replicação\nredis-cli -a \$PASS INFO replication\n# connected_slaves: N\n# slave0:ip=10.0.0.x,port=6379,state=online,offset=12345,lag=0\n\n# Memória\nredis-cli -a \$PASS INFO memory | grep -E "used_memory_human|maxmemory_human"\n\n# Evictions (deve ser 0 ou baixo)\nredis-cli -a \$PASS INFO stats | grep evicted_keys\n\n# Slow log (últimas 10 queries lentas)\nredis-cli -a \$PASS SLOWLOG GET 10\n\n# Número de conexões\nredis-cli -a \$PASS CLIENT LIST | wc -l\n\n# Keyspace (databases usadas)\nredis-cli -a \$PASS INFO keyspace'
    },
    {
      front: 'Qual a diferença entre AOF e RDB para persistência Redis?',
      back: 'RDB (Redis Database Backup):\n- Snapshot periódico do dataset inteiro\n- Configurar: save 900 1 (snapshot se 1 key mudou em 900s)\n- Recovery rápido\n- Risco: perde dados desde último snapshot\n- Bom para: backups, menor overhead em escrita\n\nAOF (Append-Only File):\n- Log de cada operação de escrita\n- appendfsync always: máxima durabilidade (lento)\n- appendfsync everysec: bom equilíbrio (recomendado)\n- appendfsync no: delega ao OS (rápido, menos seguro)\n- Recovery mais lento (replay do log)\n- Bom para: session stores, dados críticos\n\nProdução: appendonly yes + appendfsync everysec'
    }
  ],

  lab: {
    scenario: 'A aplicação de e-commerce precisa de Redis para dois propósitos: session store (dados de usuário logado, TTL de 30min) e product cache (cache de catálogo, TTL de 5min). Você deve configurar um Redis HA com Sentinel e as políticas corretas.',
    objective: 'Deploy Redis com Sentinel HA, configurar eviction policy adequada, criar NetworkPolicy de acesso e monitorar com redis_exporter.',
    duration: '30-40 minutos',
    steps: [
      {
        title: 'Deploy Redis Sentinel com Helm',
        instruction: `Faça deploy do Redis com arquitetura de replicação e Sentinel usando o Helm chart da Bitnami no namespace \`cache\`.

Configure:
- 1 master + 2 replicas
- Sentinel habilitado
- Persistência de 5Gi por node
- Senha via Secret`,
        hints: [
          'bitnami/redis com architecture=replication habilita primary+replicas',
          'sentinel.enabled=true adiciona o Sentinel como processo sidecar',
          'A senha vai para um Secret automático chamado "redis"',
          'Pods são criados como StatefulSet com volumeClaimTemplates'
        ],
        solution: `\`\`\`bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

kubectl create namespace cache

helm install redis bitnami/redis \\
  --namespace cache \\
  --set architecture=replication \\
  --set sentinel.enabled=true \\
  --set auth.password="RedisPass123!" \\
  --set replica.replicaCount=2 \\
  --set master.persistence.size=5Gi \\
  --set replica.persistence.size=5Gi \\
  --set master.resources.requests.cpu=100m \\
  --set master.resources.requests.memory=256Mi \\
  --set master.resources.limits.memory=512Mi \\
  --set master.configuration="maxmemory 400mb\nmaxmemory-policy volatile-lru"

kubectl wait --for=condition=ready pod \\
  -l app.kubernetes.io/name=redis \\
  -n cache --timeout=120s
\`\`\``,
        verify: `\`\`\`bash
# Verificar pods
kubectl get pods -n cache
# Saída esperada: 3 pods redis-node-X Running

# Verificar StatefulSet
kubectl get statefulset -n cache

# Verificar services
kubectl get svc -n cache
# Saída esperada: redis (ClusterIP) e redis-headless

# Testar conexão via Sentinel
REDIS_PASS=\$(kubectl get secret redis -n cache \\
  -o jsonpath='{.data.redis-password}' | base64 -d)

kubectl exec -n cache redis-node-0 -- \\
  redis-cli -a "\$REDIS_PASS" PING
# Saída esperada: PONG

# Verificar replicação
kubectl exec -n cache redis-node-0 -- \\
  redis-cli -a "\$REDIS_PASS" INFO replication | grep -E "role|connected_slaves"
# Saída esperada: role:master, connected_slaves:2
\`\`\``
      },
      {
        title: 'Configurar Eviction Policy e Testar Caching',
        instruction: `Configure a eviction policy adequada para o caso de uso (session store com TTL):
1. Verificar a eviction policy atual
2. Mudar para \`volatile-lru\` (remove chaves com TTL, LRU first)
3. Configurar maxmemory para 80% do limit
4. Inserir dados de teste com e sem TTL para verificar comportamento`,
        hints: [
          'volatile-lru preserva chaves sem TTL (dados persistentes) e evicta apenas chaves com TTL',
          'CONFIG SET altera configurações em runtime sem restart',
          'Para session store: SETEX key TTL value',
          'Dados sem TTL (como configurações) não serão evictados'
        ],
        solution: `\`\`\`bash
REDIS_PASS=\$(kubectl get secret redis -n cache \\
  -o jsonpath='{.data.redis-password}' | base64 -d)

# Ver política atual
kubectl exec -n cache redis-node-0 -- \\
  redis-cli -a "\$REDIS_PASS" CONFIG GET maxmemory-policy

# Alterar para volatile-lru
kubectl exec -n cache redis-node-0 -- \\
  redis-cli -a "\$REDIS_PASS" CONFIG SET maxmemory-policy volatile-lru

# Alterar maxmemory para 400mb (~80% de 512Mi)
kubectl exec -n cache redis-node-0 -- \\
  redis-cli -a "\$REDIS_PASS" CONFIG SET maxmemory 400mb

# Inserir dados de teste
# Session (com TTL de 1800s = 30min)
kubectl exec -n cache redis-node-0 -- \\
  redis-cli -a "\$REDIS_PASS" SETEX "session:user:123" 1800 '{"userId":123,"cart":["item1"]}'

# Product cache (com TTL de 300s = 5min)
kubectl exec -n cache redis-node-0 -- \\
  redis-cli -a "\$REDIS_PASS" SETEX "product:456" 300 '{"name":"Widget","price":9.99}'

# Config (sem TTL - não será evictado)
kubectl exec -n cache redis-node-0 -- \\
  redis-cli -a "\$REDIS_PASS" SET "config:featureFlags" '{"newUI":true}'

# Verificar TTLs
kubectl exec -n cache redis-node-0 -- \\
  redis-cli -a "\$REDIS_PASS" TTL "session:user:123"
kubectl exec -n cache redis-node-0 -- \\
  redis-cli -a "\$REDIS_PASS" TTL "config:featureFlags"
# Session: ~1800, Config: -1 (sem TTL)
\`\`\``,
        verify: `\`\`\`bash
REDIS_PASS=\$(kubectl get secret redis -n cache \\
  -o jsonpath='{.data.redis-password}' | base64 -d)

# Verificar eviction policy configurada
kubectl exec -n cache redis-node-0 -- \\
  redis-cli -a "\$REDIS_PASS" CONFIG GET maxmemory-policy
# Saída esperada: maxmemory-policy / volatile-lru

# Verificar maxmemory
kubectl exec -n cache redis-node-0 -- \\
  redis-cli -a "\$REDIS_PASS" CONFIG GET maxmemory
# Saída esperada: maxmemory / 419430400 (400mb em bytes)

# Verificar chaves inseridas
kubectl exec -n cache redis-node-0 -- \\
  redis-cli -a "\$REDIS_PASS" DBSIZE
# Saída esperada: 3

# Verificar que session tem TTL
kubectl exec -n cache redis-node-0 -- \\
  redis-cli -a "\$REDIS_PASS" TTL "session:user:123"
# Saída esperada: valor entre 1 e 1800

# Verificar que config não tem TTL
kubectl exec -n cache redis-node-0 -- \\
  redis-cli -a "\$REDIS_PASS" TTL "config:featureFlags"
# Saída esperada: -1 (sem TTL)
\`\`\``
      },
      {
        title: 'Criar NetworkPolicy e Testar Failover Sentinel',
        instruction: `1. Crie uma NetworkPolicy que permite acesso ao Redis apenas do namespace \`backend\`
2. Crie um PodDisruptionBudget para o Redis (minAvailable: 2)
3. Simule um failover deletando o pod master e observe o Sentinel eleger novo primary
4. Verifique que os dados persistem após failover`,
        hints: [
          'Redis Sentinel opera na porta 6379 (Redis) e 26379 (Sentinel)',
          'Após deletar o master, aguarde 10-15s para eleição do Sentinel',
          'O novo primary será um dos redis-node-1 ou redis-node-2',
          'Os dados inseridos no step anterior devem persistir'
        ],
        solution: `\`\`\`bash
# NetworkPolicy
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: redis-access-policy
  namespace: cache
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: redis
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: backend
      ports:
        - protocol: TCP
          port: 6379
        - protocol: TCP
          port: 26379  # Sentinel
EOF

# PodDisruptionBudget
kubectl apply -f - <<EOF
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: redis-pdb
  namespace: cache
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: redis
  minAvailable: 2
EOF

# Testar failover
REDIS_PASS=\$(kubectl get secret redis -n cache \\
  -o jsonpath='{.data.redis-password}' | base64 -d)

# Identificar master atual
kubectl exec -n cache redis-node-0 -- \\
  redis-cli -a "\$REDIS_PASS" INFO replication | grep "role:"

# Deletar master para simular falha
kubectl delete pod redis-node-0 -n cache

# Aguardar failover
sleep 20

# Verificar novo master
kubectl exec -n cache redis-node-1 -- \\
  redis-cli -a "\$REDIS_PASS" INFO replication | grep "role:"
# Deve mostrar role:master em redis-node-1 ou redis-node-2

# Verificar dados persistem
kubectl exec -n cache redis-node-1 -- \\
  redis-cli -a "\$REDIS_PASS" GET "config:featureFlags"
\`\`\``,
        verify: `\`\`\`bash
REDIS_PASS=\$(kubectl get secret redis -n cache \\
  -o jsonpath='{.data.redis-password}' | base64 -d)

# Verificar NetworkPolicy criada
kubectl get networkpolicy redis-access-policy -n cache
# Saída esperada: redis-access-policy   Xm

# Verificar PDB
kubectl get pdb redis-pdb -n cache
# Saída esperada: redis-pdb   2   1   3   Xs

# Verificar que houve eleição (um dos nodes é master)
kubectl exec -n cache redis-node-1 -- \\
  redis-cli -a "\$REDIS_PASS" INFO replication | grep "role:"
# Saída esperada: role:master OU role:slave

# Verificar dados após failover
kubectl exec -n cache redis-node-1 -- \\
  redis-cli -a "\$REDIS_PASS" GET "config:featureFlags" 2>/dev/null
# Saída esperada: {"newUI":true} (dados persistidos)

# Verificar cluster voltou a 3 pods
kubectl get pods -n cache -l app.kubernetes.io/name=redis
# Saída esperada: 3 pods Running
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Redis em OOMKill frequente',
      difficulty: 'easy',
      symptom: 'O pod Redis reinicia com OOMKilled várias vezes por dia. Os logs mostram que o Redis estava processando normalmente antes de ser terminado. O kubectl describe pod mostra "OOMKilled" no status.',
      diagnosis: `\`\`\`bash
# Ver histórico de restarts
kubectl get pods -n cache | grep redis
kubectl describe pod redis-node-0 -n cache | grep -A5 "OOMKilled"

# Ver uso atual de memória
kubectl top pod redis-node-0 -n cache

# Ver configuração de maxmemory
kubectl exec -n cache redis-node-0 -- \\
  redis-cli -a \$REDIS_PASS CONFIG GET maxmemory

# Ver evictions happening
kubectl exec -n cache redis-node-0 -- \\
  redis-cli -a \$REDIS_PASS INFO stats | grep evicted_keys

# Ver limites do container
kubectl get pod redis-node-0 -n cache -o json | \\
  jq '.spec.containers[0].resources'
\`\`\``,
      solution: `**Causa 1**: maxmemory não configurado ou igual ao limit do container.
\`\`\`bash
# Ver limite do container
kubectl get pod redis-node-0 -n cache -o json | \\
  jq '.spec.containers[0].resources.limits.memory'
# Ex: "512Mi"

# Configurar maxmemory para 80% do limit (400mb para 512Mi)
kubectl exec -n cache redis-node-0 -- \\
  redis-cli -a \$REDIS_PASS CONFIG SET maxmemory 400mb

# Configurar eviction policy (para não dar erro, mas evictar)
kubectl exec -n cache redis-node-0 -- \\
  redis-cli -a \$REDIS_PASS CONFIG SET maxmemory-policy allkeys-lru

# Salvar configuração permanente (editar ConfigMap/values)
kubectl edit configmap redis-config -n cache
# Adicionar: maxmemory 400mb
#            maxmemory-policy allkeys-lru
\`\`\`

**Causa 2**: Vazamento de memória na aplicação — inserindo dados sem TTL.
\`\`\`bash
# Ver quantidade de chaves sem TTL
kubectl exec -n cache redis-node-0 -- \\
  redis-cli -a \$REDIS_PASS INFO keyspace
# Se muitas chaves em db0 sem TTL: verificar código da app

# Usar SCAN para encontrar chaves sem TTL
kubectl exec -n cache redis-node-0 -- \\
  redis-cli -a \$REDIS_PASS --scan --pattern "*" | \\
  while read key; do
    ttl=\$(redis-cli -a \$REDIS_PASS TTL "\$key")
    [ "\$ttl" = "-1" ] && echo "No TTL: \$key"
  done | head -20
\`\`\``
    },
    {
      title: 'Sentinel não elege novo primary — Redis indisponível após falha',
      difficulty: 'hard',
      symptom: 'O pod redis-master caiu e nunca voltou. Os Sentinels estão rodando mas não elegem um novo primary. A aplicação retorna "READONLY You can\'t write against a read only replica" para writes.',
      diagnosis: `\`\`\`bash
# Ver estado dos Sentinels
kubectl exec -n cache redis-node-1 -- \\
  redis-cli -p 26379 SENTINEL masters

kubectl exec -n cache redis-node-1 -- \\
  redis-cli -p 26379 SENTINEL sentinels mymaster

# Ver quantos Sentinels estão visíveis
kubectl exec -n cache redis-node-1 -- \\
  redis-cli -p 26379 SENTINEL sentinels mymaster | grep -A2 "name"

# Ver logs dos Sentinels
kubectl logs -n cache redis-node-1 -c sentinel 2>/dev/null || \\
  kubectl logs -n cache redis-node-1 | grep -i "sentinel\\|failover\\|elect"

# Verificar quorum configurado
kubectl exec -n cache redis-node-1 -- \\
  redis-cli -p 26379 SENTINEL masters | grep quorum
\`\`\``,
      solution: `**Causa 1**: Quorum não atingido — Sentinels não se enxergam entre si.
\`\`\`bash
# Verificar se Sentinels podem se comunicar
# O serviço headless deve resolver todos os pods
kubectl exec -n cache redis-node-1 -- \\
  redis-cli -p 26379 SENTINEL sentinels mymaster
# Se retornar menos de 2 Sentinels: problema de rede

# Verificar NetworkPolicy bloqueando porta 26379 entre pods
kubectl get networkpolicy -n cache
# Se houver política muito restritiva, adicionar exceção para porta 26379
\`\`\`

**Causa 2**: down-after-milliseconds muito alto.
\`\`\`bash
# Ver timeout configurado
kubectl exec -n cache redis-node-1 -- \\
  redis-cli -p 26379 SENTINEL masters | grep -A5 "down-after"
# Se > 30000ms: Sentinel demora muito para detectar falha

# Ajustar via Helm values:
helm upgrade redis bitnami/redis -n cache \\
  --set sentinel.downAfterMilliseconds=5000 \\
  --reuse-other-values
\`\`\`

**Força failover manual (emergency)**:
\`\`\`bash
kubectl exec -n cache redis-node-1 -- \\
  redis-cli -p 26379 SENTINEL failover mymaster
# Força eleição imediata mesmo sem quorum
\`\`\``
    }
  ]
};
