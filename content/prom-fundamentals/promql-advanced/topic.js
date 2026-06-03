window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['prom-fundamentals/promql-advanced'] = {
  theory: `
# PromQL Avancado

## Relevancia
Apos dominar os fundamentos de PromQL, o proximo passo e aprender tecnicas avancadas como vector matching, subqueries, funcoes de histograma e recording rules. Esses conceitos sao essenciais para dashboards complexos, alertas precisos e otimizacao de performance do Prometheus.

## Conceitos Fundamentais

### Vector Matching — Operacoes entre Metricas

Quando voce faz operacoes binarias entre dois vetores (ex: A / B), o Prometheus precisa saber como parear as series temporais. Isso e feito pelo **vector matching**.

#### One-to-One Matching
Por padrao, o Prometheus pareia series que tenham **exatamente as mesmas labels**:
\`\`\`promql
# Funciona se ambos tiverem as mesmas labels
http_requests_total{method="GET"} / http_responses_total{method="GET"}
\`\`\`

#### Usando on() e ignoring()
\`\`\`promql
# Parear apenas pela label "method" (ignorar outras)
http_requests_total / on(method) http_responses_total

# Parear ignorando a label "instance"
http_requests_total / ignoring(instance) http_responses_total
\`\`\`

#### Many-to-One e One-to-Many (group_left / group_right)
Quando um lado tem mais series que o outro:
\`\`\`promql
# Muitas series de requests, uma serie de capacity por job
rate(http_requests_total[5m]) / on(job) group_left http_capacity

# group_left: o lado ESQUERDO tem mais series (many-to-one)
# group_right: o lado DIREITO tem mais series (one-to-many)
\`\`\`

\`\`\`promql
# Exemplo pratico: adicionar info de node aos pods
container_memory_usage_bytes
  * on(node) group_left(role)
  kube_node_labels{label_role="worker"}
\`\`\`

### Subqueries

Subqueries permitem aplicar funcoes de instant vector sobre range vectors criados dinamicamente:

\`\`\`promql
# Sintaxe: <instant_query>[<range>:<resolution>]

# Media da taxa de requests nos ultimos 30 minutos, calculada a cada 5 minutos
avg_over_time(rate(http_requests_total[5m])[30m:5m])

# Maximo de CPU nos ultimos 60 minutos, resolucao de 1 minuto
max_over_time(
  (1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])))[60m:1m]
)
\`\`\`

> **Atencao:** Subqueries sao computacionalmente caras. Use recording rules para queries frequentes.

### Funcoes _over_time

Aplicam agregacoes sobre um range vector:

| Funcao | Descricao |
|--------|-----------|
| \`avg_over_time(v[range])\` | Media dos valores no intervalo |
| \`min_over_time(v[range])\` | Menor valor no intervalo |
| \`max_over_time(v[range])\` | Maior valor no intervalo |
| \`sum_over_time(v[range])\` | Soma dos valores no intervalo |
| \`count_over_time(v[range])\` | Contagem de amostras no intervalo |
| \`quantile_over_time(q, v[range])\` | Quantil q dos valores |
| \`stddev_over_time(v[range])\` | Desvio padrao no intervalo |
| \`last_over_time(v[range])\` | Ultimo valor no intervalo |

\`\`\`promql
# Media de memoria dos ultimos 30 minutos
avg_over_time(container_memory_usage_bytes[30m])

# Pico de CPU na ultima hora
max_over_time(node_cpu_seconds_total{mode="idle"}[1h])

# P95 de latencia nos ultimos 10 minutos
quantile_over_time(0.95, http_request_duration_seconds[10m])
\`\`\`

### Histogramas e histogram_quantile()

Histogramas no Prometheus armazenam contagens em **buckets** cumulativos:

\`\`\`promql
# Metricas geradas por um histograma:
http_request_duration_seconds_bucket{le="0.1"}    # requests <= 100ms
http_request_duration_seconds_bucket{le="0.5"}    # requests <= 500ms
http_request_duration_seconds_bucket{le="1.0"}    # requests <= 1s
http_request_duration_seconds_bucket{le="+Inf"}   # todos os requests
http_request_duration_seconds_sum                   # soma total de duracoes
http_request_duration_seconds_count                 # contagem total
\`\`\`

#### Calculando Percentis com histogram_quantile()
\`\`\`promql
# P99 de latencia
histogram_quantile(0.99,
  rate(http_request_duration_seconds_bucket[5m])
)

# P50 (mediana) por servico
histogram_quantile(0.50,
  sum by(service, le) (rate(http_request_duration_seconds_bucket[5m]))
)

# P95 global
histogram_quantile(0.95,
  sum by(le) (rate(http_request_duration_seconds_bucket[5m]))
)
\`\`\`

> **Importante:** Sempre aplique \`rate()\` nos buckets ANTES de \`histogram_quantile()\`. A label \`le\` deve ser preservada no \`sum by()\`.

#### Latencia Media
\`\`\`promql
# Media = soma / contagem
rate(http_request_duration_seconds_sum[5m])
/
rate(http_request_duration_seconds_count[5m])
\`\`\`

### Recording Rules

Recording rules pre-calculam queries caras e salvam como novas metricas:

\`\`\`yaml
# prometheus-rules.yml
groups:
  - name: custom_rules
    interval: 30s
    rules:
      - record: job:http_requests:rate5m
        expr: sum by(job) (rate(http_requests_total[5m]))

      - record: instance:node_cpu:usage_percent
        expr: (1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100

      - record: namespace:container_memory:sum_bytes
        expr: sum by(namespace) (container_memory_usage_bytes{container!=""})
\`\`\`

**Convencao de nomes:** \`level:metrica:operacao\`
- \`job:http_requests:rate5m\` — agrupado por job, metrica http_requests, operacao rate5m
- \`instance:node_cpu:usage_percent\` — por instance, cpu, porcentagem de uso

### Funcoes de Label

\`\`\`promql
# label_replace — criar/modificar labels
label_replace(up, "hostname", "$1", "instance", "(.*):.*")
# Extrai "hostname" de "instance" removendo a porta

# label_join — concatenar labels
label_join(up, "target_info", "-", "job", "instance")
# Cria label "target_info" = "job-instance"
\`\`\`

### Funcoes Matematicas e de Tempo

\`\`\`promql
# Arredondar para cima
ceil(container_memory_usage_bytes / 1048576)  # MB arredondado

# Arredondar para baixo
floor(node_filesystem_avail_bytes / 1073741824)  # GB

# Valor absoluto
abs(deriv(temperature_celsius[1h]))

# Clamp — limitar entre min e max
clamp(cpu_usage_percent, 0, 100)
clamp_min(metric, 0)   # nao permite negativos
clamp_max(metric, 100)  # limita a 100

# Timestamp da ultima amostra
timestamp(up)

# Derivada (taxa de mudanca de um gauge)
deriv(temperature_celsius[1h])

# Previsao linear (predict_linear)
predict_linear(node_filesystem_avail_bytes[6h], 3600*24)
# Prevê o valor daqui a 24 horas baseado na tendencia das ultimas 6 horas
\`\`\`

### predict_linear() para Capacity Planning

\`\`\`promql
# Prever quando o disco vai encher
# Se predict_linear retornar valor negativo, o disco vai encher antes de 24h
predict_linear(node_filesystem_avail_bytes{mountpoint="/"}[6h], 3600*24) < 0

# Prever memoria disponivel em 4 horas
predict_linear(node_memory_MemAvailable_bytes[2h], 3600*4)
\`\`\`

## Erros Comuns

1. **Esquecer \`le\` no sum para histogram_quantile()**: \`sum by(service) (rate(bucket[5m]))\` perde a label \`le\` e a funcao falha. Correto: \`sum by(service, le)\`.
2. **Nao aplicar rate() antes de histogram_quantile()**: Os buckets sao counters cumulativos — sem rate(), os valores nao fazem sentido para percentil.
3. **Usar subqueries sem necessidade**: Subqueries sao caras. Se possivel, crie recording rules.
4. **Confundir group_left e group_right**: \`group_left\` significa que o lado esquerdo (many) pode ter mais series. O lado oposto (one) deve ter no maximo uma serie por combinacao de labels.
5. **predict_linear com range muito curto**: Se a tendencia e avaliada em poucos minutos, a previsao e instavel. Use pelo menos 1-6 horas.
6. **Recording rules com nomes fora do padrao**: Use a convencao \`level:metrica:operacao\` para manter organizacao.

## Killer.sh Style Challenge

**Cenario:** Seu cluster tem alto trafego e voce precisa analisar padroes de latencia e prever problemas de capacidade.

**Tarefas:**
1. Calcule o P99 de latencia HTTP por servico nos ultimos 5 minutos
2. Crie uma query que preve se o disco de qualquer node vai encher nas proximas 24 horas
3. Compare a taxa de requests atual com a media das ultimas 3 horas
4. Escreva uma recording rule para pre-calcular o uso de CPU por node

**Solucoes:**
\`\`\`promql
# 1. P99 por servico
histogram_quantile(0.99,
  sum by(service, le) (rate(http_request_duration_seconds_bucket[5m]))
)

# 2. Previsao de disco (alerta se negativo = vai encher)
predict_linear(node_filesystem_avail_bytes{mountpoint="/"}[6h], 86400) < 0

# 3. Requests atuais vs media de 3 horas
sum(rate(http_requests_total[5m]))
/
avg_over_time(sum(rate(http_requests_total[5m]))[3h:5m])

# 4. Recording rule
# record: instance:node_cpu:usage_percent
# expr: (1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100
\`\`\`
`,
  quiz: [
    {
      question: 'No PromQL, o que faz a clausula group_left em uma operacao binaria?',
      options: [
        'Agrupa os resultados pelo lado esquerdo',
        'Indica que o lado esquerdo (many) pode ter mais series que o direito (one) — many-to-one matching',
        'Filtra apenas as series do operando esquerdo',
        'Realiza um LEFT JOIN como em SQL'
      ],
      correct: 1,
      explanation: 'group_left indica many-to-one matching: o lado esquerdo pode ter multiplas series para cada serie do lado direito. E util quando voce quer enriquecer metricas com metadata (ex: adicionar labels de info a metricas de uso).',
      reference: 'Conceito relacionado: promql-basics — entenda operacoes binarias basicas antes de vector matching avancado.'
    },
    {
      question: 'Qual e a forma correta de calcular o P95 de latencia usando histogram_quantile()?',
      options: [
        'histogram_quantile(0.95, http_request_duration_seconds_bucket)',
        'histogram_quantile(0.95, sum by(le) (rate(http_request_duration_seconds_bucket[5m])))',
        'histogram_quantile(95, rate(http_request_duration_seconds_bucket[5m]))',
        'quantile(0.95, http_request_duration_seconds)'
      ],
      correct: 1,
      explanation: 'A forma correta requer: (1) rate() aplicado nos buckets, (2) sum by(le) para preservar a label le (essencial para o calculo), e (3) quantil entre 0 e 1 (0.95, nao 95).',
      reference: 'Conceito relacionado: prom-alerting — use percentis em alertas de latencia (SLO/SLI).'
    },
    {
      question: 'O que faz a funcao predict_linear()?',
      options: [
        'Calcula a media linear de uma metrica',
        'Preve o valor futuro de um gauge baseado na tendencia de um periodo',
        'Cria uma linha de tendencia no grafico',
        'Interpola valores ausentes em uma serie temporal'
      ],
      correct: 1,
      explanation: 'predict_linear(v[range], t) usa regressao linear sobre os dados do range para prever qual sera o valor da metrica daqui a t segundos. E muito usada para capacity planning (ex: prever quando o disco vai encher).',
      reference: 'Conceito relacionado: prom-alerting — predict_linear e ideal para alertas proativos de capacidade.'
    },
    {
      question: 'Qual e a convencao de nomes para recording rules no Prometheus?',
      options: [
        'metrica_operacao_intervalo (ex: http_requests_rate_5m)',
        'level:metrica:operacao (ex: job:http_requests:rate5m)',
        'nome_livre_escolhido_pelo_usuario',
        'recording_rule_nome_da_query'
      ],
      correct: 1,
      explanation: 'A convencao oficial e level:metrica:operacao. O level indica o nivel de agregacao (job, instance, namespace), a metrica indica o nome original, e a operacao descreve o calculo (rate5m, sum, avg).',
      reference: 'Conceito relacionado: prom-alerting — recording rules tambem sao usadas para simplificar expressoes em alerting rules.'
    },
    {
      question: 'Qual a sintaxe de uma subquery em PromQL?',
      options: [
        'SELECT(query, range, resolution)',
        'subquery(query[range:resolution])',
        'query[range:resolution]',
        'query OVER(range STEP resolution)'
      ],
      correct: 2,
      explanation: 'A sintaxe de subquery e: <instant_query>[<range>:<resolution>]. Exemplo: rate(http_requests_total[5m])[30m:1m] avalia rate() a cada 1 minuto ao longo dos ultimos 30 minutos, criando um range vector.',
      reference: 'Conceito relacionado: prom-alerting — subqueries podem ser uteis em alertas complexos, mas prefira recording rules por performance.'
    },
    {
      question: 'Qual a diferenca entre on() e ignoring() em vector matching?',
      options: [
        'on() e mais rapido que ignoring()',
        'on() especifica quais labels usar no match, ignoring() especifica quais labels ignorar no match',
        'on() funciona com sum, ignoring() funciona com rate',
        'Nao ha diferenca, sao sinonimos'
      ],
      correct: 1,
      explanation: 'on(labels) especifica explicitamente quais labels devem ser usadas para parear as series (ignora todas as outras). ignoring(labels) faz o oposto: usa todas as labels EXCETO as especificadas. Sao analogos a by/without em agregacoes.',
      reference: 'Conceito relacionado: promql-basics — by/without em agregacoes tem a mesma logica.'
    },
    {
      question: 'Por que e importante aplicar rate() nos buckets ANTES de histogram_quantile()?',
      options: [
        'Porque histogram_quantile() so aceita instant vectors',
        'Porque os buckets sao counters cumulativos — rate() converte para taxa, permitindo calculo correto de percentil',
        'Porque sem rate() o resultado e em bytes em vez de segundos',
        'rate() nao e necessario, e apenas uma boa pratica'
      ],
      correct: 1,
      explanation: 'Os buckets de histograma sao counters cumulativos (so crescem). Sem rate(), histogram_quantile() calcularia o percentil do total acumulado desde o inicio, nao do periodo recente. rate() transforma os contadores em taxas por segundo, permitindo calcular o percentil real do intervalo.',
      reference: 'Conceito relacionado: prom-architecture — tipos de metricas e como counters funcionam.'
    },
    {
      question: 'Qual funcao _over_time voce usaria para encontrar o pico de uso de memoria nos ultimos 30 minutos?',
      options: [
        'avg_over_time(memory[30m])',
        'sum_over_time(memory[30m])',
        'max_over_time(memory[30m])',
        'peak_over_time(memory[30m])'
      ],
      correct: 2,
      explanation: 'max_over_time(v[range]) retorna o maior valor de cada serie temporal dentro do intervalo especificado. E ideal para encontrar picos de uso. avg_over_time daria a media, sum_over_time a soma, e peak_over_time nao existe.',
      reference: 'Conceito relacionado: grafana-dashboards — use max_over_time em paineis de capacidade para mostrar picos.'
    }
  ],
  flashcards: [
    {
      front: 'O que e vector matching em PromQL e quais os tipos?',
      back: '**Vector matching** e como o Prometheus pareia series temporais em operacoes binarias (A op B).\n\nTipos:\n- **One-to-One**: cada serie de A pareia com exatamente uma de B (labels devem coincidir)\n- **Many-to-One** (group_left): multiplas series de A pareiam com uma de B\n- **One-to-Many** (group_right): uma serie de A pareia com multiplas de B\n\nModificadores: on(labels) ou ignoring(labels)'
    },
    {
      front: 'Qual a sintaxe de subqueries e quando usar?',
      back: '**Sintaxe:** instant_query[range:resolution]\n\nExemplo: avg_over_time(rate(x[5m])[1h:5m])\n- Avalia rate(x[5m]) a cada 5 minutos\n- Nos ultimos 60 minutos\n- Aplica avg_over_time no resultado\n\n**Quando usar:** Quando precisa aplicar funcoes _over_time em resultados de funcoes que retornam instant vectors.\n\n**Cuidado:** Subqueries sao caras — prefira recording rules para queries frequentes.'
    },
    {
      front: 'Como calcular percentis com histogram_quantile()?',
      back: 'Passos obrigatorios:\n1. Aplicar **rate()** nos buckets (sao counters)\n2. **Preservar a label le** no sum by()\n3. Usar quantil entre 0 e 1\n\n```promql\nhistogram_quantile(0.99,\n  sum by(service, le) (\n    rate(http_request_duration_seconds_bucket[5m])\n  )\n)\n```\n\nPara latencia media: rate(_sum[5m]) / rate(_count[5m])'
    },
    {
      front: 'Qual a convencao de nomes para recording rules?',
      back: 'Padrao: **level:metrica:operacao**\n\nExemplos:\n- job:http_requests:rate5m\n- instance:node_cpu:usage_percent\n- namespace:container_memory:sum_bytes\n\nO **level** indica agregacao (job, instance, namespace)\nA **metrica** indica o nome original\nA **operacao** descreve o calculo aplicado\n\nRecording rules sao definidas em arquivos YAML separados e avaliadas periodicamente.'
    },
    {
      front: 'Para que serve predict_linear()?',
      back: '**predict_linear(v[range], t)** usa regressao linear para prever o valor futuro de um gauge.\n\nExemplos:\n```promql\n# Disco vai encher em 24h?\npredict_linear(node_filesystem_avail_bytes[6h], 86400) < 0\n\n# Quanta memoria em 4h?\npredict_linear(node_memory_MemAvailable_bytes[2h], 14400)\n```\n\nRegras:\n- So funciona com gauges\n- Use range de 1-6h para tendencia estavel\n- Ideal para alertas proativos de capacidade'
    },
    {
      front: 'Quais sao as funcoes _over_time mais importantes?',
      back: '- **avg_over_time(v[r])** — media\n- **max_over_time(v[r])** — pico\n- **min_over_time(v[r])** — minimo\n- **sum_over_time(v[r])** — soma\n- **count_over_time(v[r])** — contagem de amostras\n- **quantile_over_time(q, v[r])** — percentil\n- **stddev_over_time(v[r])** — desvio padrao\n- **last_over_time(v[r])** — ultimo valor\n\nTodas recebem range vectors de gauges (exceto count_over_time que funciona com qualquer tipo).'
    },
    {
      front: 'Qual a diferenca entre on() e ignoring() em operacoes binarias?',
      back: '**on(labels)** — usa APENAS as labels listadas para parear series\n**ignoring(labels)** — usa TODAS as labels EXCETO as listadas\n\nSao analogos a by/without em agregacoes:\n- on() = by() (especifica o que incluir)\n- ignoring() = without() (especifica o que excluir)\n\nExemplo:\n```promql\nmetric_a / on(job) group_left metric_b\n# Pareia apenas por "job", permite muitas series em A\n```'
    },
    {
      front: 'Como funciona label_replace() em PromQL?',
      back: '**label_replace(v, dst_label, replacement, src_label, regex)**\n\nCria ou modifica labels baseado em regex:\n\n```promql\n# Extrair hostname (sem porta) de instance\nlabel_replace(up, "hostname", "$1", "instance", "(.*):.*")\n# instance="10.0.1.5:9090" → hostname="10.0.1.5"\n\n# Copiar label\nlabel_replace(metric, "env", "$1", "namespace", "(.*)")\n```\n\nUtil para alinhar labels de metricas de fontes diferentes antes de operacoes binarias.'
    }
  ],
  lab: {
    scenario: 'Voce gerencia um cluster com alto trafego HTTP e precisa construir queries avancadas para analise de performance, capacity planning e troubleshooting. O cluster possui Prometheus com histogramas de latencia, metricas de node_exporter e kube-state-metrics.',
    objective: 'Dominar vector matching, histogram_quantile(), subqueries, predict_linear() e recording rules. Ao final, voce tera queries prontas para dashboards avancados e alertas proativos.',
    duration: '25-35 minutos',
    steps: [
      {
        title: 'Vector Matching e Enrichment de Metricas',
        instruction: `Pratique operacoes binarias entre metricas de fontes diferentes usando on() e group_left.

\`\`\`promql
# Cenario: enriquecer metricas de CPU com info de node
# Primeiro, veja as labels de cada metrica
node_cpu_seconds_total{mode="idle"}
kube_node_info

# Agora combine usando on() e group_left
avg by(node) (rate(node_cpu_seconds_total{mode="idle"}[5m]))
  * on(node) group_left(kernel_version)
  kube_node_info

# Calcular porcentagem de CPU usada por node com info de role
(1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100
\`\`\`

Experimente diferentes combinacoes de on() e ignoring().`,
        hints: [
          'Se kube_node_info nao esta disponivel, use qualquer par de metricas que compartilhe pelo menos uma label',
          'group_left permite copiar labels extras do lado "one" (direito)',
          'Verifique as labels de ambas as metricas separadamente antes de combinar'
        ],
        solution: `\`\`\`promql
# Se nao tiver kube_node_info, faca vector matching com metricas de node
# CPU total por instance
sum by(instance) (rate(node_cpu_seconds_total{mode!="idle"}[5m]))
/
count by(instance) (node_cpu_seconds_total{mode="idle"})

# Usar ignoring para ignorar labels que nao coincidem
sum by(instance) (rate(node_network_receive_bytes_total[5m]))
/ ignoring(device)
sum by(instance) (rate(node_network_transmit_bytes_total[5m]))
\`\`\``,
        verify: `\`\`\`bash
# Verificar que a query com operacao binaria retorna resultados
curl -s 'http://localhost:9090/api/v1/query?query=sum%20by(instance)(rate(node_cpu_seconds_total{mode!=%22idle%22}[5m]))' | jq '.data.result | length'
# Saida esperada: numero > 0

# Verificar que vector matching funciona
curl -s 'http://localhost:9090/api/v1/query?query=count(up%20*%20on(instance)%20group_left%20up)' | jq '.data.result | length'
# Saida esperada: numero > 0
\`\`\``
      },
      {
        title: 'Histogramas e Percentis de Latencia',
        instruction: `Calcule percentis de latencia usando histogram_quantile() com buckets de histograma.

\`\`\`promql
# Verificar se ha metricas de histograma
{__name__=~".*_bucket"}

# P50, P90, P99 de latencia global
histogram_quantile(0.50, sum by(le) (rate(http_request_duration_seconds_bucket[5m])))
histogram_quantile(0.90, sum by(le) (rate(http_request_duration_seconds_bucket[5m])))
histogram_quantile(0.99, sum by(le) (rate(http_request_duration_seconds_bucket[5m])))

# P95 por servico (preservando label service E le)
histogram_quantile(0.95,
  sum by(service, le) (rate(http_request_duration_seconds_bucket[5m]))
)

# Latencia media
rate(http_request_duration_seconds_sum[5m])
/
rate(http_request_duration_seconds_count[5m])
\`\`\`

Compare a latencia media com o P99 — a diferenca mostra a presenca de outliers.`,
        hints: [
          'Se nao tiver metricas HTTP, procure qualquer metrica com sufixo _bucket',
          'prometheus_http_request_duration_seconds_bucket e uma metrica do proprio Prometheus',
          'Sempre inclua "le" no sum by() ao usar histogram_quantile()'
        ],
        solution: `\`\`\`promql
# Usar metricas do proprio Prometheus se nao tiver app metricas
histogram_quantile(0.99,
  sum by(le) (rate(prometheus_http_request_duration_seconds_bucket[5m]))
)

# Latencia media do Prometheus
rate(prometheus_http_request_duration_seconds_sum[5m])
/
rate(prometheus_http_request_duration_seconds_count[5m])

# Comparar P50 vs P99
histogram_quantile(0.50, sum by(le) (rate(prometheus_http_request_duration_seconds_bucket[5m])))
histogram_quantile(0.99, sum by(le) (rate(prometheus_http_request_duration_seconds_bucket[5m])))
\`\`\``,
        verify: `\`\`\`bash
# Verificar que existem metricas de bucket
curl -s 'http://localhost:9090/api/v1/query?query=count({__name__=~".*_bucket"})' | jq '.data.result[0].value[1]'
# Saida esperada: numero > 0

# Verificar histogram_quantile retorna resultado
curl -s 'http://localhost:9090/api/v1/query?query=histogram_quantile(0.99,sum%20by(le)(rate(prometheus_http_request_duration_seconds_bucket[5m])))' | jq '.data.result | length'
# Saida esperada: numero > 0
\`\`\``
      },
      {
        title: 'Subqueries e Funcoes _over_time',
        instruction: `Pratique subqueries para analisar tendencias e variacoes ao longo do tempo.

\`\`\`promql
# Media de CPU ao longo de 1 hora, avaliada a cada 5 minutos
avg_over_time(
  (1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])))[1h:5m]
)

# Pico de uso de memoria nos ultimos 30 minutos
max_over_time(container_memory_usage_bytes{container!=""}[30m])

# Desvio padrao de CPU (alta variabilidade = problemas potenciais)
stddev_over_time(
  (avg by(instance) (rate(node_cpu_seconds_total{mode!="idle"}[5m])))[1h:5m]
)

# Contar quantas amostras existem para uma metrica (diagnostico)
count_over_time(up[1h])
\`\`\``,
        hints: [
          'Subqueries usam a sintaxe [range:step] apos a query interna',
          'Se a subquery e lenta, considere criar uma recording rule',
          'stddev_over_time alta indica metrica instavel'
        ],
        solution: `\`\`\`promql
# Media de CPU na ultima hora
avg_over_time(
  (1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])))[1h:5m]
) * 100

# Pico vs media de memoria (indica spikes)
max_over_time(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes[1h])
/
avg_over_time(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes[1h])

# Amostras por hora — diagnostico de scrape
count_over_time(up{job="kubernetes-nodes"}[1h])
\`\`\``,
        verify: `\`\`\`bash
# Verificar que subquery funciona
curl -s 'http://localhost:9090/api/v1/query?query=avg_over_time(up[1h:5m])' | jq '.data.result | length'
# Saida esperada: numero > 0

# Verificar contagem de amostras (espera-se ~240 para scrape_interval=15s em 1h)
curl -s 'http://localhost:9090/api/v1/query?query=count_over_time(up[1h])' | jq '.data.result[0].value[1]'
# Saida esperada: numero > 100
\`\`\``
      },
      {
        title: 'Capacity Planning com predict_linear()',
        instruction: `Use predict_linear() para prever problemas de capacidade antes que acontecam.

\`\`\`promql
# Prever espaco em disco daqui a 24 horas
predict_linear(node_filesystem_avail_bytes{mountpoint="/"}[6h], 86400)

# Disco vai encher em 24h? (valor negativo = sim)
predict_linear(node_filesystem_avail_bytes{mountpoint="/"}[6h], 86400) < 0

# Converter para GB para facilitar leitura
predict_linear(node_filesystem_avail_bytes{mountpoint="/"}[6h], 86400) / 1024 / 1024 / 1024

# Prever memoria disponivel em 4 horas
predict_linear(node_memory_MemAvailable_bytes[2h], 14400) / 1024 / 1024 / 1024

# Comparar predict_linear com valor atual
node_filesystem_avail_bytes{mountpoint="/"} / 1024/1024/1024
predict_linear(node_filesystem_avail_bytes{mountpoint="/"}[6h], 86400) / 1024/1024/1024
\`\`\``,
        hints: [
          'predict_linear so funciona com gauges (nao counters)',
          'Use range de pelo menos 1-6h para previsao estavel',
          'Valor negativo na previsao de disco = disco vai encher antes do tempo especificado',
          '86400 = 24 horas em segundos, 14400 = 4 horas'
        ],
        solution: `\`\`\`promql
# Alerta de disco: vai encher em 24h?
predict_linear(node_filesystem_avail_bytes{mountpoint="/", fstype!~"tmpfs|overlay"}[6h], 86400) < 0

# Previsao de disco em GB para cada node
predict_linear(
  node_filesystem_avail_bytes{mountpoint="/", fstype!~"tmpfs|overlay"}[6h],
  86400
) / 1073741824

# Previsao de memoria em GB
predict_linear(node_memory_MemAvailable_bytes[4h], 14400) / 1073741824

# Deriv — ver taxa de mudanca atual
deriv(node_filesystem_avail_bytes{mountpoint="/"}[1h])
\`\`\``,
        verify: `\`\`\`bash
# Verificar predict_linear retorna resultado
curl -s 'http://localhost:9090/api/v1/query?query=predict_linear(node_filesystem_avail_bytes{mountpoint="/"}[6h],86400)/1073741824' | jq '.data.result[0].value[1]'
# Saida esperada: numero (GB previsto de espaco livre em 24h)

# Verificar deriv
curl -s 'http://localhost:9090/api/v1/query?query=deriv(node_memory_MemAvailable_bytes[1h])' | jq '.data.result | length'
# Saida esperada: numero > 0
\`\`\``
      },
      {
        title: 'Recording Rules (Planejamento)',
        instruction: `Planeje recording rules para otimizar as queries mais caras que voce criou nos passos anteriores.

Crie um arquivo de recording rules baseado nas queries que voce executou:

\`\`\`yaml
# /etc/prometheus/rules/recording_rules.yml
groups:
  - name: node_metrics
    interval: 30s
    rules:
      - record: instance:node_cpu:usage_percent
        expr: (1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))) * 100

      - record: instance:node_memory:usage_percent
        expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100

      - record: instance:node_disk:avail_gb
        expr: node_filesystem_avail_bytes{mountpoint="/",fstype!~"tmpfs|overlay"} / 1073741824

  - name: http_metrics
    interval: 30s
    rules:
      - record: job:http_requests:rate5m
        expr: sum by(job) (rate(http_requests_total[5m]))

      - record: job:http_latency:p99_seconds
        expr: histogram_quantile(0.99, sum by(job, le) (rate(http_request_duration_seconds_bucket[5m])))
\`\`\`

Verifique a configuracao do Prometheus para carregar o arquivo de rules.`,
        hints: [
          'Recording rules usam a convencao level:metrica:operacao',
          'O intervalo de avaliacao deve ser menor ou igual ao scrape_interval',
          'Verifique o prometheus.yml para o caminho rule_files',
          'Reinicie ou recarregue o Prometheus apos adicionar rules'
        ],
        solution: `\`\`\`bash
# Verificar configuracao de rule_files no prometheus.yml
grep -A5 "rule_files" /etc/prometheus/prometheus.yml

# Verificar sintaxe do arquivo de rules
promtool check rules /etc/prometheus/rules/recording_rules.yml

# Recarregar Prometheus sem reiniciar
curl -X POST http://localhost:9090/-/reload

# Ou enviar SIGHUP
kill -HUP $(pgrep prometheus)

# Verificar que as rules estao ativas
curl -s http://localhost:9090/api/v1/rules | jq '.data.groups[].rules[] | {name: .name, type: .type}'
\`\`\``,
        verify: `\`\`\`bash
# Verificar que promtool valida as rules
promtool check rules /etc/prometheus/rules/recording_rules.yml
# Saida esperada: SUCCESS

# Verificar rules ativas apos reload
curl -s http://localhost:9090/api/v1/rules | jq '.data.groups | length'
# Saida esperada: numero > 0

# Verificar que a recording rule gera metricas
curl -s 'http://localhost:9090/api/v1/query?query=instance:node_cpu:usage_percent' | jq '.data.result | length'
# Saida esperada: numero > 0 (apos aguardar 1 ciclo de avaliacao)
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'histogram_quantile() retorna NaN ou Inf',
      difficulty: 'medium',
      symptom: 'Ao calcular percentis com histogram_quantile(), o resultado e NaN (Not a Number) ou +Inf.',
      diagnosis: `\`\`\`promql
# Verificar se ha dados nos buckets
rate(http_request_duration_seconds_bucket[5m])

# Verificar se a label "le" esta presente
sum by(le) (rate(http_request_duration_seconds_bucket[5m]))

# Verificar o bucket +Inf
rate(http_request_duration_seconds_bucket{le="+Inf"}[5m])

# Verificar se count > 0
rate(http_request_duration_seconds_count[5m])
\`\`\``,
      solution: `**Causas de NaN:**
1. **Nenhum dado no intervalo**: Se rate() retorna 0 para todos os buckets, nao ha dados para calcular o percentil.
2. **Label le ausente**: Se voce usou \`sum by(service)\` sem incluir \`le\`, a funcao nao consegue calcular.
3. **Buckets nao cumulativos**: histogram_quantile() assume buckets cumulativos (padrao do Prometheus).

**Causas de +Inf:**
1. **Percentil acima do maior bucket**: Se P99 excede o bucket mais alto (ex: le="10"), o resultado e +Inf.
2. **Buckets mal dimensionados**: Os buckets nao cobrem a faixa real de valores.

**Solucoes:**
\`\`\`promql
# Corrigir: incluir le no sum by
histogram_quantile(0.99,
  sum by(service, le) (rate(http_request_duration_seconds_bucket[5m]))
)

# Se +Inf: adicionar buckets maiores na instrumentacao
# No codigo da aplicacao, ajustar os buckets do histograma
\`\`\``
    },
    {
      title: 'Operacao binaria retorna resultado vazio (vector matching falha)',
      difficulty: 'hard',
      symptom: 'Ao dividir ou multiplicar duas metricas, o resultado e vazio mesmo que ambas tenham dados individualmente.',
      diagnosis: `\`\`\`promql
# Passo 1: verificar labels da metrica A
http_requests_total
# {instance="app:8080", job="myapp", method="GET"}

# Passo 2: verificar labels da metrica B
http_capacity_total
# {instance="app:8080", job="capacity"}

# Passo 3: tentar a operacao
http_requests_total / http_capacity_total
# Resultado: vazio (labels "job" e "method" nao coincidem)
\`\`\``,
      solution: `**O problema:** Por padrao, operacoes binarias exigem que TODAS as labels coincidam em ambos os lados. Se uma unica label difere, nao ha match.

**Solucao 1 — Usar on() para match parcial:**
\`\`\`promql
http_requests_total / on(instance) group_left http_capacity_total
# Pareia apenas por "instance", ignora outras labels
\`\`\`

**Solucao 2 — Usar ignoring():**
\`\`\`promql
http_requests_total / ignoring(method, job) http_capacity_total
# Ignora labels que diferem
\`\`\`

**Solucao 3 — Agregar antes:**
\`\`\`promql
sum by(instance) (http_requests_total) / sum by(instance) (http_capacity_total)
# Agrega para labels comuns antes de dividir
\`\`\`

**Dica de diagnostico:** Sempre compare as labels de ambas as metricas lado a lado para identificar diferencas.`
    },
    {
      title: 'Recording rules nao geram metricas',
      difficulty: 'medium',
      symptom: 'Voce criou recording rules no Prometheus, recarregou a configuracao, mas as novas metricas nao aparecem ao consultar.',
      diagnosis: `\`\`\`bash
# Verificar se o Prometheus carregou as rules
curl -s http://localhost:9090/api/v1/rules | jq '.data.groups[] | {name: .name, rules: [.rules[].name]}'

# Verificar logs do Prometheus para erros
kubectl logs -l app=prometheus --tail=50 | grep -i "rule\\|error"

# Validar sintaxe do arquivo
promtool check rules /etc/prometheus/rules/recording_rules.yml

# Verificar se rule_files esta configurado no prometheus.yml
grep "rule_files" /etc/prometheus/prometheus.yml
\`\`\``,
      solution: `**Causas comuns:**

1. **Caminho nao incluido em rule_files:**
\`\`\`yaml
# prometheus.yml — garantir que o path esta correto
rule_files:
  - "/etc/prometheus/rules/*.yml"
\`\`\`

2. **Erro de sintaxe no arquivo de rules:**
\`\`\`bash
# Validar antes de aplicar
promtool check rules /etc/prometheus/rules/recording_rules.yml
\`\`\`

3. **Prometheus nao recarregou:**
\`\`\`bash
# Recarregar via API
curl -X POST http://localhost:9090/-/reload

# Verificar reload bem-sucedido nos logs
kubectl logs -l app=prometheus --tail=10 | grep "Completed loading"
\`\`\`

4. **Expressao da rule retorna vazio:**
\`\`\`promql
# Testar a expressao diretamente na UI do Prometheus
# Se a query base nao retorna dados, a recording rule tambem nao gera metrica
\`\`\`

5. **Aguardar o intervalo de avaliacao:** Apos reload, a rule precisa de pelo menos 1 ciclo (interval) para gerar a primeira metrica.`
    }
  ]
};
