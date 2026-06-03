window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['kcsa-k8s-security/pod-security-overview'] = {
  theory: `# Pod Security Overview

## Exam Relevance
> KCSA tests understanding of Pod Security Standards (PSS), securityContext settings, and how to prevent privilege escalation at the pod level. Expect questions about PSS levels, how to enforce them, and specific security context fields.

## Pod Security Standards (PSS)

PSS replaced the deprecated PodSecurityPolicy (PSP) in Kubernetes 1.25. PSS defines three built-in security levels applied to namespaces.

### PSS Levels

| Level | Description | Use Case |
|-------|-------------|----------|
| **Privileged** | No restrictions | System workloads (CSI, CNI, monitoring) |
| **Baseline** | Prevents common privilege escalation | Most workloads |
| **Restricted** | Hardened security best practices | High-security workloads |

### What Each Level Allows/Prevents

**Baseline** prevents:
- Privileged containers (\`privileged: true\`)
- Host namespaces (\`hostPID\`, \`hostIPC\`, \`hostNetwork\`)
- Dangerous capabilities (\`NET_ADMIN\`, \`SYS_ADMIN\`, etc.)
- hostPath volumes
- Container ports binding to host ports < 1024

**Restricted** (all of Baseline plus):
- Containers must drop ALL capabilities
- Must run as non-root (\`runAsNonRoot: true\`)
- seccomp profile required
- Volume types restricted to safe list
- Privilege escalation disabled (\`allowPrivilegeEscalation: false\`)

### Applying PSS to Namespaces

\`\`\`bash
# Apply PSS via namespace labels
kubectl label namespace production \\
  pod-security.kubernetes.io/enforce=restricted \\
  pod-security.kubernetes.io/enforce-version=latest \\
  pod-security.kubernetes.io/warn=restricted \\    # warn even if not enforcing
  pod-security.kubernetes.io/audit=restricted       # log violations to audit
\`\`\`

**Label format**: \`pod-security.kubernetes.io/<mode>=<level>\`
**Modes**: \`enforce\` (block), \`warn\` (client warning), \`audit\` (log)

### Pod That Violates Restricted PSS
\`\`\`yaml
spec:
  containers:
  - name: app
    image: nginx
    # Missing: runAsNonRoot, seccompProfile, capabilities.drop
\`\`\`

### Pod Compliant with Restricted PSS
\`\`\`yaml
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    seccompProfile:
      type: RuntimeDefault    # use container runtime's default seccomp
  containers:
  - name: app
    image: nginx
    securityContext:
      allowPrivilegeEscalation: false
      capabilities:
        drop: ["ALL"]          # drop all capabilities
      readOnlyRootFilesystem: true
\`\`\`

## securityContext Reference

### Pod-Level vs Container-Level

Pod-level settings (\`spec.securityContext\`) apply to all containers:
\`\`\`yaml
spec:
  securityContext:
    runAsUser: 1000           # UID for all containers
    runAsGroup: 3000          # GID for all containers
    fsGroup: 2000             # group for volumes
    runAsNonRoot: true        # refuse to start as root
    supplementalGroups: [1001]
    seccompProfile:
      type: RuntimeDefault
\`\`\`

Container-level settings override pod-level:
\`\`\`yaml
containers:
- name: app
  securityContext:
    runAsUser: 2000           # overrides pod-level
    allowPrivilegeEscalation: false
    readOnlyRootFilesystem: true
    capabilities:
      drop: ["ALL"]
      add: ["NET_BIND_SERVICE"]   # only add specific needed capabilities
\`\`\`

## Linux Capabilities

Instead of running as root, use specific capabilities:

| Capability | What it allows |
|------------|----------------|
| \`NET_BIND_SERVICE\` | Bind to ports < 1024 (without root) |
| \`NET_ADMIN\` | Network administration (dangerous!) |
| \`SYS_ADMIN\` | Many system admin operations (very dangerous!) |
| \`CHOWN\` | Change file ownership |
| \`DAC_OVERRIDE\` | Override file permissions |

**Best practice**: Drop ALL capabilities first, then add back only what's needed.
\`\`\`yaml
capabilities:
  drop: ["ALL"]
  add: ["NET_BIND_SERVICE"]  # only if binding port < 1024
\`\`\`

## Seccomp Profiles

Seccomp filters system calls that containers can make:

\`\`\`yaml
securityContext:
  seccompProfile:
    type: RuntimeDefault    # use runtime's recommended profile (recommended)
    # OR:
    type: Localhost         # custom profile from node filesystem
    localhostProfile: profiles/myapp.json
    # OR:
    type: Unconfined        # no seccomp (default in older K8s) — risky!
\`\`\`

## AppArmor

AppArmor is a Linux Security Module (LSM) for restricting container capabilities:
\`\`\`yaml
# Kubernetes 1.30+ (via securityContext)
securityContext:
  appArmorProfile:
    type: RuntimeDefault    # use runtime's default AppArmor profile
    # OR:
    type: Localhost
    localhostProfile: k8s-apparmor-example-deny-write  # profile loaded on node
\`\`\`

## ServiceAccount Token Security

\`\`\`yaml
spec:
  serviceAccountName: my-sa
  automountServiceAccountToken: false  # don't auto-mount token
  # OR at SA level:
  # kubectl create sa my-sa --dry-run=client -o yaml
  # metadata.annotations: kubernetes.io/service-account.uid: ...
\`\`\`

## Pod Security Admission Controller

PSS is enforced by the built-in **PodSecurity** admission controller (enabled by default since K8s 1.25).

For more granular policies, use:
- **OPA Gatekeeper** — policy as code (Rego)
- **Kyverno** — policy as YAML

## Privilege Escalation

### Common Privilege Escalation Paths
1. \`privileged: true\` → node access via nsenter
2. \`hostPID: true\` → access host processes
3. \`hostNetwork: true\` → bypass network isolation
4. \`hostPath: /\` → read/write host filesystem
5. RBAC: create pods → create privileged pod
6. High capabilities: SYS_ADMIN, SYS_PTRACE, etc.

### Prevention
\`\`\`yaml
spec:
  hostPID: false      # never true in production
  hostNetwork: false
  hostIPC: false
  containers:
  - securityContext:
      privileged: false
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      runAsNonRoot: true
      capabilities:
        drop: ["ALL"]
\`\`\`

## Quick Reference: Pod Security Checklist

\`\`\`
✅ runAsNonRoot: true  (or specific non-zero runAsUser)
✅ allowPrivilegeEscalation: false
✅ capabilities.drop: ["ALL"]
✅ readOnlyRootFilesystem: true  (or use emptyDir for writable areas)
✅ seccompProfile: RuntimeDefault
✅ No privileged: true
✅ No hostPID/hostNetwork/hostIPC: true
✅ No hostPath volumes
✅ automountServiceAccountToken: false (if not needed)
\`\`\`
`,
  quiz: [
    {
      question: 'What are the three Pod Security Standard (PSS) levels?',
      options: [
        'Privileged, Baseline, Restricted',
        'Low, Medium, High',
        'None, Basic, Strict',
        'Standard, Enhanced, Hardened'
      ],
      correct: 0,
      explanation: 'PSS defines three levels: Privileged (no restrictions), Baseline (prevents common escalations like hostPID, privileged containers), and Restricted (strongest — requires non-root, capabilities drop, seccomp).',
      reference: 'Review "PSS Levels" table.'
    },
    {
      question: 'How is Pod Security Standard enforcement applied to a namespace?',
      options: [
        'Via labels on the namespace: pod-security.kubernetes.io/enforce=<level>',
        'Via annotations on each Pod',
        'Via a PodSecurityPolicy resource (deprecated)',
        'Via a ClusterRoleBinding to the PSS built-in roles'
      ],
      correct: 0,
      explanation: 'PSS is applied per namespace via labels. The format is pod-security.kubernetes.io/<mode>=<level>. Modes: enforce (block), warn (client warning), audit (log). Level: privileged, baseline, or restricted.',
      reference: 'Review "Applying PSS to Namespaces" section.'
    },
    {
      question: 'What does "allowPrivilegeEscalation: false" prevent in a container?',
      options: [
        'Prevents the container process from gaining more privileges than its parent (blocks setuid/setgid binaries)',
        'Prevents the container from running with privileged: true',
        'Prevents the container from adding Linux capabilities',
        'Prevents the container from accessing host namespaces'
      ],
      correct: 0,
      explanation: 'allowPrivilegeEscalation: false prevents child processes from gaining more privileges than the parent — specifically, it blocks setuid/setgid binaries and the NO_NEW_PRIVS flag is set.',
      reference: 'Review "Pod Compliant with Restricted PSS" and "Pod-Level vs Container-Level" sections.'
    },
    {
      question: 'Which securityContext setting should be applied when a container doesn\'t need to write to its filesystem?',
      options: [
        'readOnlyRootFilesystem: true',
        'immutableFilesystem: true',
        'readOnly: true in volumeMounts',
        'filesystemMode: readonly'
      ],
      correct: 0,
      explanation: 'readOnlyRootFilesystem: true makes the container\'s root filesystem read-only, preventing attackers from writing malicious files, modifying binaries, or creating persistence. Use emptyDir volumes for writable areas.',
      reference: 'Review "Container-Level securityContext" examples.'
    },
    {
      question: 'Which Linux capability is needed if a non-root application needs to bind to port 80?',
      options: [
        'NET_BIND_SERVICE',
        'NET_ADMIN',
        'SYS_ADMIN',
        'CHOWN'
      ],
      correct: 0,
      explanation: 'NET_BIND_SERVICE allows binding to privileged ports (< 1024) without running as root. This is a common pattern: drop ALL capabilities, then add only NET_BIND_SERVICE if port 80 or 443 is needed.',
      reference: 'Review "Linux Capabilities" table.'
    },
    {
      question: 'What is the recommended seccompProfile type for production pods?',
      options: [
        'RuntimeDefault — uses the container runtime\'s built-in secure profile',
        'Unconfined — allows all syscalls for maximum compatibility',
        'Localhost — uses a custom profile from node filesystem',
        'Restrict — blocks all syscalls except an explicit allowlist'
      ],
      correct: 0,
      explanation: 'RuntimeDefault uses the container runtime\'s built-in seccomp profile (containerd/CRI-O have sensible defaults). It blocks dangerous syscalls without breaking normal workloads. Required for Restricted PSS level.',
      reference: 'Review "Seccomp Profiles" section.'
    },
    {
      question: 'What is the difference between pod-level and container-level securityContext?',
      options: [
        'Pod-level applies to all containers; container-level overrides pod-level for that specific container',
        'Pod-level applies to init containers only; container-level applies to regular containers',
        'Container-level is required; pod-level is optional and additive',
        'They are equivalent — both can set all the same fields'
      ],
      correct: 0,
      explanation: 'Pod-level securityContext sets defaults for all containers in the pod. Container-level overrides those defaults. Some fields (like fsGroup, supplementalGroups) are only available at pod level.',
      reference: 'Review "Pod-Level vs Container-Level" section.'
    },
    {
      question: 'What does "automountServiceAccountToken: false" prevent?',
      options: [
        'Prevents the SA token from being auto-mounted in the pod at /var/run/secrets/kubernetes.io/serviceaccount/',
        'Prevents new ServiceAccounts from being created automatically',
        'Prevents the pod from using RBAC permissions',
        'Prevents token expiry from disrupting the pod'
      ],
      correct: 0,
      explanation: 'By default, Kubernetes mounts the SA token in every pod. automountServiceAccountToken: false prevents this — useful for pods that don\'t need API server access (reduces attack surface if pod is compromised).',
      reference: 'Review "ServiceAccount Token Security" section.'
    }
  ],
  flashcards: [
    {
      front: 'What are the 3 PSS levels and what does each prevent?',
      back: 'Privileged: no restrictions. Baseline: blocks hostPID/hostNetwork, privileged containers, dangerous capabilities, hostPath. Restricted: all of Baseline + requires non-root, drop ALL caps, allowPrivilegeEscalation:false, seccomp, limited volume types.'
    },
    {
      front: 'How do you apply PSS enforcement to a namespace?',
      back: 'kubectl label namespace <ns> pod-security.kubernetes.io/enforce=restricted. Three modes: enforce (blocks non-compliant pods), warn (shows client warning), audit (logs to audit). All three can be set simultaneously at different levels.'
    },
    {
      front: 'What is the minimum securityContext for a Restricted PSS-compliant pod?',
      back: 'runAsNonRoot: true, seccompProfile: RuntimeDefault (pod-level), allowPrivilegeEscalation: false, capabilities.drop: ["ALL"], readOnlyRootFilesystem: true (all container-level).'
    },
    {
      front: 'What is the difference between privileged: true and capabilities?',
      back: 'privileged: true gives the container all capabilities AND disables many kernel security features — effectively root on the host. Capabilities allow specific kernel privileges without full privilege. Always use capabilities instead of privileged.'
    },
    {
      front: 'What happened to PodSecurityPolicy (PSP)?',
      back: 'PSP was deprecated in Kubernetes 1.21 and removed in 1.25. It was replaced by Pod Security Admission (PSS enforcement) built into the API server. For complex policies, use OPA Gatekeeper or Kyverno.'
    },
    {
      front: 'What does fsGroup in pod securityContext do?',
      back: 'fsGroup sets the group ID for all volumes mounted to the pod. Files created in those volumes are owned by this group. Useful for shared volumes between containers in the same pod.'
    }
  ],
  lab: {
    scenario: 'Apply Pod Security Standards to a namespace and verify that non-compliant pods are blocked while compliant pods can run.',
    objective: 'Practice applying PSS at different levels and fixing pod specs to be compliant.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Apply PSS Baseline to a namespace',
        instruction: `Create namespace \`pss-lab\` and apply PSS Baseline enforcement. Try to create a pod with \`hostNetwork: true\` (violates Baseline) and a normal pod (should succeed).`,
        hints: [
          'kubectl label namespace pss-lab pod-security.kubernetes.io/enforce=baseline',
          'Try kubectl run with --overrides to add hostNetwork:true',
          'A normal nginx pod should succeed'
        ],
        solution: `\`\`\`bash
kubectl create namespace pss-lab

# Apply Baseline enforcement
kubectl label namespace pss-lab \\
  pod-security.kubernetes.io/enforce=baseline \\
  pod-security.kubernetes.io/enforce-version=latest

# Test: violating pod (hostNetwork = violates Baseline)
kubectl run bad-pod -n pss-lab \\
  --image=nginx \\
  --overrides='{"spec":{"hostNetwork":true}}' 2>&1
# Expected: Error... violates PodSecurity "baseline"

# Test: compliant pod
kubectl run good-pod --image=nginx -n pss-lab
\`\`\``,
        verify: `\`\`\`bash
kubectl get namespace pss-lab -o jsonpath='{.metadata.labels}' | python3 -m json.tool | grep pod-security
# Expected: shows pod-security.kubernetes.io/enforce=baseline

kubectl get pod good-pod -n pss-lab
# Expected: Running

kubectl get pod bad-pod -n pss-lab 2>&1
# Expected: Error from server (NotFound) — pod was rejected
\`\`\``
      },
      {
        title: 'Upgrade to Restricted and fix a pod',
        instruction: `Upgrade the namespace to \`restricted\` PSS level. Try to deploy a simple nginx pod (fails — nginx runs as root by default). Then fix the pod spec to be compliant with Restricted PSS.`,
        hints: [
          'kubectl label namespace pss-lab pod-security.kubernetes.io/enforce=restricted',
          'First try plain nginx — it will fail (runs as root)',
          'Fix by adding runAsNonRoot, seccompProfile, capabilities.drop, allowPrivilegeEscalation:false'
        ],
        solution: `\`\`\`bash
# Upgrade to Restricted
kubectl label namespace pss-lab \\
  pod-security.kubernetes.io/enforce=restricted \\
  --overwrite

# Test: plain nginx (will fail — runs as root by default)
kubectl run nginx-plain --image=nginx -n pss-lab 2>&1
# Expected: Error: violates PodSecurity "restricted"

# Fix: create compliant pod
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: nginx-compliant
  namespace: pss-lab
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 101       # nginx's non-root user
    seccompProfile:
      type: RuntimeDefault
  containers:
  - name: nginx
    image: nginxinc/nginx-unprivileged  # non-root nginx image!
    securityContext:
      allowPrivilegeEscalation: false
      capabilities:
        drop: ["ALL"]
      readOnlyRootFilesystem: false  # nginx needs to write to some dirs
EOF
\`\`\``,
        verify: `\`\`\`bash
kubectl get pod nginx-compliant -n pss-lab
# Expected: Running (or ContainerCreating briefly)

kubectl get pod nginx-plain -n pss-lab 2>&1
# Expected: Not found — rejected by PSS

kubectl describe namespace pss-lab | grep -A5 "Labels:"
# Expected: shows enforce=restricted label

# Cleanup
kubectl delete namespace pss-lab
\`\`\``
      },
      {
        title: 'Verify securityContext fields in a running pod',
        instruction: `Create a pod with full security context configuration. Verify the security settings are applied by checking the process UID and filesystem access inside the pod.`,
        hints: [
          'Use runAsUser: 1000 and verify with id command',
          'Use readOnlyRootFilesystem: true and verify you can\'t write to /',
          'Use an emptyDir volume for writable temp storage'
        ],
        solution: `\`\`\`bash
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: security-demo
spec:
  securityContext:
    runAsUser: 1000
    runAsGroup: 3000
    fsGroup: 2000
    runAsNonRoot: true
    seccompProfile:
      type: RuntimeDefault
  containers:
  - name: app
    image: busybox
    command: ["sleep", "3600"]
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop: ["ALL"]
    volumeMounts:
    - name: tmp
      mountPath: /tmp
  volumes:
  - name: tmp
    emptyDir: {}
EOF

kubectl wait pod/security-demo --for=condition=Ready --timeout=60s
\`\`\``,
        verify: `\`\`\`bash
# Verify running as UID 1000
kubectl exec security-demo -- id
# Expected: uid=1000 gid=3000 groups=3000,2000

# Verify read-only root filesystem
kubectl exec security-demo -- touch /test 2>&1
# Expected: touch: /test: Read-only file system

# Verify writable /tmp (via emptyDir volume)
kubectl exec security-demo -- touch /tmp/test
kubectl exec security-demo -- ls /tmp/test
# Expected: /tmp/test exists

# Cleanup
kubectl delete pod security-demo
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Pod rejected by PSS Restricted — fixing compliance',
      difficulty: 'easy',
      symptom: 'kubectl apply returns: "pods \"myapp\" is forbidden: violates PodSecurity \"restricted\": allowPrivilegeEscalation != false (container \"app\" must set securityContext.allowPrivilegeEscalation=false)"',
      diagnosis: `\`\`\`bash
# Check which PSS level the namespace enforces
kubectl get namespace <ns> -o jsonpath='{.metadata.labels}' | python3 -m json.tool | grep pod-security

# Dry-run to see all violations at once
kubectl apply -f mypod.yaml --dry-run=server 2>&1

# Or add warn label to see violations without blocking
kubectl label namespace <ns> pod-security.kubernetes.io/warn=restricted --overwrite
kubectl apply -f mypod.yaml
\`\`\``,
      solution: `The error message tells you exactly which field is missing. For Restricted PSS, ensure ALL of these are set:

\`\`\`yaml
spec:
  securityContext:
    runAsNonRoot: true
    seccompProfile:
      type: RuntimeDefault
  containers:
  - securityContext:
      allowPrivilegeEscalation: false    # ← fix this one
      capabilities:
        drop: ["ALL"]                    # also required
\`\`\`

Common Restricted violations:
- Missing allowPrivilegeEscalation: false
- Missing capabilities.drop: ["ALL"]
- Missing seccompProfile
- Container running as root (runAsUser: 0 or no runAsNonRoot)
- Using volume types not allowed (hostPath, etc.)`
    },
    {
      title: 'Application broken after adding readOnlyRootFilesystem',
      difficulty: 'medium',
      symptom: 'After adding readOnlyRootFilesystem: true to a container, the application fails to start with "Read-only file system" errors. The app needs to write temporary files.',
      diagnosis: `\`\`\`bash
# Check pod events and logs
kubectl describe pod <name>
kubectl logs <name>
# Look for: "Read-only file system" errors

# Find where the app tries to write
kubectl exec <pod> -- sh -c "ls -la /var/run/ /tmp/ /var/log/" 2>&1
\`\`\``,
      solution: `Add emptyDir volumes for writable directories the application needs:

\`\`\`yaml
spec:
  containers:
  - name: app
    securityContext:
      readOnlyRootFilesystem: true
    volumeMounts:
    - name: tmp
      mountPath: /tmp
    - name: varrun
      mountPath: /var/run
    - name: cache
      mountPath: /app/cache    # wherever the app writes
  volumes:
  - name: tmp
    emptyDir: {}
  - name: varrun
    emptyDir: {}
  - name: cache
    emptyDir: {}
\`\`\`

For larger temp storage needs, set a size limit on emptyDir:
\`\`\`yaml
volumes:
- name: cache
  emptyDir:
    sizeLimit: 500Mi
\`\`\``
    }
  ]
};
