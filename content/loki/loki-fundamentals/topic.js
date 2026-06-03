window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['loki/loki-fundamentals'] = {
  theory: `# Loki — Fundamentos

## Relevância no Exame
> Loki é cobrado em certificações focadas em observabilidade e operações de plataforma (CKA avançado, KCNA, KubeAstronaut). Envolve arquitetura de logging, deploy em Kubernetes e consultas básicas com LogQL.

## Conceitos Fundamentais

### O que é Loki?
Loki é um sistema de agregação de logs horizontalmente escalável, altamente disponível e multi-tenant, inspirado no Prometheus. Desenvolvido pela Grafana Labs, a principal diferença em relação ao Elasticsearch é a **estratégia de indexação**: Loki indexa **apenas metadados (labels)**, não o conteúdo dos logs.

### Loki vs Elasticsearch
| Característica | Loki | Elasticsearch |
|----------------|------|---------------|
| Indexação | Apenas labels | Full-text completo |
| Custo de storage | Baixo | Alto |
| Custo computacional | Baixo | Alto |
| Busca full-text | Limitada (grep) | Poderosa |
| Integração Grafana | Nativa | Via plugin |
| Complexidade | Baixa | Alta |
| Uso ideal | Cloud-native / K8s | Logs corporativos complexos |

### Arquitetura do Stack PLG
O stack **PLG** (Promtail + Loki + Grafana) é o equivalente ao stack ELK para Kubernetes:

\`\`\`
┌─────────────────────────────────────────────────────┐
│                  Kubernetes Cluster                  │
│                                                      │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐      │
│  │ Pod App  │    │ Pod App  │    │ Pod App  │      │
│  └────┬─────┘    └────┬─────┘    └────┬─────┘      │
│       │               │               │              │
│  ┌────▼───────────────▼───────────────▼─────┐      │
│  │         Promtail (DaemonSet)              │      │
│  │   Coleta logs de /var/log/pods/*          │      │
│  └───────────────────┬───────────────────────┘      │
│                      │ Push (HTTP)                   │
│  ┌───────────────────▼───────────────────────┐      │
│  │              Loki (StatefulSet)            │      │
│  │   Ingest → Compress → Store               │      │
│  └───────────────────┬───────────────────────┘      │
│                      │ Query (LogQL)                 │
│  ┌───────────────────▼───────────────────────┐      │
│  │            Grafana (Deployment)            │      │
│  │   Dashboards + Alerting                   │      │
│  └───────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────┘
\`\`\`

### Componentes do Loki

**Distributor**: Recebe os log streams e distribui para os ingesters. Valida labels e faz rate limiting.

**Ingester**: Armazena logs em memória (chunks) e periodicamente faz flush para o storage backend.

**Querier**: Executa queries LogQL, consultando ingesters (dados recentes) e storage (dados históricos).

**Query Frontend**: Otimiza queries, faz cache e distribui queries grandes em partes menores.

**Compactor**: Compacta arquivos de índice para reduzir storage.

**Ruler**: Avalia regras de alerting baseadas em LogQL.

### Labels: O Coração do Loki
Labels são a chave para performance. Labels ruins = alto custo.

\`\`\`yaml
# Boas labels (baixa cardinalidade)
{namespace="production", app="api", pod_template_hash="abc123"}

# Labels ruins (alta cardinalidade - EVITAR)
{pod="api-7d9f8b-xk2j9"}   # muda a cada restart
{ip="10.0.0.42"}            # única por pod
{user_id="12345"}           # infinita cardinalidade
\`\`\`

### Promtail — O Agente de Coleta
Promtail é um DaemonSet que:
1. Descobre automaticamente pods via Kubernetes SD
2. Lê logs de \`/var/log/pods/\`
3. Enriquece com labels do Kubernetes (namespace, app, container)
4. Envia para Loki via HTTP push

\`\`\`yaml
# Pipeline de processamento Promtail
scrape_configs:
  - job_name: kubernetes-pods
    kubernetes_sd_configs:
      - role: pod
    pipeline_stages:
      - cri: {}           # Parse do formato CRI-O/containerd
      - labeldrop:
          - filename      # Remove label desnecessária
\`\`\`

### Modos de Deploy

**Single Binary (Monolithic)**: Todos os componentes em um único processo. Ideal para dev/small clusters.

**Simple Scalable**: Separa write path (distributor+ingester) e read path (querier+frontend). Recomendado para produção.

**Microservices**: Cada componente separado. Para escala máxima.

## Comandos Essenciais

### Deploy com Helm
\`\`\`bash
# Adicionar repositório Grafana
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Instalar stack completo (Loki + Promtail + Grafana)
helm install loki-stack grafana/loki-stack \\
  --namespace monitoring \\
  --create-namespace \\
  --set grafana.enabled=true \\
  --set promtail.enabled=true \\
  --set loki.persistence.enabled=true \\
  --set loki.persistence.size=10Gi

# Verificar instalação
kubectl get pods -n monitoring
kubectl get svc -n monitoring

# Ver logs do Loki
kubectl logs -n monitoring -l app=loki -f

# Acessar Grafana (port-forward)
kubectl port-forward -n monitoring svc/loki-stack-grafana 3000:80
# Senha padrão:
kubectl get secret -n monitoring loki-stack-grafana -o jsonpath='{.data.admin-password}' | base64 -d
\`\`\`

### Verificar Status do Loki
\`\`\`bash
# Checar membros do ring (hash ring)
kubectl exec -n monitoring -it loki-0 -- \\
  wget -qO- http://localhost:3100/ring

# Checar métricas do Loki
kubectl exec -n monitoring -it loki-0 -- \\
  wget -qO- http://localhost:3100/metrics | grep loki_ingester

# Ver configuração atual
kubectl exec -n monitoring -it loki-0 -- \\
  wget -qO- http://localhost:3100/config

# Ready check
kubectl exec -n monitoring -it loki-0 -- \\
  wget -qO- http://localhost:3100/ready
\`\`\`

### Promtail - Verificação
\`\`\`bash
# Ver status do Promtail
kubectl exec -n monitoring -it ds/promtail -- \\
  wget -qO- http://localhost:9080/targets

# Ver métricas de scraping
kubectl logs -n monitoring -l app=promtail --tail=50

# Verificar pipelines de processamento
kubectl exec -n monitoring -it ds/promtail -- \\
  wget -qO- http://localhost:9080/metrics | grep promtail_targets
\`\`\`

## Exemplos YAML

### Loki com Storage S3 (Produção)
\`\`\`yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: loki-config
  namespace: monitoring
data:
  loki.yaml: |
    auth_enabled: false

    server:
      http_listen_port: 3100
      grpc_listen_port: 9096

    common:
      path_prefix: /tmp/loki
      storage:
        s3:
          endpoint: s3.amazonaws.com
          region: us-east-1
          bucketnames: my-loki-logs
          access_key_id: \${AWS_ACCESS_KEY_ID}
          secret_access_key: \${AWS_SECRET_ACCESS_KEY}
      replication_factor: 1

    schema_config:
      configs:
        - from: 2024-01-01
          store: tsdb
          object_store: s3
          schema: v13
          index:
            prefix: loki_index_
            period: 24h

    limits_config:
      reject_old_samples: true
      reject_old_samples_max_age: 168h
      ingestion_rate_mb: 16
      ingestion_burst_size_mb: 32
      max_streams_per_user: 10000
      max_label_names_per_series: 30

    compactor:
      working_directory: /tmp/loki/boltdb-shipper-compactor
      retention_enabled: true
      retention_delete_delay: 2h
      delete_request_store: s3

    ruler:
      storage:
        type: local
        local:
          directory: /etc/loki/rules
\`\`\`

### Promtail ConfigMap
\`\`\`yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: promtail-config
  namespace: monitoring
data:
  promtail.yaml: |
    server:
      http_listen_port: 9080
      grpc_listen_port: 0

    positions:
      filename: /tmp/positions.yaml

    clients:
      - url: http://loki:3100/loki/api/v1/push
        tenant_id: default
        backoff_config:
          min_period: 500ms
          max_period: 5m
          max_retries: 10

    scrape_configs:
      - job_name: kubernetes-pods
        kubernetes_sd_configs:
          - role: pod

        pipeline_stages:
          - cri: {}
          - match:
              selector: '{app="nginx"}'
              stages:
                - regex:
                    expression: '(?P<method>GET|POST|PUT|DELETE) (?P<path>[^ ]+) HTTP/[\\d.]+ (?P<status>\\d+)'
                - labels:
                    method:
                    status:
          - labeldrop:
              - filename
              - stream

        relabel_configs:
          - source_labels: [__meta_kubernetes_pod_label_app]
            target_label: app
          - source_labels: [__meta_kubernetes_namespace]
            target_label: namespace
          - source_labels: [__meta_kubernetes_pod_name]
            target_label: pod
          - source_labels: [__meta_kubernetes_pod_container_name]
            target_label: container
\`\`\`

### Promtail DaemonSet
\`\`\`yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: promtail
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: promtail
  template:
    metadata:
      labels:
        app: promtail
    spec:
      serviceAccountName: promtail
      tolerations:
        - key: node-role.kubernetes.io/control-plane
          operator: Exists
          effect: NoSchedule
      containers:
        - name: promtail
          image: grafana/promtail:3.0.0
          args:
            - -config.file=/etc/promtail/promtail.yaml
          env:
            - name: HOSTNAME
              valueFrom:
                fieldRef:
                  fieldPath: spec.nodeName
          ports:
            - containerPort: 9080
              name: http
          securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop: ["ALL"]
            readOnlyRootFilesystem: true
            runAsGroup: 0
          volumeMounts:
            - name: config
              mountPath: /etc/promtail
            - name: run
              mountPath: /run/promtail
            - name: containers
              mountPath: /var/lib/docker/containers
              readOnly: true
            - name: pods
              mountPath: /var/log/pods
              readOnly: true
      volumes:
        - name: config
          configMap:
            name: promtail-config
        - name: run
          hostPath:
            path: /run/promtail
        - name: containers
          hostPath:
            path: /var/lib/docker/containers
        - name: pods
          hostPath:
            path: /var/log/pods
\`\`\`

### Retenção de Logs por Namespace (multi-tenant)
\`\`\`yaml
# limits_config no loki.yaml para retenção por tenant
limits_config:
  per_tenant_override_config: /etc/loki/tenants.yaml
  retention_period: 30d

# tenants.yaml
overrides:
  production:
    retention_period: 90d
    ingestion_rate_mb: 32
  development:
    retention_period: 7d
    ingestion_rate_mb: 8
\`\`\`

## Erros Comuns

### 1. Cardinality Explosion
**Problema**: Labels com alta cardinalidade causam OOM e lentidão severa.
**Causa**: Usar pod name, IP, user_id ou request_id como label.
**Solução**: Manter labels estáticas — apenas namespace, app, environment, job.

### 2. Chunk Encoding Error
**Problema**: \`error: entry out of order\`
**Causa**: Promtail enviando logs fora de ordem (timestamps antigos).
**Solução**: Configurar \`reject_old_samples: true\` e verificar sincronização de NTP nos nodes.

### 3. Rate Limiting
**Problema**: \`ingestion rate limit exceeded\`
**Causa**: Burst de logs ultrapassando \`ingestion_burst_size_mb\`.
**Solução**: Aumentar limites ou adicionar filtros no Promtail para reduzir volume.

### 4. Promtail não coleta logs de pods novos
**Causa**: ServiceAccount sem permissão de listagem de pods.
**Solução**: Verificar ClusterRole do Promtail (precisa de \`list\`, \`watch\` em pods).

### 5. Storage cheio
**Causa**: Compactor não ativado ou retenção não configurada.
**Solução**: Habilitar \`retention_enabled: true\` no compactor e definir \`retention_period\`.

## Killer.sh Style Challenge

**Contexto**: O cluster de produção está perdendo logs. O time de SRE reporta que logs de pods no namespace \`payments\` não aparecem no Grafana há 2 horas.

**Tarefas**:
1. Verifique se o Promtail está rodando em todos os nodes (deve ser DaemonSet)
2. Identifique se o Loki está recebendo streams do namespace \`payments\`
3. Verifique se há erros de rate limiting nos logs do Loki
4. Inspecione a configuração do Promtail e confirme que o namespace \`payments\` não está sendo dropado por alguma regra
5. Execute uma query LogQL para confirmar ausência de logs: \`{namespace="payments"}\`

**Dica**: O problema mais comum é um \`pipeline_stages\` com \`match\` e \`action: drop\` incorreto no ConfigMap do Promtail.`,

  quiz: [
    {
      question: 'Qual é a principal diferença arquitetural entre Loki e Elasticsearch para indexação de logs?',
      options: [
        'Loki indexa apenas labels (metadados), não o conteúdo dos logs',
        'Loki usa índices invertidos completos como o Elasticsearch',
        'Loki armazena logs em formato JSON enquanto Elasticsearch usa binário',
        'Loki não suporta indexação, fazendo scan completo sempre'
      ],
      correct: 0,
      explanation: 'A filosofia central do Loki é indexar APENAS labels/metadados, não o conteúdo dos logs. Isso reduz drasticamente o custo de storage e computação, pois não é necessário tokenizar e indexar cada palavra do log.',
      reference: 'Conceito central: Labels no Loki — estude a seção "Labels: O Coração do Loki" na teoria.'
    },
    {
      question: 'No stack PLG, qual componente é responsável por coletar logs dos pods no Kubernetes?',
      options: [
        'Grafana Agent',
        'Fluentd',
        'Promtail',
        'Logstash'
      ],
      correct: 2,
      explanation: 'Promtail é o agente oficial do stack PLG. Ele roda como DaemonSet, descobre pods via Kubernetes SD, lê logs de /var/log/pods/ e os envia para o Loki via HTTP push.',
      reference: 'Tópico relacionado: Promtail DaemonSet — veja o YAML de exemplo na teoria.'
    },
    {
      question: 'Qual das seguintes labels tem ALTA cardinalidade e deve ser EVITADA no Loki?',
      options: [
        '{namespace="production"}',
        '{app="api-gateway"}',
        '{pod="api-7d9f8b-xk2j9"}',
        '{environment="staging"}'
      ],
      correct: 2,
      explanation: 'O nome do pod (pod="api-7d9f8b-xk2j9") tem alta cardinalidade porque muda a cada restart/redeploy. Labels de alta cardinalidade causam cardinality explosion — cada valor único cria uma nova série no índice do Loki, causando OOM e lentidão.',
      reference: 'Conceito: Labels com alta cardinalidade — releia a seção "Labels: O Coração do Loki".'
    },
    {
      question: 'Em qual modo de deploy do Loki é recomendado para ambientes de produção de médio porte?',
      options: [
        'Single Binary (Monolithic)',
        'Simple Scalable',
        'Microservices',
        'Serverless'
      ],
      correct: 1,
      explanation: 'O modo Simple Scalable separa o write path (distributor + ingester) do read path (querier + query frontend), permitindo escalar cada parte independentemente. É o ponto de equilíbrio ideal entre simplicidade e escalabilidade para produção.',
      reference: 'Arquitetura: modos de deploy do Loki — seção "Modos de Deploy" na teoria.'
    },
    {
      question: 'Qual componente do Loki é responsável por avaliar regras de alerting baseadas em LogQL?',
      options: [
        'Compactor',
        'Query Frontend',
        'Ruler',
        'Distributor'
      ],
      correct: 2,
      explanation: 'O Ruler é o componente responsável por avaliar periodicamente as regras de alerting e recording definidas em LogQL, funcionando de forma similar ao Prometheus Ruler. Ele também pode enviar alertas para o Alertmanager.',
      reference: 'Tópico relacionado: LogQL & Alerting — próximo tópico na track de Loki.'
    },
    {
      question: 'Ao instalar o Loki com Helm, qual flag habilita a persistência de dados?',
      options: [
        '--set loki.storage.enabled=true',
        '--set loki.persistence.enabled=true',
        '--set loki.pvc.create=true',
        '--set loki.stateful=true'
      ],
      correct: 1,
      explanation: 'O flag correto é --set loki.persistence.enabled=true, que instrui o Helm chart a criar um PersistentVolumeClaim para o StatefulSet do Loki. Sem isso, os dados ficam no volume emptyDir e são perdidos em restarts.',
      reference: 'Prático: deploy Helm do Loki — veja os comandos na seção "Comandos Essenciais".'
    },
    {
      question: 'O que acontece quando o Promtail encontra um log com timestamp mais antigo que reject_old_samples_max_age?',
      options: [
        'O log é armazenado com timestamp corrigido para o momento atual',
        'O log é enviado para uma fila de retry separada',
        'O log é rejeitado com "entry out of order"',
        'O log é armazenado em uma partição especial de "late data"'
      ],
      correct: 2,
      explanation: 'Quando reject_old_samples está habilitado, o Loki rejeita logs com timestamps anteriores ao limite configurado em reject_old_samples_max_age. O Promtail registra o erro "entry out of order" e o log é descartado. Isso protege a ordem do índice.',
      reference: 'Troubleshooting: Chunk Encoding Error — seção "Erros Comuns".'
    },
    {
      question: 'Qual pipeline stage do Promtail faz o parse correto do formato de log do containerd/CRI-O no Kubernetes?',
      options: [
        '- docker: {}',
        '- cri: {}',
        '- json: {}',
        '- kubernetes: {}'
      ],
      correct: 1,
      explanation: 'O stage "cri: {}" faz o parse do formato CRI (Container Runtime Interface) usado pelo containerd e CRI-O, que é o formato padrão em clusters Kubernetes modernos. O formato docker: {} era usado com o runtime legado Docker.',
      reference: 'Config: pipeline_stages do Promtail — veja o ConfigMap de exemplo na teoria.'
    }
  ],

  flashcards: [
    {
      front: 'O que é o stack PLG?',
      back: 'PLG = Promtail + Loki + Grafana. É o stack de logging para Kubernetes:\n- Promtail: agente DaemonSet que coleta logs dos pods\n- Loki: armazenamento e indexação de logs (indexa apenas labels)\n- Grafana: visualização e alerting via LogQL'
    },
    {
      front: 'Por que evitar labels de alta cardinalidade no Loki?',
      back: 'Cada valor único de label cria uma nova série no índice. Labels como pod_name, IP, user_id criam milhões de séries, causando:\n- OOM no Loki (memória esgotada)\n- Queries lentas\n- Alto custo de storage\n\nUse apenas labels estáticas: namespace, app, environment, job'
    },
    {
      front: 'Qual é a diferença entre Loki e Elasticsearch?',
      back: 'Loki:\n- Indexa APENAS labels (metadados)\n- Baixo custo de storage e CPU\n- Busca full-text via grep (mais lento)\n- Nativo para Kubernetes\n\nElasticsearch:\n- Full-text indexing (tokeniza cada palavra)\n- Alto custo computacional\n- Busca full-text poderosa\n- Mais complexo de operar'
    },
    {
      front: 'O que faz o Compactor no Loki?',
      back: 'O Compactor:\n1. Compacta arquivos de índice para reduzir storage\n2. Aplica políticas de retenção (retention_period)\n3. Remove logs expirados do storage\n4. Reduz número de arquivos de índice fragmentados\n\nDeve ser habilitado em produção: retention_enabled: true'
    },
    {
      front: 'Como o Promtail descobre novos pods automaticamente?',
      back: 'Via Kubernetes Service Discovery (kubernetes_sd_configs):\n1. Assiste a API do Kubernetes para novos pods (role: pod)\n2. Usa relabel_configs para extrair labels do pod (app, namespace, etc.)\n3. Detecta o caminho do log em /var/log/pods/<namespace>_<pod>_<uid>/<container>/\n4. Inicia scraping automático sem restart\n\nRequer ServiceAccount com permissões list/watch em pods'
    },
    {
      front: 'Quais são os 3 modos de deploy do Loki e quando usar cada um?',
      back: 'Single Binary (Monolithic):\n- Todos os componentes em 1 processo\n- Dev/testes, clusters pequenos\n\nSimple Scalable:\n- Separa write path e read path\n- Produção de médio porte (recomendado)\n\nMicroservices:\n- Cada componente separado\n- Alta escala, máxima flexibilidade\n- Mais complexo de operar'
    },
    {
      front: 'O que é o Ruler no Loki?',
      back: 'O Ruler avalia regras de alerting e recording baseadas em LogQL:\n- Executa queries LogQL periodicamente\n- Dispara alertas para o Alertmanager quando condições são atingidas\n- Suporta o mesmo formato de PrometheusRule\n- Permite alertar sobre contagem de erros, padrões de log, etc.\n\nExemplo: alerta quando count_over_time({level="error"}[5m]) > 100'
    },
    {
      front: 'Como verificar se o Loki está saudável após deploy?',
      back: 'Comandos de verificação:\n\n# Ready endpoint\nwget -qO- http://loki:3100/ready\n# Retorna "ready" se OK\n\n# Ring members (distribuição)\nwget -qO- http://loki:3100/ring\n\n# Métricas de ingestão\nwget -qO- http://loki:3100/metrics | grep loki_ingester_streams_created_total\n\n# Via kubectl\nkubectl get pods -n monitoring -l app=loki\nkubectl logs -n monitoring loki-0 --tail=50'
    }
  ],

  lab: {
    scenario: 'Você precisa configurar uma stack de logging completa para um cluster Kubernetes de desenvolvimento, usando Loki + Promtail + Grafana via Helm, e verificar que logs de uma aplicação de teste são coletados e consultáveis.',
    objective: 'Fazer deploy do stack PLG completo, verificar coleta de logs via Promtail e executar queries básicas no Grafana.',
    duration: '25-35 minutos',
    steps: [
      {
        title: 'Deploy do Stack PLG com Helm',
        instruction: `Adicione o repositório Helm da Grafana e instale o stack Loki completo no namespace \`monitoring\`. Use o chart \`loki-stack\` que inclui Loki, Promtail e Grafana.

Após a instalação, aguarde todos os pods ficarem \`Running\` e obtenha a senha do Grafana.`,
        hints: [
          'O namespace monitoring precisa ser criado — use --create-namespace',
          'Habilite grafana.enabled=true e promtail.enabled=true no helm install',
          'A senha do Grafana está em um Secret chamado loki-stack-grafana'
        ],
        solution: `\`\`\`bash
# Adicionar repositório
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Instalar stack
helm install loki-stack grafana/loki-stack \\
  --namespace monitoring \\
  --create-namespace \\
  --set grafana.enabled=true \\
  --set promtail.enabled=true \\
  --set loki.persistence.enabled=true \\
  --set loki.persistence.size=5Gi

# Aguardar pods
kubectl wait --for=condition=ready pod \\
  -l app=loki -n monitoring --timeout=120s
kubectl wait --for=condition=ready pod \\
  -l app=promtail -n monitoring --timeout=120s

# Obter senha do Grafana
kubectl get secret -n monitoring loki-stack-grafana \\
  -o jsonpath='{.data.admin-password}' | base64 -d && echo
\`\`\``,
        verify: `\`\`\`bash
# Verificar todos os pods running
kubectl get pods -n monitoring
# Saída esperada:
# loki-stack-0                    1/1     Running   0          2m
# loki-stack-grafana-xxx          1/1     Running   0          2m
# loki-stack-promtail-xxx (node1) 1/1     Running   0          2m
# loki-stack-promtail-xxx (node2) 1/1     Running   0          2m

# Verificar ready endpoint do Loki
kubectl exec -n monitoring loki-stack-0 -- \\
  wget -qO- http://localhost:3100/ready
# Saída esperada: ready

# Verificar Promtail está coletando targets
kubectl exec -n monitoring -it ds/loki-stack-promtail -- \\
  wget -qO- http://localhost:9080/metrics | \\
  grep promtail_targets_active_total
# Saída esperada: promtail_targets_active_total X (X > 0)
\`\`\``
      },
      {
        title: 'Deploy de Aplicação de Teste e Verificação de Coleta',
        instruction: `Faça deploy de um pod gerador de logs no namespace \`default\` e verifique que o Promtail está coletando seus logs.

Use a imagem \`busybox\` com um loop que gera logs a cada segundo com níveis ERROR e INFO. Após 30 segundos, verifique os logs via API do Loki.`,
        hints: [
          'Use kubectl run com --image=busybox e command para gerar logs continuamente',
          'A API do Loki aceita queries via HTTP: /loki/api/v1/query_range',
          'Use port-forward para acessar o Loki localmente'
        ],
        solution: `\`\`\`bash
# Criar pod gerador de logs
kubectl run log-generator \\
  --image=busybox \\
  --restart=Never \\
  -- sh -c 'i=0; while true; do
    echo "$(date) INFO request processed id=\$i status=200";
    echo "$(date) ERROR failed to connect to database retry=\$i";
    i=$((i+1));
    sleep 1;
  done'

# Aguardar pod estar running
kubectl wait --for=condition=ready pod/log-generator --timeout=30s

# Port-forward para Loki
kubectl port-forward -n monitoring svc/loki-stack 3100:3100 &

# Aguardar 10 segundos para coletar logs
sleep 10

# Consultar logs via API
curl -s "http://localhost:3100/loki/api/v1/query_range" \\
  --data-urlencode 'query={pod="log-generator"}' \\
  --data-urlencode "start=$(date -d '5 minutes ago' +%s)000000000" \\
  --data-urlencode "end=$(date +%s)000000000" \\
  --data-urlencode "limit=10" | jq '.data.result[0].values[:3]'
\`\`\``,
        verify: `\`\`\`bash
# Verificar pod running
kubectl get pod log-generator
# Saída esperada: log-generator   1/1   Running   0   Xs

# Verificar logs do pod
kubectl logs log-generator --tail=5
# Saída esperada: linhas com INFO e ERROR

# Verificar no Loki (com port-forward ativo)
curl -s "http://localhost:3100/loki/api/v1/labels" | jq '.data'
# Saída esperada: lista incluindo "pod", "namespace", "app"

# Verificar que Loki tem streams para o pod
curl -s "http://localhost:3100/loki/api/v1/series" \\
  --data-urlencode 'match[]={pod="log-generator"}' | jq '.data | length'
# Saída esperada: 1 (ou mais se tiver múltiplos containers)
\`\`\``
      },
      {
        title: 'Configurar Data Source no Grafana e Explorar Logs',
        instruction: `Acesse o Grafana via port-forward e verifique que o Loki já está configurado como data source (o chart loki-stack configura automaticamente).

Use o Explore do Grafana para executar uma query LogQL e filtre apenas os logs de ERROR do pod gerador. Configure também a retenção básica no Loki.`,
        hints: [
          'Grafana roda na porta 80, mas port-forward para 3000 é mais conveniente',
          'O data source Loki já vem pré-configurado pelo Helm chart',
          'No Explore, use a label browser para montar a query visualmente',
          'Para editar configuração do Loki, edite o ConfigMap e faça rollout restart'
        ],
        solution: `\`\`\`bash
# Port-forward Grafana
kubectl port-forward -n monitoring svc/loki-stack-grafana 3000:80 &

# Abrir no browser: http://localhost:3000
# Login: admin / (senha obtida no passo 1)

# Verificar data source via API do Grafana
curl -s -u admin:\$(kubectl get secret -n monitoring loki-stack-grafana \\
  -o jsonpath='{.data.admin-password}' | base64 -d) \\
  http://localhost:3000/api/datasources | jq '.[].name'
# Saída esperada: "Loki" (entre os data sources)

# Queries LogQL para testar no Explore:
# 1. Todos os logs do gerador:
#    {pod="log-generator"}
#
# 2. Apenas erros:
#    {pod="log-generator"} |= "ERROR"
#
# 3. Rate de erros por minuto:
#    rate({pod="log-generator"} |= "ERROR" [1m])

# Configurar retenção no ConfigMap do Loki
kubectl edit configmap -n monitoring loki-stack
# Adicionar em limits_config:
#   retention_period: 7d
# Adicionar em compactor:
#   retention_enabled: true

# Aplicar mudança
kubectl rollout restart statefulset/loki-stack -n monitoring
\`\`\``,
        verify: `\`\`\`bash
# Verificar data source Loki via API
GRAFANA_PASS=\$(kubectl get secret -n monitoring loki-stack-grafana \\
  -o jsonpath='{.data.admin-password}' | base64 -d)

curl -s -u "admin:\$GRAFANA_PASS" \\
  http://localhost:3000/api/datasources | jq '.[].type'
# Saída esperada: "loki" (deve aparecer na lista)

# Testar query Loki via API HTTP
curl -s "http://localhost:3100/loki/api/v1/query" \\
  --data-urlencode 'query=count_over_time({pod="log-generator"}[5m])' | \\
  jq '.data.result[0].value[1]'
# Saída esperada: número > "0" (contagem de logs nos últimos 5min)

# Verificar rollout restart completo
kubectl rollout status statefulset/loki-stack -n monitoring
# Saída esperada: statefulset rolling update complete
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Promtail não coleta logs de pods novos',
      difficulty: 'easy',
      symptom: 'Pods recém-criados não aparecem no Grafana/Loki. Pods antigos continuam aparecendo normalmente. O DaemonSet do Promtail está Running em todos os nodes.',
      diagnosis: `\`\`\`bash
# Verificar permissões do ServiceAccount do Promtail
kubectl get clusterrolebinding -l app=promtail -o yaml

# Checar se o Promtail consegue listar pods
kubectl auth can-i list pods \\
  --as=system:serviceaccount:monitoring:promtail-serviceaccount

# Ver erros no Promtail
kubectl logs -n monitoring ds/loki-stack-promtail --tail=50 | grep -i error

# Verificar targets ativos
kubectl exec -n monitoring -it ds/loki-stack-promtail -- \\
  wget -qO- http://localhost:9080/targets | grep -i "health"

# Checar se há regras de drop no pipeline
kubectl get configmap -n monitoring loki-stack-promtail -o yaml | \\
  grep -A5 "action: drop"
\`\`\``,
      solution: `**Causa**: ServiceAccount do Promtail sem ClusterRole adequado ou pipeline_stage com "action: drop" muito abrangente.

**Solução 1 - Permissões RBAC**:
\`\`\`bash
# Criar ClusterRole correto
kubectl apply -f - <<EOF
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: promtail
rules:
  - apiGroups: [""]
    resources: ["nodes", "services", "pods"]
    verbs: ["get", "list", "watch"]
  - apiGroups: [""]
    resources: ["pods/log"]
    verbs: ["get", "list", "watch"]
EOF

# Vincular ao ServiceAccount
kubectl create clusterrolebinding promtail \\
  --clusterrole=promtail \\
  --serviceaccount=monitoring:loki-stack-promtail

# Reiniciar Promtail
kubectl rollout restart ds/loki-stack-promtail -n monitoring
\`\`\`

**Solução 2 - Pipeline stage com drop incorreto**:
\`\`\`bash
# Editar ConfigMap e remover/corrigir regra de drop
kubectl edit configmap -n monitoring loki-stack-promtail
# Remover ou ajustar: action: drop com selector muito amplo

kubectl rollout restart ds/loki-stack-promtail -n monitoring
\`\`\``
    },
    {
      title: 'Loki em OOM — Cardinality Explosion',
      difficulty: 'hard',
      symptom: 'Pod do Loki reinicia com OOMKilled. Antes de morrer, logs mostram "level=warn msg=\\"runtime out of memory\\"". As métricas mostram loki_ingester_streams_created_total crescendo exponencialmente.',
      diagnosis: `\`\`\`bash
# Verificar eventos OOM
kubectl describe pod -n monitoring loki-stack-0 | grep -A5 "OOMKilled"

# Checar número de streams ativos
kubectl exec -n monitoring loki-stack-0 -- \\
  wget -qO- http://localhost:3100/metrics | \\
  grep loki_ingester_streams_created_total

# Identificar labels de alta cardinalidade
kubectl exec -n monitoring loki-stack-0 -- \\
  wget -qO- http://localhost:3100/metrics | \\
  grep loki_ingester_memory_streams

# Ver labels sendo enviadas pelo Promtail
kubectl exec -n monitoring -it ds/loki-stack-promtail -- \\
  wget -qO- http://localhost:9080/metrics | \\
  grep promtail_sent_bytes_total

# Verificar ConfigMap do Promtail por labels problemáticas
kubectl get configmap -n monitoring loki-stack-promtail -o yaml | \\
  grep -A3 "target_label"

# Checar configuração de limites no Loki
kubectl get configmap -n monitoring loki-stack -o yaml | \\
  grep -A10 "limits_config"
\`\`\``,
      solution: `**Causa**: Labels com alta cardinalidade (pod name, IP, request_id) estão sendo adicionadas como labels do Loki, criando milhares de streams únicos por minuto.

**Solução imediata — Limitar cardinalidade no Loki**:
\`\`\`bash
# Editar ConfigMap do Loki
kubectl edit configmap -n monitoring loki-stack

# Adicionar limites em limits_config:
# limits_config:
#   max_streams_per_user: 10000
#   max_label_names_per_series: 15
#   max_label_value_length: 2048

kubectl rollout restart statefulset/loki-stack -n monitoring
\`\`\`

**Solução definitiva — Remover labels de alta cardinalidade no Promtail**:
\`\`\`bash
kubectl edit configmap -n monitoring loki-stack-promtail

# No relabel_configs, adicionar labeldrop para labels problemáticas:
# pipeline_stages:
#   - labeldrop:
#       - pod          # alta cardinalidade — use pod_template_hash ou remova
#       - filename     # desnecessário na maioria dos casos
#       - stream       # desnecessário

# Manter apenas: namespace, app, container, environment
\`\`\`

**Aumentar recursos temporariamente**:
\`\`\`bash
# Patch de recursos enquanto resolve a causa raiz
kubectl patch statefulset loki-stack -n monitoring \\
  --type='json' \\
  -p='[{"op": "replace", "path": "/spec/template/spec/containers/0/resources/limits/memory", "value": "2Gi"}]'
\`\`\``
    },
    {
      title: 'Logs com atraso — High Ingestion Latency',
      difficulty: 'medium',
      symptom: 'Logs aparecem no Grafana com 5-10 minutos de atraso. A aplicação está gerando logs em tempo real mas o Loki não mostra dados recentes.',
      diagnosis: `\`\`\`bash
# Verificar latência de ingestão
kubectl exec -n monitoring loki-stack-0 -- \\
  wget -qO- http://localhost:3100/metrics | \\
  grep loki_ingester_chunk_flush_duration_seconds

# Checar se ingesters estão com chunk flush atrasado
kubectl exec -n monitoring loki-stack-0 -- \\
  wget -qO- http://localhost:3100/metrics | \\
  grep loki_ingester_chunks_flushed_total

# Ver se há rate limiting
kubectl logs -n monitoring loki-stack-0 --tail=100 | \\
  grep -i "rate limit\\|ingestion rate"

# Verificar configuração de chunk target size
kubectl get configmap -n monitoring loki-stack -o yaml | \\
  grep -A5 "ingester"
\`\`\``,
      solution: `**Causa**: Chunks muito grandes ou \`chunk_target_size\` alto fazendo o Loki esperar acumular mais dados antes do flush.

**Solução**:
\`\`\`bash
kubectl edit configmap -n monitoring loki-stack

# Ajustar configurações do ingester:
# ingester:
#   chunk_idle_period: 30m    # reduzir para 5m em dev
#   chunk_target_size: 1048576  # 1MB padrão
#   max_chunk_age: 1h           # reduzir para 10m em dev
#   flush_check_period: 30s

# Para desenvolvimento, configuração mais agressiva:
# ingester:
#   chunk_idle_period: 5m
#   max_chunk_age: 10m
#   flush_check_period: 10s

kubectl rollout restart statefulset/loki-stack -n monitoring
\`\`\``
    }
  ]
};
