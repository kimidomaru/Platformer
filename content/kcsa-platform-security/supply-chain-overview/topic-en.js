window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['kcsa-platform-security/supply-chain-overview'] = {
  theory: `# Supply Chain Security Overview

## Exam Relevance
> KCSA tests awareness of software supply chain risks and mitigations. Expect questions about image scanning, signing, SBOMs, and the overall supply chain threat landscape.

## What is the Software Supply Chain?

The software supply chain is the complete lifecycle of software from development to deployment:

\`\`\`
Developer Code → Dependencies → Build → Container Image → Registry → Kubernetes
      ↓               ↓           ↓           ↓               ↓            ↓
   Source code    npm/pip pkgs   CI/CD      Docker layers   Registry     Running Pod
   (SAST scan)    (SCA scan)   (pipeline    (image scan)    (access      (runtime
                               signing)                      control)     security)
\`\`\`

### Why Supply Chain Security Matters

**SolarWinds (2020)**: Attackers inserted malicious code into a legitimate software build pipeline → distributed to 18,000+ organizations via official update channel.

**Log4Shell (2021)**: A vulnerability in a widely-used library (Log4j) affected thousands of applications that had no direct awareness of the dependency.

**Codecov Bash Uploader (2021)**: Compromised CI tool modified customer code during build.

These attacks bypass traditional perimeter security — the threat comes from inside the trusted software itself.

## Supply Chain Threats in Kubernetes

| Stage | Threat | Example |
|-------|--------|---------|
| **Code** | Malicious commit, vulnerable dependency | Typosquatted npm package |
| **Build** | Compromised CI pipeline | SolarWinds build tampering |
| **Image** | Malicious base image, bloated layers | Typosquatted Docker image |
| **Registry** | Image tampering in transit, unauthorized push | MITM replacing image tag |
| **Deployment** | Deploying unverified/unscanned images | No admission policy |
| **Runtime** | Compromised running container | Cryptominer injection |

## Container Image Security

### Image Scanning (Static)

\`\`\`bash
# Trivy (most popular open-source scanner)
trivy image nginx:latest
trivy image --severity HIGH,CRITICAL nginx:latest
trivy image --exit-code 1 --severity CRITICAL nginx:latest  # fail CI on CRITICAL

# Scan a Dockerfile
trivy config Dockerfile

# Output formats
trivy image --format json nginx:latest > results.json
trivy image --format table nginx:latest

# Other scanners
grype nginx:latest
snyk container test nginx:latest
\`\`\`

### What Image Scanners Check
- **OS packages** (apt, apk, rpm) — known CVEs in installed packages
- **Language packages** (npm, pip, maven, go modules)
- **Secrets in image layers** — accidentally committed credentials
- **Dockerfile misconfigurations** — root user, no HEALTHCHECK, etc.

### Image Signing with Sigstore/Cosign

\`\`\`bash
# Sign an image with Cosign
cosign sign --key cosign.key registry.example.com/myapp:v1.0

# Verify signature
cosign verify --key cosign.pub registry.example.com/myapp:v1.0

# Keyless signing (uses OIDC/Fulcio CA — no private key needed)
cosign sign registry.example.com/myapp:v1.0

# Verify keyless signature
cosign verify \\
  --certificate-identity-regexp=".*@company.com" \\
  --certificate-oidc-issuer="https://accounts.google.com" \\
  registry.example.com/myapp:v1.0
\`\`\`

### Admission Policy for Signed Images

\`\`\`yaml
# Kyverno: verify Cosign signatures before deployment
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-image-signatures
spec:
  validationFailureAction: Enforce
  rules:
    - name: verify-signature
      match:
        any:
        - resources:
            kinds: ["Pod"]
      verifyImages:
        - imageReferences:
            - "registry.example.com/*"
          attestors:
            - entries:
                - keys:
                    publicKeys: |-
                      -----BEGIN PUBLIC KEY-----
                      <cosign.pub contents>
                      -----END PUBLIC KEY-----
\`\`\`

## SBOM — Software Bill of Materials

An SBOM is a comprehensive list of all software components in an artifact.

\`\`\`bash
# Generate SBOM for a container image
syft nginx:latest -o cyclonedx-json > nginx-sbom.json
syft nginx:latest -o spdx-json > nginx-sbom.spdx

# Or with Trivy
trivy sbom --format cyclonedx nginx:latest

# Attach SBOM to image with Cosign
cosign attach sbom --sbom nginx-sbom.spdx registry.example.com/nginx:latest
cosign verify-attestation --type cyclonedx registry.example.com/nginx:latest
\`\`\`

**SBOM formats:**
- **CycloneDX** — popular, machine-readable
- **SPDX** — Linux Foundation standard
- **SWID** — (software identification tags)

## Secure CI/CD Pipeline

\`\`\`
1. Code commit (developer)
   ↓ SAST scan, secrets detection (GitLeaks)

2. Build (CI system)
   ↓ Dependency check (SCA: Snyk, OWASP DC)
   ↓ Container build (minimal image)
   ↓ Image scan (Trivy, Grype) — block on CRITICAL
   ↓ SBOM generation
   ↓ Image signing (Cosign)
   ↓ Push to registry

3. Deploy (CD/GitOps)
   ↓ Admission webhook verifies signature
   ↓ Kubernetes applies workload
\`\`\`

## Minimal Container Images

\`\`\`dockerfile
# Multi-stage build for minimal image
FROM golang:1.21 AS builder
COPY . .
RUN go build -o /app main.go

# Final stage: distroless (no shell, no package manager)
FROM gcr.io/distroless/static-debian11
COPY --from=builder /app /app
USER 65532:65532    # non-root
ENTRYPOINT ["/app"]
\`\`\`

### Minimal Base Image Options
| Image | Size | Shell | Package Manager |
|-------|------|-------|-----------------|
| **distroless** | ~2MB | No | No |
| **scratch** | 0 | No | No |
| **Alpine** | ~5MB | Yes | apk |
| **Ubuntu Slim** | ~30MB | Yes | apt |
| **Ubuntu** | ~80MB | Yes | apt |

**Fewer packages = fewer vulnerabilities.**

## Registry Security

\`\`\`
Controls:
✅ Use private registry (not Docker Hub for production)
✅ Enable registry authentication
✅ Scan images in registry (automated)
✅ Immutable tags (prevent tag overwrites)
✅ Content trust / signature verification
✅ Quarantine images with CRITICAL CVEs
✅ Retention policies (clean old images)
\`\`\`

## SLSA Framework (Supply-chain Levels for Software Artifacts)

SLSA defines 4 levels of supply chain security:

| Level | Requirements |
|-------|-------------|
| **SLSA 1** | Documented build process |
| **SLSA 2** | Signed provenance from build service |
| **SLSA 3** | Source and build are hardened, audited |
| **SLSA 4** | Two-person review, hermetic build |

## Key CNCF Projects for Supply Chain Security

| Project | Purpose |
|---------|---------|
| **Sigstore** | Free-to-use signing infrastructure (Cosign, Fulcio, Rekor) |
| **Cosign** | Container image signing/verification |
| **Trivy** | Container and config scanning |
| **ORAS** | OCI registry artifact manipulation |
| **in-toto** | Framework for securing software supply chains |
| **The Update Framework (TUF)** | Secure software updates |
| **Notary v2** | Container signing |
`,
  quiz: [
    {
      question: 'What is a software supply chain attack?',
      options: [
        'An attack that compromises software during the build, distribution, or update process before it reaches the end user',
        'An attack that disrupts the Kubernetes API server\'s request queue',
        'An attack that steals Kubernetes credentials from a registry',
        'A DoS attack targeting a software vendor\'s website'
      ],
      correct: 0,
      explanation: 'Supply chain attacks target software before it\'s deployed — compromising build pipelines, inserting malicious code into dependencies, or tampering with container images. SolarWinds and Log4Shell are famous examples.',
      reference: 'Review "Why Supply Chain Security Matters" section.'
    },
    {
      question: 'What is the primary purpose of signing a container image with Cosign?',
      options: [
        'To cryptographically verify that the image was built by a trusted source and hasn\'t been tampered with',
        'To encrypt the image contents during registry transfer',
        'To compress the image layers for faster deployment',
        'To attach metadata about the image\'s CVE scan results'
      ],
      correct: 0,
      explanation: 'Cosign creates a cryptographic signature for container images. The signature can be verified at deploy time (via admission webhook) to ensure only trusted, unmodified images run in the cluster.',
      reference: 'Review "Image Signing with Sigstore/Cosign" section.'
    },
    {
      question: 'What is an SBOM (Software Bill of Materials)?',
      options: [
        'A comprehensive list of all software components, libraries, and dependencies in an artifact',
        'A bill for the cloud costs associated with running a software container',
        'A security report summarizing CVEs found in a container image',
        'A manifest file listing Kubernetes resources in an application'
      ],
      correct: 0,
      explanation: 'An SBOM is a machine-readable list of all components in software (like an ingredients list). Used for vulnerability management — when a new CVE is published, you can quickly find which images/apps are affected.',
      reference: 'Review "SBOM — Software Bill of Materials" section.'
    },
    {
      question: 'What makes distroless container images more secure than Ubuntu-based images?',
      options: [
        'They contain only the application and its runtime dependencies — no shell, no package manager, fewer potential vulnerabilities',
        'They use a different Linux kernel that prevents container escapes',
        'They automatically apply security patches without a rebuild',
        'They use hardware encryption for container layer storage'
      ],
      correct: 0,
      explanation: 'Distroless images contain only what\'s needed to run the app. No shell means an attacker who gains code execution can\'t easily explore the container. No package manager means no trivial way to download tools. Fewer packages = fewer CVEs.',
      reference: 'Review "Minimal Base Image Options" table.'
    },
    {
      question: 'At what stage in the CI/CD pipeline should container image scanning occur?',
      options: [
        'In the CI pipeline before pushing to the registry — block on CRITICAL vulnerabilities',
        'Only in production clusters via admission webhooks',
        'After deployment, via a nightly scan of running pods',
        'During code review, before the build step'
      ],
      correct: 0,
      explanation: 'Image scanning should happen in CI (build-time) to fail fast and prevent vulnerable images from being pushed. Additionally, production registries should scan on push, and admission webhooks can enforce scan requirements at deploy time.',
      reference: 'Review "Secure CI/CD Pipeline" section.'
    },
    {
      question: 'What is SLSA (Supply-chain Levels for Software Artifacts)?',
      options: [
        'A framework defining levels (1-4) of supply chain security requirements for software artifacts',
        'A tool for scanning container images for supply chain vulnerabilities',
        'A Kubernetes admission controller for supply chain enforcement',
        'A container signing standard from the Linux Foundation'
      ],
      correct: 0,
      explanation: 'SLSA defines four levels of supply chain security from basic documentation (L1) to two-person review with hermetic builds (L4). It provides a common vocabulary for supply chain maturity.',
      reference: 'Review "SLSA Framework" section.'
    },
    {
      question: 'What is the Sigstore project?',
      options: [
        'A free-to-use signing infrastructure project (Cosign for signing, Fulcio for certificates, Rekor for transparency log)',
        'A Kubernetes registry plugin for secure image storage',
        'An open-source SBOM generation and management tool',
        'A CNCF project for scanning containers for secrets'
      ],
      correct: 0,
      explanation: 'Sigstore is a CNCF project providing free keyless signing infrastructure: Cosign (signing tool), Fulcio (CA for short-lived certificates), Rekor (tamper-proof transparency log). Makes signing accessible without key management.',
      reference: 'Review "Key CNCF Projects for Supply Chain Security" table.'
    },
    {
      question: 'What does "trivy image --exit-code 1 --severity CRITICAL nginx:latest" do in a CI pipeline?',
      options: [
        'Scans nginx:latest and returns exit code 1 (failure) if any CRITICAL vulnerabilities are found — causing CI to fail',
        'Scans and automatically patches CRITICAL vulnerabilities in the image',
        'Blocks the image from being pushed to the registry',
        'Generates a CRITICAL severity CVE report and uploads it to the registry'
      ],
      correct: 0,
      explanation: 'The --exit-code 1 flag makes Trivy return a non-zero exit code when vulnerabilities of the specified severity are found. CI systems check exit codes — non-zero = failure, which stops the pipeline from pushing the vulnerable image.',
      reference: 'Review "Image Scanning (Static)" — Trivy CLI examples.'
    }
  ],
  flashcards: [
    {
      front: 'What are the key stages of the container supply chain?',
      back: 'Code → Dependencies (SCA scan) → Build (CI, Trivy scan) → Image (sign, SBOM) → Registry (access control, scan) → Deploy (admission verification) → Runtime (Falco detection). Security at each stage.'
    },
    {
      front: 'What is Cosign and how does it work?',
      back: 'Cosign (Sigstore project) signs container images with cryptographic signatures. Sign: cosign sign --key key.priv image:tag. Verify: cosign verify --key key.pub image:tag. Keyless mode uses OIDC + Fulcio CA for no-private-key signing.'
    },
    {
      front: 'What is the difference between image scanning and image signing?',
      back: 'Image scanning: checks content for CVEs and misconfigs (Trivy, Grype, Snyk). Performed before pushing. Image signing: cryptographic proof of identity and integrity (Cosign). Verified at deploy time. Both are needed for supply chain security.'
    },
    {
      front: 'What are the two main SBOM formats?',
      back: 'CycloneDX: machine-readable, popular in security tooling. SPDX: Linux Foundation standard, government-required. Both can be generated with Syft or Trivy and attached to images with Cosign attestations.'
    },
    {
      front: 'What is SLSA and what is Level 4?',
      back: 'SLSA (Supply-chain Levels for Software Artifacts) defines 4 levels. Level 4: two-person review of all changes, hermetic (reproducible) builds, complete provenance chain. The most rigorous supply chain security level.'
    },
    {
      front: 'How do distroless images reduce the attack surface?',
      back: 'Distroless images contain only the app and its runtime (no shell /bin/sh, no package manager, no system tools). No shell = harder for attackers to explore after code execution. Fewer packages = fewer CVEs. Minimal attack surface.'
    }
  ],
  lab: {
    scenario: 'Explore supply chain security by scanning images with Trivy and understanding how signing and admission policies work together.',
    objective: 'Practice image scanning, understand vulnerabilities, and see how supply chain controls are enforced.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Scan container images for vulnerabilities',
        instruction: `Use Trivy to scan container images for CVEs. Compare a minimal (distroless) image with a large base image to understand the supply chain security benefit of minimal images.`,
        hints: [
          'If Trivy is not installed: kubectl run trivy --image=aquasec/trivy ... for in-cluster use',
          'Compare: nginx:latest vs gcr.io/distroless/static-debian11',
          'Use --severity HIGH,CRITICAL to filter results'
        ],
        solution: `\`\`\`bash
# Option 1: If trivy is installed locally
# trivy image nginx:latest --severity HIGH,CRITICAL

# Option 2: Use Trivy in a pod (works in any cluster)
kubectl run trivy-scan \\
  --image=aquasec/trivy:latest \\
  --restart=Never \\
  --env=TRIVY_NO_PROGRESS=true \\
  -- image --severity HIGH,CRITICAL nginx:1.20

# Wait for completion
kubectl wait pod/trivy-scan --for=condition=Ready --timeout=120s 2>/dev/null || true
kubectl logs trivy-scan 2>/dev/null | tail -30

# Compare with minimal image scan
kubectl run trivy-scan-minimal \\
  --image=aquasec/trivy:latest \\
  --restart=Never \\
  --env=TRIVY_NO_PROGRESS=true \\
  -- image --severity HIGH,CRITICAL gcr.io/distroless/static-debian11 2>/dev/null
\`\`\``,
        verify: `\`\`\`bash
kubectl get pod trivy-scan trivy-scan-minimal 2>/dev/null
# Expected: shows Completed status

# Check results
kubectl logs trivy-scan 2>/dev/null | grep -E "Total:|CRITICAL:|HIGH:" | tail -5
kubectl logs trivy-scan-minimal 2>/dev/null | grep -E "Total:|CRITICAL:|HIGH:" | tail -5

# Expected: nginx has more CVEs than distroless (distroless has very few)

# Cleanup
kubectl delete pod trivy-scan trivy-scan-minimal 2>/dev/null
\`\`\``
      },
      {
        title: 'Understand image tags vs digests for supply chain security',
        instruction: `Demonstrate the security difference between using an image tag (mutable) vs an image digest (immutable). Show how digest-pinning prevents supply chain attacks.`,
        hints: [
          'kubectl run with image:tag vs image@sha256:digest',
          'docker inspect or kubectl get pod -o yaml shows the resolved digest',
          'Digests are immutable — same hash = same bytes = verified content'
        ],
        solution: `\`\`\`bash
# Get the digest for nginx:1.20
DIGEST=$(kubectl run temp-dig --image=nginx:1.20 --restart=Never --dry-run=client -o yaml 2>/dev/null | grep "image:" | head -1 | awk '{print $2}')
echo "Image: $DIGEST"

# Create pod using mutable tag (risky)
kubectl run tag-pod --image=nginx:1.20 --restart=Never
kubectl wait pod/tag-pod --for=condition=Ready --timeout=60s

# Get the actual digest being used
kubectl get pod tag-pod -o jsonpath='{.status.containerStatuses[0].imageID}'
echo ""
echo ""

# The digest above is what's actually running
# Now demonstrate pinning by digest
RESOLVED_DIGEST=$(kubectl get pod tag-pod -o jsonpath='{.status.containerStatuses[0].imageID}' | cut -d@ -f2)
echo "Pinned digest: $RESOLVED_DIGEST"
echo ""
echo "Using digest: kubectl run pinned-pod --image=nginx@\${RESOLVED_DIGEST}"
echo "This is immutable — no supply chain tag-swap attack possible"
\`\`\``,
        verify: `\`\`\`bash
kubectl get pod tag-pod -o jsonpath='{.status.containerStatuses[0].imageID}'
# Expected: shows docker-pullable://nginx@sha256:... (actual digest used)

echo ""
echo "Key insight: Even with tag nginx:1.20, K8s records the actual digest."
echo "Pinning by digest in your YAML prevents attackers from replacing the"
echo "image behind the tag without you knowing."

# Cleanup
kubectl delete pod tag-pod
\`\`\``
      },
      {
        title: 'Create a namespace-level image registry restriction',
        instruction: `Create a Kyverno-style ClusterPolicy pattern (or use PSS) to restrict which container registries are allowed. Show how admission control enforces supply chain policies.`,
        hints: [
          'Without Kyverno, demonstrate the concept with a ValidatingWebhookConfiguration manifest',
          'Or use PSS enforce=restricted which requires specific image standards',
          'Show the YAML structure of an image registry restriction policy'
        ],
        solution: `\`\`\`bash
# Demonstrate registry restriction policy structure
# (This shows what Kyverno/OPA policy would look like)

cat <<'EOF' > /tmp/registry-policy.yaml
# Kyverno ClusterPolicy to restrict to approved registries
# (Requires Kyverno to be installed to enforce)
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: restrict-image-registries
spec:
  validationFailureAction: Audit  # Change to Enforce when ready
  rules:
    - name: validate-registries
      match:
        any:
        - resources:
            kinds: ["Pod"]
      validate:
        message: "Only images from approved registries are allowed: registry.company.com, gcr.io/distroless"
        pattern:
          spec:
            =(initContainers):
              - image: "registry.company.com/* | gcr.io/distroless/*"
            containers:
              - image: "registry.company.com/* | gcr.io/distroless/*"
EOF

cat /tmp/registry-policy.yaml
echo ""
echo "When applied with Kyverno, this would:"
echo "  - Audit mode: log all pods using non-approved registries"
echo "  - Enforce mode: BLOCK pods using non-approved registries"
\`\`\``,
        verify: `\`\`\`bash
# Verify the policy YAML structure is valid
cat /tmp/registry-policy.yaml | python3 -c "import sys,yaml; yaml.safe_load(sys.stdin); print('Valid YAML structure')"

# Check if Kyverno is installed
kubectl get pods -n kyverno 2>/dev/null | head -5 || echo "Kyverno not installed in this lab"

echo ""
echo "Supply Chain Security Summary:"
echo "1. Scan images with Trivy before pushing (CI gate)"
echo "2. Use minimal base images (fewer CVEs)"
echo "3. Sign images with Cosign after scan passes"
echo "4. Admission webhook verifies signatures before deploy"
echo "5. Restrict to approved registries via admission policy"
echo "6. Generate SBOM and attach to image"
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'CI pipeline blocked by image vulnerabilities',
      difficulty: 'easy',
      symptom: 'CI/CD pipeline fails with: "CRITICAL: 15 vulnerabilities found in base image. Pipeline blocked." The team needs to deploy urgently but can\'t resolve all vulnerabilities immediately.',
      diagnosis: `\`\`\`bash
# Identify exactly what's vulnerable
trivy image <image>:tag --severity CRITICAL --format json | \\
  python3 -c "
import json, sys
results = json.load(sys.stdin)
for r in results.get('Results', []):
  for v in r.get('Vulnerabilities', []):
    if v.get('Severity') == 'CRITICAL':
      print(f'{v[\"VulnerabilityID\"]} | {v[\"PkgName\"]} | {v[\"InstalledVersion\"]} → {v.get(\"FixedVersion\", \"no fix\")}')
"

# Check if fixes are available
# Look for "FixedVersion" — if None, no patch available yet
\`\`\``,
      solution: `Short-term (for urgent deploy):
1. **Upgrade base image** to get patched OS packages:
\`\`\`dockerfile
# Instead of:
FROM ubuntu:20.04
# Use latest security-patched version:
FROM ubuntu:22.04
# Or add after FROM:
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*
\`\`\`

2. **Accept risk** for CVEs with no fix (document in security exception):
\`\`\`bash
trivy image --severity CRITICAL --ignore-unfixed <image>:tag
# Only fails on fixable vulnerabilities
\`\`\`

3. **Switch to distroless/minimal** to eliminate OS-level CVEs:
\`\`\`dockerfile
FROM gcr.io/distroless/java17:nonroot
\`\`\`

Long-term: Set up automated base image updates (Renovate Bot) and weekly rebuild pipeline.`
    },
    {
      title: 'Image signature verification failing in production',
      difficulty: 'hard',
      symptom: 'After implementing Cosign image verification via Kyverno, deployments fail with: "image signature verification failed: no valid signatures found"',
      diagnosis: `\`\`\`bash
# Check what the policy expects
kubectl get clusterpolicy verify-signatures -o yaml | grep -A10 "verifyImages"

# Check if the image is actually signed
cosign verify \\
  --certificate-identity-regexp=".*@company.com" \\
  --certificate-oidc-issuer="https://accounts.google.com" \\
  registry.company.com/myapp:v1

# List signatures for the image
cosign triangulate registry.company.com/myapp:v1

# Check registry connectivity
kubectl run check --image=curlimages/curl --rm -it --restart=Never -- \\
  curl -s https://registry.company.com/v2/
\`\`\``,
      solution: `1. **Image was never signed** — add signing to CI pipeline:
\`\`\`bash
cosign sign --key cosign.key registry.company.com/myapp:v1
\`\`\`

2. **Wrong key in policy** — verify the public key matches:
\`\`\`bash
# Extract public key from private key
cosign public-key --key cosign.key > cosign.pub
cat cosign.pub
# Compare with key in Kyverno policy
\`\`\`

3. **Registry doesn't store signatures** (OCI 1.0 registries):
\`\`\`bash
# Set COSIGN_REPOSITORY to store signatures separately
COSIGN_REPOSITORY=registry.company.com/signatures cosign sign ...
\`\`\`

4. **Emergency bypass** (temporary):
\`\`\`bash
kubectl patch clusterpolicy verify-signatures \\
  --type=merge \\
  -p '{"spec":{"validationFailureAction":"Audit"}}'
\`\`\`

Then fix the signing pipeline and switch back to Enforce.`
    }
  ]
};
