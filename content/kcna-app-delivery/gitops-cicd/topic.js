window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['kcna-app-delivery/gitops-cicd'] = {

  theory: `# GitOps & CI/CD

## Relevancia no KCNA
> O dominio "Application Delivery" vale **8%** do KCNA. Entenda CI/CD, GitOps, ferramentas como ArgoCD e Flux, e padroes de delivery como canary e blue-green.

---

## CI/CD Fundamentals

### Continuous Integration (CI)

\`\`\`text
Developer --> Git Push --> CI Pipeline:
                            +-- Build
                            +-- Test (unit, integration)
                            +-- Lint / Static Analysis
                            +-- Build Container Image
                            +-- Push to Registry
\`\`\`

CI garante que o codigo integrado esta sempre em estado funcional.

### Continuous Delivery (CD)

\`\`\`text
CI Pipeline --> Staging Deploy --> Testes --> Aprovacao --> Production Deploy
                                                |
                                          Manual gate
\`\`\`

CD automatiza o deploy ate producao, podendo ter gates manuais.

### Continuous Deployment

\`\`\`text
CI Pipeline --> Staging --> Testes --> Production (automatico!)
\`\`\`

Deploy automatico em producao sem intervencao humana (requer alta confianca em testes).

---

## GitOps

### O que e GitOps?

GitOps usa Git como **unica fonte de verdade** para infraestrutura e aplicacoes:

\`\`\`text
Principios GitOps:
1. Declarativo: todo sistema descrito declarativamente
2. Versionado: estado desejado armazenado em Git
3. Automatico: mudancas aprovadas sao aplicadas automaticamente
4. Reconciliado: agentes garantem que estado real = estado no Git
\`\`\`

### Push vs Pull Model

| Modelo | Como funciona | Exemplo |
|--------|--------------|---------|
| **Push** | CI pipeline faz deploy diretamente | Jenkins, GitHub Actions |
| **Pull** | Agente no cluster observa Git e aplica mudancas | ArgoCD, Flux |

\`\`\`text
Push Model:
  Git --> CI --> kubectl apply --> Cluster
  (pipeline precisa de credenciais do cluster)

Pull Model (GitOps):
  Git <-- ArgoCD/Flux (observa) --> Cluster
  (agente dentro do cluster, sem expor credenciais)
\`\`\`

O pull model e mais seguro: credenciais do cluster nao saem do cluster.

---

## ArgoCD

Ferramenta GitOps declarativa para Kubernetes — **CNCF Graduated (parte do Argo)**:

\`\`\`text
Arquitetura:
  Git Repo (manifests) <-- ArgoCD Server --> Kubernetes Cluster
                               |
                          +----+----+
                          |         |
                    Application   Sync Status
                    Controller    (Synced/OutOfSync)
\`\`\`

### Conceitos ArgoCD

| Conceito | Descricao |
|----------|-----------|
| **Application** | Define o que deployar (repo + path + target cluster/namespace) |
| **Sync** | Reconciliar estado do cluster com Git |
| **Sync Status** | Synced (igual ao Git) ou OutOfSync (diferente) |
| **Health Status** | Healthy, Degraded, Progressing, Missing |
| **Auto-Sync** | Sincronizar automaticamente quando Git muda |
| **Self-Heal** | Reverter mudancas manuais no cluster |

### Funcionalidades

- UI web com visualizacao de recursos
- SSO e RBAC integrados
- Multi-cluster support
- Helm, Kustomize, Jsonnet, plain YAML
- Rollback para qualquer versao anterior
- Webhooks para sync rapido

---

## Flux

Ferramenta GitOps para Kubernetes — **CNCF Graduated**:

\`\`\`text
Arquitetura (toolkit approach):
  Git Repo <-- Source Controller
                    |
              Kustomize Controller --> Kubernetes
              Helm Controller ------> Kubernetes
                    |
              Notification Controller --> Slack/Teams
\`\`\`

### Diferencas ArgoCD vs Flux

| Aspecto | ArgoCD | Flux |
|---------|--------|------|
| **UI** | UI web rica | CLI-first (UI via Weave GitOps) |
| **Abordagem** | Application-centric | Toolkit/composable |
| **Multi-cluster** | Nativo | Via KubeConfig |
| **CRDs** | Application, AppProject | GitRepository, Kustomization, HelmRelease |
| **Ideal para** | Equipes que preferem UI | Equipes que preferem automacao pura |

---

## Helm

Gerenciador de pacotes para Kubernetes — **CNCF Graduated**:

\`\`\`text
Chart Structure:
  mychart/
    Chart.yaml      (metadados)
    values.yaml     (configuracao padrao)
    templates/      (manifests com Go templates)
      deployment.yaml
      service.yaml
      ingress.yaml
\`\`\`

| Conceito | Descricao |
|----------|-----------|
| **Chart** | Pacote de recursos K8s (templates + values) |
| **Release** | Instancia de um chart instalado |
| **Repository** | Colecao de charts (ex: ArtifactHub) |
| **Values** | Configuracao que customiza o chart |

\`\`\`bash
# Comandos basicos
helm repo add bitnami https://charts.bitnami.com/bitnami
helm install my-release bitnami/nginx
helm upgrade my-release bitnami/nginx --set replicaCount=3
helm rollback my-release 1
helm uninstall my-release
\`\`\`

---

## Kustomize

Customizacao de manifests YAML sem templates — **integrado ao kubectl**:

\`\`\`text
base/
  deployment.yaml
  service.yaml
  kustomization.yaml

overlays/
  production/
    kustomization.yaml  (patches, replicas, images)
  staging/
    kustomization.yaml
\`\`\`

\`\`\`bash
# Aplicar com kustomize
kubectl apply -k overlays/production/

# Preview do resultado
kubectl kustomize overlays/production/
\`\`\`

Diferencas Helm vs Kustomize:

| Aspecto | Helm | Kustomize |
|---------|------|-----------|
| Abordagem | Templates (Go) | Patches (overlay) |
| Complexidade | Mais complexo | Mais simples |
| Dependencias | Helm CLI | Integrado ao kubectl |
| Pacotes | Charts compartilhaveis | Estrutura de diretorios |

---

## Progressive Delivery

### Estrategias de Deploy

| Estrategia | Descricao | Risco |
|-----------|-----------|-------|
| **Recreate** | Remove todos, cria novos | Downtime |
| **Rolling Update** | Gradual, um por vez | Baixo |
| **Blue-Green** | Dois ambientes, switch instantaneo | Custo (2x recursos) |
| **Canary** | Percentual pequeno primeiro | Muito baixo |
| **A/B Testing** | Baseado em headers/cookies | Complexo |

\`\`\`text
Canary Deployment:
  v1 (90% trafego) ----+
                        +--> Users
  v2 (10% trafego) ----+

  Validar metricas --> Aumentar % --> 100% v2
\`\`\`

### Ferramentas de Progressive Delivery

| Ferramenta | Funcao |
|-----------|--------|
| **Argo Rollouts** | Canary e blue-green no K8s |
| **Flagger** | Progressive delivery com service mesh |
| **Istio** | Traffic splitting via VirtualService |

---

## Tekton

Framework CI/CD cloud-native para Kubernetes — **CNCF (parte do CD Foundation)**:

| Conceito | Descricao |
|----------|-----------|
| **Step** | Container que executa um comando |
| **Task** | Sequencia de steps |
| **Pipeline** | Sequencia de tasks |
| **PipelineRun** | Execucao de um pipeline |
| **Trigger** | Iniciar pipeline via webhook |

Tekton roda CI/CD como recursos Kubernetes nativos (CRDs).
`,

  quiz: [
    {
      question: 'O que e GitOps?',
      options: ['Usar Git para codigo apenas', 'Usar Git como unica fonte de verdade para infraestrutura e aplicacoes, com reconciliacao automatica', 'Um servico do GitHub', 'CI/CD tradicional com Git'],
      correct: 1,
      explanation: 'GitOps usa Git como fonte de verdade. Principios: declarativo, versionado em Git, aplicado automaticamente, reconciliado continuamente por agentes (ArgoCD, Flux).',
      reference: 'Conceito relacionado: GitOps — principios fundamentais.'
    },
    {
      question: 'Qual a vantagem do pull model (GitOps) sobre o push model?',
      options: ['E mais rapido', 'Credenciais do cluster ficam dentro do cluster, mais seguro', 'E mais simples de configurar', 'Nao precisa de Git'],
      correct: 1,
      explanation: 'No pull model, o agente (ArgoCD/Flux) roda dentro do cluster e observa Git. Credenciais do cluster nao precisam sair do cluster, ao contrario do push model onde o CI pipeline precisa de acesso.',
      reference: 'Conceito relacionado: Push vs Pull — seguranca.'
    },
    {
      question: 'Qual ferramenta GitOps CNCF graduated possui UI web rica?',
      options: ['Flux', 'ArgoCD', 'Tekton', 'Jenkins'],
      correct: 1,
      explanation: 'ArgoCD (parte do projeto Argo, CNCF graduated) possui UI web rica para visualizar aplicacoes, sync status e health. Flux e CLI-first e usa toolkit approach.',
      reference: 'Conceito relacionado: ArgoCD vs Flux — diferencas.'
    },
    {
      question: 'O que Helm e no ecossistema Kubernetes?',
      options: ['Container runtime', 'Gerenciador de pacotes (charts) para Kubernetes', 'Service mesh', 'Ferramenta de monitoramento'],
      correct: 1,
      explanation: 'Helm e o gerenciador de pacotes do K8s (CNCF graduated). Charts empacotam recursos K8s com templates e values para instalacao, upgrade e rollback faceis.',
      reference: 'Conceito relacionado: Helm — charts, releases, values.'
    },
    {
      question: 'Qual a diferenca principal entre Helm e Kustomize?',
      options: ['Helm e mais novo', 'Helm usa templates Go, Kustomize usa patches/overlays sem templates', 'Kustomize e mais complexo', 'Nao ha diferenca'],
      correct: 1,
      explanation: 'Helm: templates Go + values para gerar YAML. Kustomize: patches/overlays sobre YAML base, sem templates. Kustomize e integrado ao kubectl (kubectl apply -k).',
      reference: 'Conceito relacionado: Helm vs Kustomize — abordagens.'
    },
    {
      question: 'O que e Canary Deployment?',
      options: ['Deploy em todos os pods de uma vez', 'Enviar percentual pequeno de trafego para nova versao, validar e aumentar gradualmente', 'Manter dois ambientes identicos', 'Deploy apenas em staging'],
      correct: 1,
      explanation: 'Canary: nova versao recebe pequeno percentual de trafego (ex: 10%). Metricas sao validadas. Se OK, percentual aumenta gradualmente ate 100%. Risco muito baixo.',
      reference: 'Conceito relacionado: Progressive delivery — canary.'
    },
    {
      question: 'O que Tekton oferece para CI/CD no Kubernetes?',
      options: ['UI para dashboards', 'Framework CI/CD cloud-native que roda como recursos Kubernetes nativos (CRDs)', 'Service mesh para CI/CD', 'Gerenciamento de secrets'],
      correct: 1,
      explanation: 'Tekton define CI/CD como CRDs Kubernetes (Steps, Tasks, Pipelines, PipelineRuns). Cada step roda em um container. Cloud-native e extensivel.',
      reference: 'Conceito relacionado: Tekton — CI/CD Kubernetes-native.'
    }
  ],

  flashcards: [
    { front: 'O que e GitOps e quais sao seus principios?', back: 'Git como fonte de verdade. Principios: 1) Declarativo, 2) Versionado em Git, 3) Aplicado automaticamente, 4) Reconciliado por agentes. Pull model: agente observa Git. Push model: CI faz deploy.' },
    { front: 'Qual a diferenca entre CI, CD (delivery) e CD (deployment)?', back: 'CI: build + test automatico. Continuous Delivery: deploy automatizado com gate manual antes de producao. Continuous Deployment: deploy automatico em producao sem intervencao humana.' },
    { front: 'ArgoCD vs Flux?', back: 'ArgoCD: UI web rica, application-centric, multi-cluster nativo. Flux: CLI-first, toolkit/composable, GitRepository+Kustomization CRDs. Ambos CNCF graduated, ambos GitOps pull model.' },
    { front: 'O que e Helm?', back: 'Gerenciador de pacotes K8s (CNCF graduated). Chart = pacote (templates + values). Release = instancia instalada. Comandos: install, upgrade, rollback, uninstall. Templates Go.' },
    { front: 'Helm vs Kustomize?', back: 'Helm: templates Go, charts compartilhaveis, CLI separado. Kustomize: patches/overlays, sem templates, integrado ao kubectl (apply -k). Podem ser usados juntos.' },
    { front: 'Quais sao as estrategias de deploy?', back: 'Recreate (downtime), Rolling Update (gradual, padrao K8s), Blue-Green (switch instantaneo, 2x recursos), Canary (% pequeno primeiro), A/B Testing (headers/cookies). Argo Rollouts para canary/blue-green.' },
    { front: 'O que e Tekton?', back: 'Framework CI/CD cloud-native. CRDs: Step (container), Task (steps), Pipeline (tasks), PipelineRun (execucao), Trigger (webhook). Tudo roda como recursos Kubernetes nativos.' },
    { front: 'O que e progressive delivery?', back: 'Estrategia de deploy gradual com validacao. Canary: percentual de trafego crescente. Blue-green: dois ambientes com switch. Ferramentas: Argo Rollouts, Flagger, Istio traffic splitting.' }
  ],

  lab: {
    scenario: 'Voce esta explorando conceitos de entrega de aplicacoes no Kubernetes.',
    objective: 'Entender Helm, estrategias de deploy e conceitos de GitOps na pratica.',
    duration: '10-15 minutos',
    steps: [
      {
        title: 'Explorar Helm no Cluster',
        instruction: 'Verifique se Helm esta disponivel e explore charts e releases.',
        hints: ['Use helm version', 'Liste releases existentes', 'Procure charts no ArtifactHub'],
        solution: '```bash\n# Verificar Helm\nhelm version 2>/dev/null || echo "Helm nao instalado"\n\n# Listar releases em todos namespaces\nhelm list -A 2>/dev/null || echo "Sem releases"\n\n# Ver recursos instalados por Helm (label heritage ou app.kubernetes.io/managed-by)\nkubectl get all -A -l app.kubernetes.io/managed-by=Helm 2>/dev/null | head -15\n\n# Alternativa: ver ConfigMaps de Helm releases\nkubectl get secrets -A -l owner=helm | head -10\n```',
        verify: '```bash\nhelm version --short 2>/dev/null || echo "Helm nao disponivel"\n# Saida esperada: versao do Helm (v3.x.x) ou mensagem indicando nao instalado\n```'
      },
      {
        title: 'Estrategia Rolling Update',
        instruction: 'Crie um Deployment e observe a estrategia de Rolling Update ao alterar a imagem.',
        hints: ['Rolling Update e a estrategia padrao', 'Use kubectl set image para atualizar', 'Observe com kubectl rollout status'],
        solution: '```bash\n# Criar Deployment\nkubectl create deployment rolling-demo --image=nginx:1.24-alpine --replicas=3\nkubectl rollout status deployment/rolling-demo\n\n# Verificar estrategia\nkubectl get deployment rolling-demo -o jsonpath="{.spec.strategy.type}"\necho ""\n\n# Atualizar imagem (rolling update)\nkubectl set image deployment/rolling-demo nginx=nginx:1.25-alpine\n\n# Observar rollout\nkubectl rollout status deployment/rolling-demo\n\n# Ver historico\nkubectl rollout history deployment/rolling-demo\n```',
        verify: '```bash\nkubectl get deployment rolling-demo -o jsonpath="{.spec.strategy.type}"\n# Saida esperada: RollingUpdate\n\nkubectl rollout status deployment/rolling-demo\n# Saida esperada: deployment "rolling-demo" successfully rolled out\n\nkubectl rollout history deployment/rolling-demo | grep -c "revision"\n# Saida esperada: 2 (duas revisoes)\n```'
      },
      {
        title: 'Rollback de Deploy',
        instruction: 'Pratique rollback de um Deployment para a versao anterior.',
        hints: ['Use kubectl rollout undo', 'Verifique a imagem antes e depois', 'Consulte o historico com rollout history'],
        solution: '```bash\n# Ver imagem atual\nkubectl get deployment rolling-demo -o jsonpath="{.spec.template.spec.containers[0].image}"\necho ""\n\n# Rollback para revisao anterior\nkubectl rollout undo deployment/rolling-demo\n\n# Verificar imagem apos rollback\nkubectl rollout status deployment/rolling-demo\nkubectl get deployment rolling-demo -o jsonpath="{.spec.template.spec.containers[0].image}"\necho ""\n\n# Ver historico atualizado\nkubectl rollout history deployment/rolling-demo\n```',
        verify: '```bash\nkubectl get deployment rolling-demo -o jsonpath="{.spec.template.spec.containers[0].image}"\n# Saida esperada: nginx:1.24-alpine (voltou para versao anterior)\n\nkubectl get deployment rolling-demo\n# Saida esperada: READY 3/3\n```'
      }
    ]
  },

  troubleshooting: []
};
