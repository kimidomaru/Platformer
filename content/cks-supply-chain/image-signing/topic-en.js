window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['cks-supply-chain/image-signing'] = {
  theory: `# Container Image Signing with Cosign

## Exam Relevance
> CKS expects you to sign and verify container images using Cosign, understand the Sigstore ecosystem, and configure admission policies to only allow signed images. Appears in Supply Chain Security domain (~8%).

## Why Sign Container Images?

Without image signing, anyone with push access to a registry can replace an image with a malicious one — even with the same tag. Image signing provides:

1. **Authenticity**: The image was signed by a known identity
2. **Integrity**: The image has not been modified since signing
3. **Non-repudiation**: The signer cannot deny signing the image

\`\`\`
Without signing:
nginx:1.25 → registry → cluster (who actually built this?)

With Cosign signing:
nginx:1.25 → sign with key → registry + signature
           cluster ← verify signature ← admission controller
\`\`\`

## Sigstore Ecosystem

**Sigstore** is an open-source project (Linux Foundation) providing free code signing infrastructure:

| Component | Role |
|-----------|------|
| **Cosign** | CLI tool for signing/verifying images and artifacts |
| **Fulcio** | Certificate Authority — issues short-lived signing certs from OIDC identity |
| **Rekor** | Transparency log — immutable record of all signatures |

## Cosign Signing Methods

### Method 1: Key-Based Signing

\`\`\`bash
# Install cosign
brew install cosign  # macOS
# Or:
wget https://github.com/sigstore/cosign/releases/download/v2.2.2/cosign-linux-amd64
sudo mv cosign-linux-amd64 /usr/local/bin/cosign
chmod +x /usr/local/bin/cosign

# Generate a key pair
cosign generate-key-pair
# Creates: cosign.key (private) and cosign.pub (public)
# cosign.key is password-protected

# Sign an image (must be pushed to registry first)
cosign sign --key cosign.key myregistry.io/myapp:1.0

# Verify the signature
cosign verify --key cosign.pub myregistry.io/myapp:1.0

# Verify and inspect the signature details
cosign verify --key cosign.pub myregistry.io/myapp:1.0 | python3 -m json.tool
\`\`\`

### Method 2: Keyless Signing (Sigstore)

\`\`\`bash
# Keyless signing uses OIDC identity (GitHub Actions, GitLab CI, Google Workload Identity)
# No long-lived private key needed!

# In GitHub Actions:
cosign sign \
  --oidc-issuer=https://token.actions.githubusercontent.com \
  myregistry.io/myapp:\${{ github.sha }}

# Verify keyless signature
cosign verify \
  --certificate-oidc-issuer=https://token.actions.githubusercontent.com \
  --certificate-identity=https://github.com/myorg/myrepo/.github/workflows/build.yml@refs/heads/main \
  myregistry.io/myapp:latest
\`\`\`

**How keyless works:**
1. CI system gets an OIDC token (e.g., from GitHub Actions)
2. Cosign exchanges OIDC token with Fulcio for a short-lived certificate
3. Image is signed with the ephemeral certificate
4. Signature + certificate recorded in Rekor transparency log
5. No long-lived private key needed!

## Where Signatures are Stored

\`\`\`bash
# Cosign stores signatures in the OCI registry as separate tags:
# myapp:sha256-abc123.sig

# List all tags including signatures
crane ls myregistry.io/myapp

# Inspect a signature
cosign download signature myregistry.io/myapp:1.0
\`\`\`

## Sign SBOM and Attestations

\`\`\`bash
# Sign a SBOM attestation
cosign attest --key cosign.key \
  --type cyclonedx \
  --predicate sbom.json \
  myregistry.io/myapp:1.0

# Verify the attestation
cosign verify-attestation --key cosign.pub \
  --type cyclonedx \
  myregistry.io/myapp:1.0

# Sign a vulnerability scan result
cosign attest --key cosign.key \
  --type vuln \
  --predicate trivy-results.json \
  myregistry.io/myapp:1.0
\`\`\`

## Kubernetes Admission: Enforce Signed Images

### With Kyverno

\`\`\`yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-signed-images
spec:
  validationFailureAction: Enforce
  background: false
  rules:
  - name: verify-signature
    match:
      any:
      - resources:
          kinds: ["Pod"]
    verifyImages:
    - imageReferences:
      - "myregistry.io/*"
      attestors:
      - count: 1
        entries:
        - keys:
            publicKeys: |-
              -----BEGIN PUBLIC KEY-----
              MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...
              -----END PUBLIC KEY-----
\`\`\`

\`\`\`bash
# Test the policy: deploy with unsigned image (should fail)
kubectl run unsigned --image=nginx:latest
# Error: image not signed

# Deploy with signed image (should succeed)
kubectl run signed --image=myregistry.io/myapp:1.0
\`\`\`

### With OPA Gatekeeper (Policy Controller)

\`\`\`yaml
# Use Gatekeeper with Cosign verification
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8sverifysignature
spec:
  crd:
    spec:
      names:
        kind: K8sVerifySignature
  targets:
  - target: admission.k8s.gatekeeper.sh
    rego: |
      package k8sverifysignature
      violation[{"msg": msg}] {
        container := input.review.object.spec.containers[_]
        not image_is_signed(container.image)
        msg := sprintf("Image %v is not signed", [container.image])
      }
      # Note: Gatekeeper alone cannot verify cosign signatures
      # Use Kyverno or Policy Controller for real cosign integration
\`\`\`

### With Sigstore Policy Controller

\`\`\`yaml
# ClusterImagePolicy (Sigstore Policy Controller)
apiVersion: policy.sigstore.dev/v1beta1
kind: ClusterImagePolicy
metadata:
  name: require-signed-production
spec:
  images:
  - glob: "myregistry.io/**"
  authorities:
  - key:
      data: |
        -----BEGIN PUBLIC KEY-----
        MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...
        -----END PUBLIC KEY-----
  - keyless:
      url: https://fulcio.sigstore.dev
      identities:
      - issuer: https://token.actions.githubusercontent.com
        subject: "https://github.com/myorg/myrepo/.github/workflows/release.yml@refs/tags/*"
\`\`\`

## Key Management

\`\`\`bash
# Generate Cosign key pair
cosign generate-key-pair
# Input: passphrase for private key

# Store key pair in Kubernetes Secret
kubectl create secret generic cosign-keys \
  --from-file=cosign.key \
  --from-file=cosign.pub \
  -n cosign

# Sign with key stored in KMS (production recommended)
cosign sign --key gcpkms://projects/myproject/locations/global/keyRings/myring/cryptoKeys/mykey/cryptoKeyVersions/1 myimage:latest

cosign sign --key awskms:///alias/my-cosign-key myimage:latest
cosign sign --key hashivault://path/to/key myimage:latest
\`\`\`

## Verifying in CI/CD

\`\`\`bash
# Full CI/CD pipeline example
# Step 1: Build image
docker build -t myregistry.io/myapp:$COMMIT .

# Step 2: Push image
docker push myregistry.io/myapp:$COMMIT

# Step 3: Scan for vulnerabilities
trivy image --exit-code 1 --severity CRITICAL myregistry.io/myapp:$COMMIT

# Step 4: Sign the image (only after successful scan!)
cosign sign --key $COSIGN_KEY myregistry.io/myapp:$COMMIT

# Step 5: Tag as latest (only signed and scanned images)
docker tag myregistry.io/myapp:$COMMIT myregistry.io/myapp:latest
docker push myregistry.io/myapp:latest
cosign sign --key $COSIGN_KEY myregistry.io/myapp:latest
\`\`\`

## Common Mistakes

- **Signing before scanning**: Sign only after vulnerability scan passes
- **Using :latest for signed images**: Signatures are per-digest — :latest is mutable; sign specific versions
- **Storing private key unprotected**: cosign.key must be protected with a passphrase and stored in a vault
- **Not verifying before deployment**: Signing alone doesn't help if you don't verify at admission time

## Killer.sh Style Challenge

> **Scenario**: Generate a Cosign key pair, sign the image "myregistry.io/webapp:1.0", and verify the signature. Then write a Kyverno ClusterPolicy that requires all pods in the "production" namespace to use images signed with your public key.
`,

  quiz: [
    {
      question: 'What are the 3 components of the Sigstore ecosystem?',
      options: [
        'Cosign (CLI signing tool), Fulcio (CA for short-lived certs), Rekor (transparency log)',
        'Cosign (signing), Trivy (scanning), Kyverno (enforcement)',
        'Sigstore (signing), SLSA (provenance), OPA (policy)',
        'Cosign (signing), Vault (key management), Harbor (registry)'
      ],
      correct: 0,
      explanation: 'Sigstore is a Linux Foundation project with three components: Cosign (CLI tool for signing/verifying), Fulcio (CA that issues short-lived certificates tied to OIDC identities), and Rekor (immutable transparency log that records all signing operations).',
      reference: 'Image Signing — Sigstore Ecosystem table.'
    },
    {
      question: 'How does keyless signing (Cosign) work without a long-lived private key?',
      options: [
        'OIDC identity token is exchanged for a short-lived certificate from Fulcio, used to sign the image, then recorded in Rekor',
        'A shared cluster private key stored in a Kubernetes Secret is used for all keyless signatures',
        'The image digest is used as the signing key (self-signed)',
        'Keyless signing uses mutual TLS from the registry to authenticate the signer'
      ],
      correct: 0,
      explanation: 'In keyless signing: (1) CI system presents OIDC token (from GitHub Actions, etc.) to Fulcio, (2) Fulcio issues a short-lived X.509 certificate bound to the OIDC identity, (3) Image is signed with the ephemeral certificate, (4) Certificate and signature are recorded in Rekor for auditability. No persistent private key needed.',
      reference: 'Image Signing — Method 2: Keyless Signing section.'
    },
    {
      question: 'Where does Cosign store image signatures?',
      options: [
        'In the OCI registry as a separate tag (e.g., sha256-abc123.sig)',
        'In a Kubernetes Secret named cosign-signatures',
        'In the Rekor transparency log only — not in the registry',
        'Embedded in the image manifest directly'
      ],
      correct: 0,
      explanation: 'Cosign stores signatures in the same OCI registry as the image, as a separate artifact with a tag derived from the image digest (e.g., sha256-abc123.sig). This means signatures travel with the image when the image is copied to another registry.',
      reference: 'Image Signing — Where Signatures are Stored section.'
    },
    {
      question: 'What command generates a Cosign key pair for key-based signing?',
      options: [
        'cosign generate-key-pair',
        'cosign keygen --output cosign.key',
        'openssl genrsa -out cosign.key && cosign convert cosign.key',
        'cosign init --create-keys'
      ],
      correct: 0,
      explanation: '"cosign generate-key-pair" creates cosign.key (private, passphrase-protected) and cosign.pub (public). The public key is used for verification. Store cosign.key securely — it should be in a vault or KMS for production use.',
      reference: 'Image Signing — Method 1: Key-Based Signing section.'
    },
    {
      question: 'In a Kyverno ClusterPolicy with verifyImages, what happens when an image without a matching signature is deployed?',
      options: [
        'The Pod creation is rejected with "image not verified" error (when validationFailureAction: Enforce)',
        'The Pod starts but a warning annotation is added',
        'Kyverno quarantines the Pod in a restricted namespace',
        'Kyverno deletes the image from the registry'
      ],
      correct: 0,
      explanation: 'With validationFailureAction: Enforce, Kyverno rejects the Pod creation entirely if the image signature cannot be verified. The user gets an admission webhook rejection error. With Audit mode, the pod would run but the violation would be logged.',
      reference: 'Image Signing — With Kyverno section.'
    },
    {
      question: 'What is the correct order for a secure CI/CD pipeline with signing?',
      options: [
        'Build → Push → Scan → Sign (sign only after scan passes)',
        'Build → Sign → Push → Scan (sign before push)',
        'Scan → Build → Push → Sign',
        'Build → Sign → Scan → Push'
      ],
      correct: 0,
      explanation: 'Sign AFTER scanning: if you sign before scanning and then find critical vulnerabilities, you now have a signed vulnerable image. Signing after a successful scan means the signature attests "this image was scanned and found clean." This provides stronger guarantees.',
      reference: 'Image Signing — Verifying in CI/CD section.'
    },
    {
      question: 'What is a Cosign attestation (cosign attest)?',
      options: [
        'A signed claim attached to an image — can contain SBOM, vulnerability scan results, or build provenance',
        'A certificate that proves the image registry trusts the signer',
        'A Kubernetes admission webhook that verifies signatures',
        'A transparency log entry that records when an image was deployed'
      ],
      correct: 0,
      explanation: 'Cosign attestations (OCI DSSE envelopes) allow you to attach signed metadata to an image. Common attestations: CycloneDX SBOM (what\'s in the image), vulnerability scan results (was it scanned?), SLSA provenance (how was it built?). They can be verified with cosign verify-attestation.',
      reference: 'Image Signing — Sign SBOM and Attestations section.'
    },
    {
      question: 'Why should you avoid signing images with the :latest tag?',
      options: [
        ':latest is mutable — it can point to different digests over time. Signatures are per-digest, so signing :latest today doesn\'t guarantee signing tomorrow\'s :latest',
        ':latest tags are not supported by Cosign signing',
        'The registry rejects signatures on :latest due to concurrency issues',
        ':latest images are automatically signed by the registry'
      ],
      correct: 0,
      explanation: 'Image tags (including :latest) are mutable pointers. A digest (sha256:abc...) is immutable. Cosign signs by digest. If you sign :latest and someone pushes a new image to :latest, the old signature becomes orphaned. Sign specific version tags or digests for reliable verification.',
      reference: 'Image Signing — Common Mistakes section.'
    }
  ],

  flashcards: [
    {
      front: 'What are the Cosign signing and verification commands?',
      back: '# Generate key pair:\ncosign generate-key-pair\n# Creates: cosign.key (private) cosign.pub (public)\n\n# Sign image (key-based):\ncosign sign --key cosign.key myregistry.io/myapp:1.0\n\n# Verify image (key-based):\ncosign verify --key cosign.pub myregistry.io/myapp:1.0\n\n# Keyless sign (in CI):\ncosign sign --oidc-issuer=https://token.actions.githubusercontent.com myregistry.io/myapp:1.0\n\n# Keyless verify:\ncosign verify \\\n  --certificate-oidc-issuer=https://token.actions.githubusercontent.com \\\n  --certificate-identity=https://github.com/org/repo/.github/workflows/release.yml@refs/heads/main \\\n  myregistry.io/myapp:1.0'
    },
    {
      front: 'What are the 3 Sigstore components and their roles?',
      back: 'Cosign:\n- CLI tool for signing and verifying OCI artifacts\n- Key-based and keyless signing\n- Stores signatures in OCI registry\n\nFulcio:\n- Certificate Authority (CA)\n- Issues short-lived X.509 certs from OIDC identity\n- Used for keyless signing (no persistent key needed)\n\nRekor:\n- Immutable transparency log\n- Records all signatures and attestations\n- Public audit trail: anyone can verify when something was signed\n- Like Certificate Transparency (CT) but for code signing'
    },
    {
      front: 'How do you enforce image signing in Kubernetes with Kyverno?',
      back: 'apiVersion: kyverno.io/v1\nkind: ClusterPolicy\nmetadata:\n  name: require-signed-images\nspec:\n  validationFailureAction: Enforce\n  rules:\n  - name: verify-image\n    match:\n      any:\n      - resources:\n          kinds: ["Pod"]\n    verifyImages:\n    - imageReferences:\n      - "myregistry.io/*"\n      attestors:\n      - count: 1\n        entries:\n        - keys:\n            publicKeys: |-\n              -----BEGIN PUBLIC KEY-----\n              <cosign.pub contents>\n              -----END PUBLIC KEY-----'
    },
    {
      front: 'What is keyless Cosign signing and why is it better than key-based?',
      back: 'Keyless signing:\n- Uses OIDC identity (GitHub Actions, GKE, etc.) instead of a key\n- Fulcio issues short-lived cert tied to OIDC identity\n- Signature recorded in Rekor transparency log\n- No long-lived private key to manage, rotate, or leak!\n\nKey-based signing:\n- Generate cosign.key + cosign.pub\n- Must securely store and rotate cosign.key\n- Key compromise = all past signatures are untrusted\n- Simpler to set up for non-cloud environments\n\nFor CKS exam: know both methods, understand keyless concept'
    },
    {
      front: 'What is a Cosign attestation and what types exist?',
      back: 'Attestation: signed claim attached to an image (not the image itself)\n\nCreate: cosign attest --key cosign.key --type <type> --predicate <file> image:tag\nVerify: cosign verify-attestation --key cosign.pub --type <type> image:tag\n\nCommon types:\n- cyclonedx: SBOM (Software Bill of Materials)\n- spdx: Another SBOM format\n- vuln: Vulnerability scan results\n- slsaprovenance: SLSA build provenance\n- custom: Any JSON predicate\n\nWhy: Proves "this image was scanned and found clean" cryptographically'
    }
  ],

  lab: {
    scenario: 'You need to implement image signing in the CI/CD pipeline to ensure only signed and scanned images are deployed to the production cluster.',
    objective: 'Generate a Cosign key pair, sign an image, verify the signature, and configure Kyverno to enforce signed images in a namespace.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Install Cosign and generate a key pair',
        instruction: `Install Cosign and create a signing key pair.

\`\`\`bash
# Install cosign (Linux/amd64)
COSIGN_VERSION=$(curl -s https://api.github.com/repos/sigstore/cosign/releases/latest | grep '"tag_name":' | sed 's/.*"v\\([^"]*\\)".*/\\1/')
wget -O cosign https://github.com/sigstore/cosign/releases/download/v\${COSIGN_VERSION}/cosign-linux-amd64
chmod +x cosign
sudo mv cosign /usr/local/bin/cosign

# Verify installation
cosign version

# Generate key pair (for key-based signing)
mkdir -p /tmp/cosign-keys
cd /tmp/cosign-keys
cosign generate-key-pair
# Enter a passphrase when prompted

# View the generated files
ls -la
# Expected: cosign.key (private, password-protected) cosign.pub (public)

# View the public key content
cat cosign.pub
\`\`\``,
        hints: [
          'The passphrase protects the private key — use a strong one in production',
          'cosign.pub is safe to share/store in Git or Kubernetes Secrets',
          'cosign.key must be kept secret — store in vault/KMS in production'
        ],
        solution: `\`\`\`bash
cosign version
ls /tmp/cosign-keys/
\`\`\``,
        verify: `\`\`\`bash
cosign version | head -3
# Expected: cosign version v2.x.x

ls /tmp/cosign-keys/
# Expected: cosign.key  cosign.pub

# Verify the public key is ECDSA P-256
head -1 /tmp/cosign-keys/cosign.pub
# Expected: -----BEGIN PUBLIC KEY-----
\`\`\``
      },
      {
        title: 'Sign and verify a container image',
        instruction: `Sign an image in a registry (or simulate with a local registry).

\`\`\`bash
cd /tmp/cosign-keys

# Option A: If you have access to a registry (e.g., ttl.sh for testing):
IMAGE="ttl.sh/cks-test-$(date +%s):5m"

# Pull a test image and push to ttl.sh
docker pull alpine:3.19
docker tag alpine:3.19 $IMAGE
docker push $IMAGE

echo "Image: $IMAGE"

# Sign the image
cosign sign --key cosign.key $IMAGE
# Enter passphrase when prompted

# Verify the signature
cosign verify --key cosign.pub $IMAGE

# Show signature details
cosign verify --key cosign.pub $IMAGE | python3 -m json.tool 2>/dev/null | head -20
\`\`\`

If no registry is available, practice the commands:
\`\`\`bash
# Simulate: show what cosign would output
echo "Simulate: cosign sign --key cosign.key myregistry.io/myapp:1.0"
echo "Simulate: cosign verify --key cosign.pub myregistry.io/myapp:1.0"
\`\`\``,
        hints: [
          'ttl.sh is a free temporary OCI registry — images expire after the specified time',
          'COSIGN_EXPERIMENTAL=1 cosign sign uses keyless signing (Sigstore infrastructure)',
          'cosign verify output is JSON — each element represents a valid signature'
        ],
        solution: `\`\`\`bash
# The sign and verify commands (key steps for the exam)
# cosign sign --key cosign.key <image>
# cosign verify --key cosign.pub <image>
echo "Key commands demonstrated"
\`\`\``,
        verify: `\`\`\`bash
# If image was signed:
cosign verify --key /tmp/cosign-keys/cosign.pub $IMAGE 2>&1 | grep -E "Verified|WARNING|Error"
# Expected: Verified OK or "1 of 1 signatures verified"

# Key pair exists
ls /tmp/cosign-keys/
# Expected: cosign.key  cosign.pub
\`\`\``
      },
      {
        title: 'Create a Kyverno policy to enforce image signing',
        instruction: `Configure Kyverno to require signed images in the "production" namespace.

\`\`\`bash
# Get the public key content for the Kyverno policy
PUBLIC_KEY=$(cat /tmp/cosign-keys/cosign.pub)

# Create the namespace
kubectl create namespace production

# Create the Kyverno policy
cat <<EOF | kubectl apply -f -
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-signed-images
spec:
  validationFailureAction: Enforce
  background: false
  rules:
  - name: verify-image-signature
    match:
      any:
      - resources:
          kinds: ["Pod"]
          namespaces: ["production"]
    verifyImages:
    - imageReferences:
      - "*"
      mutateDigest: false
      verifyDigest: false
      required: true
      attestors:
      - count: 1
        entries:
        - keys:
            publicKeys: |-
$(cat /tmp/cosign-keys/cosign.pub | sed 's/^/              /')
EOF

# Test: unsigned image should fail
kubectl run unsigned-test --image=nginx:alpine -n production 2>&1 | head -5
\`\`\``,
        hints: [
          'The indentation of publicKeys content matters — it must be properly YAML-indented',
          'With Enforce, any unsigned image in "production" is rejected',
          'In the exam, the exact Kyverno syntax may differ slightly — check the version'
        ],
        solution: `\`\`\`bash
kubectl get clusterpolicy require-signed-images 2>/dev/null || echo "Policy not yet applied"
\`\`\``,
        verify: `\`\`\`bash
# Policy should exist
kubectl get clusterpolicy require-signed-images
# Expected: require-signed-images   <time>

# Unsigned image in production should be rejected
kubectl run test-unsigned --image=nginx:alpine -n production 2>&1 | grep -i "denied\|error\|signature"
# Expected: Error or denied message (image not verified)

# Check policy status
kubectl describe clusterpolicy require-signed-images | grep -E "Status|Ready"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'cosign verify returns "no matching signatures"',
      difficulty: 'medium',
      symptom: 'After signing an image, cosign verify returns "no matching signatures were found" or "failed to verify signature".',
      diagnosis: `\`\`\`bash
# Check if signature exists in registry
cosign triangulate <image>  # shows where signature is stored
crane ls <repo-name> | grep "sha256"  # list all tags including .sig tags

# Verify you're using the correct public key
cat cosign.pub
cosign verify --key cosign.pub <image> --verbose 2>&1

# Common cause: image tag vs digest mismatch
docker inspect <image> | grep "RepoDigests"
\`\`\``,
      solution: `**Fix based on issue:**

1. **Signed a different digest than you're verifying:**
\`\`\`bash
# Sign and verify by digest for consistency
IMAGE_DIGEST=$(docker inspect myimage:tag | jq -r '.[0].RepoDigests[0]')
cosign sign --key cosign.key $IMAGE_DIGEST
cosign verify --key cosign.pub $IMAGE_DIGEST
\`\`\`

2. **Wrong public key:**
\`\`\`bash
# Verify you're using the public key that matches the private key used for signing
# Generate a test signature with known key and verify immediately
echo "test" > /tmp/test.txt
cosign sign-blob --key cosign.key /tmp/test.txt > /tmp/test.sig
cosign verify-blob --key cosign.pub --signature /tmp/test.sig /tmp/test.txt
\`\`\`

3. **Registry doesn't support OCI artifacts:**
- Some registries don't support Cosign's signature storage format
- Use a compatible registry (GCR, ECR, Docker Hub, Harbor, Quay)`
    }
  ]
};
