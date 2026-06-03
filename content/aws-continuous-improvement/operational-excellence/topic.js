window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['aws-continuous-improvement/operational-excellence'] = {
  theory: `# Excelencia Operacional e Automacao

## Relevancia no Exame
> **Continuous Improvement for Existing Solutions** vale **25%** do SAP-C02. Pipelines CI/CD, CloudFormation avancado, Systems Manager e automacao operacional sao topicos centrais.

## AWS CodePipeline e CI/CD

### Estagios do Pipeline
1. **Source**: CodeCommit, GitHub, S3, ECR (trigger no push)
2. **Build**: CodeBuild (rodar testes, compilar, criar artefatos)
3. **Test**: testes de integracao, gates de aprovacao
4. **Deploy**: CodeDeploy, ECS, EKS, CloudFormation, Elastic Beanstalk
5. **Approval**: acao de aprovacao manual (email via SNS)

### CodeBuild
- Servico de build gerenciado (sem servidores para manter)
- **buildspec.yml**: define fases de build (install, pre_build, build, post_build)
- Roda em containers Docker (imagem gerenciada ou ECR customizado)
- Pode buildar recursos VPC-privados (usando configuracao VPC)
- **Caching**: S3 ou local para camadas de dependencias

### Estrategias de Deployment CodeDeploy
| Estrategia | EC2/On-Prem | Lambda | ECS |
|------------|-------------|--------|-----|
| **In-Place** | Sim | Nao | Nao |
| **Blue/Green** | Sim | Sim | Sim |
| **Canary** | Nao | Sim | Sim |
| **Linear** | Nao | Sim | Sim |
| **All-at-Once** | Sim | Nao | Nao |

## AWS CloudFormation Avancado

### Conceitos-Chave
- **StackSets**: deploy de stacks em multiplas contas/regioes com uma operacao
  - **Service-managed**: usa Organizations para targeting de contas
  - **Self-managed**: configuracao manual de role IAM
- **Change Sets**: visualize mudancas antes de aplicar (como Terraform plan)
- **Drift Detection**: detecta mudancas manuais de configuracao
- **Stack Policies**: protege recursos criticos de atualizacoes acidentais
- **Nested Stacks**: templates modulares (stack root referencia stacks filho)
- **Custom Resources**: recursos backed por Lambda para servicos nao-nativos
- **Macros**: transforma trechos de template (como SAM transform)

### Boas Praticas
- Use Parameters + SSM Parameter Store para valores dinamicos
- Exporte outputs para referencias cross-stack
- Use DeletionPolicy: Retain para bancos/buckets S3 de producao
- Habilite protecao de terminacao em stacks de producao

## AWS Systems Manager (SSM)

Ferramenta operacional para gerenciar EC2 e on-premises:
- **Session Manager**: SSH pelo browser sem bastion host, sem portas abertas
- **Patch Manager**: patching automatizado com maintenance windows
- **Parameter Store**: armazenamento hierarquico de config (plaintext ou SecureString com KMS)
- **Integracao Secrets Manager**: referencie segredos em userdata/apps EC2
- **Run Command**: execute comandos em frotas sem SSH
- **State Manager**: garanta estado de configuracao consistente
- **Automation**: runbooks para tarefas operacionais comuns (start/stop EC2, criacao de AMI)
- **OpsCenter**: problemas operacionais centralizados com OpsItems
- **Incident Manager**: coordene resposta a incidentes (runbooks, escalacao, notificacoes)

### Parameter Store vs Secrets Manager
| Feature | Parameter Store | Secrets Manager |
|---------|----------------|----------------|
| **Nivel gratuito** | Standard (10k params) | Sem nivel gratuito |
| **Auto-rotacao** | Nao | Sim (baseado em Lambda) |
| **Cross-account** | Limitado | Sim |
| **Tamanho max** | 8KB | 64KB |
| **Uso principal** | Valores de config, strings nao-secretas | Credenciais, chaves de API |

## AWS OpsWorks

Puppet/Chef gerenciado:
- **OpsWorks Stacks**: layers (web, app, db), recipes
- **OpsWorks for Chef Automate**: servidor Chef totalmente gerenciado
- **OpsWorks for Puppet Enterprise**: master Puppet totalmente gerenciado
- Caminho de migracao: move para SSM State Manager ou Ansible

## Prontidao Operacional

- **AWS Health**: eventos de saude do servico, manutencoes agendadas, problemas especificos da conta
- **Personal Health Dashboard**: eventos de saude da sua conta
- **Service Health Dashboard**: pagina de status global da AWS
- **Integracao EventBridge**: automatize respostas a eventos de Health

## Erros Comuns

- Esquecer CloudFormation StackSets para deploy multi-conta (use Organizations)
- Escolher Secrets Manager quando Parameter Store e suficiente (custo-consciente)
- Nao usar Session Manager quando bastion host e mencionado (alternativa moderna)
- Perder drift detection apos mudancas manuais de configuracao
- Nao saber que CodeDeploy suporta traffic shifting Lambda (canary/linear)
`,

  quiz: [
    {
      question: 'Qual a diferenca entre CloudFormation StackSets com permissoes Service-Managed vs Self-Managed?',
      options: ['Nenhuma diferenca', 'Service-Managed usa AWS Organizations para targeting de contas; Self-Managed requer configuracao manual de role IAM em cada conta', 'Service-Managed e mais barato', 'Self-Managed tem mais recursos'],
      correct: 1,
      explanation: 'Service-Managed: integra com Organizations, provisiona automaticamente em novas contas, sem configuracao manual de IAM. Self-Managed: crie roles IAM manualmente nas contas admin e destino, mais controle granular.',
      reference: 'StackSets Service-Managed = integracao Organizations, automatico. Self-Managed = roles IAM manuais, mais controle.'
    },
    {
      question: 'O que o AWS Systems Manager Session Manager oferece comparado ao SSH tradicional?',
      options: ['Melhor performance', 'Acesso via browser sem porta 22 aberta, sem bastion hosts ou chaves SSH — totalmente auditado via CloudTrail', 'Compute mais barato', 'Sessoes multiusuario'],
      correct: 1,
      explanation: 'Session Manager: acesse instancias EC2 via browser ou AWS CLI sem SSH. Nenhuma porta de entrada necessaria, sem bastion hosts, sem key pairs para gerenciar. Todas as sessoes registradas no CloudTrail e opcionalmente em S3/CloudWatch Logs.',
      reference: 'Session Manager = sem porta SSH, sem bastion, sem keys. Totalmente auditado. Funciona para on-prem via SSM Agent.'
    },
    {
      question: 'Quando usar Secrets Manager em vez do SSM Parameter Store?',
      options: ['Sempre — Secrets Manager e melhor', 'Quando precisa de rotacao automatica de credenciais, acesso cross-account ou compartilhamento de segredos entre contas', 'Quando segredos sao pequenos (< 8KB)', 'Quando custo e uma preocupacao (Parameter Store e mais caro)'],
      correct: 1,
      explanation: 'Secrets Manager: auto-rotacao (Lambda), compartilhamento cross-account, integracao com banco de dados. Parameter Store: nivel gratuito para params standard, valores de config, strings nao-secretas. Use Secrets Manager para credenciais que rotacionam.',
      reference: 'Secrets Manager = auto-rotacao, cross-account. Parameter Store = nivel gratuito, valores de config, sem rotacao.'
    },
    {
      question: 'O que o deployment canary do CodeDeploy faz para funcoes Lambda?',
      options: ['Faz deploy para um ambiente canary', 'Direciona pequeno % de trafego para nova versao Lambda primeiro, monitora alarmes, depois desloca % restante apos bake time', 'Cria uma copia da funcao Lambda', 'Faz deploy para uma conta de teste primeiro'],
      correct: 1,
      explanation: 'CodeDeploy canary para Lambda: ex. Canary10Percent5Minutes = 10% de trafego para nova versao por 5 minutos, monitorar alarmes CloudWatch, depois 100% se saudavel. Rollback automatico se alarmes dispararem.',
      reference: 'CodeDeploy Lambda = canary (10%+resto) ou linear (% gradual). Rollback automatico em alarme. Aliases ponderados.'
    },
    {
      question: 'O que o Drift Detection do CloudFormation identifica?',
      options: ['Desvio de custo do orcamento', 'Recursos modificados manualmente fora do CloudFormation (divergencia de configuracao)', 'Falhas de deploy de stack', 'Mudancas na disponibilidade de region'],
      correct: 1,
      explanation: 'Drift Detection: compara a configuracao atual do recurso na AWS com o que o CloudFormation espera baseado no template. Identifica recursos modificados diretamente via console, CLI ou API — nao via CloudFormation.',
      reference: 'Drift = mudancas manuais fora do CloudFormation. Detecte por stack. Remedie importando ou reimplantando.'
    },
    {
      question: 'Qual o objetivo de uma Stack Policy do CloudFormation?',
      options: ['Politica IAM para o servico CloudFormation', 'Documento JSON que define quais recursos de stack podem ser atualizados, prevenindo modificacao acidental de recursos criticos', 'Politica para deploys cross-account', 'Politica para CloudFormation StackSets'],
      correct: 1,
      explanation: 'Stack Policy: define quais recursos sao protegidos de atualizacoes. Exemplo: prevenir delecao acidental de um banco RDS de producao. Deve permitir explicitamente atualizacoes em recursos protegidos.',
      reference: 'Stack Policy = proteger recursos de atualizacoes. Diferente de politicas IAM. Substituivel temporariamente.'
    },
    {
      question: 'O que o arquivo buildspec.yml define no AWS CodeBuild?',
      options: ['O tamanho do servidor de build', 'Fases de build (install, pre_build, build, post_build), comandos, variaveis de ambiente e artefatos', 'A configuracao de deployment', 'O repositorio de codigo-fonte'],
      correct: 1,
      explanation: 'buildspec.yml: arquivo de configuracao na raiz do repositorio que define o ciclo de vida do build. Fases: install (runtime), pre_build (login no ECR), build (rodar testes/compilar), post_build (enviar artefatos).',
      reference: 'buildspec.yml = fases (install/pre_build/build/post_build), comandos, variaveis de env, definicao de artefatos.'
    },
    {
      question: 'Para que serve o AWS Systems Manager Automation?',
      options: ['Auto-scaling', 'Runbooks para tarefas operacionais comuns: start/stop EC2, criar AMIs, patching, remediar violacoes Config', 'Testes automatizados', 'Automacao de banco de dados'],
      correct: 1,
      explanation: 'SSM Automation: execute runbooks operacionais (documentos) em escala. Pre-construidos: patching, reiniciar servicos, criar AMIs. Customizados: workflows complexos multipassos. Integra com remediacao Config e EventBridge.',
      reference: 'SSM Automation = runbooks operacionais em escala. Docs pre-construidos. Remediacao Config. Triggers EventBridge.'
    }
  ],

  flashcards: [
    { front: 'Estagios CodePipeline?', back: 'Source (CodeCommit/GitHub/S3/ECR) -> Build (CodeBuild) -> Test -> Deploy (CodeDeploy/ECS/CFN) -> Approval (manual). Acoes paralelas dentro de estagios. Deploy cross-region/cross-account suportado.' },
    { front: 'CloudFormation StackSets?', back: 'Deploy stacks em multiplas contas/regioes. Service-Managed: usa Organizations, provisiona automaticamente em novas contas. Self-Managed: roles IAM manuais. Deploys simultaneos configurados.' },
    { front: 'Beneficios SSM Session Manager?', back: 'Sem porta 22 aberta. Sem bastion hosts. Sem key pairs. Acesso via browser ou CLI. Trilha completa de auditoria (CloudTrail + logs S3/CWL). Funciona para EC2 + on-prem via SSM Agent.' },
    { front: 'Secrets Manager vs Parameter Store?', back: 'Secrets Manager: auto-rotacao, cross-account, integracao DB, $0,40/segredo/mes. Parameter Store: gratuito standard (10k), sem auto-rotacao, valores config, max 8KB. Use Secrets para credenciais rotativas.' },
    { front: 'Tipos de deployment CodeDeploy?', back: 'EC2/On-Prem: In-Place, Blue/Green. Lambda: Canary (10%+resto), Linear (%gradual), AllAtOnce. ECS: apenas Blue/Green. Todos suportam rollback por alarme CloudWatch.' },
    { front: 'Recursos-chave CloudFormation?', back: 'StackSets (multi-conta/region). Change Sets (preview). Drift Detection (mudancas manuais). Stack Policy (proteger recursos). Nested Stacks (modular). Custom Resources (Lambda-backed). Macros (transforms).' },
    { front: 'Componentes SSM?', back: 'Session Manager: acesso sem SSH. Patch Manager: patching automatico. Parameter Store: config. Run Command: comandos em frotas. State Manager: desvio config. Automation: runbooks. OpsCenter: issues operacionais. Incident Manager: resposta.' },
    { front: 'AWS Health?', back: 'Personal Health Dashboard: eventos especificos da conta. Service Health Dashboard: status global. Integracao EventBridge: automatize respostas (notificar, remediar). Lista de recursos afetados. Alertas de manutencao agendada.' }
  ],

  lab: {
    scenario: 'Construa um pipeline CI/CD para uma aplicacao containerizada com testes automatizados e deployment blue/green.',
    objective: 'Praticar CodePipeline, CodeBuild e CodeDeploy para deployment ECS blue/green.',
    duration: '25-30 minutos',
    steps: [
      {
        title: 'Criar Projeto CodeBuild com buildspec.yml',
        instruction: 'Crie um projeto CodeBuild que builda uma imagem Docker, roda testes e envia para o ECR.',
        hints: ['CodeBuild precisa de role IAM com permissoes ECR', 'Use variaveis de ambiente para account ID e region'],
        solution: '```bash\n# Criar projeto CodeBuild\naws codebuild create-project \\\n  --name AppBuild \\\n  --source type=CODECOMMIT,location=https://git-codecommit.us-east-1.amazonaws.com/v1/repos/meu-app \\\n  --artifacts type=NO_ARTIFACTS \\\n  --environment type=LINUX_CONTAINER,computeType=BUILD_GENERAL1_SMALL,image=aws/codebuild/standard:7.0,privilegedMode=true \\\n  --service-role arn:aws:iam::CONTA:role/CodeBuildRole\n\n# Exemplo buildspec.yml (no repositorio)\n# version: 0.2\n# phases:\n#   pre_build:\n#     commands:\n#       - aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_URI\n#   build:\n#     commands:\n#       - docker build -t $ECR_URI:$CODEBUILD_RESOLVED_SOURCE_VERSION .\n#   post_build:\n#     commands:\n#       - docker push $ECR_URI:$CODEBUILD_RESOLVED_SOURCE_VERSION\n```',
        verify: '```bash\naws codebuild batch-get-projects --names AppBuild\n# Esperado: projeto com ambiente LINUX_CONTAINER\n\n# Iniciar build manualmente para testar\naws codebuild start-build --project-name AppBuild\n# Esperado: buildId retornado, monitore no console\n```'
      },
      {
        title: 'Criar CodePipeline com Estagios Source e Deploy',
        instruction: 'Crie um CodePipeline que dispara a partir do CodeCommit, builda com CodeBuild e faz deploy para ECS usando blue/green.',
        hints: ['Pipeline precisa de role de servico com permissoes para todos os estagios', 'ECS blue/green usa CodeDeploy como provedor de deploy'],
        solution: '```bash\naws codepipeline create-pipeline --pipeline \'{\n  "name": "AppPipeline",\n  "roleArn": "arn:aws:iam::CONTA:role/CodePipelineRole",\n  "artifactStore": {"type": "S3", "location": "bucket-pipeline"},\n  "stages": [\n    {\n      "name": "Source",\n      "actions": [{"name":"Source","actionTypeId":{"category":"Source","owner":"AWS","provider":"CodeCommit","version":"1"},"outputArtifacts":[{"name":"SourceOutput"}],"configuration":{"RepositoryName":"meu-app","BranchName":"main"}}]\n    },\n    {\n      "name": "Build",\n      "actions": [{"name":"Build","actionTypeId":{"category":"Build","owner":"AWS","provider":"CodeBuild","version":"1"},"inputArtifacts":[{"name":"SourceOutput"}],"outputArtifacts":[{"name":"BuildOutput"}],"configuration":{"ProjectName":"AppBuild"}}]\n    }\n  ]\n}\'\n```',
        verify: '```bash\naws codepipeline get-pipeline --name AppPipeline\n# Esperado: pipeline com estagios Source e Build\n\naws codepipeline get-pipeline-state --name AppPipeline\n# Esperado: status da ultima execucao para cada estagio\n```'
      },
      {
        title: 'Configurar SSM Parameter Store para Configuracao de App',
        instruction: 'Armazene configuracao de aplicacao no SSM Parameter Store e acesse-a do Lambda/EC2 em tempo de execucao.',
        hints: ['Use tipo SecureString para valores sensiveis', 'Politica IAM deve conceder ssm:GetParameter para caminhos especificos'],
        solution: '```bash\n# Criar parametro standard\naws ssm put-parameter \\\n  --name "/meuapp/prod/database-url" \\\n  --value "mysql://rds-endpoint:3306/mydb" \\\n  --type String \\\n  --description "URL banco de dados producao"\n\n# Criar parametro seguro (criptografado com KMS)\naws ssm put-parameter \\\n  --name "/meuapp/prod/api-key" \\\n  --value "valor-api-key-secreta" \\\n  --type SecureString \\\n  --key-id alias/aws/ssm\n\n# Obter valor do parametro\naws ssm get-parameter \\\n  --name "/meuapp/prod/database-url" \\\n  --query "Parameter.Value" --output text\n\n# Obter todos sob um caminho\naws ssm get-parameters-by-path \\\n  --path "/meuapp/prod/" \\\n  --with-decryption\n```',
        verify: '```bash\naws ssm describe-parameters \\\n  --filters "Key=Path,Values=/meuapp/prod/"\n# Esperado: ambos os parametros listados\n\n# Verificar decriptografia funciona\naws ssm get-parameter \\\n  --name "/meuapp/prod/api-key" \\\n  --with-decryption \\\n  --query "Parameter.Value"\n# Esperado: valor decriptografado (nao blob criptografado)\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Stack CloudFormation Fazendo Rollback na Atualizacao',
      difficulty: 'medium',
      symptom: 'Atualizacao de stack CloudFormation falha e faz rollback. Mensagem de erro mostra estado UPDATE_ROLLBACK_COMPLETE.',
      diagnosis: '```\nChecklist de rollback CloudFormation:\n1. Verificar eventos da Stack:\n   aws cloudformation describe-stack-events \\\n     --stack-name NOME_STACK \\\n     --query "StackEvents[?ResourceStatus==FAILED]"\n   Procurar campo ResourceStatusReason\n\n2. Causas comuns:\n   a) Problema de permissao IAM: role CFN sem permissao necessaria\n      -> Verificar "is not authorized" no ResourceStatusReason\n   b) Recurso ja existe (conflito de nome)\n      -> Verificar se recurso com mesmo nome ja existe\n   c) Valor de parametro invalido\n      -> Violacoes de restricao em propriedades de recurso\n   d) Limite de servico excedido\n      -> Verificar "limit exceeded" no ResourceStatusReason\n\n3. Se travado em UPDATE_ROLLBACK_FAILED:\n   Nao pode prosseguir ate resolver\n   Deve usar continue-update-rollback ou deletar stack\n\n4. Change Sets:\n   Visualize com: aws cloudformation create-change-set\n   Detecte problemas antes de aplicar\n```',
      solution: 'Verifique eventos da stack pelo recurso FAILED e leia o ResourceStatusReason. Corrija a causa raiz (permissoes, conflitos de nome, valores de parametro). Use Change Sets para visualizar atualizacoes futuras. Se travado em UPDATE_ROLLBACK_FAILED, use continue-update-rollback ou ignore o recurso especifico. Habilite stack policy para prevenir mudancas acidentais em recursos criticos.'
    },
    {
      title: 'Pipeline CodeBuild Falhando com AccessDenied no Estagio de Build',
      difficulty: 'hard',
      symptom: 'Build CodeBuild falha imediatamente apos iniciar com erro AccessDenied. Funciona quando executado localmente com credenciais de desenvolvedor.',
      diagnosis: '```\nChecklist de permissao IAM CodeBuild:\n1. Role de servico CodeBuild vs credenciais de desenvolvedor:\n   CodeBuild usa a SERVICE ROLE configurada, nao credenciais do desenvolvedor\n   Role e especificada na configuracao do projeto\n\n2. Permissoes comuns necessarias:\n   - ECR: ecr:GetAuthorizationToken, ecr:BatchGetImage, ecr:PutImage\n   - S3 (artefatos): s3:PutObject, s3:GetObject\n   - SSM (acesso a parametros): ssm:GetParameter\n   - Secrets Manager: secretsmanager:GetSecretValue\n   - KMS (se params criptografados): kms:Decrypt\n\n3. Problemas de configuracao VPC:\n   Se CodeBuild esta em VPC sem NAT, nao consegue acessar:\n   - ECR (precisa de VPC endpoint ou NAT)\n   - S3 (precisa de VPC endpoint ou NAT)\n   - SSM (precisa de VPC endpoint ou NAT)\n\n4. Verificar CloudTrail pela chamada API negada:\n   Encontrar a acao exata que foi negada\n   aws cloudtrail lookup-events \\\n     --lookup-attributes AttributeKey=EventName,AttributeValue=AccessDenied\n```',
      solution: 'Verifique as permissoes da role de servico do CodeBuild — ela deve ter permissoes explicitas para cada servico AWS usado no build (ECR, S3, SSM, etc.). Se CodeBuild roda em VPC, garanta que VPC endpoints estao configurados para servicos necessarios. Verifique CloudTrail pela acao API especifica negada. Use o simulador de politica IAM para testar a role de servico.'
    }
  ]
};
