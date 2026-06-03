window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['kyverno/kyverno-advanced'] = {
  theory: `
# Kyverno Advanced: PolicyException, CLI & Reports

## Relevance
This topic covers Kyverno's advanced operational and governance features: PolicyException for controlled exceptions, Kyverno CLI for testing and CI/CD, PolicyReports for detailed auditing, and verifyImages for signature validation with Cosign. Essential skills for operating Kyverno in production.

## Core Concepts

### PolicyException — Controlled Exceptions

PolicyException allows excluding specific resources from policies without modifying the policies themselves — crucial for special cases without compromising global governance.

\`\`\`yaml
apiVersion: kyverno.io/v2beta1
kind: PolicyException
metadata:
  name: allow-privileged-datadog
  namespace: monitoring              # Namespace-scoped
spec:
  exceptions:
    - policyName: disallow-privileged-containers
      ruleNames:
        - deny-privileged            # Specific rule name
  match:
    any:
      - resources:
          kinds: [DaemonSet, Pod]
          namespaces: [monitoring]
          selector:
            matchLabels:
              app: datadog-agent     # Only for Datadog Agent
\`\`\`

\`\`\`yaml
# PolicyException for multiple policies
apiVersion: kyverno.io/v2beta1
kind: PolicyException
metadata:
  name: allow-system-workloads
  namespace: kube-system
spec:
  exceptions:
    - policyName: require-labels
      ruleNames: ["*"]              # All rules of the policy
    - policyName: require-limits
      ruleNames: ["check-cpu", "check-memory"]
  match:
    any:
      - resources:
          kinds: [Pod, Deployment]
          namespaces: [kube-system]
\`\`\`

### Kyverno CLI — Local Testing and CI/CD

\`\`\`bash
# Install kyverno CLI
# Linux
curl -LO https://github.com/kyverno/kyverno/releases/latest/download/kyverno-cli_linux_amd64.tar.gz
tar -xvf kyverno-cli_linux_amd64.tar.gz
chmod +x kyverno && mv kyverno /usr/local/bin/

# macOS
brew install kyverno

# Verify installation
kyverno version
\`\`\`

\`\`\`bash
# Apply policy to resource and see result
kyverno apply policy.yaml --resource deployment.yaml

# Multiple policies and resources
kyverno apply policies/ --resource manifests/ --recursive

# See details of each rule
kyverno apply policy.yaml --resource deployment.yaml --detailed-results

# Use with live cluster (add existing resources as context)
kyverno apply policy.yaml --resource deployment.yaml --cluster

# Generate PolicyReport in YAML format
kyverno apply policy.yaml --resource deployment.yaml -o yaml
\`\`\`

### Kyverno Test — Policy Unit Tests

\`\`\`yaml
# kyverno-test.yaml — test structure
name: test-require-labels
policies:
  - require-labels.yaml
resources:
  - resources/

results:
  - policy: require-app-label
    rule: check-app-label
    resource: deployment-with-label.yaml
    namespace: default
    result: pass              # Resource should PASS

  - policy: require-app-label
    rule: check-app-label
    resource: deployment-without-label.yaml
    namespace: default
    result: fail              # Resource should FAIL
\`\`\`

\`\`\`bash
# Run tests
kyverno test .               # Runs all kyverno-test.yaml in directory
kyverno test . --detailed-results
kyverno test . --fail-fast   # Stop on first error
\`\`\`

### Test Structure

\`\`\`
policies/
├── require-labels.yaml
├── deny-latest.yaml
tests/
├── kyverno-test.yaml         # Main test file
├── policies/                 # Link or copy of policies
│   ├── require-labels.yaml
│   └── deny-latest.yaml
├── resources/
│   ├── pass/
│   │   ├── deployment-with-labels.yaml
│   │   └── deployment-with-version.yaml
│   └── fail/
│       ├── deployment-no-labels.yaml
│       └── deployment-latest-tag.yaml
└── expected/                 # Expected results
\`\`\`

### VerifyImages — Validate Signatures with Cosign

\`\`\`yaml
# Verify image signature with Cosign
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-image-signatures
spec:
  validationFailureAction: Enforce
  background: false               # No point verifying existing resources
  webhookTimeoutSeconds: 30
  rules:
    - name: verify-cosign-signature
      match:
        any:
          - resources:
              kinds: [Pod]
      verifyImages:
        - imageReferences:
            - "registry.acme.io/*"     # Apply to all images from this registry
          attestors:
            - entries:
                - keyless:
                    subject: "https://github.com/acme-corp/workflows/.github/workflows/build.yaml@refs/heads/main"
                    issuer: "https://token.actions.githubusercontent.com"
                    rekor:
                      url: https://rekor.sigstore.dev
\`\`\`

\`\`\`yaml
# Verify with public key (key-based)
verifyImages:
  - imageReferences:
      - "ghcr.io/myorg/*"
    attestors:
      - entries:
          - keys:
              publicKeys: |-
                -----BEGIN PUBLIC KEY-----
                MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...
                -----END PUBLIC KEY-----
    mutateDigest: true           # Replace tag with immutable digest
    verifyDigest: true           # Verify it's not a mutable tag
    required: true               # Signature is required
\`\`\`

### PolicyReports — Detailed Auditing

\`\`\`bash
# List all PolicyReports
kubectl get policyreport -A
kubectl get clusterpolicyreport

# See specific violations
kubectl get policyreport -n production \\
  -o jsonpath='{.items[*].results[?(@.result=="fail")].resource}'

# Filter by specific policy
kubectl get policyreport -A \\
  -o jsonpath='{range .items[*]}{range .results[?(@.policy=="require-labels")]}{.resource}{"\n"}{end}{end}'
\`\`\`

\`\`\`bash
# Use Policy Reporter (visual tool)
helm install policy-reporter policy-reporter/policy-reporter \\
  --set ui.enabled=true \\
  --set kyvernoPlugin.enabled=true \\
  --namespace policy-reporter \\
  --create-namespace

# Access dashboard
kubectl port-forward service/policy-reporter-ui 8082:8080 -n policy-reporter
# Open: http://localhost:8082
\`\`\`

### Kyverno Metrics

\`\`\`bash
# Kyverno exposes Prometheus metrics by default
# Endpoint: http://kyverno-svc:8000/metrics

# Important metrics:
# kyverno_policy_results_total{policy, rule, resource_type, namespace, status}
# kyverno_admission_requests_total{resource_type, operation}
# kyverno_policy_execution_duration_seconds

# With ServiceMonitor (Prometheus Operator):
kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: kyverno
  namespace: kyverno
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: kyverno
  endpoints:
    - port: metrics
      interval: 30s
EOF
\`\`\`

### Kyverno Policies as Code (GitOps)

\`\`\`yaml
# .github/workflows/policy-test.yaml
name: Kyverno Policy Tests

on:
  pull_request:
    paths:
      - 'policies/**'
      - 'tests/**'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Kyverno CLI
        run: |
          curl -LO https://github.com/kyverno/kyverno/releases/latest/download/kyverno-cli_linux_amd64.tar.gz
          tar xvf kyverno-cli_linux_amd64.tar.gz
          chmod +x kyverno
          mv kyverno /usr/local/bin/

      - name: Run Kyverno Tests
        run: kyverno test tests/ --detailed-results

      - name: Validate policies against manifests
        run: kyverno apply policies/ --resource k8s-manifests/ --recursive
\`\`\`

### Production Best Practices

\`\`\`yaml
# 1. Use annotations to document policies
metadata:
  annotations:
    policies.kyverno.io/title: Policy Title
    policies.kyverno.io/category: Security | Best Practices | Multi-Tenancy
    policies.kyverno.io/severity: low | medium | high | critical
    policies.kyverno.io/subject: Pod, Deployment
    policies.kyverno.io/description: >-
      Detailed description of the policy and why it exists.

# 2. Always start with Audit before Enforce
# 3. Use PolicyException for special cases (don't modify the policy)
# 4. Version policies in Git
# 5. Test with kyverno CLI before applying
# 6. HA: 3 replicas for admission controller in production
# 7. Configure appropriate timeouts (webhookTimeoutSeconds)
# 8. Monitor PolicyReports and metrics
\`\`\`

### Advanced Common Mistakes

1. **PolicyException with wrong match** — The exception uses wrong matchLabels and doesn't apply to the correct resource
2. **verifyImages with background: true** — Signature verification doesn't make sense for existing resources; use background: false
3. **webhookTimeoutSeconds too low** — verifyImages operations can take longer than the default timeout (10s); increase to 30s
4. **PolicyException scope** — PolicyException is namespace-scoped; for cluster-wide exceptions, create in the same namespace as the resource or use ClusterPolicyException (v3+)
5. **kyverno test fails without resources directory** — The kyverno-test.yaml file needs to reference existing files

## Killer.sh Style Challenge

> **Scenario:** (1) You have a ClusterPolicy \`disallow-privileged\` that blocks privileged containers. Prometheus in the monitoring namespace needs to run as privileged. Create an appropriate PolicyException. (2) Create a kyverno test file that verifies that a Pod with a privileged container FAILS the policy and a Pod with a non-privileged container PASSES.
`,
  quiz: [
    {
      question: 'What is the purpose of PolicyException in Kyverno?',
      options: [
        'To temporarily disable a ClusterPolicy',
        'To exclude specific resources from specific policies without modifying the global policy — allows controlled and tracked exceptions',
        'To create lower-priority policies',
        'To apply policies only to certain users'
      ],
      correct: 1,
      explanation: 'PolicyException creates an auditable exception — the resource passes the policy even though it violates it, but the exception is recorded. Much better than modifying the policy to add exclusions or using the policy\'s exclude field (which affects everyone). Allows specific exceptions by resource/namespace/label.',
      reference: 'Related concept: PolicyException is namespace-scoped in v1; in v3+ there is ClusterPolicyException for cluster-wide exceptions.'
    },
    {
      question: 'What is the purpose of the kyverno test command?',
      options: [
        'To test Kyverno webhook connectivity',
        'To execute policy unit tests using a kyverno-test.yaml file that defines resources and expected results (pass/fail)',
        'To verify Kyverno is installed correctly',
        'To test policies on a staging cluster'
      ],
      correct: 1,
      explanation: 'kyverno test executes local unit tests: no cluster needed. Uses a kyverno-test.yaml file that lists policies, test resources, and the expected result (pass/fail) for each combination. Essential for CI/CD — validates that policies work as expected before applying to the cluster.',
      reference: 'Related concept: kyverno apply validates resources against policies and shows violations; kyverno test verifies the policy behaves as expected with both positive AND negative cases.'
    },
    {
      question: 'Why should verifyImages use background: false?',
      options: [
        'verifyImages is too slow for background scanning',
        'Verifying image signatures only makes sense at admission time (creation/update). Existing resources cannot be retroactively verified — the image is already running',
        'background: false is safer for production',
        'verifyImages doesn\'t support background scanning'
      ],
      correct: 1,
      explanation: 'Background scanning verifies existing resources. For verifyImages, checking the signature of an image that is already running has no security value — the image was already admitted. background: false focuses on admission time, which is the relevant moment for supply chain security.',
      reference: 'Related concept: For stronger assurance, use mutateDigest: true to replace tags with immutable digests.'
    },
    {
      question: 'How does PolicyException ensure exceptions are controlled and audited?',
      options: [
        'PolicyException logs all exceptions to SIEM',
        'PolicyException is a separate K8s resource from the policy — can be controlled by RBAC (who can create exceptions), versioned in Git, reviewed in PRs, and appears in PolicyReports',
        'PolicyException has automatic time-based expiration',
        'PolicyException requires approval from two administrators'
      ],
      correct: 1,
      explanation: 'As a separate K8s resource, PolicyException can have restricted RBAC (only admins create), be versioned in GitOps with PR review, audited by Kubernetes audit log, and documented with annotations. Much more governable than modifying the global policy.',
      reference: 'Related concept: In mature environments, PolicyExceptions require PR approval before being applied to the cluster.'
    },
    {
      question: 'What Prometheus metrics does Kyverno expose by default?',
      options: [
        'Only CPU and memory metrics',
        'kyverno_policy_results_total (results by policy/rule/status), kyverno_admission_requests_total, kyverno_policy_execution_duration_seconds',
        'Only total number of policies',
        'Kyverno doesn\'t natively expose Prometheus metrics'
      ],
      correct: 1,
      explanation: 'Kyverno exposes Prometheus metrics at endpoint :8000/metrics. kyverno_policy_results_total counts pass/fail/warn by policy and rule. kyverno_admission_requests_total counts requests by type. kyverno_policy_execution_duration_seconds measures latency. Essential for SLOs and governance alerts.',
      reference: 'Related concept: Use Prometheus Operator\'s ServiceMonitor for automatic scraping of Kyverno metrics.'
    },
    {
      question: 'What is the main file that the kyverno test command looks for?',
      options: [
        'policy-test.yaml',
        'kyverno-test.yaml — defines policies, test resources and expected results (pass/fail)',
        'test-suite.yaml',
        'kyverno.config.yaml'
      ],
      correct: 1,
      explanation: 'The kyverno-test.yaml file (in the root of the tested directory) defines: test name, list of policies, resource directory/files, and results with policy, rule, resource, and expected result (pass/fail/warn/error/skip). The kyverno test . command searches for this file recursively.',
      reference: 'Related concept: Use kyverno test . --detailed-results to see exactly which rule generated which result for each resource.'
    },
    {
      question: 'How does mutateDigest in verifyImages increase security?',
      options: [
        'mutateDigest adds a hash to the image name',
        'mutateDigest replaces the mutable tag (e.g., :latest, :v1.0) with the immutable SHA256 digest of the image — ensuring the exact verified image is used, without the possibility of substitution',
        'mutateDigest encrypts the image',
        'mutateDigest verifies image layer integrity'
      ],
      correct: 1,
      explanation: 'Image tags are mutable — the same ":v1.0" can be re-tagged to point to a different image. mutateDigest: true replaces the tag with the immutable SHA256 digest (e.g., nginx@sha256:abc123...), ensuring that even if the tag changes in the registry, the Pod always uses exactly the image that was verified and signed.',
      reference: 'Related concept: Combine verifyImages with mutateDigest and verifyDigest: true for maximum supply chain security.'
    }
  ],
  flashcards: [
    {
      front: 'PolicyException — structure and when to use',
      back: '**When to use:**\nLegitimate resource that violates a policy\n(Datadog DaemonSet, node-exporter, etc.)\n\n**Structure:**\n\`\`\`yaml\napiVersion: kyverno.io/v2beta1\nkind: PolicyException\nmetadata:\n  name: allow-datadog\n  namespace: monitoring\nspec:\n  exceptions:\n    - policyName: disallow-privileged\n      ruleNames:\n        - deny-privileged  # or "*" for all\n  match:\n    any:\n      - resources:\n          kinds: [DaemonSet]\n          namespaces: [monitoring]\n          selector:\n            matchLabels:\n              app: datadog-agent\n\`\`\`\n\n**Advantages:**\n- Auditable (K8s resource)\n- Controlled by RBAC\n- Versioned in Git\n- Doesn\'t pollute the global policy'
    },
    {
      front: 'Kyverno CLI — main commands',
      back: '**kyverno apply:**\nApplies policy to resource and shows result\n\`\`\`bash\nkyverno apply policy.yaml \\\n  --resource resource.yaml\nkyverno apply policies/ \\\n  --resource manifests/ --recursive\n\`\`\`\n\n**kyverno test:**\nUnit tests with kyverno-test.yaml\n\`\`\`bash\nkyverno test .\nkyverno test . --detailed-results\nkyverno test . --fail-fast\n\`\`\`\n\n**kyverno jp:**\nTest JMESPath expressions\n\`\`\`bash\nkyverno jp query \\\n  -i resource.json \\\n  -q "spec.containers[].image"\n\`\`\`\n\n**kyverno version:**\nSee installed version'
    },
    {
      front: 'kyverno-test.yaml — complete structure',
      back: '\`\`\`yaml\nname: test-suite-name\npolicies:\n  - policy.yaml\n  - policies/\nresources:\n  - resources/\nvariables: variables.yaml  # optional\ngenerationConfig:          # for generate rules\n  test: true\nresults:\n  - policy: policy-name\n    rule: rule-name\n    resource: resource.yaml\n    namespace: default\n    result: pass  # pass/fail/warn/error/skip\n  - policy: policy-name\n    rule: rule-name\n    resource: resource2.yaml\n    result: fail\n    patchedResource: expected-mutated.yaml  # for mutate\n\`\`\`\n\n**Tip:** Always include\nboth positive (pass) AND negative (fail) cases'
    },
    {
      front: 'verifyImages — key-based vs keyless',
      back: '**Key-based:**\nVerifies signature with public key\n\`\`\`yaml\nverifyImages:\n  - imageReferences: ["registry.io/*"]\n    attestors:\n      - entries:\n          - keys:\n              publicKeys: |-\n                -----BEGIN PUBLIC KEY-----\n                ...\n                -----END PUBLIC KEY-----\n\`\`\`\nPros: Simple, no external dependency\nCons: Key management overhead\n\n**Keyless (Sigstore/Fulcio):**\nVerifies via OIDC identity\n\`\`\`yaml\nverifyImages:\n  - imageReferences: ["ghcr.io/org/*"]\n    attestors:\n      - entries:\n          - keyless:\n              subject: "https://github.com/org/repo/.github/workflows/build.yaml@refs/heads/main"\n              issuer: "https://token.actions.githubusercontent.com"\n\`\`\`\nPros: No keys, linked to CI identity\nCons: Requires accessible rekor/fulcio'
    },
    {
      front: 'PolicyReports — how to query and use',
      back: '**List reports:**\n\`\`\`bash\n# By namespace\nkubectl get policyreport -n myns\n# Cluster-scoped\nkubectl get clusterpolicyreport\n# All\nkubectl get policyreport -A\n\`\`\`\n\n**Filter violations:**\n\`\`\`bash\nkubectl get policyreport -n prod \\\n  -o jsonpath=\'{.items[*].results[?(@.result=="fail")].resource}\'\n\`\`\`\n\n**Result fields:**\n- policy: policy name\n- rule: rule name\n- resource: violating resource\n- result: pass/fail/warn/error/skip\n- message: violation description\n- severity: low/medium/high/critical\n\n**Policy Reporter UI:**\nGraphical dashboard to visualize\nall PolicyReports in the cluster.'
    },
    {
      front: 'Kyverno in production — checklist',
      back: '**HA:**\n- admissionController.replicas=3\n- backgroundController.replicas=2\n- PodDisruptionBudget configured\n\n**Configuration:**\n- failurePolicy: Fail for critical policies\n- failurePolicy: Ignore for non-critical\n- webhookTimeoutSeconds: 30 (verify images)\n\n**Governance:**\n- Start with Audit, then Enforce\n- PolicyException for special cases\n- Version policies in Git\n- kyverno test in CI/CD pipeline\n\n**Observability:**\n- Prometheus metrics scraped\n- Alerts on kyverno_policy_results_total{status="fail"}\n- Policy Reporter UI for dashboard\n- K8s audit logs for PolicyExceptions\n\n**Security:**\n- Restricted RBAC for PolicyException\n- verifyImages with mutateDigest: true\n- background: false for verifyImages'
    }
  ],
  lab: {
    scenario: 'You need to implement advanced governance: create controlled exceptions for special workloads, test your policies with the Kyverno CLI, and configure PolicyReport auditing.',
    objective: 'Learn PolicyException, testing with kyverno CLI, and reading PolicyReports.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create PolicyException for Special Workload',
        instruction: `Implement a controlled exception for a privileged workload:
1. Create a ClusterPolicy that blocks containers with hostNetwork or hostPID
2. Create a monitoring namespace with a DaemonSet that needs hostNetwork
3. Create a PolicyException to allow the specific DaemonSet
4. Verify that other Pods are blocked but the DaemonSet passes`,
        hints: [
          'PolicyException is namespace-scoped — created in the namespace of the excepted resource',
          'The exceptions[].ruleNames field can use "*" for all rules of the policy',
          'The PolicyException match must be specific — avoid overly broad exceptions'
        ],
        solution: `\`\`\`yaml
# disallow-host-namespaces.yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: disallow-host-namespaces
spec:
  validationFailureAction: Enforce
  rules:
    - name: host-namespaces
      match:
        any:
          - resources:
              kinds: [Pod]
      exclude:
        any:
          - resources:
              namespaces: [kube-system, kyverno]
      validate:
        message: "hostNetwork and hostPID are not allowed."
        pattern:
          spec:
            =(hostNetwork): "false"
            =(hostPID): "false"
\`\`\`

\`\`\`bash
kubectl apply -f disallow-host-namespaces.yaml
kubectl create namespace monitoring
\`\`\`

\`\`\`yaml
# node-exporter-exception.yaml
apiVersion: kyverno.io/v2beta1
kind: PolicyException
metadata:
  name: allow-node-exporter
  namespace: monitoring
spec:
  exceptions:
    - policyName: disallow-host-namespaces
      ruleNames:
        - host-namespaces
  match:
    any:
      - resources:
          kinds: [DaemonSet, Pod]
          namespaces: [monitoring]
          selector:
            matchLabels:
              app: node-exporter
\`\`\`

\`\`\`bash
kubectl apply -f node-exporter-exception.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verify policy created
kubectl get clusterpolicy disallow-host-namespaces
# Expected: READY=true VALIDATIONACTION=Enforce

# Verify PolicyException created
kubectl get policyexception -n monitoring
# Expected: allow-node-exporter

# Test that normal Pod is BLOCKED
kubectl apply -n default - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: test-hostnetwork
spec:
  hostNetwork: true
  containers:
    - name: test
      image: nginx:1.25.0
EOF
# Expected: ERROR - blocked by policy

# Test that Pod with exception label PASSES in monitoring namespace
kubectl apply -n monitoring - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: node-exporter-test
  labels:
    app: node-exporter
spec:
  hostNetwork: true
  containers:
    - name: exporter
      image: prom/node-exporter:v1.7.0
EOF
# Expected: Pod created successfully (exception applies)

# Clean up
kubectl delete pod node-exporter-test -n monitoring 2>/dev/null || true
\`\`\``
      },
      {
        title: 'Test Policies with Kyverno CLI',
        instruction: `Use the Kyverno CLI for local testing and CI/CD:
1. Install or verify kyverno CLI
2. Create test resource files (one that passes, one that fails)
3. Run kyverno apply to see results
4. Create a kyverno-test.yaml and run kyverno test`,
        hints: [
          'kyverno apply does not require cluster connection',
          'The kyverno-test.yaml file defines expected results for automation',
          'Use --detailed-results to see which rule failed'
        ],
        solution: `\`\`\`bash
# Verify kyverno CLI (or install)
which kyverno || (
  curl -LO "https://github.com/kyverno/kyverno/releases/latest/download/kyverno-cli_linux_amd64.tar.gz"
  tar xvf kyverno-cli_linux_amd64.tar.gz
  chmod +x kyverno && mv kyverno /usr/local/bin/
)
kyverno version
\`\`\`

\`\`\`bash
# Create test structure
mkdir -p /tmp/kyverno-test/{policies,resources}

# Policy
cat > /tmp/kyverno-test/policies/require-label.yaml <<EOF
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-app-label
spec:
  validationFailureAction: Enforce
  rules:
    - name: check-label
      match:
        any:
          - resources:
              kinds: [Deployment]
      validate:
        message: "Label 'app' is required."
        pattern:
          metadata:
            labels:
              app: "?*"
EOF

# Resource that PASSES
cat > /tmp/kyverno-test/resources/good-deploy.yaml <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: good-app
  namespace: default
  labels:
    app: good-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: good-app
  template:
    metadata:
      labels:
        app: good-app
    spec:
      containers:
        - name: app
          image: nginx:1.25.0
EOF

# Resource that FAILS
cat > /tmp/kyverno-test/resources/bad-deploy.yaml <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bad-app
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      run: bad-app
  template:
    metadata:
      labels:
        run: bad-app
    spec:
      containers:
        - name: app
          image: nginx:1.25.0
EOF

# Test file
cat > /tmp/kyverno-test/kyverno-test.yaml <<EOF
name: test-require-label
policies:
  - policies/require-label.yaml
resources:
  - resources/
results:
  - policy: require-app-label
    rule: check-label
    resource: good-deploy.yaml
    namespace: default
    result: pass
  - policy: require-app-label
    rule: check-label
    resource: bad-deploy.yaml
    namespace: default
    result: fail
EOF

# Manual apply test
kyverno apply /tmp/kyverno-test/policies/require-label.yaml \\
  --resource /tmp/kyverno-test/resources/good-deploy.yaml

kyverno apply /tmp/kyverno-test/policies/require-label.yaml \\
  --resource /tmp/kyverno-test/resources/bad-deploy.yaml
\`\`\``,
        verify: `\`\`\`bash
# Run unit tests
cd /tmp/kyverno-test && kyverno test . --detailed-results
# Expected:
# Passing tests: 2
# Test Results: Pass 2

# Verify apply returns correct exit code
kyverno apply /tmp/kyverno-test/policies/require-label.yaml \\
  --resource /tmp/kyverno-test/resources/bad-deploy.yaml
echo "Exit code: $?"
# Expected: exit code != 0 (violation found)

kyverno apply /tmp/kyverno-test/policies/require-label.yaml \\
  --resource /tmp/kyverno-test/resources/good-deploy.yaml
echo "Exit code: $?"
# Expected: exit code = 0 (no violation)

# Simulate CI/CD check
cd /tmp/kyverno-test && kyverno test . --fail-fast
echo "CI Check: PASSED"
\`\`\``
      },
      {
        title: 'Analyze PolicyReports and Metrics',
        instruction: `Explore the PolicyReports generated by Kyverno:
1. Create resources that violate policies (Audit mode) to generate PolicyReports
2. Use kubectl to query PolicyReports and filter violations
3. See pass/fail/warn summary
4. Understand how to use PolicyReports for compliance auditing`,
        hints: [
          'The background controller generates PolicyReports for existing resources',
          'jsonpath can filter only fail results in PolicyReports',
          'kubectl get policyreport -A shows all namespaces'
        ],
        solution: `\`\`\`bash
# Create policy in Audit mode to generate PolicyReports
kubectl apply -f - <<EOF
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: audit-no-requests
spec:
  validationFailureAction: Audit
  background: true
  rules:
    - name: check-requests
      match:
        any:
          - resources:
              kinds: [Deployment]
              namespaces: [default]
      validate:
        message: "Deployments must have CPU and memory requests."
        pattern:
          spec:
            template:
              spec:
                containers:
                  - resources:
                      requests:
                        memory: "?*"
                        cpu: "?*"
EOF

# Create some Deployments without requests (to generate violations)
kubectl create deployment no-requests-1 --image=nginx:1.25.0 -n default
kubectl create deployment no-requests-2 --image=redis:7.0 -n default

# Wait for background scan
echo "Waiting for background scan (30s)..."
sleep 30
\`\`\``,
        verify: `\`\`\`bash
# List PolicyReports in default namespace
kubectl get policyreport -n default
# Expected: PolicyReport with FAIL > 0

# See pass/fail summary
kubectl get policyreport -n default -o jsonpath='{.items[0].summary}'
# Expected: {fail: N, pass: M, warn: 0, error: 0, skip: 0}

# Filter only fail results
kubectl get policyreport -n default \\
  -o jsonpath='{range .items[*]}{range .results[?(@.result=="fail")]}{.resource.name}{" — "}{.policy}{"\n"}{end}{end}'
# Expected: list of deployments that violate policies

# See details of a specific violation
kubectl get policyreport -n default \\
  -o jsonpath='{.items[0].results[0]}'
# Expected: object with policy, rule, resource, message, result

# See all violations from all namespaces
kubectl get policyreport -A \\
  -o jsonpath='{range .items[*]}{.metadata.namespace}{": "}{.summary.fail}{" failures\n"}{end}'
# Expected: list namespace: N failures

# Clean up
kubectl delete deployment no-requests-1 no-requests-2 -n default
kubectl delete clusterpolicy audit-no-requests
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'PolicyException is not being applied to the resource',
      difficulty: 'medium',
      symptom: 'Created a PolicyException but the resource is still being blocked by the ClusterPolicy. The exception seems to have no effect.',
      diagnosis: `\`\`\`bash
# 1. Verify PolicyException was created correctly
kubectl get policyexception -n <namespace>
kubectl describe policyexception <name> -n <namespace>

# 2. Check if policyName and ruleNames are correct
kubectl get policyexception <name> -n <namespace> -o yaml | grep -A10 "exceptions:"
# Verify policyName matches exactly the ClusterPolicy name

# 3. Check if the Exception match corresponds to the resource
kubectl get policyexception <name> -n <namespace> -o yaml | grep -A10 "match:"

# 4. Check admission controller logs to see if the Exception is found
kubectl logs -n kyverno \\
  -l app.kubernetes.io/component=admission-controller \\
  --tail=30 | grep -i "exception"

# 5. Check Kyverno version (PolicyException requires v1.9+)
kubectl get pods -n kyverno -o jsonpath='{.items[0].spec.containers[0].image}'
\`\`\``,
      solution: `**Causes and solutions:**

1. **Wrong policyName:** The policyName field must be the EXACT name of the ClusterPolicy (case-sensitive). Check with kubectl get clusterpolicy.

2. **Wrong ruleNames:** The ruleNames field must match the EXACT name of the rule in the policy. Check with kubectl get clusterpolicy <name> -o yaml.

3. **Match too restrictive:** The PolicyException match uses labels the resource doesn't have, or wrong namespace. Verify the actual resource has the specified labels.

4. **Wrong namespace:** PolicyException is namespace-scoped. It must be in the same namespace as the excepted resource. For cluster-scoped resources, check the documentation.

5. **Incompatible version:** PolicyException was introduced in Kyverno v1.9. Older versions don't support it. Update Kyverno.`
    },
    {
      title: 'kyverno test fails with "policy not found" even with correct file',
      difficulty: 'easy',
      symptom: 'The kyverno test command returns "policy not found" or "resource file not found" even though the files exist in the directory.',
      diagnosis: `\`\`\`bash
# 1. Check directory structure
ls -la
# Verify kyverno-test.yaml exists in the root of the directory

# 2. Check paths in policies and resources fields
cat kyverno-test.yaml | grep -A5 "policies:\\|resources:"

# 3. Check if referenced files exist
# Paths are RELATIVE to kyverno-test.yaml
ls policies/
ls resources/

# 4. Run with verbose for more details
kyverno test . --detailed-results 2>&1 | head -20
\`\`\``,
      solution: `**Causes and solutions:**

1. **Relative paths:** The \`policies\` and \`resources\` fields in kyverno-test.yaml use paths relative to the directory where kyverno-test.yaml is located. If the file is in \`tests/\` and policy in \`tests/policies/\`, use \`policies/\` (relative).

2. **Wrong extension:** Verify files have .yaml or .yml extension (not .json or no extension).

3. **kyverno-test.yaml in subfolder:** The \`kyverno test .\` command looks for kyverno-test.yaml in the root of the passed directory. If it's in a subfolder, pass the correct path: \`kyverno test tests/\`.

4. **Wrong resource field in results:** The \`resource\` field in results must be the FILE NAME (without full path), not the K8s resource name. Ex: \`resource: deployment.yaml\` not \`resource: my-deployment\`.

5. **Missing kind/apiVersion in resource:** The resource file must have complete apiVersion and kind — it cannot be a patch or YAML fragment.`
    }
  ]
};
