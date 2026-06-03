window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['cks-cluster-hardening/serviceaccount-hardening'] = {
  theory: `# ServiceAccount Hardening

## Exam Relevance
> CKS expects you to secure ServiceAccounts: disable automounting, create dedicated SAs, understand bound tokens, and restrict the default SA. Appears in Cluster Hardening domain (~10%).

## How ServiceAccounts Work

Every pod in Kubernetes runs as a ServiceAccount. By default:

1. If no ServiceAccount is specified, the pod uses the **default** ServiceAccount
2. A JWT token for the SA is automatically mounted at \`/var/run/secrets/kubernetes.io/serviceaccount/token\`
3. The token can be used to call the Kubernetes API

\`\`\`
Pod → reads token from /var/run/secrets/kubernetes.io/serviceaccount/token
    → uses token in Authorization: Bearer <token> header
    → calls https://kubernetes.default.svc/api/v1/...
\`\`\`

### Token Location in Pod

\`\`\`bash
# Inside a pod:
ls /var/run/secrets/kubernetes.io/serviceaccount/
# token  ca.crt  namespace

cat /var/run/secrets/kubernetes.io/serviceaccount/token
# JWT token — can be decoded: cat token | cut -d. -f2 | base64 -d | python3 -m json.tool

# Try calling the API with it
TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
curl -sk https://kubernetes.default.svc/api/v1/namespaces \
  -H "Authorization: Bearer $TOKEN"
\`\`\`

## Bound Service Account Tokens (v1.22+)

Modern Kubernetes uses **bound service account tokens** (TokenRequest API) instead of long-lived tokens:

| Feature | Old (pre-1.22) | Bound Token (1.22+) |
|---------|---------------|---------------------|
| Expiry | Never | Default 1 hour (configurable) |
| Audience | Any | Bound to specific audience |
| Rotation | Never | Auto-rotated before expiry |
| Revocation | Delete SA | Automatic at expiry |
| Volume | Secret | Projected volume |

\`\`\`yaml
# Bound token projected volume (automatic in 1.22+)
volumes:
- name: kube-api-access
  projected:
    defaultMode: 420
    sources:
    - serviceAccountToken:
        expirationSeconds: 3607    # default ~1 hour
        path: token
    - configMap:
        items:
        - key: ca.crt
          path: ca.crt
        name: kube-root-ca.crt
    - downwardAPI:
        items:
        - fieldRef:
            apiVersion: v1
            fieldPath: metadata.namespace
          path: namespace
\`\`\`

## Disabling Automounting

### At ServiceAccount Level

\`\`\`yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: no-api-access
  namespace: default
automountServiceAccountToken: false
\`\`\`

### At Pod Level

\`\`\`yaml
apiVersion: v1
kind: Pod
spec:
  automountServiceAccountToken: false   # overrides SA-level setting
  serviceAccountName: no-api-access
  containers:
  - name: app
    image: nginx
\`\`\`

### Patching the Default SA

\`\`\`bash
# Disable automounting for the default SA in a namespace
kubectl patch serviceaccount default -n myapp \
  -p '{"automountServiceAccountToken": false}'

# Do this for ALL namespaces
for ns in $(kubectl get namespaces -o jsonpath='{.items[*].metadata.name}'); do
  kubectl patch serviceaccount default -n $ns \
    -p '{"automountServiceAccountToken": false}'
done
\`\`\`

## Creating Dedicated ServiceAccounts

### Per-Application SA Pattern

\`\`\`yaml
# 1. Create dedicated ServiceAccount
apiVersion: v1
kind: ServiceAccount
metadata:
  name: webapp-sa
  namespace: webapp
automountServiceAccountToken: false   # disable unless needed

---
# 2. Create minimum RBAC
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: webapp-role
  namespace: webapp
rules:
- apiGroups: [""]
  resources: ["configmaps"]
  verbs: ["get"]
  resourceNames: ["webapp-config"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: webapp-binding
  namespace: webapp
subjects:
- kind: ServiceAccount
  name: webapp-sa
  namespace: webapp
roleRef:
  kind: Role
  name: webapp-role
  apiGroup: rbac.authorization.k8s.io

---
# 3. Use in Deployment
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      serviceAccountName: webapp-sa
      automountServiceAccountToken: true   # enable only if SA needs API access
\`\`\`

## Restricting the Default ServiceAccount

The default ServiceAccount in every namespace has no permissions by default (RBAC), but the token is still mounted. Best practice:

\`\`\`bash
# 1. Disable token automounting for default SA in all namespaces
kubectl patch serviceaccount default -n default \
  -p '{"automountServiceAccountToken": false}'

# 2. Verify no RoleBindings exist for the default SA
kubectl get rolebindings,clusterrolebindings -A -o json | \
  python3 -c "
import json, sys
d = json.load(sys.stdin)
found = False
for item in d['items']:
  for s in item.get('subjects', []):
    if s.get('name') == 'default' and s.get('kind') == 'ServiceAccount':
      print(f\"FOUND: {item['metadata']['name']}\")
      found = True
if not found:
  print('No bindings for default SA found')
"

# 3. Check for cluster-level default SA bindings
kubectl get clusterrolebindings -o json | \
  python3 -c "
import json, sys
d = json.load(sys.stdin)
for item in d['items']:
  for s in item.get('subjects', []):
    if s.get('name') == 'default' and s.get('kind') == 'ServiceAccount':
      print(f\"CLUSTER BINDING: {item['metadata']['name']} -> {item['roleRef']['name']}\")
"
\`\`\`

## Token Request API (Manual Token Creation)

For cases where you need a temporary token with specific audience/expiry:

\`\`\`bash
# Create a short-lived token (CLI)
kubectl create token myapp-sa \
  --duration=1h \
  --namespace=myapp \
  --audience=my-service

# Token is returned as JWT — use immediately
TOKEN=$(kubectl create token myapp-sa -n myapp)
\`\`\`

\`\`\`yaml
# Or via TokenRequest API
apiVersion: authentication.k8s.io/v1
kind: TokenRequest
metadata:
  name: myapp-sa
  namespace: myapp
spec:
  audiences:
  - my-service
  expirationSeconds: 3600
\`\`\`

## Kubernetes 1.24+ Changes

Starting in **Kubernetes 1.24**, the controller no longer auto-creates long-lived Secret-based tokens for ServiceAccounts:

\`\`\`bash
# Old behavior (pre-1.24): automatically created
kubectl get secret -n myapp | grep myapp-sa
# myapp-sa-token-xxxxx   kubernetes.io/service-account-token

# New behavior (1.24+): must explicitly create if needed
apiVersion: v1
kind: Secret
metadata:
  name: myapp-sa-token
  namespace: myapp
  annotations:
    kubernetes.io/service-account.name: myapp-sa
type: kubernetes.io/service-account-token
\`\`\`

But the **recommended approach** is to use the TokenRequest API (kubectl create token) instead.

## ServiceAccount Identity Verification

\`\`\`bash
# Check what SA a pod is using
kubectl get pod <pod-name> -o yaml | grep serviceAccountName

# Decode the token (without libraries)
kubectl get secret myapp-sa-token -o jsonpath='{.data.token}' | \
  base64 -d | \
  cut -d. -f2 | \
  base64 -d 2>/dev/null | \
  python3 -m json.tool
# Shows: "sub": "system:serviceaccount:myapp:myapp-sa"

# List all tokens for a SA
kubectl get secrets -n myapp -o json | \
  python3 -c "
import json, sys
d = json.load(sys.stdin)
for item in d['items']:
  if item['type'] == 'kubernetes.io/service-account-token':
    sa = item.get('metadata', {}).get('annotations', {}).get('kubernetes.io/service-account.name')
    print(item['metadata']['name'], '->', sa)
"
\`\`\`

## Common Mistakes

- **Not disabling default SA automount**: Even without RBAC permissions, the token is still useful for fingerprinting the cluster
- **Using default SA for applications**: Multiple apps sharing one SA makes RBAC auditing impossible
- **Long-lived tokens in Secrets**: Prefer bounded tokens (kubectl create token) over Secret-based long-lived tokens
- **Forgetting to specify SA in Deployments**: Pods without explicit SA use the default SA

## Killer.sh Style Challenge

> **Scenario**: Namespace "ci-system" has a pod that doesn't need API access. Disable automounting for the pod's ServiceAccount and verify the pod no longer has the token mounted.
`,

  quiz: [
    {
      question: 'Where is the ServiceAccount token mounted inside a pod by default?',
      options: [
        '/var/run/secrets/kubernetes.io/serviceaccount/token',
        '/etc/kubernetes/serviceaccount/token',
        '/run/secrets/token',
        '/var/secrets/kubernetes/token'
      ],
      correct: 0,
      explanation: 'The ServiceAccount token is automatically mounted at /var/run/secrets/kubernetes.io/serviceaccount/token. The directory also contains ca.crt (cluster CA) and namespace (the pod\'s namespace). Applications use this token to call the API server.',
      reference: 'ServiceAccount Hardening — Token Location in Pod section.'
    },
    {
      question: 'What is the key difference between old ServiceAccount tokens and bound tokens (Kubernetes 1.22+)?',
      options: [
        'Bound tokens expire (default ~1 hour) and are auto-rotated; old tokens never expire',
        'Bound tokens are stored in Secrets; old tokens are in ConfigMaps',
        'Bound tokens require explicit RBAC; old tokens have cluster-admin by default',
        'Bound tokens use RSA encryption; old tokens use HMAC'
      ],
      correct: 0,
      explanation: 'Bound service account tokens (TokenRequest API) have a configurable expiry (default ~1 hour) and are automatically rotated by the kubelet before expiry. Legacy Secret-based tokens never expired and had to be manually revoked by deleting the Secret.',
      reference: 'ServiceAccount Hardening — Bound Service Account Tokens table.'
    },
    {
      question: 'You want to disable automounting for ALL pods using a specific ServiceAccount. Where do you set automountServiceAccountToken: false?',
      options: [
        'In the ServiceAccount spec',
        'In the Pod spec (must be set on each individual pod)',
        'In the namespace labels',
        'In the RBAC Role for the ServiceAccount'
      ],
      correct: 0,
      explanation: 'Setting automountServiceAccountToken: false on the ServiceAccount object affects all pods that use it. Setting it in the Pod spec overrides the SA-level setting for that specific pod. For cluster-wide policy, set it on the ServiceAccount.',
      reference: 'ServiceAccount Hardening — At ServiceAccount Level section.'
    },
    {
      question: 'What changed in Kubernetes 1.24 regarding ServiceAccount token Secrets?',
      options: [
        'The controller no longer auto-creates Secret-based tokens for new ServiceAccounts',
        'ServiceAccount tokens now expire after 24 hours by default',
        'ServiceAccounts require explicit annotation to be created',
        'The token file path changed from /var/run/secrets to /run/secrets'
      ],
      correct: 0,
      explanation: 'Before 1.24, a kubernetes.io/service-account-token Secret was automatically created for each ServiceAccount. In 1.24+, you must explicitly create it if needed. The preferred approach is the TokenRequest API (kubectl create token) for short-lived tokens.',
      reference: 'ServiceAccount Hardening — Kubernetes 1.24+ Changes section.'
    },
    {
      question: 'How do you create a temporary token valid for 1 hour for a ServiceAccount?',
      options: [
        'kubectl create token <sa-name> --duration=1h -n <namespace>',
        'kubectl get token <sa-name> --ttl=3600 -n <namespace>',
        'kubectl describe serviceaccount <sa-name> | grep token',
        'kubectl create secret token-1h --for=serviceaccount/<sa-name>'
      ],
      correct: 0,
      explanation: 'kubectl create token generates a bound token with specified duration using the TokenRequest API. The token is immediately printed and valid for the specified duration. This is the recommended approach over Secret-based long-lived tokens.',
      reference: 'ServiceAccount Hardening — Token Request API section.'
    },
    {
      question: 'Why should every application have its own dedicated ServiceAccount rather than using the default?',
      options: [
        'RBAC permissions cannot be scoped to individual apps when sharing a ServiceAccount — one SA compromise affects all apps sharing it',
        'The default ServiceAccount has cluster-admin privileges by default',
        'Multiple pods cannot use the same ServiceAccount simultaneously',
        'Kubernetes enforces a maximum of 5 pods per ServiceAccount'
      ],
      correct: 0,
      explanation: 'Dedicated ServiceAccounts enable: (1) app-specific RBAC — grant only what each app needs, (2) audit trail — API calls attributed to specific app, (3) blast radius limitation — compromise of one SA doesn\'t affect others. The default SA being shared makes RBAC impossible to scope.',
      reference: 'ServiceAccount Hardening — Per-Application SA Pattern section.'
    },
    {
      question: 'Which command disables token automounting for the default ServiceAccount in the "production" namespace?',
      options: [
        'kubectl patch serviceaccount default -n production -p \'{"automountServiceAccountToken": false}\'',
        'kubectl annotate serviceaccount default -n production automountServiceAccountToken=false',
        'kubectl label serviceaccount default -n production automount=disabled',
        'kubectl edit serviceaccount default -n production (then set automount: false)'
      ],
      correct: 0,
      explanation: 'kubectl patch with a JSON patch is the most reliable one-liner. Editing with kubectl edit also works but requires interactive editing. The key is setting automountServiceAccountToken: false on the ServiceAccount object, not via annotations or labels.',
      reference: 'ServiceAccount Hardening — Patching the Default SA section.'
    },
    {
      question: 'A pod has automountServiceAccountToken: true in its spec, but the ServiceAccount has automountServiceAccountToken: false. Is the token mounted?',
      options: [
        'Yes — the Pod spec setting overrides the ServiceAccount setting',
        'No — the ServiceAccount setting always takes precedence',
        'The pod fails to start due to conflicting configuration',
        'The token is mounted but with read-only access'
      ],
      correct: 0,
      explanation: 'The Pod spec automountServiceAccountToken field overrides the ServiceAccount-level setting. If the Pod sets it to true, the token is mounted even if the SA has false. This bidirectional override works in both directions.',
      reference: 'ServiceAccount Hardening — At Pod Level section.'
    }
  ],

  flashcards: [
    {
      front: 'What are the 3 files mounted in the ServiceAccount projected volume?',
      back: 'Mount path: /var/run/secrets/kubernetes.io/serviceaccount/\n\n1. token — JWT bearer token for API calls (bound token, expires ~1h)\n2. ca.crt — cluster CA certificate (to verify API server TLS)\n3. namespace — the pod\'s namespace as a text file\n\nExample use:\nTOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)\ncurl -k https://kubernetes.default.svc/api/v1/namespaces \\\n  -H "Authorization: Bearer $TOKEN"'
    },
    {
      front: 'How do you disable automounting at SA level vs Pod level?',
      back: 'SA level (affects all pods using this SA):\napiVersion: v1\nkind: ServiceAccount\nautomountServiceAccountToken: false\n\nPod level (overrides SA setting for this pod):\napiVersion: v1\nkind: Pod\nspec:\n  automountServiceAccountToken: false\n\nPod setting OVERRIDES SA setting:\n- Pod: true, SA: false → token IS mounted\n- Pod: false, SA: true → token NOT mounted'
    },
    {
      front: 'What is a bound ServiceAccount token and why is it more secure?',
      back: 'Bound token (TokenRequest API, K8s 1.20+, default 1.22+):\n- Expires: ~1 hour by default\n- Audience bound: only valid for specified audience\n- Auto-rotated by kubelet before expiry\n- Lives in projected volume, not a Secret\n\nOld token (Secret-based):\n- Never expires\n- Valid for any audience\n- Must be manually revoked\n- Stored as a Secret (base64 in etcd)\n\nCreate manually: kubectl create token <sa-name> --duration=1h'
    },
    {
      front: 'What changed in K8s 1.24 about ServiceAccount Secrets?',
      back: 'Before 1.24: Creating a ServiceAccount auto-creates a Secret:\nkubernetes.io/service-account-token type Secret\n\nAfter 1.24: NO auto-creation of long-lived Secret tokens.\n\nTo create one explicitly (if needed):\napiVersion: v1\nkind: Secret\nmetadata:\n  annotations:\n    kubernetes.io/service-account.name: my-sa\ntype: kubernetes.io/service-account-token\n\nPreferred: Use TokenRequest API instead:\nkubectl create token my-sa --duration=1h'
    },
    {
      front: 'How do you lock down the default ServiceAccount across all namespaces?',
      back: '# Disable automount for default SA in all namespaces:\nfor ns in $(kubectl get ns -o jsonpath=\'{.items[*].metadata.name}\'); do\n  kubectl patch serviceaccount default -n $ns \\\n    -p \'{"automountServiceAccountToken": false}\'\ndone\n\n# Verify no ClusterRoleBindings exist for default SA:\nkubectl get clusterrolebindings -o json | \\\n  jq \'.items[] | select(.subjects[]? | .name=="default") | .metadata.name\''
    },
    {
      front: 'What is the format for decoding a ServiceAccount token JWT?',
      back: '# Decode without external tools:\nkubectl get secret <sa-secret> -o jsonpath=\'{.data.token}\' | \\\n  base64 -d | \\\n  cut -d. -f2 | \\\n  base64 -d 2>/dev/null | \\\n  python3 -m json.tool\n\n# Shows payload with:\n# "iss": "kubernetes/serviceaccount"\n# "sub": "system:serviceaccount:<namespace>:<name>"\n# "exp": <timestamp> (if bound token)\n\n# Or just read it from inside the pod:\ncat /var/run/secrets/kubernetes.io/serviceaccount/token | cut -d. -f2 | base64 -d'
    }
  ],

  lab: {
    scenario: 'A security review found that all pods in the "apps" namespace are using the default ServiceAccount with the token automounted. Create a dedicated ServiceAccount for a web application and harden the default SA.',
    objective: 'Create a dedicated ServiceAccount, configure minimum RBAC permissions, disable token automounting for the default SA, and verify the setup.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Audit current ServiceAccount usage',
        instruction: `Check which pods are using the default SA and if the token is mounted.

\`\`\`bash
# Create test namespace
kubectl create namespace apps

# Deploy app with default SA (current bad practice)
kubectl create deployment webapp --image=nginx:alpine -n apps

# Wait for pod to be running
kubectl wait deployment/webapp -n apps --for=condition=Available --timeout=60s

# Find the pod name
POD=$(kubectl get pods -n apps -l app=webapp -o jsonpath='{.items[0].metadata.name}')

# Check SA usage
kubectl get pod $POD -n apps -o yaml | grep -E "serviceAccountName|automountServiceAccountToken"

# Verify token is mounted inside the pod
kubectl exec $POD -n apps -- ls /var/run/secrets/kubernetes.io/serviceaccount/
\`\`\``,
        hints: [
          'The default SA name is literally "default"',
          'If automountServiceAccountToken is not shown, it defaults to true'
        ],
        solution: `\`\`\`bash
kubectl create namespace apps
kubectl create deployment webapp --image=nginx:alpine -n apps
kubectl wait deployment/webapp -n apps --for=condition=Available --timeout=60s
POD=$(kubectl get pods -n apps -l app=webapp -o jsonpath='{.items[0].metadata.name}')
kubectl exec $POD -n apps -- ls /var/run/secrets/kubernetes.io/serviceaccount/
\`\`\``,
        verify: `\`\`\`bash
# Token should currently be mounted (this is the problem we're fixing)
POD=$(kubectl get pods -n apps -l app=webapp -o jsonpath='{.items[0].metadata.name}')
kubectl exec $POD -n apps -- ls /var/run/secrets/kubernetes.io/serviceaccount/
# Expected: ca.crt  namespace  token

# Current SA is default
kubectl get pod $POD -n apps -o yaml | grep serviceAccountName
# Expected: serviceAccountName: default
\`\`\``
      },
      {
        title: 'Create a dedicated ServiceAccount and disable the default SA',
        instruction: `Create a webapp ServiceAccount and disable automounting on the default SA.

\`\`\`bash
# Create dedicated SA with automount disabled
kubectl create serviceaccount webapp-sa -n apps

# Disable automounting for the SA
kubectl patch serviceaccount webapp-sa -n apps \
  -p '{"automountServiceAccountToken": false}'

# Also disable for the default SA
kubectl patch serviceaccount default -n apps \
  -p '{"automountServiceAccountToken": false}'

# Verify
kubectl get serviceaccount webapp-sa -n apps -o yaml | grep automount
kubectl get serviceaccount default -n apps -o yaml | grep automount
\`\`\``,
        hints: [
          'After patching default SA, existing pods keep their current mounted token until restarted',
          'New pods created after the patch will NOT have the token mounted'
        ],
        solution: `\`\`\`bash
kubectl create serviceaccount webapp-sa -n apps
kubectl patch serviceaccount webapp-sa -n apps -p '{"automountServiceAccountToken": false}'
kubectl patch serviceaccount default -n apps -p '{"automountServiceAccountToken": false}'
kubectl get serviceaccount -n apps
\`\`\``,
        verify: `\`\`\`bash
kubectl get serviceaccount webapp-sa -n apps -o yaml | grep automountServiceAccountToken
# Expected: automountServiceAccountToken: false

kubectl get serviceaccount default -n apps -o yaml | grep automountServiceAccountToken
# Expected: automountServiceAccountToken: false
\`\`\``
      },
      {
        title: 'Update the Deployment to use the dedicated ServiceAccount',
        instruction: `Update the webapp Deployment to use webapp-sa instead of the default SA.

\`\`\`bash
# Update the deployment
kubectl patch deployment webapp -n apps --type='json' \
  -p='[{"op":"replace","path":"/spec/template/spec/serviceAccountName","value":"webapp-sa"}]'

# Or edit directly:
# kubectl edit deployment webapp -n apps
# Change: serviceAccountName: webapp-sa

# Wait for rollout
kubectl rollout status deployment/webapp -n apps

# Get new pod name
POD=$(kubectl get pods -n apps -l app=webapp -o jsonpath='{.items[0].metadata.name}')

# Verify token is NOT mounted (since webapp-sa has automount disabled)
kubectl exec $POD -n apps -- ls /var/run/secrets/kubernetes.io/serviceaccount/ 2>&1
\`\`\``,
        hints: [
          'The rollout creates a new pod — the old pod still has the token',
          'If the pod does not need API access, no token is the correct result'
        ],
        solution: `\`\`\`bash
kubectl set serviceaccount deployment/webapp webapp-sa -n apps
kubectl rollout status deployment/webapp -n apps
POD=$(kubectl get pods -n apps -l app=webapp -o jsonpath='{.items[0].metadata.name}')
kubectl exec $POD -n apps -- ls /var/run/secrets/kubernetes.io/serviceaccount/ 2>&1
\`\`\``,
        verify: `\`\`\`bash
# New pod should be using webapp-sa
POD=$(kubectl get pods -n apps -l app=webapp -o jsonpath='{.items[0].metadata.name}')
kubectl get pod $POD -n apps -o yaml | grep serviceAccountName
# Expected: serviceAccountName: webapp-sa

# Token should NOT be mounted (automount disabled)
kubectl exec $POD -n apps -- ls /var/run/secrets/kubernetes.io/serviceaccount/ 2>&1
# Expected: ls: /var/run/secrets/kubernetes.io/serviceaccount/: No such file or directory

kubectl get pod $POD -n apps -o yaml | grep automountServiceAccountToken
# Expected: automountServiceAccountToken: false (or inherited false from SA)
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Application fails to start after disabling ServiceAccount automount',
      difficulty: 'medium',
      symptom: 'After setting automountServiceAccountToken: false on the ServiceAccount, the application pod enters CrashLoopBackOff with "401 Unauthorized" errors.',
      diagnosis: `\`\`\`bash
# Check pod logs for auth errors
kubectl logs <pod-name> -n <namespace> | grep -E "401|Unauthorized|token|serviceaccount"

# Check if the app is trying to call the API
kubectl logs <pod-name> -n <namespace> | grep "kubernetes.default.svc"

# Check if a token volume exists
kubectl get pod <pod-name> -n <namespace> -o yaml | grep -A10 volumes | grep serviceAccountToken

# The app may be an operator or controller that legitimately needs API access
# Check what SA it was designed for
kubectl describe deployment <deployment-name> -n <namespace> | grep "Service Account"
\`\`\``,
      solution: `**The application legitimately needs API access.**

**Fix: Enable token mounting with proper RBAC instead of disabling automount.**

\`\`\`bash
# 1. Re-enable automounting on the SA (if the app truly needs it)
kubectl patch serviceaccount <sa-name> -n <namespace> \
  -p '{"automountServiceAccountToken": true}'

# OR enable on the pod/deployment only:
kubectl patch deployment <name> -n <namespace> --type=json \
  -p='[{"op":"add","path":"/spec/template/spec/automountServiceAccountToken","value":true}]'

# 2. Ensure proper RBAC (principle of least privilege)
kubectl auth can-i --list --as=system:serviceaccount:<namespace>:<sa-name> -n <namespace>
# Grant only what's actually needed

# Key insight: disabling automount is correct for apps that DON'T call the API
# For apps that DO call the API, proper RBAC is more important than disabling the token
\`\`\``
    },
    {
      title: 'Legacy application uses old Secret-based token that no longer exists (K8s 1.24+)',
      difficulty: 'medium',
      symptom: 'After upgrading to Kubernetes 1.24, a legacy application that reads its token from a Secret (not the projected volume) fails with "secret not found".',
      diagnosis: `\`\`\`bash
# Check if the old Secret exists
kubectl get secrets -n <namespace> | grep "<sa-name>-token"

# Check how the app reads the token (from a specific Secret reference)
kubectl get deployment <name> -n <namespace> -o yaml | grep -A5 "secretName"

# Check if the app uses env vars or volume mounts
kubectl get pod <pod-name> -n <namespace> -o yaml | grep -B2 -A5 "serviceAccountToken\|sa-token"
\`\`\``,
      solution: `**K8s 1.24 no longer auto-creates Secret-based tokens.**

**Option 1: Create the Secret manually (for legacy apps)**
\`\`\`yaml
apiVersion: v1
kind: Secret
metadata:
  name: myapp-sa-token
  namespace: <namespace>
  annotations:
    kubernetes.io/service-account.name: <sa-name>
type: kubernetes.io/service-account-token
\`\`\`

**Option 2: Update app to use projected volume token (preferred)**
- Read token from /var/run/secrets/kubernetes.io/serviceaccount/token
- This is the default mount path for bound tokens
- Most Kubernetes client libraries do this automatically

**Option 3: Create a temporary token**
\`\`\`bash
kubectl create token <sa-name> -n <namespace> --duration=8760h  # 1 year
# Store in a Secret the app can read (not recommended — but workable for legacy apps)
\`\`\``
    }
  ]
};
