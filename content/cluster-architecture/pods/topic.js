window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['cluster-architecture/pods'] = {

  theory: `# Understanding Pods

## O que e um Pod?

Um **Pod** e a menor unidade implantavel no Kubernetes. Ele funciona como uma "caixinha" que contem um ou mais containers que compartilham os mesmos recursos:

- **Network namespace** — mesmo IP e espaco de portas. Containers se comunicam via \`localhost\`
- **Storage volumes** — volumes compartilhados entre containers
- **Lifecycle** — containers do Pod sao criados e destruidos juntos

> Pense no Pod como um "host logico". Containers dentro do mesmo Pod sao como processos rodando na mesma maquina.

### Diagrama: Anatomia de um Pod

\`\`\`
┌──────────────────────────────────────────────────────────┐
│                         POD                               │
│                    IP: 10.244.1.5                         │
│                                                           │
│  ┌─────────────────┐  ┌─────────────────┐                │
│  │   Container 1    │  │   Container 2    │                │
│  │   (app)          │  │   (sidecar)      │                │
│  │                  │  │                  │                │
│  │  Port: 8080      │  │  Port: 9090      │                │
│  │  localhost:9090 ──┼──│                  │                │
│  │                  │  │                  │                │
│  │  ┌────────────┐  │  │  ┌────────────┐  │                │
│  │  │VolumeMnt  │  │  │  │VolumeMnt  │  │                │
│  │  │ /app/data  │  │  │  │ /log/data  │  │                │
│  │  └─────┬──────┘  │  │  └─────┬──────┘  │                │
│  └────────┼─────────┘  └────────┼─────────┘                │
│           │                     │                          │
│  ┌────────▼─────────────────────▼──────────┐               │
│  │            Shared Volume                 │               │
│  │          (emptyDir, PVC, etc.)           │               │
│  └──────────────────────────────────────────┘               │
│                                                             │
│  ┌──────────────────────────────────────────┐               │
│  │    Pause Container (infra)               │               │
│  │    Mantem o network namespace            │               │
│  └──────────────────────────────────────────┘               │
└──────────────────────────────────────────────────────────────┘
\`\`\`

### Diagrama: Ciclo de Vida de um Pod

\`\`\`
┌────────┐   ┌──────────┐   ┌──────────┐   ┌───────────┐
│Pending │──>│  Running  │──>│Succeeded │   │  Failed   │
│        │   │          │   │(exit 0)  │   │(exit != 0)│
└────────┘   └────┬─────┘   └──────────┘   └───────────┘
                  │                              ▲
                  │  container falha             │
                  │  + restartPolicy: Never      │
                  └──────────────────────────────┘

                  │  container falha
                  │  + restartPolicy: Always
                  └──── RESTART (backoff: 10s, 20s, 40s... max 5min)
\`\`\`

| Fase | Descricao |
|------|-----------|
| Pending | Pod aceito mas containers nao iniciaram (pulling image, scheduling) |
| Running | Pelo menos 1 container rodando ou iniciando |
| Succeeded | Todos os containers terminaram com exit code 0 |
| Failed | Pelo menos 1 container terminou com erro |
| Unknown | Estado nao pode ser determinado (node inacessivel) |

---

## Anatomia Completa de um Pod

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: meu-pod
  namespace: default
  labels:
    app: nginx
    tier: frontend
  annotations:
    description: "Pod de exemplo"
spec:
  restartPolicy: Always          # Always | OnFailure | Never
  terminationGracePeriodSeconds: 30
  serviceAccountName: default
  dnsPolicy: ClusterFirst        # ClusterFirst | Default | None | ClusterFirstWithHostNet
  nodeName: ""                   # bypass scheduler (fixa no node)
  nodeSelector:                  # selecao simples de node
    disktype: ssd
  containers:
  - name: nginx
    image: nginx:1.25
    imagePullPolicy: IfNotPresent  # Always | IfNotPresent | Never
    ports:
    - containerPort: 80
      name: http
      protocol: TCP
    env:
    - name: ENV_VAR
      value: "producao"
    resources:
      requests:
        memory: "64Mi"
        cpu: "250m"
      limits:
        memory: "128Mi"
        cpu: "500m"
    volumeMounts:
    - name: dados
      mountPath: /dados
  volumes:
  - name: dados
    emptyDir:
      sizeLimit: 256Mi
\`\`\`

---

## Ciclo de Vida do Pod

### Fases (Pod Phase)

| Fase | Descricao |
|------|-----------|
| **Pending** | Pod aceito pelo cluster. Aguardando scheduling, pull de imagem ou init containers |
| **Running** | Pod vinculado a um node, pelo menos 1 container rodando ou iniciando |
| **Succeeded** | Todos containers terminaram com exit code 0 |
| **Failed** | Todos containers terminaram, pelo menos 1 com exit code != 0 |
| **Unknown** | Estado do Pod nao pode ser obtido (geralmente falha de comunicacao com node) |

### Estados do Container

Cada container dentro do Pod tem seu proprio estado:

| Estado | Descricao | Razoes comuns |
|--------|-----------|---------------|
| **Waiting** | Container aguardando | ContainerCreating, ImagePullBackOff, ErrImagePull, CrashLoopBackOff |
| **Running** | Container executando normalmente | Started |
| **Terminated** | Container encerrou | Completed (exit 0), Error (exit != 0), OOMKilled (exit 137) |

### Exit Codes Importantes

| Codigo | Significado |
|--------|-------------|
| 0 | Sucesso — container completou normalmente |
| 1 | Erro generico da aplicacao |
| 126 | Permissao negada ou comando nao executavel |
| 127 | Comando nao encontrado |
| 137 | **OOMKilled** — container excedeu limite de memoria (SIGKILL = 128+9) |
| 143 | Container recebeu SIGTERM (128+15) — encerramento graceful |

---

## Restart Policies

\`\`\`yaml
spec:
  restartPolicy: Always    # default
\`\`\`

| Policy | Comportamento | Uso tipico |
|--------|---------------|------------|
| **Always** | Reinicia sempre que o container para (default) | Deployments, DaemonSets |
| **OnFailure** | Reinicia apenas se exit code != 0 | Jobs |
| **Never** | Nunca reinicia | Jobs de execucao unica |

> **Dica de prova**: O kubelet usa backoff exponencial para restarts: 10s, 20s, 40s, 80s... ate 5min. Apos 10 min rodando com sucesso, o backoff reseta.

---

## Init Containers

Containers que executam **antes** dos containers da aplicacao. Cada init container deve completar com sucesso antes do proximo iniciar.

\`\`\`yaml
spec:
  initContainers:
  - name: wait-for-db
    image: busybox:1.36
    command: ['sh', '-c', 'until nslookup mydb.default.svc.cluster.local; do echo "esperando db..."; sleep 2; done']
  - name: init-config
    image: busybox:1.36
    command: ['sh', '-c', 'wget -O /config/app.conf http://config-server/app.conf']
    volumeMounts:
    - name: config
      mountPath: /config
  containers:
  - name: app
    image: myapp:1.0
    volumeMounts:
    - name: config
      mountPath: /config
  volumes:
  - name: config
    emptyDir: {}
\`\`\`

**Caracteristicas:**
- Executam **sequencialmente**, na ordem definida
- Se um init container falha, o kubelet reinicia ele de acordo com a restartPolicy
- Nao suportam probes (liveness/readiness)
- Podem compartilhar volumes com containers da app

**Casos de uso:**
- Esperar por dependencias (banco de dados, API externa)
- Clonar repositorio Git
- Executar migrations de banco
- Gerar configuracao dinamica

---

## Multi-Container Pods

### Padroes de Design

**Sidecar** — container auxiliar que complementa o principal:
\`\`\`yaml
containers:
- name: app
  image: myapp:1.0
  volumeMounts:
  - name: logs
    mountPath: /var/log/app
- name: log-shipper
  image: fluentd
  volumeMounts:
  - name: logs
    mountPath: /var/log/app
volumes:
- name: logs
  emptyDir: {}
\`\`\`

**Ambassador** — proxy para o mundo externo (ex: proxy de banco de dados)

**Adapter** — padroniza a saida do container principal (ex: converte metricas para formato Prometheus)

### Comunicacao entre containers

Containers no mesmo Pod:
- Compartilham rede via \`localhost\` (ex: \`localhost:8080\`)
- Compartilham volumes montados
- Compartilham IPC namespace

---

## Pod QoS Classes

O Kubernetes atribui automaticamente uma classe QoS baseada nos resources definidos:

| Classe | Criterio | Eviction Priority |
|--------|----------|-------------------|
| **Guaranteed** | Todos containers tem requests = limits (CPU e memoria) | Ultima a ser evicted |
| **Burstable** | Pelo menos 1 container tem request definido, mas != limits | Intermediaria |
| **BestEffort** | Nenhum container define requests ou limits | Primeira a ser evicted |

\`\`\`yaml
# Guaranteed: requests == limits
resources:
  requests:
    cpu: "500m"
    memory: "256Mi"
  limits:
    cpu: "500m"
    memory: "256Mi"
\`\`\`

> **Dica de prova**: Sempre defina resources para Pods em producao. BestEffort e a primeira classe a sofrer eviction quando o node esta sob pressao de recursos.

---

## Processo de Terminacao

Quando um Pod e deletado, o seguinte acontece:

1. Pod marcado como **Terminating** no API server
2. Pod removido dos **Endpoints** dos Services (para de receber trafego)
3. **preStop hook** e executado (se definido)
4. **SIGTERM** enviado ao container (processo principal, PID 1)
5. Aguarda \`terminationGracePeriodSeconds\` (default: 30s)
6. **SIGKILL** enviado se container ainda estiver rodando

\`\`\`yaml
spec:
  terminationGracePeriodSeconds: 60
  containers:
  - name: app
    lifecycle:
      preStop:
        exec:
          command: ["/bin/sh", "-c", "sleep 10 && kill -SIGTERM 1"]
\`\`\`

> **Importante**: A aplicacao DEVE tratar SIGTERM para desligar gracefully (fechar conexoes, flush de buffers, completar requests em andamento).

---

## Static Pods

Pods gerenciados diretamente pelo **kubelet**, sem o API server:

- Manifestos YAML em \`/etc/kubernetes/manifests/\`
- Kubelet monitora o diretorio e cria/recria automaticamente
- API server cria um **mirror pod** (somente leitura)
- Componentes do control plane sao static pods: etcd, kube-apiserver, kube-scheduler, kube-controller-manager

\`\`\`bash
# Verificar path dos manifests
cat /var/lib/kubelet/config.yaml | grep staticPodPath
# staticPodPath: /etc/kubernetes/manifests

# Listar static pods do control plane
ls /etc/kubernetes/manifests/
# etcd.yaml  kube-apiserver.yaml  kube-controller-manager.yaml  kube-scheduler.yaml
\`\`\`

---

## Pod DNS Policy

\`\`\`yaml
spec:
  dnsPolicy: ClusterFirst    # default
\`\`\`

| Policy | Comportamento |
|--------|---------------|
| **ClusterFirst** | Usa CoreDNS do cluster. Se nao resolver, encaminha para upstream (default) |
| **Default** | Herda configuracao DNS do node |
| **None** | Ignora tudo e usa apenas \`dnsConfig\` do Pod |
| **ClusterFirstWithHostNet** | Para pods com hostNetwork: true que ainda precisam do CoreDNS |

---

## Downward API

Expoe informacoes do Pod para os containers via env vars ou volumes:

\`\`\`yaml
env:
- name: POD_NAME
  valueFrom:
    fieldRef:
      fieldPath: metadata.name
- name: POD_IP
  valueFrom:
    fieldRef:
      fieldPath: status.podIP
- name: NODE_NAME
  valueFrom:
    fieldRef:
      fieldPath: spec.nodeName
- name: CPU_LIMIT
  valueFrom:
    resourceFieldRef:
      containerName: app
      resource: limits.cpu
\`\`\`

---

## Ephemeral Containers (Debug)

Containers temporarios adicionados a um Pod em execucao para debugging:

\`\`\`bash
# Adicionar container de debug a um pod rodando
kubectl debug -it meu-pod --image=busybox --target=nginx

# Debug com imagem completa (netshoot tem curl, dig, nslookup, etc)
kubectl debug -it meu-pod --image=nicolaka/netshoot --target=nginx
\`\`\`

---

## Comandos Essenciais

\`\`\`bash
# Criar pod rapidamente
kubectl run nginx --image=nginx:1.25

# Gerar YAML sem criar (essencial no exame!)
kubectl run nginx --image=nginx:1.25 --dry-run=client -o yaml > pod.yaml

# Criar pod com porta e labels
kubectl run nginx --image=nginx --port=80 --labels="app=web,tier=frontend"

# Listar pods
kubectl get pods                      # namespace default
kubectl get pods -A                   # todos namespaces
kubectl get pods -o wide              # com IP e Node
kubectl get pods --show-labels        # com labels
kubectl get pods -l app=nginx         # filtrar por label
kubectl get pods -o yaml              # saida YAML completa

# Detalhes e debug
kubectl describe pod nginx            # detalhes + eventos
kubectl logs nginx                    # logs do container
kubectl logs nginx -c sidecar         # logs de container especifico
kubectl logs nginx --previous         # logs do container anterior (crashado)
kubectl logs nginx -f                 # follow (tempo real)
kubectl logs nginx --since=1h         # logs da ultima hora
kubectl logs nginx --tail=50          # ultimas 50 linhas

# Executar comandos
kubectl exec nginx -- ls /             # executar comando
kubectl exec -it nginx -- /bin/bash    # shell interativo
kubectl exec -it nginx -c sidecar -- sh  # shell em container especifico

# Deletar
kubectl delete pod nginx
kubectl delete pod nginx --grace-period=0 --force  # delete forcado
\`\`\`
`,

  quiz: [
    {
      question: 'Qual e a menor unidade deployavel no Kubernetes?',
      options: ['Container', 'Pod', 'Node', 'Deployment'],
      correct: 1,
      explanation: 'O Pod e a menor unidade deployavel. Ele contem um ou mais containers que compartilham rede e storage.'
    },
    {
      question: 'O que containers dentro do mesmo Pod compartilham?',
      options: [
        'Apenas CPU e memoria',
        'Apenas o mesmo node',
        'Network namespace (IP), volumes e lifecycle',
        'Nada, sao totalmente isolados'
      ],
      correct: 2,
      explanation: 'Containers no mesmo Pod compartilham o IP (comunicam via localhost), volumes montados e o lifecycle.'
    },
    {
      question: 'Qual exit code indica que o container foi morto por exceder o limite de memoria (OOMKilled)?',
      options: ['1', '126', '137', '143'],
      correct: 2,
      explanation: 'Exit code 137 = 128 + 9 (SIGKILL). O kernel mata o processo quando excede o limite de memoria. Voce vera OOMKilled no describe pod.'
    },
    {
      question: 'Em qual fase o Pod esta quando aguarda scheduling ou pull de imagem?',
      options: ['Running', 'Pending', 'Unknown', 'Waiting'],
      correct: 1,
      explanation: 'Pending indica que o Pod foi aceito mas ainda nao esta rodando. Pode estar aguardando scheduling, pull de imagem ou init containers.'
    },
    {
      question: 'Qual Pod QoS class e a PRIMEIRA a ser evicted quando o node esta sob pressao?',
      options: ['Guaranteed', 'Burstable', 'BestEffort', 'Standard'],
      correct: 2,
      explanation: 'BestEffort (sem requests/limits definidos) e a primeira a ser evicted. Guaranteed (requests == limits) e a ultima.'
    },
    {
      question: 'Qual e a sequencia correta no processo de terminacao de um Pod?',
      options: [
        'SIGKILL > SIGTERM > preStop',
        'preStop > SIGTERM > grace period > SIGKILL',
        'SIGTERM > preStop > SIGKILL',
        'grace period > SIGTERM > preStop > SIGKILL'
      ],
      correct: 1,
      explanation: 'Ordem: preStop hook > SIGTERM ao PID 1 > aguarda terminationGracePeriodSeconds (30s default) > SIGKILL se ainda rodando.'
    },
    {
      question: 'Init containers podem executar em paralelo com os containers da aplicacao?',
      options: [
        'Sim, sempre executam em paralelo',
        'Nao, executam sequencialmente e ANTES dos containers da app',
        'Depende da configuracao',
        'Sim, mas apenas com restartPolicy: Never'
      ],
      correct: 1,
      explanation: 'Init containers executam sequencialmente, um por vez, e todos devem completar com sucesso ANTES dos containers da aplicacao iniciarem.'
    },
    {
      question: 'Onde ficam os manifestos de Static Pods do control plane?',
      options: [
        '/var/lib/kubelet/',
        '/etc/kubernetes/manifests/',
        '/opt/cni/bin/',
        '/etc/systemd/system/'
      ],
      correct: 1,
      explanation: 'Static pods sao definidos em /etc/kubernetes/manifests/ e gerenciados diretamente pelo kubelet, sem o API server.'
    },
    {
      question: 'Qual flag do kubectl gera o YAML de um pod sem cria-lo no cluster?',
      options: [
        '--output=yaml',
        '--dry-run=client -o yaml',
        '--template=yaml',
        '--generate-yaml'
      ],
      correct: 1,
      explanation: '--dry-run=client -o yaml simula a criacao e gera o YAML. Essencial no exame para gerar manifestos rapidamente.'
    },
    {
      question: 'Para ver logs de um container que crashou e foi reiniciado, qual flag usar?',
      options: [
        'kubectl logs pod --crash',
        'kubectl logs pod --previous',
        'kubectl logs pod --restart',
        'kubectl logs pod --old'
      ],
      correct: 1,
      explanation: '--previous mostra os logs da instancia anterior do container. Crucial para diagnosticar CrashLoopBackOff.'
    }
  ],

  flashcards: [
    { front: 'O que e um Pod?', back: 'Menor unidade deployavel no Kubernetes. Grupo de um ou mais containers que compartilham rede (mesmo IP, comunicam via localhost), storage (volumes) e lifecycle.' },
    { front: 'Fases do ciclo de vida do Pod', back: 'Pending (aguardando), Running (pelo menos 1 container ativo), Succeeded (todos terminaram com exit 0), Failed (pelo menos 1 com exit != 0), Unknown (comunicacao com node perdida).' },
    { front: 'Restart Policies', back: 'Always (default — reinicia sempre), OnFailure (reinicia apenas se exit code != 0), Never (nunca reinicia). Kubelet usa backoff exponencial: 10s, 20s, 40s... ate 5min.' },
    { front: 'O que sao Init Containers?', back: 'Containers que executam sequencialmente ANTES dos containers da app. Todos devem completar com sucesso. Usados para setup (esperar DB, clonar repo, migrations).' },
    { front: 'Pod QoS: Guaranteed', back: 'Todos containers tem requests = limits (CPU e memoria). Ultima classe a ser evicted. Maior prioridade em situacoes de pressao de recursos.' },
    { front: 'Pod QoS: BestEffort', back: 'Nenhum container define requests ou limits. PRIMEIRA classe a ser evicted. Nunca use em producao!' },
    { front: 'Static Pods', back: 'Gerenciados pelo kubelet diretamente (sem API server). Definidos em /etc/kubernetes/manifests/. Componentes do control plane sao static pods. API server cria mirror pods.' },
    { front: 'Terminacao do Pod', back: 'preStop hook > SIGTERM (PID 1) > grace period (default 30s) > SIGKILL. Pod e removido dos Endpoints dos Services antes.' },
    { front: 'Exit code 137', back: 'OOMKilled! Container excedeu limite de memoria. 137 = 128 + 9 (SIGKILL). Verificar com kubectl describe pod.' },
    { front: 'Exit code 143', back: 'Container recebeu SIGTERM (128 + 15). Encerramento graceful. Normal durante rollouts e scaling down.' },
    { front: 'Ephemeral Containers', back: 'kubectl debug -it pod --image=busybox --target=container. Containers temporarios adicionados a Pod em execucao para debug. Nao reiniciam.' },
    { front: 'Downward API', back: 'Expoe metadados do Pod para containers via env vars (fieldRef: metadata.name, status.podIP, spec.nodeName) ou volumes. Nao requer chamadas ao API server.' }
  ],

  lab: {
    scenario: 'Voce precisa criar, gerenciar e diagnosticar pods em um cluster Kubernetes.',
    objective: 'Dominar criacao, inspecao, configuracao e troubleshooting de Pods.',
    steps: [
      {
        title: 'Criar um Pod com YAML gerado pelo kubectl',
        instruction: 'Gere o manifesto YAML de um pod chamado \`web\` com imagem \`nginx:1.25\` sem cria-lo. Depois edite para adicionar requests (cpu: 100m, memory: 64Mi) e limits (cpu: 200m, memory: 128Mi). Aplique o YAML.',
        hints: [
          'Use kubectl run com --dry-run=client -o yaml para gerar o YAML.',
          'kubectl run web --image=nginx:1.25 --dry-run=client -o yaml > web.yaml',
          'Edite web.yaml para adicionar resources e use kubectl apply -f web.yaml'
        ],
        solution: '```bash\n# Gerar YAML\nkubectl run web --image=nginx:1.25 --dry-run=client -o yaml > web.yaml\n\n# Editar para adicionar resources e aplicar\nkubectl apply -f web.yaml\n\n# Verificar\nkubectl get pod web -o wide\nkubectl describe pod web\n```'
      },
      {
        title: 'Pod multi-container com volume compartilhado',
        instruction: 'Crie um pod chamado \`multi\` com dois containers: \`app\` (nginx) e \`sidecar\` (busybox com command sleep 3600). Ambos devem compartilhar um volume emptyDir montado em /shared.',
        hints: [
          'Defina dois containers no array spec.containers.',
          'Crie um volume emptyDir e monte em ambos containers.',
          'O busybox precisa de command: ["sleep", "3600"] para nao sair imediatamente.'
        ],
        solution: '```yaml\napiVersion: v1\nkind: Pod\nmetadata:\n  name: multi\nspec:\n  containers:\n  - name: app\n    image: nginx\n    volumeMounts:\n    - name: shared\n      mountPath: /shared\n  - name: sidecar\n    image: busybox\n    command: ["sleep", "3600"]\n    volumeMounts:\n    - name: shared\n      mountPath: /shared\n  volumes:\n  - name: shared\n    emptyDir: {}\n```'
      },
      {
        title: 'Pod com Init Container',
        instruction: 'Crie um pod chamado \`init-demo\` com um init container que cria um arquivo /workdir/index.html com conteudo "Pronto!" e um container nginx que serve esse arquivo.',
        hints: [
          'O init container pode ser um busybox com command que faz echo > arquivo.',
          'Use um emptyDir compartilhado entre init container e container principal.',
          'Monte o volume em /usr/share/nginx/html no container nginx.'
        ],
        solution: '```yaml\napiVersion: v1\nkind: Pod\nmetadata:\n  name: init-demo\nspec:\n  initContainers:\n  - name: setup\n    image: busybox\n    command: [\"sh\", \"-c\", \"echo Pronto! > /workdir/index.html\"]\n    volumeMounts:\n    - name: workdir\n      mountPath: /workdir\n  containers:\n  - name: nginx\n    image: nginx\n    volumeMounts:\n    - name: workdir\n      mountPath: /usr/share/nginx/html\n  volumes:\n  - name: workdir\n    emptyDir: {}\n```'
      },
      {
        title: 'Inspecionar Pod e verificar QoS',
        instruction: 'Verifique a classe QoS do pod \`web\` criado no passo 1. Depois, crie um pod \`best-effort\` sem definir nenhum resource e compare as classes QoS.',
        hints: [
          'Use kubectl get pod <name> -o yaml e procure por qosClass em status.',
          'kubectl get pod web -o jsonpath=\'{.status.qosClass}\'',
          'O pod sem resources tera QoS BestEffort.'
        ],
        solution: '```bash\n# Verificar QoS do pod web (deve ser Burstable)\nkubectl get pod web -o jsonpath=\'{.status.qosClass}\'\n\n# Criar pod sem resources\nkubectl run best-effort --image=nginx\n\n# Verificar QoS (deve ser BestEffort)\nkubectl get pod best-effort -o jsonpath=\'{.status.qosClass}\'\n```'
      },
      {
        title: 'Diagnosticar pod com CrashLoopBackOff',
        instruction: 'Crie um pod chamado \`crashing\` com imagem busybox e command ["exit", "1"]. Observe o CrashLoopBackOff e investigue usando logs e describe.',
        hints: [
          'kubectl run crashing --image=busybox --command -- exit 1',
          'Use kubectl describe pod e kubectl logs --previous.'
        ],
        solution: '```bash\n# Criar pod que crasha\nkubectl run crashing --image=busybox --command -- /bin/sh -c \"exit 1\"\n\n# Observar CrashLoopBackOff\nkubectl get pods -w\n\n# Investigar\nkubectl describe pod crashing\nkubectl logs crashing --previous\n\n# Ver eventos\nkubectl get events --field-selector involvedObject.name=crashing\n\n# Limpar\nkubectl delete pod crashing\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Pod em ImagePullBackOff',
      symptom: 'Pod permanece em status ImagePullBackOff ou ErrImagePull. Container nunca inicia.',
      diagnosis: '```bash\nkubectl describe pod <nome>\n# Procurar na secao Events por:\n# Failed to pull image "nginx:inexistente": rpc error: code = NotFound\n# Back-off pulling image "nginx:inexistente"\n\n# Verificar o nome da imagem\nkubectl get pod <nome> -o jsonpath=\'{.spec.containers[0].image}\'\n```',
      solution: 'Causas comuns:\n1. **Nome ou tag errados**: verificar ortografia (nginx vs ngingx, latest vs lastest)\n2. **Imagem privada sem imagePullSecrets**: adicionar secret do registry\n3. **Registry inacessivel**: verificar conectividade de rede\n4. **Rate limit do Docker Hub**: usar mirror ou registry privado\n\n```bash\n# Corrigir imagem\nkubectl set image pod/<nome> <container>=<imagem-correta>\n\n# Para registries privados\nkubectl create secret docker-registry regcred --docker-server=<url> --docker-username=<user> --docker-password=<pass>\n```'
    },
    {
      title: 'Pod em CrashLoopBackOff',
      symptom: 'Pod reinicia repetidamente. Status mostra CrashLoopBackOff com contagem de restarts crescente.',
      diagnosis: '```bash\n# Ver estado detalhado\nkubectl describe pod <nome>\n# Procurar: Last State, Exit Code, Reason\n\n# Logs do container atual e anterior\nkubectl logs <nome>\nkubectl logs <nome> --previous\n\n# Exit codes:\n# 0 = sucesso (container nao deveria parar? Verifique restartPolicy)\n# 1 = erro da app (verifique logs)\n# 137 = OOMKilled (aumente limits de memoria)\n# 127 = comando nao encontrado\n```',
      solution: 'Solucoes por causa:\n\n1. **OOMKilled (exit 137)**: Aumente memory limits\n2. **Erro da app (exit 1)**: Corrija a aplicacao ou configuracao\n3. **Comando nao encontrado (exit 127)**: Verifique command/args do container\n4. **Liveness probe falhando**: Ajuste probe ou corrija o endpoint\n5. **ConfigMap/Secret ausente**: Verifique que recursos referenciados existem\n\n```bash\n# Se OOMKilled, aumente memoria\nkubectl set resources pod/<nome> -c <container> --limits=memory=512Mi\n```'
    },
    {
      title: 'Pod preso em Pending',
      symptom: 'Pod permanece em status Pending indefinidamente. Nenhum container e criado.',
      diagnosis: '```bash\n# Verificar eventos\nkubectl describe pod <nome>\n# Procurar na secao Events:\n# FailedScheduling: 0/3 nodes are available\n# Insufficient cpu/memory\n# node(s) didnt match node selector\n# node(s) had taint that the pod didnt tolerate\n\n# Verificar recursos disponiveis nos nodes\nkubectl describe nodes | grep -A5 \"Allocated resources\"\n\n# Verificar se PVC existe (se usa volume persistente)\nkubectl get pvc\n```',
      solution: 'Causas e solucoes:\n\n1. **Recursos insuficientes**: Reduza requests ou adicione nodes\n2. **nodeSelector nao corresponde**: Verifique labels dos nodes\n3. **Taint sem toleration**: Adicione toleration ao Pod\n4. **PVC pendente**: Verifique se PV ou StorageClass existe\n5. **Quota excedida**: Verifique ResourceQuota do namespace\n\n```bash\n# Verificar taints dos nodes\nkubectl describe nodes | grep Taints\n\n# Verificar quotas\nkubectl get resourcequota -n <namespace>\n```'
    }
  ]
};
