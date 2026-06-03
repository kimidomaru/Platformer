window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['troubleshooting/cluster-troubleshooting'] = {
  theory: `
# Cluster & Node Troubleshooting

## Exam Relevance
> Cluster and node troubleshooting is a major part of the CKA Troubleshooting domain (30%). Expect tasks diagnosing broken nodes (NotReady), failed kubelets, and broken control plane components.

## Node Status — Understanding Conditions

\`\`\`bash
kubectl get nodes
# NAME         STATUS     ROLES    AGE   VERSION
# worker-1     NotReady   <none>   10d   v1.29.0
# controlplane Ready      master   10d   v1.29.0
\`\`\`

### Node Conditions

\`\`\`bash
kubectl describe node <node-name> | grep -A5 "Conditions:"
\`\`\`

| Condition | Normal | Problem |
|-----------|--------|---------|
| **Ready** | True | False, Unknown |
| **DiskPressure** | False | True — low disk space |
| **MemoryPressure** | False | True — low memory |
| **PIDPressure** | False | True — too many PIDs |
| **NetworkUnavailable** | False | True — CNI issue |

## Debugging a NotReady Node

### Step 1: Check Node Conditions and Events

\`\`\`bash
kubectl describe node <node-name>
# Look for: Conditions, Events, Capacity, Allocated resources
\`\`\`

### Step 2: Check Kubelet (the node agent)

\`\`\`bash
# On the affected node (SSH required):
systemctl status kubelet

# If not running:
systemctl start kubelet

# View kubelet logs
journalctl -u kubelet -n 100 --no-pager

# Follow live:
journalctl -u kubelet -f
\`\`\`

### Step 3: Common Kubelet Issues

\`\`\`bash
# Kubelet cannot connect to API server
journalctl -u kubelet | grep "error\|unable\|failed"
# Look for: "failed to get node", "connection refused"

# Check kubelet config
cat /etc/kubernetes/kubelet.conf    # kubeconfig for kubelet
cat /var/lib/kubelet/config.yaml    # kubelet configuration

# Kubelet is not registered
# Look for: "node not found" — node may need re-joining

# Container runtime not working
crictl info                         # test container runtime (CRI)
systemctl status containerd         # or docker
\`\`\`

### Step 4: Check Container Runtime

\`\`\`bash
# containerd
systemctl status containerd
journalctl -u containerd -n 50

# Docker (if used)
systemctl status docker
journalctl -u docker -n 50

# Test runtime
crictl ps -a                        # list all containers
crictl images                       # list images
\`\`\`

## Control Plane Component Troubleshooting

In a kubeadm cluster, control plane components run as **static pods**:

\`\`\`bash
# Check all control plane pods
kubectl get pods -n kube-system

# Key components:
# kube-apiserver-<node>
# kube-controller-manager-<node>
# kube-scheduler-<node>
# etcd-<node>
\`\`\`

### API Server Troubleshooting

\`\`\`bash
# Check if API server is running (as static pod)
kubectl get pod kube-apiserver-controlplane -n kube-system

# If kubectl itself doesn't work, check the container:
crictl ps | grep kube-apiserver

# View API server logs
kubectl logs kube-apiserver-controlplane -n kube-system

# Or via crictl:
crictl logs $(crictl ps | grep kube-apiserver | awk '{print $1}')

# Check the static pod manifest
cat /etc/kubernetes/manifests/kube-apiserver.yaml
\`\`\`

### Scheduler Troubleshooting

\`\`\`bash
# Pods stuck in Pending despite resources available?
kubectl get pod kube-scheduler-controlplane -n kube-system

kubectl logs kube-scheduler-controlplane -n kube-system

# Check static pod manifest
cat /etc/kubernetes/manifests/kube-scheduler.yaml
\`\`\`

### Controller Manager Troubleshooting

\`\`\`bash
# Pods not being created despite ReplicaSet existing?
kubectl get pod kube-controller-manager-controlplane -n kube-system

kubectl logs kube-controller-manager-controlplane -n kube-system

cat /etc/kubernetes/manifests/kube-controller-manager.yaml
\`\`\`

## Node Draining and Maintenance

\`\`\`bash
# Cordon (prevent new pods from scheduling)
kubectl cordon <node-name>

# Drain (evict existing pods + cordon)
kubectl drain <node-name> \\
  --ignore-daemonsets \\    # skip DaemonSet pods (they can't be evicted)
  --delete-emptydir-data    # allow eviction of pods using emptyDir

# After maintenance: uncordon
kubectl uncordon <node-name>

# Check node status
kubectl get nodes
\`\`\`

## Essential Commands

\`\`\`bash
# Node status
kubectl get nodes -o wide
kubectl describe node <node-name>

# Control plane health
kubectl get pods -n kube-system
kubectl logs <pod-name> -n kube-system

# Node-side (requires SSH)
systemctl status kubelet
journalctl -u kubelet -n 100
crictl ps -a

# API server connectivity
kubectl cluster-info
kubectl get componentstatuses    # deprecated but sometimes still works

# kubeconfig check
kubectl config current-context
kubectl config view
cat ~/.kube/config
\`\`\`

## Common Errors

| Symptom | Cause | Fix |
|---------|-------|-----|
| Node NotReady | kubelet stopped | \`systemctl start kubelet\` |
| Pods not creating | Controller manager down | Check static pod manifest |
| Pods not scheduling | Scheduler down | Check scheduler static pod |
| kubectl connection refused | API server down | Check apiserver static pod |
| Node DiskPressure | Low disk space | Free disk or resize volume |
| Node MemoryPressure | Low memory | Free memory or scale node |

## Killer.sh Style Challenge

> **Scenario**: Node \`worker-1\` is NotReady. \`kubectl get nodes\` shows its status. SSH to the node, diagnose the kubelet failure, fix it, and verify the node returns to Ready state.

\`\`\`bash
# On controlplane:
kubectl describe node worker-1 | grep -A10 "Conditions:"

# SSH to worker-1:
ssh worker-1
systemctl status kubelet
journalctl -u kubelet -n 50
# Fix the issue (e.g., start kubelet, fix config)
systemctl start kubelet
systemctl enable kubelet

# Back on controlplane:
kubectl get nodes worker-1
# Expected: Ready
\`\`\`
`,
  quiz: [
    {
      question: 'A node shows `STATUS: NotReady`. What is the first thing you check on that node?',
      options: [
        'Restart the kube-apiserver',
        'Run `systemctl status kubelet` on the node',
        'Delete and re-create the node object',
        'Check `kubectl get events -n kube-system`'
      ],
      correct: 1,
      explanation: 'The kubelet is the node agent. When a node is NotReady, it almost always means the kubelet is down, crashed, or unable to communicate. Check its status with systemctl first.',
      reference: 'Debug sequence: kubelet status → kubelet logs → container runtime → network connectivity.'
    },
    {
      question: 'Which command shows the kubelet service logs on a Linux node?',
      options: [
        'kubectl logs kubelet -n kube-system',
        'journalctl -u kubelet -n 100',
        'cat /var/log/kubelet.log',
        'kubectl describe kubelet'
      ],
      correct: 1,
      explanation: 'The kubelet runs as a systemd service. `journalctl -u kubelet` shows its logs. Add `-n 100` for last 100 lines, `-f` to follow live. kubectl cannot be used to get kubelet logs since kubectl requires the API server to be working.',
      reference: '`-u` = unit (service name), `-n` = number of lines, `-f` = follow (tail -f equivalent).'
    },
    {
      question: 'All pods in the cluster are stuck in Pending despite having free resources. What control plane component should you check first?',
      options: [
        'kube-apiserver',
        'kube-scheduler',
        'kube-controller-manager',
        'etcd'
      ],
      correct: 1,
      explanation: 'The kube-scheduler assigns pods to nodes. If it is down, all new pods stay Pending indefinitely because nothing makes scheduling decisions. Check: `kubectl get pod kube-scheduler-<node> -n kube-system`.',
      reference: 'Scheduler down = Pending pods. Controller manager down = no ReplicaSet reconciliation. API server down = kubectl fails.'
    },
    {
      question: 'A Deployment\'s ReplicaSet exists with 3 desired replicas, but no pods are being created. kubectl works fine. What might be wrong?',
      options: [
        'The kube-scheduler is down',
        'The kube-controller-manager is down',
        'The kubelet on all nodes is stopped',
        'The etcd cluster is corrupted'
      ],
      correct: 1,
      explanation: 'The controller manager reconciles ReplicaSets — if it is down, no pods are created from ReplicaSets even though the ReplicaSet object exists. The scheduler would be needed if pods exist but aren\'t assigned.',
      reference: 'Controller manager = reconciliation loop for ReplicaSets, Deployments, Jobs, etc.'
    },
    {
      question: 'Node shows condition `DiskPressure: True`. What does this indicate?',
      options: [
        'The node\'s CPU is throttled',
        'The node is running low on disk space and the kubelet may start evicting pods',
        'The node has a corrupted filesystem',
        'The node\'s network disk is disconnected'
      ],
      correct: 1,
      explanation: 'DiskPressure: True means the node is running low on available disk space. The kubelet will start evicting pods to free space. Fix by cleaning up logs, images, or resizing the disk.',
      reference: 'kubelet eviction thresholds: --eviction-hard=memory.available<100Mi,nodefs.available<10%'
    },
    {
      question: 'After draining a node for maintenance with `kubectl drain`, what must you do before workloads can schedule on it again?',
      options: [
        'Delete and re-create the node object',
        'Restart the kubelet service',
        'Run `kubectl uncordon <node-name>`',
        'Add the node back with `kubeadm join`'
      ],
      correct: 2,
      explanation: '`kubectl drain` cordons the node (marks it Unschedulable) and evicts pods. After maintenance, `kubectl uncordon <node>` marks it Schedulable again. The node was never removed from the cluster.',
      reference: 'Drain = cordon + evict pods. Uncordon = allow scheduling again.'
    },
    {
      question: 'Where are control plane component logs when running in a kubeadm cluster?',
      options: [
        '/var/log/kubernetes/',
        'In the static pod containers — accessible via kubectl logs or crictl logs',
        'In the etcd key-value store',
        'Via syslog: /var/log/syslog'
      ],
      correct: 1,
      explanation: 'In kubeadm clusters, control plane components run as static pods. Their logs are accessible via `kubectl logs <pod> -n kube-system` (if API server works) or `crictl logs <container-id>` (if API server is down).',
      reference: 'If kubectl unavailable: crictl ps | grep apiserver → crictl logs <id>'
    },
    {
      question: 'You need to prevent new pods from scheduling on a node while keeping existing pods running. Which command is correct?',
      options: [
        'kubectl drain <node>',
        'kubectl cordon <node>',
        'kubectl taint node <node> NoSchedule',
        'kubectl delete node <node>'
      ],
      correct: 1,
      explanation: '`kubectl cordon` marks the node as Unschedulable — new pods cannot be placed on it, but existing pods continue running. `kubectl drain` additionally evicts existing pods.',
      reference: 'Cordon = stop new pods (existing stay). Drain = stop new pods AND evict existing.'
    }
  ],
  flashcards: [
    {
      front: 'What is the debugging sequence for a NotReady node?',
      back: '```bash\n# 1. Check node conditions (from controlplane)\nkubectl describe node <node> | grep -A10 "Conditions:"\n\n# 2. SSH to the node\nssh <node>\n\n# 3. Check kubelet service\nsystemctl status kubelet\njournalctl -u kubelet -n 100\n\n# 4. Check container runtime\nsystemctl status containerd\ncrictl ps -a\n\n# 5. Fix and restart\nsystemctl start kubelet\nsystemctl enable kubelet\n```'
    },
    {
      front: 'What are the 5 node conditions and what does each mean?',
      back: '| Condition | Normal | Problem means... |\n|-----------|--------|------------------|\n| Ready | True | False = kubelet down/network issue |\n| DiskPressure | False | True = low disk space |\n| MemoryPressure | False | True = low memory |\n| PIDPressure | False | True = too many processes |\n| NetworkUnavailable | False | True = CNI not configured |\n\nCheck: `kubectl describe node <node> | grep -A10 Conditions:`'
    },
    {
      front: 'What happens to pods when the kube-scheduler is down?',
      back: 'All **new** pods remain in **Pending** state indefinitely.\n\nThe scheduler is responsible for assigning pods to nodes. Without it, pods have no node assignment.\n\nAlready-running pods are NOT affected.\n\nFix:\n```bash\nkubectl get pod kube-scheduler-* -n kube-system\nkubectl logs kube-scheduler-* -n kube-system\ncat /etc/kubernetes/manifests/kube-scheduler.yaml\n# Fix manifest if corrupted\n```'
    },
    {
      front: 'Difference between kubectl drain and kubectl cordon',
      back: '**kubectl cordon `<node>`**:\n- Marks node as Unschedulable\n- New pods cannot schedule on it\n- Existing pods keep running\n- Use for: preventing new pods without disruption\n\n**kubectl drain `<node>`**:\n- Cordons + evicts all eligible pods\n- Pods are re-scheduled on other nodes\n- Use `--ignore-daemonsets` (DaemonSet pods cannot be evicted)\n- Use for: node maintenance\n\n**After maintenance**: `kubectl uncordon <node>`'
    },
    {
      front: 'How do you access control plane logs when kubectl is not working?',
      back: '**When kubectl/API server is unavailable**, use crictl:\n```bash\n# List containers\ncrictl ps -a | grep apiserver\n\n# Get logs by container ID\ncrictl logs <container-id>\n\n# Also check kubelet logs (always accessible)\njournalctl -u kubelet -n 100\n\n# Static pod manifests\nls /etc/kubernetes/manifests/\ncat /etc/kubernetes/manifests/kube-apiserver.yaml\n```'
    },
    {
      front: 'Where does the kubelet get its configuration in a kubeadm cluster?',
      back: '**kubeconfig** (API server connection): `/etc/kubernetes/kubelet.conf`\n\n**kubelet config** (node settings): `/var/lib/kubelet/config.yaml`\n\n**Unit file**: `/etc/systemd/system/kubelet.service.d/10-kubeadm.conf`\n\nCommon kubelet config options:\n```yaml\n# /var/lib/kubelet/config.yaml\nstaticPodPath: /etc/kubernetes/manifests\nevictionHard:\n  memory.available: "100Mi"\nclusterDNS: [10.96.0.10]\n```'
    },
    {
      front: 'A node has MemoryPressure: True. What happens next?',
      back: '**Kubelet eviction sequence**:\n1. Pods with no requests/limits are evicted first (BestEffort QoS)\n2. Then Burstable QoS pods (requests < limits)\n3. Guaranteed QoS pods are evicted last\n\n**Immediate actions**:\n```bash\n# Check memory usage\nkubectl top pod --sort-by=memory -A\n\n# Find memory hogs on the node\nssh <node>\nfree -h\ntop\n\n# Evict low-priority pods to free memory\n# OR resize the node\n```'
    },
    {
      front: 'How do you check if the container runtime is working correctly on a node?',
      back: '```bash\n# Check containerd status\nsystemctl status containerd\n\n# List all containers (including stopped)\ncrictl ps -a\n\n# List images\ncrictl images\n\n# Pull a test image\ncrictl pull nginx:latest\n\n# Check runtime info\ncrictl info\n\n# If using docker (older clusters)\ndocker ps -a\ndocker info\n```\n\nRuntime errors appear in both `crictl info` output and kubelet logs.'
    }
  ],
  lab: {
    scenario: 'A production cluster has a NotReady worker node and a stuck control plane component. You must diagnose and repair both issues.',
    objective: 'Debug and fix a stopped kubelet service, a misconfigured static pod, and perform node drain/uncordon.',
    duration: '30-35 minutes',
    steps: [
      {
        title: 'Fix a NotReady Node — Stopped Kubelet',
        instruction: `Simulate and fix a NotReady node:
1. Stop the kubelet service on a worker node (or the current node in a single-node setup)
2. Observe the node transition to NotReady
3. Diagnose using \`systemctl status\` and \`journalctl\`
4. Restart the kubelet and verify the node returns to Ready`,
        hints: [
          'Stop kubelet: sudo systemctl stop kubelet',
          'It takes 40-60 seconds for the node to show NotReady (nodeStatusUpdateFrequency)',
          'journalctl -u kubelet -n 50 shows the reason for failure',
          'sudo systemctl start kubelet to restore'
        ],
        solution: `\`\`\`bash
# Simulate failure (on the node — use sudo if needed)
sudo systemctl stop kubelet

# Observe from controlplane (wait ~60 seconds)
kubectl get nodes -w

# On the affected node: diagnose
systemctl status kubelet
# Shows: inactive (dead) or failed

journalctl -u kubelet -n 50 --no-pager
# Shows last error messages before stopping

# Fix: restart kubelet
sudo systemctl start kubelet
sudo systemctl enable kubelet  # ensure it starts on reboot

# Verify
systemctl status kubelet
# Expected: active (running)

# From controlplane
kubectl get nodes
# Expected: node back to Ready (may take 30-60 seconds)
\`\`\``,
        verify: `\`\`\`bash
kubectl get nodes
# Expected: all nodes in Ready status

kubectl describe node <node-name> | grep "Ready" | head -3
# Expected: Ready True <timestamp>

# Check kubelet is enabled (survives reboot)
systemctl is-enabled kubelet
# Expected: enabled
\`\`\``
      },
      {
        title: 'Debug a Broken Static Pod Manifest',
        instruction: `Simulate a broken kube-scheduler by corrupting its manifest:
1. Make a backup of the kube-scheduler manifest
2. Introduce an error (wrong image tag) in the manifest
3. Observe the scheduler pod failing
4. Create a test deployment — observe pods stuck Pending
5. Restore the correct manifest and verify recovery`,
        hints: [
          'Scheduler manifest: /etc/kubernetes/manifests/kube-scheduler.yaml',
          'Always backup before editing: cp file file.bak',
          'Change the image to a non-existent tag to simulate failure',
          'Restore: cp file.bak file (kubelet auto-restarts the static pod)'
        ],
        solution: `\`\`\`bash
# Backup scheduler manifest
sudo cp /etc/kubernetes/manifests/kube-scheduler.yaml \\
  /etc/kubernetes/manifests/kube-scheduler.yaml.bak

# Introduce error (wrong image tag)
sudo sed -i 's/kube-scheduler:v[0-9.]*/kube-scheduler:broken-tag/' \\
  /etc/kubernetes/manifests/kube-scheduler.yaml

# Wait for the static pod to fail
sleep 20
kubectl get pod kube-scheduler-controlplane -n kube-system
# Expected: ImagePullBackOff or similar

# Test: create deployment — pods should be Pending
kubectl create deployment pending-test --image=nginx --replicas=2
kubectl get pods -l app=pending-test
# Expected: Pending (no scheduler)

# Fix: restore the backup
sudo cp /etc/kubernetes/manifests/kube-scheduler.yaml.bak \\
  /etc/kubernetes/manifests/kube-scheduler.yaml

# Wait for scheduler to recover
sleep 30
kubectl get pod kube-scheduler-controlplane -n kube-system
# Expected: Running

# Verify pending pods now schedule
kubectl get pods -l app=pending-test
# Expected: Running

# Cleanup
kubectl delete deployment pending-test
\`\`\``,
        verify: `\`\`\`bash
kubectl get pod kube-scheduler-controlplane -n kube-system
# Expected: Running, READY 1/1

kubectl get pods -n kube-system | grep scheduler
# Expected: scheduler pod running normally

# Create a quick test
kubectl run verify-scheduling --image=nginx --restart=Never
kubectl get pod verify-scheduling
# Expected: Running (not Pending)

kubectl delete pod verify-scheduling
\`\`\``
      },
      {
        title: 'Node Maintenance — Drain and Uncordon',
        instruction: `Perform a simulated node maintenance:
1. Check current pod distribution across nodes
2. Cordon the node (prevent new pods)
3. Deploy a new pod and verify it doesn't schedule on the cordoned node
4. Drain the node (evict existing pods)
5. Verify pods have moved to other nodes
6. Uncordon the node after "maintenance"
7. Verify the node accepts new pods again`,
        hints: [
          'kubectl cordon <node> marks it Unschedulable',
          'kubectl drain <node> --ignore-daemonsets evicts pods',
          'kubectl uncordon <node> restores scheduling',
          'You need at least 2 nodes to see pods move (in single-node clusters, drained pods go Pending)'
        ],
        solution: `\`\`\`bash
# Check current pod distribution
kubectl get pods -A -o wide | grep -v kube-system

# Deploy test workload
kubectl create deployment drain-test --image=nginx --replicas=3

# Pick a node to drain (not the control plane if you want kubectl to keep working)
NODE=$(kubectl get nodes --no-headers | grep -v control-plane | awk '{print $1}' | head -1)
echo "Draining node: $NODE"

# Cordon first (stop new pods)
kubectl cordon $NODE

# Verify node is SchedulingDisabled
kubectl get nodes | grep $NODE
# Expected: SchedulingDisabled status

# Deploy new pod — should NOT go to cordoned node
kubectl run no-schedule-here --image=nginx --restart=Never
kubectl get pod no-schedule-here -o wide
# Expected: on a different node

# Drain the node
kubectl drain $NODE --ignore-daemonsets --delete-emptydir-data

# Verify pods moved
kubectl get pods -o wide -l app=drain-test
# Expected: all on other nodes

# After "maintenance" — uncordon
kubectl uncordon $NODE

# Verify node accepts workloads again
kubectl get nodes
# Expected: $NODE is Ready (no longer SchedulingDisabled)

# Cleanup
kubectl delete deployment drain-test
kubectl delete pod no-schedule-here
\`\`\``,
        verify: `\`\`\`bash
kubectl get nodes
# Expected: all nodes Ready (no SchedulingDisabled)

kubectl get pods -o wide -l app=drain-test 2>/dev/null || echo "Cleaned up"
# Expected: deployment deleted

# Test new pod schedules on previously-drained node
kubectl run post-drain-test --image=nginx --restart=Never
kubectl get pod post-drain-test -o wide
# Expected: Running (on some node including previously-drained one)
kubectl delete pod post-drain-test
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'kubectl connection refused — API server down',
      difficulty: 'hard',
      symptom: 'All kubectl commands fail with `Unable to connect to the server: dial tcp <ip>:6443: connect: connection refused`. The entire cluster appears unreachable.',
      diagnosis: `\`\`\`bash
# kubectl won't work — must go directly to the control plane node
ssh controlplane-node

# Check if API server container is running
crictl ps | grep kube-apiserver
# If empty → API server container is not running

# Check the static pod manifest
cat /etc/kubernetes/manifests/kube-apiserver.yaml
# Look for syntax errors or wrong flags

# Check kubelet status (manages the static pod)
systemctl status kubelet
journalctl -u kubelet | tail -50 | grep -i "apiserver\\|error"

# Check if etcd is running (API server depends on it)
crictl ps | grep etcd
\`\`\``,
      solution: `**Common causes**:

**1. Corrupted or invalid static pod manifest:**
\`\`\`bash
# Check for YAML errors
python3 -c "import yaml; yaml.safe_load(open('/etc/kubernetes/manifests/kube-apiserver.yaml'))"

# If invalid, restore from backup or re-initialize:
# Restore from backup if available
cp /etc/kubernetes/manifests/kube-apiserver.yaml.bak \\
   /etc/kubernetes/manifests/kube-apiserver.yaml

# Kubelet will auto-restart the static pod
\`\`\`

**2. Wrong certificate or config:**
\`\`\`bash
# Check API server flags for cert paths
grep -E "tls-cert|tls-key|etcd-cafile" /etc/kubernetes/manifests/kube-apiserver.yaml

# Verify cert files exist
ls /etc/kubernetes/pki/apiserver.crt
ls /etc/kubernetes/pki/apiserver.key
\`\`\`

**3. etcd not running:**
\`\`\`bash
# Fix etcd first
crictl logs $(crictl ps -a | grep etcd | awk '{print $1}')
cat /etc/kubernetes/manifests/etcd.yaml
\`\`\`

After fixing, wait 30-60 seconds for API server to start, then test:
\`\`\`bash
kubectl cluster-info
kubectl get nodes
\`\`\``
    },
    {
      title: 'Node stuck in Terminating after drain',
      difficulty: 'medium',
      symptom: 'After `kubectl drain <node>`, one pod stays in `Terminating` state for over 10 minutes. The node cannot complete the drain.',
      diagnosis: `\`\`\`bash
# Check the stuck pod
kubectl get pods -A | grep Terminating

kubectl describe pod <stuck-pod> -n <namespace>
# Look for:
# - finalizers (must be removed for deletion to complete)
# - DeletionTimestamp (set when deletion was requested)
# - No running containers but pod object remains

# Check if it's a DaemonSet pod (drain skips these)
kubectl get pod <stuck-pod> -n <ns> -o yaml | grep "ownerReferences" -A5

# Check pod finalizers
kubectl get pod <stuck-pod> -n <ns> -o jsonpath='{.metadata.finalizers}'
\`\`\``,
      solution: `**Cause 1: Pod has finalizers preventing deletion**
\`\`\`bash
# Remove finalizers to force deletion
kubectl patch pod <stuck-pod> -n <namespace> \\
  -p '{"metadata":{"finalizers":[]}}' \\
  --type=merge
\`\`\`

**Cause 2: Pod is a DaemonSet pod (not evicted by drain)**
\`\`\`bash
# Re-run drain with force
kubectl drain <node> \\
  --ignore-daemonsets \\       # skip daemonset pods
  --delete-emptydir-data \\
  --force                      # force delete pods with no controller
\`\`\`

**Cause 3: Node not reachable (pod termination signal not delivered)**
\`\`\`bash
# Force delete the stuck pod
kubectl delete pod <stuck-pod> -n <namespace> \\
  --grace-period=0 --force
\`\`\`

**After cleanup:**
\`\`\`bash
kubectl get pods -A | grep Terminating
# Expected: empty

kubectl get nodes
# Node should now show SchedulingDisabled (drained)
\`\`\``
    }
  ]
};
