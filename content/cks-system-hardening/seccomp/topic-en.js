window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['cks-system-hardening/seccomp'] = {
  theory: `# Seccomp Profiles in Kubernetes

## Exam Relevance
> Seccomp appears in the CKS exam under "System Hardening" (~15% weight). Questions focus on applying seccomp profiles to pods, understanding profile types (RuntimeDefault, Localhost, Unconfined), and knowing that PSS Restricted level requires a non-Unconfined profile. Expect practical tasks involving securityContext.seccompProfile.

## Core Concepts

### What is Seccomp?
**Seccomp** (Secure Computing Mode) is a Linux kernel feature that restricts which system calls a process can make. Since containers are ultimately Linux processes, seccomp is one of the most effective ways to reduce a container's attack surface.

\`\`\`
Application code
      ↓ function calls
C library (glibc)
      ↓ system calls (syscall numbers)
Kernel seccomp filter  ← SECCOMP POLICY EVALUATED HERE
      ↓ allow/deny/trace
Linux kernel
\`\`\`

Without seccomp: a container can make ~300+ system calls, many of which could be used for kernel exploits.
With seccomp: only approved syscalls pass through — kernel attack surface reduced ~80-90%.

---

## Profile Types

### 1. Unconfined (default for most containers)
\`\`\`yaml
securityContext:
  seccompProfile:
    type: Unconfined
\`\`\`
- No restriction — all syscalls allowed
- Historical default before K8s 1.27
- **Fails PSS Restricted** level
- Used when you explicitly don't want seccomp (rare, avoid in production)

### 2. RuntimeDefault
\`\`\`yaml
securityContext:
  seccompProfile:
    type: RuntimeDefault
\`\`\`
- Uses the container runtime's built-in default profile
- containerd: uses a bundled profile blocking ~50 dangerous syscalls
- Docker: uses the Docker default profile
- **Good balance**: safe for most workloads, blocks obviously dangerous syscalls
- **Satisfies PSS Restricted** requirement
- Recommended starting point for most applications

### 3. Localhost (custom profile)
\`\`\`yaml
securityContext:
  seccompProfile:
    type: Localhost
    localhostProfile: profiles/my-app.json
\`\`\`
- Uses a custom JSON profile stored on the node
- Path is relative to **kubelet's seccomp root**: \`/var/lib/kubelet/seccomp/\`
- So \`profiles/my-app.json\` → \`/var/lib/kubelet/seccomp/profiles/my-app.json\`
- Most restrictive option — allow only exactly what your app needs

---

## Custom Profile Format (JSON)

### Structure

\`\`\`json
{
  "defaultAction": "SCMP_ACT_ERRNO",
  "architectures": ["SCMP_ARCH_X86_64", "SCMP_ARCH_X86", "SCMP_ARCH_X32"],
  "syscalls": [
    {
      "names": ["accept4", "bind", "connect", "listen", "socket"],
      "action": "SCMP_ACT_ALLOW"
    },
    {
      "names": ["ptrace"],
      "action": "SCMP_ACT_ERRNO",
      "errnoRet": 1
    }
  ]
}
\`\`\`

### Actions

| Action | Meaning |
|--------|---------|
| \`SCMP_ACT_ALLOW\` | Allow the syscall |
| \`SCMP_ACT_ERRNO\` | Return error (EPERM by default) |
| \`SCMP_ACT_KILL\` | Kill the process immediately |
| \`SCMP_ACT_LOG\` | Log and allow (useful for auditing) |
| \`SCMP_ACT_TRACE\` | Notify tracer (strace-like monitoring) |
| \`SCMP_ACT_KILL_PROCESS\` | Kill process (not just thread) |

### Profile Approach: Allowlist vs Denylist

**Allowlist (recommended)**: deny everything by default, allow known-good
\`\`\`json
{
  "defaultAction": "SCMP_ACT_ERRNO",  // deny all
  "syscalls": [
    { "names": ["read", "write", "open", ...], "action": "SCMP_ACT_ALLOW" }
  ]
}
\`\`\`

**Denylist** (easier but weaker): allow everything, block known-bad
\`\`\`json
{
  "defaultAction": "SCMP_ACT_ALLOW",  // allow all
  "syscalls": [
    { "names": ["ptrace", "mount", "reboot", ...], "action": "SCMP_ACT_ERRNO" }
  ]
}
\`\`\`

---

## Applying Seccomp in Kubernetes

### Pod-level (applies to all containers)
\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: secure-app
spec:
  securityContext:
    seccompProfile:
      type: RuntimeDefault     # or Localhost with localhostProfile
  containers:
  - name: app
    image: nginx:alpine
\`\`\`

### Container-level (overrides pod-level)
\`\`\`yaml
spec:
  containers:
  - name: app
    image: myapp:1.0
    securityContext:
      seccompProfile:
        type: Localhost
        localhostProfile: profiles/myapp-restricted.json
  - name: sidecar
    image: fluentd:latest
    securityContext:
      seccompProfile:
        type: RuntimeDefault
\`\`\`

### Annotation (deprecated, pre-K8s 1.19)
\`\`\`yaml
# Old method — avoid in new deployments
metadata:
  annotations:
    seccomp.security.alpha.kubernetes.io/pod: runtime/default
    container.seccomp.security.alpha.kubernetes.io/mycontainer: localhost/profiles/myapp.json
\`\`\`

---

## Node Configuration

### Profile File Locations

\`\`\`bash
# Default seccomp profile directory
/var/lib/kubelet/seccomp/

# Create subdirectory for profiles
mkdir -p /var/lib/kubelet/seccomp/profiles/

# Copy custom profile to node
scp myapp-seccomp.json worker-01:/var/lib/kubelet/seccomp/profiles/

# Verify location
ls /var/lib/kubelet/seccomp/profiles/
\`\`\`

### Multi-node Deployment
In production, profiles must be on EVERY node where the pod might schedule:
\`\`\`bash
# Copy profile to all nodes using a loop
for node in worker-01 worker-02 worker-03; do
  scp myapp-seccomp.json $node:/var/lib/kubelet/seccomp/profiles/
done

# Or use a DaemonSet to distribute profiles
# Or use a Node provisioning tool (Ansible, cloud-init)
\`\`\`

---

## Generating Custom Profiles

### Using strace
\`\`\`bash
# Capture all syscalls made by a process
strace -c -f -S name your-binary 2>&1 | tail -30

# Example: capture nginx syscalls
docker run --rm --security-opt seccomp=unconfined \\
  strace -c -f -S name nginx -g "daemon off;" 2>&1

# Output: syscall counts, use to build allowlist
\`\`\`

### Using Falco for Discovery
\`\`\`bash
# Use Falco to log all syscalls and generate profile
# Configure Falco rule to capture syscalls
# Then use falco-to-seccomp tool or review logs
\`\`\`

### Testing a Profile
\`\`\`bash
# Run container with audit mode (LOG, not kill)
docker run --rm \\
  --security-opt seccomp:profile-audit.json \\
  myapp:latest

# profile-audit.json has defaultAction: SCMP_ACT_LOG
# Then check /proc/sys/kernel/printk_devkmsg or audit log
\`\`\`

---

## PSS and Seccomp

The **Pod Security Standards** Restricted level requires:
\`\`\`yaml
# Must have seccompProfile — type cannot be Unconfined
securityContext:
  seccompProfile:
    type: RuntimeDefault  # OR Localhost — both satisfy Restricted
# type: Unconfined would fail PSS Restricted
\`\`\`

\`\`\`bash
# Applying PSS Restricted to namespace
kubectl label namespace production \\
  pod-security.kubernetes.io/enforce=restricted

# Pods without seccompProfile or with Unconfined will be REJECTED
\`\`\`

---

## Seccomp vs AppArmor vs Falco

| Tool | Layer | Mechanism | Blocks |
|------|-------|-----------|--------|
| **Seccomp** | Kernel | Syscall filtering | Syscall-level attacks |
| **AppArmor** | OS | MAC (file/cap/net) | File access, capabilities |
| **Falco** | Runtime | eBPF monitoring | Detects (doesn't block) |

**Best practice**: Use seccomp + AppArmor together — they complement each other (seccomp for syscalls, AppArmor for file/network paths).

---

## Common Mistakes

1. **Applying profile only at pod level** — container-level overrides pod-level
2. **Profile not on the node** — Localhost type fails silently if file missing (pod won't start)
3. **Using Unconfined in PSS Restricted namespace** — pod rejected with validation error
4. **Testing allowlist profile without audit mode first** — may kill legitimate processes
5. **Not testing after updates** — new app versions may need different syscalls
6. **Forgetting architectures field** — 32-bit vs 64-bit syscall numbers differ

---

## Killer.sh Style Challenge

**Scenario**: Configure a pod \`secure-nginx\` in namespace \`production\` with:
1. Pod-level \`RuntimeDefault\` seccomp profile
2. A second pod \`restricted-app\` using a custom Localhost profile at \`profiles/app-minimal.json\`
3. Verify the namespace has PSS Restricted enforced and both pods comply

**Solution**:
\`\`\`bash
# Step 1: Label namespace
kubectl label namespace production \\
  pod-security.kubernetes.io/enforce=restricted \\
  pod-security.kubernetes.io/enforce-version=latest

# Step 2: Create secure-nginx
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: secure-nginx
  namespace: production
spec:
  securityContext:
    seccompProfile:
      type: RuntimeDefault
    runAsNonRoot: true
    runAsUser: 1000
  containers:
  - name: nginx
    image: nginx:alpine
    securityContext:
      allowPrivilegeEscalation: false
      capabilities:
        drop: ["ALL"]
      readOnlyRootFilesystem: true
EOF

# Step 3: Create custom profile on node first
# (copy profiles/app-minimal.json to /var/lib/kubelet/seccomp/profiles/ on each node)

# Step 4: Create restricted-app
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: restricted-app
  namespace: production
spec:
  securityContext:
    seccompProfile:
      type: Localhost
      localhostProfile: profiles/app-minimal.json
    runAsNonRoot: true
  containers:
  - name: app
    image: myapp:1.0
    securityContext:
      allowPrivilegeEscalation: false
      capabilities:
        drop: ["ALL"]
EOF
\`\`\`
`,
  quiz: [
    {
      question: 'Where does Kubernetes look for Localhost seccomp profiles on a node?',
      options: [
        '/etc/seccomp/profiles/',
        '/var/lib/kubelet/seccomp/',
        '/etc/kubernetes/seccomp/',
        '/proc/sys/kernel/seccomp/'
      ],
      correct: 1,
      explanation: 'Kubernetes stores Localhost seccomp profiles in /var/lib/kubelet/seccomp/ on each node. The localhostProfile field in the Pod spec is a relative path from this directory. For example, localhostProfile: "profiles/myapp.json" maps to /var/lib/kubelet/seccomp/profiles/myapp.json.',
      reference: 'Node Configuration — see "Profile File Locations" section'
    },
    {
      question: 'A pod is deployed in a namespace with Pod Security Standards "Restricted" enforced. The pod has seccompProfile.type: Unconfined. What happens?',
      options: [
        'The pod starts but logs a warning',
        'The pod starts with RuntimeDefault applied instead',
        'The pod is rejected by the admission controller',
        'The pod starts and seccomp is disabled for it'
      ],
      correct: 2,
      explanation: 'PSS Restricted requires a non-Unconfined seccomp profile. Using type: Unconfined violates the Restricted policy and the admission controller rejects the pod creation. Valid types for Restricted are RuntimeDefault or Localhost.',
      reference: 'PSS and Seccomp — see policy requirement in theory'
    },
    {
      question: 'What is the "defaultAction" field in a custom seccomp JSON profile?',
      options: [
        'The action applied to all syscalls not listed in the syscalls array',
        'The action taken when the profile file is not found',
        'The fallback profile to use if this one fails to load',
        'The default logging level for blocked syscalls'
      ],
      correct: 0,
      explanation: 'defaultAction defines what happens to any syscall NOT explicitly listed in the syscalls array. For an allowlist profile, set defaultAction: SCMP_ACT_ERRNO (deny all, allow listed). For a denylist profile, set defaultAction: SCMP_ACT_ALLOW (allow all, deny listed).',
      reference: 'Custom Profile Format — see "Profile Approach" section'
    },
    {
      question: 'Which seccomp profile type uses the container runtime\'s built-in default profile and satisfies PSS Restricted?',
      options: [
        'Unconfined',
        'Default',
        'RuntimeDefault',
        'ContainerRuntime'
      ],
      correct: 2,
      explanation: 'RuntimeDefault uses the container runtime\'s (containerd, CRI-O) built-in default seccomp profile. It blocks ~50 dangerous syscalls while allowing those needed by most applications. It satisfies PSS Restricted requirements and is the recommended starting point.',
      reference: 'Profile Types — see "RuntimeDefault" section'
    },
    {
      question: 'In a seccomp profile, which action kills the process immediately when a blocked syscall is attempted?',
      options: [
        'SCMP_ACT_ERRNO',
        'SCMP_ACT_KILL',
        'SCMP_ACT_DENY',
        'SCMP_ACT_TERMINATE'
      ],
      correct: 1,
      explanation: 'SCMP_ACT_KILL kills the process (the thread) immediately when a blocked syscall is attempted. SCMP_ACT_KILL_PROCESS kills the entire process. SCMP_ACT_ERRNO returns an error code (usually EPERM) which is gentler and allows the process to handle the error.',
      reference: 'Custom Profile Format — see "Actions" table'
    },
    {
      question: 'A pod with seccompProfile.type: Localhost fails to start with "cannot load seccomp profile". What is the most likely cause?',
      options: [
        'The kubelet needs to be restarted',
        'The profile JSON file has a syntax error',
        'The profile file does not exist on the scheduled node',
        'Localhost profiles require a special kubelet flag'
      ],
      correct: 2,
      explanation: 'Localhost seccomp profiles must exist on every node where the pod might be scheduled at /var/lib/kubelet/seccomp/<localhostProfile>. If the file is missing on the node, the pod fails to start. In multi-node clusters, you must copy profiles to all nodes.',
      reference: 'Node Configuration — see "Multi-node Deployment" section'
    },
    {
      question: 'What tool can you use to discover which syscalls an application makes, in order to build a minimal seccomp allowlist?',
      options: [
        'netstat',
        'strace',
        'lsof',
        'tcpdump'
      ],
      correct: 1,
      explanation: 'strace traces system calls made by a process. Using strace -c (count mode) provides a summary of all syscalls used. This output can be used to build a minimal allowlist seccomp profile that permits only the syscalls the application actually needs.',
      reference: 'Generating Custom Profiles — see "Using strace" section'
    },
    {
      question: 'Where is seccomp filtering applied in the Linux stack?',
      options: [
        'At the container runtime level, before the kernel',
        'At the network layer, filtering system calls over the network',
        'At the kernel level, evaluating syscalls before they execute',
        'At the userspace library level (glibc)'
      ],
      correct: 2,
      explanation: 'Seccomp filters are enforced by the Linux kernel itself. When a process makes a syscall, the kernel evaluates the seccomp BPF filter before executing the syscall. This makes seccomp very effective — it cannot be bypassed by the containerized process.',
      reference: 'Core Concepts — see syscall diagram in theory'
    }
  ],
  flashcards: [
    {
      front: 'What are the 3 seccomp profile types in Kubernetes?',
      back: '1. Unconfined — no restrictions, all syscalls allowed (default, weak)\n2. RuntimeDefault — container runtime\'s built-in profile (recommended, satisfies PSS Restricted)\n3. Localhost — custom JSON profile from /var/lib/kubelet/seccomp/<path> (most restrictive)'
    },
    {
      front: 'Where are Localhost seccomp profile files stored on Kubernetes nodes?',
      back: '/var/lib/kubelet/seccomp/\n\nExample: localhostProfile: "profiles/myapp.json"\n→ maps to: /var/lib/kubelet/seccomp/profiles/myapp.json\n\nFiles must exist on EVERY node where the pod may schedule.'
    },
    {
      front: 'What is the seccomp profile requirement for PSS Restricted?',
      back: 'PSS Restricted requires seccompProfile.type to be either:\n- RuntimeDefault\n- Localhost\n\ntype: Unconfined is NOT allowed and causes pod rejection.\nThe seccompProfile field is mandatory — omitting it also fails.'
    },
    {
      front: 'What does SCMP_ACT_ERRNO vs SCMP_ACT_KILL do in a seccomp profile?',
      back: 'SCMP_ACT_ERRNO: Returns an error code (usually EPERM) to the process. Process can catch and handle the error. Gentler — application keeps running.\n\nSCMP_ACT_KILL: Kills the thread immediately. No chance to handle the error. Use for truly dangerous syscalls.'
    },
    {
      front: 'What is the allowlist vs denylist approach for seccomp defaultAction?',
      back: 'Allowlist (recommended): defaultAction: SCMP_ACT_ERRNO + list allowed syscalls\n→ deny everything, permit only known-good\n\nDenylist: defaultAction: SCMP_ACT_ALLOW + list blocked syscalls\n→ allow everything, block known-bad\n\nAllowlist is more secure but requires knowing all needed syscalls.'
    },
    {
      front: 'How does seccomp complement AppArmor?',
      back: 'Seccomp: filters by SYSCALL number — blocks ptrace, mount, reboot, etc.\nAppArmor: filters by FILE PATH, NETWORK, CAPABILITIES — blocks /etc/shadow reads, cap_sys_admin\n\nThey work at different levels and complement each other.\nBest practice: use both simultaneously for defense-in-depth.'
    },
    {
      front: 'What kubectl field applies a RuntimeDefault seccomp profile to all containers in a pod?',
      back: 'spec.securityContext.seccompProfile:\n  type: RuntimeDefault\n\nThis applies at pod level (all containers). To override for specific containers:\nspec.containers[].securityContext.seccompProfile:\n  type: Localhost\n  localhostProfile: profiles/special.json'
    }
  ],
  lab: {
    scenario: 'A security audit found that all pods in the production namespace are running without seccomp profiles (Unconfined). You need to apply appropriate seccomp profiles to reduce the attack surface and ensure compliance with Pod Security Standards Restricted level.',
    objective: 'Apply RuntimeDefault and custom Localhost seccomp profiles to Kubernetes pods, and verify compliance with PSS Restricted.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Inspect Current Seccomp State',
        instruction: `Check whether existing pods have seccomp profiles configured, and inspect the system's seccomp capabilities.`,
        hints: [
          'Use kubectl get pod -o yaml to check securityContext',
          'grep for seccompProfile in pod spec',
          'Check if /var/lib/kubelet/seccomp/ directory exists'
        ],
        solution: `\`\`\`bash
# Check if seccomp is supported on this node
ls /var/lib/kubelet/seccomp/ 2>/dev/null && echo "Seccomp dir exists" || echo "Seccomp dir not found"

# Check existing pods for seccomp profiles
kubectl get pods -A -o json | \\
  jq -r '.items[] |
    .metadata.namespace + "/" + .metadata.name + ": " +
    ((.spec.securityContext.seccompProfile.type) // "UNCONFINED/NOT SET")'

# Check a specific pod
kubectl get pod <pod-name> -o jsonpath='{.spec.securityContext.seccompProfile}'

# Check what RuntimeDefault the runtime provides
# (for containerd)
cat /etc/containerd/config.toml | grep -A5 seccomp 2>/dev/null || echo "Check containerd config manually"
\`\`\``,
        verify: `\`\`\`bash
# Verify seccomp directory
ls -la /var/lib/kubelet/seccomp/
# Expected: directory exists (may be empty if no custom profiles yet)

# Check at least one existing pod
kubectl get pods -n default -o yaml | grep -A3 seccompProfile || echo "No seccompProfile found - needs to be added"
\`\`\``
      },
      {
        title: 'Apply RuntimeDefault to a Pod',
        instruction: `Create a pod with RuntimeDefault seccomp profile. This is the recommended starting point for most workloads.`,
        hints: [
          'Set seccompProfile under spec.securityContext (pod level)',
          'RuntimeDefault does not need a localhostProfile path',
          'Combine with other security context settings for PSS Restricted compliance'
        ],
        solution: `\`\`\`bash
# Create a namespace for testing
kubectl create namespace seccomp-test 2>/dev/null || true

# Create a pod with RuntimeDefault seccomp
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: runtime-default-pod
  namespace: seccomp-test
spec:
  securityContext:
    seccompProfile:
      type: RuntimeDefault
    runAsNonRoot: true
    runAsUser: 1000
  containers:
  - name: app
    image: alpine:3.18
    command: ["sleep", "3600"]
    securityContext:
      allowPrivilegeEscalation: false
      capabilities:
        drop:
        - ALL
      readOnlyRootFilesystem: true
EOF

# Wait for pod
kubectl wait --for=condition=Ready pod/runtime-default-pod -n seccomp-test --timeout=60s
\`\`\``,
        verify: `\`\`\`bash
# Verify pod is running
kubectl get pod runtime-default-pod -n seccomp-test
# Expected: STATUS = Running

# Verify seccomp profile is set
kubectl get pod runtime-default-pod -n seccomp-test \\
  -o jsonpath='{.spec.securityContext.seccompProfile}'
# Expected: {"type":"RuntimeDefault"}

# Verify pod is functional (can exec)
kubectl exec runtime-default-pod -n seccomp-test -- id
# Expected: uid=1000 gid=1000 groups=1000

# Verify restricted syscalls are blocked (ptrace should fail)
kubectl exec runtime-default-pod -n seccomp-test -- sh -c 'cat /proc/1/status | grep Seccomp'
# Expected: Seccomp: 2 (mode 2 = BPF filter active)
\`\`\``
      },
      {
        title: 'Create and Apply a Custom Localhost Profile',
        instruction: `Create a minimal custom seccomp profile and apply it to a pod using the Localhost type.`,
        hints: [
          'Profile goes in /var/lib/kubelet/seccomp/ on the node',
          'Use SCMP_ACT_LOG as defaultAction while testing',
          'localhostProfile is relative to /var/lib/kubelet/seccomp/'
        ],
        solution: `\`\`\`bash
# Create the seccomp profiles directory on the node
# If running locally (single-node or minikube):
sudo mkdir -p /var/lib/kubelet/seccomp/profiles

# Create a minimal audit-mode profile (LOG, don't block)
sudo tee /var/lib/kubelet/seccomp/profiles/audit.json > /dev/null <<'EOF'
{
  "defaultAction": "SCMP_ACT_LOG",
  "architectures": [
    "SCMP_ARCH_X86_64",
    "SCMP_ARCH_X86",
    "SCMP_ARCH_X32"
  ],
  "syscalls": [
    {
      "names": [
        "read", "write", "open", "close", "stat", "fstat",
        "mmap", "mprotect", "munmap", "brk", "rt_sigaction",
        "rt_sigprocmask", "ioctl", "access", "pipe", "select",
        "sched_yield", "mremap", "msync", "mincore", "madvise",
        "dup", "dup2", "nanosleep", "getitimer", "alarm",
        "setitimer", "getpid", "sendfile", "socket", "connect",
        "accept", "sendto", "recvfrom", "sendmsg", "recvmsg",
        "shutdown", "bind", "listen", "getsockname", "getpeername",
        "socketpair", "getsockopt", "setsockopt", "execve", "wait4",
        "kill", "uname", "fcntl", "flock", "fsync", "fdatasync",
        "truncate", "ftruncate", "getdents", "getcwd", "chdir",
        "rename", "mkdir", "rmdir", "creat", "link", "unlink",
        "symlink", "readlink", "chmod", "fchmod", "chown", "lchown",
        "umask", "gettimeofday", "getrlimit", "getrusage",
        "sysinfo", "times", "ptrace", "getuid", "syslog",
        "getgid", "setuid", "setgid", "geteuid", "getegid",
        "setpgid", "getppid", "getpgrp", "setsid", "setreuid",
        "setregid", "getgroups", "setgroups", "setresuid",
        "getresuid", "setresgid", "getresgid", "getpgid",
        "setfsuid", "setfsgid", "getsid", "capget", "capset",
        "rt_sigpending", "rt_sigtimedwait", "rt_sigqueueinfo",
        "rt_sigsuspend", "sigaltstack", "utime", "mknod",
        "uselib", "personality", "ustat", "statfs", "fstatfs",
        "sysfs", "getpriority", "setpriority", "sched_setparam",
        "sched_getparam", "sched_setscheduler", "sched_getscheduler",
        "sched_get_priority_max", "sched_get_priority_min",
        "sched_rr_get_interval", "mlock", "munlock", "mlockall",
        "munlockall", "vhangup", "modify_ldt", "pivot_root",
        "prctl", "arch_prctl", "setrlimit", "sync", "acct",
        "settimeofday", "chroot", "gettid", "readahead",
        "setxattr", "lsetxattr", "fsetxattr", "getxattr",
        "lgetxattr", "fgetxattr", "listxattr", "llistxattr",
        "flistxattr", "removexattr", "lremovexattr", "fremovexattr",
        "tkill", "futex", "sched_setaffinity", "sched_getaffinity",
        "set_thread_area", "io_setup", "io_destroy", "io_getevents",
        "io_submit", "io_cancel", "get_thread_area", "lookup_dcookie",
        "epoll_create", "epoll_wait", "epoll_ctl", "tgkill",
        "fadvise64", "timer_create", "timer_settime", "timer_gettime",
        "timer_getoverrun", "timer_delete", "clock_settime",
        "clock_gettime", "clock_getres", "clock_nanosleep",
        "exit_group", "epoll_pwait", "utimensat", "signalfd",
        "timerfd_create", "eventfd", "fallocate", "timerfd_settime",
        "timerfd_gettimerfd_gettime", "accept4", "signalfd4",
        "eventfd2", "epoll_create1", "dup3", "pipe2",
        "inotify_init1", "preadv", "pwritev", "recvmmsg",
        "fanotify_init", "fanotify_mark", "prlimit64",
        "name_to_handle_at", "open_by_handle_at", "clock_adjtime",
        "syncfs", "sendmmsg", "setns", "getcpu", "process_vm_readv",
        "process_vm_writev", "finit_module", "sched_setattr",
        "sched_getattr", "renameat2", "seccomp", "getrandom",
        "memfd_create", "bpf", "execveat", "userfaultfd",
        "membarrier", "mlock2", "copy_file_range", "preadv2",
        "pwritev2", "statx", "openat", "newfstatat", "openat2",
        "clone", "fork", "vfork", "waitpid", "exit",
        "lstat", "unlinkat", "mkdirat", "fchmodat",
        "fchownat", "linkat", "symlinkat", "readlinkat",
        "renameat", "getdents64", "set_tid_address",
        "restart_syscall", "set_robust_list", "get_robust_list",
        "splice", "tee", "sync_file_range", "vmsplice",
        "move_pages", "utimensat", "epoll_pwait", "signalfd",
        "inotify_init", "inotify_add_watch", "inotify_rm_watch",
        "openat", "mkdirat", "fstatat64", "unlinkat", "renameat",
        "linkat", "symlinkat", "readlinkat", "fchmodat",
        "faccessat", "pselect6", "ppoll", "unshare",
        "splice", "tee", "vmsplice", "move_pages"
      ],
      "action": "SCMP_ACT_ALLOW"
    }
  ]
}
EOF

# Create pod using the custom profile
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: localhost-profile-pod
  namespace: seccomp-test
spec:
  securityContext:
    seccompProfile:
      type: Localhost
      localhostProfile: profiles/audit.json
    runAsNonRoot: true
    runAsUser: 1000
  containers:
  - name: app
    image: alpine:3.18
    command: ["sleep", "3600"]
    securityContext:
      allowPrivilegeEscalation: false
      capabilities:
        drop:
        - ALL
EOF

kubectl wait --for=condition=Ready pod/localhost-profile-pod -n seccomp-test --timeout=60s
\`\`\``,
        verify: `\`\`\`bash
# Verify profile file exists on node
ls -la /var/lib/kubelet/seccomp/profiles/audit.json
# Expected: file exists

# Verify pod is running with Localhost profile
kubectl get pod localhost-profile-pod -n seccomp-test \\
  -o jsonpath='{.spec.securityContext.seccompProfile}'
# Expected: {"localhostProfile":"profiles/audit.json","type":"Localhost"}

# Verify seccomp is active in the container
kubectl exec localhost-profile-pod -n seccomp-test -- \\
  cat /proc/1/status | grep Seccomp
# Expected: Seccomp: 2

# Pod should be running
kubectl get pod localhost-profile-pod -n seccomp-test
# Expected: STATUS = Running
\`\`\``
      },
      {
        title: 'Enforce PSS Restricted and Verify Compliance',
        instruction: `Label the namespace with PSS Restricted enforcement and verify that pods without a valid seccomp profile are rejected.`,
        hints: [
          'PSS Restricted requires seccompProfile type != Unconfined',
          'Use pod-security.kubernetes.io/enforce=restricted label',
          'Existing pods are not evicted — only new pod creation is affected'
        ],
        solution: `\`\`\`bash
# Label namespace for PSS Restricted enforcement
kubectl label namespace seccomp-test \\
  pod-security.kubernetes.io/enforce=restricted \\
  pod-security.kubernetes.io/enforce-version=latest \\
  pod-security.kubernetes.io/warn=restricted \\
  pod-security.kubernetes.io/warn-version=latest

# Verify label was applied
kubectl get namespace seccomp-test --show-labels

# Try to create a non-compliant pod (should be rejected)
kubectl apply -f - <<EOF 2>&1 || echo "Pod rejected as expected"
apiVersion: v1
kind: Pod
metadata:
  name: unconfined-pod
  namespace: seccomp-test
spec:
  containers:
  - name: app
    image: alpine:3.18
    command: ["sleep", "3600"]
EOF

# Create a compliant pod (should succeed)
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: compliant-pod
  namespace: seccomp-test
spec:
  securityContext:
    seccompProfile:
      type: RuntimeDefault
    runAsNonRoot: true
    runAsUser: 1000
  containers:
  - name: app
    image: alpine:3.18
    command: ["sleep", "3600"]
    securityContext:
      allowPrivilegeEscalation: false
      capabilities:
        drop:
        - ALL
      readOnlyRootFilesystem: true
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verify namespace labels
kubectl get namespace seccomp-test -o jsonpath='{.metadata.labels}' | python3 -m json.tool
# Expected: pod-security.kubernetes.io/enforce: restricted

# Verify compliant pod is running
kubectl get pod compliant-pod -n seccomp-test
# Expected: STATUS = Running

# Verify non-compliant pod does NOT exist
kubectl get pod unconfined-pod -n seccomp-test 2>&1
# Expected: Error "not found" OR was never created

# Summary: list all pods in namespace
kubectl get pods -n seccomp-test
# Expected: runtime-default-pod, localhost-profile-pod, compliant-pod (all Running)
# unconfined-pod should NOT be in the list
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Pod Fails to Start with "cannot load seccomp profile"',
      difficulty: 'easy',
      symptom: 'A pod with seccompProfile.type: Localhost fails to start. kubectl describe pod shows: "Error: failed to create containerd task: cannot load seccomp profile /var/lib/kubelet/seccomp/profiles/myapp.json: open /var/lib/kubelet/seccomp/profiles/myapp.json: no such file or directory".',
      diagnosis: `\`\`\`bash
# Identify which node the pod is trying to schedule on
kubectl describe pod <pod-name> | grep -E "Node:|Events:"

# SSH to that node and check for the profile file
ssh <node-name>
ls -la /var/lib/kubelet/seccomp/profiles/

# Check if the parent directory exists
ls -la /var/lib/kubelet/seccomp/

# Check the exact path specified in the pod spec
kubectl get pod <pod-name> -o jsonpath='{.spec.securityContext.seccompProfile}'
\`\`\``,
      solution: `The seccomp profile file is missing on the node.

**Fix**:
\`\`\`bash
# On the node where the pod is scheduled:
mkdir -p /var/lib/kubelet/seccomp/profiles/

# Copy the profile to the node
# From your local machine:
scp myapp.json worker-01:/var/lib/kubelet/seccomp/profiles/

# Or create it directly on the node:
cat > /var/lib/kubelet/seccomp/profiles/myapp.json << 'EOF'
{
  "defaultAction": "SCMP_ACT_ERRNO",
  "syscalls": [...]
}
EOF

# No kubelet restart needed — kubelet reads profile at pod creation time
# Simply delete and recreate the pod
kubectl delete pod <pod-name>
kubectl apply -f pod.yaml

# For multi-node clusters, ensure profile exists on ALL nodes
for node in $(kubectl get nodes -o name | cut -d/ -f2); do
  scp myapp.json $node:/var/lib/kubelet/seccomp/profiles/
done
\`\`\``
    },
    {
      title: 'Application Crashes with SIGSYS After Seccomp Profile Applied',
      difficulty: 'hard',
      symptom: 'After adding seccompProfile.type: Localhost with a custom allowlist profile, the application crashes shortly after starting with exit code 159 (SIGSYS). This means a blocked syscall was attempted.',
      diagnosis: `\`\`\`bash
# Check pod exit code and logs
kubectl describe pod <pod-name> | grep -A5 "Last State:"
# Exit Code 159 = SIGSYS = seccomp violation

# Check pod logs before crash
kubectl logs <pod-name> --previous

# Run with SCMP_ACT_LOG profile instead to see which syscalls are blocked
# Modify profile temporarily:
cat /var/lib/kubelet/seccomp/profiles/myapp.json | \\
  python3 -c "import sys,json; p=json.load(sys.stdin); p['defaultAction']='SCMP_ACT_LOG'; print(json.dumps(p, indent=2))" \\
  > /var/lib/kubelet/seccomp/profiles/myapp-debug.json

# Use debug profile on pod temporarily
# Check kernel logs after running:
dmesg | grep -i seccomp | tail -20
# Or check audit log:
ausearch -se seccomp --start today 2>/dev/null | tail -20
\`\`\``,
      solution: `The application is calling a syscall not included in the allowlist profile.

**Fix Steps**:
\`\`\`bash
# Step 1: Identify the missing syscall using audit mode profile
# Create audit version (SCMP_ACT_LOG instead of SCMP_ACT_ERRNO)
# Apply it, run the app, check logs

# Step 2: Find the syscall in kernel logs
dmesg | grep audit | grep syscall | tail -20
# Look for: audit: type=1326 ... syscall=NNN
# Convert syscall number to name:
ausyscall --dump | grep "^NNN"

# Step 3: Add missing syscall to the profile
# Edit /var/lib/kubelet/seccomp/profiles/myapp.json
# Add the syscall name to the "names" array in the SCMP_ACT_ALLOW block

# Step 4: Test iteratively
# Profile changes take effect on pod restart (no kubelet restart needed)
kubectl delete pod <pod-name>
kubectl apply -f pod.yaml

# Common missing syscalls for specific workloads:
# nginx: epoll_ctl, accept4, socket, sendfile
# Go apps: futex, clone, mmap
# Java: mprotect, munmap, clone3
# Databases: io_uring, fallocate
\`\`\`

**Pro tip**: Always start with SCMP_ACT_LOG (audit mode) before using SCMP_ACT_ERRNO (blocking mode). Iterate until no new syscalls appear in the audit log.`
    },
    {
      title: 'PSS Restricted Rejecting Pods Despite Seccomp Profile',
      difficulty: 'medium',
      symptom: 'A pod with seccompProfile.type: RuntimeDefault is still rejected by PSS Restricted with "pods violates PodSecurity restricted". The seccomp profile looks correct.',
      diagnosis: `\`\`\`bash
# Get the full admission error message
kubectl apply -f pod.yaml 2>&1

# PSS Restricted checks MULTIPLE fields — seccomp is just one
# Check all required fields:
kubectl explain pod.spec.securityContext | grep -A2 "seccompProfile\\|runAsNonRoot\\|runAsUser"
kubectl explain pod.spec.containers.securityContext | grep -A2 "allowPrivilegeEscalation\\|capabilities\\|readOnlyRootFilesystem"

# Validate your pod spec against PSS
kubectl apply --dry-run=server -f pod.yaml 2>&1
\`\`\``,
      solution: `PSS Restricted requires multiple fields, not just seccomp. Check all requirements:

**Required for PSS Restricted**:
\`\`\`yaml
spec:
  # Pod-level
  securityContext:
    seccompProfile:
      type: RuntimeDefault  # ← seccomp requirement
    runAsNonRoot: true       # ← required
    # Optional: runAsUser: 1000

  containers:
  - name: app
    securityContext:
      allowPrivilegeEscalation: false  # ← required
      capabilities:
        drop:
        - ALL                          # ← required (drop ALL)
      readOnlyRootFilesystem: true     # ← required
      # If running as specific user:
      runAsNonRoot: true               # ← can be at container level too
\`\`\`

**Common missing fields causing PSS Restricted rejection**:
- allowPrivilegeEscalation not set to false
- capabilities.drop missing ALL
- No runAsNonRoot: true
- No seccompProfile (or type: Unconfined)
- Volume types not allowed (hostPath, hostNetwork)
- Privileged: true`
    }
  ]
};
