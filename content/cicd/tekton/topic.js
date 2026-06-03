window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['cicd/tekton'] = {
  theory: `
# Tekton: CI/CD Nativo em Kubernetes

## Relevancia
Tekton e o framework de CI/CD cloud-native mais adotado em ambientes Kubernetes enterprise. Diferente de GitHub Actions (SaaS externo), Tekton roda DENTRO do cluster — pipelines sao recursos Kubernetes (CRDs). E base de plataformas como OpenShift Pipelines, Jenkins X, e Shipwright.

## Arquitetura do Tekton

\`\`\`
Tekton Building Blocks:

Task         → unidade minima de trabalho (conjunto de steps)
Pipeline     → grafo de Tasks (com dependencias)
TaskRun      → execucao de uma Task
PipelineRun  → execucao de um Pipeline
Workspace    → volumes compartilhados entre Tasks
Trigger      → disparo automatico via webhook (TriggerTemplate + EventListener)
\`\`\`

### Como funciona na pratica

\`\`\`
Git Push
    ↓
EventListener (Pod) → intercepta webhook
    ↓
TriggerTemplate → cria PipelineRun
    ↓
Pipeline (clone → test → build → push → deploy)
    ↓
Tasks executam em Pods separados
    ↓
Workspaces compartilham dados entre Tasks
\`\`\`

## Conceitos Fundamentais

### Task — unidade de trabalho

\`\`\`yaml
apiVersion: tekton.dev/v1
kind: Task
metadata:
  name: run-tests
  namespace: tekton-pipelines
spec:
  params:
    - name: python-version
      type: string
      default: "3.11"
    - name: test-path
      type: string
      default: "tests/"

  workspaces:
    - name: source          # workspace de entrada
      description: Codigo fonte

  steps:
    - name: install-deps
      image: python:\$(params.python-version)-slim
      workingDir: /workspace/source
      script: |
        #!/bin/bash
        pip install -r requirements.txt -r requirements-dev.txt

    - name: run-tests
      image: python:\$(params.python-version)-slim
      workingDir: /workspace/source
      script: |
        #!/bin/bash
        pytest \$(params.test-path) -v --junitxml=test-results.xml
      env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: test-db-credentials
              key: url

  results:
    - name: test-count
      description: Numero de testes executados
\`\`\`

### Pipeline — orquestrando Tasks

\`\`\`yaml
apiVersion: tekton.dev/v1
kind: Pipeline
metadata:
  name: build-and-deploy
  namespace: tekton-pipelines
spec:
  params:
    - name: git-url
      type: string
    - name: git-revision
      type: string
      default: main
    - name: image-name
      type: string
    - name: environment
      type: string
      default: staging

  workspaces:
    - name: shared-data    # compartilhado entre todas as Tasks
    - name: docker-credentials
    - name: git-credentials

  tasks:
    # Task 1: Clone do repositorio
    - name: clone
      taskRef:
        name: git-clone
        kind: ClusterTask  # Task disponivel em todo o cluster
      workspaces:
        - name: output
          workspace: shared-data
        - name: ssh-directory
          workspace: git-credentials
      params:
        - name: url
          value: \$(params.git-url)
        - name: revision
          value: \$(params.git-revision)

    # Task 2: Testes (depende do clone)
    - name: test
      taskRef:
        name: run-tests
      runAfter:
        - clone
      workspaces:
        - name: source
          workspace: shared-data
      params:
        - name: python-version
          value: "3.11"

    # Task 3: Build Docker (depende dos testes)
    - name: build-image
      taskRef:
        name: kaniko          # build sem Docker daemon
        kind: ClusterTask
      runAfter:
        - test
      workspaces:
        - name: source
          workspace: shared-data
        - name: dockerconfig
          workspace: docker-credentials
      params:
        - name: IMAGE
          value: \$(params.image-name):\$(tasks.clone.results.commit)
        - name: CONTEXT
          value: .

    # Task 4: Deploy (depende do build)
    - name: deploy
      taskRef:
        name: kubernetes-actions
        kind: ClusterTask
      runAfter:
        - build-image
      params:
        - name: script
          value: |
            kubectl set image deployment/myapp \
              myapp=\$(params.image-name):\$(tasks.clone.results.commit) \
              -n \$(params.environment)
            kubectl rollout status deployment/myapp \
              -n \$(params.environment) \
              --timeout=5m

  # Finalizar — notificacao (roda sempre, mesmo em falha)
  finally:
    - name: notify
      taskRef:
        name: send-notification
      params:
        - name: status
          value: \$(tasks.status)
\`\`\`

### TaskRun — executar uma Task manualmente

\`\`\`yaml
apiVersion: tekton.dev/v1
kind: TaskRun
metadata:
  name: run-tests-manual
  namespace: tekton-pipelines
spec:
  taskRef:
    name: run-tests
  params:
    - name: python-version
      value: "3.11"
    - name: test-path
      value: "tests/unit/"
  workspaces:
    - name: source
      persistentVolumeClaim:
        claimName: my-pvc
\`\`\`

### PipelineRun — executar um Pipeline

\`\`\`yaml
apiVersion: tekton.dev/v1
kind: PipelineRun
metadata:
  name: build-deploy-run-001
  namespace: tekton-pipelines
spec:
  pipelineRef:
    name: build-and-deploy
  params:
    - name: git-url
      value: https://github.com/myorg/myapp.git
    - name: git-revision
      value: main
    - name: image-name
      value: ghcr.io/myorg/myapp
    - name: environment
      value: staging
  workspaces:
    - name: shared-data
      volumeClaimTemplate:          # PVC criado automaticamente para este run
        spec:
          accessModes: [ReadWriteOnce]
          resources:
            requests:
              storage: 1Gi
    - name: docker-credentials
      secret:
        secretName: docker-registry-credentials
    - name: git-credentials
      secret:
        secretName: git-ssh-credentials
\`\`\`

## Workspaces: Compartilhando Dados

\`\`\`yaml
# Tipos de workspace
workspaces:
  - name: data
    persistentVolumeClaim:
      claimName: my-pvc        # PVC existente

  - name: config
    configMap:
      name: app-config         # leitura de ConfigMap

  - name: credentials
    secret:
      secretName: my-secret    # montagem de Secret

  - name: temp
    emptyDir: {}               # diretorio temporario (sem persistencia)

  - name: optional-cache
    volumeClaimTemplate:       # PVC criado automaticamente por run
      spec:
        accessModes: [ReadWriteOnce]
        resources:
          requests:
            storage: 500Mi
\`\`\`

## Triggers: Automacao via Webhook

\`\`\`yaml
# EventListener — recebe webhooks do GitHub/GitLab
apiVersion: triggers.tekton.dev/v1beta1
kind: EventListener
metadata:
  name: github-webhook
  namespace: tekton-pipelines
spec:
  triggers:
    - name: github-push
      interceptors:
        - ref:
            name: github
          params:
            - name: secretRef
              value:
                secretName: github-webhook-secret
                secretKey: secret
            - name: eventTypes
              value: [push]
      bindings:
        - ref: github-push-binding
      template:
        ref: pipeline-run-template

---
# TriggerBinding — extrai dados do webhook payload
apiVersion: triggers.tekton.dev/v1beta1
kind: TriggerBinding
metadata:
  name: github-push-binding
spec:
  params:
    - name: git-url
      value: \$(body.repository.clone_url)
    - name: git-revision
      value: \$(body.head_commit.id)
    - name: git-branch
      value: \$(body.ref)

---
# TriggerTemplate — cria o PipelineRun
apiVersion: triggers.tekton.dev/v1beta1
kind: TriggerTemplate
metadata:
  name: pipeline-run-template
spec:
  params:
    - name: git-url
    - name: git-revision
    - name: git-branch
  resourcetemplates:
    - apiVersion: tekton.dev/v1
      kind: PipelineRun
      metadata:
        generateName: build-deploy-     # nome unico por run
      spec:
        pipelineRef:
          name: build-and-deploy
        params:
          - name: git-url
            value: \$(tt.params.git-url)
          - name: git-revision
            value: \$(tt.params.git-revision)
          - name: image-name
            value: ghcr.io/myorg/myapp
        workspaces:
          - name: shared-data
            volumeClaimTemplate:
              spec:
                accessModes: [ReadWriteOnce]
                resources:
                  requests:
                    storage: 1Gi
\`\`\`

## Comandos Essenciais (tkn CLI)

\`\`\`bash
# Instalar tkn CLI
curl -LO https://github.com/tektoncd/cli/releases/latest/download/tkn_Linux_x86_64.tar.gz
tar xvzf tkn_Linux_x86_64.tar.gz -C /usr/local/bin/ tkn

# Listar resources
tkn task list -n tekton-pipelines
tkn pipeline list -n tekton-pipelines
tkn pipelinerun list -n tekton-pipelines
tkn taskrun list -n tekton-pipelines

# Ver logs de execucao
tkn pipelinerun logs build-deploy-run-001 -f -n tekton-pipelines
tkn taskrun logs my-taskrun -f -n tekton-pipelines

# Executar task manualmente
tkn task start run-tests \
  -n tekton-pipelines \
  -p python-version=3.11 \
  -w name=source,claimName=my-pvc \
  --showlog

# Executar pipeline manualmente
tkn pipeline start build-and-deploy \
  -n tekton-pipelines \
  -p git-url=https://github.com/myorg/myapp.git \
  -p image-name=ghcr.io/myorg/myapp \
  -w name=shared-data,volumeClaimTemplateFile=workspace.yaml \
  --showlog

# Cancelar execucao
tkn pipelinerun cancel build-deploy-run-001 -n tekton-pipelines

# Descrever task/pipeline
tkn task describe run-tests -n tekton-pipelines
tkn pipeline describe build-and-deploy -n tekton-pipelines
\`\`\`

## Kaniko: Build sem Docker Daemon

\`\`\`yaml
# Kaniko builda imagens Docker dentro do Kubernetes
# sem precisar do Docker daemon (rootless, seguro)
apiVersion: tekton.dev/v1
kind: Task
metadata:
  name: build-push-kaniko
spec:
  params:
    - name: IMAGE
    - name: CONTEXT
      default: "."
    - name: DOCKERFILE
      default: "Dockerfile"

  workspaces:
    - name: source
    - name: dockerconfig
      description: Secret com credenciais do registry

  steps:
    - name: build-and-push
      image: gcr.io/kaniko-project/executor:latest
      args:
        - --dockerfile=/workspace/source/\$(params.DOCKERFILE)
        - --context=/workspace/source/\$(params.CONTEXT)
        - --destination=\$(params.IMAGE)
        - --cache=true
        - --cache-ttl=24h
      volumeMounts:
        - name: kaniko-secret
          mountPath: /kaniko/.docker
      env:
        - name: DOCKER_CONFIG
          value: /kaniko/.docker
\`\`\`

## Erros Comuns

1. **Tasks sem workspaces corretos** — Task espera workspace "source" mas PipelineRun passou "code"
2. **PVC com ReadWriteMany** — Tasks em nodes diferentes precisam de RWX se paralelas
3. **Permissao de ServiceAccount** — TaskRun precisa de RBAC para fazer kubectl no cluster
4. **Timeout** — TaskRun sem timeout pode travar indefinidamente; configurar \`timeout\`
5. **Results nao passados** — usar \$(tasks.TASK.results.RESULT) para encadear valores entre Tasks

## Killer.sh Style Challenge

> **Cenario:** Voce precisa criar um Pipeline Tekton para uma aplicacao Go que: (1) clona o repo com git-clone ClusterTask, (2) executa testes com go test, (3) builda imagem com Kaniko, (4) faz deploy com kubectl. As Tasks devem compartilhar o codigo via workspace. O Pipeline deve aceitar git-url, git-revision, e image-name como parametros.
`,
  quiz: [
    {
      question: 'Qual a diferenca entre Task e ClusterTask no Tekton?',
      options: [
        'ClusterTask executa mais rapido por ser clusterada',
        'Task e namespaced — disponivel apenas no namespace onde foi criada; ClusterTask e cluster-scoped — disponivel em qualquer namespace sem precisar ser replicada. Tasks reutilizaveis como git-clone, kaniko devem ser ClusterTasks',
        'ClusterTask so pode ser usada por admins de cluster',
        'A diferenca e apenas de versionamento — ClusterTask e imutavel'
      ],
      correct: 1,
      explanation: 'Task e um recurso Kubernetes namespaced — criada em "tekton-pipelines" namespace, so pode ser referenciada nesse namespace. ClusterTask (ou Task com kind: ClusterTask na referencia) e cluster-scoped, disponivel em todos os namespaces. O Tekton Hub fornece ClusterTasks comuns como git-clone, kaniko, kubectl, buildpacks — prontas para usar sem precisar criar do zero em cada namespace.',
      reference: 'Nota: ClusterTask esta sendo depreciado nas versoes mais recentes do Tekton em favor de Tasks com resolvers (Tekton Hub, Git, Bundle resolvers).'
    },
    {
      question: 'O que sao Workspaces no Tekton e por que sao necessarios?',
      options: [
        'Workspaces sao variaveis de ambiente compartilhadas',
        'Workspaces sao volumes montados em Tasks e Pipelines — permitem compartilhar arquivos entre steps de uma Task e entre Tasks diferentes de um Pipeline, ja que cada Task roda em um Pod separado com filesystem isolado',
        'Workspaces so sao necessarios para guardar secrets',
        'Workspaces substituem os params para passar dados entre Tasks'
      ],
      correct: 1,
      explanation: 'Cada Task no Tekton roda em um Pod Kubernetes separado. Sem workspaces, o codigo clonado em um Pod (git-clone Task) nao estaria disponivel para o Pod seguinte (testes). Workspaces mapeiam para volumes Kubernetes — PVCs, ConfigMaps, Secrets, ou emptyDir. Um workspace "shared-data" montado em todas as Tasks do Pipeline permite que o codigo flua do clone ate o deploy.',
      reference: 'Pratica: usar volumeClaimTemplate no PipelineRun cria um PVC automaticamente para cada run — sem precisar gerenciar PVCs manualmente.'
    },
    {
      question: 'Por que usar Kaniko para build de imagens em vez do Docker-in-Docker (DinD) no Kubernetes?',
      options: [
        'Kaniko e mais rapido que DinD',
        'Docker-in-Docker requer que o container rode com privilegios elevados (--privileged) — um risco de seguranca critico. Kaniko executa builds sem Docker daemon, usando apenas os arquivos do contexto, sem necessitar de privilegios de root no host',
        'Kaniko so funciona com repositorios publicos',
        'DinD nao funciona em Kubernetes, apenas em Docker Compose'
      ],
      correct: 1,
      explanation: 'Docker-in-Docker requer montar o socket do Docker (/var/run/docker.sock) ou rodar com --privileged — ambos permitem que um container escaping afete o host inteiro. Kaniko executa o Dockerfile diretamente, layer por layer, sem precisar do Docker daemon. Buildah e ko sao alternativas similares. Para producao em Kubernetes, nunca use DinD — use Kaniko, Buildah, ou builds baseados em Buildpacks.',
      reference: 'Alternativas ao Kaniko: Buildah (rootless, seguro), ko (para Go, sem Dockerfile), Buildpacks (heroku-style, sem Dockerfile).'
    },
    {
      question: 'Como funciona o mecanismo de Triggers no Tekton?',
      options: [
        'Triggers sao cronjobs que verificam o GitHub periodicamente',
        'EventListener recebe webhooks HTTP (do GitHub/GitLab/etc.), TriggerBinding extrai dados do payload (url, sha, branch), e TriggerTemplate usa esses dados para criar PipelineRuns automaticamente — pipeline como codigo disparado por eventos Git',
        'Triggers so funcionam com GitHub, nao com outros Git providers',
        'Triggers requerem configuracao no cluster Kubernetes do CI'
      ],
      correct: 1,
      explanation: 'O sistema de Triggers do Tekton e event-driven: EventListener e um Deployment que expoe um endpoint HTTP — voce configura o webhook no GitHub apontando para ele. Quando um push acontece, o EventListener recebe o payload, usa interceptors (validacao HMAC, CEL filters), passa para TriggerBinding que extrai campos do JSON, e TriggerTemplate usa esses campos para criar um PipelineRun com os parametros corretos.',
      reference: 'Expor EventListener: use Ingress ou Service LoadBalancer para que o GitHub consiga chamar o endpoint dentro do cluster.'
    },
    {
      question: 'Como passar o resultado de uma Task para outra Task no mesmo Pipeline?',
      options: [
        'E impossivel — Tasks sao completamente isoladas',
        'Usando Results: a Task produtora declara um result e escreve em /tekton/results/NOME. A Task consumidora referencia com \$(tasks.TASK-NAME.results.RESULT-NAME) nos seus params',
        'Usando variaveis de ambiente globais do Pipeline',
        'Usando um ConfigMap temporario criado pela Task produtora'
      ],
      correct: 1,
      explanation: 'Results no Tekton permitem que uma Task publique valores pequenos (ex: digest da imagem, versao, commit SHA) para uso por Tasks subsequentes. A Task escreve o valor em /tekton/results/nome-do-result e o Tekton armazena esse valor. Outras Tasks podem referenciar via \$(tasks.clone.results.commit). Importante: Results sao strings pequenas (max ~4KB) — para arquivos grandes, use workspaces.',
      reference: 'Exemplo comum: git-clone Task publica result "commit" (o SHA completo) e build Task usa para taguear a imagem.'
    },
    {
      question: 'Qual e a diferenca entre `runAfter` e dependencias implicitas via workspaces em um Pipeline?',
      options: [
        'runAfter e mais performatico que dependencias por workspace',
        'runAfter cria dependencia explicita de sequenciamento — "execute esta Task apenas apos aquelas". Dependencia via workspace ocorre quando Tasks compartilham o mesmo workspace com subpaths: o Tekton pode inferir a ordem. runAfter e mais claro e recomendado para dependencias de dados',
        'runAfter so funciona com Tasks, nao com pipelines aninhados',
        'Dependencias por workspace sao sempre paralelas'
      ],
      correct: 1,
      explanation: 'runAfter e a forma explicita e recomendada de sequenciar Tasks. Voce pode ter uma Task A que clona o codigo, Task B que testa (runAfter: A), e Task C que builda (runAfter: B). Sem runAfter, Tasks que nao tem dependencias rodam em paralelo — o que pode ser desejado (ex: testes unitarios e lint em paralelo) ou indesejado (build antes do clone).',
      reference: 'Tasks sem runAfter e sem dependencia de workspace rodam em paralelo — otimizacao automatica do Pipeline.'
    },
    {
      question: 'Como o Tekton difere do GitHub Actions em termos de arquitetura?',
      options: [
        'Tekton usa YAML igual ao GitHub Actions',
        'Tekton e cloud-native: pipelines sao CRDs Kubernetes, Tasks rodam em Pods no cluster, estado e persistido no etcd. GitHub Actions e SaaS externo onde runners executam fora do cluster. Tekton tem controle total de infraestrutura; Actions tem mais integracao nativa com GitHub',
        'Tekton e apenas uma versao self-hosted do GitHub Actions',
        'Tekton nao suporta triggers automaticos via webhook'
      ],
      correct: 1,
      explanation: 'A diferenca arquitetural e fundamental: GitHub Actions e um servico externo (os runners sao VMs temporarias fora do cluster). Tekton roda dentro do Kubernetes — cada Task e um Pod, pipelines sao CRDs, o estado fica no etcd. Isso da: controle total de seguranca (nenhum dado sai do cluster), integracao nativa com secrets/RBAC do K8s, e customizacao completa da infraestrutura de CI/CD.',
      reference: 'Quando usar Tekton: enterprise com requisitos de compliance, air-gapped environments, OpenShift, ou quando o pipeline precisa de acesso interno ao cluster sem expor credentials externamente.'
    }
  ],
  flashcards: [
    {
      front: 'Tekton — recursos fundamentais',
      back: '**Hierarquia:**\n```\nTask       → set de steps em um Pod\nPipeline   → grafo de Tasks\nTaskRun    → execucao de Task\nPipelineRun → execucao de Pipeline\nWorkspace  → volume compartilhado\nResult     → valor de saida de Task\nTrigger    → webhook → PipelineRun\n```\n\n**Cada Task = 1 Pod**\n- Steps = containers no Pod\n- Executam sequencialmente\n- Compartilham filesystem\n\n**Tasks diferentes = Pods diferentes**\n- Precisam de Workspace (PVC) para\n  compartilhar arquivos\n\n**Comandos tkn:**\n```bash\ntkn task list\ntkn pipeline list\ntkn pipelinerun logs -f\ntkn task start nome --showlog\n```'
    },
    {
      front: 'Task — estrutura completa',
      back: '```yaml\napiVersion: tekton.dev/v1\nkind: Task\nmetadata:\n  name: minha-task\nspec:\n  params:\n    - name: versao\n      type: string\n      default: "3.11"\n\n  workspaces:\n    - name: source  # volume montado em /workspace/source\n\n  steps:\n    - name: step1\n      image: python:\$(params.versao)-slim\n      workingDir: /workspace/source\n      script: |\n        #!/bin/bash\n        pip install -r requirements.txt\n\n    - name: step2\n      image: python:\$(params.versao)-slim\n      workingDir: /workspace/source\n      script: |\n        #!/bin/bash\n        pytest tests/ -v\n\n  results:\n    - name: test-count\n      description: Numero de testes\n```\n\n**Steps compartilham o mesmo Pod**\n**Executam sequencialmente**\n**Workspaces ficam em /workspace/NOME**'
    },
    {
      front: 'Pipeline — orquestrar Tasks',
      back: '```yaml\napiVersion: tekton.dev/v1\nkind: Pipeline\nmetadata:\n  name: ci-pipeline\nspec:\n  params:\n    - name: git-url\n    - name: image\n\n  workspaces:\n    - name: shared  # passado para Tasks\n\n  tasks:\n    - name: clone\n      taskRef:\n        name: git-clone\n        kind: ClusterTask\n      workspaces:\n        - name: output\n          workspace: shared\n      params:\n        - name: url\n          value: \$(params.git-url)\n\n    - name: test\n      taskRef: {name: run-tests}\n      runAfter: [clone]      # ← dependencia\n      workspaces:\n        - name: source\n          workspace: shared\n\n    - name: build\n      taskRef: {name: kaniko, kind: ClusterTask}\n      runAfter: [test]\n      workspaces:\n        - name: source\n          workspace: shared\n      params:\n        - name: IMAGE\n          value: \$(params.image):\$(tasks.clone.results.commit)\n```'
    },
    {
      front: 'Workspaces — tipos e uso',
      back: '**Tipos de workspace:**\n```yaml\n# PVC existente\n- name: data\n  persistentVolumeClaim:\n    claimName: my-pvc\n\n# PVC criado por run (mais comum)\n- name: source\n  volumeClaimTemplate:\n    spec:\n      accessModes: [ReadWriteOnce]\n      resources:\n        requests:\n          storage: 1Gi\n\n# Secret\n- name: docker-creds\n  secret:\n    secretName: registry-credentials\n\n# ConfigMap\n- name: config\n  configMap:\n    name: app-config\n\n# Temporario\n- name: temp\n  emptyDir: {}\n```\n\n**Regra de acesso paralelo:**\n- Tasks em nodes DIFERENTES = ReadWriteMany\n- Tasks no mesmo node = ReadWriteOnce OK\n- Para builds: 1 PVC por PipelineRun (volumeClaimTemplate)'
    },
    {
      front: 'Triggers — webhook para PipelineRun',
      back: '**Componentes:**\n```\nEventListener → Pod que recebe webhooks\n    ↓\nInterceptors → validacao HMAC, CEL filter\n    ↓\nTriggerBinding → extrai dados do payload\n    ↓\nTriggerTemplate → cria PipelineRun\n```\n\n**EventListener (resumido):**\n```yaml\napiVersion: triggers.tekton.dev/v1beta1\nkind: EventListener\nmetadata:\n  name: github\nspec:\n  triggers:\n    - name: push\n      interceptors:\n        - ref: {name: github}\n          params:\n            - name: secretRef\n              value: {secretName: webhook-secret, secretKey: secret}\n            - name: eventTypes\n              value: [push]\n      bindings:\n        - ref: github-binding\n      template:\n        ref: pipeline-template\n```\n\n**TriggerBinding extrai:**\n```yaml\nparams:\n  - name: git-url\n    value: \$(body.repository.clone_url)\n  - name: git-revision\n    value: \$(body.head_commit.id)\n```'
    },
    {
      front: 'Comandos tkn CLI essenciais',
      back: '**Listar:**\n```bash\ntkn task list -n NAMESPACE\ntkn pipeline list -n NAMESPACE\ntkn pipelinerun list -n NAMESPACE\ntkn taskrun list -n NAMESPACE\n```\n\n**Logs:**\n```bash\n# Follow logs de um PipelineRun\ntkn pipelinerun logs meu-run -f -n NS\n\n# Ver logs de task especifica\ntkn pipelinerun logs meu-run -t build-image -f\n```\n\n**Executar:**\n```bash\n# Task manual\ntkn task start minha-task \\\n  -p versao=3.11 \\\n  -w name=source,claimName=my-pvc \\\n  --showlog\n\n# Pipeline manual\ntkn pipeline start ci-pipeline \\\n  -p git-url=https://github.com/org/repo \\\n  -p image=ghcr.io/org/app \\\n  -w name=shared,emptyDir="" \\\n  --showlog\n```\n\n**Descrever:**\n```bash\ntkn task describe minha-task\ntkn pipeline describe ci-pipeline\ntkn pipelinerun describe meu-run\n```'
    }
  ],
  lab: {
    scenario: 'Voce vai instalar o Tekton em um cluster local (kind ou minikube), criar Tasks para clonar codigo e executar testes, montar um Pipeline que encadeia as Tasks, e executar manualmente usando o tkn CLI.',
    objective: 'Criar um Pipeline Tekton funcional com Tasks customizadas, workspaces, e execucao via tkn CLI.',
    duration: '35-45 minutos',
    steps: [
      {
        title: 'Instalar Tekton e criar namespace',
        instruction: `Instale o Tekton Pipelines em um cluster Kubernetes local e configure o namespace para o lab.`,
        hints: [
          'Use kind ou minikube para um cluster local',
          'Instale o Tekton via kubectl apply da release oficial',
          'Instale o tkn CLI para interagir com o Tekton'
        ],
        solution: `\`\`\`bash
# Opção 1: criar cluster com kind (se nao tiver)
kind create cluster --name tekton-lab

# Opção 2: usar minikube
# minikube start --memory=4096 --cpus=2

# Instalar Tekton Pipelines
kubectl apply -f https://storage.googleapis.com/tekton-releases/pipeline/latest/release.yaml

# Aguardar Tekton estar pronto
kubectl wait --for=condition=ready pod \
  -l app=tekton-pipelines-controller \
  -n tekton-pipelines \
  --timeout=300s

# Instalar tkn CLI (Linux)
curl -LO https://github.com/tektoncd/cli/releases/latest/download/tkn_Linux_x86_64.tar.gz
tar xvzf tkn_Linux_x86_64.tar.gz -C /tmp/ tkn
sudo mv /tmp/tkn /usr/local/bin/
# Mac: brew install tektoncd/tools/tektoncd-cli

# Verificar instalacao
tkn version

# Criar namespace para o lab
kubectl create namespace tekton-lab
kubectl config set-context --current --namespace=tekton-lab

# Criar ServiceAccount com permissoes
kubectl create serviceaccount tekton-sa -n tekton-lab
\`\`\``,
        verify: `\`\`\`bash
# Verificar pods do Tekton rodando
kubectl get pods -n tekton-pipelines
# Saida esperada: tekton-pipelines-controller e webhook rodando

# Verificar CRDs instalados
kubectl get crd | grep tekton
# Saida esperada: tasks.tekton.dev, pipelines.tekton.dev, etc.

# Verificar tkn CLI
tkn version
# Saida esperada: Client version: X.X.X

# Verificar namespace
kubectl get namespace tekton-lab
\`\`\``
      },
      {
        title: 'Criar Tasks para clone e teste',
        instruction: `Crie duas Tasks: uma para simular clone de repositorio e outra para executar testes Python. Use workspaces para compartilhar o codigo entre elas.`,
        hints: [
          'Use emptyDir workspace para o lab (mais simples que PVC)',
          'A Task de clone deve criar arquivos no workspace',
          'A Task de teste deve ler os arquivos do workspace'
        ],
        solution: `\`\`\`bash
# Task 1: Simular clone (cria arquivos no workspace)
cat > task-clone.yaml << 'EOF'
apiVersion: tekton.dev/v1
kind: Task
metadata:
  name: create-app
  namespace: tekton-lab
spec:
  params:
    - name: app-name
      type: string
      default: myapp

  workspaces:
    - name: output
      description: Workspace de saida com o codigo

  results:
    - name: app-version
      description: Versao da aplicacao criada

  steps:
    - name: create-files
      image: python:3.11-slim
      workingDir: /workspace/output
      script: |
        #!/bin/bash
        set -e

        # Criar app Flask simples
        cat > app.py << 'PYEOF'
        from flask import Flask, jsonify
        app = Flask(__name__)

        @app.route('/health')
        def health():
            return jsonify({"status": "ok", "version": "1.0.0"})

        @app.route('/')
        def index():
            return jsonify({"message": "Tekton CI works!"})

        if __name__ == '__main__':
            app.run(host='0.0.0.0', port=8080)
        PYEOF

        cat > requirements.txt << 'REQEOF'
        flask==3.0.0
        pytest==7.4.3
        REQEOF

        mkdir -p tests
        cat > tests/test_app.py << 'TESTEOF'
        import sys
        sys.path.insert(0, '.')
        from app import app
        import pytest

        @pytest.fixture
        def client():
            app.config['TESTING'] = True
            with app.test_client() as c:
                yield c

        def test_health(client):
            resp = client.get('/health')
            assert resp.status_code == 200
            assert resp.json['status'] == 'ok'

        def test_index(client):
            resp = client.get('/')
            assert resp.status_code == 200
        TESTEOF

        echo "Arquivos criados!"
        ls -la
        echo "1.0.0" | tee /tekton/results/app-version
EOF

# Aplicar Task
kubectl apply -f task-clone.yaml

# Task 2: Executar testes
cat > task-test.yaml << 'EOF'
apiVersion: tekton.dev/v1
kind: Task
metadata:
  name: run-python-tests
  namespace: tekton-lab
spec:
  params:
    - name: python-version
      type: string
      default: "3.11"

  workspaces:
    - name: source
      description: Codigo fonte da aplicacao

  results:
    - name: test-status
      description: Status dos testes (passed/failed)

  steps:
    - name: install
      image: python:\$(params.python-version)-slim
      workingDir: /workspace/source
      script: |
        #!/bin/bash
        pip install -r requirements.txt -q
        echo "Dependencias instaladas"

    - name: test
      image: python:\$(params.python-version)-slim
      workingDir: /workspace/source
      script: |
        #!/bin/bash
        set -e
        pytest tests/ -v --tb=short 2>&1 | tee /tmp/test-output.txt

        if grep -q "FAILED" /tmp/test-output.txt; then
          echo "failed" | tee /tekton/results/test-status
          exit 1
        else
          echo "passed" | tee /tekton/results/test-status
        fi
EOF

kubectl apply -f task-test.yaml

# Listar tasks criadas
tkn task list -n tekton-lab
\`\`\``,
        verify: `\`\`\`bash
# Verificar Tasks criadas
kubectl get tasks -n tekton-lab
# Saida esperada: create-app e run-python-tests

tkn task list -n tekton-lab

# Descrever Tasks
tkn task describe create-app -n tekton-lab
tkn task describe run-python-tests -n tekton-lab

# Testar Task de forma isolada
tkn task start create-app \
  -n tekton-lab \
  -p app-name=myapp \
  -w name=output,emptyDir="" \
  --showlog

# Verificar resultado
echo "Tasks criadas e testadas com sucesso!"
\`\`\``
      },
      {
        title: 'Criar Pipeline e executar com tkn',
        instruction: `Monte um Pipeline que encadeia as duas Tasks usando workspaces compartilhados, execute com o tkn CLI, e verifique os logs e resultados.`,
        hints: [
          'O Pipeline deve ter um workspace compartilhado passado para ambas as Tasks',
          'Use runAfter para garantir que run-python-tests so roda apos create-app',
          'Use \$(tasks.TASK.results.RESULT) para passar o resultado do clone para o teste'
        ],
        solution: `\`\`\`bash
# Criar Pipeline
cat > pipeline.yaml << 'EOF'
apiVersion: tekton.dev/v1
kind: Pipeline
metadata:
  name: python-ci
  namespace: tekton-lab
spec:
  params:
    - name: app-name
      type: string
      default: myapp
    - name: python-version
      type: string
      default: "3.11"

  workspaces:
    - name: shared-workspace
      description: Workspace compartilhado entre Tasks

  tasks:
    - name: setup-code
      taskRef:
        name: create-app
      workspaces:
        - name: output
          workspace: shared-workspace
      params:
        - name: app-name
          value: \$(params.app-name)

    - name: test
      taskRef:
        name: run-python-tests
      runAfter:
        - setup-code
      workspaces:
        - name: source
          workspace: shared-workspace
      params:
        - name: python-version
          value: \$(params.python-version)

  results:
    - name: app-version
      description: Versao da app
      value: \$(tasks.setup-code.results.app-version)
    - name: test-status
      description: Status dos testes
      value: \$(tasks.test.results.test-status)
EOF

kubectl apply -f pipeline.yaml

# Verificar Pipeline
tkn pipeline list -n tekton-lab
tkn pipeline describe python-ci -n tekton-lab

# Executar o Pipeline
echo "Executando Pipeline..."
tkn pipeline start python-ci \
  -n tekton-lab \
  -p app-name=meu-app \
  -p python-version=3.11 \
  -w name=shared-workspace,emptyDir="" \
  --showlog

# Verificar PipelineRuns
tkn pipelinerun list -n tekton-lab

# Ver logs do ultimo run
LAST_RUN=\$(tkn pipelinerun list -n tekton-lab -o name | head -1 | cut -d/ -f2)
echo "Ultimo PipelineRun: \$LAST_RUN"
tkn pipelinerun describe \$LAST_RUN -n tekton-lab
\`\`\``,
        verify: `\`\`\`bash
# Verificar Pipeline criado
kubectl get pipeline -n tekton-lab
# Saida esperada: python-ci

# Verificar PipelineRun(s)
tkn pipelinerun list -n tekton-lab
# Saida esperada: pelo menos 1 run com status Succeeded

# Verificar detalhes do ultimo run
LAST_RUN=\$(tkn pipelinerun list -n tekton-lab -o name 2>/dev/null | head -1 | cut -d/ -f2)
if [ -n "\$LAST_RUN" ]; then
  tkn pipelinerun describe \$LAST_RUN -n tekton-lab
  echo ""
  echo "Status do run: \$(kubectl get pipelinerun \$LAST_RUN -n tekton-lab -o jsonpath='{.status.conditions[0].reason}')"
fi

# Verificar pods criados durante o run
kubectl get pods -n tekton-lab | grep "\$LAST_RUN"

echo "Lab Tekton completo!"
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'TaskRun falha com "failed to create pod: pods is forbidden"',
      difficulty: 'medium',
      symptom: 'Ao criar um TaskRun, ele fica em estado "Failed" imediatamente. `kubectl describe taskrun` mostra "failed to create pod: pods is forbidden: User system:serviceaccount:tekton-lab:default cannot create resource pods".',
      diagnosis: `\`\`\`bash
# 1. Ver o erro do TaskRun
kubectl describe taskrun <nome> -n tekton-lab | tail -20

# 2. Verificar ServiceAccount usado
kubectl get taskrun <nome> -n tekton-lab -o jsonpath='{.spec.serviceAccountName}'
# Default: "default"

# 3. Verificar permissoes do SA
kubectl auth can-i create pods \
  --as=system:serviceaccount:tekton-lab:default \
  -n tekton-lab
# Esperado: yes (mas pode ser "no" = problema)

# 4. Ver RoleBindings existentes
kubectl get rolebindings -n tekton-lab
kubectl get clusterrolebindings | grep tekton
\`\`\``,
      solution: `**Causa:** ServiceAccount sem permissao para criar Pods

**Solucao — criar SA com RBAC:**
\`\`\`bash
# Criar ServiceAccount dedicado
kubectl create serviceaccount tekton-sa -n tekton-lab

# Dar permissao para criar Pods (e recursos Tekton)
kubectl create clusterrolebinding tekton-sa-binding \
  --clusterrole=edit \
  --serviceaccount=tekton-lab:tekton-sa

# OU Role especifico (mais seguro)
cat << 'EOF' | kubectl apply -f -
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: tekton-task-runner
  namespace: tekton-lab
rules:
  - apiGroups: [""]
    resources: [pods, pods/log]
    verbs: [get, list, create, delete, watch]
  - apiGroups: [tekton.dev]
    resources: ["*"]
    verbs: ["*"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: tekton-task-runner-binding
  namespace: tekton-lab
subjects:
  - kind: ServiceAccount
    name: tekton-sa
    namespace: tekton-lab
roleRef:
  kind: Role
  name: tekton-task-runner
  apiGroup: rbac.authorization.k8s.io
EOF
\`\`\`

**Especificar SA no TaskRun:**
\`\`\`yaml
spec:
  serviceAccountName: tekton-sa  # usar o SA correto
  taskRef:
    name: minha-task
\`\`\`

**Verificar:**
\`\`\`bash
kubectl auth can-i create pods \
  --as=system:serviceaccount:tekton-lab:tekton-sa \
  -n tekton-lab
# Esperado: yes
\`\`\``
    },
    {
      title: 'Task trava em Pending — workspace PVC nao encontrado',
      difficulty: 'easy',
      symptom: 'O TaskRun fica em estado "Pending" indefinidamente. `kubectl describe pod` gerado pelo TaskRun mostra "persistentvolumeclaim not found" ou "waiting for PVC to be bound".',
      diagnosis: `\`\`\`bash
# 1. Ver o Pod criado pelo TaskRun
kubectl get pods -n tekton-lab | grep taskrun

# 2. Descrever o Pod para ver o evento
POD=\$(kubectl get pods -n tekton-lab | grep taskrun | awk '{print \$1}')
kubectl describe pod \$POD -n tekton-lab | grep -A 10 "Events:"

# 3. Ver o estado do PVC
kubectl get pvc -n tekton-lab

# 4. Ver o TaskRun
kubectl describe taskrun <nome> -n tekton-lab
\`\`\``,
      solution: `**Causa 1 — PVC nao existe:**
\`\`\`bash
# Criar PVC antes de criar o TaskRun
cat << 'EOF' | kubectl apply -f -
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: tekton-workspace-pvc
  namespace: tekton-lab
spec:
  accessModes: [ReadWriteOnce]
  resources:
    requests:
      storage: 1Gi
EOF

# Verificar que o PVC foi criado e esta Bound
kubectl get pvc -n tekton-lab
# Status deve ser Bound (pode demorar alguns segundos)
\`\`\`

**Causa 2 — Usar emptyDir para testes (sem PVC):**
\`\`\`bash
# Para labs e testes, emptyDir e mais simples
tkn task start minha-task \
  -w name=source,emptyDir="" \    # usa emptyDir (sem PVC)
  --showlog
\`\`\`

**Causa 3 — volumeClaimTemplate com StorageClass incorreta:**
\`\`\`yaml
# Verificar StorageClass disponivel
# kubectl get storageclass

workspaces:
  - name: shared
    volumeClaimTemplate:
      spec:
        storageClassName: standard  # ou a StorageClass do seu cluster
        accessModes: [ReadWriteOnce]
        resources:
          requests:
            storage: 1Gi
\`\`\`

**Verificar:**
\`\`\`bash
kubectl get pvc -n tekton-lab
# Status deve ser Bound, nao Pending
\`\`\``
    }
  ]
};
