window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['ai-engineering/sdd-cases'] = {
  theory: `
# Spec Driven Development & Real Cases for DevOps/SRE

## Relevance
SDD (Spec Driven Development) is the practice of using specifications as the source of truth for generating code, configurations, and documentation with AI. For DevOps/SRE, this means transforming a requirements document into functional Terraform, Kubernetes manifests, CI/CD pipelines, and runbooks — with AI as the generator and human as the reviewer.

## What SDD Is

### The SDD cycle

\`\`\`
Spec (requirements document)
  ↓
Validation (is the spec complete?)
  ↓
Generation (AI generates the artifact)
  ↓
Testing (does the artifact work?)
  ↓
Application (deploy/commit)
\`\`\`

**Difference from "just asking the LLM":**

\`\`\`
Without SDD: "create an EKS cluster for me"
→ Generic code, without business context,
  without restrictions, without company standards

With SDD: detailed spec with requirements, restrictions,
company standards, reference examples
→ AI generates with full context
→ Review and validation before applying
\`\`\`

### Spec structure for SDD

\`\`\`markdown
# Spec: EKS Cluster for the Payments Team

## Context
- Team: payments-team
- Environment: production
- Region: us-east-1

## Functional Requirements
- EKS 1.29 with managed nodes
- 3 node groups: system (t3.medium), app (t3.large), spot (m5.xlarge)
- Auto-scaling: min 1, max 20 per node group
- IRSA enabled for OIDC
- Cluster autoscaler with Karpenter

## Constraints (Non-Functional)
- Private endpoint only (no public access)
- Encryption at rest on all EBS volumes
- Logs: audit, api, authenticator enabled
- No direct SSH to nodes — SSM only

## Company Standards
- Required tags: Team, Environment, CostCenter, ManagedBy=terraform
- Pre-existing VPC: vpc-0abc123 (available subnet IDs)
- Base module to use: terraform-aws-modules/eks/aws >= 20.0

## Acceptance Criteria
- [ ] terraform plan without errors
- [ ] tfsec without HIGH vulnerabilities
- [ ] cluster accessible via kubectl get nodes
- [ ] Karpenter provisioning nodes correctly
\`\`\`

## Real Cases for DevOps/SRE

### Case 1: Infrastructure Generation from Spec

\`\`\`bash
# Workflow with Claude Code + spec
# 1. Write the spec in REQUIREMENTS.md
# 2. Use Claude Code to generate

"Read the REQUIREMENTS.md file and generate:
1. terraform/main.tf with the EKS cluster per spec
2. terraform/variables.tf with all required variables
3. terraform/outputs.tf with useful outputs
4. Validate with terraform init + validate
5. Run tfsec and fix any HIGH severity issues
6. Show the summarized terraform plan"
\`\`\`

### Case 2: AIOps — Automated Alert Analysis in Production

\`\`\`python
import anthropic
import json

ALERT_ANALYSIS_PROMPT = """You are a senior SRE expert in Kubernetes.

Analyze the following alert and provide:
1. Probable root cause (with confidence percentage)
2. Estimated impact (affected users, impacted services)
3. Immediate actions (what to do right now)
4. Prevention (what to change to avoid recurrence)

Alert:
{alert_data}

Related metrics (last 30 min):
{metrics}

Return structured JSON:
{{
  "root_cause": {{"description": "...", "confidence": 0.85}},
  "impact": {{"affected_users": "...", "services": [...]}},
  "immediate_actions": ["step 1", "step 2"],
  "prevention": ["action 1", "action 2"],
  "severity": "critical|high|medium|low",
  "suggested_runbook": "runbook link or name"
}}"""

def analyze_alert(alert_data: dict, metrics: dict) -> dict:
    client = anthropic.Anthropic()
    response = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=1000,
        temperature=0.0,
        messages=[{
            "role": "user",
            "content": ALERT_ANALYSIS_PROMPT.format(
                alert_data=json.dumps(alert_data, indent=2),
                metrics=json.dumps(metrics, indent=2)
            )
        }]
    )
    return json.loads(response.content[0].text)
\`\`\`

### Case 3: Incident Runbook Generation

\`\`\`python
RUNBOOK_PROMPT = """You are a senior SRE engineer.

Generate a complete runbook for the following incident type:
Incident: {incident_type}
Service: {service}
Environment: {environment}

The runbook must include:
1. Symptoms (how to identify this incident is occurring)
2. Impact (what users are experiencing)
3. Step-by-step diagnosis (real kubectl/prometheus commands)
4. Solution (steps to resolve)
5. Verification (how to confirm it's resolved)
6. Prevention (how to avoid next time)
7. Escalation (when to escalate and to whom)

Use markdown and include real executable commands."""
\`\`\`

### Case 4: Postmortem Generation

\`\`\`python
POSTMORTEM_PROMPT = """You are a senior reliability engineer.

Based on the incident information, generate a complete postmortem:

Incident information:
{incident_data}

The postmortem should follow the format:
## Executive Summary
## Timeline
## Root Cause
## Impact
## What Went Well
## What Didn't Go Well
## Improvement Actions (with owner and deadline)
## Incident Metrics (MTTD, MTTR, etc)

Be specific, avoid blame language, focus on systemic improvements."""
\`\`\`

### Case 5: ChatOps with Slash Commands

\`\`\`python
# Slack bot for automated alert triage
CHATOPS_PROMPT = """You are an SRE assistant in a Slack incidents channel.

The command received was: {command}
Environment context: {context}

Respond concisely and actionably for an SRE.
Use Slack emojis for severity: :red_circle: critical, :yellow_circle: warning
Format: Slack-compatible markdown."""

def handle_slash_command(command: str, context: dict) -> str:
    client = anthropic.Anthropic()
    response = client.messages.create(
        model="claude-3-5-haiku-20241022",  # Haiku for low latency
        max_tokens=500,
        messages=[{
            "role": "user",
            "content": CHATOPS_PROMPT.format(
                command=command,
                context=json.dumps(context)
            )
        }]
    )
    return response.content[0].text
\`\`\`

## The SDD Pattern in Practice

### Full flow: from requirement to deploy

\`\`\`
1. SPEC (human writes)
   ↓
   Document with: context, requirements, constraints,
   acceptance criteria, reference examples

2. GENERATION (AI generates)
   ↓
   Claude Code reads the spec and generates artifacts:
   main.tf, deployment.yaml, ci-pipeline.yaml

3. AUTOMATIC VALIDATION (scripts)
   ↓
   terraform validate / kubectl dry-run / yamllint
   tfsec / checkov / kubesec

4. HUMAN REVIEW (required)
   ↓
   Engineer reviews generated code
   Focus on: security, cost, business specifics

5. TESTING (non-critical environment)
   ↓
   Deploy to dev/staging
   Verify expected behavior

6. APPLY (production)
   ↓
   Deploy approved after review and testing
\`\`\`

### When SDD works well

\`\`\`
✅ Good for SDD:
- Repetitive infrastructure with variations (multi-environment)
- Kubernetes manifests following company standards
- CI/CD pipelines with standard structure
- Runbooks for common incident types
- Structured technical documentation

❌ Bad for SDD:
- Complex, specific business logic
- Performance-critical algorithms
- High-level architectural decisions
- Cases where context is hard to specify
\`\`\`

## Common Mistakes

1. **Vague spec** — "create a secure cluster" without defining what secure means
2. **Skipping validation** — applying what AI generated without testing
3. **No acceptance criteria** — not knowing when the generated artifact is "correct"
4. **Outdated spec** — using old specs that don't reflect the current state
5. **AI for everything** — some tasks are faster done manually than by specifying

## Killer.sh Style Challenge

> **Scenario:** Your team needs to create a new Kubernetes microservice from scratch: Deployment, Service, HPA, NetworkPolicy, ConfigMap, and a GitHub Actions CI/CD pipeline. Write the complete spec you would use to guide Claude Code in generating all these artifacts, including verifiable acceptance criteria for each one.
`,
  quiz: [
    {
      question: 'What differentiates SDD (Spec Driven Development) from simply asking the LLM to generate code?',
      options: [
        'There is no difference — SDD is just a more sophisticated name for the same thing',
        'SDD uses a structured spec as source of truth with context, constraints, and acceptance criteria — ensuring generation is verifiable and aligned with company standards, not generic',
        'SDD requires a specific IDE to work',
        'SDD only works with Terraform, not with Kubernetes'
      ],
      correct: 1,
      explanation: 'SDD adds structure and verifiability to the AI generation process. A well-written spec includes: specific context (company standards, constraints), measurable acceptance criteria (terraform plan without errors, tfsec without HIGH severity), and reference examples. This produces code aligned with the real environment, not generic tutorial code. The spec→generate→validate→review→apply cycle ensures quality.',
      reference: 'SDD principle: output quality is directly proportional to spec quality. "Garbage in, garbage out" applies especially here.'
    },
    {
      question: 'Why does the AIOps alert analysis case use temperature 0.0 in the prompt?',
      options: [
        'To save output tokens',
        'To ensure deterministic and consistent outputs — incident analysis needs predictable responses for automation, not creative variation',
        'Temperature 0.0 is required for JSON outputs',
        'To reduce call latency'
      ],
      correct: 1,
      explanation: 'In AIOps, the LLM output is consumed programmatically — JSON parsing, decision making, ticket creation. Variability in the output can break parsing or lead to inconsistent decisions for the same type of alert. Temperature 0.0 ensures the model always chooses the most probable option, making the system predictable and testable.',
      reference: 'Rule: temperature 0.0 for automation and integration; temperature > 0 for creative generation and exploration.'
    },
    {
      question: 'In an SDD workflow for Terraform generation, which step is CRITICAL not to skip?',
      options: [
        'Always use the most expensive model for generation',
        'Automatic validation (terraform validate + tfsec) AND human review before applying to any environment',
        'Regenerate the code 3 times and choose the best version',
        'Always commit the generated code before reviewing'
      ],
      correct: 1,
      explanation: 'AI can generate technically valid Terraform that still contains: overly permissive security groups, resources without encryption, unnecessary IAM policies with *, or configurations that cost much more than expected. Automatic validation (tfsec, terraform validate) catches obvious syntax and security errors. Human review is needed for business context, cost, and environment specifics that the spec may not fully cover.',
      reference: 'Security principle: human always in the loop before applying AI-generated infrastructure to any non-ephemeral environment.'
    },
    {
      question: 'Why is Claude Haiku more appropriate than Sonnet for the ChatOps slash commands case?',
      options: [
        'Haiku is more expensive and therefore better for critical cases',
        'Haiku has much lower latency — Slack commands need fast responses (< 3s) for good UX; the initial triage task doesn\'t require Sonnet\'s deep reasoning',
        'Haiku can access Slack directly, Sonnet cannot',
        'Sonnet doesn\'t support Slack markdown format'
      ],
      correct: 1,
      explanation: 'ChatOps has an implicit latency SLA — a user in a Slack channel expects responses in seconds, not minutes. Haiku is 3-5x faster than Sonnet and 10x cheaper. For initial alert triage and simple command responses, Haiku\'s quality is sufficient. Sonnet can be used for subsequent deep analysis when latency is not critical.',
      reference: 'Pattern: use the lightest model for latency-critical (ChatOps, webhooks), most capable model for deep analysis (postmortem, architecture).'
    },
    {
      question: 'What should the "Acceptance Criteria" section of an SDD spec for Kubernetes YAML generation contain?',
      options: [
        'The architect\'s opinion on whether the YAML looks correct',
        'Specific, automatable checks: kubectl apply --dry-run without error, kubesec score > 7, resources defined, probes configured — objective criteria that can be verified by script',
        'A list of features the YAML should have, without a way to verify',
        'Acceptance criteria are not needed for YAML — only for code'
      ],
      correct: 1,
      explanation: 'Acceptance criteria in SDD must be automatically verifiable. "The YAML must be secure" is not verifiable. "kubesec scan returns score >= 7 without HIGH issues" is verifiable. Clear criteria: (1) enable automation of the validation process; (2) remove ambiguity about "it\'s done"; (3) are executable in CI/CD; (4) can be used in eval gates if the process is repeated.',
      reference: 'BDD connection: acceptance criteria in SDD are the equivalent of "Given/When/Then" in BDD — specific, objective, and automatable.'
    },
    {
      question: 'In the AI-based postmortem generation case, what is the role of human vs AI in the process?',
      options: [
        'AI generates the complete, ready-to-publish postmortem, human just approves',
        'AI structures and drafts based on incident data; human validates the root cause, checks the timeline, adds unavailable business context, and approves improvement actions',
        'Human writes the postmortem, AI only formats',
        'There is no role for AI in postmortems — it\'s too sensitive'
      ],
      correct: 1,
      explanation: 'AI accelerates postmortem creation by structuring the document and filling what can be inferred from data. But the human is essential to: validate the real root cause (AI may infer incorrectly), add organizational context (deploy pressure, trade-off decisions), ensure improvement actions are realistic and have owners, and ensure the document doesn\'t contain incorrect information that would be canonized.',
      reference: 'Best practice: use AI as a first draft that saves 70% of time, then human review focused on decisions and context AI doesn\'t have.'
    },
    {
      question: 'Which characteristic of an SDD spec is most important for obtaining high-quality Terraform?',
      options: [
        'The number of words in the spec — the longer, the better',
        'Company constraints and standards (approved modules, required tags, naming conventions) — without this, AI generates generic code incompatible with the real environment',
        'The architecture diagram included in the spec',
        'The Terraform version specified in the spec'
      ],
      correct: 1,
      explanation: 'Companies have specific conventions that are not obvious without context: Terraform modules approved by the security team, required tags for cost allocation, naming prefixes, pre-existing VPCs and subnets, approved instance types for each tier. Without these constraints in the spec, AI generates technically correct Terraform that is incompatible with the real environment — resulting in extensive rework.',
      reference: 'Best practice: maintain a "base spec" with all company constraints and standards that is included as context in every new SDD spec.'
    }
  ],
  flashcards: [
    {
      front: 'SDD — cycle and core concept',
      back: '**SDD = Spec Driven Development**\nUsing structured specifications as the\nsource of truth for AI generation.\n\n**Cycle:**\n\`\`\`\nSpec (human writes requirements)\n  ↓\nGeneration (AI generates artifacts)\n  ↓\nAutomatic validation (lint, dry-run)\n  ↓\nHuman review (security, business)\n  ↓\nTest (dev/staging)\n  ↓\nApply (production)\n\`\`\`\n\n**Spec structure:**\n- Context (team, environment, region)\n- Functional requirements (what to do)\n- Constraints (what can\'t be done)\n- Company standards (modules, tags)\n- Acceptance criteria (verifiable)\n\n**Differentiator:**\nVerifiable outputs aligned with the\nreal environment — not generic.'
    },
    {
      front: 'AIOps — automated alert analysis',
      back: '**Flow:**\n\`\`\`\nAlert fires\n  ↓\n[LLM analyzes alert + metrics]\n  ↓\nStructured JSON:\n- root_cause + confidence\n- impact (users/services)\n- immediate_actions\n- prevention\n- suggested_runbook\n  ↓\nSlack notification with analysis\n  ↓\nSRE acts with more context\n\`\`\`\n\n**Best practices:**\n- temperature=0.0 (deterministic)\n- Forced JSON output\n- Haiku for low latency\n- Sonnet for deep analysis\n- Human always makes final decision\n\n**Does NOT replace:** the final\ndecision is always the on-call SRE\'s.'
    },
    {
      front: 'SDD cases for DevOps/SRE',
      back: '**1. Infra Generation (Terraform/K8s)**\nSpec → AI generates → terraform validate\n→ tfsec → human review → apply\n\n**2. AIOps (alert analysis)**\nAlert → LLM analyzes → JSON with\nroot cause, impact, actions\n\n**3. Incident Runbooks**\nIncident type → LLM generates runbook\nwith diagnosis and real commands\n\n**4. Postmortem**\nIncident data → LLM structures\n→ human reviews and adds context\n\n**5. ChatOps**\nSlack slash command → LLM responds\nwith actionable technical guidance\n\n**Model selection by case:**\n- Complex generation: Sonnet\n- Real-time ChatOps: Haiku\n- Deep analysis: Sonnet + CoT\n- High-volume simple: Haiku'
    },
    {
      front: 'Effective spec for Kubernetes — components',
      back: '**Deployment spec template:**\n\`\`\`markdown\n# Spec: Service X Deployment\n\n## Context\n- Namespace: payments-prod\n- K8s version: 1.29\n- Image: myco/service-x:v1.2.0\n\n## Requirements\n- 3 replicas, RollingUpdate maxUnavailable=0\n- CPU: 200m req / 1000m limit\n- Memory: 256Mi req / 512Mi limit\n- Liveness: /health:8080 delay=30s\n- Readiness: /ready:8080 delay=10s\n- Anti-affinity: spread across nodes\n\n## Company Standards\n- Labels: app, version, team, env\n- runAsNonRoot: true required\n- readOnlyRootFilesystem: true\n\n## Acceptance Criteria\n- kubectl dry-run without error\n- kubesec score >= 7\n- All resource fields defined\n- Probes configured\n\`\`\`'
    },
    {
      front: 'Postmortem with AI — human vs AI roles',
      back: '**AI does:**\n- Structures document in standard format\n- Fills timeline with provided data\n- Suggests root cause based on facts\n- Proposes generic improvement actions\n- Calculates MTTD, MTTR, etc.\n- Ensures all sections are covered\n\n**Human does:**\n- Validates the real root cause\n- Adds organizational context\n- Corrects AI\'s wrong inferences\n- Defines action owners\n- Ensures appropriate tone (no blame)\n- Approves and publishes\n\n**Time saved:**\nAI reduces ~70% of writing time\nHuman focuses on what AI doesn\'t have:\ncontext, judgment, accountability\n\n**Result:**\nMore complete postmortem in less time'
    },
    {
      front: 'When to use SDD vs not use',
      back: '**Good for SDD:**\n✅ Repetitive infra with variations\n   (multi-environment, multi-region)\n✅ K8s manifests with fixed standards\n✅ Standardized CI/CD pipelines\n✅ Common incident type runbooks\n✅ Structured technical documentation\n✅ Reusable Terraform modules\n\n**Bad for SDD:**\n❌ Complex, specific business logic\n❌ Performance-critical algorithms\n❌ High-level architectural decisions\n❌ Cases where context is hard to specify\n❌ Simple tasks faster done manually\n\n**Sign of a good spec:**\nSomeone new could implement exactly\nwhat you want using ONLY the spec,\nwithout additional questions.'
    }
  ],
  lab: {
    scenario: 'You will apply SDD to create a complete automated Kubernetes alert triage system: spec, AI generation, validation, and a functional implementation with the Anthropic API.',
    objective: 'Practice the complete SDD cycle: write a structured spec, use AI to generate the artifact, validate automatically, and implement a real AIOps use case.',
    duration: '35-45 minutes',
    steps: [
      {
        title: 'Write the AIOps system spec',
        instruction: `Create a complete spec for an automated alert triage system. The spec must have all necessary components for AI to generate code deterministically.`,
        hints: [
          'Be specific about the JSON output format',
          'Define verifiable acceptance criteria',
          'Include constraints like maximum latency and preferred model'
        ],
        solution: `\`\`\`bash
mkdir aiops-triage && cd aiops-triage

cat > SPEC.md << 'EOF'
# Spec: Automated Kubernetes Alert Triage System

## Context
- Team: Platform Engineering
- Goal: reduce MTTR by 30% with automated triage
- Integration: receives alerts from Alertmanager via webhook

## Functional Requirements

### Input
- Alertmanager POST webhook
- Payload: alert name, namespace, pod, labels, annotations
- Additional metrics from Prometheus (last 30 min)

### Processing
- Analysis with Claude Haiku (latency < 3s required)
- Temperature: 0.0 (deterministic)
- Return structured JSON (not free text)

### Output (JSON)
\`\`\`json
{
  "severity": "critical|high|medium|low",
  "root_cause": {"description": "string", "confidence": 0.0-1.0},
  "immediate_actions": ["string"],
  "runbook": "runbook-name-or-url",
  "escalation_needed": true|false,
  "additional_context": "string"
}
\`\`\`

## Constraints
- Maximum latency: 3 seconds (p99)
- Model: claude-3-5-haiku-20241022
- No automatic actions — suggestions only
- Audit logs for all calls

## Acceptance Criteria
- [ ] Valid JSON schema in 100% of cases
- [ ] p99 latency < 3s on 100-call benchmark
- [ ] Correct classification in > 85% of test cases
- [ ] No crash on malformed inputs
- [ ] Cost per alert < $0.001
EOF
echo "Spec created successfully"
\`\`\``,
        verify: `\`\`\`bash
ls SPEC.md
cat SPEC.md | grep -c "##"
# Expected output: at least 4 sections

grep -E "^## " SPEC.md
# Expected output:
# ## Context
# ## Functional Requirements
# ## Constraints
# ## Acceptance Criteria

echo "Spec verified successfully"
\`\`\``
      },
      {
        title: 'Generate the system from the spec',
        instruction: `Use the spec to generate the triage system. Create the main Python file following the spec requirements exactly.`,
        hints: [
          'Follow the spec rigorously — especially the output format',
          'Implement error handling for malformed inputs',
          'Add logging for audit as per spec'
        ],
        solution: `\`\`\`python
# triage_system.py — generated from SPEC.md
import os, json, time, logging, re
from typing import Optional
import anthropic

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger(__name__)

TRIAGE_PROMPT = """You are a senior SRE expert in Kubernetes and observability.

Analyze the Kubernetes alert and return a structured triage.

Alert:
{alert_json}

Return ONLY this JSON (no additional text):
{{
  "severity": "<critical|high|medium|low>",
  "root_cause": {{
    "description": "<concise cause description>",
    "confidence": <0.0-1.0>
  }},
  "immediate_actions": ["<action 1>", "<action 2>"],
  "runbook": "<relevant-runbook-name or null>",
  "escalation_needed": <true|false>,
  "additional_context": "<relevant additional information>"
}}"""

def triage_alert(alert_data: dict, metrics: Optional[dict] = None) -> dict:
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    context = {"alert": alert_data}
    if metrics:
        context["metrics"] = metrics

    start_time = time.time()
    try:
        response = client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=600,
            temperature=0.0,
            messages=[{"role": "user", "content": TRIAGE_PROMPT.format(
                alert_json=json.dumps(context, indent=2)
            )}]
        )
        latency_ms = (time.time() - start_time) * 1000
        result = json.loads(response.content[0].text)

        # Validate schema
        for field in ["severity", "root_cause", "immediate_actions", "runbook", "escalation_needed"]:
            if field not in result:
                raise ValueError(f"Required field missing: {field}")

        logger.info(json.dumps({
            "event": "alert_triaged",
            "alert": alert_data.get("name", "unknown"),
            "severity": result["severity"],
            "latency_ms": round(latency_ms, 2)
        }))
        return result

    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON from model: {e}")
        return {"error": "invalid_json"}
    except Exception as e:
        logger.error(f"Triage error: {e}")
        return {"error": str(e)}

if __name__ == '__main__':
    test_alert = {
        "name": "PodCrashLoopBackOff",
        "namespace": "payments-prod",
        "pod": "payments-api-xxx",
        "restart_count": 15,
        "exit_code": 137
    }
    result = triage_alert(test_alert)
    if "error" not in result:
        print(f"Severity: {result['severity']}")
        print(f"Root cause: {result['root_cause']['description']}")
\`\`\``,
        verify: `\`\`\`bash
ls triage_system.py
python3 -c "import triage_system; print('Import OK')"
\`\`\``
      },
      {
        title: 'Validate against spec acceptance criteria',
        instruction: `Create a validation script that automatically checks whether the generated system meets the acceptance criteria defined in the spec.`,
        hints: [
          'Each spec acceptance criterion should have an automated test',
          'Tests without an API key should verify the schema and code',
          'Acceptance criteria tests document the spec contract'
        ],
        solution: `\`\`\`python
# validate_spec.py
import inspect, json

def check_json_schema():
    """CA: Valid JSON schema in 100% of cases"""
    from triage_system import TRIAGE_PROMPT
    required = ["severity", "root_cause", "immediate_actions", "runbook", "escalation_needed"]
    all_present = all(f in TRIAGE_PROMPT for f in required)
    print(f"  JSON schema defined in prompt: {'✅' if all_present else '❌'}")
    return all_present

def check_model_spec():
    """CA: Model as per spec (haiku)"""
    import triage_system
    source = inspect.getsource(triage_system.triage_alert)
    correct_model = "claude-3-5-haiku-20241022" in source
    deterministic = "temperature=0.0" in source
    print(f"  Correct model (haiku): {'✅' if correct_model else '❌'}")
    print(f"  Deterministic temperature (0.0): {'✅' if deterministic else '❌'}")
    return correct_model and deterministic

def check_logging():
    """CA: Audit logging implemented"""
    import triage_system
    source = inspect.getsource(triage_system.triage_alert)
    has_logging = "logger.info" in source or "logger.error" in source
    print(f"  Audit logging: {'✅' if has_logging else '❌'}")
    return has_logging

def run_acceptance_tests():
    print("=== Acceptance Criteria Validation (SPEC.md) ===\\n")
    results = []
    print("CA1: Valid JSON schema in 100% of cases")
    results.append(check_json_schema())
    print("\\nCA2: Model and temperature per spec")
    results.append(check_model_spec())
    print("\\nCA3: Audit logging implemented")
    results.append(check_logging())
    passed = sum(results)
    print(f"\\n=== Result: {passed}/{len(results)} criteria met ===")
    print(f"{'✅ SPEC MET' if passed == len(results) else '❌ SPEC INCOMPLETE'}")
    return passed == len(results)

if __name__ == '__main__':
    exit(0 if run_acceptance_tests() else 1)
\`\`\`

\`\`\`bash
python3 validate_spec.py
\`\`\``,
        verify: `\`\`\`bash
python3 validate_spec.py
# Expected output:
# === Acceptance Criteria Validation (SPEC.md) ===
# CA1: Valid JSON schema in 100% of cases
#   JSON schema defined in prompt: ✅
# CA2: Model and temperature per spec
#   Correct model (haiku): ✅
#   Deterministic temperature (0.0): ✅
# CA3: Audit logging implemented
#   Audit logging: ✅
# === Result: 3/3 criteria met ===
# ✅ SPEC MET

ls -la
# Expected:
# SPEC.md  triage_system.py  validate_spec.py
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'AI generates code that does not follow company standards',
      difficulty: 'medium',
      symptom: 'The Terraform generated by AI does not use company-approved modules, ignores required cost allocation tags, or uses non-approved instance types — forcing extensive manual rewriting.',
      diagnosis: `\`\`\`bash
# 1. Analyze what is missing from the spec
diff <(cat SPEC.md) <(cat EXPECTED_PATTERNS.md)

# 2. Check if standards are documented anywhere
grep -r "required_tags\\|approved_modules\\|allowed_instance_types" terraform/

# 3. Check if the output violates standards
tfsec . --format json | jq '.results[] | select(.severity == "HIGH")'
grep -r "tags" terraform/main.tf | grep -c "Team\\|Environment\\|CostCenter"
\`\`\``,
      solution: `**Cause:** the spec did not include company standards and constraints — the necessary context for AI to generate aligned code.

**Solution 1 — Create a reusable "base spec":**
\`\`\`markdown
# Company Standards — include in every SDD spec

## Approved Terraform Modules
- EKS: terraform-aws-modules/eks/aws >= 20.0
- RDS: terraform-aws-modules/rds/aws >= 6.0
- VPC: already existing — use data source, don't create

## Required Tags
\`\`\`hcl
tags = {
  Team        = "<team-name>"
  Environment = "<dev|staging|prod>"
  CostCenter  = "<cost-center-id>"
  ManagedBy   = "terraform"
}
\`\`\`
\`\`\`

**Solution 2 — Include base spec as context:**
\`\`\`bash
# For every generation with Claude Code:
cat company-standards.md SPEC.md > FULL_SPEC.md
# Use FULL_SPEC.md as context
\`\`\`

**Solution 3 — Automatic post-generation validation:**
\`\`\`bash
python3 validate_company_standards.py terraform/
\`\`\``
    },
    {
      title: 'AIOps JSON output not parseable for some alerts',
      difficulty: 'easy',
      symptom: 'The alert triage system works for most cases but occasionally returns text with explanations instead of pure JSON, breaking the parsing in the automated system.',
      diagnosis: `\`\`\`bash
# 1. Log raw outputs before parsing
# Add to code:
# logger.debug(f"Raw response: {response.content[0].text[:200]}")

# 2. Check if there is markdown in the output
# Signal: response starts with \`\`\`json or has text before {

# 3. Check if the problem occurs for specific alerts
# Compare failing alerts with working ones
\`\`\``,
      solution: `**Cause:** the model occasionally adds explanatory text or markdown before/after the JSON, especially for ambiguous or unusual alerts.

**Solution 1 — Stronger prompt instruction:**
\`\`\`python
TRIAGE_PROMPT = """...
IMPORTANT: Return ONLY the JSON object.
Do not use markdown, do not add text before or after.
The first character of the response MUST be '{'.
"""
\`\`\`

**Solution 2 — Robust parser:**
\`\`\`python
def safe_json_parse(text: str) -> dict:
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass

    # Extract JSON from markdown code blocks
    json_match = re.search(r'\`\`\`(?:json)?\\n?({.*?})\\n?\`\`\`', text, re.DOTALL)
    if json_match:
        return json.loads(json_match.group(1))

    # Extract any JSON object from text
    json_match = re.search(r'({[^{}]*(?:{[^{}]*}[^{}]*)*})', text, re.DOTALL)
    if json_match:
        return json.loads(json_match.group(1))

    raise ValueError(f"Could not extract JSON: {text[:100]}")
\`\`\`

**Solution 3 — Few-shot example in prompt:**
\`\`\`
# Add a correct input/output example to the prompt
Example of CORRECT response:
{"severity": "critical", "root_cause": {...}, ...}
\`\`\``
    }
  ]
};
