window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['troubleshooting/network-troubleshooting'] = {
  theory: `# Troubleshooting de Rede e Services

## Visao Geral

Problemas de rede sao frequentes no CKA e no dia a dia com Kubernetes. Entender o caminho do trafego de um Service ate um Pod e essencial para diagnosticar falhas de conectividade.

## Caminho do Trafego em um Service

Quando um cliente acessa um Service, o fluxo e:

\`\`\`
Cliente -> Service (ClusterIP) -> kube-proxy (iptables/ipvs) -> Endpoint -> Pod
\`\`\`

Cada etapa pode falhar independentemente. O troubleshooting deve seguir esse fluxo de forma sistematica.

## Verificando Services e Endpoints

O problema mais comum e o Service nao roteando trafego para os pods. Isso geralmente e causado por um seletor (selector) incorreto.

\`\`\`bash
# Ver o service e seu seletor
kubectl get service meu-service -o yaml
kubectl describe service meu-service

# Ver os endpoints - se vazio, o seletor nao match nenhum pod
kubectl get endpoints meu-service

# Comparar o seletor do service com os labels dos pods
kubectl get pods --show-labels
kubectl get pods -l app=meu-app  # usar o seletor do service

# Verificar se os pods estao prontos (Ready)
kubectl get pods -l app=meu-app
\`\`\`

### Exemplo de Service com seletor correto

\`\`\`yaml
apiVersion: v1
kind: Service
metadata:
  name: meu-service
spec:
  selector:
    app: meu-app       # deve corresponder aos labels dos pods
    tier: backend
  ports:
    - protocol: TCP
      port: 80         # porta do service
      targetPort: 8080 # porta do container
  type: ClusterIP
\`\`\`

### Verificando o Pod correspondente

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: meu-pod
  labels:
    app: meu-app       # deve corresponder ao seletor do service
    tier: backend
spec:
  containers:
    - name: app
      image: nginx
      ports:
        - containerPort: 8080
\`\`\`

## Diagnostico de DNS

Falhas de resolucao DNS sao uma causa comum de problemas de conectividade entre pods.

\`\`\`bash
# Testar DNS dentro do cluster usando um pod temporario
kubectl run dns-test --image=busybox:1.28 --rm -it --restart=Never -- nslookup kubernetes

# Resolver um service pelo nome
kubectl run dns-test --image=busybox:1.28 --rm -it --restart=Never -- \\
  nslookup meu-service.default.svc.cluster.local

# Formato completo do DNS interno:
# <service>.<namespace>.svc.<cluster-domain>
# Ex: meu-service.producao.svc.cluster.local

# Verificar se o CoreDNS esta rodando
kubectl get pods -n kube-system -l k8s-app=kube-dns

# Ver logs do CoreDNS
kubectl logs -n kube-system -l k8s-app=kube-dns

# Verificar o configmap do CoreDNS
kubectl get configmap coredns -n kube-system -o yaml
\`\`\`

## kube-proxy e Regras de iptables

O kube-proxy gerencia as regras de iptables (ou ipvs) que implementam os Services.

\`\`\`bash
# Verificar se o kube-proxy esta rodando
kubectl get pods -n kube-system -l k8s-app=kube-proxy
kubectl logs -n kube-system -l k8s-app=kube-proxy

# Ver o modo do kube-proxy (iptables ou ipvs)
kubectl logs -n kube-system -l k8s-app=kube-proxy | grep "Using"

# Verificar regras de iptables geradas pelo kube-proxy (no node)
iptables -t nat -L KUBE-SERVICES | head -30
iptables -t nat -L KUBE-SVC-<hash> -n

# Para clusters com ipvs
ipvsadm -Ln | grep <cluster-ip-do-service>
\`\`\`

## CNI Plugin e Conectividade Pod-a-Pod

O CNI (Container Network Interface) e responsavel pela rede entre pods.

\`\`\`bash
# Verificar pods do CNI (ex: weave, calico, flannel)
kubectl get pods -n kube-system | grep -E "calico|weave|flannel|cilium"

# Verificar logs do CNI
kubectl logs -n kube-system -l app=calico-node

# Verificar se o CNI esta instalado no node
ls /etc/cni/net.d/
ls /opt/cni/bin/

# Testar conectividade pod-a-pod
kubectl run pod-a --image=busybox:1.28 --rm -it --restart=Never -- \\
  ping <ip-do-pod-b>
\`\`\`

## Debugging com Pods Temporarios

Pods temporarios sao essenciais para diagnosticar problemas de rede de dentro do cluster.

\`\`\`bash
# Pod basico com busybox para testes de DNS e conectividade
kubectl run nettest --image=busybox:1.28 --rm -it --restart=Never -- sh

# Pod com netshoot (ferramenta completa de rede)
kubectl run nettest --image=nicolaka/netshoot --rm -it --restart=Never -- bash

# Dentro do pod de teste, executar:
# - nslookup <service-name>
# - curl http://<service-name>:<port>
# - ping <pod-ip>
# - wget -qO- http://<service-ip>:<port>
# - nc -zv <host> <port>

# Executar comando em pod existente
kubectl exec -it <pod-name> -- /bin/sh
kubectl exec -it <pod-name> -- curl http://outro-service

# Pod de debug no mesmo namespace do problema
kubectl run debug --image=nicolaka/netshoot -n meu-namespace --rm -it --restart=Never -- bash
\`\`\`

## Network Policies

Network Policies podem bloquear trafego inesperadamente se mal configuradas.

\`\`\`bash
# Listar todas as network policies
kubectl get networkpolicies --all-namespaces

# Ver detalhes de uma policy
kubectl describe networkpolicy minha-policy -n producao

# Verificar se uma policy afeta um pod especifico
kubectl get networkpolicy -n <namespace> -o yaml | grep -A 5 podSelector
\`\`\`

### Exemplo de Network Policy permissiva (para debug)

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-all-debug
  namespace: meu-namespace
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - {}
  egress:
    - {}
\`\`\`

### Exemplo de Network Policy restritiva correta

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-policy
  namespace: producao
spec:
  podSelector:
    matchLabels:
      tier: backend
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              tier: frontend
      ports:
        - protocol: TCP
          port: 8080
\`\`\`

## Conectividade Pod-para-Service

\`\`\`bash
# Testar acesso ao service de dentro do cluster
kubectl run curl-test --image=curlimages/curl --rm -it --restart=Never -- \\
  curl http://meu-service.default.svc.cluster.local

# Testar com IP do service (bypassa DNS)
kubectl get service meu-service  # obter o ClusterIP
kubectl run curl-test --image=curlimages/curl --rm -it --restart=Never -- \\
  curl http://<cluster-ip>:<port>

# Verificar endpoint diretamente no pod
kubectl run curl-test --image=curlimages/curl --rm -it --restart=Never -- \\
  curl http://<pod-ip>:<container-port>
\`\`\`

## Fluxo de Diagnostico de Rede

1. Verificar se os pods estao Running e Ready
2. Verificar endpoints do service (\`kubectl get endpoints\`)
3. Comparar seletor do service com labels dos pods
4. Testar acesso direto pelo IP do pod (bypassa service)
5. Testar acesso pelo ClusterIP do service (bypassa DNS)
6. Testar acesso pelo nome do service (testa DNS)
7. Verificar Network Policies
8. Verificar logs do kube-proxy e CoreDNS
`,

  quiz: [
    {
      question: 'Um Service nao esta roteando trafego para os pods. Os pods estao Running. Qual e o primeiro passo de diagnostico?',
      options: [
        'Reiniciar o kube-proxy',
        'Verificar os endpoints do service com kubectl get endpoints',
        'Verificar as regras de iptables no node',
        'Reiniciar os pods'
      ],
      correct: 1,
      explanation: 'Verificar os endpoints e o primeiro passo. Se os endpoints estao vazios, o seletor do Service nao esta correspondendo aos labels dos pods. Isso e a causa mais comum de Service sem roteamento.'
    },
    {
      question: 'Qual e o formato correto do nome DNS de um Service dentro do cluster Kubernetes?',
      options: [
        '<service>.<namespace>.cluster.local',
        '<service>.<namespace>.svc.cluster.local',
        '<namespace>.<service>.svc.local',
        '<service>.svc.<namespace>.cluster.local'
      ],
      correct: 1,
      explanation: 'O formato DNS interno do Kubernetes para Services e: <service-name>.<namespace>.svc.<cluster-domain>. O cluster-domain padrao e cluster.local. Exemplo: meu-app.producao.svc.cluster.local'
    },
    {
      question: 'Qual imagem e mais adequada para diagnosticar problemas de DNS dentro de um cluster Kubernetes?',
      options: [
        'nginx:latest',
        'ubuntu:latest',
        'busybox:1.28',
        'alpine:latest'
      ],
      correct: 2,
      explanation: 'busybox:1.28 e amplamente usado para debugging de rede pois inclui nslookup, wget, nc e outras ferramentas essenciais. A versao 1.28 e recomendada pois versoes mais novas tem comportamento diferente com nslookup. nicolaka/netshoot e outra excelente opcao para troubleshooting avancado.'
    },
    {
      question: 'Um pod nao consegue resolver nomes DNS de outros services. Qual componente deve ser verificado primeiro?',
      options: [
        'kube-proxy',
        'CNI plugin',
        'CoreDNS',
        'API Server'
      ],
      correct: 2,
      explanation: 'CoreDNS e responsavel pela resolucao de nomes DNS dentro do cluster. Se pods nao conseguem resolver nomes de services, o CoreDNS pode estar com problemas. Verifique: kubectl get pods -n kube-system -l k8s-app=kube-dns e seus logs.'
    },
    {
      question: 'Uma Network Policy foi aplicada e agora pods nao conseguem se comunicar. Como confirmar que a policy e a causa?',
      options: [
        'Deletar todos os pods e recriar',
        'Aplicar uma NetworkPolicy permissiva temporaria (allow-all) e testar novamente',
        'Reiniciar o kube-proxy',
        'Verificar os endpoints do service'
      ],
      correct: 1,
      explanation: 'Aplicar uma NetworkPolicy permissiva (que permite todo trafego ingress e egress) isola o problema. Se a comunicacao funcionar com a policy permissiva, a policy anterior era a causa. Isso e uma tecnica de debug por eliminacao.'
    },
    {
      question: 'Qual comando testa conectividade de rede para um Service de dentro do cluster sem usar um pod pre-existente?',
      options: [
        'kubectl exec -- curl http://meu-service',
        'kubectl run test --image=curlimages/curl --rm -it --restart=Never -- curl http://meu-service',
        'kubectl test network --service=meu-service',
        'kubectl port-forward svc/meu-service 8080:80'
      ],
      correct: 1,
      explanation: 'kubectl run com --rm -it --restart=Never cria um pod temporario interativo que e removido apos a execucao. E a forma padrao de executar testes de rede ad-hoc dentro do cluster.'
    },
    {
      question: 'O que significa quando kubectl get endpoints meu-service retorna uma lista vazia de enderecos?',
      options: [
        'O service esta funcionando mas nao tem carga',
        'O seletor do service nao esta correspondendo a nenhum pod Running e Ready',
        'O kube-proxy nao esta funcionando',
        'O service nao foi criado corretamente'
      ],
      correct: 1,
      explanation: 'Endpoints vazios significam que nenhum pod satisfaz o seletor do Service E esta no estado Ready. As causas podem ser: seletor errado (typo nos labels), pods nao existentes, pods em estado nao-Ready, ou pods em namespace diferente.'
    },
    {
      question: 'Como verificar se o kube-proxy esta processando as regras de iptables corretamente em um node?',
      options: [
        'kubectl get kube-proxy -n kube-system',
        'kubectl logs -n kube-system <pod-kube-proxy>',
        'iptables -L -n -v | grep <ClusterIP-do-service>',
        'kubectl describe proxy -n kube-system'
      ],
      correct: 2,
      explanation: 'iptables -L -n -v mostra as regras de iptables criadas pelo kube-proxy para roteamento de Services. Se o ClusterIP do Service nao aparece nas regras, o kube-proxy pode estar com problema. Verificar logs do pod do kube-proxy tambem e util: kubectl logs -n kube-system ds/kube-proxy'
    },
    {
      question: 'Um pod tenta acessar um banco de dados fora do cluster usando um ExternalName Service e falha com NXDOMAIN. Qual e a causa mais provavel?',
      options: [
        'O pod nao tem permissao RBAC para acessar services externos',
        'O ExternalName esta com o hostname incorreto ou o CoreDNS nao consegue resolver o hostname externo',
        'ExternalName Services nao suportam conexoes de pods',
        'O namespace do pod e diferente do namespace do service'
      ],
      correct: 1,
      explanation: 'ExternalName Services funcionam criando um registro CNAME DNS para o hostname especificado. NXDOMAIN significa que o CoreDNS nao conseguiu resolver o nome externo. Verifique: (1) o hostname do ExternalName esta correto; (2) o CoreDNS tem acesso ao DNS externo (verifique o Corefile, secao forward); (3) o hostname existe e e resolvivel externamente.'
    },
    {
      question: 'Voce aplicou uma NetworkPolicy de default-deny-all em um namespace. Quais conexoes sao bloqueadas imediatamente?',
      options: [
        'Apenas conexoes de fora do cluster para os pods',
        'Apenas conexoes entre pods do mesmo namespace',
        'Todo trafego ingress E egress para todos os pods do namespace',
        'Apenas conexoes de pods sem label definida'
      ],
      correct: 2,
      explanation: 'Uma NetworkPolicy com podSelector: {} e policyTypes: [Ingress, Egress] sem regras aplica-se a TODOS os pods do namespace e bloqueia TODO o trafego (entrada e saida). Isso inclui conexoes entre pods do mesmo namespace, acesso ao DNS, e acesso a services. Voce precisara adicionar regras especificas para permitir o trafego necessario.'
    },
    {
      question: 'Como diagnosticar se um pod esta com problema de resolucao de DNS para services do proprio cluster?',
      options: [
        'kubectl exec <pod> -- ping meu-service',
        'kubectl exec <pod> -- nslookup meu-service.meu-namespace.svc.cluster.local',
        'kubectl get pod <pod> -o yaml | grep dns',
        'kubectl describe pod <pod> | grep DNS'
      ],
      correct: 1,
      explanation: 'nslookup com o FQDN completo (<service>.<namespace>.svc.cluster.local) verifica se o pod consegue resolver o nome DNS do service via CoreDNS. Se falhar, verifique: CoreDNS rodando, dnsPolicy do pod (ClusterFirst), e se NetworkPolicy permite trafego UDP/53 para kube-system.'
    },
    {
      question: 'Um Service do tipo NodePort esta configurado mas nao e acessivel externamente. O pod esta Running e os endpoints estao populados. Qual e o proximo passo?',
      options: [
        'Verificar se o port range do NodePort esta correto (30000-32767) e se firewall/security-group permite a porta',
        'Mudar o Service para LoadBalancer',
        'Verificar se o pod tem a annotation externalTrafficPolicy',
        'Adicionar um Ingress controller'
      ],
      correct: 0,
      explanation: 'Com endpoints populados e pod Running, o problema provavelmente e de firewall/security-group no nivel da infraestrutura bloqueando a NodePort (30000-32767). Verifique: (1) a NodePort esta no range valido; (2) o firewall do OS (iptables, ufw, firewalld) permite a porta; (3) o security group/NSG da cloud permite a porta nos nos workers.'
    },
    {
      question: 'Qual e o comando para testar conectividade TCP para um pod especifico usando um pod temporario de debug?',
      options: [
        'kubectl network test --target-pod=meu-pod --port=8080',
        'kubectl run debug --image=busybox --rm -it --restart=Never -- nc -zv <pod-IP> 8080',
        'kubectl exec debug -- telnet <pod-IP> 8080',
        'kubectl port-forward pod/meu-pod 8080:8080 && curl localhost:8080'
      ],
      correct: 1,
      explanation: 'nc (netcat) com -zv e usado para testar conectividade TCP sem enviar dados: -z faz scan sem conexao completa, -v habilita output detalhado. O pod temporario com --rm garante que sera removido. Para troubleshooting mais avancado use: nicolaka/netshoot, que tem nmap, tcpdump, curl, etc.'
    }
  ],

  flashcards: [
    {
      front: 'Como verificar se um Service esta roteando trafego corretamente?',
      back: '1. kubectl get endpoints <service> - verificar se ha IPs listados\n2. kubectl describe service <service> - ver seletor\n3. kubectl get pods --show-labels - comparar labels com seletor\n4. Se endpoints vazios: seletor nao match nenhum pod Ready'
    },
    {
      front: 'Qual e o formato do nome DNS de um Service no Kubernetes?',
      back: '<service-name>.<namespace>.svc.cluster.local\n\nExemplos:\n- meu-app.default.svc.cluster.local\n- banco-de-dados.producao.svc.cluster.local\n\nDentro do mesmo namespace, pode usar apenas: <service-name>'
    },
    {
      front: 'Como criar um pod temporario para diagnostico de rede?',
      back: '# Com busybox (DNS e conectividade basica)\nkubectl run test --image=busybox:1.28 --rm -it --restart=Never -- sh\n\n# Com netshoot (ferramentas completas)\nkubectl run test --image=nicolaka/netshoot --rm -it --restart=Never -- bash\n\n# Executar comando direto\nkubectl run test --image=busybox:1.28 --rm -it --restart=Never -- nslookup kubernetes'
    },
    {
      front: 'Quais sao as causas mais comuns de endpoints vazios em um Service?',
      back: '1. Seletor do Service nao corresponde aos labels dos pods (erro de digitacao)\n2. Pods nao existem no namespace correto\n3. Pods existem mas nao estao no estado Ready\n4. Pods nao tem o label necessario\n5. Service e pods em namespaces diferentes sem configuracao adequada'
    },
    {
      front: 'Como diagnosticar problemas de DNS dentro do cluster?',
      back: '# Testar resolucao DNS\nkubectl run dns-test --image=busybox:1.28 --rm -it --restart=Never -- nslookup kubernetes\n\n# Verificar CoreDNS\nkubectl get pods -n kube-system -l k8s-app=kube-dns\nkubectl logs -n kube-system -l k8s-app=kube-dns\n\n# Ver configuracao do CoreDNS\nkubectl get configmap coredns -n kube-system -o yaml'
    },
    {
      front: 'O que e uma Network Policy e como ela pode bloquear trafego inesperadamente?',
      back: 'NetworkPolicy define regras de ingress/egress para pods. Por padrao, sem nenhuma policy, todo trafego e permitido.\n\nQuando uma policy e aplicada a um pod:\n- Apenas o trafego explicitamente permitido passa\n- Todo o resto e negado\n\nDebug: aplicar policy permissiva temporaria e testar:\npodSelector: {}\ningress: [{}]\negress: [{}]'
    },
    {
      front: 'Como verificar regras de iptables geradas pelo kube-proxy?',
      back: '# Ver chains do kube-proxy\niptables -t nat -L KUBE-SERVICES -n\niptables -t nat -L KUBE-NODEPORTS -n\n\n# Ver regras de um service especifico\niptables -t nat -L -n | grep <cluster-ip>\n\n# Para modo IPVS\nipvsadm -Ln\nipvsadm -Ln | grep <cluster-ip>'
    }
  ],

  lab: {
    scenario: 'Uma aplicacao web com frontend e backend esta com problemas de conectividade. O frontend nao consegue se comunicar com o backend via Service. Sua tarefa e diagnosticar e corrigir o problema usando as ferramentas de troubleshooting de rede.',
    objective: 'Diagnosticar e corrigir problemas de Service routing, DNS e Network Policy em um cluster Kubernetes, usando pods temporarios de debug.',
    steps: [
      {
        title: 'Criar o ambiente de laboratorio com problema proposital',
        instruction: 'Crie um deployment backend com um Service que tem um seletor incorreto (simulando um erro comum de configuracao). Em seguida, crie um pod frontend para testar a conectividade.',
        hints: [
          'O seletor do service deve ter um typo intencional para simular o problema',
          'Use kubectl get endpoints para confirmar que os endpoints estao vazios',
          'O deployment backend deve ter labels diferentes do seletor do service'
        ],
        solution: '```bash\n# Criar o deployment backend\nkubectl create deployment backend --image=nginx --replicas=2\nkubectl label deployment backend app=backend-app tier=backend\n\n# Criar o service com seletor INCORRETO (bug intencional - typo em "backnd")\nkubectl apply -f - <<EOF\napiVersion: v1\nkind: Service\nmetadata:\n  name: backend-service\nspec:\n  selector:\n    app: backnd-app\n  ports:\n    - protocol: TCP\n      port: 80\n      targetPort: 80\nEOF\n\n# Verificar que os endpoints estao vazios (confirmando o problema)\nkubectl get endpoints backend-service\n# EXPECTED: backend-service   <none>\n\n# Criar pod frontend para testar conectividade\nkubectl run frontend --image=curlimages/curl --command -- sleep 3600\nkubectl wait --for=condition=Ready pod/frontend\n```'
      },
      {
        title: 'Diagnosticar o problema de conectividade',
        instruction: 'Usando os comandos de troubleshooting, identifique por que o frontend nao consegue acessar o backend-service. Siga o fluxo: pod -> endpoints -> seletor -> labels.',
        hints: [
          'Comece testando a conectividade de dentro do pod frontend',
          'Use kubectl get endpoints para verificar os IPs registrados',
          'Compare o seletor do service com os labels dos pods do backend',
          'Use kubectl get pods --show-labels para ver todos os labels'
        ],
        solution: '```bash\n# 1. Testar conectividade de dentro do frontend\nkubectl exec frontend -- curl -m 3 http://backend-service || echo "FALHA: nao consegue conectar"\n\n# 2. Verificar os endpoints do service\nkubectl get endpoints backend-service\n# Resultado: <none> - problema confirmado!\n\n# 3. Ver o seletor do service\nkubectl describe service backend-service | grep Selector\n# Selector: app=backnd-app (TYPO!)\n\n# 4. Ver os labels dos pods do backend\nkubectl get pods -l app=backend-app --show-labels\n# Pods tem label: app=backend-app\n\n# 5. Confirmar o mismatch\necho "Seletor do Service: app=backnd-app"\necho "Label dos Pods: app=backend-app"\necho "PROBLEMA: backnd vs backend - typo no seletor!"\n\n# 6. Verificar via DNS tambem\nkubectl run dns-test --image=busybox:1.28 --rm -it --restart=Never -- nslookup backend-service\n# DNS resolve (service existe) mas nao ha endpoints\n```'
      },
      {
        title: 'Corrigir o seletor do Service e validar',
        instruction: 'Corrija o seletor do Service para que corresponda aos labels corretos dos pods do backend. Valide a correcao verificando os endpoints e testando a conectividade do frontend.',
        hints: [
          'Edite o service com kubectl edit service backend-service',
          'Ou use kubectl patch para uma correcao rapida',
          'Apos a correcao, os endpoints devem aparecer automaticamente',
          'Teste a conectividade final do frontend para o backend'
        ],
        solution: '```bash\n# Corrigir o seletor do service\nkubectl patch service backend-service -p \'{"spec":{"selector":{"app":"backend-app"}}}\'\n\n# Verificar imediatamente que os endpoints foram populados\nkubectl get endpoints backend-service\n# Deve mostrar os IPs dos pods do backend\n\n# Testar conectividade do frontend\nkubectl exec frontend -- curl -m 5 http://backend-service\n# Deve retornar o HTML do nginx\n\n# Testar tambem via DNS completo\nkubectl exec frontend -- curl -m 5 http://backend-service.default.svc.cluster.local\n\n# Confirmar que ambos os pods do backend estao servindo trafego\nfor i in 1 2 3 4; do\n  kubectl exec frontend -- curl -s http://backend-service | grep -o "Welcome to nginx"\ndone\n\n# Limpar o ambiente de lab\nkubectl delete deployment backend\nkubectl delete service backend-service\nkubectl delete pod frontend\n```'
      },
      {
        title: 'Diagnosticar Network Policy bloqueando trafego',
        instruction: 'Crie um ambiente com uma Network Policy restritiva e diagnostique o bloqueio de trafego. Aprenda a identificar quando uma policy esta causando problemas e como corrigi-la.',
        hints: [
          'Crie pods com labels diferentes para simular frontend e backend',
          'Aplique uma NetworkPolicy que so permite trafego de pods com label especifico',
          'Use o pod temporario netshoot para testar a conectividade',
          'Lembre que sem tolerations na policy, o trafego e bloqueado'
        ],
        solution: '```bash\n# Criar pods de teste\nkubectl run server --image=nginx --labels="app=server"\nkubectl run client-allowed --image=curlimages/curl --labels="role=frontend" --command -- sleep 3600\nkubectl run client-blocked --image=curlimages/curl --labels="role=other" --command -- sleep 3600\nkubectl wait --for=condition=Ready pod/server pod/client-allowed pod/client-blocked\n\n# Criar Service para o server\nkubectl expose pod server --port=80\n\n# Aplicar NetworkPolicy restritiva\nkubectl apply -f - <<EOF\napiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: server-policy\nspec:\n  podSelector:\n    matchLabels:\n      app: server\n  policyTypes:\n    - Ingress\n  ingress:\n    - from:\n        - podSelector:\n            matchLabels:\n              role: frontend\n      ports:\n        - protocol: TCP\n          port: 80\nEOF\n\n# Testar: client-allowed deve conseguir conectar\nkubectl exec client-allowed -- curl -m 3 http://server && echo "SUCESSO: client-allowed conectou"\n\n# Testar: client-blocked NAO deve conseguir conectar\nkubectl exec client-blocked -- curl -m 3 http://server && echo "ERRO: deveria estar bloqueado" || echo "CORRETO: client-blocked foi bloqueado pela NetworkPolicy"\n\n# Para diagnosticar qual policy esta bloqueando:\nkubectl get networkpolicies\nkubectl describe networkpolicy server-policy\n\n# Limpar\nkubectl delete pod server client-allowed client-blocked\nkubectl delete service server\nkubectl delete networkpolicy server-policy\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Service nao roteia trafego - endpoints vazios',
      symptom: 'Pods nao conseguem acessar um Service pelo nome ou IP. kubectl get endpoints <service> mostra "none" ou lista vazia. O Service existe mas nao tem pods associados.',
      diagnosis: `**Passos de diagnostico:**

\`\`\`bash
# 1. Verificar o estado dos endpoints
kubectl get endpoints meu-service
# Se retornar <none>, o problema e no seletor

# 2. Ver o seletor configurado no service
kubectl describe service meu-service | grep Selector

# 3. Ver os pods existentes e seus labels
kubectl get pods --show-labels
kubectl get pods -l <seletor-do-service>
# Se retornar vazio, confirma mismatch

# 4. Verificar se os pods estao prontos
kubectl get pods -l app=meu-app
# Pods devem estar Running e Ready (1/1 ou N/N)

# 5. Verificar se os pods estao no namespace correto
kubectl get pods -n <namespace> -l app=meu-app
kubectl get endpoints -n <namespace> meu-service

# 6. Verificar a porta do service vs containerPort do pod
kubectl describe service meu-service | grep TargetPort
kubectl describe pod <pod-name> | grep containerPort
\`\`\``,
      solution: `**Resolucao por causa raiz:**

**Causa: Seletor incorreto (typo ou label errado)**
\`\`\`bash
# Corrigir o seletor via patch
kubectl patch service meu-service \\
  -p '{"spec":{"selector":{"app":"nome-correto"}}}'

# Ou via edit
kubectl edit service meu-service
# Corrigir o campo spec.selector

# Verificar imediatamente
kubectl get endpoints meu-service
\`\`\`

**Causa: Pods nao estao Ready**
\`\`\`bash
# Ver por que os pods nao estao Ready
kubectl describe pod <pod-name>
# Verificar readiness probe falhandoubectl get events | grep <pod-name>

# Se o readiness probe esta muito restrito, ajustar:
kubectl edit deployment meu-app
# Ajustar readinessProbe.initialDelaySeconds ou remover temporariamente
\`\`\`

**Causa: TargetPort incorreto**
\`\`\`bash
# O service aponta para a porta errada do container
kubectl patch service meu-service \\
  -p '{"spec":{"ports":[{"port":80,"targetPort":8080}]}}'
\`\`\`

**Validar:**
\`\`\`bash
kubectl get endpoints meu-service  # deve mostrar IPs
kubectl run test --image=curlimages/curl --rm -it --restart=Never -- \\
  curl http://meu-service.<namespace>.svc.cluster.local
\`\`\``
    },
    {
      title: 'Falha de resolucao DNS entre pods',
      symptom: 'Pods nao conseguem resolver nomes de outros services. Erro: "nslookup: server can not find meu-service: NXDOMAIN" ou "dial tcp: lookup meu-service: no such host". Conectividade por IP funciona mas por nome nao.',
      diagnosis: `**Passos de diagnostico:**

\`\`\`bash
# 1. Testar DNS de dentro de um pod
kubectl run dns-test --image=busybox:1.28 --rm -it --restart=Never -- sh
# Dentro do pod:
nslookup kubernetes
nslookup meu-service
nslookup meu-service.default.svc.cluster.local
cat /etc/resolv.conf

# 2. Verificar se o CoreDNS esta rodando
kubectl get pods -n kube-system -l k8s-app=kube-dns

# 3. Ver logs do CoreDNS
kubectl logs -n kube-system -l k8s-app=kube-dns --tail=50

# 4. Verificar configmap do CoreDNS
kubectl get configmap coredns -n kube-system -o yaml

# 5. Testar conectividade com o pod do CoreDNS
kubectl get pods -n kube-system -l k8s-app=kube-dns -o wide
# Verificar se e acessivel na porta 53

# 6. Verificar se o service do kube-dns existe
kubectl get service kube-dns -n kube-system
\`\`\``,
      solution: `**Resolucao por causa raiz:**

**Causa: CoreDNS com pods em estado nao-Running**
\`\`\`bash
# Reiniciar os pods do CoreDNS
kubectl rollout restart deployment coredns -n kube-system

# Aguardar pods voltarem
kubectl rollout status deployment coredns -n kube-system
\`\`\`

**Causa: Namespace errado na consulta DNS**
\`\`\`bash
# Usar o nome FQDN sempre que houver duvida
nslookup meu-service.outro-namespace.svc.cluster.local

# Verificar o namespace correto do service
kubectl get service meu-service --all-namespaces
\`\`\`

**Causa: ConfigMap do CoreDNS corrompido**
\`\`\`bash
# Ver a configuracao atual
kubectl get configmap coredns -n kube-system -o yaml

# Restaurar a configuracao padrao (se necessario)
# Editar o configmap e corrigir a sintaxe do Corefile
kubectl edit configmap coredns -n kube-system
\`\`\`

**Causa: Network Policy bloqueando porta 53 do CoreDNS**
\`\`\`bash
# Verificar policies que afetam o namespace
kubectl get networkpolicies -n kube-system

# Adicionar egress rule para DNS (porta 53 UDP/TCP)
# em qualquer NetworkPolicy que afete os pods com problema
\`\`\``
    },
    {
      title: 'Network Policy bloqueando trafego esperado',
      symptom: 'Servicos que funcionavam param de funcionar apos a criacao de uma NetworkPolicy. Pods nao conseguem se comunicar mesmo estando no mesmo namespace. curl e ping falham entre pods.',
      diagnosis: `**Passos de diagnostico:**

\`\`\`bash
# 1. Listar todas as network policies que podem afetar os pods
kubectl get networkpolicies --all-namespaces
kubectl get networkpolicies -n <namespace>

# 2. Ver detalhes de cada policy
kubectl describe networkpolicy <nome-da-policy> -n <namespace>

# 3. Identificar quais pods sao afetados pela policy
kubectl describe networkpolicy <nome> | grep -A 5 "Pod Selector"

# 4. Testar isolar a policy aplicando uma policy permissiva
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: debug-allow-all
  namespace: <namespace>
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - {}
  egress:
    - {}
EOF
# Se o trafego funcionar agora, a policy anterior era o problema

# 5. Verificar se pods tem os labels corretos referenciados na policy
kubectl get pods -n <namespace> --show-labels
kubectl describe networkpolicy <nome> | grep -A 10 "Allowing ingress"
\`\`\``,
      solution: `**Resolucao:**

**Corrigir a NetworkPolicy para permitir o trafego necessario:**
\`\`\`bash
# Exemplo: policy que bloqueia mas deveria permitir frontend -> backend
# Policy incorreta (falta a porta ou o podSelector errado):
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-allow-frontend
  namespace: producao
spec:
  podSelector:
    matchLabels:
      tier: backend
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              tier: frontend
      ports:
        - protocol: TCP
          port: 8080
EOF

# Apos corrigir, remover a policy permissiva de debug
kubectl delete networkpolicy debug-allow-all -n <namespace>
\`\`\`

**Adicionar egress para DNS (frequentemente esquecido):**
\`\`\`bash
kubectl apply -f - <<EOF
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
        - protocol: UDP
          port: 53
        - protocol: TCP
          port: 53
EOF
\`\`\``
    }
  ]
};
