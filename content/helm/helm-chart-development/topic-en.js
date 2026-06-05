window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['helm/helm-chart-development'] = {
  theory: `# Helm Chart Development

## Exam Relevance
> Helm is tested in CKAD (Application Deployment domain) and indirectly in CKA. Mastering chart creation goes beyond the basics: the exam expects you to create custom values, use helpers, hooks, and package complete applications. In DevOps/Platform roles, it is the most demanded skill alongside Terraform.

## Chart Structure

Every Helm chart is a directory with a standardized structure:

\`\`\`
my-app/
├── Chart.yaml          ← chart metadata (name, version, appVersion)
├── values.yaml         ← default values (overridable at install)
├── values.schema.json  ← (optional) JSON Schema validation of values
├── templates/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── _helpers.tpl    ← reusable functions (does not generate manifest)
│   ├── NOTES.txt       ← message displayed after install
│   └── tests/
│       └── test-connection.yaml
├── charts/             ← subcharts (dependencies)
└── .helmignore         ← files ignored on package
\`\`\`

### Chart.yaml
\`\`\`yaml
apiVersion: v2             # v2 = Helm 3 (v1 = Helm 2)
name: my-app
description: Example application with Helm
type: application          # application | library
version: 1.0.0             # chart version (SemVer)
appVersion: "2.3.1"        # version of the packaged application
dependencies:
  - name: postgresql
    version: "12.x.x"
    repository: https://charts.bitnami.com/bitnami
    condition: postgresql.enabled   # only install if postgresql.enabled=true
\`\`\`

## Template Engine

Helm uses Go's template engine (\`text/template\`) enriched with functions from the Sprig library.

### Basic Syntax
\`\`\`yaml
# {{ }} delimits template expressions
# Space after or before {{ removes whitespace: {{- and -}}

apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Release.Name }}-app          # context variable
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "my-app.labels" . | nindent 4 }}   # include helper
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      app: {{ include "my-app.name" . }}
  template:
    metadata:
      labels:
        app: {{ include "my-app.name" . }}
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

### Context Objects (Built-in Objects)

| Object | Description | Example |
|--------|-------------|---------|
| \`.Release\` | Release information | \`.Release.Name\`, \`.Release.Namespace\` |
| \`.Values\` | Values from values.yaml | \`.Values.image.tag\` |
| \`.Chart\` | Chart.yaml metadata | \`.Chart.Name\`, \`.Chart.AppVersion\` |
| \`.Files\` | Access to chart files | \`.Files.Get "config.txt"\` |
| \`.Capabilities\` | Cluster capabilities | \`.Capabilities.KubeVersion.GitVersion\` |

### _helpers.tpl — Reusable Functions

The \`_helpers.tpl\` file defines named templates reused by other files (does not generate manifests):

\`\`\`yaml
# templates/_helpers.tpl

{{/*
Full app name (truncated at 63 chars due to DNS limit)
*/}}
{{- define "my-app.fullname" -}}
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
Common labels — used in all resources
*/}}
{{- define "my-app.labels" -}}
helm.sh/chart: {{ include "my-app.chart" . }}
{{ include "my-app.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels (immutable after Deployment creation)
*/}}
{{- define "my-app.selectorLabels" -}}
app.kubernetes.io/name: {{ include "my-app.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Chart name + version
*/}}
{{- define "my-app.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}
\`\`\`

## Values.yaml — Configuration and Defaults

The \`values.yaml\` defines defaults that users can override:

\`\`\`yaml
# values.yaml — chart default values
replicaCount: 1

image:
  repository: nginx
  pullPolicy: IfNotPresent
  tag: ""                  # empty = uses .Chart.AppVersion

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
  enabled: false       # controls subchart
  auth:
    database: myapp
    username: appuser
    password: ""       # must be overridden in production
\`\`\`

### Overriding values

\`\`\`bash
# --set: CLI flag for simple values
helm install myapp ./my-app --set replicaCount=3 --set image.tag=v2.0

# --values / -f: custom values file
helm install myapp ./my-app -f values-production.yaml

# --set-string: force string type (e.g., version "1" does not become int)
helm install myapp ./my-app --set-string image.tag=1.0

# Multiple files (last wins on conflict)
helm install myapp ./my-app -f values-base.yaml -f values-prod.yaml
\`\`\`

## Useful Template Functions

\`\`\`yaml
# toYaml — convert map/list to inline YAML
resources: {{- toYaml .Values.resources | nindent 12 }}

# default — default value if empty/nil
image: "{{ .Values.image.tag | default .Chart.AppVersion }}"

# quote — adds quotes (avoids int/bool parsing)
version: {{ .Values.version | quote }}

# upper / lower / title — string transformation
name: {{ .Values.name | upper }}

# printf — string formatting
name: {{ printf "%s-%s" .Release.Name .Chart.Name }}

# trunc — truncate string (DNS limits = 63 chars)
name: {{ .Release.Name | trunc 63 | trimSuffix "-" }}

# include — include named template
{{- include "my-app.labels" . | nindent 4 }}

# required — fails if required value not provided
password: {{ required "postgresql.password is required!" .Values.postgresql.auth.password }}

# if / else — conditional
{{- if .Values.ingress.enabled }}
# ingress manifest...
{{- end }}

# range — iterate over lists/maps
{{- range .Values.ingress.hosts }}
- host: {{ .host }}
{{- end }}
\`\`\`

## Hooks

Hooks allow executing Jobs at specific lifecycle moments:

\`\`\`yaml
# templates/hooks/pre-upgrade-migration.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: {{ include "my-app.fullname" . }}-migrate
  annotations:
    "helm.sh/hook": pre-upgrade          # WHEN to execute
    "helm.sh/hook-weight": "-5"          # order (lower = first)
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

**Available hooks:**
| Hook | When |
|------|------|
| \`pre-install\` | Before creating resources on install |
| \`post-install\` | After creating resources on install |
| \`pre-upgrade\` | Before updating resources |
| \`post-upgrade\` | After updating resources |
| \`pre-delete\` | Before deleting release |
| \`post-delete\` | After deleting release |
| \`pre-rollback\` | Before rollback |
| \`test\` | When running \`helm test\` |

## Chart Tests

\`\`\`yaml
# templates/tests/test-connection.yaml
apiVersion: v1
kind: Pod
metadata:
  name: "{{ include "my-app.fullname" . }}-test-connection"
  annotations:
    "helm.sh/hook": test
spec:
  restartPolicy: Never
  containers:
    - name: wget
      image: busybox
      command: ['wget']
      args: ['{{ include "my-app.fullname" . }}:{{ .Values.service.port }}']
\`\`\`

\`\`\`bash
# Run release tests
helm test myapp

# View test logs
kubectl logs myapp-test-connection
\`\`\`

## Essential Development Commands

\`\`\`bash
# Create chart with default scaffold
helm create my-app

# Lint — check for errors in the chart
helm lint ./my-app
helm lint ./my-app -f values-prod.yaml   # lint with specific values

# Dry-run — render templates without installing
helm install myapp ./my-app --dry-run
helm template myapp ./my-app             # local render (no cluster)
helm template myapp ./my-app | kubectl apply --dry-run=client -f -

# Install / upgrade / rollback
helm install myapp ./my-app
helm upgrade myapp ./my-app
helm upgrade --install myapp ./my-app    # install if not exists, upgrade if exists

# Debug template rendering
helm template myapp ./my-app --debug     # shows computed values
helm install myapp ./my-app --debug --dry-run

# Package and publish
helm package ./my-app                    # generates my-app-1.0.0.tgz
helm push my-app-1.0.0.tgz oci://registry.example.com/charts

# Dependencies
helm dependency update ./my-app          # downloads subcharts to charts/
helm dependency list ./my-app
\`\`\`

## Common Mistakes

1. **Whitespace in templates**: forgetting \`{{-\` and \`-}}\` causes unwanted blank lines that can break YAML.
2. **toYaml without nindent**: \`{{- toYaml .Values.resources }}\` does not indent → invalid YAML. Always use \`| nindent N\`.
3. **Mutable selector labels**: changing \`selectorLabels\` on upgrade breaks the Deployment (they are immutable). Keep separate from \`labels\`.
4. **required without clear message**: \`required "" .Values.x\` fails silently. Always pass a message.
5. **Subchart not enabled**: adding a dependency in Chart.yaml without running \`helm dependency update\` → chart not found.
6. **Hook without delete-policy**: hooks remain in the cluster forever without \`hook-delete-policy\`.

## Killer.sh Style Challenge

> **Scenario**: Create a Helm chart called \`webapp\` that:
> 1. Deploys a Deployment with configurable \`replicaCount\` (default 2)
> 2. Creates a ClusterIP Service
> 3. Has a \`webapp.fullname\` helper used in both resources
> 4. Includes a \`pre-upgrade\` hook that runs a migration Job
> 5. Works with: \`helm install myrelease ./webapp --set replicaCount=3\`
>
> **Steps**: \`helm create webapp\` → edit \`values.yaml\` → create \`_helpers.tpl\` with fullname → edit templates → create \`templates/hooks/migration.yaml\` with annotation \`helm.sh/hook: pre-upgrade\` → \`helm lint ./webapp\` → \`helm template myrelease ./webapp --set replicaCount=3\`
`,

  quiz: [
    {
      question: 'Which file inside a Helm chart defines reusable functions (such as common labels) but does NOT generate Kubernetes manifests?',
      options: [
        'values.yaml',
        'Chart.yaml',
        'templates/_helpers.tpl',
        'templates/NOTES.txt'
      ],
      correct: 2,
      explanation: 'Files beginning with underscore (_) in the templates/ directory are treated as support files and are not rendered as manifests. The _helpers.tpl is the convention for defining named templates with {{- define "name" -}} that can be included by other templates via {{- include "name" . }}.',
      reference: '_helpers.tpl section — understand how define and include work together for code reuse.'
    },
    {
      question: 'A Deployment is failing on upgrade because the selectorLabels changed. Why does this happen and what is the correct solution?',
      options: [
        'SelectorLabels can change freely — restarting the Deployment resolves it',
        'SelectorLabels are immutable in Deployments. The solution is to delete and recreate the Deployment or use recreate strategy',
        'Using --force on helm upgrade ignores the problem',
        'SelectorLabels are only immutable in StatefulSets, not in Deployments'
      ],
      correct: 1,
      explanation: 'The spec.selector field of a Deployment is immutable after creation. If selectorLabels change on upgrade, the Kubernetes API rejects the change with a validation error. Solutions: (1) manually delete the old Deployment, (2) run helm upgrade with --force, or (3) use recreate strategy. This is why selectorLabels must be separated from general labels in _helpers.tpl.',
      reference: '_helpers.tpl section — notice how selectorLabels is defined separately from labels to avoid this problem.'
    },
    {
      question: 'What is the purpose of `helm template myapp ./my-app` and when is it more useful than `helm install --dry-run`?',
      options: [
        'Both are identical — either can be used',
        'helm template renders locally without needing a cluster; --dry-run sends to the server and validates against the K8s API',
        'helm template installs without creating resources; --dry-run simulates without installing',
        'helm template is faster only because it skips YAML validations'
      ],
      correct: 1,
      explanation: 'helm template renders templates locally using only the Helm engine, without contacting the cluster — ideal for inspecting manifests, using them with kubectl apply, or in CI pipelines without cluster access. --dry-run sends the manifests to the Kubernetes API server for validation (rejects invalid resources), which requires an accessible cluster.',
      reference: 'Essential Commands section — use helm template in offline CI/CD and --dry-run to validate against the real cluster.'
    },
    {
      question: 'You want a value in values.yaml to be mandatory and cause a clear failure if not provided. Which Helm function should you use?',
      options: [
        'default "error" .Values.password',
        'required "password is required" .Values.password',
        'fail "password not set" | .Values.password',
        'assert .Values.password'
      ],
      correct: 1,
      explanation: 'The required "message" value function fails the render with the provided message if the value is nil or an empty string. Example: {{ required "postgresql.password is required in production!" .Values.postgresql.auth.password }}. The default function provides a fallback but does not fail. The functions fail (as used) and assert do not exist in Helm.',
      reference: 'Template Functions section — memorize required for critical values such as passwords and mandatory endpoints.'
    },
    {
      question: 'Which Helm Hook annotation executes a Job BEFORE each release upgrade?',
      options: [
        '"helm.sh/hook": post-install',
        '"helm.sh/hook": pre-upgrade',
        '"helm.sh/hook": pre-install',
        '"helm.sh/hook": test'
      ],
      correct: 1,
      explanation: 'The annotation "helm.sh/hook": pre-upgrade executes the resource (usually a Job) before the main resources are updated during a helm upgrade. It is the standard pattern for database migrations — ensuring the schema is updated before the new application version is started.',
      reference: 'Hooks section — see the complete table of hooks and their execution moments.'
    },
    {
      question: 'Why is it recommended to use `{{- toYaml .Values.resources | nindent 12 }}` instead of `{{ toYaml .Values.resources }}`?',
      options: [
        'nindent is mandatory for security reasons in Helm',
        'nindent adds correct indentation and {{- removes whitespace before the expression, preventing invalid YAML',
        'toYaml without nindent produces JSON instead of YAML',
        'nindent compresses the YAML to save space in etcd'
      ],
      correct: 1,
      explanation: 'toYaml converts a Go map to a YAML string, but without indentation relative to context. nindent N adds N spaces of indentation to each line (n = number of spaces), and {{- removes the whitespace and newline before the tag. Without this, the generated YAML would be incorrectly indented and invalid, causing errors in kubectl apply.',
      reference: 'Template Functions section — toYaml + nindent is the standard for inserting complex structures (resources, env, volumes) in templates.'
    },
    {
      question: 'How do you override a value from values.yaml during helm install without creating a separate file?',
      options: [
        'helm install myapp ./chart --override replicaCount=3',
        'helm install myapp ./chart --set replicaCount=3',
        'helm install myapp ./chart --values replicaCount=3',
        'helm install myapp ./chart -p replicaCount=3'
      ],
      correct: 1,
      explanation: 'The --set flag allows overriding values on the command line: --set replicaCount=3. For nested values use dot notation: --set image.tag=v2. For lists use braces: --set ingress.hosts[0]=app.example.com. The --values/-f flag accepts a full YAML file, not a key=value string.',
      reference: 'Values.yaml section — know the differences between --set, --set-string, --values and when to use each.'
    },
    {
      question: 'What is the purpose of the `helm.sh/hook-delete-policy` field in a Hook?',
      options: [
        'Defines when to delete the entire release',
        'Defines when to delete the hook resource after execution (e.g., migration Job)',
        'Defines which namespaces the hook can delete resources in',
        'Controls the rollback behavior of the hook'
      ],
      correct: 1,
      explanation: 'hook-delete-policy defines when the hook resource (e.g., Job) is deleted after execution. Common values: before-hook-creation (deletes previous hooks before creating a new one), hook-succeeded (deletes on success), hook-failed (deletes on failure). Without this annotation, hook Jobs accumulate in the cluster indefinitely.',
      reference: 'Hooks section — always add delete-policy to prevent Job accumulation in the cluster.'
    }
  ],

  flashcards: [
    {
      front: 'What is the difference between Chart.version and Chart.appVersion?',
      back: '**Chart.version** (e.g.: 1.2.3): version of the **chart** itself (packaging). Changes when you alter templates, values, chart structure — even without changing the application.\n\n**Chart.appVersion** (e.g.: "2.0.1"): version of the **packaged application**. Informational reference — what actually runs inside the containers.\n\nBest practice: `image.tag: ""` in values, with template `{{ .Values.image.tag | default .Chart.AppVersion }}` → uses appVersion as default.'
    },
    {
      front: 'How does the _helpers.tpl file work and why is the underscore important?',
      back: 'Files with names starting with `_` in the `templates/` directory are **not rendered** as Kubernetes manifests — they are support files.\n\n`_helpers.tpl` contains **named templates** defined with `{{- define "name" -}}...{{- end }}`.\n\nOther templates use them via `{{- include "name" . | nindent N }}`.\n\nTypical examples: `my-app.labels`, `my-app.fullname`, `my-app.selectorLabels` → reused in Deployment, Service, Ingress.'
    },
    {
      front: 'Why must selectorLabels be immutable in a Helm chart? How do you ensure that?',
      back: '`spec.selector` of Deployments and StatefulSets is **immutable** after creation in Kubernetes. If changed on upgrade, K8s rejects it with a validation error.\n\nSolution: in `_helpers.tpl`, define **two** separate templates:\n- `my-app.labels` → full labels (chart version, etc.) — can change\n- `my-app.selectorLabels` → minimal stable subset (app name + instance) — never changes\n\nDeployment uses `selectorLabels` in `spec.selector` and `spec.template.metadata.labels`.'
    },
    {
      front: 'When to use helm template vs helm install --dry-run?',
      back: '**helm template** (local render):\n- No cluster needed\n- Renders templates using local Helm engine\n- Output can be piped to `kubectl apply -f -`\n- Ideal for offline CI/CD, template debugging\n\n**helm install --dry-run** (server-side):\n- Requires cluster access\n- Validates manifests against the K8s API\n- Detects invalid/conflicting resources\n- Closer to real behavior'
    },
    {
      front: 'How do Helm Hooks work? Give a practical example.',
      back: '**Hooks** are resources with annotation `helm.sh/hook: <type>` that execute at specific lifecycle moments.\n\nExample: database migration before upgrade:\n```yaml\nannotations:\n  "helm.sh/hook": pre-upgrade\n  "helm.sh/hook-weight": "-5"\n  "helm.sh/hook-delete-policy": hook-succeeded\n```\n\n**Common types**: `pre-install`, `post-install`, `pre-upgrade`, `post-upgrade`, `test`\n\n**hook-weight**: execution order (lower = first)\n\n**delete-policy**: `hook-succeeded` (clean up on success), `before-hook-creation` (clean up before creating a new one)'
    },
    {
      front: 'What are the most commonly used set flags in helm install/upgrade?',
      back: '`--set key=value` → simple value\n```bash\nhelm install app ./chart --set replicaCount=3\n```\n\n`--set-string key=value` → force string type\n```bash\n--set-string image.tag=1.0  # prevents "1.0" from being parsed as float\n```\n\n`--set key[0]=value` → list\n```bash\n--set hosts[0]=app.example.com\n```\n\n`-f values.yaml` / `--values file.yaml` → full file\n```bash\n-f values-prod.yaml -f values-override.yaml  # last wins\n```\n\n`--reset-values` → discards previous values (only uses new ones)'
    },
    {
      front: 'How do you create and run a Chart Test in Helm?',
      back: 'Chart tests are Pods with annotation `helm.sh/hook: test`.\n\nCreate `templates/tests/test-connection.yaml`:\n```yaml\napiVersion: v1\nkind: Pod\nmetadata:\n  name: "{{ include "app.fullname" . }}-test"\n  annotations:\n    "helm.sh/hook": test\nspec:\n  restartPolicy: Never\n  containers:\n    - name: test\n      image: busybox\n      command: [\'wget\', \'-q\', \'--spider\']\n      args: [\'http://{{ include "app.fullname" . }}\']\n```\n\nRun: `helm test myrelease`\n\nTests pass if the Pod terminates with exit code 0.'
    }
  ],

  lab: {
    scenario: 'You will create from scratch a complete Helm chart for the "techstore" application — a simple e-commerce. The chart must be parameterizable, have reusable helpers, include a pre-upgrade migration hook, and have chart tests.',
    objective: 'Master Helm chart creation: structure, templates with helpers, values, hooks, and tests.',
    duration: '30-40 minutes',
    steps: [
      {
        title: 'Scaffolding and initial structure',
        instruction: 'Create a chart called `techstore` using `helm create`, understand the generated structure, and run the initial lint.',
        hints: [
          'helm create generates a complete structure with nginx as an example',
          'helm lint checks for syntax errors and best practices',
          'Explore the generated _helpers.tpl to understand standard named templates'
        ],
        solution: `\`\`\`bash
# Create chart with default scaffold
helm create techstore

# Explore generated structure
find techstore/ -type f | sort

# Lint to check initial state (should pass without errors)
helm lint ./techstore

# Render default templates (nginx as image)
helm template myrelease ./techstore | head -60

echo "Structure created and valid. Next: customize the chart."
\`\`\``,
        verify: `\`\`\`bash
# Check essential structure
ls techstore/templates/
# Expected: _helpers.tpl  deployment.yaml  hpa.yaml  ingress.yaml  NOTES.txt  service.yaml  serviceaccount.yaml  tests/

ls techstore/
# Expected: Chart.yaml  charts/  templates/  values.yaml

helm lint ./techstore
# Expected: 1 chart(s) linted, 0 chart(s) failed
\`\`\``
      },
      {
        title: 'Customize values.yaml and Chart.yaml',
        instruction: 'Adapt the chart for the techstore application: configure relevant values and update Chart.yaml metadata.',
        hints: [
          'Edit Chart.yaml: name=techstore, version=1.0.0, appVersion="1.5.0"',
          'In values.yaml: image.repository=nginx, replicaCount=2, service.port=8080',
          'Add an `app` block with `env: production` and `debug: false`'
        ],
        solution: `\`\`\`bash
# Update Chart.yaml
cat > techstore/Chart.yaml << 'EOF'
apiVersion: v2
name: techstore
description: E-commerce Techstore Helm Chart
type: application
version: 1.0.0
appVersion: "1.5.0"
EOF

# Update values.yaml with techstore values
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

# Verify lint after changes
helm lint ./techstore
\`\`\``,
        verify: `\`\`\`bash
# Check Chart.yaml
grep "appVersion" techstore/Chart.yaml
# Expected: appVersion: "1.5.0"

grep "replicaCount" techstore/values.yaml
# Expected: replicaCount: 2

helm lint ./techstore
# Expected: 1 chart(s) linted, 0 chart(s) failed
\`\`\``
      },
      {
        title: 'Add template with app environment variables',
        instruction: 'Modify the Deployment to inject the `app` block configuration from values.yaml as environment variables in the container.',
        hints: [
          'Edit templates/deployment.yaml and add an env: block to the container',
          'Use {{ .Values.app.env }}, {{ .Values.app.debug | quote }}, {{ .Values.app.logLevel }}',
          'Use {{ .Values.service.targetPort }} in containerPort'
        ],
        solution: `\`\`\`bash
# Create customized deployment with env vars
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

# Render and verify
helm template myrelease ./techstore --show-only templates/deployment.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verify that env vars appear in the rendered template
helm template myrelease ./techstore --show-only templates/deployment.yaml | grep -A10 "env:"
# Expected: APP_ENV, APP_DEBUG, LOG_LEVEL

# Final lint
helm lint ./techstore
# Expected: 0 errors

# Check replicas
helm template myrelease ./techstore --show-only templates/deployment.yaml | grep "replicas:"
# Expected: replicas: 2
\`\`\``
      },
      {
        title: 'Create pre-upgrade migration hook',
        instruction: 'Add a Job that runs before each upgrade to simulate a database migration.',
        hints: [
          'Create templates/hooks/pre-upgrade-migration.yaml',
          'Use annotation "helm.sh/hook": pre-upgrade',
          'Add hook-delete-policy: hook-succeeded for automatic cleanup'
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

# Verify lint
helm lint ./techstore

# Confirm hook in render
helm template myrelease ./techstore --show-only templates/hooks/pre-upgrade-migration.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verify hook annotations
helm template myrelease ./techstore --show-only templates/hooks/pre-upgrade-migration.yaml | grep "helm.sh/hook"
# Expected: "helm.sh/hook": pre-upgrade

# Verify hook-delete-policy
helm template myrelease ./techstore --show-only templates/hooks/pre-upgrade-migration.yaml | grep "hook-delete-policy"
# Expected: before-hook-creation,hook-succeeded

helm lint ./techstore
# Expected: 0 chart(s) failed
\`\`\``
      },
      {
        title: 'Install and test the chart in the cluster',
        instruction: 'Install the chart in the local cluster, verify the created resources, and test the upgrade with a values change.',
        hints: [
          'Use --create-namespace to create the namespace automatically',
          'helm upgrade --install is idempotent (install or upgrade depending on state)',
          'Test overriding replicaCount via --set'
        ],
        solution: `\`\`\`bash
# Install in dedicated namespace
helm install techstore-dev ./techstore \
  --namespace techstore \
  --create-namespace \
  --set app.env=development

# Verify release
helm list -n techstore
kubectl get all -n techstore

# Simulate upgrade with replica change
helm upgrade techstore-dev ./techstore \
  --namespace techstore \
  --set replicaCount=3 \
  --set app.env=staging

# Verify rollout
kubectl rollout status deployment -n techstore

# Release history
helm history techstore-dev -n techstore

# Cleanup
helm uninstall techstore-dev -n techstore
kubectl delete namespace techstore
\`\`\``,
        verify: `\`\`\`bash
# Verify installed release
helm list -n techstore
# Expected: techstore-dev  techstore  1  DEPLOYED  techstore-1.0.0

# Verify Deployment
kubectl get deployment -n techstore
# Expected: techstore-dev-techstore  READY 2/2

# After upgrade
kubectl get deployment -n techstore -o jsonpath='{.items[0].spec.replicas}'
# Expected: 3
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Template rendering: "Error: YAML parse error" after adding toYaml',
      difficulty: 'medium',
      symptom: 'helm install fails with "Error: YAML parse error on templates/deployment.yaml: mapping values are not allowed in this context" when adding a resources block to the Deployment.',
      diagnosis: `\`\`\`bash
# Reproduce the error with template
helm template myapp ./chart --show-only templates/deployment.yaml

# Inspect the malformed output
# The error is usually in incorrect indentation after toYaml

# View the problematic template
cat chart/templates/deployment.yaml | grep -A3 "resources"
# Typical problem:
# resources:
# limits:          ← no indentation
#   cpu: 100m
\`\`\``,
      solution: `**Cause**: \`toYaml\` generates YAML without indentation relative to context. Without \`nindent\`, the content stays at column 0, breaking the manifest YAML.

**Problem**:
\`\`\`yaml
resources: {{ toYaml .Values.resources }}    # ← wrong
\`\`\`

**Solution**:
\`\`\`yaml
resources:
  {{- toYaml .Values.resources | nindent 10 }}   # ← correct for nested in container (2+2+4+2=10)
\`\`\`

Or in block syntax:
\`\`\`yaml
          resources:
            {{- toYaml .Values.resources | nindent 12 }}   # 12 spaces = block level
\`\`\`

**Rule**: count the indentation spaces of the parent key and add 2. If \`resources:\` is at 10 spaces, the content goes at 12 → \`nindent 12\`.`
    },
    {
      title: 'helm upgrade fails: "cannot patch Deployment, field is immutable"',
      difficulty: 'hard',
      symptom: 'After modifying _helpers.tpl to add new labels to selectorLabels, helm upgrade fails with: "cannot patch \\"my-deployment\\": Resource spec.selector: Invalid value: ... field is immutable".',
      diagnosis: `\`\`\`bash
# Check what changed in the labels
helm get manifest myrelease -n myns | grep -A5 "selector:"

# Compare with the new render
helm template myrelease ./chart --show-only templates/deployment.yaml | grep -A5 "selector:"

# See which label was added
diff <(helm get manifest myrelease | grep -A5 "matchLabels") \
     <(helm template myrelease ./chart | grep -A5 "matchLabels")
\`\`\``,
      solution: `**Cause**: \`spec.selector.matchLabels\` in Deployments is immutable after creation. Adding any label to \`selectorLabels\` breaks upgrades.

**Solutions in order of impact**:

1. **Revert the change** in selectorLabels (keep only: \`app.kubernetes.io/name\` and \`app.kubernetes.io/instance\`).

2. **Delete and recreate** the Deployment (causes brief downtime):
\`\`\`bash
kubectl delete deployment myrelease-myapp -n myns
helm upgrade myrelease ./chart -n myns
\`\`\`

3. **helm upgrade with --force** (deletes and recreates the resource):
\`\`\`bash
helm upgrade myrelease ./chart -n myns --force
\`\`\`

**Prevention**: in _helpers.tpl, always separate:
- \`my-app.labels\` → full labels (version, chart, managed-by)
- \`my-app.selectorLabels\` → ONLY name and instance → **never add fields here**

The selector uses \`selectorLabels\`; metadata.labels uses \`labels\`.`
    }
  ]
};
