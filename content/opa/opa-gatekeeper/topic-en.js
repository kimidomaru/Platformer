window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['opa/opa-gatekeeper'] = {
  theory: `# OPA Gatekeeper — Policy as Code in Kubernetes

## Exam Relevance
> OPA Gatekeeper is covered in KubeAstronaut and CKS. Focuses on ConstraintTemplates (Rego), Constraints, admission webhook, audit mode, and mutation policies.

## Core Concepts

### OPA vs Gatekeeper

**OPA (Open Policy Agent)**:
- Generic policy engine
- Accepts any JSON as input
- Evaluates rules written in Rego
- Used in APIs, Terraform, Kubernetes, etc.

**Gatekeeper**:
- OPA specialized for Kubernetes
- Implements ValidatingAdmissionWebhook
- Adds CRDs: ConstraintTemplate + Constraint
- Continuous auditing of existing resources
- Mutations (MutatingAdmissionWebhook)

### Admission Flow with Gatekeeper

\`\`\`
kubectl apply pod.yaml
       ↓
API Server receives request
       ↓
MutatingAdmissionWebhook (optional)
→ Gatekeeper Mutations (add labels, sidecar, etc.)
       ↓
ValidatingAdmissionWebhook
→ Gatekeeper evaluates all active Constraints
→ Executes Rego policy for each Constraint
       ↓
Allow or Reject (with error message)
       ↓
Resource created in etcd (if allowed)
\`\`\`

### ConstraintTemplate — Defining the Policy (Rego)

ConstraintTemplate defines:
1. The schema for the new Constraint CRD (which parameters it accepts)
2. The Rego policy that will be executed

\`\`\`yaml
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8srequiredlabels
spec:
  crd:
    spec:
      names:
        kind: K8sRequiredLabels   # name of the CRD to be created
      validation:
        openAPIV3Schema:
          type: object
          properties:
            labels:               # constraint parameters
              type: array
              items:
                type: object
                properties:
                  key:
                    type: string
                  allowedRegex:
                    type: string

  targets:
    - target: admission.k8s.gatekeeper.sh
      rego: |
        package k8srequiredlabels

        # Helper function: checks for label
        has_key(object, key) {
          _ = object[key]
        }

        # Violation: missing label
        violation[{"msg": msg, "details": {"missing_label": label}}] {
          required := input.parameters.labels[_]
          label := required.key
          not has_key(input.review.object.metadata.labels, label)
          msg := sprintf("you must provide the label: %v", [label])
        }

        # Violation: label with invalid value
        violation[{"msg": msg}] {
          required := input.parameters.labels[_]
          label := required.key
          regex := required.allowedRegex
          value := input.review.object.metadata.labels[label]
          not re_match(regex, value)
          msg := sprintf("label %v=%v does not match regex %v", [label, value, regex])
        }
\`\`\`

### Constraint — Applying the Policy

A Constraint instantiates a ConstraintTemplate with specific parameters:

\`\`\`yaml
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sRequiredLabels      # CRD created by ConstraintTemplate
metadata:
  name: require-team-label-production
spec:
  # Where to apply
  match:
    kinds:
      - apiGroups: ["apps"]
        kinds: ["Deployment", "StatefulSet"]
    namespaces:
      - production
      - staging
    # Exclude certain namespaces:
    excludedNamespaces:
      - kube-system
      - monitoring

  # Parameters for the Rego policy
  parameters:
    labels:
      - key: team
        allowedRegex: "^[a-z-]+\$"
      - key: environment
        allowedRegex: "^(production|staging|development)\$"
\`\`\`

### Audit Mode — Drift Detection

Gatekeeper periodically evaluates EXISTING resources (not just new ones):

\`\`\`yaml
# Configure audit interval
apiVersion: config.gatekeeper.sh/v1alpha1
kind: Config
metadata:
  name: config
  namespace: gatekeeper-system
spec:
  sync:
    syncOnly:
      - group: ""
        version: "v1"
        kind: "Namespace"
      - group: "apps"
        version: "v1"
        kind: "Deployment"
  validation:
    traces:
      - user: "user@example.com"
        kind:
          group: "apps"
          version: "v1"
          kind: "Deployment"
\`\`\`

Audit violations appear in \`status.violations\`:
\`\`\`bash
kubectl describe constraint require-team-label-production
# Status:
#   Violations:
#   - Message: you must provide the label: team
#     Resource:
#       Kind: Deployment
#       Name: legacy-app
#       Namespace: production
\`\`\`

### Gatekeeper Mutations

Mutations modify resources before validation:

\`\`\`yaml
apiVersion: mutations.gatekeeper.sh/v1
kind: AssignMetadata
metadata:
  name: add-default-labels
spec:
  match:
    scope: Namespaced
    kinds:
      - apiGroups: ["apps"]
        kinds: ["Deployment"]
    excludedNamespaces:
      - kube-system
  location: "metadata.labels.managed-by"
  parameters:
    assign:
      value: "gatekeeper"
\`\`\`

## Essential Commands

### Install Gatekeeper
\`\`\`bash
# Via official manifest
kubectl apply -f https://raw.githubusercontent.com/open-policy-agent/gatekeeper/v3.16.0/deploy/gatekeeper.yaml

# Via Helm
helm repo add gatekeeper https://open-policy-agent.github.io/gatekeeper/charts
helm install gatekeeper gatekeeper/gatekeeper \\
  --namespace gatekeeper-system \\
  --create-namespace

kubectl wait --for=condition=ready pod \\
  -l gatekeeper.sh/system=yes \\
  -n gatekeeper-system --timeout=120s
\`\`\`

### Manage Constraints
\`\`\`bash
# List ConstraintTemplates
kubectl get constrainttemplates

# List Constraints by type
kubectl get k8srequiredlabels
kubectl get constraints  # all types

# View violations of a Constraint
kubectl describe k8srequiredlabels require-team-label-production

# Dry-run mode (doesn't block, only records)
kubectl annotate constrainttemplate k8srequiredlabels \\
  "constraint.gatekeeper.sh/disable-enforcement=yes" --overwrite

# Force immediate re-audit
kubectl annotate config config \\
  -n gatekeeper-system \\
  "audit.gatekeeper.sh/trigger-audit=\$(date +%s)" --overwrite

# View Gatekeeper logs
kubectl logs -n gatekeeper-system -l control-plane=controller-manager -f
kubectl logs -n gatekeeper-system -l control-plane=audit-controller -f
\`\`\`

### Test Policies
\`\`\`bash
# Test that pod is rejected (without required labels)
kubectl run no-label-pod --image=nginx -n production
# Expected: Error - admission webhook denied: you must provide the label: team

# Apply with correct labels
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: compliant-app
  namespace: production
  labels:
    team: backend
    environment: production
spec:
  replicas: 1
  selector:
    matchLabels:
      app: compliant-app
  template:
    metadata:
      labels:
        app: compliant-app
    spec:
      containers:
        - name: app
          image: nginx
EOF
# Expected: deployment.apps/compliant-app created (no error)
\`\`\`

## YAML Examples

### ConstraintTemplate: Required Container Limits
\`\`\`yaml
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8scontainerlimits
spec:
  crd:
    spec:
      names:
        kind: K8sContainerLimits
      validation:
        openAPIV3Schema:
          type: object
          properties:
            cpu:
              type: string
            memory:
              type: string
  targets:
    - target: admission.k8s.gatekeeper.sh
      rego: |
        package k8scontainerlimits

        missing_limit(container, resource) {
          not container.resources.limits[resource]
        }

        violation[{"msg": msg}] {
          container := input.review.object.spec.containers[_]
          missing_limit(container, "cpu")
          msg := sprintf("Container %v must have limits.cpu defined", [container.name])
        }

        violation[{"msg": msg}] {
          container := input.review.object.spec.containers[_]
          missing_limit(container, "memory")
          msg := sprintf("Container %v must have limits.memory defined", [container.name])
        }
\`\`\`

### ConstraintTemplate: Allowed Image Registries
\`\`\`yaml
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8sallowedrepos
spec:
  crd:
    spec:
      names:
        kind: K8sAllowedRepos
      validation:
        openAPIV3Schema:
          type: object
          properties:
            repos:
              type: array
              items:
                type: string
  targets:
    - target: admission.k8s.gatekeeper.sh
      rego: |
        package k8sallowedrepos

        violation[{"msg": msg}] {
          container := input.review.object.spec.containers[_]
          not any_valid_repo(container.image)
          msg := sprintf("Image %v is not from an allowed repository", [container.image])
        }

        any_valid_repo(image) {
          repo := input.parameters.repos[_]
          startswith(image, repo)
        }

---
# Constraint applying the policy
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sAllowedRepos
metadata:
  name: require-approved-repos
spec:
  match:
    kinds:
      - apiGroups: [""]
        kinds: ["Pod"]
    namespaces: ["production", "staging"]
  parameters:
    repos:
      - "docker.io/company/"      # private registry
      - "ghcr.io/company/"        # GitHub Container Registry
      - "registry.k8s.io/"        # Official Kubernetes
\`\`\`

### Gatekeeper Mutation: Add Sidecar
\`\`\`yaml
apiVersion: mutations.gatekeeper.sh/v1
kind: Assign
metadata:
  name: add-logging-sidecar
spec:
  match:
    scope: Namespaced
    kinds:
      - apiGroups: ["apps"]
        kinds: ["Deployment"]
    namespaces: ["production"]
    labelSelector:
      matchLabels:
        inject-logging: "true"
  location: "spec.template.spec.containers[name:logging-agent]"
  parameters:
    assign:
      value:
        name: logging-agent
        image: fluent/fluent-bit:2.1
        resources:
          requests:
            cpu: 50m
            memory: 64Mi
\`\`\`

## Common Errors

### 1. ConstraintTemplate in "Created" state but Constraint rejected
**Cause**: Rego syntax error in the template — OPA cannot compile it.
**Solution**: \`kubectl describe constrainttemplate k8srequiredlabels\` → check Status/Errors field.

### 2. Constraint in "dryrun" mode with no effect
**Cause**: enforcementAction is set to "dryrun" (records but doesn't block).
**Solution**: Change to \`enforcementAction: deny\` when ready for enforcement.

### 3. Audit not finding violations in existing resources
**Cause**: Resource type is not in \`config.sync.syncOnly\`.
**Solution**: Add the kind to Gatekeeper's sync configuration.

### 4. Gatekeeper webhook in fail-open mode
**Cause**: webhookFailurePolicy: Ignore — if Gatekeeper goes down, everything is admitted.
**Solution**: For critical security, use \`webhookFailurePolicy: Fail\` (blocks if Gatekeeper unavailable).

### 5. Overly broad Constraints affect system operations
**Cause**: match without excludedNamespaces for kube-system.
**Solution**: Always exclude system namespaces: kube-system, gatekeeper-system, kube-public.

## Killer.sh Style Challenge

**Context**: The cluster needs policy governance. You must:
1. Install Gatekeeper on the cluster
2. Create a ConstraintTemplate requiring labels \`team\` and \`cost-center\` on all Deployments
3. Create a Constraint applying the policy in namespaces \`production\` and \`staging\`
4. Test that a Deployment without labels is rejected
5. Verify existing violations via \`kubectl describe constraint\`
6. Create a Constraint in dryrun mode to identify violations without blocking`,

  quiz: [
    {
      question: 'What does the "targets[].rego" field in a ConstraintTemplate define?',
      options: [
        'The namespace where the policy will be applied',
        'The authorization policy written in Rego language executed by OPA',
        'The Kubernetes resource types that will be evaluated',
        'The access credentials for the API Server for Gatekeeper'
      ],
      correct: 1,
      explanation: 'The rego field contains the admission policy written in Rego language (OPA\'s language). It is executed for each resource matching the Constraint. The violation[] function is the main one — when it returns any element, the resource is rejected with the specified message.',
      reference: 'Concept: ConstraintTemplate — dedicated section in theory.'
    },
    {
      question: 'What is the difference between ConstraintTemplate and Constraint in Gatekeeper?',
      options: [
        'ConstraintTemplate is for auditing; Constraint is for enforcement',
        'ConstraintTemplate defines the reusable Rego policy; Constraint instantiates it with specific parameters and scope',
        'ConstraintTemplate applies mutations; Constraint applies validations',
        'There is no difference — they are synonyms for the same object'
      ],
      correct: 1,
      explanation: 'ConstraintTemplate defines WHAT to check (Rego policy) and creates a new CRD. Constraint INSTANTIATES that template with: specific parameters (which labels are required), scope (which namespaces, kinds) and enforcement mode. It separates policy logic from its application.',
      reference: 'Concept: ConstraintTemplate vs Constraint — dedicated section in theory.'
    },
    {
      question: 'What does the "enforcementAction: dryrun" field in a Constraint do?',
      options: [
        'Blocks non-compliant resources and records to the log',
        'Records violations in status.violations without blocking resource creation',
        'Applies the policy only in development environments',
        'Disables automatic audit for this Constraint'
      ],
      correct: 1,
      explanation: 'dryrun executes the policy and records violations in the Constraint\'s status.violations, but does NOT block resource admission. It is the safe way to test new policies in production without impacting existing workloads. "deny" blocks; "warn" allows through but issues a warning.',
      reference: 'Concept: Audit Mode — dedicated section in theory.'
    },
    {
      question: 'How do you check violations of a Constraint on existing resources?',
      options: [
        'kubectl logs -n gatekeeper-system | grep violation',
        'kubectl describe constraint <name> — Status.Violations section',
        'kubectl audit constraint <name>',
        'kubectl get violations --all-namespaces'
      ],
      correct: 1,
      explanation: 'kubectl describe constraint <name> shows the Status.Violations section with all existing resources that violate the policy — namespace, name and violation message. Gatekeeper updates this section periodically via the audit controller.',
      reference: 'Commands: kubectl describe constraint — "Audit Mode" section in theory.'
    },
    {
      question: 'Why is it important to add kube-system to excludedNamespaces in Constraints?',
      options: [
        'For performance — Gatekeeper is slower when evaluating kube-system',
        'Restrictive policies in kube-system can prevent critical cluster operations',
        'Gatekeeper does not have permission to evaluate resources in kube-system',
        'kube-system labels have a different format incompatible with Rego'
      ],
      correct: 1,
      explanation: 'System components (kube-dns, kube-proxy, metrics-server) are created by Kubernetes itself and may not have the business labels (team, cost-center) that a Constraint requires. Blocking these resources can break essential cluster functionality.',
      reference: 'Common errors: Overly broad Constraints — "Common Errors" section in theory.'
    },
    {
      question: 'What does the Gatekeeper "Config" object\'s sync.syncOnly control?',
      options: [
        'Which users have permission to create Constraints',
        'Which resource types are synchronized in Gatekeeper\'s cache for audit',
        'The frequency of checking for new violations',
        'Which namespaces are excluded from all policies'
      ],
      correct: 1,
      explanation: 'sync.syncOnly defines which resource types Gatekeeper keeps in local cache for the audit controller. Without synchronization, the audit cannot find violations in existing resources. By default, only resources submitted via admission are evaluated — sync.syncOnly enables checking pre-existing resources.',
      reference: 'Concept: Audit Mode — Config object in theory.'
    },
    {
      question: 'Which Gatekeeper object is used to MODIFY resources (add labels, inject sidecars) before validation?',
      options: [
        'Constraint with operation: mutate',
        'AssignMetadata or Assign (Mutations CRD)',
        'ConstraintTemplate with target: mutating',
        'MutatingPolicy CRD'
      ],
      correct: 1,
      explanation: 'Gatekeeper Mutations uses specific CRDs: AssignMetadata (to modify metadata.labels/annotations) and Assign (to modify any spec field). They implement the MutatingAdmissionWebhook and execute BEFORE validation, allowing injection of default values, sidecars, etc.',
      reference: 'Concept: Mutations — "Gatekeeper Mutations" section in theory.'
    },
    {
      question: 'What happens to admission requests if the Gatekeeper pod goes down and webhookFailurePolicy: Fail?',
      options: [
        'All resources are admitted normally (fail-open)',
        'All resources are rejected until Gatekeeper comes back (fail-closed)',
        'Only Pods are rejected; other resources are admitted',
        'The API Server automatically disables the webhook'
      ],
      correct: 1,
      explanation: 'With webhookFailurePolicy: Fail, if the Gatekeeper webhook does not respond, the API Server REJECTS all admissions that would go through the webhook. It is more secure (ensures nothing passes without evaluation) but can cause unavailability if Gatekeeper goes down. Ignore is fail-open (less secure).',
      reference: 'Common errors: webhook failure policy — "Common Errors" section in theory.'
    }
  ],

  flashcards: [
    {
      front: 'What is Gatekeeper and how does it differ from standalone OPA?',
      back: 'Standalone OPA:\n- Generic policy engine\n- Accepts any JSON\n- No native K8s integration\n- Separate deployment\n\nGatekeeper (OPA for Kubernetes):\n- Implements ValidatingAdmissionWebhook\n- Native CRDs: ConstraintTemplate + Constraint\n- Continuous auditing of existing resources\n- MutatingAdmissionWebhook via Mutations\n- Integrated into K8s admission cycle\n- Violation status directly on K8s objects'
    },
    {
      front: 'What is the relationship between ConstraintTemplate and Constraint?',
      back: 'ConstraintTemplate:\n- Defines the POLICY (Rego code)\n- Creates a new CRD (e.g., K8sRequiredLabels)\n- Reusable — 1 template, N constraints\n- Defines parameter schema\n\nConstraint:\n- INSTANTIATES the template\n- Defines: parameters, scope, enforcement\n- e.g.: K8sRequiredLabels with parameters\n  {labels: [{key: "team"}]}\n- Multiple Constraints from same template\n\nAnalogy:\n- Template = "class" in OOP\n- Constraint = "instance" of the class'
    },
    {
      front: 'What are the 3 values of enforcementAction in Constraints?',
      back: 'deny:\n- Blocks resource creation/update\n- Returns immediate error to user\n- For policies in production\n\ndryrun:\n- Does NOT block admission\n- Records in status.violations\n- For testing new policy without impact\n- Ideal to "migrate" to deny gradually\n\nwarn:\n- Admits the resource but issues warning\n- Warning visible in API response\n- Less restrictive than deny\n- For notifying without blocking\n\nRecommended progression: dryrun → warn → deny'
    },
    {
      front: 'What is the basic structure of a Rego policy in Gatekeeper?',
      back: 'package k8smypolicy\n\n# violation[{"msg": msg}]: defines when there is a violation\n# - msg: error message string\n# - If violations = empty: ALLOWED\n# - If violations has items: REJECTED\n\nviolation[{"msg": msg}] {\n  # Conditions for violation\n  container := input.review.object.spec.containers[_]\n  not container.resources.limits.memory\n  msg := sprintf("Container %v needs limits.memory", [container.name])\n}\n\n# Available inputs:\n# input.review.object → resource being admitted\n# input.parameters → params from Constraint\n# input.review.userInfo → user making the request'
    },
    {
      front: 'How do you check violations of existing Constraints?',
      back: '# See all constraints and violation counts\nkubectl get constraints\n# VIOLATIONS column shows count\n\n# See violation details\nkubectl describe constraint require-team-label\n# Status.Violations:\n#   - Kind: Deployment\n#     Name: legacy-app\n#     Namespace: production\n#     Message: you must provide the label: team\n\n# For audit to work, add to Config:\nkubectl get config config -n gatekeeper-system -o yaml\n# spec.sync.syncOnly must include the Kind\n\n# Force re-audit\nkubectl annotate config config \\\n  -n gatekeeper-system \\\n  "audit.gatekeeper.sh/trigger-audit=\$(date +%s)" --overwrite'
    },
    {
      front: 'How do you install Gatekeeper and verify it is working?',
      back: '# Via manifest\nkubectl apply -f https://raw.githubusercontent.com/open-policy-agent/gatekeeper/v3.16.0/deploy/gatekeeper.yaml\n\n# Via Helm\nhelm repo add gatekeeper https://open-policy-agent.github.io/gatekeeper/charts\nhelm install gatekeeper gatekeeper/gatekeeper \\\n  -n gatekeeper-system --create-namespace\n\n# Check pods\nkubectl get pods -n gatekeeper-system\n# controller-manager (webhook), audit-controller\n\n# Verify webhook registered\nkubectl get validatingwebhookconfiguration | grep gatekeeper\n\n# Verify CRDs\nkubectl get crd | grep gatekeeper.sh'
    },
    {
      front: 'What are Gatekeeper Mutations and what are they used for?',
      back: 'Mutations implement MutatingAdmissionWebhook:\nEXECUTE BEFORE validation\n\nUse cases:\n- Inject default label (managed-by: gatekeeper)\n- Add billing annotation\n- Inject sidecar (logging, security)\n- Set default resource limits\n- Force imagePullPolicy: Always\n\nAvailable CRDs:\n- AssignMetadata: modifies metadata.labels/annotations\n- Assign: modifies any spec field\n- ModifySet: adds/removes items from lists\n\nExample:\napiVersion: mutations.gatekeeper.sh/v1\nkind: AssignMetadata\nspec:\n  location: "metadata.labels.managed-by"\n  parameters:\n    assign:\n      value: "gatekeeper"'
    },
    {
      front: 'Why exclude kube-system from Constraints and what is the risk of not doing so?',
      back: 'Why exclude:\n- kube-dns, kube-proxy, coredns: no business labels\n- metrics-server, cluster-autoscaler: created without required labels\n- If blocked: cluster can break!\n\nRisk of NOT excluding:\n- New "required labels" policy blocks kube-dns update\n- CoreDNS failing → cluster DNS broken\n- Cluster may become unusable\n\nSolution:\nspec:\n  match:\n    excludedNamespaces:\n      - kube-system\n      - gatekeeper-system\n      - kube-public\n      - monitoring\n      - cert-manager'
    }
  ],

  lab: {
    scenario: 'The platform team needs to implement label governance to ensure cost traceability. All Deployments in production must have "team" and "cost-center" labels. You must implement this with Gatekeeper.',
    objective: 'Install Gatekeeper, create a ConstraintTemplate for required labels, apply Constraint in production, test enforcement and verify existing violations via audit.',
    duration: '30-40 minutes',
    steps: [
      {
        title: 'Install Gatekeeper on the Cluster',
        instruction: `Install Gatekeeper via Helm in the \`gatekeeper-system\` namespace and verify that the components are Running.

After installing, verify:
1. controller-manager and audit-controller pods
2. ValidatingWebhookConfiguration registered
3. Gatekeeper CRDs created`,
        hints: [
          'The Helm repository is gatekeeper/gatekeeper',
          'The default namespace is gatekeeper-system',
          'Wait for pods to be Ready before creating Constraints'
        ],
        solution: `\`\`\`bash
# Install via Helm
helm repo add gatekeeper https://open-policy-agent.github.io/gatekeeper/charts
helm repo update

helm install gatekeeper gatekeeper/gatekeeper \\
  --namespace gatekeeper-system \\
  --create-namespace \\
  --set controllerManager.dnsPolicy=ClusterFirst \\
  --set audit.dnsPolicy=ClusterFirst

kubectl wait --for=condition=ready pod \\
  -l gatekeeper.sh/system=yes \\
  -n gatekeeper-system --timeout=180s

# Create test namespace
kubectl create namespace production
kubectl label namespace production env=production
\`\`\``,
        verify: `\`\`\`bash
# Verify pods
kubectl get pods -n gatekeeper-system
# Expected output:
# gatekeeper-audit-xxx           1/1   Running
# gatekeeper-controller-xxx      1/1   Running
# gatekeeper-controller-xxx      1/1   Running (2 replicas)

# Verify webhook
kubectl get validatingwebhookconfiguration | grep gatekeeper
# Expected output: gatekeeper-validating-webhook-configuration

# Verify CRDs
kubectl get crd | grep gatekeeper.sh | head -5
# Expected output: constraints, configs, constrainttemplates, etc.
\`\`\``
      },
      {
        title: 'Create ConstraintTemplate and Constraint',
        instruction: `Create:
1. A \`K8sRequiredLabels\` ConstraintTemplate that requires specific labels on Deployments
2. A \`require-billing-labels\` Constraint applying the policy in \`production\` requiring labels \`team\` and \`cost-center\`
3. Test that a Deployment without labels is rejected
4. Test that a Deployment with correct labels is accepted`,
        hints: [
          'The ConstraintTemplate name becomes the Kind of the created CRD (K8sRequiredLabels)',
          'The Constraint uses the Kind defined by the ConstraintTemplate',
          'The match.kinds field must include {apiGroups: ["apps"], kinds: ["Deployment"]}',
          'Always exclude system namespaces in match.excludedNamespaces'
        ],
        solution: `\`\`\`bash
# Create ConstraintTemplate
kubectl apply -f - <<EOF
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8srequiredlabels
spec:
  crd:
    spec:
      names:
        kind: K8sRequiredLabels
      validation:
        openAPIV3Schema:
          type: object
          properties:
            labels:
              type: array
              items:
                type: string
  targets:
    - target: admission.k8s.gatekeeper.sh
      rego: |
        package k8srequiredlabels

        violation[{"msg": msg}] {
          label := input.parameters.labels[_]
          not input.review.object.metadata.labels[label]
          msg := sprintf("Missing required label: %v", [label])
        }
EOF

# Wait for CRD to be created
sleep 5
kubectl get crd k8srequiredlabels.constraints.gatekeeper.sh

# Create Constraint
kubectl apply -f - <<EOF
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sRequiredLabels
metadata:
  name: require-billing-labels
spec:
  enforcementAction: deny
  match:
    kinds:
      - apiGroups: ["apps"]
        kinds: ["Deployment"]
    namespaces:
      - production
    excludedNamespaces:
      - kube-system
      - gatekeeper-system
  parameters:
    labels:
      - team
      - cost-center
EOF

# Test rejection (without labels)
kubectl create deployment no-labels-app \\
  --image=nginx -n production
# Expected: ERROR - Missing required label: team

# Test acceptance (with labels)
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: compliant-app
  namespace: production
  labels:
    team: backend
    cost-center: CC-001
spec:
  replicas: 1
  selector:
    matchLabels:
      app: compliant-app
  template:
    metadata:
      labels:
        app: compliant-app
    spec:
      containers:
        - name: app
          image: nginx:latest
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verify ConstraintTemplate
kubectl get constrainttemplate k8srequiredlabels
# Expected output: k8srequiredlabels   Xs

# Verify Constraint
kubectl get k8srequiredlabels require-billing-labels
# Expected output: require-billing-labels   deny   X  (violations count)

# Verify that Deployment without labels was rejected
kubectl get deployment no-labels-app -n production 2>&1
# Expected output: Error from server (Forbidden) or Not Found

# Verify that Deployment with labels was created
kubectl get deployment compliant-app -n production
# Expected output: compliant-app   1/1   Running

# View existing violations
kubectl describe k8srequiredlabels require-billing-labels | grep -A10 "Violations"
\`\`\``
      },
      {
        title: 'Test Audit Mode and Add DryRun Constraint',
        instruction: `Configure audit mode to detect violations in existing resources and create a second Constraint in dryrun mode to test a new policy without blocking workloads.

1. Create a Deployment without labels in the \`staging\` namespace (simulating a legacy resource)
2. Create a Constraint for staging in dryrun mode
3. Verify that the Deployment was CREATED (dryrun doesn't block)
4. Verify the violations in the Constraint status`,
        hints: [
          'staging namespace needs to be created first',
          'enforcementAction: dryrun records violations without blocking',
          'The audit controller checks periodically — wait a few minutes',
          'kubectl describe constraint shows violations in the Status section'
        ],
        solution: `\`\`\`bash
# Create staging namespace
kubectl create namespace staging

# Create legacy Deployment (without labels) before the Constraint
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: legacy-app
  namespace: staging
  # No required labels!
spec:
  replicas: 1
  selector:
    matchLabels:
      app: legacy-app
  template:
    metadata:
      labels:
        app: legacy-app
    spec:
      containers:
        - name: app
          image: nginx:latest
EOF

# Create Constraint in dryrun for staging
kubectl apply -f - <<EOF
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sRequiredLabels
metadata:
  name: require-billing-labels-staging
spec:
  enforcementAction: dryrun  # does not block!
  match:
    kinds:
      - apiGroups: ["apps"]
        kinds: ["Deployment"]
    namespaces:
      - staging
  parameters:
    labels:
      - team
      - cost-center
EOF

# Try creating another deployment without labels (should work in dryrun)
kubectl create deployment dryrun-test \\
  --image=nginx -n staging
# Expected: deployment created (dryrun doesn't block)

# Wait for audit (may take 1-2 minutes)
sleep 90

# View violations
kubectl describe k8srequiredlabels require-billing-labels-staging
\`\`\``,
        verify: `\`\`\`bash
# Verify that legacy-app and dryrun-test exist (were not blocked)
kubectl get deployments -n staging
# Expected output: legacy-app, dryrun-test both Running

# Verify violations in dryrun Constraint
kubectl describe k8srequiredlabels require-billing-labels-staging | \\
  grep -A15 "Violations"
# Expected output:
#   Violations:
#   - Kind: Deployment
#     Name: legacy-app
#     Namespace: staging
#     Message: Missing required label: team
#   - Kind: Deployment
#     Name: dryrun-test
#     ...

# Compare with deny Constraint (production) — should have no violations
kubectl describe k8srequiredlabels require-billing-labels | grep "Total Violations"
# Expected output: 0 (since compliant-app has the labels)
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'ConstraintTemplate created but Constraint returns "no matches for kind"',
      difficulty: 'easy',
      symptom: 'After creating the ConstraintTemplate, when trying to create the Constraint with the defined Kind, kubectl returns "no matches for kind K8sRequiredLabels in version constraints.gatekeeper.sh/v1beta1".',
      diagnosis: `\`\`\`bash
# Check if CRD was created
kubectl get crd | grep k8srequiredlabels

# View ConstraintTemplate status
kubectl describe constrainttemplate k8srequiredlabels

# Check for Rego compilation errors
kubectl get constrainttemplate k8srequiredlabels -o json | \\
  jq '.status'

# Check Gatekeeper logs
kubectl logs -n gatekeeper-system \\
  -l control-plane=controller-manager --tail=50 | \\
  grep -i "error\\|rego\\|compile"
\`\`\``,
      solution: `**Cause 1**: ConstraintTemplate not yet processed — wait a few seconds.
\`\`\`bash
# Verify CRD is present
kubectl get crd k8srequiredlabels.constraints.gatekeeper.sh
# If Not Found: wait 10-30s and try again

# View template status
kubectl get constrainttemplate k8srequiredlabels -o yaml | grep -A10 "status:"
# Wait until "byPod" appears with status "TRUE"
\`\`\`

**Cause 2**: Rego syntax error — template failed to compile.
\`\`\`bash
kubectl describe constrainttemplate k8srequiredlabels | grep -A5 "Errors:"
# If there is a Rego error message: fix the syntax

# Test Rego policy locally before applying:
# https://play.openpolicyagent.org/
\`\`\`

**Cause 3**: CRD name mismatch — spec.crd.spec.names.kind is wrong.
\`\`\`bash
# The Kind in ConstraintTemplate must be EXACTLY the same in the Constraint
kubectl get constrainttemplate k8srequiredlabels -o jsonpath='{.spec.crd.spec.names.kind}'
# Use this exact Kind in the Constraint
\`\`\``
    },
    {
      title: 'Constraint blocks Gatekeeper deployments in gatekeeper-system',
      difficulty: 'medium',
      symptom: 'After creating an overly broad Constraint, Gatekeeper itself cannot update its internal components. kubectl rollout restart deployment gatekeeper-controller-manager hangs.',
      diagnosis: `\`\`\`bash
# View events from Gatekeeper Deployment
kubectl describe deployment gatekeeper-controller-manager \\
  -n gatekeeper-system | grep -A10 "Events:"

# Check if ReplicaSet is Pending due to admission denial
kubectl get pods -n gatekeeper-system
kubectl describe pod -n gatekeeper-system \\
  -l control-plane=controller-manager | grep -A5 "Events:"

# See which Constraint is blocking
kubectl get constraints --all-namespaces -o json | \\
  jq '.items[] | select(.spec.match.excludedNamespaces == null or
    (.spec.match.excludedNamespaces | index("gatekeeper-system") | not)) |
    .metadata.name'
\`\`\``,
      solution: `**Immediate solution — Add gatekeeper-system to excludedNamespaces**:
\`\`\`bash
# Edit all problematic Constraints
kubectl get k8srequiredlabels -o name | while read constraint; do
  kubectl patch \$constraint --type='merge' \\
    -p '{"spec":{"match":{"excludedNamespaces":["kube-system","gatekeeper-system","kube-public"]}}}'
done
\`\`\`

**Emergency solution — Temporary dryrun mode**:
\`\`\`bash
# Change all Constraints to dryrun temporarily
kubectl get k8srequiredlabels -o name | while read constraint; do
  kubectl patch \$constraint --type='merge' \\
    -p '{"spec":{"enforcementAction":"dryrun"}}'
done

# Now the rollout can proceed
kubectl rollout restart deployment gatekeeper-controller-manager \\
  -n gatekeeper-system

# After Gatekeeper is stable, revert to deny and add excludedNamespaces
\`\`\``
    }
  ]
};
