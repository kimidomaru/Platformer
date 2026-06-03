window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['troubleshooting/app-failure'] = {

  theory: `# Application Failure Troubleshooting

## Importancia

O dominio de Troubleshooting representa **30% do exame CKA** — o maior peso entre todos os dominios. A habilidade de diagnosticar e resolver problemas rapidamente e fundamental tanto para a prova quanto para o dia a dia.

---

## Metodologia Sistematica de Troubleshooting

Quando uma aplicacao falha, siga esta ordem do **mais especifico ao mais generico**:

### Diagrama: Fluxo de Troubleshooting

\`\`\`
┌─────────────────────────────────────────────────────────────┐
│              FLUXO DE TROUBLESHOOTING                        │
│                                                              │
│  ┌────────┐    ┌───────────┐    ┌──────────┐    ┌────────┐  │
│  │  Pod   │───>│ Container │───>│ Service  │───>│Ingress │  │
│  │Status? │    │ Logs?     │    │Endpoints?│    │Rules?  │  │
│  └───┬────┘    └─────┬─────┘    └────┬─────┘    └───┬────┘  │
│      │               │              │               │        │
│      ▼               ▼              ▼               ▼        │
│  Pending?        Error?         Nenhum EP?     Backend?      │
│  → Scheduler     → App bug     → Labels errados → Service   │
│  → Resources     → Config      → Pod NotReady     mismatch  │
│  → Image Pull    → Deps                                     │
│                                                              │
│  CrashLoop?      OOM?          Porta errada?   TLS?         │
│  → Probe fail    → Limits      → targetPort     → Secret    │
│  → Exit code     → Memory leak                  → Cert      │
│                                                              │
│  ┌────────┐    ┌───────────┐                                │
│  │  Node  │───>│  Cluster  │                                │
│  │Ready?  │    │Components?│                                │
│  └───┬────┘    └─────┬─────┘                                │
│      │               │                                       │
│      ▼               ▼                                       │
│  NotReady?       API Server?                                │
│  → kubelet       → etcd                                     │
│  → Runtime       → Certificates                             │
│  → Network       → DNS (CoreDNS)                            │
└─────────────────────────────────────────────────────────────┘
\`\`\`

\`\`\`
Pod → Container → Service → Ingress → Node → Cluster
\`\`\`

### Passo 1: Verificar o status do Pod

\`\`\`bash
# Visao geral
kubectl get pods -o wide
kubectl get pods -l app=minha-app -o wide

# Saida esperada com problemas:
# NAME        READY   STATUS             RESTARTS   AGE
# api-pod     0/1     CrashLoopBackOff   5          3m
# web-pod     0/1     ImagePullBackOff   0          1m
# db-pod      0/1     Pending            0          5m
\`\`\`

### Passo 2: Descrever o Pod (eventos)

\`\`\`bash
kubectl describe pod <nome>
# Focar na secao Events no final:
# Events:
#   Type     Reason     Age   Message
#   ----     ------     ---   -------
#   Warning  Failed     30s   Error: ImagePullBackOff
#   Warning  BackOff    15s   Back-off restarting failed container
\`\`\`

### Passo 3: Verificar logs

\`\`\`bash
# Logs do container atual
kubectl logs <pod>

# Logs do container que crashou (ESSENCIAL para CrashLoopBackOff)
kubectl logs <pod> --previous

# Logs de container especifico (multi-container pod)
kubectl logs <pod> -c <container>

# Ultimas N linhas
kubectl logs <pod> --tail=100

# Logs em tempo real
kubectl logs <pod> -f

# Logs desde um periodo
kubectl logs <pod> --since=30m
kubectl logs <pod> --since-time=2024-01-01T00:00:00Z

# Logs de todos containers do pod
kubectl logs <pod> --all-containers=true
\`\`\`

### Passo 4: Verificar eventos do cluster

\`\`\`bash
# Todos eventos recentes
kubectl get events --sort-by=.lastTimestamp

# Eventos de um pod especifico
kubectl get events --field-selector involvedObject.name=<pod>

# Eventos do namespace
kubectl get events -n <namespace> --sort-by=.metadata.creationTimestamp
\`\`\`

### Passo 5: Verificar Service/Endpoints

\`\`\`bash
# Service tem endpoints?
kubectl get endpoints <svc>

# Labels batem?
kubectl get pods --show-labels
kubectl describe svc <svc>

# Testar conectividade de dentro do cluster
kubectl run test --image=busybox:1.36 --rm -it --restart=Never -- \\
  wget -qO- --timeout=5 http://<svc>:<port>
\`\`\`

---

## Todos os Status de Erro e Diagnostico Detalhado

### CrashLoopBackOff

Container inicia e crasha repetidamente. Kubelet usa **backoff exponencial**: 10s, 20s, 40s, 80s... ate 5 minutos entre restarts. Apos 10 min rodando com sucesso, o backoff reseta.

\`\`\`bash
# Diagnostico
kubectl describe pod <nome>
# Procurar: Last State, Exit Code, Reason

kubectl logs <nome> --previous
# Ver o erro que causou o crash
\`\`\`

**Causas por Exit Code:**

| Exit Code | Causa | Solucao |
|-----------|-------|---------|
| 0 | Container terminou com sucesso mas restartPolicy=Always | Usar restartPolicy: OnFailure ou mudar command para processo que nao termina |
| 1 | Erro generico da aplicacao | Verificar logs, corrigir codigo ou configuracao |
| 126 | Permissao negada | Verificar securityContext, corrigir permissoes |
| 127 | Comando nao encontrado | Verificar command/args do container, imagem errada? |
| 137 | **OOMKilled** (128+9 SIGKILL) | Aumentar resources.limits.memory |
| 143 | SIGTERM (128+15) | Normal durante shutdown, verificar se preStop hook esta correto |

**Outras causas de CrashLoopBackOff:**
- Liveness probe muito agressiva (initialDelaySeconds muito baixo)
- Dependencia nao disponivel (banco de dados, API externa)
- Porta ja em uso por outro container no Pod
- ConfigMap ou Secret montado como volume nao existe

### ImagePullBackOff / ErrImagePull

\`\`\`bash
# Verificar nome exato da imagem
kubectl describe pod <nome> | grep -i "image"
kubectl get pod <nome> -o jsonpath='{.spec.containers[0].image}'

# Verificar eventos
kubectl describe pod <nome>
# Failed to pull image "nginx:inexistente": rpc error: code = NotFound
\`\`\`

| Causa | Diagnostico | Solucao |
|-------|-------------|---------|
| Nome/tag errados | Verificar ortografia | Corrigir com kubectl set image |
| Registry privado | Sem imagePullSecrets | Criar Secret docker-registry |
| Rate limit Docker Hub | Too Many Requests nos eventos | Usar registry mirror ou login |
| Registry inacessivel | Timeout nos eventos | Verificar DNS e rede do node |

\`\`\`bash
# Corrigir imagem
kubectl set image pod/<pod> <container>=<imagem-correta>

# Para registry privado
kubectl create secret docker-registry regcred \\
  --docker-server=registry.example.com \\
  --docker-username=user \\
  --docker-password=pass

# Adicionar ao pod spec:
# imagePullSecrets:
# - name: regcred
\`\`\`

### CreateContainerConfigError

Container nao consegue iniciar por configuracao invalida.

\`\`\`bash
kubectl describe pod <nome>
# Error: configmap "app-config" not found
# Error: secret "db-credentials" not found
\`\`\`

**Solucao:** Criar o ConfigMap/Secret ausente ou marcar como optional:

\`\`\`yaml
env:
- name: DB_HOST
  valueFrom:
    configMapKeyRef:
      name: app-config
      key: database_host
      optional: true    # Pod inicia mesmo sem o ConfigMap
\`\`\`

### Pod Pending

Pod nunca e alocado a um node. Container nao e criado.

\`\`\`bash
kubectl describe pod <nome>
# FailedScheduling: 0/3 nodes are available:
# 1 Insufficient cpu, 2 Insufficient memory
# OR: 3 node(s) had taints that the pod didn't tolerate
# OR: 0/3 nodes are available: 3 node(s) didn't match Pod's node affinity
# OR: pod has unbound immediate PersistentVolumeClaims
\`\`\`

| Causa | Diagnostico | Solucao |
|-------|-------------|---------|
| Recursos insuficientes | "Insufficient cpu/memory" | Reduzir requests ou adicionar nodes |
| Taints sem tolerations | "had taints that pod didn't tolerate" | Adicionar toleration ao Pod |
| Node affinity sem match | "didn't match node affinity" | Corrigir labels dos nodes ou affinity do Pod |
| PVC nao bound | "unbound PersistentVolumeClaims" | Criar PV ou verificar StorageClass |
| ResourceQuota excedida | "exceeded quota" | Liberar recursos ou aumentar quota |

\`\`\`bash
# Verificar recursos dos nodes
kubectl describe nodes | grep -A 10 "Allocated resources"
kubectl top nodes

# Verificar taints
kubectl describe nodes | grep Taints

# Verificar PVCs
kubectl get pvc

# Verificar quotas
kubectl get resourcequota -n <namespace>
\`\`\`

### Pod Terminating (preso)

Pod nao sai do status Terminating.

\`\`\`bash
# Verificar se tem finalizers
kubectl get pod <nome> -o jsonpath='{.metadata.finalizers}'

# Verificar preStop hook
kubectl get pod <nome> -o jsonpath='{.spec.containers[0].lifecycle}'

# Forccar delete (ultimo recurso)
kubectl delete pod <nome> --grace-period=0 --force
\`\`\`

**Causas:**
- Finalizers que nao completam
- preStop hook demorado
- Node desconectado (Pod fica Terminating ate node voltar ou timeout)
- Container ignorando SIGTERM

---

## Debugging Avancado

### kubectl debug (Ephemeral Containers)

\`\`\`bash
# Adicionar container de debug a pod rodando
kubectl debug -it <pod> --image=busybox:1.36 --target=<container>

# Debug com imagem completa de rede
kubectl debug -it <pod> --image=nicolaka/netshoot --target=<container>

# Criar copia do pod para debug (sem afetar o original)
kubectl debug <pod> --copy-to=debug-pod --container=debug --image=busybox -it
\`\`\`

### Verificar conectividade Service

\`\`\`bash
# Criar pod temporario para teste
kubectl run test --image=busybox:1.36 --rm -it --restart=Never -- sh

# Dentro do pod:
wget -qO- http://meu-service:80          # testar HTTP
nslookup meu-service                      # testar DNS
nslookup meu-service.default.svc.cluster.local  # FQDN
\`\`\`

### Diagnosticar Resource Exhaustion

\`\`\`bash
# Ver consumo real vs limites
kubectl top pods
kubectl top nodes

# Pods com mais restarts (possiveis problemas)
kubectl get pods --sort-by='.status.containerStatuses[0].restartCount'

# Pods OOMKilled
kubectl get pods -o jsonpath='{range .items[*]}{.metadata.name}{"\\t"}{.status.containerStatuses[0].lastState.terminated.reason}{"\\n"}{end}' | grep OOMKilled
\`\`\`

---

## Checklist de Troubleshooting Rapido

| Verificacao | Comando |
|-------------|---------|
| Pod esta running? | \`kubectl get pods\` |
| Imagem correta? | \`kubectl describe pod <nome> \\| grep Image\` |
| Logs mostram erro? | \`kubectl logs <pod> [--previous]\` |
| Eventos? | \`kubectl get events --field-selector involvedObject.name=<pod>\` |
| Recursos suficientes? | \`kubectl describe nodes \\| grep -A5 Allocated\` |
| ConfigMaps/Secrets existem? | \`kubectl get cm,secret -n <ns>\` |
| Service tem endpoints? | \`kubectl get endpoints <svc>\` |
| Labels batem? | \`kubectl get pods --show-labels\` |
| Network Policy bloqueando? | \`kubectl get netpol -n <ns>\` |
| DNS funcionando? | \`kubectl run test --image=busybox --rm -it -- nslookup <svc>\` |
| Permissao RBAC? | \`kubectl auth can-i <verb> <resource>\` |
`,

  quiz: [
    {
      question: 'Um pod esta em CrashLoopBackOff. Qual comando mostra os logs do container que crashou anteriormente?',
      options: [
        'kubectl logs <pod> --all',
        'kubectl logs <pod> --previous',
        'kubectl logs <pod> --crashed',
        'kubectl describe pod <pod>'
      ],
      correct: 1,
      explanation: 'A flag --previous mostra os logs da instancia anterior do container. Essencial para diagnosticar CrashLoopBackOff.'
    },
    {
      question: 'Qual exit code indica que o container foi morto por exceder o limite de memoria?',
      options: ['1', '126', '127', '137'],
      correct: 3,
      explanation: 'Exit code 137 = 128 + 9 (SIGKILL). O kernel mata o processo quando excede o limite de memoria (OOMKilled).'
    },
    {
      question: 'Um pod esta Pending com evento "0/3 nodes are available: 3 node(s) had taints that the pod didnt tolerate". Qual a solucao?',
      options: [
        'Aumentar resources requests',
        'Adicionar tolerations ao Pod ou remover taints dos nodes',
        'Criar mais namespaces',
        'Instalar o metrics-server'
      ],
      correct: 1,
      explanation: 'Taints impedem scheduling. A solucao e adicionar tolerations correspondentes ao Pod ou remover os taints desnecessarios dos nodes.'
    },
    {
      question: 'Como verificar se um Service esta corretamente conectado aos Pods?',
      options: [
        'kubectl get svc',
        'kubectl get endpoints <svc>',
        'kubectl describe nodes',
        'kubectl top pods'
      ],
      correct: 1,
      explanation: 'kubectl get endpoints mostra os IPs dos pods vinculados ao Service. Se vazio, os labels dos pods nao batem com o selector.'
    },
    {
      question: 'O que causa o status CreateContainerConfigError?',
      options: [
        'Imagem corrompida',
        'ConfigMap ou Secret referenciado nao existe no namespace',
        'Porta ja em uso',
        'Node sem espaco em disco'
      ],
      correct: 1,
      explanation: 'CreateContainerConfigError indica que um ConfigMap ou Secret referenciado pelo Pod nao foi encontrado no namespace.'
    },
    {
      question: 'Qual e o intervalo do backoff exponencial do kubelet para reiniciar containers?',
      options: [
        '5s, 10s, 15s, 20s...',
        '10s, 20s, 40s, 80s... ate 5 minutos',
        '30s fixo',
        '1min, 2min, 5min, 10min...'
      ],
      correct: 1,
      explanation: 'O kubelet usa backoff exponencial: 10s, 20s, 40s, 80s, 160s, 300s (5min max). Reseta apos container rodar 10min com sucesso.'
    },
    {
      question: 'Qual comando permite adicionar um container de debug a um Pod em execucao?',
      options: [
        'kubectl exec -it <pod> -- sh',
        'kubectl debug -it <pod> --image=busybox --target=<container>',
        'kubectl attach <pod> --debug',
        'kubectl inspect <pod> --debug'
      ],
      correct: 1,
      explanation: 'kubectl debug cria um ephemeral container dentro do Pod rodando, permitindo debug com ferramentas extras sem alterar o Pod original.'
    },
    {
      question: 'Um pod fica preso em Terminating. Qual comando forca a remocao?',
      options: [
        'kubectl delete pod <nome> --now',
        'kubectl delete pod <nome> --grace-period=0 --force',
        'kubectl remove pod <nome> --force',
        'kubectl kill pod <nome>'
      ],
      correct: 1,
      explanation: '--grace-period=0 --force forca a remocao imediata. Use como ultimo recurso, pois pode deixar recursos orfaos.'
    },
    {
      question: 'Qual a PRIMEIRA verificacao ao diagnosticar uma aplicacao que nao responde?',
      options: [
        'Verificar Network Policies',
        'Verificar o status do Pod com kubectl get pods',
        'Verificar os nodes',
        'Reiniciar o cluster'
      ],
      correct: 1,
      explanation: 'Sempre comece verificando o estado do Pod. Se nao esta Running, nenhuma outra verificacao de rede ou service faz sentido.'
    },
    {
      question: 'Exit code 127 indica qual problema?',
      options: [
        'Permissao negada',
        'Sem memoria',
        'Comando nao encontrado no container',
        'Timeout de rede'
      ],
      correct: 2,
      explanation: 'Exit code 127 = comando nao encontrado. Geralmente indica que o command/args no manifesto esta errado ou a imagem nao contem o binario especificado.'
    }
  ],

  flashcards: [
    { front: 'Metodologia de troubleshooting', back: 'Pod > Container > Service > Ingress > Node > Cluster. Comece sempre com kubectl get pods, depois describe, logs, events.' },
    { front: 'CrashLoopBackOff', back: 'Container inicia e crasha repetidamente. Kubelet usa backoff exponencial (10s, 20s, 40s... ate 5min). Reseta apos 10min rodando. Use kubectl logs --previous.' },
    { front: 'Exit Code 137 (OOMKilled)', back: '128 + 9 (SIGKILL). Container excedeu limits.memory. Kernel mata o processo. Solucao: aumentar memory limits ou otimizar consumo da app.' },
    { front: 'Exit Code 143', back: '128 + 15 (SIGTERM). Container recebeu sinal de encerramento graceful. Normal durante rollouts, scaling down ou delete.' },
    { front: 'Exit Code 127', back: 'Comando nao encontrado. Command/args incorretos no manifesto ou binario nao existe na imagem.' },
    { front: 'ImagePullBackOff — causas', back: 'Imagem/tag errados, registry privado sem imagePullSecrets, rate limit do Docker Hub, registry inacessivel pela rede.' },
    { front: 'Pod Pending — causas', back: 'Recursos insuficientes, taints sem tolerations, nodeSelector/affinity sem match, PVC nao bound, ResourceQuota excedida.' },
    { front: 'CreateContainerConfigError', back: 'ConfigMap ou Secret referenciado no Pod nao existe no namespace. Solucao: criar o recurso ou marcar como optional: true.' },
    { front: 'kubectl debug (Ephemeral Containers)', back: 'kubectl debug -it <pod> --image=busybox --target=<container>. Adiciona container temporario para debug sem reiniciar o Pod.' },
    { front: 'Pod Terminating preso', back: 'Causas: finalizers pendentes, preStop hook demorado, node desconectado. Ultimo recurso: kubectl delete pod --grace-period=0 --force.' },
    { front: 'Testar conectividade dentro do cluster', back: 'kubectl run test --image=busybox:1.36 --rm -it --restart=Never -- wget -qO- http://<svc>:<port>' },
    { front: 'Service sem Endpoints', back: 'Labels dos Pods nao batem com selector do Service. Verificar com kubectl get pods --show-labels e kubectl describe svc.' }
  ],

  lab: {
    scenario: 'Voce e o engenheiro de plantao e recebeu alertas de que varias aplicacoes estao com problemas no cluster de producao. Precisa diagnosticar e resolver cada situacao.',
    objective: 'Aplicar a metodologia sistematica de troubleshooting para resolver falhas reais de aplicacao.',
    steps: [
      {
        title: 'Diagnosticar CrashLoopBackOff por OOMKilled',
        instruction: 'Crie um pod que exceda o limite de memoria e diagnostique o problema. Use a imagem \`polinux/stress\` com command ["stress", "--vm", "1", "--vm-bytes", "200M"] e defina memory limit de 100Mi.',
        hints: [
          'Crie o pod via YAML com resources.limits.memory: 100Mi.',
          'Observe o pod entrar em CrashLoopBackOff com kubectl get pods -w.',
          'Use kubectl describe pod para encontrar OOMKilled.'
        ],
        solution: '```yaml\napiVersion: v1\nkind: Pod\nmetadata:\n  name: stress-test\nspec:\n  containers:\n  - name: stress\n    image: polinux/stress\n    command: ["stress", "--vm", "1", "--vm-bytes", "200M"]\n    resources:\n      limits:\n        memory: "100Mi"\n```\n\n```bash\nkubectl apply -f stress.yaml\nkubectl get pods -w\nkubectl describe pod stress-test\n# Procurar: Reason: OOMKilled, Exit Code: 137\n\n# Solucao: aumentar o limite\nkubectl delete pod stress-test\n# Editar YAML: memory: "256Mi"\nkubectl apply -f stress.yaml\n```'
      },
      {
        title: 'Resolver ImagePullBackOff',
        instruction: 'Crie um pod com imagem \`nginx:versao-inexistente\` e resolva o problema.',
        hints: [
          'kubectl run web --image=nginx:versao-inexistente',
          'Use kubectl describe pod para ver o erro exato.',
          'Corrija com kubectl set image.'
        ],
        solution: '```bash\n# Criar pod com imagem errada\nkubectl run web --image=nginx:versao-inexistente\n\n# Verificar\nkubectl get pods\nkubectl describe pod web | grep -A5 Events\n# Failed to pull image "nginx:versao-inexistente"\n\n# Corrigir\nkubectl set image pod/web web=nginx:1.25\n\n# Verificar resolucao\nkubectl get pods -w\n```'
      },
      {
        title: 'Diagnosticar CreateContainerConfigError',
        instruction: 'Crie um pod que referencia um ConfigMap inexistente como variavel de ambiente. Diagnostique e resolva.',
        hints: [
          'Crie um pod com env.valueFrom.configMapKeyRef apontando para ConfigMap que nao existe.',
          'Use kubectl describe para ver CreateContainerConfigError.',
          'Crie o ConfigMap ausente para resolver.'
        ],
        solution: '```yaml\napiVersion: v1\nkind: Pod\nmetadata:\n  name: config-test\nspec:\n  containers:\n  - name: app\n    image: nginx\n    env:\n    - name: DB_HOST\n      valueFrom:\n        configMapKeyRef:\n          name: app-config\n          key: database_host\n```\n\n```bash\nkubectl apply -f config-test.yaml\nkubectl get pods\n# Status: CreateContainerConfigError\n\n# Criar o ConfigMap ausente\nkubectl create configmap app-config --from-literal=database_host=db.example.com\n\n# Pod deve iniciar automaticamente\nkubectl get pods -w\n```'
      },
      {
        title: 'Service sem conectividade (labels erradas)',
        instruction: 'Crie um deployment \`backend\` com label app=backend e um Service apontando para app=back-end (note o hifen). Diagnostique por que o Service nao responde.',
        hints: [
          'Verifique endpoints com kubectl get endpoints.',
          'Compare labels do pod com selector do service.',
          'Corrija o selector ou as labels.'
        ],
        solution: '```bash\n# Criar deployment\nkubectl create deployment backend --image=nginx --replicas=2\n\n# Criar service com selector errado\nkubectl expose deployment backend --port=80 --name=backend-svc\n# Editar service para ter selector errado:\nkubectl edit svc backend-svc\n# Mudar selector para app: back-end (com hifen)\n\n# Diagnosticar\nkubectl get endpoints backend-svc\n# <none> - sem endpoints!\n\nkubectl describe svc backend-svc | grep Selector\n# Selector: app=back-end\n\nkubectl get pods --show-labels\n# Labels: app=backend (sem hifen)\n\n# Corrigir: editar o service ou as labels\nkubectl edit svc backend-svc\n# Corrigir selector para app: backend\n\n# Verificar\nkubectl get endpoints backend-svc\n# Agora deve mostrar IPs dos pods\n```'
      },
      {
        title: 'Debug com ephemeral container',
        instruction: 'Crie um pod nginx e use kubectl debug para verificar se o curl funciona de dentro do pod e testar resolucao DNS.',
        hints: [
          'Use kubectl debug -it com imagem nicolaka/netshoot.',
          'Dentro do container de debug, use curl e nslookup.'
        ],
        solution: '```bash\n# Criar pod\nkubectl run webserver --image=nginx\n\n# Criar service\nkubectl expose pod webserver --port=80\n\n# Debug com netshoot\nkubectl debug -it webserver --image=nicolaka/netshoot --target=nginx\n\n# Dentro do container de debug:\ncurl localhost:80\nnslookup webserver.default.svc.cluster.local\nnslookup kubernetes.default.svc.cluster.local\ndig webserver.default.svc.cluster.local\nexit\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Pod em CrashLoopBackOff com exit code variado',
      symptom: 'Pod reinicia constantemente. Status mostra CrashLoopBackOff com restart count crescente. Intervalo entre restarts aumenta (backoff exponencial).',
      diagnosis: '```bash\n# 1. Ver estado e exit code\nkubectl describe pod <nome>\n# Procurar: Last State > Terminated > Exit Code e Reason\n\n# 2. Ver logs do crash\nkubectl logs <nome> --previous\n\n# 3. Se logs vazios, verificar command/args\nkubectl get pod <nome> -o jsonpath=\'{.spec.containers[0].command}\'\n```\n\n**Diagnostico por Exit Code:**\n- **Exit 0 + CrashLoop**: Container termina com sucesso mas restartPolicy=Always reinicia\n- **Exit 1**: Erro na aplicacao (ver logs)\n- **Exit 127**: Comando nao encontrado\n- **Exit 137**: OOMKilled (memoria excedida)\n- **Exit 139**: Segfault (bug no binario)',
      solution: '**Por causa:**\n\n1. **Exit 0**: Usar restartPolicy: OnFailure, ou ajustar command para processo que roda continuamente\n2. **Exit 1**: Corrigir erro na app, verificar variaveis de ambiente e configuracoes\n3. **Exit 127**: Corrigir command/args, verificar se imagem contem o binario\n4. **Exit 137**: Aumentar resources.limits.memory\n5. **Liveness probe**: Aumentar initialDelaySeconds ou ajustar thresholds'
    },
    {
      title: 'Aplicacao nao acessivel via Service',
      symptom: 'Service existe, pod esta Running, mas a aplicacao nao responde quando acessada via Service. Timeout ou connection refused.',
      diagnosis: '```bash\n# 1. Verificar endpoints\nkubectl get endpoints <svc>\n# Se vazio: problema de labels/selectors\n# Se tem IPs: problema no pod ou porta\n\n# 2. Verificar selector vs labels\nkubectl describe svc <svc> | grep Selector\nkubectl get pods --show-labels\n\n# 3. Verificar portas\nkubectl describe svc <svc> | grep -E \"Port|TargetPort\"\nkubectl get pod <pod> -o jsonpath=\'{.spec.containers[0].ports}\'\n\n# 4. Testar diretamente no pod IP\nkubectl get pod <pod> -o wide\nkubectl run test --rm -it --image=busybox -- wget -qO- http://<pod-ip>:<port>\n\n# 5. Verificar Network Policy\nkubectl get netpol -n <namespace>\n```',
      solution: '**Causas e solucoes:**\n\n1. **Endpoints vazio**: Labels dos pods nao batem com selector. Corrigir labels ou selector.\n2. **TargetPort errado**: targetPort do Service deve bater com containerPort do Pod.\n3. **App nao esta escutando**: Verificar se app escuta na porta correta e em 0.0.0.0 (nao localhost).\n4. **Network Policy bloqueando**: Verificar regras de ingress/egress.\n5. **Readiness probe falhando**: Pod Running mas nao Ready = nao entra nos Endpoints.'
    },
    {
      title: 'Pod Pending por recursos insuficientes',
      symptom: 'Pod permanece Pending. Eventos mostram "0/N nodes are available: Insufficient cpu" ou "Insufficient memory".',
      diagnosis: '```bash\n# 1. Ver eventos\nkubectl describe pod <nome>\n\n# 2. Ver alocacao dos nodes\nkubectl describe nodes | grep -A 10 \"Allocated resources\"\n\n# 3. Ver metricas reais\nkubectl top nodes\nkubectl top pods -A --sort-by=memory\n\n# 4. Verificar ResourceQuota\nkubectl get resourcequota -n <namespace>\nkubectl describe resourcequota -n <namespace>\n\n# 5. Verificar LimitRange\nkubectl get limitrange -n <namespace>\n```',
      solution: '**Solucoes em ordem de preferencia:**\n\n1. **Reduzir requests** do pod (se estiverem superdimensionados)\n2. **Remover pods desnecessarios** para liberar recursos\n3. **Adicionar nodes** ao cluster\n4. **Aumentar ResourceQuota** do namespace\n5. **Usar PriorityClass** para que pods importantes tenham prioridade'
    },
    {
      title: 'Pod preso em Terminating',
      symptom: 'Apos kubectl delete, o pod permanece em Terminating por muito tempo sem ser removido.',
      diagnosis: '```bash\n# 1. Verificar finalizers\nkubectl get pod <nome> -o jsonpath=\'{.metadata.finalizers}\'\n\n# 2. Verificar grace period restante\nkubectl get pod <nome> -o jsonpath=\'{.metadata.deletionGracePeriodSeconds}\'\n\n# 3. Verificar se node esta saudavel\nkubectl get nodes\n\n# 4. Ver se container ainda roda\nkubectl describe pod <nome>\n```',
      solution: '**Causas e solucoes:**\n\n1. **Finalizers pendentes**: Remover manualmente se necessario\n   ```bash\n   kubectl patch pod <nome> -p \'{\"metadata\":{\"finalizers\":null}}\'\n   ```\n2. **Node desconectado**: Pod so sera removido quando node voltar ou timeout\n3. **preStop hook demorado**: Esperar ou forcar delete\n4. **Force delete** (ultimo recurso):\n   ```bash\n   kubectl delete pod <nome> --grace-period=0 --force\n   ```'
    }
  ]
};
