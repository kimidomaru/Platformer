window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['ai-engineering/llm-harness'] = {
  theory: `
# LLM Harness & AI System Evaluation

## Relevance
Putting an LLM into production without evaluation mechanisms is like deploying code without tests. The "harness" is the set of tools and practices for measuring, monitoring, and controlling the quality of AI outputs — ensuring the system works as expected now and continues to work after prompt or model changes.

## What an LLM Harness Is

### Core concept

\`\`\`
LLM Harness = evaluation framework + observability + quality control
\`\`\`

**Analogy with software testing:**

\`\`\`
Traditional software:
  Code → [Unit tests + integration] → CI gate → Production

LLM system:
  Prompt + Model → [Evals + Observability] → Eval gate → Production
\`\`\`

### Why evaluate?

\`\`\`
Real problems without evaluation:
- I changed the prompt and quality dropped — only discovered 3 days later
- The model was updated and some use cases broke
- Cost exploded because prompts became too long
- Latency increased and users complain
- The model is hallucinating in 15% of cases — we don't know
\`\`\`

## Types of Evaluation

### 1. Deterministic Evals (automatic verification)

For outputs with a right or wrong answer:

\`\`\`python
# Check if the output contains the correct fields
def eval_yaml_output(llm_response: str) -> dict:
    import yaml
    try:
        parsed = yaml.safe_load(llm_response)
        return {
            'valid_yaml': True,
            'has_apiVersion': 'apiVersion' in parsed,
            'has_kind': 'kind' in parsed,
            'has_metadata': 'metadata' in parsed,
            'has_spec': 'spec' in parsed,
        }
    except yaml.YAMLError:
        return {'valid_yaml': False}

# Classification eval (right/wrong answer)
def eval_alert_classification(llm_response: str, expected: str) -> bool:
    return llm_response.strip().lower() == expected.lower()
\`\`\`

### 2. Model-based Evals (LLM as judge)

For outputs that require judgment:

\`\`\`python
# Use an LLM as judge to evaluate another LLM
JUDGE_PROMPT = """
Evaluate the response below on a scale of 1-5 for each criterion.

Original question: {question}
Response to evaluate: {answer}

Criteria:
1. Technical accuracy (is the information correct?)
2. Completeness (does it cover all important aspects?)
3. Clarity (easy to understand?)
4. Applicability (useful for an SRE in production?)

Return ONLY JSON:
{{"accuracy": X, "completeness": X, "clarity": X, "applicability": X, "reasoning": "..."}}
"""

import anthropic
client = anthropic.Anthropic()

def llm_judge(question: str, answer: str) -> dict:
    import json
    response = client.messages.create(
        model="claude-3-5-haiku-20241022",
        max_tokens=500,
        temperature=0.0,
        messages=[{
            "role": "user",
            "content": JUDGE_PROMPT.format(question=question, answer=answer)
        }]
    )
    return json.loads(response.content[0].text)
\`\`\`

### 3. Regression Evals (don't break what worked)

\`\`\`python
# Eval suite that runs on every prompt change
EVAL_SUITE = [
    {
        'id': 'yaml-001',
        'input': 'Create a Deployment YAML for nginx with 3 replicas',
        'eval_fn': eval_yaml_output,
        'expected': {'valid_yaml': True, 'has_apiVersion': True, 'has_kind': True}
    },
    {
        'id': 'class-001',
        'input': 'Classify this alert: CrashLoopBackOff on pod nginx-xxx',
        'eval_fn': lambda r: eval_alert_classification(r, 'critical'),
        'expected': True
    }
]

def run_regression_suite(prompt_version: str):
    results = []
    for eval_case in EVAL_SUITE:
        response = call_llm(prompt_version, eval_case['input'])
        score = eval_case['eval_fn'](response)
        passed = score == eval_case['expected'] if not isinstance(eval_case['expected'], dict) else all(score.get(k) == v for k, v in eval_case['expected'].items())
        results.append({'id': eval_case['id'], 'passed': passed, 'score': score})

    pass_rate = sum(1 for r in results if r['passed']) / len(results)
    return {'pass_rate': pass_rate, 'results': results}
\`\`\`

## Observability with Langfuse

Langfuse is the leading open-source tool for tracking LLM calls in production:

### Basic setup

\`\`\`python
from langfuse import Langfuse
from langfuse.decorators import observe, langfuse_context

langfuse = Langfuse(
    public_key=os.getenv("LANGFUSE_PUBLIC_KEY"),
    secret_key=os.getenv("LANGFUSE_SECRET_KEY"),
    host=os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com")
)
\`\`\`

### Automatic tracing

\`\`\`python
@observe()  # automatic decorator — tracks input, output, latency, cost
def analyze_alert(alert_text: str) -> dict:
    import anthropic
    client = anthropic.Anthropic()

    response = client.messages.create(
        model="claude-3-5-haiku-20241022",
        max_tokens=500,
        messages=[{
            "role": "user",
            "content": f"Classify and analyze this Kubernetes alert: {alert_text}"
        }]
    )
    return {"analysis": response.content[0].text}
\`\`\`

### What Langfuse tracks automatically

\`\`\`
Per call:
- Input (prompt sent)
- Output (response received)
- Model (which model was used)
- Latency (response time)
- Token count (input + output)
- Estimated cost (based on model)

Aggregated:
- Average / p95 / p99 latency
- Error rate
- Total cost per day/week
- Distribution of models used
- Call volume per hour
\`\`\`

### Scores and human feedback

\`\`\`python
# Add manual score (e.g., user feedback)
langfuse.score(
    trace_id=trace_id,  # ID of the specific call
    name="quality",
    value=4.5,           # 1-5
    comment="Accurate and actionable response"
)

# Automatic score from evals
langfuse.score(
    trace_id=trace_id,
    name="yaml_valid",
    value=1.0 if eval_result['valid_yaml'] else 0.0
)
\`\`\`

## Eval Gate in CI/CD

Integrating evals into the CI pipeline ensures prompt changes don't degrade quality:

\`\`\`yaml
# .github/workflows/llm-eval.yaml
name: LLM Eval Gate

on:
  pull_request:
    paths:
      - 'prompts/**'
      - 'src/llm/**'

jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run LLM Eval Suite
        env:
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
          LANGFUSE_SECRET_KEY: \${{ secrets.LANGFUSE_SECRET_KEY }}
        run: |
          pip install -r requirements.txt
          python -m pytest tests/evals/ -v --json-report --json-report-file=eval-results.json

      - name: Check Pass Rate
        run: |
          python scripts/check_eval_gate.py eval-results.json --min-pass-rate 0.85
          # Fails the pipeline if pass rate < 85%
\`\`\`

## Cost and Latency Monitoring

\`\`\`python
# Wrapper for cost tracking
PRICING = {
    'claude-3-5-sonnet-20241022': {'input': 3.0, 'output': 15.0},    # per 1M tokens
    'claude-3-5-haiku-20241022': {'input': 0.25, 'output': 1.25},
    'gpt-4o': {'input': 2.5, 'output': 10.0},
    'gpt-4o-mini': {'input': 0.15, 'output': 0.6}
}

def calculate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    pricing = PRICING.get(model, {'input': 0, 'output': 0})
    return (input_tokens * pricing['input'] +
            output_tokens * pricing['output']) / 1_000_000
\`\`\`

## Prompt Regression Testing

\`\`\`python
# Compare two prompts side by side
def compare_prompts(prompt_a: str, prompt_b: str, test_cases: list):
    results = []
    for case in test_cases:
        response_a = call_llm(prompt_a, case['input'])
        response_b = call_llm(prompt_b, case['input'])

        comparison = judge_compare(
            question=case['input'],
            response_a=response_a,
            response_b=response_b
        )
        results.append({
            'case_id': case['id'],
            'a_wins': comparison['winner'] == 'A',
            'b_wins': comparison['winner'] == 'B',
        })

    a_wins = sum(1 for r in results if r['a_wins'])
    b_wins = sum(1 for r in results if r['b_wins'])
    print(f"Prompt A wins: {a_wins}/{len(results)}")
    print(f"Prompt B wins: {b_wins}/{len(results)}")
    return results
\`\`\`

## Common Mistakes

1. **Evaluating only during development** — the model changes, the prompt changes; continuous evaluation is necessary
2. **Eval dataset too small** — 5 cases are not representative; minimum 50-100 for reliability
3. **Evals without edge cases** — include malformed, long inputs, different languages
4. **Not versioning prompts** — prompt changes are code changes; version and test them
5. **Ignoring latency and cost** — a perfect eval with 10x expected cost is not acceptable

## Killer.sh Style Challenge

> **Scenario:** You have a Kubernetes alert classification system using Claude Haiku. The team wants to migrate to a new (improved) prompt but fears regressions. Describe:
> 1. The eval suite you would create (alert types, metrics)
> 2. The CI eval gate that would approve or reject the new prompt
> 3. How to use Langfuse to gradually compare the old vs new prompt in production
`,
  quiz: [
    {
      question: 'What differentiates a "deterministic eval" from a "model-based eval" in LLM systems?',
      options: [
        'Deterministic eval uses GPU, model-based eval uses CPU',
        'Deterministic eval checks objective programmatic criteria (valid YAML? correct JSON?); model-based eval uses another LLM as a judge to evaluate subjective quality (accuracy, completeness, clarity)',
        'Deterministic eval is more expensive than model-based eval',
        'There is no practical difference — both measure the same thing'
      ],
      correct: 1,
      explanation: 'Deterministic evals are automatable with code: check if YAML is valid, if JSON has the correct fields, if the classification matches expected. Model-based evals are needed when the quality criterion is subjective: "is the explanation clear?", "is the suggestion technically correct for an SRE?". Using an LLM as a judge for these cases is an established practice.',
      reference: 'Ideal combination: use deterministic evals for what can be objectively verified, and model-based evals for quality and relevance.'
    },
    {
      question: 'Why is an "eval gate" in CI/CD critical when modifying production prompts?',
      options: [
        'To save tokens during development',
        'To ensure prompt changes don\'t degrade output quality before going to production — just as unit tests prevent code regressions',
        'To comply with AI regulatory requirements',
        'Eval gates are only needed for GPT models, not for Claude'
      ],
      correct: 1,
      explanation: 'Prompts are code. An apparently harmless prompt change can improve one use case and break another. Without an eval gate, you only discover this problem in production — after users have already been affected. An eval gate with a representative case suite and a pass rate threshold ensures prompt changes go through automatic validation, just like any other code change.',
      reference: 'Direct analogy: eval gate for prompts = automated tests for code. It doesn\'t make sense to have one without the other in production systems.'
    },
    {
      question: 'What does Langfuse automatically track when using the @observe() decorator on a Python function?',
      options: [
        'Only the call latency',
        'Input (prompt), output (response), model, latency, token count, and estimated cost — without additional code beyond the decorator',
        'Only errors and exceptions from the function',
        'Langfuse requires manual configuration of each metric'
      ],
      correct: 1,
      explanation: 'The @observe() decorator from Langfuse automatically instruments the function and tracks: the complete input passed, the output returned, which model was used, call latency, tokens consumed (input + output), and estimated cost based on model pricing. This eliminates the need for manual instrumentation code for each call.',
      reference: 'Tip: Langfuse also tracks nested spans — if a function calls another that calls another, the entire call tree is tracked as a single "trace".'
    },
    {
      question: 'What is the correct strategy for creating an eval dataset for a Kubernetes alert triage system?',
      options: [
        'Create 5-10 simple, positive examples that the system clearly gets right',
        'Create 50-100+ cases including critical alerts, warning alerts, ambiguous alerts, malformed inputs, and edge cases — with ground truth defined by domain experts',
        'Use the same training dataset as the model',
        'Ask the model to generate its own eval cases'
      ],
      correct: 1,
      explanation: 'An effective eval dataset must: (1) be large enough (50+ cases for statistical reliability); (2) cover the real input distribution, not just easy cases; (3) include edge cases and problematic inputs; (4) have ground truth defined by human experts, not by the model itself. Small or positive-only datasets give false confidence in system quality.',
      reference: 'Additional practice: update the eval dataset when new types of production alerts appear — evals are living documents, not static.'
    },
    {
      question: 'How to calculate the cost of an LLM call given the model and token count?',
      options: [
        'Cost = total_tokens * fixed_price_per_token',
        'Cost = (input_tokens * input_price + output_tokens * output_price) / 1_000_000',
        'The cost is always the same regardless of the model',
        'Cost = number_of_calls * price_per_request'
      ],
      correct: 1,
      explanation: 'The correct formula is: cost = (input_tokens * input_price_per_M + output_tokens * output_price_per_M) / 1_000_000. Input and output tokens have different prices — output generally costs 4-6x more than input. Example with Claude Haiku: 1000 input + 500 output = (1000 * 0.25 + 500 * 1.25) / 1M = $0.00000875. Accumulates significantly at scale.',
      reference: 'Optimization tip: output tokens are more expensive — prompts asking for long responses cost proportionally more. Specifying "concise response" can reduce cost.'
    },
    {
      question: 'What does a low "faithfulness" score (0.4) in RAGAS mean for a runbook RAG system?',
      options: [
        'The indexed documents are outdated',
        'The LLM is generating information not supported by the retrieved documents — answering beyond what the real runbooks say',
        'The embedding model has issues',
        'The system latency is too high'
      ],
      correct: 1,
      explanation: 'A faithfulness of 0.4 in a runbook system is critical: it means 60% of statements in the answers are not supported by the retrieved documents. The LLM is "completing with training" instead of answering only based on the runbooks. In an infra context, this can result in incorrect procedures that differ from the company\'s real runbooks.',
      reference: 'Solution for low faithfulness: use a more restrictive prompt ("answer ONLY based on the provided documents, do not add external information") and/or reduce temperature to 0.0.'
    },
    {
      question: 'How should "prompt comparison" (A/B testing of prompts) be rigorously implemented?',
      options: [
        'Test the new prompt manually for an hour and decide subjectively',
        'Use a fixed set of test cases, evaluate both prompts on the same cases with LLM judge or deterministic metrics, and decide based on objective metrics',
        'Show the new prompt to the end user and collect feedback',
        'Choose the shorter prompt to save tokens'
      ],
      correct: 1,
      explanation: 'Rigorous prompt comparison requires: (1) fixed set of test cases — the same for both prompts; (2) objective evaluation with LLM judge or deterministic metrics; (3) multiple rounds to compensate for non-determinism; (4) statistical analysis of which cases each prompt wins. Subjective or informal comparison is insufficient for production systems.',
      reference: 'Tool: Langfuse allows A/B testing experiments for prompts with automatic tracking of which version produced which result.'
    }
  ],
  flashcards: [
    {
      front: 'LLM Harness — what it is and why it matters',
      back: '**Definition:**\nEvaluation framework + observability +\nquality control for LLM systems.\n\n**Analogy:**\n`Prompts = code` → they need tests\nHow would you ship code without tests?\n\n**Types of evaluation:**\n\n**Deterministic Evals**\n- Output has right/wrong answer\n- Valid YAML? Correct JSON fields?\n- Classification = expected label?\n\n**Model-based Evals (LLM-as-judge)**\n- Subjective quality\n- Technical accuracy, clarity, utility\n- Another LLM evaluates the output\n\n**Regression Evals**\n- Suite that runs on every change\n- Ensures what worked keeps working\n\n**Eval Gate in CI:**\nBlocks merge if pass rate < threshold'
    },
    {
      front: 'Langfuse — LLM observability',
      back: '**What it is:**\nOpen-source observability for LLM systems.\nAutomatically tracks all calls.\n\n**Setup:**\n\`\`\`python\nfrom langfuse.decorators import observe\n\n@observe()  # automatically tracks\ndef my_function(input):\n    response = client.messages.create(...)\n    return response\n\`\`\`\n\n**Tracked per call:**\n- Full input and output\n- Model used\n- Latency (ms)\n- Tokens (input + output)\n- Estimated cost\n\n**Aggregated metrics:**\n- Average / p95 / p99 latency\n- Cost per day/week\n- Call volume\n- Model distribution\n\n**Scores:**\n\`\`\`python\nlangfuse.score(trace_id=id,\n  name="quality", value=4.5)\n\`\`\`'
    },
    {
      front: 'Eval Gate in CI/CD for prompts',
      back: '**Pipeline:**\n\`\`\`yaml\n# .github/workflows/llm-eval.yaml\non:\n  pull_request:\n    paths: [\'prompts/**\']\n\njobs:\n  eval:\n    steps:\n    - name: Run Eval Suite\n      run: python -m pytest tests/evals/\n    \n    - name: Check Pass Rate\n      run: python check_gate.py --min-pass-rate 0.85\n      # Fails PR if pass rate < 85%\n\`\`\`\n\n**What the suite should cover:**\n- Normal cases (real distribution)\n- Critical cases (high severity)\n- Ambiguous cases (borderline)\n- Malformed inputs (robustness)\n- Edge cases (extremes)\n\n**Typical threshold:**\n- 85% pass rate for merge\n- 95% pass rate for production deploy\n\n**Version prompts:**\nPrompts in files in the repository,\ntreated like code.'
    },
    {
      front: 'LLM cost calculation',
      back: '**Formula:**\n`cost = (tokens_in * price_in + tokens_out * price_out) / 1_000_000`\n\n**Prices (May/2024):**\n| Model | In (/M) | Out (/M) |\n|-------|---------|----------|\n| Cl Sonnet | $3 | $15 |\n| Cl Haiku | $0.25 | $1.25 |\n| GPT-4o | $2.5 | $10 |\n| GPT-4o mini | $0.15 | $0.6 |\n\n**Examples:**\n- 1000 alerts with Haiku (500in+200out):\n  (500000*0.25 + 200000*1.25)/1M = $0.375\n\n- 100 PR reviews with Sonnet (2000in+500out):\n  (200000*3 + 50000*15)/1M = $1.35\n\n**Optimization rule:**\n1. Validate with expensive model\n2. Test with cheap model\n3. Production with cheap model\n4. Monitor cost with Langfuse'
    },
    {
      front: 'Eval Dataset — best practices',
      back: '**Minimum size:**\n- POC: 20-30 cases\n- Production: 100+ cases\n- High criticality: 500+ cases\n\n**Case distribution:**\n- 50% typical cases (real distribution)\n- 25% critical or high-severity cases\n- 15% ambiguous cases (borderline)\n- 10% edge cases and problematic inputs\n\n**What NOT to do:**\n❌ Only easy cases you know will pass\n❌ Static dataset that is never updated\n❌ Ground truth defined by the model itself\n❌ No negative cases (incorrect inputs)\n\n**Eval case structure:**\n\`\`\`python\n{\n  "id": "alert-001",\n  "input": "alert text",\n  "expected": "critical",\n  "tags": ["crashloop", "production"],\n  "created_by": "oncall-sre",\n  "created_at": "2024-01-15"\n}\n\`\`\`'
    },
    {
      front: 'A/B Test of Prompts — methodology',
      back: '**Why do it:**\nBefore changing a prompt in production,\nvalidate that the new version is better.\n\n**Methodology:**\n1. Define a fixed set of test cases\n2. Run BOTH prompts on the same cases\n3. Evaluate with LLM judge or det. metrics\n4. Count "wins": which prompt won each case\n5. Decide based on data\n\n**Comparison code:**\n\`\`\`python\nfor case in test_cases:\n    r_a = call_llm(prompt_a, case["input"])\n    r_b = call_llm(prompt_b, case["input"])\n    winner = judge(case["input"], r_a, r_b)\n    # "A", "B" or "tie"\n\`\`\`\n\n**Cautions:**\n- Run 3x each case (non-deterministic)\n- Also evaluate latency and cost\n- Report results by category\n\n**With Langfuse:**\nPrompt experiments with automatic\ntracking of which version produced what.'
    }
  ],
  lab: {
    scenario: 'You have a Kubernetes alert classification system using Claude Haiku. You will implement a complete harness: eval suite, LLM judge evaluation, and Langfuse tracking — ensuring confidence in future changes.',
    objective: 'Implement a functional LLM harness with deterministic evals, model-based evals with LLM judge, and basic observability — to ensure quality in production systems.',
    duration: '35-45 minutes',
    steps: [
      {
        title: 'Set up the environment and install dependencies',
        instruction: `Install the necessary dependencies and configure credentials for the evaluation harness. We will use the Anthropic API and Langfuse for observability.`,
        hints: [
          'Langfuse has a free tier at cloud.langfuse.com',
          'For the lab, we can simulate without a real API key using a mock',
          'Install: anthropic, langfuse, pytest'
        ],
        solution: `\`\`\`bash
# Create project
mkdir llm-harness && cd llm-harness

# Install dependencies
pip install anthropic langfuse pytest pytest-json-report pyyaml

# Create structure
mkdir -p src tests/evals data

# Create .env file (replace with your real credentials)
cat > .env << 'EOF'
ANTHROPIC_API_KEY=sk-ant-xxx  # replace with your real key
LANGFUSE_PUBLIC_KEY=pk-lf-xxx  # at cloud.langfuse.com
LANGFUSE_SECRET_KEY=sk-lf-xxx
LANGFUSE_HOST=https://cloud.langfuse.com
EOF

# Create the alert classification system (what we will test)
cat > src/alert_classifier.py << 'EOF'
import os
import anthropic

CLASSIFICATION_PROMPT = """You are an expert SRE in Kubernetes.
Classify the alert below into one of the categories:
- critical: requires immediate attention (production impact)
- warning: requires attention soon (potential impact)
- info: informational (no immediate impact)

Alert: {alert}

Return ONLY the category (critical, warning, or info), nothing else."""

def classify_alert(alert_text: str) -> str:
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    response = client.messages.create(
        model="claude-3-5-haiku-20241022",
        max_tokens=10,
        temperature=0.0,
        messages=[{"role": "user", "content": CLASSIFICATION_PROMPT.format(alert=alert_text)}]
    )
    return response.content[0].text.strip().lower()
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verify installation
python3 -c "import anthropic; import langfuse; import pytest; print('OK')"
# Expected output: OK

# Verify project structure
ls -R llm-harness/
# Expected: src/  tests/  data/  .env

python3 -c "from src.alert_classifier import classify_alert; print('Import OK')"
# Expected: Import OK
\`\`\``
      },
      {
        title: 'Create deterministic eval suite',
        instruction: `Create an eval suite with test cases for the alert classifier. Include critical, warning, info, and ambiguous cases.`,
        hints: [
          'Use pytest to structure the evals',
          'Include at least 15 cases covering different types',
          'Ambiguous cases are important for testing robustness'
        ],
        solution: `\`\`\`python
# Create eval cases dataset
import json

eval_cases = [
    # Critical
    {"id": "crit-001", "input": "Pod payments-api-xxx in CrashLoopBackOff in production namespace", "expected": "critical", "tags": ["crashloop", "prod"]},
    {"id": "crit-002", "input": "Node worker-3 NotReady, 15 pods evicted", "expected": "critical", "tags": ["node", "eviction"]},
    {"id": "crit-003", "input": "OOMKilled in database-proxy container, memory exhausted", "expected": "critical", "tags": ["oom", "memory"]},
    {"id": "crit-004", "input": "PersistentVolume bound failed, PostgreSQL data inaccessible", "expected": "critical", "tags": ["storage", "database"]},
    {"id": "crit-005", "input": "Deployment auth-service with 0 available replicas in production", "expected": "critical", "tags": ["deployment", "zero-replicas"]},
    # Warnings
    {"id": "warn-001", "input": "Pod restart count 5 in the last 2 hours, service still operational", "expected": "warning", "tags": ["restart", "operational"]},
    {"id": "warn-002", "input": "CPU throttling at 85% in api-gateway container", "expected": "warning", "tags": ["cpu", "throttling"]},
    {"id": "warn-003", "input": "PVC at 80% usage, 5GB/day growth detected", "expected": "warning", "tags": ["storage", "capacity"]},
    {"id": "warn-004", "input": "HPA cannot scale, replica limit reached", "expected": "warning", "tags": ["hpa", "scaling"]},
    {"id": "warn-005", "input": "Certificate expiring in 7 days for api.example.com", "expected": "warning", "tags": ["cert", "expiry"]},
    # Infos
    {"id": "info-001", "input": "Pod scheduled on node worker-2, waiting for container start", "expected": "info", "tags": ["scheduling"]},
    {"id": "info-002", "input": "HPA scaled from 3 to 5 replicas in response to traffic increase", "expected": "info", "tags": ["scaling", "autoscale"]},
    {"id": "info-003", "input": "Deployment frontend updated to version v2.1.0", "expected": "info", "tags": ["deploy", "update"]},
    # Edge cases
    {"id": "edge-001", "input": "CRITICAL ALERT!!! everything is down!!!", "expected": "critical", "tags": ["malformed"]},
    {"id": "edge-002", "input": "warning: low disk", "expected": "warning", "tags": ["minimal-info"]},
]

with open('data/eval_cases.json', 'w') as f:
    json.dump(eval_cases, f, indent=2)
print(f"Created {len(eval_cases)} eval cases")
\`\`\`

\`\`\`python
# tests/evals/test_alert_classifier.py
import json
import pytest
import sys
sys.path.insert(0, '.')

from src.alert_classifier import classify_alert

def load_eval_cases():
    with open('data/eval_cases.json') as f:
        return json.load(f)

@pytest.mark.parametrize("case", load_eval_cases(), ids=[c['id'] for c in load_eval_cases()])
def test_alert_classification(case):
    result = classify_alert(case['input'])
    assert result == case['expected'], \\
        f"ID: {case['id']} | Expected: {case['expected']} | Got: {result}"
\`\`\``,
        verify: `\`\`\`bash
ls data/eval_cases.json
python3 -c "import json; cases = json.load(open('data/eval_cases.json')); print(f'{len(cases)} cases')"
# Expected output: 15 cases (or more)
\`\`\``
      },
      {
        title: 'Implement model-based eval with LLM judge',
        instruction: `Create an evaluator that uses an LLM as a judge to evaluate response quality in dimensions like technical accuracy and clarity.`,
        hints: [
          'Use the more capable model as judge (Sonnet) evaluating the less capable model (Haiku)',
          'Force JSON output for programmatic analysis',
          'Temperature 0.0 for the judge for consistency'
        ],
        solution: `\`\`\`python
# src/llm_judge.py
import json, os
import anthropic

JUDGE_PROMPT = """You are a senior SRE evaluating the quality of an automated Kubernetes alert triage system.

Alert received: {alert}
Generated classification: {classification}
Correct classification: {expected}

Evaluate the response quality on the following criteria (1-5):
1. Accuracy: is the classification correct for the alert criticality?
2. Consistency: would the classification be the same for similar alerts?

Return ONLY this JSON, no additional text:
{{"accuracy": <1-5>, "consistency": <1-5>, "correct": <true|false>, "reasoning": "<max 50 chars>"}}"""

def judge_classification(alert: str, classification: str, expected: str) -> dict:
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    response = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=200,
        temperature=0.0,
        messages=[{"role": "user", "content": JUDGE_PROMPT.format(
            alert=alert, classification=classification, expected=expected
        )}]
    )
    return json.loads(response.content[0].text)

if __name__ == '__main__':
    import sys
    sys.path.insert(0, '.')
    from src.alert_classifier import classify_alert

    test_cases = [
        {"input": "Pod in CrashLoopBackOff in production", "expected": "critical"},
        {"input": "CPU throttling at 85%", "expected": "warning"},
        {"input": "Pod scheduled successfully", "expected": "info"},
    ]

    for case in test_cases:
        classification = classify_alert(case['input'])
        judgment = judge_classification(case['input'], classification, case['expected'])
        print(f"Input: {case['input'][:50]}")
        print(f"Classified: {classification} | Expected: {case['expected']}")
        print(f"Judge: accuracy={judgment['accuracy']}/5, correct={judgment['correct']}\\n")
\`\`\``,
        verify: `\`\`\`bash
ls src/llm_judge.py
python3 -c "from src.llm_judge import judge_classification; print('Import OK')"
echo "LLM judge setup verified"
\`\`\``
      },
      {
        title: 'Implement tracking with Langfuse',
        instruction: `Add observability to the classification system using Langfuse. Track latency, cost, and quality scores.`,
        hints: [
          'Use @observe() decorator for automatic instrumentation',
          'Add scores manually after evaluation',
          'Langfuse has a free tier at cloud.langfuse.com'
        ],
        solution: `\`\`\`python
# src/observed_classifier.py
import os, time
import anthropic
from langfuse.decorators import observe, langfuse_context
from langfuse import Langfuse

PRICING = {'claude-3-5-haiku-20241022': {'input': 0.25, 'output': 1.25}}

langfuse = Langfuse(
    public_key=os.getenv("LANGFUSE_PUBLIC_KEY", "mock"),
    secret_key=os.getenv("LANGFUSE_SECRET_KEY", "mock"),
)

PROMPT = "Classify the Kubernetes alert as: critical, warning, or info.\\nAlert: {alert}\\nReturn ONLY the category."

@observe(name="classify_alert_observed")
def classify_alert_observed(alert_text: str) -> dict:
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    model = "claude-3-5-haiku-20241022"
    start = time.time()

    response = client.messages.create(
        model=model, max_tokens=10, temperature=0.0,
        messages=[{"role": "user", "content": PROMPT.format(alert=alert_text)}]
    )
    latency_ms = (time.time() - start) * 1000
    in_tok = response.usage.input_tokens
    out_tok = response.usage.output_tokens
    cost = (in_tok * PRICING[model]['input'] + out_tok * PRICING[model]['output']) / 1_000_000

    langfuse_context.update_current_observation(
        input=alert_text,
        output=response.content[0].text,
        metadata={"latency_ms": round(latency_ms, 2), "cost_usd": round(cost, 8)}
    )
    return {"classification": response.content[0].text.strip().lower(),
            "latency_ms": round(latency_ms, 2), "cost_usd": round(cost, 8)}

if __name__ == '__main__':
    test_alerts = [
        "Pod payments-api in CrashLoopBackOff in production",
        "CPU throttling detected in api-gateway",
    ]
    for alert in test_alerts:
        result = classify_alert_observed(alert)
        print(f"Alert: {alert[:50]}")
        print(f"Classification: {result['classification']}, Latency: {result['latency_ms']:.0f}ms\\n")
    langfuse.flush()
\`\`\``,
        verify: `\`\`\`bash
ls src/observed_classifier.py
python3 -c "from src.observed_classifier import classify_alert_observed; print('Import OK')"

echo "=== Complete LLM Harness ==="
echo "src/alert_classifier.py      - Main system"
echo "src/llm_judge.py             - Model-based evals"
echo "src/observed_classifier.py   - With observability"
echo "tests/evals/                 - Deterministic eval suite"
echo "data/eval_cases.json         - 15 eval cases"
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Eval suite with high false negative rate (many cases "passing" but poor quality)',
      difficulty: 'medium',
      symptom: 'The eval suite shows 90% pass rate but in production users complain about incorrect responses. The eval cases pass but don\'t reflect real issues.',
      diagnosis: `\`\`\`bash
# 1. Analyze the distribution of eval cases
python3 - << 'EOF'
import json
with open('data/eval_cases.json') as f:
    cases = json.load(f)

from collections import Counter
dist = Counter(c['expected'] for c in cases)
print("Label distribution:", dict(dist))
# If very unbalanced: easy cases dominate the suite

tags = Counter(tag for c in cases for tag in c.get('tags', []))
print("Most common tags:", tags.most_common(10))
# If only simple cases, edge cases are missing
EOF
\`\`\``,
      solution: `**Cause:** eval dataset does not represent the real production distribution.

**Solution 1 — Add "real world" cases:**
\`\`\`python
# Capture real production inputs that caused problems
# Add to dataset with correct ground truth

bad_cases_from_prod = [
    {
        "id": "prod-001",
        "input": "<real alert that caused an error>",
        "expected": "<correct label>",
        "tags": ["production", "regression"]
    }
]
\`\`\`

**Solution 2 — Balance the distribution:**
- Ensure each category has adequate proportion
- Include more ambiguous cases (where the boundary is unclear)

**Solution 3 — Add adversarial inputs:**
\`\`\`python
adversarial_cases = [
    {"input": "everything is fine", "expected": "info"},     # too vague
    {"input": "CRITICAL ALERT " * 20, "expected": "critical"},  # too long
    {"input": "", "expected": "info"},                        # empty
]
\`\`\`

**Solution 4 — Continuous monitoring:**
Use Langfuse to identify production inputs where the quality score is low
and add them to the eval dataset.`
    },
    {
      title: 'Langfuse is not tracking traces',
      difficulty: 'easy',
      symptom: 'The code with @observe() runs without errors but no traces appear in the Langfuse dashboard. Or the decorator causes authentication errors.',
      diagnosis: `\`\`\`bash
# 1. Check credentials
python3 - << 'EOF'
import os
print("PUBLIC_KEY:", os.getenv("LANGFUSE_PUBLIC_KEY", "NOT SET"))
print("SECRET_KEY:", "SET" if os.getenv("LANGFUSE_SECRET_KEY") else "NOT SET")
print("HOST:", os.getenv("LANGFUSE_HOST", "NOT SET"))
EOF

# 2. Test direct Langfuse connection
python3 - << 'EOF'
from langfuse import Langfuse
lf = Langfuse()
try:
    lf.auth_check()
    print("Authentication OK")
except Exception as e:
    print(f"Authentication error: {e}")
EOF
\`\`\``,
      solution: `**Common cause 1 — Environment variables not loaded:**
\`\`\`bash
pip install python-dotenv

# At the beginning of the script:
from dotenv import load_dotenv
load_dotenv()
\`\`\`

**Common cause 2 — Flush not called:**
\`\`\`python
# Traces are sent in batches — call flush at the end
from langfuse import Langfuse
langfuse = Langfuse()

# ... your code ...

# At the end of the script/process:
langfuse.flush()
\`\`\`

**Common cause 3 — Wrong credentials:**
\`\`\`bash
# Check in dashboard: Settings → API Keys
# Public key starts with "pk-lf-"
# Secret key starts with "sk-lf-"
echo \$LANGFUSE_PUBLIC_KEY | head -c 8  # Should be "pk-lf-"
\`\`\`

**Common cause 4 — Incompatible SDK version:**
\`\`\`bash
pip install langfuse --upgrade
\`\`\``
    }
  ]
};
