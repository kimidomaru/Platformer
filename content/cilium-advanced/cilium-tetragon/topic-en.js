window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['cilium-advanced/cilium-tetragon'] = {
  theory: `# Tetragon: Runtime Security & Observability with eBPF

## Relevance
> **Tetragon** is the **runtime security** component of the Cilium family (a CNCF project, originated at Isovalent). It uses **eBPF** to observe — and optionally **block** — kernel-level events: process execution, file access, network activity and syscalls, with full Kubernetes context (pod, container, labels). It fills a common gap: runtime visibility and enforcement with minimal overhead.

## Why eBPF for runtime security?

Traditional security tools run in user-space and collect events via polling or auditd — high overhead and easy to bypass. Tetragon runs **in the kernel via eBPF**:

- **Low overhead** — no context switch per event; filtering happens in the kernel.
- **Tamper-resistant from the observed process** — the eBPF program runs out of reach of the workload.
- **Rich context** — it correlates the event (PID, binary, args) with the Kubernetes Pod/container/namespace automatically.

> Tetragon works **with or without** Cilium as the CNI — it can be installed standalone on any cluster.

## What Tetragon observes

\`\`\`
┌───────────────────────────────────────────────┐
│  Process execution  →  exec / exit (full args) │
│  File access        →  open / read / write     │
│  Network activity   →  connect / accept / DNS  │
│  Privileges         →  capabilities, setuid    │
│  Syscalls           →  any syscall              │
└───────────────────────────────────────────────┘
        observed by eBPF, enriched with
        Kubernetes identity (pod/labels)
\`\`\`

## Process Visibility (no configuration)

Right after install, Tetragon already emits **process_exec** and **process_exit** events for the whole cluster:

\`\`\`bash
# Install via Helm
helm repo add cilium https://helm.cilium.io
helm install tetragon cilium/tetragon -n kube-system

# View events in real time (tetra CLI inside the pod)
kubectl exec -n kube-system ds/tetragon -c tetragon -- \\
  tetra getevents -o compact

# Typical output (process exec with K8s context):
# 🚀 process default/xwing /bin/bash
# 🚀 process default/xwing /usr/bin/curl https://evil.com
# 💥 exit    default/xwing /usr/bin/curl 0
\`\`\`

> Each event carries: namespace/pod, binary, arguments, UID, parent process — ready to detect interactive shells, suspicious downloads, etc.

## TracingPolicy — the heart of Tetragon

The **TracingPolicy** CRD defines **what to observe** and, optionally, **what to do** (enforcement). Example: monitor access to sensitive files.

\`\`\`yaml
apiVersion: cilium.io/v1alpha1
kind: TracingPolicy
metadata:
  name: monitor-sensitive-files
spec:
  kprobes:
    - call: "security_file_permission"
      syscall: false
      args:
        - index: 0
          type: "file"
        - index: 1
          type: "int"
      selectors:
        - matchArgs:
            - index: 0
              operator: "Prefix"
              values:
                - "/etc/shadow"
                - "/etc/passwd"
            - index: 1
              operator: "Equal"
              values:
                - "4"          # MAY_READ
\`\`\`

\`\`\`bash
kubectl apply -f monitor-sensitive-files.yaml

# Now any read of /etc/shadow generates an event:
# 📂 default/web-pod /bin/cat /etc/shadow
\`\`\`

## Enforcement: from observing to blocking

The key differentiator: Tetragon does not just observe — it can **kill the process** in the kernel, inline (before the syscall returns), via the \`Sigkill\` or \`Override\` action:

\`\`\`yaml
apiVersion: cilium.io/v1alpha1
kind: TracingPolicy
metadata:
  name: block-shell-in-prod
spec:
  kprobes:
    - call: "security_bprm_creds_from_file"
      syscall: false
      args:
        - index: 1
          type: "file"
      selectors:
        - matchBinaries:
            - operator: "In"
              values:
                - "/bin/bash"
                - "/bin/sh"
          matchActions:
            - action: Sigkill     # kills the process immediately
\`\`\`

| Action | Effect |
|--------|--------|
| \`Post\` | only emits the event (observability) |
| \`Sigkill\` | kills the process in the kernel (enforcement) |
| \`Override\` | makes the syscall return an error (e.g. -EPERM) without killing |
| \`NotifyEnforcer\` | signals the enforcer for combined actions |

> **Synchronous kernel enforcement** = no race window (TOCTOU) between detecting and acting, unlike solutions that react in user-space after the fact.

## Filters (selectors) — precision without noise

\`selectors\` filter in the kernel to reduce volume and focus on what matters:

| matchX | Filters by |
|--------|-----------|
| \`matchBinaries\` | executable path |
| \`matchArgs\` | syscall arguments (path, flags...) |
| \`matchPIDs\` | PID / PID namespace |
| \`matchNamespaces\` | kernel namespaces |
| \`matchCapabilities\` | process capabilities |
| \`matchNamespaceChanges\` | namespace change (container escape!) |

## Classic use cases

\`\`\`yaml
# 1. Detect an interactive shell inside a container (reverse shell)
#    -> matchBinaries In [/bin/bash,/bin/sh] + action Post/Sigkill

# 2. Detect writes to system binaries (/usr/bin, /sbin)
#    -> kprobe on security_file_permission + matchArgs Prefix /usr/bin

# 3. Detect namespace change (container escape attempt)
#    -> matchNamespaceChanges

# 4. Detect use of dangerous capabilities (CAP_SYS_ADMIN)
#    -> matchCapabilities
\`\`\`

## Tetragon vs Falco

| | Falco | Tetragon |
|---|-------|----------|
| Mechanism | eBPF or kernel module | eBPF (CO-RE) |
| Enforcement | no (alert only) | **yes** (Sigkill/Override in kernel) |
| K8s context | yes | yes (native, via Cilium identity) |
| Rule language | Falco Rules (YAML/conditions) | TracingPolicy (kprobes/selectors) |
| Integration | CNCF, broad ecosystem | Cilium/Hubble family |

> Summary: Falco is excellent for rule-based **detection**; Tetragon shines when you want **synchronous enforcement** and deep correlation with the Cilium stack.

## Observability and export

\`\`\`bash
# Events in JSON (for SIEM/pipeline)
kubectl exec -n kube-system ds/tetragon -c tetragon -- \\
  tetra getevents -o json | jq .

# Tetragon exposes Prometheus metrics
kubectl get svc -n kube-system tetragon -o yaml | grep -i metrics
# scrape tetragon_events_total, etc.
\`\`\`

## Common Mistakes

1. **Expecting enforcement without \`matchActions\`** — without the \`Sigkill\`/\`Override\` action, the policy only observes.
2. **Kernel without BTF** — Tetragon uses CO-RE; very old kernels without BTF need extra configuration.
3. **Filters too broad** — without precise \`selectors\`, the event volume explodes.
4. **Confusing kprobe with tracepoint** — \`syscall: true\` for syscalls; \`syscall: false\` for internal kernel functions (kprobes).
5. **Assuming Cilium CNI is required** — Tetragon runs standalone.

## Killer.sh Style Challenge

> On a cluster with Tetragon installed:
>
> 1. Create a TracingPolicy that **observes** any execution of \`/bin/bash\` or \`/bin/sh\` in Pods of the \`production\` namespace.
> 2. Generate an event: \`kubectl exec\` into a \`production\` pod running \`sh\`.
> 3. Confirm the event with \`tetra getevents -o compact\`.
> 4. Evolve the policy to **block** (Sigkill) shell execution and validate that \`kubectl exec ... sh\` is now killed.
>
> Hint: \`matchBinaries\` + \`matchActions: [{action: Post}]\` first; then switch to \`Sigkill\`.
`,

  quiz: [
    {
      question: 'What is the main capability that sets Tetragon apart from detection tools like Falco?',
      options: [
        'Tetragon uses kernel modules instead of eBPF',
        'Tetragon can do synchronous kernel enforcement (Sigkill/Override), not just alert',
        'Tetragon only works with the Cilium CNI installed',
        'Tetragon has no Kubernetes context'
      ],
      correct: 1,
      explanation: 'Both observe via eBPF with K8s context, but Tetragon can ACT in the kernel itself — kill the process (Sigkill) or force the syscall to return an error (Override) synchronously, eliminating the TOCTOU window. Falco focuses on detection/alerting. And Tetragon runs standalone, without requiring Cilium as the CNI.',
      reference: 'Sections Enforcement and Tetragon vs Falco.'
    },
    {
      question: 'Which CRD does Tetragon use to define what to observe and which actions to take?',
      options: [
        'CiliumNetworkPolicy',
        'FalcoRule',
        'TracingPolicy',
        'AuditPolicy'
      ],
      correct: 2,
      explanation: 'The TracingPolicy (apiVersion cilium.io/v1alpha1) defines kprobes/tracepoints, the observed args, the selectors (in-kernel filters) and the matchActions (Post, Sigkill, Override). It is the central configuration point of Tetragon.',
      reference: 'Section TracingPolicy.'
    },
    {
      question: 'In a TracingPolicy, what happens if you define selectors but do NOT include matchActions?',
      options: [
        'The policy is rejected by the API server',
        'The process is blocked by default',
        'The policy only observes and emits events (no enforcement)',
        'All cluster syscalls are blocked'
      ],
      correct: 2,
      explanation: 'Without matchActions carrying an enforcement action (Sigkill/Override), the TracingPolicy runs in observability mode: it generates events when the filter matches, but does not interfere with the process. To block, you must explicitly add matchActions with Sigkill or Override.',
      reference: 'Section Enforcement and Common Mistakes (item 1).'
    },
    {
      question: 'Which selector is best suited to detect a container escape attempt via namespace change?',
      options: [
        'matchBinaries',
        'matchArgs',
        'matchNamespaceChanges',
        'matchCapabilities'
      ],
      correct: 2,
      explanation: 'matchNamespaceChanges detects when a process changes kernel namespace — a classic sign of an attempt to escape container isolation. matchBinaries filters by executable, matchArgs by arguments and matchCapabilities by capabilities.',
      reference: 'Sections Filters (selectors) and Use cases.'
    },
    {
      question: 'Why does Tetragon kernel enforcement avoid the race condition (TOCTOU) common in user-space solutions?',
      options: [
        'Because it runs as a DaemonSet',
        'Because the action (e.g. Sigkill) happens inline, in the kernel, before the syscall returns — no gap between detecting and acting',
        'Because it uses high-frequency polling',
        'Because it disables the syscall globally'
      ],
      correct: 1,
      explanation: 'User-space solutions detect the event after the syscall already happened and react with delay (TOCTOU = Time Of Check to Time Of Use). Tetragon executes the action inside the eBPF hook in the kernel, synchronously, closing that window.',
      reference: 'Section Enforcement.'
    },
    {
      question: 'Does Tetragon require Cilium installed as the CNI to work?',
      options: [
        'Yes, it is a component embedded in the Cilium agent',
        'No, it can be installed standalone on any Kubernetes cluster',
        'Yes, it depends on Cilium identities to generate events',
        'Only on clusters with kube-proxy replacement'
      ],
      correct: 1,
      explanation: 'Although it is part of the Cilium family and integrates well with Hubble, Tetragon is independent: it can be installed via Helm as a DaemonSet on any cluster, with or without Cilium as the CNI. It gets K8s context by watching the API, not exclusively from Cilium identities.',
      reference: 'Sections Why eBPF and Common Mistakes (item 5).'
    },
    {
      question: 'Right after installing Tetragon, with no TracingPolicy, which events does it already emit by default?',
      options: [
        'None — everything requires a TracingPolicy',
        'Only network events',
        'process_exec and process_exit (process execution/exit) with K8s context',
        'Only accesses to /etc/shadow'
      ],
      correct: 2,
      explanation: 'Tetragon provides process execution visibility (process_exec/process_exit) out-of-the-box, with pod, container, binary, args and UID. TracingPolicies add observation/enforcement of specific things (files, syscalls, capabilities).',
      reference: 'Section Process Visibility.'
    }
  ],

  flashcards: [
    {
      front: 'What is Tetragon and why does it use eBPF?',
      back: '**Runtime security & observability** component of the Cilium family (CNCF).\n\nUses **eBPF** to observe (and optionally block) kernel events: process exec, file access, network, syscalls, capabilities.\n\neBPF advantages:\n- low overhead (filters in the kernel)\n- tamper-resistant from the observed workload\n- rich K8s context (pod/labels)\n\nRuns **standalone**, with or without the Cilium CNI.'
    },
    {
      front: 'TracingPolicy — essential structure',
      back: '```yaml\napiVersion: cilium.io/v1alpha1\nkind: TracingPolicy\nspec:\n  kprobes:\n    - call: "security_file_permission"\n      syscall: false\n      args: [...]\n      selectors:\n        - matchArgs: [...]      # in-kernel filter\n          matchActions:\n            - action: Sigkill    # enforcement\n```\n\n`syscall: true` for syscalls; `false` for internal functions (kprobes). No `matchActions` = observe only.'
    },
    {
      front: 'Tetragon actions (matchActions)',
      back: '| Action | Effect |\n|--------|--------|\n| **Post** | only emits the event (observability) |\n| **Sigkill** | kills the process in the kernel (enforcement) |\n| **Override** | makes the syscall return an error (e.g. -EPERM) |\n| **NotifyEnforcer** | signals the enforcer |\n\nEnforcement is **synchronous in the kernel** = no TOCTOU window.'
    },
    {
      front: 'Tetragon selectors — what are they for?',
      back: 'They filter events in the kernel (precision + less noise):\n\n- **matchBinaries** — executable path\n- **matchArgs** — syscall args (path/flags)\n- **matchPIDs** — PID / pid namespace\n- **matchCapabilities** — process capabilities\n- **matchNamespaceChanges** — namespace change (container escape!)\n\nGood filtering avoids an explosion of event volume.'
    },
    {
      front: 'Tetragon vs Falco',
      back: '**Falco** — rule-based detection (Falco Rules), alert only, broad CNCF ecosystem, eBPF or kernel module.\n\n**Tetragon** — eBPF CO-RE, **synchronous enforcement** (Sigkill/Override), TracingPolicy (kprobes/selectors), integrates with Cilium/Hubble.\n\nFalco = ready-made detection; Tetragon = blocking + deep correlation with the Cilium stack.'
    },
    {
      front: 'How to view Tetragon events?',
      back: '```bash\n# Compact (readable)\nkubectl exec -n kube-system ds/tetragon -c tetragon -- \\\n  tetra getevents -o compact\n\n# JSON (for SIEM)\n... tetra getevents -o json | jq .\n```\n\nSymbols: 🚀 exec, 💥 exit, 📂 file. Each event carries pod, binary, args, UID. Tetragon also exposes Prometheus metrics.'
    },
    {
      front: '4 classic TracingPolicy use cases',
      back: '1. **Reverse shell** — matchBinaries In [/bin/bash,/bin/sh] + Sigkill.\n2. **Write to system binaries** — kprobe security_file_permission + matchArgs Prefix /usr/bin.\n3. **Container escape** — matchNamespaceChanges.\n4. **Dangerous capabilities** — matchCapabilities (e.g. CAP_SYS_ADMIN).'
    }
  ],

  lab: {
    scenario: 'Install Tetragon, observe process execution out-of-the-box, create a TracingPolicy to detect shells and then evolve to enforcement with Sigkill.',
    objective: 'Understand the observe -> filter -> block flow of Tetragon using TracingPolicy and the tetra CLI.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Install Tetragon and view process events',
        instruction: 'Install Tetragon via Helm and observe the exec/exit events generated by a test Pod.',
        hints: ['tetra getevents -o compact', 'The DaemonSet runs in kube-system'],
        solution: `\`\`\`bash
helm repo add cilium https://helm.cilium.io
helm install tetragon cilium/tetragon -n kube-system

kubectl rollout status ds/tetragon -n kube-system

# Test pod
kubectl run xwing --image=cilium/json-mock

# Follow events (in another terminal)
kubectl exec -n kube-system ds/tetragon -c tetragon -- \\
  tetra getevents -o compact &

# Generate activity
kubectl exec xwing -- bash -c "curl -s https://example.com >/dev/null"
\`\`\``,
        verify: `\`\`\`bash
kubectl get ds tetragon -n kube-system
# Expected: DESIRED = READY (1 per node)

# In the compact events you should see something like:
# 🚀 process default/xwing /usr/bin/curl https://example.com
\`\`\``
      },
      {
        title: 'Observation TracingPolicy (detect shells)',
        instruction: 'Create a TracingPolicy that emits an event when /bin/bash or /bin/sh are executed.',
        hints: ['matchBinaries with operator In', 'action: Post = observe only'],
        solution: `\`\`\`bash
cat <<'EOF' | kubectl apply -f -
apiVersion: cilium.io/v1alpha1
kind: TracingPolicy
metadata:
  name: monitor-shell
spec:
  kprobes:
    - call: "security_bprm_creds_from_file"
      syscall: false
      args:
        - index: 1
          type: "file"
      selectors:
        - matchBinaries:
            - operator: "In"
              values:
                - "/bin/bash"
                - "/bin/sh"
          matchActions:
            - action: Post
EOF

# Generate a shell
kubectl exec xwing -- sh -c "echo hello"
\`\`\``,
        verify: `\`\`\`bash
kubectl get tracingpolicy monitor-shell
# Expected: the policy listed

# In the events you should see the /bin/sh exec in pod xwing
kubectl exec -n kube-system ds/tetragon -c tetragon -- \\
  tetra getevents -o compact | grep -m1 'sh'
\`\`\``
      },
      {
        title: 'Evolve to enforcement (Sigkill)',
        instruction: 'Change the policy to kill shells with Sigkill and confirm the exec is blocked.',
        hints: ['Change action Post to Sigkill', 'The kubectl exec should fail/die'],
        solution: `\`\`\`bash
cat <<'EOF' | kubectl apply -f -
apiVersion: cilium.io/v1alpha1
kind: TracingPolicy
metadata:
  name: monitor-shell
spec:
  kprobes:
    - call: "security_bprm_creds_from_file"
      syscall: false
      args:
        - index: 1
          type: "file"
      selectors:
        - matchBinaries:
            - operator: "In"
              values:
                - "/bin/bash"
                - "/bin/sh"
          matchActions:
            - action: Sigkill
EOF

# Try to open a shell -> should be killed
kubectl exec xwing -- sh -c "echo should-not-run" ; echo "exit code: $?"
\`\`\``,
        verify: `\`\`\`bash
# The command above should return exit code != 0 (process killed)
# and the event should show the enforcement action

# Cleanup
kubectl delete tracingpolicy monitor-shell
kubectl delete pod xwing
helm uninstall tetragon -n kube-system
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'TracingPolicy applied but no events appear',
      difficulty: 'medium',
      symptom: 'The TracingPolicy was created without errors, but tetra getevents does not show the expected events when the condition should match.',
      diagnosis: `\`\`\`bash
# 1. Was the policy accepted?
kubectl get tracingpolicy
kubectl describe tracingpolicy <name>

# 2. Is the Tetragon agent healthy on all nodes?
kubectl get ds tetragon -n kube-system
kubectl logs -n kube-system ds/tetragon -c tetragon --tail=50 | grep -i 'error\\|policy'

# 3. Does the kprobe exist on this kernel?
# Some symbols vary between kernel versions
kubectl logs -n kube-system ds/tetragon -c tetragon | grep -i 'kprobe\\|symbol'
\`\`\``,
      solution: `**Common causes:**

1. **Selector does not match** — the \`matchArgs\`/\`matchBinaries\` is too strict or has the wrong path. Test first with a broader selector (just \`matchBinaries\` for example) and refine.

2. **kprobe symbol missing in the kernel** — \`call:\` points to a function that changed name between versions. Check the agent logs and adjust to the correct symbol for that kernel.

3. **Event on the wrong node** — the DaemonSet observes per node; confirm that the Pod generating the event is on a node with the agent Running.

\`\`\`bash
# Validate with a broad test
kubectl exec -n kube-system ds/tetragon -c tetragon -- \\
  tetra getevents -o compact | head
# If generic exec events appear, the agent is fine;
# the problem is in the policy selector.
\`\`\`

**Prevention:** start broad (action: Post) to validate detection before narrowing and before enabling enforcement.`
    },
    {
      title: 'Tetragon does not start: kernel without BTF / CO-RE',
      difficulty: 'hard',
      symptom: 'Tetragon pods stay in CrashLoopBackOff. Logs mention BTF not found, failure to load eBPF programs, or "failed to load BPF".',
      diagnosis: `\`\`\`bash
kubectl logs -n kube-system ds/tetragon -c tetragon --previous | grep -i 'btf\\|bpf\\|CO-RE'

# Check whether the kernel exposes BTF
ls -l /sys/kernel/btf/vmlinux   # on the node
uname -r
\`\`\``,
      solution: `**Cause:** Tetragon uses **CO-RE** (Compile Once - Run Everywhere), which depends on **BTF** (BPF Type Format) in the kernel (\`/sys/kernel/btf/vmlinux\`). Old kernels or builds without CONFIG_DEBUG_INFO_BTF do not expose BTF.

**Solutions:**

1. **Update the kernel** to a version with BTF enabled (recommended; >= 5.x on most distros).

2. **Provide external BTF** — on kernels without BTF, you can point to an external BTF file matching the kernel (BTFHub), via Tetragon configuration:
\`\`\`bash
helm upgrade tetragon cilium/tetragon -n kube-system \\
  --set tetragon.btf=/var/lib/tetragon/btf
\`\`\`

3. **Check requirements** — kernel >= 4.19 for basic features; advanced features require newer kernels.

**Prevention:** validate \`/sys/kernel/btf/vmlinux\` on the nodes before installing; prefer node images with BTF enabled.`
    }
  ]
};
