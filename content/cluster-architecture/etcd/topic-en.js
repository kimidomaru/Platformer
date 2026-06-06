window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['cluster-architecture/etcd'] = {
  theory: `
# ETCD Backup & Restore

## Exam Relevance
> ETCD backup and restore appears on **every CKA exam**. It is one of the most critical hands-on tasks. You must be able to take a snapshot, verify it, and restore the cluster state from it — under time pressure.

## Core Concepts

**etcd** is the distributed key-value store that persists all Kubernetes cluster state:
- All API objects (pods, services, deployments, secrets, configmaps...)
- Cluster membership and configuration
- RBAC policies

Without etcd, Kubernetes cannot function. A corrupted or lost etcd means losing all cluster state.

### etcd Architecture

\`\`\`
kubectl → kube-apiserver → etcd (cluster state)
                         ↑
                         └─ All state is here
\`\`\`

In a typical kubeadm cluster, etcd runs as a **static pod** on the control plane node:
- Manifest: \`/etc/kubernetes/manifests/etcd.yaml\`
- Data directory: \`/var/lib/etcd\` (default)
- Certificates: \`/etc/kubernetes/pki/etcd/\`

### Key etcd Files

\`\`\`bash
/etc/kubernetes/manifests/etcd.yaml    # static pod manifest
/var/lib/etcd/                         # data directory
/etc/kubernetes/pki/etcd/ca.crt        # CA certificate
/etc/kubernetes/pki/etcd/server.crt    # server certificate
/etc/kubernetes/pki/etcd/server.key    # server key
\`\`\`

## Backup — \`etcdctl snapshot save\`

### Step 1: Identify etcd parameters

\`\`\`bash
# Check etcd pod for the endpoints and cert paths
kubectl describe pod etcd-<controlplane-node> -n kube-system
# OR
cat /etc/kubernetes/manifests/etcd.yaml
# Look for: --listen-client-urls, --cert-file, --key-file, --trusted-ca-file
\`\`\`

### Step 2: Take the snapshot

\`\`\`bash
ETCDCTL_API=3 etcdctl snapshot save /opt/backup/etcd-backup.db \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt \\
  --key=/etc/kubernetes/pki/etcd/server.key

# Verify the snapshot
ETCDCTL_API=3 etcdctl snapshot status /opt/backup/etcd-backup.db \\
  --write-out=table
\`\`\`

Expected output:
\`\`\`
+----------+----------+------------+------------+
|   HASH   | REVISION | TOTAL KEYS | TOTAL SIZE |
+----------+----------+------------+------------+
| abc12345 |    12345 |       1000 |    6.5 MB  |
+----------+----------+------------+------------+
\`\`\`

## Restore — \`etcdctl snapshot restore\`

### Step 1: Restore snapshot to new directory

\`\`\`bash
ETCDCTL_API=3 etcdctl snapshot restore /opt/backup/etcd-backup.db \\
  --data-dir=/var/lib/etcd-restored \\
  --name=master \\
  --initial-cluster=master=https://127.0.0.1:2380 \\
  --initial-cluster-token=etcd-cluster-1 \\
  --initial-advertise-peer-urls=https://127.0.0.1:2380
\`\`\`

### Step 2: Update etcd static pod to use new data directory

\`\`\`bash
# Edit the static pod manifest
vi /etc/kubernetes/manifests/etcd.yaml

# Change the data-dir argument:
# FROM: --data-dir=/var/lib/etcd
# TO:   --data-dir=/var/lib/etcd-restored

# Also update the hostPath volume:
# volumes:
#   - hostPath:
#       path: /var/lib/etcd-restored   ← change this
#       type: DirectoryOrCreate
#     name: etcd-data
\`\`\`

### Step 3: Verify etcd restarts

\`\`\`bash
# Watch for etcd pod to restart with new data dir
watch -n1 "kubectl get pods -n kube-system | grep etcd"

# It may take 1-2 minutes for the static pod to restart
# The kubelet automatically detects the manifest change

# Verify cluster is healthy
kubectl get nodes
kubectl get pods -A
\`\`\`

## Complete Backup Script

\`\`\`bash
#!/bin/bash
BACKUP_DIR=/opt/etcd-backups
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/snapshot-$TIMESTAMP.db"

mkdir -p $BACKUP_DIR

ETCDCTL_API=3 etcdctl snapshot save $BACKUP_FILE \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt \\
  --key=/etc/kubernetes/pki/etcd/server.key

echo "Backup saved: $BACKUP_FILE"
ETCDCTL_API=3 etcdctl snapshot status $BACKUP_FILE --write-out=table
\`\`\`

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| \`authentication handshake failed\` | Wrong cert paths | Verify cert paths from etcd.yaml |
| \`context deadline exceeded\` | Wrong endpoint or etcd not reachable | Check \`--endpoints\` (usually 127.0.0.1:2379) |
| etcd pod stuck after restore | Wrong data-dir in manifest | Check hostPath and --data-dir match |
| \`snapshot file corrupt\` | Incomplete backup | Retake backup |
| API server not available after restore | etcd still starting | Wait 2-3 min; check kubelet logs |

## Killer.sh Style Challenge

> **Task**: Take an etcd snapshot to \`/opt/snapshot.db\`. Then simulate disaster by deleting all pods in namespace \`production\`. Restore the etcd from the snapshot and verify the pods return.

\`\`\`bash
# 1. Backup
ETCDCTL_API=3 etcdctl snapshot save /opt/snapshot.db \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt \\
  --key=/etc/kubernetes/pki/etcd/server.key

# 2. Simulate disaster
kubectl delete pods --all -n production --force

# 3. Restore
ETCDCTL_API=3 etcdctl snapshot restore /opt/snapshot.db \\
  --data-dir=/var/lib/etcd-from-backup

# 4. Update /etc/kubernetes/manifests/etcd.yaml:
#    --data-dir=/var/lib/etcd-from-backup

# 5. Verify
kubectl get pods -n production
\`\`\`
`,
  quiz: [
    {
      question: 'Which environment variable must be set to use the v3 etcdctl API?',
      options: [
        'ETCD_VERSION=3',
        'ETCDCTL_API=3',
        'ETCD_API_VERSION=v3',
        'ETCDCTL_VERSION=3'
      ],
      correct: 1,
      explanation: '`ETCDCTL_API=3` must be set to use the etcd v3 API. Without it, etcdctl defaults to v2, which uses a different command set. All CKA tasks use the v3 API.',
      reference: 'Prepend to every etcdctl command or export: export ETCDCTL_API=3'
    },
    {
      question: 'Which 3 certificate files are required for etcdctl to authenticate to etcd?',
      options: [
        'ca.crt, client.crt, client.key (from /etc/kubernetes/pki/)',
        'ca.crt, server.crt, server.key (from /etc/kubernetes/pki/etcd/)',
        'etcd.crt, etcd.key, etcd-ca.crt (from /etc/etcd/)',
        'kube-apiserver.crt, kube-apiserver.key, ca.crt'
      ],
      correct: 1,
      explanation: 'etcdctl needs: `--cacert` (CA cert), `--cert` (client/server cert), `--key` (private key). For a kubeadm cluster, these are at `/etc/kubernetes/pki/etcd/ca.crt`, `server.crt`, and `server.key`.',
      reference: 'Always check cert paths from the etcd static pod: cat /etc/kubernetes/manifests/etcd.yaml'
    },
    {
      question: 'After restoring an etcd snapshot to a new directory `/var/lib/etcd-new`, what else must you change?',
      options: [
        'Nothing — etcd automatically detects the new directory',
        'Only the `--data-dir` flag in /etc/kubernetes/manifests/etcd.yaml',
        'Both the `--data-dir` argument AND the hostPath volume in /etc/kubernetes/manifests/etcd.yaml',
        'The kubeconfig file and the API server certificate'
      ],
      correct: 2,
      explanation: 'The etcd static pod manifest has two references to the data directory: `--data-dir` in the command arguments AND `hostPath.path` in the volumes section. Both must point to the new directory.',
      reference: 'Exam trap: forgetting to update the hostPath volume causes etcd to still use the old directory.'
    },
    {
      question: 'Which command verifies that an etcd snapshot file is valid and shows its size?',
      options: [
        'etcdctl snapshot verify /path/to/snapshot.db',
        'etcdctl snapshot status /path/to/snapshot.db --write-out=table',
        'etcdctl check snapshot /path/to/snapshot.db',
        'etcdctl validate /path/to/snapshot.db'
      ],
      correct: 1,
      explanation: '`etcdctl snapshot status` displays the snapshot hash, revision, total keys, and total size. The `--write-out=table` flag formats the output as a readable table.',
      reference: 'Always verify the snapshot immediately after taking it to ensure it is not corrupt.'
    },
    {
      question: 'Where is the etcd data stored in a default kubeadm cluster?',
      options: [
        '/etc/etcd/data',
        '/var/lib/etcd',
        '/etc/kubernetes/etcd',
        '/var/data/etcd'
      ],
      correct: 1,
      explanation: 'In a kubeadm cluster, etcd stores its data at `/var/lib/etcd` by default. This path is configured via `--data-dir=/var/lib/etcd` in the etcd static pod manifest.',
      reference: 'Check: grep data-dir /etc/kubernetes/manifests/etcd.yaml'
    },
    {
      question: 'After updating the etcd manifest to point to the restored data directory, how does the static pod restart?',
      options: [
        'You must run `systemctl restart etcd`',
        'You must run `kubectl rollout restart pod etcd`',
        'The kubelet automatically detects the manifest change and restarts the static pod',
        'You must manually delete and re-apply the manifest'
      ],
      correct: 2,
      explanation: 'Static pods are managed directly by the kubelet watching the `/etc/kubernetes/manifests/` directory. When the manifest file changes, the kubelet automatically kills the old container and starts a new one.',
      reference: 'Static pods: no controller, no ReplicaSet — kubelet watches the manifest directory directly.'
    },
    {
      question: 'What is the default etcd client endpoint for a kubeadm cluster?',
      options: [
        'http://localhost:2380',
        'https://127.0.0.1:2380',
        'https://127.0.0.1:2379',
        'https://etcd.kube-system.svc:2379'
      ],
      correct: 2,
      explanation: 'Port 2379 is for client communications (snapshot, get, put). Port 2380 is for peer-to-peer communication between etcd nodes. Always use `https://127.0.0.1:2379` for client commands.',
      reference: '2379 = client port. 2380 = peer/cluster port. Never confuse them in exam tasks.'
    },
    {
      question: 'You need to find the exact certificate paths to use with etcdctl. What is the fastest way?',
      options: [
        'Read the Kubernetes documentation',
        'Run `cat /etc/kubernetes/manifests/etcd.yaml` and look for --cert-file, --key-file, --trusted-ca-file',
        'Run `kubectl get pod etcd -n kube-system -o yaml`',
        'Check /etc/etcd/etcd.conf'
      ],
      correct: 1,
      explanation: 'The etcd static pod manifest contains all certificate paths as command arguments. Look for `--cert-file`, `--key-file`, and `--trusted-ca-file`. This is the most reliable source.',
      reference: 'Or: kubectl describe pod etcd-<node> -n kube-system | grep -E "cert|key|ca"'
    }
  ],
  flashcards: [
    {
      front: 'What is the complete etcdctl command to take a snapshot?',
      back: '```bash\nETCDCTL_API=3 etcdctl snapshot save /path/to/backup.db \\\n  --endpoints=https://127.0.0.1:2379 \\\n  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\\n  --cert=/etc/kubernetes/pki/etcd/server.crt \\\n  --key=/etc/kubernetes/pki/etcd/server.key\n```\n\nAlways verify after:\n```bash\nETCDCTL_API=3 etcdctl snapshot status backup.db --write-out=table\n```'
    },
    {
      front: 'What 4 flags does etcdctl need to authenticate to etcd?',
      back: '1. `--endpoints=https://127.0.0.1:2379` — etcd client port\n2. `--cacert=/etc/kubernetes/pki/etcd/ca.crt` — CA certificate\n3. `--cert=/etc/kubernetes/pki/etcd/server.crt` — client certificate\n4. `--key=/etc/kubernetes/pki/etcd/server.key` — private key\n\nFind paths from: `cat /etc/kubernetes/manifests/etcd.yaml`'
    },
    {
      front: 'After restoring etcd to a new directory, what 2 things must you update in etcd.yaml?',
      back: '```yaml\n# 1. The --data-dir argument:\n- --data-dir=/var/lib/etcd-restored  # was /var/lib/etcd\n\n# 2. The hostPath volume mount:\nvolumes:\n- hostPath:\n    path: /var/lib/etcd-restored  # was /var/lib/etcd\n    type: DirectoryOrCreate\n  name: etcd-data\n```\n\nBoth must point to the SAME new directory.'
    },
    {
      front: 'What is the difference between etcd ports 2379 and 2380?',
      back: '**Port 2379** = Client port\n- Used by: kube-apiserver, etcdctl\n- Use in: `--endpoints=https://127.0.0.1:2379`\n\n**Port 2380** = Peer port\n- Used by: etcd nodes to communicate with each other (clustering)\n- Do NOT use for etcdctl commands\n\n`--listen-client-urls=https://127.0.0.1:2379`\n`--listen-peer-urls=https://127.0.0.1:2380`'
    },
    {
      front: 'Where are etcd certificates located in a kubeadm cluster?',
      back: '```bash\n/etc/kubernetes/pki/etcd/\n├── ca.crt          # CA certificate (--cacert)\n├── ca.key          # CA private key\n├── server.crt      # Server cert (--cert)\n├── server.key      # Server key (--key)\n├── peer.crt\n├── peer.key\n├── healthcheck-client.crt\n└── healthcheck-client.key\n```\n\nAlso check the etcd manifest: `cat /etc/kubernetes/manifests/etcd.yaml`'
    },
    {
      front: 'How do you check the etcd snapshot details after backup?',
      back: '```bash\nETCDCTL_API=3 etcdctl snapshot status /opt/backup.db \\\n  --write-out=table\n```\n\nOutput shows:\n- HASH (integrity check)\n- REVISION (etcd revision at time of backup)\n- TOTAL KEYS (number of objects)\n- TOTAL SIZE (snapshot file size)\n\nIf any of these are 0 or corrupt, retake the backup.'
    },
    {
      front: 'Why does the etcd static pod restart after changing its manifest?',
      back: 'Static pods are managed **directly by the kubelet**, not by the kube-scheduler or controllers.\n\nThe kubelet watches `/etc/kubernetes/manifests/` for changes. When the manifest file is modified, the kubelet:\n1. Stops the current container\n2. Starts a new container with the updated spec\n\nNo manual restart needed — but wait 1-3 minutes for the pod to become Ready.'
    },
    {
      front: 'What is the etcdctl snapshot restore command?',
      back: '```bash\nETCDCTL_API=3 etcdctl snapshot restore /opt/backup.db \\\n  --data-dir=/var/lib/etcd-restored\n```\n\nOptional flags for multi-node clusters:\n```bash\n  --name=master \\\n  --initial-cluster=master=https://127.0.0.1:2380 \\\n  --initial-cluster-token=etcd-cluster-1 \\\n  --initial-advertise-peer-urls=https://127.0.0.1:2380\n```\n\nFor single-node exam clusters, just `--data-dir` is usually sufficient.'
    }
  ],
  lab: {
    scenario: 'Simulate a complete etcd backup and restore cycle, including a data loss event and full recovery.',
    objective: 'Take an etcd snapshot, simulate data loss, restore from backup, and verify cluster state.',
    duration: '25-35 minutes',
    steps: [
      {
        title: 'Take an etcd Snapshot',
        instruction: `Find the etcd certificate paths from the static pod manifest, then take a snapshot to \`/opt/etcd-backup.db\`. Verify the snapshot is valid.`,
        hints: [
          'Find cert paths: \`cat /etc/kubernetes/manifests/etcd.yaml | grep -E "cert|key|ca"\`',
          'Use ETCDCTL_API=3 prefix for all etcdctl commands',
          'Endpoint is usually https://127.0.0.1:2379',
          'Verify with: etcdctl snapshot status --write-out=table'
        ],
        solution: `\`\`\`bash
# Find cert paths from etcd manifest
cat /etc/kubernetes/manifests/etcd.yaml | grep -E "cert-file|key-file|trusted-ca"

# Create backup directory
mkdir -p /opt

# Take snapshot
ETCDCTL_API=3 etcdctl snapshot save /opt/etcd-backup.db \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt \\
  --key=/etc/kubernetes/pki/etcd/server.key

# Verify snapshot
ETCDCTL_API=3 etcdctl snapshot status /opt/etcd-backup.db \\
  --write-out=table
\`\`\``,
        verify: `\`\`\`bash
ls -lh /opt/etcd-backup.db
# Expected: file exists, non-zero size

ETCDCTL_API=3 etcdctl snapshot status /opt/etcd-backup.db --write-out=table
# Expected: table with HASH, REVISION, TOTAL KEYS, TOTAL SIZE
# All values should be non-zero

echo $?
# Expected: 0 (success)
\`\`\``
      },
      {
        title: 'Simulate Data Loss and Restore',
        instruction: `Before restoring:
1. Create a canary namespace \`pre-backup-test\` and a pod in it
2. Restore the etcd snapshot to \`/var/lib/etcd-from-backup\`
3. Update \`/etc/kubernetes/manifests/etcd.yaml\` to use the new data directory
4. Wait for etcd to restart and verify the canary namespace is gone (was created AFTER the backup)`,
        hints: [
          'Create the canary namespace AFTER taking the backup (it should disappear after restore)',
          'etcdctl snapshot restore uses --data-dir flag',
          'Edit etcd.yaml: change --data-dir AND the hostPath volume path',
          'Watch for etcd pod restart with: kubectl get pods -n kube-system -w'
        ],
        solution: `\`\`\`bash
# Create something AFTER the backup (will disappear after restore)
kubectl create namespace post-backup-marker

# Restore snapshot to new directory
ETCDCTL_API=3 etcdctl snapshot restore /opt/etcd-backup.db \\
  --data-dir=/var/lib/etcd-from-backup

# Update etcd manifest to use new data dir
# IMPORTANT: Change BOTH the --data-dir arg AND hostPath volume
cp /etc/kubernetes/manifests/etcd.yaml /etc/kubernetes/manifests/etcd.yaml.bak

sed -i 's|/var/lib/etcd|/var/lib/etcd-from-backup|g' \\
  /etc/kubernetes/manifests/etcd.yaml

# Wait for etcd to restart (1-3 minutes)
sleep 30
kubectl get pods -n kube-system | grep etcd

# After etcd restarts, verify canary namespace is gone
kubectl get namespace post-backup-marker
\`\`\``,
        verify: `\`\`\`bash
# Check etcd is running with new data dir
grep "data-dir" /etc/kubernetes/manifests/etcd.yaml
# Expected: /var/lib/etcd-from-backup

kubectl get pods -n kube-system | grep etcd
# Expected: etcd pod Running

kubectl get namespace post-backup-marker
# Expected: Error "not found" — this was created AFTER the backup

kubectl get nodes
# Expected: nodes in Ready state

kubectl get pods -A | grep -v "Completed"
# Expected: system pods running normally
\`\`\``
      },
      {
        title: 'Verify Full Cluster Recovery',
        instruction: `After the restore, verify that:
1. All kube-system pods are running
2. The API server is responsive
3. A new pod can be created (cluster is functional)
4. Check that the etcd pod is using the restored data directory`,
        hints: [
          'It can take 2-5 minutes for all control plane components to stabilize after etcd restore',
          'Use \`kubectl get pods -n kube-system\` to monitor recovery',
          'Create a test pod to confirm the cluster is operational',
          'Check /var/lib/etcd-from-backup exists and has files'
        ],
        solution: `\`\`\`bash
# Wait for all system pods to be ready
kubectl get pods -n kube-system
# If some are still starting, wait a few minutes

# Test cluster functionality
kubectl run recovery-test --image=nginx --restart=Never

# Check etcd data directory
ls -la /var/lib/etcd-from-backup/
# Should contain etcd member data

# Verify etcd is running with correct data dir
kubectl describe pod etcd-controlplane -n kube-system | grep data-dir
# Expected: --data-dir=/var/lib/etcd-from-backup

# Final health check
kubectl get nodes
kubectl get pods -n kube-system | grep -v Running
# Ideally: empty (all pods running)
\`\`\``,
        verify: `\`\`\`bash
kubectl get nodes
# Expected: all nodes Ready

kubectl get pods -n kube-system | grep -v Running | grep -v Completed
# Expected: empty or minimal (no stuck/failed pods)

kubectl get pod recovery-test
# Expected: Running or Completed

ls /var/lib/etcd-from-backup/member/
# Expected: directory with etcd member data (snap, wal folders)
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'etcdctl authentication fails — wrong certificate paths',
      difficulty: 'easy',
      symptom: '`etcdctl snapshot save` returns `authentication handshake failed` or `certificate signed by unknown authority`.',
      diagnosis: `\`\`\`bash
# Test connectivity first
curl -k https://127.0.0.1:2379/health

# Check the cert paths you are using
echo "Endpoint: https://127.0.0.1:2379"

# Find correct cert paths from etcd manifest
cat /etc/kubernetes/manifests/etcd.yaml | grep -E "(cert|key|ca)"

# Common paths in kubeadm:
ls -la /etc/kubernetes/pki/etcd/
\`\`\``,
      solution: `The certificate paths are wrong or files don't exist at those paths.

\`\`\`bash
# Get EXACT paths from the etcd pod manifest
grep -E "cert-file|key-file|trusted-ca-file" /etc/kubernetes/manifests/etcd.yaml

# Typical kubeadm values:
# --trusted-ca-file=/etc/kubernetes/pki/etcd/ca.crt
# --cert-file=/etc/kubernetes/pki/etcd/server.crt
# --key-file=/etc/kubernetes/pki/etcd/server.key

# Verify files exist
ls -la /etc/kubernetes/pki/etcd/ca.crt
ls -la /etc/kubernetes/pki/etcd/server.crt
ls -la /etc/kubernetes/pki/etcd/server.key

# Retry with correct paths
ETCDCTL_API=3 etcdctl snapshot save /opt/backup.db \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt \\
  --key=/etc/kubernetes/pki/etcd/server.key
\`\`\``
    },
    {
      title: 'etcd pod not starting after restore — manifest issue',
      difficulty: 'hard',
      symptom: 'After updating etcd.yaml for the restore, the etcd pod keeps restarting or the API server becomes unreachable. `kubectl` commands hang or return connection errors.',
      diagnosis: `\`\`\`bash
# kubectl may not work — use crictl or check kubelet logs
crictl ps -a | grep etcd

# Check kubelet logs for manifest errors
journalctl -u kubelet | tail -50
# Look for: "Failed to create pod" or "Error syncing pod"

# Check etcd container logs
crictl logs $(crictl ps -a | grep etcd | awk '{print $1}')

# Verify the manifest is valid YAML
cat /etc/kubernetes/manifests/etcd.yaml | python3 -c "import sys,yaml; yaml.safe_load(sys.stdin)"

# Check the data directory exists
ls -la /var/lib/etcd-from-backup/
\`\`\``,
      solution: `Most common causes after a restore:

**1. Data directory doesn't exist or wrong path:**
\`\`\`bash
# Verify the restore created the directory
ls /var/lib/etcd-from-backup/member/

# If empty — redo the restore
ETCDCTL_API=3 etcdctl snapshot restore /opt/backup.db \\
  --data-dir=/var/lib/etcd-from-backup
\`\`\`

**2. hostPath volume not updated (most common exam mistake):**
\`\`\`bash
# Check etcd.yaml — BOTH references must point to new dir
grep -A3 "hostPath" /etc/kubernetes/manifests/etcd.yaml
grep "data-dir" /etc/kubernetes/manifests/etcd.yaml

# Both should show: /var/lib/etcd-from-backup
# If not, fix and save

# Force kubelet to re-read manifest
mv /etc/kubernetes/manifests/etcd.yaml /tmp/etcd.yaml.bak
sleep 5
mv /tmp/etcd.yaml.bak /etc/kubernetes/manifests/etcd.yaml
\`\`\`

**3. Restore to original directory (simplest fix for exam):**
\`\`\`bash
# Alternative: restore to original location
systemctl stop etcd   # if running as systemd service
rm -rf /var/lib/etcd/*
ETCDCTL_API=3 etcdctl snapshot restore /opt/backup.db \\
  --data-dir=/var/lib/etcd
# No manifest change needed!
\`\`\``
    },
    {
      title: 'Failed etcd HA member: remove the broken one and add a new one',
      difficulty: 'hard',
      symptom: 'In a 3-member etcd cluster (HA), one node died. `etcdctl member list` shows a member as unreachable/unstarted and the cluster works but lost fault tolerance. You need to replace the broken member.',
      diagnosis: `\`\`\`bash
# Alias to shorten (run on a healthy member node)
alias e='ETCDCTL_API=3 etcdctl \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt \\
  --key=/etc/kubernetes/pki/etcd/server.key'

# 1. List members and identify the broken one
e member list -w table
# Look for the member with no name (unstarted) or whose node is down

# 2. Confirm per-endpoint health (the dead member fails)
e endpoint health --cluster

# 3. Note the hex ID of the broken member (1st column of member list)
\`\`\``,
      solution: `**Correct sequence: REMOVE the broken member BEFORE adding the new one** (etcd requires quorum; never add a 4th member to an already-degraded cluster without removing the dead one first).

\`\`\`bash
# 1. Remove the broken member by ID (e.g. 8211f1d0f64f3269)
e member remove 8211f1d0f64f3269
# Now the cluster has 2 healthy members (quorum kept)

# 2. Add the new member (stays "unstarted" until it comes up)
e member add etcd-node3 \\
  --peer-urls=https://10.0.0.13:2380
# The output prints env variables (ETCD_NAME,
# ETCD_INITIAL_CLUSTER, ETCD_INITIAL_CLUSTER_STATE=existing)
\`\`\`

**3. On the NEW node**, start etcd with \`--initial-cluster-state=existing\` and the returned \`--initial-cluster\`:
\`\`\`bash
# Clear any old data-dir on the new node
rm -rf /var/lib/etcd/*

# In the new node etcd manifest/unit, ensure:
#   --initial-cluster-state=existing
#   --initial-cluster=etcd-node1=https://10.0.0.11:2380,etcd-node2=...,etcd-node3=https://10.0.0.13:2380
#   --name=etcd-node3
\`\`\`

**4. Validate the recovery:**
\`\`\`bash
e member list -w table          # 3 members, all started
e endpoint health --cluster     # all healthy
\`\`\`

**Pitfalls:**
- Adding before removing breaks quorum (3→4 with 1 dead = only 2 of 4 alive, no majority).
- Forgetting to clear the new node data-dir causes "member already bootstrapped".
- Use \`--initial-cluster-state=existing\` (not \`new\`) when joining an existing cluster.

**Prevention:** keep an ODD number of members (3 or 5) and monitor \`etcd_server_has_leader\` in Prometheus.`
    }
  ]
};
