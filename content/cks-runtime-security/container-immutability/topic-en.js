window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['cks-runtime-security/container-immutability'] = {
  theory: `# Container Immutability at Runtime

## Exam Relevance
> CKS expects you to enforce immutable containers using securityContext, understand the security implications, and identify patterns that break immutability. Appears in Runtime Security domain (~8%).

## What is Container Immutability?

An **immutable container** cannot be modified after it starts — no file writes, no new processes (except through defined entry points), no changes to the filesystem.

**Security principle:** If a container is compromised, the attacker cannot install tools, modify binaries, or persist changes. The blast radius is limited to the container's defined capabilities.

## Core Enforcement: readOnlyRootFilesystem

\`\`\`yaml
spec:
  containers:
  - name: app
    securityContext:
      readOnlyRootFilesystem: true    # the primary immutability control
\`\`\`

With this set:
- ✅ Container process can read from the filesystem
- ❌ Cannot write, create, or delete files
- ✅ Can still write to mounted volumes (emptyDir, PVC, etc.)
- ❌ Cannot install packages (apt install), download scripts
- ❌ Attacker cannot drop tools (netcat, wget, curl)

\`\`\`bash
# Test: try to write inside a pod with readOnlyRootFilesystem
kubectl exec my-pod -- touch /tmp/test
# Error: touch: /tmp/test: Read-only file system
\`\`\`

## Required Writable Volumes

Most applications need at least some writable directories:

\`\`\`yaml
spec:
  containers:
  - name: app
    image: nginx:alpine
    securityContext:
      readOnlyRootFilesystem: true
    volumeMounts:
    - name: tmp
      mountPath: /tmp
    - name: nginx-cache
      mountPath: /var/cache/nginx
    - name: nginx-run
      mountPath: /var/run
    - name: nginx-log
      mountPath: /var/log/nginx
  volumes:
  - name: tmp
    emptyDir: {}
  - name: nginx-cache
    emptyDir: {}
  - name: nginx-run
    emptyDir: {}
  - name: nginx-log
    emptyDir: {}
\`\`\`

\`\`\`bash
# Find which directories an app writes to (useful for migration)
kubectl exec <pod> -- strace -e trace=openat,open -f -p 1 2>&1 | grep "O_WRONLY\|O_RDWR\|O_CREAT" | head -20

# Or check mount points
kubectl exec <pod> -- mount | grep rw
\`\`\`

## Additional Immutability Controls

### No New Privileges

\`\`\`yaml
securityContext:
  allowPrivilegeEscalation: false   # cannot gain more privileges than started with
  # prevents: setuid binaries, sudo, su
\`\`\`

### Non-Root User

\`\`\`yaml
securityContext:
  runAsNonRoot: true    # refuses to start if image would run as root
  runAsUser: 1000       # specific UID
\`\`\`

### Drop All Capabilities

\`\`\`yaml
securityContext:
  capabilities:
    drop: ["ALL"]   # removes all Linux capabilities
    # even root (UID 0) is relatively powerless without capabilities
\`\`\`

### Seccomp Profile

\`\`\`yaml
securityContext:
  seccompProfile:
    type: RuntimeDefault    # blocks unusual syscalls used by attack tools
\`\`\`

### Complete Immutable Pod Spec

\`\`\`yaml
apiVersion: v1
kind: Pod
spec:
  automountServiceAccountToken: false
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    fsGroup: 2000
    seccompProfile:
      type: RuntimeDefault
  containers:
  - name: app
    image: myapp:1.2.3             # always pin to specific digest or tag
    securityContext:
      readOnlyRootFilesystem: true
      allowPrivilegeEscalation: false
      runAsNonRoot: true
      capabilities:
        drop: ["ALL"]
    volumeMounts:
    - name: tmp
      mountPath: /tmp
    resources:
      limits:
        cpu: "200m"
        memory: "256Mi"
      requests:
        cpu: "100m"
        memory: "128Mi"
  volumes:
  - name: tmp
    emptyDir: {}
\`\`\`

## Detecting Immutability Violations

### Using Falco

Falco can detect filesystem writes in containers that should be immutable:

\`\`\`yaml
# Falco rule to detect writes to root filesystem
- rule: Write to Non-Ephemeral Volume
  desc: Container writing to non-volume path (should be immutable)
  condition: >
    open_write and
    container and
    not fd.directory in (known_writable_dirs) and
    not proc.name in (known_good_processes)
  output: >
    Write to immutable container filesystem
    (user=%user.name container=%container.name
     file=%fd.name image=%container.image.repository)
  priority: WARNING
\`\`\`

### Using OPA/Kyverno

Enforce readOnlyRootFilesystem via policy:

\`\`\`yaml
# Kyverno policy
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-readonly-rootfs
spec:
  validationFailureAction: Enforce
  rules:
  - name: readonly-root-filesystem
    match:
      any:
      - resources:
          kinds: ["Pod"]
    validate:
      message: "Containers must have readOnlyRootFilesystem: true"
      foreach:
      - list: "request.object.spec.containers"
        deny:
          conditions:
            any:
            - key: "{{ element.securityContext.readOnlyRootFilesystem || false }}"
              operator: Equals
              value: false
\`\`\`

## Container Image Immutability

Immutability also applies to images — don't use mutable tags:

\`\`\`yaml
# MUTABLE (bad practice):
image: nginx:latest         # "latest" can change
image: nginx:1.25           # semver tag can be overwritten

# IMMUTABLE (good practice):
image: nginx@sha256:abc123def456...   # specific digest never changes

# In practice, use tag + digest:
image: nginx:1.25.3@sha256:abc123...
\`\`\`

\`\`\`bash
# Get the digest of an image
docker inspect nginx:1.25.3 | grep '"Id"'
# or
docker pull nginx:1.25.3 && docker inspect --format='{{.Id}}' nginx:1.25.3

# Get from registry
crane digest nginx:1.25.3
\`\`\`

## Testing Immutability

\`\`\`bash
# Test 1: Cannot write to root filesystem
kubectl exec <pod> -n <ns> -- sh -c "echo test > /test.txt"
# Expected: sh: /test.txt: Read-only file system

# Test 2: Cannot install packages
kubectl exec <pod> -n <ns> -- apk add curl
# Expected: ERROR: Unable to lock database (read-only filesystem)

# Test 3: Cannot drop/download tools
kubectl exec <pod> -n <ns> -- wget -O /tmp/nc nc.traditional
# Expected: depends on whether /tmp is writable (should be)
# Use different attack vectors for hardened testing

# Test 4: Cannot write to /bin (common persistence target)
kubectl exec <pod> -n <ns> -- sh -c "cp /bin/sh /bin/backdoor"
# Expected: cp: /bin/backdoor: Read-only file system

# Test 5: Can write to emptyDir (intended writable space)
kubectl exec <pod> -n <ns> -- sh -c "echo test > /tmp/test.txt && cat /tmp/test.txt"
# Expected: test
\`\`\`

## Pod Security Standards and Immutability

The **Restricted** PSS level does NOT require readOnlyRootFilesystem — it requires \`allowPrivilegeEscalation: false\` and capabilities drop. readOnlyRootFilesystem is an additional control beyond PSS.

## Common Mistakes

- **Forgetting /tmp**: Most apps write to /tmp — without an emptyDir mount, the pod crashes
- **Not checking init containers**: Init containers may need to write (e.g., configuration setup)
- **Assuming immutable = no impact**: If /tmp is writable, attackers can still download and run tools from /tmp
- **Using :latest tag**: Mutable image tags break container immutability at the image layer

## Killer.sh Style Challenge

> **Scenario**: The Deployment "backend" in namespace "api" runs as root with a writable filesystem. Configure it to: (1) use readOnlyRootFilesystem, (2) run as non-root user 1001, (3) drop all capabilities. Add an emptyDir for /tmp.
`,

  quiz: [
    {
      question: 'What does readOnlyRootFilesystem: true do in a container securityContext?',
      options: [
        'Makes the container\'s root filesystem read-only — prevents file creation, modification, or deletion',
        'Makes all volumes mounted in the container read-only',
        'Prevents containers from reading files owned by root',
        'Encrypts the container\'s filesystem at rest'
      ],
      correct: 0,
      explanation: 'readOnlyRootFilesystem: true makes the container\'s own filesystem (the image layers) read-only. The container can still read all files but cannot create, modify, or delete them. Mounted volumes (emptyDir, PVC) remain writable unless explicitly set to readOnly.',
      reference: 'Container Immutability — readOnlyRootFilesystem section.'
    },
    {
      question: 'An application with readOnlyRootFilesystem: true crashes because it cannot write to /tmp. What is the fix?',
      options: [
        'Mount an emptyDir volume at /tmp',
        'Set readOnlyRootFilesystem: false just for /tmp',
        'Use a PersistentVolumeClaim for /tmp',
        'Add WRITE capability to the container securityContext'
      ],
      correct: 0,
      explanation: 'emptyDir volumes provide temporary, writable in-memory or disk space that is scoped to the pod lifecycle. Mounting one at /tmp gives the application a writable /tmp without compromising the overall filesystem immutability.',
      reference: 'Container Immutability — Required Writable Volumes section.'
    },
    {
      question: 'Why is readOnlyRootFilesystem useful for security even if /tmp is writable?',
      options: [
        'Attackers cannot modify system binaries (/bin, /sbin, /usr/bin), preventing persistence and tool installation',
        'The container still cannot be accessed via kubectl exec',
        'The container cannot be killed by other processes',
        'Network access is automatically restricted when the filesystem is read-only'
      ],
      correct: 0,
      explanation: 'Even with writable /tmp, readOnlyRootFilesystem prevents attackers from: modifying binaries (/bin/sh, /usr/bin/python), installing packages (apt/yum), creating cron jobs (/etc/cron.d), adding SSH keys (/root/.ssh), or replacing configuration files (/etc/passwd). Persistence is much harder.',
      reference: 'Container Immutability — Core Enforcement section.'
    },
    {
      question: 'Which combination of securityContext fields provides the strongest container immutability?',
      options: [
        'readOnlyRootFilesystem: true + allowPrivilegeEscalation: false + capabilities.drop: ALL + runAsNonRoot: true',
        'readOnlyRootFilesystem: true alone',
        'runAsNonRoot: true alone',
        'capabilities.drop: ALL alone'
      ],
      correct: 0,
      explanation: 'Defense in depth requires multiple controls: readOnlyRootFilesystem prevents file modification, allowPrivilegeEscalation prevents gaining more privileges, drop ALL removes dangerous capabilities, runAsNonRoot prevents running as privileged user. Each addresses a different attack vector.',
      reference: 'Container Immutability — Complete Immutable Pod Spec section.'
    },
    {
      question: 'Why should container images use SHA256 digest instead of tags?',
      options: [
        'Tags can be overwritten — a :latest tag today might point to different content tomorrow. Digests are immutable content addresses.',
        'SHA256 digests enable faster image pulls',
        'Tags are not supported in Kubernetes 1.25+',
        'Digests enable end-to-end TLS for image pulls'
      ],
      correct: 0,
      explanation: 'Image tags are mutable references — a maintainer can push a new image with the same tag. The SHA256 digest is the cryptographic hash of the image manifest and is immutable. Using digest ensures the exact same image content is always used.',
      reference: 'Container Immutability — Container Image Immutability section.'
    },
    {
      question: 'How do you verify that a pod cannot write to its root filesystem?',
      options: [
        'kubectl exec <pod> -- touch /test.txt — should return "Read-only file system"',
        'kubectl describe pod <pod> | grep readOnly',
        'kubectl get pod <pod> -o yaml | grep readOnlyRootFilesystem',
        'kubectl auth can-i write /test.txt --in-pod <pod>'
      ],
      correct: 0,
      explanation: 'The definitive test is to try to write to the container filesystem. touch /test.txt or echo test > /test.txt should return "touch: /test.txt: Read-only file system" or similar. Checking the YAML shows the intended config but not the live behavior.',
      reference: 'Container Immutability — Testing Immutability section.'
    },
    {
      question: 'A Falco rule monitors "open_write on container filesystem". What type of attack does this detect?',
      options: [
        'Container filesystem modification — possibly an attacker installing tools or creating backdoors after container compromise',
        'Container escape to the host filesystem',
        'Pod-to-pod network attacks',
        'RBAC privilege escalation'
      ],
      correct: 0,
      explanation: 'Monitoring open_write syscalls in containers detects any attempt to write to the filesystem. This is particularly valuable for containers that should be immutable — any write is suspicious and could indicate an attacker installing tools, modifying configurations, or attempting persistence.',
      reference: 'Container Immutability — Using Falco section.'
    },
    {
      question: 'Does the Restricted Pod Security Standard require readOnlyRootFilesystem: true?',
      options: [
        'No — Restricted requires allowPrivilegeEscalation: false, drop ALL caps, runAsNonRoot, and seccomp. readOnlyRootFilesystem is additional.',
        'Yes — Restricted mandates readOnlyRootFilesystem: true',
        'Yes — all three PSS levels require read-only root filesystem',
        'It depends on the PSS version (before 1.25 it was required, after 1.25 it is not)'
      ],
      correct: 0,
      explanation: 'The Restricted Pod Security Standard does NOT require readOnlyRootFilesystem. It requires: allowPrivilegeEscalation: false, runAsNonRoot: true (or runAsUser != 0), capabilities.drop: ALL, and seccompProfile != Unconfined. readOnlyRootFilesystem is a highly recommended best practice beyond PSS.',
      reference: 'Container Immutability — Pod Security Standards section.'
    }
  ],

  flashcards: [
    {
      front: 'What is container immutability and how is it enforced?',
      back: 'Immutable container: cannot be modified after starting\n- No file writes to root filesystem\n- No new processes outside container definition\n- No persistence of changes\n\nEnforcement:\n1. readOnlyRootFilesystem: true (primary control)\n2. allowPrivilegeEscalation: false\n3. runAsNonRoot: true\n4. capabilities.drop: ["ALL"]\n5. seccompProfile: RuntimeDefault\n\nAlso: pin image to SHA256 digest (image immutability)'
    },
    {
      front: 'What writable volumes does a typical application need when readOnlyRootFilesystem: true?',
      back: 'Common writable directories:\n/tmp           → emptyDir\n/var/tmp        → emptyDir\n/var/run        → emptyDir (PID files, sockets)\n/var/log/app    → emptyDir (or use sidecar)\n/var/cache/app  → emptyDir\n/app/data       → PersistentVolumeClaim\n\nYAML:\nvolumeMounts:\n- name: tmp\n  mountPath: /tmp\nvolumes:\n- name: tmp\n  emptyDir: {}\n\nFind what an app writes:\nstrace -e trace=openat -p 1 2>&1 | grep "O_WRONLY\\|O_CREAT"'
    },
    {
      front: 'Write a fully immutable container securityContext',
      back: 'securityContext:\n  readOnlyRootFilesystem: true      # no writes to /\n  allowPrivilegeEscalation: false   # no setuid escalation\n  runAsNonRoot: true                # not root\n  runAsUser: 1000                   # specific UID\n  capabilities:\n    drop: ["ALL"]                   # no capabilities\n  seccompProfile:\n    type: RuntimeDefault            # syscall filtering\n\nAlso in pod spec:\n  automountServiceAccountToken: false  # no API access unless needed'
    },
    {
      front: 'Why use image digests instead of tags for container immutability?',
      back: 'Problem with tags:\nnginx:latest → today: v1.25, tomorrow: v1.26\nnginx:1.25 → can be overwritten in registry\n\nDigests are immutable:\nnginx@sha256:abc123def456...\n→ content-addressed, never changes\n\nGet digest:\ncrane digest nginx:1.25.3\ndocker pull nginx:1.25.3 && docker inspect --format={{.RepoDigests}} nginx:1.25.3\n\nUsage:\nimage: nginx:1.25.3@sha256:abc123...\n(both tag and digest for readability + immutability)'
    },
    {
      front: 'Does readOnlyRootFilesystem prevent attacks via /tmp?',
      back: 'No — /tmp is usually writable (via emptyDir mount).\n\nWhat readOnlyRootFilesystem DOES prevent:\n- Modifying system binaries (/bin, /usr/bin)\n- Installing packages (apt, yum, apk)\n- Writing to /etc (adding SSH keys, cron jobs)\n- Modifying startup scripts\n- Creating backdoors in PATH\n\nWhat attackers can STILL do with /tmp:\n- Download and execute scripts: wget -O /tmp/exploit && chmod +x /tmp/exploit && /tmp/exploit\n- Use as staging area\n\nMitigation: seccomp + drop ALL capabilities + network policy'
    },
    {
      front: 'How does Falco detect container filesystem modifications?',
      back: 'Falco rule example:\n- rule: Write to Container Filesystem\n  condition: >\n    open_write and\n    container and\n    not fd.directory in (/tmp, /var/tmp)\n  output: >\n    Write outside allowed dirs\n    (container=%container.name file=%fd.name)\n  priority: WARNING\n\nFalco monitors kernel syscalls:\n- open_write: file opened for writing\n- rename: file moved/renamed\n- unlink: file deleted\n\nUseful for: detecting post-exploitation activity in "immutable" containers'
    }
  ],

  lab: {
    scenario: 'A Deployment runs an application with an unrestricted container filesystem. You need to enforce immutability while keeping the application functional.',
    objective: 'Configure readOnlyRootFilesystem on a running application and add the required writable volumes without breaking the app.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Deploy a non-immutable application',
        instruction: `Create a test Deployment without immutability controls and verify the current state.

\`\`\`bash
# Deploy nginx without immutability (current state)
kubectl create deployment immutable-test --image=nginx:alpine

# Wait for the pod
kubectl wait deployment/immutable-test --for=condition=Available --timeout=60s

# Verify you can write to the filesystem (current vulnerability)
POD=$(kubectl get pods -l app=immutable-test -o jsonpath='{.items[0].metadata.name}')

# This should SUCCEED (showing the problem)
kubectl exec $POD -- touch /tmp/attacker-tool
kubectl exec $POD -- ls /tmp/
\`\`\``,
        hints: [
          'The goal is to document the current vulnerable state before fixing it',
          'Nginx writes to /var/cache/nginx, /var/run, and /var/log/nginx'
        ],
        solution: `\`\`\`bash
kubectl create deployment immutable-test --image=nginx:alpine
kubectl wait deployment/immutable-test --for=condition=Available --timeout=60s
POD=$(kubectl get pods -l app=immutable-test -o jsonpath='{.items[0].metadata.name}')
kubectl exec $POD -- touch /etc/malware && echo "Writable (VULNERABLE)" || echo "Read-only (PROTECTED)"
\`\`\``,
        verify: `\`\`\`bash
# Should show writable (the problem we're fixing)
POD=$(kubectl get pods -l app=immutable-test -o jsonpath='{.items[0].metadata.name}')
kubectl exec $POD -- sh -c "echo test > /tmp/test && echo Writable" 2>&1
# Expected: Writable (we haven't fixed it yet)
\`\`\``
      },
      {
        title: 'Add readOnlyRootFilesystem with required volumes',
        instruction: `Update the Deployment to be immutable with emptyDir volumes for required writable directories.

\`\`\`yaml
# Update the deployment
cat <<'EOF' | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: immutable-test
spec:
  replicas: 1
  selector:
    matchLabels:
      app: immutable-test
  template:
    metadata:
      labels:
        app: immutable-test
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 101
        fsGroup: 101
        seccompProfile:
          type: RuntimeDefault
      containers:
      - name: nginx
        image: nginx:alpine
        securityContext:
          readOnlyRootFilesystem: true
          allowPrivilegeEscalation: false
          capabilities:
            drop: ["ALL"]
        volumeMounts:
        - name: cache
          mountPath: /var/cache/nginx
        - name: run
          mountPath: /var/run
        - name: tmp
          mountPath: /tmp
      volumes:
      - name: cache
        emptyDir: {}
      - name: run
        emptyDir: {}
      - name: tmp
        emptyDir: {}
EOF

kubectl rollout status deployment/immutable-test
\`\`\``,
        hints: [
          'nginx:alpine runs as root by default — use runAsUser: 101 (the nginx user in alpine)',
          'nginx needs /var/cache/nginx, /var/run (for PID file), and /tmp',
          'If nginx fails to start, check logs: kubectl logs -l app=immutable-test'
        ],
        solution: `\`\`\`bash
kubectl rollout status deployment/immutable-test --timeout=60s
\`\`\``,
        verify: `\`\`\`bash
# Pod should be running
kubectl get pods -l app=immutable-test
# Expected: Running 1/1

# Root filesystem should now be read-only
POD=$(kubectl get pods -l app=immutable-test -o jsonpath='{.items[0].metadata.name}')

kubectl exec $POD -- touch /etc/malware 2>&1
# Expected: touch: /etc/malware: Read-only file system

kubectl exec $POD -- touch /tmp/allowed 2>&1
# Expected: success (tmp is writable via emptyDir)

# Verify securityContext is set
kubectl get pod $POD -o yaml | grep readOnlyRootFilesystem
# Expected: readOnlyRootFilesystem: true
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Pod crashes immediately after adding readOnlyRootFilesystem',
      difficulty: 'medium',
      symptom: 'After setting readOnlyRootFilesystem: true on a working deployment, all pods crash with "Read-only file system" errors.',
      diagnosis: `\`\`\`bash
# Get the error from logs
kubectl logs <pod-name> | head -20

# Check what path is failing
kubectl logs <pod-name> | grep -i "read-only\|EROFS\|permission"

# Common failing paths by app type:
# nginx: /var/cache/nginx, /var/run, /var/log/nginx
# redis: /data, /var/run/redis
# java apps: /tmp (JVM writes temp files here)
# node.js: /tmp, sometimes .npm cache

# Identify writable paths needed by the app
kubectl exec <pod> -- mount | grep rw    # check current mounts
kubectl exec <pod> -- df -h             # disk usage
\`\`\``,
      solution: `**Add emptyDir volume mounts for each path that needs to be writable.**

Common paths per application type:

\`\`\`yaml
# nginx
volumes:
- name: cache
  emptyDir: {}
- name: run
  emptyDir: {}
volumeMounts:
- mountPath: /var/cache/nginx
  name: cache
- mountPath: /var/run
  name: run

# java/tomcat
volumes:
- name: tmp
  emptyDir: {}
- name: work
  emptyDir: {}
volumeMounts:
- mountPath: /tmp
  name: tmp
- mountPath: /usr/local/tomcat/work
  name: work

# General rule: run the app normally first, find all write operations:
kubectl exec <running-pod> -- strace -e trace=openat -p 1 2>&1 | grep O_WRONLY | awk '{print $NF}' | sort -u
\`\`\``
    },
    {
      title: 'Application works but security team finds write operations in /tmp via Falco',
      difficulty: 'medium',
      symptom: 'readOnlyRootFilesystem: true is set, but Falco alerts show the container writing to /tmp, which is suspicious.',
      diagnosis: `\`\`\`bash
# Check what is being written to /tmp
kubectl exec <pod> -- ls -la /tmp/

# Check if /tmp has emptyDir mount (explains why writes succeed)
kubectl get pod <pod> -o yaml | grep -A5 "mountPath: /tmp"

# Check the Falco alert details
# The write to /tmp is ALLOWED (emptyDir) but may indicate attack if unexpected
# - Expected: app writes log files, temp processing files
# - Suspicious: executable files, wget downloads, scripts
kubectl exec <pod> -- ls -la /tmp/ | grep -E "^-.*x\|script\|\.sh\|wget\|curl"
\`\`\``,
      solution: `**/tmp is writable via emptyDir — this is by design. The question is what is being written.**

**If legitimate app writes:**
- Add Falco exception for known good paths/processes
\`\`\`yaml
- rule: Write to Container Filesystem
  exceptions:
  - name: allowed_writes
    comps: [=]
    fields: [proc.name, fd.directory]
    values:
    - [myapp, /tmp]
\`\`\`

**If suspicious (unexpected executable or download):**
- This is an active attack — investigate immediately
\`\`\`bash
# Check process that wrote the file
kubectl exec <pod> -- ls -la /tmp/
# If it's an executable: INCIDENT RESPONSE - container may be compromised

# Preventive: restrict /tmp with noexec mount
volumes:
- name: tmp
  emptyDir:
    medium: Memory  # uses tmpfs with noexec in some runtimes
\`\`\``
    }
  ]
};
