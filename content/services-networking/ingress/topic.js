window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['services-networking/ingress'] = {
  theory: `# Ingress e Gateway API

## O que e Ingress?

**Ingress** e um recurso do Kubernetes que gerencia acesso HTTP/HTTPS externo aos Services do cluster. Ele fornece:
- Roteamento baseado em host (virtual hosting)
- Roteamento baseado em path
- Terminacao TLS/SSL
- Load balancing na camada 7 (HTTP)

> **Importante:** Ingress por si so nao faz nada. Requer um **Ingress Controller** instalado no cluster (ex: nginx-ingress-controller).

---

## Ingress Controller

O Ingress Controller e um Pod que roda no cluster e implementa as regras definidas nos recursos Ingress. Controladores populares:

| Controller | Notas |
|-----------|-------|
| ingress-nginx | O mais comum, suportado pela comunidade K8s |
| Traefik | Popular em ambientes Docker/K8s |
| HAProxy | Alto desempenho |
| AWS ALB | Especifico para AWS EKS |
| GCE | Especifico para GKE |

---

## Estrutura do Ingress

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: meu-ingress
  namespace: producao
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx        # qual controller usar
  rules:
    - host: app.empresa.com      # roteamento por host
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: api-service
                port:
                  number: 8080
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend-service
                port:
                  number: 80
\`\`\`

---

## Path Types

| Tipo | Comportamento |
|------|--------------|
| **Prefix** | Prefixo do path. /api faz match com /api, /api/, /api/v1, /api/users |
| **Exact** | Match exato. /api so faz match com /api (nao /api/) |
| **ImplementationSpecific** | Depende do Ingress Controller (comportamento nao padronizado) |

Exemplos:

\`\`\`yaml
paths:
  - path: /api/v1         # Exact: so /api/v1
    pathType: Exact
    backend:
      service:
        name: api-v1
        port:
          number: 80

  - path: /api            # Prefix: /api, /api/v2, /api/users/123
    pathType: Prefix
    backend:
      service:
        name: api-service
        port:
          number: 80
\`\`\`

---

## Roteamento por Host (Virtual Hosting)

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: virtual-hosting
spec:
  ingressClassName: nginx
  rules:
    - host: api.empresa.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api-service
                port:
                  number: 80
    - host: admin.empresa.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: admin-service
                port:
                  number: 80
\`\`\`

---

## TLS/HTTPS

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ingress-tls
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - app.empresa.com
        - api.empresa.com
      secretName: tls-secret     # Secret do tipo kubernetes.io/tls
  rules:
    - host: app.empresa.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: app-service
                port:
                  number: 80
\`\`\`

Criando o Secret TLS:

\`\`\`bash
# Com certificado existente
kubectl create secret tls tls-secret \
  --cert=certificado.crt \
  --key=chave-privada.key \
  -n producao

# Verificar o secret
kubectl get secret tls-secret -o yaml
\`\`\`

---

## Default Backend

Recebe trafego quando nenhuma regra faz match:

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ingress-com-default
spec:
  ingressClassName: nginx
  defaultBackend:               # trafego que nao faz match em nenhuma rule
    service:
      name: pagina-404
      port:
        number: 80
  rules:
    - host: app.empresa.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: app-service
                port:
                  number: 80
\`\`\`

---

## Annotations comuns do nginx-ingress

\`\`\`yaml
metadata:
  annotations:
    # Rewrite o path antes de encaminhar para o backend
    nginx.ingress.kubernetes.io/rewrite-target: /$2

    # Rate limiting
    nginx.ingress.kubernetes.io/limit-rpm: "60"

    # CORS
    nginx.ingress.kubernetes.io/enable-cors: "true"

    # Redirect HTTP para HTTPS
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"

    # Aumentar tamanho maximo do body
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"

    # Usar regex no path
    nginx.ingress.kubernetes.io/use-regex: "true"
\`\`\`

---

## ingressClassName

Define qual Ingress Controller deve processar este Ingress:

\`\`\`bash
# Ver IngressClasses disponiveis no cluster
kubectl get ingressclass

# Definir uma IngressClass como padrao
kubectl annotate ingressclass nginx ingressclass.kubernetes.io/is-default-class=true
\`\`\`

---

## Gateway API (novo padrao)

Gateway API e a evolucao do Ingress, mais expressiva e extensivel. Status: GA em K8s 1.28+.

Principais recursos:

\`\`\`yaml
# GatewayClass: define o tipo de infraestrutura
apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: nginx
spec:
  controllerName: k8s.io/ingress-nginx
---
# Gateway: ponto de entrada de trafego
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: gateway-principal
  namespace: infra
spec:
  gatewayClassName: nginx
  listeners:
    - name: http
      port: 80
      protocol: HTTP
    - name: https
      port: 443
      protocol: HTTPS
      tls:
        mode: Terminate
        certificateRefs:
          - name: tls-secret
---
# HTTPRoute: regras de roteamento HTTP
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: app-route
  namespace: producao
spec:
  parentRefs:
    - name: gateway-principal
      namespace: infra
  hostnames:
    - app.empresa.com
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /api
      backendRefs:
        - name: api-service
          port: 8080
\`\`\`

---

## Comandos de verificacao

\`\`\`bash
# Listar Ingresses
kubectl get ingress -A

# Detalhes (mostra Address do controller)
kubectl describe ingress meu-ingress -n producao

# Ver logs do ingress controller
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller

# Testar roteamento com curl
curl -H "Host: app.empresa.com" http://<INGRESS-IP>/api
\`\`\`
`,

  quiz: [
    {
      question: 'O que e necessario alem do recurso Ingress para que o roteamento HTTP funcione?',
      options: [
        'Um Service do tipo LoadBalancer',
        'Um Ingress Controller instalado no cluster',
        'Uma NetworkPolicy de ingress',
        'Um ConfigMap com as regras de roteamento'
      ],
      correct: 1,
      explanation: 'O recurso Ingress e apenas uma especificacao de regras. Quem as implementa e o Ingress Controller (ex: nginx-ingress-controller). Sem um controller instalado, o recurso Ingress nao tem efeito.'
    },
    {
      question: 'Qual pathType garante que "/api" faz match com "/api/v1/users" mas NAO com "/api-old"?',
      options: ['Exact', 'Prefix', 'ImplementationSpecific', 'Regex'],
      correct: 1,
      explanation: 'Prefix faz match com o path e qualquer sub-path separado por barra. "/api" como Prefix faz match com "/api", "/api/", "/api/v1" mas nao com "/api-old" pois o sufixo "-old" nao comeca com "/".'
    },
    {
      question: 'Como configurar TLS em um Ingress?',
      options: [
        'Adicionar um campo ssl: true no spec',
        'Criar um ConfigMap com o certificado e referenciar em spec.tls',
        'Criar um Secret do tipo kubernetes.io/tls e referenciar em spec.tls[].secretName',
        'Anotar o Ingress com tls.enabled=true'
      ],
      correct: 2,
      explanation: 'TLS requer um Secret do tipo kubernetes.io/tls contendo tls.crt e tls.key. Referenciado em spec.tls[].secretName. O Secret deve estar no mesmo namespace que o Ingress.'
    },
    {
      question: 'O que o campo spec.defaultBackend em um Ingress define?',
      options: [
        'O Service padrao para todo o cluster',
        'O backend que recebe trafego que nao faz match em nenhuma regra',
        'O Ingress Controller padrao',
        'O namespace padrao para os backends'
      ],
      correct: 1,
      explanation: 'spec.defaultBackend define o Service que recebe requisicoes que nao correspondem a nenhuma rule definida. Util para paginas de erro 404 customizadas ou como fallback geral.'
    },
    {
      question: 'Qual e a principal diferenca entre Ingress e Gateway API?',
      options: [
        'Gateway API suporta apenas TCP, Ingress apenas HTTP',
        'Gateway API e mais expressiva, suporta multiplos protocolos e tem melhor separacao de responsabilidades',
        'Ingress e mais novo que Gateway API',
        'Gateway API requer cloud provider, Ingress e local'
      ],
      correct: 1,
      explanation: 'Gateway API e a evolucao do Ingress: suporta HTTP, HTTPS, TCP, UDP e gRPC; tem separacao de responsabilidades (GatewayClass, Gateway, HTTPRoute); e mais expressiva para regras complexas; e status GA desde K8s 1.28.'
    },
    {
      question: 'Qual annotation do nginx-ingress redireciona automaticamente HTTP para HTTPS?',
      options: [
        'nginx.ingress.kubernetes.io/ssl-only: "true"',
        'nginx.ingress.kubernetes.io/force-ssl-redirect: "true"',
        'nginx.ingress.kubernetes.io/https: "force"',
        'nginx.ingress.kubernetes.io/tls-redirect: "true"'
      ],
      correct: 1,
      explanation: 'A annotation nginx.ingress.kubernetes.io/force-ssl-redirect: "true" faz com que o nginx-ingress redirecione (301/302) todas as requisicoes HTTP para HTTPS automaticamente.'
    },
    {
      question: 'Como verificar qual Ingress Controller esta sendo usado em um cluster?',
      options: [
        'kubectl get ingress -o wide',
        'kubectl get ingressclass',
        'kubectl describe namespace ingress',
        'kubectl get controller --type=ingress'
      ],
      correct: 1,
      explanation: 'kubectl get ingressclass lista as IngressClasses disponiveis, mostrando o nome e o controllerName (ex: k8s.io/ingress-nginx). O campo spec.ingressClassName no Ingress referencia uma dessas classes.'
    },
    {
      question: 'Um Ingress esta configurado mas o trafego nao chega aos pods. Os pods estao Running e os Services corretos existem. Qual e o proximo passo?',
      options: [
        'Verificar se o IngressClass correto esta referenciado e se o Ingress Controller esta rodando',
        'Verificar as NetworkPolicies do namespace',
        'Reiniciar os pods do backend',
        'Aumentar os recursos do Service'
      ],
      correct: 0,
      explanation: 'Com pods e services funcionando, o problema esta no Ingress Controller. Verifique: (1) kubectl get pods -n ingress-nginx - controller esta rodando?; (2) spec.ingressClassName corresponde a uma IngressClass valida?; (3) logs do controller: kubectl logs -n ingress-nginx deploy/ingress-nginx-controller; (4) eventos do Ingress: kubectl describe ingress meu-ingress.'
    },
    {
      question: 'Como criar um Ingress que roteie "/" para o service "frontend" e "/api" para o service "backend"?',
      options: [
        'Usando dois recursos Ingress separados, um para cada path',
        'Usando um unico Ingress com multiplas rules ou multiplos paths na mesma rule',
        'Usando um ConfigMap do IngressClass',
        'Adicionando anotacoes de routing ao Service'
      ],
      correct: 1,
      explanation: 'Um unico Ingress pode ter multiplas rules (por host) ou multiplos paths dentro de uma rule. Para o mesmo host com paths diferentes: spec.rules[0].http.paths pode ter multiplos entries, cada um com path e backend service diferentes. Isso e mais eficiente que multiplos Ingress resources.'
    },
    {
      question: 'O que acontece quando spec.ingressClassName nao e especificado em um Ingress?',
      options: [
        'O Ingress nao e processado por nenhum controller',
        'O IngressClass marcado como default (annotation ingressclass.kubernetes.io/is-default-class: "true") e usado',
        'O primeiro Ingress Controller encontrado no cluster e usado',
        'O Ingress usa o controller nginx por padrao'
      ],
      correct: 1,
      explanation: 'Se ingressClassName nao e especificado, o Ingress usa o IngressClass marcado como default (annotation ingressclass.kubernetes.io/is-default-class: "true"). Se nenhum IngressClass e default, o Ingress nao sera processado. Sempre especifique explicitamente ingressClassName em producao.'
    },
    {
      question: 'Voce precisa expor multiplos dominios (host-based routing) via um unico Ingress Controller. Como fazer?',
      options: [
        'Criar um Ingress resource para cada dominio com spec.rules[].host diferente',
        'Criar um IngressClass diferente para cada dominio',
        'Usar LoadBalancer Services para cada dominio',
        'Configurar o ExternalDNS para cada dominio'
      ],
      correct: 0,
      explanation: 'Cada entrada em spec.rules pode ter um campo host diferente. Um unico Ingress pode rotear "api.exemplo.com" para um service e "app.exemplo.com" para outro. Alternativamente, podem ser multiplos Ingress resources apontando para o mesmo IngressClass - tudo converge para o mesmo Ingress Controller.'
    },
    {
      question: 'Como inspecionar os logs do nginx-ingress-controller para debugar problemas de roteamento?',
      options: [
        'kubectl logs -n kube-system deploy/nginx-ingress-controller',
        'kubectl logs -n ingress-nginx deploy/ingress-nginx-controller',
        'kubectl describe ingress --show-logs',
        'kubectl get ingress -o yaml | grep logs'
      ],
      correct: 1,
      explanation: 'O namespace e o nome exato do deployment variam conforme a instalacao, mas geralmente sao ingress-nginx/ingress-nginx-controller. Combine com grep para filtrar: kubectl logs -n ingress-nginx deploy/ingress-nginx-controller | grep "error\\|warn". Verifique tambem kubectl describe ingress para eventos relacionados ao recurso especifico.'
    }
  ],

  flashcards: [
    {
      front: 'Qual e a diferenca entre pathType: Prefix e pathType: Exact?',
      back: 'Prefix faz match com o path e qualquer sub-path (ex: /api faz match com /api/v1/users). Exact faz match apenas com o path identico (ex: /api so faz match com /api exatamente, nao /api/ nem /api/v1).'
    },
    {
      front: 'Como criar um Secret TLS para usar em Ingress?',
      back: 'kubectl create secret tls <nome> --cert=cert.crt --key=key.key -n <namespace>. O secret deve ter tls.crt e tls.key e estar no mesmo namespace do Ingress. Referenciado em spec.tls[].secretName.'
    },
    {
      front: 'O que e ingressClassName e por que e importante?',
      back: 'Campo em spec.ingressClassName que define qual Ingress Controller processa este Ingress. Se multiplos controllers estao instalados, sem este campo pode haver comportamento indefinido. Obrigatorio desde K8s 1.22 (antes era annotation).'
    },
    {
      front: 'Qual a hierarquia de recursos na Gateway API?',
      back: 'GatewayClass (define o tipo de infra/controller) -> Gateway (ponto de entrada, define portas/protocolos) -> HTTPRoute/TCPRoute/etc (regras de roteamento para Services). Cada camada pode ser gerenciada por times diferentes.'
    },
    {
      front: 'Como o Ingress roteia trafego sem host definido em uma rule?',
      back: 'Uma rule sem campo host captura todo trafego que nao faz match com nenhum host especifico. E o equivalente a um wildcard de host. Util como fallback quando varios Ingresses estao configurados.'
    },
    {
      front: 'Como ver o IP externo do Ingress Controller apos deployment?',
      back: 'kubectl get ingress <nome> - a coluna ADDRESS mostra o IP/hostname do controller. Pode demorar alguns minutos em cloud providers. Tambem verificavel em: kubectl get service -n ingress-nginx (ver EXTERNAL-IP do service do controller).'
    },
    {
      front: 'Qual a funcao do annotation rewrite-target no nginx-ingress?',
      back: 'Reescreve o path antes de encaminhar para o backend. Ex: path /api/(.*) com rewrite-target /$1 faz com que /api/users seja encaminhado como /users para o backend. Util quando o backend nao conhece o prefixo do path.'
    }
  ],

  lab: {
    scenario: 'Uma startup quer expor dois microsservicos (API e frontend) publicamente usando um unico IP, diferenciando por path e host. A plataforma deve suportar HTTPS. Voce configurara um Ingress com roteamento por path e host, incluindo TLS.',
    objective: 'Instalar ingress-nginx, criar dois Services, configurar Ingress com roteamento por path, adicionar TLS com Secret, e validar o roteamento usando curl com header Host.',
    steps: [
      {
        title: 'Instalar ingress-nginx e criar aplicacoes de teste',
        instruction: `Instale o ingress-nginx controller no cluster (para Kind/Minikube). Crie dois Deployments: "api-app" (porta 8080) e "frontend-app" (porta 80), cada um com um Service ClusterIP correspondente. Use imagens simples que retornem respostas HTTP diferentes para identificar qual foi atingido.`,
        hints: [
          'Para Minikube: minikube addons enable ingress',
          'Para Kind: aplicar o manifesto oficial do ingress-nginx para Kind',
          'Use hashicorp/http-echo ou nginx com configmap para retornar respostas diferentes',
          'kubectl create deployment + kubectl expose para criar rapidamente'
        ],
        solution: `\`\`\`bash
# Para Minikube
minikube addons enable ingress

# Ou para Kind (instalar controller)
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=90s

# Criar aplicacoes de teste
kubectl create deployment api-app --image=nginx --port=80
kubectl create deployment frontend-app --image=nginx --port=80

# Customizar resposta para identificar cada app
kubectl exec -it deployment/api-app -- sh -c 'echo "API Response" > /usr/share/nginx/html/index.html'
kubectl exec -it deployment/frontend-app -- sh -c 'echo "Frontend Response" > /usr/share/nginx/html/index.html'

# Criar services
kubectl expose deployment api-app --port=80 --name=api-svc
kubectl expose deployment frontend-app --port=80 --name=frontend-svc

kubectl get services
\`\`\``
      },
      {
        title: 'Criar Ingress com roteamento por path',
        instruction: `Crie um recurso Ingress que roteia o trafego baseado no path: "/api" para o api-svc e "/" para o frontend-svc. Use pathType Prefix para ambos. Teste o roteamento usando curl com o IP do Ingress Controller.`,
        hints: [
          'A ordem dos paths importa: paths mais especificos (como /api) devem vir antes de /',
          'kubectl get ingress mostra o ADDRESS do controller',
          'Para Minikube: minikube ip para obter o IP',
          'Use curl -H "Host: app.local" http://<IP>/api para simular o roteamento'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  rules:
    - host: app.local
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: api-svc
                port:
                  number: 80
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend-svc
                port:
                  number: 80
EOF

# Aguardar ADDRESS aparecer
kubectl get ingress app-ingress -w

# Obter IP do controller
INGRESS_IP=$(kubectl get ingress app-ingress -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

# Testar roteamento
curl -H "Host: app.local" http://$INGRESS_IP/
curl -H "Host: app.local" http://$INGRESS_IP/api
\`\`\``
      },
      {
        title: 'Configurar TLS com Secret',
        instruction: `Crie um certificado autoassinado, armazene como Secret TLS, e configure o Ingress para usar HTTPS no host "app.local". Teste a conexao HTTPS com curl e o flag -k para ignorar validacao do certificado autoassinado.`,
        hints: [
          'Use openssl req -x509 -nodes -days 365 -newkey rsa:2048 para gerar cert autoassinado',
          'kubectl create secret tls <nome> --cert=... --key=... para criar o Secret',
          'Adicione spec.tls no Ingress referenciando o secretName',
          'curl -k -H "Host: app.local" https://$INGRESS_IP/ para testar HTTPS'
        ],
        solution: `\`\`\`bash
# Gerar certificado autoassinado
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout tls.key \
  -out tls.crt \
  -subj "/CN=app.local/O=estudok8s"

# Criar Secret TLS
kubectl create secret tls app-local-tls \
  --cert=tls.crt \
  --key=tls.key

# Atualizar Ingress com TLS
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - app.local
      secretName: app-local-tls
  rules:
    - host: app.local
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: api-svc
                port:
                  number: 80
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend-svc
                port:
                  number: 80
EOF

INGRESS_IP=$(kubectl get ingress app-ingress -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

# Testar HTTPS
curl -k -H "Host: app.local" https://$INGRESS_IP/
curl -k -H "Host: app.local" https://$INGRESS_IP/api

# HTTP deve redirecionar para HTTPS (302)
curl -v -H "Host: app.local" http://$INGRESS_IP/ 2>&1 | grep "Location:"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Ingress retorna 404 ou 503 mesmo com servicos funcionando',
      symptom: 'curl para o IP do Ingress retorna 404 Not Found ou 503 Service Unavailable, mas os Services e Pods estao funcionando corretamente quando testados diretamente.',
      diagnosis: `Diagnostico passo a passo:

\`\`\`bash
# 1. Verificar se o Ingress tem ADDRESS (IP do controller)
kubectl get ingress meu-ingress
# Se ADDRESS estiver vazio, o Ingress Controller nao esta processando

# 2. Verificar se o ingressClassName existe e esta correto
kubectl get ingressclass
kubectl get ingress meu-ingress -o jsonpath='{.spec.ingressClassName}'

# 3. Verificar se os Services e Pods do backend estao ok
kubectl get endpoints api-svc
# Se vazio: problema no selector do Service

# 4. Ver logs do Ingress Controller
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller --tail=50

# 5. Verificar se o host no curl bate com o host no Ingress
kubectl get ingress meu-ingress -o jsonpath='{.spec.rules[*].host}'
# Se ha host definido, o curl DEVE enviar o header Host correto

# 6. Verificar se os ports no Ingress batem com os ports dos Services
kubectl get service api-svc -o jsonpath='{.spec.ports}'
\`\`\`

**Causas comuns do 404:** host no curl diferente do host no Ingress, ingressClassName errado
**Causas comuns do 503:** Service sem Endpoints (Pods nao Running ou selector errado)`,
      solution: `**Correcoes por causa:**

\`\`\`bash
# Para 404 por host incorreto: sempre enviar header Host
curl -H "Host: app.local" http://INGRESS_IP/

# Para ingressClassName errado: corrigir no spec
kubectl edit ingress meu-ingress
# Corrigir spec.ingressClassName para bater com kubectl get ingressclass

# Para 503 por Service sem Endpoints:
kubectl describe endpoints api-svc
# Se vazio, corrigir o selector do Service para bater com labels dos Pods

# Verificar se o port do backend no Ingress bate com o port do Service
# No Ingress: backend.service.port.number deve ser a porta do Service (spec.ports[].port)
# NAO a containerPort do Pod

# Ver eventos do Ingress para erros especificos
kubectl describe ingress meu-ingress | grep -A 10 Events
\`\`\``
    }
  ]
};
