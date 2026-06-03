window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['kyverno/kyverno-policies'] = {
  theory: `
# Kyverno: Validate, Mutate & Generate Advanced

## Relevance
This topic dives deeper into the three main Kyverno rule types with advanced techniques: validate with deny and foreach, mutate with JSON Patch and context/variable usage, and generate with cloneFrom. Also covers JMESPath and CEL for complex expressions — essential skills for building robust policies in production.

## Core Concepts

### Advanced Validate

#### Validate with Deny Conditions

\`\`\`yaml
# Deny pods with images using "latest" tag
rules:
  - name: deny-latest-tag
    match:
      any:
        - resources:
            kinds: [Pod]
    validate:
      message: "Images with :latest tag are not allowed. Use specific versions."
      deny:
        conditions:
          any:
            - key: "{{ images.containers.*.tag }}"
              operator: AnyIn
              value: ["latest", ""]   # Also block empty tag
\`\`\`

\`\`\`yaml
# Deny pods without proper securityContext
rules:
  - name: deny-privileged
    match:
      any:
        - resources:
            kinds: [Pod]
    validate:
      message: "Privileged containers are not allowed."
      deny:
        conditions:
          any:
            - key: "{{ request.object.spec.containers[].securityContext.privileged }}"
              operator: AnyIn
              value: [true]
            - key: "{{ request.object.spec.initContainers[].securityContext.privileged }}"
              operator: AnyIn
              value: [true]
\`\`\`

#### Validate with Foreach

\`\`\`yaml
# Validate EACH container individually with foreach
rules:
  - name: check-container-limits
    match:
      any:
        - resources:
            kinds: [Pod]
    validate:
      message: "Container '{{ element.name }}' must have CPU and memory limits."
      foreach:
        - list: "request.object.spec.containers"
          deny:
            conditions:
              any:
                - key: "{{ element.resources.limits.memory }}"
                  operator: Equals
                  value: ""
                - key: "{{ element.resources.limits.cpu }}"
                  operator: Equals
                  value: ""
\`\`\`

#### Validate with Context and External Lookup

\`\`\`yaml
# Fetch external data (ConfigMap) for validation
rules:
  - name: check-allowed-registries
    match:
      any:
        - resources:
            kinds: [Pod]
    context:
      - name: allowedRegistries
        configMap:
          name: allowed-registries
          namespace: kyverno
    validate:
      message: "Registry not allowed. Allowed registries: {{ allowedRegistries.data.list }}"
      foreach:
        - list: "request.object.spec.containers"
          deny:
            conditions:
              all:
                - key: "{{ element.image }}"
                  operator: AnyNotIn
                  value: "{{ allowedRegistries.data.list }}"
\`\`\`

### Advanced Mutate

#### patchStrategicMerge vs patchesJson6902

\`\`\`yaml
# patchStrategicMerge — intelligent merge (recommended for most cases)
mutate:
  patchStrategicMerge:
    spec:
      template:
        spec:
          containers:
            - (name): "*"              # Apply to ALL containers
              securityContext:
                runAsNonRoot: true
                allowPrivilegeEscalation: false

# patchesJson6902 — precise operations (RFC 6902)
mutate:
  patchesJson6902: |
    - op: add
      path: /metadata/labels/env
      value: production
    - op: replace
      path: /spec/replicas
      value: 2
    - op: remove
      path: /metadata/annotations/kubectl.kubernetes.io~1last-applied-configuration
\`\`\`

#### Mutate with Variables and JMESPath

\`\`\`yaml
# Add annotation with request information
rules:
  - name: add-request-metadata
    match:
      any:
        - resources:
            kinds: [Deployment]
    mutate:
      patchStrategicMerge:
        metadata:
          annotations:
            kyverno.io/created-by: "{{ request.userInfo.username }}"
            kyverno.io/created-at: "{{ time_now_utc() }}"
            kyverno.io/namespace: "{{ request.namespace }}"
\`\`\`

\`\`\`yaml
# Mutate with context — fetch data from ConfigMap
rules:
  - name: add-monitoring-sidecar
    match:
      any:
        - resources:
            kinds: [Deployment]
            selector:
              matchLabels:
                monitoring: "true"
    context:
      - name: sidecars
        configMap:
          name: sidecar-config
          namespace: monitoring
    mutate:
      patchStrategicMerge:
        spec:
          template:
            spec:
              containers:
                - name: prometheus-exporter
                  image: "{{ sidecars.data.exporterImage }}"
                  ports:
                    - containerPort: 9090
\`\`\`

#### Mutate with Foreach

\`\`\`yaml
# Add imagePullPolicy to ALL containers
rules:
  - name: set-image-pull-policy
    match:
      any:
        - resources:
            kinds: [Pod]
    mutate:
      foreach:
        - list: "request.object.spec.containers"
          patchStrategicMerge:
            spec:
              containers:
                - (name): "{{ element.name }}"
                  imagePullPolicy: Always
\`\`\`

\`\`\`yaml
# Add securityContext to each container with foreach and preconditions
rules:
  - name: add-security-context
    match:
      any:
        - resources:
            kinds: [Pod]
    mutate:
      foreach:
        - list: "request.object.spec.containers"
          preconditions:
            any:
              - key: "{{ element.securityContext }}"
                operator: Equals
                value: null           # Only add if securityContext doesn't exist
          patchStrategicMerge:
            spec:
              containers:
                - (name): "{{ element.name }}"
                  securityContext:
                    runAsNonRoot: true
                    allowPrivilegeEscalation: false
                    readOnlyRootFilesystem: true
\`\`\`

### Advanced Generate

#### Generate with CloneFrom

\`\`\`yaml
# Clone Secret from source namespace to new namespaces
rules:
  - name: clone-registry-secret
    match:
      any:
        - resources:
            kinds: [Namespace]
    generate:
      synchronize: true
      kind: Secret
      name: registry-credentials
      namespace: "{{ request.object.metadata.name }}"
      clone:
        namespace: kyverno              # Source namespace
        name: registry-credentials     # Secret to clone
\`\`\`

#### Generate Based on Label Trigger

\`\`\`yaml
# Create RoleBinding when Service Account has special label
rules:
  - name: create-rolebinding-for-sa
    match:
      any:
        - resources:
            kinds: [ServiceAccount]
            selector:
              matchLabels:
                app.kubernetes.io/managed-by: argocd
    generate:
      apiVersion: rbac.authorization.k8s.io/v1
      kind: RoleBinding
      name: "{{ request.object.metadata.name }}-rolebinding"
      namespace: "{{ request.namespace }}"
      data:
        roleRef:
          apiGroup: rbac.authorization.k8s.io
          kind: ClusterRole
          name: edit
        subjects:
          - kind: ServiceAccount
            name: "{{ request.object.metadata.name }}"
            namespace: "{{ request.namespace }}"
\`\`\`

### Preconditions — Apply Rule Only When

\`\`\`yaml
# Preconditions are checked BEFORE executing the rule
# If not satisfied, the rule is SKIPPED (not an error)
rules:
  - name: example-with-preconditions
    match:
      any:
        - resources:
            kinds: [Deployment]
    preconditions:
      all:
        # Only for Deployments with more than 1 replica
        - key: "{{ request.object.spec.replicas }}"
          operator: GreaterThanOrEquals
          value: 2
        # Only if not a status update
        - key: "{{ request.operation }}"
          operator: NotEquals
          value: DELETE
      any:
        # At least one of these labels
        - key: "{{ request.object.metadata.labels.tier }}"
          operator: AnyIn
          value: ["production", "staging"]
\`\`\`

### JMESPath — Advanced Expressions

\`\`\`yaml
# JMESPath functions available in Kyverno:

# length() — array size
key: "{{ request.object.spec.containers | length(@) }}"
operator: GreaterThan
value: "0"

# contains() — check substring
key: "{{ contains(request.object.spec.containers[0].image, 'registry.io') }}"
operator: Equals
value: true

# starts_with() — prefix
key: "{{ starts_with(request.object.spec.containers[0].image, 'gcr.io/') }}"

# ends_with() — suffix
key: "{{ ends_with(request.object.spec.containers[0].image, ':latest') }}"

# split() — split string
key: "{{ split(request.object.spec.containers[0].image, ':')[1] }}"
operator: NotEquals
value: "latest"

# to_number() — convert string to number
key: "{{ to_number(request.object.spec.replicas) }}"
operator: GreaterThan
value: "0"

# items() — iterate over object as key-value array
key: "{{ items(request.object.metadata.labels, 'key', 'value') }}"
\`\`\`

### Kyverno Builtin Variables

\`\`\`yaml
# request.*
{{ request.operation }}          # CREATE, UPDATE, DELETE, CONNECT
{{ request.namespace }}          # Resource namespace
{{ request.userInfo.username }}  # User who made the request
{{ request.userInfo.groups }}    # User groups
{{ request.object.* }}           # Resource being created/updated
{{ request.oldObject.* }}        # Previous state (UPDATE)

# images.* (for image validation)
{{ images.containers.<name>.tag }}       # Container image tag
{{ images.containers.<name>.registry }}  # Registry
{{ images.containers.<name>.name }}      # Image name

# serviceAccountName / serviceAccountNamespace
{{ serviceAccountName }}         # SA that made the request
{{ serviceAccountNamespace }}    # SA namespace

# element (inside foreach)
{{ element.name }}               # Field of the iterated element
{{ element.image }}

# Time functions
{{ time_now_utc() }}             # Current UTC timestamp
{{ time_add('1h') }}             # Add time
\`\`\`

### Advanced Common Mistakes

1. **JMESPath syntax error** — Use \`{{ }}\` instead of single quotes for JMESPath expressions in conditions
2. **foreach without element** — Inside foreach, the current item is accessed as \`element\`, not by variable name
3. **Precondition null check** — Check if field exists before using: \`key: "{{ element.securityContext | to_string(@) }}" operator: Equals value: "null"\`
4. **Context lookup timing** — Context is resolved BEFORE conditions, so values are available for use in conditions and patterns
5. **generate without RBAC** — Kyverno needs RBAC to create generated resources; the Kyverno ClusterRole needs permission on the target resource type

## Killer.sh Style Challenge

> **Scenario:** Create a ClusterPolicy called \`enforce-security\` with 3 rules: (1) validate that all containers in Pods do NOT use the "latest" tag — use JMESPath images.containers.*.tag; (2) mutate to add label "kyverno.io/scanned: true" to all created Pods; (3) validate with foreach that each container has readOnlyRootFilesystem: true or allowPrivilegeEscalation: false. Audit mode for validates, always apply the mutate.
`,
  quiz: [
    {
      question: 'What is the difference between validate.pattern and validate.deny?',
      options: [
        'pattern is faster than deny',
        'pattern validates the STRUCTURE of the resource with wildcards; deny uses boolean conditions (JMESPath/CEL) to deny based on logic',
        'deny only works with foreach',
        'pattern only works with strings'
      ],
      correct: 1,
      explanation: 'pattern does structural matching — the resource must MATCH the YAML pattern. deny uses conditions with operators (Equals, AnyIn, GreaterThan) over values extracted via JMESPath. pattern is more readable for structure; deny is necessary for complex logic like "don\'t allow privileged containers".',
      reference: 'Related concept: Combine pattern and deny in the same rule for complex validations.'
    },
    {
      question: 'What are preconditions in Kyverno and when to use them?',
      options: [
        'Preconditions are the same as match — they filter which resources the rule applies to',
        'Preconditions are checked AFTER match. If not satisfied, the rule is SKIPPED (no error). Used to apply conditional logic within a broad match.',
        'Preconditions only work with generate',
        'Preconditions replace the exclude block'
      ],
      correct: 1,
      explanation: 'match determines WHICH resources enter the rule. preconditions determine WHETHER the rule should execute for a resource that passed match. If preconditions fail, the rule is silently ignored — no error generated. Useful for: "only mutate if field X doesn\'t exist", "only generate if label Y is present".',
      reference: 'Related concept: preconditions can use JMESPath for complex logic, such as checking array lengths.'
    },
    {
      question: 'How does foreach work in validate rules?',
      options: [
        'foreach iterates over all namespaces',
        'foreach iterates over a JMESPath list (e.g., spec.containers) and applies validate/deny/pattern to EACH element individually',
        'foreach is only for mutate rules',
        'foreach only works with string arrays'
      ],
      correct: 1,
      explanation: 'foreach in validate iterates over a list (e.g., "request.object.spec.containers") and applies the conditions to each element. The current element is available as "element". Allows validating each container individually instead of using complex JMESPath expressions.',
      reference: 'Related concept: foreach is also available in mutate to modify each container individually.'
    },
    {
      question: 'What is the JMESPath function to check the size of an array?',
      options: [
        'count(@)',
        'length(@)',
        'size(@)',
        'total(@)'
      ],
      correct: 1,
      explanation: 'length(@) or length(array) returns the number of elements. Example: {{ request.object.spec.containers | length(@) }} returns how many containers the Pod has. Other functions: contains(), starts_with(), ends_with(), split(), to_number().',
      reference: 'Related concept: JMESPath is a query language for JSON. Kyverno adds custom functions like time_now_utc() and items().'
    },
    {
      question: 'What does patchesJson6902 do in mutate and when to use it instead of patchStrategicMerge?',
      options: [
        'patchesJson6902 is safer than patchStrategicMerge',
        'patchesJson6902 implements RFC 6902 with precise operations (add/replace/remove/move/copy). Use when you need to remove a field, move data, or perform specific operations that YAML merge doesn\'t support',
        'patchesJson6902 only works for ConfigMaps',
        'patchesJson6902 is for binary data'
      ],
      correct: 1,
      explanation: 'patchStrategicMerge: declarative YAML, more readable, ideal for adding/modifying fields. patchesJson6902: explicit operations (add, replace, remove, move, copy), precise for removing fields, renaming, or complex operations. Example: removing kubectl.kubernetes.io/last-applied-configuration annotation.',
      reference: 'Related concept: Most mutate cases can be solved with patchStrategicMerge. Reserve patchesJson6902 for removal or precision operations.'
    },
    {
      question: 'How do you access data from a ConfigMap in a Kyverno rule?',
      options: [
        'Using kubectl configmap in the pattern',
        'Using the context block with configMap.name and configMap.namespace, then referencing as {{ variableName.data.key }}',
        'ConfigMaps cannot be accessed in Kyverno rules',
        'Using a special annotation on the ConfigMap'
      ],
      correct: 1,
      explanation: 'The context block allows injecting external data into the rule. For ConfigMap: context[].name defines the variable name, context[].configMap.name and namespace identify the ConfigMap. Data is accessible as {{ varName.data.key }}. Also works with API Call, ImageRegistry and GlobalContextEntry.',
      reference: 'Related concept: context also supports apiCall to fetch other K8s resources at validation time.'
    },
    {
      question: 'Which Kyverno builtin variable contains information about who made the request?',
      options: [
        '{{ user.info }}',
        '{{ request.userInfo.username }} and {{ request.userInfo.groups }}',
        '{{ admission.user }}',
        '{{ context.requestor }}'
      ],
      correct: 1,
      explanation: 'request.userInfo contains information about the user/SA that initiated the request: username (e.g., "system:serviceaccount:default:my-sa"), groups (e.g., ["system:serviceaccounts"]), uid. Useful for audit trails, user-based policies, and contextual exclusions.',
      reference: 'Related concept: serviceAccountName and serviceAccountNamespace are shortcuts for the request\'s SA when coming from a ServiceAccount.'
    }
  ],
  flashcards: [
    {
      front: 'Validate: pattern vs deny vs foreach — when to use each?',
      back: '**pattern** — Structural YAML matching\nResource must MATCH the YAML\nSimple, readable, ideal for:\n- Checking label presence\n- Checking container structure\n\n**deny** — Boolean conditions\nUse JMESPath/CEL operators\nIdeal for:\n- Denying images with :latest tag\n- Denying privileged containers\n- Complex logic with operators\n\n**foreach** — List iteration\nApply validate to EACH element\nIdeal for:\n- Validating each container separately\n- Giving error message with container name\n- When JMESPath would be too complex\n\n**Combination:**\nPattern + deny in the same rule\nforeach with deny conditions'
    },
    {
      front: 'JMESPath — most used functions in Kyverno',
      back: '**Size:**\n`length(array)` — number of elements\n\n**Strings:**\n`contains(str, substr)` — has substring\n`starts_with(str, prefix)` — prefix\n`ends_with(str, suffix)` — suffix\n`split(str, delim)` — split\n`trim(str)` — remove spaces\n\n**Conversion:**\n`to_number(str)` — string to number\n`to_string(obj)` — object to string\n`base64_decode(str)` — decode\n\n**Arrays:**\n`items(obj, keyVar, valVar)` — object to array\n`merge(a, b)` — merge objects\n\n**Time:**\n`time_now_utc()` — current timestamp\n`time_since(t1, t2)` — difference\n\n**Syntax in rules:**\n`{{ expression | function(@) }}`'
    },
    {
      front: 'Most important Kyverno builtin variables',
      back: '**Request:**\n`request.operation` — CREATE/UPDATE/DELETE\n`request.namespace` — resource namespace\n`request.object.*` — new resource\n`request.oldObject.*` — old resource (UPDATE)\n`request.userInfo.username` — who did it\n`request.userInfo.groups` — groups\n\n**Images:**\n`images.containers.<name>.tag`\n`images.containers.<name>.registry`\n`images.initContainers.<name>.tag`\n\n**Foreach:**\n`element` — current element\n`elementIndex` — element index\n\n**Request SA:**\n`serviceAccountName`\n`serviceAccountNamespace`\n\n**Time:**\n`time_now_utc()`'
    },
    {
      front: 'patchStrategicMerge vs patchesJson6902',
      back: '**patchStrategicMerge:**\nIntelligent YAML merge\n- Add fields: native support\n- Modify fields: native support\n- Remove fields: NOT supported directly\n- More readable\n- Ideal for 90% of cases\n\n**patchesJson6902 (RFC 6902):**\nExplicit operations:\n```\n- op: add\n  path: /path\n  value: x\n- op: replace\n  path: /path\n  value: y\n- op: remove\n  path: /path\n- op: move\n  from: /path1\n  path: /path2\n- op: copy\n  from: /path1\n  path: /path2\n```\nUse when:\n- Need to REMOVE a field\n- Move/copy operation\n- Precision on array by index'
    },
    {
      front: 'Context in Kyverno — types and usage',
      back: '**configMap:**\nFetch data from a ConfigMap\n```yaml\ncontext:\n  - name: myData\n    configMap:\n      name: config\n      namespace: default\n```\nUsage: `{{ myData.data.key }}`\n\n**apiCall:**\nMake K8s API call\n```yaml\ncontext:\n  - name: pods\n    apiCall:\n      urlPath: /api/v1/namespaces/{{request.namespace}}/pods\n      jmesPath: items[*].metadata.name\n```\n\n**imageRegistry:**\nFetch image metadata\n```yaml\ncontext:\n  - name: imageData\n    imageRegistry:\n      reference: "{{ element.image }}"\n```\n\n**variable:**\nComputed variable\n```yaml\ncontext:\n  - name: isProduction\n    variable:\n      value: "{{ request.namespace == \'production\' }}"\n```'
    },
    {
      front: 'Generate: synchronize and cloneFrom',
      back: '**synchronize: true:**\nKyverno maintains the generated resource.\nIf deleted, re-creates automatically.\nResource "belongs" to Kyverno.\n\n**synchronize: false:**\nKyverno creates once and abandons.\nResource can be modified freely.\n\n**data (inline):**\n```yaml\ngenerate:\n  synchronize: true\n  kind: NetworkPolicy\n  name: default-deny\n  namespace: "{{ request.object.metadata.name }}"\n  data:\n    spec:\n      podSelector: {}\n      policyTypes: [Ingress]\n```\n\n**clone (from another resource):**\n```yaml\ngenerate:\n  synchronize: true\n  kind: Secret\n  name: registry-creds\n  namespace: "{{ request.object.metadata.name }}"\n  clone:\n    namespace: kyverno\n    name: registry-credentials\n```\nClones the Secret from kyverno namespace\nto the new namespace.'
    }
  ],
  lab: {
    scenario: 'You need to implement advanced security policies in the cluster: block images with latest tag, mutate pods to add proper securityContext, and generate security resources in new namespaces.',
    objective: 'Learn validate deny with JMESPath, mutate with foreach and preconditions, and generate with cloneFrom.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Advanced Validate — Block :latest Tag with JMESPath',
        instruction: `Create a validate ClusterPolicy using deny conditions:
1. Block Pods with containers using :latest tag or no tag
2. Use builtin variable {{ images.containers.*.tag }}
3. Enforce mode
4. Test with a Pod using :latest image, then with a specific version`,
        hints: [
          'images.containers.*.tag returns an array with all container image tags',
          'AnyIn operator checks if any element in the array is in the value list',
          'Empty string should also be blocked (image without tag uses implicit :latest)'
        ],
        solution: `\`\`\`yaml
# deny-latest-tag.yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: deny-latest-tag
  annotations:
    policies.kyverno.io/title: Deny Latest Tag
    policies.kyverno.io/severity: high
spec:
  validationFailureAction: Enforce
  background: true
  rules:
    - name: check-image-tag
      match:
        any:
          - resources:
              kinds: [Pod]
      exclude:
        any:
          - resources:
              namespaces: [kube-system, kyverno]
      validate:
        message: "Tag ':latest' or images without a tag are not allowed. Use a specific version (e.g., nginx:1.25.0)."
        deny:
          conditions:
            any:
              - key: "{{ images.containers.*.tag }}"
                operator: AnyIn
                value:
                  - "latest"
                  - ""
\`\`\`

\`\`\`bash
kubectl apply -f deny-latest-tag.yaml

# Test: should be BLOCKED
kubectl run test-latest --image=nginx:latest -n default
# Expected: ERROR - admission webhook blocked

# Test: should PASS
kubectl run test-versioned --image=nginx:1.25.0 -n default
# Expected: pod created successfully
\`\`\``,
        verify: `\`\`\`bash
# Verify policy is active
kubectl get clusterpolicy deny-latest-tag
# Expected: READY=true VALIDATIONACTION=Enforce

# Confirm pod with specific version was created
kubectl get pod test-versioned
# Expected: Running

# Confirm latest pod was blocked (should not exist)
kubectl get pod test-latest 2>&1
# Expected: "not found" or error

# See PolicyReport with details
kubectl get policyreport -n default
# Expected: entry for deny-latest-tag

# Clean up
kubectl delete pod test-versioned -n default
\`\`\``
      },
      {
        title: 'Mutate with Foreach and Preconditions',
        instruction: `Create a mutate policy to add proper securityContext:
1. Add readOnlyRootFilesystem: true to containers that DON'T have securityContext.readOnlyRootFilesystem defined
2. Use foreach to iterate over containers
3. Use preconditions to only apply when the field doesn't exist
4. Test that containers already configured are not modified`,
        hints: [
          'foreach iterates over request.object.spec.containers',
          'preconditions use element.* to access the current container',
          'To check if field is null: operator: Equals, value: null'
        ],
        solution: `\`\`\`yaml
# mutate-security-context.yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: add-readonly-rootfs
spec:
  rules:
    - name: set-readonly-rootfs
      match:
        any:
          - resources:
              kinds: [Pod]
      exclude:
        any:
          - resources:
              namespaces: [kube-system, kyverno]
      mutate:
        foreach:
          - list: "request.object.spec.containers"
            preconditions:
              all:
                - key: "{{ element.securityContext.readOnlyRootFilesystem }}"
                  operator: Equals
                  value: null    # Only add if it doesn't exist
            patchStrategicMerge:
              spec:
                containers:
                  - (name): "{{ element.name }}"
                    securityContext:
                      readOnlyRootFilesystem: true
                      allowPrivilegeEscalation: false
\`\`\`

\`\`\`bash
kubectl apply -f mutate-security-context.yaml

# Create Pod without securityContext — should be mutated
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: test-mutate-sc
  namespace: default
spec:
  containers:
    - name: app
      image: nginx:1.25.0
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verify securityContext was added by mutate
kubectl get pod test-mutate-sc -o jsonpath='{.spec.containers[0].securityContext}'
# Expected: {"allowPrivilegeEscalation":false,"readOnlyRootFilesystem":true}

# See full pod YAML
kubectl get pod test-mutate-sc -o yaml | grep -A5 "securityContext:"

# Create Pod WITH its own securityContext — should NOT be altered
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: test-no-mutate
  namespace: default
spec:
  containers:
    - name: app
      image: nginx:1.25.0
      securityContext:
        readOnlyRootFilesystem: false
        runAsUser: 1000
EOF

kubectl get pod test-no-mutate -o jsonpath='{.spec.containers[0].securityContext.readOnlyRootFilesystem}'
# Expected: false (kept the original value)

# Clean up
kubectl delete pod test-mutate-sc test-no-mutate -n default
\`\`\``
      },
      {
        title: 'Generate with CloneFrom — Clone Secret to New Namespaces',
        instruction: `Configure automatic Secret generation in new namespaces:
1. Create a "registry-credentials" Secret in the kyverno namespace as source
2. Create a ClusterPolicy that clones this Secret to every new namespace created
3. Use synchronize: true to keep in sync
4. Create a test namespace and verify the Secret was automatically cloned`,
        hints: [
          'The source Secret must exist BEFORE creating the policy',
          'generate.clone references the namespace and name of the source resource',
          'synchronize: true ensures that if the clone is deleted, it will be re-created'
        ],
        solution: `\`\`\`bash
# Create source Secret in kyverno namespace
kubectl create secret docker-registry registry-credentials \\
  --docker-server=registry.acme.io \\
  --docker-username=deploy-user \\
  --docker-password=super-secret-token \\
  -n kyverno
\`\`\`

\`\`\`yaml
# generate-registry-secret.yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: clone-registry-secret
spec:
  rules:
    - name: clone-secret
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
        kind: Secret
        name: registry-credentials
        namespace: "{{ request.object.metadata.name }}"
        clone:
          namespace: kyverno
          name: registry-credentials
\`\`\`

\`\`\`bash
kubectl apply -f generate-registry-secret.yaml
kubectl create namespace team-beta
sleep 5
\`\`\``,
        verify: `\`\`\`bash
# Verify Secret was automatically cloned
kubectl get secret registry-credentials -n team-beta
# Expected: Secret "registry-credentials" in namespace team-beta

# Verify it is of docker-registry type
kubectl get secret registry-credentials -n team-beta -o jsonpath='{.type}'
# Expected: kubernetes.io/dockerconfigjson

# Test synchronize: delete the clone and see re-creation
kubectl delete secret registry-credentials -n team-beta
sleep 10
kubectl get secret registry-credentials -n team-beta
# Expected: Secret RE-CREATED by Kyverno

# Check Kyverno labels on generated resource
kubectl get secret registry-credentials -n team-beta -o jsonpath='{.metadata.labels}'
# Expected: labels including generate.kyverno.io/policy-name

# Clean up
kubectl delete namespace team-beta
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'JMESPath expression returns syntax error in rule',
      difficulty: 'medium',
      symptom: 'The ClusterPolicy was created but stays READY=False. kubectl describe shows a parsing error in the JMESPath expression.',
      diagnosis: `\`\`\`bash
# 1. Check ClusterPolicy status
kubectl get clusterpolicy <name> -o yaml | grep -A10 "status:"
# Look for "ready: false" and error message

# 2. Check ClusterPolicy conditions
kubectl describe clusterpolicy <name> | grep -A10 "Conditions:"

# 3. Check admission controller logs
kubectl logs -n kyverno \\
  -l app.kubernetes.io/component=admission-controller \\
  --tail=30 | grep -i "error\\|parse\\|jmespath"

# 4. Test the expression locally with kyverno CLI
kyverno jp query -i resource.json -q "spec.containers[].image"
\`\`\``,
      solution: `**Causes and solutions:**

1. **Double delimiters:** JMESPath expressions must use \`{{ }}\`. If used inside a YAML field that already has quotes, there may be a conflict. Use external single quotes: \`'{{ expression }}'\`.

2. **Non-existent path:** The JMESPath path points to a field that may not exist (e.g., spec.initContainers when Pod has no initContainers). Add a check: \`| length(@) > \`0\`\`.

3. **Wrong operator for type:** Using \`AnyIn\` with a value that is not an array. \`AnyIn\` compares array vs array. For a single value, use \`Equals\`.

4. **Pipe (\`|\`) in YAML:** The \`|\` character in YAML means literal block. In JMESPath inside YAML, put it in quotes: \`key: "{{ items | length(@) }}"\`.

5. **Function not available:** Verify the function exists in Kyverno (not all standard JMESPath functions are available; Kyverno adds its own).`
    },
    {
      title: 'Mutate foreach is not updating all containers',
      difficulty: 'hard',
      symptom: 'The mutate policy with foreach is being applied but only the first container receives the modification. The other containers remain without the mutated field.',
      diagnosis: `\`\`\`bash
# 1. Create Pod with multiple containers and verify
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: multi-container-test
spec:
  containers:
    - name: app1
      image: nginx:1.25.0
    - name: app2
      image: redis:7.0
    - name: app3
      image: postgres:15
EOF

# 2. Check securityContext of each container
kubectl get pod multi-container-test -o jsonpath='{.spec.containers[*].securityContext}'

# 3. Check if patchStrategicMerge is correct
# The (name): selector must use wildcard
kubectl get clusterpolicy <name> -o yaml | grep -A20 "foreach:"
\`\`\``,
      solution: `**Causes and solutions:**

1. **Wrong container selector in patchStrategicMerge:** The patch uses \`- (name): "{{ element.name }}"\` but this may not work if the name field isn't recognized as merge discriminator. Verify the \`(name)\` pair is correct.

2. **patchesJson6902 with fixed index:** If using patchesJson6902 with \`/spec/containers/0/\` it only modifies the first container. For foreach, use patchStrategicMerge with \`(name)\` as discriminator.

3. **Old Kyverno version:** foreach in mutate was improved in recent versions. Check version with \`kubectl get pods -n kyverno -o jsonpath='{.items[0].spec.containers[0].image}'\`.

4. **Incorrect patchStrategicMerge structure:** The structure must be:
\`\`\`yaml
mutate:
  foreach:
    - list: "request.object.spec.containers"
      patchStrategicMerge:
        spec:
          containers:
            - (name): "{{ element.name }}"
              securityContext:
                readOnlyRootFilesystem: true
\`\`\`
The full path \`spec.containers\` MUST be in the patchStrategicMerge, even inside foreach.`
    }
  ]
};
