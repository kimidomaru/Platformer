window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['ai-engineering/copilot-devops'] = {
  theory: `
# GitHub Copilot para DevOps & Infraestrutura

## Relevancia
GitHub Copilot e a ferramenta de AI mais adotada no mercado de desenvolvimento. Para DevOps/SRE/Platform Engineers, vai alem de autocompletar codigo Python — o valor real esta em acelerar escrita de Terraform, Helm charts, pipelines CI/CD, scripts de automacao e responder perguntas sobre tecnologias de infra diretamente no terminal.

## O que e o GitHub Copilot (realmente)

### Componentes principais

\`\`\`
GitHub Copilot Individual/Business/Enterprise
├── Copilot in IDE          → autocomplete inline + chat no editor
├── Copilot Chat            → conversa contextual no VS Code/JetBrains
├── Copilot CLI             → sugestoes de comandos no terminal
└── Copilot in GitHub.com   → chat em PRs, issues, codigo
\`\`\`

### Como o contexto funciona

O Copilot envia automaticamente para o modelo:
- O arquivo que voce esta editando (ou o trecho visivel)
- Arquivos abertos nas abas vizinhas
- Arquivos importados/relacionados (em alguns modos)
- Para Copilot Chat: o que voce seleciona explicitamente

**Implicacao pratica:** mantenha arquivos relacionados abertos. Se voce esta escrevendo um Deployment, abra o Service e o HPA tambem — o contexto melhora drasticamente as sugestoes.

## Copilot no VS Code para IaC

### Configuracao inicial

\`\`\`bash
# Instalar extensao
code --install-extension GitHub.copilot
code --install-extension GitHub.copilot-chat

# Verificar autenticacao
gh auth login
gh auth status
\`\`\`

### Atalhos essenciais (VS Code)

\`\`\`
Tab               → Aceitar sugestao inline
Esc               → Rejeitar sugestao
Alt+]             → Proxima sugestao
Alt+[             → Sugestao anterior
Ctrl+Enter        → Abrir painel com multiplas sugestoes
Ctrl+I            → Abrir Copilot Chat inline (no arquivo)
Ctrl+Shift+I      → Abrir Copilot Chat na sidebar
\`\`\`

### Gerando Terraform com Copilot

\`\`\`hcl
# Tecnica 1: comentario descritivo antes do bloco
# Create an EKS cluster with:
# - 3 node groups: system (t3.medium), app (t3.large), gpu (g4dn.xlarge)
# - Private API endpoint, public access from office CIDR only
# - Managed node groups with auto-scaling min=1 max=10
# - IRSA enabled, cluster autoscaler IAM policy attached

resource "aws_eks_cluster" "main" {
  # Copilot vai gerar o bloco completo a partir desse comentario
}
\`\`\`

\`\`\`hcl
# Tecnica 2: nome descritivo do recurso
# O Copilot infere o que voce quer pelo nome
resource "aws_security_group" "eks_nodes_allow_internal_traffic" {
  # Copilot entende: regras de ingress/egress para nos EKS
}
\`\`\`

\`\`\`hcl
# Tecnica 3: comece com um exemplo e repita o padrao
resource "aws_route53_record" "api" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "api.example.com"
  type    = "CNAME"
  ttl     = 300
  records = [aws_lb.api.dns_name]
}

# Agora comece "resource "aws_route53_record" "admin" {"
# O Copilot vai sugerir o mesmo padrao com "admin"
\`\`\`

### Gerando Kubernetes YAML com Copilot

\`\`\`yaml
# Copilot no YAML: use comentarios inline descritivos

# Deployment for the payment service
# 3 replicas, RollingUpdate strategy with maxSurge=1 maxUnavailable=0
# Requests: 200m CPU, 256Mi memory / Limits: 1000m CPU, 1Gi memory
# Readiness probe: HTTP /health on port 8080, initialDelay 30s
# Anti-affinity: spread across different nodes
apiVersion: apps/v1
kind: Deployment
metadata:
  # O Copilot completa com name, namespace, labels corretos
\`\`\`

**Dica de produtividade:** escreva os comentarios ANTES do YAML. Copilot usa o comentario como spec funcional e gera o manifest completo.

### Gerando scripts Shell/Python com Copilot

\`\`\`bash
#!/bin/bash
# Script: find pods with high memory usage and restart them
# Threshold: 90% of memory limit
# Actions: log the pod, send Slack notification, then restart
# Required env vars: SLACK_WEBHOOK_URL, NAMESPACE, THRESHOLD_PERCENT

# Copilot vai gerar o script inteiro a partir desse cabecalho
\`\`\`

## Copilot Chat — uso avancado para infra

### Contexto explicito com @workspace, #file

\`\`\`
# Referenciar arquivos especificos
@workspace Explique o que esse Helm chart faz e identifique problemas de seguranca
#file:values.yaml Quais valores sao obrigatorios mas estao sem default?
#file:deployment.yaml #file:hpa.yaml Esses dois arquivos sao consistentes?

# Selecionar trecho e perguntar
[selecione um bloco de YAML] → Ctrl+I → "Adicione liveness e readiness probes nesse Deployment"
\`\`\`

### Slash commands uteis no Copilot Chat

\`\`\`
/explain    → Explica o codigo/YAML selecionado
/fix        → Sugere correcao para o problema selecionado
/tests      → Gera testes para o codigo selecionado
/doc        → Gera documentacao (bom para modulos Terraform)
/new        → Cria um novo arquivo (scaffold)
\`\`\`

### Casos de uso praticos

\`\`\`
# Revisar um Helm chart completo
"@workspace Voce e um especialista em Kubernetes security.
Revise o #file:templates/deployment.yaml e identifique:
1. Containers rodando como root
2. Campos de security context ausentes
3. Resource limits nao configurados
Retorne uma lista de problemas por ordem de severidade."

# Gerar variaveis Terraform a partir de um modulo existente
"Analise o #file:main.tf e gere o arquivo variables.tf com
todas as variaveis necessarias, tipos corretos e descricoes."

# Explicar um erro de CI
"Esse e o log do meu GitHub Actions que falhou:
[cole o log]
Qual e a causa e como corrigir?"
\`\`\`

## Copilot CLI — comandos no terminal

### Instalacao e setup

\`\`\`bash
# Instalar extensao CLI
gh extension install github/gh-copilot

# Verificar instalacao
gh copilot --help
\`\`\`

### Comandos principais

\`\`\`bash
# Sugerir um comando (sem executar)
gh copilot suggest "find all pods with more than 2 restarts in namespace production"

# Saida esperada:
# kubectl get pods -n production --field-selector=status.phase=Running \
#   -o jsonpath='{range .items[*]}{.metadata.name}{" "}{.status.containerStatuses[0].restartCount}{"\n"}{end}' \
#   | awk '$2 > 2'

# Explicar um comando que voce nao entende
gh copilot explain "kubectl get pods -o jsonpath='{.items[*].spec.nodeName}' | tr ' ' '\n' | sort | uniq -c"

# Modo interativo com tipo de shell
gh copilot suggest -t shell "compress all log files older than 7 days and upload to S3"
gh copilot suggest -t git "undo the last commit but keep the changes staged"
gh copilot suggest -t gh "list all open PRs assigned to me with CI failing"
\`\`\`

### Alias para uso rapido

\`\`\`bash
# Adicionar ao ~/.bashrc ou ~/.zshrc
alias '??'='gh copilot suggest -t shell'
alias 'git?'='gh copilot suggest -t git'
alias 'k?'='gh copilot suggest -t shell "kubectl"'

# Uso:
?? "create a cronjob that runs every hour"
k? "get all pods sorted by memory usage"
\`\`\`

## Copilot em JetBrains (GoLand, IntelliJ, PyCharm)

\`\`\`
Instalar: Settings → Plugins → Marketplace → "GitHub Copilot"

Atalhos:
Alt+\       → Aceitar sugestao
Tab         → Aceitar proxima palavra
Alt+]       → Proxima sugestao alternativa
Alt+[       → Sugestao anterior
Alt+Shift+\ → Abrir Copilot Chat
\`\`\`

**Diferenca vs VS Code:** JetBrains tem melhor suporte a linguagens de backend (Go, Java, Python) mas o Copilot Chat no VS Code e mais maduro para uso com IaC e YAML.

## Limitacoes Importantes

\`\`\`
1. Nao tem acesso ao seu cluster/cloud
   → Nao sabe o estado atual dos seus recursos
   → Nao pode fazer kubectl get ou terraform state show

2. Nao tem acesso a documentacao atualizada
   → Pode sugerir APIs depreciadas (knowledge cutoff)
   → Sempre validar contra docs oficiais

3. Nao entende o contexto do seu negocio
   → Nomes de namespaces, convencoes internas, cost centers
   → Fornecer contexto explicito nos comentarios

4. Pode sugerir codigo inseguro
   → Nao assume hardcoded secrets como errado se voce nao indicou
   → Sempre revisar com foco em seguranca

5. Sugestoes nao sao determinísticas
   → O mesmo comentario pode gerar YAML diferente
   → Itere at obter o resultado desejado
\`\`\`

## Workflow Recomendado para IaC com Copilot

\`\`\`
1. Escrever comentario descritivo como spec
   ↓
2. Aceitar sugestao base do Copilot
   ↓
3. Ajustar com Copilot Chat (refinamentos)
   ↓
4. Validar: terraform validate / kubectl dry-run
   ↓
5. Revisar seguranca: tfsec / checkov / kubesec
   ↓
6. Commit
\`\`\`

## Erros Comuns

1. **Aceitar sugestoes sem ler** — Copilot pode gerar \`privileged: true\` ou ports erradas
2. **Nao dar contexto** — comentarios vagos geram YAML generico; seja especifico
3. **Nao usar abas abertas** — fechar arquivos relacionados empobrece as sugestoes
4. **Confiar em versoes de providers** — \`aws = "~> 4.0"\` pode estar desatualizado; verificar Terraform Registry
5. **Nao configurar .gitignore** — Copilot nao sabe o que e segredo; nunca commitar o que ele gera sem revisar

## Killer.sh Style Challenge

> **Cenario:** Voce precisa criar um modulo Terraform para um EKS cluster com node groups, IRSA e cluster autoscaler. Use o Copilot de forma otimizada: escreva os comentarios que voce usaria como "spec" para guiar o Copilot na geracao do \`main.tf\`, \`variables.tf\` e \`outputs.tf\`. O objetivo e um modulo reutilizavel e seguro.
`,
  quiz: [
    {
      question: 'Qual e a melhor estrategia para usar o GitHub Copilot ao escrever um Deployment YAML complexo com anti-affinity, resource limits e probes?',
      options: [
        'Comece digitando o YAML e deixe o Copilot completar campo por campo',
        'Escreva um comentario descritivo acima do recurso especificando todos os requisitos como "spec", depois deixe o Copilot gerar o bloco completo',
        'Use o Copilot Chat e peca o YAML direto sem abrir o arquivo',
        'O Copilot nao e adequado para YAML — use apenas para Python/Go'
      ],
      correct: 1,
      explanation: 'Usar comentarios descritivos como "spec" antes do recurso e a tecnica mais eficaz. O Copilot interpreta o comentario como especificacao funcional e gera o YAML completo alinhado ao descrito. Isso e mais eficiente do que digitar campo por campo e produz resultados mais consistentes do que pedir via Chat sem arquivo aberto.',
      reference: 'Tecnica relacionada: "Prompt via comment" — o mesmo principio funciona para Terraform, scripts bash e modulos Python.'
    },
    {
      question: 'O que o comando `gh copilot suggest -t shell "find pods with crashloopbackoff"` faz?',
      options: [
        'Executa o comando kubectl automaticamente no cluster',
        'Sugere um comando shell para encontrar pods em CrashLoopBackOff, sem executar',
        'Instala o plugin kubectl-crashloop automaticamente',
        'Envia o resultado para o GitHub Issues'
      ],
      correct: 1,
      explanation: '`gh copilot suggest` apenas SUGERE o comando, nunca executa. O flag `-t shell` indica que voce quer um comando shell (vs git ou gh). O Copilot CLI e seguro por design — voce ve a sugestao e decide se executa. Isso e importante para comandos destrutivos ou complexos.',
      reference: 'Comando complementar: `gh copilot explain "<comando>"` explica o que um comando faz — util para entender pipes e flags complexas.'
    },
    {
      question: 'Por que manter arquivos relacionados abertos no VS Code melhora as sugestoes do Copilot para Kubernetes YAML?',
      options: [
        'Nao melhora — o Copilot so usa o arquivo atual',
        'O Copilot envia os arquivos abertos como contexto adicional para o modelo, melhorando a coerencia entre recursos relacionados (Deployment + Service + HPA)',
        'Arquivos abertos sao indexados no GitHub para treinamento',
        'O Copilot so funciona quando todos os arquivos do projeto estao abertos'
      ],
      correct: 1,
      explanation: 'O Copilot envia automaticamente o contexto dos arquivos abertos nas abas vizinhas ao modelo. Se voce tem um Deployment aberto e abre tambem o Service e o HPA, o Copilot entende a relacao entre eles — sugere selectors consistentes, mesmas labels, ports coerentes. Sem esse contexto, as sugestoes sao mais genericas.',
      reference: 'Dica avancada: para projetos grandes, use `@workspace` no Copilot Chat para indexar todos os arquivos do workspace como contexto.'
    },
    {
      question: 'Qual e a limitacao mais critica do GitHub Copilot para uso em infraestrutura de producao?',
      options: [
        'Funciona apenas com repositorios publicos no GitHub',
        'Nao tem acesso ao estado atual do seu cluster ou cloud — nao sabe o que esta deployado, pode sugerir configs desatualizadas e pode incluir praticas inseguras se o contexto nao especificar',
        'Nao suporta YAML, apenas linguagens de programacao tradicionais',
        'Requer conexao com cluster Kubernetes para funcionar'
      ],
      correct: 1,
      explanation: 'Copilot nao tem acesso ao estado real do seu ambiente — nao pode fazer kubectl get, terraform state show, ou ver o que esta deployado. Ele gera baseado em padroes do treinamento. Consequencias: pode sugerir versoes de imagens antigas, configuracoes inconsistentes com seu ambiente, ou valores de resource limits inadequados para seus workloads reais. Sempre validar contra o estado real.',
      reference: 'Solucao: para contexto do estado atual, use ferramentas que integram LLMs com acesso ao cluster — como MCP servers para kubectl no Claude Code.'
    },
    {
      question: 'Qual slash command do Copilot Chat e mais util para auditar um modulo Terraform em busca de problemas de seguranca?',
      options: [
        '/tests — gera testes de seguranca automaticamente',
        '/fix — corrige todos os problemas automaticamente',
        '/explain combinado com uma pergunta especifica sobre seguranca — entende o modulo e identifica riscos',
        '/new — recria o modulo do zero com boas praticas'
      ],
      correct: 2,
      explanation: 'Nao existe um slash command especifico para security audit. A abordagem mais eficaz e usar /explain ou simplesmente fazer uma pergunta direta no Copilot Chat com contexto especifico: "@workspace Voce e um especialista em seguranca cloud. Identifique problemas de seguranca no #file:main.tf — foque em IAM overpermission, recursos publicos expostos e ausencia de encryption." /fix e util mas deve ser revisado — nao aceite cegamente.',
      reference: 'Ferramenta complementar: use `checkov` ou `tfsec` para analise estatica automatizada de seguranca em Terraform, separadamente do Copilot.'
    },
    {
      question: 'Qual e o workflow correto para usar Copilot ao criar um script bash de automacao de producao?',
      options: [
        'Pedir o script completo via chat, copiar e executar diretamente em producao',
        'Escrever o cabecalho do script com comentarios detalhando objetivo, variaveis requeridas e acoes — deixar Copilot gerar — revisar e validar em ambiente seguro antes de usar',
        'Usar apenas para scripts de desenvolvimento, nunca para producao',
        'Sempre regenerar o script do zero antes de cada uso'
      ],
      correct: 1,
      explanation: 'O workflow correto: (1) cabecalho descritivo como spec → (2) Copilot gera o corpo → (3) revisao critica do script gerado → (4) teste em ambiente nao critico → (5) uso em producao. Pular qualquer etapa e arriscado — Copilot pode gerar comandos com flags erradas, paths hardcoded ou logica incorreta que so aparece em edge cases.',
      reference: 'Pratica relacionada: nunca usar `rm -rf` ou comandos destrutivos gerados por LLM sem revisar linha por linha.'
    },
    {
      question: 'Como o alias `alias "??=gh copilot suggest -t shell"` melhora o workflow de um SRE no terminal?',
      options: [
        'Executa automaticamente o comando sugerido',
        'Permite digitar `?? "descricao do que precisa"` para obter sugestoes de comandos shell rapidamente, sem sair do terminal',
        'Substitui o manual do kubectl',
        'Instala novos plugins automaticamente'
      ],
      correct: 1,
      explanation: 'O alias permite fazer perguntas em linguagem natural sobre comandos shell sem sair do terminal. Em vez de pausar, abrir o browser e pesquisar, voce digita `?? "list namespaces sorted by pod count"` e recebe a sugestao inline. Aumenta o fluxo de trabalho sem interromper o contexto. A sugestao ainda precisa ser revisada antes de executar.',
      reference: 'Dica: crie aliases separados para contextos diferentes — `k?` para kubectl, `tf?` para terraform, `git?` para git.'
    }
  ],
  flashcards: [
    {
      front: 'GitHub Copilot — componentes para DevOps/SRE',
      back: '**Copilot in IDE (VS Code / JetBrains)**\n- Autocomplete inline em YAML, Terraform, scripts\n- Copilot Chat com contexto de arquivos\n- Slash commands: /explain, /fix, /doc, /tests\n\n**Copilot CLI**\n- `gh copilot suggest -t shell "<desc>"` → sugere comandos\n- `gh copilot explain "<cmd>"` → explica comandos\n- Flags: `-t shell`, `-t git`, `-t gh`\n\n**Atalhos VS Code:**\n- Tab → aceitar sugestao\n- Ctrl+I → chat inline\n- Ctrl+Enter → multiplas sugestoes\n- Alt+] / Alt+[ → navegar sugestoes\n\n**Contexto automático:**\n- Arquivo atual + abas abertas\n- @workspace → indexa projeto\n- #file:x.yaml → referencia explícita'
    },
    {
      front: 'Tecnica "Spec via Comment" para IaC com Copilot',
      back: '**O que e:**\nEscrever comentarios detalhados ANTES do recurso,\ndescrevendo todos os requisitos. O Copilot usa\no comentario como especificacao funcional.\n\n**Template para YAML:**\n\`\`\`yaml\n# Deployment para o servico X\n# - 3 replicas, RollingUpdate maxUnavailable=0\n# - Resources: 200m/256Mi req, 1000m/1Gi limit\n# - Liveness: /health:8080, delay 30s\n# - Anti-affinity: spread por nodes\napiVersion: apps/v1\nkind: Deployment\n\`\`\`\n\n**Template para Terraform:**\n\`\`\`hcl\n# EKS cluster com:\n# - Private endpoint only\n# - 3 node groups: system/app/spot\n# - IRSA enabled, logging: audit+api\nresource "aws_eks_cluster" "main" {\n\`\`\`\n\n**Regra:** quanto mais especifico o comentario,\nmelhor o codigo gerado.'
    },
    {
      front: 'Copilot CLI — comandos essenciais para SRE',
      back: '**Instalacao:**\n`gh extension install github/gh-copilot`\n\n**Suggest (nao executa):**\n`gh copilot suggest "descrição"`\n`gh copilot suggest -t shell "kubectl..."`\n`gh copilot suggest -t git "undo last commit"`\n`gh copilot suggest -t gh "list PRs..."`\n\n**Explain:**\n`gh copilot explain "<comando-complexo>"`\n\n**Aliases uteis:**\n\`\`\`bash\nalias "??=gh copilot suggest -t shell"\nalias "git?=gh copilot suggest -t git"\n\`\`\`\n\n**Exemplos de uso:**\n`?? "find pods consuming more than 500Mi memory"`\n`?? "create configmap from all files in /config dir"`\n`git? "squash last 5 commits"`\n\n**IMPORTANTE:** sempre revisar antes de executar!'
    },
    {
      front: 'Copilot Chat — contexto e referencias',
      back: '**Referenciar arquivos:**\n- `#file:deployment.yaml` → inclui o arquivo\n- `#file:values.yaml #file:chart.yaml` → multiplos\n\n**Workspace:**\n- `@workspace` → indexa todo o projeto\n\n**Slash commands:**\n- `/explain` → explica codigo selecionado\n- `/fix` → sugere correcao\n- `/tests` → gera testes\n- `/doc` → gera documentacao\n- `/new` → scaffold de arquivo novo\n\n**Prompts eficazes:**\n\`\`\`\n"@workspace Voce e um k8s security expert.\nAnalise #file:deployment.yaml:\n1. Containers rodando como root?\n2. Security context ausente?\n3. Capabilities desnecessarias?\nListe por severidade."\n\`\`\`\n\n**Atalho:** selecione texto + Ctrl+I\npara chat contextual inline.'
    },
    {
      front: 'Limitacoes do Copilot para infra — o que nao esperar',
      back: '**1. Sem acesso ao ambiente real**\n- Nao ve seu cluster, nao faz kubectl get\n- Nao conhece estado atual do terraform state\n- Sugestoes baseadas em padroes, nao no seu ambiente\n\n**2. Knowledge cutoff**\n- Providers Terraform podem estar desatualizados\n- APIs K8s depreciadas podem aparecer\n→ Sempre verificar versoes no registro oficial\n\n**3. Sem contexto de negocio**\n- Nao sabe suas convencoes de nomenclatura\n- Nao conhece seus cost centers ou compliance rules\n→ Adicionar no comentario/contexto\n\n**4. Pode gerar codigo inseguro**\n- `privileged: true` se o contexto nao proibir\n- IAM policies com `*:*` se voce nao especificar\n→ Sempre revisar com foco em seguranca\n\n**5. Nao deterministico**\n→ Itere ate obter o resultado desejado'
    },
    {
      front: 'Workflow otimizado: Copilot + IaC',
      back: '**Para Terraform:**\n1. Comentario como spec (requisitos completos)\n2. Copilot gera o bloco\n3. Abrir variaveis e outputs nas abas\n4. Pedir `/doc` para documentar o modulo\n5. `terraform validate && terraform plan`\n6. `tfsec .` ou `checkov -d .` para seguranca\n\n**Para Kubernetes YAML:**\n1. Comentario descritivo antes do recurso\n2. Copilot gera o manifest\n3. `kubectl apply --dry-run=client -f file.yaml`\n4. `kubesec scan file.yaml`\n5. Review manual de security context\n\n**Para scripts bash:**\n1. Cabecalho com objetivo + variaveis + acoes\n2. Copilot gera o corpo\n3. Revisar linha por linha\n4. Testar com dados de dev/staging\n5. Adicionar error handling manualmente\n\n**Regra de ouro:**\nCopilot acelera, voce revisa.\nNunca em producao sem validacao.'
    }
  ],
  lab: {
    scenario: 'Voce e um DevOps Engineer que precisa configurar infraestrutura para um novo microservico. Usara o GitHub Copilot CLI e Chat para acelerar a criacao de manifests Kubernetes, um modulo Terraform e um script de deploy — tudo em tempo recorde.',
    objective: 'Dominar o uso do GitHub Copilot CLI (`gh copilot suggest`/`explain`) e aprender a escrever "specs via comentario" para gerar YAML e HCL de alta qualidade com Copilot.',
    duration: '25-30 minutos',
    steps: [
      {
        title: 'Instalar e verificar o Copilot CLI',
        instruction: `Instale a extensao GitHub Copilot para o CLI do \`gh\` e verifique se esta funcionando corretamente.`,
        hints: [
          'Use `gh extension install github/gh-copilot`',
          'Certifique-se de estar autenticado: `gh auth status`',
          'Se nao tiver o gh instalado: https://cli.github.com'
        ],
        solution: `\`\`\`bash
# Autenticar no GitHub CLI (se necessario)
gh auth login

# Instalar a extensao Copilot
gh extension install github/gh-copilot

# Verificar instalacao
gh copilot --version
gh copilot --help

# Configurar aliases (adicionar ao .bashrc/.zshrc)
echo 'alias "??=gh copilot suggest -t shell"' >> ~/.bashrc
source ~/.bashrc
\`\`\``,
        verify: `\`\`\`bash
# Verificar se a extensao esta instalada
gh extension list | grep copilot

# Saida esperada:
# gh copilot  github/gh-copilot  vX.X.X

# Testar um suggest simples
gh copilot suggest "list all kubernetes namespaces"
# Saida esperada: kubectl get namespaces (ou similar)
\`\`\``
      },
      {
        title: 'Usar Copilot CLI para comandos kubectl',
        instruction: `Use o \`gh copilot suggest\` para gerar os seguintes comandos sem memoriza-los:
1. Listar todos os pods em crashloopbackoff em qualquer namespace
2. Pegar os logs dos ultimos 5 minutos de um pod especifico
3. Encontrar os 5 pods consumindo mais memoria no cluster
4. Fazer o explain de um comando kubectl complexo que voce nao entende`,
        hints: [
          'Use `gh copilot suggest -t shell "..."` para sugestoes de shell',
          'Use `gh copilot explain "<comando>"` para explicar comandos',
          'Descreva o que voce quer em ingles ou portugues'
        ],
        solution: `\`\`\`bash
# 1. Pods em CrashLoopBackOff
gh copilot suggest -t shell "list all pods in crashloopbackoff across all namespaces"
# Resultado esperado similar a:
kubectl get pods -A --field-selector=status.phase!=Running | grep CrashLoop
# OU
kubectl get pods -A | grep CrashLoopBackOff

# 2. Logs dos ultimos 5 minutos
gh copilot suggest -t shell "get kubernetes pod logs from the last 5 minutes"
# Resultado esperado:
kubectl logs <pod-name> --since=5m

# 3. Top 5 pods por memoria
gh copilot suggest -t shell "get top 5 kubernetes pods by memory usage"
# Resultado esperado:
kubectl top pods -A --sort-by=memory | head -6

# 4. Explicar um comando complexo
gh copilot explain "kubectl get pods -o jsonpath='{range .items[*]}{.metadata.name}{\"\t\"}{.status.phase}{\"\n\"}{end}'"
\`\`\``,
        verify: `\`\`\`bash
# Verificar que o copilot CLI responde
gh copilot suggest -t shell "get all kubernetes namespaces" 2>&1
# Saida esperada: um comando kubectl valido (nao um erro de autenticacao)

# Testar o explain
gh copilot explain "kubectl get nodes -o wide" 2>&1
# Saida esperada: explicacao do que o comando faz
\`\`\``
      },
      {
        title: 'Gerar Kubernetes YAML com "Spec via Comment"',
        instruction: `Crie um arquivo \`payment-service.yaml\` usando a tecnica de "spec via comentario" com o Copilot no VS Code (ou edite manualmente se nao tiver o VS Code). O arquivo deve conter um Deployment e um Service para o payment service com os seguintes requisitos:
- 3 replicas, RollingUpdate com maxUnavailable=0
- Image: mycompany/payment-service:v1.2.0
- CPU: request 200m, limit 1000m; Memory: request 256Mi, limit 512Mi
- Liveness probe HTTP /health port 8080, delay 30s
- Readiness probe HTTP /ready port 8080, delay 10s
- Service ClusterIP na porta 80 → 8080`,
        hints: [
          'Escreva o comentario completo ANTES de comecar o YAML',
          'No VS Code, apos o comentario, comece com `apiVersion:` e pressione Tab',
          'Se sem VS Code, use o template manual abaixo como referencia',
          'O objetivo e praticar a tecnica, nao o resultado perfeito'
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
# Validar o YAML sem cluster
kubectl apply --dry-run=client -f payment-service.yaml
# Saida esperada:
# deployment.apps/payment-service created (dry run)
# service/payment-service created (dry run)

# Verificar estrutura com kubeval (se disponivel)
# kubeconform -strict payment-service.yaml
# Saida esperada: nenhum erro de schema

# Se tiver cluster disponivel:
kubectl apply -f payment-service.yaml
kubectl get deployment payment-service
# Saida esperada: READY 3/3
\`\`\``
      },
      {
        title: 'Usar Copilot para Debug e Troubleshooting',
        instruction: `Pratique usando o Copilot CLI para diagnosticar problemas comuns. Para cada cenario abaixo, use \`gh copilot suggest\` para gerar o comando de diagnostico:
1. Um pod esta no estado Pending — como investigar?
2. Um Service nao esta recebendo trafico — como debugar?
3. Um node esta com NotReady — como investigar?`,
        hints: [
          'Seja especifico na descricao: "kubernetes pod stuck in pending state - investigate why"',
          'Use explain para entender os comandos sugeridos',
          'Combine com "step by step" na descricao para obter uma sequencia de comandos'
        ],
        solution: `\`\`\`bash
# 1. Pod em Pending
gh copilot suggest -t shell "kubernetes pod stuck in pending - step by step investigation"
# Comandos esperados similar a:
kubectl describe pod <pod-name> | grep -A 10 Events
kubectl get events --sort-by=.metadata.creationTimestamp
kubectl describe nodes | grep -A 5 "Allocated resources"

# 2. Service sem trafico
gh copilot suggest -t shell "kubernetes service not receiving traffic - debug endpoints and selectors"
# Comandos esperados similar a:
kubectl get endpoints <service-name>
kubectl describe service <service-name>
kubectl get pods -l app=<app-label>

# 3. Node NotReady
gh copilot suggest -t shell "kubernetes node notready - investigate causes"
# Comandos esperados similar a:
kubectl describe node <node-name>
kubectl get node <node-name> -o yaml | grep -A 20 conditions
# No node (via SSH):
systemctl status kubelet
journalctl -u kubelet -n 50
\`\`\``,
        verify: `\`\`\`bash
# Verificar que os comandos do Copilot sao executaveis
# Teste o primeiro conjunto (pod pending) com um pod real ou fake:
kubectl run test-pod --image=nginx --dry-run=client -o yaml | kubectl apply -f -
kubectl get pod test-pod
kubectl describe pod test-pod | grep -A 5 Events

# Limpar
kubectl delete pod test-pod --ignore-not-found=true
# Saida esperada: pod "test-pod" deleted
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Copilot sugere recursos Terraform com versoes de provider desatualizadas',
      difficulty: 'easy',
      symptom: 'O Copilot gerou um modulo Terraform com `aws_eks_cluster` usando atributos que nao existem mais na versao atual do provider `hashicorp/aws`, causando erros no `terraform plan`.',
      diagnosis: `\`\`\`bash
# 1. Verificar qual versao do provider esta sendo usada
cat versions.tf | grep -A 5 required_providers

# 2. Ver a versao mais recente no Terraform Registry
# https://registry.terraform.io/providers/hashicorp/aws/latest

# 3. Verificar o erro especifico
terraform init
terraform validate
# Saida: An argument named "X" is not expected here.

# 4. Verificar a documentacao real do recurso
# https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/eks_cluster
\`\`\``,
      solution: `**Causa:** Copilot foi treinado com dados ate uma certa data. O provider AWS Terraform e atualizado frequentemente — atributos mudam, blocos sao adicionados/removidos.

**Solucao 1 — Verificar o Registry:**
\`\`\`bash
# Sempre verificar a documentacao real do recurso no Registry
# Abrir: https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/<recurso>
\`\`\`

**Solucao 2 — Melhorar o prompt para o Copilot:**
\`\`\`
# Adicionar a versao do provider no comentario
# EKS cluster - use hashicorp/aws provider v5.x
# Reference: https://registry.terraform.io/providers/hashicorp/aws/5.0.0
\`\`\`

**Solucao 3 — Validar automaticamente:**
\`\`\`bash
terraform init -upgrade  # Atualiza providers
terraform validate       # Valida syntax e tipos
# Corrigir os atributos errados manualmente
\`\`\`

**Prevencao:** sempre fixar versoes de providers e validar contra o Registry antes de commitar.`
    },
    {
      title: 'Copilot Chat perde contexto em conversas longas de debug',
      difficulty: 'medium',
      symptom: 'Voce esta usando o Copilot Chat para debugar um problema complexo. Apos varias mensagens trocando logs e configs, o Copilot comeca a dar sugestoes genericas que ignoram o contexto anterior — como se tivesse "esquecido" o problema inicial.',
      diagnosis: `\`\`\`bash
# Sinais de que o contexto foi perdido:
# 1. Copilot repete sugestoes que voce ja tentou
# 2. Ignora restricoes que voce mencionou antes
# 3. Da respostas genericas de "kubectl describe pod"
#    mesmo depois de voce ter compartilhado o output

# Nao tem um comando para verificar isso diretamente,
# mas a observacao do comportamento e clara
\`\`\``,
      solution: `**Causa:** Copilot Chat tem janela de contexto limitada. Conversas longas com muito texto (logs, YAMLs) consomem o contexto rapidamente, e o modelo "esquece" o inicio.

**Solucao 1 — Resumo de contexto:**
\`\`\`
# Ao notar perda de contexto, adicione um "anchor":
"Resumo do problema so far:
- Servico: payment-api no namespace prod
- Sintoma: 503 esporadico a cada ~5 min
- Ja tentado: restart de pod, aumento de replicas
- Suspeita atual: connection pool exhaustion
Com base nisso, como investigar o pool de conexoes?"
\`\`\`

**Solucao 2 — Nova conversa com contexto comprimido:**
\`\`\`
# Comece uma nova conversa com contexto resumido
"Contexto: Kubernetes 1.29, EKS, payment-api em Node.js.
Problema: 503 esporadico. Logs mostram: [cole apenas as linhas relevantes]
Configuracao atual: [cole apenas o trecho relevante do YAML]
Pergunta: ..."
\`\`\`

**Solucao 3 — Usar arquivos como contexto em vez de colar no chat:**
\`\`\`
# Em vez de colar 200 linhas de log no chat:
#file:payment-api-logs.txt Analise apenas as linhas com ERROR ou WARN
\`\`\`

**Prevencao:** conversas de debug devem ser focadas — uma conversa por problema, com contexto minimo necessario.`
    }
  ]
};
