window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['observability/probes'] = {
  theory: `# Probes e Health Checks no Kubernetes

## O que sao Probes?

Probes sao mecanismos de verificacao de saude que o kubelet executa periodicamente em containers. Elas permitem que o Kubernetes tome decisoes automaticas sobre reiniciar containers ou rotear trafego para eles.

Existem tres tipos de probes:
- **Liveness Probe**: verifica se o container esta vivo (running corretamente)
- **Readiness Probe**: verifica se o container esta pronto para receber trafego
- **Startup Probe**: verifica se a aplicacao dentro do container foi iniciada com sucesso

### Ordem de execucao das Probes

A ordem importa no ciclo de vida do container:

\`\`\`
Container inicia
      |
      v
[Startup Probe] -- executa ate ter sucesso ou atingir failureThreshold
      |                (liveness e readiness ficam DESABILITADAS aqui)
      v (sucesso)
[Liveness + Readiness] -- executam em paralelo, periodicamente
      |
      v
Pod recebe trafego (quando readiness passa)
\`\`\`

---

## Metodos de Probe (Handlers)

Existem 4 metodos para implementar qualquer tipo de probe:

| Handler | Descricao | Sucesso |
|---------|-----------|---------|
| httpGet | Faz requisicao HTTP GET | Status 2xx ou 3xx |
| tcpSocket | Abre conexao TCP na porta | Conexao aceita |
| exec | Executa comando no container | Exit code 0 |
| grpc | Verifica via protocolo gRPC | Status SERVING |

### httpGet
\`\`\`yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
    scheme: HTTP          # ou HTTPS
    httpHeaders:
    - name: Authorization
      value: Bearer token
    - name: Custom-Header
      value: Awesome
  initialDelaySeconds: 15
  periodSeconds: 10
\`\`\`

### tcpSocket
\`\`\`yaml
livenessProbe:
  tcpSocket:
    port: 3306            # ideal para MySQL, PostgreSQL, Redis
  initialDelaySeconds: 10
  periodSeconds: 20
\`\`\`

### exec
\`\`\`yaml
livenessProbe:
  exec:
    command:
    - cat
    - /tmp/healthy
    # ou: ["sh", "-c", "redis-cli ping"]
  initialDelaySeconds: 5
  periodSeconds: 5
\`\`\`

### grpc (stable desde K8s 1.27)
\`\`\`yaml
livenessProbe:
  grpc:
    port: 2379
    service: ""           # nome do servico gRPC (opcional)
  initialDelaySeconds: 10
  periodSeconds: 10
\`\`\`

---

## Parametros das Probes

| Parametro | Padrao | Descricao |
|-----------|--------|-----------|
| initialDelaySeconds | 0 | Segundos antes da primeira probe apos o container iniciar |
| periodSeconds | 10 | Intervalo entre cada verificacao |
| timeoutSeconds | 1 | Tempo maximo de espera por resposta |
| failureThreshold | 3 | Falhas consecutivas para considerar falha total |
| successThreshold | 1 | Sucessos consecutivos para considerar sucesso (apos falha) |
| terminationGracePeriodSeconds | - | Tempo para o container terminar graciosamente apos sinal de kill |

> **Atencao**: \`successThreshold\` deve ser sempre 1 para Liveness e Startup Probes. Apenas Readiness pode usar valores maiores.

---

## Liveness Probe

Determina se o container deve ser reiniciado. Se a probe falhar repetidamente (conforme failureThreshold), o kubelet mata o container e ele e reiniciado conforme a restartPolicy.

**Caso de uso**: detectar deadlocks, corrupcao de estado interno, ou travamentos que impedem a aplicacao de funcionar sem matar o processo.

### Exemplo completo com httpGet
\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: liveness-http
spec:
  containers:
  - name: app
    image: nginx:1.25
    ports:
    - containerPort: 8080
    resources:
      requests:
        cpu: "100m"
        memory: "128Mi"
      limits:
        cpu: "200m"
        memory: "256Mi"
    livenessProbe:
      httpGet:
        path: /healthz
        port: 8080
        httpHeaders:
        - name: Custom-Header
          value: Awesome
      initialDelaySeconds: 15
      periodSeconds: 10
      timeoutSeconds: 5
      failureThreshold: 3
      successThreshold: 1
\`\`\`

### Impacto da Liveness no ciclo de vida

1. Probe falha failureThreshold vezes consecutivas
2. kubelet envia SIGTERM ao container
3. Container tem terminationGracePeriodSeconds para encerrar
4. kubelet envia SIGKILL se o container nao encerrar
5. Container e reiniciado conforme restartPolicy (Always, OnFailure)

---

## Readiness Probe

Determina se o container esta pronto para receber trafego. Se falhar, o endpoint do Pod e removido dos Services. O Pod NAO e reiniciado - apenas fica fora de rotacao ate a probe passar novamente.

**Caso de uso**: aguardar carregamento de cache, conexao com banco de dados, warmup da JVM, carregamento de modelos de ML.

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: readiness-example
spec:
  containers:
  - name: app
    image: myapp:1.0
    ports:
    - containerPort: 8080
    resources:
      requests:
        cpu: "100m"
        memory: "128Mi"
      limits:
        cpu: "500m"
        memory: "512Mi"
    readinessProbe:
      httpGet:
        path: /ready
        port: 8080
      initialDelaySeconds: 5
      periodSeconds: 5
      timeoutSeconds: 2
      failureThreshold: 3
      successThreshold: 1
\`\`\`

### Impacto da Readiness no roteamento

\`\`\`
kubectl get endpoints meu-service

# Pod ready:
# ENDPOINTS: 10.0.0.5:8080,10.0.0.6:8080

# Apos readiness falhar no pod 10.0.0.6:
# ENDPOINTS: 10.0.0.5:8080
\`\`\`

---

## Startup Probe

Usada para containers que demoram para inicializar. Enquanto a startup probe nao tiver sucesso, as probes de liveness e readiness ficam completamente desabilitadas. Evita que a liveness probe mate containers lentos para iniciar.

**Caso de uso**: aplicacoes legadas, JVM com inicializacao lenta, aplicacoes que carregam grandes datasets na memoria.

\`\`\`yaml
startupProbe:
  httpGet:
    path: /healthz
    port: 8080
  failureThreshold: 30
  periodSeconds: 10
  # Tempo maximo de inicializacao: 30 * 10 = 300 segundos (5 minutos)
\`\`\`

### Calculo do tempo maximo de inicializacao

\`\`\`
Tempo maximo = failureThreshold x periodSeconds

Exemplos:
  failureThreshold: 30, periodSeconds: 10  -> 300s (5 min)
  failureThreshold: 20, periodSeconds: 15  -> 300s (5 min)
  failureThreshold: 60, periodSeconds: 5   -> 300s (5 min)
\`\`\`

---

## Combinando as tres Probes

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: full-probe-example
  labels:
    app: full-probe
spec:
  containers:
  - name: app
    image: myapp:2.0
    ports:
    - containerPort: 8080
    resources:
      requests:
        cpu: "250m"
        memory: "256Mi"
      limits:
        cpu: "500m"
        memory: "512Mi"
    startupProbe:
      httpGet:
        path: /startup
        port: 8080
      failureThreshold: 20
      periodSeconds: 10
      # Ate 200 segundos para a app inicializar
    livenessProbe:
      httpGet:
        path: /healthz
        port: 8080
      initialDelaySeconds: 0   # startup probe ja garantiu o init
      periodSeconds: 10
      timeoutSeconds: 3
      failureThreshold: 3
    readinessProbe:
      httpGet:
        path: /ready
        port: 8080
      initialDelaySeconds: 0
      periodSeconds: 5
      timeoutSeconds: 2
      failureThreshold: 3
      successThreshold: 1
\`\`\`

---

## Impacto no Ciclo de Vida e Roteamento de Trafego

| Probe | Falha | Efeito |
|-------|-------|--------|
| Startup | Atinge failureThreshold | Container reiniciado |
| Liveness | Atinge failureThreshold | Container reiniciado |
| Readiness | Qualquer falha | Pod removido dos Endpoints |
| Readiness | Sucesso apos falha | Pod adicionado de volta aos Endpoints |

### Cenario de Rolling Update

\`\`\`
Deployment com readinessProbe configurada:

1. Novo Pod criado
2. Startup Probe executa (se configurada)
3. Readiness Probe executa
4. SO o Pod entra no Service Endpoint QUANDO Readiness passa
5. Pod antigo e removido SOMENTE apos novo estar Ready
6. Zero downtime garantido
\`\`\`

---

## Erros Comuns e Boas Praticas

### Erros comuns

| Erro | Sintoma | Causa |
|------|---------|-------|
| Porta errada na probe | CrashLoopBackOff ou Not Ready | containerPort diferente da porta na probe |
| initialDelaySeconds muito baixo | CrashLoopBackOff imediato | App nao inicializou ainda quando probe executa |
| failureThreshold muito baixo | Reinicializacoes excessivas | Falhas transitorias causam restart desnecessario |
| Ausencia de Startup Probe | App lenta reinicia em loop | Liveness mata app que ainda esta inicializando |
| successThreshold > 1 em Liveness | Invalido | K8s rejeita: deve ser 1 para Liveness e Startup |

### Boas praticas por tipo de probe

**Liveness**:
- Verificar se a aplicacao responde (nao se esta totalmente saudavel)
- Manter simples - nao verificar dependencias externas
- Usar initialDelaySeconds conservador ou usar Startup Probe
- failureThreshold >= 3 para tolerar falhas transitorias

**Readiness**:
- Verificar dependencias necessarias (banco, cache, etc)
- Pode ser mais granular que a liveness
- successThreshold: 1 na maioria dos casos (exceto se quiser estabilidade confirmada)

**Startup**:
- Usar o mesmo endpoint que a liveness
- Calcular failureThreshold * periodSeconds para cobrir o pior caso de boot
- Desabilitar liveness/readiness iniciais ao usar startup probe

---

## Verificando Probes com kubectl

\`\`\`bash
# Ver configuracao das probes de um Pod
kubectl describe pod <pod-name> | grep -A 10 "Liveness\|Readiness\|Startup"

# Ver eventos relacionados a falhas de probe
kubectl get events --field-selector involvedObject.name=<pod-name>

# Verificar se o Pod esta recebendo trafego (endpoints)
kubectl get endpoints <service-name>

# Monitorar status de readiness em tempo real
kubectl get pod <pod-name> -w

# Ver todos os Pods Not Ready em um namespace
kubectl get pods --field-selector=status.containerStatuses[0].ready=false
\`\`\`
`,

  quiz: [
    {
      question: 'Qual probe impede que uma Liveness Probe reinicie um container que ainda esta inicializando?',
      options: [
        'Readiness Probe',
        'Startup Probe',
        'Health Probe',
        'Init Probe'
      ],
      correct: 1,
      explanation: 'A Startup Probe desabilita Liveness e Readiness Probes ate que ela tenha sucesso, evitando que containers lentos para iniciar sejam reiniciados prematuramente.'
    },
    {
      question: 'O que acontece quando uma Readiness Probe falha em um Pod que esta servindo trafego?',
      options: [
        'O container e reiniciado imediatamente',
        'O Pod e deletado e recriado',
        'O Pod e removido dos Endpoints do Service mas continua rodando',
        'O Node e marcado como NotReady'
      ],
      correct: 2,
      explanation: 'Readiness Probe controla se o Pod recebe trafego. Ao falhar, o Pod e removido dos Endpoints do Service, mas o container NAO e reiniciado. O Pod permanece em execucao e voltara aos Endpoints quando a probe passar novamente.'
    },
    {
      question: 'Qual e o valor padrao de failureThreshold para probes no Kubernetes?',
      options: ['1', '2', '3', '5'],
      correct: 2,
      explanation: 'O valor padrao de failureThreshold e 3. Isso significa que a probe precisa falhar 3 vezes consecutivas antes de ser considerada como falha e acionar o comportamento associado (restart ou remocao de endpoint).'
    },
    {
      question: 'Um Pod com startupProbe configurada com failureThreshold: 10 e periodSeconds: 12 tem quanto tempo maximo para inicializar?',
      options: ['10 segundos', '12 segundos', '100 segundos', '120 segundos'],
      correct: 3,
      explanation: 'O tempo maximo e failureThreshold * periodSeconds = 10 * 12 = 120 segundos. Apos esse periodo, se a startup probe nao tiver sucesso, o container e reiniciado pela liveness probe.'
    },
    {
      question: 'Qual metodo de probe e mais adequado para verificar a saude de um servidor de banco de dados MySQL?',
      options: [
        'httpGet na porta 3306',
        'tcpSocket na porta 3306',
        'exec rodando SELECT 1',
        'grpc na porta 3306'
      ],
      correct: 1,
      explanation: 'tcpSocket e ideal para servicos TCP como MySQL. Verifica se a porta esta aceitando conexoes sem necessidade de protocolo HTTP ou comando especifico. exec com SELECT 1 tambem funciona mas requer o cliente mysql instalado no container.'
    },
    {
      question: 'Em um deployment com Rolling Update, qual probe e ESSENCIAL para garantir zero downtime?',
      options: [
        'Liveness Probe',
        'Startup Probe',
        'Readiness Probe',
        'Todas as probes sao equivalentes'
      ],
      correct: 2,
      explanation: 'A Readiness Probe e essencial em Rolling Updates. O Kubernetes so envia trafego para novos Pods apos a Readiness Probe ter sucesso, garantindo que Pods antigos continuem servindo durante a transicao. Sem ela, trafego pode chegar ao Pod antes de estar pronto.'
    },
    {
      question: 'Qual e a versao minima do Kubernetes para usar gRPC probes de forma estavel (GA)?',
      options: ['1.20', '1.24', '1.27', '1.30'],
      correct: 2,
      explanation: 'gRPC probes foram introduzidas como alpha no 1.23, promovidas a beta no 1.24 e tornaram-se stable (GA) no Kubernetes 1.27. Para usar em producao, recomenda-se K8s >= 1.27.'
    },
    {
      question: 'Um container tem successThreshold: 3 na readinessProbe. O que isso significa?',
      options: [
        'A probe precisa passar 3 vezes para o container iniciar',
        'O container precisa passar na probe 3 vezes consecutivas para ser considerado Ready apos uma falha',
        'A probe so e executada 3 vezes no total',
        'successThreshold: 3 e invalido para readinessProbe'
      ],
      correct: 1,
      explanation: 'successThreshold define quantas vezes consecutivas a probe precisa ter sucesso para o recurso ser considerado saudavel novamente apos uma falha. Para Liveness e Startup, este valor deve ser sempre 1. Para Readiness, pode ser maior para garantir estabilidade.'
    },
    {
      question: 'Qual e o comportamento correto quando uma Liveness Probe falha?',
      options: [
        'O Pod e deletado permanentemente',
        'O Pod e removido do Service mas continua rodando',
        'O container e reiniciado conforme a restartPolicy do Pod',
        'Todos os containers do Pod sao reiniciados simultaneamente'
      ],
      correct: 2,
      explanation: 'Quando a Liveness Probe falha apos atingir failureThreshold, o kubelet reinicia apenas o container que falhou, conforme a restartPolicy do Pod. O Pod em si nao e recriado, apenas o container especifico.'
    },
    {
      question: 'Qual parametro define o tempo maximo que o kubelet aguarda por uma resposta de probe antes de considera-la falha?',
      options: [
        'periodSeconds',
        'initialDelaySeconds',
        'timeoutSeconds',
        'failureThreshold'
      ],
      correct: 2,
      explanation: 'timeoutSeconds (padrao: 1 segundo) define quanto tempo o kubelet aguarda pela resposta da probe. Se a resposta nao chegar dentro desse tempo, a tentativa e contada como falha. Valores muito baixos causam falsos negativos em endpoints lentos.'
    }
  ],

  flashcards: [
    {
      front: 'Qual e a diferenca entre Liveness e Readiness Probe?',
      back: 'Liveness: verifica se o container esta vivo; falha causa REINICIO do container.\nReadiness: verifica se esta pronto para trafego; falha REMOVE o Pod dos Endpoints do Service sem reiniciar.\n\nUse liveness para detectar deadlocks.\nUse readiness para aguardar dependencias estarem disponiveis.'
    },
    {
      front: 'O que e initialDelaySeconds e quando e necessario?',
      back: 'Numero de segundos que o kubelet aguarda antes de executar a primeira probe apos o container iniciar. Padrao: 0.\n\nUse quando:\n- App demora para inicializar\n- Nao ha Startup Probe configurada\n- A probe pode falhar durante o boot\n\nAlternativa moderna: use Startup Probe em vez de initialDelaySeconds alto.'
    },
    {
      front: 'Como calcular o tempo maximo de inicializacao com Startup Probe?',
      back: 'Tempo maximo = failureThreshold x periodSeconds\n\nExemplos:\n  failureThreshold: 30, periodSeconds: 10 = 300s (5 min)\n  failureThreshold: 20, periodSeconds: 15 = 300s (5 min)\n\nApos esse tempo, se a startup probe nao tiver sucesso, o container e reiniciado.'
    },
    {
      front: 'Quais sao os 4 metodos (handlers) de probe disponiveis?',
      back: '1. httpGet: requisicao HTTP GET em path/porta (sucesso = 2xx/3xx)\n2. tcpSocket: verifica se porta TCP aceita conexao\n3. exec: executa comando no container (sucesso = exit code 0)\n4. grpc: protocolo gRPC (stable >= K8s 1.27)'
    },
    {
      front: 'O que significa successThreshold: 2 em uma Readiness Probe?',
      back: 'O Pod precisa passar na probe 2 vezes CONSECUTIVAS para ser considerado Ready novamente apos ter falhado.\n\nPadrao e 1.\nPara Liveness e Startup, deve ser SEMPRE 1 (K8s rejeita valores maiores).\nPara Readiness, pode ser maior para garantir estabilidade antes de receber trafego.'
    },
    {
      front: 'Qual e o comportamento das Liveness e Readiness Probes enquanto a Startup Probe nao teve sucesso?',
      back: 'Enquanto a Startup Probe estiver em execucao (sem sucesso ainda), Liveness e Readiness Probes sao completamente DESABILITADAS.\n\nIsso protege containers lentos de serem reiniciados prematuramente pela liveness probe. Apos a startup ter sucesso, liveness e readiness passam a executar normalmente.'
    },
    {
      front: 'Quando usar probe do tipo exec?',
      back: 'Use exec quando:\n1. O servico nao tem endpoint HTTP ou TCP verificavel\n2. Precisa de logica customizada de health check\n3. Verifica existencia de arquivo (ex: touch /tmp/healthy)\n4. Executa query de saude (redis-cli ping, mysqladmin ping)\n\nO comando deve retornar exit code 0 para sucesso.'
    },
    {
      front: 'Qual e o impacto de uma Readiness Probe no Rolling Update de um Deployment?',
      back: 'Com Readiness Probe:\n1. Novo Pod criado\n2. Readiness Probe executa\n3. Kubernetes aguarda o Pod ficar Ready\n4. So entao o Pod entra nos Endpoints do Service\n5. Pod antigo e removido APOS o novo estar Ready\n\nSem Readiness Probe: trafego pode chegar ao Pod antes de estar pronto (downtime).'
    },
    {
      front: 'Quais sao os erros mais comuns na configuracao de probes?',
      back: '1. Porta errada (containerPort diferente da porta da probe)\n2. initialDelaySeconds muito baixo (app nao inicializou)\n3. failureThreshold muito baixo (falhas transitorias causam restart)\n4. Ausencia de Startup Probe para apps lentas\n5. successThreshold > 1 em Liveness (invalido)\n6. timeoutSeconds muito baixo (endpoint lento conta como falha)'
    },
    {
      front: 'Como verificar se os Pods estao recebendo trafego do Service?',
      back: '# Ver endpoints populados do Service\nkubectl get endpoints <service-name>\n\n# Ver quais Pods estao Ready\nkubectl get pods -l <label-selector>\n\n# Ver eventos de readiness\nkubectl get events --field-selector involvedObject.name=<pod>\n\n# Monitorar em tempo real\nkubectl get pod <pod-name> -w'
    },
    {
      front: 'Qual e a diferenca entre Liveness e Startup Probe na pratica?',
      back: 'Startup Probe:\n- Executa UMA VEZ ate ter sucesso ou esgotar failureThreshold\n- Protege o periodo de inicializacao\n- Desabilita liveness e readiness enquanto executa\n\nLiveness Probe:\n- Executa CONTINUAMENTE durante toda a vida do container\n- Detecta degradacao de estado apos inicializacao\n- Nao deve ser usada para verificar inicializacao lenta'
    },
    {
      front: 'Como interpretar o campo terminationGracePeriodSeconds em relacao a probes?',
      back: 'terminationGracePeriodSeconds define quanto tempo o container tem para encerrar apos receber SIGTERM (gerado pela falha da liveness probe).\n\nFluxo:\n1. Liveness falha failureThreshold vezes\n2. kubelet envia SIGTERM\n3. Container tem terminationGracePeriodSeconds (padrao: 30s) para encerrar\n4. Se nao encerrar: kubelet envia SIGKILL\n\nConfigure este valor para ser maior que o tempo de shutdown gracioso da app.'
    }
  ],

  lab: {
    scenario: 'Voce e responsavel por configurar health checks para uma aplicacao web critica em producao. A aplicacao demora cerca de 30 segundos para inicializar, pode entrar em deadlock ocasionalmente, e precisa estar completamente pronta antes de receber trafego.',
    objective: 'Configurar corretamente Startup, Liveness e Readiness Probes em um Pod, validar o comportamento de cada probe, simular cenarios de falha e verificar o impacto no roteamento de trafego.',
    steps: [
      {
        title: 'Criar Pod com as tres probes configuradas',
        instruction: `Crie um Pod chamado \`webapp-probes\` no namespace \`default\` usando a imagem \`nginx:1.25\`. Configure:
- **Startup Probe**: httpGet em / porta 80, failureThreshold: 6, periodSeconds: 5 (30 segundos max)
- **Liveness Probe**: httpGet em / porta 80, periodSeconds: 10, timeoutSeconds: 3, failureThreshold: 3
- **Readiness Probe**: httpGet em / porta 80, periodSeconds: 5, timeoutSeconds: 2, failureThreshold: 3

Inclua resources requests e limits. Crie o arquivo \`webapp-probes.yaml\` com o manifesto completo.`,
        hints: [
          'Use kubectl run --dry-run=client -o yaml para gerar o template base',
          'As tres probes ficam dentro do spec.containers[] - cada uma tem sua chave: startupProbe, livenessProbe, readinessProbe',
          'O nginx serve na porta 80 por padrao com a pagina default em /'
        ],
        solution: `\`\`\`bash
cat <<EOF > webapp-probes.yaml
apiVersion: v1
kind: Pod
metadata:
  name: webapp-probes
  namespace: default
  labels:
    app: webapp-probes
spec:
  containers:
  - name: webapp
    image: nginx:1.25
    ports:
    - containerPort: 80
    resources:
      requests:
        cpu: "100m"
        memory: "128Mi"
      limits:
        cpu: "200m"
        memory: "256Mi"
    startupProbe:
      httpGet:
        path: /
        port: 80
      failureThreshold: 6
      periodSeconds: 5
    livenessProbe:
      httpGet:
        path: /
        port: 80
      periodSeconds: 10
      timeoutSeconds: 3
      failureThreshold: 3
    readinessProbe:
      httpGet:
        path: /
        port: 80
      periodSeconds: 5
      timeoutSeconds: 2
      failureThreshold: 3
      successThreshold: 1
EOF

kubectl apply -f webapp-probes.yaml
kubectl get pod webapp-probes -w
\`\`\``
      },
      {
        title: 'Verificar status das probes e eventos',
        instruction: `Aguarde o Pod ficar Running e verifique:
1. O status do Pod com \`kubectl get pod\`
2. Os detalhes das probes configuradas com \`kubectl describe pod\`
3. Os eventos relacionados ao Pod
4. Se o Pod esta nos Endpoints de um Service

Identifique na saida do describe: a configuracao de cada probe, a contagem de reinicializacoes e o estado de Ready.`,
        hints: [
          'kubectl describe pod webapp-probes | grep -A 10 Liveness mostra a config da probe',
          'A secao Events mostra historico de acoes do kubelet incluindo falhas de probe',
          'Restart Count no describe indica quantas vezes o container foi reiniciado',
          'READY 1/1 no kubectl get pod indica que a readiness probe passou'
        ],
        solution: `\`\`\`bash
# Verificar status geral
kubectl get pod webapp-probes -o wide

# Detalhar configuracao das probes (procure Startup, Liveness, Readiness)
kubectl describe pod webapp-probes

# Verificar apenas a secao de probes
kubectl describe pod webapp-probes | grep -A 7 "Startup:\\|Liveness:\\|Readiness:"

# Verificar o numero de restarts
kubectl describe pod webapp-probes | grep "Restart Count"

# Verificar eventos do Pod
kubectl get events --field-selector involvedObject.name=webapp-probes --sort-by='.lastTimestamp'

# Ver se o pod esta Ready
kubectl get pod webapp-probes -o jsonpath='{.status.containerStatuses[0].ready}'
\`\`\``
      },
      {
        title: 'Simular falha de Liveness Probe com exec probe',
        instruction: `Crie um segundo Pod chamado \`liveness-exec\` que usa uma exec probe para verificar existencia do arquivo \`/tmp/healthy\`. O container deve:
1. Criar o arquivo /tmp/healthy no inicio
2. Deletar o arquivo apos 30 segundos (simulando falha)
3. Dormir por 600 segundos (manter o container ativo para observacao)

Use a imagem \`busybox:1.36\` com o comando que cria e depois deleta o arquivo.
Observe o Pod ser reiniciado automaticamente pela liveness probe.`,
        hints: [
          'Use command: ["sh", "-c", "touch /tmp/healthy; sleep 30; rm -f /tmp/healthy; sleep 600"]',
          'A liveness probe deve usar exec: command: ["cat", "/tmp/healthy"]',
          'Monitore com: kubectl get pod liveness-exec -w',
          'Apos ~45 segundos, o Pod deve mostrar RESTARTS: 1'
        ],
        solution: `\`\`\`bash
cat <<EOF > liveness-exec.yaml
apiVersion: v1
kind: Pod
metadata:
  name: liveness-exec
spec:
  containers:
  - name: app
    image: busybox:1.36
    command: ["sh", "-c", "touch /tmp/healthy; sleep 30; rm -f /tmp/healthy; sleep 600"]
    resources:
      requests:
        cpu: "50m"
        memory: "64Mi"
      limits:
        cpu: "100m"
        memory: "128Mi"
    livenessProbe:
      exec:
        command:
        - cat
        - /tmp/healthy
      initialDelaySeconds: 5
      periodSeconds: 5
      failureThreshold: 3
EOF

kubectl apply -f liveness-exec.yaml

# Monitorar o Pod (aguarde ~45-60 segundos para ver o restart)
kubectl get pod liveness-exec -w

# Em outro terminal, verificar eventos de falha
kubectl describe pod liveness-exec | tail -20

# Verificar o motivo do restart
kubectl describe pod liveness-exec | grep -A 5 "Last State"
\`\`\``
      },
      {
        title: 'Validar impacto da Readiness Probe no Service',
        instruction: `Crie um Deployment chamado \`readiness-demo\` com 2 replicas usando nginx:1.25, e um Service chamado \`readiness-svc\` expondo o Deployment.

Configure uma Readiness Probe em /nao-existe porta 80.
Como /nao-existe retorna 404, os Pods devem ficar Not Ready. Verifique que os Endpoints do Service ficam vazios.

Em seguida, corrija a probe para usar / e observe os Pods voltarem a receber trafego.`,
        hints: [
          'kubectl get endpoints readiness-svc para ver os endpoints (deve estar vazio)',
          'kubectl get pods -l app=readiness-demo mostra READY 0/1 para todos os pods',
          'Para corrigir: kubectl patch deployment readiness-demo ou kubectl edit deployment',
          'Apos o patch, aguarde o rollout e veja os endpoints serem populados'
        ],
        solution: `\`\`\`bash
cat <<EOF > readiness-demo.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: readiness-demo
spec:
  replicas: 2
  selector:
    matchLabels:
      app: readiness-demo
  template:
    metadata:
      labels:
        app: readiness-demo
    spec:
      containers:
      - name: nginx
        image: nginx:1.25
        ports:
        - containerPort: 80
        resources:
          requests:
            cpu: "100m"
            memory: "128Mi"
          limits:
            cpu: "200m"
            memory: "256Mi"
        readinessProbe:
          httpGet:
            path: /nao-existe
            port: 80
          periodSeconds: 5
          failureThreshold: 3
---
apiVersion: v1
kind: Service
metadata:
  name: readiness-svc
spec:
  selector:
    app: readiness-demo
  ports:
  - port: 80
    targetPort: 80
EOF

kubectl apply -f readiness-demo.yaml

# Verificar que Pods estao Not Ready (READY: 0/1)
kubectl get pods -l app=readiness-demo

# Verificar que Endpoints estao vazios (nenhum Pod pronto)
kubectl get endpoints readiness-svc

# Corrigir a probe para usar o path correto
kubectl patch deployment readiness-demo --type=json \
  -p='[{"op":"replace","path":"/spec/template/spec/containers/0/readinessProbe/httpGet/path","value":"/"}]'

# Aguardar rollout
kubectl rollout status deployment/readiness-demo

# Verificar que endpoints foram populados
kubectl get endpoints readiness-svc
kubectl get pods -l app=readiness-demo
\`\`\``
      },
      {
        title: 'Debug de probe com porta incorreta',
        instruction: `Crie um Pod chamado \`probe-wrong-port\` com nginx:1.25 mas configure a Liveness Probe na porta 9999 (porta errada - nginx escuta na 80).

Observe o Pod entrar em CrashLoopBackOff, diagnostique o problema usando kubectl describe e events, e corrija a configuracao.`,
        hints: [
          'O nginx escuta na porta 80, mas a probe aponta para 9999',
          'kubectl describe pod probe-wrong-port | grep -A 5 "Liveness" mostra a config',
          'A mensagem de erro nos eventos indica "connection refused" na porta 9999',
          'Corrigir: kubectl delete pod e recriar com a porta correta, ou editar o deployment'
        ],
        solution: `\`\`\`bash
# Criar pod com probe na porta errada
cat <<EOF > probe-wrong-port.yaml
apiVersion: v1
kind: Pod
metadata:
  name: probe-wrong-port
spec:
  containers:
  - name: nginx
    image: nginx:1.25
    ports:
    - containerPort: 80
    resources:
      requests:
        cpu: "100m"
        memory: "128Mi"
      limits:
        cpu: "200m"
        memory: "256Mi"
    livenessProbe:
      httpGet:
        path: /
        port: 9999     # ERRADO: nginx escuta em 80
      initialDelaySeconds: 5
      periodSeconds: 5
      failureThreshold: 3
EOF

kubectl apply -f probe-wrong-port.yaml

# Monitorar o Pod entrar em CrashLoopBackOff
kubectl get pod probe-wrong-port -w

# Diagnosticar o problema
kubectl describe pod probe-wrong-port | grep -A 10 "Liveness:"
kubectl describe pod probe-wrong-port | grep -A 15 Events

# Ver mensagem de erro especifica
kubectl get events --field-selector involvedObject.name=probe-wrong-port

# Corrigir: recriar o Pod com a porta correta
kubectl delete pod probe-wrong-port

sed 's/port: 9999/port: 80/' probe-wrong-port.yaml > probe-fixed.yaml
kubectl apply -f probe-fixed.yaml

# Verificar que o Pod esta saudavel agora
kubectl get pod probe-fixed
kubectl describe pod probe-fixed | grep -A 5 "Liveness:"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Pod em CrashLoopBackOff por Liveness Probe muito agressiva',
      symptom: 'Pod entra em CrashLoopBackOff logo apos ser criado. kubectl describe mostra "Liveness probe failed" nos eventos com mensagem "connection refused" ou "context deadline exceeded". A aplicacao funciona corretamente quando testada manualmente apos alguns segundos.',
      diagnosis: `Verifique os parametros da Liveness Probe e o tempo de inicializacao real da aplicacao:

\`\`\`bash
# Verificar configuracao da probe e eventos
kubectl describe pod <pod-name> | grep -A 10 "Liveness:"
kubectl describe pod <pod-name> | grep -A 20 "Events:"

# Verificar logs do container antes do restart
kubectl logs <pod-name> --previous

# Ver o exit code do ultimo restart
kubectl describe pod <pod-name> | grep -A 5 "Last State:"

# Verificar quantas vezes o container foi reiniciado
kubectl get pod <pod-name> -o jsonpath='{.status.containerStatuses[0].restartCount}'

# Testar manualmente o endpoint da probe de dentro do Pod
kubectl exec <pod-name> -- wget -qO- http://localhost:8080/healthz
\`\`\`

Causas comuns:
- initialDelaySeconds muito baixo (app nao terminou de inicializar quando probe executa)
- timeoutSeconds muito baixo (probe expira antes da resposta chegar)
- failureThreshold muito baixo (uma falha transitoria causa restart)
- Porta errada na probe (connection refused)
- Ausencia de Startup Probe para apps com inicializacao demorada`,
      solution: `**Solucao 1**: Adicionar Startup Probe para isolar o periodo de inicializacao (recomendada):
\`\`\`yaml
startupProbe:
  httpGet:
    path: /healthz
    port: 8080
  failureThreshold: 30   # 30 * 10 = 300 segundos para inicializar
  periodSeconds: 10
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
\`\`\`

**Solucao 2**: Aumentar initialDelaySeconds para cobrir o tempo de boot:
\`\`\`yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: 60   # aguardar 60s antes da primeira probe
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
\`\`\`

**Solucao 3**: Aumentar timeoutSeconds se a resposta da probe e lenta:
\`\`\`yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  timeoutSeconds: 10      # aguardar ate 10s por resposta
  periodSeconds: 15
  failureThreshold: 3
\`\`\`

**Verificar apos correcao**:
\`\`\`bash
kubectl rollout status deployment/<nome>
kubectl get pod -l app=<nome>
kubectl describe pod <pod-name> | grep -A 5 "Restart Count"
\`\`\``
    },
    {
      title: 'Deployment nao completa Rolling Update - Pods presos em Not Ready',
      symptom: 'kubectl rollout status deployment/myapp trava e nunca completa. Novos Pods ficam no status Running mas READY mostra 0/1. O Service nao roteia trafego para os novos Pods. O rollout fica em progresso indefinidamente.',
      diagnosis: `\`\`\`bash
# Verificar status dos pods (novos vs antigos)
kubectl get pods -l app=myapp

# Verificar eventos dos novos pods
kubectl describe pod <novo-pod> | grep -A 20 "Events:"

# Ver a configuracao da readiness probe
kubectl describe pod <novo-pod> | grep -A 10 "Readiness:"

# Verificar endpoints do service (deve estar vazio para novos pods)
kubectl get endpoints <service-name>

# Testar manualmente o endpoint da readiness probe
kubectl exec <novo-pod> -- wget -qO- http://localhost:8080/ready
# ou
kubectl exec <novo-pod> -- curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/ready

# Ver o que o path retorna
kubectl exec <novo-pod> -- wget -qO- http://localhost:8080/ready 2>&1
\`\`\`

O problema tipico e que a Readiness Probe aponta para um path que:
- Nao existe (retorna 404)
- Retorna status != 2xx (ex: 500 porque dependencia nao esta pronta)
- Retorna apos o timeout configurado`,
      solution: `\`\`\`bash
# Identificar o path correto da readiness probe
kubectl exec <novo-pod> -- wget -qO- http://localhost:8080/
kubectl exec <novo-pod> -- wget -qO- http://localhost:8080/health

# Corrigir via kubectl edit
kubectl edit deployment myapp
# Alterar spec.template.spec.containers[0].readinessProbe.httpGet.path

# Ou via patch (mais rapido para o exame):
kubectl patch deployment myapp --type=json \
  -p='[{"op":"replace","path":"/spec/template/spec/containers/0/readinessProbe/httpGet/path","value":"/healthz"}]'

# Acompanhar o rollout apos correcao
kubectl rollout status deployment/myapp

# Verificar endpoints sendo populados
kubectl get endpoints <service-name> -w

# Se necessario, fazer rollback enquanto investiga:
kubectl rollout undo deployment/myapp
kubectl rollout status deployment/myapp
\`\`\``
    },
    {
      title: 'Pod nunca fica Ready - Readiness Probe falha mesmo com app saudavel',
      symptom: 'Pod esta em estado Running mas READY mostra 0/1 permanentemente. A aplicacao responde normalmente quando acessada manualmente via kubectl exec. kubectl get events nao mostra erros obvios. O Pod nunca entra nos Endpoints do Service.',
      diagnosis: `\`\`\`bash
# Confirmar que o pod esta rodando mas nao Ready
kubectl get pod <pod-name>
# OUTPUT esperado: STATUS=Running, READY=0/1

# Ver configuracao da readiness probe
kubectl describe pod <pod-name> | grep -A 15 "Readiness:"

# Verificar porta da probe vs porta do container
kubectl describe pod <pod-name> | grep -E "Port:|readinessProbe"

# Testar manualmente o endpoint da probe de dentro do Pod
kubectl exec <pod-name> -- wget -qO- http://localhost:<porta>/<path>
kubectl exec <pod-name> -- curl -v http://localhost:<porta>/<path>

# Verificar se a porta esta aberta dentro do Pod
kubectl exec <pod-name> -- netstat -tlnp
# ou
kubectl exec <pod-name> -- ss -tlnp

# Ver logs da aplicacao para erros de saude
kubectl logs <pod-name>

# Verificar se ha successThreshold alto que atrasa o Ready
kubectl get pod <pod-name> -o yaml | grep -A 20 readinessProbe
\`\`\`

Causas possiveis:
- Porta da probe diferente da porta que a app escuta
- Path da probe retorna status != 2xx (ex: autenticacao necessaria)
- successThreshold alto requerendo muitas verificacoes antes de Ready
- App escuta em 0.0.0.0 mas probe aponta para 127.0.0.1 ou vice-versa`,
      solution: `**Diagnostico e correcao de porta errada**:
\`\`\`bash
# Verificar em qual porta a app esta escutando
kubectl exec <pod-name> -- netstat -tlnp | grep LISTEN

# Corrigir a porta na readiness probe
kubectl patch deployment <nome> --type=json \
  -p='[{"op":"replace","path":"/spec/template/spec/containers/0/readinessProbe/httpGet/port","value":8080}]'
\`\`\`

**Diagnostico e correcao de path que requer autenticacao**:
\`\`\`bash
# Testar com header de autorizacao
kubectl exec <pod-name> -- wget -qO- \
  --header="Authorization: Bearer token" \
  http://localhost:8080/ready

# Configurar header na probe
# kubectl edit deployment <nome> e adicionar httpHeaders:
readinessProbe:
  httpGet:
    path: /ready
    port: 8080
    httpHeaders:
    - name: Authorization
      value: Bearer health-check-token
\`\`\`

**Verificar apos correcao**:
\`\`\`bash
# Aguardar Pod ficar Ready
kubectl get pod <pod-name> -w

# Confirmar entrada nos Endpoints
kubectl get endpoints <service-name>
\`\`\``
    }
  ]
};
