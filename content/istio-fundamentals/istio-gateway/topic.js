window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['istio-fundamentals/istio-gateway'] = {
  theory: `
# Gateways & Ingress no Istio

## Relevancia
Gateways sao o ponto de entrada do trafego externo no service mesh. Entender como configurar Ingress Gateway com TLS, egress controlado e integracao com VirtualService e fundamental para expor servicos de forma segura em producao.

## Conceitos Fundamentais

### Gateway vs Kubernetes Ingress vs Gateway API

| Recurso | Controlador | Camada | Recursos |
|---------|-------------|--------|----------|
| K8s Ingress | nginx, traefik | L7 HTTP | Basico: host/path routing |
| Istio Gateway | Envoy (istio) | L4-L7 | TLS, SNI, mTLS, multi-protocol |
| Gateway API | Varios (incl. Istio) | L4-L7 | Padrao futuro, mais expressivo |

### Istio Gateway Resource

O Gateway configura o load balancer do mesh na borda (ingress/egress):

\`\`\`yaml
apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: bookinfo-gateway
spec:
  selector:
    istio: ingressgateway    # seleciona o Pod do ingress gateway
  servers:
    - port:
        number: 80
        name: http
        protocol: HTTP
      hosts:
        - "bookinfo.example.com"
    - port:
        number: 443
        name: https
        protocol: HTTPS
      tls:
        mode: SIMPLE
        credentialName: bookinfo-tls-cert
      hosts:
        - "bookinfo.example.com"
\`\`\`

### Gateway + VirtualService (Binding)

O Gateway define ONDE escutar. O VirtualService define COMO rotear:

\`\`\`yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: bookinfo
spec:
  hosts:
    - "bookinfo.example.com"
  gateways:
    - bookinfo-gateway       # bind ao Gateway
  http:
    - match:
        - uri:
            prefix: /productpage
      route:
        - destination:
            host: productpage
            port:
              number: 9080
    - match:
        - uri:
            prefix: /api/v1
      route:
        - destination:
            host: reviews
            port:
              number: 9080
\`\`\`

### TLS Termination

**Simple TLS (HTTPS):**
\`\`\`bash
# Criar Secret com certificado TLS
kubectl create -n istio-system secret tls bookinfo-tls-cert \\
  --key=privkey.pem \\
  --cert=fullchain.pem
\`\`\`

\`\`\`yaml
# Gateway com TLS
servers:
  - port:
      number: 443
      name: https
      protocol: HTTPS
    tls:
      mode: SIMPLE                    # termina TLS no gateway
      credentialName: bookinfo-tls-cert
    hosts:
      - "bookinfo.example.com"
\`\`\`

**Mutual TLS (client cert):**
\`\`\`yaml
servers:
  - port:
      number: 443
      name: https
      protocol: HTTPS
    tls:
      mode: MUTUAL                    # requer certificado do cliente
      credentialName: bookinfo-tls-cert
      # CA para validar cert do cliente e inferida do credentialName
    hosts:
      - "bookinfo.example.com"
\`\`\`

**TLS Passthrough (nao termina TLS):**
\`\`\`yaml
servers:
  - port:
      number: 443
      name: tls
      protocol: TLS
    tls:
      mode: PASSTHROUGH               # passa TLS direto para o backend
    hosts:
      - "bookinfo.example.com"
\`\`\`

### SNI-Based Routing

Rotear para diferentes servicos baseado no hostname (Server Name Indication):

\`\`\`yaml
apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: multi-host-gateway
spec:
  selector:
    istio: ingressgateway
  servers:
    - port:
        number: 443
        name: https
        protocol: HTTPS
      tls:
        mode: SIMPLE
        credentialName: app1-cert
      hosts:
        - "app1.example.com"
    - port:
        number: 443
        name: https-app2
        protocol: HTTPS
      tls:
        mode: SIMPLE
        credentialName: app2-cert
      hosts:
        - "app2.example.com"
\`\`\`

### Egress Gateway

Controla trafego de saida do mesh:

\`\`\`yaml
apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: egress-gateway
spec:
  selector:
    istio: egressgateway
  servers:
    - port:
        number: 443
        name: tls
        protocol: TLS
      hosts:
        - "api.external.com"
      tls:
        mode: PASSTHROUGH
---
apiVersion: networking.istio.io/v1beta1
kind: ServiceEntry
metadata:
  name: external-api
spec:
  hosts:
    - api.external.com
  ports:
    - number: 443
      name: tls
      protocol: TLS
  resolution: DNS
  location: MESH_EXTERNAL
---
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: external-via-egress
spec:
  hosts:
    - api.external.com
  gateways:
    - mesh
    - egress-gateway
  tls:
    - match:
        - gateways:
            - mesh
          port: 443
          sniHosts:
            - api.external.com
      route:
        - destination:
            host: istio-egressgateway.istio-system.svc.cluster.local
            port:
              number: 443
    - match:
        - gateways:
            - egress-gateway
          port: 443
          sniHosts:
            - api.external.com
      route:
        - destination:
            host: api.external.com
            port:
              number: 443
\`\`\`

### Erros Comuns

1. **VirtualService sem gateways field** — o VS precisa referenciar o Gateway pelo nome
2. **credentialName errado** — o Secret TLS deve estar no namespace istio-system
3. **Host mismatch** — o host no Gateway e no VirtualService devem coincidir
4. **Porta conflitante** — dois servers na mesma porta precisam de hosts diferentes

## Killer.sh Style Challenge

> **Cenario:** Configure um Ingress Gateway com TLS para dois dominios: app1.example.com e app2.example.com, cada um com seu proprio certificado. Roteie app1 para o servico frontend e app2 para o servico api.
`,
  quiz: [
    {
      question: 'Qual a diferenca entre Gateway e VirtualService no Istio?',
      options: [
        'Gateway define routing, VirtualService define TLS',
        'Gateway define onde escutar (portas/hosts/TLS), VirtualService define como rotear',
        'Sao a mesma coisa com nomes diferentes',
        'Gateway e para ingress, VirtualService e para egress'
      ],
      correct: 1,
      explanation: 'O Gateway configura os listeners do load balancer na borda (portas, protocolos, TLS). O VirtualService define as regras de routing que se aplicam ao trafego que passa por esse Gateway.',
      reference: 'Conceito relacionado: O campo gateways no VirtualService faz o binding entre os dois recursos.'
    },
    {
      question: 'Onde deve ficar o Secret TLS referenciado por credentialName no Gateway?',
      options: [
        'No namespace da aplicacao',
        'No namespace istio-system',
        'Em qualquer namespace',
        'No namespace kube-system'
      ],
      correct: 1,
      explanation: 'O credentialName referencia um Secret Kubernetes que deve estar no mesmo namespace do Gateway Pod (tipicamente istio-system para o ingress gateway padrao).',
      reference: 'Conceito relacionado: kubectl create secret tls -n istio-system.'
    },
    {
      question: 'Qual modo TLS no Gateway passa a conexao TLS diretamente para o backend sem terminar?',
      options: ['SIMPLE', 'MUTUAL', 'PASSTHROUGH', 'ISTIO_MUTUAL'],
      correct: 2,
      explanation: 'O modo PASSTHROUGH nao termina TLS no gateway — a conexao criptografada e passada diretamente para o servico backend, que e responsavel pela terminacao TLS.',
      reference: 'Conceito relacionado: PASSTHROUGH requer protocol TLS (nao HTTPS) no Gateway.'
    },
    {
      question: 'Como expor multiplos dominios no mesmo Ingress Gateway com HTTPS?',
      options: [
        'Criar um Gateway separado para cada dominio',
        'Configurar multiplos servers na mesma porta 443 com hosts e credentialName diferentes',
        'Nao e possivel com Istio',
        'Usar um unico certificado wildcard'
      ],
      correct: 1,
      explanation: 'O Istio suporta SNI-based routing: multiplos servers na porta 443, cada um com seu host e credentialName. O Envoy usa SNI para selecionar o certificado correto.',
      reference: 'Conceito relacionado: SNI (Server Name Indication) permite multiplos certificados na mesma porta.'
    },
    {
      question: 'Qual a funcao do Egress Gateway?',
      options: [
        'Bloquear todo trafego de entrada',
        'Centralizar e controlar trafego de saida do mesh',
        'Fazer load balancing entre clusters',
        'Gerenciar certificados TLS'
      ],
      correct: 1,
      explanation: 'O Egress Gateway centraliza trafego egress, permitindo auditoria, politicas de seguranca e controle de acesso a servicos externos. Todo trafego de saida passa pelo egress gateway.',
      reference: 'Conceito relacionado: ServiceEntry + VirtualService + Egress Gateway para controle completo.'
    },
    {
      question: 'Como um VirtualService se conecta a um Gateway especifico?',
      options: [
        'Pelo nome do namespace',
        'Pelo campo spec.gateways no VirtualService',
        'Automaticamente por host match',
        'Via annotation no Gateway'
      ],
      correct: 1,
      explanation: 'O campo spec.gateways no VirtualService lista os nomes dos Gateways que ele referencia. O valor especial "mesh" indica trafego interno do mesh (sem gateway).',
      reference: 'Conceito relacionado: gateways: ["mesh", "my-gateway"] aplica regras tanto para trafego interno quanto externo.'
    },
    {
      question: 'Qual o valor especial no campo gateways que indica trafego interno do mesh?',
      options: ['internal', 'mesh', 'cluster', 'sidecar'],
      correct: 1,
      explanation: 'O valor "mesh" no campo gateways indica que as regras do VirtualService se aplicam ao trafego entre sidecars dentro do mesh, sem passar por um Gateway.',
      reference: 'Conceito relacionado: Se gateways nao for especificado, o padrao e "mesh".'
    }
  ],
  flashcards: [
    {
      front: 'Quais sao os modos TLS disponiveis no Istio Gateway?',
      back: '1. **SIMPLE** — termina TLS no gateway (server cert)\n2. **MUTUAL** — termina TLS + requer client cert\n3. **PASSTHROUGH** — nao termina TLS, passa direto ao backend\n4. **ISTIO_MUTUAL** — mTLS interno usando certs do Istio\n5. **AUTO_PASSTHROUGH** — SNI auto para multi-cluster'
    },
    {
      front: 'Qual a relacao entre Gateway e VirtualService?',
      back: '**Gateway** define:\n- Selector (qual pod do gateway)\n- Portas e protocolos\n- TLS config\n- Hosts aceitos\n\n**VirtualService** define:\n- Regras de routing\n- Match por URI, header\n- Destinos e pesos\n\n**Binding:** VS.spec.gateways referencia o Gateway por nome.\nO host no VS deve estar entre os hosts do Gateway.'
    },
    {
      front: 'Como configurar TLS no Istio Ingress Gateway?',
      back: '1. Criar Secret TLS no namespace istio-system:\n\`\`\`bash\nkubectl create -n istio-system secret tls my-cert \\\\\n  --key=key.pem --cert=cert.pem\n\`\`\`\n\n2. Configurar Gateway:\n\`\`\`yaml\ntls:\n  mode: SIMPLE\n  credentialName: my-cert\n\`\`\`\n\ncredentialName = nome do Secret'
    },
    {
      front: 'O que e SNI e como o Istio usa?',
      back: '**SNI (Server Name Indication)** e uma extensao TLS que envia o hostname no handshake.\n\n**Uso no Istio:**\n- Permite multiplos dominios HTTPS na mesma porta 443\n- Cada dominio tem seu proprio certificado\n- O Envoy usa SNI para selecionar o cert correto\n- Essencial para multi-tenant ingress'
    },
    {
      front: 'Qual a diferenca entre Ingress Gateway e Egress Gateway?',
      back: '**Ingress Gateway:**\n- Trafego externo -> mesh\n- Expoe servicos para clientes\n- TLS termination\n- Routing por host/path\n\n**Egress Gateway:**\n- Trafego mesh -> externo\n- Centraliza trafego de saida\n- Auditoria e compliance\n- Requer ServiceEntry + VirtualService'
    },
    {
      front: 'Quando usar PASSTHROUGH vs SIMPLE no TLS?',
      back: '**SIMPLE (TLS termination):**\n- Gateway termina TLS\n- Backend recebe plaintext\n- Mais simples de gerenciar\n- Gateway precisa do certificado\n\n**PASSTHROUGH:**\n- Gateway nao termina TLS\n- TLS end-to-end ate o backend\n- Backend gerencia seu proprio cert\n- Necessario para protocolos non-HTTP'
    },
    {
      front: 'Como funciona o padrao Egress Gateway para controlar saida?',
      back: 'Tres recursos necessarios:\n\n1. **ServiceEntry** — registra host externo\n2. **Gateway** (egress) — define listener de saida\n3. **VirtualService** com dois matches:\n   - gateway: mesh -> roteia para egress gw\n   - gateway: egress-gw -> roteia para host externo\n\nTodo trafego egress passa pelo gateway, habilitando auditoria e controle.'
    }
  ],
  lab: {
    scenario: 'Voce precisa expor uma aplicacao web externamente com HTTPS e configurar egress controlado para uma API externa.',
    objective: 'Configurar Ingress Gateway com TLS, VirtualService com routing e Egress Gateway com ServiceEntry.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Configurar Ingress Gateway com HTTPS',
        instruction: `Crie um Gateway com TLS e um VirtualService para expor a aplicacao externamente.

\`\`\`bash
# Criar certificado auto-assinado para teste
openssl req -x509 -sha256 -nodes -days 365 -newkey rsa:2048 \\
  -subj '/O=example/CN=bookinfo.example.com' \\
  -keyout bookinfo.key -out bookinfo.crt

# Criar Secret TLS no namespace istio-system
kubectl create -n istio-system secret tls bookinfo-tls \\
  --key=bookinfo.key --cert=bookinfo.crt

# Criar Gateway + VirtualService
kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: bookinfo-gateway
spec:
  selector:
    istio: ingressgateway
  servers:
    - port:
        number: 443
        name: https
        protocol: HTTPS
      tls:
        mode: SIMPLE
        credentialName: bookinfo-tls
      hosts:
        - "bookinfo.example.com"
    - port:
        number: 80
        name: http
        protocol: HTTP
      hosts:
        - "bookinfo.example.com"
      tls:
        httpsRedirect: true
---
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: bookinfo
spec:
  hosts:
    - "bookinfo.example.com"
  gateways:
    - bookinfo-gateway
  http:
    - match:
        - uri:
            prefix: /
      route:
        - destination:
            host: productpage
            port:
              number: 9080
EOF
\`\`\``,
        hints: [
          'O Secret TLS deve estar no namespace istio-system',
          'credentialName corresponde ao nome do Secret',
          'httpsRedirect: true redireciona HTTP para HTTPS automaticamente'
        ],
        solution: `\`\`\`bash
openssl req -x509 -sha256 -nodes -days 365 -newkey rsa:2048 -subj '/O=example/CN=bookinfo.example.com' -keyout bookinfo.key -out bookinfo.crt
kubectl create -n istio-system secret tls bookinfo-tls --key=bookinfo.key --cert=bookinfo.crt
kubectl apply -f gateway-setup.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verificar Gateway
kubectl get gateway bookinfo-gateway
# Saida esperada: bookinfo-gateway   Xs

# Verificar Secret TLS
kubectl get secret bookinfo-tls -n istio-system
# Saida esperada: bookinfo-tls   kubernetes.io/tls   2   Xs

# Verificar VirtualService
kubectl get vs bookinfo -o jsonpath='{.spec.gateways}'
# Saida esperada: ["bookinfo-gateway"]

# Testar HTTPS
INGRESS_IP=\$(kubectl get svc istio-ingressgateway -n istio-system -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
curl -sk https://bookinfo.example.com --resolve "bookinfo.example.com:443:\$INGRESS_IP" -o /dev/null -w "%{http_code}"
# Saida esperada: 200
\`\`\``
      },
      {
        title: 'Configurar Multi-Host com SNI',
        instruction: `Adicione um segundo dominio ao mesmo Ingress Gateway com seu proprio certificado.

\`\`\`bash
# Criar certificado para o segundo dominio
openssl req -x509 -sha256 -nodes -days 365 -newkey rsa:2048 \\
  -subj '/O=example/CN=api.example.com' \\
  -keyout api.key -out api.crt

kubectl create -n istio-system secret tls api-tls \\
  --key=api.key --cert=api.crt

# Atualizar Gateway com segundo host
kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: bookinfo-gateway
spec:
  selector:
    istio: ingressgateway
  servers:
    - port:
        number: 443
        name: https-bookinfo
        protocol: HTTPS
      tls:
        mode: SIMPLE
        credentialName: bookinfo-tls
      hosts:
        - "bookinfo.example.com"
    - port:
        number: 443
        name: https-api
        protocol: HTTPS
      tls:
        mode: SIMPLE
        credentialName: api-tls
      hosts:
        - "api.example.com"
---
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: api-vs
spec:
  hosts:
    - "api.example.com"
  gateways:
    - bookinfo-gateway
  http:
    - route:
        - destination:
            host: reviews
            port:
              number: 9080
EOF
\`\`\``,
        hints: [
          'Cada server pode ter seu proprio credentialName para certificados diferentes',
          'O Envoy usa SNI para selecionar o certificado correto baseado no hostname',
          'Os nomes dos servers devem ser unicos (https-bookinfo, https-api)'
        ],
        solution: `\`\`\`bash
openssl req -x509 -sha256 -nodes -days 365 -newkey rsa:2048 -subj '/O=example/CN=api.example.com' -keyout api.key -out api.crt
kubectl create -n istio-system secret tls api-tls --key=api.key --cert=api.crt
kubectl apply -f multi-host-gateway.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verificar Gateway com dois servers
kubectl get gateway bookinfo-gateway -o jsonpath='{.spec.servers[*].hosts}'
# Saida esperada: ["bookinfo.example.com"] ["api.example.com"]

# Verificar Secrets
kubectl get secrets -n istio-system | grep tls
# Saida esperada: bookinfo-tls e api-tls

# Testar segundo dominio
INGRESS_IP=\$(kubectl get svc istio-ingressgateway -n istio-system -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
curl -sk https://api.example.com --resolve "api.example.com:443:\$INGRESS_IP" -o /dev/null -w "%{http_code}"
# Saida esperada: 200
\`\`\``
      },
      {
        title: 'Configurar Egress Gateway',
        instruction: `Configure controle de trafego de saida usando Egress Gateway e ServiceEntry.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: ServiceEntry
metadata:
  name: httpbin-ext
spec:
  hosts:
    - httpbin.org
  ports:
    - number: 80
      name: http
      protocol: HTTP
  resolution: DNS
  location: MESH_EXTERNAL
---
apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: httpbin-egress
  namespace: istio-system
spec:
  selector:
    istio: egressgateway
  servers:
    - port:
        number: 80
        name: http
        protocol: HTTP
      hosts:
        - httpbin.org
---
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: httpbin-egress-vs
spec:
  hosts:
    - httpbin.org
  gateways:
    - mesh
    - istio-system/httpbin-egress
  http:
    - match:
        - gateways:
            - mesh
          port: 80
      route:
        - destination:
            host: istio-egressgateway.istio-system.svc.cluster.local
            port:
              number: 80
    - match:
        - gateways:
            - istio-system/httpbin-egress
          port: 80
      route:
        - destination:
            host: httpbin.org
            port:
              number: 80
EOF
\`\`\``,
        hints: [
          'O trafego do mesh vai primeiro para o egress gateway, depois para o destino externo',
          'O VirtualService precisa de dois matches: mesh -> egress gw, egress gw -> externo',
          'O egress gateway deve estar no namespace istio-system'
        ],
        solution: `\`\`\`bash
kubectl apply -f egress-setup.yaml

# Testar acesso via egress gateway
kubectl exec deploy/sleep -c sleep -- curl -s http://httpbin.org/get -o /dev/null -w "%{http_code}"
\`\`\``,
        verify: `\`\`\`bash
# Verificar ServiceEntry
kubectl get serviceentry httpbin-ext
# Saida esperada: httpbin-ext   ["httpbin.org"]   Xs

# Verificar Gateway egress
kubectl get gateway httpbin-egress -n istio-system
# Saida esperada: httpbin-egress   Xs

# Verificar que trafego passa pelo egress gateway (nos logs)
kubectl logs -n istio-system deploy/istio-egressgateway --tail=5 | grep httpbin
# Saida esperada: logs mostrando requisicoes para httpbin.org
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Gateway criado mas trafego retorna 404',
      difficulty: 'easy',
      symptom: 'O Ingress Gateway esta acessivel mas todas as requisicoes retornam 404 Not Found.',
      diagnosis: `\`\`\`bash
# Verificar se VirtualService referencia o Gateway
kubectl get vs -o jsonpath='{range .items[*]}{.metadata.name}{" gateways="}{.spec.gateways}{"\\n"}{end}'

# Verificar hosts do Gateway e VirtualService
kubectl get gateway -o jsonpath='{range .items[*]}{.metadata.name}{" hosts="}{.spec.servers[*].hosts}{"\\n"}{end}'
kubectl get vs -o jsonpath='{range .items[*]}{.metadata.name}{" hosts="}{.spec.hosts}{"\\n"}{end}'

# Verificar rotas no proxy do ingress gateway
istioctl proxy-config routes deploy/istio-ingressgateway -n istio-system

# Analisar configuracao
istioctl analyze
\`\`\``,
      solution: `**Causas comuns:**

1. **VirtualService sem gateways:** O campo spec.gateways deve incluir o nome do Gateway.

2. **Host mismatch:** O host no VirtualService deve estar entre os hosts aceitos pelo Gateway.

3. **Gateway em namespace diferente:** Se o Gateway esta em outro namespace, usar \`namespace/gateway-name\` no campo gateways do VS.

4. **Sem match no VS:** Verificar que as regras de match (URI prefix/exact) correspondem as requisicoes enviadas.`
    },
    {
      title: 'Certificado TLS nao funciona no Gateway',
      difficulty: 'medium',
      symptom: 'O Gateway esta configurado com TLS mas o navegador mostra erro de certificado ou a conexao e recusada.',
      diagnosis: `\`\`\`bash
# Verificar se o Secret existe no namespace correto
kubectl get secret -n istio-system | grep tls

# Verificar conteudo do Secret
kubectl get secret bookinfo-tls -n istio-system -o jsonpath='{.data.tls\\.crt}' | base64 -d | openssl x509 -text -noout | head -10

# Verificar logs do ingress gateway
kubectl logs -n istio-system deploy/istio-ingressgateway | grep -i "secret\\|tls\\|cert"

# Testar conexao TLS
INGRESS_IP=\$(kubectl get svc istio-ingressgateway -n istio-system -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
openssl s_client -connect \$INGRESS_IP:443 -servername bookinfo.example.com </dev/null 2>&1 | head -20
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Secret no namespace errado:** O Secret deve estar no namespace istio-system (ou no namespace do gateway Pod).

2. **Tipo de Secret errado:** Deve ser \`kubernetes.io/tls\` com campos \`tls.crt\` e \`tls.key\`.

3. **credentialName errado:** Verificar que o nome no Gateway corresponde exatamente ao nome do Secret.

4. **Certificado expirado ou invalido:** Verificar validade com openssl.

5. **SDS nao atualizou:** Apos criar/atualizar o Secret, pode levar alguns segundos para o proxy recarregar. Verificar logs do gateway.`
    },
    {
      title: 'Egress Gateway nao roteia trafego externo',
      difficulty: 'hard',
      symptom: 'Configurou Egress Gateway mas o trafego nao passa pelo gateway. Requisicoes para servicos externos falham ou vao direto sem passar pelo egress.',
      diagnosis: `\`\`\`bash
# Verificar se o egress gateway Pod esta rodando
kubectl get pods -n istio-system -l istio=egressgateway

# Verificar ServiceEntry
kubectl get serviceentry -o yaml

# Verificar VirtualService
kubectl get vs -o yaml | grep -A20 "gateways"

# Verificar se o trafego passa pelo egress (logs)
kubectl logs -n istio-system deploy/istio-egressgateway --tail=20

# Verificar configuracao do proxy do app
POD=\$(kubectl get pod -l app=sleep -o jsonpath='{.items[0].metadata.name}')
istioctl proxy-config routes \$POD | grep <host-externo>
\`\`\``,
      solution: `**Causas comuns:**

1. **Perfil sem egress gateway:** O perfil default nao inclui egress gateway. Usar perfil demo ou instalar manualmente.

2. **VirtualService incompleto:** Precisam de dois matches — \`mesh\` (sidecar -> egress) e o gateway egress (egress -> externo).

3. **Outbound policy ALLOW_ANY:** Se o mesh permite todo trafego egress, os sidecars enviam direto. Configurar REGISTRY_ONLY para forcar uso do egress gateway.

4. **Namespace errado:** O Gateway egress tipicamente fica em istio-system. Referenciar como \`istio-system/gateway-name\` no VirtualService.`
    }
  ]
};
