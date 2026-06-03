window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['databases-k8s/postgresql-k8s'] = {
  theory: `# PostgreSQL on Kubernetes with CloudNativePG

## Exam Relevance
> PostgreSQL on Kubernetes is covered in KubeAstronaut with focus on the CloudNativePG (CNPG) operator: HA clusters, S3 backup, automatic failover, connection pooling with PgBouncer.

## Core Concepts

### CloudNativePG (CNPG) — The Reference Operator
CloudNativePG is the PostgreSQL operator recommended by the CNCF. It manages:
- **HA PostgreSQL Cluster** (primary + streaming replicas)
- **Automatic failover** with new primary election
- **Continuous backup** (WAL streaming to S3/GCS/Azure)
- **Point-In-Time Recovery** (PITR)
- **Connection pooling** with integrated PgBouncer
- **Rolling upgrades** without downtime

### CNPG Cluster Architecture

\`\`\`
┌──────────────────────────────────────────────────────┐
│               CloudNativePG Cluster                   │
│                                                       │
│  ┌───────────┐    WAL     ┌───────────┐             │
│  │ Primary   │ ─────────→ │ Replica 1 │ (read-only) │
│  │ (pod 1)   │ streaming  └───────────┘             │
│  └─────┬─────┘ ─────────→ ┌───────────┐             │
│        │       replication │ Replica 2 │ (read-only) │
│        ↓                   └───────────┘             │
│  ┌───────────┐                                       │
│  │  Barman   │ → S3 Backup (WAL Archive + Base)      │
│  │  Sidecar  │   Point-In-Time Recovery              │
│  └───────────┘                                       │
│                                                       │
│  Services:                                            │
│  -rw  → primary (read+write)                         │
│  -ro  → any replica (read-only)                      │
│  -r   → round-robin all instances                    │
└──────────────────────────────────────────────────────┘
\`\`\`

### CNPG Cluster Resources

CNPG automatically creates:
- **Pods**: each instance is a pod with dedicated PVC
- **Services**: \`cluster-rw\` (primary), \`cluster-ro\` (replicas), \`cluster-r\` (round-robin)
- **Secrets**: superuser, replication user, app user credentials
- **PVCs**: one per instance with the configured StorageClass

### Automatic Failover
\`\`\`
Failover Scenario:
1. Primary (pod-1) fails or becomes unavailable
2. CNPG operator detects after N seconds
3. Elects most up-to-date replica as new primary
4. Updates -rw Service to point to new primary
5. Old primary becomes new replica when it returns
\`\`\`

### PgBouncer — Connection Pooling

\`\`\`
Without PgBouncer:
App → direct connection → PostgreSQL
Problem: PostgreSQL supports ~100-300 simultaneous connections

With PgBouncer:
App → PgBouncer (pool) → PostgreSQL
Benefit: 1000+ app connections → pool of 50-100 to Postgres
\`\`\`

PgBouncer modes:
- \`transaction\`: pool per transaction (recommended for stateless apps)
- \`session\`: pool per session (compatible with prepared statements)
- \`statement\`: pool per statement (most restrictive)

## Essential Commands

### Install CNPG Operator
\`\`\`bash
# Via Helm
helm repo add cnpg https://cloudnative-pg.github.io/charts
helm repo update

helm install cnpg cnpg/cloudnative-pg \\
  --namespace cnpg-system \\
  --create-namespace

kubectl wait --for=condition=ready pod \\
  -l app.kubernetes.io/name=cloudnative-pg \\
  -n cnpg-system --timeout=120s

# Verify CRDs installed
kubectl get crd | grep postgresql
\`\`\`

### Manage CNPG Clusters
\`\`\`bash
# List clusters
kubectl get clusters -n database
kubectl get cluster -n database -o wide

# View detailed status
kubectl describe cluster my-cluster -n database

# View cluster pods
kubectl get pods -n database -l cnpg.io/cluster=my-cluster

# View created services
kubectl get svc -n database -l cnpg.io/cluster=my-cluster
# cluster-rw (primary), cluster-ro (replicas), cluster-r (all)

# Connect to primary
kubectl exec -n database -it my-cluster-1 -- psql -U postgres

# kubectl plugin (install separately)
kubectl cnpg status my-cluster -n database
kubectl cnpg promote my-cluster my-cluster-2 -n database
kubectl cnpg backup my-cluster -n database
\`\`\`

### Manage Backups
\`\`\`bash
# Create manual backup
kubectl apply -f - <<EOF
apiVersion: postgresql.cnpg.io/v1
kind: Backup
metadata:
  name: my-backup-$(date +%Y%m%d)
  namespace: database
spec:
  cluster:
    name: my-cluster
  method: barmanObjectStore
EOF

# List backups
kubectl get backups -n database

# View ScheduledBackups
kubectl get scheduledbackups -n database
\`\`\`

## YAML Examples

### Basic CNPG Cluster (3 instances with S3 backup)
\`\`\`yaml
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: pg-production
  namespace: database
spec:
  instances: 3
  imageName: ghcr.io/cloudnative-pg/postgresql:16.2

  storage:
    size: 50Gi
    storageClass: fast-ssd

  resources:
    requests:
      cpu: 500m
      memory: 1Gi
    limits:
      cpu: "2"
      memory: 4Gi

  superuserSecret:
    name: pg-superuser-secret

  bootstrap:
    initdb:
      database: appdb
      owner: appuser
      secret:
        name: pg-appuser-secret

  backup:
    barmanObjectStore:
      destinationPath: "s3://my-postgres-backups/pg-production"
      s3Credentials:
        accessKeyId:
          name: s3-creds
          key: ACCESS_KEY_ID
        secretAccessKey:
          name: s3-creds
          key: SECRET_ACCESS_KEY
      wal:
        compression: gzip
        maxParallel: 8
      data:
        compression: bzip2
        encryption: AES256
    retentionPolicy: "30d"

  primaryUpdateStrategy: unsupervised

  affinity:
    enablePodAntiAffinity: true
    topologyKey: kubernetes.io/hostname
    podAntiAffinityType: required
\`\`\`

### ScheduledBackup (Automatic Backup)
\`\`\`yaml
apiVersion: postgresql.cnpg.io/v1
kind: ScheduledBackup
metadata:
  name: pg-daily-backup
  namespace: database
spec:
  schedule: "0 2 * * *"
  backupOwnerReference: self
  cluster:
    name: pg-production
  method: barmanObjectStore
  target: prefer-standby
\`\`\`

### PgBouncer Pooler
\`\`\`yaml
apiVersion: postgresql.cnpg.io/v1
kind: Pooler
metadata:
  name: pg-pooler-rw
  namespace: database
spec:
  cluster:
    name: pg-production
  instances: 2
  type: rw
  pgbouncer:
    poolMode: transaction
    parameters:
      max_client_conn: "1000"
      default_pool_size: "50"
      reserve_pool_size: "10"
      server_idle_timeout: "600"
  template:
    spec:
      resources:
        requests:
          cpu: 100m
          memory: 128Mi
        limits:
          cpu: 500m
          memory: 256Mi
\`\`\`

### PITR Restore (Point-In-Time Recovery)
\`\`\`yaml
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: pg-restored
  namespace: database
spec:
  instances: 3
  storage:
    size: 50Gi
    storageClass: fast-ssd

  bootstrap:
    recovery:
      source: pg-production
      recoveryTarget:
        targetTime: "2024-01-15 14:30:00"

  externalClusters:
    - name: pg-production
      barmanObjectStore:
        destinationPath: "s3://my-postgres-backups/pg-production"
        s3Credentials:
          accessKeyId:
            name: s3-creds
            key: ACCESS_KEY_ID
          secretAccessKey:
            name: s3-creds
            key: SECRET_ACCESS_KEY
\`\`\`

## Common Mistakes

### 1. Cluster stuck in "Setting up primary"
**Fix**: \`kubectl describe cluster my-cluster\` for events — usually PVC or secret issue.

### 2. S3 backup failing due to permissions
**Fix**: Verify IAM permissions: s3:PutObject, s3:GetObject, s3:DeleteObject on bucket.

### 3. Slow failover (more than 60s)
**Fix**: Adjust \`spec.failoverDelay\` and verify readiness probes.

### 4. PgBouncer rejecting connections
**Fix**: Check \`log_connections\` in PgBouncer and increase max_client_conn limits.

## Killer.sh Style Challenge

**Context**: The production PostgreSQL cluster had an accident — a developer accidentally ran DROP TABLE payments at 14:25. You have continuous S3 backups via WAL streaming. You need to:
1. Create a recovery cluster restoring to 14:24 (1 minute before the accident)
2. Verify the payments table exists in the restored cluster
3. Dump the table and import it into the production cluster
4. Verify the service is operational`,

  quiz: [
    {
      question: 'Which CloudNativePG service should be used for writes (INSERT, UPDATE, DELETE)?',
      options: [
        'cluster-r (round-robin)',
        'cluster-ro (read-only replicas)',
        'cluster-rw (primary)',
        'cluster-any (any instance)'
      ],
      correct: 2,
      explanation: 'The cluster-rw service always points to the primary — the only instance accepting writes. During failover, CNPG automatically updates this service endpoint to the newly elected primary. cluster-ro distributes reads among replicas; cluster-r includes the primary in round-robin.',
      reference: 'Architecture: CNPG Services — architecture section in theory.'
    },
    {
      question: 'What is Point-In-Time Recovery (PITR) in CNPG?',
      options: [
        'A snapshot backup capturing the database state at a specific moment',
        'The ability to restore the database to any point in time using WAL archive',
        'A feature that pauses the database at a specific point for maintenance',
        'A type of replica that maintains historical data for past queries'
      ],
      correct: 1,
      explanation: 'PITR uses the WAL (Write-Ahead Log) archive continuously stored in S3. To restore to a point in time: applies a base backup then replays WAL files up to the desired moment (targetTime, targetLSN, or targetName). Allows undoing accidental operations with second-level granularity.',
      reference: 'Concept: PITR — "PITR Restore" YAML in theory.'
    },
    {
      question: 'What is the main advantage of PgBouncer in "transaction" mode vs "session"?',
      options: [
        'Transaction mode is faster because it skips authentication',
        'Transaction mode allows far more app connections with fewer PostgreSQL connections',
        'Transaction mode supports prepared statements that session mode doesn\'t',
        'Transaction mode automatically replicates data between instances'
      ],
      correct: 1,
      explanation: 'In transaction mode, a pool connection is used only during a transaction and immediately returned. This allows 1000 app clients to share 50 real Postgres connections, since connections are free between transactions. Session mode holds the connection for the client session lifetime.',
      reference: 'Concept: PgBouncer — "PgBouncer — Connection Pooling" section in theory.'
    },
    {
      question: 'Which kubectl cnpg plugin command forces a replica promotion to primary?',
      options: [
        'kubectl cnpg switchover my-cluster -n database',
        'kubectl cnpg promote my-cluster my-cluster-2 -n database',
        'kubectl cnpg failover my-cluster primary -n database',
        'kubectl cnpg election my-cluster --promote-pod=my-cluster-2'
      ],
      correct: 1,
      explanation: 'kubectl cnpg promote does a controlled switchover, promoting a specific replica (my-cluster-2) to primary. The current primary is demoted to replica. This is different from automatic failover (which is reactive to failures) — promote is a controlled operation.',
      reference: 'Commands: kubectl cnpg promote — "Manage CNPG Clusters" section in theory.'
    },
    {
      question: 'In a ScheduledBackup, what does "target: prefer-standby" do?',
      options: [
        'Performs backup only if a replica is available',
        'Prefers to backup a replica to avoid impacting the production primary',
        'Schedules backup only during standby period (low usage)',
        'Creates a standby cluster as the backup destination'
      ],
      correct: 1,
      explanation: 'target: prefer-standby instructs CNPG to perform backup on a replica (standby) when available, rather than the primary. This reduces backup I/O impact on the production primary, keeping write latency low during the backup process.',
      reference: 'YAML: ScheduledBackup — example in theory.'
    },
    {
      question: 'How many minimum instances are needed for real HA (tolerating 1 instance failure) in CNPG?',
      options: [
        '1 instance (primary)',
        '2 instances (primary + 1 replica)',
        '3 instances (primary + 2 replicas)',
        '5 instances for adequate quorum'
      ],
      correct: 2,
      explanation: '3 instances is the minimum for real HA: 1 primary + 2 replicas. With 2 instances, if the primary fails, 1 replica can become primary but you\'re without HA until the original primary returns. With 3, one failure still leaves 1 primary + 1 replica (HA maintained).',
      reference: 'Architecture: CNPG — YAML example with instances: 3 in theory.'
    },
    {
      question: 'What does "primaryUpdateStrategy: unsupervised" configure in a CNPG Cluster?',
      options: [
        'Allows any replica to become primary without authorization',
        'The operator performs failover/switchover automatically without human intervention',
        'The primary can update its image without notifying replicas',
        'Disables all primary health checks'
      ],
      correct: 1,
      explanation: 'primaryUpdateStrategy: unsupervised allows the CNPG operator to perform updates and switchovers automatically without waiting for manual approval. It\'s required for rolling upgrades without downtime. The "supervised" alternative requires manual confirmation for each switchover.',
      reference: 'Config: primaryUpdateStrategy — Cluster YAML in theory.'
    },
    {
      question: 'Why does CNPG use affinity with topologyKey: kubernetes.io/hostname?',
      options: [
        'To ensure all pods run on the same node to reduce latency',
        'To distribute pods across different nodes, avoiding single point of failure',
        'To associate pods with the external database hostname',
        'To have Kubernetes automatically select SSD nodes'
      ],
      correct: 1,
      explanation: 'Pod anti-affinity with topologyKey: kubernetes.io/hostname ensures each PostgreSQL cluster pod runs on a different node. If a node fails, only 1 instance is affected — the others remain up. Without this, all instances might be on the same node and a failure takes everything down.',
      reference: 'Config: affinity — Cluster YAML in theory.'
    }
  ],

  flashcards: [
    {
      front: 'What services does CNPG create and what does each one do?',
      back: 'cluster-rw (read-write):\n- Points to PRIMARY\n- Accepts reads + writes\n- Auto-updated during failover\n- Use for: INSERT, UPDATE, DELETE, DDL\n\ncluster-ro (read-only):\n- Round-robin among REPLICAS\n- Read-only\n- Use for: analytics queries, reports\n\ncluster-r (read):\n- Round-robin across ALL instances\n- Includes primary and replicas\n- Use for: non-critical reads\n\nConnection: host=my-cluster-rw port=5432 dbname=appdb user=appuser'
    },
    {
      front: 'What is PITR and how does it work in CNPG?',
      back: 'PITR = Point-In-Time Recovery\n\nHow it works:\n1. Base backup stored in S3 (full backup)\n2. Continuous WAL archive in S3 (delta of each transaction)\n3. To restore to T:\n   - Apply most recent base backup before T\n   - Replay WAL files up to exactly T\n\nUsage in CNPG:\nbootstrap:\n  recovery:\n    source: source-cluster\n    recoveryTarget:\n      targetTime: "2024-01-15 14:24:00"\n\nUse cases:\n- Accidental DROP TABLE\n- Data corruption from a bug\n- Historical audit'
    },
    {
      front: 'How to install and use the kubectl cnpg plugin?',
      back: '# Install plugin\nkubectl krew install cnpg\n\n# Key commands\nkubectl cnpg status my-cluster -n database\n# Status, replicas, lag, backup status\n\nkubectl cnpg promote my-cluster my-cluster-2 -n database\n# Manual switchover to my-cluster-2\n\nkubectl cnpg backup my-cluster -n database\n# Trigger manual backup\n\nkubectl cnpg logs cluster my-cluster -n database\n# View logs from all instances'
    },
    {
      front: 'What are PgBouncer modes and when to use each?',
      back: 'transaction (recommended):\n- Pool freed after each transaction\n- High density: 1000 clients → 50 connections\n- Limitation: no prepared statements across transactions\n\nsession:\n- Pool per full session\n- Same connection until client disconnects\n- Supports prepared statements, advisory locks\n- Lower density than transaction\n\nstatement:\n- Pool per individual statement\n- Very restrictive — avoid\n\nGeneral recommendation:\n- Stateless REST APIs → transaction mode\n- Apps with prepared statements → session mode'
    },
    {
      front: 'How to configure automatic backup in CNPG?',
      back: 'ScheduledBackup CRD:\n\napiVersion: postgresql.cnpg.io/v1\nkind: ScheduledBackup\nmetadata:\n  name: pg-daily-backup\nspec:\n  schedule: "0 2 * * *"  # daily at 2am\n  cluster:\n    name: pg-production\n  target: prefer-standby  # no primary impact\n  method: barmanObjectStore\n\n# Retention (in Cluster spec):\nbackup:\n  retentionPolicy: "30d"  # keep 30 days\n\n# Check backups:\nkubectl get backups -n database\nkubectl get scheduledbackups -n database'
    },
    {
      front: 'How does automatic failover work in CNPG?',
      back: 'Failover Process:\n1. Primary becomes unavailable (crash, OOMKill, node down)\n2. CNPG operator detects via health checks\n3. Checks which replica has most advanced LSN\n4. Promotes that replica to primary\n5. Updates -rw Service to point to new primary\n6. Other replicas reconnect to new primary\n7. When original pod returns → reconfigured as replica\n\nTypical time: 10-30 seconds\n\nTo control:\n  spec.failoverDelay: 10s\n  spec.primaryUpdateStrategy: unsupervised'
    },
    {
      front: 'How to configure CNPG backup for AWS S3?',
      back: '# 1. Create Secret with credentials\nkubectl create secret generic s3-creds \\\n  -n database \\\n  --from-literal=ACCESS_KEY_ID=xxx \\\n  --from-literal=SECRET_ACCESS_KEY=yyy\n\n# 2. In Cluster spec:\nbackup:\n  barmanObjectStore:\n    destinationPath: "s3://bucket/path"\n    s3Credentials:\n      accessKeyId:\n        name: s3-creds\n        key: ACCESS_KEY_ID\n      secretAccessKey:\n        name: s3-creds\n        key: SECRET_ACCESS_KEY\n    wal:\n      compression: gzip\n    data:\n      compression: bzip2\n      encryption: AES256\n  retentionPolicy: "30d"\n\n# With IRSA (recommended for EKS):\n# Add annotation to pod SA:\n# eks.amazonaws.com/role-arn: arn:aws:iam::123:role/pg-backup'
    },
    {
      front: 'Why use a minimum of 3 instances in CNPG for HA?',
      back: 'Comparison:\n\n1 instance:\n- No HA (SPOF)\n- Dev/test only\n\n2 instances (primary + 1 replica):\n- Failover possible, BUT:\n- After primary failure: 1 replica becomes primary\n- No read replica until original primary returns\n- No HA during recovery\n\n3 instances (primary + 2 replicas):\n- After any 1 failure: still 1 primary + 1 replica\n- HA maintained during recovery\n- 1 replica available for reads\n\n5 instances:\n- Tolerates 2 simultaneous failures\n- For critical databases with ~0 RTO'
    }
  ],

  lab: {
    scenario: 'You need to configure a production PostgreSQL with HA for the e-commerce application. The database should have 3 instances, automatic daily backup, and connection pooling via PgBouncer to support 500+ simultaneous connections.',
    objective: 'Install the CloudNativePG operator, create a 3-instance HA PostgreSQL cluster, configure PgBouncer, and test automatic failover.',
    duration: '40-50 minutes',
    steps: [
      {
        title: 'Install the CloudNativePG Operator',
        instruction: `Install the CloudNativePG operator via Helm in the \`cnpg-system\` namespace and verify CRDs were created correctly.

After installation, verify the operator is Running and CNPG CRDs are available in the cluster.`,
        hints: [
          'The Helm repository is cnpg/cloudnative-pg',
          'CRDs include: clusters, backups, scheduledbackups, poolers',
          'The operator needs cluster-wide permissions to manage resources'
        ],
        solution: `\`\`\`bash
helm repo add cnpg https://cloudnative-pg.github.io/charts
helm repo update

helm install cnpg cnpg/cloudnative-pg \\
  --namespace cnpg-system \\
  --create-namespace

kubectl wait --for=condition=ready pod \\
  -l app.kubernetes.io/name=cloudnative-pg \\
  -n cnpg-system --timeout=120s

kubectl create namespace database

kubectl create secret generic pg-superuser-secret \\
  -n database \\
  --from-literal=username=postgres \\
  --from-literal=password="SuperSecure123!"

kubectl create secret generic pg-appuser-secret \\
  -n database \\
  --from-literal=username=appuser \\
  --from-literal=password="AppUserPass123!"
\`\`\``,
        verify: `\`\`\`bash
kubectl get pods -n cnpg-system
# Expected: cnpg-xxx   1/1   Running

kubectl get crd | grep postgresql.cnpg.io
# Expected: backups, clusters, poolers, scheduledbackups CRDs
\`\`\``
      },
      {
        title: 'Create HA PostgreSQL Cluster with 3 Instances',
        instruction: `Create a CNPG Cluster with 3 instances, configuring:
- 3 instances (1 primary + 2 replicas)
- 5Gi storage per instance (use available StorageClass)
- Anti-affinity to distribute across different nodes (preferred)
- Adequate resources
- App database "ecommerce" with "appuser"`,
        hints: [
          'Use storageClass: standard or whatever is available in your cluster',
          'enablePodAntiAffinity: true distributes pods across nodes',
          'The operator will automatically create -rw, -ro, -r services'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: pg-ecommerce
  namespace: database
spec:
  instances: 3
  storage:
    size: 5Gi
    storageClass: standard
  resources:
    requests:
      cpu: 250m
      memory: 512Mi
    limits:
      cpu: "1"
      memory: 1Gi
  superuserSecret:
    name: pg-superuser-secret
  bootstrap:
    initdb:
      database: ecommerce
      owner: appuser
      secret:
        name: pg-appuser-secret
  affinity:
    enablePodAntiAffinity: true
    topologyKey: kubernetes.io/hostname
    podAntiAffinityType: preferred
  primaryUpdateStrategy: unsupervised
EOF

kubectl wait --for=condition=ready cluster pg-ecommerce \\
  -n database --timeout=180s
\`\`\``,
        verify: `\`\`\`bash
kubectl get cluster pg-ecommerce -n database
# Expected: pg-ecommerce   3   Ready

kubectl get svc -n database -l cnpg.io/cluster=pg-ecommerce
# Expected: pg-ecommerce-rw, pg-ecommerce-ro, pg-ecommerce-r
\`\`\``
      },
      {
        title: 'Configure PgBouncer and Test Failover',
        instruction: `1. Create a Pooler (PgBouncer) in transaction mode for the primary
2. Verify PgBouncer accepts connections
3. Delete the primary pod and observe automatic failover
4. Verify the -rw service points to the new primary after failover`,
        hints: [
          'Pooler type rw connects to the -rw service automatically',
          'After deleting primary, wait 15-30 seconds for failover',
          'The new primary will be the pod with highest LSN among replicas',
          'pg_is_in_recovery() returns false on primary, true on replicas'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: postgresql.cnpg.io/v1
kind: Pooler
metadata:
  name: pg-pooler-rw
  namespace: database
spec:
  cluster:
    name: pg-ecommerce
  instances: 2
  type: rw
  pgbouncer:
    poolMode: transaction
    parameters:
      max_client_conn: "500"
      default_pool_size: "25"
  template:
    spec:
      resources:
        requests:
          cpu: 100m
          memory: 128Mi
EOF

# Insert test data
APP_PASS=\$(kubectl get secret pg-appuser-secret -n database \\
  -o jsonpath='{.data.password}' | base64 -d)
kubectl exec -n database pg-ecommerce-1 -- \\
  psql postgresql://appuser:\$APP_PASS@pg-ecommerce-rw/ecommerce \\
  -c "CREATE TABLE orders (id SERIAL PRIMARY KEY, product TEXT); INSERT INTO orders (product) VALUES ('Widget');"

# Delete primary to test failover
PRIMARY_POD=\$(kubectl get pods -n database \\
  -l "cnpg.io/cluster=pg-ecommerce,cnpg.io/instanceRole=primary" \\
  -o jsonpath='{.items[0].metadata.name}')
kubectl delete pod \$PRIMARY_POD -n database

sleep 30

# Verify data persisted after failover
kubectl exec -n database \\
  -l "cnpg.io/cluster=pg-ecommerce,cnpg.io/instanceRole=primary" -- \\
  psql postgresql://appuser:\$APP_PASS@pg-ecommerce-rw/ecommerce \\
  -c "SELECT * FROM orders;" 2>/dev/null
\`\`\``,
        verify: `\`\`\`bash
# Verify new primary elected
kubectl get pods -n database -l cnpg.io/cluster=pg-ecommerce \\
  -o json | jq -r '.items[] | {name: .metadata.name, role: .metadata.labels["cnpg.io/instanceRole"]}'
# Expected: 1 pod with role=primary, others replica

# Verify data persisted
kubectl describe cluster pg-ecommerce -n database | grep -A3 "Ready Instances"
# Expected: ReadyInstances: 3
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'CNPG Cluster stuck in "Setting up primary"',
      difficulty: 'medium',
      symptom: 'The CNPG Cluster was created but stays in "Setting up primary" state for more than 10 minutes. No instance becomes Running.',
      diagnosis: `\`\`\`bash
kubectl describe cluster my-cluster -n database | tail -30
kubectl get events -n database --sort-by=.lastTimestamp | tail -20
kubectl logs -n database my-cluster-1 -f
kubectl get pvc -n database
kubectl get storageclass
kubectl logs -n cnpg-system -l app.kubernetes.io/name=cloudnative-pg --tail=50 | grep -i "error\\|cluster"
\`\`\``,
      solution: `**Cause 1**: PVC in Pending — StorageClass without provisioner.
\`\`\`bash
kubectl describe pvc -n database | grep -A5 "Events:"
# If "no persistent volumes available": provisioner not installed
kubectl get storageclass  # use one with a working provisioner
\`\`\`

**Cause 2**: Secret not found or wrong key.
\`\`\`bash
kubectl get secret pg-superuser-secret -n database -o yaml
# CNPG expects keys: username and password
\`\`\`

**Cause 3**: Insufficient cluster resources.
\`\`\`bash
kubectl describe pod my-cluster-1 -n database | grep -A5 "Events:"
# If "Insufficient cpu/memory": reduce requests in Cluster spec
\`\`\``
    },
    {
      title: 'WAL backup failing — files not reaching S3',
      difficulty: 'hard',
      symptom: 'PostgreSQL cluster is running but WAL backups are not reaching the S3 bucket. LastSuccessfulBackup field in status has been empty for 24h.',
      diagnosis: `\`\`\`bash
kubectl describe cluster my-cluster -n database | grep -A10 "Backup"
kubectl logs -n database my-cluster-1 | grep -i "barman\\|wal\\|backup\\|s3"
kubectl get secret s3-creds -n database -o yaml
kubectl exec -n database my-cluster-1 -- \\
  bash -c 'aws s3 ls s3://my-bucket/path/ --region us-east-1' 2>&1
\`\`\``,
      solution: `**Cause 1**: Invalid S3 credentials or insufficient permissions.
\`\`\`bash
# Recreate Secret with correct credentials
kubectl create secret generic s3-creds \\
  -n database \\
  --from-literal=ACCESS_KEY_ID=CORRECT_KEY \\
  --from-literal=SECRET_ACCESS_KEY=CORRECT_SECRET \\
  --dry-run=client -o yaml | kubectl apply -f -

kubectl rollout restart statefulset my-cluster -n database
\`\`\`

**Cause 2**: Wrong destinationPath.
\`\`\`bash
# Path must include trailing /: s3://bucket/prefix/
kubectl edit cluster my-cluster -n database
# Fix: spec.backup.barmanObjectStore.destinationPath
\`\`\``
    }
  ]
};
