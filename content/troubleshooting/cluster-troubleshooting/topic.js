window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['troubleshooting/cluster-troubleshooting'] = {
  theory: `# Troubleshooting de Cluster e Nodes

## Visao Geral

O troubleshooting de cluster e nodes representa 30% do exame CKA. A habilidade de diagnosticar rapidamente falhas em componentes do control plane, nodes e kubelet e fundamental para a prova e para o dia a dia em producao.

## Node NotReady

Quando um node entra em estado NotReady, o primeiro passo e verificar as condicoes do node:

\`\`\`bash
kubectl get nodes
kubectl describe node <nome-do-node>
\`\`\`

A secao Conditions no output do describe mostra o estado de cada condicao:

| Condicao | Significado |
|---|---|
| Ready | Node saudavel e aceitando pods |
| MemoryPressure | Node com pouca memoria disponivel |
| DiskPressure | Node com pouco espaco em disco |
| PIDPressure | Node com muitos processos |
| NetworkUnavailable | CNI nao configurado corretamente |

### Diagnostico de Node NotReady

\`\`\`bash
# Ver estado de todos os nodes
kubectl get nodes -o wide

# Ver detalhes e eventos do node
kubectl describe node worker-1

# Verificar status do kubelet no node afetado (via SSH)
systemctl status kubelet

# Ver logs do kubelet
journalctl -u kubelet -f
journalctl -u kubelet --since "10 minutes ago"

# Reiniciar o kubelet se necessario
systemctl restart kubelet
systemctl enable kubelet
\`\`\`

## Kubelet Troubleshooting

O kubelet e o agente principal que roda em cada node. Se ele falhar, os pods nao sao agendados nem executados no node.

### Verificando o Kubelet

\`\`\`bash
# Status do servico
systemctl status kubelet

# Logs completos
journalctl -u kubelet -n 100 --no-pager

# Erros mais recentes
journalctl -u kubelet -p err --since "1 hour ago"
\`\`\`

### Configuracao do Kubelet

O kubelet e configurado via arquivo e flags. Os caminhos mais comuns:

\`\`\`bash
# Arquivo de configuracao principal
cat /var/lib/kubelet/config.yaml

# Flags de inicializacao (systemd)
cat /etc/systemd/system/kubelet.service.d/10-kubeadm.conf

# Certificados do kubelet
ls -la /var/lib/kubelet/pki/

# kubeconfig do kubelet
cat /etc/kubernetes/kubelet.conf
\`\`\`

### Erros Comuns do Kubelet

\`\`\`bash
# Erro de certificado
# "x509: certificate has expired or is not yet valid"
openssl x509 -in /var/lib/kubelet/pki/kubelet.crt -noout -dates

# Erro de conexao com API server
# "Failed to create pod sandbox: rpc error"
systemctl status containerd
systemctl restart containerd

# Erro de swap habilitada
# "failed to run Kubelet: running with swap on is not supported"
swapoff -a
# Remover swap do /etc/fstab para persistir apos reboot
\`\`\`

## Control Plane Components

Os componentes do control plane rodam como static pods no node master. Seus manifestos ficam em:

\`\`\`bash
ls /etc/kubernetes/manifests/
# etcd.yaml
# kube-apiserver.yaml
# kube-controller-manager.yaml
# kube-scheduler.yaml
\`\`\`

### Verificando Componentes do Control Plane

\`\`\`bash
# Ver pods do control plane
kubectl get pods -n kube-system

# Logs do API server
kubectl logs kube-apiserver-master -n kube-system

# Logs do scheduler
kubectl logs kube-scheduler-master -n kube-system

# Logs do controller manager
kubectl logs kube-controller-manager-master -n kube-system

# Logs do etcd
kubectl logs etcd-master -n kube-system
\`\`\`

### Static Pods e o Kubelet

Static pods sao gerenciados diretamente pelo kubelet, sem o API server. Para reiniciar um componente do control plane:

\`\`\`bash
# Mover o manifesto para fora da pasta (para o pod ser removido)
mv /etc/kubernetes/manifests/kube-scheduler.yaml /tmp/

# Aguardar alguns segundos e restaurar
mv /tmp/kube-scheduler.yaml /etc/kubernetes/manifests/

# O kubelet detecta a mudanca automaticamente e recria o pod
\`\`\`

### API Server Nao Responde

\`\`\`bash
# Verificar se o processo esta rodando
ps aux | grep kube-apiserver

# Verificar o manifesto do static pod
cat /etc/kubernetes/manifests/kube-apiserver.yaml

# Verificar logs diretamente via crictl (quando kubectl nao funciona)
crictl pods | grep apiserver
crictl logs <container-id>

# Verificar porta de escuta
ss -tlnp | grep 6443
curl -k https://localhost:6443/healthz
\`\`\`

## etcd Troubleshooting

O etcd e o banco de dados do cluster. Problemas no etcd sao criticos.

\`\`\`bash
# Status do etcd
kubectl describe pod etcd-master -n kube-system

# Saude do etcd via etcdctl
ETCDCTL_API=3 etcdctl \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt \\
  --key=/etc/kubernetes/pki/etcd/server.key \\
  endpoint health

# Listar membros
ETCDCTL_API=3 etcdctl \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt \\
  --key=/etc/kubernetes/pki/etcd/server.key \\
  member list
\`\`\`

## Problemas de Certificado

Certificados expirados sao uma causa comum de falhas no cluster.

\`\`\`bash
# Verificar validade de todos os certificados do cluster
kubeadm certs check-expiration

# Renovar todos os certificados
kubeadm certs renew all

# Verificar certificado especifico
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -text | grep -A 2 Validity

# Verificar certificados do etcd
openssl x509 -in /etc/kubernetes/pki/etcd/server.crt -noout -dates
\`\`\`

## Problemas de kubeconfig

\`\`\`bash
# Verificar contexto atual
kubectl config current-context
kubectl config view

# Testar conectividade
kubectl cluster-info

# Especificar kubeconfig diferente
kubectl --kubeconfig=/path/to/kubeconfig get nodes

# Verificar se o kubeconfig esta correto
kubectl config view --raw | grep server
\`\`\`

## Fluxo de Diagnostico Geral

1. \`kubectl get nodes\` - visao geral dos nodes
2. \`kubectl get pods -n kube-system\` - estado dos componentes
3. \`kubectl describe node <node>\` - condicoes e eventos do node
4. SSH no node + \`systemctl status kubelet\`
5. \`journalctl -u kubelet -n 50\` - logs do kubelet
6. Verificar manifestos em \`/etc/kubernetes/manifests/\`
7. \`kubectl get events --sort-by=.lastTimestamp\` - eventos recentes
`,

  quiz: [
    {
      question: 'Um node esta em estado NotReady. Qual e o primeiro comando mais util para diagnosticar o problema?',
      options: [
        'kubectl get pods -n kube-system',
        'kubectl describe node <nome-do-node>',
        'kubectl get events',
        'systemctl restart kubelet'
      ],
      correct: 1,
      explanation: 'kubectl describe node fornece as condicoes do node (MemoryPressure, DiskPressure, etc.) e eventos recentes, que sao o ponto de partida ideal para diagnosticar um node NotReady.'
    },
    {
      question: 'Onde ficam os manifestos dos static pods do control plane em um cluster criado com kubeadm?',
      options: [
        '/etc/kubernetes/pods/',
        '/var/lib/kubelet/static-pods/',
        '/etc/kubernetes/manifests/',
        '/etc/systemd/system/kubernetes/'
      ],
      correct: 2,
      explanation: 'Os manifestos dos static pods (kube-apiserver, kube-scheduler, kube-controller-manager, etcd) ficam em /etc/kubernetes/manifests/. O kubelet monitora esse diretorio e gerencia esses pods diretamente.'
    },
    {
      question: 'Qual comando verifica os logs do kubelet em um node Linux?',
      options: [
        'kubectl logs kubelet -n kube-system',
        'cat /var/log/kubelet.log',
        'journalctl -u kubelet -f',
        'docker logs kubelet'
      ],
      correct: 2,
      explanation: 'O kubelet e um servico systemd, entao seus logs sao consultados com journalctl -u kubelet. O flag -f segue os logs em tempo real.'
    },
    {
      question: 'Como voce verifica a validade dos certificados do cluster criado com kubeadm?',
      options: [
        'kubectl get certificates -n kube-system',
        'kubeadm certs check-expiration',
        'openssl verify /etc/kubernetes/pki/',
        'kubectl describe secrets -n kube-system'
      ],
      correct: 1,
      explanation: 'kubeadm certs check-expiration lista todos os certificados do cluster com suas datas de expiracao de forma centralizada e facil de ler.'
    },
    {
      question: 'O kubectl nao esta funcionando e voce precisa ver os logs do kube-apiserver. Qual ferramenta pode ser usada diretamente no node?',
      options: [
        'docker logs kube-apiserver',
        'crictl logs <container-id>',
        'journalctl -u kube-apiserver',
        'cat /var/log/apiserver.log'
      ],
      correct: 1,
      explanation: 'crictl e a ferramenta CLI para interagir com container runtimes compativeis com CRI (como containerd). Use crictl pods e crictl logs para inspecionar containers quando kubectl nao esta disponivel.'
    },
    {
      question: 'Um node apresenta a condicao MemoryPressure como True. O que isso indica?',
      options: [
        'O node esta sem memoria RAM disponivel e pode comecar a evict pods',
        'O pod solicitou mais memoria do que o limite permitido',
        'O scheduler nao consegue alocar pods no node',
        'O kubelet esta consumindo muita memoria'
      ],
      correct: 0,
      explanation: 'MemoryPressure True significa que o node esta com pouca memoria disponivel. Nesse estado, o kubelet pode comecar a evict pods para liberar memoria, priorizando pods sem requests definidos.'
    },
    {
      question: 'Como voce reinicia um componente do control plane que roda como static pod?',
      options: [
        'kubectl restart pod kube-scheduler-master -n kube-system',
        'systemctl restart kube-scheduler',
        'Mover e restaurar o manifesto YAML em /etc/kubernetes/manifests/',
        'kubectl delete pod kube-scheduler-master -n kube-system --force'
      ],
      correct: 2,
      explanation: 'Static pods sao gerenciados pelo kubelet via manifestos em /etc/kubernetes/manifests/. Para reiniciar, pode-se mover o manifesto para fora do diretorio e restaura-lo. O kubelet detecta a mudanca automaticamente. Deletar via kubectl tambem funciona, mas o pod sera recriado pelo kubelet a partir do manifesto.'
    },
    {
      question: 'Voce precisa fazer join de um novo node worker ao cluster. O token de bootstrap expirou. Qual comando gera um novo token?',
      options: [
        'kubectl create token bootstrap -n kube-system',
        'kubeadm token create --print-join-command',
        'kubeadm join --regenerate-token',
        'openssl rand -hex 3 > /etc/kubernetes/token'
      ],
      correct: 1,
      explanation: 'kubeadm token create --print-join-command gera um novo token de bootstrap valido e imprime o comando completo kubeadm join que deve ser executado no node worker. Tokens expiram por padrao em 24 horas.'
    },
    {
      question: 'O kube-scheduler nao esta funcionando. Qual e o sintoma observado nos pods?',
      options: [
        'Pods ficam em estado CrashLoopBackOff',
        'Pods ficam em estado Pending com razao "Unschedulable"',
        'Pods ficam em estado Error',
        'Pods sao deletados automaticamente'
      ],
      correct: 1,
      explanation: 'Se o kube-scheduler falhar, novos pods ficam em estado Pending indefinidamente porque nao ha componente para atribuir um node a eles. O kubectl describe pod mostra "0/N nodes are available" ou similar. Pods ja rodando nao sao afetados.'
    },
    {
      question: 'Qual comando verifica o status de saude dos componentes do control plane (apiserver, controller-manager, scheduler)?',
      options: [
        'kubectl get componentstatuses',
        'kubectl health-check control-plane',
        'kubeadm verify control-plane',
        'kubectl get pods -n kube-system --show-status'
      ],
      correct: 0,
      explanation: 'kubectl get componentstatuses (ou kubectl get cs) mostra o status dos componentes do control plane. Embora deprecated em versoes mais recentes, ainda funciona. Alternativa: kubectl get pods -n kube-system para verificar os static pods do control plane.'
    },
    {
      question: 'Um node worker apresenta a condicao NetworkUnavailable como True. O que isso geralmente indica?',
      options: [
        'O node nao tem acesso a internet',
        'O plugin CNI nao esta instalado ou configurado corretamente no node',
        'O kube-proxy falhou no node',
        'O firewall esta bloqueando o trafego'
      ],
      correct: 1,
      explanation: 'NetworkUnavailable True indica que o plugin CNI (Container Network Interface) nao esta corretamente configurado no node. Isso geralmente acontece quando um node e adicionado ao cluster mas o DaemonSet do CNI (como Calico, Flannel, WeaveNet) ainda nao instalou o plugin nesse node.'
    },
    {
      question: 'Voce precisa renovar todos os certificados de um cluster kubeadm antes que expirem. Qual e o processo correto?',
      options: [
        'Deletar todos os pods do control plane e recriar com kubeadm init',
        'Executar kubeadm certs renew all e reiniciar os pods do control plane',
        'Executar openssl renew para cada certificado manualmente',
        'Os certificados sao renovados automaticamente pelo Kubernetes'
      ],
      correct: 1,
      explanation: 'O processo correto e: (1) kubeadm certs renew all para renovar todos os certificados; (2) reiniciar os static pods do control plane movendo os manifestos de /etc/kubernetes/manifests/; (3) copiar o novo admin.conf para ~/.kube/config. Os certificados kubeadm expiram em 1 ano por padrao.'
    },
    {
      question: 'Qual arquivo de configuracao controla o kubelet e onde ele fica em clusters kubeadm?',
      options: [
        '/etc/kubernetes/kubelet.yaml',
        '/var/lib/kubelet/config.yaml',
        '/etc/systemd/system/kubelet.conf',
        '/usr/lib/kubelet/kubelet-config.json'
      ],
      correct: 1,
      explanation: 'O arquivo de configuracao principal do kubelet em clusters kubeadm fica em /var/lib/kubelet/config.yaml. As flags de inicializacao do servico systemd ficam em /etc/systemd/system/kubelet.service.d/10-kubeadm.conf. Apos alterar a configuracao, execute systemctl daemon-reload && systemctl restart kubelet.'
    }
  ],

  flashcards: [
    {
      front: 'Qual e o caminho dos manifestos dos static pods do control plane?',
      back: '/etc/kubernetes/manifests/\n\nContendo: kube-apiserver.yaml, kube-scheduler.yaml, kube-controller-manager.yaml, etcd.yaml'
    },
    {
      front: 'Como verificar logs do kubelet em tempo real?',
      back: 'journalctl -u kubelet -f\n\nOutras opcoes uteis:\njournalctl -u kubelet -n 100 --no-pager\njournalctl -u kubelet --since "10 minutes ago"\njournalctl -u kubelet -p err'
    },
    {
      front: 'Quais sao as 5 condicoes de um node e o que cada uma indica?',
      back: 'Ready: node saudavel\nMemoryPressure: pouca memoria\nDiskPressure: pouco disco\nPIDPressure: muitos processos\nNetworkUnavailable: CNI nao configurado'
    },
    {
      front: 'Como verificar a saude do etcd via linha de comando?',
      back: 'ETCDCTL_API=3 etcdctl \\\n  --endpoints=https://127.0.0.1:2379 \\\n  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\\n  --cert=/etc/kubernetes/pki/etcd/server.crt \\\n  --key=/etc/kubernetes/pki/etcd/server.key \\\n  endpoint health'
    },
    {
      front: 'Como verificar e renovar certificados do cluster com kubeadm?',
      back: 'Verificar: kubeadm certs check-expiration\nRenovar tudo: kubeadm certs renew all\nRenovar especifico: kubeadm certs renew apiserver'
    },
    {
      front: 'Qual ferramenta usar para ver containers quando kubectl nao funciona?',
      back: 'crictl - CLI para container runtimes compatíveis com CRI\n\ncrictl pods - listar pods\ncrictl ps - listar containers\ncrictl logs <id> - ver logs\ncrictl inspect <id> - inspecionar container'
    },
    {
      front: 'Como desabilitar swap em um node Linux (necessario para o kubelet)?',
      back: 'Temporario: swapoff -a\n\nPermanente: editar /etc/fstab e comentar ou remover a linha de swap, depois reiniciar ou rodar swapoff -a novamente'
    }
  ],

  lab: {
    scenario: 'Um node worker de um cluster kubeadm esta em estado NotReady. Sua tarefa e diagnosticar e corrigir o problema sem informacoes previas sobre a causa raiz.',
    objective: 'Diagnosticar a causa do node NotReady e restaurar o node ao estado Ready utilizando as ferramentas de troubleshooting do Kubernetes.',
    steps: [
      {
        title: 'Identificar o node com problema',
        instruction: 'Verifique o estado de todos os nodes do cluster e identifique qual esta com problema. Em seguida, obtenha informacoes detalhadas sobre o node afetado, incluindo suas condicoes e eventos recentes.',
        hints: [
          'Use kubectl get nodes para ver o estado geral',
          'Use kubectl describe node <nome> para ver condicoes e eventos',
          'A secao Conditions mostra o estado de cada condicao do node'
        ],
        solution: '```bash\n# Ver estado de todos os nodes\nkubectl get nodes\n\n# Identificar o node com NotReady e inspecionar\nkubectl describe node worker-1\n\n# Ver apenas as condicoes (grep util)\nkubectl describe node worker-1 | grep -A 5 "Conditions:"\n\n# Ver eventos recentes do node\nkubectl get events --field-selector involvedObject.name=worker-1\n```'
      },
      {
        title: 'Diagnosticar o kubelet no node afetado',
        instruction: 'Acesse o node afetado via SSH e verifique o estado do servico kubelet. Analise os logs para identificar o erro especifico que esta causando o problema.',
        hints: [
          'Use systemctl status kubelet para ver o estado do servico',
          'Use journalctl -u kubelet -n 50 para ver os ultimos 50 logs',
          'Procure por palavras-chave como "error", "failed", "unable"',
          'Certifique-se de que o containerd tambem esta rodando'
        ],
        solution: '```bash\n# SSH no node afetado\nssh worker-1\n\n# Verificar estado do kubelet\nsystemctl status kubelet\n\n# Ver logs detalhados\njournalctl -u kubelet -n 50 --no-pager\n\n# Filtrar apenas erros\njournalctl -u kubelet -p err --since "30 minutes ago"\n\n# Verificar container runtime\nsystemctl status containerd\n\n# Se containerd estiver parado\nsystemctl start containerd\nsystemctl enable containerd\n```'
      },
      {
        title: 'Corrigir o problema e restaurar o node',
        instruction: 'Com base no diagnostico anterior, aplique a correcao necessaria. Os cenarios mais comuns sao: kubelet parado, swap habilitada, problema de certificado, ou container runtime com falha. Apos a correcao, valide que o node voltou ao estado Ready.',
        hints: [
          'Para kubelet parado: systemctl start kubelet && systemctl enable kubelet',
          'Para swap habilitada: swapoff -a e editar /etc/fstab',
          'Para certificado expirado: kubeadm certs renew all',
          'Use kubectl get nodes no control plane para confirmar o estado Ready',
          'Aguarde ate 60 segundos para o node reportar o estado correto'
        ],
        solution: '```bash\n# Cenario 1: Kubelet parado\nsystemctl start kubelet\nsystemctl enable kubelet\njournalctl -u kubelet -f  # monitorar logs\n\n# Cenario 2: Swap habilitada\nswapoff -a\n# Comentar linha de swap no fstab\nsed -i "/swap/s/^/#/" /etc/fstab\nsystemctl restart kubelet\n\n# Cenario 3: Container runtime parado\nsystemctl start containerd\nsystemctl enable containerd\nsystemctl restart kubelet\n\n# Validar no control plane (sair do SSH primeiro)\nexit\nkubectl get nodes --watch\n# Aguardar ate worker-1 mostrar Ready\n\n# Confirmar que pods estao sendo agendados no node\nkubectl get pods -o wide | grep worker-1\n```'
      },
      {
        title: 'Investigar falha em componente do control plane',
        instruction: 'Simule e resolva uma falha no kube-scheduler. Remova o manifesto do static pod, observe o comportamento do cluster e restaure o componente.',
        hints: [
          'Static pods ficam em /etc/kubernetes/manifests/',
          'Sem o scheduler, novos pods ficam em estado Pending',
          'O kubelet detecta mudancas no diretorio de manifestos automaticamente',
          'Use kubectl get pods -n kube-system para monitorar o estado dos componentes'
        ],
        solution: '```bash\n# No node master - simular falha movendo o manifesto\nsudo mv /etc/kubernetes/manifests/kube-scheduler.yaml /tmp/\n\n# Observar o pod do scheduler sumir\nkubectl get pods -n kube-system -w\n\n# Testar que novos pods ficam Pending\nkubectl run teste --image=nginx\nkubectl get pods  # deve mostrar Pending\n\n# Restaurar o scheduler\nsudo mv /tmp/kube-scheduler.yaml /etc/kubernetes/manifests/\n\n# Aguardar o pod do scheduler voltar\nkubectl get pods -n kube-system -w\n\n# Verificar que o pod teste foi agendado\nkubectl get pods\n\n# Limpar\nkubectl delete pod teste\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Node em estado NotReady apos reinicializacao',
      symptom: 'Apos uma reinicializacao do servidor, o node worker aparece como NotReady no kubectl get nodes. Pods que estavam rodando no node nao estao mais acessiveis.',
      diagnosis: `**Passos de diagnostico:**

\`\`\`bash
# 1. Verificar o estado do node e suas condicoes
kubectl describe node <worker-node> | grep -A 10 "Conditions:"

# 2. Ver eventos relacionados ao node
kubectl get events --sort-by=.lastTimestamp | grep <worker-node>

# 3. SSH no node e verificar kubelet
ssh <worker-node>
systemctl status kubelet

# 4. Ver os logs do kubelet para identificar o erro
journalctl -u kubelet -n 100 --no-pager

# 5. Verificar se swap foi habilitada apos reboot
swapon --show

# 6. Verificar container runtime
systemctl status containerd
\`\`\``,
      solution: `**Resolucao por causa raiz:**

**Causa: Kubelet nao iniciou automaticamente**
\`\`\`bash
systemctl start kubelet
systemctl enable kubelet  # garantir inicio automatico
\`\`\`

**Causa: Swap habilitada (kubelet nao tolera swap por padrao)**
\`\`\`bash
swapoff -a
# Tornar permanente - comentar linha de swap no /etc/fstab
sed -i "/swap/s/^/#/" /etc/fstab
systemctl restart kubelet
\`\`\`

**Causa: Container runtime (containerd) nao iniciou**
\`\`\`bash
systemctl start containerd
systemctl enable containerd
systemctl restart kubelet
\`\`\`

**Validar recuperacao:**
\`\`\`bash
# No control plane - aguardar node voltar
kubectl get nodes --watch
# Confirmar que node esta Ready e pods voltaram
kubectl get pods -o wide | grep <worker-node>
\`\`\``
    },
    {
      title: 'kube-apiserver nao responde - cluster inacessivel',
      symptom: 'kubectl nao retorna resposta, mostrando "Unable to connect to the server: dial tcp: connection refused" ou timeout. Nenhum comando kubectl funciona.',
      diagnosis: `**Passos de diagnostico (no node master via SSH):**

\`\`\`bash
# 1. Verificar se o processo do apiserver esta rodando
ps aux | grep kube-apiserver | grep -v grep

# 2. Verificar o static pod via crictl
crictl pods | grep apiserver
crictl ps -a | grep apiserver

# 3. Ver logs do container do apiserver
crictl logs $(crictl ps -a | grep apiserver | awk '{print $1}')

# 4. Verificar o manifesto do static pod
cat /etc/kubernetes/manifests/kube-apiserver.yaml

# 5. Verificar se a porta 6443 esta respondendo
ss -tlnp | grep 6443
curl -k https://localhost:6443/healthz

# 6. Verificar logs do kubelet (que gerencia o static pod)
journalctl -u kubelet -n 100 | grep -i apiserver

# 7. Verificar certificados do apiserver
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -dates
\`\`\``,
      solution: `**Resolucao por causa raiz:**

**Causa: Manifesto YAML invalido apos edicao manual**
\`\`\`bash
# Validar o YAML do manifesto
python3 -c "import yaml; yaml.safe_load(open('/etc/kubernetes/manifests/kube-apiserver.yaml'))"

# Corrigir o YAML e aguardar o kubelet recriar o pod
# O kubelet verifica o diretorio a cada 20 segundos
\`\`\`

**Causa: Certificado expirado**
\`\`\`bash
# Verificar todos os certificados
kubeadm certs check-expiration

# Renovar certificados
kubeadm certs renew all

# Reiniciar os componentes do control plane
# Mover e restaurar os manifestos ou reiniciar o kubelet
systemctl restart kubelet
\`\`\`

**Causa: etcd inacessivel (apiserver depende do etcd)**
\`\`\`bash
# Verificar saude do etcd
ETCDCTL_API=3 etcdctl \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt \\
  --key=/etc/kubernetes/pki/etcd/server.key \\
  endpoint health

# Ver logs do etcd
crictl logs $(crictl ps -a | grep etcd | awk '{print $1}')
\`\`\`

**Validar recuperacao:**
\`\`\`bash
curl -k https://localhost:6443/healthz
kubectl get nodes
\`\`\``
    },
    {
      title: 'Pods ficam em estado Pending indefinidamente',
      symptom: 'Novos pods ficam em Pending e nunca sao agendados em nenhum node. O evento do pod mostra "0/3 nodes are available" mesmo com nodes em estado Ready.',
      diagnosis: `**Passos de diagnostico:**

\`\`\`bash
# 1. Ver detalhes e eventos do pod
kubectl describe pod <nome-do-pod>
# Verificar a secao Events para mensagens do scheduler

# 2. Verificar se o scheduler esta rodando
kubectl get pods -n kube-system | grep scheduler

# 3. Ver logs do scheduler
kubectl logs kube-scheduler-master -n kube-system

# 4. Verificar taints nos nodes
kubectl describe nodes | grep -i taint

# 5. Verificar se o pod tem resources requests acima do disponivel
kubectl describe pod <nome-do-pod> | grep -A 5 "Requests:"
kubectl describe nodes | grep -A 5 "Allocated resources:"

# 6. Verificar NodeSelector ou affinity rules
kubectl get pod <nome-do-pod> -o yaml | grep -A 10 nodeSelector
\`\`\``,
      solution: `**Resolucao por causa raiz:**

**Causa: Scheduler nao esta rodando**
\`\`\`bash
# Verificar o manifesto do scheduler
cat /etc/kubernetes/manifests/kube-scheduler.yaml

# Restaurar o manifesto se estiver faltando
# O scheduler sera recriado pelo kubelet automaticamente
kubectl get pods -n kube-system -w | grep scheduler
\`\`\`

**Causa: Todos os nodes tem taint e o pod nao tem toleration**
\`\`\`bash
# Ver taints dos nodes
kubectl describe node | grep Taint

# Adicionar toleration ao pod ou
# Remover o taint do node (se intencional)
kubectl taint node worker-1 key=value:NoSchedule-
\`\`\`

**Causa: Requests de CPU/memoria excedem o disponivel**
\`\`\`bash
# Ver recursos disponiveis nos nodes
kubectl describe nodes | grep -A 6 "Allocated resources:"

# Ajustar os requests do pod para valores viaveis
kubectl edit deployment <nome-do-deployment>
\`\`\`

**Causa: NodeSelector aponta para label inexistente**
\`\`\`bash
# Ver labels dos nodes
kubectl get nodes --show-labels

# Adicionar a label necessaria ao node
kubectl label node worker-1 disk=ssd

# Ou remover o nodeSelector do pod se nao for necessario
\`\`\``
    },
    {
      title: 'Certificados do cluster expirados',
      symptom: 'Comandos kubectl falham com erro "x509: certificate has expired or is not yet valid". O kubelet pode mostrar erros de autenticacao nos logs.',
      diagnosis: `**Passos de diagnostico:**

\`\`\`bash
# 1. Verificar expiracao de todos os certificados
kubeadm certs check-expiration

# 2. Verificar certificado especifico
openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -dates

# 3. Verificar certificados do etcd
openssl x509 -in /etc/kubernetes/pki/etcd/server.crt -noout -dates

# 4. Verificar certificado do kubelet
openssl x509 -in /var/lib/kubelet/pki/kubelet.crt -noout -dates

# 5. Verificar logs do kubelet por erros de certificado
journalctl -u kubelet | grep -i "certificate\\|x509\\|expired"
\`\`\``,
      solution: `**Resolucao:**

\`\`\`bash
# Renovar todos os certificados do cluster
kubeadm certs renew all

# Verificar que foram renovados com sucesso
kubeadm certs check-expiration

# Reiniciar os componentes do control plane para usar os novos certificados
# Mover e restaurar os manifestos dos static pods
cd /etc/kubernetes/manifests/
for f in *.yaml; do
  mv "$f" /tmp/
  sleep 2
  mv "/tmp/$f" .
done

# Aguardar os pods do control plane reiniciarem
kubectl get pods -n kube-system -w

# Copiar o novo admin.conf para o kubeconfig do usuario
cp /etc/kubernetes/admin.conf ~/.kube/config

# Testar acesso
kubectl get nodes
\`\`\``
    }
  ]
};
