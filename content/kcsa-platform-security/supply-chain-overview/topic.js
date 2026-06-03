window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['kcsa-platform-security/supply-chain-overview'] = {
  theory: `# Software Supply Chain Security

## Relevância no Exame
> KCSA — Platform Security (16%). Supply chain security é um dos tópicos mais importantes do KCSA moderno, especialmente após ataques como SolarWinds e Log4Shell. O exame foca em ferramentas (Trivy, Cosign), frameworks (SLSA) e como enforçar políticas no cluster.

## O Problema: A Chain of Trust

\`\`\`
Desenvolvedor → Código Fonte
     ↓
Dependências (npm, pip, maven) ← Risco: pacote malicioso
     ↓
Build Pipeline (CI/CD) ← Risco: comprometimento do pipeline
     ↓
Registry de Imagens ← Risco: imagem substituída pós-push
     ↓
Kubernetes Cluster ← Risco: deploy de imagem não verificada
     ↓
Container em Execução ← Risco: vulnerabilidade explorada em runtime
\`\`\`

**Cada fase é um potencial ponto de comprometimento.** Supply chain security protege toda essa cadeia.

## SLSA Framework (Supply-chain Levels for Software Artifacts)

O SLSA (pronuncia-se "salsa") é um framework de segurança criado pelo Google e adotado pelo CNCF para medir e melhorar a segurança da supply chain de software.

### Níveis SLSA

| Nível | Requisitos | Proteção |
|-------|-----------|---------|
| **SLSA 0** | Nenhum | Nenhuma garantia |
| **SLSA 1** | Build scriptado (não manual) | Rastreabilidade básica |
| **SLSA 2** | Build service + provenance | Auditabilidade |
| **SLSA 3** | Build isolado + provenance verificável | Proteção contra insider threat |
| **SLSA 4** | Two-party review + hermetic builds | Máxima confiança |

\`\`\`
Provenance = metadados que descrevem COMO um artefato foi criado:
- Quem fez o build
- Qual código fonte (commit hash)
- Quando foi construído
- Quais dependências foram usadas
\`\`\`

## Image Scanning com Trivy

Trivy é a ferramenta de scanning mais popular para containers no ecossistema CNCF.

\`\`\`bash
# Instalar Trivy
curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh

# Scan básico de uma imagem
trivy image nginx:latest

# Scan com severidade filtrada
trivy image --severity HIGH,CRITICAL nginx:latest

# Scan de um Dockerfile
trivy config Dockerfile

# Scan de manifestos Kubernetes
trivy k8s --report=all cluster

# Scan de um filesystem local
trivy fs .

# Scan com output em JSON para integração CI/CD
trivy image --format json --output results.json nginx:latest

# Scan ignorando vulnerabilidades sem fix disponível
trivy image --ignore-unfixed nginx:latest
\`\`\`

### Categorias de vulnerabilidades que Trivy detecta:

| Categoria | Exemplos |
|-----------|---------|
| OS packages | CVEs em pacotes apt/yum |
| Language libraries | npm, pip, maven, go.sum |
| Misconfigurations | Dockerfile, K8s manifests |
| Secrets | Hardcoded passwords, API keys |
| SBOMs | Software Bill of Materials |

## Image Signing com Cosign e Sigstore

Cosign (parte do projeto Sigstore) permite assinar e verificar assinaturas de imagens de container.

\`\`\`bash
# Instalar Cosign
go install github.com/sigstore/cosign/v2/cmd/cosign@latest

# Gerar par de chaves
cosign generate-key-pair
# Cria: cosign.key (privada) e cosign.pub (pública)

# Assinar uma imagem
cosign sign --key cosign.key myregistry.io/myapp:v1.0
# Adiciona assinatura como artefato OCI no registry

# Verificar assinatura
cosign verify --key cosign.pub myregistry.io/myapp:v1.0

# Assinatura keyless (usando OIDC — sem gerenciar chaves)
# Usa Fulcio (CA) + Rekor (transparency log)
cosign sign myregistry.io/myapp:v1.0
# Autentica via OIDC (GitHub Actions, Google, etc.)
\`\`\`

### Sigstore Ecosystem

\`\`\`
Sigstore Componentes:
├── Cosign — CLI para sign/verify artefatos OCI
├── Fulcio — Certificate Authority baseada em OIDC
│   └── Emite certificados de curta duração (keyless)
├── Rekor — Immutable transparency log
│   └── Registra todas as assinaturas publicamente
└── Gitsign — Assina commits Git com OIDC
\`\`\`

## SBOM (Software Bill of Materials)

SBOM é uma lista formal e estruturada de todos os componentes de um software — análogo a uma lista de ingredientes.

\`\`\`bash
# Gerar SBOM de uma imagem (formato SPDX)
trivy image --format spdx-json --output sbom.json nginx:latest

# Gerar SBOM (formato CycloneDX)
trivy image --format cyclonedx --output sbom.cyclonedx.json nginx:latest

# Syft — outra ferramenta popular para SBOM
syft nginx:latest -o spdx-json > sbom.json

# Verificar SBOM com Grype
grype sbom:./sbom.json
\`\`\`

**Por que SBOM importa?**
- Quando CVE Log4Shell foi descoberta, organizações com SBOM identificaram em horas quais sistemas eram vulneráveis
- Sem SBOM, a busca manual levou dias/semanas
- SBOM é requisito regulatório crescente (EO 14028 nos EUA)

## Admission Controllers para Supply Chain

### Policy Enforcement com OPA/Gatekeeper

\`\`\`yaml
# ConstraintTemplate: apenas imagens de registries aprovados
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: allowedregistries
spec:
  crd:
    spec:
      names:
        kind: AllowedRegistries
  targets:
  - target: admission.k8s.gatekeeper.sh
    rego: |
      package allowedregistries
      violation[{"msg": msg}] {
        container := input.review.object.spec.containers[_]
        not starts_with(container.image, input.parameters.registry)
        msg := sprintf("Image '%v' não está no registry aprovado", [container.image])
      }
---
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: AllowedRegistries
metadata:
  name: only-approved-registry
spec:
  match:
    kinds:
    - apiGroups: [""]
      kinds: ["Pod"]
  parameters:
    registry: "myregistry.io/"
\`\`\`

### Policy Enforcement com Kyverno

\`\`\`yaml
# ClusterPolicy: verificar assinatura Cosign
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-image-signature
spec:
  validationFailureAction: Enforce
  rules:
  - name: verify-cosign-signature
    match:
      resources:
        kinds: ["Pod"]
    verifyImages:
    - imageReferences: ["myregistry.io/*"]
      attestors:
      - count: 1
        entries:
        - keys:
            publicKeys: |-
              -----BEGIN PUBLIC KEY-----
              MFkwEwYHKoZIzj0CAQY...
              -----END PUBLIC KEY-----
\`\`\`

### AlwaysPullImages Admission Controller

\`\`\`bash
# Habilitar no kube-apiserver
--enable-admission-plugins=...,AlwaysPullImages,...
\`\`\`

**Por que AlwaysPullImages importa para supply chain?**
- Sem ele: imagem cacheada no nó pode ser usada por outro pod sem autenticação
- Com ele: sempre verifica credenciais do registry + garante última versão da tag

## Distroless e Minimal Images

\`\`\`dockerfile
# Multi-stage build com imagem distroless
FROM golang:1.21 AS builder
WORKDIR /app
COPY . .
RUN go build -o myapp .

# Imagem final mínima (sem shell, sem package manager)
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=builder /app/myapp /myapp
USER nonroot
ENTRYPOINT ["/myapp"]
\`\`\`

**Benefícios de distroless:**
- Superfície de ataque mínima (sem bash, curl, apt, etc.)
- Menor número de CVEs por ter menos pacotes
- Menor tamanho de imagem
- Trivy encontra menos vulnerabilidades para corrigir

## Integração CI/CD: Shift Left Security

\`\`\`yaml
# Exemplo: GitHub Actions com Trivy + Cosign
name: Build and Secure
on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4

    # Scan de vulnerabilidades ANTES do build
    - name: Scan Dockerfile
      uses: aquasecurity/trivy-action@master
      with:
        scan-type: 'config'
        scan-ref: '.'
        exit-code: '1'  # Falha o pipeline se encontrar CRITICAL
        severity: 'CRITICAL'

    # Build da imagem
    - name: Build image
      run: docker build -t myapp:\${{ github.sha }} .

    # Scan da imagem construída
    - name: Scan image
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: myapp:\${{ github.sha }}
        severity: 'HIGH,CRITICAL'
        exit-code: '1'

    # Push para registry
    - name: Push image
      run: |
        docker push myregistry.io/myapp:\${{ github.sha }}

    # Assinar imagem com Cosign keyless
    - name: Sign image
      uses: sigstore/cosign-installer@v3
      - run: cosign sign myregistry.io/myapp:\${{ github.sha }}
\`\`\`

## Erros Comuns

1. **Usar \`:latest\` sem digest** — tag mutável, imagem pode mudar sem aviso
2. **Não assinar imagens** — sem verificação de integridade pós-push
3. **Pull de registries públicos não verificados** — Docker Hub tem imagens maliciosas
4. **Não integrar scanning no CI/CD** — vulnerabilidades detectadas em produção
5. **Ignorar dependências indiretas** — transitivas também têm CVEs

## Killer.sh Style Challenge

> **Cenário**: Configure o cluster para aceitar apenas imagens do registry \`secure-registry.example.com\` usando uma política Kyverno. Além disso, configure o Trivy para fazer scan e falhar o deploy se encontrar vulnerabilidades CRITICAL. Garanta que todas as imagens sejam assinadas com a chave pública \`cosign.pub\`.
`,
  quiz: [
    {
      question: 'O que é SLSA e qual seu propósito no contexto de supply chain security?',
      options: [
        'Um scanner de vulnerabilidades para containers Docker',
        'Um framework de níveis (0-4) para medir e melhorar a segurança da cadeia de fornecimento de software',
        'Uma ferramenta de assinatura de imagens similar ao Cosign',
        'Um admission controller para validar políticas de registry'
      ],
      correct: 1,
      explanation: 'SLSA (Supply-chain Levels for Software Artifacts) é um framework de segurança criado pelo Google. Define 4 níveis de maturidade (SLSA 1-4) para builds de software, com requisitos crescentes de rastreabilidade, isolamento e verificabilidade. O objetivo é garantir a integridade do software desde o código fonte até o deploy.',
      reference: 'Veja a seção "SLSA Framework" na teoria para a tabela completa de níveis e seus requisitos.'
    },
    {
      question: 'Qual é a função do Rekor no ecossistema Sigstore?',
      options: [
        'Geração de par de chaves para assinatura de imagens',
        'Certificate Authority que emite certificados para assinatura keyless',
        'Transparency log imutável que registra todas as assinaturas publicamente',
        'Scanner de vulnerabilidades integrado ao processo de signing'
      ],
      correct: 2,
      explanation: 'Rekor é o transparency log do Sigstore — um registro imutável e auditável de todas as assinaturas feitas via Sigstore. Qualquer assinatura pode ser verificada independentemente consultando o Rekor. Fulcio é a CA, Cosign é o CLI. Juntos formam o ecossistema Sigstore para assinatura keyless.',
      reference: 'Veja "Sigstore Ecosystem" na teoria — entender os 3 componentes (Cosign, Fulcio, Rekor) é importante para o KCSA.'
    },
    {
      question: 'Por que usar `image: nginx:latest` em vez de `image: nginx:1.25@sha256:abc123...` é um risco de supply chain?',
      options: [
        'Porque latest é mais lento para fazer pull',
        'Porque tags são mutáveis — a mesma tag pode apontar para imagens diferentes, permitindo substituição',
        'Porque latest não é compatível com Kubernetes 1.28+',
        'Porque latest não suporta multi-arch (AMD64/ARM64)'
      ],
      correct: 1,
      explanation: 'Tags Docker são mutáveis — um registry pode atualizar qual imagem uma tag aponta. Se um atacante comprometer o registry, pode substituir `nginx:latest` por uma imagem maliciosa. Usar o digest SHA256 garante imutabilidade: `nginx:1.25@sha256:abc123` sempre se refere à mesma imagem específica, independente do que aconteça com a tag.',
      reference: 'Veja "Erros Comuns" na teoria — o primeiro item trata exatamente deste problema.'
    },
    {
      question: 'Qual é a principal vantagem de uma imagem "distroless" para supply chain security?',
      options: [
        'Inicializa mais rápido que imagens convencionais',
        'Tem menor superfície de ataque — sem shell, package manager ou utilitários desnecessários',
        'Suporta mais arquiteturas (ARM, RISC-V)',
        'Passa automaticamente em todos os scans Trivy'
      ],
      correct: 1,
      explanation: 'Imagens distroless contêm apenas o runtime necessário (ex: JRE para Java, libc para Go) sem shell (bash/sh), package managers (apt/yum), ou utilitários comuns (curl, wget, ls). Isso reduz drasticamente o número de pacotes e CVEs potenciais, e também dificulta o movimento lateral se um container for comprometido.',
      reference: 'Veja "Distroless e Minimal Images" na teoria com o exemplo de Dockerfile multi-stage.'
    },
    {
      question: 'O que é um SBOM e por que é importante para resposta a incidentes como o Log4Shell?',
      options: [
        'Security Baseline Operations Manual — procedimentos de segurança',
        'Software Bill of Materials — lista de todos os componentes de um software',
        'Secure Build Operations Mode — configuração de pipeline seguro',
        'System Binary Object Manifest — manifesto de binários do sistema'
      ],
      correct: 1,
      explanation: 'SBOM (Software Bill of Materials) é uma lista formal de todos os componentes, dependências e versões de um software — análogo a uma lista de ingredientes. Durante o Log4Shell, organizações com SBOMs identificaram sistemas vulneráveis em horas; sem SBOM, a busca levou dias. Trivy pode gerar SBOMs em formatos SPDX e CycloneDX.',
      reference: 'Veja "SBOM" na teoria — inclui comandos para gerar SBOM com Trivy e Syft.'
    },
    {
      question: 'Qual é a função do admission controller `AlwaysPullImages` para supply chain security?',
      options: [
        'Força todas as imagens a usar o repositório oficial Docker Hub',
        'Garante que a imagem é sempre baixada do registry, verificando credenciais e evitando uso de cache comprometido',
        'Verifica assinaturas Cosign antes de permitir o deploy',
        'Bloqueia imagens com tag :latest para forçar uso de versões específicas'
      ],
      correct: 1,
      explanation: 'AlwaysPullImages força o kubelet a sempre fazer pull da imagem do registry, mesmo se ela já estiver cacheada no nó. Isso previne: (1) um pod não autorizado usar imagem cacheada de outro pod, (2) uso de imagem desatualizada se a tag foi atualizada. É importante quando múltiplos tenants compartilham nós.',
      reference: 'Veja "Admission Controllers para Supply Chain" na teoria — AlwaysPullImages é frequentemente combinado com verificação de assinatura.'
    },
    {
      question: 'Qual comando Trivy verifica vulnerabilidades em manifestos Kubernetes diretamente?',
      options: [
        'trivy image --kubernetes=true',
        'trivy k8s --report=all cluster',
        'trivy scan --type=k8s cluster',
        'trivy manifest --namespace=all'
      ],
      correct: 1,
      explanation: '`trivy k8s --report=all cluster` faz scan de todo o cluster Kubernetes, verificando: imagens em execução, manifestos (misconfigurations), secrets expostos, e recursos com configurações inseguras. Também pode focar em um namespace específico: `trivy k8s --namespace=production cluster`.',
      reference: 'Veja "Image Scanning com Trivy" — a seção lista todos os modos de scan disponíveis (image, config, k8s, fs).'
    },
    {
      question: 'O que significa assinatura "keyless" com Cosign e qual é sua vantagem sobre chaves estáticas?',
      options: [
        'Assinar sem nenhuma verificação criptográfica — apenas por conveniência',
        'Usar identidade OIDC para obter certificados efêmeros da Fulcio, registrados no Rekor — sem gerenciar chaves privadas',
        'Usar apenas o digest SHA256 da imagem sem assinatura adicional',
        'Delegar a assinatura para o registry de imagens automaticamente'
      ],
      correct: 1,
      explanation: 'Na assinatura keyless, o usuário/pipeline autentica via OIDC (ex: GitHub Actions identity), a Fulcio emite um certificado de curta duração, e a assinatura é registrada no Rekor. Vantagens: sem gestão de chaves privadas (risco de vazamento), auditabilidade pública via Rekor, e revogação via OIDC identity. Desvantagem: requer conectividade com Sigstore público.',
      reference: 'Veja "Image Signing com Cosign e Sigstore" — o exemplo de `cosign sign` sem `--key` demonstra o modo keyless.'
    }
  ],
  flashcards: [
    {
      front: 'O que é SLSA e quais são seus 4 níveis?',
      back: 'Supply-chain Levels for Software Artifacts — framework para medir segurança da supply chain. Nível 1: build scriptado. Nível 2: build service com provenance. Nível 3: build isolado com provenance verificável. Nível 4: two-party review + hermetic builds. Provenance = metadados sobre como o artefato foi criado.'
    },
    {
      front: 'Quais são os 3 componentes do Sigstore e suas funções?',
      back: 'Cosign: CLI para sign/verify artefatos OCI. Fulcio: Certificate Authority baseada em OIDC que emite certs efêmeros para keyless signing. Rekor: transparency log imutável que registra todas as assinaturas publicamente para auditabilidade.'
    },
    {
      front: 'Por que usar digest SHA256 ao invés de tag nas imagens?',
      back: 'Tags são mutáveis — `nginx:latest` pode apontar para imagens diferentes ao longo do tempo. Digest é imutável: `nginx:1.25@sha256:abc123` sempre se refere à mesma imagem específica. Proteção contra image substitution attacks no registry.'
    },
    {
      front: 'O que é SBOM e por que é crítico para resposta a incidentes?',
      back: 'Software Bill of Materials: lista formal de todos os componentes, dependências e versões de um software. Durante Log4Shell, orgs com SBOM identificaram sistemas vulneráveis em horas. Sem SBOM: dias de busca manual. Formatos: SPDX, CycloneDX. Geração: trivy image --format spdx-json, syft.'
    },
    {
      front: 'Qual é a vantagem de imagens distroless?',
      back: 'Contém apenas o runtime necessário — sem shell (bash/sh), sem package manager (apt/yum), sem utilitários (curl, wget). Resultado: menor número de CVEs, menor superfície de ataque, dificulta movimento lateral após comprometimento. Usa multi-stage Dockerfile para separar build de runtime.'
    },
    {
      front: 'Como Kyverno verifica assinaturas Cosign em Pods?',
      back: 'ClusterPolicy com `verifyImages` e `attestors.entries.keys.publicKeys` contendo a chave pública. Com `validationFailureAction: Enforce`, pods com imagens não assinadas são rejeitados na admission. Suporta tanto chaves estáticas quanto keyless (via certificado Sigstore).'
    },
    {
      front: 'O que é "shift left security" e por que importa?',
      back: 'Mover verificações de segurança para as fases mais cedo do SDLC (desenvolvimento/build), ao invés de detectar em produção. Vantagens: custo menor de correção, feedback imediato, vulnerabilidades nunca chegam ao deploy. Ferramentas: Trivy no CI, pré-commit hooks, Dockerfile linting.'
    },
    {
      front: 'O que o AlwaysPullImages admission controller faz?',
      back: 'Força o kubelet a sempre fazer pull da imagem do registry, mesmo se já estiver em cache. Previne: (1) pod não autorizado usar cache de outro tenant, (2) uso de imagem desatualizada quando a tag foi atualizada. Importante em clusters multi-tenant com nós compartilhados.'
    }
  ],
  lab: {
    scenario: 'O time de plataforma quer implementar supply chain security end-to-end: scanner de imagens para detectar vulnerabilidades, e política de admission para permitir apenas imagens de registries aprovados.',
    objective: 'Configurar scanning de imagens com Trivy e criar políticas de admission para enforçar segurança da supply chain.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Scanning de imagens com Trivy',
        instruction: `Instale e use Trivy para fazer scan de imagens e identificar vulnerabilidades.

\`\`\`bash
# Instalar Trivy (Linux)
curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin

# Verificar instalação
trivy --version

# Scan de uma imagem com diferentes severidades
trivy image nginx:1.21 --severity HIGH,CRITICAL

# Scan filtrando apenas vulnerabilidades com fix disponível
trivy image nginx:1.21 --severity HIGH,CRITICAL --ignore-unfixed

# Comparar imagem vulnerável vs mais nova
trivy image nginx:1.21 --severity CRITICAL --format table
trivy image nginx:latest --severity CRITICAL --format table

# Gerar SBOM da imagem
trivy image nginx:latest --format spdx-json --output nginx-sbom.json
cat nginx-sbom.json | python3 -m json.tool | head -50
\`\`\``,
        hints: [
          'Trivy pode demorar no primeiro scan por baixar o banco de CVEs',
          'Use --severity CRITICAL primeiro para focar nos mais graves',
          'nginx:1.21 foi escolhida por ter CVEs conhecidas para o exercício'
        ],
        solution: `\`\`\`bash
# Instalar Trivy
curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin

# Scan básico
trivy image nginx:1.21 --severity HIGH,CRITICAL

# O output mostrará uma tabela com:
# Library, Vulnerability, Severity, Installed Version, Fixed Version, Title

# Comparar com versão mais nova
trivy image nginx:latest --severity CRITICAL
# Versão mais nova deve ter menos CVEs críticas
\`\`\``,
        verify: `\`\`\`bash
# Verificar instalação
trivy --version
# Saída esperada: Version: X.Y.Z

# Verificar que scan executa sem erro
trivy image --severity CRITICAL alpine:latest --no-progress
# Saída esperada: tabela de resultados ou "No vulnerabilities found"

# Verificar SBOM gerado
ls -la nginx-sbom.json
# Deve existir com alguns KB de tamanho
\`\`\``
      },
      {
        title: 'Assinar e verificar imagens com Cosign',
        instruction: `Simule o processo de sign e verify de imagens de container.

\`\`\`bash
# Instalar Cosign
# Opção 1: via go install
# go install github.com/sigstore/cosign/v2/cmd/cosign@latest

# Opção 2: download binário
curl -O -L https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-amd64
chmod +x cosign-linux-amd64
sudo mv cosign-linux-amd64 /usr/local/bin/cosign

# Verificar instalação
cosign version

# Gerar par de chaves (para ambientes sem OIDC)
cosign generate-key-pair
# Cria: cosign.key e cosign.pub

# Verificar uma imagem já assinada pela comunidade
# (imagens CNCF oficiais geralmente são assinadas)
cosign verify --certificate-identity-regexp=".*" \\
  --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \\
  cgr.dev/chainguard/static:latest 2>/dev/null || echo "Verificando método alternativo"

# Verificar com chave pública específica
# cosign verify --key cosign.pub myregistry.io/myapp:v1.0
\`\`\`

Como não temos um registry próprio, explore a verificação:
\`\`\`bash
# Ver a estrutura de uma assinatura Cosign
cosign tree cgr.dev/chainguard/static:latest 2>/dev/null || \\
  echo "Árvore de assinatura: attestations + signatures em OCI registry"
\`\`\``,
        hints: [
          'Cosign armazena assinaturas como artefatos OCI no mesmo registry da imagem',
          'Keyless signing usa OIDC (GitHub Actions, Google, etc.) sem gerenciar chaves',
          'Em produção, integre cosign sign no seu pipeline CI/CD após o docker push'
        ],
        solution: `\`\`\`bash
# Gerar chaves locais
cosign generate-key-pair

ls -la cosign.*
# cosign.key (privada) e cosign.pub (pública)

# Verificar conteúdo da chave pública
cat cosign.pub
# -----BEGIN PUBLIC KEY-----
# MFkwEwYHKoZIzj0CAQY...

# Em ambiente com registry próprio:
# cosign sign --key cosign.key registry.io/myapp:v1.0
# cosign verify --key cosign.pub registry.io/myapp:v1.0
\`\`\``,
        verify: `\`\`\`bash
# Verificar que cosign está instalado
cosign version
# Saída esperada: GitVersion: vX.Y.Z

# Verificar geração de chaves
ls cosign.key cosign.pub
# Ambos devem existir

# Verificar formato das chaves
head -1 cosign.pub
# Saída esperada: -----BEGIN PUBLIC KEY-----
\`\`\``
      },
      {
        title: 'Política de registry aprovado com NetworkPolicy',
        instruction: `Como Kyverno pode não estar instalado no cluster de lab, implemente uma solução alternativa: use PSA e ResourceQuota para demonstrar enforcement de políticas, e documente a ClusterPolicy Kyverno que seria usada.

\`\`\`bash
# Criar namespace com PSA enforcement para simular policy
kubectl create namespace secure-workloads
kubectl label namespace secure-workloads \\
  pod-security.kubernetes.io/enforce=restricted \\
  pod-security.kubernetes.io/enforce-version=latest

# Tentar criar pod com imagem de registry não aprovado (simulação)
kubectl run test-allowed \\
  --image=registry.k8s.io/pause:3.9 \\
  --namespace=secure-workloads \\
  -- sh -c "sleep 300"
# Pode falhar por PSS restricted (sem runAsNonRoot) — isso é esperado

# Criar pod compliant com PSS restricted
kubectl apply -n secure-workloads -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: compliant-pod
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    seccompProfile:
      type: RuntimeDefault
  containers:
  - name: app
    image: registry.k8s.io/pause:3.9
    securityContext:
      allowPrivilegeEscalation: false
      capabilities:
        drop: ["ALL"]
EOF
\`\`\`

Documente a ClusterPolicy Kyverno que seria usada:
\`\`\`yaml
# kyverno-registry-policy.yaml (para referência)
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: restrict-registry
spec:
  validationFailureAction: Enforce
  rules:
  - name: allowed-registries
    match:
      resources:
        kinds: ["Pod"]
    validate:
      message: "Registry não aprovado. Use: registry.k8s.io ou myregistry.io"
      pattern:
        spec:
          containers:
          - image: "registry.k8s.io/* | myregistry.io/*"
\`\`\``,
        hints: [
          'PSA enforcement (PSS Restricted) por si só já bloqueia muitas configurações inseguras',
          'A ClusterPolicy Kyverno seria a solução ideal para restringir registries específicos',
          'Em um cluster real com Kyverno: kubectl apply -f kyverno-registry-policy.yaml'
        ],
        solution: `\`\`\`bash
kubectl create namespace secure-workloads

kubectl label namespace secure-workloads \\
  pod-security.kubernetes.io/enforce=restricted \\
  pod-security.kubernetes.io/enforce-version=latest

kubectl apply -n secure-workloads -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: compliant-pod
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    seccompProfile:
      type: RuntimeDefault
  containers:
  - name: app
    image: registry.k8s.io/pause:3.9
    securityContext:
      allowPrivilegeEscalation: false
      capabilities:
        drop: ["ALL"]
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verificar namespace criado com labels PSA
kubectl get namespace secure-workloads --show-labels
# Deve mostrar: pod-security.kubernetes.io/enforce=restricted

# Verificar pod compliant criado
kubectl get pod compliant-pod -n secure-workloads
# NAME            READY   STATUS    RESTARTS
# compliant-pod   1/1     Running   0

# Verificar que PSA enforce está ativo
kubectl describe namespace secure-workloads | grep -A5 "Labels"
# pod-security.kubernetes.io/enforce=restricted
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Pipeline CI/CD falha com vulnerabilidades CRITICAL não corrigidas',
      difficulty: 'medium',
      symptom: 'O pipeline CI/CD está falhando na etapa de scan Trivy com `exit code 1`. A mensagem mostra CVEs CRITICAL em pacotes da imagem base `ubuntu:20.04`. Porém, algumas CVEs não têm fix disponível e o time precisa continuar o deploy urgente.',
      diagnosis: `\`\`\`bash
# Reproduzir o scan localmente
trivy image ubuntu:20.04 --severity CRITICAL --exit-code 1

# Ver detalhes das CVEs críticas
trivy image ubuntu:20.04 --severity CRITICAL --format table

# Verificar quais têm fix disponível
trivy image ubuntu:20.04 --severity CRITICAL --format json | \\
  jq '.Results[].Vulnerabilities[] | select(.Severity == "CRITICAL") |
    {id: .VulnerabilityID, fixedIn: .FixedVersion, pkg: .PkgName}'

# Verificar se ubuntu:22.04 tem menos CVEs críticas
trivy image ubuntu:22.04 --severity CRITICAL --exit-code 1
\`\`\``,
      solution: `\`\`\`bash
# Opção 1: Atualizar imagem base para versão mais recente
# Mudar Dockerfile de ubuntu:20.04 para ubuntu:22.04 ou ubuntu:latest

# Opção 2: Para CVEs sem fix disponível, usar .trivyignore
cat > .trivyignore << 'EOF'
# CVEs sem fix disponível — revisado em 2024-01-15 por security-team
CVE-2022-XXXXX
CVE-2023-YYYYY
EOF

# Executar scan ignorando as CVEs listadas
trivy image --ignorefile .trivyignore --severity CRITICAL --exit-code 1 ubuntu:20.04

# Opção 3: Usar flag --ignore-unfixed para pular CVEs sem fix
trivy image ubuntu:20.04 --severity CRITICAL --ignore-unfixed --exit-code 1

# Opção 4 (recomendada): Usar distroless ou alpine (menos pacotes, menos CVEs)
# Mudar base image para: gcr.io/distroless/base-debian12 ou alpine:3.19
trivy image alpine:3.19 --severity CRITICAL --exit-code 1
# Muito menos CVEs que ubuntu

# IMPORTANTE: documentar no .trivyignore o motivo e data de revisão
# e revisar periodicamente se o fix ficou disponível
\`\`\``
    },
    {
      title: 'Imagem assinada com Cosign falha verificação no cluster',
      difficulty: 'hard',
      symptom: 'Após configurar Kyverno para verificar assinaturas Cosign, pods que deveriam funcionar estão sendo rejeitados com `ImageVerificationFailed: signature verification failed`. O pipeline assinou a imagem corretamente, mas o cluster não aceita.',
      diagnosis: `\`\`\`bash
# Verificar o erro detalhado no evento do pod
kubectl describe pod <pod-name> -n <namespace>
# Events:
#   Warning  Failed  ... ImageVerificationFailed: ...

# Verificar a ClusterPolicy Kyverno
kubectl get clusterpolicy verify-image-signature -o yaml

# Verificar se a assinatura existe no registry
cosign tree myregistry.io/myapp:v1.0
# Deve mostrar: Signatures e/ou Attestations

# Tentar verificar manualmente com a chave usada no Kyverno
cosign verify --key kyverno-cosign.pub myregistry.io/myapp:v1.0

# Verificar logs do Kyverno para entender o erro
kubectl logs -n kyverno -l app=kyverno --tail=50 | grep -i "verification\\|signature\\|error"

# Verificar se a chave pública na ClusterPolicy está correta
kubectl get clusterpolicy verify-image-signature -o jsonpath='{.spec.rules[0].verifyImages[0].attestors[0].entries[0].keys.publicKeys}'
\`\`\``,
      solution: `\`\`\`bash
# Problema mais comum: chave pública na ClusterPolicy não corresponde à usada para assinar

# 1. Verificar a chave pública usada para assinar no CI/CD
# Geralmente armazenada como Secret no CI/CD (GitHub Secrets, etc.)

# 2. Atualizar a ClusterPolicy com a chave correta
kubectl edit clusterpolicy verify-image-signature
# Atualizar o campo publicKeys com a chave correta (cosign.pub)

# 3. Ou recriar a ClusterPolicy com a chave correta:
COSIGN_PUB=$(cat cosign.pub)
kubectl patch clusterpolicy verify-image-signature --type='json' -p="[
  {\"op\": \"replace\",
   \"path\": \"/spec/rules/0/verifyImages/0/attestors/0/entries/0/keys/publicKeys\",
   \"value\": \"$COSIGN_PUB\"}
]"

# 4. Verificar que funciona:
cosign verify --key cosign.pub myregistry.io/myapp:v1.0
# Should return: Verification for myregistry.io/myapp:v1.0 -- The following checks were performed...

# 5. Problema alternativo: imagem assinada com digest mas tag diferente
# Garantir que o push e sign usam o mesmo identificador:
docker push myregistry.io/myapp:v1.0
cosign sign myregistry.io/myapp:v1.0  # Deve usar o mesmo ref
\`\`\``
    }
  ]
};
