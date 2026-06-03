window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['cks-microservice-vuln/pod-security-standards'] = {
  theory: `# Pod Security Standards (Deep Dive)

## Exam Relevance
> PSS is a major CKS topic. Expect to configure PSA labels, write securityContext, understand what Baseline vs Restricted blocks, and fix pods that violate policies. ~15% of CKS Minimize Microservice Vulnerabilities domain.

## Pod Security Admission (PSA)

**Pod Security Admission** is the built-in Kubernetes mechanism (since 1.23 stable) that enforces **Pod Security Standards (PSS)** at the namespace level.

### PSS Levels

| Level | Description | Restrictions |
|-------|-------------|--------------|
| **Privileged** | No restrictions | Everything allowed |
| **Baseline** | Minimum restrictions | Prevents known privilege escalations |
| **Restricted** | Heavily restricted | Hardened best practices |

### Namespace Labels

Apply PSS by labeling namespaces:

\`\`\`yaml
# Three modes for each level:
# enforce: reject violating pods
# audit: allow but log violations
# warn: allow but warn via API response

apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    # Enforce Restricted — reject non-compliant pods
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/enforce-version: latest

    # Audit mode (for gradual rollout)
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/audit-version: latest

    # Warn mode (shows warnings to kubectl user)
    pod-security.kubernetes.io/warn: restricted
    pod-security.kubernetes.io/warn-version: latest
\`\`\`

\`\`\`bash
# Quick label commands
kubectl label namespace production \
  pod-security.kubernetes.io/enforce=restricted

kubectl label namespace staging \
  pod-security.kubernetes.io/enforce=baseline \
  pod-security.kubernetes.io/warn=restricted

# Check labels
kubectl get namespace production -o yaml | grep pod-security
\`\`\`

## Baseline Level — What it Blocks

Baseline prevents known privilege escalations:

| Control | What is blocked |
|---------|----------------|
| hostProcess | spec.hostProcess must be false or unset |
| Host namespaces | spec.hostPID, spec.hostIPC must be false |
| Privileged containers | securityContext.privileged must not be true |
| Capabilities | Cannot add beyond a set of defaults (NET_ADMIN, SYS_ADMIN etc.) |
| HostPath volumes | Disallowed |
| Host ports | hostPort: 0 or unset |
| AppArmor | No custom AppArmor profiles that are not runtime/default |
| SELinux | No custom SELinux that override defaults |
| /proc mount | procMount: Default only |
| Seccomp | Allowed values: Unconfined, RuntimeDefault, Localhost |

\`\`\`yaml
# Pod that VIOLATES Baseline:
spec:
  hostPID: true         # BLOCKED
  hostNetwork: true     # BLOCKED
  containers:
  - name: app
    securityContext:
      privileged: true  # BLOCKED
      capabilities:
        add: ["NET_ADMIN", "SYS_ADMIN"]  # BLOCKED
    volumeMounts:
    - name: host
      mountPath: /host
  volumes:
  - name: host
    hostPath:
      path: /           # BLOCKED
\`\`\`

## Restricted Level — What it Requires

Restricted builds on Baseline and adds requirements:

| Control | Requirement |
|---------|-------------|
| All Baseline controls | Must pass Baseline first |
| Volume types | Only: configMap, csi, downwardAPI, emptyDir, ephemeral, persistentVolumeClaim, projected, secret |
| Privilege escalation | allowPrivilegeEscalation: false |
| Running as non-root | runAsNonRoot: true OR runAsUser ≠ 0 |
| Seccomp profile | RuntimeDefault or Localhost (not Unconfined) |
| Capabilities | Must drop ALL, only NET_BIND_SERVICE allowed |

\`\`\`yaml
# Pod COMPLIANT with Restricted level:
spec:
  containers:
  - name: app
    image: nginx:alpine
    securityContext:
      runAsNonRoot: true
      runAsUser: 1000
      runAsGroup: 3000
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop: ["ALL"]
        add: ["NET_BIND_SERVICE"]  # optional — only if needed
      seccompProfile:
        type: RuntimeDefault
  securityContext:
    fsGroup: 2000
    seccompProfile:
      type: RuntimeDefault
\`\`\`

## securityContext Reference

### Pod-Level vs Container-Level

\`\`\`yaml
spec:
  # Pod-level securityContext (applies to ALL containers)
  securityContext:
    runAsUser: 1000           # UID for all containers
    runAsGroup: 3000          # GID for all containers
    fsGroup: 2000             # GID for volumes
    fsGroupChangePolicy: "OnRootMismatch"
    supplementalGroups: [4000]
    sysctls:                  # kernel parameters
    - name: net.core.somaxconn
      value: "1024"
    seccompProfile:
      type: RuntimeDefault

  containers:
  - name: app
    # Container-level (overrides pod-level for that container)
    securityContext:
      runAsUser: 2000         # overrides pod-level runAsUser
      runAsNonRoot: true      # must be true in Restricted
      allowPrivilegeEscalation: false  # must be false in Restricted
      readOnlyRootFilesystem: true     # highly recommended
      capabilities:
        drop: ["ALL"]
        add: ["NET_BIND_SERVICE"]
      seccompProfile:         # can override pod-level seccomp
        type: Localhost
        localhostProfile: profiles/my-profile.json
\`\`\`

### Linux Capabilities Reference

\`\`\`bash
# Full list of capabilities relevant to K8s security:
NET_BIND_SERVICE  # bind ports below 1024 (allowed in Restricted)
NET_ADMIN         # network config (BLOCKED in Baseline+)
SYS_ADMIN         # many admin ops, container escape (BLOCKED)
SYS_PTRACE        # ptrace, container escape (BLOCKED)
NET_RAW           # raw sockets (BLOCKED in Restricted)
SYS_TIME          # change system time (BLOCKED)
SETUID, SETGID    # change user/group (BLOCKED in Restricted via drop ALL)

# Best practice: drop ALL, add only what's needed
capabilities:
  drop: ["ALL"]
  add: ["NET_BIND_SERVICE"]  # only if binding port < 1024
\`\`\`

## Seccomp Profiles

\`\`\`yaml
# RuntimeDefault: use container runtime's default seccomp (recommended)
seccompProfile:
  type: RuntimeDefault

# Localhost: use a custom profile file
seccompProfile:
  type: Localhost
  localhostProfile: profiles/custom.json  # relative to /var/lib/kubelet/seccomp/

# Unconfined: no seccomp filtering (NOT allowed in Restricted)
seccompProfile:
  type: Unconfined
\`\`\`

## AppArmor

\`\`\`yaml
# Apply AppArmor profile to container
metadata:
  annotations:
    container.apparmor.security.beta.kubernetes.io/<container-name>: runtime/default
    # OR: localhost/<profile-name>  (for custom profiles loaded on node)
    # OR: unconfined                (no restriction - NOT recommended)
\`\`\`

## Common PSA Violations and Fixes

\`\`\`yaml
# VIOLATION: privileged container
securityContext:
  privileged: true
# FIX: remove or set to false

# VIOLATION: missing runAsNonRoot (Restricted)
spec:
  containers:
  - name: app
    # no securityContext at all
# FIX:
    securityContext:
      runAsNonRoot: true
      runAsUser: 1000

# VIOLATION: missing seccomp (Restricted)
# FIX:
    securityContext:
      seccompProfile:
        type: RuntimeDefault

# VIOLATION: capabilities not dropped (Restricted)
# FIX:
    securityContext:
      capabilities:
        drop: ["ALL"]

# VIOLATION: allowPrivilegeEscalation not set (Restricted)
# FIX:
    securityContext:
      allowPrivilegeEscalation: false

# VIOLATION: hostPath volume (Baseline+)
volumes:
- name: host
  hostPath:
    path: /
# FIX: Use emptyDir, configMap, or PVC instead
\`\`\`

## Migrating to Restricted Gradually

\`\`\`bash
# Step 1: Apply warn + audit (no enforcement, see what would break)
kubectl label namespace production \
  pod-security.kubernetes.io/warn=restricted \
  pod-security.kubernetes.io/audit=restricted

# Step 2: Check audit logs for violations
kubectl get events -n production | grep PodSecurity

# Step 3: Fix all violations

# Step 4: Enforce
kubectl label namespace production \
  pod-security.kubernetes.io/enforce=restricted
\`\`\`

## Exemptions

\`\`\`yaml
# In the AdmissionConfiguration (webhook config)
# Exempt specific namespaces, users, or RuntimeClasses
apiVersion: apiserver.config.k8s.io/v1
kind: AdmissionConfiguration
plugins:
- name: PodSecurity
  configuration:
    apiVersion: pod-security.admission.config.k8s.io/v1
    kind: PodSecurityConfiguration
    defaults:
      enforce: "baseline"
      audit: "restricted"
      warn: "restricted"
    exemptions:
      usernames: ["system:serviceaccount:kube-system:replicaset-controller"]
      namespaces: ["kube-system", "monitoring"]
      runtimeClasses: []
\`\`\`

## Common Mistakes

- **Setting policy only on enforce**: Use warn + audit for visibility before enforcing
- **Forgetting container-level securityContext**: Pod-level doesn't set capabilities or allowPrivilegeEscalation — those must be on each container
- **Ignoring init containers**: PSA checks ALL containers including init containers
- **Forgetting seccomp in Restricted**: RuntimeDefault is required — omitting it violates Restricted

## Killer.sh Style Challenge

> **Scenario**: Namespace "team-a" is labeled with enforce=restricted. A new Deployment fails to create pods. The pod spec runs as root with no capabilities drop. Fix the Deployment to comply with Restricted policy.
`,

  quiz: [
    {
      question: 'Which namespace label enforces the Restricted PSS level (rejecting non-compliant pods)?',
      options: [
        'pod-security.kubernetes.io/enforce: restricted',
        'pod-security.kubernetes.io/restrict: enforce',
        'pod-security.kubernetes.io/policy: restricted',
        'kubernetes.io/pod-security: restricted-enforce'
      ],
      correct: 0,
      explanation: 'The label key format is pod-security.kubernetes.io/<mode> and the value is the level. "enforce" mode rejects pods that violate the policy. "audit" logs violations. "warn" shows warnings to the user but allows the pod.',
      reference: 'Pod Security Standards — Namespace Labels section.'
    },
    {
      question: 'Which of these Pod spec fields is blocked by the Baseline PSS level?',
      options: [
        'spec.hostPID: true',
        'spec.securityContext.runAsUser: 1000',
        'spec.containers[0].securityContext.readOnlyRootFilesystem: true',
        'spec.volumes[0].emptyDir: {}'
      ],
      correct: 0,
      explanation: 'Baseline blocks host namespace sharing (hostPID, hostIPC, hostNetwork), privileged containers, dangerous capabilities, hostPath volumes, and host ports. Setting runAsUser, readOnlyRootFilesystem, or using emptyDir volumes are all allowed.',
      reference: 'Pod Security Standards — Baseline Level table.'
    },
    {
      question: 'Which securityContext field is REQUIRED at the container level for Restricted compliance?',
      options: [
        'allowPrivilegeEscalation: false',
        'readOnlyRootFilesystem: true',
        'runAsUser: 1000',
        'seccompProfile.type: RuntimeDefault'
      ],
      correct: 0,
      explanation: 'allowPrivilegeEscalation: false is required at the container level for Restricted. Also required: drop ALL capabilities, runAsNonRoot: true (or runAsUser != 0), and seccompProfile not Unconfined. readOnlyRootFilesystem and runAsUser are recommended but not required by Restricted.',
      reference: 'Pod Security Standards — Restricted Level table.'
    },
    {
      question: 'A pod in a Restricted namespace fails with "forbidden: violates PodSecurity". How do you identify which field is violating?',
      options: [
        'The rejection message includes the specific fields that are violating — read the kubectl error output carefully',
        'Run kubectl describe pod <name> and check the PodSecurity annotation',
        'Check the PSA controller logs in kube-system',
        'Use kubectl auth can-i create pod to find the policy violation'
      ],
      correct: 0,
      explanation: 'When PSA rejects a pod, the error message from kubectl create/apply includes the specific fields that violate the policy. For example: "privileged (container "app" must not set securityContext.privileged=true)". Read the full error message.',
      reference: 'Pod Security Standards — Common PSA Violations section.'
    },
    {
      question: 'What is the purpose of using "warn" mode before "enforce" mode for PSS?',
      options: [
        'Warn mode allows pods to run while showing warnings — lets teams see what would break before enforcing',
        'Warn mode rejects pods with a warning instead of an error',
        'Warn mode only applies to Deployment resources, not standalone Pods',
        'Warn mode sends email notifications to cluster admins about violations'
      ],
      correct: 0,
      explanation: 'Using warn + audit before enforce allows a gradual rollout: existing and new pods still run, but users see deprecation warnings and violations are logged in audit. This gives time to fix applications before hard enforcement.',
      reference: 'Pod Security Standards — Migrating to Restricted Gradually section.'
    },
    {
      question: 'For Restricted level, which seccomp profile types are allowed?',
      options: [
        'RuntimeDefault or Localhost — NOT Unconfined',
        'Only RuntimeDefault',
        'Unconfined, RuntimeDefault, or Localhost (all types allowed)',
        'Only Localhost with a custom profile file'
      ],
      correct: 0,
      explanation: 'Restricted requires seccomp to be RuntimeDefault or Localhost (a custom profile). Unconfined (no seccomp) is NOT allowed in Restricted. The Baseline level allows Unconfined but only as an allowed value — Restricted mandates active seccomp.',
      reference: 'Pod Security Standards — Restricted Level table.'
    },
    {
      question: 'Which volume type is allowed under Restricted PSS?',
      options: [
        'persistentVolumeClaim',
        'hostPath',
        'nfs',
        'awsElasticBlockStore'
      ],
      correct: 0,
      explanation: 'Restricted allows only specific safe volume types: configMap, csi, downwardAPI, emptyDir, ephemeral, persistentVolumeClaim, projected, secret. hostPath is blocked at Baseline. nfs, awsEBS, and other in-tree plugins that access node resources are not in the Restricted allowlist.',
      reference: 'Pod Security Standards — Restricted Level table.'
    },
    {
      question: 'A Deployment uses an init container that runs as root. The namespace enforces Restricted. What happens?',
      options: [
        'The Deployment is rejected — PSA checks ALL containers including init containers',
        'Init containers are exempt from PSS because they run before the main app',
        'The init container is allowed but the main containers must comply',
        'The Deployment is created but the init container is killed before it starts'
      ],
      correct: 0,
      explanation: 'Pod Security Admission checks ALL containers in the pod: init containers, ephemeral containers, and regular containers. If ANY container violates the policy, the entire pod is rejected. This is a common mistake — fixing only the main container.',
      reference: 'Pod Security Standards — Common Mistakes section.'
    }
  ],

  flashcards: [
    {
      front: 'What are the 3 PSS levels and what does each block?',
      back: 'Privileged: no restrictions (system pods)\n\nBaseline: blocks most dangerous settings:\n- hostPID/IPC/Network: true\n- privileged: true\n- dangerous capabilities (NET_ADMIN, SYS_ADMIN)\n- hostPath volumes\n- host ports\n\nRestricted: all Baseline + requires:\n- allowPrivilegeEscalation: false\n- runAsNonRoot: true\n- drop ALL capabilities\n- seccomp: RuntimeDefault or Localhost (not Unconfined)\n- only safe volume types'
    },
    {
      front: 'What namespace labels enforce Restricted PSS?',
      back: '# Enforce (reject non-compliant pods):\nkubectl label ns production \\\n  pod-security.kubernetes.io/enforce=restricted\n\n# With version pin (stable behavior):\npod-security.kubernetes.io/enforce-version: v1.29\n\n# Gradual rollout (warn first):\npod-security.kubernetes.io/warn=restricted\npod-security.kubernetes.io/audit=restricted\n\n# Verify:\nkubectl get ns production --show-labels'
    },
    {
      front: 'Write a fully Restricted-compliant container securityContext',
      back: 'securityContext:\n  runAsNonRoot: true\n  runAsUser: 1000\n  runAsGroup: 3000\n  allowPrivilegeEscalation: false\n  readOnlyRootFilesystem: true\n  capabilities:\n    drop: ["ALL"]\n    # add: ["NET_BIND_SERVICE"]  # only if port < 1024\n  seccompProfile:\n    type: RuntimeDefault\n\nAlso at pod level:\nspec:\n  securityContext:\n    fsGroup: 2000\n    seccompProfile:\n      type: RuntimeDefault'
    },
    {
      front: 'What are the 3 PSA modes and how do they behave?',
      back: 'enforce: Reject the pod creation (hard block)\n  → Error: "forbidden: violates PodSecurity"\n\naudit: Allow pod but log violation to audit log\n  → Pod runs, violation recorded in audit\n\nwarn: Allow pod but show warning in kubectl response\n  → Pod runs, user sees: Warning: ... violates PodSecurity\n\nAll 3 modes can be set simultaneously on one namespace:\npod-security.kubernetes.io/enforce=restricted\npod-security.kubernetes.io/warn=restricted\npod-security.kubernetes.io/audit=restricted'
    },
    {
      front: 'What 5 fields does Restricted PSS require in a container securityContext?',
      back: '1. allowPrivilegeEscalation: false\n   (prevents setuid/setgid from giving more privileges)\n\n2. runAsNonRoot: true OR runAsUser ≠ 0\n   (no root containers)\n\n3. capabilities.drop: ["ALL"]\n   (drop all Linux capabilities)\n\n4. seccompProfile.type: RuntimeDefault or Localhost\n   (no Unconfined)\n\n5. (Inherited from Baseline) No privileged: true, no hostPID/IPC/Network, etc.'
    },
    {
      front: 'Which volume types are allowed in Restricted PSS?',
      back: 'Allowed (safe) volume types:\n- configMap\n- csi\n- downwardAPI\n- emptyDir\n- ephemeral\n- persistentVolumeClaim (PVC)\n- projected\n- secret\n\nNOT allowed in Restricted:\n- hostPath (node filesystem access)\n- nfs, awsElasticBlockStore, gcePersistentDisk\n- iscsi, fc, glusterfs\n- Any in-tree volume type that mounts external block storage directly'
    }
  ],

  lab: {
    scenario: 'The "restricted-ns" namespace has been labeled with enforce=restricted, but existing Deployments are failing. Fix the Deployments to comply with the Restricted Pod Security Standard.',
    objective: 'Fix pod security violations to comply with the Restricted PSS level by adding proper securityContext fields.',
    duration: '20-30 minutes',
    steps: [
      {
        title: 'Set up the namespace and failing deployment',
        instruction: `Create a namespace with Restricted enforcement and a non-compliant Deployment.

\`\`\`bash
# Create namespace with Restricted PSS
kubectl create namespace restricted-ns
kubectl label namespace restricted-ns \
  pod-security.kubernetes.io/enforce=restricted \
  pod-security.kubernetes.io/warn=restricted

# Try to create a non-compliant deployment
cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: webapp
  namespace: restricted-ns
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
      - name: app
        image: nginx:alpine
        ports:
        - containerPort: 80
EOF

# Check what happened
kubectl get pods -n restricted-ns
kubectl describe replicaset -n restricted-ns | tail -20
\`\`\``,
        hints: [
          'The Deployment is created but ReplicaSet cannot create pods due to PSS violation',
          'Check the ReplicaSet events for the PSS violation message',
          'The error message lists exactly which fields violate the policy'
        ],
        solution: `\`\`\`bash
kubectl create namespace restricted-ns
kubectl label namespace restricted-ns pod-security.kubernetes.io/enforce=restricted
cat <<EOF | kubectl apply -f - 2>&1
apiVersion: apps/v1
kind: Deployment
metadata:
  name: webapp
  namespace: restricted-ns
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
      - name: app
        image: nginx:alpine
EOF
\`\`\``,
        verify: `\`\`\`bash
# Deployment exists but pods should be in violation state
kubectl get deployment webapp -n restricted-ns
# Expected: READY 0/1

# Check replicaset for PSS violation error
kubectl get events -n restricted-ns | grep -i "security\|policy\|forbidden"
# Expected: Warning events about PSS violations
\`\`\``
      },
      {
        title: 'Fix the Deployment to comply with Restricted',
        instruction: `Update the Deployment with a compliant securityContext.

\`\`\`yaml
# Update the deployment with proper security context
cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: webapp
  namespace: restricted-ns
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
      securityContext:
        runAsNonRoot: true
        runAsUser: 101
        runAsGroup: 101
        fsGroup: 101
        seccompProfile:
          type: RuntimeDefault
      containers:
      - name: app
        image: nginx:alpine
        ports:
        - containerPort: 8080
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop: ["ALL"]
        volumeMounts:
        - name: tmp
          mountPath: /tmp
        - name: cache
          mountPath: /var/cache/nginx
        - name: run
          mountPath: /var/run
      volumes:
      - name: tmp
        emptyDir: {}
      - name: cache
        emptyDir: {}
      - name: run
        emptyDir: {}
EOF
\`\`\``,
        hints: [
          'nginx needs writable /tmp, /var/cache/nginx, /var/run — use emptyDir volumes',
          'nginx:alpine by default binds to port 80 (needs NET_BIND_SERVICE or run on port 8080+)',
          'Use runAsUser: 101 — the nginx user in the alpine image'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: webapp
  namespace: restricted-ns
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
      securityContext:
        runAsNonRoot: true
        runAsUser: 101
        fsGroup: 101
        seccompProfile:
          type: RuntimeDefault
      containers:
      - name: app
        image: nginx:alpine
        securityContext:
          allowPrivilegeEscalation: false
          capabilities:
            drop: ["ALL"]
        volumeMounts:
        - name: tmp
          mountPath: /tmp
      volumes:
      - name: tmp
        emptyDir: {}
EOF
\`\`\``,
        verify: `\`\`\`bash
# Pod should be running now
kubectl get pods -n restricted-ns
# Expected: webapp-xxx   1/1   Running

# Verify PSS compliance
kubectl get pod -n restricted-ns -l app=webapp -o yaml | grep -A15 securityContext

# Try creating a violating pod directly (should fail)
kubectl run bad-pod --image=nginx -n restricted-ns 2>&1
# Expected: Error from server (Forbidden): ... violates PodSecurity

kubectl get pods -n restricted-ns
# Expected: webapp-xxx  1/1  Running  (no "bad-pod")
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Pods in kube-system fail after namespace gets PSS label',
      difficulty: 'hard',
      symptom: 'A cluster admin accidentally applied pod-security.kubernetes.io/enforce=restricted to the kube-system namespace. Now system pods like coredns are failing.',
      diagnosis: `\`\`\`bash
# Check what labels are on kube-system
kubectl get namespace kube-system --show-labels

# Check if system pods are affected
kubectl get pods -n kube-system | grep -v Running

# Look at events
kubectl get events -n kube-system | grep -i security

# Check what the PSS violation is for a system pod
kubectl describe pod coredns-<hash> -n kube-system | grep -A5 "Warning"
\`\`\``,
      solution: `**Immediately remove or change the PSS label on kube-system.**

\`\`\`bash
# Remove the enforce label from kube-system (CRITICAL)
kubectl label namespace kube-system pod-security.kubernetes.io/enforce-

# Or change to privileged level (system pods need privileged access)
kubectl label namespace kube-system \
  pod-security.kubernetes.io/enforce=privileged \
  --overwrite

# Verify system pods recover
watch kubectl get pods -n kube-system
\`\`\`

**Prevention:**
- Never apply non-Privileged PSS to: kube-system, kube-public, kube-node-lease, ingress-nginx, cert-manager, monitoring namespaces
- Use PSA exemptions in the AdmissionConfiguration for system namespaces
- Use warn+audit mode to test before enforcing on system namespaces`
    },
    {
      title: 'Deployment creates pods but they crash due to read-only filesystem',
      difficulty: 'medium',
      symptom: 'After adding readOnlyRootFilesystem: true to comply with Restricted, the application pods crash with "Read-only file system" errors.',
      diagnosis: `\`\`\`bash
# Check pod logs for the specific path
kubectl logs <pod-name> -n <namespace> | grep -i "read-only\|EROFS\|permission denied"

# Find which paths the app writes to
kubectl exec <pod-name> -n <namespace> -- strace -e trace=open,openat,write sleep 30 2>&1 | grep -v ENOENT | head -30

# Common paths apps write to:
# /tmp, /var/tmp — use emptyDir
# /var/cache — use emptyDir
# /var/log — use emptyDir or sidecar
# /var/run, /run — use emptyDir
# /app/data — use PVC
\`\`\``,
      solution: `**Mount writable emptyDir volumes for paths the app needs to write to.**

\`\`\`yaml
spec:
  containers:
  - name: app
    securityContext:
      readOnlyRootFilesystem: true  # keep this!
    volumeMounts:
    - name: tmp
      mountPath: /tmp
    - name: cache
      mountPath: /var/cache/myapp
    - name: logs
      mountPath: /var/log/myapp
    - name: run
      mountPath: /var/run
  volumes:
  - name: tmp
    emptyDir: {}
  - name: cache
    emptyDir: {}
  - name: logs
    emptyDir:
      medium: Memory    # optional: use RAM for faster I/O
  - name: run
    emptyDir: {}
\`\`\`

**Key insight:** readOnlyRootFilesystem doesn't prevent writing to mounted volumes (emptyDir, PVC, configMap). It only makes the container's own filesystem layer read-only.`
    }
  ]
};
