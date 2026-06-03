window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['app-design-build/container-images'] = {
  theory: `# Container Images & Dockerfile

## Exam Relevance
> Container image concepts are foundational to CKAD. You must understand Dockerfile instructions, image layers, tagging, and how to work with images in Kubernetes (imagePullPolicy, private registries, image pull secrets). Expect image-related troubleshooting questions.

## Dockerfile Fundamentals

\`\`\`dockerfile
# Base image — always start from an existing image
FROM ubuntu:22.04

# Metadata (optional but good practice)
LABEL maintainer="dev@example.com" version="1.0"

# Set working directory (creates if doesn't exist)
WORKDIR /app

# Copy files from build context to image
COPY . .                          # Copy everything
COPY src/ /app/src/               # Copy specific directory
ADD https://example.com/file.tar /app/  # ADD can fetch URLs and auto-extract

# Run commands during BUILD (creates new layer)
RUN apt-get update && apt-get install -y curl \
    && rm -rf /var/lib/apt/lists/*   # Clean up in same layer

# Set environment variables
ENV NODE_ENV=production \
    PORT=8080

# Expose port (documentation only — does NOT publish)
EXPOSE 8080

# Non-root user (security best practice)
RUN adduser --disabled-password --uid 1000 appuser
USER appuser

# ENTRYPOINT: fixed command, cannot be overridden by pod command
# CMD: default arguments, overridden by pod command
ENTRYPOINT ["node"]
CMD ["server.js"]
\`\`\`

## ENTRYPOINT vs CMD

| Instruction | Purpose | Overridable |
|-------------|---------|-------------|
| \`ENTRYPOINT\` | The executable to run | Only with \`--entrypoint\` flag |
| \`CMD\` | Default arguments | Yes — by pod \`command\` field |

\`\`\`dockerfile
# Example:
ENTRYPOINT ["python3", "-m"]
CMD ["http.server", "8080"]
# Runs: python3 -m http.server 8080

# In Kubernetes pod spec:
# command: replaces CMD
# args: replaces CMD (if no command specified, replaces CMD args)
\`\`\`

\`\`\`yaml
# Kubernetes pod spec relationship:
spec:
  containers:
  - name: app
    image: myapp:1.0
    command: ["python3", "-m"]   # Replaces ENTRYPOINT
    args: ["http.server", "9090"] # Replaces CMD
\`\`\`

## Image Layers and Caching

Each \`RUN\`, \`COPY\`, \`ADD\` creates a new layer. Layers are cached and reused.

\`\`\`dockerfile
# BAD: invalidates cache for all following layers if package list changes
COPY . .
RUN pip install -r requirements.txt

# GOOD: copy dependencies first (rarely changes), then app code
COPY requirements.txt .
RUN pip install -r requirements.txt   # Cached unless requirements.txt changes
COPY . .                               # Only this invalidates if code changes
\`\`\`

## Multi-Stage Builds

Build in one stage, copy artifacts to a smaller production image:

\`\`\`dockerfile
# Stage 1: Build
FROM golang:1.21 AS builder
WORKDIR /app
COPY . .
RUN go build -o myapp .

# Stage 2: Production (tiny image)
FROM alpine:3.18
WORKDIR /app
COPY --from=builder /app/myapp .    # Copy only the binary
EXPOSE 8080
USER nobody
CMD ["./myapp"]
\`\`\`

The final image only contains the alpine base + the compiled binary — no Go toolchain.

## Image Tags and Digests

\`\`\`bash
# Tagging
docker build -t myapp:v1.0 .
docker tag myapp:v1.0 myregistry.io/myapp:v1.0
docker push myregistry.io/myapp:v1.0

# Using digest (immutable reference — cannot be changed)
# myapp@sha256:abc123...
\`\`\`

## imagePullPolicy in Kubernetes

\`\`\`yaml
spec:
  containers:
  - name: app
    image: nginx:1.25
    imagePullPolicy: IfNotPresent  # Default for tagged images
    # Always     → always pull from registry (ignores local cache)
    # Never      → only use local cache (fail if not present)
    # IfNotPresent → use local if exists, otherwise pull
\`\`\`

**Rules for implicit imagePullPolicy:**
- Image tag is \`:latest\` or no tag → **Always**
- Image has a specific tag (e.g., \`:1.25\`) → **IfNotPresent**
- Image uses a digest → **IfNotPresent**

## Private Registry: ImagePullSecret

\`\`\`bash
# Create a docker-registry secret
kubectl create secret docker-registry regcred \
  --docker-server=registry.example.com \
  --docker-username=myuser \
  --docker-password=mypassword \
  --docker-email=dev@example.com

# Verify the secret
kubectl get secret regcred -o yaml
\`\`\`

\`\`\`yaml
# Use in a pod
spec:
  imagePullSecrets:
  - name: regcred    # References the docker-registry secret
  containers:
  - name: app
    image: registry.example.com/myapp:v1.0
\`\`\`

## Image Security Best Practices

\`\`\`dockerfile
# 1. Use specific versions (not latest)
FROM node:20.11-alpine3.19   # Pinned version

# 2. Run as non-root
RUN addgroup -g 1000 appgroup && \
    adduser -u 1000 -G appgroup -D appuser
USER appuser

# 3. Minimize image size (fewer attack surfaces)
# Use alpine, distroless, or slim variants

# 4. Don't embed secrets in images
ENV API_KEY=secret123    # NEVER DO THIS — visible in image metadata!
# Use Kubernetes Secrets at runtime instead

# 5. Multi-stage builds for compiled languages
# → no build tools in production image
\`\`\`

## Common Errors

1. **ImagePullBackOff** — image not found, wrong tag, or no credentials for private registry
2. **ErrImagePull** — first pull attempt failed (before backoff kicks in)
3. **Dockerfile ENTRYPOINT/CMD confusion** — using shell form vs exec form causes different signal handling
4. **Build context too large** — use .dockerignore to exclude node_modules, .git, etc.
5. **Image tag \`:latest\` causes unexpected updates** — always pin to specific versions

## Killer.sh Style Challenge

**Task**: Create a Dockerfile for a Python Flask app that:
1. Uses python:3.11-alpine as base
2. Runs as non-root user (uid 1000)
3. Installs dependencies from requirements.txt (before copying app code)
4. Exposes port 5000
5. Starts with: gunicorn app:app --bind 0.0.0.0:5000

Then create an ImagePullSecret for a private registry and configure a pod to use it.
`,
  quiz: [
    {
      question: 'What is the difference between ENTRYPOINT and CMD in a Dockerfile?',
      options: [
        'ENTRYPOINT is for Linux commands; CMD is for Windows commands',
        'ENTRYPOINT defines the executable (hard to override); CMD provides default arguments (easily overridden by pod command/args)',
        'They are identical — CMD is just a shorthand for ENTRYPOINT',
        'ENTRYPOINT runs during build; CMD runs at container start'
      ],
      correct: 1,
      explanation: 'ENTRYPOINT defines what executable runs (requires --entrypoint to override). CMD provides default arguments that are replaced by the pod\'s command field. Together: ENTRYPOINT [exec] + CMD [args].',
      reference: 'ENTRYPOINT vs CMD table in theory.'
    },
    {
      question: 'What imagePullPolicy is automatically used for an image with tag :latest?',
      options: [
        'IfNotPresent',
        'Never',
        'Always',
        'OncePerNode'
      ],
      correct: 2,
      explanation: 'When no tag or :latest is specified, imagePullPolicy defaults to Always. This ensures the latest version is always pulled. For specific version tags (e.g., :1.25), the default is IfNotPresent.',
      reference: 'imagePullPolicy section — implicit rules for default values.'
    },
    {
      question: 'What type of Kubernetes Secret is used to pull images from a private registry?',
      options: [
        'Opaque secret with base64-encoded credentials',
        'docker-registry type secret, referenced via imagePullSecrets in the pod spec',
        'TLS secret with registry certificate',
        'ServiceAccount token mounted as a volume'
      ],
      correct: 1,
      explanation: 'A docker-registry type Secret (kubectl create secret docker-registry) stores registry credentials. It is referenced in the pod spec under imagePullSecrets. Kubernetes uses it to authenticate when pulling the image.',
      reference: 'Private Registry: ImagePullSecret section in theory.'
    },
    {
      question: 'Why should you copy requirements.txt BEFORE copying application code in a Dockerfile?',
      options: [
        'requirements.txt must always be the first file in the image',
        'To leverage Docker layer caching — dependency installation is cached separately from code changes',
        'Python requires dependencies to be installed before code',
        'To reduce the final image size'
      ],
      correct: 1,
      explanation: 'Docker caches each layer. Copying requirements.txt first and running pip install creates a cached layer. When only app code changes (not requirements), the dependency layer is reused from cache — dramatically speeding up builds.',
      reference: 'Image Layers and Caching section in theory.'
    },
    {
      question: 'What is the main benefit of multi-stage Docker builds?',
      options: [
        'They allow running multiple commands in parallel',
        'They produce smaller production images by copying only the final artifacts, excluding build tools',
        'They enable building for multiple architectures simultaneously',
        'They speed up the build process by caching all stages'
      ],
      correct: 1,
      explanation: 'Multi-stage builds use a full build environment in early stages but copy only the compiled artifacts to a minimal final image. The production image has no compiler, build tools, or intermediate files — smaller and more secure.',
      reference: 'Multi-Stage Builds section in theory.'
    },
    {
      question: 'A pod shows ErrImagePull status. What is the most common cause?',
      options: [
        'The container ran and exited with an error',
        'Wrong image name/tag, private registry without credentials, or registry unreachable',
        'The node ran out of disk space',
        'imagePullPolicy is set to Never'
      ],
      correct: 1,
      explanation: 'ErrImagePull means Kubernetes failed to pull the container image. Most common causes: typo in image name, wrong tag, image doesn\'t exist, private registry without imagePullSecrets, or network issue to the registry.',
      reference: 'Common Errors #1 in theory — ImagePullBackOff / ErrImagePull.'
    },
    {
      question: 'In a Kubernetes pod spec, what does "command" override from the Dockerfile?',
      options: [
        'The CMD instruction',
        'The ENTRYPOINT instruction',
        'Both ENTRYPOINT and CMD',
        'The RUN instruction'
      ],
      correct: 1,
      explanation: 'In pod spec: "command" overrides the Dockerfile ENTRYPOINT, "args" overrides CMD. If only "command" is specified, it replaces both ENTRYPOINT and CMD (CMD is not appended).',
      reference: 'ENTRYPOINT vs CMD section — Kubernetes pod spec relationship.'
    },
    {
      question: 'Which imagePullPolicy ensures the image is always re-downloaded from the registry on every pod start?',
      options: [
        'IfNotPresent',
        'Fresh',
        'Always',
        'Latest'
      ],
      correct: 2,
      explanation: '"Always" forces Kubernetes to pull the image from the registry on every pod startup, even if a local copy exists. Use this for :latest or when you need guaranteed freshness. Note: this adds pull latency to pod startup.',
      reference: 'imagePullPolicy section in theory.'
    }
  ],
  flashcards: [
    {
      front: 'What does each key Dockerfile instruction do?',
      back: 'FROM — base image\nWORKDIR — set working directory (creates if missing)\nCOPY — copy files from build context\nADD — like COPY but also handles URLs and tar extraction\nRUN — execute command during build (creates layer)\nENV — set environment variable\nEXPOSE — document port (informational only)\nUSER — set process user\nENTRYPOINT — executable to run (hard to override)\nCMD — default args (overridden by pod command)'
    },
    {
      front: 'How do Kubernetes pod command/args map to Dockerfile ENTRYPOINT/CMD?',
      back: 'Dockerfile ENTRYPOINT → Kubernetes spec.containers[].command\nDockerfile CMD → Kubernetes spec.containers[].args\n\nIf pod has:\n- Only args: appended to ENTRYPOINT (CMD replaced)\n- Only command: replaces both ENTRYPOINT and CMD\n- Both command + args: command=new entrypoint, args=new cmd\n\nNo command/args: use Dockerfile defaults'
    },
    {
      front: 'What are the imagePullPolicy rules and when is each used?',
      back: 'Always: always pull from registry (default for :latest or no tag)\nIfNotPresent: use local cache if exists, else pull (default for specific tags)\nNever: only local cache — fail if not present\n\nExam tip: :latest → Always, :1.25 → IfNotPresent'
    },
    {
      front: 'How do you create and use an ImagePullSecret for a private registry?',
      back: '# Create the secret\nkubectl create secret docker-registry regcred \\\n  --docker-server=registry.example.com \\\n  --docker-username=user \\\n  --docker-password=pass\n\n# Reference in pod spec\nspec:\n  imagePullSecrets:\n  - name: regcred\n  containers:\n  - image: registry.example.com/myapp:v1'
    },
    {
      front: 'Why is the order of Dockerfile instructions important?',
      back: 'Each instruction creates a layer. Layers are cached. If a layer changes, all subsequent layers are invalidated.\n\nBest order for caching:\n1. FROM (base — rarely changes)\n2. COPY requirements.txt .\n3. RUN pip install -r requirements.txt (cached unless requirements.txt changes)\n4. COPY . . (invalidated every code change — but only this and below)\n\nPut frequently-changing instructions LAST.'
    },
    {
      front: 'What is the difference between ADD and COPY in Dockerfiles?',
      back: 'COPY: copies files/dirs from build context to image. Simple, explicit.\n\nADD: like COPY but also:\n- Fetches URLs (ADD https://... /dest)\n- Auto-extracts tar archives (ADD archive.tar.gz /dest)\n\nBest practice: prefer COPY for local files. Use ADD only when you need URL fetch or auto-extract. COPY is more predictable.'
    },
    {
      front: 'What is a multi-stage Docker build?',
      back: 'Multiple FROM instructions in one Dockerfile. Each FROM starts a new stage.\n\n# Stage 1: Build (large image with tools)\nFROM golang:1.21 AS builder\nRUN go build -o app .\n\n# Stage 2: Production (tiny image)\nFROM alpine:3.18\nCOPY --from=builder /app .\n\nBenefit: final image only contains the artifact, not the build tools. Smaller size = smaller attack surface.'
    },
    {
      front: 'What are the security best practices for container images?',
      back: '1. Pin specific image versions (not :latest)\n2. Run as non-root user (USER <uid>)\n3. Use minimal base images (alpine, distroless, slim)\n4. Multi-stage builds (exclude build tools from production)\n5. NEVER embed secrets in images (ENV API_KEY=secret is visible in image metadata)\n6. Use .dockerignore to exclude .git, node_modules, credentials\n7. Scan images for vulnerabilities (Trivy, Snyk)'
    }
  ],
  lab: {
    scenario: 'You need to package an application as a container image following security best practices and deploy it to Kubernetes with proper image management.',
    objective: 'Practice writing Dockerfiles, understanding imagePullPolicy, creating ImagePullSecrets, and troubleshooting image pull errors.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Explore imagePullPolicy Behavior',
        instruction: `Observe how imagePullPolicy affects pod behavior:

1. Create a pod using \`nginx:latest\` — note the default imagePullPolicy
2. Create a pod using \`nginx:1.25\` — note the different default imagePullPolicy
3. Create a pod using \`nginx:1.25\` with explicit \`imagePullPolicy: Always\`
4. Check what policy is set for each pod using kubectl get pod -o yaml`,
        hints: [
          ':latest or no tag → imagePullPolicy defaults to Always',
          ':1.25 (specific tag) → imagePullPolicy defaults to IfNotPresent',
          'kubectl get pod <name> -o jsonpath=\'{.spec.containers[0].imagePullPolicy}\'',
          'You can explicitly override: imagePullPolicy: Always in pod spec'
        ],
        solution: `\`\`\`bash
# Pod 1: latest tag → Always
kubectl run nginx-latest --image=nginx:latest
kubectl get pod nginx-latest -o jsonpath='{.spec.containers[0].imagePullPolicy}'
# Expected: Always

# Pod 2: specific tag → IfNotPresent
kubectl run nginx-pinned --image=nginx:1.25
kubectl get pod nginx-pinned -o jsonpath='{.spec.containers[0].imagePullPolicy}'
# Expected: IfNotPresent

# Pod 3: specific tag with explicit Always
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: nginx-always
spec:
  containers:
  - name: nginx
    image: nginx:1.25
    imagePullPolicy: Always
EOF

kubectl get pod nginx-always -o jsonpath='{.spec.containers[0].imagePullPolicy}'
# Expected: Always (explicit override)

# Compare all three
kubectl get pods nginx-latest nginx-pinned nginx-always \
  -o custom-columns="NAME:.metadata.name,IMAGE:.spec.containers[0].image,PULLPOLICY:.spec.containers[0].imagePullPolicy"

# Cleanup
kubectl delete pod nginx-latest nginx-pinned nginx-always
\`\`\``,
        verify: `\`\`\`bash
# All pods should be Running (or Completed if they exited)
kubectl get pods nginx-latest nginx-pinned nginx-always 2>/dev/null
# Expected: all STATUS = Running

# Verify pull policies
for pod in nginx-latest nginx-pinned nginx-always; do
  echo -n "$pod: "
  kubectl get pod $pod -o jsonpath='{.spec.containers[0].imagePullPolicy}' 2>/dev/null
  echo ""
done
# Expected: nginx-latest: Always, nginx-pinned: IfNotPresent, nginx-always: Always
\`\`\``
      },
      {
        title: 'Create an ImagePullSecret and Use It',
        instruction: `Simulate a private registry workflow:

1. Create a docker-registry secret named \`my-registry-creds\` with fake credentials for a fake registry
2. Create a pod spec that references this secret via \`imagePullSecrets\`
3. Observe that the pod fails with ImagePullBackOff (expected — registry doesn't exist)
4. Verify the secret is correctly referenced in the pod spec

Note: In a real scenario, you would use actual registry credentials.`,
        hints: [
          'kubectl create secret docker-registry my-registry-creds --docker-server=fake-registry.example.com ...',
          'kubectl get secret my-registry-creds -o yaml to inspect',
          'spec.imagePullSecrets[].name must match the secret name',
          'kubectl describe pod to see the image pull error details'
        ],
        solution: `\`\`\`bash
# Create the ImagePullSecret
kubectl create secret docker-registry my-registry-creds \
  --docker-server=fake-registry.example.com \
  --docker-username=myuser \
  --docker-password=mypassword123 \
  --docker-email=dev@example.com

# Verify the secret exists
kubectl get secret my-registry-creds
kubectl get secret my-registry-creds -o jsonpath='{.type}'
# Expected: kubernetes.io/dockerconfigjson

# Create a pod using the ImagePullSecret
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: private-app
spec:
  imagePullSecrets:
  - name: my-registry-creds
  containers:
  - name: app
    image: fake-registry.example.com/myapp:v1.0
    imagePullPolicy: Always
EOF

# Pod will fail (registry doesn't exist) but spec is valid
kubectl get pod private-app -w
# Expected: ErrImagePull → ImagePullBackOff

# Verify the imagePullSecret is referenced
kubectl get pod private-app -o jsonpath='{.spec.imagePullSecrets[0].name}'
# Expected: my-registry-creds

# See pull error details
kubectl describe pod private-app | grep -A5 "Events:"

# Cleanup
kubectl delete pod private-app
kubectl delete secret my-registry-creds
\`\`\``,
        verify: `\`\`\`bash
# Secret should be of correct type
kubectl get secret my-registry-creds -o jsonpath='{.type}' 2>/dev/null || echo "secret deleted"
# Expected: kubernetes.io/dockerconfigjson

# Pod should reference the secret
kubectl get pod private-app -o jsonpath='{.spec.imagePullSecrets[0].name}' 2>/dev/null
# Expected: my-registry-creds

# Pod should show ImagePullBackOff (expected for fake registry)
kubectl get pod private-app 2>/dev/null
# Expected: STATUS = ImagePullBackOff or ErrImagePull
\`\`\``
      },
      {
        title: 'Troubleshoot an ImagePullBackOff Error',
        instruction: `Create a pod with a wrong image tag and practice the troubleshooting workflow:

\`\`\`bash
kubectl run broken-image --image=nginx:99.99.99
\`\`\`

1. Identify the exact error from kubectl describe
2. Check what image tag was requested
3. Fix by updating the pod to use a valid image tag
4. Verify the pod starts successfully`,
        hints: [
          'kubectl describe pod broken-image | grep -A5 "Events:"',
          'Events show "Failed to pull image" with the error reason',
          'Pods are immutable — delete and recreate with correct image',
          'kubectl run broken-image --image=nginx:1.25 after deleting the bad one'
        ],
        solution: `\`\`\`bash
# Create pod with non-existent image tag
kubectl run broken-image --image=nginx:99.99.99

# Watch it fail
kubectl get pod broken-image -w

# Diagnose the error
kubectl describe pod broken-image | grep -A10 "Events:"
# Shows: Failed to pull image "nginx:99.99.99": not found

# Get the exact image requested
kubectl get pod broken-image -o jsonpath='{.spec.containers[0].image}'
# Expected: nginx:99.99.99

# Fix: delete and recreate with valid tag
kubectl delete pod broken-image
kubectl run broken-image --image=nginx:1.25

# Wait for the fix to work
kubectl get pod broken-image -w
# Expected: STATUS transitions to Running
\`\`\``,
        verify: `\`\`\`bash
# Pod should be Running with correct image
kubectl get pod broken-image
# Expected: STATUS = Running

# Image should be the fixed version
kubectl get pod broken-image -o jsonpath='{.spec.containers[0].image}'
# Expected: nginx:1.25

# No ImagePullBackOff events
kubectl describe pod broken-image | grep "ImagePull" | head -3
# Expected: no ImagePullBackOff events for current pod
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'ImagePullBackOff — Image Not Found',
      difficulty: 'easy',
      symptom: 'A pod shows STATUS = ImagePullBackOff or ErrImagePull. The container never starts.',
      diagnosis: `\`\`\`bash
# Check events for the exact error
kubectl describe pod <pod-name> | grep -A10 "Events:"
# Common messages:
# - "rpc error: code = NotFound" → tag doesn't exist
# - "access denied" or "unauthorized" → auth required
# - "no such host" → registry unreachable

# Check the exact image reference
kubectl get pod <pod-name> -o jsonpath='{.spec.containers[0].image}'

# Check imagePullSecrets
kubectl get pod <pod-name> -o jsonpath='{.spec.imagePullSecrets}'
\`\`\``,
      solution: `**Cause A: Wrong image tag**
\`\`\`bash
# Delete and recreate with correct tag
kubectl delete pod <pod-name>
kubectl run <pod-name> --image=nginx:1.25  # Use valid tag
\`\`\`

**Cause B: Private registry without credentials**
\`\`\`bash
# Create imagePullSecret
kubectl create secret docker-registry regcred \
  --docker-server=<registry> \
  --docker-username=<user> \
  --docker-password=<password>

# Add to pod spec:
spec:
  imagePullSecrets:
  - name: regcred
  containers:
  - image: <registry>/myapp:v1
\`\`\`

**Cause C: Registry unreachable (network issue)**
\`\`\`bash
# Test registry access from a node
ssh <node>
curl -v https://registry.example.com/v2/
# Check firewall rules or proxy settings
\`\`\``
    },
    {
      title: 'Container Exits Immediately — Wrong CMD/ENTRYPOINT',
      difficulty: 'medium',
      symptom: 'A pod starts but immediately exits with STATUS = Completed or CrashLoopBackOff. The container runs for less than a second.',
      diagnosis: `\`\`\`bash
# Check exit code
kubectl describe pod <pod-name> | grep "Exit Code"
# Exit 0 = command ran and completed (not a crash — just finished)
# Exit 1+ = error

# Check logs
kubectl logs <pod-name> --previous

# Check what command the container is running
kubectl get pod <pod-name> -o yaml | grep -A10 "containers:"

# Verify the image's default command
# docker inspect <image> shows Cmd and Entrypoint
\`\`\``,
      solution: `**Cause A: Batch command exits normally (Exit 0)**
\`\`\`bash
# If the container command completes (like a script), STATUS = Completed
# This is expected behavior — not a crash

# Fix: if you want it to stay running, add a long-running command
kubectl run myapp --image=myimage -- sleep infinity
# Or override with a loop:
command: ["sh", "-c", "my-script.sh && sleep infinity"]
\`\`\`

**Cause B: Wrong entrypoint override in pod spec**
\`\`\`bash
# Check Dockerfile expects different arguments
kubectl get pod <pod-name> -o yaml | grep -A5 "command:\|args:"

# The pod command may override the Dockerfile ENTRYPOINT incorrectly
# Fix: either remove the override to use Dockerfile defaults
# Or provide the full correct command
spec:
  containers:
  - command: ["node", "server.js"]  # Complete command
    # Don't rely on partial ENTRYPOINT + CMD when overriding
\`\`\``
    }
  ]
};
