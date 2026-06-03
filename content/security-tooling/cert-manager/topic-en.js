window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['security-tooling/cert-manager'] = {
  theory: `
# cert-manager & TLS Automation

## Relevance
cert-manager is the de facto standard for TLS certificate automation in Kubernetes. It manages the complete lifecycle: issuance, renewal, and revocation of certificates. It supports Let's Encrypt (ACME), Vault PKI, self-signed, and custom CA. Essential for any production cluster.

## Core Concepts

### cert-manager Architecture

\`\`\`
                   ┌────────────────┐
                   │  cert-manager  │
                   │  controller    │
                   └───────┬────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
   ┌───────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
   │ Issuer/      │ │ Certificate │ │ Certificate │
   │ ClusterIssuer│ │ Request     │ │ (Secret)    │
   └──────────────┘ └─────────────┘ └─────────────┘
           │
   ┌───────┼────────────┐
   │       │            │
   ▼       ▼            ▼
  ACME   Vault      Self-Signed
  (LE)   (PKI)      (CA)
\`\`\`

### Main CRDs

| CRD | Scope | Function |
|-----|-------|----------|
| Issuer | Namespace | Issues certs in that namespace |
| ClusterIssuer | Cluster | Issues certs in any namespace |
| Certificate | Namespace | Requests a certificate |
| CertificateRequest | Namespace | Internal request (auto-generated) |
| Order | Namespace | ACME order (auto-generated) |
| Challenge | Namespace | ACME challenge (auto-generated) |

### Installation

\`\`\`bash
# Via Helm
helm repo add jetstack https://charts.jetstack.io
helm repo update

helm install cert-manager jetstack/cert-manager \\
  --namespace cert-manager --create-namespace \\
  --set crds.enabled=true

# Verify installation
kubectl get pods -n cert-manager
kubectl get crd | grep cert-manager
\`\`\`

### ClusterIssuer with Let's Encrypt

\`\`\`yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@example.com
    privateKeySecretRef:
      name: letsencrypt-prod-account
    solvers:
      - http01:
          ingress:
            class: nginx
---
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-staging
spec:
  acme:
    server: https://acme-staging-v02.api.letsencrypt.org/directory
    email: admin@example.com
    privateKeySecretRef:
      name: letsencrypt-staging-account
    solvers:
      - http01:
          ingress:
            class: nginx
\`\`\`

### Certificate Resource

\`\`\`yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: myapp-tls
  namespace: production
spec:
  secretName: myapp-tls-cert          # Secret that will be created with the cert
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  commonName: myapp.example.com
  dnsNames:
    - myapp.example.com
    - www.myapp.example.com
  duration: 2160h                      # 90 days
  renewBefore: 360h                    # renew 15 days before expiry
  privateKey:
    algorithm: RSA
    size: 2048
\`\`\`

### Ingress Integration (Automatic)

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp-ingress
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"    # automatic trigger
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - myapp.example.com
      secretName: myapp-tls-auto       # cert-manager creates automatically
  rules:
    - host: myapp.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: myapp
                port:
                  number: 80
\`\`\`

### ACME Challenges

**HTTP01 (simplest):**
\`\`\`yaml
solvers:
  - http01:
      ingress:
        class: nginx
\`\`\`
Creates a temporary Pod to answer the challenge at \`/.well-known/acme-challenge/\`.

**DNS01 (wildcards and internal domains):**
\`\`\`yaml
solvers:
  - dns01:
      cloudflare:
        email: admin@example.com
        apiTokenSecretRef:
          name: cloudflare-api-token
          key: api-token
    selector:
      dnsZones:
        - "example.com"
\`\`\`
Creates a TXT record in DNS to prove domain control. Supports wildcards (\`*.example.com\`).

### Self-Signed and CA Issuer

\`\`\`yaml
# Self-Signed Issuer (to generate CA)
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: selfsigned
spec:
  selfSigned: {}
---
# Generate CA cert using self-signed
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: my-ca
  namespace: cert-manager
spec:
  isCA: true
  secretName: my-ca-secret
  commonName: My Internal CA
  issuerRef:
    name: selfsigned
    kind: ClusterIssuer
  duration: 87600h
---
# CA Issuer using the generated CA cert
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: internal-ca
spec:
  ca:
    secretName: my-ca-secret
\`\`\`

### Common Mistakes

1. **Staging vs Production** — always test with staging first; Let's Encrypt has rate limits in production
2. **DNS01 without permission** — DNS provider API token needs write permission on the zone
3. **HTTP01 in private cluster** — ACME server needs to access the cluster from the internet
4. **Certificate Ready=False** — check Order and Challenge to diagnose

## Killer.sh Style Challenge

> **Scenario:** Configure cert-manager with two ClusterIssuers (staging and production), create a Certificate for myapp.example.com, and configure an Ingress that uses the certificate automatically.
`,
  quiz: [
    {
      question: 'What is the difference between Issuer and ClusterIssuer in cert-manager?',
      options: [
        'Issuer supports ACME, ClusterIssuer does not',
        'Issuer is limited to one namespace, ClusterIssuer can issue certs in any namespace',
        'ClusterIssuer is more secure',
        'No functional difference'
      ],
      correct: 1,
      explanation: 'Issuer issues certificates only in the namespace where it was created. ClusterIssuer is cluster-scoped and can issue certificates in any namespace. Use ClusterIssuer to share an issuer across teams.',
      reference: 'Related concept: The Certificate references the issuer via issuerRef.kind (Issuer or ClusterIssuer).'
    },
    {
      question: 'Which Ingress annotation makes cert-manager issue a certificate automatically?',
      options: [
        'kubernetes.io/tls-acme: "true"',
        'cert-manager.io/cluster-issuer: "<issuer-name>"',
        'tls.cert-manager.io/auto: "true"',
        'cert-manager.io/auto-tls: "enabled"'
      ],
      correct: 1,
      explanation: 'The cert-manager.io/cluster-issuer (or cert-manager.io/issuer) annotation on the Ingress makes cert-manager automatically create a Certificate and the corresponding TLS Secret.',
      reference: 'Related concept: The secretName in the tls section defines where the cert will be stored.'
    },
    {
      question: 'Which ACME challenge type supports wildcard certificates?',
      options: [
        'HTTP01',
        'DNS01',
        'Both',
        'Neither — wildcards are not supported'
      ],
      correct: 1,
      explanation: 'Only DNS01 supports wildcards (*.example.com) because it proves domain control via DNS TXT record. HTTP01 only works for individual hosts accessible publicly.',
      reference: 'Related concept: DNS01 requires a DNS provider API token (Cloudflare, Route53, etc.).'
    },
    {
      question: 'What happens when a Certificate reaches its expiration date in cert-manager?',
      options: [
        'The certificate expires and stops working',
        'cert-manager automatically renews it before expiration based on renewBefore',
        'An alert is sent but nothing is done',
        'cert-manager deletes the Secret'
      ],
      correct: 1,
      explanation: 'cert-manager monitors all Certificates and renews them automatically before expiration, based on the renewBefore field (default: 2/3 of duration).',
      reference: 'Related concept: duration=2160h (90d) with renewBefore=360h (15d) renews 15 days before expiry.'
    },
    {
      question: 'How do you create an internal CA using cert-manager?',
      options: [
        'Use Let\'s Encrypt with an internal flag',
        'Create a self-signed Issuer, generate a CA Certificate with isCA=true, and create a CA Issuer referencing the Secret',
        'Install a separate plugin',
        'Not possible with cert-manager'
      ],
      correct: 1,
      explanation: 'The flow is: (1) self-signed ClusterIssuer, (2) Certificate with isCA=true using the self-signed issuer, (3) CA ClusterIssuer referencing the Secret of the generated CA cert.',
      reference: 'Related concept: The CA Issuer signs certs using the CA key stored in the Secret.'
    },
    {
      question: 'Why is it recommended to test with Let\'s Encrypt Staging first?',
      options: [
        'Staging is faster',
        'Production has strict rate limits — exceeding causes temporary blocking',
        'Staging is more secure',
        'No real difference'
      ],
      correct: 1,
      explanation: 'Let\'s Encrypt production has rate limits: 50 certificates per domain per week, 5 duplicates per week. Exceeding causes blocking. Staging has much higher limits for testing.',
      reference: 'Related concept: Staging URL: acme-staging-v02.api.letsencrypt.org/directory.'
    },
    {
      question: 'Where does cert-manager store the issued TLS certificate?',
      options: [
        'In a ConfigMap',
        'In a Secret of type kubernetes.io/tls with tls.crt and tls.key',
        'In a PersistentVolume',
        'Directly in etcd'
      ],
      correct: 1,
      explanation: 'cert-manager creates a Secret of type kubernetes.io/tls containing tls.crt (certificate + chain) and tls.key (private key). The Secret name is defined by the secretName field in the Certificate.',
      reference: 'Related concept: The ca.crt field in the Secret contains the CA certificate (when available).'
    }
  ],
  flashcards: [
    {
      front: 'What are the cert-manager CRDs?',
      back: '| CRD | Function |\n|-----|----------|\n| **Issuer** | Issues certs in 1 namespace |\n| **ClusterIssuer** | Issues certs cluster-wide |\n| **Certificate** | Requests a certificate |\n| **CertificateRequest** | Internal request (auto) |\n| **Order** | ACME order (auto) |\n| **Challenge** | ACME challenge (auto) |\n\nUser creates: Issuer/ClusterIssuer + Certificate\ncert-manager creates: CertificateRequest, Order, Challenge'
    },
    {
      front: 'What is the difference between HTTP01 and DNS01 challenges?',
      back: '**HTTP01:**\n- Creates temp Pod at /.well-known/acme-challenge/\n- Cluster must be accessible from the internet\n- Does NOT support wildcards\n- Simpler to configure\n\n**DNS01:**\n- Creates TXT record in DNS\n- Works with private clusters\n- SUPPORTS wildcards (*.example.com)\n- Requires DNS provider API token\n\n**DNS01 providers:** Cloudflare, Route53, Google Cloud DNS, Azure DNS, etc.'
    },
    {
      front: 'How does cert-manager integrate with Ingress?',
      back: '**Automatic via annotation:**\n\`\`\`yaml\nmetadata:\n  annotations:\n    cert-manager.io/cluster-issuer: "letsencrypt-prod"\nspec:\n  tls:\n    - hosts: ["app.example.com"]\n      secretName: app-tls\n\`\`\`\n\ncert-manager detects the annotation and:\n1. Creates Certificate automatically\n2. Resolves ACME challenge\n3. Creates Secret with tls.crt and tls.key\n4. Ingress uses the Secret for HTTPS'
    },
    {
      front: 'How to create an internal CA with cert-manager?',
      back: '**3 steps:**\n\n1. **SelfSigned Issuer:**\n\`\`\`yaml\nkind: ClusterIssuer\nspec:\n  selfSigned: {}\n\`\`\`\n\n2. **CA Certificate:**\n\`\`\`yaml\nkind: Certificate\nspec:\n  isCA: true\n  secretName: my-ca\n  issuerRef: {name: selfsigned}\n\`\`\`\n\n3. **CA Issuer:**\n\`\`\`yaml\nkind: ClusterIssuer\nspec:\n  ca:\n    secretName: my-ca\n\`\`\`\n\nCerts issued by the CA Issuer are signed by the internal CA.'
    },
    {
      front: 'How to diagnose when a Certificate is not Ready?',
      back: '**Step by step:**\n\n1. kubectl describe certificate <name>\n   - Check Status.Conditions\n\n2. kubectl get certificaterequest\n   - Check if CR was created\n\n3. kubectl describe certificaterequest <name>\n   - Check Status and Events\n\n4. kubectl get order (if ACME)\n   - Check Order Status\n\n5. kubectl get challenge (if ACME)\n   - Check Challenge Status\n   - Logs: kubectl logs -n cert-manager deploy/cert-manager\n\n**Tip:** The chain is Certificate -> CR -> Order -> Challenge'
    },
    {
      front: 'Which Issuers does cert-manager support?',
      back: '**Built-in:**\n- **ACME** (Let\\\'s Encrypt, ZeroSSL)\n- **SelfSigned** (for internal CAs)\n- **CA** (using existing CA key)\n- **Vault** (HashiCorp Vault PKI)\n- **Venafi** (Venafi TPP/Cloud)\n\n**Via plugins:**\n- AWS Private CA\n- Google CAS\n- Step CA\n- CFSSL\n- FreeIPA\n\nEach issuer is configured as Issuer or ClusterIssuer.'
    },
    {
      front: 'What are the important fields in the Certificate CRD?',
      back: '| Field | Function |\n|-------|----------|\n| **secretName** | Name of TLS Secret created |\n| **issuerRef** | Reference to Issuer/ClusterIssuer |\n| **commonName** | Certificate CN |\n| **dnsNames** | SANs (Subject Alternative Names) |\n| **duration** | Validity (default: 2160h/90d) |\n| **renewBefore** | When to renew before expiry |\n| **isCA** | Whether it is a CA certificate |\n| **privateKey** | Key algorithm and size |'
    }
  ],
  lab: {
    scenario: 'You need to configure cert-manager to automate TLS certificates, creating an internal CA and integrating with Ingress.',
    objective: 'Install cert-manager, create ClusterIssuers, issue certificates, and integrate with Ingress automatically.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Install cert-manager',
        instruction: `Install cert-manager via Helm and verify the CRDs.

\`\`\`bash
# Install cert-manager
helm repo add jetstack https://charts.jetstack.io
helm repo update

helm install cert-manager jetstack/cert-manager \\
  --namespace cert-manager --create-namespace \\
  --set crds.enabled=true

# Wait for Pods
kubectl rollout status deployment cert-manager -n cert-manager
kubectl rollout status deployment cert-manager-webhook -n cert-manager
kubectl rollout status deployment cert-manager-cainjector -n cert-manager
\`\`\``,
        hints: [
          'cert-manager needs 3 components: controller, webhook, and cainjector',
          'crds.enabled=true installs the CRDs automatically',
          'Verify all 3 Pods are Running before continuing'
        ],
        solution: `\`\`\`bash
helm repo add jetstack https://charts.jetstack.io
helm repo update
helm install cert-manager jetstack/cert-manager --namespace cert-manager --create-namespace --set crds.enabled=true
\`\`\``,
        verify: `\`\`\`bash
# Verify Pods
kubectl get pods -n cert-manager
# Expected output: cert-manager, cert-manager-webhook, cert-manager-cainjector all Running

# Verify CRDs
kubectl get crd | grep cert-manager
# Expected output: certificates.cert-manager.io, issuers.cert-manager.io, clusterissuers.cert-manager.io, etc.

# Verify API resources
kubectl api-resources | grep cert-manager
# Expected output: certificates, issuers, clusterissuers, certificaterequests, orders, challenges
\`\`\``
      },
      {
        title: 'Create Internal CA and Issue Certificate',
        instruction: `Create an internal CA using a self-signed issuer and issue a certificate for an application.

\`\`\`bash
kubectl apply -f - <<EOF
# Self-Signed ClusterIssuer (to generate the CA)
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: selfsigned
spec:
  selfSigned: {}
---
# Generate CA Certificate
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: internal-ca
  namespace: cert-manager
spec:
  isCA: true
  commonName: "Internal CA"
  secretName: internal-ca-secret
  duration: 87600h
  issuerRef:
    name: selfsigned
    kind: ClusterIssuer
---
# CA ClusterIssuer using the generated certificate
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: internal-ca-issuer
spec:
  ca:
    secretName: internal-ca-secret
EOF

# Wait for CA to be ready
kubectl wait --for=condition=Ready certificate internal-ca -n cert-manager --timeout=60s

# Issue certificate for application
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: myapp-tls
  namespace: default
spec:
  secretName: myapp-tls-cert
  issuerRef:
    name: internal-ca-issuer
    kind: ClusterIssuer
  commonName: myapp.example.com
  dnsNames:
    - myapp.example.com
    - www.myapp.example.com
  duration: 2160h
  renewBefore: 360h
EOF
\`\`\``,
        hints: [
          'The CA Certificate needs isCA: true',
          'The CA ClusterIssuer references the Secret generated by the CA Certificate',
          'Certificates issued by the internal CA are signed by it'
        ],
        solution: `\`\`\`bash
kubectl apply -f ca-setup.yaml
kubectl wait --for=condition=Ready certificate internal-ca -n cert-manager --timeout=60s
kubectl apply -f myapp-cert.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verify CA Certificate
kubectl get certificate internal-ca -n cert-manager
# Expected output: internal-ca   True   internal-ca-secret   ...

# Verify ClusterIssuers
kubectl get clusterissuers
# Expected output: selfsigned and internal-ca-issuer with Ready=True

# Verify app Certificate
kubectl get certificate myapp-tls
# Expected output: myapp-tls   True   myapp-tls-cert   ...

# Verify TLS Secret created
kubectl get secret myapp-tls-cert -o jsonpath='{.type}'
# Expected output: kubernetes.io/tls
\`\`\``
      },
      {
        title: 'Integrate with Ingress',
        instruction: `Configure an Ingress with cert-manager annotation for automatic certificate issuance.

\`\`\`bash
# Create test Deployment and Service
kubectl create deployment web --image=nginx --port=80
kubectl expose deployment web --port=80

# Create Ingress with cert-manager annotation
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: web-ingress
  annotations:
    cert-manager.io/cluster-issuer: "internal-ca-issuer"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - web.example.com
      secretName: web-tls-auto
  rules:
    - host: web.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web
                port:
                  number: 80
EOF
\`\`\``,
        hints: [
          'The cert-manager.io/cluster-issuer annotation is the trigger for automatic issuance',
          'The secretName in tls is the name of the Secret that cert-manager will create',
          'cert-manager creates Certificate, CertificateRequest, and the Secret automatically'
        ],
        solution: `\`\`\`bash
kubectl create deployment web --image=nginx --port=80
kubectl expose deployment web --port=80
kubectl apply -f web-ingress.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verify Ingress
kubectl get ingress web-ingress
# Expected output: web-ingress with host web.example.com

# Verify Certificate created automatically
kubectl get certificate web-tls-auto
# Expected output: web-tls-auto   True   web-tls-auto   ...

# Verify TLS Secret created
kubectl get secret web-tls-auto
# Expected output: web-tls-auto   kubernetes.io/tls   3   ...

# Verify certificate details
kubectl get secret web-tls-auto -o jsonpath='{.data.tls\\.crt}' | base64 -d | openssl x509 -text -noout | head -15
# Expected output: Subject with CN=web.example.com, Issuer with CN=Internal CA
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Certificate stays in False/Pending state',
      difficulty: 'easy',
      symptom: 'The Certificate was created but the Ready status shows False or is pending indefinitely.',
      diagnosis: `\`\`\`bash
# Check Certificate
kubectl describe certificate <name>

# Check CertificateRequest
kubectl get certificaterequest
kubectl describe certificaterequest <name>

# If ACME, check Order and Challenge
kubectl get orders
kubectl get challenges

# Check cert-manager logs
kubectl logs -n cert-manager deploy/cert-manager --tail=30 | grep <cert-name>
\`\`\``,
      solution: `**Common causes:**

1. **Issuer not ready:** Verify the ClusterIssuer/Issuer is Ready. If ACME, check the account key.

2. **ACME challenge failed:** For HTTP01, the cluster must be accessible from the internet. For DNS01, verify DNS provider credentials.

3. **Let's Encrypt rate limit:** In production, there is a limit of 50 certs/domain/week. Use staging for testing.

4. **Wrong namespace:** If using Issuer (not ClusterIssuer), it must be in the same namespace as the Certificate.`
    },
    {
      title: 'Certificate does not renew automatically',
      difficulty: 'medium',
      symptom: 'The certificate expired and cert-manager did not renew it automatically. The Secret contains an expired certificate.',
      diagnosis: `\`\`\`bash
# Check expiration
kubectl get certificate <name> -o jsonpath='{.status.notAfter}'

# Check renewal time
kubectl get certificate <name> -o jsonpath='{.status.renewalTime}'

# Check events
kubectl describe certificate <name> | grep -A10 Events

# Check if cert-manager controller is running
kubectl get pods -n cert-manager
kubectl logs -n cert-manager deploy/cert-manager | grep "renewal"
\`\`\``,
      solution: `**Causes and solutions:**

1. **cert-manager Pod not running:** Verify the controller is Running without crash loops.

2. **renewBefore too short:** If renewBefore is less than the ACME issuance time, renewal may fail. Use at least 720h (30d).

3. **Issuer with problems:** If the Issuer changed configuration or credentials expired, renewal fails. Check the Issuer.

4. **Force renewal:**
\`\`\`bash
kubectl cert-manager renew <certificate-name>
# or delete the CertificateRequest to re-trigger
\`\`\``
    },
    {
      title: 'ACME HTTP01 challenge fails with timeout',
      difficulty: 'hard',
      symptom: 'The Challenge stays in Pending state and never completes. Let\'s Encrypt cannot validate the domain.',
      diagnosis: `\`\`\`bash
# Check Challenge
kubectl get challenges
kubectl describe challenge <name>

# Check solver Pod
kubectl get pods -n cert-manager | grep acme

# Check if solver Pod is externally accessible
kubectl get ingress -A | grep acme

# Test accessibility
curl -v http://<domain>/.well-known/acme-challenge/<token>

# Check logs
kubectl logs -n cert-manager deploy/cert-manager | grep "challenge"
\`\`\``,
      solution: `**Causes and solutions:**

1. **Cluster not accessible from the internet:** HTTP01 requires the ACME server to access the cluster from the internet on port 80. For private clusters, use DNS01.

2. **Ingress controller not configured:** Verify the Ingress class specified in the solver exists and is working.

3. **Firewall blocking:** Verify port 80 is open for external traffic on the Load Balancer and firewall.

4. **DNS not pointing to cluster:** The domain must resolve to the Load Balancer IP of the Ingress controller.

5. **Use DNS01 as alternative:** For private clusters or wildcards, DNS01 is the only viable option.`
    }
  ]
};
