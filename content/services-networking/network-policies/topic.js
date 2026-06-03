window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['services-networking/network-policies'] = {
  theory: `# Network Policies

## O que sao Network Policies?

**NetworkPolicy** e um recurso do Kubernetes que controla o trafego de rede entre Pods. Por padrao, todos os Pods podem se comunicar livremente entre si e com qualquer destino externo. Com NetworkPolicies, voce define regras de permissao (modelo allowlist).

> **Importante:** NetworkPolicies so funcionam se o CNI instalado suportar essa funcionalidade. CNIs compativeis: **Calico**, **Cilium**, **Weave Net**, **Antrea**. O Flannel puro NAO suporta NetworkPolicies.

**Conceito chave:** um Pod sem nenhuma NetworkPolicy associada e chamado de "non-isolated" e permite todo trafego. Assim que UMA NetworkPolicy seleciona um Pod para um tipo de trafego (Ingress ou Egress), esse Pod se torna "isolated" para aquele tipo e so aceita o que as policies explicitamente permitem.

---

## Estrutura completa do NetworkPolicy

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: exemplo-policy
  namespace: producao
spec:
  podSelector:           # quais Pods esta policy se aplica
    matchLabels:
      app: backend
  policyTypes:           # tipos de trafego controlados
    - Ingress
    - Egress
  ingress:               # regras de entrada (cada item e um OR)
    - from:              # fontes permitidas (dentro do item, AND)
        - podSelector:
            matchLabels:
              app: frontend
        # sem namespaceSelector aqui = mesmo namespace apenas
      ports:
        - protocol: TCP
          port: 8080
  egress:                # regras de saida
    - to:
        - podSelector:
            matchLabels:
              app: banco-dados
      ports:
        - protocol: TCP
          port: 5432
\`\`\`

---

## podSelector: qual Pod a policy controla

\`\`\`yaml
# Aplica a TODOS os Pods do namespace (selector vazio)
podSelector: {}

# Aplica apenas a Pods com label especifica
podSelector:
  matchLabels:
    role: database

# Aplica usando matchExpressions (mais flexivel)
podSelector:
  matchExpressions:
    - key: tier
      operator: In
      values: [backend, api]
\`\`\`

---

## policyTypes: quais tipos de trafego controlar

\`\`\`yaml
policyTypes:
  - Ingress    # controla trafego ENTRANDO no Pod
  - Egress     # controla trafego SAINDO do Pod
\`\`\`

**Comportamento por combinacao:**

| policyTypes | Efeito |
|-------------|--------|
| [Ingress] sem campo ingress | Bloqueia TODO ingress |
| [Ingress] com regras ingress | Permite apenas o especificado |
| [Egress] sem campo egress | Bloqueia TODO egress |
| [Egress] com regras egress | Permite apenas o especificado |
| [] (omitido) + campo ingress | Infere [Ingress] automaticamente |
| [] (omitido) sem campos | Nenhuma restricao (nao faz nada util) |

---

## Selectors em regras de ingress/egress

### podSelector (mesmo namespace por padrao)

Seleciona Pods dentro do mesmo namespace que a NetworkPolicy:

\`\`\`yaml
ingress:
  - from:
      - podSelector:
          matchLabels:
            app: frontend
\`\`\`

### namespaceSelector (qualquer namespace)

Seleciona todos os Pods de namespaces com o label especificado:

\`\`\`yaml
ingress:
  - from:
      - namespaceSelector:
          matchLabels:
            kubernetes.io/metadata.name: monitoring
\`\`\`

> No K8s 1.21+, o label **kubernetes.io/metadata.name** e aplicado automaticamente em todos os namespaces com o valor igual ao nome do namespace.

### ipBlock (blocos CIDR externos)

Seleciona IPs externos (nao-Pod) por bloco CIDR:

\`\`\`yaml
ingress:
  - from:
      - ipBlock:
          cidr: 203.0.113.0/24     # bloco permitido
          except:
            - 203.0.113.5/32       # exceto este IP especifico
\`\`\`

---

## Logica AND vs OR em NetworkPolicy (CRITICO para CKA)

Esta e a pegadinha mais frequente no exame. A logica depende de como os selectors estao posicionados na lista.

### AND logico: selectors no mesmo item da lista

Ambos os criterios devem ser verdadeiros simultaneamente:

\`\`\`yaml
ingress:
  - from:
      - namespaceSelector:       # mesmo objeto: AND
          matchLabels:
            env: producao
        podSelector:             # MESMO ITEM = AND
          matchLabels:
            app: scraper
# Permite apenas Pods com app=scraper QUE ESTEJAM no namespace env=producao
\`\`\`

### OR logico: selectors em itens separados da lista

Qualquer um dos criterios e suficiente:

\`\`\`yaml
ingress:
  - from:
      - namespaceSelector:       # item 1 da lista
          matchLabels:
            env: monitoring
      - podSelector:             # item 2 da lista (OR)
          matchLabels:
            app: admin
# Permite Pods do namespace monitoring OU qualquer Pod com app=admin (mesmo namespace)
\`\`\`

**Comparacao visual:**

\`\`\`
# AND: namespaceSelector E podSelector no MESMO item
from:
  - namespaceSelector: {...}   <- item unico com dois campos
    podSelector: {...}

# OR: namespaceSelector OU podSelector em itens DIFERENTES
from:
  - namespaceSelector: {...}   <- item 1
  - podSelector: {...}         <- item 2
\`\`\`

---

## Default Deny All: politica de seguranca recomendada

Aplique primeiro o deny total e depois libere apenas o necessario.

### Default deny ingress

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: producao
spec:
  podSelector: {}        # todos os Pods
  policyTypes:
    - Ingress             # sem campo ingress = bloqueia tudo
\`\`\`

### Default deny egress

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-egress
  namespace: producao
spec:
  podSelector: {}
  policyTypes:
    - Egress              # sem campo egress = bloqueia tudo
\`\`\`

### Default deny all (ingress e egress)

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: producao
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
\`\`\`

### Allow all (remover restricoes para um namespace)

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-all-ingress
spec:
  podSelector: {}
  policyTypes:
    - Ingress
  ingress:
    - {}   # item vazio = permite qualquer fonte
\`\`\`

---

## Ports e Protocolos em NetworkPolicy

\`\`\`yaml
ports:
  - protocol: TCP
    port: 8080              # numero da porta
  - protocol: UDP
    port: 53                # DNS
  - protocol: TCP
    port: 443
  - protocol: SCTP          # SCTP tambem suportado desde K8s 1.19
    port: 9000
\`\`\`

### Usando named ports (portas nomeadas)

\`\`\`yaml
# No Pod/Deployment, defina a porta com nome:
containers:
  - name: app
    ports:
      - name: http-api
        containerPort: 8080

# Na NetworkPolicy, use o nome em vez do numero:
ports:
  - port: http-api          # referencia o nome
    protocol: TCP
\`\`\`

---

## Padroes comuns de NetworkPolicy

### Padrao 1: Isolar namespace completamente

\`\`\`yaml
# Bloqueia tudo, entao libera apenas inter-namespace
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: isolate-namespace
  namespace: meu-app
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - podSelector: {}    # permite comunicacao interna (mesmo namespace)
  egress:
    - to:
        - podSelector: {}    # permite comunicacao interna
    - ports:                 # permite DNS
        - port: 53
          protocol: UDP
        - port: 53
          protocol: TCP
\`\`\`

### Padrao 2: Permitir acesso do namespace de monitoramento

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-monitoring
  namespace: producao
spec:
  podSelector: {}
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: monitoring
      ports:
        - port: 9090    # porta de metricas Prometheus
          protocol: TCP
\`\`\`

### Padrao 3: Permitir DNS para todos os Pods

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns-egress
  namespace: producao
spec:
  podSelector: {}
  policyTypes:
    - Egress
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
      ports:
        - port: 53
          protocol: UDP
        - port: 53
          protocol: TCP
\`\`\`

---

## Exemplo completo: Arquitetura 3 camadas

\`\`\`yaml
# 1. Default deny em todo o namespace
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: app
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
---
# 2. Frontend: aceita de qualquer lugar (internet), envia para backend e DNS
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: policy-frontend
  namespace: app
spec:
  podSelector:
    matchLabels:
      tier: frontend
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - {}   # qualquer origem (ex: Load Balancer externo)
  egress:
    - to:
        - podSelector:
            matchLabels:
              tier: backend
      ports:
        - port: 8080
    - ports:
        - port: 53
          protocol: UDP
---
# 3. Backend: aceita de frontend, envia para database e DNS
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: policy-backend
  namespace: app
spec:
  podSelector:
    matchLabels:
      tier: backend
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              tier: frontend
      ports:
        - port: 8080
  egress:
    - to:
        - podSelector:
            matchLabels:
              tier: database
      ports:
        - port: 5432
    - ports:
        - port: 53
          protocol: UDP
---
# 4. Database: aceita apenas de backend, sem egress proprio
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: policy-database
  namespace: app
spec:
  podSelector:
    matchLabels:
      tier: database
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              tier: backend
      ports:
        - port: 5432
\`\`\`

---

## CNI Plugins e suporte a NetworkPolicy

| CNI | Suporte NetworkPolicy | Recursos Extras |
|-----|----------------------|----------------|
| Calico | Sim (completo) | GlobalNetworkPolicy, politicas de L7 |
| Cilium | Sim (eBPF) | CiliumNetworkPolicy, visibilidade L7, DNS-based |
| Weave Net | Sim | Sem extensoes proprietarias |
| Antrea | Sim | ClusterNetworkPolicy, politicas por namespace |
| Flannel | Nao | Requer Calico adicionado como enforcer |
| kubenet | Nao | Apenas para ambientes simples |

> **Para o exame CKA:** o cluster de prova geralmente usa Calico ou Weave. Verifique com \`kubectl get pods -n kube-system\` qual esta instalado.

---

## Comandos essenciais

\`\`\`bash
# Listar todas as network policies (todos namespaces)
kubectl get networkpolicy -A

# Detalhes de uma policy
kubectl describe networkpolicy minha-policy -n producao

# Ver YAML completo
kubectl get networkpolicy minha-policy -n producao -o yaml

# Criar policy via dry-run (gerar YAML)
kubectl create networkpolicy test --dry-run=client -o yaml

# Testar conectividade entre Pods
kubectl exec -n app pod/frontend -- curl -s --connect-timeout 3 http://<BACKEND-IP>:8080

# Verificar labels dos namespaces (para namespaceSelector)
kubectl get namespaces --show-labels

# Adicionar label a namespace para usar em namespaceSelector
kubectl label namespace monitoring kubernetes.io/metadata.name=monitoring

# Verificar qual CNI esta instalado
kubectl get pods -n kube-system | grep -E "calico|cilium|weave|antrea|flannel"
\`\`\`
`,

  quiz: [
    {
      question: 'Qual e o comportamento padrao de um Pod quando NAO ha nenhuma NetworkPolicy aplicada a ele?',
      options: [
        'Todo trafego e bloqueado por padrao',
        'Todo trafego e permitido (ingress e egress)',
        'Apenas ingress e permitido',
        'Apenas egress e permitido'
      ],
      correct: 1,
      explanation: 'Sem nenhuma NetworkPolicy, todos os Pods podem se comunicar livremente (non-isolated). NetworkPolicies funcionam como allowlist: ao aplicar a primeira policy, o Pod se torna isolado para o tipo especificado (Ingress, Egress ou ambos).'
    },
    {
      question: 'Dois seletores no mesmo item de "from" (podSelector + namespaceSelector no mesmo bloco) representam qual logica?',
      options: [
        'OR: qualquer um dos criterios',
        'AND: ambos os criterios devem ser satisfeitos',
        'XOR: apenas um criterio',
        'NOT: negacao dos criterios'
      ],
      correct: 1,
      explanation: 'Quando podSelector e namespaceSelector estao no mesmo item da lista "from", a logica e AND: o Pod deve estar no namespace correto E ter as labels corretas. Para OR, coloque cada selector em itens separados da lista.'
    },
    {
      question: 'Para criar um "default deny all ingress" em um namespace, qual configuracao usar?',
      options: [
        'podSelector: {} com policyTypes: [Ingress] e sem campo ingress',
        'podSelector: {} com ingress: []',
        'podSelector: {deny: all} com policyTypes: [Ingress]',
        'namespaceSelector: {} com policyTypes: [Ingress]'
      ],
      correct: 0,
      explanation: 'Um podSelector vazio ({}) seleciona todos os Pods. Listar Ingress em policyTypes sem definir regras de ingress resulta em deny all. A omissao do campo ingress com policyTypes definido e a forma semanticamente mais clara.'
    },
    {
      question: 'Qual CNI NAO suporta NetworkPolicies nativamente?',
      options: ['Calico', 'Cilium', 'Flannel (puro)', 'Antrea'],
      correct: 2,
      explanation: 'Flannel por si so nao implementa NetworkPolicies. Para ter NetworkPolicies com Flannel, e necessario adicionar Calico como enforcer separado. Calico, Cilium e Antrea suportam NetworkPolicies nativamente.'
    },
    {
      question: 'Como permitir apenas que Pods do namespace "monitoring" acessem um Pod especifico?',
      options: [
        'ingress com namespaceSelector matchando o namespace monitoring',
        'ingress com podSelector matchando Pods do monitoring',
        'egress com namespaceSelector monitoring',
        'Nao e possivel filtrar por namespace'
      ],
      correct: 0,
      explanation: 'Use namespaceSelector em ingress.from com matchLabels para o label do namespace. No K8s 1.21+, o label kubernetes.io/metadata.name=<nome-do-namespace> esta presente automaticamente em todos os namespaces.'
    },
    {
      question: 'Por que e necessario incluir uma regra de egress para a porta 53/UDP nas NetworkPolicies?',
      options: [
        'Para permitir acesso ao kube-apiserver',
        'Para permitir resolucao DNS dos Pods',
        'Para habilitar health checks',
        'Para conectar ao etcd'
      ],
      correct: 1,
      explanation: 'DNS usa a porta 53/UDP (e TCP). Se voce aplicar uma NetworkPolicy com Egress e nao permitir a porta 53, os Pods nao conseguirao resolver nomes de servicos e hosts, quebrando a comunicacao mesmo que outras regras estejam corretas.'
    },
    {
      question: 'O campo ipBlock com except serve para:',
      options: [
        'Bloquear IPs especificos dentro de um CIDR permitido',
        'Permitir IPs especificos dentro de um CIDR bloqueado',
        'Definir multiplos CIDRs ao mesmo tempo',
        'Negar todo trafego externo'
      ],
      correct: 0,
      explanation: 'ipBlock.cidr define o bloco permitido e ipBlock.except lista sub-CIDRs dentro desse bloco que devem ser excluidos. Ex: cidr 10.0.0.0/8 com except 10.1.0.0/16 permite todo 10.x.x.x exceto o range 10.1.x.x.'
    },
    {
      question: 'Multiplas NetworkPolicies que selecionam o mesmo Pod sao avaliadas de qual forma?',
      options: [
        'Apenas a policy mais recente e aplicada',
        'A policy mais restritiva prevalece',
        'As policies sao cumulativas (OR entre elas)',
        'As policies sao aplicadas em ordem de criacao'
      ],
      correct: 2,
      explanation: 'NetworkPolicies sao cumulativas (additive). Se multiplas policies selecionam o mesmo Pod, o trafego e permitido se QUALQUER UMA delas permitir. E uma logica OR entre policies. Por isso o default-deny deve ser a base e outras policies adicionam permissoes.'
    },
    {
      question: 'Uma NetworkPolicy com policyTypes: [Ingress, Egress] e campos ingress e egress vazios ([]) faz o que?',
      options: [
        'Permite todo trafego (lista vazia = sem restricoes)',
        'Bloqueia todo trafego (lista declarada mas vazia = deny all)',
        'Aplica as policies padrao do cluster',
        'Causa erro de validacao no Kubernetes'
      ],
      correct: 1,
      explanation: 'Quando os campos ingress: [] ou egress: [] sao declarados como listas vazias com policyTypes correspondentes, o Pod se torna isolated para aquele tipo mas sem nenhuma regra de permissao, resultando em deny all. Diferente de omitir o campo completamente.'
    },
    {
      question: 'Como usar named ports (portas nomeadas) em uma NetworkPolicy?',
      options: [
        'Nao e possivel usar portas nomeadas em NetworkPolicy',
        'Definir o nome da porta no campo port: da NetworkPolicy, referenciando o nome definido no containerPort',
        'Usar o campo portName: em vez de port: na NetworkPolicy',
        'Criar um ConfigMap com o mapeamento de nomes para numeros de porta'
      ],
      correct: 1,
      explanation: 'E possivel usar portas nomeadas em NetworkPolicy. Defina um nome no containerPort do Pod (ex: name: http-api) e use esse nome no campo port: da NetworkPolicy. Isso facilita manutencao pois o numero pode mudar sem alterar a policy.'
    }
  ],

  flashcards: [
    {
      front: 'O que acontece com o trafego de um Pod quando a primeira NetworkPolicy e aplicada a ele?',
      back: 'O Pod se torna "isolated" para o tipo de trafego especificado (Ingress, Egress ou ambos). Todo trafego desse tipo que nao for explicitamente permitido por alguma NetworkPolicy e bloqueado. NetworkPolicies sao additive (OR entre policies).'
    },
    {
      front: 'Qual a diferenca de AND vs OR em rules de NetworkPolicy?',
      back: 'AND: podSelector e namespaceSelector no mesmo item da lista (mesmo bloco). OR: cada selector em itens separados da lista "from"/"to". Esta e uma das pegadinhas mais comuns do CKA. Identifique pelo nivel de indentacao no YAML.'
    },
    {
      front: 'Como criar um "default deny all" para um namespace completo?',
      back: 'spec.podSelector: {} (seleciona todos os Pods) com spec.policyTypes: [Ingress, Egress] e sem definir campos ingress/egress. Isso bloqueia todo trafego de entrada e saida em todos os Pods do namespace.'
    },
    {
      front: 'O que e necessario configurar no namespace para usar namespaceSelector?',
      back: 'O namespace deve ter labels. A partir do K8s 1.21, o label kubernetes.io/metadata.name=<nome> e adicionado automaticamente. Para labels customizados: kubectl label namespace <nome> env=producao'
    },
    {
      front: 'Por que CNI importa para NetworkPolicies?',
      back: 'NetworkPolicy e apenas uma especificacao de API. Quem IMPLEMENTA e ENFORCE as regras e o CNI plugin. Sem um CNI compativel (Calico, Cilium, Antrea), as NetworkPolicies sao criadas no cluster mas nao tem efeito algum.'
    },
    {
      front: 'Como permitir DNS para Pods com NetworkPolicy de Egress restritiva?',
      back: 'Adicionar regra de egress para porta 53/UDP e 53/TCP. Exemplo: egress: [{ports: [{port: 53, protocol: UDP}, {port: 53, protocol: TCP}]}]. Sem isso, o Pod nao resolve nomes mesmo com outras regras corretas.'
    },
    {
      front: 'NetworkPolicies sao cumulativas ou substitutas?',
      back: 'Cumulativas (additive). Se multiplas NetworkPolicies se aplicam a um Pod, o trafego e permitido se QUALQUER UMA delas permitir. Pense como OR entre policies, mas AND dentro dos selectors de uma unica regra.'
    },
    {
      front: 'O que faz um campo ingress: - {} (item vazio) em uma NetworkPolicy?',
      back: 'Um item vazio na lista ingress significa "qualquer fonte". E o equivalente a allow all ingress. Util para Pods que precisam aceitar trafego de qualquer lugar (ex: frontends expostos via LoadBalancer).'
    },
    {
      front: 'Qual a diferenca entre omitir o campo ingress e declarar ingress: []?',
      back: 'Omitir o campo ingress quando policyTypes inclui Ingress = deny all ingress (sem regras = nenhum trafego permitido). Declarar ingress: [] tem o mesmo efeito. A diferenca e semantica/clareza. Se policyTypes NAO inclui Ingress, o campo e ignorado.'
    },
    {
      front: 'Como o campo ipBlock funciona e para que e usado?',
      back: 'ipBlock.cidr define um range de IPs externos (fora do cluster) permitidos. ipBlock.except exclui sub-ranges dentro do cidr. Usado para permitir/bloquear trafego de redes especificas, como IPs de load balancers externos ou ranges de VPN.'
    },
    {
      front: 'Como isolar um namespace mas ainda permitir comunicacao interna entre Pods do mesmo namespace?',
      back: 'Criar policy com podSelector: {} e regras ingress e egress usando podSelector: {} (selector vazio seleciona todos no mesmo namespace). Isso permite comunicacao intra-namespace enquanto bloqueia trafego inter-namespace.'
    },
    {
      front: 'Quais protocolos sao suportados no campo ports de uma NetworkPolicy?',
      back: 'TCP (padrao se omitido), UDP e SCTP (desde K8s 1.19). ICMP nao e suportado diretamente em NetworkPolicy. Para bloquear ICMP, o CNI deve ter suporte proprio (ex: Calico com GlobalNetworkPolicy).'
    }
  ],

  lab: {
    scenario: 'Uma aplicacao de e-commerce tem 3 camadas: frontend, backend e banco de dados. Atualmente qualquer Pod pode se comunicar com qualquer outro. Voce precisa implementar segmentacao de rede com o principio de menor privilegio, incluindo permitir acesso do namespace de monitoramento e validar o comportamento AND vs OR de selectors.',
    objective: 'Aplicar default-deny em um namespace, liberar seletivamente o trafego necessario entre as camadas, validar logica AND vs OR em selectors, e permitir acesso do namespace de monitoramento via namespaceSelector.',
    steps: [
      {
        title: 'Preparar ambiente e validar comunicacao inicial',
        instruction: `Crie um namespace chamado loja. Dentro dele, crie 3 Pods com labels distintas: tier=frontend, tier=backend e tier=database. Adicione um namespace "monitoring" com um Pod de monitoramento. Valide que todos conseguem se comunicar antes de aplicar qualquer policy.`,
        hints: [
          'Use kubectl run com --labels para definir as labels',
          'Use kubectl exec com wget ou nc para testar conectividade',
          'Obtenha os IPs dos Pods com kubectl get pods -n loja -o wide'
        ],
        solution: `\`\`\`bash
kubectl create namespace loja
kubectl create namespace monitoring

# Criar pods nas camadas
kubectl run frontend --image=nginx --labels="tier=frontend" -n loja
kubectl run backend  --image=nginx --labels="tier=backend"  -n loja
kubectl run database --image=nginx --labels="tier=database" -n loja
kubectl run prometheus --image=nginx --labels="app=prometheus" -n monitoring

# Aguardar pods ficarem Running
kubectl get pods -n loja -w

# Obter IPs dos pods
kubectl get pods -n loja -o wide

# Testar conectividade livre (deve funcionar)
BACKEND_IP=$(kubectl get pod backend -n loja -o jsonpath='{.status.podIP}')
DB_IP=$(kubectl get pod database -n loja -o jsonpath='{.status.podIP}')

kubectl exec -n loja frontend -- wget -qO- --timeout=3 http://$BACKEND_IP && echo "frontend->backend: OK"
kubectl exec -n loja frontend -- wget -qO- --timeout=3 http://$DB_IP && echo "frontend->database: OK"
\`\`\``
      },
      {
        title: 'Aplicar default-deny e verificar bloqueio',
        instruction: `Aplique uma NetworkPolicy de default-deny-all no namespace loja. Apos aplicar, verifique que o trafego entre os Pods foi bloqueado. Observe que a policy usa podSelector vazio e lista os dois policyTypes sem regras.`,
        hints: [
          'podSelector: {} seleciona TODOS os Pods do namespace',
          'Nao defina campos ingress: ou egress: para que o deny seja total',
          'O timeout no wget vai demorar - use --timeout=3 para nao esperar muito'
        ],
        solution: `\`\`\`bash
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: loja
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
EOF

# Verificar que trafego foi bloqueado
BACKEND_IP=$(kubectl get pod backend -n loja -o jsonpath='{.status.podIP}')
kubectl exec -n loja frontend -- wget -qO- --timeout=3 http://$BACKEND_IP
echo "Exit code: $? (deve ser != 0 = trafego bloqueado)"

# Ver a policy criada
kubectl describe networkpolicy default-deny-all -n loja
\`\`\``
      },
      {
        title: 'Liberar trafego seletivo entre as camadas',
        instruction: `Crie NetworkPolicies que permitam: (1) frontend enviar trafego para backend na porta 80; (2) backend enviar trafego para database na porta 80; (3) ambos permitirem DNS (porta 53/UDP). Valide que frontend NAO consegue acessar database diretamente.`,
        hints: [
          'Cada policy controla o Pod definido em podSelector',
          'Use egress no frontend para permitir saida para backend',
          'Use ingress no backend para aceitar entrada do frontend',
          'Combine ingress e egress para seguranca bidirecional'
        ],
        solution: `\`\`\`bash
# Policy: frontend pode enviar para backend e DNS
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-egress
  namespace: loja
spec:
  podSelector:
    matchLabels:
      tier: frontend
  policyTypes:
    - Egress
  egress:
    - to:
        - podSelector:
            matchLabels:
              tier: backend
      ports:
        - port: 80
    - ports:
        - port: 53
          protocol: UDP
        - port: 53
          protocol: TCP
EOF

# Policy: backend aceita do frontend e envia para database
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-backend-access
  namespace: loja
spec:
  podSelector:
    matchLabels:
      tier: backend
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              tier: frontend
      ports:
        - port: 80
  egress:
    - to:
        - podSelector:
            matchLabels:
              tier: database
      ports:
        - port: 80
    - ports:
        - port: 53
          protocol: UDP
EOF

# Validar: frontend -> backend DEVE funcionar
BACKEND_IP=$(kubectl get pod backend -n loja -o jsonpath='{.status.podIP}')
kubectl exec -n loja frontend -- wget -qO- --timeout=3 http://$BACKEND_IP && echo "OK: frontend->backend"

# Validar: frontend -> database DEVE ser bloqueado
DB_IP=$(kubectl get pod database -n loja -o jsonpath='{.status.podIP}')
kubectl exec -n loja frontend -- wget -qO- --timeout=3 http://$DB_IP && echo "FALHA DE SEGURANCA" || echo "OK: frontend->database bloqueado"
\`\`\``
      },
      {
        title: 'Validar logica AND vs OR com namespaceSelector',
        instruction: `Crie uma NetworkPolicy que permita acesso do namespace monitoring ao backend na porta 9090 (metricas). Primeiro usando AND (so Pods com app=prometheus do namespace monitoring) e valide. Depois mude para OR e observe a diferenca de comportamento.`,
        hints: [
          'Adicione label ao namespace monitoring para usar em namespaceSelector',
          'AND: namespaceSelector e podSelector no mesmo item da lista from',
          'OR: namespaceSelector e podSelector em itens separados da lista from',
          'kubectl label namespace monitoring kubernetes.io/metadata.name=monitoring'
        ],
        solution: `\`\`\`bash
# Verificar labels do namespace (K8s 1.21+ tem automatico)
kubectl get namespace monitoring --show-labels

# Criar policy com AND logico (MAIS RESTRITIVO)
# Permite APENAS Pods com app=prometheus QUE ESTEJAM no namespace monitoring
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-monitoring-and
  namespace: loja
spec:
  podSelector:
    matchLabels:
      tier: backend
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:          # AND: mesmo item
            matchLabels:
              kubernetes.io/metadata.name: monitoring
          podSelector:                # mesmo item = AND
            matchLabels:
              app: prometheus
      ports:
        - port: 9090
          protocol: TCP
EOF

# Validar: prometheus no monitoring pode acessar backend
BACKEND_IP=$(kubectl get pod backend -n loja -o jsonpath='{.status.podIP}')
kubectl exec -n monitoring prometheus -- wget -qO- --timeout=3 http://$BACKEND_IP:9090 && echo "OK" || echo "Bloqueado"

# Alternativa com OR logico (MENOS RESTRITIVO)
# Permite: qualquer Pod do namespace monitoring OU qualquer Pod com app=prometheus
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-monitoring-or
  namespace: loja
spec:
  podSelector:
    matchLabels:
      tier: backend
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:          # OR: item separado
            matchLabels:
              kubernetes.io/metadata.name: monitoring
        - podSelector:                # item separado = OR
            matchLabels:
              app: prometheus
      ports:
        - port: 9090
          protocol: TCP
EOF
\`\`\``
      },
      {
        title: 'Usar ipBlock e verificar todas as policies do namespace',
        instruction: `Adicione uma NetworkPolicy que permite ao frontend receber trafego de um range de IPs externos (simulando um Load Balancer). Use ipBlock com CIDR 0.0.0.0/0 mas exclua os IPs internos do cluster. Por fim, liste e documente todas as policies aplicadas no namespace.`,
        hints: [
          'O CIDR do cluster geralmente e 10.0.0.0/8 ou 192.168.0.0/16',
          'Use except para excluir o range interno do bloco 0.0.0.0/0',
          'kubectl get networkpolicy -n loja lista todas as policies',
          'kubectl describe networkpolicy -n loja mostra detalhes de todas'
        ],
        solution: `\`\`\`bash
# Permitir frontend receber de IPs externos (excluindo IPs internos)
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-external-to-frontend
  namespace: loja
spec:
  podSelector:
    matchLabels:
      tier: frontend
  policyTypes:
    - Ingress
  ingress:
    - from:
        - ipBlock:
            cidr: 0.0.0.0/0
            except:
              - 10.0.0.0/8        # IPs internos do cluster/VPC
              - 192.168.0.0/16    # range privado
              - 172.16.0.0/12     # range privado
      ports:
        - port: 80
          protocol: TCP
        - port: 443
          protocol: TCP
EOF

# Listar todas as policies no namespace
kubectl get networkpolicy -n loja

# Ver detalhes de todas as policies
kubectl describe networkpolicy -n loja

# Resumo: qual Pod esta protegido por qual policy
echo "=== Policies no namespace loja ==="
for policy in $(kubectl get networkpolicy -n loja -o jsonpath='{.items[*].metadata.name}'); do
  echo ""
  echo "--- $policy ---"
  kubectl get networkpolicy $policy -n loja -o jsonpath='{.spec.podSelector}' | python3 -m json.tool 2>/dev/null || echo "podSelector vazio (todos os Pods)"
done
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'NetworkPolicy criada mas trafego ainda nao e bloqueado',
      symptom: 'Apos criar uma NetworkPolicy de default-deny, os Pods ainda conseguem se comunicar livremente. A policy aparece no kubectl get networkpolicy, mas nao tem efeito.',
      diagnosis: `Investigar se o CNI suporta NetworkPolicy:

\`\`\`bash
# 1. Verificar qual CNI esta instalado
kubectl get pods -n kube-system | grep -E "calico|cilium|weave|antrea|flannel"

# 2. Verificar daemonsets de CNI
kubectl get daemonset -n kube-system

# 3. Se Flannel aparece mas nao Calico: confirmar ausencia de suporte nativo
# Flannel NAO implementa NetworkPolicy sem um enforcer adicional

# 4. Verificar se a policy esta no namespace correto
kubectl get networkpolicy -A

# 5. Verificar se o podSelector bate com os Pods
kubectl describe networkpolicy default-deny-all -n meu-namespace
kubectl get pods -n meu-namespace --show-labels

# 6. Verificar eventos do namespace
kubectl get events -n meu-namespace --sort-by='.lastTimestamp'
\`\`\`

**Causas:**
- CNI instalado nao suporta NetworkPolicies (ex: Flannel puro)
- Policy criada em namespace errado
- podSelector nao bate com as labels dos Pods`,
      solution: `**Se o CNI nao suporta:**

\`\`\`bash
# Instalar Calico em clusters Kind (modo lab)
kubectl apply -f https://raw.githubusercontent.com/projectcalico/calico/v3.27.0/manifests/calico.yaml

# Verificar se Calico ficou Running
kubectl get pods -n kube-system -l k8s-app=calico-node

# Para ambiente de producao: migrar o CNI (requer planejamento)
# Consultar documentacao do Calico/Cilium para migracao sem downtime

# Se o podSelector esta errado: verificar labels
kubectl get pods -n meu-namespace --show-labels
kubectl get pods -n meu-namespace -l app=backend  # deve retornar os Pods esperados

# Recriar a policy no namespace correto se necessario
kubectl delete networkpolicy default-deny-all -n namespace-errado
kubectl apply -f network-policy.yaml  # com o namespace correto no metadata
\`\`\``
    },
    {
      title: 'Pod nao consegue se comunicar apos aplicar NetworkPolicy',
      symptom: 'Apos aplicar NetworkPolicies de segmentacao, um Pod que deveria conseguir se comunicar com outro esta sendo bloqueado. O Pod de origem nao recebe resposta ao tentar conectar.',
      diagnosis: `Diagnostico sistematico:

\`\`\`bash
# 1. Verificar todas as policies que afetam os Pods envolvidos
kubectl get networkpolicy -n meu-namespace

# 2. Ver quais Pods cada policy seleciona
kubectl describe networkpolicy -n meu-namespace

# 3. Verificar labels dos Pods de origem e destino
kubectl get pods -n meu-namespace --show-labels

# 4. Testar conectividade direta por IP (bypass DNS)
SRC_POD=frontend
DST_IP=$(kubectl get pod backend -n meu-namespace -o jsonpath='{.status.podIP}')
kubectl exec -n meu-namespace $SRC_POD -- nc -zv $DST_IP 8080 -w 3

# 5. Verificar se o problema e DNS ou conectividade
# Se ping por IP funciona mas por nome nao: problema e DNS (porta 53 bloqueada)
kubectl exec -n meu-namespace $SRC_POD -- nslookup backend-svc

# 6. Verificar se ha policy de Egress bloqueando o Pod de origem
kubectl get networkpolicy -n meu-namespace -o json | python3 -c "
import json,sys
data=json.load(sys.stdin)
for p in data['items']:
    print(p['metadata']['name'], '- policyTypes:', p['spec'].get('policyTypes',[]))
"

# 7. Verificar se ha policy de Ingress bloqueando o Pod de destino
# Um bloqueio pode estar nos dois lados: Egress da origem OU Ingress do destino
\`\`\`

**Causas comuns:**
- Falta regra de Egress no Pod de origem
- Falta regra de Ingress no Pod de destino
- Labels dos Pods nao batem com os selectors da policy
- Porta bloqueada (policy libera porta errada)
- DNS bloqueado (porta 53 nao esta liberada no egress)`,
      solution: `**Correcoes:**

\`\`\`bash
# Verificar e corrigir labels dos Pods
kubectl get pod frontend -n meu-namespace --show-labels
# Se a label estiver errada, recriar o Pod com a label correta ou adicionar:
kubectl label pod frontend tier=frontend -n meu-namespace

# Adicionar regra de DNS faltante (causa mais comum)
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns
  namespace: meu-namespace
spec:
  podSelector: {}
  policyTypes:
    - Egress
  egress:
    - ports:
        - port: 53
          protocol: UDP
        - port: 53
          protocol: TCP
EOF

# Verificar porta correta na policy vs Service
kubectl get service backend-svc -n meu-namespace -o jsonpath='{.spec.ports}'
# Confirmar que a porta na NetworkPolicy bate com a port: do Service (nao a targetPort)

# Depurar com tcpdump (requer privilegios) se disponivel
# Usar ferramenta de debug da rede (ex: kubectl netshoot)
kubectl run netshoot --rm -it --image=nicolaka/netshoot -n meu-namespace -- bash
# dentro: tcpdump -i eth0 -n port 8080
\`\`\``
    },
    {
      title: 'Logica AND vs OR em NetworkPolicy causando comportamento inesperado',
      symptom: 'Uma NetworkPolicy esta bloqueando trafego que deveria estar permitido, ou permitindo trafego que deveria estar bloqueado. O YAML parece correto mas o comportamento e diferente do esperado.',
      diagnosis: `Identificar o problema de logica AND/OR:

\`\`\`bash
# 1. Verificar o YAML completo da policy suspeita
kubectl get networkpolicy policy-suspeita -n meu-namespace -o yaml

# Observar a estrutura de indentacao:
# AND (mais restritivo):
# from:
#   - namespaceSelector: {...}    <- mesmo item
#     podSelector: {...}          <- mesmo nivel de indentacao

# OR (menos restritivo):
# from:
#   - namespaceSelector: {...}    <- item 1
#   - podSelector: {...}          <- item 2 (hifen indica novo item)

# 2. Testar o comportamento real
# Pod que DEVERIA ser permitido mas esta bloqueado?
SOURCE_IP=$(kubectl get pod pod-bloqueado -n outro-namespace -o jsonpath='{.status.podIP}')
DST_IP=$(kubectl get pod pod-destino -n meu-namespace -o jsonpath='{.status.podIP}')
kubectl exec -n outro-namespace pod-bloqueado -- nc -zv $DST_IP 80 -w 3

# 3. Verificar labels dos dois lados
kubectl get pod pod-bloqueado -n outro-namespace --show-labels
kubectl get namespace outro-namespace --show-labels

# 4. Para AND: o Pod deve satisfazer AMBAS as condicoes
# - Estar no namespace com o label namespaceSelector
# - TER as labels do podSelector
\`\`\`

**Diagnostico de AND vs OR:**
- **Comportamento mais restritivo do que esperado:** provavelmente AND quando queria OR
- **Comportamento menos restritivo do que esperado:** provavelmente OR quando queria AND`,
      solution: `**Correcoes de logica:**

\`\`\`bash
# CORRETO para AND (ambos criterios no mesmo item):
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: policy-and-correto
  namespace: meu-namespace
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:         # AND: mesmo objeto
            matchLabels:
              env: producao
          podSelector:               # mesmo nivel = AND
            matchLabels:
              role: scraper
EOF

# CORRETO para OR (criterios em itens separados):
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: policy-or-correto
  namespace: meu-namespace
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:         # OR: item 1 (hifen)
            matchLabels:
              env: producao
        - podSelector:               # OR: item 2 (hifen)
            matchLabels:
              role: admin
EOF

# Dica de validacao: use dry-run e verifique o YAML gerado
kubectl apply -f policy.yaml --dry-run=server -o yaml
\`\`\``
    }
  ]
};
