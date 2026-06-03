window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['cicd/github-actions'] = {
  theory: `
# GitHub Actions para DevOps e Kubernetes

## Relevancia
GitHub Actions e a plataforma de CI/CD mais adotada no mercado, especialmente para times que ja usam GitHub. Para DevOps/SRE, entender workflows, matrix builds, environments com aprovacoes, reusable workflows, e integracao com Kubernetes e essencial para pipelines de producao.

## Conceitos Fundamentais

### Anatomia de um Workflow

\`\`\`yaml
# .github/workflows/ci.yml
name: CI Pipeline          # nome do workflow

on:                        # triggers
  push:
    branches: [main, dev]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1'   # toda segunda 6h UTC
  workflow_dispatch:        # execucao manual

env:                       # variaveis globais
  APP_NAME: myapp
  REGISTRY: ghcr.io

jobs:                      # jobs executam em paralelo por padrao
  test:                    # job ID
    runs-on: ubuntu-latest # runner
    timeout-minutes: 15    # timeout do job

    steps:                 # passos sequenciais dentro do job
      - name: Checkout
        uses: actions/checkout@v4

      - name: Run tests
        run: pytest tests/
\`\`\`

### Triggers Essenciais

\`\`\`yaml
on:
  push:
    branches: [main]
    tags: ["v*"]           # qualquer tag v1.0.0, v2.0, etc.
    paths:                 # so trigga se esses paths mudaram
      - "src/**"
      - "Dockerfile"
    paths-ignore:
      - "docs/**"
      - "*.md"

  pull_request:
    types: [opened, synchronize, reopened]

  workflow_call:           # permite ser chamado por outros workflows
    inputs:
      environment:
        type: string
        required: true

  workflow_dispatch:        # botao manual no GitHub UI
    inputs:
      version:
        description: "Version to deploy"
        required: true
        default: "latest"
      environment:
        type: choice
        options: [dev, staging, prod]
\`\`\`

## Jobs: Dependencias e Estrategia

### Jobs em sequencia com needs

\`\`\`yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pytest

  build:
    needs: test            # executa apenas se test passou
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t myapp:latest .

  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - run: kubectl apply -f k8s/staging/

  deploy-prod:
    needs: [build, deploy-staging]  # depende de multiplos jobs
    runs-on: ubuntu-latest
    environment: production         # gate de aprovacao manual
    steps:
      - run: kubectl apply -f k8s/prod/
\`\`\`

### Matrix strategy — testar em multiplas versoes

\`\`\`yaml
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ["3.10", "3.11", "3.12"]
        os: [ubuntu-latest, windows-latest]
      fail-fast: false     # continua mesmo se uma falhar
      max-parallel: 4      # max combinacoes em paralelo

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v4
        with:
          python-version: \${{ matrix.python-version }}
      - run: pytest

  # Matrix com includes (combinacoes especificas)
  docker-build:
    strategy:
      matrix:
        include:
          - platform: linux/amd64
            runner: ubuntu-latest
          - platform: linux/arm64
            runner: ubuntu-24.04-arm
\`\`\`

## Secrets e Environments

### Hierarquia de segredos

\`\`\`
Organization secrets  → compartilhados com todos os repos da org
Repository secrets    → especificos do repo
Environment secrets   → especificos de um environment (prod, staging)
\`\`\`

\`\`\`yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production    # ativa secrets e regras do environment

    steps:
      - name: Login ECR
        run: |
          aws ecr get-login-password \
            --region \${{ secrets.AWS_REGION }} | \
          docker login \
            --username AWS \
            --password-stdin \
            \${{ secrets.ECR_REGISTRY }}
        env:
          AWS_ACCESS_KEY_ID: \${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
\`\`\`

### Environments com aprovacao manual

\`\`\`yaml
# Configuracao no GitHub: Settings > Environments > production
# - Required reviewers: time-platform
# - Wait timer: 5 minutes
# - Deployment branches: main only

jobs:
  deploy-prod:
    needs: deploy-staging
    environment:
      name: production
      url: https://app.mycompany.com   # link exibido no GitHub UI
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: |
          echo "Deploying version \${{ github.sha }} to production"
          kubectl set image deployment/myapp \
            myapp=\${{ env.REGISTRY }}/myapp:sha-\${{ github.sha }}
\`\`\`

## Actions Essenciais para DevOps

\`\`\`yaml
steps:
  # Checkout com submodulos e historico completo
  - uses: actions/checkout@v4
    with:
      fetch-depth: 0         # historico completo (para git describe)
      submodules: recursive

  # Cache de dependencias
  - uses: actions/cache@v4
    with:
      path: ~/.cache/pip
      key: \${{ runner.os }}-pip-\${{ hashFiles('requirements.txt') }}
      restore-keys: |
        \${{ runner.os }}-pip-

  # Upload de artifacts (resultados de testes, binarios)
  - uses: actions/upload-artifact@v4
    with:
      name: test-results
      path: reports/
      retention-days: 7

  # Download em outro job
  - uses: actions/download-artifact@v4
    with:
      name: test-results

  # Setup kubectl
  - uses: azure/setup-kubectl@v3
    with:
      version: "v1.29.0"

  # Setup Helm
  - uses: azure/setup-helm@v3
    with:
      version: "3.14.0"

  # Configure kubeconfig (AWS EKS)
  - name: Configure kubeconfig
    run: |
      aws eks update-kubeconfig \
        --name \${{ vars.CLUSTER_NAME }} \
        --region \${{ vars.AWS_REGION }}
\`\`\`

## Pipeline Completo: Build, Test, Deploy

\`\`\`yaml
# .github/workflows/main.yml
name: Build, Test & Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE: ghcr.io/\${{ github.repository }}

jobs:
  # ============ TEST ============
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: testdb
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v4
        with:
          python-version: "3.11"
          cache: pip

      - run: pip install -r requirements.txt -r requirements-dev.txt

      - name: Run tests with coverage
        run: pytest --cov=src --cov-report=xml
        env:
          DATABASE_URL: postgres://postgres:test@localhost/testdb

      - uses: codecov/codecov-action@v3
        with:
          file: coverage.xml

  # ============ BUILD ============
  build:
    needs: test
    runs-on: ubuntu-latest
    outputs:
      image-digest: \${{ steps.build.outputs.digest }}
      image-tag: \${{ steps.meta.outputs.version }}

    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}

      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: \${{ env.IMAGE }}
          tags: |
            type=semver,pattern={{version}}
            type=sha,prefix=sha-
            type=edge,branch=main

      - id: build
        uses: docker/build-push-action@v5
        with:
          push: \${{ github.event_name != 'pull_request' }}
          tags: \${{ steps.meta.outputs.tags }}
          labels: \${{ steps.meta.outputs.labels }}
          platforms: linux/amd64,linux/arm64
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # ============ SECURITY SCAN ============
  scan:
    needs: build
    if: github.event_name != 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: aquasecurity/trivy-action@master
        with:
          image-ref: \${{ env.IMAGE }}:sha-\${{ github.sha }}
          severity: HIGH,CRITICAL
          exit-code: 1

  # ============ DEPLOY STAGING ============
  deploy-staging:
    needs: [build, scan]
    runs-on: ubuntu-latest
    environment:
      name: staging
      url: https://staging.myapp.com

    steps:
      - uses: actions/checkout@v4

      - uses: azure/setup-kubectl@v3

      - name: Deploy to staging
        run: |
          kubectl set image deployment/myapp \
            myapp=\${{ env.IMAGE }}@\${{ needs.build.outputs.image-digest }} \
            -n staging
          kubectl rollout status deployment/myapp -n staging --timeout=5m

  # ============ DEPLOY PROD (com aprovacao) ============
  deploy-prod:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://myapp.com

    steps:
      - uses: actions/checkout@v4

      - uses: azure/setup-kubectl@v3

      - name: Deploy to production
        run: |
          kubectl set image deployment/myapp \
            myapp=\${{ env.IMAGE }}@\${{ needs.build.outputs.image-digest }} \
            -n production
          kubectl rollout status deployment/myapp -n production --timeout=10m
\`\`\`

## Reusable Workflows

\`\`\`yaml
# .github/workflows/reusable-deploy.yml
name: Reusable Deploy

on:
  workflow_call:
    inputs:
      environment:
        type: string
        required: true
      image-tag:
        type: string
        required: true
      namespace:
        type: string
        required: true
    secrets:
      KUBECONFIG:
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: \${{ inputs.environment }}
    steps:
      - name: Deploy
        run: |
          echo "\${{ secrets.KUBECONFIG }}" > kubeconfig.yaml
          kubectl --kubeconfig kubeconfig.yaml \
            set image deployment/myapp \
            myapp=\${{ inputs.image-tag }} \
            -n \${{ inputs.namespace }}

# Usar o reusable workflow:
# jobs:
#   deploy-staging:
#     uses: ./.github/workflows/reusable-deploy.yml
#     with:
#       environment: staging
#       image-tag: sha-abc1234
#       namespace: staging
#     secrets:
#       KUBECONFIG: \${{ secrets.STAGING_KUBECONFIG }}
\`\`\`

## Erros Comuns

1. **Secrets em logs** — nunca usar \`echo \${{ secrets.PASSWORD }}\` — usar \`env:\` para passar segredos
2. **Sem timeout** — job pode rodar indefinidamente, usar \`timeout-minutes\`
3. **Cache key muito generica** — \`key: \${{ runner.os }}-cache\` = cache nunca invalida
4. **Nao usar outputs entre jobs** — copiar imagem tag repetidamente em vez de usar \`outputs\`
5. **Workflow muito grande** — um arquivo com 500 linhas = usar reusable workflows

## Killer.sh Style Challenge

> **Cenario:** Voce precisa criar um pipeline que: (1) roda testes com PostgreSQL como service container, (2) builda imagem multi-arch apenas em push para main, (3) faz deploy no staging automaticamente, (4) requer aprovacao manual para producao com link da aplicacao no GitHub UI. Escreva o workflow completo com boas praticas.
`,
  quiz: [
    {
      question: 'Qual a diferenca entre `secrets` e `vars` (variables) no GitHub Actions?',
      options: [
        'Secrets e vars sao identicos, apenas com nomes diferentes',
        'Secrets sao valores criptografados que nunca aparecem em logs (mascarados automaticamente); vars sao valores em texto claro visiveis nos logs — secrets para senhas/tokens, vars para configuracoes como region, cluster name',
        'Vars so podem ser usadas em workflows, secrets em qualquer lugar',
        'Secrets so funcionam com environments, vars funcionam globalmente'
      ],
      correct: 1,
      explanation: 'Secrets sao armazenados criptografados e mascarados nos logs do Actions — se um secret vazar acidentalmente em um echo, o GitHub substitui por ***. Variables (vars) sao texto claro, visiveis nos logs. Use secrets para: AWS_SECRET_KEY, tokens, senhas. Use vars para: AWS_REGION, CLUSTER_NAME, APP_NAME — coisas que nao sao sensiveis mas variam por ambiente.',
      reference: 'Acesso: secrets.\${{ secrets.MY_SECRET }} e vars.\${{ vars.MY_VAR }}. Ambos disponíveis como Organization, Repository ou Environment scoped.'
    },
    {
      question: 'O que faz o campo `environment` em um job do GitHub Actions?',
      options: [
        'Define variaveis de ambiente para o job',
        'Associa o job a um environment configurado no GitHub (Settings > Environments), ativando: secrets especificos do environment, regras de protecao (required reviewers, wait timer, deployment branch rules), e exibindo o deploy no GitHub UI com URL',
        'E equivalente a usar env: no nivel do job',
        'Environments so funcionam com deploy em Kubernetes'
      ],
      correct: 1,
      explanation: 'Environments no GitHub Actions sao configurados em Settings > Environments e funcionam como gates de seguranca para deploys. Voce pode configurar: required reviewers (quem precisa aprovar antes do job rodar), wait timer (esperar X minutos apos o trigger), deployment branch rules (so main pode deployar em prod), e secrets especificos do ambiente. O job fica pausado aguardando aprovacao.',
      reference: 'Padrao recomendado: environment: production com required reviewers = time-sre. O job fica pendente no GitHub UI ate alguem aprovar.'
    },
    {
      question: 'Para que servem os `outputs` em jobs do GitHub Actions?',
      options: [
        'Outputs exportam logs de um job para outro',
        'Outputs permitem passar valores calculados em um job para jobs subsequentes — evitando recalcular (ex: digest da imagem Docker gerada no build, versao calculada no test) e criando dependencias de dados entre jobs',
        'Outputs so funcionam com matrix strategies',
        'Outputs substituem os artifacts para transferir arquivos'
      ],
      correct: 1,
      explanation: 'Outputs permitem que um job "publique" valores para que outros jobs os consumam. Exemplo: o job de build calcula o digest SHA256 da imagem Docker e o publica como output. Os jobs de deploy staging e prod consomem esse digest para garantir que deployam exatamente a mesma imagem — sem precisar recalcular ou hardcodar a tag. Usa-se `needs.build.outputs.image-digest`.',
      reference: 'Sintaxe: no job produtor: `echo "image-digest=\$DIGEST" >> \$GITHUB_OUTPUT`. No consumidor: `\${{ needs.build.outputs.image-digest }}`.'
    },
    {
      question: 'Como funcionam os `services` em um job do GitHub Actions?',
      options: [
        'Services sao jobs separados que rodam em paralelo',
        'Services sao containers auxiliares que sobem junto com o job — como um banco de dados ou Redis — acessiveis pelo nome do servico como hostname, com suporte a healthcheck antes do job comecar',
        'Services so funcionam com docker-compose',
        'Services executam apos o job principal terminar'
      ],
      correct: 1,
      explanation: 'Services no GitHub Actions sobem containers auxiliares que ficam disponiveis durante o job. O PostgreSQL sobe como service, e o job pode conectar em `localhost:5432` (ou pelo nome do service). Voce pode configurar healthcheck com `options: --health-cmd pg_isready` — o Actions aguarda o healthcheck passar antes de comecar os steps. Isso elimina a necessidade de setup manual de bancos de dados em testes.',
      reference: 'Dica: services rodam em containers Docker, entao o runner precisa ter Docker disponivel. ubuntu-latest sempre tem Docker instalado.'
    },
    {
      question: 'Qual e o beneficio de usar `workflow_call` para criar reusable workflows?',
      options: [
        'workflow_call acelera a execucao do pipeline',
        'Reusable workflows permitem extrair logica repetida (deploy, scan, notify) em um arquivo separado e chama-lo de multiplos workflows — como uma funcao reutilizavel, evitando duplicacao e facilitando manutencao centralizada',
        'workflow_call e necessario para usar matrix strategies',
        'Reusable workflows so funcionam dentro do mesmo repositorio'
      ],
      correct: 1,
      explanation: 'Sem reusable workflows, voce copia e cola a logica de deploy em 3 workflows diferentes (staging, prod, dr). Quando precisa alterar (adicionar scan, mudar estrategia de rollout), muda 3 arquivos. Com workflow_call, a logica de deploy fica em um arquivo reutilizado pelos 3. Reusable workflows podem receber inputs e secrets como parametros, tornando-os flexiveis. Podem ser em qualquer repo da org.',
      reference: 'Referencia: `uses: ./.github/workflows/deploy.yml` (mesmo repo) ou `uses: myorg/shared-workflows/.github/workflows/deploy.yml@main` (outro repo).'
    },
    {
      question: 'Por que usar `cache-from: type=gha` e `cache-to: type=gha,mode=max` no build Docker?',
      options: [
        'O cache do GHA armazena a imagem completa entre runs',
        'Esses parametros instruem o BuildKit a usar o cache do GitHub Actions como backend de armazenamento de layers Docker — layers nao modificados sao reutilizados entre runs, reduzindo builds de 8 minutos para 1-2 minutos quando so o codigo muda',
        'mode=max apenas aumenta o limite de tamanho do cache',
        'cache-from e cache-to so funcionam com imagens publicas'
      ],
      correct: 1,
      explanation: '`cache-from: type=gha` instrui o BuildKit a buscar layers cacheados no cache do GitHub Actions antes de rebuild. `cache-to: type=gha,mode=max` salva TODOS os layers intermediarios (nao apenas o final) no cache. Resultado: se so `src/` mudou mas `requirements.txt` nao, o step de `pip install` e reutilizado do cache — economizando minutos por run.',
      reference: 'Custo: o GitHub Actions cache tem limite de 10GB por repositorio. Layers mais antigos sao eviccionados automaticamente.'
    },
    {
      question: 'Como passar segredos de forma segura para steps de scripts no GitHub Actions?',
      options: [
        'Usando echo para imprimir e pipe para o script',
        'Usando o campo `env:` do step para mapear secrets como variaveis de ambiente — o script acessa via \$VAR_NAME — nunca interpolar \${{ secrets.X }} diretamente em comandos run pois aparece no log da substituicao',
        'Secrets podem ser passados diretamente em qualquer lugar sem risco',
        'Usando apenas actions oficiais, nunca scripts shell customizados'
      ],
      correct: 1,
      explanation: 'Quando voce usa `\${{ secrets.MY_SECRET }}` diretamente em um comando `run:`, o GitHub Actions substitui o valor antes de enviar para o runner — e embora seja mascarado no log, ainda e melhor pratica usar `env:` para tornar explicita a dependencia. Alem disso, passando via `env:` o secret fica disponivel como variavel de ambiente no processo filho sem aparecer no YAML interpolado.',
      reference: 'Padrao seguro: `env: { MY_VAR: \${{ secrets.MY_SECRET }} }` no step, depois usar `\$MY_VAR` no script shell.'
    }
  ],
  flashcards: [
    {
      front: 'Estrutura essencial de um GitHub Actions workflow',
      back: '```yaml\nname: Pipeline\n\non:\n  push:\n    branches: [main]\n    tags: ["v*"]\n  pull_request:\n    branches: [main]\n  workflow_dispatch:\n\nenv:\n  REGISTRY: ghcr.io\n\njobs:\n  test:\n    runs-on: ubuntu-latest\n    timeout-minutes: 15\n    steps:\n      - uses: actions/checkout@v4\n      - run: pytest\n\n  build:\n    needs: test  # executa apos test\n    runs-on: ubuntu-latest\n    outputs:\n      digest: \${{ steps.build.outputs.digest }}\n    steps:\n      - uses: docker/build-push-action@v5\n        id: build\n\n  deploy:\n    needs: build\n    environment: production  # gate de aprovacao\n    steps:\n      - run: kubectl apply\n```\n\n**Chaves de contexto:**\n- `\${{ github.sha }}` — commit hash\n- `\${{ github.ref_name }}` — branch/tag\n- `\${{ github.actor }}` — quem triggerou\n- `\${{ runner.os }}` — OS do runner'
    },
    {
      front: 'Environments com aprovacao manual — configuracao',
      back: '**No GitHub UI (Settings > Environments):**\n```\n[+] Required reviewers: @username, @team\n[+] Wait timer: 5 minutes\n[+] Deployment branch rules: main only\n[+] Environment secrets: PROD_KUBECONFIG\n```\n\n**No workflow:**\n```yaml\njobs:\n  deploy-prod:\n    needs: deploy-staging\n    environment:\n      name: production\n      url: https://app.mycompany.com\n    runs-on: ubuntu-latest\n    steps:\n      - run: kubectl apply -f k8s/prod/\n```\n\n**Fluxo:**\n1. Job chega no `deploy-prod`\n2. GitHub pausa e notifica reviewers\n3. Reviewer aprova (ou rejeita)\n4. Job continua (ou falha)\n\n**Secrets do environment:**\n- `\${{ secrets.PROD_KUBECONFIG }}` — só disponível neste job'
    },
    {
      front: 'Matrix strategy — multiplas versoes e plataformas',
      back: '```yaml\njobs:\n  test:\n    strategy:\n      matrix:\n        python: ["3.10", "3.11", "3.12"]\n        os: [ubuntu-latest, macos-latest]\n      fail-fast: false  # continua se uma falhar\n      max-parallel: 6\n    runs-on: \${{ matrix.os }}\n    steps:\n      - uses: actions/setup-python@v4\n        with:\n          python-version: \${{ matrix.python }}\n      - run: pytest\n```\n\n**Matrix com include (combinacoes extras):**\n```yaml\nstrategy:\n  matrix:\n    platform: [linux/amd64]\n    include:\n      - platform: linux/arm64\n        runner: ubuntu-24.04-arm\n```\n\n**Matrix com exclude:**\n```yaml\nstrategy:\n  matrix:\n    os: [ubuntu, windows]\n    python: ["3.10", "3.11"]\n    exclude:\n      - os: windows\n        python: "3.10"\n```\n\n**Resultado:** N jobs rodando em paralelo'
    },
    {
      front: 'Services — banco de dados nos testes',
      back: '```yaml\njobs:\n  test:\n    runs-on: ubuntu-latest\n    services:\n      postgres:\n        image: postgres:15-alpine\n        env:\n          POSTGRES_PASSWORD: testpass\n          POSTGRES_DB: testdb\n        ports:\n          - 5432:5432\n        options: >-\n          --health-cmd "pg_isready"\n          --health-interval 10s\n          --health-timeout 5s\n          --health-retries 5\n\n      redis:\n        image: redis:7-alpine\n        ports:\n          - 6379:6379\n        options: >-\n          --health-cmd "redis-cli ping"\n          --health-interval 5s\n\n    steps:\n      - run: pytest\n        env:\n          DATABASE_URL: postgres://postgres:testpass@localhost/testdb\n          REDIS_URL: redis://localhost:6379\n```\n\n**Acesso:** pelo hostname `localhost` (no runner)\n**Aguarda:** healthcheck passar antes dos steps'
    },
    {
      front: 'Outputs e dados entre jobs',
      back: '**Publicar output em um job:**\n```yaml\njobs:\n  build:\n    outputs:\n      image-tag: \${{ steps.meta.outputs.version }}\n      image-digest: \${{ steps.build.outputs.digest }}\n    steps:\n      - id: meta\n        uses: docker/metadata-action@v5\n      - id: build\n        uses: docker/build-push-action@v5\n```\n\n**Consumir output em outro job:**\n```yaml\n  deploy:\n    needs: build\n    steps:\n      - run: |\n          kubectl set image deployment/app \\\n            app=myregistry/myapp@\${{ needs.build.outputs.image-digest }}\n```\n\n**Outputs de steps (para o job):**\n```bash\n# Dentro de um run:\necho "version=v1.2.3" >> \$GITHUB_OUTPUT\necho "sha=\$(git rev-parse HEAD)" >> \$GITHUB_OUTPUT\n```\n\n**Regra:** outputs só passam strings simples\n→ Para arquivos, use artifacts'
    },
    {
      front: 'Reusable workflows — reutilizacao de logica',
      back: '**Definir reusable workflow:**\n```yaml\n# .github/workflows/deploy.yml\non:\n  workflow_call:\n    inputs:\n      env:\n        type: string\n        required: true\n      image-tag:\n        type: string\n        required: true\n    secrets:\n      KUBECONFIG:\n        required: true\n\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    environment: \${{ inputs.env }}\n    steps:\n      - run: |\n          echo "\${{ secrets.KUBECONFIG }}" | base64 -d > kube\n          kubectl --kubeconfig kube set image \\\n            deployment/app app=\${{ inputs.image-tag }}\n```\n\n**Chamar o reusable:**\n```yaml\njobs:\n  deploy-staging:\n    uses: ./.github/workflows/deploy.yml\n    with:\n      env: staging\n      image-tag: sha-abc1234\n    secrets:\n      KUBECONFIG: \${{ secrets.STAGING_KUBECONFIG }}\n\n  deploy-prod:\n    needs: deploy-staging\n    uses: ./.github/workflows/deploy.yml\n    with:\n      env: production\n      image-tag: sha-abc1234\n    secrets:\n      KUBECONFIG: \${{ secrets.PROD_KUBECONFIG }}\n```'
    }
  ],
  lab: {
    scenario: 'Voce vai criar um pipeline GitHub Actions completo para uma aplicacao Flask: testes com PostgreSQL como service, build de imagem Docker com cache e multi-tag, scan de seguranca com Trivy, e deploy simulado com gate de aprovacao.',
    objective: 'Criar um workflow GitHub Actions com: test job com service container, build job com Docker cache, security scan, e deploy com environment gate.',
    duration: '25-35 minutos',
    steps: [
      {
        title: 'Criar estrutura do repositorio e workflow de testes',
        instruction: `Crie a estrutura de projeto necessaria e o workflow de CI com testes usando PostgreSQL como service container.`,
        hints: [
          'Use actions/setup-python@v4 com cache: pip para cachear dependencias',
          'Configure o service postgres com healthcheck antes dos steps',
          'Use timeout-minutes no job para evitar runs infinitos'
        ],
        solution: `\`\`\`bash
# Criar estrutura do projeto (simulando um repositorio local)
mkdir github-actions-lab && cd github-actions-lab
mkdir -p .github/workflows src tests

# App simples
cat > src/app.py << 'EOF'
from flask import Flask, jsonify
import psycopg2
import os

app = Flask(__name__)

def get_db():
    return psycopg2.connect(os.getenv("DATABASE_URL", "postgres://localhost/test"))

@app.route('/health')
def health():
    return jsonify({"status": "ok"})

@app.route('/users')
def get_users():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM information_schema.tables")
    count = cur.fetchone()[0]
    conn.close()
    return jsonify({"tables": count})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
EOF

cat > tests/test_app.py << 'EOF'
import pytest
import sys
sys.path.insert(0, 'src')
from app import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_health(client):
    resp = client.get('/health')
    assert resp.status_code == 200
    assert resp.json['status'] == 'ok'
EOF

cat > requirements.txt << 'EOF'
flask==3.0.0
psycopg2-binary==2.9.9
EOF

cat > requirements-dev.txt << 'EOF'
pytest==7.4.3
pytest-cov==4.1.0
EOF

# Workflow de CI com testes
cat > .github/workflows/ci.yml << 'EOF'
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_PASSWORD: testpass
          POSTGRES_DB: testdb
          POSTGRES_USER: testuser
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U testuser"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v4
        with:
          python-version: "3.11"
          cache: pip

      - name: Install dependencies
        run: pip install -r requirements.txt -r requirements-dev.txt

      - name: Run tests
        run: pytest tests/ -v --cov=src --cov-report=xml
        env:
          DATABASE_URL: postgres://testuser:testpass@localhost/testdb

      - name: Upload coverage
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage.xml
          retention-days: 7
EOF

cat .github/workflows/ci.yml
\`\`\``,
        verify: `\`\`\`bash
# Verificar estrutura criada
find .github -type f
ls src/ tests/

# Validar YAML (se yamllint instalado)
which yamllint && yamllint .github/workflows/ci.yml || echo "yamllint nao instalado, verificar manualmente"

# Testar localmente (sem o service container)
pip install -r requirements.txt -r requirements-dev.txt 2>/dev/null
pytest tests/test_app.py -v
# Saida esperada: test_health PASSED

echo "Estrutura do workflow criada com sucesso!"
\`\`\``
      },
      {
        title: 'Adicionar job de build Docker com outputs e cache',
        instruction: `Adicione o job de build que depende do test, usa Docker cache do GHA, gera multiplas tags, e publica outputs com o digest da imagem para uso nos deploys.`,
        hints: [
          'Use docker/metadata-action para gerar tags automaticamente',
          'Publique o image-digest como output do job de build',
          'Configure cache-from e cache-to com type=gha'
        ],
        solution: `\`\`\`bash
# Criar Dockerfile
cat > Dockerfile << 'EOF'
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY src/ ./src/
RUN useradd --uid 1001 appuser && chown -R appuser /app
USER appuser
EXPOSE 8080
HEALTHCHECK --interval=30s CMD python -c \
  "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')" || exit 1
CMD ["python", "src/app.py"]
EOF

# Atualizar workflow adicionando job de build
cat >> .github/workflows/ci.yml << 'EOF'

  build:
    needs: test
    runs-on: ubuntu-latest
    timeout-minutes: 20

    # Publicar outputs para uso nos jobs de deploy
    outputs:
      image-digest: \${{ steps.build.outputs.digest }}
      image-tag: \${{ steps.meta.outputs.version }}

    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-buildx-action@v3

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/\${{ github.repository }}
          tags: |
            type=semver,pattern={{version}}
            type=sha,prefix=sha-
            type=edge,branch=main

      - name: Build and push
        id: build
        uses: docker/build-push-action@v5
        with:
          context: .
          push: \${{ github.event_name != 'pull_request' }}
          tags: \${{ steps.meta.outputs.tags }}
          labels: \${{ steps.meta.outputs.labels }}
          platforms: linux/amd64,linux/arm64
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Show image digest
        run: echo "Image digest: \${{ steps.build.outputs.digest }}"
EOF

echo "Job de build adicionado!"
cat .github/workflows/ci.yml | grep -A 30 "build:"
\`\`\``,
        verify: `\`\`\`bash
# Verificar que os jobs estao definidos
grep "^  [a-z]" .github/workflows/ci.yml
# Saida esperada: test:, build:

# Verificar outputs no job build
grep -A 5 "outputs:" .github/workflows/ci.yml
# Saida esperada: image-digest e image-tag definidos

# Verificar cache configurado
grep "cache-from\|cache-to" .github/workflows/ci.yml
# Saida esperada: type=gha em ambos

# Verificar multi-arch
grep "platforms" .github/workflows/ci.yml
# Saida esperada: linux/amd64,linux/arm64

echo "Job de build configurado corretamente!"
\`\`\``
      },
      {
        title: 'Adicionar scan de seguranca e deploy com environment gate',
        instruction: `Complete o pipeline adicionando: scan com Trivy que falha em CRITICAL CVEs, e um job de deploy simulado usando environment gate (aprovacao manual).`,
        hints: [
          'O job scan deve depender do build e usar needs.build.outputs.image-digest',
          'O job deploy deve ter environment: production para ativar o gate',
          'Use \${{ needs.build.outputs.image-digest }} para garantir deploy da imagem correta'
        ],
        solution: `\`\`\`bash
# Adicionar scan e deploy ao workflow
cat >> .github/workflows/ci.yml << 'EOF'

  security-scan:
    needs: build
    if: github.event_name != 'pull_request'
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Scan with Trivy
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ghcr.io/\${{ github.repository }}@\${{ needs.build.outputs.image-digest }}
          severity: HIGH,CRITICAL
          exit-code: 1
          format: sarif
          output: trivy-results.sarif

      - name: Upload scan results
        uses: actions/upload-artifact@v4
        if: always()  # upload mesmo se o scan falhou
        with:
          name: trivy-results
          path: trivy-results.sarif
          retention-days: 30

  deploy-staging:
    needs: [build, security-scan]
    runs-on: ubuntu-latest
    timeout-minutes: 10
    environment:
      name: staging
      url: https://staging.myapp.example.com

    steps:
      - uses: actions/checkout@v4

      - name: Simulate deploy to staging
        run: |
          echo "Deploying to STAGING"
          echo "Image: ghcr.io/\${{ github.repository }}@\${{ needs.build.outputs.image-digest }}"
          echo "Deployed by: \${{ github.actor }}"
          echo "Commit: \${{ github.sha }}"
          # Em producao real: kubectl set image, helm upgrade, etc.
          echo "Deploy to staging: SUCCESS"

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    timeout-minutes: 15
    environment:
      name: production
      url: https://myapp.example.com

    steps:
      - uses: actions/checkout@v4

      - name: Deploy to production
        run: |
          echo "Deploying to PRODUCTION"
          echo "Image: ghcr.io/\${{ github.repository }}@\${{ needs.build.outputs.image-digest }}"
          echo "Approved and deployed by: \${{ github.actor }}"
          echo "Commit: \${{ github.sha }}"
          # Em producao real:
          # kubectl set image deployment/myapp myapp=IMAGE@DIGEST -n production
          # kubectl rollout status deployment/myapp -n production --timeout=10m
          echo "Deploy to production: SUCCESS"
EOF

# Visualizar o workflow completo
echo "=== Workflow completo ==="
cat .github/workflows/ci.yml

# Criar README com instrucoes dos environments
cat > README.md << 'EOF'
# GitHub Actions Lab

## Setup necessario no repositorio real

### 1. Criar Environments (Settings > Environments)
- \`staging\` - sem protecao
- \`production\` - com Required reviewers

### 2. Adicionar segredos
- Repository secrets: nenhum necessario (usa GITHUB_TOKEN)
- Environment secrets (production): PROD_KUBECONFIG

### 3. Pipeline flow
test → build → security-scan → deploy-staging → deploy-production
                                                     ↑
                                              (aprovacao manual)
EOF

echo "Pipeline completo criado!"
\`\`\``,
        verify: `\`\`\`bash
# Verificar todos os jobs no workflow
echo "Jobs no workflow:"
grep "^  [a-z-]*:" .github/workflows/ci.yml | grep -v "^  on:\|^  env:\|^  name:\|^  runs\|^  needs\|^  timeout\|^  environment\|^  if:\|^  outputs\|^  permissions\|^  strategy\|^  services"

# Verificar dependencias de jobs
echo ""
echo "Dependencias:"
grep -E "^  [a-z-]+:|    needs:" .github/workflows/ci.yml

# Verificar que deploy-production tem environment gate
grep -A 3 "deploy-production:" .github/workflows/ci.yml | grep "environment:"
echo "Environment gate: configurado ✓"

# Verificar que security-scan usa o digest da imagem
grep "needs.build.outputs.image-digest" .github/workflows/ci.yml
echo "Image digest nos deploys: OK ✓"

echo ""
echo "Pipeline GitHub Actions completo e validado!"
echo "Para usar em repositorio real: commitar .github/workflows/ci.yml"
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Job falha com "Error: Resource not accessible by integration"',
      difficulty: 'easy',
      symptom: 'O job de build falha ao tentar fazer push para o GHCR ou criar releases com erro "Error: Resource not accessible by integration" ou "permission denied to create package".',
      diagnosis: `\`\`\`bash
# 1. Verificar as permissions no workflow
grep -A 10 "permissions:" .github/workflows/ci.yml

# 2. Verificar se o GITHUB_TOKEN tem permissoes suficientes
# No GitHub: Settings > Actions > General > Workflow permissions
# Verificar se esta em "Read and write permissions"

# 3. Verificar o erro especifico no log do Actions
# Procurar: "Permission denied" ou "403 Forbidden"

# 4. Para pacotes (GHCR): verificar configuracao do pacote
# Packages > mypackage > Package Settings > Manage Actions access
\`\`\``,
      solution: `**Solucao 1 — Adicionar permissions no workflow:**
\`\`\`yaml
jobs:
  build:
    permissions:
      contents: read
      packages: write      # para GHCR
      id-token: write      # para cosign/OIDC
      security-events: write  # para upload SARIF (Trivy)
\`\`\`

**Solucao 2 — Permissions no nivel do workflow:**
\`\`\`yaml
# No topo do arquivo, antes de jobs:
permissions:
  contents: read
  packages: write
\`\`\`

**Solucao 3 — Configurar no GitHub (Settings):**
1. Settings > Actions > General
2. Workflow permissions: "Read and write permissions"
3. Marcar "Allow GitHub Actions to create and approve pull requests"

**Para GHCR especificamente:**
1. Packages > [package name] > Package Settings
2. Manage Actions access > Add repository
3. Dar permissao "Write"

**Verificar apos corrigir:**
O job deve conseguir fazer push para ghcr.io/\${{ github.repository }}`
    },
    {
      title: 'Cache do Docker nao funciona entre runs (sempre rebuilda tudo)',
      difficulty: 'medium',
      symptom: 'Mesmo com `cache-from: type=gha` configurado, o build Docker sempre mostra "UNCACHED" em todos os layers, levando o mesmo tempo do zero. O cache parece nunca ser salvo ou restaurado.',
      diagnosis: `\`\`\`bash
# 1. Verificar no log do Actions o que acontece com o cache
# Procurar: "importing cache manifest" ou "exporting cache"
# Se nao aparecer: cache nao esta sendo salvo/restaurado

# 2. Verificar se o cache foi salvo no run anterior
# Actions > [workflow run] > Summary > Caches
# Ou: Actions > Caches (no menu da esquerda)

# 3. Verificar se o cache expira muito rapido
# GHA cache tem validade de 7 dias sem uso
# E eviccionado quando ultrapassa 10GB por repo

# 4. Verificar a configuracao exata de cache no step de build
grep -A 5 "cache-from\|cache-to" .github/workflows/*.yml
\`\`\``,
      solution: `**Causa 1 — Falta o cache-to (salvar cache):**
\`\`\`yaml
# ERRADO: so restaura, nunca salva
- uses: docker/build-push-action@v5
  with:
    cache-from: type=gha

# CORRETO: restaura E salva
- uses: docker/build-push-action@v5
  with:
    cache-from: type=gha
    cache-to: type=gha,mode=max
\`\`\`

**Causa 2 — Buildx nao configurado:**
\`\`\`yaml
# Adicionar ANTES do build:
- uses: docker/setup-buildx-action@v3
# Sem isso, o cache type=gha nao funciona
\`\`\`

**Causa 3 — Push para PR (cache write bloqueado em PRs externos):**
\`\`\`yaml
# Cache write e bloqueado para PRs de forks (seguranca)
# Para PRs do mesmo repo funciona normalmente
# Alternativa: usar registry cache
- uses: docker/build-push-action@v5
  with:
    cache-from: type=registry,ref=ghcr.io/myapp:cache
    cache-to: type=registry,ref=ghcr.io/myapp:cache,mode=max
\`\`\`

**Verificar:**
No log do Actions, deve aparecer:
\`importing cache manifest from gha\`
\`exporting cache to gha\``
    }
  ]
};
