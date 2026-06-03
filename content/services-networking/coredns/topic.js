window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['services-networking/coredns'] = {
  theory: `# CoreDNS

## O que e CoreDNS?

**CoreDNS** e o servidor DNS padrao do Kubernetes desde a versao 1.13. Ele resolve nomes de services e pods dentro do cluster, permitindo service discovery sem necessidade de conhecer IPs estaticos.

CoreDNS roda como um Deployment no namespace kube-system e e exposto via um Service chamado **kube-dns**.

---

## Service Discovery via DNS

### Formato completo do nome DNS de um Service

\`\`\`
<service-name>.<namespace>.svc.<cluster-domain>
\`\`\`

Exemplo com cluster-domain padrao (cluster.local):

\`\`\`
meu-servico.producao.svc.cluster.local
\`\`\`

### Formas de resolucao (busca progressiva)

Os Pods buscam nomes usando o arquivo /etc/resolv.conf:

\`\`\`
nameserver 10.96.0.10          # IP do Service kube-dns
search default.svc.cluster.local svc.cluster.local cluster.local
options ndots:5
\`\`\`

Por isso, dentro do mesmo namespace, basta usar o nome curto:

\`\`\`bash
# Todos sao equivalentes dentro do namespace "default":
curl http://meu-servico
curl http://meu-servico.default
curl http://meu-servico.default.svc
curl http://meu-servico.default.svc.cluster.local
\`\`\`

Para acessar de outro namespace, use pelo menos:

\`\`\`bash
curl http://meu-servico.producao
\`\`\`

---

## DNS para Pods

Por padrao, o DNS de um Pod usa o IP com hifens + namespace + pod + cluster.local:

\`\`\`
<ip-com-hifens>.<namespace>.pod.cluster.local
\`\`\`

Exemplo: Pod com IP 10.244.1.15 no namespace app:

\`\`\`
10-244-1-15.app.pod.cluster.local
\`\`\`

Para StatefulSets com Headless Service, cada Pod tem um DNS previsivel:

\`\`\`
<pod-name>.<service-name>.<namespace>.svc.cluster.local
banco-0.banco-headless.app.svc.cluster.local
banco-1.banco-headless.app.svc.cluster.local
\`\`\`

---

## DNS Policies dos Pods

Configurado em spec.dnsPolicy:

### ClusterFirst (padrao)

\`\`\`yaml
spec:
  dnsPolicy: ClusterFirst
\`\`\`

Queries primeiro vao para CoreDNS. Se nao resolver, encaminha para o DNS upstream configurado no Node. Ideal para a maioria das aplicacoes.

### Default

\`\`\`yaml
spec:
  dnsPolicy: Default
\`\`\`

Usa o /etc/resolv.conf do **Node** (nao do cluster). O Pod nao usa CoreDNS. Util para Pods que precisam resolver apenas nomes externos.

### None

\`\`\`yaml
spec:
  dnsPolicy: None
  dnsConfig:
    nameservers:
      - 8.8.8.8
      - 8.8.4.4
    searches:
      - minha-empresa.com
    options:
      - name: ndots
        value: "2"
\`\`\`

Configuracao DNS completamente manual. O Pod ignora tanto CoreDNS quanto o DNS do Node.

### ClusterFirstWithHostNet

\`\`\`yaml
spec:
  hostNetwork: true
  dnsPolicy: ClusterFirstWithHostNet
\`\`\`

Para Pods que usam hostNetwork: true mas ainda precisam resolver nomes de Services do cluster.

---

## Configuracao do CoreDNS (Corefile)

O CoreDNS e configurado via ConfigMap no namespace kube-system:

\`\`\`bash
kubectl get configmap coredns -n kube-system -o yaml
\`\`\`

Corefile padrao:

\`\`\`
.:53 {
    errors
    health {
       lameduck 5s
    }
    ready
    kubernetes cluster.local in-addr.arpa ip6.arpa {
       pods insecure
       fallthrough in-addr.arpa ip6.arpa
       ttl 30
    }
    prometheus :9153
    forward . /etc/resolv.conf {
       max_concurrent 1000
    }
    cache 30
    loop
    reload
    loadbalance
}
\`\`\`

**Principais plugins:**
- **errors**: loga erros de resolucao
- **health**: endpoint /health para liveness probe
- **ready**: endpoint /ready para readiness probe
- **kubernetes**: resolucao de Services e Pods do cluster
- **prometheus**: metricas em :9153
- **forward**: encaminha queries nao resolvidas para upstream
- **cache**: cache de respostas DNS (padrao 30s)
- **loadbalance**: round-robin entre multiplos A records

---

## Configurando Stub Domains

Para encaminhar queries de um dominio especifico para um DNS customizado:

\`\`\`
empresa.com:53 {
    errors
    cache 30
    forward . 192.168.1.10 192.168.1.11
}

.:53 {
    errors
    health
    kubernetes cluster.local in-addr.arpa ip6.arpa {
       pods insecure
       fallthrough in-addr.arpa ip6.arpa
    }
    forward . /etc/resolv.conf
    cache 30
    loop
    reload
    loadbalance
}
\`\`\`

Aplicar via ConfigMap:

\`\`\`bash
kubectl edit configmap coredns -n kube-system
# Adicionar o bloco empresa.com:53 acima do bloco .:53

# Reiniciar CoreDNS para aplicar
kubectl rollout restart deployment/coredns -n kube-system
\`\`\`

---

## Configurando Upstream Nameservers

Para alterar o DNS upstream (usado quando CoreDNS nao resolve):

\`\`\`
forward . 8.8.8.8 8.8.4.4 {
    max_concurrent 1000
}
\`\`\`

---

## Debugging DNS

### nslookup

\`\`\`bash
# Dentro de um Pod (requer nslookup instalado)
kubectl exec -it meu-pod -- nslookup kubernetes.default
kubectl exec -it meu-pod -- nslookup meu-servico.meu-namespace

# Verificar o DNS server sendo usado
kubectl exec -it meu-pod -- nslookup kubernetes.default kube-dns.kube-system
\`\`\`

### dig

\`\`\`bash
# dig e mais detalhado que nslookup
kubectl exec -it meu-pod -- dig meu-servico.meu-namespace.svc.cluster.local

# Ver apenas o IP
kubectl exec -it meu-pod -- dig +short meu-servico.meu-namespace.svc.cluster.local

# Consultar CoreDNS diretamente pelo IP do Service
COREDNS_IP=$(kubectl get svc kube-dns -n kube-system -o jsonpath='{.spec.clusterIP}')
kubectl exec -it meu-pod -- dig @$COREDNS_IP meu-servico.meu-namespace.svc.cluster.local
\`\`\`

### Verificar o /etc/resolv.conf do Pod

\`\`\`bash
kubectl exec -it meu-pod -- cat /etc/resolv.conf
# Deve mostrar: nameserver <IP do kube-dns>, search domains
\`\`\`

### Pod dedicado para debug DNS

\`\`\`bash
# Criar pod temporario com ferramentas de rede
kubectl run dns-debug --rm -it \
  --image=registry.k8s.io/e2e-test-images/jessie-dnsutils:1.3 \
  --restart=Never -- bash

# Dentro do pod:
# nslookup kubernetes.default
# nslookup meu-servico.meu-namespace
# dig meu-servico.meu-namespace.svc.cluster.local
\`\`\`

### Verificar saude do CoreDNS

\`\`\`bash
# Ver Pods do CoreDNS
kubectl get pods -n kube-system -l k8s-app=kube-dns

# Ver logs
kubectl logs -n kube-system -l k8s-app=kube-dns

# Ver metricas (se prometheus plugin ativo)
kubectl port-forward -n kube-system service/kube-dns 9153:9153
curl http://localhost:9153/metrics | grep coredns_dns_requests_total
\`\`\`
`,

  quiz: [
    {
      question: 'Qual e o formato completo do nome DNS de um Service chamado "api" no namespace "app" no cluster padrao?',
      options: [
        'api.app.cluster.local',
        'api.app.svc.cluster.local',
        'app.api.svc.cluster.local',
        'api.svc.app.cluster.local'
      ],
      correct: 1,
      explanation: 'O formato correto e <service>.<namespace>.svc.<cluster-domain>. Com cluster-domain padrao cluster.local: api.app.svc.cluster.local. A parte "svc" diferencia Services de Pods no DNS.'
    },
    {
      question: 'Qual dnsPolicy faz o Pod usar o DNS do Node em vez do CoreDNS?',
      options: ['ClusterFirst', 'None', 'Default', 'NodeDNS'],
      correct: 2,
      explanation: 'dnsPolicy: Default usa o /etc/resolv.conf do Node host, sem passar pelo CoreDNS. O nome "Default" e contraintuitivo — o padrao real para Pods e ClusterFirst, nao Default.'
    },
    {
      question: 'Onde esta armazenada a configuracao do CoreDNS (Corefile)?',
      options: [
        'Secret coredns no namespace kube-system',
        'ConfigMap coredns no namespace kube-system',
        'Arquivo /etc/coredns/Corefile no Node',
        'ConfigMap kube-dns no namespace default'
      ],
      correct: 1,
      explanation: 'A configuracao do CoreDNS (Corefile) fica no ConfigMap chamado "coredns" no namespace kube-system. Pode ser editado com kubectl edit configmap coredns -n kube-system.'
    },
    {
      question: 'Dentro do mesmo namespace, qual e a forma mais curta valida para resolver um Service?',
      options: [
        'Apenas o IP do Service',
        'Apenas o nome do Service',
        'nome.svc',
        'nome.namespace'
      ],
      correct: 1,
      explanation: 'Dentro do mesmo namespace, basta usar o nome do Service. O /etc/resolv.conf dos Pods tem entries de "search" que incluem <namespace>.svc.cluster.local, permitindo resolucao pelo nome curto.'
    },
    {
      question: 'Qual e o nome do Service que expoe o CoreDNS para os Pods do cluster?',
      options: ['coredns', 'dns', 'kube-dns', 'cluster-dns'],
      correct: 2,
      explanation: 'O CoreDNS e exposto pelo Service chamado "kube-dns" no namespace kube-system. Este nome e mantido por compatibilidade historica com o kube-dns anterior. O IP deste Service aparece no /etc/resolv.conf dos Pods.'
    },
    {
      question: 'Para que serve o plugin "forward" no Corefile do CoreDNS?',
      options: [
        'Encaminhar trafego TCP para Services',
        'Encaminhar queries DNS nao resolvidas para servidores DNS upstream',
        'Fazer forward de logs para o Prometheus',
        'Encaminhar requests do kube-apiserver'
      ],
      correct: 1,
      explanation: 'O plugin forward encaminha queries que o CoreDNS nao consegue resolver (fora do dominio cluster.local) para servidores DNS externos (upstream). Por padrao usa /etc/resolv.conf do Node, que contem os DNS da rede fisica.'
    },
    {
      question: 'Qual dnsPolicy usar em um Pod com hostNetwork: true que ainda precisa resolver Services do cluster?',
      options: ['ClusterFirst', 'Default', 'None', 'ClusterFirstWithHostNet'],
      correct: 3,
      explanation: 'Pods com hostNetwork: true usam a network stack do Node. Para que ainda possam usar CoreDNS, deve-se usar dnsPolicy: ClusterFirstWithHostNet. Com ClusterFirst puro em hostNetwork, o /etc/resolv.conf pode nao apontar para o CoreDNS.'
    },
    {
      question: 'Um pod nao consegue resolver nomes de outros services no cluster. Como diagnosticar o problema de forma rapida?',
      options: [
        'kubectl exec meu-pod -- cat /etc/resolv.conf e nslookup kubernetes.default',
        'kubectl get dns -n kube-system',
        'kubectl describe pod meu-pod | grep DNS',
        'kubectl get configmap resolv -n kube-system'
      ],
      correct: 0,
      explanation: 'O processo de debug de DNS segue: (1) cat /etc/resolv.conf no pod - verifica se aponta para o IP do kube-dns; (2) nslookup kubernetes.default - testa resolucao do service kubernetes; (3) nslookup <meu-service>.<namespace>.svc.cluster.local - testa resolucao especifica; (4) kubectl logs -n kube-system -l k8s-app=kube-dns - verifica logs do CoreDNS.'
    },
    {
      question: 'Como o CoreDNS e escalado em um cluster de producao?',
      options: [
        'Editando o DaemonSet do CoreDNS para aumentar o numero de replicas',
        'Editando o Deployment do CoreDNS: kubectl scale deploy/coredns -n kube-system --replicas=N',
        'O CoreDNS e escalonado automaticamente pelo Cluster Autoscaler',
        'Instalando multiplos CoreDNS com namespaces diferentes'
      ],
      correct: 1,
      explanation: 'O CoreDNS roda como um Deployment (nao DaemonSet) no kube-system. Pode ser escalado manualmente com kubectl scale ou configurado com HPA para escalonamento automatico baseado no numero de nodes (o addon cluster-proportional-autoscaler faz isso automaticamente em clusters gerenciados).'
    },
    {
      question: 'O que o campo ndots no /etc/resolv.conf dos Pods controla?',
      options: [
        'O numero maximo de servidores DNS configurados',
        'O numero de pontos num nome DNS antes de tentar resolucao absoluta diretamente',
        'O numero de tentativas de retry em caso de timeout',
        'O TTL do cache DNS do pod'
      ],
      correct: 1,
      explanation: 'ndots:5 (padrao em Kubernetes) significa: se um nome tem menos de 5 pontos, tenta primeiro resolver usando os search domains do /etc/resolv.conf (appending namespace, svc.cluster.local, etc.). Isso e otimo para nomes curtos mas pode causar latencia extra para nomes externos como api.exemplo.com (4 pontos = tenta search domains primeiro).'
    },
    {
      question: 'Como adicionar um stub domain customizado no CoreDNS para que o dominio "empresa.local" seja resolvido por um DNS interno especifico?',
      options: [
        'Adicionar um entry no /etc/hosts de cada Pod',
        'Editar o ConfigMap coredns em kube-system adicionando um bloco "empresa.local { forward . 10.0.0.1 }"',
        'Criar um Service do tipo ExternalName apontando para o DNS interno',
        'Configurar a flag --dns-server=10.0.0.1 no kubelet'
      ],
      correct: 1,
      explanation: 'Para adicionar stub domains no CoreDNS, edite o ConfigMap coredns em kube-system e adicione um bloco para o dominio customizado: "empresa.local:53 { forward . 10.0.0.1 }" (ou similar). Apos editar o ConfigMap, o CoreDNS recarrega a configuracao automaticamente. Verifique o reload nos logs do CoreDNS.'
    },
    {
      question: 'Qual e a diferenca entre o DNS de um Service ClusterIP e um Headless Service?',
      options: [
        'Nao ha diferenca - ambos retornam o ClusterIP',
        'Headless Service retorna os IPs individuais dos Pods em vez do ClusterIP',
        'Headless Service nao tem entrada DNS',
        'ClusterIP Service retorna multiplos IPs, Headless retorna apenas um'
      ],
      correct: 1,
      explanation: 'Headless Service (clusterIP: None) nao tem IP virtual. Seu DNS retorna diretamente os IPs dos Pods que correspondem ao seletor (DNS round-robin). Cada Pod tambem recebe um registro A individual no formato <pod-ip>.<namespace>.pod.cluster.local. Usado por StatefulSets para DNS estavel por pod.'
    }
  ],

  flashcards: [
    {
      front: 'Qual e o formato do nome DNS de um Pod no Kubernetes?',
      back: '<ip-com-hifens>.<namespace>.pod.cluster.local. Exemplo: Pod com IP 10.244.1.15 no namespace app = 10-244-1-15.app.pod.cluster.local. Para StatefulSets com headless service: <pod-name>.<svc-name>.<namespace>.svc.cluster.local'
    },
    {
      front: 'Qual e a diferenca entre dnsPolicy: ClusterFirst e dnsPolicy: Default?',
      back: 'ClusterFirst (padrao): queries vao primeiro para CoreDNS, depois upstream. Default: usa o resolv.conf do Node, bypassando o CoreDNS completamente. Confusamente, "Default" nao e o padrao — ClusterFirst e.'
    },
    {
      front: 'Como configurar um stub domain para encaminhar queries de empresa.com para DNS interno?',
      back: 'Adicionar bloco no Corefile: "empresa.com:53 { forward . <IP-DNS-INTERNO> }". Editar via kubectl edit configmap coredns -n kube-system e reiniciar com kubectl rollout restart deployment/coredns -n kube-system.'
    },
    {
      front: 'Quais comandos usar para debugar resolucao DNS de dentro de um Pod?',
      back: 'nslookup <servico>.<namespace>: resolucao basica. dig <servico>.<namespace>.svc.cluster.local: resolucao detalhada. cat /etc/resolv.conf: ver nameserver e search domains. kubectl run dns-debug --rm -it --image=registry.k8s.io/e2e-test-images/jessie-dnsutils:1.3 -- bash'
    },
    {
      front: 'Por que um Pod pode resolver "meu-servico" sem o namespace completo?',
      back: 'O /etc/resolv.conf do Pod tem "search <namespace>.svc.cluster.local svc.cluster.local cluster.local". O SO tenta adicionar cada search domain ao nome curto ate resolver. Por isso "meu-servico" resolve para meu-servico.<namespace>.svc.cluster.local.'
    },
    {
      front: 'Onde fica o ConfigMap de configuracao do CoreDNS e como edita-lo?',
      back: 'kubectl get configmap coredns -n kube-system. Editar: kubectl edit configmap coredns -n kube-system. Apos editar, reiniciar: kubectl rollout restart deployment/coredns -n kube-system. O plugin "reload" recarrega automaticamente, mas rollout garante.'
    },
    {
      front: 'O que o plugin "cache" do CoreDNS faz e qual e o TTL padrao?',
      back: 'Armazena respostas DNS em cache para reduzir carga no CoreDNS e melhorar latencia. TTL padrao: 30 segundos. Configuravel: "cache 60" para 60s. Problemas: mudancas de Service podem demorar ate o TTL para propagar para os Pods.'
    }
  ],

  lab: {
    scenario: 'A equipe de operacoes esta tendo problemas de resolucao DNS em um namespace novo. Alguns Pods nao conseguem resolver Services de outros namespaces, e um servico externo precisa ser acessivel por nome interno. Voce ira diagnosticar e resolver os problemas de DNS do cluster.',
    objective: 'Verificar e validar a resolucao DNS entre namespaces, configurar dnsConfig customizado em um Pod, adicionar stub domain no CoreDNS, e usar ferramentas de debug DNS.',
    steps: [
      {
        title: 'Validar resolucao DNS basica e entre namespaces',
        instruction: `Crie dois namespaces: "ns-frontend" e "ns-backend". Em ns-backend, crie um Service chamado "api-svc". A partir de um Pod no ns-frontend, valide a resolucao DNS usando nomes curtos e FQDN. Identifique por que o nome curto nao funciona entre namespaces.`,
        hints: [
          'Use kubectl run com --rm -it --restart=Never para Pod temporario de debug',
          'Imagem util: busybox:1.35 (tem nslookup) ou registry.k8s.io/e2e-test-images/jessie-dnsutils:1.3 (tem nslookup e dig)',
          'O nome curto "api-svc" so funciona dentro do mesmo namespace',
          'Entre namespaces, use ao menos "api-svc.ns-backend" ou o FQDN completo'
        ],
        solution: `\`\`\`bash
# Criar namespaces e service de teste
kubectl create namespace ns-frontend
kubectl create namespace ns-backend

kubectl create deployment api-app --image=nginx -n ns-backend
kubectl expose deployment api-app --port=80 --name=api-svc -n ns-backend

# Pod de debug no ns-frontend
kubectl run dns-test --rm -it \
  --image=busybox:1.35 \
  --restart=Never \
  -n ns-frontend \
  -- sh

# Dentro do pod, testar:
# nslookup api-svc              # FALHA: nao existe no ns-frontend
# nslookup api-svc.ns-backend   # FUNCIONA: especifica o namespace
# nslookup api-svc.ns-backend.svc.cluster.local  # FQDN completo

# Ver o resolv.conf do pod para entender os search domains
# cat /etc/resolv.conf
# search ns-frontend.svc.cluster.local svc.cluster.local cluster.local
# exit
\`\`\``
      },
      {
        title: 'Usar dnsConfig para customizar resolucao de um Pod',
        instruction: `Crie um Pod com dnsPolicy: None e dnsConfig configurado manualmente. Configure o Pod para usar o CoreDNS do cluster (obter o IP do Service kube-dns) e adicionar o dominio da empresa (empresa.local) aos search paths. Valide que o Pod ainda resolve Services do cluster.`,
        hints: [
          'kubectl get svc kube-dns -n kube-system -o jsonpath="{.spec.clusterIP}" para o IP do CoreDNS',
          'dnsPolicy: None requer dnsConfig com pelo menos um nameserver',
          'Adicione cluster.local nos searches para resolver Services',
          'Teste com nslookup dentro do Pod apos criacao'
        ],
        solution: `\`\`\`bash
# Obter IP do CoreDNS
COREDNS_IP=$(kubectl get svc kube-dns -n kube-system -o jsonpath='{.spec.clusterIP}')
echo "CoreDNS IP: $COREDNS_IP"

kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: pod-dns-custom
  namespace: ns-frontend
spec:
  dnsPolicy: None
  dnsConfig:
    nameservers:
      - $COREDNS_IP
    searches:
      - ns-frontend.svc.cluster.local
      - svc.cluster.local
      - cluster.local
      - empresa.local
    options:
      - name: ndots
        value: "5"
  containers:
    - name: debug
      image: busybox:1.35
      command: ["sleep", "3600"]
EOF

kubectl wait pod/pod-dns-custom -n ns-frontend --for=condition=Ready

# Verificar resolv.conf customizado
kubectl exec -n ns-frontend pod-dns-custom -- cat /etc/resolv.conf

# Validar que resolve services do cluster
kubectl exec -n ns-frontend pod-dns-custom -- nslookup api-svc.ns-backend
kubectl exec -n ns-frontend pod-dns-custom -- nslookup kubernetes.default
\`\`\``
      },
      {
        title: 'Configurar stub domain no CoreDNS e verificar saude',
        instruction: `Edite o ConfigMap do CoreDNS para adicionar um stub domain "empresa.local" que encaminha para um DNS ficticio (8.8.8.8 como placeholder). Em seguida, verifique a saude do CoreDNS via logs e endpoint /health. Simule um problema de DNS e use as ferramentas para diagnosticar.`,
        hints: [
          'kubectl edit configmap coredns -n kube-system',
          'Adicionar bloco antes do bloco ".:53"',
          'kubectl rollout restart deployment/coredns -n kube-system apos editar',
          'kubectl logs -n kube-system -l k8s-app=kube-dns para ver logs'
        ],
        solution: `\`\`\`bash
# Ver configuracao atual
kubectl get configmap coredns -n kube-system -o yaml

# Editar o ConfigMap (adicionar stub domain)
kubectl patch configmap coredns -n kube-system --type merge -p '
{
  "data": {
    "Corefile": "empresa.local:53 {\n    errors\n    cache 30\n    forward . 8.8.8.8\n}\n.:53 {\n    errors\n    health {\n       lameduck 5s\n    }\n    ready\n    kubernetes cluster.local in-addr.arpa ip6.arpa {\n       pods insecure\n       fallthrough in-addr.arpa ip6.arpa\n       ttl 30\n    }\n    prometheus :9153\n    forward . /etc/resolv.conf {\n       max_concurrent 1000\n    }\n    cache 30\n    loop\n    reload\n    loadbalance\n}\n"
  }
}'

# Reiniciar CoreDNS para aplicar
kubectl rollout restart deployment/coredns -n kube-system
kubectl rollout status deployment/coredns -n kube-system

# Verificar saude do CoreDNS
kubectl get pods -n kube-system -l k8s-app=kube-dns
kubectl logs -n kube-system -l k8s-app=kube-dns --tail=20

# Testar endpoint de saude diretamente
COREDNS_POD=$(kubectl get pods -n kube-system -l k8s-app=kube-dns -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n kube-system $COREDNS_POD -- wget -qO- http://localhost:8080/health

# Debug completo de resolucao
kubectl run final-test --rm -it --image=busybox:1.35 --restart=Never -- sh -c "
  echo '=== kubernetes.default ===';
  nslookup kubernetes.default;
  echo '=== api-svc.ns-backend ===';
  nslookup api-svc.ns-backend;
"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Pod nao consegue resolver nomes DNS de Services do cluster',
      symptom: 'Aplicacao dentro de um Pod falha com erros como "could not resolve host", "name resolution failed" ou timeout ao tentar conectar usando nome do Service. Ping para o IP do Service funciona, mas pelo nome nao.',
      diagnosis: `Diagnostico sistematico:

\`\`\`bash
# 1. Verificar se o Pod tem connectivity para o CoreDNS
kubectl exec -n <namespace> <pod> -- cat /etc/resolv.conf
# Deve mostrar: nameserver <IP-do-kube-dns>
# E search domains incluindo <namespace>.svc.cluster.local

# 2. Testar resolucao diretamente
kubectl exec -n <namespace> <pod> -- nslookup kubernetes.default
# Se falhar: problema no CoreDNS ou conectividade de rede

# 3. Verificar se o Service kube-dns esta up
kubectl get svc kube-dns -n kube-system
kubectl get pods -n kube-system -l k8s-app=kube-dns

# 4. Verificar logs do CoreDNS
kubectl logs -n kube-system -l k8s-app=kube-dns --tail=50 | grep -i error

# 5. Verificar dnsPolicy do Pod
kubectl get pod <pod> -n <namespace> -o jsonpath='{.spec.dnsPolicy}'
# Se "None" sem dnsConfig correto: problema de configuracao

# 6. Testar com Pod de debug
kubectl run dns-debug --rm -it \
  --image=busybox:1.35 \
  --restart=Never \
  -n <namespace> \
  -- nslookup <nome-do-servico>
\`\`\`

**Causas comuns:**
- dnsPolicy: None sem dnsConfig configurado corretamente
- CoreDNS Pods nao estao Running (CrashLoopBackOff, OOMKilled)
- NetworkPolicy bloqueando trafego UDP/TCP porta 53 para o kube-dns
- ConfigMap do CoreDNS com erro de sintaxe apos edicao manual`,
      solution: `**Por causa — resolucoes:**

\`\`\`bash
# Causa 1: CoreDNS com problemas
kubectl get pods -n kube-system -l k8s-app=kube-dns
kubectl describe pod -n kube-system -l k8s-app=kube-dns
kubectl logs -n kube-system -l k8s-app=kube-dns

# Reiniciar CoreDNS
kubectl rollout restart deployment/coredns -n kube-system

# Causa 2: Erro de sintaxe no Corefile
kubectl get configmap coredns -n kube-system -o yaml
# Verificar formatacao do Corefile
# Restaurar para o padrao se necessario

# Causa 3: NetworkPolicy bloqueando DNS
# Verificar se ha policies no namespace que bloqueiam egress para porta 53
kubectl get networkpolicy -n <namespace>
# Adicionar regra para permitir DNS
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns-egress
  namespace: <namespace>
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

# Causa 4: dnsPolicy errado
kubectl patch pod <pod> -n <namespace> --type merge \
  -p '{"spec":{"dnsPolicy":"ClusterFirst"}}'
# Nota: pode ser necessario recriar o Pod se nao aceitar patch em dnsPolicy
\`\`\``
    }
  ]
};
