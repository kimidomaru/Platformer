window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['cicd/github-actions'] = {
  theory: `
# GitHub Actions for DevOps and Kubernetes

## Relevance
GitHub Actions is the most widely adopted CI/CD platform in the market, especially for teams already using GitHub. For DevOps/SRE, understanding workflows, matrix builds, environments with approvals, reusable workflows, and Kubernetes integration is essential for production pipelines.

## Fundamental Concepts

### Workflow Anatomy

\`\`\`yaml
# .github/workflows/ci.yml
name: CI Pipeline          # workflow name

on:                        # triggers
  push:
    branches: [main, dev]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1'   # every Monday 6h UTC
  workflow_dispatch:        # manual execution

env:                       # global variables
  APP_NAME: myapp
  REGISTRY: ghcr.io

jobs:                      # jobs execute in parallel by default
  test:                    # job ID
    runs-on: ubuntu-latest # runner
    timeout-minutes: 15    # job timeout

    steps:                 # sequential steps inside the job
      - name: Checkout
        uses: actions/checkout@v4

      - name: Run tests
        run: pytest tests/
\`\`\`

### Essential Triggers

\`\`\`yaml
on:
  push:
    branches: [main]
    tags: ["v*"]           # any tag v1.0.0, v2.0, etc.
    paths:                 # only triggers if these paths changed
      - "src/**"
      - "Dockerfile"
    paths-ignore:
      - "docs/**"
      - "*.md"

  pull_request:
    types: [opened, synchronize, reopened]

  workflow_call:           # allows being called by other workflows
    inputs:
      environment:
        type: string
        required: true

  workflow_dispatch:        # manual button in GitHub UI
    inputs:
      version:
        description: "Version to deploy"
        required: true
        default: "latest"
      environment:
        type: choice
        options: [dev, staging, prod]
\`\`\`

## Jobs: Dependencies and Strategy

### Sequential jobs with needs

\`\`\`yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pytest

  build:
    needs: test            # only runs if test passed
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
    needs: [build, deploy-staging]  # depends on multiple jobs
    runs-on: ubuntu-latest
    environment: production         # manual approval gate
    steps:
      - run: kubectl apply -f k8s/prod/
\`\`\`

### Matrix strategy — test on multiple versions

\`\`\`yaml
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ["3.10", "3.11", "3.12"]
        os: [ubuntu-latest, windows-latest]
      fail-fast: false     # continues even if one fails
      max-parallel: 4      # max combinations in parallel

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v4
        with:
          python-version: \${{ matrix.python-version }}
      - run: pytest

  # Matrix with includes (specific combinations)
  docker-build:
    strategy:
      matrix:
        include:
          - platform: linux/amd64
            runner: ubuntu-latest
          - platform: linux/arm64
            runner: ubuntu-24.04-arm
\`\`\`

## Secrets and Environments

### Secret hierarchy

\`\`\`
Organization secrets  → shared with all repos in the org
Repository secrets    → specific to the repo
Environment secrets   → specific to an environment (prod, staging)
\`\`\`

\`\`\`yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production    # activates environment secrets and rules

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

### Environments with manual approval

\`\`\`yaml
# Configuration in GitHub: Settings > Environments > production
# - Required reviewers: platform-team
# - Wait timer: 5 minutes
# - Deployment branches: main only

jobs:
  deploy-prod:
    needs: deploy-staging
    environment:
      name: production
      url: https://app.mycompany.com   # link displayed in GitHub UI
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: |
          echo "Deploying version \${{ github.sha }} to production"
          kubectl set image deployment/myapp \
            myapp=\${{ env.REGISTRY }}/myapp:sha-\${{ github.sha }}
\`\`\`

## Essential Actions for DevOps

\`\`\`yaml
steps:
  # Checkout with submodules and full history
  - uses: actions/checkout@v4
    with:
      fetch-depth: 0         # full history (for git describe)
      submodules: recursive

  # Dependency caching
  - uses: actions/cache@v4
    with:
      path: ~/.cache/pip
      key: \${{ runner.os }}-pip-\${{ hashFiles('requirements.txt') }}
      restore-keys: |
        \${{ runner.os }}-pip-

  # Artifact upload (test results, binaries)
  - uses: actions/upload-artifact@v4
    with:
      name: test-results
      path: reports/
      retention-days: 7

  # Download in another job
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

## Complete Pipeline: Build, Test, Deploy

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

  # ============ DEPLOY PROD (with approval) ============
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

# Use the reusable workflow:
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

## Common Mistakes

1. **Secrets in logs** — never use \`echo \${{ secrets.PASSWORD }}\` — use \`env:\` to pass secrets
2. **No timeout** — job can run indefinitely, use \`timeout-minutes\`
3. **Cache key too generic** — \`key: \${{ runner.os }}-cache\` = cache never invalidates
4. **Not using outputs between jobs** — copying image tag repeatedly instead of using \`outputs\`
5. **Workflow too large** — one file with 500 lines = use reusable workflows

## Killer.sh Style Challenge

> **Scenario:** You need to create a pipeline that: (1) runs tests with PostgreSQL as a service container, (2) builds a multi-arch image only on push to main, (3) auto-deploys to staging, (4) requires manual approval for production with application link in GitHub UI. Write the complete workflow with best practices.
`,
  quiz: [
    {
      question: 'What is the difference between `secrets` and `vars` (variables) in GitHub Actions?',
      options: [
        'Secrets and vars are identical, just with different names',
        'Secrets are encrypted values that never appear in logs (automatically masked); vars are plain text values visible in logs — secrets for passwords/tokens, vars for configurations like region, cluster name',
        'Vars can only be used in workflows, secrets anywhere',
        'Secrets only work with environments, vars work globally'
      ],
      correct: 1,
      explanation: 'Secrets are stored encrypted and masked in Actions logs — if a secret accidentally leaks in an echo, GitHub replaces it with ***. Variables (vars) are plain text, visible in logs. Use secrets for: AWS_SECRET_KEY, tokens, passwords. Use vars for: AWS_REGION, CLUSTER_NAME, APP_NAME — things that are not sensitive but vary by environment.',
      reference: 'Access: \${{ secrets.MY_SECRET }} and \${{ vars.MY_VAR }}. Both available as Organization, Repository, or Environment scoped.'
    },
    {
      question: 'What does the `environment` field in a GitHub Actions job do?',
      options: [
        'Defines environment variables for the job',
        'Associates the job with an environment configured in GitHub (Settings > Environments), enabling: environment-specific secrets, protection rules (required reviewers, wait timer, deployment branch rules), and displaying the deploy in GitHub UI with URL',
        'It\'s equivalent to using env: at the job level',
        'Environments only work with Kubernetes deployments'
      ],
      correct: 1,
      explanation: 'Environments in GitHub Actions are configured in Settings > Environments and act as security gates for deployments. You can configure: required reviewers (who needs to approve before the job runs), wait timer (wait X minutes after trigger), deployment branch rules (only main can deploy to prod), and environment-specific secrets. The job pauses waiting for approval.',
      reference: 'Recommended pattern: environment: production with required reviewers = sre-team. The job stays pending in the GitHub UI until someone approves.'
    },
    {
      question: 'What are `outputs` in GitHub Actions jobs used for?',
      options: [
        'Outputs export logs from one job to another',
        'Outputs allow passing calculated values from one job to subsequent jobs — avoiding recalculation (e.g., Docker image digest from build, version calculated in test) and creating data dependencies between jobs',
        'Outputs only work with matrix strategies',
        'Outputs replace artifacts for transferring files'
      ],
      correct: 1,
      explanation: 'Outputs allow a job to "publish" values for other jobs to consume. Example: the build job calculates the Docker image\'s SHA256 digest and publishes it as output. The staging and prod deploy jobs consume that digest to ensure they deploy exactly the same image — without recalculating or hardcoding the tag. Uses `needs.build.outputs.image-digest`.',
      reference: 'Syntax: in the producing job: `echo "image-digest=\$DIGEST" >> \$GITHUB_OUTPUT`. In the consumer: `\${{ needs.build.outputs.image-digest }}`.'
    },
    {
      question: 'How do `services` in a GitHub Actions job work?',
      options: [
        'Services are separate jobs that run in parallel',
        'Services are auxiliary containers that start alongside the job — like a database or Redis — accessible by service name as hostname, with healthcheck support before the job begins',
        'Services only work with docker-compose',
        'Services execute after the main job finishes'
      ],
      correct: 1,
      explanation: 'Services in GitHub Actions start auxiliary containers that remain available during the job. PostgreSQL starts as a service, and the job can connect to `localhost:5432` (or by service name). You can configure healthcheck with `options: --health-cmd pg_isready` — Actions waits for the healthcheck to pass before starting steps. This eliminates the need for manual database setup in tests.',
      reference: 'Tip: services run in Docker containers, so the runner needs Docker available. ubuntu-latest always has Docker installed.'
    },
    {
      question: 'What is the benefit of using `workflow_call` to create reusable workflows?',
      options: [
        'workflow_call speeds up pipeline execution',
        'Reusable workflows allow extracting repeated logic (deploy, scan, notify) into a separate file and calling it from multiple workflows — like a reusable function, avoiding duplication and facilitating centralized maintenance',
        'workflow_call is needed to use matrix strategies',
        'Reusable workflows only work within the same repository'
      ],
      correct: 1,
      explanation: 'Without reusable workflows, you copy and paste deploy logic across 3 different workflows (staging, prod, dr). When you need to change (add scan, change rollout strategy), you change 3 files. With workflow_call, the deploy logic lives in one file reused by all 3. Reusable workflows can receive inputs and secrets as parameters, making them flexible. They can be in any repo in the org.',
      reference: 'Reference: `uses: ./.github/workflows/deploy.yml` (same repo) or `uses: myorg/shared-workflows/.github/workflows/deploy.yml@main` (another repo).'
    },
    {
      question: 'Why use `cache-from: type=gha` and `cache-to: type=gha,mode=max` in Docker builds?',
      options: [
        'GHA cache stores the complete image between runs',
        'These parameters instruct BuildKit to use GitHub Actions cache as Docker layer storage backend — unmodified layers are reused between runs, reducing builds from 8 minutes to 1-2 minutes when only code changes',
        'mode=max only increases the cache size limit',
        'cache-from and cache-to only work with public images'
      ],
      correct: 1,
      explanation: '`cache-from: type=gha` instructs BuildKit to fetch cached layers from GitHub Actions cache before rebuilding. `cache-to: type=gha,mode=max` saves ALL intermediate layers (not just the final) to cache. Result: if only `src/` changed but `requirements.txt` didn\'t, the `pip install` step is reused from cache — saving minutes per run.',
      reference: 'Cost: GitHub Actions cache has a 10GB limit per repository. Older layers are automatically evicted.'
    },
    {
      question: 'How to securely pass secrets to script steps in GitHub Actions?',
      options: [
        'Using echo to print and pipe to the script',
        'Using the step\'s `env:` field to map secrets as environment variables — the script accesses via \$VAR_NAME — never interpolate \${{ secrets.X }} directly in run commands as it appears in substitution logs',
        'Secrets can be passed directly anywhere without risk',
        'Using only official actions, never custom shell scripts'
      ],
      correct: 1,
      explanation: 'When you use `\${{ secrets.MY_SECRET }}` directly in a `run:` command, GitHub Actions substitutes the value before sending to the runner — and while it\'s masked in the log, it\'s still better practice to use `env:` to make the dependency explicit. Also, passing via `env:` makes the secret available as an environment variable in the child process without appearing in interpolated YAML.',
      reference: 'Secure pattern: `env: { MY_VAR: \${{ secrets.MY_SECRET }} }` in the step, then use `\$MY_VAR` in the shell script.'
    }
  ],
  flashcards: [
    {
      front: 'Essential structure of a GitHub Actions workflow',
      back: '```yaml\nname: Pipeline\n\non:\n  push:\n    branches: [main]\n    tags: ["v*"]\n  pull_request:\n    branches: [main]\n  workflow_dispatch:\n\nenv:\n  REGISTRY: ghcr.io\n\njobs:\n  test:\n    runs-on: ubuntu-latest\n    timeout-minutes: 15\n    steps:\n      - uses: actions/checkout@v4\n      - run: pytest\n\n  build:\n    needs: test  # executes after test\n    runs-on: ubuntu-latest\n    outputs:\n      digest: \${{ steps.build.outputs.digest }}\n    steps:\n      - uses: docker/build-push-action@v5\n        id: build\n\n  deploy:\n    needs: build\n    environment: production  # approval gate\n    steps:\n      - run: kubectl apply\n```\n\n**Key context values:**\n- `\${{ github.sha }}` — commit hash\n- `\${{ github.ref_name }}` — branch/tag\n- `\${{ github.actor }}` — who triggered\n- `\${{ runner.os }}` — runner OS'
    },
    {
      front: 'Environments with manual approval — configuration',
      back: '**In GitHub UI (Settings > Environments):**\n```\n[+] Required reviewers: @username, @team\n[+] Wait timer: 5 minutes\n[+] Deployment branch rules: main only\n[+] Environment secrets: PROD_KUBECONFIG\n```\n\n**In the workflow:**\n```yaml\njobs:\n  deploy-prod:\n    needs: deploy-staging\n    environment:\n      name: production\n      url: https://app.mycompany.com\n    runs-on: ubuntu-latest\n    steps:\n      - run: kubectl apply -f k8s/prod/\n```\n\n**Flow:**\n1. Job reaches `deploy-prod`\n2. GitHub pauses and notifies reviewers\n3. Reviewer approves (or rejects)\n4. Job continues (or fails)\n\n**Environment secrets:**\n- `\${{ secrets.PROD_KUBECONFIG }}` — only available in this job'
    },
    {
      front: 'Matrix strategy — multiple versions and platforms',
      back: '```yaml\njobs:\n  test:\n    strategy:\n      matrix:\n        python: ["3.10", "3.11", "3.12"]\n        os: [ubuntu-latest, macos-latest]\n      fail-fast: false  # continues if one fails\n      max-parallel: 6\n    runs-on: \${{ matrix.os }}\n    steps:\n      - uses: actions/setup-python@v4\n        with:\n          python-version: \${{ matrix.python }}\n      - run: pytest\n```\n\n**Matrix with include (extra combinations):**\n```yaml\nstrategy:\n  matrix:\n    platform: [linux/amd64]\n    include:\n      - platform: linux/arm64\n        runner: ubuntu-24.04-arm\n```\n\n**Matrix with exclude:**\n```yaml\nstrategy:\n  matrix:\n    os: [ubuntu, windows]\n    python: ["3.10", "3.11"]\n    exclude:\n      - os: windows\n        python: "3.10"\n```\n\n**Result:** N jobs running in parallel'
    },
    {
      front: 'Services — database in tests',
      back: '```yaml\njobs:\n  test:\n    runs-on: ubuntu-latest\n    services:\n      postgres:\n        image: postgres:15-alpine\n        env:\n          POSTGRES_PASSWORD: testpass\n          POSTGRES_DB: testdb\n        ports:\n          - 5432:5432\n        options: >-\n          --health-cmd "pg_isready"\n          --health-interval 10s\n          --health-timeout 5s\n          --health-retries 5\n\n      redis:\n        image: redis:7-alpine\n        ports:\n          - 6379:6379\n        options: >-\n          --health-cmd "redis-cli ping"\n          --health-interval 5s\n\n    steps:\n      - run: pytest\n        env:\n          DATABASE_URL: postgres://postgres:testpass@localhost/testdb\n          REDIS_URL: redis://localhost:6379\n```\n\n**Access:** by hostname `localhost` (on runner)\n**Waits:** for healthcheck to pass before steps'
    },
    {
      front: 'Outputs and data between jobs',
      back: '**Publish output in a job:**\n```yaml\njobs:\n  build:\n    outputs:\n      image-tag: \${{ steps.meta.outputs.version }}\n      image-digest: \${{ steps.build.outputs.digest }}\n    steps:\n      - id: meta\n        uses: docker/metadata-action@v5\n      - id: build\n        uses: docker/build-push-action@v5\n```\n\n**Consume output in another job:**\n```yaml\n  deploy:\n    needs: build\n    steps:\n      - run: |\n          kubectl set image deployment/app \\\n            app=myregistry/myapp@\${{ needs.build.outputs.image-digest }}\n```\n\n**Step outputs (for the job):**\n```bash\n# Inside a run:\necho "version=v1.2.3" >> \$GITHUB_OUTPUT\necho "sha=\$(git rev-parse HEAD)" >> \$GITHUB_OUTPUT\n```\n\n**Rule:** outputs only pass simple strings\n→ For files, use artifacts'
    },
    {
      front: 'Reusable workflows — logic reuse',
      back: '**Define reusable workflow:**\n```yaml\n# .github/workflows/deploy.yml\non:\n  workflow_call:\n    inputs:\n      env:\n        type: string\n        required: true\n      image-tag:\n        type: string\n        required: true\n    secrets:\n      KUBECONFIG:\n        required: true\n\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    environment: \${{ inputs.env }}\n    steps:\n      - run: |\n          echo "\${{ secrets.KUBECONFIG }}" | base64 -d > kube\n          kubectl --kubeconfig kube set image \\\n            deployment/app app=\${{ inputs.image-tag }}\n```\n\n**Call the reusable:**\n```yaml\njobs:\n  deploy-staging:\n    uses: ./.github/workflows/deploy.yml\n    with:\n      env: staging\n      image-tag: sha-abc1234\n    secrets:\n      KUBECONFIG: \${{ secrets.STAGING_KUBECONFIG }}\n\n  deploy-prod:\n    needs: deploy-staging\n    uses: ./.github/workflows/deploy.yml\n    with:\n      env: production\n      image-tag: sha-abc1234\n    secrets:\n      KUBECONFIG: \${{ secrets.PROD_KUBECONFIG }}\n```'
    }
  ],
  lab: {
    scenario: 'You will create a complete GitHub Actions pipeline for a Flask application: tests with PostgreSQL as a service, Docker image build with cache and multi-tag, security scanning with Trivy, and simulated deploy with approval gate.',
    objective: 'Create a GitHub Actions workflow with: test job with service container, build job with Docker cache, security scan, and deploy with environment gate.',
    duration: '25-35 minutes',
    steps: [
      {
        title: 'Create repository structure and test workflow',
        instruction: `Create the necessary project structure and the CI workflow with tests using PostgreSQL as a service container.`,
        hints: [
          'Use actions/setup-python@v4 with cache: pip to cache dependencies',
          'Configure the postgres service with healthcheck before steps',
          'Use timeout-minutes on the job to avoid infinite runs'
        ],
        solution: `\`\`\`bash
# Create project structure (simulating a local repository)
mkdir github-actions-lab && cd github-actions-lab
mkdir -p .github/workflows src tests

# Simple app
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

# CI workflow with tests
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
# Verify created structure
find .github -type f
ls src/ tests/

# Validate YAML (if yamllint installed)
which yamllint && yamllint .github/workflows/ci.yml || echo "yamllint not installed, verify manually"

# Test locally (without service container)
pip install -r requirements.txt -r requirements-dev.txt 2>/dev/null
pytest tests/test_app.py -v
# Expected: test_health PASSED

echo "Workflow structure created successfully!"
\`\`\``
      },
      {
        title: 'Add Docker build job with outputs and cache',
        instruction: `Add the build job that depends on test, uses GHA Docker cache, generates multiple tags, and publishes outputs with the image digest for use in deploys.`,
        hints: [
          'Use docker/metadata-action to generate tags automatically',
          'Publish the image-digest as the build job output',
          'Configure cache-from and cache-to with type=gha'
        ],
        solution: `\`\`\`bash
# Create Dockerfile
cat > Dockerfile << 'EOF'
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY src/ ./src/
RUN useradd --uid 1001 appuser && chown -R appuser /app
USER appuser
EXPOSE 8080
HEALTHCHECK --interval=30s CMD python -c \\
  "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')" || exit 1
CMD ["python", "src/app.py"]
EOF

# Update workflow adding build job
cat >> .github/workflows/ci.yml << 'EOF'

  build:
    needs: test
    runs-on: ubuntu-latest
    timeout-minutes: 20

    # Publish outputs for use in deploy jobs
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

echo "Build job added!"
cat .github/workflows/ci.yml | grep -A 30 "build:"
\`\`\``,
        verify: `\`\`\`bash
# Verify jobs are defined
grep "^  [a-z]" .github/workflows/ci.yml
# Expected: test:, build:

# Verify outputs in build job
grep -A 5 "outputs:" .github/workflows/ci.yml
# Expected: image-digest and image-tag defined

# Verify cache configured
grep "cache-from\|cache-to" .github/workflows/ci.yml
# Expected: type=gha in both

# Verify multi-arch
grep "platforms" .github/workflows/ci.yml
# Expected: linux/amd64,linux/arm64

echo "Build job configured correctly!"
\`\`\``
      },
      {
        title: 'Add security scan and deploy with environment gate',
        instruction: `Complete the pipeline by adding: Trivy scan that fails on CRITICAL CVEs, and a simulated deploy job using an environment gate (manual approval).`,
        hints: [
          'The scan job must depend on build and use needs.build.outputs.image-digest',
          'The deploy job must have environment: production to activate the gate',
          'Use \${{ needs.build.outputs.image-digest }} to ensure deploying the correct image'
        ],
        solution: `\`\`\`bash
# Add scan and deploy to workflow
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
        if: always()  # upload even if scan failed
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
          echo "Deploy to production: SUCCESS"
EOF

# Display complete workflow
echo "=== Complete workflow ==="
cat .github/workflows/ci.yml

echo "Complete pipeline created!"
\`\`\``,
        verify: `\`\`\`bash
# Verify all jobs in workflow
echo "Jobs in workflow:"
grep "^  [a-z-]*:" .github/workflows/ci.yml | grep -v "^  on:\|^  env:\|^  name:\|^  runs\|^  needs\|^  timeout\|^  environment\|^  if:\|^  outputs\|^  permissions\|^  strategy\|^  services"

# Verify job dependencies
echo ""
echo "Dependencies:"
grep -E "^  [a-z-]+:|    needs:" .github/workflows/ci.yml

# Verify deploy-production has environment gate
grep -A 3 "deploy-production:" .github/workflows/ci.yml | grep "environment:"
echo "Environment gate: configured ✓"

# Verify security-scan uses image digest
grep "needs.build.outputs.image-digest" .github/workflows/ci.yml
echo "Image digest in deploys: OK ✓"

echo ""
echo "Complete GitHub Actions pipeline validated!"
echo "To use in real repository: commit .github/workflows/ci.yml"
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Job fails with "Error: Resource not accessible by integration"',
      difficulty: 'easy',
      symptom: 'The build job fails when trying to push to GHCR or create releases with error "Error: Resource not accessible by integration" or "permission denied to create package".',
      diagnosis: `\`\`\`bash
# 1. Check permissions in workflow
grep -A 10 "permissions:" .github/workflows/ci.yml

# 2. Check if GITHUB_TOKEN has sufficient permissions
# In GitHub: Settings > Actions > General > Workflow permissions
# Check if it's set to "Read and write permissions"

# 3. Check specific error in Actions log
# Look for: "Permission denied" or "403 Forbidden"

# 4. For packages (GHCR): check package configuration
# Packages > mypackage > Package Settings > Manage Actions access
\`\`\``,
      solution: `**Solution 1 — Add permissions in workflow:**
\`\`\`yaml
jobs:
  build:
    permissions:
      contents: read
      packages: write      # for GHCR
      id-token: write      # for cosign/OIDC
      security-events: write  # for SARIF upload (Trivy)
\`\`\`

**Solution 2 — Permissions at workflow level:**
\`\`\`yaml
# At the top of the file, before jobs:
permissions:
  contents: read
  packages: write
\`\`\`

**Solution 3 — Configure in GitHub (Settings):**
1. Settings > Actions > General
2. Workflow permissions: "Read and write permissions"
3. Check "Allow GitHub Actions to create and approve pull requests"

**For GHCR specifically:**
1. Packages > [package name] > Package Settings
2. Manage Actions access > Add repository
3. Give "Write" permission

**Verify after fixing:**
The job should be able to push to ghcr.io/\${{ github.repository }}`
    },
    {
      title: 'Docker cache not working between runs (always rebuilds everything)',
      difficulty: 'medium',
      symptom: 'Even with `cache-from: type=gha` configured, Docker build always shows "UNCACHED" on all layers, taking the same time from scratch. The cache never seems to be saved or restored.',
      diagnosis: `\`\`\`bash
# 1. Check in the Actions log what happens with cache
# Look for: "importing cache manifest" or "exporting cache"
# If not appearing: cache is not being saved/restored

# 2. Check if cache was saved in previous run
# Actions > [workflow run] > Summary > Caches
# Or: Actions > Caches (in left menu)

# 3. Check if cache expires too quickly
# GHA cache has 7-day validity without use
# Evicted when it exceeds 10GB per repo

# 4. Check exact cache configuration in build step
grep -A 5 "cache-from\|cache-to" .github/workflows/*.yml
\`\`\``,
      solution: `**Cause 1 — Missing cache-to (save cache):**
\`\`\`yaml
# WRONG: only restores, never saves
- uses: docker/build-push-action@v5
  with:
    cache-from: type=gha

# CORRECT: restores AND saves
- uses: docker/build-push-action@v5
  with:
    cache-from: type=gha
    cache-to: type=gha,mode=max
\`\`\`

**Cause 2 — Buildx not configured:**
\`\`\`yaml
# Add BEFORE the build:
- uses: docker/setup-buildx-action@v3
# Without this, cache type=gha doesn't work
\`\`\`

**Cause 3 — Push for PR (cache write blocked for external PRs):**
\`\`\`yaml
# Cache write is blocked for fork PRs (security)
# For same-repo PRs it works normally
# Alternative: use registry cache
- uses: docker/build-push-action@v5
  with:
    cache-from: type=registry,ref=ghcr.io/myapp:cache
    cache-to: type=registry,ref=ghcr.io/myapp:cache,mode=max
\`\`\`

**Verify:**
In Actions log, should appear:
\`importing cache manifest from gha\`
\`exporting cache to gha\``
    }
  ]
};
