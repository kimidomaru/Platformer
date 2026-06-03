window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['databases-k8s/postgresql-k8s'] = {
  theory: `# PostgreSQL no Kubernetes com CloudNativePG

## Relevância no Exame
> PostgreSQL em Kubernetes é cobrado em KubeAstronaut com foco no operador CloudNativePG (CNPG): clusters HA, backup para S3, failover automático, connection pooling com PgBouncer.

## Conceitos Fundamentais

### CloudNativePG (CNPG) — O Operador de Referência
CloudNativePG é o operador PostgreSQL recomendado pela CNCF. Gerencia:
- **Cluster PostgreSQL HA** (primary + réplicas streaming)
- **Failover automático** com eleição do novo primary
- **Backup contínuo** (WAL streaming para S3/GCS/Azure)
- **Point-In-Time Recovery** (PITR)
- **Connection pooling** com PgBouncer integrado
- **Rolling upgrades** sem downtime

### Arquitetura do Cluster CNPG

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
│  -rw  → primary (leitura+escrita)                    │
│  -ro  → qualquer réplica (somente leitura)           │
│  -r   → round-robin todas as instâncias              │
└──────────────────────────────────────────────────────┘
\`\`\`

### Recursos do Cluster CNPG

O CNPG cria automaticamente:
- **Pods**: cada instância é um pod com PVC dedicado
- **Services**: \`cluster-rw\` (primary), \`cluster-ro\` (replicas), \`cluster-r\` (round-robin)
- **Secrets**: credentials do superuser, replication user, app user
- **PVCs**: um por instância com a StorageClass configurada

### Failover Automático
\`\`\`
Cenário de Failover:
1. Primary (pod-1) falha ou fica indisponível
2. CNPG operador detecta após N segundos
3. Elege réplica mais atualizada como novo primary
4. Atualiza Service -rw para apontar para novo primary
5. Réplica antiga vira nova réplica quando primary volta
\`\`\`

### PgBouncer — Connection Pooling

\`\`\`
Sem PgBouncer:
App → conexão direta → PostgreSQL
Problema: PostgreSQL suporta ~100-300 conexões simultâneas

Com PgBouncer:
App → PgBouncer (pool) → PostgreSQL
Benefício: 1000+ conexões de app → pool de 50-100 para Postgres
\`\`\`

Modos do PgBouncer:
- \`transaction\`: pool por transação (recomendado para apps sem estado de sessão)
- \`session\`: pool por sessão (compatível com prepared statements)
- \`statement\`: pool por statement (mais restritivo)

## Comandos Essenciais

### Instalar CNPG Operator
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

# Verificar CRDs instalados
kubectl get crd | grep postgresql
\`\`\`

### Gerenciar Clusters CNPG
\`\`\`bash
# Listar clusters
kubectl get clusters -n database
kubectl get cluster -n database -o wide

# Ver status detalhado
kubectl describe cluster my-cluster -n database

# Ver pods do cluster
kubectl get pods -n database -l cnpg.io/cluster=my-cluster

# Ver services criados
kubectl get svc -n database -l cnpg.io/cluster=my-cluster
# cluster-rw (primary), cluster-ro (replicas), cluster-r (all)

# Conectar ao primary
kubectl exec -n database -it my-cluster-1 -- psql -U postgres

# Plugin kubectl (instalar separado)
kubectl cnpg status my-cluster -n database
kubectl cnpg promote my-cluster my-cluster-2 -n database
kubectl cnpg backup my-cluster -n database
\`\`\`

### Gerenciar Backups
\`\`\`bash
# Criar backup manual
kubectl apply -f - <<EOF
apiVersion: postgresql.cnpg.io/v1
kind: Backup
metadata:
  name: my-backup-$(date +%Y%m%d)
  namespace: database
spec:
  cluster:
    name: my-cluster
  method: barmanObjectStore  # ou volumeSnapshot
EOF

# Listar backups
kubectl get backups -n database

# Ver status de backup
kubectl describe backup my-backup-20240115 -n database

# ScheduledBackup (backup automático)
kubectl get scheduledbackups -n database
\`\`\`

## Exemplos YAML

### Cluster CNPG Básico (3 instâncias com backup S3)
\`\`\`yaml
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: pg-production
  namespace: database
spec:
  instances: 3

  # Versão do PostgreSQL
  imageName: ghcr.io/cloudnative-pg/postgresql:16.2

  # Storage
  storage:
    size: 50Gi
    storageClass: fast-ssd

  # Recursos
  resources:
    requests:
      cpu: 500m
      memory: 1Gi
    limits:
      cpu: "2"
      memory: 4Gi

  # Credenciais do superuser
  superuserSecret:
    name: pg-superuser-secret

  # Bootstrap (criar DB e usuário)
  bootstrap:
    initdb:
      database: appdb
      owner: appuser
      secret:
        name: pg-appuser-secret

  # Backup para S3
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

  # HA Configuration
  primaryUpdateStrategy: unsupervised

  # Affinity para distribuir pods em nodes diferentes
  affinity:
    enablePodAntiAffinity: true
    topologyKey: kubernetes.io/hostname
    podAntiAffinityType: required  # ou preferred
\`\`\`

### ScheduledBackup (Backup Automático)
\`\`\`yaml
apiVersion: postgresql.cnpg.io/v1
kind: ScheduledBackup
metadata:
  name: pg-daily-backup
  namespace: database
spec:
  schedule: "0 2 * * *"   # 2h AM diariamente
  backupOwnerReference: self
  cluster:
    name: pg-production
  method: barmanObjectStore
  target: prefer-standby  # fazer backup da réplica, não do primary
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
  type: rw  # rw = primary | ro = replicas

  pgbouncer:
    poolMode: transaction
    parameters:
      max_client_conn: "1000"
      default_pool_size: "50"
      reserve_pool_size: "10"
      reserve_pool_timeout: "5"
      server_idle_timeout: "600"
      log_connections: "1"

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

### Restore de PITR (Point-In-Time Recovery)
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

  # Restaurar do backup S3 em um ponto específico no tempo
  bootstrap:
    recovery:
      source: pg-production
      recoveryTarget:
        targetTime: "2024-01-15 14:30:00"  # PITR!
        # targetLSN: "0/3000060"          # ou via LSN
        # targetName: "before-migration"   # ou via named savepoint

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

## Erros Comuns

### 1. Cluster fica em estado "Setting up primary"
**Causa**: Problemas de storage (PVC não criado) ou credenciais inválidas.
**Solução**: \`kubectl describe cluster my-cluster\` para ver eventos.

### 2. Backup falha por permissões S3
**Causa**: IAM/Secret com permissões insuficientes para o bucket.
**Solução**: Verificar permissões: s3:PutObject, s3:GetObject, s3:DeleteObject no bucket.

### 3. Failover lento (mais de 60s)
**Causa**: failoverDelay ou primaryUpdateStrategy muito conservadores.
**Solução**: Ajustar \`spec.failoverDelay\` e verificar readiness probes.

### 4. Réplicas desincronizadas (lag alto)
**Causa**: Network lento ou primary com alta carga de writes.
**Solução**: Aumentar \`max_wal_senders\`, verificar bandwidth entre nodes.

### 5. PgBouncer rejeitando conexões
**Causa**: Usuário não tem permissão no pg_hba ou max_client_conn atingido.
**Solução**: Verificar \`log_connections\` no PgBouncer e aumentar limites.

## Killer.sh Style Challenge

**Contexto**: O cluster PostgreSQL de produção teve um acidente — um desenvolvedor rodou DROP TABLE payments por engano às 14:25. Você tem backups S3 contínuos via WAL streaming. Você precisa:
1. Criar um cluster de recuperação restaurando para 14:24 (1 minuto antes do acidente)
2. Verificar que a tabela payments existe no cluster restaurado
3. Fazer dump da tabela e importar no cluster de produção
4. Verificar que o serviço está operacional`,

  quiz: [
    {
      question: 'Qual service do CloudNativePG deve ser usado para writes (INSERT, UPDATE, DELETE)?',
      options: [
        'cluster-r (round-robin)',
        'cluster-ro (read-only replicas)',
        'cluster-rw (primary)',
        'cluster-any (qualquer instância)'
      ],
      correct: 2,
      explanation: 'O service cluster-rw sempre aponta para o primary — a única instância que aceita escritas. Em um failover, o CNPG atualiza automaticamente o endpoint deste service para o novo primary eleito. cluster-ro distribui reads entre réplicas; cluster-r inclui o primary no round-robin.',
      reference: 'Arquitetura: Services CNPG — seção de arquitetura na teoria.'
    },
    {
      question: 'O que é o Point-In-Time Recovery (PITR) no CNPG?',
      options: [
        'Um backup snapshot que captura o estado do banco em um momento específico',
        'A capacidade de restaurar o banco para qualquer momento no tempo usando WAL archive',
        'Uma funcionalidade que pausa o banco em um ponto específico para manutenção',
        'Um tipo de réplica que mantém dados históricos para consultas passadas'
      ],
      correct: 1,
      explanation: 'PITR usa o WAL (Write-Ahead Log) archive armazenado continuamente no S3. Para restaurar para um ponto no tempo: aplica um base backup e então replays os WAL files até o momento desejado (targetTime, targetLSN, ou targetName). Permite desfazer operações acidentais com granularidade de segundos.',
      reference: 'Conceito: PITR — YAML "Restore de PITR" na teoria.'
    },
    {
      question: 'Qual é a principal vantagem do PgBouncer em modo "transaction" vs "session"?',
      options: [
        'Transaction mode é mais rápido porque não verifica autenticação',
        'Transaction mode permite muito mais conexões de app com menos conexões no PostgreSQL',
        'Transaction mode suporta prepared statements que session mode não suporta',
        'Transaction mode replica dados automaticamente entre instâncias'
      ],
      correct: 1,
      explanation: 'Em transaction mode, uma conexão do pool é usada apenas durante uma transação e devolvida imediatamente após. Isso permite que 1000 clientes da app compartilhem 50 conexões reais no Postgres, pois conexões ficam livres entre transações. Session mode mantém a conexão pelo tempo de vida da sessão do cliente.',
      reference: 'Conceito: PgBouncer — seção "PgBouncer — Connection Pooling" na teoria.'
    },
    {
      question: 'Qual comando do plugin kubectl cnpg força uma promoção de réplica para primary?',
      options: [
        'kubectl cnpg switchover my-cluster -n database',
        'kubectl cnpg promote my-cluster my-cluster-2 -n database',
        'kubectl cnpg failover my-cluster primary -n database',
        'kubectl cnpg election my-cluster --promote-pod=my-cluster-2'
      ],
      correct: 1,
      explanation: 'kubectl cnpg promote faz um switchover controlado, promovendo uma réplica específica (my-cluster-2) para primary. O primary atual é rebaixado a réplica. É diferente do failover automático (que é reativo a falhas) — promote é uma operação controlada.',
      reference: 'Comandos: kubectl cnpg promote — seção "Gerenciar Clusters CNPG" na teoria.'
    },
    {
      question: 'Ao criar um ScheduledBackup, o campo "target: prefer-standby" faz o quê?',
      options: [
        'Faz backup apenas se houver uma réplica disponível',
        'Prefere fazer backup de uma réplica para não impactar o primary em produção',
        'Agenda o backup apenas durante período de standby (baixo uso)',
        'Cria um standby cluster como destino do backup'
      ],
      correct: 1,
      explanation: 'target: prefer-standby instrui o CNPG a fazer o backup em uma réplica (standby) quando disponível, em vez do primary. Isso reduz o impacto de I/O do backup no primary de produção, mantendo a latência de escrita baixa durante o processo de backup.',
      reference: 'YAML: ScheduledBackup — exemplo na teoria.'
    },
    {
      question: 'Quantas instâncias mínimas são necessárias para HA real (tolerância a falha de 1 instância) no CNPG?',
      options: [
        '1 instância (primary)',
        '2 instâncias (primary + 1 réplica)',
        '3 instâncias (primary + 2 réplicas)',
        '5 instâncias para quorum adequado'
      ],
      correct: 2,
      explanation: '3 instâncias é o mínimo para HA real: 1 primary + 2 réplicas. Com 2 instâncias, se o primary cai, sobra 1 réplica que pode virar primary, mas você fica sem HA até o primary original voltar. Com 3, uma falha deixa você ainda com 1 primary + 1 réplica (HA mantido).',
      reference: 'Arquitetura: CNPG — YAML de exemplo com instances: 3 na teoria.'
    },
    {
      question: 'O que configura o campo "primaryUpdateStrategy: unsupervised" no Cluster CNPG?',
      options: [
        'Permite que qualquer réplica possa se tornar primary sem autorização',
        'O operador realiza failover/switchover automaticamente sem intervenção humana',
        'O primary pode atualizar imagem sem notificar réplicas',
        'Desabilita todas as verificações de saúde do primary'
      ],
      correct: 1,
      explanation: 'primaryUpdateStrategy: unsupervised permite que o operador CNPG realize atualizações e switchovers automaticamente sem aguardar aprovação manual. É necessário para rolling upgrades sem downtime. A alternativa "supervised" requer confirmação manual para cada switchover.',
      reference: 'Config: primaryUpdateStrategy — YAML do Cluster na teoria.'
    },
    {
      question: 'Por que o CNPG usa affinity com topologyKey: kubernetes.io/hostname?',
      options: [
        'Para garantir que todos os pods rodem no mesmo node para reduzir latência',
        'Para distribuir pods em nodes diferentes, evitando ponto único de falha',
        'Para associar pods ao hostname do banco de dados externo',
        'Para que o Kubernetes selecione nodes com SSD automaticamente'
      ],
      correct: 1,
      explanation: 'Pod anti-affinity com topologyKey: kubernetes.io/hostname garante que cada pod do cluster PostgreSQL rode em um node diferente. Se um node falha, apenas 1 instância é afetada — as outras continuam no ar. Sem isso, todas as instâncias podem estar no mesmo node e uma falha derruba tudo.',
      reference: 'Config: affinity — YAML do Cluster na teoria.'
    }
  ],

  flashcards: [
    {
      front: 'Quais services o CNPG cria e para que serve cada um?',
      back: 'cluster-rw (read-write):\n- Aponta para o PRIMARY\n- Aceita reads + writes\n- Atualizado automaticamente em failover\n- Use para: INSERT, UPDATE, DELETE, DDL\n\ncluster-ro (read-only):\n- Round-robin entre RÉPLICAS\n- Somente leitura\n- Use para: queries de analytics, relatórios\n\ncluster-r (read):\n- Round-robin em TODAS as instâncias\n- Inclui primary e réplicas\n- Use para: reads não-críticos\n\nConexão: host=my-cluster-rw port=5432 dbname=appdb user=appuser'
    },
    {
      front: 'O que é PITR e como funciona no CNPG?',
      back: 'PITR = Point-In-Time Recovery\n\nComo funciona:\n1. Base backup armazenado no S3 (full backup)\n2. WAL archive contínuo no S3 (delta de cada transação)\n3. Para restaurar para T:\n   - Aplica base backup mais recente antes de T\n   - Replay de WAL files até exatamente T\n\nUso no CNPG:\nbootstrap:\n  recovery:\n    source: source-cluster\n    recoveryTarget:\n      targetTime: "2024-01-15 14:24:00"\n\nCasos de uso:\n- DROP TABLE acidental\n- Dados corrompidos por bug\n- Auditoria histórica'
    },
    {
      front: 'Como instalar e usar o plugin kubectl cnpg?',
      back: '# Instalar plugin\nkubectl krew install cnpg\n# ou\ncurl -sSfL https://github.com/cloudnative-pg/cloudnative-pg/releases/download/v1.23.0/kubectl-cnpg_1.23.0_linux_x86_64.tar.gz | tar xz -C /usr/local/bin\n\n# Comandos principais\nkubectl cnpg status my-cluster -n database\n# Status, réplicas, lag, backup status\n\nkubectl cnpg promote my-cluster my-cluster-2 -n database\n# Switchover manual para my-cluster-2\n\nkubectl cnpg backup my-cluster -n database\n# Trigger backup manual\n\nkubectl cnpg logs cluster my-cluster -n database\n# Ver logs de todas as instâncias'
    },
    {
      front: 'Quais são os modos do PgBouncer e quando usar cada um?',
      back: 'transaction (recomendado):\n- Pool liberado após cada transação\n- Alta densidade: 1000 clients → 50 conexões\n- Limitação: não suporta prepared statements entre transações\n\nsession:\n- Pool por sessão completa\n- Mesma conexão até o cliente desconectar\n- Suporta prepared statements, advisory locks\n- Menor densidade que transaction\n\nstatement:\n- Pool por statement individual\n- Muito restritivo — evitar\n\nRecomendação geral:\n- APIs REST stateless → transaction mode\n- Apps com prepared statements → session mode'
    },
    {
      front: 'Como fazer backup automático no CNPG?',
      back: 'ScheduledBackup CRD:\n\napiVersion: postgresql.cnpg.io/v1\nkind: ScheduledBackup\nmetadata:\n  name: pg-daily-backup\nspec:\n  schedule: "0 2 * * *"  # diário às 2h\n  cluster:\n    name: pg-production\n  target: prefer-standby  # não impacta primary\n  method: barmanObjectStore  # backup para S3\n\n# Retenção (no Cluster spec):\nbackup:\n  retentionPolicy: "30d"  # manter 30 dias\n\n# Verificar backups:\nkubectl get backups -n database\nkubectl get scheduledbackups -n database'
    },
    {
      front: 'Como o failover automático funciona no CNPG?',
      back: 'Processo de Failover:\n1. Primary fica indisponível (crash, OOMKill, node down)\n2. CNPG operador detecta via health checks\n3. Verifica qual réplica tem LSN mais avançado\n4. Promove essa réplica a primary\n5. Atualiza Service -rw para apontar ao novo primary\n6. Outras réplicas se reconectam ao novo primary\n7. Quando pod original volta → reconfigura como réplica\n\nTempo típico: 10-30 segundos\n\nPara controlar:\n  spec.failoverDelay: 10s  # espera antes de failover\n  spec.primaryUpdateStrategy: unsupervised  # automático'
    },
    {
      front: 'Como configurar backup CNPG para AWS S3?',
      back: '# 1. Criar Secret com credenciais\nkubectl create secret generic s3-creds \\\n  -n database \\\n  --from-literal=ACCESS_KEY_ID=xxx \\\n  --from-literal=SECRET_ACCESS_KEY=yyy\n\n# 2. No Cluster spec:\nbackup:\n  barmanObjectStore:\n    destinationPath: "s3://bucket/path"\n    s3Credentials:\n      accessKeyId:\n        name: s3-creds\n        key: ACCESS_KEY_ID\n      secretAccessKey:\n        name: s3-creds\n        key: SECRET_ACCESS_KEY\n    wal:\n      compression: gzip\n    data:\n      compression: bzip2\n      encryption: AES256\n  retentionPolicy: "30d"\n\n# Com IRSA (recomendado no EKS):\npodIdentity:\n  provider: AzureWorkloadIdentity\n  # ou: aws.amazon.com/role-arn annotation no SA'
    },
    {
      front: 'Por que usar 3 instâncias mínimas no CNPG para HA?',
      back: 'Comparação:\n\n1 instância:\n- Sem HA (SPOF)\n- Apenas dev/testes\n\n2 instâncias (primary + 1 réplica):\n- Failover possível, MAS:\n- Após falha do primary: 1 réplica vira primary\n- Sem réplica de leitura até primary original voltar\n- Sem HA durante a recuperação\n\n3 instâncias (primary + 2 réplicas):\n- Após falha de qualquer 1: ainda há 1 primary + 1 réplica\n- HA mantido durante recuperação\n- 1 réplica disponível para reads\n\n5 instâncias:\n- Tolerância a 2 falhas simultâneas\n- Para bancos críticos com RTO ~0'
    }
  ],

  lab: {
    scenario: 'Você precisa configurar um PostgreSQL de produção com HA para a aplicação de e-commerce. O banco deve ter 3 instâncias, backup automático diário e connection pooling via PgBouncer para suportar 500+ conexões simultâneas.',
    objective: 'Instalar o operador CloudNativePG, criar um cluster PostgreSQL HA com 3 instâncias, configurar PgBouncer e testar failover automático.',
    duration: '40-50 minutos',
    steps: [
      {
        title: 'Instalar o Operador CloudNativePG',
        instruction: `Instale o operador CloudNativePG via Helm no namespace \`cnpg-system\` e verifique que os CRDs foram criados corretamente.

Após a instalação, verifique que o operador está Running e que os CRDs do CNPG estão disponíveis no cluster.`,
        hints: [
          'O repositório Helm é cnpg/cloudnative-pg',
          'Os CRDs incluem: clusters, backups, scheduledbackups, poolers',
          'O operador precisa de permissões cluster-wide para gerenciar recursos'
        ],
        solution: `\`\`\`bash
# Adicionar repositório
helm repo add cnpg https://cloudnative-pg.github.io/charts
helm repo update

# Instalar operador
helm install cnpg cnpg/cloudnative-pg \\
  --namespace cnpg-system \\
  --create-namespace

# Aguardar operador ficar pronto
kubectl wait --for=condition=ready pod \\
  -l app.kubernetes.io/name=cloudnative-pg \\
  -n cnpg-system --timeout=120s

# Criar namespace para o banco
kubectl create namespace database

# Criar secrets
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
# Verificar operador
kubectl get pods -n cnpg-system
# Saída esperada: cnpg-xxx   1/1   Running

# Verificar CRDs do CNPG
kubectl get crd | grep postgresql.cnpg.io
# Saída esperada:
# backups.postgresql.cnpg.io
# clusters.postgresql.cnpg.io
# poolers.postgresql.cnpg.io
# scheduledbackups.postgresql.cnpg.io

# Verificar secrets
kubectl get secrets -n database
# Saída esperada: pg-superuser-secret, pg-appuser-secret
\`\`\``
      },
      {
        title: 'Criar Cluster PostgreSQL HA com 3 Instâncias',
        instruction: `Crie um Cluster CNPG com 3 instâncias, configurando:
- 3 instâncias (1 primary + 2 réplicas)
- Storage de 5Gi por instância (usar StorageClass disponível)
- Anti-affinity para distribuir em nodes diferentes (preferred)
- Resources adequados
- App database "ecommerce" com usuário "appuser"`,
        hints: [
          'Use storageClass: standard ou a disponível no seu cluster',
          'enablePodAntiAffinity: true distribui pods em nodes diferentes',
          'O operador criará automaticamente os services -rw, -ro, -r'
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

  postgresql:
    parameters:
      max_connections: "200"
      shared_buffers: "256MB"
      log_statement: "ddl"
      log_duration: "on"
EOF

# Aguardar cluster ficar pronto (pode demorar 2-3 minutos)
kubectl wait --for=condition=ready cluster pg-ecommerce \\
  -n database --timeout=180s
\`\`\``,
        verify: `\`\`\`bash
# Verificar status do cluster
kubectl get cluster pg-ecommerce -n database
# Saída esperada: pg-ecommerce   3   Ready

# Verificar pods
kubectl get pods -n database -l cnpg.io/cluster=pg-ecommerce
# Saída esperada: 3 pods Running

# Verificar services criados
kubectl get svc -n database -l cnpg.io/cluster=pg-ecommerce
# Saída esperada:
# pg-ecommerce-rw   ClusterIP   ...   5432/TCP
# pg-ecommerce-ro   ClusterIP   ...   5432/TCP
# pg-ecommerce-r    ClusterIP   ...   5432/TCP

# Testar conexão ao primary
APP_PASS=\$(kubectl get secret pg-appuser-secret -n database \\
  -o jsonpath='{.data.password}' | base64 -d)
kubectl exec -n database pg-ecommerce-1 -- \\
  psql postgresql://appuser:\$APP_PASS@pg-ecommerce-rw/ecommerce \\
  -c "SELECT current_database(), pg_is_in_recovery();"
# Saída esperada: ecommerce | f (false = primary)
\`\`\``
      },
      {
        title: 'Configurar PgBouncer e Testar Failover',
        instruction: `1. Crie um Pooler (PgBouncer) em modo transaction para o primary
2. Verifique que o PgBouncer aceita conexões
3. Delete o pod primary e observe o failover automático
4. Verifique que o service -rw aponta para o novo primary após failover`,
        hints: [
          'O Pooler type rw se conecta ao service -rw automaticamente',
          'Após deletar o primary, aguarde 15-30 segundos para o failover',
          'O novo primary será o pod com maior LSN das réplicas',
          'pg_is_in_recovery() retorna false no primary, true nas réplicas'
        ],
        solution: `\`\`\`bash
# Criar PgBouncer Pooler
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
        limits:
          cpu: 500m
          memory: 256Mi
EOF

kubectl wait --for=condition=ready pod \\
  -l cnpg.io/poolerName=pg-pooler-rw \\
  -n database --timeout=60s

# Identificar pod primary
kubectl get pods -n database -l cnpg.io/cluster=pg-ecommerce \\
  -o json | jq -r '.items[] | select(.metadata.labels["cnpg.io/instanceRole"]=="primary") | .metadata.name'

# Inserir dados antes do failover
APP_PASS=\$(kubectl get secret pg-appuser-secret -n database \\
  -o jsonpath='{.data.password}' | base64 -d)
kubectl exec -n database pg-ecommerce-1 -- \\
  psql postgresql://appuser:\$APP_PASS@pg-ecommerce-rw/ecommerce \\
  -c "CREATE TABLE orders (id SERIAL PRIMARY KEY, product TEXT); INSERT INTO orders (product) VALUES ('Widget'), ('Gadget');"

# Deletar primary para simular failover
PRIMARY_POD=\$(kubectl get pods -n database -l "cnpg.io/cluster=pg-ecommerce,cnpg.io/instanceRole=primary" -o jsonpath='{.items[0].metadata.name}')
echo "Deleting primary: \$PRIMARY_POD"
kubectl delete pod \$PRIMARY_POD -n database

# Aguardar failover
sleep 30
kubectl get pods -n database -l cnpg.io/cluster=pg-ecommerce

# Verificar novo primary
kubectl get pods -n database -l "cnpg.io/cluster=pg-ecommerce,cnpg.io/instanceRole=primary"
\`\`\``,
        verify: `\`\`\`bash
# Verificar Pooler
kubectl get pooler pg-pooler-rw -n database
# Saída esperada: pg-pooler-rw   Ready

kubectl get svc pg-pooler-rw -n database
# Saída esperada: service ClusterIP na porta 5432

# Verificar que houve failover (pod primary mudou)
kubectl get pods -n database -l cnpg.io/cluster=pg-ecommerce \\
  -o json | jq -r '.items[] | {name: .metadata.name, role: .metadata.labels["cnpg.io/instanceRole"]}'
# Saída esperada: 1 pod com role=primary, outros com role=replica

# Verificar dados persistiram após failover
APP_PASS=\$(kubectl get secret pg-appuser-secret -n database \\
  -o jsonpath='{.data.password}' | base64 -d)
kubectl exec -n database -l "cnpg.io/cluster=pg-ecommerce,cnpg.io/instanceRole=primary" -- \\
  psql postgresql://appuser:\$APP_PASS@pg-ecommerce-rw/ecommerce \\
  -c "SELECT * FROM orders;" 2>/dev/null
# Saída esperada: Widget, Gadget (dados persistidos após failover)

# Verificar cluster status
kubectl describe cluster pg-ecommerce -n database | grep -A5 "Status:"
# Saída esperada: ReadyInstances: 3, Phase: Cluster in healthy state
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Cluster CNPG travado em "Setting up primary"',
      difficulty: 'medium',
      symptom: 'O Cluster CNPG foi criado mas fica em estado "Setting up primary" por mais de 10 minutos. Nenhuma instância fica Running.',
      diagnosis: `\`\`\`bash
# Ver status do cluster
kubectl describe cluster my-cluster -n database | tail -30

# Ver eventos
kubectl get events -n database --sort-by=.lastTimestamp | tail -20

# Ver logs do pod que está sendo criado
kubectl logs -n database my-cluster-1 -f

# Ver se PVC foi criado
kubectl get pvc -n database

# Verificar se StorageClass existe e tem provisioner
kubectl get storageclass

# Ver logs do operador CNPG
kubectl logs -n cnpg-system -l app.kubernetes.io/name=cloudnative-pg --tail=50 | \\
  grep -i "error\\|cluster"
\`\`\``,
      solution: `**Causa 1**: PVC em Pending — StorageClass sem provisioner ou sem capacity.
\`\`\`bash
kubectl describe pvc -n database | grep -A5 "Events:"
# Se "no persistent volumes available": provisioner não está instalado
# Verificar StorageClass
kubectl get storageclass
# Usar uma StorageClass que existe e tem provisioner: <name> configurado
\`\`\`

**Causa 2**: Secret de credenciais não encontrado ou chave errada.
\`\`\`bash
# Verificar se secret existe com as chaves corretas
kubectl get secret pg-superuser-secret -n database -o yaml
# CNPG espera chaves: username e password
# Se faltando, recriar o secret com as chaves corretas
\`\`\`

**Causa 3**: Resources insuficientes no cluster.
\`\`\`bash
kubectl describe pod my-cluster-1 -n database | grep -A5 "Events:"
# Se "Insufficient cpu/memory": reduzir requests no Cluster spec ou adicionar nodes
\`\`\``
    },
    {
      title: 'Backup WAL falhando — arquivos não chegam no S3',
      difficulty: 'hard',
      symptom: 'O cluster PostgreSQL está rodando mas os backups WAL não chegam no bucket S3. O campo LastSuccessfulBackup na status está vazio há 24h.',
      diagnosis: `\`\`\`bash
# Ver status de backup no cluster
kubectl describe cluster my-cluster -n database | grep -A10 "Backup"

# Ver logs do container de backup (barman-cloud-wal-archive)
kubectl logs -n database my-cluster-1 -c barman-cloud-wal-archive 2>/dev/null || \\
  kubectl logs -n database my-cluster-1 | grep -i "barman\\|wal\\|backup\\|s3"

# Verificar Secret de credenciais S3
kubectl get secret s3-creds -n database -o yaml

# Testar acesso S3 manualmente
kubectl exec -n database my-cluster-1 -- \\
  bash -c 'aws s3 ls s3://my-bucket/path/ --region us-east-1' 2>&1

# Verificar configuração de backup no Cluster
kubectl get cluster my-cluster -n database -o yaml | \\
  grep -A20 "barmanObjectStore"
\`\`\``,
      solution: `**Causa 1**: Credenciais S3 inválidas ou com permissões insuficientes.
\`\`\`bash
# Verificar política IAM necessária
# s3:PutObject, s3:GetObject, s3:DeleteObject, s3:ListBucket
# No bucket path configurado

# Recriar Secret com credenciais corretas
kubectl create secret generic s3-creds \\
  -n database \\
  --from-literal=ACCESS_KEY_ID=CORRECT_KEY \\
  --from-literal=SECRET_ACCESS_KEY=CORRECT_SECRET \\
  --dry-run=client -o yaml | kubectl apply -f -

# Forçar rollout para pegar novos secrets
kubectl rollout restart statefulset my-cluster -n database
\`\`\`

**Causa 2**: destinationPath com bucket ou path errado.
\`\`\`bash
# Verificar path exato
# Deve incluir trailing slash: s3://bucket/prefix/
# Testar acesso:
kubectl exec -n database my-cluster-1 -- \\
  aws s3 ls s3://correct-bucket/ 2>&1

# Corrigir via kubectl edit ou patch:
kubectl edit cluster my-cluster -n database
# Corrigir: spec.backup.barmanObjectStore.destinationPath
\`\`\`

**Causa 3**: Com IRSA/Workload Identity — ServiceAccount não tem annotation.
\`\`\`bash
# Para EKS IRSA, verificar annotation no SA do pod
kubectl get sa -n database my-cluster -o yaml | \\
  grep "eks.amazonaws.com/role-arn"
# Se ausente, adicionar ao Cluster spec:
# spec.serviceAccountTemplate.metadata.annotations:
#   eks.amazonaws.com/role-arn: arn:aws:iam::123:role/postgres-backup
\`\`\``
    }
  ]
};
