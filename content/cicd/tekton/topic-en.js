window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['cicd/tekton'] = {
  theory: `
# Tekton: Native CI/CD in Kubernetes

## Relevance
Tekton is the most widely adopted cloud-native CI/CD framework in enterprise Kubernetes environments. Unlike GitHub Actions (external SaaS), Tekton runs INSIDE the cluster — pipelines are Kubernetes resources (CRDs). It's the foundation for platforms like OpenShift Pipelines, Jenkins X, and Shipwright.

## Tekton Architecture

\`\`\`
Tekton Building Blocks:

Task         → minimum unit of work (set of steps)
Pipeline     → graph of Tasks (with dependencies)
TaskRun      → execution of a Task
PipelineRun  → execution of a Pipeline
Workspace    → shared volumes between Tasks
Trigger      → automatic trigger via webhook (TriggerTemplate + EventListener)
\`\`\`

### How it works in practice

\`\`\`
Git Push
    ↓
EventListener (Pod) → intercepts webhook
    ↓
TriggerTemplate → creates PipelineRun
    ↓
Pipeline (clone → test → build → push → deploy)
    ↓
Tasks execute in separate Pods
    ↓
Workspaces share data between Tasks
\`\`\`

## Fundamental Concepts

### Task — unit of work

\`\`\`yaml
apiVersion: tekton.dev/v1
kind: Task
metadata:
  name: run-tests
  namespace: tekton-pipelines
spec:
  params:
    - name: python-version
      type: string
      default: "3.11"
    - name: test-path
      type: string
      default: "tests/"

  workspaces:
    - name: source          # input workspace
      description: Source code

  steps:
    - name: install-deps
      image: python:\$(params.python-version)-slim
      workingDir: /workspace/source
      script: |
        #!/bin/bash
        pip install -r requirements.txt -r requirements-dev.txt

    - name: run-tests
      image: python:\$(params.python-version)-slim
      workingDir: /workspace/source
      script: |
        #!/bin/bash
        pytest \$(params.test-path) -v --junitxml=test-results.xml
      env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: test-db-credentials
              key: url

  results:
    - name: test-count
      description: Number of tests executed
\`\`\`

### Pipeline — orchestrating Tasks

\`\`\`yaml
apiVersion: tekton.dev/v1
kind: Pipeline
metadata:
  name: build-and-deploy
  namespace: tekton-pipelines
spec:
  params:
    - name: git-url
      type: string
    - name: git-revision
      type: string
      default: main
    - name: image-name
      type: string
    - name: environment
      type: string
      default: staging

  workspaces:
    - name: shared-data    # shared between all Tasks
    - name: docker-credentials
    - name: git-credentials

  tasks:
    # Task 1: Repository clone
    - name: clone
      taskRef:
        name: git-clone
        kind: ClusterTask  # Task available cluster-wide
      workspaces:
        - name: output
          workspace: shared-data
        - name: ssh-directory
          workspace: git-credentials
      params:
        - name: url
          value: \$(params.git-url)
        - name: revision
          value: \$(params.git-revision)

    # Task 2: Tests (depends on clone)
    - name: test
      taskRef:
        name: run-tests
      runAfter:
        - clone
      workspaces:
        - name: source
          workspace: shared-data
      params:
        - name: python-version
          value: "3.11"

    # Task 3: Docker Build (depends on tests)
    - name: build-image
      taskRef:
        name: kaniko          # build without Docker daemon
        kind: ClusterTask
      runAfter:
        - test
      workspaces:
        - name: source
          workspace: shared-data
        - name: dockerconfig
          workspace: docker-credentials
      params:
        - name: IMAGE
          value: \$(params.image-name):\$(tasks.clone.results.commit)
        - name: CONTEXT
          value: .

    # Task 4: Deploy (depends on build)
    - name: deploy
      taskRef:
        name: kubernetes-actions
        kind: ClusterTask
      runAfter:
        - build-image
      params:
        - name: script
          value: |
            kubectl set image deployment/myapp \
              myapp=\$(params.image-name):\$(tasks.clone.results.commit) \
              -n \$(params.environment)
            kubectl rollout status deployment/myapp \
              -n \$(params.environment) \
              --timeout=5m

  # Finally — notification (runs always, even on failure)
  finally:
    - name: notify
      taskRef:
        name: send-notification
      params:
        - name: status
          value: \$(tasks.status)
\`\`\`

### TaskRun — running a Task manually

\`\`\`yaml
apiVersion: tekton.dev/v1
kind: TaskRun
metadata:
  name: run-tests-manual
  namespace: tekton-pipelines
spec:
  taskRef:
    name: run-tests
  params:
    - name: python-version
      value: "3.11"
    - name: test-path
      value: "tests/unit/"
  workspaces:
    - name: source
      persistentVolumeClaim:
        claimName: my-pvc
\`\`\`

### PipelineRun — running a Pipeline

\`\`\`yaml
apiVersion: tekton.dev/v1
kind: PipelineRun
metadata:
  name: build-deploy-run-001
  namespace: tekton-pipelines
spec:
  pipelineRef:
    name: build-and-deploy
  params:
    - name: git-url
      value: https://github.com/myorg/myapp.git
    - name: git-revision
      value: main
    - name: image-name
      value: ghcr.io/myorg/myapp
    - name: environment
      value: staging
  workspaces:
    - name: shared-data
      volumeClaimTemplate:          # PVC created automatically for this run
        spec:
          accessModes: [ReadWriteOnce]
          resources:
            requests:
              storage: 1Gi
    - name: docker-credentials
      secret:
        secretName: docker-registry-credentials
    - name: git-credentials
      secret:
        secretName: git-ssh-credentials
\`\`\`

## Workspaces: Sharing Data

\`\`\`yaml
# Workspace types
workspaces:
  - name: data
    persistentVolumeClaim:
      claimName: my-pvc        # existing PVC

  - name: config
    configMap:
      name: app-config         # ConfigMap read

  - name: credentials
    secret:
      secretName: my-secret    # Secret mount

  - name: temp
    emptyDir: {}               # temporary directory (no persistence)

  - name: optional-cache
    volumeClaimTemplate:       # PVC created automatically per run
      spec:
        accessModes: [ReadWriteOnce]
        resources:
          requests:
            storage: 500Mi
\`\`\`

## Triggers: Webhook Automation

\`\`\`yaml
# EventListener — receives webhooks from GitHub/GitLab
apiVersion: triggers.tekton.dev/v1beta1
kind: EventListener
metadata:
  name: github-webhook
  namespace: tekton-pipelines
spec:
  triggers:
    - name: github-push
      interceptors:
        - ref:
            name: github
          params:
            - name: secretRef
              value:
                secretName: github-webhook-secret
                secretKey: secret
            - name: eventTypes
              value: [push]
      bindings:
        - ref: github-push-binding
      template:
        ref: pipeline-run-template

---
# TriggerBinding — extracts data from webhook payload
apiVersion: triggers.tekton.dev/v1beta1
kind: TriggerBinding
metadata:
  name: github-push-binding
spec:
  params:
    - name: git-url
      value: \$(body.repository.clone_url)
    - name: git-revision
      value: \$(body.head_commit.id)
    - name: git-branch
      value: \$(body.ref)

---
# TriggerTemplate — creates the PipelineRun
apiVersion: triggers.tekton.dev/v1beta1
kind: TriggerTemplate
metadata:
  name: pipeline-run-template
spec:
  params:
    - name: git-url
    - name: git-revision
    - name: git-branch
  resourcetemplates:
    - apiVersion: tekton.dev/v1
      kind: PipelineRun
      metadata:
        generateName: build-deploy-     # unique name per run
      spec:
        pipelineRef:
          name: build-and-deploy
        params:
          - name: git-url
            value: \$(tt.params.git-url)
          - name: git-revision
            value: \$(tt.params.git-revision)
          - name: image-name
            value: ghcr.io/myorg/myapp
        workspaces:
          - name: shared-data
            volumeClaimTemplate:
              spec:
                accessModes: [ReadWriteOnce]
                resources:
                  requests:
                    storage: 1Gi
\`\`\`

## Essential Commands (tkn CLI)

\`\`\`bash
# Install tkn CLI
curl -LO https://github.com/tektoncd/cli/releases/latest/download/tkn_Linux_x86_64.tar.gz
tar xvzf tkn_Linux_x86_64.tar.gz -C /usr/local/bin/ tkn

# List resources
tkn task list -n tekton-pipelines
tkn pipeline list -n tekton-pipelines
tkn pipelinerun list -n tekton-pipelines
tkn taskrun list -n tekton-pipelines

# View execution logs
tkn pipelinerun logs build-deploy-run-001 -f -n tekton-pipelines
tkn taskrun logs my-taskrun -f -n tekton-pipelines

# Run task manually
tkn task start run-tests \
  -n tekton-pipelines \
  -p python-version=3.11 \
  -w name=source,claimName=my-pvc \
  --showlog

# Run pipeline manually
tkn pipeline start build-and-deploy \
  -n tekton-pipelines \
  -p git-url=https://github.com/myorg/myapp.git \
  -p image-name=ghcr.io/myorg/myapp \
  -w name=shared-data,volumeClaimTemplateFile=workspace.yaml \
  --showlog

# Cancel execution
tkn pipelinerun cancel build-deploy-run-001 -n tekton-pipelines

# Describe task/pipeline
tkn task describe run-tests -n tekton-pipelines
tkn pipeline describe build-and-deploy -n tekton-pipelines
\`\`\`

## Kaniko: Build without Docker Daemon

\`\`\`yaml
# Kaniko builds Docker images inside Kubernetes
# without needing the Docker daemon (rootless, secure)
apiVersion: tekton.dev/v1
kind: Task
metadata:
  name: build-push-kaniko
spec:
  params:
    - name: IMAGE
    - name: CONTEXT
      default: "."
    - name: DOCKERFILE
      default: "Dockerfile"

  workspaces:
    - name: source
    - name: dockerconfig
      description: Secret with registry credentials

  steps:
    - name: build-and-push
      image: gcr.io/kaniko-project/executor:latest
      args:
        - --dockerfile=/workspace/source/\$(params.DOCKERFILE)
        - --context=/workspace/source/\$(params.CONTEXT)
        - --destination=\$(params.IMAGE)
        - --cache=true
        - --cache-ttl=24h
      volumeMounts:
        - name: kaniko-secret
          mountPath: /kaniko/.docker
      env:
        - name: DOCKER_CONFIG
          value: /kaniko/.docker
\`\`\`

## Common Mistakes

1. **Tasks with wrong workspaces** — Task expects workspace "source" but PipelineRun passed "code"
2. **PVC with ReadWriteMany** — Tasks on different nodes need RWX if parallel
3. **ServiceAccount permission** — TaskRun needs RBAC to kubectl to the cluster
4. **Timeout** — TaskRun without timeout can hang indefinitely; configure \`timeout\`
5. **Results not passed** — use \$(tasks.TASK.results.RESULT) to chain values between Tasks

## Killer.sh Style Challenge

> **Scenario:** You need to create a Tekton Pipeline for a Go application that: (1) clones the repo with git-clone ClusterTask, (2) runs tests with go test, (3) builds image with Kaniko, (4) deploys with kubectl. Tasks must share code via workspace. The Pipeline must accept git-url, git-revision, and image-name as parameters.
`,
  quiz: [
    {
      question: 'What is the difference between Task and ClusterTask in Tekton?',
      options: [
        'ClusterTask executes faster because it\'s clustered',
        'Task is namespaced — available only in the namespace where it was created; ClusterTask is cluster-scoped — available in any namespace without needing to be replicated. Reusable Tasks like git-clone, kaniko should be ClusterTasks',
        'ClusterTask can only be used by cluster admins',
        'The difference is only about versioning — ClusterTask is immutable'
      ],
      correct: 1,
      explanation: 'Task is a namespaced Kubernetes resource — created in "tekton-pipelines" namespace, it can only be referenced in that namespace. ClusterTask (or Task with kind: ClusterTask in the reference) is cluster-scoped, available in all namespaces. Tekton Hub provides common ClusterTasks like git-clone, kaniko, kubectl, buildpacks — ready to use without creating from scratch in each namespace.',
      reference: 'Note: ClusterTask is being deprecated in newer Tekton versions in favor of Tasks with resolvers (Tekton Hub, Git, Bundle resolvers).'
    },
    {
      question: 'What are Workspaces in Tekton and why are they necessary?',
      options: [
        'Workspaces are shared environment variables',
        'Workspaces are volumes mounted in Tasks and Pipelines — they allow sharing files between steps of a Task and between different Tasks of a Pipeline, since each Task runs in a separate Pod with an isolated filesystem',
        'Workspaces are only needed for storing secrets',
        'Workspaces replace params for passing data between Tasks'
      ],
      correct: 1,
      explanation: 'Each Task in Tekton runs in a separate Kubernetes Pod. Without workspaces, code cloned in one Pod (git-clone Task) wouldn\'t be available to the next Pod (test Task). Workspaces map to Kubernetes volumes — PVCs, ConfigMaps, Secrets, or emptyDir. A "shared-data" workspace mounted in all Pipeline Tasks allows code to flow from clone to deploy.',
      reference: 'Practice: using volumeClaimTemplate in PipelineRun creates a PVC automatically for each run — without manually managing PVCs.'
    },
    {
      question: 'Why use Kaniko for image builds instead of Docker-in-Docker (DinD) in Kubernetes?',
      options: [
        'Kaniko is faster than DinD',
        'Docker-in-Docker requires the container to run with elevated privileges (--privileged) — a critical security risk. Kaniko executes builds without the Docker daemon, using only the context files, without requiring root privileges on the host',
        'Kaniko only works with public repositories',
        'DinD doesn\'t work in Kubernetes, only in Docker Compose'
      ],
      correct: 1,
      explanation: 'Docker-in-Docker requires mounting the Docker socket (/var/run/docker.sock) or running with --privileged — both allow a container escape to affect the entire host. Kaniko executes the Dockerfile directly, layer by layer, without needing the Docker daemon. Buildah and ko are similar alternatives. For production in Kubernetes, never use DinD — use Kaniko, Buildah, or Buildpacks-based builds.',
      reference: 'Kaniko alternatives: Buildah (rootless, secure), ko (for Go, no Dockerfile), Buildpacks (heroku-style, no Dockerfile).'
    },
    {
      question: 'How does the Triggers mechanism work in Tekton?',
      options: [
        'Triggers are cronjobs that periodically poll GitHub',
        'EventListener receives HTTP webhooks (from GitHub/GitLab/etc.), TriggerBinding extracts data from the payload (url, sha, branch), and TriggerTemplate uses that data to automatically create PipelineRuns — pipeline as code triggered by Git events',
        'Triggers only work with GitHub, not other Git providers',
        'Triggers require configuration in the CI Kubernetes cluster'
      ],
      correct: 1,
      explanation: 'Tekton\'s Triggers system is event-driven: EventListener is a Deployment exposing an HTTP endpoint — you configure the webhook in GitHub pointing to it. When a push happens, EventListener receives the payload, uses interceptors (HMAC validation, CEL filters), passes to TriggerBinding which extracts JSON fields, and TriggerTemplate uses those fields to create a PipelineRun with the correct parameters.',
      reference: 'Exposing EventListener: use Ingress or Service LoadBalancer so GitHub can reach the endpoint inside the cluster.'
    },
    {
      question: 'How do you pass the result of one Task to another Task in the same Pipeline?',
      options: [
        'It\'s impossible — Tasks are completely isolated',
        'Using Results: the producing Task declares a result and writes to /tekton/results/NAME. The consuming Task references it with \$(tasks.TASK-NAME.results.RESULT-NAME) in its params',
        'Using global Pipeline environment variables',
        'Using a temporary ConfigMap created by the producing Task'
      ],
      correct: 1,
      explanation: 'Results in Tekton allow a Task to publish small values (e.g., image digest, version, commit SHA) for use by subsequent Tasks. The Task writes the value to /tekton/results/result-name and Tekton stores that value. Other Tasks can reference via \$(tasks.clone.results.commit). Important: Results are small strings (max ~4KB) — for large files, use workspaces.',
      reference: 'Common example: git-clone Task publishes result "commit" (the full SHA) and build Task uses it to tag the image.'
    },
    {
      question: 'What is the difference between `runAfter` and implicit dependencies via workspaces in a Pipeline?',
      options: [
        'runAfter is more performant than workspace dependencies',
        'runAfter creates an explicit sequencing dependency — "run this Task only after those". Workspace dependency occurs when Tasks share the same workspace with subpaths: Tekton can infer the order. runAfter is clearer and recommended for data dependencies',
        'runAfter only works with Tasks, not with nested pipelines',
        'Workspace dependencies are always parallel'
      ],
      correct: 1,
      explanation: 'runAfter is the explicit and recommended way to sequence Tasks. You can have Task A that clones code, Task B that tests (runAfter: A), and Task C that builds (runAfter: B). Without runAfter, Tasks without dependencies run in parallel — which may be desired (e.g., unit tests and lint in parallel) or undesired (build before clone).',
      reference: 'Tasks without runAfter and without workspace dependency run in parallel — automatic Pipeline optimization.'
    },
    {
      question: 'How does Tekton differ from GitHub Actions in terms of architecture?',
      options: [
        'Tekton uses YAML just like GitHub Actions',
        'Tekton is cloud-native: pipelines are Kubernetes CRDs, Tasks run in Pods in the cluster, state is persisted in etcd. GitHub Actions is an external SaaS where runners execute outside the cluster. Tekton has full infrastructure control; Actions has more native GitHub integration',
        'Tekton is just a self-hosted version of GitHub Actions',
        'Tekton doesn\'t support automatic triggers via webhook'
      ],
      correct: 1,
      explanation: 'The architectural difference is fundamental: GitHub Actions is an external service (runners are temporary VMs outside the cluster). Tekton runs inside Kubernetes — each Task is a Pod, pipelines are CRDs, state lives in etcd. This provides: full security control (no data leaves the cluster), native integration with K8s secrets/RBAC, and complete customization of CI/CD infrastructure.',
      reference: 'When to use Tekton: enterprise with compliance requirements, air-gapped environments, OpenShift, or when the pipeline needs internal cluster access without exposing credentials externally.'
    }
  ],
  flashcards: [
    {
      front: 'Tekton — fundamental resources',
      back: '**Hierarchy:**\n```\nTask       → set of steps in a Pod\nPipeline   → graph of Tasks\nTaskRun    → Task execution\nPipelineRun → Pipeline execution\nWorkspace  → shared volume\nResult     → Task output value\nTrigger    → webhook → PipelineRun\n```\n\n**Each Task = 1 Pod**\n- Steps = containers in the Pod\n- Execute sequentially\n- Share filesystem\n\n**Different Tasks = Different Pods**\n- Need Workspace (PVC) to\n  share files\n\n**tkn commands:**\n```bash\ntkn task list\ntkn pipeline list\ntkn pipelinerun logs -f\ntkn task start name --showlog\n```'
    },
    {
      front: 'Task — complete structure',
      back: '```yaml\napiVersion: tekton.dev/v1\nkind: Task\nmetadata:\n  name: my-task\nspec:\n  params:\n    - name: version\n      type: string\n      default: "3.11"\n\n  workspaces:\n    - name: source  # volume mounted at /workspace/source\n\n  steps:\n    - name: step1\n      image: python:\$(params.version)-slim\n      workingDir: /workspace/source\n      script: |\n        #!/bin/bash\n        pip install -r requirements.txt\n\n    - name: step2\n      image: python:\$(params.version)-slim\n      workingDir: /workspace/source\n      script: |\n        #!/bin/bash\n        pytest tests/ -v\n\n  results:\n    - name: test-count\n      description: Number of tests\n```\n\n**Steps share the same Pod**\n**Execute sequentially**\n**Workspaces live at /workspace/NAME**'
    },
    {
      front: 'Pipeline — orchestrating Tasks',
      back: '```yaml\napiVersion: tekton.dev/v1\nkind: Pipeline\nmetadata:\n  name: ci-pipeline\nspec:\n  params:\n    - name: git-url\n    - name: image\n\n  workspaces:\n    - name: shared  # passed to Tasks\n\n  tasks:\n    - name: clone\n      taskRef:\n        name: git-clone\n        kind: ClusterTask\n      workspaces:\n        - name: output\n          workspace: shared\n      params:\n        - name: url\n          value: \$(params.git-url)\n\n    - name: test\n      taskRef: {name: run-tests}\n      runAfter: [clone]      # ← dependency\n      workspaces:\n        - name: source\n          workspace: shared\n\n    - name: build\n      taskRef: {name: kaniko, kind: ClusterTask}\n      runAfter: [test]\n      workspaces:\n        - name: source\n          workspace: shared\n      params:\n        - name: IMAGE\n          value: \$(params.image):\$(tasks.clone.results.commit)\n```'
    },
    {
      front: 'Workspaces — types and usage',
      back: '**Workspace types:**\n```yaml\n# Existing PVC\n- name: data\n  persistentVolumeClaim:\n    claimName: my-pvc\n\n# PVC created per run (most common)\n- name: source\n  volumeClaimTemplate:\n    spec:\n      accessModes: [ReadWriteOnce]\n      resources:\n        requests:\n          storage: 1Gi\n\n# Secret\n- name: docker-creds\n  secret:\n    secretName: registry-credentials\n\n# ConfigMap\n- name: config\n  configMap:\n    name: app-config\n\n# Temporary\n- name: temp\n  emptyDir: {}\n```\n\n**Parallel access rule:**\n- Tasks on DIFFERENT nodes = ReadWriteMany\n- Tasks on same node = ReadWriteOnce OK\n- For builds: 1 PVC per PipelineRun (volumeClaimTemplate)'
    },
    {
      front: 'Triggers — webhook to PipelineRun',
      back: '**Components:**\n```\nEventListener → Pod that receives webhooks\n    ↓\nInterceptors → HMAC validation, CEL filter\n    ↓\nTriggerBinding → extracts data from payload\n    ↓\nTriggerTemplate → creates PipelineRun\n```\n\n**EventListener (summarized):**\n```yaml\napiVersion: triggers.tekton.dev/v1beta1\nkind: EventListener\nmetadata:\n  name: github\nspec:\n  triggers:\n    - name: push\n      interceptors:\n        - ref: {name: github}\n          params:\n            - name: secretRef\n              value: {secretName: webhook-secret, secretKey: secret}\n            - name: eventTypes\n              value: [push]\n      bindings:\n        - ref: github-binding\n      template:\n        ref: pipeline-template\n```\n\n**TriggerBinding extracts:**\n```yaml\nparams:\n  - name: git-url\n    value: \$(body.repository.clone_url)\n  - name: git-revision\n    value: \$(body.head_commit.id)\n```'
    },
    {
      front: 'Essential tkn CLI commands',
      back: '**List:**\n```bash\ntkn task list -n NAMESPACE\ntkn pipeline list -n NAMESPACE\ntkn pipelinerun list -n NAMESPACE\ntkn taskrun list -n NAMESPACE\n```\n\n**Logs:**\n```bash\n# Follow PipelineRun logs\ntkn pipelinerun logs my-run -f -n NS\n\n# See specific task logs\ntkn pipelinerun logs my-run -t build-image -f\n```\n\n**Execute:**\n```bash\n# Manual Task\ntkn task start my-task \\\n  -p version=3.11 \\\n  -w name=source,claimName=my-pvc \\\n  --showlog\n\n# Manual Pipeline\ntkn pipeline start ci-pipeline \\\n  -p git-url=https://github.com/org/repo \\\n  -p image=ghcr.io/org/app \\\n  -w name=shared,emptyDir="" \\\n  --showlog\n```\n\n**Describe:**\n```bash\ntkn task describe my-task\ntkn pipeline describe ci-pipeline\ntkn pipelinerun describe my-run\n```'
    }
  ],
  lab: {
    scenario: 'You will install Tekton on a local cluster (kind or minikube), create Tasks for cloning code and running tests, assemble a Pipeline that chains the Tasks, and execute manually using the tkn CLI.',
    objective: 'Create a functional Tekton Pipeline with custom Tasks, workspaces, and execution via tkn CLI.',
    duration: '35-45 minutes',
    steps: [
      {
        title: 'Install Tekton and create namespace',
        instruction: `Install Tekton Pipelines on a local Kubernetes cluster and configure the namespace for the lab.`,
        hints: [
          'Use kind or minikube for a local cluster',
          'Install Tekton via kubectl apply from the official release',
          'Install the tkn CLI to interact with Tekton'
        ],
        solution: `\`\`\`bash
# Option 1: create cluster with kind (if you don't have one)
kind create cluster --name tekton-lab

# Option 2: use minikube
# minikube start --memory=4096 --cpus=2

# Install Tekton Pipelines
kubectl apply -f https://storage.googleapis.com/tekton-releases/pipeline/latest/release.yaml

# Wait for Tekton to be ready
kubectl wait --for=condition=ready pod \
  -l app=tekton-pipelines-controller \
  -n tekton-pipelines \
  --timeout=300s

# Install tkn CLI (Linux)
curl -LO https://github.com/tektoncd/cli/releases/latest/download/tkn_Linux_x86_64.tar.gz
tar xvzf tkn_Linux_x86_64.tar.gz -C /tmp/ tkn
sudo mv /tmp/tkn /usr/local/bin/
# Mac: brew install tektoncd/tools/tektoncd-cli

# Verify installation
tkn version

# Create namespace for lab
kubectl create namespace tekton-lab
kubectl config set-context --current --namespace=tekton-lab

# Create ServiceAccount with permissions
kubectl create serviceaccount tekton-sa -n tekton-lab
\`\`\``,
        verify: `\`\`\`bash
# Verify Tekton pods are running
kubectl get pods -n tekton-pipelines
# Expected: tekton-pipelines-controller and webhook running

# Verify CRDs installed
kubectl get crd | grep tekton
# Expected: tasks.tekton.dev, pipelines.tekton.dev, etc.

# Verify tkn CLI
tkn version
# Expected: Client version: X.X.X

# Verify namespace
kubectl get namespace tekton-lab
\`\`\``
      },
      {
        title: 'Create Tasks for clone and test',
        instruction: `Create two Tasks: one to simulate repository cloning and another to run Python tests. Use workspaces to share code between them.`,
        hints: [
          'Use emptyDir workspace for the lab (simpler than PVC)',
          'The clone Task must create files in the workspace',
          'The test Task must read files from the workspace'
        ],
        solution: `\`\`\`bash
# Task 1: Simulate clone (creates files in workspace)
cat > task-clone.yaml << 'EOF'
apiVersion: tekton.dev/v1
kind: Task
metadata:
  name: create-app
  namespace: tekton-lab
spec:
  params:
    - name: app-name
      type: string
      default: myapp

  workspaces:
    - name: output
      description: Output workspace with code

  results:
    - name: app-version
      description: Version of created application

  steps:
    - name: create-files
      image: python:3.11-slim
      workingDir: /workspace/output
      script: |
        #!/bin/bash
        set -e

        # Create simple Flask app
        cat > app.py << 'PYEOF'
        from flask import Flask, jsonify
        app = Flask(__name__)

        @app.route('/health')
        def health():
            return jsonify({"status": "ok", "version": "1.0.0"})

        @app.route('/')
        def index():
            return jsonify({"message": "Tekton CI works!"})

        if __name__ == '__main__':
            app.run(host='0.0.0.0', port=8080)
        PYEOF

        cat > requirements.txt << 'REQEOF'
        flask==3.0.0
        pytest==7.4.3
        REQEOF

        mkdir -p tests
        cat > tests/test_app.py << 'TESTEOF'
        import sys
        sys.path.insert(0, '.')
        from app import app
        import pytest

        @pytest.fixture
        def client():
            app.config['TESTING'] = True
            with app.test_client() as c:
                yield c

        def test_health(client):
            resp = client.get('/health')
            assert resp.status_code == 200
            assert resp.json['status'] == 'ok'

        def test_index(client):
            resp = client.get('/')
            assert resp.status_code == 200
        TESTEOF

        echo "Files created!"
        ls -la
        echo "1.0.0" | tee /tekton/results/app-version
EOF

# Apply Task
kubectl apply -f task-clone.yaml

# Task 2: Run tests
cat > task-test.yaml << 'EOF'
apiVersion: tekton.dev/v1
kind: Task
metadata:
  name: run-python-tests
  namespace: tekton-lab
spec:
  params:
    - name: python-version
      type: string
      default: "3.11"

  workspaces:
    - name: source
      description: Application source code

  results:
    - name: test-status
      description: Test status (passed/failed)

  steps:
    - name: install
      image: python:\$(params.python-version)-slim
      workingDir: /workspace/source
      script: |
        #!/bin/bash
        pip install -r requirements.txt -q
        echo "Dependencies installed"

    - name: test
      image: python:\$(params.python-version)-slim
      workingDir: /workspace/source
      script: |
        #!/bin/bash
        set -e
        pytest tests/ -v --tb=short 2>&1 | tee /tmp/test-output.txt

        if grep -q "FAILED" /tmp/test-output.txt; then
          echo "failed" | tee /tekton/results/test-status
          exit 1
        else
          echo "passed" | tee /tekton/results/test-status
        fi
EOF

kubectl apply -f task-test.yaml

# List created tasks
tkn task list -n tekton-lab
\`\`\``,
        verify: `\`\`\`bash
# Verify Tasks created
kubectl get tasks -n tekton-lab
# Expected: create-app and run-python-tests

tkn task list -n tekton-lab

# Describe Tasks
tkn task describe create-app -n tekton-lab
tkn task describe run-python-tests -n tekton-lab

# Test Task in isolation
tkn task start create-app \
  -n tekton-lab \
  -p app-name=myapp \
  -w name=output,emptyDir="" \
  --showlog

echo "Tasks created and tested successfully!"
\`\`\``
      },
      {
        title: 'Create Pipeline and run with tkn',
        instruction: `Assemble a Pipeline that chains the two Tasks using shared workspaces, run it with the tkn CLI, and verify the logs and results.`,
        hints: [
          'The Pipeline must have a shared workspace passed to both Tasks',
          'Use runAfter to ensure run-python-tests only runs after create-app',
          'Use \$(tasks.TASK.results.RESULT) to pass clone result to test'
        ],
        solution: `\`\`\`bash
# Create Pipeline
cat > pipeline.yaml << 'EOF'
apiVersion: tekton.dev/v1
kind: Pipeline
metadata:
  name: python-ci
  namespace: tekton-lab
spec:
  params:
    - name: app-name
      type: string
      default: myapp
    - name: python-version
      type: string
      default: "3.11"

  workspaces:
    - name: shared-workspace
      description: Workspace shared between Tasks

  tasks:
    - name: setup-code
      taskRef:
        name: create-app
      workspaces:
        - name: output
          workspace: shared-workspace
      params:
        - name: app-name
          value: \$(params.app-name)

    - name: test
      taskRef:
        name: run-python-tests
      runAfter:
        - setup-code
      workspaces:
        - name: source
          workspace: shared-workspace
      params:
        - name: python-version
          value: \$(params.python-version)

  results:
    - name: app-version
      description: App version
      value: \$(tasks.setup-code.results.app-version)
    - name: test-status
      description: Test status
      value: \$(tasks.test.results.test-status)
EOF

kubectl apply -f pipeline.yaml

# Verify Pipeline
tkn pipeline list -n tekton-lab
tkn pipeline describe python-ci -n tekton-lab

# Run the Pipeline
echo "Running Pipeline..."
tkn pipeline start python-ci \
  -n tekton-lab \
  -p app-name=my-app \
  -p python-version=3.11 \
  -w name=shared-workspace,emptyDir="" \
  --showlog

# Check PipelineRuns
tkn pipelinerun list -n tekton-lab

# See last run logs
LAST_RUN=\$(tkn pipelinerun list -n tekton-lab -o name | head -1 | cut -d/ -f2)
echo "Last PipelineRun: \$LAST_RUN"
tkn pipelinerun describe \$LAST_RUN -n tekton-lab
\`\`\``,
        verify: `\`\`\`bash
# Verify Pipeline created
kubectl get pipeline -n tekton-lab
# Expected: python-ci

# Verify PipelineRun(s)
tkn pipelinerun list -n tekton-lab
# Expected: at least 1 run with Succeeded status

# Verify last run details
LAST_RUN=\$(tkn pipelinerun list -n tekton-lab -o name 2>/dev/null | head -1 | cut -d/ -f2)
if [ -n "\$LAST_RUN" ]; then
  tkn pipelinerun describe \$LAST_RUN -n tekton-lab
  echo ""
  echo "Run status: \$(kubectl get pipelinerun \$LAST_RUN -n tekton-lab -o jsonpath='{.status.conditions[0].reason}')"
fi

# Verify pods created during run
kubectl get pods -n tekton-lab | grep "\$LAST_RUN"

echo "Tekton Lab complete!"
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'TaskRun fails with "failed to create pod: pods is forbidden"',
      difficulty: 'medium',
      symptom: 'When creating a TaskRun, it immediately goes to "Failed" state. `kubectl describe taskrun` shows "failed to create pod: pods is forbidden: User system:serviceaccount:tekton-lab:default cannot create resource pods".',
      diagnosis: `\`\`\`bash
# 1. See TaskRun error
kubectl describe taskrun <name> -n tekton-lab | tail -20

# 2. Verify ServiceAccount used
kubectl get taskrun <name> -n tekton-lab -o jsonpath='{.spec.serviceAccountName}'
# Default: "default"

# 3. Verify SA permissions
kubectl auth can-i create pods \
  --as=system:serviceaccount:tekton-lab:default \
  -n tekton-lab
# Expected: yes (but may be "no" = problem)

# 4. See existing RoleBindings
kubectl get rolebindings -n tekton-lab
kubectl get clusterrolebindings | grep tekton
\`\`\``,
      solution: `**Cause:** ServiceAccount without permission to create Pods

**Solution — create SA with RBAC:**
\`\`\`bash
# Create dedicated ServiceAccount
kubectl create serviceaccount tekton-sa -n tekton-lab

# Give permission to create Pods (and Tekton resources)
kubectl create clusterrolebinding tekton-sa-binding \
  --clusterrole=edit \
  --serviceaccount=tekton-lab:tekton-sa

# OR specific Role (more secure)
cat << 'EOF' | kubectl apply -f -
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: tekton-task-runner
  namespace: tekton-lab
rules:
  - apiGroups: [""]
    resources: [pods, pods/log]
    verbs: [get, list, create, delete, watch]
  - apiGroups: [tekton.dev]
    resources: ["*"]
    verbs: ["*"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: tekton-task-runner-binding
  namespace: tekton-lab
subjects:
  - kind: ServiceAccount
    name: tekton-sa
    namespace: tekton-lab
roleRef:
  kind: Role
  name: tekton-task-runner
  apiGroup: rbac.authorization.k8s.io
EOF
\`\`\`

**Specify SA in TaskRun:**
\`\`\`yaml
spec:
  serviceAccountName: tekton-sa  # use the correct SA
  taskRef:
    name: my-task
\`\`\`

**Verify:**
\`\`\`bash
kubectl auth can-i create pods \
  --as=system:serviceaccount:tekton-lab:tekton-sa \
  -n tekton-lab
# Expected: yes
\`\`\``
    },
    {
      title: 'Task stuck in Pending — workspace PVC not found',
      difficulty: 'easy',
      symptom: 'The TaskRun stays in "Pending" state indefinitely. `kubectl describe pod` generated by the TaskRun shows "persistentvolumeclaim not found" or "waiting for PVC to be bound".',
      diagnosis: `\`\`\`bash
# 1. See the Pod created by the TaskRun
kubectl get pods -n tekton-lab | grep taskrun

# 2. Describe Pod to see event
POD=\$(kubectl get pods -n tekton-lab | grep taskrun | awk '{print \$1}')
kubectl describe pod \$POD -n tekton-lab | grep -A 10 "Events:"

# 3. See PVC state
kubectl get pvc -n tekton-lab

# 4. See TaskRun
kubectl describe taskrun <name> -n tekton-lab
\`\`\``,
      solution: `**Cause 1 — PVC doesn't exist:**
\`\`\`bash
# Create PVC before creating TaskRun
cat << 'EOF' | kubectl apply -f -
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: tekton-workspace-pvc
  namespace: tekton-lab
spec:
  accessModes: [ReadWriteOnce]
  resources:
    requests:
      storage: 1Gi
EOF

# Verify PVC was created and is Bound
kubectl get pvc -n tekton-lab
# Status should be Bound (may take a few seconds)
\`\`\`

**Cause 2 — Use emptyDir for tests (without PVC):**
\`\`\`bash
# For labs and tests, emptyDir is simpler
tkn task start my-task \
  -w name=source,emptyDir="" \    # uses emptyDir (no PVC)
  --showlog
\`\`\`

**Cause 3 — volumeClaimTemplate with incorrect StorageClass:**
\`\`\`yaml
# Verify available StorageClass
# kubectl get storageclass

workspaces:
  - name: shared
    volumeClaimTemplate:
      spec:
        storageClassName: standard  # or your cluster's StorageClass
        accessModes: [ReadWriteOnce]
        resources:
          requests:
            storage: 1Gi
\`\`\`

**Verify:**
\`\`\`bash
kubectl get pvc -n tekton-lab
# Status should be Bound, not Pending
\`\`\``
    }
  ]
};
