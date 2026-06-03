window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['app-deployment/helm'] = {
  theory: `# Helm — Kubernetes Package Manager

## Exam Relevance
> Helm appears in CKAD and is increasingly relevant for CKA. Expect tasks like installing a chart, upgrading a release, rolling back, and inspecting release values. Understanding chart structure is essential.

## Core Concepts

**Helm** is the package manager for Kubernetes. It packages Kubernetes manifests into reusable, versioned units called **Charts**.

### Key Terminology
| Term | Description |
|------|-------------|
| **Chart** | A package of Kubernetes resource templates |
| **Release** | An instance of a chart deployed to a cluster |
| **Repository** | A collection of charts (like a Docker registry) |
| **Values** | Configuration that customizes a chart |
| **Revision** | A versioned snapshot of a release |

### Chart Structure
\`\`\`
mychart/
├── Chart.yaml          # Chart metadata (name, version, description)
├── values.yaml         # Default configuration values
├── templates/          # Kubernetes manifest templates
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── _helpers.tpl    # Template helpers (partial templates)
│   └── NOTES.txt       # Post-install instructions
├── charts/             # Chart dependencies
└── .helmignore         # Files to ignore when packaging
\`\`\`

### Chart.yaml Example
\`\`\`yaml
apiVersion: v2
name: myapp
description: A sample Helm chart
type: application     # or "library"
version: 0.1.0        # Chart version (SemVer)
appVersion: "1.16.0"  # App version being packaged
\`\`\`

## Essential Commands

\`\`\`bash
# Add a repository
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# Search for charts
helm search repo nginx
helm search hub wordpress    # search Artifact Hub

# Install a chart
helm install my-release bitnami/nginx
helm install my-release bitnami/nginx --namespace prod --create-namespace
helm install my-release bitnami/nginx --set replicaCount=3
helm install my-release bitnami/nginx -f custom-values.yaml

# List releases
helm list
helm list --all-namespaces

# Inspect a release
helm status my-release
helm get values my-release
helm get manifest my-release

# Upgrade a release
helm upgrade my-release bitnami/nginx --set image.tag=1.21
helm upgrade my-release bitnami/nginx -f updated-values.yaml

# Rollback
helm rollback my-release 1     # rollback to revision 1
helm history my-release        # show all revisions

# Uninstall
helm uninstall my-release

# Template rendering (dry-run)
helm template my-release bitnami/nginx
helm install my-release bitnami/nginx --dry-run --debug
\`\`\`

## Values Override

Values are merged in this priority order (highest wins):
1. \`--set\` flags (CLI)
2. \`-f\` custom values files
3. \`values.yaml\` in the chart

\`\`\`bash
# --set supports nested values with dot notation
helm install app bitnami/nginx \\
  --set service.type=LoadBalancer \\
  --set replicaCount=2 \\
  --set image.tag=1.21

# Multiple --set values
helm install app bitnami/nginx \\
  --set "resources.requests.cpu=100m" \\
  --set "resources.requests.memory=128Mi"
\`\`\`

### Custom values.yaml
\`\`\`yaml
# custom-values.yaml
replicaCount: 3
image:
  tag: "1.21"
service:
  type: LoadBalancer
  port: 80
resources:
  requests:
    cpu: 100m
    memory: 128Mi
\`\`\`

## Helm Template Syntax

\`\`\`yaml
# templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Release.Name }}-nginx
  labels:
    app: {{ .Chart.Name }}
    release: {{ .Release.Name }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      app: {{ .Release.Name }}
  template:
    spec:
      containers:
      - name: nginx
        image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
        {{- if .Values.resources }}
        resources:
          {{- toYaml .Values.resources | nindent 10 }}
        {{- end }}
\`\`\`

**Built-in Objects:**
- \`.Release.Name\` — release name
- \`.Release.Namespace\` — namespace
- \`.Release.IsInstall\` / \`.Release.IsUpgrade\`
- \`.Chart.Name\` / \`.Chart.Version\`
- \`.Values\` — values from values.yaml + overrides

## Lifecycle Hooks

\`\`\`yaml
# templates/job-migration.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: {{ .Release.Name }}-db-migrate
  annotations:
    "helm.sh/hook": pre-upgrade        # runs before upgrade
    "helm.sh/hook-weight": "-5"        # execution order
    "helm.sh/hook-delete-policy": before-hook-creation
\`\`\`

**Hook types:** \`pre-install\`, \`post-install\`, \`pre-upgrade\`, \`post-upgrade\`, \`pre-delete\`, \`post-delete\`, \`pre-rollback\`, \`post-rollback\`

## Common Errors

- **"release already exists"**: Use \`helm upgrade --install\` to install or upgrade idempotently
- **"rendered manifests contain a resource that already exists"**: Another tool deployed the same resource; delete it first or use \`--force\`
- **"values.yaml not found"**: Check working directory when using \`-f\` flag
- **Chart version vs App version confusion**: \`Chart.yaml version\` is the chart version; \`appVersion\` is the deployed app version

## Killer.sh Style Challenge

You have a chart at \`/opt/charts/webapp\`. Install it as release \`prod-app\` in namespace \`production\`, overriding the service type to \`NodePort\` and setting replicas to 5. Then simulate an upgrade that changes the image tag to \`v2.0\` without actually deploying it.
`,
  quiz: [
    {
      question: 'What is a Helm "release"?',
      options: [
        'A versioned instance of a chart deployed to the cluster',
        'The latest version of a Helm chart in a repository',
        'A Git tag for a Helm chart repository',
        'The output of helm template command'
      ],
      correct: 0,
      explanation: 'A release is a specific deployment of a Helm chart. You can have multiple releases from the same chart (e.g., prod-nginx and staging-nginx).',
      reference: 'Review "Core Concepts" section — Key Terminology table.'
    },
    {
      question: 'Which command upgrades an existing release AND installs it if it does not exist?',
      options: [
        'helm upgrade --install my-release bitnami/nginx',
        'helm install --upgrade my-release bitnami/nginx',
        'helm apply my-release bitnami/nginx',
        'helm deploy --upsert my-release bitnami/nginx'
      ],
      correct: 0,
      explanation: 'helm upgrade --install is the idempotent form that installs if not present or upgrades if already deployed. This is the recommended pattern for CI/CD pipelines.',
      reference: 'Review "Essential Commands" section — Upgrade a release.'
    },
    {
      question: 'In what order are Helm values merged (highest priority first)?',
      options: [
        '--set flags > -f custom files > chart values.yaml',
        'chart values.yaml > -f custom files > --set flags',
        '-f custom files > --set flags > chart values.yaml',
        'chart values.yaml > --set flags > -f custom files'
      ],
      correct: 0,
      explanation: '--set flags have the highest priority, overriding -f files, which in turn override the chart\'s default values.yaml.',
      reference: 'Review "Values Override" section — priority order list.'
    },
    {
      question: 'Which built-in Helm template object provides access to user-supplied configuration?',
      options: [
        '.Values',
        '.Config',
        '.Inputs',
        '.Params'
      ],
      correct: 0,
      explanation: '.Values accesses data from the chart\'s values.yaml merged with any --set or -f overrides at deploy time.',
      reference: 'Review "Helm Template Syntax" section — Built-in Objects.'
    },
    {
      question: 'What does "helm rollback my-release 1" do?',
      options: [
        'Rolls back the release to revision 1',
        'Rolls back the last 1 revision (goes back one step)',
        'Creates a new revision labeled "1"',
        'Deletes all revisions after revision 1'
      ],
      correct: 0,
      explanation: 'The number after rollback is the specific revision number to roll back to, not a count. Use "helm history my-release" to see all revision numbers.',
      reference: 'Review "Essential Commands" section — Rollback.'
    },
    {
      question: 'Which file in a Helm chart contains the chart\'s name, version, and description?',
      options: [
        'Chart.yaml',
        'values.yaml',
        'metadata.yaml',
        '_helpers.tpl'
      ],
      correct: 0,
      explanation: 'Chart.yaml is the required metadata file for every chart. It contains name, version, apiVersion, description, and appVersion.',
      reference: 'Review "Chart Structure" section — Chart.yaml Example.'
    },
    {
      question: 'What is the purpose of the "helm template" command?',
      options: [
        'Renders chart templates to stdout without deploying',
        'Creates a new chart template from scratch',
        'Validates chart templates against the cluster API',
        'Uploads the chart to a repository'
      ],
      correct: 0,
      explanation: 'helm template renders the chart manifests locally (without connecting to a cluster) so you can inspect exactly what would be deployed. Useful for debugging and GitOps.',
      reference: 'Review "Essential Commands" — Template rendering (dry-run).'
    },
    {
      question: 'A pre-upgrade hook runs at which point in the Helm lifecycle?',
      options: [
        'Before the upgrade resources are applied to the cluster',
        'Before the chart is downloaded from the repository',
        'After the upgrade but before the release is marked successful',
        'On every helm upgrade --dry-run call'
      ],
      correct: 0,
      explanation: 'pre-upgrade hooks run after helm upgrade is called but before the new manifests are applied. Commonly used for database migrations or backup jobs.',
      reference: 'Review "Lifecycle Hooks" section.'
    }
  ],
  flashcards: [
    {
      front: 'What are the 4 core Helm concepts?',
      back: 'Chart (package), Release (deployed instance), Repository (chart storage), Values (configuration).'
    },
    {
      front: 'What is the difference between chart version and appVersion in Chart.yaml?',
      back: 'version is the Helm chart version (when the chart itself changed). appVersion is the version of the application packaged in the chart (e.g., nginx 1.21).'
    },
    {
      front: 'How do you render templates without deploying?',
      back: 'helm template <release> <chart> — renders to stdout locally. Or helm install ... --dry-run --debug to simulate against the cluster API.'
    },
    {
      front: 'What does --set "a.b=x" do when installing a Helm chart?',
      back: 'Sets a nested value: equivalent to YAML key a: { b: x }. It overrides the chart\'s values.yaml and any -f files.'
    },
    {
      front: 'What is helm upgrade --install used for?',
      back: 'Idempotent deploy: installs the chart if the release doesn\'t exist, upgrades it if it does. Standard pattern for CI/CD pipelines.'
    },
    {
      front: 'How do you see all revisions of a Helm release and roll back?',
      back: 'helm history <release> to see all revisions. helm rollback <release> <revision-number> to roll back to a specific version.'
    },
    {
      front: 'What is the purpose of _helpers.tpl in a Helm chart?',
      back: 'Defines reusable named templates (partials) using {{- define "name" }} blocks. Called with {{- include "name" . | indent N }} in other templates.'
    },
    {
      front: 'What annotation triggers a Helm lifecycle hook?',
      back: '"helm.sh/hook": <hook-type> — e.g., pre-install, post-upgrade. Hooks are Kubernetes Jobs, Pods, or other resources run at specific lifecycle points.'
    }
  ],
  lab: {
    scenario: 'Your team needs to deploy a production nginx application using Helm. You\'ll add a repository, install a release with custom values, upgrade it, and practice rollback.',
    objective: 'Learn the full Helm release lifecycle: install, inspect, upgrade, rollback, and uninstall.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Add repository and install a release',
        instruction: `Add the Bitnami Helm repository and install nginx as release \`prod-nginx\` in namespace \`web\`, setting replicas to 2 and service type to ClusterIP.`,
        hints: [
          'Use helm repo add and helm repo update first',
          'Use --create-namespace flag with -n to create the namespace automatically',
          'Use --set replicaCount=2 --set service.type=ClusterIP'
        ],
        solution: `\`\`\`bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

helm install prod-nginx bitnami/nginx \\
  --namespace web \\
  --create-namespace \\
  --set replicaCount=2 \\
  --set service.type=ClusterIP
\`\`\``,
        verify: `\`\`\`bash
helm list -n web
# Expected: prod-nginx   web   1   DEPLOYED   nginx-...

helm status prod-nginx -n web
# Expected: STATUS: deployed

kubectl get pods -n web
# Expected: 2 pods running prod-nginx-*

kubectl get svc -n web
# Expected: ClusterIP service for prod-nginx
\`\`\``
      },
      {
        title: 'Inspect and upgrade the release',
        instruction: `Check the current values of \`prod-nginx\`, then upgrade it to use 3 replicas and add a resource limit of 128Mi memory. Use \`helm upgrade\`.`,
        hints: [
          'Use helm get values prod-nginx -n web to see current values',
          'Use helm upgrade prod-nginx bitnami/nginx -n web --set ...',
          'You can chain multiple --set flags in one command'
        ],
        solution: `\`\`\`bash
# Inspect current values
helm get values prod-nginx -n web

# Upgrade with new values
helm upgrade prod-nginx bitnami/nginx \\
  --namespace web \\
  --set replicaCount=3 \\
  --set "resources.limits.memory=128Mi" \\
  --reuse-values
\`\`\``,
        verify: `\`\`\`bash
helm history prod-nginx -n web
# Expected: 2 revisions — SUPERSEDED and DEPLOYED

kubectl get pods -n web
# Expected: 3 pods running prod-nginx-*

helm get values prod-nginx -n web
# Expected: shows replicaCount: 3
\`\`\``
      },
      {
        title: 'Rollback to previous revision',
        instruction: `Roll back \`prod-nginx\` to revision 1. Verify the rollback created a new revision (not reverting to the old one in-place).`,
        hints: [
          'Use helm history prod-nginx -n web to see revision numbers first',
          'Use helm rollback prod-nginx 1 -n web',
          'After rollback, helm history shows a new revision with status DEPLOYED'
        ],
        solution: `\`\`\`bash
# Check revision history
helm history prod-nginx -n web

# Rollback to revision 1
helm rollback prod-nginx 1 --namespace web

# Verify state
helm history prod-nginx -n web
kubectl get pods -n web
\`\`\``,
        verify: `\`\`\`bash
helm history prod-nginx -n web
# Expected: 3 entries — revision 3 is now DEPLOYED (rollback creates new revision)

kubectl get pods -n web
# Expected: 2 pods (back to replicaCount=2 from revision 1)

helm get values prod-nginx -n web
# Expected: replicaCount: 2 (original value)
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Release already exists error on install',
      difficulty: 'easy',
      symptom: 'Running "helm install my-app bitnami/nginx" fails with: Error: INSTALLATION FAILED: cannot re-use a name that is still in use',
      diagnosis: `\`\`\`bash
# Check if release exists
helm list -n <namespace>
helm list --all-namespaces | grep my-app

# Check release status (it may be in failed state)
helm status my-app -n <namespace>
\`\`\``,
      solution: `If the release is working: Use upgrade instead of install:
\`\`\`bash
helm upgrade my-app bitnami/nginx -n <namespace>
# Or use the idempotent form:
helm upgrade --install my-app bitnami/nginx -n <namespace>
\`\`\`

If the release is in a bad state and you want to reinstall:
\`\`\`bash
helm uninstall my-app -n <namespace>
helm install my-app bitnami/nginx -n <namespace>
\`\`\``
    },
    {
      title: 'Helm upgrade leaves pods in wrong state',
      difficulty: 'medium',
      symptom: 'After helm upgrade, pods are in CrashLoopBackOff. The helm status shows DEPLOYED but the application is broken.',
      diagnosis: `\`\`\`bash
# Check release history
helm history my-app -n production

# Check what changed between revisions
helm get manifest my-app -n production > current.yaml
helm get manifest my-app --revision 1 -n production > previous.yaml
diff previous.yaml current.yaml

# Check pod logs
kubectl get pods -n production
kubectl logs <pod-name> -n production --previous

# Check the values that were used
helm get values my-app -n production
\`\`\``,
      solution: `Roll back to the previous working revision:
\`\`\`bash
# Find the last working revision
helm history my-app -n production

# Roll back (e.g., to revision 2)
helm rollback my-app 2 -n production

# Verify pods recover
kubectl get pods -n production -w
\`\`\`

To prevent this in future: use --atomic flag on upgrade, which automatically rolls back if the upgrade fails:
\`\`\`bash
helm upgrade my-app bitnami/nginx -n production --atomic --timeout 5m
\`\`\``
    }
  ]
};
