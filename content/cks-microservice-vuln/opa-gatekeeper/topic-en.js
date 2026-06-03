window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['cks-microservice-vuln/opa-gatekeeper'] = {
  theory: `# OPA Gatekeeper

## Exam Relevance
> CKS expects you to understand Gatekeeper's architecture, write ConstraintTemplates with Rego, create Constraints, and test policies. Appears in Minimize Microservice Vulnerabilities domain (~10%).

## What is OPA Gatekeeper?

**Open Policy Agent (OPA) Gatekeeper** is a policy engine for Kubernetes. It extends the Kubernetes Admission Controller webhook with:

- **ConstraintTemplate**: Defines a policy schema and Rego logic
- **Constraint**: An instance of a ConstraintTemplate with specific parameters
- **OPA**: The policy engine that evaluates Rego rules

\`\`\`
                    ┌──────────────────────┐
kubectl apply -f →  │   API Server          │
                    │   Admission Webhook   │──→ Gatekeeper
                    └──────────────────────┘    (ValidatingWebhookConfiguration)
                                                │
                                                ▼
                                         ConstraintTemplates
                                         + Constraints (Rego)
                                                │
                                         ALLOW or DENY
\`\`\`

## Architecture Components

\`\`\`bash
# Gatekeeper runs in gatekeeper-system namespace
kubectl get pods -n gatekeeper-system

# Main components:
# gatekeeper-controller-manager: watches resources, creates webhook
# gatekeeper-audit: continuously audits existing resources

# Webhook configurations
kubectl get validatingwebhookconfigurations | grep gatekeeper
kubectl get mutatingwebhookconfigurations | grep gatekeeper
\`\`\`

## ConstraintTemplate

A ConstraintTemplate defines:
1. The **CRD schema** for the Constraint (parameters users can set)
2. The **Rego policy** that enforces the constraint

\`\`\`yaml
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8srequiredlabels
spec:
  crd:
    spec:
      names:
        kind: K8sRequiredLabels          # becomes the Constraint CRD kind
      validation:
        openAPIV3Schema:
          type: object
          properties:
            labels:                       # parameter: list of required labels
              type: array
              items:
                type: string
  targets:
  - target: admission.k8s.gatekeeper.sh
    rego: |
      package k8srequiredlabels

      violation[{"msg": msg}] {
        provided := {label | input.review.object.metadata.labels[label]}
        required := {label | label := input.parameters.labels[_]}
        missing := required - provided
        count(missing) > 0
        msg := sprintf("Missing required labels: %v", [missing])
      }
\`\`\`

## Constraint

A Constraint is an instance of a ConstraintTemplate:

\`\`\`yaml
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sRequiredLabels               # must match ConstraintTemplate.spec.crd.spec.names.kind
metadata:
  name: require-team-label
spec:
  enforcementAction: deny             # deny | warn | dryrun
  match:
    kinds:
    - apiGroups: ["*"]
      kinds: ["Namespace"]            # applies to Namespace objects
    namespaceSelector:                # optional: scope by namespace
      matchLabels:
        gatekeeper: enabled
    excludedNamespaces:               # exclude specific namespaces
    - kube-system
    - gatekeeper-system
  parameters:
    labels: ["team", "env"]           # parameters from ConstraintTemplate schema
\`\`\`

## Common Rego Patterns

### Block Privileged Containers

\`\`\`yaml
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8snoprivilegedcontainers
spec:
  crd:
    spec:
      names:
        kind: K8sNoPrivilegedContainers
  targets:
  - target: admission.k8s.gatekeeper.sh
    rego: |
      package k8snoprivilegedcontainers

      violation[{"msg": msg}] {
        container := input.review.object.spec.containers[_]
        container.securityContext.privileged == true
        msg := sprintf("Container %v must not be privileged", [container.name])
      }

      violation[{"msg": msg}] {
        container := input.review.object.spec.initContainers[_]
        container.securityContext.privileged == true
        msg := sprintf("Init container %v must not be privileged", [container.name])
      }
\`\`\`

### Enforce Image Registry

\`\`\`yaml
rego: |
  package k8sallowedrepos

  violation[{"msg": msg}] {
    container := input.review.object.spec.containers[_]
    not startswith(container.image, input.parameters.repos[_])
    msg := sprintf("Container %v uses image %v from disallowed registry", [container.name, container.image])
  }
\`\`\`

\`\`\`yaml
# Constraint
spec:
  parameters:
    repos:
    - "gcr.io/my-project/"
    - "registry.company.com/"
\`\`\`

### Require Resource Limits

\`\`\`yaml
rego: |
  package k8srequiredresources

  violation[{"msg": msg}] {
    container := input.review.object.spec.containers[_]
    not container.resources.limits.cpu
    msg := sprintf("Container %v must have CPU limits", [container.name])
  }

  violation[{"msg": msg}] {
    container := input.review.object.spec.containers[_]
    not container.resources.limits.memory
    msg := sprintf("Container %v must have memory limits", [container.name])
  }
\`\`\`

## Rego Language Basics for CKS

\`\`\`rego
# Input structure for Kubernetes admission
# input.review.object: the K8s object being admitted
# input.review.operation: CREATE, UPDATE, DELETE, CONNECT
# input.parameters: Constraint parameters

# Access nested fields safely
container_name := input.review.object.spec.containers[_].name

# Iterate over containers with [_] (anonymous variable)
container := input.review.object.spec.containers[_]

# String functions
startswith("registry.io/image", "registry.io/")  # true
contains("my-namespace", "prod")                  # true

# Logical NOT
not container.securityContext.allowPrivilegeEscalation == false

# Set operations
provided := {label | input.review.object.metadata.labels[label]}
required := {"env", "team"}
missing := required - provided  # set difference

# sprintf for messages
msg := sprintf("Container %v is missing %v", [container.name, "resource limits"])
\`\`\`

## Enforcement Actions

| Action | Behavior |
|--------|----------|
| deny | Reject the resource — API returns 403 |
| warn | Allow but return a warning in API response |
| dryrun | Allow, don't warn — but track violations for audit |

\`\`\`bash
# Check constraint violations (dryrun and audit results)
kubectl describe constraint <constraint-name>
# Look for "Total Violations" and "Violations" section

# All constraint violations
kubectl get constraint -A -o json | \
  jq '.items[] | {name: .metadata.name, violations: .status.totalViolations}'
\`\`\`

## Audit Mode

Gatekeeper's audit controller periodically scans existing resources for constraint violations:

\`\`\`bash
# Check audit status
kubectl get constraint require-team-label -o yaml | grep -A20 status

# Output shows:
# status:
#   auditTimestamp: "2024-01-15T10:00:00Z"
#   byPod: ...
#   totalViolations: 5
#   violations:
#   - enforcementAction: deny
#     group: ""
#     kind: Namespace
#     message: 'Missing required labels: {"team"}'
#     name: default
\`\`\`

## Installing Gatekeeper

\`\`\`bash
# Helm
helm repo add gatekeeper https://open-policy-agent.github.io/gatekeeper/charts
helm install gatekeeper/gatekeeper --name-template=gatekeeper \
  --namespace gatekeeper-system --create-namespace

# kubectl (latest release)
kubectl apply -f https://raw.githubusercontent.com/open-policy-agent/gatekeeper/master/deploy/gatekeeper.yaml

# Verify
kubectl get pods -n gatekeeper-system
\`\`\`

## Testing Policies

\`\`\`bash
# Test by trying to create a violating resource
kubectl run test-privileged --image=nginx \
  --overrides='{"spec":{"containers":[{"name":"test-privileged","image":"nginx","securityContext":{"privileged":true}}]}}'

# Expected: Error from server ([require-no-privileged] Container test-privileged must not be privileged)

# Check constraint violations after audit
kubectl describe k8snoprivilegedcontainers.constraints.gatekeeper.sh/deny-privileged
\`\`\`

## Common Mistakes

- **ConstraintTemplate name vs Constraint kind**: The template name is lowercase; the CRD kind is PascalCase from spec.crd.spec.names.kind
- **Not excluding kube-system**: System namespaces must be excluded or system pods may be blocked
- **Forgetting init containers**: Rego must explicitly check initContainers — containers[_] only covers regular containers
- **Wrong input path**: Use input.review.object, not input.request.object (that's OPA webhook, not Gatekeeper)

## Killer.sh Style Challenge

> **Scenario**: Write a ConstraintTemplate and Constraint that blocks any Pod with a container using the \`latest\` image tag. Apply it to all namespaces except \`kube-system\`.
`,

  quiz: [
    {
      question: 'What is the relationship between ConstraintTemplate and Constraint in OPA Gatekeeper?',
      options: [
        'ConstraintTemplate defines the policy schema and Rego logic; Constraint is an instance that applies the policy with specific parameters',
        'ConstraintTemplate is the policy itself; Constraint is a list of namespaces to exclude',
        'ConstraintTemplate defines which namespaces to protect; Constraint defines the Rego rules',
        'ConstraintTemplate is deprecated; only Constraint is needed in modern Gatekeeper'
      ],
      correct: 0,
      explanation: 'ConstraintTemplate is the reusable policy definition that creates a new CRD kind. Constraint is an instance of that CRD that activates the policy with specific parameters, scope (which resources), and enforcement action.',
      reference: 'OPA Gatekeeper — Architecture section.'
    },
    {
      question: 'What does the Rego pattern "container := input.review.object.spec.containers[_]" do?',
      options: [
        'Iterates over all containers in the pod — [_] is an anonymous variable matching any array index',
        'Gets the first container only (index 0)',
        'Assigns the entire containers array to the variable container',
        'Checks if the containers field is undefined'
      ],
      correct: 0,
      explanation: 'In Rego, [_] means "for any element in this array." The rule containing this expression will be evaluated once for each container, with "container" bound to each one. This is how you write policies that check all containers.',
      reference: 'OPA Gatekeeper — Rego Language Basics section.'
    },
    {
      question: 'What Gatekeeper enforcement action allows the resource but shows warnings without blocking?',
      options: [
        'warn',
        'audit',
        'allow',
        'passive'
      ],
      correct: 0,
      explanation: '"warn" in Gatekeeper allows the resource creation but returns warning messages in the API response. The user sees the warnings via kubectl but the operation succeeds. "dryrun" allows without any warning to the user but tracks violations for audit.',
      reference: 'OPA Gatekeeper — Enforcement Actions table.'
    },
    {
      question: 'A ConstraintTemplate has spec.crd.spec.names.kind: K8sNoHostPath. What is the Constraint\'s apiVersion?',
      options: [
        'constraints.gatekeeper.sh/v1beta1',
        'templates.gatekeeper.sh/v1',
        'admission.gatekeeper.sh/v1',
        'policy.gatekeeper.sh/v1beta1'
      ],
      correct: 0,
      explanation: 'All Constraint objects use apiVersion: constraints.gatekeeper.sh/v1beta1. The kind comes from the ConstraintTemplate (K8sNoHostPath in this example). ConstraintTemplates use templates.gatekeeper.sh/v1.',
      reference: 'OPA Gatekeeper — Constraint section.'
    },
    {
      question: 'How does the Gatekeeper audit controller work?',
      options: [
        'It periodically scans existing resources and reports violations to the Constraint status',
        'It monitors API audit logs and blocks retroactive changes',
        'It runs once at startup and then only checks new resources',
        'It requires a CronJob to trigger periodic policy checks'
      ],
      correct: 0,
      explanation: 'The Gatekeeper audit controller continuously scans existing cluster resources against all active Constraints. Violations are reported in the Constraint\'s .status.violations field and .status.totalViolations count. This catches pre-existing violations.',
      reference: 'OPA Gatekeeper — Audit Mode section.'
    },
    {
      question: 'In a Rego violation rule, what variable path accesses the Kubernetes object being admitted?',
      options: [
        'input.review.object',
        'input.request.object',
        'admission.object',
        'input.resource'
      ],
      correct: 0,
      explanation: 'In OPA Gatekeeper, the admitted object is at input.review.object. input.review.operation contains CREATE/UPDATE/DELETE. input.parameters contains the Constraint parameters. Note: raw OPA webhook uses input.request.object — a common confusion point.',
      reference: 'OPA Gatekeeper — Common Mistakes section.'
    },
    {
      question: 'What does this Rego code do: missing := required - provided?',
      options: [
        'Set difference: computes elements in "required" that are not in "provided"',
        'Subtracts the count of provided labels from required labels',
        'Checks if provided is a subset of required',
        'Returns an error if required equals provided'
      ],
      correct: 0,
      explanation: 'In Rego, using - on two sets performs set difference. "required - provided" returns a new set containing elements in "required" that are not present in "provided". This is used to find missing required labels.',
      reference: 'OPA Gatekeeper — ConstraintTemplate section (Rego code).'
    },
    {
      question: 'Which namespaces should typically be excluded from Gatekeeper enforcement?',
      options: [
        'kube-system, kube-public, kube-node-lease, and gatekeeper-system',
        'Only the default namespace',
        'All namespaces beginning with "kube-"',
        'No namespaces — Gatekeeper should enforce everywhere'
      ],
      correct: 0,
      explanation: 'System namespaces (kube-system, kube-public, kube-node-lease) contain privileged system pods that would violate most security policies. gatekeeper-system must also be excluded to prevent the admission webhook from blocking itself (deadlock).',
      reference: 'OPA Gatekeeper — Constraint section (excludedNamespaces).'
    }
  ],

  flashcards: [
    {
      front: 'What is the OPA Gatekeeper architecture? What are the main CRDs?',
      back: 'Architecture:\n1. Gatekeeper registers as ValidatingWebhookConfiguration\n2. API server sends admission requests to Gatekeeper\n3. Gatekeeper evaluates Rego policies\n4. Returns ALLOW or DENY to API server\n\nMain CRDs:\n- ConstraintTemplate: defines policy schema + Rego logic → creates a new CRD\n- Constraint: instance of ConstraintTemplate with params + scope\n\nNamespace: gatekeeper-system\nPods: controller-manager + audit'
    },
    {
      front: 'What are the key sections of a ConstraintTemplate?',
      back: 'spec:\n  crd:\n    spec:\n      names:\n        kind: K8sMyPolicy    # → creates Constraint CRD of this kind\n      validation:\n        openAPIV3Schema:      # → schema for Constraint parameters\n          properties:\n            myParam: ...\n  targets:\n  - target: admission.k8s.gatekeeper.sh\n    rego: |                   # Rego policy goes here\n      package k8smypolicy\n      violation[{"msg": msg}] {\n        # policy logic\n      }'
    },
    {
      front: 'Write a Rego violation that blocks containers from using image tag "latest"',
      back: 'package k8snolatesttag\n\nviolation[{"msg": msg}] {\n  container := input.review.object.spec.containers[_]\n  endswith(container.image, ":latest")\n  msg := sprintf("Container %v must not use :latest tag", [container.name])\n}\n\nviolation[{"msg": msg}] {\n  container := input.review.object.spec.containers[_]\n  not contains(container.image, ":")\n  msg := sprintf("Container %v has no tag (implies :latest)", [container.name])\n}'
    },
    {
      front: 'What is the difference between enforce: deny vs warn vs dryrun?',
      back: 'deny: Reject the resource, return 403 error\n  → kubectl create fails with policy violation message\n\nwarn: Allow the resource, return warning in kubectl response\n  → Warning: ... on violation\n  → Pod/resource IS created\n\ndryrun: Allow the resource, no user-visible warning\n  → Violations tracked in Constraint .status.violations\n  → Used for: audit without enforcement, policy development\n\nSet via: spec.enforcementAction in the Constraint'
    },
    {
      front: 'How do you find existing constraint violations (for resources already in the cluster)?',
      back: '# List all violations\nkubectl describe constraint <name>\n# Shows: status.totalViolations and status.violations list\n\n# JSON query all violations\nkubectl get constraint -o json | \\\n  jq \'.items[] | {name: .metadata.name, total: .status.totalViolations, violations: .status.violations}\'\n\n# The audit controller runs periodically\n# Wait for: status.auditTimestamp to update\n# Then check violations field'
    },
    {
      front: 'What is the input structure in Gatekeeper Rego?',
      back: 'input.review.object          → The K8s object being admitted\ninput.review.operation       → CREATE | UPDATE | DELETE | CONNECT\ninput.review.userInfo        → User making the request\ninput.review.oldObject       → Previous version (for UPDATE)\ninput.parameters             → Constraint spec.parameters\n\nCommon paths:\ninput.review.object.metadata.labels\ninput.review.object.metadata.namespace\ninput.review.object.spec.containers[_]\ninput.review.object.spec.containers[_].securityContext'
    }
  ],

  lab: {
    scenario: 'The security team wants to enforce that all Deployments in the "app" namespace must have resource limits (CPU and memory) set on all containers. Implement this policy with OPA Gatekeeper.',
    objective: 'Create a ConstraintTemplate with Rego logic and a Constraint that enforces resource limits on containers.',
    duration: '25-35 minutes',
    steps: [
      {
        title: 'Verify Gatekeeper is installed',
        instruction: `Check that OPA Gatekeeper is running in the cluster.

\`\`\`bash
# Check Gatekeeper pods
kubectl get pods -n gatekeeper-system

# Check webhook configuration
kubectl get validatingwebhookconfigurations | grep gatekeeper

# If not installed, install it:
kubectl apply -f https://raw.githubusercontent.com/open-policy-agent/gatekeeper/v3.14.0/deploy/gatekeeper.yaml

# Wait for it to be ready
kubectl wait --for=condition=Ready pod -l control-plane=controller-manager \
  -n gatekeeper-system --timeout=120s
\`\`\``,
        hints: [
          'If Gatekeeper is not available in the exam environment, you can use Kyverno instead',
          'The audit pod is separate from the controller-manager pod'
        ],
        solution: `\`\`\`bash
kubectl get pods -n gatekeeper-system 2>/dev/null || \
  kubectl apply -f https://raw.githubusercontent.com/open-policy-agent/gatekeeper/v3.14.0/deploy/gatekeeper.yaml
\`\`\``,
        verify: `\`\`\`bash
kubectl get pods -n gatekeeper-system
# Expected: gatekeeper-controller-manager-xxx   Running
#           gatekeeper-audit-xxx                Running
\`\`\``
      },
      {
        title: 'Create the ConstraintTemplate',
        instruction: `Define the policy template that checks for required resource limits.

\`\`\`yaml
# resource-limits-template.yaml
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8srequiredresourcelimits
spec:
  crd:
    spec:
      names:
        kind: K8sRequiredResourceLimits
  targets:
  - target: admission.k8s.gatekeeper.sh
    rego: |
      package k8srequiredresourcelimits

      violation[{"msg": msg}] {
        container := input.review.object.spec.containers[_]
        not container.resources.limits.cpu
        msg := sprintf("Container '%v' is missing CPU limit", [container.name])
      }

      violation[{"msg": msg}] {
        container := input.review.object.spec.containers[_]
        not container.resources.limits.memory
        msg := sprintf("Container '%v' is missing memory limit", [container.name])
      }
\`\`\`

\`\`\`bash
kubectl apply -f resource-limits-template.yaml

# Wait for the CRD to be created
kubectl get crd k8srequiredresourcelimits.constraints.gatekeeper.sh
\`\`\``,
        hints: [
          'The template name (k8srequiredresourcelimits) should be lowercase',
          'The CRD kind (K8sRequiredResourceLimits) will become the apiVersion for Constraints',
          'Give it 10-15 seconds for the CRD to be created after applying the template'
        ],
        solution: `\`\`\`bash
cat <<'EOF' | kubectl apply -f -
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8srequiredresourcelimits
spec:
  crd:
    spec:
      names:
        kind: K8sRequiredResourceLimits
  targets:
  - target: admission.k8s.gatekeeper.sh
    rego: |
      package k8srequiredresourcelimits
      violation[{"msg": msg}] {
        container := input.review.object.spec.containers[_]
        not container.resources.limits.cpu
        msg := sprintf("Container '%v' missing CPU limit", [container.name])
      }
      violation[{"msg": msg}] {
        container := input.review.object.spec.containers[_]
        not container.resources.limits.memory
        msg := sprintf("Container '%v' missing memory limit", [container.name])
      }
EOF
\`\`\``,
        verify: `\`\`\`bash
kubectl get constrainttemplate k8srequiredresourcelimits
# Expected: k8srequiredresourcelimits   <time>

kubectl get crd k8srequiredresourcelimits.constraints.gatekeeper.sh
# Expected: CRD exists
\`\`\``
      },
      {
        title: 'Create the Constraint and test it',
        instruction: `Create the Constraint that activates the policy for the "app" namespace.

\`\`\`yaml
# resource-limits-constraint.yaml
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sRequiredResourceLimits
metadata:
  name: require-resource-limits
spec:
  enforcementAction: deny
  match:
    kinds:
    - apiGroups: ["apps"]
      kinds: ["Deployment"]
    namespaceSelector:
      matchLabels:
        gatekeeper: enforced
\`\`\`

\`\`\`bash
# Create and label namespace
kubectl create namespace app 2>/dev/null || true
kubectl label namespace app gatekeeper=enforced

kubectl apply -f resource-limits-constraint.yaml

# Test: deploy without limits (should fail)
kubectl create deployment test-no-limits \
  --image=nginx --namespace=app

# Test: deploy with limits (should succeed)
cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test-with-limits
  namespace: app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: test
  template:
    metadata:
      labels:
        app: test
    spec:
      containers:
      - name: nginx
        image: nginx
        resources:
          limits:
            cpu: "100m"
            memory: "128Mi"
EOF
\`\`\``,
        hints: [
          'The Constraint scope is defined by match.namespaceSelector — only enforced in labeled namespaces',
          'If no namespace selector, it applies to all namespaces'
        ],
        solution: `\`\`\`bash
kubectl create namespace app 2>/dev/null; kubectl label namespace app gatekeeper=enforced
cat <<'EOF' | kubectl apply -f -
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sRequiredResourceLimits
metadata:
  name: require-resource-limits
spec:
  enforcementAction: deny
  match:
    kinds:
    - apiGroups: ["apps"]
      kinds: ["Deployment"]
    namespaceSelector:
      matchLabels:
        gatekeeper: enforced
EOF
\`\`\``,
        verify: `\`\`\`bash
# Test without limits (should fail)
kubectl create deployment bad-deploy --image=nginx -n app 2>&1 | grep -i "denied\|violation"
# Expected: Error from server ... missing CPU/memory limit

# Test with limits (should succeed)
cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: good-deploy
  namespace: app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: good
  template:
    metadata:
      labels:
        app: good
    spec:
      containers:
      - name: nginx
        image: nginx
        resources:
          limits:
            cpu: "100m"
            memory: "128Mi"
EOF
kubectl get deployment good-deploy -n app
# Expected: good-deploy   0/1   ... (created successfully)
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'ConstraintTemplate shows "compilation error" in status',
      difficulty: 'medium',
      symptom: 'After applying a ConstraintTemplate, kubectl describe shows "compilation error" in the status and the Constraint CRD is not created.',
      diagnosis: `\`\`\`bash
# Check the template status
kubectl describe constrainttemplate <name>

# Look for:
# status:
#   byPod:
#   - errors:
#     - code: rego_compile_error
#       location: ...
#       message: "...rego error message..."

# Common Rego syntax errors:
# - Missing package declaration
# - Wrong variable reference (typo)
# - Missing [{"msg": msg}] in violation head
# - Using input.request instead of input.review
\`\`\``,
      solution: `**Fix the Rego syntax:**

\`\`\`rego
# Correct violation rule structure:
violation[{"msg": msg}] {     # ← must be exactly this format
  # conditions...
  msg := "error message"      # ← msg must be assigned
}

# Common fixes:
# 1. Add package declaration at top: package mypolicyname
# 2. Fix input path: input.review.object (not input.request)
# 3. Fix [_] iteration for containers array
# 4. Ensure msg is always a string

# Test Rego locally with OPA:
echo '{"review": {"object": {"spec": {"containers": [{"name": "test"}]}}}}' | \
  opa eval -d policy.rego -I 'data.mypolicyname.violation'
\`\`\``
    },
    {
      title: 'Gatekeeper blocks kube-system pods after applying a cluster-wide Constraint',
      difficulty: 'hard',
      symptom: 'After creating a Constraint without namespace exclusions, system pods in kube-system fail to be created or updated.',
      diagnosis: `\`\`\`bash
# Check if system pods are blocked
kubectl get pods -n kube-system

# Check for denial events
kubectl get events -n kube-system | grep -i "denied\|gatekeeper\|violation"

# Check the Constraint's match section
kubectl get constraint <name> -o yaml | grep -A20 match

# Check if kube-system is excluded
kubectl get constraint <name> -o yaml | grep excludedNamespaces
\`\`\``,
      solution: `**Add kube-system to the excludedNamespaces in the Constraint:**

\`\`\`bash
kubectl patch constraint <constraint-name> --type=merge \
  -p '{"spec":{"match":{"excludedNamespaces":["kube-system","kube-public","kube-node-lease","gatekeeper-system"]}}}'
\`\`\`

Or edit the Constraint:
\`\`\`yaml
spec:
  match:
    excludedNamespaces:
    - kube-system
    - kube-public
    - kube-node-lease
    - gatekeeper-system
    - cert-manager
    - ingress-nginx
\`\`\`

**Also consider using namespaceSelector to scope the policy:**
\`\`\`yaml
spec:
  match:
    namespaceSelector:
      matchExpressions:
      - key: kubernetes.io/metadata.name
        operator: NotIn
        values: ["kube-system", "gatekeeper-system"]
\`\`\``
    }
  ]
};
