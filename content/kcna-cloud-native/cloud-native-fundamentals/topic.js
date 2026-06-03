window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['kcna-cloud-native/cloud-native-fundamentals'] = {

  theory: `# Cloud Native Fundamentals

## Relevancia no KCNA
> O dominio "Cloud Native Architecture" vale **16%** do KCNA. Entender o que significa "cloud native", os principios fundamentais e o papel da CNCF e essencial.

---

## O que e Cloud Native?

### Definicao da CNCF

> Cloud native technologies empower organizations to build and run scalable applications in modern, dynamic environments such as public, private, and hybrid clouds.

Caracteristicas principais:
- **Containers**: empacotamento padronizado
- **Service meshes**: comunicacao entre servicos
- **Microservices**: arquitetura desacoplada
- **Immutable infrastructure**: infraestrutura substituida, nao modificada
- **Declarative APIs**: estado desejado, nao comandos

---

## CNCF (Cloud Native Computing Foundation)

### O que e a CNCF?

Parte da Linux Foundation, a CNCF hospeda projetos cloud native criticos:

| Nivel | Significado | Exemplos |
|-------|------------|----------|
| **Graduated** | Maduro, producao | Kubernetes, Prometheus, Envoy, containerd, CoreDNS, etcd, Helm, Fluentd |
| **Incubating** | Crescendo, adocao | Argo, Cilium, gRPC, Linkerd, OpenTelemetry |
| **Sandbox** | Experimental, early-stage | Projetos novos em avaliacao |

### CNCF Trail Map

Guia recomendado para adocao cloud native:
1. Containerizacao
2. CI/CD
3. Orquestracao (Kubernetes)
4. Observabilidade e Analise
5. Service Mesh
6. Networking e Security
7. Distributed Database
8. Messaging e Streaming
9. Container Registry
10. Software Distribution

---

## Microservices vs Monolith

| Aspecto | Monolito | Microservices |
|---------|----------|---------------|
| **Deploy** | Aplicacao inteira | Servico individual |
| **Escala** | Tudo junto | Cada servico independente |
| **Tecnologia** | Stack unica | Polyglot (multiplas linguagens) |
| **Falha** | Afeta tudo | Isolada ao servico |
| **Complexidade** | Codigo | Infraestrutura/rede |
| **Time** | Um time grande | Times pequenos por servico |

### Quando usar Microservices?

- Aplicacao grande e complexa
- Times independentes
- Necessidade de escalar partes independentemente
- Tolerancia a complexidade operacional

### Quando manter Monolito?

- Aplicacao pequena/simples
- Time pequeno
- Dominio nao bem definido
- MVP ou prototipo

---

## The Twelve-Factor App

Metodologia para construir aplicacoes cloud native (criada pela Heroku):

| Fator | Principio |
|-------|-----------|
| **I. Codebase** | Um codebase em controle de versao, muitos deploys |
| **II. Dependencies** | Declare e isole dependencias explicitamente |
| **III. Config** | Armazene config no ambiente (env vars) |
| **IV. Backing Services** | Trate servicos externos como recursos anexados |
| **V. Build, Release, Run** | Separe estritamente build, release e run |
| **VI. Processes** | Execute como processos stateless |
| **VII. Port Binding** | Exporte servicos via port binding |
| **VIII. Concurrency** | Escale via processos |
| **IX. Disposability** | Maximize robustez com startup rapido e shutdown graceful |
| **X. Dev/Prod Parity** | Mantenha dev, staging e producao similares |
| **XI. Logs** | Trate logs como event streams |
| **XII. Admin Processes** | Execute tarefas admin como processos one-off |

---

## Principios Cloud Native

### Pets vs Cattle

| Pets (Animais de Estimacao) | Cattle (Gado) |
|-----------------------------|---------------|
| Servidores com nome | Servidores numerados |
| Cuidados individuais | Substituiveis |
| Consertados quando falham | Destruidos e recriados |
| Unicos e insubstituiveis | Identicos e descartaveis |

Cloud native trata servidores como **cattle** — imutaveis e substituiveis.

### Immutable Infrastructure

\`\`\`text
Tradicional:            Cloud Native:
Server -> Patch ->      Server v1 -> Destroy
  Patch -> Patch          Deploy Server v2
  (config drift)          (sempre limpo)
\`\`\`

- Nunca modifique infraestrutura em producao
- Crie nova versao e substitua
- Evita configuration drift
- Reproducivel e previsivel

### Infrastructure as Code (IaC)

Gerenciar infraestrutura como codigo:
- **Terraform**: multi-cloud, declarativo
- **Pulumi**: linguagens de programacao reais
- **Ansible**: automacao de configuracao
- **CloudFormation**: AWS nativo

---

## Autoscaling

| Tipo | O que escala | Exemplo |
|------|-------------|---------|
| **HPA** | Pods (horizontal) | Mais replicas baseado em CPU/memoria |
| **VPA** | Pods (vertical) | Mais CPU/memoria por pod |
| **Cluster Autoscaler** | Nodes | Mais nodes quando pods nao cabem |
| **KEDA** | Event-driven | Escala baseado em eventos (filas, metricas custom) |

---

## Serverless

Modelo onde o cloud provider gerencia a infraestrutura:

| Tipo | Exemplo | Descricao |
|------|---------|-----------|
| **FaaS** | AWS Lambda, Cloud Functions | Funcoes executadas por evento |
| **CaaS** | AWS Fargate, Cloud Run | Containers sem gerenciar nodes |
| **Knative** | Kubernetes-native | Serverless em cima do K8s |

Caracteristicas:
- Scale to zero
- Pay-per-use
- Event-driven
- Sem gerenciamento de servidores
`,

  quiz: [
    {
      question: 'Qual a definicao de Cloud Native segundo a CNCF?',
      options: ['Rodar tudo na nuvem publica', 'Construir aplicacoes escalaveis em ambientes dinamicos usando containers, microservices e infraestrutura imutavel', 'Usar apenas servicos serverless', 'Migrar VMs para a nuvem'],
      correct: 1,
      explanation: 'Cloud native envolve containers, microservices, service meshes, infraestrutura imutavel e APIs declarativas para construir aplicacoes escalaveis em ambientes modernos e dinamicos.',
      reference: 'Conceito relacionado: CNCF — definicao oficial.'
    },
    {
      question: 'Qual nivel de projeto CNCF indica maturidade para producao?',
      options: ['Sandbox', 'Incubating', 'Graduated', 'Stable'],
      correct: 2,
      explanation: 'Graduated e o nivel mais alto da CNCF, indicando maturidade, adocao ampla e prontidao para producao. Exemplos: Kubernetes, Prometheus, containerd.',
      reference: 'Conceito relacionado: CNCF — niveis de projeto.'
    },
    {
      question: 'O que o principio "Pets vs Cattle" significa?',
      options: ['Usar containers para animais', 'Tratar servidores como substituiveis (cattle) ao inves de unicos (pets)', 'Preferir VMs a containers', 'Dar nomes unicos a cada servidor'],
      correct: 1,
      explanation: 'Pets sao servidores unicos cuidados individualmente. Cattle sao servidores identicos e substituiveis. Cloud native trata infraestrutura como cattle — imutavel e descartavel.',
      reference: 'Conceito relacionado: Pets vs Cattle — infraestrutura imutavel.'
    },
    {
      question: 'Qual fator do Twelve-Factor App diz que config deve ser armazenada no ambiente?',
      options: ['I. Codebase', 'III. Config', 'VI. Processes', 'X. Dev/Prod Parity'],
      correct: 1,
      explanation: 'Fator III (Config) determina que configuracao deve ser armazenada em variaveis de ambiente, separada do codigo. No K8s, isso e feito com ConfigMaps e Secrets.',
      reference: 'Conceito relacionado: Twelve-Factor App — fator III.'
    },
    {
      question: 'Qual a principal vantagem de microservices sobre monolitos?',
      options: ['Codigo mais simples', 'Deploy e escala independente de cada servico', 'Menos infraestrutura', 'Melhor performance'],
      correct: 1,
      explanation: 'Microservices permitem deploy, escala e desenvolvimento independente de cada servico. A desvantagem e a complexidade operacional e de rede.',
      reference: 'Conceito relacionado: Microservices vs monolito — trade-offs.'
    },
    {
      question: 'O que e Infrastructure as Code (IaC)?',
      options: ['Codigo que roda na nuvem', 'Gerenciar infraestrutura de forma declarativa usando codigo versionado', 'Usar containers para infraestrutura', 'Compilar codigo em servidores'],
      correct: 1,
      explanation: 'IaC permite definir infraestrutura em arquivos de codigo (Terraform, Pulumi) versionados em Git. Permite reproducibilidade, automacao e auditoria.',
      reference: 'Conceito relacionado: IaC — Terraform, Pulumi.'
    },
    {
      question: 'Qual tipo de autoscaling no Kubernetes adiciona mais nodes ao cluster?',
      options: ['HPA (Horizontal Pod Autoscaler)', 'VPA (Vertical Pod Autoscaler)', 'Cluster Autoscaler', 'KEDA'],
      correct: 2,
      explanation: 'Cluster Autoscaler adiciona/remove nodes quando pods nao conseguem ser agendados (pending) ou nodes estao subutilizados. HPA escala pods, VPA ajusta recursos por pod.',
      reference: 'Conceito relacionado: Autoscaling — HPA vs VPA vs Cluster Autoscaler.'
    }
  ],

  flashcards: [
    { front: 'O que e Cloud Native segundo a CNCF?', back: 'Construir aplicacoes escalaveis em ambientes dinamicos usando containers, microservices, service meshes, infraestrutura imutavel e APIs declarativas. Permite mudancas frequentes com impacto previsivel.' },
    { front: 'Quais sao os niveis de projeto CNCF?', back: 'Sandbox: experimental, early-stage. Incubating: crescendo, adocao aumentando. Graduated: maduro, pronto para producao. Exemplos graduated: Kubernetes, Prometheus, Envoy, containerd, Helm.' },
    { front: 'O que e Pets vs Cattle?', back: 'Pets: servidores unicos, com nomes, consertados quando falham. Cattle: servidores numerados, identicos, substituiveis, destruidos e recriados. Cloud native = cattle (infraestrutura imutavel).' },
    { front: 'Quais sao os 12 fatores do Twelve-Factor App?', back: 'Codebase, Dependencies, Config, Backing Services, Build/Release/Run, Processes (stateless), Port Binding, Concurrency, Disposability, Dev/Prod Parity, Logs (streams), Admin Processes.' },
    { front: 'Microservices vs Monolito?', back: 'Monolito: deploy tudo junto, escala tudo, stack unica, simples. Microservices: deploy independente, escala por servico, polyglot, complexidade operacional. Microservices para aplicacoes grandes com times independentes.' },
    { front: 'O que e Immutable Infrastructure?', back: 'Nunca modificar infraestrutura em producao. Criar nova versao e substituir a antiga. Evita configuration drift. Containers e IaC tornam isso possivel. "Replace, don\'t repair."' },
    { front: 'Quais tipos de autoscaling existem no K8s?', back: 'HPA: mais/menos replicas de pod (horizontal). VPA: mais/menos recursos por pod (vertical). Cluster Autoscaler: mais/menos nodes. KEDA: event-driven (filas, metricas custom). Scale to zero.' },
    { front: 'O que e serverless no contexto cloud native?', back: 'Modelo onde provider gerencia infraestrutura. FaaS (Lambda, Cloud Functions), CaaS (Fargate, Cloud Run), Knative (K8s-native). Caracteristicas: scale to zero, pay-per-use, event-driven.' }
  ],

  lab: {
    scenario: 'Voce esta explorando conceitos cloud native no Kubernetes.',
    objective: 'Entender como principios cloud native se manifestam no Kubernetes.',
    duration: '10-15 minutos',
    steps: [
      {
        title: 'Explorar Projetos CNCF no Cluster',
        instruction: 'Identifique quais projetos CNCF graduated estao rodando no seu cluster Kubernetes.',
        hints: ['Verifique componentes no kube-system', 'Procure por CoreDNS, etcd, containerd', 'Use kubectl get pods -n kube-system'],
        solution: '```bash\n# Listar componentes do cluster\nkubectl get pods -n kube-system\n\n# Identificar projetos CNCF\n# CoreDNS (graduated) - DNS do cluster\nkubectl get pods -n kube-system -l k8s-app=kube-dns\n\n# etcd (graduated) - armazenamento do estado\nkubectl get pods -n kube-system -l component=etcd\n\n# containerd (graduated) - runtime\nkubectl get nodes -o wide | awk \'{print $1, $NF}\'\n```',
        verify: '```bash\nkubectl get pods -n kube-system -l k8s-app=kube-dns\n# Saida esperada: coredns pods Running\n\nkubectl get nodes -o wide\n# Saida esperada: CONTAINER-RUNTIME mostrando containerd\n```'
      },
      {
        title: 'Twelve-Factor na Pratica',
        instruction: 'Crie um Deployment que segue principios do Twelve-Factor App usando ConfigMap para configuracao externa.',
        hints: ['Fator III: Config no ambiente', 'Use ConfigMap para variaveis', 'Fator VI: Processo stateless'],
        solution: '```bash\n# Fator III: Config no ambiente via ConfigMap\nkubectl create configmap app-config --from-literal=APP_ENV=production --from-literal=LOG_LEVEL=info\n\n# Fator VI: Processo stateless\nkubectl create deployment twelve-factor-app --image=nginx:1.25-alpine\n\n# Injetar config como env vars\nkubectl set env deployment/twelve-factor-app --from=configmap/app-config\n\n# Verificar\nkubectl exec deploy/twelve-factor-app -- env | grep -E "APP_ENV|LOG_LEVEL"\n```',
        verify: '```bash\nkubectl get configmap app-config -o yaml\n# Saida esperada: APP_ENV=production, LOG_LEVEL=info\n\nkubectl exec deploy/twelve-factor-app -- env | grep APP_ENV\n# Saida esperada: APP_ENV=production\n```'
      },
      {
        title: 'Cattle vs Pets - Immutabilidade',
        instruction: 'Demonstre o principio cattle: delete um pod e observe que o Kubernetes cria um novo automaticamente (substituivel, nao reparavel).',
        hints: ['Pods gerenciados por Deployment sao cattle', 'Delete um pod e observe o novo', 'O novo pod tera nome diferente'],
        solution: '```bash\n# Listar pods atuais\nkubectl get pods -l app=twelve-factor-app\n\n# Deletar pod (cattle: substituir, nao reparar)\nPOD=$(kubectl get pods -l app=twelve-factor-app -o jsonpath="{.items[0].metadata.name}")\necho "Deletando: $POD"\nkubectl delete pod $POD\n\n# Observar novo pod criado (nome diferente)\nsleep 3\nkubectl get pods -l app=twelve-factor-app\n# Novo pod com nome diferente - cattle, nao pet!\n```',
        verify: '```bash\nkubectl get pods -l app=twelve-factor-app\n# Saida esperada: 1 pod Running com nome DIFERENTE do deletado\n\nkubectl get deployment twelve-factor-app\n# Saida esperada: READY 1/1\n```'
      }
    ]
  },

  troubleshooting: []
};
