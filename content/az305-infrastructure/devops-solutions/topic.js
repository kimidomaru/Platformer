window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['az305-infrastructure/devops-solutions'] = {
  theory: `# Design de Soluções DevOps no Azure (AZ-305)

## Relevância no Exame
> Peso estimado **10-15%** no AZ-305. O exame avalia a capacidade de projetar pipelines de CI/CD, estratégias de deployment e integração de ferramentas DevOps no Azure.

## Azure DevOps vs GitHub Actions — Decisão de Design

| Critério | Azure DevOps | GitHub Actions |
|---------|-------------|---------------|
| Integração com Azure | Nativa e profunda | Muito boa (Azure/actions marketplace) |
| Gerenciamento de repositório | Azure Repos | GitHub |
| Pipelines complexos (YAML) | Azure Pipelines | GitHub Actions workflows |
| Workboards/Boards | Azure Boards | GitHub Projects |
| Enterprise compliance | Strong (Service Connections, Environments) | Boa (Environments, OIDC) |
| Custo | Pago após primeiros parallelism limits | Gratuito para públicos, pago para privados |
| Self-hosted runners | Agent pools | Self-hosted runners |

**Regra geral**: Azure DevOps para empresas com investimento histórico na plataforma; GitHub Actions para times novos ou com código open source.

## Azure Pipelines — Design de CI/CD

\`\`\`yaml
# azure-pipelines.yml — Pipeline multi-stage
trigger:
  branches:
    include: [main, release/*]

variables:
  acrRegistry: myacr.azurecr.io
  containerImage: myapp

stages:
  - stage: Build
    jobs:
      - job: BuildAndTest
        pool:
          vmImage: ubuntu-latest
        steps:
          - task: Docker@2
            inputs:
              command: buildAndPush
              repository: $(containerImage)
              containerRegistry: myACRServiceConnection
              tags: $(Build.BuildId)
          - task: PublishTestResults@2
            inputs:
              testResultsFormat: JUnit
              testResultsFiles: '**/test-results.xml'

  - stage: DeployStaging
    dependsOn: Build
    environment: staging     # Azure Pipelines Environment com approval gates
    jobs:
      - deployment: DeployToStaging
        strategy:
          runOnce:
            deploy:
              steps:
                - task: HelmDeploy@0
                  inputs:
                    command: upgrade
                    chartName: ./charts/myapp
                    releaseName: myapp-staging
                    namespace: staging
                    arguments: --set image.tag=$(Build.BuildId)

  - stage: DeployProd
    dependsOn: DeployStaging
    environment: production   # Requer aprovação manual
    jobs:
      - deployment: DeployToProd
        strategy:
          canary:
            increments: [10, 50, 100]   # Canary automático
            preDeploy:
              steps:
                - script: echo "Running pre-deploy checks"
\`\`\`

## Azure Container Registry (ACR) no Pipeline

\`\`\`bash
# Criar ACR com geo-replication
az acr create \
  --name myacr \
  --resource-group myRG \
  --sku Premium \
  --location eastus

# Geo-replication para DR
az acr replication create \
  --registry myacr --location westus

# Habilitar confiança em conteúdo (imagem assinada)
az acr config content-trust update \
  --registry myacr --status enabled

# Scan de vulnerabilidade integrado (Microsoft Defender for Containers)
az security container-registry-vulnerability-assessment-scan-result list \
  --registry myacr --resource-group myRG
\`\`\`

## Azure Deployment Environments

Ambientes sob demanda para desenvolvedores:

\`\`\`bash
# Criar Dev Center e Project
az devcenter admin devcenter create \
  --name mydevcenter --resource-group myRG

az devcenter admin project create \
  --dev-center mydevcenter \
  --name myproject \
  --resource-group myRG

# Dev pode criar ambiente de PR automaticamente
# Pipeline: az devcenter dev environment create --project myproject --name pr-123
\`\`\`

## Padrão: GitOps com Azure Arc

\`\`\`yaml
# GitOps FluxCD via Azure Arc
apiVersion: source.toolkit.fluxcd.io/v1beta2
kind: GitRepository
metadata:
  name: app-repo
spec:
  interval: 1m
  url: https://github.com/org/app
  ref:
    branch: main
---
apiVersion: kustomize.toolkit.fluxcd.io/v1beta2
kind: Kustomization
metadata:
  name: app
spec:
  interval: 5m
  path: ./k8s/overlays/production
  prune: true
  sourceRef:
    kind: GitRepository
    name: app-repo
\`\`\`

## Erros Comuns de Design

1. **Sem Environments no pipeline**: sem Azure Pipelines Environments, não há gate de aprovação manual antes de produção.
2. **Segredos no código ou pipeline variables**: usar Azure Key Vault + Service Connection para segredos, não pipeline variables visíveis.
3. **Container image com tag :latest**: sem tag versionada, não há como rollback. Sempre usar Build ID ou Git SHA.
4. **ACR Basic para produção**: sem geo-replication e sem scan de vulnerabilidade nativo — usar Premium.
5. **Pipeline sem lint/test stage**: pushar diretamente para staging sem testes unitários.

## Killer.sh Style Challenge (AZ-305)

> Uma empresa precisa: CI/CD para 50 microsserviços em AKS, scan de segurança em imagens, aprovação manual antes de produção, rollback em < 5 minutos, secrets gerenciados centralmente.
>
> **Resposta**: Azure DevOps Pipelines multi-stage + Azure Container Registry Premium (scan automático via Defender). Environments com approval gates antes de produção. Helm para deploy com version tags (Build.BuildId). Rollback: helm rollback. Azure Key Vault + Variable Groups no Azure DevOps para secrets. Azure Monitor alerts + automated rollback via webhook se error rate > threshold.
`,

  quiz: [
    {
      question: 'Qual é o mecanismo correto para armazenar e consumir segredos (senhas, connection strings) em pipelines do Azure DevOps?',
      options: [
        'Variáveis no pipeline em texto plano com "Secret" marcado no UI',
        'Azure Key Vault linked Variable Groups em Azure DevOps, que buscam segredos do Key Vault em runtime',
        'Hardcoded nas variáveis de ambiente do agente de build',
        'Segredos em arquivos .env no repositório Git criptografados'
      ],
      correct: 1,
      explanation: 'A abordagem correta é criar Variable Groups no Azure DevOps vinculados ao Azure Key Vault — os segredos são buscados do Key Vault em runtime, nunca armazenados no Azure DevOps. Variáveis "Secret" no UI do Azure DevOps são mascaradas no log mas ainda armazenadas no Azure DevOps (não ideal). Nunca armazenar segredos no Git, mesmo criptografados.',
      reference: 'Seção Erros Comuns — Key Vault + Variable Groups é o padrão enterprise para secrets em pipelines.'
    },
    {
      question: 'Por que usar tags versionadas (ex: Build.BuildId ou Git SHA) em imagens de container em vez de :latest?',
      options: [
        ':latest não é suportado pelo Azure Container Registry',
        'Tags versionadas permitem rollback preciso para qualquer versão anterior; :latest sobrescreve sempre a mesma tag impedindo rollback',
        'Tags numéricas têm melhor performance de pull que :latest',
        'Por razões de compliance de nomenclatura do ACR'
      ],
      correct: 1,
      explanation: 'A tag :latest é mutável — quando você faz rollback para "latest anterior", não existe mais, foi sobrescrita. Com tags imutáveis (Build.BuildId, Git SHA), cada build tem uma identidade única. helm rollback volta exatamente para a versão X que foi deployada, pois a imagem com aquela tag ainda existe no ACR. Adicionalmente, sem tag versionada não há rastreabilidade entre commit e deploy.',
      reference: 'Seção Erros Comuns — sempre versione imagens com identificador único (Build ID ou Git SHA).'
    },
    {
      question: 'O que são Azure Pipelines Environments e qual é seu benefício principal?',
      options: [
        'São ambientes virtuais para isolar builds em máquinas diferentes',
        'São abstrações que permitem configurar aprovações manuais, histórico de deploys e checks de saúde antes de avançar no pipeline para ambientes específicos',
        'São subscriptions Azure separadas para cada ambiente (dev, staging, prod)',
        'São pools de agentes de build dedicados por ambiente'
      ],
      correct: 1,
      explanation: 'Azure Pipelines Environments são representações de ambientes de deployment (staging, production) que permitem: (1) aprovações manuais antes de avançar, (2) histórico completo de deploys com audit trail, (3) checks automáticos (query do Azure Monitor, testes de smoke), (4) permissões de quem pode aprovar deploys para cada ambiente. Essenciais para compliance e controle de mudanças.',
      reference: 'Seção Azure Pipelines — Environments são o mecanismo correto para gates de aprovação, não apenas pipeline stages.'
    }
  ],

  flashcards: [
    {
      front: 'Quando escolher Azure DevOps vs GitHub Actions?',
      back: '**Azure DevOps** → quando:\n- Enterprise com compliance rigoroso (auditoria, Service Connections gerenciadas)\n- Time já usa Azure Boards, Azure Repos, Azure Test Plans\n- Pipelines complexos com paralelismo e dependências\n- Integração profunda com Azure Active Directory\n\n**GitHub Actions** → quando:\n- Código no GitHub (repositório público ou privado)\n- Time prefere simplicidade de configuração\n- Open source ou DevX moderno\n- Marketplace extenso com actions da comunidade\n\n**Ambos** suportam: auto-scale de runners, OIDC com Azure, multi-stage pipelines.'
    },
    {
      front: 'Qual é o padrão correto para CI/CD com containers no Azure?',
      back: '**Fluxo completo**:\n```\nGit push → Pipeline trigger\n  → Build: docker build → docker push ACR:$BUILD_ID\n  → Scan: Defender for Containers (ACR scan automático)\n  → Deploy Staging: helm upgrade --set image.tag=$BUILD_ID\n  → Smoke tests + approval gate\n  → Deploy Prod: helm upgrade (mesmo image.tag)\n  → Monitor: rollback automático se error rate > threshold\n```\n\n**Princípios**:\n1. Build once, deploy many (mesma imagem em todos ambientes)\n2. Tag imutável por build\n3. Secrets via Key Vault, nunca hardcoded\n4. Rollback = helm rollback <revision>'
    }
  ],

  lab: {
    scenario: 'Configurar um pipeline básico de CI/CD para uma aplicação containerizada usando Azure Container Registry.',
    objective: 'Criar ACR, build de imagem Docker e explorar integração com Azure Pipelines.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Criar Azure Container Registry',
        instruction: 'Crie um ACR Standard com login habilitado para uso no pipeline.',
        hints: ['az acr create --sku Standard', '--admin-enabled true para login com username/password'],
        solution: `\`\`\`bash
SUFFIX=$(date +%s | tail -c 5)
az group create --name rg-devops-lab --location eastus

az acr create \
  --name "technova\${SUFFIX}" \
  --resource-group rg-devops-lab \
  --sku Standard \
  --admin-enabled true

ACR_NAME="technova\${SUFFIX}"
ACR_LOGIN=$(az acr show --name $ACR_NAME --resource-group rg-devops-lab --query loginServer -o tsv)
echo "ACR: $ACR_LOGIN"
echo "ACR_NAME=$ACR_NAME" > /tmp/devopslab.sh
\`\`\``,
        verify: `\`\`\`bash
source /tmp/devopslab.sh
az acr show --name $ACR_NAME --resource-group rg-devops-lab \
  --query "{Name:name,Server:loginServer,Sku:sku.name,Status:provisioningState}" -o table
# Esperado: Standard, Succeeded
\`\`\``
      },
      {
        title: 'Build e push de imagem simulando pipeline',
        instruction: 'Use az acr build para construir uma imagem diretamente no ACR (sem Docker local), como num pipeline CI.',
        hints: ['az acr build = build remoto no ACR sem Docker local', '--image define nome:tag da imagem'],
        solution: `\`\`\`bash
source /tmp/devopslab.sh

# Criar Dockerfile simples
mkdir -p /tmp/devops-app
cat > /tmp/devops-app/Dockerfile << 'EOF'
FROM nginx:alpine
RUN echo "Build ID: BUILD_PLACEHOLDER" > /usr/share/nginx/html/version.txt
COPY . /usr/share/nginx/html/
EXPOSE 80
EOF

echo "Versão 1.0.$(date +%s | tail -c 4)" > /tmp/devops-app/index.html

# Build remoto no ACR (simula pipeline sem Docker local)
BUILD_ID=$(date +%s | tail -c 8)
az acr build \
  --registry $ACR_NAME \
  --image "myapp:$BUILD_ID" \
  --image "myapp:latest" \
  /tmp/devops-app/

echo "Imagem criada: $ACR_NAME.azurecr.io/myapp:$BUILD_ID"
\`\`\``,
        verify: `\`\`\`bash
source /tmp/devopslab.sh
az acr repository list --name $ACR_NAME -o tsv
# Esperado: myapp

az acr repository show-tags --name $ACR_NAME --repository myapp -o tsv
# Esperado: BUILD_ID e latest

az group delete --name rg-devops-lab --yes --no-wait
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Pipeline falha ao fazer push para ACR com "unauthorized"',
      difficulty: 'easy',
      symptom: 'O pipeline Azure DevOps falha com "Error response from daemon: unauthorized: authentication required" ao tentar fazer docker push para o ACR.',
      diagnosis: `\`\`\`bash
# Verificar se Service Connection existe e tem permissão
# Azure DevOps → Project Settings → Service connections

# Verificar se a identidade tem role AcrPush
az role assignment list \
  --assignee <service-principal-id> \
  --scope /subscriptions/.../resourceGroups/.../providers/Microsoft.ContainerRegistry/registries/myacr
\`\`\``,
      solution: `**Causas e soluções**:

1. **Service Connection sem permissão no ACR**:
\`\`\`bash
# Obter o Service Principal do Azure DevOps Service Connection
SP_ID=$(az ad sp list --display-name "Azure DevOps Service Connection" --query "[0].id" -o tsv)

# Dar role AcrPush
az role assignment create \
  --assignee $SP_ID \
  --role AcrPush \
  --scope /subscriptions/.../resourceGroups/myRG/providers/Microsoft.ContainerRegistry/registries/myacr
\`\`\`

2. **Task Docker@2 sem Service Connection configurada**: no pipeline YAML, verificar se containerRegistry aponta para o nome correto da Service Connection do tipo "Docker Registry".

3. **Admin credentials expiradas**: se usando admin-enabled, as credenciais podem ter sido rotacionadas. Verificar no portal ACR → Access keys.`
    }
  ]
};
