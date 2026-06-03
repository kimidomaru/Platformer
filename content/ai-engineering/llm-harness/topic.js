window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['ai-engineering/llm-harness'] = {
  theory: `
# LLM Harness & Avaliacao de Sistemas AI

## Relevancia
Colocar um LLM em producao sem mecanismos de avaliacao e como deployar codigo sem testes. O "harness" e o conjunto de ferramentas e praticas para medir, monitorar e controlar a qualidade dos outputs de AI — garantindo que o sistema funcione como esperado agora e continue funcionando apos mudancas de prompt ou modelo.

## O que e um LLM Harness

### Conceito central

\`\`\`
LLM Harness = framework de avaliacao + observabilidade + controle de qualidade
\`\`\`

**Analogia com testes de software:**

\`\`\`
Software tradicional:
  Codigo → [Testes unitarios + integração] → CI gate → Producao

Sistema LLM:
  Prompt + Modelo → [Evals + Observabilidade] → Eval gate → Producao
\`\`\`

### Por que avaliar?

\`\`\`
Problemas reais sem avaliacao:
- Mudei o prompt e a qualidade caiu — so descobri 3 dias depois
- O modelo foi atualizado e alguns casos de uso quebraram
- Custo explodiu porque os prompts ficaram muito longos
- Latencia aumentou e os usuarios reclamam
- O modelo esta alucinando em 15% dos casos — nao sabemos
\`\`\`

## Tipos de Avaliacao

### 1. Deterministic Evals (verificacao automatica)

Para outputs com resposta certa ou errada:

\`\`\`python
# Verificar se o output contem os campos corretos
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
            'resources_defined': (
                'resources' in str(parsed.get('spec', {}).get('template', {})
                    .get('spec', {}).get('containers', [{}])[0] if parsed else {})
            )
        }
    except yaml.YAMLError:
        return {'valid_yaml': False}

# Eval de classificacao (resposta certa/errada)
def eval_alert_classification(llm_response: str, expected: str) -> bool:
    return llm_response.strip().lower() == expected.lower()
\`\`\`

### 2. Model-based Evals (LLM como juiz)

Para outputs que requerem julgamento:

\`\`\`python
# Usar um LLM como juiz para avaliar outro LLM
JUDGE_PROMPT = """
Avalie a resposta abaixo em uma escala de 1-5 para cada criterio.

Pergunta original: {question}
Resposta para avaliar: {answer}

Criterios:
1. Precisao tecnica (informacao correta?)
2. Completude (cobre todos os aspectos importantes?)
3. Clareza (facil de entender?)
4. Aplicabilidade (util para um SRE em producao?)

Retorne APENAS JSON:
{{"precisao": X, "completude": X, "clareza": X, "aplicabilidade": X, "justificativa": "..."}}
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

### 3. Regression Evals (nao quebrar o que funcionava)

\`\`\`python
# Suite de evals que rodam a cada mudanca de prompt
EVAL_SUITE = [
    {
        'id': 'yaml-001',
        'input': 'Crie um Deployment YAML para nginx com 3 replicas',
        'eval_fn': eval_yaml_output,
        'expected': {'valid_yaml': True, 'has_apiVersion': True, 'has_kind': True}
    },
    {
        'id': 'class-001',
        'input': 'Classifique este alerta: CrashLoopBackOff em pod nginx-xxx',
        'eval_fn': lambda r: eval_alert_classification(r, 'critical'),
        'expected': True
    }
]

def run_regression_suite(prompt_version: str):
    results = []
    for eval_case in EVAL_SUITE:
        response = call_llm(prompt_version, eval_case['input'])
        score = eval_case['eval_fn'](response)
        passed = all(score.get(k) == v for k, v in eval_case['expected'].items()
                    if isinstance(eval_case['expected'], dict)) if isinstance(eval_case['expected'], dict) else score == eval_case['expected']
        results.append({'id': eval_case['id'], 'passed': passed, 'score': score})

    pass_rate = sum(1 for r in results if r['passed']) / len(results)
    return {'pass_rate': pass_rate, 'results': results}
\`\`\`

## Observabilidade com Langfuse

Langfuse e a principal ferramenta open-source para rastrear chamadas LLM em producao:

### Configuracao basica

\`\`\`python
from langfuse import Langfuse
from langfuse.decorators import observe, langfuse_context

langfuse = Langfuse(
    public_key=os.getenv("LANGFUSE_PUBLIC_KEY"),
    secret_key=os.getenv("LANGFUSE_SECRET_KEY"),
    host=os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com")
)
\`\`\`

### Rastreamento automatico

\`\`\`python
@observe()  # decorator automatico — rastreia input, output, latencia, custo
def analyze_alert(alert_text: str) -> dict:
    import anthropic
    client = anthropic.Anthropic()

    response = client.messages.create(
        model="claude-3-5-haiku-20241022",
        max_tokens=500,
        messages=[{
            "role": "user",
            "content": f"Classifique e analise este alerta Kubernetes: {alert_text}"
        }]
    )
    return {"analysis": response.content[0].text}
\`\`\`

### O que o Langfuse rastreia automaticamente

\`\`\`
Por chamada:
- Input (prompt enviado)
- Output (resposta recebida)
- Model (qual modelo foi usado)
- Latencia (tempo de resposta)
- Token count (input + output)
- Custo estimado (baseado no modelo)

Agregado:
- Latencia media / p95 / p99
- Taxa de erro
- Custo total por dia/semana
- Distribuicao de modelos usados
- Volume de chamadas por hora
\`\`\`

### Scores e feedback humano

\`\`\`python
# Adicionar score manual (ex: feedback de usuario)
langfuse.score(
    trace_id=trace_id,  # ID da chamada especifica
    name="quality",
    value=4.5,           # 1-5
    comment="Resposta precisa e acionavel"
)

# Score automatico de evals
langfuse.score(
    trace_id=trace_id,
    name="yaml_valid",
    value=1.0 if eval_result['valid_yaml'] else 0.0
)
\`\`\`

## Eval Gate em CI/CD

Integrar evals no pipeline de CI garante que mudancas de prompt nao degradem qualidade:

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
          # Falha o pipeline se pass rate < 85%

      - name: Upload Results to Langfuse
        run: |
          python scripts/upload_eval_results.py eval-results.json
\`\`\`

\`\`\`python
# scripts/check_eval_gate.py
import json, sys, argparse

def check_gate(results_file: str, min_pass_rate: float):
    with open(results_file) as f:
        results = json.load(f)

    passed = results['summary']['passed']
    total = results['summary']['total']
    pass_rate = passed / total

    print(f"Pass rate: {pass_rate:.1%} ({passed}/{total})")
    print(f"Minimum required: {min_pass_rate:.1%}")

    if pass_rate < min_pass_rate:
        print("GATE FAILED — prompts changes degraded eval quality")
        sys.exit(1)
    print("GATE PASSED")

parser = argparse.ArgumentParser()
parser.add_argument('results_file')
parser.add_argument('--min-pass-rate', type=float, default=0.85)
args = parser.parse_args()
check_gate(args.results_file, args.min_pass_rate)
\`\`\`

## Monitoramento de Custo e Latencia

\`\`\`python
# Wrapper para rastreamento de custo
import time
from dataclasses import dataclass

PRICING = {
    'claude-3-5-sonnet-20241022': {'input': 3.0, 'output': 15.0},    # per 1M tokens
    'claude-3-5-haiku-20241022': {'input': 0.25, 'output': 1.25},
    'gpt-4o': {'input': 2.5, 'output': 10.0},
    'gpt-4o-mini': {'input': 0.15, 'output': 0.6}
}

@dataclass
class LLMCallMetrics:
    model: str
    input_tokens: int
    output_tokens: int
    latency_ms: float

    @property
    def cost_usd(self) -> float:
        pricing = PRICING.get(self.model, {'input': 0, 'output': 0})
        return (self.input_tokens * pricing['input'] +
                self.output_tokens * pricing['output']) / 1_000_000

def tracked_llm_call(client, model: str, messages: list) -> tuple:
    start = time.time()
    response = client.messages.create(
        model=model, max_tokens=1000, messages=messages
    )
    latency_ms = (time.time() - start) * 1000

    metrics = LLMCallMetrics(
        model=model,
        input_tokens=response.usage.input_tokens,
        output_tokens=response.usage.output_tokens,
        latency_ms=latency_ms
    )
    return response.content[0].text, metrics
\`\`\`

## Prompt Regression Testing

\`\`\`python
# Comparar dois prompts lado a lado
def compare_prompts(prompt_a: str, prompt_b: str, test_cases: list):
    results = []
    for case in test_cases:
        response_a = call_llm(prompt_a, case['input'])
        response_b = call_llm(prompt_b, case['input'])

        # LLM juiz compara as duas respostas
        comparison = judge_compare(
            question=case['input'],
            response_a=response_a,
            response_b=response_b
        )
        results.append({
            'case_id': case['id'],
            'a_wins': comparison['winner'] == 'A',
            'b_wins': comparison['winner'] == 'B',
            'tie': comparison['winner'] == 'tie',
            'reasoning': comparison['reasoning']
        })

    a_wins = sum(1 for r in results if r['a_wins'])
    b_wins = sum(1 for r in results if r['b_wins'])
    print(f"Prompt A wins: {a_wins}/{len(results)}")
    print(f"Prompt B wins: {b_wins}/{len(results)}")
    return results
\`\`\`

## Erros Comuns

1. **Avaliar apenas no desenvolvimento** — o modelo muda, o prompt muda; avaliacao continua e necessaria
2. **Dataset de evals muito pequeno** — 5 casos nao sao representativos; minimo 50-100 para confiabilidade
3. **Evals sem casos de borda** — incluir inputs malformados, longos, em linguagens diferentes
4. **Nao versionar prompts** — mudancas de prompt sao mudancas de codigo; versionar e testar
5. **Ignorar latencia e custo** — um eval perfeito com custo 10x o esperado nao e aceitavel

## Killer.sh Style Challenge

> **Cenario:** Voce tem um sistema de classificacao de alertas Kubernetes usando Claude Haiku. O time quer migrar para um prompt novo (melhorado) mas teme regressoes. Descreva:
> 1. A suite de evals que voce criaria (tipos de alertas, metricas)
> 2. O eval gate no CI que aprovaria ou rejeitaria o novo prompt
> 3. Como usar Langfuse para comparar o prompt antigo vs novo em producao gradualmente
`,
  quiz: [
    {
      question: 'O que diferencia um "deterministic eval" de um "model-based eval" em sistemas LLM?',
      options: [
        'Deterministic eval usa GPU, model-based eval usa CPU',
        'Deterministic eval verifica criterios objetivos programaticos (YAML valido? JSON correto?); model-based eval usa outro LLM como juiz para avaliar qualidade subjetiva (precisao, completude, clareza)',
        'Deterministic eval e mais caro que model-based eval',
        'Nao ha diferenca pratica — ambos medem o mesmo'
      ],
      correct: 1,
      explanation: 'Deterministic evals sao automatizaveis com codigo: verificar se o YAML e valido, se o JSON tem os campos corretos, se a classificacao e a esperada. Model-based evals sao necessarios quando o criterio de qualidade e subjetivo: "a explicacao e clara?", "a sugestao e tecnicamente correta para um SRE?". Usar LLM como juiz para esses casos e uma pratica estabelecida.',
      reference: 'Combinacao ideal: use deterministic evals para o que pode ser verificado objetivamente, e model-based evals para qualidade e relevancia.'
    },
    {
      question: 'Por que um "eval gate" no CI/CD e critico ao modificar prompts de producao?',
      options: [
        'Para economizar tokens durante o desenvolvimento',
        'Para garantir que mudancas de prompt nao degradem a qualidade do output antes de ir para producao — da mesma forma que testes unitarios impedem regressoes de codigo',
        'Para cumprir requisitos regulatorios de AI',
        'Eval gates so sao necessarios para modelos GPT, nao para Claude'
      ],
      correct: 1,
      explanation: 'Prompts sao codigo. Uma mudanca de prompt aparentemente inofensiva pode melhorar um caso de uso e quebrar outro. Sem eval gate, voce so descobre esse problema em producao — depois que usuarios ja foram afetados. Um eval gate com suite de casos representativos e um threshold de pass rate garante que mudancas de prompt passem por validacao automatica, como qualquer outra mudanca de codigo.',
      reference: 'Analogia direta: eval gate para prompts = testes automatizados para codigo. Nao faz sentido ter um sem o outro em sistemas de producao.'
    },
    {
      question: 'O que o Langfuse rastreia automaticamente ao usar o decorator @observe() em uma funcao Python?',
      options: [
        'Apenas a latencia da chamada',
        'Input (prompt), output (resposta), modelo, latencia, contagem de tokens e custo estimado — sem codigo adicional alem do decorator',
        'Apenas erros e excecoes da funcao',
        'O Langfuse requer configuracao manual de cada metrica'
      ],
      correct: 1,
      explanation: 'O decorator @observe() do Langfuse instrumenta automaticamente a funcao e rastreia: o input completo passado, o output retornado, qual modelo foi usado, latencia da chamada, tokens consumidos (input + output), e custo estimado com base nos precos do modelo. Isso elimina a necessidade de codigo de instrumentacao manual para cada chamada.',
      reference: 'Dica: o Langfuse tambem rastreia spans aninhados — se uma funcao chama outra que chama outra, toda a arvore de chamadas e rastreada como uma "trace".'
    },
    {
      question: 'Qual e a estrategia correta para criar um dataset de evals para um sistema de triagem de alertas Kubernetes?',
      options: [
        'Criar 5-10 exemplos simples e positivos que o sistema claramente acerta',
        'Criar 50-100+ casos incluindo alertas criticos, alertas de aviso, alertas ambiguos, inputs malformados e casos de borda — com ground truth definido por especialistas',
        'Usar o mesmo dataset de treinamento do modelo',
        'Pedir ao modelo para gerar os proprios casos de eval'
      ],
      correct: 1,
      explanation: 'Um dataset de evals eficaz deve: (1) ser grande o suficiente (50+ casos para confiabilidade estatistica); (2) cobrir a distribuicao real de inputs, nao apenas casos faceis; (3) incluir casos de borda e inputs problematicos; (4) ter ground truth definido por especialistas humanos, nao pelo proprio modelo. Datasets pequenos ou so de casos positivos dao falsa confianca na qualidade do sistema.',
      reference: 'Pratica adicional: atualizar o dataset de evals quando surgem novos tipos de alertas em producao — evals sao vivos, nao estaticos.'
    },
    {
      question: 'Como calcular o custo de uma chamada LLM dado o modelo e o numero de tokens?',
      options: [
        'Custo = tokens_totais * preco_fixo_por_token',
        'Custo = (tokens_input * preco_input + tokens_output * preco_output) / 1_000_000',
        'O custo e sempre o mesmo independente do modelo',
        'Custo = numero_de_chamadas * preco_por_requisicao'
      ],
      correct: 1,
      explanation: 'A formula correta e: custo = (tokens_input * preco_input_por_M + tokens_output * preco_output_por_M) / 1_000_000. Tokens de input e output tem precos diferentes — output geralmente custa 4-6x mais que input. Exemplo com Claude Haiku: 1000 tokens input + 500 tokens output = (1000 * 0.25 + 500 * 1.25) / 1M = $0.00000875. Acumula significativamente em escala.',
      reference: 'Dica de otimizacao: output tokens sao mais caros — prompts que pedem respostas longas custam proporcionalmente mais. Especificar "resposta concisa" pode reduzir custo.'
    },
    {
      question: 'O que significa um score de "faithfulness" baixo (0.4) no RAGAS para um sistema RAG de runbooks?',
      options: [
        'Os documentos indexados estao desatualizados',
        'O LLM esta gerando informacoes nao suportadas pelos documentos recuperados — respondendo alem do que os runbooks reais dizem',
        'O modelo de embedding esta com problemas',
        'A latencia do sistema esta alta demais'
      ],
      correct: 1,
      explanation: 'Faithfulness de 0.4 em um sistema de runbooks e critico: significa que 60% das afirmacoes nas respostas nao sao suportadas pelos documentos recuperados. O LLM esta "completando com treinamento" em vez de responder apenas com base nos runbooks. Em um contexto de infra, isso pode resultar em procedimentos incorretos que diferem dos runbooks reais da empresa.',
      reference: 'Solucao para faithfulness baixo: usar prompt mais restritivo ("responda APENAS com base nos documentos fornecidos, nao adicione informacoes externas") e/ou reduzir temperatura para 0.0.'
    },
    {
      question: 'Como o "prompt comparison" (A/B test de prompts) deve ser implementado de forma rigurosa?',
      options: [
        'Testar o prompt novo manualmente por uma hora e decidir subjetivamente',
        'Usar um conjunto fixo de casos de teste, avaliar ambos os prompts nos mesmos casos com LLM juiz ou metricas deterministicas, e decidir com base em metricas objetivas',
        'Mostrar o prompt novo para o usuario final e coletar feedback',
        'Escolher o prompt mais curto para economizar tokens'
      ],
      correct: 1,
      explanation: 'Comparacao rigorosa de prompts requer: (1) conjunto fixo de casos de teste — os mesmos para ambos os prompts; (2) avaliacao objetiva com LLM juiz ou metricas deterministicas; (3) multiplas rodadas para compensar nao-determinismo; (4) analise estatistica de quais casos cada prompt vence. Comparacao subjetiva ou informal e insuficiente para sistemas de producao.',
      reference: 'Ferramenta: Langfuse permite fazer experimentos de A/B test de prompts com rastreamento automatico de qual versao produziu qual resultado.'
    }
  ],
  flashcards: [
    {
      front: 'LLM Harness — o que e e por que importa',
      back: '**Definicao:**\nFramework de avaliacao + observabilidade +\ncontrole de qualidade para sistemas LLM.\n\n**Analogia:**\n`Prompts = codigo` → precisam de testes\nComo voce testaria codigo sem tests?\n\n**Tipos de avaliacao:**\n\n**Deterministic Evals**\n- Output tem resposta certa/errada\n- YAML valido? JSON com campos corretos?\n- Classificacao = expected label?\n\n**Model-based Evals (LLM-as-judge)**\n- Qualidade subjetiva\n- Precisao tecnica, clareza, utilidade\n- Outro LLM avalia o output\n\n**Regression Evals**\n- Suite que roda a cada mudanca\n- Garante que o que funcionava continua\n\n**Eval Gate no CI:**\nBloqueia merge se pass rate < threshold'
    },
    {
      front: 'Langfuse — observabilidade para LLMs',
      back: '**O que e:**\nObservabilidade open-source para sistemas LLM.\nRastreia todas as chamadas automaticamente.\n\n**Setup:**\n\`\`\`python\nfrom langfuse.decorators import observe\n\n@observe()  # rastreia automaticamente\ndef minha_funcao(input):\n    response = client.messages.create(...)\n    return response\n\`\`\`\n\n**O que rastreia por chamada:**\n- Input e output completos\n- Modelo usado\n- Latencia (ms)\n- Tokens (input + output)\n- Custo estimado\n\n**Metricas agregadas:**\n- Latencia media / p95 / p99\n- Custo por dia/semana\n- Volume de chamadas\n- Distribuicao de modelos\n\n**Scores:**\n\`\`\`python\nlangfuse.score(trace_id=id,\n  name="quality", value=4.5)\n\`\`\`'
    },
    {
      front: 'Eval Gate no CI/CD para prompts',
      back: '**Pipeline:**\n\`\`\`yaml\n# .github/workflows/llm-eval.yaml\non:\n  pull_request:\n    paths: [\'prompts/**\']\n\njobs:\n  eval:\n    steps:\n    - name: Run Eval Suite\n      run: python -m pytest tests/evals/\n    \n    - name: Check Pass Rate\n      run: python check_gate.py --min-pass-rate 0.85\n      # Falha o PR se pass rate < 85%\n\`\`\`\n\n**O que a suite deve cobrir:**\n- Casos normais (distribuicao real)\n- Casos criticos (alta severidade)\n- Casos ambiguos (borderline)\n- Inputs malformados (robustez)\n- Casos de borda (extremos)\n\n**Threshold tipico:**\n- 85% pass rate para merge\n- 95% pass rate para deploy em prod\n\n**Versionar prompts:**\nPrompts em arquivos no repositorio,\ntratados como codigo.'
    },
    {
      front: 'Calculo de custo LLM',
      back: '**Formula:**\n`custo = (tokens_in * preco_in + tokens_out * preco_out) / 1_000_000`\n\n**Precos (Mai/2024):**\n| Modelo | In (/M) | Out (/M) |\n|--------|---------|----------|\n| Cl Sonnet | $3 | $15 |\n| Cl Haiku | $0.25 | $1.25 |\n| GPT-4o | $2.5 | $10 |\n| GPT-4o mini | $0.15 | $0.6 |\n\n**Exemplos:**\n- 1000 alertas com Haiku (500in+200out):\n  (500000*0.25 + 200000*1.25)/1M = $0.375\n\n- 100 reviews de PR com Sonnet (2000in+500out):\n  (200000*3 + 50000*15)/1M = $1.35\n\n**Regra de otimizacao:**\n1. Valide com modelo caro\n2. Teste com modelo barato\n3. Producao com modelo barato\n4. Monitor custo com Langfuse'
    },
    {
      front: 'Dataset de Evals — boas praticas',
      back: '**Tamanho minimo:**\n- POC: 20-30 casos\n- Producao: 100+ casos\n- Alta criicidade: 500+ casos\n\n**Distribuicao dos casos:**\n- 50% casos tipicos (distribuicao real)\n- 25% casos criticos ou de alta severidade\n- 15% casos ambiguos (borderline)\n- 10% casos de borda e inputs problematicos\n\n**O que nao fazer:**\n❌ So casos faceis que voce sabe que passam\n❌ Dataset estatico que nunca e atualizado\n❌ Ground truth definido pelo proprio modelo\n❌ Sem casos negativos (inputs incorretos)\n\n**Estrutura de um eval case:**\n\`\`\`python\n{\n  "id": "alert-001",\n  "input": "texto do alerta",\n  "expected": "critical",\n  "tags": ["crashloop", "production"],\n  "created_by": "oncall-sre",\n  "created_at": "2024-01-15"\n}\n\`\`\`'
    },
    {
      front: 'A/B Test de Prompts — metodologia',
      back: '**Por que fazer:**\nAntes de mudar um prompt em producao,\nvalidar que a nova versao e melhor.\n\n**Metodologia:**\n1. Definir conjunto fixo de casos de teste\n2. Rodar AMBOS os prompts nos mesmos casos\n3. Avaliar com LLM juiz ou metricas det.\n4. Contar "wins": qual prompt ganhou em cada caso\n5. Decidir com base nos dados\n\n**Codigo de comparacao:**\n\`\`\`python\nfor case in test_cases:\n    r_a = call_llm(prompt_a, case["input"])\n    r_b = call_llm(prompt_b, case["input"])\n    winner = judge(case["input"], r_a, r_b)\n    # "A", "B" ou "tie"\n\`\`\`\n\n**Cuidados:**\n- Rodar 3x cada caso (nao-deterministico)\n- Avaliar tambem latencia e custo\n- Reportar resultados por categoria\n\n**Com Langfuse:**\nExperimentos de prompt com rastreamento\nautomatico de qual versao produziu o que.'
    }
  ],
  lab: {
    scenario: 'Voce tem um sistema de classificacao de alertas Kubernetes que usa Claude Haiku. Vai implementar um harness completo: suite de evals, avaliacao com LLM juiz, e rastreamento com Langfuse — garantindo confianca em futuras mudancas.',
    objective: 'Implementar um LLM harness funcional com evals deterministicos, model-based evals com LLM juiz, e observabilidade basica — para garantir qualidade em sistemas de producao.',
    duration: '35-45 minutos',
    steps: [
      {
        title: 'Configurar o ambiente e instalar dependencias',
        instruction: `Instale as dependencias necessarias e configure as credenciais para o harness de avaliacao. Vamos usar Anthropic API e Langfuse para observabilidade.`,
        hints: [
          'Langfuse tem um tier gratuito em cloud.langfuse.com',
          'Para o lab, podemos simular sem API key real usando um mock',
          'Instale: anthropic, langfuse, pytest'
        ],
        solution: `\`\`\`bash
# Criar projeto
mkdir llm-harness && cd llm-harness

# Instalar dependencias
pip install anthropic langfuse pytest pytest-json-report pyyaml

# Criar estrutura
mkdir -p src tests/evals data

# Criar arquivo .env (substitua com suas credenciais reais)
cat > .env << 'EOF'
ANTHROPIC_API_KEY=sk-ant-xxx  # substitua com sua key real
LANGFUSE_PUBLIC_KEY=pk-lf-xxx  # em cloud.langfuse.com
LANGFUSE_SECRET_KEY=sk-lf-xxx
LANGFUSE_HOST=https://cloud.langfuse.com
EOF

# Criar o sistema de classificacao de alertas (o que vamos testar)
cat > src/alert_classifier.py << 'EOF'
import os
import anthropic

CLASSIFICATION_PROMPT = """Voce e um SRE especialista em Kubernetes.
Classifique o alerta abaixo em uma das categorias:
- critical: requer atencao imediata (impacto em producao)
- warning: requer atencao em breve (potencial impacto)
- info: informativo (sem impacto imediato)

Alerta: {alert}

Retorne APENAS a categoria (critical, warning, ou info), nada mais."""

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
# Verificar instalacao
python3 -c "import anthropic; import langfuse; import pytest; print('OK')"
# Saida esperada: OK

# Verificar estrutura do projeto
ls -R llm-harness/
# Saida esperada:
# src/  tests/  data/  .env
# src/alert_classifier.py

python3 -c "from src.alert_classifier import classify_alert; print('Import OK')"
# Saida esperada: Import OK
\`\`\``
      },
      {
        title: 'Criar suite de evals deterministicos',
        instruction: `Crie uma suite de evals com casos de teste para o classificador de alertas. Inclua casos criticos, warnings, infos e casos ambiguos.`,
        hints: [
          'Use pytest para estruturar os evals',
          'Inclua pelo menos 15 casos cobrindo diferentes tipos',
          'Casos ambiguos sao importantes para testar robustez'
        ],
        solution: `\`\`\`python
# data/eval_cases.json
import json

eval_cases = [
    # Criticos
    {"id": "crit-001", "input": "Pod payments-api-xxx em CrashLoopBackOff no namespace production", "expected": "critical", "tags": ["crashloop", "prod"]},
    {"id": "crit-002", "input": "Node worker-3 em NotReady, 15 pods evicted", "expected": "critical", "tags": ["node", "eviction"]},
    {"id": "crit-003", "input": "OOMKilled em container database-proxy, memoria esgotada", "expected": "critical", "tags": ["oom", "memory"]},
    {"id": "crit-004", "input": "PersistentVolume bound falhou, dados do PostgreSQL inacessiveis", "expected": "critical", "tags": ["storage", "database"]},
    {"id": "crit-005", "input": "Deployment auth-service com 0 replicas disponiveis em producao", "expected": "critical", "tags": ["deployment", "zero-replicas"]},
    # Warnings
    {"id": "warn-001", "input": "Pod restart count 5 nas ultimas 2 horas, servico ainda operacional", "expected": "warning", "tags": ["restart", "operational"]},
    {"id": "warn-002", "input": "CPU throttling em 85% em container api-gateway", "expected": "warning", "tags": ["cpu", "throttling"]},
    {"id": "warn-003", "input": "PVC com 80% de uso, crescimento de 5GB/dia detectado", "expected": "warning", "tags": ["storage", "capacity"]},
    {"id": "warn-004", "input": "HPA nao consegue escalar, limite de replicas atingido", "expected": "warning", "tags": ["hpa", "scaling"]},
    {"id": "warn-005", "input": "Certificate expiracao em 7 dias para dominio api.example.com", "expected": "warning", "tags": ["cert", "expiry"]},
    # Infos
    {"id": "info-001", "input": "Pod scheduled em node worker-2, aguardando inicio do container", "expected": "info", "tags": ["scheduling"]},
    {"id": "info-002", "input": "HPA escalonou de 3 para 5 replicas em resposta ao aumento de trafego", "expected": "info", "tags": ["scaling", "autoscale"]},
    {"id": "info-003", "input": "Deployment frontend atualizado para versao v2.1.0", "expected": "info", "tags": ["deploy", "update"]},
    # Edge cases
    {"id": "edge-001", "input": "ALERTA CRITICO!!! tudo caiu!!!", "expected": "critical", "tags": ["malformed"]},
    {"id": "edge-002", "input": "warning: low disk", "expected": "warning", "tags": ["minimal-info"]},
]

with open('data/eval_cases.json', 'w') as f:
    json.dump(eval_cases, f, indent=2, ensure_ascii=False)
print(f"Criados {len(eval_cases)} casos de eval")
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
        f"ID: {case['id']} | Expected: {case['expected']} | Got: {result} | Input: {case['input'][:50]}"
\`\`\``,
        verify: `\`\`\`bash
# Criar o arquivo JSON de eval cases
python3 - << 'EOF'
import json
# usar o codigo acima para criar o arquivo
print("Arquivo criado")
EOF

ls data/eval_cases.json
# Saida esperada: data/eval_cases.json

python3 -c "import json; cases = json.load(open('data/eval_cases.json')); print(f'{len(cases)} casos')"
# Saida esperada: 15 casos (ou mais)
\`\`\``
      },
      {
        title: 'Implementar model-based eval com LLM juiz',
        instruction: `Crie um avaliador que usa um LLM como juiz para avaliar a qualidade das respostas em dimensoes como precisao tecnica e clareza.`,
        hints: [
          'Use o modelo mais capaz como juiz (Sonnet) avaliando o modelo menos capaz (Haiku)',
          'Force output JSON para analise programatica',
          'Temperatura 0.0 para o juiz para consistencia'
        ],
        solution: `\`\`\`python
# src/llm_judge.py
import json
import os
import anthropic

JUDGE_PROMPT = """Voce e um SRE senior avaliando a qualidade de um sistema automatizado de triagem de alertas Kubernetes.

Alerta recebido: {alert}
Classificacao gerada: {classification}
Classificacao correta: {expected}

Avalie a qualidade da resposta nos seguintes criterios (1-5):
1. Precisao: a classificacao esta correta para a criticidade do alerta?
2. Consistencia: a classificacao seria a mesma para alertas similares?

Retorne APENAS este JSON, sem texto adicional:
{{"precisao": <1-5>, "consistencia": <1-5>, "correto": <true|false>, "justificativa": "<max 50 chars>"}}"""

def judge_classification(alert: str, classification: str, expected: str) -> dict:
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    response = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=200,
        temperature=0.0,
        messages=[{"role": "user", "content": JUDGE_PROMPT.format(
            alert=alert,
            classification=classification,
            expected=expected
        )}]
    )
    return json.loads(response.content[0].text)

# Script de avaliacao completa
if __name__ == '__main__':
    import sys
    sys.path.insert(0, '.')
    from src.alert_classifier import classify_alert

    test_cases = [
        {"input": "Pod em CrashLoopBackOff em producao", "expected": "critical"},
        {"input": "CPU throttling em 85%", "expected": "warning"},
        {"input": "Pod scheduled com sucesso", "expected": "info"},
    ]

    print("Executando model-based evals...\\n")
    scores = []
    for case in test_cases:
        classification = classify_alert(case['input'])
        judgment = judge_classification(case['input'], classification, case['expected'])
        scores.append(judgment)
        print(f"Input: {case['input'][:50]}")
        print(f"Classificado: {classification} | Esperado: {case['expected']}")
        print(f"Juiz: precisao={judgment['precisao']}/5, correto={judgment['correto']}")
        print(f"Justificativa: {judgment['justificativa']}\\n")

    avg_score = sum(s['precisao'] for s in scores) / len(scores)
    accuracy = sum(1 for s in scores if s['correto']) / len(scores)
    print(f"Media de precisao: {avg_score:.1f}/5")
    print(f"Acuracia: {accuracy:.1%}")
\`\`\`

\`\`\`bash
# Executar os model-based evals (requer ANTHROPIC_API_KEY valida)
python3 src/llm_judge.py
\`\`\``,
        verify: `\`\`\`bash
# Verificar que o arquivo do juiz existe
ls src/llm_judge.py
# Saida esperada: src/llm_judge.py

# Verificar o import
python3 -c "from src.llm_judge import judge_classification; print('Import OK')"
# Saida esperada: Import OK

# Se tiver API key, testar com um caso simples
# python3 -c "
# from src.llm_judge import judge_classification
# result = judge_classification('Pod em CrashLoopBackOff', 'critical', 'critical')
# print(result)
# "
# Saida esperada: {'precisao': X, 'consistencia': X, 'correto': True, 'justificativa': '...'}
echo "Setup do LLM judge verificado"
\`\`\``
      },
      {
        title: 'Implementar rastreamento com Langfuse',
        instruction: `Adicione observabilidade ao sistema de classificacao usando Langfuse. Rastreie latencia, custo e scores de qualidade.`,
        hints: [
          'Use o decorator @observe() para instrumentacao automatica',
          'Adicione scores manualmente apos a avaliacao',
          'Langfuse tem tier gratuito em cloud.langfuse.com'
        ],
        solution: `\`\`\`python
# src/observed_classifier.py
import os
import time
import anthropic
from langfuse.decorators import observe, langfuse_context
from langfuse import Langfuse

# Modelo de preco para calculo de custo
PRICING = {
    'claude-3-5-haiku-20241022': {'input': 0.25, 'output': 1.25},
    'claude-3-5-sonnet-20241022': {'input': 3.0, 'output': 15.0},
}

langfuse = Langfuse(
    public_key=os.getenv("LANGFUSE_PUBLIC_KEY", "mock"),
    secret_key=os.getenv("LANGFUSE_SECRET_KEY", "mock"),
    host=os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com")
)

CLASSIFICATION_PROMPT = """Classifique o alerta Kubernetes em: critical, warning, ou info.
Alerta: {alert}
Retorne APENAS a categoria."""

@observe(name="classify_alert_observed")
def classify_alert_observed(alert_text: str) -> dict:
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    model = "claude-3-5-haiku-20241022"

    start = time.time()
    response = client.messages.create(
        model=model,
        max_tokens=10,
        temperature=0.0,
        messages=[{"role": "user", "content": CLASSIFICATION_PROMPT.format(alert=alert_text)}]
    )
    latency_ms = (time.time() - start) * 1000

    classification = response.content[0].text.strip().lower()

    # Calcular custo
    in_tokens = response.usage.input_tokens
    out_tokens = response.usage.output_tokens
    cost = (in_tokens * PRICING[model]['input'] + out_tokens * PRICING[model]['output']) / 1_000_000

    # Adicionar metadata ao trace
    langfuse_context.update_current_observation(
        input=alert_text,
        output=classification,
        metadata={
            "model": model,
            "latency_ms": round(latency_ms, 2),
            "input_tokens": in_tokens,
            "output_tokens": out_tokens,
            "cost_usd": round(cost, 8)
        }
    )

    return {
        "classification": classification,
        "latency_ms": round(latency_ms, 2),
        "cost_usd": round(cost, 8),
        "tokens": in_tokens + out_tokens
    }

if __name__ == '__main__':
    test_alerts = [
        "Pod payments-api em CrashLoopBackOff em producao",
        "CPU throttling detectado em api-gateway",
        "Pod scheduled com sucesso no node worker-1",
    ]

    print("Testando com observabilidade Langfuse:\\n")
    for alert in test_alerts:
        result = classify_alert_observed(alert)
        print(f"Alerta: {alert[:50]}")
        print(f"Classificacao: {result['classification']}")
        print(f"Latencia: {result['latency_ms']:.0f}ms | Custo: \${result['cost_usd']:.8f}\\n")

    print("Traces enviados para Langfuse (verifique cloud.langfuse.com)")
\`\`\`

\`\`\`bash
python3 src/observed_classifier.py
\`\`\``,
        verify: `\`\`\`bash
# Verificar o arquivo
ls src/observed_classifier.py
# Saida esperada: src/observed_classifier.py

# Verificar imports
python3 -c "from src.observed_classifier import classify_alert_observed; print('Import OK')"

# Resumo do harness criado
echo "=== LLM Harness Completo ==="
echo "src/alert_classifier.py  - Sistema principal"
echo "src/llm_judge.py         - Model-based evals"
echo "src/observed_classifier.py - Com observabilidade"
echo "tests/evals/             - Suite de evals deterministicos"
echo "data/eval_cases.json     - 15 casos de eval"
echo ""
echo "Para rodar a suite completa:"
echo "pytest tests/evals/ -v"
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Suite de evals com alta taxa de falsos negativos (muitos casos "passando" mas qualidade ruim)',
      difficulty: 'medium',
      symptom: 'A suite de evals mostra 90% de pass rate mas em producao os usuarios reclamam de respostas incorretas. Os casos de eval passam mas nao refletem os problemas reais.',
      diagnosis: `\`\`\`bash
# 1. Analisar a distribuicao dos casos de eval
python3 - << 'EOF'
import json
with open('data/eval_cases.json') as f:
    cases = json.load(f)

from collections import Counter
dist = Counter(c['expected'] for c in cases)
print("Distribuicao de labels:", dict(dist))
# Se muito desbalanceado: casos faceis dominam a suite

tags = Counter(tag for c in cases for tag in c.get('tags', []))
print("Tags mais comuns:", tags.most_common(10))
# Se so tem casos simples, faltam casos de borda
EOF

# 2. Verificar se os casos de borda estao cobrindo inputs reais
# Comparar com os logs de producao (se disponivel)

# 3. Rodar o classifier nos inputs reais problemáticos manualmente
\`\`\``,
      solution: `**Causa:** dataset de evals nao representa a distribuicao real de producao.

**Solucao 1 — Adicionar casos do "mundo real":**
\`\`\`python
# Capturar inputs reais de producao que causaram problemas
# Adicionar ao dataset com ground truth correto

bad_cases_from_prod = [
    {
        "id": "prod-001",
        "input": "<alerta real que causou erro>",
        "expected": "<label correto>",
        "tags": ["production", "regression"]
    }
]
\`\`\`

**Solucao 2 — Balancear a distribuicao:**
- Garantir que cada categoria tem proporcao adequada
- Incluir mais casos ambiguos (onde a fronteira e unclear)

**Solucao 3 — Adicionar casos de "adversarial inputs":**
\`\`\`python
adversarial_cases = [
    {"input": "tudo bom", "expected": "info"},           # muito vago
    {"input": "ALERTA CRITICO " * 20, "expected": "critical"},  # muito longo
    {"input": "", "expected": "info"},                   # vazio
]
\`\`\`

**Solucao 4 — Monitoramento continuo:**
Usar Langfuse para identificar inputs de producao onde o
score de qualidade e baixo e adicioná-los ao dataset de evals.`
    },
    {
      title: 'Langfuse nao esta rastreando os traces',
      difficulty: 'easy',
      symptom: 'O codigo com @observe() roda sem erros mas nenhum trace aparece no dashboard do Langfuse. Ou o decorator causa erros de autenticacao.',
      diagnosis: `\`\`\`bash
# 1. Verificar as credenciais
python3 - << 'EOF'
import os
print("PUBLIC_KEY:", os.getenv("LANGFUSE_PUBLIC_KEY", "NAO DEFINIDA"))
print("SECRET_KEY:", "DEFINIDA" if os.getenv("LANGFUSE_SECRET_KEY") else "NAO DEFINIDA")
print("HOST:", os.getenv("LANGFUSE_HOST", "NAO DEFINIDA"))
EOF

# 2. Testar conexao direta com o Langfuse
python3 - << 'EOF'
from langfuse import Langfuse
lf = Langfuse()
try:
    lf.auth_check()
    print("Autenticacao OK")
except Exception as e:
    print(f"Erro de autenticacao: {e}")
EOF

# 3. Verificar se ha flush pendente
# Traces sao enviados em batch — verificar se o flush esta sendo chamado
\`\`\``,
      solution: `**Causa comum 1 — Variaveis de ambiente nao carregadas:**
\`\`\`bash
# Carregar o .env explicitamente
pip install python-dotenv

# No inicio do script:
from dotenv import load_dotenv
load_dotenv()
\`\`\`

**Causa comum 2 — Flush nao chamado:**
\`\`\`python
# Traces sao enviados em batch — chamar flush ao final
from langfuse import Langfuse
langfuse = Langfuse()

# ... seu codigo ...

# Ao final do script/processo:
langfuse.flush()
# Ou usar o context manager
\`\`\`

**Causa comum 3 — Credenciais erradas:**
\`\`\`bash
# Verificar no dashboard: Settings → API Keys
# Public key começa com "pk-lf-"
# Secret key começa com "sk-lf-"
echo \$LANGFUSE_PUBLIC_KEY | head -c 8  # Deve ser "pk-lf-"
\`\`\`

**Causa comum 4 — Versao incompativel do SDK:**
\`\`\`bash
pip install langfuse --upgrade
# Verificar versao: pip show langfuse
\`\`\``
    }
  ]
};
