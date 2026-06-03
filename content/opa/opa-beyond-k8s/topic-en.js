window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['opa/opa-beyond-k8s'] = {
  theory: `# OPA Beyond Kubernetes — Rego, Conftest, and Integrations

## Exam Relevance
> OPA beyond Kubernetes is covered in KubeAstronaut and CKS. Focuses on Rego as a language, using conftest in CI/CD pipelines, OPA standalone, comparison with Kyverno, and Envoy integration.

## Core Concepts

### Rego Language — The Heart of OPA

Rego is a declarative language developed specifically to express policies. Unlike imperative languages, you describe **what** must be true — not **how** to verify it.

**Basic Principles**:
- Everything is true by default if defined
- Logic-based evaluation (similar to Prolog/Datalog)
- No imperative loops — use list comprehension
- Immutable: variables cannot be reassigned

\`\`\`rego
# Package defines the policy namespace
package example.authz

# Default rule: deny
default allow = false

# Rule: allow GET on /public/
allow {
  input.method == "GET"
  startswith(input.path, "/public/")
}

# Rule: allow if user has admin role
allow {
  input.user == data.users[_].name
  data.users[_].role == "admin"
}
\`\`\`

### Rego Document Structure

OPA works with 3 main documents:

**input**: data from the request being evaluated (immutable)
\`\`\`json
{
  "method": "POST",
  "path": "/api/users",
  "user": "alice",
  "body": {"name": "bob"}
}
\`\`\`

**data**: knowledge base (policies and external data)
\`\`\`json
{
  "users": [
    {"name": "alice", "role": "admin"},
    {"name": "bob", "role": "viewer"}
  ],
  "allowed_registries": ["docker.io/company", "ghcr.io/org"]
}
\`\`\`

**output (result)**: result of policy evaluation

### Rego Syntax — Essential Constructs

#### Rules and Functions
\`\`\`rego
package k8s.security

# Boolean rule
is_privileged_container {
  container := input.spec.containers[_]
  container.securityContext.privileged == true
}

# Rule that returns a value
image_registry(image) = registry {
  parts := split(image, "/")
  count(parts) > 1
  registry := parts[0]
}

# Helper function
has_label(obj, key) {
  _ = obj.metadata.labels[key]
}

# List comprehension
privileged_containers := [name |
  container := input.spec.containers[_]
  container.securityContext.privileged == true
  name := container.name
]
\`\`\`

#### Iteration with Wildcards
\`\`\`rego
# _ is a wildcard — iterates over all elements
violation[{"msg": msg}] {
  container := input.review.object.spec.containers[_]
  not container.resources.limits.memory
  msg := sprintf("Container %v missing limits.memory", [container.name])
}

# Access by key
violation[{"msg": msg}] {
  required_labels := {"team", "cost-center"}
  label := required_labels[_]
  not input.review.object.metadata.labels[label]
  msg := sprintf("Required label missing: %v", [label])
}
\`\`\`

#### Sets and Set Operations
\`\`\`rego
# Create set
allowed_namespaces := {"production", "staging", "development"}

# Check membership
valid_namespace {
  input.namespace == allowed_namespaces[_]
}

# Set difference
missing_labels := required_labels - provided_labels
violation[{"msg": msg}] {
  count(missing_labels) > 0
  msg := sprintf("Missing labels: %v", [missing_labels])
}
\`\`\`

### OPA Standalone Server

OPA can run as an HTTP server for any application to query:

\`\`\`bash
# Start OPA server
opa run --server \\
  --addr :8181 \\
  --log-format json \\
  policy.rego data.json

# Query policy via REST API
curl -X POST http://localhost:8181/v1/data/example/authz/allow \\
  -H "Content-Type: application/json" \\
  -d '{
    "input": {
      "method": "GET",
      "path": "/public/status",
      "user": "bob"
    }
  }'
# Response: {"result": true}
\`\`\`

### Bundle Server — Distributing Policies

OPA supports loading policies from a centralized bundle server:

\`\`\`yaml
# opa-config.yaml
services:
  - name: policy-server
    url: https://policies.company.com

bundles:
  main:
    service: policy-server
    resource: /bundle.tar.gz
    polling:
      min_delay_seconds: 60
      max_delay_seconds: 120

decision_logs:
  service: policy-server
  resource: /logs

status:
  service: policy-server
\`\`\`

\`\`\`bash
# Create bundle
opa build policy/ -o bundle.tar.gz

# Start OPA with bundle
opa run --server --config-file opa-config.yaml
\`\`\`

### Conftest — OPA for CI/CD

Conftest uses OPA/Rego to test configuration files in pipelines:

\`\`\`bash
# Install conftest
brew install conftest  # or via binary

# Directory structure
policy/
  k8s.rego          # policies for K8s
  terraform.rego    # policies for Terraform
  docker.rego       # policies for Dockerfile
\`\`\`

#### Conftest Policies for Kubernetes
\`\`\`rego
# policy/k8s.rego
package main

# Deny privileged containers
deny[msg] {
  input.kind == "Deployment"
  container := input.spec.template.spec.containers[_]
  container.securityContext.privileged == true
  msg := sprintf("Container %v cannot be privileged", [container.name])
}

# Require resource limits
deny[msg] {
  input.kind == "Deployment"
  container := input.spec.template.spec.containers[_]
  not container.resources.limits.memory
  msg := sprintf("Container %v must have limits.memory", [container.name])
}

# Warn about latest tag
warn[msg] {
  input.kind == "Deployment"
  container := input.spec.template.spec.containers[_]
  endswith(container.image, ":latest")
  msg := sprintf("Container %v uses :latest tag — use a specific version", [container.name])
}
\`\`\`

#### Using Conftest in Pipelines
\`\`\`bash
# Test Kubernetes manifest
conftest test deployment.yaml

# Expected output with violation:
# FAIL - deployment.yaml - main - Container nginx cannot be privileged

# Test multiple files
conftest test k8s/**/*.yaml

# Test Dockerfile
conftest test Dockerfile --policy policy/docker.rego

# Test Terraform
conftest test main.tf

# JSON output (for CI)
conftest test deployment.yaml -o json | jq '.[] | .failures[]'

# Use specific policy namespace
conftest test deployment.yaml --namespace security
\`\`\`

#### Conftest in GitLab CI / GitHub Actions
\`\`\`yaml
# .github/workflows/policy-check.yaml
name: Policy Check
on: [push, pull_request]
jobs:
  policy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install conftest
        run: |
          wget https://github.com/open-policy-agent/conftest/releases/download/v0.46.0/conftest_0.46.0_Linux_x86_64.tar.gz
          tar xzf conftest_*.tar.gz
          sudo mv conftest /usr/local/bin/
      - name: Test K8s manifests
        run: conftest test k8s/ --policy policy/
\`\`\`

### OPA with Envoy — Service Mesh Authorization

OPA integrates with Envoy as an External Authorization Service (ext_authz):

\`\`\`yaml
# Envoy configuration as sidecar
# envoy-config.yaml
static_resources:
  listeners:
  - name: app_listener
    address: {socket_address: {address: 0.0.0.0, port_value: 8000}}
    filter_chains:
    - filters:
      - name: envoy.filters.network.http_connection_manager
        typed_config:
          http_filters:
          - name: envoy.filters.http.ext_authz
            typed_config:
              grpc_service:
                envoy_grpc:
                  cluster_name: opa_authz
          - name: envoy.filters.http.router
\`\`\`

\`\`\`rego
# OPA policy for HTTP authentication via Envoy
package envoy.authz

import input.attributes.request.http as req

default allow = false

# Allow health checks
allow {
  req.path == "/health"
  req.method == "GET"
}

# Verify JWT claims
allow {
  token := req.headers["authorization"]
  decoded := io.jwt.decode(token)
  decoded[1].role == "admin"
  req.method != "DELETE"
}
\`\`\`

### OPA vs Kyverno vs Gatekeeper — Comparison

| Feature | OPA Standalone | Gatekeeper | Kyverno |
|---------|---------------|------------|---------|
| Language | Rego | Rego | YAML |
| K8s Native | No | Yes | Yes |
| Learning curve | High (Rego) | Medium (Rego) | Low (YAML) |
| Mutations | Via webhook | AssignMetadata/Assign | YAML selector |
| Generate resources | No | No | Yes |
| Audit | Manual | Native | Native |
| Non-K8s | Yes | No | No |
| Community | CNCF Graduated | CNCF Graduated | CNCF Incubating |

**When to use each**:
- **OPA Standalone**: need policies for APIs, microservices, CI/CD — not just K8s
- **Gatekeeper**: team with Rego experience, needs native CRDs, continuous audit
- **Kyverno**: team prefers YAML, needs resource generation, fast onboarding

## Essential Commands

### OPA CLI
\`\`\`bash
# Install OPA
curl -L -o opa https://openpolicyagent.org/downloads/v0.65.0/opa_linux_amd64_static
chmod 755 opa
sudo mv opa /usr/local/bin/

# Evaluate policy locally
opa eval -d policy.rego -i input.json "data.example.authz.allow"

# Interactive REPL for debugging
opa run --stdin-input policy.rego

# Test policies (opa test)
opa test policy/ -v

# Check Rego syntax
opa check policy.rego

# Create bundle
opa build policy/ -o bundle.tar.gz

# Inspect bundle
opa inspect bundle.tar.gz
\`\`\`

### Rego Playground and Debugging
\`\`\`bash
# Use trace for debugging
opa eval --data policy.rego \\
         --input input.json \\
         --explain full \\
         "data.example.allow"

# Use print() in Rego for debug (OPA 0.34+)
allow {
  print("User:", input.user)
  input.user == "admin"
}
\`\`\`

### Conftest
\`\`\`bash
# Pull policies from OCI registry
conftest pull ghcr.io/company/policies:latest

# Update policies
conftest update

# Verify with multiple policies
conftest test file.yaml --policy policy1/ --policy policy2/

# Verbose mode
conftest test deployment.yaml --verbose
\`\`\`

## YAML / Rego Examples

### Rego: Complete Pod Security Policy
\`\`\`rego
package k8s.pod.security

# Prevent running as root
deny[msg] {
  input.kind == "Pod"
  container := input.spec.containers[_]
  container.securityContext.runAsUser == 0
  msg := sprintf("Container %v cannot run as UID 0 (root)", [container.name])
}

# Require readOnlyRootFilesystem
deny[msg] {
  input.kind == "Pod"
  container := input.spec.containers[_]
  not container.securityContext.readOnlyRootFilesystem
  msg := sprintf("Container %v must have readOnlyRootFilesystem: true", [container.name])
}

# Prohibit hostNetwork
deny[msg] {
  input.kind == "Pod"
  input.spec.hostNetwork == true
  msg := "Pod cannot use hostNetwork"
}

# Prohibit hostPath volumes
deny[msg] {
  input.kind == "Pod"
  volume := input.spec.volumes[_]
  volume.hostPath
  msg := sprintf("Volume %v uses hostPath — not allowed", [volume.name])
}
\`\`\`

### Rego: Label and Cost Validation
\`\`\`rego
package company.governance

required_labels := {"team", "cost-center", "environment"}

allowed_environments := {"production", "staging", "development", "testing"}

# Check required labels
deny[msg] {
  input.kind == "Deployment"
  label := required_labels[_]
  not input.metadata.labels[label]
  msg := sprintf("Missing required label on Deployment: %v", [label])
}

# Validate environment value
deny[msg] {
  input.kind == "Deployment"
  env := input.metadata.labels.environment
  not allowed_environments[env]
  msg := sprintf("Invalid environment value: %v. Allowed: %v", [env, allowed_environments])
}

# Validate cost-center format
deny[msg] {
  input.kind == "Deployment"
  cost_center := input.metadata.labels["cost-center"]
  not re_match("^CC-[0-9]{3,6}\$", cost_center)
  msg := sprintf("cost-center '%v' must follow format CC-XXX (e.g., CC-001)", [cost_center])
}
\`\`\`

### Policy Test with OPA
\`\`\`rego
# policy_test.rego
package k8s.pod.security_test

import data.k8s.pod.security

# Test: should deny privileged container
test_deny_privileged_container {
  deny["Container nginx cannot run as UID 0 (root)"] with input as {
    "kind": "Pod",
    "spec": {
      "containers": [{
        "name": "nginx",
        "securityContext": {"runAsUser": 0}
      }]
    }
  }
}

# Test: should allow non-privileged container
test_allow_non_privileged {
  count(deny) == 0 with input as {
    "kind": "Pod",
    "spec": {
      "containers": [{
        "name": "nginx",
        "securityContext": {
          "privileged": false,
          "readOnlyRootFilesystem": true,
          "runAsUser": 1000
        }
      }]
    }
  }
}
\`\`\`

## Common Errors

### 1. Rego returns undefined instead of false
**Cause**: Undefined rule returns undefined (not false).
**Solution**: Use \`default allow = false\` to ensure an explicit default value.

### 2. Variable used before being defined in the block
**Cause**: Order of declarations in Rego doesn't matter — OPA evaluates as a set of facts.
**Solution**: Check for typos in variable names or references to non-existent fields.

### 3. Conftest fails with "no policies found"
**Cause**: Policy doesn't have package main or is in the wrong namespace.
**Solution**: Check \`package main\` at the beginning of the .rego file or use \`--namespace\` to specify.

### 4. OPA server doesn't reload policies
**Cause**: Policies loaded at startup are not automatically reloaded.
**Solution**: Use a bundle server with \`polling\` configured or restart the server.

### 5. Slow performance with policies on large datasets
**Cause**: Unindexed iteration over large datasets.
**Solution**: Use \`data[key]\` with a key instead of iterating with \`_\` when possible.

## Killer.sh Style Challenge

**Context**: The security team wants policy-as-code in the deployment pipeline:
1. Install conftest
2. Create a Rego policy that: denies privileged containers, requires limits.memory, warns about :latest tag
3. Test the policy against a problematic Deployment
4. Fix the Deployment to pass all checks
5. Integrate the check in GitHub Actions with PR failure on deny`,

  quiz: [
    {
      question: 'What is the behavior of a Rego rule that returns "undefined"?',
      options: [
        'It is equivalent to returning "false" — the rule fails',
        'It is different from false — the rule was not defined for that input',
        'It causes a runtime error in OPA',
        'It is equivalent to returning "true" — the rule is true by default'
      ],
      correct: 1,
      explanation: 'In Rego, "undefined" means the rule simply does not apply to the given input — it is different from false. That is why it is recommended to use "default allow = false" to ensure an explicit default value. Without the default, an undefined allow rule would be interpreted as "I don\'t know" rather than "not allowed".',
      reference: 'Concept: Rego Language — Rego syntax in theory.'
    },
    {
      question: 'What does the "conftest test deployment.yaml" command do?',
      options: [
        'Validates the YAML against the Kubernetes schema',
        'Executes Rego policies in ./policy/ against the file and reports deny/warn/pass',
        'Applies the deployment to the cluster after validation',
        'Tests connectivity with the Kubernetes cluster'
      ],
      correct: 1,
      explanation: 'conftest test executes Rego policies (by default in ./policy/) against the configuration file. Returns FAIL for deny[] rules, WARN for warn[], and PASS when no violations. It is used in CI/CD pipelines to block PRs with insecure configurations.',
      reference: 'Concept: Conftest — "Conftest: OPA for CI/CD" section in theory.'
    },
    {
      question: 'What is the main difference between Kyverno and Gatekeeper when handling policies?',
      options: [
        'Kyverno uses Rego; Gatekeeper uses declarative YAML',
        'Kyverno uses native YAML policies; Gatekeeper uses Rego policies',
        'Kyverno is only for mutations; Gatekeeper is only for validations',
        'Kyverno does not support Kubernetes; Gatekeeper is exclusive to K8s'
      ],
      correct: 1,
      explanation: 'Kyverno uses YAML policies (ClusterPolicy, Policy) with declarative syntax without a separate programming language. Gatekeeper uses Rego — a more powerful declarative policy language but with a higher learning curve. Kyverno is more accessible for teams familiar with YAML; Gatekeeper is more expressive for complex cases.',
      reference: 'Concept: OPA vs Kyverno vs Gatekeeper — comparison table in theory.'
    },
    {
      question: 'In Rego, what does the "_" (underscore) symbol represent in an expression like "container := input.spec.containers[_]"?',
      options: [
        'The numeric index of the last element in the array',
        'A wildcard that iterates over all elements of the array',
        'An ignored variable that cannot be referenced',
        'The default value when the element does not exist'
      ],
      correct: 1,
      explanation: 'The underscore _ is a wildcard in Rego that represents "any element". "containers[_]" means "any container in the array". OPA will evaluate the rule for each possible combination. If the violation applies to any container, it is added to the result. It is the Rego way to iterate without imperative loops.',
      reference: 'Concept: Rego Syntax — wildcards in theory.'
    },
    {
      question: 'How does standalone OPA differ from Gatekeeper in terms of use cases?',
      options: [
        'Standalone OPA only works on Linux; Gatekeeper on any OS',
        'Standalone OPA can be used for APIs, microservices, Terraform and more — not just K8s; Gatekeeper is exclusive to K8s',
        'Standalone OPA does not support Rego; Gatekeeper does',
        'Standalone OPA is open source; Gatekeeper is commercial'
      ],
      correct: 1,
      explanation: 'Standalone OPA is a generic policy engine that can be integrated with any system that can make HTTP calls: REST APIs, microservices, CI/CD pipelines, Terraform (via Sentinel), Envoy, etc. Gatekeeper is OPA specialized only for Kubernetes (ValidatingAdmissionWebhook).',
      reference: 'Concept: OPA Standalone Server — section in theory.'
    },
    {
      question: 'What is the function of the "data" document in OPA?',
      options: [
        'Contains the request being evaluated (immutable during evaluation)',
        'Contains the knowledge base: external policies, allow lists, configurations',
        'Contains the result of policy evaluation',
        'Contains logs of previous OPA decisions'
      ],
      correct: 1,
      explanation: 'In OPA, "data" is the knowledge base document — it contains external data that policies consult: lists of allowed users, approved registries, configurations, etc. It is separate from "input" (the immutable request). Policies can combine input + data for contextual decisions.',
      reference: 'Concept: Rego Document Structure — section in theory.'
    },
    {
      question: 'How do you integrate conftest in a GitHub Actions pipeline to block PRs with violations?',
      options: [
        'Using kubectl apply --dry-run with conftest as a validator',
        'Creating a step that runs conftest test and failing the job if there is FAIL output',
        'Configuring a GitHub webhook to call the OPA server',
        'Using GitOps with ArgoCD that automatically calls conftest'
      ],
      correct: 1,
      explanation: 'conftest returns exit code 1 when there are failures (deny[]). In GitHub Actions, just add a step with "run: conftest test k8s/" — the job automatically fails if conftest returns exit code 1, blocking the PR. It is the simplest way to do policy-as-code in CI/CD.',
      reference: 'Concept: Conftest in CI/CD — "Conftest in GitLab CI / GitHub Actions" section in theory.'
    },
    {
      question: 'What is an OPA Bundle and what is its purpose?',
      options: [
        'A set of Constraints applied simultaneously',
        'A .tar.gz file containing policies and data that OPA loads from a centralized server',
        'A Helm package to install OPA',
        'A set of Rego tests executed together'
      ],
      correct: 1,
      explanation: 'A Bundle is a .tar.gz file containing .rego files (policies) and .json files (data). OPA can load bundles from a centralized server (Bundle Server) and update them periodically via polling. This allows distributing centralized policies to multiple OPA instances without restarting.',
      reference: 'Concept: Bundle Server — "Bundle Server: Distributing Policies" section in theory.'
    }
  ],

  flashcards: [
    {
      front: 'What are the 3 main OPA documents and what are they for?',
      back: 'input:\n- Request being evaluated\n- Immutable during evaluation\n- Provided by the caller (app, K8s, Envoy)\n- e.g.: {method: "GET", user: "alice"}\n\ndata:\n- Knowledge base\n- External policies and auxiliary data\n- e.g.: list of users, allowed registries\n- Can be loaded from bundle server\n\nresult (output):\n- Result of evaluation\n- e.g.: allow = true/false\n- e.g.: deny = ["error message"]\n- e.g.: violations = [{msg: "..."}]'
    },
    {
      front: 'What is the difference between "deny" and "warn" in Conftest policies?',
      back: 'deny[msg] {\n  # Policy violation\n  # Causes FAIL in conftest\n  # Exit code 1 → blocks CI/CD\n  # Message shown as FAIL\n}\n\nwarn[msg] {\n  # Warning condition\n  # Causes WARN in conftest\n  # Exit code 0 → does not block CI/CD\n  # Message shown as WARN\n}\n\nTypical use:\n- deny: critical security violations\n  (privileged: true, hostNetwork, etc)\n- warn: non-mandatory best practices\n  (:latest tag, no liveness probe, etc)'
    },
    {
      front: 'How do you write tests for Rego policies?',
      back: '# File: policy_test.rego\npackage example_test\nimport data.example\n\n# Positive test: should deny\ntest_deny_privileged {\n  # Pass simulated input and verify result\n  example.deny["msg"] with input as {\n    "kind": "Pod",\n    "spec": {"containers": [{\n      "name": "app",\n      "securityContext": {"privileged": true}\n    }]}\n  }\n}\n\n# Negative test: should not deny\ntest_allow_safe_pod {\n  count(example.deny) == 0 with input as {\n    "kind": "Pod",\n    "spec": {"containers": [{\n      "name": "app",\n      "securityContext": {"privileged": false}\n    }]}\n  }\n}\n\n# Run tests\nopa test policy/ -v'
    },
    {
      front: 'OPA vs Kyverno vs Gatekeeper comparison — when to use each?',
      back: 'OPA Standalone:\n✅ Policies beyond K8s (APIs, Terraform, Envoy)\n✅ Maximum expressiveness (Rego)\n✅ Reuse same policy across multiple systems\n❌ Requires manual K8s integration\n❌ Rego learning curve is steep\n\nGatekeeper:\n✅ OPA native in K8s with CRDs\n✅ Automatic continuous audit\n✅ Mutations via AssignMetadata/Assign\n❌ Rego still required\n❌ K8s only\n\nKyverno:\n✅ Policies in pure YAML\n✅ Can GENERATE resources (ClusterRole, ConfigMap)\n✅ Very fast onboarding\n❌ Less expressive than Rego\n❌ K8s only'
    },
    {
      front: 'How is Conftest used in CI/CD pipelines for policy-as-code?',
      back: 'Flow:\n1. Developer creates/modifies K8s manifest\n2. Push to branch → triggers CI\n3. conftest test k8s/ runs Rego policies\n4. If deny[] → exit code 1 → CI fails → PR blocked\n5. If warn[] → CI passes with warning\n6. PR only merged after fixing violations\n\nCommands:\nconftest test deployment.yaml\nconftest test k8s/ --policy policy/\nconftest pull ghcr.io/org/policies:latest\n\nGitHub Actions integration:\n- name: Policy Check\n  run: conftest test k8s/\n  # Job automatically fails if exit code 1\n\nBenefits:\n- Prevents cluster issues\n- Immediate feedback to developer\n- Policies versioned alongside code'
    },
    {
      front: 'How does OPA integrate with Envoy for service mesh authorization?',
      back: 'Architecture:\n1. Envoy as sidecar for each service\n2. Envoy sends requests to OPA via ext_authz (gRPC)\n3. OPA evaluates policy with HTTP attributes\n4. OPA returns allow/deny\n5. Envoy passes or blocks the request\n\nAdvantages:\n- Centralized policies in OPA\n- Applied to any service without modifying code\n- JWT validation, RBAC, rate limiting via policy\n- Observability: OPA decision logs\n\nRego policy for Envoy:\npackage envoy.authz\nimport input.attributes.request.http as req\ndefault allow = false\nallow {\n  req.path == "/health"\n  req.method == "GET"\n}'
    },
    {
      front: 'What are wildcards and list comprehension in Rego?',
      back: 'Wildcard _ (any element):\n# Iterate over all containers\ncontainer := input.spec.containers[_]\n\n# Iterate over all volumes\nvolume := input.spec.volumes[_]\n\nList comprehension:\n# Collect names of containers without limits\nno_limits := [name |\n  container := input.spec.containers[_]\n  not container.resources.limits.memory\n  name := container.name\n]\n\nSet comprehension:\nprivileged_containers := {name |\n  container := input.spec.containers[_]\n  container.securityContext.privileged\n  name := container.name\n}\n\n# Check if set is not empty\nviolation {\n  count(privileged_containers) > 0\n}'
    },
    {
      front: 'How to use the OPA Bundle Server to distribute policies?',
      back: 'Bundle = .tar.gz file with:\n- .rego files (policies)\n- .json (external data)\n- manifest.json (metadata)\n\nCreate bundle:\nopa build policy/ data/ -o bundle.tar.gz\n\nOPA config to consume bundle:\nservices:\n  - name: bundle-server\n    url: https://bundles.company.com\nbundles:\n  main:\n    service: bundle-server\n    resource: /v1/bundle.tar.gz\n    polling:\n      min_delay_seconds: 30\n      max_delay_seconds: 120\n\nAdvantages:\n- Policies updated without restart\n- Centralized versioning\n- Multiple OPAs with same policy\n- Bundle signing (security)\nopa build --signing-key private.pem policy/'
    }
  ],

  lab: {
    scenario: 'The security team wants to implement policy-as-code in the deployment pipeline. Before any manifest reaches the cluster, it must pass Rego policy validation via conftest. You must create the policies and integrate them into the workflow.',
    objective: 'Install conftest, create Rego security policies for K8s, test against problematic manifests, fix the manifests and validate they pass the policies.',
    duration: '25-35 minutes',
    steps: [
      {
        title: 'Install Conftest and Create Policy Structure',
        instruction: `Install conftest and create the directory structure for policies:

1. Install conftest (via binary or package manager)
2. Create the \`policy/\` directory with a \`k8s.rego\` file
3. The policy must:
   - Deny privileged containers
   - Deny containers without \`limits.memory\`
   - Warn about images with \`:latest\` tag
   - Deny use of \`hostNetwork: true\``,
        hints: [
          'conftest uses package main by default',
          'deny[] for errors, warn[] for warnings',
          'The wildcard _ iterates over all elements of an array',
          'sprintf formats messages with useful context'
        ],
        solution: `\`\`\`bash
# Install conftest
CONFTEST_VERSION=0.46.0
wget https://github.com/open-policy-agent/conftest/releases/download/v\${CONFTEST_VERSION}/conftest_\${CONFTEST_VERSION}_Linux_x86_64.tar.gz
tar xzf conftest_\${CONFTEST_VERSION}_Linux_x86_64.tar.gz
sudo mv conftest /usr/local/bin/
conftest --version

# Create structure
mkdir -p policy

# Create Rego policy
cat > policy/k8s.rego << 'EOF'
package main

# Deny privileged containers
deny[msg] {
  input.kind == "Deployment"
  container := input.spec.template.spec.containers[_]
  container.securityContext.privileged == true
  msg := sprintf("SECURITY: Container '%v' cannot be privileged", [container.name])
}

# Deny containers without limits.memory
deny[msg] {
  input.kind == "Deployment"
  container := input.spec.template.spec.containers[_]
  not container.resources.limits.memory
  msg := sprintf("RESOURCES: Container '%v' must have limits.memory defined", [container.name])
}

# Deny hostNetwork
deny[msg] {
  input.kind == "Deployment"
  input.spec.template.spec.hostNetwork == true
  msg := "NETWORK: Deployment cannot use hostNetwork: true"
}

# Warn about :latest tag
warn[msg] {
  input.kind == "Deployment"
  container := input.spec.template.spec.containers[_]
  endswith(container.image, ":latest")
  msg := sprintf("IMAGE: Container '%v' uses :latest tag — prefer a specific version", [container.name])
}
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verify installation
conftest --version
# Expected output: conftest version 0.46.0

# Verify policy file
ls policy/
# Expected output: k8s.rego

# Quick test with inline YAML
echo 'kind: Deployment
metadata:
  name: test
spec:
  template:
    spec:
      containers:
        - name: app
          image: nginx:latest
          securityContext:
            privileged: false' | conftest test - --policy policy/
# Expected output: WARN - IMAGE: Container 'app' uses :latest tag
# (and FAIL for missing limits.memory)
\`\`\``
      },
      {
        title: 'Test Problematic Manifests and Fix Them',
        instruction: `Create two test manifests:
1. \`bad-deployment.yaml\` — with multiple violations (privileged, no limits, :latest, hostNetwork)
2. \`good-deployment.yaml\` — compliant with all policies

Run conftest on both and validate that:
- bad-deployment has FAILs and WARNs
- good-deployment passes without errors`,
        hints: [
          'conftest returns exit code 1 if there are deny violations, 0 if only warn or pass',
          'Use "conftest test --no-color" for clean output in logs',
          'good-deployment needs: no privileged, limits.memory defined, image with specific tag, no hostNetwork'
        ],
        solution: `\`\`\`bash
# Create problematic manifest
cat > bad-deployment.yaml << 'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bad-app
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: bad-app
  template:
    metadata:
      labels:
        app: bad-app
    spec:
      hostNetwork: true
      containers:
        - name: app
          image: nginx:latest
          securityContext:
            privileged: true
          # No resources.limits!
EOF

# Test problematic manifest
conftest test bad-deployment.yaml
# Expected: multiple FAILs

# Create compliant manifest
cat > good-deployment.yaml << 'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: good-app
  namespace: default
  labels:
    team: platform
    cost-center: CC-001
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
      hostNetwork: false
      containers:
        - name: app
          image: nginx:1.25.3
          securityContext:
            privileged: false
            readOnlyRootFilesystem: true
            runAsNonRoot: true
            runAsUser: 1000
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi
EOF

# Test compliant manifest
conftest test good-deployment.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verify bad-deployment fails with exit code 1
conftest test bad-deployment.yaml; echo "Exit: \$?"
# Expected output:
# FAIL - bad-deployment.yaml - main - SECURITY: Container 'app' cannot be privileged
# FAIL - bad-deployment.yaml - main - RESOURCES: Container 'app' must have limits.memory
# FAIL - bad-deployment.yaml - main - NETWORK: Deployment cannot use hostNetwork: true
# WARN - bad-deployment.yaml - main - IMAGE: Container 'app' uses :latest tag
# Exit: 1

# Verify good-deployment passes with exit code 0
conftest test good-deployment.yaml; echo "Exit: \$?"
# Expected output:
# 1 test, 0 failures  (or similar)
# Exit: 0

# Test both together
conftest test bad-deployment.yaml good-deployment.yaml
# Expected: good-deployment.yaml passes, bad-deployment.yaml fails
\`\`\``
      },
      {
        title: 'Create Advanced Policy with Rego Tests',
        instruction: `Create a more advanced policy with automated tests:

1. Add a new policy \`policy/governance.rego\` that validates required labels (team, cost-center) on Deployments
2. Create a test file \`policy/governance_test.rego\`
3. Run \`opa test policy/\` to validate the tests
4. Run conftest against the manifests created in the previous step`,
        hints: [
          'Rego test files must end in _test.rego',
          'Test functions start with test_',
          'Use "with input as {...}" to simulate inputs in tests',
          'opa test runs native Rego tests (not conftest)'
        ],
        solution: `\`\`\`bash
# Create governance policy
cat > policy/governance.rego << 'EOF'
package main

required_labels := {"team", "cost-center"}

# Check required labels on Deployments
deny[msg] {
  input.kind == "Deployment"
  label := required_labels[_]
  not input.metadata.labels[label]
  msg := sprintf("GOVERNANCE: Missing required label: '%v'", [label])
}
EOF

# Create policy tests
cat > policy/governance_test.rego << 'EOF'
package main_test

import data.main

# Test: should deny deployment without labels
test_deny_missing_labels {
  main.deny["GOVERNANCE: Missing required label: 'team'"] with input as {
    "kind": "Deployment",
    "metadata": {
      "name": "test",
      "labels": {"cost-center": "CC-001"}  # missing team!
    },
    "spec": {
      "template": {
        "spec": {
          "containers": [{
            "name": "app",
            "image": "nginx:1.25",
            "securityContext": {"privileged": false},
            "resources": {"limits": {"memory": "128Mi"}}
          }]
        }
      }
    }
  }
}

# Test: should pass with required labels
test_pass_with_required_labels {
  result := main.deny with input as {
    "kind": "Deployment",
    "metadata": {
      "name": "test",
      "labels": {
        "team": "backend",
        "cost-center": "CC-001"
      }
    },
    "spec": {
      "template": {
        "spec": {
          "containers": [{
            "name": "app",
            "image": "nginx:1.25",
            "securityContext": {"privileged": false},
            "resources": {"limits": {"memory": "128Mi"}}
          }]
        }
      }
    }
  }
  # No governance deny should be triggered
  count([r | r := result[_]; startswith(r, "GOVERNANCE:")]) == 0
}
EOF

# Install OPA to run tests
curl -L -o opa https://openpolicyagent.org/downloads/v0.65.0/opa_linux_amd64_static
chmod +x opa
sudo mv opa /usr/local/bin/

# Run Rego tests
opa test policy/ -v

# Run conftest on both deployments with new policy
conftest test bad-deployment.yaml good-deployment.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verify Rego tests pass
opa test policy/ -v
# Expected output:
# PASS: test_deny_missing_labels (Xms)
# PASS: test_pass_with_required_labels (Xms)
# -------
# PASS: 2/2 tests

# Verify that good-deployment now fails for missing labels
conftest test good-deployment.yaml
# Expected output: FAIL - GOVERNANCE: Missing required label
# (good-deployment doesn't have team/cost-center labels in metadata)

# Add labels to good-deployment and test again
kubectl patch --local -f good-deployment.yaml \\
  --type merge \\
  -p '{"metadata":{"labels":{"team":"platform","cost-center":"CC-001"}}}' \\
  -o yaml > good-deployment-labeled.yaml

conftest test good-deployment-labeled.yaml; echo "Exit: \$?"
# Expected output: Exit: 0 (passes all policies)
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Conftest returns "no policies found" when testing files',
      difficulty: 'easy',
      symptom: 'When running "conftest test deployment.yaml", the output shows "no policies found" and the result is always PASS, even with clearly incorrect manifests.',
      diagnosis: `\`\`\`bash
# Check current policy directory
ls policy/ 2>/dev/null || echo "policy/ directory not found"

# Check policy package
head -3 policy/k8s.rego
# Must start with: package main

# See where conftest looks for policies
conftest test deployment.yaml --verbose

# List available policies
conftest test deployment.yaml --trace

# Check directory structure
find . -name "*.rego" -type f
\`\`\``,
      solution: `**Cause 1**: policy/ directory does not exist in the current directory.
\`\`\`bash
# Create directory and add policy
mkdir -p policy
# ... create .rego files

# Or specify path explicitly
conftest test deployment.yaml --policy /path/to/policy/
\`\`\`

**Cause 2**: Wrong package — must be "package main" for conftest to use by default.
\`\`\`rego
# WRONG:
package k8s.security

# CORRECT (conftest default):
package main

deny[msg] { ... }
\`\`\`
Or use specific namespace:
\`\`\`bash
conftest test deployment.yaml --namespace k8s.security
\`\`\`

**Cause 3**: .rego file with syntax error — conftest silently ignores it.
\`\`\`bash
# Check syntax
opa check policy/k8s.rego
# If it returns an error: fix the Rego error before using conftest
\`\`\``
    },
    {
      title: 'Rego policy always returns undefined instead of false for "allow"',
      difficulty: 'medium',
      symptom: 'An OPA policy for allowing/denying access always returns "undefined" when querying "data.myapp.authz.allow", even when all conditions should be false. The application interprets undefined as "permission not found" and uses an insecure default behavior.',
      diagnosis: `\`\`\`bash
# Evaluate policy with test input
opa eval -d policy.rego -i input.json "data.myapp.authz.allow"
# If returns {} empty: undefined

# Check if default rule is defined
grep "default allow" policy.rego

# Run with trace to see evaluation flow
opa eval -d policy.rego -i input.json \\
  --explain full "data.myapp.authz.allow"

# Test specific input interactively
opa run policy.rego
# > data.myapp.authz.allow with input as {"user": "alice"}
\`\`\``,
      solution: `**Cause**: Missing "default" rule — in Rego, undefined rules return undefined (not false).

\`\`\`rego
# PROBLEMATIC — without default:
package myapp.authz

allow {
  input.user == "admin"
}
# For user="alice": allow = undefined (not false!)

# CORRECT — with explicit default:
package myapp.authz

default allow = false  # <- CRITICAL: defines default behavior

allow {
  input.user == "admin"
}
# For user="alice": allow = false
# For user="admin": allow = true
\`\`\`

**Best practices**:
\`\`\`rego
# Always define defaults for main boolean rules
default allow = false
default deny = false

# For violation sets, use directly (empty set = no violations):
deny[msg] { ... }  # empty = no violations (no default needed)
\`\`\`

**Verify after fix**:
\`\`\`bash
opa eval -d policy.rego \\
  -i <(echo '{"user": "bob"}') \\
  "data.myapp.authz.allow"
# Expected output: {"result": false}  (not undefined!)
\`\`\``
    }
  ]
};
