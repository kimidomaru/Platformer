window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['aws-resilient-arch/backup-recovery'] = {
  theory: `# Backup & Disaster Recovery

## Relevancia no Exame
> **Design Resilient Architectures** vale **26%** do SAA-C03. Estrategias de DR, RPO/RTO, AWS Backup e features de backup por servico sao temas frequentes.

## RPO e RTO

- **RPO (Recovery Point Objective)**: perda de dados maxima aceitavel (quanto dados voce pode perder?)
- **RTO (Recovery Time Objective)**: tempo de inatividade maximo aceitavel (quanto tempo para recuperar?)
- Menor RPO/RTO = maior custo

## Estrategias de Disaster Recovery

| Estrategia | RPO | RTO | Custo | Descricao |
|------------|-----|-----|-------|-----------|
| **Backup & Restore** | Horas | Horas | Menor | Backup no S3, restaure quando necessario |
| **Pilot Light** | Minutos | Horas | Baixo | Infra core rodando (DB replicado), escale no failover |
| **Warm Standby** | Segundos | Minutos | Medio | Copia reduzida de producao sempre rodando |
| **Multi-Site Active/Active** | Quase-zero | Quase-zero | Maior | Producao completa em 2+ Regions |

## AWS Backup

Gerenciamento centralizado de backup em servicos AWS:
- **Backup Plans**: agendamento (diario, semanal), retencao (dias/meses/anos), lifecycle (cold storage)
- **Backup Vaults**: containers criptografados para backups
- **Cross-Region Copy**: replique backups para outra Region para DR
- **Cross-Account Backup**: copie para conta separada (isolamento contra ransomware)
- **Audit Manager**: relatorios de compliance para politicas de backup

## Features de Backup por Servico

### S3
- **Versioning**: recupere objetos sobrescritos/deletados
- **Cross-Region Replication (CRR)**: replicacao async para outra Region
- **Object Lock**: WORM compliance
  - Governance mode: permissao especial pode sobrescrever
  - Compliance mode: NINGUEM pode deletar, nem root (imutavel)

### RDS
- **Backups automatizados**: 0-35 dias retencao, PITR (dentro de 5 minutos)
- **Snapshots manuais**: persistem ate serem deletados
- **Copia cross-Region**: para DR em outra Region

### Aurora
- **Backup continuo**: automatico para S3
- **Backtrack**: rebobinar ate 72h (in-place, segundos, apenas MySQL)
- **Cloning**: copia rapida copy-on-write para dev/test
- **Global Database**: cross-Region com <1s replicacao

### EBS
- **Snapshots**: incrementais (armazenados no S3), copie para outras Regions
- **DLM**: agendamento automatizado de snapshots
- **Fast Snapshot Restore**: elimina latencia no primeiro acesso

### DynamoDB
- **PITR**: backup continuo 35 dias, restaure para qualquer segundo
- **On-demand backup**: backup completo persiste ate ser deletado
- **Export to S3**: query com Athena

## AWS DRS (Elastic Disaster Recovery)

Antigo CloudEndure:
- Replicacao continua bloco-a-bloco de on-prem/cloud para AWS
- RPO sub-segundo
- Failover e failback automatizados
- Testes nao-disruptivos (drill sem impactar producao)

## Erros Comuns

- Confundir RPO (perda de dados) com RTO (tempo de inatividade)
- Escolher Multi-Site para cenario com orcamento limitado
- Esquecer que Object Lock Compliance nao pode ser sobrescrito
- Nao saber que Aurora Backtrack e mais rapido que restore de snapshot
`,

  quiz: [
    {
      question: 'Qual a diferenca entre RPO e RTO?',
      options: ['RPO e custo, RTO e tempo', 'RPO e perda de dados maxima aceitavel, RTO e tempo de inatividade maximo aceitavel', 'RPO e frequencia de backup, RTO e velocidade de restore', 'Sao a mesma coisa'],
      correct: 1,
      explanation: 'RPO: quanta informacao voce pode perder (medido em tempo). RTO: quanto tempo o sistema pode ficar fora. Exemplo: RPO 1h = max 1 hora de dados perdidos.',
      reference: 'RPO = tolerancia a perda de dados. RTO = tolerancia a tempo de inatividade.'
    },
    {
      question: 'Qual estrategia de DR tem o menor custo mas maior RPO/RTO?',
      options: ['Multi-Site Active/Active', 'Warm Standby', 'Pilot Light', 'Backup & Restore'],
      correct: 3,
      explanation: 'Backup & Restore: estrategia mais barata com horas de RPO e RTO. Voce faz backup no S3 e restaura quando o desastre ocorre.',
      reference: 'Custo: Backup&Restore < Pilot Light < Warm Standby < Multi-Site Active/Active.'
    },
    {
      question: 'O que o modo Compliance do S3 Object Lock faz?',
      options: ['Criptografa objetos', 'Previne QUALQUER delecao incluindo pela conta root durante o periodo de retencao', 'Requer MFA para deletar', 'Trava a bucket policy'],
      correct: 1,
      explanation: 'Modo Compliance: absolutamente NINGUEM pode deletar ou sobrescrever o objeto durante o periodo de retencao. Nem root nem AWS support. Para compliance regulatorio (SEC, FINRA).',
      reference: 'Compliance = imutavel, ninguem pode sobrescrever. Governance = permissao especial pode sobrescrever.'
    },
    {
      question: 'Qual a vantagem do Aurora Backtrack sobre restore de snapshot?',
      options: ['Backtrack e gratis', 'Backtrack rebobina in-place em segundos sem criar nova instancia', 'Backtrack funciona para todos os bancos', 'Backtrack tem retencao ilimitada'],
      correct: 1,
      explanation: 'Backtrack rebobina in-place em segundos (ate 72 horas). Restore de snapshot cria nova instancia e leva minutos/horas. Backtrack e apenas Aurora MySQL.',
      reference: 'Backtrack = rebobinar in-place (segundos). Restore snapshot = nova instancia (minutos/horas).'
    },
    {
      question: 'Contra o que o AWS Backup Cross-Account protege?',
      options: ['Falha de Region', 'Ransomware e contas comprometidas', 'Corrupcao de dados S3', 'Falhas de rede'],
      correct: 1,
      explanation: 'Cross-Account copia backups para uma conta AWS separada. Protege contra ransomware que compromete a conta principal e deleta todos os backups.',
      reference: 'Cross-Account = protecao ransomware. Cross-Region = DR regional. Ambos = protecao maxima.'
    },
    {
      question: 'Como funciona o Point-in-Time Recovery do RDS?',
      options: ['Apenas snapshots manuais', 'Backups automatizados continuos permitindo restore para qualquer ponto dentro do periodo de retencao', 'Requer AWS Backup', 'So funciona com Multi-AZ'],
      correct: 1,
      explanation: 'RDS backups automatizados sao continuos. PITR permite restaurar para qualquer segundo dentro do periodo de retencao (0-35 dias). Cria nova instancia DB.',
      reference: 'PITR: qualquer segundo no periodo de retencao. Backups automatizados necessarios. Cria nova instancia.'
    },
    {
      question: 'O que e a estrategia Pilot Light de DR?',
      options: ['Copia completa de producao na Region DR', 'Apenas backups armazenados, nada rodando', 'Infra core (banco) sempre rodando na DR, escalar compute no failover', 'Failover baseado apenas em DNS'],
      correct: 2,
      explanation: 'Pilot Light: infra minima core sempre rodando (ex: banco replicado). No desastre, escale compute (lance EC2, atualize DNS). Minutos RPO, horas RTO.',
      reference: 'Pilot Light: DB rodando, compute desligado. Warm Standby: stack completo reduzido rodando.'
    },
    {
      question: 'O que o EBS Fast Snapshot Restore (FSR) faz?',
      options: ['Cria snapshots mais rapido', 'Elimina latencia ao criar volumes de snapshots (sem penalidade de inicializacao)', 'Comprime snapshots', 'Habilita copia cross-Region'],
      correct: 1,
      explanation: 'Sem FSR, volumes de snapshots tem latencia de inicializacao no primeiro acesso. FSR pre-inicializa o volume para performance completa imediata. Custo extra por AZ por snapshot.',
      reference: 'FSR = performance completa imediata de snapshot. Sem FSR = inicializacao lazy no primeiro acesso.'
    }
  ],

  flashcards: [
    { front: 'RPO vs RTO?', back: 'RPO (Recovery Point Objective): PERDA DE DADOS maxima aceitavel (tempo). RTO (Recovery Time Objective): TEMPO DE INATIVIDADE maximo aceitavel. Menor RPO/RTO = maior custo. RPO 1h = max 1 hora de dados perdidos.' },
    { front: 'Estrategias DR por custo/recovery?', back: 'Backup&Restore: mais barato, horas RPO/RTO. Pilot Light: DB rodando, min RPO, horas RTO. Warm Standby: stack reduzido, seg RPO, min RTO. Multi-Site Active/Active: mais caro, quase-zero.' },
    { front: 'Features AWS Backup?', back: 'Centralizado: backup plans (agenda+retencao+lifecycle), vaults, cross-Region copy, cross-account (protecao ransomware), Audit Manager. Suporta: EC2, EBS, RDS, Aurora, DynamoDB, EFS, FSx, S3.' },
    { front: 'Modos S3 Object Lock?', back: 'Governance: permissao especial (s3:BypassGovernanceRetention) pode sobrescrever. Compliance: NINGUEM pode deletar/sobrescrever durante retencao, nem root. Para requisitos regulatorios.' },
    { front: 'Opcoes backup RDS?', back: 'Automatizado: 0-35 dias retencao, PITR (qualquer segundo). Snapshots manuais: persistem ate deletar. Copia cross-Region: para DR. Export S3: Parquet para analytics. PITR cria nova instancia.' },
    { front: 'Features backup Aurora?', back: 'Backup continuo para S3. Backtrack: rebobinar ate 72h in-place (segundos, apenas MySQL). Cloning: copy-on-write para dev/test. Global Database: cross-Region <1s replicacao.' },
    { front: 'O que e AWS DRS?', back: 'Elastic Disaster Recovery (ex-CloudEndure): replicacao continua bloco-a-bloco on-prem/cloud para AWS. RPO sub-segundo. Failover/failback automatizado. Testes nao-disruptivos.' },
    { front: 'Opcoes backup DynamoDB?', back: 'PITR: backup continuo 35 dias, restaure para qualquer segundo. On-demand: backup completo, persiste ate deletar. Export S3: query com Athena. Global Tables para multi-Region active-active.' }
  ],

  lab: {
    scenario: 'Projete um plano de disaster recovery para uma aplicacao critica.',
    objective: 'Praticar configuracao de backups, replicacao cross-Region e estrategias de DR.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Configurar AWS Backup Plan',
        instruction: 'Crie um backup plan com backups diarios de RDS e EBS com retencao de 30 dias e copia cross-Region.',
        hints: ['Use aws backup create-backup-plan', 'Adicione cross-Region copy na regra de backup'],
        solution: '```bash\n# Criar vault na Region DR\naws backup create-backup-vault --backup-vault-name dr-vault \\\n  --region us-west-2\n\n# Criar backup plan com agenda diaria\naws backup create-backup-plan --backup-plan \'{"BackupPlanName":"diario-dr","Rules":[{"RuleName":"regra-diaria","TargetBackupVaultName":"primary-vault","ScheduleExpression":"cron(0 3 * * ? *)","Lifecycle":{"DeleteAfterDays":30},"CopyActions":[{"DestinationBackupVaultArn":"arn:aws:backup:us-west-2:ACCT:backup-vault:dr-vault","Lifecycle":{"DeleteAfterDays":30}}]}]}\'\n```',
        verify: '```bash\naws backup list-backup-plans\n# Esperado: plano diario-dr com cross-Region copy para us-west-2\n```'
      },
      {
        title: 'Habilitar S3 Cross-Region Replication',
        instruction: 'Configure CRR de um bucket source (us-east-1) para um bucket destino (us-west-2) para DR.',
        hints: ['Ambos buckets devem ter versioning habilitado', 'Precisa de IAM role para replicacao'],
        solution: '```bash\n# Habilitar versioning em ambos\naws s3api put-bucket-versioning --bucket source-bucket \\\n  --versioning-configuration Status=Enabled\naws s3api put-bucket-versioning --bucket dest-bucket \\\n  --versioning-configuration Status=Enabled --region us-west-2\n\n# Configurar replicacao\naws s3api put-bucket-replication --bucket source-bucket \\\n  --replication-configuration \'{"Role":"arn:aws:iam::ACCT:role/s3-repl-role","Rules":[{"Status":"Enabled","Destination":{"Bucket":"arn:aws:s3:::dest-bucket"},"Filter":{}}]}\'\n```',
        verify: '```bash\naws s3api get-bucket-replication --bucket source-bucket\n# Esperado: regra com Status=Enabled, destino=dest-bucket\n```'
      },
      {
        title: 'Habilitar DynamoDB Point-in-Time Recovery',
        instruction: 'Habilite PITR em uma tabela DynamoDB para backup continuo com janela de 35 dias.',
        hints: ['PITR e por tabela', 'Restore cria uma nova tabela'],
        solution: '```bash\n# Habilitar PITR\naws dynamodb update-continuous-backups \\\n  --table-name Orders \\\n  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true\n```',
        verify: '```bash\naws dynamodb describe-continuous-backups --table-name Orders\n# Esperado: PointInTimeRecoveryStatus = ENABLED\n# EarliestRestorableDateTime e LatestRestorableDateTime mostrados\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'RDS Point-in-Time Restore para Tempo Errado',
      difficulty: 'medium',
      symptom: 'Restaurou RDS para um ponto no tempo mas os dados nao correspondem as expectativas.',
      diagnosis: '```\nProblemas comuns:\n1. Horario de restore em UTC (nao fuso local)\n   Todos os timestamps AWS sao em UTC\n\n2. Granularidade: dentro de ~5 minutos do tempo atual\n   Nao pode restaurar para o ultimo segundo exato\n\n3. Restaurou para nova instancia (nao in-place)\n   PITR cria NOVA instancia DB\n   Precisa atualizar connection string da aplicacao\n\n4. Periodo de retencao expirou\n   Padrao 7 dias, max 35 dias\n\nVerifique:\n  aws rds describe-db-instances --db-instance-identifier DB \\\n    --query "DBInstances[0].LatestRestorableTime"\n```',
      solution: 'Sempre use timestamps UTC para restore. Verifique LatestRestorableTime para o ponto mais recente disponivel. PITR cria NOVA instancia (renomeie/troque quando pronto). Aumente retencao para 35 dias em bancos criticos.'
    },
    {
      title: 'Lag de Replicacao Cross-Region Muito Alto',
      difficulty: 'hard',
      symptom: 'Objetos S3 CRR levando horas para replicar para Region destino em vez de minutos.',
      diagnosis: '```\nFatores de tempo de replicacao CRR:\n1. Tamanho do objeto: objetos grandes demoram mais\n2. S3 Replication Time Control (RTC):\n   Sem RTC: melhor esforco, sem SLA\n   Com RTC: 99.99% dentro de 15 minutos (custo extra)\n\n3. Verificar status de replicacao:\n   aws s3api head-object --bucket source --key KEY\n   x-amz-replication-status: COMPLETED/PENDING/FAILED\n\n4. Falhas comuns:\n   - IAM role sem permissoes\n   - Bucket policy destino bloqueando\n   - Chave KMS nao disponivel na Region destino\n   - Versioning desabilitado em algum bucket\n```',
      solution: 'Habilite S3 Replication Time Control (RTC) para garantia SLA de 15 minutos. Verifique permissoes da IAM role para ambos buckets. Verifique chave KMS disponivel na Region destino. Habilite replication metrics para monitorar. Para objetos existentes, use S3 Batch Replication.'
    }
  ]
};
