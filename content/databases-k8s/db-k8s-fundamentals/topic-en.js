window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['databases-k8s/db-k8s-fundamentals'] = {
  theory: `# Databases on Kubernetes — Fundamentals

## Exam Relevance
> Databases in Kubernetes covers StatefulSets, Persistent Volumes, Storage Classes, and database operators. It is an advanced KubeAstronaut topic focused on production environments.

## Core Concepts

### Stateless vs Stateful Workloads

\`\`\`
Deployment (Stateless):        StatefulSet (Stateful):
- Interchangeable pods          - Pods with stable identity
- pod-abc123, pod-def456        - mysql-0, mysql-1, mysql-2
- No own storage                - Dedicated PVC per pod
- Free scale up/down            - Scale follows order (0,1,2...)
- Restart = any node            - Restart = same name + PVC
\`\`\`

### Why StatefulSet for Databases?

**Stable identity**: The \`mysql-0\` pod always keeps the name \`mysql-0\` even after restart. Crucial for replication (fixed primary, replicas connect to the primary).

**Dedicated PVC**: Each pod has its own PersistentVolumeClaim (volumeClaimTemplates). The PVC survives even if the pod dies — data is not lost.

**Headless Service**: Each pod gets an individual DNS entry:
\`\`\`
mysql-0.mysql-headless.namespace.svc.cluster.local
mysql-1.mysql-headless.namespace.svc.cluster.local
mysql-2.mysql-headless.namespace.svc.cluster.local
\`\`\`

**Creation and deletion order**: Pods are created in order (0, 1, 2...) and deleted in reverse order (2, 1, 0). Ensures the primary is ready before replicas.

### Storage Classes for Databases

\`\`\`yaml
# High-performance Storage Class (NVMe SSDs)
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: pd.csi.storage.gke.io  # GKE
parameters:
  type: pd-ssd
  replication-type: none
reclaimPolicy: Retain      # IMPORTANT: Retain in production!
allowVolumeExpansion: true
volumeBindingMode: WaitForFirstConsumer
\`\`\`

**reclaimPolicy**:
- \`Retain\`: volume persists after PVC is deleted — for databases!
- \`Delete\`: volume deleted with PVC — only for ephemeral data

### Database Operators — The Cloud-Native Pattern

Operators are the recommended way to manage databases in Kubernetes:

\`\`\`
Without Operator:                With Operator:
- Manual backup                  - Automated backup
- Manual failover (hours)        - Automatic failover (seconds)
- Manual scale                   - Automated scale
- Manual upgrade (downtime)      - Rolling upgrade without downtime
- Manual config                  - Declarative config via CRD
\`\`\`

**Popular operators**:
| Database | Operator |
|----------|---------|
| PostgreSQL | CloudNativePG (CNPG), Zalando, Crunchy |
| MySQL | MySQL Operator, Vitess |
| MongoDB | MongoDB Community Operator |
| Redis | Redis Enterprise Operator, Redis Operator |
| Cassandra | K8ssandra, CassKop |
| Kafka | Strimzi Kafka Operator |

### HA Patterns for Databases

\`\`\`
Replication:
  Primary → Replica 1
           → Replica 2
           → Replica 3 (read-only)

Reads:  → any replica (via service with labelSelector)
Writes: → primary only (via headless DNS or dedicated service)
\`\`\`

### Backup and Restore in Kubernetes

**Strategies**:
1. **Volume Snapshots**: PV snapshot via CSI
2. **Logical backup**: pg_dump, mysqldump run as a Job
3. **Physical backup via sidecar**: Barman, Restic to S3
4. **Velero**: full K8s resource + PV backup

\`\`\`yaml
# Volume Snapshot (CSI)
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshot
metadata:
  name: mysql-snapshot-2024-01
spec:
  volumeSnapshotClassName: csi-aws-vsc
  source:
    persistentVolumeClaimName: data-mysql-0
\`\`\`

### Network Policies for Databases

\`\`\`yaml
# Only pods with label app=backend can access the DB
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: postgres-access-policy
  namespace: database
spec:
  podSelector:
    matchLabels:
      app: postgres
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
          port: 5432
\`\`\`

## Essential Commands

### StatefulSet Management
\`\`\`bash
# Create StatefulSet
kubectl apply -f statefulset.yaml

# View StatefulSet pods in order
kubectl get pods -l app=mysql -n database

# View PVCs created by volumeClaimTemplates
kubectl get pvc -n database

# Scale with order guarantee
kubectl scale statefulset mysql --replicas=3 -n database

# Restart a specific pod (will keep same PVC)
kubectl delete pod mysql-0 -n database

# View headless service DNS
kubectl run debug --image=busybox --rm -it -- \\
  nslookup mysql-0.mysql-headless.database.svc.cluster.local

# Update (rolling update following reverse order)
kubectl patch statefulset mysql -n database \\
  --type='json' \\
  -p='[{"op": "replace", "path": "/spec/template/spec/containers/0/image", "value":"mysql:8.1"}]'
\`\`\`

### Storage and Volumes
\`\`\`bash
# View available StorageClasses
kubectl get storageclass

# View PVs in cluster
kubectl get pv

# View PVCs and their PVs
kubectl get pvc --all-namespaces

# Expand PVC (if StorageClass supports it)
kubectl patch pvc data-mysql-0 -n database \\
  --type='json' \\
  -p='[{"op": "replace", "path": "/spec/resources/requests/storage", "value": "100Gi"}]'
\`\`\`

### Backup with Velero
\`\`\`bash
# Install Velero
velero install \\
  --provider aws \\
  --plugins velero/velero-plugin-for-aws:v1.9.0 \\
  --bucket my-backup-bucket \\
  --backup-location-config region=us-east-1 \\
  --snapshot-location-config region=us-east-1 \\
  --secret-file ./credentials-velero

# Backup complete namespace (includes PVs)
velero backup create db-backup-$(date +%Y%m%d) \\
  --include-namespaces database \\
  --snapshot-volumes=true

# View backups
velero backup get

# Restore
velero restore create --from-backup db-backup-20240115 \\
  --include-namespaces database
\`\`\`

## YAML Examples

### Complete StatefulSet with HA
\`\`\`yaml
apiVersion: v1
kind: Service
metadata:
  name: mysql-headless
  namespace: database
spec:
  clusterIP: None  # Headless!
  selector:
    app: mysql
  ports:
    - port: 3306

---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mysql
  namespace: database
spec:
  serviceName: mysql-headless
  replicas: 3
  selector:
    matchLabels:
      app: mysql
  template:
    metadata:
      labels:
        app: mysql
    spec:
      containers:
        - name: mysql
          image: mysql:8.0
          env:
            - name: MYSQL_ROOT_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: mysql-secret
                  key: root-password
          resources:
            requests:
              cpu: 500m
              memory: 1Gi
            limits:
              cpu: "2"
              memory: 4Gi
          livenessProbe:
            exec:
              command: ["mysqladmin", "ping", "-u", "root", "-p\$(MYSQL_ROOT_PASSWORD)"]
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            exec:
              command: ["mysql", "-u", "root", "-p\$(MYSQL_ROOT_PASSWORD)", "-e", "SELECT 1"]
            initialDelaySeconds: 5
            periodSeconds: 2
          volumeMounts:
            - name: data
              mountPath: /var/lib/mysql
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        storageClassName: fast-ssd
        resources:
          requests:
            storage: 50Gi
\`\`\`

### PodDisruptionBudget for Database
\`\`\`yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: mysql-pdb
  namespace: database
spec:
  selector:
    matchLabels:
      app: mysql
  minAvailable: 2
\`\`\`

## Common Mistakes

### 1. Using Deployment for databases
**Fix**: Always use StatefulSet for persistent stateful workloads.

### 2. reclaimPolicy: Delete on database PVCs
**Fix**: Create a dedicated StorageClass with \`reclaimPolicy: Retain\` for databases.

### 3. Scaling database without verifying replication
**Fix**: Use operators that automatically manage replication.

### 4. No PodDisruptionBudget
**Fix**: Set \`minAvailable: 1\` (or 2 for real HA) on all critical StatefulSets.

### 5. Liveness probe too aggressive
**Fix**: initialDelaySeconds ≥ 30s for heavy databases.

## Killer.sh Style Challenge

**Context**: You must migrate a PostgreSQL database from a Deployment to a StatefulSet with HA.

**Tasks**:
1. Create namespace \`database\` with adequate ResourceQuota
2. Create StorageClass \`database-storage\` with reclaimPolicy: Retain
3. Create StatefulSet \`postgres\` with 3 replicas and volumeClaimTemplates of 20Gi
4. Create Headless Service \`postgres-headless\`
5. Create PodDisruptionBudget ensuring minimum 2 pods always available
6. Verify each pod has its dedicated PVC`,

  quiz: [
    {
      question: 'What is the main advantage of using StatefulSet instead of Deployment for a database?',
      options: [
        'StatefulSet is more performant than Deployment for all workloads',
        'StatefulSet provides stable pod identity and dedicated PVCs per pod',
        'StatefulSet automatically configures database replication',
        'StatefulSet doesn\'t require a Service to expose the database externally'
      ],
      correct: 1,
      explanation: 'StatefulSet ensures each pod maintains stable identity (mysql-0, mysql-1...) that persists between restarts, and creates dedicated PVCs via volumeClaimTemplates — each pod has its own storage. This is essential for databases that need to know who the primary is and maintain data between restarts.',
      reference: 'Concept: StatefulSet — "Why StatefulSet for Databases?" section in theory.'
    },
    {
      question: 'What happens to database data if the StorageClass reclaimPolicy is "Delete"?',
      options: [
        'Data is moved to an automatic backup',
        'Data persists for 30 days before being deleted',
        'Data is permanently lost when the PVC is deleted',
        'Data is retained but the volume becomes inaccessible'
      ],
      correct: 2,
      explanation: 'With reclaimPolicy: Delete, when the PVC is deleted (e.g., scaling the StatefulSet to 0 or deleting the namespace), the PersistentVolume and all data are immediately destroyed. For production databases, always use reclaimPolicy: Retain.',
      reference: 'Config: reclaimPolicy — "Storage Classes for Databases" section in theory.'
    },
    {
      question: 'What is a Headless Service and why is it essential for StatefulSets?',
      options: [
        'A Service with no exposed port, used for security',
        'A Service with clusterIP: None that creates individual DNS entries for each pod',
        'An internal Service that blocks external traffic',
        'A Service that disables Kubernetes health checks'
      ],
      correct: 1,
      explanation: 'Headless Service (clusterIP: None) has no virtual IP — instead, it creates individual DNS records for each StatefulSet pod (mysql-0.mysql-headless.namespace.svc.cluster.local). This allows replicas to connect specifically to the primary (mysql-0) and the primary to know each replica\'s address.',
      reference: 'Concept: Headless Service — "Why StatefulSet for Databases?" section in theory.'
    },
    {
      question: 'What is the main advantage of using database operators vs managing StatefulSets manually?',
      options: [
        'Operators use less CPU and memory resources',
        'Operators automate failover, backup, and upgrades that would be manual and error-prone',
        'Operators eliminate the need for PersistentVolumes',
        'Operators are cheaper than managed cloud solutions'
      ],
      correct: 1,
      explanation: 'Operators encapsulate database operational knowledge (how to do safe failover, consistent backup, zero-downtime upgrade) in automated code. Without an operator, these tasks require manual scripts, specific knowledge, and are frequent sources of incidents.',
      reference: 'Concept: Operators — "Database Operators" section in theory.'
    },
    {
      question: 'What does the "volumeClaimTemplates" field in a StatefulSet do?',
      options: [
        'Defines a single shared PVC for all StatefulSet pods',
        'Creates a dedicated PVC for each StatefulSet pod automatically',
        'Configures temporary volumes (emptyDir) for each pod',
        'Defines a template for dynamically creating StorageClasses'
      ],
      correct: 1,
      explanation: 'volumeClaimTemplates instructs the StatefulSet to create an individual PVC for each pod. For a StatefulSet with 3 replicas and a "data" volumeClaimTemplate, it creates: data-mysql-0, data-mysql-1, data-mysql-2. Each PVC persists even if the pod is deleted and recreated.',
      reference: 'Config: volumeClaimTemplates — YAML example in theory.'
    },
    {
      question: 'Why is a PodDisruptionBudget critical for database StatefulSets?',
      options: [
        'PDB increases database performance during high load',
        'PDB prevents maintenance operations (node drain) from taking down all pods simultaneously',
        'PDB automatically does failover when a pod fails',
        'PDB is only for Deployments — StatefulSets have native protection'
      ],
      correct: 1,
      explanation: 'During node maintenance (kubectl drain), without PDB Kubernetes can shut down all StatefulSet pods at once — causing total downtime. With PDB minAvailable: 2 (in a cluster of 3), the drain is blocked if it would leave fewer than 2 pods available, ensuring continuity.',
      reference: 'Example: PodDisruptionBudget — YAML examples section in theory.'
    },
    {
      question: 'Which tool is recommended for complete database backup in Kubernetes (resources + persistent volumes)?',
      options: [
        'kubectl cp',
        'Velero',
        'kubectl backup',
        'PersistentVolume Migrator'
      ],
      correct: 1,
      explanation: 'Velero backs up complete Kubernetes resources (StatefulSet, ConfigMaps, Secrets) AND PersistentVolumes via CSI snapshots. It\'s the reference solution for disaster recovery in Kubernetes, supporting multiple cloud providers and storage backends.',
      reference: 'Backup: Velero — "Backup with Velero" in commands section.'
    },
    {
      question: 'When scaling a StatefulSet from 1 to 3 replicas without an operator, what problem may occur?',
      options: [
        'Kubernetes refuses to scale StatefulSets with more than 2 replicas',
        'New pods start with empty volumes without data from pod 0',
        'StatefulSet freezes because PVCs cannot be created during scaling',
        'No problem — StatefulSets manage replication automatically'
      ],
      correct: 1,
      explanation: 'Kubernetes correctly creates PVCs and pods, but doesn\'t configure data replication. The new pods (mysql-1, mysql-2) will have empty PVC volumes — without the data in mysql-0. This requires manual replication initialization or an operator that automatically clones data.',
      reference: 'Common mistakes: scaling without replication — "Common Mistakes" section in theory.'
    }
  ],

  flashcards: [
    {
      front: 'Why use StatefulSet instead of Deployment for databases?',
      back: 'StatefulSet provides 3 essential guarantees:\n\n1. Stable identity:\n   mysql-0, mysql-1, mysql-2 (even after restart)\n   → Primary is always mysql-0 (reliable replication)\n\n2. Dedicated PVCs via volumeClaimTemplates:\n   data-mysql-0, data-mysql-1, data-mysql-2\n   → Data persists even if pod dies\n\n3. Headless Service with individual DNS:\n   mysql-0.mysql-headless.ns.svc.cluster.local\n   → Replicas know where the primary is\n\nDeployment: interchangeable pods, no identity, shared PVCs → inadequate for DB'
    },
    {
      front: 'Which reclaimPolicy to use in StorageClass for databases?',
      back: 'ALWAYS use reclaimPolicy: Retain for databases!\n\nRetain:\n- PVC deleted → PV stays as "Released"\n- Data remains on disk\n- Administrator decides what to do\n- Requires manual reclaim to reuse\n\nDelete (AVOID for DBs):\n- PVC deleted → PV deleted immediately\n- Data PERMANENTLY lost\n- Default in many cloud StorageClasses\n\nConfiguration:\napiVersion: storage.k8s.io/v1\nkind: StorageClass\nreclaimPolicy: Retain  ← ESSENTIAL'
    },
    {
      front: 'What is a Headless Service and what role does it play in StatefulSet?',
      back: 'Headless Service: Service with clusterIP: None\n\nDifference:\n- Normal Service: single VIP (10.96.0.1)\n  → load balances to any pod\n\n- Headless: no VIP, creates individual DNS:\n  pod-0.svc-headless.ns.svc.cluster.local\n  pod-1.svc-headless.ns.svc.cluster.local\n\nWhy essential for DBs:\n- Replicas connect specifically to primary (pod-0)\n- Primary knows each replica\'s DNS\n- Without Headless = can\'t address individual pods\n\nspec:\n  clusterIP: None  ← headless'
    },
    {
      front: 'What are the most popular operators by database?',
      back: 'PostgreSQL:\n- CloudNativePG (CNPG) ← recommended\n- Zalando Postgres Operator\n- Crunchy Data PGO\n\nMySQL:\n- MySQL Operator for Kubernetes\n- Vitess (for sharding)\n\nMongoDB:\n- MongoDB Community Operator\n- Percona Operator for MongoDB\n\nRedis:\n- Redis Enterprise Operator\n- Redis Operator (Spotahome)\n\nKafka:\n- Strimzi Kafka Operator\n\nWhy use operators:\n→ Automatic failover, backup, rolling upgrades'
    },
    {
      front: 'Why is PodDisruptionBudget critical for database StatefulSets?',
      back: 'Without PDB:\nkubectl drain node-1  →  can kill ALL DB pods\n→ total downtime, quorum loss\n\nWith PDB (minAvailable: 2 for cluster of 3):\nkubectl drain node-1  →  BLOCKED if < 2 pods would remain\n→ drain waits for pod to migrate to another node first\n\nExample:\napiVersion: policy/v1\nkind: PodDisruptionBudget\nspec:\n  selector:\n    matchLabels:\n      app: postgres\n  minAvailable: 2  ← never fewer than 2 pods\n\nAlso protects against:\n- Cluster upgrades\n- Node repairs\n- Cluster Autoscaler scale-down'
    },
    {
      front: 'What are the backup strategies for databases in Kubernetes?',
      back: '1. Volume Snapshots (CSI):\n   - PV snapshot via K8s API\n   - Fast, consistent (with db quiescence)\n   - VolumeSnapshot CRD\n\n2. Logical backup (Job):\n   - pg_dump, mysqldump in CronJob\n   - Slow for large DBs\n   - Portable across versions\n\n3. Physical via sidecar:\n   - Barman (PostgreSQL), Restic, Wal-G\n   - Continuous WAL/binlog backup to S3\n   - Point-in-time recovery\n\n4. Velero (cluster-level):\n   - K8s resource + PV backup\n   - Complete disaster recovery\n   - Ideal for multi-namespace backups'
    },
    {
      front: 'What are the order guarantees of a StatefulSet?',
      back: 'Creation (scale up): 0 → 1 → 2\n- Pod N only created after pod N-1 is Running+Ready\n- Ensures primary (pod-0) is up before replicas\n\nDeletion (scale down): 2 → 1 → 0\n- Pod N only deleted after pod N+1 is terminated\n- Ensures replicas are removed before primary\n\nUpdate (rolling): 2 → 1 → 0\n- Same reverse order\n- Replicas update before primary (lower risk)\n\nPodManagementPolicy:\n- OrderedReady (default): guarantees order\n- Parallel: all simultaneous (when order doesn\'t matter)'
    },
    {
      front: 'How to backup and restore with Velero?',
      back: '# Install Velero (AWS S3)\nvelero install \\\n  --provider aws \\\n  --bucket my-bucket \\\n  --backup-location-config region=us-east-1 \\\n  --secret-file ./credentials\n\n# Backup namespace\nvelero backup create db-backup-20240115 \\\n  --include-namespaces database \\\n  --snapshot-volumes=true\n\n# View backups\nvelero backup get\n\n# Restore\nvelero restore create \\\n  --from-backup db-backup-20240115 \\\n  --include-namespaces database\n\n# Verify restore\nvelero restore get'
    }
  ],

  lab: {
    scenario: 'You need to configure a highly available MySQL database in Kubernetes for the backend team. The database should have 3 replicas, persistent storage with Retain policy, and protection against node maintenance.',
    objective: 'Create a MySQL StatefulSet with HA, Headless Service, volumeClaimTemplates, and PodDisruptionBudget, verifying stable identity and data persistence.',
    duration: '30-40 minutes',
    steps: [
      {
        title: 'Create Namespace, StorageClass, and Secret',
        instruction: `Prepare the database environment:
1. Create the \`database\` namespace with adequate ResourceQuota
2. Create a \`database-storage\` StorageClass with \`reclaimPolicy: Retain\`
3. Create a Secret with the MySQL root password`,
        hints: [
          'Use the default cluster StorageClass but with Retain — or create a new one',
          'Database secrets must be created before the StatefulSet',
          'ResourceQuota protects against excessive consumption'
        ],
        solution: `\`\`\`bash
# Namespace with quota
kubectl apply -f - <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: database
  labels:
    team: platform
    environment: production
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: database-quota
  namespace: database
spec:
  hard:
    requests.cpu: "8"
    requests.memory: 16Gi
    persistentvolumeclaims: "10"
    requests.storage: 200Gi
EOF

# Secret MySQL
kubectl create secret generic mysql-secret \\
  -n database \\
  --from-literal=root-password="SuperSecurePass123!" \\
  --from-literal=database="appdb"
\`\`\``,
        verify: `\`\`\`bash
# Verify namespace
kubectl get namespace database
# Expected: database   Active

# Verify ResourceQuota
kubectl describe resourcequota database-quota -n database

# Verify Secret
kubectl get secret mysql-secret -n database
# Expected: mysql-secret   Opaque   2   Xs
\`\`\``
      },
      {
        title: 'Create MySQL StatefulSet with Headless Service',
        instruction: `Deploy MySQL as a StatefulSet with 3 replicas:
- Headless Service for individual DNS
- volumeClaimTemplates with 5Gi per pod
- Liveness and Readiness probes configured
- Adequate resources (500m CPU, 512Mi memory request)`,
        hints: [
          'The StatefulSet serviceName must match the Headless Service name',
          'initialDelaySeconds should be >= 30 to give MySQL time to initialize',
          'Use the available StorageClass in your cluster'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: mysql-headless
  namespace: database
spec:
  clusterIP: None
  selector:
    app: mysql
  ports:
    - port: 3306
      name: mysql
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mysql
  namespace: database
spec:
  serviceName: mysql-headless
  replicas: 3
  selector:
    matchLabels:
      app: mysql
  template:
    metadata:
      labels:
        app: mysql
    spec:
      containers:
        - name: mysql
          image: mysql:8.0
          env:
            - name: MYSQL_ROOT_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: mysql-secret
                  key: root-password
          resources:
            requests:
              cpu: 500m
              memory: 512Mi
            limits:
              cpu: "2"
              memory: 2Gi
          livenessProbe:
            exec:
              command: ["bash", "-c", "mysqladmin ping -uroot -p\${MYSQL_ROOT_PASSWORD}"]
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            exec:
              command: ["bash", "-c", "mysql -uroot -p\${MYSQL_ROOT_PASSWORD} -e 'SELECT 1'"]
            initialDelaySeconds: 5
            periodSeconds: 5
          volumeMounts:
            - name: data
              mountPath: /var/lib/mysql
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        storageClassName: standard
        resources:
          requests:
            storage: 5Gi
EOF

kubectl wait --for=condition=ready pod -l app=mysql -n database --timeout=180s
\`\`\``,
        verify: `\`\`\`bash
# Verify pods in order
kubectl get pods -n database -l app=mysql
# Expected: mysql-0, mysql-1, mysql-2 Running

# Verify PVCs created
kubectl get pvc -n database
# Expected: data-mysql-0, data-mysql-1, data-mysql-2 Bound

# Verify Headless Service
kubectl get svc mysql-headless -n database
# Expected: ClusterIP <none>
\`\`\``
      },
      {
        title: 'Configure PodDisruptionBudget and Test Persistence',
        instruction: `1. Create a PodDisruptionBudget ensuring minimum 2 pods available
2. Create a database and insert data in mysql-0
3. Delete pod mysql-0 and verify data persists after recreation
4. Verify pod mysql-0 comes back with the same name`,
        hints: [
          'minAvailable: 2 ensures node drain never takes down more than 1 pod',
          'Data persists because the PVC survives pod deletion',
          'Pod comes back as mysql-0 because StatefulSet guarantees identity'
        ],
        solution: `\`\`\`bash
# Create PodDisruptionBudget
kubectl apply -f - <<EOF
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: mysql-pdb
  namespace: database
spec:
  selector:
    matchLabels:
      app: mysql
  minAvailable: 2
EOF

# Insert test data
MYSQL_PASS=\$(kubectl get secret mysql-secret -n database \\
  -o jsonpath='{.data.root-password}' | base64 -d)

kubectl exec -n database mysql-0 -- \\
  mysql -uroot -p"\$MYSQL_PASS" -e "
    CREATE DATABASE testdb;
    USE testdb;
    CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100));
    INSERT INTO users VALUES (1,'Alice'),(2,'Bob');
    SELECT * FROM users;
  "

# Delete pod mysql-0
kubectl delete pod mysql-0 -n database
kubectl wait --for=condition=ready pod/mysql-0 -n database --timeout=120s

# Verify data persisted
kubectl exec -n database mysql-0 -- \\
  mysql -uroot -p"\$MYSQL_PASS" -e "SELECT * FROM testdb.users;"
\`\`\``,
        verify: `\`\`\`bash
# Verify PDB
kubectl get pdb mysql-pdb -n database
# Expected: mysql-pdb   2   1   3   Xs

# Verify data persisted
MYSQL_PASS=\$(kubectl get secret mysql-secret -n database \\
  -o jsonpath='{.data.root-password}' | base64 -d)
kubectl exec -n database mysql-0 -- \\
  mysql -uroot -p"\$MYSQL_PASS" -e "SELECT * FROM testdb.users;" 2>/dev/null
# Expected: Alice, Bob rows

# Verify pod kept name mysql-0
kubectl get pods -n database | grep mysql-0
# Expected: mysql-0   1/1   Running   1   Xm  (restart count 1)
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'StatefulSet stuck — pod 1 not created after pod 0',
      difficulty: 'easy',
      symptom: 'StatefulSet with 3 replicas has mysql-0 Running but mysql-1 is never created. State stays at 1/3 for hours.',
      diagnosis: `\`\`\`bash
# Check StatefulSet state
kubectl describe statefulset mysql -n database

# Check why mysql-0 may not be Ready
kubectl get pods -n database -l app=mysql
kubectl describe pod mysql-0 -n database

# Check readiness probe
kubectl logs -n database mysql-0

# Check if mysql-0 PVC is Bound
kubectl get pvc -n database

# Check recent events
kubectl get events -n database --sort-by=.lastTimestamp | tail -15
\`\`\``,
      solution: `**StatefulSet order: pod N only creates when pod N-1 is Running+Ready.**

**Cause 1**: Readiness probe failing — pod is Running but not Ready.
\`\`\`bash
# See what readiness probe returns
kubectl exec -n database mysql-0 -- \\
  bash -c 'mysql -uroot -p\${MYSQL_ROOT_PASSWORD} -e "SELECT 1" 2>&1'

# Increase initialDelaySeconds if MySQL still initializing
kubectl patch statefulset mysql -n database --type='json' \\
  -p='[{"op":"replace","path":"/spec/template/spec/containers/0/readinessProbe/initialDelaySeconds","value":60}]'
\`\`\`

**Cause 2**: PVC in Pending — StorageClass without provisioner.
\`\`\`bash
kubectl describe pvc data-mysql-0 -n database | grep -A5 "Events:"
# Check if StorageClass has provisioner installed
kubectl describe storageclass database-storage
\`\`\``
    },
    {
      title: 'Data lost after redeploying StatefulSet',
      difficulty: 'hard',
      symptom: 'After deleting and recreating the StatefulSet for a configuration update, the database was redeployed without data. The team reports production data loss.',
      diagnosis: `\`\`\`bash
# Check PVC status
kubectl get pvc -n database

# Check PV reclaim policy
kubectl get pv -o json | \\
  jq '.items[] | {name: .metadata.name, reclaimPolicy: .spec.persistentVolumeReclaimPolicy, status: .status.phase}'

# Check if PVs still exist
kubectl get pv | grep database

# Check StorageClass reclaimPolicy
kubectl get storageclass database-storage -o yaml | grep reclaimPolicy
\`\`\``,
      solution: `**Cause**: StorageClass with reclaimPolicy: Delete — deleting StatefulSet deleted PVCs and PVs.

**Immediate recovery (if PV still exists as Released)**:
\`\`\`bash
# Check released PVs
kubectl get pv | grep Released

# Remove old PVC reference from PV (to allow rebind)
kubectl patch pv pv-abc123 --type json \\
  -p='[{"op": "remove", "path": "/spec/claimRef"}]'

# Create PVC manually pointing to existing PV
kubectl apply -f - <<EOF
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: data-mysql-0
  namespace: database
spec:
  accessModes: ["ReadWriteOnce"]
  resources:
    requests:
      storage: 50Gi
  volumeName: pv-abc123
  storageClassName: ""
EOF
\`\`\`

**Prevention for the future**:
\`\`\`bash
# 1. Never use reclaimPolicy: Delete for databases
# 2. Protect PVCs from accidental deletion
kubectl annotate pvc data-mysql-0 -n database \\
  helm.sh/resource-policy=keep
\`\`\``
    }
  ]
};
