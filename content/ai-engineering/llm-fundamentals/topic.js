window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['ai-engineering/llm-fundamentals'] = {
  theory: `
# Fundamentos Práticos de LLMs para Engenheiros

## Relevancia
Voce nao precisa entender o interior de uma rede neural para usar LLMs de forma eficaz. Este topico cobre o que um DevOps/SRE/Platform Engineer precisa saber para tirar valor real de ferramentas como Claude, GPT-4, Gemini e modelos open-source — sem a teoria academica desnecessaria.

## Como os LLMs funcionam (o suficiente para usar bem)

### O modelo como funcao de texto

Um LLM recebe texto como entrada e produz texto como saida. A ideia e simples — a complexidade fica no treinamento, que nao e sua responsabilidade. O que importa para voce:

\`\`\`
Input (prompt) ──► [LLM] ──► Output (completion)
\`\`\`

**Tokens, nao palavras:** LLMs processam tokens, nao palavras. Um token e aproximadamente 4 caracteres ou 3/4 de uma palavra em ingles. Em portugues, tokens tendem a ser menores por causa de acentos e palavras mais longas.

\`\`\`
"kubectl get pods" = ~4 tokens
"apiVersion: apps/v1" = ~6 tokens
Um arquivo YAML de 100 linhas ≈ 400-600 tokens
\`\`\`

**Por que importa:** a janela de contexto (context window) tem um limite de tokens. Se voce mandar um arquivo de 50.000 linhas para um modelo com janela de 128k tokens, vai ter problema.

### Janela de Contexto — o que cabe na "memoria" do modelo

| Modelo | Context Window | O que cabe |
|--------|---------------|-----------|
| GPT-4o | 128k tokens | ~100 arquivos de codigo medios |
| Claude 3.5 Sonnet | 200k tokens | ~150 arquivos ou um repositorio inteiro pequeno |
| Claude 3.5 Haiku | 200k tokens | Mesmo, mas mais rapido e barato |
| Gemini 1.5 Pro | 1M tokens | Repositorios grandes completos |
| Llama 3.1 (local) | 128k tokens | Similar ao GPT-4o |

**Regra pratica:** coloque apenas o contexto relevante. Mandar um repositorio inteiro quando voce quer ajuda com um arquivo especifico piora a qualidade da resposta.

### Temperatura — criatividade vs determinismo

A temperatura controla o quanto o modelo "arrisca" nas respostas:

\`\`\`
Temperatura 0.0 → Sempre escolhe a opcao mais provavel. Deterministico.
              → Use para: geracao de YAML, codigo, comandos kubectl

Temperatura 0.7 → Balanco entre criatividade e confiabilidade
              → Use para: documentacao, explicacoes, respostas gerais

Temperatura 1.0+ → Alta variabilidade, mais "criativo"
               → Use para: brainstorming, geracao de opcoes
\`\`\`

Na pratica, a maioria dos modelos modernos ja vem com temperatura default razoavel e voce raramente precisa ajustar manualmente.

## Os Modelos — Quando Usar Cada Um

### Para uso via ferramentas (Copilot, Claude Code, etc.)

Voce nao escolhe o modelo — a ferramenta escolhe. Entender as caracteristicas ajuda a calibrar expectativas.

### Para uso via API (quando voce integra diretamente)

\`\`\`
Claude 3.5 Sonnet   → Melhor custo-beneficio para tarefas complexas de infra
                      Bom em: YAML, raciocinio, seguir instrucoes precisas
                      Preco: ~$3/M input tokens, $15/M output tokens

Claude 3.5 Haiku    → Rapido e barato para tarefas simples
                      Bom em: classificacao, respostas curtas, pipelines
                      Preco: ~$0.25/M input tokens, $1.25/M output tokens

GPT-4o              → Forte em codigo, multimodal (imagens)
                      Preco: ~$2.50/M input tokens, $10/M output tokens

GPT-4o mini         → Alternativa barata ao Haiku
                      Preco: ~$0.15/M input tokens, $0.60/M output tokens

Gemini 1.5 Pro      → Janela de contexto enorme (1M tokens)
                      Ideal quando voce precisa passar repositorios inteiros

Llama 3.1 (local)   → Zero custo, privacidade total, mas requer GPU
                      Bom para: dados sensiveis que nao podem sair da empresa
\`\`\`

**Regra para escolher:**
- Tarefa complexa com raciocinio → Claude Sonnet ou GPT-4o
- Volume alto, tarefa simples → Claude Haiku ou GPT-4o mini
- Dados sensiveis → modelo local (Llama via Ollama)
- Repositorio gigante → Gemini 1.5 Pro

## Prompt Engineering para Contextos Tecnicos

### A estrutura que funciona

\`\`\`
[Papel]        → Quem o modelo deve ser
[Contexto]     → Informacoes relevantes sobre o ambiente
[Tarefa]       → O que voce quer que ele faca
[Constraints]  → Restricoes e formato de saida
[Exemplos]     → (opcional) exemplos de input/output
\`\`\`

\`\`\`
Exemplo ruim:
"escreve um yaml do kubernetes pra mim"

Exemplo bom:
"Voce e um especialista em Kubernetes 1.29.
Contexto: cluster EKS com Karpenter como node autoscaler.
Preciso de um Deployment YAML para uma API Node.js com:
- 2 replicas, HPA configurado (min 2, max 10, CPU 70%)
- Liveness probe em /health, readiness em /ready
- Resources: request 100m/128Mi, limit 500m/512Mi
- Label app: user-api e version: v1
Retorne apenas o YAML, sem explicacoes."
\`\`\`

### Tecnicas essenciais

**Chain of Thought — pedir raciocinio passo a passo**
\`\`\`
"Antes de responder, pense passo a passo:
1. Qual e o problema?
2. Quais sao as causas possiveis?
3. Como diagnosticar cada uma?
Depois escreva o script de diagnostico."
\`\`\`
Use quando: debugging complexo, troubleshooting, analise de causa raiz.

**Few-shot — dar exemplos**
\`\`\`
"Converta esses comandos kubectl em recursos YAML:

Exemplo 1:
Input: kubectl create deployment nginx --image=nginx --replicas=3
Output:
apiVersion: apps/v1
kind: Deployment
...

Agora converta este:
kubectl create deployment api --image=myapp:v2 --replicas=5"
\`\`\`

**Persona tecnica — definir o perfil do "especialista"**
\`\`\`
"Voce e um SRE senior com 10 anos de experiencia em Kubernetes em producao.
Ao responder, seja direto, use exemplos reais, e aponte os erros mais comuns
que iniciantes cometem neste topico."
\`\`\`

**Output estruturado — forcar formato especifico**
\`\`\`
"Retorne a resposta APENAS neste formato JSON, sem texto adicional:
{
  'causa': 'string',
  'diagnostico': ['comando1', 'comando2'],
  'solucao': 'string',
  'prevencao': 'string'
}"
\`\`\`

### Limitacoes que voce precisa conhecer

**1. Knowledge cutoff — o modelo nao sabe o que aconteceu depois do treinamento**
- Claude 3.5: conhecimento ate ~abril 2024
- GPT-4o: conhecimento ate ~outubro 2023
- Consequencia: versoes recentes de ferramentas podem estar erradas

\`\`\`bash
# Sempre verificar versoes sugeridas pelo LLM
# Em vez de confiar cegamente:
helm search repo bitnami/redis --versions | head -5
kubectl version --short
\`\`\`

**2. Alucinacao — o modelo inventa com confianca**
- APIs que nao existem, flags que nao funcionam, referencias falsas
- Mitigacao: sempre testar comandos em ambiente seguro primeiro
- Dica: pedir que o modelo indique o que ele nao tem certeza

**3. Contexto perdido em conversas longas**
- Modelos "esquecem" o inicio de conversas muito longas
- Solucao: iniciar nova conversa para tarefas novas; incluir contexto critico no inicio

**4. Saidas nao deterministicas**
- O mesmo prompt pode gerar respostas diferentes
- Nao confie em saidas criticas sem verificacao

## Custos — Ordem de Grandeza

\`\`\`
1 arquivo YAML complexo (2000 tokens) ≈ $0.006 com Sonnet
1000 chamadas de analise de log        ≈ $3-15 dependendo do modelo
Pipeline CI/CD com 100 reviews/dia     ≈ $5-50/mes dependendo do modelo
RAG system com 1M queries/mes          ≈ $100-500

Regra: comece com modelos caros pra validar que funciona,
depois otimize com modelos mais baratos.
\`\`\`

## Erros Comuns

1. **Contexto excessivo** — mandar logs de 50.000 linhas sem filtrar degrada a qualidade
2. **Prompt vago** — "melhora esse script" sem dizer o que esta errado ou o que "melhor" significa
3. **Confiar sem verificar** — comandos sugeridos por LLM devem ser testados antes de rodar em producao
4. **Usar modelo errado para a tarefa** — GPT-4o para classificar 10.000 alertas e caro; use Haiku
5. **Nao iterar no prompt** — prompts raros funcionam na primeira tentativa; refinar e normal

## Killer.sh Style Challenge

> **Cenario:** Voce recebe um arquivo de 800 linhas de YAML de um HelmRelease quebrado e precisa de ajuda do LLM para identificar o problema. Escreva o prompt otimizado que voce usaria — com papel, contexto, tarefa e constraints — para obter o diagnostico mais util possivel sem estourar o contexto desnecessariamente.
`,
  quiz: [
    {
      question: 'Qual a consequencia pratica do "knowledge cutoff" de um LLM para um engenheiro de infraestrutura?',
      options: [
        'O modelo nao consegue processar arquivos YAML',
        'Versoes de ferramentas, APIs e flags sugeridas pelo modelo podem estar desatualizadas — sempre verificar contra a documentacao oficial',
        'O modelo so funciona offline apos o cutoff',
        'O modelo fica mais lento apos o cutoff'
      ],
      correct: 1,
      explanation: 'LLMs tem um "knowledge cutoff" — data ate a qual foram treinados. Apos isso, nao sabem de novas versoes de Kubernetes, novos campos de CRDs, mudancas de API, etc. Um modelo pode sugerir flags depreciadas ou configuracoes de versoes antigas com total confianca. Sempre validar versoes criticas na documentacao oficial.',
      reference: 'Conceito relacionado: RAG (Retrieval Augmented Generation) resolve parcialmente esse problema ao injetar documentacao atualizada no contexto antes da resposta.'
    },
    {
      question: 'Para gerar um script de troubleshooting complexo que requer raciocinio sobre multiplas causas possiveis, qual tecnica de prompt engineering e mais eficaz?',
      options: [
        'Temperatura alta (1.5) para maior criatividade',
        'Chain of Thought — pedir que o modelo pense passo a passo antes de dar a resposta final',
        'Prompt o mais curto possivel para economizar tokens',
        'Usar sempre o modelo mais barato'
      ],
      correct: 1,
      explanation: 'Chain of Thought (CoT) melhora significativamente a qualidade em tarefas que requerem raciocinio em etapas. Ao pedir "pense passo a passo: quais sao as causas possiveis? como diagnosticar cada uma?", o modelo "externaliza" o raciocinio e comete menos erros logicos. Especialmente util para troubleshooting e analise de causa raiz.',
      reference: 'Conceito relacionado: Few-shot prompting (dar exemplos) complementa CoT bem — exemplos mostram o formato esperado, CoT melhora o raciocinio.'
    },
    {
      question: 'Qual modelo seria mais adequado para processar um repositorio inteiro de 500.000 tokens para encontrar configuracoes de seguranca problematicas?',
      options: [
        'Claude 3.5 Haiku — e o mais rapido',
        'GPT-4o mini — e o mais barato',
        'Gemini 1.5 Pro — tem janela de contexto de 1M tokens, unico capaz de processar esse volume',
        'Qualquer modelo com RAG funciona para isso'
      ],
      correct: 2,
      explanation: 'Claude Sonnet e GPT-4o tem janela de ~128-200k tokens — nao caberia 500k tokens. Gemini 1.5 Pro tem janela de 1M tokens, sendo o unico dos principais modelos capaz de processar repositorios muito grandes de uma vez. Para esse caso especifico de analise de seguranca em repositorio gigante, e a escolha correta.',
      reference: 'Conceito relacionado: Para repositorios grandes com modelos de janela menor, usar RAG — fragmentar o repositorio, indexar, e recuperar apenas os trechos relevantes.'
    },
    {
      question: 'O que e "alucinacao" em LLMs e como mitigar no contexto de infraestrutura?',
      options: [
        'E quando o modelo fica lento — mitigar com hardware melhor',
        'E quando o modelo gera informacoes falsas com confianca — mitigar testando comandos em ambiente seguro, pedindo que o modelo sinalize incerteza, e verificando contra documentacao oficial',
        'E um bug que ocorre apenas com temperatura alta',
        'E quando o modelo repete a mesma resposta — usar temperatura 1.0 para resolver'
      ],
      correct: 1,
      explanation: 'Alucinacao e o fenomeno em que LLMs geram informacoes incorretas com total confianca. No contexto de infra, isso pode ser: flags kubectl que nao existem, versoes de Helm chart inventadas, configuracoes de API incorretas. Mitigacoes: sempre testar comandos em ambiente de desenvolvimento, pedir ao modelo para indicar nivel de confianca, e cruzar com documentacao oficial.',
      reference: 'Conceito relacionado: Alucinacao e mais comum em perguntas sobre fatos especificos (versoes, APIs) do que em raciocinio geral. Para fatos criticos, sempre verificar externamente.'
    },
    {
      question: 'Qual e a estrategia correta para escolher entre Claude Sonnet e Claude Haiku em uma pipeline de producao que processa 10.000 alertas por dia?',
      options: [
        'Sempre usar o modelo mais capaz (Sonnet) para garantir qualidade',
        'Validar que Haiku produz qualidade suficiente para a tarefa e usar Haiku pelo menor custo — 10x mais barato que Sonnet',
        'Usar Sonnet de dia e Haiku a noite para economizar',
        'Nao faz diferenca — todos os modelos Claude tem o mesmo preco'
      ],
      correct: 1,
      explanation: 'A estrategia correta e: validar primeiro com o modelo mais capaz (Sonnet) para garantir que a tarefa e possivel e medir qualidade, depois testar se o modelo mais barato (Haiku) entrega qualidade suficiente para o caso de uso. Haiku e ~10x mais barato — em 10.000 alertas/dia, isso representa economia substancial. Modelos menores frequentemente sao suficientes para classificacao e tarefas estruturadas.',
      reference: 'Conceito relacionado: Essa estrategia — comece caro para validar, otimize com modelos mais baratos — e equivalente ao ciclo de vida de features em produto.'
    },
    {
      question: 'Por que incluir "Retorne apenas o YAML, sem explicacoes" em um prompt que gera manifests Kubernetes?',
      options: [
        'Para economizar tokens de saida',
        'Para forcar output estruturado e parseable diretamente — facilita automacao, evita texto que quebraria kubectl apply, e torna o output previsivel',
        'Modelos nao conseguem gerar YAML com explicacoes',
        'E uma convencao do mercado sem motivo tecnico'
      ],
      correct: 1,
      explanation: 'Constraintes de formato no prompt tornam o output diretamente utilizavel em automacao. "Apenas YAML" significa que voce pode fazer kubectl apply -f <(claude-api ...) sem precisar parsear texto. Saidas previsivei facilitam pipes, scripts e integracao com CI/CD. Sem essa constraint, o modelo pode adicionar explicacoes, markdown, ou texto que quebraria o parse.',
      reference: 'Conceito relacionado: Para outputs JSON criticos, usar JSON mode (disponivel em OpenAI e Anthropic) que garante validade do JSON mesmo sem a constraint explicita.'
    },
    {
      question: 'Qual e o impacto pratico de mandar um contexto excessivamente grande (ex: 50.000 linhas de log) para um LLM?',
      options: [
        'Nenhum — mais contexto sempre melhora a resposta',
        'O modelo fica mais lento mas a qualidade melhora proporcionalmente',
        'Custo maior, latencia maior, e paradoxalmente pior qualidade — modelos tem dificuldade de focar no relevante em contextos muito grandes ("lost in the middle")',
        'O modelo rejeita a requisicao automaticamente'
      ],
      correct: 2,
      explanation: 'Pesquisas mostram o fenomeno "lost in the middle" — modelos tem dificuldade de recuperar informacoes no meio de contextos muito longos, focando melhor no inicio e no final. Alem disso, contextos grandes aumentam custo e latencia linearmente. A pratica recomendada: filtrar logs para as ultimas N linhas relevantes, ou usar grep/jq para extrair apenas o que interessa antes de enviar ao modelo.',
      reference: 'Conceito relacionado: RAG resolve o problema de grandes bases de conhecimento sem estourar contexto — fragmenta e recupera apenas o relevante.'
    }
  ],
  flashcards: [
    {
      front: 'Tokens vs Palavras — o que importa para engenheiros',
      back: '**Token ≈ 4 chars / 3/4 palavra (ingles)**\n\nRegras praticas:\n- 1 linha de codigo ≈ 10-20 tokens\n- 1 arquivo YAML (100 linhas) ≈ 500 tokens\n- 1 pagina de texto ≈ 750 tokens\n- Um repositorio pequeno (10k linhas) ≈ 50k-100k tokens\n\n**Por que importa:**\n- Context window tem limite em tokens\n- Custo e cobrado por token\n- Latencia aumenta com mais tokens\n\n**Limites de contexto:**\n- Claude Sonnet/Haiku: 200k tokens\n- GPT-4o: 128k tokens\n- Gemini 1.5 Pro: 1M tokens\n- Llama 3.1 local: 128k tokens\n\n**Regra:** filtre antes de enviar.\n`kubectl logs pod | tail -100` em vez\nde mandar o log completo.'
    },
    {
      front: 'Escolha de modelo — guia rapido para infra',
      back: '**Por tarefa:**\n\n🔴 **Tarefa complexa / raciocinio profundo:**\nClaude 3.5 Sonnet ou GPT-4o\n→ Debugging avancado, arquitetura, code review\n\n🟡 **Tarefa simples / alto volume:**\nClaude 3.5 Haiku ou GPT-4o mini\n→ Classificacao de alertas, geracao de YAML simples\n\n🟢 **Repositorio gigante (>200k tokens):**\nGemini 1.5 Pro (1M context)\n→ Analise de repositorios completos\n\n🔵 **Dados sensiveis / compliance:**\nLlama 3.1 via Ollama (local)\n→ Zero dados saem da empresa\n\n**Estrategia de custo:**\n1. Valide com modelo caro (qualidade ok?)\n2. Teste com modelo barato (qualidade suficiente?)\n3. Use modelo barato em producao'
    },
    {
      front: 'Estrutura de prompt eficaz para tarefas tecnicas',
      back: '**Template:**\n\`\`\`\n[PAPEL]\nVoce e um [especialista] com [X anos]\nde experiencia em [dominio].\n\n[CONTEXTO]\nAmbiente: [descricao]\nVersoes: [k8s 1.29, helm 3.14, etc]\nRestriccoes: [sem internet, staging]\n\n[TAREFA]\n[O que exatamente voce quer]\n\n[CONSTRAINTS]\n- Retorne apenas [formato]\n- Nao inclua [o que evitar]\n- Limite de [X linhas/chars]\n\`\`\`\n\n**Tecnicas por situacao:**\n- Debugging complexo → Chain of Thought\n- Formato especifico → Few-shot examples\n- Codigo seguro → "nao use deprecated APIs"\n- Verificar confianca → "indique se nao tiver certeza"\n\n**Anti-patterns:**\n- ❌ Prompt vago ("melhora isso")\n- ❌ Contexto gigante sem filtro\n- ❌ Sem restricao de formato'
    },
    {
      front: 'Limitacoes criticas dos LLMs para uso em infra',
      back: '**1. Knowledge Cutoff**\nNao sabe de versoes/APIs apos o treinamento\n→ Sempre verificar versoes sugeridas\n→ Solucao: RAG com docs atualizados\n\n**2. Alucinacao**\nGera informacoes falsas com confianca\n→ Testar tudo em ambiente seguro primeiro\n→ Pedir: "indique o que nao tem certeza"\n\n**3. Lost in the Middle**\nPerde foco em contextos muito longos\n→ Filtrar input antes de enviar\n→ Informacao critica: inicio ou fim do prompt\n\n**4. Nao Deterministico**\nMesmo prompt = respostas diferentes\n→ Para critico: temperatura 0.0\n→ Sempre rever output antes de aplicar\n\n**5. Custo**\nEscala com tokens de input + output\n→ Filtrar contexto = economizar dinheiro\n→ Modelo correto para cada tarefa'
    },
    {
      front: 'Chain of Thought — quando e como usar',
      back: '**Quando usar:**\n- Troubleshooting com multiplas causas\n- Arquitetura de solucao\n- Analise de causa raiz (RCA)\n- Decisoes que requerem trade-offs\n\n**Como usar:**\n\`\`\`\n"Antes de responder, pense passo a passo:\n1. Qual e o sintoma observado?\n2. Quais sao as causas possiveis?\n3. Como testar/descartar cada causa?\n4. Qual e o diagnostico mais provavel?\nDepois escreva o plano de investigacao."\n\`\`\`\n\n**Por que funciona:**\nModelos raciocinam melhor quando\n"externalizam" o pensamento antes\nda resposta final — similar a como\nengenheiros pensam em voz alta.\n\n**Combinado com few-shot:**\nDar exemplo de raciocinio step-by-step\nde um caso similar aumenta ainda mais\na qualidade.'
    },
    {
      front: 'Custos LLM — ordem de grandeza para planejar',
      back: '**Precos aproximados (Mai/2024):**\n\n| Modelo | Input | Output |\n|--------|-------|--------|\n| Claude Sonnet | $3/M | $15/M |\n| Claude Haiku | $0.25/M | $1.25/M |\n| GPT-4o | $2.5/M | $10/M |\n| GPT-4o mini | $0.15/M | $0.6/M |\n| Gemini 1.5 Pro | $3.5/M | $10.5/M |\n\n**Casos de uso — custo estimado:**\n\n1 analise de YAML (2k tokens) com Sonnet:\n→ ~$0.006 (menos de 1 centavo)\n\n1000 alertas/dia classificados com Haiku:\n→ ~$0.50/dia = ~$15/mes\n\nCI/CD com 50 PRs/dia (review com Sonnet):\n→ ~$10-30/mes\n\nRAG system 100k queries/mes:\n→ $50-200/mes dependendo do modelo\n\n**Regra de ouro:**\nValidar com caro → otimizar com barato'
    }
  ],
  lab: null,
  troubleshooting: [
    {
      title: 'LLM gera YAML invalido ou com APIs desatualizadas',
      difficulty: 'easy',
      symptom: 'O modelo gerou um manifest Kubernetes mas kubectl apply falha com "no kind is registered for the version" ou campos que nao existem na versao atual do cluster.',
      diagnosis: `\`\`\`bash
# 1. Verificar a versao do campo sugerido na documentacao real
kubectl explain deployment.spec.template.spec.containers.resources
kubectl api-resources | grep <tipo-do-recurso>

# 2. Validar o YAML antes de aplicar (sem cluster)
kubectl apply --dry-run=client -f manifest.yaml

# 3. Usar kubeval ou kubeconform para validar versao de schema
kubeconform -strict -kubernetes-version 1.29.0 manifest.yaml

# 4. Ver qual versao da API o LLM assumiu
# Geralmente o LLM indica "apiVersion: apps/v1" mas
# pode usar versoes beta depreciadas para CRDs
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Knowledge cutoff:** O modelo pode ter sido treinado antes de uma mudanca de API. Adicionar ao prompt: "Use apenas APIs stable (v1, apps/v1) do Kubernetes 1.29+. Nao use APIs beta ou alpha."

2. **Prompt sem especificar versao:** Sempre incluir no prompt a versao exata do Kubernetes e das ferramentas relevantes.

3. **Validacao automatica no fluxo:**
\`\`\`bash
# Validar output do LLM antes de usar
LLM_OUTPUT="\$(call-llm ...)"
echo "\$LLM_OUTPUT" | kubectl apply --dry-run=client -f -
if [ \$? -eq 0 ]; then
  echo "\$LLM_OUTPUT" | kubectl apply -f -
fi
\`\`\`

4. **Melhorar o prompt:**
\`\`\`
"Use Kubernetes 1.29 APIs stable apenas.
Nao use: autoscaling/v2beta1, networking.k8s.io/v1beta1.
Se nao tiver certeza de uma API, indique explicitamente."
\`\`\``
    },
    {
      title: 'Respostas do LLM variam muito para o mesmo problema',
      difficulty: 'medium',
      symptom: 'Voce usa o mesmo prompt para analisar alertas similares mas recebe respostas completamente diferentes em qualidade e formato, tornando a automacao dificil.',
      diagnosis: `\`\`\`bash
# 1. Verificar se o prompt tem constraints de formato
# Se nao tiver, o modelo varia bastante

# 2. Testar o mesmo prompt 5 vezes e comparar outputs
for i in 1 2 3 4 5; do
  echo "--- Run \$i ---"
  curl -s https://api.anthropic.com/v1/messages \\
    -H "x-api-key: \$ANTHROPIC_API_KEY" \\
    -H "content-type: application/json" \\
    -d '{"model":"claude-3-5-haiku","messages":[{"role":"user","content":"<seu-prompt>"}],"max_tokens":500}' \\
    | jq -r '.content[0].text'
done

# 3. Verificar se temperatura esta configurada
# Default pode variar entre APIs
\`\`\``,
      solution: `**Solucoes para output consistente:**

1. **Forcar formato JSON:**
\`\`\`json
"Retorne APENAS este JSON, nenhum texto adicional:
{
  \\"causa_raiz\\": \\"string\\",
  \\"severidade\\": \\"low|medium|high|critical\\",
  \\"acoes\\": [\\"string\\"],
  \\"confianca\\": \\"0.0-1.0\\"
}"
\`\`\`

2. **Temperatura 0.0 para outputs criticos:**
\`\`\`python
response = client.messages.create(
    model="claude-3-5-sonnet",
    temperature=0.0,  # Deterministico
    messages=[...]
)
\`\`\`

3. **Few-shot com exemplos do formato esperado:**
Incluir 2-3 exemplos de input/output no prompt — o modelo aprende o padrao.

4. **Validar schema da resposta:**
\`\`\`python
import json, jsonschema
output = json.loads(llm_response)
jsonschema.validate(output, schema)  # Schema predefinido
\`\`\``
    }
  ]
};
