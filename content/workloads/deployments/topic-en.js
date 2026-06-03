window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['workloads/deployments'] = {
  theory: `
# Deployments & Rolling Updates

## Exam Relevance
> Deployments are core to the CKA (Workloads & Scheduling — 15%) and CKAD (Application Deployment — 20%) exams. Expect questions on scaling, rollouts, rollbacks, update strategies, and debugging failed deployments.

## Core Concepts

A **Deployment** is a higher-level controller that manages a **ReplicaSet**, which in turn manages **Pods**. The key responsibility of a Deployment is to:
- Maintain a desired number of Pod replicas
- Perform **rolling updates** to deliver new versions with zero downtime
- Allow **rollbacks** to previous revisions

### Deployment → ReplicaSet → Pod Hierarchy

\`\`\`
Deployment
  └── ReplicaSet (current)
        ├── Pod
        ├── Pod
        └── Pod
  └── ReplicaSet (previous, scaled to 0 after successful rollout)
\`\`\`

### Rollout Strategy: RollingUpdate (default)

\`\`\`yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxUnavailable: 1    # max pods that can be unavailable during update
    maxSurge: 1          # max extra pods above desired count
\`\`\`

- **maxUnavailable**: keeps availability during update
- **maxSurge**: controls speed of update

### Rollout Strategy: Recreate

\`\`\`yaml
strategy:
  type: Recreate   # Terminates ALL old pods before creating new ones
\`\`\`

Use for apps that cannot run two versions simultaneously (e.g., database migrations).

## Essential Commands

\`\`\`bash
# Create a deployment
kubectl create deployment nginx --image=nginx:1.24 --replicas=3

# Scale
kubectl scale deployment nginx --replicas=5

# Update image (triggers rolling update)
kubectl set image deployment/nginx nginx=nginx:1.25

# Watch rollout status
kubectl rollout status deployment/nginx

# View rollout history
kubectl rollout history deployment/nginx

# View specific revision
kubectl rollout history deployment/nginx --revision=2

# Rollback to previous version
kubectl rollout undo deployment/nginx

# Rollback to specific revision
kubectl rollout undo deployment/nginx --to-revision=2

# Pause rollout (useful to batch changes)
kubectl rollout pause deployment/nginx

# Resume paused rollout
kubectl rollout resume deployment/nginx

# Restart all pods (rolling restart)
kubectl rollout restart deployment/nginx

# Dry-run: generate YAML
kubectl create deployment nginx --image=nginx --dry-run=client -o yaml
\`\`\`

## Complete YAML Example

\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: webapp
  namespace: default
  labels:
    app: webapp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: webapp        # must match template labels
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
  template:
    metadata:
      labels:
        app: webapp      # must match selector
    spec:
      containers:
      - name: webapp
        image: nginx:1.25
        ports:
        - containerPort: 80
        resources:
          requests:
            cpu: "100m"
            memory: "128Mi"
          limits:
            cpu: "500m"
            memory: "256Mi"
        readinessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 10
        livenessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 15
          periodSeconds: 20
\`\`\`

## Revision History & Annotations

To have meaningful rollout history, annotate your changes:

\`\`\`bash
kubectl set image deployment/nginx nginx=nginx:1.25 --record
# --record is deprecated; use annotations instead:
kubectl annotate deployment/nginx kubernetes.io/change-cause="upgrade to 1.25"
\`\`\`

By default, Kubernetes keeps 10 revisions (\`revisionHistoryLimit: 10\`).

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| \`Deployment does not have minimum availability\` | maxUnavailable=0 and pods crash | Check pod logs/events |
| Pods stuck in \`ImagePullBackOff\` | Wrong image name/tag | Fix image reference |
| Rollout stalled at X% | Readiness probe failing | Check probe config and app health |
| \`selector does not match template labels\` | Mismatch between spec.selector and template.metadata.labels | Align labels |
| Replica count not changing | HPA controlling replicas | Check HPA configuration |

## Killer.sh Style Challenge

> **Scenario**: The deployment \`frontend\` in namespace \`prod\` is stuck during a rollout. The new pods are crashing. You need to:
> 1. Identify which revision is currently deployed
> 2. Roll back to the last known-good revision
> 3. Verify that all 3 replicas are running and Ready

\`\`\`bash
kubectl rollout history deployment/frontend -n prod
kubectl rollout undo deployment/frontend -n prod
kubectl rollout status deployment/frontend -n prod
kubectl get pods -n prod -l app=frontend
\`\`\`
`,
  quiz: [
    {
      question: 'A Deployment update is stuck — new pods are crashing. Which command reverts to the previous working version?',
      options: [
        'kubectl rollout undo deployment/myapp',
        'kubectl rollout revert deployment/myapp',
        'kubectl set image deployment/myapp myapp=previous-image',
        'kubectl delete deployment/myapp && kubectl apply -f old.yaml'
      ],
      correct: 0,
      explanation: '`kubectl rollout undo` reverts the Deployment to its previous ReplicaSet revision. This is the fastest, safest way to rollback.',
      reference: 'Rollout history is stored in ReplicaSets — study section: Deployment → ReplicaSet hierarchy.'
    },
    {
      question: 'What does `maxSurge: 2` mean in a RollingUpdate strategy?',
      options: [
        'Maximum 2 pods can be unavailable at once',
        'Up to 2 extra pods above the desired count can be created during the update',
        'The update uses 2 ReplicaSets simultaneously',
        'The update pauses after every 2 pods'
      ],
      correct: 1,
      explanation: '`maxSurge` sets how many extra pods above the desired replica count can be created during a rolling update, controlling update speed.',
      reference: 'Related: maxUnavailable controls availability; maxSurge controls speed.'
    },
    {
      question: 'You need an update strategy that first terminates ALL old pods before creating new ones. Which strategy should you use?',
      options: [
        'RollingUpdate with maxUnavailable: 100%',
        'BlueGreen',
        'Recreate',
        'Canary'
      ],
      correct: 2,
      explanation: 'The `Recreate` strategy terminates all existing pods before creating new ones. This causes downtime but is useful when two versions cannot coexist.',
      reference: 'Use Recreate for apps with DB migrations or exclusive resource locks.'
    },
    {
      question: 'Which command shows the rollout history of a Deployment, including change-cause annotations?',
      options: [
        'kubectl describe deployment/myapp',
        'kubectl rollout history deployment/myapp',
        'kubectl get replicasets -l app=myapp',
        'kubectl events deployment/myapp'
      ],
      correct: 1,
      explanation: '`kubectl rollout history deployment/myapp` lists all revisions with their CHANGE-CAUSE annotation, if set.',
      reference: 'Annotate with: kubectl annotate deployment/myapp kubernetes.io/change-cause="reason"'
    },
    {
      question: 'What is the relationship between a Deployment and a ReplicaSet?',
      options: [
        'A Deployment replaces ReplicaSets entirely',
        'A Deployment manages one or more ReplicaSets to perform rolling updates',
        'A ReplicaSet manages the Deployment lifecycle',
        'They are equivalent resources with different names'
      ],
      correct: 1,
      explanation: 'A Deployment creates and manages ReplicaSets. During a rolling update, two ReplicaSets exist simultaneously: the new one scales up while the old one scales down.',
      reference: 'Study: Deployment → ReplicaSet hierarchy and how revisions are stored.'
    },
    {
      question: 'A Deployment has `revisionHistoryLimit: 3`. What happens to older ReplicaSets?',
      options: [
        'They are deleted immediately after each rollout',
        'Only the 3 most recent ReplicaSets (with 0 replicas) are kept; older ones are garbage collected',
        'All ReplicaSets are kept indefinitely',
        'The Deployment fails if there are more than 3 ReplicaSets'
      ],
      correct: 1,
      explanation: '`revisionHistoryLimit` controls how many old ReplicaSets (scaled to 0) are retained for rollback. Older ones are automatically deleted.',
      reference: 'Default is 10. Set lower in environments with many deployments to save etcd space.'
    },
    {
      question: 'You paused a deployment with `kubectl rollout pause`. Subsequent `kubectl set image` commands are applied but no rollout starts. How do you start the rollout?',
      options: [
        'kubectl rollout start deployment/myapp',
        'kubectl rollout resume deployment/myapp',
        'kubectl rollout unpause deployment/myapp',
        'kubectl apply -f deployment.yaml --force'
      ],
      correct: 1,
      explanation: '`kubectl rollout resume` unpauses the Deployment and triggers a rollout with all accumulated changes since the pause.',
      reference: 'Pause → batch multiple changes (set image, env, resources) → resume for a single rollout.'
    },
    {
      question: 'The selector in a Deployment\'s spec does NOT match the labels in the pod template. What happens?',
      options: [
        'Kubernetes automatically corrects the labels',
        'The Deployment is rejected with a validation error',
        'Pods are created but not managed by the Deployment',
        'The Deployment runs but scales incorrectly'
      ],
      correct: 1,
      explanation: 'The selector is immutable and must match `spec.template.metadata.labels`. A mismatch causes a validation error on creation. If you try to change the selector after creation, kubectl will reject it.',
      reference: 'CKA trap: selector must exactly match pod template labels or creation fails.'
    }
  ],
  flashcards: [
    {
      front: 'What is the hierarchy: Deployment → ??? → Pods?',
      back: 'Deployment → **ReplicaSet** → Pods. Each revision creates a new ReplicaSet. Old ReplicaSets are scaled to 0 but retained for rollback (controlled by revisionHistoryLimit).'
    },
    {
      front: 'What is the difference between `maxUnavailable` and `maxSurge`?',
      back: '**maxUnavailable**: max pods that can be unavailable during the update (controls availability).\n**maxSurge**: max extra pods above desired count during update (controls speed).\nBoth can be absolute numbers or percentages.'
    },
    {
      front: 'How do you roll back a Deployment to revision 3?',
      back: '```bash\nkubectl rollout undo deployment/myapp --to-revision=3\n```\nWithout `--to-revision`, it rolls back to the previous revision.'
    },
    {
      front: 'When should you use `strategy: Recreate` instead of `RollingUpdate`?',
      back: 'Use **Recreate** when:\n- Two versions cannot run simultaneously (e.g., DB schema migrations)\n- You have exclusive resource locks\n- Downtime is acceptable\n\nAll old pods terminate before new ones start.'
    },
    {
      front: 'How do you trigger a rolling restart of a Deployment (without changing the image)?',
      back: '```bash\nkubectl rollout restart deployment/myapp\n```\nThis adds an annotation to the pod template triggering a rolling restart of all pods.'
    },
    {
      front: 'What does `revisionHistoryLimit` control?',
      back: 'The number of old **ReplicaSets** (with 0 replicas) kept for rollback purposes.\nDefault: `10`\nSet to `0` to disable rollback history (not recommended for production).'
    },
    {
      front: 'What command shows why a rollout is stalled?',
      back: '```bash\nkubectl rollout status deployment/myapp\n# Shows: "Waiting for rollout to finish: X out of Y new replicas have been updated..."\nkubectl describe deployment/myapp\n# Shows conditions and events\nkubectl get pods -l app=myapp  # Check pod status\n```'
    },
    {
      front: 'How do you scale a Deployment to 0 replicas (stop all pods without deleting the Deployment)?',
      back: '```bash\nkubectl scale deployment/myapp --replicas=0\n```\nAll pods are terminated. The Deployment object remains. Scale back up with `--replicas=N`.'
    }
  ],
  lab: {
    scenario: 'You are deploying a web application and need to perform a rolling update, verify the rollout, simulate a bad update and roll it back, then scale the deployment.',
    objective: 'Master the complete Deployment lifecycle: create, update, rollback, and scale.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create and Inspect a Deployment',
        instruction: `Create a Deployment named **webapp** in namespace **default** with image \`nginx:1.23\`, 3 replicas, and label \`app=webapp\`. After creation, check its rollout status and view the underlying ReplicaSet.`,
        hints: [
          'Use \`kubectl create deployment\` with \`--image\` and \`--replicas\` flags',
          'Use \`kubectl rollout status\` to confirm the rollout completed',
          'Use \`kubectl get replicasets\` to see the RS created by the deployment'
        ],
        solution: `\`\`\`bash
kubectl create deployment webapp --image=nginx:1.23 --replicas=3

# Check rollout
kubectl rollout status deployment/webapp

# Inspect the ReplicaSet
kubectl get replicasets -l app=webapp

# See full deployment details
kubectl describe deployment webapp
\`\`\``,
        verify: `\`\`\`bash
kubectl get deployment webapp
# Expected: READY 3/3

kubectl get replicasets -l app=webapp
# Expected: 1 ReplicaSet with DESIRED=3, CURRENT=3, READY=3

kubectl get pods -l app=webapp
# Expected: 3 pods in Running state
\`\`\``
      },
      {
        title: 'Perform a Rolling Update and Roll Back',
        instruction: `Update **webapp** to image \`nginx:1.25\`. Annotate the change with reason "upgrade to 1.25". Watch the rollout. After completion, view the history. Now simulate a bad update by setting image to \`nginx:broken-tag\`. The rollout should stall — roll it back.`,
        hints: [
          'Use \`kubectl set image\` to update',
          'Use \`kubectl annotate\` with \`kubernetes.io/change-cause\` key',
          'Use \`kubectl rollout history\` to see revisions',
          'Use \`kubectl rollout undo\` to rollback'
        ],
        solution: `\`\`\`bash
# Update to 1.25
kubectl set image deployment/webapp nginx=nginx:1.25

# Annotate for history
kubectl annotate deployment/webapp kubernetes.io/change-cause="upgrade to nginx 1.25"

# Watch rollout
kubectl rollout status deployment/webapp

# View history
kubectl rollout history deployment/webapp

# Simulate bad update
kubectl set image deployment/webapp nginx=nginx:broken-tag

# After seeing pods fail, rollback
kubectl rollout undo deployment/webapp

# Verify rollback
kubectl rollout status deployment/webapp
\`\`\``,
        verify: `\`\`\`bash
kubectl rollout history deployment/webapp
# Expected: at least 2-3 revisions listed

kubectl get pods -l app=webapp
# Expected: 3 pods Running (after rollback)

kubectl describe deployment webapp | grep Image
# Expected: nginx:1.25 (reverted to last good image)
\`\`\``
      },
      {
        title: 'Scale, Pause, and Resume',
        instruction: `Scale **webapp** to 5 replicas. Then pause the deployment. While paused, update the image to \`nginx:1.26\` AND add an environment variable \`ENV=production\` to the container. Resume the deployment — both changes should roll out together in a single rollout.`,
        hints: [
          'Use \`kubectl scale\` to change replica count',
          'Use \`kubectl rollout pause deployment/webapp\`',
          'Use \`kubectl set image\` and \`kubectl set env\` while paused',
          'Use \`kubectl rollout resume\` to apply all changes at once'
        ],
        solution: `\`\`\`bash
# Scale up
kubectl scale deployment/webapp --replicas=5

# Pause before making changes
kubectl rollout pause deployment/webapp

# Make multiple changes while paused
kubectl set image deployment/webapp nginx=nginx:1.26
kubectl set env deployment/webapp ENV=production

# Resume — both changes roll out together
kubectl rollout resume deployment/webapp

# Monitor
kubectl rollout status deployment/webapp
\`\`\``,
        verify: `\`\`\`bash
kubectl get deployment webapp
# Expected: READY 5/5

kubectl describe deployment webapp | grep -A2 "Containers:"
# Expected: Image: nginx:1.26 and Env: ENV=production

kubectl rollout history deployment/webapp
# Expected: new revision combining both changes
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Deployment stuck — pods in ImagePullBackOff',
      difficulty: 'easy',
      symptom: 'After `kubectl set image`, new pods are stuck in `ImagePullBackOff` or `ErrImagePull`. The rollout progress halts.',
      diagnosis: `\`\`\`bash
# See pod status
kubectl get pods -l app=webapp

# Check events on a failing pod
kubectl describe pod <failing-pod-name>
# Look for: "Failed to pull image" or "manifest unknown"

# Check deployment status
kubectl rollout status deployment/webapp
# Will show: "Waiting for rollout..."

# Check rollout history
kubectl rollout history deployment/webapp
\`\`\``,
      solution: `The image tag doesn't exist or the registry is unreachable.

**Fix options:**
\`\`\`bash
# Option 1: Roll back to working version
kubectl rollout undo deployment/webapp

# Option 2: Fix the image tag
kubectl set image deployment/webapp nginx=nginx:1.26  # correct tag

# Verify
kubectl rollout status deployment/webapp
kubectl get pods -l app=webapp
\`\`\`

Note: Because \`maxUnavailable\` defaults to 25% and old pods are only terminated after new ones are ready, rolling updates **preserve availability** even during a bad update.`
    },
    {
      title: 'Deployment not scaling — HPA conflict',
      difficulty: 'medium',
      symptom: '`kubectl scale deployment/webapp --replicas=10` runs without error, but the replica count immediately reverts to its previous value.',
      diagnosis: `\`\`\`bash
# Check if an HPA is managing this deployment
kubectl get hpa
kubectl describe hpa webapp
# Look for: "ScaleDown" or "ScaleUp" decisions
# The HPA continuously reconciles replica count to match its target

# Check events
kubectl get events --field-selector reason=SuccessfulRescale
\`\`\``,
      solution: `An HPA (HorizontalPodAutoscaler) is managing the Deployment's replica count. Manual scaling is overridden by the HPA controller.

**Fix options:**
\`\`\`bash
# Option 1: Adjust HPA min/max to allow desired count
kubectl patch hpa webapp -p '{"spec":{"minReplicas":10,"maxReplicas":20}}'

# Option 2: Remove HPA (if autoscaling not needed)
kubectl delete hpa webapp
kubectl scale deployment/webapp --replicas=10

# Option 3: Temporary — edit HPA to desired replicas
kubectl edit hpa webapp
\`\`\`

**Key insight**: When an HPA exists, always adjust the HPA rather than scaling the Deployment directly.`
    }
  ]
};
