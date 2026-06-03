window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['aws-new-solutions/containers-at-scale'] = {
  theory: `# Containers e Microsservicos em Escala

## Relevancia no Exame
> **Design for New Solutions** vale **29%** do SAP-C02. Escolhas de orquestracao de containers (ECS vs EKS), Fargate, service mesh, service discovery e estrategias de deployment sao temas frequentes.

## ECS vs EKS em Escala

| Feature | ECS | EKS |
|---------|-----|-----|
| **Orquestracao** | Proprietario AWS | Kubernetes nativo |
| **Curva de aprendizado** | Baixa | Alta (Kubernetes) |
| **Portabilidade** | Apenas AWS | Multi-cloud/hibrido |
| **Launch types** | EC2, Fargate, External | EC2, Fargate, Managed Nodes |
| **Rede** | modo awsvpc (nativo VPC) | Plugin VPC CNI |
| **Service Mesh** | App Mesh / ECS Connect | App Mesh / Istio |
| **Custo** | Sem taxa de cluster | $0,10/hr por cluster |

### Conceitos Avancados ECS
- **Task Definitions**: blueprint para containers (CPU, memoria, rede, logging)
- **modo awsvpc**: cada task recebe proprio ENI e IP privado na VPC
- **Service Auto Scaling**: target tracking, step scaling para servicos ECS
- **Capacity Providers**: gerenciam Auto Scaling Groups EC2 para clusters ECS
- **ECS Anywhere**: execute ECS em servidores on-premises

### Conceitos Avancados EKS
- **Managed Node Groups**: AWS gerencia provisionamento + patching de EC2
- **EKS Fargate Profiles**: execute pods serverlessly no Fargate
- **EKS Anywhere**: execute EKS on-premises (VMware, bare metal)
- **EKS Blueprints**: configuracoes pre-definidas de cluster EKS
- **Karpenter**: provisionador de nodes open-source (melhor que Cluster Autoscaler)

## AWS Fargate

Compute serverless para containers — sem gerenciamento de EC2:
- **ECS no Fargate**: isolamento por task, ENI por task
- **EKS no Fargate**: Fargate profiles por pod (sem volumes persistentes no Fargate)
- **Preco**: vCPU + memoria por segundo (mais caro por unidade que EC2)
- **Caso de uso**: workloads variaveis, dev/test, jobs batch, operacoes mais simples

## AWS App Runner

Servico de container totalmente gerenciado para web apps/APIs:
- **Fonte**: deploy de imagem ECR ou repositorio GitHub diretamente
- **Auto-scaling**: escala para zero, escala a partir de zero (pay-per-use)
- **HTTPS**: TLS automatico, dominios customizados
- **Conectividade VPC**: endpoints VPC privados para servicos de backend
- **Caso de uso**: web apps/APIs simples sem complexidade ECS/EKS

## Amazon ECR

Registry de containers gerenciado:
- **ECR Public**: galeria publica (como Docker Hub)
- **ECR Private**: privado por conta e region
- **Vulnerability scanning**: Basico (no push) ou Avancado (continuo com Inspector)
- **Lifecycle policies**: expirar imagens nao-tagueadas automaticamente, manter N imagens tagueadas
- **Cross-region/cross-account**: replique imagens para deployments multi-region

## Service Discovery e Mesh

### AWS Cloud Map
- Registre servicos por nome (descoberta via DNS ou API)
- Health checks integrados
- Funciona entre VPCs e Regions

### AWS App Mesh
- Service mesh usando proxy sidecar Envoy
- **Virtual nodes**: representam servicos reais
- **Virtual services**: endpoint de servico abstrato
- **Traffic policies**: retries, timeouts, circuit breaking, roteamento canary
- **Observabilidade**: traces (X-Ray), metricas (CloudWatch), logs

## Estrategias de Deployment com CodeDeploy

| Estrategia | Descricao | Rollback |
|------------|-----------|---------|
| **Blue/Green** | Novo task set, muda trafego % ao longo do tempo | Instantaneo (rerotear para blue) |
| **Rolling** | Substitui old com new gradualmente | Lento (re-deploy) |
| **Canary** | Pequeno % para novo, monitora, depois completo | Rapido |

## AWS Proton

Infrastructure as Code para times de plataforma:
- **Templates**: time de plataforma define VPC, ECS/EKS, stacks CI/CD
- **Services**: desenvolvedores fazem deploy usando templates aprovados
- **Separacao de responsabilidades**: time de infra vs time de dev

## Erros Comuns

- Escolher ECS quando portabilidade Kubernetes e necessaria (use EKS)
- Usar Fargate quando armazenamento persistente (EBS) e necessario (nao suportado)
- Nao saber que App Runner escala para zero (economia de custo)
- Esquecer lifecycle policies do ECR causando altos custos de armazenamento
- Esquecer que App Mesh requer sidecar Envoy (nao pode usar nativamente)
`,

  quiz: [
    {
      question: 'Quando escolher EKS em vez de ECS?',
      options: ['Quando quer menor custo', 'Quando precisa de portabilidade Kubernetes, multi-cloud/hibrido ou tooling Kubernetes existente', 'EKS e sempre melhor', 'ECS tem mais recursos que EKS'],
      correct: 1,
      explanation: 'EKS: Kubernetes nativo, portavel entre ambientes, grande ecossistema. ECS: mais simples, nativo AWS, sem taxa de cluster. Escolha EKS para expertise K8s, multi-cloud ou tooling K8s existente. ECS para simplicidade e workloads somente AWS.',
      reference: 'EKS = K8s portavel, multi-cloud, $0,10/hr cluster. ECS = mais simples, nativo AWS, sem taxa de cluster.'
    },
    {
      question: 'Qual a principal limitacao do EKS Fargate vs grupos de nodes EC2?',
      options: ['Maior latencia', 'Sem suporte a volumes EBS persistentes ou DaemonSets', 'Nao pode usar spot instances', 'Sem horizontal pod autoscaling'],
      correct: 1,
      explanation: 'EKS Fargate nao suporta volumes EBS persistentes (use EFS), DaemonSets nem containers privilegiados. Grupos de nodes EC2 suportam todos os tipos de workloads Kubernetes.',
      reference: 'Limitacoes Fargate: sem EBS, sem DaemonSets, sem privilegiado. Use nodes EC2 para esses requisitos.'
    },
    {
      question: 'O que diferencia o AWS App Runner do ECS/EKS?',
      options: ['Suporta apenas aplicacoes Java', 'Totalmente gerenciado com auto-scaling para zero, deploy direto de codigo-fonte ou ECR, configuracao minima', 'E mais barato que Fargate', 'Tem mais opcoes de rede'],
      correct: 1,
      explanation: 'App Runner: deploy de containers ou codigo-fonte diretamente, auto-scale para zero (economia), HTTPS/load balancing integrados. Sem gerenciamento de cluster ou task definition. Ideal para web apps/APIs simples.',
      reference: 'App Runner = containers serverless, escala para zero, de codigo ou ECR. ECS/EKS = mais controle e complexidade.'
    },
    {
      question: 'Qual estrategia de deployment permite rollback instantaneo sem custo adicional?',
      options: ['Rolling update', 'Blue/Green deployment', 'Canary deployment', 'In-place update'],
      correct: 1,
      explanation: 'Blue/Green: nova versao implantada ao lado da antiga. Trafego deslocado usando target groups com peso ALB/NLB. Rollback = rerotear trafego para ambiente blue instantaneamente. Sem necessidade de re-deploy.',
      reference: 'Blue/Green = rollback instantaneo, zero-downtime. Rolling = gradual, rollback mais lento. Canary = testa % pequeno primeiro.'
    },
    {
      question: 'O que o modo de rede awsvpc fornece para tasks ECS?',
      options: ['Melhor performance', 'Cada task recebe proprio ENI e endereco IP VPC, habilitando controle granular de Security Group', 'IP compartilhado entre tasks', 'Acesso a internet por padrao'],
      correct: 1,
      explanation: 'Modo awsvpc: cada task ECS recebe proprio Elastic Network Interface (ENI) na VPC. Habilita Security Groups no nivel da task (nao so da instancia), VPC Flow Logs por task e mesma rede que EC2.',
      reference: 'awsvpc = ENI por task, SG no nivel task, rede nativa VPC. Obrigatorio para Fargate.'
    },
    {
      question: 'O que o ECR Enhanced Scanning oferece que o Basic Scanning nao oferece?',
      options: ['Scan mais rapido', 'Scan continuo com Amazon Inspector (nao so no push), deteccao de vulnerabilidades em OS e pacotes', 'Replicacao cross-region', 'Registry privado'],
      correct: 1,
      explanation: 'Basic Scanning: scan no push apenas, vulnerabilidades OS. Enhanced Scanning: usa Amazon Inspector, scan continuo, OS + vulnerabilidades em pacotes de linguagem de programacao, re-scan automatico quando novos CVEs publicados.',
      reference: 'Basic = no push, so OS. Enhanced = continuo, OS + pacotes (Inspector). Recomendado para producao.'
    },
    {
      question: 'Para que serve o AWS App Mesh em arquiteturas de microsservicos?',
      options: ['Load balancing', 'Service mesh usando proxy sidecar Envoy para gerenciamento de trafego, retries, circuit breaking e observabilidade', 'Registry de containers', 'DNS de service discovery'],
      correct: 1,
      explanation: 'App Mesh fornece capacidades de service mesh: roteamento de trafego, retries, timeouts, circuit breaking e observabilidade (metricas, traces, logs) sem mudancas de codigo. Usa proxy Envoy sidecar injetado em cada container.',
      reference: 'App Mesh = sidecar Envoy, politicas de trafego, observabilidade. Cloud Map = service discovery (DNS/API).'
    },
    {
      question: 'Qual e o caso de uso correto para ECS Capacity Providers?',
      options: ['Gerenciar permissoes IAM', 'Define estrategia de compute (EC2 ASG) para clusters ECS — scaling gerenciado de instancias EC2', 'Configurar rede', 'Gerenciar imagens ECR'],
      correct: 1,
      explanation: 'Capacity Providers: vinculam clusters ECS a Auto Scaling Groups EC2. Scaling gerenciado ajusta automaticamente o ASG baseado na demanda de tasks ECS. Peso entre multiplos capacity providers para otimizacao de custo.',
      reference: 'Capacity Providers = vincular ECS ao EC2 ASG, scaling gerenciado. Misture Spot + On-Demand para economia.'
    }
  ],

  flashcards: [
    { front: 'Escolha ECS vs EKS?', back: 'ECS: nativo AWS, mais simples, sem taxa cluster, rede awsvpc. EKS: Kubernetes nativo, portavel, multi-cloud, $0,10/hr cluster. Escolha ECS para simplicidade, EKS para portabilidade/ecossistema K8s.' },
    { front: 'Limitacoes do Fargate?', back: 'Sem volumes EBS persistentes (use EFS). Sem DaemonSets. Sem containers privilegiados. Sem GPU. Isolamento por task. Pague por vCPU/memoria por segundo. Suportado pelo ECS e EKS.' },
    { front: 'AWS App Runner?', back: 'Containers/apps totalmente gerenciados. Deploy de imagem ECR ou GitHub. Auto-scale para zero. HTTPS integrado, dominios customizados. Conectividade VPC. Sem gerenciamento de cluster. Ideal para web apps/APIs simples.' },
    { front: 'Features ECR?', back: 'Registries privados/publicos. Scan basico (no push, OS). Scan avancado (Inspector, continuo, OS+pacotes). Lifecycle policies (expirar imagens automaticamente). Replicacao cross-region/account. Tags imutaveis.' },
    { front: 'Estrategias de deployment?', back: 'Blue/Green: rollback instantaneo, rerotear trafego. Rolling: substituir tasks gradualmente, rollback mais lento. Canary: % pequeno para nova versao primeiro. Todos configurados com CodeDeploy para ECS.' },
    { front: 'Componentes App Mesh?', back: 'Virtual nodes: representam servicos. Virtual services: endpoint abstrato. Sidecar Envoy: injetado em cada task/pod. Traffic policies: retries, timeouts, circuit breaking, canary. Observabilidade: X-Ray + CloudWatch.' },
    { front: 'Cloud Map vs App Mesh?', back: 'Cloud Map: service discovery via DNS ou API (registrar/encontrar servicos). App Mesh: service mesh (gerenciamento trafego, resiliencia, observabilidade). Se complementam — Cloud Map para discovery, App Mesh para controle de trafego.' },
    { front: 'Modo awsvpc ECS?', back: 'Cada task ECS recebe proprio ENI + IP VPC. Security Groups no nivel task (granular). VPC Flow Logs por task. Mesma rede que instancias EC2. Obrigatorio para Fargate. Limita tasks por instancia (contagem ENI).' }
  ],

  lab: {
    scenario: 'Implante uma aplicacao de microsservicos no ECS Fargate com deployment blue/green.',
    objective: 'Praticar criacao de servico ECS, gerenciamento de imagem ECR e deployment blue/green.',
    duration: '25-30 minutos',
    steps: [
      {
        title: 'Criar Cluster ECS e Task Definition',
        instruction: 'Crie um cluster ECS com launch type Fargate e uma task definition para um servico web.',
        hints: ['Fargate requer modo de rede awsvpc', 'Task definition especifica CPU, memoria, imagem container'],
        solution: '```bash\n# Criar cluster ECS\naws ecs create-cluster --cluster-name cluster-microsservicos \\\n  --capacity-providers FARGATE FARGATE_SPOT\n\n# Criar task definition\naws ecs register-task-definition \\\n  --family web-service \\\n  --network-mode awsvpc \\\n  --requires-compatibilities FARGATE \\\n  --cpu "256" --memory "512" \\\n  --execution-role-arn arn:aws:iam::CONTA:role/ecsTaskExecutionRole \\\n  --container-definitions \'[{"name":"web","image":"nginx:latest","portMappings":[{"containerPort":80}],"logConfiguration":{"logDriver":"awslogs","options":{"awslogs-group":"/ecs/web-service","awslogs-region":"us-east-1","awslogs-stream-prefix":"web"}}}]\'\n```',
        verify: '```bash\naws ecs describe-clusters --clusters cluster-microsservicos\n# Esperado: status = ACTIVE, capacityProviders = [FARGATE, FARGATE_SPOT]\n\naws ecs describe-task-definition --task-definition web-service\n# Esperado: task definition registrada com compatibilidade FARGATE\n```'
      },
      {
        title: 'Criar Servico ECS com Blue/Green Deployment',
        instruction: 'Crie um servico ECS usando deployment blue/green do CodeDeploy com um Application Load Balancer.',
        hints: ['Blue/green requer deployment controller CodeDeploy', 'Dois target groups sao necessarios para o ALB'],
        solution: '```bash\n# Criar servico ECS com deployment controller CodeDeploy\naws ecs create-service \\\n  --cluster cluster-microsservicos \\\n  --service-name web-service \\\n  --task-definition web-service \\\n  --desired-count 2 \\\n  --launch-type FARGATE \\\n  --network-configuration "awsvpcConfiguration={subnets=[subnet-1111,subnet-2222],securityGroups=[sg-xxxx],assignPublicIp=ENABLED}" \\\n  --deployment-controller type=CODE_DEPLOY \\\n  --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:...:targetgroup/blue-tg/xxx,containerName=web,containerPort=80"\n```',
        verify: '```bash\naws ecs describe-services \\\n  --cluster cluster-microsservicos \\\n  --services web-service\n# Esperado: status = ACTIVE, deploymentController = CODE_DEPLOY\n# runningCount = desiredCount = 2\n```'
      },
      {
        title: 'Configurar ECR Lifecycle Policy',
        instruction: 'Crie uma lifecycle policy no ECR para remover automaticamente imagens nao-tagueadas com mais de 7 dias e manter apenas 5 imagens tagueadas.',
        hints: ['Lifecycle policies reduzem custos de armazenamento', 'Regras sao avaliadas em ordem por prioridade'],
        solution: '```bash\n# Criar repositorio ECR\naws ecr create-repository --repository-name web-service\n\n# Definir lifecycle policy\naws ecr put-lifecycle-policy \\\n  --repository-name web-service \\\n  --lifecycle-policy-text \'{"rules":[{"rulePriority":1,"description":"Remover nao-tagueadas > 7 dias","selection":{"tagStatus":"untagged","countType":"sinceImagePushed","countUnit":"days","countNumber":7},"action":{"type":"expire"}},{"rulePriority":2,"description":"Manter ultimas 5 tagueadas","selection":{"tagStatus":"tagged","tagPrefixList":["v"],"countType":"imageCountMoreThan","countNumber":5},"action":{"type":"expire"}}]}\'\n```',
        verify: '```bash\naws ecr get-lifecycle-policy --repository-name web-service\n# Esperado: lifecycle policy com 2 regras\n\naws ecr describe-repositories --repository-names web-service\n# Esperado: repositorio com imageScanningConfiguration\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Tasks ECS Falhando ao Iniciar (ResourceInitializationError)',
      difficulty: 'medium',
      symptom: 'Tasks ECS Fargate param imediatamente com ResourceInitializationError. Tasks nunca chegam ao estado RUNNING.',
      diagnosis: '```\nCausas comuns de ResourceInitializationError:\n1. Nao consegue fazer pull da imagem do ECR:\n   - Role de execucao da task sem ecr:GetAuthorizationToken\n   - Role de execucao sem ecr:BatchGetImage\n   - VPC sem acesso a internet + sem VPC endpoint para ECR\n   Verificar: logs do ecs-agent ou stoppedReason da task\n\n2. Acesso ao Secrets Manager/SSM Parameter Store:\n   - Role de execucao sem secretsmanager:GetSecretValue\n   - Sem VPC endpoint para Secrets Manager\n\n3. CloudWatch Logs:\n   - Role de execucao sem logs:CreateLogGroup, logs:CreateLogStream\n\nDiagnosticar:\n  aws ecs describe-tasks \\\n    --cluster CLUSTER --tasks TASK_ARN\n  Verificar stoppedReason e containers[].reason\n\nVPC Endpoints necessarios (sem NAT):\n  - com.amazonaws.REGION.ecr.dkr\n  - com.amazonaws.REGION.ecr.api\n  - com.amazonaws.REGION.s3 (gateway)\n  - com.amazonaws.REGION.logs\n```',
      solution: 'Verifique se a role de execucao da task tem permissoes de pull do ECR. Se a VPC nao tem acesso a internet, crie VPC Interface Endpoints para ECR (ecr.dkr, ecr.api) e S3 Gateway Endpoint. Verifique stoppedReason no describe-tasks para a causa exata. Habilite CloudWatch Container Insights para melhor visibilidade.'
    },
    {
      title: 'Blue/Green Deployment Travado no Replacement Task Set',
      difficulty: 'hard',
      symptom: 'Deployment blue/green do CodeDeploy cria replacement task set mas nunca completa o traffic shifting. Deployment fica em "WaitingForTrafficShiftToComplete".',
      diagnosis: '```\nFluxo deployment Blue/Green:\n1. ECS cria replacement (green) task set\n2. CodeDeploy faz health checks no green target group\n3. Se health checks passam: desloca trafego conforme deployment config\n4. Apos bake time: encerra task set original (blue)\n\nCausas comuns de travamento:\n1. Health checks do green target group falhando:\n   aws elbv2 describe-target-health \\\n     --target-group-arn ARN_GREEN_TG\n   \n2. Health check do container na task definition falhando:\n   aws ecs describe-tasks (verificar campo health)\n\n3. Security Group nao permite ALB -> task na porta correta\n\n4. Erro na aplicacao causando saida das tasks:\n   Verificar CloudWatch Logs dos containers green\n\n5. Timeout do deployment config:\n   Verificar eventos do deployment CodeDeploy no console\n```',
      solution: 'Verifique saude do green target group no ALB (aws elbv2 describe-target-health). Confirme que Security Groups permitem ALB alcançar tasks na porta do container. Verifique logs da aplicacao no CloudWatch. Se health checks passam mas trafego nao esta deslocando, verifique a ordem dos eventos lifecycle do deployment CodeDeploy. Override manual possivel no console do CodeDeploy.'
    }
  ]
};
