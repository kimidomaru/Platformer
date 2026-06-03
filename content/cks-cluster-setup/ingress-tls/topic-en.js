window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['cks-cluster-setup/ingress-tls'] = {
  theory: `# Ingress TLS Configuration

## Exam Relevance
> CKS exam requires you to configure TLS for Ingress resources, manage TLS secrets, and understand certificate workflows. Appears in Cluster Setup domain (~10% of exam).

## Why TLS on Ingress?

Without TLS, HTTP traffic between clients and the cluster is transmitted in plaintext — credentials, tokens, and sensitive data are exposed to network sniffing. Ingress TLS terminates HTTPS at the edge, encrypting client-to-cluster traffic.

\`\`\`
Client ──HTTPS──► Ingress Controller ──HTTP──► Service ──► Pod
         (TLS terminated here)     (optional mTLS internally)
\`\`\`

## TLS Secret Format

Kubernetes requires TLS certificates and keys to be stored as a Secret of type **kubernetes.io/tls**:

\`\`\`yaml
apiVersion: v1
kind: Secret
metadata:
  name: my-tls-secret
  namespace: default
type: kubernetes.io/tls
data:
  tls.crt: <base64-encoded-certificate>   # PEM format
  tls.key: <base64-encoded-private-key>   # PEM format
\`\`\`

The keys **must** be named \`tls.crt\` and \`tls.key\` — other names will cause errors.

## Creating TLS Secrets

### From existing certificate files

\`\`\`bash
# Create from PEM files
kubectl create secret tls my-tls-secret \
  --cert=path/to/cert.pem \
  --key=path/to/key.pem \
  --namespace=default

# Verify
kubectl get secret my-tls-secret -o yaml
kubectl describe secret my-tls-secret
\`\`\`

### Generate a self-signed certificate (exam use)

\`\`\`bash
# Generate private key
openssl genrsa -out tls.key 2048

# Generate self-signed certificate
openssl req -new -x509 -key tls.key -out tls.crt -days 365 \
  -subj "/CN=myapp.example.com/O=MyOrg"

# Create the Secret
kubectl create secret tls myapp-tls \
  --cert=tls.crt \
  --key=tls.key

# Or: generate key + CSR + sign in one step
openssl req -x509 -newkey rsa:2048 -keyout tls.key -out tls.crt \
  -days 365 -nodes -subj "/CN=myapp.example.com"
\`\`\`

### Using cert-manager (production)

\`\`\`yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: myapp-cert
  namespace: default
spec:
  secretName: myapp-tls        # cert-manager creates this Secret
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
  - myapp.example.com
  - www.myapp.example.com
\`\`\`

## Ingress TLS Configuration

### Basic TLS Ingress

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp-ingress
  namespace: default
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"   # force HTTPS
spec:
  tls:
  - hosts:
    - myapp.example.com
    secretName: myapp-tls          # must exist in same namespace
  rules:
  - host: myapp.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: myapp-service
            port:
              number: 80
\`\`\`

### Key Rules

1. **Namespace**: The TLS Secret must be in the **same namespace** as the Ingress
2. **Secret type**: Must be \`kubernetes.io/tls\` — generic Secrets won't work
3. **Key names**: Must be \`tls.crt\` and \`tls.key\` exactly
4. **Host match**: The host in \`spec.tls[].hosts\` should match \`spec.rules[].host\`
5. **CN/SAN**: The certificate's CN or SAN must match the hostname

### Multiple Domains (SNI)

\`\`\`yaml
spec:
  tls:
  - hosts:
    - app1.example.com
    secretName: app1-tls
  - hosts:
    - app2.example.com
    secretName: app2-tls
  rules:
  - host: app1.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: app1-service
            port:
              number: 80
  - host: app2.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: app2-service
            port:
              number: 80
\`\`\`

## TLS Passthrough

Some Ingress controllers support TLS passthrough — forwarding encrypted traffic directly to the backend without termination:

\`\`\`yaml
# nginx ingress TLS passthrough
metadata:
  annotations:
    nginx.ingress.kubernetes.io/ssl-passthrough: "true"
\`\`\`

Use when: the backend must handle TLS itself (e.g., for mTLS or certificate pinning).

## HTTP to HTTPS Redirect

\`\`\`yaml
# nginx ingress
metadata:
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
\`\`\`

Or via a separate HTTP Ingress that redirects:
\`\`\`yaml
metadata:
  annotations:
    nginx.ingress.kubernetes.io/permanent-redirect: "https://myapp.example.com$request_uri"
\`\`\`

## Inspecting TLS Certificates

\`\`\`bash
# Inspect certificate in a Secret
kubectl get secret myapp-tls -o jsonpath='{.data.tls\\.crt}' | base64 -d | openssl x509 -text -noout

# Check expiry
kubectl get secret myapp-tls -o jsonpath='{.data.tls\\.crt}' | base64 -d | openssl x509 -noout -dates

# Verify from outside the cluster
echo | openssl s_client -connect myapp.example.com:443 -servername myapp.example.com 2>/dev/null | openssl x509 -text -noout

# Verify with curl (ignore cert errors for self-signed)
curl -k https://myapp.example.com/
curl --cacert ca.crt https://myapp.example.com/
\`\`\`

## Kubernetes API Server TLS

The API server itself uses TLS certificates you should understand for CKS:

\`\`\`bash
# API server cert files
/etc/kubernetes/pki/apiserver.crt         # API server serving cert
/etc/kubernetes/pki/apiserver.key         # API server private key
/etc/kubernetes/pki/ca.crt                # Cluster CA
/etc/kubernetes/pki/apiserver-kubelet-client.crt  # kubelet client cert
/etc/kubernetes/pki/apiserver-etcd-client.crt     # etcd client cert
/etc/kubernetes/pki/etcd/server.crt       # etcd server cert
/etc/kubernetes/pki/etcd/ca.crt           # etcd CA

# Inspect cluster CA
openssl x509 -in /etc/kubernetes/pki/ca.crt -text -noout | grep -E "Subject:|Not After"

# Check all cert expiry at once
kubeadm certs check-expiration
\`\`\`

## Common Mistakes

- **Wrong Secret type**: Creating a generic Secret instead of type \`kubernetes.io/tls\`
- **Wrong key names**: Using \`certificate\` instead of \`tls.crt\`
- **Namespace mismatch**: TLS Secret must be in the same namespace as the Ingress
- **CN mismatch**: Certificate CN doesn't match the hostname in the Ingress rule
- **Missing SAN**: Modern browsers require Subject Alternative Names, not just CN

## Killer.sh Style Challenge

> **Scenario**: Create a TLS Ingress for the \`webapp\` Service in namespace \`web\` on hostname \`webapp.k8s.local\`. Generate a self-signed certificate and configure the Ingress to force HTTPS.
`,

  quiz: [
    {
      question: 'A TLS Secret for Ingress must have data keys named:',
      options: [
        'tls.crt and tls.key',
        'certificate.pem and private.key',
        'cert and key',
        'server.crt and server.key'
      ],
      correct: 0,
      explanation: 'Kubernetes Ingress TLS requires the Secret data keys to be named exactly "tls.crt" (for the certificate) and "tls.key" (for the private key). Any other names will cause the Ingress controller to fail loading the certificate.',
      reference: 'Ingress TLS — TLS Secret Format section.'
    },
    {
      question: 'What Secret type is required for Ingress TLS?',
      options: [
        'kubernetes.io/tls',
        'Opaque',
        'kubernetes.io/ssl',
        'kubernetes.io/certificate'
      ],
      correct: 0,
      explanation: 'Ingress TLS requires a Secret of type kubernetes.io/tls. Using type Opaque with the same data keys might work with some controllers but is not standard and not guaranteed.',
      reference: 'Ingress TLS — TLS Secret Format section.'
    },
    {
      question: 'An Ingress is in namespace "production" and references TLS Secret "app-tls". Where must the Secret exist?',
      options: [
        'In the "production" namespace',
        'In the "default" namespace',
        'In the "kube-system" namespace',
        'In any namespace — Ingress can reference cross-namespace secrets'
      ],
      correct: 0,
      explanation: 'TLS Secrets referenced by an Ingress must exist in the same namespace as the Ingress. Cross-namespace Secret references are not supported for Ingress TLS.',
      reference: 'Ingress TLS — Key Rules section.'
    },
    {
      question: 'Which openssl command generates a self-signed certificate and private key in one step for exam use?',
      options: [
        'openssl req -x509 -newkey rsa:2048 -keyout tls.key -out tls.crt -days 365 -nodes -subj "/CN=myapp.example.com"',
        'openssl genrsa -out tls.key && openssl x509 -in tls.key -out tls.crt',
        'openssl create-cert --host myapp.example.com --out tls.crt --key tls.key',
        'openssl pkcs12 -export -out tls.crt -inkey tls.key'
      ],
      correct: 0,
      explanation: 'The openssl req -x509 -newkey command creates both the private key (-keyout) and self-signed certificate (-out) in one step. -nodes means "no DES encryption" (no passphrase on the key). -subj sets the certificate subject.',
      reference: 'Ingress TLS — Creating TLS Secrets section.'
    },
    {
      question: 'How do you force HTTP to HTTPS redirect in an nginx Ingress?',
      options: [
        'Add annotation: nginx.ingress.kubernetes.io/ssl-redirect: "true"',
        'Add annotation: nginx.ingress.kubernetes.io/tls-redirect: "true"',
        'Set spec.tls.forceRedirect: true in the Ingress spec',
        'Create a separate Ingress with rewriteTarget: https'
      ],
      correct: 0,
      explanation: 'The nginx.ingress.kubernetes.io/ssl-redirect: "true" annotation instructs the nginx Ingress controller to redirect HTTP requests to HTTPS. Use force-ssl-redirect for stricter enforcement even behind load balancers.',
      reference: 'Ingress TLS — HTTP to HTTPS Redirect section.'
    },
    {
      question: 'How do you check the expiry date of a certificate stored in a Kubernetes Secret?',
      options: [
        'kubectl get secret my-tls -o jsonpath=\'{.data.tls\\.crt}\' | base64 -d | openssl x509 -noout -dates',
        'kubectl describe secret my-tls | grep expiry',
        'kubectl cert check my-tls --expiry',
        'openssl verify my-tls-secret'
      ],
      correct: 0,
      explanation: 'The certificate in a TLS Secret is base64-encoded in the data field. Extract it with kubectl get secret -o jsonpath, decode with base64 -d, then pass to openssl x509 -noout -dates to see the validity period.',
      reference: 'Ingress TLS — Inspecting TLS Certificates section.'
    },
    {
      question: 'What does TLS passthrough mean in an Ingress controller?',
      options: [
        'Encrypted traffic is forwarded directly to the backend without TLS termination at the Ingress',
        'The Ingress forwards TLS certificate information as HTTP headers to the backend',
        'All traffic bypasses TLS entirely for performance',
        'The backend downloads its TLS certificate from the Ingress controller'
      ],
      correct: 0,
      explanation: 'TLS passthrough means the Ingress controller forwards the raw TLS stream to the backend without decrypting it. The backend handles TLS termination itself. This is used when the backend needs end-to-end TLS or certificate pinning.',
      reference: 'Ingress TLS — TLS Passthrough section.'
    },
    {
      question: 'Which command checks certificate expiry for all cluster components at once?',
      options: [
        'kubeadm certs check-expiration',
        'kubectl get certs --all-namespaces',
        'openssl verify /etc/kubernetes/pki/*.crt',
        'kube-bench run --check certs'
      ],
      correct: 0,
      explanation: 'kubeadm certs check-expiration shows the expiry dates of all certificates managed by kubeadm, including the API server cert, etcd cert, controller-manager cert, and the kubeconfig certs.',
      reference: 'Ingress TLS — Kubernetes API Server TLS section.'
    }
  ],

  flashcards: [
    {
      front: 'What are the required fields for a kubernetes.io/tls Secret?',
      back: 'type: kubernetes.io/tls\ndata:\n  tls.crt: <base64-encoded certificate>\n  tls.key: <base64-encoded private key>\n\nKey names must be EXACTLY "tls.crt" and "tls.key"\nCreate with: kubectl create secret tls <name> --cert=cert.pem --key=key.pem'
    },
    {
      front: 'What is the one-line command to create a self-signed TLS cert + key for exam use?',
      back: 'openssl req -x509 -newkey rsa:2048 \\\n  -keyout tls.key \\\n  -out tls.crt \\\n  -days 365 \\\n  -nodes \\\n  -subj "/CN=hostname.example.com"\n\n-x509: self-signed\n-nodes: no passphrase\n-subj: certificate subject (avoid interactive prompt)'
    },
    {
      front: 'How does Ingress TLS work? Where must the Secret be?',
      back: 'In the Ingress spec:\nspec:\n  tls:\n  - hosts:\n    - myapp.example.com\n    secretName: myapp-tls    ← same namespace as Ingress!\n  rules:\n  - host: myapp.example.com\n    ...\n\nRules:\n- Secret must be in SAME namespace as Ingress\n- Secret type must be kubernetes.io/tls\n- Cert CN/SAN must match the hostname'
    },
    {
      front: 'How do you inspect a TLS certificate stored in a Kubernetes Secret?',
      back: 'kubectl get secret myapp-tls -o jsonpath=\'{.data.tls\\.crt}\' | base64 -d | openssl x509 -text -noout\n\nJust expiry:\n... | openssl x509 -noout -dates\n\nFrom outside cluster:\nopenssl s_client -connect host:443 -servername host 2>/dev/null | openssl x509 -noout -dates'
    },
    {
      front: 'What is cert-manager and what Kubernetes resource does it create?',
      back: 'cert-manager is a Kubernetes add-on that automates TLS certificate management.\n\nKey resources:\n- Issuer / ClusterIssuer — defines certificate authority (ACME/Let\'s Encrypt, self-signed, Vault)\n- Certificate — defines desired cert, cert-manager creates/renews it\n- Secret — cert-manager creates a kubernetes.io/tls Secret with the obtained certificate\n\nUsed with Ingress via annotations or Certificate CRD'
    },
    {
      front: 'What annotation forces HTTP→HTTPS redirect in nginx Ingress?',
      back: 'nginx.ingress.kubernetes.io/ssl-redirect: "true"\n\nFor stricter enforcement (even if X-Forwarded-Proto says http):\nnginx.ingress.kubernetes.io/force-ssl-redirect: "true"\n\nAdded to Ingress metadata.annotations'
    },
    {
      front: 'What is the difference between TLS termination and TLS passthrough?',
      back: 'TLS Termination (default):\n- Ingress controller decrypts HTTPS\n- Forwards plain HTTP to backend\n- Ingress controller needs the certificate\n\nTLS Passthrough:\n- Encrypted stream forwarded directly to backend\n- Backend handles TLS termination\n- annotation: nginx.ingress.kubernetes.io/ssl-passthrough: "true"\n- Use for: mTLS between client and backend, certificate pinning'
    },
    {
      front: 'Which kubeadm command checks when cluster certificates expire?',
      back: 'kubeadm certs check-expiration\n\nShows:\n- CERTIFICATE name\n- EXPIRES date\n- RESIDUAL TIME remaining\n- CERTIFICATE AUTHORITY name\n- EXTERNALLY MANAGED (if managed outside kubeadm)\n\nRenew all: kubeadm certs renew all\nRenew specific: kubeadm certs renew apiserver'
    }
  ],

  lab: {
    scenario: 'The webapp application in the "web" namespace is accessible via HTTP. Configure TLS for its Ingress using a self-signed certificate, and ensure HTTP traffic is redirected to HTTPS.',
    objective: 'Generate a TLS certificate, create a kubernetes.io/tls Secret, configure an Ingress with TLS, and verify HTTPS connectivity.',
    duration: '20-30 minutes',
    steps: [
      {
        title: 'Create the namespace and deploy a test application',
        instruction: `Set up the test environment with a simple web application.

\`\`\`bash
# Create namespace
kubectl create namespace web

# Deploy a simple web app
kubectl create deployment webapp --image=nginx:alpine --namespace=web
kubectl expose deployment webapp --port=80 --namespace=web

# Verify
kubectl get all -n web
\`\`\``,
        hints: [
          'The nginx image serves a default page on port 80 — perfect for testing',
          'The Service will be the backend for the Ingress'
        ],
        solution: `\`\`\`bash
kubectl create namespace web
kubectl create deployment webapp --image=nginx:alpine --namespace=web
kubectl expose deployment webapp --port=80 --namespace=web
kubectl wait --for=condition=available deployment/webapp -n web --timeout=60s
\`\`\``,
        verify: `\`\`\`bash
kubectl get deployment webapp -n web
# Expected: READY 1/1

kubectl get svc webapp -n web
# Expected: webapp   ClusterIP   <IP>   <none>   80/TCP
\`\`\``
      },
      {
        title: 'Generate a self-signed TLS certificate',
        instruction: `Create a TLS certificate for the hostname "webapp.k8s.local".

\`\`\`bash
# Generate key + self-signed cert in one command
openssl req -x509 -newkey rsa:2048 \
  -keyout tls.key \
  -out tls.crt \
  -days 365 \
  -nodes \
  -subj "/CN=webapp.k8s.local/O=KubeAstronaut"

# Verify the certificate
openssl x509 -in tls.crt -text -noout | grep -E "Subject:|Not After"

# Create the TLS Secret in the "web" namespace
kubectl create secret tls webapp-tls \
  --cert=tls.crt \
  --key=tls.key \
  --namespace=web
\`\`\``,
        hints: [
          '-nodes means "no DES" — the key will not be password-protected',
          'The CN must match the hostname in the Ingress rule',
          'The Secret must be in the same namespace as the Ingress (web)'
        ],
        solution: `\`\`\`bash
openssl req -x509 -newkey rsa:2048 -keyout tls.key -out tls.crt -days 365 -nodes -subj "/CN=webapp.k8s.local"
kubectl create secret tls webapp-tls --cert=tls.crt --key=tls.key --namespace=web
\`\`\``,
        verify: `\`\`\`bash
kubectl get secret webapp-tls -n web
# Expected: webapp-tls   kubernetes.io/tls   2      <time>

kubectl get secret webapp-tls -n web -o yaml | grep "type:"
# Expected: type: kubernetes.io/tls

kubectl get secret webapp-tls -n web -o jsonpath='{.data.tls\\.crt}' | base64 -d | openssl x509 -noout -subject
# Expected: subject=CN=webapp.k8s.local
\`\`\``
      },
      {
        title: 'Create the TLS Ingress',
        instruction: `Create an Ingress resource that uses the TLS Secret and redirects HTTP to HTTPS.

\`\`\`yaml
# webapp-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: webapp-ingress
  namespace: web
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - webapp.k8s.local
    secretName: webapp-tls
  rules:
  - host: webapp.k8s.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: webapp
            port:
              number: 80
\`\`\`

\`\`\`bash
kubectl apply -f webapp-ingress.yaml
kubectl describe ingress webapp-ingress -n web
\`\`\``,
        hints: [
          'If using a different ingress controller (Traefik, HAProxy), the annotation key will differ',
          'Ensure the secretName matches exactly the Secret you created',
          'The host in tls.hosts and rules.host should match'
        ],
        solution: `\`\`\`bash
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: webapp-ingress
  namespace: web
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - webapp.k8s.local
    secretName: webapp-tls
  rules:
  - host: webapp.k8s.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: webapp
            port:
              number: 80
EOF
\`\`\``,
        verify: `\`\`\`bash
kubectl get ingress webapp-ingress -n web
# Expected: webapp-ingress   webapp.k8s.local   <IP>   80, 443   <time>

kubectl describe ingress webapp-ingress -n web | grep -E "TLS:|Host:|Rules:"
# Expected:
# TLS:
#   webapp-tls terminates webapp.k8s.local

# Test HTTPS (add to /etc/hosts if needed: <ingress-ip> webapp.k8s.local)
curl -k https://webapp.k8s.local
# Expected: nginx default page HTML
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Ingress shows no address and HTTPS returns 404',
      difficulty: 'medium',
      symptom: 'kubectl get ingress shows no ADDRESS, and accessing the hostname returns connection refused or 404.',
      diagnosis: `\`\`\`bash
# Check if an Ingress controller is installed
kubectl get pods -A | grep -i ingress

# Check Ingress class
kubectl get ingressclass
kubectl describe ingress webapp-ingress -n web | grep "Ingress Class"

# Check for events on the Ingress
kubectl describe ingress webapp-ingress -n web | grep -A10 Events

# Check Ingress controller logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx --tail=20

# Check if the Secret exists in the correct namespace
kubectl get secret webapp-tls -n web
\`\`\``,
      solution: `**Root causes and fixes:**

**1. No Ingress controller installed:**
- Install nginx ingress: kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml
- Verify: kubectl get pods -n ingress-nginx

**2. Missing IngressClass:**
\`\`\`bash
# Check available classes
kubectl get ingressclass

# Add class to Ingress
kubectl patch ingress webapp-ingress -n web --type=json \
  -p='[{"op":"add","path":"/spec/ingressClassName","value":"nginx"}]'
\`\`\`

**3. Secret in wrong namespace:**
\`\`\`bash
# Move secret to correct namespace
kubectl get secret webapp-tls -n default -o yaml | \
  sed 's/namespace: default/namespace: web/' | \
  kubectl apply -f -
\`\`\`

**4. Certificate CN mismatch:**
- Check: openssl x509 -in tls.crt -noout -subject
- Regenerate with correct CN matching the Ingress host`
    },
    {
      title: 'TLS Secret creation fails with "certificate data missing"',
      difficulty: 'easy',
      symptom: 'Running kubectl create secret tls returns an error about missing certificate data or invalid format.',
      diagnosis: `\`\`\`bash
# Verify the cert file is valid PEM
openssl x509 -in tls.crt -text -noout

# Verify the key file is valid PEM
openssl rsa -in tls.key -check

# Verify cert and key match (fingerprints must match)
openssl x509 -noout -modulus -in tls.crt | openssl md5
openssl rsa -noout -modulus -in tls.key | openssl md5

# Check file encoding (must be PEM, not DER)
file tls.crt
head -1 tls.crt  # should be: -----BEGIN CERTIFICATE-----
\`\`\``,
      solution: `**Common issues:**

**1. DER format instead of PEM:**
\`\`\`bash
# Convert DER to PEM
openssl x509 -inform DER -in cert.der -out tls.crt
openssl rsa -inform DER -in key.der -out tls.key
\`\`\`

**2. PKCS12 format (.pfx/.p12):**
\`\`\`bash
# Extract cert and key from PKCS12
openssl pkcs12 -in cert.pfx -nokeys -out tls.crt
openssl pkcs12 -in cert.pfx -nocerts -nodes -out tls.key
\`\`\`

**3. Certificate chain required:**
\`\`\`bash
# Combine cert + intermediates
cat server.crt intermediate.crt > tls.crt
\`\`\`

**4. Cert and key don't match:**
- The MD5 fingerprints of modulus must be identical
- Regenerate the certificate using the same key: openssl req -x509 -key tls.key -out tls.crt -days 365 -subj "/CN=..."`
    }
  ]
};
