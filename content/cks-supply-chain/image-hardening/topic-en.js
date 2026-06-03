window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['cks-supply-chain/image-hardening'] = {
  theory: `# Container Image Hardening

## Exam Relevance
> CKS expects you to understand and apply image hardening principles: minimal base images, multi-stage builds, non-root users, and vulnerability reduction. Appears in Supply Chain Security domain (~8%).

## Why Harden Container Images?

A container image is the initial attack surface. A bloated image with:
- Unnecessary packages (gcc, make, curl, bash)
- Root-running processes
- World-writable files
- Debug tools (strace, tcpdump)
- Leaked secrets in layers

...gives attackers more to work with if the container is compromised.

## Base Image Selection

### Image Size Comparison

| Base Image | Size | Shell | Package Manager | Use Case |
|-----------|------|-------|----------------|----------|
| ubuntu:22.04 | ~77MB | bash | apt | General purpose, debugging |
| debian:slim | ~45MB | bash | apt | Slim debian |
| alpine:3.19 | ~7MB | sh | apk | Small apps, small attack surface |
| gcr.io/distroless/static | ~2MB | NONE | NONE | Static binaries |
| gcr.io/distroless/base | ~20MB | NONE | NONE | Dynamic apps (glibc) |
| scratch | ~0MB | NONE | NONE | Static Go/Rust binaries |

### Distroless Images (Google)

\`\`\`dockerfile
# Go application with distroless
FROM golang:1.22 AS builder
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

FROM gcr.io/distroless/static-debian12
COPY --from=builder /app/main /
USER nonroot:nonroot
CMD ["/main"]
\`\`\`

**Distroless benefits:**
- No shell (no kubectl exec -- sh)
- No package manager (can't install tools)
- No libc (static-debian12) or minimal libc (base-debian12)
- CIS Benchmark compliant out of the box for many controls

\`\`\`bash
# Test: distroless containers have no shell
kubectl exec my-distroless-pod -- sh
# OCI runtime exec failed: exec failed: unable to start container process: exec: "sh": executable file not found in $PATH
\`\`\`

## Multi-Stage Builds

Multi-stage builds separate the build environment from the runtime image:

\`\`\`dockerfile
# Stage 1: Build (large, with build tools)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

# Stage 2: Runtime (small, only what's needed)
FROM node:20-alpine AS runtime
WORKDIR /app
# Only copy what's needed to run
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# Security: non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser:appgroup

EXPOSE 3000
CMD ["node", "dist/server.js"]
\`\`\`

### Multi-stage for Java

\`\`\`dockerfile
# Build stage with full JDK
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn package -DskipTests

# Runtime with minimal JRE (not JDK)
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=build /app/target/*.jar app.jar
USER appuser
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
\`\`\`

## User and Permission Hardening

\`\`\`dockerfile
# Create a dedicated user for the application
FROM alpine:3.19

# Install app as root, then drop privileges
RUN apk add --no-cache myapp && \
    addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup && \
    chown -R appuser:appgroup /etc/myapp

# Switch to non-root user
USER 1001:1001

# Or: use numeric IDs directly
USER 1001

EXPOSE 8080
CMD ["myapp"]
\`\`\`

\`\`\`bash
# Verify in Kubernetes
kubectl exec <pod> -- id
# Expected: uid=1001(appuser) gid=1001(appgroup)

# Verify not running as root
kubectl exec <pod> -- sh -c "cat /etc/passwd | grep root | head -1"
\`\`\`

## Removing Unnecessary Tools

\`\`\`dockerfile
# Remove tools that should not be in production
FROM ubuntu:22.04
RUN apt-get update && apt-get install -y \
    # ONLY install what you need
    ca-certificates \
    && \
    # Remove apt cache
    rm -rf /var/lib/apt/lists/* && \
    # Remove debugging/attack tools if somehow present
    rm -f /usr/bin/wget /usr/bin/curl /usr/bin/nc* && \
    # Remove SUID/SGID binaries (potential privilege escalation)
    find / -perm /6000 -type f 2>/dev/null -exec chmod a-s {} \;
\`\`\`

\`\`\`bash
# Check for SUID binaries in an image
docker run --rm nginx:latest find / -perm /6000 -type f 2>/dev/null

# Check for setuid binaries in a running pod
kubectl exec <pod> -- find / -perm /4000 -type f 2>/dev/null
\`\`\`

## Dockerfile Security Best Practices

\`\`\`dockerfile
# Good Dockerfile security practices:

# 1. Pin specific versions (no :latest)
FROM alpine:3.19.1

# 2. Don't run as root
USER 1001

# 3. Use COPY not ADD (COPY is more explicit)
COPY app.jar /app/

# 4. No secrets in Dockerfile/layers
# BAD:
# ENV API_KEY=secret123
# RUN curl -H "Auth: $API_KEY" ...

# 5. Minimal packages
RUN apk add --no-cache ca-certificates tzdata

# 6. Set workdir explicitly
WORKDIR /app

# 7. Read-only filesystem friendly: write to /tmp, not /app
VOLUME ["/tmp"]

# 8. Health checks
HEALTHCHECK --interval=30s --timeout=3s \
  CMD curl -f http://localhost:8080/health || exit 1

# 9. Least privilege: EXPOSE only needed ports
EXPOSE 8080

# 10. Use .dockerignore to avoid leaking sensitive files
# .dockerignore:
# .git
# *.env
# *.key
# node_modules
# tests/
\`\`\`

## Scanning Images During Build

\`\`\`bash
# Trivy scan as part of CI/CD
trivy image --exit-code 1 --severity HIGH,CRITICAL myapp:latest

# Fail build on critical vulnerabilities
if trivy image --exit-code 1 --severity CRITICAL myapp:latest; then
  docker push myapp:latest
else
  echo "CRITICAL vulnerabilities found — not pushing"
  exit 1
fi

# Scan Dockerfile for misconfigurations
trivy config Dockerfile
trivy config --exit-code 1 --severity HIGH Dockerfile
\`\`\`

## .dockerignore Best Practices

\`\`\`
# .dockerignore — prevents sensitive files from being copied to image
.git
.gitignore
**/*.md
**/.env
**/*.key
**/*.pem
**/*.cert
**/node_modules
**/target
tests/
docs/
README*
Makefile
Dockerfile*
.dockerignore
\`\`\`

## Common Mistakes

- **Using FROM ubuntu:latest**: Mutable tag, large attack surface
- **Not switching to non-root**: Most exploits rely on root
- **Installing curl/wget in production images**: Enables attacker tooling
- **Secrets in environment variables or Docker layers**: Secrets baked in are extractable with docker history
- **Not removing build tools**: gcc, make, git left in production image

## Killer.sh Style Challenge

> **Scenario**: The current Dockerfile uses FROM ubuntu:22.04, installs curl and wget, and runs as root. Rewrite it to use Alpine, remove unnecessary tools, and set a non-root user.
`,

  quiz: [
    {
      question: 'Why are distroless container images more secure than Alpine or Ubuntu images?',
      options: [
        'Distroless images have no shell, no package manager, and minimal OS packages — attackers cannot run interactive commands or install tools',
        'Distroless images automatically scan for vulnerabilities at runtime',
        'Distroless images encrypt all container filesystem data',
        'Distroless images automatically run as a random non-root UID'
      ],
      correct: 0,
      explanation: 'Distroless images (google/distroless) contain only the application and its runtime dependencies. No shell (sh/bash), no package manager (apt/apk/yum), no curl/wget. If an attacker gains code execution, they cannot get an interactive shell or install additional attack tools.',
      reference: 'Image Hardening — Distroless Images section.'
    },
    {
      question: 'What is the main security benefit of multi-stage Docker builds?',
      options: [
        'Build tools, compilers, and test dependencies are not included in the final production image',
        'Each stage of the build runs as a different non-root user',
        'Multi-stage builds automatically sign the image with Cosign',
        'Build caches are isolated between stages, preventing data leakage'
      ],
      correct: 0,
      explanation: 'Multi-stage builds let you use a full build environment (with gcc, maven, npm, etc.) in early stages but only copy the final artifacts to the production image. The production image does not contain the build tools, reducing the attack surface.',
      reference: 'Image Hardening — Multi-Stage Builds section.'
    },
    {
      question: 'Why should SUID binaries be removed from container images?',
      options: [
        'SUID binaries run with the owner\'s permissions (often root) — exploits in SUID binaries can escalate container privileges',
        'SUID binaries consume too much memory',
        'Kubernetes does not support SUID file execution in containers',
        'SUID binaries are not compatible with SELinux policies'
      ],
      correct: 0,
      explanation: 'SUID (Set User ID) bits cause a file to execute with the permissions of the file\'s owner rather than the caller. A SUID root binary can be exploited to gain root within the container. Removing them (chmod a-s) eliminates this privilege escalation path.',
      reference: 'Image Hardening — Removing Unnecessary Tools section.'
    },
    {
      question: 'What is the risk of using ADD instead of COPY in Dockerfiles?',
      options: [
        'ADD can download URLs and automatically extract archives, potentially introducing unexpected files or triggering SSRF',
        'ADD copies with root ownership; COPY respects file permissions',
        'ADD includes .git directories; COPY respects .dockerignore',
        'ADD creates world-writable files; COPY preserves source permissions'
      ],
      correct: 0,
      explanation: 'ADD has two extra features: it can add files from URLs (network access during build) and auto-extracts tar archives. Both can lead to unexpected behavior. COPY is explicit and predictable. Best practice: use COPY unless you specifically need ADD\'s URL/extract features.',
      reference: 'Image Hardening — Dockerfile Security Best Practices section.'
    },
    {
      question: 'Why should secrets NOT be set as environment variables in a Dockerfile (ENV)?',
      options: [
        'Secrets in ENV are permanently stored in the image layers and visible via docker history or docker inspect',
        'ENV variables are not accessible to the running application',
        'Docker encrypts ENV values with the image digest, making them unreadable',
        'ENV variables are limited to 256 bytes, too small for secrets'
      ],
      correct: 0,
      explanation: 'Docker image layers are immutable and include all ENV values. Even if you run "RUN unset API_KEY" in a later layer, the value is still visible in earlier layers via docker history --no-trunc or docker image inspect. Build-time secrets should use Docker BuildKit\'s --secret flag.',
      reference: 'Image Hardening — Dockerfile Security Best Practices section.'
    },
    {
      question: 'What does trivy config Dockerfile check?',
      options: [
        'Dockerfile misconfigurations: running as root, not using specific tags, exposed sensitive ports',
        'Vulnerability CVEs in packages installed in the Dockerfile',
        'Syntax errors in the Dockerfile',
        'License compatibility of installed packages'
      ],
      correct: 0,
      explanation: '"trivy config" (formerly trivy dockerfile) scans Dockerfile instructions for security misconfigurations: running as root (no USER instruction), using :latest tags, exposing dangerous ports, not using COPY instead of ADD, etc. It\'s different from image scanning (which checks CVEs).',
      reference: 'Image Hardening — Scanning Images During Build section.'
    },
    {
      question: 'What is the purpose of a .dockerignore file for security?',
      options: [
        'Prevents sensitive files (.env, *.key, .git, node_modules) from being accidentally copied into the image during docker build',
        'Lists files that Docker should encrypt in the image',
        'Defines which Dockerfile commands to skip during build',
        'Specifies files that should not be scanned by Trivy'
      ],
      correct: 0,
      explanation: '.dockerignore works like .gitignore for Docker builds — it excludes files from being sent to the Docker build context. Without it, files like .env (environment variables), *.key (private keys), .git (full git history), and test data may be included in the image.',
      reference: 'Image Hardening — .dockerignore Best Practices section.'
    },
    {
      question: 'Why is FROM scratch most secure but also most limiting?',
      options: [
        'scratch is an empty image with no OS, libraries, or shell — maximum security but requires statically compiled binaries',
        'scratch is a special Docker registry that requires authentication',
        'scratch provides a secure sandbox environment with memory encryption',
        'scratch images automatically block all network access'
      ],
      correct: 0,
      explanation: 'FROM scratch means "start from nothing" — completely empty. The application must be a statically compiled binary with all dependencies included (common for Go, Rust). No shell, no libc, no nothing. Most secure possible baseline but only works for statically linked applications.',
      reference: 'Image Hardening — Base Image Selection table.'
    }
  ],

  flashcards: [
    {
      front: 'What are the most secure base images from smallest attack surface to largest?',
      back: 'scratch (~0MB): empty, static binaries only (Go, Rust)\ndistroless/static (~2MB): no shell, no OS packages\ndistroless/base (~20MB): minimal with glibc\nalpine (~7MB): musl libc, sh shell, apk\ndebian:slim (~45MB): bash, apt\nubuntu (~77MB): full OS\n\nFor CKS: prefer distroless or alpine\nKey: no shell = no interactive container exec attack\nNo package manager = cannot install attack tools'
    },
    {
      front: 'Write a multi-stage Dockerfile for a Go application',
      back: '# Stage 1: Build\nFROM golang:1.22-alpine AS builder\nWORKDIR /app\nCOPY go.* ./\nRUN go mod download\nCOPY . .\nRUN CGO_ENABLED=0 GOOS=linux go build -o main .\n\n# Stage 2: Runtime\nFROM gcr.io/distroless/static-debian12\nCOPY --from=builder /app/main /main\nUSER nonroot:nonroot\nEXPOSE 8080\nCMD ["/main"]\n\nResult: tiny, no-shell image with just the Go binary'
    },
    {
      front: 'What are the key Dockerfile security rules?',
      back: '1. Pin versions: FROM alpine:3.19.1 (not :latest)\n2. Run as non-root: USER 1001\n3. Use COPY not ADD (no URL fetching)\n4. No secrets in ENV or ARG (visible in docker history)\n5. Remove unnecessary packages: only install what\'s needed\n6. Remove SUID binaries: find / -perm /6000 -exec chmod a-s {} \\;\n7. .dockerignore: exclude .env, *.key, .git\n8. Multi-stage: exclude build tools from final image\n9. Minimal EXPOSE: only required ports\n10. HEALTHCHECK: define container health'
    },
    {
      front: 'How do you find and remove SUID binaries from a container image?',
      back: '# Find SUID binaries in a running container:\nkubectl exec <pod> -- find / -perm /4000 -type f 2>/dev/null\n\n# Find in image during build:\nRUN find / -perm /6000 -type f 2>/dev/null -exec chmod a-s {} \\;\n# Note: /6000 matches both SUID (4000) and SGID (2000)\n\n# Check with trivy\ntrivy image --scanners vuln,config myimage:tag\n\n# Common SUID binaries: sudo, su, passwd, ping, mount\n# These allow privilege escalation even from non-root'
    },
    {
      front: 'What is the risk of storing secrets in Docker ENV or during docker build?',
      back: 'Problem: All image layers are permanent.\n\ndocker history --no-trunc myimage:tag\n# Shows all layer commands including ENV values!\n\nSecure alternatives:\n1. Build-time secrets (Docker BuildKit):\n   --secret id=mypassword,src=./password.txt\n   RUN --mount=type=secret,id=mypassword ...\n\n2. Runtime secrets (Kubernetes Secrets):\n   env:\n   - name: DB_PASSWORD\n     valueFrom:\n       secretKeyRef: ...\n\n3. Secret management: Vault, ESO, Sealed Secrets'
    }
  ],

  lab: {
    scenario: 'You need to harden a simple Python web application\'s container image. The current Dockerfile uses ubuntu:22.04, installs python3 and curl, and runs as root.',
    objective: 'Apply image hardening best practices: switch to minimal base image, remove unnecessary tools, run as non-root user.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Analyze the current (insecure) Dockerfile',
        instruction: `Examine the current Dockerfile and identify security issues.

\`\`\`bash
# Create the test directory and insecure Dockerfile
mkdir -p /tmp/hardening-lab && cd /tmp/hardening-lab

cat <<'EOF' > Dockerfile.insecure
FROM ubuntu:22.04

# Install everything including unnecessary tools
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    curl \
    wget \
    vim \
    gcc

# Expose the app secret (BAD!)
ENV API_KEY=super-secret-key-12345

# Copy and run as root
COPY app.py /app/
WORKDIR /app
EXPOSE 5000
CMD ["python3", "app.py"]
EOF

# Create a simple test app
cat <<'EOF' > app.py
from http.server import HTTPServer, BaseHTTPRequestHandler
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"Hello, CKS!")
HTTPServer(('', 5000), Handler).serve_forever()
EOF

# List security problems
echo "=== Security Issues in Dockerfile.insecure ==="
echo "1. ubuntu:22.04 - large attack surface"
echo "2. curl, wget, vim, gcc installed - attack tools"
echo "3. ENV API_KEY - secret in image layer!"
echo "4. Running as root (no USER instruction)"
echo "5. No version pinning (:22.04 mutable tag)"
\`\`\``,
        hints: [
          'docker history --no-trunc on the image would reveal the API_KEY',
          'gcc is a compiler — not needed in production'
        ],
        solution: `\`\`\`bash
mkdir -p /tmp/hardening-lab && cd /tmp/hardening-lab
# Create files as shown above
\`\`\``,
        verify: `\`\`\`bash
ls /tmp/hardening-lab/
# Expected: Dockerfile.insecure  app.py
\`\`\``
      },
      {
        title: 'Create a hardened Dockerfile',
        instruction: `Rewrite the Dockerfile with security best practices.

\`\`\`bash
cat <<'EOF' > /tmp/hardening-lab/Dockerfile
# Stage 1: only if we need build deps (not needed here, but good practice)
# Use alpine for minimal attack surface
FROM python:3.12-alpine

# Create non-root user first
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# Install ONLY what's needed
RUN apk add --no-cache ca-certificates

# Copy app (do NOT include build-time secrets)
COPY --chown=appuser:appgroup app.py /app/

WORKDIR /app

# Switch to non-root user
USER 1001:1001

# Document the port
EXPOSE 5000

# Note: no ENV with secrets — pass at runtime via K8s Secret
CMD ["python3", "app.py"]
EOF

# Compare sizes (if Docker is available)
# docker build -t insecure -f Dockerfile.insecure . && docker images insecure
# docker build -t hardened -f Dockerfile . && docker images hardened
echo "Hardened Dockerfile created"
cat /tmp/hardening-lab/Dockerfile
\`\`\``,
        hints: [
          'python:3.12-alpine already includes Python — no need to install it',
          'ca-certificates is needed for HTTPS requests (common requirement)',
          'The API_KEY is gone — pass it via Kubernetes Secret at runtime'
        ],
        solution: `\`\`\`bash
cat /tmp/hardening-lab/Dockerfile
# Should show: FROM python:3.12-alpine, USER 1001, no curl/wget/ENV secrets
\`\`\``,
        verify: `\`\`\`bash
# Verify the hardened Dockerfile has required security elements:
grep "USER" /tmp/hardening-lab/Dockerfile
# Expected: USER 1001:1001

# Verify no secret in ENV
grep "ENV.*KEY\|ENV.*SECRET\|ENV.*PASSWORD" /tmp/hardening-lab/Dockerfile
# Expected: (no output)

# Verify no unnecessary packages
grep "curl\|wget\|vim\|gcc" /tmp/hardening-lab/Dockerfile
# Expected: (no output - these should not be in the hardened version)
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Distroless container cannot be debugged',
      difficulty: 'easy',
      symptom: 'A production pod uses distroless image. An issue occurs and you cannot run kubectl exec -- sh to debug.',
      diagnosis: `\`\`\`bash
# Confirm: no shell available
kubectl exec <pod> -- sh
# Error: exec: "sh": executable file not found in $PATH

kubectl exec <pod> -- ls
# Error: exec: "ls": executable file not found in $PATH
\`\`\``,
      solution: `**Options for debugging distroless containers:**

**1. Ephemeral debug container (K8s 1.23+ stable):**
\`\`\`bash
# Add a debug container with tools to the running pod
kubectl debug -it <pod-name> \
  --image=alpine:3.19 \
  --target=<container-name>  # shares process namespace
# Now you have a shell inside alpine, sharing the pod's network/processes
\`\`\`

**2. Copy pod with debug image (non-destructive):**
\`\`\`bash
kubectl debug <pod-name> -it --copy-to=debug-pod \
  --set-image=*=ubuntu:22.04
\`\`\`

**3. Node debugging:**
\`\`\`bash
kubectl debug node/<node-name> -it --image=ubuntu:22.04
\`\`\`

**4. Build debug variant:**
\`\`\`dockerfile
# Dockerfile.debug
FROM myapp:latest AS debug
# Switch to debug-friendly base
FROM ubuntu:22.04
COPY --from=myapp:latest / /
RUN apt-get install -y strace tcpdump
\`\`\``
    },
    {
      title: 'Application fails to start as non-root due to permission denied on bound port',
      difficulty: 'medium',
      symptom: 'After changing USER to 1001 in Dockerfile, the container fails with "bind: permission denied" on port 80.',
      diagnosis: `\`\`\`bash
kubectl logs <pod-name> | grep "permission denied\|bind\|EACCES"
# Shows: bind: address already in use OR permission denied on port 80

# The issue: ports below 1024 require root or NET_BIND_SERVICE capability
# Port 80: needs privilege
# Port 8080: does not need privilege
\`\`\``,
      solution: `**Fix: Change the application to listen on port 8080+ or grant NET_BIND_SERVICE**

**Option 1 (preferred): Change port in application config**
\`\`\`bash
# Change app to listen on 8080 instead of 80
# In Dockerfile:
EXPOSE 8080
# In app config: PORT=8080

# Then use a Kubernetes Service to expose on 80:
apiVersion: v1
kind: Service
spec:
  ports:
  - port: 80       # external port
    targetPort: 8080  # container port
\`\`\`

**Option 2: Add NET_BIND_SERVICE capability**
\`\`\`yaml
# In Pod securityContext (only this capability)
securityContext:
  capabilities:
    drop: ["ALL"]
    add: ["NET_BIND_SERVICE"]  # allowed in PSS Restricted
\`\`\`

**Option 3: Use authbind or set_cap in Dockerfile**
\`\`\`dockerfile
RUN apk add libcap && setcap cap_net_bind_service=+ep /app/server
\`\`\``
    }
  ]
};
