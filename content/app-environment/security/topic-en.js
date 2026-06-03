window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['app-environment/security'] = {
  theory: `# Security Contexts & ServiceAccounts

## Exam Relevance
> Security is heavily tested in both CKAD (~25% environment, configuration and security domain) and CKA. You must know how to configure security contexts for pods and containers, create and bind ServiceAccounts, disable automounting of SA tokens, and understand what each security setting controls.

## Security Context — Overview

A SecurityContext defines privilege and access control settings for a Pod or Container.

**Two levels:**
- **Pod-level** (\`spec.securityContext\`) — applies to all containers
- **Container-level** (\`spec.containers[].securityContext\`) — overrides pod-level for that container

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: secure-pod
spec:
  securityContext:             # Pod-level
    runAsUser: 1000            # All containers run as UID 1000
    runAsGroup: 3000           # Primary GID 3000
    fsGroup: 2000              # Volume ownership GID 2000
    runAsNonRoot: true         # Reject containers that run as root
  containers:
  - name: app
    image: myapp:1.0
    securityContext:           # Container-level (overrides pod-level)
      allowPrivilegeEscalation: false  # Cannot gain more privileges
      readOnlyRootFilesystem: true     # Root FS is read-only
      capabilities:
        drop:
        - ALL                  # Drop all Linux capabilities
        add:
        - NET_BIND_SERVICE     # Re-add only what's needed
\`\`\`

## Key SecurityContext Fields

### runAsUser / runAsGroup

\`\`\`yaml
securityContext:
  runAsUser: 1000     # Container process runs as UID 1000
  runAsGroup: 3000    # Container process runs as GID 3000
\`\`\`

\`\`\`bash
# Verify inside the container
kubectl exec <pod> -- id
# Expected: uid=1000 gid=3000 groups=3000
\`\`\`

### runAsNonRoot

\`\`\`yaml
securityContext:
  runAsNonRoot: true
\`\`\`

If the container image is configured to run as root (UID 0), the container will fail to start with: **"container has runAsNonRoot and image will run as root"**.

### fsGroup

\`\`\`yaml
spec:
  securityContext:
    fsGroup: 2000    # All mounted volumes owned by GID 2000
\`\`\`

Useful when the container user needs write access to a volume that was created by root.

### allowPrivilegeEscalation

\`\`\`yaml
securityContext:
  allowPrivilegeEscalation: false  # Cannot use setuid/setgid or gain capabilities
\`\`\`

Prevents processes from gaining more privileges than the parent (e.g., via sudo, setuid binary).

### readOnlyRootFilesystem

\`\`\`yaml
securityContext:
  readOnlyRootFilesystem: true  # Container's root FS is read-only
\`\`\`

Best practice for security: forces the app to only write to explicitly mounted volumes.

### Linux Capabilities

\`\`\`yaml
securityContext:
  capabilities:
    drop:
    - ALL                    # Drop all capabilities first
    add:
    - NET_BIND_SERVICE       # Allow binding to ports < 1024
    - SYS_TIME               # Allow setting system time
\`\`\`

Common capabilities:
| Capability | Allows |
|-----------|--------|
| \`NET_ADMIN\` | Network configuration |
| \`NET_BIND_SERVICE\` | Bind to privileged ports (<1024) |
| \`SYS_PTRACE\` | Process tracing (debugging) |
| \`SYS_ADMIN\` | Many system operations (avoid!) |
| \`CHOWN\` | Change file ownership |

## Privileged Containers

\`\`\`yaml
securityContext:
  privileged: true    # Container has full host root access (avoid!)
\`\`\`

⚠️ Privileged containers bypass all security controls. Only for system-level pods (node agents, CSI drivers). Never for application workloads.

## Pod Security Standards (PSS)

Three built-in policies enforced by **Pod Security Admission** (replaced PodSecurityPolicy):

| Level | Description |
|-------|------------|
| \`privileged\` | No restrictions |
| \`baseline\` | Prevents known privilege escalations |
| \`restricted\` | Hardened — requires non-root, drops all caps, etc. |

Applied via namespace labels:
\`\`\`bash
kubectl label namespace production \
  pod-security.kubernetes.io/enforce=restricted \
  pod-security.kubernetes.io/warn=restricted
\`\`\`

## ServiceAccounts

A ServiceAccount provides an identity for processes running in pods to authenticate with the Kubernetes API.

\`\`\`bash
# Create a ServiceAccount
kubectl create serviceaccount app-sa

# Bind to a Role (namespace-scoped)
kubectl create rolebinding app-binding \
  --clusterrole=view \
  --serviceaccount=default:app-sa \
  --namespace=default

# Assign SA to a Pod
# (in pod spec: serviceAccountName: app-sa)
\`\`\`

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: api-client
spec:
  serviceAccountName: app-sa    # Use specific SA (default: "default")
  automountServiceAccountToken: false  # Disable token mount (security best practice)
  containers:
  - name: app
    image: myapp:1.0
\`\`\`

## SA Token Automounting

By default, Kubernetes mounts the SA token at \`/var/run/secrets/kubernetes.io/serviceaccount/token\`. This allows the pod to authenticate with the API server.

\`\`\`bash
# Check if token is mounted
kubectl exec <pod> -- ls /var/run/secrets/kubernetes.io/serviceaccount/
# Files: token, ca.crt, namespace

# Call the API using the mounted token
kubectl exec <pod> -- sh -c \
  "TOKEN=\$(cat /var/run/secrets/kubernetes.io/serviceaccount/token); \
   curl -s -H 'Authorization: Bearer \$TOKEN' \
   https://kubernetes.default.svc/api/v1/namespaces/default/pods \
   --cacert /var/run/secrets/kubernetes.io/serviceaccount/ca.crt"
\`\`\`

**Disable automounting** for pods that don't need API access:
\`\`\`yaml
# Option 1: On the ServiceAccount (affects all pods using it)
apiVersion: v1
kind: ServiceAccount
metadata:
  name: no-api-sa
automountServiceAccountToken: false

# Option 2: On the Pod (overrides SA setting)
spec:
  automountServiceAccountToken: false
\`\`\`

## Common Errors

1. **Container won't start with runAsNonRoot** — image runs as UID 0; either fix the image or remove runAsNonRoot
2. **Permission denied on volume** — container UID doesn't match volume ownership; use fsGroup
3. **Operation not permitted** — capability not available; add the required capability
4. **App can't write to filesystem** — readOnlyRootFilesystem=true without a writable volume mount
5. **SA token still mounted after automountServiceAccountToken: false** — must also set false on the Pod (if SA setting alone is used)

## Killer.sh Style Challenge

**Task**: Create a pod named \`secure-app\` with these security constraints:
1. Runs as user 1000, group 3000
2. Cannot run as root (\`runAsNonRoot: true\`)
3. Root filesystem is read-only
4. All capabilities dropped, only NET_BIND_SERVICE added
5. Uses ServiceAccount \`restricted-sa\` with automounting disabled
6. A volume mounted at \`/tmp/writable\` for write operations
`,
  quiz: [
    {
      question: 'What is the difference between pod-level and container-level securityContext?',
      options: [
        'Pod-level applies only to init containers; container-level applies to regular containers',
        'Pod-level settings apply to all containers; container-level settings override pod-level for that specific container',
        'They are identical — container-level is just an alias for pod-level',
        'Pod-level controls network security; container-level controls filesystem security'
      ],
      correct: 1,
      explanation: 'Pod-level securityContext (spec.securityContext) provides defaults for all containers. Container-level securityContext (spec.containers[].securityContext) overrides those defaults for the specific container.',
      reference: 'Security Context — Overview section in theory. Two levels: pod-level and container-level.'
    },
    {
      question: 'A pod with runAsNonRoot: true fails to start. What is the most likely cause?',
      options: [
        'The pod does not have a ServiceAccount',
        'The container image is configured to run as root (UID 0)',
        'The node does not support non-root containers',
        'The namespace has a restrictive NetworkPolicy'
      ],
      correct: 1,
      explanation: 'runAsNonRoot: true causes Kubernetes to reject pods where the container image is configured to run as UID 0. The container fails with: "container has runAsNonRoot and image will run as root".',
      reference: 'runAsNonRoot section in theory — failure message and cause.'
    },
    {
      question: 'What does fsGroup do in a pod securityContext?',
      options: [
        'Sets the filesystem group for the container\'s root filesystem',
        'Sets the GID that owns all mounted volumes, allowing the container user to write to them',
        'Restricts which group IDs can access the pod',
        'Creates a new filesystem group during pod initialization'
      ],
      correct: 1,
      explanation: 'fsGroup sets the GID that owns all mounted volumes. When set, Kubernetes chowns the volume directories to this GID and sets the setgid bit. This allows containers running with a non-root UID to write to volumes that may have been created by root.',
      reference: 'fsGroup section in theory.'
    },
    {
      question: 'How do you prevent a container from gaining more privileges than its parent process?',
      options: [
        'Set runAsNonRoot: true',
        'Set allowPrivilegeEscalation: false',
        'Set privileged: false',
        'Drop all capabilities'
      ],
      correct: 1,
      explanation: 'allowPrivilegeEscalation: false prevents the container process from gaining more privileges via setuid binaries, sudo, or capability-granting mechanisms. It is the specific control for privilege escalation.',
      reference: 'allowPrivilegeEscalation section in theory.'
    },
    {
      question: 'Where is the ServiceAccount token automatically mounted in a pod?',
      options: [
        '/etc/kubernetes/serviceaccount/',
        '/var/run/secrets/kubernetes.io/serviceaccount/',
        '/etc/ssl/kubernetes/',
        '/secrets/serviceaccount/'
      ],
      correct: 1,
      explanation: 'The SA token is automatically mounted at /var/run/secrets/kubernetes.io/serviceaccount/ and contains three files: token (JWT), ca.crt (CA certificate), and namespace (current namespace name).',
      reference: 'SA Token Automounting section in theory.'
    },
    {
      question: 'What happens when you set automountServiceAccountToken: false on a ServiceAccount?',
      options: [
        'The ServiceAccount is deleted',
        'Pods using this SA will not have the token mounted by default (can be overridden per pod)',
        'RBAC is automatically disabled for pods using this SA',
        'The SA token expires immediately'
      ],
      correct: 1,
      explanation: 'Setting automountServiceAccountToken: false on a ServiceAccount prevents the token from being automatically mounted in all pods using that SA. However, individual pods can override this by setting automountServiceAccountToken: true in their spec.',
      reference: 'SA Token Automounting section in theory.'
    },
    {
      question: 'A container with readOnlyRootFilesystem: true needs to write temporary files. What is the correct solution?',
      options: [
        'Set readOnlyRootFilesystem: false temporarily',
        'Mount an emptyDir or other writable volume at the directory the app writes to',
        'Use hostPath to write to the node filesystem instead',
        'Enable privileged mode to bypass the restriction'
      ],
      correct: 1,
      explanation: 'readOnlyRootFilesystem makes the container image filesystem read-only. For writable directories, mount a writable volume (emptyDir, PVC) at the specific path. Common paths: /tmp (scratch), /var/log (logs), /app/data (app data).',
      reference: 'readOnlyRootFilesystem section in theory and Killer.sh challenge.'
    },
    {
      question: 'What are the three Pod Security Standards (PSS) levels?',
      options: [
        'basic, standard, advanced',
        'minimal, moderate, maximum',
        'privileged, baseline, restricted',
        'permissive, limited, locked'
      ],
      correct: 2,
      explanation: 'The three Pod Security Standards are: privileged (no restrictions), baseline (prevents known privilege escalations like hostPath, privileged containers), and restricted (hardened — requires non-root, drops capabilities, no hostPath, etc.).',
      reference: 'Pod Security Standards section in theory.'
    }
  ],
  flashcards: [
    {
      front: 'What are the 5 most important securityContext fields for the exam?',
      back: '1. runAsUser: 1000 — container runs as UID 1000\n2. runAsNonRoot: true — reject root containers\n3. allowPrivilegeEscalation: false — no sudo/setuid\n4. readOnlyRootFilesystem: true — immutable root FS\n5. capabilities.drop: [ALL] + add: [NET_BIND_SERVICE] — minimal capabilities\n\nAlso: fsGroup (volume ownership), privileged: true (avoid!)'
    },
    {
      front: 'What is the difference between pod-level and container-level securityContext?',
      back: 'spec.securityContext (pod-level): applies to ALL containers\n- runAsUser, runAsGroup, fsGroup, runAsNonRoot, supplementalGroups\n\nspec.containers[].securityContext (container-level): overrides for ONE container\n- allowPrivilegeEscalation, readOnlyRootFilesystem, capabilities, privileged, runAsUser\n\nContainer-level overrides pod-level for the same field.'
    },
    {
      front: 'What does fsGroup do?',
      back: 'Sets the GID that owns all mounted volumes.\n\nKubernetes chowns volume directories to this GID during pod initialization. Allows containers running as non-root UID to write to volumes.\n\nExample: runAsUser: 1000, fsGroup: 2000\n→ container process is UID 1000\n→ mounted volumes are owned by GID 2000\n→ container can write if its UID is in GID 2000'
    },
    {
      front: 'How do you disable the automatic SA token mount for a pod?',
      back: 'Two ways:\n\n1. On the ServiceAccount:\napiVersion: v1\nkind: ServiceAccount\nmetadata:\n  name: my-sa\nautomountServiceAccountToken: false\n\n2. On the Pod (overrides SA setting):\nspec:\n  automountServiceAccountToken: false\n\nBest practice: disable for pods that don\'t need API access.'
    },
    {
      front: 'What are the 3 Pod Security Standards (PSS)?',
      back: 'privileged: No restrictions. Used for system/infrastructure pods.\n\nbaseline: Minimal restrictions. Prevents known privilege escalations. Allows most workloads.\n\nrestricted: Strongly hardened. Requires: non-root, no privilege escalation, drop all caps, no hostPath, seccomp profile.\n\nApplied via namespace labels:\nkubectl label ns mynamespace pod-security.kubernetes.io/enforce=restricted'
    },
    {
      front: 'What happens when you set readOnlyRootFilesystem: true?',
      back: 'The container image filesystem is mounted read-only. Any write to the filesystem (outside of mounted volumes) fails with "Read-only file system".\n\nFix for apps needing to write:\n- Mount emptyDir at /tmp for temporary files\n- Mount PVC at /data for persistent files\n- Mount emptyDir at /var/log for logging\n\nBest security practice: forces explicit declaration of write paths.'
    },
    {
      front: 'What Linux capabilities should you know for the exam?',
      back: 'NET_BIND_SERVICE — bind to ports < 1024 (e.g., port 80 without root)\nNET_ADMIN — network interface configuration\nSYS_PTRACE — process tracing (debugging tools)\nCHOWN — change file ownership\nSYS_ADMIN — broad system administration (avoid!)\n\nBest practice:\ncapabilities:\n  drop: [ALL]           # Drop everything first\n  add: [NET_BIND_SERVICE]  # Only add what\'s needed'
    },
    {
      front: 'How do you verify that a container is running as a specific user?',
      back: 'kubectl exec <pod> -- id\n# Expected: uid=1000(user) gid=3000(group)\n\nkubectl exec <pod> -- whoami\n# Shows username if /etc/passwd has it\n\nkubectl exec <pod> -- ps aux\n# Shows user for each process\n\nCompare with security context:\nkubectl get pod <name> -o yaml | grep -A5 securityContext'
    }
  ],
  lab: {
    scenario: 'Your security team requires that all application pods follow the principle of least privilege. You need to configure proper security contexts and ServiceAccounts.',
    objective: 'Practice configuring securityContext at pod and container level, creating ServiceAccounts with appropriate RBAC, and disabling unnecessary API access.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Configure Pod and Container Security Context',
        instruction: `Create a pod named \`secure-app\` with the following security constraints:
- Pod runs as user 1000, group 3000
- runAsNonRoot: true (at pod level)
- Container-level: allowPrivilegeEscalation: false, readOnlyRootFilesystem: true
- Drop ALL capabilities, add only NET_BIND_SERVICE
- Mount an emptyDir at /tmp for temporary writes

After creating, verify the security settings are active.`,
        hints: [
          'Pod-level: spec.securityContext.runAsUser, runAsGroup, runAsNonRoot',
          'Container-level: spec.containers[].securityContext.allowPrivilegeEscalation, readOnlyRootFilesystem, capabilities',
          'emptyDir volume at /tmp allows writing even with readOnlyRootFilesystem',
          'Verify: kubectl exec secure-app -- id && kubectl exec secure-app -- touch /tmp/test'
        ],
        solution: `\`\`\`bash
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: secure-app
spec:
  securityContext:
    runAsUser: 1000
    runAsGroup: 3000
    runAsNonRoot: true
    fsGroup: 2000
  containers:
  - name: app
    image: nginx:1.25
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop:
        - ALL
        add:
        - NET_BIND_SERVICE
    volumeMounts:
    - name: tmp-vol
      mountPath: /tmp
    - name: run-vol
      mountPath: /var/run
    - name: cache-vol
      mountPath: /var/cache/nginx
  volumes:
  - name: tmp-vol
    emptyDir: {}
  - name: run-vol
    emptyDir: {}
  - name: cache-vol
    emptyDir: {}
EOF

kubectl get pod secure-app -w
\`\`\``,
        verify: `\`\`\`bash
# Pod should be Running
kubectl get pod secure-app
# Expected: STATUS = Running (note: nginx may fail if it can't write to required paths — use extra emptyDirs)

# Verify user
kubectl exec secure-app -- id
# Expected: uid=1000 gid=3000 groups=3000,2000

# Verify read-only root FS (writing outside volumes fails)
kubectl exec secure-app -- touch /test-file 2>&1
# Expected: "Read-only file system" or "Permission denied"

# Verify writable volume works
kubectl exec secure-app -- touch /tmp/test-file
kubectl exec secure-app -- ls /tmp/test-file
# Expected: /tmp/test-file exists
\`\`\``
      },
      {
        title: 'Create ServiceAccount with RBAC and Assign to Pod',
        instruction: `Create a ServiceAccount that has permission to list pods, and a pod that uses it:

1. Create ServiceAccount \`pod-reader-sa\` in the \`default\` namespace
2. Create a ClusterRole \`pod-reader\` that allows get, list, watch on pods
3. Create a RoleBinding \`pod-reader-binding\` to bind the role to the SA
4. Create a pod \`api-client\` using \`pod-reader-sa\`
5. From inside the pod, call the Kubernetes API to list pods`,
        hints: [
          'kubectl create serviceaccount pod-reader-sa',
          'kubectl create clusterrole pod-reader --verb=get,list,watch --resource=pods',
          'kubectl create rolebinding pod-reader-binding --clusterrole=pod-reader --serviceaccount=default:pod-reader-sa',
          'Token is at /var/run/secrets/kubernetes.io/serviceaccount/token'
        ],
        solution: `\`\`\`bash
# Create ServiceAccount
kubectl create serviceaccount pod-reader-sa

# Create ClusterRole
kubectl create clusterrole pod-reader \
  --verb=get,list,watch \
  --resource=pods

# Bind role to SA in default namespace
kubectl create rolebinding pod-reader-binding \
  --clusterrole=pod-reader \
  --serviceaccount=default:pod-reader-sa \
  --namespace=default

# Create pod using the SA
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: api-client
spec:
  serviceAccountName: pod-reader-sa
  containers:
  - name: app
    image: curlimages/curl:8.4.0
    command: ["sleep", "3600"]
EOF

kubectl get pod api-client -w

# Test API access from inside the pod
kubectl exec api-client -- sh -c \
  'TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token); \
   curl -s -H "Authorization: Bearer $TOKEN" \
   https://kubernetes.default.svc/api/v1/namespaces/default/pods \
   --cacert /var/run/secrets/kubernetes.io/serviceaccount/ca.crt | \
   head -20'
\`\`\``,
        verify: `\`\`\`bash
# SA should exist
kubectl get serviceaccount pod-reader-sa
# Expected: pod-reader-sa exists

# Role binding should exist
kubectl get rolebinding pod-reader-binding
# Expected: pod-reader-binding references pod-reader-sa

# From inside the pod, API call should return pod list (not 403)
kubectl exec api-client -- sh -c \
  'TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token); \
   curl -s -o /dev/null -w "%{http_code}" \
   -H "Authorization: Bearer $TOKEN" \
   https://kubernetes.default.svc/api/v1/namespaces/default/pods \
   --cacert /var/run/secrets/kubernetes.io/serviceaccount/ca.crt'
# Expected: 200

# Verify token IS mounted (automounting not disabled)
kubectl exec api-client -- ls /var/run/secrets/kubernetes.io/serviceaccount/
# Expected: ca.crt  namespace  token
\`\`\``
      },
      {
        title: 'Disable SA Token Automounting',
        instruction: `Practice disabling automatic SA token mounting for pods that don't need API access:

1. Create ServiceAccount \`no-api-sa\` with \`automountServiceAccountToken: false\`
2. Create a pod \`no-api-pod\` using \`no-api-sa\`
3. Verify the token is NOT mounted in the pod
4. Create another pod with the same SA but \`automountServiceAccountToken: true\` on the pod itself to override
5. Verify the second pod DOES have the token`,
        hints: [
          'SA YAML: automountServiceAccountToken: false',
          'Verify no token: kubectl exec no-api-pod -- ls /var/run/secrets 2>&1',
          'Pod-level override: spec.automountServiceAccountToken: true',
          'The pod-level setting overrides the SA-level setting'
        ],
        solution: `\`\`\`bash
# Create SA with automounting disabled
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ServiceAccount
metadata:
  name: no-api-sa
automountServiceAccountToken: false
EOF

# Create pod using this SA (token should NOT be mounted)
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: no-api-pod
spec:
  serviceAccountName: no-api-sa
  containers:
  - name: app
    image: busybox:1.36
    command: ["sleep", "3600"]
EOF

kubectl get pod no-api-pod -w

# Verify token is NOT mounted
kubectl exec no-api-pod -- ls /var/run/secrets/ 2>&1
# Should show empty or "No such file or directory"

# Create another pod that overrides SA setting
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: override-pod
spec:
  serviceAccountName: no-api-sa
  automountServiceAccountToken: true  # Override SA setting
  containers:
  - name: app
    image: busybox:1.36
    command: ["sleep", "3600"]
EOF

kubectl get pod override-pod -w

# Verify token IS mounted in override pod
kubectl exec override-pod -- ls /var/run/secrets/kubernetes.io/serviceaccount/
\`\`\``,
        verify: `\`\`\`bash
# no-api-pod should NOT have SA token mounted
kubectl exec no-api-pod -- ls /var/run/secrets/kubernetes.io/serviceaccount/ 2>&1
# Expected: "No such file or directory" or empty

# override-pod SHOULD have token mounted
kubectl exec override-pod -- ls /var/run/secrets/kubernetes.io/serviceaccount/
# Expected: ca.crt  namespace  token

# Verify both pods are Running
kubectl get pod no-api-pod override-pod
# Expected: both STATUS = Running
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Container Fails to Start — "container has runAsNonRoot"',
      difficulty: 'easy',
      symptom: 'A pod stays in "CreateContainerConfigError" state. kubectl describe shows: "Error: container has runAsNonRoot and image will run as root (pod: ... container: ...)"',
      diagnosis: `\`\`\`bash
# Check pod status
kubectl get pod <pod-name>
# STATUS: CreateContainerConfigError

# Check error details
kubectl describe pod <pod-name> | grep -A5 "Events:"
# Shows: container has runAsNonRoot and image will run as root

# Check security context
kubectl get pod <pod-name> -o yaml | grep -A10 securityContext

# Check what user the image runs as
# Build/inspect: docker inspect <image> | grep User
# OR check Dockerfile: USER directive
\`\`\``,
      solution: `**Cause: Image configured to run as root, but pod requires non-root**

Option A: Add runAsUser to override the image default
\`\`\`bash
kubectl patch pod <pod-name> --type='json' \
  -p='[{"op":"add","path":"/spec/containers/0/securityContext/runAsUser","value":1000}]'
# Note: pods are immutable — delete and recreate with updated spec
kubectl delete pod <pod-name>
# Update the YAML to add securityContext.runAsUser: 1000
kubectl apply -f fixed-pod.yaml
\`\`\`

Option B: Remove runAsNonRoot (if it's acceptable for this container)
\`\`\`yaml
# Remove or set to false:
securityContext:
  runAsNonRoot: false  # OR just remove the line
\`\`\`

Option C: Fix the container image to use a non-root user (long-term fix)
\`\`\`dockerfile
# In Dockerfile
RUN adduser --disabled-password --uid 1000 appuser
USER appuser
\`\`\``
    },
    {
      title: 'Pod Gets 403 Forbidden When Calling Kubernetes API',
      difficulty: 'medium',
      symptom: 'A pod is trying to call the Kubernetes API (e.g., list ConfigMaps) and receives HTTP 403 Forbidden. The pod has a ServiceAccount but the API call fails.',
      diagnosis: `\`\`\`bash
# Check which SA the pod uses
kubectl get pod <pod-name> -o jsonpath='{.spec.serviceAccountName}'

# Check if the SA has any role bindings
kubectl get rolebinding,clusterrolebinding -A \
  -o custom-columns="NAME:.metadata.name,SA:.subjects[*].name" | \
  grep <sa-name>

# Test from inside the pod
kubectl exec <pod-name> -- sh -c \
  'TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token); \
   curl -s -H "Authorization: Bearer $TOKEN" \
   https://kubernetes.default.svc/api/v1/namespaces/default/configmaps \
   --cacert /var/run/secrets/kubernetes.io/serviceaccount/ca.crt'
# Shows: 403 Forbidden message

# Verify using kubectl auth
kubectl auth can-i list configmaps \
  --as=system:serviceaccount:default:<sa-name>
\`\`\``,
      solution: `**Cause: ServiceAccount has no RBAC permission for the requested resource**

\`\`\`bash
# Create a Role with the needed permissions
kubectl create role configmap-reader \
  --verb=get,list,watch \
  --resource=configmaps \
  --namespace=default

# Bind the role to the ServiceAccount
kubectl create rolebinding configmap-reader-binding \
  --role=configmap-reader \
  --serviceaccount=default:<sa-name> \
  --namespace=default

# Verify
kubectl auth can-i list configmaps \
  --as=system:serviceaccount:default:<sa-name>
# Expected: yes

# Test from pod again
kubectl exec <pod-name> -- sh -c \
  'TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token); \
   curl -s -H "Authorization: Bearer $TOKEN" \
   https://kubernetes.default.svc/api/v1/namespaces/default/configmaps \
   --cacert /var/run/secrets/kubernetes.io/serviceaccount/ca.crt | \
   head -5'
# Expected: 200 with configmap list JSON
\`\`\``
    }
  ]
};
