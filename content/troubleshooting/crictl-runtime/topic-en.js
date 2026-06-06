window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['troubleshooting/crictl-runtime'] = {
  theory: `# crictl & Container Runtime-Level Debugging

## Exam Relevance
> On the CKA, **when the API server is down**, \`kubectl\` is useless. That is where \`crictl\` comes in: the command-line tool that talks directly to the **container runtime** (containerd/CRI-O) through the **CRI** (Container Runtime Interface). Classic scenarios: control plane static pod in CrashLoop, kubelet that will not start, node NotReady. Being able to read container logs without kubectl can be the difference between fixing it and getting stuck.

## Why crictl and not kubectl/docker?

| Layer | Tool | When to use |
|-------|------|-------------|
| Kubernetes API | \`kubectl\` | Works only if the **API server** is up |
| Container Runtime (CRI) | \`crictl\` | Works even with the **control plane down** |
| Native containerd | \`ctr\` | Low-level containerd debugging (internal namespaces) |

> Since the **dockershim** removal (K8s 1.24+), the default runtime is **containerd**. The \`docker\` CLI no longer sees Kubernetes containers. Use \`crictl\`.

\`\`\`
┌──────────────┐   API     ┌────────────┐  CRI (gRPC)  ┌─────────────┐
│   kubectl    │ ────────▶ │ API server │              │  containerd │
└──────────────┘           └────────────┘              └─────────────┘
                                  ▲                            ▲
                              (may be down)             crictl talks here
                                                        directly, via socket
\`\`\`

## Configuring crictl

\`crictl\` needs to know the runtime endpoint. Without it, it complains or tries to autodetect.

\`\`\`bash
# Option 1: config file (recommended)
cat /etc/crictl.yaml
# runtime-endpoint: unix:///run/containerd/containerd.sock
# image-endpoint: unix:///run/containerd/containerd.sock
# timeout: 10
# debug: false

# Create/adjust:
sudo crictl config runtime-endpoint unix:///run/containerd/containerd.sock

# Option 2: per-command flag
crictl --runtime-endpoint unix:///run/containerd/containerd.sock ps
\`\`\`

| Runtime | Default socket |
|---------|----------------|
| containerd | \`unix:///run/containerd/containerd.sock\` |
| CRI-O | \`unix:///var/run/crio/crio.sock\` |

> Exam trap: if \`crictl ps\` gives a connection error, the endpoint is probably wrong/missing. Configure \`runtime-endpoint\` first.

## Mental model: Pod vs Sandbox vs Container

In the CRI world, a Pod = one **sandbox** (the network/namespace "box", the pause container) + 1..N application **containers**.

| K8s concept | In crictl | Command |
|-------------|-----------|---------|
| Pod | **PodSandbox** | \`crictl pods\` |
| Container | Container | \`crictl ps\` |
| Image | Image | \`crictl images\` |

## Essential Commands

\`\`\`bash
# --- List ---
crictl ps                 # RUNNING containers
crictl ps -a              # ALL (includes Exited/CrashLoop) -- essential for debug
crictl pods               # pod sandboxes
crictl images             # images on the node

# Filter
crictl ps -a --name kube-apiserver
crictl pods --name etcd --namespace kube-system

# --- Inspect ---
crictl inspect <container-id>     # container JSON (state, mounts, args)
crictl inspectp <pod-id>          # pod sandbox JSON (network, labels)
crictl inspecti <image-id>        # image JSON

# --- Logs (the most important on the exam) ---
crictl logs <container-id>
crictl logs --tail 50 <container-id>
crictl logs -f <container-id>            # follow

# --- State and resources ---
crictl stats                      # CPU/memory per container
crictl statsp                     # per pod sandbox

# --- Exec inside ---
crictl exec -it <container-id> sh

# --- Cleanup (careful!) ---
crictl stop <container-id>
crictl rm <container-id>
crictl rmi <image-id>             # remove image
\`\`\`

> The kubelet **recreates** containers you stop/remove (reconciliation). \`crictl stop\` on a static pod container is useful to force a clean restart.

## Key scenario: control plane as a Static Pod

The control plane components (\`kube-apiserver\`, \`etcd\`, \`kube-controller-manager\`, \`kube-scheduler\`) run as **static pods**, managed directly by the **kubelet** from \`/etc/kubernetes/manifests/\`.

If the API server is in CrashLoop, \`kubectl\` fails — but the container exists in the runtime:

\`\`\`bash
# 1. Is the kube-apiserver running? (kubectl will not work here!)
sudo crictl ps -a --name kube-apiserver
# STATE = Running? Exited? CrashLoopBackOff?

# 2. Read the container logs to find the cause
APISERVER=$(sudo crictl ps -a --name kube-apiserver -q | head -1)
sudo crictl logs $APISERVER

# Typical errors: unreachable "--etcd-servers", invalid flag,
# expired certificate, port already in use.

# 3. Does the static manifest have a syntax error?
sudo cat /etc/kubernetes/manifests/kube-apiserver.yaml

# 4. Is the kubelet processing the manifest?
sudo journalctl -u kubelet -f
\`\`\`

> Mental flow: \`kubectl\` failed → \`crictl ps -a\` to see container state → \`crictl logs\` for the cause → fix the manifest in \`/etc/kubernetes/manifests/\` → kubelet recreates the static pod automatically.

## Runtime and kubelet logs (systemd)

When not even the container starts, the problem is one layer below:

\`\`\`bash
# kubelet logs (the one calling the CRI)
sudo journalctl -u kubelet -f
sudo journalctl -u kubelet --since "10 min ago" --no-pager

# containerd logs (the runtime itself)
sudo journalctl -u containerd -f

# Service status
sudo systemctl status kubelet
sudo systemctl status containerd

# Restart if needed
sudo systemctl restart kubelet
\`\`\`

## crictl vs ctr (when to go one level deeper)

\`crictl\` sees only what **Kubernetes** created (CRI namespace \`k8s.io\`). \`ctr\` (native to containerd) sees everything but requires specifying the namespace:

\`\`\`bash
# ctr needs the explicit namespace
sudo ctr -n k8s.io containers list
sudo ctr -n k8s.io images list
sudo ctr namespaces list
\`\`\`

> On the exam, **prefer \`crictl\`** — it is the standard CRI interface and more predictable. Use \`ctr\` only to inspect things outside the CRI scope (e.g. manual image pull, snapshots).

## Common Mistakes

1. **Using \`docker ps\`** on a modern cluster and seeing nothing — the runtime is containerd; use \`crictl ps\`.
2. **Forgetting \`-a\`** on \`crictl ps\` — CrashLoop containers are \`Exited\`, they only show with \`-a\`.
3. **runtime-endpoint not configured** — \`crictl\` complains about the connection; configure \`/etc/crictl.yaml\`.
4. **Forgetting \`sudo\`** — the runtime socket requires root.
5. **Trying \`kubectl logs\`** with the API server down — without the control plane, only \`crictl logs\` works.
6. **Editing a static manifest and expecting \`kubectl apply\`** — static pods do not use the API; just save the file in \`/etc/kubernetes/manifests/\` and the kubelet reacts.

## Killer.sh Style Challenge

> \`kubectl get nodes\` on the control plane returns "The connection to the server X was refused". You have SSH access to the node.
>
> 1. Without using \`kubectl\`, find out whether the \`kube-apiserver\` container is running.
> 2. If it is not, read the container logs to identify the root cause.
> 3. Suspicion: someone changed \`--etcd-servers\` in the manifest to a wrong port. Check \`/etc/kubernetes/manifests/kube-apiserver.yaml\`.
> 4. Fix the manifest and confirm the kubelet recreated the static pod and \`kubectl\` is back.
>
> Hint: \`sudo crictl ps -a --name kube-apiserver\` → \`sudo crictl logs <id>\` → edit the YAML → wait for the kubelet (\`journalctl -u kubelet -f\`) → \`kubectl get nodes\`.
`,

  quiz: [
    {
      question: 'The API server is in CrashLoopBackOff and "kubectl" returns "connection refused". Which tool lets you read the kube-apiserver container logs?',
      options: [
        'kubectl logs -n kube-system kube-apiserver',
        'docker logs kube-apiserver',
        'crictl logs <container-id> (talking directly to containerd via CRI)',
        'journalctl -u kube-apiserver'
      ],
      correct: 2,
      explanation: 'With the API server down, kubectl does not work (it depends on the API). The kube-apiserver runs as a container in the runtime, so crictl ps -a + crictl logs read the container directly via CRI. docker does not see K8s containers (containerd is the runtime); and there is no systemd service called kube-apiserver (it is a static pod, not a service).',
      reference: 'Section Key scenario: control plane as a Static Pod.'
    },
    {
      question: 'Why might "crictl ps" alone NOT show a container that is in CrashLoopBackOff?',
      options: [
        'crictl does not support control plane containers',
        'CrashLoop containers are in the Exited state; you need "crictl ps -a" to see them',
        'crictl only shows pods, not containers',
        'The container needs a special label to appear'
      ],
      correct: 1,
      explanation: 'crictl ps lists only running containers. A container in CrashLoopBackOff is repeatedly Exited between attempts, so it only appears with the -a (all) flag. Forgetting -a is a classic mistake when debugging crashes.',
      reference: 'Section Essential Commands and Common Mistakes (item 2).'
    },
    {
      question: 'What is the default containerd runtime-endpoint socket that crictl needs to know?',
      options: [
        'unix:///var/run/docker.sock',
        'unix:///run/containerd/containerd.sock',
        'tcp://localhost:2375',
        'unix:///var/run/crio/crio.sock'
      ],
      correct: 1,
      explanation: 'containerd exposes the CRI on the socket unix:///run/containerd/containerd.sock. Configure it with "crictl config runtime-endpoint ..." or in /etc/crictl.yaml. The CRI-O socket is /var/run/crio/crio.sock; docker.sock belongs to Docker (not used by modern K8s).',
      reference: 'Section Configuring crictl — socket-per-runtime table.'
    },
    {
      question: 'In the CRI model, which command lists the Pod Sandboxes (the "box" of each Pod) rather than the application containers?',
      options: [
        'crictl ps',
        'crictl images',
        'crictl pods',
        'crictl inspect'
      ],
      correct: 2,
      explanation: 'A Pod in CRI = one PodSandbox (pause container, network namespaces) + 1..N containers. crictl pods lists the sandboxes; crictl ps lists the application containers; crictl inspectp <pod-id> details a sandbox. Useful when the sandbox comes up but the app container fails (or vice versa).',
      reference: 'Section Mental model: Pod vs Sandbox vs Container.'
    },
    {
      question: 'You fixed an error in /etc/kubernetes/manifests/kube-apiserver.yaml. How does the cluster apply that change?',
      options: [
        'By running kubectl apply -f on the manifest',
        'The kubelet detects the file change and recreates the static pod automatically',
        'By restarting containerd manually',
        'By running crictl create with the new manifest'
      ],
      correct: 1,
      explanation: 'Static pods do not go through the API. The kubelet watches /etc/kubernetes/manifests/ and, on detecting the file change, recreates the pod by itself. That is why kubectl apply does not apply here. You can follow along with journalctl -u kubelet -f.',
      reference: 'Section Key scenario and Common Mistakes (item 6).'
    },
    {
      question: 'On a Kubernetes 1.24+ cluster, why does "docker ps" not show the Pods containers?',
      options: [
        'Because Docker hides system containers',
        'Because since the dockershim removal the default runtime is containerd, and the Docker CLI does not manage those containers',
        'Because the containers are in another network namespace',
        'Because you must run docker ps --all'
      ],
      correct: 1,
      explanation: 'From K8s 1.24 the dockershim was removed and the default runtime became containerd (or CRI-O). The Docker CLI talks to the Docker daemon, which is not what runs Kubernetes containers. That is why crictl (CRI) or ctr (native containerd) is used.',
      reference: 'Section Why crictl and not kubectl/docker.'
    },
    {
      question: '"crictl ps" returns a runtime connection error. What is the first thing to check?',
      options: [
        'Whether the cluster has enough nodes',
        'Whether the runtime-endpoint is correctly configured (/etc/crictl.yaml or flag) and whether you are using sudo',
        'Whether kube-proxy is running',
        'Whether a NetworkPolicy is blocking'
      ],
      correct: 1,
      explanation: 'A crictl connection error is almost always a wrong/missing endpoint or lack of privilege. Check runtime-endpoint in /etc/crictl.yaml (or pass --runtime-endpoint) and run with sudo, since the runtime socket requires root.',
      reference: 'Section Configuring crictl + Common Mistakes (items 3 and 4).'
    }
  ],

  flashcards: [
    {
      front: 'When to use crictl instead of kubectl?',
      back: '**kubectl** depends on the API server being up.\n\n**crictl** talks directly to the container runtime (containerd/CRI-O) via **CRI**, working even with the **control plane down**.\n\nScenarios: kube-apiserver in CrashLoop, kubelet/node issues, reading container logs when the API is unresponsive.\n\nRemember: modern K8s containers live in **containerd**, not Docker — `docker ps` does not show them.'
    },
    {
      front: 'The most-used crictl debug commands',
      back: '```bash\ncrictl ps -a              # ALL containers (includes Exited)\ncrictl pods               # pod sandboxes\ncrictl logs <id>          # container logs\ncrictl logs --tail 50 <id>\ncrictl inspect <id>       # container JSON\ncrictl inspectp <pod-id>  # sandbox JSON\ncrictl exec -it <id> sh\ncrictl stats              # CPU/mem\n```\n\nAlways with **sudo**. Do not forget **-a** (CrashLoop = Exited).'
    },
    {
      front: 'How to configure the crictl runtime-endpoint?',
      back: 'Via the `/etc/crictl.yaml` file:\n```yaml\nruntime-endpoint: unix:///run/containerd/containerd.sock\nimage-endpoint: unix:///run/containerd/containerd.sock\ntimeout: 10\n```\n\nOr by command:\n```bash\nsudo crictl config runtime-endpoint \\\n  unix:///run/containerd/containerd.sock\n```\n\nSockets: containerd = `/run/containerd/containerd.sock`; CRI-O = `/var/run/crio/crio.sock`.'
    },
    {
      front: 'Pod vs Sandbox vs Container in CRI',
      back: 'A Pod in CRI = **1 PodSandbox** (pause container + network namespaces) + **1..N application containers**.\n\n| K8s | crictl |\n|-----|--------|\n| Pod | `crictl pods` (sandbox) |\n| Container | `crictl ps` |\n| Image | `crictl images` |\n\n`crictl inspectp <pod>` = sandbox detail; `crictl inspect <ctr>` = container detail.'
    },
    {
      front: 'Flow: API server down, control plane as static pod',
      back: '1. `kubectl` fails → use crictl.\n2. `sudo crictl ps -a --name kube-apiserver` → see state.\n3. `sudo crictl logs <id>` → find the cause (etcd unreachable, invalid flag, expired cert).\n4. Fix `/etc/kubernetes/manifests/kube-apiserver.yaml`.\n5. **kubelet recreates** the static pod by itself (no kubectl apply).\n6. Follow with `journalctl -u kubelet -f`.'
    },
    {
      front: 'crictl vs ctr — what is the difference?',
      back: '**crictl** — standard **CRI** interface; sees only what Kubernetes created; predictable; preferred on the exam.\n\n**ctr** — **native containerd** CLI; sees everything but requires an explicit namespace:\n```bash\nsudo ctr -n k8s.io containers list\nsudo ctr -n k8s.io images list\n```\n\nUse `ctr` only for things outside the CRI (manual pull, snapshots). For Pod debugging, stay on `crictl`.'
    },
    {
      front: 'Where to look for logs when not even the container starts?',
      back: 'One layer below the CRI, in the systemd services:\n\n```bash\n# kubelet (calls the CRI / manages static pods)\nsudo journalctl -u kubelet -f\n\n# containerd (the runtime)\nsudo journalctl -u containerd -f\n\nsudo systemctl status kubelet\nsudo systemctl status containerd\n```\n\nIf the kubelet cannot start the sandbox, the cause is usually in these logs (CNI, cgroups, swap, certificates).'
    }
  ],

  lab: {
    scenario: 'Use crictl to inspect containers and pods on the node, read a container logs without kubectl, and simulate debugging a control plane static pod with a broken manifest.',
    objective: 'Gain fluency with crictl for the CKA troubleshooting scenarios where kubectl/API server is unavailable.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Configure and explore crictl',
        instruction: 'On the control plane node, configure the runtime-endpoint and list pods, containers and images from the runtime.',
        hints: ['Use sudo — the socket requires root', 'crictl ps -a also shows Exited ones'],
        solution: `\`\`\`bash
# Configure endpoint (if not already set)
sudo crictl config runtime-endpoint unix:///run/containerd/containerd.sock
cat /etc/crictl.yaml

# List control plane pod sandboxes
sudo crictl pods --namespace kube-system

# List running containers
sudo crictl ps

# List ALL (includes Exited)
sudo crictl ps -a | head

# Images on the node
sudo crictl images | head
\`\`\``,
        verify: `\`\`\`bash
sudo crictl ps --name kube-apiserver
# Expected: 1 kube-apiserver container in Running state

sudo crictl pods --name etcd --namespace kube-system
# Expected: the etcd pod sandbox listed
\`\`\``
      },
      {
        title: 'Read logs and inspect a control plane container',
        instruction: 'Get the kube-apiserver container ID and read its logs and details, simulating a scenario without kubectl.',
        hints: ['crictl ps -q returns only the ID', 'crictl logs <id> and crictl inspect <id>'],
        solution: `\`\`\`bash
# Capture the kube-apiserver ID
APISERVER=$(sudo crictl ps -a --name kube-apiserver -q | head -1)
echo "Container ID: $APISERVER"

# Read the latest logs
sudo crictl logs --tail 30 $APISERVER

# Inspect (state, args, mounts)
sudo crictl inspect $APISERVER | head -40

# View resource usage
sudo crictl stats --id $APISERVER
\`\`\``,
        verify: `\`\`\`bash
sudo crictl inspect $APISERVER | grep -i '"state"'
# Expected: "state": "CONTAINER_RUNNING"

sudo crictl logs --tail 5 $APISERVER
# Expected: apiserver log lines (no connection error)
\`\`\``
      },
      {
        title: 'Simulate and debug a broken static pod',
        instruction: 'Introduce an error in the kube-apiserver manifest, observe the breakage via crictl, then revert and confirm recovery. (Do this in a lab environment!)',
        hints: ['Back up the manifest BEFORE editing', 'The kubelet reacts on file save'],
        solution: `\`\`\`bash
# 1. Mandatory backup
sudo cp /etc/kubernetes/manifests/kube-apiserver.yaml /tmp/kube-apiserver.yaml.bak

# 2. Introduce a deliberate error (invalid etcd port)
sudo sed -i 's#--etcd-servers=https://127.0.0.1:2379#--etcd-servers=https://127.0.0.1:9999#' \\
  /etc/kubernetes/manifests/kube-apiserver.yaml

# 3. Wait for the kubelet to recreate and the apiserver to fail; kubectl will stop responding
sleep 30
sudo crictl ps -a --name kube-apiserver

# 4. Read the logs to "discover" the cause
BAD=$(sudo crictl ps -a --name kube-apiserver -q | head -1)
sudo crictl logs $BAD 2>&1 | tail -20
# Expected: etcd connection errors on port 9999

# 5. Revert
sudo cp /tmp/kube-apiserver.yaml.bak /etc/kubernetes/manifests/kube-apiserver.yaml

# 6. Wait for recovery
sleep 40
\`\`\``,
        verify: `\`\`\`bash
# kubectl should respond again after the revert
kubectl get nodes
# Expected: nodes Ready again

sudo crictl ps --name kube-apiserver
# Expected: kube-apiserver Running again
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'kubectl fails with "connection refused" — control plane down',
      difficulty: 'hard',
      symptom: 'Any kubectl command on the control plane returns "The connection to the server <ip>:6443 was refused". You only have SSH on the node.',
      diagnosis: `\`\`\`bash
# kubectl does not work -> drop down to the runtime
sudo crictl ps -a --name kube-apiserver
# STATE: Running? Exited? how many restarts?

# If Exited/CrashLoop, read the logs
APISERVER=$(sudo crictl ps -a --name kube-apiserver -q | head -1)
sudo crictl logs $APISERVER 2>&1 | tail -30

# Check the static manifest
sudo cat /etc/kubernetes/manifests/kube-apiserver.yaml

# Check the kubelet
sudo journalctl -u kubelet --since "10 min ago" --no-pager | tail -30
\`\`\``,
      solution: `**Typical causes and fixes:**

1. **Manifest error** (invalid flag, indentation, wrong --etcd-servers): edit \`/etc/kubernetes/manifests/kube-apiserver.yaml\`. The kubelet recreates the static pod on save.

2. **etcd unreachable**: \`sudo crictl ps -a --name etcd\` + \`crictl logs\`. If etcd is also down, fix it first (the apiserver depends on it).

3. **Expired certificate**: the apiserver log shows "x509: certificate has expired". Renew with \`sudo kubeadm certs renew apiserver\` (and related).

4. **Port 6443 in use**: another process holding the port.

\`\`\`bash
# After fixing the manifest, follow the recreation
sudo journalctl -u kubelet -f
# and validate
kubectl get nodes
\`\`\`

**Prevention:** always back up the manifest before editing (\`cp ... /tmp/...bak\`).`
    },
    {
      title: 'crictl returns a runtime connection error',
      difficulty: 'easy',
      symptom: 'Running "crictl ps" shows a warning/error like "connection error: desc = transport: Error while dialing dial unix ... no such file or directory".',
      diagnosis: `\`\`\`bash
# Is the endpoint configured?
cat /etc/crictl.yaml 2>/dev/null

# Does the containerd socket exist?
ls -l /run/containerd/containerd.sock

# Is containerd running?
sudo systemctl status containerd
\`\`\``,
      solution: `**Cause:** missing/wrong runtime-endpoint, or containerd stopped, or lack of sudo.

\`\`\`bash
# 1. Configure the correct endpoint
sudo crictl config runtime-endpoint unix:///run/containerd/containerd.sock

# 2. If the socket does not exist, containerd may be stopped
sudo systemctl start containerd
sudo systemctl status containerd

# 3. Always use sudo
sudo crictl ps
\`\`\`

**Tip:** if the node uses CRI-O instead of containerd, the socket is \`unix:///var/run/crio/crio.sock\`. Check with \`sudo systemctl status crio\`.`
    },
    {
      title: 'Pod sandbox comes up but the application container does not start',
      difficulty: 'medium',
      symptom: 'crictl pods shows the sandbox as Ready, but crictl ps -a shows the app container repeatedly Exited. No reliable kubectl for describe.',
      diagnosis: `\`\`\`bash
# Find the pod sandbox and the container
sudo crictl pods --name my-app
sudo crictl ps -a --name my-app

# Logs of the failing container
CID=$(sudo crictl ps -a --name my-app -q | head -1)
sudo crictl logs $CID 2>&1 | tail -30

# Inspect exit reason / exit code
sudo crictl inspect $CID | grep -iA3 '"state"\\|exitCode\\|reason'
\`\`\``,
      solution: `**Interpretation:** the sandbox (network/namespace) is OK, so the problem is the **application container**, not the network.

- **ExitCode 0 and restarting**: the process ends by itself (wrong command, missing long-running \`command\`/\`args\`).
- **ExitCode 1/2 + error in logs**: app bug, missing config/secret, unavailable dependency.
- **OOMKilled (reason)**: insufficient memory — adjust limits.

\`\`\`bash
# See the image and effective args
sudo crictl inspect $CID | grep -iA10 '"args"'

# Confirm the image exists on the node
sudo crictl images | grep my-app
\`\`\`

After identifying it, fix via manifest/Deployment (once kubectl is back) — the runtime only executes what the kubelet asked for.`
    }
  ]
};
