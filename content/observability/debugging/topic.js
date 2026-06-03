window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['observability/debugging'] = {
  theory: `# Debugging e Deprecacoes de API no Kubernetes

## Ferramentas de Debugging

### kubectl logs

O comando basico para inspecionar saida de containers.

\`\`\`bash
# Log basico
kubectl logs <pod-name>

# Container especifico em Pod multi-container
kubectl logs <pod-name> -c <container-name>

# Logs do container anterior (apos restart)
kubectl logs <pod-name> --previous
kubectl logs <pod-name> -p

# Streaming em tempo real
kubectl logs <pod-name> -f

# Ultimas N linhas
kubectl logs <pod-name> --tail=100

# Logs desde um periodo
kubectl logs <pod-name> --since=1h
kubectl logs <pod-name> --since-time='2024-01-15T10:00:00Z'

# Logs de todos os Pods de um Deployment
kubectl logs deployment/myapp --all-containers=true
\`\`\`

---

### kubectl describe

Fornece informacao detalhada sobre recursos, incluindo eventos recentes.

\`\`\`bash
# Descrever Pod
kubectl describe pod <pod-name>

# Descrever Node
kubectl describe node <node-name>

# Descrever todos os pods de um namespace
kubectl describe pods -n <namespace>
\`\`\`

A secao **Events** do describe e a mais util para debugging. Ela mostra:
- Falhas de pull de imagem
- Falhas de probe
- Erros de scheduling
- Erros de montagem de volume

---

### kubectl get events

Lista eventos do cluster, util para ver historico de problemas.

\`\`\`bash
# Eventos do namespace atual
kubectl get events

# Ordenados por timestamp
kubectl get events --sort-by='.lastTimestamp'

# Filtrar por objeto especifico
kubectl get events --field-selector involvedObject.name=<pod-name>

# Apenas eventos de Warning
kubectl get events --field-selector type=Warning

# Todos os namespaces
kubectl get events -A
\`\`\`

---

### kubectl debug

Ferramenta moderna para debugging de containers em execucao e Nodes (stable desde K8s 1.25).

#### Debug com container efemero (sem modificar o Pod)
\`\`\`bash
# Adicionar container de debug ao Pod em execucao
kubectl debug -it <pod-name> --image=busybox:1.36 --target=<container-name>

# Usar imagem com ferramentas de rede
kubectl debug -it <pod-name> --image=nicolaka/netshoot --target=<container-name>
\`\`\`

#### Debug copiando o Pod (modifica o container)
\`\`\`bash
# Criar copia do Pod com shell interativo
kubectl debug -it <pod-name> --image=busybox:1.36 --copy-to=debug-pod

# Alterar comando do container para debug
kubectl debug -it <pod-name> --copy-to=debug-pod --container=<container-name> -- sh
\`\`\`

#### Debug em Node
\`\`\`bash
# Abrir shell privilegiado no Node
kubectl debug node/<node-name> -it --image=ubuntu:22.04
\`\`\`

---

### Containers Efemeros (Ephemeral Containers)

Containers temporarios adicionados a um Pod em execucao para debugging. Nao podem ser removidos e nao reiniciam automaticamente.

\`\`\`yaml
# Estrutura de um ephemeral container (adicionado via kubectl debug)
apiVersion: v1
kind: Pod
metadata:
  name: example-pod
spec:
  ephemeralContainers:
  - name: debugger
    image: busybox:1.36
    stdin: true
    tty: true
    targetContainerName: app
\`\`\`

\`\`\`bash
# Adicionar ephemeral container manualmente via API
kubectl debug -it mypod --image=busybox:1.36 --target=myapp-container

# Verificar containers efemeros de um Pod
kubectl get pod mypod -o jsonpath='{.spec.ephemeralContainers}'
\`\`\`

---

## Politica de Deprecacao de APIs

### Regras de Deprecacao

O Kubernetes segue uma politica de deprecacao com garantias minimas:

| Nivel | Garantia |
|-------|----------|
| GA (stable) | 12 meses ou 3 releases |
| Beta | 9 meses ou 3 releases |
| Alpha | Sem garantia |

### Comandos para Investigar APIs

\`\`\`bash
# Listar todos os recursos e suas APIs
kubectl api-resources

# Listar todas as versoes de API disponiveis
kubectl api-versions

# Documentacao inline de um recurso
kubectl explain pod
kubectl explain pod.spec.containers
kubectl explain deployment.spec.strategy --recursive

# Verificar a versao do cluster
kubectl version
\`\`\`

---

### Migracao de APIs Depreciadas

Exemplo classico: Ingress migrado de networking.k8s.io/v1beta1 para networking.k8s.io/v1.

**API antiga (depreciada, removida no K8s 1.22):**
\`\`\`yaml
apiVersion: networking.k8s.io/v1beta1
kind: Ingress
metadata:
  name: my-ingress
spec:
  rules:
  - host: example.com
    http:
      paths:
      - path: /
        backend:
          serviceName: my-service
          servicePort: 80
\`\`\`

**API nova (v1, stable):**
\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-ingress
spec:
  rules:
  - host: example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: my-service
            port:
              number: 80
\`\`\`

Outras migracoes importantes:
- \`extensions/v1beta1\` Deployment -> \`apps/v1\` (desde K8s 1.16)
- \`batch/v1beta1\` CronJob -> \`batch/v1\` (desde K8s 1.21)
- \`policy/v1beta1\` PodDisruptionBudget -> \`policy/v1\` (desde K8s 1.21)

---

### Plugin kubectl-convert

Ferramenta para converter manifestos entre versoes de API.

\`\`\`bash
# Instalar kubectl-convert
curl -LO "https://dl.k8s.io/release/$(kubectl version --client --output=json | jq -r .clientVersion.gitVersion)/bin/linux/amd64/kubectl-convert"
chmod +x kubectl-convert
mv kubectl-convert /usr/local/bin/

# Converter manifesto para API mais recente
kubectl convert -f old-ingress.yaml --output-version networking.k8s.io/v1

# Converter e salvar resultado
kubectl convert -f old-deployment.yaml --output-version apps/v1 -o yaml > new-deployment.yaml
\`\`\`

---

## Workflow de Debugging Sistematico

\`\`\`
1. kubectl get pod -> verificar status e restart count
2. kubectl describe pod -> verificar eventos e configuracao
3. kubectl logs -> verificar saida da aplicacao
4. kubectl logs --previous -> se ja houve restart
5. kubectl debug -> se precisar de acesso interativo
6. kubectl get events -> historico de problemas no namespace
\`\`\`
`,

  quiz: [
    {
      question: 'Como visualizar os logs do container que rodou antes do restart atual de um Pod?',
      options: [
        'kubectl logs <pod> --last',
        'kubectl logs <pod> --previous',
        'kubectl logs <pod> --history',
        'kubectl logs <pod> --restart'
      ],
      correct: 1,
      explanation: 'kubectl logs --previous (ou -p) exibe os logs do container que rodou antes do ultimo restart. Essencial para diagnosticar CrashLoopBackOff.'
    },
    {
      question: 'Qual e a funcao principal de um Ephemeral Container?',
      options: [
        'Substituir o container principal quando ele falha',
        'Adicionar um container temporario a um Pod em execucao para debugging sem modificar o Pod original',
        'Executar jobs batch dentro de um Pod existente',
        'Criar um container de sidecar dinamicamente'
      ],
      correct: 1,
      explanation: 'Ephemeral Containers sao adicionados a Pods em execucao apenas para debugging. Eles nao podem ser removidos, nao reiniciam automaticamente e nao afetam o Pod original.'
    },
    {
      question: 'Um manifesto usa networking.k8s.io/v1beta1 para Ingress. Em qual versao do Kubernetes essa API foi removida?',
      options: ['1.18', '1.20', '1.22', '1.25'],
      correct: 2,
      explanation: 'A API networking.k8s.io/v1beta1 para Ingress foi depreciada no K8s 1.19 e completamente removida no K8s 1.22. A versao atual e networking.k8s.io/v1.'
    },
    {
      question: 'Qual comando exibe documentacao inline dos campos de um recurso Kubernetes?',
      options: [
        'kubectl describe --schema',
        'kubectl help <resource>',
        'kubectl explain',
        'kubectl inspect'
      ],
      correct: 2,
      explanation: 'kubectl explain fornece documentacao inline dos campos de recursos. Ex: kubectl explain pod.spec.containers.resources mostra os campos de resources de um container.'
    },
    {
      question: 'Como filtrar eventos de um namespace para mostrar apenas avisos (Warnings)?',
      options: [
        'kubectl get events --type=Warning',
        'kubectl get events --field-selector type=Warning',
        'kubectl get events -w Warning',
        'kubectl get events --filter=Warning'
      ],
      correct: 1,
      explanation: 'Use --field-selector type=Warning para filtrar apenas eventos do tipo Warning. Eventos podem ser Normal ou Warning.'
    },
    {
      question: 'Qual e a garantia de suporte minima para APIs em nivel GA (stable) antes da remocao?',
      options: [
        '3 meses ou 1 release',
        '6 meses ou 2 releases',
        '12 meses ou 3 releases',
        '24 meses ou 6 releases'
      ],
      correct: 2,
      explanation: 'APIs GA (stable) tem garantia de 12 meses OU 3 releases menores, o que for maior. APIs Beta tem 9 meses ou 3 releases. APIs Alpha nao tem garantia.'
    },
    {
      question: 'Como abrir um shell de debugging em um Node especifico usando kubectl debug?',
      options: [
        'kubectl debug -it --node=<node-name> --image=ubuntu',
        'kubectl debug node/<node-name> -it --image=ubuntu:22.04',
        'kubectl exec -it node/<node-name> -- bash',
        'kubectl ssh node/<node-name>'
      ],
      correct: 1,
      explanation: 'kubectl debug node/<node-name> -it --image=<imagem> cria um Pod privilegiado no Node especificado com acesso ao filesystem do host. Util para debugging de problemas no nivel do Node.'
    },
    {
      question: 'Voce precisa copiar um arquivo de log de dentro de um Pod para sua maquina local. Qual e o comando correto?',
      options: [
        'kubectl download <pod>:/var/log/app.log ./app.log',
        'kubectl cp <pod>:/var/log/app.log ./app.log',
        'kubectl exec <pod> -- cat /var/log/app.log > ./app.log',
        'kubectl get file <pod> /var/log/app.log'
      ],
      correct: 1,
      explanation: '"kubectl cp <pod>:<caminho-remoto> <caminho-local>" copia arquivos de dentro do Pod para a maquina local. A direcao inversa tambem funciona: "kubectl cp ./local.file <pod>:/caminho/destino". Para copiar de um container especifico em Pod multi-container: "kubectl cp <pod>:/caminho -c <container> ./destino". Requer que o container tenha o utilitario "tar" instalado (a maioria das imagens tem). Alternativa: "kubectl exec <pod> -- cat /arquivo" redireciona stdout mas pode corromper binarios.'
    },
    {
      question: 'Qual e a diferenca entre "kubectl apply --dry-run=client" e "--dry-run=server"?',
      options: [
        'dry-run=client e mais rapido mas nao detecta erros de validacao de schema; dry-run=server valida contra a API do cluster sem persistir',
        'dry-run=client requer conexao ao cluster; dry-run=server e totalmente local',
        'Nao ha diferenca funcional, apenas o local de execucao muda',
        'dry-run=server so funciona para resources do tipo Deployment'
      ],
      correct: 0,
      explanation: '"--dry-run=client": validacao local apenas (verifica estrutura basica do YAML/JSON), sem enviar ao servidor. Rapido, funciona offline, mas nao detecta: conflitos com recursos existentes, erros de admission webhook, campos invalidos para a versao de API do cluster. "--dry-run=server": envia ao servidor API que processa como se fosse real (inclusive webhooks de validacao e mutacao) mas NAO persiste. Detecta problemas reais de validacao. Recomendado usar "--dry-run=server -o yaml" para ver o YAML final incluindo defaults aplicados pelo servidor.'
    },
    {
      question: 'Como usar JSONPath para extrair apenas o IP de um Pod especifico com kubectl?',
      options: [
        'kubectl get pod meu-pod --format="{.status.podIP}"',
        'kubectl get pod meu-pod -o jsonpath="{.status.podIP}"',
        'kubectl get pod meu-pod -o json | grep podIP',
        'kubectl describe pod meu-pod --output=podIP'
      ],
      correct: 1,
      explanation: '"kubectl get <resource> <nome> -o jsonpath="<expressao>"" extrai campos especificos. Expressoes comuns: "{.status.podIP}" para o IP do Pod, "{.spec.nodeName}" para o node, "{.status.containerStatuses[0].image}" para a imagem do primeiro container. Para multiplos recursos: "{range .items[*]}{.metadata.name}{"\t"}{.status.podIP}{"\n"}{end}". JSONPath e essencial no exame CKA/CKAD para extrair informacoes especificas rapidamente sem parsing manual de saidas.'
    },
    {
      question: 'Voce quer ver a diferenca entre o estado atual de um Deployment no cluster e um novo manifesto YAML antes de aplicar. Qual comando usar?',
      options: [
        'kubectl apply -f novo-deployment.yaml --preview',
        'kubectl diff -f novo-deployment.yaml',
        'kubectl compare -f novo-deployment.yaml',
        'kubectl rollout diff deployment/meu-app -f novo-deployment.yaml'
      ],
      correct: 1,
      explanation: '"kubectl diff -f <arquivo>" mostra a diferenca entre o estado atual do recurso no cluster e o estado desejado no arquivo YAML, usando formato diff similar ao "git diff". Util para: (1) revisar impacto de mudancas antes do apply, (2) verificar se o cluster esta alinhado com o manifesto esperado (drift detection). Retorna exit code 0 se nao ha diferenca, 1 se ha diferenca. Pode ser usado em pipelines de CI/CD para deteccao de drift. Tambem funciona com "-k" para Kustomize: "kubectl diff -k overlays/prod".'
    },
    {
      question: 'Um Pod esta em estado "OOMKilled" repetidamente. Qual sequencia de comandos ajuda a diagnosticar e resolver?',
      options: [
        'kubectl delete pod <pod> e aguardar recriacao automatica',
        'kubectl logs <pod> --previous para ver o ultimo log, kubectl describe pod <pod> para ver o exit code e memoria usada, depois aumentar o memory limit no Deployment',
        'kubectl exec -it <pod> -- free -m para ver memoria disponivel',
        'kubectl top pod <pod> e aguardar estabilizar'
      ],
      correct: 1,
      explanation: 'Sequencia de diagnostico para OOMKilled: (1) "kubectl logs <pod> --previous" — ver logs antes do kill (pode indicar vazamento de memoria). (2) "kubectl describe pod <pod>" — verificar "Last State: Terminated" com "Reason: OOMKilled" e "Exit Code: 137". (3) "kubectl top pod <pod>" — ver consumo atual de memoria. (4) Ajustar "resources.limits.memory" no Deployment para um valor maior. Exit code 137 = 128 + 9 (SIGKILL), indicativo de OOMKilled. A solucao pode ser aumentar limites, otimizar o app, ou ambos.'
    },
    {
      question: 'Qual e a forma correta de executar um comando em um container especifico de um Pod multi-container?',
      options: [
        'kubectl exec <pod> --container=<nome> -- <comando>',
        'kubectl exec -c <nome> <pod> -- <comando>',
        'Ambas as opcoes anteriores sao corretas',
        'kubectl exec <pod>/<container> -- <comando>'
      ],
      correct: 2,
      explanation: 'Tanto "--container=<nome>" quanto "-c <nome>" sao flags equivalentes e validas para especificar o container em Pods multi-container. Exemplos: "kubectl exec -it meu-pod -c sidecar -- /bin/sh" ou "kubectl exec -it meu-pod --container=sidecar -- /bin/sh". Sem especificar o container, o kubectl usa o primeiro container definido no spec (ou o container padrao se anotado). No exame CKAD, a flag "-c" e mais rapida de digitar. A forma "pod/container" nao e valida.'
    }
  ],

  flashcards: [
    {
      front: 'Qual flag do kubectl logs exibe logs do container anterior (antes do ultimo restart)?',
      back: '--previous ou -p\nExemplo: kubectl logs <pod-name> --previous\nEssencial para diagnosticar CrashLoopBackOff e entender por que o container morreu.'
    },
    {
      front: 'O que e kubectl debug e quando usar?',
      back: 'Ferramenta para adicionar containers efemeros a Pods em execucao sem modificar o Pod original. Usar quando: (1) o container nao tem shell, (2) a imagem nao tem ferramentas de debug, (3) o container esta travado/crashando.'
    },
    {
      front: 'Como listar todos os recursos da API Kubernetes e suas versoes?',
      back: 'kubectl api-resources  -> lista todos os recursos com versao de API e short names\nkubectl api-versions   -> lista todas as versoes de API disponíveis no cluster\nkubectl explain <resource> -> documentacao inline dos campos'
    },
    {
      front: 'Qual e a diferenca entre kubectl describe e kubectl get -o yaml para debugging?',
      back: 'kubectl describe: mostra informacao em formato legivel + secao Events (ultimos ~10 eventos)\nkubectl get -o yaml: mostra o objeto completo em YAML incluindo status atual\nPara debugging, comece com describe para ver os eventos.'
    },
    {
      front: 'O que mudou no manifesto de Ingress ao migrar de v1beta1 para v1?',
      back: 'v1beta1: backend.serviceName e backend.servicePort (flat)\nv1: backend.service.name e backend.service.port.number (nested)\nv1 tambem requer pathType (Prefix, Exact ou ImplementationSpecific)'
    },
    {
      front: 'Como ver logs de todos os containers de um Pod multi-container simultaneamente?',
      back: 'kubectl logs <pod-name> --all-containers=true\nOu especificar um container: kubectl logs <pod-name> -c <container-name>\nPara streaming: kubectl logs <pod-name> --all-containers=true -f'
    },
    {
      front: 'Como usar kubectl-convert para migrar um manifesto depreciado?',
      back: 'kubectl convert -f old-manifest.yaml --output-version <grupo/versao>\nExemplo: kubectl convert -f ingress-v1beta1.yaml --output-version networking.k8s.io/v1 -o yaml > ingress-v1.yaml\nRequer instalacao do plugin kubectl-convert separadamente.'
    }
  ],

  lab: {
    scenario: 'Um time de desenvolvimento reportou que varios Pods estao em CrashLoopBackOff e o cluster foi atualizado para uma versao mais recente do Kubernetes. Alguns manifestos antigos estao usando APIs depreciadas e precisam ser migrados.',
    objective: 'Praticar as principais ferramentas de debugging (logs, describe, events, debug) e migrar manifestos com APIs depreciadas para versoes atuais.',
    steps: [
      {
        title: 'Diagnosticar Pod em CrashLoopBackOff',
        instruction: `Crie um Pod que vai entrar em CrashLoopBackOff:
\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: crash-pod
spec:
  containers:
  - name: app
    image: busybox:1.36
    command: ["sh", "-c", "echo 'Starting...'; sleep 5; exit 1"]
\`\`\`

Aguarde o Pod entrar em CrashLoopBackOff e pratique as ferramentas de debugging para entender o problema.`,
        hints: [
          'Use kubectl get pod crash-pod -w para monitorar em tempo real',
          'Tente kubectl logs crash-pod --previous apos o primeiro restart',
          'kubectl describe pod crash-pod mostrara o Exit Code e Last State'
        ],
        solution: `\`\`\`bash
cat <<EOF > crash-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: crash-pod
spec:
  containers:
  - name: app
    image: busybox:1.36
    command: ["sh", "-c", "echo 'Starting...'; sleep 5; exit 1"]
EOF

kubectl apply -f crash-pod.yaml

# Monitorar o status
kubectl get pod crash-pod -w

# Apos o primeiro restart, ver logs do container anterior
kubectl logs crash-pod --previous

# Ver detalhes incluindo exit code
kubectl describe pod crash-pod | grep -A 10 "Last State\\|Exit Code"

# Ver eventos do namespace
kubectl get events --field-selector involvedObject.name=crash-pod --sort-by='.lastTimestamp'
\`\`\``
      },
      {
        title: 'Usar kubectl debug com container efemero',
        instruction: `Crie um Pod com uma imagem minimalista (sem shell):
\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: minimal-pod
spec:
  containers:
  - name: app
    image: nginx:1.25
\`\`\`

Use kubectl debug para adicionar um container efemero com ferramentas de rede e inspecione o ambiente do Pod.`,
        hints: [
          'Use --image=nicolaka/netshoot ou busybox:1.36',
          'Use --target=<container-name> para compartilhar o namespace de processos',
          'kubectl debug -it minimal-pod --image=busybox:1.36 --target=app'
        ],
        solution: `\`\`\`bash
cat <<EOF > minimal-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: minimal-pod
spec:
  containers:
  - name: app
    image: nginx:1.25
EOF

kubectl apply -f minimal-pod.yaml
kubectl wait --for=condition=Ready pod/minimal-pod --timeout=60s

# Adicionar container efemero de debug
kubectl debug -it minimal-pod --image=busybox:1.36 --target=app

# Dentro do container efemero, explorar:
# ps aux        -> ver processos do container app
# wget -qO- localhost -> testar nginx
# cat /etc/nginx/nginx.conf -> ver config do nginx

# Verificar que o ephemeral container foi adicionado
kubectl describe pod minimal-pod | grep -A 5 "Ephemeral"
\`\`\``
      },
      {
        title: 'Explorar APIs e documentacao com kubectl explain',
        instruction: `Pratique o uso de kubectl explain para entender a estrutura de recursos. Explore:
1. A estrutura completa de um Pod
2. Os campos de resources de um container
3. A estrutura de um Deployment strategy
4. Use kubectl api-resources para encontrar short names de recursos`,
        hints: [
          'kubectl explain pod --recursive | head -50 para ver a estrutura completa',
          'kubectl explain pod.spec.containers.resources para campos de resources',
          'Short names estao na coluna SHORTNAMES do kubectl api-resources'
        ],
        solution: `\`\`\`bash
# Ver campos de recursos de um container
kubectl explain pod.spec.containers.resources

# Ver campos de liveness probe
kubectl explain pod.spec.containers.livenessProbe

# Ver estrategia de deployment
kubectl explain deployment.spec.strategy

# Listagem recursiva (util para o exame)
kubectl explain pod.spec --recursive | grep -A 2 "livenessProbe"

# Listar recursos e seus short names
kubectl api-resources | grep -E "NAME|pod|deploy|svc|ing|cm|secret|pv|pvc|ns|no"

# Listar versoes de API disponiveis
kubectl api-versions | sort
\`\`\``
      },
      {
        title: 'Migrar manifesto com API depreciada',
        instruction: `Crie o arquivo \`old-deployment.yaml\` com um Deployment usando a API depreciada \`extensions/v1beta1\` (removida no K8s 1.16). Em seguida, converta-o manualmente para a API atual \`apps/v1\` e valide com dry-run.

Nota: como extensions/v1beta1 ja foi removida, a migracao sera feita manualmente (kubectl convert pode ser usado quando a API ainda existe no cluster).`,
        hints: [
          'A API apps/v1 requer selector.matchLabels que nao existia em extensions/v1beta1',
          'Use kubectl apply --dry-run=client -f new-deployment.yaml para validar',
          'kubectl explain deployment.spec.selector para ver os campos necessarios'
        ],
        solution: `\`\`\`bash
# Manifesto antigo (API depreciada, para referencia)
cat <<EOF > old-deployment.yaml
# ATENCAO: extensions/v1beta1 removida no K8s 1.16
# apiVersion: extensions/v1beta1
# kind: Deployment
# metadata:
#   name: legacy-app
# spec:
#   replicas: 2
#   template:
#     metadata:
#       labels:
#         app: legacy-app
#     spec:
#       containers:
#       - name: app
#         image: nginx:1.25
EOF

# Manifesto migrado para apps/v1
cat <<EOF > new-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: legacy-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: legacy-app
  template:
    metadata:
      labels:
        app: legacy-app
    spec:
      containers:
      - name: app
        image: nginx:1.25
        resources:
          requests:
            cpu: "100m"
            memory: "128Mi"
          limits:
            cpu: "200m"
            memory: "256Mi"
EOF

# Validar sem aplicar
kubectl apply --dry-run=client -f new-deployment.yaml

# Aplicar
kubectl apply -f new-deployment.yaml
kubectl rollout status deployment/legacy-app
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Manifesto rejeitado apos upgrade do cluster - API nao encontrada',
      symptom: 'kubectl apply -f manifesto.yaml retorna erro: "no matches for kind Ingress in version networking.k8s.io/v1beta1". O manifesto funcionava antes do upgrade do cluster.',
      diagnosis: `\`\`\`bash
# Verificar a versao atual do cluster
kubectl version

# Verificar quais versoes de API estao disponiveis para Ingress
kubectl api-resources | grep ingress

# Verificar as versoes de API disponíveis
kubectl api-versions | grep networking

# Verificar o apiVersion atual no manifesto
head -5 manifesto.yaml

# Usar explain para ver a estrutura atual
kubectl explain ingress
\`\`\`

O erro ocorre porque a API v1beta1 foi removida. O cluster foi atualizado para K8s >= 1.22 e a API networking.k8s.io/v1beta1 nao existe mais.`,
      solution: `**Solucao**: Migrar o manifesto de v1beta1 para v1 manualmente.

Principais diferencas no Ingress v1:
\`\`\`yaml
# ANTES (v1beta1 - depreciado)
apiVersion: networking.k8s.io/v1beta1
kind: Ingress
spec:
  rules:
  - http:
      paths:
      - path: /app
        backend:
          serviceName: my-svc
          servicePort: 80

# DEPOIS (v1 - atual)
apiVersion: networking.k8s.io/v1
kind: Ingress
spec:
  rules:
  - http:
      paths:
      - path: /app
        pathType: Prefix
        backend:
          service:
            name: my-svc
            port:
              number: 80
\`\`\`

\`\`\`bash
# Validar o manifesto migrado
kubectl apply --dry-run=client -f ingress-v1.yaml

# Aplicar
kubectl apply -f ingress-v1.yaml

# Verificar
kubectl get ingress
\`\`\``
    },
    {
      title: 'Pod sem ferramentas de debug - impossivel diagnosticar problema',
      symptom: 'Um Pod esta rodando com comportamento inesperado mas usa uma imagem distroless (sem shell, sem ferramentas). kubectl exec falha com "OCI runtime exec failed: exec failed: unable to start container process: exec: sh: executable file not found in $PATH".',
      diagnosis: `\`\`\`bash
# Confirmar que o exec falha
kubectl exec -it <pod-name> -- sh

# Verificar a imagem usada
kubectl get pod <pod-name> -o jsonpath='{.spec.containers[*].image}'

# Verificar logs disponiveis
kubectl logs <pod-name>
kubectl logs <pod-name> --previous
\`\`\`

A imagem distroless nao contem shell nem ferramentas de sistema, impossibilitando o uso direto de kubectl exec.`,
      solution: `**Solucao**: Usar kubectl debug com container efemero:

\`\`\`bash
# Adicionar container de debug compartilhando namespace de processos
kubectl debug -it <pod-name> --image=busybox:1.36 --target=<container-name>

# Com imagem mais completa para debug de rede
kubectl debug -it <pod-name> --image=nicolaka/netshoot --target=<container-name>

# Criar copia do Pod com imagem alternativa para debug completo
kubectl debug -it <pod-name> \\
  --copy-to=<pod-name>-debug \\
  --image=busybox:1.36 \\
  --container=<container-name> \\
  -- sh

# Limpar pod de debug apos uso
kubectl delete pod <pod-name>-debug
\`\`\``
    }
  ]
};
