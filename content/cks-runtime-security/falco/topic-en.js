window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['cks-runtime-security/falco'] = {
  theory: `# Falco Runtime Security

## Exam Relevance
> CKS requires you to understand Falco's architecture, write/modify Falco rules, interpret alerts, and configure Falco outputs. Core Runtime Security topic, ~12% of CKS exam.

## What is Falco?

**Falco** is a cloud-native runtime security tool developed by Sysdig, now a CNCF graduated project. It monitors kernel syscalls in real-time and generates alerts when suspicious behavior is detected.

\`\`\`
Container ──syscall──► Linux Kernel ──eBPF/kernel module──► Falco Engine
                                                                  ↓
                                                         Rule Evaluation
                                                                  ↓
                                                         Alert Output
                                                         (file, syslog, webhook, etc.)
\`\`\`

## Key Capabilities

- **Detect shell access** in containers (kubectl exec)
- **Detect file writes** in sensitive directories
- **Detect privilege escalation** attempts
- **Detect unexpected outbound connections**
- **Detect privilege escalation** via setuid binaries
- **Monitor sensitive file reads** (/etc/shadow, /etc/passwd)

## Falco Architecture

\`\`\`bash
# Falco components:
# 1. Kernel module OR eBPF probe: collects syscall events
# 2. Falco engine: evaluates rules against events
# 3. Outputs: file, syslog, gRPC, webhook

# Running as DaemonSet (recommended for Kubernetes)
kubectl get pods -n falco

# Or as systemd service on nodes
systemctl status falco
\`\`\`

## Falco Rule Structure

\`\`\`yaml
# Basic rule anatomy
- rule: Rule Name
  desc: What this rule detects
  condition: >              # Sysdig filter expression
    syscall_condition and
    container_condition and
    not whitelist_condition
  output: >                 # Alert message template
    Alert message (%field1) more (%field2)
  priority: WARNING         # DEBUG, INFORMATIONAL, NOTICE, WARNING, ERROR, CRITICAL, ALERT, EMERGENCY
  tags: [container, network, mitre_tag]
  enabled: true             # optional, default true
\`\`\`

## Built-in Rules (Key Examples)

\`\`\`yaml
# Detect shell execution in container
- rule: Terminal Shell in Container
  condition: >
    evt.type = execve and
    container and
    proc.name in (shell_binaries)
  output: >
    A shell was spawned in a container
    (user=%user.name container=%container.name
     shell=%proc.name parent=%proc.pname)
  priority: NOTICE

# Detect sensitive file reads
- rule: Read sensitive file untrusted
  condition: >
    open_read and
    sensitive_files and
    not proc.name in (known_safe_processes)
  output: >
    Sensitive file opened for reading
    (user=%user.name file=%fd.name)
  priority: WARNING

# Detect write to /etc
- rule: Write below etc
  condition: >
    open_write and
    container and
    fd.name startswith /etc
  output: >
    File written below /etc (user=%user.name file=%fd.name)
  priority: ERROR
\`\`\`

## Falco Fields Reference

\`\`\`
# Process fields:
proc.name       = process name (e.g., bash, wget, curl)
proc.pname      = parent process name
proc.cmdline    = full command line
proc.pid        = process ID
proc.args       = process arguments

# File/network:
fd.name         = file descriptor name (file path or socket address)
fd.directory    = directory portion of fd.name
fd.type         = fd type (file, ipv4, ipv6, unix, etc.)

# Container fields:
container.name  = container name
container.id    = container ID (short)
container.image.repository = image name (without tag)
container.image.tag        = image tag

# User fields:
user.name       = username of process
user.uid        = user ID

# Syscall fields:
evt.type        = syscall type (execve, open, connect, etc.)
evt.dir         = direction: > (enter) or < (exit)
\`\`\`

## Writing Custom Falco Rules

### Example 1: Detect Crypto Mining

\`\`\`yaml
- rule: Detect Crypto Mining
  desc: Detect processes that look like cryptocurrency miners
  condition: >
    spawned_process and
    (proc.name in (crypto_miners) or
     proc.cmdline contains "--pool" or
     proc.cmdline contains "stratum+tcp")
  output: >
    Crypto miner detected
    (user=%user.name process=%proc.cmdline
     container=%container.name image=%container.image.repository)
  priority: CRITICAL
  tags: [cryptomining, mitre_impact]
\`\`\`

### Example 2: Detect Metadata API Access

\`\`\`yaml
- rule: Cloud Metadata Access
  desc: Detect access to cloud metadata endpoint from container
  condition: >
    outbound and
    fd.sip = "169.254.169.254" and
    container
  output: >
    Metadata API access from container
    (user=%user.name container=%container.name
     image=%container.image.repository
     connection=%fd.name)
  priority: WARNING
  tags: [cloud, network, mitre_credential_access]
\`\`\`

### Example 3: Detect New Network Tool

\`\`\`yaml
- macro: network_tools
  condition: >
    proc.name in (nc, netcat, ncat, socat, nmap, tcpdump, tshark, wget, curl)

- rule: Unexpected Network Tool
  desc: Network tool executed in container
  condition: >
    spawned_process and
    container and
    network_tools and
    not proc.pname in (known_good_parents)
  output: >
    Network tool used in container
    (user=%user.name container=%container.name
     tool=%proc.name image=%container.image.repository)
  priority: NOTICE
\`\`\`

## Falco Configuration

\`\`\`yaml
# /etc/falco/falco.yaml
rules_files:
  - /etc/falco/falco_rules.yaml          # built-in rules
  - /etc/falco/falco_rules.local.yaml    # local overrides
  - /etc/falco/rules.d/                  # custom rules directory

output_timeout: 2000                     # milliseconds

outputs:
  rate: 1
  max_burst: 1000

# Outputs configuration
file_output:
  enabled: true
  keep_alive: false
  filename: /var/log/falco/falco.log

stdout_output:
  enabled: true

syslog_output:
  enabled: false

http_output:
  enabled: true
  url: https://siem.company.com/falco
  user_agent: "falcosecurity/falco"

json_output: true                        # output alerts as JSON
json_include_output_property: true
\`\`\`

## Falco Rule File Structure

\`\`\`yaml
# /etc/falco/falco_rules.local.yaml (custom rules)

# Macros: reusable condition fragments
- macro: my_container_images
  condition: container.image.repository in (mycompany/webapp, mycompany/api)

# Lists: reusable collections
- list: trusted_network_tools
  items: [curl, wget]

# Override a built-in rule
- rule: Terminal Shell in Container
  override:
    condition: replace    # replace the condition
    output: append        # append to the output
  condition: >
    evt.type = execve and
    container and
    proc.name in (shell_binaries) and
    not container.image.repository startswith "mycompany/"  # allow shells in our images
  output: (source=mycompany-custom)
\`\`\`

## Testing Falco Rules

\`\`\`bash
# Generate a test event (spawn a shell in a container)
kubectl exec <pod> -- sh

# Check Falco alerts
# Method 1: Falco logs (as DaemonSet)
kubectl logs -n falco -l app=falco | grep -i "terminal shell\|notice\|warning" | tail -20

# Method 2: Falco log file (on node)
tail -f /var/log/falco/falco.log

# Method 3: JSON output
cat /var/log/falco/falco.log | python3 -m json.tool | grep -E '"rule"|"output"'

# Validate rules without starting Falco
falco --validate /etc/falco/falco_rules.local.yaml

# Dry run with a specific rule file
falco -r /etc/falco/my-rules.yaml --dry-run
\`\`\`

## Interpreting Falco Output

\`\`\`json
{
  "output": "21:30:12.123456789: Warning A shell was spawned in a container (user=root container=webapp shell=bash parent=kubectl)",
  "priority": "Warning",
  "rule": "Terminal Shell in Container",
  "time": "2024-01-15T21:30:12.123456789Z",
  "output_fields": {
    "container.name": "webapp",
    "container.image.repository": "mycompany/webapp",
    "evt.time": 1705358212,
    "proc.name": "bash",
    "user.name": "root"
  }
}
\`\`\`

## Falco + Kubernetes Event Enrichment

Falco 0.32+ supports Kubernetes metadata enrichment from the API server:

\`\`\`yaml
# falco.yaml
plugins:
- name: k8saudit
  library_path: /usr/share/falco/plugins/libk8saudit.so
  init_config:
    maxEventSize: 262144
  open_params: http://localhost:7765/k8s-audit

# This enables rules that reference Kubernetes audit events
# e.g., detecting unauthorized access patterns via the API server
\`\`\`

## Common Mistakes

- **Not reloading rules after update**: Falco reads rules at startup — changes require pod restart or SIGHUP
- **Over-broad rules creating too many alerts**: Alert fatigue leads to ignoring real incidents — tune carefully
- **Not excluding system namespaces**: kube-system operations may trigger rules — add exceptions
- **Confusing macro, list, rule**: Macros are reusable condition snippets; lists are collections; rules use both

## Killer.sh Style Challenge

> **Scenario**: Write a Falco rule that alerts with priority CRITICAL whenever a process named \`kubectl\` or \`k8s\` is executed inside a container. The output should include the container name and the command line.
`,

  quiz: [
    {
      question: 'How does Falco collect events from the kernel?',
      options: [
        'Via a kernel module or eBPF probe that intercepts Linux syscalls',
        'By reading Docker daemon logs',
        'By monitoring Kubernetes audit logs',
        'By parsing container filesystem changes'
      ],
      correct: 0,
      explanation: 'Falco uses either a kernel module (falco.ko) or an eBPF probe to intercept Linux syscalls directly at the kernel level. This is how it detects events like file opens, process executions, and network connections in real-time.',
      reference: 'Falco — Architecture section.'
    },
    {
      question: 'In a Falco rule, what does the "condition" field contain?',
      options: [
        'A Sysdig filter expression that matches kernel events — similar to Wireshark filter syntax',
        'A Rego policy (like OPA)',
        'A CEL (Common Expression Language) expression',
        'A regular expression pattern matching container names'
      ],
      correct: 0,
      explanation: 'Falco conditions use Sysdig filter syntax — a language for matching kernel events based on fields like evt.type (syscall), proc.name (process), fd.name (file/socket), container.name, etc. Boolean operators (and, or, not) are supported.',
      reference: 'Falco — Falco Rule Structure section.'
    },
    {
      question: 'What Falco field contains the name of the image repository for a container?',
      options: [
        'container.image.repository',
        'container.image.name',
        'image.repo',
        'docker.image'
      ],
      correct: 0,
      explanation: 'container.image.repository gives the image name without the tag (e.g., "nginx" or "mycompany/webapp"). container.image.tag gives the tag. These fields are available because Falco is integrated with the container runtime.',
      reference: 'Falco — Falco Fields Reference section.'
    },
    {
      question: 'A Falco rule has condition: "spawned_process and container and proc.name = bash". When does it trigger?',
      options: [
        'When bash is started as a new process inside a container',
        'When bash is already running and a new file is opened',
        'When any process in a bash container accesses the network',
        'When a container named "bash" is started'
      ],
      correct: 0,
      explanation: '"spawned_process" is a Falco macro that matches when a new process is executed (execve syscall, exit direction). Combined with container (running in a container) and proc.name = bash (the new process is bash), the rule triggers when bash is launched inside a container.',
      reference: 'Falco — Built-in Rules section.'
    },
    {
      question: 'Where should you add custom Falco rules to avoid losing them on upgrades?',
      options: [
        '/etc/falco/falco_rules.local.yaml or /etc/falco/rules.d/ directory',
        '/etc/falco/falco_rules.yaml (the main rules file)',
        '/usr/share/falco/rules/ directory',
        'Directly in the Falco container image'
      ],
      correct: 0,
      explanation: 'falco_rules.local.yaml is the designated file for local customizations. It is loaded after the main falco_rules.yaml, so it can override built-in rules. It is not overwritten by Falco package upgrades.',
      reference: 'Falco — Falco Rule File Structure section.'
    },
    {
      question: 'How do you validate Falco rules syntax without starting Falco?',
      options: [
        'falco --validate /etc/falco/falco_rules.local.yaml',
        'falco-check /etc/falco/rules.yaml',
        'kubectl validate falco-rules -f /etc/falco/rules.yaml',
        'falco --dry-run --rules /etc/falco/rules.yaml'
      ],
      correct: 0,
      explanation: 'falco --validate <file> reads and validates the rule file syntax without actually starting Falco or connecting to the kernel driver. This is useful to verify custom rules before deployment.',
      reference: 'Falco — Testing Falco Rules section.'
    },
    {
      question: 'A Falco alert shows: "rule: Terminal Shell in Container, user=attacker, container=webapp". What does this indicate?',
      options: [
        'Someone (as user "attacker") executed a shell (bash/sh) inside the "webapp" container — likely kubectl exec or container compromise',
        'A new container named "webapp" was created by user "attacker"',
        'The webapp container failed to start',
        'A network connection was established to the webapp container'
      ],
      correct: 0,
      explanation: 'The "Terminal Shell in Container" rule fires when a shell (bash, sh, etc.) is executed inside a running container. This happens when someone uses kubectl exec to get an interactive shell, which is legitimate but suspicious. It also fires if a compromised process spawns a shell.',
      reference: 'Falco — Built-in Rules section.'
    },
    {
      question: 'What is a Falco macro and how is it used?',
      options: [
        'A reusable named condition fragment that can be referenced in rules to avoid duplication',
        'A Falco plugin that extends event collection beyond syscalls',
        'A template for generating multiple rules with different parameters',
        'A way to group multiple rules under a single alert'
      ],
      correct: 0,
      explanation: 'A macro is a named condition fragment that can be reused across multiple rules. For example: "macro: container" might expand to "container.id != host". Using macros makes rules more readable and DRY (Don\'t Repeat Yourself).',
      reference: 'Falco — Falco Rule File Structure section.'
    }
  ],

  flashcards: [
    {
      front: 'What is Falco and how does it work?',
      back: 'Falco: CNCF runtime security tool by Sysdig\n\nHow it works:\n1. Kernel module or eBPF probe hooks into Linux kernel\n2. Intercepts syscalls from all processes (including containers)\n3. Events matched against Falco rules (Sysdig filter language)\n4. Violations generate alerts via configured outputs\n\nKey capabilities:\n- Detect shell in container\n- Detect sensitive file access\n- Detect unexpected network connections\n- Detect privilege escalation\n- Monitor K8s audit events (plugin)'
    },
    {
      front: 'What are the components of a Falco rule?',
      back: '- rule: <name>           # unique rule name\n  desc: <description>    # human-readable purpose\n  condition: >           # Sysdig filter (when to fire)\n    evt.type = execve and\n    container and\n    proc.name = bash\n  output: >              # alert message with field expansion\n    Shell in container (user=%user.name\n    container=%container.name cmd=%proc.cmdline)\n  priority: WARNING      # DEBUG to EMERGENCY\n  tags: [container]      # categories\n  enabled: true          # optional, default true'
    },
    {
      front: 'What Falco fields identify where a suspicious event occurred?',
      back: 'Container identification:\ncontainer.name              = container name\ncontainer.id                = container ID\ncontainer.image.repository  = image name (no tag)\ncontainer.image.tag         = image tag\n\nProcess identification:\nproc.name     = process name (bash, curl, wget)\nproc.cmdline  = full command line\nproc.pname    = parent process name\nproc.pid      = PID\n\nFile/network:\nfd.name       = file path or socket address\nfd.directory  = directory portion\nfd.sip        = destination IP (server IP)\n\nUser:\nuser.name     = username\nuser.uid      = UID'
    },
    {
      front: 'Write a Falco rule to detect metadata API access from containers',
      back: '- rule: Cloud Metadata API Access\n  desc: Detect access to cloud metadata endpoint\n  condition: >\n    outbound and\n    fd.sip = "169.254.169.254" and\n    container\n  output: >\n    Metadata API access from container\n    (user=%user.name\n     container=%container.name\n     image=%container.image.repository\n     connection=%fd.name)\n  priority: WARNING\n  tags: [cloud, network, mitre_credential_access]'
    },
    {
      front: 'How do you view Falco alerts in a Kubernetes cluster?',
      back: '# Falco running as DaemonSet:\nkubectl logs -n falco -l app=falco --tail=50\nkubectl logs -n falco -l app=falco -f  # follow\n\n# Filter for specific rule:\nkubectl logs -n falco -l app=falco | grep "Terminal Shell"\n\n# On the node directly:\ntail -f /var/log/falco/falco.log\n\n# JSON format (parse fields):\ncat /var/log/falco/falco.log | python3 -c "\nimport json, sys\nfor l in sys.stdin:\n  try:\n    e = json.loads(l)\n    print(e[\'rule\'], e[\'output_fields\'].get(\'container.name\'))\n  except: pass\n"'
    },
    {
      front: 'What is the difference between a Falco macro, list, and rule?',
      back: 'macro: reusable condition fragment\n- macro: container\n  condition: container.id != host\n\nlist: reusable collection of items\n- list: shell_binaries\n  items: [bash, sh, zsh, ksh, tcsh]\n\nrule: the actual detection logic\n- rule: Shell in Container\n  condition: spawned_process and container and proc.name in (shell_binaries)\n  # uses macro "container" and list "shell_binaries"\n\nOrder in rule file: define macros/lists before rules that use them\nLocal overrides: use "append: true" or "override:" to modify built-ins'
    }
  ],

  lab: {
    scenario: 'Your cluster needs runtime threat detection. Configure Falco to detect sensitive file access and shell execution in containers, then verify the rules work.',
    objective: 'Write custom Falco rules, deploy or configure Falco, and test that it detects suspicious container behavior.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Verify Falco installation and view default rules',
        instruction: `Check if Falco is running and review the built-in rules.

\`\`\`bash
# Check if Falco is running as a DaemonSet
kubectl get pods -n falco
kubectl get daemonset -n falco

# If not installed, install via Helm:
helm repo add falcosecurity https://falcosecurity.github.io/charts
helm repo update
helm install falco falcosecurity/falco \
  --namespace falco \
  --create-namespace \
  --set falco.grpc.enabled=true \
  --set falco.grpcOutput.enabled=true

# View built-in rules
kubectl exec -n falco -l app.kubernetes.io/name=falco -- cat /etc/falco/falco_rules.yaml | head -60

# View current Falco logs
kubectl logs -n falco -l app.kubernetes.io/name=falco --tail=20
\`\`\``,
        hints: [
          'If Falco is not in the exam environment, check if it runs as a systemd service: systemctl status falco',
          'The exam cluster should have Falco pre-installed'
        ],
        solution: `\`\`\`bash
kubectl get pods -n falco 2>/dev/null || systemctl status falco 2>/dev/null | head -10
\`\`\``,
        verify: `\`\`\`bash
# Falco should be running (DaemonSet or systemd)
kubectl get pods -n falco 2>/dev/null | grep Running || systemctl is-active falco 2>/dev/null
# Expected: Running or active
\`\`\``
      },
      {
        title: 'Trigger a default Falco rule',
        instruction: `Trigger the "Terminal Shell in Container" built-in rule and observe the alert.

\`\`\`bash
# Create a test pod
kubectl run falco-test --image=nginx:alpine --restart=Never

# Wait for it to be running
kubectl wait pod/falco-test --for=condition=Ready --timeout=30s

# Execute a shell inside the container (this should trigger Falco)
kubectl exec falco-test -- sh -c "id && whoami && ls /etc"

# Check Falco alerts
kubectl logs -n falco -l app.kubernetes.io/name=falco --tail=30 | grep -i "shell\|terminal\|falco-test"

# Or on the node:
# tail -f /var/log/falco/falco.log | grep falco-test
\`\`\``,
        hints: [
          'The exec command spawns a shell inside the container — this is exactly what Falco detects',
          'It may take a few seconds for the Falco log to appear',
          'Look for the rule name "Terminal Shell in Container" or "Shell spawned in a new process"'
        ],
        solution: `\`\`\`bash
kubectl run falco-test --image=nginx:alpine --restart=Never
kubectl wait pod/falco-test --for=condition=Ready --timeout=30s
kubectl exec falco-test -- sh -c "id"
sleep 2
kubectl logs -n falco -l app.kubernetes.io/name=falco --tail=10 | grep -i "shell\|terminal"
\`\`\``,
        verify: `\`\`\`bash
kubectl logs -n falco -l app.kubernetes.io/name=falco --tail=30 | grep -iE "shell|terminal|falco-test"
# Expected: Alert about shell in container or terminal shell spawned
\`\`\``
      },
      {
        title: 'Write a custom Falco rule',
        instruction: `Create a custom rule that detects access to /etc/shadow or /etc/passwd from a container.

\`\`\`bash
# On a Falco node or in a ConfigMap override
cat <<'EOF' > /tmp/custom-rules.yaml
# Custom CKS rule
- rule: Detect Password File Read
  desc: Detect reading /etc/shadow or /etc/passwd from a container
  condition: >
    open_read and
    container and
    fd.name in (/etc/shadow, /etc/passwd, /etc/sudoers, /root/.ssh/authorized_keys)
  output: >
    Sensitive file read in container
    (user=%user.name file=%fd.name
     container=%container.name
     image=%container.image.repository
     cmd=%proc.cmdline)
  priority: WARNING
  tags: [filesystem, mitre_credential_access, cks-exam]
EOF

# If Falco is running as DaemonSet, update the ConfigMap
kubectl create configmap falco-custom-rules \
  --from-file=custom-rules.yaml=/tmp/custom-rules.yaml \
  -n falco

# Or copy to the rules directory on the node (if systemd)
sudo cp /tmp/custom-rules.yaml /etc/falco/rules.d/custom-rules.yaml
sudo kill -1 $(pidof falco)   # SIGHUP to reload rules

# Validate the rule syntax
falco --validate /tmp/custom-rules.yaml
\`\`\``,
        hints: [
          'falco --validate checks syntax without starting the engine',
          'For DaemonSet installs, rules are in a ConfigMap — update and rollout restart the DaemonSet',
          'SIGHUP reloads rules without restarting Falco (for systemd installs)'
        ],
        solution: `\`\`\`bash
sudo tee /etc/falco/rules.d/custom-rules.yaml <<'EOF'
- rule: Detect Password File Read
  desc: Read of sensitive credential files
  condition: open_read and container and fd.name in (/etc/shadow, /etc/passwd)
  output: "Sensitive file read (user=%user.name file=%fd.name container=%container.name)"
  priority: WARNING
EOF
falco --validate /etc/falco/rules.d/custom-rules.yaml && echo "Rules valid"
\`\`\``,
        verify: `\`\`\`bash
# Rule file should validate
falco --validate /etc/falco/rules.d/custom-rules.yaml 2>&1 | grep -i "valid\|error"
# Expected: Rules validation successful (or no errors)

# Test by reading /etc/passwd from a container
kubectl exec falco-test -- cat /etc/passwd
sleep 2
kubectl logs -n falco -l app.kubernetes.io/name=falco --tail=10 | grep -i "sensitive\|passwd\|shadow" 2>/dev/null || \
  tail -5 /var/log/falco/falco.log 2>/dev/null | grep -i "sensitive\|passwd"
# Expected: Alert about sensitive file read
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Custom Falco rule not triggering even when condition should match',
      difficulty: 'medium',
      symptom: 'A custom Falco rule was added but no alerts appear even when the triggering action is performed.',
      diagnosis: `\`\`\`bash
# Validate the rule file
falco --validate /etc/falco/rules.d/custom-rules.yaml

# Check if Falco loaded the rule file
falco --list | grep "my-rule-name"

# Check Falco logs for rule loading errors
journalctl -u falco -n 50 | grep -i "error\|warn\|rule"

# Check if the rule is enabled
falco --list | grep -A3 "my-rule-name"

# Test the condition manually (verbose debug)
falco -r /etc/falco/rules.d/custom-rules.yaml --verbosity=debug 2>&1 | head -50

# Common issues:
# - Rule file not in rules_files list in falco.yaml
# - Rule overridden by a prior "enabled: false" entry
# - Condition uses undefined macro
\`\`\``,
      solution: `**Fix based on diagnosis:**

1. **Rule file not loaded:**
\`\`\`bash
# Check falco.yaml includes the rules directory
grep "rules_files" /etc/falco/falco.yaml
# Should include /etc/falco/rules.d/ or the specific file path
\`\`\`

2. **Undefined macro:**
\`\`\`bash
# Common macros to check
falco --list-macros | grep "spawned_process\|container\|open_read"
# If not found, define the macro in your rules file
\`\`\`

3. **Condition logic error:**
\`\`\`bash
# Test with a simpler condition first
condition: container      # just: any container event
# Then add specific conditions one by one
\`\`\`

4. **Rule file needs reload:**
\`\`\`bash
sudo kill -1 $(pidof falco)   # SIGHUP
# Or restart: systemctl restart falco
\`\`\``
    },
    {
      title: 'Falco generating too many alerts — alert fatigue',
      difficulty: 'medium',
      symptom: 'Falco is generating hundreds of alerts per minute, making it impossible to identify real threats.',
      diagnosis: `\`\`\`bash
# Count alerts by rule
cat /var/log/falco/falco.log | python3 -c "
from collections import Counter
import json, sys
c = Counter()
for l in sys.stdin:
  try:
    c[json.loads(l)['rule']] += 1
  except: pass
for rule, count in c.most_common(10):
  print(count, rule)
"

# Find what containers are generating most alerts
cat /var/log/falco/falco.log | python3 -c "
from collections import Counter
import json, sys
c = Counter()
for l in sys.stdin:
  try:
    e = json.loads(l)
    c[e['output_fields'].get('container.name', 'unknown')] += 1
  except: pass
for container, count in c.most_common(10):
  print(count, container)
"
\`\`\``,
      solution: `**Add exceptions to high-noise rules:**

\`\`\`yaml
# In /etc/falco/falco_rules.local.yaml

# Method 1: Append exception to existing rule
- rule: Terminal Shell in Container
  append: true
  condition: >
    and not container.image.repository startswith "mycompany/tools"
    and not container.name startswith "debug-"

# Method 2: Override the whole rule with additional exceptions
- rule: Read sensitive file untrusted
  override:
    condition: replace
  condition: >
    open_read and sensitive_files and
    not proc.name in (known_safe_readers) and
    not container.image.repository in (internal_images)
    and not k8s.ns.name in (kube-system, monitoring)

# Method 3: Disable a rule entirely (use sparingly)
- rule: Noisy Rule
  enabled: false
\`\`\`

\`\`\`bash
sudo kill -1 $(pidof falco)  # Reload
# Monitor alert rate: watch -n 5 "wc -l /var/log/falco/falco.log"
\`\`\``
    }
  ]
};
