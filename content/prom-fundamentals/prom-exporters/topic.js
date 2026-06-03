window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['prom-fundamentals/prom-exporters'] = {
  theory: `
# Exporters e Instrumentacao

## Relevancia
Exporters sao a ponte entre sistemas que nao expoe metricas nativamente e o Prometheus. Entender quais exporters usar, como configura-los e como instrumentar aplicacoes proprias e essencial para um monitoramento completo do cluster Kubernetes.

## Conceitos Fundamentais

### O que sao Exporters?
Exporters sao programas que coletam metricas de um sistema terceiro e as expoe no formato Prometheus (texto plano com pares nome/valor + labels) em um endpoint HTTP (geralmente /metrics).

\`\`\`
Sistema Original          Exporter              Prometheus
+---------------+    +------------------+    +-----------+
| MySQL         |--->| mysqld_exporter  |--->|           |
| Linux Node    |--->| node_exporter    |--->| Scrape    |
| Kubernetes    |--->| kube-state-metrics|--->|           |
| Sua App       |--->| client library   |--->|           |
+---------------+    +------------------+    +-----------+
\`\`\`

### Exporters Essenciais para Kubernetes

| Exporter | Funcao | Metricas Chave |
|----------|--------|---------------|
| **node_exporter** | Metricas de hardware e SO dos nodes | CPU, memoria, disco, rede |
| **kube-state-metrics** | Estado dos objetos K8s | Pods, Deployments, Nodes, PVs |
| **cAdvisor** | Metricas de containers (integrado no kubelet) | CPU, memoria, IO por container |
| **blackbox_exporter** | Probing de endpoints (HTTP, TCP, DNS, ICMP) | Disponibilidade, latencia |
| **mysqld_exporter** | Metricas do MySQL | Queries, connections, replication |
| **redis_exporter** | Metricas do Redis | Memory, keys, commands |
| **postgres_exporter** | Metricas do PostgreSQL | Connections, queries, locks |

### node_exporter — Metricas de Node

O node_exporter expoe metricas de hardware e sistema operacional:

\`\`\`bash
# Instalacao como DaemonSet
# Geralmente ja incluido no kube-prometheus-stack
kubectl get ds -n monitoring | grep node-exporter
\`\`\`

**Metricas Principais:**
\`\`\`promql
# CPU
node_cpu_seconds_total{mode="idle"}
node_cpu_seconds_total{mode="system"}
node_cpu_seconds_total{mode="user"}

# Memoria
node_memory_MemTotal_bytes
node_memory_MemAvailable_bytes
node_memory_MemFree_bytes

# Disco
node_filesystem_size_bytes{mountpoint="/"}
node_filesystem_avail_bytes{mountpoint="/"}
node_disk_read_bytes_total
node_disk_written_bytes_total

# Rede
node_network_receive_bytes_total
node_network_transmit_bytes_total
node_network_receive_errs_total

# Load
node_load1
node_load5
node_load15
\`\`\`

**Queries Uteis:**
\`\`\`promql
# CPU usado (%)
(1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100

# Memoria usada (%)
(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100

# Disco usado (%)
(1 - node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100

# Bandwidth de rede (bytes/s)
rate(node_network_receive_bytes_total{device!="lo"}[5m])
\`\`\`

### kube-state-metrics — Estado do Cluster

kube-state-metrics expoe o estado dos objetos Kubernetes:

\`\`\`promql
# Pods
kube_pod_status_phase{phase="Running"}
kube_pod_container_status_restarts_total
kube_pod_container_status_waiting_reason

# Deployments
kube_deployment_spec_replicas
kube_deployment_status_replicas_available
kube_deployment_status_replicas_unavailable

# Nodes
kube_node_status_condition{condition="Ready",status="true"}
kube_node_info

# PersistentVolumes
kube_persistentvolume_status_phase
kube_persistentvolumeclaim_resource_requests_storage_bytes

# Jobs/CronJobs
kube_job_status_succeeded
kube_job_status_failed
kube_cronjob_next_schedule_time
\`\`\`

**Queries Uteis:**
\`\`\`promql
# Pods nao-Running por namespace
count by(namespace) (kube_pod_status_phase{phase!="Running",phase!="Succeeded"})

# Deployments com replicas indisponiveis
kube_deployment_status_replicas_unavailable > 0

# Pods em CrashLoopBackOff
kube_pod_container_status_waiting_reason{reason="CrashLoopBackOff"} > 0

# PVCs quase cheios
kubelet_volume_stats_used_bytes / kubelet_volume_stats_capacity_bytes * 100 > 80
\`\`\`

### cAdvisor — Metricas de Containers

cAdvisor esta integrado no kubelet e expoe metricas de cada container:

\`\`\`promql
# CPU do container (cores)
rate(container_cpu_usage_seconds_total{container!=""}[5m])

# Memoria do container (bytes)
container_memory_usage_bytes{container!=""}
container_memory_working_set_bytes{container!=""}

# IO de rede
container_network_receive_bytes_total
container_network_transmit_bytes_total

# IO de disco
container_fs_reads_bytes_total
container_fs_writes_bytes_total
\`\`\`

> **Importante:** \`container!=""\` filtra containers POD (sandbox) que nao sao relevantes.

### blackbox_exporter — Probing de Endpoints

O blackbox_exporter testa endpoints externamente (HTTP, TCP, DNS, ICMP):

\`\`\`yaml
# blackbox.yml
modules:
  http_2xx:
    prober: http
    timeout: 5s
    http:
      valid_http_versions: ["HTTP/1.1", "HTTP/2.0"]
      valid_status_codes: [200]
      method: GET
      follow_redirects: true

  tcp_connect:
    prober: tcp
    timeout: 5s

  icmp:
    prober: icmp
    timeout: 5s

  dns_lookup:
    prober: dns
    timeout: 5s
    dns:
      query_name: "kubernetes.default.svc.cluster.local"
      query_type: "A"
\`\`\`

**Configuracao no Prometheus:**
\`\`\`yaml
scrape_configs:
  - job_name: 'blackbox-http'
    metrics_path: /probe
    params:
      module: [http_2xx]
    static_configs:
      - targets:
          - https://myapp.example.com
          - https://api.example.com/health
    relabel_configs:
      - source_labels: [__address__]
        target_label: __param_target
      - source_labels: [__param_target]
        target_label: instance
      - target_label: __address__
        replacement: blackbox-exporter:9115
\`\`\`

**Metricas do blackbox_exporter:**
\`\`\`promql
# Endpoint esta UP? (1 = sucesso, 0 = falha)
probe_success

# Latencia total do probe (segundos)
probe_duration_seconds

# Tempo de resolucao DNS
probe_dns_lookup_time_seconds

# Status code HTTP
probe_http_status_code

# Certificado SSL expira em X segundos
probe_ssl_earliest_cert_expiry - time()
\`\`\`

### Instrumentacao de Aplicacoes

Client libraries permitem expor metricas diretamente da aplicacao:

**Go:**
\`\`\`go
import (
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promhttp"
)

var httpRequests = prometheus.NewCounterVec(
    prometheus.CounterOpts{
        Name: "http_requests_total",
        Help: "Total number of HTTP requests",
    },
    []string{"method", "status", "handler"},
)

func init() {
    prometheus.MustRegister(httpRequests)
}

// No handler HTTP:
httpRequests.WithLabelValues("GET", "200", "/api/users").Inc()

// Expor metricas
http.Handle("/metrics", promhttp.Handler())
\`\`\`

**Python:**
\`\`\`python
from prometheus_client import Counter, Histogram, start_http_server

REQUEST_COUNT = Counter('http_requests_total', 'Total HTTP requests', ['method', 'status'])
REQUEST_LATENCY = Histogram('http_request_duration_seconds', 'HTTP request latency')

@REQUEST_LATENCY.time()
def handle_request():
    REQUEST_COUNT.labels(method='GET', status='200').inc()

start_http_server(8080)  # Expoe /metrics na porta 8080
\`\`\`

### Convencoes de Nomes para Metricas

| Regra | Exemplo Correto | Exemplo Errado |
|-------|----------------|----------------|
| snake_case | \`http_requests_total\` | \`httpRequestsTotal\` |
| Sufixo _total para counters | \`errors_total\` | \`error_count\` |
| Sufixo _bytes para bytes | \`memory_usage_bytes\` | \`memory_usage_mb\` |
| Sufixo _seconds para tempo | \`request_duration_seconds\` | \`request_duration_ms\` |
| Prefixo com dominio | \`myapp_http_requests_total\` | \`requests\` |
| Unidade base (bytes, seconds) | \`size_bytes\` | \`size_kilobytes\` |

## Erros Comuns

1. **Nao instalar kube-state-metrics**: Sem ele, voce nao tem visibilidade sobre o estado dos objetos K8s (deployments, pods, etc.).
2. **Confundir cAdvisor com node_exporter**: cAdvisor mede containers, node_exporter mede o node inteiro. Ambos sao necessarios.
3. **Labels de alta cardinalidade**: Usar labels como \`user_id\` ou \`request_id\` explode a quantidade de series temporais e causa problemas de performance.
4. **Nao usar unidades base**: Expor metricas em milissegundos ou megabytes em vez de segundos e bytes gera confusao.
5. **Expor metricas sensiveis**: Nao inclua dados PII, tokens ou senhas em labels ou nomes de metricas.
6. **Esquecer o /metrics endpoint**: A aplicacao expoe metricas mas nao ha rota /metrics configurada.

## Killer.sh Style Challenge

**Cenario:** Configure exporters e instrumentacao para monitoramento completo de um cluster.

**Tarefas:**
1. Verifique que node_exporter e kube-state-metrics estao rodando no cluster
2. Configure o blackbox_exporter para probar um endpoint HTTP
3. Escreva queries para: CPU por node, pods com restart, e disponibilidade de endpoint
4. Identifique um container com alto uso de memoria usando metricas do cAdvisor

**Solucoes:**
\`\`\`bash
# 1. Verificar exporters
kubectl get ds -n monitoring | grep node-exporter
kubectl get deploy -n monitoring | grep kube-state-metrics

# 2. Probe HTTP
curl 'http://blackbox-exporter:9115/probe?target=https://myapp.example.com&module=http_2xx'
\`\`\`

\`\`\`promql
# 3. Queries
# CPU por node
(1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100

# Pods com restart
kube_pod_container_status_restarts_total > 5

# Disponibilidade
probe_success{instance="https://myapp.example.com"}

# 4. Top containers por memoria
topk(5, container_memory_working_set_bytes{container!=""})
\`\`\`
`,
  quiz: [
    {
      question: 'Qual e a funcao principal de um exporter no ecossistema Prometheus?',
      options: [
        'Exportar dados do Prometheus para outros sistemas',
        'Coletar metricas de sistemas terceiros e expolos no formato Prometheus',
        'Converter metricas Prometheus para formato JSON',
        'Enviar alertas para sistemas externos'
      ],
      correct: 1,
      explanation: 'Exporters sao programas que coletam metricas de sistemas que nao expoe metricas nativamente no formato Prometheus. Eles atuam como tradutores, coletando dados (ex: de MySQL, Linux) e expondo via HTTP no formato que o Prometheus entende.',
      reference: 'Conceito relacionado: prom-architecture — exporters sao targets que o Prometheus scrapeia.'
    },
    {
      question: 'Qual a diferenca entre node_exporter e kube-state-metrics?',
      options: [
        'Sao a mesma coisa com nomes diferentes',
        'node_exporter mede hardware/SO do node, kube-state-metrics mede o estado dos objetos Kubernetes',
        'node_exporter e para Linux, kube-state-metrics e para Windows',
        'node_exporter e mais recente que kube-state-metrics'
      ],
      correct: 1,
      explanation: 'node_exporter expoe metricas de hardware e sistema operacional (CPU, memoria, disco, rede do node). kube-state-metrics expoe o estado dos objetos Kubernetes (pods, deployments, nodes, PVs). Ambos sao complementares e essenciais.',
      reference: 'Conceito relacionado: prom-service-discovery — ambos sao descobertos via kubernetes_sd_configs.'
    },
    {
      question: 'Para que serve o blackbox_exporter?',
      options: [
        'Para monitorar caixas pretas (sistemas sem acesso interno)',
        'Para testar endpoints externamente via HTTP, TCP, DNS ou ICMP',
        'Para coletar metricas de containers Docker',
        'Para exportar logs do sistema'
      ],
      correct: 1,
      explanation: 'O blackbox_exporter realiza probes ativos em endpoints, verificando disponibilidade (HTTP status, TCP connection), latencia e certificados SSL. E essencial para monitoramento sintetico e validacao de SLOs de disponibilidade.',
      reference: 'Conceito relacionado: prom-alerting — combine probe_success com alerting rules para alertar sobre indisponibilidade.'
    },
    {
      question: 'Por que labels de alta cardinalidade (ex: user_id) sao problematicas no Prometheus?',
      options: [
        'Porque o Prometheus nao suporta labels de texto',
        'Porque cada combinacao unica de labels cria uma nova serie temporal, causando explosao de cardinalidade e problemas de performance',
        'Porque labels com muitos valores nao aparecem no Grafana',
        'Porque viola a convencao de nomes do Prometheus'
      ],
      correct: 1,
      explanation: 'Cada combinacao unica de nome + labels cria uma serie temporal separada no TSDB. Se user_id tem 100k valores unicos, uma unica metrica com essa label cria 100k series. Isso consome muita memoria e torna queries lentas.',
      reference: 'Conceito relacionado: promql-advanced — recording rules ajudam a pre-agregar metricas de alta cardinalidade.'
    },
    {
      question: 'Qual filtro e essencial ao usar metricas do cAdvisor para evitar dados duplicados?',
      options: [
        'container="POD"',
        'container!=""',
        'namespace!="kube-system"',
        'pod!=""'
      ],
      correct: 1,
      explanation: 'O filtro container!="" remove metricas dos containers sandbox (POD containers) que o Kubernetes cria para cada pod. Sem esse filtro, voce vera metricas duplicadas — uma para o container real e outra para o sandbox.',
      reference: 'Conceito relacionado: promql-basics — filtragem de labels e essencial para queries precisas.'
    },
    {
      question: 'Qual e a convencao correta de nomes para uma metrica counter de requests HTTP?',
      options: [
        'httpRequestsCount',
        'http_requests_total',
        'http.requests.count',
        'HTTP_REQUESTS'
      ],
      correct: 1,
      explanation: 'A convencao Prometheus exige: snake_case, sufixo _total para counters, prefixo com dominio da aplicacao, e unidades base (bytes, seconds). http_requests_total segue todas essas convencoes.',
      reference: 'Conceito relacionado: prom-architecture — tipos de metricas e convencoes do Prometheus.'
    },
    {
      question: 'Qual metrica do blackbox_exporter indica se um endpoint HTTP esta disponivel?',
      options: [
        'http_up',
        'probe_success',
        'blackbox_endpoint_up',
        'probe_http_available'
      ],
      correct: 1,
      explanation: 'probe_success retorna 1 quando o probe foi bem-sucedido (endpoint respondeu conforme esperado) e 0 quando falhou. E a metrica principal para alertas de disponibilidade com o blackbox_exporter.',
      reference: 'Conceito relacionado: prom-alerting — use probe_success em alertas de SLO de disponibilidade.'
    }
  ],
  flashcards: [
    {
      front: 'Quais sao os 4 exporters essenciais para Kubernetes?',
      back: '1. **node_exporter** — metricas de hardware/SO (CPU, memoria, disco, rede) por node\n2. **kube-state-metrics** — estado dos objetos K8s (pods, deployments, nodes)\n3. **cAdvisor** — metricas de containers (CPU, memoria, IO) — integrado no kubelet\n4. **blackbox_exporter** — probing externo (HTTP, TCP, DNS, ICMP)\n\nTodos sao complementares — cada um cobre uma camada diferente.'
    },
    {
      front: 'Qual a diferenca entre container_memory_usage_bytes e container_memory_working_set_bytes?',
      back: '**container_memory_usage_bytes**: inclui TODA memoria (RSS + cache + swap)\n- Pode ser enganoso pois inclui page cache que pode ser liberado\n\n**container_memory_working_set_bytes**: memoria realmente em uso (RSS + cache ativamente usado)\n- E a metrica que o Kubernetes usa para decisoes de OOMKill\n- Use esta para alertas de memoria de container'
    },
    {
      front: 'Como funciona o blackbox_exporter para probing HTTP?',
      back: 'O blackbox_exporter realiza probes ativos:\n\n1. Prometheus scrapeia o blackbox_exporter passando o target como parametro\n2. O blackbox_exporter faz a request HTTP ao target\n3. Retorna metricas: probe_success, probe_duration_seconds, probe_http_status_code\n\nConfig no Prometheus:\n```yaml\njob_name: blackbox\nmetrics_path: /probe\nparams:\n  module: [http_2xx]\nrelabel_configs:\n  # target -> __param_target -> instance\n```'
    },
    {
      front: 'Quais as convencoes de nomes para metricas Prometheus?',
      back: '- **snake_case**: http_requests_total (nao camelCase)\n- **_total** para counters: errors_total\n- **_bytes** para tamanhos: memory_bytes\n- **_seconds** para duracao: latency_seconds\n- **_info** para metadata: build_info{version="1.0"}\n- **Unidade base**: sempre bytes (nao KB/MB), seconds (nao ms)\n- **Prefixo**: dominio da app (myapp_requests_total)\n\nSeguir estas convencoes garante consistencia e compatibilidade com dashboards padrao.'
    },
    {
      front: 'O que e instrumentacao de aplicacoes e quando usar?',
      back: '**Instrumentacao** e adicionar metricas diretamente no codigo da aplicacao usando client libraries.\n\n**Quando usar:**\n- Metricas de negocio (pedidos, pagamentos, usuarios)\n- Latencia interna de operacoes\n- Contadores de erro especificos\n- Metricas que exporters nao cobrem\n\n**Client libraries:** Go, Python, Java, Ruby, .NET\n\n**Tipos de metricas:**\n- Counter (so sobe): requests_total\n- Gauge (sobe/desce): temperature, queue_size\n- Histogram (distribuicao): latency_seconds\n- Summary (percentis pre-calculados)'
    },
    {
      front: 'Quais metricas de kube-state-metrics sao mais uteis para alertas?',
      back: '**Pods:**\n- kube_pod_status_phase{phase!="Running"}\n- kube_pod_container_status_restarts_total\n- kube_pod_container_status_waiting_reason{reason="CrashLoopBackOff"}\n\n**Deployments:**\n- kube_deployment_status_replicas_unavailable > 0\n- kube_deployment_spec_replicas != kube_deployment_status_replicas_available\n\n**Nodes:**\n- kube_node_status_condition{condition="Ready",status!="true"}\n\n**PVs:**\n- kube_persistentvolume_status_phase{phase="Failed"}'
    },
    {
      front: 'Por que labels de alta cardinalidade sao perigosas?',
      back: 'Cada combinacao unica de nome + labels = 1 serie temporal.\n\nExemplo perigoso:\n```\nhttp_requests{user_id="..."}\n```\nSe 100k usuarios unicos: 100k series por metrica!\n\n**Impacto:**\n- Uso excessivo de memoria do Prometheus\n- Queries lentas\n- Compaction do TSDB lenta\n- Pode derrubar o Prometheus\n\n**Solucao:** Use labels com cardinalidade baixa (method, status, service, namespace). Dados de alta cardinalidade pertencem a logs, nao metricas.'
    }
  ],
  lab: {
    scenario: 'Voce precisa configurar e verificar exporters essenciais em um cluster Kubernetes, incluindo node_exporter, kube-state-metrics e blackbox_exporter.',
    objective: 'Instalar/verificar exporters, consultar suas metricas, configurar blackbox probing e entender a instrumentacao de aplicacoes.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Verificar Exporters Essenciais',
        instruction: `Verifique que os exporters essenciais estao rodando no cluster.

\`\`\`bash
# Verificar node_exporter (geralmente DaemonSet)
kubectl get ds -n monitoring -l app.kubernetes.io/name=node-exporter

# Verificar kube-state-metrics (geralmente Deployment)
kubectl get deploy -n monitoring -l app.kubernetes.io/name=kube-state-metrics

# Verificar cAdvisor (integrado no kubelet)
kubectl get nodes -o wide

# Verificar metricas de cada exporter no Prometheus
curl -s 'http://localhost:9090/api/v1/query?query=up{job=~".*node.*"}' | jq '.data.result[] | {job: .metric.job, instance: .metric.instance, value: .value[1]}'
\`\`\``,
        hints: [
          'node_exporter roda como DaemonSet (um pod por node)',
          'kube-state-metrics roda como Deployment (1-2 replicas)',
          'cAdvisor esta embutido no kubelet e nao precisa de deploy separado'
        ],
        solution: `\`\`\`bash
# Listar todos os exporters
kubectl get ds,deploy -n monitoring

# Verificar targets no Prometheus
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job | test("node|kube-state|cadvisor")) | {job: .labels.job, health: .health}'

# Contar metricas de cada exporter
curl -s 'http://localhost:9090/api/v1/query?query=count({job=~".*node.*"})' | jq '.data.result[0].value[1]'
curl -s 'http://localhost:9090/api/v1/query?query=count({job=~".*kube-state.*"})' | jq '.data.result[0].value[1]'
\`\`\``,
        verify: `\`\`\`bash
# Verificar node_exporter tem metricas
curl -s 'http://localhost:9090/api/v1/query?query=node_cpu_seconds_total' | jq '.data.result | length'
# Saida esperada: numero > 0

# Verificar kube-state-metrics tem metricas
curl -s 'http://localhost:9090/api/v1/query?query=kube_pod_info' | jq '.data.result | length'
# Saida esperada: numero > 0
\`\`\``
      },
      {
        title: 'Consultar Metricas de Node e Container',
        instruction: `Pratique queries usando metricas de node_exporter e cAdvisor.

\`\`\`promql
# === node_exporter ===
# CPU por node (%)
(1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100

# Memoria por node (%)
(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100

# Disco por mountpoint (%)
(1 - node_filesystem_avail_bytes{fstype!~"tmpfs|overlay"} / node_filesystem_size_bytes{fstype!~"tmpfs|overlay"}) * 100

# === cAdvisor ===
# Top 5 containers por CPU
topk(5, sum by(namespace, pod, container) (rate(container_cpu_usage_seconds_total{container!=""}[5m])))

# Top 5 containers por memoria
topk(5, container_memory_working_set_bytes{container!=""})

# === kube-state-metrics ===
# Pods nao-Running
kube_pod_status_phase{phase!="Running", phase!="Succeeded"} == 1

# Deployments com problemas
kube_deployment_status_replicas_unavailable > 0
\`\`\``,
        hints: [
          'Use container!="" para filtrar POD sandbox containers do cAdvisor',
          'container_memory_working_set_bytes e mais preciso que container_memory_usage_bytes',
          'fstype!~"tmpfs|overlay" filtra filesystems virtuais no node_exporter'
        ],
        solution: `\`\`\`promql
# Dashboard completo de node
# CPU
(1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100

# Memoria
(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100

# Disco
(1 - node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100

# Load average
node_load5 / count by(instance) (node_cpu_seconds_total{mode="idle"})

# Top containers
topk(10, container_memory_working_set_bytes{container!=""} / 1024 / 1024)
\`\`\``,
        verify: `\`\`\`bash
# Verificar que queries de node retornam dados
curl -s 'http://localhost:9090/api/v1/query?query=(1-avg%20by(instance)(rate(node_cpu_seconds_total{mode=%22idle%22}[5m])))*100' | jq '.data.result | length'
# Saida esperada: numero > 0 (um resultado por node)

# Verificar queries de container
curl -s 'http://localhost:9090/api/v1/query?query=topk(5,container_memory_working_set_bytes{container!=%22%22})' | jq '.data.result | length'
# Saida esperada: 5 (ou menos se houver poucos containers)
\`\`\``
      },
      {
        title: 'Configurar Blackbox Exporter',
        instruction: `Configure o blackbox_exporter para probar endpoints HTTP e verifique os resultados.

\`\`\`yaml
# blackbox-config.yaml (ConfigMap)
apiVersion: v1
kind: ConfigMap
metadata:
  name: blackbox-config
  namespace: monitoring
data:
  blackbox.yml: |
    modules:
      http_2xx:
        prober: http
        timeout: 5s
        http:
          valid_status_codes: [200, 301, 302]
          method: GET
          follow_redirects: true
      tcp_connect:
        prober: tcp
        timeout: 5s
\`\`\`

\`\`\`bash
kubectl apply -f blackbox-config.yaml
\`\`\`

Teste o probe manualmente:
\`\`\`bash
# Testar probe HTTP
curl 'http://blackbox-exporter:9115/probe?target=http://kubernetes.default.svc:443&module=http_2xx'
\`\`\``,
        hints: [
          'O blackbox_exporter precisa de um ConfigMap com a configuracao dos modules',
          'Teste localmente antes de configurar no Prometheus',
          'probe_success=1 significa sucesso, 0 significa falha'
        ],
        solution: `\`\`\`bash
# Aplicar ConfigMap
kubectl apply -f blackbox-config.yaml

# Testar probe via port-forward
kubectl port-forward -n monitoring svc/blackbox-exporter 9115:9115 &
curl -s 'http://localhost:9115/probe?target=https://kubernetes.io&module=http_2xx' | grep probe_success
\`\`\``,
        verify: `\`\`\`bash
# Verificar ConfigMap
kubectl get cm blackbox-config -n monitoring
# Saida esperada: ConfigMap listado

# Verificar probe retorna metricas
curl -s 'http://localhost:9115/probe?target=http://localhost:9090&module=http_2xx' | grep "probe_success"
# Saida esperada: probe_success 1 (se Prometheus esta acessivel)
\`\`\``
      },
      {
        title: 'Analisar Cardinalidade de Metricas',
        instruction: `Analise a cardinalidade das metricas no cluster para identificar possiveis problemas de performance.

\`\`\`promql
# Total de series temporais ativas
prometheus_tsdb_head_series

# Top 10 metricas por numero de series
topk(10, count by(__name__) ({__name__!=""}))

# Metricas com mais de 1000 series (possivel cardinalidade alta)
count by(__name__) ({__name__!=""}) > 1000

# Total de series por job
count by(job) ({__name__!=""})

# Amostras ingeridas por segundo
rate(prometheus_tsdb_head_samples_appended_total[5m])
\`\`\`

Identifique metricas com cardinalidade excessiva e considere filtros.`,
        hints: [
          'Metricas com milhares de series podem indicar labels de alta cardinalidade',
          'Use metric_relabel_configs para dropar metricas desnecessarias',
          'prometheus_tsdb_head_series mostra o total de series ativas'
        ],
        solution: `\`\`\`promql
# Diagnostico completo de cardinalidade
# Total de series
prometheus_tsdb_head_series

# Top metricas
topk(10, count by(__name__) ({__name__!=""}))

# Cardinalidade por job (qual exporter gera mais series)
count by(job) ({__name__!=""})

# Taxa de ingestao
rate(prometheus_tsdb_head_samples_appended_total[5m])

# Tamanho do TSDB
prometheus_tsdb_storage_blocks_bytes
\`\`\``,
        verify: `\`\`\`bash
# Verificar total de series
curl -s 'http://localhost:9090/api/v1/query?query=prometheus_tsdb_head_series' | jq '.data.result[0].value[1]'
# Saida esperada: numero (total de series ativas)

# Verificar taxa de ingestao
curl -s 'http://localhost:9090/api/v1/query?query=rate(prometheus_tsdb_head_samples_appended_total[5m])' | jq '.data.result[0].value[1]'
# Saida esperada: numero (amostras por segundo)
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'node_exporter nao aparece nos targets do Prometheus',
      difficulty: 'easy',
      symptom: 'O DaemonSet do node_exporter esta rodando em todos os nodes, mas nenhum target aparece no Prometheus.',
      diagnosis: `\`\`\`bash
# Verificar DaemonSet
kubectl get ds -n monitoring -l app.kubernetes.io/name=node-exporter -o wide

# Verificar pods do node_exporter
kubectl get pods -n monitoring -l app.kubernetes.io/name=node-exporter

# Verificar se o Service existe
kubectl get svc -n monitoring -l app.kubernetes.io/name=node-exporter

# Testar endpoint diretamente
kubectl port-forward -n monitoring ds/node-exporter 9100:9100 &
curl -s http://localhost:9100/metrics | head -5
\`\`\``,
      solution: `**Causas comuns:**

1. **Service ou ServiceMonitor ausente:** O node_exporter precisa de um Service ou ServiceMonitor para ser descoberto.
\`\`\`bash
kubectl get svc -n monitoring | grep node
kubectl get servicemonitor -n monitoring | grep node
\`\`\`

2. **Porta incorreta:** node_exporter usa porta 9100 por padrao. Verificar que o Service aponta para a porta correta.

3. **Network Policy bloqueando:** Se o cluster tem NetworkPolicies, o Prometheus pode nao conseguir acessar a porta 9100 dos nodes.
\`\`\`bash
kubectl get networkpolicy -n monitoring
\`\`\`

4. **hostNetwork vs podNetwork:** node_exporter geralmente roda com hostNetwork: true para acessar metricas do host. Verificar que a configuracao esta correta.`
    },
    {
      title: 'kube-state-metrics mostra dados desatualizados ou incompletos',
      difficulty: 'medium',
      symptom: 'As metricas de kube-state-metrics nao refletem o estado atual do cluster. Pods novos nao aparecem ou pods deletados continuam nas metricas.',
      diagnosis: `\`\`\`bash
# Verificar health do kube-state-metrics
kubectl get deploy -n monitoring kube-state-metrics
kubectl logs -n monitoring -l app.kubernetes.io/name=kube-state-metrics --tail=20

# Verificar se ha erros de RBAC
kubectl logs -n monitoring -l app.kubernetes.io/name=kube-state-metrics | grep -i "error\\|forbidden"

# Verificar se o scrape esta funcionando
curl -s 'http://localhost:9090/api/v1/targets' | jq '.data.activeTargets[] | select(.labels.job | contains("kube-state")) | {health: .health, lastScrape: .lastScrape}'
\`\`\``,
      solution: `**Causas comuns:**

1. **RBAC insuficiente:** kube-state-metrics precisa de ClusterRole com permissoes amplas para ler objetos K8s.
\`\`\`bash
kubectl get clusterrole kube-state-metrics -o yaml | grep -A3 resources
# Deve incluir: pods, deployments, nodes, services, etc.
\`\`\`

2. **Versao desatualizada:** Versoes antigas de kube-state-metrics podem nao suportar objetos mais recentes do K8s.
\`\`\`bash
kubectl get deploy -n monitoring kube-state-metrics -o jsonpath='{.spec.template.spec.containers[0].image}'
\`\`\`

3. **Scrape timeout:** Se kube-state-metrics tem muitos objetos, o scrape pode exceder o timeout.
\`\`\`yaml
# Aumentar timeout no scrape_config
scrape_timeout: 30s  # padrao e 10s
\`\`\`

4. **Sharding incorreto:** Se kube-state-metrics usa sharding, cada shard so expoe parte dos objetos. Verificar configuracao de sharding.`
    },
    {
      title: 'Alta cardinalidade causando OOM no Prometheus',
      difficulty: 'hard',
      symptom: 'O Prometheus esta consumindo muita memoria e eventualmente e OOM-killed. Queries estao lentas e o TSDB esta grande.',
      diagnosis: `\`\`\`promql
# Total de series ativas
prometheus_tsdb_head_series

# Metricas com mais series
topk(20, count by(__name__) ({__name__!=""}))

# Series por job
count by(job) ({__name__!=""})

# Taxa de criacao de novas series
rate(prometheus_tsdb_head_series_created_total[5m])

# Amostras por segundo
rate(prometheus_tsdb_head_samples_appended_total[5m])
\`\`\``,
      solution: `**Estrategias para reduzir cardinalidade:**

1. **Identificar metricas problematicas:**
\`\`\`promql
# Top 20 metricas por numero de series
topk(20, count by(__name__) ({__name__!=""}))
\`\`\`

2. **Dropar metricas desnecessarias:**
\`\`\`yaml
metric_relabel_configs:
  - source_labels: [__name__]
    action: drop
    regex: "go_.*|process_.*|promhttp_.*"
\`\`\`

3. **Remover labels de alta cardinalidade:**
\`\`\`yaml
metric_relabel_configs:
  - action: labeldrop
    regex: "pod_template_hash|controller_revision_hash"
\`\`\`

4. **Reduzir retention:**
\`\`\`bash
# prometheus.yml ou flag
--storage.tsdb.retention.time=7d  # padrao e 15d
--storage.tsdb.retention.size=10GB
\`\`\`

5. **Usar sharding do kube-state-metrics:**
\`\`\`bash
# Dividir kube-state-metrics em shards
--shard=0 --total-shards=2
\`\`\``
    }
  ]
};
