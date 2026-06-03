window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['docker/container-fundamentals'] = {
  theory: `
# Container and Docker Fundamentals

## Relevance
Containers are the basic deployment unit in Kubernetes. Before orchestrating with K8s, it's essential to understand how containers work: namespaces, cgroups, layers, optimized builds, and basic security. This topic covers what a DevOps/SRE needs to know beyond "docker run".

## How Containers Work (Under the Hood)

### Namespaces and cgroups

Containers are NOT VMs. They are isolated processes using Linux kernel primitives:

\`\`\`
Namespaces (resource isolation):
├── PID     → isolated processes (PID 1 inside container)
├── Network → own network interface (eth0)
├── Mount   → isolated filesystem
├── UTS     → own hostname
├── IPC     → isolated inter-process communication
└── User    → UID mapping (user namespaces)

cgroups (resource control):
├── cpu     → CPU limit
├── memory  → memory limit
├── blkio   → disk I/O limit
└── net_cls → network packet classification
\`\`\`

**Practical implication:** a misconfigured container can consume all the host's CPU/memory if it has no resource limits — even in Kubernetes.

### Docker Image: layers and Union Filesystem

\`\`\`
Image = stack of layers (each Dockerfile instruction = 1 layer)

Layer 1: FROM ubuntu:22.04      [read-only]
Layer 2: RUN apt-get install    [read-only]
Layer 3: COPY app/ /app/        [read-only]
Layer 4: CMD ["node", "app.js"] [read-only]
         ↓
At runtime: Container Layer     [read-write] ← only mutable layer
\`\`\`

**Why it matters:**
- Layers are cached — fast builds if the order is correct
- READ-ONLY layers are shared between containers
- Only the container layer is writable — and it's ephemeral (disappears with \`docker stop\`)

## Dockerfile: Best Practices

### Instruction order (efficient cache)

\`\`\`dockerfile
# WRONG: invalidates cache on any app file change
FROM node:18-alpine
WORKDIR /app
COPY . .                       # copies EVERYTHING — always invalidates cache
RUN npm install
CMD ["node", "server.js"]

# CORRECT: dependencies separated from code
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./          # only package.json changes rarely
RUN npm ci --only=production   # cache reused if package.json didn't change
COPY src/ ./src/               # code changes frequently — last
CMD ["node", "src/server.js"]
\`\`\`

### Multi-stage build — smaller and more secure image

\`\`\`dockerfile
# Stage 1: BUILD (with compilation tools)
FROM golang:1.21 AS builder
WORKDIR /app
COPY go.* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/server ./cmd/server

# Stage 2: RUNTIME (without build tools)
FROM gcr.io/distroless/static-debian12
COPY --from=builder /app/server /server
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/server"]
\`\`\`

**Result:** final image of ~10MB instead of ~800MB with the full build image.

### Dockerfile for Python applications (DevOps tools)

\`\`\`dockerfile
FROM python:3.11-slim AS base
WORKDIR /app

# Dependencies first (cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Code after
COPY src/ ./src/

# Non-root user (security)
RUN useradd --create-home --shell /bin/bash appuser
USER appuser

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \\
    CMD curl -f http://localhost:8080/health || exit 1

CMD ["python", "src/main.py"]
\`\`\`

## Essential Commands

### Build and image management

\`\`\`bash
# Build with tag
docker build -t myapp:v1.0.0 .
docker build -t myapp:v1.0.0 -f Dockerfile.prod .  # specific Dockerfile

# Build with build args
docker build --build-arg VERSION=1.0.0 --build-arg ENV=prod -t myapp:1.0.0 .

# Inspect image (layers, size)
docker image inspect myapp:v1.0.0
docker history myapp:v1.0.0  # see layers and sizes

# List and clean
docker images -a
docker image prune -a  # removes unused images (CAREFUL in production)
\`\`\`

### Running and inspecting containers

\`\`\`bash
# Basic run
docker run -d --name myapp -p 8080:8080 myapp:v1.0.0

# With environment variables and volume
docker run -d \\
  --name myapp \\
  -p 8080:8080 \\
  -e DATABASE_URL=postgres://... \\
  -v /host/data:/app/data \\
  --memory="512m" \\
  --cpus="1.0" \\
  myapp:v1.0.0

# Exec into running container
docker exec -it myapp bash
docker exec myapp ps aux
docker exec myapp env | grep DATABASE

# Logs and stats
docker logs myapp --tail 100 --follow
docker stats myapp  # real-time CPU, memory, network usage
\`\`\`

### Registry operations

\`\`\`bash
# Push to registry
docker tag myapp:v1.0.0 myregistry.azurecr.io/myapp:v1.0.0
docker push myregistry.azurecr.io/myapp:v1.0.0

# Specific pull
docker pull myregistry.azurecr.io/myapp:v1.0.0@sha256:abc123...

# Login to private registry
docker login myregistry.azurecr.io
docker login -u user -p token ghcr.io
\`\`\`

## Container Security

### Essential practices

\`\`\`dockerfile
# 1. Use official and slim base images
FROM node:18-alpine   # not FROM ubuntu + manually install node
FROM python:3.11-slim

# 2. Never run as root
RUN addgroup -g 1001 appgroup && adduser -u 1001 -G appgroup appuser
USER appuser

# 3. Copy only what's needed (avoid secrets in context)
COPY src/ /app/src/
# NOT: COPY . .  (may include .env, secrets)

# 4. Create .dockerignore
# .dockerignore:
# .git
# .env
# *.md
# node_modules/
# __pycache__/
\`\`\`

\`\`\`bash
# Scan for vulnerabilities
docker scout cves myapp:v1.0.0          # Docker Scout (native)
trivy image myapp:v1.0.0                # Trivy (open source)
grype myapp:v1.0.0                      # Grype (Anchore)

# Check if running as root
docker inspect myapp | jq '.[].Config.User'
# Expected: "1001" or "appuser", not "" (root)
\`\`\`

### Seccomp and AppArmor (advanced)

\`\`\`bash
# Docker applies seccomp by default (restricts dangerous syscalls)
# Check applied profile:
docker inspect myapp | jq '.[].HostConfig.SecurityOpt'

# Run with custom profile
docker run --security-opt seccomp=/path/to/profile.json myapp:v1.0.0

# For Kubernetes: uses SecurityContext + PodSecurityPolicy/PSA
\`\`\`

## Common Mistakes

1. **Image too large** — not using multi-stage, copying node_modules, no .dockerignore
2. **Running as root** — container without USER instruction = root = security risk
3. **Secrets in Dockerfile** — ENV with passwords, COPY of .env files
4. **Inefficient cache** — COPY . . before RUN npm install = always rebuilds
5. **No HEALTHCHECK** — container starts but isn't functional

## Killer.sh Style Challenge

> **Scenario:** You receive a Dockerfile for a Go application that generates a 1.2GB image and takes 8 minutes to build. Rewrite it using multi-stage build, cache optimization, and non-root user. The final image must be smaller than 20MB and a rebuild (only code changed) should take less than 30 seconds.
`,
  quiz: [
    {
      question: 'Why does the order of instructions in a Dockerfile drastically affect build time?',
      options: [
        'Docker executes instructions in parallel, so order doesn\'t matter',
        'Each instruction creates a layer; when a layer changes, all subsequent layers are invalidated in cache — placing frequently-changing instructions at the end maximizes cache reuse',
        'Instructions at the beginning of the Dockerfile execute faster',
        'The order only affects the final image size, not build time'
      ],
      correct: 1,
      explanation: 'Docker\'s cache mechanism works per layer: when a layer changes (or when Docker detects it may have changed), all subsequent layers are rebuilt. That\'s why placing COPY package*.json and RUN npm install BEFORE COPY src/ ensures dependency installation is cached — it only re-executes when package.json changes, not when code changes.',
      reference: 'Practical rule: "what changes less frequently, earlier in the Dockerfile; what changes more frequently, later".'
    },
    {
      question: 'What is a multi-stage build and what is its main benefit for production?',
      options: [
        'It\'s a Dockerfile that uses multiple FROM in sequence to compile code in one stage and copy only the final binary to a minimal image — resulting in smaller images without build tools',
        'It\'s the practice of building to multiple registries simultaneously',
        'Multi-stage build is only needed for compiled languages like Go and C++',
        'It\'s a feature that reduces the number of layers in the final image'
      ],
      correct: 0,
      explanation: 'Multi-stage build uses multiple FROM blocks in the Dockerfile. The build stage contains compilation tools (compilers, SDKs). The final stage copies only the necessary artifacts (compiled binary, static assets). The result: the final image contains no compiler, SDK, or development tools — drastically reducing size (from ~800MB to ~10MB for Go apps) and attack surface.',
      reference: 'Tip: `FROM gcr.io/distroless/static-debian12` and `FROM scratch` are the most minimal bases for the final stage — for static binaries.'
    },
    {
      question: 'What is the difference between containers and VMs at the kernel level?',
      options: [
        'Containers have their own kernel, VMs share the host kernel',
        'Containers are isolated processes using Linux namespaces (isolation) and cgroups (resources); VMs emulate full hardware with their own kernel — containers share the host kernel',
        'Containers and VMs are equivalent in security and isolation',
        'VMs use namespaces, containers use a hypervisor'
      ],
      correct: 1,
      explanation: 'Containers are host processes isolated via namespaces (PID, network, mount, UTS, IPC) with resources controlled by cgroups. They share the host kernel — this is lighter but means: a kernel exploit affects all containers. VMs have their own kernel isolated via hypervisor (KVM, VMware) — stronger isolation but higher overhead.',
      reference: 'Security implication: for highly sensitive workloads, containers inside separate VMs (each VM with its own containers) provides layered isolation.'
    },
    {
      question: 'Why is running containers as root a security risk, even in development?',
      options: [
        'Root containers are slower',
        'If an attacker compromises the process in a container running as root, they can potentially escape the container to the host, especially with incorrect bind mount configurations or additional privileges',
        'Root inside the container has no impact outside it — isolation is complete',
        'Running as root increases memory consumption'
      ],
      correct: 1,
      explanation: 'Root inside the container has UID 0 — the same UID 0 as the host. With incorrect configurations (bind mounts of /etc, privileged mode, extra capabilities), the container root can write host files as root or escape completely. User namespaces mitigate this (mapping container UID 0 to a high UID on the host), but the standard practice is always to create a non-root user in the Dockerfile.',
      reference: 'Practice: `RUN useradd -u 1001 appuser && USER appuser` — always include in Dockerfile. In Kubernetes: SecurityContext.runAsNonRoot: true.'
    },
    {
      question: 'What is ".dockerignore" and why is it important for builds and security?',
      options: [
        'It\'s equivalent to .gitignore — has no security impact',
        'Defines which files are NOT sent to the Docker daemon in the build context — prevents including .env, .git, passwords, and large files that increase build time and may leak into images',
        'It\'s only needed for images that will be published to public registries',
        '.dockerignore is read by the container at runtime, not during build'
      ],
      correct: 1,
      explanation: 'When you run `docker build`, the Docker daemon receives the "build context" — the entire directory (or specified one). .dockerignore excludes files from that context. Without it: the .git directory may be included (exposing history), .env with passwords may be accidentally COPYed, and node_modules at 500MB is sent unnecessarily increasing build time.',
      reference: 'Minimal .dockerignore template: .git, .env, *.md, node_modules/, __pycache__/, .pytest_cache/, *.test.js'
    },
    {
      question: 'What is the practical difference between `docker run -v /host/path:/container/path` (bind mount) and a Docker Volume?',
      options: [
        'Bind mounts are faster, volumes are more secure',
        'Bind mount maps a specific host directory (you control where); Docker Volume is managed by the Docker daemon in /var/lib/docker/volumes — volumes are preferred for production data and are more portable',
        'Volumes only work with docker-compose, bind mounts with docker run',
        'There is no practical difference — they are aliases for the same feature'
      ],
      correct: 1,
      explanation: 'Bind mounts depend on a specific host path — problematic in different environments (dev vs prod) and potentially dangerous if the container can write to sensitive host paths. Docker Volumes are managed by Docker (isolated, portable, with drivers for different backends like NFS or cloud storage). For production application data, use volumes. For dev (hot reload of code), bind mounts are convenient.',
      reference: 'In Kubernetes: equivalents are hostPath (bind mount) and PersistentVolumes. hostPath is generally avoided in production for the same reasons.'
    },
    {
      question: 'How does `HEALTHCHECK` in the Dockerfile improve production operations and Kubernetes?',
      options: [
        'HEALTHCHECK replaces the Kubernetes liveness probe',
        'HEALTHCHECK defines how to check if the container is healthy; in Docker Compose and Swarm, unhealthy containers are restarted; in Kubernetes, liveness/readiness probes are used instead — but HEALTHCHECK is good for local testing',
        'HEALTHCHECK is required for the container to start',
        'HEALTHCHECK only works with HTTP applications'
      ],
      correct: 1,
      explanation: 'HEALTHCHECK instructs Docker to run a command periodically to check container health. In plain Docker and Compose, this determines when to restart the container. In Kubernetes, liveness and readiness probes in the manifest replace the Dockerfile\'s HEALTHCHECK — but keeping HEALTHCHECK is good practice for local testing and compatibility with other orchestrators.',
      reference: 'Important note: Kubernetes IGNORES the Dockerfile HEALTHCHECK and uses only liveness/readiness probes defined in the PodSpec.'
    }
  ],
  flashcards: [
    {
      front: 'Namespaces vs cgroups — what each does',
      back: '**Namespaces = isolation (what the process sees):**\n- PID: own processes (isolated PID 1)\n- Network: isolated network interface\n- Mount: isolated filesystem\n- UTS: own hostname\n- IPC: inter-process communication\n- User: UID mapping\n\n**cgroups = resource control (how much it can use):**\n- cpu: CPU limit\n- memory: memory limit\n- blkio: I/O limit\n\n**Difference from VMs:**\n- Container: isolated process, shares kernel\n- VM: own kernel, full hypervisor\n\n**Practical consequence:**\n- Without cgroup limits → container can consume\n  all CPU/RAM on the host\n- Always configure resources.limits in K8s!'
    },
    {
      front: 'Cache optimization in Dockerfile',
      back: '**Rule:** "changes less → earlier; changes more → later"\n\n**WRONG (always invalidates cache):**\n\`\`\`dockerfile\nCOPY . .\nRUN npm install\n\`\`\`\n\n**CORRECT (dependency cache):**\n\`\`\`dockerfile\nCOPY package*.json ./\nRUN npm ci --only=production\nCOPY src/ ./src/\n\`\`\`\n\n**Recommended order:**\n1. FROM (base image)\n2. OS dependency installation\n3. COPY dependency files\n4. App dependency installation\n5. COPY source code\n6. USER, EXPOSE, HEALTHCHECK, CMD\n\n**When cache is invalidated:**\nAny change in a layer invalidates\nall layers BELOW it.'
    },
    {
      front: 'Multi-stage build — production pattern',
      back: '**Template for Go:**\n\`\`\`dockerfile\n# Stage 1: BUILD\nFROM golang:1.21 AS builder\nWORKDIR /app\nCOPY go.* ./\nRUN go mod download\nCOPY . .\nRUN CGO_ENABLED=0 go build -o /app/server .\n\n# Stage 2: RUNTIME (minimal)\nFROM gcr.io/distroless/static-debian12\nCOPY --from=builder /app/server /server\nUSER nonroot:nonroot\nENTRYPOINT ["/server"]\n\`\`\`\n\n**Result:** ~1GB builder → ~10MB final\n\n**Runtime base templates:**\n- `scratch` → static binaries, 0 bytes\n- `distroless/static` → no shell, ~2MB\n- `distroless/base` → with libc, ~20MB\n- `alpine` → with shell, ~5MB\n- `slim` variants → OS with fewer packages\n\n**Security benefit:**\nNo compiler, no shell, fewer\nvulnerabilities in attack surface.'
    },
    {
      front: 'Container security basics — checklist',
      back: '**Dockerfile:**\n```\n[ ] Official and slim base image (alpine/slim)\n[ ] Non-root user (USER instruction)\n[ ] .dockerignore present\n[ ] HEALTHCHECK configured\n[ ] No hardcoded passwords/tokens\n[ ] Multi-stage if necessary\n```\n\n**Runtime (docker run / K8s):**\n```\n[ ] --memory and --cpus defined\n[ ] Do not use --privileged\n[ ] Do not mount /etc or /var/run/docker.sock\n[ ] Do not use --net=host unless needed\n```\n\n**Vulnerability scanning:**\n```bash\ntrivy image myapp:v1.0.0\ndocker scout cves myapp:v1.0.0\n```\n\n**Check user:**\n```bash\ndocker inspect myapp |\n  jq \'.[].Config.User\'\n# Expected: "1001" or "appuser"\n# Not: "" (root)\n```'
    },
    {
      front: 'Docker Layer System — how it works',
      back: '**Structure:**\n```\nFROM ubuntu:22.04    → Layer 1 [read-only]\nRUN apt-get update  → Layer 2 [read-only]\nCOPY app/ /app/     → Layer 3 [read-only]\nCMD ["./app"]       → Layer 4 [read-only]\n                      ↓\nContainer Runtime → R/W Layer (ephemeral)\n```\n\n**Layer sharing:**\n- R/O layers are shared between containers\n- 10 containers with same image = 10x Container Layer\n  but only 1x the image layers\n\n**Practical consequences:**\n- Data written to the container layer is\n  LOST when the container stops\n- Use volumes for persistent data\n- Larger images = more data in R/O layers\n- docker history shows each layer size\n\n**Cache hit = layer reused from disk**\n**Cache miss = layer rebuilt**'
    },
    {
      front: 'Essential container debug commands',
      back: '**Logs:**\n```bash\ndocker logs <container> -f --tail 100\ndocker logs <container> --since 1h\n```\n\n**Exec (enter container):**\n```bash\ndocker exec -it <container> sh  # alpine\ndocker exec -it <container> bash  # ubuntu/debian\ndocker exec <container> env | grep API\n```\n\n**Inspection:**\n```bash\ndocker inspect <container>  # full config\ndocker stats <container>    # real-time CPU, RAM, network\ndocker top <container>      # processes inside\n```\n\n**File copy:**\n```bash\ndocker cp <container>:/app/log.txt ./log.txt\ndocker cp ./config.yaml <container>:/app/config.yaml\n```\n\n**Clean everything (dev only!):**\n```bash\ndocker system prune -a --volumes\n# Removes: stopped containers, unused images,\n# orphaned volumes, unused networks\n```'
    }
  ],
  lab: {
    scenario: 'You received a repository with a Python Flask application that has an incorrect Dockerfile (large image, root user, no .dockerignore). You will optimize the Dockerfile, add security, and ensure the final image is suitable for production.',
    objective: 'Optimize a real Dockerfile: multi-stage, non-root user, efficient cache, .dockerignore, HEALTHCHECK, and validate with trivy.',
    duration: '25-35 minutes',
    steps: [
      {
        title: 'Analyze the current Dockerfile and identify problems',
        instruction: `Create a sample Dockerfile with typical problems and analyze them using Docker commands.`,
        hints: [
          'Use `docker history` to see the size of each layer',
          'Use `docker inspect` to check if the container runs as root',
          'Analyze the instruction order to identify cache inefficiencies'
        ],
        solution: `\`\`\`bash
# Create the sample project with problems
mkdir flask-app && cd flask-app

cat > requirements.txt << 'EOF'
flask==3.0.0
gunicorn==21.2.0
requests==2.31.0
EOF

cat > app.py << 'EOF'
from flask import Flask, jsonify
app = Flask(__name__)

@app.route('/health')
def health():
    return jsonify({"status": "ok"})

@app.route('/')
def index():
    return jsonify({"message": "Hello from Flask!"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
EOF

# BAD Dockerfile (for analysis)
cat > Dockerfile.bad << 'EOF'
FROM python:3.11
WORKDIR /app
COPY . .
RUN pip install -r requirements.txt
EXPOSE 5000
CMD ["python", "app.py"]
EOF

# Build and analyze
docker build -t flask-bad:v1 -f Dockerfile.bad .
docker history flask-bad:v1

# Check size
docker images flask-bad:v1

# Check user (should be root - problem!)
docker run -d --name flask-test flask-bad:v1
docker exec flask-test whoami  # should show "root"
docker inspect flask-test | grep '"User"'
docker stop flask-test && docker rm flask-test
\`\`\``,
        verify: `\`\`\`bash
# Verify bad Dockerfile was created
ls Dockerfile.bad app.py requirements.txt

# Verify image was built
docker images flask-bad:v1
# Expected output: image ~1GB or more

# Verify root user
docker run --rm flask-bad:v1 whoami
# Expected output: root (problem identified)
\`\`\``
      },
      {
        title: 'Create .dockerignore and optimized Dockerfile',
        instruction: `Create a proper .dockerignore and an optimized Dockerfile with: efficient cache, non-root user, HEALTHCHECK, and slim image.`,
        hints: [
          'Copy requirements.txt BEFORE COPY . . to cache installation',
          'Use python:3.11-slim instead of python:3.11',
          'Create a user with a specific UID for reproducibility'
        ],
        solution: `\`\`\`bash
# Create .dockerignore
cat > .dockerignore << 'EOF'
.git
.gitignore
*.md
.env
.env.*
__pycache__/
*.pyc
*.pyo
.pytest_cache/
.coverage
Dockerfile*
docker-compose*
*.log
.DS_Store
EOF

# OPTIMIZED Dockerfile
cat > Dockerfile << 'EOF'
FROM python:3.11-slim AS base

# Metadata
LABEL maintainer="platform-team" \\
      version="1.0.0" \\
      description="Flask API"

WORKDIR /app

# Dependencies first (efficient cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create non-root user
RUN useradd --create-home --uid 1001 --shell /bin/bash appuser

# Code after (changes frequently)
COPY app.py .

# Correct permissions
RUN chown -R appuser:appuser /app

# Don't run as root
USER appuser

# Exposed port (documentation)
EXPOSE 5000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/health')" || exit 1

# Production: use gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "app:app"]
EOF

# Build the optimized version
docker build -t flask-good:v1 .

# Compare sizes
docker images | grep flask
\`\`\``,
        verify: `\`\`\`bash
# Verify image was built
docker images flask-good:v1
# Expected output: ~200MB (slim) vs ~1GB (bad)

# Verify correct user
docker run --rm flask-good:v1 whoami
# Expected output: appuser (not root!)

# Verify .dockerignore was created
ls .dockerignore

# Check layers
docker history flask-good:v1 --no-trunc | head -10
\`\`\``
      },
      {
        title: 'Test cache efficiency and build performance',
        instruction: `Verify that the cache works correctly: modify only the app code and confirm that dependencies are not reinstalled.`,
        hints: [
          'Modify only app.py (not requirements.txt)',
          'The rebuild should use cache for pip installation',
          'Compare the first build time with the rebuild'
        ],
        solution: `\`\`\`bash
# Simulate code change (not dependencies)
cat >> app.py << 'EOF'

@app.route('/version')
def version():
    return jsonify({"version": "1.0.1"})
EOF

# Rebuild — should use cache for dependencies
time docker build -t flask-good:v1.0.1 .
# Notice: "CACHED" on pip install lines

# Compare: if we change requirements.txt, cache is invalidated
echo "boto3==1.34.0" >> requirements.txt
time docker build -t flask-good:v1.0.2 .
# Now pip install runs again (cache invalidated)

# Restore
sed -i '/boto3/d' requirements.txt

# Run and test the application
docker run -d --name flask-prod \\
  -p 5000:5000 \\
  --memory="256m" \\
  --cpus="0.5" \\
  flask-good:v1.0.1

# Wait for healthcheck
sleep 5
docker ps  # STATUS should be "healthy" or "starting"

# Test endpoints
curl http://localhost:5000/health
curl http://localhost:5000/

# Cleanup
docker stop flask-prod && docker rm flask-prod
\`\`\``,
        verify: `\`\`\`bash
# Verify the container is running
docker run -d --name verify-flask -p 5001:5000 flask-good:v1.0.1
sleep 3

# Test health endpoint
curl -sf http://localhost:5001/health
# Expected output: {"status":"ok"}

# Verify not running as root
docker exec verify-flask whoami
# Expected output: appuser

# Check resource limits
docker inspect verify-flask | grep -A 3 '"Memory"'
# (demonstration — limits are from run, not Dockerfile)

# Cleanup
docker stop verify-flask && docker rm verify-flask
echo "Verification completed successfully!"
\`\`\``
      },
      {
        title: 'Scan for vulnerabilities with Trivy',
        instruction: `Install Trivy and scan both images (good and bad) to compare attack surfaces.`,
        hints: [
          'Trivy can be installed with curl or via package manager',
          'Compare the number of HIGH/CRITICAL CVEs between images',
          'Slim/alpine images have fewer vulnerabilities'
        ],
        solution: `\`\`\`bash
# Install Trivy (Linux/Mac)
curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin

# OR via homebrew on Mac:
# brew install trivy

# Scan the bad image (python:3.11 full)
trivy image --severity HIGH,CRITICAL flask-bad:v1

# Scan the good image (python:3.11-slim)
trivy image --severity HIGH,CRITICAL flask-good:v1

# Compare number of vulnerabilities
echo "=== Comparison ==="
echo "BAD image (total):"
trivy image --severity HIGH,CRITICAL --quiet flask-bad:v1 2>&1 | grep "Total:"

echo "GOOD image (total):"
trivy image --severity HIGH,CRITICAL --quiet flask-good:v1 2>&1 | grep "Total:"
\`\`\``,
        verify: `\`\`\`bash
# Verify trivy is installed
trivy --version
# Expected output: Version: X.X.X

# Verify good image has fewer vulnerabilities
trivy image --severity CRITICAL --quiet flask-good:v1 2>&1 | tail -5
# Expected output: significantly fewer CVEs than the bad image

# Final cleanup
docker rmi flask-bad:v1 flask-good:v1 flask-good:v1.0.1 flask-good:v1.0.2 2>/dev/null || true
echo "Lab complete!"
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Build fails with "Cannot connect to the Docker daemon"',
      difficulty: 'easy',
      symptom: 'When running `docker build` or `docker run`, the error "Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?" appears.',
      diagnosis: `\`\`\`bash
# 1. Check if Docker daemon is running
systemctl status docker
# or
service docker status

# 2. Check if socket exists
ls -la /var/run/docker.sock

# 3. Check user permissions
groups \$USER
# User needs to be in the 'docker' group

# 4. On Mac/Windows, check if Docker Desktop is open
docker info 2>&1 | head -5
\`\`\``,
      solution: `**Solution 1 — Start Docker daemon:**
\`\`\`bash
sudo systemctl start docker
sudo systemctl enable docker  # start automatically
\`\`\`

**Solution 2 — Add user to docker group (Linux):**
\`\`\`bash
sudo usermod -aG docker \$USER
# Need to logout and login to take effect
# OR:
newgrp docker  # apply without logout
\`\`\`

**Solution 3 — Mac/Windows:**
Open Docker Desktop and wait for it to initialize (icon in system tray).

**Verify:**
\`\`\`bash
docker info  # should show daemon information
docker ps    # should list containers (empty is OK)
\`\`\``
    },
    {
      title: 'Container starts but exits immediately (exit code != 0)',
      difficulty: 'medium',
      symptom: 'When running `docker run myapp`, the container briefly appears in `docker ps -a` with status "Exited (1)" or another non-zero exit code. `docker logs myapp` shows an error.',
      diagnosis: `\`\`\`bash
# 1. See exit code and logs
docker ps -a --filter name=myapp
docker logs myapp  # See error message

# 2. Run interactively for debug
docker run --rm -it myapp sh
# Try running CMD manually inside the container

# 3. Check CMD/ENTRYPOINT
docker inspect myapp | jq '.[].Config.Cmd'
docker inspect myapp | jq '.[].Config.Entrypoint'

# 4. Check if necessary files exist
docker run --rm -it myapp ls /app/
\`\`\``,
      solution: `**Common cause 1 — File not found:**
\`\`\`bash
# Check if COPY copied the correct files
docker run --rm -it myapp find /app -type f
# If files are missing, review Dockerfile and .dockerignore
\`\`\`

**Common cause 2 — Permission denied:**
\`\`\`bash
# Typical error: "Permission denied: /app/start.sh"
# Solution in Dockerfile:
RUN chmod +x /app/start.sh
# OR ensure file came from repository with execute permission
\`\`\`

**Common cause 3 — Required environment variable:**
\`\`\`bash
# Check what variables the app needs
docker run --rm -e DATABASE_URL=postgres://... myapp
# OR inspect the image entrypoint
\`\`\`

**Common cause 4 — CMD in wrong format:**
\`\`\`dockerfile
# WRONG: CMD with shell that doesn't exist in container
CMD python app.py  # uses /bin/sh -c
# CORRECT: exec form (without shell)
CMD ["python", "app.py"]
\`\`\``
    }
  ]
};
