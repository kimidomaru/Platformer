window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['app-deployment/deployment-strategies'] = {
  theory: `# Deployment Strategies

## Exam Relevance
> Deployment strategies are core to the CKAD exam (application design) and also appear in CKA (cluster management). You must understand RollingUpdate vs Recreate, how to implement Blue/Green and Canary using Kubernetes primitives (Services + Deployments), and how to perform controlled rollbacks.

## Built-in Kubernetes Strategies

### RollingUpdate (Default)

Gradually replaces old pods with new ones. Zero downtime when configured correctly.

\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 4
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1    # Max pods that can be down during update
      maxSurge: 1          # Max extra pods created during update
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: app
        image: myapp:v2
\`\`\`

**maxUnavailable**: can be absolute (1) or percentage (25%). At most this many pods can be unavailable during the update.

**maxSurge**: can be absolute (1) or percentage (25%). At most this many extra pods can be created above the desired count.

### Recreate

Terminates ALL old pods before creating new ones. **Causes downtime.**

\`\`\`yaml
spec:
  strategy:
    type: Recreate
\`\`\`

Use when: the old and new versions **cannot run simultaneously** (e.g., incompatible database schema changes).

## Rolling Update Commands

\`\`\`bash
# Trigger an update by changing the image
kubectl set image deployment/myapp app=myapp:v2

# Monitor the rollout
kubectl rollout status deployment/myapp

# Check rollout history
kubectl rollout history deployment/myapp
kubectl rollout history deployment/myapp --revision=2

# Roll back to previous version
kubectl rollout undo deployment/myapp

# Roll back to a specific revision
kubectl rollout undo deployment/myapp --to-revision=1

# Pause a rollout (for incremental canary-like control)
kubectl rollout pause deployment/myapp

# Resume a paused rollout
kubectl rollout resume deployment/myapp
\`\`\`

## Blue/Green Deployment

Two identical environments (Blue = current, Green = new). Switch traffic instantaneously by updating the Service selector.

\`\`\`yaml
# Blue Deployment (current production)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-blue
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
      version: blue
  template:
    metadata:
      labels:
        app: myapp
        version: blue
    spec:
      containers:
      - name: app
        image: myapp:v1
---
# Green Deployment (new version — deploy but not yet live)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-green
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
      version: green
  template:
    metadata:
      labels:
        app: myapp
        version: green
    spec:
      containers:
      - name: app
        image: myapp:v2
---
# Service — currently points to Blue
apiVersion: v1
kind: Service
metadata:
  name: myapp-svc
spec:
  selector:
    app: myapp
    version: blue    # ← Switch to "green" to flip traffic
  ports:
  - port: 80
    targetPort: 8080
\`\`\`

\`\`\`bash
# Switch traffic from blue to green (instant)
kubectl patch svc myapp-svc -p '{"spec":{"selector":{"version":"green"}}}'

# If issues arise, roll back instantly to blue
kubectl patch svc myapp-svc -p '{"spec":{"selector":{"version":"blue"}}}'

# After successful switch, delete blue deployment
kubectl delete deployment myapp-blue
\`\`\`

**Advantages**: instant rollback, full testing in production-like environment.
**Disadvantages**: 2x resource cost during transition.

## Canary Deployment

Route a small percentage of traffic to the new version while most users still hit the old version.

\`\`\`yaml
# Stable deployment (90% of traffic if using 9 replicas)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-stable
spec:
  replicas: 9              # 9 pods → 90% of traffic
  selector:
    matchLabels:
      app: myapp
      track: stable
  template:
    metadata:
      labels:
        app: myapp
        track: stable
    spec:
      containers:
      - name: app
        image: myapp:v1
---
# Canary deployment (10% of traffic with 1 replica)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-canary
spec:
  replicas: 1              # 1 pod → ~10% of traffic
  selector:
    matchLabels:
      app: myapp
      track: canary
  template:
    metadata:
      labels:
        app: myapp
        track: canary
    spec:
      containers:
      - name: app
        image: myapp:v2
---
# Single Service selects BOTH deployments via shared label
apiVersion: v1
kind: Service
metadata:
  name: myapp-svc
spec:
  selector:
    app: myapp             # Matches BOTH stable and canary pods
  ports:
  - port: 80
    targetPort: 8080
\`\`\`

\`\`\`bash
# Scale up canary (more traffic to new version)
kubectl scale deployment myapp-canary --replicas=3   # Now 3/12 = 25%

# Full rollout: scale stable to new image, delete canary
kubectl set image deployment/myapp-stable app=myapp:v2
kubectl delete deployment myapp-canary

# Rollback: just delete the canary
kubectl delete deployment myapp-canary
\`\`\`

**Advantages**: gradual rollout, low risk, real production traffic testing.
**Disadvantages**: both versions must handle same requests (session affinity issues).

## Strategy Comparison

| Strategy | Downtime | Rollback Speed | Resource Cost | Use Case |
|----------|----------|----------------|---------------|----------|
| Recreate | Yes | Fast | 1x | Dev/test, incompatible versions |
| RollingUpdate | No | Minutes | ~1.25x | Standard production update |
| Blue/Green | No | Instant | 2x | Critical zero-downtime deploys |
| Canary | No | Instant | ~1.1x | Risk-averse gradual rollout |

## Maintaining Rollout History

\`\`\`bash
# Add CHANGE-CAUSE annotation for better history
kubectl set image deployment/myapp app=myapp:v2 --record    # Deprecated but still works
# OR:
kubectl annotate deployment/myapp kubernetes.io/change-cause="Update to v2 with new feature X"

# View history with annotations
kubectl rollout history deployment/myapp
# REVISION  CHANGE-CAUSE
# 1         Initial deployment
# 2         Update to v2 with new feature X

# Increase history limit
kubectl patch deployment myapp -p '{"spec":{"revisionHistoryLimit":10}}'
\`\`\`

## Common Errors

1. **maxUnavailable=0 + maxSurge=0** — invalid, cannot do rolling update (Kubernetes rejects this)
2. **Forgetting to update the Service selector** in Blue/Green — traffic still goes to old version
3. **Canary selector too broad** — Service selects canary with wrong labels, uneven traffic
4. **Rollout stuck** — new pods can't start (image pull error, resource limits) — use kubectl rollout status and kubectl describe pod
5. **Forgetting --record** — rollout history shows \`<none>\` for CHANGE-CAUSE

## Killer.sh Style Challenge

**Task**: Deploy myapp:v1 with 4 replicas. Implement a canary deployment where 25% of traffic goes to myapp:v2. Verify both versions are receiving traffic via the same Service, then do a full cutover.
`,
  quiz: [
    {
      question: 'What is the key difference between RollingUpdate and Recreate strategies?',
      options: [
        'RollingUpdate requires a Service; Recreate does not',
        'RollingUpdate gradually replaces pods with zero downtime; Recreate terminates all pods before starting new ones (causes downtime)',
        'RollingUpdate only works with StatefulSets; Recreate works with Deployments',
        'They are identical — just different names for the same behavior'
      ],
      correct: 1,
      explanation: 'RollingUpdate replaces pods gradually, maintaining availability throughout. Recreate terminates ALL pods first (downtime), then creates new pods. Use Recreate when old and new versions cannot coexist.',
      reference: 'Built-in Kubernetes Strategies section in theory.'
    },
    {
      question: 'In a Blue/Green deployment, how do you instantly switch 100% of traffic to the new version?',
      options: [
        'kubectl rollout restart deployment/myapp-green',
        'kubectl scale deployment/myapp-blue --replicas=0',
        'kubectl patch svc myapp-svc -p \'{"spec":{"selector":{"version":"green"}}}\'',
        'kubectl set image deployment/myapp-blue app=myapp:v2'
      ],
      correct: 2,
      explanation: 'Blue/Green uses a Service selector switch. Patching the Service selector to "version: green" instantly redirects all traffic. This is the defining advantage of Blue/Green — instant, atomic traffic switch.',
      reference: 'Blue/Green Deployment section — kubectl patch svc to switch selector.'
    },
    {
      question: 'You have a stable deployment with 8 replicas and a canary with 2 replicas, both selected by the same Service. What percentage of traffic does the canary receive?',
      options: [
        '10%',
        '20%',
        '25%',
        '50%'
      ],
      correct: 1,
      explanation: 'The Service distributes requests roughly evenly across all matching pods. Total pods: 8 + 2 = 10. Canary gets 2/10 = 20% of traffic. This is how replica ratio controls Canary traffic percentage.',
      reference: 'Canary Deployment section — replica ratio controls traffic split (1/10 = 10%, etc.)'
    },
    {
      question: 'What happens when both maxUnavailable and maxSurge are set to 0?',
      options: [
        'The update proceeds one pod at a time',
        'The Deployment freezes and waits for manual approval',
        'Kubernetes rejects this configuration as invalid',
        'All pods are updated simultaneously'
      ],
      correct: 2,
      explanation: 'Setting both maxUnavailable=0 and maxSurge=0 is invalid. If you cannot remove any pods (maxUnavailable=0) and cannot add any extra (maxSurge=0), there is no way to perform the update. Kubernetes rejects this configuration.',
      reference: 'Common Errors #1 in theory.'
    },
    {
      question: 'How do you roll back a Deployment to revision 2 specifically?',
      options: [
        'kubectl rollout undo deployment/myapp',
        'kubectl rollout undo deployment/myapp --to-revision=2',
        'kubectl rollout history deployment/myapp --revision=2 --apply',
        'kubectl set image deployment/myapp app=<previous-image>'
      ],
      correct: 1,
      explanation: '"kubectl rollout undo --to-revision=N" rolls back to a specific revision. Without --to-revision, undo goes to the previous revision. Use "kubectl rollout history" first to find the desired revision number.',
      reference: 'Rolling Update Commands section in theory.'
    },
    {
      question: 'What is the main disadvantage of Blue/Green deployments?',
      options: [
        'Cannot roll back once traffic is switched',
        'Requires twice the resources (2 full production environments simultaneously)',
        'Only works with StatefulSets',
        'Causes a brief downtime during the traffic switch'
      ],
      correct: 1,
      explanation: 'Blue/Green requires maintaining two complete production-sized environments simultaneously. This doubles resource costs during the transition period. After confirming the green deployment is healthy, the blue deployment can be deleted.',
      reference: 'Strategy Comparison table — Blue/Green Resource Cost = 2x.'
    },
    {
      question: 'Which kubectl command pauses a rolling update mid-way for manual verification?',
      options: [
        'kubectl rollout stop deployment/myapp',
        'kubectl rollout pause deployment/myapp',
        'kubectl rollout hold deployment/myapp',
        'kubectl scale deployment/myapp --replicas=0'
      ],
      correct: 1,
      explanation: '"kubectl rollout pause" stops the rolling update at its current state. Some pods will be running the new version, others the old. Use "kubectl rollout resume" to continue. This allows manual canary-like validation.',
      reference: 'Rolling Update Commands section in theory.'
    },
    {
      question: 'In a Canary deployment, what label does the Service use to route traffic to BOTH stable and canary pods?',
      options: [
        'A wildcard selector that matches all pods in the namespace',
        'A shared label present in BOTH deployments (e.g., app: myapp)',
        'No label — the Service selects all pods automatically',
        'The canary: true label on the canary deployment'
      ],
      correct: 1,
      explanation: 'The Service selector uses a shared label (e.g., app: myapp) that both the stable and canary deployments include. Additional labels (track: stable, track: canary) differentiate the deployments but are NOT part of the Service selector.',
      reference: 'Canary Deployment section — Service selector: app: myapp (shared label, no track filter).'
    }
  ],
  flashcards: [
    {
      front: 'What are the 4 main deployment strategies and when do you use each?',
      back: '1. Recreate — all pods down before new start. Use for incompatible versions. Has downtime.\n2. RollingUpdate — gradual replacement. Zero downtime. Default strategy.\n3. Blue/Green — two full environments, instant traffic switch. 2x resources.\n4. Canary — small % traffic to new version. Gradual risk reduction. Adjust by scaling replicas.'
    },
    {
      front: 'What do maxUnavailable and maxSurge control in RollingUpdate?',
      back: 'maxUnavailable: max number of pods that can be unavailable during update. Set to 0 for zero-downtime updates.\n\nmaxSurge: max extra pods that can be created above desired count during update.\n\nBoth cannot be 0 simultaneously (Kubernetes rejects this). Default: both 25%.'
    },
    {
      front: 'How does Blue/Green achieve instant rollback?',
      back: 'By keeping both environments running simultaneously. Rollback is just a Service selector patch:\nkubectl patch svc myapp-svc -p \'{"spec":{"selector":{"version":"blue"}}}\'\n\nThis atomically switches 100% of traffic back to the blue (old) deployment in milliseconds. No new pod creation needed.'
    },
    {
      front: 'How do you control Canary traffic percentage in vanilla Kubernetes?',
      back: 'By adjusting replica counts. The Service distributes traffic roughly equally across all matching pods.\n\nExample: stable=9 replicas, canary=1 replica → canary gets 10% of traffic\nTo increase to 25%: scale canary to 3, stable to 9 → 3/(3+9) = 25%\n\nThis is a coarse control — use an Ingress controller for precise % splitting.'
    },
    {
      front: 'How do you roll back a deployment to a specific revision?',
      back: '# View history first\nkubectl rollout history deployment/myapp\n\n# Roll back to specific revision\nkubectl rollout undo deployment/myapp --to-revision=2\n\n# Roll back to previous revision (no --to-revision)\nkubectl rollout undo deployment/myapp\n\nNote: revisions are only kept up to revisionHistoryLimit (default: 10).'
    },
    {
      front: 'What is the difference between pausing and stopping a rollout?',
      back: 'kubectl rollout pause deployment/myapp — stops the rollout at its current state. Partially updated: some pods run new version, others old. Use for manual canary-like validation.\n\nkubectl rollout resume deployment/myapp — continues the paused rollout.\n\nThere is no "rollout stop" command. To abort: kubectl rollout undo.'
    },
    {
      front: 'What does the --record flag do in kubectl set image?',
      back: 'Records the command in the deployment rollout history as the CHANGE-CAUSE annotation. Helps identify what changed and when.\n\nDeprecated but still functional. Preferred alternative:\nkubectl annotate deployment/myapp kubernetes.io/change-cause="Update to v2"\n\nWithout this, rollout history shows <none> for CHANGE-CAUSE.'
    },
    {
      front: 'What Service label selector enables Canary in Kubernetes?',
      back: 'A shared label present in BOTH stable and canary deployments:\n\nService selector: { app: myapp }  ← selects both\nStable pod labels: { app: myapp, track: stable }\nCanary pod labels: { app: myapp, track: canary }\n\nThe Service does NOT filter by track — it matches all pods with app: myapp.'
    }
  ],
  lab: {
    scenario: 'You are managing a critical application and need to practice different deployment strategies to ensure zero-downtime updates and safe rollouts.',
    objective: 'Implement RollingUpdate with tuned parameters, then implement a Blue/Green deployment and practice instant traffic switching.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Configure and Perform a RollingUpdate',
        instruction: `Create a Deployment named \`webapp\` with these specifications:
- Image: \`nginx:1.24\`
- Replicas: 4
- Strategy: RollingUpdate with maxUnavailable=0 and maxSurge=1 (zero-downtime update)
- Add a change-cause annotation

Then update the image to \`nginx:1.25\` and watch the rolling update proceed. Check rollout history and perform a rollback.`,
        hints: [
          'Set strategy in spec.strategy.rollingUpdate: maxUnavailable: 0, maxSurge: 1',
          'kubectl rollout status deployment/webapp to watch progress',
          'kubectl rollout history deployment/webapp to see revisions',
          'kubectl rollout undo deployment/webapp to roll back'
        ],
        solution: `\`\`\`bash
# Create deployment with configured RollingUpdate strategy
cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: webapp
  annotations:
    kubernetes.io/change-cause: "Initial deployment nginx:1.24"
spec:
  replicas: 4
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1
  selector:
    matchLabels:
      app: webapp
  template:
    metadata:
      labels:
        app: webapp
    spec:
      containers:
      - name: nginx
        image: nginx:1.24
EOF

kubectl rollout status deployment/webapp

# Update image and annotate
kubectl set image deployment/webapp nginx=nginx:1.25
kubectl annotate deployment/webapp kubernetes.io/change-cause="Update to nginx:1.25" --overwrite

# Watch the rolling update
kubectl rollout status deployment/webapp

# View history
kubectl rollout history deployment/webapp

# Roll back
kubectl rollout undo deployment/webapp
kubectl rollout status deployment/webapp
\`\`\``,
        verify: `\`\`\`bash
# Check current image after rollback (should be nginx:1.24)
kubectl get deployment webapp -o jsonpath='{.spec.template.spec.containers[0].image}'
# Expected: nginx:1.24

# All replicas should be available
kubectl get deployment webapp
# Expected: READY = 4/4

# History should show 2 revisions
kubectl rollout history deployment/webapp
# Expected: at least 2 revisions (revision 2 rolled back to revision 1)
\`\`\``
      },
      {
        title: 'Implement Blue/Green Deployment',
        instruction: `Implement a Blue/Green deployment pattern:

1. Create Blue deployment: \`webapp-blue\` with \`nginx:1.24\`, label \`version: blue\`
2. Create a Service \`webapp-svc\` that selects \`version: blue\`
3. Create Green deployment: \`webapp-green\` with \`nginx:1.25\`, label \`version: green\`
4. Verify Green is healthy, then switch the Service to Green
5. Practice rolling back to Blue`,
        hints: [
          'Both deployments need labels: app: webapp AND version: blue/green',
          'Service selector should initially be: {app: webapp, version: blue}',
          'Switch: kubectl patch svc webapp-svc -p \'{"spec":{"selector":{"version":"green"}}}\'',
          'Rollback: same patch but with "blue"'
        ],
        solution: `\`\`\`bash
# Create Blue deployment
cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: webapp-blue
spec:
  replicas: 3
  selector:
    matchLabels:
      app: webapp
      version: blue
  template:
    metadata:
      labels:
        app: webapp
        version: blue
    spec:
      containers:
      - name: nginx
        image: nginx:1.24
---
apiVersion: v1
kind: Service
metadata:
  name: webapp-svc
spec:
  selector:
    app: webapp
    version: blue
  ports:
  - port: 80
    targetPort: 80
EOF

# Verify Blue is serving
kubectl get endpoints webapp-svc

# Deploy Green (new version — not yet live)
cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: webapp-green
spec:
  replicas: 3
  selector:
    matchLabels:
      app: webapp
      version: green
  template:
    metadata:
      labels:
        app: webapp
        version: green
    spec:
      containers:
      - name: nginx
        image: nginx:1.25
EOF

kubectl rollout status deployment/webapp-green

# Switch traffic to Green (instant)
kubectl patch svc webapp-svc -p '{"spec":{"selector":{"version":"green"}}}'

# Verify Green is now serving
kubectl get endpoints webapp-svc

# Practice rollback to Blue
kubectl patch svc webapp-svc -p '{"spec":{"selector":{"version":"blue"}}}'
kubectl get endpoints webapp-svc
\`\`\``,
        verify: `\`\`\`bash
# After switching to green, endpoints should show green pod IPs
kubectl get endpoints webapp-svc

# Verify service selector
kubectl get svc webapp-svc -o jsonpath='{.spec.selector}'
# Expected: {"app":"webapp","version":"green"} (or "blue" after rollback)

# Both deployments should be Ready
kubectl get deployment webapp-blue webapp-green
# Expected: both show 3/3 READY

# Test the rollback: after setting back to blue
kubectl patch svc webapp-svc -p '{"spec":{"selector":{"version":"blue"}}}'
kubectl get endpoints webapp-svc
# Expected: endpoints now show Blue pod IPs (different from Green pod IPs)
\`\`\``
      },
      {
        title: 'Canary Deployment with Traffic Split',
        instruction: `Implement a Canary deployment:

1. Create \`webapp-stable\` with \`nginx:1.24\`, 4 replicas, label \`track: stable\`
2. Create Service \`webapp-svc\` that selects only \`app: webapp\` (shared label)
3. Create \`webapp-canary\` with \`nginx:1.25\`, 1 replica, label \`track: canary\`
4. Verify ~20% traffic goes to canary (1 pod out of 5 total)
5. Increase canary to 2 replicas (33% traffic)
6. Perform full cutover`,
        hints: [
          'Service selector: {app: webapp} — no track label, so it selects BOTH deployments',
          'Traffic split = canary replicas / (stable + canary replicas)',
          'Scale canary: kubectl scale deployment webapp-canary --replicas=2',
          'Full cutover: scale stable to new image, delete canary'
        ],
        solution: `\`\`\`bash
# Stable deployment (4 replicas)
cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: webapp-stable
spec:
  replicas: 4
  selector:
    matchLabels:
      app: webapp
      track: stable
  template:
    metadata:
      labels:
        app: webapp
        track: stable
    spec:
      containers:
      - name: nginx
        image: nginx:1.24
---
apiVersion: v1
kind: Service
metadata:
  name: webapp-svc
spec:
  selector:
    app: webapp      # No track filter — selects both
  ports:
  - port: 80
    targetPort: 80
EOF

# Canary deployment (1 replica = 1/(4+1) = 20%)
cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: webapp-canary
spec:
  replicas: 1
  selector:
    matchLabels:
      app: webapp
      track: canary
  template:
    metadata:
      labels:
        app: webapp
        track: canary
    spec:
      containers:
      - name: nginx
        image: nginx:1.25
EOF

# Verify 5 endpoints (4 stable + 1 canary)
kubectl get endpoints webapp-svc

# Scale canary to 33% traffic
kubectl scale deployment webapp-canary --replicas=2
# Now: 2/(4+2) = 33%

kubectl get endpoints webapp-svc

# Full cutover: update stable, delete canary
kubectl set image deployment/webapp-stable nginx=nginx:1.25
kubectl rollout status deployment/webapp-stable
kubectl delete deployment webapp-canary

kubectl get endpoints webapp-svc
\`\`\``,
        verify: `\`\`\`bash
# After initial canary setup: 5 endpoints total
kubectl get endpoints webapp-svc
# Expected: 5 IP addresses (4 stable + 1 canary)

# After scaling canary to 2: 6 endpoints
kubectl scale deployment webapp-canary --replicas=2 2>/dev/null || true
kubectl get endpoints webapp-svc
# Expected: 6 IP addresses

# After full cutover: stable updated, canary gone
kubectl set image deployment/webapp-stable nginx=nginx:1.25 2>/dev/null || true
kubectl delete deployment webapp-canary 2>/dev/null || true
kubectl get deployment
# Expected: only webapp-stable exists

# Final image should be nginx:1.25
kubectl get deployment webapp-stable -o jsonpath='{.spec.template.spec.containers[0].image}'
# Expected: nginx:1.25
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Rolling Update Stuck — Deployment Not Progressing',
      difficulty: 'medium',
      symptom: 'kubectl rollout status shows "Waiting for deployment rollout to finish: 1 out of 4 new replicas have been updated" and the rollout never completes. New pods stay in Pending or CrashLoopBackOff.',
      diagnosis: `\`\`\`bash
# Check rollout status
kubectl rollout status deployment/myapp
# Shows stuck/partial progress

# Check pod status — look for issues
kubectl get pods -l app=myapp
# New pods may show: Pending, ImagePullBackOff, CrashLoopBackOff

# Describe the failing new pod
kubectl describe pod <new-pod-name>
# Events section shows the cause

# Check pod logs (if CrashLoopBackOff)
kubectl logs <new-pod-name> --previous

# Check available resources on nodes
kubectl describe nodes | grep -A10 "Allocated resources"
\`\`\``,
      solution: `**Cause A: Image pull error (wrong tag or private registry)**
\`\`\`bash
kubectl describe pod <new-pod> | grep -A5 Events
# Shows: Failed to pull image "myapp:v3": not found

# Fix: correct the image tag
kubectl set image deployment/myapp app=myapp:v2
kubectl rollout status deployment/myapp
\`\`\`

**Cause B: Insufficient resources (Pending pods)**
\`\`\`bash
kubectl describe pod <pending-pod> | grep -A3 "Events:"
# Shows: Insufficient cpu or Insufficient memory

# Fix: reduce resource requests or add more nodes
kubectl set resources deployment/myapp -c app --requests=cpu=100m,memory=128Mi
\`\`\`

**Cause C: CrashLoopBackOff (app startup error)**
\`\`\`bash
kubectl logs <new-pod> --previous
# Shows application error — fix the app or revert the update

# Revert update
kubectl rollout undo deployment/myapp
kubectl rollout status deployment/myapp
\`\`\``
    },
    {
      title: 'Blue/Green Switch Did Not Take Effect — Old Pods Still Serving',
      difficulty: 'easy',
      symptom: 'After patching the Service selector to point to "green", traffic still appears to go to the old (blue) pods. The application behavior has not changed.',
      diagnosis: `\`\`\`bash
# Verify the Service selector was actually updated
kubectl get svc myapp-svc -o yaml | grep -A5 selector
# Check if "version: green" is shown

# Check endpoints — which pod IPs are listed?
kubectl get endpoints myapp-svc
# Compare IPs with actual pod IPs

# Check pod IPs for blue and green deployments
kubectl get pods -l version=blue -o wide
kubectl get pods -l version=green -o wide

# Verify green pods are Ready
kubectl get pods -l version=green
# READY must show 1/1 or N/N
\`\`\``,
      solution: `**Cause A: Patch command had wrong selector key**
\`\`\`bash
# Wrong: patching only "version" key when service also has "app" key
kubectl patch svc myapp-svc -p '{"spec":{"selector":{"version":"green"}}}'
# This REPLACES the entire selector with just {version: green}
# If pods have {app: myapp, version: green}, they won't match

# Better: include all selector keys
kubectl patch svc myapp-svc -p '{"spec":{"selector":{"app":"myapp","version":"green"}}}'

# Verify
kubectl describe svc myapp-svc | grep -A3 Selector
\`\`\`

**Cause B: Green pods are not Ready**
\`\`\`bash
kubectl get pods -l version=green
# READY shows 0/1 — readiness probe failing

# Kubernetes excludes not-Ready pods from endpoints
kubectl get endpoints myapp-svc
# May show blue pod IPs if green isn't Ready

# Fix green readiness issue first
kubectl describe pod <green-pod> | grep -A5 Readiness
# Fix the probe or the health endpoint
\`\`\``
    }
  ]
};
