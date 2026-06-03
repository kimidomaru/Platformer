window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['kcna-app-delivery/gitops-cicd'] = {
  theory: `# GitOps & CI/CD for Kubernetes

## Exam Relevance
> KCNA covers GitOps principles and CI/CD concepts for cloud native applications. Expect questions about GitOps principles (Git as single source of truth, reconciliation), tools (ArgoCD, Flux), and CI/CD pipeline stages.

## CI/CD Fundamentals

**Continuous Integration (CI)**: Automatically build, test, and validate code on every commit.

**Continuous Delivery (CD)**: Automatically deploy validated code to environments (staging → production).

**Continuous Deployment**: Automatically deploys to production without manual approval.

### CI/CD Pipeline Stages
\`\`\`
Code Push
  ↓
1. Build       — compile code, build container image
2. Test        — unit tests, integration tests, security scan
3. Package     — tag image, push to registry
4. Deploy      — apply manifests to Kubernetes cluster
5. Verify      — smoke tests, health checks
\`\`\`

### For Kubernetes specifically:
\`\`\`
git push
  ↓
CI: docker build → security scan → docker push registry
  ↓
CD: update image tag in manifests → apply to cluster
  ↓
Kubernetes: rolling update → health checks
\`\`\`

## GitOps

**GitOps** is an operational model that uses **Git as the single source of truth** for infrastructure and application configuration.

### Core GitOps Principles (OpenGitOps)
1. **Declarative**: Desired system state expressed declaratively (YAML)
2. **Versioned & Immutable**: State stored in Git — every change is tracked
3. **Pulled Automatically**: Software agents pull changes from Git
4. **Continuously Reconciled**: Agents compare actual state vs desired state and converge

### Traditional CD vs GitOps

| Traditional CD | GitOps |
|---------------|--------|
| CI system pushes to cluster | Agent in cluster pulls from Git |
| Cluster credentials in CI | No cluster credentials in CI |
| Manual rollback | git revert → auto-rollback |
| Drift detection is manual | Continuous automatic drift detection |
| Audit trail in CI logs | Audit trail in Git history |

### GitOps Flow
\`\`\`
Developer merges PR
  ↓
Git repository (YAML manifests updated)
  ↓
GitOps Controller (ArgoCD/Flux) detects change
  ↓
Controller pulls changes and applies to cluster
  ↓
Kubernetes reconciles to new desired state
\`\`\`

## ArgoCD

**ArgoCD** is a declarative GitOps continuous delivery tool for Kubernetes (CNCF Graduated project).

### Key Concepts
- **Application**: ArgoCD CRD that links a Git repo + path to a cluster + namespace
- **Sync**: Process of applying Git state to the cluster
- **Health**: Tracks whether resources are healthy (pods running, services routable)
- **Drift**: Detects when cluster state diverges from Git state

### ArgoCD Application Example
\`\`\`yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: myapp
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/org/k8s-configs
    targetRevision: main
    path: overlays/production
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true         # delete resources removed from Git
      selfHeal: true      # revert manual changes to cluster
    syncOptions:
      - CreateNamespace=true
\`\`\`

\`\`\`bash
# ArgoCD CLI basics
argocd app list
argocd app get myapp
argocd app sync myapp
argocd app diff myapp    # show diff between Git and cluster
argocd app history myapp
\`\`\`

## Flux

**Flux** is another CNCF Graduated GitOps tool. Flux v2 (GitOps Toolkit) uses separate controllers:

| Component | Function |
|-----------|----------|
| **Source Controller** | Watches Git repos, OCI registries, Helm repos |
| **Kustomize Controller** | Applies Kustomize overlays |
| **Helm Controller** | Manages Helm releases |
| **Notification Controller** | Sends alerts (Slack, PagerDuty) |

\`\`\`yaml
# Flux GitRepository source
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: myapp-config
  namespace: flux-system
spec:
  interval: 5m
  url: https://github.com/org/k8s-configs
  ref:
    branch: main
\`\`\`

## Image Update Automation

A key GitOps pattern: when a new image is pushed to the registry, automatically update the image tag in Git.

\`\`\`
New image pushed to registry
  ↓
ArgoCD Image Updater / Flux Image Automation
  ↓
Commits new image tag to Git manifests
  ↓
GitOps controller syncs new tag to cluster
\`\`\`

## CI/CD Tools for Kubernetes

### Build & CI Tools
| Tool | Type |
|------|------|
| **GitHub Actions** | Cloud-hosted CI |
| **GitLab CI/CD** | Integrated CI/CD |
| **Jenkins** | Self-hosted, extensible |
| **Tekton** | Kubernetes-native CI (CNCF) |
| **Drone** | Container-native CI |

### CD / GitOps Tools
| Tool | Type |
|------|------|
| **ArgoCD** | GitOps, Kubernetes-native (CNCF Graduated) |
| **Flux** | GitOps, Kubernetes-native (CNCF Graduated) |
| **Spinnaker** | Multi-cloud CD |
| **Jenkins X** | Kubernetes-native Jenkins |

### Security in CI/CD
- **Image scanning**: Trivy, Snyk, Grype — scan for CVEs before push
- **SAST**: Static code analysis (SonarQube, Semgrep)
- **Image signing**: Sigstore/Cosign — cryptographic attestation
- **Secrets**: Never commit secrets to Git — use external secrets managers

## Key Benefits of GitOps

1. **Security**: Cluster credentials not needed in CI
2. **Auditability**: Every change tracked in Git with author + timestamp
3. **Reproducibility**: Any state can be reproduced from Git history
4. **Rollback**: \`git revert\` triggers automatic rollback
5. **Disaster Recovery**: Cluster can be recreated from Git state

## Challenges

- **Secret management**: Secrets can't be committed to Git in plaintext — use Sealed Secrets or external secrets managers
- **Order dependencies**: Some resources must be created before others (namespaces before workloads)
- **Drift from non-GitOps changes**: kubectl edits bypass Git — need selfHeal or enforcement

## Common Patterns

### App of Apps (ArgoCD)
\`\`\`yaml
# One ArgoCD Application manages other Applications
# Makes cluster state declarative even at the app-management level
\`\`\`

### Environment promotion
\`\`\`
dev branch → staging overlay → production overlay
     ↓               ↓                ↓
auto-sync       auto-sync      manual sync (approval)
\`\`\`

### Pull Request environments
\`\`\`
PR opened → CI creates preview namespace → ArgoCD deploys → PR closed → namespace deleted
\`\`\`
`,
  quiz: [
    {
      question: 'What is the core principle that distinguishes GitOps from traditional CD?',
      options: [
        'Git is the single source of truth; a cluster-side agent pulls and reconciles state',
        'Deployments are fully automated without any human approval',
        'Applications are built and tested before being committed to Git',
        'Container images are stored in Git repositories alongside the application code'
      ],
      correct: 0,
      explanation: 'GitOps defines Git as the single source of truth. A cluster-side agent (ArgoCD, Flux) watches Git and pulls changes — the cluster doesn\'t receive pushes from CI systems. This inverts the traditional push model.',
      reference: 'Review "Core GitOps Principles" and "Traditional CD vs GitOps" table.'
    },
    {
      question: 'What is "drift" in the context of GitOps?',
      options: [
        'When the actual cluster state diverges from the desired state in Git',
        'When Git branches diverge and cause merge conflicts',
        'When container images drift out of date in the registry',
        'When Kubernetes versions drift between nodes in a cluster'
      ],
      correct: 0,
      explanation: 'Drift occurs when someone manually changes the cluster state (kubectl edit, kubectl delete) and the cluster no longer matches what\'s in Git. GitOps controllers detect and can automatically correct drift.',
      reference: 'Review "ArgoCD" section — Drift definition.'
    },
    {
      question: 'Which of these is a CNCF Graduated GitOps tool?',
      options: [
        'ArgoCD',
        'Jenkins',
        'GitHub Actions',
        'Spinnaker'
      ],
      correct: 0,
      explanation: 'ArgoCD is a CNCF Graduated project. Flux is also CNCF Graduated. Jenkins and GitHub Actions are general CI tools; Spinnaker is a multi-cloud CD tool (not CNCF-graduated).',
      reference: 'Review "CD / GitOps Tools" table.'
    },
    {
      question: 'What is the main security advantage of GitOps over traditional CD pipelines?',
      options: [
        'The CI system does not need cluster credentials to deploy — the agent pulls from Git',
        'GitOps automatically scans container images for vulnerabilities',
        'GitOps enforces mandatory code review before deployment',
        'GitOps uses encrypted Git repositories for manifest storage'
      ],
      correct: 0,
      explanation: 'In traditional CD, the CI server needs write access to the cluster (credentials stored in CI). GitOps reverses this: the agent IN the cluster pulls from Git, so CI never needs cluster access.',
      reference: 'Review "Key Benefits of GitOps" — Security benefit.'
    },
    {
      question: 'What does ArgoCD\'s "selfHeal: true" option do?',
      options: [
        'Automatically reverts manual kubectl changes to match the Git state',
        'Restarts crashing pods automatically',
        'Repairs broken YAML syntax in Git commits',
        'Re-runs failed CI pipelines automatically'
      ],
      correct: 0,
      explanation: 'selfHeal: true makes ArgoCD automatically sync the cluster back to the Git state when it detects drift — i.e., if someone runs kubectl and changes a resource, ArgoCD reverts it.',
      reference: 'Review "ArgoCD Application Example" — syncPolicy.automated.selfHeal.'
    },
    {
      question: 'What is Tekton and how does it differ from ArgoCD?',
      options: [
        'Tekton is a Kubernetes-native CI tool for building pipelines; ArgoCD is a CD/GitOps tool for deployment',
        'Tekton is a GitOps tool; ArgoCD is a CI build tool',
        'Tekton manages Helm releases; ArgoCD manages Kustomize overlays',
        'Tekton is a container registry; ArgoCD is an image scanner'
      ],
      correct: 0,
      explanation: 'Tekton (CNCF project) defines Pipelines and Tasks as Kubernetes custom resources for CI (build, test). ArgoCD is a GitOps deployment tool. They complement each other in a full CI/CD pipeline.',
      reference: 'Review "CI/CD Tools for Kubernetes" — Build & CI Tools vs CD/GitOps Tools.'
    },
    {
      question: 'What challenge does GitOps create for Kubernetes Secrets?',
      options: [
        'Secrets cannot be committed to Git in plaintext — require encryption tools like Sealed Secrets',
        'GitOps cannot deploy Secrets — only ConfigMaps are supported',
        'Secrets must be base64 encoded before committing to Git',
        'Git history makes Secrets immutable after the first commit'
      ],
      correct: 0,
      explanation: 'The fundamental GitOps challenge: Kubernetes Secrets are only base64-encoded, so committing them to Git exposes sensitive data. Solutions: Sealed Secrets (encrypted), External Secrets Operator (sync from vault), or Vault Agent.',
      reference: 'Review "Challenges" section — Secret management.'
    },
    {
      question: 'What is "image update automation" in a GitOps workflow?',
      options: [
        'Automatically updating the image tag in Git manifests when a new image is pushed to the registry',
        'Automatically scanning images for vulnerabilities on push',
        'Automatically building images from Dockerfile commits',
        'Automatically rotating image pull credentials'
      ],
      correct: 0,
      explanation: 'Image update automation (available in ArgoCD Image Updater and Flux Image Automation) watches the registry for new image tags and commits the updated tag to Git — triggering a GitOps sync.',
      reference: 'Review "Image Update Automation" section.'
    }
  ],
  flashcards: [
    {
      front: 'What are the 4 core principles of GitOps (OpenGitOps)?',
      back: '1. Declarative: desired state expressed in YAML. 2. Versioned & Immutable: stored in Git. 3. Pulled Automatically: agent pulls from Git. 4. Continuously Reconciled: agent compares and converges actual vs desired state.'
    },
    {
      front: 'What is the key security difference between GitOps and traditional CD?',
      back: 'Traditional CD: CI server pushes to cluster (needs cluster credentials). GitOps: cluster agent pulls from Git (CI never needs cluster access). Reduces attack surface and blast radius of CI compromise.'
    },
    {
      front: 'What does ArgoCD Application "prune: true" do?',
      back: 'When prune: true, ArgoCD deletes cluster resources that are removed from the Git repository. Without it, removed resources stay in the cluster after they\'re removed from Git.'
    },
    {
      front: 'What is the difference between Continuous Delivery and Continuous Deployment?',
      back: 'Continuous Delivery: code is automatically built, tested, and made ready for deployment — but a human approves the production release. Continuous Deployment: automatically deploys to production after passing tests — no human approval.'
    },
    {
      front: 'What are ArgoCD and Flux, and how do they relate?',
      back: 'Both are CNCF Graduated GitOps tools. ArgoCD: single unified controller with a Web UI, focuses on Git repositories. Flux v2 (GitOps Toolkit): modular controllers (source, kustomize, helm, notification) — more composable.'
    },
    {
      front: 'How do you handle Kubernetes Secrets in a GitOps workflow?',
      back: 'Options: Sealed Secrets (encrypt secrets for safe Git storage), External Secrets Operator (sync from HashiCorp Vault/AWS/GCP), Vault Agent Sidecar (inject secrets at runtime), or SOPS (encrypted files in Git).'
    },
    {
      front: 'What is "environment promotion" in a GitOps pipeline?',
      back: 'Progressively promoting application changes through environments: dev (auto-sync) → staging (auto-sync) → production (manual approval). Each environment has its own Git branch or overlay directory.'
    }
  ],
  lab: {
    scenario: 'Simulate a GitOps workflow using kubectl and directory-based manifests. You\'ll practice the reconciliation concept by observing how a GitOps system would detect and correct drift.',
    objective: 'Understand GitOps principles through hands-on simulation of the declarative reconciliation loop.',
    duration: '15-20 minutes',
    steps: [
      {
        title: 'Set up declarative application state',
        instruction: `Create a "GitOps directory" at \`/tmp/gitops-demo\` with a Deployment and Service manifest for a demo app. Apply this state to create the "Git desired state" in the cluster. This represents the state ArgoCD/Flux would sync from Git.`,
        hints: [
          'Create a directory with deployment.yaml and service.yaml',
          'kubectl apply -f /tmp/gitops-demo/ to apply all manifests in the directory',
          'This simulates what a GitOps controller does when it syncs from Git'
        ],
        solution: `\`\`\`bash
mkdir -p /tmp/gitops-demo

cat <<EOF > /tmp/gitops-demo/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: demo-app
  namespace: default
  labels:
    app: demo
    managed-by: gitops
spec:
  replicas: 2
  selector:
    matchLabels:
      app: demo
  template:
    metadata:
      labels:
        app: demo
    spec:
      containers:
      - name: demo
        image: nginx:1.20
        ports:
        - containerPort: 80
EOF

cat <<EOF > /tmp/gitops-demo/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: demo-app
  namespace: default
spec:
  selector:
    app: demo
  ports:
  - port: 80
    targetPort: 80
EOF

# "Sync from Git" — apply desired state
kubectl apply -f /tmp/gitops-demo/
\`\`\``,
        verify: `\`\`\`bash
kubectl get deployment demo-app
# Expected: READY=2/2

kubectl get svc demo-app
# Expected: ClusterIP service

# Store the "Git hash" (current state)
kubectl get deployment demo-app -o jsonpath='{.spec.replicas}'
# Expected: 2
\`\`\``
      },
      {
        title: 'Simulate drift and detect it',
        instruction: `Simulate "manual drift" by scaling the deployment to 5 replicas outside of Git (using kubectl scale). This represents someone bypassing GitOps. Then detect the drift by comparing the actual state to the "Git state" in \`/tmp/gitops-demo\`.`,
        hints: [
          'kubectl scale deployment demo-app --replicas=5',
          'kubectl diff -f /tmp/gitops-demo/ shows the drift',
          'The Git file still says 2 replicas — the cluster has drifted'
        ],
        solution: `\`\`\`bash
# Create drift: manual change outside of Git
kubectl scale deployment demo-app --replicas=5

# Verify drift exists
kubectl get deployment demo-app
# Shows 5 replicas (not 2 as in "Git")

# Detect drift (what kubectl diff does — what ArgoCD "diff" also does)
kubectl diff -f /tmp/gitops-demo/
# Shows: -  replicas: 5
#        +  replicas: 2
\`\`\``,
        verify: `\`\`\`bash
kubectl get deployment demo-app -o jsonpath='{.spec.replicas}'
# Expected: 5 (drifted!)

kubectl diff -f /tmp/gitops-demo/ ; echo "Exit: $?"
# Expected: diff output showing replicas change, exit code 1 (diff found)
\`\`\``
      },
      {
        title: 'Reconcile — restore desired Git state',
        instruction: `Reconcile the cluster state back to the "Git desired state". This simulates what ArgoCD selfHeal or Flux reconciliation does. Verify the cluster returns to the declarative state.`,
        hints: [
          'kubectl apply -f /tmp/gitops-demo/ re-applies the Git state',
          'This is what ArgoCD/Flux does automatically in a real GitOps setup',
          'Verify replicas return to 2'
        ],
        solution: `\`\`\`bash
# Reconcile: re-apply the Git state (what ArgoCD/Flux selfHeal does)
kubectl apply -f /tmp/gitops-demo/

# Verify convergence
kubectl get deployment demo-app
kubectl diff -f /tmp/gitops-demo/ && echo "No drift" || echo "Drift detected"
\`\`\``,
        verify: `\`\`\`bash
kubectl get deployment demo-app -o jsonpath='{.spec.replicas}'
# Expected: 2 (reconciled back to Git state)

kubectl diff -f /tmp/gitops-demo/
# Expected: no output (no diff — cluster matches Git)

# Cleanup
kubectl delete -f /tmp/gitops-demo/
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'ArgoCD application stuck in OutOfSync state',
      difficulty: 'easy',
      symptom: 'ArgoCD shows an application as OutOfSync even after clicking "Sync". The application keeps reverting or the sync never completes.',
      diagnosis: `\`\`\`bash
# Check app status
argocd app get <app-name>

# Check what's different
argocd app diff <app-name>

# Check sync status for individual resources
argocd app resources <app-name>

# Check ArgoCD application logs
kubectl logs -n argocd deployment/argocd-application-controller --tail=50
\`\`\``,
      solution: `Common causes:

1. **Hook failures** — a pre-sync/post-sync Job failed:
\`\`\`bash
kubectl get jobs -n <namespace>
kubectl logs job/<hook-job> -n <namespace>
\`\`\`

2. **Resource with no owner** — resource exists in cluster but not in Git:
\`\`\`bash
# Enable prune to delete orphaned resources
argocd app sync <app> --prune
\`\`\`

3. **Sync wave ordering** — resources need specific creation order:
\`\`\`yaml
# Add sync wave annotation
metadata:
  annotations:
    argocd.argoproj.io/sync-wave: "1"
\`\`\`

4. **Health check failing** — resource is not considered healthy:
\`\`\`bash
argocd app resources <app> | grep -v Healthy
\`\`\``
    },
    {
      title: 'GitOps pipeline not picking up new commits',
      difficulty: 'medium',
      symptom: 'Merged a PR with updated manifests but ArgoCD/Flux is not applying the changes. The cluster still shows old configuration.',
      diagnosis: `\`\`\`bash
# For ArgoCD:
argocd app get <app-name> | grep "Sync Status"
argocd app get <app-name> | grep "Last Sync"
# Check if it's aware of the latest commit

# For Flux:
kubectl get gitrepositories -n flux-system
kubectl describe gitrepository <name> -n flux-system
# Look for "Artifact Revision" — does it match the expected commit?

# Check controller logs
kubectl logs -n argocd deployment/argocd-repo-server --tail=30
kubectl logs -n flux-system deployment/source-controller --tail=30
\`\`\``,
      solution: `1. **Git repository not reachable** — check credentials/SSH key:
\`\`\`bash
# ArgoCD: check repo connection
argocd repo list
argocd repo get <repo-url>
\`\`\`

2. **Polling interval not elapsed** — trigger manual sync:
\`\`\`bash
# ArgoCD manual sync
argocd app sync <app-name>

# Flux manual reconcile
flux reconcile source git <source-name>
flux reconcile kustomization <ks-name>
\`\`\`

3. **Wrong branch** — verify the source is watching the correct branch:
\`\`\`bash
argocd app get <app> | grep "Target Revision"
\`\`\``
    }
  ]
};
