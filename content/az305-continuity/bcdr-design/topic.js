window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['az305-continuity/bcdr-design'] = {
  theory: `# Design de BCDR — Business Continuity & Disaster Recovery (AZ-305)

## Relevância no Exame
> Peso estimado **10-15%** no AZ-305. O exame avalia a capacidade de projetar soluções de DR com RPO/RTO específicos e escolher os serviços corretos.

## Conceitos Fundamentais

### RTO e RPO — Definição para Design

**RPO (Recovery Point Objective)**: máximo de dados que pode ser perdido
- RPO = 0: zero perda de dados (replicação síncrona)
- RPO = 15 min: pode perder até 15min de transações
- RPO = 24h: backup diário suficiente

**RTO (Recovery Time Objective)**: tempo máximo de indisponibilidade
- RTO = minutos → Active-Active ou hot standby
- RTO = 1-4h → warm standby com failover manual
- RTO = 24h+ → backup/restore tradicional

### Estratégias de DR

| Estratégia | RTO | RPO | Custo | Como funciona |
|-----------|-----|-----|-------|---------------|
| **Backup & Restore** | Horas a dias | Horas | Baixo | Restaurar de backup |
| **Pilot Light** | 10-30 min | Minutos | Médio | Infra mínima rodando, escala no DR |
| **Warm Standby** | 5-10 min | Segundos-min | Médio-alto | Versão reduzida always on |
| **Multi-site Active-Active** | Segundos | Zero (sync) | Alto | Dois sites servindo simultaneamente |

### Azure Site Recovery (ASR) — Design
Replicação de VMs para outra região:
- **RPO**: mínimo de 30 segundos
- **RTO**: minutos (failover automático ou manual)
- Suporte: Azure-to-Azure, VMware/Hyper-V-to-Azure
- **Test failover**: validar DR sem afetar produção (isola na VNet de teste)
- **Failback**: retornar para a região primária após DR

**Configuração de ASR:**
\`\`\`
Source Region (East US)          Target Region (West US)
  ├─ VM-Web-1 ──replication──→  VM-Web-1 (off)
  ├─ VM-App-1 ──replication──→  VM-App-1 (off)
  └─ SQL-Server ──replication──→ SQL-Server (off)

Recovery Plan: define ordem de failover
  1. SQL Server (esperar 5min para startup)
  2. App VMs (esperar 2min)
  3. Web VMs
\`\`\`

### Alta Disponibilidade vs Disaster Recovery

| | HA | DR |
|-|----|----|
| Objetivo | Evitar downtime | Recuperar de catástrofe |
| Escopo | Falhas de hardware/zona | Falha de região inteira |
| Exemplo | Availability Zones | Azure Site Recovery |
| SLA | 99.99% | RTO/RPO definidos |
| Custo | +20-30% | +50-100% |

### BCDR para Serviços Gerenciados

**Azure SQL Database:**
- Auto-failover groups (failover automático + endpoint único)
- Geo-restore (restore do backup geo-replicado, RPO = 1h)
- Active Geo-Replication (réplica legível, failover manual)

**Cosmos DB:**
- Automático com multi-region write habilitado
- Failover automático com prioridade configurável

**App Service:**
- Deploy em múltiplas regiões + Traffic Manager/Front Door
- Azure Backup para configuração e conteúdo

**Storage:**
- RA-GRS: leitura na secundária, failover manual
- GZRS: zonally redundant + geo para proteção máxima

### Recovery Plans
Documento e automação de failover:
- Define ordem de recovery (qual VM inicia primeiro)
- Pode incluir scripts e runbooks (Azure Automation)
- Permite test failover sem impacto na produção
- Documentar: RTO/RPO, responsabilidades, contatos de escalação

### Business Continuity Checklist
1. ✅ Identificar workloads críticos e seus RTO/RPO
2. ✅ Implementar solução técnica (ASR, geo-replication, backup)
3. ✅ Documentar Recovery Plan
4. ✅ Testar DR regularmente (ao menos anualmente)
5. ✅ Monitorar replicação (alertas se RPO drift aumenta)

## Padrões de Design

### Padrão: Multi-região Ativo-Ativo com Azure Front Door
\`\`\`
Users
  ↓
Azure Front Door (health checks + routing)
  ├─ East US (produção)
  │    ├─ App Service (primário)
  │    └─ Azure SQL (primário)
  └─ West US (secondary)
       ├─ App Service (hot standby)
       └─ Azure SQL (geo-replica legível)
\`\`\`
RTO: segundos (Front Door detecta falha e redireciona)
RPO: ~1-5 segundos (lag da geo-replication SQL)

### Padrão: ASR para VMs IaaS
\`\`\`
East US (produção) → ASR replication → West US (DR)
Recovery Plan:
  1. Network setup (VNet, NSG via ARM template)
  2. Database VM (espera 5 min)
  3. App VMs (espera 2 min)
  4. Web VMs
Test failover mensal
\`\`\`

## Killer.sh Style Challenge (AZ-305)

> **Cenário**: Aplicação financeira crítica com os seguintes SLAs exigidos:
> - RPO: máximo 30 segundos para transações
> - RTO: máximo 2 minutos para retomada de serviço
> - Compliance: DR deve ser em região geograficamente separada
> - Test de DR: sem impactar produção
>
> **Projete a solução BCDR completa.**
>
> **Resposta**: Multi-site Active-Active com Azure Front Door + failover automático. Azure SQL com Auto-Failover Group (30s RPO), VMs com Azure Site Recovery (30s RPO, RTO ~10min via Recovery Plan automatizado), Storage com RA-GZRS. Test failover mensal via ASR "test failover" (isola em VNet separada). Recovery Plan com runbooks para automatizar restart de serviços na ordem correta.
`,

  quiz: [
    {
      question: 'Uma empresa exige RTO de 5 minutos e RPO de 30 segundos para uma aplicação crítica. Qual estratégia de DR é mais adequada?',
      options: [
        'Backup and Restore para Azure Storage',
        'Pilot Light com instâncias mínimas na região de DR',
        'Warm Standby com auto-failover groups e Azure Site Recovery',
        'Multi-site Active-Active com Azure Front Door'
      ],
      correct: 2,
      explanation: 'Warm Standby (ou hot standby) com Azure Site Recovery para VMs (RPO ~30s) e SQL Auto-Failover Groups (RPO ~30s) atende aos requisitos. Active-Active também atenderia mas tem custo dobrado. Pilot Light e Backup não atendem RTO de 5 minutos. A chave é ter infraestrutura pré-aquecida na região de DR para atingir RTO de 5 minutos.',
      reference: 'RPO 30s + RTO 5min = Warm Standby ou Active-Active. Qualquer coisa que precise provisionar infra do zero não atinge RTO de 5 min.'
    },
    {
      question: 'Qual é a diferença entre "Test Failover" e "Failover" no Azure Site Recovery?',
      options: [
        'Test Failover é mais lento; Failover é instantâneo',
        'Test Failover cria VMs em VNet isolada sem afetar replicação; Failover real para produção para a região secundária',
        'Test Failover não requer Recovery Plan; Failover requer',
        'Não há diferença técnica — apenas nomes diferentes para a mesma operação'
      ],
      correct: 1,
      explanation: 'Test Failover cria VMs replicadas em uma VNet isolada de teste — você valida que o DR funciona sem interromper a replicação ou a produção. A VNet de teste é separada e temporária. Failover real inicia o failover de produção para a região secundária, parando a replicação. Após estabilizar, você faz Failback para retornar à região primária.',
      reference: 'Test Failover = validação de DR sem risco. Sempre faça test failover regularmente antes de precisar do Failover real.'
    },
    {
      question: 'Para uma aplicação com RPO de zero (sem perda de dados) em múltiplas regiões, qual configuração de Cosmos DB usar?',
      options: [
        'Single-region com backup automático',
        'Multi-region com Strong consistency',
        'Multi-region write com Bounded Staleness',
        'Multi-region com Eventual consistency'
      ],
      correct: 1,
      explanation: 'Multi-region com Strong consistency garante RPO de zero — escrita só é confirmada quando todas as réplicas confirmam. Isso resulta em latência maior mas zero perda de dados em caso de falha de região. Multi-region write com Eventual consistency tem RPO > 0 pois pode haver lag entre regiões.',
      reference: 'RPO zero = Strong consistency ou replicação síncrona. Sempre há tradeoff: zero RPO = maior latência de escrita.'
    }
  ],

  flashcards: [
    {
      front: 'Quais são as 4 estratégias de DR e seus trade-offs de RTO/RPO/custo?',
      back: '| Estratégia | RTO | RPO | Custo |\n|-----------|-----|-----|-------|\n| **Backup & Restore** | Horas-dias | Horas | Baixo |\n| **Pilot Light** | 10-30 min | Minutos | Médio |\n| **Warm Standby** | 5-10 min | Segundos | Médio-alto |\n| **Active-Active** | Segundos | ~0 | Alto |\n\nRegra: menor RTO/RPO = maior custo. Escolha baseada em quanto o downtime/perda de dados custa vs custo da solução de DR.'
    },
    {
      front: 'Como o Azure Site Recovery atende requisitos de RTO/RPO?',
      back: '**RPO**: mínimo 30 segundos (replicação contínua de dados)\n\n**RTO**: depende do Recovery Plan:\n- VMs simples: 15-30 minutos (inicialização + rede)\n- Com Recovery Plan automatizado: 5-10 minutos\n- Recursos pré-configurados na região de DR: 2-5 minutos\n\n**Test Failover**: valida DR sem impacto em produção — cria VMs em VNet isolada, pode ser feito mensalmente\n\n**Failback**: retorna para região primária após DR ser resolvido'
    },
    {
      front: 'Qual serviço Azure fornecer HA vs qual para DR?',
      back: '**Alta Disponibilidade (HA)** — falhas dentro de uma região:\n- Availability Zones → VMs, SQL, Storage\n- Load Balancer + Health Probes\n- App Service auto-healing\n- SQL Database Always On (automático)\n\n**Disaster Recovery (DR)** — falha de região inteira:\n- Azure Site Recovery → VMs\n- SQL Auto-Failover Groups → Azure SQL\n- RA-GRS/GZRS → Storage\n- Cosmos DB multi-region\n- Azure Front Door / Traffic Manager → routing global'
    }
  ],

  lab: {
    scenario: 'Explore as configurações de Azure Site Recovery e Recovery Plans para entender o processo de BCDR.',
    objective: 'Criar Recovery Services Vault configurado para ASR e explorar Recovery Plans.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Criar Recovery Services Vault para ASR',
        instruction: 'Crie um vault dedicado para Azure Site Recovery na região East US (fonte) com GRS para replicação para West US.',
        hints: ['\`az backup vault create\` -- o mesmo vault serve para backup e ASR'],
        solution: `\`\`\`bash
az group create --name rg-bcdr-lab --location eastus

az backup vault create \\
  --name technova-asr-vault \\
  --resource-group rg-bcdr-lab \\
  --location eastus

# Configurar GRS (necessário para ASR cross-region)
az backup vault backup-properties set \\
  --vault-name technova-asr-vault \\
  --resource-group rg-bcdr-lab \\
  --backup-storage-redundancy GeoRedundant

echo "Recovery Services Vault criado para ASR"
echo "Próximo passo: no portal, Azure Site Recovery → Enable Replication"
\`\`\``,
        verify: `\`\`\`bash
az backup vault show --name technova-asr-vault --resource-group rg-bcdr-lab \\
  --query "{Nome:name,Status:properties.provisioningState}" -o table
\`\`\``
      },
      {
        title: 'Explorar SQL Failover Groups (conceitual)',
        instruction: 'Crie um SQL Server para explorar a configuração de Auto-Failover Group como parte do design de BCDR.',
        hints: ['SQL Auto-Failover Group requer dois SQL Servers em regiões diferentes'],
        solution: `\`\`\`bash
SUFFIX=$(date +%s | tail -c 5)

# SQL Server primário (East US)
az sql server create \\
  --name "primary-sql-\${SUFFIX}" \\
  --resource-group rg-bcdr-lab \\
  --location eastus \\
  --admin-user sqladmin \\
  --admin-password "P@ssword123!"

# Banco de dados na primária
az sql db create \\
  --server "primary-sql-\${SUFFIX}" \\
  --resource-group rg-bcdr-lab \\
  --name proddb \\
  --edition GeneralPurpose \\
  --family Gen5 \\
  --capacity 2

echo "SUFFIX=\${SUFFIX}" > /tmp/bcdrlab.sh
echo "SQL Primário criado: primary-sql-\${SUFFIX}.database.windows.net"
echo "Para failover group completo, um segundo SQL Server em outra região seria necessário"
\`\`\``,
        verify: `\`\`\`bash
source /tmp/bcdrlab.sh
az sql db show \\
  --server "primary-sql-\${SUFFIX}" \\
  --resource-group rg-bcdr-lab \\
  --name proddb \\
  --query "{Nome:name,Status:status}" -o table
\`\`\``
      },
      {
        title: 'Calcular RTO/RPO para um cenário',
        instruction: 'Com base nos serviços criados, calcule o RTO e RPO teórico para diferentes estratégias de recovery.',
        hints: ['ASR RPO mínimo: 30 segundos. SQL Failover Group RPO: ~30 segundos. Recovery via backup: depende do último backup.'],
        solution: `\`\`\`bash
echo "=== Análise de RTO/RPO ==="
echo ""
echo "Cenário: Aplicação Web com VMs + SQL Database"
echo ""
echo "Opção 1: Backup & Restore"
echo "  RPO: até 24h (último backup diário)"
echo "  RTO: 2-6 horas (provisionar VMs + restaurar banco)"
echo "  Custo: Baixo (apenas storage do backup)"
echo ""
echo "Opção 2: Azure Site Recovery + SQL Geo-Replication"
echo "  RPO: 30-60 segundos"
echo "  RTO: 15-30 minutos (failover das VMs + DNS propagation)"
echo "  Custo: Médio (ASR license + replica SQL)"
echo ""
echo "Opção 3: Active-Active com Front Door"
echo "  RPO: ~0 (síncrono)"
echo "  RTO: segundos (Front Door redireciona automaticamente)"
echo "  Custo: Alto (infra duplicada + Front Door)"
\`\`\``,
        verify: `\`\`\`bash
echo "Análise concluída. Escolha da estratégia depende do SLA exigido e budget disponível."
\`\`\``
      },
      {
        title: 'Limpeza',
        instruction: 'Delete o Resource Group.',
        hints: [],
        solution: `\`\`\`bash
az group delete --name rg-bcdr-lab --yes --no-wait
\`\`\``,
        verify: `\`\`\`bash
az group show --name rg-bcdr-lab 2>/dev/null || echo "RG deletado"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Azure Site Recovery — replicação parou (RPO drift alto)',
      difficulty: 'hard',
      symptom: 'O monitor de ASR mostra que o RPO atual está em 8 horas (bem acima do target de 30 minutos). O status da replicação mostra "Warning".',
      diagnosis: `\`\`\`bash
# Verificar health da replicação via portal
# Recovery Services Vault → Replicated Items → VM Status

# Via CLI — verificar eventos de replicação
az site-recovery replication-protected-item list \\
  --resource-group myRG \\
  --vault-name myVault \\
  --fabric-name primary-fabric \\
  --protection-container-name primary-container \\
  --query "[].{VM:name,Health:replicationHealth,RPO:currentScenario.scenarioName}" \\
  -o table 2>/dev/null || echo "Verificar via portal: ASR → Replicated Items → VM → Health"
\`\`\``,
      solution: `**Causas comuns de RPO drift no ASR:**

1. **Bandwidth insuficiente**: a replicação está competindo com tráfego de produção. Soluções:
   - Configurar throttling de rede no agente ASR para limitar uso fora do horário de pico
   - Aumentar bandwidth de ExpressRoute/VPN

2. **Alta taxa de change rate na VM**: aplicações com muita escrita (ex: banco de dados com muitas transações) geram muito dado de replicação. Considerar replicar apenas os discos de SO (não de dados do banco — usar SQL Active Geo-Replication para o banco).

3. **Agente ASR desatualizado**: atualizar o agente de mobilidade na VM afetada.

4. **Snapshot consistency issues**: para VMs com múltiplos discos, garantir que crash-consistent snapshots estão sendo tirados corretamente. Para VMs críticas, usar app-consistent com scripts de pre/post snapshot.

5. **Rede para Storage Account de cache**: a replicação usa Storage Account de cache — verificar conectividade e throttling do storage.`
    }
  ]
};
