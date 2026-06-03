window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['helm/helm-chart-development'] = {
  theory: `# Helm Chart Development

## Relevância no Exame
> Helm é cobrado no CKAD (domínio Application Deployment) e indiretamente no CKA. Dominar criação de charts vai além do básico: o exame espera que você crie values customizados, use helpers, hooks e empacote aplicações completas. Em vagas DevOps/Platform é a habilidade mais exigida junto com Terraform.

## Estrutura de um Chart

Todo Helm chart é um diretório com estrutura padronizada:

\`\`\`
meu-app/
├── Chart.yaml          ← metadados do chart (name, version, appVersion)
├── values.yaml         ← valores default (sobrescrevíveis no install)
├── values.schema.json  ← (opcional) validação JSON Schema dos valores
├── templates/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── _helpers.tpl    ← funções reutilizáveis (não gera manifesto)
│   ├── NOTES.txt       ← mensagem exibida após install
│   └── tests/
│       └── test-connection.yaml
├── charts/             ← subcharts (dependências)
└── .helmignore         ← arquivos ignorados no package
\`\`\`

### Chart.yaml
\`\`\`yaml
apiVersion: v2             # v2 = Helm 3 (v1 = Helm 2)
name: meu-app
description: Aplicação de exemplo com Helm
type: application          # application | library
version: 1.0.0             # versão do chart (SemVer)
appVersion: "2.3.1"        # versão da aplicação empacotada
dependencies:
  - name: postgresql
    version: "12.x.x"
    repository: https://charts.bitnami.com/bitnami
    condition: postgresql.enabled   # só instala se postgresql.enabled=true
\`\`\`

## Template Engine

Helm usa o engine de templates do Go (\`text/template\`) enriquecido com funções da biblioteca Sprig.

### Sintaxe básica
\`\`\`yaml
# {{ }} delimita expressões de template
# Espaço após ou antes de {{ remove whitespace: {{- e -}}

apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Release.Name }}-app          # variável de contexto
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "meu-app.labels" . | nindent 4 }}   # incluir helper
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      app: {{ include "meu-app.name" . }}
  template:
    metadata:
      labels:
        app: {{ include "meu-app.name" . }}
    spec:
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          ports:
            - containerPort: {{ .Values.service.port }}
          {{- if .Values.resources }}
          resources: {{- toYaml .Values.resources | nindent 12 }}
          {{- end }}
\`\`\`

### Objetos de Contexto (Built-in Objects)

| Objeto | Descrição | Exemplo |
|--------|-----------|---------|
| \`.Release\` | Informações da release | \`.Release.Name\`, \`.Release.Namespace\` |
| \`.Values\` | Valores do values.yaml | \`.Values.image.tag\` |
| \`.Chart\` | Metadados do Chart.yaml | \`.Chart.Name\`, \`.Chart.AppVersion\` |
| \`.Files\` | Acesso a arquivos do chart | \`.Files.Get "config.txt"\` |
| \`.Capabilities\` | Capacidades do cluster | \`.Capabilities.KubeVersion.GitVersion\` |

### _helpers.tpl — Funções reutilizáveis

O arquivo \`_helpers.tpl\` define templates nomeados reutilizados por outros arquivos (não gera manifestos):

\`\`\`yaml
# templates/_helpers.tpl

{{/*
Nome completo do app (truncado em 63 chars por limite de DNS)
*/}}
{{- define "meu-app.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Labels comuns — usadas em todos os recursos
*/}}
{{- define "meu-app.labels" -}}
helm.sh/chart: {{ include "meu-app.chart" . }}
{{ include "meu-app.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels (imutáveis após criação do Deployment)
*/}}
{{- define "meu-app.selectorLabels" -}}
app.kubernetes.io/name: {{ include "meu-app.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Chart name + version
*/}}
{{- define "meu-app.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}
\`\`\`

## Values.yaml — Configuração e Padrões

O \`values.yaml\` define os padrões que os usuários podem sobrescrever:

\`\`\`yaml
# values.yaml — valores default do chart
replicaCount: 1

image:
  repository: nginx
  pullPolicy: IfNotPresent
  tag: ""                  # vazio = usa .Chart.AppVersion

imagePullSecrets: []
nameOverride: ""
fullnameOverride: ""

serviceAccount:
  create: true
  annotations: {}
  name: ""

service:
  type: ClusterIP
  port: 80

ingress:
  enabled: false
  className: ""
  annotations: {}
  hosts:
    - host: chart-example.local
      paths:
        - path: /
          pathType: ImplementationSpecific
  tls: []

resources:
  limits:
    cpu: 100m
    memory: 128Mi
  requests:
    cpu: 100m
    memory: 128Mi

autoscaling:
  enabled: false
  minReplicas: 1
  maxReplicas: 100
  targetCPUUtilizationPercentage: 80

postgresql:
  enabled: false       # controla subchart
  auth:
    database: myapp
    username: appuser
    password: ""       # deve ser sobrescrito em produção
\`\`\`

### Sobrescrever valores

\`\`\`bash
# --set: CLI flag para valores simples
helm install myapp ./meu-app --set replicaCount=3 --set image.tag=v2.0

# --values / -f: arquivo de valores customizado
helm install myapp ./meu-app -f values-production.yaml

# --set-string: força tipo string (ex: versão "1" não vira int)
helm install myapp ./meu-app --set-string image.tag=1.0

# Múltiplos arquivos (último vence em conflito)
helm install myapp ./meu-app -f values-base.yaml -f values-prod.yaml
\`\`\`

## Funções de Template Úteis

\`\`\`yaml
# toYaml — converter mapa/lista para YAML inline
resources: {{- toYaml .Values.resources | nindent 12 }}

# default — valor padrão se vazio/nil
image: "{{ .Values.image.tag | default .Chart.AppVersion }}"

# quote — adiciona aspas (evita parsing de int/bool)
version: {{ .Values.version | quote }}

# upper / lower / title — transformação de string
name: {{ .Values.name | upper }}

# printf — formatação de string
name: {{ printf "%s-%s" .Release.Name .Chart.Name }}

# trunc — truncar string (limites DNS = 63 chars)
name: {{ .Release.Name | trunc 63 | trimSuffix "-" }}

# include — incluir template nomeado
{{- include "meu-app.labels" . | nindent 4 }}

# required — falha se valor obrigatório não fornecido
password: {{ required "postgresql.password é obrigatório!" .Values.postgresql.auth.password }}

# if / else — condicional
{{- if .Values.ingress.enabled }}
# manifesto de ingress...
{{- end }}

# range — iterar sobre listas/mapas
{{- range .Values.ingress.hosts }}
- host: {{ .host }}
{{- end }}
\`\`\`

## Hooks

Hooks permitem executar Jobs em momentos específicos do ciclo de vida:

\`\`\`yaml
# templates/hooks/pre-upgrade-migration.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: {{ include "meu-app.fullname" . }}-migrate
  annotations:
    "helm.sh/hook": pre-upgrade          # QUANDO executar
    "helm.sh/hook-weight": "-5"          # ordem (menor = primeiro)
    "helm.sh/hook-delete-policy": before-hook-creation,hook-succeeded
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: migrate
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          command: ["python", "manage.py", "migrate"]
\`\`\`

**Hooks disponíveis:**
| Hook | Quando |
|------|--------|
| \`pre-install\` | Antes de criar recursos no install |
| \`post-install\` | Após criar recursos no install |
| \`pre-upgrade\` | Antes de atualizar recursos |
| \`post-upgrade\` | Após atualizar recursos |
| \`pre-delete\` | Antes de deletar release |
| \`post-delete\` | Após deletar release |
| \`pre-rollback\` | Antes de rollback |
| \`test\` | Ao executar \`helm test\` |

## Chart Tests

\`\`\`yaml
# templates/tests/test-connection.yaml
apiVersion: v1
kind: Pod
metadata:
  name: "{{ include "meu-app.fullname" . }}-test-connection"
  annotations:
    "helm.sh/hook": test
spec:
  restartPolicy: Never
  containers:
    - name: wget
      image: busybox
      command: ['wget']
      args: ['{{ include "meu-app.fullname" . }}:{{ .Values.service.port }}']
\`\`\`

\`\`\`bash
# Executar testes da release
helm test myapp

# Ver logs do teste
kubectl logs myapp-test-connection
\`\`\`

## Comandos Essenciais de Desenvolvimento

\`\`\`bash
# Criar chart com scaffold padrão
helm create meu-app

# Lint — verificar erros no chart
helm lint ./meu-app
helm lint ./meu-app -f values-prod.yaml   # lint com valores específicos

# Dry-run — renderizar templates sem instalar
helm install myapp ./meu-app --dry-run
helm template myapp ./meu-app             # render local (sem cluster)
helm template myapp ./meu-app | kubectl apply --dry-run=client -f -

# Instalar / upgrade / rollback
helm install myapp ./meu-app
helm upgrade myapp ./meu-app
helm upgrade --install myapp ./meu-app    # install se não existe, upgrade se existe

# Debug template rendering
helm template myapp ./meu-app --debug     # mostra valores computados
helm install myapp ./meu-app --debug --dry-run

# Empacotar e publicar
helm package ./meu-app                    # gera meu-app-1.0.0.tgz
helm push meu-app-1.0.0.tgz oci://registry.example.com/charts

# Dependências
helm dependency update ./meu-app          # baixa subcharts para charts/
helm dependency list ./meu-app
\`\`\`

## Erros Comuns

1. **Whitespace em templates**: esquecer \`{{-\` e \`-}}\` causa linhas em branco indesejadas que podem quebrar YAML.
2. **toYaml sem nindent**: \`{{- toYaml .Values.resources }}\` não indenta → YAML inválido. Sempre use \`| nindent N\`.
3. **Selector labels mutáveis**: mudar \`selectorLabels\` num upgrade quebra o Deployment (são imutáveis). Mantenha separado de \`labels\`.
4. **required sem mensagem clara**: \`required "" .Values.x\` falha silenciosamente. Sempre passe mensagem.
5. **Subchart não habilitado**: adicionar dependência no Chart.yaml sem executar \`helm dependency update\` → chart não encontrado.
6. **Hook sem delete-policy**: hooks ficam para sempre no cluster sem \`hook-delete-policy\`.

## Killer.sh Style Challenge

> **Cenário**: Crie um Helm chart chamado \`webapp\` que:
> 1. Deploya um Deployment com \`replicaCount\` configurável (default 2)
> 2. Cria um Service do tipo ClusterIP
> 3. Tem um helper \`webapp.fullname\` usado nos dois recursos
> 4. Inclui um hook \`pre-upgrade\` que roda um Job de migration
> 5. Funciona com: \`helm install myrelease ./webapp --set replicaCount=3\`
>
> **Passos**: \`helm create webapp\` → editar \`values.yaml\` → criar \`_helpers.tpl\` com fullname → editar templates → criar \`templates/hooks/migration.yaml\` com annotation \`helm.sh/hook: pre-upgrade\` → \`helm lint ./webapp\` → \`helm template myrelease ./webapp --set replicaCount=3\`
`,

  quiz: [
    {
      question: 'Qual arquivo dentro de um Helm chart define funções reutilizáveis (como labels comuns) mas NÃO gera manifestos Kubernetes?',
      options: [
        'values.yaml',
        'Chart.yaml',
        'templates/_helpers.tpl',
        'templates/NOTES.txt'
      ],
      correct: 2,
      explanation: 'Arquivos começando com underscore (_) no diretório templates/ são tratados como arquivos de suporte e não são renderizados como manifestos. O _helpers.tpl é a convenção para definir named templates com {{- define "nome" -}} que podem ser incluídos por outros templates via {{- include "nome" . }}.',
      reference: 'Seção _helpers.tpl na teoria — entenda como define e include funcionam juntos para reuso de código.'
    },
    {
      question: 'Um Deployment está falhando no upgrade porque as selectorLabels mudaram. Por que isso acontece e qual é a solução correta?',
      options: [
        'SelectorLabels podem mudar livremente — reiniciar o Deployment resolve',
        'SelectorLabels são imutáveis em Deployments. A solução é deletar e recriar o Deployment ou fazer recreate strategy',
        'Usar --force no helm upgrade ignora o problema',
        'SelectorLabels só são imutáveis em StatefulSets, não em Deployments'
      ],
      correct: 1,
      explanation: 'O campo spec.selector de um Deployment é imutável após criação. Se as selectorLabels mudarem num upgrade, a API do Kubernetes rejeita a mudança com erro de validação. A solução é: (1) deletar manualmente o Deployment antigo, (2) fazer helm upgrade com --force, ou (3) usar recreate strategy. Por isso, selectorLabels devem ser separadas das labels gerais no _helpers.tpl.',
      reference: 'Seção _helpers.tpl — note como selectorLabels é definida separadamente de labels para evitar esse problema.'
    },
    {
      question: 'Qual é a função do comando `helm template myapp ./meu-app` e quando ele é mais útil que `helm install --dry-run`?',
      options: [
        'Os dois são idênticos — qualquer um pode ser usado',
        'helm template renderiza localmente sem precisar de cluster; --dry-run envia ao servidor e valida contra a API K8s',
        'helm template instala sem criar recursos; --dry-run simula sem instalar',
        'helm template é mais rápido apenas porque pula validações de YAML'
      ],
      correct: 1,
      explanation: 'helm template renderiza os templates localmente usando apenas o Helm engine, sem contato com o cluster — ideal para inspecionar manifests, usá-los com kubectl apply, ou em pipelines CI sem acesso ao cluster. O --dry-run envia os manifests ao Kubernetes API server para validação (rejeita recursos inválidos), o que requer um cluster acessível.',
      reference: 'Seção Comandos Essenciais — use helm template em CI/CD offline e --dry-run para validar contra o cluster real.'
    },
    {
      question: 'Você quer que um valor no values.yaml seja obrigatório e cause falha clara se não for fornecido. Qual função Helm usar?',
      options: [
        'default "erro" .Values.senha',
        'required "senha é obrigatória" .Values.senha',
        'fail "senha não informada" | .Values.senha',
        'assert .Values.senha'
      ],
      correct: 1,
      explanation: 'A função required "mensagem" valor falha o render com a mensagem fornecida se o valor for nil ou string vazia. Exemplo: {{ required "postgresql.password é obrigatório em produção!" .Values.postgresql.auth.password }}. A função default fornece um fallback mas não falha. Não existem as funções fail (como usada) ou assert no Helm.',
      reference: 'Seção Funções de Template — memorize required para valores críticos como senhas e endpoints obrigatórios.'
    },
    {
      question: 'Qual anotação Helm Hook executa um Job ANTES de cada upgrade da release?',
      options: [
        '"helm.sh/hook": post-install',
        '"helm.sh/hook": pre-upgrade',
        '"helm.sh/hook": pre-install',
        '"helm.sh/hook": test'
      ],
      correct: 1,
      explanation: 'A anotação "helm.sh/hook": pre-upgrade executa o recurso (normalmente um Job) antes que os recursos principais sejam atualizados durante um helm upgrade. É o padrão para migrations de banco de dados — garantir que o schema esteja atualizado antes de subir a nova versão da aplicação.',
      reference: 'Seção Hooks — veja a tabela completa de hooks e seus momentos de execução.'
    },
    {
      question: 'Por que é recomendado usar `{{- toYaml .Values.resources | nindent 12 }}` em vez de `{{ toYaml .Values.resources }}`?',
      options: [
        'nindent é obrigatório por razões de segurança no Helm',
        'nindent adiciona indentação correta e o {{- remove whitespace antes da expressão, evitando YAML inválido',
        'toYaml sem nindent produz JSON em vez de YAML',
        'nindent comprime o YAML para economizar espaço no etcd'
      ],
      correct: 1,
      explanation: 'toYaml converte um mapa Go para string YAML, mas sem indentação relativa ao contexto. nindent N adiciona N espaços de indentação em cada linha (n = número de espaços), e o {{- remove o whitespace e newline antes da tag. Sem isso, o YAML gerado ficaria mal indentado e inválido, causando erro no kubectl apply.',
      reference: 'Seção Funções de Template — toYaml + nindent é o padrão para inserir estruturas complexas (resources, env, volumes) em templates.'
    },
    {
      question: 'Como sobrescrever um valor do values.yaml durante o helm install sem criar um arquivo separado?',
      options: [
        'helm install myapp ./chart --override replicaCount=3',
        'helm install myapp ./chart --set replicaCount=3',
        'helm install myapp ./chart --values replicaCount=3',
        'helm install myapp ./chart -p replicaCount=3'
      ],
      correct: 1,
      explanation: 'A flag --set permite sobrescrever valores na linha de comando: --set replicaCount=3. Para valores nested use ponto: --set image.tag=v2. Para listas use chaves: --set ingress.hosts[0]=app.example.com. A flag --values/-f aceita um arquivo YAML completo, não uma string key=value.',
      reference: 'Seção Values.yaml — conheça as diferenças entre --set, --set-string, --values e quando usar cada um.'
    },
    {
      question: 'Qual é o propósito do campo `helm.sh/hook-delete-policy` em um Hook?',
      options: [
        'Define quando deletar a release inteira',
        'Define quando deletar o recurso do hook após execução (ex: Job de migration)',
        'Define quais namespaces o hook pode deletar recursos',
        'Controla o comportamento de rollback do hook'
      ],
      correct: 1,
      explanation: 'hook-delete-policy define quando o recurso do hook (ex: Job) é deletado após execução. Valores comuns: before-hook-creation (deleta hooks anteriores antes de criar novo), hook-succeeded (deleta ao ter sucesso), hook-failed (deleta ao falhar). Sem esta anotação, os Jobs de hook se acumulam no cluster indefinidamente.',
      reference: 'Seção Hooks — sempre adicione delete-policy para evitar acúmulo de Jobs no cluster.'
    }
  ],

  flashcards: [
    {
      front: 'Qual a diferença entre Chart.version e Chart.appVersion?',
      back: '**Chart.version** (ex: 1.2.3): versão do **chart** em si (embalagem). Muda quando você altera templates, values, estrutura do chart — mesmo sem mudar a aplicação.\n\n**Chart.appVersion** (ex: "2.0.1"): versão da **aplicação** empacotada. Referência informativa — o que realmente roda dentro dos containers.\n\nBoa prática: `image.tag: ""` nos values, com template `{{ .Values.image.tag | default .Chart.AppVersion }}` → usa appVersion como padrão.'
    },
    {
      front: 'Como funciona o arquivo _helpers.tpl e por que o underscore é importante?',
      back: 'Arquivos com nome começando em `_` no diretório `templates/` **não são renderizados** como manifestos Kubernetes — são arquivos de suporte.\n\n`_helpers.tpl` contém **named templates** definidos com `{{- define "nome" -}}...{{- end }}`.\n\nOutros templates os usam via `{{- include "nome" . | nindent N }}`.\n\nExemplo típico: `meu-app.labels`, `meu-app.fullname`, `meu-app.selectorLabels` → reutilizados em Deployment, Service, Ingress.'
    },
    {
      front: 'Por que selectorLabels devem ser imutáveis em um chart Helm? Como garantir isso?',
      back: '`spec.selector` de Deployments e StatefulSets é **imutável** após criação no Kubernetes. Se mudar num upgrade, o K8s rejeita com erro de validação.\n\nSolução: no `_helpers.tpl`, definir **dois** templates separados:\n- `meu-app.labels` → labels completas (chart version, etc.) — pode mudar\n- `meu-app.selectorLabels` → subset mínimo e estável (app name + instance) — nunca muda\n\nDeployment usa `selectorLabels` no `spec.selector` e `spec.template.metadata.labels`.'
    },
    {
      front: 'Quando usar helm template vs helm install --dry-run?',
      back: '**helm template** (render local):\n- Não precisa de cluster\n- Renderiza templates usando Helm engine local\n- Output pode ser passado para `kubectl apply -f -`\n- Ideal para CI/CD offline, debug de templates\n\n**helm install --dry-run** (server-side):\n- Requer acesso ao cluster\n- Valida manifests contra a API K8s\n- Detecta recursos inválidos/conflitantes\n- Mais próximo do comportamento real'
    },
    {
      front: 'Como funcionam os Hooks do Helm? Dê um exemplo prático.',
      back: '**Hooks** são recursos com anotação `helm.sh/hook: <tipo>` que executam em momentos específicos do lifecycle.\n\nExemplo: migration de banco antes de upgrade:\n```yaml\nannotations:\n  "helm.sh/hook": pre-upgrade\n  "helm.sh/hook-weight": "-5"\n  "helm.sh/hook-delete-policy": hook-succeeded\n```\n\n**Tipos comuns**: `pre-install`, `post-install`, `pre-upgrade`, `post-upgrade`, `test`\n\n**hook-weight**: ordem de execução (menor = primeiro)\n\n**delete-policy**: `hook-succeeded` (limpa após sucesso), `before-hook-creation` (limpa antes de criar novo)'
    },
    {
      front: 'Quais são as flags de set mais usadas no helm install/upgrade?',
      back: '`--set key=value` → valor simples\n```bash\nhelm install app ./chart --set replicaCount=3\n```\n\n`--set-string key=value` → força tipo string\n```bash\n--set-string image.tag=1.0  # evita "1.0" ser parseado como float\n```\n\n`--set key[0]=value` → lista\n```bash\n--set hosts[0]=app.example.com\n```\n\n`-f values.yaml` / `--values file.yaml` → arquivo completo\n```bash\n-f values-prod.yaml -f values-override.yaml  # último vence\n```\n\n`--reset-values` → descarta valores anteriores (só usa os novos)'
    },
    {
      front: 'Como criar e executar um Chart Test no Helm?',
      back: 'Chart tests são Pods com anotação `helm.sh/hook: test`.\n\nCriar `templates/tests/test-connection.yaml`:\n```yaml\napiVersion: v1\nkind: Pod\nmetadata:\n  name: "{{ include "app.fullname" . }}-test"\n  annotations:\n    "helm.sh/hook": test\nspec:\n  restartPolicy: Never\n  containers:\n    - name: test\n      image: busybox\n      command: [\'wget\', \'-q\', \'--spider\']\n      args: [\'http://{{ include "app.fullname" . }}\']\n```\n\nExecutar: `helm test myrelease`\n\nOs testes passam se o Pod termina com exit code 0.'
    }
  ],

  lab: {
    scenario: 'Você vai criar do zero um Helm chart completo para a aplicação "techstore" — um e-commerce simples. O chart deve ser parametrizável, ter helpers reutilizáveis, incluir um hook de pre-upgrade para migrations e ter chart tests.',
    objective: 'Dominar criação de Helm charts: estrutura, templates com helpers, values, hooks e testes.',
    duration: '30-40 minutos',
    steps: [
      {
        title: 'Scaffolding e estrutura inicial',
        instruction: 'Crie um chart chamado `techstore` usando `helm create`, entenda a estrutura gerada e faça o lint inicial.',
        hints: [
          'helm create gera uma estrutura completa com nginx como exemplo',
          'helm lint verifica erros de sintaxe e boas práticas',
          'Explore o _helpers.tpl gerado para entender os named templates padrão'
        ],
        solution: `\`\`\`bash
# Criar o chart com scaffold padrão
helm create techstore

# Explorar estrutura gerada
find techstore/ -type f | sort

# Lint para verificar o estado inicial (deve passar sem erros)
helm lint ./techstore

# Renderizar templates padrão (nginx como imagem)
helm template myrelease ./techstore | head -60

echo "Estrutura criada e válida. Próximo: customizar o chart."
\`\`\``,
        verify: `\`\`\`bash
# Verificar estrutura essencial
ls techstore/templates/
# Esperado: _helpers.tpl  deployment.yaml  hpa.yaml  ingress.yaml  NOTES.txt  service.yaml  serviceaccount.yaml  tests/

ls techstore/
# Esperado: Chart.yaml  charts/  templates/  values.yaml

helm lint ./techstore
# Esperado: 1 chart(s) linted, 0 chart(s) failed
\`\`\``
      },
      {
        title: 'Customizar values.yaml e Chart.yaml',
        instruction: 'Adapte o chart para a aplicação techstore: configure values relevantes e atualize os metadados do Chart.yaml.',
        hints: [
          'Edite Chart.yaml: name=techstore, version=1.0.0, appVersion="1.5.0"',
          'No values.yaml: image.repository=nginx, replicaCount=2, service.port=8080',
          'Adicione um bloco `app` com `env: production` e `debug: false`'
        ],
        solution: `\`\`\`bash
# Atualizar Chart.yaml
cat > techstore/Chart.yaml << 'EOF'
apiVersion: v2
name: techstore
description: E-commerce Techstore Helm Chart
type: application
version: 1.0.0
appVersion: "1.5.0"
EOF

# Atualizar values.yaml com valores da techstore
cat > techstore/values.yaml << 'EOF'
replicaCount: 2

image:
  repository: nginx
  pullPolicy: IfNotPresent
  tag: ""

service:
  type: ClusterIP
  port: 8080
  targetPort: 80

resources:
  limits:
    cpu: 200m
    memory: 256Mi
  requests:
    cpu: 100m
    memory: 128Mi

app:
  env: production
  debug: false
  logLevel: info

ingress:
  enabled: false
  className: nginx
  hosts:
    - host: techstore.local
      paths:
        - path: /
          pathType: Prefix

serviceAccount:
  create: true
  name: ""
EOF

# Verificar lint após mudanças
helm lint ./techstore
\`\`\``,
        verify: `\`\`\`bash
# Verificar Chart.yaml
grep "appVersion" techstore/Chart.yaml
# Esperado: appVersion: "1.5.0"

grep "replicaCount" techstore/values.yaml
# Esperado: replicaCount: 2

helm lint ./techstore
# Esperado: 1 chart(s) linted, 0 chart(s) failed
\`\`\``
      },
      {
        title: 'Adicionar template com variáveis de ambiente do app',
        instruction: 'Modifique o Deployment para injetar as configurações do bloco `app` do values.yaml como variáveis de ambiente no container.',
        hints: [
          'Edite templates/deployment.yaml e adicione um bloco env: no container',
          'Use {{ .Values.app.env }}, {{ .Values.app.debug | quote }}, {{ .Values.app.logLevel }}',
          'Use {{ .Values.service.targetPort }} no containerPort'
        ],
        solution: `\`\`\`bash
# Criar deployment customizado com env vars
cat > techstore/templates/deployment.yaml << 'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "techstore.fullname" . }}
  labels:
    {{- include "techstore.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      {{- include "techstore.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "techstore.selectorLabels" . | nindent 8 }}
    spec:
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: {{ .Values.service.targetPort }}
              protocol: TCP
          env:
            - name: APP_ENV
              value: {{ .Values.app.env | quote }}
            - name: APP_DEBUG
              value: {{ .Values.app.debug | quote }}
            - name: LOG_LEVEL
              value: {{ .Values.app.logLevel | quote }}
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
EOF

# Renderizar e verificar
helm template myrelease ./techstore --show-only templates/deployment.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verificar que as env vars aparecem no template renderizado
helm template myrelease ./techstore --show-only templates/deployment.yaml | grep -A10 "env:"
# Esperado: APP_ENV, APP_DEBUG, LOG_LEVEL

# Lint final
helm lint ./techstore
# Esperado: 0 erros

# Verificar replicas
helm template myrelease ./techstore --show-only templates/deployment.yaml | grep "replicas:"
# Esperado: replicas: 2
\`\`\``
      },
      {
        title: 'Criar hook pre-upgrade para migration',
        instruction: 'Adicione um Job que executa antes de cada upgrade para simular uma migration de banco de dados.',
        hints: [
          'Criar templates/hooks/pre-upgrade-migration.yaml',
          'Usar annotation "helm.sh/hook": pre-upgrade',
          'Adicionar hook-delete-policy: hook-succeeded para limpeza automática'
        ],
        solution: `\`\`\`bash
mkdir -p techstore/templates/hooks

cat > techstore/templates/hooks/pre-upgrade-migration.yaml << 'EOF'
apiVersion: batch/v1
kind: Job
metadata:
  name: "{{ include "techstore.fullname" . }}-migrate-{{ .Release.Revision }}"
  labels:
    {{- include "techstore.labels" . | nindent 4 }}
  annotations:
    "helm.sh/hook": pre-upgrade
    "helm.sh/hook-weight": "-5"
    "helm.sh/hook-delete-policy": before-hook-creation,hook-succeeded
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: migrate
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          command: ["echo", "Running database migration..."]
          env:
            - name: APP_ENV
              value: {{ .Values.app.env | quote }}
EOF

# Verificar lint
helm lint ./techstore

# Confirmar hook no render
helm template myrelease ./techstore --show-only templates/hooks/pre-upgrade-migration.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verificar hook annotations
helm template myrelease ./techstore --show-only templates/hooks/pre-upgrade-migration.yaml | grep "helm.sh/hook"
# Esperado: "helm.sh/hook": pre-upgrade

# Verificar hook-delete-policy
helm template myrelease ./techstore --show-only templates/hooks/pre-upgrade-migration.yaml | grep "hook-delete-policy"
# Esperado: before-hook-creation,hook-succeeded

helm lint ./techstore
# Esperado: 0 chart(s) failed
\`\`\``
      },
      {
        title: 'Instalar e testar o chart no cluster',
        instruction: 'Instale o chart no cluster local, verifique os recursos criados e teste o upgrade com mudança de values.',
        hints: [
          'Use --create-namespace para criar o namespace automaticamente',
          'helm upgrade --install é idempotente (install ou upgrade dependendo do estado)',
          'Teste sobrescrever replicaCount via --set'
        ],
        solution: `\`\`\`bash
# Instalar em namespace dedicado
helm install techstore-dev ./techstore \
  --namespace techstore \
  --create-namespace \
  --set app.env=development

# Verificar release
helm list -n techstore
kubectl get all -n techstore

# Simular upgrade com mudança de replicas
helm upgrade techstore-dev ./techstore \
  --namespace techstore \
  --set replicaCount=3 \
  --set app.env=staging

# Verificar rollout
kubectl rollout status deployment -n techstore

# Histórico de releases
helm history techstore-dev -n techstore

# Limpeza
helm uninstall techstore-dev -n techstore
kubectl delete namespace techstore
\`\`\``,
        verify: `\`\`\`bash
# Verificar release instalada
helm list -n techstore
# Esperado: techstore-dev  techstore  1  DEPLOYED  techstore-1.0.0

# Verificar Deployment
kubectl get deployment -n techstore
# Esperado: techstore-dev-techstore  READY 2/2

# Após upgrade
kubectl get deployment -n techstore -o jsonpath='{.items[0].spec.replicas}'
# Esperado: 3
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Template rendering: "Error: YAML parse error" após adicionar toYaml',
      difficulty: 'medium',
      symptom: 'helm install falha com "Error: YAML parse error on templates/deployment.yaml: mapping values are not allowed in this context" ao adicionar um bloco de resources ao Deployment.',
      diagnosis: `\`\`\`bash
# Reproduzir o erro com template
helm template myapp ./chart --show-only templates/deployment.yaml

# Inspecionar o output mal formatado
# O erro geralmente está em indentação incorreta após toYaml

# Ver o template problemático
cat chart/templates/deployment.yaml | grep -A3 "resources"
# Problema típico:
# resources:
# limits:          ← sem indentação
#   cpu: 100m
\`\`\``,
      solution: `**Causa**: \`toYaml\` gera YAML sem indentação relativa ao contexto. Sem \`nindent\`, o conteúdo fica na coluna 0, quebrando o YAML do manifest.

**Problema**:
\`\`\`yaml
resources: {{ toYaml .Values.resources }}    # ← errado
\`\`\`

**Solução**:
\`\`\`yaml
resources:
  {{- toYaml .Values.resources | nindent 10 }}   # ← correto para nested em container (2+2+4+2=10)
\`\`\`

Ou na sintaxe de bloco:
\`\`\`yaml
          resources:
            {{- toYaml .Values.resources | nindent 12 }}   # 12 espaços = nível do bloco
\`\`\`

**Regra**: conte os espaços de indentação da chave pai e adicione 2. Se \`resources:\` está em 10 espaços, o conteúdo vai em 12 → \`nindent 12\`.`
    },
    {
      title: 'helm upgrade falha: "cannot patch Deployment, field is immutable"',
      difficulty: 'hard',
      symptom: 'Após modificar o _helpers.tpl para adicionar novas labels ao selectorLabels, o helm upgrade falha com: "cannot patch \"my-deployment\": Resource spec.selector: Invalid value: ... field is immutable".',
      diagnosis: `\`\`\`bash
# Verificar o que mudou nas labels
helm get manifest myrelease -n myns | grep -A5 "selector:"

# Comparar com o novo render
helm template myrelease ./chart --show-only templates/deployment.yaml | grep -A5 "selector:"

# Ver qual label foi adicionada
diff <(helm get manifest myrelease | grep -A5 "matchLabels") \
     <(helm template myrelease ./chart | grep -A5 "matchLabels")
\`\`\``,
      solution: `**Causa**: \`spec.selector.matchLabels\` em Deployments é imutável após criação. Adicionar qualquer label ao \`selectorLabels\` quebra upgrades.

**Soluções em ordem de impacto**:

1. **Reverter a mudança** nas selectorLabels (mantenha apenas: \`app.kubernetes.io/name\` e \`app.kubernetes.io/instance\`).

2. **Deletar e recriar** o Deployment (causa downtime breve):
\`\`\`bash
kubectl delete deployment myrelease-myapp -n myns
helm upgrade myrelease ./chart -n myns
\`\`\`

3. **helm upgrade com --force** (deleta e recria o recurso):
\`\`\`bash
helm upgrade myrelease ./chart -n myns --force
\`\`\`

**Prevenção**: no _helpers.tpl, sempre separe:
- \`meu-app.labels\` → labels completas (version, chart, managed-by)
- \`meu-app.selectorLabels\` → APENAS name e instance → **nunca adicione campos aqui**

O selector usa \`selectorLabels\`; metadata.labels usa \`labels\`.`
    }
  ]
};
