window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['kyverno/kyverno-advanced'] = {
  theory: `
# Kyverno Avancado: PolicyException, CLI & Reports

## Relevancia
Este topico cobre os recursos avancados de operacao e governanca do Kyverno: PolicyException para excecoes controladas, a CLI do Kyverno para testes e CI/CD, PolicyReports para auditoria detalhada, e verifyImages para validacao de assinaturas com Cosign. Habilidades essenciais para operar Kyverno em producao.

## Conceitos Fundamentais

### PolicyException — Excecoes Controladas

O PolicyException permite excluir recursos especificos de policies sem modificar as policies em si — crucial para casos especiais sem comprometer a governanca global.

\`\`\`yaml
apiVersion: kyverno.io/v2beta1
kind: PolicyException
metadata:
  name: allow-privileged-datadog
  namespace: monitoring              # Namespace-scoped
spec:
  exceptions:
    - policyName: disallow-privileged-containers
      ruleNames:
        - deny-privileged            # Nome da rule especifica
  match:
    any:
      - resources:
          kinds: [DaemonSet, Pod]
          namespaces: [monitoring]
          selector:
            matchLabels:
              app: datadog-agent     # Apenas para o Datadog Agent
\`\`\`

\`\`\`yaml
# PolicyException para multiplas policies
apiVersion: kyverno.io/v2beta1
kind: PolicyException
metadata:
  name: allow-system-workloads
  namespace: kube-system
spec:
  exceptions:
    - policyName: require-labels
      ruleNames: ["*"]              # Todas as rules da policy
    - policyName: require-limits
      ruleNames: ["check-cpu", "check-memory"]
  match:
    any:
      - resources:
          kinds: [Pod, Deployment]
          namespaces: [kube-system]
\`\`\`

### Kyverno CLI — Teste Local e CI/CD

\`\`\`bash
# Instalar kyverno CLI
# Linux
curl -LO https://github.com/kyverno/kyverno/releases/latest/download/kyverno-cli_linux_amd64.tar.gz
tar -xvf kyverno-cli_linux_amd64.tar.gz
chmod +x kyverno && mv kyverno /usr/local/bin/

# macOS
brew install kyverno

# Verificar instalacao
kyverno version
\`\`\`

\`\`\`bash
# Aplicar policy a recurso e ver resultado
kyverno apply policy.yaml --resource deployment.yaml

# Multiplas policies e recursos
kyverno apply policies/ --resource manifests/ --recursive

# Ver detalhes de cada rule
kyverno apply policy.yaml --resource deployment.yaml --detailed-results

# Usar com cluster ao vivo (adicionar recursos existentes como contexto)
kyverno apply policy.yaml --resource deployment.yaml --cluster

# Gerar PolicyReport em formato YAML
kyverno apply policy.yaml --resource deployment.yaml -o yaml
\`\`\`

### Kyverno Test — Testes Unitarios de Policies

\`\`\`yaml
# kyverno-test.yaml — estrutura de teste
name: test-require-labels
policies:
  - require-labels.yaml
resources:
  - resources/

results:
  - policy: require-app-label
    rule: check-app-label
    resource: deployment-with-label.yaml
    namespace: default
    result: pass              # O recurso deve PASSAR

  - policy: require-app-label
    rule: check-app-label
    resource: deployment-without-label.yaml
    namespace: default
    result: fail              # O recurso deve FALHAR
\`\`\`

\`\`\`bash
# Executar testes
kyverno test .               # Roda todos os kyverno-test.yaml no diretorio
kyverno test . --detailed-results
kyverno test . --fail-fast   # Para no primeiro erro
\`\`\`

### Estrutura de Testes

\`\`\`
policies/
├── require-labels.yaml
├── deny-latest.yaml
tests/
├── kyverno-test.yaml         # Arquivo de teste principal
├── policies/                 # Link ou copia das policies
│   ├── require-labels.yaml
│   └── deny-latest.yaml
├── resources/
│   ├── pass/
│   │   ├── deployment-with-labels.yaml
│   │   └── deployment-with-version.yaml
│   └── fail/
│       ├── deployment-no-labels.yaml
│       └── deployment-latest-tag.yaml
└── expected/                 # Resultados esperados
\`\`\`

### VerifyImages — Validar Assinaturas com Cosign

\`\`\`yaml
# Verificar assinatura de imagem com Cosign
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-image-signatures
spec:
  validationFailureAction: Enforce
  background: false               # Nao faz sentido verificar existentes
  webhookTimeoutSeconds: 30
  rules:
    - name: verify-cosign-signature
      match:
        any:
          - resources:
              kinds: [Pod]
      verifyImages:
        - imageReferences:
            - "registry.acme.io/*"     # Aplicar a todas imagens deste registry
          attestors:
            - entries:
                - keyless:
                    subject: "https://github.com/acme-corp/workflows/.github/workflows/build.yaml@refs/heads/main"
                    issuer: "https://token.actions.githubusercontent.com"
                    rekor:
                      url: https://rekor.sigstore.dev
\`\`\`

\`\`\`yaml
# Verificar com chave publica (key-based)
verifyImages:
  - imageReferences:
      - "ghcr.io/myorg/*"
    attestors:
      - entries:
          - keys:
              publicKeys: |-
                -----BEGIN PUBLIC KEY-----
                MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...
                -----END PUBLIC KEY-----
    mutateDigest: true           # Substituir tag por digest imutavel
    verifyDigest: true           # Verificar que nao e tag mutavel
    required: true               # Obrigatorio ter assinatura
\`\`\`

### PolicyReports — Auditoria Detalhada

\`\`\`bash
# Listar todos os PolicyReports
kubectl get policyreport -A
kubectl get clusterpolicyreport

# Ver violacoes especificas
kubectl get policyreport -n production \\
  -o jsonpath='{.items[*].results[?(@.result=="fail")].resource}'

# Filtrar por policy especifica
kubectl get policyreport -A \\
  -o jsonpath='{range .items[*]}{range .results[?(@.policy=="require-labels")]}{.resource}{"\n"}{end}{end}'
\`\`\`

\`\`\`bash
# Usar Policy Reporter (ferramenta visual)
helm install policy-reporter policy-reporter/policy-reporter \\
  --set ui.enabled=true \\
  --set kyvernoPlugin.enabled=true \\
  --namespace policy-reporter \\
  --create-namespace

# Acessar dashboard
kubectl port-forward service/policy-reporter-ui 8082:8080 -n policy-reporter
# Abrir: http://localhost:8082
\`\`\`

### Metricas do Kyverno

\`\`\`bash
# Kyverno expoe metricas Prometheus por padrao
# Endpoint: http://kyverno-svc:8000/metrics

# Metricas importantes:
# kyverno_policy_results_total{policy, rule, resource_type, namespace, status}
# kyverno_admission_requests_total{resource_type, operation}
# kyverno_policy_execution_duration_seconds

# Com ServiceMonitor (Prometheus Operator):
kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: kyverno
  namespace: kyverno
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: kyverno
  endpoints:
    - port: metrics
      interval: 30s
EOF
\`\`\`

### Kyverno Policies como Codigo (GitOps)

\`\`\`yaml
# .github/workflows/policy-test.yaml
name: Kyverno Policy Tests

on:
  pull_request:
    paths:
      - 'policies/**'
      - 'tests/**'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Kyverno CLI
        run: |
          curl -LO https://github.com/kyverno/kyverno/releases/latest/download/kyverno-cli_linux_amd64.tar.gz
          tar xvf kyverno-cli_linux_amd64.tar.gz
          chmod +x kyverno
          mv kyverno /usr/local/bin/

      - name: Run Kyverno Tests
        run: kyverno test tests/ --detailed-results

      - name: Validate policies against manifests
        run: kyverno apply policies/ --resource k8s-manifests/ --recursive
\`\`\`

### Boas Praticas em Producao

\`\`\`yaml
# 1. Use annotations para documentar policies
metadata:
  annotations:
    policies.kyverno.io/title: Policy Title
    policies.kyverno.io/category: Security | Best Practices | Multi-Tenancy
    policies.kyverno.io/severity: low | medium | high | critical
    policies.kyverno.io/subject: Pod, Deployment
    policies.kyverno.io/description: >-
      Descricao detalhada da policy e por que ela existe.

# 2. Sempre comece com Audit antes de Enforce
# 3. Use PolicyException para casos especiais (nao modifique a policy)
# 4. Versione policies no Git
# 5. Teste com kyverno CLI antes de aplicar
# 6. HA: 3 replicas para admission controller em producao
# 7. Configure timeouts adequados (webhookTimeoutSeconds)
# 8. Monitore PolicyReports e metricas
\`\`\`

### Erros Comuns Avancados

1. **PolicyException sem match correto** — A excecao usa matchLabels errados e nao se aplica ao recurso correto
2. **verifyImages com background: true** — Verificacao de assinaturas nao faz sentido para recursos existentes; usar background: false
3. **webhookTimeoutSeconds muito baixo** — Operacoes de verifyImages podem demorar mais que o timeout default (10s); aumentar para 30s
4. **PolicyException escopo** — PolicyException e namespace-scoped; para excecoes cluster-wide, criar no mesmo namespace do recurso ou usar ClusterPolicyException (v3+)
5. **kyverno test falha sem diretorio resources** — O arquivo kyverno-test.yaml precisa referenciar arquivos existentes

## Killer.sh Style Challenge

> **Cenario:** (1) Voce tem uma ClusterPolicy \`disallow-privileged\` que bloqueia containers privilegiados. O Prometheus no namespace monitoring precisa rodar como privileged. Crie um PolicyException adequado. (2) Crie um arquivo de teste kyverno que verifica que um Pod com container privilegiado FALHA na policy e que um Pod com container nao-privilegiado PASSA.
`,
  quiz: [
    {
      question: 'Para que serve o PolicyException no Kyverno?',
      options: [
        'Para desabilitar uma ClusterPolicy temporariamente',
        'Para excluir recursos especificos de policies especificas sem modificar a policy global — permite excecoes controladas e rastreadas',
        'Para criar policies com menor prioridade',
        'Para aplicar policies apenas a determinados usuarios'
      ],
      correct: 1,
      explanation: 'PolicyException cria uma excecao auditavel — o recurso passa a policy mesmo violando, mas a excecao fica registrada. Muito melhor que modificar a policy para adicionar exclusoes ou usar o campo exclude da policy (que afeta todos). Permite excecoes especificas por recurso/namespace/label.',
      reference: 'Conceito relacionado: PolicyException e namespace-scoped em v1; em v3+ existe ClusterPolicyException para excecoes cluster-wide.'
    },
    {
      question: 'Qual o proposito do comando kyverno test?',
      options: [
        'Testar a conectividade do webhook Kyverno',
        'Executar testes unitarios de policies usando um arquivo kyverno-test.yaml que define recursos e resultados esperados (pass/fail)',
        'Verificar se o Kyverno esta instalado corretamente',
        'Testar policies em um cluster de staging'
      ],
      correct: 1,
      explanation: 'kyverno test executa testes unitarios locais: sem cluster necessario. Usa um arquivo kyverno-test.yaml que lista policies, recursos de teste, e o resultado esperado (pass/fail) para cada combinacao. Essencial para CI/CD — valida que policies funcionam como esperado antes de aplicar ao cluster.',
      reference: 'Conceito relacionado: kyverno apply valida recursos contra policies e mostra violacoes; kyverno test verifica que a policy se comporta como esperado com casos positivos E negativos.'
    },
    {
      question: 'Por que verifyImages deve usar background: false?',
      options: [
        'verifyImages e muito lento para background scanning',
        'Verificar assinaturas de imagens so faz sentido no momento de admission (criacao/update). Recursos ja existentes nao podem ser verificados retroativamente — a imagem ja esta rodando',
        'background: false e mais seguro para producao',
        'verifyImages nao suporta background scanning'
      ],
      correct: 1,
      explanation: 'Background scanning verifica recursos existentes. Para verifyImages, verificar a assinatura de uma imagem que ja esta rodando nao tem valor de seguranca — a imagem foi admitida. background: false foca no admission time, que e o momento relevante para seguranca de supply chain.',
      reference: 'Conceito relacionado: Para garantia mais forte, usar mutateDigest: true para substituir tags por digests imutaveis.'
    },
    {
      question: 'Como o PolicyException garante que excecoes sao controladas e auditadas?',
      options: [
        'PolicyException loga todas as excecoes no SIEM',
        'PolicyException e um recurso K8s separado da policy — pode ser controlado por RBAC (quem pode criar excecoes), versionado no Git, revisado em PRs, e aparece em PolicyReports',
        'PolicyException tem validade de tempo automatica',
        'PolicyException requer aprovacao de dois administradores'
      ],
      correct: 1,
      explanation: 'Como e um recurso K8s separado, PolicyException pode ter RBAC restrito (apenas admins criam), ser versionado em GitOps com review de PR, auditado pelo Kubernetes audit log, e documentado com annotations. Muito mais governavel que modificar a policy global.',
      reference: 'Conceito relacionado: Em ambientes maduros, PolicyExceptions requerem aprovacao em PR antes de ser aplicadas ao cluster.'
    },
    {
      question: 'Quais metricas Prometheus o Kyverno expoe por padrao?',
      options: [
        'Apenas metricas de CPU e memoria',
        'kyverno_policy_results_total (resultados por policy/rule/status), kyverno_admission_requests_total, kyverno_policy_execution_duration_seconds',
        'Apenas numero total de policies',
        'Kyverno nao expoe metricas Prometheus nativamente'
      ],
      correct: 1,
      explanation: 'Kyverno expoe metricas Prometheus no endpoint :8000/metrics. kyverno_policy_results_total conta pass/fail/warn por policy e rule. kyverno_admission_requests_total conta requests por tipo. kyverno_policy_execution_duration_seconds mede latencia. Essenciais para SLOs e alertas de governanca.',
      reference: 'Conceito relacionado: Usar ServiceMonitor do Prometheus Operator para scraping automatico das metricas Kyverno.'
    },
    {
      question: 'Qual o arquivo principal que o comando kyverno test procura?',
      options: [
        'policy-test.yaml',
        'kyverno-test.yaml — define policies, recursos de teste e resultados esperados (pass/fail)',
        'test-suite.yaml',
        'kyverno.config.yaml'
      ],
      correct: 1,
      explanation: 'O arquivo kyverno-test.yaml (na raiz do diretorio testado) define: name do teste, lista de policies, diretorio/arquivos de recursos, e results com policy, rule, resource e resultado esperado (pass/fail/warn/error/skip). O comando kyverno test . busca por esse arquivo recursivamente.',
      reference: 'Conceito relacionado: Use kyverno test . --detailed-results para ver exatamente qual rule gerou qual resultado em cada recurso.'
    },
    {
      question: 'Como o mutateDigest em verifyImages aumenta a seguranca?',
      options: [
        'mutateDigest adiciona uma hash ao nome da imagem',
        'mutateDigest substitui a tag mutavel (ex: :latest, :v1.0) pelo digest SHA256 imutavel da imagem — garantindo que exatamente a imagem verificada seja usada, sem possibilidade de substituicao',
        'mutateDigest criptografa a imagem',
        'mutateDigest verifica a integridade do layer da imagem'
      ],
      correct: 1,
      explanation: 'Tags de imagem sao mutaveis — o mesmo ":v1.0" pode ser re-tagged para apontar para outra imagem. mutateDigest: true substitui a tag pelo digest SHA256 imutavel (ex: nginx@sha256:abc123...), garantindo que mesmo se a tag mudar no registry, o Pod sempre usa exatamente a imagem que foi verificada e assinada.',
      reference: 'Conceito relacionado: Combinar verifyImages com mutateDigest e verifyDigest: true para maxima seguranca de supply chain.'
    }
  ],
  flashcards: [
    {
      front: 'PolicyException — estrutura e quando usar',
      back: '**Quando usar:**\nRecurso legitimo que viola uma policy\n(DaemonSet do Datadog, node-exporter, etc.)\n\n**Estrutura:**\n\`\`\`yaml\napiVersion: kyverno.io/v2beta1\nkind: PolicyException\nmetadata:\n  name: allow-datadog\n  namespace: monitoring\nspec:\n  exceptions:\n    - policyName: disallow-privileged\n      ruleNames:\n        - deny-privileged  # ou "*" para todas\n  match:\n    any:\n      - resources:\n          kinds: [DaemonSet]\n          namespaces: [monitoring]\n          selector:\n            matchLabels:\n              app: datadog-agent\n\`\`\`\n\n**Vantagens:**\n- Auditavel (recurso K8s)\n- Controlado por RBAC\n- Versionado em Git\n- Nao polui a policy global'
    },
    {
      front: 'Kyverno CLI — comandos principais',
      back: '**kyverno apply:**\nAplica policy a recurso e mostra resultado\n\`\`\`bash\nkyverno apply policy.yaml \\\n  --resource resource.yaml\nkyverno apply policies/ \\\n  --resource manifests/ --recursive\n\`\`\`\n\n**kyverno test:**\nTestes unitarios com kyverno-test.yaml\n\`\`\`bash\nkyverno test .\nkyverno test . --detailed-results\nkyverno test . --fail-fast\n\`\`\`\n\n**kyverno jp:**\nTestar expressoes JMESPath\n\`\`\`bash\nkyverno jp query \\\n  -i resource.json \\\n  -q "spec.containers[].image"\n\`\`\`\n\n**kyverno version:**\nVer versao instalada'
    },
    {
      front: 'kyverno-test.yaml — estrutura completa',
      back: '\`\`\`yaml\nname: test-suite-name\npolicies:\n  - policy.yaml\n  - policies/\nresources:\n  - resources/\nvariables: variables.yaml  # opcional\ngenerationConfig:          # para generate rules\n  test: true\nresults:\n  - policy: policy-name\n    rule: rule-name\n    resource: resource.yaml\n    namespace: default\n    result: pass  # pass/fail/warn/error/skip\n  - policy: policy-name\n    rule: rule-name\n    resource: resource2.yaml\n    result: fail\n    patchedResource: expected-mutated.yaml  # para mutate\n\`\`\`\n\n**Dica:** Sempre incluir\ncasos positivos (pass) E negativos (fail)'
    },
    {
      front: 'verifyImages — key-based vs keyless',
      back: '**Key-based:**\nVerifica assinatura com chave publica\n\`\`\`yaml\nverifyImages:\n  - imageReferences: ["registry.io/*"]\n    attestors:\n      - entries:\n          - keys:\n              publicKeys: |-\n                -----BEGIN PUBLIC KEY-----\n                ...\n                -----END PUBLIC KEY-----\n\`\`\`\nPros: Simples, sem dependencia externa\nContras: Gerenciamento de chaves\n\n**Keyless (Sigstore/Fulcio):**\nVerifica via OIDC identity\n\`\`\`yaml\nverifyImages:\n  - imageReferences: ["ghcr.io/org/*"]\n    attestors:\n      - entries:\n          - keyless:\n              subject: "https://github.com/org/repo/.github/workflows/build.yaml@refs/heads/main"\n              issuer: "https://token.actions.githubusercontent.com"\n\`\`\`\nPros: Sem chaves, vinculado a identidade CI\nContras: Requer rekor/fulcio acessiveis'
    },
    {
      front: 'PolicyReports — como consultar e usar',
      back: '**Listar reports:**\n\`\`\`bash\n# Por namespace\nkubectl get policyreport -n myns\n# Cluster-scoped\nkubectl get clusterpolicyreport\n# Todos\nkubectl get policyreport -A\n\`\`\`\n\n**Filtrar violacoes:**\n\`\`\`bash\nkubectl get policyreport -n prod \\\n  -o jsonpath=\'{.items[*].results[?(@.result=="fail")].resource}\'\n\`\`\`\n\n**Campos do result:**\n- policy: nome da policy\n- rule: nome da rule\n- resource: recurso violador\n- result: pass/fail/warn/error/skip\n- message: descricao da violacao\n- severity: low/medium/high/critical\n\n**Policy Reporter UI:**\nDashboard grafico para visualizar\ntodos os PolicyReports do cluster.'
    },
    {
      front: 'Kyverno em producao — checklist',
      back: '**HA:**\n- admissionController.replicas=3\n- backgroundController.replicas=2\n- PodDisruptionBudget configurado\n\n**Configuracao:**\n- failurePolicy: Fail para policies criticas\n- failurePolicy: Ignore para non-critical\n- webhookTimeoutSeconds: 30 (verify images)\n\n**Governanca:**\n- Comece com Audit, depois Enforce\n- PolicyException para casos especiais\n- Versionar policies em Git\n- kyverno test em CI/CD pipeline\n\n**Observabilidade:**\n- Metricas Prometheus scrapeadas\n- Alertas em kyverno_policy_results_total{status="fail"}\n- Policy Reporter UI para dashboard\n- Audit logs K8s para PolicyExceptions\n\n**Seguranca:**\n- RBAC restrito para PolicyException\n- verifyImages com mutateDigest: true\n- background: false para verifyImages'
    }
  ],
  lab: {
    scenario: 'Voce precisa implementar governanca avancada: criar excecoes controladas para workloads especiais, testar suas policies com kyverno CLI, e configurar auditoria de PolicyReports.',
    objective: 'Aprender PolicyException, testes com kyverno CLI, e leitura de PolicyReports.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Criar PolicyException para workload especial',
        instruction: `Implemente uma excecao controlada para um workload privilegiado:
1. Criar uma ClusterPolicy que bloqueia containers com hostNetwork ou hostPID
2. Criar um namespace monitoring com um DaemonSet que precisa de hostNetwork
3. Criar um PolicyException para permitir o DaemonSet especifico
4. Verificar que outros Pods sao bloqueados mas o DaemonSet passa`,
        hints: [
          'PolicyException e namespace-scoped — criado no namespace do recurso excepcionado',
          'O campo exceptions[].ruleNames pode usar "*" para todas as rules da policy',
          'O match do PolicyException deve ser especifico — evitar excecoes muito amplas'
        ],
        solution: `\`\`\`yaml
# disallow-host-namespaces.yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: disallow-host-namespaces
spec:
  validationFailureAction: Enforce
  rules:
    - name: host-namespaces
      match:
        any:
          - resources:
              kinds: [Pod]
      exclude:
        any:
          - resources:
              namespaces: [kube-system, kyverno]
      validate:
        message: "hostNetwork e hostPID nao sao permitidos."
        pattern:
          spec:
            =(hostNetwork): "false"
            =(hostPID): "false"
\`\`\`

\`\`\`bash
kubectl apply -f disallow-host-namespaces.yaml
kubectl create namespace monitoring
\`\`\`

\`\`\`yaml
# node-exporter-exception.yaml
apiVersion: kyverno.io/v2beta1
kind: PolicyException
metadata:
  name: allow-node-exporter
  namespace: monitoring
spec:
  exceptions:
    - policyName: disallow-host-namespaces
      ruleNames:
        - host-namespaces
  match:
    any:
      - resources:
          kinds: [DaemonSet, Pod]
          namespaces: [monitoring]
          selector:
            matchLabels:
              app: node-exporter
\`\`\`

\`\`\`bash
kubectl apply -f node-exporter-exception.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verificar policy criada
kubectl get clusterpolicy disallow-host-namespaces
# Saida esperada: READY=true VALIDATIONACTION=Enforce

# Verificar PolicyException criada
kubectl get policyexception -n monitoring
# Saida esperada: allow-node-exporter

# Testar que Pod normal e BLOQUEADO
kubectl apply -n default - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: test-hostnetwork
spec:
  hostNetwork: true
  containers:
    - name: test
      image: nginx:1.25.0
EOF
# Saida esperada: ERRO - bloqueado pela policy

# Testar que Pod com label da excecao PASSA no namespace monitoring
kubectl apply -n monitoring - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: node-exporter-test
  labels:
    app: node-exporter
spec:
  hostNetwork: true
  containers:
    - name: exporter
      image: prom/node-exporter:v1.7.0
EOF
# Saida esperada: Pod criado com sucesso (excecao se aplica)

# Limpar
kubectl delete pod node-exporter-test -n monitoring 2>/dev/null || true
\`\`\``
      },
      {
        title: 'Testar policies com Kyverno CLI',
        instruction: `Use o Kyverno CLI para testes locais e CI/CD:
1. Instalar ou verificar kyverno CLI
2. Criar arquivos de recursos de teste (um que passa, um que falha)
3. Rodar kyverno apply para ver resultados
4. Criar um kyverno-test.yaml e rodar kyverno test`,
        hints: [
          'kyverno apply nao requer conexao com cluster',
          'O arquivo kyverno-test.yaml define resultados esperados para automacao',
          'Usar --detailed-results para ver qual rule falhou'
        ],
        solution: `\`\`\`bash
# Verificar kyverno CLI (ou instalar)
which kyverno || (
  curl -LO "https://github.com/kyverno/kyverno/releases/latest/download/kyverno-cli_linux_amd64.tar.gz"
  tar xvf kyverno-cli_linux_amd64.tar.gz
  chmod +x kyverno && mv kyverno /usr/local/bin/
)
kyverno version
\`\`\`

\`\`\`bash
# Criar estrutura de teste
mkdir -p /tmp/kyverno-test/{policies,resources}

# Policy
cat > /tmp/kyverno-test/policies/require-label.yaml <<EOF
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-app-label
spec:
  validationFailureAction: Enforce
  rules:
    - name: check-label
      match:
        any:
          - resources:
              kinds: [Deployment]
      validate:
        message: "Label 'app' obrigatorio."
        pattern:
          metadata:
            labels:
              app: "?*"
EOF

# Recurso que PASSA
cat > /tmp/kyverno-test/resources/good-deploy.yaml <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: good-app
  namespace: default
  labels:
    app: good-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: good-app
  template:
    metadata:
      labels:
        app: good-app
    spec:
      containers:
        - name: app
          image: nginx:1.25.0
EOF

# Recurso que FALHA
cat > /tmp/kyverno-test/resources/bad-deploy.yaml <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bad-app
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      run: bad-app
  template:
    metadata:
      labels:
        run: bad-app
    spec:
      containers:
        - name: app
          image: nginx:1.25.0
EOF

# Arquivo de teste
cat > /tmp/kyverno-test/kyverno-test.yaml <<EOF
name: test-require-label
policies:
  - policies/require-label.yaml
resources:
  - resources/
results:
  - policy: require-app-label
    rule: check-label
    resource: good-deploy.yaml
    namespace: default
    result: pass
  - policy: require-app-label
    rule: check-label
    resource: bad-deploy.yaml
    namespace: default
    result: fail
EOF

# Testar apply manual
kyverno apply /tmp/kyverno-test/policies/require-label.yaml \\
  --resource /tmp/kyverno-test/resources/good-deploy.yaml

kyverno apply /tmp/kyverno-test/policies/require-label.yaml \\
  --resource /tmp/kyverno-test/resources/bad-deploy.yaml
\`\`\``,
        verify: `\`\`\`bash
# Executar os testes unitarios
cd /tmp/kyverno-test && kyverno test . --detailed-results
# Saida esperada:
# Passing tests: 2
# Test Results: Pass 2

# Verificar que apply retorna exit code correto
kyverno apply /tmp/kyverno-test/policies/require-label.yaml \\
  --resource /tmp/kyverno-test/resources/bad-deploy.yaml
echo "Exit code: $?"
# Saida esperada: exit code != 0 (violacao encontrada)

kyverno apply /tmp/kyverno-test/policies/require-label.yaml \\
  --resource /tmp/kyverno-test/resources/good-deploy.yaml
echo "Exit code: $?"
# Saida esperada: exit code = 0 (sem violacao)

# Simular CI/CD check
cd /tmp/kyverno-test && kyverno test . --fail-fast
echo "CI Check: PASSED"
\`\`\``
      },
      {
        title: 'Analisar PolicyReports e metricas',
        instruction: `Explore os PolicyReports gerados pelo Kyverno:
1. Criar recursos que violam policies (modo Audit) para gerar PolicyReports
2. Usar kubectl para consultar PolicyReports e filtrar violacoes
3. Ver o resumo de pass/fail/warn
4. Entender como usar PolicyReports para auditoria de compliance`,
        hints: [
          'O background controller gera PolicyReports para recursos existentes',
          'jsonpath pode filtrar apenas resultados fail nos PolicyReports',
          'kubectl get policyreport -A mostra todos os namespaces'
        ],
        solution: `\`\`\`bash
# Criar policy em modo Audit para gerar PolicyReports
kubectl apply -f - <<EOF
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: audit-no-requests
spec:
  validationFailureAction: Audit
  background: true
  rules:
    - name: check-requests
      match:
        any:
          - resources:
              kinds: [Deployment]
              namespaces: [default]
      validate:
        message: "Deployments devem ter requests de CPU e memory."
        pattern:
          spec:
            template:
              spec:
                containers:
                  - resources:
                      requests:
                        memory: "?*"
                        cpu: "?*"
EOF

# Criar alguns Deployments sem requests (para gerar violacoes)
kubectl create deployment no-requests-1 --image=nginx:1.25.0 -n default
kubectl create deployment no-requests-2 --image=redis:7.0 -n default

# Aguardar background scan
echo "Aguardando background scan (30s)..."
sleep 30
\`\`\``,
        verify: `\`\`\`bash
# Listar PolicyReports no namespace default
kubectl get policyreport -n default
# Saida esperada: PolicyReport com FAIL > 0

# Ver resumo de pass/fail
kubectl get policyreport -n default -o jsonpath='{.items[0].summary}'
# Saida esperada: {fail: N, pass: M, warn: 0, error: 0, skip: 0}

# Filtrar apenas resultados fail
kubectl get policyreport -n default \\
  -o jsonpath='{range .items[*]}{range .results[?(@.result=="fail")]}{.resource.name}{" — "}{.policy}{"\n"}{end}{end}'
# Saida esperada: lista de deployments que violam policies

# Ver detalhes de uma violacao especifica
kubectl get policyreport -n default \\
  -o jsonpath='{.items[0].results[0]}'
# Saida esperada: objeto com policy, rule, resource, message, result

# Ver todas as violacoes de todos os namespaces
kubectl get policyreport -A \\
  -o jsonpath='{range .items[*]}{.metadata.namespace}{": "}{.summary.fail}{" falhas\n"}{end}'
# Saida esperada: lista namespace: N falhas

# Limpar
kubectl delete deployment no-requests-1 no-requests-2 -n default
kubectl delete clusterpolicy audit-no-requests
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'PolicyException nao esta sendo aplicada ao recurso',
      difficulty: 'medium',
      symptom: 'Criou um PolicyException mas o recurso ainda esta sendo bloqueado pela ClusterPolicy. A excecao parece nao ter efeito.',
      diagnosis: `\`\`\`bash
# 1. Verificar se a PolicyException foi criada corretamente
kubectl get policyexception -n <namespace>
kubectl describe policyexception <nome> -n <namespace>

# 2. Verificar se o policyName e ruleNames estao corretos
kubectl get policyexception <nome> -n <namespace> -o yaml | grep -A10 "exceptions:"
# Verificar que policyName corresponde exatamente ao nome da ClusterPolicy

# 3. Verificar se o match da Exception corresponde ao recurso
kubectl get policyexception <nome> -n <namespace> -o yaml | grep -A10 "match:"

# 4. Verificar logs do admission controller para ver se a Exception e encontrada
kubectl logs -n kyverno \\
  -l app.kubernetes.io/component=admission-controller \\
  --tail=30 | grep -i "exception"

# 5. Verificar versao do Kyverno (PolicyException requer v1.9+)
kubectl get pods -n kyverno -o jsonpath='{.items[0].spec.containers[0].image}'
\`\`\``,
      solution: `**Causas e solucoes:**

1. **policyName errado:** O campo policyName deve ser o nome EXATO da ClusterPolicy (case-sensitive). Verificar com kubectl get clusterpolicy.

2. **ruleNames errado:** O campo ruleNames deve corresponder ao nome EXATO da rule na policy. Verificar com kubectl get clusterpolicy <nome> -o yaml.

3. **Match muito restrito:** O match do PolicyException usa labels que o recurso nao tem, ou namespace errado. Verificar que o recurso real tem os labels especificados.

4. **Namespace errado:** PolicyException e namespace-scoped. Deve estar no mesmo namespace do recurso excepcionado. Para recursos cluster-scoped, verificar a documentacao.

5. **Versao incompativel:** PolicyException foi introduzido no Kyverno v1.9. Versoes mais antigas nao suportam. Atualizar o Kyverno.`
    },
    {
      title: 'kyverno test falha com "policy not found" mesmo com arquivo correto',
      difficulty: 'easy',
      symptom: 'O comando kyverno test retorna erro "policy not found" ou "resource file not found" mesmo com os arquivos existindo no diretorio.',
      diagnosis: `\`\`\`bash
# 1. Verificar estrutura do diretorio
ls -la
# Verificar se kyverno-test.yaml existe na raiz do diretorio

# 2. Verificar caminhos nos campos policies e resources
cat kyverno-test.yaml | grep -A5 "policies:\\|resources:"

# 3. Verificar se os arquivos referenciados existem
# Os caminhos sao RELATIVOS ao kyverno-test.yaml
ls policies/
ls resources/

# 4. Rodar com verbose para mais detalhes
kyverno test . --detailed-results 2>&1 | head -20
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Caminhos relativos:** Os campos \`policies\` e \`resources\` no kyverno-test.yaml usam caminhos relativos ao diretorio onde kyverno-test.yaml esta. Se o arquivo esta em \`tests/\` e policy em \`tests/policies/\`, usar \`policies/\` (relativo).

2. **Extensao errada:** Verificar que os arquivos tem extensao .yaml ou .yml (nao .json ou sem extensao).

3. **kyverno-test.yaml na subpasta:** O comando \`kyverno test .\` busca kyverno-test.yaml na raiz do diretorio passado. Se esta em subpasta, passar o path correto: \`kyverno test tests/\`.

4. **Campo resource incorreto em results:** O campo \`resource\` em results deve ser o NOME DO ARQUIVO (sem path completo), nao o nome do recurso K8s. Ex: \`resource: deployment.yaml\` nao \`resource: my-deployment\`.

5. **kind/apiVersion ausente no recurso:** O arquivo de recurso deve ter apiVersion e kind completos — nao pode ser um patch ou fragmento YAML.`
    }
  ]
};
