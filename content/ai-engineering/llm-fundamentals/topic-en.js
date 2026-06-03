window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['ai-engineering/llm-fundamentals'] = {
  theory: `
# Practical LLM Fundamentals for Engineers

## Relevance
You don't need to understand the internals of a neural network to use LLMs effectively. This topic covers what a DevOps/SRE/Platform Engineer needs to know to get real value from tools like Claude, GPT-4, Gemini, and open-source models — without the unnecessary academic theory.

## How LLMs Work (enough to use them well)

### The model as a text function

An LLM receives text as input and produces text as output. The idea is simple — the complexity is in the training, which is not your responsibility. What matters to you:

\`\`\`
Input (prompt) ──► [LLM] ──► Output (completion)
\`\`\`

**Tokens, not words:** LLMs process tokens, not words. A token is approximately 4 characters or 3/4 of a word in English. Non-Latin scripts and longer words may use more tokens per character.

\`\`\`
"kubectl get pods" = ~4 tokens
"apiVersion: apps/v1" = ~6 tokens
A 100-line YAML file ≈ 400-600 tokens
\`\`\`

**Why it matters:** the context window has a token limit. If you send a 50,000-line file to a model with a 128k token window, you will have a problem.

### Context Window — what fits in the model's "memory"

| Model | Context Window | What fits |
|-------|---------------|-----------|
| GPT-4o | 128k tokens | ~100 medium code files |
| Claude 3.5 Sonnet | 200k tokens | ~150 files or an entire small repository |
| Claude 3.5 Haiku | 200k tokens | Same, but faster and cheaper |
| Gemini 1.5 Pro | 1M tokens | Complete large repositories |
| Llama 3.1 (local) | 128k tokens | Similar to GPT-4o |

**Practical rule:** only send relevant context. Sending an entire repository when you want help with a specific file degrades response quality.

### Temperature — creativity vs determinism

Temperature controls how much the model "risks" in its responses:

\`\`\`
Temperature 0.0 → Always picks the most probable option. Deterministic.
              → Use for: YAML generation, code, kubectl commands

Temperature 0.7 → Balance between creativity and reliability
              → Use for: documentation, explanations, general answers

Temperature 1.0+ → High variability, more "creative"
               → Use for: brainstorming, generating options
\`\`\`

In practice, most modern models already come with a reasonable default temperature and you rarely need to adjust it manually.

## The Models — When to Use Each

### For tool-based use (Copilot, Claude Code, etc.)

You don't choose the model — the tool does. Understanding the characteristics helps calibrate expectations.

### For API use (when you integrate directly)

\`\`\`
Claude 3.5 Sonnet   → Best cost-benefit for complex infra tasks
                      Good at: YAML, reasoning, following precise instructions
                      Price: ~$3/M input tokens, $15/M output tokens

Claude 3.5 Haiku    → Fast and cheap for simple tasks
                      Good at: classification, short answers, pipelines
                      Price: ~$0.25/M input tokens, $1.25/M output tokens

GPT-4o              → Strong at code, multimodal (images)
                      Price: ~$2.50/M input tokens, $10/M output tokens

GPT-4o mini         → Cheap alternative to Haiku
                      Price: ~$0.15/M input tokens, $0.60/M output tokens

Gemini 1.5 Pro      → Huge context window (1M tokens)
                      Ideal when you need to pass entire repositories

Llama 3.1 (local)   → Zero cost, full privacy, but requires GPU
                      Good for: sensitive data that can't leave the company
\`\`\`

**Rule for choosing:**
- Complex task with reasoning → Claude Sonnet or GPT-4o
- High volume, simple task → Claude Haiku or GPT-4o mini
- Sensitive data → local model (Llama via Ollama)
- Huge repository → Gemini 1.5 Pro

## Prompt Engineering for Technical Contexts

### The structure that works

\`\`\`
[Role]         → Who the model should be
[Context]      → Relevant information about the environment
[Task]         → What you want it to do
[Constraints]  → Restrictions and output format
[Examples]     → (optional) input/output examples
\`\`\`

\`\`\`
Bad example:
"write me a kubernetes yaml"

Good example:
"You are a Kubernetes 1.29 expert.
Context: EKS cluster with Karpenter as node autoscaler.
I need a Deployment YAML for a Node.js API with:
- 2 replicas, HPA configured (min 2, max 10, CPU 70%)
- Liveness probe at /health, readiness at /ready
- Resources: request 100m/128Mi, limit 500m/512Mi
- Label app: user-api and version: v1
Return only the YAML, no explanations."
\`\`\`

### Essential techniques

**Chain of Thought — ask for step-by-step reasoning**
\`\`\`
"Before answering, think step by step:
1. What is the problem?
2. What are the possible causes?
3. How to diagnose each one?
Then write the diagnostic script."
\`\`\`
Use when: complex debugging, troubleshooting, root cause analysis.

**Few-shot — provide examples**
\`\`\`
"Convert these kubectl commands to YAML resources:

Example 1:
Input: kubectl create deployment nginx --image=nginx --replicas=3
Output:
apiVersion: apps/v1
kind: Deployment
...

Now convert this:
kubectl create deployment api --image=myapp:v2 --replicas=5"
\`\`\`

**Technical persona — define the "expert" profile**
\`\`\`
"You are a senior SRE with 10 years of experience in Kubernetes in production.
When answering, be direct, use real examples, and point out the most common
mistakes beginners make on this topic."
\`\`\`

**Structured output — force specific format**
\`\`\`
"Return the answer ONLY in this JSON format, with no additional text:
{
  'cause': 'string',
  'diagnosis': ['command1', 'command2'],
  'solution': 'string',
  'prevention': 'string'
}"
\`\`\`

### Limitations you need to know

**1. Knowledge cutoff — the model doesn't know what happened after training**
- Claude 3.5: knowledge up to ~April 2024
- GPT-4o: knowledge up to ~October 2023
- Consequence: recent tool versions may be wrong

\`\`\`bash
# Always verify versions suggested by the LLM
# Instead of blindly trusting:
helm search repo bitnami/redis --versions | head -5
kubectl version --short
\`\`\`

**2. Hallucination — the model invents with confidence**
- APIs that don't exist, flags that don't work, fake references
- Mitigation: always test commands in a safe environment first
- Tip: ask the model to indicate what it's not sure about

**3. Context lost in long conversations**
- Models "forget" the beginning of very long conversations
- Solution: start a new conversation for new tasks; include critical context at the beginning

**4. Non-deterministic outputs**
- The same prompt can generate different responses
- Don't trust critical outputs without verification

## Costs — Order of Magnitude

\`\`\`
1 complex YAML file (2000 tokens) ≈ $0.006 with Sonnet
1000 log analysis calls            ≈ $3-15 depending on model
CI/CD pipeline with 100 reviews/day ≈ $5-50/month depending on model
RAG system with 1M queries/month    ≈ $100-500

Rule: start with expensive models to validate it works,
then optimize with cheaper models.
\`\`\`

## Common Mistakes

1. **Excessive context** — sending 50,000-line logs without filtering degrades quality
2. **Vague prompt** — "improve this script" without saying what's wrong or what "better" means
3. **Trust without verifying** — commands suggested by LLMs should be tested before running in production
4. **Using the wrong model for the task** — GPT-4o to classify 10,000 alerts is expensive; use Haiku
5. **Not iterating on the prompt** — prompts rarely work on the first try; refining is normal

## Killer.sh Style Challenge

> **Scenario:** You receive an 800-line YAML file from a broken HelmRelease and need LLM help to identify the problem. Write the optimized prompt you would use — with role, context, task, and constraints — to get the most useful diagnosis possible without unnecessarily blowing the context window.
`,
  quiz: [
    {
      question: 'What is the practical consequence of an LLM\'s "knowledge cutoff" for an infrastructure engineer?',
      options: [
        'The model cannot process YAML files',
        'Tool versions, APIs, and flags suggested by the model may be outdated — always verify against official documentation',
        'The model only works offline after the cutoff',
        'The model gets slower after the cutoff'
      ],
      correct: 1,
      explanation: 'LLMs have a "knowledge cutoff" — the date up to which they were trained. After that, they don\'t know about new Kubernetes versions, new CRD fields, API changes, etc. A model can suggest deprecated flags or old version configurations with full confidence. Always validate critical versions in the official documentation.',
      reference: 'Related concept: RAG (Retrieval Augmented Generation) partially solves this problem by injecting up-to-date documentation into the context before the response.'
    },
    {
      question: 'To generate a complex troubleshooting script requiring reasoning about multiple possible causes, which prompt engineering technique is most effective?',
      options: [
        'High temperature (1.5) for more creativity',
        'Chain of Thought — asking the model to think step by step before giving the final answer',
        'Make the prompt as short as possible to save tokens',
        'Always use the cheapest model'
      ],
      correct: 1,
      explanation: 'Chain of Thought (CoT) significantly improves quality in tasks requiring step-by-step reasoning. By asking "think step by step: what are the possible causes? how to diagnose each one?", the model "externalizes" reasoning and makes fewer logical errors. Especially useful for troubleshooting and root cause analysis.',
      reference: 'Related concept: Few-shot prompting (giving examples) complements CoT well — examples show the expected format, CoT improves reasoning.'
    },
    {
      question: 'Which model would be most suitable for processing an entire 500,000-token repository to find problematic security configurations?',
      options: [
        'Claude 3.5 Haiku — it is the fastest',
        'GPT-4o mini — it is the cheapest',
        'Gemini 1.5 Pro — has a 1M token context window, the only one capable of processing that volume',
        'Any model with RAG works for this'
      ],
      correct: 2,
      explanation: 'Claude Sonnet and GPT-4o have windows of ~128-200k tokens — 500k tokens wouldn\'t fit. Gemini 1.5 Pro has a 1M token window, being the only major model capable of processing very large repositories at once. For this specific case of security analysis on a giant repository, it is the correct choice.',
      reference: 'Related concept: For large repositories with smaller-window models, use RAG — fragment the repository, index it, and retrieve only the relevant sections.'
    },
    {
      question: 'What is "hallucination" in LLMs and how to mitigate it in an infrastructure context?',
      options: [
        'It\'s when the model gets slow — mitigate with better hardware',
        'It\'s when the model generates false information with confidence — mitigate by testing commands in a safe environment, asking the model to flag uncertainty, and verifying against official documentation',
        'It\'s a bug that only occurs at high temperature',
        'It\'s when the model repeats the same response — use temperature 1.0 to fix it'
      ],
      correct: 1,
      explanation: 'Hallucination is the phenomenon where LLMs generate incorrect information with full confidence. In an infra context, this can be: kubectl flags that don\'t exist, invented Helm chart versions, incorrect API configurations. Mitigations: always test commands in a development environment, ask the model to indicate its confidence level, and cross-check with official documentation.',
      reference: 'Related concept: Hallucination is more common in questions about specific facts (versions, APIs) than in general reasoning. For critical facts, always verify externally.'
    },
    {
      question: 'What is the correct strategy for choosing between Claude Sonnet and Claude Haiku in a production pipeline that processes 10,000 alerts per day?',
      options: [
        'Always use the most capable model (Sonnet) to ensure quality',
        'Validate that Haiku produces sufficient quality for the task and use Haiku for the lower cost — 10x cheaper than Sonnet',
        'Use Sonnet during the day and Haiku at night to save money',
        'It doesn\'t matter — all Claude models have the same price'
      ],
      correct: 1,
      explanation: 'The correct strategy is: first validate with the most capable model (Sonnet) to ensure the task is feasible and measure quality, then test whether the cheaper model (Haiku) delivers sufficient quality for the use case. Haiku is ~10x cheaper — with 10,000 alerts/day, that represents substantial savings. Smaller models are frequently sufficient for classification and structured tasks.',
      reference: 'Related concept: This strategy — start expensive to validate, optimize with cheaper models — is equivalent to the feature lifecycle in product development.'
    },
    {
      question: 'Why include "Return only the YAML, no explanations" in a prompt that generates Kubernetes manifests?',
      options: [
        'To save output tokens',
        'To force structured, directly parseable output — enables automation, avoids text that would break kubectl apply, and makes the output predictable',
        'Models can\'t generate YAML with explanations',
        'It\'s a market convention without a technical reason'
      ],
      correct: 1,
      explanation: 'Format constraints in the prompt make the output directly usable in automation. "Only YAML" means you can do `kubectl apply -f <(claude-api ...)` without needing to parse text. Predictable outputs facilitate pipes, scripts, and CI/CD integration. Without this constraint, the model may add explanations, markdown, or text that would break parsing.',
      reference: 'Related concept: For critical JSON outputs, use JSON mode (available in OpenAI and Anthropic) which guarantees JSON validity even without the explicit constraint.'
    },
    {
      question: 'What is the practical impact of sending an excessively large context (e.g., 50,000 lines of logs) to an LLM?',
      options: [
        'None — more context always improves the response',
        'The model gets slower but quality improves proportionally',
        'Higher cost, higher latency, and paradoxically worse quality — models have difficulty focusing on what\'s relevant in very large contexts ("lost in the middle")',
        'The model automatically rejects the request'
      ],
      correct: 2,
      explanation: 'Research shows the "lost in the middle" phenomenon — models have difficulty retrieving information in the middle of very long contexts, focusing better on the beginning and end. Additionally, large contexts increase cost and latency linearly. Best practice: filter logs to the last N relevant lines, or use grep/jq to extract only what matters before sending to the model.',
      reference: 'Related concept: RAG solves the problem of large knowledge bases without blowing the context — it fragments and retrieves only what\'s relevant.'
    }
  ],
  flashcards: [
    {
      front: 'Tokens vs Words — what matters for engineers',
      back: '**Token ≈ 4 chars / 3/4 word (English)**\n\nPractical rules:\n- 1 line of code ≈ 10-20 tokens\n- 1 YAML file (100 lines) ≈ 500 tokens\n- 1 page of text ≈ 750 tokens\n- A small repository (10k lines) ≈ 50k-100k tokens\n\n**Why it matters:**\n- Context window has a token limit\n- Cost is charged per token\n- Latency increases with more tokens\n\n**Context limits:**\n- Claude Sonnet/Haiku: 200k tokens\n- GPT-4o: 128k tokens\n- Gemini 1.5 Pro: 1M tokens\n- Llama 3.1 local: 128k tokens\n\n**Rule:** filter before sending.\n`kubectl logs pod | tail -100` instead\nof sending the complete log.'
    },
    {
      front: 'Model selection — quick guide for infra',
      back: '**By task:**\n\n🔴 **Complex task / deep reasoning:**\nClaude 3.5 Sonnet or GPT-4o\n→ Advanced debugging, architecture, code review\n\n🟡 **Simple task / high volume:**\nClaude 3.5 Haiku or GPT-4o mini\n→ Alert classification, simple YAML generation\n\n🟢 **Giant repository (>200k tokens):**\nGemini 1.5 Pro (1M context)\n→ Full repository analysis\n\n🔵 **Sensitive data / compliance:**\nLlama 3.1 via Ollama (local)\n→ Zero data leaves the company\n\n**Cost strategy:**\n1. Validate with expensive model (quality ok?)\n2. Test with cheap model (quality sufficient?)\n3. Use cheap model in production'
    },
    {
      front: 'Effective prompt structure for technical tasks',
      back: '**Template:**\n\`\`\`\n[ROLE]\nYou are a [specialist] with [X years]\nof experience in [domain].\n\n[CONTEXT]\nEnvironment: [description]\nVersions: [k8s 1.29, helm 3.14, etc]\nConstraints: [no internet, staging]\n\n[TASK]\n[Exactly what you want]\n\n[CONSTRAINTS]\n- Return only [format]\n- Do not include [what to avoid]\n- Limit of [X lines/chars]\n\`\`\`\n\n**Techniques by situation:**\n- Complex debugging → Chain of Thought\n- Specific format → Few-shot examples\n- Safe code → "do not use deprecated APIs"\n- Check confidence → "indicate if unsure"\n\n**Anti-patterns:**\n- ❌ Vague prompt ("improve this")\n- ❌ Huge context without filtering\n- ❌ No format constraint'
    },
    {
      front: 'Critical LLM limitations for infra use',
      back: '**1. Knowledge Cutoff**\nDoesn\'t know versions/APIs after training\n→ Always verify suggested versions\n→ Solution: RAG with updated docs\n\n**2. Hallucination**\nGenerates false information with confidence\n→ Test everything in safe environment first\n→ Ask: "indicate what you\'re not sure about"\n\n**3. Lost in the Middle**\nLoses focus in very long contexts\n→ Filter input before sending\n→ Critical info: beginning or end of prompt\n\n**4. Non-Deterministic**\nSame prompt = different responses\n→ For critical: temperature 0.0\n→ Always review output before applying\n\n**5. Cost**\nScales with input + output tokens\n→ Filter context = save money\n→ Right model for each task'
    },
    {
      front: 'Chain of Thought — when and how to use it',
      back: '**When to use:**\n- Troubleshooting with multiple causes\n- Solution architecture\n- Root cause analysis (RCA)\n- Decisions requiring trade-offs\n\n**How to use:**\n\`\`\`\n"Before answering, think step by step:\n1. What is the observed symptom?\n2. What are the possible causes?\n3. How to test/rule out each cause?\n4. What is the most likely diagnosis?\nThen write the investigation plan."\n\`\`\`\n\n**Why it works:**\nModels reason better when they\n"externalize" thinking before\nthe final answer — similar to how\nengineers think out loud.\n\n**Combined with few-shot:**\nGiving an example of step-by-step reasoning\nfrom a similar case increases quality\neven further.'
    },
    {
      front: 'LLM costs — order of magnitude for planning',
      back: '**Approximate prices (May/2024):**\n\n| Model | Input | Output |\n|-------|-------|--------|\n| Claude Sonnet | $3/M | $15/M |\n| Claude Haiku | $0.25/M | $1.25/M |\n| GPT-4o | $2.5/M | $10/M |\n| GPT-4o mini | $0.15/M | $0.6/M |\n| Gemini 1.5 Pro | $3.5/M | $10.5/M |\n\n**Use cases — estimated cost:**\n\n1 YAML analysis (2k tokens) with Sonnet:\n→ ~$0.006 (less than 1 cent)\n\n1000 alerts/day classified with Haiku:\n→ ~$0.50/day = ~$15/month\n\nCI/CD with 50 PRs/day (review with Sonnet):\n→ ~$10-30/month\n\nRAG system 100k queries/month:\n→ $50-200/month depending on model\n\n**Golden rule:**\nValidate with expensive → optimize with cheap'
    }
  ],
  lab: null,
  troubleshooting: [
    {
      title: 'LLM generates invalid YAML or with outdated APIs',
      difficulty: 'easy',
      symptom: 'The model generated a Kubernetes manifest but kubectl apply fails with "no kind is registered for the version" or fields that don\'t exist in the current cluster version.',
      diagnosis: `\`\`\`bash
# 1. Check the suggested field version in the real documentation
kubectl explain deployment.spec.template.spec.containers.resources
kubectl api-resources | grep <resource-type>

# 2. Validate the YAML before applying (without a cluster)
kubectl apply --dry-run=client -f manifest.yaml

# 3. Use kubeval or kubeconform to validate version schema
kubeconform -strict -kubernetes-version 1.29.0 manifest.yaml

# 4. See which API version the LLM assumed
# Usually the LLM indicates "apiVersion: apps/v1" but
# may use deprecated beta versions for CRDs
\`\`\``,
      solution: `**Causes and solutions:**

1. **Knowledge cutoff:** The model may have been trained before an API change. Add to the prompt: "Use only stable Kubernetes 1.29+ APIs (v1, apps/v1). Do not use beta or alpha APIs."

2. **Prompt without version specification:** Always include the exact Kubernetes version and relevant tool versions in the prompt.

3. **Automatic validation in the flow:**
\`\`\`bash
# Validate LLM output before using
LLM_OUTPUT="\$(call-llm ...)"
echo "\$LLM_OUTPUT" | kubectl apply --dry-run=client -f -
if [ \$? -eq 0 ]; then
  echo "\$LLM_OUTPUT" | kubectl apply -f -
fi
\`\`\`

4. **Improve the prompt:**
\`\`\`
"Use Kubernetes 1.29 stable APIs only.
Do not use: autoscaling/v2beta1, networking.k8s.io/v1beta1.
If you are not sure about an API, indicate it explicitly."
\`\`\``
    },
    {
      title: 'LLM responses vary widely for the same problem',
      difficulty: 'medium',
      symptom: 'You use the same prompt to analyze similar alerts but receive completely different responses in quality and format, making automation difficult.',
      diagnosis: `\`\`\`bash
# 1. Check if the prompt has format constraints
# Without them, the model varies a lot

# 2. Test the same prompt 5 times and compare outputs
for i in 1 2 3 4 5; do
  echo "--- Run \$i ---"
  curl -s https://api.anthropic.com/v1/messages \\
    -H "x-api-key: \$ANTHROPIC_API_KEY" \\
    -H "content-type: application/json" \\
    -d '{"model":"claude-3-5-haiku","messages":[{"role":"user","content":"<your-prompt>"}],"max_tokens":500}' \\
    | jq -r '.content[0].text'
done

# 3. Check if temperature is configured
# Default may vary between APIs
\`\`\``,
      solution: `**Solutions for consistent output:**

1. **Force JSON format:**
\`\`\`json
"Return ONLY this JSON, no additional text:
{
  \\"root_cause\\": \\"string\\",
  \\"severity\\": \\"low|medium|high|critical\\",
  \\"actions\\": [\\"string\\"],
  \\"confidence\\": \\"0.0-1.0\\"
}"
\`\`\`

2. **Temperature 0.0 for critical outputs:**
\`\`\`python
response = client.messages.create(
    model="claude-3-5-sonnet",
    temperature=0.0,  # Deterministic
    messages=[...]
)
\`\`\`

3. **Few-shot with examples of the expected format:**
Include 2-3 input/output examples in the prompt — the model learns the pattern.

4. **Validate response schema:**
\`\`\`python
import json, jsonschema
output = json.loads(llm_response)
jsonschema.validate(output, schema)  # Predefined schema
\`\`\``
    }
  ]
};
