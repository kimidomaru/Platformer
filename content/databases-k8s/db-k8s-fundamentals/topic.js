window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['databases-k8s/db-k8s-fundamentals'] = {
  theory: `# Databases on Kubernetes — Fundamentos

## Relevância no Exame
> Bancos de dados em Kubernetes cobram StatefulSets, Persistent Volumes, Storage Classes e operadores de banco de dados. É tópico avançado de KubeAstronaut com foco em produção.

## Conceitos Fundamentais

### Stateless vs Stateful Workloads

\`\`\`
Deployment (Stateless):        StatefulSet (Stateful):
- Pods intercambiáveis          - Pods com identidade estável
- pod-abc123, pod-def456        - mysql-0, mysql-1, mysql-2
- Sem storage próprio           - PVC dedicado por pod
- Scale up/down livre           - Scale segue ordem (0,1,2...)
- Restart = qualquer node       - Restart = mesmo nome + PVC
\`\`\`

### Por que StatefulSet para Bancos de Dados?

**Identidade estável**: O pod \`mysql-0\` sempre se chama \`mysql-0\` mesmo após restart. Crucial para replicação (primary fixo, réplicas se conectam ao primary).

**PVC dedicado**: Cada pod tem seu próprio PersistentVolumeClaim (volumeClaimTemplates). O PVC sobrevive mesmo se o pod morrer — dados não são perdidos.

**Headless Service**: Cada pod tem um DNS individual:
\`\`\`
mysql-0.mysql-headless.namespace.svc.cluster.local
mysql-1.mysql-headless.namespace.svc.cluster.local
mysql-2.mysql-headless.namespace.svc.cluster.local
\`\`\`

**Ordem de criação e deleção**: Pods são criados em ordem (0, 1, 2...) e deletados em ordem reversa (2, 1, 0). Garante que o primary esteja ready antes das réplicas.

### Storage Classes para Bancos de Dados

\`\`\`yaml
# Storage Class de alta performance (SSDs NVMe)
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: pd.csi.storage.gke.io  # GKE
parameters:
  type: pd-ssd
  replication-type: none
  disk-encryption-key: projects/my-proj/locations/global/keyRings/kr/cryptoKeys/ck
reclaimPolicy: Retain      # IMPORTANTE: Retain em produção!
allowVolumeExpansion: true
volumeBindingMode: WaitForFirstConsumer  # Aguarda pod para criar volume
\`\`\`

**reclaimPolicy**:
- \`Retain\`: volume permanece após PVC deletado — para bancos de dados!
- \`Delete\`: volume deletado com PVC — apenas para dados efêmeros

### Operadores de Banco de Dados — O Padrão Cloud-Native

Operadores são a forma recomendada de gerenciar bancos de dados em Kubernetes:

\`\`\`
Sem Operador:                    Com Operador:
- Backup manual                  - Backup automatizado
- Failover manual (horas)        - Failover automático (segundos)
- Scale manual                   - Scale automatizado
- Upgrade manual (downtime)      - Upgrade rolling sem downtime
- Config manual                  - Config declarativa via CRD
\`\`\`

**Operadores populares**:
| Banco | Operador |
|-------|---------|
| PostgreSQL | CloudNativePG (CNPG), Zalando, Crunchy |
| MySQL | MySQL Operator, Vitess |
| MongoDB | MongoDB Community Operator |
| Redis | Redis Enterprise Operator, Redis Operator |
| Cassandra | K8ssandra, CassKop |
| Kafka | Strimzi Kafka Operator |

### Padrões de HA para Databases

\`\`\`
Replicação:
  Primary → Replica 1
           → Replica 2
           → Replica 3 (read-only)

Reads:  → qualquer réplica (via service com labelSelector)
Writes: → apenas primary (via headless DNS ou service dedicado)
\`\`\`

### Backup e Restore no Kubernetes

**Estratégias**:
1. **Volume Snapshots**: snapshot do PV via CSI
2. **Logical backup**: pg_dump, mysqldump executado em Job
3. **Physical backup via sidecar**: Barman, Restic para S3
4. **Velero**: backup de recursos K8s + PVs completo

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

### Network Policies para Bancos de Dados

\`\`\`yaml
# Somente pods com label app=backend podem acessar o DB
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

## Comandos Essenciais

### StatefulSet Management
\`\`\`bash
# Criar StatefulSet
kubectl apply -f statefulset.yaml

# Ver pods do StatefulSet em ordem
kubectl get pods -l app=mysql -n database

# Ver PVCs criados por volumeClaimTemplates
kubectl get pvc -n database

# Scale com garantia de ordem
kubectl scale statefulset mysql --replicas=3 -n database

# Restart de um pod específico (manterá o mesmo PVC)
kubectl delete pod mysql-0 -n database

# Ver headless service DNS
kubectl run debug --image=busybox --rm -it -- \\
  nslookup mysql-0.mysql-headless.database.svc.cluster.local

# Update (rolling update seguindo ordem reversa)
kubectl patch statefulset mysql -n database \\
  --type='json' \\
  -p='[{"op": "replace", "path": "/spec/template/spec/containers/0/image", "value":"mysql:8.1"}]'
\`\`\`

### Storage e Volumes
\`\`\`bash
# Ver StorageClasses disponíveis
kubectl get storageclass

# Ver PVs no cluster
kubectl get pv

# Ver PVCs e seus PVs
kubectl get pvc --all-namespaces

# Expandir PVC (se StorageClass suportar)
kubectl patch pvc data-mysql-0 -n database \\
  --type='json' \\
  -p='[{"op": "replace", "path": "/spec/resources/requests/storage", "value": "100Gi"}]'

# Criar snapshot de PV
kubectl apply -f volume-snapshot.yaml
kubectl get volumesnapshot -n database

# Restaurar de snapshot
kubectl apply -f pvc-from-snapshot.yaml
\`\`\`

### Backup com Velero
\`\`\`bash
# Instalar Velero
velero install \\
  --provider aws \\
  --plugins velero/velero-plugin-for-aws:v1.9.0 \\
  --bucket my-backup-bucket \\
  --backup-location-config region=us-east-1 \\
  --snapshot-location-config region=us-east-1 \\
  --secret-file ./credentials-velero

# Backup de namespace completo (inclui PVs)
velero backup create db-backup-$(date +%Y%m%d) \\
  --include-namespaces database \\
  --snapshot-volumes=true

# Ver backups
velero backup get
velero backup describe db-backup-20240115

# Restaurar
velero restore create --from-backup db-backup-20240115 \\
  --include-namespaces database
\`\`\`

## Exemplos YAML

### StatefulSet Completo com HA
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
apiVersion: v1
kind: Service
metadata:
  name: mysql-read
  namespace: database
spec:
  selector:
    app: mysql
    role: replica  # apenas réplicas
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
      initContainers:
        - name: init-mysql
          image: mysql:8.0
          command:
            - bash
            - -c
            - |
              # mysql-0 = primary, outros = replicas
              ordinal=\${HOSTNAME##*-}
              echo "[mysqld]" > /mnt/conf.d/server-id.cnf
              if [ "\$ordinal" = "0" ]; then
                echo "server-id=1" >> /mnt/conf.d/server-id.cnf
                echo "1" > /mnt/mysql/is-primary
              else
                echo "server-id=\$((ordinal + 100))" >> /mnt/conf.d/server-id.cnf
                echo "0" > /mnt/mysql/is-primary
              fi
          volumeMounts:
            - name: conf
              mountPath: /mnt/conf.d
            - name: data
              mountPath: /mnt/mysql
      containers:
        - name: mysql
          image: mysql:8.0
          env:
            - name: MYSQL_ROOT_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: mysql-secret
                  key: root-password
          ports:
            - containerPort: 3306
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
            - name: conf
              mountPath: /etc/mysql/conf.d
      volumes:
        - name: conf
          emptyDir: {}
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

### PodDisruptionBudget para Database
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
  minAvailable: 2   # nunca menos de 2 pods (de 3 total)
  # Ou: maxUnavailable: 1
\`\`\`

## Erros Comuns

### 1. Usar Deployment para banco de dados
**Causa**: Falta de conhecimento sobre StatefulSet.
**Impacto**: Pods com nomes aleatórios, sem PVCs dedicados, dados perdidos em restarts.
**Solução**: Sempre usar StatefulSet para workloads com estado persistente.

### 2. reclaimPolicy: Delete em PVCs de banco de dados
**Causa**: Usar StorageClass padrão (frequentemente reclaimPolicy: Delete).
**Impacto**: Deletar um PVC (ou o StatefulSet) destrói os dados do banco.
**Solução**: Criar StorageClass dedicada com \`reclaimPolicy: Retain\` para bancos.

### 3. Escalar banco sem verificar replicação
**Causa**: \`kubectl scale statefulset --replicas=2\` antes de configurar replicação.
**Impacto**: Nova réplica começa vazia, sem dados — inconsistência.
**Solução**: Usar operadores que gerenciam replicação automaticamente.

### 4. Sem PodDisruptionBudget
**Causa**: Não configurar PDB para StatefulSets.
**Impacto**: Manutenção de nós pode desligar todas as réplicas simultaneamente.
**Solução**: Definir \`minAvailable: 1\` (ou 2 para HA real) em todos os StatefulSets críticos.

### 5. Liveness probe muito agressiva
**Causa**: initialDelaySeconds muito baixo para bancos de dados (startup lento).
**Impacto**: Kubernetes reinicia o banco antes de terminar o startup.
**Solução**: initialDelaySeconds ≥ 30s para bancos de dados pesados.

## Killer.sh Style Challenge

**Contexto**: Você deve migrar um banco PostgreSQL de um Deployment para um StatefulSet com HA.

**Tarefas**:
1. Criar namespace \`database\` com ResourceQuota adequada
2. Criar StorageClass \`database-storage\` com reclaimPolicy: Retain
3. Criar StatefulSet \`postgres\` com 3 réplicas e volumeClaimTemplates de 20Gi
4. Criar Headless Service \`postgres-headless\`
5. Criar PodDisruptionBudget garantindo mínimo de 2 pods sempre disponíveis
6. Verificar que cada pod tem seu PVC dedicado`,

  quiz: [
    {
      question: 'Qual é a principal vantagem de usar StatefulSet em vez de Deployment para um banco de dados?',
      options: [
        'StatefulSet é mais performático que Deployment para todas as cargas',
        'StatefulSet fornece identidade estável de pod e PVCs dedicados por pod',
        'StatefulSet automaticamente configura replicação do banco de dados',
        'StatefulSet não requer Service para expor o banco externamente'
      ],
      correct: 1,
      explanation: 'StatefulSet garante que cada pod mantém identidade estável (mysql-0, mysql-1...) que persiste entre restarts, e cria PVCs dedicados via volumeClaimTemplates — cada pod tem seu próprio armazenamento. Isso é essencial para databases que precisam saber quem é o primary e manter dados entre restarts.',
      reference: 'Conceito: StatefulSet — seção "Por que StatefulSet para Bancos de Dados?" na teoria.'
    },
    {
      question: 'O que acontece com os dados de um banco de dados se o reclaimPolicy da StorageClass for "Delete"?',
      options: [
        'Os dados são movidos para um backup automático',
        'Os dados persistem por 30 dias antes de serem deletados',
        'Os dados são permanentemente perdidos quando o PVC é deletado',
        'Os dados são retidos mas o volume fica inacessível'
      ],
      correct: 2,
      explanation: 'Com reclaimPolicy: Delete, quando o PVC é deletado (ex: ao escalar o StatefulSet para 0 ou deletar o namespace), o PersistentVolume e todos os dados são imediatamente destruídos. Para bancos de dados em produção, sempre use reclaimPolicy: Retain.',
      reference: 'Config: reclaimPolicy — seção "Storage Classes para Bancos de Dados" na teoria.'
    },
    {
      question: 'O que é um Headless Service e por que é essencial para StatefulSets?',
      options: [
        'Um Service sem porta exposta, usado para segurança',
        'Um Service com clusterIP: None que cria entradas DNS individuais para cada pod',
        'Um Service interno que bloqueia tráfego externo',
        'Um Service que desabilita health checks do Kubernetes'
      ],
      correct: 1,
      explanation: 'Headless Service (clusterIP: None) não tem IP virtual — em vez disso, cria registros DNS individuais para cada pod do StatefulSet (mysql-0.mysql-headless.namespace.svc.cluster.local). Isso permite que réplicas se conectem especificamente ao primary (mysql-0) e que o primary conheça o endereço de cada réplica.',
      reference: 'Conceito: Headless Service — seção "Por que StatefulSet para Bancos de Dados?" na teoria.'
    },
    {
      question: 'Qual é a vantagem principal de usar operadores de banco de dados vs gerenciar StatefulSets manualmente?',
      options: [
        'Operadores usam menos recursos de CPU e memória',
        'Operadores automatizam failover, backup e upgrades que seriam manuais e propensos a erro',
        'Operadores eliminam a necessidade de PersistentVolumes',
        'Operadores são mais baratos que soluções gerenciadas de cloud'
      ],
      correct: 1,
      explanation: 'Operadores encapsulam o conhecimento operacional do banco (como fazer failover seguro, backup consistente, upgrade sem downtime) em código automatizado. Sem operador, essas tarefas requerem scripts manuais, knowledge específico e são fontes frequentes de incidentes.',
      reference: 'Conceito: Operadores — seção "Operadores de Banco de Dados" na teoria.'
    },
    {
      question: 'O que o campo "volumeClaimTemplates" em um StatefulSet faz?',
      options: [
        'Define um único PVC compartilhado entre todos os pods do StatefulSet',
        'Cria um PVC dedicado para cada pod do StatefulSet automaticamente',
        'Configura volumes temporários (emptyDir) para cada pod',
        'Define o template para criar StorageClasses dinamicamente'
      ],
      correct: 1,
      explanation: 'volumeClaimTemplates instrui o StatefulSet a criar um PVC individual para cada pod. Para um StatefulSet com 3 réplicas e um volumeClaimTemplate "data", serão criados: data-mysql-0, data-mysql-1, data-mysql-2. Cada PVC persiste mesmo se o pod for deletado e recriado.',
      reference: 'Config: volumeClaimTemplates — exemplo YAML na teoria.'
    },
    {
      question: 'Por que um PodDisruptionBudget é crítico para StatefulSets de banco de dados?',
      options: [
        'PDB aumenta a performance do banco durante alta carga',
        'PDB evita que operações de manutenção (drain de node) derrubem todos os pods simultaneamente',
        'PDB automaticamente faz failover quando um pod falha',
        'PDB é apenas para Deployments — StatefulSets têm proteção nativa'
      ],
      correct: 1,
      explanation: 'Durante manutenção de node (kubectl drain), sem PDB o Kubernetes pode desligar todos os pods do StatefulSet de uma vez — causando downtime total. Com PDB minAvailable: 2 (em cluster de 3), o drain é bloqueado se isso deixaria menos de 2 pods disponíveis, garantindo continuidade.',
      reference: 'Exemplo: PodDisruptionBudget — seção de exemplos YAML na teoria.'
    },
    {
      question: 'Qual ferramenta é recomendada para backup completo de banco de dados em Kubernetes (recursos + volumes persistentes)?',
      options: [
        'kubectl cp',
        'Velero',
        'kubectl backup',
        'PersistentVolume Migrator'
      ],
      correct: 1,
      explanation: 'Velero faz backup completo de recursos Kubernetes (StatefulSet, ConfigMaps, Secrets) E PersistentVolumes via snapshots CSI. É a solução de referência para disaster recovery em Kubernetes, suportando múltiplos cloud providers e storage backends.',
      reference: 'Backup: Velero — seção "Backup com Velero" nos comandos.'
    },
    {
      question: 'Ao escalar um StatefulSet de 1 para 3 réplicas sem um operador, qual problema pode ocorrer?',
      options: [
        'O Kubernetes recusa scaling de StatefulSets com mais de 2 réplicas',
        'Os novos pods começam com volumes vazios sem os dados do pod 0',
        'O StatefulSet trava porque PVCs não podem ser criados durante scaling',
        'Nenhum problema — StatefulSets gerenciam replicação automaticamente'
      ],
      correct: 1,
      explanation: 'O Kubernetes cria os PVCs e pods corretamente, mas não configura replicação de dados. Os novos pods (mysql-1, mysql-2) terão volumes PVC vazios — sem os dados que estão em mysql-0. Isso requer inicialização de replicação manual ou um operador que clone dados automaticamente.',
      reference: 'Erros comuns: escalar sem replicação — seção "Erros Comuns" na teoria.'
    }
  ],

  flashcards: [
    {
      front: 'Por que usar StatefulSet em vez de Deployment para bancos de dados?',
      back: 'StatefulSet oferece 3 garantias essenciais:\n\n1. Identidade estável:\n   mysql-0, mysql-1, mysql-2 (mesmo após restart)\n   → Primary é sempre mysql-0 (replicação confiável)\n\n2. PVCs dedicados via volumeClaimTemplates:\n   data-mysql-0, data-mysql-1, data-mysql-2\n   → Dados persistem mesmo se o pod morrer\n\n3. Headless Service com DNS individual:\n   mysql-0.mysql-headless.ns.svc.cluster.local\n   → Réplicas sabem onde está o primary\n\nDeployment: pods intercambiáveis, sem identidade, PVCs compartilhados → inadequado para DB'
    },
    {
      front: 'Qual reclaimPolicy usar em StorageClass para bancos de dados?',
      back: 'SEMPRE use reclaimPolicy: Retain para bancos de dados!\n\nRetain:\n- PVC deletado → PV fica como "Released"\n- Dados permanecem no disco\n- Administrador decide o que fazer\n- Requer reclaim manual para reutilizar\n\nDelete (EVITAR para DBs):\n- PVC deletado → PV deletado imediatamente\n- Dados PERMANENTEMENTE perdidos\n- Padrão em muitas cloud StorageClasses\n\nConfigurando:\napiVersion: storage.k8s.io/v1\nkind: StorageClass\nreclaimPolicy: Retain  ← ESSENCIAL'
    },
    {
      front: 'O que é um Headless Service e qual seu papel no StatefulSet?',
      back: 'Headless Service: Service com clusterIP: None\n\nDiferença:\n- Service normal: VIP único (10.96.0.1)\n  → load balance para qualquer pod\n\n- Headless: sem VIP, cria DNS individual:\n  pod-0.svc-headless.ns.svc.cluster.local\n  pod-1.svc-headless.ns.svc.cluster.local\n\nPor que essencial para DBs:\n- Réplicas se conectam especificamente ao primary (pod-0)\n- Primary sabe DNS de cada réplica\n- Sem Headless = não dá para endereçar pods individuais\n\nspec:\n  clusterIP: None  ← headless'
    },
    {
      front: 'Quais são os operadores mais populares por banco de dados?',
      back: 'PostgreSQL:\n- CloudNativePG (CNPG) ← recomendado\n- Zalando Postgres Operator\n- Crunchy Data PGO\n\nMySQL:\n- MySQL Operator for Kubernetes\n- Vitess (para sharding)\n\nMongoDB:\n- MongoDB Community Operator\n- Percona Operator for MongoDB\n\nRedis:\n- Redis Enterprise Operator\n- Redis Operator (Spotahome)\n\nKafka:\n- Strimzi Kafka Operator\n\nCassandra:\n- K8ssandra\n\nPor que usar operadores:\n→ Failover automático, backup, upgrades rolling'
    },
    {
      front: 'Por que PodDisruptionBudget é crítico para StatefulSets de DB?',
      back: 'Sem PDB:\nkubectl drain node-1  →  pode matar TODOS os pods do DB\n→ downtime total, perda de quorum\n\nCom PDB (minAvailable: 2 para cluster de 3):\nkubectl drain node-1  →  operação BLOQUEADA se restaria < 2 pods\n→ drain esperará pod migrar para outro node antes de continuar\n\nExemplo:\napiVersion: policy/v1\nkind: PodDisruptionBudget\nspec:\n  selector:\n    matchLabels:\n      app: postgres\n  minAvailable: 2  ← nunca menos de 2 pods\n\nTambém protege contra:\n- Cluster upgrades\n- Node repairs\n- Cluster Autoscaler scale-down'
    },
    {
      front: 'Quais são as estratégias de backup para bancos de dados no Kubernetes?',
      back: '1. Volume Snapshots (CSI):\n   - Snapshot do PV via API K8s\n   - Rápido, consistente (com db quiescence)\n   - VolumeSnapshot CRD\n\n2. Logical backup (Job):\n   - pg_dump, mysqldump em CronJob\n   - Lento para grandes DBs\n   - Portável entre versões\n\n3. Physical via sidecar:\n   - Barman (PostgreSQL), Restic, Wal-G\n   - Backup contínuo de WAL/binlog para S3\n   - Ponto-in-time recovery\n\n4. Velero (cluster-level):\n   - Backup de recursos K8s + PVs\n   - Disaster recovery completo\n   - Ideal para multi-namespace backups'
    },
    {
      front: 'Quais são as order guarantees do StatefulSet?',
      back: 'Criação (scale up): 0 → 1 → 2\n- Pod N só cria após pod N-1 estar Running+Ready\n- Garante que o primary (pod-0) está up antes das réplicas\n\nDeleção (scale down): 2 → 1 → 0\n- Pod N só deleta após pod N+1 estar terminado\n- Garante que réplicas são removidas antes do primary\n\nUpdate (rolling): 2 → 1 → 0\n- Mesma ordem reversa\n- Réplicas atualizam antes do primary (menor risco)\n\nPodManagementPolicy:\n- OrderedReady (padrão): garante ordem\n- Parallel: todos simultâneos (quando ordem não importa)'
    },
    {
      front: 'Como fazer backup e restore com Velero?',
      back: '# Instalar Velero (AWS S3)\nvelero install \\\n  --provider aws \\\n  --bucket my-bucket \\\n  --backup-location-config region=us-east-1 \\\n  --secret-file ./credentials\n\n# Backup de namespace\nvelero backup create db-backup-20240115 \\\n  --include-namespaces database \\\n  --snapshot-volumes=true\n\n# Ver backups\nvelero backup get\nvelero backup describe db-backup-20240115\n\n# Restore\nvelero restore create \\\n  --from-backup db-backup-20240115 \\\n  --include-namespaces database\n\n# Verificar restore\nvelero restore get\nvelero restore describe <name>'
    }
  ],

  lab: {
    scenario: 'Você precisa configurar um banco MySQL de alta disponibilidade em Kubernetes para o time de backend. O banco deve ter 3 réplicas, armazenamento persistente com política Retain e proteção contra manutenção de nodes.',
    objective: 'Criar um StatefulSet MySQL com HA, Headless Service, volumeClaimTemplates e PodDisruptionBudget, verificando identidade estável e persistência de dados.',
    duration: '30-40 minutos',
    steps: [
      {
        title: 'Criar Namespace, StorageClass e Secret',
        instruction: `Prepare o ambiente para o banco de dados:
1. Crie o namespace \`database\` com ResourceQuota adequada
2. Crie uma StorageClass \`database-storage\` com \`reclaimPolicy: Retain\`
3. Crie um Secret com a senha root do MySQL`,
        hints: [
          'Use a StorageClass padrão do seu cluster mas com Retain — ou crie uma nova',
          'Secrets de banco devem ser criados antes do StatefulSet',
          'ResourceQuota protege contra consumo excessivo'
        ],
        solution: `\`\`\`bash
# Namespace com quota
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

# StorageClass com Retain
# Verificar qual provisioner está disponível
kubectl get storageclass
# Usar o provisioner do cluster — exemplo com standard (minikube/kind):

kubectl apply -f - <<EOF
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: database-storage
  annotations:
    storageclass.kubernetes.io/is-default-class: "false"
provisioner: docker.io/hostpath  # ajuste para seu cluster
reclaimPolicy: Retain
allowVolumeExpansion: true
volumeBindingMode: WaitForFirstConsumer
EOF

# Secret MySQL
kubectl create secret generic mysql-secret \\
  -n database \\
  --from-literal=root-password="SuperSecurePass123!" \\
  --from-literal=database="appdb"

# Verificar
kubectl get secret mysql-secret -n database
\`\`\``,
        verify: `\`\`\`bash
# Verificar namespace
kubectl get namespace database
# Saída esperada: database   Active

# Verificar ResourceQuota
kubectl describe resourcequota database-quota -n database
# Saída esperada: quotas configuradas

# Verificar StorageClass
kubectl get storageclass database-storage
# Saída esperada: database-storage   Retain

# Verificar Secret
kubectl get secret mysql-secret -n database
# Saída esperada: mysql-secret   Opaque   2   Xs
\`\`\``
      },
      {
        title: 'Criar StatefulSet MySQL com Headless Service',
        instruction: `Faça deploy do MySQL como StatefulSet com 3 réplicas:
- Headless Service para DNS individual
- volumeClaimTemplates com 5Gi por pod
- Liveness e Readiness probes configuradas
- Resources adequados (500m CPU, 512Mi memory request)`,
        hints: [
          'O serviceName do StatefulSet deve bater com o nome do Headless Service',
          'initialDelaySeconds deve ser >= 30 para o MySQL ter tempo de inicializar',
          'A StorageClass database-storage pode não funcionar em todos os clusters — use a padrão se necessário'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
# Headless Service
apiVersion: v1
kind: Service
metadata:
  name: mysql-headless
  namespace: database
  labels:
    app: mysql
spec:
  clusterIP: None  # HEADLESS!
  selector:
    app: mysql
  ports:
    - port: 3306
      name: mysql

---
# Service para leitura (todas as réplicas)
apiVersion: v1
kind: Service
metadata:
  name: mysql-read
  namespace: database
spec:
  selector:
    app: mysql
  ports:
    - port: 3306
      name: mysql
  type: ClusterIP

---
# StatefulSet
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
            - name: MYSQL_DATABASE
              valueFrom:
                secretKeyRef:
                  name: mysql-secret
                  key: database
          ports:
            - containerPort: 3306
              name: mysql
          resources:
            requests:
              cpu: 500m
              memory: 512Mi
            limits:
              cpu: "2"
              memory: 2Gi
          livenessProbe:
            exec:
              command:
                - bash
                - -c
                - mysqladmin ping -uroot -p\${MYSQL_ROOT_PASSWORD}
            initialDelaySeconds: 30
            periodSeconds: 10
            failureThreshold: 3
          readinessProbe:
            exec:
              command:
                - bash
                - -c
                - mysql -uroot -p\${MYSQL_ROOT_PASSWORD} -e "SELECT 1"
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
        storageClassName: standard  # usar StorageClass disponível no seu cluster
        resources:
          requests:
            storage: 5Gi
EOF

# Aguardar pods (pode demorar alguns minutos)
kubectl wait --for=condition=ready pod \\
  -l app=mysql -n database --timeout=180s
\`\`\``,
        verify: `\`\`\`bash
# Verificar pods em ordem
kubectl get pods -n database -l app=mysql
# Saída esperada:
# mysql-0   1/1   Running   0   2m
# mysql-1   1/1   Running   0   90s
# mysql-2   1/1   Running   0   60s

# Verificar PVCs criados por volumeClaimTemplates
kubectl get pvc -n database
# Saída esperada:
# data-mysql-0   Bound   5Gi
# data-mysql-1   Bound   5Gi
# data-mysql-2   Bound   5Gi

# Verificar Headless Service
kubectl get svc mysql-headless -n database
# Saída esperada: ClusterIP <none>

# Testar DNS individual
kubectl exec -n database mysql-0 -- \\
  mysql -uroot -p"\$(kubectl get secret mysql-secret -n database -o jsonpath='{.data.root-password}' | base64 -d)" \\
  -e "SELECT @@hostname;"
# Saída esperada: mysql-0
\`\`\``
      },
      {
        title: 'Configurar PodDisruptionBudget e Testar Persistência',
        instruction: `1. Crie um PodDisruptionBudget garantindo mínimo de 2 pods disponíveis
2. Crie um banco de dados e insira dados em mysql-0
3. Delete o pod mysql-0 e verifique que os dados persistem após recriação
4. Verifique que o pod mysql-0 volta com o mesmo nome (não aleatório como Deployment)`,
        hints: [
          'minAvailable: 2 garante que drain de node nunca derruba mais de 1 pod',
          'Os dados persistem porque o PVC sobrevive à deleção do pod',
          'O pod volta com o nome mysql-0 porque StatefulSet garante identidade'
        ],
        solution: `\`\`\`bash
# Criar PodDisruptionBudget
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

# Criar dados de teste em mysql-0
MYSQL_PASS=\$(kubectl get secret mysql-secret -n database \\
  -o jsonpath='{.data.root-password}' | base64 -d)

kubectl exec -n database mysql-0 -- \\
  mysql -uroot -p"\$MYSQL_PASS" -e "
    CREATE DATABASE IF NOT EXISTS testdb;
    USE testdb;
    CREATE TABLE IF NOT EXISTS users (id INT PRIMARY KEY, name VARCHAR(100));
    INSERT INTO users VALUES (1, 'Alice'), (2, 'Bob'), (3, 'Charlie');
    SELECT * FROM users;
  "

# Deletar pod mysql-0 (simular crash)
kubectl delete pod mysql-0 -n database

# Aguardar recriação
kubectl wait --for=condition=ready pod/mysql-0 -n database --timeout=120s

# Verificar que dados persistiram
kubectl exec -n database mysql-0 -- \\
  mysql -uroot -p"\$MYSQL_PASS" -e "SELECT * FROM testdb.users;"

# Verificar que o pod voltou com o mesmo nome
kubectl get pod mysql-0 -n database
\`\`\``,
        verify: `\`\`\`bash
# Verificar PDB criado
kubectl get pdb mysql-pdb -n database
# Saída esperada: mysql-pdb   2   1   3   Xs

# Verificar dados persistiram após delete do pod
MYSQL_PASS=\$(kubectl get secret mysql-secret -n database \\
  -o jsonpath='{.data.root-password}' | base64 -d)

kubectl exec -n database mysql-0 -- \\
  mysql -uroot -p"\$MYSQL_PASS" -e "SELECT * FROM testdb.users;" 2>/dev/null
# Saída esperada:
# id | name
# 1  | Alice
# 2  | Bob
# 3  | Charlie

# Verificar que pod manteve o nome mysql-0
kubectl get pods -n database | grep mysql-0
# Saída esperada: mysql-0   1/1   Running   1   Xm
# (Restart count = 1 indica que foi recriado)

# Verificar PVC ainda existe
kubectl get pvc data-mysql-0 -n database
# Saída esperada: data-mysql-0   Bound   5Gi
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'StatefulSet travado — pod 1 não cria após pod 0',
      difficulty: 'easy',
      symptom: 'StatefulSet com 3 réplicas está com mysql-0 Running mas mysql-1 nunca é criado. O estado fica em 1/3 por horas.',
      diagnosis: `\`\`\`bash
# Verificar estado do StatefulSet
kubectl describe statefulset mysql -n database

# Verificar por que mysql-0 pode não estar Ready
kubectl get pods -n database -l app=mysql
kubectl describe pod mysql-0 -n database

# Verificar Readiness Probe
kubectl logs -n database mysql-0

# Verificar se PVC de mysql-0 está Bound
kubectl get pvc -n database

# Verificar eventos recentes
kubectl get events -n database --sort-by=.lastTimestamp | tail -15

# Verificar se readinessProbe está falhando
kubectl describe pod mysql-0 -n database | grep -A10 "Readiness"
\`\`\``,
      solution: `**StatefulSet segue ordem: pod N só cria quando pod N-1 está Running+Ready.**

**Causa 1**: Readiness probe falhando — pod está Running mas não Ready.
\`\`\`bash
# Ver o que a readiness probe retorna
kubectl exec -n database mysql-0 -- \\
  bash -c 'mysql -uroot -p\${MYSQL_ROOT_PASSWORD} -e "SELECT 1" 2>&1'

# Se erro de conexão: MySQL ainda inicializando
# Aumentar initialDelaySeconds na probe
kubectl patch statefulset mysql -n database --type='json' \\
  -p='[{"op": "replace", "path": "/spec/template/spec/containers/0/readinessProbe/initialDelaySeconds", "value": 60}]'
\`\`\`

**Causa 2**: PVC de mysql-0 em Pending — StorageClass sem provisioner.
\`\`\`bash
kubectl get pvc data-mysql-0 -n database
kubectl describe pvc data-mysql-0 -n database | grep -A5 "Events:"
# Se "waiting for first consumer" ou "no provisioner":
# Verificar se StorageClass tem provisioner instalado
kubectl describe storageclass database-storage
\`\`\`

**Causa 3**: Node sem recursos para mysql-0.
\`\`\`bash
kubectl describe pod mysql-0 -n database | grep -A5 "Events:"
# Se "Insufficient cpu/memory": aumentar capacity ou reduzir requests
\`\`\``
    },
    {
      title: 'Dados perdidos após reimplantar StatefulSet',
      difficulty: 'hard',
      symptom: 'Após deletar e recriar o StatefulSet por uma atualização de configuração, o banco de dados foi reimplantado sem dados. O time reporta perda de dados de produção.',
      diagnosis: `\`\`\`bash
# Verificar status dos PVCs
kubectl get pvc -n database

# Verificar política de retenção dos PVs
kubectl get pv -o json | \\
  jq '.items[] | {name: .metadata.name, reclaimPolicy: .spec.persistentVolumeReclaimPolicy, status: .status.phase}'

# Verificar se PVs ainda existem (mesmo que PVCs foram deletados)
kubectl get pv | grep database

# Verificar StorageClass usada
kubectl get pvc data-mysql-0 -n database -o yaml | grep storageClassName

# Verificar StorageClass reclaimPolicy
kubectl get storageclass database-storage -o yaml | grep reclaimPolicy
\`\`\``,
      solution: `**Causa provável**: StorageClass com reclaimPolicy: Delete — deletar StatefulSet deletou PVCs e PVs.

**Recuperação imediata (se PV ainda existir como Released)**:
\`\`\`bash
# Verificar PVs liberados
kubectl get pv | grep Released

# Remover referência do PVC antigo do PV (para poder rebind)
kubectl patch pv pv-abc123 --type json \\
  -p='[{"op": "remove", "path": "/spec/claimRef"}]'

# Criar PVC manualmente apontando para o PV existente
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
  volumeName: pv-abc123  # apontar para PV específico
  storageClassName: ""   # sem StorageClass para não criar novo PV
EOF
\`\`\`

**Prevenção para o futuro**:
\`\`\`bash
# 1. Nunca usar reclaimPolicy: Delete para bancos de dados
# 2. Adicionar annotation para proteger PVCs contra deleção acidental
kubectl annotate pvc data-mysql-0 -n database \\
  helm.sh/resource-policy=keep

# 3. Usar finalizers ou labels para proteção
kubectl patch pvc data-mysql-0 -n database \\
  --type='json' \\
  -p='[{"op": "add", "path": "/metadata/annotations/velero.io~1backup-volumes", "value": "data"}]'
\`\`\``
    }
  ]
};
