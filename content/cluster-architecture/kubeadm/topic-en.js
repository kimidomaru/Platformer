window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['cluster-architecture/kubeadm'] = {
  theory: `# Kubeadm & Cluster Lifecycle

## Exam Relevance
> Cluster upgrade with kubeadm is **heavily tested in CKA** (~25% of the exam covers cluster architecture and management). You must be able to upgrade the control plane and worker nodes following the correct sequence. Expect at least one upgrade task in the real exam. ETCD backup is also covered here.

## Cluster Components and Their Location

| Component | Location | Managed By |
|-----------|----------|------------|
| kube-apiserver | Control Plane | Static Pod (/etc/kubernetes/manifests/) |
| etcd | Control Plane | Static Pod (/etc/kubernetes/manifests/) |
| kube-scheduler | Control Plane | Static Pod (/etc/kubernetes/manifests/) |
| kube-controller-manager | Control Plane | Static Pod (/etc/kubernetes/manifests/) |
| kubelet | All Nodes | systemd service |
| kube-proxy | All Nodes | DaemonSet |
| CoreDNS | Control Plane | Deployment |

## kubeadm init — Bootstrapping a Cluster

\`\`\`bash
# Initialize control plane
kubeadm init \
  --pod-network-cidr=192.168.0.0/16 \    # CIDR for pod network (depends on CNI)
  --apiserver-advertise-address=10.0.0.1 \  # IP that apiserver advertises
  --kubernetes-version=1.30.0

# After init, configure kubectl
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config

# Install CNI (example: Calico)
kubectl apply -f https://docs.projectcalico.org/manifests/calico.yaml

# Join a worker node (command from kubeadm init output)
kubeadm join 10.0.0.1:6443 --token <token> --discovery-token-ca-cert-hash sha256:<hash>
\`\`\`

## Cluster Upgrade — Step by Step

The upgrade order is **always**: Control Plane first, then Worker Nodes.

### Step 1: Check Current Versions

\`\`\`bash
kubectl version
kubeadm version
kubectl get nodes  # shows current kubernetes version per node
\`\`\`

### Step 2: Upgrade kubeadm (Control Plane Node)

\`\`\`bash
# On the control plane node
# Update package repo and install new kubeadm
apt-mark unhold kubeadm
apt-get update
apt-get install -y kubeadm=1.31.0-1.1
apt-mark hold kubeadm

# Verify new kubeadm version
kubeadm version

# Plan the upgrade (shows what will change)
kubeadm upgrade plan

# Apply the upgrade
kubeadm upgrade apply v1.31.0
\`\`\`

### Step 3: Upgrade kubelet and kubectl (Control Plane Node)

\`\`\`bash
# Drain the control plane node first
kubectl drain controlplane --ignore-daemonsets

# Upgrade kubelet and kubectl
apt-mark unhold kubelet kubectl
apt-get install -y kubelet=1.31.0-1.1 kubectl=1.31.0-1.1
apt-mark hold kubelet kubectl

# Restart kubelet
sudo systemctl daemon-reload
sudo systemctl restart kubelet

# Uncordon the control plane
kubectl uncordon controlplane

# Verify
kubectl get nodes  # controlplane should show v1.31.0
\`\`\`

### Step 4: Upgrade Worker Nodes (One at a Time)

\`\`\`bash
# === On the CONTROL PLANE ===
# Drain the worker node
kubectl drain node01 --ignore-daemonsets --delete-emptydir-data

# === SSH to the WORKER NODE ===
ssh node01

# Upgrade kubeadm on worker node
apt-mark unhold kubeadm
apt-get install -y kubeadm=1.31.0-1.1
apt-mark hold kubeadm

# Upgrade node configuration
kubeadm upgrade node

# Upgrade kubelet and kubectl
apt-mark unhold kubelet kubectl
apt-get install -y kubelet=1.31.0-1.1 kubectl=1.31.0-1.1
apt-mark hold kubelet kubectl

sudo systemctl daemon-reload
sudo systemctl restart kubelet

# === Back on CONTROL PLANE ===
exit
kubectl uncordon node01

# Verify node is now upgraded
kubectl get nodes
\`\`\`

## Key Differences: Control Plane vs Worker Node Upgrade

| Step | Control Plane | Worker Node |
|------|--------------|-------------|
| kubeadm command | \`kubeadm upgrade apply v1.X.Y\` | \`kubeadm upgrade node\` |
| Drain from | Itself (\`kubectl drain controlplane\`) | Control plane (SSH back to CP) |
| kubelet restart | Yes | Yes |

## ETCD Backup and Restore (Quick Reference)

\`\`\`bash
# Backup
ETCDCTL_API=3 etcdctl snapshot save /opt/etcd-backup.db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key

# Verify backup
ETCDCTL_API=3 etcdctl snapshot status /opt/etcd-backup.db

# Restore
ETCDCTL_API=3 etcdctl snapshot restore /opt/etcd-backup.db \
  --data-dir=/var/lib/etcd-restored

# Update etcd static pod to use new data dir
vi /etc/kubernetes/manifests/etcd.yaml
# Change: --data-dir=/var/lib/etcd-restored
# Also change the hostPath volume to: /var/lib/etcd-restored
\`\`\`

## Token Management

\`\`\`bash
# List existing join tokens
kubeadm token list

# Create a new token (valid for 24 hours)
kubeadm token create

# Create token and print the full join command
kubeadm token create --print-join-command

# Get CA cert hash (for join command)
openssl x509 -pubkey -in /etc/kubernetes/pki/ca.crt | \
  openssl rsa -pubin -outform der 2>/dev/null | \
  openssl dgst -sha256 -hex | sed 's/^.* //'
\`\`\`

## Common Errors

1. **Forgot to drain before upgrade** — pods are disrupted unexpectedly
2. **Wrong version format** — use \`1.31.0-1.1\` (not \`v1.31.0\`) for apt packages
3. **Forgot \`kubeadm upgrade node\` on workers** — only kubelet upgraded, not node config
4. **Forgot \`systemctl daemon-reload\`** — kubelet may not pick up new binary
5. **Forgot to uncordon** — node stays in SchedulingDisabled state after upgrade
6. **Upgraded workers before control plane** — always upgrade CP first

## Killer.sh Style Challenge

**Task**: Upgrade the cluster from v1.30.0 to v1.31.0:
1. Upgrade the control plane node (kubeadm, kubectl, kubelet)
2. Upgrade worker node01 (drain from CP, upgrade on node, uncordon from CP)
3. Verify both nodes show v1.31.0 after the upgrade
`,
  quiz: [
    {
      question: 'What is the correct order for upgrading a Kubernetes cluster?',
      options: [
        'Upgrade all nodes simultaneously to minimize downtime',
        'Upgrade worker nodes first, then upgrade the control plane',
        'Upgrade the control plane first, then upgrade worker nodes one at a time',
        'Upgrade etcd first, then control plane, then workers'
      ],
      correct: 2,
      explanation: 'Always upgrade the control plane first, then worker nodes one at a time. This ensures the API server is running the newer version and can manage older kubelets temporarily (N-1 version skew is supported).',
      reference: 'Cluster Upgrade — Step by Step in theory. Control Plane first is a firm rule.'
    },
    {
      question: 'What command is used to upgrade kubeadm configuration on a WORKER node?',
      options: [
        'kubeadm upgrade apply v1.31.0',
        'kubeadm upgrade node',
        'kubeadm init --upgrade',
        'kubeadm join --upgrade'
      ],
      correct: 1,
      explanation: 'On worker nodes, use "kubeadm upgrade node" (not "apply"). The "apply" command is only for the control plane. "upgrade node" upgrades the local kubelet configuration.',
      reference: 'Step 4: Upgrade Worker Nodes. The table shows Control Plane uses "apply", workers use "node".'
    },
    {
      question: 'After upgrading the kubelet binary on a node, what commands must you run?',
      options: [
        'Only systemctl restart kubelet',
        'Only kubectl apply -f kubelet-config.yaml',
        'systemctl daemon-reload && systemctl restart kubelet',
        'kubeadm upgrade apply && systemctl restart kubelet'
      ],
      correct: 2,
      explanation: 'After replacing the kubelet binary, you must run daemon-reload to tell systemd to re-read the service file, then restart kubelet. Skipping daemon-reload is a common mistake.',
      reference: 'Step 3: Upgrade kubelet and kubectl. Both commands are required after binary upgrade.'
    },
    {
      question: 'What does kubectl drain do before a node upgrade?',
      options: [
        'Stops all pods immediately and deletes them',
        'Cordons the node (marks Unschedulable) and evicts all pods gracefully to other nodes',
        'Only marks the node as Unschedulable without moving pods',
        'Backs up all pod configurations before upgrade'
      ],
      correct: 1,
      explanation: 'kubectl drain both cordons the node (prevents new pod scheduling) and evicts existing pods gracefully. Pods are moved to other available nodes. DaemonSet pods are ignored by default (--ignore-daemonsets).',
      reference: 'Step 3 and Step 4 in theory. drain = cordon + evict pods.'
    },
    {
      question: 'What flag is typically needed when draining a node that has pods with local storage?',
      options: [
        '--force',
        '--delete-emptydir-data',
        '--skip-storage',
        '--evict-all'
      ],
      correct: 1,
      explanation: 'The --delete-emptydir-data flag (previously --delete-local-data) is required when pods use emptyDir volumes. Without it, drain will refuse to evict those pods since the data would be lost.',
      reference: 'Step 4: Upgrade Worker Nodes — kubectl drain command includes --delete-emptydir-data.'
    },
    {
      question: 'After upgrading a node, what must you do to allow new workloads to be scheduled on it?',
      options: [
        'kubectl delete node <name> and let kubeadm rejoin it',
        'kubectl uncordon <node-name>',
        'Restart kubelet on the node',
        'The node automatically becomes schedulable after upgrade'
      ],
      correct: 1,
      explanation: 'After drain (which cordons the node), you must explicitly uncordon it to allow new pod scheduling. Forgetting to uncordon leaves the node in SchedulingDisabled state.',
      reference: 'Step 3 and Step 4 in theory. Always uncordon after drain+upgrade.'
    },
    {
      question: 'What kubeadm command shows the upgrade plan (what will change) before applying?',
      options: [
        'kubeadm upgrade show',
        'kubeadm upgrade plan',
        'kubeadm upgrade check',
        'kubeadm version --upgrade'
      ],
      correct: 1,
      explanation: '"kubeadm upgrade plan" shows the available versions, what will be upgraded, and any prerequisites. Always run this before "kubeadm upgrade apply" to understand the changes.',
      reference: 'Step 2: Upgrade kubeadm. Run "plan" before "apply".'
    },
    {
      question: 'Where are control plane component manifests stored in a kubeadm cluster?',
      options: [
        '/etc/kubernetes/config/',
        '/var/lib/kubernetes/',
        '/etc/kubernetes/manifests/',
        '/usr/share/kubernetes/'
      ],
      correct: 2,
      explanation: 'kubeadm bootstraps control plane components as static pods. Their manifests are stored in /etc/kubernetes/manifests/ on the control plane node. The kubelet watches this directory and manages these pods.',
      reference: 'Cluster Components table in theory — Static Pod location: /etc/kubernetes/manifests/'
    }
  ],
  flashcards: [
    {
      front: 'What is the correct order for upgrading a multi-node Kubernetes cluster?',
      back: '1. Drain and upgrade the control plane node (kubeadm, kubectl, kubelet)\n2. Uncordon control plane\n3. For each worker node:\n   a. Drain from control plane\n   b. SSH to worker: upgrade kubeadm, run kubeadm upgrade node\n   c. Upgrade kubelet & kubectl, daemon-reload, restart kubelet\n   d. SSH back to CP: uncordon the worker'
    },
    {
      front: 'What is the difference between "kubeadm upgrade apply" and "kubeadm upgrade node"?',
      back: '"kubeadm upgrade apply v1.X.Y" — used on the CONTROL PLANE node to upgrade all control plane components (apiserver, scheduler, controller-manager, etcd if managed).\n\n"kubeadm upgrade node" — used on WORKER nodes to upgrade the local kubelet configuration. Does not specify a version — it uses the control plane version.'
    },
    {
      front: 'What commands must run after installing a new kubelet binary?',
      back: 'sudo systemctl daemon-reload\nsudo systemctl restart kubelet\n\ndaemon-reload is required first to tell systemd to re-read the updated service file. Skipping daemon-reload means the old service definition is still cached.'
    },
    {
      front: 'What does kubectl drain do?',
      back: 'Two actions in one command:\n1. Cordon the node (mark as Unschedulable — no new pods)\n2. Evict all existing pods gracefully (move them to other nodes)\n\nCommon flags:\n--ignore-daemonsets (required — DaemonSet pods cannot be evicted)\n--delete-emptydir-data (required when pods use emptyDir)'
    },
    {
      front: 'Where are control plane static pod manifests stored?',
      back: '/etc/kubernetes/manifests/\n\nFiles:\n- kube-apiserver.yaml\n- etcd.yaml\n- kube-scheduler.yaml\n- kube-controller-manager.yaml\n\nThe kubelet watches this directory and manages these pods automatically. Edit these files to modify control plane component configuration.'
    },
    {
      front: 'How do you generate a new node join command after kubeadm init?',
      back: 'kubeadm token create --print-join-command\n\nThis creates a new 24-hour token and prints the full join command. The original token from kubeadm init expires after 24 hours by default.'
    },
    {
      front: 'What package naming convention does apt use for Kubernetes versions?',
      back: 'Format: <version>-<revision> — for example: 1.31.0-1.1\n\nCommon mistake: using v1.31.0 (with "v" prefix) — the apt package name does NOT have a "v" prefix. Always use: apt-get install -y kubeadm=1.31.0-1.1'
    },
    {
      front: 'What is the etcdctl command to take an etcd snapshot backup?',
      back: 'ETCDCTL_API=3 etcdctl snapshot save /opt/backup.db \\\n  --endpoints=https://127.0.0.1:2379 \\\n  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\\n  --cert=/etc/kubernetes/pki/etcd/server.crt \\\n  --key=/etc/kubernetes/pki/etcd/server.key\n\nAll 4 flags (endpoints, cacert, cert, key) are required. The ETCDCTL_API=3 prefix selects v3 API.'
    }
  ],
  lab: {
    scenario: 'Your Kubernetes cluster is running v1.30.0 and needs to be upgraded to v1.31.0. You must upgrade both the control plane and a worker node following the correct kubeadm upgrade procedure.',
    objective: 'Practice the complete cluster upgrade sequence: kubeadm plan → apply on CP → drain → upgrade kubelet → uncordon on each node.',
    duration: '30-40 minutes',
    steps: [
      {
        title: 'Upgrade the Control Plane Node',
        instruction: `Simulate a control plane upgrade to v1.31.0:

1. Check the current cluster version
2. Check what versions are available
3. Upgrade kubeadm on the control plane
4. Run kubeadm upgrade plan to review changes
5. Apply the upgrade
6. Upgrade kubelet and kubectl, restart kubelet`,
        hints: [
          'apt-mark unhold releases a package from hold so it can be upgraded',
          'Run kubeadm upgrade plan before apply to see what will change',
          'The apt package format is version=1.31.0-1.1 (no v prefix)',
          'After kubelet upgrade: daemon-reload then restart'
        ],
        solution: `\`\`\`bash
# Check current version
kubectl get nodes
kubectl version --short

# On the control plane node:
# Step 1: Upgrade kubeadm
apt-mark unhold kubeadm
apt-get update && apt-get install -y kubeadm=1.31.0-1.1
apt-mark hold kubeadm
kubeadm version

# Step 2: Plan the upgrade
kubeadm upgrade plan
# Review output — shows what will be upgraded

# Step 3: Apply the upgrade
sudo kubeadm upgrade apply v1.31.0
# Confirm with 'y' when prompted

# Step 4: Drain the control plane
kubectl drain controlplane --ignore-daemonsets

# Step 5: Upgrade kubelet and kubectl
apt-mark unhold kubelet kubectl
apt-get install -y kubelet=1.31.0-1.1 kubectl=1.31.0-1.1
apt-mark hold kubelet kubectl

# Step 6: Restart kubelet
sudo systemctl daemon-reload
sudo systemctl restart kubelet

# Step 7: Uncordon
kubectl uncordon controlplane

# Verify
kubectl get nodes
\`\`\``,
        verify: `\`\`\`bash
# Control plane should show new version
kubectl get nodes
# Expected: controlplane   Ready   control-plane   <age>   v1.31.0

# API server version
kubectl version --short | grep Server
# Expected: Server Version: v1.31.0

# kubeadm version
kubeadm version -o short
# Expected: v1.31.0
\`\`\``
      },
      {
        title: 'Upgrade a Worker Node',
        instruction: `Now upgrade worker node01 to v1.31.0:

1. From the control plane: drain node01
2. SSH to node01: upgrade kubeadm and run kubeadm upgrade node
3. SSH to node01: upgrade kubelet and kubectl, restart
4. Back on control plane: uncordon node01
5. Verify both nodes are v1.31.0`,
        hints: [
          'Drain is run FROM the control plane: kubectl drain node01 --ignore-daemonsets --delete-emptydir-data',
          'SSH to the worker: ssh node01',
          'On worker: kubeadm upgrade node (not apply)',
          'After returning to CP: kubectl uncordon node01'
        ],
        solution: `\`\`\`bash
# === ON CONTROL PLANE ===
kubectl drain node01 --ignore-daemonsets --delete-emptydir-data

# Verify node is cordoned
kubectl get nodes
# node01 should show: SchedulingDisabled

# === SSH TO WORKER NODE ===
ssh node01

# Upgrade kubeadm
apt-mark unhold kubeadm
apt-get update && apt-get install -y kubeadm=1.31.0-1.1
apt-mark hold kubeadm

# Upgrade node configuration (important: "node" not "apply")
sudo kubeadm upgrade node

# Upgrade kubelet and kubectl
apt-mark unhold kubelet kubectl
apt-get install -y kubelet=1.31.0-1.1 kubectl=1.31.0-1.1
apt-mark hold kubelet kubectl

# Restart kubelet
sudo systemctl daemon-reload
sudo systemctl restart kubelet

# Exit back to control plane
exit

# === BACK ON CONTROL PLANE ===
kubectl uncordon node01

# Verify both nodes are upgraded
kubectl get nodes
\`\`\``,
        verify: `\`\`\`bash
# Both nodes should show v1.31.0
kubectl get nodes
# Expected:
# NAME           STATUS   ROLES           AGE   VERSION
# controlplane   Ready    control-plane   Xd    v1.31.0
# node01         Ready    <none>          Xd    v1.31.0

# node01 must be Ready (not SchedulingDisabled)
kubectl get node node01
# Expected: STATUS = Ready (not SchedulingDisabled)

# Verify workloads are running
kubectl get pods -A | grep -v Running
# Expected: only system pods, all should be Running
\`\`\``
      },
      {
        title: 'Generate a Node Join Command',
        instruction: `A new worker node needs to join the cluster. The original join token from kubeadm init has expired. Generate a new join command and use it conceptually.

1. Check if any tokens still exist
2. Generate a new token
3. Print the full join command for a new worker node`,
        hints: [
          'kubeadm token list shows existing tokens',
          'kubeadm token create --print-join-command generates AND shows the join command',
          'Tokens expire after 24 hours by default',
          'You can set a longer TTL: kubeadm token create --ttl 48h'
        ],
        solution: `\`\`\`bash
# Check existing tokens (may be expired)
kubeadm token list
# Shows: TOKEN, TTL, EXPIRES, USAGES, DESCRIPTION, EXTRA GROUPS

# Create a new token and print the join command
kubeadm token create --print-join-command
# Output example:
# kubeadm join 10.0.0.1:6443 --token <token> --discovery-token-ca-cert-hash sha256:<hash>

# Create a token with custom TTL
kubeadm token create --ttl 48h --print-join-command

# On the NEW worker node, run the printed join command:
# kubeadm join 10.0.0.1:6443 \
#   --token <token> \
#   --discovery-token-ca-cert-hash sha256:<hash>

# After joining, on control plane verify the node appears
kubectl get nodes
\`\`\``,
        verify: `\`\`\`bash
# Verify token was created
kubeadm token list
# Expected: shows new token with future EXPIRES time

# Verify join command is complete (has token + hash)
kubeadm token create --print-join-command 2>/dev/null
# Expected: full kubeadm join command with --token and --discovery-token-ca-cert-hash flags

# If a new node joined, verify it appears
kubectl get nodes
# Expected: new node in NotReady (before CNI) or Ready state
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Worker Node Shows OldVersion After Upgrade',
      difficulty: 'medium',
      symptom: 'After running the upgrade procedure on a worker node, kubectl get nodes still shows the old Kubernetes version (e.g., v1.30.0) for that node.',
      diagnosis: `\`\`\`bash
# Check what the node reports
kubectl get nodes
# node01 still shows old version

# SSH to the worker node
ssh node01

# Check kubelet version
kubelet --version
# May show old version — binary wasn't upgraded

# Check kubelet service status
sudo systemctl status kubelet
# May show Active: failed or old binary path

# Check if daemon-reload was done
sudo journalctl -u kubelet --since "5 minutes ago"
# Look for error messages

# Verify the installed kubelet version
dpkg -l kubelet | grep kubelet
# Check if new version is actually installed
\`\`\``,
      solution: `Common causes and fixes:

**Cause A: kubelet binary wasn't upgraded**
\`\`\`bash
# On worker node
apt-get install -y kubelet=1.31.0-1.1 kubectl=1.31.0-1.1
sudo systemctl daemon-reload
sudo systemctl restart kubelet

# Verify
kubelet --version  # Should show v1.31.0
\`\`\`

**Cause B: daemon-reload skipped**
\`\`\`bash
# systemd is still using the cached old service definition
sudo systemctl daemon-reload
sudo systemctl restart kubelet
\`\`\`

**Cause C: kubeadm upgrade node wasn't run**
\`\`\`bash
# The node config must be upgraded too
apt-get install -y kubeadm=1.31.0-1.1
sudo kubeadm upgrade node
\`\`\`

After fixing, uncordon if node was drained:
\`\`\`bash
# On control plane
kubectl uncordon node01
kubectl get nodes  # Verify version update
\`\`\``
    },
    {
      title: 'kubeadm upgrade apply Fails — Preflight Error',
      difficulty: 'hard',
      symptom: 'Running "kubeadm upgrade apply v1.31.0" fails with preflight errors like "unable to upgrade: cluster is not in an upgradeable state", version skew errors, or connectivity errors to the API server.',
      diagnosis: `\`\`\`bash
# Check the full error output from kubeadm upgrade apply
sudo kubeadm upgrade apply v1.31.0 -v5

# Check cluster status
kubectl get nodes
kubectl get pods -A | grep -v Running

# Check etcd health
kubectl get pod etcd-controlplane -n kube-system
ETCDCTL_API=3 etcdctl endpoint health \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key

# Check control plane component health
kubectl get pod -n kube-system | grep -E "apiserver|controller|scheduler|etcd"

# Verify kubeadm version installed
kubeadm version -o short
\`\`\``,
      solution: `Common causes and fixes:

**Cause A: Version skew — trying to skip minor versions**
\`\`\`bash
# Kubernetes only supports N+1 minor version upgrades
# Cannot go from 1.29 to 1.31 directly — must go through 1.30

# Fix: upgrade to 1.30 first, then to 1.31
sudo kubeadm upgrade apply v1.30.x
# Then later:
sudo kubeadm upgrade apply v1.31.0
\`\`\`

**Cause B: kubeadm version doesn't match target version**
\`\`\`bash
# kubeadm must be same version as the target
kubeadm version  # Must show v1.31.x to upgrade to v1.31.0

# Fix: install matching kubeadm first
apt-get install -y kubeadm=1.31.0-1.1
\`\`\`

**Cause C: Unhealthy cluster components**
\`\`\`bash
# Fix unhealthy pods first
kubectl describe pod -n kube-system <unhealthy-pod>
# Look for resource, config, or image issues

# Check static pod manifests for errors
ls /etc/kubernetes/manifests/
cat /etc/kubernetes/manifests/kube-apiserver.yaml
\`\`\``
    }
  ]
};
