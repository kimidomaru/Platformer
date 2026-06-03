window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['ai-engineering/claude-code-platform'] = {
  theory: `
# Claude Code & Agentes para Plataforma

## Relevancia
Claude Code e o CLI da Anthropic que transforma seu terminal em um agente de AI que entende codigo, executa comandos e interage com o filesystem. Para Platform Engineers e SREs, vai alem de um chat — e um colaborador que pode iterar sobre infraestrutura, criar conteudo, debugar problemas e integrar com ferramentas via MCP servers. Esta plataforma de estudo e um caso real criado com Claude Code.

## O que e Claude Code

### Conceito central

\`\`\`
Claude Code = LLM poderoso + acesso ao filesystem + execucao de comandos + context persistente
\`\`\`

Diferente de uma interface web, o Claude Code:
- **Le e escreve arquivos** no seu projeto diretamente
- **Executa comandos** (bash, kubectl, terraform, git)
- **Mantém contexto** de toda a conversa + arquivos lidos
- **Itera** — faz, verifica resultado, ajusta, repete
- **Integra ferramentas** via MCP (Model Context Protocol)

### Quando usar Claude Code vs Copilot Chat

\`\`\`
GitHub Copilot Chat         Claude Code
────────────────────────    ─────────────────────────────
Autocomplete inline         Tarefas multi-arquivo
Perguntas rapidas           Refactoring complexo
Contexto do arquivo atual   Contexto de todo o projeto
Um arquivo por vez          Cria/edita/deleta multiplos arquivos
Sem execucao de comandos    Executa comandos e valida resultados
Sem MCP/integrações         MCP: kubectl, terraform, GitHub, etc.
\`\`\`

## Instalacao e Configuracao

\`\`\`bash
# Instalar Claude Code
npm install -g @anthropic-ai/claude-code

# Verificar instalacao
claude --version

# Autenticar (inicia browser para OAuth)
claude auth login

# Iniciar no diretorio do projeto
cd /meu/projeto
claude
\`\`\`

### Primeira inicializacao — CLAUDE.md

O arquivo \`CLAUDE.md\` e o "briefing" que o Claude Code le automaticamente ao iniciar em um projeto. E o mecanismo central de contexto persistente.

\`\`\`markdown
# Meu Projeto — Contexto para Claude Code

## Contexto do Projeto
- Stack: Kubernetes 1.29, Helm 3.14, ArgoCD, Prometheus
- Cloud: AWS EKS em us-east-1
- Time: 5 engenheiros, deploy 3x/semana

## Convencoes
- Namespaces: <time>-<ambiente> (ex: payments-prod)
- Labels obrigatorias: app, version, team, env
- Nao usar latest como tag de imagem

## Comandos Uteis
\`\`\`bash
make deploy ENV=staging          # deploy staging
kubectl config use-context prod  # trocar para prod
\`\`\`

## Restricoes
- NUNCA fazer kubectl delete em producao sem confirmar
- NUNCA hardcodar credenciais em arquivos
- Sempre usar dry-run antes de aplicar mudancas em prod
\`\`\`

**Regra de ouro:** quanto mais especifico o CLAUDE.md, mais autonomo e relevante e o comportamento do agente.

## Skills (Slash Commands)

Skills sao comandos customizados que voce cria para tarefas recorrentes. Ficam em \`.claude/commands/\` ou \`~/.claude/commands/\` (globais).

### Estrutura de uma skill

\`\`\`markdown
<!-- .claude/commands/minha-skill.md -->
# Nome da Skill

Descricao do que ela faz.

## Input Esperado
$ARGUMENTS

## O que fazer
1. Le o arquivo X
2. Gera Y
3. Valida com Z
\`\`\`

### Exemplos de skills para DevOps

\`\`\`bash
# Estrutura de pastas
.claude/commands/
├── add-topic.md          # adiciona topico na plataforma de estudo
├── k8s-review.md         # revisa YAML por seguranca
├── incident-report.md    # gera relatorio de incidente
├── terraform-module.md   # cria modulo Terraform
└── deploy-checklist.md   # checklist pre-deploy
\`\`\`

\`\`\`markdown
<!-- .claude/commands/k8s-review.md -->
# Kubernetes YAML Security Review

Voce e um especialista em Kubernetes security.

Analise o arquivo $ARGUMENTS e identifique:
1. Containers rodando como root (runAsNonRoot: false ou ausente)
2. Privilege escalation permitida (allowPrivilegeEscalation: true)
3. Resource limits ausentes
4. Liveness/readiness probes ausentes
5. Image tag "latest" em uso

Retorne uma lista com severidade (HIGH/MEDIUM/LOW) e a correcao exata.
\`\`\`

\`\`\`bash
# Uso
/k8s-review deployment.yaml
/k8s-review helm/templates/
\`\`\`

## MCP Servers — Integrando Ferramentas

MCP (Model Context Protocol) permite que o Claude Code interaja com ferramentas externas como se fossem extensoes nativas. O modelo ganha "tooling" que vai alem do filesystem.

### Configurar MCP servers

\`\`\`json
// .claude/settings.json ou ~/.claude/settings.json
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

### O que fica possivel com MCP

\`\`\`bash
# Com MCP kubernetes:
"Liste todos os pods em estado de erro no namespace prod"
"Qual e o consumo de CPU dos nodes do cluster?"
"Mostre os eventos recentes do namespace payments"

# Com MCP github:
"Liste os PRs abertos com CI falhando"
"Crie uma issue descrevendo o bug que encontramos"
"Qual foi o ultimo commit que tocou no arquivo deployment.yaml?"

# Com MCP terraform:
"Mostre o estado atual do modulo eks"
"Quais recursos seriam criados se eu aplicar esse plan?"
\`\`\`

## Workflows Agenticos para Platform Engineering

### Workflow 1: Criar e Validar Infraestrutura

\`\`\`bash
# Prompt agentico (multi-step automatico)
"Crie um modulo Terraform para um RDS PostgreSQL com:
- Multi-AZ habilitado
- Backup retention 7 dias
- Encryption at rest
- Security group para acesso apenas do EKS
Depois valide com terraform validate e mostre o plan resumido."

# Claude Code vai:
# 1. Criar main.tf, variables.tf, outputs.tf
# 2. Executar terraform init
# 3. Executar terraform validate
# 4. Executar terraform plan -compact-warnings
# 5. Mostrar resumo do que seria criado
\`\`\`

### Workflow 2: Debug de Incidente

\`\`\`bash
# Com MCP kubernetes ativo
"Estamos com latencia alta no servico payments desde 14:30.
1. Verifique os pods do namespace payments
2. Cheque os eventos recentes
3. Veja os logs dos ultimos 30 minutos
4. Compare com o estado de ontem
Sugira as 3 causas mais provaveis e como investigar cada uma."
\`\`\`

### Workflow 3: Geracao de Conteudo Tecnico

\`\`\`bash
# Esta propria plataforma foi criada assim
"Adicione um novo topico sobre Cilium Network Policies:
- Teoria com exemplos YAML funcionais
- 7 questoes de quiz com explicacoes
- 6 flashcards
- Lab hands-on com 4 steps e verify
- 2 troubleshooting scenarios
Siga o formato exato dos topicos existentes em content/networking/"
\`\`\`

### Workflow 4: Code Review Automatizado

\`\`\`bash
"Revise o diff do PR #142 no repositorio myorg/platform:
1. Identifique bugs de logica
2. Verifique praticas de seguranca
3. Cheque se os testes cobrem os casos de borda
4. Sugira melhorias de performance
Formato: lista por arquivo, severidade HIGH/MEDIUM/LOW"
\`\`\`

## Configuracoes Avancadas

### settings.json — configurar permissoes

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

### Hooks — executar acoes automaticas

\`\`\`json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "echo 'Arquivo modificado: $TOOL_INPUT_PATH' >> ~/.claude/audit.log"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "notify-send 'Claude Code' 'Tarefa concluida'"
          }
        ]
      }
    ]
  }
}
\`\`\`

## Boas Praticas para Platform Engineers

### CLAUDE.md estrategico

\`\`\`markdown
# Regras criticas (coloque sempre)
- Nunca commitar para main diretamente
- Sempre criar branch para mudancas
- Validar YAML antes de aplicar
- Confirmar antes de operacoes destrutivas

# Contexto do ambiente (ajuda muito)
- Versao do Kubernetes: 1.29
- CNI: Cilium 1.14
- Ingress: Nginx 1.9 + cert-manager
- GitOps: ArgoCD 2.9

# Comandos do projeto (evita perguntas repetidas)
- make test: roda testes unitarios
- make lint: valida YAML e HCL
- make deploy ENV=<env>: deploy por ambiente
\`\`\`

### Iterar, nao perguntar

\`\`\`bash
# Em vez de:
"Como eu configuro um HPA com custom metrics?"

# Prefira:
"Configure um HPA para o deployment payments-api que escale
baseado na metrica custom http_requests_per_second do Prometheus.
Crie o YAML, valide, e mostre como verificar que esta funcionando."
\`\`\`

### Seguranca em contextos sensiveis

\`\`\`bash
# Claude Code NUNCA deve ter:
# - Acesso a clusters de producao diretamente
# - Tokens com permissao de write em prod
# - Credenciais de banco de dados

# Use contextos separados:
KUBECONFIG=~/.kube/config-dev claude    # apenas dev
KUBECONFIG=~/.kube/config-staging claude  # apenas staging

# Para producao: sempre humano no loop
\`\`\`

## Esta Plataforma como Caso Real

Esta plataforma de estudo Kubernetes foi inteiramente criada e mantida com Claude Code:

\`\`\`
Estrutura gerada por Claude Code:
├── index.html              ← engine HTML/JS da plataforma
├── CLAUDE.md               ← contexto persistente do projeto
├── .claude/commands/       ← skills customizadas
│   └── kubernetes-add-topic.md
└── content/                ← todo conteudo gerado por AI
    ├── registry.js         ← indice central
    └── <dominio>/<topico>/
        ├── topic.js        ← conteudo PT
        └── topic-en.js     ← conteudo EN
\`\`\`

O skill \`/kubernetes-add-topic\` define o formato exato esperado e Claude Code gera conteudo novo seguindo a estrutura sem precisar reler o codigo da plataforma toda vez.

## Erros Comuns

1. **CLAUDE.md vazio ou generico** — sem contexto, o agente faz perguntas ou assume errado
2. **Tarefas muito abertas** — "melhora o projeto" sem definir o que "melhor" significa
3. **Sem restricoes de seguranca** — nao definir o que o agente NAO pode fazer
4. **Nao usar MCP** — fazer perguntas sobre estado do cluster sem MCP e ineficiente
5. **Contexto de conversa longa** — iniciar nova conversa para tarefas nao relacionadas

## Killer.sh Style Challenge

> **Cenario:** Voce precisa implementar um workflow agentico com Claude Code para automatizar a geracao de runbooks de incidente. Defina:
> 1. O conteudo do CLAUDE.md para esse projeto
> 2. O arquivo \`.claude/commands/generate-runbook.md\`
> 3. Como seria o prompt para gerar um runbook de "pod CrashLoopBackOff em producao"
`,
  quiz: [
    {
      question: 'Qual e a principal diferenca entre GitHub Copilot Chat e Claude Code para tarefas de infraestrutura?',
      options: [
        'Copilot usa GPT-4, Claude Code usa Claude — a diferenca e apenas o modelo',
        'Claude Code pode ler/escrever multiplos arquivos, executar comandos, manter contexto do projeto inteiro e integrar ferramentas via MCP — Copilot Chat e limitado ao arquivo atual e nao executa comandos',
        'Copilot e mais caro que Claude Code',
        'Claude Code funciona apenas online, Copilot funciona offline'
      ],
      correct: 1,
      explanation: 'A diferenca e arquitetural, nao apenas de modelo. Claude Code e um agente agentico com acesso ao filesystem, execucao de comandos e integracao via MCP. Ele pode criar 20 arquivos, rodar terraform plan, verificar resultado, ajustar e repetir — tudo autonomamente. Copilot Chat e um assistente de conversa limitado ao contexto do editor.',
      reference: 'Conceito relacionado: "agente agentico" = LLM com ferramentas (tools) que pode iterar sobre acoes em loop, nao apenas responder uma vez.'
    },
    {
      question: 'Qual e o proposito do arquivo CLAUDE.md em um projeto?',
      options: [
        'E um arquivo de configuracao JSON para o CLI',
        'E o "briefing" persistente que o Claude Code le automaticamente ao iniciar — define contexto do projeto, convencoes, restricoes e comandos uteis, evitando repetir essas informacoes em cada conversa',
        'E um arquivo de log das interacoes com o Claude',
        'E opcional — Claude Code funciona igual sem ele'
      ],
      correct: 1,
      explanation: 'O CLAUDE.md e o mecanismo de contexto persistente do Claude Code. Sem ele, o agente nao sabe: qual versao do Kubernetes voce usa, quais sao as convencoes do projeto, o que nunca deve fazer (ex: delete em prod), ou quais comandos existem. Com um CLAUDE.md bem escrito, o agente age como um colega que ja conhece o projeto.',
      reference: 'Dica: o CLAUDE.md deve ter: contexto do projeto, convencoes, restricoes criticas de seguranca, e comandos uteis do projeto.'
    },
    {
      question: 'O que sao MCP Servers no contexto do Claude Code?',
      options: [
        'Servidores remotos que hospedam o modelo Claude',
        'Extensoes que dao ao Claude Code acesso a ferramentas externas como kubectl, terraform, GitHub — expandindo o que o agente pode fazer alem de arquivos locais',
        'Plugins para o VS Code que integram com Claude',
        'Configuracoes de seguranca para restringir acoes do Claude'
      ],
      correct: 1,
      explanation: 'MCP (Model Context Protocol) e um protocolo padrao para integrar ferramentas ao Claude Code. Com um MCP server de kubernetes, o Claude pode consultar o estado real do cluster. Com GitHub MCP, pode listar PRs, criar issues, comentar. Isso transforma o Claude Code de um editor de arquivos em um agente que interage com o ecossistema completo de DevOps.',
      reference: 'Analogia: MCP servers sao para Claude Code o que plugins sao para o VS Code — cada um adiciona uma capacidade nova.'
    },
    {
      question: 'Como uma "skill" (slash command) melhora o uso do Claude Code para tarefas recorrentes?',
      options: [
        'Skills sao apenas atalhos de teclado — nao tem impacto na qualidade',
        'Skills definem instrucoes precisas e reutilizaveis para tarefas recorrentes, garantindo que o Claude sempre siga o mesmo processo e formato — eliminando a necessidade de reescrever prompts complexos toda vez',
        'Skills executam codigo automaticamente sem envolver o Claude',
        'Skills so funcionam com MCP servers ativos'
      ],
      correct: 1,
      explanation: 'Uma skill e essencialmente um prompt template persistente com instrucoes especificas. Em vez de escrever "voce e um especialista em K8s security, analise esse arquivo buscando containers como root, privilege escalation..." toda vez, voce escreve uma vez no arquivo da skill e usa `/k8s-review deployment.yaml`. Especialmente valioso para equipes — todos usam o mesmo padrao.',
      reference: 'Localizacao: skills do projeto ficam em `.claude/commands/`, skills globais em `~/.claude/commands/`.'
    },
    {
      question: 'Qual configuracao do settings.json e mais importante para seguranca ao usar Claude Code com acesso a clusters Kubernetes?',
      options: [
        'Aumentar o timeout das requisicoes',
        'Configurar `permissions.deny` para bloquear comandos destrutivos como `kubectl delete` e `rm -rf`, garantindo que o agente nunca execute acoes irreversiveis sem confirmacao manual',
        'Desativar o MCP server de kubernetes',
        'Limitar o numero de tokens por conversa'
      ],
      correct: 1,
      explanation: 'A configuracao de `permissions.deny` e a barreira de seguranca mais critica. Um agente agentico pode encadear multiplas acoes — se ele interpretar "limpar pods antigos" como `kubectl delete pods --all`, isso pode ser catastrofico. Bloquear explicitamente comandos destrutivos e a forma mais segura de operar. Combine com uso de contextos de cluster separados (dev/staging apenas).',
      reference: 'Pratica complementar: nunca configurar o KUBECONFIG de producao no ambiente onde o Claude Code opera autonomamente.'
    },
    {
      question: 'O que torna um workflow agentico mais eficaz do que uma serie de perguntas individuais ao Claude Code?',
      options: [
        'Workflows agenticos sao mais rapidos porque usam menos tokens',
        'Um workflow agentico e uma unica instrucao que define objetivo, acoes e criterios de validacao — o Claude Code itera autonomamente (cria arquivo, testa, ajusta, verifica) sem precisar de aprovacao humana em cada etapa',
        'Workflows agenticos so funcionam com MCP servers',
        'Nao ha diferenca pratica — o resultado e o mesmo'
      ],
      correct: 1,
      explanation: 'Em vez de: (1) "crie o arquivo main.tf" → revisar → (2) "agora valide" → revisar → (3) "corrija o erro X" → revisar; um workflow agentico e: "crie o modulo Terraform para RDS, valide, corrija qualquer erro e mostre o resultado". O Claude encadeia as acoes automaticamente. Isso economiza ciclos humanos e e especialmente valioso para tarefas com muitas etapas predefinidas.',
      reference: 'Analogia: workflow agentico e como dar um objetivo ao invés de microgerenciar cada passo — o agente resolve o "como".'
    },
    {
      question: 'Por que esta plataforma de estudo Kubernetes e um bom exemplo de caso de uso do Claude Code?',
      options: [
        'Porque foi hospedada nos servidores da Anthropic',
        'Porque requer criacao de dezenas de arquivos seguindo um formato preciso, validacao de estrutura, atualizacao de um registry central — tarefas multi-arquivo e multi-step ideais para um agente com filesystem access e context persistente via CLAUDE.md',
        'Porque usa o modelo Claude 3.5 para renderizar o conteudo',
        'Porque so tem conteudo de Kubernetes — o unico dominio que o Claude conhece bem'
      ],
      correct: 1,
      explanation: 'Esta plataforma tem um padrao estruturado complexo: cada topico requer theory/quiz/flashcards/lab/troubleshooting em formato especifico, atualizacao do registry central, e consistencia com topicos existentes. Sao exatamente o tipo de tarefa repetitiva-mas-complexa onde Claude Code brilha: le os arquivos existentes para entender o padrao, gera o novo conteudo seguindo a mesma estrutura, e atualiza o registro — tudo em uma unica instrucao.',
      reference: 'Dica: o skill `/kubernetes-add-topic` desta plataforma e um exemplo real de como encapsular logica complexa em uma skill reutilizavel.'
    }
  ],
  flashcards: [
    {
      front: 'Claude Code — o que e e como difere do Copilot',
      back: '**Claude Code = Agente Agentico CLI**\n\n**Capacidades:**\n- Le e escreve arquivos locais\n- Executa comandos (bash, kubectl, git, etc)\n- Itera: age → verifica → ajusta → repete\n- Context de projeto inteiro via CLAUDE.md\n- Integra ferramentas via MCP servers\n\n**vs GitHub Copilot Chat:**\n\n| Copilot Chat | Claude Code |\n|-------------|-------------|\n| Contexto do arquivo | Contexto do projeto |\n| Nao executa cmds | Executa comandos |\n| Um arquivo | Multiplos arquivos |\n| Sem MCP | MCP servers |\n| Resposta unica | Loop agentico |\n\n**Instalacao:**\n`npm install -g @anthropic-ai/claude-code`\n`claude auth login`\n`cd projeto && claude`'
    },
    {
      front: 'CLAUDE.md — o briefing do agente',
      back: '**O que e:**\nArquivo markdown que Claude Code le\nautomaticamente ao iniciar em um projeto.\nDefine contexto persistente da sessao.\n\n**Estrutura recomendada:**\n\`\`\`markdown\n# Projeto X — Contexto para Claude Code\n\n## Stack\n- K8s 1.29, Helm 3.14, ArgoCD\n- AWS EKS us-east-1\n\n## Convencoes\n- Labels: app, version, team, env\n- Namespaces: <team>-<env>\n\n## Restricoes Criticas\n- NUNCA kubectl delete sem confirmar\n- NUNCA hardcodar credenciais\n- Sempre dry-run em prod\n\n## Comandos\n- make test: testes unitarios\n- make deploy ENV=X: deploy\n\`\`\`\n\n**Regra:** mais especifico = agente\nmais autonomo e relevante.'
    },
    {
      front: 'Skills (Slash Commands) — reuso de prompts complexos',
      back: '**Localizacao:**\n- `.claude/commands/` → projeto\n- `~/.claude/commands/` → global\n\n**Formato:**\n\`\`\`markdown\n# Nome da Skill\nDescricao do que faz.\n\n## Input\n$ARGUMENTS\n\n## Instrucoes\n1. Passo 1\n2. Passo 2\n3. Validar com X\n\`\`\`\n\n**Uso no terminal:**\n`/k8s-review deployment.yaml`\n`/incident-report "latencia alta em prod"`\n`/add-topic domain:networking topic:cilium`\n\n**Casos de uso DevOps:**\n- `/k8s-review` → auditoria de seguranca YAML\n- `/terraform-module` → scaffold de modulo\n- `/incident-report` → gera postmortem\n- `/deploy-checklist` → pre-deploy validation\n- `/add-topic` → novo topico na plataforma'
    },
    {
      front: 'MCP Servers — integrando ferramentas ao Claude Code',
      back: '**O que e MCP:**\nModel Context Protocol — protocolo para\ndar "ferramentas" ao agente alem do filesystem.\n\n**Configuracao (.claude/settings.json):**\n\`\`\`json\n{\n  "mcpServers": {\n    "kubernetes": {\n      "command": "npx",\n      "args": ["-y", "@mcp-servers/kubernetes"]\n    },\n    "github": {\n      "command": "npx",\n      "args": ["-y", "@mcp/server-github"],\n      "env": {"GITHUB_TOKEN": "ghp_xxx"}\n    }\n  }\n}\n\`\`\`\n\n**Com MCP kubernetes ativo:**\n- "Liste pods com erro em prod"\n- "Qual o consumo de CPU dos nodes?"\n- "Mostre eventos do ultimo incidente"\n\n**Com MCP github:**\n- "PRs abertos com CI falhando"\n- "Crie issue sobre esse bug"\n- "Quem modificou esse arquivo?"'
    },
    {
      front: 'Workflows Agenticos — exemplos praticos',
      back: '**Criar infraestrutura + validar:**\n\`\`\`\n"Crie modulo Terraform para RDS com\nMulti-AZ, backup 7d, encryption.\nValide e mostre plan resumido."\n\`\`\`\n→ Claude cria arquivos, roda terraform\n  init+validate+plan, mostra resultado\n\n**Debug de incidente (com MCP k8s):**\n\`\`\`\n"Latencia alta em payments desde 14:30.\nVerifique pods, eventos, logs 30min.\nSugira 3 causas mais provaveis."\n\`\`\`\n\n**Geracao de conteudo:**\n\`\`\`\n"Adicione topico sobre Cilium:\ntheory + quiz + flashcards + lab.\nSiga formato de content/networking/"\n\`\`\`\n\n**Principio:** uma instrucao com objetivo\ncompleto → Claude itera autonomamente\naté o resultado desejado.'
    },
    {
      front: 'Seguranca no uso de Claude Code em infra',
      back: '**Permissoes (settings.json):**\n\`\`\`json\n{\n  "permissions": {\n    "allow": ["Bash(kubectl get:*)",\n              "Bash(helm:*)",\n              "Bash(git:*)" ],\n    "deny": ["Bash(kubectl delete:*)",\n             "Bash(rm -rf:*)"]\n  }\n}\n\`\`\`\n\n**Principios de seguranca:**\n- Nunca configurar kubeconfig de prod\n  no ambiente de Claude Code autonomo\n- Usar contexts separados: dev/staging only\n- MCP com tokens de read-only para prod\n- Humano no loop para acoes irreversiveis\n\n**CLAUDE.md com restricoes:**\n\`\`\`markdown\n## Restricoes Criticas\n- NUNCA kubectl delete sem confirmar\n- NUNCA modificar secrets\n- Sempre dry-run antes de apply em prod\n\`\`\`\n\n**Hooks para auditoria:**\nRegistrar todas as acoes em log.'
    }
  ],
  lab: {
    scenario: 'Voce vai configurar o Claude Code para um projeto de plataforma Kubernetes, criar um CLAUDE.md estrategico, desenvolver uma skill de revisao de seguranca, e executar um workflow agentico de geracao de manifests.',
    objective: 'Configurar Claude Code com contexto de projeto via CLAUDE.md, criar skills customizadas, e executar workflows agenticos para tarefas de DevOps.',
    duration: '30-40 minutos',
    steps: [
      {
        title: 'Instalar e configurar o Claude Code',
        instruction: `Instale o Claude Code, autentique, e crie a estrutura inicial para um projeto de plataforma Kubernetes.`,
        hints: [
          'Voce precisa de Node.js 18+ instalado',
          'A autenticacao usa OAuth via browser',
          'O comando `claude` inicia o agente interativo no diretorio atual'
        ],
        solution: `\`\`\`bash
# 1. Instalar Claude Code globalmente
npm install -g @anthropic-ai/claude-code

# 2. Verificar instalacao
claude --version

# 3. Autenticar (abre browser para OAuth)
claude auth login

# 4. Criar estrutura do projeto
mkdir -p platform-infra/.claude/commands
cd platform-infra

# 5. Verificar que o Claude inicializa
claude --help
\`\`\``,
        verify: `\`\`\`bash
# Verificar instalacao
claude --version
# Saida esperada: @anthropic-ai/claude-code vX.X.X

# Verificar autenticacao
ls ~/.claude/
# Saida esperada: deve ter arquivo de config/token

# Estrutura do projeto
ls -la platform-infra/.claude/
# Saida esperada:
# drwxr-xr-x  commands/
\`\`\``
      },
      {
        title: 'Criar um CLAUDE.md estrategico',
        instruction: `Crie o arquivo \`CLAUDE.md\` para um projeto de plataforma Kubernetes com os seguintes elementos:
- Contexto do projeto (stack, cloud, time)
- Convencoes de nomenclatura
- Restricoes criticas de seguranca
- Comandos uteis do projeto
- Informacoes sobre o ambiente de cluster`,
        hints: [
          'O CLAUDE.md fica na raiz do projeto',
          'Seja especifico sobre versoes de ferramentas',
          'As restricoes de seguranca sao as mais importantes'
        ],
        solution: `\`\`\`bash
cat > platform-infra/CLAUDE.md << 'EOF'
# Platform Infra — Contexto para Claude Code

## Contexto do Projeto
- **Stack:** Kubernetes 1.29, Helm 3.14, ArgoCD 2.9, Prometheus/Grafana
- **Cloud:** AWS EKS em us-east-1 e us-west-2
- **Time:** Platform Engineering (5 eng), deploy 3x/semana
- **GitOps:** ArgoCD gerencia todos os deploys — nunca kubectl apply direto em prod

## Convencoes Obrigatorias
- Namespaces: \`<team>-<env>\` (ex: payments-prod, auth-staging)
- Labels obrigatorias: \`app\`, \`version\`, \`team\`, \`env\`, \`managed-by\`
- Tags de imagem: nunca usar \`latest\` — sempre versao semantica ou SHA
- Recursos: sempre definir requests E limits em todos os containers
- Probes: liveness E readiness em todos os workloads

## Restricoes Criticas de Seguranca
- **NUNCA** executar \`kubectl delete\` sem confirmacao explicita do usuario
- **NUNCA** hardcodar credenciais, tokens ou senhas em arquivos
- **NUNCA** usar \`privileged: true\` ou \`allowPrivilegeEscalation: true\`
- **SEMPRE** usar dry-run antes de aplicar mudancas em staging/prod
- **NUNCA** commitar diretamente para main — sempre criar branch + PR

## Comandos do Projeto
\`\`\`bash
make test           # Roda testes unitarios
make lint           # Valida YAML e HCL (kubeval + tfsec)
make deploy ENV=X   # Deploy para ambiente X
make plan ENV=X     # Terraform plan para ambiente X
kubectl-validate    # Valida todos YAMLs em ./manifests/
\`\`\`

## Ambientes de Cluster
- dev: kubeconfig em ~/.kube/config-dev — pode usar sem restricao
- staging: kubeconfig em ~/.kube/config-staging — dry-run primeiro
- prod: NUNCA configurar no ambiente do Claude Code

## Estrutura do Repositorio
\`\`\`
platform-infra/
├── manifests/          # Kubernetes YAML por namespace
├── helm/               # Helm charts internos
├── terraform/          # Modulos Terraform
│   ├── modules/        # Modulos reutilizaveis
│   └── environments/   # Config por ambiente
└── scripts/            # Scripts de automacao
\`\`\`
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verificar que o arquivo foi criado
cat platform-infra/CLAUDE.md

# O arquivo deve ter as seguintes secoes:
grep -E "^## " platform-infra/CLAUDE.md
# Saida esperada:
# ## Contexto do Projeto
# ## Convencoes Obrigatorias
# ## Restricoes Criticas de Seguranca
# ## Comandos do Projeto
# ## Ambientes de Cluster
# ## Estrutura do Repositorio

wc -l platform-infra/CLAUDE.md
# Saida esperada: mais de 40 linhas
\`\`\``
      },
      {
        title: 'Criar uma skill de revisao de seguranca Kubernetes',
        instruction: `Crie o arquivo de skill \`.claude/commands/k8s-security-review.md\` que instrui o Claude a revisar manifests Kubernetes em busca de problemas de seguranca.`,
        hints: [
          'Skills ficam em `.claude/commands/` dentro do projeto',
          'Use `$ARGUMENTS` para receber o arquivo ou diretorio como argumento',
          'Seja especifico sobre o formato de output esperado'
        ],
        solution: `\`\`\`bash
cat > platform-infra/.claude/commands/k8s-security-review.md << 'EOF'
# Kubernetes Security Review

Voce e um especialista em Kubernetes security com experiencia em CIS Benchmarks e NSA Kubernetes Hardening Guide.

Analise o arquivo ou diretorio: $ARGUMENTS

## Verificacoes Obrigatorias

### Criticas (HIGH)
- [ ] Container rodando como root (runAsNonRoot ausente ou false)
- [ ] Privilege escalation habilitada (allowPrivilegeEscalation: true)
- [ ] Capabilities desnecessarias (CAP_SYS_ADMIN, CAP_NET_ADMIN, etc)
- [ ] HostPID, HostNetwork ou HostIPC habilitados
- [ ] Volume hostPath para diretorios sensiveis (/etc, /var/run/docker.sock)

### Importantes (MEDIUM)
- [ ] Resource limits ausentes (CPU e Memory)
- [ ] Liveness ou readiness probe ausente
- [ ] ServiceAccount com permissoes excessivas
- [ ] Image usando tag "latest" ou sem digest SHA
- [ ] SeccompProfile ausente

### Melhorias (LOW)
- [ ] ReadOnlyRootFilesystem nao configurado
- [ ] PodAntiAffinity nao configurado para workloads criticos
- [ ] Sem annotation de owner/team
- [ ] Nao usa NetworkPolicy

## Formato de Resposta

Para cada problema encontrado, retorne:
1. **[SEVERIDADE]** Nome do problema
   - Arquivo: nome_arquivo.yaml, linha aproximada
   - Atual: o que esta configurado (ou ausente)
   - Correto: o que deveria estar
   - YAML fix:
   \`\`\`yaml
   # correcao exata
   \`\`\`

Finalize com um resumo: X problemas HIGH, Y MEDIUM, Z LOW.
Sugira a ordem de correcao por prioridade.
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verificar que a skill foi criada
ls platform-infra/.claude/commands/
# Saida esperada: k8s-security-review.md

cat platform-infra/.claude/commands/k8s-security-review.md
# Deve conter as secoes: verificacoes HIGH/MEDIUM/LOW e formato de resposta

# Testar a skill criando um YAML com problemas intencionais
cat > /tmp/test-deployment.yaml << 'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: insecure-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: insecure-app
  template:
    metadata:
      labels:
        app: insecure-app
    spec:
      containers:
      - name: app
        image: nginx:latest
        # sem resources, sem probes, sem securityContext
EOF

# Em uma sessao Claude Code: /k8s-security-review /tmp/test-deployment.yaml
# Deve identificar: latest tag, sem resources, sem probes, sem securityContext
echo "Skill criada com sucesso"
\`\`\``
      },
      {
        title: 'Executar um workflow agentico de geracao de manifests',
        instruction: `Crie um arquivo de instrucoes para um workflow agentico que gera um conjunto completo de manifests Kubernetes para um microservico. O Claude Code deve:
1. Criar Deployment, Service, HPA e NetworkPolicy
2. Validar cada manifest com kubectl dry-run
3. Gerar um resumo do que foi criado`,
        hints: [
          'Descreva o objetivo completo em uma instrucao, nao em steps separados',
          'O Claude Code vai criar os arquivos, executar validacoes e reportar',
          'Se voce tem Claude Code disponivel, teste interativamente'
        ],
        solution: `\`\`\`bash
# Criar o arquivo de instrucao do workflow
mkdir -p platform-infra/manifests/api-service

cat > platform-infra/manifests/api-service/GENERATE.md << 'EOF'
# Workflow: Gerar Manifests para api-service

## Instrucao para Claude Code

Crie o conjunto completo de manifests Kubernetes para o microservico api-service:

### Especificacoes
- Namespace: backend-prod
- Imagem: mycompany/api-service:v2.1.0
- Porta: 8080 (HTTP)
- Replicas: minimo 2, maximo 20
- CPU: request 250m, limit 1000m
- Memory: request 256Mi, limit 512Mi
- Endpoint de health: GET /health (liveness e readiness)

### Arquivos a Criar
1. deployment.yaml — Deployment com securityContext e probes
2. service.yaml — ClusterIP na porta 80 -> 8080
3. hpa.yaml — HPA baseado em CPU (target 70%)
4. networkpolicy.yaml — Permite apenas ingress do namespace ingress-nginx

### Validacao
Apos criar cada arquivo, executar:
kubectl apply --dry-run=client -f <arquivo>

### Resumo Final
Listar todos os recursos criados e confirmar que passaram no dry-run.
EOF

# Esse arquivo seria usado assim no Claude Code:
# claude
# > /read manifests/api-service/GENERATE.md e execute o workflow descrito
\`\`\`

\`\`\`yaml
# Resultado esperado — deployment.yaml
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
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
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
# Verificar estrutura do projeto final
ls -R platform-infra/
# Saida esperada:
# platform-infra/:
# CLAUDE.md  .claude/  manifests/
#
# platform-infra/.claude/commands/:
# k8s-security-review.md
#
# platform-infra/manifests/api-service/:
# GENERATE.md

# Validar o deployment exemplo
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
# Saida esperada: deployment.apps/api-service created (dry run)
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Claude Code perde contexto do CLAUDE.md em tarefas longas',
      difficulty: 'medium',
      symptom: 'Voce configurou um CLAUDE.md detalhado mas, no meio de uma tarefa longa com muitas iteracoes, o Claude Code começa a ignorar as convencoes definidas (ex: cria arquivos sem as labels obrigatorias, ou nao usa os comandos do projeto).',
      diagnosis: `\`\`\`bash
# 1. Verificar tamanho da janela de contexto em uso
# (nao tem comando direto, mas observar o comportamento)

# 2. Verificar se o CLAUDE.md esta sendo lido
# No inicio de uma nova sessao, pedir explicitamente:
# "Leia o CLAUDE.md e confirme as convencoes do projeto"

# 3. Verificar se o CLAUDE.md e muito longo
wc -l CLAUDE.md
# Se > 200 linhas, pode estar consumindo contexto demais

# 4. Verificar se ha informacoes duplicadas no CLAUDE.md
# que consomem tokens desnecessariamente
\`\`\``,
      solution: `**Causa:** em tarefas com muitas iteracoes, arquivos grandes e muitas mensagens, o contexto disponivel diminui e o modelo pode nao relere o CLAUDE.md. Adicionalmente, um CLAUDE.md muito extenso consome tokens que poderiam ser usados para a tarefa.

**Solucao 1 — CLAUDE.md conciso:**
Mantenha apenas o essencial. Remova exemplos longos — referencie arquivos em vez de copiar conteudo.
\`\`\`markdown
# Regras criticas (max 20 linhas aqui)
- Nunca kubectl delete sem confirmar
- Labels: app, version, team, env
- Veja ./docs/conventions.md para detalhes completos
\`\`\`

**Solucao 2 — Anchor de contexto no meio da tarefa:**
\`\`\`
"Antes de continuar, relembre as convencoes do CLAUDE.md:
labels obrigatorias, convencoes de namespace e restricoes de seguranca."
\`\`\`

**Solucao 3 — Iniciar nova conversa para sub-tarefas:**
Tarefas grandes devem ser divididas em sessoes menores. Use git para salvar o progresso entre sessoes.

**Solucao 4 — Referencias explicitas:**
\`\`\`
"Crie o manifest seguindo EXATAMENTE as convencoes do CLAUDE.md,
especialmente labels obrigatorias e proibicao de latest tag."
\`\`\``
    },
    {
      title: 'MCP server nao conecta ou retorna erros de permissao',
      difficulty: 'hard',
      symptom: 'Voce configurou o MCP server de Kubernetes no settings.json mas ao tentar usar o Claude Code para consultar o cluster, recebe "MCP server kubernetes not available" ou "permission denied" ao tentar listar recursos.',
      diagnosis: `\`\`\`bash
# 1. Verificar se o MCP server esta instalado
npx -y @mcp-servers/kubernetes --help 2>&1
# Se falhar: pacote nao encontrado ou problema de network

# 2. Verificar o settings.json
cat ~/.claude/settings.json | python3 -m json.tool
# Verificar syntax JSON valida e config do servidor

# 3. Verificar o kubeconfig
kubectl get nodes --kubeconfig \$KUBECONFIG 2>&1
# Deve funcionar antes de testar via MCP

# 4. Verificar permissoes do Service Account
kubectl auth can-i list pods --all-namespaces 2>&1
kubectl auth can-i get nodes 2>&1
# Deve retornar "yes"

# 5. Ver logs do Claude Code para erros de MCP
# Em modo debug:
ANTHROPIC_LOG=debug claude 2>&1 | grep -i mcp
\`\`\``,
      solution: `**Causa comum 1 — Pacote NPM nao encontrado:**
\`\`\`bash
# Verificar se o pacote existe com o nome correto
npm search @mcp-servers/kubernetes
# Instalar globalmente se necessario
npm install -g @mcp-servers/kubernetes
\`\`\`

**Causa comum 2 — Syntax incorreta no settings.json:**
\`\`\`json
// Correto:
{
  "mcpServers": {
    "kubernetes": {
      "command": "npx",
      "args": ["-y", "@mcp-servers/kubernetes"],
      "env": {
        "KUBECONFIG": "/home/usuario/.kube/config"
      }
    }
  }
}
// ERRO COMUM: usar ~ no path — expandir para path absoluto
\`\`\`

**Causa comum 3 — Permissoes insuficientes no kubeconfig:**
\`\`\`bash
# Verificar as permissoes do usuario no cluster
kubectl auth can-i list pods -A
kubectl auth can-i get nodes

# Se "no", criar um ServiceAccount com permissoes adequadas
# ou usar um kubeconfig de um usuario com mais permissoes
\`\`\`

**Causa comum 4 — KUBECONFIG invalido:**
\`\`\`bash
# Testar o kubeconfig diretamente
kubectl get nodes --kubeconfig /path/to/kubeconfig
# Se falhar aqui, o MCP tambem vai falhar
\`\`\``
    }
  ]
};
