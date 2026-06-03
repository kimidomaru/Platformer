window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['fluxcd/fluxcd-sources'] = {
  theory: `
# FluxCD: Sources, Kustomizations & Helm Advanced

## Relevance
This topic deepens the Flux Sources model (GitRepository, HelmRepository, OCIRepository), advanced Kustomization capabilities (variable substitution, dependencies, patches), and full HelmRelease management with upgrade, rollback and valuesFrom. Essential knowledge for platform operators managing multiple clusters and environments.

## Fundamental Concepts

### Sources — Types and Use Cases

\`\`\`yaml
# GitRepository — Git repository
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: my-app
  namespace: flux-system
spec:
  interval: 1m
  url: https://github.com/org/my-app
  ref:
    branch: main              # branch
    # tag: v1.2.3             # or specific tag
    # semver: ">=1.0.0 <2.0"  # or semver range
    # commit: abc123def       # or exact commit
  ignore: |                   # Ignore files/directories
    *.md
    *.txt
    tests/
    docs/
\`\`\`

\`\`\`yaml
# HelmRepository — Helm repository (OCI or HTTP)
apiVersion: source.toolkit.fluxcd.io/v1
kind: HelmRepository
metadata:
  name: bitnami
  namespace: flux-system
spec:
  interval: 1h               # Helm repositories change less frequently
  url: https://charts.bitnami.com/bitnami
  # For OCI (Helm 3.8+):
  # type: oci
  # url: oci://registry-1.docker.io/bitnamicharts
\`\`\`

\`\`\`yaml
# OCIRepository — OCI artifacts (Flux images, packaged charts)
apiVersion: source.toolkit.fluxcd.io/v1beta2
kind: OCIRepository
metadata:
  name: my-app-configs
  namespace: flux-system
spec:
  interval: 5m
  url: oci://ghcr.io/myorg/my-app-configs
  ref:
    tag: latest
    # or semver: ">=1.0.0"
    # or digest: sha256:abc123
  secretRef:
    name: ghcr-auth
\`\`\`

### Advanced Kustomization — Variable Substitution

\`\`\`yaml
# postBuild.substitute — variable substitution in YAML
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: apps
  namespace: flux-system
spec:
  interval: 5m
  path: ./apps
  sourceRef:
    kind: GitRepository
    name: fleet-infra
  postBuild:
    substitute:
      ENVIRONMENT: production
      DOMAIN: acme.io
      IMAGE_TAG: v1.2.3
    substituteFrom:
      - kind: ConfigMap
        name: cluster-vars          # Variables from a ConfigMap
      - kind: Secret
        name: cluster-secrets       # Sensitive variables from a Secret
        optional: true              # Don't fail if Secret doesn't exist
\`\`\`

\`\`\`yaml
# In the repository's YAML file, use \${VAR_NAME}:
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  namespace: \${ENVIRONMENT}       # Substituted at runtime
spec:
  template:
    spec:
      containers:
        - name: app
          image: ghcr.io/myorg/app:\${IMAGE_TAG}  # Tag from ConfigMap
          env:
            - name: DOMAIN
              value: \${DOMAIN}
\`\`\`

### Kustomization with dependsOn

\`\`\`yaml
# infrastructure/kustomization.yaml — deploy cert-manager first
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: infrastructure
  namespace: flux-system
spec:
  interval: 10m
  path: ./infrastructure/base
  prune: true
  sourceRef:
    kind: GitRepository
    name: fleet-infra
  healthChecks:
    - apiVersion: apps/v1
      kind: Deployment
      name: cert-manager
      namespace: cert-manager
---
# apps/kustomization.yaml — apps only deploy after infrastructure is Ready
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: apps
  namespace: flux-system
spec:
  interval: 5m
  path: ./apps/production
  prune: true
  sourceRef:
    kind: GitRepository
    name: fleet-infra
  dependsOn:
    - name: infrastructure        # Wait for infrastructure to be Ready
\`\`\`

### Kustomization with inline patches

\`\`\`yaml
# inline patches in Flux Kustomization
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: apps-production
  namespace: flux-system
spec:
  interval: 5m
  path: ./apps/base
  sourceRef:
    kind: GitRepository
    name: fleet-infra
  patches:
    # Strategic merge patch
    - patch: |
        apiVersion: apps/v1
        kind: Deployment
        metadata:
          name: podinfo
        spec:
          replicas: 3
      target:
        kind: Deployment
        name: podinfo
    # JSON patch
    - patch: |
        - op: replace
          path: /spec/template/spec/containers/0/resources/requests/memory
          value: 256Mi
      target:
        kind: Deployment
        name: podinfo
\`\`\`

### Advanced HelmRelease

\`\`\`yaml
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: kube-prometheus-stack
  namespace: monitoring
spec:
  interval: 30m
  chart:
    spec:
      chart: kube-prometheus-stack
      version: ">=55.0.0 <56.0.0"
      sourceRef:
        kind: HelmRepository
        name: prometheus-community
        namespace: flux-system
      valuesFiles:
        - values.yaml             # Values file in the chart
  values:                        # Inline override
    grafana:
      enabled: true
      adminPassword: ""          # Override for security
  valuesFrom:
    - kind: ConfigMap
      name: prometheus-values
      valuesKey: values.yaml
    - kind: Secret
      name: prometheus-secrets
      valuesKey: secret-values.yaml
      optional: true
  install:
    createNamespace: true
    remediation:
      retries: 3                 # Try 3x before considering failure
  upgrade:
    remediation:
      retries: 3
      remediateLastFailure: true # Remediate even on the last attempt
  rollback:
    timeout: 5m
    cleanupOnFail: true
  timeout: 10m                   # Timeout for Helm operations
\`\`\`

### HelmRelease — Dependencies Between Releases

\`\`\`yaml
# cert-manager must be installed before apps that use Certificates
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: cert-manager
  namespace: cert-manager
spec:
  interval: 30m
  chart:
    spec:
      chart: cert-manager
      version: ">=1.14.0 <2.0.0"
      sourceRef:
        kind: HelmRepository
        name: jetstack
        namespace: flux-system
  values:
    installCRDs: true
---
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: my-app
  namespace: default
spec:
  dependsOn:
    - name: cert-manager
      namespace: cert-manager    # Wait for cert-manager Ready
  chart:
    spec:
      chart: my-app
      # ...
\`\`\`

### HelmRelease with Kustomize postRenderer

\`\`\`yaml
# Use Kustomize to modify Helm output
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: podinfo
  namespace: default
spec:
  chart:
    spec:
      chart: podinfo
      sourceRef:
        kind: HelmRepository
        name: podinfo
        namespace: flux-system
  postRenderers:
    - kustomize:
        patches:
          - patch: |
              apiVersion: apps/v1
              kind: Deployment
              metadata:
                name: podinfo
              spec:
                template:
                  spec:
                    nodeSelector:
                      kubernetes.io/os: linux
            target:
              kind: Deployment
              name: podinfo
\`\`\`

### OCIRepository — OCI GitOps Artifacts

\`\`\`bash
# Package and publish configs as an OCI artifact
flux push artifact oci://ghcr.io/myorg/podinfo-manifests:latest \\
  --path=./apps/podinfo \\
  --source="https://github.com/myorg/fleet-infra" \\
  --revision="main@sha1:abc123"

# List published artifacts
flux list artifact oci://ghcr.io/myorg/podinfo-manifests

# Pull artifact (with cosign signature verification)
flux pull artifact oci://ghcr.io/myorg/podinfo-manifests:latest \\
  --output=./download
\`\`\`

\`\`\`yaml
# OCIRepository as Kustomization source
apiVersion: source.toolkit.fluxcd.io/v1beta2
kind: OCIRepository
metadata:
  name: podinfo-configs
  namespace: flux-system
spec:
  interval: 5m
  url: oci://ghcr.io/myorg/podinfo-manifests
  ref:
    semver: ">=1.0.0"
  secretRef:
    name: ghcr-auth
  verify:                           # Verify cosign signature
    provider: cosign
    secretRef:
      name: cosign-pub-key
---
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: podinfo-from-oci
  namespace: flux-system
spec:
  interval: 5m
  path: ./
  sourceRef:
    kind: OCIRepository
    name: podinfo-configs
  prune: true
\`\`\`

### Common Advanced Errors

1. **substituteFrom without ConfigMap/Secret** — If the ConfigMap/Secret doesn't exist and optional is not true, the Kustomization fails
2. **Circular dependsOn** — A → B → A causes deadlock; check the dependency graph
3. **HelmRelease timeout** — Complex charts may take longer than the default timeout (5min); increase timeout
4. **Wrong valuesFrom key** — The valuesKey must be the exact key name in the ConfigMap/Secret
5. **HelmRelease with plaintext Secret values** — Use valuesFrom with Secret for sensitive values, not inline in spec

## Killer.sh Style Challenge

> **Scenario:** You have two environments (staging and production) sharing the same base manifests in Git. Using separate Kustomizations, configure: (1) staging with REPLICAS=1 and ENVIRONMENT=staging using variable substitution; (2) production with REPLICAS=3 and ENVIRONMENT=production; (3) Both depend on an \`infrastructure\` Kustomization that must be Ready first.
`,
  quiz: [
    {
      question: 'What is the difference between GitRepository, HelmRepository, and OCIRepository in Flux?',
      options: [
        'They are the same resource type with different names',
        'GitRepository monitors Git repositories; HelmRepository monitors Helm chart indexes; OCIRepository monitors OCI registries (images, packaged charts)',
        'HelmRepository only supports Helm 2; OCIRepository only supports Helm 3',
        'GitRepository is faster than the others'
      ],
      correct: 1,
      explanation: 'GitRepository: clones Git repositories (SSH/HTTPS), supports branch/tag/commit/semver. HelmRepository: downloads index.yaml from traditional Helm repositories or OCI. OCIRepository: downloads artifacts from OCI registries (manifests, charts, etc.) — more secure as it supports cosign signature verification.',
      reference: 'Related concept: OCIRepository is the future of GitOps — allows packaging and signing configurations as OCI images.'
    },
    {
      question: 'How does postBuild.substitute work in Flux Kustomizations?',
      options: [
        'It runs shell scripts after the deploy',
        'It substitutes ${VAR} variables in YAML manifests before applying to the cluster, using values from substitute or substituteFrom (ConfigMap/Secret)',
        'It adds labels to all deployed resources',
        'It validates manifests before applying'
      ],
      correct: 1,
      explanation: 'postBuild.substitute performs text substitution in manifests: ${ENVIRONMENT} becomes "production". Values come from substitute (inline) or substituteFrom (ConfigMap/Secret). Allows reusing the same manifests across multiple environments by only changing variables.',
      reference: 'Related concept: substituteFrom with optional: true does not fail if the ConfigMap/Secret does not exist — useful for optional variables.'
    },
    {
      question: 'What does the dependsOn field in a Kustomization guarantee?',
      options: [
        'That resources have the same owner',
        'That the Kustomization only starts reconciliation after the Kustomizations listed in dependsOn are in Ready state',
        'That resources are deleted in the correct order',
        'That labels are propagated between Kustomizations'
      ],
      correct: 1,
      explanation: 'dependsOn creates reconciliation ordering: if apps depends on infrastructure, Flux waits for infrastructure (and its healthChecks) to become Ready before starting to reconcile apps. Critical for: cert-manager before apps with Certificates, ingress-controller before Ingresses.',
      reference: 'Related concept: dependsOn also works between HelmReleases — HelmRelease B can depend on HelmRelease A.'
    },
    {
      question: 'How to configure automatic rollback in a Flux HelmRelease?',
      options: [
        'Using flux rollback helmrelease',
        'Configuring spec.rollback with timeout and cleanupOnFail, and spec.upgrade.remediation.remediateLastFailure: true',
        'Rollback is automatic and requires no configuration',
        'Using a rollback Job in the same namespace'
      ],
      correct: 1,
      explanation: 'For automatic rollback: (1) spec.rollback.timeout: time limit; (2) spec.rollback.cleanupOnFail: clean up resources if rollback fails; (3) spec.upgrade.remediation.retries: how many times to try upgrade before rollback; (4) remediateLastFailure: true for rollback even on the last attempt.',
      reference: 'Related concept: spec.install.remediation.retries controls attempts on first install. spec.upgrade.remediation controls attempts on subsequent upgrades.'
    },
    {
      question: 'What are postRenderers in HelmReleases?',
      options: [
        'Scripts that run after Helm install',
        'Transformations applied to the YAML output generated by Helm BEFORE being applied to the cluster — allows using Kustomize patches on Helm charts',
        'Helm chart validators',
        'Custom Helm hooks'
      ],
      correct: 1,
      explanation: 'postRenderers are transformations (via Kustomize) applied to the YAML that Helm generates before being applied to the cluster. Allows adding labels, nodeSelectors, tolerations, or any modification the chart does not natively support — without forking the chart.',
      reference: 'Related concept: Alternative to chart forking for small customizations. The result is auditable via flux diff helmrelease.'
    },
    {
      question: 'How to package and publish configurations as an OCI artifact with Flux?',
      options: [
        'Using docker push',
        'Using flux push artifact with oci:// URL, local path, source and revision — creates an OCI image with the manifests',
        'Using kubectl create configmap',
        'It is not possible to publish configs as OCI with Flux'
      ],
      correct: 1,
      explanation: 'flux push artifact oci://registry/repo:tag --path=./configs creates an OCI image with manifests as a layer. Supports cosign signature verification with spec.verify on OCIRepository. This is the recommended model for distributing configurations between clusters in organizations.',
      reference: 'Related concept: OCI artifacts can be signed with cosign and verified by Flux before applying — zero-trust GitOps.'
    },
    {
      question: 'How to use valuesFrom in HelmReleases to inject sensitive values?',
      options: [
        'Add the values directly in spec.values',
        'Using spec.valuesFrom with kind: Secret and valuesKey specifying which Secret key contains the YAML values',
        'Using environment variables in the controller',
        'Sensitive values cannot be used in HelmReleases'
      ],
      correct: 1,
      explanation: 'valuesFrom allows injecting values from ConfigMaps and Secrets: kind: Secret, name: my-secrets, valuesKey: values.yaml. Flux reads the key content (which must be valid Helm values YAML) and merges it with other values. Does not expose sensitive values in the HelmRelease spec.',
      reference: 'Related concept: Use Sealed Secrets or External Secrets to manage the Secrets referenced by valuesFrom.'
    }
  ],
  flashcards: [
    {
      front: 'Flux Sources — GitRepository vs HelmRepository vs OCIRepository comparison',
      back: '**GitRepository:**\n- Protocol: HTTPS or SSH\n- Auth: deploy key, token\n- ref: branch, tag, commit, semver\n- Output: file tarball\n- Use case: YAML manifests, Kustomize\n\n**HelmRepository:**\n- Type: HTTP (index.yaml) or OCI\n- interval: usually 1h (changes rarely)\n- Output: list of available charts\n- Use case: install Helm charts\n\n**OCIRepository:**\n- Protocol: OCI (like Docker)\n- Auth: imagePullSecret format\n- ref: tag, semver, digest\n- verify: cosign signature\n- Output: OCI layers with configs\n- Use case: configuration distribution\n\n**Shared:**\n- interval, secretRef, ignore\n- Status: READY, URL, artifact'
    },
    {
      front: 'postBuild.substitute — variables in Kustomizations',
      back: '**In YAML manifests:**\n\`\`\`yaml\nimage: registry/${IMAGE_TAG}\nnamespace: ${ENVIRONMENT}\n\`\`\`\n\n**In Kustomization:**\n\`\`\`yaml\npostBuild:\n  substitute:\n    IMAGE_TAG: v1.2.3        # Inline\n    ENVIRONMENT: production  # Inline\n  substituteFrom:\n    - kind: ConfigMap\n      name: cluster-vars     # From ConfigMap\n    - kind: Secret\n      name: cluster-secrets  # From Secret\n      optional: true         # Don\'t fail if absent\n\`\`\`\n\n**Precedence:**\nsubstitute > substituteFrom ConfigMap > substituteFrom Secret\n\n**Special characters:**\n`$$` for literal `$` in YAML\n`${VAR:=default}` with default value'
    },
    {
      front: 'HelmRelease — automatic upgrade and rollback',
      back: '\`\`\`yaml\nspec:\n  timeout: 10m      # Operations timeout\n  install:\n    remediation:\n      retries: 3    # Install attempts\n  upgrade:\n    remediation:\n      retries: 3\n      remediateLastFailure: true  # Rollback on last\n  rollback:\n    timeout: 5m\n    cleanupOnFail: true  # Clean if rollback fails\n\`\`\`\n\n**Failure flow:**\n1. Upgrade fails\n2. Retries (retries)\n3. If retries exhausted, ROLLBACK\n4. Roll back to previous version\n5. If cleanupOnFail, clean resources\n\n**Force manual rollback:**\n`flux suspend helmrelease name`\n`helm rollback name --namespace ns`\n`flux resume helmrelease name`'
    },
    {
      front: 'dependsOn — reconciliation ordering',
      back: '**In Kustomizations:**\n\`\`\`yaml\nspec:\n  dependsOn:\n    - name: infrastructure\n    - name: cert-manager\n      namespace: cert-manager  # Cross-namespace\n\`\`\`\n\n**In HelmReleases:**\n\`\`\`yaml\nspec:\n  dependsOn:\n    - name: cert-manager\n      namespace: cert-manager\n\`\`\`\n\n**How it works:**\n- Checks if dependencies are Ready\n- If not, stays in Waiting state\n- Only reconciles after ALL deps Ready\n\n**Common use cases:**\n1. CRDs before resources\n2. Namespace before resources\n3. cert-manager before Ingresses\n4. storage-class before PVCs\n5. secrets-manager before apps\n\n**Circular dependency:**\nA→B→A causes DEADLOCK — avoid!'
    },
    {
      front: 'HelmRelease valuesFrom — inject external values',
      back: '**Syntax:**\n\`\`\`yaml\nspec:\n  valuesFrom:\n    - kind: ConfigMap\n      name: app-values         # CM name\n      valuesKey: values.yaml   # Key in CM\n    - kind: Secret\n      name: app-secrets        # Secret name\n      valuesKey: secret-vals   # Key in Secret\n      optional: true           # Don\'t fail if absent\n      targetPath: "db.password"  # Specific values path\n\`\`\`\n\n**The key content must be valid YAML:**\n\`\`\`yaml\n# ConfigMap data.values.yaml:\ngrafana:\n  adminPassword: admin\nprometheus:\n  retention: 30d\n\`\`\`\n\n**Precedence:**\nspec.values > valuesFrom[last] > valuesFrom[first] > chart defaults\n\n**Tip:** Use Sealed Secrets\nor External Secrets for Secrets\nreferenced by valuesFrom.'
    },
    {
      front: 'postRenderers — customize Helm charts with Kustomize',
      back: '**Use case:**\nHelm chart does not support an option you need\n(e.g., adding tolerations, nodeSelector)\n\n**Without chart fork:**\n\`\`\`yaml\nspec:\n  postRenderers:\n    - kustomize:\n        patches:\n          - patch: |\n              apiVersion: apps/v1\n              kind: Deployment\n              metadata:\n                name: name\n              spec:\n                template:\n                  spec:\n                    tolerations:\n                      - key: dedicated\n                        value: monitoring\n            target:\n              kind: Deployment\n              name: name\n        images:       # Override images\n          - name: nginx\n            newTag: 1.25.0\n\`\`\`\n\n**Inspect result:**\n`flux diff helmrelease name`'
    }
  ],
  lab: {
    scenario: 'You need to configure a multi-stage environment using Flux, with dependencies between infrastructure components and applications, and per-cluster environment variables.',
    objective: 'Learn variable substitution, dependencies between Kustomizations, and HelmRelease with valuesFrom.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Configure Kustomization with variable substitution',
        instruction: `Configure variable substitution in Flux:
1. Create a ConfigMap with cluster variables (ENVIRONMENT=lab, DOMAIN=example.com)
2. Create a Kustomization that uses postBuild.substituteFrom to inject these variables
3. Create YAML manifests that use the \${ENVIRONMENT} and \${DOMAIN} variables
4. Verify that the variables were substituted correctly`,
        hints: [
          'The ConfigMap must be in the same namespace as the Kustomization (flux-system)',
          'In YAML, use \${VAR_NAME} for variable references',
          'kubectl get configmap -n <namespace> shows the applied value'
        ],
        solution: `\`\`\`bash
# Create ConfigMap with cluster variables
kubectl create configmap cluster-vars \\
  --from-literal=ENVIRONMENT=lab \\
  --from-literal=DOMAIN=example.com \\
  --from-literal=REPLICA_COUNT=1 \\
  -n flux-system
\`\`\`

\`\`\`bash
# Create manifests that use variables (simulating Git repository)
mkdir -p /tmp/flux-lab/apps

cat > /tmp/flux-lab/apps/namespace.yaml <<'EOF'
apiVersion: v1
kind: Namespace
metadata:
  name: \${ENVIRONMENT}
  labels:
    environment: \${ENVIRONMENT}
    domain: \${DOMAIN}
EOF

cat > /tmp/flux-lab/apps/configmap.yaml <<'EOF'
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: \${ENVIRONMENT}
data:
  DOMAIN: \${DOMAIN}
  ENV: \${ENVIRONMENT}
EOF

cat > /tmp/flux-lab/apps/kustomization.yaml <<'EOF'
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - namespace.yaml
  - configmap.yaml
EOF
\`\`\`

\`\`\`yaml
# flux-kustomization.yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: app-with-vars
  namespace: flux-system
spec:
  interval: 1m
  path: /apps
  prune: true
  sourceRef:
    kind: GitRepository
    name: podinfo        # Reuse existing source
  postBuild:
    substituteFrom:
      - kind: ConfigMap
        name: cluster-vars
        namespace: flux-system
\`\`\``,
        verify: `\`\`\`bash
# NOTE: This step is demonstrative — the source must have files with \${VAR}
# To test substitution, use the flux CLI directly:

# View the variables ConfigMap
kubectl get configmap cluster-vars -n flux-system -o yaml
# Expected output: data with ENVIRONMENT, DOMAIN, REPLICA_COUNT

# Demonstrate substitution logic manually:
echo 'ENVIRONMENT value: lab'
echo 'DOMAIN value: example.com'
echo 'At runtime, \${ENVIRONMENT} would be substituted with "lab"'
echo 'At runtime, \${DOMAIN} would be substituted with "example.com"'

# Verify Kustomization was created
kubectl get kustomization -n flux-system
# Expected output: app-with-vars listed
\`\`\``
      },
      {
        title: 'Configure HelmRelease with dependsOn',
        instruction: `Configure HelmReleases with dependencies:
1. Create a HelmRepository for the bitnami repository
2. Create a HelmRelease for nginx (simulates base infrastructure)
3. Create another HelmRelease that depends on nginx being Ready (simulates application)
4. Verify the deploy order and healthChecks`,
        hints: [
          'spec.dependsOn[].name must be the exact name of the HelmRelease it depends on',
          'Use flux get helmreleases to see the status of all releases',
          'If the first HelmRelease fails, the second stays in Waiting'
        ],
        solution: `\`\`\`yaml
# helm-sources.yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: HelmRepository
metadata:
  name: bitnami
  namespace: flux-system
spec:
  interval: 1h
  url: https://charts.bitnami.com/bitnami
\`\`\`

\`\`\`yaml
# helm-releases.yaml
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: nginx-base
  namespace: default
spec:
  interval: 10m
  chart:
    spec:
      chart: nginx
      version: ">=15.0.0 <16.0.0"
      sourceRef:
        kind: HelmRepository
        name: bitnami
        namespace: flux-system
  values:
    replicaCount: 1
    service:
      type: ClusterIP
  install:
    remediation:
      retries: 2
  upgrade:
    remediation:
      retries: 2
---
# Second HelmRelease DEPENDS on the first
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: my-app
  namespace: default
spec:
  dependsOn:
    - name: nginx-base           # Wait for nginx-base
      namespace: default
  interval: 5m
  chart:
    spec:
      chart: nginx
      version: ">=15.0.0 <16.0.0"
      sourceRef:
        kind: HelmRepository
        name: bitnami
        namespace: flux-system
  values:
    replicaCount: 1
    nameOverride: my-app
\`\`\`

\`\`\`bash
kubectl apply -f helm-sources.yaml
kubectl apply -f helm-releases.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verify HelmRepository
kubectl get helmrepository bitnami -n flux-system
# Expected output: READY=True

# Monitor HelmReleases (my-app stays Waiting until nginx-base is Ready)
flux get helmreleases
# Expected output initially:
# nginx-base  - False  -  install in progress...
# my-app      - False  -  dependency not ready

# After nginx-base is Ready:
# nginx-base  - True   -  Release reconciliation succeeded
# my-app      - True   -  Release reconciliation succeeded

# Verify deployed pods
kubectl get pods -n default | grep -E "nginx|my-app"
# Expected output: nginx-base and my-app pods

# View helm-controller logs to confirm dependency
flux logs --kind=HelmRelease --name=my-app
# Expected output: "dependency not ready" followed by successful deploy
\`\`\``
      },
      {
        title: 'Explore flux diff and advanced CLI operations',
        instruction: `Explore advanced Flux CLI capabilities:
1. Use flux diff to see what would be applied without applying
2. Export Flux resources to YAML
3. Suspend and resume a Kustomization
4. Verify reconciliation history via logs`,
        hints: [
          'flux diff kustomization <name> shows difference between Git and cluster',
          'flux export source git <name> exports the resource as clean YAML',
          'flux logs --follow waits for new logs (similar to kubectl logs -f)'
        ],
        solution: `\`\`\`bash
# View full status of all resources
flux get all

# View details of a specific GitRepository
flux get source git podinfo -n flux-system
flux get source git --namespace=flux-system

# Export resource as YAML (useful for GitOps)
flux export source git podinfo -n flux-system

# Export Kustomization
flux export kustomization podinfo -n flux-system

# View logs for a specific controller
flux logs --kind=Kustomization --name=podinfo -n flux-system --tail=20

# Suspend reconciliation (for maintenance or testing)
flux suspend kustomization podinfo -n flux-system
echo "Kustomization suspended — manual changes won't be reverted"

# Verify status after suspension
kubectl get kustomization podinfo -n flux-system
# Expected output: SUSPENDED=True

# Make manual change while suspended
kubectl scale deployment podinfo -n podinfo --replicas=3 2>/dev/null || true
\`\`\``,
        verify: `\`\`\`bash
# Verify it's suspended
flux get kustomization podinfo -n flux-system
# Expected output: SUSPENDED=True

# Resume reconciliation
flux resume kustomization podinfo -n flux-system
flux get kustomization podinfo -n flux-system
# Expected output: SUSPENDED=False

# View reconciliation events
kubectl get events -n flux-system \\
  --field-selector involvedObject.name=podinfo \\
  --sort-by='.lastTimestamp' | tail -5
# Expected output: suspend/resume and reconciliation events

# Verify manual changes were reverted
kubectl get deployment podinfo -n podinfo 2>/dev/null
# Expected output: replicas returned to Git value

# View summary of all state
flux get all -n flux-system
# Expected output: all resources READY=True
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'HelmRelease stuck in upgrade retries with "release not found" error',
      difficulty: 'medium',
      symptom: 'The HelmRelease repeatedly fails with "upgrade retries exhausted" or "release not found". The chart is not deployed.',
      diagnosis: `\`\`\`bash
# 1. Check detailed status
flux get helmrelease <name> -n <namespace>
kubectl describe helmrelease <name> -n <namespace> | grep -A10 "Status:"

# 2. View helm-controller logs
flux logs --kind=HelmRelease --name=<name> -n <namespace> --tail=30

# 3. Check if HelmRepository is healthy
flux get source helm <helm-repo-name> -n flux-system

# 4. View Helm history directly
helm history <name> -n <namespace> 2>/dev/null

# 5. Check if namespace exists
kubectl get namespace <namespace>
\`\`\``,
      solution: `**Causes and solutions:**

1. **Chart not found in repository:** The chart or version doesn't exist in the HelmRepository. Check with \`helm search repo <name>/<chart>\` or inspect the HelmRepository.

2. **HelmRepository not yet indexed:** The first sync may take time. Force it: \`flux reconcile source helm <name> -n flux-system\`.

3. **Chart version doesn't match semver:** \`version: ">=5.0.0 <6.0.0"\` may have no available version. Check existing versions.

4. **Corrupted helm release:** If a previous installation partially failed, the helm release may be in a bad state. Clean manually:
\`\`\`bash
flux suspend helmrelease <name>
helm uninstall <name> -n <namespace> --no-hooks
flux resume helmrelease <name>
\`\`\`

5. **Namespace doesn't exist:** If spec.install.createNamespace: false (default) and the namespace doesn't exist, the deploy fails. Add createNamespace: true or create the namespace beforehand.`
    },
    {
      title: 'postBuild.substitute not substituting variables — they remain as ${VAR}',
      difficulty: 'easy',
      symptom: 'The Kustomization uses postBuild.substitute but the ${VAR} variables remain literal in the cluster — resources have the string ${VAR} instead of the value.',
      diagnosis: `\`\`\`bash
# 1. Check if ConfigMap has the correct values
kubectl get configmap cluster-vars -n flux-system -o yaml

# 2. Check substituteFrom syntax
kubectl get kustomization <name> -n flux-system -o yaml | grep -A10 "postBuild:"

# 3. Check the resource applied to the cluster
kubectl get deployment <name> -o yaml | grep -i "environment\\|domain\\|image"
# If showing "\${VAR}" literally, substitution didn't occur

# 4. View Kustomization logs
flux logs --kind=Kustomization --name=<name> -n flux-system
\`\`\``,
      solution: `**Causes and solutions:**

1. **Wrong syntax in YAML:** The variable must be \`\${VAR_NAME}\` (with braces). Without braces (\`\$VAR\`) it is not substituted.

2. **File not processed by the substitutor:** Check that the file is in the Kustomization path and not in the ignore field.

3. **ConfigMap in wrong namespace:** The ConfigMap referenced in substituteFrom must be in the Kustomization's namespace (usually flux-system). If it's in another namespace, the Kustomization can't read it.

4. **Variable not defined:** If the variable doesn't exist in either substitute or substituteFrom, it stays as a literal. Check the exact name (case-sensitive).

5. **Kustomize overrides the value:** The kustomization.yaml file in the repository may have patches that overwrite the substituted value. Check the application order.`
    }
  ]
};
