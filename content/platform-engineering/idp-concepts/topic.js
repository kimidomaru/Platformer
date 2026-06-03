window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['platform-engineering/idp-concepts'] = {
  theory: `
# Internal Developer Platforms (IDPs)

## Relevancia
Platform Engineering e a disciplina de projetar e construir toolchains e workflows internos que habilitam self-service para desenvolvedores. Um IDP (Internal Developer Platform) reduz carga cognitiva, padroniza operacoes e acelera delivery. E o proximo passo alem de DevOps e SRE.

## Conceitos Fundamentais

### O que e Platform Engineering?

Platform Engineering e a pratica de construir e manter plataformas internas que abstraem complexidade de infraestrutura para equipes de desenvolvimento:

\`\`\`
Sem Plataforma:
  Dev -> "Como faco deploy?" -> Ticket -> Ops -> 3 dias

Com Plataforma:
  Dev -> Portal Self-Service -> Deploy em 5 minutos
\`\`\`

### Por que Platform Engineering?

| Problema (DevOps tradicional) | Solucao (Platform Eng) |
|-------------------------------|------------------------|
| Carga cognitiva alta para devs | Abstracoes e golden paths |
| Inconsistencia entre equipes | Templates padronizados |
| Tickets para infra basica | Self-service automatizado |
| Shadow IT e workarounds | Plataforma atraente e util |
| Escala: N equipes x M ferramentas | Plataforma unificada |

### Team Topologies e Platform Teams

Baseado no livro "Team Topologies" (Skelton & Pais):

\`\`\`
┌────────────────────────────────────┐
│        Stream-Aligned Teams        │
│  (equipes de produto/feature)      │
│        ▲              ▲            │
│        │              │            │
│   ┌────┴────┐    ┌────┴────┐      │
│   │Platform │    │Enabling │      │
│   │  Team   │    │  Team   │      │
│   └─────────┘    └─────────┘      │
│                                    │
│   ┌─────────────────────┐         │
│   │ Complicated-Subsystem│         │
│   │       Team           │         │
│   └─────────────────────┘         │
└────────────────────────────────────┘
\`\`\`

**Platform Team:** Constroi e mantem a plataforma interna. Trata a plataforma como produto.

**Principio:** "Thinnest Viable Platform" — a menor plataforma que resolve problemas reais dos desenvolvedores.

### Camadas de um IDP

\`\`\`
┌─────────────────────────────────────┐
│  5. Developer Portal (Backstage)    │  <- Interface
├─────────────────────────────────────┤
│  4. Golden Paths & Templates        │  <- Experiencia
├─────────────────────────────────────┤
│  3. Platform API (Crossplane, K8s)  │  <- Abstracoes
├─────────────────────────────────────┤
│  2. Delivery (ArgoCD, Flux, CI/CD)  │  <- Automacao
├─────────────────────────────────────┤
│  1. Infra (K8s, Cloud, Terraform)   │  <- Fundacao
└─────────────────────────────────────┘
\`\`\`

### Principios de Design de IDPs

1. **Platform as Product** — tratar a plataforma como produto com usuarios (devs), roadmap, feedback
2. **Self-Service** — devs conseguem provisionar sem tickets ou dependencias
3. **Golden Paths** — caminhos otimizados e seguros por padrao, nao obrigatorios
4. **Abstraction** — esconder complexidade sem remover flexibilidade
5. **Documentation** — docs de qualidade como parte da plataforma
6. **Observability** — metricas de uso e satisfacao da plataforma

### Modelo de Maturidade

| Nivel | Caracteristicas | Ferramentas Exemplo |
|-------|----------------|---------------------|
| 1. Manual | Tickets, docs wiki, scripts ad-hoc | Confluence, Jira |
| 2. Padronizado | Templates, CI/CD basico | Helm charts, Jenkins |
| 3. Self-Service | Portal, provisionamento automatico | Backstage, ArgoCD |
| 4. Otimizado | Metricas, feedback loop, melhoria continua | DORA metrics, surveys |
| 5. Autonomo | AI-assisted, auto-healing, predictive | ML ops, AIOps |

### CNCF Platform Engineering Maturity Model

O CNCF define 4 aspectos de maturidade:

1. **Investment** — como a organizacao investe em plataforma
2. **Adoption** — nivel de adocao pelos desenvolvedores
3. **Interfaces** — qualidade das interfaces (portal, CLI, API)
4. **Operations** — como a plataforma e operada e mantida

### Ferramentas do Ecossistema

| Camada | Ferramentas |
|--------|-------------|
| Portal | Backstage, Port, Cortex, OpsLevel |
| Templates | Cookiecutter, Yeoman, Scaffolder |
| GitOps | ArgoCD, Flux, Kargo |
| Platform API | Crossplane, KubeVela, Kratix |
| Infra | Terraform, Pulumi, CDK |
| Observability | Prometheus, Grafana, Datadog |
| Security | Vault, cert-manager, OPA |
| CI/CD | GitHub Actions, GitLab CI, Tekton |

### Erros Comuns

1. **Construir demais** — comecar com a "plataforma dos sonhos" em vez do minimo viavel
2. **Ignorar feedback** — nao ouvir os desenvolvedores que usam a plataforma
3. **Forcar adocao** — golden paths devem ser atraentes, nao obrigatorios
4. **Equipe pequena demais** — platform team precisa de capacidade propria
5. **Sem metricas** — nao medir uso, satisfacao e impacto

## Killer.sh Style Challenge

> **Cenario conceitual:** Projete um IDP para uma empresa com 50 desenvolvedores e 10 microservicos. Defina: (1) quais golden paths oferecer, (2) quais ferramentas compor cada camada, (3) como medir sucesso da plataforma.
`,
  quiz: [
    {
      question: 'O que e um Internal Developer Platform (IDP)?',
      options: [
        'Um framework de programacao',
        'Uma plataforma interna que habilita self-service e abstrai complexidade de infraestrutura para desenvolvedores',
        'Um servico de cloud publica',
        'Um sistema de monitoramento'
      ],
      correct: 1,
      explanation: 'Um IDP e uma plataforma interna construida pelo Platform Team que permite que desenvolvedores provisionem recursos, deployem aplicacoes e gerenciem servicos de forma autonoma.',
      reference: 'Conceito relacionado: O IDP trata a plataforma como produto, com devs como usuarios.'
    },
    {
      question: 'O que significa "Thinnest Viable Platform"?',
      options: [
        'A plataforma mais barata possivel',
        'A menor plataforma que resolve problemas reais dos desenvolvedores sem overhead desnecessario',
        'Uma plataforma sem interface grafica',
        'Uma plataforma que roda em um unico servidor'
      ],
      correct: 1,
      explanation: 'Thinnest Viable Platform (do livro Team Topologies) significa construir apenas o necessario para resolver dores reais dos devs. Comecar pequeno e iterar baseado em feedback.',
      reference: 'Conceito relacionado: Comece com golden paths para os casos de uso mais comuns.'
    },
    {
      question: 'O que sao Golden Paths no contexto de Platform Engineering?',
      options: [
        'Rotas de rede otimizadas',
        'Caminhos pre-definidos e otimizados para tarefas comuns (deploy, criar servico, etc.) que sao recomendados mas nao obrigatorios',
        'Pipelines de CI/CD fixos',
        'Regras de seguranca obrigatorias'
      ],
      correct: 1,
      explanation: 'Golden Paths sao workflows padronizados e otimizados que a plataforma oferece. Eles sao "o caminho feliz" — seguros, testados e eficientes — mas devs podem usar alternativas se necessario.',
      reference: 'Conceito relacionado: Golden Paths incluem templates, pipelines e configuracoes pre-definidas.'
    },
    {
      question: 'Qual o papel do Platform Team segundo Team Topologies?',
      options: [
        'Gerenciar tickets de infraestrutura',
        'Construir e manter a plataforma interna, tratando-a como produto interno',
        'Desenvolver features de negocio',
        'Fazer deploy manual para todas as equipes'
      ],
      correct: 1,
      explanation: 'O Platform Team constroi e mantem a plataforma interna. Eles tratam a plataforma como produto: tem roadmap, coletam feedback, medem satisfacao e iteram continuamente.',
      reference: 'Conceito relacionado: Stream-aligned teams sao os "clientes" do Platform Team.'
    },
    {
      question: 'Qual a camada de um IDP responsavel pela interface com os desenvolvedores?',
      options: [
        'Platform API',
        'Developer Portal (ex: Backstage)',
        'Delivery layer (ArgoCD)',
        'Infrastructure (Kubernetes)'
      ],
      correct: 1,
      explanation: 'O Developer Portal (como Backstage) e a camada de interface onde devs interagem com a plataforma: buscam servicos, criam novos projetos via templates, consultam docs e monitoram saude.',
      reference: 'Conceito relacionado: As 5 camadas: Infra > Delivery > Platform API > Golden Paths > Portal.'
    },
    {
      question: 'Qual o principal antipattern em Platform Engineering?',
      options: [
        'Usar Kubernetes',
        'Construir a plataforma inteira antes de validar com usuarios reais',
        'Documentar a plataforma',
        'Medir metricas DORA'
      ],
      correct: 1,
      explanation: 'O maior antipattern e "build it and they will come" — construir uma plataforma completa sem validar que resolve dores reais. A abordagem correta e comecar com o minimo viavel e iterar.',
      reference: 'Conceito relacionado: Thinnest Viable Platform + feedback loops constantes.'
    },
    {
      question: 'Qual metrica NÃO e tipicamente usada para medir sucesso de um IDP?',
      options: [
        'DORA metrics (deploy frequency, lead time)',
        'Developer satisfaction (NPS)',
        'Numero de linhas de codigo escritas',
        'Time to onboard novo desenvolvedor'
      ],
      correct: 2,
      explanation: 'Linhas de codigo nao medem eficacia da plataforma. Metricas uteis incluem: DORA (deploy frequency, lead time, MTTR, change failure rate), developer NPS, tempo de onboarding e uso do self-service.',
      reference: 'Conceito relacionado: SPACE framework (Satisfaction, Performance, Activity, Communication, Efficiency).'
    }
  ],
  flashcards: [
    {
      front: 'Quais sao as 5 camadas de um IDP?',
      back: '1. **Infrastructure** — K8s, Cloud, Terraform\n2. **Delivery** — ArgoCD, Flux, CI/CD\n3. **Platform API** — Crossplane, KubeVela, Kratix\n4. **Golden Paths** — Templates, scaffolding\n5. **Developer Portal** — Backstage, Port\n\nCada camada abstrai a anterior. O dev interage principalmente com as camadas 4 e 5.'
    },
    {
      front: 'O que e Team Topologies e como se relaciona com Platform Eng?',
      back: '**Team Topologies** (Skelton & Pais) define 4 tipos de equipe:\n\n1. **Stream-Aligned** — entrega features (cliente da plataforma)\n2. **Platform** — constroi/mantem a plataforma\n3. **Enabling** — ajuda equipes a adotar novas tecnologias\n4. **Complicated-Subsystem** — expertise especializado\n\n**Relacao:** O Platform Team constroi o IDP que os Stream-Aligned Teams consomem. Reduz carga cognitiva e dependencias.'
    },
    {
      front: 'O que sao Golden Paths e por que nao sao obrigatorios?',
      back: '**Golden Paths** = caminhos recomendados e otimizados.\n\n**Exemplos:**\n- Template para novo microservico\n- Pipeline CI/CD padrao\n- Configuracao de deploy pre-definida\n- Setup de observabilidade automatico\n\n**Por que nao obrigatorios:**\n- Devs devem ter autonomia\n- Forcar causa resistencia\n- Casos especiais podem precisar de abordagem diferente\n- O objetivo e que sejam TÃO bons que todos QUEIRAM usar'
    },
    {
      front: 'Quais metricas medem sucesso de um IDP?',
      back: '**DORA Metrics:**\n- Deploy Frequency\n- Lead Time for Changes\n- Mean Time to Recovery (MTTR)\n- Change Failure Rate\n\n**Developer Experience:**\n- Developer NPS/Satisfaction\n- Time to onboard (novo dev produtivo)\n- Time to first deploy\n- % de equipes usando golden paths\n\n**Platform Health:**\n- Uptime da plataforma\n- Tickets de infraestrutura (deve diminuir)\n- Self-service adoption rate'
    },
    {
      front: 'Qual a diferenca entre Platform Engineering e DevOps?',
      back: '**DevOps:**\n- Cultura e praticas\n- Cada equipe gerencia sua infra\n- "You build it, you run it"\n- Pode causar carga cognitiva alta\n\n**Platform Engineering:**\n- Produto interno (plataforma)\n- Equipe dedicada (Platform Team)\n- Abstrai complexidade para devs\n- Self-service e golden paths\n- "You build it, we make it easy to run"\n\n**Relacao:** Platform Eng e uma evolucao natural quando DevOps escala para muitas equipes.'
    },
    {
      front: 'O que e o principio "Platform as Product"?',
      back: '**Tratar a plataforma como um produto interno:**\n\n- **Usuarios:** desenvolvedores (nao ops)\n- **Product Owner:** lider do platform team\n- **Roadmap:** baseado em feedback dos devs\n- **Metricas:** satisfacao, adocao, impacto\n- **Marketing:** docs, demos, onboarding\n- **Iteracao:** melhorar continuamente\n\n**Anti-pattern:** construir plataforma baseada apenas na visao da infra, sem ouvir os usuarios.'
    },
    {
      front: 'Quais ferramentas compoe o ecossistema de Platform Engineering?',
      back: '| Camada | Ferramentas |\n|--------|-------------|\n| **Portal** | Backstage, Port, Cortex |\n| **Templates** | Scaffolder, Cookiecutter |\n| **GitOps** | ArgoCD, Flux, Kargo |\n| **Platform API** | Crossplane, Kratix |\n| **Infra** | Terraform, Pulumi |\n| **Observability** | Prometheus, Grafana |\n| **Security** | Vault, OPA, cert-manager |\n| **CI/CD** | GitHub Actions, Tekton |'
    }
  ],
  lab: null,
  troubleshooting: [
    {
      title: 'Baixa adocao da plataforma pelos desenvolvedores',
      difficulty: 'medium',
      symptom: 'A plataforma foi construida mas os desenvolvedores continuam usando workarounds, tickets e processos manuais ao inves do self-service.',
      diagnosis: `\`\`\`bash
# Nao e um problema tecnico — e um problema de produto
# Diagnostico via metricas e feedback:
# 1. Medir taxa de uso do self-service vs tickets manuais
# 2. Coletar NPS dos desenvolvedores
# 3. Analisar onde os devs "abandonam" o golden path
# 4. Entrevistar equipes que NAO usam a plataforma
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Plataforma nao resolve dores reais:** Alinhar roadmap com as maiores dores dos desenvolvedores. Perguntar: "O que toma mais tempo no seu dia?"

2. **UX ruim:** Se o self-service e mais complexo que o ticket, ninguem vai usar. Simplificar a experiencia.

3. **Documentacao insuficiente:** Devs nao sabem que a plataforma existe ou como usar. Investir em onboarding e docs.

4. **Falta de confianca:** Se a plataforma quebra frequentemente, devs criam workarounds. Investir em confiabilidade.

5. **Forcar vs atrair:** Nao force adocao — faca a plataforma tao boa que devs QUEIRAM usar.`
    },
    {
      title: 'Platform Team sobrecarregada com suporte',
      difficulty: 'hard',
      symptom: 'O Platform Team gasta mais tempo respondendo duvidas e resolvendo problemas dos usuarios do que construindo novas features da plataforma.',
      diagnosis: `\`\`\`bash
# Analisar:
# 1. Volume e tipo de tickets/perguntas recebidas
# 2. Frequencia de perguntas repetidas
# 3. Tempo gasto em suporte vs desenvolvimento
# 4. Temas mais comuns de suporte
\`\`\``,
      solution: `**Acoes para resolver:**

1. **Documentacao proativa:** Para cada pergunta frequente, criar doc/tutorial. Se a mesma pergunta aparece 3x, automatize.

2. **Enabling Team:** Se possivel, ter uma equipe de enablement que faz onboarding e suporte L1.

3. **Community of Practice:** Criar canal onde devs ajudam devs (Slack, Teams). Platform team modera mas nao responde tudo.

4. **Self-service melhor:** Se devs precisam de ajuda para usar o self-service, o self-service esta complexo demais. Simplificar.

5. **Office hours:** Agendar horarios fixos para suporte ao inves de atender on-demand o dia todo.`
    }
  ]
};
