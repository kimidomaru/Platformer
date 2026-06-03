window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['istio-fundamentals/istio-architecture'] = {
  theory: `
# Istio Architecture & Installation

## Relevancia
Istio e o service mesh mais adotado no ecossistema Kubernetes. Ele fornece observabilidade, seguranca (mTLS) e controle de trafego sem alterar codigo da aplicacao. Entender sua arquitetura e fundamental para qualquer profissional DevOps/SRE que trabalha com microservicos em producao.

## Conceitos Fundamentais

### O que e um Service Mesh?

Um service mesh e uma camada de infraestrutura dedicada que gerencia comunicacao servico-a-servico. Ele intercepta todo trafego de rede entre microservicos usando proxies sidecar.

\`\`\`
Sem Service Mesh:              Com Service Mesh:
+-------+    +-------+        +-------+---+    +---+-------+
| App A |--->| App B |        | App A | P |--->| P | App B |
+-------+    +-------+        +-------+---+    +---+-------+
                                         \\        /
                                    Control Plane (istiod)
\`\`\`

### Arquitetura do Istio

O Istio e composto por dois planos:

**Control Plane (istiod):**
- **Pilot** — distribui configuracao de routing para os proxies Envoy
- **Citadel** — gerencia certificados e identidades (mTLS/SPIFFE)
- **Galley** — valida e distribui configuracao

Desde o Istio 1.5, todos os componentes foram consolidados em um unico binario: **istiod**.

\`\`\`
                    +-----------------+
                    |     istiod      |
                    |  (Pilot +       |
                    |   Citadel +     |
                    |   Galley)       |
                    +--------+--------+
                             |
              xDS API (config push)
                             |
         +-------------------+-------------------+
         |                   |                   |
    +----+----+         +----+----+         +----+----+
    | Envoy   |         | Envoy   |         | Envoy   |
    | Proxy   |         | Proxy   |         | Proxy   |
    +----+----+         +----+----+         +----+----+
    | App A   |         | App B   |         | App C   |
    +---------+         +---------+         +---------+
\`\`\`

**Data Plane (Envoy Proxy):**
- Proxy L4/L7 de alta performance
- Injetado como sidecar em cada Pod
- Intercepta todo trafego de entrada e saida via iptables
- Reporta telemetria para o control plane

### Sidecar Injection

O Istio injeta automaticamente o container Envoy em Pods usando um **mutating admission webhook**. Existem dois modos:

\`\`\`bash
# Habilitar injection automatica por namespace
kubectl label namespace default istio-injection=enabled

# Verificar label
kubectl get namespace -L istio-injection

# Injection manual (para namespaces sem auto-injection)
istioctl kube-inject -f deployment.yaml | kubectl apply -f -
\`\`\`

Para desabilitar injection em um Pod especifico:
\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  annotations:
    sidecar.istio.io/inject: "false"
spec:
  containers:
    - name: app
      image: myapp:1.0
\`\`\`

### Perfis de Instalacao

O Istio oferece perfis pre-configurados:

| Perfil | Componentes | Uso |
|--------|-------------|-----|
| default | istiod + ingress gateway | Producao |
| demo | istiod + ingress + egress + tracing | Teste/Lab |
| minimal | Apenas istiod | Controle minimo |
| remote | Agentes remotos | Multi-cluster |
| empty | Nada instalado | Base customizada |

\`\`\`bash
# Instalar com perfil default
istioctl install --set profile=default -y

# Instalar com perfil demo (inclui mais recursos para lab)
istioctl install --set profile=demo -y

# Ver configuracao de um perfil
istioctl profile dump demo

# Comparar perfis
istioctl profile diff default demo
\`\`\`

### Comandos Essenciais do istioctl

\`\`\`bash
# Verificar status da instalacao
istioctl verify-install

# Analisar configuracao do mesh
istioctl analyze

# Analisar um namespace especifico
istioctl analyze -n production

# Ver configuracao do proxy de um Pod
istioctl proxy-config routes <pod-name> -n <namespace>

# Ver clusters conhecidos pelo proxy
istioctl proxy-config clusters <pod-name> -n <namespace>

# Ver listeners do proxy
istioctl proxy-config listeners <pod-name> -n <namespace>

# Dashboard do proxy (Envoy admin)
istioctl dashboard envoy <pod-name> -n <namespace>

# Dashboard do Kiali
istioctl dashboard kiali
\`\`\`

### Recursos CRD do Istio

O Istio estende o Kubernetes com CRDs especificos:

| CRD | Funcao |
|-----|--------|
| VirtualService | Regras de routing de trafego |
| DestinationRule | Politicas de conexao/load balancing |
| Gateway | Ponto de entrada para trafego externo |
| ServiceEntry | Registro de servicos externos |
| PeerAuthentication | Politica de mTLS |
| AuthorizationPolicy | Controle de acesso L4/L7 |
| Sidecar | Controle fino do escopo do proxy |
| EnvoyFilter | Customizacao direta do Envoy |

### Erros Comuns

1. **Sidecar nao injetado** — esqueceu de rotular o namespace com \`istio-injection=enabled\`
2. **503 entre servicos** — DestinationRule com mTLS strict sem PeerAuthentication correspondente
3. **Timeout no startup** — init container do istio-proxy demora; ajustar \`holdApplicationUntilProxyStarts\`
4. **Memory overhead** — cada sidecar Envoy consome ~50-100MB de RAM

## Killer.sh Style Challenge

> **Cenario:** Instale o Istio com perfil demo no cluster. Habilite sidecar injection no namespace \`production\`. Faca deploy de uma aplicacao com 2 replicas e verifique que todos os Pods tem 2 containers (app + istio-proxy).
`,
  quiz: [
    {
      question: 'Qual componente do Istio e responsavel por distribuir configuracao de routing para os proxies Envoy?',
      options: ['Citadel', 'Galley', 'Pilot (dentro do istiod)', 'Mixer'],
      correct: 2,
      explanation: 'Pilot (agora integrado ao istiod) e responsavel por converter regras de alto nivel (VirtualService, DestinationRule) em configuracao xDS que o Envoy entende.',
      reference: 'Conceito relacionado: xDS API e como Pilot distribui configuracao para o data plane.'
    },
    {
      question: 'Como habilitar a injecao automatica de sidecar Envoy em um namespace?',
      options: [
        'kubectl annotate namespace default sidecar=true',
        'kubectl label namespace default istio-injection=enabled',
        'istioctl inject --namespace default',
        'kubectl patch namespace default --type=merge -p \'{"spec":{"istio":"enabled"}}\''
      ],
      correct: 1,
      explanation: 'O Istio usa um mutating webhook que observa o label istio-injection=enabled nos namespaces para injetar automaticamente o sidecar Envoy em novos Pods.',
      reference: 'Conceito relacionado: Mutating Admission Webhooks no Kubernetes.'
    },
    {
      question: 'Desde qual versao o Istio consolidou Pilot, Citadel e Galley em um unico binario?',
      options: ['Istio 1.0', 'Istio 1.3', 'Istio 1.5', 'Istio 1.8'],
      correct: 2,
      explanation: 'O Istio 1.5 introduziu o istiod, consolidando Pilot, Citadel e Galley em um unico processo. Isso simplificou a instalacao e reduziu o consumo de recursos do control plane.',
      reference: 'Conceito relacionado: Evolucao da arquitetura do Istio de microservicos para monolito.'
    },
    {
      question: 'Qual perfil de instalacao do Istio e recomendado para ambientes de producao?',
      options: ['demo', 'default', 'minimal', 'preview'],
      correct: 1,
      explanation: 'O perfil default instala istiod e o ingress gateway, que e suficiente para producao. O perfil demo inclui componentes extras (egress gateway, tracing) que consomem mais recursos.',
      reference: 'Conceito relacionado: istioctl profile dump para ver detalhes de cada perfil.'
    },
    {
      question: 'Qual protocolo o istiod usa para enviar configuracao aos proxies Envoy?',
      options: ['gRPC REST API', 'xDS (discovery services)', 'HTTP/2 push', 'NATS messaging'],
      correct: 1,
      explanation: 'O istiod usa o protocolo xDS (Envoy Discovery Services) via gRPC para enviar configuracao dinamicamente para os proxies Envoy. Isso inclui LDS, RDS, CDS, EDS e SDS.',
      reference: 'Conceito relacionado: LDS (Listener), RDS (Route), CDS (Cluster), EDS (Endpoint), SDS (Secret).'
    },
    {
      question: 'Qual annotation desabilita a injecao de sidecar em um Pod especifico?',
      options: [
        'istio.io/inject: "false"',
        'sidecar.istio.io/inject: "false"',
        'istio-injection: disabled',
        'proxy.istio.io/skip: "true"'
      ],
      correct: 1,
      explanation: 'A annotation sidecar.istio.io/inject: "false" no Pod metadata desabilita a injecao do sidecar Envoy, mesmo que o namespace tenha auto-injection habilitada.',
      reference: 'Conceito relacionado: Outras annotations do Istio como sidecar.istio.io/proxyMemoryLimit.'
    },
    {
      question: 'Qual comando do istioctl permite analisar problemas de configuracao no mesh?',
      options: [
        'istioctl verify-install',
        'istioctl analyze',
        'istioctl proxy-config',
        'istioctl validate'
      ],
      correct: 1,
      explanation: 'istioctl analyze examina a configuracao do cluster e reporta avisos e erros, como VirtualServices referenciando gateways inexistentes ou conflitos de configuracao.',
      reference: 'Conceito relacionado: istioctl analyze -n <namespace> para analise por namespace.'
    }
  ],
  flashcards: [
    {
      front: 'Quais sao os tres componentes historicos do Istio consolidados no istiod?',
      back: '1. **Pilot** — distribui configuracao de routing (xDS)\n2. **Citadel** — gerencia certificados e identidades mTLS\n3. **Galley** — valida e distribui configuracao\n\nDesde Istio 1.5, todos rodam como um unico binario: **istiod**'
    },
    {
      front: 'Qual a diferenca entre o control plane e o data plane no Istio?',
      back: '**Control Plane (istiod):**\n- Gerencia configuracao\n- Distribui certificados\n- Envia regras de routing via xDS\n\n**Data Plane (Envoy proxies):**\n- Intercepta trafego de rede\n- Aplica regras de routing\n- Coleta metricas e traces\n- Executa mTLS'
    },
    {
      front: 'Como o sidecar Envoy intercepta o trafego do Pod?',
      back: 'O init container **istio-init** configura regras **iptables** que redirecionam todo trafego de entrada (porta 15006) e saida (porta 15001) para o container Envoy proxy.\n\nAlternativamente, o Istio CNI Plugin pode substituir o init container, evitando a necessidade de NET_ADMIN capability.'
    },
    {
      front: 'Quais sao os 5 perfis de instalacao do Istio?',
      back: '1. **default** — istiod + ingress gateway (producao)\n2. **demo** — tudo habilitado (testes)\n3. **minimal** — apenas istiod\n4. **remote** — agentes para multi-cluster\n5. **empty** — base para customizacao\n\nUsar: \`istioctl install --set profile=<nome>\`'
    },
    {
      front: 'O que e o protocolo xDS no contexto do Istio?',
      back: 'xDS e a familia de APIs de descoberta do Envoy:\n- **LDS** — Listener Discovery Service\n- **RDS** — Route Discovery Service\n- **CDS** — Cluster Discovery Service\n- **EDS** — Endpoint Discovery Service\n- **SDS** — Secret Discovery Service\n\nO istiod traduz CRDs do Istio (VirtualService, DestinationRule) em configuracao xDS enviada via gRPC para os Envoy proxies.'
    },
    {
      front: 'Quais CRDs principais o Istio adiciona ao Kubernetes?',
      back: '- **VirtualService** — regras de routing\n- **DestinationRule** — politicas de conexao\n- **Gateway** — entry point externo\n- **ServiceEntry** — servicos externos\n- **PeerAuthentication** — mTLS\n- **AuthorizationPolicy** — controle acesso\n- **Sidecar** — escopo do proxy\n- **EnvoyFilter** — customizacao Envoy'
    },
    {
      front: 'Qual a diferenca entre istio-injection label e sidecar annotation?',
      back: '**Label no Namespace:**\n\`istio-injection=enabled\`\n- Aplica a todos os Pods do namespace\n- Configuracao global\n\n**Annotation no Pod:**\n\`sidecar.istio.io/inject: "false"\`\n- Override por Pod individual\n- Tem precedencia sobre o label do namespace'
    }
  ],
  lab: {
    scenario: 'Voce precisa configurar o Istio em um cluster Kubernetes para preparar o ambiente para microservicos com observabilidade e seguranca.',
    objective: 'Instalar o Istio, habilitar sidecar injection, fazer deploy de uma aplicacao e verificar que o mesh esta funcionando.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Instalar o Istio e Habilitar Injection',
        instruction: `Instale o Istio com perfil demo e habilite sidecar injection no namespace default.

\`\`\`bash
# Baixar e instalar istioctl (se necessario)
curl -L https://istio.io/downloadIstio | sh -
cd istio-*
export PATH=\$PWD/bin:\$PATH

# Instalar Istio com perfil demo
istioctl install --set profile=demo -y

# Verificar instalacao
istioctl verify-install

# Habilitar sidecar injection no namespace default
kubectl label namespace default istio-injection=enabled

# Verificar Pods do Istio
kubectl get pods -n istio-system
\`\`\``,
        hints: [
          'O perfil demo instala istiod + ingress gateway + egress gateway',
          'istioctl verify-install confirma que todos os componentes estao saudaveis',
          'O label istio-injection=enabled ativa o webhook de injecao automatica'
        ],
        solution: `\`\`\`bash
# Instalar Istio
istioctl install --set profile=demo -y

# Verificar
istioctl verify-install
kubectl get pods -n istio-system

# Habilitar injection
kubectl label namespace default istio-injection=enabled
kubectl get namespace default --show-labels
\`\`\``,
        verify: `\`\`\`bash
# Verificar que istiod esta rodando
kubectl get deploy -n istio-system
# Saida esperada: istiod, istio-ingressgateway, istio-egressgateway READY

# Verificar label do namespace
kubectl get namespace default -L istio-injection
# Saida esperada: istio-injection=enabled

# Verificar webhook
kubectl get mutatingwebhookconfiguration | grep istio
# Saida esperada: istio-sidecar-injector
\`\`\``
      },
      {
        title: 'Deploy de Aplicacao com Sidecar',
        instruction: `Faca deploy de uma aplicacao e verifique que o sidecar Envoy foi injetado automaticamente.

\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: httpbin
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: httpbin
  template:
    metadata:
      labels:
        app: httpbin
    spec:
      containers:
        - name: httpbin
          image: kennethreitz/httpbin
          ports:
            - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: httpbin
  namespace: default
spec:
  selector:
    app: httpbin
  ports:
    - port: 8000
      targetPort: 80
EOF
\`\`\``,
        hints: [
          'Cada Pod deve ter 2/2 containers READY (app + istio-proxy)',
          'Use kubectl describe pod para ver os containers injetados',
          'O container istio-init roda como init container para configurar iptables'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: httpbin
spec:
  replicas: 2
  selector:
    matchLabels:
      app: httpbin
  template:
    metadata:
      labels:
        app: httpbin
    spec:
      containers:
        - name: httpbin
          image: kennethreitz/httpbin
          ports:
            - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: httpbin
spec:
  selector:
    app: httpbin
  ports:
    - port: 8000
      targetPort: 80
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verificar que os Pods tem 2 containers (READY 2/2)
kubectl get pods -l app=httpbin
# Saida esperada: httpbin-xxx   2/2   Running   0   Xs

# Verificar containers do Pod
kubectl get pod -l app=httpbin -o jsonpath='{.items[0].spec.containers[*].name}'
# Saida esperada: httpbin istio-proxy

# Verificar init containers
kubectl get pod -l app=httpbin -o jsonpath='{.items[0].spec.initContainers[*].name}'
# Saida esperada: istio-init
\`\`\``
      },
      {
        title: 'Analisar Configuracao do Proxy',
        instruction: `Use o istioctl para inspecionar a configuracao do proxy Envoy e analisar o mesh.

\`\`\`bash
# Obter nome do Pod
POD=\$(kubectl get pod -l app=httpbin -o jsonpath='{.items[0].metadata.name}')

# Ver rotas configuradas no proxy
istioctl proxy-config routes \$POD

# Ver clusters (upstream services) conhecidos
istioctl proxy-config clusters \$POD

# Ver listeners
istioctl proxy-config listeners \$POD

# Analisar configuracao geral do mesh
istioctl analyze

# Ver status do proxy
istioctl proxy-status
\`\`\``,
        hints: [
          'proxy-config mostra a configuracao real que o Envoy recebeu via xDS',
          'istioctl analyze detecta problemas de configuracao automaticamente',
          'proxy-status mostra se os proxies estao sincronizados com istiod'
        ],
        solution: `\`\`\`bash
POD=\$(kubectl get pod -l app=httpbin -o jsonpath='{.items[0].metadata.name}')
istioctl proxy-config routes \$POD
istioctl proxy-config clusters \$POD
istioctl proxy-config listeners \$POD
istioctl analyze
istioctl proxy-status
\`\`\``,
        verify: `\`\`\`bash
# Verificar que o proxy esta sincronizado
istioctl proxy-status | head -5
# Saida esperada: NAME ... CDS ... LDS ... EDS ... RDS ... SYNCED

# Verificar que nao ha warnings de analise
istioctl analyze 2>&1 | grep -c "Error"
# Saida esperada: 0
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Sidecar nao injetado nos Pods',
      difficulty: 'easy',
      symptom: 'Apos fazer deploy, os Pods tem apenas 1 container (sem istio-proxy). O sidecar Envoy nao foi injetado.',
      diagnosis: `\`\`\`bash
# Verificar label do namespace
kubectl get namespace <namespace> -L istio-injection
# Se nao mostra "enabled", o webhook nao esta ativo

# Verificar se o webhook existe
kubectl get mutatingwebhookconfiguration | grep istio

# Verificar annotation de opt-out no Pod
kubectl get pod <pod> -o jsonpath='{.metadata.annotations.sidecar\\.istio\\.io/inject}'

# Verificar logs do istiod
kubectl logs -n istio-system deploy/istiod | grep -i "inject"
\`\`\``,
      solution: `**Causas e solucoes:**

1. **Namespace sem label:** Adicionar o label:
\`\`\`bash
kubectl label namespace <namespace> istio-injection=enabled
\`\`\`

2. **Pod com opt-out:** Remover a annotation \`sidecar.istio.io/inject: "false"\` do Pod template.

3. **Webhook nao instalado:** Reinstalar o Istio:
\`\`\`bash
istioctl install --set profile=default -y
\`\`\`

4. **Pods pre-existentes:** Pods criados antes do label precisam ser recriados:
\`\`\`bash
kubectl rollout restart deployment <nome>
\`\`\``
    },
    {
      title: 'istiod nao inicia ou fica em CrashLoopBackOff',
      difficulty: 'medium',
      symptom: 'O Pod istiod no namespace istio-system nao atinge o estado Running. Pode estar em Pending, CrashLoopBackOff ou Error.',
      diagnosis: `\`\`\`bash
# Verificar status do Pod
kubectl get pods -n istio-system -l app=istiod

# Ver logs do istiod
kubectl logs -n istio-system deploy/istiod --tail=50

# Verificar eventos
kubectl describe pod -n istio-system -l app=istiod

# Verificar recursos
kubectl top pod -n istio-system

# Verificar se CRDs foram instalados
kubectl get crds | grep istio | wc -l
\`\`\``,
      solution: `**Causas comuns:**

1. **Recursos insuficientes:** istiod requer ~500Mi de memoria. Verificar se o node tem recursos disponiveis.

2. **CRDs faltando:** Se a instalacao foi parcial:
\`\`\`bash
istioctl install --set profile=default -y --force
\`\`\`

3. **Conflito de versao:** Versoes incompativeis de CRDs e istiod:
\`\`\`bash
istioctl version
# client e server devem ser compativeis
\`\`\`

4. **Webhook blocking:** Se o webhook esta configurado mas o istiod nao esta pronto, novos Pods podem ficar pendentes. Desabilitar temporariamente:
\`\`\`bash
kubectl delete mutatingwebhookconfiguration istio-sidecar-injector
# Reinstalar o Istio apos resolver o problema
\`\`\``
    },
    {
      title: 'Alto consumo de memoria pelos sidecars',
      difficulty: 'hard',
      symptom: 'O cluster esta com consumo elevado de memoria. Cada Pod consome significativamente mais RAM que o esperado por causa do sidecar Envoy.',
      diagnosis: `\`\`\`bash
# Ver consumo de memoria dos sidecars
kubectl top pods -n <namespace> --containers | grep istio-proxy

# Ver configuracao atual de limites
kubectl get pod <pod> -o jsonpath='{.spec.containers[?(@.name=="istio-proxy")].resources}'

# Contar total de sidecars no cluster
kubectl get pods --all-namespaces -o jsonpath='{range .items[*]}{.spec.containers[*].name}{"\\n"}{end}' | grep -c istio-proxy

# Ver metricas do Envoy
kubectl exec <pod> -c istio-proxy -- pilot-agent request GET /stats | grep "server.memory"
\`\`\``,
      solution: `**Estrategias de otimizacao:**

1. **Limitar recursos do sidecar** via annotation no Pod:
\`\`\`yaml
annotations:
  sidecar.istio.io/proxyMemoryLimit: "128Mi"
  sidecar.istio.io/proxyCPULimit: "200m"
  sidecar.istio.io/proxyMemory: "64Mi"
  sidecar.istio.io/proxyCPU: "50m"
\`\`\`

2. **Reduzir escopo do proxy** com Sidecar resource:
\`\`\`yaml
apiVersion: networking.istio.io/v1beta1
kind: Sidecar
metadata:
  name: restrict-egress
  namespace: production
spec:
  egress:
    - hosts:
        - "./*"
        - "istio-system/*"
\`\`\`

3. **Considerar ambient mesh** (Istio ambient mode) que elimina sidecars usando ztunnel no node level.

4. **Excluir namespaces** que nao precisam de mesh (monitoring, logging, etc.)`
    }
  ]
};
