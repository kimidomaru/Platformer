window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['istio-advanced/istio-security'] = {
  theory: `
# Security & mTLS in Istio

## Relevance
Security is the most critical pillar of a service mesh. Istio provides automatic mTLS between services, SPIFFE-based identity authentication, granular authorization, and JWT integration. Mastering PeerAuthentication, AuthorizationPolicy, and RequestAuthentication is essential for securing workloads in production.

## Core Concepts

### Identity in Istio — SPIFFE

Istio assigns SPIFFE (Secure Production Identity Framework for Everyone) identities to each workload:

\`\`\`
spiffe://<trust-domain>/ns/<namespace>/sa/<service-account>

Example:
spiffe://cluster.local/ns/production/sa/reviews
\`\`\`

Citadel (inside istiod) automatically issues X.509 certificates (SVIDs) for each sidecar. These certificates are used for mTLS between services.

### Automatic mTLS (Auto mTLS)

By default, Istio enables opportunistic mTLS:

\`\`\`
Sidecar <-> Sidecar: automatic mTLS
Sidecar <-> No sidecar: plaintext (fallback)
\`\`\`

### PeerAuthentication

Controls the mTLS policy for traffic between workloads:

\`\`\`yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: istio-system       # mesh-wide
spec:
  mtls:
    mode: STRICT                # requires mTLS across the entire mesh
\`\`\`

**Available modes:**

| Mode | Behavior |
|------|----------|
| STRICT | Accepts only mTLS (rejects plaintext) |
| PERMISSIVE | Accepts mTLS and plaintext (default, migration) |
| DISABLE | Disables mTLS |
| UNSET | Inherits from parent level |

**Granularity:**
\`\`\`yaml
# Namespace-level
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: production
spec:
  mtls:
    mode: STRICT
---
# Workload-level (per port)
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: reviews-policy
  namespace: production
spec:
  selector:
    matchLabels:
      app: reviews
  mtls:
    mode: STRICT
  portLevelMtls:
    8080:
      mode: PERMISSIVE          # specific port accepts plaintext
\`\`\`

### AuthorizationPolicy

Controls WHO can access WHICH service:

\`\`\`yaml
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: reviews-policy
  namespace: production
spec:
  selector:
    matchLabels:
      app: reviews
  action: ALLOW
  rules:
    - from:
        - source:
            principals: ["cluster.local/ns/production/sa/productpage"]
      to:
        - operation:
            methods: ["GET"]
            paths: ["/api/v1/reviews/*"]
\`\`\`

**Available actions:**

| Action | Behavior |
|--------|----------|
| ALLOW | Allows traffic matching the rules |
| DENY | Denies traffic matching the rules |
| CUSTOM | Delegates decision to external provider |
| AUDIT | Logs but does not block |

**Evaluation order:** CUSTOM -> DENY -> ALLOW -> deny-all (implicit default deny)

**Deny-all and Allow-all:**
\`\`\`yaml
# Deny-all for the namespace (zero-trust)
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: deny-all
  namespace: production
spec: {}                        # empty = deny everything
---
# Allow-all for the namespace
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: allow-all
  namespace: production
spec:
  rules:
    - {}                        # empty rule = allow everything
\`\`\`

### RequestAuthentication (JWT)

Validates JWT tokens on incoming traffic:

\`\`\`yaml
apiVersion: security.istio.io/v1beta1
kind: RequestAuthentication
metadata:
  name: jwt-auth
  namespace: production
spec:
  selector:
    matchLabels:
      app: reviews
  jwtRules:
    - issuer: "https://accounts.google.com"
      jwksUri: "https://www.googleapis.com/oauth2/v3/certs"
      forwardOriginalToken: true
    - issuer: "https://auth.example.com"
      jwks: |
        { "keys": [{ "kty": "RSA", ... }] }
\`\`\`

**Combining with AuthorizationPolicy:**
\`\`\`yaml
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: require-jwt
  namespace: production
spec:
  selector:
    matchLabels:
      app: reviews
  action: ALLOW
  rules:
    - from:
        - source:
            requestPrincipals: ["https://accounts.google.com/*"]
      when:
        - key: request.auth.claims[groups]
          values: ["admin", "editor"]
\`\`\`

### Common Mistakes

1. **STRICT mTLS without sidecar** — services without sidecar are blocked; use PERMISSIVE during migration
2. **Empty AuthorizationPolicy** — empty spec is an implicit deny-all
3. **JWT validation without AuthorizationPolicy** — RequestAuthentication alone does not block; needs AuthorizationPolicy to deny invalid tokens
4. **Case-sensitive principals** — SPIFFE identities are case-sensitive

## Killer.sh Style Challenge

> **Scenario:** Configure zero-trust in the production namespace: (1) STRICT mTLS, (2) default deny-all, (3) allow only productpage to access reviews via GET /api/v1/reviews, (4) require valid JWT from issuer auth.example.com for external access.
`,
  quiz: [
    {
      question: 'What identity format does Istio use to identify workloads?',
      options: [
        'Kubernetes UID',
        'SPIFFE (spiffe://trust-domain/ns/namespace/sa/service-account)',
        'Pod IP',
        'Deployment name'
      ],
      correct: 1,
      explanation: 'Istio uses SPIFFE IDs in the format spiffe://<trust-domain>/ns/<namespace>/sa/<service-account>. These IDs are encoded in X.509 certificates (SVIDs) automatically issued by Citadel.',
      reference: 'Related concept: The default trust-domain is cluster.local, configurable in mesh config.'
    },
    {
      question: 'What happens when PeerAuthentication is in STRICT mode and a service without a sidecar tries to communicate?',
      options: [
        'Communication works normally',
        'Traffic is automatically encrypted',
        'The connection is rejected because the service cannot present an mTLS certificate',
        'Istio injects a sidecar automatically'
      ],
      correct: 2,
      explanation: 'In STRICT mode, only mTLS connections are accepted. Services without an Envoy sidecar cannot present mTLS certificates and are rejected. Use PERMISSIVE during migration.',
      reference: 'Related concept: PERMISSIVE accepts both mTLS and plaintext, ideal for gradual migration.'
    },
    {
      question: 'What is the result of creating an AuthorizationPolicy with empty spec (spec: {})?',
      options: [
        'Allows all traffic',
        'Has no effect',
        'Denies all traffic for the selected scope',
        'Causes a validation error'
      ],
      correct: 2,
      explanation: 'An AuthorizationPolicy with empty spec (no rules) is interpreted as deny-all. No rules are evaluated, so no traffic is allowed. This is used to implement zero-trust.',
      reference: 'Related concept: An empty rule (rules: [{}]) has the opposite effect — allows everything.'
    },
    {
      question: 'What is the evaluation order of AuthorizationPolicies?',
      options: [
        'ALLOW -> DENY -> CUSTOM',
        'CUSTOM -> DENY -> ALLOW -> deny-by-default',
        'DENY -> ALLOW -> CUSTOM',
        'All are evaluated in parallel'
      ],
      correct: 1,
      explanation: 'The order is: CUSTOM first (external delegation), then DENY (deny if match), then ALLOW (allow if match). If no ALLOW matches and ALLOW policies exist, traffic is denied by default.',
      reference: 'Related concept: If no AuthorizationPolicy exists, all traffic is allowed.'
    },
    {
      question: 'Does RequestAuthentication alone block requests without JWT?',
      options: [
        'Yes, rejects automatically',
        'No, it only validates tokens when present; requests without tokens pass through',
        'Depends on TLS mode',
        'Yes, returns 401'
      ],
      correct: 1,
      explanation: 'RequestAuthentication only validates JWT tokens when present. Requests without tokens are accepted (unauthenticated). To block tokenless requests, combine with AuthorizationPolicy requiring requestPrincipals.',
      reference: 'Related concept: AuthorizationPolicy with source.requestPrincipals: ["*"] requires valid JWT.'
    },
    {
      question: 'How do you apply STRICT mTLS across the entire mesh?',
      options: [
        'Configure PeerAuthentication in each namespace',
        'Create PeerAuthentication with mode STRICT in the istio-system namespace',
        'Edit the Istio ConfigMap',
        'Use annotations on Pods'
      ],
      correct: 1,
      explanation: 'A PeerAuthentication in the istio-system namespace with mode STRICT applies mandatory mTLS across the entire mesh. More specific policies (namespace/workload) can override.',
      reference: 'Related concept: Hierarchy — mesh (istio-system) < namespace < workload.'
    },
    {
      question: 'Which field in AuthorizationPolicy allows filtering by JWT claims?',
      options: [
        'from.source.principals',
        'when.key with request.auth.claims[field]',
        'to.operation.headers',
        'from.source.jwtClaims'
      ],
      correct: 1,
      explanation: 'The when field with key request.auth.claims[field] allows filtering by specific JWT claims such as groups, roles, or email. This is combined with RequestAuthentication.',
      reference: 'Related concept: request.auth.presenter, request.auth.audiences can also be used.'
    }
  ],
  flashcards: [
    {
      front: 'What is SPIFFE and how does Istio use it?',
      back: '**SPIFFE** = Secure Production Identity Framework for Everyone\n\n**Format:** spiffe://trust-domain/ns/namespace/sa/service-account\n\n**In Istio:**\n- Citadel (istiod) issues X.509 certificates (SVIDs)\n- Each workload gets a unique identity\n- Certificates are rotated automatically\n- Used for mTLS between sidecars\n- Default trust domain: cluster.local'
    },
    {
      front: 'What are the PeerAuthentication modes?',
      back: '| Mode | Behavior |\n|------|----------|\n| **STRICT** | Accepts only mTLS |\n| **PERMISSIVE** | mTLS + plaintext (default) |\n| **DISABLE** | Disables mTLS |\n| **UNSET** | Inherits from parent level |\n\n**Hierarchy:** mesh (istio-system) < namespace < workload\n\n**Tip:** Use PERMISSIVE during migration, STRICT in production.'
    },
    {
      front: 'How to implement zero-trust with AuthorizationPolicy?',
      back: '1. **Deny-all for namespace:**\n\`\`\`yaml\nspec: {}\n\`\`\`\n\n2. **Explicit ALLOW per service:**\n\`\`\`yaml\nspec:\n  selector: {matchLabels: {app: X}}\n  action: ALLOW\n  rules:\n    - from: [{source: {principals: [...]}}]\n      to: [{operation: {methods: ["GET"]}}]\n\`\`\`\n\n3. **STRICT mTLS:**\nPeerAuthentication with mode: STRICT\n\nOrder: CUSTOM -> DENY -> ALLOW -> deny-by-default'
    },
    {
      front: 'How does RequestAuthentication work with JWT?',
      back: '**RequestAuthentication:**\n- Validates JWT tokens when present\n- Does NOT block requests without token\n- Configures issuer + jwksUri\n- Can have multiple jwtRules\n\n**To block tokenless requests:**\nCombine with AuthorizationPolicy:\n\`\`\`yaml\nrules:\n  - from:\n      - source:\n          requestPrincipals: ["*"]\n\`\`\`\n\nThis requires valid JWT on every request.'
    },
    {
      front: 'What is the difference between principals and requestPrincipals?',
      back: '**principals:**\n- mTLS identity (SPIFFE ID)\n- Comes from X.509 certificate\n- Format: cluster.local/ns/X/sa/Y\n- Peer-to-peer authentication\n\n**requestPrincipals:**\n- JWT identity\n- Format: issuer/subject\n- Ex: accounts.google.com/user123\n- End-user authentication\n\nBoth can be used in the same AuthorizationPolicy.'
    },
    {
      front: 'How does automatic mTLS work in Istio?',
      back: '**Auto mTLS (default):**\n- Istio detects if destination has sidecar\n- With sidecar: sends mTLS automatically\n- Without sidecar: sends plaintext\n- No manual configuration needed\n\n**To enforce mTLS:**\n- PeerAuthentication with mode: STRICT\n- DestinationRule with tls.mode: ISTIO_MUTUAL\n\n**Certificate rotation:**\n- SDS certificates rotated automatically\n- Default TTL: 24 hours\n- Configurable via pilot-agent'
    },
    {
      front: 'What actions are available in AuthorizationPolicy?',
      back: '| Action | Usage |\n|--------|-------|\n| **ALLOW** | Allows matching traffic |\n| **DENY** | Denies matching traffic |\n| **CUSTOM** | Delegates to external provider (OPA, ext-authz) |\n| **AUDIT** | Logs, does not block |\n\n**Order:** CUSTOM -> DENY -> ALLOW\n\n**No policy:** everything is allowed\n**With ALLOW policy:** deny-by-default for non-matches'
    }
  ],
  lab: {
    scenario: 'You need to implement zero-trust security in the production namespace: mandatory mTLS, granular authorization, and JWT validation.',
    objective: 'Configure STRICT PeerAuthentication, deny-all AuthorizationPolicy with exceptions, and RequestAuthentication with JWT.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Configure STRICT mTLS',
        instruction: `Enable mandatory mTLS for the production namespace and verify that plaintext communication is rejected.

\`\`\`bash
# Create namespace with injection
kubectl create namespace production
kubectl label namespace production istio-injection=enabled

# Deploy test services
kubectl apply -n production -f https://raw.githubusercontent.com/istio/istio/release-1.20/samples/bookinfo/platform/kube/bookinfo.yaml

# Apply STRICT mTLS to namespace
kubectl apply -f - <<EOF
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: production
spec:
  mtls:
    mode: STRICT
EOF

# Test: request from Pod WITH sidecar (should work)
kubectl exec -n production deploy/productpage-v1 -c productpage -- curl -s http://reviews:9080/reviews/1 -o /dev/null -w "%{http_code}"

# Test: request from Pod WITHOUT sidecar (should fail)
kubectl run test-nosidecar -n production --image=curlimages/curl --restart=Never --command -- sleep 3600
# Wait for Pod to be ready (no sidecar since injection did not apply)
kubectl exec -n production test-nosidecar -- curl -s http://reviews:9080/reviews/1 -o /dev/null -w "%{http_code}"
# Expected: fail with connection reset
\`\`\``,
        hints: [
          'PeerAuthentication in a namespace applies only to that namespace',
          'STRICT rejects any connection that does not present a valid mTLS certificate',
          'Use istioctl authn tls-check to verify mTLS status'
        ],
        solution: `\`\`\`bash
kubectl create namespace production
kubectl label namespace production istio-injection=enabled
kubectl apply -n production -f https://raw.githubusercontent.com/istio/istio/release-1.20/samples/bookinfo/platform/kube/bookinfo.yaml
kubectl apply -f peer-auth-strict.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verify PeerAuthentication
kubectl get peerauthentication -n production
# Expected output: default   STRICT   Xs

# Verify mTLS between services
istioctl proxy-config clusters deploy/productpage-v1 -n production | grep reviews
# Expected output: reviews.production.svc.cluster.local with ISTIO_MUTUAL

# Verify certificate
istioctl proxy-config secret deploy/productpage-v1 -n production
# Expected output: ROOTCA and default certificates with valid dates
\`\`\``
      },
      {
        title: 'Implement Zero-Trust with AuthorizationPolicy',
        instruction: `Configure default deny-all and create explicit access rules between services.

\`\`\`bash
# Deny-all in production namespace
kubectl apply -f - <<EOF
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: deny-all
  namespace: production
spec: {}
EOF

# Test: all requests should be denied
kubectl exec -n production deploy/productpage-v1 -c productpage -- curl -s http://reviews:9080/reviews/1 -o /dev/null -w "%{http_code}"
# Expected: 403

# Allow productpage -> reviews (GET)
kubectl apply -f - <<EOF
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: allow-productpage-reviews
  namespace: production
spec:
  selector:
    matchLabels:
      app: reviews
  action: ALLOW
  rules:
    - from:
        - source:
            principals: ["cluster.local/ns/production/sa/bookinfo-productpage"]
      to:
        - operation:
            methods: ["GET"]
---
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: allow-productpage-details
  namespace: production
spec:
  selector:
    matchLabels:
      app: details
  action: ALLOW
  rules:
    - from:
        - source:
            principals: ["cluster.local/ns/production/sa/bookinfo-productpage"]
      to:
        - operation:
            methods: ["GET"]
---
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: allow-reviews-ratings
  namespace: production
spec:
  selector:
    matchLabels:
      app: ratings
  action: ALLOW
  rules:
    - from:
        - source:
            principals: ["cluster.local/ns/production/sa/bookinfo-reviews"]
      to:
        - operation:
            methods: ["GET"]
EOF
\`\`\``,
        hints: [
          'spec: {} without rules creates an implicit deny-all',
          'principals uses the SPIFFE ID: cluster.local/ns/<ns>/sa/<sa>',
          'Each service needs its own ALLOW AuthorizationPolicy'
        ],
        solution: `\`\`\`bash
kubectl apply -f deny-all.yaml
kubectl apply -f allow-policies.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verify AuthorizationPolicies
kubectl get authorizationpolicies -n production
# Expected output: deny-all, allow-productpage-reviews, allow-productpage-details, allow-reviews-ratings

# Test productpage -> reviews (should work)
kubectl exec -n production deploy/productpage-v1 -c productpage -- curl -s http://reviews:9080/reviews/1 -o /dev/null -w "%{http_code}"
# Expected output: 200

# Test unauthorized access (should be denied)
kubectl exec -n production deploy/ratings-v1 -c ratings -- curl -s http://reviews:9080/reviews/1 -o /dev/null -w "%{http_code}"
# Expected output: 403
\`\`\``
      },
      {
        title: 'Configure JWT Authentication',
        instruction: `Configure RequestAuthentication to validate JWT tokens and combine with AuthorizationPolicy to control access.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: security.istio.io/v1beta1
kind: RequestAuthentication
metadata:
  name: jwt-auth
  namespace: production
spec:
  selector:
    matchLabels:
      app: productpage
  jwtRules:
    - issuer: "testing@secure.istio.io"
      jwksUri: "https://raw.githubusercontent.com/istio/istio/release-1.20/security/tools/jwt/samples/jwks.json"
---
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: require-jwt-productpage
  namespace: production
spec:
  selector:
    matchLabels:
      app: productpage
  action: ALLOW
  rules:
    - from:
        - source:
            requestPrincipals: ["testing@secure.istio.io/testing@secure.istio.io"]
EOF

# Test without token (should be denied)
INGRESS_IP=\$(kubectl get svc istio-ingressgateway -n istio-system -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
curl -s -o /dev/null -w "%{http_code}" http://\$INGRESS_IP/productpage
# Expected: 403

# Test with valid token
TOKEN=\$(curl -s https://raw.githubusercontent.com/istio/istio/release-1.20/security/tools/jwt/samples/demo.jwt)
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer \$TOKEN" http://\$INGRESS_IP/productpage
# Expected: 200
\`\`\``,
        hints: [
          'RequestAuthentication alone does NOT block requests without token',
          'AuthorizationPolicy with requestPrincipals: ["*"] requires valid JWT',
          'The issuer and subject of JWT form the requestPrincipal: issuer/subject'
        ],
        solution: `\`\`\`bash
kubectl apply -f jwt-auth-setup.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verify RequestAuthentication
kubectl get requestauthentication -n production
# Expected output: jwt-auth   Xs

# Verify AuthorizationPolicy
kubectl get authorizationpolicies require-jwt-productpage -n production
# Expected output: require-jwt-productpage   Xs

# Test without token (should fail)
curl -s -o /dev/null -w "%{http_code}" http://\$INGRESS_IP/productpage
# Expected output: 403

# Test with valid token
TOKEN=\$(curl -s https://raw.githubusercontent.com/istio/istio/release-1.20/security/tools/jwt/samples/demo.jwt)
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer \$TOKEN" http://\$INGRESS_IP/productpage
# Expected output: 200
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Services return 503 after enabling STRICT mTLS',
      difficulty: 'medium',
      symptom: 'After configuring STRICT PeerAuthentication, some service-to-service communications fail with 503 Service Unavailable.',
      diagnosis: `\`\`\`bash
# Check which Pods have sidecar
kubectl get pods -n production -o jsonpath='{range .items[*]}{.metadata.name}{" containers="}{range .spec.containers[*]}{.name}{","}{end}{"\\n"}{end}'

# Check PeerAuthentication
kubectl get peerauthentication --all-namespaces

# Check mTLS status
istioctl proxy-config clusters deploy/<app> -n production | grep <target-service>

# Check proxy logs
kubectl logs <pod> -c istio-proxy -n production | grep -i "TLS\\|reject\\|503"
\`\`\``,
      solution: `**Causes and solutions:**

1. **Service without sidecar:** Verify that all Pods in the namespace have the istio-proxy container. Pods without sidecar cannot present mTLS certificates.
\`\`\`bash
# Check injection
kubectl get namespace production --show-labels | grep injection
\`\`\`

2. **DestinationRule with conflicting tls.mode:** If a DestinationRule exists with tls.mode: DISABLE, it overrides automatic mTLS.

3. **Services in other namespaces:** If the target service is in another namespace without STRICT, mTLS may fail. Apply PeerAuthentication consistently.

4. **Gradual migration:** Use PERMISSIVE first, verify everything works with mTLS, then switch to STRICT.`
    },
    {
      title: 'AuthorizationPolicy blocking traffic that should be allowed',
      difficulty: 'medium',
      symptom: 'Configured ALLOW AuthorizationPolicy but traffic continues to be denied with 403 RBAC access denied.',
      diagnosis: `\`\`\`bash
# List all AuthorizationPolicies
kubectl get authorizationpolicies -n production -o yaml

# Check if deny-all exists
kubectl get authorizationpolicies -n production -o jsonpath='{range .items[*]}{.metadata.name}{" action="}{.spec.action}{" rules="}{.spec.rules}{"\\n"}{end}'

# Verify source service identity
kubectl exec <source-pod> -c istio-proxy -n production -- pilot-agent request GET /certs | head -20

# Check destination proxy logs
kubectl logs <dest-pod> -c istio-proxy -n production | grep "rbac"
\`\`\``,
      solution: `**Common causes:**

1. **Wrong principal:** Verify the exact SPIFFE ID of the source service. Use \`istioctl proxy-config secret\` to view the certificate.

2. **Wrong ServiceAccount:** The principal uses the Pod's ServiceAccount, not the Deployment name. Verify with \`kubectl get pod -o jsonpath='{.spec.serviceAccountName}'\`.

3. **Namespace in principal:** Include the full namespace: \`cluster.local/ns/production/sa/myapp\`.

4. **Deny-all without exception:** If a deny-all exists, each service needs its own explicit ALLOW.

5. **Wrong HTTP method:** If the policy allows GET but the app sends POST, traffic is denied.`
    },
    {
      title: 'JWT validation fails with valid token',
      difficulty: 'hard',
      symptom: 'Configured RequestAuthentication but valid JWT tokens are rejected with 401 Jwt verification fails.',
      diagnosis: `\`\`\`bash
# Check RequestAuthentication
kubectl get requestauthentication -n production -o yaml

# Decode JWT to verify issuer/audience
echo \$TOKEN | cut -d'.' -f2 | base64 -d 2>/dev/null | python3 -m json.tool

# Check if jwksUri is accessible
kubectl exec deploy/<app> -c istio-proxy -n production -- curl -s <jwksUri>

# Check proxy logs
kubectl logs <pod> -c istio-proxy -n production | grep -i "jwt\\|401\\|authn"

# Check listener configuration
istioctl proxy-config listeners <pod> -n production -o json | grep -A5 "jwt"
\`\`\``,
      solution: `**Causes and solutions:**

1. **Issuer mismatch:** The issuer field in RequestAuthentication must exactly match the "iss" claim in the JWT.

2. **Unreachable jwksUri:** If the proxy cannot access the JWKS endpoint, validation fails. Check ServiceEntry if needed.

3. **Expired token:** Check the "exp" claim in the JWT. Expired tokens are rejected.

4. **Wrong audience:** If you configured audiences in RequestAuthentication, the JWT "aud" claim must match.

5. **Clock skew:** If the Pod has a desynchronized clock, tokens may be rejected prematurely. Check with \`date\` in the container.`
    }
  ]
};
