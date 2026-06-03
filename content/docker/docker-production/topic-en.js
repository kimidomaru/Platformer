window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['docker/docker-production'] = {
  theory: `
# Docker in Production

## Relevance
Running Docker in production is very different from development. Registries, semantic versioning, multi-architecture builds, resource limits, logging, and image security are critical skills for SREs and DevOps. This topic covers what goes between the local "docker build" and deploying to real production.

## Registries and Versioning

### Tagging strategy

\`\`\`bash
# Recommended pattern: SemVer + git commit
docker build -t myapp:1.2.3 .                    # release
docker build -t myapp:1.2.3-beta.1 .             # pre-release
docker build -t myapp:1.2.3-abc1234 .            # commit hash

# Never use "latest" in production as the only tag
# latest is not immutable — it points to the last push
# In CI/CD: tag with commit SHA + version

# Multi-tag on the same build
COMMIT_SHA=$(git rev-parse --short HEAD)
VERSION=$(git describe --tags --abbrev=0)

docker build -t myapp:\${VERSION} \
             -t myapp:\${COMMIT_SHA} \
             -t myapp:latest .
\`\`\`

### Common registries

\`\`\`bash
# Docker Hub
docker login
docker push myorg/myapp:v1.2.3

# GitHub Container Registry (GHCR)
echo \$GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
docker tag myapp:v1.2.3 ghcr.io/myorg/myapp:v1.2.3
docker push ghcr.io/myorg/myapp:v1.2.3

# AWS ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  123456789.dkr.ecr.us-east-1.amazonaws.com

# Azure ACR
az acr login --name myregistry
docker tag myapp:v1.2.3 myregistry.azurecr.io/myapp:v1.2.3
docker push myregistry.azurecr.io/myapp:v1.2.3
\`\`\`

### Image signing with Cosign (supply chain security)

\`\`\`bash
# Install cosign
curl -O https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-amd64
chmod +x cosign-linux-amd64 && mv cosign-linux-amd64 /usr/local/bin/cosign

# Sign image (keyless with OIDC — GitHub Actions)
cosign sign --yes ghcr.io/myorg/myapp:v1.2.3

# Verify signature
cosign verify --certificate-identity-regexp="https://github.com/myorg/myapp" \
              --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
              ghcr.io/myorg/myapp:v1.2.3

# Verify digest (immutable)
docker pull ghcr.io/myorg/myapp:v1.2.3@sha256:abc123...
\`\`\`

## Multi-architecture with Docker Buildx

\`\`\`bash
# Create and use a builder with multi-platform support
docker buildx create --name multiarch --use
docker buildx inspect --bootstrap

# Build for AMD64 and ARM64 simultaneously
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag myregistry.io/myapp:v1.2.3 \
  --push \                           # pushes directly to registry
  .

# Verify manifests (list of architectures)
docker buildx imagetools inspect myregistry.io/myapp:v1.2.3

# For CI (GitHub Actions): use docker/setup-buildx-action
# For local environment: use QEMU to emulate ARM
docker run --rm --privileged multiarch/qemu-user-static --reset -p yes
\`\`\`

## Resource Limits and Restart Policies

### Critical limits in production

\`\`\`bash
# NEVER start a container without resource limits in production
docker run -d \
  --name myapp \
  --memory="512m" \          # RAM limit
  --memory-swap="512m" \     # = memory = no swap
  --cpus="1.0" \             # 1 full CPU
  --cpu-shares=512 \         # relative weight (default 1024)
  --pids-limit=100 \         # max processes (prevents fork bombs)
  --restart unless-stopped \  # restart automatically
  -p 8080:8080 \
  myapp:v1.2.3

# Verify applied limits
docker stats myapp
docker inspect myapp | jq '.[].HostConfig | {Memory, NanoCpus, PidsLimit}'
\`\`\`

### Restart policies

\`\`\`
no             → don't restart (default)
always         → always restart (including host reboot)
unless-stopped → restart except if manually stopped
on-failure[:N] → restart only on error (max N times)
\`\`\`

\`\`\`bash
# on-failure with limit (good for jobs)
docker run --restart=on-failure:3 myapp

# unless-stopped (good for long-running services)
docker run --restart=unless-stopped myapp

# Check restart history
docker inspect myapp | jq '.[].RestartCount'
\`\`\`

## Logging in Production

### Log drivers

\`\`\`bash
# Default driver: json-file (stores locally)
# Problem: no rotation by default = disk full!

# json-file with rotation (minimum acceptable)
docker run --log-driver json-file \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  myapp:v1.2.3

# Configure globally in /etc/docker/daemon.json:
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}

# For production with centralization: use journald + Loki, or fluentd/fluent-bit
docker run --log-driver journald myapp
docker run --log-driver fluentd \
  --log-opt fluentd-address=localhost:24224 \
  myapp
\`\`\`

### Recommended log structure

\`\`\`python
# Application must log to STDOUT/STDERR (not to files!)
# Docker captures STDOUT/STDERR automatically
import logging
import json
import sys

# Structured format (JSON) for easier parsing
class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_entry = {
            "timestamp": self.formatTime(record),
            "level": record.levelname,
            "message": record.getMessage(),
            "service": "myapp",
            "version": "1.2.3"
        }
        return json.dumps(log_entry)

handler = logging.StreamHandler(sys.stdout)  # STDOUT
handler.setFormatter(JSONFormatter())
logging.basicConfig(handlers=[handler])
\`\`\`

## Complete CI/CD Pipeline with Docker

### GitHub Actions — build, scan, and push

\`\`\`yaml
# .github/workflows/docker.yml
name: Docker Build and Push

on:
  push:
    branches: [main]
    tags: ["v*"]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: \${{ github.repository }}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
      id-token: write  # for cosign keyless signing

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to registry
        uses: docker/login-action@v3
        with:
          registry: \${{ env.REGISTRY }}
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}
          tags: |
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha,prefix=sha-

      - name: Build and push
        id: build
        uses: docker/build-push-action@v5
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: \${{ github.event_name != 'pull_request' }}
          tags: \${{ steps.meta.outputs.tags }}
          labels: \${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Scan with Trivy
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}:sha-\${{ github.sha }}
          format: sarif
          output: trivy-results.sarif
          severity: HIGH,CRITICAL
          exit-code: 1           # fails the build if CRITICAL CVEs found

      - name: Sign image with Cosign
        if: github.event_name != 'pull_request'
        uses: sigstore/cosign-installer@v3
        run: cosign sign --yes \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}@\${{ steps.build.outputs.digest }}
\`\`\`

## Docker in Production: Daemon Configuration

### /etc/docker/daemon.json

\`\`\`json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2",
  "default-ulimits": {
    "nofile": {
      "Hard": 65536,
      "Soft": 65536
    }
  },
  "live-restore": true,
  "userland-proxy": false,
  "no-new-privileges": true,
  "icc": false
}
\`\`\`

**Critical configuration explanations:**
- **live-restore**: containers keep running during daemon restart
- **no-new-privileges**: prevents privilege escalation via setuid
- **icc: false**: disables inter-container communication by default (use explicit networks)

### Docker rootless (advanced security)

\`\`\`bash
# Install Docker rootless (without host root)
curl -fsSL https://get.docker.com/rootless | sh

# Add to .bashrc
export PATH=/home/USER/bin:\$PATH
export DOCKER_HOST=unix:///run/user/1000/docker.sock

# Advantage: even if container escapes, no root privileges on host
dockerd-rootless-setuptool.sh install
\`\`\`

## Monitoring and Observability

### Metrics with cAdvisor

\`\`\`yaml
# docker-compose with monitoring
services:
  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
    ports:
      - "8080:8080"
    command:
      - --housekeeping_interval=10s
      - --max_housekeeping_interval=15s

  node-exporter:
    image: prom/node-exporter:latest
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
    command:
      - --path.procfs=/host/proc
      - --path.sysfs=/host/sys
\`\`\`

\`\`\`bash
# Check basic container metrics
docker stats --no-stream --format \
  "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"

# Check Docker events
docker events --filter type=container --since 1h
\`\`\`

## Common Production Mistakes

1. **Using latest tag in production** — not immutable, inconsistent deploys between nodes
2. **No resource limits** — container kills the host consuming all RAM
3. **Log driver without rotation** — disk full in days/weeks
4. **restart: always** instead of **unless-stopped** — container restarts even when intentionally stopped
5. **Secrets as ENV in Dockerfile** — appear in \`docker inspect\` and logs
6. **Not scanning images** — critical vulnerabilities in production without knowing

## Killer.sh Style Challenge

> **Scenario:** Your company wants to implement a complete CI/CD pipeline for a Go API. Requirements are: (1) multi-architecture images (AMD64 + ARM64), (2) tag with SemVer + commit SHA, (3) automatic vulnerability scan with failure on CRITICAL CVEs, (4) push to GHCR authenticated with GITHUB_TOKEN. Write the complete GitHub Actions workflow.
`,
  quiz: [
    {
      question: 'Why is using "latest" as the only tag in production considered a bad practice?',
      options: [
        'latest doesn\'t work in Kubernetes',
        'The "latest" tag is not immutable — any new push overwrites it. In production with multiple nodes, different nodes can have different versions of "latest", creating inconsistencies. It\'s impossible to rollback to a specific version',
        'latest only works on Docker Hub, not in private registries',
        'Images with latest tag are automatically deleted after 30 days'
      ],
      correct: 1,
      explanation: 'The "latest" tag is mutable — it points to the last push. If you deploy v1.0 as "latest" and then v1.1, the "latest" tag now points to v1.1. If there\'s a bug in v1.1 and you need to rollback, there\'s no way to "go back to the previous latest". Always use immutable tags (v1.0.0, sha-abc123) in production, and optionally keep "latest" as a convenient alias.',
      reference: 'Recommended pattern: tag with SemVer (v1.2.3) + commit SHA (sha-abc1234) on every CI/CD push.'
    },
    {
      question: 'What is Docker Buildx and what is the main benefit of multi-platform builds?',
      options: [
        'Buildx is an extension that only speeds up parallel builds',
        'Buildx is Docker\'s extended builder that supports multi-platform builds (linux/amd64, linux/arm64, etc.) and advanced cache — allowing creation of a single image that works on Intel/AMD and ARM (Apple M1/M2, AWS Graviton) with a single command',
        'Buildx is only needed for images larger than 1GB',
        'Multi-platform is only relevant for mobile and IoT, not servers'
      ],
      correct: 1,
      explanation: 'Docker Buildx uses BuildKit underneath and supports builds for multiple architectures in a single command. The result is a "manifest list" in the registry — when someone does `docker pull`, Docker automatically gets the correct version for the host architecture. With AWS Graviton (ARM64) being up to 40% cheaper than equivalent Intel instances, multi-architecture is increasingly relevant in production.',
      reference: 'Practice: `docker buildx build --platform linux/amd64,linux/arm64 --push` in CI/CD ensures the image works in any cloud.'
    },
    {
      question: 'What is the difference between `--restart always` and `--restart unless-stopped`?',
      options: [
        'They are identical in behavior',
        '`always` restarts the container in ANY situation, including when you stop it manually; `unless-stopped` restarts automatically EXCEPT if the container was manually stopped — ideal for production services',
        '`unless-stopped` only works with Docker Compose',
        '`always` is for production, `unless-stopped` is for development'
      ],
      correct: 1,
      explanation: 'With `always`, if you run `docker stop myapp`, the container stops — but the next time the Docker daemon restarts (server reboot), it comes back. With `unless-stopped`, Docker remembers that you intentionally stopped it and does NOT restart on the next boot. For planned maintenance (stopping a container while migrating data), `unless-stopped` is more appropriate as it respects the operator\'s intent.',
      reference: 'Practical rule: use `unless-stopped` for production services. Use `always` only when the container MUST always run, without exception.'
    },
    {
      question: 'Why is it critical to configure log rotation in the Docker daemon in production?',
      options: [
        'Large logs decrease container performance',
        'The json-file driver (default) stores all logs in /var/lib/docker/containers/ without a limit by default — in days or weeks, it can fill the server\'s disk, causing ALL containers on the host to fail',
        'Log rotation is only needed for applications with more than 1000 req/s',
        'Docker automatically deletes logs after 7 days'
      ],
      correct: 1,
      explanation: 'The json-file driver writes STDOUT/STDERR logs from each container to JSON files in /var/lib/docker/containers/<id>/. Without configuring max-size and max-file, these files grow indefinitely. In production with verbose applications, it\'s easy to fill 100GB disks in less than a week. Configuring `max-size: 10m` and `max-file: 3` guarantees at most 30MB of log per container.',
      reference: 'Configure in /etc/docker/daemon.json to apply globally to all containers on the host.'
    },
    {
      question: 'What does the `icc: false` field in Docker\'s daemon.json do?',
      options: [
        'Disables Docker ICC (Integrated Container Console)',
        'Disables inter-container communication (ICC) on the default bridge network — forcing containers to communicate only through explicitly created Docker networks, increasing isolation',
        'Prevents containers from making requests to the internet',
        'Disables use of shared volumes between containers'
      ],
      correct: 1,
      explanation: 'By default, all containers connected to the default bridge network (docker0) can communicate with each other directly by IP — even without you explicitly configuring this. `icc: false` disables this behavior. Containers only communicate via named Docker networks (created with docker network create or in Compose), which you control explicitly. It\'s a defense in depth measure.',
      reference: 'Complement: in Kubernetes, Network Policies do the equivalent — restricting communication between Pods by default.'
    },
    {
      question: 'How does GitHub Actions cache (`cache-from: type=gha`) work for Docker builds?',
      options: [
        'GitHub stores the complete image between runs',
        'The gha cache stores Docker build layers in GitHub Actions cache — unmodified layers are reused between CI runs, drastically reducing build time (especially when only code changes, not dependencies)',
        'The cache only works for images smaller than 500MB',
        'type=gha is the same as having no cache — it\'s just a placeholder'
      ],
      correct: 1,
      explanation: 'BuildKit supports various cache backends. `type=gha` uses GitHub Actions cache as the layer storage backend. With `mode=max`, all intermediate layers are cached, not just the final one. Practical result: a build that normally takes 8 minutes can drop to 1-2 minutes in subsequent runs when only code changed.',
      reference: 'Other cache options: `type=registry` (cache in the registry itself), `type=local` (local disk — good for self-hosted runners).'
    },
    {
      question: 'What is Container Image Signing (e.g., Cosign) and why is it important for supply chain security?',
      options: [
        'It\'s a way to add copyright metadata to images',
        'Cosign cryptographically signs the image (or its SHA256 digest) with a private key or via OIDC keyless — allowing verification that the image was generated by the official CI and was not tampered with between build and deploy',
        'Signing is only needed for images published on Docker Hub',
        'Signing encrypts image content to protect secrets'
      ],
      correct: 1,
      explanation: 'Supply chain attacks (like the SolarWinds attack) compromise the build process, not the application directly. Container signing with Cosign guarantees that: (1) the image was generated by your CI/CD, (2) was not tampered with in the registry, (3) the signer\'s identity is verifiable (via OIDC keyless, uses GitHub Actions context as identity). In Kubernetes, Kyverno and OPA can verify signatures before allowing deployment.',
      reference: 'SLSA standard (Supply chain Levels for Software Artifacts): signing is part of level 3+ supply chain security.'
    }
  ],
  flashcards: [
    {
      front: 'Production tagging strategy',
      back: '**Never use only "latest" in production**\n\n**Recommended immutable tags:**\n```bash\n# SemVer (release version)\ndocker tag myapp:latest myapp:v1.2.3\n\n# Commit SHA (traceability)\nCOMMIT=\$(git rev-parse --short HEAD)\ndocker tag myapp:latest myapp:sha-\${COMMIT}\n\n# Multi-tag in build\ndocker build \\\n  -t myapp:v1.2.3 \\\n  -t myapp:sha-abc1234 \\\n  -t myapp:latest .\n```\n\n**Why "latest" is dangerous:**\n- Mutable: new push overwrites\n- Rollback impossible\n- Different nodes may have different\n  versions in production\n\n**In CI/CD (GitHub Actions):**\n```yaml\n# docker/metadata-action generates tags automatically\ntags: |\n  type=semver,pattern={{version}}\n  type=sha,prefix=sha-\n```'
    },
    {
      front: 'Multi-architecture with Docker Buildx',
      back: '**Setup:**\n```bash\ndocker buildx create --name multiarch --use\ndocker buildx inspect --bootstrap\n```\n\n**Multi-platform build:**\n```bash\ndocker buildx build \\\n  --platform linux/amd64,linux/arm64 \\\n  --tag myapp:v1.2.3 \\\n  --push .\n```\n\n**Verify manifests:**\n```bash\ndocker buildx imagetools inspect myapp:v1.2.3\n# Shows: amd64 + arm64 separate digests\n```\n\n**In CI (GitHub Actions):**\n```yaml\n- uses: docker/setup-buildx-action@v3\n- uses: docker/build-push-action@v5\n  with:\n    platforms: linux/amd64,linux/arm64\n    push: true\n    cache-from: type=gha\n    cache-to: type=gha,mode=max\n```\n\n**Why it matters:**\n- AWS Graviton (ARM64): ~40% cheaper\n- Apple M1/M2: developers with Mac\n- Raspberry Pi and edge devices'
    },
    {
      front: 'Resource limits in production — mandatory',
      back: '**No limits = container can kill the host!**\n\n```bash\ndocker run -d \\\n  --memory="512m" \\\n  --memory-swap="512m" \\ # = memory = no swap\n  --cpus="1.0" \\\n  --pids-limit=100 \\\n  --restart unless-stopped \\\n  myapp:v1.2.3\n```\n\n**Restart policies:**\n```\nno             → don\'t restart\nalways         → always (even after docker stop)\nunless-stopped → always EXCEPT if manually stopped ✓\non-failure:3   → only on error, max 3x (jobs)\n```\n\n**Verify limits:**\n```bash\ndocker stats myapp  # real-time\ndocker inspect myapp | jq \\\n  \'.[].HostConfig | {\n    Memory,\n    NanoCpus,\n    PidsLimit\n  }\'\n```\n\n**K8s equivalent:**\n```yaml\nresources:\n  limits:\n    memory: 512Mi\n    cpu: "1.0"\n```'
    },
    {
      front: 'Production logging — correct configuration',
      back: '**daemon.json (global for all containers):**\n```json\n{\n  "log-driver": "json-file",\n  "log-opts": {\n    "max-size": "10m",\n    "max-file": "3"\n  }\n}\n```\n\n**Per container (override):**\n```bash\ndocker run --log-driver json-file \\\n  --log-opt max-size=10m \\\n  --log-opt max-file=3 \\\n  myapp\n```\n\n**Production drivers:**\n- `json-file` + rotation: minimum acceptable\n- `journald`: integrates with systemd\n- `fluentd`/`fluent-bit`: centralized\n- `awslogs`: directly to CloudWatch\n\n**App rule:**\n- ALWAYS log to STDOUT/STDERR\n- Never to files inside the container\n- Docker captures automatically\n\n**View logs:**\n```bash\ndocker logs myapp --tail 100 -f\ndocker logs myapp --since 1h\n```'
    },
    {
      front: 'daemon.json — critical security settings',
      back: '```json\n{\n  "log-driver": "json-file",\n  "log-opts": { "max-size": "10m" },\n  "storage-driver": "overlay2",\n  "live-restore": true,\n  "userland-proxy": false,\n  "no-new-privileges": true,\n  "icc": false\n}\n```\n\n**What each does:**\n\n`live-restore: true`\n→ Containers keep running during\n  Docker daemon restart\n\n`no-new-privileges: true`\n→ Prevents privilege escalation via setuid\n  (even if container tries)\n\n`icc: false`\n→ Containers on default bridge CANNOT\n  communicate with each other directly\n  (use explicit Docker networks)\n\n`userland-proxy: false`\n→ Uses iptables instead of proxy for ports\n  (better performance)\n\n**Apply changes:**\n```bash\nsudo systemctl reload docker\n# or\nsudo kill -SIGHUP \$(pidof dockerd)\n```'
    },
    {
      front: 'CI/CD Docker pipeline — complete checklist',
      back: '**Required stages:**\n```\n1. Code checkout\n2. Setup Buildx (multi-arch)\n3. Registry login\n4. Extract metadata (tags, labels)\n5. Multi-platform Build + Push\n6. Vulnerability scan (Trivy)\n7. Image signing (Cosign)\n```\n\n**Auto tags (metadata-action):**\n```yaml\ntags: |\n  type=semver,pattern={{version}}\n  type=semver,pattern={{major}}.{{minor}}\n  type=sha,prefix=sha-\n  type=edge,branch=main\n```\n\n**Efficient cache:**\n```yaml\ncache-from: type=gha\ncache-to: type=gha,mode=max\n```\n\n**Scan with CRITICAL failure:**\n```yaml\n- uses: aquasecurity/trivy-action@master\n  with:\n    severity: HIGH,CRITICAL\n    exit-code: 1  # fails the build!\n```\n\n**Verify immutable digest:**\n```bash\ndocker pull myapp@sha256:abc123...\n```'
    }
  ],
  lab: {
    scenario: 'You need to prepare a Flask application for real production: create a simulated local CI/CD pipeline that tests the image, scans for vulnerabilities, and validates production configurations (resource limits, restart policy, log rotation).',
    objective: 'Implement a complete Docker production workflow: optimized build, security scanning, resource limits, configured logging, and production readiness validation.',
    duration: '30-40 minutes',
    steps: [
      {
        title: 'Create production build with multi-stage and metadata',
        instruction: `Create a production Dockerfile using multi-stage build with metadata labels, and simulate the CI/CD tagging process.`,
        hints: [
          'Use ARGs to pass version and commit SHA in the build',
          'Add standard OCI labels (org.opencontainers.image.*)',
          'Multi-tag the image with version + commit SHA'
        ],
        solution: `\`\`\`bash
# Create production project
mkdir prod-deploy && cd prod-deploy

cat > app.py << 'EOF'
from flask import Flask, jsonify
import os

app = Flask(__name__)

@app.route('/health')
def health():
    return jsonify({
        "status": "ok",
        "version": os.getenv("APP_VERSION", "unknown"),
        "commit": os.getenv("GIT_COMMIT", "unknown")
    })

@app.route('/')
def index():
    return jsonify({"message": "Production ready!"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
EOF

cat > requirements.txt << 'EOF'
flask==3.0.0
gunicorn==21.2.0
EOF

# Dockerfile with ARGs for CI/CD metadata
cat > Dockerfile << 'EOF'
FROM python:3.11-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

FROM python:3.11-slim

# Build args (passed by CI/CD)
ARG APP_VERSION=dev
ARG GIT_COMMIT=unknown
ARG BUILD_DATE

# Standard OCI labels
LABEL org.opencontainers.image.version="\${APP_VERSION}" \\
      org.opencontainers.image.revision="\${GIT_COMMIT}" \\
      org.opencontainers.image.created="\${BUILD_DATE}" \\
      org.opencontainers.image.title="Flask App" \\
      org.opencontainers.image.source="https://github.com/myorg/myapp"

WORKDIR /app

# Copy dependencies from builder
COPY --from=builder /root/.local /root/.local
COPY app.py .

# Environment variables with ARG values
ENV APP_VERSION=\${APP_VERSION} \\
    GIT_COMMIT=\${GIT_COMMIT} \\
    PATH=/root/.local/bin:\$PATH

RUN useradd --uid 1001 --create-home appuser && chown -R appuser /app
USER appuser

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD python -c \\
  "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')" || exit 1

CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "2", "app:app"]
EOF

# Simulate CI/CD: build with metadata
VERSION="v1.2.3"
COMMIT=\$(git init -q && git add . && git commit -m "init" -q && git rev-parse --short HEAD 2>/dev/null || echo "abc1234")
BUILD_DATE=\$(date -u +"%Y-%m-%dT%H:%M:%SZ")

docker build \
  --build-arg APP_VERSION=\${VERSION} \
  --build-arg GIT_COMMIT=\${COMMIT} \
  --build-arg BUILD_DATE=\${BUILD_DATE} \
  -t myapp:\${VERSION} \
  -t myapp:sha-\${COMMIT} \
  -t myapp:latest \
  .

# Verify labels
docker inspect myapp:\${VERSION} | jq '.[].Config.Labels'
\`\`\``,
        verify: `\`\`\`bash
# Verify image was created with multiple tags
docker images myapp
# Expected: v1.2.3, sha-*, latest

# Verify OCI labels
docker inspect myapp:v1.2.3 | jq '.[].Config.Labels'
# Expected: labels with version, revision, created, etc.

# Verify metadata in API
docker run --rm -p 8080:8080 -d --name test-prod myapp:v1.2.3
sleep 3
curl -sf http://localhost:8080/health
# Expected: {"status": "ok", "version": "v1.2.3", "commit": "..."}

docker stop test-prod && docker rm test-prod
\`\`\``
      },
      {
        title: 'Configure resource limits and production restart policy',
        instruction: `Run the container with correct production resource limits, restart policy, and logging with rotation. Validate each configuration.`,
        hints: [
          'Use --memory-swap equal to --memory to disable swap',
          'Use --restart unless-stopped for long-running services',
          'Configure log rotation to prevent disk full'
        ],
        solution: `\`\`\`bash
# Run with complete production configurations
docker run -d \
  --name myapp-prod \
  --memory="256m" \
  --memory-swap="256m" \
  --cpus="0.5" \
  --pids-limit=50 \
  --restart unless-stopped \
  --log-driver json-file \
  --log-opt max-size=5m \
  --log-opt max-file=3 \
  -p 8080:8080 \
  --read-only \
  --tmpfs /tmp \
  --security-opt no-new-privileges:true \
  myapp:v1.2.3

# Verify applied configurations
echo "=== Resource Limits ==="
docker inspect myapp-prod | jq '.[0].HostConfig | {
  Memory,
  MemorySwap,
  NanoCpus,
  PidsLimit,
  RestartPolicy,
  LogConfig
}'

echo "=== Real-time stats ==="
docker stats myapp-prod --no-stream --format \
  "CPU: {{.CPUPerc}} | MEM: {{.MemUsage}} | NET: {{.NetIO}}"

# Test restart policy: simulate failure
docker kill myapp-prod
sleep 3
docker ps | grep myapp-prod
# Should have restarted automatically!

echo "=== Restart count ==="
docker inspect myapp-prod | jq '.[0].RestartCount'
\`\`\``,
        verify: `\`\`\`bash
# Verify container is running
docker ps | grep myapp-prod

# Verify memory limit
docker inspect myapp-prod | jq '.[0].HostConfig.Memory'
# Expected: 268435456 (256MB in bytes)

# Verify restart policy
docker inspect myapp-prod | jq '.[0].HostConfig.RestartPolicy'
# Expected: {"Name": "unless-stopped", "MaximumRetryCount": 0}

# Verify log config
docker inspect myapp-prod | jq '.[0].HostConfig.LogConfig'
# Expected: {"Type": "json-file", "Config": {"max-file": "3", "max-size": "5m"}}

# Verify security (read-only filesystem)
docker exec myapp-prod touch /readonly-test 2>&1 | grep -q "Read-only" && echo "Read-only FS ✓"
\`\`\``
      },
      {
        title: 'Scan image and validate production readiness',
        instruction: `Scan the image with Trivy, generate a vulnerability report, and create a pre-production validation script that checks all criteria.`,
        hints: [
          'Use trivy with --exit-code 1 to fail on CRITICAL CVEs',
          'Verify the container doesn\'t run as root',
          'Validate that OCI labels are present'
        ],
        solution: `\`\`\`bash
# Install trivy if needed
which trivy || curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin

# Complete scan with report
echo "=== Trivy Security Scan ==="
trivy image \
  --severity HIGH,CRITICAL \
  --format table \
  myapp:v1.2.3

# Scan as CI gate (fail if CRITICAL found)
echo "=== CI Gate: CRITICAL CVEs ==="
trivy image \
  --severity CRITICAL \
  --exit-code 1 \
  --quiet \
  myapp:v1.2.3
echo "CRITICAL Gate: OK (exit code \$?)"

# Pre-production validation script
cat > validate-prod.sh << 'SCRIPT'
#!/bin/bash
set -e
IMAGE=\${1:-myapp:v1.2.3}
ERRORS=0

echo "Validating image: \$IMAGE"
echo "================================"

# 1. Verify not running as root
USER=\$(docker inspect \$IMAGE | jq -r '.[0].Config.User')
if [ -z "\$USER" ] || [ "\$USER" = "root" ]; then
  echo "FAIL: Container runs as root (User: '\$USER')"
  ERRORS=\$((ERRORS+1))
else
  echo "OK: Non-root user (\$USER)"
fi

# 2. Verify healthcheck
HEALTHCHECK=\$(docker inspect \$IMAGE | jq '.[0].Config.Healthcheck')
if [ "\$HEALTHCHECK" = "null" ]; then
  echo "WARN: No HEALTHCHECK configured"
else
  echo "OK: HEALTHCHECK configured"
fi

# 3. Verify OCI labels
VERSION_LABEL=\$(docker inspect \$IMAGE | jq -r '.[0].Config.Labels["org.opencontainers.image.version"]')
if [ "\$VERSION_LABEL" = "null" ] || [ -z "\$VERSION_LABEL" ]; then
  echo "WARN: Label org.opencontainers.image.version missing"
else
  echo "OK: Version label: \$VERSION_LABEL"
fi

# 4. Verify exposed port
PORTS=\$(docker inspect \$IMAGE | jq '.[0].Config.ExposedPorts')
if [ "\$PORTS" = "null" ]; then
  echo "WARN: No EXPOSE port declared"
else
  echo "OK: Exposed ports: \$PORTS"
fi

# 5. Security scan
echo ""
echo "=== Security Scan ==="
trivy image --severity CRITICAL --exit-code 1 --quiet \$IMAGE && \
  echo "OK: No CRITICAL CVEs" || \
  { echo "FAIL: CRITICAL CVEs found!"; ERRORS=\$((ERRORS+1)); }

echo ""
echo "================================"
if [ \$ERRORS -eq 0 ]; then
  echo "RESULT: APPROVED for production"
  exit 0
else
  echo "RESULT: REJECTED (\$ERRORS errors)"
  exit 1
fi
SCRIPT

chmod +x validate-prod.sh
./validate-prod.sh myapp:v1.2.3
\`\`\``,
        verify: `\`\`\`bash
# Verify script exists and is executable
ls -la validate-prod.sh

# Run validation
./validate-prod.sh myapp:v1.2.3
# Expected: all checks OK or WARN (not FAIL)

# Verify prod container is running
docker ps | grep myapp-prod
curl -sf http://localhost:8080/health | python3 -m json.tool

# Cleanup
docker stop myapp-prod && docker rm myapp-prod
docker rmi myapp:v1.2.3 myapp:latest 2>/dev/null || true
echo "Lab complete! Image validated for production."
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Container consuming all host memory (OOM Kill)',
      difficulty: 'hard',
      symptom: 'The server becomes slow and containers are randomly killed. `dmesg` shows "oom-kill-process". `docker stats` shows a container using almost all available RAM.',
      diagnosis: `\`\`\`bash
# 1. Check memory usage in real time
docker stats --no-stream
# or
docker stats --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}"

# 2. Check for recent OOM kills
docker inspect <container> | jq '.[].State.OOMKilled'
# true = was killed by OOM

# 3. Check system logs
dmesg | grep -i "oom\|killed process" | tail -20
journalctl -k | grep -i "oom" | tail -10

# 4. Check if container has memory limit
docker inspect <container> | jq '.[].HostConfig.Memory'
# 0 = NO LIMIT (problem!)

# 5. See detailed consumption inside container
docker exec <container> cat /sys/fs/cgroup/memory/memory.usage_in_bytes
\`\`\``,
      solution: `**Immediate fix — add memory limit:**
\`\`\`bash
# Cannot add limits to a running container
# Need to recreate with limits

docker stop <container>
docker rm <container>

docker run -d \
  --name <container> \
  --memory="512m" \
  --memory-swap="512m" \
  --restart unless-stopped \
  [other options] \
  <image>
\`\`\`

**Configure global limit in daemon.json:**
\`\`\`json
{
  "default-ulimits": {
    "nofile": { "Hard": 65536, "Soft": 65536 }
  }
}
\`\`\`

**To prevent in the future — configure limits in Compose:**
\`\`\`yaml
services:
  api:
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "1.0"
        reservations:
          memory: 256M
\`\`\`

**Verify after fixing:**
\`\`\`bash
docker inspect <container> | jq '.[].HostConfig.Memory'
# Expected: 536870912 (512MB in bytes), not 0
docker stats <container> --no-stream
\`\`\``
    },
    {
      title: 'Server disk full from Docker logs',
      difficulty: 'medium',
      symptom: 'Disk full alert on server. `df -h` shows /var/lib/docker at 100% usage. `du -sh /var/lib/docker/containers/` shows GBs of usage.',
      diagnosis: `\`\`\`bash
# 1. Check disk usage
df -h /var/lib/docker
du -sh /var/lib/docker/containers/

# 2. Find the largest log files
find /var/lib/docker/containers -name "*.log" \
  -exec ls -lh {} \; | sort -k5 -hr | head -10

# 3. Check container log configuration
docker inspect <container> | jq '.[].HostConfig.LogConfig'
# If "Config": {}, no rotation configured

# 4. See all containers by size
docker ps -a --format "{{.ID}} {{.Names}}" | while read id name; do
  size=\$(docker inspect \$id | jq '.[].SizeRootFs' 2>/dev/null)
  echo "\$size \$name"
done | sort -n -r | head -10
\`\`\``,
      solution: `**Emergency cleanup (CAREFUL: irreversible):**
\`\`\`bash
# Truncate logs without stopping containers (emergency)
truncate -s 0 /var/lib/docker/containers/<id>/<id>-json.log

# Clean unused images
docker image prune -a --force

# Clean everything not in use
docker system prune --force
# WARNING: removes stopped containers, unused images, networks

# See how much space would be freed
docker system df
\`\`\`

**Configure permanent rotation in /etc/docker/daemon.json:**
\`\`\`json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
\`\`\`

\`\`\`bash
# Apply configuration
sudo systemctl reload docker

# Recreate existing containers to apply
# (existing containers inherit config on next start)
docker stop <container> && docker start <container>
\`\`\`

**Verify after fixing:**
\`\`\`bash
docker inspect <container> | jq '.[].HostConfig.LogConfig'
# Expected: {"Type": "json-file", "Config": {"max-file": "3", "max-size": "10m"}}
\`\`\``
    }
  ]
};
