window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['prom-grafana/grafana-dashboards'] = {
  theory: `
# Grafana Dashboards para Kubernetes

## Relevancia
Grafana e a ferramenta padrao para visualizacao de metricas Prometheus. Criar dashboards efetivos e essencial para ter visibilidade sobre o cluster Kubernetes, identificar problemas rapidamente e comunicar o estado da infraestrutura para a equipe.

## Conceitos Fundamentais

### O que e o Grafana?
Grafana e uma plataforma open-source de observabilidade e visualizacao de dados. Ele se conecta a diversas fontes de dados (Prometheus, Loki, Elasticsearch, etc.) e permite criar dashboards interativos com graficos, tabelas e alertas.

### Arquitetura Grafana + Prometheus

\`\`\`
+-------------------+     +-----------+     +------------------+
| Prometheus        |     | Grafana   |     | Usuarios         |
| (armazena dados)  |<--->| (consulta)|<--->| (visualizam)     |
+-------------------+     | PromQL    |     | dashboards       |
                          +-----------+     +------------------+
\`\`\`

### Componentes de um Dashboard

| Componente | Descricao |
|-----------|-----------|
| **Dashboard** | Colecao de paineis organizados em uma pagina |
| **Panel** | Visualizacao individual (grafico, gauge, tabela, etc.) |
| **Row** | Agrupamento horizontal de paineis |
| **Variable** | Parametro dinamico (namespace, node, pod) para filtros |
| **Annotation** | Marcacao temporal sobre eventos (deploys, incidents) |
| **Data Source** | Fonte de dados (Prometheus, Loki, etc.) |

### Tipos de Paineis Principais

| Tipo | Uso | Melhor Para |
|------|-----|-------------|
| **Time Series** | Graficos de linha ao longo do tempo | CPU, memoria, requests/s |
| **Stat** | Valor unico grande | Total de pods, uptime |
| **Gauge** | Medidor circular | Porcentagem de uso (0-100%) |
| **Bar Gauge** | Barras horizontais/verticais | Comparacao entre nodes/pods |
| **Table** | Tabela de dados | Lista de pods, alertas ativos |
| **Heatmap** | Mapa de calor | Distribuicao de latencia |
| **Logs** | Visualizador de logs | Integrado com Loki |

### Criando um Dashboard Basico

**Passo 1: Adicionar Data Source Prometheus**
\`\`\`
Grafana > Configuration > Data Sources > Add data source
- Type: Prometheus
- URL: http://prometheus:9090
- Access: Server (default)
- Save & Test
\`\`\`

**Passo 2: Criar Dashboard**
\`\`\`
+ > Dashboard > Add new panel
\`\`\`

**Passo 3: Configurar Panel**
\`\`\`yaml
# Query PromQL para CPU de nodes
Query: (1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100
Legend: {{ instance }}
Panel Title: "CPU Usage by Node"
Unit: Percent (0-100)
\`\`\`

### Variables (Template Variables)

Variables tornam dashboards dinamicos e reutilizaveis:

\`\`\`
Dashboard Settings > Variables > Add variable

# Variable: namespace
Name: namespace
Type: Query
Data source: Prometheus
Query: label_values(kube_pod_info, namespace)
Refresh: On time range change

# Variable: pod
Name: pod
Type: Query
Data source: Prometheus
Query: label_values(kube_pod_info{namespace="$namespace"}, pod)
Refresh: On time range change
\`\`\`

**Usando variaveis em queries:**
\`\`\`promql
# Filtrar por namespace selecionado
container_memory_usage_bytes{namespace="$namespace"}

# Filtrar por pod (variavel com dependencia)
rate(container_cpu_usage_seconds_total{namespace="$namespace", pod="$pod"}[5m])

# Multi-value (quando permite selecionar varios)
container_memory_usage_bytes{namespace=~"$namespace"}
\`\`\`

**Tipos de Variaveis:**
| Tipo | Descricao |
|------|-----------|
| \`Query\` | Valores dinamicos de uma query PromQL |
| \`Custom\` | Lista fixa de valores |
| \`Interval\` | Intervalos de tempo (1m, 5m, 15m, 1h) |
| \`Datasource\` | Selecao de data source |
| \`Text box\` | Input livre do usuario |

### Dashboards Essenciais para Kubernetes

**1. Cluster Overview**
\`\`\`promql
# Total de nodes
count(kube_node_info)

# Total de pods running
count(kube_pod_status_phase{phase="Running"})

# CPU total do cluster (%)
avg(1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100

# Memoria total do cluster (%)
(1 - sum(node_memory_MemAvailable_bytes) / sum(node_memory_MemTotal_bytes)) * 100
\`\`\`

**2. Node Dashboard**
\`\`\`promql
# CPU por node
(1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[$__rate_interval]))) * 100

# Memoria por node
(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100

# Disco por node
(1 - node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100

# Network I/O
rate(node_network_receive_bytes_total{device!="lo"}[$__rate_interval])
rate(node_network_transmit_bytes_total{device!="lo"}[$__rate_interval])
\`\`\`

**3. Pod/Container Dashboard**
\`\`\`promql
# CPU por pod
sum by(pod) (rate(container_cpu_usage_seconds_total{namespace="$namespace", container!=""}[$__rate_interval]))

# Memoria por pod
sum by(pod) (container_memory_working_set_bytes{namespace="$namespace", container!=""})

# Restarts
kube_pod_container_status_restarts_total{namespace="$namespace"}

# Status dos pods
kube_pod_status_phase{namespace="$namespace"}
\`\`\`

### $__rate_interval e $__interval

Grafana fornece variaveis especiais para ranges:

| Variavel | Descricao | Quando Usar |
|----------|-----------|-------------|
| \`$__rate_interval\` | Intervalo seguro para rate() (garante >= 4x scrape_interval) | Sempre com rate()/irate() |
| \`$__interval\` | Intervalo baseado no time range e resolucao do painel | Com funcoes _over_time |
| \`$__range\` | Time range completo selecionado | Com increase() do periodo todo |

\`\`\`promql
# CORRETO: usar $__rate_interval com rate()
rate(http_requests_total[$__rate_interval])

# EVITAR: hardcoded [5m] (nao adapta ao zoom)
rate(http_requests_total[5m])
\`\`\`

### Importando Dashboards da Comunidade

Grafana tem uma biblioteca de dashboards prontos:

\`\`\`
Grafana > + > Import > Dashboard ID

# IDs populares:
1860  — Node Exporter Full
315   — Kubernetes Cluster Monitoring
6417  — Kubernetes Cluster (Prometheus)
13105 — kube-state-metrics
\`\`\`

### Dashboard as Code (Provisioning)

\`\`\`yaml
# /etc/grafana/provisioning/dashboards/default.yaml
apiVersion: 1
providers:
  - name: 'default'
    orgId: 1
    folder: 'Kubernetes'
    type: file
    options:
      path: /var/lib/grafana/dashboards
      foldersFromFilesStructure: true
\`\`\`

Dashboards podem ser exportados como JSON e versionados no Git.

## Erros Comuns

1. **Usar [5m] hardcoded em vez de $__rate_interval**: O intervalo fixo nao se adapta ao zoom do dashboard e pode causar gaps.
2. **Nao usar variaveis**: Dashboards sem variaveis nao sao reutilizaveis e precisam ser duplicados para cada namespace/cluster.
3. **Muitos paineis em um dashboard**: Dashboards com 30+ paineis ficam lentos e difíceis de ler. Divida em dashboards focados.
4. **Nao configurar unidades**: Mostrar bytes sem converter para MB/GB torna os dados ilegíveis.
5. **Esquecer thresholds visuais**: Paineis sem indicacao visual de bom/ruim (verde/amarelo/vermelho) dificultam a interpretacao.
6. **Nao versionar dashboards**: Dashboards criados manualmente podem ser perdidos. Use provisioning e Git.

## Killer.sh Style Challenge

**Cenario:** Crie dashboards Grafana para monitoramento de um cluster Kubernetes.

**Tarefas:**
1. Crie um dashboard de overview do cluster com stat panels para total de nodes, pods e uso de CPU/memoria
2. Adicione variaveis para namespace e pod
3. Crie um painel time series de CPU por node usando $__rate_interval
4. Importe o dashboard Node Exporter Full (ID 1860)

**Dicas:**
- Use \`$__rate_interval\` em todas as queries com rate()
- Configure unidades (percent, bytes, seconds) nos paineis
- Adicione thresholds: verde < 60%, amarelo < 80%, vermelho > 80%
`,
  quiz: [
    {
      question: 'Qual a funcao da variavel $__rate_interval no Grafana?',
      options: [
        'Define o intervalo de refresh do dashboard',
        'Fornece um intervalo seguro para rate() que garante dados suficientes independente do zoom',
        'Define o scrape_interval do Prometheus',
        'Controla a resolucao do grafico'
      ],
      correct: 1,
      explanation: '$__rate_interval calcula automaticamente um intervalo seguro para rate() (pelo menos 4x o scrape_interval). Isso garante que sempre haja pontos de dados suficientes, independentemente do nivel de zoom do dashboard.',
      reference: 'Conceito relacionado: promql-basics — rate() precisa de pelo menos 2x o scrape_interval para funcionar.'
    },
    {
      question: 'Qual tipo de painel Grafana e mais adequado para mostrar porcentagem de uso de CPU (0-100%)?',
      options: [
        'Time Series',
        'Stat',
        'Gauge',
        'Table'
      ],
      correct: 2,
      explanation: 'O painel Gauge (medidor circular) e ideal para porcentagens com limites definidos (0-100%). Ele permite adicionar thresholds visuais (verde/amarelo/vermelho) e mostra claramente o nivel atual. Time Series seria melhor para ver a evolucao ao longo do tempo.',
      reference: 'Conceito relacionado: grafana-dashboards — escolha o tipo de painel baseado no que voce quer comunicar.'
    },
    {
      question: 'Como usar variaveis de template para tornar um dashboard Grafana reutilizavel?',
      options: [
        'Criar um dashboard separado para cada namespace',
        'Definir variaveis (Query type) que populam dinamicamente e usar $variavel nas queries PromQL',
        'Codificar todos os valores diretamente nas queries',
        'Usar apenas dashboards importados da comunidade'
      ],
      correct: 1,
      explanation: 'Variaveis de template do tipo Query podem ser populadas dinamicamente via PromQL (ex: label_values(kube_pod_info, namespace)). Ao usar $namespace nas queries, o dashboard se adapta ao valor selecionado, eliminando a necessidade de duplicar dashboards.',
      reference: 'Conceito relacionado: promql-basics — label_values() e uma funcao especial disponivel no Grafana para popular variaveis.'
    },
    {
      question: 'Qual ID de dashboard da comunidade Grafana e recomendado para monitoramento completo de nodes com node_exporter?',
      options: [
        'ID 315',
        'ID 1860',
        'ID 6417',
        'ID 13105'
      ],
      correct: 1,
      explanation: 'O dashboard ID 1860 (Node Exporter Full) e o mais popular e completo para monitoramento de nodes com node_exporter. Inclui CPU, memoria, disco, rede e muitos outros paineis. IDs 315 e 6417 sao para cluster overview, 13105 e para kube-state-metrics.',
      reference: 'Conceito relacionado: prom-exporters — node_exporter expoe as metricas que este dashboard visualiza.'
    },
    {
      question: 'Por que e importante configurar unidades (units) nos paineis do Grafana?',
      options: [
        'Porque sem unidades o Grafana nao funciona',
        'Para que valores brutos (ex: bytes) sejam formatados de forma legivel (ex: GB) e comparaveis',
        'Para melhorar a performance das queries',
        'Porque e obrigatorio para exportar dashboards'
      ],
      correct: 1,
      explanation: 'Sem unidades configuradas, um valor de 1073741824 bytes e ilegivel. Com a unidade "bytes", o Grafana formata para "1 GB". Unidades tambem garantem que eixos e tooltips mostrem informacoes precisas e comparaveis.',
      reference: 'Conceito relacionado: prom-exporters — convencoes de nomes usam unidades base (bytes, seconds).'
    },
    {
      question: 'O que e Dashboard as Code (provisioning) no Grafana?',
      options: [
        'Criar dashboards usando linha de comando',
        'Definir dashboards como arquivos JSON/YAML versionados no Git e carregados automaticamente pelo Grafana',
        'Codificar dashboards em JavaScript',
        'Usar a API do Grafana para criar dashboards manualmente'
      ],
      correct: 1,
      explanation: 'Dashboard as Code significa definir dashboards como arquivos JSON exportados do Grafana, armazena-los no Git, e configura o provisioning do Grafana para carrega-los automaticamente. Isso garante reprodutibilidade, versionamento e consistencia entre ambientes.',
      reference: 'Conceito relacionado: prom-alerting — alerting rules tambem podem ser versionadas como codigo.'
    },
    {
      question: 'Qual a diferenca entre $__rate_interval e $__interval no Grafana?',
      options: [
        'Sao a mesma coisa',
        '$__rate_interval e seguro para rate() (>= 4x scrape), $__interval se adapta ao zoom/resolucao do painel',
        '$__interval e para rate(), $__rate_interval e para avg_over_time()',
        '$__rate_interval e fixo, $__interval e dinamico'
      ],
      correct: 1,
      explanation: '$__rate_interval garante um intervalo minimo seguro para rate() (pelo menos 4x o scrape_interval). $__interval se adapta ao time range e resolucao do painel. Para rate(), sempre use $__rate_interval; para funcoes _over_time, use $__interval.',
      reference: 'Conceito relacionado: promql-basics — o intervalo do rate() deve ser >= 2x o scrape_interval.'
    }
  ],
  flashcards: [
    {
      front: 'Quais sao os tipos de paineis mais usados no Grafana?',
      back: '- **Time Series** — graficos de linha ao longo do tempo (CPU, memoria)\n- **Stat** — valor unico grande (total de pods, uptime)\n- **Gauge** — medidor circular (porcentagem 0-100%)\n- **Bar Gauge** — barras comparativas (entre nodes/pods)\n- **Table** — tabela de dados (lista de pods)\n- **Heatmap** — mapa de calor (distribuicao de latencia)\n- **Logs** — visualizador de logs (integrado com Loki)'
    },
    {
      front: 'Quando usar $__rate_interval vs $__interval vs $__range?',
      back: '**$__rate_interval**: para rate()/irate()\n- Garante >= 4x scrape_interval\n- Adapta ao zoom mantendo seguranca\n\n**$__interval**: para funcoes _over_time\n- Baseado no time range e resolucao do painel\n- Se adapta automaticamente ao zoom\n\n**$__range**: para increase() do periodo inteiro\n- Corresponde ao time range selecionado (ex: "Last 24h")\n\nRegra: use $__rate_interval com rate(), $__interval com _over_time.'
    },
    {
      front: 'Como criar variaveis de template no Grafana?',
      back: 'Dashboard Settings > Variables > Add variable\n\n**Tipo Query:**\n```\nName: namespace\nQuery: label_values(kube_pod_info, namespace)\nRefresh: On time range change\n```\n\n**Com dependencia:**\n```\nName: pod\nQuery: label_values(kube_pod_info{namespace="$namespace"}, pod)\n```\n\n**Na query PromQL:**\n```promql\ncontainer_memory{namespace="$namespace", pod="$pod"}\n# Multi-value:\ncontainer_memory{namespace=~"$namespace"}\n```'
    },
    {
      front: 'Quais dashboards da comunidade sao essenciais para Kubernetes?',
      back: '**IDs populares para importar:**\n- **1860** — Node Exporter Full (nodes)\n- **315** — Kubernetes Cluster Monitoring\n- **6417** — Kubernetes Cluster (Prometheus)\n- **13105** — kube-state-metrics\n- **7249** — Kubernetes Cluster (kube-prometheus-stack)\n\nPara importar: Grafana > + > Import > cole o ID\n\nAjuste o data source para o Prometheus do seu cluster.'
    },
    {
      front: 'Quais as queries essenciais para um Cluster Overview dashboard?',
      back: '**Stat panels:**\n```promql\n# Total nodes\ncount(kube_node_info)\n\n# Total pods\ncount(kube_pod_status_phase{phase="Running"})\n```\n\n**Gauges:**\n```promql\n# CPU cluster (%)\navg(1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[$__rate_interval]))) * 100\n\n# Memoria cluster (%)\n(1 - sum(node_memory_MemAvailable_bytes) / sum(node_memory_MemTotal_bytes)) * 100\n```'
    },
    {
      front: 'O que e Dashboard as Code e como implementar?',
      back: '**Dashboard as Code** = dashboards definidos como arquivos JSON versionados no Git.\n\n**Implementacao:**\n1. Exporte dashboard como JSON: Dashboard > Share > Export\n2. Salve em repositorio Git\n3. Configure provisioning:\n```yaml\n# /etc/grafana/provisioning/dashboards/\napiVersion: 1\nproviders:\n  - name: default\n    type: file\n    options:\n      path: /var/lib/grafana/dashboards\n```\n4. Monte os JSONs no path configurado\n\nBeneficios: reprodutibilidade, versionamento, review via PR.'
    }
  ],
  lab: {
    scenario: 'Voce precisa criar dashboards Grafana para monitorar um cluster Kubernetes. O Grafana esta conectado ao Prometheus e voce tem node_exporter e kube-state-metrics instalados.',
    objective: 'Criar dashboards com diferentes tipos de paineis, configurar variaveis de template, usar $__rate_interval corretamente e importar dashboards da comunidade.',
    duration: '25-30 minutos',
    steps: [
      {
        title: 'Configurar Data Source e Verificar Conectividade',
        instruction: `Verifique que o Grafana esta conectado ao Prometheus.

1. Acesse o Grafana (geralmente http://localhost:3000)
2. Va em Configuration > Data Sources
3. Verifique que existe um data source Prometheus
4. Clique em "Save & Test" para validar a conexao

\`\`\`bash
# Verificar Grafana esta rodando
kubectl get svc -n monitoring | grep grafana

# Port-forward se necessario
kubectl port-forward -n monitoring svc/grafana 3000:80
\`\`\``,
        hints: [
          'Credenciais padrao do Grafana: admin/admin (ou admin/prom-operator no kube-prometheus-stack)',
          'O URL do Prometheus dentro do cluster e geralmente http://prometheus-server:9090 ou http://prometheus-kube-prometheus-prometheus:9090',
          'Use "Server" access mode, nao "Browser"'
        ],
        solution: `\`\`\`bash
# Verificar servicos de monitoring
kubectl get svc -n monitoring

# Port-forward Grafana
kubectl port-forward -n monitoring svc/grafana 3000:80 &

# Testar API do Grafana
curl -s http://admin:admin@localhost:3000/api/datasources | jq '.[].name'
\`\`\``,
        verify: `\`\`\`bash
# Verificar data sources configurados
curl -s http://admin:admin@localhost:3000/api/datasources | jq '.[].name'
# Saida esperada: lista contendo "Prometheus"

# Verificar saude do data source
curl -s http://admin:admin@localhost:3000/api/datasources/1/health | jq '.status'
# Saida esperada: "OK"
\`\`\``
      },
      {
        title: 'Criar Dashboard com Variaveis',
        instruction: `Crie um novo dashboard e configure variaveis de template.

1. Crie um novo dashboard: + > Dashboard
2. Va em Dashboard Settings (engrenagem) > Variables
3. Adicione as variaveis:

**Variable 1: namespace**
- Name: namespace
- Type: Query
- Data source: Prometheus
- Query: label_values(kube_pod_info, namespace)
- Multi-value: Yes
- Include All: Yes

**Variable 2: pod**
- Name: pod
- Type: Query
- Data source: Prometheus
- Query: label_values(kube_pod_info{namespace=~"$namespace"}, pod)
- Multi-value: Yes
- Include All: Yes

4. Salve o dashboard`,
        hints: [
          'Para variaveis Multi-value, use =~ em vez de = nas queries',
          'A variavel "pod" depende de "namespace" — use $namespace na query',
          'Refresh: "On time range change" garante valores atualizados'
        ],
        solution: `\`\`\`bash
# Criar dashboard via API (alternativa)
curl -X POST http://admin:admin@localhost:3000/api/dashboards/db \\
  -H "Content-Type: application/json" \\
  -d '{
    "dashboard": {
      "title": "K8s Overview",
      "templating": {
        "list": [
          {
            "name": "namespace",
            "type": "query",
            "query": "label_values(kube_pod_info, namespace)",
            "multi": true,
            "includeAll": true
          }
        ]
      },
      "panels": []
    }
  }'
\`\`\``,
        verify: `\`\`\`bash
# Verificar que o dashboard foi criado
curl -s http://admin:admin@localhost:3000/api/search?query=K8s | jq '.[].title'
# Saida esperada: conter o titulo do dashboard criado

# Verificar variaveis de template
curl -s 'http://localhost:9090/api/v1/query?query=label_values(kube_pod_info,namespace)' 2>/dev/null || echo "Use a UI do Grafana para verificar variaveis"
\`\`\``
      },
      {
        title: 'Adicionar Paineis de Monitoramento',
        instruction: `Adicione paineis ao dashboard com diferentes tipos de visualizacao.

**Painel 1 — Stat: Total de Pods**
- Type: Stat
- Query: count(kube_pod_status_phase{namespace=~"$namespace", phase="Running"})
- Title: "Running Pods"

**Painel 2 — Gauge: CPU do Cluster**
- Type: Gauge
- Query: avg(1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[$__rate_interval]))) * 100
- Title: "Cluster CPU Usage"
- Unit: Percent (0-100)
- Thresholds: 0=green, 60=yellow, 80=red

**Painel 3 — Time Series: CPU por Node**
- Type: Time Series
- Query: (1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[$__rate_interval]))) * 100
- Legend: {{ instance }}
- Title: "CPU Usage by Node"
- Unit: Percent (0-100)

**Painel 4 — Table: Pods com Restarts**
- Type: Table
- Query: topk(10, kube_pod_container_status_restarts_total{namespace=~"$namespace"})
- Title: "Top Pod Restarts"`,
        hints: [
          'Use $__rate_interval em vez de [5m] hardcoded nas queries com rate()',
          'Configure unidades nos paineis: percent para %, bytes(IEC) para memoria',
          'Adicione thresholds para feedback visual'
        ],
        solution: `\`\`\`promql
# Stat: pods running
count(kube_pod_status_phase{namespace=~"$namespace", phase="Running"})

# Gauge: CPU cluster
avg(1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[$__rate_interval]))) * 100

# Time Series: CPU por node
(1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[$__rate_interval]))) * 100

# Time Series: Memoria por namespace
sum by(namespace) (container_memory_working_set_bytes{container!="", namespace=~"$namespace"}) / 1024 / 1024

# Table: pods com restarts
sort_desc(topk(10, kube_pod_container_status_restarts_total{namespace=~"$namespace"}))
\`\`\``,
        verify: `\`\`\`bash
# Verificar que as queries retornam dados no Prometheus
curl -s 'http://localhost:9090/api/v1/query?query=count(kube_pod_status_phase{phase=%22Running%22})' | jq '.data.result[0].value[1]'
# Saida esperada: numero de pods running

curl -s 'http://localhost:9090/api/v1/query?query=avg(1-avg%20by(instance)(rate(node_cpu_seconds_total{mode=%22idle%22}[5m])))*100' | jq '.data.result[0].value[1]'
# Saida esperada: porcentagem de CPU do cluster
\`\`\``
      },
      {
        title: 'Importar Dashboard da Comunidade',
        instruction: `Importe um dashboard popular da comunidade Grafana.

1. No Grafana, va em + > Import
2. No campo "Import via grafana.com", digite o ID: **1860**
3. Clique em "Load"
4. Selecione o data source Prometheus
5. Clique em "Import"

Este dashboard (Node Exporter Full) fornece visualizacao completa dos nodes.

Tambem importe:
- ID **13105** para kube-state-metrics
- ID **315** para Kubernetes Cluster Monitoring

\`\`\`bash
# Importar via API
curl -X POST http://admin:admin@localhost:3000/api/dashboards/import \\
  -H "Content-Type: application/json" \\
  -d '{"dashboard": {"id": 1860}, "inputs": [{"name": "DS_PROMETHEUS", "type": "datasource", "pluginId": "prometheus", "value": "Prometheus"}]}'
\`\`\``,
        hints: [
          'Certifique-se de selecionar o data source correto ao importar',
          'Dashboards importados podem precisar de ajustes nas variaveis',
          'Verifique que as metricas necessarias existem (node_exporter instalado)'
        ],
        solution: `\`\`\`bash
# Importar Node Exporter Full (ID 1860) via API
curl -X POST http://admin:admin@localhost:3000/api/dashboards/import \\
  -H "Content-Type: application/json" \\
  -d '{"dashboard": {"id": 1860}, "inputs": [{"name": "DS_PROMETHEUS", "type": "datasource", "pluginId": "prometheus", "value": "Prometheus"}], "folderId": 0, "overwrite": true}'

# Listar dashboards importados
curl -s http://admin:admin@localhost:3000/api/search | jq '.[].title'
\`\`\``,
        verify: `\`\`\`bash
# Verificar que dashboards foram importados
curl -s http://admin:admin@localhost:3000/api/search | jq '. | length'
# Saida esperada: numero > 0

# Verificar dashboard especifico
curl -s http://admin:admin@localhost:3000/api/search?query=Node%20Exporter | jq '.[].title'
# Saida esperada: "Node Exporter Full" ou similar
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Painel mostra "No data" mesmo com metricas existentes',
      difficulty: 'easy',
      symptom: 'Um painel no Grafana mostra "No data" ou e vazio, mas voce sabe que as metricas existem no Prometheus.',
      diagnosis: `\`\`\`bash
# Verificar a query diretamente no Prometheus
curl -s 'http://localhost:9090/api/v1/query?query=YOUR_QUERY' | jq '.data.result | length'

# Verificar data source
curl -s http://admin:admin@localhost:3000/api/datasources/1/health | jq '.status'

# Verificar time range do painel
# Na UI: verificar se o time range (Last 1h, Last 24h) cobre o periodo com dados
\`\`\``,
      solution: `**Causas comuns:**

1. **Data source errado:** O painel pode estar usando o data source errado. Verifique na query do painel.

2. **Time range muito curto:** Se os dados sao esparsos, "Last 15 minutes" pode nao ter dados. Aumente o time range.

3. **Variavel vazia:** Se uma variavel de template ($namespace) esta vazia ou tem valor invalido, a query retorna vazio.

4. **Query com erro:** Verifique a query no Query Inspector (icone de lupa no painel). Erros de sintaxe aparecem ali.

5. **Tipo de painel incompativel:** Um painel Stat com uma query que retorna range vector nao funciona. Verifique a compatibilidade.`
    },
    {
      title: 'Dashboard lento com muitos paineis',
      difficulty: 'medium',
      symptom: 'O dashboard demora muito para carregar, paineis ficam em loading por varios segundos, e a experiencia do usuario e ruim.',
      diagnosis: `\`\`\`bash
# Verificar tempo de resposta das queries
# No Grafana: Query Inspector > mostra tempo de cada query

# Verificar no Prometheus
curl -s 'http://localhost:9090/api/v1/query?query=YOUR_EXPENSIVE_QUERY' -w "\\n%{time_total}s"

# Verificar quantidade de series retornadas
curl -s 'http://localhost:9090/api/v1/query?query=count(YOUR_QUERY)' | jq '.data.result[0].value[1]'
\`\`\``,
      solution: `**Estrategias de otimizacao:**

1. **Reduzir numero de paineis:** Divida dashboards com 20+ paineis em dashboards menores e focados.

2. **Usar recording rules:** Pre-calcule queries caras no Prometheus.
\`\`\`yaml
# Em vez de: avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))
# Criar recording rule: instance:node_cpu:idle_rate5m
\`\`\`

3. **Limitar series por painel:** Use topk() ou filtros para limitar o numero de series.

4. **Ajustar resolucao:** Reduza o "Max data points" do painel para diminuir a quantidade de dados.

5. **Usar cache do Grafana:** Configure caching no data source Prometheus.

6. **Lazy loading:** Dashboards mais recentes do Grafana suportam carregamento lazy de paineis fora da viewport.`
    },
    {
      title: 'Variaveis de template nao populam corretamente',
      difficulty: 'medium',
      symptom: 'As variaveis do dashboard (dropdowns de namespace, pod, etc.) estao vazias ou mostram valores incorretos.',
      diagnosis: `\`\`\`bash
# Testar a query da variavel diretamente
curl -s 'http://localhost:9090/api/v1/label/namespace/values' | jq '.data'

# Verificar se a metrica referenciada existe
curl -s 'http://localhost:9090/api/v1/query?query=kube_pod_info' | jq '.data.result | length'

# Verificar syntax da query da variavel no Grafana
# Dashboard Settings > Variables > editar variavel > Preview of values
\`\`\``,
      solution: `**Causas comuns:**

1. **Metrica nao existe:** \`label_values(kube_pod_info, namespace)\` requer que kube_pod_info exista (kube-state-metrics instalado).

2. **Query com syntax errada:** Use a funcao correta: \`label_values(metrica, label)\` para listar valores unicos de uma label.

3. **Dependencia circular:** Se variavel A depende de B e B depende de A, ambas ficam vazias. Remova a circularidade.

4. **Refresh desabilitado:** Configure Refresh para "On time range change" ou "On dashboard load" para manter os valores atualizados.

5. **Data source errado na variavel:** Cada variavel pode ter seu proprio data source. Verifique que esta apontando para o Prometheus correto.`
    }
  ]
};
