window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['cluster-architecture/crds-operators'] = {
  theory: `# CRDs and Operators

## Exam Relevance
> CRDs appear in CKA. Expect tasks like creating a CRD, creating a custom resource instance, and understanding what Operators do conceptually. You rarely need to write an Operator from scratch in the exam.

## Custom Resource Definitions (CRDs)

A **CRD** extends the Kubernetes API with new resource types. Once created, custom resources behave like built-in resources — they can be created, listed, updated, and deleted via kubectl.

### Why CRDs?
- Package domain-specific state into Kubernetes objects
- Enable \`kubectl get myapp\` for custom workloads
- Foundation for Operators

### Creating a CRD

\`\`\`yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: crontabs.stable.example.com    # must be <plural>.<group>
spec:
  group: stable.example.com
  versions:
    - name: v1
      served: true        # this version is active
      storage: true       # this version is stored in etcd
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
              properties:
                cronSpec:
                  type: string
                image:
                  type: string
                replicas:
                  type: integer
  scope: Namespaced       # or Cluster
  names:
    plural: crontabs
    singular: crontab
    kind: CronTab
    shortNames:
      - ct
\`\`\`

### Creating a Custom Resource Instance

\`\`\`yaml
apiVersion: stable.example.com/v1
kind: CronTab
metadata:
  name: my-crontab
  namespace: default
spec:
  cronSpec: "* * * * */5"
  image: my-cron-image
  replicas: 3
\`\`\`

### Managing Custom Resources

\`\`\`bash
# List CRDs
kubectl get crds
kubectl get crds | grep example.com

# Describe a CRD (shows schema)
kubectl describe crd crontabs.stable.example.com

# Create/use custom resources
kubectl apply -f crontab.yaml
kubectl get crontabs
kubectl get ct                    # using shortName
kubectl describe crontab my-crontab

# Delete a CRD (also deletes ALL instances!)
kubectl delete crd crontabs.stable.example.com
\`\`\`

## CRD Validation

\`\`\`yaml
spec:
  versions:
    - name: v1
      schema:
        openAPIV3Schema:
          type: object
          required:
            - spec
          properties:
            spec:
              type: object
              required:
                - cronSpec
              properties:
                cronSpec:
                  type: string
                  pattern: '^(\d+|\*)(/\d+)?(\s+(\d+|\*)(/\d+)?){4}$'
                replicas:
                  type: integer
                  minimum: 1
                  maximum: 10
\`\`\`

## Operators

An **Operator** is a custom controller that uses a CRD to manage complex stateful applications. It encodes human operational knowledge into automated software.

### The Operator Pattern
\`\`\`
Custom Resource (desired state)
         ↓
  Operator Controller (watches CR)
         ↓
  Reconciliation Loop:
    - Observe current state
    - Compare with desired state
    - Act to close the gap
\`\`\`

### What Operators Can Do
- **Install** complex applications (databases, message brokers)
- **Configure** based on CR spec
- **Upgrade** applications automatically
- **Backup/Restore** stateful data
- **Scale** based on custom metrics
- **Self-heal** beyond what built-in controllers do

### Well-Known Operators
| Operator | Application |
|----------|-------------|
| Prometheus Operator | Prometheus + Alertmanager |
| cert-manager | TLS certificate management |
| Strimzi | Apache Kafka |
| PostgreSQL Operator | PostgreSQL clusters |
| Velero | Backup and restore |

### Operator Maturity Levels (OperatorHub)
1. **Basic Install** — Automated application provisioning
2. **Seamless Upgrades** — Minor/patch version upgrade support
3. **Full Lifecycle** — App lifecycle, storage lifecycle
4. **Deep Insights** — Metrics, alerts, log processing
5. **Auto Pilot** — Horizontal/vertical scaling, auto config tuning

## Operator SDK

Operators can be built with:
- **Operator SDK** (Go, Ansible, Helm-based)
- **Kubebuilder** (Go framework by sig-apimachinery)
- **KUDO** (declarative operators)
- **Metacontroller** (webhook-based)

### Controller Flow (simplified)

\`\`\`
   Watch CRDs and related resources
              ↓
   Event triggers reconcile loop
              ↓
   Get current resource state
              ↓
   Compare with desired state (spec)
              ↓
   Create/Update/Delete child resources
              ↓
   Update CR status subresource
\`\`\`

## Status Subresource

\`\`\`yaml
# CRD with status subresource
spec:
  versions:
    - name: v1
      subresources:
        status: {}       # enables status subresource
      schema:
        openAPIV3Schema:
          properties:
            status:
              type: object
              properties:
                phase:
                  type: string
                ready:
                  type: boolean
\`\`\`

\`\`\`bash
# Only controllers should update status (via status subresource)
kubectl patch crontab my-crontab --subresource=status \\
  --type=merge -p '{"status":{"phase":"Running"}}'
\`\`\`

## Common Errors

- **"no kind is registered"**: CRD not installed yet; install the CRD before creating instances
- **"spec failed validation"**: Custom resource doesn't match the OpenAPI schema in the CRD
- **"CRD already exists"**: Use kubectl apply (not create) to update a CRD
- **Deleting a CRD deletes all instances**: Be very careful; always backup custom resources first
- **Operator not reconciling**: Check operator Pod logs — RBAC usually prevents the controller from watching CRs

## Killer.sh Style Challenge

Create a CRD named \`websites.apps.example.io\` with \`kind: Website\`, scoped to Namespace, with a spec field \`url\` (string, required) and \`replicas\` (integer, default 1). Then create an instance named \`my-site\` in the \`default\` namespace.
`,
  quiz: [
    {
      question: 'What must the "name" field of a CRD metadata be formatted as?',
      options: [
        '<plural>.<group> — e.g., crontabs.stable.example.com',
        '<kind>.<group> — e.g., CronTab.stable.example.com',
        '<singular>.<version> — e.g., crontab.v1',
        '<group>/<plural> — e.g., stable.example.com/crontabs'
      ],
      correct: 0,
      explanation: 'CRD names must be <plural>.<group>. The plural name is what kubectl uses (kubectl get crontabs), and the group is the API group (e.g., stable.example.com).',
      reference: 'Review "Creating a CRD" section — metadata.name format.'
    },
    {
      question: 'What happens when you delete a CRD?',
      options: [
        'All custom resource instances of that type are also deleted',
        'Only the schema is deleted; existing instances remain',
        'Instances are converted to ConfigMaps automatically',
        'The deletion is blocked until all instances are deleted first'
      ],
      correct: 0,
      explanation: 'Deleting a CRD is a destructive cascading operation — it deletes the CRD definition AND all existing custom resource instances. Always backup first.',
      reference: 'Review "Managing Custom Resources" section and "Common Errors".'
    },
    {
      question: 'What is the Operator pattern in Kubernetes?',
      options: [
        'A custom controller that watches a CRD and reconciles application state using domain knowledge',
        'A built-in Kubernetes mechanism for operator-level (admin) access control',
        'A pattern for running multiple containers with elevated privileges',
        'A scheduling pattern that ensures pods run on specific nodes'
      ],
      correct: 0,
      explanation: 'The Operator pattern combines a CRD (custom resource) with a custom controller that watches it. The controller encodes operational knowledge (install, upgrade, backup, heal) and acts automatically.',
      reference: 'Review "Operators" section — The Operator Pattern.'
    },
    {
      question: 'Which field in the CRD version spec marks which version is stored in etcd?',
      options: [
        'storage: true',
        'served: true',
        'persistent: true',
        'active: true'
      ],
      correct: 0,
      explanation: 'storage: true designates which version is the storage version in etcd. Only one version can have storage: true. served: true means the API server serves that version but doesn\'t necessarily store it.',
      reference: 'Review "Creating a CRD" section — versions spec.'
    },
    {
      question: 'What is the shortNames field in a CRD used for?',
      options: [
        'Defines kubectl aliases (e.g., "ct" for "crontabs")',
        'Defines short display names in kubectl output',
        'Defines abbreviated API group names',
        'Sets maximum name length for custom resource instances'
      ],
      correct: 0,
      explanation: 'shortNames allows using abbreviated names with kubectl. If shortNames: [ct], you can run "kubectl get ct" instead of "kubectl get crontabs".',
      reference: 'Review "Creating a CRD" section — names.shortNames.'
    },
    {
      question: 'What are the two scope options for a CRD?',
      options: [
        'Namespaced and Cluster',
        'Local and Global',
        'Pod and Node',
        'Standard and Custom'
      ],
      correct: 0,
      explanation: 'CRDs can be Namespaced (instances belong to a specific namespace, like Deployments) or Cluster-scoped (instances are cluster-wide, like Nodes or ClusterRoles).',
      reference: 'Review "Creating a CRD" section — spec.scope.'
    },
    {
      question: 'What does the status subresource in a CRD enable?',
      options: [
        'Separate access control for status updates vs spec updates',
        'Automatic status calculation from spec fields',
        'Status persistence to etcd separately from the main object',
        'Prometheus metrics export for the custom resource'
      ],
      correct: 0,
      explanation: 'The status subresource (subresources: status: {}) separates the spec and status fields. Only the controller should update status. Users updating the CR won\'t accidentally overwrite status, and vice versa.',
      reference: 'Review "Status Subresource" section.'
    },
    {
      question: 'Which of these tools can be used to build a Kubernetes Operator?',
      options: [
        'Operator SDK, Kubebuilder, KUDO',
        'Helm, Kustomize, kubectl',
        'kubeadm, kubelet, kube-proxy',
        'Prometheus, Grafana, Loki'
      ],
      correct: 0,
      explanation: 'Operator SDK (supports Go, Ansible, Helm-based operators), Kubebuilder (Go framework by sig-apimachinery), and KUDO (declarative operators) are all frameworks for building Kubernetes Operators.',
      reference: 'Review "Operator SDK" section.'
    }
  ],
  flashcards: [
    {
      front: 'What is a CRD (Custom Resource Definition)?',
      back: 'An extension of the Kubernetes API that registers a new resource type. Once created, you can create, list, update, and delete custom resources of that type using kubectl, just like built-in resources.'
    },
    {
      front: 'What is the naming convention for CRD metadata.name?',
      back: '<plural>.<group> — e.g., "crontabs.stable.example.com". The plural is used in kubectl commands; the group is the API group.'
    },
    {
      front: 'What are the two "served" vs "storage" flags in CRD versions?',
      back: 'served: true means the API server serves requests for that version. storage: true means that version is stored in etcd. Multiple versions can be served but only one can be the storage version.'
    },
    {
      front: 'What is an Operator in Kubernetes?',
      back: 'A custom controller that watches a CRD and reconciles the cluster state to match the desired state in the custom resource. It encodes application-specific operational knowledge (install, upgrade, backup, heal).'
    },
    {
      front: 'What command lists all installed CRDs?',
      back: 'kubectl get crds — lists all CustomResourceDefinitions. kubectl get crds | grep <group> to filter by API group.'
    },
    {
      front: 'What happens when you delete a CRD?',
      back: 'All instances (custom resources) of that type are also deleted. This is a cascading deletion. Always backup custom resources before deleting a CRD.'
    },
    {
      front: 'What is the difference between Namespaced and Cluster scope for CRDs?',
      back: 'Namespaced: instances belong to a namespace (like Deployments). Cluster: instances are cluster-wide (like Nodes or ClusterRoles). Set with spec.scope in the CRD.'
    }
  ],
  lab: {
    scenario: 'Your team wants to extend Kubernetes to manage website configurations. You\'ll create a CRD for websites, validate it, create instances, and explore how Operators interact with custom resources.',
    objective: 'Understand CRD creation, validation, and custom resource lifecycle management.',
    duration: '15-20 minutes',
    steps: [
      {
        title: 'Create a CRD with schema validation',
        instruction: `Create a CRD named \`websites.apps.lab.io\` with kind \`Website\`, Namespaced scope. The spec should have a required field \`url\` (string) and an optional \`replicas\` (integer, min 1, max 10).`,
        hints: [
          'CRD name format: <plural>.<group>',
          'Use apiextensions.k8s.io/v1 apiVersion',
          'Add openAPIV3Schema with required: [url] under spec'
        ],
        solution: `\`\`\`bash
cat <<EOF | kubectl apply -f -
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: websites.apps.lab.io
spec:
  group: apps.lab.io
  versions:
    - name: v1
      served: true
      storage: true
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
              required:
                - url
              properties:
                url:
                  type: string
                replicas:
                  type: integer
                  minimum: 1
                  maximum: 10
  scope: Namespaced
  names:
    plural: websites
    singular: website
    kind: Website
    shortNames:
      - ws
EOF
\`\`\``,
        verify: `\`\`\`bash
kubectl get crds websites.apps.lab.io
# Expected: NAME                    CREATED AT
#           websites.apps.lab.io   ...

kubectl describe crd websites.apps.lab.io | grep -A5 "Stored Versions"
# Expected: v1

# Test short name works
kubectl get ws --all-namespaces
# Expected: No resources found (no error = CRD is installed correctly)
\`\`\``
      },
      {
        title: 'Create and manage custom resource instances',
        instruction: `Create a Website instance named \`company-site\` in namespace \`default\` with url \`https://company.com\` and 3 replicas. Then try to create one with invalid data (replicas: 15) to test validation.`,
        hints: [
          'Use apiVersion: apps.lab.io/v1 and kind: Website',
          'The invalid replicas (15 > max 10) should fail with a validation error',
          'Use kubectl get ws to list websites'
        ],
        solution: `\`\`\`bash
# Create valid website
cat <<EOF | kubectl apply -f -
apiVersion: apps.lab.io/v1
kind: Website
metadata:
  name: company-site
  namespace: default
spec:
  url: "https://company.com"
  replicas: 3
EOF

# Attempt invalid website (should fail)
cat <<EOF | kubectl apply -f - || echo "Validation error (expected)"
apiVersion: apps.lab.io/v1
kind: Website
metadata:
  name: bad-site
  namespace: default
spec:
  url: "https://bad.com"
  replicas: 15
EOF
\`\`\``,
        verify: `\`\`\`bash
kubectl get websites
# Expected: NAME           AGE
#           company-site   ...

kubectl describe website company-site
# Expected: shows spec.url and spec.replicas

# The invalid one should NOT exist
kubectl get website bad-site 2>&1
# Expected: Error from server (NotFound): ...
\`\`\``
      },
      {
        title: 'Explore CRD in the API and clean up',
        instruction: `Use \`kubectl api-resources\` to verify the Website CRD is registered. Then use \`kubectl explain\` to see the schema. Finally, delete the \`company-site\` website and the CRD itself, observing that deleting the CRD removes instances.`,
        hints: [
          'kubectl api-resources --api-group=apps.lab.io',
          'kubectl explain website.spec',
          'Delete instance first, then observe what happens when you delete the CRD with the instance present'
        ],
        solution: `\`\`\`bash
# Verify CRD is in API
kubectl api-resources --api-group=apps.lab.io

# Explore schema
kubectl explain website
kubectl explain website.spec

# First check: CRD with instance
kubectl get websites
# Shows company-site

# Delete the CRD (this will also delete company-site!)
kubectl delete crd websites.apps.lab.io
\`\`\``,
        verify: `\`\`\`bash
kubectl api-resources --api-group=apps.lab.io
# Expected: empty output (CRD is gone)

kubectl get websites 2>&1
# Expected: error: the server doesn't have a resource type "websites"

kubectl get website company-site 2>&1
# Expected: error (instance was deleted with the CRD)
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Custom resource creation fails with validation error',
      difficulty: 'easy',
      symptom: 'kubectl apply returns: "spec.replicas: Invalid value: 0: spec.replicas in body should be greater than or equal to 1"',
      diagnosis: `\`\`\`bash
# Check the CRD schema
kubectl describe crd <crd-name> | grep -A 20 "Validation"

# Or get the full CRD spec
kubectl get crd <crd-name> -o yaml | grep -A 30 openAPIV3Schema

# Check what you're trying to create
kubectl apply -f myresource.yaml --dry-run=server
\`\`\``,
      solution: `The value you're providing doesn't satisfy the schema constraints. Review the CRD spec for the allowed range/type:

\`\`\`bash
kubectl explain <resource>.spec
\`\`\`

Correct the resource manifest to use a valid value:
\`\`\`yaml
spec:
  replicas: 1   # must be >= 1 per schema
\`\`\`

If the schema itself needs updating, patch the CRD:
\`\`\`bash
kubectl patch crd <name> --type=merge -p '{"spec":{"versions":[{"name":"v1","served":true,"storage":true,"schema":{"openAPIV3Schema":{"type":"object","properties":{"spec":{"type":"object","properties":{"replicas":{"type":"integer","minimum":0}}}}}}}]}}'
\`\`\``
    },
    {
      title: 'Operator not reconciling custom resources',
      difficulty: 'hard',
      symptom: 'Created a custom resource but nothing happens — the operator doesn\'t seem to be responding. The CR has been in the same state for several minutes.',
      diagnosis: `\`\`\`bash
# Check if operator pod is running
kubectl get pods -n <operator-namespace>

# Check operator logs
kubectl logs -n <operator-namespace> deployment/<operator-name> --tail=50

# Check RBAC — operator needs permission to watch the CRD
kubectl get clusterrole <operator-role> -o yaml | grep -A5 "resources:"

# Check if the operator is watching the right namespace
kubectl get deployment -n <operator-namespace> -o yaml | grep -A5 "WATCH_NAMESPACE"

# Check events on the custom resource
kubectl describe <resource> <name> -n <namespace>
\`\`\``,
      solution: `Most common causes:

1. **RBAC permission missing** — Operator cannot get/list/watch the CRD:
\`\`\`bash
kubectl auth can-i get websites --as=system:serviceaccount:<ns>:<sa>
# If no: add the permission to the ClusterRole
\`\`\`

2. **Operator is only watching specific namespace** — Check WATCH_NAMESPACE env var in operator Deployment.

3. **Operator crashed** — Check logs for panic/error:
\`\`\`bash
kubectl logs -n <ns> deployment/<operator> --previous
\`\`\`

4. **CRD version mismatch** — Operator was built for v1alpha1 but CRD only serves v1:
\`\`\`bash
kubectl get crd <name> -o jsonpath='{.spec.versions[*].name}'
# Compare with operator code/Helm chart version
\`\`\``
    }
  ]
};
