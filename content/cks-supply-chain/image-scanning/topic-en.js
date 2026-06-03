window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['cks-supply-chain/image-scanning'] = {
  theory: `# Container Image Scanning

## Exam Relevance
> CKS expects you to scan images for vulnerabilities using Trivy, interpret scan results, and understand integration with CI/CD. Appears in Supply Chain Security domain (~8%).

## What is Image Scanning?

Container image scanning analyzes image layers to find:
- **CVEs** (Common Vulnerabilities and Exposures) in OS packages
- **CVEs** in application dependencies (npm, pip, maven, etc.)
- **Misconfigurations** in Dockerfiles
- **Secrets** accidentally included in images

## Trivy (Primary CKS Tool)

**Trivy** (by Aqua Security) is the most commonly used and CKS-relevant scanner.

\`\`\`bash
# Install Trivy
wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | sudo gpg --dearmor -o /usr/share/keyrings/trivy.gpg
echo "deb [signed-by=/usr/share/keyrings/trivy.gpg] https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" | sudo tee /etc/apt/sources.list.d/trivy.list
sudo apt-get update && sudo apt-get install -y trivy
\`\`\`

## Trivy Commands

### Basic Image Scan

\`\`\`bash
# Scan an image
trivy image nginx:1.25

# Scan from a local Docker daemon
trivy image myapp:latest

# Scan an image without pulling (from tarball)
docker save nginx:1.25 -o nginx.tar
trivy image --input nginx.tar
\`\`\`

### Filtering by Severity

\`\`\`bash
# Only show HIGH and CRITICAL
trivy image --severity HIGH,CRITICAL nginx:1.25

# Only CRITICAL
trivy image --severity CRITICAL nginx:1.25

# All levels (DEBUG, INFO, LOW, MEDIUM, HIGH, CRITICAL)
trivy image --severity LOW,MEDIUM,HIGH,CRITICAL nginx:1.25
\`\`\`

### Exit Codes for CI/CD Integration

\`\`\`bash
# Exit code 1 if vulnerabilities found (fail the build)
trivy image --exit-code 1 --severity HIGH,CRITICAL myapp:latest

# In CI pipeline:
trivy image --exit-code 1 --severity CRITICAL myapp:$TAG
if [ $? -ne 0 ]; then
  echo "CRITICAL vulnerabilities found — blocking push"
  exit 1
fi
\`\`\`

### Output Formats

\`\`\`bash
# Default: table output
trivy image nginx:1.25

# JSON (for parsing/reporting)
trivy image -f json -o results.json nginx:1.25

# SARIF (for GitHub Code Scanning)
trivy image -f sarif -o results.sarif nginx:1.25

# SBOM output (CycloneDX)
trivy image -f cyclonedx -o sbom.json nginx:1.25

# Template output
trivy image --format template \
  --template "@contrib/html.tpl" \
  -o report.html nginx:1.25
\`\`\`

### Scan Types

\`\`\`bash
# Default: vulnerability scan only
trivy image nginx:1.25

# Specific scan types
trivy image --scanners vuln nginx:1.25          # vulnerabilities only
trivy image --scanners config nginx:1.25        # misconfigurations only
trivy image --scanners secret nginx:1.25        # secrets in image
trivy image --scanners license nginx:1.25       # license compliance

# Multiple scanners
trivy image --scanners vuln,secret,config nginx:1.25

# Filesystem scan (local directory)
trivy fs --scanners vuln,secret ./myapp/

# Dockerfile/IaC scan
trivy config Dockerfile
trivy config kubernetes.yaml
trivy config ./helm-chart/
\`\`\`

### Ignoring Known Vulnerabilities

\`\`\`bash
# Create .trivyignore file
cat <<EOF > .trivyignore
# Ignore this CVE — mitigated by network policy
CVE-2023-1234

# Ignore with expiry
CVE-2023-5678 exp:2024-12-31
EOF

# Use the ignore file
trivy image --ignorefile .trivyignore nginx:1.25
\`\`\`

## Understanding Trivy Output

\`\`\`
nginx:1.25 (debian 12.0)
========================
Total: 25 (HIGH: 5, CRITICAL: 2)

┌─────────────────────┬────────────────┬──────────┬───────────┬──────────────────┬─────────────────┬─────────────────────────────────────┐
│       Library       │ Vulnerability  │ Severity │  Status   │ Installed Version│  Fixed Version  │                Title                │
├─────────────────────┼────────────────┼──────────┼───────────┼──────────────────┼─────────────────┼─────────────────────────────────────┤
│ libssl3             │ CVE-2023-5678  │ CRITICAL │ fixed     │ 3.0.9-1          │ 3.0.11-1~deb12  │ OpenSSL: Memory corruption...       │
│ openssl             │ CVE-2023-5678  │ CRITICAL │ fixed     │ 3.0.9-1          │ 3.0.11-1~deb12  │ OpenSSL: Memory corruption...       │
│ libpcre3            │ CVE-2017-7246  │ HIGH     │ will_not_fix│ 2:8.39-15       │                 │ PCRE: stack-based buffer overflow   │
\`\`\`

**Key columns:**
- **Library**: affected package
- **Vulnerability**: CVE ID
- **Severity**: CRITICAL/HIGH/MEDIUM/LOW/UNKNOWN
- **Status**: fixed | will_not_fix | affected | under_investigation
- **Installed Version**: version in the image
- **Fixed Version**: version that resolves it (if available)

## Admission Control Integration

### ImagePolicyWebhook

Block images that fail scanning at admission time:

\`\`\`yaml
# API server flag:
# --admission-control-config-file=/etc/kubernetes/admission/config.yaml

# admission-config.yaml
apiVersion: apiserver.config.k8s.io/v1
kind: AdmissionConfiguration
plugins:
- name: ImagePolicyWebhook
  configuration:
    imagePolicy:
      kubeConfigFile: /etc/kubernetes/admission/kubeconfig.yaml
      allowTTL: 50
      denyTTL: 50
      retryBackoff: 500
      defaultAllow: false    # deny by default if webhook unavailable
\`\`\`

### Kyverno Image Scanning Policy

\`\`\`yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: check-image-vulnerability
spec:
  validationFailureAction: Enforce
  rules:
  - name: scan-image
    match:
      any:
      - resources:
          kinds: ["Pod"]
    verifyImages:
    - imageReferences: ["*"]
      attestors:
      - entries:
        - keyless:
            subject: "https://github.com/myorg/*"
            issuer: "https://token.actions.githubusercontent.com"
\`\`\`

## Grype (Alternative Scanner)

\`\`\`bash
# Install grype
curl -sSfL https://raw.githubusercontent.com/anchore/grype/main/install.sh | sh -s -- -b /usr/local/bin

# Scan image
grype nginx:1.25

# Scan with severity filter
grype --fail-on high nginx:1.25

# JSON output
grype -o json nginx:1.25 > results.json
\`\`\`

## Scanning in Kubernetes Workflows

### Scan Before Push (CI/CD)

\`\`\`yaml
# GitHub Actions example
- name: Scan image
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: '\${{ env.REGISTRY }}/myapp:\${{ github.sha }}'
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
    exit-code: '1'
\`\`\`

### Continuous Scanning of Running Images

\`\`\`bash
# Trivy Operator (Kubernetes-native scanning)
kubectl apply -f https://raw.githubusercontent.com/aquasecurity/trivy-operator/main/deploy/manifests/trivy-operator.yaml

# View vulnerability reports
kubectl get vulnerabilityreports -A
kubectl describe vulnerabilityreport <name> -n <namespace>

# View all CRITICAL findings
kubectl get vulnerabilityreports -A -o json | \
  jq '.items[] | {name: .metadata.name, critical: .report.summary.criticalCount} | select(.critical > 0)'
\`\`\`

## Common Mistakes

- **Not running the scanner against the actual registry image**: Scanning a local build may miss vulnerabilities added during registry push or caching
- **Ignoring all HIGH vulnerabilities**: Some HIGH CVEs are critical in certain contexts — review them
- **Not updating the vulnerability database**: Trivy uses an offline DB — run trivy image --download-db-only to update
- **Confusing vulnerability scan with configuration scan**: --scanners vuln vs --scanners config are different scans

## Killer.sh Style Challenge

> **Scenario**: Scan the image "nginx:1.24" for vulnerabilities. Find any CRITICAL vulnerabilities and list which packages are affected.
`,

  quiz: [
    {
      question: 'Which Trivy command scans an image and only reports HIGH and CRITICAL vulnerabilities?',
      options: [
        'trivy image --severity HIGH,CRITICAL nginx:1.25',
        'trivy image --level high,critical nginx:1.25',
        'trivy scan --filter HIGH,CRITICAL nginx:1.25',
        'trivy image --min-severity HIGH nginx:1.25'
      ],
      correct: 0,
      explanation: 'The --severity flag filters results by severity level. Multiple levels are comma-separated. This flag only shows and counts the specified severities in the output, but does not fail the scan by itself.',
      reference: 'Image Scanning — Filtering by Severity section.'
    },
    {
      question: 'What does trivy image --exit-code 1 --severity CRITICAL do in a CI/CD pipeline?',
      options: [
        'Returns exit code 1 (failure) if any CRITICAL vulnerabilities are found — enables pipeline to fail and block the build',
        'Scans only 1 layer of the image for CRITICAL issues',
        'Waits 1 second before scanning',
        'Reports exactly 1 CRITICAL vulnerability and exits'
      ],
      correct: 0,
      explanation: 'Trivy normally exits with code 0 (success) even when vulnerabilities are found. --exit-code 1 makes Trivy exit with code 1 when any vulnerabilities matching the --severity filter are found. This allows CI/CD pipelines to fail (e.g., if [ $? -ne 0 ]; then reject) on critical issues.',
      reference: 'Image Scanning — Exit Codes for CI/CD Integration section.'
    },
    {
      question: 'What does the "will_not_fix" status mean for a vulnerability in Trivy output?',
      options: [
        'The maintainer of the package has acknowledged the CVE but will not provide a fix (often: out of scope, too old, or WontFix decision)',
        'Trivy detected the vulnerability but cannot fix it automatically',
        'The vulnerability exists only in the development environment, not production',
        'The fixed version exists but is incompatible with the current application'
      ],
      correct: 0,
      explanation: 'Status "will_not_fix" means the upstream package maintainer has evaluated the CVE but chosen not to release a fix. This is common for CVEs in very old libraries, low-risk CVEs, or architectural issues. These still appear in scans but may be accepted after risk assessment.',
      reference: 'Image Scanning — Understanding Trivy Output section.'
    },
    {
      question: 'What Trivy scan type would you use to find accidentally included credentials or tokens in an image?',
      options: [
        '--scanners secret',
        '--scanners credentials',
        '--scanners sensitive',
        '--scanners vault'
      ],
      correct: 0,
      explanation: 'trivy image --scanners secret scans image layers for embedded secrets like API keys, tokens, passwords, and credentials. This catches cases where .env files, credential files, or hardcoded secrets were accidentally copied into the image.',
      reference: 'Image Scanning — Scan Types section.'
    },
    {
      question: 'What does trivy config Dockerfile check for?',
      options: [
        'Security misconfigurations in the Dockerfile: running as root, using :latest, exposed dangerous ports',
        'CVE vulnerabilities in packages mentioned in the Dockerfile RUN commands',
        'Syntax errors and invalid Dockerfile instructions',
        'License compliance of packages installed in the Dockerfile'
      ],
      correct: 0,
      explanation: '"trivy config" (IaC scanner) checks Dockerfile instructions for security misconfigurations — not CVEs. It detects: no USER instruction (root), ADD instead of COPY, :latest tags, exposed ports that shouldn\'t be, and other Dockerfile security anti-patterns.',
      reference: 'Image Scanning — Scan Types section.'
    },
    {
      question: 'You run trivy image and get 50 MEDIUM vulnerabilities for a library with status "fixed". What should you do?',
      options: [
        'Update the base image or the specific library to the fixed version shown in the "Fixed Version" column',
        'Add all CVE IDs to .trivyignore since MEDIUM is below HIGH',
        'Rebuild the image without any changes (Trivy will fix them automatically on next scan)',
        'The fixed version column shows minimum required Kubernetes version'
      ],
      correct: 0,
      explanation: 'Status "fixed" means an updated version of the package resolves the vulnerability. The "Fixed Version" column shows which version to upgrade to. Update your base image tag (e.g., alpine:3.19 → alpine:3.19.1) or update the specific package version.',
      reference: 'Image Scanning — Understanding Trivy Output section.'
    },
    {
      question: 'How does the Trivy Operator differ from running trivy image manually?',
      options: [
        'Trivy Operator runs as a DaemonSet in Kubernetes, continuously scanning running workloads and storing results as CRDs (VulnerabilityReport)',
        'Trivy Operator is a different tool from Trivy with different vulnerability databases',
        'Trivy Operator only scans Helm chart values, not container images',
        'Trivy Operator requires a separate license for Kubernetes scanning'
      ],
      correct: 0,
      explanation: 'The Trivy Operator is a Kubernetes-native controller that watches for new pods/images and automatically scans them. Results are stored as VulnerabilityReport, ConfigAuditReport, and ExposedSecretReport CRDs. Unlike manual trivy image runs, it provides continuous scanning.',
      reference: 'Image Scanning — Continuous Scanning section.'
    },
    {
      question: 'What is the purpose of .trivyignore?',
      options: [
        'Lists CVE IDs to suppress from scan results — used for known accepted risks or false positives',
        'Lists files to exclude from the image before scanning',
        'Configures which container registries to trust',
        'Defines custom severity levels for specific CVEs'
      ],
      correct: 0,
      explanation: '.trivyignore is similar to .gitignore — it lists CVE IDs that Trivy should suppress in scan results. Used for: accepted risks (with documented justification), false positives (CVE in a library you don\'t use), or CVEs with mitigations in place.',
      reference: 'Image Scanning — Ignoring Known Vulnerabilities section.'
    }
  ],

  flashcards: [
    {
      front: 'What are the key Trivy commands for CKS?',
      back: '# Basic scan:\ntrivy image nginx:1.25\n\n# Filter by severity:\ntrivy image --severity HIGH,CRITICAL nginx:1.25\n\n# Fail CI on critical:\ntrivy image --exit-code 1 --severity CRITICAL myapp:latest\n\n# JSON output:\ntrivy image -f json -o results.json myapp:latest\n\n# Scan Dockerfile misconfigs:\ntrivy config Dockerfile\n\n# Scan for secrets:\ntrivy image --scanners secret myapp:latest\n\n# Scan filesystem:\ntrivy fs --scanners vuln,secret ./myapp/'
    },
    {
      front: 'What are the Trivy vulnerability statuses and what do they mean?',
      back: 'fixed: A patched version exists → update to fixed version\n\nwill_not_fix: Maintainer will not release a fix\n  → Accept risk or use alternative package\n\naffected: Vulnerability confirmed, no fix yet\n  → Monitor for update\n\nunder_investigation: Still being evaluated\n  → Check back later\n\nnot_affected: In the code but not exploitable\n  → Usually safe to ignore\n\nFor CKS: focus on fixed status with HIGH/CRITICAL severity'
    },
    {
      front: 'How do you integrate Trivy into a CI/CD pipeline to block builds?',
      back: '# In shell CI script:\ntrivy image --exit-code 1 --severity CRITICAL myapp:$TAG\nif [ $? -ne 0 ]; then\n  echo "CRITICAL vulnerabilities — blocking push"\n  exit 1\nfi\ndocker push myapp:$TAG\n\n# In GitHub Actions:\n- uses: aquasecurity/trivy-action@master\n  with:\n    image-ref: myapp:${{ github.sha }}\n    exit-code: 1\n    severity: CRITICAL,HIGH\n\n# Key: exit-code 1 makes Trivy exit 1 on finding vulnerabilities\n# CI sees non-zero exit → pipeline fails'
    },
    {
      front: 'What Trivy scan types exist and what does each check?',
      back: 'vuln: OS package CVEs + app dependency CVEs\n  (default scanner)\n\nconfig: Dockerfile misconfigs, K8s YAML issues\n  - Running as root, :latest tags, dangerous permissions\n\nsecret: Hardcoded credentials, API keys, tokens\n  in image layers or files\n\nlicense: License compliance of installed packages\n  - GPL, MIT, Apache license detection\n\nCombine: --scanners vuln,secret,config\n\ntrivy config: specifically for IaC files\ntrivy image --scanners config: for image layers'
    },
    {
      front: 'What is the difference between trivy image and trivy config?',
      back: 'trivy image <image>:\n- Scans container image layers\n- Checks: OS packages, app deps, secrets, misconfigs IN the image\n- Default scanner: vuln (CVEs)\n- Needs image to pull or be available locally\n\ntrivy config <path>:\n- Scans configuration files (IaC scanning)\n- Checks: Dockerfile, K8s YAML, Terraform, Helm charts\n- Looks for: misconfigurations, security issues in config\n- Does NOT need Docker/container runtime\n- Can scan a directory: trivy config .\n\nExample:\ntrivy image nginx:1.25          # checks CVEs in nginx\ntrivy config ./Dockerfile        # checks Dockerfile security'
    }
  ],

  lab: {
    scenario: 'The team needs to scan container images for vulnerabilities before deploying to the cluster. You need to use Trivy to scan an image, identify critical vulnerabilities, and create a process to block vulnerable images.',
    objective: 'Use Trivy to scan container images, interpret the results, and set up a simple policy to block images with CRITICAL vulnerabilities.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Install Trivy and perform a basic scan',
        instruction: `Install Trivy and scan the nginx image for vulnerabilities.

\`\`\`bash
# Install Trivy (if not already installed)
wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | \
  sudo gpg --dearmor -o /usr/share/keyrings/trivy.gpg

echo "deb [signed-by=/usr/share/keyrings/trivy.gpg] \
  https://aquasecurity.github.io/trivy-repo/deb \
  $(lsb_release -sc) main" | \
  sudo tee /etc/apt/sources.list.d/trivy.list

sudo apt-get update && sudo apt-get install -y trivy

# Verify installation
trivy --version

# Scan nginx:1.25 (or whatever version is available)
trivy image nginx:1.25 --severity HIGH,CRITICAL

# Save to JSON for analysis
trivy image nginx:1.25 -f json -o /tmp/nginx-scan.json
\`\`\``,
        hints: [
          'If Trivy needs to download the DB, it may take a few minutes the first time',
          'The --severity flag filters what is shown, not what is scanned'
        ],
        solution: `\`\`\`bash
trivy image nginx:1.25 --severity HIGH,CRITICAL 2>&1 | head -50
\`\`\``,
        verify: `\`\`\`bash
trivy --version | head -1
# Expected: Version: 0.xx.x

# Scan should produce output (even if no vulns = secure)
trivy image nginx:latest --severity CRITICAL 2>&1 | grep -E "Total|CRITICAL|nginx"
# Expected: shows scan results
\`\`\``
      },
      {
        title: 'Use Trivy in CI mode to fail on critical vulnerabilities',
        instruction: `Demonstrate how to use Trivy's exit code feature to gate deployments.

\`\`\`bash
# Create a simple "deployment gate" script
cat <<'EOF' > /tmp/scan-before-deploy.sh
#!/bin/bash
IMAGE=$1

if [ -z "$IMAGE" ]; then
  echo "Usage: $0 <image:tag>"
  exit 2
fi

echo "=== Scanning $IMAGE for CRITICAL vulnerabilities ==="
trivy image --exit-code 1 --severity CRITICAL --quiet "$IMAGE"

if [ $? -eq 0 ]; then
  echo "✅ No CRITICAL vulnerabilities — safe to deploy"
else
  echo "❌ CRITICAL vulnerabilities found — deployment blocked"
  exit 1
fi
EOF

chmod +x /tmp/scan-before-deploy.sh

# Test with a known image
/tmp/scan-before-deploy.sh nginx:alpine

# Check the exit code
echo "Exit code: $?"
\`\`\``,
        hints: [
          'Exit code 0 = passed (no CRITICAL vulnerabilities found)',
          'Exit code 1 = failed (CRITICAL vulnerabilities found)',
          'The --quiet flag reduces noise (only shows findings, not download progress)'
        ],
        solution: `\`\`\`bash
trivy image --exit-code 1 --severity CRITICAL --quiet nginx:alpine
echo "Scan exit code: $? (0=pass, 1=CRITICAL found)"
\`\`\``,
        verify: `\`\`\`bash
# Verify Trivy returns proper exit codes
trivy image --exit-code 1 --severity CRITICAL nginx:alpine
RESULT=$?
echo "nginx:alpine scan result: $RESULT"
# 0 = no CRITICAL vulnerabilities
# 1 = CRITICAL vulnerabilities found
# (either is a valid expected result)
\`\`\``
      },
      {
        title: 'Scan a Deployment\'s image in the cluster',
        instruction: `Find the image used by a running Deployment and scan it.

\`\`\`bash
# Find all images currently running in the cluster
kubectl get pods -A -o jsonpath='{range .items[*]}{.spec.containers[*].image}{"\n"}{end}' | sort -u

# Pick a specific deployment to scan
IMAGE=$(kubectl get deployment coredns -n kube-system \
  -o jsonpath='{.spec.template.spec.containers[0].image}')
echo "Scanning: $IMAGE"

# Scan the image
trivy image --severity HIGH,CRITICAL "$IMAGE"

# Count findings
echo ""
echo "=== Finding Summary ==="
trivy image --severity CRITICAL --quiet "$IMAGE" 2>&1 | grep -E "Total:|CRITICAL" | head -5
\`\`\``,
        hints: [
          'CoreDNS image is usually clean (well-maintained)',
          'If the image is not in a public registry, you may need to authenticate first',
          'trivy image can scan any pullable image'
        ],
        solution: `\`\`\`bash
IMAGE=$(kubectl get pods -n kube-system -l k8s-app=kube-dns -o jsonpath='{.items[0].spec.containers[0].image}' 2>/dev/null)
echo "Scanning: $IMAGE"
trivy image --severity HIGH,CRITICAL "$IMAGE" 2>&1 | tail -10
\`\`\``,
        verify: `\`\`\`bash
# Verify Trivy can scan a cluster image
trivy image --severity CRITICAL $(kubectl get pods -n kube-system -o jsonpath='{.items[0].spec.containers[0].image}') 2>&1 | grep -E "Total|CRITICAL|scan"
# Expected: Shows scan results (Total: X)
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Trivy returns "DB error: failed to download vulnerability DB"',
      difficulty: 'easy',
      symptom: 'Running trivy image fails with database download errors.',
      diagnosis: `\`\`\`bash
# Check Trivy DB status
trivy image --debug nginx:1.25 2>&1 | grep -i "database\|download\|error"

# Check if there's a cached DB
ls ~/.cache/trivy/db/

# Check network connectivity
curl -I https://ghcr.io
\`\`\``,
      solution: `\`\`\`bash
# Force DB download
trivy image --download-db-only

# If no internet (air-gapped):
# Download DB on connected machine
trivy image --download-db-only
# Copy ~/.cache/trivy/db/ to target machine

# Or use offline mode with existing DB
trivy image --skip-db-update nginx:1.25

# Or use a DB mirror
TRIVY_DB_REPOSITORY=ghcr.io/aquasecurity/trivy-db trivy image nginx:1.25

# In Kubernetes clusters without internet:
# Use trivy-operator which can work with an internal registry
\`\`\``
    },
    {
      title: 'Trivy scan shows 0 vulnerabilities but the image is old and should have CVEs',
      difficulty: 'medium',
      symptom: 'Trivy reports "Total: 0" for an old image that is known to have vulnerabilities.',
      diagnosis: `\`\`\`bash
# Check Trivy version and DB date
trivy --version
trivy image --debug nginx:1.23 2>&1 | grep "DB"

# Check if the image architecture matches
docker inspect nginx:1.23 | grep Architecture

# Try running with all severities
trivy image --severity CRITICAL,HIGH,MEDIUM,LOW,UNKNOWN nginx:1.23

# Check if trivy is scanning the right layers
trivy image --list-all-pkgs nginx:1.23
\`\`\``,
      solution: `**Possible causes:**

1. **Stale vulnerability database:**
\`\`\`bash
trivy image --download-db-only  # Force DB update
trivy image nginx:1.23
\`\`\`

2. **Wrong image architecture (e.g., arm64 on x86)**:
\`\`\`bash
# Specify architecture explicitly
trivy image --arch amd64 nginx:1.23
\`\`\`

3. **All vulnerabilities are actually fixed in this patch version:**
\`\`\`bash
# Compare with older version
trivy image nginx:1.22 vs trivy image nginx:1.23
# 1.22 might have more CVEs
\`\`\`

4. **Only checking CRITICAL but issues are HIGH/MEDIUM:**
\`\`\`bash
# Scan all severities
trivy image nginx:1.23  # no severity filter shows all
\`\`\``
    }
  ]
};
