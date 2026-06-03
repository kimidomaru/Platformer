window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['databases-k8s/redis-k8s'] = {
  theory: `# Redis and Caching on Kubernetes

## Exam Relevance
> Redis on Kubernetes covers standalone to Sentinel/Cluster mode, operators, eviction policies, persistence, and caching patterns for KubeAstronaut.

## Core Concepts

### Redis Deployment Modes

\`\`\`
Standalone:
  1 Redis pod → simple, no HA
  Use: stateless caching, dev sessions

Sentinel (HA without sharding):
  1 primary + N replicas + Sentinel watches
  Sentinel detects failure → promotes replica
  Use: HA with up to ~100GB of data

Cluster Mode (HA with sharding):
  Data partitioned across 16384 slots among N shards
  Each shard: 1 primary + replicas
  Use: large datasets, high throughput
\`\`\`

### Redis Sentinel Architecture

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
│  Failover: Sentinel votes (quorum=2)     │
│  If primary offline > 30s →             │
│  Promotes replica with highest offset   │
└─────────────────────────────────────────┘
\`\`\`

### Redis Persistence

| Option | Mechanism | Recovery | Performance |
|--------|-----------|----------|-------------|
| RDB | Periodic snapshot | Data up to last snapshot | High |
| AOF | Log of every operation | Near-total durability | Medium |
| RDB+AOF | Both | Best durability | Low |
| No persistence | No disk | Total loss on restart | Maximum |

For caching: no persistence (data is regenerable)
For session store: AOF or RDB+AOF

### Eviction Policies — When Redis Gets Full

\`\`\`
Most used policies:

allkeys-lru:
  - Removes LEAST RECENTLY USED keys (any key)
  - Best for caching where any key can be evicted
  - Recommended for general cache

volatile-lru:
  - Removes least recently used keys WITH TTL set
  - Respects keys without TTL (no evict)
  - For mix of cache (with TTL) and persistent data (no TTL)

allkeys-lfu:
  - Removes LEAST FREQUENTLY USED keys
  - Better for hot/cold data patterns

noeviction:
  - Returns error when memory is full
  - For critical session stores where data loss is unacceptable
  - Redis default
\`\`\`

### Caching Patterns

**Cache-Aside (Lazy Loading)**:
\`\`\`
1. App checks Redis → HIT: return data
2. MISS → App fetches from DB → Store in Redis → Return
Advantage: Simple, data in cache when needed
Disadvantage: First request is slow (cache miss)
\`\`\`

**Write-Through**:
\`\`\`
1. App writes to DB
2. App writes to Redis
Advantage: Cache always up to date
Disadvantage: Higher write latency (double write)
\`\`\`

**Write-Behind (Write-Back)**:
\`\`\`
1. App writes to Redis
2. Redis (async) writes to DB
Advantage: Very fast writes
Disadvantage: Data loss risk if Redis fails before sync
\`\`\`

## Essential Commands

### Deploy with Helm (Bitnami)
\`\`\`bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# Redis Standalone
helm install redis bitnami/redis \\
  --namespace cache \\
  --create-namespace \\
  --set auth.password="RedisPass123" \\
  --set master.persistence.size=8Gi

# Redis with Sentinel HA
helm install redis bitnami/redis \\
  --namespace cache \\
  --set architecture=replication \\
  --set sentinel.enabled=true \\
  --set auth.password="RedisPass123" \\
  --set replica.replicaCount=2 \\
  --set master.persistence.size=8Gi \\
  --set replica.persistence.size=8Gi

# Get password
kubectl get secret redis -n cache \\
  -o jsonpath='{.data.redis-password}' | base64 -d
\`\`\`

### Redis Operations
\`\`\`bash
# Access Redis CLI
kubectl exec -n cache -it redis-master-0 -- \\
  redis-cli -a "RedisPass123"

# Memory usage info
kubectl exec -n cache redis-master-0 -- \\
  redis-cli -a "RedisPass123" INFO memory | grep -E "used_memory_human|maxmemory"

# Get current eviction policy
kubectl exec -n cache redis-master-0 -- \\
  redis-cli -a "RedisPass123" CONFIG GET maxmemory-policy

# Change eviction policy
kubectl exec -n cache redis-master-0 -- \\
  redis-cli -a "RedisPass123" CONFIG SET maxmemory-policy allkeys-lru

# View connected replicas
kubectl exec -n cache redis-master-0 -- \\
  redis-cli -a "RedisPass123" INFO replication

# Slow log (last 10 slow queries)
kubectl exec -n cache redis-master-0 -- \\
  redis-cli -a "RedisPass123" SLOWLOG GET 10
\`\`\`

## YAML Examples

### Redis Standalone with Persistence
\`\`\`yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: redis-config
  namespace: cache
data:
  redis.conf: |
    maxmemory 400mb
    maxmemory-policy allkeys-lru
    appendonly yes
    appendfsync everysec
    save 900 1
    save 300 10
    loglevel notice
    bind 0.0.0.0
\`\`\`

### PodDisruptionBudget for Redis Sentinel
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
  minAvailable: 2
\`\`\`

### NetworkPolicy for Redis (backend only)
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

### PrometheusRule for Redis
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
\`\`\`

## Common Mistakes

### 1. Redis OOMKill without maxmemory set
**Fix**: Always set \`maxmemory\` in redis.conf AND container limits. maxmemory ≈ 80% of limits.memory.

### 2. Default eviction policy (noeviction) for cache
**Fix**: For caching, use \`allkeys-lru\` or \`allkeys-lfu\`.

### 3. Using Deployment instead of StatefulSet for Redis with persistence
**Fix**: StatefulSet for Redis with AOF/RDB; emptyDir for pure caching Redis.

### 4. Redis password in plaintext in ConfigMap
**Fix**: Use Secret and reference via env var or restricted-permission volume mount.

### 5. No PDB for Sentinel
**Fix**: PDB with minAvailable: 2 for cluster of 3 sentinels.

## Killer.sh Style Challenge

**Context**: The application uses Redis for session store and is having performance issues. The team reports high latency and occasional OOM kills.

**Tasks**:
1. Check current memory usage and eviction policy
2. Identify if evictions are happening (\`redis_evicted_keys_total\`)
3. Adjust maxmemory to 80% of container limit
4. Change eviction policy to \`volatile-lru\` (sessions have TTL)
5. Check slow log for queries > 100ms
6. Create PrometheusRule to alert when memory > 85%`,

  quiz: [
    {
      question: 'Which Redis eviction policy is most suitable for a general cache where any key can be removed?',
      options: [
        'noeviction',
        'allkeys-lru',
        'volatile-lru',
        'allkeys-random'
      ],
      correct: 1,
      explanation: 'allkeys-lru removes the Least Recently Used keys from any key set when memory is full. For caching where all data is regenerable, it\'s the most efficient policy — keeps "hot" keys and removes "cold" keys. noeviction returns an error instead of evicting.',
      reference: 'Concept: Eviction Policies — dedicated section in theory.'
    },
    {
      question: 'Why use StatefulSet instead of Deployment for Redis with AOF/RDB persistence?',
      options: [
        'StatefulSet is more performant for cache operations',
        'StatefulSet ensures the pod recreates with the same PVC after restart',
        'Deployment doesn\'t support PersistentVolumes for Redis',
        'StatefulSet configures AOF automatically'
      ],
      correct: 1,
      explanation: 'StatefulSet ensures that when the pod is recreated (after crash or restart), it returns to the same PVC with the AOF/RDB data. With Deployment, a recreated pod may receive a different (empty) PVC or no persistence, causing loss of session/cache data.',
      reference: 'Concept: StatefulSet for Redis — "Common Mistakes" section in theory.'
    },
    {
      question: 'What is the difference between Sentinel mode and Cluster Mode in Redis?',
      options: [
        'Sentinel is newer and completely replaces Cluster Mode',
        'Sentinel provides HA without sharding; Cluster Mode provides HA with automatic sharding',
        'Sentinel uses more memory; Cluster Mode uses less',
        'There\'s no practical difference — both are equivalent for production'
      ],
      correct: 1,
      explanation: 'Redis Sentinel monitors primary/replicas and performs automatic failover, but without splitting data — everything stays in a single primary. Redis Cluster Mode automatically splits data across 16384 hash slots distributed among multiple shards, allowing larger datasets and higher throughput.',
      reference: 'Concept: Deploy Modes — "Redis Deployment Modes" section in theory.'
    },
    {
      question: 'Which caching pattern should be used when it is CRITICAL that the cache never be stale (cache miss = inconsistent data)?',
      options: [
        'Cache-Aside (Lazy Loading)',
        'Write-Through',
        'Write-Behind (Write-Back)',
        'Read-Through'
      ],
      correct: 1,
      explanation: 'Write-Through writes to both DB and cache simultaneously in the same operation. It guarantees the cache always reflects the current database state. Cache-Aside can have inconsistency windows; Write-Behind is async and can lose data. Ideal for critical data like configurations or balances.',
      reference: 'Pattern: Write-Through — "Caching Patterns" section in theory.'
    },
    {
      question: 'What is the correct maxmemory configuration for a Redis pod with limits.memory of 512Mi?',
      options: [
        'maxmemory 512mb (use 100% of limit)',
        'maxmemory 400mb (use ~80% of limit)',
        'maxmemory doesn\'t need to be set when pod limits are defined',
        'maxmemory 256mb (use 50% for safety margin)'
      ],
      correct: 1,
      explanation: 'Setting maxmemory equal to the container limit causes Redis to try to allocate more memory than the cgroup allows, resulting in OOMKill by Kubernetes BEFORE Redis tries to evict keys. Using ~80% of the limit leaves headroom for the Redis process itself, avoiding unexpected OOMKills.',
      reference: 'Common mistakes: OOMKill — "Common Mistakes" section in theory.'
    },
    {
      question: 'How many Sentinels are needed for quorum and tolerance to 1 Sentinel failure?',
      options: [
        '1 Sentinel (quorum=1)',
        '2 Sentinels (quorum=1)',
        '3 Sentinels (quorum=2)',
        '5 Sentinels (quorum=3)'
      ],
      correct: 2,
      explanation: '3 Sentinels with quorum=2 is the minimum for fault tolerance. If 1 Sentinel fails, the other 2 still have quorum and can vote to promote a replica. With 2 Sentinels (quorum=1), losing 1 results in only 1 active Sentinel — which may have partial network visibility (split-brain).',
      reference: 'Architecture: Redis Sentinel — architecture section in theory.'
    },
    {
      question: 'What is the main advantage of redis_exporter for Redis monitoring in Kubernetes?',
      options: [
        'redis_exporter modifies Redis to support native Prometheus metrics',
        'redis_exporter exposes Redis metrics in Prometheus format for scraping',
        'redis_exporter is required for Loki to collect Redis logs',
        'redis_exporter stores Redis performance data in etcd'
      ],
      correct: 1,
      explanation: 'redis_exporter connects to Redis via redis-cli and exposes all metrics from the Redis INFO command (memory, connections, operations, replication lag, keyspace) in Prometheus /metrics endpoint format. This enables Grafana dashboards and PrometheusRules alerts for Redis health.',
      reference: 'Monitoring: redis_exporter — "Monitoring with redis_exporter" section in theory.'
    },
    {
      question: 'Which Redis CLI command shows the replication lag of connected replicas?',
      options: [
        'redis-cli REPLICATION STATUS',
        'redis-cli INFO replication',
        'redis-cli REPLICA LIST',
        'redis-cli CONFIG GET replication-lag'
      ],
      correct: 1,
      explanation: 'redis-cli INFO replication shows: role (master/slave), connected_slaves, slave0/slave1 with IP, port and offset (lag in bytes). The primary\'s offset minus the replica\'s offset indicates replication lag — high lag indicates network issues or an overloaded primary.',
      reference: 'Commands: redis-cli INFO — "Redis Operations" section in theory.'
    }
  ],

  flashcards: [
    {
      front: 'What are the 3 Redis deployment modes in Kubernetes?',
      back: 'Standalone:\n- 1 pod, no HA\n- For dev, ephemeral caching\n- No replica, no Sentinel\n\nSentinel (HA without sharding):\n- Primary + N replicas + Sentinels\n- Automatic failover via voting\n- Minimum quorum: 3 Sentinels (quorum=2)\n- Dataset in 1 primary (up to ~100GB)\n\nCluster Mode (HA with sharding):\n- Data in 16384 hash slots\n- Distributed across N shards\n- Each shard: primary + replicas\n- For datasets > 100GB or high throughput'
    },
    {
      front: 'What are the main Redis eviction policies?',
      back: 'allkeys-lru ← most used for cache\n- Removes ANY least recently used key\n- Good for: general cache, everything is regenerable\n\nvolatile-lru\n- Removes keys WITH TTL, LRU first\n- Good for: mix of cache (TTL) + persistent data (no TTL)\n\nallkeys-lfu\n- Removes least frequently used keys\n- Good for: well-defined hot/cold data\n\nnoeviction (default)\n- Returns ENOMEM error when full\n- Good for: session stores where loss is unacceptable\n\nConfigure:\nCONFIG SET maxmemory-policy allkeys-lru'
    },
    {
      front: 'What is the correct formula for configuring maxmemory in Redis?',
      back: 'maxmemory ≈ 80% of container limits.memory\n\nExample:\nlimits.memory: 512Mi\nmaxmemory 400mb  # 78% ← correct\n\nWhy not 100%?\n- Redis uses memory beyond data (process overhead)\n- At 100%, K8s cgroup kills the process (OOMKill)\n  BEFORE Redis tries to evict keys\n- At 80%, Redis evicts internally safely\n\nCheck current usage:\nredis-cli INFO memory | grep used_memory_human\n\nCheck current maxmemory:\nredis-cli CONFIG GET maxmemory'
    },
    {
      front: 'What are the 3 caching patterns and their differences?',
      back: 'Cache-Aside (Lazy Loading):\n- App checks cache → miss → fetch DB → save cache\n- Simple, cache only has what was used\n- Disadvantage: first request = slow (miss)\n\nWrite-Through:\n- Write goes to DB AND cache simultaneously\n- Cache always updated\n- Disadvantage: higher write latency\n\nWrite-Behind (Write-Back):\n- Write goes to cache → async to DB\n- Very fast writes\n- Disadvantage: data loss risk if cache fails before sync\n\nChoice: stateless cache → Cache-Aside; critical consistency → Write-Through'
    },
    {
      front: 'Why is PodDisruptionBudget important for Redis Sentinel?',
      back: 'Sentinel needs quorum for failover decisions.\n\nWithout PDB:\nkubectl drain node-1 → can remove 2 of 3 Sentinels\n→ Quorum lost (needs 2, only has 1)\n→ Failover IMPOSSIBLE if primary fails\n→ Redis without primary = unavailable\n\nWith PDB (minAvailable: 2 for 3 Sentinels):\nkubectl drain → BLOCKED if < 2 Sentinels would remain\n→ Quorum guaranteed\n\napiVersion: policy/v1\nkind: PodDisruptionBudget\nspec:\n  selector:\n    matchLabels:\n      app: redis\n  minAvailable: 2'
    },
    {
      front: 'How to install Redis with Sentinel HA via Helm?',
      back: 'helm repo add bitnami https://charts.bitnami.com/bitnami\nhelm repo update\n\nhelm install redis bitnami/redis \\\n  --namespace cache \\\n  --create-namespace \\\n  --set architecture=replication \\\n  --set sentinel.enabled=true \\\n  --set auth.password="RedisPass123" \\\n  --set replica.replicaCount=2 \\\n  --set master.persistence.size=8Gi \\\n  --set replica.persistence.size=8Gi\n\n# Verify\nkubectl get pods -n cache\n# redis-node-0 (primary), redis-node-1, redis-node-2\n\n# Password\nkubectl get secret redis -n cache \\\n  -o jsonpath=\'{.data.redis-password}\' | base64 -d'
    },
    {
      front: 'How to check Redis health and replication lag?',
      back: '# Replication info\nredis-cli -a \$PASS INFO replication\n# connected_slaves: N\n# slave0:ip=10.0.0.x,port=6379,state=online,offset=12345,lag=0\n\n# Memory\nredis-cli -a \$PASS INFO memory | grep -E "used_memory_human|maxmemory_human"\n\n# Evictions (should be 0 or low)\nredis-cli -a \$PASS INFO stats | grep evicted_keys\n\n# Slow log (last 10 slow queries)\nredis-cli -a \$PASS SLOWLOG GET 10\n\n# Connection count\nredis-cli -a \$PASS CLIENT LIST | wc -l\n\n# Keyspace (databases in use)\nredis-cli -a \$PASS INFO keyspace'
    },
    {
      front: 'What is the difference between AOF and RDB for Redis persistence?',
      back: 'RDB (Redis Database Backup):\n- Periodic snapshot of the entire dataset\n- Config: save 900 1 (snapshot if 1 key changed in 900s)\n- Fast recovery\n- Risk: loses data since last snapshot\n- Good for: backups, lower write overhead\n\nAOF (Append-Only File):\n- Log of every write operation\n- appendfsync always: max durability (slow)\n- appendfsync everysec: good balance (recommended)\n- appendfsync no: delegates to OS (fast, less safe)\n- Slower recovery (log replay)\n- Good for: session stores, critical data\n\nProduction: appendonly yes + appendfsync everysec'
    }
  ],

  lab: {
    scenario: 'The e-commerce application needs Redis for two purposes: session store (logged-in user data, 30min TTL) and product cache (catalog cache, 5min TTL). You must configure an HA Redis with Sentinel and correct policies.',
    objective: 'Deploy Redis with Sentinel HA, configure appropriate eviction policy, create access NetworkPolicy, and monitor with redis_exporter.',
    duration: '30-40 minutes',
    steps: [
      {
        title: 'Deploy Redis Sentinel with Helm',
        instruction: `Deploy Redis with replication architecture and Sentinel using Bitnami's Helm chart in the \`cache\` namespace.

Configure:
- 1 master + 2 replicas
- Sentinel enabled
- 5Gi persistence per node
- Password via Secret`,
        hints: [
          'bitnami/redis with architecture=replication enables primary+replicas',
          'sentinel.enabled=true adds Sentinel as a sidecar process',
          'Password goes to an automatic Secret named "redis"',
          'Pods are created as StatefulSet with volumeClaimTemplates'
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
  --set master.resources.requests.memory=256Mi \\
  --set master.resources.limits.memory=512Mi

kubectl wait --for=condition=ready pod \\
  -l app.kubernetes.io/name=redis \\
  -n cache --timeout=120s
\`\`\``,
        verify: `\`\`\`bash
kubectl get pods -n cache
# Expected: 3 redis-node-X Running

REDIS_PASS=\$(kubectl get secret redis -n cache \\
  -o jsonpath='{.data.redis-password}' | base64 -d)

kubectl exec -n cache redis-node-0 -- \\
  redis-cli -a "\$REDIS_PASS" PING
# Expected: PONG

kubectl exec -n cache redis-node-0 -- \\
  redis-cli -a "\$REDIS_PASS" INFO replication | grep -E "role|connected_slaves"
# Expected: role:master, connected_slaves:2
\`\`\``
      },
      {
        title: 'Configure Eviction Policy and Test Caching',
        instruction: `Configure the appropriate eviction policy for the use case (session store with TTL):
1. Check current eviction policy
2. Change to \`volatile-lru\` (removes keys with TTL, LRU first)
3. Set maxmemory to 80% of container limit
4. Insert test data with and without TTL to verify behavior`,
        hints: [
          'volatile-lru preserves keys without TTL (persistent data) and evicts only keys with TTL',
          'CONFIG SET changes settings at runtime without restart',
          'For session store: SETEX key TTL value',
          'Data without TTL (like configs) will not be evicted'
        ],
        solution: `\`\`\`bash
REDIS_PASS=\$(kubectl get secret redis -n cache \\
  -o jsonpath='{.data.redis-password}' | base64 -d)

kubectl exec -n cache redis-node-0 -- \\
  redis-cli -a "\$REDIS_PASS" CONFIG SET maxmemory-policy volatile-lru

kubectl exec -n cache redis-node-0 -- \\
  redis-cli -a "\$REDIS_PASS" CONFIG SET maxmemory 400mb

# Session (30min TTL)
kubectl exec -n cache redis-node-0 -- \\
  redis-cli -a "\$REDIS_PASS" SETEX "session:user:123" 1800 '{"userId":123}'

# Product cache (5min TTL)
kubectl exec -n cache redis-node-0 -- \\
  redis-cli -a "\$REDIS_PASS" SETEX "product:456" 300 '{"name":"Widget"}'

# Config (no TTL — will not be evicted)
kubectl exec -n cache redis-node-0 -- \\
  redis-cli -a "\$REDIS_PASS" SET "config:featureFlags" '{"newUI":true}'
\`\`\``,
        verify: `\`\`\`bash
REDIS_PASS=\$(kubectl get secret redis -n cache \\
  -o jsonpath='{.data.redis-password}' | base64 -d)

kubectl exec -n cache redis-node-0 -- \\
  redis-cli -a "\$REDIS_PASS" CONFIG GET maxmemory-policy
# Expected: volatile-lru

kubectl exec -n cache redis-node-0 -- \\
  redis-cli -a "\$REDIS_PASS" TTL "session:user:123"
# Expected: value between 1 and 1800

kubectl exec -n cache redis-node-0 -- \\
  redis-cli -a "\$REDIS_PASS" TTL "config:featureFlags"
# Expected: -1 (no TTL)
\`\`\``
      },
      {
        title: 'Create NetworkPolicy and Test Sentinel Failover',
        instruction: `1. Create a NetworkPolicy allowing Redis access only from namespace \`backend\`
2. Create a PodDisruptionBudget for Redis (minAvailable: 2)
3. Simulate a failover by deleting the master pod and observe Sentinel electing a new primary
4. Verify data persists after failover`,
        hints: [
          'Redis Sentinel operates on port 6379 (Redis) and 26379 (Sentinel)',
          'After deleting master, wait 10-15s for Sentinel election',
          'The new primary will be one of redis-node-1 or redis-node-2',
          'Data inserted in the previous step should persist'
        ],
        solution: `\`\`\`bash
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
          port: 26379
---
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

# Delete master to test failover
kubectl delete pod redis-node-0 -n cache
sleep 20

REDIS_PASS=\$(kubectl get secret redis -n cache \\
  -o jsonpath='{.data.redis-password}' | base64 -d)

kubectl exec -n cache redis-node-1 -- \\
  redis-cli -a "\$REDIS_PASS" GET "config:featureFlags"
\`\`\``,
        verify: `\`\`\`bash
kubectl get pdb redis-pdb -n cache
# Expected: redis-pdb   2   1   3   Xs

REDIS_PASS=\$(kubectl get secret redis -n cache \\
  -o jsonpath='{.data.redis-password}' | base64 -d)

kubectl exec -n cache redis-node-1 -- \\
  redis-cli -a "\$REDIS_PASS" INFO replication | grep "role:"
# Expected: role:master (failover occurred)

kubectl exec -n cache redis-node-1 -- \\
  redis-cli -a "\$REDIS_PASS" GET "config:featureFlags" 2>/dev/null
# Expected: {"newUI":true} (data persisted)
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Redis with frequent OOMKill',
      difficulty: 'easy',
      symptom: 'The Redis pod restarts with OOMKilled several times a day. Logs show Redis was processing normally before being terminated. kubectl describe pod shows "OOMKilled" in status.',
      diagnosis: `\`\`\`bash
kubectl describe pod redis-node-0 -n cache | grep -A5 "OOMKilled"
kubectl top pod redis-node-0 -n cache
kubectl exec -n cache redis-node-0 -- \\
  redis-cli -a \$REDIS_PASS CONFIG GET maxmemory
kubectl exec -n cache redis-node-0 -- \\
  redis-cli -a \$REDIS_PASS INFO stats | grep evicted_keys
kubectl get pod redis-node-0 -n cache -o json | \\
  jq '.spec.containers[0].resources'
\`\`\``,
      solution: `**Cause 1**: maxmemory not set or equal to container limit.
\`\`\`bash
# Set maxmemory to 80% of limit (400mb for 512Mi)
kubectl exec -n cache redis-node-0 -- \\
  redis-cli -a \$REDIS_PASS CONFIG SET maxmemory 400mb

kubectl exec -n cache redis-node-0 -- \\
  redis-cli -a \$REDIS_PASS CONFIG SET maxmemory-policy allkeys-lru
\`\`\`

**Cause 2**: Memory leak — app inserting data without TTL.
\`\`\`bash
kubectl exec -n cache redis-node-0 -- \\
  redis-cli -a \$REDIS_PASS INFO keyspace
# If many keys in db0 without TTL: check app code
\`\`\``
    },
    {
      title: 'Sentinel not electing new primary — Redis unavailable after failure',
      difficulty: 'hard',
      symptom: 'The redis-master pod crashed and never came back. Sentinels are running but not electing a new primary. The application returns "READONLY You can\'t write against a read only replica" for writes.',
      diagnosis: `\`\`\`bash
kubectl exec -n cache redis-node-1 -- \\
  redis-cli -p 26379 SENTINEL masters

kubectl exec -n cache redis-node-1 -- \\
  redis-cli -p 26379 SENTINEL sentinels mymaster

kubectl logs -n cache redis-node-1 | grep -i "sentinel\\|failover\\|elect"
\`\`\``,
      solution: `**Cause 1**: Quorum not reached — Sentinels can't see each other.
\`\`\`bash
# Check if Sentinels can communicate
kubectl exec -n cache redis-node-1 -- \\
  redis-cli -p 26379 SENTINEL sentinels mymaster
# If fewer than 2 Sentinels returned: network issue
# Check NetworkPolicy blocking port 26379 between pods
\`\`\`

**Force manual failover (emergency)**:
\`\`\`bash
kubectl exec -n cache redis-node-1 -- \\
  redis-cli -p 26379 SENTINEL failover mymaster
# Forces immediate election even without quorum
\`\`\``
    }
  ]
};
