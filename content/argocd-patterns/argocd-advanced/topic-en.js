window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['argocd-patterns/argocd-advanced'] = {
  theory: `
# ArgoCD Advanced — Multi-Cluster, Notifications & Image Updater

## Relevance
In real production environments, ArgoCD goes beyond syncing a single cluster. Multi-cluster management, automated notifications, and automatic image updates are advanced features that differentiate a basic setup from a mature, enterprise-grade GitOps pipeline.

## Core Concepts

### Multi-Cluster Management

ArgoCD can manage multiple clusters from a single installation:

\`\`\`
ArgoCD (Hub Cluster)
  |-- Cluster: dev (https://dev.k8s.local)
  |-- Cluster: staging (https://staging.k8s.local)
  |-- Cluster: prod-us (https://prod-us.k8s.local)
  +-- Cluster: prod-eu (https://prod-eu.k8s.local)
\`\`\`

**Register an external cluster:**
\`\`\`bash
# List kubeconfig contexts
kubectl config get-contexts

# Add cluster to ArgoCD
argocd cluster add prod-context --name production

# List clusters
argocd cluster list

# Add with labels (for ApplicationSet cluster generator)
argocd cluster add staging-context --name staging --label environment=staging --label tier=non-prod
\`\`\`

**What happens when registering a cluster:**
1. ArgoCD creates a ServiceAccount in the remote cluster
2. Creates ClusterRole and ClusterRoleBinding
3. Stores credentials as a Secret in the argocd namespace
4. The Application Controller connects via the remote cluster's API

**Cluster Secret:**
\`\`\`yaml
apiVersion: v1
kind: Secret
metadata:
  name: prod-cluster
  namespace: argocd
  labels:
    argocd.argoproj.io/secret-type: cluster
    environment: production
    tier: prod
type: Opaque
stringData:
  name: production
  server: https://prod.k8s.local:6443
  config: |
    {
      "bearerToken": "eyJhbG...",
      "tlsClientConfig": {
        "insecure": false,
        "caData": "LS0tLS..."
      }
    }
\`\`\`

### ArgoCD Notifications

The ArgoCD Notifications Controller sends notifications about Application events:

\`\`\`yaml
# argocd-notifications-cm ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-notifications-cm
  namespace: argocd
data:
  # Services (destinations)
  service.slack: |
    token: \$slack-token

  service.webhook.grafana: |
    url: https://grafana.example.com/api/annotations
    headers:
      - name: Authorization
        value: Bearer \$grafana-token

  # Templates (message format)
  template.app-sync-succeeded: |
    message: |
      Application {{.app.metadata.name}} sync succeeded.
      Revision: {{.app.status.sync.revision}}
    slack:
      attachments: |
        [{
          "color": "#18be52",
          "title": "{{.app.metadata.name}} synced",
          "fields": [
            {"title": "Project", "value": "{{.app.spec.project}}", "short": true},
            {"title": "Revision", "value": "{{.app.status.sync.revision | trunc 7}}", "short": true}
          ]
        }]

  template.app-sync-failed: |
    message: |
      Application {{.app.metadata.name}} sync FAILED.
      Error: {{.app.status.operationState.message}}
    slack:
      attachments: |
        [{
          "color": "#E96D76",
          "title": "{{.app.metadata.name}} sync failed",
          "text": "{{.app.status.operationState.message}}"
        }]

  template.app-health-degraded: |
    message: |
      Application {{.app.metadata.name}} is DEGRADED.

  # Triggers (when to send)
  trigger.on-sync-succeeded: |
    - when: app.status.operationState.phase in ['Succeeded']
      send: [app-sync-succeeded]

  trigger.on-sync-failed: |
    - when: app.status.operationState.phase in ['Error', 'Failed']
      send: [app-sync-failed]

  trigger.on-health-degraded: |
    - when: app.status.health.status == 'Degraded'
      send: [app-health-degraded]
\`\`\`

**Enable notifications on an Application:**
\`\`\`yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app
  namespace: argocd
  annotations:
    notifications.argoproj.io/subscribe.on-sync-succeeded.slack: alerts-channel
    notifications.argoproj.io/subscribe.on-sync-failed.slack: alerts-critical
    notifications.argoproj.io/subscribe.on-health-degraded.slack: alerts-critical
\`\`\`

### ArgoCD Image Updater

ArgoCD Image Updater monitors container image registries and automatically updates the tag in Git:

\`\`\`
Container Registry          ArgoCD Image Updater          Git Repository
(Docker Hub, ECR, etc.)  ->  (detects new tag)          ->  (updates values)
                                                           -> ArgoCD sync
\`\`\`

**Installation:**
\`\`\`bash
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj-labs/argocd-image-updater/stable/manifests/install.yaml
\`\`\`

**Configure on an Application:**
\`\`\`yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app
  namespace: argocd
  annotations:
    # Enable Image Updater for this Application
    argocd-image-updater.argoproj.io/image-list: myapp=docker.io/myorg/myapp

    # Update strategy
    argocd-image-updater.argoproj.io/myapp.update-strategy: semver

    # Tag filter (semver tags only)
    argocd-image-updater.argoproj.io/myapp.allow-tags: regexp:^v[0-9]+\\.[0-9]+\\.[0-9]+$

    # How to write the change (directly to Git)
    argocd-image-updater.argoproj.io/write-back-method: git
    argocd-image-updater.argoproj.io/write-back-target: kustomization
\`\`\`

**Update strategies:**

| Strategy | Description |
|----------|-------------|
| **semver** | Updates to the highest compatible semver version |
| **latest** | Updates to the most recent tag (by date) |
| **name** | Updates to the tag with the highest name (alphabetical) |
| **digest** | Updates when a tag's digest changes |

### Best Practices for Production

**GitOps repository structure:**
\`\`\`
Repo 1: app-source (code + Dockerfile)
  -> CI: build, test, push image

Repo 2: gitops-config (K8s manifests)
  |-- base/
  |   +-- kustomization.yaml
  |-- overlays/
  |   |-- dev/
  |   |-- staging/
  |   +-- production/
  +-- apps/  (Application manifests)
\`\`\`

**Source vs config separation:**
- **Source repo**: application code, Dockerfile, tests
- **Config repo**: K8s manifests, Helm values, Kustomize overlays
- CI pushes image to registry and updates tag in config repo
- ArgoCD monitors config repo and applies changes

**Branch strategy:**
\`\`\`
main -> production
staging -> staging environment
develop -> dev environment
\`\`\`

### Disaster Recovery

\`\`\`bash
# Backup: export all Applications
argocd app list -o json > apps-backup.json

# Backup: export ApplicationSets
kubectl get applicationset -n argocd -o yaml > appsets-backup.yaml

# Backup: export Projects
kubectl get appproject -n argocd -o yaml > projects-backup.yaml

# Backup: export critical ConfigMaps
kubectl get cm argocd-cm argocd-rbac-cm argocd-notifications-cm -n argocd -o yaml > config-backup.yaml

# Backup: export repository Secrets
kubectl get secret -n argocd -l argocd.argoproj.io/secret-type=repository -o yaml > repos-backup.yaml

# Restore: apply backups
kubectl apply -f config-backup.yaml
kubectl apply -f projects-backup.yaml
kubectl apply -f repos-backup.yaml
kubectl apply -f appsets-backup.yaml
\`\`\`

## Essential Commands

\`\`\`bash
# Multi-cluster
argocd cluster add <context> --name <name>
argocd cluster list
argocd cluster get <name>
argocd cluster rm <server-url>

# Notifications
kubectl get cm argocd-notifications-cm -n argocd -o yaml
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-notifications-controller

# Image Updater
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-image-updater
argocd-image-updater test <image> --registries-conf-path /etc/registries.conf

# Metrics
kubectl port-forward svc/argocd-server -n argocd 8083:8083
curl http://localhost:8083/metrics | grep argocd_app
\`\`\`

## Common Mistakes

1. **Expired cluster credentials**: ServiceAccount tokens can expire. Monitor and renew periodically.
2. **Notifications not sent**: The Slack/webhook token may be invalid. Check the Secret and test manually.
3. **Image Updater updating to wrong version**: Without tag filters, the updater may pick unwanted tags (e.g., \`latest\`, \`dev\`). Always use \`allow-tags\`.
4. **Single ArgoCD for too many clusters**: Latency increases with many remote clusters. Consider ArgoCD per region.
5. **Not versioning ArgoCD configurations**: argocd-cm, argocd-rbac-cm, and notifications-cm should be in Git.
6. **No ArgoCD monitoring**: ArgoCD exposes Prometheus metrics. Monitor sync failures, latency, and health status.

## Killer.sh Style Challenge

**Scenario:** Configure a production ArgoCD setup with multi-cluster, notifications, and automatic image updates.

**Tasks:**
1. Register 2 external clusters in ArgoCD
2. Configure Slack notifications for sync success/failure
3. Configure ArgoCD Image Updater to automatically update an image
4. Configure monitoring with Prometheus metrics
5. Create a backup/restore plan for ArgoCD
`,
  quiz: [
    {
      question: 'What happens when you register an external cluster in ArgoCD with "argocd cluster add"?',
      options: [
        'ArgoCD installs an agent in the remote cluster',
        'ArgoCD creates ServiceAccount, ClusterRole, and ClusterRoleBinding in the remote cluster and stores credentials as a Secret',
        'The remote cluster connects to ArgoCD automatically',
        'ArgoCD clones the remote cluster\'s kubeconfig'
      ],
      correct: 1,
      explanation: 'When registering a cluster, ArgoCD creates a ServiceAccount with ClusterRole and ClusterRoleBinding in the remote cluster, and stores the credentials (bearer token + CA) as a Secret in the argocd namespace. The Application Controller uses these credentials to connect to the remote cluster via API.',
      reference: 'Related concept: argocd-app-of-apps — use Cluster generator for automatic deployment to registered clusters.'
    },
    {
      question: 'Which ArgoCD component is responsible for sending notifications about Application events?',
      options: [
        'Application Controller',
        'API Server',
        'Notifications Controller',
        'Repo Server'
      ],
      correct: 2,
      explanation: 'The Notifications Controller (argocd-notifications-controller) monitors Application events (sync success/failure, health changes) and sends configured notifications to destinations like Slack, Email, Webhook, etc. It is configured via the argocd-notifications-cm ConfigMap.',
      reference: 'Related concept: argocd-architecture — the Notifications Controller is one of the optional ArgoCD components.'
    },
    {
      question: 'What does ArgoCD Image Updater do?',
      options: [
        'Builds Docker images automatically',
        'Monitors container registries and automatically updates the image tag in Git when a new version is published',
        'Pushes images to the registry',
        'Validates whether images have vulnerabilities'
      ],
      correct: 1,
      explanation: 'Image Updater monitors container registries (Docker Hub, ECR, GCR, etc.) and when it detects a new tag matching the configured strategy (semver, latest, etc.), it automatically updates the manifest in Git with the new tag. ArgoCD then syncs the change.',
      reference: 'Related concept: argocd-sync-strategies — auto-sync ensures that changes made by Image Updater are applied automatically.'
    },
    {
      question: 'Why is it recommended to separate the code repository (source) from the configuration repository (config) in GitOps?',
      options: [
        'Just for organization purposes',
        'To avoid CI loops (build -> push tag -> trigger build), maintain separate audit trails, and allow different teams to manage each repo',
        'Because ArgoCD does not support mixed repos',
        'Because Git does not support large repos'
      ],
      correct: 1,
      explanation: 'Separating source and config avoids CI loops (config commit in source repo triggers new build), keeps audit trails clean (who changed code vs who changed config), and allows different ownership (devs on source, SRE/platform on config).',
      reference: 'Related concept: argocd-applications — Multiple Sources (v2.6+) allows combining a chart from one repo with values from another.'
    },
    {
      question: 'Which Image Updater strategy updates to the highest compatible semver version?',
      options: [
        'latest',
        'digest',
        'semver',
        'name'
      ],
      correct: 2,
      explanation: 'The semver strategy analyzes tags in Semantic Versioning format (e.g., v1.2.3) and updates to the highest compatible version. It can be combined with constraints (e.g., ~1.2 for minor updates only). The latest (by date) and name (alphabetical) strategies are less precise.',
      reference: 'Related concept: argocd-advanced — use allow-tags with regex to filter unwanted tags.'
    },
    {
      question: 'Which ConfigMaps are critical for ArgoCD backup?',
      options: [
        'Only argocd-cm',
        'argocd-cm, argocd-rbac-cm, and argocd-notifications-cm',
        'None — everything is in CRDs',
        'Only repository Secrets'
      ],
      correct: 1,
      explanation: 'Critical ConfigMaps are: argocd-cm (general configuration, repos, timeouts), argocd-rbac-cm (access policies, SSO mapping), and argocd-notifications-cm (notification templates and triggers). Additionally, repository and cluster Secrets should be included in backups.',
      reference: 'Related concept: argocd-projects — AppProjects and Applications should also be versioned/backed up.'
    },
    {
      question: 'How do you enable notifications for a specific Application in ArgoCD?',
      options: [
        'By configuring in the argocd-cm ConfigMap',
        'By adding annotations to the Application with the format notifications.argoproj.io/subscribe.<trigger>.<service>',
        'By creating a notification CRD',
        'By configuring in argocd-rbac-cm'
      ],
      correct: 1,
      explanation: 'Notifications are enabled via annotations on the Application: notifications.argoproj.io/subscribe.<trigger>.<service>: <destination>. Example: notifications.argoproj.io/subscribe.on-sync-failed.slack: alerts-critical. The trigger defines when to notify, service defines the channel.',
      reference: 'Related concept: argocd-advanced — configure templates and triggers in argocd-notifications-cm before enabling.'
    }
  ],
  flashcards: [
    {
      front: 'How does ArgoCD manage multiple clusters?',
      back: '**Registration:**\n```bash\nargocd cluster add <context> --name <name>\n```\n\n**What happens:**\n1. Creates ServiceAccount in the remote cluster\n2. Creates ClusterRole + ClusterRoleBinding\n3. Stores credentials as Secret in argocd namespace\n\n**Labels for ApplicationSets:**\n```bash\nargocd cluster add ctx --label env=prod --label tier=production\n```\n\n**Best practice:**\n- One ArgoCD hub for clusters in the same region\n- Separate ArgoCD per region to reduce latency\n- Monitor cluster connectivity'
    },
    {
      front: 'How do you configure notifications in ArgoCD?',
      back: '**1. Configure service (argocd-notifications-cm):**\n```yaml\nservice.slack: |\n  token: $slack-token\n```\n\n**2. Create template:**\n```yaml\ntemplate.app-sync-failed: |\n  message: "{{.app.metadata.name}} FAILED"\n```\n\n**3. Create trigger:**\n```yaml\ntrigger.on-sync-failed: |\n  - when: app.status.operationState.phase in [\'Failed\']\n    send: [app-sync-failed]\n```\n\n**4. Enable on Application (annotation):**\n```yaml\nnotifications.argoproj.io/subscribe.on-sync-failed.slack: alerts\n```'
    },
    {
      front: 'How does ArgoCD Image Updater work?',
      back: '**Flow:**\n1. Monitors container registry periodically\n2. Detects new tag compatible with the strategy\n3. Updates the manifest in Git (write-back)\n4. ArgoCD detects change and syncs\n\n**Configuration (annotations):**\n```yaml\nargocd-image-updater.argoproj.io/image-list: \n  app=docker.io/org/app\nargocd-image-updater.argoproj.io/app.update-strategy: \n  semver\nargocd-image-updater.argoproj.io/app.allow-tags: \n  regexp:^v[0-9]+\\\\.[0-9]+$\nargocd-image-updater.argoproj.io/write-back-method: \n  git\n```\n\n**Strategies:** semver, latest, name, digest'
    },
    {
      front: 'What is the recommended repo structure for GitOps?',
      back: '**Repo 1: Source (code)**\n- Application code\n- Dockerfile\n- Tests\n- CI pipeline (build + push image)\n\n**Repo 2: Config (manifests)**\n- Kubernetes manifests\n- Helm values / Kustomize overlays\n- ArgoCD Application manifests\n- Structure per environment:\n```\noverlays/\n  dev/\n  staging/\n  production/\n```\n\n**Benefits:**\n- Avoids CI loops\n- Separate audit trails\n- Different ownership (dev vs SRE)\n- Independent rollback'
    },
    {
      front: 'How do you monitor ArgoCD with Prometheus?',
      back: '**Exposed metrics:**\n- `argocd_app_info` — Application info\n- `argocd_app_sync_total` — sync count\n- `argocd_app_reconcile_count` — reconciliations\n- `argocd_app_health_status` — health per app\n- `argocd_cluster_api_server_requests_total`\n\n**Endpoints:**\n- Server: :8083/metrics\n- Controller: :8082/metrics\n- Repo Server: :8084/metrics\n\n**ServiceMonitor:**\n```yaml\napiVersion: monitoring.coreos.com/v1\nkind: ServiceMonitor\nmetadata:\n  name: argocd\nspec:\n  selector:\n    matchLabels:\n      app.kubernetes.io/part-of: argocd\n```\n\n**Grafana Dashboard:** ID 14584'
    },
    {
      front: 'Production checklist for ArgoCD?',
      back: '**Infrastructure:**\n- [ ] HA installation (replicas > 1)\n- [ ] Resource limits on all pods\n- [ ] TLS via Ingress + cert-manager\n- [ ] Redis HA with Sentinel\n\n**Security:**\n- [ ] SSO configured (Dex/OIDC)\n- [ ] RBAC with policy.default: readonly\n- [ ] Projects per team\n- [ ] Sync windows for production\n\n**Operational:**\n- [ ] Monitoring (Prometheus + Grafana)\n- [ ] Notifications (Slack/PagerDuty)\n- [ ] Backup of ConfigMaps and Secrets\n- [ ] Git webhooks for fast sync\n\n**GitOps:**\n- [ ] Source and config repos separated\n- [ ] Image Updater configured\n- [ ] ApplicationSets for scaling'
    }
  ],
  lab: {
    scenario: 'You need to configure advanced ArgoCD features: notifications, metrics, and backup for a production environment.',
    objective: 'Configure webhook notifications, explore ArgoCD Prometheus metrics, and create a backup/restore procedure.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Configure Notifications',
        instruction: `Configure ArgoCD Notifications to send notifications via webhook.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-notifications-cm
  namespace: argocd
data:
  service.webhook.test: |
    url: https://webhook.site/your-unique-url
    headers:
      - name: Content-Type
        value: application/json

  template.app-sync-status: |
    webhook:
      test:
        method: POST
        body: |
          {
            "app": "{{.app.metadata.name}}",
            "sync": "{{.app.status.sync.status}}",
            "health": "{{.app.status.health.status}}"
          }

  trigger.on-sync-succeeded: |
    - when: app.status.operationState.phase in ['Succeeded']
      send: [app-sync-status]

  trigger.on-sync-failed: |
    - when: app.status.operationState.phase in ['Error', 'Failed']
      send: [app-sync-status]
EOF
\`\`\``,
        hints: [
          'Use webhook.site to create a free test endpoint',
          'The template defines the message format',
          'The trigger defines when the notification is sent'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-notifications-cm
  namespace: argocd
data:
  service.webhook.test: |
    url: https://webhook.site/test
    headers:
      - name: Content-Type
        value: application/json
  template.app-sync-status: |
    webhook:
      test:
        method: POST
        body: |
          {"app": "{{.app.metadata.name}}", "sync": "{{.app.status.sync.status}}"}
  trigger.on-sync-succeeded: |
    - when: app.status.operationState.phase in ['Succeeded']
      send: [app-sync-status]
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verify ConfigMap
kubectl get cm argocd-notifications-cm -n argocd -o yaml | grep -c "template\\|trigger\\|service"
# Expected output: number > 0

# Verify controller logs
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-notifications-controller --tail=5
# Expected output: logs without errors
\`\`\``
      },
      {
        title: 'Explore Prometheus Metrics',
        instruction: `Explore the Prometheus metrics exposed by ArgoCD.

\`\`\`bash
# Port-forward for server metrics
kubectl port-forward svc/argocd-server-metrics -n argocd 8083:8083 &

# Or directly from the pod
kubectl exec -n argocd deploy/argocd-server -- curl -s http://localhost:8083/metrics 2>/dev/null | grep argocd_app | head -20

# Application Controller metrics
kubectl exec -n argocd sts/argocd-application-controller -- curl -s http://localhost:8082/metrics 2>/dev/null | grep argocd_app_reconcile | head -10

# Repo Server metrics
kubectl exec -n argocd deploy/argocd-repo-server -- curl -s http://localhost:8084/metrics 2>/dev/null | grep argocd_git | head -10
\`\`\``,
        hints: [
          'ArgoCD exposes metrics on 3 separate endpoints',
          'Metrics include sync status, health, latency, and operation counts',
          'Use these metrics for Grafana dashboards and alerts'
        ],
        solution: `\`\`\`bash
kubectl exec -n argocd deploy/argocd-server -- curl -s http://localhost:8083/metrics 2>/dev/null | grep argocd_app | head -20
\`\`\``,
        verify: `\`\`\`bash
# Verify that metrics are available
kubectl exec -n argocd deploy/argocd-server -- curl -s http://localhost:8083/metrics 2>/dev/null | grep -c argocd_app
# Expected output: number > 0
\`\`\``
      },
      {
        title: 'Create ArgoCD Backup',
        instruction: `Create a complete backup of ArgoCD configurations.

\`\`\`bash
# Backup ConfigMaps
kubectl get cm argocd-cm argocd-rbac-cm argocd-notifications-cm -n argocd -o yaml > /tmp/argocd-cm-backup.yaml

# Backup Projects
kubectl get appproject -n argocd -o yaml > /tmp/argocd-projects-backup.yaml

# Backup Applications
kubectl get application -n argocd -o yaml > /tmp/argocd-apps-backup.yaml

# Backup ApplicationSets
kubectl get applicationset -n argocd -o yaml > /tmp/argocd-appsets-backup.yaml

# Backup Secrets (repos and clusters)
kubectl get secret -n argocd -l argocd.argoproj.io/secret-type -o yaml > /tmp/argocd-secrets-backup.yaml

# List backups
ls -la /tmp/argocd-*-backup.yaml
\`\`\``,
        hints: [
          'ConfigMaps contain the main ArgoCD configuration',
          'Secrets contain repository and cluster credentials',
          'In production, store backups in a secure location (not in Git if they contain secrets)'
        ],
        solution: `\`\`\`bash
kubectl get cm argocd-cm argocd-rbac-cm -n argocd -o yaml > /tmp/argocd-cm-backup.yaml
kubectl get appproject -n argocd -o yaml > /tmp/argocd-projects-backup.yaml
kubectl get application -n argocd -o yaml > /tmp/argocd-apps-backup.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verify backups were created
ls -la /tmp/argocd-*-backup.yaml
# Expected output: files with size > 0

# Verify backup content
grep "kind:" /tmp/argocd-cm-backup.yaml | head -3
# Expected output: kind: ConfigMap
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Remote cluster disconnected — "cluster connection failed"',
      difficulty: 'medium',
      symptom: 'Applications on a remote cluster show "cluster connection failed" error and have Unknown status.',
      diagnosis: `\`\`\`bash
# Check connectivity
argocd cluster get <cluster-name>

# View cluster status
argocd cluster list

# Check cluster Secret
kubectl get secret -n argocd -l argocd.argoproj.io/secret-type=cluster

# Test direct connection
kubectl --context <context-name> get nodes
\`\`\``,
      solution: `**Common causes:**

1. **Expired token:** ServiceAccount tokens can expire. Recreate:
\`\`\`bash
argocd cluster rm <server-url>
argocd cluster add <context-name> --name <cluster-name>
\`\`\`

2. **Firewall/network:** ArgoCD needs to access the remote cluster's API server. Check network connectivity.

3. **Changed TLS certificate:** If the cluster CA changed, update the Secret:
\`\`\`bash
# Re-register the cluster
argocd cluster rm <server-url>
argocd cluster add <context-name>
\`\`\`

4. **Unavailable API server:** The remote cluster may be down. Check cluster health.`
    },
    {
      title: 'Notifications are not being sent',
      difficulty: 'easy',
      symptom: 'Configured notifications in ArgoCD but no messages are received in Slack/webhook even when Applications sync.',
      diagnosis: `\`\`\`bash
# Check notifications controller logs
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-notifications-controller --tail=30

# Check ConfigMap
kubectl get cm argocd-notifications-cm -n argocd -o yaml

# Check Application annotations
kubectl get application <app-name> -n argocd -o jsonpath='{.metadata.annotations}' | jq .
\`\`\``,
      solution: `**Common causes:**

1. **Missing annotation on Application:** Verify the subscribe annotation is correct:
\`\`\`yaml
annotations:
  notifications.argoproj.io/subscribe.on-sync-succeeded.slack: channel-name
\`\`\`

2. **Invalid token:** The Slack/webhook token may be wrong. Check the Secret:
\`\`\`bash
kubectl get secret argocd-notifications-secret -n argocd -o yaml
\`\`\`

3. **Template/trigger syntax error:** Validate the ConfigMap YAML carefully. A Go template error causes silent failure.

4. **Controller not restarted:** After changing the ConfigMap, the controller may need a restart:
\`\`\`bash
kubectl rollout restart deployment argocd-notifications-controller -n argocd
\`\`\``
    },
    {
      title: 'Image Updater updates to incorrect version',
      difficulty: 'hard',
      symptom: 'ArgoCD Image Updater updated the image tag to an unexpected version (e.g., dev tag, pre-release, or latest).',
      diagnosis: `\`\`\`bash
# View Image Updater logs
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-image-updater --tail=30

# Check Application annotations
kubectl get application <app-name> -n argocd -o yaml | grep "argocd-image-updater"

# Check available tags in registry
argocd-image-updater test <image> --semver-constraint "~1.2"
\`\`\``,
      solution: `**Solutions:**

1. **Add tag filter:**
\`\`\`yaml
# Only semver tags (v1.2.3)
argocd-image-updater.argoproj.io/myapp.allow-tags: regexp:^v[0-9]+\\.[0-9]+\\.[0-9]+$

# Ignore specific tags
argocd-image-updater.argoproj.io/myapp.ignore-tags: latest, dev, *-rc*
\`\`\`

2. **Use semver constraint:**
\`\`\`yaml
# Only minor updates within v1.x
argocd-image-updater.argoproj.io/myapp.update-strategy: semver
argocd-image-updater.argoproj.io/myapp.allow-tags: "~1"
\`\`\`

3. **Use digest strategy for fixed tag:**
\`\`\`yaml
# Update only when the digest of "stable" changes
argocd-image-updater.argoproj.io/myapp.update-strategy: digest
\`\`\`

4. **Revert:** fix the manifest in Git with the correct tag and Image Updater will respect the filter on the next cycle.`
    }
  ]
};
