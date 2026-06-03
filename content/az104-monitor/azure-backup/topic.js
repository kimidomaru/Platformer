window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['az104-monitor/azure-backup'] = {
  theory: `# Azure Backup & Recovery Services

## Relevância no Exame
> Peso estimado **8-10%** no AZ-104. Proteção de VMs, configuração de Recovery Services Vault e políticas de backup aparecem em cenários práticos.

## Conceitos Fundamentais

### Recovery Services Vault
Repositório centralizado para backups e recuperação:
- Armazena dados de backup de VMs, Files, SQL, SAP
- Suporta **Soft delete**: backups deletados ficam retidos por 14 dias extras
- **Cross-region restore**: restaurar em outra região (requer GRS)
- Replicação: LRS (local) ou GRS (geo-redundante, recomendado)

### Azure Backup para VMs
- **Application consistent backup**: snapshot com VSS (Volume Shadow Copy)
- **File-level recovery**: restaurar arquivos individuais sem restaurar a VM inteira
- **Backup imediato**: instant restore usando snapshots locais (rápido, retido 1-5 dias)
- **Vault backup**: cópia de longa duração no Recovery Services Vault

### Backup Policies
Define frequência e retenção:
\`\`\`
Backup frequency: Daily / Weekly
Time: 2:00 AM UTC
Retention:
  Daily: 30 days
  Weekly: 12 weeks
  Monthly: 12 months
  Yearly: 3 years
\`\`\`

### Azure Site Recovery (ASR)
**Disaster Recovery** (não backup):
- Replica VMs continuamente para outra região
- **RPO**: segundos a minutos (replicação contínua)
- **RTO**: minutos (failover rápido)
- Test failover: testar DR sem impacto na produção
- Suporta: Azure→Azure, on-prem→Azure, Hyper-V→Azure

### RTO vs RPO
- **RPO (Recovery Point Objective)**: quanto de dados você pode perder? (tempo desde último backup)
- **RTO (Recovery Time Objective)**: quanto tempo para restaurar? (tempo de recuperação)

## Comandos Essenciais (Azure CLI)

\`\`\`bash
# Criar Recovery Services Vault
az backup vault create \\
  --name myVault \\
  --resource-group myRG \\
  --location eastus

# Habilitar backup de uma VM
az backup protection enable-for-vm \\
  --vault-name myVault \\
  --resource-group myRG \\
  --vm myVM \\
  --policy-name DefaultPolicy

# Executar backup imediato
az backup protection backup-now \\
  --vault-name myVault \\
  --resource-group myRG \\
  --container-name "iaasvmcontainerv2;myRG;myVM" \\
  --item-name "vm;iaasvmcontainerv2;myRG;myVM" \\
  --retain-until 2025-12-31

# Listar pontos de recuperação
az backup recoverypoint list \\
  --vault-name myVault \\
  --resource-group myRG \\
  --container-name "iaasvmcontainerv2;myRG;myVM" \\
  --item-name "vm;iaasvmcontainerv2;myRG;myVM" \\
  --workload-type VM -o table

# Restaurar VM
az backup restore restore-disks \\
  --vault-name myVault \\
  --resource-group myRG \\
  --container-name "iaasvmcontainerv2;myRG;myVM" \\
  --item-name "vm;iaasvmcontainerv2;myRG;myVM" \\
  --rp-name <recovery-point-name> \\
  --storage-account myStorageAccount \\
  --restore-mode OriginalLocation
\`\`\`

## Erros Comuns

1. **Soft delete habilitado + tentando deletar backup**: com soft delete, dados ficam por mais 14 dias. Para deletar permanentemente, desabilitar soft delete primeiro.
2. **Vault em LRS para cross-region restore**: cross-region restore requer GRS no vault.
3. **Backup de VM criptografada**: VMs com Azure Disk Encryption requerem que o vault tenha acesso ao Key Vault.
4. **ASR ≠ Backup**: ASR é para DR/failover, não substitui backup regular.

## Killer.sh Style Challenge

> Uma VM de produção precisa de backup diário com retenção de 30 dias para backups diários, 12 semanas para semanais, e capacidade de restaurar arquivos individuais. Configure a solução.
>
> **Resposta**: Criar Recovery Services Vault (GRS). Criar Backup Policy com: daily backup às 2AM, retain daily 30 days, retain weekly 12 weeks. Habilitar backup na VM com essa policy. Para restaurar arquivo individual: Backup Items → VM → File Recovery → montar ponto de recuperação como disco temporário.
`,

  quiz: [
    {
      question: 'Qual é a diferença entre Azure Backup e Azure Site Recovery?',
      options: [
        'Backup é para VMs; ASR é para bancos de dados',
        'Backup protege contra perda de dados com pontos de recuperação no tempo; ASR replica continuamente para DR com failover rápido',
        'ASR é mais barato; Backup tem melhor RPO',
        'Não há diferença — são o mesmo serviço'
      ],
      correct: 1,
      explanation: 'Azure Backup cria snapshots periódicos para restauração pontual — RPO = frequência do backup (horas/dias). Azure Site Recovery replica continuamente para outra região — RPO de segundos/minutos, RTO de minutos. Backup = proteção contra corrupção/deleção acidental. ASR = DR contra falha de região completa.',
      reference: 'Backup = recuperação pontual (o que tinha ontem). ASR = continuidade de negócios (failover para outra região em minutos).'
    },
    {
      question: 'O que é RPO no contexto de backup e recuperação?',
      options: [
        'Recovery Point Objective — tempo máximo aceitável de perda de dados',
        'Recovery Process Output — relatório do processo de recuperação',
        'Restore Point Options — opções de ponto de restauração disponíveis',
        'Recovery Performance Optimization — configuração de velocidade de restore'
      ],
      correct: 0,
      explanation: 'RPO (Recovery Point Objective) define o máximo de dados que pode ser perdido em caso de desastre — expresso como um intervalo de tempo. Se RPO = 24h, significa que você pode perder até 24h de dados. Para RPO de 24h, backup diário é suficiente. Para RPO de 15 minutos, você precisa de replicação frequente ou ASR.',
      reference: 'RPO = "até quando posso perder dados?". RTO = "quanto tempo para restaurar?". Ambos definem os requisitos de DR/backup.'
    },
    {
      question: 'O que acontece quando "Soft Delete" está habilitado no Recovery Services Vault e você deleta um backup item?',
      options: [
        'O backup é imediatamente removido',
        'O backup fica retido por 14 dias adicionais antes de ser permanentemente deletado',
        'O backup é movido para Azure Archive automaticamente',
        'Uma aprovação adicional é necessária para deleção'
      ],
      correct: 1,
      explanation: 'Com Soft Delete habilitado (padrão), ao deletar um backup item ele fica em estado "softdeleted" por 14 dias extras. Você pode recuperar o item nesse período. Após 14 dias, é permanentemente deletado. Para deletar imediatamente, é necessário desabilitar soft delete primeiro.',
      reference: 'Soft Delete = proteção contra deleção acidental de backups. Padrão habilitado. Importante para compliance e proteção de dados.'
    }
  ],

  flashcards: [
    {
      front: 'Qual é a diferença entre RPO e RTO?',
      back: '**RPO (Recovery Point Objective)**:\n- "Quanto de dados posso perder?"\n- Tempo máximo desde o último backup aceitável\n- Ex: RPO=24h = pode perder até 24h de dados\n- Determinado pela frequência de backup/replicação\n\n**RTO (Recovery Time Objective)**:\n- "Quanto tempo para voltar ao ar?"\n- Tempo máximo aceitável de indisponibilidade\n- Ex: RTO=4h = sistema deve ser restaurado em 4h\n- Determinado pela velocidade de restore ou failover'
    },
    {
      front: 'Quais são os componentes de uma Backup Policy no Azure?',
      back: '**Backup Policy** define:\n1. **Frequência**: Daily (diário) ou Weekly (semanal)\n2. **Horário**: ex: 2:00 AM UTC (janela de backup)\n3. **Retenção por camada**:\n   - Daily: ex: 30 dias\n   - Weekly: ex: 12 semanas\n   - Monthly: ex: 12 meses\n   - Yearly: ex: 5 anos\n4. **Instant restore**: quantos dias manter snapshots locais (1-5 dias)\n\nDefault Policy: diário às 9:30 PM UTC, retain 30 days.'
    },
    {
      front: 'O que é o Azure Site Recovery (ASR) e quando usar?',
      back: '**ASR** = replicação contínua de VMs para outra região Azure para Disaster Recovery.\n\n**Características:**\n- RPO: segundos a minutos (replicação contínua)\n- RTO: minutos (failover rápido)\n- Test failover sem impacto na produção\n- Suporte: Azure→Azure, VMware/Hyper-V→Azure\n\n**Quando usar:**\n- Aplicações críticas que não podem ter mais de minutos de downtime\n- Compliance que exige DR em outra região geográfica\n- SLA de disponibilidade muito alto (99.99%+)\n\n**Não substitui** backup — são complementares.'
    }
  ],

  lab: {
    scenario: 'Configure backup de uma VM e verifique as políticas de retenção.',
    objective: 'Criar Recovery Services Vault, configurar backup policy e habilitar backup em uma VM.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Criar Recovery Services Vault',
        instruction: 'Crie um Recovery Services Vault com GRS para suporte a cross-region restore.',
        hints: ['\`az backup vault create\` com \`--storage-redundancy GeoRedundant\`'],
        solution: `\`\`\`bash
az group create --name rg-backup-lab --location eastus
az backup vault create \\
  --name technova-vault \\
  --resource-group rg-backup-lab \\
  --location eastus

# Configurar replicação GRS
az backup vault backup-properties set \\
  --vault-name technova-vault \\
  --resource-group rg-backup-lab \\
  --backup-storage-redundancy GeoRedundant
\`\`\``,
        verify: `\`\`\`bash
az backup vault show --name technova-vault --resource-group rg-backup-lab \\
  --query "{Nome:name,Status:properties.provisioningState}" -o table
\`\`\``
      },
      {
        title: 'Verificar políticas de backup disponíveis',
        instruction: 'Liste as políticas de backup disponíveis no vault.',
        hints: ['\`az backup policy list\`'],
        solution: `\`\`\`bash
az backup policy list \\
  --vault-name technova-vault \\
  --resource-group rg-backup-lab \\
  --query "[].{Nome:name,Tipo:backupManagementType}" -o table

# Ver detalhes da DefaultPolicy
az backup policy show \\
  --vault-name technova-vault \\
  --resource-group rg-backup-lab \\
  --name DefaultPolicy \\
  --query "{Frequencia:properties.schedulePolicy.schedulePolicyType,Retencao:properties.retentionPolicy}" \\
  -o json
\`\`\``,
        verify: `\`\`\`bash
az backup policy list --vault-name technova-vault --resource-group rg-backup-lab \\
  --query "length(@)" -o tsv
# Saída esperada: >= 1 (pelo menos a DefaultPolicy)
\`\`\``
      },
      {
        title: 'Limpeza',
        instruction: 'Delete o Resource Group.',
        hints: [],
        solution: `\`\`\`bash
az group delete --name rg-backup-lab --yes --no-wait
\`\`\``,
        verify: `\`\`\`bash
az group show --name rg-backup-lab 2>/dev/null || echo "RG deletado"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Não consegue deletar backup items do vault',
      difficulty: 'easy',
      symptom: 'Ao tentar deletar um backup item (VM backup) do Recovery Services Vault, recebe o erro "Cannot delete backup item as it is protected by soft delete".',
      diagnosis: `\`\`\`bash
# Verificar se soft delete está habilitado
az backup vault backup-properties show \\
  --vault-name myVault --resource-group myRG \\
  --query "softDeleteFeatureState" -o tsv
\`\`\``,
      solution: `**Soft delete está ativo** (padrão).

**Opção 1: Desabilitar soft delete (se OK para seu compliance)**:
\`\`\`bash
az backup vault backup-properties set \\
  --vault-name myVault --resource-group myRG \\
  --soft-delete-feature-state Disable
\`\`\`
Depois deletar o item normalmente.

**Opção 2: Esperar 14 dias** — o item em estado "softdeleted" será permanentemente removido automaticamente após 14 dias.

**Opção 3: Undelete e depois stop protection + delete data**:
\`\`\`bash
# Primeiro: undelete o item em soft-deleted state
az backup item undelete ...
# Depois: stop protection e delete data
az backup protection disable --delete-backup-data true ...
\`\`\``
    }
  ]
};
