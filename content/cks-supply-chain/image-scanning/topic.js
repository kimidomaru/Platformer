window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['cks-supply-chain/image-scanning'] = {

  theory: `# Image Vulnerability Scanning

## Relevancia no CKS
> O dominio "Supply Chain Security" vale **20%** do CKS. Scanning de imagens detecta vulnerabilidades conhecidas antes e durante a execucao. Voce deve saber usar Trivy e integrar scanning no pipeline.

---

## Por que Scan de Imagens?

Imagens de container podem conter:
- Pacotes OS com CVEs conhecidas
- Bibliotecas com vulnerabilidades
- Configuracoes inseguras
- Secrets embutidos acidentalmente
- Malware

---

## Trivy (Aqua Security)

**Trivy** e o scanner mais usado e recomendado para o CKS.

### Scanning Basico

\`\`\`bash
# Scan de imagem
trivy image nginx:1.25

# Scan com severidade minima
trivy image --severity HIGH,CRITICAL nginx:1.25

# Scan com saida JSON
trivy image --format json -o results.json nginx:1.25

# Scan ignorando CVEs sem fix
trivy image --ignore-unfixed nginx:1.25
\`\`\`

### Severidades

| Nivel | Descricao | Acao |
|-------|-----------|------|
| **CRITICAL** | Exploracao remota, sem autenticacao | Corrigir imediatamente |
| **HIGH** | Exploracao com algumas condicoes | Corrigir rapidamente |
| **MEDIUM** | Impacto moderado | Planejar correcao |
| **LOW** | Impacto minimo | Corrigir quando possivel |
| **UNKNOWN** | Severidade nao classificada | Avaliar caso a caso |

### Scan de Filesystem e Repositorio

\`\`\`bash
# Scan de diretorio local (Dockerfile, configs)
trivy fs --security-checks vuln,secret,config .

# Scan de repositorio Git
trivy repo https://github.com/org/app

# Scan de Dockerfile
trivy config Dockerfile
\`\`\`

---

## Trivy no CI/CD

\`\`\`bash
# Falhar se houver vulnerabilidades CRITICAL
trivy image --exit-code 1 --severity CRITICAL myapp:latest

# Saida em formato table para logs
trivy image --format table --severity HIGH,CRITICAL myapp:latest
\`\`\`

---

## Trivy Operator (Scanning Continuo)

O **Trivy Operator** roda dentro do cluster e escaneia imagens continuamente:

\`\`\`bash
# Instalar via Helm
helm repo add aqua https://aquasecurity.github.io/helm-charts/
helm install trivy-operator aqua/trivy-operator \\
  --namespace trivy-system --create-namespace

# Ver resultados de vulnerability reports
kubectl get vulnerabilityreports -A
kubectl describe vulnerabilityreport -n <ns> <name>
\`\`\`

---

## Admission Control para Imagens

### ImagePolicyWebhook

\`\`\`yaml
# /etc/kubernetes/admission/image-policy.yaml
apiVersion: apiserver.config.k8s.io/v1
kind: AdmissionConfiguration
plugins:
- name: ImagePolicyWebhook
  configuration:
    imagePolicy:
      kubeConfigFile: /etc/kubernetes/admission/imagepolicy-kubeconfig.yaml
      allowTTL: 50
      denyTTL: 50
      retryBackoff: 500
      defaultAllow: false
\`\`\`

\`\`\`yaml
# API Server flag
--enable-admission-plugins=ImagePolicyWebhook
--admission-control-config-file=/etc/kubernetes/admission/image-policy.yaml
\`\`\`

### Usando OPA/Gatekeeper para Validacao

\`\`\`yaml
# Bloquear imagens com vulnerabilidades criticas
# (requer integracao com scanner)
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sAllowedRepos
metadata:
  name: require-scanned-images
spec:
  match:
    kinds:
    - apiGroups: [""]
      kinds: ["Pod"]
  parameters:
    repos:
    - "registry.internal.com/scanned/"
\`\`\`

---

## Comparacao de Scanners

| Scanner | Tipo | Licenca | Destaque |
|---------|------|---------|----------|
| **Trivy** | CLI + Operator | Open Source | Mais completo, recomendado |
| **Clair** | Servidor | Open Source | Usado pelo Quay |
| **Grype** | CLI | Open Source | Rapido, por Anchore |
| **Snyk** | SaaS + CLI | Freemium | Integracao com IDEs |

---

## SBOM (Software Bill of Materials)

\`\`\`bash
# Gerar SBOM com Trivy
trivy image --format spdx-json -o sbom.json nginx:1.25

# Gerar SBOM com syft
syft nginx:1.25 -o spdx-json > sbom.json

# Scan de SBOM existente
trivy sbom sbom.json
\`\`\`

---

## Erros Comuns

1. **Scan apenas no build, nunca em runtime** — novas CVEs aparecem apos deploy
2. **Ignorar vulnerabilidades sem fix** — monitorar e atualizar quando fix disponivel
3. **Nao bloquear imagens vulneraveis** — sem admission control, qualquer imagem roda
4. **Usar :latest sem scan** — imagens mudam sem controle
5. **Nao gerar SBOM** — dificulta rastreamento de componentes afetados

---

## Killer.sh Style Challenge

> Use Trivy para escanear a imagem \`nginx:1.21\`. Identifique vulnerabilidades CRITICAL e HIGH. Em seguida, configure um admission controller que bloqueie imagens de registries nao aprovados.
`,

  quiz: [
    {
      question: 'Qual ferramenta de scan de imagens e mais recomendada para o CKS?',
      options: ['Clair', 'Trivy', 'Snyk', 'SonarQube'],
      correct: 1,
      explanation: 'Trivy (Aqua Security) e o scanner mais completo e recomendado. Escaneia imagens, filesystems, repos, configs, e possui operator para scanning continuo no cluster.',
      reference: 'Conceito relacionado: Trivy — scanner de vulnerabilidades.'
    },
    {
      question: 'Qual flag do Trivy faz o comando falhar se encontrar vulnerabilidades CRITICAL?',
      options: ['--fail-on CRITICAL', '--exit-code 1 --severity CRITICAL', '--abort CRITICAL', '--strict CRITICAL'],
      correct: 1,
      explanation: '--exit-code 1 faz o Trivy retornar codigo de saida 1 (erro) quando encontra vulnerabilidades. --severity CRITICAL filtra apenas CRITICALs.',
      reference: 'Conceito relacionado: Trivy — integracao CI/CD.'
    },
    {
      question: 'O que o Trivy Operator faz no cluster?',
      options: [
        'Escaneia nodes do cluster',
        'Executa scanning continuo de imagens e gera VulnerabilityReports',
        'Gerencia certificados TLS',
        'Monitora performance dos pods'
      ],
      correct: 1,
      explanation: 'O Trivy Operator roda dentro do cluster, escaneia imagens de pods continuamente, e gera VulnerabilityReport resources com os resultados.',
      reference: 'Conceito relacionado: Trivy Operator — scanning continuo.'
    },
    {
      question: 'O que e SBOM (Software Bill of Materials)?',
      options: [
        'Lista de nodes do cluster',
        'Inventario de todos os componentes e dependencias de uma imagem',
        'Log de builds do CI/CD',
        'Configuracao de seguranca do container'
      ],
      correct: 1,
      explanation: 'SBOM e um inventario detalhado de todos os pacotes, bibliotecas e dependencias em uma imagem. Permite rastrear rapidamente quais imagens sao afetadas por uma nova CVE.',
      reference: 'Conceito relacionado: Supply chain — SBOM.'
    },
    {
      question: 'Qual admission controller bloqueia imagens nao verificadas?',
      options: ['PodSecurity', 'ImagePolicyWebhook', 'AlwaysPullImages', 'NodeRestriction'],
      correct: 1,
      explanation: 'ImagePolicyWebhook consulta um webhook externo para decidir se uma imagem pode ser usada. Pode integrar com scanner para bloquear imagens vulneraveis.',
      reference: 'Conceito relacionado: Admission Controllers — ImagePolicyWebhook.'
    },
    {
      question: 'Por que scanning apenas no CI/CD nao e suficiente?',
      options: [
        'CI/CD nao suporta scanning',
        'Novas CVEs sao descobertas apos o deploy, imagens ja rodando podem se tornar vulneraveis',
        'Scanning no CI/CD e mais lento',
        'CI/CD nao tem acesso as imagens'
      ],
      correct: 1,
      explanation: 'Novas vulnerabilidades sao descobertas continuamente. Uma imagem segura no momento do build pode ter CVEs criticas descobertas dias depois. Por isso, scanning continuo (Trivy Operator) e essencial.',
      reference: 'Conceito relacionado: Scanning continuo vs pontual.'
    },
    {
      question: 'Qual flag do Trivy mostra apenas vulnerabilidades que tem fix disponivel?',
      options: ['--fixed-only', '--ignore-unfixed', '--show-fixed', '--has-fix'],
      correct: 1,
      explanation: '--ignore-unfixed mostra apenas vulnerabilidades que possuem uma versao corrigida disponivel. Util para focar em vulnerabilidades acionaveis.',
      reference: 'Conceito relacionado: Trivy — filtragem de resultados.'
    }
  ],

  flashcards: [
    { front: 'O que e Trivy?', back: 'Scanner de vulnerabilidades open-source da Aqua Security. Escaneia imagens, filesystems, repos, configs e secrets. Possui CLI e Operator para Kubernetes.' },
    { front: 'Quais severidades de vulnerabilidade existem?', back: 'CRITICAL (exploracao remota sem auth), HIGH (exploracao com condicoes), MEDIUM (impacto moderado), LOW (impacto minimo), UNKNOWN (nao classificada).' },
    { front: 'O que e o Trivy Operator?', back: 'Operator que roda dentro do cluster K8s e executa scanning continuo de imagens. Gera VulnerabilityReport resources que podem ser consultados via kubectl.' },
    { front: 'O que e SBOM?', back: 'Software Bill of Materials: inventario de todos os componentes de uma imagem. Gerado com trivy image --format spdx-json ou syft. Permite rastrear impacto de novas CVEs.' },
    { front: 'O que e ImagePolicyWebhook?', back: 'Admission controller que consulta um webhook externo para aprovar/rejeitar imagens. Pode integrar com scanners para bloquear imagens vulneraveis. Flag: --enable-admission-plugins=ImagePolicyWebhook.' },
    { front: 'Por que scanning continuo e necessario?', back: 'Novas CVEs sao descobertas apos o deploy. Imagens seguras no build podem se tornar vulneraveis. O Trivy Operator faz re-scan periodico de imagens em execucao.' },
    { front: 'Como fazer Trivy falhar no CI/CD?', back: 'trivy image --exit-code 1 --severity CRITICAL,HIGH <image>. Retorna exit code 1 (erro) se encontrar vulnerabilidades nos niveis especificados, falhando o pipeline.' }
  ],

  lab: {
    scenario: 'Voce precisa implementar scanning de imagens no cluster para detectar vulnerabilidades antes e durante a execucao.',
    objective: 'Usar Trivy para escanear imagens, identificar vulnerabilidades e configurar politicas de bloqueio.',
    duration: '15-20 minutos',
    steps: [
      {
        title: 'Escanear Imagens com Trivy',
        instruction: 'Use o Trivy para escanear a imagem `nginx:1.21` e identifique vulnerabilidades CRITICAL e HIGH.',
        hints: [
          'Use trivy image com --severity',
          'Compare com nginx:1.25-alpine para ver a diferenca',
          'Use --ignore-unfixed para focar em acionaveis'
        ],
        solution: '```bash\n# Escanear imagem antiga\ntrivy image --severity HIGH,CRITICAL nginx:1.21\n\n# Escanear imagem mais recente\ntrivy image --severity HIGH,CRITICAL nginx:1.25-alpine\n\n# Gerar relatorio JSON\ntrivy image --format json --severity CRITICAL -o scan-results.json nginx:1.21\n```',
        verify: '```bash\n# Verificar que Trivy esta instalado\ntrivy --version\n# Saida esperada: Version: x.x.x\n\n# Contar vulnerabilidades CRITICAL\ntrivy image --severity CRITICAL --format json nginx:1.21 | jq \".Results[].Vulnerabilities | length\"\n# Saida esperada: numero > 0 para nginx:1.21\n```'
      },
      {
        title: 'Integrar com CI/CD',
        instruction: 'Crie um script que falha se a imagem tiver vulnerabilidades CRITICAL, simulando uma etapa de CI/CD.',
        hints: [
          'Use --exit-code 1 para falhar no erro',
          'Combine com --severity CRITICAL',
          'Verifique o exit code do comando'
        ],
        solution: '```bash\n# Simular etapa de CI/CD\necho \"=== Scanning image ===\"\ntrivy image --exit-code 1 --severity CRITICAL nginx:1.21\nif [ $? -ne 0 ]; then\n  echo \"FALHA: Imagem tem vulnerabilidades CRITICAL\"\n  echo \"Build bloqueado!\"\nelse\n  echo \"SUCESSO: Nenhuma vulnerabilidade CRITICAL\"\nfi\n```',
        verify: '```bash\n# Testar exit code\ntrivy image --exit-code 1 --severity CRITICAL nginx:1.21; echo \"Exit: $?\"\n# Saida esperada: Exit: 1 (vulnerabilidades encontradas)\n\ntrivy image --exit-code 1 --severity CRITICAL nginx:1.25-alpine; echo \"Exit: $?\"\n# Saida esperada: Exit: 0 (ou 1, dependendo de CVEs atuais)\n```'
      },
      {
        title: 'Restringir Registries via Admission',
        instruction: 'Crie uma policy (via Gatekeeper ou NetworkPolicy) que permita apenas imagens de registries aprovados.',
        hints: [
          'Use ConstraintTemplate do Gatekeeper ou admission webhook',
          'Defina lista de registries permitidos',
          'Teste com imagem nao aprovada'
        ],
        solution: '```bash\n# Opcao simples: usar Gatekeeper (se instalado)\n# Ou: usar ValidatingAdmissionPolicy (K8s 1.28+)\nkubectl apply -f - <<EOF\napiVersion: admissionregistration.k8s.io/v1\nkind: ValidatingAdmissionPolicy\nmetadata:\n  name: require-approved-registry\nspec:\n  failurePolicy: Fail\n  matchConstraints:\n    resourceRules:\n    - apiGroups: [\"\"]\n      apiVersions: [\"v1\"]\n      operations: [\"CREATE\", \"UPDATE\"]\n      resources: [\"pods\"]\n  validations:\n  - expression: \"object.spec.containers.all(c, c.image.startsWith(\\\"docker.io/library/\\\") || c.image.startsWith(\\\"registry.k8s.io/\\\"))\"\n    message: \"Apenas imagens de registries aprovados sao permitidas\"\nEOF\n```',
        verify: '```bash\n# Verificar policy criada\nkubectl get validatingadmissionpolicy require-approved-registry 2>/dev/null || echo \"Policy nao disponivel (requer K8s 1.28+)\"\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Trivy Scan Muito Lento na Primeira Execucao',
      difficulty: 'easy',
      symptom: 'A primeira execucao do Trivy demora muito (varios minutos) para completar o scan.',
      diagnosis: '```bash\n# Verificar download do banco de vulnerabilidades\ntrivy image --debug nginx:latest 2>&1 | grep -i \"download\\|update\\|db\"\n\n# Verificar cache\nls -la ~/.cache/trivy/\n```',
      solution: 'Na primeira execucao, Trivy baixa o banco de dados de vulnerabilidades (~30MB). Solucoes: 1) Pre-baixar o DB: trivy image --download-db-only. 2) Usar cache: o DB e cached em ~/.cache/trivy/ e reutilizado. 3) Em CI/CD, usar cache do DB entre builds. 4) Usar --skip-db-update para scan offline (se DB ja foi baixado).'
    },
    {
      title: 'ImagePolicyWebhook Bloqueando Pods do Sistema',
      difficulty: 'hard',
      symptom: 'Apos habilitar ImagePolicyWebhook com defaultAllow: false, pods do kube-system nao conseguem ser criados.',
      diagnosis: '```bash\n# Verificar eventos de pods falhando\nkubectl get events -n kube-system --sort-by=.lastTimestamp\n\n# Verificar logs do API Server\nkubectl logs -n kube-system kube-apiserver-$(hostname) | grep -i imagepolicy\n\n# Verificar configuracao do webhook\ncat /etc/kubernetes/admission/image-policy.yaml\n```',
      solution: 'O defaultAllow: false bloqueia TODAS as imagens se o webhook nao estiver disponivel. Solucoes: 1) Setar defaultAllow: true como fallback e garantir que o webhook funcione. 2) Configurar o webhook para permitir imagens de registries do sistema (registry.k8s.io). 3) Usar failurePolicy: Ignore no webhook para nao bloquear em caso de erro. 4) Isentar namespaces do sistema.'
    }
  ]
};
