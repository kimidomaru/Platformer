window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['security-tooling/cert-manager'] = {
  theory: `
# cert-manager & TLS Automation

## Relevancia
O cert-manager e o padrao de facto para automacao de certificados TLS em Kubernetes. Ele gerencia o ciclo completo: emissao, renovacao e revogacao de certificados. Suporta Let's Encrypt (ACME), Vault PKI, self-signed e CA custom. Essencial para qualquer cluster de producao.

## Conceitos Fundamentais

### Arquitetura do cert-manager

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

### CRDs Principais

| CRD | Escopo | Funcao |
|-----|--------|--------|
| Issuer | Namespace | Emite certs naquele namespace |
| ClusterIssuer | Cluster | Emite certs em qualquer namespace |
| Certificate | Namespace | Solicita um certificado |
| CertificateRequest | Namespace | Request interno (auto-gerado) |
| Order | Namespace | ACME order (auto-gerado) |
| Challenge | Namespace | ACME challenge (auto-gerado) |

### Instalacao

\`\`\`bash
# Via Helm
helm repo add jetstack https://charts.jetstack.io
helm repo update

helm install cert-manager jetstack/cert-manager \\
  --namespace cert-manager --create-namespace \\
  --set crds.enabled=true

# Verificar instalacao
kubectl get pods -n cert-manager
kubectl get crd | grep cert-manager
\`\`\`

### ClusterIssuer com Let's Encrypt

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
  secretName: myapp-tls-cert          # Secret que sera criado com o cert
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  commonName: myapp.example.com
  dnsNames:
    - myapp.example.com
    - www.myapp.example.com
  duration: 2160h                      # 90 dias
  renewBefore: 360h                    # renovar 15 dias antes
  privateKey:
    algorithm: RSA
    size: 2048
\`\`\`

### Integracao com Ingress (Automatica)

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp-ingress
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"    # trigger automatico
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - myapp.example.com
      secretName: myapp-tls-auto       # cert-manager cria automaticamente
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

**HTTP01 (mais simples):**
\`\`\`yaml
solvers:
  - http01:
      ingress:
        class: nginx
\`\`\`
Cria um Pod temporario para responder ao desafio em \`/.well-known/acme-challenge/\`.

**DNS01 (wildcards e dominios internos):**
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
Cria registro TXT no DNS para provar controle do dominio. Suporta wildcards (\`*.example.com\`).

### Self-Signed e CA Issuer

\`\`\`yaml
# Self-Signed Issuer (para gerar CA)
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: selfsigned
spec:
  selfSigned: {}
---
# Gerar CA cert usando self-signed
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
# CA Issuer usando o CA cert gerado
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: internal-ca
spec:
  ca:
    secretName: my-ca-secret
\`\`\`

### Erros Comuns

1. **Staging vs Production** — sempre teste com staging primeiro; Let's Encrypt tem rate limits em producao
2. **DNS01 sem permissao** — API token do provedor DNS precisa de permissao de escrita na zona
3. **HTTP01 em cluster privado** — o servidor ACME precisa acessar o cluster pela internet
4. **Certificate Ready=False** — verificar Order e Challenge para diagnosticar

## Killer.sh Style Challenge

> **Cenario:** Configure cert-manager com dois ClusterIssuers (staging e production), crie um Certificate para myapp.example.com e configure um Ingress que usa o certificado automaticamente.
`,
  quiz: [
    {
      question: 'Qual a diferenca entre Issuer e ClusterIssuer no cert-manager?',
      options: [
        'Issuer suporta ACME, ClusterIssuer nao',
        'Issuer e limitado a um namespace, ClusterIssuer pode emitir certs em qualquer namespace',
        'ClusterIssuer e mais seguro',
        'Nao ha diferenca funcional'
      ],
      correct: 1,
      explanation: 'Issuer emite certificados apenas no namespace onde foi criado. ClusterIssuer e cluster-scoped e pode emitir certificados em qualquer namespace. Use ClusterIssuer para compartilhar um issuer entre equipes.',
      reference: 'Conceito relacionado: O Certificate referencia o issuer via issuerRef.kind (Issuer ou ClusterIssuer).'
    },
    {
      question: 'Qual annotation no Ingress faz o cert-manager emitir um certificado automaticamente?',
      options: [
        'kubernetes.io/tls-acme: "true"',
        'cert-manager.io/cluster-issuer: "<issuer-name>"',
        'tls.cert-manager.io/auto: "true"',
        'cert-manager.io/auto-tls: "enabled"'
      ],
      correct: 1,
      explanation: 'A annotation cert-manager.io/cluster-issuer (ou cert-manager.io/issuer) no Ingress faz o cert-manager criar automaticamente um Certificate e o Secret TLS correspondente.',
      reference: 'Conceito relacionado: O secretName no tls do Ingress define onde o cert sera armazenado.'
    },
    {
      question: 'Qual tipo de ACME challenge suporta certificados wildcard?',
      options: [
        'HTTP01',
        'DNS01',
        'Ambos',
        'Nenhum — wildcards nao sao suportados'
      ],
      correct: 1,
      explanation: 'Apenas DNS01 suporta wildcards (*.example.com) porque prova controle do dominio via registro DNS TXT. HTTP01 funciona apenas para hosts individuais acessiveis publicamente.',
      reference: 'Conceito relacionado: DNS01 requer API token do provedor DNS (Cloudflare, Route53, etc.).'
    },
    {
      question: 'O que acontece quando um Certificate atinge sua data de expiracao no cert-manager?',
      options: [
        'O certificado expira e para de funcionar',
        'O cert-manager renova automaticamente antes da expiracao baseado em renewBefore',
        'Um alerta e enviado mas nada e feito',
        'O cert-manager deleta o Secret'
      ],
      correct: 1,
      explanation: 'O cert-manager monitora todos os Certificates e os renova automaticamente antes da expiracao, baseado no campo renewBefore (padrao: 2/3 do duration).',
      reference: 'Conceito relacionado: duration=2160h (90d) com renewBefore=360h (15d) renova 15 dias antes de expirar.'
    },
    {
      question: 'Como criar uma CA interna usando cert-manager?',
      options: [
        'Usar Let\'s Encrypt com flag interna',
        'Criar um self-signed Issuer, gerar CA Certificate com isCA=true, e criar CA Issuer referenciando o Secret',
        'Instalar um plugin separado',
        'Nao e possivel com cert-manager'
      ],
      correct: 1,
      explanation: 'O fluxo e: (1) ClusterIssuer self-signed, (2) Certificate com isCA=true usando o self-signed issuer, (3) ClusterIssuer CA referenciando o Secret do CA cert gerado.',
      reference: 'Conceito relacionado: O CA Issuer assina certs usando a CA key armazenada no Secret.'
    },
    {
      question: 'Por que e recomendado testar com Let\'s Encrypt Staging primeiro?',
      options: [
        'Staging e mais rapido',
        'Production tem rate limits rigorosos — exceder causa bloqueio temporario',
        'Staging e mais seguro',
        'Nao ha diferenca real'
      ],
      correct: 1,
      explanation: 'O Let\'s Encrypt production tem rate limits: 50 certificados por dominio por semana, 5 duplicados por semana. Exceder causa bloqueio. O staging tem limites muito maiores para testes.',
      reference: 'Conceito relacionado: Staging URL: acme-staging-v02.api.letsencrypt.org/directory.'
    },
    {
      question: 'Onde o cert-manager armazena o certificado TLS emitido?',
      options: [
        'Em um ConfigMap',
        'Em um Secret do tipo kubernetes.io/tls com tls.crt e tls.key',
        'No PersistentVolume',
        'No etcd diretamente'
      ],
      correct: 1,
      explanation: 'O cert-manager cria um Secret do tipo kubernetes.io/tls contendo tls.crt (certificado + chain) e tls.key (chave privada). O nome do Secret e definido pelo campo secretName no Certificate.',
      reference: 'Conceito relacionado: O campo ca.crt no Secret contem o certificado da CA (quando disponivel).'
    }
  ],
  flashcards: [
    {
      front: 'Quais sao os CRDs do cert-manager?',
      back: '| CRD | Funcao |\n|-----|--------|\n| **Issuer** | Emite certs em 1 namespace |\n| **ClusterIssuer** | Emite certs cluster-wide |\n| **Certificate** | Solicita um certificado |\n| **CertificateRequest** | Request interno (auto) |\n| **Order** | ACME order (auto) |\n| **Challenge** | ACME challenge (auto) |\n\nUsuario cria: Issuer/ClusterIssuer + Certificate\ncert-manager cria: CertificateRequest, Order, Challenge'
    },
    {
      front: 'Qual a diferenca entre HTTP01 e DNS01 challenges?',
      back: '**HTTP01:**\n- Cria Pod temporario em /.well-known/acme-challenge/\n- Cluster deve ser acessivel pela internet\n- NAO suporta wildcards\n- Mais simples de configurar\n\n**DNS01:**\n- Cria registro TXT no DNS\n- Funciona com clusters privados\n- SUPORTA wildcards (*.example.com)\n- Requer API token do provedor DNS\n\n**Provedores DNS01:** Cloudflare, Route53, Google Cloud DNS, Azure DNS, etc.'
    },
    {
      front: 'Como o cert-manager integra com Ingress?',
      back: '**Automatico via annotation:**\n\`\`\`yaml\nmetadata:\n  annotations:\n    cert-manager.io/cluster-issuer: "letsencrypt-prod"\nspec:\n  tls:\n    - hosts: ["app.example.com"]\n      secretName: app-tls\n\`\`\`\n\ncert-manager detecta a annotation e:\n1. Cria Certificate automaticamente\n2. Resolve ACME challenge\n3. Cria Secret com tls.crt e tls.key\n4. Ingress usa o Secret para HTTPS'
    },
    {
      front: 'Como criar uma CA interna com cert-manager?',
      back: '**3 passos:**\n\n1. **SelfSigned Issuer:**\n\`\`\`yaml\nkind: ClusterIssuer\nspec:\n  selfSigned: {}\n\`\`\`\n\n2. **CA Certificate:**\n\`\`\`yaml\nkind: Certificate\nspec:\n  isCA: true\n  secretName: my-ca\n  issuerRef: {name: selfsigned}\n\`\`\`\n\n3. **CA Issuer:**\n\`\`\`yaml\nkind: ClusterIssuer\nspec:\n  ca:\n    secretName: my-ca\n\`\`\`\n\nCerts emitidos pelo CA Issuer sao assinados pela CA interna.'
    },
    {
      front: 'Como diagnosticar quando um Certificate nao fica Ready?',
      back: '**Passo a passo:**\n\n1. kubectl describe certificate <name>\n   - Verificar Status.Conditions\n\n2. kubectl get certificaterequest\n   - Verificar se CR foi criado\n\n3. kubectl describe certificaterequest <name>\n   - Verificar Status e Events\n\n4. kubectl get order (se ACME)\n   - Verificar Status da order\n\n5. kubectl get challenge (se ACME)\n   - Verificar Status do challenge\n   - Logs: kubectl logs -n cert-manager deploy/cert-manager\n\n**Dica:** A cadeia e Certificate -> CR -> Order -> Challenge'
    },
    {
      front: 'Quais Issuers o cert-manager suporta?',
      back: '**Built-in:**\n- **ACME** (Let\\\'s Encrypt, ZeroSSL)\n- **SelfSigned** (para CAs internas)\n- **CA** (usando CA key existente)\n- **Vault** (HashiCorp Vault PKI)\n- **Venafi** (Venafi TPP/Cloud)\n\n**Via plugins:**\n- AWS Private CA\n- Google CAS\n- Step CA\n- CFSSL\n- FreeIPA\n\nCada issuer e configurado como Issuer ou ClusterIssuer.'
    },
    {
      front: 'Quais campos importantes tem o Certificate CRD?',
      back: '| Campo | Funcao |\n|-------|--------|\n| **secretName** | Nome do Secret TLS criado |\n| **issuerRef** | Referencia ao Issuer/ClusterIssuer |\n| **commonName** | CN do certificado |\n| **dnsNames** | SANs (Subject Alternative Names) |\n| **duration** | Validade (padrao: 2160h/90d) |\n| **renewBefore** | Quando renovar antes de expirar |\n| **isCA** | Se e um certificado CA |\n| **privateKey** | Algoritmo e tamanho da chave |'
    }
  ],
  lab: {
    scenario: 'Voce precisa configurar cert-manager para automatizar certificados TLS, criando uma CA interna e integrando com Ingress.',
    objective: 'Instalar cert-manager, criar ClusterIssuers, emitir certificados e integrar com Ingress automaticamente.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Instalar cert-manager',
        instruction: `Instale o cert-manager via Helm e verifique os CRDs.

\`\`\`bash
# Instalar cert-manager
helm repo add jetstack https://charts.jetstack.io
helm repo update

helm install cert-manager jetstack/cert-manager \\
  --namespace cert-manager --create-namespace \\
  --set crds.enabled=true

# Aguardar Pods
kubectl rollout status deployment cert-manager -n cert-manager
kubectl rollout status deployment cert-manager-webhook -n cert-manager
kubectl rollout status deployment cert-manager-cainjector -n cert-manager
\`\`\``,
        hints: [
          'O cert-manager precisa de 3 componentes: controller, webhook e cainjector',
          'crds.enabled=true instala os CRDs automaticamente',
          'Verifique que todos os 3 Pods estao Running antes de continuar'
        ],
        solution: `\`\`\`bash
helm repo add jetstack https://charts.jetstack.io
helm repo update
helm install cert-manager jetstack/cert-manager --namespace cert-manager --create-namespace --set crds.enabled=true
\`\`\``,
        verify: `\`\`\`bash
# Verificar Pods
kubectl get pods -n cert-manager
# Saida esperada: cert-manager, cert-manager-webhook, cert-manager-cainjector todos Running

# Verificar CRDs
kubectl get crd | grep cert-manager
# Saida esperada: certificates.cert-manager.io, issuers.cert-manager.io, clusterissuers.cert-manager.io, etc.

# Verificar API resources
kubectl api-resources | grep cert-manager
# Saida esperada: certificates, issuers, clusterissuers, certificaterequests, orders, challenges
\`\`\``
      },
      {
        title: 'Criar CA Interna e Emitir Certificado',
        instruction: `Crie uma CA interna usando self-signed issuer e emita um certificado para uma aplicacao.

\`\`\`bash
kubectl apply -f - <<EOF
# Self-Signed ClusterIssuer (para gerar a CA)
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: selfsigned
spec:
  selfSigned: {}
---
# Gerar CA Certificate
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
# CA ClusterIssuer usando o certificado gerado
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: internal-ca-issuer
spec:
  ca:
    secretName: internal-ca-secret
EOF

# Aguardar CA ficar pronta
kubectl wait --for=condition=Ready certificate internal-ca -n cert-manager --timeout=60s

# Emitir certificado para aplicacao
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
          'O CA Certificate precisa de isCA: true',
          'O CA ClusterIssuer referencia o Secret gerado pelo CA Certificate',
          'Certificates emitidos pela CA interna sao assinados por ela'
        ],
        solution: `\`\`\`bash
kubectl apply -f ca-setup.yaml
kubectl wait --for=condition=Ready certificate internal-ca -n cert-manager --timeout=60s
kubectl apply -f myapp-cert.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verificar CA Certificate
kubectl get certificate internal-ca -n cert-manager
# Saida esperada: internal-ca   True   internal-ca-secret   ...

# Verificar ClusterIssuers
kubectl get clusterissuers
# Saida esperada: selfsigned e internal-ca-issuer com Ready=True

# Verificar Certificate da app
kubectl get certificate myapp-tls
# Saida esperada: myapp-tls   True   myapp-tls-cert   ...

# Verificar Secret TLS criado
kubectl get secret myapp-tls-cert -o jsonpath='{.type}'
# Saida esperada: kubernetes.io/tls
\`\`\``
      },
      {
        title: 'Integrar com Ingress',
        instruction: `Configure um Ingress com annotation do cert-manager para emissao automatica de certificado.

\`\`\`bash
# Criar Deployment e Service de teste
kubectl create deployment web --image=nginx --port=80
kubectl expose deployment web --port=80

# Criar Ingress com cert-manager annotation
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
          'A annotation cert-manager.io/cluster-issuer e o trigger para emissao automatica',
          'O secretName no tls e o nome do Secret que sera criado pelo cert-manager',
          'O cert-manager cria Certificate, CertificateRequest e o Secret automaticamente'
        ],
        solution: `\`\`\`bash
kubectl create deployment web --image=nginx --port=80
kubectl expose deployment web --port=80
kubectl apply -f web-ingress.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verificar Ingress
kubectl get ingress web-ingress
# Saida esperada: web-ingress com host web.example.com

# Verificar Certificate criado automaticamente
kubectl get certificate web-tls-auto
# Saida esperada: web-tls-auto   True   web-tls-auto   ...

# Verificar Secret TLS criado
kubectl get secret web-tls-auto
# Saida esperada: web-tls-auto   kubernetes.io/tls   3   ...

# Verificar detalhes do certificado
kubectl get secret web-tls-auto -o jsonpath='{.data.tls\\.crt}' | base64 -d | openssl x509 -text -noout | head -15
# Saida esperada: Subject com CN=web.example.com, Issuer com CN=Internal CA
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Certificate fica em estado False/Pending',
      difficulty: 'easy',
      symptom: 'O Certificate foi criado mas o status Ready mostra False ou esta pendente indefinidamente.',
      diagnosis: `\`\`\`bash
# Verificar Certificate
kubectl describe certificate <name>

# Verificar CertificateRequest
kubectl get certificaterequest
kubectl describe certificaterequest <name>

# Se ACME, verificar Order e Challenge
kubectl get orders
kubectl get challenges

# Verificar logs do cert-manager
kubectl logs -n cert-manager deploy/cert-manager --tail=30 | grep <cert-name>
\`\`\``,
      solution: `**Causas comuns:**

1. **Issuer nao pronto:** Verifique que o ClusterIssuer/Issuer esta Ready. Se ACME, verifique a account key.

2. **ACME challenge falhou:** Para HTTP01, o cluster deve ser acessivel pela internet. Para DNS01, verifique credenciais do provedor DNS.

3. **Rate limit do Let's Encrypt:** Em producao, ha limite de 50 certs/dominio/semana. Use staging para testes.

4. **Namespace errado:** Se usa Issuer (nao ClusterIssuer), ele deve estar no mesmo namespace do Certificate.`
    },
    {
      title: 'Certificado nao renova automaticamente',
      difficulty: 'medium',
      symptom: 'O certificado expirou e o cert-manager nao renovou automaticamente. O Secret contem um certificado expirado.',
      diagnosis: `\`\`\`bash
# Verificar expiracao
kubectl get certificate <name> -o jsonpath='{.status.notAfter}'

# Verificar renovacao
kubectl get certificate <name> -o jsonpath='{.status.renewalTime}'

# Verificar eventos
kubectl describe certificate <name> | grep -A10 Events

# Verificar se o cert-manager controller esta rodando
kubectl get pods -n cert-manager
kubectl logs -n cert-manager deploy/cert-manager | grep "renewal"
\`\`\``,
      solution: `**Causas e solucoes:**

1. **cert-manager Pod nao esta rodando:** Verifique que o controller esta Running e sem crash loops.

2. **renewBefore muito curto:** Se renewBefore e menor que o tempo de emissao do ACME, a renovacao pode falhar. Use pelo menos 720h (30d).

3. **Issuer com problemas:** Se o Issuer mudou de configuracao ou credenciais expiraram, a renovacao falha. Verifique o Issuer.

4. **Forcar renovacao:**
\`\`\`bash
kubectl cert-manager renew <certificate-name>
# ou deletar o CertificateRequest para re-trigger
\`\`\``
    },
    {
      title: 'ACME HTTP01 challenge falha com timeout',
      difficulty: 'hard',
      symptom: 'O Challenge fica em estado Pending e nunca completa. O Let\'s Encrypt nao consegue validar o dominio.',
      diagnosis: `\`\`\`bash
# Verificar Challenge
kubectl get challenges
kubectl describe challenge <name>

# Verificar Pod do solver
kubectl get pods -n cert-manager | grep acme

# Verificar se o Pod do solver esta acessivel externamente
kubectl get ingress -A | grep acme

# Testar acessibilidade
curl -v http://<dominio>/.well-known/acme-challenge/<token>

# Verificar logs
kubectl logs -n cert-manager deploy/cert-manager | grep "challenge"
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Cluster nao acessivel pela internet:** HTTP01 requer que o servidor ACME acesse o cluster pela internet na porta 80. Em clusters privados, use DNS01.

2. **Ingress controller nao configurado:** Verifique que o Ingress class especificado no solver existe e esta funcionando.

3. **Firewall bloqueando:** Verifique que a porta 80 esta aberta para trafego externo no Load Balancer e no firewall.

4. **DNS nao aponta para o cluster:** O dominio deve resolver para o IP do Load Balancer do Ingress controller.

5. **Usar DNS01 como alternativa:** Para clusters privados ou wildcards, DNS01 e a unica opcao viavel.`
    }
  ]
};
