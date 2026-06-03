window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['app-deployment/helm'] = {
  theory: `# Helm: Gerenciador de Pacotes Kubernetes

## O que e o Helm?

Helm e o **gerenciador de pacotes oficial** para Kubernetes. Permite empacotar, distribuir, instalar e gerenciar aplicacoes Kubernetes complexas como uma unica unidade, de forma versionada e reproduzivel.

### Por que usar Helm?

Sem o Helm, gerenciar uma aplicacao com Deployment + Service + ConfigMap + Ingress + HPA significa manter e aplicar multiplos arquivos YAML manualmente. O Helm agrupa tudo em um **Chart**, permite parametrizar com **Values**, e rastreia o estado com **Releases**.

### Helm 3 vs Helm 2

| Aspecto | Helm 2 | Helm 3 |
|---|---|---|
| Componente servidor | Tiller (Pod no cluster) | Nenhum (direto na API) |
| Seguranca | Tiller tinha permissoes de cluster-admin | Usa RBAC do usuario |
| Armazenamento de estado | ConfigMaps no kube-system | Secrets no namespace da release |
| Suporte | Encerrado | Versao atual |
| CRD handling | Limitado | Suporte nativo a CRD hooks |

> O Helm 3 eliminou o Tiller. Todo acesso ao cluster usa as credenciais do usuario local.

### Conceitos Fundamentais

| Conceito | Definicao |
|---|---|
| **Chart** | Pacote Helm: colecao de arquivos que descrevem um conjunto de recursos K8s |
| **Release** | Instancia de um chart instalada no cluster. Um chart pode ter multiplas releases |
| **Repository** | Local onde charts sao armazenados e compartilhados (HTTP server com index.yaml) |
| **Values** | Configuracoes personalizaveis que sao injetadas nos templates do chart |
| **Revision** | Cada install/upgrade/rollback cria uma nova revisao numerada da release |

---

## Estrutura de um Chart

\`\`\`
minha-api/
├── Chart.yaml          # Metadados do chart (nome, versao, descricao, dependencias)
├── values.yaml         # Valores padrao (podem ser sobrescritos no install)
├── charts/             # Charts de dependencias (subcharts baixados com helm dep update)
├── templates/          # Templates Kubernetes com Go templating
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── configmap.yaml
│   ├── hpa.yaml
│   ├── serviceaccount.yaml
│   ├── _helpers.tpl    # Funcoes auxiliares reutilizaveis (nao gera recurso K8s)
│   ├── NOTES.txt       # Mensagem exibida apos helm install (instrucoes de uso)
│   └── tests/
│       └── test-connection.yaml  # Recursos com hook "helm.sh/hook: test"
└── .helmignore         # Arquivos ignorados no pacote (similar ao .gitignore)
\`\`\`

### Chart.yaml

\`\`\`yaml
apiVersion: v2             # versao da API do Helm (v2 para Helm 3)
name: minha-api
description: API principal da plataforma
type: application          # application (gera recursos) ou library (apenas helpers)
version: 1.2.0             # versao do CHART (segue SemVer) - incremente ao mudar o chart
appVersion: "2.0.0"        # versao da APLICACAO embalada no chart (informativo)
maintainers:
  - name: Time de Platform
    email: platform@empresa.com
keywords:
  - api
  - backend
home: https://github.com/empresa/minha-api
dependencies:
  - name: postgresql
    version: "13.x.x"
    repository: "https://charts.bitnami.com/bitnami"
    condition: postgresql.enabled   # Condicional: so instala se habilitado
  - name: redis
    version: "18.x.x"
    repository: "https://charts.bitnami.com/bitnami"
    condition: redis.enabled
    tags:
      - cache                        # Tags permitem habilitar/desabilitar grupos
\`\`\`

### values.yaml

\`\`\`yaml
# Valores padrao do chart
replicaCount: 2

image:
  repository: minha-registry.io/minha-api
  tag: "2.0.0"
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 80
  targetPort: 8080

ingress:
  enabled: false
  className: nginx
  host: api.empresa.com
  tls:
    enabled: false
    secretName: api-tls

resources:
  requests:
    cpu: "200m"
    memory: "256Mi"
  limits:
    cpu: "500m"
    memory: "512Mi"

autoscaling:
  enabled: false
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 80

serviceAccount:
  create: true
  name: ""
  annotations: {}

podAnnotations: {}
podSecurityContext: {}

nodeSelector: {}
tolerations: []
affinity: {}

postgresql:
  enabled: true
  auth:
    password: ""     # Deve ser sobrescrito no install via --set ou Secret externo

redis:
  enabled: false
\`\`\`

### Template Exemplo (deployment.yaml)

\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "minha-api.fullname" . }}
  labels:
    {{- include "minha-api.labels" . | nindent 4 }}
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  selector:
    matchLabels:
      {{- include "minha-api.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      annotations:
        {{- with .Values.podAnnotations }}
        {{- toYaml . | nindent 8 }}
        {{- end }}
      labels:
        {{- include "minha-api.selectorLabels" . | nindent 8 }}
    spec:
      {{- with .Values.podSecurityContext }}
      securityContext:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      serviceAccountName: {{ include "minha-api.serviceAccountName" . }}
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: {{ .Values.service.targetPort }}
              protocol: TCP
          livenessProbe:
            httpGet:
              path: /healthz
              port: http
          readinessProbe:
            httpGet:
              path: /ready
              port: http
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
          {{- if .Values.ingress.enabled }}
          env:
            - name: PUBLIC_URL
              value: "https://{{ .Values.ingress.host }}"
          {{- end }}
      {{- with .Values.nodeSelector }}
      nodeSelector:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.tolerations }}
      tolerations:
        {{- toYaml . | nindent 8 }}
      {{- end }}
\`\`\`

### _helpers.tpl (Named Templates)

\`\`\`yaml
{{/*
Expand the name of the chart.
*/}}
{{- define "minha-api.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "minha-api.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{/*
Common labels aplicadas a todos os recursos
*/}}
{{- define "minha-api.labels" -}}
helm.sh/chart: {{ include "minha-api.chart" . }}
{{ include "minha-api.selectorLabels" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels - usadas em selectors de Deployments e Services
*/}}
{{- define "minha-api.selectorLabels" -}}
app.kubernetes.io/name: {{ include "minha-api.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
\`\`\`

---

## Template Functions e Pipelines

Helm usa o sistema de templates do Go com funcoes adicionais da biblioteca Sprig.

\`\`\`yaml
# Acesso a Values, Release, Chart, Files, Capabilities
{{ .Values.replicaCount }}          # valor do values.yaml
{{ .Release.Name }}                  # nome da release
{{ .Release.Namespace }}             # namespace da release
{{ .Chart.Name }}                    # nome do chart
{{ .Chart.Version }}                 # versao do chart
{{ .Capabilities.KubeVersion.Minor }} # versao do K8s

# Funcoes de string
{{ .Values.name | upper }}           # MINHA-API
{{ .Values.name | lower }}           # minha-api
{{ .Values.name | title }}           # Minha-Api
{{ .Values.name | trunc 63 }}        # limita a 63 caracteres (limite DNS)
{{ .Values.name | trimSuffix "-" }}  # remove sufixo

# Funcoes de default e condicional
{{ .Values.image.tag | default .Chart.AppVersion }}   # usa appVersion se tag vazia
{{ .Values.replicas | default 1 }}                     # default numerico
{{ if .Values.ingress.enabled }} ... {{ end }}          # condicional

# Funcoes de YAML
{{- toYaml .Values.resources | nindent 12 }}  # converte mapa para YAML indentado
{{- with .Values.tolerations }}               # bloco condicional (falso se nil/vazio)
  {{- toYaml . | nindent 8 }}
{{- end }}

# Loops
{{- range .Values.env }}
- name: {{ .name }}
  value: {{ .value | quote }}
{{- end }}

# Pipelines (esquerda para direita)
{{ .Values.name | lower | trunc 63 | trimSuffix "-" }}
\`\`\`

---

## Comandos Essenciais

### Gerenciamento de Repositorios

\`\`\`bash
# Adicionar repositorio oficial do Bitnami
helm repo add bitnami https://charts.bitnami.com/bitnami

# Adicionar repositorio do Ingress NGINX
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx

# Adicionar repositorio do Cert-Manager
helm repo add jetstack https://charts.jetstack.io

# Listar repositorios configurados
helm repo list

# Atualizar index de todos os repositorios (equivalente a apt update)
helm repo update

# Remover repositorio
helm repo remove bitnami
\`\`\`

### Busca e Inspecao

\`\`\`bash
# Buscar chart nos repos configurados
helm search repo nginx
helm search repo bitnami/postgresql --versions   # lista todas as versoes

# Buscar no Artifact Hub (hub.helm.sh) - requer conexao
helm search hub wordpress

# Ver os valores padrao de um chart
helm show values bitnami/postgresql
helm show values bitnami/postgresql --version 13.0.0

# Ver toda a documentacao do chart
helm show all bitnami/postgresql

# Ver metadados do chart
helm show chart bitnami/postgresql

# Ver apenas o README
helm show readme bitnami/postgresql
\`\`\`

### Install, Upgrade e Rollback

\`\`\`bash
# Instalar um chart (cria uma release chamada "meu-postgres")
helm install meu-postgres bitnami/postgresql \
  --namespace banco \
  --create-namespace \
  --set auth.postgresPassword=senha-segura \
  --set primary.persistence.size=20Gi

# Instalar versao especifica do chart
helm install meu-postgres bitnami/postgresql \
  --version 13.2.0 \
  --namespace banco

# Instalar com arquivo de values customizado
helm install minha-api ./minha-api \
  --namespace producao \
  -f values-producao.yaml

# Upgrade: atualiza uma release existente
helm upgrade meu-postgres bitnami/postgresql \
  --namespace banco \
  --set auth.postgresPassword=nova-senha \
  --reuse-values    # Preserva os valores nao especificados da release anterior

# Install or Upgrade (idempotente) - padrao para CI/CD
helm upgrade --install minha-api ./minha-api \
  --namespace producao \
  --create-namespace \
  -f values-producao.yaml \
  --atomic \        # Rollback automatico se o upgrade falhar
  --timeout 5m

# Rollback para revisao anterior
helm rollback meu-postgres --namespace banco

# Rollback para revisao especifica
helm rollback meu-postgres 3 --namespace banco

# Desinstalar release (remove todos os recursos K8s da release)
helm uninstall meu-postgres --namespace banco

# Manter historico apos uninstall (permite rollback posterior)
helm uninstall meu-postgres --namespace banco --keep-history
\`\`\`

### Inspecionar Releases

\`\`\`bash
# Listar todas as releases no namespace atual
helm list
helm list --namespace banco
helm list --all-namespaces        # todas as releases em todos os namespaces
helm list -A                      # abreviacao de --all-namespaces

# Listar com status detalhado (incluindo falhas e releases desinstaladas)
helm list --all

# Ver historico de revisoes de uma release
helm history meu-postgres --namespace banco

# Ver os valores customizados de uma release instalada
helm get values minha-api --namespace producao

# Ver os valores efetivos (customizados + defaults)
helm get values minha-api --namespace producao --all

# Ver todos os recursos gerados por uma release
helm get manifest minha-api --namespace producao

# Ver notas de instalacao
helm get notes minha-api --namespace producao

# Ver todos os detalhes de uma release
helm get all minha-api --namespace producao
\`\`\`

### Renderizacao e Debug

\`\`\`bash
# Renderizar templates localmente SEM instalar (debug de templates)
helm template minha-release ./minha-api -f values-producao.yaml

# Renderizar e salvar em arquivo para revisao
helm template minha-release ./minha-api \
  -f values-producao.yaml \
  --output-dir ./rendered-manifests

# Instalar com dry-run no servidor (valida contra o API server)
helm install minha-api ./minha-api \
  --dry-run \
  --debug \
  -f values-producao.yaml

# Lint: verificar boas praticas no chart
helm lint ./minha-api

# Lint com values especificos
helm lint ./minha-api -f values-producao.yaml

# Empacotar chart em arquivo .tgz
helm package ./minha-api

# Empacotar com assinatura
helm package ./minha-api --sign --key 'email@empresa.com'

# Criar novo chart com estrutura padrao
helm create minha-api
\`\`\`

---

## Sobrescrita de Values

### Precedencia (menor para maior)

1. Valores padrao do \`values.yaml\` do chart
2. Valores de charts pai (parent chart) no campo \`subchart:\`
3. Arquivo(s) \`-f\` especificados na ordem que aparecem
4. Flags \`--set\`, \`--set-string\`, \`--set-json\` (maior precedencia)

\`\`\`bash
# Multiplos arquivos de values (o ultimo tem maior precedencia sobre anteriores)
helm install app ./chart \
  -f values-base.yaml \
  -f values-producao.yaml \
  --set image.tag=v2.0.0 \
  --set replicaCount=5

# --set aceita estruturas aninhadas com "."
helm install app ./chart \
  --set image.repository=meu-registry.io/app \
  --set image.tag=latest \
  --set resources.limits.memory=512Mi

# --set-string forca interpretacao como string (evita conversao automatica)
# Sem --set-string, "1.0" seria convertido para numero 1
helm install app ./chart --set-string image.tag=1.0

# --set-json permite passar JSON complexo (arrays, objetos)
helm install app ./chart \
  --set-json 'tolerations=[{"key":"gpu","operator":"Exists","effect":"NoSchedule"}]'

# --set-file: le o valor de um arquivo
helm install app ./chart --set-file config.content=./config.json
\`\`\`

---

## Gerenciamento de Dependencias

\`\`\`bash
# Atualizar e baixar dependencias definidas no Chart.yaml
helm dependency update ./minha-api
# Cria: charts/postgresql-13.x.x.tgz e Chart.lock

# Verificar dependencias
helm dependency list ./minha-api

# Construir dependencias a partir do Chart.lock (reproducivel)
helm dependency build ./minha-api
\`\`\`

\`\`\`yaml
# Chart.yaml com dependencias condicionais
dependencies:
  - name: postgresql
    version: "13.x.x"
    repository: "https://charts.bitnami.com/bitnami"
    condition: postgresql.enabled    # controla via values: postgresql.enabled: true/false

# values.yaml para controlar dependencias
postgresql:
  enabled: true          # instala o subchart postgresql
  auth:
    postgresqlPassword: ""
\`\`\`

---

## Hooks do Helm

Hooks permitem executar acoes em pontos especificos do ciclo de vida da release:

\`\`\`yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: migration-job
  annotations:
    # Hook que roda ANTES da instalacao/upgrade
    "helm.sh/hook": pre-upgrade,pre-install
    # Peso para ordenar multiplos hooks (menor roda primeiro)
    "helm.sh/hook-weight": "-5"
    # O que fazer com o recurso apos o hook completar
    "helm.sh/hook-delete-policy": hook-succeeded
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: migration
          image: minha-api:v2.0.0
          command: ["python", "manage.py", "migrate"]
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
\`\`\`

| Hook | Quando executa |
|---|---|
| \`pre-install\` | Antes de qualquer recurso ser criado |
| \`post-install\` | Apos todos os recursos serem criados |
| \`pre-upgrade\` | Antes de um upgrade |
| \`post-upgrade\` | Apos um upgrade completar |
| \`pre-rollback\` | Antes de um rollback |
| \`post-rollback\` | Apos um rollback completar |
| \`pre-delete\` | Antes de um uninstall |
| \`post-delete\` | Apos um uninstall completar |
| \`test\` | Executado via \`helm test\` |

### hook-delete-policy

| Politica | Comportamento |
|---|---|
| \`hook-succeeded\` | Deleta o recurso somente se o hook completou com sucesso |
| \`hook-failed\` | Deleta o recurso somente se o hook falhou |
| \`before-hook-creation\` | Deleta o recurso existente antes de criar um novo (padrao) |

---

## Helm Test

\`\`\`yaml
# templates/tests/test-connection.yaml
apiVersion: v1
kind: Pod
metadata:
  name: "{{ include "minha-api.fullname" . }}-test-connection"
  annotations:
    "helm.sh/hook": test
    "helm.sh/hook-delete-policy": hook-succeeded
spec:
  restartPolicy: Never
  containers:
    - name: wget
      image: busybox
      command: ['wget']
      args: ['{{ include "minha-api.fullname" . }}:{{ .Values.service.port }}']
\`\`\`

\`\`\`bash
# Executar testes de uma release
helm test minha-api --namespace producao

# Executar e ver logs detalhados
helm test minha-api --namespace producao --logs
\`\`\`
`,

  quiz: [
    {
      question: 'Qual a diferenca entre a versao "version" e "appVersion" no Chart.yaml?',
      options: [
        'Sao a mesma coisa, aliases um do outro',
        '"version" e a versao do Chart (pacote Helm); "appVersion" e a versao da aplicacao embalada',
        '"appVersion" e a versao minima do Kubernetes necessaria',
        '"version" e para producao; "appVersion" e para desenvolvimento'
      ],
      correct: 1,
      explanation: '"version" segue SemVer e representa a versao do pacote Helm em si (chart). Quando voce adiciona uma nova feature ao chart sem mudar a aplicacao, incrementa "version". "appVersion" e informativo e representa a versao da aplicacao contida no chart. Sao independentes: um chart version: 3.0.0 pode empacotar appVersion: "1.2.3".'
    },
    {
      question: 'Qual comando e recomendado para um pipeline CI/CD que deve instalar OU atualizar uma release (idempotente)?',
      options: [
        'helm install --force',
        'helm upgrade --install',
        'helm apply',
        'helm sync'
      ],
      correct: 1,
      explanation: '"helm upgrade --install" e idempotente: instala a release se nao existir, ou faz upgrade se ja existir. Ideal para pipelines CI/CD onde nao se sabe o estado atual do cluster. "helm install" falha se a release ja existir. "--force" e diferente: forca a recriacao de recursos, o que pode causar downtime.'
    },
    {
      question: 'Qual a precedencia correta dos valores no Helm (do menor para o maior)?',
      options: [
        '--set > -f arquivo > values.yaml do chart',
        '-f arquivo > --set > values.yaml do chart',
        'values.yaml do chart > -f arquivo > --set',
        'Todos tem a mesma precedencia, o ultimo declarado vence'
      ],
      correct: 2,
      explanation: 'A precedencia no Helm e: values.yaml do chart (menor) -> -f arquivo(s) em ordem de declaracao -> --set e variantes (maior). Isso significa que --set sempre sobrescreve -f, que sempre sobrescreve o values.yaml do chart. Quando multiplos -f sao usados, o ultimo arquivo tem maior precedencia sobre os anteriores.'
    },
    {
      question: 'O que o comando "helm template" faz de diferente em relacao a "helm install --dry-run"?',
      options: [
        'helm template instala no cluster; --dry-run apenas renderiza',
        'helm template renderiza localmente SEM contato com o cluster; --dry-run envia para o API server para validacao',
        'Sao identicos em comportamento',
        'helm template e mais lento pois valida CRDs'
      ],
      correct: 1,
      explanation: '"helm template" renderiza os templates Go do chart substituindo os valores e exibe o YAML resultante no stdout, sem qualquer contato com o cluster. "helm install --dry-run" envia a requisicao ao API server do cluster para validacao (inclui validacao de schema, webhooks), mas nao persiste os recursos. Use "helm template" para inspecao rapida offline; use "--dry-run" para validacao completa antes de prod.'
    },
    {
      question: 'Qual o arquivo dentro de "templates/" do Helm que contem funcoes auxiliares e NAO gera recursos Kubernetes?',
      options: [
        'values.yaml',
        'NOTES.txt',
        '_helpers.tpl',
        'Chart.yaml'
      ],
      correct: 2,
      explanation: 'Arquivos que comecam com "_" dentro de "templates/" sao tratados como arquivos de suporte e NAO geram recursos Kubernetes. "_helpers.tpl" e a convencao para definir named templates (funcoes) reutilizaveis em outros templates via "{{ include "nome.funcao" . }}". NOTES.txt exibe mensagem apos install mas tambem nao cria recursos K8s. values.yaml e Chart.yaml ficam na raiz do chart, nao em templates/.'
    },
    {
      question: 'O que o hook "helm.sh/hook-delete-policy: hook-succeeded" faz?',
      options: [
        'Deleta toda a release se o hook falhar',
        'Exclui o recurso do hook (ex: Job) automaticamente apos o hook completar com sucesso',
        'Impede que o hook seja deletado mesmo se falhar',
        'Deleta recursos da release anterior antes do upgrade'
      ],
      correct: 1,
      explanation: 'hook-delete-policy define quando o recurso do hook e deletado apos execucao. "hook-succeeded": deleta apenas se o hook completou com sucesso. "hook-failed": deleta apenas se falhou. "before-hook-creation": deleta o recurso de hook anterior antes de criar um novo (padrao quando a politica nao e definida). Sem essa anotacao, recursos de hook permanecem no cluster apos execucao.'
    },
    {
      question: 'Qual a diferenca entre "helm get values" e "helm show values"?',
      options: [
        'Sao identicos',
        '"helm get values" mostra os valores de uma RELEASE instalada no cluster; "helm show values" mostra os valores PADRAO de um chart (nao instalado)',
        '"helm show values" e apenas para charts locais; "helm get values" e para repos',
        '"helm get values" requer admin; "helm show values" e para todos os usuarios'
      ],
      correct: 1,
      explanation: '"helm get values <release>" consulta o cluster e retorna os valores customizados que foram usados para instalar/atualizar uma release existente (os que foram passados via -f ou --set). "helm show values <chart>" mostra os valores PADRAO definidos no values.yaml do chart (sem necessidade de instalacao). Adicionar "--all" ao get values mostra tambem os defaults mesclados.'
    },
    {
      question: 'O que diferencia Helm 3 de Helm 2 em termos de arquitetura?',
      options: [
        'Helm 3 requer Docker; Helm 2 nao',
        'Helm 3 eliminou o Tiller (servidor no cluster); o estado e armazenado como Secrets no namespace da release',
        'Helm 2 usa OCI registries; Helm 3 usa apenas HTTP',
        'Helm 3 nao suporta rollback; Helm 2 sim'
      ],
      correct: 1,
      explanation: 'A maior mudanca do Helm 3 foi a remocao do Tiller, o componente servidor que rodava como Pod no cluster com permissoes de cluster-admin. No Helm 3, o cliente usa diretamente as credenciais do usuario local via kubeconfig para acessar a API do Kubernetes. O estado das releases e armazenado como Secrets no namespace da propria release (nao mais no kube-system).'
    },
    {
      question: 'Como o campo "condition" em uma dependencia do Chart.yaml funciona?',
      options: [
        'Define uma condicao de saude antes de instalar o chart pai',
        'Permite habilitar ou desabilitar a instalacao do subchart com base em um valor do values.yaml',
        'Define a ordem de instalacao entre subcharts',
        'Valida se o subchart e compativel com a versao do Kubernetes'
      ],
      correct: 1,
      explanation: 'O campo "condition" em uma dependencia aponta para um caminho no values.yaml (ex: postgresql.enabled). Se o valor for "true", o subchart e instalado; se "false", e ignorado. Isso permite charts configurados com multiplos subcharts opcionais que o usuario ativa ou desativa conforme a necessidade. Exemplo: condition: postgresql.enabled com values: postgresql: enabled: false omite o PostgreSQL da instalacao.'
    },
    {
      question: 'Qual e o proposito do arquivo "charts/" dentro de um Chart Helm?',
      options: [
        'Contem os templates renderizados antes do install',
        'Armazena os subcharts (dependencias) em formato .tgz apos "helm dependency update"',
        'Contem os valores customizados por ambiente',
        'E o diretorio de cache do Helm CLI'
      ],
      correct: 1,
      explanation: 'O diretorio "charts/" e onde o Helm armazena os subcharts (dependencias) baixados pelo comando "helm dependency update". Cada dependencia definida no Chart.yaml e baixada como arquivo .tgz nesse diretorio. O arquivo Chart.lock registra as versoes exatas baixadas para reproducibilidade. O diretorio charts/ deve ser incluido no .gitignore e gerado no CI via "helm dependency build".'
    }
  ],

  flashcards: [
    {
      front: 'Quais sao os 4 conceitos fundamentais do Helm?',
      back: 'Chart: pacote Helm contendo templates e valores padrao para um conjunto de recursos K8s. Release: instancia de um chart instalada em um cluster (um chart pode ter multiplas releases em namespaces diferentes). Repository: servidor HTTP com index de charts disponivel para download. Values: configuracoes que personalizam um chart na instalacao (sobrescrevem os defaults do values.yaml).'
    },
    {
      front: 'Como instalar um chart com valores customizados de forma idempotente?',
      back: 'helm upgrade --install <nome-release> <chart> --namespace <ns> --create-namespace -f values-custom.yaml --set chave=valor. O --install garante que se a release nao existir ela sera criada. --create-namespace cria o namespace se nao existir. Para pipelines CI/CD, sempre usar upgrade --install em vez de install separado para garantir idempotencia. Adicionar --atomic para rollback automatico em caso de falha.'
    },
    {
      front: 'Qual a precedencia dos valores no Helm do menor ao maior?',
      back: '1. values.yaml do chart (menor precedencia - defaults). 2. -f arquivo(s) na ordem que aparecem (cada arquivo sobrescreve os anteriores). 3. --set, --set-string, --set-json (maior precedencia). Regra pratica: --set sempre ganha. Use -f para configuracoes de ambiente (dev/staging/prod). Use --set para overrides pontuais e segredos em CI/CD.'
    },
    {
      front: 'O que sao Helm Hooks e para que servem?',
      back: 'Hooks sao recursos Kubernetes anotados com "helm.sh/hook" que executam em pontos especificos do ciclo de vida da release. Tipos comuns: pre-install/post-install, pre-upgrade/post-upgrade, pre-delete. Uso tipico: Jobs de migration de banco (pre-upgrade), testes de smoke (post-install), limpeza de dados (pre-delete). Controlados por: hook-weight (ordem) e hook-delete-policy (limpeza apos execucao).'
    },
    {
      front: 'Como debugar um chart Helm antes de instalar no cluster?',
      back: 'helm template <release> <chart> -f values.yaml: renderiza templates localmente, exibe YAML resultante, sem contato com cluster. helm install --dry-run --debug <release> <chart>: valida no servidor (contato com API server), mostra templates e informacoes de debug. helm lint <chart>: verifica boas praticas e erros de sintaxe. Use template para inspecao rapida offline, dry-run para validacao completa antes de prod.'
    },
    {
      front: 'Como ver o historico de revisoes e fazer rollback de uma release?',
      back: 'Ver historico: helm history <release> -n <namespace>. Rollback para anterior: helm rollback <release> -n <namespace>. Rollback para revisao especifica: helm rollback <release> 3 -n <namespace>. Ver valores de uma revisao: helm get values <release> --revision=2. Cada upgrade/rollback cria uma nova revisao. O rollback e tratado como uma nova revisao (nao apaga historico).'
    },
    {
      front: 'Para que serve o arquivo _helpers.tpl em um chart Helm?',
      back: 'Arquivos com prefixo "_" em templates/ sao arquivos de suporte que NAO geram recursos K8s. _helpers.tpl e a convencao para definir named templates (funcoes Go template) reutilizaveis. Exemplo: {{ define "myapp.fullname" }} - define funcao. {{ include "myapp.fullname" . }} - chama a funcao. Usado para: nome completo do recurso, labels padrao, selectorLabels. helm create gera automaticamente um _helpers.tpl com funcoes comuns.'
    },
    {
      front: 'Qual a diferenca entre Helm 2 e Helm 3?',
      back: 'Helm 2 exigia o Tiller: um Pod rodando no namespace kube-system com permissoes de cluster-admin, representando um risco de seguranca. Helm 3 eliminou o Tiller: o CLI comunica diretamente com o API server usando as credenciais do usuario local (kubeconfig). O estado das releases e armazenado como Secrets no namespace da release (nao mais em ConfigMaps no kube-system).'
    },
    {
      front: 'Como gerenciar dependencias em um chart Helm?',
      back: 'Definir dependencias no Chart.yaml com name, version, repository e opcionalmente condition (para habilitar/desabilitar). Comandos: helm dependency update ./chart (baixa dependencias para charts/) cria Chart.lock. helm dependency build ./chart (usa Chart.lock para reproducibilidade). helm dependency list ./chart (lista dependencias e status). O diretorio charts/ deve ser incluido no .gitignore.'
    },
    {
      front: 'O que e "helm test" e como configurar testes em um chart?',
      back: 'helm test executa Pods marcados com a anotacao helm.sh/hook: test. Tipicamente sao Pods de curta duracao que verificam conectividade ou funcionalidade basica apos o install. Configurar: criar templates/tests/test-connection.yaml com annotation helm.sh/hook: test e restartPolicy: Never. Executar: helm test <release> -n <namespace>. Para ver logs: helm test <release> --logs. Util para smoke tests pos-deploy.'
    },
    {
      front: 'Quais sao os tipos de chart no Chart.yaml e quando usar cada um?',
      back: 'type: application (padrao): chart que gera recursos Kubernetes diretamente. Usado para a maioria dos charts que instalam aplicacoes. type: library: chart que nao gera recursos proprios, apenas define named templates (funcoes) para serem reutilizados por outros charts como dependencia. Charts do tipo library nao podem ser instalados diretamente com helm install.'
    }
  ],

  lab: {
    scenario: 'A equipe precisa instalar e gerenciar o NGINX Ingress Controller usando Helm, depois criar e deployar um chart customizado para uma aplicacao interna, com diferentes configuracoes para ambientes de staging e producao, incluindo hooks de pre-upgrade para simulacao de migracao.',
    objective: 'Gerenciar repositorios Helm, instalar charts de repositorios publicos, criar um chart customizado com hooks, e gerenciar releases com diferentes valores por ambiente incluindo upgrade e rollback.',
    steps: [
      {
        title: 'Configurar repositorios e instalar chart do repositorio',
        instruction: `Adicione o repositorio do Ingress NGINX, atualize os indices, inspecione o chart antes de instalar, e instale o ingress-nginx no namespace ingress-nginx com configuracoes customizadas para um ambiente de laboratorio (sem LoadBalancer externo).`,
        hints: [
          'Use helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx',
          'helm show values ingress-nginx/ingress-nginx | head -100 para ver opcoes',
          'Use --set controller.service.type=NodePort para ambientes sem LoadBalancer',
          'helm list -n ingress-nginx confirma a instalacao'
        ],
        solution: `\`\`\`bash
# Adicionar repositorio
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx

# Atualizar cache de repositorios
helm repo update

# Verificar repositorios configurados
helm repo list

# Buscar o chart e ver versoes disponiveis
helm search repo ingress-nginx --versions | head -10

# Inspecionar valores padrao (primeiras linhas)
helm show values ingress-nginx/ingress-nginx | head -80

# Instalar com NodePort para ambiente de lab (sem cloud LoadBalancer)
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \\
  --namespace ingress-nginx \\
  --create-namespace \\
  --set controller.service.type=NodePort \\
  --set controller.service.nodePorts.http=30080 \\
  --set controller.service.nodePorts.https=30443 \\
  --set controller.replicaCount=1 \\
  --atomic \\
  --timeout 5m

# Verificar instalacao
helm list -n ingress-nginx
kubectl get pods -n ingress-nginx
kubectl get service -n ingress-nginx

# Ver historico da release (deve ter revisao 1)
helm history ingress-nginx -n ingress-nginx

# Ver notas de instalacao
helm get notes ingress-nginx -n ingress-nginx
\`\`\``
      },
      {
        title: 'Criar chart customizado para aplicacao interna',
        instruction: `Crie um chart Helm para uma API simples, modifique o values.yaml com configuracoes realistas, crie arquivos de values para staging e producao com replicas e recursos diferentes, e adicione um hook de pre-upgrade para simular migration de banco de dados.`,
        hints: [
          'helm create minha-api gera a estrutura completa',
          'Edite values.yaml para definir valores padrao sensatos',
          'Crie values-staging.yaml e values-prod.yaml com diferencas de replicas/resources',
          'Adicione o hook em templates/hooks/pre-upgrade-migration.yaml'
        ],
        solution: `\`\`\`bash
# Criar estrutura do chart
helm create minha-api

# Verificar estrutura criada
ls -la minha-api/
ls -la minha-api/templates/
\`\`\`

\`\`\`yaml
# minha-api/values.yaml (substituir o gerado)
replicaCount: 1

image:
  repository: nginx
  pullPolicy: IfNotPresent
  tag: "1.25-alpine"

service:
  type: ClusterIP
  port: 80

ingress:
  enabled: false
  className: nginx
  host: api.empresa.com

resources:
  requests:
    cpu: "100m"
    memory: "128Mi"
  limits:
    cpu: "200m"
    memory: "256Mi"

autoscaling:
  enabled: false
  minReplicas: 1
  maxReplicas: 5
  targetCPUUtilizationPercentage: 80

migration:
  enabled: true
  image: busybox
\`\`\`

\`\`\`yaml
# minha-api/templates/hooks/pre-upgrade-migration.yaml
{{- if .Values.migration.enabled }}
apiVersion: batch/v1
kind: Job
metadata:
  name: {{ include "minha-api.fullname" . }}-migration
  annotations:
    "helm.sh/hook": pre-upgrade,pre-install
    "helm.sh/hook-weight": "-5"
    "helm.sh/hook-delete-policy": hook-succeeded
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: migration
          image: {{ .Values.migration.image }}
          command: ["sh", "-c", "echo 'Running DB migration...' && sleep 2 && echo 'Migration done'"]
          resources:
            requests:
              cpu: "50m"
              memory: "64Mi"
{{- end }}
\`\`\`

\`\`\`yaml
# values-staging.yaml
replicaCount: 2
image:
  tag: "1.25-alpine"
ingress:
  enabled: true
  host: api-staging.empresa.com
resources:
  requests:
    cpu: "100m"
    memory: "128Mi"
  limits:
    cpu: "200m"
    memory: "256Mi"
\`\`\`

\`\`\`yaml
# values-prod.yaml
replicaCount: 5
image:
  tag: "1.25-alpine"
ingress:
  enabled: true
  host: api.empresa.com
resources:
  requests:
    cpu: "500m"
    memory: "512Mi"
  limits:
    cpu: "1000m"
    memory: "1Gi"
autoscaling:
  enabled: true
  minReplicas: 5
  maxReplicas: 20
\`\`\`

\`\`\`bash
# Validar o chart
helm lint ./minha-api
helm lint ./minha-api -f values-staging.yaml
helm lint ./minha-api -f values-prod.yaml

# Renderizar templates para staging (inspecao sem instalar)
helm template minha-api-staging ./minha-api -f values-staging.yaml

# Dry-run para validar no servidor
helm install minha-api-staging ./minha-api \\
  --namespace staging \\
  --create-namespace \\
  -f values-staging.yaml \\
  --dry-run --debug 2>&1 | head -60
\`\`\``
      },
      {
        title: 'Instalar, fazer upgrade e rollback da release',
        instruction: `Instale o chart customizado em staging, faca um upgrade com nova tag de imagem, verifique o historico e execute um rollback para revisao anterior. Em seguida, instale em producao com values de producao.`,
        hints: [
          'helm upgrade --install e idempotente: instala ou atualiza',
          'helm history <release> -n <namespace> mostra todas as revisoes',
          'helm rollback <release> <numero-revisao> -n <namespace>',
          'helm get values <release> -n <namespace> mostra valores da release atual'
        ],
        solution: `\`\`\`bash
# Instalar em staging
helm upgrade --install minha-api-staging ./minha-api \\
  --namespace staging \\
  --create-namespace \\
  -f values-staging.yaml

# Verificar release instalada
helm list -n staging
kubectl get all -n staging

# Ver valores efetivos da release
helm get values minha-api-staging -n staging

# Simular upgrade para nova versao (com regressao intencional)
helm upgrade minha-api-staging ./minha-api \\
  --namespace staging \\
  -f values-staging.yaml \\
  --set image.tag=1.24-alpine

# Ver historico de revisoes (deve ter revisao 1 e 2)
helm history minha-api-staging -n staging

# Ver os valores da revisao 1 (antes do upgrade)
helm get values minha-api-staging -n staging --revision=1

# Rollback para a revisao 1
helm rollback minha-api-staging 1 -n staging

# Verificar que voltou para a versao correta
helm history minha-api-staging -n staging
kubectl get deployment -n staging -o jsonpath='{.items[0].spec.template.spec.containers[0].image}'
echo ""

# Instalar em producao com values de prod
helm upgrade --install minha-api-prod ./minha-api \\
  --namespace producao \\
  --create-namespace \\
  -f values-prod.yaml

# Comparar releases em diferentes namespaces
helm list --all-namespaces | grep minha-api

# Ver manifests gerados pela release em producao
helm get manifest minha-api-prod -n producao | grep -A3 "kind: Deployment"
\`\`\``
      },
      {
        title: 'Gerenciar dependencias e empacotar o chart',
        instruction: `Adicione uma dependencia de redis ao chart (condicional), atualize as dependencias, configure o values.yaml para controlar a dependencia, renderize o output final e empacote o chart em arquivo .tgz para distribuicao.`,
        hints: [
          'Adicione a dependencia redis no Chart.yaml com condition: redis.enabled',
          'helm dependency update ./minha-api baixa as dependencias',
          'No values.yaml, adicione redis: enabled: false como default',
          'helm package ./minha-api cria o arquivo .tgz'
        ],
        solution: `\`\`\`yaml
# minha-api/Chart.yaml - adicionar dependencia
apiVersion: v2
name: minha-api
description: API principal da plataforma
type: application
version: 1.3.0
appVersion: "2.0.0"
dependencies:
  - name: redis
    version: "18.x.x"
    repository: "https://charts.bitnami.com/bitnami"
    condition: redis.enabled
\`\`\`

\`\`\`yaml
# Adicionar ao values.yaml
redis:
  enabled: false
  auth:
    enabled: false
\`\`\`

\`\`\`bash
# Adicionar repositorio bitnami se ainda nao tiver
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# Baixar dependencias
helm dependency update ./minha-api

# Verificar dependencias baixadas
helm dependency list ./minha-api
ls -la minha-api/charts/

# Renderizar sem redis (default)
helm template test ./minha-api | grep -i redis || echo "Redis desabilitado"

# Renderizar com redis habilitado
helm template test ./minha-api --set redis.enabled=true | grep -i redis

# Lint final do chart
helm lint ./minha-api

# Empacotar chart em arquivo .tgz
helm package ./minha-api

# Verificar o arquivo gerado
ls -la minha-api-*.tgz

# Inspecionar o pacote sem instalar
helm show chart ./minha-api-1.3.0.tgz
helm show values ./minha-api-1.3.0.tgz

# Instalar direto do .tgz (simula instalacao a partir de repositorio)
helm upgrade --install minha-api-from-pkg ./minha-api-1.3.0.tgz \\
  --namespace test-pkg \\
  --create-namespace \\
  --dry-run
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'helm upgrade falha com "UPGRADE FAILED: cannot patch"',
      symptom: 'Ao executar helm upgrade, o comando falha com erro: "UPGRADE FAILED: cannot patch [recurso]: [tipo de erro]". A release fica em status "failed" e o kubectl get pods pode mostrar Pods em estados inconsistentes.',
      diagnosis: `**Passo 1: Ver o status atual da release**
\`\`\`bash
helm list -n <namespace>
# Status "failed" indica que o upgrade falhou

helm history <release> -n <namespace>
# Ver qual revisao esta ativa e o historico de falhas
\`\`\`

**Passo 2: Ver o erro detalhado**
\`\`\`bash
helm upgrade <release> <chart> -f values.yaml --debug 2>&1 | tail -50
# O --debug mostra o erro completo incluindo o diff tentado
\`\`\`

**Passo 3: Identificar o tipo de erro**
\`\`\`bash
# Erro comum: campo imutavel foi alterado (ex: selector de um Deployment)
# "cannot patch Deployment: field is immutable"
kubectl get deployment <nome> -n <namespace> -o yaml | grep -A5 selector

# Erro de validacao de schema
# "ValidationError: spec.template.spec.containers[0].resources..."
\`\`\`

**Passo 4: Verificar estado dos recursos no cluster**
\`\`\`bash
kubectl get all -n <namespace>
kubectl describe deployment <nome> -n <namespace>
\`\`\``,
      solution: `**Causa: Campo imutavel alterado (ex: labels do selector)**
\`\`\`bash
# Deletar o recurso imutavel e deixar o Helm recriar
kubectl delete deployment <nome> -n <namespace>

# Repetir o upgrade (Helm vai recriar o recurso)
helm upgrade <release> <chart> -f values.yaml -n <namespace>
\`\`\`

**Causa: Release em estado "failed" bloqueando upgrades**
\`\`\`bash
# Rollback para a ultima revisao boa
helm rollback <release> -n <namespace>

# Verificar que voltou ao status "deployed"
helm list -n <namespace>

# Tentar o upgrade novamente apos corrigir o problema
helm upgrade <release> <chart> -f values-corrigido.yaml -n <namespace>
\`\`\`

**Causa: Conflito com recurso existente nao gerenciado pelo Helm**
\`\`\`bash
# Adotar recurso existente pelo Helm (cuidado em producao)
helm upgrade <release> <chart> -f values.yaml \\
  --force \\
  -n <namespace>

# Alternativa mais segura: anotar o recurso para adocao
kubectl annotate deployment <nome> -n <namespace> \\
  meta.helm.sh/release-name=<release> \\
  meta.helm.sh/release-namespace=<namespace>
kubectl label deployment <nome> -n <namespace> \\
  app.kubernetes.io/managed-by=Helm

helm upgrade <release> <chart> -f values.yaml -n <namespace>
\`\`\`

**Verificar e limpar releases em estado inconsistente:**
\`\`\`bash
# Ver releases em todos os estados
helm list --all -n <namespace>

# Se necessario, desinstalar e reinstalar (ultima opcao)
helm uninstall <release> -n <namespace>
helm upgrade --install <release> <chart> -f values.yaml -n <namespace>
\`\`\``
    },
    {
      title: 'helm install falha com "cannot re-use a name that is still in use"',
      symptom: 'Ao executar "helm install <release> <chart>", o comando falha com: "Error: cannot re-use a name that is still in use". Ocorre quando a release ja existe no cluster (mesmo em estado de falha).',
      diagnosis: `**Passo 1: Verificar se a release existe**
\`\`\`bash
# Lista apenas releases deployed e com falha
helm list -n <namespace>

# Incluir releases em todos os estados (failed, pending, etc)
helm list --all -n <namespace>
\`\`\`

**Passo 2: Ver o status detalhado e historico**
\`\`\`bash
helm status <release> -n <namespace>
helm history <release> -n <namespace>
\`\`\`

**Passo 3: Ver os pods e eventos do namespace**
\`\`\`bash
kubectl get pods -n <namespace>
kubectl get events -n <namespace> --sort-by=.lastTimestamp | tail -20
\`\`\``,
      solution: `**Solucao preferencial: usar upgrade --install**
\`\`\`bash
# Idempotente: instala se nao existir, atualiza se existir
helm upgrade --install <release> <chart> \\
  -n <namespace> \\
  -f values.yaml
\`\`\`

**Causa: release em estado "failed" - rollback e retry**
\`\`\`bash
# Rollback para revisao funcional
helm rollback <release> -n <namespace>
helm list -n <namespace>

# Agora pode fazer upgrade
helm upgrade <release> <chart> -f values.yaml -n <namespace>
\`\`\`

**Ultima opcao: desinstalar e reinstalar**
\`\`\`bash
# Desinstalar (remove todos os recursos gerenciados pela release)
helm uninstall <release> -n <namespace>

# Verificar que nao ha recursos residuais
kubectl get all -n <namespace>

# Reinstalar
helm install <release> <chart> -f values.yaml -n <namespace>
\`\`\``
    },
    {
      title: 'helm template / helm install falha com erro de template Go',
      symptom: 'Ao executar "helm template" ou "helm install", o comando falha com erros como: "Error: template: minha-api/templates/deployment.yaml:15:20: executing ... error calling include: template ... not defined" ou "function not defined".',
      diagnosis: `**Passo 1: Identificar o template com erro**
\`\`\`bash
# O erro indica o arquivo e a linha exata
helm template minha-release ./minha-api 2>&1
# Exemplo: "minha-api/templates/deployment.yaml:15:20"
# Verificar a linha 15 do deployment.yaml
\`\`\`

**Passo 2: Verificar _helpers.tpl**
\`\`\`bash
# Verificar se o named template referenciado existe no _helpers.tpl
cat minha-api/templates/_helpers.tpl | grep "define"
# Compare com as chamadas {{ include "..." . }} nos templates
\`\`\`

**Passo 3: Verificar funcoes nao existentes**
\`\`\`bash
# Verificar se ha funcoes Sprig invalidas
helm lint ./minha-api
# helm lint detecta erros de sintaxe e funcoes nao definidas
\`\`\`

**Passo 4: Testar com valores minimos**
\`\`\`bash
helm template test ./minha-api --debug 2>&1 | head -50
\`\`\``,
      solution: `**Causa: Named template nao definido no _helpers.tpl**
\`\`\`yaml
# Verificar que o define no _helpers.tpl tem o nome correto
{{- define "minha-api.fullname" -}}
{{- printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" }}
{{- end }}

# Verificar que o include usa o mesmo nome
# deployment.yaml:
name: {{ include "minha-api.fullname" . }}  # deve bater com o define
\`\`\`

**Causa: Indentacao incorreta em blocos YAML**
\`\`\`yaml
# ERRADO - o nindent faz parte do pipeline, deve estar na mesma linha
resources:
  {{- toYaml .Values.resources }}  # sem nindent, gera YAML sem indentacao correta

# CORRETO
resources:
  {{- toYaml .Values.resources | nindent 10 }}  # 10 espacos = nivel do campo resources
\`\`\`

**Causa: Acesso a campo inexistente em Values**
\`\`\`yaml
# ERRADO - se .Values.config nao existir, acesso a .Values.config.key causa panic
value: {{ .Values.config.key }}

# CORRETO - usar default para proteger contra nil
value: {{ .Values.config.key | default "valor-padrao" }}

# OU verificar existencia primeiro
{{- if .Values.config }}
value: {{ .Values.config.key }}
{{- end }}
\`\`\`

\`\`\`bash
# Apos corrigir, validar o chart completamente
helm lint ./minha-api
helm template test ./minha-api > /dev/null && echo "Templates OK"
\`\`\``
    }
  ]
};
