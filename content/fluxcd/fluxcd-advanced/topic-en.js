window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['fluxcd/fluxcd-advanced'] = {
  theory: `
# FluxCD: Image Automation, Notifications & Multi-tenancy

## Relevance
This topic covers Flux's advanced features: image update automation (Image Automation), notification and alerting system (Notification Controller), and multi-tenancy patterns for securely managing multiple teams on a shared cluster.

## Fundamental Concepts

### Image Automation — Automatic Image Updates

Flux can monitor container registries and automatically update manifests in the Git repository when new images are published.

**Components:**
1. **ImageRepository** — monitors a registry for new images
2. **ImagePolicy** — defines which tag to select (semver, alphabetical, numeric)
3. **ImageUpdateAutomation** — writes the selected tag back to Git

\`\`\`yaml
# 1. ImageRepository — monitor registry
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImageRepository
metadata:
  name: podinfo
  namespace: flux-system
spec:
  image: ghcr.io/stefanprodan/podinfo
  interval: 5m
  secretRef:
    name: ghcr-auth          # docker-registry Secret for private repos
\`\`\`

\`\`\`yaml
# 2. ImagePolicy — select which tag to use
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImagePolicy
metadata:
  name: podinfo
  namespace: flux-system
spec:
  imageRepositoryRef:
    name: podinfo             # Reference to the ImageRepository above
  policy:
    semver:
      range: ">=6.0.0"       # Any version >= 6.0.0 (latest patch)
    # alphabetical:           # Alternative: alphabetical order
    #   order: asc
    # numerical:              # Alternative: highest number
    #   order: asc
\`\`\`

\`\`\`yaml
# 3. ImageUpdateAutomation — write tag back to Git
apiVersion: image.toolkit.fluxcd.io/v1beta1
kind: ImageUpdateAutomation
metadata:
  name: flux-system
  namespace: flux-system
spec:
  interval: 1m
  sourceRef:
    kind: GitRepository
    name: fleet-infra
  git:
    checkout:
      ref:
        branch: main
    commit:
      author:
        email: fluxcdbot@users.noreply.github.com
        name: fluxcdbot
      messageTemplate: |
        Automated image update

        Automation name: {{ .AutomationObject }}
        Files:
        {{ range \$filename, \$_ := .Updated.Files -}}
        - {{ \$filename }}
        {{ end -}}
        Objects:
        {{ range \$resource, \$_ := .Updated.Objects -}}
        - {{ \$resource.Kind }} {{ \$resource.Name }}
        {{ end -}}
        Images:
        {{ range .Updated.Images -}}
        - {{.}}
        {{ end -}}
    push:
      branch: main            # Push directly to main branch
  update:
    strategy: Setters         # Strategy: look for markers in YAML
    path: ./apps              # Directory where manifests are located
\`\`\`

**YAML Markers (Setters strategy):**

\`\`\`yaml
# Add a comment marker in the manifest for Flux to update
apiVersion: apps/v1
kind: Deployment
metadata:
  name: podinfo
spec:
  template:
    spec:
      containers:
        - name: podinfo
          image: ghcr.io/stefanprodan/podinfo:6.5.4  # {"$imagepolicy": "flux-system:podinfo"}
\`\`\`

> The \`# {"$imagepolicy": "flux-system:podinfo"}\` marker instructs Flux to update that field when the ImagePolicy selects a new tag.

### Notification Controller — Alerts and Notifications

Flux has a dedicated controller for sending notifications about reconciliation events to external systems (Slack, Teams, PagerDuty, GitHub, GitLab, etc.).

**Components:**
1. **Provider** — notification destination (Slack, MS Teams, GitHub, email, etc.)
2. **Alert** — rule defining WHEN and WHAT to notify
3. **Receiver** — webhook to receive external notifications and trigger reconciliation

#### Provider — Notification Destination

\`\`\`yaml
# Provider for Slack
apiVersion: notification.toolkit.fluxcd.io/v1beta3
kind: Provider
metadata:
  name: slack
  namespace: flux-system
spec:
  type: slack
  channel: k8s-alerts         # Slack channel
  secretRef:
    name: slack-webhook        # Secret with webhook URL

# The Secret must have:
# data:
#   address: <base64-encoded-slack-webhook-url>
\`\`\`

\`\`\`yaml
# Provider for Microsoft Teams
apiVersion: notification.toolkit.fluxcd.io/v1beta3
kind: Provider
metadata:
  name: msteams
  namespace: flux-system
spec:
  type: msteams
  secretRef:
    name: msteams-webhook
\`\`\`

\`\`\`yaml
# Provider for GitHub (updates commit/PR status)
apiVersion: notification.toolkit.fluxcd.io/v1beta3
kind: Provider
metadata:
  name: github-status
  namespace: flux-system
spec:
  type: github
  address: https://github.com/myorg/my-repo
  secretRef:
    name: github-token         # Secret with GitHub token (repo scope)
\`\`\`

#### Alert — Notification Rules

\`\`\`yaml
# Alert Slack on failures in any Flux resource
apiVersion: notification.toolkit.fluxcd.io/v1beta3
kind: Alert
metadata:
  name: on-call-slack
  namespace: flux-system
spec:
  providerRef:
    name: slack
  eventSeverity: error         # info | warning | error
  eventSources:
    - kind: GitRepository
      name: "*"                # All GitRepositories
    - kind: Kustomization
      name: "*"
    - kind: HelmRelease
      name: "*"
  exclusionList:
    - ".*no significant.*"     # Regex to exclude irrelevant messages
\`\`\`

\`\`\`yaml
# Alert on ALL events (info + warning + error)
apiVersion: notification.toolkit.fluxcd.io/v1beta3
kind: Alert
metadata:
  name: all-events
  namespace: flux-system
spec:
  providerRef:
    name: slack
  eventSeverity: info           # Minimum level (includes everything above)
  eventSources:
    - kind: Kustomization
      name: apps
      namespace: flux-system
\`\`\`

#### Receiver — Receive External Webhooks

\`\`\`yaml
# Receiver for GitHub webhooks — triggers immediate reconciliation on push
apiVersion: notification.toolkit.fluxcd.io/v1
kind: Receiver
metadata:
  name: github-receiver
  namespace: flux-system
spec:
  type: github
  events:
    - "ping"
    - "push"
  secretRef:
    name: webhook-token         # Secret with token to validate webhook
  resources:
    - apiVersion: source.toolkit.fluxcd.io/v1
      kind: GitRepository
      name: fleet-infra
      namespace: flux-system
\`\`\`

\`\`\`bash
# Get Receiver URL to configure in GitHub
kubectl get receiver github-receiver -n flux-system -o jsonpath='{.status.webhookPath}'
# Output: /hook/sha256:<hash>
# Full URL: http://<cluster-ip>:9292/hook/sha256:<hash>
\`\`\`

### Multi-tenancy with Flux

In organizations with multiple teams, Flux supports multi-tenancy via:
1. **Namespaced Flux** — each team has its own set of controllers
2. **RBAC per namespace** — limit team access
3. **Tenants** — isolation via dedicated ServiceAccounts and Namespaces

\`\`\`yaml
# Namespace for team team-a
apiVersion: v1
kind: Namespace
metadata:
  name: team-a
  labels:
    toolkit.fluxcd.io/tenant: team-a
---
# ServiceAccount for team-a's Flux (restricted RBAC)
apiVersion: v1
kind: ServiceAccount
metadata:
  name: flux
  namespace: team-a
---
# RoleBinding — team can only create resources in their own namespace
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: flux-tenant
  namespace: team-a
subjects:
  - kind: ServiceAccount
    name: flux
    namespace: team-a
roleRef:
  kind: ClusterRole
  name: cluster-admin           # In prod: use a more restricted custom Role
  apiGroup: rbac.authorization.k8s.io
\`\`\`

\`\`\`yaml
# Kustomization for team-a using dedicated ServiceAccount
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: team-a-apps
  namespace: flux-system
spec:
  interval: 5m
  path: ./teams/team-a
  sourceRef:
    kind: GitRepository
    name: fleet-infra
  serviceAccountName: flux       # team-a SA with limited permissions
  targetNamespace: team-a        # Force deploy to team's namespace
  prune: true
\`\`\`

### Flux Tenancy with flux-multi-tenancy

\`\`\`yaml
# Patch to restrict tenant Kustomizations to their own namespace
# (prevents team-a from accidentally deploying to team-b)
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: team-a-apps
  namespace: team-a             # Kustomization in team's namespace
spec:
  interval: 5m
  path: ./apps
  sourceRef:
    kind: GitRepository
    name: team-a-repo
  serviceAccountName: flux-reconciler
  targetNamespace: team-a
  # Prevent substitution of sensitive variables from other namespaces:
  postBuild:
    substitute: {}
\`\`\`

### Common Advanced Errors

1. **ImageUpdateAutomation without push permission** — The Git deploy key must have WRITE permission to the repository (not just read)
2. **Incorrect $imagepolicy marker** — Correct format: \`{"$imagepolicy": "namespace:policy-name"}\`
3. **Alert without events** — If eventSeverity is "error" but only "info" events occur, no alert is sent
4. **Receiver URL not accessible** — GitHub needs to access the Receiver URL; check ingress/LoadBalancer on notification-controller
5. **Tenant cross-namespace** — If the Kustomization has no targetNamespace and the SA lacks ClusterRole, it may fail when trying to create resources in other namespaces

## Killer.sh Style Challenge

> **Scenario:** Configure Flux to: (1) monitor the \`ghcr.io/myorg/api\` registry for new semver tags >= 2.0.0 and automatically update the deployment in Git; (2) send error alerts to a Slack channel; (3) create a Receiver so that GitHub pushes trigger immediate reconciliation.
`,
  quiz: [
    {
      question: 'Which three resources are needed to configure Image Automation in Flux?',
      options: [
        'ImageScan, ImageTag, ImageDeploy',
        'ImageRepository, ImagePolicy, and ImageUpdateAutomation',
        'ImageWatcher, ImageSelector, ImageUpdater',
        'ContainerRegistry, TagSelector, AutoUpdater'
      ],
      correct: 1,
      explanation: 'Image Automation uses three CRDs: ImageRepository (monitors the OCI registry for new tags), ImagePolicy (defines which tag to select via semver/alphabetical/numerical), and ImageUpdateAutomation (commits to Git with the new tag). All three work together.',
      reference: 'Related concept: The comment marker {"$imagepolicy": "namespace:name"} in YAML tells Flux which field to update.'
    },
    {
      question: 'What is the purpose of the marker # {"$imagepolicy": "flux-system:podinfo"} in a manifest?',
      options: [
        'It is a comment with no technical function',
        'It tells the ImageUpdateAutomation which image field to update when the ImagePolicy selects a new tag',
        'It configures the image pull policy',
        'It enables vulnerability scanning of the image'
      ],
      correct: 1,
      explanation: 'The $imagepolicy marker is a special comment that ImageUpdateAutomation uses to locate which field in the YAML should be updated. The format is {"$imagepolicy": "namespace:policy-name"}. When the ImagePolicy selects a new tag, Flux updates that field in the file and commits to Git.',
      reference: 'Related concept: Flux uses the "Setters" strategy to find and update these markers in the repository\'s YAML files.'
    },
    {
      question: 'What is the difference between Alert and Receiver in the Flux Notification Controller?',
      options: [
        'They are the same resource with different names',
        'Alert sends notifications to external systems (Slack, Teams); Receiver receives external webhooks to trigger reconciliation',
        'Alert is for errors; Receiver is for success events',
        'Alert is newer than Receiver in the API'
      ],
      correct: 1,
      explanation: 'Alert is output (outbound): when Flux detects an event, it sends a notification to a Provider (Slack, Teams, etc.). Receiver is input (inbound): receives external webhooks (GitHub push, Harbor scan) and triggers immediate reconciliation of Sources without waiting for the interval.',
      reference: 'Related concept: A Receiver for GitHub can reduce deploy time from minutes (interval) to seconds — immediate reconciliation on push.'
    },
    {
      question: 'How does Flux implement multi-tenancy securely?',
      options: [
        'Using a separate namespace for each controller',
        'Using dedicated ServiceAccounts per tenant with restricted RBAC, targetNamespace to force deploy to the correct namespace, and Kustomizations per tenant namespace',
        'Multi-tenancy is not supported by Flux',
        'Using NetworkPolicies to isolate tenants'
      ],
      correct: 1,
      explanation: 'Multi-tenancy in Flux combines: (1) ServiceAccount per tenant with minimal permissions; (2) spec.serviceAccountName in the Kustomization to impersonate the tenant SA; (3) spec.targetNamespace to force resources to the correct namespace; (4) RBAC limiting what the SA can do. Prevents resource leakage between teams.',
      reference: 'Related concept: flux-multi-tenancy on GitHub has examples of multi-tenancy patterns recommended by the community.'
    },
    {
      question: 'What does the field eventSeverity: info in an Alert mean?',
      options: [
        'Only info-level events are sent',
        'Events at info level or higher are sent (info + warning + error)',
        'Only error-level events are sent',
        'The eventSeverity field does not exist in Flux'
      ],
      correct: 1,
      explanation: 'eventSeverity defines the MINIMUM level of events to notify. info sends all (info, warning, error). warning sends warning and error. error sends only errors. Use error for on-call alerts. Use info for full audit/debug.',
      reference: 'Related concept: Combine an Alert with eventSeverity: error for the alerts channel and another with eventSeverity: info for an audit/debug channel.'
    },
    {
      question: 'How to configure ImageUpdateAutomation to update Git with new images?',
      options: [
        'Just create the ImagePolicy — the update is automatic',
        'Create ImageUpdateAutomation with sourceRef (GitRepository), git.commit settings (author, message), git.push (branch), and update.path (where manifests are)',
        'Configure a CronJob to periodically push',
        'Flux cannot modify the Git repository'
      ],
      correct: 1,
      explanation: 'ImageUpdateAutomation needs: sourceRef (which GitRepository to monitor), git.checkout.ref.branch (branch to checkout), git.commit.author (automatic commit identity), git.push.branch (branch to push), update.strategy: Setters and update.path (directory with $imagepolicy-marked manifests).',
      reference: 'Related concept: For production, use git.push.branch different from the main branch and create an automatic PR instead of direct push.'
    },
    {
      question: 'What type of Provider allows updating commit status in GitHub during reconciliation?',
      options: [
        'type: github-status',
        'type: github',
        'type: git',
        'type: webhook'
      ],
      correct: 1,
      explanation: 'The type: github (Provider) uses the GitHub API to update commit/PR status with the Flux reconciliation result — appears as a green/red check in the PR. Requires a GitHub token with the repo:status scope. Useful for seeing deploy status directly in the PR.',
      reference: 'Related concept: GitLab equivalent is type: gitlab, which updates pipeline status on commits.'
    }
  ],
  flashcards: [
    {
      front: 'Image Automation — complete flow',
      back: '**3 required resources:**\n\n1. **ImageRepository:**\n\`\`\`yaml\nspec:\n  image: ghcr.io/org/app\n  interval: 5m\n  secretRef:\n    name: ghcr-auth\n\`\`\`\n\n2. **ImagePolicy:**\n\`\`\`yaml\nspec:\n  imageRepositoryRef:\n    name: app\n  policy:\n    semver:\n      range: ">=1.0.0"\n\`\`\`\n\n3. **ImageUpdateAutomation:**\n\`\`\`yaml\nspec:\n  sourceRef:\n    kind: GitRepository\n    name: fleet-infra\n  git:\n    commit:\n      author:\n        name: fluxcdbot\n    push:\n      branch: main\n  update:\n    strategy: Setters\n    path: ./apps\n\`\`\`\n\n**Marker in YAML:**\n\`image: org/app:1.0.0  # {"$imagepolicy": "flux-system:app"}\`\n\n**Flow:** Registry → ImageRepo → ImagePolicy selects tag → ImageUpdateAutomation commits to Git → Flux reconciles'
    },
    {
      front: 'Notification Controller — Alert vs Receiver',
      back: '**Alert (output — outbound):**\n\`\`\`yaml\nspec:\n  providerRef:\n    name: slack          # Where to send\n  eventSeverity: error  # Minimum level\n  eventSources:\n    - kind: Kustomization\n      name: "*"          # All\n\`\`\`\n\n**Provider (destination):**\n\`\`\`yaml\nspec:\n  type: slack            # slack|msteams|github|email|webhook\n  channel: #k8s-alerts\n  secretRef:\n    name: slack-webhook\n\`\`\`\n\n**Receiver (input — inbound):**\n\`\`\`yaml\nspec:\n  type: github           # Webhook type\n  events: ["push"]\n  secretRef:\n    name: webhook-token  # Token to validate\n  resources:\n    - kind: GitRepository\n      name: fleet-infra  # What to trigger\n\`\`\`\n\n**Receiver URL:**\n`kubectl get receiver -o jsonpath=\'{.status.webhookPath}\'`'
    },
    {
      front: 'ImagePolicy — tag selection strategies',
      back: '**semver (recommended for releases):**\n\`\`\`yaml\npolicy:\n  semver:\n    range: ">=1.0.0 <2.0.0"  # Latest patch\n\`\`\`\n\n**alphabetical (for date/hash tags):**\n\`\`\`yaml\npolicy:\n  alphabetical:\n    order: asc   # or desc (alphabetically latest)\n\`\`\`\n\n**numerical (for simple numeric versions):**\n\`\`\`yaml\npolicy:\n  numerical:\n    order: asc   # Higher number = more recent\n\`\`\`\n\n**With tag filter (regex):**\n\`\`\`yaml\nspec:\n  filterTags:\n    pattern: "^main-[a-f0-9]+-(?P<ts>[0-9]+)$"\n    extract: "$ts"    # Extract and compare this group\n  policy:\n    numerical:\n      order: asc\n\`\`\`\n\n**View selected tag:**\n`kubectl get imagepolicy name -o jsonpath=\'{.status.latestImage}\'`'
    },
    {
      front: 'Multi-tenancy in Flux — isolation patterns',
      back: '**Isolation components:**\n\n1. **Namespace per tenant:**\n\`\`\`yaml\napiVersion: v1\nkind: Namespace\nmetadata:\n  name: team-a\n  labels:\n    toolkit.fluxcd.io/tenant: team-a\n\`\`\`\n\n2. **Restricted ServiceAccount:**\n\`\`\`yaml\napiVersion: v1\nkind: ServiceAccount\nmetadata:\n  name: flux-reconciler\n  namespace: team-a\n\`\`\`\n\n3. **Kustomization with SA and targetNamespace:**\n\`\`\`yaml\nspec:\n  serviceAccountName: flux-reconciler\n  targetNamespace: team-a   # Enforced!\n  sourceRef:\n    kind: GitRepository\n    name: team-a-repo\n\`\`\`\n\n**Benefits:**\n- Team A cannot access Team B resources\n- Deploy always to correct namespace\n- Clear audit trail per SA\n- Isolated failure does not affect other teams'
    },
    {
      front: 'Provider types in Notification Controller',
      back: '**Messaging:**\n- `slack` — Slack (webhook)\n- `msteams` — Microsoft Teams\n- `discord` — Discord\n- `telegram` — Telegram\n- `matrix` — Matrix\n- `rocket` — Rocket.Chat\n\n**CI/CD and Git:**\n- `github` — GitHub (commit status/checks)\n- `gitlab` — GitLab (pipeline status)\n- `gitea` — Gitea\n- `bitbucket` — Bitbucket\n\n**Alerts and Incidents:**\n- `pagerduty` — PagerDuty\n- `opsgenie` — OpsGenie\n- `datadog` — Datadog Events\n- `sentry` — Sentry\n\n**Generic:**\n- `generic` — Generic HTTP webhook\n- `generic-hmac` — Webhook with HMAC\n\n**Authentication Secret:**\nAlways secretRef with `address` (webhook URL) or token'
    },
    {
      front: 'ImageUpdateAutomation — push and commit configuration',
      back: '**Direct push to main:**\n\`\`\`yaml\ngit:\n  push:\n    branch: main\n\`\`\`\n\n**Push to separate branch (for PR):**\n\`\`\`yaml\ngit:\n  push:\n    branch: flux/image-updates  # Different branch\n    # Create PR manually or via GitHub Actions\n\`\`\`\n\n**Commit message template:**\n\`\`\`yaml\ngit:\n  commit:\n    author:\n      email: flux@org.com\n      name: FluxBot\n    messageTemplate: |\n      Auto-update images\n      {{ range .Updated.Images -}}\n      - {{.}}\n      {{ end -}}\n\`\`\`\n\n**Check status:**\n`flux get image update name`\n`kubectl get imageupdateautomation name -o yaml`\n\n**Required permission:**\nDeploy key with WRITE access to repository'
    }
  ],
  lab: {
    scenario: 'You need to configure the Flux notification system and explore Image Automation in a lab cluster.',
    objective: 'Learn to configure Providers, Alerts, Receivers and understand the Image Automation flow.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Configure notifications with Slack (simulated)',
        instruction: `Configure the Flux notification system:
1. Create a Secret with a webhook URL (can be a test URL like webhook.site)
2. Create a Provider pointing to the webhook
3. Create an Alert for error events on Kustomizations
4. Verify that the Provider and Alert were created correctly`,
        hints: [
          'The Secret must have the "address" key with the webhook URL encoded in base64',
          'To test without a real Slack, use https://webhook.site to receive webhooks',
          'The Alert eventSeverity: info triggers on any event, useful for testing'
        ],
        solution: `\`\`\`bash
# Create Secret with webhook URL (using webhook.site for testing)
kubectl create secret generic slack-webhook \\
  --from-literal=address=https://webhook.site/test-endpoint \\
  -n flux-system
\`\`\`

\`\`\`yaml
# notification-provider.yaml
apiVersion: notification.toolkit.fluxcd.io/v1beta3
kind: Provider
metadata:
  name: webhook-test
  namespace: flux-system
spec:
  type: generic             # Generic webhook for testing
  secretRef:
    name: slack-webhook
\`\`\`

\`\`\`yaml
# notification-alert.yaml
apiVersion: notification.toolkit.fluxcd.io/v1beta3
kind: Alert
metadata:
  name: flux-events
  namespace: flux-system
spec:
  providerRef:
    name: webhook-test
  eventSeverity: info       # All events for testing
  eventSources:
    - kind: Kustomization
      name: "*"
      namespace: flux-system
    - kind: GitRepository
      name: "*"
      namespace: flux-system
\`\`\`

\`\`\`bash
kubectl apply -f notification-provider.yaml
kubectl apply -f notification-alert.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verify Provider
kubectl get provider webhook-test -n flux-system
# Expected output: READY=True (or Unknown if URL doesn't exist)

kubectl describe provider webhook-test -n flux-system
# Check: Type: Ready, Status: True

# Verify Alert
kubectl get alert flux-events -n flux-system
# Expected output: READY=True

# View all notification resources
kubectl get providers,alerts,receivers -n flux-system
# Expected output: list with webhook-test and flux-events

# Trigger a reconciliation to generate an event
flux reconcile kustomization podinfo -n flux-system 2>/dev/null || true

# View notification-controller logs
kubectl logs -n flux-system -l app=notification-controller --tail=20
# Expected output: logs of events being processed
\`\`\``
      },
      {
        title: 'Configure ImageRepository and ImagePolicy',
        instruction: `Configure Image Automation to monitor a public image:
1. Create an ImageRepository to monitor ghcr.io/stefanprodan/podinfo
2. Create an ImagePolicy to select semver tags >= 5.0.0
3. Verify which tag was selected
4. Understand the $imagepolicy marker that would be used in the manifest`,
        hints: [
          'ghcr.io/stefanprodan/podinfo is a public image — no secretRef needed',
          'The ImageRepository status shows how many tags were found',
          'The ImagePolicy shows the selected latestImage in status'
        ],
        solution: `\`\`\`yaml
# image-repository.yaml
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImageRepository
metadata:
  name: podinfo
  namespace: flux-system
spec:
  image: ghcr.io/stefanprodan/podinfo
  interval: 5m
  # No secretRef since it's a public image
\`\`\`

\`\`\`yaml
# image-policy.yaml
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImagePolicy
metadata:
  name: podinfo
  namespace: flux-system
spec:
  imageRepositoryRef:
    name: podinfo
  policy:
    semver:
      range: ">=5.0.0"        # Latest version >= 5.0.0
\`\`\`

\`\`\`bash
kubectl apply -f image-repository.yaml
kubectl apply -f image-policy.yaml

# Wait for synchronization (a few minutes)
echo "Waiting for registry scan..."
sleep 30
\`\`\`

\`\`\`bash
# View the tag that would be used in the marker (for reference):
# image: ghcr.io/stefanprodan/podinfo:X.Y.Z  # {"$imagepolicy": "flux-system:podinfo"}
echo 'Marker that would be used in YAML:'
echo '# {"$imagepolicy": "flux-system:podinfo"}'
\`\`\``,
        verify: `\`\`\`bash
# Verify ImageRepository
kubectl get imagerepository podinfo -n flux-system
# Expected output: READY=True, with number of tags found

# View scan details
kubectl describe imagerepository podinfo -n flux-system | grep -A5 "Status:"
# Expected output: LastScanResult with number of tags

# Verify ImagePolicy and which tag was selected
kubectl get imagepolicy podinfo -n flux-system
# Expected output: READY=True and LATESTIMAGE with selected tag

# View the latest tag selected by the policy
kubectl get imagepolicy podinfo -n flux-system -o jsonpath='{.status.latestImage}'
# Expected output: ghcr.io/stefanprodan/podinfo:X.Y.Z (latest version >= 5.0.0)

# View all found tags (may be many)
kubectl get imagerepository podinfo -n flux-system -o yaml | grep -A3 "lastScanResult"
\`\`\``
      },
      {
        title: 'Configure Receiver for GitHub webhooks',
        instruction: `Configure a Receiver to receive GitHub webhooks:
1. Create a Secret with a token to validate the webhook
2. Create the github type Receiver
3. Get the webhook URL to configure in GitHub
4. Understand how the Receiver triggers immediate reconciliation`,
        hints: [
          'The token in the Secret is used to validate the GitHub webhook HMAC signature',
          'The webhook URL is in status.webhookPath of the Receiver',
          'The notification-controller needs a Service/Ingress to be externally accessible'
        ],
        solution: `\`\`\`bash
# Generate random token to validate webhooks
TOKEN=\$(head -c 12 /dev/urandom | shasum | cut -d ' ' -f1)
echo "Generated token: \$TOKEN"

# Create Secret with the token
kubectl create secret generic github-webhook-token \\
  --from-literal=token=\$TOKEN \\
  -n flux-system
\`\`\`

\`\`\`yaml
# receiver.yaml
apiVersion: notification.toolkit.fluxcd.io/v1
kind: Receiver
metadata:
  name: github-receiver
  namespace: flux-system
spec:
  type: github
  events:
    - "ping"
    - "push"
  secretRef:
    name: github-webhook-token
  resources:
    - apiVersion: source.toolkit.fluxcd.io/v1
      kind: GitRepository
      name: podinfo            # GitRepository to trigger
      namespace: flux-system
\`\`\`

\`\`\`bash
kubectl apply -f receiver.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verify Receiver created
kubectl get receiver github-receiver -n flux-system
# Expected output: READY=True

# View webhook URL (to configure in GitHub)
WEBHOOK_PATH=\$(kubectl get receiver github-receiver -n flux-system \\
  -o jsonpath='{.status.webhookPath}')
echo "Webhook path: \$WEBHOOK_PATH"
# Expected output: /hook/sha256:<hash>

# View full URL that GitHub would use
echo "To configure in GitHub:"
echo "URL: http://<cluster-ip>:9292\$WEBHOOK_PATH"

# Verify all receivers
kubectl get receivers -n flux-system
# Expected output: github-receiver READY=True

# View notification-controller logs
kubectl logs -n flux-system -l app=notification-controller --tail=10
# Expected output: logs indicating receiver configured

# View receiver details
kubectl describe receiver github-receiver -n flux-system
# Expected output: Status with available webhookPath
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'ImageUpdateAutomation not committing — push permission denied',
      difficulty: 'medium',
      symptom: 'The ImageUpdateAutomation detects new images and ImagePolicy selects updated tags, but no commits are made to the Git repository. Status shows authentication or permission error.',
      diagnosis: `\`\`\`bash
# 1. Check ImageUpdateAutomation status
kubectl get imageupdateautomation -n flux-system
kubectl describe imageupdateautomation flux-system -n flux-system | grep -A10 "Status:"

# 2. View image-automation-controller logs
kubectl logs -n flux-system -l app=image-automation-controller --tail=30

# 3. Check if GitRepository has write permission
kubectl get gitrepository fleet-infra -n flux-system -o yaml | grep -A5 "secretRef:"

# 4. Check the Git authentication Secret
kubectl get secret <secret-name> -n flux-system -o yaml

# 5. Check if the push branch exists
kubectl get imageupdateautomation -n flux-system -o yaml | grep -A3 "push:"
\`\`\``,
      solution: `**Causes and solutions:**

1. **Deploy key without write permission:** The SSH key used by the GitRepository must have PUSH/WRITE permission to the repository. In GitHub, go to Settings > Deploy Keys and enable "Allow write access".

2. **Token with insufficient scope:** For HTTPS repositories, the Personal Access Token must have the \`repo\` scope (not just \`repo:read\`).

3. **Push branch doesn't exist:** If spec.git.push.branch specifies a branch that doesn't exist, the push fails. Create the branch first or use an existing branch.

4. **GitRepository is read-only:** Check if the same Secret is used for read and write — create a separate Secret with a write key if necessary.

5. **Confirm image-automation-controller is installed:**
\`\`\`bash
flux check
# Check: image-automation-controller: deployment ready
kubectl get deploy -n flux-system | grep image-automation
\`\`\``
    },
    {
      title: 'Alert not sending notifications to Slack — webhook returns 4xx',
      difficulty: 'easy',
      symptom: 'Flux events are being generated correctly, but no messages are received in the Slack channel. Notification-controller logs show HTTP 4xx errors.',
      diagnosis: `\`\`\`bash
# 1. Check Provider status
kubectl get provider slack -n flux-system
kubectl describe provider slack -n flux-system | grep -A5 "Status:"

# 2. View notification-controller logs with detail
kubectl logs -n flux-system -l app=notification-controller --tail=50 | grep -i "slack\\|error\\|webhook"

# 3. Check the Secret with the webhook URL
kubectl get secret slack-webhook -n flux-system -o jsonpath='{.data.address}' | base64 -d
# Verify the URL is correct

# 4. Check the Alert
kubectl get alert -n flux-system
kubectl describe alert on-call-slack -n flux-system

# 5. Test the webhook URL manually
WEBHOOK_URL=\$(kubectl get secret slack-webhook -n flux-system -o jsonpath='{.data.address}' | base64 -d)
curl -X POST -H 'Content-type: application/json' \\
  --data '{"text":"Flux test"}' "\$WEBHOOK_URL"
\`\`\``,
      solution: `**Causes and solutions:**

1. **Expired webhook URL:** Slack webhooks expire or get revoked. Generate a new webhook at api.slack.com/apps and update the Secret:
\`\`\`bash
kubectl create secret generic slack-webhook \\
  --from-literal=address=<new-url> \\
  -n flux-system --dry-run=client -o yaml | kubectl apply -f -
\`\`\`

2. **Wrong format in Secret:** The field must be \`address\`, not \`url\` or \`webhook\`. Check the exact key in the Secret.

3. **Channel doesn't exist or bot without access:** If the Provider has spec.channel, verify the channel exists and the Slack app has permission to post in it.

4. **exclusionList filtering all events:** If the exclusionList has a too-broad regex, all events may be filtered. Temporarily remove or adjust the exclusionList for debugging.

5. **eventSources too restrictive:** Check that the Alert has the correct eventSources (kind and name of the resource generating events).`
    }
  ]
};
