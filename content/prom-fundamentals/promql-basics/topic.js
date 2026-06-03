window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['prom-fundamentals/promql-basics'] = {
  theory: `
# PromQL — Fundamentos

## Relevancia
PromQL (Prometheus Query Language) e a linguagem de consulta do Prometheus. Dominar PromQL e essencial para criar dashboards, alertas e fazer troubleshooting em ambientes Kubernetes. E uma habilidade central para qualquer engenheiro SRE/DevOps.

## Conceitos Fundamentais

### O que e PromQL?
PromQL e uma linguagem funcional de consulta projetada especificamente para dados de series temporais. Ela permite selecionar, filtrar, agregar e transformar metricas coletadas pelo Prometheus.

### Tipos de Dados em PromQL

| Tipo | Descricao | Exemplo |
|------|-----------|---------|
| **Instant Vector** | Conjunto de series temporais com um unico valor por serie (no instante atual) | \`http_requests_total\` |
| **Range Vector** | Conjunto de series temporais com valores ao longo de um intervalo de tempo | \`http_requests_total[5m]\` |
| **Scalar** | Valor numerico flutuante simples | \`42.5\` |
| **String** | Valor de texto (raramente usado) | \`"hello"\` |

### Seletores de Metricas

#### Seletor Simples
\`\`\`promql
# Retorna todas as series da metrica
http_requests_total
\`\`\`

#### Label Matchers
\`\`\`promql
# Igualdade exata
http_requests_total{method="GET"}

# Negacao
http_requests_total{method!="DELETE"}

# Regex match
http_requests_total{handler=~"/api/.*"}

# Regex negado
http_requests_total{handler!~"/health|/ready"}
\`\`\`

| Operador | Significado |
|----------|-------------|
| \`=\` | Igualdade exata |
| \`!=\` | Diferente de |
| \`=~\` | Regex match |
| \`!~\` | Regex nao match |

### Range Vectors (Vetores de Intervalo)

Range vectors selecionam valores ao longo de um periodo de tempo:

\`\`\`promql
# Ultimos 5 minutos
http_requests_total[5m]

# Ultimas 1 hora
node_cpu_seconds_total[1h]

# Ultimos 30 segundos
container_memory_usage_bytes[30s]
\`\`\`

**Sufixos de duracao:**

| Sufixo | Significado |
|--------|-------------|
| \`s\` | Segundos |
| \`m\` | Minutos |
| \`h\` | Horas |
| \`d\` | Dias |
| \`w\` | Semanas |
| \`y\` | Anos |

### Offset Modifier

Consulta dados no passado:
\`\`\`promql
# Taxa de requests 1 hora atras
rate(http_requests_total[5m] offset 1h)

# Memoria usada ontem
container_memory_usage_bytes offset 1d
\`\`\`

## Comandos Essenciais — Funcoes Basicas

### rate() — Taxa por Segundo
Calcula a taxa media por segundo de aumento de um counter ao longo de um intervalo:
\`\`\`promql
# Requests por segundo nos ultimos 5 minutos
rate(http_requests_total[5m])

# Bytes recebidos por segundo
rate(node_network_receive_bytes_total[5m])
\`\`\`

> **Regra:** Use \`rate()\` somente com **counters** (metricas que so crescem). Nunca use com gauges.

### irate() — Taxa Instantanea
Calcula a taxa usando apenas os dois ultimos pontos do intervalo:
\`\`\`promql
# Taxa instantanea de requests
irate(http_requests_total[5m])
\`\`\`

> **rate vs irate:** \`rate()\` e mais suave e ideal para alertas. \`irate()\` e mais sensivel a picos e melhor para dashboards detalhados.

### increase() — Incremento Total
Retorna o aumento total de um counter ao longo de um intervalo:
\`\`\`promql
# Total de requests nos ultimos 30 minutos
increase(http_requests_total[30m])

# Equivale a: rate(http_requests_total[30m]) * 1800
\`\`\`

### Operadores Aritmeticos

\`\`\`promql
# Porcentagem de memoria usada
(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes * 100

# Disco livre em GB
node_filesystem_avail_bytes / 1024 / 1024 / 1024
\`\`\`

| Operador | Descricao |
|----------|-----------|
| \`+\` | Soma |
| \`-\` | Subtracao |
| \`*\` | Multiplicacao |
| \`/\` | Divisao |
| \`%\` | Modulo |
| \`^\` | Potencia |

### Operadores de Comparacao

\`\`\`promql
# Nodes com mais de 80% de CPU
100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80

# Pods com memoria acima de 1GB
container_memory_usage_bytes > 1073741824
\`\`\`

| Operador | Descricao |
|----------|-----------|
| \`==\` | Igual |
| \`!=\` | Diferente |
| \`>\` | Maior que |
| \`<\` | Menor que |
| \`>=\` | Maior ou igual |
| \`<=\` | Menor ou igual |

## Funcoes de Agregacao

### sum() — Soma
\`\`\`promql
# Total de requests por metodo
sum by(method) (rate(http_requests_total[5m]))

# Total de memoria de todos os containers
sum(container_memory_usage_bytes)
\`\`\`

### avg() — Media
\`\`\`promql
# Media de CPU por node
avg by(instance) (rate(node_cpu_seconds_total{mode!="idle"}[5m]))
\`\`\`

### count() — Contagem
\`\`\`promql
# Quantos targets estao UP
count(up == 1)

# Quantos pods por namespace
count by(namespace) (kube_pod_info)
\`\`\`

### min() e max()
\`\`\`promql
# Menor uso de memoria entre containers
min(container_memory_usage_bytes{container!=""})

# Maior latencia por servico
max by(service) (http_request_duration_seconds)
\`\`\`

### topk() e bottomk()
\`\`\`promql
# Top 5 containers por uso de memoria
topk(5, container_memory_usage_bytes{container!=""})

# 3 endpoints mais lentos
topk(3, rate(http_request_duration_seconds_sum[5m]) / rate(http_request_duration_seconds_count[5m]))
\`\`\`

### Clausulas by e without
\`\`\`promql
# Agregar por namespace e pod
sum by(namespace, pod) (rate(container_cpu_usage_seconds_total[5m]))

# Agregar removendo a label instance
sum without(instance) (rate(http_requests_total[5m]))
\`\`\`

> **by** mantem apenas as labels listadas. **without** remove as labels listadas e mantem o resto.

## Erros Comuns

1. **Usar rate() em gauge**: rate() so funciona com counters. Para gauges, use \`avg_over_time()\`, \`max_over_time()\`, etc.
2. **Esquecer [intervalo] no rate()**: \`rate(http_requests_total)\` da erro. Precisa de range vector: \`rate(http_requests_total[5m])\`.
3. **Intervalo muito curto no rate()**: Se o scrape_interval e 15s, usar \`rate(x[15s])\` pode nao ter pontos suficientes. Use pelo menos 2x o scrape_interval.
4. **Nao usar by() na agregacao**: \`sum(rate(http_requests_total[5m]))\` agrega tudo em um numero. Se voce quer por servico, use \`sum by(service) (...)\`.
5. **Confundir rate() e increase()**: rate() retorna por segundo, increase() retorna o total no intervalo.

## Killer.sh Style Challenge

**Cenario:** Voce tem um cluster Kubernetes com Prometheus instalado. Precisa criar consultas PromQL para um dashboard de monitoramento.

**Tarefas:**
1. Calcule a taxa de requests HTTP por segundo, agrupada por status code, nos ultimos 5 minutos
2. Encontre os 3 namespaces com maior consumo de memoria
3. Calcule a porcentagem de CPU livre em cada node
4. Identifique pods com uso de memoria acima de 500Mi

**Solucoes:**
\`\`\`promql
# 1. Taxa de requests por status code
sum by(status) (rate(http_requests_total[5m]))

# 2. Top 3 namespaces por memoria
topk(3, sum by(namespace) (container_memory_usage_bytes{container!=""}))

# 3. CPU livre por node (porcentagem)
avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100

# 4. Pods com memoria > 500Mi
container_memory_usage_bytes{container!=""} > 524288000
\`\`\`
`,
  quiz: [
    {
      question: 'Qual funcao PromQL calcula a taxa media por segundo de um counter ao longo de um intervalo?',
      options: ['increase()', 'rate()', 'irate()', 'avg()'],
      correct: 1,
      explanation: 'rate() calcula a taxa media por segundo de aumento de um counter ao longo de um range vector. increase() retorna o incremento total, irate() calcula taxa instantanea usando os dois ultimos pontos, e avg() e uma funcao de agregacao.',
      reference: 'Conceito relacionado: prom-architecture — entenda como o scrape interval afeta o calculo de rate.'
    },
    {
      question: 'Qual e a diferenca entre um Instant Vector e um Range Vector em PromQL?',
      options: [
        'Instant Vector retorna strings, Range Vector retorna numeros',
        'Instant Vector retorna um valor por serie, Range Vector retorna valores ao longo de um intervalo de tempo',
        'Instant Vector e mais rapido que Range Vector',
        'Nao ha diferenca, sao sinonimos'
      ],
      correct: 1,
      explanation: 'Instant Vector retorna um unico valor (sample) por serie temporal no momento atual. Range Vector retorna uma sequencia de valores ao longo de um intervalo de tempo especificado (ex: [5m]).',
      reference: 'Conceito relacionado: promql-advanced — funcoes como rate() exigem range vectors como entrada.'
    },
    {
      question: 'Qual operador de label matcher e usado para regex match em PromQL?',
      options: ['==', '=~', '~=', 'regex()'],
      correct: 1,
      explanation: '=~ e o operador de regex match em PromQL. Ele usa expressoes regulares RE2. != e negacao, !~ e regex negado.',
      reference: 'Conceito relacionado: prom-service-discovery — labels sao fundamentais para filtrar targets.'
    },
    {
      question: 'Qual e o resultado de: sum by(namespace) (rate(container_cpu_usage_seconds_total[5m]))?',
      options: [
        'CPU total do cluster inteiro',
        'CPU por container em cada namespace',
        'Taxa de CPU por segundo, somada por namespace',
        'Media de CPU por namespace'
      ],
      correct: 2,
      explanation: 'A query calcula rate() para obter CPU/segundo de cada container, depois sum by(namespace) agrega somando todos os containers dentro de cada namespace. O resultado e a taxa total de CPU por namespace.',
      reference: 'Conceito relacionado: grafana-dashboards — essa query e comumente usada em dashboards de namespace.'
    },
    {
      question: 'Quando voce deve usar irate() em vez de rate()?',
      options: [
        'Sempre, pois irate() e mais preciso',
        'Para dashboards que precisam mostrar picos e variacao rapida',
        'Para alertas que precisam de estabilidade',
        'Quando a metrica e um gauge'
      ],
      correct: 1,
      explanation: 'irate() usa apenas os dois ultimos pontos do intervalo, tornando-a mais sensivel a picos. E ideal para dashboards detalhados. rate() e mais suave e estavel, melhor para alertas. Ambas sao exclusivas para counters.',
      reference: 'Conceito relacionado: prom-alerting — rate() e preferida em regras de alerta por ser mais estavel.'
    },
    {
      question: 'O que acontece se voce usar rate() em uma metrica do tipo gauge?',
      options: [
        'Funciona normalmente',
        'O resultado pode ser incorreto ou sem sentido, pois rate() assume valores sempre crescentes',
        'O Prometheus retorna erro de sintaxe',
        'O gauge e automaticamente convertido para counter'
      ],
      correct: 1,
      explanation: 'rate() assume que o valor so cresce (counter). Quando aplicada a um gauge (que pode subir e descer), os resultados sao incorretos porque rate() interpreta quedas como resets de counter. Use avg_over_time(), max_over_time() etc. para gauges.',
      reference: 'Conceito relacionado: prom-architecture — tipos de metricas (counter, gauge, histogram, summary).'
    },
    {
      question: 'Qual a diferenca entre as clausulas "by" e "without" em agregacoes PromQL?',
      options: [
        'by e mais rapido que without',
        'by mantem apenas as labels listadas, without remove as labels listadas',
        'by e without sao sinonimos',
        'without so funciona com sum()'
      ],
      correct: 1,
      explanation: 'by(label1, label2) mantem apenas as labels especificadas no resultado. without(label1) remove as labels especificadas e mantem todas as demais. Ambas podem ser usadas com qualquer funcao de agregacao.',
      reference: 'Conceito relacionado: promql-advanced — entenda como labels afetam vector matching.'
    },
    {
      question: 'Qual e o intervalo minimo recomendado para rate() se o scrape_interval e 30s?',
      options: [
        '15s — metade do scrape_interval',
        '30s — igual ao scrape_interval',
        '60s — pelo menos 2x o scrape_interval',
        '300s — sempre usar 5 minutos'
      ],
      correct: 2,
      explanation: 'O intervalo do rate() deve ser pelo menos 2x o scrape_interval para garantir que haja pontos suficientes para o calculo. Com scrape_interval de 30s, use [1m] ou mais. Intervalos muito curtos podem resultar em gaps no grafico.',
      reference: 'Conceito relacionado: prom-architecture — configuracao de scrape_interval no prometheus.yml.'
    }
  ],
  flashcards: [
    {
      front: 'Quais sao os 4 tipos de dados em PromQL?',
      back: '1. **Instant Vector** — um valor por serie no instante atual\n2. **Range Vector** — valores ao longo de um intervalo [5m]\n3. **Scalar** — valor numerico simples\n4. **String** — texto (raramente usado)'
    },
    {
      front: 'Qual a diferenca entre rate() e irate()?',
      back: '**rate()** calcula a taxa media por segundo usando todos os pontos do intervalo — mais suave, ideal para alertas.\n\n**irate()** usa apenas os dois ultimos pontos do intervalo — mais sensivel a picos, ideal para dashboards detalhados.\n\nAmbas so funcionam com counters.'
    },
    {
      front: 'Quais sao os 4 operadores de label matching em PromQL?',
      back: '- **=** igualdade exata\n- **!=** diferente de\n- **=~** regex match (RE2)\n- **!~** regex negado\n\nExemplo: http_requests_total{method=~"GET|POST", handler!~"/health.*"}'
    },
    {
      front: 'O que faz a funcao increase() e como se relaciona com rate()?',
      back: '**increase(counter[intervalo])** retorna o incremento total do counter no intervalo.\n\nE equivalente a: rate(counter[intervalo]) * segundos_no_intervalo\n\nExemplo: increase(http_requests_total[1h]) retorna o total de requests na ultima hora.'
    },
    {
      front: 'Para que serve o offset modifier em PromQL?',
      back: 'O **offset** permite consultar dados no passado relativo ao momento atual.\n\nExemplos:\n- rate(http_requests_total[5m] offset 1h) — taxa de 1 hora atras\n- container_memory_usage_bytes offset 1d — memoria de ontem\n\nUtil para comparar valores atuais com historicos.'
    },
    {
      front: 'Qual a diferenca entre "by" e "without" em agregacoes?',
      back: '**by(labels)** — mantem APENAS as labels listadas no resultado\n**without(labels)** — REMOVE as labels listadas e mantem todas as outras\n\nExemplo equivalente:\nsum by(namespace) (metric) = sum without(pod, container, instance) (metric)\n\nUse "by" quando quer poucas labels. Use "without" quando quer remover poucas labels.'
    },
    {
      front: 'Quais funcoes de agregacao sao mais comuns em PromQL?',
      back: '- **sum()** — soma total\n- **avg()** — media\n- **count()** — contagem de series\n- **min() / max()** — menor / maior valor\n- **topk(n, ...)** — top N series por valor\n- **bottomk(n, ...)** — N menores series\n- **stddev()** — desvio padrao\n- **quantile(q, ...)** — quantil (0-1)'
    },
    {
      front: 'Por que o intervalo do rate() deve ser >= 2x o scrape_interval?',
      back: 'O rate() precisa de pelo menos 2 pontos de dados para calcular a taxa. Se o scrape_interval e 15s e voce usa rate(x[15s]), pode haver apenas 1 ponto no intervalo (ou nenhum, considerando atrasos).\n\nRegra: intervalo >= 2 * scrape_interval\n\nExemplo: scrape_interval=15s -> use rate(x[30s]) ou mais. Na pratica, [1m] ou [5m] sao os mais comuns.'
    }
  ],
  lab: {
    scenario: 'Voce e responsavel pelo monitoramento de um cluster Kubernetes com Prometheus. Precisa escrever consultas PromQL fundamentais para entender o estado do cluster e das aplicacoes.',
    objective: 'Praticar consultas PromQL basicas: seletores, rate(), agregacoes e operadores. Ao final, voce tera escrito consultas prontas para uso em dashboards e alertas.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Explorar Metricas Disponiveis',
        instruction: `Acesse a interface web do Prometheus e explore as metricas disponiveis.

1. Acesse \`http://<prometheus-server>:9090\`
2. Na aba "Graph", digite consultas simples para explorar metricas:

\`\`\`promql
# Ver todas as series de uma metrica
up

# Filtrar por job
up{job="kubernetes-nodes"}

# Ver metricas de CPU
node_cpu_seconds_total{mode="idle"}

# Ver metricas de containers (se kube-state-metrics esta instalado)
kube_pod_info
\`\`\`

3. Use o autocompletar para descobrir metricas disponiveis
4. Na aba "Status > Targets", verifique quais targets estao sendo scrapeados`,
        hints: [
          'A metrica "up" mostra 1 para targets saudaveis e 0 para targets com falha',
          'Use Ctrl+Space para ativar o autocompletar no campo de query',
          'kube-state-metrics expoe metricas sobre objetos K8s (pods, deployments, etc.)'
        ],
        solution: `\`\`\`promql
# Verificar todos os targets e seu status
up

# Listar targets do Kubernetes
up{job=~"kubernetes.*"}

# Ver quantos targets estao UP
count(up == 1)

# Ver quantos targets estao DOWN
count(up == 0)
\`\`\``,
        verify: `\`\`\`bash
# Verificar se o Prometheus esta acessivel
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets | length'
# Saida esperada: numero > 0

# Verificar se a metrica "up" retorna dados
curl -s 'http://localhost:9090/api/v1/query?query=up' | jq '.data.result | length'
# Saida esperada: numero > 0

# Verificar metricas de node
curl -s 'http://localhost:9090/api/v1/query?query=count(node_cpu_seconds_total)' | jq '.data.result[0].value[1]'
# Saida esperada: numero > 0 (indica que node_exporter esta funcionando)
\`\`\``
      },
      {
        title: 'Calcular Taxas com rate() e irate()',
        instruction: `Pratique o uso de rate() e irate() para calcular taxas a partir de counters.

\`\`\`promql
# Taxa de requests HTTP por segundo (ultimos 5 min)
rate(http_requests_total[5m])

# Mesma metrica com irate (mais sensivel)
irate(http_requests_total[5m])

# Taxa de CPU por core (usando counter de CPU)
rate(node_cpu_seconds_total{mode!="idle"}[5m])

# Bytes de rede recebidos por segundo
rate(node_network_receive_bytes_total[5m])

# Incremento total de requests na ultima hora
increase(http_requests_total[1h])
\`\`\`

Compare os graficos de rate() vs irate() para a mesma metrica.`,
        hints: [
          'Se nao ha metricas HTTP, use metricas de node (node_cpu_seconds_total, node_network_receive_bytes_total)',
          'Use a aba "Graph" (nao "Table") para visualizar a diferenca entre rate e irate',
          'O intervalo [5m] e o mais comum em producao'
        ],
        solution: `\`\`\`promql
# Se nao tiver metricas HTTP, use metricas de node
# CPU total em uso por core
rate(node_cpu_seconds_total{mode!="idle"}[5m])

# Comparar rate vs irate no mesmo intervalo
rate(node_network_receive_bytes_total[5m])
irate(node_network_receive_bytes_total[5m])

# Total de bytes recebidos na ultima hora
increase(node_network_receive_bytes_total[1h])
\`\`\``,
        verify: `\`\`\`bash
# Verificar que rate() retorna resultados
curl -s 'http://localhost:9090/api/v1/query?query=rate(node_cpu_seconds_total{mode="idle"}[5m])' | jq '.data.result | length'
# Saida esperada: numero > 0 (um resultado por core)

# Verificar que os valores de rate sao numeros positivos
curl -s 'http://localhost:9090/api/v1/query?query=rate(node_cpu_seconds_total{mode="idle"}[5m])' | jq '.data.result[0].value[1]'
# Saida esperada: valor numerico entre 0 e 1 (fracao de tempo em idle)
\`\`\``
      },
      {
        title: 'Praticar Agregacoes',
        instruction: `Use funcoes de agregacao para obter visoes consolidadas do cluster.

\`\`\`promql
# Total de CPU usada por node
sum by(instance) (rate(node_cpu_seconds_total{mode!="idle"}[5m]))

# Media de CPU idle por node (em porcentagem)
avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100

# Contagem de pods por namespace
count by(namespace) (kube_pod_info)

# Top 5 pods por uso de memoria
topk(5, container_memory_usage_bytes{container!=""})

# Memoria total do cluster
sum(node_memory_MemTotal_bytes) / 1024 / 1024 / 1024
\`\`\`

Experimente trocar \`by\` por \`without\` para ver a diferenca.`,
        hints: [
          'Se kube-state-metrics nao esta instalado, nao tera metricas kube_pod_info',
          'container!="" filtra containers do sistema (POD sandbox containers)',
          'Use "Table" view para ver valores exatos de topk()'
        ],
        solution: `\`\`\`promql
# CPU por node em porcentagem (usando)
(1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100

# Memoria disponivel por node em GB
sum by(instance) (node_memory_MemAvailable_bytes) / 1024 / 1024 / 1024

# Pods por namespace (requer kube-state-metrics)
count by(namespace) (kube_pod_info)

# Sem kube-state-metrics, use metricas de container
count by(namespace) (count by(namespace, pod) (container_memory_usage_bytes{container!=""}))
\`\`\``,
        verify: `\`\`\`bash
# Verificar que agregacao por instance funciona
curl -s 'http://localhost:9090/api/v1/query?query=count(sum%20by(instance)(up))' | jq '.data.result[0].value[1]'
# Saida esperada: numero de nodes no cluster

# Verificar topk retorna resultados
curl -s 'http://localhost:9090/api/v1/query?query=topk(3,node_memory_MemTotal_bytes)' | jq '.data.result | length'
# Saida esperada: 3 (ou menos se tiver menos nodes)
\`\`\``
      },
      {
        title: 'Construir Queries Compostas',
        instruction: `Combine operadores, funcoes e agregacoes para queries mais complexas.

\`\`\`promql
# Porcentagem de memoria usada por node
(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100

# Porcentagem de disco usado por mount point
(1 - (node_filesystem_avail_bytes{fstype!~"tmpfs|overlay"} / node_filesystem_size_bytes{fstype!~"tmpfs|overlay"})) * 100

# Nodes com CPU acima de 80%
(1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100 > 80

# Requests por segundo comparando com 1 hora atras
rate(http_requests_total[5m]) / rate(http_requests_total[5m] offset 1h)
\`\`\`

Experimente usar o operador \`bool\` para gerar 0/1 em vez de filtrar:
\`\`\`promql
# Retorna 1 se CPU > 80%, 0 caso contrario
(1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100 > bool 80
\`\`\``,
        hints: [
          'Queries de porcentagem usam o padrao: (1 - disponivel/total) * 100',
          'O operador bool transforma comparacoes em 0/1 em vez de filtrar series',
          'Use offset para comparar metricas atuais com historicas'
        ],
        solution: `\`\`\`promql
# Query completa de saude do node
# CPU usada
(1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100

# Memoria usada
(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100

# Disco usado (apenas discos reais)
(1 - (node_filesystem_avail_bytes{mountpoint="/", fstype!~"tmpfs|overlay"} / node_filesystem_size_bytes{mountpoint="/", fstype!~"tmpfs|overlay"})) * 100

# Comparar taxa atual vs 1 hora atras
sum(rate(http_requests_total[5m])) / sum(rate(http_requests_total[5m] offset 1h))
\`\`\``,
        verify: `\`\`\`bash
# Verificar query de porcentagem de memoria
curl -s 'http://localhost:9090/api/v1/query?query=(1-(node_memory_MemAvailable_bytes/node_memory_MemTotal_bytes))*100' | jq '.data.result[0].value[1]'
# Saida esperada: numero entre 0 e 100 (porcentagem de memoria em uso)

# Verificar query de disco
curl -s 'http://localhost:9090/api/v1/query?query=(1-(node_filesystem_avail_bytes{mountpoint="/"}/node_filesystem_size_bytes{mountpoint="/"}))*100' | jq '.data.result[0].value[1]'
# Saida esperada: numero entre 0 e 100 (porcentagem de disco em uso)
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Query retorna "no data" mesmo com metricas existentes',
      difficulty: 'easy',
      symptom: 'Voce digita uma query PromQL no Prometheus mas o resultado e vazio, mesmo sabendo que a metrica existe.',
      diagnosis: `\`\`\`bash
# Verificar se a metrica existe
curl -s 'http://localhost:9090/api/v1/label/__name__/values' | jq '.data[]' | grep "nome_da_metrica"

# Verificar labels disponiveis para a metrica
curl -s 'http://localhost:9090/api/v1/series?match[]=nome_da_metrica' | jq '.data[0]'

# Verificar se os targets estao UP
curl -s 'http://localhost:9090/api/v1/targets' | jq '.data.activeTargets[] | {job: .labels.job, health: .health}'
\`\`\``,
      solution: `**Causas comuns:**
1. **Typo no nome da metrica**: Prometheus e case-sensitive. Use o autocomplete.
2. **Label matcher errado**: Verifique os valores exatos das labels com a query sem filtros primeiro.
3. **Intervalo do range vector**: Se rate(x[10s]) e o scrape_interval e 30s, nao ha pontos suficientes.
4. **Target DOWN**: A metrica pode existir no catalog mas o target nao esta sendo scrapeado.
5. **Metrica descontinuada**: Metricas expiram do TSDB apos o retention period (padrao: 15 dias).

**Solucao passo a passo:**
\`\`\`promql
# 1. Consultar sem label matchers
http_requests_total

# 2. Se retornar dados, adicionar labels uma a uma
http_requests_total{job="myapp"}

# 3. Se usando rate(), aumentar o intervalo
rate(http_requests_total[5m])  # em vez de [30s]
\`\`\``
    },
    {
      title: 'Graficos com gaps ou picos irreais apos restart de pod',
      difficulty: 'medium',
      symptom: 'Apos o restart de um pod, o grafico de rate() mostra um pico enorme ou gaps nos dados. O counter voltou a zero.',
      diagnosis: `\`\`\`promql
# Ver o valor bruto do counter (deve mostrar reset)
http_requests_total{pod="myapp-xyz"}

# Comparar rate com e sem o intervalo do reset
rate(http_requests_total{pod="myapp-xyz"}[5m])
rate(http_requests_total{pod="myapp-xyz"}[15m])
\`\`\``,
      solution: `**Explicacao:** Quando um pod reinicia, o counter volta a zero. O Prometheus detecta resets de counters automaticamente no rate(), mas:

1. **Gaps**: O periodo entre o ultimo scrape antes do restart e o primeiro apos pode criar gaps.
2. **Picos**: Se o pod muda de nome (novo ReplicaSet), o Prometheus ve como uma serie NOVA, nao como reset.

**Solucoes:**
\`\`\`promql
# Usar sum para agregar todas as replicas (ignora pod individual)
sum by(service) (rate(http_requests_total[5m]))

# Usar intervalo maior para suavizar gaps
rate(http_requests_total[10m])

# Agregar sem a label de pod
sum without(pod, instance) (rate(http_requests_total[5m]))
\`\`\`

**Prevencao:**
- Agregue por service/deployment, nao por pod individual
- Use recording rules para pre-calcular agregacoes`
    },
    {
      title: 'Resultado inesperado ao combinar metricas de fontes diferentes',
      difficulty: 'hard',
      symptom: 'Ao dividir ou multiplicar metricas de jobs diferentes, o resultado e vazio ou contem series duplicadas. Exemplo: dividir requests por capacity retorna "no data".',
      diagnosis: `\`\`\`promql
# Verificar labels de cada metrica
http_requests_total{job="app"}
# Labels: {job="app", instance="10.0.1.5:8080", method="GET", ...}

container_memory_limit_bytes{container="app"}
# Labels: {job="kubelet", instance="node1", namespace="default", pod="app-xyz", ...}

# Tentar a divisao — provavelmente retorna vazio
http_requests_total / container_memory_limit_bytes
\`\`\``,
      solution: `**Explicacao:** PromQL faz **vector matching** baseado nas labels. Para operacoes binarias, TODAS as labels devem coincidir entre os dois lados. Se as metricas vem de jobs diferentes, as labels sao diferentes e nao ha match.

**Solucoes:**

1. **Usar on() para especificar labels de match:**
\`\`\`promql
# Matching explicito por label comum
rate(http_requests_total[5m]) / on(instance) group_left container_memory_limit_bytes
\`\`\`

2. **Agregar para labels comuns antes da operacao:**
\`\`\`promql
# Agregar ambos por namespace
sum by(namespace) (rate(http_requests_total[5m]))
/
sum by(namespace) (container_memory_limit_bytes{container!=""})
\`\`\`

3. **Usar label_replace() para alinhar labels:**
\`\`\`promql
# Se a label tem nome diferente mas valor igual
label_replace(metric_a, "instance", "$1", "node", "(.*)")
\`\`\`

> Este conceito de vector matching e aprofundado no topico promql-advanced.`
    }
  ]
};
