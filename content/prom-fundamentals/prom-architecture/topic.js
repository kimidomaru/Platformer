window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['prom-fundamentals/prom-architecture'] = {
  theory: `
# Arquitetura e Componentes do Prometheus

## Relevancia
O Prometheus e o padrao de facto para monitoramento em ambientes Kubernetes e cloud-native. Compreender sua arquitetura e essencial para qualquer engenheiro DevOps/SRE.

## Conceitos Fundamentais

### O que e o Prometheus?
Prometheus e um sistema de monitoramento e alerta open-source, originalmente criado no SoundCloud e agora um projeto graduado da CNCF. Ele usa um modelo **pull-based** (scraping) para coletar metricas de alvos configurados.

### Arquitetura Geral

\`\`\`
+-------------------+     +------------------+     +----------------+
|   Targets         |     |  Prometheus      |     | Alertmanager   |
| (exporters, apps) |<----|  Server          |---->|                |
+-------------------+     |  - Scraper       |     +----------------+
                          |  - TSDB          |
+-------------------+     |  - Rule Engine   |     +----------------+
| Service Discovery |---->|  - HTTP Server   |     | Grafana        |
| (K8s, Consul,DNS) |     +------------------+     | (visualizacao) |
+-------------------+            |                  +----------------+
                                 |                        ^
                          +------v------+                 |
                          | Storage     |--- PromQL ----->|
                          | (local TSDB)|
                          +-------------+
\`\`\`

### Componentes Principais

| Componente | Funcao |
|-----------|--------|
| **Prometheus Server** | Coleta, armazena e consulta metricas |
| **TSDB** | Banco de dados de series temporais local |
| **Alertmanager** | Gerencia e roteia alertas |
| **Pushgateway** | Recebe metricas de jobs batch (push) |
| **Exporters** | Expoe metricas de sistemas (node, mysql, etc.) |
| **Client Libraries** | Instrumentacao de aplicacoes |

### Modelo de Dados

Cada metrica e uma **serie temporal** identificada por:
- **Nome da metrica**: \`http_requests_total\`
- **Labels**: \`{method="GET", status="200", handler="/api"}\`
- **Timestamp + Valor**: ponto no tempo com valor float64

### Tipos de Metricas

| Tipo | Descricao | Exemplo |
|------|-----------|---------|
| **Counter** | Valor que so cresce (ou reseta) | \`http_requests_total\` |
| **Gauge** | Valor que sobe e desce | \`node_memory_available_bytes\` |
| **Histogram** | Distribuicao em buckets | \`http_request_duration_seconds_bucket\` |
| **Summary** | Quantis pre-calculados | \`go_gc_duration_seconds\` |

## Comandos Essenciais

### Instalacao via Helm (kube-prometheus-stack)

\`\`\`bash
# Adicionar repositorio
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Instalar kube-prometheus-stack (Prometheus + Grafana + Alertmanager)
helm install monitoring prometheus-community/kube-prometheus-stack \\
  --namespace monitoring --create-namespace

# Verificar pods
kubectl get pods -n monitoring

# Port-forward para acessar Prometheus UI
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090

# Port-forward para Grafana
kubectl port-forward -n monitoring svc/monitoring-grafana 3000:80
\`\`\`

### Verificacao de Targets

\`\`\`bash
# Via API do Prometheus
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, health: .health}'

# Via promtool
promtool check config prometheus.yml
\`\`\`

## Exemplos YAML

### Configuracao Basica do Prometheus

\`\`\`yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  scrape_timeout: 10s

alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - alertmanager:9093

rule_files:
  - "rules/*.yml"

scrape_configs:
  - job_name: "prometheus"
    static_configs:
      - targets: ["localhost:9090"]

  - job_name: "node-exporter"
    static_configs:
      - targets: ["node1:9100", "node2:9100"]

  - job_name: "kubernetes-pods"
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
\`\`\`

### ServiceMonitor (Prometheus Operator)

\`\`\`yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: my-app-monitor
  namespace: monitoring
  labels:
    release: monitoring
spec:
  selector:
    matchLabels:
      app: my-app
  namespaceSelector:
    matchNames:
      - default
  endpoints:
    - port: metrics
      interval: 30s
      path: /metrics
\`\`\`

## Erros Comuns

1. **ServiceMonitor nao descoberto**: Label \`release\` nao corresponde ao seletor do Prometheus Operator
2. **Targets DOWN**: Firewall bloqueando porta do exporter, ou Service sem endpoint
3. **Metricas ausentes apos restart**: TSDB local sem persistencia — usar PVC
4. **High cardinality**: Labels com valores unicos (user_id, request_id) causam explosao de series
5. **scrape_timeout > scrape_interval**: Timeout deve ser menor que o intervalo

## Killer.sh Style Challenge

> Instale o kube-prometheus-stack via Helm no namespace \`monitoring\`. Configure um ServiceMonitor para coletar metricas de um deployment chamado \`web-app\` no namespace \`default\` que expoe metricas na porta \`8080\` no path \`/metrics\`. Verifique que o target aparece como UP no Prometheus.
`,
  quiz: [
    {
      question: 'Qual modelo de coleta o Prometheus utiliza por padrao?',
      options: ['Push-based (agentes enviam metricas)', 'Pull-based (Prometheus faz scrape dos targets)', 'Streaming via gRPC', 'Polling via SNMP'],
      correct: 1,
      explanation: 'O Prometheus usa o modelo pull-based, fazendo scrape (HTTP GET) no endpoint /metrics dos targets configurados em intervalos regulares.',
      reference: 'Conceito: Arquitetura Prometheus — modelo pull vs push'
    },
    {
      question: 'Qual tipo de metrica do Prometheus so pode crescer ou resetar para zero?',
      options: ['Gauge', 'Counter', 'Histogram', 'Summary'],
      correct: 1,
      explanation: 'Counter e um tipo de metrica que so incrementa (ou reseta para 0 no restart). E usado para contagens cumulativas como total de requests.',
      reference: 'Tipos de metricas — Counter vs Gauge'
    },
    {
      question: 'Qual componente do Prometheus e responsavel por gerenciar e rotear alertas?',
      options: ['Prometheus Server', 'Pushgateway', 'Alertmanager', 'Grafana'],
      correct: 2,
      explanation: 'O Alertmanager recebe alertas do Prometheus Server, faz deduplicacao, agrupamento, silenciamento e roteia para os canais configurados (email, Slack, PagerDuty, etc.).',
      reference: 'Componentes — Alertmanager'
    },
    {
      question: 'O que identifica unicamente uma serie temporal no Prometheus?',
      options: ['Apenas o nome da metrica', 'Nome da metrica + conjunto de labels', 'Nome da metrica + timestamp', 'Job name + instance'],
      correct: 1,
      explanation: 'Uma serie temporal e unicamente identificada pela combinacao do nome da metrica com seu conjunto de labels. Por exemplo: http_requests_total{method="GET", status="200"} e uma serie diferente de http_requests_total{method="POST", status="200"}.',
      reference: 'Modelo de dados — series temporais'
    },
    {
      question: 'Qual recurso do Prometheus Operator e usado para configurar quais Services devem ser monitorados?',
      options: ['PrometheusRule', 'AlertmanagerConfig', 'ServiceMonitor', 'PodMonitor'],
      correct: 2,
      explanation: 'ServiceMonitor e um CRD do Prometheus Operator que define quais Services (e suas portas/paths) devem ser scrapeados pelo Prometheus.',
      reference: 'Prometheus Operator — ServiceMonitor CRD'
    },
    {
      question: 'Qual componente deve ser usado para coletar metricas de jobs batch de curta duracao?',
      options: ['Exporter', 'Pushgateway', 'ServiceMonitor', 'Federation'],
      correct: 1,
      explanation: 'O Pushgateway permite que jobs batch enviem metricas via push, ja que eles podem terminar antes do proximo scrape do Prometheus.',
      reference: 'Pushgateway — quando usar'
    },
    {
      question: 'O que e TSDB no contexto do Prometheus?',
      options: ['Um servico de descoberta de targets', 'O banco de dados de series temporais local', 'Um protocolo de comunicacao', 'Uma linguagem de consulta'],
      correct: 1,
      explanation: 'TSDB (Time Series Database) e o banco de dados embutido no Prometheus que armazena todas as metricas coletadas. Ele e otimizado para escritas de alta taxa e consultas por intervalo de tempo.',
      reference: 'TSDB — armazenamento local'
    },
    {
      question: 'Qual problema e causado por labels com alta cardinalidade no Prometheus?',
      options: ['Alertas duplicados', 'Explosao de series temporais e alto uso de memoria', 'Perda de dados no TSDB', 'Falha no Service Discovery'],
      correct: 1,
      explanation: 'Labels com valores unicos (como user_id ou request_id) criam uma serie temporal para cada valor unico, causando explosao de cardinalidade que consome memoria e disco excessivos.',
      reference: 'Erros comuns — high cardinality'
    }
  ],
  flashcards: [
    { front: 'Qual o modelo de coleta do Prometheus?', back: 'Pull-based (scraping): Prometheus faz HTTP GET no endpoint /metrics dos targets em intervalos regulares (scrape_interval).' },
    { front: 'Quais sao os 4 tipos de metricas do Prometheus?', back: 'Counter (so cresce), Gauge (sobe e desce), Histogram (distribuicao em buckets), Summary (quantis pre-calculados).' },
    { front: 'O que e o Alertmanager?', back: 'Componente que recebe alertas do Prometheus, faz deduplicacao, agrupamento, silenciamento e roteia notificacoes para canais como email, Slack e PagerDuty.' },
    { front: 'O que e um ServiceMonitor?', back: 'CRD do Prometheus Operator que define quais Services devem ser monitorados, especificando seletor de labels, portas e paths de metricas.' },
    { front: 'Quando usar o Pushgateway?', back: 'Apenas para jobs batch de curta duracao que podem terminar antes do proximo scrape. NAO usar como proxy geral de metricas.' },
    { front: 'O que identifica uma serie temporal no Prometheus?', back: 'A combinacao unica de nome da metrica + conjunto de labels. Ex: http_requests_total{method="GET", status="200"}' },
    { front: 'O que e o kube-prometheus-stack?', back: 'Helm chart que instala Prometheus Operator + Prometheus + Alertmanager + Grafana + node-exporter + kube-state-metrics + dashboards e regras pre-configuradas.' },
    { front: 'O que e alta cardinalidade e por que e um problema?', back: 'Labels com muitos valores unicos (user_id, request_id) criam milhares de series temporais, consumindo memoria e disco excessivos e degradando performance.' }
  ],
  lab: {
    scenario: 'Voce precisa instalar o stack de monitoramento Prometheus em um cluster Kubernetes e configurar o monitoramento de uma aplicacao.',
    objective: 'Instalar kube-prometheus-stack, verificar componentes, criar um ServiceMonitor e validar a coleta de metricas.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Instalar kube-prometheus-stack via Helm',
        instruction: `Instale o chart \`kube-prometheus-stack\` no namespace \`monitoring\`:

\`\`\`bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install monitoring prometheus-community/kube-prometheus-stack --namespace monitoring --create-namespace
\`\`\``,
        hints: ['Use helm repo add para adicionar o repositorio', 'Use --create-namespace para criar o namespace automaticamente'],
        solution: `\`\`\`bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install monitoring prometheus-community/kube-prometheus-stack --namespace monitoring --create-namespace
\`\`\``,
        verify: `\`\`\`bash
kubectl get pods -n monitoring
# Saida esperada: prometheus-server, alertmanager, grafana, node-exporter, kube-state-metrics todos Running
helm list -n monitoring
# Saida esperada: monitoring com STATUS deployed
\`\`\``
      },
      {
        title: 'Verificar Targets do Prometheus',
        instruction: `Faca port-forward para o Prometheus e verifique os targets ativos:

\`\`\`bash
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090
\`\`\`

Acesse http://localhost:9090/targets no navegador.`,
        hints: ['O servico do Prometheus segue o padrao <release>-kube-prometheus-prometheus', 'Use a API /api/v1/targets para verificar via CLI'],
        solution: `\`\`\`bash
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090 &
curl -s http://localhost:9090/api/v1/targets | python3 -m json.tool | head -50
\`\`\``,
        verify: `\`\`\`bash
curl -s http://localhost:9090/api/v1/targets | grep -o '"health":"up"' | wc -l
# Saida esperada: numero > 0 (targets saudaveis)
\`\`\``
      },
      {
        title: 'Deploy de Aplicacao com Metricas',
        instruction: `Crie um Deployment e Service para uma aplicacao que expoe metricas Prometheus:

\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sample-app
  namespace: default
  labels:
    app: sample-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: sample-app
  template:
    metadata:
      labels:
        app: sample-app
    spec:
      containers:
      - name: sample
        image: quay.io/brancz/prometheus-example-app:v0.5.0
        ports:
        - containerPort: 8080
          name: metrics
---
apiVersion: v1
kind: Service
metadata:
  name: sample-app
  namespace: default
  labels:
    app: sample-app
spec:
  selector:
    app: sample-app
  ports:
  - port: 8080
    targetPort: metrics
    name: metrics
\`\`\``,
        hints: ['A imagem prometheus-example-app expoe metricas no path /metrics porta 8080', 'O Service precisa ter a label app: sample-app para o ServiceMonitor encontrar'],
        solution: `\`\`\`bash
kubectl apply -f sample-app.yaml
kubectl get pods -l app=sample-app
kubectl get svc sample-app
\`\`\``,
        verify: `\`\`\`bash
kubectl get pods -l app=sample-app -o wide
# Saida esperada: pod Running
kubectl port-forward svc/sample-app 8080:8080 &
curl -s http://localhost:8080/metrics | head -10
# Saida esperada: metricas no formato Prometheus (# HELP, # TYPE, valores)
\`\`\``
      },
      {
        title: 'Criar ServiceMonitor',
        instruction: `Crie um ServiceMonitor para que o Prometheus colete metricas da aplicacao:

\`\`\`yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: sample-app-monitor
  namespace: monitoring
  labels:
    release: monitoring
spec:
  selector:
    matchLabels:
      app: sample-app
  namespaceSelector:
    matchNames:
      - default
  endpoints:
    - port: metrics
      interval: 15s
      path: /metrics
\`\`\`

**Importante**: A label \`release: monitoring\` deve corresponder ao release do Helm.`,
        hints: ['A label release deve corresponder ao nome do release do Helm (monitoring)', 'namespaceSelector define em qual namespace procurar os Services'],
        solution: `\`\`\`bash
kubectl apply -f servicemonitor.yaml
kubectl get servicemonitor -n monitoring
\`\`\``,
        verify: `\`\`\`bash
kubectl get servicemonitor sample-app-monitor -n monitoring
# Saida esperada: ServiceMonitor listado
# Apos ~30s, verificar no Prometheus:
curl -s http://localhost:9090/api/v1/targets | grep sample-app
# Saida esperada: target sample-app com health: up
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'ServiceMonitor nao aparece nos targets do Prometheus',
      difficulty: 'easy',
      symptom: 'Voce criou um ServiceMonitor mas o target nao aparece na pagina /targets do Prometheus.',
      diagnosis: `\`\`\`bash
# Verificar labels do ServiceMonitor
kubectl get servicemonitor -n monitoring -o yaml | grep -A5 labels

# Verificar o seletor do Prometheus Operator
kubectl get prometheus -n monitoring -o yaml | grep -A10 serviceMonitorSelector

# Verificar se o Service existe e tem as labels corretas
kubectl get svc -l app=sample-app
\`\`\``,
      solution: 'O problema mais comum e a label do ServiceMonitor nao corresponder ao serviceMonitorSelector do Prometheus. No kube-prometheus-stack, adicione a label release: <nome-do-release-helm>. Tambem verifique se o namespaceSelector inclui o namespace do Service alvo.'
    },
    {
      title: 'Prometheus reiniciando com OOMKilled',
      difficulty: 'medium',
      symptom: 'O pod do Prometheus esta em CrashLoopBackOff com razao OOMKilled.',
      diagnosis: `\`\`\`bash
# Verificar eventos do pod
kubectl describe pod -n monitoring -l app.kubernetes.io/name=prometheus | grep -A5 "Last State"

# Verificar uso de memoria
kubectl top pod -n monitoring -l app.kubernetes.io/name=prometheus

# Verificar numero de series temporais
curl -s http://localhost:9090/api/v1/status/tsdb | jq '.data.seriesCountByMetricName[:10]'
\`\`\``,
      solution: 'Aumente os limits de memoria do Prometheus no values.yaml do Helm: prometheus.prometheusSpec.resources.limits.memory. Se o problema for alta cardinalidade, identifique metricas com muitos labels unicos usando a query tsdb status e adicione metric_relabel_configs para dropar metricas desnecessarias.'
    },
    {
      title: 'Metricas desaparecem apos reinicio do Prometheus',
      difficulty: 'hard',
      symptom: 'Apos reiniciar o pod do Prometheus, todas as metricas historicas desaparecem.',
      diagnosis: `\`\`\`bash
# Verificar se ha PVC configurado
kubectl get pvc -n monitoring | grep prometheus

# Verificar storageSpec no Prometheus CR
kubectl get prometheus -n monitoring -o yaml | grep -A10 storage

# Verificar se o volume esta montado
kubectl describe pod -n monitoring -l app.kubernetes.io/name=prometheus | grep -A5 Volumes
\`\`\``,
      solution: 'O Prometheus precisa de armazenamento persistente para manter dados entre reinicializacoes. Configure storageSpec no values.yaml do Helm: prometheus.prometheusSpec.storageSpec.volumeClaimTemplate com um PVC adequado. Defina tambem retention (padrao 15d) e retentionSize para controlar o uso de disco.'
    }
  ]
};
