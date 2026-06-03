window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['ai-engineering/copilot-devops'] = {
  theory: `
# GitHub Copilot for DevOps & Infrastructure

## Relevance
GitHub Copilot is the most widely adopted AI tool in the software development market. For DevOps/SRE/Platform Engineers, it goes beyond Python autocomplete — the real value is in accelerating Terraform writing, Helm charts, CI/CD pipelines, automation scripts, and answering infra technology questions directly in the terminal.

## What GitHub Copilot Really Is

### Main components

\`\`\`
GitHub Copilot Individual/Business/Enterprise
├── Copilot in IDE          → inline autocomplete + chat in editor
├── Copilot Chat            → contextual conversation in VS Code/JetBrains
├── Copilot CLI             → command suggestions in terminal
└── Copilot in GitHub.com   → chat in PRs, issues, code
\`\`\`

### How context works

Copilot automatically sends to the model:
- The file you are editing (or the visible section)
- Files open in neighboring tabs
- Imported/related files (in some modes)
- For Copilot Chat: what you explicitly select

**Practical implication:** keep related files open. If you are writing a Deployment, open the Service and HPA too — context dramatically improves suggestions.

## Copilot in VS Code for IaC

### Initial setup

\`\`\`bash
# Install extensions
code --install-extension GitHub.copilot
code --install-extension GitHub.copilot-chat

# Verify authentication
gh auth login
gh auth status
\`\`\`

### Essential shortcuts (VS Code)

\`\`\`
Tab               → Accept inline suggestion
Esc               → Reject suggestion
Alt+]             → Next suggestion
Alt+[             → Previous suggestion
Ctrl+Enter        → Open panel with multiple suggestions
Ctrl+I            → Open Copilot Chat inline (in file)
Ctrl+Shift+I      → Open Copilot Chat in sidebar
\`\`\`

### Generating Terraform with Copilot

\`\`\`hcl
# Technique 1: descriptive comment before the block
# Create an EKS cluster with:
# - 3 node groups: system (t3.medium), app (t3.large), gpu (g4dn.xlarge)
# - Private API endpoint, public access from office CIDR only
# - Managed node groups with auto-scaling min=1 max=10
# - IRSA enabled, cluster autoscaler IAM policy attached

resource "aws_eks_cluster" "main" {
  # Copilot will generate the complete block from this comment
}
\`\`\`

\`\`\`hcl
# Technique 2: descriptive resource name
# Copilot infers what you want from the name
resource "aws_security_group" "eks_nodes_allow_internal_traffic" {
  # Copilot understands: ingress/egress rules for EKS nodes
}
\`\`\`

\`\`\`hcl
# Technique 3: start with an example and repeat the pattern
resource "aws_route53_record" "api" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "api.example.com"
  type    = "CNAME"
  ttl     = 300
  records = [aws_lb.api.dns_name]
}

# Now start "resource "aws_route53_record" "admin" {"
# Copilot will suggest the same pattern with "admin"
\`\`\`

### Generating Kubernetes YAML with Copilot

\`\`\`yaml
# Copilot in YAML: use descriptive inline comments

# Deployment for the payment service
# 3 replicas, RollingUpdate strategy with maxSurge=1 maxUnavailable=0
# Requests: 200m CPU, 256Mi memory / Limits: 1000m CPU, 1Gi memory
# Readiness probe: HTTP /health on port 8080, initialDelay 30s
# Anti-affinity: spread across different nodes
apiVersion: apps/v1
kind: Deployment
metadata:
  # Copilot completes with correct name, namespace, labels
\`\`\`

**Productivity tip:** write the comments BEFORE the YAML. Copilot uses the comment as a functional spec and generates the complete manifest.

### Generating Shell/Python scripts with Copilot

\`\`\`bash
#!/bin/bash
# Script: find pods with high memory usage and restart them
# Threshold: 90% of memory limit
# Actions: log the pod, send Slack notification, then restart
# Required env vars: SLACK_WEBHOOK_URL, NAMESPACE, THRESHOLD_PERCENT

# Copilot will generate the entire script from this header
\`\`\`

## Copilot Chat — advanced use for infra

### Explicit context with @workspace, #file

\`\`\`
# Reference specific files
@workspace Explain what this Helm chart does and identify security issues
#file:values.yaml Which values are required but have no default?
#file:deployment.yaml #file:hpa.yaml Are these two files consistent?

# Select a section and ask
[select a YAML block] → Ctrl+I → "Add liveness and readiness probes to this Deployment"
\`\`\`

### Useful slash commands in Copilot Chat

\`\`\`
/explain    → Explains selected code/YAML
/fix        → Suggests fix for selected problem
/tests      → Generates tests for selected code
/doc        → Generates documentation (good for Terraform modules)
/new        → Creates a new file (scaffold)
\`\`\`

### Practical use cases

\`\`\`
# Review a complete Helm chart
"@workspace You are a Kubernetes security expert.
Review #file:templates/deployment.yaml and identify:
1. Containers running as root
2. Missing security context fields
3. Resource limits not configured
Return a list of issues ordered by severity."

# Generate Terraform variables from an existing module
"Analyze #file:main.tf and generate the variables.tf file with
all required variables, correct types, and descriptions."

# Explain a CI error
"This is the log from my failing GitHub Actions:
[paste the log]
What is the cause and how to fix it?"
\`\`\`

## Copilot CLI — commands in the terminal

### Installation and setup

\`\`\`bash
# Install CLI extension
gh extension install github/gh-copilot

# Verify installation
gh copilot --help
\`\`\`

### Main commands

\`\`\`bash
# Suggest a command (does not execute)
gh copilot suggest "find all pods with more than 2 restarts in namespace production"

# Expected output:
# kubectl get pods -n production --field-selector=status.phase=Running \
#   -o jsonpath='{range .items[*]}{.metadata.name}{" "}{.status.containerStatuses[0].restartCount}{"\n"}{end}' \
#   | awk '$2 > 2'

# Explain a command you don't understand
gh copilot explain "kubectl get pods -o jsonpath='{.items[*].spec.nodeName}' | tr ' ' '\n' | sort | uniq -c"

# Interactive mode with shell type
gh copilot suggest -t shell "compress all log files older than 7 days and upload to S3"
gh copilot suggest -t git "undo the last commit but keep the changes staged"
gh copilot suggest -t gh "list all open PRs assigned to me with CI failing"
\`\`\`

### Aliases for quick use

\`\`\`bash
# Add to ~/.bashrc or ~/.zshrc
alias '??'='gh copilot suggest -t shell'
alias 'git?'='gh copilot suggest -t git'
alias 'k?'='gh copilot suggest -t shell "kubectl"'

# Usage:
?? "create a cronjob that runs every hour"
k? "get all pods sorted by memory usage"
\`\`\`

## Copilot in JetBrains (GoLand, IntelliJ, PyCharm)

\`\`\`
Install: Settings → Plugins → Marketplace → "GitHub Copilot"

Shortcuts:
Alt+\       → Accept suggestion
Tab         → Accept next word
Alt+]       → Next alternative suggestion
Alt+[       → Previous suggestion
Alt+Shift+\ → Open Copilot Chat
\`\`\`

**Difference vs VS Code:** JetBrains has better support for backend languages (Go, Java, Python) but Copilot Chat in VS Code is more mature for IaC and YAML use.

## Important Limitations

\`\`\`
1. No access to your cluster/cloud
   → Doesn't see your cluster, can't run kubectl get
   → Doesn't know current terraform state
   → Suggestions based on patterns, not your environment

2. Knowledge cutoff
   → Terraform providers may be outdated
   → Deprecated K8s APIs may appear
   → Always verify versions in official registry

3. No business context
   → Doesn't know your naming conventions
   → Doesn't know your cost centers or compliance rules
   → Add explicitly in comments/context

4. May generate insecure code
   → Won't flag 'privileged: true' unless context prohibits it
   → IAM policies with '*:*' if you don't specify
   → Always review with security focus

5. Non-deterministic
   → Same comment may generate different YAML
   → Iterate until you get the desired result
\`\`\`

## Recommended Workflow for IaC with Copilot

\`\`\`
1. Write descriptive comment as spec
   ↓
2. Accept Copilot's base suggestion
   ↓
3. Refine with Copilot Chat
   ↓
4. Validate: terraform validate / kubectl dry-run
   ↓
5. Security review: tfsec / checkov / kubesec
   ↓
6. Commit
\`\`\`

## Common Mistakes

1. **Accepting suggestions without reading** — Copilot may generate \`privileged: true\` or wrong ports
2. **Not giving context** — vague comments generate generic YAML; be specific
3. **Not using open tabs** — closing related files impoverishes suggestions
4. **Trusting provider versions** — \`aws = "~> 4.0"\` may be outdated; check Terraform Registry
5. **Not reviewing before commit** — Copilot doesn't know what's a secret; never commit what it generates without reviewing

## Killer.sh Style Challenge

> **Scenario:** You need to create a Terraform module for an EKS cluster with node groups, IRSA, and cluster autoscaler. Use Copilot optimally: write the comments you would use as a "spec" to guide Copilot in generating \`main.tf\`, \`variables.tf\`, and \`outputs.tf\`. The goal is a reusable and secure module.
`,
  quiz: [
    {
      question: 'What is the best strategy for using GitHub Copilot when writing a complex Deployment YAML with anti-affinity, resource limits, and probes?',
      options: [
        'Start typing YAML and let Copilot complete field by field',
        'Write a descriptive comment above the resource specifying all requirements as a "spec", then let Copilot generate the complete block',
        'Use Copilot Chat and ask for the YAML directly without opening the file',
        'Copilot is not suitable for YAML — only use it for Python/Go'
      ],
      correct: 1,
      explanation: 'Using descriptive comments as a "spec" before the resource is the most effective technique. Copilot interprets the comment as a functional specification and generates YAML aligned with what was described. This is more efficient than typing field by field and produces more consistent results than asking via Chat without an open file.',
      reference: 'Related technique: "Prompt via comment" — the same principle works for Terraform, bash scripts, and Python modules.'
    },
    {
      question: 'What does the command `gh copilot suggest -t shell "find pods with crashloopbackoff"` do?',
      options: [
        'Automatically executes the kubectl command on the cluster',
        'Suggests a shell command to find pods in CrashLoopBackOff, without executing',
        'Automatically installs the kubectl-crashloop plugin',
        'Sends the result to GitHub Issues'
      ],
      correct: 1,
      explanation: '`gh copilot suggest` only SUGGESTS the command, never executes. The `-t shell` flag indicates you want a shell command (vs git or gh). Copilot CLI is safe by design — you see the suggestion and decide whether to execute it. This is important for destructive or complex commands.',
      reference: 'Complementary command: `gh copilot explain "<command>"` explains what a command does — useful for understanding complex pipes and flags.'
    },
    {
      question: 'Why does keeping related files open in VS Code improve Copilot suggestions for Kubernetes YAML?',
      options: [
        'It doesn\'t — Copilot only uses the current file',
        'Copilot automatically sends open files as additional context to the model, improving coherence between related resources (Deployment + Service + HPA)',
        'Open files are indexed on GitHub for training',
        'Copilot only works when all project files are open'
      ],
      correct: 1,
      explanation: 'Copilot automatically sends context from files open in neighboring tabs to the model. If you have a Deployment open and also open the Service and HPA, Copilot understands the relationship between them — suggests consistent selectors, same labels, coherent ports. Without this context, suggestions are more generic.',
      reference: 'Advanced tip: for large projects, use `@workspace` in Copilot Chat to index all workspace files as context.'
    },
    {
      question: 'What is the most critical limitation of GitHub Copilot for use in production infrastructure?',
      options: [
        'It only works with public repositories on GitHub',
        'It has no access to your current cluster or cloud state — doesn\'t know what\'s deployed, may suggest outdated configs, and may include insecure practices if context doesn\'t specify otherwise',
        'It doesn\'t support YAML, only traditional programming languages',
        'It requires a Kubernetes cluster connection to work'
      ],
      correct: 1,
      explanation: 'Copilot has no access to your real environment state — it can\'t run kubectl get, terraform state show, or see what\'s deployed. It generates based on training patterns. Consequences: may suggest old image versions, configurations inconsistent with your environment, or resource limit values inappropriate for your actual workloads. Always validate against real state.',
      reference: 'Solution: for context about current state, use tools that integrate LLMs with cluster access — like MCP servers for kubectl in Claude Code.'
    },
    {
      question: 'Which Copilot Chat slash command is most useful for auditing a Terraform module for security issues?',
      options: [
        '/tests — automatically generates security tests',
        '/fix — automatically fixes all issues',
        '/explain combined with a specific security question — understands the module and identifies risks',
        '/new — recreates the module from scratch with best practices'
      ],
      correct: 2,
      explanation: 'There is no specific slash command for security auditing. The most effective approach is to use /explain or simply ask a direct question in Copilot Chat with specific context: "@workspace You are a cloud security expert. Identify security issues in #file:main.tf — focus on IAM overpermission, publicly exposed resources, and missing encryption." /fix is useful but must be reviewed — never accept blindly.',
      reference: 'Complementary tool: use `checkov` or `tfsec` for automated static security analysis in Terraform, separately from Copilot.'
    },
    {
      question: 'What is the correct workflow for using Copilot to create a production automation bash script?',
      options: [
        'Ask for the complete script via chat, copy it and execute directly in production',
        'Write the script header with comments detailing objective, required variables, and actions — let Copilot generate — review and validate in a safe environment before using',
        'Only use for development scripts, never for production',
        'Always regenerate the script from scratch before each use'
      ],
      correct: 1,
      explanation: 'The correct workflow: (1) descriptive header as spec → (2) Copilot generates the body → (3) critical review of the generated script → (4) test in a non-critical environment → (5) use in production. Skipping any step is risky — Copilot may generate commands with wrong flags, hardcoded paths, or incorrect logic that only surfaces in edge cases.',
      reference: 'Related practice: never use `rm -rf` or destructive commands generated by LLMs without reviewing line by line.'
    },
    {
      question: 'How does the alias `alias "??=gh copilot suggest -t shell"` improve an SRE\'s terminal workflow?',
      options: [
        'Automatically executes the suggested command',
        'Allows typing `?? "description of what you need"` to get shell command suggestions quickly, without leaving the terminal',
        'Replaces the kubectl man page',
        'Automatically installs new plugins'
      ],
      correct: 1,
      explanation: 'The alias allows asking natural language questions about shell commands without leaving the terminal. Instead of pausing, opening a browser and searching, you type `?? "list namespaces sorted by pod count"` and get the suggestion inline. It increases workflow without breaking context. The suggestion still needs to be reviewed before executing.',
      reference: 'Tip: create separate aliases for different contexts — `k?` for kubectl, `tf?` for terraform, `git?` for git.'
    }
  ],
  flashcards: [
    {
      front: 'GitHub Copilot — components for DevOps/SRE',
      back: '**Copilot in IDE (VS Code / JetBrains)**\n- Inline autocomplete in YAML, Terraform, scripts\n- Copilot Chat with file context\n- Slash commands: /explain, /fix, /doc, /tests\n\n**Copilot CLI**\n- `gh copilot suggest -t shell "<desc>"` → suggest commands\n- `gh copilot explain "<cmd>"` → explain commands\n- Flags: `-t shell`, `-t git`, `-t gh`\n\n**VS Code Shortcuts:**\n- Tab → accept suggestion\n- Ctrl+I → inline chat\n- Ctrl+Enter → multiple suggestions\n- Alt+] / Alt+[ → navigate suggestions\n\n**Automatic context:**\n- Current file + open tabs\n- @workspace → indexes project\n- #file:x.yaml → explicit reference'
    },
    {
      front: '"Spec via Comment" technique for IaC with Copilot',
      back: '**What it is:**\nWriting detailed comments BEFORE the resource,\ndescribing all requirements. Copilot uses\nthe comment as a functional specification.\n\n**Template for YAML:**\n\`\`\`yaml\n# Deployment for service X\n# - 3 replicas, RollingUpdate maxUnavailable=0\n# - Resources: 200m/256Mi req, 1000m/1Gi limit\n# - Liveness: /health:8080, delay 30s\n# - Anti-affinity: spread across nodes\napiVersion: apps/v1\nkind: Deployment\n\`\`\`\n\n**Template for Terraform:**\n\`\`\`hcl\n# EKS cluster with:\n# - Private endpoint only\n# - 3 node groups: system/app/spot\n# - IRSA enabled, logging: audit+api\nresource "aws_eks_cluster" "main" {\n\`\`\`\n\n**Rule:** the more specific the comment,\nthe better the generated code.'
    },
    {
      front: 'Copilot CLI — essential commands for SRE',
      back: '**Installation:**\n`gh extension install github/gh-copilot`\n\n**Suggest (does not execute):**\n`gh copilot suggest "description"`\n`gh copilot suggest -t shell "kubectl..."`\n`gh copilot suggest -t git "undo last commit"`\n`gh copilot suggest -t gh "list PRs..."`\n\n**Explain:**\n`gh copilot explain "<complex-command>"`\n\n**Useful aliases:**\n\`\`\`bash\nalias "??=gh copilot suggest -t shell"\nalias "git?=gh copilot suggest -t git"\n\`\`\`\n\n**Usage examples:**\n`?? "find pods consuming more than 500Mi memory"`\n`?? "create configmap from all files in /config dir"`\n`git? "squash last 5 commits"`\n\n**IMPORTANT:** always review before executing!'
    },
    {
      front: 'Copilot Chat — context and references',
      back: '**Reference files:**\n- `#file:deployment.yaml` → includes the file\n- `#file:values.yaml #file:chart.yaml` → multiple\n\n**Workspace:**\n- `@workspace` → indexes entire project\n\n**Slash commands:**\n- `/explain` → explains selected code\n- `/fix` → suggests correction\n- `/tests` → generates tests\n- `/doc` → generates documentation\n- `/new` → scaffold of new file\n\n**Effective prompts:**\n\`\`\`\n"@workspace You are a k8s security expert.\nAnalyze #file:deployment.yaml:\n1. Containers running as root?\n2. Missing security context?\n3. Unnecessary capabilities?\nList by severity."\n\`\`\`\n\n**Shortcut:** select text + Ctrl+I\nfor contextual inline chat.'
    },
    {
      front: 'Copilot limitations for infra — what not to expect',
      back: '**1. No access to real environment**\n- Doesn\'t see your cluster, can\'t run kubectl get\n- Doesn\'t know current terraform state\n- Suggestions based on patterns, not your environment\n\n**2. Knowledge cutoff**\n- Terraform providers may be outdated\n- Deprecated K8s APIs may appear\n→ Always verify versions in official registry\n\n**3. No business context**\n- Doesn\'t know your naming conventions\n- Doesn\'t know your cost centers or compliance rules\n→ Add in comments/context\n\n**4. May generate insecure code**\n- `privileged: true` if context doesn\'t prohibit\n- IAM policies with `*:*` if you don\'t specify\n→ Always review with security focus\n\n**5. Non-deterministic**\n→ Iterate until you get the desired result'
    },
    {
      front: 'Optimized workflow: Copilot + IaC',
      back: '**For Terraform:**\n1. Comment as spec (complete requirements)\n2. Copilot generates the block\n3. Open variables and outputs in tabs\n4. Ask `/doc` to document the module\n5. `terraform validate && terraform plan`\n6. `tfsec .` or `checkov -d .` for security\n\n**For Kubernetes YAML:**\n1. Descriptive comment before the resource\n2. Copilot generates the manifest\n3. `kubectl apply --dry-run=client -f file.yaml`\n4. `kubesec scan file.yaml`\n5. Manual security context review\n\n**For bash scripts:**\n1. Header with objective + variables + actions\n2. Copilot generates the body\n3. Review line by line\n4. Test with dev/staging data\n5. Add error handling manually\n\n**Golden rule:**\nCopilot accelerates, you review.\nNever to production without validation.'
    }
  ],
  lab: {
    scenario: 'You are a DevOps Engineer who needs to set up infrastructure for a new microservice. You will use the GitHub Copilot CLI and Chat to accelerate the creation of Kubernetes manifests, a Terraform module, and a deploy script — all in record time.',
    objective: 'Master the use of the GitHub Copilot CLI (`gh copilot suggest`/`explain`) and learn to write "specs via comment" to generate high-quality YAML and HCL with Copilot.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Install and verify Copilot CLI',
        instruction: `Install the GitHub Copilot extension for the \`gh\` CLI and verify it is working correctly.`,
        hints: [
          'Use `gh extension install github/gh-copilot`',
          'Make sure you are authenticated: `gh auth status`',
          'If gh is not installed: https://cli.github.com'
        ],
        solution: `\`\`\`bash
# Authenticate to GitHub CLI (if needed)
gh auth login

# Install Copilot extension
gh extension install github/gh-copilot

# Verify installation
gh copilot --version
gh copilot --help

# Configure aliases (add to .bashrc/.zshrc)
echo 'alias "??=gh copilot suggest -t shell"' >> ~/.bashrc
source ~/.bashrc
\`\`\``,
        verify: `\`\`\`bash
# Verify the extension is installed
gh extension list | grep copilot

# Expected output:
# gh copilot  github/gh-copilot  vX.X.X

# Test a simple suggest
gh copilot suggest "list all kubernetes namespaces"
# Expected output: a valid kubectl command (not an auth error)
\`\`\``
      },
      {
        title: 'Use Copilot CLI for kubectl commands',
        instruction: `Use \`gh copilot suggest\` to generate the following commands without memorizing them:
1. List all pods in crashloopbackoff in any namespace
2. Get logs from the last 5 minutes of a specific pod
3. Find the top 5 pods consuming the most memory in the cluster
4. Explain a complex kubectl command you don't understand`,
        hints: [
          'Use `gh copilot suggest -t shell "..."` for shell suggestions',
          'Use `gh copilot explain "<command>"` to explain commands',
          'Describe what you want in English'
        ],
        solution: `\`\`\`bash
# 1. Pods in CrashLoopBackOff
gh copilot suggest -t shell "list all pods in crashloopbackoff across all namespaces"
# Expected result similar to:
kubectl get pods -A --field-selector=status.phase!=Running | grep CrashLoop
# OR
kubectl get pods -A | grep CrashLoopBackOff

# 2. Logs from the last 5 minutes
gh copilot suggest -t shell "get kubernetes pod logs from the last 5 minutes"
# Expected result:
kubectl logs <pod-name> --since=5m

# 3. Top 5 pods by memory
gh copilot suggest -t shell "get top 5 kubernetes pods by memory usage"
# Expected result:
kubectl top pods -A --sort-by=memory | head -6

# 4. Explain a complex command
gh copilot explain "kubectl get pods -o jsonpath='{range .items[*]}{.metadata.name}{\"\t\"}{.status.phase}{\"\n\"}{end}'"
\`\`\``,
        verify: `\`\`\`bash
# Verify that copilot CLI responds
gh copilot suggest -t shell "get all kubernetes namespaces" 2>&1
# Expected output: a valid kubectl command (not an auth error)

# Test the explain
gh copilot explain "kubectl get nodes -o wide" 2>&1
# Expected output: explanation of what the command does
\`\`\``
      },
      {
        title: 'Generate Kubernetes YAML with "Spec via Comment"',
        instruction: `Create a \`payment-service.yaml\` file using the "spec via comment" technique with Copilot in VS Code (or edit manually if you don't have VS Code). The file should contain a Deployment and Service for the payment service with the following requirements:
- 3 replicas, RollingUpdate with maxUnavailable=0
- Image: mycompany/payment-service:v1.2.0
- CPU: request 200m, limit 1000m; Memory: request 256Mi, limit 512Mi
- Liveness probe HTTP /health port 8080, delay 30s
- Readiness probe HTTP /ready port 8080, delay 10s
- ClusterIP Service on port 80 → 8080`,
        hints: [
          'Write the full comment BEFORE starting the YAML',
          'In VS Code, after the comment, start with `apiVersion:` and press Tab',
          'If without VS Code, use the manual template below as reference',
          'The goal is to practice the technique, not achieve a perfect result'
        ],
        solution: `\`\`\`yaml
# payment-service.yaml
# Deployment for payment-service
# - 3 replicas, RollingUpdate: maxSurge=1, maxUnavailable=0
# - Image: mycompany/payment-service:v1.2.0
# - Resources: request 200m/256Mi, limit 1000m/512Mi
# - Liveness: GET /health:8080 delay=30s period=10s
# - Readiness: GET /ready:8080 delay=10s period=5s
# - Labels: app=payment-service, version=v1.2.0, tier=backend
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payment-service
  labels:
    app: payment-service
    version: v1.2.0
    tier: backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: payment-service
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: payment-service
        version: v1.2.0
        tier: backend
    spec:
      containers:
      - name: payment-service
        image: mycompany/payment-service:v1.2.0
        ports:
        - containerPort: 8080
        resources:
          requests:
            cpu: "200m"
            memory: "256Mi"
          limits:
            cpu: "1000m"
            memory: "512Mi"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
---
# Service ClusterIP for payment-service
# Port 80 -> container 8080
apiVersion: v1
kind: Service
metadata:
  name: payment-service
  labels:
    app: payment-service
spec:
  type: ClusterIP
  selector:
    app: payment-service
  ports:
  - port: 80
    targetPort: 8080
    protocol: TCP
\`\`\``,
        verify: `\`\`\`bash
# Validate YAML without a cluster
kubectl apply --dry-run=client -f payment-service.yaml
# Expected output:
# deployment.apps/payment-service created (dry run)
# service/payment-service created (dry run)

# If cluster is available:
kubectl apply -f payment-service.yaml
kubectl get deployment payment-service
# Expected output: READY 3/3
\`\`\``
      },
      {
        title: 'Use Copilot for Debug and Troubleshooting',
        instruction: `Practice using Copilot CLI to diagnose common issues. For each scenario below, use \`gh copilot suggest\` to generate the diagnostic command:
1. A pod is in Pending state — how to investigate?
2. A Service is not receiving traffic — how to debug?
3. A node is NotReady — how to investigate?`,
        hints: [
          'Be specific in the description: "kubernetes pod stuck in pending state - investigate why"',
          'Use explain to understand suggested commands',
          'Combine with "step by step" in the description to get a sequence of commands'
        ],
        solution: `\`\`\`bash
# 1. Pod in Pending
gh copilot suggest -t shell "kubernetes pod stuck in pending - step by step investigation"
# Expected commands similar to:
kubectl describe pod <pod-name> | grep -A 10 Events
kubectl get events --sort-by=.metadata.creationTimestamp
kubectl describe nodes | grep -A 5 "Allocated resources"

# 2. Service without traffic
gh copilot suggest -t shell "kubernetes service not receiving traffic - debug endpoints and selectors"
# Expected commands similar to:
kubectl get endpoints <service-name>
kubectl describe service <service-name>
kubectl get pods -l app=<app-label>

# 3. Node NotReady
gh copilot suggest -t shell "kubernetes node notready - investigate causes"
# Expected commands similar to:
kubectl describe node <node-name>
kubectl get node <node-name> -o yaml | grep -A 20 conditions
# On the node (via SSH):
systemctl status kubelet
journalctl -u kubelet -n 50
\`\`\``,
        verify: `\`\`\`bash
# Verify that Copilot commands are executable
# Test the first set (pod pending) with a real or test pod:
kubectl run test-pod --image=nginx --dry-run=client -o yaml | kubectl apply -f -
kubectl get pod test-pod
kubectl describe pod test-pod | grep -A 5 Events

# Clean up
kubectl delete pod test-pod --ignore-not-found=true
# Expected output: pod "test-pod" deleted
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Copilot suggests Terraform resources with outdated provider versions',
      difficulty: 'easy',
      symptom: 'Copilot generated a Terraform module with `aws_eks_cluster` using attributes that no longer exist in the current version of the `hashicorp/aws` provider, causing errors in `terraform plan`.',
      diagnosis: `\`\`\`bash
# 1. Check which provider version is being used
cat versions.tf | grep -A 5 required_providers

# 2. See the latest version in Terraform Registry
# https://registry.terraform.io/providers/hashicorp/aws/latest

# 3. Check the specific error
terraform init
terraform validate
# Output: An argument named "X" is not expected here.

# 4. Check the real resource documentation
# https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/eks_cluster
\`\`\``,
      solution: `**Cause:** Copilot was trained with data up to a certain date. The AWS Terraform provider is updated frequently — attributes change, blocks are added/removed.

**Solution 1 — Check the Registry:**
\`\`\`bash
# Always check the real resource documentation in the Registry
# Open: https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/<resource>
\`\`\`

**Solution 2 — Improve the Copilot prompt:**
\`\`\`
# Add the provider version in the comment
# EKS cluster - use hashicorp/aws provider v5.x
# Reference: https://registry.terraform.io/providers/hashicorp/aws/5.0.0
\`\`\`

**Solution 3 — Validate automatically:**
\`\`\`bash
terraform init -upgrade  # Updates providers
terraform validate       # Validates syntax and types
# Fix wrong attributes manually
\`\`\`

**Prevention:** always pin provider versions and validate against the Registry before committing.`
    },
    {
      title: 'Copilot Chat loses context in long debugging conversations',
      difficulty: 'medium',
      symptom: 'You are using Copilot Chat to debug a complex problem. After several messages exchanging logs and configs, Copilot starts giving generic suggestions that ignore previous context — as if it "forgot" the original problem.',
      diagnosis: `\`\`\`bash
# Signs that context was lost:
# 1. Copilot repeats suggestions you already tried
# 2. Ignores constraints you mentioned before
# 3. Gives generic "kubectl describe pod" answers
#    even after you shared the output

# There is no direct command to verify this,
# but the behavioral observation is clear
\`\`\``,
      solution: `**Cause:** Copilot Chat has a limited context window. Long conversations with lots of text (logs, YAMLs) consume context quickly, and the model "forgets" the beginning.

**Solution 1 — Context summary:**
\`\`\`
# When you notice context loss, add an "anchor":
"Summary of problem so far:
- Service: payment-api in namespace prod
- Symptom: sporadic 503 every ~5 min
- Already tried: pod restart, replica increase
- Current suspicion: connection pool exhaustion
Based on this, how to investigate the connection pool?"
\`\`\`

**Solution 2 — New conversation with compressed context:**
\`\`\`
# Start a new conversation with summarized context
"Context: Kubernetes 1.29, EKS, payment-api in Node.js.
Problem: sporadic 503. Logs show: [paste only the relevant lines]
Current config: [paste only the relevant YAML section]
Question: ..."
\`\`\`

**Solution 3 — Use files as context instead of pasting in chat:**
\`\`\`
# Instead of pasting 200 lines of log in the chat:
#file:payment-api-logs.txt Analyze only lines with ERROR or WARN
\`\`\`

**Prevention:** debugging conversations should be focused — one conversation per problem, with minimum necessary context.`
    }
  ]
};
