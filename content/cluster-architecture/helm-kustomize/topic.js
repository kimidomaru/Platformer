window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['cluster-architecture/helm-kustomize'] = {
  theory: `# Helm e Kustomize

## Helm - O Gerenciador de Pacotes do Kubernetes

O **Helm** e o gerenciador de pacotes oficial do Kubernetes. Ele permite instalar, atualizar e remover aplicacoes complexas usando **Charts** - pacotes pre-configurados de manifestos Kubernetes.

---

## Estrutura de um Chart Helm

\`\`\`
meu-app/
├── Chart.yaml          # Metadados do chart (nome, versao, descricao)
├── values.yaml         # Valores padrao configuráveis
├── templates/          # Templates dos manifestos Kubernetes
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── configmap.yaml
│   ├── _helpers.tpl    # Funcoes auxiliares (nao geram manifestos)
│   └── NOTES.txt       # Instrucoes exibidas apos instalacao
├── charts/             # Dependencias (sub-charts)
└── .helmignore         # Arquivos ignorados no pacote
\`\`\`

### Chart.yaml

\`\`\`yaml
apiVersion: v2
name: meu-app
description: Aplicacao de exemplo para Kubernetes
type: application
version: 1.2.0        # Versao do chart
appVersion: "2.4.1"   # Versao da aplicacao
dependencies:
- name: postgresql
  version: "12.1.0"
  repository: https://charts.bitnami.com/bitnami
  condition: postgresql.enabled
\`\`\`

### values.yaml

\`\`\`yaml
replicaCount: 2

image:
  repository: nginx
  tag: "1.25"
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 80

resources:
  limits:
    cpu: "500m"
    memory: "128Mi"
  requests:
    cpu: "100m"
    memory: "64Mi"

autoscaling:
  enabled: false
  minReplicas: 1
  maxReplicas: 10

ingress:
  enabled: false
  hosts:
  - host: app.example.com
    paths:
    - path: /
      pathType: Prefix
\`\`\`

### Template de Deployment

\`\`\`yaml
# templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "meu-app.fullname" . }}
  labels:
    {{- include "meu-app.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      {{- include "meu-app.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "meu-app.selectorLabels" . | nindent 8 }}
    spec:
      containers:
      - name: {{ .Chart.Name }}
        image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
        imagePullPolicy: {{ .Values.image.pullPolicy }}
        ports:
        - containerPort: 80
        resources:
          {{- toYaml .Values.resources | nindent 10 }}
\`\`\`

---

## Comandos Helm Essenciais

### Repositorios

\`\`\`bash
# Adicionar repositorio
helm repo add stable https://charts.helm.sh/stable
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx

# Atualizar repositorios
helm repo update

# Listar repositorios
helm repo list

# Buscar charts
helm search repo nginx
helm search repo bitnami/postgresql --versions
\`\`\`

### Instalacao e Gerenciamento

\`\`\`bash
# Instalar um chart
helm install meu-release bitnami/nginx

# Instalar em namespace especifico
helm install meu-release bitnami/nginx -n producao --create-namespace

# Instalar com valores customizados (arquivo)
helm install meu-release bitnami/nginx -f custom-values.yaml

# Instalar com valores inline
helm install meu-release bitnami/nginx \\
  --set replicaCount=3 \\
  --set image.tag=1.25 \\
  --set service.type=LoadBalancer

# Instalar versao especifica do chart
helm install meu-release bitnami/nginx --version 15.1.0

# Dry run (sem aplicar)
helm install meu-release bitnami/nginx --dry-run

# Gerar os manifestos sem instalar
helm template meu-release bitnami/nginx > output.yaml
helm template meu-release bitnami/nginx -f values.yaml

# Instalar ou atualizar (idempotente)
helm upgrade --install meu-release bitnami/nginx
\`\`\`

### Upgrade e Rollback

\`\`\`bash
# Atualizar um release
helm upgrade meu-release bitnami/nginx

# Upgrade com novos valores
helm upgrade meu-release bitnami/nginx \\
  --set replicaCount=5 \\
  --reuse-values  # manter valores anteriores nao especificados

# Ver historico de revisoes
helm history meu-release

# Rollback para revisao anterior
helm rollback meu-release

# Rollback para revisao especifica
helm rollback meu-release 2
\`\`\`

### Informacoes e Listagem

\`\`\`bash
# Listar releases instalados
helm list
helm list -n namespace
helm list --all-namespaces

# Ver status de um release
helm status meu-release

# Ver valores usados no release
helm get values meu-release

# Ver todos os valores (incluindo defaults)
helm get values meu-release --all

# Ver manifestos gerados
helm get manifest meu-release

# Ver notas do release
helm get notes meu-release

# Informacoes completas do chart
helm show chart bitnami/nginx
helm show values bitnami/nginx
\`\`\`

### Remocao

\`\`\`bash
# Desinstalar um release
helm uninstall meu-release

# Desinstalar mantendo o historico
helm uninstall meu-release --keep-history
\`\`\`

---

## Kustomize - Personalizacao sem Templates

O **Kustomize** e uma ferramenta integrada ao kubectl (desde v1.14) que permite personalizar manifestos Kubernetes sem usar templates. Ele usa **sobreposicoes (overlays)** para modificar configuracoes base.

---

## Estrutura do Kustomize

\`\`\`
k8s/
├── base/                   # Configuracao base compartilhada
│   ├── kustomization.yaml
│   ├── deployment.yaml
│   ├── service.yaml
│   └── configmap.yaml
└── overlays/               # Personalizacoes por ambiente
    ├── development/
    │   ├── kustomization.yaml
    │   └── patch-replicas.yaml
    ├── staging/
    │   ├── kustomization.yaml
    │   └── patch-resources.yaml
    └── production/
        ├── kustomization.yaml
        ├── patch-replicas.yaml
        └── patch-resources.yaml
\`\`\`

### kustomization.yaml (Base)

\`\`\`yaml
# base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- deployment.yaml
- service.yaml
- configmap.yaml

commonLabels:
  app: meu-app
  managed-by: kustomize

namespace: default
\`\`\`

### kustomization.yaml (Overlay de Producao)

\`\`\`yaml
# overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

bases:
- ../../base

namespace: production

namePrefix: prod-

replicas:
- name: meu-app
  count: 5

images:
- name: nginx
  newTag: "1.25-alpine"

patches:
- path: patch-resources.yaml

configMapGenerator:
- name: app-env-config
  literals:
  - ENV=production
  - LOG_LEVEL=warn
\`\`\`

### Patches Estrategicos

\`\`\`yaml
# overlays/production/patch-resources.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: meu-app
spec:
  template:
    spec:
      containers:
      - name: app
        resources:
          limits:
            cpu: "2"
            memory: "512Mi"
          requests:
            cpu: "500m"
            memory: "256Mi"
\`\`\`

### Patch JSON 6902

\`\`\`yaml
# overlays/development/patch-replicas.yaml
- op: replace
  path: /spec/replicas
  value: 1
\`\`\`

\`\`\`yaml
# kustomization.yaml referenciando o patch JSON
patches:
- path: patch-replicas.yaml
  target:
    group: apps
    version: v1
    kind: Deployment
    name: meu-app
\`\`\`

---

## Comandos Kustomize

\`\`\`bash
# Visualizar manifestos gerados (sem aplicar)
kubectl kustomize base/
kubectl kustomize overlays/production/

# Aplicar diretamente
kubectl apply -k base/
kubectl apply -k overlays/production/

# Deletar recursos criados com kustomize
kubectl delete -k overlays/production/

# Usando kustomize CLI diretamente
kustomize build overlays/production/ | kubectl apply -f -
kustomize build overlays/production/ > produced-manifests.yaml
\`\`\`

---

## Comparativo: Helm vs Kustomize

| Aspecto | Helm | Kustomize |
|---|---|---|
| Templating | Go templates | Nao usa templates |
| Curva de aprendizado | Media | Baixa |
| Versionamento | Versao do chart | Git nativo |
| Rollback | helm rollback | kubectl apply versao anterior |
| Casos de uso | Distribuir apps como pacotes | Personalizar manifestos existentes |
| Integrado ao kubectl | Nao (binario separado) | Sim (desde kubectl 1.14) |
| Repositorios | Helm Hub, OCI registries | Git, diretorio local |
\`\`\``,

  quiz: [
    {
      question: 'Qual comando instala ou atualiza um release Helm de forma idempotente (sem falhar se ja existir)?',
      options: [
        'helm install --force meu-release bitnami/nginx',
        'helm upgrade --install meu-release bitnami/nginx',
        'helm apply meu-release bitnami/nginx',
        'helm sync meu-release bitnami/nginx'
      ],
      correct: 1,
      explanation: '"helm upgrade --install" e o comando idempotente do Helm: instala o release se nao existir, ou atualiza se ja existir. E muito usado em pipelines de CI/CD onde o estado inicial pode variar.'
    },
    {
      question: 'Como visualizar os manifestos YAML que seriam gerados por um chart Helm SEM instala-los?',
      options: [
        'helm install meu-release bitnami/nginx --dry-run --debug',
        'helm preview meu-release bitnami/nginx',
        'helm template meu-release bitnami/nginx',
        'helm show meu-release bitnami/nginx --output=yaml'
      ],
      correct: 2,
      explanation: '"helm template" renderiza os templates do chart com os valores e exibe o YAML resultante sem instalar nada no cluster. "helm install --dry-run" tambem funciona mas exige conexao com o cluster. "helm template" pode ser executado offline.'
    },
    {
      question: 'Qual comando do kubectl aplica manifestos usando Kustomize?',
      options: [
        'kubectl apply --kustomize overlays/production/',
        'kubectl kustomize apply overlays/production/',
        'kubectl apply -k overlays/production/',
        'kustomize apply overlays/production/'
      ],
      correct: 2,
      explanation: '"kubectl apply -k <diretorio>" aplica os manifestos gerados pelo Kustomize a partir do kustomization.yaml no diretorio especificado. O flag -k e o atalho para --kustomize.'
    },
    {
      question: 'Para reverter um release Helm para a versao anterior, qual comando e usado?',
      options: [
        'helm revert meu-release',
        'helm undo meu-release',
        'helm rollback meu-release',
        'helm downgrade meu-release 1'
      ],
      correct: 2,
      explanation: '"helm rollback meu-release" reverte para a revisao anterior. Para uma revisao especifica use "helm rollback meu-release <numero-da-revisao>". O historico de revisoes pode ser consultado com "helm history meu-release".'
    },
    {
      question: 'Em um kustomization.yaml de overlay, como sobrescrever a tag de imagem de "nginx" para "1.25-alpine"?',
      options: [
        'imageTag:\n  nginx: 1.25-alpine',
        'images:\n- name: nginx\n  newTag: "1.25-alpine"',
        'overrides:\n  image:\n    tag: 1.25-alpine',
        'patches:\n- image: nginx:1.25-alpine'
      ],
      correct: 1,
      explanation: 'O campo "images" no kustomization.yaml permite sobrescrever tags e repositorios de imagens. Use "name" para identificar a imagem e "newTag" para a nova tag. Tambem e possivel usar "newName" para mudar o repositorio.'
    },
    {
      question: 'Qual arquivo em um Chart Helm define os valores padrao configuráveis?',
      options: [
        'Chart.yaml',
        'defaults.yaml',
        'config.yaml',
        'values.yaml'
      ],
      correct: 3,
      explanation: '"values.yaml" e o arquivo de valores padrao de um Chart Helm. Os usuarios podem sobrescrever esses valores com -f arquivo.yaml ou --set chave=valor durante helm install/upgrade. Os templates acessam os valores via .Values.chave.'
    },
    {
      question: 'Como visualizar os manifestos que o Kustomize geraria para um overlay SEM aplica-los ao cluster?',
      options: [
        'kubectl apply -k overlays/production/ --dry-run=client',
        'kubectl kustomize overlays/production/',
        'kustomize diff overlays/production/',
        'kubectl get -k overlays/production/'
      ],
      correct: 1,
      explanation: '"kubectl kustomize <diretorio>" (sem "apply") renderiza e exibe o YAML resultante do Kustomize sem aplicar ao cluster. Equivalente a "kustomize build <diretorio>". Use para inspecionar o resultado antes de aplicar.'
    }
  ],

  flashcards: [
    {
      front: 'Quais sao os arquivos essenciais de um Chart Helm?',
      back: 'Chart.yaml - metadados (nome, versao, descricao)\nvalues.yaml - valores padrao configuráveis\ntemplates/ - diretorio com os manifestos YAML com templates\ntemplates/_helpers.tpl - funcoes auxiliares reutilizaveis\ntemplates/NOTES.txt - mensagem exibida apos instalacao'
    },
    {
      front: 'Como instalar um chart Helm passando valores customizados?',
      back: '# Via arquivo de valores\nhelm install release-name chart-name -f custom-values.yaml\n\n# Via flags --set (sobrescreve valores especificos)\nhelm install release-name chart-name \\\n  --set replicaCount=3 \\\n  --set image.tag=1.25 \\\n  --set service.type=LoadBalancer'
    },
    {
      front: 'Como fazer rollback de um release Helm para a revisao 2?',
      back: '# Ver historico de revisoes\nhelm history meu-release\n\n# Rollback para revisao especifica\nhelm rollback meu-release 2\n\n# Rollback para a revisao anterior\nhelm rollback meu-release'
    },
    {
      front: 'O que e um overlay no Kustomize e como ele funciona?',
      back: 'Um overlay e uma camada de personalizacao sobre uma configuracao base. Ele referencia a base via "bases:" e adiciona/modifica recursos usando patches, replicas, images, configMapGenerator, etc.\n\nEstrutura:\nbase/ -> configuracao compartilhada\noverlays/dev/ -> personalizacoes para desenvolvimento\noverlays/prod/ -> personalizacoes para producao'
    },
    {
      front: 'Qual a diferenca entre helm template e helm install --dry-run?',
      back: 'helm template:\n- Renderiza os templates localmente\n- NAO conecta ao cluster\n- Pode ser usado offline\n- Output: YAML dos manifestos gerados\n\nhelm install --dry-run:\n- Conecta ao cluster (valida contra o servidor)\n- Simula a instalacao completa\n- Mais preciso (valida resources, CRDs)\n- Requer acesso ao cluster'
    },
    {
      front: 'Como adicionar um repositorio Helm e instalar um chart dele?',
      back: '# Adicionar repositorio\nhelm repo add bitnami https://charts.bitnami.com/bitnami\n\n# Atualizar lista de charts\nhelm repo update\n\n# Buscar charts\nhelm search repo bitnami/nginx\n\n# Instalar\nhelm install meu-nginx bitnami/nginx \\\n  --version 15.1.0 \\\n  -n meu-namespace \\\n  --create-namespace'
    },
    {
      front: 'Como o Kustomize modifica o numero de replicas de um Deployment?',
      back: 'No kustomization.yaml do overlay:\n\nreplicas:\n- name: nome-do-deployment\n  count: 5\n\nOu via patch estrategico (patch.yaml):\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: nome-do-deployment\nspec:\n  replicas: 5'
    },
    {
      front: 'Qual comando lista todos os releases Helm instalados em todos os namespaces?',
      back: 'helm list --all-namespaces\n# ou\nhelm list -A\n\n# Para um namespace especifico:\nhelm list -n meu-namespace\n\n# Ver tambem releases com falha:\nhelm list --all -A'
    }
  ],

  lab: {
    scenario: 'A empresa precisa implantar o nginx-ingress controller via Helm e depois configurar dois ambientes (development e production) usando Kustomize para uma aplicacao interna, com configuracoes diferentes de replicas e recursos para cada ambiente.',
    objective: 'Instalar e gerenciar um release Helm, e criar estrutura Kustomize com base e overlays para dois ambientes.',
    steps: [
      {
        title: 'Adicionar repositorio Helm e instalar o ingress-nginx',
        instruction: 'Adicione o repositorio do ingress-nginx ao Helm, atualize os repositorios, e instale o ingress-nginx no namespace "ingress-nginx" (criando o namespace automaticamente). Verifique o status da instalacao.',
        hints: [
          'helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx',
          'helm repo update para baixar a lista de charts',
          'Use --create-namespace para criar o namespace se nao existir',
          'helm status <release> para verificar apos instalacao'
        ],
        solution: '```bash\n# Adicionar repositorio\nhelm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx\nhelm repo update\n\n# Verificar charts disponiveis\nhelm search repo ingress-nginx\n\n# Instalar o ingress-nginx\nhelm install ingress-nginx ingress-nginx/ingress-nginx \\\n  --namespace ingress-nginx \\\n  --create-namespace \\\n  --set controller.replicaCount=2 \\\n  --set controller.service.type=NodePort\n\n# Verificar status\nhelm status ingress-nginx -n ingress-nginx\nkubectl get pods -n ingress-nginx\nkubectl get svc -n ingress-nginx\n```'
      },
      {
        title: 'Criar estrutura base do Kustomize',
        instruction: 'Crie a estrutura de diretorios base/overlays/development/production. Na base, crie os manifestos de um Deployment nginx e um Service, alem do kustomization.yaml referenciando ambos.',
        hints: [
          'mkdir -p k8s/base k8s/overlays/development k8s/overlays/production',
          'O kustomization.yaml da base lista os resources',
          'Use kubectl create deployment --dry-run=client -o yaml para gerar templates'
        ],
        solution: '```bash\n# Criar estrutura de diretorios\nmkdir -p /opt/kustomize-lab/base\nmkdir -p /opt/kustomize-lab/overlays/development\nmkdir -p /opt/kustomize-lab/overlays/production\n\n# Criar deployment base\ncat > /opt/kustomize-lab/base/deployment.yaml << \'EOF\'\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: webapp\nspec:\n  replicas: 1\n  selector:\n    matchLabels:\n      app: webapp\n  template:\n    metadata:\n      labels:\n        app: webapp\n    spec:\n      containers:\n      - name: webapp\n        image: nginx:1.25\n        ports:\n        - containerPort: 80\n        resources:\n          requests:\n            cpu: "100m"\n            memory: "64Mi"\n          limits:\n            cpu: "200m"\n            memory: "128Mi"\nEOF\n\n# Criar service base\ncat > /opt/kustomize-lab/base/service.yaml << \'EOF\'\napiVersion: v1\nkind: Service\nmetadata:\n  name: webapp\nspec:\n  selector:\n    app: webapp\n  ports:\n  - port: 80\n    targetPort: 80\n  type: ClusterIP\nEOF\n\n# Criar kustomization.yaml da base\ncat > /opt/kustomize-lab/base/kustomization.yaml << \'EOF\'\napiVersion: kustomize.config.k8s.io/v1beta1\nkind: Kustomization\n\nresources:\n- deployment.yaml\n- service.yaml\n\ncommonLabels:\n  app: webapp\n  managed-by: kustomize\nEOF\n\n# Verificar o YAML gerado pela base\nkubectl kustomize /opt/kustomize-lab/base/\n```'
      },
      {
        title: 'Criar overlay de development',
        instruction: 'Crie o overlay de development que use o namespace "development" e configure 1 replica. Aplique o overlay e verifique os recursos criados.',
        hints: [
          'O overlay referencia a base com "resources: - ../../base"',
          'Use "replicas:" para definir o numero de replicas',
          'kubectl create namespace development antes de aplicar',
          'kubectl apply -k aplica o overlay'
        ],
        solution: '```bash\n# Criar namespace\nkubectl create namespace development\n\n# Criar kustomization do overlay development\ncat > /opt/kustomize-lab/overlays/development/kustomization.yaml << \'EOF\'\napiVersion: kustomize.config.k8s.io/v1beta1\nkind: Kustomization\n\nresources:\n- ../../base\n\nnamespace: development\n\nnamePrefix: dev-\n\nreplicas:\n- name: webapp\n  count: 1\n\nimages:\n- name: nginx\n  newTag: "1.25-alpine"\n\nconfigMapGenerator:\n- name: webapp-config\n  literals:\n  - ENV=development\n  - LOG_LEVEL=debug\nEOF\n\n# Visualizar manifestos gerados\nkubectl kustomize /opt/kustomize-lab/overlays/development/\n\n# Aplicar o overlay\nkubectl apply -k /opt/kustomize-lab/overlays/development/\n\n# Verificar recursos criados\nkubectl get all -n development\nkubectl get configmap -n development\n```'
      },
      {
        title: 'Criar overlay de production e fazer upgrade do Helm',
        instruction: 'Crie o overlay de production com 3 replicas e recursos maiores. Aplique o overlay de production. Em seguida, faca upgrade do ingress-nginx para aumentar o numero de replicas do controller para 3 e verifique o historico de revisoes.',
        hints: [
          'O overlay de production tem mais replicas e resources maiores',
          'Use um patch estrategico para modificar os resources do container',
          'helm upgrade atualiza o release existente',
          'helm history mostra as revisoes anteriores'
        ],
        solution: '```bash\n# Criar namespace production\nkubectl create namespace production\n\n# Criar patch de resources para production\ncat > /opt/kustomize-lab/overlays/production/patch-resources.yaml << \'EOF\'\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: webapp\nspec:\n  template:\n    spec:\n      containers:\n      - name: webapp\n        resources:\n          requests:\n            cpu: "500m"\n            memory: "256Mi"\n          limits:\n            cpu: "1"\n            memory: "512Mi"\nEOF\n\n# Criar kustomization do overlay production\ncat > /opt/kustomize-lab/overlays/production/kustomization.yaml << \'EOF\'\napiVersion: kustomize.config.k8s.io/v1beta1\nkind: Kustomization\n\nresources:\n- ../../base\n\nnamespace: production\n\nnamePrefix: prod-\n\nreplicas:\n- name: webapp\n  count: 3\n\npatches:\n- path: patch-resources.yaml\n\nconfigMapGenerator:\n- name: webapp-config\n  literals:\n  - ENV=production\n  - LOG_LEVEL=warn\nEOF\n\n# Aplicar overlay production\nkubectl apply -k /opt/kustomize-lab/overlays/production/\nkubectl get all -n production\n\n# Upgrade do ingress-nginx via Helm\nhelm upgrade ingress-nginx ingress-nginx/ingress-nginx \\\n  --namespace ingress-nginx \\\n  --set controller.replicaCount=3 \\\n  --reuse-values\n\n# Ver historico de revisoes\nhelm history ingress-nginx -n ingress-nginx\n\n# Verificar pods atualizados\nkubectl get pods -n ingress-nginx\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'helm install falha com "cannot re-use a name that is still in use"',
      symptom: 'Ao executar "helm install", o comando falha com o erro: "Error: cannot re-use a name that is still in use". O release ja existe no cluster mas pode estar em estado de falha.',
      diagnosis: '```bash\n# 1. Verificar se o release existe\nhelm list -n <namespace>\nhelm list --all -n <namespace>  # inclui releases com falha\n\n# 2. Ver o status detalhado do release\nhelm status <release-name> -n <namespace>\n\n# 3. Ver historico de revisoes\nhelm history <release-name> -n <namespace>\n\n# 4. Verificar os pods do release\nkubectl get pods -n <namespace> -l app.kubernetes.io/instance=<release-name>\n\n# 5. Ver eventos do namespace\nkubectl get events -n <namespace> --sort-by=.lastTimestamp\n```',
      solution: '```bash\n# Opcao 1: Usar upgrade --install (idempotente)\nhelm upgrade --install <release-name> <chart> -n <namespace>\n\n# Opcao 2: Desinstalar e reinstalar\nhelm uninstall <release-name> -n <namespace>\nhelm install <release-name> <chart> -n <namespace>\n\n# Opcao 3: Se o release esta em estado FAILED, forccar rollback\nhelm rollback <release-name> 0 -n <namespace>  # Rollback para revisao 0 (remove)\n\n# Opcao 4: Para releases travados em estado de upgrade\nhelm upgrade <release-name> <chart> --force -n <namespace>\n\n# Verificar resultado\nhelm list -n <namespace>\nkubectl get all -n <namespace>\n```'
    },
    {
      title: 'kubectl apply -k falha com "no matches for kind Kustomization"',
      symptom: 'Ao executar "kubectl apply -k overlays/production/", o comando falha com: "error: no matches for kind Kustomization in group kustomize.config.k8s.io". Os manifestos nao sao aplicados.',
      diagnosis: '```bash\n# 1. Verificar versao do kubectl\nkubectl version --client\n# (Kustomize integrado desde kubectl 1.14)\n\n# 2. Verificar o kustomization.yaml\ncat overlays/production/kustomization.yaml\n\n# 3. Verificar se o apiVersion esta correto\ngrep apiVersion overlays/production/kustomization.yaml\n\n# 4. Tentar renderizar sem aplicar\nkubectl kustomize overlays/production/\n\n# 5. Verificar a estrutura de arquivos\nls -R overlays/production/\n```',
      solution: '```bash\n# Causa 1: apiVersion incorreto no kustomization.yaml\n# Deve ser:\n# apiVersion: kustomize.config.k8s.io/v1beta1\n# kind: Kustomization\n# (nao v1alpha1 ou versoes antigas)\n\n# Corrigir o kustomization.yaml\nhead -5 overlays/production/kustomization.yaml\n# Se estiver incorreto, editar:\n\n# Causa 2: Referencia a base incorreta\n# bases: foi depreciado em favor de resources:\n# Substituir:\n# bases:\n# - ../../base\n# Por:\n# resources:\n# - ../../base\n\n# Verificar apos correcao\nkubectl kustomize overlays/production/\n\n# Aplicar corretamente\nkubectl apply -k overlays/production/\n\n# Causa 3: Patch referencia recurso inexistente na base\n# Verificar se o nome no patch bate com o recurso na base\ngrep "name:" overlays/production/patch-resources.yaml\ngrep "name:" base/deployment.yaml\n```'
    }
  ]
};
