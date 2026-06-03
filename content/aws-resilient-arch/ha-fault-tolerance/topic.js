window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['aws-resilient-arch/ha-fault-tolerance'] = {
  theory: `# High Availability & Fault Tolerance

## Relevancia no Exame
> **Design Resilient Architectures** vale **26%** do SAA-C03. Multi-AZ, balanceamento de carga, Auto Scaling e HA de banco de dados sao temas centrais.

## Elastic Load Balancing (ELB)

| Tipo | Camada | Protocolo | Caracteristica |
|------|--------|-----------|----------------|
| **ALB** | L7 | HTTP/HTTPS | Roteamento por path/host, sticky sessions, gRPC |
| **NLB** | L4 | TCP/UDP/TLS | Ultra-baixa latencia, IP estatico por AZ, preserva IP de origem |
| **GLB** | L3 | GENEVE | Appliances virtuais terceiros (firewalls, IDS) |

### ALB vs NLB
- **ALB**: apps web, microsservicos, roteamento por path, WebSocket, Lambda targets
- **NLB**: performance extrema (<100ms), IPs estaticos, protocolos nao-HTTP, PrivateLink
- **GLB**: appliances de rede inline (inspecao transparente)

## Auto Scaling

### Politicas de Scaling
- **Target Tracking**: manter metrica no alvo (ex: CPU em 50%) — recomendado
- **Step Scaling**: escalar baseado em thresholds de alarme
- **Scheduled**: escalar em horarios especificos
- **Predictive**: previsao ML, pre-provisiona capacidade antes do pico

### Conceitos-Chave
- **Launch Template**: define config da instancia (AMI, tipo, SG, user data)
- **Cooldown**: periodo de espera apos scaling (padrao 300s)
- **Health Checks**: EC2 (status) ou ELB (HTTP) — ELB recomendado
- **Warm Pools**: instancias pre-inicializadas para scale-out mais rapido

## RDS High Availability

### Multi-AZ vs Read Replicas

| Feature | Multi-AZ | Read Replicas |
|---------|----------|---------------|
| **Proposito** | Alta disponibilidade (failover) | Performance (read scaling) |
| **Replicacao** | Sincrona | Assincrona |
| **Failover** | Automatico (~60s DNS) | Promocao manual |
| **Trafego leitura** | Standby NAO e legivel | Endpoints legiveis |
| **Cross-Region** | Nao (mesma Region) | Sim |

## Amazon Aurora

- **6 copias** dos dados em **3 AZs** (auto-healing, sem perda de dados em falha de 2 AZs)
- Ate **15 Aurora Replicas** com failover em milissegundos (vs 5 para RDS)
- **Aurora Serverless v2**: escala 0.5-128 ACU, ideal para workloads variaveis
- **Aurora Global Database**: cross-Region, replicacao <1 segundo, promove secundario em <1 min
- **Backtrack**: rebobinar banco ate 72 horas atras (sem restore)

## Route 53 para HA

### Routing Policies para HA
- **Failover**: ativo-passivo, health check determina primario/secundario
- **Weighted**: distribui trafego por peso (blue/green, A/B testing)
- **Multivalue Answer**: retorna multiplos IPs saudaveis
- **Latency**: roteia para Region de menor latencia

## Erros Comuns

- Confundir Multi-AZ (HA, sync, standby NAO legivel) com Read Replicas (performance, async, legiveis)
- Esquecer que NLB fornece IP estatico por AZ (ALB nao)
- Nao saber que Aurora pode ter 15 replicas (RDS so 5)
`,

  quiz: [
    {
      question: 'Qual a diferenca principal entre RDS Multi-AZ e Read Replicas?',
      options: ['Multi-AZ e para performance, Read Replicas para HA', 'Multi-AZ e standby sincrono para HA, Read Replicas sao async para read scaling', 'Read Replicas fornecem failover automatico', 'Multi-AZ suporta cross-Region'],
      correct: 1,
      explanation: 'Multi-AZ: standby sincrono em outra AZ para HA com failover automatico (~60s). Read Replicas: copias assincronas para performance de leitura, promocao manual, pode ser cross-Region.',
      reference: 'Multi-AZ = HA (sync, auto-failover). Read Replica = performance (async, promocao manual).'
    },
    {
      question: 'Qual load balancer fornece IP estatico por AZ?',
      options: ['ALB', 'NLB', 'GLB', 'Classic LB'],
      correct: 1,
      explanation: 'NLB fornece um IP estatico por AZ (ou Elastic IP). ALB tem IPs dinamicos. Importante para allowlisting por IP, DNS ou PrivateLink.',
      reference: 'NLB = IP estatico, L4, ultra-baixa latencia. ALB = IP dinamico, L7, roteamento por path.'
    },
    {
      question: 'Quantas copias dos dados o Aurora mantam?',
      options: ['2 copias em 2 AZs', '4 copias em 2 AZs', '6 copias em 3 AZs', '3 copias em 3 AZs'],
      correct: 2,
      explanation: 'Aurora armazena 6 copias dos dados em 3 AZs. Tolera perda de 2 copias para writes e 3 copias para reads sem perda de dados.',
      reference: 'Aurora: 6 copias, 3 AZs, self-healing, 15 replicas, failover em ms.'
    },
    {
      question: 'Qual politica de Auto Scaling e a mais simples e recomendada?',
      options: ['Step Scaling', 'Scheduled Scaling', 'Target Tracking', 'Predictive Scaling'],
      correct: 2,
      explanation: 'Target Tracking e a mais simples: defina um valor alvo da metrica (ex: CPU em 50%) e o ASG ajusta capacidade automaticamente. Sem configuracao de alarme.',
      reference: 'Target Tracking = mais simples. Step = mais controle. Scheduled = temporal. Predictive = ML.'
    },
    {
      question: 'O que o Aurora Global Database fornece?',
      options: ['Multi-AZ na mesma Region', 'Replicacao cross-Region com menos de 1 segundo de lag', 'Auto-scaling serverless', 'Migracao automatica de schema'],
      correct: 1,
      explanation: 'Aurora Global Database replica entre Regions com tipicamente <1s de lag. Region secundaria pode ser promovida em <1 minuto para disaster recovery.',
      reference: 'Global Database: cross-Region <1s lag, promover secundario <1 min para DR.'
    },
    {
      question: 'No Route 53, qual routing policy fornece failover ativo-passivo?',
      options: ['Weighted', 'Latency', 'Failover', 'Multivalue'],
      correct: 2,
      explanation: 'Failover routing: registro primario serve trafego quando saudavel, secundario assume quando health check do primario falha. Padrao ativo-passivo para DR.',
      reference: 'Failover = ativo-passivo. Weighted = distribuicao de trafego. Latency = Region mais proxima.'
    },
    {
      question: 'Qual o proposito do cooldown no Auto Scaling?',
      options: ['Resfriar a CPU', 'Periodo de espera apos scaling para evitar scale in/out rapido', 'Tempo para aquecer instancias', 'Delay antes do health check'],
      correct: 1,
      explanation: 'Cooldown (padrao 300s) previne acoes de scaling sucessivas rapidas. Apos um evento, ASG espera antes de responder a novos alarmes para metricas estabilizarem.',
      reference: 'Cooldown padrao: 300s. Previne flapping. Pode customizar por politica.'
    },
    {
      question: 'Qual a vantagem do NLB sobre ALB para PrivateLink?',
      options: ['NLB e mais barato', 'NLB e obrigatorio para endpoint services do PrivateLink (ALB nao pode)', 'NLB tem melhor roteamento', 'NLB suporta WebSocket'],
      correct: 1,
      explanation: 'Endpoint services do PrivateLink requerem NLB como backend. ALB nao pode ser usado diretamente como provider de servico PrivateLink.',
      reference: 'PrivateLink = NLB obrigatorio. ALB pode ficar atras do NLB se necessario.'
    }
  ],

  flashcards: [
    { front: 'ALB vs NLB vs GLB?', back: 'ALB: L7, HTTP/HTTPS, roteamento path/host, WebSocket, Lambda. NLB: L4, TCP/UDP, IP estatico, ultra-baixa latencia, PrivateLink. GLB: L3, GENEVE, appliances de seguranca inline.' },
    { front: 'RDS Multi-AZ vs Read Replicas?', back: 'Multi-AZ: HA, standby sincrono, auto-failover ~60s, NAO legivel, mesma Region. Read Replicas: performance, async, legiveis, promocao manual, cross-Region possivel.' },
    { front: 'Features de HA do Aurora?', back: '6 copias em 3 AZs, storage self-healing, ate 15 replicas (failover ms), Global Database (<1s cross-Region), Serverless v2 (0.5-128 ACU), Backtrack (72h), Cloning.' },
    { front: 'Tipos de politica Auto Scaling?', back: 'Target Tracking: manter metrica no alvo (mais simples). Step: thresholds de alarme. Scheduled: temporal. Predictive: previsao ML. Cooldown: 300s padrao entre acoes.' },
    { front: 'Route 53 routing para HA?', back: 'Failover: ativo-passivo com health checks. Weighted: distribuicao (blue/green). Multivalue: multiplos IPs saudaveis. Latency: Region de menor latencia. Todos usam health checks.' },
    { front: 'O que sao Aurora Global Databases?', back: 'Replicacao cross-Region com <1s de lag. Secundario pode ser promovido em <1 min. Ate 5 Regions secundarias. Para DR e reads globais de baixa latencia.' },
    { front: 'Cross-zone load balancing no NLB?', back: 'Distribui trafego igualmente entre targets em todas as AZs. Desabilitado por padrao no NLB (cobra se habilitado). Sempre habilitado no ALB (gratis).' },
    { front: 'O que sao ASG Warm Pools?', back: 'Instancias pre-inicializadas paradas prontas para scale-out rapido. Passam por lifecycle hooks e sao paradas. No scale-out, iniciam do pool em vez de lancar novas (muito mais rapido).' }
  ],

  lab: {
    scenario: 'Projete uma arquitetura de aplicacao web altamente disponivel.',
    objective: 'Configurar ALB com Auto Scaling, RDS Multi-AZ e Route 53 health checks.',
    duration: '25-30 minutos',
    steps: [
      {
        title: 'Criar ALB com Target Group',
        instruction: 'Crie um Application Load Balancer com target group para health checks HTTP e registre instancias EC2.',
        hints: ['ALB requer pelo menos 2 AZs', 'Health check path deve ser um endpoint leve'],
        solution: '```bash\n# Criar target group\naws elbv2 create-target-group --name web-tg \\\n  --protocol HTTP --port 80 --vpc-id vpc-xxx \\\n  --health-check-path /health\n\n# Criar ALB\naws elbv2 create-load-balancer --name web-alb \\\n  --subnets subnet-az1 subnet-az2 \\\n  --security-groups sg-alb\n\n# Criar listener\naws elbv2 create-listener --load-balancer-arn ALB_ARN \\\n  --protocol HTTP --port 80 \\\n  --default-actions Type=forward,TargetGroupArn=TG_ARN\n```',
        verify: '```bash\naws elbv2 describe-target-health --target-group-arn TG_ARN\n# Esperado: targets com HealthState = healthy\n```'
      },
      {
        title: 'Configurar Auto Scaling Group',
        instruction: 'Crie um ASG com politica target tracking para manter CPU em 50%, min 2, max 6 instancias.',
        hints: ['Use launch template, nao launch config', 'Target tracking e a politica mais simples'],
        solution: '```bash\n# Criar ASG\naws autoscaling create-auto-scaling-group --auto-scaling-group-name web-asg \\\n  --launch-template LaunchTemplateId=lt-xxx,Version=\\$Latest \\\n  --min-size 2 --max-size 6 --desired-capacity 2 \\\n  --target-group-arns TG_ARN \\\n  --vpc-zone-identifier "subnet-az1,subnet-az2"\n\n# Adicionar politica target tracking\naws autoscaling put-scaling-policy --auto-scaling-group-name web-asg \\\n  --policy-name cpu-target-50 --policy-type TargetTrackingScaling \\\n  --target-tracking-configuration \'{"PredefinedMetricSpecification":{"PredefinedMetricType":"ASGAverageCPUUtilization"},"TargetValue":50.0}\'\n```',
        verify: '```bash\naws autoscaling describe-auto-scaling-groups --auto-scaling-group-names web-asg\n# Esperado: MinSize=2, MaxSize=6\n```'
      },
      {
        title: 'Habilitar RDS Multi-AZ',
        instruction: 'Crie uma instancia RDS com Multi-AZ habilitado para failover automatico.',
        hints: ['Multi-AZ dobra o custo', 'Failover e automatico em falha de AZ, instancia ou manutencao'],
        solution: '```bash\n# Criar RDS Multi-AZ\naws rds create-db-instance --db-instance-identifier prod-db \\\n  --db-instance-class db.r6g.large --engine postgres \\\n  --master-username admin --master-user-password MyP@ss123 \\\n  --allocated-storage 100 --multi-az\n```',
        verify: '```bash\naws rds describe-db-instances --db-instance-identifier prod-db \\\n  --query "DBInstances[0].{MultiAZ:MultiAZ,AZ:AvailabilityZone}"\n# Esperado: MultiAZ = true\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Health Checks do ALB Falhando Apesar da Aplicacao Funcionar',
      difficulty: 'medium',
      symptom: 'ALB mostra targets como unhealthy mas a aplicacao responde corretamente quando acessada diretamente.',
      diagnosis: '```\nChecklist:\n1. Path do health check correto? (ex: /health vs /)\n2. Aplicacao retorna 200 no path do health check?\n3. SG na instancia permite trafego do SG do ALB?\n4. Porta do health check corresponde a porta da aplicacao?\n5. Timeout do health check < intervalo?\n\nCausas comuns:\n  - App retorna 301 redirect em / (health check espera 200)\n  - SG nao permite inbound do SG do ALB\n  - Path do health check requer autenticacao\n```',
      solution: 'Defina health check path para endpoint leve que retorna 200 sem auth (ex: /health). Garanta que SG da instancia permite inbound do SG do ALB na porta do health check.'
    },
    {
      title: 'Auto Scaling Oscilando: Scale Out e Imediatamente Scale In',
      difficulty: 'hard',
      symptom: 'ASG continua adicionando instancias e removendo em sucessao rapida. Contagem oscila.',
      diagnosis: '```\nCausas possiveis:\n\n1. Cooldown muito curto:\n   300s padrao pode nao ser suficiente para metricas estabilizarem\n\n2. Health check muito agressivo:\n   ELB health check falha durante startup da instancia\n   ASG substitui instancia "unhealthy" antes de estar pronta\n\n3. Target tracking alvo muito baixo:\n   ex: CPU target 30% causa ajuste constante\n\n4. Sem warm-up time configurado:\n   Metricas de nova instancia incluidas imediatamente\n\nVerifique:\n  aws autoscaling describe-scaling-activities \\\n    --auto-scaling-group-name web-asg\n```',
      solution: 'Aumente cooldown (ex: 600s). Defina estimated instance warm-up time na politica. Use ELB health checks com grace period adequado (ex: 300s). Defina target tracking realista (50% CPU, nao 30%). Considere Warm Pools para boot mais rapido.'
    }
  ]
};
