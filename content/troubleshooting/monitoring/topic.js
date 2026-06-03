window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['troubleshooting/monitoring'] = {
  theory: `# Monitoramento e Logging no Kubernetes

## Visao Geral

Monitoramento e logging sao fundamentais para operar um cluster Kubernetes em producao. O CKA exige proficiencia em ferramentas nativas do Kubernetes para coletar metricas, analisar logs e responder a eventos do cluster.

## kubectl top - Metricas de Uso de Recursos

O comando \`kubectl top\` exibe o uso atual de CPU e memoria de nodes e pods.

\`\`\`bash
# Uso de recursos dos nodes
kubectl top nodes

# Uso de recursos dos pods no namespace padrao
kubectl top pods

# Uso de recursos dos pods em todos os namespaces
kubectl top pods --all-namespaces

# Uso de recursos de um pod especifico
kubectl top pod meu-pod

# Mostrar containers individualmente dentro dos pods
kubectl top pods --containers

# Ordenar por CPU
kubectl top pods --sort-by=cpu

# Ordenar por memoria
kubectl top pods --sort-by=memory
\`\`\`

### Saida do kubectl top nodes

\`\`\`
NAME       CPU(cores)   CPU%   MEMORY(bytes)   MEMORY%
master     250m         12%    1200Mi          60%
worker-1   180m         9%     800Mi           40%
worker-2   450m         22%    1500Mi          75%
\`\`\`

## Metrics Server

O \`kubectl top\` depende do Metrics Server para funcionar. Sem ele, o comando retorna erro.

\`\`\`bash
# Verificar se o metrics-server esta instalado
kubectl get deployment metrics-server -n kube-system
kubectl get pods -n kube-system | grep metrics-server

# Instalar o metrics-server (componentes oficiais)
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Em clusters locais (Kind/Minikube), pode precisar de flag extra
# Editar o deployment para adicionar --kubelet-insecure-tls
kubectl patch deployment metrics-server -n kube-system \\
  --type='json' \\
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'

# Verificar saude do metrics-server
kubectl get apiservice v1beta1.metrics.k8s.io

# Em Minikube
minikube addons enable metrics-server
\`\`\`

## kubectl logs - Acessando Logs de Containers

\`\`\`bash
# Logs de um pod (container unico)
kubectl logs meu-pod

# Seguir logs em tempo real (como tail -f)
kubectl logs meu-pod -f

# Ultimas N linhas
kubectl logs meu-pod --tail=50

# Logs desde um periodo especifico
kubectl logs meu-pod --since=1h
kubectl logs meu-pod --since=30m
kubectl logs meu-pod --since-time=2024-01-15T10:00:00Z

# Logs de container especifico em pod multi-container
kubectl logs meu-pod -c nome-do-container

# Listar todos os containers de um pod
kubectl describe pod meu-pod | grep "Container ID"

# Logs do container anterior (apos restart/crash)
kubectl logs meu-pod --previous
kubectl logs meu-pod -p

# Logs de todos os pods de um deployment (via selector)
kubectl logs -l app=meu-app

# Logs de um deployment especifico
kubectl logs deployment/meu-deployment

# Combinar flags
kubectl logs meu-pod -f --tail=100 --since=10m
\`\`\`

## Logs em Pod Multi-Container

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: multi-container
spec:
  containers:
    - name: app
      image: nginx
    - name: sidecar
      image: busybox
      command: ["sh", "-c", "while true; do echo sidecar log; sleep 5; done"]
    - name: init-container
      image: busybox
\`\`\`

\`\`\`bash
# Ver logs do container 'app'
kubectl logs multi-container -c app

# Ver logs do sidecar
kubectl logs multi-container -c sidecar -f

# Ver logs do init container
kubectl logs multi-container -c init-container
\`\`\`

## Localizacao dos Logs no Sistema de Arquivos

Em producao, os logs dos containers ficam armazenados no node:

\`\`\`bash
# Logs dos containers (symlinks para /var/log/pods/)
ls /var/log/containers/
# Formato: <pod-name>_<namespace>_<container-name>-<container-id>.log

# Logs organizados por pod
ls /var/log/pods/
# Formato: <namespace>_<pod-name>_<uid>/<container-name>/

# Acessar log diretamente
cat /var/log/containers/meu-pod_default_meu-container-<id>.log

# Logs do kubelet e do sistema (systemd)
journalctl -u kubelet
journalctl -u kubelet -f
journalctl -u kubelet --since "1 hour ago"
journalctl -u containerd -n 100

# Logs do kernel
journalctl -k --since "30 min ago"
\`\`\`

## kubectl get events - Eventos do Cluster

Eventos sao a fonte de informacao mais importante para entender o que aconteceu no cluster.

\`\`\`bash
# Ver todos os eventos no namespace atual
kubectl get events

# Ordenar por timestamp (mais recentes por ultimo)
kubectl get events --sort-by=.lastTimestamp

# Eventos de todos os namespaces
kubectl get events --all-namespaces

# Filtrar eventos de um pod especifico
kubectl get events --field-selector involvedObject.name=meu-pod

# Filtrar apenas eventos de Warning
kubectl get events --field-selector type=Warning

# Filtrar por tipo de objeto
kubectl get events --field-selector involvedObject.kind=Node

# Eventos em formato mais legivel
kubectl get events -o wide

# Monitorar eventos em tempo real
kubectl get events -w

# Combinar filtros
kubectl get events \\
  --field-selector involvedObject.kind=Pod,type=Warning \\
  --sort-by=.lastTimestamp
\`\`\`

### Formato de um Evento

\`\`\`
LAST SEEN   TYPE      REASON              OBJECT          MESSAGE
2m          Warning   BackOff             pod/meu-pod     Back-off restarting failed container
5m          Normal    Scheduled           pod/meu-pod     Successfully assigned default/meu-pod to worker-1
5m          Normal    Pulled              pod/meu-pod     Container image already present on machine
5m          Normal    Created             pod/meu-pod     Created container meu-container
5m          Normal    Started             pod/meu-pod     Started container meu-container
\`\`\`

## Analise de Uso de Recursos

\`\`\`bash
# Identificar pods que consomem mais CPU
kubectl top pods --all-namespaces --sort-by=cpu | head -10

# Identificar pods que consomem mais memoria
kubectl top pods --all-namespaces --sort-by=memory | head -10

# Ver requests e limits configurados
kubectl describe pod meu-pod | grep -A 4 "Requests:"
kubectl describe pod meu-pod | grep -A 4 "Limits:"

# Ver uso vs requests de um node
kubectl describe node worker-1 | grep -A 10 "Allocated resources:"

# Verificar se ha pods sem limites (risco de OOM)
kubectl get pods --all-namespaces -o json | \\
  python3 -c "import json,sys; [print(c['name']) for p in json.load(sys.stdin)['items'] for c in p['spec']['containers'] if 'limits' not in c.get('resources',{})]"
\`\`\`

## Audit Logging

O audit logging registra todas as requisicoes ao API Server. E configurado no manifesto do kube-apiserver.

\`\`\`yaml
# Exemplo de audit policy simples
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
  - level: Metadata
    resources:
      - group: ""
        resources: ["pods"]
  - level: Request
    resources:
      - group: ""
        resources: ["secrets", "configmaps"]
  - level: None
    resources:
      - group: ""
        resources: ["events"]
\`\`\`

\`\`\`bash
# Flags do kube-apiserver para audit (em /etc/kubernetes/manifests/kube-apiserver.yaml)
# --audit-log-path=/var/log/kubernetes/audit.log
# --audit-log-maxage=30
# --audit-log-maxbackup=10
# --audit-log-maxsize=100
# --audit-policy-file=/etc/kubernetes/audit-policy.yaml

# Ler os logs de auditoria
cat /var/log/kubernetes/audit.log | python3 -m json.tool | grep "verb\\|user\\|resource"
\`\`\`

## Fluxo de Diagnostico com Monitoramento

1. \`kubectl get events --sort-by=.lastTimestamp\` - visao geral do que aconteceu
2. \`kubectl describe pod <pod>\` - eventos e estado do pod especifico
3. \`kubectl logs <pod> --previous\` - logs da execucao anterior (se crashou)
4. \`kubectl top pods\` - identificar consumo anormal de recursos
5. \`kubectl top nodes\` - verificar pressao nos nodes
6. \`journalctl -u kubelet\` - logs do node para problemas de infraestrutura
`,

  quiz: [
    {
      question: 'Qual componente precisa estar instalado para que kubectl top nodes e kubectl top pods funcionem?',
      options: [
        'Prometheus',
        'kube-state-metrics',
        'Metrics Server',
        'Grafana'
      ],
      correct: 2,
      explanation: 'O kubectl top depende do Metrics Server, que coleta metricas de uso de CPU e memoria dos kubelets de cada node. Sem o Metrics Server instalado, o comando retorna o erro "Metrics API not available".'
    },
    {
      question: 'Como ver os logs do container que acabou de crashar (execucao anterior) em um pod?',
      options: [
        'kubectl logs meu-pod --crashed',
        'kubectl logs meu-pod --previous',
        'kubectl logs meu-pod --last-run',
        'kubectl describe pod meu-pod --logs'
      ],
      correct: 1,
      explanation: 'kubectl logs meu-pod --previous (ou -p) exibe os logs do container na execucao anterior, o que e essencial para diagnosticar a causa de um crash. Sem este flag, kubectl logs mostra apenas a execucao atual.'
    },
    {
      question: 'Qual comando exibe os logs de um container especifico em um pod com multiplos containers?',
      options: [
        'kubectl logs meu-pod --container=nome-container',
        'kubectl logs meu-pod -c nome-container',
        'kubectl logs meu-pod/nome-container',
        'As opcoes A e B estao corretas'
      ],
      correct: 3,
      explanation: 'Tanto --container=nome-container quanto -c nome-container sao validos e equivalentes. Em um pod com multiplos containers, e obrigatorio especificar qual container se quer ver os logs.'
    },
    {
      question: 'Onde ficam armazenados os arquivos de log dos containers no sistema de arquivos do node?',
      options: [
        '/var/log/docker/',
        '/etc/kubernetes/logs/',
        '/var/log/containers/',
        '/run/containers/logs/'
      ],
      correct: 2,
      explanation: '/var/log/containers/ contem symlinks para os arquivos de log reais que ficam em /var/log/pods/. Os arquivos seguem o formato: <pod-name>_<namespace>_<container-name>-<container-id>.log'
    },
    {
      question: 'Como ver apenas eventos do tipo Warning ordenados por tempo em um namespace especifico?',
      options: [
        'kubectl get events --type=Warning -n meu-ns',
        'kubectl get events --field-selector type=Warning -n meu-ns --sort-by=.lastTimestamp',
        'kubectl get events --filter=warning --namespace=meu-ns',
        'kubectl get warnings -n meu-ns --sort-by=time'
      ],
      correct: 1,
      explanation: 'A combinacao correta usa --field-selector para filtrar o tipo e --sort-by para ordenar. O campo correto e type (nao --type) e o sort usa o caminho JSONPath .lastTimestamp.'
    },
    {
      question: 'Qual comando mostra os logs de todos os pods de um deployment em tempo real?',
      options: [
        'kubectl logs deployment/meu-app -f',
        'kubectl logs -l app=meu-app -f --all-containers',
        'kubectl logs meu-app --deployment -f',
        'As opcoes A e B estao corretas'
      ],
      correct: 3,
      explanation: 'Ambos os formatos funcionam: kubectl logs deployment/<nome> -f segue logs do deployment, e kubectl logs -l <seletor> -f segue logs de todos os pods que correspondem ao seletor. A flag --all-containers e util em pods multi-container.'
    },
    {
      question: 'Como identificar qual pod esta consumindo mais memoria no cluster inteiro?',
      options: [
        'kubectl get pods --sort-by=memory --all-namespaces',
        'kubectl top pods --all-namespaces --sort-by=memory',
        'kubectl describe nodes | grep memory',
        'kubectl get metrics --sort-by=memory'
      ],
      correct: 1,
      explanation: 'kubectl top pods --all-namespaces --sort-by=memory lista todos os pods de todos os namespaces ordenados pelo consumo de memoria. Combine com | head -10 para ver apenas os 10 maiores consumidores.'
    },
    {
      question: 'Um pod esta em estado CrashLoopBackOff. kubectl logs mostra que o container crashou mas nao ha mensagens de erro. Como obter mais informacoes?',
      options: [
        'kubectl get pod -o yaml | grep crashReason',
        'kubectl describe pod para ver os exit codes e eventos recentes',
        'kubectl logs --verbose para mais detalhes',
        'kubectl debug pod para acessar o container crashed'
      ],
      correct: 1,
      explanation: 'kubectl describe pod mostra: (1) exit code do container (e.g. 1=erro, 137=OOMKilled, 143=SIGTERM); (2) motivo do ultimo crash; (3) contagem de restarts; (4) eventos do kubelet. Exit code 137 (OOMKilled) indica limite de memoria excedido. Use kubectl logs --previous para ver logs da execucao anterior.'
    },
    {
      question: 'Como verificar se um node esta proxximo do limite de alocacao de recursos (quase sem CPU/memoria disponivel para novos pods)?',
      options: [
        'kubectl top nodes',
        'kubectl describe node | grep -A5 "Allocated resources"',
        'kubectl get node -o jsonpath="{.status.allocatable}"',
        'Apenas B e C estao corretas'
      ],
      correct: 3,
      explanation: 'kubectl top nodes mostra uso atual (real-time), mas para ver a capacidade ALOCADA (requests dos pods agendados), use kubectl describe node e a secao "Allocated resources" que mostra quantos requests de CPU/memoria ja estao alocados vs a capacidade total do node.'
    },
    {
      question: 'Voce quer monitorar os eventos de um namespace em tempo real para ver o que esta acontecendo. Qual comando usar?',
      options: [
        'kubectl watch events -n meu-ns',
        'kubectl get events -n meu-ns -w --sort-by=.lastTimestamp',
        'kubectl logs events -n meu-ns -f',
        'kubectl monitor -n meu-ns'
      ],
      correct: 1,
      explanation: 'kubectl get events -w segue eventos em tempo real com o flag -w (watch). Combinado com --sort-by=.lastTimestamp, os eventos mais recentes aparecem por ultimo. Util para monitorar o que esta acontecendo num namespace durante um troubleshooting ao vivo.'
    },
    {
      question: 'Qual e a interpretacao correta do exit code 137 em um container terminado?',
      options: [
        'O container foi terminado por erro de aplicacao (segmentation fault)',
        'O container foi morto pelo kernel (OOMKilled) por exceder o limite de memoria',
        'O container falhou ao iniciar por imagem nao encontrada',
        'O container foi terminado gracefully pelo kubelet'
      ],
      correct: 1,
      explanation: 'Exit code 137 = 128 + 9 (SIGKILL). Indica que o container foi terminado com SIGKILL, o que geralmente significa OOMKill (Out of Memory Killed) pelo kernel. Verifique a secao "OOMKilled: true" em kubectl describe pod. A solucao e aumentar o memory limit do container ou otimizar o uso de memoria da aplicacao.'
    },
    {
      question: 'Como ver o historico de uso de recursos de um pod ao longo do tempo (series temporais)?',
      options: [
        'kubectl top pod meu-pod --history',
        'kubectl logs meu-pod --metrics',
        'Kubectl nao suporta historico - e necessario Prometheus/Grafana ou ferramenta de observabilidade',
        'kubectl describe pod meu-pod --show-metrics'
      ],
      correct: 2,
      explanation: 'kubectl top e Metrics Server fornecem apenas metricas em tempo real (snapshot atual). Para historico e series temporais, e necessario uma stack de observabilidade como Prometheus + Grafana, Datadog, New Relic, ou outra ferramenta externa. No exame CKA, o foco e kubectl top e logs, nao Prometheus.'
    }
  ],

  flashcards: [
    {
      front: 'Quais sao as flags mais uteis do kubectl logs para troubleshooting?',
      back: '-f / --follow: seguir em tempo real\n--tail=N: ultimas N linhas\n--since=1h: ultimas 1 hora\n--previous / -p: execucao anterior (crash)\n-c <nome>: container especifico\n--all-containers: todos containers do pod\n-l <seletor>: todos pods com label'
    },
    {
      front: 'Como instalar o Metrics Server e verificar se esta funcionando?',
      back: '# Instalar\nkubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml\n\n# Verificar\nkubectl get pods -n kube-system | grep metrics-server\nkubectl get apiservice v1beta1.metrics.k8s.io\n\n# Em Kind/Minikube (TLS inseguro)\nkubectl patch deployment metrics-server -n kube-system \\\n  --type=json \\\n  -p=\'[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]\''
    },
    {
      front: 'Onde estao os logs dos containers no sistema de arquivos do node?',
      back: '/var/log/containers/ - symlinks para os logs\n/var/log/pods/ - logs reais organizados por pod\n\nFormato: <pod>_<namespace>_<container>-<id>.log\n\nLogs do sistema:\njournalctl -u kubelet\njournalctl -u containerd\njournalctl -k (kernel)'
    },
    {
      front: 'Como ver eventos recentes de Warning em todo o cluster?',
      back: '# Eventos de warning ordenados por tempo\nkubectl get events --all-namespaces \\\n  --field-selector type=Warning \\\n  --sort-by=.lastTimestamp\n\n# Eventos de um recurso especifico\nkubectl get events \\\n  --field-selector involvedObject.name=<nome>\n\n# Monitorar em tempo real\nkubectl get events -w'
    },
    {
      front: 'Como identificar os top 5 pods por consumo de CPU?',
      back: 'kubectl top pods --all-namespaces --sort-by=cpu | head -6\n\n# Por memoria\nkubectl top pods --all-namespaces --sort-by=memory | head -6\n\n# Por node\nkubectl top nodes\n\n# Com containers individuais\nkubectl top pods --containers --sort-by=cpu | head -10'
    },
    {
      front: 'O que e Audit Logging e como e configurado no Kubernetes?',
      back: 'Audit logging registra todas as requisicoes ao API Server.\n\nConfigurado via flags no kube-apiserver:\n--audit-log-path=/var/log/kubernetes/audit.log\n--audit-policy-file=/etc/kubernetes/audit-policy.yaml\n--audit-log-maxage=30\n\nNiveis de auditoria:\n- None: nao registrar\n- Metadata: apenas metadados\n- Request: metadados + corpo da requisicao\n- RequestResponse: metadados + requisicao + resposta'
    },
    {
      front: 'Qual e o fluxo correto de diagnostico quando um pod fica em CrashLoopBackOff?',
      back: '1. kubectl describe pod <nome> - ver eventos e estado\n2. kubectl logs <nome> --previous - logs da execucao que crashou\n3. kubectl get events --field-selector involvedObject.name=<nome>\n4. Verificar recursos: kubectl top pod <nome>\n5. Verificar requests/limits: kubectl describe pod <nome> | grep -A4 Requests\n6. Se node: journalctl -u kubelet -n 50'
    }
  ],

  lab: {
    scenario: 'Voce assume o turno de operacao de um cluster Kubernetes com varios pods rodando. Sua tarefa e usar as ferramentas nativas de monitoramento e logging para avaliar a saude do cluster, identificar problemas e diagnosticar falhas em pods especificos.',
    objective: 'Dominar kubectl top, kubectl logs e kubectl get events para monitorar e diagnosticar problemas em um cluster Kubernetes sem ferramentas externas.',
    steps: [
      {
        title: 'Verificar saude geral do cluster com metricas',
        instruction: 'Use kubectl top para obter uma visao geral do uso de recursos do cluster. Identifique os nodes e pods com maior consumo de CPU e memoria. Verifique se o Metrics Server esta instalado e funcionando.',
        hints: [
          'Se kubectl top retornar erro, o Metrics Server pode nao estar instalado',
          'Use --sort-by=cpu e --sort-by=memory para ordenar os resultados',
          'Use --all-namespaces para ver todos os pods do cluster',
          'kubectl get apiservice v1beta1.metrics.k8s.io verifica a API de metricas'
        ],
        solution: '```bash\n# Verificar se o Metrics Server esta instalado e funcionando\nkubectl get pods -n kube-system | grep metrics-server\nkubectl get apiservice v1beta1.metrics.k8s.io\n\n# Ver uso de recursos dos nodes\nkubectl top nodes\n\n# Ver uso de recursos dos pods (namespace atual)\nkubectl top pods\n\n# Ver todos os pods de todos os namespaces\nkubectl top pods --all-namespaces\n\n# Top 5 por CPU\nkubectl top pods --all-namespaces --sort-by=cpu | head -6\n\n# Top 5 por memoria\nkubectl top pods --all-namespaces --sort-by=memory | head -6\n\n# Ver containers individuais\nkubectl top pods --containers --all-namespaces | head -15\n\n# Ver recursos alocados por node\nkubectl describe nodes | grep -A 6 "Allocated resources:"\n```'
      },
      {
        title: 'Criar pod com problema e diagnosticar via logs e eventos',
        instruction: 'Crie um pod que vai falhar propositalmente (imagem inexistente e outro com exit code 1). Use kubectl logs, kubectl describe e kubectl get events para diagnosticar cada problema.',
        hints: [
          'Um pod com imagem inexistente ficara em ErrImagePull ou ImagePullBackOff',
          'Um pod que sai com erro ficara em CrashLoopBackOff',
          'Use kubectl logs --previous para ver logs da execucao anterior de um container que crashou',
          'kubectl get events --field-selector involvedObject.name=<pod> mostra eventos do pod'
        ],
        solution: '```bash\n# Criar pod com imagem inexistente\nkubectl run bad-image --image=imagem-que-nao-existe:v1\n\n# Criar pod que crasha imediatamente\nkubectl run crash-pod --image=busybox --command -- sh -c "echo iniciando; sleep 2; exit 1"\n\n# Aguardar os pods falharem\nkubectl get pods -w\n# Ctrl+C quando ver os estados de erro\n\n# Diagnosticar bad-image\nkubectl describe pod bad-image | grep -A 10 Events\n# Vai mostrar: Failed to pull image\n\n# Diagnosticar crash-pod\nkubectl get pod crash-pod\n# Estado: CrashLoopBackOff\n\n# Ver logs da execucao anterior\nkubectl logs crash-pod --previous\n# Deve mostrar: "iniciando"\n\n# Ver eventos dos pods com problema\nkubectl get events --sort-by=.lastTimestamp | grep -E "bad-image|crash-pod"\n\n# Ver eventos apenas de Warning\nkubectl get events --field-selector type=Warning --sort-by=.lastTimestamp\n\n# Limpar\nkubectl delete pod bad-image crash-pod\n```'
      },
      {
        title: 'Analisar logs de pod multi-container',
        instruction: 'Crie um pod com dois containers (aplicacao + sidecar de logging). Pratique acessar os logs de cada container individualmente e usando diferentes flags de filtragem temporal.',
        hints: [
          'Use -c para especificar o container',
          'Use --tail para ver apenas as ultimas linhas',
          'Use --since para filtrar por tempo',
          'Use --follow para acompanhar logs em tempo real'
        ],
        solution: '```bash\n# Criar pod multi-container\nkubectl apply -f - <<EOF\napiVersion: v1\nkind: Pod\nmetadata:\n  name: multi-log\nspec:\n  containers:\n    - name: app\n      image: nginx\n    - name: logger\n      image: busybox\n      command: ["sh", "-c", "i=0; while true; do echo \"log-entry-$i $(date)\"; i=$((i+1)); sleep 3; done"]\nEOF\n\n# Aguardar pod ficar pronto\nkubectl wait --for=condition=Ready pod/multi-log --timeout=60s\n\n# Ver logs do container app (nginx)\nkubectl logs multi-log -c app\n\n# Ver logs do container logger\nkubectl logs multi-log -c logger\n\n# Seguir logs do logger em tempo real\nkubectl logs multi-log -c logger -f\n# Ctrl+C para parar\n\n# Ultimas 5 linhas do logger\nkubectl logs multi-log -c logger --tail=5\n\n# Logs do ultimo minuto\nkubectl logs multi-log -c logger --since=1m\n\n# Ver logs de todos os containers\nkubectl logs multi-log --all-containers\n\n# Limpar\nkubectl delete pod multi-log\n```'
      },
      {
        title: 'Monitorar eventos do cluster e logs do node',
        instruction: 'Use kubectl get events com diferentes filtros para monitorar a atividade do cluster. Em seguida, acesse os logs do kubelet via journalctl para ver atividade no nivel do node. Localize os arquivos de log no sistema de arquivos.',
        hints: [
          'kubectl get events -w monitora eventos em tempo real',
          'journalctl -u kubelet precisa de acesso de root no node',
          'Os arquivos de log ficam em /var/log/containers/ no node',
          'Use --field-selector para filtrar eventos por tipo ou objeto'
        ],
        solution: '```bash\n# Ver todos os eventos ordenados por tempo\nkubectl get events --sort-by=.lastTimestamp\n\n# Ver eventos em tempo real (Ctrl+C para parar)\nkubectl get events -w &\n\n# Criar um pod para gerar eventos\nkubectl run evento-test --image=nginx\n\n# Aguardar eventos aparecerem e parar o watch\nkubectl get pods evento-test\nkill %1  # parar o background watch\n\n# Filtrar eventos do pod criado\nkubectl get events \\\n  --field-selector involvedObject.name=evento-test \\\n  --sort-by=.lastTimestamp\n\n# Apenas eventos de Warning no cluster\nkubectl get events \\\n  --all-namespaces \\\n  --field-selector type=Warning \\\n  --sort-by=.lastTimestamp\n\n# No node (via SSH)\n# Logs do kubelet\njournalctl -u kubelet --since "5 minutes ago" --no-pager\n\n# Logs do container runtime\njournalctl -u containerd -n 50 --no-pager\n\n# Listar arquivos de log dos containers\nls -la /var/log/containers/ | head -20\nls -la /var/log/pods/\n\n# Ler um log diretamente\n# Substitua pelo nome real do arquivo\ncat /var/log/containers/evento-test_default_nginx-*.log | head -20\n\n# Limpar\nkubectl delete pod evento-test\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'kubectl top retorna erro - Metrics Server nao disponivel',
      symptom: 'Ao executar kubectl top nodes ou kubectl top pods, o comando retorna: "Error from server (ServiceUnavailable): the server is currently unable to handle the request (get nodes.metrics.k8s.io)" ou "Metrics API not available".',
      diagnosis: `**Passos de diagnostico:**

\`\`\`bash
# 1. Verificar se o metrics-server esta instalado
kubectl get deployment metrics-server -n kube-system

# 2. Ver o estado dos pods do metrics-server
kubectl get pods -n kube-system | grep metrics-server

# 3. Verificar se a API de metricas esta registrada
kubectl get apiservice v1beta1.metrics.k8s.io

# 4. Ver logs do metrics-server para identificar o erro
kubectl logs -n kube-system deployment/metrics-server

# 5. Verificar se o metrics-server consegue acessar o kubelet
kubectl logs -n kube-system deployment/metrics-server | grep -i "error\\|failed\\|certificate"

# 6. Verificar a saude do apiservice
kubectl describe apiservice v1beta1.metrics.k8s.io
\`\`\``,
      solution: `**Resolucao por causa raiz:**

**Causa: Metrics Server nao instalado**
\`\`\`bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Aguardar o pod ficar pronto
kubectl rollout status deployment/metrics-server -n kube-system

# Testar
kubectl top nodes
\`\`\`

**Causa: Erro de certificado TLS (comum em clusters locais Kind/Minikube)**
\`\`\`bash
# Adicionar flag --kubelet-insecure-tls ao metrics-server
kubectl patch deployment metrics-server -n kube-system \\
  --type='json' \\
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'

# Aguardar o rollout
kubectl rollout status deployment/metrics-server -n kube-system
kubectl top nodes
\`\`\`

**Causa: Metrics Server instalado mas pod em CrashLoopBackOff**
\`\`\`bash
# Ver logs para identificar o erro especifico
kubectl logs -n kube-system deployment/metrics-server --previous

# Verificar recursos disponiveis no node
kubectl describe pod -n kube-system -l app.kubernetes.io/name=metrics-server
\`\`\``
    },
    {
      title: 'Pod em CrashLoopBackOff - diagnostico de logs',
      symptom: 'Um pod esta em estado CrashLoopBackOff. Os restarts aumentam continuamente (RESTARTS: 5, 10, 15...). O pod fica rodando por alguns segundos e crasha novamente. kubectl logs mostra o container nao esta rodando.',
      diagnosis: `**Passos de diagnostico:**

\`\`\`bash
# 1. Ver o estado atual do pod
kubectl get pod <nome-do-pod>
kubectl describe pod <nome-do-pod>

# 2. Ver eventos do pod (causa inicial do crash)
kubectl describe pod <nome-do-pod> | grep -A 15 Events

# 3. Ver logs da execucao ANTERIOR (a que crashou)
kubectl logs <nome-do-pod> --previous

# 4. Se multi-container, ver logs de container especifico
kubectl logs <nome-do-pod> -c <container> --previous

# 5. Ver exit code do container
kubectl describe pod <nome-do-pod> | grep -A 5 "Last State:"

# 6. Verificar recursos do pod
kubectl describe pod <nome-do-pod> | grep -A 4 "Requests:"
kubectl describe pod <nome-do-pod> | grep -A 4 "Limits:"

# 7. Ver eventos recentes relacionados ao pod
kubectl get events \\
  --field-selector involvedObject.name=<nome-do-pod> \\
  --sort-by=.lastTimestamp

# 8. Verificar se o pod esta sendo OOMKilled
kubectl describe pod <nome-do-pod> | grep -i "oom\\|killed"
\`\`\``,
      solution: `**Resolucao por causa raiz:**

**Causa: Aplicacao falha ao inicializar (erro no codigo/configuracao)**
\`\`\`bash
# Os logs --previous vao mostrar o erro especifico
# Exemplos comuns:
# - Variavel de ambiente nao definida
# - Arquivo de configuracao nao encontrado
# - Porta ja em uso
# - Dependencia nao disponivel

# Corrigir a configuracao do pod
kubectl edit deployment <nome-do-deployment>
# Ajustar env vars, volumes, ou configuracao da aplicacao
\`\`\`

**Causa: OOMKilled (pod excedeu o limite de memoria)**
\`\`\`bash
# Verificar o OOMKilled
kubectl describe pod <nome> | grep -A 3 "Last State"
# Reason: OOMKilled

# Aumentar o limite de memoria
kubectl set resources deployment <nome> \\
  --limits=memory=512Mi --requests=memory=256Mi

# Ou editar o deployment
kubectl edit deployment <nome>
\`\`\`

**Causa: Liveness Probe muito agressiva**
\`\`\`bash
# Verificar a probe configurada
kubectl describe pod <nome> | grep -A 10 "Liveness:"

# Ajustar os parametros da probe
# Aumentar initialDelaySeconds ou failureThreshold
kubectl edit deployment <nome>
# Ajustar livenessProbe.initialDelaySeconds e periodSeconds
\`\`\``
    },
    {
      title: 'Logs de container nao aparecem ou estao truncados',
      symptom: 'kubectl logs meu-pod retorna saida vazia ou logs muito antigos foram perdidos. Nao e possivel ver logs de execucoes anteriores de pods que ja foram removidos. Logs do node nao aparecem no journalctl.',
      diagnosis: `**Passos de diagnostico:**

\`\`\`bash
# 1. Verificar se o pod esta rodando
kubectl get pod <nome>
kubectl describe pod <nome>

# 2. Verificar se o container esta produzindo logs
kubectl logs <nome> --tail=1

# 3. Verificar logs em tempo real para ver se novos chegam
kubectl logs <nome> -f --tail=10

# 4. Para pods ja removidos, verificar no sistema de arquivos do node (SSH)
ls /var/log/containers/ | grep <nome-parcial-do-pod>
ls /var/log/pods/ | grep <namespace>

# 5. Verificar configuracao de rotacao de logs do kubelet
cat /var/lib/kubelet/config.yaml | grep -i log

# 6. Verificar espaco em disco no node
df -h /var/log
du -sh /var/log/containers/ /var/log/pods/
\`\`\``,
      solution: `**Resolucao por causa raiz:**

**Causa: Container nao escreve em stdout/stderr**
\`\`\`bash
# O Kubernetes apenas coleta logs de stdout/stderr
# Se a aplicacao escreve em arquivo, os logs nao aparecem no kubectl logs

# Solucao: adicionar sidecar que faz tail do arquivo
# Ou configurar a aplicacao para logar em stdout

# Verificar se o container escreve em stdout
kubectl exec <nome> -- sh -c "ps aux"
\`\`\`

**Causa: Logs expirados (pod reiniciou muitas vezes)**
\`\`\`bash
# Aumentar o limite de logs retidos pelo kubelet
# Editar /var/lib/kubelet/config.yaml no node:
# containerLogMaxSize: "10Mi"   # tamanho maximo do arquivo
# containerLogMaxFiles: 5       # numero de arquivos retidos

# Reiniciar o kubelet apos a mudanca
systemctl restart kubelet
\`\`\`

**Causa: Disco cheio no node**
\`\`\`bash
# Verificar uso do disco
df -h /var/log

# Limpar logs antigos (cuidado em producao!)
# O Kubernetes gerencia automaticamente via containerLogMaxSize/containerLogMaxFiles

# Liberar espaco de imagens nao usadas
crictl rmi --prune
\`\`\``
    }
  ]
};
