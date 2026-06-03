window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['kcna-cloud-native/cncf-ecosystem'] = {

  theory: `# CNCF Ecosystem & Governance

## Relevancia no KCNA
> O dominio "Cloud Native Architecture" vale **16%** do exame KCNA. Conhecer o ecossistema CNCF, seus projetos e governanca e essencial. O KCNA e um exame **teorico** (multipla escolha) — decore os projetos e suas funcoes.

---

## O que e a CNCF?

A **Cloud Native Computing Foundation** e uma organizacao sob a Linux Foundation que promove a adocao de tecnologias cloud native. Fundada em 2015 com o Kubernetes como primeiro projeto.

**Missao:** Tornar a computacao cloud native ubiqua.

---

## Niveis de Maturidade dos Projetos

\`\`\`
                    ┌──────────────────────┐
                    │      GRADUATED       │
                    │   Producao-ready     │
                    │   Governanca madura  │
                    └──────────┬───────────┘
                               │ Promocao
                    ┌──────────▼───────────┐
                    │     INCUBATING       │
                    │   Adocao crescente   │
                    │   Comunidade ativa   │
                    └──────────┬───────────┘
                               │ Promocao
                    ┌──────────▼───────────┐
                    │       SANDBOX        │
                    │   Estagio inicial    │
                    │   Experimentacao     │
                    └──────────────────────┘
\`\`\`

| Nivel | Criterios | Exemplos |
|-------|-----------|----------|
| **Graduated** | Adocao ampla, governanca madura, security audit completo | Kubernetes, Prometheus, Envoy |
| **Incubating** | Comunidade crescente, uso em producao por varias orgs | Knative, KEDA, Falco |
| **Sandbox** | Estagio inicial, inovacao, sem garantia de maturidade | Projetos experimentais |

---

## Projetos Graduated (mais importantes para KCNA)

### Orquestracao e Runtime

| Projeto | Funcao | Conceito-Chave |
|---------|--------|----------------|
| **Kubernetes** | Orquestracao de containers | Plataforma central do ecossistema |
| **containerd** | Container runtime | CRI-compliant, usado por Docker e K8s |
| **CRI-O** | Container runtime | Alternativa ao containerd, otimizado para K8s |

### Observabilidade

| Projeto | Funcao | Conceito-Chave |
|---------|--------|----------------|
| **Prometheus** | Monitoramento e metricas | Pull-based, PromQL, Alertmanager |
| **Jaeger** | Distributed tracing | Rastreamento de requests entre servicos |
| **Fluentd** | Aggregacao de logs | Pipeline de logs unificado |
| **OpenTelemetry** | Instrumentacao unificada | Padrao unico para logs, metricas e traces |

### Networking e Service Mesh

| Projeto | Funcao | Conceito-Chave |
|---------|--------|----------------|
| **Envoy** | Proxy L7 | Data plane de service mesh (usado pelo Istio) |
| **CoreDNS** | DNS do cluster | Service discovery nativo do Kubernetes |

### Delivery e Package Management

| Projeto | Funcao | Conceito-Chave |
|---------|--------|----------------|
| **Helm** | Package manager K8s | Charts, Releases, Repositories |
| **Argo** | GitOps e Workflows | Argo CD (continuous delivery), Argo Workflows |
| **Flux** | GitOps | Alternativa ao Argo CD, reconciliacao declarativa |

### Seguranca e Policy

| Projeto | Funcao | Conceito-Chave |
|---------|--------|----------------|
| **OPA** | Policy engine | Rego language, Gatekeeper para K8s |
| **Falco** | Runtime security | Deteccao de ameacas via syscalls |
| **TUF/Notary** | Assinatura de artefatos | Supply chain security |

---

## Projetos Incubating Relevantes

| Projeto | Funcao |
|---------|--------|
| **Knative** | Serverless sobre Kubernetes |
| **KEDA** | Event-driven autoscaling |
| **Linkerd** | Service mesh leve (alternativa ao Istio) |
| **Tekton** | CI/CD nativo Kubernetes |
| **Kyverno** | Policy engine K8s-nativa |
| **Crossplane** | Infrastructure as Code via K8s APIs |

---

## Governanca da CNCF

### Estrutura

- **TOC (Technical Oversight Committee)**: Aprova projetos, define niveis de maturidade
- **Governing Board**: Direcao estrategica e financeira
- **SIGs (Special Interest Groups)**: Grupos tematicos (SIG-Network, SIG-Security, SIG-Storage, etc.)
- **Working Groups (WGs)**: Grupos temporarios para topicos especificos
- **TAGs (Technical Advisory Groups)**: Consultoria tecnica (TAG-Security, TAG-Observability)

### CNCF Landscape

O **CNCF Landscape** (landscape.cncf.io) e um mapa interativo de todas as tecnologias cloud native, organizado por categoria:
- App Definition & Development
- Orchestration & Management
- Runtime
- Provisioning
- Observability & Analysis
- Platform

---

## Cloud Native Trail Map

O **Trail Map** e o guia recomendado pela CNCF para adocao:

1. **Containerization** — Docker, OCI
2. **CI/CD** — pipelines automatizados
3. **Orchestration** — Kubernetes
4. **Observability** — Prometheus, Jaeger, Fluentd
5. **Service Mesh** — Envoy, Linkerd, Istio
6. **Networking & Policy** — CNI, Network Policies
7. **Distributed Database** — Vitess, TiKV
8. **Messaging** — NATS, gRPC, CloudEvents
9. **Container Registry & Runtime** — Harbor, containerd
10. **Software Distribution** — Notary, TUF

---

## Personas Cloud Native

| Persona | Responsabilidade |
|---------|-----------------|
| **Developer** | Escreve codigo, usa APIs do K8s, empacota em containers |
| **Platform Engineer** | Constroi e mantem a plataforma (clusters, CI/CD, observabilidade) |
| **SRE** | Garante confiabilidade (SLOs, incident response, automacao) |

---

## Erros Comuns no KCNA

1. **Confundir Graduated com Incubating** — Decore os projetos Graduated
2. **Achar que Istio e CNCF** — Istio e CNCF Graduated (desde 2023), mas muitos confundem
3. **Nao saber que Prometheus usa pull model** — Prometheus faz scraping (pull), nao recebe push
4. **Confundir Envoy com Istio** — Envoy e o proxy (data plane), Istio e o control plane
`,

  quiz: [
    {
      question: 'Qual e o nivel de maturidade MAIS alto para um projeto CNCF?',
      options: ['Sandbox', 'Incubating', 'Graduated', 'Production'],
      correct: 2,
      explanation: 'Graduated e o nivel mais alto. A progressao e: Sandbox -> Incubating -> Graduated. Nao existe nivel "Production" na CNCF.',
      reference: 'Niveis CNCF: Sandbox (experimental) -> Incubating (crescente) -> Graduated (maduro)'
    },
    {
      question: 'Qual projeto CNCF Graduated e responsavel por monitoramento baseado em metricas usando um modelo pull?',
      options: ['Jaeger', 'Fluentd', 'Prometheus', 'OpenTelemetry'],
      correct: 2,
      explanation: 'Prometheus usa pull-based scraping para coletar metricas dos targets. Jaeger e tracing, Fluentd e logs, OpenTelemetry e instrumentacao unificada.',
      reference: 'Prometheus = metricas (pull). Jaeger = traces. Fluentd = logs.'
    },
    {
      question: 'Qual e a funcao do Envoy no ecossistema cloud native?',
      options: [
        'Container runtime',
        'Service mesh control plane',
        'L7 proxy e service mesh data plane',
        'Package manager'
      ],
      correct: 2,
      explanation: 'Envoy e um proxy L7 de alta performance que funciona como data plane de service meshes como Istio. O control plane e o Istio, nao o Envoy.',
      reference: 'Envoy = data plane (proxy). Istio = control plane. Linkerd = service mesh alternativo.'
    },
    {
      question: 'Qual orgao da CNCF aprova a promocao de projetos entre niveis de maturidade?',
      options: ['Governing Board', 'SIG Chairs', 'TOC (Technical Oversight Committee)', 'TAG Security'],
      correct: 2,
      explanation: 'O TOC (Technical Oversight Committee) e responsavel por avaliar e aprovar a promocao de projetos entre Sandbox, Incubating e Graduated.',
      reference: 'TOC = promocao de projetos. Governing Board = estrategia. SIGs/TAGs = tematicos.'
    },
    {
      question: 'Qual projeto CNCF e a alternativa ao Argo CD para GitOps?',
      options: ['Tekton', 'Flux', 'Helm', 'Jenkins X'],
      correct: 1,
      explanation: 'Flux e o projeto CNCF Graduated alternativo ao Argo CD para GitOps. Tekton e CI/CD (nao GitOps especificamente). Helm e package manager.',
      reference: 'GitOps: Argo CD e Flux (ambos Graduated). Tekton = CI/CD. Helm = packaging.'
    },
    {
      question: 'Qual projeto fornece event-driven autoscaling alem do HPA nativo?',
      options: ['Knative', 'KEDA', 'Crossplane', 'Kyverno'],
      correct: 1,
      explanation: 'KEDA (Kubernetes Event-Driven Autoscaling) permite escalar baseado em eventos externos (filas, metricas customizadas). Knative e serverless, Crossplane e IaC.',
      reference: 'KEDA = autoscaling por eventos. Knative = serverless. Crossplane = IaC.'
    },
    {
      question: 'Qual e a diferenca entre SIGs e TAGs na CNCF?',
      options: [
        'SIGs sao para projetos especificos, TAGs sao consultoria tecnica cross-cutting',
        'SIGs sao temporarios, TAGs sao permanentes',
        'Nao ha diferenca, sao sinonimos',
        'SIGs sao para governanca, TAGs sao para codigo'
      ],
      correct: 0,
      explanation: 'SIGs (Special Interest Groups) focam em areas tematicas do Kubernetes (SIG-Network, SIG-Storage). TAGs (Technical Advisory Groups) fornecem consultoria tecnica em temas transversais (TAG-Security, TAG-Observability).',
      reference: 'SIGs = areas do K8s. TAGs = consultoria transversal. WGs = temporarios.'
    },
    {
      question: 'Qual projeto CNCF unifica a coleta de logs, metricas e traces em um unico padrao?',
      options: ['Prometheus', 'Jaeger', 'OpenTelemetry', 'Fluentd'],
      correct: 2,
      explanation: 'OpenTelemetry unifica instrumentacao de observabilidade (logs, metricas, traces) em um unico SDK e protocolo (OTLP). Prometheus e so metricas, Jaeger e so traces, Fluentd e so logs.',
      reference: 'OpenTelemetry = padrao unificado. Prometheus+Jaeger+Fluentd = ferramentas individuais.'
    },
    {
      question: 'Qual projeto CNCF e um policy engine que usa a linguagem Rego?',
      options: ['Kyverno', 'Falco', 'OPA (Open Policy Agent)', 'Gatekeeper'],
      correct: 2,
      explanation: 'OPA (Open Policy Agent) usa Rego como linguagem de politicas. Gatekeeper e a integracao do OPA com Kubernetes (admission controller). Kyverno e alternativa K8s-nativa (YAML, sem Rego). Falco e runtime security.',
      reference: 'OPA = Rego. Gatekeeper = OPA no K8s. Kyverno = YAML nativo. Falco = runtime.'
    },
    {
      question: 'Na Cloud Native Trail Map da CNCF, qual e o primeiro passo recomendado?',
      options: ['Orchestration', 'Observability', 'Containerization', 'Service Mesh'],
      correct: 2,
      explanation: 'O Trail Map comeca com Containerization (Docker, OCI), seguido de CI/CD, depois Orchestration (Kubernetes), e so entao Observability e Service Mesh.',
      reference: 'Trail Map: Container -> CI/CD -> Orchestration -> Observability -> Service Mesh'
    }
  ],

  flashcards: [
    { front: 'Quais sao os 3 niveis de maturidade da CNCF?', back: 'Sandbox (experimental), Incubating (adocao crescente), Graduated (producao-ready, governanca madura)' },
    { front: 'Qual a diferenca entre Prometheus, Jaeger e Fluentd?', back: 'Prometheus = metricas (pull-based). Jaeger = distributed tracing. Fluentd = aggregacao de logs.' },
    { front: 'O que e o TOC da CNCF?', back: 'Technical Oversight Committee — orgao que aprova a promocao de projetos entre niveis de maturidade (Sandbox -> Incubating -> Graduated).' },
    { front: 'Envoy vs Istio: qual a diferenca?', back: 'Envoy = proxy L7 (data plane). Istio = service mesh control plane que usa Envoy como sidecar proxy.' },
    { front: 'Argo CD vs Flux: o que sao?', back: 'Ambos sao ferramentas GitOps CNCF Graduated. Argo CD tem UI mais rica. Flux e mais leve e usa CRDs nativos.' },
    { front: 'O que e OpenTelemetry?', back: 'Projeto CNCF que unifica instrumentacao de observabilidade (logs, metricas, traces) em um unico SDK e protocolo (OTLP).' },
    { front: 'OPA vs Kyverno: qual a diferenca?', back: 'OPA usa linguagem Rego, Gatekeeper integra com K8s. Kyverno e K8s-nativo (politicas em YAML, sem nova linguagem).' },
    { front: 'O que e KEDA?', back: 'Kubernetes Event-Driven Autoscaling — permite escalar pods baseado em eventos externos (filas de mensagem, metricas custom) alem do HPA nativo.' },
    { front: 'O que e a CNCF Landscape?', back: 'Mapa interativo (landscape.cncf.io) que categoriza todas as tecnologias cloud native em areas como Runtime, Orchestration, Observability, etc.' },
    { front: 'Quais as 3 personas cloud native?', back: 'Developer (escreve codigo), Platform Engineer (constroi e mantem plataforma), SRE (garante confiabilidade — SLOs, incident response).' }
  ],

  lab: {
    scenario: 'Voce vai explorar o ecossistema CNCF e identificar projetos em um cluster Kubernetes.',
    objective: 'Familiarizar-se com os projetos CNCF presentes em um cluster K8s e entender suas funcoes.',
    duration: '10-15 minutos',
    steps: [
      {
        title: 'Identificar projetos CNCF no cluster',
        instruction: 'Liste todos os pods do namespace \`kube-system\` e identifique quais sao projetos CNCF Graduated.',
        hints: ['kubectl get pods -n kube-system', 'Procure por: coredns, etcd, kube-proxy'],
        solution: '```bash\nkubectl get pods -n kube-system\n# Projetos CNCF que voce vera:\n# - coredns-* (CoreDNS — CNCF Graduated, DNS do cluster)\n# - etcd-* (etcd — CNCF Graduated, key-value store)\n# Componentes nativos K8s (tambem CNCF):\n# - kube-apiserver, kube-scheduler, kube-controller-manager, kube-proxy\n```'
      },
      {
        title: 'Verificar o container runtime',
        instruction: 'Descubra qual container runtime (containerd ou CRI-O) esta sendo usado no cluster.',
        hints: ['kubectl get nodes -o wide mostra a coluna CONTAINER-RUNTIME'],
        solution: '```bash\nkubectl get nodes -o wide\n# Coluna CONTAINER-RUNTIME mostra:\n# containerd://1.x.x  (CNCF Graduated)\n# ou cri-o://1.x.x    (CNCF Graduated/Incubating)\n```'
      },
      {
        title: 'Explorar a CNCF Landscape',
        instruction: 'Acesse landscape.cncf.io e identifique em qual categoria estao: Prometheus, Helm, Envoy e Falco.',
        hints: ['Use os filtros de categoria no landscape'],
        solution: '```\n# Respostas:\n# Prometheus -> Observability and Analysis > Monitoring\n# Helm -> App Definition and Development > Application Definition & Image Build  \n# Envoy -> Orchestration & Management > Service Mesh (como proxy)\n# Falco -> Provisioning > Security & Compliance\n```'
      }
    ]
  },

  troubleshooting: []
};
