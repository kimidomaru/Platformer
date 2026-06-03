window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['cks-system-hardening/os-hardening'] = {
  theory: `# OS Hardening for Kubernetes Nodes

## Exam Relevance
> OS hardening appears in the CKS exam under "System Hardening" (~15% weight). Questions focus on reducing the attack surface of Kubernetes nodes through kernel tuning, service removal, file permissions, and audit configuration. Expect practical tasks involving sysctl, systemd, and filesystem security.

## Core Concepts

### Why OS Hardening Matters
Every Kubernetes node runs an operating system that is a potential attack surface. If an attacker escapes a container (via a vulnerability or misconfiguration), they land on the host OS. A hardened OS limits what the attacker can do next:
- **Minimal packages** → fewer exploitable binaries
- **Kernel hardening** → limits information leakage and privilege escalation
- **Audit logging** → detects suspicious activity
- **Strict permissions** → prevents unauthorized access to sensitive files

### Attack Progression (Kill Chain)
\`\`\`
Container escape
      ↓
Host OS access (non-root)
      ↓
Privilege escalation (SUID, writable paths, kernel exploit)
      ↓
Root on node → lateral movement to cluster
\`\`\`
Each hardening step breaks a link in this chain.

---

## Kernel Parameters (sysctl)

### Critical sysctl Settings

\`\`\`bash
# View current kernel parameters
sysctl -a | grep -E "ip_forward|dmesg|hardlinks"

# Apply settings immediately (non-persistent)
sysctl -w net.ipv4.ip_forward=1          # Required for K8s pod networking
sysctl -w kernel.dmesg_restrict=1         # Restrict dmesg to root
sysctl -w fs.protected_hardlinks=1        # Prevent hardlink attacks
sysctl -w fs.protected_symlinks=1         # Prevent symlink attacks
sysctl -w kernel.kptr_restrict=2          # Hide kernel pointers
sysctl -w net.ipv4.conf.all.send_redirects=0  # No ICMP redirects
\`\`\`

### Persistent Configuration

\`\`\`bash
# /etc/sysctl.d/99-kubernetes-hardening.conf
# ----- Network security -----
net.ipv4.ip_forward = 1                        # Required for K8s
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv6.conf.all.accept_redirects = 0

# ----- Kernel hardening -----
kernel.dmesg_restrict = 1                      # Non-root can't read dmesg
kernel.kptr_restrict = 2                       # Hide kernel pointer addresses
kernel.unprivileged_bpf_disabled = 1           # Block unprivileged eBPF (K8s 1.27+)
net.core.bpf_jit_harden = 2                    # Harden JIT compilation

# ----- Filesystem protection -----
fs.protected_hardlinks = 1
fs.protected_symlinks = 1
fs.suid_dumpable = 0                           # No core dumps for SUID

# Apply changes
sysctl --system
\`\`\`

### Key sysctl for CKS Exam

| Parameter | Secure Value | Purpose |
|-----------|-------------|---------|
| net.ipv4.ip_forward | 1 | **Required** for pod networking |
| kernel.dmesg_restrict | 1 | Hide kernel logs from non-root |
| fs.protected_hardlinks | 1 | Block hardlink privilege escalation |
| fs.protected_symlinks | 1 | Block symlink-based attacks |
| kernel.kptr_restrict | 2 | Hide /proc/kallsyms addresses |
| kernel.unprivileged_bpf_disabled | 1 | Prevent eBPF abuse |

> ⚠️ **Critical**: \`net.ipv4.ip_forward=1\` is **required** for Kubernetes — never disable it!

---

## Service Management

### Remove/Disable Unnecessary Services

\`\`\`bash
# List all running services
systemctl list-units --type=service --state=running

# Common services to disable on K8s nodes
systemctl disable --now bluetooth.service
systemctl disable --now cups.service          # Printing
systemctl disable --now avahi-daemon.service  # mDNS discovery
systemctl disable --now rpcbind.service       # NFS portmapper
systemctl disable --now postfix.service       # Mail server (if not needed)
systemctl disable --now snapd.service         # Snap package manager

# Verify service is stopped and disabled
systemctl status bluetooth.service
# Expected: Active: inactive (dead), disabled
\`\`\`

### Remove Unnecessary Packages

\`\`\`bash
# Ubuntu/Debian
apt list --installed 2>/dev/null | grep -E "telnet|ftp|rsh|nc|nmap|wireshark"
apt-get remove --purge telnet ftp rsh-client netcat-traditional nmap

# CentOS/RHEL
rpm -qa | grep -E "telnet|ftp|rsh|nc|nmap"
yum remove telnet ftp rsh nmap

# Check for setuid/setgid binaries (potential escalation vectors)
find / -perm /6000 -type f 2>/dev/null | grep -v proc | head -20
\`\`\`

---

## File Permissions and Ownership

### Critical Kubernetes File Permissions

\`\`\`bash
# Check API server configuration file permissions
stat /etc/kubernetes/manifests/kube-apiserver.yaml
# Expected: -rw------- (600) root:root

# Check etcd data directory
stat /var/lib/etcd
# Expected: drwx------ (700) etcd:etcd

# Check kubelet configuration
stat /etc/kubernetes/kubelet.conf
# Expected: -rw------- (600) root:root

stat /var/lib/kubelet/config.yaml
# Expected: -rw------- (600) root:root

# Check PKI certificates and keys
ls -la /etc/kubernetes/pki/
# .crt files: 644 root:root
# .key files: 600 root:root
\`\`\`

### CIS Benchmark File Permission Checks

\`\`\`bash
# Fix common permission issues found by kube-bench
chmod 600 /etc/kubernetes/manifests/kube-apiserver.yaml
chmod 600 /etc/kubernetes/manifests/kube-controller-manager.yaml
chmod 600 /etc/kubernetes/manifests/kube-scheduler.yaml
chmod 600 /etc/kubernetes/manifests/etcd.yaml
chmod 700 /var/lib/etcd
chown root:root /etc/kubernetes/manifests/*.yaml
chown etcd:etcd /var/lib/etcd

# Find world-writable files (security risk)
find / -xdev -type f -perm -0002 2>/dev/null | grep -v proc | grep -v sys

# Find files without owner
find / -xdev -nouser 2>/dev/null | head -20
find / -xdev -nogroup 2>/dev/null | head -20
\`\`\`

---

## Audit Daemon (auditd)

### Installing and Configuring auditd

\`\`\`bash
# Install auditd
apt-get install -y auditd audispd-plugins  # Ubuntu
yum install -y audit audit-libs            # CentOS

# Start and enable
systemctl enable --now auditd

# Check status
systemctl status auditd
auditctl -l  # List current rules
\`\`\`

### Audit Rules for Kubernetes

\`\`\`bash
# /etc/audit/rules.d/kubernetes.rules

# Monitor Kubernetes configuration changes
-w /etc/kubernetes/ -p wa -k kubernetes-config
-w /var/lib/kubelet/ -p wa -k kubelet-data

# Monitor critical system files
-w /etc/passwd -p wa -k identity-changes
-w /etc/shadow -p wa -k identity-changes
-w /etc/group -p wa -k identity-changes
-w /etc/sudoers -p wa -k privilege-escalation

# Monitor privilege escalation
-a always,exit -F arch=b64 -S setuid -S setgid -F auid>=1000 -F auid!=4294967295 -k privilege-escalation
-a always,exit -F arch=b64 -S execve -C uid!=euid -F euid=0 -k setuid-root

# Monitor container runtime
-w /usr/bin/containerd -p x -k container-runtime
-w /usr/bin/runc -p x -k container-runtime

# Apply rules
augenrules --load
auditctl -l
\`\`\`

### Reading Audit Logs

\`\`\`bash
# Search for Kubernetes config changes
ausearch -k kubernetes-config --start today

# Search for privilege escalation attempts
ausearch -k privilege-escalation --start today | aureport -i

# Real-time monitoring
tail -f /var/log/audit/audit.log | grep kubernetes
\`\`\`

---

## Minimal OS Images

### Kubernetes-Optimized Operating Systems

| OS | Description | Key Feature |
|----|-------------|-------------|
| **Bottlerocket** (AWS) | AWS-maintained, minimal | Immutable root filesystem, auto-updates |
| **Flatcar Container Linux** | CoreOS successor | Read-only /usr, automatic updates |
| **Container-Optimized OS** (GKE) | Google-maintained | Locked-down, Chromium OS base |
| **RancherOS** | Docker-first | Everything in containers |
| **Ubuntu Minimal** | Trimmed Ubuntu | Reduced package footprint |

### Bottlerocket Security Features
\`\`\`bash
# Bottlerocket uses dm-verity for root filesystem integrity
# Configuration via TOML instead of traditional config files
# API-based management through bottlerocket-settings

# Check Bottlerocket settings
apiclient get settings.kernel.sysctl
apiclient set settings.kernel.sysctl."kernel.dmesg_restrict"="1"
\`\`\`

---

## SSH Hardening

\`\`\`bash
# /etc/ssh/sshd_config hardening
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
PermitEmptyPasswords no
X11Forwarding no
AllowAgentForwarding no
MaxAuthTries 3
LoginGraceTime 30
Protocol 2

# Restart SSH
systemctl restart sshd
\`\`\`

---

## Common Mistakes

1. **Disabling ip_forward** — breaks all pod-to-pod communication
2. **Too-restrictive sysctl** — some K8s CNI plugins require specific kernel params
3. **Removing containerd** — obviously breaks Kubernetes 🙂
4. **Forgetting persistent sysctl** — sysctl -w is lost on reboot without sysctl.d/
5. **World-writable /tmp on nodes** — enables privilege escalation via symlink attacks
6. **Not reloading auditd after rule changes** — \`service auditd restart\` or \`augenrules --load\`
7. **Overly broad audit rules** — can flood disk with logs; tune with \`-F auid\` filters

---

## Killer.sh Style Challenge

**Scenario**: A kube-bench CIS scan on node \`worker-01\` shows several FAIL items related to kernel parameters and file permissions. Fix the following:
1. Set \`kernel.dmesg_restrict=1\` persistently
2. Fix permissions on \`/etc/kubernetes/manifests/kube-apiserver.yaml\` (should be 600)
3. Disable the \`bluetooth\` service permanently
4. Add an audit rule to monitor writes to \`/etc/kubernetes/\`

**Steps to solve**:
\`\`\`bash
# 1. Persistent kernel parameter
echo "kernel.dmesg_restrict = 1" >> /etc/sysctl.d/99-cis.conf
sysctl --system

# 2. Fix API server manifest permissions
chmod 600 /etc/kubernetes/manifests/kube-apiserver.yaml
stat /etc/kubernetes/manifests/kube-apiserver.yaml  # verify

# 3. Disable bluetooth
systemctl disable --now bluetooth.service

# 4. Add audit rule
echo '-w /etc/kubernetes/ -p wa -k kubernetes-config' >> /etc/audit/rules.d/cis.rules
augenrules --load
auditctl -l | grep kubernetes-config  # verify
\`\`\`
`,
  quiz: [
    {
      question: 'Which sysctl parameter is REQUIRED for Kubernetes pod networking and must NOT be disabled?',
      options: [
        'kernel.dmesg_restrict',
        'net.ipv4.ip_forward',
        'fs.protected_hardlinks',
        'kernel.kptr_restrict'
      ],
      correct: 1,
      explanation: 'net.ipv4.ip_forward=1 is required for Kubernetes pod networking. It enables the node to forward packets between pods and to external destinations. Disabling it breaks all inter-pod communication.',
      reference: 'Kernel Parameters — see "Key sysctl for CKS Exam" table in theory'
    },
    {
      question: 'A sysctl setting is applied with `sysctl -w kernel.dmesg_restrict=1` but is lost after a node reboot. Where should it be placed for persistence?',
      options: [
        '/etc/sysctl.conf only',
        '/etc/sysctl.d/*.conf or /etc/sysctl.conf',
        '/etc/kernel/parameters',
        '/boot/grub/grub.cfg'
      ],
      correct: 1,
      explanation: 'Persistent sysctl settings go in /etc/sysctl.d/*.conf files (preferred for modular config) or /etc/sysctl.conf. After creating/editing, run `sysctl --system` to apply all files without rebooting.',
      reference: 'Kernel Parameters — see "Persistent Configuration" section'
    },
    {
      question: 'What are the correct permissions and ownership for /var/lib/etcd according to CIS Kubernetes Benchmark?',
      options: [
        '755 root:root',
        '644 etcd:etcd',
        '700 etcd:etcd',
        '750 root:etcd'
      ],
      correct: 2,
      explanation: '/var/lib/etcd should have permissions 700 (drwx------) and be owned by etcd:etcd. This ensures only the etcd process can read/write the data directory, protecting sensitive cluster state.',
      reference: 'File Permissions — see "Critical Kubernetes File Permissions" section'
    },
    {
      question: 'Which command makes an audit rule persistent after a node reboot?',
      options: [
        'auditctl --reload',
        'augenrules --load',
        'systemctl restart audit',
        'audit-reload --persist'
      ],
      correct: 1,
      explanation: 'augenrules --load reads all rule files from /etc/audit/rules.d/*.rules, merges them, and loads them. Rules in /etc/audit/rules.d/ persist across reboots because auditd loads them at startup.',
      reference: 'Audit Daemon — see "Audit Rules for Kubernetes" section'
    },
    {
      question: 'What command finds files with SUID or SGID bits set on a Kubernetes node?',
      options: [
        'find / -perm /6000 -type f 2>/dev/null',
        'ls -lR / | grep "rws"',
        'stat --format="%A" /* | grep s',
        'chmod -v /6000 / -R'
      ],
      correct: 0,
      explanation: 'find / -perm /6000 -type f 2>/dev/null finds all files with SUID (4000) or SGID (2000) bits set. The /6000 mask matches either bit. These files are potential privilege escalation vectors since they run with elevated privileges.',
      reference: 'Service Management — see "Remove Unnecessary Packages" section'
    },
    {
      question: 'Which OS is maintained by AWS and uses an immutable root filesystem for Kubernetes worker nodes?',
      options: [
        'Flatcar Container Linux',
        'Container-Optimized OS',
        'Bottlerocket',
        'RancherOS'
      ],
      correct: 2,
      explanation: 'Bottlerocket is an AWS-maintained, purpose-built OS for running containers. Key security features include an immutable root filesystem (enforced by dm-verity), API-based management, and automatic security updates.',
      reference: 'Minimal OS Images — see comparison table in theory'
    },
    {
      question: 'What is the purpose of `kernel.kptr_restrict=2` in a hardened Kubernetes node?',
      options: [
        'Restrict access to /proc/kmsg',
        'Hide kernel pointer addresses from /proc/kallsyms and dmesg',
        'Disable kernel modules loading',
        'Restrict core dump generation'
      ],
      correct: 1,
      explanation: 'kernel.kptr_restrict=2 hides all kernel pointer addresses from /proc/kallsyms and similar files for all users including root. Value 1 hides from non-root; value 2 hides from everyone. This prevents kernel ASLR bypass by attackers with local access.',
      reference: 'Kernel Parameters — sysctl table in theory'
    },
    {
      question: 'After adding rules to /etc/audit/rules.d/kubernetes.rules, which command verifies the rules were successfully loaded?',
      options: [
        'cat /etc/audit/rules.d/kubernetes.rules',
        'auditctl -l',
        'ausearch --list-rules',
        'journalctl -u auditd'
      ],
      correct: 1,
      explanation: 'auditctl -l lists all currently active audit rules in the kernel. After running augenrules --load, use this command to confirm rules were loaded correctly. It shows both file watches (-w) and syscall rules (-a).',
      reference: 'Audit Daemon — see "Installing and Configuring auditd" section'
    }
  ],
  flashcards: [
    {
      front: 'What sysctl value is required for Kubernetes networking and why?',
      back: 'net.ipv4.ip_forward=1 — enables the Linux kernel to forward packets between network interfaces. Required for pod-to-pod communication and pod-to-external traffic routing. Without it, pods cannot communicate across nodes.'
    },
    {
      front: 'Where do persistent sysctl settings go and how do you apply them?',
      back: 'Place settings in /etc/sysctl.d/*.conf (e.g., 99-hardening.conf) or /etc/sysctl.conf. Apply with: sysctl --system (reads all files) or sysctl -p /path/to/file (specific file).'
    },
    {
      front: 'What are the correct permissions for /var/lib/etcd?',
      back: '700 (drwx------) owned by etcd:etcd — only the etcd user/process should read/write the etcd data directory. Found as a CIS Benchmark check item in kube-bench output.'
    },
    {
      front: 'How do you make auditd rules persistent across reboots?',
      back: 'Write rules to /etc/audit/rules.d/*.rules files, then run: augenrules --load — this merges all files and loads them. auditd reads these files at startup automatically.'
    },
    {
      front: 'What is the audit rule syntax to monitor writes to /etc/kubernetes/?',
      back: '-w /etc/kubernetes/ -p wa -k kubernetes-config\n-w = watch path\n-p wa = permissions (w=write, a=attribute change)\n-k = key name for searching with ausearch -k'
    },
    {
      front: 'Name 3 services commonly disabled on Kubernetes nodes for hardening',
      back: 'bluetooth.service, cups.service (printing), avahi-daemon.service (mDNS), rpcbind.service (NFS), postfix.service (mail), snapd.service (snap packages). Disable with: systemctl disable --now <service>'
    },
    {
      front: 'What does kernel.dmesg_restrict=1 do?',
      back: 'Restricts access to kernel ring buffer (dmesg) to root users only. Non-root users cannot read kernel messages, which prevents information disclosure about kernel internals, hardware, and driver messages that could assist in privilege escalation.'
    },
    {
      front: 'What command finds world-writable files on a Kubernetes node?',
      back: 'find / -xdev -type f -perm -0002 2>/dev/null\n-xdev = stay on same filesystem\n-perm -0002 = world-writable bit set\nWorld-writable files are security risks because any user can modify them.'
    }
  ],
  lab: {
    scenario: 'A Kubernetes worker node has failed multiple CIS Benchmark checks. You need to harden the OS by configuring kernel parameters, fixing file permissions, disabling unnecessary services, and setting up audit rules.',
    objective: 'Apply OS hardening techniques to a Kubernetes node: sysctl tuning, service disablement, file permission fixes, and auditd configuration.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Assess Current State',
        instruction: `Check the current security posture of the node before making changes.`,
        hints: [
          'Use sysctl -a to view kernel parameters',
          'systemctl list-units shows running services',
          'stat checks file permissions'
        ],
        solution: `\`\`\`bash
# Check key kernel parameters
sysctl kernel.dmesg_restrict fs.protected_hardlinks fs.protected_symlinks

# List running services
systemctl list-units --type=service --state=running | head -30

# Check Kubernetes file permissions
stat /etc/kubernetes/manifests/kube-apiserver.yaml 2>/dev/null || echo "File not found (normal on worker nodes)"
stat /var/lib/etcd 2>/dev/null || echo "etcd not on this node"

# Check for SUID binaries
find /usr -perm /6000 -type f 2>/dev/null | head -10

# Check audit daemon
systemctl is-active auditd
\`\`\``,
        verify: `\`\`\`bash
# Verify we can see kernel parameters
sysctl kernel.dmesg_restrict
# Expected output: kernel.dmesg_restrict = 0 (before hardening) or 1 (already hardened)

systemctl is-active auditd
# Expected: active or inactive (we'll configure it next)
\`\`\``
      },
      {
        title: 'Configure Kernel Parameters',
        instruction: `Create a persistent sysctl configuration file with hardening parameters appropriate for a Kubernetes node.`,
        hints: [
          'Remember net.ipv4.ip_forward=1 is REQUIRED',
          'Place file in /etc/sysctl.d/ for persistence',
          'Use sysctl --system to apply all sysctl.d files'
        ],
        solution: `\`\`\`bash
# Create hardening configuration file
cat > /etc/sysctl.d/99-k8s-hardening.conf << 'EOF'
# Required for Kubernetes networking
net.ipv4.ip_forward = 1

# Network security
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.all.accept_source_route = 0

# Kernel hardening
kernel.dmesg_restrict = 1
kernel.kptr_restrict = 2

# Filesystem protection
fs.protected_hardlinks = 1
fs.protected_symlinks = 1
fs.suid_dumpable = 0
EOF

# Apply all sysctl.d settings
sysctl --system

# Verify key settings
sysctl kernel.dmesg_restrict
sysctl net.ipv4.ip_forward
\`\`\``,
        verify: `\`\`\`bash
# Verify kernel parameters are active
sysctl kernel.dmesg_restrict
# Expected: kernel.dmesg_restrict = 1

sysctl net.ipv4.ip_forward
# Expected: net.ipv4.ip_forward = 1

sysctl fs.protected_hardlinks
# Expected: fs.protected_hardlinks = 1

# Verify config file exists
cat /etc/sysctl.d/99-k8s-hardening.conf | grep dmesg_restrict
# Expected: kernel.dmesg_restrict = 1
\`\`\``
      },
      {
        title: 'Disable Unnecessary Services',
        instruction: `Identify and disable services that are not needed for a Kubernetes worker node.`,
        hints: [
          'bluetooth, cups, and avahi-daemon are common candidates',
          'Use --now flag to stop service immediately',
          'Verify with systemctl is-enabled and is-active'
        ],
        solution: `\`\`\`bash
# Check which optional services are running
for svc in bluetooth cups avahi-daemon rpcbind postfix; do
  status=$(systemctl is-active $svc 2>/dev/null)
  enabled=$(systemctl is-enabled $svc 2>/dev/null)
  echo "$svc: active=$status, enabled=$enabled"
done

# Disable services that are found active/enabled
# (skip ones that aren't installed)
for svc in bluetooth cups avahi-daemon rpcbind; do
  if systemctl list-unit-files | grep -q "$svc"; then
    echo "Disabling $svc..."
    systemctl disable --now "$svc" 2>/dev/null || true
  fi
done

# Verify
systemctl is-active bluetooth 2>/dev/null || echo "bluetooth: not available or stopped"
systemctl is-active cups 2>/dev/null || echo "cups: not available or stopped"
\`\`\``,
        verify: `\`\`\`bash
# Verify services are stopped and disabled
for svc in bluetooth cups avahi-daemon; do
  active=$(systemctl is-active $svc 2>/dev/null)
  enabled=$(systemctl is-enabled $svc 2>/dev/null)
  echo "$svc: $active / $enabled"
done
# Expected: inactive/dead and disabled (or "not-found" if not installed)
\`\`\``
      },
      {
        title: 'Fix File Permissions',
        instruction: `Fix the file permissions for Kubernetes configuration files according to CIS Benchmark requirements.`,
        hints: [
          'API server manifests should be 600 root:root',
          'etcd data directory should be 700 etcd:etcd',
          'PKI .key files should be 600, .crt files 644'
        ],
        solution: `\`\`\`bash
# Fix Kubernetes manifest permissions (control plane nodes)
if [ -d /etc/kubernetes/manifests ]; then
  for manifest in /etc/kubernetes/manifests/*.yaml; do
    chmod 600 "$manifest"
    chown root:root "$manifest"
    echo "Fixed: $manifest"
  done
fi

# Fix kubelet configuration
if [ -f /var/lib/kubelet/config.yaml ]; then
  chmod 600 /var/lib/kubelet/config.yaml
  chown root:root /var/lib/kubelet/config.yaml
fi

if [ -f /etc/kubernetes/kubelet.conf ]; then
  chmod 600 /etc/kubernetes/kubelet.conf
  chown root:root /etc/kubernetes/kubelet.conf
fi

# Fix etcd data directory (etcd nodes)
if [ -d /var/lib/etcd ]; then
  chmod 700 /var/lib/etcd
  chown etcd:etcd /var/lib/etcd
fi

# Fix PKI files
if [ -d /etc/kubernetes/pki ]; then
  chmod 600 /etc/kubernetes/pki/*.key 2>/dev/null
  chmod 644 /etc/kubernetes/pki/*.crt 2>/dev/null
fi

echo "Permission fixes complete"
\`\`\``,
        verify: `\`\`\`bash
# Verify manifest permissions
if [ -d /etc/kubernetes/manifests ]; then
  ls -la /etc/kubernetes/manifests/
  # Expected: -rw------- (600) root root for each .yaml file
fi

# Verify kubelet config
stat /var/lib/kubelet/config.yaml 2>/dev/null | grep Access
# Expected: Access: (0600/-rw-------) Uid: ( 0/ root)

# Verify etcd directory (if present)
stat /var/lib/etcd 2>/dev/null | grep -E "Access|Uid"
# Expected: Access: (0700/drwx------) Uid: etcd
\`\`\``
      },
      {
        title: 'Configure auditd Rules',
        instruction: `Install auditd and create audit rules to monitor Kubernetes configuration and security-relevant system activities.`,
        hints: [
          'Install auditd first if not present',
          'Place rules in /etc/audit/rules.d/*.rules',
          'Use augenrules --load to activate rules',
          'Verify with auditctl -l'
        ],
        solution: `\`\`\`bash
# Install auditd if not present
which auditd || apt-get install -y auditd 2>/dev/null || yum install -y audit 2>/dev/null

# Start and enable auditd
systemctl enable --now auditd

# Create Kubernetes audit rules
cat > /etc/audit/rules.d/kubernetes-hardening.rules << 'EOF'
# Monitor Kubernetes configuration changes
-w /etc/kubernetes/ -p wa -k kubernetes-config
-w /var/lib/kubelet/ -p wa -k kubelet-data

# Monitor critical system files
-w /etc/passwd -p wa -k identity-changes
-w /etc/shadow -p wa -k identity-changes
-w /etc/sudoers -p wa -k privilege-escalation
-w /etc/sudoers.d/ -p wa -k privilege-escalation

# Monitor container runtime
-w /usr/bin/containerd -p x -k container-runtime
-w /usr/bin/runc -p x -k container-runtime
EOF

# Load rules
augenrules --load

# Verify
auditctl -l | grep kubernetes
\`\`\``,
        verify: `\`\`\`bash
# Verify auditd is running
systemctl is-active auditd
# Expected: active

# Verify rules are loaded
auditctl -l | grep -E "kubernetes|identity|privilege"
# Expected: list of -w rules for /etc/kubernetes/, /etc/passwd, etc.

# Test audit rule fires
touch /etc/kubernetes/test-audit 2>/dev/null && rm -f /etc/kubernetes/test-audit
ausearch -k kubernetes-config --start recent 2>/dev/null | tail -5
# Expected: audit event showing write to /etc/kubernetes/
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Pods Cannot Communicate After sysctl Hardening',
      difficulty: 'medium',
      symptom: 'After applying sysctl hardening settings, pods on different nodes cannot reach each other. kubectl exec pod-a -- ping pod-b-ip fails. The CNI plugin logs show "packet forwarding disabled".',
      diagnosis: `\`\`\`bash
# Check ip_forward status
sysctl net.ipv4.ip_forward
# Likely shows: net.ipv4.ip_forward = 0

# Check if routes exist
ip route show | head -10

# Try to forward manually
echo 1 > /proc/sys/net/ipv4/ip_forward
kubectl exec pod-a -- ping <pod-b-ip> -c 2

# Check what sysctl files exist
ls /etc/sysctl.d/
cat /etc/sysctl.d/99-k8s-hardening.conf | grep ip_forward
\`\`\``,
      solution: `The sysctl hardening accidentally set net.ipv4.ip_forward=0 or omitted it.

**Fix**:
\`\`\`bash
# Immediately restore (non-persistent)
sysctl -w net.ipv4.ip_forward=1

# Fix the sysctl.d file
# Edit /etc/sysctl.d/99-k8s-hardening.conf and ensure:
net.ipv4.ip_forward = 1  # This line MUST be present and set to 1

# Re-apply
sysctl --system

# Verify
sysctl net.ipv4.ip_forward
# Expected: net.ipv4.ip_forward = 1

# Test pod connectivity
kubectl exec pod-a -- ping <pod-b-ip> -c 3
\`\`\`

**Prevention**: Always include net.ipv4.ip_forward=1 in your Kubernetes sysctl hardening config and test pod connectivity immediately after applying.`
    },
    {
      title: 'auditd Rules Not Loading After Reboot',
      difficulty: 'easy',
      symptom: 'Audit rules were added and worked before a reboot. After reboot, auditctl -l shows no rules. Checking /etc/audit/rules.d/ shows the files exist.',
      diagnosis: `\`\`\`bash
# Check if auditd is running
systemctl is-active auditd
systemctl status auditd

# Check if rules files are valid
cat /etc/audit/rules.d/kubernetes-hardening.rules

# Check for syntax errors in rules
augenrules --check

# Check audit service boot order
systemctl show auditd | grep -E "WantedBy|After|Requires"

# Look for errors in auditd log
journalctl -u auditd --since boot | grep -i error
\`\`\``,
      solution: `The auditd service may not be enabled for startup, or there are syntax errors in rule files.

**Fix**:
\`\`\`bash
# Enable auditd for automatic startup
systemctl enable auditd
systemctl start auditd

# Check for rule syntax errors
augenrules --check
# Output shows any problematic files

# Fix any syntax errors in rules, then reload
augenrules --load

# Verify rules are now active
auditctl -l

# Test that rules survive restart
systemctl restart auditd
auditctl -l  # Should still show rules
\`\`\`

**Note**: On some distros, auditd starts before rules are loaded. Check /etc/audit/audit.rules — augenrules merges /etc/audit/rules.d/ into this file.`
    },
    {
      title: 'kube-bench Still Reporting FAIL After Fixes',
      difficulty: 'hard',
      symptom: 'After applying CIS hardening fixes (sysctl, permissions, services), re-running kube-bench still shows the same FAIL items. The settings appear correct when checked manually.',
      diagnosis: `\`\`\`bash
# Re-run kube-bench with verbose output
kube-bench run --targets node --check 3.1.1,3.2.1,4.1.1 -v 3 2>&1 | head -50

# Manually verify what kube-bench checks
# For file permissions (check 1.1.1):
stat /etc/kubernetes/manifests/kube-apiserver.yaml

# For sysctl (check 3.2.1):
sysctl kernel.dmesg_restrict

# Run as root (kube-bench requires root)
sudo kube-bench run --targets node

# Check if kube-bench is reading cached results
ls -la /tmp/kube-bench*
\`\`\``,
      solution: `Multiple possible causes:

**1. kube-bench running as non-root**:
\`\`\`bash
sudo kube-bench run --targets node
# Must run as root to read protected files
\`\`\`

**2. Sysctl not applied (only persisted)**:
\`\`\`bash
# Verify runtime value (not just file)
sysctl kernel.dmesg_restrict  # Check live value
# vs
cat /etc/sysctl.d/99-hardening.conf  # Just the config file

# Apply if needed
sysctl --system
\`\`\`

**3. Wrong kube-bench target**:
\`\`\`bash
# Control plane checks vs node checks
kube-bench run --targets master  # For control plane
kube-bench run --targets node    # For workers
kube-bench run --targets etcd    # For etcd nodes
\`\`\`

**4. File in wrong location** (kube-bench checks specific paths):
\`\`\`bash
# Check what path kube-bench expects
kube-bench run --targets node -v 3 2>&1 | grep "expected path"
\`\`\``
    }
  ]
};
