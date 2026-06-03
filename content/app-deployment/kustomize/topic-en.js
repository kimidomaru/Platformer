window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['app-deployment/kustomize'] = {
  theory: `# Kustomize — Configuration Customization

## Exam Relevance
> Kustomize is built into kubectl (kubectl apply -k) and appears in CKAD. Expect tasks like applying an overlay, patching a deployment, or generating ConfigMaps. Understanding the base/overlay pattern is key.

## Core Concepts

**Kustomize** is a configuration management tool built into kubectl. It customizes Kubernetes YAML without templates — using a declarative overlay approach.

**Key difference from Helm:** No templating language. Pure YAML + patches. No chart installation needed.

### Directory Structure
\`\`\`
k8s/
├── base/                  # Shared, environment-agnostic resources
│   ├── kustomization.yaml
│   ├── deployment.yaml
│   └── service.yaml
└── overlays/
    ├── dev/               # Dev-specific customizations
    │   ├── kustomization.yaml
    │   └── patch-replicas.yaml
    └── prod/              # Prod-specific customizations
        ├── kustomization.yaml
        └── patch-resources.yaml
\`\`\`

### kustomization.yaml — The Core File
\`\`\`yaml
# base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - deployment.yaml        # local files
  - service.yaml
  - ../other-base          # reference another base

commonLabels:              # labels added to all resources
  app: myapp
  environment: base

namePrefix: myapp-         # prefix added to all resource names
nameSuffix: -v1

namespace: production      # override namespace for all resources
\`\`\`

## Patches

### Strategic Merge Patch
\`\`\`yaml
# overlays/prod/patch-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp          # must match the base resource name
spec:
  replicas: 5          # override replicas
  template:
    spec:
      containers:
      - name: myapp
        resources:
          limits:
            memory: "512Mi"
            cpu: "500m"
\`\`\`

### JSON 6902 Patch
\`\`\`yaml
# overlays/prod/kustomization.yaml
patches:
  - target:
      kind: Deployment
      name: myapp
    patch: |-
      - op: replace
        path: /spec/replicas
        value: 5
      - op: add
        path: /spec/template/spec/containers/0/env/-
        value:
          name: ENV
          value: production
\`\`\`

### Overlay kustomization.yaml
\`\`\`yaml
# overlays/prod/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

bases:
  - ../../base          # reference the base (deprecated, use resources:)

resources:
  - ../../base          # preferred in newer versions

patches:
  - path: patch-deployment.yaml

images:
  - name: myapp
    newTag: "2.0.1"    # override image tag without modifying base

namePrefix: prod-
namespace: production
\`\`\`

## ConfigMap and Secret Generators

\`\`\`yaml
# kustomization.yaml
configMapGenerator:
  - name: app-config
    literals:
      - DATABASE_URL=postgres://db:5432/myapp
      - LOG_LEVEL=info
    files:
      - config.properties    # file contents become a key

secretGenerator:
  - name: app-secrets
    literals:
      - DB_PASSWORD=supersecret
    options:
      disableNameSuffixHash: true   # prevent hash suffix (e.g., app-secrets-abc123)
\`\`\`

## Essential Commands

\`\`\`bash
# Preview generated YAML (does NOT apply)
kubectl kustomize ./base
kubectl kustomize ./overlays/prod

# Apply the kustomization
kubectl apply -k ./base
kubectl apply -k ./overlays/prod

# Delete resources defined by kustomization
kubectl delete -k ./overlays/prod

# Using standalone kustomize CLI (if installed)
kustomize build ./overlays/prod | kubectl apply -f -
kustomize build ./overlays/prod > rendered.yaml
\`\`\`

## Images Transformer

\`\`\`yaml
# kustomization.yaml
images:
  - name: nginx            # match image name in manifests
    newName: my-registry/nginx   # optional: change registry/name
    newTag: "1.21"               # override tag
    digest: sha256:abc123        # optional: pin by digest (most secure)
\`\`\`

## Common Transformers

\`\`\`yaml
# kustomization.yaml
commonLabels:
  team: backend
  app.kubernetes.io/managed-by: kustomize

commonAnnotations:
  contact: platform-team@company.com

replicas:
  - name: myapp-deployment
    count: 3
\`\`\`

## Common Errors

- **"no such file or directory"**: kustomization.yaml references a file that doesn't exist — check paths are relative to kustomization.yaml
- **Patch not applying**: The target name in the patch must exactly match the resource name (including any namePrefix)
- **"already has status field"**: Remove \`status:\` from patches — Kustomize manages it
- **ConfigMap hash suffix causes pod restart**: Expected behavior — add \`disableNameSuffixHash: true\` if you don't want rolling updates on ConfigMap change

## Killer.sh Style Challenge

Given a base in \`/opt/kustomize/base\` with a Deployment named \`api\`, create a production overlay at \`/opt/kustomize/overlays/prod\` that: sets namespace to \`production\`, changes the image tag to \`v3.0\`, and sets replicas to 4. Apply it to the cluster.
`,
  quiz: [
    {
      question: 'What command applies a Kustomize configuration built from the current directory?',
      options: [
        'kubectl apply -k .',
        'kubectl apply --kustomize .',
        'kustomize apply .',
        'kubectl kustomize apply .'
      ],
      correct: 0,
      explanation: 'kubectl apply -k <directory> applies the Kustomize configuration. The -k flag (lowercase) triggers Kustomize processing. kubectl kustomize . only prints the output without applying.',
      reference: 'Review "Essential Commands" section.'
    },
    {
      question: 'What is the difference between the base and overlay directories in Kustomize?',
      options: [
        'Base contains environment-agnostic resources; overlays contain environment-specific customizations',
        'Base contains development resources; overlays contain production resources',
        'Base contains YAML templates; overlays contain rendered manifests',
        'Base is the first namespace; overlays are additional namespaces'
      ],
      correct: 0,
      explanation: 'The base/overlay pattern separates shared resources (base) from environment-specific changes (overlays). The overlay references the base and adds patches on top.',
      reference: 'Review "Core Concepts" — Directory Structure.'
    },
    {
      question: 'Which Kustomize field would you use to change the image tag of a container across all environments in an overlay?',
      options: [
        'images: with newTag field',
        'patches: with an image replacement',
        'configMapGenerator: with image key',
        'replacements: with image target'
      ],
      correct: 0,
      explanation: 'The "images:" transformer lets you override image names or tags without modifying base files. It matches by image name and applies the newTag across all matching containers.',
      reference: 'Review "Images Transformer" section.'
    },
    {
      question: 'What does "kubectl kustomize ./overlays/prod" do?',
      options: [
        'Prints the rendered YAML to stdout without applying',
        'Applies the overlay to the cluster',
        'Validates the overlay against the cluster API',
        'Generates a diff between the overlay and current cluster state'
      ],
      correct: 0,
      explanation: 'kubectl kustomize only renders/previews the YAML. To apply it, use kubectl apply -k. This is useful for inspecting what would be deployed.',
      reference: 'Review "Essential Commands" section.'
    },
    {
      question: 'A ConfigMap generated by configMapGenerator gets a hash suffix (e.g., app-config-k7mh5). What is the purpose of this hash?',
      options: [
        'To trigger rolling updates in Pods when the ConfigMap changes',
        'To ensure ConfigMap names are globally unique across namespaces',
        'To version the ConfigMap for rollback purposes',
        'To comply with Kubernetes naming length limits'
      ],
      correct: 0,
      explanation: 'The hash suffix changes when the ConfigMap content changes. Since Pods reference the ConfigMap by name (including the hash), changing the ConfigMap forces a new Pod rollout — ensuring Pods always use the latest config.',
      reference: 'Review "ConfigMap and Secret Generators" section.'
    },
    {
      question: 'What is a JSON 6902 patch in Kustomize?',
      options: [
        'A patch using JSON Patch operations (add, remove, replace) targeting specific paths in a resource',
        'A patch format that requires JSON files instead of YAML',
        'A patch that replaces the entire resource spec',
        'A patch that merges two YAML documents using deep merge'
      ],
      correct: 0,
      explanation: 'JSON 6902 patches use RFC 6902 operations (add, remove, replace, copy, move, test) to modify specific paths in a resource. More precise than strategic merge patches.',
      reference: 'Review "Patches" section — JSON 6902 Patch.'
    },
    {
      question: 'The "commonLabels" field in kustomization.yaml does what?',
      options: [
        'Adds the specified labels to ALL resources in the kustomization',
        'Adds labels only to Pod templates',
        'Adds labels only to Deployments and Services',
        'Replaces existing labels on all resources'
      ],
      correct: 0,
      explanation: 'commonLabels adds the given labels to metadata.labels of every resource in the kustomization. For Deployments, it also adds them to the pod template labels.',
      reference: 'Review "Common Transformers" section.'
    },
    {
      question: 'How do you reference a base directory in a modern kustomization.yaml (v1beta1+)?',
      options: [
        'Under resources: - ../../base',
        'Under bases: - ../../base',
        'Under imports: - ../../base',
        'Under components: - ../../base'
      ],
      correct: 0,
      explanation: 'In newer Kustomize versions, "bases:" is deprecated. The preferred way is to list the base under "resources:". Both work for now, but resources: is the standard.',
      reference: 'Review "Overlay kustomization.yaml" section — resources vs bases.'
    }
  ],
  flashcards: [
    {
      front: 'What is the key difference between Kustomize and Helm?',
      back: 'Kustomize uses pure YAML + patches (no templating language). Helm uses Go templates. Kustomize is built into kubectl; Helm requires a separate install. Kustomize is better for simple overlays; Helm is better for complex parameterized deployments.'
    },
    {
      front: 'What file is required in every Kustomize directory?',
      back: 'kustomization.yaml — it defines the resources, patches, generators, and transformers for that directory.'
    },
    {
      front: 'What does the "namePrefix" field in kustomization.yaml do?',
      back: 'Prepends a string to the name of every resource in the kustomization. E.g., namePrefix: prod- turns Deployment "api" into "prod-api".'
    },
    {
      front: 'How do you prevent ConfigMap hash suffixes in Kustomize generators?',
      back: 'Add "options: disableNameSuffixHash: true" under the configMapGenerator entry. This means ConfigMap changes won\'t automatically trigger pod rolling updates.'
    },
    {
      front: 'What are the two patch types in Kustomize?',
      back: '1. Strategic Merge Patch: YAML that looks like the resource being patched, merged using Kubernetes strategic merge rules. 2. JSON 6902 Patch: Operations (add/remove/replace) on specific JSON paths.'
    },
    {
      front: 'How do you preview Kustomize output without applying it?',
      back: 'kubectl kustomize <directory> — prints rendered YAML to stdout. Equivalent to: kustomize build <directory> | less'
    },
    {
      front: 'What does secretGenerator do in kustomization.yaml?',
      back: 'Generates Kubernetes Secrets from literals, files, or environment files — without having to manually base64-encode values. Generated secrets also get a hash suffix by default.'
    }
  ],
  lab: {
    scenario: 'Your team has a base application deployment that needs to be customized for dev and prod environments using Kustomize. You\'ll create the overlay structure, apply patches, and deploy to different namespaces.',
    objective: 'Learn the Kustomize base/overlay pattern, patches, and image transformers using kubectl built-in Kustomize support.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create the base configuration',
        instruction: `Create a Kustomize base at \`/tmp/kustomize/base\` with a Deployment (nginx, 1 replica) and a Service. Create the \`kustomization.yaml\` referencing both files.`,
        hints: [
          'Create both deployment.yaml and service.yaml in the base directory',
          'The kustomization.yaml must list them under resources:',
          'Add a commonLabel "app: webapp" to the kustomization'
        ],
        solution: `\`\`\`bash
mkdir -p /tmp/kustomize/base

cat <<EOF > /tmp/kustomize/base/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: webapp
spec:
  replicas: 1
  selector:
    matchLabels:
      app: webapp
  template:
    metadata:
      labels:
        app: webapp
    spec:
      containers:
      - name: webapp
        image: nginx:1.20
        ports:
        - containerPort: 80
EOF

cat <<EOF > /tmp/kustomize/base/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: webapp
spec:
  selector:
    app: webapp
  ports:
  - port: 80
    targetPort: 80
EOF

cat <<EOF > /tmp/kustomize/base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - deployment.yaml
  - service.yaml
commonLabels:
  app: webapp
EOF
\`\`\``,
        verify: `\`\`\`bash
kubectl kustomize /tmp/kustomize/base
# Expected: prints Deployment and Service YAML with app: webapp label on both

# Verify files exist
ls /tmp/kustomize/base/
# Expected: deployment.yaml  kustomization.yaml  service.yaml
\`\`\``
      },
      {
        title: 'Create a production overlay',
        instruction: `Create a production overlay at \`/tmp/kustomize/overlays/prod\` that: uses the base, sets namespace to \`production\`, scales replicas to 3, and changes the nginx image tag to \`1.21\`.`,
        hints: [
          'Create the overlays/prod directory and a kustomization.yaml',
          'Reference the base with: resources: - ../../base',
          'Use the images: transformer for the tag change',
          'Use a strategic merge patch file for replicas, or the replicas: field'
        ],
        solution: `\`\`\`bash
mkdir -p /tmp/kustomize/overlays/prod

cat <<EOF > /tmp/kustomize/overlays/prod/patch-replicas.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: webapp
spec:
  replicas: 3
EOF

cat <<EOF > /tmp/kustomize/overlays/prod/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../base
namespace: production
images:
  - name: nginx
    newTag: "1.21"
patches:
  - path: patch-replicas.yaml
EOF
\`\`\``,
        verify: `\`\`\`bash
kubectl kustomize /tmp/kustomize/overlays/prod
# Expected output should show:
# - namespace: production on both resources
# - image: nginx:1.21 in the Deployment
# - replicas: 3 in the Deployment
# - app: webapp labels (inherited from base)
\`\`\``
      },
      {
        title: 'Apply overlays and verify namespaces',
        instruction: `Apply the production overlay to the cluster. Create the \`production\` namespace if needed. Verify the deployment uses 3 replicas with the correct image tag.`,
        hints: [
          'Use kubectl apply -k /tmp/kustomize/overlays/prod',
          'The namespace production must exist or use --dry-run to preview first',
          'kubectl get deployment -n production to verify'
        ],
        solution: `\`\`\`bash
# Create namespace first
kubectl create namespace production --dry-run=client -o yaml | kubectl apply -f -

# Apply the overlay
kubectl apply -k /tmp/kustomize/overlays/prod

# Verify
kubectl get deployment webapp -n production
kubectl get pods -n production
\`\`\``,
        verify: `\`\`\`bash
kubectl get deployment webapp -n production -o jsonpath='{.spec.replicas}'
# Expected: 3

kubectl get deployment webapp -n production -o jsonpath='{.spec.template.spec.containers[0].image}'
# Expected: nginx:1.21

kubectl get all -n production
# Expected: Deployment, ReplicaSet, 3 Pods, and Service all in production namespace
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Patch not applying to the resource',
      difficulty: 'easy',
      symptom: 'After running kubectl apply -k, the Deployment still has the old value. The patch file seems correct but nothing changed.',
      diagnosis: `\`\`\`bash
# Preview what kustomize actually generates
kubectl kustomize ./overlays/prod

# Check if the name matches exactly
grep "name:" overlays/prod/patch-replicas.yaml
grep "name:" base/deployment.yaml

# If namePrefix is configured, the patch target name must include it
grep namePrefix base/kustomization.yaml
grep namePrefix overlays/prod/kustomization.yaml
\`\`\``,
      solution: `The patch target name must match the FINAL name of the resource (after any namePrefix transformations).

If the base has namePrefix: myapp-, then the Deployment "api" becomes "myapp-api". Your patch must reference "myapp-api", not "api":

\`\`\`yaml
# Wrong:
metadata:
  name: api

# Correct (when base has namePrefix: myapp-):
metadata:
  name: myapp-api
\`\`\`

Or use the target selector in the patches field:
\`\`\`yaml
patches:
  - target:
      kind: Deployment
      name: api     # matches BEFORE prefix is applied
    path: patch.yaml
\`\`\``
    },
    {
      title: 'ConfigMap changes not reflected in pods',
      difficulty: 'medium',
      symptom: 'Updated a configMapGenerator entry. Applied with kubectl apply -k. The ConfigMap updated but Pods are still using the old configuration.',
      diagnosis: `\`\`\`bash
# Check ConfigMap name — it should have a new hash
kubectl get configmaps -n <namespace>
# Look for: app-config-<oldhash> and app-config-<newhash>

# Check what hash the pods reference
kubectl get pod <pod-name> -n <namespace> -o yaml | grep -A5 configMapRef

# Check the Deployment spec
kubectl get deployment <name> -n <namespace> -o yaml | grep -A5 configMap
\`\`\``,
      solution: `If disableNameSuffixHash: false (default), Kustomize generates a new ConfigMap with a new hash suffix. The Deployment should automatically reference the new name and trigger a rollout.

If pods are not updating, it means the Deployment spec still references the OLD ConfigMap name. This happens when the Deployment was not applied through Kustomize or was manually edited.

Fix: Re-apply the entire overlay through Kustomize:
\`\`\`bash
kubectl apply -k ./overlays/prod

# Check that the Deployment was updated
kubectl rollout status deployment/<name> -n <namespace>
\`\`\`

If you don't want hash-triggered rollouts, add disableNameSuffixHash: true and manually restart pods after ConfigMap updates:
\`\`\`bash
kubectl rollout restart deployment/<name> -n <namespace>
\`\`\``
    }
  ]
};
