window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['cluster-architecture/helm-kustomize'] = {
  theory: `# Helm & Kustomize — Comparison and Integration

## Exam Relevance
> CKA includes both Helm and Kustomize. Expect tasks that combine them: deploying from a Helm chart, customizing with Kustomize overlays, or using "helm template | kubectl apply". Understanding when to use each is key.

## Helm vs Kustomize

| Feature | Helm | Kustomize |
|---------|------|-----------|
| **Templating** | Go templates | No templates — pure YAML patches |
| **Packaging** | Charts (versioned, distributable) | Directory overlays |
| **Release Management** | Full lifecycle (install/upgrade/rollback/uninstall) | No release tracking |
| **Built into kubectl** | No (separate binary) | Yes (\`kubectl apply -k\`) |
| **Repository** | OCI/HTTP repos | Git repos or local dirs |
| **Best for** | 3rd-party app packages, parameterized configs | Environment overlays, GitOps, config variants |
| **Complexity** | Higher learning curve | Lower learning curve |

## Using Helm

\`\`\`bash
# Install Helm (if not available)
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Common workflow
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
helm install my-nginx bitnami/nginx -n apps --create-namespace
helm upgrade my-nginx bitnami/nginx -n apps --set replicaCount=3
helm rollback my-nginx 1 -n apps
helm uninstall my-nginx -n apps
\`\`\`

## Using Kustomize

\`\`\`bash
# Built into kubectl — no install needed
kubectl kustomize ./overlays/prod    # preview
kubectl apply -k ./overlays/prod     # apply

# Or use standalone kustomize binary
kustomize build ./overlays/prod | kubectl apply -f -
\`\`\`

## Combining Helm + Kustomize

A powerful pattern: use Helm to render a chart, then apply Kustomize patches to the output.

### Method 1: helm template | kustomize (GitOps friendly)

\`\`\`bash
# Render Helm chart to YAML
helm template my-app bitnami/nginx \\
  --set replicaCount=2 \\
  --namespace production > base-manifests.yaml

# Then apply Kustomize on top
# (reference the rendered file as a resource in kustomization.yaml)
\`\`\`

### Method 2: Kustomize helmCharts field (built-in integration)

\`\`\`yaml
# kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

helmCharts:
  - name: nginx
    repo: https://charts.bitnami.com/bitnami
    version: "15.0.0"
    releaseName: my-app
    namespace: production
    valuesFile: values.yaml
    valuesInline:
      replicaCount: 2
      service:
        type: ClusterIP

# Additional patches on top of Helm output
patches:
  - target:
      kind: Deployment
      name: my-app-nginx
    patch: |-
      - op: add
        path: /spec/template/metadata/annotations
        value:
          custom.annotation/team: "platform"
\`\`\`

\`\`\`bash
# Apply with Helm chart integration
kubectl apply -k . --enable-helm
# Or: kustomize build --enable-helm . | kubectl apply -f -
\`\`\`

## When to Use Each

### Use Helm when:
- Deploying a **3rd-party application** (nginx, postgres, prometheus)
- You need **release tracking** (what version is deployed?)
- The chart is in a **public repository**
- You need **rollback** capability at the chart level
- Multiple teams share the same chart with different values

### Use Kustomize when:
- Deploying **your own application** across environments
- You want **GitOps** with plain YAML in Git
- You need **environment-specific patches** without templates
- You want changes tracked as clean **git diffs**
- No Helm chart exists for your workload

### Use Both when:
- You install 3rd-party charts with Helm
- Then apply your organization's patches via Kustomize
- Best for platform teams managing many apps

## Practical Comparison

### The same task with Helm:
\`\`\`bash
# Deploy nginx with custom replicas
helm install my-nginx bitnami/nginx \\
  --set replicaCount=3 \\
  --namespace production
\`\`\`

### The same task with Kustomize:
\`\`\`yaml
# base/deployment.yaml exists
# overlays/prod/kustomization.yaml:
resources:
  - ../../base
patches:
  - target:
      kind: Deployment
      name: nginx
    patch: |-
      - op: replace
        path: /spec/replicas
        value: 3
\`\`\`
\`\`\`bash
kubectl apply -k overlays/prod -n production
\`\`\`

## Key Exam Scenarios

**Scenario 1: Install from Helm chart**
\`\`\`bash
helm install my-db bitnami/postgresql \\
  --namespace database \\
  --create-namespace \\
  --set auth.postgresPassword=secret
\`\`\`

**Scenario 2: Apply Kustomize overlay**
\`\`\`bash
kubectl apply -k /opt/manifests/overlays/staging
\`\`\`

**Scenario 3: Use helm template for GitOps**
\`\`\`bash
helm template my-app ./charts/myapp \\
  -f values-prod.yaml \\
  --namespace production > k8s/manifests/rendered.yaml
# Then commit rendered.yaml to Git for GitOps
\`\`\`

## Common Errors

- **"helm: command not found"**: Helm is not in PATH; install or check PATH
- **"--enable-helm flag unknown"**: Your kubectl version doesn't support it; use kustomize binary directly
- **Kustomize patch fails on Helm output**: Resource names in Helm output include release name prefix (e.g., my-nginx-nginx vs nginx)
- **Values file not found**: Check working directory when using \`-f values.yaml\`

## Killer.sh Style Challenge

A Helm chart exists at \`/opt/charts/webapp\`. A Kustomize overlay at \`/opt/kustomize/prod\` should apply on top. Render the Helm chart to \`/tmp/webapp-base.yaml\` using values from \`/opt/charts/webapp/values-prod.yaml\`, then apply the Kustomize overlay that references this file.
`,
  quiz: [
    {
      question: 'Which tool is built directly into kubectl and requires no separate installation?',
      options: [
        'Kustomize',
        'Helm',
        'Both Helm and Kustomize',
        'Neither — both require separate installation'
      ],
      correct: 0,
      explanation: 'Kustomize is built into kubectl since v1.14. kubectl apply -k works out of the box. Helm requires a separate binary installation.',
      reference: 'Review "Helm vs Kustomize" comparison table.'
    },
    {
      question: 'What does "helm template" produce?',
      options: [
        'Rendered Kubernetes manifests to stdout (without deploying)',
        'A new blank chart template',
        'A diff between the current release and the new chart version',
        'A Kustomize-compatible overlay directory'
      ],
      correct: 0,
      explanation: 'helm template renders the chart\'s Go templates with the given values to plain Kubernetes YAML. Nothing is deployed — the output goes to stdout. Used for GitOps and debugging.',
      reference: 'Review "Combining Helm + Kustomize" — Method 1.'
    },
    {
      question: 'What is the main advantage of Kustomize over Helm for GitOps workflows?',
      options: [
        'Kustomize produces clean YAML diffs in Git without template syntax',
        'Kustomize has better rollback support than Helm',
        'Kustomize supports more complex parameterization than Helm',
        'Kustomize has a larger ecosystem of pre-built packages'
      ],
      correct: 0,
      explanation: 'Kustomize overlays are plain YAML patches. In Git, changes look like clean YAML diffs. Helm templates contain {{}} syntax that makes diffs harder to read.',
      reference: 'Review "When to Use Each" — Use Kustomize when.'
    },
    {
      question: 'How do you enable Helm chart support in a kustomization.yaml?',
      options: [
        'Use the helmCharts: field and apply with --enable-helm flag',
        'Use the charts: field in kustomization.yaml',
        'Add helm: enabled: true at the top of kustomization.yaml',
        'Helm and Kustomize cannot be combined'
      ],
      correct: 0,
      explanation: 'The helmCharts: field in kustomization.yaml defines Helm chart sources. Apply with: kubectl apply -k . --enable-helm (or kustomize build --enable-helm . | kubectl apply -f -)',
      reference: 'Review "Method 2: Kustomize helmCharts field" section.'
    },
    {
      question: 'When should you use Helm instead of Kustomize?',
      options: [
        'When deploying 3rd-party applications from public repositories with release tracking needs',
        'When managing your own application across multiple environments',
        'When you want plain YAML diffs visible in Git',
        'When no templating language is needed'
      ],
      correct: 0,
      explanation: 'Helm excels at 3rd-party app deployment (nginx, postgres, cert-manager) where charts already exist, release tracking is valuable, and complex parameterization is needed.',
      reference: 'Review "When to Use Each" — Use Helm when.'
    },
    {
      question: 'What is the typical output format of "helm template my-app ./chart -f values.yaml"?',
      options: [
        'Plain Kubernetes YAML manifests printed to stdout',
        'A Helm release created in the cluster',
        'A kustomization.yaml overlay directory',
        'A values.yaml with defaults merged'
      ],
      correct: 0,
      explanation: 'helm template outputs rendered plain YAML manifests to stdout. You can redirect to a file (> manifests.yaml) or pipe to kubectl apply -f - for GitOps workflows.',
      reference: 'Review "Key Exam Scenarios" — Scenario 3.'
    },
    {
      question: 'A Kustomize patch fails because it can\'t find the target resource by name after a Helm render. What is the most likely cause?',
      options: [
        'Helm prefixes the release name to resource names (e.g., my-release-nginx)',
        'Kustomize doesn\'t support patching Helm-generated resources',
        'The resource was deleted by Helm during rendering',
        'Kustomize only patches resources from the same kustomization.yaml'
      ],
      correct: 0,
      explanation: 'Helm uses the release name as a prefix in resource names. "helm install my-nginx bitnami/nginx" creates resources named "my-nginx-nginx". Kustomize patches must match this full name.',
      reference: 'Review "Common Errors" — Kustomize patch fails on Helm output.'
    },
    {
      question: 'Which feature gives Helm an advantage over Kustomize for cluster-wide release management?',
      options: [
        'Helm tracks release history and enables atomic rollback to previous revisions',
        'Helm has a built-in namespace isolation mechanism',
        'Helm automatically generates Kubernetes RBAC rules',
        'Helm validates manifests against the Kubernetes API before deploying'
      ],
      correct: 0,
      explanation: 'Helm maintains a release record in Kubernetes secrets. "helm history" and "helm rollback" give full release lifecycle management — Kustomize has no equivalent.',
      reference: 'Review "Helm vs Kustomize" comparison table — Release Management row.'
    }
  ],
  flashcards: [
    {
      front: 'What is the core difference between Helm and Kustomize?',
      back: 'Helm uses Go templates and packages resources into distributable Charts with release management. Kustomize uses pure YAML patches (overlays) with no templating, built into kubectl. Helm = packaging, Kustomize = customization.'
    },
    {
      front: 'How do you render a Helm chart to plain YAML without deploying?',
      back: 'helm template <release-name> <chart> [-f values.yaml] [--set key=val] — outputs rendered manifests to stdout. Redirect to file or pipe to kubectl apply -f -.'
    },
    {
      front: 'When is using both Helm AND Kustomize together appropriate?',
      back: 'When you deploy 3rd-party Helm charts but need to add organization-specific patches (annotations, labels, resource limits) on top. Render with helm template, then patch with Kustomize overlays.'
    },
    {
      front: 'What kubectl flag enables Kustomize to pull and render Helm charts?',
      back: 'kubectl apply -k . --enable-helm (or kustomize build --enable-helm). Requires the helmCharts: field in kustomization.yaml.'
    },
    {
      front: 'What is the Helm release name prefix problem with Kustomize patches?',
      back: 'Helm names resources using the release name as prefix (e.g., my-nginx-nginx). Kustomize patches must reference this exact name. Use "helm template | grep "^  name:" " to discover actual names.'
    },
    {
      front: 'What is the typical GitOps pattern combining Helm and Git?',
      back: 'helm template renders charts to YAML → commit rendered YAML to Git → ArgoCD/Flux detects changes → applies to cluster. This avoids running Helm in the cluster itself.'
    }
  ],
  lab: {
    scenario: 'Your team needs to deploy an nginx application using both tools: first with Helm for the base deployment, then customize it for staging with Kustomize patches.',
    objective: 'Practice the combined Helm + Kustomize workflow used in real GitOps pipelines.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Deploy with Helm and inspect the release',
        instruction: `Install the bitnami/nginx chart as release \`web-app\` in namespace \`apps\` with 2 replicas and ClusterIP service type. Then render the same chart to a YAML file at \`/tmp/web-app-base.yaml\`.`,
        hints: [
          'helm repo add bitnami https://charts.bitnami.com/bitnami if not already added',
          'Use helm install ... --create-namespace -n apps',
          'Use helm template ... > /tmp/web-app-base.yaml to render without deploying'
        ],
        solution: `\`\`\`bash
helm repo add bitnami https://charts.bitnami.com/bitnami 2>/dev/null || true
helm repo update

# Deploy
helm install web-app bitnami/nginx \\
  --namespace apps \\
  --create-namespace \\
  --set replicaCount=2 \\
  --set service.type=ClusterIP

# Also render to file (for Kustomize use)
helm template web-app bitnami/nginx \\
  --set replicaCount=2 \\
  --set service.type=ClusterIP \\
  --namespace apps > /tmp/web-app-base.yaml
\`\`\``,
        verify: `\`\`\`bash
helm list -n apps
# Expected: web-app  apps  1  DEPLOYED  nginx-...

kubectl get pods -n apps
# Expected: 2 pods running

ls -la /tmp/web-app-base.yaml
# Expected: file exists with YAML content

head -20 /tmp/web-app-base.yaml
# Expected: Kubernetes YAML (Deployment, Service, etc.)
\`\`\``
      },
      {
        title: 'Create a Kustomize overlay patching the Helm output',
        instruction: `Create a Kustomize overlay at \`/tmp/kustomize-staging\` that references \`/tmp/web-app-base.yaml\` and adds an annotation \`environment: staging\` to the Deployment. Preview the result with kubectl kustomize.`,
        hints: [
          'kustomization.yaml with resources: [/tmp/web-app-base.yaml]',
          'First check: grep "name:" /tmp/web-app-base.yaml | head — find the actual Deployment name',
          'Use a JSON 6902 patch to add the annotation'
        ],
        solution: `\`\`\`bash
mkdir -p /tmp/kustomize-staging

# Find the deployment name from Helm output
DEPLOY_NAME=$(grep -A1 "kind: Deployment" /tmp/web-app-base.yaml | grep "name:" | head -1 | awk '{print $2}')
echo "Deployment name: $DEPLOY_NAME"

cat <<EOF > /tmp/kustomize-staging/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - /tmp/web-app-base.yaml
patches:
  - target:
      kind: Deployment
      name: \${DEPLOY_NAME}
    patch: |-
      - op: add
        path: /metadata/annotations
        value:
          environment: staging
          managed-by: kustomize
EOF

# Preview
kubectl kustomize /tmp/kustomize-staging
\`\`\``,
        verify: `\`\`\`bash
kubectl kustomize /tmp/kustomize-staging | grep -A5 "kind: Deployment" | grep -A3 "annotations:"
# Expected: annotations with environment: staging

kubectl kustomize /tmp/kustomize-staging | grep "environment: staging"
# Expected: at least one match
\`\`\``
      },
      {
        title: 'Compare Helm and Kustomize approaches side by side',
        instruction: `Check the Helm release history. Upgrade the Helm release to 3 replicas. Then observe that the Kustomize base file doesn\'t auto-update — you\'d need to re-render. Understand why Kustomize is better for GitOps.`,
        hints: [
          'Use helm upgrade ... --set replicaCount=3',
          'Check helm history to see revision tracking',
          'The /tmp/web-app-base.yaml is static — Helm changes don\'t propagate automatically'
        ],
        solution: `\`\`\`bash
# Check release history (Helm strength)
helm history web-app -n apps

# Upgrade Helm release
helm upgrade web-app bitnami/nginx \\
  --namespace apps \\
  --set replicaCount=3 \\
  --set service.type=ClusterIP

# Check history again
helm history web-app -n apps
# Shows 2 revisions

# The Kustomize file is outdated now:
grep "replicas:" /tmp/web-app-base.yaml
# Shows old value — you'd need to re-run helm template to update it

# Roll back Helm release
helm rollback web-app 1 -n apps
\`\`\``,
        verify: `\`\`\`bash
helm history web-app -n apps
# Expected: 3 revisions (install, upgrade, rollback)

kubectl get deployment -n apps -o jsonpath='{.items[0].spec.replicas}'
# Expected: 2 (rolled back to original)

# Confirm Kustomize file still has old values (static)
grep "replicaCount\|replicas:" /tmp/web-app-base.yaml | head -3
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Helm release in FAILED state after upgrade',
      difficulty: 'medium',
      symptom: 'helm list shows status FAILED. New pods are in CrashLoopBackOff or ImagePullBackOff. The application is broken.',
      diagnosis: `\`\`\`bash
# Check release status
helm status my-release -n <namespace>

# See what failed
helm history my-release -n <namespace>

# Check pods
kubectl get pods -n <namespace>
kubectl describe pod <failed-pod> -n <namespace>

# Check the values that were used in the bad upgrade
helm get values my-release -n <namespace>
\`\`\``,
      solution: `Roll back to the last working revision:
\`\`\`bash
# Find last working revision
helm history my-release -n <namespace>
# Look for last SUPERSEDED entry (was working before upgrade)

# Rollback
helm rollback my-release <revision-number> -n <namespace>

# Or to use atomic flag to prevent future stuck states:
helm upgrade my-release <chart> -n <namespace> \\
  --atomic \\
  --timeout 5m \\
  --set key=value
# --atomic auto-rolls back if upgrade fails within the timeout
\`\`\``
    },
    {
      title: 'Kustomize produces different manifests than expected after Helm re-render',
      difficulty: 'medium',
      symptom: 'After running helm template again to update the base YAML, applying the Kustomize overlay produces unexpected results — patches don\'t apply or apply to wrong resources.',
      diagnosis: `\`\`\`bash
# Compare old vs new Helm output
helm template my-app ./chart -f values.yaml > /tmp/new-base.yaml
diff /tmp/old-base.yaml /tmp/new-base.yaml

# Check if resource names changed between versions
grep "^  name:" /tmp/new-base.yaml | head -20
grep "^  name:" /tmp/old-base.yaml | head -20

# Preview kustomize output with new base
kubectl kustomize ./overlay
\`\`\``,
      solution: `When Helm chart versions change, resource names or structures may change. Update your Kustomize patches accordingly:

1. Identify changed resource names in the new Helm output
2. Update patch targets in kustomization.yaml to match new names
3. Test with kubectl kustomize before applying:
\`\`\`bash
kubectl kustomize ./overlay > /tmp/preview.yaml
kubectl diff -f /tmp/preview.yaml
\`\`\`

Best practice: Pin the Helm chart version to prevent unexpected changes:
\`\`\`bash
helm template my-app bitnami/nginx --version 15.1.0 -f values.yaml > base.yaml
\`\`\``
    }
  ]
};
