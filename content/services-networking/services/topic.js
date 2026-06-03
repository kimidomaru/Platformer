window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['services-networking/services'] = {
  theory: `# Services: Tipos e Endpoints

## O que e um Service?

Um **Service** e uma abstracao que define um conjunto logico de Pods e uma politica de acesso a eles. Os Services fornecem um **endereco IP estavel** e uma **porta constante** que permanecem os mesmos ao longo do tempo, mesmo que os Pods subjacentes sejam substituidos, reiniciados ou movidos entre nodes.

O Service usa **seletores de labels** (Label Selectors) para identificar quais Pods devem receber o trafego. Os labels sao fundamentais no Kubernetes — sao a base para a maioria das operacoes de associacao.

### Diagrama: Tipos de Service

\`\`\`
┌──────────────────────────────────────────────────────────────────┐
│                    TIPOS DE SERVICE                               │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  ClusterIP (padrao)                                       │    │
│  │  Acesso INTERNO ao cluster apenas                         │    │
│  │  Pod ──> ClusterIP:port ──> kube-proxy ──> Pod(s)        │    │
│  └──────────────────────────────────────────────────────────┘    │
│                          ▲ herda                                 │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  NodePort                                                 │    │
│  │  Expoe em CADA node na porta 30000-32767                  │    │
│  │  Externo ──> NodeIP:NodePort ──> ClusterIP ──> Pod(s)    │    │
│  └──────────────────────────────────────────────────────────┘    │
│                          ▲ herda                                 │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  LoadBalancer                                             │    │
│  │  Provisiona LB externo (cloud)                            │    │
│  │  Internet ──> LB ──> NodePort ──> ClusterIP ──> Pod(s)   │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  ExternalName                                             │    │
│  │  Alias DNS para servico externo (CNAME)                   │    │
│  │  Pod ──> DNS lookup ──> CNAME ──> servico-externo.com    │    │
│  └──────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
\`\`\`

### Como os Services funcionam

\`\`\`
Cliente --> Service (VIP + porta) --> kube-proxy (regras iptables/IPVS) --> Pod(s)
\`\`\`

1. O **kube-proxy** roda em cada node e configura regras de rede (iptables ou IPVS)
2. O **Endpoints controller** monitora Pods com labels correspondentes ao selector do Service
3. Quando um Pod muda, o controller atualiza o objeto **Endpoints** com os novos IPs
4. O kube-proxy atualiza as regras de rede para refletir os novos endpoints

### Modos do kube-proxy

| Modo | Descricao |
|------|-----------|
| **iptables** (padrao) | Usa regras iptables para NAT e balanceamento. Bom para clusters pequenos/medios |
| **IPVS** | Usa netfilter do kernel para hashing. Melhor performance com muitos Services |
| **kernelspace** | Modo Windows |

---

## Tipos de Service

### 1. ClusterIP (padrao)

Expoe o Service em um **IP virtual interno** do cluster. So acessivel de dentro do cluster. E o tipo mais comum para comunicacao entre microsservicos.

\`\`\`yaml
apiVersion: v1
kind: Service
metadata:
  name: meu-servico
  namespace: default
spec:
  type: ClusterIP         # Padrao quando type e omitido
  selector:
    app: minha-app
  ports:
    - name: http
      protocol: TCP
      port: 80             # Porta do Service
      targetPort: 8080     # Porta do container
\`\`\`

**Casos de uso:** comunicacao interna entre microsservicos, backend APIs.

\`\`\`bash
# Criar rapidamente via CLI
kubectl expose deployment meu-deployment --port=80 --target-port=8080
\`\`\`

---

### 2. NodePort

Expoe o Service em uma **porta estatica em cada Node** do cluster (range: 30000-32767). Acessivel externamente via \`<NodeIP>:<NodePort>\`. Inclui um ClusterIP automaticamente.

\`\`\`yaml
apiVersion: v1
kind: Service
metadata:
  name: servico-nodeport
spec:
  type: NodePort
  selector:
    app: minha-app
  ports:
    - protocol: TCP
      port: 80            # Porta do Service (ClusterIP)
      targetPort: 8080    # Porta do container
      nodePort: 30080     # Porta do Node (30000-32767)
\`\`\`

Quando \`nodePort\` nao e especificado, o Kubernetes escolhe uma porta aleatoria no range.

**Casos de uso:** exposicao simples para desenvolvimento/teste, clusters on-premise sem load balancer.

\`\`\`bash
kubectl expose deployment meu-deployment --type=NodePort --port=80 --target-port=8080
\`\`\`

---

### 3. LoadBalancer

Provisiona um **load balancer externo** no cloud provider (AWS ALB/NLB, GCP LB, Azure LB). Inclui ClusterIP e NodePort automaticamente.

\`\`\`yaml
apiVersion: v1
kind: Service
metadata:
  name: servico-lb
spec:
  type: LoadBalancer
  selector:
    app: minha-app
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8080
\`\`\`

O campo \`status.loadBalancer.ingress\` exibira o IP/hostname externo apos provisionamento:

\`\`\`bash
kubectl get service servico-lb
# NAME         TYPE           CLUSTER-IP     EXTERNAL-IP     PORT(S)        AGE
# servico-lb   LoadBalancer   10.96.100.50   203.0.113.10    80:31234/TCP   5m
\`\`\`

**Importante:** LoadBalancers tem **custos adicionais** no cloud provider — cada Service LoadBalancer cria um LB separado. Considere usar Ingress para multiplos servicos sob um unico LB.

**Casos de uso:** exposicao em producao para trafego externo da internet.

---

### 4. ExternalName

Mapeia o Service para um **nome DNS externo**. Nao ha proxy ou encaminhamento de porta — apenas uma entrada **CNAME** no DNS interno do cluster.

\`\`\`yaml
apiVersion: v1
kind: Service
metadata:
  name: banco-externo
  namespace: producao
spec:
  type: ExternalName
  externalName: banco.empresa.com.br
\`\`\`

**Restricoes:**
- NAO suporta \`selector\` ou \`ports\`
- O \`externalName\` deve ser um nome de host valido conforme DNS (RFC-1123)
- Pode ser nome de dominio ou endereco IP

**Casos de uso:**
- **Alias** para servico externo (banco de dados fora do cluster)
- **Abstracao de ambiente**: mesmo nome de Service em dev/staging/prod apontando para endpoints diferentes

---

### 5. Headless Service

Um Service com \`clusterIP: None\`. O DNS retorna **diretamente os IPs dos Pods**, sem proxy e sem IP virtual.

\`\`\`yaml
apiVersion: v1
kind: Service
metadata:
  name: servico-headless
spec:
  clusterIP: None
  selector:
    app: banco-de-dados
  ports:
    - port: 5432
      targetPort: 5432
\`\`\`

### Headless Service + StatefulSet

Quando usado com StatefulSet, cada Pod ganha um **DNS estavel e individual**:

\`\`\`
<pod-name>.<service-name>.<namespace>.svc.cluster.local
\`\`\`

Exemplo com StatefulSet "mysql" e Headless Service "mysql-svc":
- \`mysql-0.mysql-svc.default.svc.cluster.local\`
- \`mysql-1.mysql-svc.default.svc.cluster.local\`
- \`mysql-2.mysql-svc.default.svc.cluster.local\`

**Casos de uso:** StatefulSets, bancos de dados distribuidos (cada Pod precisa de enderecamento individual), service discovery avancado.

---

## Service Discovery

O Kubernetes oferece duas formas de descobrir Services:

### 1. DNS (recomendado)

CoreDNS cria registros automaticamente:

\`\`\`
<service-name>.<namespace>.svc.cluster.local
\`\`\`

\`\`\`bash
# De dentro de um Pod no mesmo namespace
wget -qO- http://meu-servico:80

# De outro namespace
wget -qO- http://meu-servico.outro-namespace.svc.cluster.local:80
\`\`\`

### 2. Variaveis de Ambiente

O kubelet injeta variaveis de ambiente para cada Service existente quando o Pod e criado:

\`\`\`
MEU_SERVICO_SERVICE_HOST=10.96.100.50
MEU_SERVICO_SERVICE_PORT=80
\`\`\`

**Limitacao:** Services criados APOS o Pod nao sao injetados. Prefira DNS.

---

## Endpoints e EndpointSlices

### Endpoints

O Kubernetes cria automaticamente um objeto **Endpoints** para cada Service com selector:

\`\`\`bash
kubectl get endpoints meu-servico
# NAME          ENDPOINTS                                 AGE
# meu-servico   10.244.1.5:8080,10.244.2.3:8080,...      5m
\`\`\`

Cada IP e de um Pod com labels correspondentes ao selector do Service. Endpoints sao atualizados automaticamente quando Pods sao criados/removidos.

### Service sem Selector (endpoints manuais)

Para apontar para IPs externos ao cluster:

\`\`\`yaml
apiVersion: v1
kind: Service
metadata:
  name: servico-externo
spec:
  ports:
  - port: 5432
---
apiVersion: v1
kind: Endpoints
metadata:
  name: servico-externo    # Deve ter o MESMO nome do Service
subsets:
  - addresses:
      - ip: 192.168.1.100
      - ip: 192.168.1.101
    ports:
      - port: 5432
\`\`\`

### EndpointSlices

Evolucao dos Endpoints com melhor escalabilidade. Cada slice agrupa ate 100 endpoints, reduzindo o impacto no etcd ao atualizar grandes conjuntos.

\`\`\`bash
kubectl get endpointslices -l kubernetes.io/service-name=meu-servico
\`\`\`

---

## Definicao de Portas

\`\`\`yaml
ports:
  - name: http        # obrigatorio quando ha multiplas portas
    protocol: TCP     # TCP (padrao), UDP, SCTP
    port: 80          # porta do Service (ClusterIP/NodePort)
    targetPort: 8080  # porta do container (pode ser nome do port no Pod)
    nodePort: 30080   # porta no Node (somente para NodePort/LoadBalancer)
\`\`\`

### Referenciando targetPort por nome (melhor pratica)

\`\`\`yaml
# No Pod
ports:
  - name: app-port
    containerPort: 8080

# No Service
ports:
  - port: 80
    targetPort: app-port  # referencia pelo nome - mais resiliente a mudancas
\`\`\`

---

## sessionAffinity

Mantém sessoes do mesmo cliente no mesmo Pod (sticky sessions):

\`\`\`yaml
spec:
  sessionAffinity: ClientIP
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 10800  # 3 horas (padrao: 10800)
\`\`\`

| Valor | Comportamento |
|-------|--------------|
| **None** (padrao) | Round-robin entre todos os Pods |
| **ClientIP** | Mesmo IP de origem sempre vai ao mesmo Pod |

---

## kubectl expose

Atalho para criar Services rapidamente a partir de Deployments, Pods, ReplicaSets e ate outros Services:

\`\`\`bash
# Expor um Deployment como ClusterIP na porta 80
kubectl expose deployment minha-app --port=80 --target-port=8080

# Expor como NodePort
kubectl expose deployment minha-app --type=NodePort --port=80

# Expor um Pod diretamente
kubectl expose pod meu-pod --name=servico-pod --port=9090

# Gerar YAML sem criar (para editar depois)
kubectl expose deployment minha-app --port=80 --dry-run=client -o yaml > svc.yaml

# Expor com nome customizado
kubectl expose deployment minha-app --port=80 --name=api-service
\`\`\`

**Nota:** E possivel criar Service para outro Service (casos raros como troubleshooting temporario ou exposicao em diferentes contextos).

---

## Verificacao e Debug

\`\`\`bash
# Listar todos os services
kubectl get services -A

# Detalhes do service (incluindo Endpoints)
kubectl describe service meu-servico

# Verificar endpoints (IPs dos Pods)
kubectl get endpoints meu-servico

# Testar conectividade de dentro do cluster
kubectl run debug --rm -it --image=busybox:1.36 --restart=Never -- \\
  wget -qO- http://meu-servico:80

# Testar resolucao DNS
kubectl run dns-test --rm -it --image=busybox:1.36 --restart=Never -- \\
  nslookup meu-servico.default.svc.cluster.local

# Ver EndpointSlices
kubectl get endpointslices -l kubernetes.io/service-name=meu-servico

# Verificar kube-proxy e regras iptables (em um node)
iptables-save | grep meu-servico
\`\`\`
`,

  quiz: [
    {
      question: 'Qual tipo de Service expoe a aplicacao em uma porta estatica em todos os Nodes do cluster?',
      options: ['ClusterIP', 'NodePort', 'LoadBalancer', 'ExternalName'],
      correct: 1,
      explanation: 'NodePort expoe o Service no range 30000-32767 em cada Node. Inclui automaticamente um ClusterIP. Acessivel via <NodeIP>:<NodePort>. O range pode ser alterado com --service-node-port-range no kube-apiserver.'
    },
    {
      question: 'Um Service com clusterIP: None e chamado de:',
      options: ['ExternalName Service', 'Headless Service', 'NodePort Service', 'Phantom Service'],
      correct: 1,
      explanation: 'Headless Service tem clusterIP: None. O DNS retorna os IPs dos Pods diretamente (sem VIP). Essencial com StatefulSets, onde cada Pod precisa de DNS individual: <pod>.<svc>.<ns>.svc.cluster.local.'
    },
    {
      question: 'Qual campo no spec do Service define quais Pods receberao o trafego?',
      options: ['targetPort', 'endpoints', 'selector', 'podAffinity'],
      correct: 2,
      explanation: 'O campo selector usa labels para identificar Pods que fazem parte do Service. O Endpoints controller monitora Pods com essas labels e atualiza o objeto Endpoints. Se omitido, voce pode criar Endpoints manualmente (servicos externos).'
    },
    {
      question: 'Para manter sessoes do mesmo cliente sempre no mesmo Pod, qual configuracao usar?',
      options: ['sessionAffinity: Pod', 'sessionAffinity: ClientIP', 'affinity: session', 'stickySession: true'],
      correct: 1,
      explanation: 'sessionAffinity: ClientIP faz requisicoes do mesmo IP irem ao mesmo Pod. Configuravel via sessionAffinityConfig.clientIP.timeoutSeconds (padrao: 10800s = 3h). Valor padrao de sessionAffinity e None (round-robin).'
    },
    {
      question: 'Qual tipo de Service mapeia um nome DNS externo usando CNAME, sem proxy de trafego?',
      options: ['LoadBalancer', 'Headless', 'NodePort', 'ExternalName'],
      correct: 3,
      explanation: 'ExternalName cria um registro CNAME no DNS interno apontando para externalName. NAO suporta selector ou ports. O externalName deve ser DNS valido (RFC-1123). Util para alias de servicos externos como bancos de dados.'
    },
    {
      question: 'Qual e o range padrao de portas para NodePort?',
      options: ['1024-9999', '8000-9000', '30000-32767', '10000-20000'],
      correct: 2,
      explanation: 'Range padrao: 30000-32767. Alteravel via --service-node-port-range no kube-apiserver. Se nodePort nao for especificado no YAML, K8s escolhe aleatoriamente no range. Conflitos de porta geram erro.'
    },
    {
      question: 'Ao usar kubectl expose, qual flag define o tipo do Service?',
      options: ['--kind', '--service-type', '--type', '--expose-type'],
      correct: 2,
      explanation: '--type define o tipo (ClusterIP, NodePort, LoadBalancer, ExternalName). Padrao e ClusterIP. Exemplo: kubectl expose deployment app --type=NodePort --port=80 --target-port=8080.'
    },
    {
      question: 'Qual formato DNS o Kubernetes usa para resolver Services dentro do cluster?',
      options: [
        '<service>.<namespace>.cluster.local',
        '<service>.<namespace>.svc.cluster.local',
        '<namespace>.<service>.svc.cluster.local',
        '<service>.svc.<namespace>.cluster.local'
      ],
      correct: 1,
      explanation: 'O formato DNS e: <service-name>.<namespace>.svc.cluster.local. No mesmo namespace, basta usar <service-name>. Para Headless + StatefulSet: <pod-name>.<service-name>.<namespace>.svc.cluster.local.'
    },
    {
      question: 'O que sao EndpointSlices e por que foram introduzidos?',
      options: [
        'Sao backups dos Endpoints para alta disponibilidade',
        'Sao a evolucao dos Endpoints com melhor escalabilidade, agrupando ate 100 endpoints por slice',
        'Sao Endpoints para Services externos',
        'Sao Endpoints que funcionam apenas com IPVS'
      ],
      correct: 1,
      explanation: 'EndpointSlices agrupam ate 100 endpoints por slice, reduzindo a carga no etcd e na rede ao atualizar grandes conjuntos de endpoints. Sao especialmente importantes para Services com centenas ou milhares de Pods.'
    },
    {
      question: 'Qual e a principal desvantagem de usar um Service LoadBalancer para cada aplicacao?',
      options: [
        'LoadBalancer nao suporta HTTPS',
        'LoadBalancer nao funciona com NodePort',
        'Cada LoadBalancer tem custo adicional no cloud provider, e nao e possivel compartilhar entre servicos',
        'LoadBalancer nao suporta sessionAffinity'
      ],
      correct: 2,
      explanation: 'Cada Service LoadBalancer cria um LB externo separado no cloud provider, gerando custos adicionais. Para expor multiplos servicos sob um unico LB, use Ingress Controller. LoadBalancers incluem ClusterIP + NodePort automaticamente.'
    }
  ],

  flashcards: [
    {
      front: 'Qual e o tipo de Service padrao quando nenhum type e especificado?',
      back: 'ClusterIP. Cria um IP virtual (VIP) interno acessivel apenas dentro do cluster.\n\nFluxo: Cliente -> ClusterIP -> kube-proxy (iptables/IPVS) -> Pod\n\nMais comum para comunicacao entre microsservicos. Criado automaticamente com NodePort e LoadBalancer.'
    },
    {
      front: 'O que e um Headless Service e quando usa-lo?',
      back: 'Service com clusterIP: None.\n\nDNS retorna IPs dos Pods diretamente (sem VIP).\n\nCom StatefulSet, cada Pod ganha DNS estavel:\n<pod>.<svc>.<ns>.svc.cluster.local\n\nUsos: StatefulSets, bancos distribuidos, service discovery avancado.\n\nDica: nslookup <svc> de dentro do cluster mostra todos os IPs dos Pods.'
    },
    {
      front: 'Qual a diferenca entre port, targetPort e nodePort?',
      back: 'port: porta do Service (ClusterIP). E a porta que outros servicos usam.\n\ntargetPort: porta no container do Pod. Pode ser numero ou nome da containerPort.\n\nnodePort: porta no Node (30000-32767). Somente para NodePort e LoadBalancer.\n\nExemplo: port:80 -> targetPort:8080 -> nodePort:30080'
    },
    {
      front: 'Como o Kubernetes associa um Service a seus Pods?',
      back: 'spec.selector usa labels para identificar Pods.\n\nEndpoints controller monitora Pods com essas labels e atualiza o objeto Endpoints.\n\nkube-proxy le os Endpoints e configura regras iptables/IPVS nos nodes.\n\nLabels sao fundamentais - labels incorretas = Service sem endpoints.'
    },
    {
      front: 'Como funciona o Service Discovery no Kubernetes?',
      back: 'Duas formas:\n\n1. DNS (recomendado):\n<svc>.<ns>.svc.cluster.local\nNo mesmo namespace: <svc>\n\n2. Variaveis de ambiente:\nMEU_SVC_SERVICE_HOST=10.96.x.x\nMEU_SVC_SERVICE_PORT=80\nLimitacao: Services criados APOS o Pod nao sao injetados.\n\nSempre prefira DNS.'
    },
    {
      front: 'O que e um ExternalName Service?',
      back: 'Mapeia Service para DNS externo via registro CNAME.\n\ntype: ExternalName\nexternalName: banco.empresa.com\n\nNAO suporta selector ou ports.\nexternalName deve ser DNS valido (RFC-1123).\n\nUsos: alias para servico externo, abstracao de ambiente (mesmo nome em dev/prod apontando para endpoints diferentes).'
    },
    {
      front: 'Qual a relacao entre Headless Service e StatefulSet?',
      back: 'StatefulSets PRECISAM de um Headless Service para DNS individual de cada Pod.\n\nCada Pod ganha:\n<pod-name>.<svc-name>.<namespace>.svc.cluster.local\n\nExemplo: mysql-0.mysql.default.svc.cluster.local\n\nIsso permite comunicacao direta entre replicas (ex: replicacao de banco).'
    },
    {
      front: 'Como criar um Service sem selector (endpoints manuais)?',
      back: 'Crie o Service sem selector e um objeto Endpoints com o MESMO nome:\n\napiVersion: v1\nkind: Endpoints\nmetadata:\n  name: svc-externo  # mesmo nome do Service\nsubsets:\n- addresses:\n  - ip: 192.168.1.100\n  ports:\n  - port: 5432\n\nUtil para apontar para IPs externos ao cluster.'
    },
    {
      front: 'LoadBalancer vs Ingress: quando usar cada um?',
      back: 'LoadBalancer: 1 LB externo por Service. Custo adicional por LB.\n\nIngress: 1 LB compartilhado para MULTIPLOS Services. Roteamento por host/path.\n\nRegra geral:\n- Poucos Services -> LoadBalancer\n- Muitos Services -> Ingress Controller + um unico LB\n- On-premise -> NodePort ou Ingress com MetalLB'
    },
    {
      front: 'Como debugar um Service que nao roteia trafego?',
      back: '1. kubectl get endpoints <svc> — lista vazia?\n2. Comparar selector do Service com labels dos Pods\n3. Pods estao Ready? (readiness probe)\n4. targetPort bate com containerPort?\n5. Pod esta no mesmo namespace que o Service?\n6. Testar de dentro do cluster:\n   kubectl run test --rm -it --image=busybox -- wget -qO- http://<svc>:80'
    },
    {
      front: 'Quais modos do kube-proxy existem?',
      back: 'iptables (padrao): usa regras iptables para NAT/balanceamento. Bom para clusters pequenos/medios.\n\nIPVS: usa netfilter do kernel com hashing. Melhor performance para muitos Services (>1000).\n\nkernelspace: modo Windows.\n\nVerificar: kubectl -n kube-system get cm kube-proxy -o yaml | grep mode'
    }
  ],

  lab: {
    scenario: 'Uma equipe de desenvolvimento precisa expor uma aplicacao web internamente para outros servicos, externamente para testes, e quer entender como o roteamento de trafego funciona. Voce ira criar e validar diferentes tipos de Services em um cluster real.',
    objective: 'Criar e validar ClusterIP, NodePort e Headless Services; inspecionar Endpoints; testar conectividade entre Pods; usar kubectl expose corretamente.',
    steps: [
      {
        title: 'Deploy da aplicacao base',
        instruction: `Crie um Deployment com 3 replicas usando a imagem nginx. Cada Pod deve ter a label app=web-app. Verifique que todos os Pods estao Running antes de continuar.`,
        hints: [
          'Use kubectl create deployment ou escreva o YAML com spec.replicas: 3',
          'kubectl get pods -l app=web-app para filtrar por label',
          'Aguarde todas as replicas ficarem Ready com kubectl rollout status'
        ],
        solution: `\`\`\`bash
kubectl create deployment web-app --image=nginx --replicas=3

# Aguardar rollout
kubectl rollout status deployment/web-app

# Verificar pods e labels
kubectl get pods -l app=web-app --show-labels
\`\`\``
      },
      {
        title: 'Criar e validar ClusterIP Service',
        instruction: `Crie um ClusterIP Service chamado web-svc que exponha a porta 80 dos Pods na porta 80 do Service. Em seguida, inspecione os Endpoints criados automaticamente e teste a conectividade a partir de um Pod temporario.`,
        hints: [
          'kubectl expose deployment web-app --port=80 --name=web-svc',
          'kubectl get endpoints web-svc para ver os IPs dos Pods',
          'Use kubectl run com --rm -it e imagem busybox/curl para testar'
        ],
        solution: `\`\`\`bash
kubectl expose deployment web-app --port=80 --name=web-svc

# Inspecionar o service
kubectl describe service web-svc

# Verificar endpoints (deve mostrar os IPs dos 3 Pods)
kubectl get endpoints web-svc

# Testar conectividade de dentro do cluster
kubectl run test-pod --rm -it --image=busybox:1.35 --restart=Never -- wget -qO- http://web-svc:80
\`\`\``
      },
      {
        title: 'Criar NodePort Service e validar porta no Node',
        instruction: `Crie um NodePort Service chamado web-nodeport expondo a porta 80 na nodePort 30080. Identifique o IP do Node e teste o acesso externo. Por fim, crie um Headless Service e observe a diferenca no DNS.`,
        hints: [
          'Use --type=NodePort na linha de comando ou escreva o YAML com nodePort: 30080',
          'kubectl get nodes -o wide para ver o IP interno do Node',
          'Para o headless: clusterIP: None no spec, ou crie separadamente',
          'nslookup <service>.<namespace>.svc.cluster.local de dentro de um Pod'
        ],
        solution: `\`\`\`bash
# Criar NodePort com porta especifica via YAML
kubectl apply -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: web-nodeport
spec:
  type: NodePort
  selector:
    app: web-app
  ports:
    - port: 80
      targetPort: 80
      nodePort: 30080
EOF

# Ver IP do node
kubectl get nodes -o wide

# Criar Headless Service
kubectl apply -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: web-headless
spec:
  clusterIP: None
  selector:
    app: web-app
  ports:
    - port: 80
      targetPort: 80
EOF

# Comparar DNS: headless retorna IPs dos Pods, ClusterIP retorna o VIP
kubectl run dns-test --rm -it --image=busybox:1.35 --restart=Never -- sh -c "
  echo '=== ClusterIP DNS ===';
  nslookup web-svc;
  echo '=== Headless DNS ===';
  nslookup web-headless;
"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Service nao roteia trafego para os Pods (Endpoints vazio)',
      symptom: 'O Service existe mas nenhum Pod recebe trafego. kubectl get endpoints <svc> mostra "<none>" ou lista vazia. Requisicoes retornam timeout ou connection refused.',
      diagnosis: `\`\`\`bash
# 1. Ver os endpoints do service
kubectl get endpoints meu-servico
# ENDPOINTS: <none>

# 2. Verificar o selector do service
kubectl get service meu-servico -o jsonpath='{.spec.selector}'
# {"app":"minha-app"}

# 3. Verificar as labels dos Pods
kubectl get pods --show-labels
# Procurar Pods com label app=minha-app

# 4. Buscar Pods que correspondem ao selector
kubectl get pods -l app=minha-app
# Sem resultados? Labels nao batem!

# 5. Se ha Pods, verificar se estao Ready
kubectl get pods -l app=minha-app -o wide
# READY 0/1? Readiness probe falhando!

# 6. Verificar namespaces
kubectl get service meu-servico -o jsonpath='{.metadata.namespace}'
kubectl get pods -n <namespace> --show-labels
\`\`\`

**Causas comuns:**
- Labels nos Pods NAO correspondem ao spec.selector do Service (typo)
- Pods em namespace diferente do Service
- Pods nao estao Ready (readiness probe falhando)
- targetPort diferente da containerPort no Pod`,
      solution: `\`\`\`bash
# Causa 1: Selector incorreto - editar o Service
kubectl edit service meu-servico
# Corrigir spec.selector para bater com labels dos Pods

# Causa 2: Labels incorretas nos Pods
kubectl label pod <pod> app=minha-app --overwrite

# Causa 3: Readiness probe falhando
kubectl describe pod <pod>
# Verificar Events e readiness probe config
# Corrigir o path/port da probe

# Causa 4: Namespace errado
kubectl get svc -A | grep meu-servico
kubectl get pods -A --show-labels | grep minha-app

# Verificar apos correcao
kubectl get endpoints meu-servico
# Deve mostrar IPs dos Pods
\`\`\``
    },
    {
      title: 'NodePort Service inacessivel externamente',
      symptom: 'Service do tipo NodePort foi criado e tem endpoints, mas nao e possivel acessar via <NodeIP>:<NodePort> de fora do cluster. Conexao recusada ou timeout.',
      diagnosis: `\`\`\`bash
# 1. Verificar se o Service existe e tem endpoints
kubectl get service <svc> -o wide
kubectl get endpoints <svc>

# 2. Verificar a NodePort atribuida
kubectl get service <svc> -o jsonpath='{.spec.ports[0].nodePort}'

# 3. Verificar IP dos Nodes
kubectl get nodes -o wide

# 4. Testar de DENTRO do cluster (ClusterIP funciona?)
kubectl run test --rm -it --image=busybox:1.36 --restart=Never -- \\
  wget -qO- http://<ClusterIP>:<port>

# 5. Verificar se kube-proxy esta rodando
kubectl -n kube-system get pods -l k8s-app=kube-proxy

# 6. Verificar regras iptables no Node (SSH no node)
iptables-save | grep <nodePort>
\`\`\``,
      solution: `\`\`\`bash
# Causa 1: Firewall bloqueando a porta no Node
# Liberar porta no firewall (ex: ufw, iptables, security group)
# AWS: verificar Security Group do Node
# GCP: verificar Firewall Rules

# Causa 2: kube-proxy nao esta rodando
kubectl -n kube-system get pods -l k8s-app=kube-proxy
# Reiniciar se necessario:
kubectl -n kube-system delete pod -l k8s-app=kube-proxy

# Causa 3: Usando IP errado do Node
# Usar InternalIP ou ExternalIP correto:
kubectl get nodes -o jsonpath='{.items[*].status.addresses}'

# Causa 4: targetPort incorreto
kubectl get service <svc> -o yaml
# Verificar se targetPort bate com containerPort do Pod

# Testar apos correcao
curl http://<NodeIP>:<NodePort>
\`\`\``
    },
    {
      title: 'DNS do Service nao resolve de dentro do Pod',
      symptom: 'Pods nao conseguem resolver o nome do Service via DNS. Erro: "nslookup: can\'t resolve" ou "wget: bad address". Outros Pods no mesmo cluster funcionam.',
      diagnosis: `\`\`\`bash
# 1. Testar resolucao DNS de dentro de um Pod
kubectl run dns-test --rm -it --image=busybox:1.36 --restart=Never -- \\
  nslookup meu-servico.default.svc.cluster.local

# 2. Verificar se CoreDNS esta rodando
kubectl -n kube-system get pods -l k8s-app=kube-dns

# 3. Ver logs do CoreDNS
kubectl -n kube-system logs -l k8s-app=kube-dns

# 4. Verificar o Service do DNS
kubectl -n kube-system get service kube-dns

# 5. Verificar resolv.conf dentro do Pod
kubectl exec <pod> -- cat /etc/resolv.conf
# Deve apontar para o ClusterIP do kube-dns

# 6. Verificar dnsPolicy do Pod
kubectl get pod <pod> -o jsonpath='{.spec.dnsPolicy}'
\`\`\``,
      solution: `\`\`\`bash
# Causa 1: CoreDNS nao esta rodando
kubectl -n kube-system rollout restart deployment coredns

# Causa 2: Service kube-dns nao existe ou tem IP errado
kubectl -n kube-system get svc kube-dns
# ClusterIP deve corresponder ao nameserver em /etc/resolv.conf

# Causa 3: dnsPolicy incorreto
# Verificar se o Pod usa dnsPolicy: Default (usa DNS do node)
# em vez de ClusterFirst (usa CoreDNS) — padrao
# Corrigir para dnsPolicy: ClusterFirst

# Causa 4: Service em namespace diferente
# Usar FQDN: <svc>.<namespace>.svc.cluster.local
kubectl run test --rm -it --image=busybox:1.36 --restart=Never -- \\
  nslookup meu-servico.outro-namespace.svc.cluster.local

# Causa 5: NetworkPolicy bloqueando DNS (porta 53)
kubectl get networkpolicies -A
\`\`\``
    }
  ]
};
