window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['az305-infrastructure/devops-solutions'] = {
  theory: `# DevOps Solutions Design on Azure (AZ-305)

## Exam Relevance
> Estimated weight **10-15%** in AZ-305. The exam evaluates the ability to design CI/CD pipelines, deployment strategies, and DevOps tool integration in Azure.

## Azure DevOps vs GitHub Actions — Design Decision

| Criterion | Azure DevOps | GitHub Actions |
|---------|-------------|---------------|
| Azure integration | Native and deep | Very good (Azure/actions marketplace) |
| Repository management | Azure Repos | GitHub |
| Complex pipelines (YAML) | Azure Pipelines | GitHub Actions workflows |
| Work tracking | Azure Boards | GitHub Projects |
| Enterprise compliance | Strong (Service Connections, Environments) | Good (Environments, OIDC) |
| Cost | Paid after first parallelism limits | Free for public, paid for private |
| Self-hosted runners | Agent pools | Self-hosted runners |

**General rule**: Azure DevOps for enterprises with historical investment in the platform; GitHub Actions for new teams or with open source code.

## Azure Pipelines — CI/CD Design

\`\`\`yaml
# azure-pipelines.yml — Multi-stage pipeline
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
    environment: staging     # Azure Pipelines Environment with approval gates
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
    environment: production   # Requires manual approval
    jobs:
      - deployment: DeployToProd
        strategy:
          canary:
            increments: [10, 50, 100]   # Automatic canary
            preDeploy:
              steps:
                - script: echo "Running pre-deploy checks"
\`\`\`

## Azure Container Registry (ACR) in the Pipeline

\`\`\`bash
# Create ACR with geo-replication
az acr create \
  --name myacr \
  --resource-group myRG \
  --sku Premium \
  --location eastus

# Geo-replication for DR
az acr replication create \
  --registry myacr --location westus

# Enable content trust (signed image)
az acr config content-trust update \
  --registry myacr --status enabled

# Integrated vulnerability scanning (Microsoft Defender for Containers)
az security container-registry-vulnerability-assessment-scan-result list \
  --registry myacr --resource-group myRG
\`\`\`

## Azure Deployment Environments

On-demand environments for developers:

\`\`\`bash
# Create Dev Center and Project
az devcenter admin devcenter create \
  --name mydevcenter --resource-group myRG

az devcenter admin project create \
  --dev-center mydevcenter \
  --name myproject \
  --resource-group myRG

# Dev can automatically create PR environment
# Pipeline: az devcenter dev environment create --project myproject --name pr-123
\`\`\`

## Pattern: GitOps with Azure Arc

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

## Common Design Mistakes

1. **No Environments in the pipeline**: without Azure Pipelines Environments, there is no manual approval gate before production.
2. **Secrets in code or pipeline variables**: use Azure Key Vault + Service Connection for secrets, not visible pipeline variables.
3. **Container image with :latest tag**: without a versioned tag, there is no way to roll back. Always use Build ID or Git SHA.
4. **ACR Basic for production**: no geo-replication and no native vulnerability scanning — use Premium.
5. **Pipeline without lint/test stage**: pushing directly to staging without unit tests.

## Killer.sh Style Challenge (AZ-305)

> A company needs: CI/CD for 50 microservices in AKS, image security scanning, manual approval before production, rollback in < 5 minutes, secrets managed centrally.
>
> **Answer**: Azure DevOps Pipelines multi-stage + Azure Container Registry Premium (automatic scanning via Defender). Environments with approval gates before production. Helm for deploy with version tags (Build.BuildId). Rollback: helm rollback. Azure Key Vault + Variable Groups in Azure DevOps for secrets. Azure Monitor alerts + automated rollback via webhook if error rate > threshold.
`,

  quiz: [
    {
      question: 'What is the correct mechanism for storing and consuming secrets (passwords, connection strings) in Azure DevOps pipelines?',
      options: [
        'Pipeline variables in plain text with "Secret" marked in the UI',
        'Azure Key Vault linked Variable Groups in Azure DevOps, which fetch secrets from Key Vault at runtime',
        'Hardcoded in the build agent environment variables',
        'Secrets in .env files in the Git repository encrypted'
      ],
      correct: 1,
      explanation: 'The correct approach is to create Variable Groups in Azure DevOps linked to Azure Key Vault — secrets are fetched from Key Vault at runtime, never stored in Azure DevOps. "Secret" variables in the Azure DevOps UI are masked in logs but still stored in Azure DevOps (not ideal). Never store secrets in Git, even encrypted.',
      reference: 'Common Mistakes section — Key Vault + Variable Groups is the enterprise standard for secrets in pipelines.'
    },
    {
      question: 'Why use versioned tags (e.g., Build.BuildId or Git SHA) on container images instead of :latest?',
      options: [
        ':latest is not supported by Azure Container Registry',
        'Versioned tags allow precise rollback to any previous version; :latest always overwrites the same tag, preventing rollback',
        'Numeric tags have better pull performance than :latest',
        'For ACR naming compliance reasons'
      ],
      correct: 1,
      explanation: 'The :latest tag is mutable — when you roll back to "previous latest", it no longer exists, it was overwritten. With immutable tags (Build.BuildId, Git SHA), each build has a unique identity. helm rollback returns exactly to version X that was deployed, because the image with that tag still exists in the ACR. Additionally, without versioned tags there is no traceability between commit and deploy.',
      reference: 'Common Mistakes section — always version images with a unique identifier (Build ID or Git SHA).'
    },
    {
      question: 'What are Azure Pipelines Environments and what is their main benefit?',
      options: [
        'Virtual environments to isolate builds on different machines',
        'Abstractions that allow configuring manual approvals, deploy history, and health checks before advancing in the pipeline for specific environments',
        'Separate Azure subscriptions for each environment (dev, staging, prod)',
        'Dedicated build agent pools per environment'
      ],
      correct: 1,
      explanation: 'Azure Pipelines Environments are representations of deployment environments (staging, production) that allow: (1) manual approvals before advancing, (2) complete deploy history with audit trail, (3) automatic checks (Azure Monitor query, smoke tests), (4) permissions on who can approve deploys for each environment. Essential for compliance and change control.',
      reference: 'Azure Pipelines section — Environments are the correct mechanism for approval gates, not just pipeline stages.'
    }
  ],

  flashcards: [
    {
      front: 'When to choose Azure DevOps vs GitHub Actions?',
      back: '**Azure DevOps** → when:\n- Enterprise with strict compliance (audit, managed Service Connections)\n- Team already uses Azure Boards, Azure Repos, Azure Test Plans\n- Complex pipelines with parallelism and dependencies\n- Deep integration with Azure Active Directory\n\n**GitHub Actions** → when:\n- Code on GitHub (public or private repository)\n- Team prefers configuration simplicity\n- Open source or modern DevX\n- Extensive marketplace with community actions\n\n**Both** support: runner autoscale, OIDC with Azure, multi-stage pipelines.'
    },
    {
      front: 'What is the correct pattern for CI/CD with containers in Azure?',
      back: '**Complete flow**:\n```\nGit push → Pipeline trigger\n  → Build: docker build → docker push ACR:$BUILD_ID\n  → Scan: Defender for Containers (automatic ACR scan)\n  → Deploy Staging: helm upgrade --set image.tag=$BUILD_ID\n  → Smoke tests + approval gate\n  → Deploy Prod: helm upgrade (same image.tag)\n  → Monitor: automatic rollback if error rate > threshold\n```\n\n**Principles**:\n1. Build once, deploy many (same image in all environments)\n2. Immutable tag per build\n3. Secrets via Key Vault, never hardcoded\n4. Rollback = helm rollback <revision>'
    }
  ],

  lab: {
    scenario: 'Configure a basic CI/CD pipeline for a containerized application using Azure Container Registry.',
    objective: 'Create an ACR, build a Docker image, and explore integration with Azure Pipelines.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create Azure Container Registry',
        instruction: 'Create a Standard ACR with login enabled for use in the pipeline.',
        hints: ['az acr create --sku Standard', '--admin-enabled true for login with username/password'],
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
# Expected: Standard, Succeeded
\`\`\``
      },
      {
        title: 'Build and push image simulating a pipeline',
        instruction: 'Use az acr build to build an image directly in ACR (without local Docker), as in a CI pipeline.',
        hints: ['az acr build = remote build in ACR without local Docker', '--image defines image name:tag'],
        solution: `\`\`\`bash
source /tmp/devopslab.sh

# Create simple Dockerfile
mkdir -p /tmp/devops-app
cat > /tmp/devops-app/Dockerfile << 'EOF'
FROM nginx:alpine
RUN echo "Build ID: BUILD_PLACEHOLDER" > /usr/share/nginx/html/version.txt
COPY . /usr/share/nginx/html/
EXPOSE 80
EOF

echo "Version 1.0.$(date +%s | tail -c 4)" > /tmp/devops-app/index.html

# Remote build in ACR (simulates pipeline without local Docker)
BUILD_ID=$(date +%s | tail -c 8)
az acr build \
  --registry $ACR_NAME \
  --image "myapp:$BUILD_ID" \
  --image "myapp:latest" \
  /tmp/devops-app/

echo "Image created: $ACR_NAME.azurecr.io/myapp:$BUILD_ID"
\`\`\``,
        verify: `\`\`\`bash
source /tmp/devopslab.sh
az acr repository list --name $ACR_NAME -o tsv
# Expected: myapp

az acr repository show-tags --name $ACR_NAME --repository myapp -o tsv
# Expected: BUILD_ID and latest

az group delete --name rg-devops-lab --yes --no-wait
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Pipeline fails to push to ACR with "unauthorized"',
      difficulty: 'easy',
      symptom: 'The Azure DevOps pipeline fails with "Error response from daemon: unauthorized: authentication required" when trying to docker push to the ACR.',
      diagnosis: `\`\`\`bash
# Check if Service Connection exists and has permission
# Azure DevOps → Project Settings → Service connections

# Check if the identity has the AcrPush role
az role assignment list \
  --assignee <service-principal-id> \
  --scope /subscriptions/.../resourceGroups/.../providers/Microsoft.ContainerRegistry/registries/myacr
\`\`\``,
      solution: `**Causes and solutions**:

1. **Service Connection without ACR permission**:
\`\`\`bash
# Get the Service Principal of the Azure DevOps Service Connection
SP_ID=$(az ad sp list --display-name "Azure DevOps Service Connection" --query "[0].id" -o tsv)

# Grant AcrPush role
az role assignment create \
  --assignee $SP_ID \
  --role AcrPush \
  --scope /subscriptions/.../resourceGroups/myRG/providers/Microsoft.ContainerRegistry/registries/myacr
\`\`\`

2. **Docker@2 task without Service Connection configured**: in the pipeline YAML, verify that containerRegistry points to the correct name of the Service Connection of type "Docker Registry".

3. **Admin credentials expired**: if using admin-enabled, credentials may have been rotated. Check in the portal ACR → Access keys.`
    }
  ]
};
