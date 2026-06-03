window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['app-design-build/multi-container'] = {
  theory: `# Padroes Multi-Container

## Conceito Base

Um Pod pode conter **multiplos containers** que compartilham:
- **Network namespace**: mesmo IP e portas (comunicam via \`localhost\`)
- **Volumes**: sistemas de arquivos compartilhados
- **Ciclo de vida**: nascem e morrem juntos

Cada container e executado de forma isolada (CPU, memoria, filesystem), mas o namespace de rede e compartilhado por padrao.

---

## Padroes Principais

### 1. Sidecar Pattern

O container principal executa a logica de negocio. O sidecar **estende** ou **aprimora** o container principal sem modificar sua imagem.

**Casos de uso**: envio de logs, proxy de trafego (Envoy/Istio), sincronizacao de config, coleta de metricas.

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-com-log-shipper
  labels:
    app: minha-api
spec:
  volumes:
    - name: log-volume
      emptyDir: {}

  containers:
    # Container principal: a aplicacao
    - name: app
      image: minha-api:v2.0.0
      ports:
        - containerPort: 8080
      volumeMounts:
        - name: log-volume
          mountPath: /var/log/app
      resources:
        requests:
          cpu: "200m"
          memory: "256Mi"
        limits:
          cpu: "500m"
          memory: "512Mi"

    # Sidecar: envia logs para sistema centralizado
    - name: log-shipper
      image: fluent/fluent-bit:2.2
      volumeMounts:
        - name: log-volume
          mountPath: /var/log/app
          readOnly: true
      env:
        - name: FLUENT_ELASTICSEARCH_HOST
          value: "elasticsearch.logging.svc.cluster.local"
      resources:
        requests:
          cpu: "50m"
          memory: "64Mi"
        limits:
          cpu: "100m"
          memory: "128Mi"
\`\`\`

---

### 2. Init Containers

Init containers executam **antes** dos containers principais. Sao usados para:
- Aguardar um servico estar disponivel
- Realizar configuracoes pre-requisito
- Baixar arquivos/certificados
- Migrations de banco de dados

**Caracteristicas**:
- Executam em ordem sequencial (um de cada vez)
- O container principal so inicia quando TODOS os init containers completam com sucesso
- Se um init container falha, o Pod reinicia (segue a restartPolicy)
- Cada init container e uma instancia separada (nao persiste estado entre si, exceto via volumes)

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: api-com-prerequisitos
spec:
  volumes:
    - name: config-volume
      emptyDir: {}

  initContainers:
    # Init 1: aguarda o banco de dados estar pronto
    - name: wait-for-db
      image: busybox:1.36
      command:
        - /bin/sh
        - -c
        - |
          echo "Aguardando PostgreSQL..."
          until nc -z postgres.producao.svc.cluster.local 5432; do
            echo "PostgreSQL nao esta pronto - aguardando 3s"
            sleep 3
          done
          echo "PostgreSQL esta pronto!"

    # Init 2: baixa configuracoes e executa migration
    - name: run-migration
      image: minha-api:v2.0.0
      command: ["python", "manage.py", "migrate", "--no-input"]
      env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url

    # Init 3: busca configuracoes do Vault
    - name: fetch-config
      image: vault:1.15
      command:
        - /bin/sh
        - -c
        - |
          vault login $VAULT_TOKEN
          vault kv get -field=config secret/minha-api > /config/app.json
      volumeMounts:
        - name: config-volume
          mountPath: /config
      env:
        - name: VAULT_ADDR
          value: "http://vault.infra.svc.cluster.local:8200"
        - name: VAULT_TOKEN
          valueFrom:
            secretKeyRef:
              name: vault-token
              key: token

  containers:
    - name: api
      image: minha-api:v2.0.0
      ports:
        - containerPort: 8080
      volumeMounts:
        - name: config-volume
          mountPath: /config
          readOnly: true
      resources:
        requests:
          cpu: "200m"
          memory: "256Mi"
        limits:
          cpu: "1000m"
          memory: "512Mi"
\`\`\`

---

### 3. Ambassador Pattern

O container Ambassador age como **proxy de saida** (outbound). O container principal se conecta sempre ao \`localhost\`, e o Ambassador redireciona para o servico real, abstraindo complexidades como:
- Service discovery
- Load balancing customizado
- Autenticacao em APIs externas
- Circuit breaking

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-com-ambassador
spec:
  containers:
    # Container principal: se conecta ao DB via localhost:5432
    - name: app
      image: minha-api:v2.0.0
      env:
        - name: DATABASE_URL
          # Conecta ao Ambassador local, nao diretamente ao DB
          value: "postgresql://localhost:5432/meudb"
      resources:
        requests:
          cpu: "200m"
          memory: "256Mi"
        limits:
          cpu: "500m"
          memory: "512Mi"

    # Ambassador: proxy para o banco de dados real com connection pooling
    - name: db-ambassador
      image: pgbouncer/pgbouncer:1.21.0
      ports:
        - containerPort: 5432
      env:
        - name: DATABASES_HOST
          value: "postgres-primary.db.svc.cluster.local"
        - name: DATABASES_PORT
          value: "5432"
        - name: POOL_MODE
          value: "transaction"
      resources:
        requests:
          cpu: "50m"
          memory: "64Mi"
        limits:
          cpu: "200m"
          memory: "128Mi"
\`\`\`

---

### 4. Adapter Pattern

O container Adapter **transforma o output** do container principal para um formato padronizado, sem modificar a aplicacao original.

Casos de uso: normalizar logs de aplicacoes legadas, converter metricas para formato Prometheus, transformar dados para um schema comum.

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-legada-com-adapter
spec:
  volumes:
    - name: metrics-volume
      emptyDir: {}

  containers:
    # Container principal: app legada que gera metricas em formato proprio
    - name: app-legada
      image: app-legada:v1.0.0
      volumeMounts:
        - name: metrics-volume
          mountPath: /var/metrics
      resources:
        requests:
          cpu: "300m"
          memory: "512Mi"
        limits:
          cpu: "1000m"
          memory: "1Gi"

    # Adapter: converte metricas do formato legado para Prometheus
    - name: metrics-adapter
      image: metrics-converter:v1.0.0
      ports:
        - containerPort: 9090   # Expoe metricas no formato Prometheus
          name: metrics
      volumeMounts:
        - name: metrics-volume
          mountPath: /input
          readOnly: true
      resources:
        requests:
          cpu: "50m"
          memory: "64Mi"
        limits:
          cpu: "100m"
          memory: "128Mi"
\`\`\`

---

## Comunicacao entre Containers

### Via Rede (localhost)

Como todos os containers compartilham o mesmo namespace de rede:

\`\`\`yaml
# Container A expoe na porta 8080
containers:
  - name: app
    ports:
      - containerPort: 8080

  # Container B se conecta via localhost:8080
  - name: sidecar
    env:
      - name: APP_URL
        value: "http://localhost:8080"
\`\`\`

**Atencao**: containers no mesmo Pod nao podem usar a mesma porta.

### Via Volume Compartilhado

Volumes do tipo \`emptyDir\` sao criados quando o Pod e agendado e existem enquanto o Pod existir:

\`\`\`yaml
volumes:
  - name: shared-data
    emptyDir:
      medium: Memory   # Opcional: usa RAM em vez de disco (mais rapido)
      sizeLimit: 128Mi

containers:
  - name: writer
    volumeMounts:
      - name: shared-data
        mountPath: /output

  - name: reader
    volumeMounts:
      - name: shared-data
        mountPath: /input
        readOnly: true
\`\`\`

---

## Ciclo de Vida e Ordenamento

**Init containers**: executam em ordem sequencial, bloqueiam o inicio dos containers principais.

**Containers regulares**: iniciam em paralelo (sem garantia de ordem entre si).

Para dependencias entre containers regulares, use **readinessProbe** no container principal e configure o sidecar para ficar pronto antes, ou use um init container para verificar a dependencia.

\`\`\`yaml
containers:
  - name: app
    # Aguarda que o proxy sidecar esteja pronto antes de receber trafego
    readinessProbe:
      exec:
        command:
          - /bin/sh
          - -c
          - "curl -s http://localhost:15021/healthz/ready"
      initialDelaySeconds: 5
      periodSeconds: 5
\`\`\`
`,

  quiz: [
    {
      question: 'Containers em um mesmo Pod compartilham qual recurso por padrao?',
      options: [
        'CPU e memoria apenas',
        'Sistema de arquivos (filesystem)',
        'Namespace de rede (mesmo IP e portas)',
        'Todas as variaveis de ambiente'
      ],
      correct: 2,
      explanation: 'Containers em um Pod compartilham o mesmo namespace de rede: mesmo IP, mesma tabela de rotas e mesmas portas. Por isso eles se comunicam via localhost. Filesystem NAO e compartilhado por padrao (cada container tem seu proprio, exceto volumes montados explicitamente). CPU e memoria tem limites independentes por container.'
    },
    {
      question: 'Qual e a ordem de execucao em um Pod com 2 init containers e 2 containers regulares?',
      options: [
        'Todos iniciam em paralelo',
        'Init containers em paralelo, depois containers regulares em paralelo',
        'Init container 1 completa, depois init container 2 completa, depois containers regulares iniciam em paralelo',
        'Containers regulares primeiro, depois init containers'
      ],
      correct: 2,
      explanation: 'Init containers executam sequencialmente: o init container 1 deve completar com sucesso antes do init container 2 iniciar. Apos TODOS os init containers completarem com sucesso, os containers regulares iniciam (em paralelo entre si, sem garantia de ordem). Se qualquer init container falhar, o Pod reinicia e os init containers comecam do zero.'
    },
    {
      question: 'Qual padrao multi-container e mais adequado para normalizar o formato de logs de uma aplicacao legada?',
      options: [
        'Sidecar',
        'Init Container',
        'Ambassador',
        'Adapter'
      ],
      correct: 3,
      explanation: 'O Adapter pattern e especificamente projetado para transformar o output de um container para um formato padronizado ou esperado pelo ambiente. A aplicacao legada continua gerando logs no formato proprio; o Adapter converte para o formato esperado (ex: JSON estruturado para Elasticsearch). Sidecar estende funcionalidade; Ambassador e proxy de saida; Init Container executa antes do inicio.'
    },
    {
      question: 'Em um Pod multi-container, como o container A pode compartilhar arquivos com o container B?',
      options: [
        'Containers no mesmo Pod compartilham automaticamente todo o filesystem',
        'Usando um Volume do tipo emptyDir montado em ambos os containers',
        'Via variaveis de ambiente compartilhadas',
        'Nao e possivel compartilhar arquivos entre containers no mesmo Pod'
      ],
      correct: 1,
      explanation: 'Volumes do tipo emptyDir (ou qualquer outro volume) podem ser montados em multiplos containers do mesmo Pod, criando um espaco de armazenamento compartilhado. O emptyDir e criado quando o Pod e agendado em um node e deletado quando o Pod e removido. Cada container pode montar em caminhos diferentes e com permissoes diferentes (readOnly).'
    },
    {
      question: 'O que acontece se um init container falha (exit code != 0) com restartPolicy: Always?',
      options: [
        'O Pod e marcado como Failed e nao reinicia',
        'O Kubernetes pula o init container falho e inicia os seguintes',
        'O Pod reinicia (os init containers comecam do zero) com backoff exponencial',
        'Os containers regulares iniciam mesmo assim'
      ],
      correct: 2,
      explanation: 'Se um init container falha, o Kubernetes reinicia o Pod inteiro (os init containers comecam do zero, do primeiro). O backoff exponencial e aplicado (10s, 20s, 40s... ate 5min) para evitar loops rapidos. Com restartPolicy: Never, o Pod vai para o estado Failed sem reiniciar. Os containers regulares NUNCA iniciam enquanto qualquer init container nao completar com sucesso.'
    },
    {
      question: 'Qual e a diferenca entre o padrao Ambassador e o padrao Sidecar?',
      options: [
        'Nao ha diferenca, sao o mesmo padrao',
        'Sidecar estende o container principal (ex: logging); Ambassador atua como proxy de saida para servicos externos',
        'Ambassador executa antes do container principal; Sidecar executa depois',
        'Sidecar usa volumes compartilhados; Ambassador usa rede compartilhada'
      ],
      correct: 1,
      explanation: 'Sidecar: container auxiliar que estende ou aprimora o container principal (logging, metricas, sync de config). Ambassador: container que age como proxy de saida, abstraindo a complexidade de se conectar a servicos externos (o app se conecta sempre ao localhost e o Ambassador faz o roteamento real). A diferenca e de responsabilidade: extensao vs. abstrecao de conectividade.'
    },
    {
      question: 'Voce precisa inspecionar o filesystem de um Pod cujo container usa imagem distroless (sem shell). Qual e o comando correto para adicionar um container de debugging?',
      options: [
        'kubectl exec -it <pod> -- /bin/sh',
        'kubectl debug -it <pod> --image=busybox:1.36 --target=<container-name>',
        'kubectl attach -it <pod>',
        'kubectl run debug --image=busybox:1.36 --attach=true'
      ],
      correct: 1,
      explanation: '"kubectl debug -it <pod> --image=busybox:1.36 --target=<container-name>" adiciona um container efemero ao Pod em execucao sem modificar o Pod original. O "--target" compartilha o namespace de processos do container especificado, permitindo inspecionar seus processos e filesystem via /proc. Para containers distroless, "kubectl exec" falha pois nao ha shell. O container efemero tem suas proprias ferramentas (busybox, netshoot, etc.).'
    },
    {
      question: 'Um init container precisa preparar um arquivo de configuracao com chmod 400 antes que o container principal inicie. Como implementar corretamente?',
      options: [
        'Usar lifecycle.postStart no container principal para ajustar permissoes',
        'Definir defaultMode no volumeMount do container principal',
        'Configurar o init container para escrever o arquivo em um volume emptyDir compartilhado e executar chmod 400 antes de sair com exit 0',
        'Nao e possivel alterar permissoes de arquivos em volumes emptyDir'
      ],
      correct: 2,
      explanation: 'O init container executa sequencialmente antes do container principal e pode preparar o ambiente de armazenamento. O fluxo: (1) init container monta o emptyDir, cria o arquivo, executa "chmod 400 /caminho/arquivo", sai com exit 0. (2) Container principal monta o mesmo emptyDir e encontra o arquivo com a permissao correta. Este e um uso classico de init containers: garantir pre-condicoes de filesystem antes da aplicacao iniciar. lifecycle.postStart ocorre APOS o container principal ja ter iniciado.'
    },
    {
      question: 'Qual campo no spec do Pod permite que containers vejam e interajam com os processos uns dos outros?',
      options: [
        'spec.sharedNamespaces: [pid]',
        'spec.shareProcessNamespace: true',
        'spec.hostPID: true',
        'spec.containers[].shareProcesses: true'
      ],
      correct: 1,
      explanation: '"spec.shareProcessNamespace: true" faz com que todos os containers no Pod compartilhem o mesmo namespace de PID. Isso permite que um container de debugging use ferramentas como "ps", "strace" ou "kill" nos processos de outros containers. Sem isso, cada container ve apenas seus proprios processos (PID 1 e filhos). "hostPID: true" e diferente: compartilha o namespace de PID com o NODE, o que e muito mais privilegiado e perigoso.'
    },
    {
      question: 'No Kubernetes 1.29+, qual e a forma correta de declarar um sidecar container nativo que deve iniciar ANTES dos containers regulares e permanecer rodando?',
      options: [
        'Declara-lo em spec.sidecars com type: persistent',
        'Declara-lo em spec.initContainers com restartPolicy: Always',
        'Declara-lo em spec.containers com startupOrder: 0',
        'Declara-lo em spec.containers com lifecycle.preStart configurado'
      ],
      correct: 1,
      explanation: 'O suporte nativo a sidecar containers (beta no K8s 1.29) usa initContainers com "restartPolicy: Always". Isso garante: (1) o sidecar inicia ANTES dos containers regulares, (2) permanece rodando continuamente (nao precisa completar como init containers normais), (3) e reiniciado se crashar, (4) termina DEPOIS de todos os containers regulares finalizarem. Resolve o problema classico com Istio/Envoy onde o proxy precisa estar pronto antes da aplicacao e continuar rodando durante toda a vida do Pod.'
    },
    {
      question: 'Como um container no Pod pode se comunicar com outro container no mesmo Pod?',
      options: [
        'Via o nome do container como hostname (ex: curl http://sidecar:8080)',
        'Via localhost na porta do outro container (ex: curl http://localhost:9090)',
        'Via o ClusterIP do Service que aponta para o Pod',
        'Via variaveis de ambiente injetadas automaticamente pelo Kubernetes'
      ],
      correct: 1,
      explanation: 'Containers no mesmo Pod compartilham o mesmo namespace de rede (mesmo IP, mesma interface de rede). Portanto, comunicam-se via "localhost" na porta do outro container. Se o container "app" escuta na 8080 e o "sidecar" na 9090, o app pode fazer "curl http://localhost:9090" para acessar o sidecar e vice-versa. Nao existem hostnames automaticos por container; o Service resolve o nome do Pod inteiro, nao de containers individuais.'
    },
    {
      question: 'Um Pod tem 1 init container e 2 containers regulares. O init container falhou. O que o "kubectl get pod" mostrara no campo STATUS?',
      options: [
        'Error',
        'Init:CrashLoopBackOff ou Init:Error dependendo do numero de falhas',
        'CrashLoopBackOff',
        'Pending'
      ],
      correct: 1,
      explanation: 'Enquanto init containers estao executando ou falhando, o STATUS do Pod comeca com "Init:". Exemplos: "Init:0/1" (0 de 1 init containers completou), "Init:Error" (falhou pela primeira vez), "Init:CrashLoopBackOff" (falhou multiplas vezes com backoff). O status "CrashLoopBackOff" sem "Init:" indica que um container REGULAR esta falhando. "Pending" aparece antes dos init containers iniciarem. "Error" indica falha terminal sem retry.'
    },
    {
      question: 'Qual e a diferenca entre o campo "command" e "args" em um container spec do Kubernetes em relacao ao Dockerfile?',
      options: [
        'command e args sao identicos no Kubernetes, apenas aliases',
        '"command" substitui o ENTRYPOINT do Dockerfile; "args" substitui o CMD do Dockerfile',
        '"command" substitui o CMD do Dockerfile; "args" substitui o ENTRYPOINT do Dockerfile',
        'command e args so funcionam se o Dockerfile nao tiver ENTRYPOINT ou CMD'
      ],
      correct: 1,
      explanation: 'Mapeamento: Kubernetes "command" corresponde ao ENTRYPOINT do Dockerfile (o executavel principal). Kubernetes "args" corresponde ao CMD do Dockerfile (argumentos padrao). Se apenas "args" e definido no K8s, o ENTRYPOINT do Dockerfile e mantido. Se apenas "command" e definido, o CMD do Dockerfile e ignorado. Se ambos sao definidos no K8s, tanto ENTRYPOINT quanto CMD do Dockerfile sao substituidos. Importante para containers que usam scripts de entrypoint personalizados.'
    }
  ],

  flashcards: [
    {
      front: 'Quais recursos sao compartilhados entre containers em um Pod?',
      back: 'Compartilhados por padrao: (1) Network namespace: mesmo IP, mesmas portas, mesma tabela de rotas - comunicacao via localhost. (2) Volumes explicitamente montados: qualquer volume declarado no spec.volumes pode ser montado em multiplos containers. NAO compartilhados: filesystem de cada container (exceto volumes), CPU/memoria (cada container tem seus proprios limites), variaveis de ambiente.'
    },
    {
      front: 'Para que servem Init Containers e como diferem de containers regulares?',
      back: 'Init containers executam ANTES dos containers regulares, em ordem sequencial. Cada um deve completar com sucesso (exit 0) antes do proximo iniciar. Usados para: aguardar dependencias (banco de dados, servicos), executar migrations, buscar segredos/configuracoes, preparar volumes. Diferenca chave: nao ficam em execucao apos completar (sao one-shot), nao tem probes de liveness/readiness, e garantem pre-condicoes para os containers principais.'
    },
    {
      front: 'Descreva o padrao Sidecar com um exemplo pratico.',
      back: 'Sidecar: container auxiliar rodando ao lado do container principal, estendendo sua funcionalidade sem modificar sua imagem. Exemplos: (1) Log Shipper: app escreve logs em arquivo em volume compartilhado, Fluent Bit le o volume e envia ao Elasticsearch. (2) Proxy Envoy (Istio): intercepta todo trafego de entrada e saida do container principal para aplicar politicas de seguranca e observabilidade. (3) Config sync: container que sincroniza configs do Git para um volume compartilhado.'
    },
    {
      front: 'O que e um volume emptyDir e quando e deletado?',
      back: 'emptyDir e um volume temporario criado no node quando o Pod e agendado, inicialmente vazio. Persiste enquanto o Pod estiver rodando naquele node (sobrevive a restartes de containers). E DELETADO quando o Pod e removido (por qualquer motivo). Uso: compartilhar dados temporarios entre containers do mesmo Pod, cache temporario, area de trabalho para init containers. Opcao: medium: Memory usa tmpfs (RAM), mais rapido mas conta no limite de memoria.'
    },
    {
      front: 'Qual e o padrao Ambassador e quando usar?',
      back: 'Ambassador: container proxy de saida que fica entre o container principal e servicos externos. O app sempre se conecta ao localhost na porta do Ambassador. Ambassador faz connection pooling, roteamento, autenticacao, circuit breaking. Quando usar: (1) connection pooling para banco de dados (PgBouncer). (2) Abstrair complexidade de service discovery. (3) Adicionar autenticacao a APIs externas sem modificar o codigo do app. Beneficio: o app ignora a complexidade da infraestrutura.'
    },
    {
      front: 'Como garantir que o container Sidecar esteja pronto antes do container principal receber trafego?',
      back: 'Opcoes: (1) Usar readinessProbe no container principal que verifique tambem se o sidecar esta funcionando (ex: curl para endpoint do sidecar). (2) Converter o sidecar em init container se ele executa uma vez (nao serve para proxies continuos). (3) Com Kubernetes 1.29+: usar sidecar containers (feature nativa) com restartPolicy: Always em initContainers, que sao iniciados antes dos containers regulares mas ficam rodando. (4) Usar startupProbe com mais paciencia no container principal.'
    },
    {
      front: 'Dois containers no mesmo Pod conseguem usar a mesma porta?',
      back: 'NAO. Como compartilham o mesmo namespace de rede (mesmo IP), dois containers nao podem escutar na mesma porta - causaria conflito. Se app escuta na porta 8080, o sidecar nao pode escutar em 8080. Cada container deve usar uma porta diferente. Exemplo: app na 8080, metricas-adapter na 9090, log-shipper nao precisa de porta (apenas le de volume). Isso e diferente de containers em Pods DIFERENTES, que podem usar as mesmas portas pois tem IPs distintos.'
    }
  ],

  lab: {
    scenario: 'Uma API Python precisa ser deployada com tres requisitos operacionais: (1) os logs devem ser enviados para um sistema centralizado via sidecar, (2) a API so pode iniciar apos o banco de dados estar disponivel (init container), e (3) as conexoes ao banco devem usar connection pooling via Ambassador.',
    objective: 'Implementar um Pod completo com init container para health check de dependencia, sidecar para log shipping via volume compartilhado, e Ambassador para connection pooling.',
    steps: [
      {
        title: 'Criar Pod com Init Container para dependencia',
        instruction: `Crie um Pod que usa um init container para aguardar um servico de banco de dados estar disponivel antes de iniciar a aplicacao principal. Simule o banco de dados com um Service e um Deployment simples.`,
        hints: [
          'Use nc -z <host> <porta> para testar conectividade TCP no busybox',
          'O init container deve fazer loop ate a conexao ter sucesso',
          'kubectl get pod mostrara o status "Init:0/1" enquanto o init container roda',
          'kubectl logs <pod> -c wait-for-db mostra logs do init container especifico'
        ],
        solution: `\`\`\`yaml
# Simular banco de dados
apiVersion: v1
kind: Service
metadata:
  name: postgres
spec:
  selector:
    app: postgres
  ports:
    - port: 5432
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
        - name: postgres
          image: postgres:16-alpine
          env:
            - name: POSTGRES_PASSWORD
              value: "testpass"
          ports:
            - containerPort: 5432
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "256Mi"
---
# Pod da aplicacao com init container
apiVersion: v1
kind: Pod
metadata:
  name: api-com-prereqs
spec:
  volumes:
    - name: logs
      emptyDir: {}
  initContainers:
    - name: wait-for-db
      image: busybox:1.36
      command:
        - /bin/sh
        - -c
        - |
          echo "Aguardando PostgreSQL ficar disponivel..."
          until nc -z postgres 5432; do
            echo "Postgres indisponivel - tentando novamente em 5s..."
            sleep 5
          done
          echo "PostgreSQL esta pronto! Iniciando aplicacao..."
      resources:
        requests:
          cpu: "10m"
          memory: "16Mi"
        limits:
          cpu: "50m"
          memory: "32Mi"
  containers:
    - name: api
      image: nginx:1.25-alpine
      ports:
        - containerPort: 8080
      volumeMounts:
        - name: logs
          mountPath: /var/log/nginx
      resources:
        requests:
          cpu: "100m"
          memory: "128Mi"
        limits:
          cpu: "500m"
          memory: "256Mi"
\`\`\`

\`\`\`bash
kubectl apply -f prereqs.yaml

# Monitorar o init container
kubectl get pod api-com-prereqs --watch

# Ver logs do init container durante a espera
kubectl logs api-com-prereqs -c wait-for-db -f

# Verificar estado apos init container completar
kubectl describe pod api-com-prereqs
\`\`\``
      },
      {
        title: 'Adicionar Sidecar para Log Shipping',
        instruction: `Adicione um container sidecar ao Pod que le os logs escritos pela aplicacao principal em um volume compartilhado e os processa (simule o envio). Use um volume emptyDir como ponte entre os dois containers.`,
        hints: [
          'Ambos os containers devem montar o mesmo volume (nome identico)',
          'O sidecar deve montar com readOnly: true (boas praticas)',
          'Use tail -f para simular o sidecar lendo logs continuamente',
          'kubectl logs api-com-sidecar -c log-shipper para ver os logs do sidecar'
        ],
        solution: `\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: api-com-sidecar
  labels:
    app: api
spec:
  volumes:
    - name: logs
      emptyDir: {}

  initContainers:
    - name: wait-for-db
      image: busybox:1.36
      command:
        - /bin/sh
        - -c
        - |
          until nc -z postgres 5432; do sleep 3; done
          echo "DB pronto!"
      resources:
        requests:
          cpu: "10m"
          memory: "16Mi"
        limits:
          cpu: "50m"
          memory: "32Mi"

  containers:
    # Container principal
    - name: api
      image: busybox:1.36
      command:
        - /bin/sh
        - -c
        - |
          while true; do
            echo "$(date) [INFO] Request processado com sucesso - status=200" >> /var/log/app/app.log
            echo "$(date) [INFO] Health check ok" >> /var/log/app/app.log
            sleep 5
          done
      volumeMounts:
        - name: logs
          mountPath: /var/log/app
      resources:
        requests:
          cpu: "100m"
          memory: "64Mi"
        limits:
          cpu: "200m"
          memory: "128Mi"

    # Sidecar: le e processa os logs
    - name: log-shipper
      image: busybox:1.36
      command:
        - /bin/sh
        - -c
        - |
          echo "Log shipper iniciado - aguardando logs..."
          tail -f /var/log/app/app.log | while read line; do
            echo "[SHIPPER] Enviando para Elasticsearch: $line"
          done
      volumeMounts:
        - name: logs
          mountPath: /var/log/app
          readOnly: true
      resources:
        requests:
          cpu: "20m"
          memory: "32Mi"
        limits:
          cpu: "50m"
          memory: "64Mi"
\`\`\`

\`\`\`bash
kubectl apply -f sidecar.yaml
kubectl get pod api-com-sidecar

# Ver logs do container principal
kubectl logs api-com-sidecar -c api

# Ver logs do sidecar processando
kubectl logs api-com-sidecar -c log-shipper -f

# Entrar no container do sidecar para inspecionar
kubectl exec api-com-sidecar -c log-shipper -- ls /var/log/app
kubectl exec api-com-sidecar -c log-shipper -- tail /var/log/app/app.log
\`\`\``
      },
      {
        title: 'Adicionar Ambassador para Connection Pooling',
        instruction: `Estenda o Pod com um container Ambassador que atua como proxy local para o banco de dados. A aplicacao principal se conecta sempre ao localhost, e o Ambassador faz o roteamento real.`,
        hints: [
          'O Ambassador escuta em localhost:5432 e redireciona para postgres:5432',
          'Use socat para criar um proxy TCP simples no busybox',
          'A comunicacao entre o app e o Ambassador e via localhost (mesmo network namespace)',
          'kubectl exec api-final -c app -- nc -z localhost 5432 para testar o proxy'
        ],
        solution: `\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: api-final
  labels:
    app: api-final
spec:
  volumes:
    - name: logs
      emptyDir: {}

  initContainers:
    - name: wait-for-db
      image: busybox:1.36
      command:
        - /bin/sh
        - -c
        - |
          until nc -z postgres 5432; do sleep 3; done
          echo "DB pronto!"
      resources:
        requests:
          cpu: "10m"
          memory: "16Mi"
        limits:
          cpu: "50m"
          memory: "32Mi"

  containers:
    # Container principal: usa localhost para se conectar ao DB
    - name: app
      image: busybox:1.36
      command:
        - /bin/sh
        - -c
        - |
          while true; do
            echo "$(date) Conectando ao banco via Ambassador (localhost:5432)..."
            nc -z localhost 5432 && echo "Conexao OK!" || echo "Falha na conexao"
            sleep 10
          done
      volumeMounts:
        - name: logs
          mountPath: /var/log/app
      resources:
        requests:
          cpu: "100m"
          memory: "64Mi"
        limits:
          cpu: "200m"
          memory: "128Mi"

    # Ambassador: proxy TCP localhost:5432 -> postgres:5432
    - name: db-ambassador
      image: busybox:1.36
      command:
        - /bin/sh
        - -c
        - |
          echo "Ambassador iniciado - proxying localhost:5432 -> postgres:5432"
          socat TCP-LISTEN:5432,fork TCP:postgres:5432
      resources:
        requests:
          cpu: "20m"
          memory: "32Mi"
        limits:
          cpu: "50m"
          memory: "64Mi"

    # Sidecar: log shipper
    - name: log-shipper
      image: busybox:1.36
      command:
        - /bin/sh
        - -c
        - |
          tail -f /var/log/app/*.log 2>/dev/null | while read line; do
            echo "[SHIPPER] $line"
          done
      volumeMounts:
        - name: logs
          mountPath: /var/log/app
          readOnly: true
      resources:
        requests:
          cpu: "20m"
          memory: "32Mi"
        limits:
          cpu: "50m"
          memory: "64Mi"
\`\`\`

\`\`\`bash
kubectl apply -f api-final.yaml

# Verificar todos os containers do Pod
kubectl get pod api-final -o jsonpath='{.spec.containers[*].name}'

# Testar conectividade via Ambassador
kubectl exec api-final -c app -- nc -z localhost 5432 && echo "Ambassador funcionando"

# Ver logs de cada container
kubectl logs api-final -c app
kubectl logs api-final -c db-ambassador
kubectl logs api-final -c log-shipper

# Ver status detalhado de todos os containers
kubectl describe pod api-final
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Pod travado em status "Init:CrashLoopBackOff"',
      symptom: 'kubectl get pods mostra STATUS "Init:CrashLoopBackOff" ou "Init:Error". O Pod nunca avanca para o estado Running. Os containers principais nunca iniciam.',
      diagnosis: `**Passo 1: Identificar qual init container esta falhando**
\`\`\`bash
kubectl get pod <nome-do-pod>
# "Init:0/2" significa que o primeiro de 2 init containers falhou
# "Init:1/2" significa que o segundo falhou

kubectl describe pod <nome-do-pod>
# Procure na secao "Init Containers" o que tem "State: Terminated" com Exit Code != 0
\`\`\`

**Passo 2: Ver logs do init container especifico**
\`\`\`bash
# OBRIGATORIO: especificar o container com -c
kubectl logs <nome-do-pod> -c <nome-do-init-container>

# Se o container ja reiniciou, ver logs da tentativa anterior
kubectl logs <nome-do-pod> -c <nome-do-init-container> --previous
\`\`\`

**Passo 3: Verificar se a dependencia existe**
\`\`\`bash
# Para init containers que aguardam servicos
kubectl get service <nome-do-servico>
kubectl get endpoints <nome-do-servico>
# Se ENDPOINTS mostrar "<none>", o Service existe mas nao tem Pods prontos
\`\`\`

**Passo 4: Testar manualmente o comando do init container**
\`\`\`bash
# Executar o mesmo comando em um Pod temporario
kubectl run debug --image=busybox:1.36 --restart=Never -it --rm \\
  -- nc -z postgres.default.svc.cluster.local 5432
\`\`\``,
      solution: `**Causa: Servico/dependencia nao existe ou nao esta pronto**
\`\`\`bash
# Verificar se o Service existe no namespace correto
kubectl get service postgres -n <namespace>

# Se o Service nao existir, criar
kubectl apply -f postgres-service.yaml

# Se o Service existir mas sem endpoints, verificar o Deployment do banco
kubectl get deployment postgres
kubectl get pods -l app=postgres
\`\`\`

**Causa: Nome de host incorreto no init container**
\`\`\`bash
# Formato correto para servico no mesmo namespace:
# <service-name>
# Formato para namespace diferente:
# <service-name>.<namespace>.svc.cluster.local

# Verificar DNS dentro do cluster
kubectl run dns-test --image=busybox:1.36 --restart=Never -it --rm \\
  -- nslookup postgres.default.svc.cluster.local
\`\`\`

**Causa: Permissoes ou credenciais incorretas (ex: init que roda migration)**
\`\`\`bash
# Verificar se os Secrets referenciados existem
kubectl get secret <nome-do-secret>

# Ver o conteudo decodificado (sem dados sensiveis no terminal)
kubectl get secret <nome-do-secret> -o jsonpath='{.data}' | python3 -c "
import sys, json, base64
d = json.load(sys.stdin)
for k,v in d.items():
    print(f'{k}: {base64.b64decode(v).decode()}')
"
\`\`\``
    }
  ]
};
