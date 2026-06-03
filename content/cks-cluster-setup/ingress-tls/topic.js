window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['cks-cluster-setup/ingress-tls'] = {

  theory: `# Ingress Security & TLS

## Relevancia no CKS
> O dominio "Cluster Setup" vale **10%** do CKS. Configurar TLS em Ingress e fundamental para proteger trafego em transito. Voce deve saber criar TLS Secrets, configurar Ingress com HTTPS e entender cert-manager.

---

## TLS no Kubernetes

TLS (Transport Layer Security) garante que o trafego entre clientes e servicos seja criptografado. No Kubernetes, a terminacao TLS geralmente ocorre no Ingress Controller.

### Fluxo de TLS no Ingress

\`\`\`text
Cliente --[HTTPS]--> Ingress Controller --[HTTP]--> Service --> Pod
                     (TLS termination)
\`\`\`

---

## Criando TLS Secrets

### Via kubectl

\`\`\`bash
# Gerar certificado autoassinado (para testes)
openssl req -x509 -nodes -days 365 \\
  -newkey rsa:2048 \\
  -keyout tls.key \\
  -out tls.crt \\
  -subj "/CN=myapp.example.com/O=MyOrg"

# Criar Secret TLS
kubectl create secret tls myapp-tls \\
  --cert=tls.crt \\
  --key=tls.key \\
  -n default
\`\`\`

### Via YAML

\`\`\`yaml
apiVersion: v1
kind: Secret
metadata:
  name: myapp-tls
  namespace: default
type: kubernetes.io/tls
data:
  tls.crt: <base64-encoded-cert>
  tls.key: <base64-encoded-key>
\`\`\`

---

## Configurando Ingress com TLS

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp-ingress
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - myapp.example.com
    secretName: myapp-tls
  rules:
  - host: myapp.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: myapp-svc
            port:
              number: 80
\`\`\`

### Pontos Importantes

- **spec.tls[].hosts** deve coincidir com **spec.rules[].host**
- **secretName** referencia o Secret tipo \`kubernetes.io/tls\`
- A annotation \`ssl-redirect: "true"\` forca redirecionamento HTTP -> HTTPS

---

## Annotations de Seguranca do Ingress NGINX

\`\`\`yaml
metadata:
  annotations:
    # Forcar HTTPS
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    # HSTS (HTTP Strict Transport Security)
    nginx.ingress.kubernetes.io/hsts: "true"
    nginx.ingress.kubernetes.io/hsts-max-age: "31536000"
    nginx.ingress.kubernetes.io/hsts-include-subdomains: "true"
    # Versao minima do TLS
    nginx.ingress.kubernetes.io/ssl-protocols: "TLSv1.2 TLSv1.3"
    # Cipher suites
    nginx.ingress.kubernetes.io/ssl-ciphers: "ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256"
    # Headers de seguranca
    nginx.ingress.kubernetes.io/configuration-snippet: |
      more_set_headers "X-Frame-Options: DENY";
      more_set_headers "X-Content-Type-Options: nosniff";
      more_set_headers "X-XSS-Protection: 1; mode=block";
\`\`\`

---

## cert-manager

**cert-manager** automatiza a emissao e renovacao de certificados TLS no Kubernetes.

### Arquitetura

\`\`\`text
cert-manager Controller
    |
    +--> Issuer/ClusterIssuer (fonte de certificados)
    |       |
    |       +--> Let's Encrypt (ACME)
    |       +--> Self-signed
    |       +--> CA
    |       +--> Vault
    |
    +--> Certificate (solicita o cert)
    |
    +--> Secret TLS (armazena o cert emitido)
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
      name: letsencrypt-prod-key
    solvers:
    - http01:
        ingress:
          class: nginx
\`\`\`

### Ingress com cert-manager

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp-ingress
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
  - hosts:
    - myapp.example.com
    secretName: myapp-tls-auto
  rules:
  - host: myapp.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: myapp-svc
            port:
              number: 80
\`\`\`

O cert-manager automaticamente:
1. Cria um Certificate resource
2. Solicita o certificado ao Let's Encrypt
3. Armazena no Secret \`myapp-tls-auto\`
4. Renova antes do vencimento

---

## Default TLS Certificate

Configure um certificado TLS padrao no Ingress Controller para requisicoes que nao tem host match:

\`\`\`bash
# Via flag do Ingress Controller
--default-ssl-certificate=namespace/secret-name
\`\`\`

---

## mTLS (Mutual TLS)

No mTLS, tanto o servidor quanto o cliente apresentam certificados:

\`\`\`yaml
metadata:
  annotations:
    nginx.ingress.kubernetes.io/auth-tls-verify-client: "on"
    nginx.ingress.kubernetes.io/auth-tls-secret: "default/ca-secret"
    nginx.ingress.kubernetes.io/auth-tls-verify-depth: "1"
\`\`\`

---

## Erros Comuns

1. **Secret TLS em namespace errado** — deve estar no mesmo namespace do Ingress
2. **Host no TLS nao corresponde ao host no rules** — devem ser iguais
3. **Certificado expirado** — cert-manager resolve, mas autoassinados expiram silenciosamente
4. **Usar TLSv1.0/1.1** — inseguros, sempre usar TLSv1.2+
5. **Nao forcar HTTPS redirect** — permite trafego nao criptografado

---

## Killer.sh Style Challenge

> Configure um Ingress com TLS para o dominio \`secure.example.com\`. Crie o certificado autoassinado, o Secret TLS, e configure o Ingress para forcar HTTPS redirect e usar apenas TLSv1.2+.
`,

  quiz: [
    {
      question: 'Qual tipo de Secret e usado para armazenar certificados TLS no Kubernetes?',
      options: ['Opaque', 'kubernetes.io/tls', 'kubernetes.io/ssh-auth', 'kubernetes.io/dockerconfigjson'],
      correct: 1,
      explanation: 'O tipo kubernetes.io/tls armazena certificados TLS com os campos tls.crt (certificado) e tls.key (chave privada).',
      reference: 'Conceito relacionado: Secrets — tipos de Secret no Kubernetes.'
    },
    {
      question: 'Qual annotation forca o redirecionamento de HTTP para HTTPS no Ingress NGINX?',
      options: [
        'nginx.ingress.kubernetes.io/force-https: "true"',
        'nginx.ingress.kubernetes.io/ssl-redirect: "true"',
        'nginx.ingress.kubernetes.io/https-only: "true"',
        'nginx.ingress.kubernetes.io/tls-required: "true"'
      ],
      correct: 1,
      explanation: 'A annotation ssl-redirect: "true" forca o Ingress NGINX a redirecionar todas as requisicoes HTTP para HTTPS.',
      reference: 'Conceito relacionado: Ingress NGINX annotations de seguranca.'
    },
    {
      question: 'O que o cert-manager faz no Kubernetes?',
      options: [
        'Gerencia certificados de servicos internos via mTLS',
        'Automatiza emissao, armazenamento e renovacao de certificados TLS',
        'Criptografa Secrets no etcd',
        'Gera chaves SSH para nodes'
      ],
      correct: 1,
      explanation: 'cert-manager automatiza todo o ciclo de vida de certificados TLS: emissao (via ACME/Let Encrypt, CA, etc), armazenamento em Secrets e renovacao automatica.',
      reference: 'Conceito relacionado: cert-manager — automacao de certificados.'
    },
    {
      question: 'Onde o Secret TLS deve estar para ser usado por um Ingress?',
      options: [
        'No namespace kube-system',
        'No mesmo namespace do Ingress',
        'Em qualquer namespace, referenciado pelo nome completo',
        'No namespace do Ingress Controller'
      ],
      correct: 1,
      explanation: 'O Secret TLS deve estar no mesmo namespace do Ingress resource. Ingress nao pode referenciar Secrets de outros namespaces.',
      reference: 'Conceito relacionado: Namespaces e escopo de recursos.'
    },
    {
      question: 'Qual versao minima de TLS deve ser configurada para seguranca adequada?',
      options: ['TLSv1.0', 'TLSv1.1', 'TLSv1.2', 'SSLv3'],
      correct: 2,
      explanation: 'TLSv1.2 e o minimo recomendado. TLSv1.0 e 1.1 possuem vulnerabilidades conhecidas e foram deprecated pela maioria dos navegadores.',
      reference: 'Conceito relacionado: TLS — versoes e seguranca.'
    },
    {
      question: 'No mTLS, o que acontece alem da verificacao do servidor?',
      options: [
        'O servidor verifica a identidade do cliente via certificado',
        'O trafego e criptografado duas vezes',
        'Dois canais TLS separados sao criados',
        'O DNS e verificado bilateralmente'
      ],
      correct: 0,
      explanation: 'Em mTLS (Mutual TLS), tanto o servidor quanto o cliente apresentam certificados. O servidor verifica o certificado do cliente alem do fluxo normal onde o cliente verifica o servidor.',
      reference: 'Conceito relacionado: mTLS — autenticacao mutua.'
    },
    {
      question: 'Qual recurso do cert-manager define a fonte de emissao de certificados?',
      options: ['Certificate', 'CertificateRequest', 'Issuer/ClusterIssuer', 'SecretStore'],
      correct: 2,
      explanation: 'Issuer (namespace-scoped) e ClusterIssuer (cluster-scoped) definem a fonte de certificados: Let Encrypt (ACME), self-signed, CA, Vault, etc.',
      reference: 'Conceito relacionado: cert-manager — Issuer vs ClusterIssuer.'
    }
  ],

  flashcards: [
    { front: 'Como criar um Secret TLS via kubectl?', back: 'kubectl create secret tls <name> --cert=tls.crt --key=tls.key -n <namespace>. O Secret sera do tipo kubernetes.io/tls com campos tls.crt e tls.key.' },
    { front: 'Qual a funcao do campo spec.tls no Ingress?', back: 'Define a configuracao TLS: lista de hosts que usam HTTPS e o secretName que contem o certificado/chave. Os hosts devem coincidir com os hosts em spec.rules.' },
    { front: 'O que e cert-manager?', back: 'Controller que automatiza emissao, armazenamento em Secrets e renovacao de certificados TLS. Suporta fontes como Let Encrypt (ACME), self-signed, CA interna e HashiCorp Vault.' },
    { front: 'Qual a diferenca entre Issuer e ClusterIssuer?', back: 'Issuer e namespace-scoped (emite certs para Ingress no mesmo namespace). ClusterIssuer e cluster-scoped (emite para qualquer namespace). Referenciados via annotations no Ingress.' },
    { front: 'O que e mTLS?', back: 'Mutual TLS: tanto servidor quanto cliente apresentam certificados para autenticacao mutua. No Ingress NGINX, configurado via annotations auth-tls-verify-client e auth-tls-secret.' },
    { front: 'Quais versoes de TLS sao seguras?', back: 'TLSv1.2 e TLSv1.3 sao seguras. TLSv1.0 e TLSv1.1 possuem vulnerabilidades conhecidas e nao devem ser usados.' },
    { front: 'O que e HSTS?', back: 'HTTP Strict Transport Security: header que instrui o navegador a SEMPRE usar HTTPS para o dominio. Configurado via annotation hsts: "true" com hsts-max-age no Ingress NGINX.' },
    { front: 'Como configurar um certificado TLS padrao no Ingress Controller?', back: 'Via flag --default-ssl-certificate=namespace/secret-name no deployment do Ingress Controller. Usado para requisicoes sem host match.' }
  ],

  lab: {
    scenario: 'Voce precisa configurar TLS para um servico web exposto via Ingress, garantindo que todo trafego seja criptografado.',
    objective: 'Criar certificado TLS, configurar Ingress com HTTPS e forcar redirecionamento.',
    duration: '15-20 minutos',
    steps: [
      {
        title: 'Criar Certificado e Secret TLS',
        instruction: 'Gere um certificado autoassinado para `secure.example.com` e crie o Secret TLS no namespace default.',
        hints: [
          'Use openssl req -x509 para gerar o certificado',
          'Use kubectl create secret tls para criar o Secret',
          'O CN do certificado deve corresponder ao host do Ingress'
        ],
        solution: '```bash\n# Gerar certificado autoassinado\nopenssl req -x509 -nodes -days 365 \\\n  -newkey rsa:2048 \\\n  -keyout tls.key \\\n  -out tls.crt \\\n  -subj "/CN=secure.example.com/O=Lab"\n\n# Criar Secret TLS\nkubectl create secret tls secure-tls \\\n  --cert=tls.crt \\\n  --key=tls.key\n```',
        verify: '```bash\n# Verificar que o Secret foi criado\nkubectl get secret secure-tls\n# Saida esperada: secure-tls   kubernetes.io/tls   2   <age>\n\n# Verificar conteudo\nkubectl describe secret secure-tls\n# Saida esperada: tls.crt e tls.key presentes\n```'
      },
      {
        title: 'Criar Deployment e Service',
        instruction: 'Crie um Deployment com nginx e um Service ClusterIP para ser exposto via Ingress.',
        hints: [
          'Use a imagem nginx:1.25-alpine',
          'O Service deve expor porta 80',
          'Use kubectl create deployment e kubectl expose'
        ],
        solution: '```bash\n# Criar Deployment\nkubectl create deployment secure-app --image=nginx:1.25-alpine\n\n# Criar Service\nkubectl expose deployment secure-app --port=80 --target-port=80\n```',
        verify: '```bash\n# Verificar Deployment\nkubectl get deployment secure-app\n# Saida esperada: READY 1/1\n\n# Verificar Service\nkubectl get svc secure-app\n# Saida esperada: ClusterIP com porta 80\n```'
      },
      {
        title: 'Configurar Ingress com TLS',
        instruction: 'Crie um Ingress para `secure.example.com` com TLS habilitado e redirecionamento HTTPS forcado.',
        hints: [
          'Use spec.tls com o secretName criado',
          'Adicione annotation ssl-redirect: "true"',
          'O host no TLS deve corresponder ao host nas rules'
        ],
        solution: '```bash\nkubectl apply -f - <<EOF\napiVersion: networking.k8s.io/v1\nkind: Ingress\nmetadata:\n  name: secure-ingress\n  annotations:\n    nginx.ingress.kubernetes.io/ssl-redirect: \"true\"\n    nginx.ingress.kubernetes.io/force-ssl-redirect: \"true\"\nspec:\n  tls:\n  - hosts:\n    - secure.example.com\n    secretName: secure-tls\n  rules:\n  - host: secure.example.com\n    http:\n      paths:\n      - path: /\n        pathType: Prefix\n        backend:\n          service:\n            name: secure-app\n            port:\n              number: 80\nEOF\n```',
        verify: '```bash\n# Verificar Ingress\nkubectl get ingress secure-ingress\n# Saida esperada: secure.example.com com TLS\n\n# Verificar detalhes\nkubectl describe ingress secure-ingress\n# Saida esperada: TLS: secure-tls terminates secure.example.com\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Ingress Nao Usa TLS / Certificado Nao Aplicado',
      difficulty: 'easy',
      symptom: 'O Ingress esta criado mas o trafego HTTPS retorna certificado padrao do Ingress Controller ao inves do certificado customizado.',
      diagnosis: '```bash\n# Verificar se o Secret existe no namespace correto\nkubectl get secret secure-tls -n <namespace>\n\n# Verificar se o Ingress referencia o Secret correto\nkubectl describe ingress secure-ingress | grep TLS\n\n# Verificar se o host no TLS corresponde ao host nas rules\nkubectl get ingress secure-ingress -o yaml | grep -A 5 tls\n```',
      solution: 'Causas comuns: 1) Secret TLS em namespace diferente do Ingress — mova para o mesmo namespace. 2) spec.tls[].hosts nao corresponde a spec.rules[].host — devem ser iguais. 3) secretName incorreto — verifique o nome exato do Secret. 4) Secret com tipo errado — deve ser kubernetes.io/tls com campos tls.crt e tls.key.'
    },
    {
      title: 'cert-manager Nao Emite Certificado',
      difficulty: 'medium',
      symptom: 'Annotation cert-manager.io/cluster-issuer esta configurada no Ingress, mas o Secret TLS nao e criado e o Certificate fica em estado NotReady.',
      diagnosis: '```bash\n# Verificar status do Certificate\nkubectl get certificate -n <namespace>\n\n# Verificar eventos do Certificate\nkubectl describe certificate <name> -n <namespace>\n\n# Verificar CertificateRequest\nkubectl get certificaterequest -n <namespace>\n\n# Verificar logs do cert-manager\nkubectl logs -n cert-manager deployment/cert-manager\n\n# Verificar se o ClusterIssuer esta Ready\nkubectl get clusterissuer\nkubectl describe clusterissuer letsencrypt-prod\n```',
      solution: 'Causas comuns: 1) ClusterIssuer nao existe ou nao esta Ready — verifique a configuracao ACME. 2) DNS nao aponta para o Ingress — necessario para validacao HTTP-01. 3) Porta 80 bloqueada — HTTP-01 solver precisa acessar porta 80. 4) Rate limit do Let Encrypt — aguarde ou use o servidor staging primeiro. 5) Annotation com nome errado — deve ser cert-manager.io/cluster-issuer (nao cert-manager.io/issuer para ClusterIssuer).'
    }
  ]
};
