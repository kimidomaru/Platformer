window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['helm/helm-advanced'] = {
  theory: `# Advanced Helm: OCI, Library Charts, Subcharts & CI/CD

## Relevance
> Advanced Helm mastery is the differentiator between junior and senior DevOps. OCI registry, library charts, and CI/CD integration are tested in platform engineering technical interviews.

## OCI Registry — Helm Without Chart Museum

Starting with Helm 3.8+, charts can be stored in OCI registries (same infrastructure as Docker images):

\`\`\`bash
# Login to OCI registry
helm registry login registry.example.com --username user --password-stdin

# Package the chart
helm package ./my-chart          # generates my-chart-1.0.0.tgz

# Push to OCI registry
helm push my-chart-1.0.0.tgz oci://registry.example.com/charts

# Install from OCI registry
helm install myapp oci://registry.example.com/charts/my-chart --version 1.0.0

# Pull (download without installing)
helm pull oci://registry.example.com/charts/my-chart --version 1.0.0

# List versions in OCI registry (via oras CLI)
oras repo tags registry.example.com/charts/my-chart
\`\`\`

**OCI Advantages**: same registry infrastructure (Harbor, ECR, GCR, ACR), no separate chart museum, native authentication and RBAC support.

## Library Charts

Library charts provide templates and helpers **without creating Kubernetes resources**. They are reused as dependencies:

\`\`\`yaml
# my-lib/Chart.yaml
apiVersion: v2
name: my-lib
type: library          # ← type library, not application
version: 0.1.0
\`\`\`

\`\`\`yaml
# my-lib/templates/_labels.tpl
{{- define "my-lib.standardLabels" -}}
app.kubernetes.io/name: {{ .Values.name }}
app.kubernetes.io/version: {{ .Chart.AppVersion }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
environment: {{ .Values.environment | default "production" }}
{{- end }}

{{- define "my-lib.containerResources" -}}
resources:
  requests:
    cpu: {{ .cpu.requests | default "100m" }}
    memory: {{ .memory.requests | default "128Mi" }}
  limits:
    cpu: {{ .cpu.limits | default "200m" }}
    memory: {{ .memory.limits | default "256Mi" }}
{{- end }}
\`\`\`

\`\`\`yaml
# app-chart/Chart.yaml — consuming the library
dependencies:
  - name: my-lib
    version: "0.1.x"
    repository: oci://registry.example.com/charts
\`\`\`

\`\`\`yaml
# app-chart/templates/deployment.yaml — using library helpers
metadata:
  labels:
    {{- include "my-lib.standardLabels" . | nindent 4 }}
\`\`\`

## Subcharts & Dependencies

Subcharts are full charts included as dependencies:

\`\`\`yaml
# Chart.yaml
dependencies:
  - name: postgresql
    version: "12.x.x"
    repository: https://charts.bitnami.com/bitnami
    condition: postgresql.enabled        # enable/disable via values
    alias: db                            # alternative name in values

  - name: redis
    version: "17.x.x"
    repository: https://charts.bitnami.com/bitnami
    condition: redis.enabled
    tags:                                # enable/disable by tag
      - caching
\`\`\`

\`\`\`yaml
# values.yaml — subchart configuration
postgresql:
  enabled: true
  auth:
    database: myapp
    username: appuser
    existingSecret: "postgres-secret"

redis:
  enabled: false

# Tags (alternative to condition)
tags:
  caching: false
\`\`\`

\`\`\`bash
# Download dependencies into charts/
helm dependency update ./my-chart

# List dependencies and status
helm dependency list ./my-chart

# Build without downloading (uses what is already in charts/)
helm dependency build ./my-chart
\`\`\`

## Values Schema Validation

\`\`\`json
{
  "$schema": "http://json-schema.org/draft-07/schema",
  "type": "object",
  "required": ["image", "service"],
  "properties": {
    "replicaCount": {
      "type": "integer",
      "minimum": 1,
      "maximum": 20,
      "description": "Number of Deployment replicas"
    },
    "image": {
      "type": "object",
      "required": ["repository"],
      "properties": {
        "repository": { "type": "string" },
        "tag": { "type": "string" },
        "pullPolicy": {
          "type": "string",
          "enum": ["Always", "IfNotPresent", "Never"]
        }
      }
    },
    "service": {
      "type": "object",
      "properties": {
        "type": { "type": "string", "enum": ["ClusterIP", "NodePort", "LoadBalancer"] },
        "port": { "type": "integer", "minimum": 1, "maximum": 65535 }
      }
    }
  }
}
\`\`\`

\`\`\`bash
# Schema is automatically validated on helm install/upgrade
helm install myapp ./chart --set replicaCount=100
# Error: replicaCount must be <= 20
\`\`\`

## Helm in CI/CD

\`\`\`yaml
# .github/workflows/deploy.yml
name: Deploy with Helm
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Helm
        uses: azure/setup-helm@v3
        with:
          version: '3.14.0'

      - name: Lint Chart
        run: helm lint ./chart

      - name: Render & Validate
        run: |
          helm template myapp ./chart \
            -f values-staging.yaml \
            | kubectl apply --dry-run=server -f -

      - name: Package & Push to OCI
        run: |
          helm package ./chart
          helm registry login \${{ env.REGISTRY }} --username \${{ secrets.USER }} --password \${{ secrets.TOKEN }}
          helm push chart-*.tgz oci://\${{ env.REGISTRY }}/charts

      - name: Deploy to Staging
        run: |
          helm upgrade --install myapp ./chart \
            --namespace staging \
            --create-namespace \
            -f values-staging.yaml \
            --wait \
            --timeout 5m
\`\`\`

## Common Mistakes

1. **helm dependency update not executed**: after adding a dependency in Chart.yaml, forgetting to run dependency update → chart not found.
2. **Values conflict in subcharts**: parent and subchart values can conflict. Use alias to separate them.
3. **Library chart without type: library**: without this field, library templates are rendered as invalid manifests.
4. **JSON Schema too restrictive**: a schema that restricts values needed in CI blocks deployments.
`,

  quiz: [
    {
      question: 'What distinguishes a "library" chart from an "application" chart in Helm?',
      options: [
        'Library charts have more templates than application charts',
        'Library charts provide only named templates and helpers, without generating Kubernetes resources; application charts generate resources',
        'Library charts only work with Helm 2; application charts with Helm 3',
        'Library charts are installed automatically; application charts require helm install'
      ],
      correct: 1,
      explanation: 'A chart of type library (type: library in Chart.yaml) contains only support templates (defined templates in _helpers.tpl) that are reused by other charts as a dependency. Unlike application charts, a library chart cannot be installed directly — it serves as a "library" of shared Helm functions across multiple charts in the organization.',
      reference: 'Library Charts section — understand how to use library charts to share labels, resources, and other helpers between charts.'
    },
    {
      question: 'What is the advantage of using an OCI registry to store Helm charts instead of a dedicated Chart Museum?',
      options: [
        'OCI is faster for downloading large charts',
        'It reuses the existing image registry infrastructure (Harbor, ECR, GCR) without an additional server',
        'OCI registry has automatic versioning that Chart Museum does not have',
        'Only OCI registry supports chart signing'
      ],
      correct: 1,
      explanation: 'OCI registry allows charts to be stored in the same Docker image registry already used by the organization (Harbor, ECR, ACR, GCR). This eliminates the need to operate a separate Chart Museum, leverages existing authentication and RBAC, and integrates naturally with CI/CD pipelines that already push images.',
      reference: 'OCI Registry section — helm push/pull uses the same protocol as docker push/pull for images.'
    },
    {
      question: 'How do you use `values.schema.json` in Helm and what is its effect?',
      options: [
        'It defines the version of the Kubernetes API schema used in the chart',
        'It automatically validates the values provided during helm install/upgrade against a JSON Schema',
        'It documents available values but does not block installations',
        'It automatically generates values.yaml from defined types'
      ],
      correct: 1,
      explanation: 'The values.schema.json file at the chart root defines a JSON Schema that is automatically validated during helm install, upgrade, and lint. If the provided values violate the schema (wrong type, value out of range, missing required field), Helm fails with a clear error message. It is essential for library charts that need to ensure correct configuration.',
      reference: 'Values Schema Validation section — use required, enum, and minimum/maximum to validate critical configs.'
    },
    {
      question: 'What command must be run after adding a dependency in Chart.yaml?',
      options: [
        'helm install --update-deps',
        'helm dependency update',
        'helm fetch dependencies',
        'helm chart download'
      ],
      correct: 1,
      explanation: 'helm dependency update downloads the subcharts listed in Chart.yaml into the charts/ directory and generates/updates Chart.lock. Without running this command after adding or changing dependencies, helm install fails with "chart not found". In CI/CD, dependency update is typically run before lint and template.',
      reference: 'Subcharts & Dependencies section — always run dependency update after changes to Chart.yaml.'
    },
    {
      question: 'How do you conditionally enable/disable a subchart (e.g., postgresql) via values.yaml?',
      options: [
        'Remove the subchart from Chart.yaml when not needed',
        'Use the "condition" field in Chart.yaml pointing to a boolean value',
        'Add a "helm.sh/enabled: false" annotation to the subchart',
        'Create a .helmignore file that excludes the subchart'
      ],
      correct: 1,
      explanation: 'In Chart.yaml, the field condition: postgresql.enabled makes Helm install the subchart only when .Values.postgresql.enabled=true. The tags: field allows grouping multiple subcharts and enabling them together via .Values.tags.name=true. This enables a single chart with optional components without duplication.',
      reference: 'Subcharts & Dependencies section — condition and tags are complementary mechanisms for subchart control.'
    }
  ],

  flashcards: [
    {
      front: 'How do you push a chart to an OCI registry?',
      back: '```bash\n# 1. Package\nhelm package ./my-chart\n# Generates: my-chart-1.0.0.tgz\n\n# 2. Login\nhelm registry login registry.example.com \\\n  --username user --password token\n\n# 3. Push\nhelm push my-chart-1.0.0.tgz \\\n  oci://registry.example.com/charts\n\n# 4. Install from OCI\nhelm install myapp \\\n  oci://registry.example.com/charts/my-chart \\\n  --version 1.0.0\n```\n\nNote: the URL starts with `oci://` instead of `https://`.'
    },
    {
      front: 'How do you share Helm helpers across multiple charts using library charts?',
      back: '**1. Create library chart** (`type: library` in Chart.yaml)\n\n**2. Add templates to _helpers.tpl** using `{{- define "lib.name" -}}`\n\n**3. Consumer declares dependency**:\n```yaml\n# Consumer Chart.yaml\ndependencies:\n  - name: my-lib\n    version: "0.1.x"\n    repository: oci://registry/charts\n```\n\n**4. Run**: `helm dependency update`\n\n**5. Use in consumer**: `{{- include "my-lib.labels" . | nindent 4 }}`\n\nLibrary charts cannot be installed directly — only as a dependency.'
    },
    {
      front: 'How do you validate values with JSON Schema in Helm?',
      back: 'Create `values.schema.json` at the chart root:\n```json\n{\n  "$schema": "http://json-schema.org/draft-07/schema",\n  "type": "object",\n  "required": ["image"],\n  "properties": {\n    "replicaCount": {\n      "type": "integer",\n      "minimum": 1,\n      "maximum": 20\n    },\n    "image": {\n      "type": "object",\n      "required": ["repository"]\n    }\n  }\n}\n```\n\nAutomatic validation on `helm install`, `upgrade`, and `lint`.\nInvalid value → error before touching the cluster.'
    }
  ],

  lab: {
    scenario: 'Create a library chart with standardized helpers and consume it in an application chart.',
    objective: 'Master library charts and dependency management in Helm.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create the library chart',
        instruction: 'Create a library chart called `company-lib` with a standardized labels helper.',
        hints: ['type: library in Chart.yaml', 'Helpers in templates/_labels.tpl'],
        solution: `\`\`\`bash
helm create company-lib
# Change type to library in Chart.yaml
sed -i 's/type: application/type: library/' company-lib/Chart.yaml

# Remove unnecessary templates (library does not generate resources)
rm -rf company-lib/templates/*.yaml company-lib/templates/tests/

# Create helper
cat > company-lib/templates/_labels.tpl << 'EOF'
{{- define "company-lib.commonLabels" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
company.io/team: platform
{{- end }}
EOF

# Package the library
helm package ./company-lib
\`\`\``,
        verify: `\`\`\`bash
grep "type: library" company-lib/Chart.yaml
# Expected: type: library

ls company-lib-*.tgz
# Expected: company-lib-0.1.0.tgz

helm lint ./company-lib
# Expected: 0 chart(s) failed
\`\`\``
      },
      {
        title: 'Create application chart that uses the library',
        instruction: 'Create an application chart `webapp` that declares the library as a dependency and uses its helpers.',
        hints: ['Copy the library .tgz to charts/', 'Reference with repository: file://../company-lib'],
        solution: `\`\`\`bash
helm create webapp

# Add dependency in Chart.yaml
cat >> webapp/Chart.yaml << 'EOF'

dependencies:
  - name: company-lib
    version: "0.1.0"
    repository: "file://../company-lib"
EOF

# Update dependencies (copies the tgz to charts/)
helm dependency update ./webapp

# Use the helper in the deployment
# Edit webapp/templates/deployment.yaml and replace labels with:
# labels:
#   {{- include "company-lib.commonLabels" . | nindent 4 }}

helm template myapp ./webapp --show-only templates/deployment.yaml
\`\`\``,
        verify: `\`\`\`bash
ls webapp/charts/
# Expected: company-lib-0.1.0.tgz

helm template myapp ./webapp | grep "company.io/team"
# Expected: company.io/team: platform

helm lint ./webapp
# Expected: 0 chart(s) failed
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Dependency not found after adding to Chart.yaml',
      difficulty: 'easy',
      symptom: 'helm install fails with "Error: found in Chart.yaml, but missing in charts/ directory: postgresql".',
      diagnosis: `\`\`\`bash
# Check Chart.lock
cat Chart.lock

# Check the charts/ directory
ls charts/

# Try dependency update
helm dependency update . 2>&1
\`\`\``,
      solution: `**Cause**: after adding a dependency in Chart.yaml, running \`helm dependency update\` is mandatory to download the subchart.

\`\`\`bash
# Solution
helm dependency update ./my-chart

# Verify result
helm dependency list ./my-chart
# Expected: postgresql  12.x.x  OK

# Now install works
helm install myapp ./my-chart
\`\`\`

In CI/CD, always add \`helm dependency update\` before \`helm install\` or \`helm lint\`.`
    }
  ]
};
