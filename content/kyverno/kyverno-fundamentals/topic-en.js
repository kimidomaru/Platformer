window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['kyverno/kyverno-fundamentals'] = {
  theory: `
# Kyverno Fundamentals

## Relevance
Kyverno is a Kubernetes-native Policy Engine — unlike OPA/Gatekeeper, it is written specifically for K8s and uses pure YAML to define policies (no programming language needed). It is a CNCF Graduated project widely adopted for cluster security and governance. Essential for any security or platform engineering track.

## Core Concepts

### What is Kyverno?

\`\`\`
Kyverno (Greek: "to govern") is a K8s-native Policy Engine:

                    ┌──────────────────────────────────┐
                    │         Kubernetes API Server     │
                    └──────────────┬───────────────────┘
                                   │ Admission Request
                    ┌──────────────▼───────────────────┐
                    │         Kyverno Webhook           │
                    │  ┌────────────────────────────┐  │
                    │  │    Policy Engine            │  │
                    │  │  ├─ Validate (allow/deny)   │  │
                    │  │  ├─ Mutate (modify)         │  │
                    │  │  ├─ Generate (create new)   │  │
                    │  │  └─ Verify Images (cosign)  │  │
                    │  └────────────────────────────┘  │
                    └──────────────────────────────────┘

Key points:
- Policies in pure YAML (no Rego, no special CEL)
- CRDs: ClusterPolicy (cluster) and Policy (namespace)
- Background scanning for existing resources
- PolicyReports for auditing
- CLI (kyverno) for local testing
\`\`\`

### Rule Types

| Type | Function | When |
|------|----------|------|
| **validate** | Accept or reject resources | Admission (mutating/validating webhook) |
| **mutate** | Modify resources on create/update | Admission (mutating webhook) |
| **generate** | Create new resources based on triggers | Post-admission |
| **verifyImages** | Verify container image signatures | Admission |

### ClusterPolicy Structure

\`\`\`yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy                  # cluster-wide (or Policy for namespace)
metadata:
  name: require-labels
  annotations:
    policies.kyverno.io/title: Require Labels
    policies.kyverno.io/severity: medium    # low/medium/high/critical
    policies.kyverno.io/category: Best Practices
spec:
  # How to handle webhook failures
  failurePolicy: Fail                # Fail (default) or Ignore
  # Mode: Enforce (blocks) or Audit (just reports)
  validationFailureAction: Enforce   # or Audit
  background: true                   # Scan existing resources
  rules:
    - name: check-for-labels         # Unique rule name
      match:
        any:
          - resources:
              kinds:
                - Deployment         # Target resource types
              namespaces:
                - "!kube-system"     # Exclude system namespaces
      validate:
        message: "Deployment must have label 'app'."
        pattern:
          metadata:
            labels:
              app: "?*"              # Pattern: at least 1 character
\`\`\`

### Match and Exclude — Rule Scope

\`\`\`yaml
spec:
  rules:
    - name: example
      match:
        any:                          # Any of these criteria
          - resources:
              kinds: [Deployment, StatefulSet]
              namespaces: ["production"]
              selector:
                matchLabels:
                  app: critical
        all:                          # All of these criteria
          - resources:
              operations: [CREATE, UPDATE]  # Only on create and update
      exclude:
        any:
          - resources:
              namespaces: ["kube-system", "kube-public"]
          - subjects:                 # Exclude specific users/SAs
              - kind: ServiceAccount
                name: system-admin
                namespace: kube-system
\`\`\`

### Validate — Pattern

\`\`\`yaml
# Validate with pattern matching
validate:
  message: "Resources must have limits defined."
  pattern:
    spec:
      containers:
        - resources:
            limits:
              memory: "?*"
              cpu: "?*"

# Kyverno wildcards:
# ?* — at least 1 character (not empty)
# *  — any value including empty
# ?  — exactly 1 character
\`\`\`

### Validate — Deny with CEL/JMESPath

\`\`\`yaml
# Deny with condition
validate:
  message: "Privileged containers are not allowed."
  deny:
    conditions:
      any:
        - key: "{{ request.object.spec.containers[].securityContext.privileged }}"
          operator: AnyIn
          value: [true]
\`\`\`

### Mutate — Add Fields

\`\`\`yaml
# Add labels automatically
rules:
  - name: add-labels
    match:
      any:
        - resources:
            kinds: [Deployment]
    mutate:
      patchStrategicMerge:
        metadata:
          labels:
            managed-by: kyverno
            environment: "{{ request.namespace }}"
\`\`\`

\`\`\`yaml
# Add default resource limits if not defined
rules:
  - name: add-default-limits
    match:
      any:
        - resources:
            kinds: [Pod]
    preconditions:
      all:
        - key: "{{ request.object.spec.containers[].resources.limits | length(@) }}"
          operator: Equals
          value: "0"
    mutate:
      foreach:
        - list: "request.object.spec.containers"
          patchStrategicMerge:
            spec:
              containers:
                - (name): "{{ element.name }}"
                  resources:
                    limits:
                      memory: 512Mi
                      cpu: 500m
\`\`\`

### Generate — Create Resources Automatically

\`\`\`yaml
# Create default NetworkPolicy in every new namespace
rules:
  - name: default-deny-network
    match:
      any:
        - resources:
            kinds: [Namespace]
    generate:
      synchronize: true              # Keep in sync (re-create if deleted)
      apiVersion: networking.k8s.io/v1
      kind: NetworkPolicy
      name: default-deny-all
      namespace: "{{ request.object.metadata.name }}"
      data:
        spec:
          podSelector: {}
          policyTypes:
            - Ingress
            - Egress
\`\`\`

### Installing Kyverno

\`\`\`bash
# Via Helm (recommended)
helm repo add kyverno https://kyverno.github.io/kyverno/
helm install kyverno kyverno/kyverno \\
  --namespace kyverno \\
  --create-namespace \\
  --set admissionController.replicas=3    # HA for production

# Verify installation
kubectl get pods -n kyverno
# Expected:
# kyverno-admission-controller-xxx    Running
# kyverno-background-controller-xxx   Running
# kyverno-cleanup-controller-xxx      Running
# kyverno-reports-controller-xxx      Running

# Verify installed CRDs
kubectl get crds | grep kyverno
# ClusterPolicy, Policy, PolicyReport, ClusterPolicyReport, etc.
\`\`\`

### PolicyReport — Auditing

\`\`\`yaml
# PolicyReports are automatically created by Kyverno
# for resources that don't satisfy policies in Audit mode

# List PolicyReports in namespace
kubectl get policyreport -n my-namespace

# See details
kubectl describe policyreport cpol-require-labels -n my-namespace

# ClusterPolicyReport for cluster-scoped resources
kubectl get clusterpolicyreport
\`\`\`

### Common Mistakes

1. **validationFailureAction Audit vs Enforce** — In Audit, policies do NOT block; they only generate PolicyReports. To block, use Enforce.
2. **background: false** — Without background scanning, policies only apply to new resources, not existing ones.
3. **failurePolicy: Fail** — If Kyverno is down, admissions are rejected. Use Ignore for non-critical ones in dev.
4. **Too broad match** — Match without namespace filter can affect kube-system and break the cluster. Always exclude system namespaces.
5. **Pattern vs deny** — Pattern is simpler for structure; deny with conditions is needed for complex logic.

## Killer.sh Style Challenge

> **Scenario:** Create a ClusterPolicy called \`require-resources\` that: (1) applies to Deployments and StatefulSets in all namespaces except kube-system and kube-public, (2) validates that all containers have CPU and memory limits defined, (3) Enforce mode, (4) background scanning enabled. Test with a Deployment without limits.
`,
  quiz: [
    {
      question: 'What is the difference between ClusterPolicy and Policy in Kyverno?',
      options: [
        'ClusterPolicy is more powerful than Policy',
        'ClusterPolicy is cluster-scoped (applies to all namespaces); Policy is namespace-scoped (applies only to its own namespace)',
        'Policy supports more rule types than ClusterPolicy',
        'There is no difference — they are aliases'
      ],
      correct: 1,
      explanation: 'ClusterPolicy is a cluster-scoped resource that can apply to any namespace. Policy is a namespace-scoped resource that can only generate policies within its own namespace. For global security policies, always use ClusterPolicy.',
      reference: 'Related concept: Administrators create ClusterPolicies; teams can create Policies in their namespace.'
    },
    {
      question: 'What is the difference between validationFailureAction: Enforce and Audit?',
      options: [
        'Enforce is faster than Audit',
        'Enforce blocks resources that violate the policy; Audit only records the violation in PolicyReports without blocking',
        'Audit only works with background scanning',
        'Enforce only works in production'
      ],
      correct: 1,
      explanation: 'Enforce: Kyverno rejects the admission request when the policy is violated — the resource is not created. Audit: the resource is created normally but an entry is recorded in the PolicyReport. Audit is useful for detecting violations without impacting existing workloads.',
      reference: 'Related concept: Start with Audit to validate impact before moving to Enforce.'
    },
    {
      question: 'What does the wildcard "?*" mean in a Kyverno pattern?',
      options: [
        'Any value including empty',
        'At least one character (field cannot be empty or absent)',
        'Exactly one character',
        'A positive numeric value'
      ],
      correct: 1,
      explanation: '"?*" in Kyverno means "at least one character" — the field must exist and cannot be an empty string. It is different from "*" (anything including empty). Widely used to validate that required labels are defined.',
      reference: 'Related concept: Use "?*" for required fields and ">=0" for minimum numeric values.'
    },
    {
      question: 'What does the background: true field do in a ClusterPolicy?',
      options: [
        'To run the policy in a background thread',
        'To scan existing resources in the cluster and generate PolicyReports, not just new resources',
        'To apply the policy only to background workloads',
        'To disable the webhook and use only periodic scanning'
      ],
      correct: 1,
      explanation: 'background: true (default) enables the Kyverno Background Controller to scan existing resources and generate PolicyReports. Without this, the policy only applies to new resources via the admission webhook. Essential for auditing the current cluster state.',
      reference: 'Related concept: Background scanning uses more cluster resources. Disable (false) for mutation policies that don\'t make sense on existing resources.'
    },
    {
      question: 'Which Kyverno rule type automatically creates new resources when a trigger occurs?',
      options: [
        'validate',
        'mutate',
        'generate',
        'verifyImages'
      ],
      correct: 2,
      explanation: 'generate creates new K8s resources based on events (e.g., creating a Namespace triggers the creation of a default NetworkPolicy). With synchronize: true, Kyverno re-creates the generated resource if it is deleted.',
      reference: 'Related concept: generate with synchronize: true ensures generated resources remain in sync.'
    },
    {
      question: 'What is the difference between failurePolicy: Fail and Ignore?',
      options: [
        'Fail is safer for production',
        'failurePolicy defines what happens when the KYVERNO WEBHOOK fails (not when the policy fails). Fail rejects the admission; Ignore allows it through.',
        'Ignore is equivalent to Audit mode',
        'Fail applies the policy to all resources; Ignore only applies to new ones'
      ],
      correct: 1,
      explanation: 'failurePolicy controls behavior when the WEBHOOK fails (Kyverno doesn\'t respond, timeout, etc.) — not when the policy validates to False. Fail: admissions are rejected if the webhook doesn\'t respond. Ignore: admissions are allowed if the webhook doesn\'t respond. Use Fail for critical security policies.',
      reference: 'Related concept: For HA in production, use replicas=3 in the admission controller to minimize failures.'
    },
    {
      question: 'How is Kyverno different from OPA/Gatekeeper as a policy engine?',
      options: [
        'Kyverno is less powerful than OPA',
        'Kyverno uses pure K8s-native YAML (no special language); OPA uses Rego. Kyverno natively supports mutate and generate; OPA/Gatekeeper focuses on validate.',
        'OPA supports background scanning; Kyverno does not',
        'Kyverno only works on EKS'
      ],
      correct: 1,
      explanation: 'Kyverno: pure YAML, low learning curve, natively supports validate/mutate/generate/verifyImages, K8s-native. OPA/Gatekeeper: Rego (powerful but complex functional language), focus on validate, more flexible for complex logic. Kyverno is preferred for teams without Rego experience.',
      reference: 'Related concept: CEL policies in native K8s is another alternative, with no external webhook.'
    }
  ],
  flashcards: [
    {
      front: 'What are the 4 Kyverno rule types?',
      back: '**validate** — Accept or reject resources\n- Pattern matching or deny conditions\n- Mode: Enforce (blocks) or Audit (reports)\n\n**mutate** — Modify resources\n- patchStrategicMerge: YAML merge\n- patchesJson6902: JSON Patch RFC\n- foreach: for container lists\n\n**generate** — Create new resources\n- Trigger: Namespace creation, etc.\n- synchronize: true re-creates if deleted\n\n**verifyImages** — Validate signatures\n- Integrates with cosign/notary\n- Validates images before creating Pods\n\n**Execution order:**\n1. Mutate (modify)\n2. Validate (accept/reject)\n3. Generate (create new)\n4. VerifyImages (validate images)'
    },
    {
      front: 'Basic structure of a Kyverno ClusterPolicy',
      back: '\`\`\`yaml\napiVersion: kyverno.io/v1\nkind: ClusterPolicy\nmetadata:\n  name: policy-name\nspec:\n  validationFailureAction: Enforce # Audit\n  background: true\n  failurePolicy: Fail  # Ignore\n  rules:\n    - name: rule-name\n      match:\n        any:\n          - resources:\n              kinds: [Deployment]\n              namespaces: ["!kube-system"]\n      exclude:\n        any:\n          - resources:\n              namespaces: [kube-public]\n      validate:  # mutate / generate\n        message: "Error message"\n        pattern:\n          metadata:\n            labels:\n              app: "?*"\n\`\`\`'
    },
    {
      front: 'Pattern matching wildcards in Kyverno',
      back: '**"?*"** — At least 1 character\n(required field, not empty)\nEx: label must exist with value\n\n**"*"** — Anything or empty\n(field can exist with any value)\n\n**"?"** — Exactly 1 character\n\n**Numeric operators:**\n- ">=256Mi" — minimum memory\n- "<=2" — maximum\n- ">0" — positive\n\n**Operators in deny conditions:**\n- Equals, NotEquals\n- GreaterThan, LessThan\n- AnyIn, AllIn, AnyNotIn\n- Contains, NotContains\n\n**Namespace negation:**\n- "!kube-system" — exclude\n- "production" — include'
    },
    {
      front: 'How does generate with synchronize work?',
      back: '**What it does:**\nCreates new K8s resources when\na trigger event occurs.\n\n**synchronize: true:**\n- Kyverno MONITORS the generated resource\n- If manually deleted,\n  Kyverno RE-CREATES it automatically\n- The resource "belongs" to Kyverno\n\n**synchronize: false (default):**\n- Kyverno creates the resource once\n- If deleted, does not re-create\n- The resource can be modified freely\n\n**Common use cases:**\n- Default NetworkPolicy in new Namespaces\n- Registry Secret in new Namespaces\n- LimitRange and ResourceQuota\n- Base configuration ConfigMaps\n\n**CloneFrom (copy from existing resource):**\n\`\`\`yaml\ngenerate:\n  cloneFrom:\n    namespace: default\n    name: registry-secret\n\`\`\`'
    },
    {
      front: 'PolicyReport and ClusterPolicyReport — what are they?',
      back: '**PolicyReport:**\nNamespace-scoped resource created by\nthe Kyverno Background Controller.\n\nContains: list of resources that violate\npolicies in Audit mode.\n\n**ClusterPolicyReport:**\nCluster-scoped resource for\ncluster-scoped resources (Namespaces, etc.)\n\n**Important fields:**\n- summary.pass/fail/warn/error/skip\n- results[].policy: violated policy name\n- results[].resource: resource that violated\n- results[].message: violation description\n- results[].status: pass/fail/warn\n\n**View reports:**\n\`\`\`bash\nkubectl get policyreport -A\nkubectl get clusterpolicyreport\n# Tools: Policy Reporter UI\n\`\`\`'
    },
    {
      front: 'How to install and verify Kyverno?',
      back: '**Helm installation (production):**\n\`\`\`bash\nhelm repo add kyverno \\\n  https://kyverno.github.io/kyverno/\nhelm install kyverno kyverno/kyverno \\\n  --namespace kyverno \\\n  --create-namespace \\\n  --set admissionController.replicas=3\n\`\`\`\n\n**4 main components:**\n1. admission-controller: webhook\n2. background-controller: scan existing\n3. cleanup-controller: clean generated\n4. reports-controller: PolicyReports\n\n**Verify health:**\n\`\`\`bash\nkubectl get pods -n kyverno\nkubectl get crds | grep kyverno.io\nkubectl get clusterpolicies\n\`\`\`\n\n**Test with kyverno CLI:**\n\`\`\`bash\nkyverno apply policy.yaml \\\n  --resource resource.yaml\n\`\`\`'
    },
    {
      front: 'match/exclude in ClusterPolicy — how does scoping work?',
      back: '**match.any:** OR — any criterion is enough\n**match.all:** AND — all must be true\n\n**Available criteria:**\n- resources.kinds: K8s types\n- resources.namespaces: namespaces\n- resources.operations: CREATE/UPDATE/DELETE/CONNECT\n- resources.selector: label selectors\n- resources.annotations: annotation filters\n- subjects: users/groups/SAs\n- clusterRoles: user roles\n\n**Exclude follows the same structure**\nExcludes resources that match\nthe exclude criteria.\n\n**Tip:** Always exclude kube-system:\n\`\`\`yaml\nexclude:\n  any:\n    - resources:\n        namespaces:\n          - kube-system\n          - kube-public\n\`\`\`'
    }
  ],
  lab: {
    scenario: 'You are responsible for governance of a Kubernetes cluster. You need to implement basic security and best practice policies using Kyverno.',
    objective: 'Install Kyverno and create validate and mutate policies for cluster governance.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Install Kyverno',
        instruction: `Install Kyverno on the cluster:
1. Add the Kyverno Helm repository
2. Install in standalone mode (1 replica for lab)
3. Verify all 4 components are running
4. List the CRDs installed by Kyverno`,
        hints: [
          'Use repository https://kyverno.github.io/kyverno/',
          'For lab use replicas=1; for production use replicas=3',
          'Wait for all pods to be Running before proceeding'
        ],
        solution: `\`\`\`bash
# Add repository
helm repo add kyverno https://kyverno.github.io/kyverno/
helm repo update

# Install Kyverno (lab mode with 1 replica)
helm install kyverno kyverno/kyverno \\
  --namespace kyverno \\
  --create-namespace \\
  --set admissionController.replicas=1 \\
  --set backgroundController.replicas=1 \\
  --set cleanupController.replicas=1 \\
  --set reportsController.replicas=1

# Wait for pods to be ready
kubectl wait --for=condition=Ready pods --all -n kyverno --timeout=120s
\`\`\``,
        verify: `\`\`\`bash
# Verify all pods running
kubectl get pods -n kyverno
# Expected: 4 pods in Running state
# kyverno-admission-controller-xxx
# kyverno-background-controller-xxx
# kyverno-cleanup-controller-xxx
# kyverno-reports-controller-xxx

# Verify CRDs installed
kubectl get crds | grep kyverno.io | head -10
# Expected: clusterpolicies, policies, policyreports, etc.

# Verify webhooks configured
kubectl get validatingwebhookconfigurations | grep kyverno
kubectl get mutatingwebhookconfigurations | grep kyverno
# Expected: kyverno webhooks registered
\`\`\``
      },
      {
        title: 'Create a Validate Policy',
        instruction: `Create a ClusterPolicy to require mandatory labels:
1. Policy named require-app-label
2. Applies to all Deployments except kube-system and kube-public
3. Validates that the "app" label exists with a non-empty value
4. Audit mode (don't block yet)
5. Test by creating a Deployment without labels and checking the PolicyReport`,
        hints: [
          'Use "?*" as pattern for a required non-empty field',
          'Use Audit first to not block existing workloads',
          'kubectl get policyreport -A shows violations'
        ],
        solution: `\`\`\`yaml
# require-app-label.yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-app-label
  annotations:
    policies.kyverno.io/title: Require App Label
    policies.kyverno.io/severity: medium
    policies.kyverno.io/category: Best Practices
spec:
  validationFailureAction: Audit
  background: true
  rules:
    - name: check-app-label
      match:
        any:
          - resources:
              kinds:
                - Deployment
      exclude:
        any:
          - resources:
              namespaces:
                - kube-system
                - kube-public
      validate:
        message: "Deployment must have the 'app' label defined."
        pattern:
          metadata:
            labels:
              app: "?*"
\`\`\`

\`\`\`bash
kubectl apply -f require-app-label.yaml

# Create Deployment WITHOUT label to test
kubectl create deployment test-no-label --image=nginx -n default

# Wait for background scan (may take 30s-1min)
sleep 30
\`\`\``,
        verify: `\`\`\`bash
# Verify policy created
kubectl get clusterpolicy require-app-label
# Expected: READY=true VALIDATIONACTION=Audit

# Verify PolicyReport generated for the namespace
kubectl get policyreport -n default
# Expected: policyreport with FAIL > 0

# See violation details
kubectl describe policyreport -n default | grep -A5 "Status: fail"
# Expected: result pointing to test-no-label

# Try creating Deployment WITHOUT label in Enforce mode (change to test)
kubectl patch clusterpolicy require-app-label --type='merge' \\
  -p '{"spec":{"validationFailureAction":"Enforce"}}'

kubectl create deployment test-blocked --image=nginx -n default
# Expected: ERROR - admission webhook denied the request

# Clean up
kubectl delete deployment test-no-label test-blocked -n default 2>/dev/null || true
kubectl patch clusterpolicy require-app-label --type='merge' \\
  -p '{"spec":{"validationFailureAction":"Audit"}}'
\`\`\``
      },
      {
        title: 'Create Mutate and Generate Policies',
        instruction: `Create Mutate and Generate policies:
1. Mutate: automatically add label "managed-by: kyverno" to all Deployments
2. Generate: create a default-deny-all NetworkPolicy in every new Namespace
3. Test by creating a Deployment and a Namespace
4. Verify that resources were automatically mutated/generated`,
        hints: [
          'patchStrategicMerge is the simplest way to add fields',
          'generate with synchronize: true re-creates the NetworkPolicy if deleted',
          'The namespace of the generated resource should be the name of the created Namespace'
        ],
        solution: `\`\`\`yaml
# mutate-add-label.yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: add-managed-by-label
spec:
  rules:
    - name: add-label
      match:
        any:
          - resources:
              kinds: [Deployment]
      mutate:
        patchStrategicMerge:
          metadata:
            labels:
              managed-by: kyverno
---
# generate-netpol.yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: default-deny-network
spec:
  rules:
    - name: create-default-deny
      match:
        any:
          - resources:
              kinds: [Namespace]
      exclude:
        any:
          - resources:
              names:
                - kube-system
                - kube-public
                - kyverno
                - default
      generate:
        synchronize: true
        apiVersion: networking.k8s.io/v1
        kind: NetworkPolicy
        name: default-deny-all
        namespace: "{{ request.object.metadata.name }}"
        data:
          spec:
            podSelector: {}
            policyTypes:
              - Ingress
              - Egress
\`\`\`

\`\`\`bash
kubectl apply -f mutate-add-label.yaml
kubectl apply -f generate-netpol.yaml

# Test mutate
kubectl create deployment test-mutate --image=nginx -n default

# Test generate
kubectl create namespace test-kyverno
sleep 5
\`\`\``,
        verify: `\`\`\`bash
# Verify label added by mutate
kubectl get deployment test-mutate -n default -o jsonpath='{.metadata.labels.managed-by}'
# Expected: kyverno

# Verify NetworkPolicy generated in new namespace
kubectl get networkpolicy -n test-kyverno
# Expected: default-deny-all

kubectl describe networkpolicy default-deny-all -n test-kyverno
# Expected: policyTypes Ingress and Egress, empty podSelector

# Test synchronize: delete and see re-creation
kubectl delete networkpolicy default-deny-all -n test-kyverno
sleep 10
kubectl get networkpolicy -n test-kyverno
# Expected: default-deny-all RE-CREATED by Kyverno

# Clean up
kubectl delete deployment test-mutate -n default
kubectl delete namespace test-kyverno
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Policy in Enforce mode is not blocking resources',
      difficulty: 'easy',
      symptom: 'The ClusterPolicy is configured with validationFailureAction: Enforce but invalid resources continue to be created without error.',
      diagnosis: `\`\`\`bash
# 1. Check policy status
kubectl get clusterpolicy <name>
# Check READY and VALIDATIONACTION columns

# 2. Check if the policy is valid
kubectl describe clusterpolicy <name> | grep -A5 "Conditions:"
# Look for Ready=True

# 3. Check if the webhook is active
kubectl get validatingwebhookconfiguration | grep kyverno
kubectl describe validatingwebhookconfiguration kyverno-resource-validating-webhook-cfg

# 4. Check if the resource matches
kubectl get clusterpolicy <name> -o yaml | grep -A20 "match:"

# 5. Check admission controller logs
kubectl logs -n kyverno -l app.kubernetes.io/component=admission-controller --tail=20
\`\`\``,
      solution: `**Causes and solutions:**

1. **Policy not Ready:** If READY=False, the policy has a syntax error. Check kubectl describe and fix the YAML.

2. **Match doesn't correspond:** The resource doesn't fit the match criteria. Check kinds, namespaces, and operations. Use kyverno CLI to test: \`kyverno apply policy.yaml --resource resource.yaml\`.

3. **Namespace excluded:** The resource is in a namespace excluded by the policy. Check the exclude section.

4. **Kyverno down:** If Kyverno has problems and failurePolicy: Ignore, resources pass through. Check kubectl get pods -n kyverno.

5. **Policy in Audit mode:** Check if validationFailureAction is actually Enforce (not Audit).`
    },
    {
      title: 'Generate is not creating resources in existing namespaces',
      difficulty: 'medium',
      symptom: 'Created a generate policy to create NetworkPolicy in new Namespaces. Works for new Namespaces but existing ones don\'t have the NetworkPolicy.',
      diagnosis: `\`\`\`bash
# 1. Check the policy
kubectl get clusterpolicy default-deny-network -o yaml | grep -A5 "generate:"

# 2. Check if there are PolicyReports for existing namespaces
kubectl get policyreport -A | grep -i network

# 3. Check background controller logs
kubectl logs -n kyverno \\
  -l app.kubernetes.io/component=background-controller \\
  --tail=20

# 4. Check if the trigger is only Namespace (doesn't apply retroactively)
kubectl describe clusterpolicy default-deny-network | grep -A10 "Match:"
\`\`\``,
      solution: `**Explanation and solution:**

The generate with Namespace creation trigger only fires for NEW Namespaces created AFTER the policy exists. Existing namespaces don't trigger the event.

**Solution for existing namespaces:**

1. **Apply manually:** Create the NetworkPolicy in each existing namespace via kubectl apply.

2. **Bootstrap script:**
\`\`\`bash
for ns in \$(kubectl get namespaces -o jsonpath='{.items[*].metadata.name}'); do
  kubectl apply -f networkpolicy.yaml -n \$ns 2>/dev/null || true
done
\`\`\`

3. **Recreate namespaces** (impractical in production): Deleting and recreating the namespace triggers the generate.

4. **Use generate with cloneFrom** from a source namespace and reapply periodically.

**Future prevention:** The generate policy automatically protects new namespaces. For initial state, use IaC (GitOps) to ensure all namespaces are created with the necessary resources.`
    }
  ]
};
