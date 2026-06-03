window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['kcsa-platform-security/admission-controllers-overview'] = {
  theory: `# Admission Controllers Overview

## Exam Relevance
> KCSA tests understanding of admission control as a security gate in Kubernetes. Expect questions about the types of admission controllers, how webhooks work, OPA Gatekeeper, and Kyverno.

## What Are Admission Controllers?

Admission controllers are **plugins that intercept API requests** after authentication and authorization but BEFORE the object is persisted to etcd.

\`\`\`
API Request
  ↓ Authentication (who are you?)
  ↓ Authorization (what can you do? RBAC)
  ↓ Admission Control ← validates AND mutates requests
  ↓ etcd (persist object)
  ↓ Controller loop (reconcile)
\`\`\`

### Two Types of Admission Controllers

| Type | What it does | Effect |
|------|-------------|--------|
| **Validating** | Validates requests — can REJECT | Cannot modify |
| **Mutating** | Modifies requests — can ADD/CHANGE fields | Runs BEFORE validating |

**Flow**: Mutating → Validating → Persist to etcd

## Built-in Admission Controllers

\`\`\`bash
# Enable admission plugins on API server
--enable-admission-plugins=NodeRestriction,NamespaceLifecycle,...
\`\`\`

| Controller | Function |
|-----------|----------|
| **NamespaceLifecycle** | Prevents creation in terminating namespaces |
| **LimitRanger** | Enforces resource limits |
| **ServiceAccount** | Creates default SA tokens |
| **ResourceQuota** | Enforces namespace resource quotas |
| **NodeRestriction** | Limits what kubelets can access |
| **PodSecurity** | Enforces Pod Security Standards (PSS) |
| **DefaultStorageClass** | Assigns default StorageClass to PVCs |
| **MutatingAdmissionWebhook** | Calls external webhook for mutation |
| **ValidatingAdmissionWebhook** | Calls external webhook for validation |

## Admission Webhooks

Admission webhooks allow extending Kubernetes with custom admission logic:

\`\`\`
API Request → Kubernetes API → Webhook (HTTP POST) → Allow/Deny/Mutate
\`\`\`

### MutatingAdmissionWebhook
Used to automatically inject or modify resources:
\`\`\`yaml
apiVersion: admissionregistration.k8s.io/v1
kind: MutatingWebhookConfiguration
metadata:
  name: sidecar-injector
webhooks:
  - name: inject.example.com
    rules:
      - operations: ["CREATE"]
        apiGroups: [""]
        apiVersions: ["v1"]
        resources: ["pods"]
    clientConfig:
      service:
        name: sidecar-injector
        namespace: kube-system
        path: "/inject"
      caBundle: <base64-CA>
    admissionReviewVersions: ["v1"]
    sideEffects: None
    failurePolicy: Fail    # Fail or Ignore
\`\`\`

### ValidatingAdmissionWebhook
Used to enforce custom policies:
\`\`\`yaml
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingWebhookConfiguration
metadata:
  name: require-labels
webhooks:
  - name: require-labels.example.com
    rules:
      - operations: ["CREATE", "UPDATE"]
        apiGroups: ["apps"]
        resources: ["deployments"]
    clientConfig:
      service:
        name: label-validator
        namespace: default
    failurePolicy: Fail
\`\`\`

### Webhook failurePolicy

| Value | Behavior |
|-------|----------|
| **Fail** | Request denied if webhook is unavailable |
| **Ignore** | Request allowed if webhook is unavailable |

**Security recommendation**: Use \`Fail\` — "Ignore" means if the webhook is down, policies are bypassed!

## OPA Gatekeeper

**OPA Gatekeeper** implements policy as code using the Open Policy Agent (OPA) and Rego language.

### Key Resources
- **ConstraintTemplate** — defines a policy using Rego
- **Constraint** — instantiates a policy with parameters

### Example: Require specific labels
\`\`\`yaml
# 1. Define the template
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: requiredlabels
spec:
  crd:
    spec:
      names:
        kind: RequiredLabels
      validation:
        properties:
          labels:
            type: array
            items:
              type: string
  targets:
    - target: admission.k8s.gatekeeper.sh
      rego: |
        package requiredlabels
        violation[{"msg": msg}] {
          provided := {label | input.review.object.metadata.labels[label]}
          required := {label | label := input.parameters.labels[_]}
          missing := required - provided
          count(missing) > 0
          msg := sprintf("Missing required labels: %v", [missing])
        }
---
# 2. Instantiate the constraint
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: RequiredLabels
metadata:
  name: must-have-team-label
spec:
  match:
    kinds:
      - apiGroups: [""]
        kinds: ["Namespace"]
  parameters:
    labels: ["team", "environment"]
\`\`\`

## Kyverno

**Kyverno** is a Kubernetes-native policy engine that uses YAML (no Rego needed).

### Example Kyverno Policies
\`\`\`yaml
# Validate: require image tag (not :latest)
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: disallow-latest-tag
spec:
  validationFailureAction: Enforce    # or Audit
  rules:
    - name: require-image-tag
      match:
        any:
        - resources:
            kinds: ["Pod"]
      validate:
        message: "Image tag :latest is not allowed"
        pattern:
          spec:
            containers:
              - image: "!*:latest"
\`\`\`

\`\`\`yaml
# Mutate: add labels automatically
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: add-labels
spec:
  rules:
    - name: add-managed-by
      match:
        any:
        - resources:
            kinds: ["Deployment"]
      mutate:
        patchStrategicMerge:
          metadata:
            labels:
              managed-by: kyverno
\`\`\`

\`\`\`yaml
# Generate: create NetworkPolicy for new namespaces
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: create-default-deny
spec:
  rules:
    - name: create-network-policy
      match:
        any:
        - resources:
            kinds: ["Namespace"]
      generate:
        apiVersion: networking.k8s.io/v1
        kind: NetworkPolicy
        name: default-deny-all
        namespace: "{{request.object.metadata.name}}"
        data:
          spec:
            podSelector: {}
            policyTypes:
              - Ingress
              - Egress
\`\`\`

## OPA Gatekeeper vs Kyverno

| Feature | OPA Gatekeeper | Kyverno |
|---------|----------------|---------|
| **Language** | Rego (purpose-built policy language) | YAML (native Kubernetes patterns) |
| **Policy types** | Validate | Validate, Mutate, Generate |
| **Learning curve** | Higher (Rego) | Lower (YAML) |
| **Audit mode** | Yes (report only) | Yes (Audit) |
| **Generate resources** | No | Yes |
| **CNCF project** | Yes (Graduated) | Yes (Graduated) |

## Admission Control Use Cases

1. **Enforce image registries** — only allow approved registries
2. **Require image signing** — enforce Cosign signatures
3. **Add sidecars** — auto-inject logging/monitoring agents
4. **Enforce labels** — require team/environment labels
5. **Block privileged containers** — (PSS does this built-in)
6. **Enforce resource limits** — require all pods to have limits
7. **Network policy on new namespaces** — auto-generate NetworkPolicy

## Common Admission Controller Mistakes

- **Webhook with Ignore failure policy** — policies bypassed if webhook is down
- **No webhook timeout** — can make all requests hang
- **Testing in production only** — always test in Audit/warn mode first
- **Over-broad resource matching** — targeting kube-system causes system failures
- **Not excluding system namespaces** — admission webhooks shouldn't apply to kube-system or kube-public
`,
  quiz: [
    {
      question: 'What is the order of operations in Kubernetes admission control?',
      options: [
        'Authentication → Authorization → Mutating webhooks → Validating webhooks → etcd',
        'Authentication → Mutating webhooks → Authorization → Validating webhooks → etcd',
        'Mutating webhooks → Authentication → Authorization → Validating webhooks → etcd',
        'Authentication → Authorization → Validating webhooks → Mutating webhooks → etcd'
      ],
      correct: 0,
      explanation: 'The order is: Authentication (who) → Authorization (RBAC, what they can do) → Mutating admission (modify request) → Validating admission (verify final state) → persist to etcd. Mutating runs BEFORE validating.',
      reference: 'Review "What Are Admission Controllers?" section and "Two Types" table.'
    },
    {
      question: 'What does failurePolicy: Ignore mean for an admission webhook?',
      options: [
        'If the webhook service is unavailable, the request is allowed through (policies bypassed)',
        'The webhook ignores requests that don\'t match its rules',
        'Validation failures are logged but the request is still allowed',
        'The webhook ignores requests from system service accounts'
      ],
      correct: 0,
      explanation: 'failurePolicy: Ignore means if the webhook pod is down or times out, Kubernetes allows the request anyway. This is a security risk — use Fail to ensure policies are always enforced.',
      reference: 'Review "Webhook failurePolicy" table.'
    },
    {
      question: 'What is the difference between OPA Gatekeeper and Kyverno?',
      options: [
        'Gatekeeper uses Rego language; Kyverno uses YAML. Kyverno also supports generating new resources, Gatekeeper does not.',
        'Gatekeeper only validates; Kyverno only mutates',
        'Gatekeeper is for pod security; Kyverno is for network policies',
        'Gatekeeper is built into Kubernetes; Kyverno is a third-party tool'
      ],
      correct: 0,
      explanation: 'Gatekeeper uses the Rego policy language (more powerful, steeper learning curve) and supports validate and audit modes. Kyverno uses YAML patterns and supports validate, mutate, and generate operations.',
      reference: 'Review "OPA Gatekeeper vs Kyverno" comparison table.'
    },
    {
      question: 'What is a ConstraintTemplate in OPA Gatekeeper?',
      options: [
        'Defines a reusable policy using Rego code — creates a new CRD when applied',
        'A Kubernetes template for creating Gatekeeper resources',
        'A constraint on the number of OPA policies per namespace',
        'A template for generating ClusterRoles based on policy'
      ],
      correct: 0,
      explanation: 'ConstraintTemplate defines the policy logic in Rego. Applying a ConstraintTemplate creates a new CRD (Constraint type). Then you create a Constraint instance to enforce the policy with specific parameters.',
      reference: 'Review "OPA Gatekeeper" section — ConstraintTemplate description.'
    },
    {
      question: 'Which built-in admission controller enforces Pod Security Standards?',
      options: [
        'PodSecurity',
        'PodSecurityPolicy (deprecated)',
        'SecurityContext',
        'NodeRestriction'
      ],
      correct: 0,
      explanation: 'The PodSecurity admission controller (built-in since K8s 1.25) enforces Pod Security Standards based on namespace labels. It replaced the deprecated PodSecurityPolicy admission plugin.',
      reference: 'Review "Built-in Admission Controllers" table.'
    },
    {
      question: 'What Kyverno operation would you use to automatically create a NetworkPolicy when a new Namespace is created?',
      options: [
        'generate — creates new resources based on trigger events',
        'mutate — modifies the incoming resource',
        'validate — checks the resource against rules',
        'enforce — applies policies to existing resources'
      ],
      correct: 0,
      explanation: 'The generate operation in Kyverno creates new Kubernetes resources (NetworkPolicy, RoleBinding, etc.) when a trigger event occurs (like a new Namespace). This enables automatic policy enforcement for new resources.',
      reference: 'Review "Kyverno" section — Generate example.'
    },
    {
      question: 'Why should admission webhooks typically exclude the kube-system namespace?',
      options: [
        'To prevent webhooks from blocking critical system components and causing cluster instability',
        'Because kube-system already has built-in admission control',
        'Because the API server doesn\'t enforce webhooks in kube-system',
        'To improve performance of the admission webhook'
      ],
      correct: 0,
      explanation: 'If a webhook with failurePolicy: Fail applies to kube-system and the webhook pod (which runs in kube-system) is broken, it creates a chicken-and-egg problem — the webhook prevents system pods from being recreated.',
      reference: 'Review "Common Admission Controller Mistakes" section.'
    },
    {
      question: 'What is the purpose of a MutatingAdmissionWebhook?',
      options: [
        'To automatically modify incoming requests — e.g., injecting sidecar containers or adding default labels',
        'To reject requests that don\'t meet security requirements',
        'To audit all API requests for compliance reporting',
        'To authenticate requests using external identity providers'
      ],
      correct: 0,
      explanation: 'Mutating webhooks can modify request objects before they are persisted. Common use cases: sidecar injection (Istio, Jaeger), adding default labels/annotations, setting resource defaults.',
      reference: 'Review "MutatingAdmissionWebhook" section.'
    }
  ],
  flashcards: [
    {
      front: 'What is the sequence of admission control in Kubernetes?',
      back: 'Authentication → Authorization (RBAC) → Mutating Admission Webhooks → Validating Admission Webhooks → Persist to etcd. Mutating runs before validating so validators see the final mutated state.'
    },
    {
      front: 'What is the security risk of failurePolicy: Ignore on webhooks?',
      back: 'If the webhook service is unavailable (pod crash, network issue), all requests bypass the webhook and are allowed. This means security policies are not enforced during outages. Use failurePolicy: Fail for security-critical webhooks.'
    },
    {
      front: 'What are the three Kyverno policy operations?',
      back: 'Validate: check if resource meets policy, deny if not. Mutate: modify the resource (add labels, inject containers). Generate: create new resources when a trigger event occurs (e.g., create NetworkPolicy on new Namespace).'
    },
    {
      front: 'What is the OPA Gatekeeper model (ConstraintTemplate + Constraint)?',
      back: 'ConstraintTemplate: defines the Rego policy logic and creates a new CRD. Constraint: instance of the template with specific parameters and target resources. Two-step: define policy once, instantiate many times with different params.'
    },
    {
      front: 'What built-in admission controllers are most important for security?',
      back: 'PodSecurity (enforces PSS), NodeRestriction (limits kubelet API access), LimitRanger (enforces resource limits), ResourceQuota (enforces namespace quotas), NamespaceLifecycle (prevents use of terminating namespaces).'
    },
    {
      front: 'What is the difference between Audit and Enforce modes in Kyverno/Gatekeeper?',
      back: 'Audit: policy violations are logged/reported but requests are allowed. Enforce: policy violations cause the request to be rejected. Always test in Audit mode first before switching to Enforce to avoid disrupting existing workloads.'
    }
  ],
  lab: {
    scenario: 'Install Kyverno and create policies to enforce security best practices in a namespace.',
    objective: 'Experience policy-as-code admission control with Kyverno in both audit and enforce modes.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'View existing admission webhooks',
        instruction: `Examine the admission webhooks already configured in the cluster. Understand what validating and mutating webhooks are active.`,
        hints: [
          'kubectl get validatingwebhookconfigurations',
          'kubectl get mutatingwebhookconfigurations',
          'kubectl describe to see rules and failure policies'
        ],
        solution: `\`\`\`bash
# List validating webhooks
echo "=== Validating Webhooks ==="
kubectl get validatingwebhookconfigurations

# List mutating webhooks
echo "=== Mutating Webhooks ==="
kubectl get mutatingwebhookconfigurations

# Detail view of the first one (if any exist)
kubectl get validatingwebhookconfigurations -o json | \\
  python3 -c "
import json, sys
configs = json.load(sys.stdin)
for c in configs['items']:
    print(f'Name: {c[\"metadata\"][\"name\"]}')
    for w in c.get('webhooks', []):
        print(f'  Webhook: {w[\"name\"]}')
        print(f'  FailurePolicy: {w.get(\"failurePolicy\", \"Fail\")}')
        print(f'  Rules: {[r[\"resources\"] for r in w.get(\"rules\", [])]}')
"
\`\`\``,
        verify: `\`\`\`bash
kubectl get validatingwebhookconfigurations
# Expected: shows existing webhooks (if any) or "No resources found"

kubectl get mutatingwebhookconfigurations
# Expected: similar to above

# Check what the PodSecurity built-in controller does:
kubectl get namespace default -o jsonpath='{.metadata.labels}' | python3 -m json.tool 2>/dev/null | grep pod-security || echo "No PSS labels on default namespace"
\`\`\``
      },
      {
        title: 'Create a validating webhook policy using YAML',
        instruction: `Without installing Kyverno (to avoid complexity), create a ValidatingAdmissionWebhook configuration that demonstrates the structure. Then test the concept with a built-in PSS policy.`,
        hints: [
          'Apply PSS warn mode first to see what would be blocked',
          'Create a test namespace with warn=restricted to see violations without blocking',
          'This simulates what Kyverno/Gatekeeper audit mode does'
        ],
        solution: `\`\`\`bash
# Create a namespace to test admission control concepts
kubectl create namespace admission-demo 2>/dev/null || true

# Apply PSS in "warn" mode (shows violations without blocking)
kubectl label namespace admission-demo \\
  pod-security.kubernetes.io/warn=restricted \\
  pod-security.kubernetes.io/warn-version=latest

echo "PSS warn mode applied — creating a pod that violates restricted..."

# This pod violates restricted PSS (no seccompProfile, no capabilities drop)
# The pod WILL be created (warn mode), but you'll see a warning
kubectl run violation-pod \\
  --image=nginx \\
  --namespace=admission-demo 2>&1

echo ""
echo "The warning is equivalent to an audit-mode admission policy violation"
\`\`\``,
        verify: `\`\`\`bash
kubectl get pod violation-pod -n admission-demo
# Expected: Running (warn mode allows it)

kubectl get namespace admission-demo -o jsonpath='{.metadata.labels}' | python3 -m json.tool 2>/dev/null | grep warn
# Expected: shows pod-security.kubernetes.io/warn=restricted

# Now switch to enforce mode and see the difference
kubectl label namespace admission-demo \\
  pod-security.kubernetes.io/enforce=restricted \\
  --overwrite

kubectl run enforcement-test --image=nginx -n admission-demo 2>&1
# Expected: Error: violates PodSecurity "restricted"

# Cleanup
kubectl delete namespace admission-demo
\`\`\``
      },
      {
        title: 'Explore admission webhook mechanics',
        instruction: `Create a simple ValidatingWebhookConfiguration manifest to understand the structure. Note that without a running webhook service, applying it would cause failures — demonstrate the concept without breaking the cluster.`,
        hints: [
          'Show the YAML structure of a ValidatingWebhookConfiguration',
          'Highlight failurePolicy and the importance of namespaceSelector',
          'Use --dry-run=server to validate the manifest'
        ],
        solution: `\`\`\`bash
# Create a ValidatingWebhookConfiguration manifest (demo only)
cat <<'EOF' > /tmp/demo-webhook.yaml
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingWebhookConfiguration
metadata:
  name: demo-policy-webhook
webhooks:
  - name: validate.demo.example.com
    rules:
      - operations: ["CREATE", "UPDATE"]
        apiGroups: ["apps"]
        apiVersions: ["v1"]
        resources: ["deployments"]
    clientConfig:
      # In production: this would point to a running webhook service
      service:
        name: policy-webhook
        namespace: policy-system
        path: "/validate"
      caBundle: ""   # Required in production
    admissionReviewVersions: ["v1"]
    sideEffects: None
    failurePolicy: Fail
    namespaceSelector:
      matchExpressions:
        - key: kubernetes.io/metadata.name
          operator: NotIn
          values:
            - kube-system    # NEVER apply to system namespaces!
            - kube-public
    timeoutSeconds: 5
EOF

cat /tmp/demo-webhook.yaml
echo ""
echo "Key fields to understand:"
echo "  failurePolicy: Fail = block requests if webhook is down"
echo "  namespaceSelector: excludes kube-system to prevent system issues"
echo "  timeoutSeconds: how long to wait for webhook response"
\`\`\``,
        verify: `\`\`\`bash
# Validate the webhook manifest syntax (without applying it)
kubectl apply -f /tmp/demo-webhook.yaml --dry-run=client
# Expected: no errors (valid manifest structure)
# Note: --dry-run=server would fail because the webhook service doesn't exist

# Check what webhooks look like in the cluster
kubectl get validatingwebhookconfigurations -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.webhooks[0].failurePolicy}{"\n"}{end}'
# Shows existing webhooks and their failure policies

echo "Summary: Admission webhooks are the 3rd gate after authentication and authorization"
echo "They enable flexible policy enforcement without changing Kubernetes core"
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Admission webhook causing all requests to fail',
      difficulty: 'hard',
      symptom: 'Suddenly ALL kubectl commands fail with: "Error: Internal error occurred: failed calling webhook \"validate.policy.example.com\": dial tcp: i/o timeout"',
      diagnosis: `\`\`\`bash
# Check if a webhook is causing the issue
kubectl get validatingwebhookconfigurations
kubectl get mutatingwebhookconfigurations

# Check the webhook service is running
kubectl get pods -n <webhook-namespace>
kubectl get svc -n <webhook-namespace>

# Test connectivity to webhook service
kubectl run test --image=curlimages/curl --rm -it --restart=Never -- \\
  curl -sk https://<webhook-service>.<ns>.svc/healthz 2>&1
\`\`\``,
      solution: `Emergency fix: patch the failing webhook to failurePolicy: Ignore (temporarily allows bypass):
\`\`\`bash
kubectl patch validatingwebhookconfiguration <name> \\
  --type='json' \\
  -p='[{"op":"replace","path":"/webhooks/0/failurePolicy","value":"Ignore"}]'
\`\`\`

Or delete the webhook temporarily (if policy enforcement can be paused):
\`\`\`bash
kubectl delete validatingwebhookconfiguration <name>
\`\`\`

Then fix the webhook pod/service:
\`\`\`bash
kubectl rollout restart deployment/<webhook-name> -n <ns>
kubectl get pods -n <ns> -w  # watch for recovery
\`\`\`

After recovery: restore failurePolicy: Fail and test.

Prevention:
- Ensure webhook HA (multiple replicas with PodDisruptionBudget)
- Test webhooks in dev before production
- Always exclude kube-system from webhook rules`
    },
    {
      title: 'Kyverno/Gatekeeper policy blocking legitimate workloads',
      difficulty: 'medium',
      symptom: 'Deploying a system component fails with: "admission webhook \"validate.kyverno.svc\" denied the request: policy must have required labels". The system pod legitimately doesn\'t need these labels.',
      diagnosis: `\`\`\`bash
# Check which policy is blocking
kubectl describe pod <failed-pod-name> 2>&1 | head -20

# List active Kyverno policies
kubectl get clusterpolicies  # Kyverno
kubectl get constraints --all-namespaces  # Gatekeeper

# Check policy match rules
kubectl describe clusterpolicy <name> | grep -A10 "match"
\`\`\``,
      solution: `Option 1: **Add an exclusion** for the specific namespace or resource:

For Kyverno:
\`\`\`yaml
spec:
  rules:
    - name: require-labels
      match:
        any:
        - resources:
            kinds: ["Deployment"]
      exclude:
        any:
        - resources:
            namespaces:
              - kube-system
              - monitoring
\`\`\`

Option 2: **Switch to Audit mode** while fixing the policy:
\`\`\`bash
kubectl patch clusterpolicy require-labels \\
  --type=merge \\
  -p '{"spec":{"validationFailureAction":"Audit"}}'
\`\`\`

Option 3: **Add the required labels** to the system component if appropriate:
\`\`\`bash
kubectl label deployment <name> -n kube-system team=platform environment=production
\`\`\``
    }
  ]
};
