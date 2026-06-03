window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['az305-infrastructure/migration-solutions'] = {
  theory: `# Design de Soluções de Migração (AZ-305)

## Relevância no Exame
> Peso estimado **10-15%** no AZ-305. O exame avalia a capacidade de escolher a estratégia de migração correta e as ferramentas Azure adequadas.

## Framework de Migração: 5 Rs (Gartner)

| Estratégia | Descrição | Quando usar |
|-----------|-----------|------------|
| **Rehost** (Lift & Shift) | Mover para IaaS sem mudanças | Rápido, risco baixo, software legado |
| **Refactor** (Replatform) | Ajuste mínimo para PaaS | App web → App Service |
| **Rearchitect** | Redesenhar para cloud-native | Quando benefícios justificam esforço |
| **Rebuild** | Reescrever do zero | Legado impossível de modernizar |
| **Retire** | Descomissionar | Não mais necessário |

## Ferramentas de Avaliação e Migração

### Azure Migrate
Hub central para avaliação e migração:
- **Discovery**: inventariar VMs on-premises (agente lightweight ou agentless)
- **Assessment**: recomendar tamanhos Azure, estimar custos, identificar dependências
- **Migration**: executar a migração (replication, test migration, final migration)

**Componentes:**
- **Azure Migrate Appliance**: VM virtual instalada on-premises que faz o discovery
- **Server Migration**: para VMs (Hyper-V, VMware, físicos)
- **Database Migration**: SQL, MySQL, PostgreSQL → Azure
- **App Service Migration**: ASP.NET web apps → Azure App Service

### Azure Database Migration Service (DMS)
Migração de bancos de dados on-premises para Azure:
- **Online migration**: migração com mínimo downtime (CDC — change data capture)
- **Offline migration**: downtime aceito, mais simples
- Suporte: SQL Server, MySQL, PostgreSQL, Oracle, MongoDB → Azure

**Processo Online Migration:**
\`\`\`
1. Full backup inicial → Azure
2. CDC captura mudanças incrementais
3. Aplicar mudanças continuamente
4. Cutover: momento de downtime mínimo (segundos/minutos)
\`\`\`

### Azure Site Recovery para Migração
Também usado para migrar VMs (replicar → test → failover permanente):
- Melhor para ambientes VMware/Hyper-V de grande escala
- Diferença: na migração, você faz um "failover" e depois desliga a VM original

### Azure Data Box
Migração de dados em massa quando bandwidth é limitado:
| Produto | Capacidade | Uso |
|---------|-----------|-----|
| **Data Box Disk** | 8 TB por disco (máx 35TB) | Pequenas migrações |
| **Data Box** | 80 TB | Migrações médias |
| **Data Box Heavy** | 1 PB | Migrações grandes |

**Quando usar Data Box vs internet:**
- Se transferir via internet leva > 1 semana → usar Data Box

## Estratégias por Workload

### VMs Windows/Linux
1. **Rehost**: Azure Migrate → replicar → migrar para IaaS Azure VMs
2. **Refactor**: se for web app, considerar App Service Migration Assistant

### SQL Server
1. **Rehost**: SQL Server em VM Azure (máxima compatibilidade)
2. **Refactor**: Azure SQL Managed Instance (alta compatibilidade + PaaS benefits)
3. **Rearchitect**: Azure SQL Database (cloud-native, menor compatibilidade)

### Web Applications (ASP.NET)
1. Azure App Service Migration Assistant: avalia e migra ASP.NET apps automaticamente

### Mainframe / Legacy
1. Avaliar com parceiros Microsoft especializados
2. Considerar emuladores ou rewrite moderno

## Fases da Migração Azure

\`\`\`
Fase 1: ASSESS
  ├─ Deploy Azure Migrate Appliance
  ├─ Discovery (6-24h para inventário completo)
  ├─ Dependency Analysis (28 dias para padrão completo)
  └─ Assessment Report (sizing, cost, readiness)

Fase 2: PREPARE
  ├─ Criar Resource Groups, VNets, NSGs na Azure
  ├─ Configurar ExpressRoute/VPN se necessário
  └─ Definir Recovery Plan e rollback strategy

Fase 3: MIGRATE
  ├─ Replicação inicial (pode levar horas/dias por TB)
  ├─ Test Migration em VNet isolada
  ├─ Validar aplicação na Azure
  └─ Cutover (janela de manutenção)

Fase 4: OPTIMIZE
  ├─ Right-sizing após 30-60 dias
  ├─ Reserved Instances para economia
  ├─ Descomissionar hardware on-premises
  └─ Configure monitoring e alerts
\`\`\`

## Erros Comuns de Design

1. **Migrar sem assessment**: estimar tamanhos sem dados reais de utilização resulta em over-provisioning.
2. **Ignorar dependências**: sistemas que dependem de outros devem ser migrados juntos ou ter conectividade garantida.
3. **Sem test migration**: sempre testar em VNet isolada antes do cutover real.
4. **Cutover sem rollback plan**: sempre ter o plano de reverter caso a migração falhe.
5. **Subestimar latência de rede**: aplicações que assumem rede local (< 1ms) podem ter problemas após migrar para Azure (5-20ms entre on-prem e Azure).

## Killer.sh Style Challenge (AZ-305)

> **Cenário**: Uma empresa precisa migrar para Azure em 6 meses:
> - 200 VMs VMware (Windows e Linux)
> - 5 instâncias SQL Server (com features SSIS e SQL Agent)
> - 3 aplicações web ASP.NET
> - 50 TB de dados de arquivo em servidores de arquivo Windows
> - Disponibilidade de Internet: 100 Mbps
>
> **Projete o plano de migração com estratégias e ferramentas.**
>
> **Resposta:**
> - 200 VMs: Azure Migrate (Rehost) com replicação contínua + test migration por wave (30-40 VMs/semana)
> - SQL Server com SSIS/Agent: Azure SQL Managed Instance (Refactor, alta compatibilidade) via DMS com online migration
> - ASP.NET apps: App Service Migration Assistant (Refactor para App Service)
> - 50 TB dados arquivo: Data Box (100 Mbps = 50TB levaria 46+ dias via internet) → migrar primeiro com Data Box, sincronizar delta via AzCopy
> - Conexão: ExpressRoute 1 Gbps para replicação (ou mínimo S2S VPN dedicada para migration traffic)
`,

  quiz: [
    {
      question: 'Uma empresa precisa migrar 200 VMs VMware para Azure com mínimo downtime e riscos. Qual ferramenta Azure é mais adequada para avaliação e migração?',
      options: [
        'Azure Site Recovery (apenas)',
        'Azure Migrate com Server Assessment e Server Migration',
        'Azure Resource Mover',
        'Azure Backup com restore para novas VMs'
      ],
      correct: 1,
      explanation: 'Azure Migrate é o hub oficial para migração. Server Assessment descobre e avalia as VMs (tamanho Azure recomendado, custo estimado, problemas de compatibilidade, dependências). Server Migration executa a migração com replicação contínua, test migration e cutover. Azure Site Recovery também pode migrar mas Azure Migrate é a ferramenta específica para migração com assessment integrado.',
      reference: 'Azure Migrate = hub de migração (discover + assess + migrate). ASR = replicação/DR (pode ser usado para migrar mas não tem assessment).'
    },
    {
      question: 'Uma empresa tem 80 TB de dados on-premises para migrar para Azure Blob Storage. A conexão Internet disponível é de 50 Mbps. Qual é a abordagem mais rápida?',
      options: [
        'Transferir tudo via internet usando AzCopy (levaria ~143 dias)',
        'Usar Azure Data Box para envio físico dos dados',
        'Usar Azure ExpressRoute de 10 Gbps (levaria ~18 horas)',
        'Comprimir os dados e transferir em paralelo'
      ],
      correct: 1,
      explanation: 'A 50 Mbps, 80 TB levaria ~143 dias para transferir. Azure Data Box permite enviar os dados em discos físicos — um Data Box suporta 80 TB, a Microsoft retorna em ~1 semana após envio. Para volumes grandes com bandwidth limitado, Data Box é sempre mais rápido. A regra geral: se a transferência leva mais de 1 semana via internet, use Data Box.',
      reference: 'Cálculo: 80 TB × 8 bits / 50 Mbps = ~12,9 milhões segundos ≈ 149 dias. Data Box Heavy = 1 semana. Sempre calcule antes de escolher.'
    },
    {
      question: 'Um SQL Server on-premises com SQL Agent jobs e linked servers precisa ser migrado para Azure com mínimo de refatoração. Qual serviço Azure escolher?',
      options: [
        'Azure SQL Database (Single)',
        'Azure SQL Managed Instance',
        'Azure Database for PostgreSQL',
        'SQL Server em Azure VM (IaaS)'
      ],
      correct: 1,
      explanation: 'Azure SQL Managed Instance oferece ~100% de compatibilidade com SQL Server, incluindo SQL Agent, linked servers, CLR, database mail — features não disponíveis no Azure SQL Database. É a melhor opção para lift-and-shift de SQL Server com features avançadas, sem precisar gerenciar o OS como em VM. SQL Server em VM tem máxima compatibilidade mas requer gestão completa da VM.',
      reference: 'Managed Instance = alta compatibilidade + PaaS benefits. SQL Database = cloud-native, menor compatibilidade. SQL on VM = total control, total responsibility.'
    },
    {
      question: 'O que é uma "Test Migration" no Azure Migrate e por que é importante?',
      options: [
        'Uma migração de teste que custa metade do preço',
        'Inicia a VM replicada em uma VNet isolada para validar que a aplicação funciona antes do cutover real',
        'Uma simulação que apenas estima o tempo de migração',
        'Um procedimento apenas disponível para VMs com menos de 1 TB de dados'
      ],
      correct: 1,
      explanation: 'Test Migration cria uma instância da VM replicada em uma VNet de teste isolada (sem impactar produção nem a replicação contínua). Você pode validar que a aplicação funciona no Azure, testar conectividade, performance e integração com outros sistemas. Após a validação, limpar o teste e fazer o cutover real. É uma step crítica para reduzir riscos.',
      reference: 'Sempre faça Test Migration antes do cutover real. É gratuito (apenas paga compute das VMs de teste enquanto estão rodando).'
    }
  ],

  flashcards: [
    {
      front: 'Quais são os 5 Rs da migração cloud e quando usar cada um?',
      back: '1. **Rehost** (Lift & Shift) — mover para IaaS sem mudanças. Rápido, baixo risco. VMs → Azure VMs.\n\n2. **Refactor** (Replatform) — ajuste mínimo para PaaS. Web app → App Service, SQL → Managed Instance.\n\n3. **Rearchitect** — redesenhar para cloud-native. Monolito → microserviços, SQL → Cosmos DB.\n\n4. **Rebuild** — reescrever do zero para nativo cloud.\n\n5. **Retire** — descomissionar. Não mais necessário.\n\nEstratégia comum: Rehost primeiro (quick wins), depois Refactor/Rearchitect.'
    },
    {
      front: 'Quando usar Azure Data Box vs transferência via internet?',
      back: '**Regra geral**: se transferir via internet leva mais de **1 semana** → use Data Box.\n\n**Cálculo**: \`dados(GB) × 8 / bandwidth(Mbps) / 86400 = dias\`\n\nProdutos:\n- **Data Box Disk** (8 TB/disco, máx 35 TB) — small\n- **Data Box** (80 TB) — medium\n- **Data Box Heavy** (1 PB) — large\n\nUso: enviar os discos carregados, Microsoft faz upload para Azure (1-2 semanas total).\n\nApós: sincronizar delta com AzCopy para dados novos gerados durante o transporte.'
    },
    {
      front: 'Quais são as fases do processo de migração com Azure Migrate?',
      back: '**Fase 1 — Discover & Assess:**\n- Deploy Azure Migrate Appliance on-prem\n- Discovery: 6-24h para inventário\n- Dependency Analysis: 28 dias (recomendado)\n- Assessment Report: sizing + custo + readiness\n\n**Fase 2 — Prepare:**\n- Criar infra Azure (VNet, NSG, RG)\n- Configurar conectividade (VPN/ExpressRoute)\n\n**Fase 3 — Migrate:**\n- Habilitar replicação\n- **Test Migration** em VNet isolada\n- Validar aplicação\n- **Cutover** (mínimo downtime)\n\n**Fase 4 — Optimize:**\n- Right-sizing, Reserved Instances, monitoring'
    }
  ],

  lab: {
    scenario: 'Explore o Azure Migrate para entender o processo de assessment e migração.',
    objective: 'Criar Azure Migrate project e explorar as configurações de assessment.',
    duration: '15-20 minutos',
    steps: [
      {
        title: 'Criar Azure Migrate Project',
        instruction: 'Crie um projeto Azure Migrate para simular uma migração.',
        hints: ['\`az migrate project create\`'],
        solution: `\`\`\`bash
az group create --name rg-migrate-lab --location eastus

# Criar Azure Migrate Project
az migrate project create \\
  --resource-group rg-migrate-lab \\
  --name technova-migration \\
  --location eastus \\
  --assessment-solution-id "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/rg-migrate-lab/providers/Microsoft.Migrate/assessmentProjects/technova-migration"

echo "Azure Migrate Project criado: technova-migration"
echo "Próximo passo: Deploy do Azure Migrate Appliance on-premises para discovery"
\`\`\``,
        verify: `\`\`\`bash
az migrate project list --resource-group rg-migrate-lab \\
  --query "[].{Nome:name,Status:properties.provisioningState}" -o table 2>/dev/null || \\
  echo "Verificar via portal: Azure Migrate → Projects"
\`\`\``
      },
      {
        title: 'Explorar ferramentas de avaliação',
        instruction: 'Explore os critérios de sizing para assessment e calcule o tempo de transferência para um cenário.',
        hints: ['Cálculo: dados(GB) × 8 / bandwidth(Mbps) / 3600 = horas'],
        solution: `\`\`\`bash
echo "=== Calculadora de Migração ==="
echo ""

# Cálculo de tempo de transferência
DADOS_GB=50000  # 50 TB
BANDWIDTH_MBPS=100

SEGUNDOS=$(echo "$DADOS_GB * 1024 * 8 / $BANDWIDTH_MBPS" | bc)
HORAS=$(echo "$SEGUNDOS / 3600" | bc)
DIAS=$(echo "$HORAS / 24" | bc)

echo "Dados a migrar: \${DADOS_GB} GB ($(($DADOS_GB/1024)) TB)"
echo "Bandwidth disponível: \${BANDWIDTH_MBPS} Mbps"
echo "Tempo estimado: \${HORAS} horas (~\${DIAS} dias)"
echo ""
if [ $DIAS -gt 7 ]; then
  echo "⚠️  RECOMENDAÇÃO: Usar Azure Data Box (> 7 dias via internet)"
else
  echo "✅ Transferência via internet é viável"
fi
\`\`\``,
        verify: `\`\`\`bash
echo "Com 50 TB e 100 Mbps:"
echo "50000 GB × 8 bits / 100 Mbps = 4.000.000 segundos ≈ 46 dias"
echo "→ Usar Azure Data Box Heavy (1 PB de capacidade)"
\`\`\``
      },
      {
        title: 'Limpeza',
        instruction: 'Delete o Resource Group.',
        hints: [],
        solution: `\`\`\`bash
az group delete --name rg-migrate-lab --yes --no-wait
\`\`\``,
        verify: `\`\`\`bash
az group show --name rg-migrate-lab 2>/dev/null || echo "RG deletado"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Azure Migrate Appliance não descobre VMs VMware',
      difficulty: 'medium',
      symptom: 'O Azure Migrate Appliance foi instalado mas não está descobrindo VMs no vCenter. O status mostra "Discovery not started" após 24 horas.',
      diagnosis: `\`\`\`bash
# Verificar no portal: Azure Migrate → Servers → Discovered servers
# Se count = 0 após 12+ horas, problema no appliance ou conectividade

# No servidor do appliance (UI web local):
# http://appliance-name:44368 ou http://localhost:44368
# Verificar: Configuration Manager → Status dos serviços
# Todos os serviços devem estar "Running"
\`\`\``,
      solution: `**Checklist de diagnóstico:**

1. **Credenciais vCenter**: verificar se o usuário configurado no appliance tem permissões no vCenter (read-only é suficiente para discovery).

2. **Conectividade de rede**: o appliance precisa alcançar o vCenter Server na porta 443. Testar: \`Test-NetConnection -ComputerName vcenter -Port 443\`.

3. **Conectividade com Azure**: o appliance precisa de saída para URLs Azure (*.azure.com, *.microsoftonline.com). Verificar firewall corporativo.

4. **Tempo de discovery**: discovery inicial pode levar 24+ horas para grandes ambientes (>1000 VMs).

5. **Appliance desatualizado**: atualizar o appliance para a versão mais recente via Configuration Manager.

6. **Múltiplos appliances**: cada appliance suporta até 10.000 VMs — para ambientes maiores, usar múltiplos appliances.`
    }
  ]
};
