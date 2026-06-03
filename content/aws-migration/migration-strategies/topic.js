window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['aws-migration/migration-strategies'] = {
  theory: `# Estrategias e Ferramentas de Migracao

## Relevancia no Exame
> **Design Solutions for Organizational Complexity** e **Design for New Solutions** abordam migracao. O framework 7Rs, AWS Migration Hub, MGN e DMS sao temas frequentes no SAP-C02.

## O Framework 7Rs de Migracao

| Estrategia | Descricao | Esforco | Risco |
|------------|-----------|---------|-------|
| **Retire** | Desativar — nao e mais necessario | Nenhum | Nenhum |
| **Retain** | Manter on-premises — nao pronto para migrar | Nenhum | Nenhum |
| **Rehost (Lift & Shift)** | Mover para EC2 sem mudancas | Baixo | Baixo |
| **Replatform (Lift & Tinker)** | Otimizacoes menores: RDS em vez de MySQL no EC2, Elastic Beanstalk | Medio | Baixo |
| **Repurchase** | Mover para SaaS: Salesforce, ServiceNow em vez de app customizado | Baixo | Medio |
| **Refactor/Re-architect** | Redesenhar cloud-native (microsservicos, serverless) | Alto | Alto |
| **Relocate** | Mover VMware para AWS VMware Cloud | Baixo | Baixo |

## AWS Migration Hub

Hub central de rastreamento para todas as migracoes:
- Rastreia progresso entre multiplas ferramentas de migracao
- Agrupa servidores em aplicacoes
- Dashboard de status de migracao
- Funciona com: Application Discovery Service, MGN, DMS, Server Migration Service

## AWS Application Discovery Service

Descubra inventario on-premises antes da migracao:
- **Agentless**: API VMware vCenter — coleta configuracao/utilizacao de VMs
- **Agent-based**: descoberta mais profunda em nivel de OS (processos, dependencias, conexoes de rede)
- Dados alimentam Migration Hub e CloudEndure

## AWS Application Migration Service (MGN)

Antigo CloudEndure Migration:
- **Replicacao continua em nivel de bloco** da origem para area de staging AWS
- Fonte: fisico, virtual, cloud (qualquer OS)
- Nao-disruptivo: producao continua enquanto replica
- **Test cutovers**: teste a migracao sem afetar producao
- **Cutover**: lance instancias convertidas, redirecione trafego
- RPO sub-segundo, RTO minutos (lift-and-shift mais rapido)

### MGN vs DMS
- **MGN**: migracao de servidor/VM (OS completo + aplicacoes) — lift and shift
- **DMS**: apenas migracao de banco de dados, suporta conversao de schema

## AWS Database Migration Service (DMS)

Migre bancos de dados para AWS com minimo tempo de inatividade:
- **Fontes suportadas**: Oracle, SQL Server, MySQL, PostgreSQL, MongoDB, SAP, on-prem, cloud
- **Destinos suportados**: RDS, Aurora, Redshift, DynamoDB, S3, Kinesis, DocumentDB
- **Homogeneo**: mesmo engine (MySQL -> MySQL) — mais simples
- **Heterogeneo**: engines diferentes (Oracle -> Aurora) — precisa do Schema Conversion Tool (SCT)
- **Schema Conversion Tool (SCT)**: converte DDL + stored procedures + codigo da aplicacao
- **CDC (Change Data Capture)**: replica mudancas continuas para cutover com minimo tempo de inatividade
- **Instancia de replicacao Multi-AZ**: HA para a propria task de migracao

## AWS DataSync

Servico de transferencia de dados online:
- Transfere arquivos/objetos para/de: S3, EFS, FSx, NFS, SMB
- Agendamento automatizado, throttling de banda
- Criptografa dados em transito (TLS) e em repouso
- Mais rapido que copia manual + verificacao
- Agent implantado on-premises para fontes NFS/SMB
- Use para carga inicial de dados + sincronizacao continua

## AWS Snow Family

Transferencia offline de dados para conjuntos grandes ou largura de banda limitada:
- **Snowcone**: 8 TB armazenamento, pequeno/robusto, edge computing
- **Snowball Edge Storage Optimized**: 80 TB armazenamento utilizavel
- **Snowball Edge Compute Optimized**: instancias EC2 + armazenamento compativel com S3 na borda
- **Snowmobile**: container caminhao de 100 PB para migracoes massivas

### Decisao Snow vs DataSync
- DataSync: boa largura de banda de rede disponivel (abaixo do limiar de 10 Gbps)
- Snow: largura de banda limitada, > 10 TB, ambientes desconectados

## Erros Comuns

- Escolher MGN quando o requisito e migracao de banco de dados (use DMS)
- Escolher DMS para migracao completa de servidor (use MGN)
- Esquecer que Schema Conversion Tool e separado do DMS (necessario para heterogeneo)
- Nao saber que MGN suporta qualquer OS (nao so VMware)
- Escolher Snowmobile para < 10 PB (use Snowball Edge)
`,

  quiz: [
    {
      question: 'Uma empresa quer mover seu banco Oracle para Amazon Aurora PostgreSQL com minimo de inatividade. Qual combinacao de ferramentas deve usar?',
      options: ['MGN + DMS', 'DMS + Schema Conversion Tool (SCT)', 'DataSync + RDS', 'Snowball + RDS'],
      correct: 1,
      explanation: 'Oracle para Aurora PostgreSQL e migracao heterogenea. SCT converte schema e stored procedures. DMS realiza a migracao real dos dados com CDC para replicacao continua. Juntos habilitam cutover com quase zero inatividade.',
      reference: 'Migracao DB heterogenea = DMS + SCT. Homogenea = apenas DMS. MGN = servidor completo, nao apenas banco.'
    },
    {
      question: 'Uma empresa quer migrar 500 VMs VMware para AWS com minima disrupcao das aplicacoes em execucao. Qual servico e mais adequado?',
      options: ['AWS DMS', 'AWS MGN (Application Migration Service)', 'AWS DataSync', 'AWS Snow Family'],
      correct: 1,
      explanation: 'MGN: replicacao continua em nivel de bloco permite que producao continue funcionando. Test cutovers validam a migracao antes do cutover real. Suporta qualquer OS em qualquer hypervisor. Abordagem lift-and-shift mais rapida.',
      reference: 'MGN = lift-and-shift, qualquer OS, replicacao continua, test cutovers. DMS = apenas bancos de dados.'
    },
    {
      question: 'Qual estrategia dos 7Rs envolve substituir um CRM customizado pelo Salesforce?',
      options: ['Rehost', 'Replatform', 'Repurchase', 'Refactor'],
      correct: 2,
      explanation: 'Repurchase: mover de uma aplicacao customizada/empacotada para um equivalente SaaS. Exemplos: CRM customizado -> Salesforce, Exchange on-prem -> Office 365, ticketing caseiro -> ServiceNow.',
      reference: 'Repurchase = substituicao SaaS. Rehost = lift&shift. Replatform = otimizacao menor. Refactor = re-arquitetura.'
    },
    {
      question: 'Qual a principal diferenca entre as estrategias de migracao Rehost e Replatform?',
      options: ['Custo', 'Rehost migra no estado atual para EC2; Replatform faz otimizacoes menores (ex: substituir MySQL no EC2 por RDS)', 'Replatform e mais rapido', 'Rehost requer equipe mais especializada'],
      correct: 1,
      explanation: 'Rehost (lift and shift): mova a carga de trabalho exata para EC2/IaaS sem mudancas. Replatform (lift and tinker): aproveite servicos gerenciados — MySQL no EC2 vira RDS, app Java no Tomcat vira Elastic Beanstalk, mas sem mudancas de codigo.',
      reference: 'Rehost = mesmo em IaaS. Replatform = servicos gerenciados, sem mudanca de codigo. Refactor = redesenho da arquitetura.'
    },
    {
      question: 'Uma empresa tem 50 TB de dados de arquivo on-premises para migrar para o Amazon S3. Tem conexao de 100 Mbps. Qual e a opcao de migracao mais rapida?',
      options: ['AWS DataSync pela internet', 'AWS Direct Connect + DataSync', 'AWS Snowball Edge', 'AWS S3 Transfer Acceleration'],
      correct: 2,
      explanation: 'A 100 Mbps, transferir 50 TB levaria semanas. Snowball Edge: envie o dispositivo, carregue 80 TB, devolva — concluido em dias. DataSync pela internet: 50 TB / 100 Mbps = ~46 dias. Use Snow para grandes dados com largura de banda limitada.',
      reference: 'Snow = largura de banda limitada ou > 10 TB. DataSync = boa rede disponivel. 100 Mbps e muito lento para 50 TB online.'
    },
    {
      question: 'O que o DMS Change Data Capture (CDC) fornece?',
      options: ['Backup em tempo real', 'Replicacao continua de mudancas continuas do banco, permitindo cutover com quase zero inatividade', 'Conversao de schema', 'Compressao de dados'],
      correct: 1,
      explanation: 'CDC: apos a carga completa inicial, DMS captura continuamente mudancas INSERT/UPDATE/DELETE da fonte e as aplica no destino. Quando pronto para o cutover, o destino esta quase sincronizado com a fonte.',
      reference: 'CDC = replicacao continua de mudancas. Carga completa + CDC = migracao com quase zero inatividade. Funciona para homogeneo e heterogeneo.'
    },
    {
      question: 'Quando usar AWS DataSync em vez do Snow Family?',
      options: ['Sempre', 'Quando tem boa largura de banda de rede e o volume de dados permite transferencia online em tempo razoavel', 'Quando os dados sao > 100 TB', 'Quando a fonte e apenas NAS on-premises'],
      correct: 1,
      explanation: 'DataSync: melhor quando ha largura de banda de rede suficiente (ex: 1 Gbps+) e o volume de dados permite tempo de transferencia razoavel. Oferece agendamento, verificacao e monitoramento. Snow Family: melhor para banda limitada, ambientes desconectados ou conjuntos massivos de dados.',
      reference: 'DataSync = online, boa banda, agendamento+verificacao. Snow = offline, banda limitada, tipicamente > 10 TB.'
    },
    {
      question: 'O que o AWS Migration Hub principalmente fornece?',
      options: ['Ferramenta de migracao de dados', 'Dashboard central para rastrear progresso de migracao entre multiplas ferramentas e aplicacoes', 'Conversao de schema', 'Avaliacao de conectividade de rede'],
      correct: 1,
      explanation: 'Migration Hub: visibilidade centralizada no progresso de migracao. Agrupa servidores em stacks de aplicacao. Agrega status de MGN, DMS, Application Discovery Service. Fornece visao unica de todo o programa de migracao.',
      reference: 'Migration Hub = rastreamento central, nao e uma ferramenta de migracao. Funciona com MGN, DMS, CloudEndure.'
    }
  ],

  flashcards: [
    { front: 'Estrategias 7Rs?', back: 'Retire (desativar). Retain (manter on-prem). Rehost (lift&shift para EC2). Replatform (servicos gerenciados, sem mudanca de codigo). Repurchase (SaaS). Refactor (re-arquitetura cloud-native). Relocate (VMware Cloud).' },
    { front: 'MGN vs DMS?', back: 'MGN: migracao completa de servidor/VM (qualquer OS), replicacao nivel bloco, lift&shift, test cutovers. DMS: apenas migracao de banco, suporta heterogeneo com SCT, CDC para replicacao continua.' },
    { front: 'Conceitos-chave DMS?', back: 'Homogeneo: mesmo engine, apenas DMS. Heterogeneo: engines diferentes, DMS + SCT (Schema Conversion Tool). CDC: replicacao continua de mudancas para quase zero inatividade. Instancia de replicacao = EC2 gerenciado.' },
    { front: 'Dimensionamento Snow Family?', back: 'Snowcone: 8 TB, menor, borda. Snowball Edge Storage Optimized: 80 TB. Snowball Edge Compute Optimized: EC2 + S3 na borda. Snowmobile: caminhao 100 PB. Escolha Snow quando banda limitada ou > 10 TB.' },
    { front: 'Features DataSync?', back: 'Transferencia online: S3, EFS, FSx, NFS, SMB. Agent para on-prem. Agendamento automatizado. Throttling de banda. Criptografia TLS. Verificacao de integridade. Mais rapido que copia manual. Para carga inicial + sincronizacao.' },
    { front: 'Application Discovery Service?', back: 'Agentless: API VMware vCenter, config/utilizacao VM. Agent-based: nivel OS, processos, dependencias, rede. Dados alimentam Migration Hub. Usado antes do planejamento de migracao.' },
    { front: 'Fluxo de migracao MGN?', back: '1. Instalar agent. 2. Replicacao continua de blocos para staging. 3. Test cutover (validar). 4. Cutover: lançar instancias convertidas. 5. Redirecionar trafego. Producao roda durante toda a replicacao.' },
    { front: 'Finalidade Migration Hub?', back: 'Dashboard central de rastreamento para todas as migracoes. Agrupa servidores em aplicacoes. Agrega de MGN, DMS, Discovery Service. Nao e uma ferramenta de migracao — apenas visibilidade/rastreamento.' }
  ],

  lab: {
    scenario: 'Planeje uma estrategia de migracao para uma aplicacao web de 3 camadas de on-premises para AWS.',
    objective: 'Praticar a aplicacao dos 7Rs, configurar DMS para migracao de banco e usar MGN para migracao de servidor.',
    duration: '25-30 minutos',
    steps: [
      {
        title: 'Aplicar Framework 7Rs ao Cenario de Migracao',
        instruction: 'Analise uma aplicacao de 3 camadas (camada web, camada app, banco Oracle) e decida a estrategia de migracao para cada componente.',
        hints: ['Considere alternativas cloud-native para cada camada', 'Oracle para Aurora e heterogeneo — precisa de SCT'],
        solution: '```\nAnalise do inventario da aplicacao:\n\nCamada Web (Apache no RHEL):\n  Atual: Apache em VMs equivalentes a EC2\n  Estrategia: REPLATFORM\n  -> Amazon CloudFront + S3 (estatico) ou\n  -> ALB + ECS/Fargate (dinamico)\n  Justificativa: sem mudanca de codigo, use servicos gerenciados\n\nCamada App (Java Tomcat):\n  Atual: Tomcat em VMs\n  Estrategia: REPLATFORM\n  -> Elastic Beanstalk (gerencia Tomcat)\n  -> Ou REFACTOR para Lambda/containers se redesenhando\n  Justificativa: runtime gerenciado, auto-scaling\n\nCamada Banco (Oracle 12c):\n  Atual: Oracle on-premises\n  Estrategia: REPLATFORM\n  -> Amazon Aurora PostgreSQL via DMS + SCT\n  Justificativa: open-source, gerenciado, reducao de custo\n\nSistema Batch Legado:\n  Estrategia: RETIRE\n  -> Mover funcionalidade para AWS Step Functions\n  -> Ou desativar se nao e mais necessario\n```',
        verify: '```\n# Perguntas de validacao:\n# 1. Voce considerou custo, esforco e risco para cada estrategia?\n# 2. Cada decisao e justificada por requisitos de negocio?\n# 3. Voce identificou dependencias entre camadas?\n# Esperado: decisao 7R documentada para cada componente com justificativa\n```'
      },
      {
        title: 'Criar Instancia de Replicacao DMS e Task de Migracao',
        instruction: 'Configure uma instancia de replicacao DMS e crie uma task de migracao para migrar MySQL para Amazon Aurora MySQL.',
        hints: ['Migracao homogenea nao precisa de SCT', 'Escolha Multi-AZ para instancia de replicacao HA'],
        solution: '```bash\n# Criar instancia de replicacao DMS\naws dms create-replication-instance \\\n  --replication-instance-identifier instancia-migracao \\\n  --replication-instance-class dms.r5.large \\\n  --allocated-storage 100 \\\n  --multi-az \\\n  --engine-version 3.5.1\n\n# Criar endpoint de origem (MySQL on-prem)\naws dms create-endpoint \\\n  --endpoint-identifier mysql-origem \\\n  --endpoint-type source \\\n  --engine-name mysql \\\n  --username admin \\\n  --password MinhaSenha \\\n  --server-name 10.0.1.100 \\\n  --port 3306 \\\n  --database-name meudb\n\n# Criar endpoint de destino (Aurora MySQL)\naws dms create-endpoint \\\n  --endpoint-identifier aurora-destino \\\n  --endpoint-type target \\\n  --engine-name aurora \\\n  --username admin \\\n  --password MinhaSenha \\\n  --server-name cluster-aurora.cluster-xxx.us-east-1.rds.amazonaws.com \\\n  --port 3306\n```',
        verify: '```bash\naws dms describe-replication-instances \\\n  --filters Name=replication-instance-identifier,Values=instancia-migracao\n# Esperado: status = available\n\naws dms test-connection \\\n  --replication-instance-arn ARN_INSTANCIA_REPLICACAO \\\n  --endpoint-arn ARN_ENDPOINT_ORIGEM\n# Esperado: status = successful\n```'
      },
      {
        title: 'Instalar Agent MGN para Migracao de Servidor',
        instruction: 'Instale o agent MGN no servidor de origem e verifique a replicacao para a area de staging AWS.',
        hints: ['Agent MGN requer conectividade de rede com endpoints MGN da AWS', 'Area de staging fica em uma subnet AWS dedicada'],
        solution: '```bash\n# Inicializar servico MGN na conta\naws mgn initialize-service\n\n# Baixar e instalar agent no servidor de origem (Linux)\ncurl -O https://aws-application-migration-service-us-east-1.s3.amazonaws.com/latest/linux/aws-replication-installer-init\nchmod +x aws-replication-installer-init\nsudo ./aws-replication-installer-init \\\n  --region us-east-1 \\\n  --aws-access-key-id CHAVE_ACESSO \\\n  --aws-secret-access-key CHAVE_SECRETA\n\n# Verificar status do servidor de origem no MGN\naws mgn describe-source-servers \\\n  --filters filters=[{name=lifeCycle.state,values=[READY_FOR_TEST]}]\n```',
        verify: '```bash\naws mgn describe-source-servers --filters filters=[]\n# Esperado: servidor de origem listado com replicationStatus = HEALTHY\n# lifeCycle.state = READY_FOR_TEST (apos sincronizacao inicial)\n\n# Verificar lag de replicacao\naws mgn describe-source-servers \\\n  --query "items[0].dataReplicationInfo.dataReplicationState"\n# Esperado: REPLICATING ou CONTINUOUS\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Task DMS Falhando com Violacoes de Chave Estrangeira',
      difficulty: 'medium',
      symptom: 'Task de migracao DMS inicia mas falha com erros de chave estrangeira. Tabelas estao parcialmente migradas.',
      diagnosis: '```\nProblema de chave estrangeira durante migracao DMS:\n1. Causa raiz:\n   DMS migra tabelas em paralelo por padrao\n   Tabela pai pode nao ser migrada antes das tabelas filho\n   Restricoes de chave estrangeira falham quando linha filho\n   e inserida antes do pai\n\n2. Solucoes:\n   a) Desabilitar restricoes FK no destino antes da migracao\n      MySQL/Aurora: SET FOREIGN_KEY_CHECKS=0\n      Reabilitar depois: SET FOREIGN_KEY_CHECKS=1\n   b) Especificar ordem de carga de tabelas (modo LOB)\n   c) Usar configuracao da task DMS: targetTablePrepMode=TRUNCATE_BEFORE_LOAD\n\n3. Verificar logs da task:\n   aws dms describe-replication-task-logs \\\n     --replication-task-arn ARN_TASK\n\n4. Configuracoes LOB (Large Object):\n   Se colunas binarias/texto sao grandes:\n   enableLobsForTask=true, lobMaxSize conforme necessario\n\n5. Para migracao heterogenea:\n   Verifique tambem erros de conversao SCT\n   Algumas construcoes podem nao converter corretamente\n```',
      solution: 'Desabilite verificacoes de chave estrangeira no banco de dados destino antes de iniciar a task de migracao. Execute a carga completa DMS, depois reabilite as verificacoes de chave estrangeira. Valide integridade dos dados apos. Para CDC continuo apos a carga inicial, problemas de chave estrangeira sao menos comuns pois as mudancas chegam em ordem.'
    },
    {
      title: 'Agent MGN Nao Conectando Apos Instalacao',
      difficulty: 'hard',
      symptom: 'Agent MGN instalado no servidor de origem mas servidor de origem nao aparece no Migration Hub. Replicacao nunca inicia.',
      diagnosis: '```\nChecklist de conectividade do agent MGN:\n1. Conectividade de rede da origem para AWS:\n   Endpoints necessarios (TCP 443):\n   - mgn.REGION.amazonaws.com (MGN API)\n   - kinesis.REGION.amazonaws.com (para streaming)\n   - s3.amazonaws.com (para dados de replicacao)\n\n2. Porta TCP 1500 (dados de replicacao):\n   Servidor de origem -> subnet de staging AWS\n   Deve estar aberta em security groups/NACLs/firewall on-prem\n\n3. Credenciais IAM:\n   A chave de acesso/secreta usada durante a instalacao\n   Deve ter: AWSApplicationMigrationAgentPolicy\n\n4. Verificar logs do agent:\n   Linux: /var/log/aws-replication-agent/replication.log\n   Windows: C:\\Program Files (x86)\\AWS Replication Agent\\logs\\\n\n5. Configuracao de proxy:\n   Se origem esta atras de proxy HTTP, configure o agent com configuracoes de proxy\n\n6. VPN/DX para trafego de replicacao:\n   Para servidores grandes, VPN ou Direct Connect evita custos de transferencia pela internet\n```',
      solution: 'Verifique TCP 443 da origem para endpoints MGN API e TCP 1500 para subnet de staging. Verifique permissoes IAM (AWSApplicationMigrationAgentPolicy). Revise logs do agent por erros de conexao. Se a origem esta atras de proxy, configure as definicoes de proxy do agent. Para migracoes de producao, use VPN ou Direct Connect para evitar replicacao pela internet.'
    }
  ]
};
