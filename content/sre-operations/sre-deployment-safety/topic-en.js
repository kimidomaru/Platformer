window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['sre-operations/sre-deployment-safety'] = {
  theory: `# Deployment Safety: Progressive Delivery & Feature Flags

## Relevance
> Deployments are the leading cause of production incidents. SREs responsible for safe deploys use progressive delivery (canary, blue-green, feature flags) to minimize blast radius.

## Progressive Delivery

Progressive delivery delivers changes gradually, with the ability to roll back quickly:

### Canary Deployment with Kubernetes

\`\`\`yaml
# 1. Stable deployment (90% of traffic)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-stable
  labels:
    app: myapp
    track: stable
spec:
  replicas: 9      # 90% (9 out of 10 pods)
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
        - name: myapp
          image: myapp:v1.0.0
---
# 2. Canary deployment (10% of traffic)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-canary
  labels:
    app: myapp
    track: canary
spec:
  replicas: 1      # 10%
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
        - name: myapp
          image: myapp:v2.0.0
---
# 3. Service that sends to both (based on label app: myapp)
apiVersion: v1
kind: Service
metadata:
  name: myapp
spec:
  selector:
    app: myapp    # includes stable and canary
  ports:
    - port: 80
\`\`\`

### Canary with Argo Rollouts

\`\`\`yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: myapp
spec:
  replicas: 10
  strategy:
    canary:
      steps:
        - setWeight: 10       # 10% canary
        - pause: {duration: 5m}
        - analysis:           # automatic metrics analysis
            templates:
              - templateName: success-rate
        - setWeight: 30       # 30% canary
        - pause: {duration: 10m}
        - setWeight: 60
        - pause: {duration: 10m}
        - setWeight: 100      # full promotion
      canaryService: myapp-canary
      stableService: myapp-stable
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
        - name: myapp
          image: myapp:v2.0.0
\`\`\`

\`\`\`bash
# Watch the rollout
kubectl argo rollouts get rollout myapp --watch

# Manually promote (skip pause)
kubectl argo rollouts promote myapp

# Abort (automatic rollback)
kubectl argo rollouts abort myapp

# Resume after abort
kubectl argo rollouts retry rollout myapp
\`\`\`

## Feature Flags

Feature flags decouple deploy from release — the code reaches production but the feature stays off:

### OpenFeature + Flagd (CNCF standard)

\`\`\`yaml
# flagd ConfigMap with feature flags
apiVersion: v1
kind: ConfigMap
metadata:
  name: flagd-config
data:
  flags.json: |
    {
      "flags": {
        "new-checkout-flow": {
          "state": "ENABLED",
          "variants": {
            "on": true,
            "off": false
          },
          "defaultVariant": "off",
          "targeting": {
            "if": [
              { "in": [{ "var": "email" }, ["admin@company.com", "beta@company.com"]] },
              "on",
              "off"
            ]
          }
        },
        "v2-api": {
          "state": "ENABLED",
          "variants": {
            "on": true,
            "off": false
          },
          "defaultVariant": "off"
        }
      }
    }
\`\`\`

\`\`\`python
# Usage in Python
from openfeature import api
from openfeature.contrib.provider.flagd import FlagdProvider

api.set_provider(FlagdProvider())
client = api.get_client()

# Evaluate feature flag
is_new_checkout = client.get_boolean_value(
    "new-checkout-flow",
    default_value=False,
    evaluation_context={"email": user.email}
)

if is_new_checkout:
    return new_checkout_flow()
else:
    return legacy_checkout()
\`\`\`

## Deployment Pre-checks & Smoke Tests

\`\`\`bash
# Automated pre-deploy checklist (CI/CD script)
#!/bin/bash
set -euo pipefail

echo "=== Deployment Safety Checks ==="

# 1. Check current error rate (before deploying)
ERROR_RATE=$(curl -s "http://prometheus:9090/api/v1/query?query=rate(http_requests_total{status=~'5..'}[5m])/rate(http_requests_total[5m])*100" | jq -r '.data.result[0].value[1]')
if (( $(echo "\${ERROR_RATE} > 1" | bc -l) )); then
  echo "ERROR: Error rate \${ERROR_RATE}% > 1%. Aborting deploy."
  exit 1
fi

# 2. Check that there is no active incident
# (integrate with PagerDuty/OpsGenie API)

# 3. Check maintenance window
HOUR=$(date +%H)
if [[ $HOUR -ge 9 && $HOUR -le 18 ]]; then
  echo "WARNING: Deploy outside preferred window (08-09 or 18-20)"
fi

# 4. Post-deploy smoke test
kubectl rollout status deployment/myapp -n production --timeout=300s

# 5. Health check
HEALTH=$(curl -sf http://myapp.production.svc/health | jq -r '.status')
if [[ "$HEALTH" != "ok" ]]; then
  echo "ERROR: Health check failed. Starting rollback..."
  kubectl rollout undo deployment/myapp -n production
  exit 1
fi

echo "=== Deploy completed successfully ==="
\`\`\`

## Common Deployment Safety Mistakes

1. **Deploying during peak hours**: always deploy during low-traffic hours.
2. **No automatic canary analysis**: manually promoting canary without checking metrics → defeats the purpose.
3. **Feature flags without expiration**: long-lived flags become technical debt. Always define a removal deadline.
4. **Rollback without testing**: never tested the rollback process before needing it in production.
`,

  quiz: [
    {
      question: 'In a native Kubernetes canary deployment (without Argo Rollouts), how is traffic distributed between versions?',
      options: [
        'Via weight rules in the Kubernetes Service',
        'Proportionally to the number of replicas of each Deployment (both selected by the same Service)',
        'Via annotations in the Ingress that define traffic percentage',
        'Via DNS round-robin between two separate Services'
      ],
      correct: 1,
      explanation: 'With native Kubernetes, the Service selects all pods with the common label (e.g., app: myapp). Traffic is distributed by kube-proxy proportionally to the number of pods — 9 pods of v1 and 1 pod of v2 results in ~10% traffic to the canary. Argo Rollouts and Istio allow finer control (e.g., exactly 10% regardless of pod count).',
      reference: 'Canary Deployment section — compare the native approach (by replicas) vs Argo Rollouts (by weight).'
    },
    {
      question: 'What is the main advantage of Feature Flags versus Canary Deployment for controlling releases?',
      options: [
        'Feature flags are always faster to implement than canary',
        'Feature flags decouple deploy from release — the code is in production but the feature is controlled by configuration without redeployment',
        'Feature flags allow faster rollback than canary',
        'Feature flags do not require changes to the application code'
      ],
      correct: 1,
      explanation: 'Feature flags separate the deploy (putting the code in production) from the release (activating the feature for users). This allows: (1) continuous deployment without exposing incomplete features, (2) A/B testing by user/group, (3) instant kill switch without redeployment, (4) gradual rollout by user segment. Canary controls different pod versions; feature flags control behavior within the same pod.',
      reference: 'Feature Flags section — understand the fundamental difference between deploy and release.'
    },
    {
      question: 'What is the risk of not testing the rollback process before needing it in production?',
      options: [
        'Kubernetes rollback always works automatically — no testing needed',
        'In a real incident, an untested rollback process can be slower, fail, or have unexpected side effects, extending the MTTR',
        'The only risk is loss of audit data',
        'Untested rollback only consumes more CPU resources'
      ],
      correct: 1,
      explanation: 'Untested rollback processes frequently fail or take longer than expected during real incidents (when there is time pressure and cognitive stress). Common problems: database with non-reversible schema migration, dependencies on other services in the new version, outdated rollback process. SREs practice rollbacks regularly as "fire drills".',
      reference: 'Deployment Pre-checks section — include rollback tests in your deployment runbook.'
    }
  ],

  flashcards: [
    {
      front: 'How do you implement native canary deployment in Kubernetes without external tools?',
      back: '**Concept**: two Deployments (stable and canary) selected by the same Service.\n\n**Ratio by replicas**:\n- 9 stable pods (v1) + 1 canary pod (v2) = 10% canary\n\n**Service selector**:\n```yaml\nspec:\n  selector:\n    app: myapp      # selects BOTH stable and canary\n                    # does NOT include "track: stable"\n```\n\n**Limitation**: weight control only by replicas (not by exact percentage).\n\n**For fine control**: use Argo Rollouts, Flagger, or Istio (VirtualService with weight).'
    },
    {
      front: 'What is progressive delivery and how does it differ from a rolling update?',
      back: '**Rolling Update** (K8s default):\n- Replaces pods one by one\n- No automatic metrics analysis\n- If something breaks, rollback is manual\n- All users affected simultaneously\n\n**Progressive Delivery**:\n- Exposes new version to a growing % of traffic\n- Automatic metrics analysis at each step\n- Automatic rollback if metrics degrade\n- Granular control: by user, region, percentage\n\nTools: Argo Rollouts, Flagger (GitOps), Istio+Flagger.'
    }
  ],

  lab: {
    scenario: 'Implement a manual canary deployment using two Deployments and verify the traffic distribution.',
    objective: 'Understand how canary works natively in Kubernetes before using tools like Argo Rollouts.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Deploy stable and canary',
        instruction: 'Create two Deployments (stable v1 with 9 replicas and canary v2 with 1 replica) and a Service that distributes to both.',
        hints: ['Common label: app: myapp', 'Service selects by app: myapp (without track)'],
        solution: `\`\`\`bash
kubectl create namespace canary-demo

# Stable (v1 = nginx:alpine, 9 replicas)
kubectl create deployment myapp-stable \
  --image=nginx:alpine \
  --replicas=9 \
  -n canary-demo

# Add common label to pod template
kubectl patch deployment myapp-stable -n canary-demo \
  -p '{"spec":{"template":{"metadata":{"labels":{"app":"myapp","version":"v1"}}}}}'

# Canary (v2 = nginx:1.25, 1 replica)
kubectl create deployment myapp-canary \
  --image=nginx:1.25 \
  --replicas=1 \
  -n canary-demo

kubectl patch deployment myapp-canary -n canary-demo \
  -p '{"spec":{"template":{"metadata":{"labels":{"app":"myapp","version":"v2"}}}}}'

# Service that selects both
kubectl expose deployment myapp-stable \
  --name=myapp \
  --port=80 \
  --selector="app=myapp" \
  -n canary-demo
\`\`\``,
        verify: `\`\`\`bash
kubectl get pods -n canary-demo --show-labels | grep myapp
# Expected: 9 pods v1 and 1 pod v2

kubectl get svc myapp -n canary-demo
# Expected: myapp service created

# Verify endpoints (should include all 10 pods)
kubectl get endpoints myapp -n canary-demo
# Expected: 10 addresses in endpoints
\`\`\``
      },
      {
        title: 'Verify traffic distribution and promote canary',
        instruction: 'Generate traffic and observe the distribution. Then promote the canary to 100%.',
        hints: ['for loop with curl to simulate traffic', 'Scale stable to 0 to complete promotion'],
        solution: `\`\`\`bash
# Generate 20 requests and count versions (via Server header)
kubectl run tester --image=busybox -n canary-demo --restart=Never -- \
  sh -c "for i in \$(seq 20); do wget -qO- http://myapp/ | grep -o 'nginx/[0-9.]*'; done" 2>/dev/null || \
  echo "Check via kubectl logs tester -n canary-demo"

# Promote canary (increase to 5 and decrease stable)
kubectl scale deployment myapp-canary --replicas=5 -n canary-demo
kubectl scale deployment myapp-stable --replicas=5 -n canary-demo

# Full promotion
kubectl scale deployment myapp-canary --replicas=10 -n canary-demo
kubectl scale deployment myapp-stable --replicas=0 -n canary-demo

echo "Canary promoted to 100%"

# Cleanup
kubectl delete namespace canary-demo
\`\`\``,
        verify: `\`\`\`bash
kubectl get deployments -n canary-demo
# After promotion:
# myapp-stable   0/0   0
# myapp-canary  10/10  10

kubectl get endpoints myapp -n canary-demo
# All endpoints point to v2 pods
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Canary receiving more traffic than expected',
      difficulty: 'medium',
      symptom: 'The canary has 1 replica (expected ~10%) but is receiving ~30% of traffic according to logs.',
      diagnosis: `\`\`\`bash
# Check if stable has all healthy replicas
kubectl get pods -n production -l track=stable

# Check if stable pods have failing readiness probes
kubectl describe pod myapp-stable-xxx -n production | grep -A10 "Readiness:"

# Check effective endpoints
kubectl get endpoints myapp -n production
# Count endpoints per version
\`\`\``,
      solution: `**Cause**: stable pods may have failing readiness probes and be removed from endpoints. Even with replicas=9, if only 3 are Ready, the distribution is 3:1 (75% stable, 25% canary).

\`\`\`bash
# Check non-Ready pods
kubectl get pods -n production -l app=myapp | grep -v Running

# Force stable rollback to a known-good version
kubectl rollout undo deployment/myapp-stable -n production

# Wait for all to become Ready
kubectl rollout status deployment/myapp-stable -n production

# Verify real distribution
kubectl get endpoints myapp -n production
\`\`\`

**Prevention**: monitor the actual number of Ready endpoints, not just replicas. Use Prometheus: \`kube_endpoint_address_available\`.`
    }
  ]
};
