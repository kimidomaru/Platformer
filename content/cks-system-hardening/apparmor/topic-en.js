window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['cks-system-hardening/apparmor'] = {
  theory: `# AppArmor in Kubernetes

## Exam Relevance
> CKS requires you to create AppArmor profiles, load them on nodes, and apply them to pods. Appears in System Hardening domain (~8%).

## What is AppArmor?

**AppArmor** (Application Armor) is a Linux kernel security module that restricts what programs can do by defining mandatory access control (MAC) policies. Unlike seccomp (which filters syscalls), AppArmor restricts:

- File access (read/write/execute/append)
- Network access (protocols, addresses)
- Capability use
- Signal sending

\`\`\`
Normal process: can do anything based on DAC (permissions)
AppArmor confined: can ONLY do what the profile allows
\`\`\`

## AppArmor Profile Modes

| Mode | Behavior |
|------|----------|
| **enforce** | Policy violations are blocked and logged |
| **complain** | Violations are logged but NOT blocked (good for testing) |
| **disabled** | No AppArmor protection |

## Profile Syntax

\`\`\`
# /etc/apparmor.d/docker-nginx (example)
#include <tunables/global>

profile nginx-restricted flags=(attach_disconnected) {
  #include <abstractions/base>

  # Allow read access to common directories
  /usr/share/nginx/html/ r,
  /usr/share/nginx/html/** r,

  # Allow nginx binary
  /usr/sbin/nginx mr,

  # Allow reading config
  /etc/nginx/ r,
  /etc/nginx/** r,

  # Allow writing to log directory
  /var/log/nginx/ rw,
  /var/log/nginx/** rw,

  # Allow temp files
  /var/cache/nginx/ rw,
  /var/cache/nginx/** rw,

  # Allow network: listen on 80
  network inet tcp,
  network inet6 tcp,

  # Block everything else (implicit deny)
}
\`\`\`

**Permission notation:**
- \`r\` — read
- \`w\` — write
- \`x\` — execute
- \`m\` — memory-map (mmap)
- \`a\` — append
- \`k\` — lock
- \`/path/ rw\` — applies to directory itself
- \`/path/** rw\` — applies to all files recursively

## Managing AppArmor Profiles on Nodes

\`\`\`bash
# Check if AppArmor is enabled
cat /sys/module/apparmor/parameters/enabled
# Y = enabled, N = disabled

# List loaded profiles
sudo aa-status
# Shows: N profiles in enforce mode, M profiles in complain mode

# Load a profile
sudo apparmor_parser -r -W /etc/apparmor.d/my-profile
# -r: replace existing profile (reload)
# -W: write cache for faster loading

# Load all profiles in a directory
sudo apparmor_parser -r /etc/apparmor.d/

# Unload a profile
sudo apparmor_parser -R /etc/apparmor.d/my-profile

# Set a loaded profile to complain mode
sudo aa-complain /etc/apparmor.d/my-profile

# Set a loaded profile to enforce mode
sudo aa-enforce /etc/apparmor.d/my-profile

# Check if a specific profile is loaded
sudo aa-status | grep nginx-restricted
\`\`\`

## Applying AppArmor to Kubernetes Pods

### Annotation Method (pre-1.30, still supported)

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx-apparmor
  annotations:
    # Format: container.apparmor.security.beta.kubernetes.io/<container-name>: <profile>
    container.apparmor.security.beta.kubernetes.io/nginx: localhost/nginx-restricted
spec:
  containers:
  - name: nginx
    image: nginx:alpine
\`\`\`

**Profile values:**
- \`runtime/default\` — use the container runtime's default AppArmor profile
- \`localhost/<profile-name>\` — use a profile loaded on the node
- \`unconfined\` — no AppArmor restriction

### SecurityContext Method (K8s 1.30+)

\`\`\`yaml
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: nginx
    image: nginx:alpine
    securityContext:
      appArmorProfile:
        type: Localhost
        localhostProfile: nginx-restricted    # matches loaded profile name
        # type: RuntimeDefault   (use container runtime's default)
        # type: Unconfined       (no restriction)
\`\`\`

## Step-by-Step: Apply AppArmor to a Pod

\`\`\`bash
# Step 1: Create an AppArmor profile
cat <<'EOF' | sudo tee /etc/apparmor.d/k8s-nginx-restricted
#include <tunables/global>

profile k8s-nginx-restricted flags=(attach_disconnected,mediate_deleted) {
  #include <abstractions/base>

  network inet tcp,
  network inet6 tcp,

  /usr/sbin/nginx mr,
  /etc/nginx/ r,
  /etc/nginx/** r,
  /usr/share/nginx/html/ r,
  /usr/share/nginx/html/** r,
  /var/log/nginx/ rw,
  /var/log/nginx/** rw,
  /var/cache/nginx/ rw,
  /var/cache/nginx/** rw,
  /var/run/nginx.pid rw,
  /tmp/ rw,
  /tmp/** rw,

  deny /etc/shadow r,
  deny /etc/passwd rw,
  deny /proc/** w,
}
EOF

# Step 2: Load the profile
sudo apparmor_parser -r -W /etc/apparmor.d/k8s-nginx-restricted

# Step 3: Verify it's loaded
sudo aa-status | grep k8s-nginx-restricted

# Step 4: Apply to a Pod
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: nginx-apparmor
  annotations:
    container.apparmor.security.beta.kubernetes.io/nginx: localhost/k8s-nginx-restricted
spec:
  containers:
  - name: nginx
    image: nginx:alpine
EOF

# Step 5: Verify the pod started
kubectl get pod nginx-apparmor

# Step 6: Test the restriction
kubectl exec nginx-apparmor -- cat /etc/shadow
# Expected: permission denied (AppArmor blocked it)
\`\`\`

## Generating Profiles with aa-genprof

\`\`\`bash
# Install apparmor-utils
sudo apt-get install apparmor-utils

# Generate a profile in complain mode first
sudo aa-genprof /usr/sbin/nginx

# Run the application normally, then scan for violations
sudo aa-logprof  # interactively update profile based on violations

# Check audit logs for AppArmor events
sudo grep apparmor /var/log/kern.log | head -20
sudo ausearch -m AVC --ts recent | grep apparmor
\`\`\`

## Default Container Runtime Profiles

\`\`\`bash
# Docker's default AppArmor profile is: docker-default
# It blocks many dangerous operations while allowing typical container operations

# Check if the docker-default profile is loaded
sudo aa-status | grep docker

# Use runtime/default in Kubernetes (uses the runtime's default)
annotations:
  container.apparmor.security.beta.kubernetes.io/mycontainer: runtime/default
\`\`\`

## Verification

\`\`\`bash
# Check that AppArmor is enforced on a running container
kubectl get pod nginx-apparmor -o yaml | grep apparmor

# From inside the container — AppArmor should block shadow access
kubectl exec nginx-apparmor -- cat /etc/shadow 2>&1
# Expected: cat: /etc/shadow: Permission denied

# Check system logs for AppArmor denials
sudo journalctl -k | grep "apparmor.*DENIED" | tail -10
\`\`\`

## PSS and AppArmor

In the PSS (Pod Security Standards) context:
- **Baseline**: No custom AppArmor profiles other than \`runtime/default\` or \`localhost/*\`
- **Restricted**: Does not explicitly require AppArmor but does not block it

\`\`\`yaml
# Allowed under all PSS levels:
annotations:
  container.apparmor.security.beta.kubernetes.io/app: runtime/default
  container.apparmor.security.beta.kubernetes.io/app: localhost/my-profile
  container.apparmor.security.beta.kubernetes.io/app: unconfined  # allowed in Baseline, but not Restricted

# Blocked by Baseline+:
# (none — AppArmor profiles are not restricted by PSS directly)
\`\`\`

## Common Mistakes

- **Profile not loaded on node**: The profile must be loaded with apparmor_parser BEFORE the pod is created
- **Wrong profile name**: The name in the annotation must exactly match the profile name in the file header
- **Only loading on one node**: In a multi-node cluster, the profile must be on ALL nodes where the pod might schedule
- **Not checking aa-status**: Always verify the profile is loaded before applying to a pod

## Killer.sh Style Challenge

> **Scenario**: Create an AppArmor profile that denies access to /proc and /sys, load it on the node, and apply it to the nginx pod in the "restricted" namespace.
`,

  quiz: [
    {
      question: 'What is the difference between AppArmor "enforce" and "complain" modes?',
      options: [
        'Enforce blocks and logs violations; Complain only logs violations without blocking (useful for testing)',
        'Enforce applies to privileged containers; Complain applies to regular containers',
        'Enforce is for inbound network; Complain is for outbound network',
        'Enforce requires root; Complain can be used by non-root'
      ],
      correct: 0,
      explanation: 'In enforce mode, AppArmor blocks any operation not explicitly allowed by the profile and logs the denial. In complain mode (learning mode), violations are logged but NOT blocked. Use complain mode to develop and test profiles without breaking applications.',
      reference: 'AppArmor — Profile Modes table.'
    },
    {
      question: 'What annotation applies the AppArmor profile "nginx-restricted" (loaded on the node) to a container named "nginx"?',
      options: [
        'container.apparmor.security.beta.kubernetes.io/nginx: localhost/nginx-restricted',
        'apparmor.security.beta.kubernetes.io/profile: nginx-restricted',
        'security.apparmor.io/nginx: enforce:nginx-restricted',
        'apparmor/profile: localhost:nginx-restricted'
      ],
      correct: 0,
      explanation: 'The annotation format is: "container.apparmor.security.beta.kubernetes.io/<container-name>: <mode>/<profile-name>". For locally loaded profiles, use "localhost/<profile-name>". For the runtime default, use "runtime/default".',
      reference: 'AppArmor — Annotation Method section.'
    },
    {
      question: 'Before applying an AppArmor profile to a Kubernetes pod, what must you do first?',
      options: [
        'Load the profile on all nodes where the pod may schedule using apparmor_parser -r',
        'Create a Kubernetes ConfigMap with the profile content',
        'Apply a NetworkPolicy to restrict profile access',
        'Enable the AppArmor admission controller plugin'
      ],
      correct: 0,
      explanation: 'AppArmor profiles are node-level configurations — they must be loaded into the kernel on each node before pods can reference them. If a pod is scheduled on a node without the profile, it will fail to start with "unknown AppArmor profile" error.',
      reference: 'AppArmor — Managing AppArmor Profiles on Nodes section.'
    },
    {
      question: 'What does the AppArmor profile rule "/etc/shadow r," block?',
      options: [
        'Nothing — "r" allows read access. To block, use "deny /etc/shadow r,"',
        'All processes from reading /etc/shadow',
        'Shadow group members from reading the file',
        'Read access from processes outside the profile'
      ],
      correct: 0,
      explanation: '/etc/shadow r, ALLOWS reading of /etc/shadow by the profiled process. AppArmor profiles are ALLOW-lists by default (implicit deny all). To explicitly deny, you use "deny /etc/shadow r,". Without any rule, access is already denied by the implicit deny.',
      reference: 'AppArmor — Profile Syntax section.'
    },
    {
      question: 'How do you verify an AppArmor profile is loaded and in enforce mode on a node?',
      options: [
        'sudo aa-status | grep <profile-name>',
        'kubectl get apparmor --all-namespaces',
        'systemctl status apparmor',
        'kubectl describe node | grep apparmor'
      ],
      correct: 0,
      explanation: 'aa-status lists all loaded AppArmor profiles and their modes. For quick check: sudo aa-status | grep <profile-name> shows if the profile is loaded and whether it\'s in enforce or complain mode.',
      reference: 'AppArmor — Managing AppArmor Profiles on Nodes section.'
    },
    {
      question: 'A pod with an AppArmor annotation fails to start with "cannot start container: failed to run OCI runtime". What is the most likely cause?',
      options: [
        'The AppArmor profile referenced in the annotation is not loaded on the node where the pod is scheduled',
        'The container image does not support AppArmor',
        'The Kubernetes API server doesn\'t have AppArmor admission enabled',
        'The annotation syntax is correct but AppArmor is disabled in the kernel'
      ],
      correct: 0,
      explanation: 'When a pod references an AppArmor profile that is not loaded on the node, the container runtime cannot start the container — it cannot find the profile. Load the profile with apparmor_parser -r /etc/apparmor.d/<profile> on the target node first.',
      reference: 'AppArmor — Common Mistakes section.'
    },
    {
      question: 'What is the purpose of "flags=(attach_disconnected)" in an AppArmor profile?',
      options: [
        'Allows the profile to apply to processes that started before AppArmor was enabled',
        'Disconnects the container from the host network when the profile is applied',
        'Prevents profile inheritance from parent processes',
        'Enables the profile to apply across all network namespaces'
      ],
      correct: 0,
      explanation: 'attach_disconnected allows the profile to be applied to containers even when they have a different mount namespace than expected. This is important for containers which have their own mount namespace but need AppArmor profiles applied from the host.',
      reference: 'AppArmor — Profile Syntax section.'
    },
    {
      question: 'What is the difference between AppArmor and seccomp?',
      options: [
        'AppArmor controls file/network/capability access by path; seccomp filters which system calls are allowed',
        'AppArmor is for network isolation; seccomp is for filesystem isolation',
        'AppArmor is Kubernetes-native; seccomp requires a kernel module',
        'AppArmor applies cluster-wide; seccomp applies per container only'
      ],
      correct: 0,
      explanation: 'AppArmor is a MAC (Mandatory Access Control) system that restricts file paths, network, and capabilities. Seccomp (Secure Computing Mode) filters at the system call level — allowing or denying specific syscalls like execve, open, socket. They complement each other in a defense-in-depth approach.',
      reference: 'AppArmor — What is AppArmor section.'
    }
  ],

  flashcards: [
    {
      front: 'How do you load and verify an AppArmor profile on a Linux node?',
      back: '# Load a profile:\nsudo apparmor_parser -r -W /etc/apparmor.d/my-profile\n# -r: replace/reload\n# -W: write cache\n\n# Verify it is loaded:\nsudo aa-status | grep my-profile\n# Or full status:\nsudo aa-status\n\n# Check mode (enforce vs complain):\nsudo aa-status | grep -A1 "enforce"\n\n# Change to complain for testing:\nsudo aa-complain /etc/apparmor.d/my-profile\n\n# Change back to enforce:\nsudo aa-enforce /etc/apparmor.d/my-profile'
    },
    {
      front: 'What are the two ways to apply AppArmor to a Kubernetes pod?',
      back: 'Method 1: Annotation (pre-1.30, still supported):\nmetadata:\n  annotations:\n    container.apparmor.security.beta.kubernetes.io/<container>: localhost/<profile>\n\nValues: runtime/default | localhost/<name> | unconfined\n\nMethod 2: SecurityContext (K8s 1.30+):\nspec:\n  containers:\n  - name: app\n    securityContext:\n      appArmorProfile:\n        type: Localhost\n        localhostProfile: my-profile\n        # type: RuntimeDefault or Unconfined\n\nProfile must be loaded on node BEFORE creating the pod!'
    },
    {
      front: 'Write a minimal AppArmor profile that blocks /etc/shadow and /proc access',
      back: '#include <tunables/global>\n\nprofile restrict-sensitive flags=(attach_disconnected) {\n  #include <abstractions/base>\n\n  # Allow general operations\n  network inet tcp,\n  /usr/bin/ r,\n  /usr/bin/** mr,\n  /tmp/ rw,\n  /tmp/** rw,\n\n  # Explicit denials (even if would be allowed otherwise)\n  deny /etc/shadow r,\n  deny /etc/shadow! r,  # also denies /etc/shadow~\n  deny /proc/** w,\n  deny /proc/[0-9]*/mem r,\n}\n\n# Note: deny overrides allow rules in AppArmor'
    },
    {
      front: 'What is the annotation format for AppArmor in Kubernetes?',
      back: '# Key format:\ncontainer.apparmor.security.beta.kubernetes.io/<container-name>\n\n# Value options:\nruntime/default           # container runtime\'s default profile\nlocalhost/<profile-name>  # profile loaded on node\nunconfined               # no AppArmor (NOT recommended)\n\n# Example:\nmetadata:\n  annotations:\n    container.apparmor.security.beta.kubernetes.io/nginx: localhost/k8s-nginx-restricted\n    container.apparmor.security.beta.kubernetes.io/sidecar: runtime/default\n\n# Must match: "container-name" in annotation must match spec.containers[].name'
    },
    {
      front: 'How does AppArmor relate to the Pod Security Standards (PSS)?',
      back: 'PSS Baseline:\n- Allows: runtime/default and localhost/* profiles\n- Allows: unconfined (but NOT recommended)\n\nPSS Restricted:\n- Same as Baseline for AppArmor\n- Does NOT require AppArmor\n- AppArmor is ADDITIONAL to PSS requirements\n\nBest practice:\n- PSS Restricted + AppArmor profile = defense in depth\n- PSS blocks dangerous pod configs\n- AppArmor restricts what the running process can do\n\nNote: seccomp is REQUIRED in Restricted (not Unconfined)\nAppArmor is optional in all PSS levels'
    }
  ],

  lab: {
    scenario: 'You need to apply AppArmor profiles to pods in the "secure" namespace to restrict filesystem access to only what the application needs.',
    objective: 'Create an AppArmor profile, load it on the node, and apply it to an nginx pod using the Kubernetes annotation.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Create and load an AppArmor profile',
        instruction: `Create a restrictive AppArmor profile and load it on the node.

\`\`\`bash
# Check if AppArmor is enabled
cat /sys/module/apparmor/parameters/enabled
# Expected: Y

# Check currently loaded profiles
sudo aa-status | head -20

# Create a profile for nginx
sudo tee /etc/apparmor.d/k8s-nginx-secure <<'EOF'
#include <tunables/global>

profile k8s-nginx-secure flags=(attach_disconnected,mediate_deleted) {
  #include <abstractions/base>

  # Allow networking
  network inet tcp,
  network inet6 tcp,
  network unix stream,

  # Allow nginx to run
  /usr/sbin/nginx mr,
  /bin/sh mr,

  # Allow reading config and content
  /etc/nginx/ r,
  /etc/nginx/** r,
  /usr/share/nginx/html/ r,
  /usr/share/nginx/html/** r,

  # Allow writing to required directories
  /var/log/nginx/ rw,
  /var/log/nginx/** rw,
  /var/cache/nginx/ rw,
  /var/cache/nginx/** rw,
  /tmp/ rw,
  /tmp/** rw,
  /var/run/ rw,
  /var/run/nginx.pid rw,

  # DENY sensitive files
  deny /etc/shadow r,
  deny /etc/passwd w,
  deny /proc/** w,
  deny /sys/** w,
}
EOF

# Load the profile
sudo apparmor_parser -r -W /etc/apparmor.d/k8s-nginx-secure

# Verify it's loaded in enforce mode
sudo aa-status | grep k8s-nginx-secure
\`\`\``,
        hints: [
          'The profile name is defined in the "profile" declaration, not the filename',
          '-r reloads the profile if it already exists',
          'If apparmor_parser fails, check syntax with: apparmor_parser --dry-run -r /etc/apparmor.d/k8s-nginx-secure'
        ],
        solution: `\`\`\`bash
sudo apparmor_parser -r -W /etc/apparmor.d/k8s-nginx-secure
sudo aa-status | grep k8s-nginx-secure
\`\`\``,
        verify: `\`\`\`bash
sudo aa-status | grep k8s-nginx-secure
# Expected: k8s-nginx-secure (in "enforce mode" section)

# Check AppArmor is enabled
cat /sys/module/apparmor/parameters/enabled
# Expected: Y
\`\`\``
      },
      {
        title: 'Apply the AppArmor profile to a Kubernetes Pod',
        instruction: `Create a pod with the AppArmor annotation and verify the restriction works.

\`\`\`bash
# Create the namespace
kubectl create namespace secure 2>/dev/null || true

# Create a pod with AppArmor annotation
cat <<'EOF' | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: nginx-apparmor
  namespace: secure
  annotations:
    container.apparmor.security.beta.kubernetes.io/nginx: localhost/k8s-nginx-secure
spec:
  containers:
  - name: nginx
    image: nginx:alpine
    ports:
    - containerPort: 80
EOF

# Wait for the pod to start
kubectl wait pod/nginx-apparmor -n secure --for=condition=Ready --timeout=60s

# Verify the AppArmor profile is applied
kubectl get pod nginx-apparmor -n secure -o yaml | grep apparmor
\`\`\``,
        hints: [
          'If the pod fails to start with "unknown AppArmor profile", the profile wasn\'t loaded on the node',
          'The annotation container name (nginx) must match the container name in spec.containers[].name',
          'Run kubectl describe pod nginx-apparmor -n secure to see events if it fails'
        ],
        solution: `\`\`\`bash
kubectl get pod nginx-apparmor -n secure
kubectl describe pod nginx-apparmor -n secure | grep -E "AppArmor|annotation"
\`\`\``,
        verify: `\`\`\`bash
kubectl get pod nginx-apparmor -n secure
# Expected: Running 1/1

# Verify annotation is applied
kubectl get pod nginx-apparmor -n secure -o yaml | grep "apparmor"
# Expected: container.apparmor.security.beta.kubernetes.io/nginx: localhost/k8s-nginx-secure

# Test restriction: try to read /etc/shadow (should fail)
kubectl exec nginx-apparmor -n secure -- cat /etc/shadow 2>&1
# Expected: cat: can't open '/etc/shadow': Permission denied

# Test nginx works (should succeed)
kubectl exec nginx-apparmor -n secure -- curl -s localhost:80 | head -3
# Expected: nginx HTML response
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Pod fails to start: "Unknown AppArmor profile"',
      difficulty: 'easy',
      symptom: 'After applying an AppArmor annotation, the pod fails to start with "unknown AppArmor profile" or "cannot apply AppArmor profile".',
      diagnosis: `\`\`\`bash
# Get error details
kubectl describe pod <pod-name> -n <namespace> | grep -A10 "Events"

# Check if profile is loaded on the node
kubectl get pod <pod-name> -n <namespace> -o wide  # get node name
ssh <node>
sudo aa-status | grep <profile-name>

# Common issue: profile name in annotation doesn't match loaded profile name
# Annotation says: localhost/k8s-nginx-secure
# Loaded profile might be named: k8s-nginx or nginx-restricted
\`\`\``,
      solution: `**Fix: Load the profile on the correct node.**

\`\`\`bash
# On the worker node where pod will schedule:
sudo apparmor_parser -r -W /etc/apparmor.d/k8s-nginx-secure
sudo aa-status | grep k8s-nginx-secure

# Verify the profile name matches the annotation:
# In the .d file, look for: profile <name> { ... }
grep "^profile" /etc/apparmor.d/k8s-nginx-secure
# Output should match what's in the annotation: localhost/k8s-nginx-secure

# If the profile name is different, either:
# 1. Fix the annotation to match the actual profile name
# 2. Or rename the profile in the file
# Then reload: sudo apparmor_parser -r -W /etc/apparmor.d/<file>
\`\`\``
    },
    {
      title: 'AppArmor profile blocks legitimate application operations',
      difficulty: 'medium',
      symptom: 'AppArmor profile is loaded and applied, but the application fails with permission denied errors on files it needs to access.',
      diagnosis: `\`\`\`bash
# Check kernel logs for AppArmor denials
sudo journalctl -k | grep "apparmor.*DENIED" | tail -20

# Or check audit log
sudo ausearch -m AVC --ts recent | grep apparmor

# Each DENIED line shows: operation, profile, name (path), pid, comm
# Example:
# apparmor="DENIED" operation="open" profile="k8s-nginx-secure"
#   name="/etc/nginx/conf.d/custom.conf" pid=1234 comm="nginx"

# Find all AppArmor denials for this pod
sudo journalctl -k -S "1 hour ago" | grep "k8s-nginx-secure.*DENIED" | \
  awk '{print $NF}' | sort -u
\`\`\``,
      solution: `**Add the missing path to the AppArmor profile.**

\`\`\`bash
# From the denial log, identify the blocked path:
# name="/etc/nginx/conf.d/custom.conf"

# Edit the profile
sudo vi /etc/apparmor.d/k8s-nginx-secure

# Add the required permission:
# /etc/nginx/conf.d/ r,
# /etc/nginx/conf.d/** r,

# Or use complain mode to capture all denials first:
sudo aa-complain /etc/apparmor.d/k8s-nginx-secure
# Run the application through all its code paths
# Collect all denials: sudo journalctl -k | grep "ALLOWED"
# Then run aa-logprof to update the profile:
sudo aa-logprof

# Switch back to enforce:
sudo aa-enforce /etc/apparmor.d/k8s-nginx-secure

# Reload the profile:
sudo apparmor_parser -r -W /etc/apparmor.d/k8s-nginx-secure

# Restart the pod to apply the updated profile
kubectl delete pod <pod-name> -n <namespace>
kubectl apply -f <pod-manifest>
\`\`\``
    }
  ]
};
