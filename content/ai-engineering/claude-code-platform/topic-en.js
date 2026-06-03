window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['ai-engineering/claude-code-platform'] = {
  theory: `
# Claude Code & Agents for Platform Engineering

## Relevance
Claude Code is Anthropic's CLI that transforms your terminal into an AI agent that understands code, executes commands, and interacts with the filesystem. For Platform Engineers and SREs, it goes beyond a chat interface — it's a collaborator that can iterate over infrastructure, create content, debug issues, and integrate with tools via MCP servers. This very study platform is a real case created with Claude Code.

## What Claude Code Is

### Core concept

\`\`\`
Claude Code = Powerful LLM + filesystem access + command execution + persistent context
\`\`\`

Unlike a web interface, Claude Code:
- **Reads and writes files** in your project directly
- **Executes commands** (bash, kubectl, terraform, git)
- **Maintains context** across the entire conversation + files read
- **Iterates** — acts, checks result, adjusts, repeats
- **Integrates tools** via MCP (Model Context Protocol)

### When to use Claude Code vs Copilot Chat

\`\`\`
GitHub Copilot Chat         Claude Code
────────────────────────    ─────────────────────────────
Inline autocomplete         Multi-file tasks
Quick questions             Complex refactoring
Current file context        Entire project context
One file at a time          Create/edit/delete multiple files
No command execution        Executes commands and validates results
No MCP/integrations         MCP: kubectl, terraform, GitHub, etc.
\`\`\`

## Installation and Setup

\`\`\`bash
# Install Claude Code
npm install -g @anthropic-ai/claude-code

# Verify installation
claude --version

# Authenticate (opens browser for OAuth)
claude auth login

# Start in the project directory
cd /my/project
claude
\`\`\`

### First initialization — CLAUDE.md

The \`CLAUDE.md\` file is the "briefing" that Claude Code automatically reads when starting in a project. It is the central mechanism for persistent context.

\`\`\`markdown
# My Project — Context for Claude Code

## Project Context
- Stack: Kubernetes 1.29, Helm 3.14, ArgoCD, Prometheus
- Cloud: AWS EKS in us-east-1
- Team: 5 engineers, deploy 3x/week

## Conventions
- Namespaces: <team>-<environment> (e.g., payments-prod)
- Required labels: app, version, team, env
- Never use latest as image tag

## Useful Commands
\`\`\`bash
make deploy ENV=staging          # staging deploy
kubectl config use-context prod  # switch to prod
\`\`\`

## Restrictions
- NEVER kubectl delete in production without confirming
- NEVER hardcode credentials in files
- Always use dry-run before applying changes in prod
\`\`\`

**Golden rule:** the more specific the CLAUDE.md, the more autonomous and relevant the agent's behavior.

## Skills (Slash Commands)

Skills are custom commands you create for recurring tasks. They live in \`.claude/commands/\` or \`~/.claude/commands/\` (global).

### Skill structure

\`\`\`markdown
<!-- .claude/commands/my-skill.md -->
# Skill Name

Description of what it does.

## Expected Input
$ARGUMENTS

## What to do
1. Read file X
2. Generate Y
3. Validate with Z
\`\`\`

### Example skills for DevOps

\`\`\`bash
# Folder structure
.claude/commands/
├── add-topic.md          # adds topic to study platform
├── k8s-review.md         # reviews YAML for security
├── incident-report.md    # generates incident report
├── terraform-module.md   # creates Terraform module
└── deploy-checklist.md   # pre-deploy checklist
\`\`\`

\`\`\`markdown
<!-- .claude/commands/k8s-review.md -->
# Kubernetes YAML Security Review

You are a Kubernetes security expert.

Analyze the file $ARGUMENTS and identify:
1. Containers running as root (runAsNonRoot: false or absent)
2. Privilege escalation allowed (allowPrivilegeEscalation: true)
3. Missing resource limits
4. Missing liveness/readiness probes
5. Image tag "latest" in use

Return a list with severity (HIGH/MEDIUM/LOW) and the exact fix.
\`\`\`

\`\`\`bash
# Usage
/k8s-review deployment.yaml
/k8s-review helm/templates/
\`\`\`

## MCP Servers — Integrating Tools

MCP (Model Context Protocol) allows Claude Code to interact with external tools as if they were native extensions. The model gains "tooling" that goes beyond the filesystem.

### Configure MCP servers

\`\`\`json
// .claude/settings.json or ~/.claude/settings.json
{
  "mcpServers": {
    "kubernetes": {
      "command": "npx",
      "args": ["-y", "@mcp-servers/kubernetes"],
      "env": {
        "KUBECONFIG": "~/.kube/config"
      }
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "ghp_xxx"
      }
    },
    "terraform": {
      "command": "npx",
      "args": ["-y", "@mcp-servers/terraform"]
    }
  }
}
\`\`\`

### What becomes possible with MCP

\`\`\`bash
# With kubernetes MCP:
"List all pods in error state in the prod namespace"
"What is the CPU consumption of the cluster nodes?"
"Show recent events from the payments namespace"

# With github MCP:
"List open PRs with failing CI"
"Create an issue describing the bug we found"
"What was the last commit that touched deployment.yaml?"

# With terraform MCP:
"Show the current state of the eks module"
"What resources would be created if I apply this plan?"
\`\`\`

## Agentic Workflows for Platform Engineering

### Workflow 1: Create and Validate Infrastructure

\`\`\`bash
# Agentic prompt (automatic multi-step)
"Create a Terraform module for a PostgreSQL RDS with:
- Multi-AZ enabled
- 7-day backup retention
- Encryption at rest
- Security group for EKS-only access
Then validate with terraform validate and show the summarized plan."

# Claude Code will:
# 1. Create main.tf, variables.tf, outputs.tf
# 2. Run terraform init
# 3. Run terraform validate
# 4. Run terraform plan -compact-warnings
# 5. Show summary of what would be created
\`\`\`

### Workflow 2: Incident Debug

\`\`\`bash
# With kubernetes MCP active
"We have high latency on the payments service since 14:30.
1. Check the pods in the payments namespace
2. Check recent events
3. View logs from the last 30 minutes
4. Compare with yesterday's state
Suggest the 3 most likely causes and how to investigate each."
\`\`\`

### Workflow 3: Technical Content Generation

\`\`\`bash
# This very platform was created this way
"Add a new topic about Cilium Network Policies:
- Theory with functional YAML examples
- 7 quiz questions with explanations
- 6 flashcards
- Hands-on lab with 4 steps and verify
- 2 troubleshooting scenarios
Follow the exact format of existing topics in content/networking/"
\`\`\`

### Workflow 4: Automated Code Review

\`\`\`bash
"Review the diff from PR #142 in the myorg/platform repository:
1. Identify logic bugs
2. Check security practices
3. Check if tests cover edge cases
4. Suggest performance improvements
Format: list by file, severity HIGH/MEDIUM/LOW"
\`\`\`

## Advanced Configuration

### settings.json — configure permissions

\`\`\`json
{
  "permissions": {
    "allow": [
      "Bash(kubectl:*)",
      "Bash(helm:*)",
      "Bash(terraform:*)",
      "Bash(git:*)"
    ],
    "deny": [
      "Bash(kubectl delete:*)",
      "Bash(rm -rf:*)"
    ]
  }
}
\`\`\`

### Hooks — execute automatic actions

\`\`\`json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "echo 'File modified: $TOOL_INPUT_PATH' >> ~/.claude/audit.log"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "notify-send 'Claude Code' 'Task completed'"
          }
        ]
      }
    ]
  }
}
\`\`\`

## Best Practices for Platform Engineers

### Strategic CLAUDE.md

\`\`\`markdown
# Critical rules (always include)
- Never commit directly to main
- Always create branch for changes
- Validate YAML before applying
- Confirm before destructive operations

# Environment context (very helpful)
- Kubernetes version: 1.29
- CNI: Cilium 1.14
- Ingress: Nginx 1.9 + cert-manager
- GitOps: ArgoCD 2.9

# Project commands (avoids repeated questions)
- make test: run unit tests
- make lint: validate YAML and HCL
- make deploy ENV=<env>: deploy by environment
\`\`\`

### Iterate, don't ask

\`\`\`bash
# Instead of:
"How do I configure an HPA with custom metrics?"

# Prefer:
"Configure an HPA for the payments-api deployment that scales
based on the custom metric http_requests_per_second from Prometheus.
Create the YAML, validate it, and show how to verify it's working."
\`\`\`

### Security in sensitive contexts

\`\`\`bash
# Claude Code should NEVER have:
# - Direct access to production clusters
# - Write-permission tokens for prod
# - Database credentials

# Use separate contexts:
KUBECONFIG=~/.kube/config-dev claude    # dev only
KUBECONFIG=~/.kube/config-staging claude  # staging only

# For production: always human in the loop
\`\`\`

## This Platform as a Real Case Study

This Kubernetes study platform was entirely created and maintained with Claude Code:

\`\`\`
Structure generated by Claude Code:
├── index.html              ← platform HTML/JS engine
├── CLAUDE.md               ← persistent project context
├── .claude/commands/       ← custom skills
│   └── kubernetes-add-topic.md
└── content/                ← all AI-generated content
    ├── registry.js         ← central index
    └── <domain>/<topic>/
        ├── topic.js        ← PT content
        └── topic-en.js     ← EN content
\`\`\`

The \`/kubernetes-add-topic\` skill defines the exact expected format and Claude Code generates new content following the structure without needing to re-read the entire platform code each time.

## Common Mistakes

1. **Empty or generic CLAUDE.md** — without context, the agent asks questions or assumes incorrectly
2. **Too open-ended tasks** — "improve the project" without defining what "better" means
3. **No security restrictions** — not defining what the agent CANNOT do
4. **Not using MCP** — asking questions about cluster state without MCP is inefficient
5. **Long conversation context** — start a new conversation for unrelated tasks

## Killer.sh Style Challenge

> **Scenario:** You need to implement an agentic workflow with Claude Code to automate incident runbook generation. Define:
> 1. The content of the CLAUDE.md for this project
> 2. The \`.claude/commands/generate-runbook.md\` file
> 3. What the prompt would look like to generate a runbook for "pod CrashLoopBackOff in production"
`,
  quiz: [
    {
      question: 'What is the main difference between GitHub Copilot Chat and Claude Code for infrastructure tasks?',
      options: [
        'Copilot uses GPT-4, Claude Code uses Claude — the difference is just the model',
        'Claude Code can read/write multiple files, execute commands, maintain context for the entire project, and integrate tools via MCP — Copilot Chat is limited to the current file and doesn\'t execute commands',
        'Copilot is more expensive than Claude Code',
        'Claude Code only works online, Copilot works offline'
      ],
      correct: 1,
      explanation: 'The difference is architectural, not just about the model. Claude Code is an agentic agent with filesystem access, command execution, and MCP integration. It can create 20 files, run terraform plan, check the result, adjust, and repeat — all autonomously. Copilot Chat is a conversation assistant limited to the editor\'s context.',
      reference: 'Related concept: "agentic agent" = LLM with tools that can iterate over actions in a loop, not just respond once.'
    },
    {
      question: 'What is the purpose of the CLAUDE.md file in a project?',
      options: [
        'It\'s a JSON configuration file for the CLI',
        'It\'s the persistent "briefing" that Claude Code automatically reads on startup — defines project context, conventions, restrictions, and useful commands, avoiding repetition in every conversation',
        'It\'s a log file of interactions with Claude',
        'It\'s optional — Claude Code works the same without it'
      ],
      correct: 1,
      explanation: 'CLAUDE.md is the persistent context mechanism for Claude Code. Without it, the agent doesn\'t know: which Kubernetes version you use, what the project conventions are, what it should never do (e.g., delete in prod), or what commands exist. With a well-written CLAUDE.md, the agent acts like a colleague who already knows the project.',
      reference: 'Tip: CLAUDE.md should have: project context, conventions, critical security restrictions, and useful project commands.'
    },
    {
      question: 'What are MCP Servers in the context of Claude Code?',
      options: [
        'Remote servers that host the Claude model',
        'Extensions that give Claude Code access to external tools like kubectl, terraform, GitHub — expanding what the agent can do beyond local files',
        'VS Code plugins that integrate with Claude',
        'Security settings to restrict Claude\'s actions'
      ],
      correct: 1,
      explanation: 'MCP (Model Context Protocol) is a standard protocol for integrating tools into Claude Code. With a kubernetes MCP server, Claude can query the real cluster state. With GitHub MCP, it can list PRs, create issues, comment. This transforms Claude Code from a file editor into an agent that interacts with the complete DevOps ecosystem.',
      reference: 'Analogy: MCP servers are to Claude Code what plugins are to VS Code — each one adds a new capability.'
    },
    {
      question: 'How does a "skill" (slash command) improve Claude Code usage for recurring tasks?',
      options: [
        'Skills are just keyboard shortcuts — they have no quality impact',
        'Skills define precise, reusable instructions for recurring tasks, ensuring Claude always follows the same process and format — eliminating the need to rewrite complex prompts every time',
        'Skills execute code automatically without involving Claude',
        'Skills only work with active MCP servers'
      ],
      correct: 1,
      explanation: 'A skill is essentially a persistent prompt template with specific instructions. Instead of writing "you are a K8s security expert, analyze this file looking for containers as root, privilege escalation..." every time, you write it once in the skill file and use `/k8s-review deployment.yaml`. Especially valuable for teams — everyone uses the same standard.',
      reference: 'Location: project skills go in `.claude/commands/`, global skills in `~/.claude/commands/`.'
    },
    {
      question: 'Which settings.json configuration is most important for security when using Claude Code with Kubernetes cluster access?',
      options: [
        'Increasing request timeouts',
        'Configuring `permissions.deny` to block destructive commands like `kubectl delete` and `rm -rf`, ensuring the agent never executes irreversible actions without manual confirmation',
        'Disabling the kubernetes MCP server',
        'Limiting the number of tokens per conversation'
      ],
      correct: 1,
      explanation: 'The `permissions.deny` configuration is the most critical security barrier. An agentic agent can chain multiple actions — if it interprets "clean up old pods" as `kubectl delete pods --all`, that can be catastrophic. Explicitly blocking destructive commands is the safest way to operate. Combine with using separate cluster contexts (dev/staging only).',
      reference: 'Complementary practice: never configure the production KUBECONFIG in the environment where Claude Code operates autonomously.'
    },
    {
      question: 'What makes an agentic workflow more effective than a series of individual questions to Claude Code?',
      options: [
        'Agentic workflows are faster because they use fewer tokens',
        'An agentic workflow is a single instruction defining objective, actions, and validation criteria — Claude Code iterates autonomously (creates file, tests, adjusts, verifies) without human approval at each step',
        'Agentic workflows only work with MCP servers',
        'There is no practical difference — the result is the same'
      ],
      correct: 1,
      explanation: 'Instead of: (1) "create main.tf" → review → (2) "now validate" → review → (3) "fix error X" → review; an agentic workflow is: "create the Terraform module for RDS, validate it, fix any errors, and show the result". Claude chains the actions automatically. This saves human cycles and is especially valuable for tasks with many predefined steps.',
      reference: 'Analogy: agentic workflow is like giving an objective instead of micromanaging each step — the agent solves the "how".'
    },
    {
      question: 'Why is this Kubernetes study platform a good example of a Claude Code use case?',
      options: [
        'Because it was hosted on Anthropic\'s servers',
        'Because it requires creating dozens of files following a precise format, validating structure, updating a central registry — multi-file and multi-step tasks ideal for an agent with filesystem access and persistent context via CLAUDE.md',
        'Because it uses the Claude 3.5 model to render content',
        'Because it only has Kubernetes content — the only domain Claude knows well'
      ],
      correct: 1,
      explanation: 'This platform has a complex structured pattern: each topic requires theory/quiz/flashcards/lab/troubleshooting in a specific format, central registry update, and consistency with existing topics. These are exactly the type of repetitive-but-complex tasks where Claude Code excels: reads existing files to understand the pattern, generates new content following the same structure, and updates the registry — all in a single instruction.',
      reference: 'Tip: the `/kubernetes-add-topic` skill of this platform is a real example of how to encapsulate complex logic in a reusable skill.'
    }
  ],
  flashcards: [
    {
      front: 'Claude Code — what it is and how it differs from Copilot',
      back: '**Claude Code = Agentic CLI Agent**\n\n**Capabilities:**\n- Reads and writes local files\n- Executes commands (bash, kubectl, git, etc)\n- Iterates: acts → verifies → adjusts → repeats\n- Entire project context via CLAUDE.md\n- Integrates tools via MCP servers\n\n**vs GitHub Copilot Chat:**\n\n| Copilot Chat | Claude Code |\n|-------------|-------------|\n| File context | Project context |\n| No cmd execution | Executes commands |\n| One file | Multiple files |\n| No MCP | MCP servers |\n| Single response | Agentic loop |\n\n**Installation:**\n`npm install -g @anthropic-ai/claude-code`\n`claude auth login`\n`cd project && claude`'
    },
    {
      front: 'CLAUDE.md — the agent\'s briefing',
      back: '**What it is:**\nMarkdown file that Claude Code reads\nautomatically at project startup.\nDefines persistent session context.\n\n**Recommended structure:**\n\`\`\`markdown\n# Project X — Context for Claude Code\n\n## Stack\n- K8s 1.29, Helm 3.14, ArgoCD\n- AWS EKS us-east-1\n\n## Conventions\n- Labels: app, version, team, env\n- Namespaces: <team>-<env>\n\n## Critical Restrictions\n- NEVER kubectl delete without confirming\n- NEVER hardcode credentials\n- Always dry-run in prod\n\n## Commands\n- make test: unit tests\n- make deploy ENV=X: deploy\n\`\`\`\n\n**Rule:** more specific = more autonomous\nand relevant agent behavior.'
    },
    {
      front: 'Skills (Slash Commands) — reusing complex prompts',
      back: '**Location:**\n- `.claude/commands/` → project\n- `~/.claude/commands/` → global\n\n**Format:**\n\`\`\`markdown\n# Skill Name\nDescription of what it does.\n\n## Input\n$ARGUMENTS\n\n## Instructions\n1. Step 1\n2. Step 2\n3. Validate with X\n\`\`\`\n\n**Usage in terminal:**\n`/k8s-review deployment.yaml`\n`/incident-report "high latency in prod"`\n`/add-topic domain:networking topic:cilium`\n\n**DevOps use cases:**\n- `/k8s-review` → YAML security audit\n- `/terraform-module` → module scaffold\n- `/incident-report` → generate postmortem\n- `/deploy-checklist` → pre-deploy validation\n- `/add-topic` → new topic on the platform'
    },
    {
      front: 'MCP Servers — integrating tools into Claude Code',
      back: '**What MCP is:**\nModel Context Protocol — protocol to\ngive the agent "tools" beyond the filesystem.\n\n**Configuration (.claude/settings.json):**\n\`\`\`json\n{\n  "mcpServers": {\n    "kubernetes": {\n      "command": "npx",\n      "args": ["-y", "@mcp-servers/kubernetes"]\n    },\n    "github": {\n      "command": "npx",\n      "args": ["-y", "@mcp/server-github"],\n      "env": {"GITHUB_TOKEN": "ghp_xxx"}\n    }\n  }\n}\n\`\`\`\n\n**With kubernetes MCP active:**\n- "List error pods in prod"\n- "What is the nodes\' CPU usage?"\n- "Show events from the last incident"\n\n**With github MCP:**\n- "Open PRs with failing CI"\n- "Create issue about this bug"\n- "Who modified this file?"'
    },
    {
      front: 'Agentic Workflows — practical examples',
      back: '**Create infrastructure + validate:**\n\`\`\`\n"Create Terraform module for RDS with\nMulti-AZ, 7d backup, encryption.\nValidate and show summarized plan."\n\`\`\`\n→ Claude creates files, runs terraform\n  init+validate+plan, shows result\n\n**Incident debug (with MCP k8s):**\n\`\`\`\n"High latency in payments since 14:30.\nCheck pods, events, 30min logs.\nSuggest 3 most likely causes."\n\`\`\`\n\n**Content generation:**\n\`\`\`\n"Add topic about Cilium:\ntheory + quiz + flashcards + lab.\nFollow format from content/networking/"\n\`\`\`\n\n**Principle:** a single instruction with\ncomplete objective → Claude iterates\nautonomously to the desired result.'
    },
    {
      front: 'Security when using Claude Code for infra',
      back: '**Permissions (settings.json):**\n\`\`\`json\n{\n  "permissions": {\n    "allow": ["Bash(kubectl get:*)",\n              "Bash(helm:*)",\n              "Bash(git:*)" ],\n    "deny": ["Bash(kubectl delete:*)",\n             "Bash(rm -rf:*)"]\n  }\n}\n\`\`\`\n\n**Security principles:**\n- Never configure prod kubeconfig\n  in autonomous Claude Code environment\n- Use separate contexts: dev/staging only\n- MCP with read-only tokens for prod\n- Human in the loop for irreversible actions\n\n**CLAUDE.md with restrictions:**\n\`\`\`markdown\n## Critical Restrictions\n- NEVER kubectl delete without confirming\n- NEVER modify secrets\n- Always dry-run before apply in prod\n\`\`\`\n\n**Hooks for auditing:**\nLog all actions to an audit trail.'
    }
  ],
  lab: {
    scenario: 'You will configure Claude Code for a Kubernetes platform project, create a strategic CLAUDE.md, develop a security review skill, and execute an agentic workflow for manifest generation.',
    objective: 'Configure Claude Code with project context via CLAUDE.md, create custom skills, and execute agentic workflows for DevOps tasks.',
    duration: '30-40 minutes',
    steps: [
      {
        title: 'Install and configure Claude Code',
        instruction: `Install Claude Code, authenticate, and create the initial structure for a Kubernetes platform project.`,
        hints: [
          'You need Node.js 18+ installed',
          'Authentication uses OAuth via browser',
          'The `claude` command starts the interactive agent in the current directory'
        ],
        solution: `\`\`\`bash
# 1. Install Claude Code globally
npm install -g @anthropic-ai/claude-code

# 2. Verify installation
claude --version

# 3. Authenticate (opens browser for OAuth)
claude auth login

# 4. Create project structure
mkdir -p platform-infra/.claude/commands
cd platform-infra

# 5. Verify Claude initializes
claude --help
\`\`\``,
        verify: `\`\`\`bash
# Verify installation
claude --version
# Expected output: @anthropic-ai/claude-code vX.X.X

# Verify authentication
ls ~/.claude/
# Expected output: should have config/token file

# Project structure
ls -la platform-infra/.claude/
# Expected output:
# drwxr-xr-x  commands/
\`\`\``
      },
      {
        title: 'Create a strategic CLAUDE.md',
        instruction: `Create the \`CLAUDE.md\` file for a Kubernetes platform project with the following elements:
- Project context (stack, cloud, team)
- Naming conventions
- Critical security restrictions
- Useful project commands
- Cluster environment information`,
        hints: [
          'CLAUDE.md goes in the project root',
          'Be specific about tool versions',
          'Security restrictions are the most important'
        ],
        solution: `\`\`\`bash
cat > platform-infra/CLAUDE.md << 'EOF'
# Platform Infra — Context for Claude Code

## Project Context
- **Stack:** Kubernetes 1.29, Helm 3.14, ArgoCD 2.9, Prometheus/Grafana
- **Cloud:** AWS EKS in us-east-1 and us-west-2
- **Team:** Platform Engineering (5 eng), deploy 3x/week
- **GitOps:** ArgoCD manages all deploys — never kubectl apply directly in prod

## Required Conventions
- Namespaces: \`<team>-<env>\` (e.g., payments-prod, auth-staging)
- Required labels: \`app\`, \`version\`, \`team\`, \`env\`, \`managed-by\`
- Image tags: never use \`latest\` — always semantic version or SHA
- Resources: always define both requests AND limits on all containers
- Probes: liveness AND readiness on all workloads

## Critical Security Restrictions
- **NEVER** run \`kubectl delete\` without explicit user confirmation
- **NEVER** hardcode credentials, tokens, or passwords in files
- **NEVER** use \`privileged: true\` or \`allowPrivilegeEscalation: true\`
- **ALWAYS** use dry-run before applying changes to staging/prod
- **NEVER** commit directly to main — always create branch + PR

## Project Commands
\`\`\`bash
make test           # Run unit tests
make lint           # Validate YAML and HCL (kubeval + tfsec)
make deploy ENV=X   # Deploy to environment X
make plan ENV=X     # Terraform plan for environment X
\`\`\`

## Cluster Environments
- dev: kubeconfig at ~/.kube/config-dev — can use without restriction
- staging: kubeconfig at ~/.kube/config-staging — dry-run first
- prod: NEVER configure in Claude Code environment

## Repository Structure
\`\`\`
platform-infra/
├── manifests/          # Kubernetes YAML by namespace
├── helm/               # Internal Helm charts
├── terraform/          # Terraform modules
│   ├── modules/        # Reusable modules
│   └── environments/   # Config per environment
└── scripts/            # Automation scripts
\`\`\`
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verify the file was created
cat platform-infra/CLAUDE.md

# The file should have the following sections:
grep -E "^## " platform-infra/CLAUDE.md
# Expected output:
# ## Project Context
# ## Required Conventions
# ## Critical Security Restrictions
# ## Project Commands
# ## Cluster Environments
# ## Repository Structure

wc -l platform-infra/CLAUDE.md
# Expected output: more than 40 lines
\`\`\``
      },
      {
        title: 'Create a Kubernetes security review skill',
        instruction: `Create the skill file \`.claude/commands/k8s-security-review.md\` that instructs Claude to review Kubernetes manifests for security issues.`,
        hints: [
          'Skills go in `.claude/commands/` inside the project',
          'Use `$ARGUMENTS` to receive the file or directory as argument',
          'Be specific about the expected output format'
        ],
        solution: `\`\`\`bash
cat > platform-infra/.claude/commands/k8s-security-review.md << 'EOF'
# Kubernetes Security Review

You are a Kubernetes security expert with experience in CIS Benchmarks and the NSA Kubernetes Hardening Guide.

Analyze the file or directory: $ARGUMENTS

## Required Checks

### Critical (HIGH)
- [ ] Container running as root (runAsNonRoot absent or false)
- [ ] Privilege escalation enabled (allowPrivilegeEscalation: true)
- [ ] Unnecessary capabilities (CAP_SYS_ADMIN, CAP_NET_ADMIN, etc)
- [ ] HostPID, HostNetwork, or HostIPC enabled
- [ ] hostPath volume for sensitive directories (/etc, /var/run/docker.sock)

### Important (MEDIUM)
- [ ] Missing resource limits (CPU and Memory)
- [ ] Missing liveness or readiness probe
- [ ] ServiceAccount with excessive permissions
- [ ] Image using "latest" tag or without SHA digest
- [ ] Missing SeccompProfile

### Improvements (LOW)
- [ ] ReadOnlyRootFilesystem not configured
- [ ] PodAntiAffinity not configured for critical workloads
- [ ] Missing owner/team annotation
- [ ] No NetworkPolicy

## Response Format

For each issue found, return:
1. **[SEVERITY]** Issue name
   - File: filename.yaml, approximate line
   - Current: what is configured (or absent)
   - Correct: what it should be
   - YAML fix:
   \`\`\`yaml
   # exact fix
   \`\`\`

End with a summary: X HIGH issues, Y MEDIUM, Z LOW.
Suggest the fix order by priority.
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verify the skill was created
ls platform-infra/.claude/commands/
# Expected output: k8s-security-review.md

cat platform-infra/.claude/commands/k8s-security-review.md
# Should contain: HIGH/MEDIUM/LOW check sections and response format

echo "Skill created successfully"
\`\`\``
      },
      {
        title: 'Execute an agentic manifest generation workflow',
        instruction: `Create an instruction file for an agentic workflow that generates a complete set of Kubernetes manifests for a microservice. Claude Code should:
1. Create Deployment, Service, HPA, and NetworkPolicy
2. Validate each manifest with kubectl dry-run
3. Generate a summary of what was created`,
        hints: [
          'Describe the complete objective in one instruction, not in separate steps',
          'Claude Code will create the files, run validations, and report',
          'If you have Claude Code available, test interactively'
        ],
        solution: `\`\`\`bash
# Create the workflow instruction file
mkdir -p platform-infra/manifests/api-service

cat > platform-infra/manifests/api-service/GENERATE.md << 'EOF'
# Workflow: Generate Manifests for api-service

## Instruction for Claude Code

Create the complete set of Kubernetes manifests for the api-service microservice:

### Specifications
- Namespace: backend-prod
- Image: mycompany/api-service:v2.1.0
- Port: 8080 (HTTP)
- Replicas: minimum 2, maximum 20
- CPU: request 250m, limit 1000m
- Memory: request 256Mi, limit 512Mi
- Health endpoint: GET /health (liveness and readiness)

### Files to Create
1. deployment.yaml — Deployment with securityContext and probes
2. service.yaml — ClusterIP on port 80 -> 8080
3. hpa.yaml — HPA based on CPU (70% target)
4. networkpolicy.yaml — Allow ingress only from ingress-nginx namespace

### Validation
After creating each file, run:
kubectl apply --dry-run=client -f <file>

### Final Summary
List all created resources and confirm they passed dry-run.
EOF
\`\`\`

\`\`\`yaml
# Expected result — deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-service
  namespace: backend-prod
  labels:
    app: api-service
    version: v2.1.0
    team: backend
    env: prod
    managed-by: platform-engineering
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api-service
  template:
    metadata:
      labels:
        app: api-service
        version: v2.1.0
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
      containers:
      - name: api-service
        image: mycompany/api-service:v2.1.0
        ports:
        - containerPort: 8080
        resources:
          requests:
            cpu: "250m"
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
            path: /health
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
\`\`\``,
        verify: `\`\`\`bash
# Verify final project structure
ls -R platform-infra/
# Expected output:
# platform-infra/:
# CLAUDE.md  .claude/  manifests/
#
# platform-infra/.claude/commands/:
# k8s-security-review.md
#
# platform-infra/manifests/api-service/:
# GENERATE.md

# Validate the example deployment
kubectl apply --dry-run=client -f - << 'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-service
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api-service
  template:
    metadata:
      labels:
        app: api-service
    spec:
      containers:
      - name: api-service
        image: mycompany/api-service:v2.1.0
        resources:
          requests:
            cpu: "250m"
            memory: "256Mi"
          limits:
            cpu: "1000m"
            memory: "512Mi"
EOF
# Expected output: deployment.apps/api-service created (dry run)
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Claude Code loses CLAUDE.md context during long tasks',
      difficulty: 'medium',
      symptom: 'You configured a detailed CLAUDE.md but midway through a long task with many iterations, Claude Code starts ignoring the defined conventions (e.g., creates files without required labels, or doesn\'t use project commands).',
      diagnosis: `\`\`\`bash
# 1. Check context window usage
# (no direct command, but observe behavior)

# 2. Verify if CLAUDE.md is being read
# At the start of a new session, ask explicitly:
# "Read the CLAUDE.md and confirm the project conventions"

# 3. Check if CLAUDE.md is too long
wc -l CLAUDE.md
# If > 200 lines, may be consuming too much context

# 4. Check for duplicate information in CLAUDE.md
# that unnecessarily consumes tokens
\`\`\``,
      solution: `**Cause:** in tasks with many iterations, large files, and many messages, available context decreases and the model may not re-read the CLAUDE.md. Additionally, a very extensive CLAUDE.md consumes tokens that could be used for the task.

**Solution 1 — Concise CLAUDE.md:**
Keep only the essentials. Remove long examples — reference files instead of copying content.
\`\`\`markdown
# Critical rules (max 20 lines here)
- Never kubectl delete without confirming
- Labels: app, version, team, env
- See ./docs/conventions.md for full details
\`\`\`

**Solution 2 — Context anchor mid-task:**
\`\`\`
"Before continuing, recall the conventions from CLAUDE.md:
required labels, namespace conventions, and security restrictions."
\`\`\`

**Solution 3 — Start new conversation for sub-tasks:**
Large tasks should be divided into smaller sessions. Use git to save progress between sessions.

**Solution 4 — Explicit references:**
\`\`\`
"Create the manifest following EXACTLY the conventions in CLAUDE.md,
especially required labels and prohibition of latest tag."
\`\`\``
    },
    {
      title: 'MCP server not connecting or returning permission errors',
      difficulty: 'hard',
      symptom: 'You configured the Kubernetes MCP server in settings.json but when trying to use Claude Code to query the cluster, you get "MCP server kubernetes not available" or "permission denied" when trying to list resources.',
      diagnosis: `\`\`\`bash
# 1. Check if the MCP server is installed
npx -y @mcp-servers/kubernetes --help 2>&1
# If it fails: package not found or network issue

# 2. Check the settings.json
cat ~/.claude/settings.json | python3 -m json.tool
# Check for valid JSON syntax and server config

# 3. Check the kubeconfig
kubectl get nodes --kubeconfig \$KUBECONFIG 2>&1
# Should work before testing via MCP

# 4. Check Service Account permissions
kubectl auth can-i list pods --all-namespaces 2>&1
kubectl auth can-i get nodes 2>&1
# Should return "yes"

# 5. See Claude Code logs for MCP errors
# In debug mode:
ANTHROPIC_LOG=debug claude 2>&1 | grep -i mcp
\`\`\``,
      solution: `**Common cause 1 — NPM package not found:**
\`\`\`bash
# Check if the package exists with the correct name
npm search @mcp-servers/kubernetes
# Install globally if needed
npm install -g @mcp-servers/kubernetes
\`\`\`

**Common cause 2 — Incorrect syntax in settings.json:**
\`\`\`json
// Correct:
{
  "mcpServers": {
    "kubernetes": {
      "command": "npx",
      "args": ["-y", "@mcp-servers/kubernetes"],
      "env": {
        "KUBECONFIG": "/home/user/.kube/config"
      }
    }
  }
}
// COMMON ERROR: using ~ in path — expand to absolute path
\`\`\`

**Common cause 3 — Insufficient permissions in kubeconfig:**
\`\`\`bash
# Check user permissions in the cluster
kubectl auth can-i list pods -A
kubectl auth can-i get nodes

# If "no", create a ServiceAccount with adequate permissions
# or use a kubeconfig from a user with more permissions
\`\`\`

**Common cause 4 — Invalid KUBECONFIG:**
\`\`\`bash
# Test the kubeconfig directly
kubectl get nodes --kubeconfig /path/to/kubeconfig
# If it fails here, MCP will also fail
\`\`\``
    }
  ]
};
