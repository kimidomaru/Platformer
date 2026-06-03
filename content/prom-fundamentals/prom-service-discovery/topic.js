window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['prom-fundamentals/prom-service-discovery'] = {
  theory: `
# Service Discovery no Prometheus

## Relevancia
Em ambientes dinamicos como Kubernetes, pods e services sao criados e destruidos constantemente. Configurar targets manualmente e impraticavel. O service discovery automatico do Prometheus resolve esse problema, descobrindo automaticamente novos targets a serem monitorados.

## Conceitos Fundamentais

### O que e Service Discovery?
Service discovery e o mecanismo pelo qual o Prometheus descobre automaticamente quais targets (endpoints) deve scrapear. Em vez de listar cada IP manualmente, o Prometheus consulta uma fonte de verdade (API do Kubernetes, Consul, DNS, etc.) para obter a lista atualizada de targets.

### Mecanismos de Discovery Suportados

| Mecanismo | Descricao | Uso Principal |
|-----------|-----------|---------------|
| \`kubernetes_sd_configs\` | Descobre pods, services, endpoints, nodes e ingresses no K8s | Clusters Kubernetes |
| \`static_configs\` | Lista fixa de targets | Desenvolvimento, targets externos |
| \`consul_sd_configs\` | Descobre servicos no Consul | Ambientes com Consul |
| \`dns_sd_configs\` | Resolve registros DNS SRV/A | Ambientes com DNS service discovery |
| \`file_sd_configs\` | Le targets de arquivos JSON/YAML | Integracao com ferramentas externas |
| \`ec2_sd_configs\` | Descobre instancias EC2 na AWS | Ambientes AWS |
| \`gce_sd_configs\` | Descobre instancias GCE no GCP | Ambientes GCP |
| \`azure_sd_configs\` | Descobre VMs no Azure | Ambientes Azure |

### Kubernetes Service Discovery

O Prometheus descobre 5 tipos de objetos no Kubernetes:

| Role | O que Descobre | Meta Labels |
|------|---------------|-------------|
| \`node\` | Nodes do cluster | \`__meta_kubernetes_node_name\`, \`__meta_kubernetes_node_label_*\` |
| \`pod\` | Pods individuais | \`__meta_kubernetes_pod_name\`, \`__meta_kubernetes_pod_namespace\`, \`__meta_kubernetes_pod_container_port_number\` |
| \`service\` | Services | \`__meta_kubernetes_service_name\`, \`__meta_kubernetes_service_namespace\` |
| \`endpoints\` | Endpoints de Services | Combina labels de service + pod |
| \`ingress\` | Ingress resources | \`__meta_kubernetes_ingress_name\`, \`__meta_kubernetes_ingress_host\` |

### Configuracao de Service Discovery no Kubernetes

\`\`\`yaml
# prometheus.yml
scrape_configs:
  # Descobrir e scrapear Pods com annotations
  - job_name: 'kubernetes-pods'
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      # Scrapear apenas pods com annotation prometheus.io/scrape=true
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true

      # Usar o path definido na annotation, ou /metrics por padrao
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)

      # Usar a porta definida na annotation
      - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
        action: replace
        regex: ([^:]+)(?::\\d+)?;(\\d+)
        replacement: \$1:\$2
        target_label: __address__

      # Preservar labels uteis
      - source_labels: [__meta_kubernetes_namespace]
        action: replace
        target_label: namespace
      - source_labels: [__meta_kubernetes_pod_name]
        action: replace
        target_label: pod
      - source_labels: [__meta_kubernetes_pod_label_app]
        action: replace
        target_label: app
\`\`\`

### Relabeling — O Motor do Service Discovery

Relabeling e o processo de transformar, filtrar e renomear labels durante o scrape. E o mecanismo mais poderoso do Prometheus para controlar quais targets scrapear e como organizar as metricas.

#### Acoes de Relabel

| Acao | Descricao | Exemplo |
|------|-----------|---------|
| \`keep\` | Manter apenas targets que correspondem ao regex | Filtrar por annotation |
| \`drop\` | Remover targets que correspondem ao regex | Excluir namespaces |
| \`replace\` | Substituir o valor de uma label | Renomear labels |
| \`labelmap\` | Copiar labels que correspondem ao regex | Copiar annotations como labels |
| \`labeldrop\` | Remover labels que correspondem ao regex | Limpar meta labels |
| \`labelkeep\` | Manter apenas labels que correspondem ao regex | Manter labels selecionadas |
| \`hashmod\` | Calcular hash modular da label | Sharding de targets |

#### Exemplos de Relabeling

\`\`\`yaml
relabel_configs:
  # KEEP: scrapear apenas pods com annotation
  - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
    action: keep
    regex: "true"

  # DROP: excluir namespaces de sistema
  - source_labels: [__meta_kubernetes_namespace]
    action: drop
    regex: "kube-system|kube-public"

  # REPLACE: criar label "namespace" a partir de meta label
  - source_labels: [__meta_kubernetes_namespace]
    target_label: namespace

  # LABELMAP: copiar todas as labels do pod para metricas
  - action: labelmap
    regex: __meta_kubernetes_pod_label_(.+)

  # REPLACE com regex: extrair versao da imagem
  - source_labels: [__meta_kubernetes_pod_container_image]
    target_label: image_version
    regex: ".*:(.+)"
    replacement: "\$1"
\`\`\`

### metric_relabel_configs vs relabel_configs

| Aspecto | \`relabel_configs\` | \`metric_relabel_configs\` |
|---------|-------------------|--------------------------|
| **Quando** | Antes do scrape (filtra targets) | Apos o scrape (filtra metricas) |
| **Afeta** | Quais targets sao scrapeados | Quais metricas sao armazenadas |
| **Uso** | Filtrar/organizar targets | Remover metricas desnecessarias |

\`\`\`yaml
scrape_configs:
  - job_name: 'myapp'
    # Antes do scrape — decide QUAIS targets scrapear
    relabel_configs:
      - source_labels: [__meta_kubernetes_namespace]
        action: keep
        regex: "production"

    # Apos o scrape — decide QUAIS metricas guardar
    metric_relabel_configs:
      - source_labels: [__name__]
        action: drop
        regex: "go_.*"  # Remove metricas internas do Go runtime
\`\`\`

### Annotations para Service Discovery

Padrao de annotations usado para autodiscovery de pods:
\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  annotations:
    prometheus.io/scrape: "true"     # Habilita o scrape
    prometheus.io/port: "8080"       # Porta do endpoint /metrics
    prometheus.io/path: "/metrics"   # Path do endpoint (padrao: /metrics)
    prometheus.io/scheme: "https"    # Scheme (padrao: http)
\`\`\`

### ServiceMonitor (Prometheus Operator)

Se voce usa o Prometheus Operator, service discovery e feito via CRDs:
\`\`\`yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: myapp-monitor
  namespace: monitoring
  labels:
    release: prometheus  # Label que o Prometheus Operator monitora
spec:
  selector:
    matchLabels:
      app: myapp
  namespaceSelector:
    matchNames:
      - production
      - staging
  endpoints:
    - port: http-metrics
      path: /metrics
      interval: 30s
      scrapeTimeout: 10s
\`\`\`

### PodMonitor (Prometheus Operator)
\`\`\`yaml
apiVersion: monitoring.coreos.com/v1
kind: PodMonitor
metadata:
  name: myapp-pods
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: myapp
  podMetricsEndpoints:
    - port: metrics
      path: /metrics
      interval: 15s
\`\`\`

## Erros Comuns

1. **Annotation com typo**: \`prometheus.io/scrap: "true"\` (falta o 'e') — o pod nao e descoberto.
2. **Porta errada na annotation**: A porta na annotation deve ser a que expoe /metrics, nao necessariamente a porta do service.
3. **RBAC insuficiente**: O ServiceAccount do Prometheus precisa de permissoes para listar pods, services, endpoints e nodes.
4. **Namespace nao monitorado**: Se o Prometheus Operator so monitora namespaces especificos, namespaces novos nao sao automaticamente incluidos.
5. **relabel_configs na ordem errada**: A ordem das regras importa. Um drop antes de keep pode remover targets que voce quer manter.
6. **Confundir relabel_configs com metric_relabel_configs**: relabel filtra targets, metric_relabel filtra metricas apos o scrape.

## Killer.sh Style Challenge

**Cenario:** Configure service discovery para um cluster Kubernetes com Prometheus.

**Tarefas:**
1. Configure kubernetes_sd_configs para descobrir pods com annotation prometheus.io/scrape=true
2. Use relabel_configs para preservar labels de namespace, pod e app
3. Exclua pods do namespace kube-system do scraping
4. Crie um ServiceMonitor para uma aplicacao no namespace production

**Solucoes:**
\`\`\`yaml
# 1-3. Configuracao completa de pod discovery
- job_name: 'k8s-pods'
  kubernetes_sd_configs:
    - role: pod
  relabel_configs:
    - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
      action: keep
      regex: true
    - source_labels: [__meta_kubernetes_namespace]
      action: drop
      regex: kube-system
    - source_labels: [__meta_kubernetes_namespace]
      target_label: namespace
    - source_labels: [__meta_kubernetes_pod_name]
      target_label: pod
    - source_labels: [__meta_kubernetes_pod_label_app]
      target_label: app

# 4. ServiceMonitor
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: myapp
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: myapp
  namespaceSelector:
    matchNames: [production]
  endpoints:
    - port: metrics
      interval: 30s
\`\`\`
`,
  quiz: [
    {
      question: 'Qual role do kubernetes_sd_configs e usada para descobrir Pods individuais?',
      options: ['node', 'service', 'pod', 'endpoints'],
      correct: 2,
      explanation: 'A role "pod" descobre todos os pods no cluster, expondo meta labels como __meta_kubernetes_pod_name, __meta_kubernetes_pod_namespace, etc. A role "endpoints" tambem pode descobrir pods, mas via endpoints de Services.',
      reference: 'Conceito relacionado: prom-architecture — targets e o modelo de scraping do Prometheus.'
    },
    {
      question: 'Qual a diferenca entre relabel_configs e metric_relabel_configs?',
      options: [
        'Nao ha diferenca, sao sinonimos',
        'relabel_configs atua antes do scrape (filtra targets), metric_relabel_configs atua apos o scrape (filtra metricas)',
        'relabel_configs e para metricas, metric_relabel_configs e para targets',
        'relabel_configs so funciona com Kubernetes, metric_relabel_configs funciona com qualquer SD'
      ],
      correct: 1,
      explanation: 'relabel_configs e aplicado ANTES do scrape — decide quais targets scrapear e como organizar labels de target. metric_relabel_configs e aplicado APOS o scrape — decide quais metricas coletadas serao armazenadas ou descartadas.',
      reference: 'Conceito relacionado: prom-exporters — use metric_relabel_configs para filtrar metricas desnecessarias de exporters.'
    },
    {
      question: 'Qual annotation padrao habilita o scraping automatico de um pod pelo Prometheus?',
      options: [
        'prometheus.io/enabled: "true"',
        'prometheus.io/scrape: "true"',
        'monitoring/scrape: "yes"',
        'prometheus.io/target: "true"'
      ],
      correct: 1,
      explanation: 'A annotation prometheus.io/scrape: "true" e o padrao de facto para indicar que um pod deve ser scrapeado. Outras annotations comuns incluem prometheus.io/port e prometheus.io/path.',
      reference: 'Conceito relacionado: prom-exporters — exporters geralmente ja incluem essas annotations nos manifestos.'
    },
    {
      question: 'O que faz a acao "keep" no relabel_configs?',
      options: [
        'Mantem o valor original da label',
        'Mantem apenas os targets cujo source_label corresponde ao regex, descartando todos os outros',
        'Preserva todas as meta labels apos o scrape',
        'Mantem o target mesmo se o scrape falhar'
      ],
      correct: 1,
      explanation: 'A acao "keep" filtra targets: apenas targets cujo valor de source_labels corresponde ao regex especificado sao mantidos. Todos os outros targets sao descartados e nao serao scrapeados. E o oposto da acao "drop".',
      reference: 'Conceito relacionado: prom-service-discovery — combine keep/drop para controle fino de quais targets monitorar.'
    },
    {
      question: 'Qual CRD do Prometheus Operator e usado para configurar service discovery de um Service?',
      options: [
        'PrometheusRule',
        'ServiceMonitor',
        'ScrapeConfig',
        'TargetGroup'
      ],
      correct: 1,
      explanation: 'ServiceMonitor e o CRD do Prometheus Operator que define como descobrir e scrapear endpoints de um Service Kubernetes. Ele substitui a configuracao manual de scrape_configs no prometheus.yml.',
      reference: 'Conceito relacionado: prom-architecture — o Prometheus Operator gerencia a configuracao do Prometheus via CRDs.'
    },
    {
      question: 'Qual a principal vantagem do service discovery automatico sobre static_configs?',
      options: [
        'E mais rapido',
        'Descobre e adapta automaticamente a targets novos e removidos em ambientes dinamicos',
        'Usa menos memoria',
        'Nao precisa de autenticacao'
      ],
      correct: 1,
      explanation: 'Em ambientes dinamicos como Kubernetes, pods sao criados e destruidos constantemente. Service discovery automatico adapta-se a essas mudancas sem intervenção manual, enquanto static_configs requer atualizacao manual a cada mudanca.',
      reference: 'Conceito relacionado: prom-architecture — o ciclo de scraping do Prometheus depende de uma lista atualizada de targets.'
    },
    {
      question: 'Para que serve a acao "labelmap" no relabel_configs?',
      options: [
        'Cria um mapa de todas as labels',
        'Copia meta labels que correspondem a um regex para labels regulares',
        'Remove todas as labels de um target',
        'Mapeia labels entre metricas diferentes'
      ],
      correct: 1,
      explanation: 'labelmap aplica um regex ao NOME de todas as labels. Labels cujos nomes correspondem sao copiadas, com o nome substituido pelo grupo de captura do regex. Exemplo: __meta_kubernetes_pod_label_app -> app.',
      reference: 'Conceito relacionado: promql-basics — as labels criadas via relabeling estao disponiveis para consulta em PromQL.'
    }
  ],
  flashcards: [
    {
      front: 'Quais sao os 5 tipos de role no kubernetes_sd_configs?',
      back: '1. **node** — descobre nodes do cluster\n2. **pod** — descobre pods individuais\n3. **service** — descobre Services\n4. **endpoints** — descobre endpoints de Services (pods backing)\n5. **ingress** — descobre Ingress resources\n\nCada role expoe meta labels diferentes (ex: __meta_kubernetes_pod_name para role: pod).'
    },
    {
      front: 'Qual a diferenca entre relabel_configs e metric_relabel_configs?',
      back: '**relabel_configs**: aplica ANTES do scrape\n- Decide QUAIS targets scrapear\n- Filtra/organiza labels de discovery\n- Use para: keep/drop targets, renomear labels\n\n**metric_relabel_configs**: aplica APOS o scrape\n- Decide QUAIS metricas armazenar\n- Filtra metricas ja coletadas\n- Use para: remover metricas desnecessarias (go_*, process_*)'
    },
    {
      front: 'Quais sao as 4 annotations padrao para service discovery de pods?',
      back: '```yaml\nprometheus.io/scrape: "true"   # Habilita scraping\nprometheus.io/port: "8080"     # Porta do /metrics\nprometheus.io/path: "/metrics" # Path (padrao: /metrics)\nprometheus.io/scheme: "https"  # Scheme (padrao: http)\n```\n\nEstas annotations sao usadas em relabel_configs para auto-descobrir e configurar o scrape de pods.'
    },
    {
      front: 'Quais sao as acoes de relabeling mais comuns?',
      back: '- **keep**: mantem targets que correspondem ao regex\n- **drop**: remove targets que correspondem ao regex\n- **replace**: substitui valor de uma label (padrao)\n- **labelmap**: copia meta labels via regex no nome\n- **labeldrop**: remove labels pelo nome (regex)\n- **labelkeep**: mantem apenas labels pelo nome\n- **hashmod**: sharding de targets via hash\n\nOrdem importa! Regras sao avaliadas sequencialmente.'
    },
    {
      front: 'O que e um ServiceMonitor e quando usar?',
      back: 'ServiceMonitor e um CRD do **Prometheus Operator** que define como scrapear endpoints de um Service K8s.\n\n```yaml\napiVersion: monitoring.coreos.com/v1\nkind: ServiceMonitor\nspec:\n  selector:\n    matchLabels: { app: myapp }\n  endpoints:\n    - port: metrics\n      interval: 30s\n```\n\n**Quando usar:** Quando o cluster usa Prometheus Operator (kube-prometheus-stack). Substitui configuracao manual em prometheus.yml.\n\nAlternativa: **PodMonitor** para pods sem Service.'
    },
    {
      front: 'Que permissoes RBAC o Prometheus precisa para service discovery no K8s?',
      back: 'O ServiceAccount do Prometheus precisa de:\n\n```yaml\napiGroups: [""]\nresources: [nodes, pods, services, endpoints]\nverbs: [get, list, watch]\n\napiGroups: [networking.k8s.io]\nresources: [ingresses]\nverbs: [get, list, watch]\n```\n\nSem essas permissoes, o service discovery falha silenciosamente e nenhum target e descoberto.'
    },
    {
      front: 'Como funciona file_sd_configs?',
      back: 'file_sd_configs le targets de arquivos JSON ou YAML no disco:\n\n```yaml\nscrape_configs:\n  - job_name: external\n    file_sd_configs:\n      - files: ["/etc/prometheus/targets/*.json"]\n        refresh_interval: 5m\n```\n\nFormato do arquivo:\n```json\n[{"targets": ["host1:9090"], "labels": {"env": "prod"}}]\n```\n\n**Quando usar:** Integrar com ferramentas externas (Ansible, Terraform) que geram listas de targets.'
    }
  ],
  lab: {
    scenario: 'Voce precisa configurar service discovery para um cluster Kubernetes com Prometheus. O cluster tem aplicacoes em multiplos namespaces e voce precisa garantir que todos os pods corretos sejam monitorados automaticamente.',
    objective: 'Configurar kubernetes_sd_configs com relabel_configs para descoberta automatica de pods, configurar annotations para service discovery, e criar ServiceMonitors com o Prometheus Operator.',
    duration: '20-30 minutos',
    steps: [
      {
        title: 'Verificar Targets Atuais e RBAC',
        instruction: `Antes de configurar service discovery, verifique os targets atuais e as permissoes do Prometheus.

\`\`\`bash
# Verificar targets atuais
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, instance: .labels.instance, health: .health}'

# Verificar ServiceAccount do Prometheus
kubectl get sa -n monitoring

# Verificar permissoes RBAC
kubectl auth can-i list pods --as=system:serviceaccount:monitoring:prometheus -n default
kubectl auth can-i list services --as=system:serviceaccount:monitoring:prometheus -n default
kubectl auth can-i list nodes --as=system:serviceaccount:monitoring:prometheus
\`\`\``,
        hints: [
          'Se RBAC esta incorreto, o service discovery falha silenciosamente',
          'O ServiceAccount deve ter permissao de list/watch em pods, services, endpoints e nodes',
          'Verifique o ClusterRole e ClusterRoleBinding do Prometheus'
        ],
        solution: `\`\`\`bash
# Listar targets
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets | length'

# Verificar RBAC
kubectl get clusterrole prometheus -o yaml
kubectl get clusterrolebinding prometheus -o yaml

# Se RBAC nao existe, criar:
kubectl create clusterrole prometheus --verb=get,list,watch --resource=pods,services,endpoints,nodes
kubectl create clusterrolebinding prometheus --clusterrole=prometheus --serviceaccount=monitoring:prometheus
\`\`\``,
        verify: `\`\`\`bash
# Verificar que existem targets ativos
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets | length'
# Saida esperada: numero > 0

# Verificar permissoes
kubectl auth can-i list pods --as=system:serviceaccount:monitoring:prometheus --all-namespaces
# Saida esperada: yes
\`\`\``
      },
      {
        title: 'Configurar Annotations e Testar Discovery',
        instruction: `Crie um pod de teste com annotations de service discovery e verifique que o Prometheus o descobre automaticamente.

\`\`\`yaml
# test-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: metrics-test
  namespace: default
  labels:
    app: metrics-test
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "8080"
    prometheus.io/path: "/metrics"
spec:
  containers:
    - name: app
      image: prom/prometheus:latest
      ports:
        - containerPort: 8080
          name: metrics
\`\`\`

\`\`\`bash
kubectl apply -f test-pod.yaml
\`\`\`

Apos o pod iniciar, verifique se aparece nos targets do Prometheus.`,
        hints: [
          'O Prometheus leva pelo menos 1 scrape_interval para descobrir novos pods',
          'Verifique em Status > Targets na UI do Prometheus',
          'Se o pod nao aparece, verifique os relabel_configs no prometheus.yml'
        ],
        solution: `\`\`\`bash
# Criar pod com annotations
kubectl apply -f test-pod.yaml

# Aguardar pod ficar Running
kubectl wait --for=condition=ready pod/metrics-test --timeout=60s

# Verificar que o Prometheus descobriu o pod (apos ~30s)
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.labels.pod=="metrics-test")'

# Se nao aparecer, verificar discovered targets
curl -s http://localhost:9090/api/v1/targets | jq '.data.droppedTargets[] | select(.discoveredLabels.__meta_kubernetes_pod_name=="metrics-test")'
\`\`\``,
        verify: `\`\`\`bash
# Verificar pod esta running
kubectl get pod metrics-test -o jsonpath='{.status.phase}'
# Saida esperada: Running

# Verificar annotations
kubectl get pod metrics-test -o jsonpath='{.metadata.annotations}'
# Saida esperada: conter prometheus.io/scrape: "true"
\`\`\``
      },
      {
        title: 'Criar ServiceMonitor (Prometheus Operator)',
        instruction: `Se o cluster usa Prometheus Operator, crie um ServiceMonitor para descobrir uma aplicacao.

\`\`\`yaml
# service-monitor.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: myapp-monitor
  namespace: monitoring
  labels:
    release: prometheus  # Label que o Prometheus Operator monitora
spec:
  selector:
    matchLabels:
      app: myapp
  namespaceSelector:
    matchNames:
      - default
      - production
  endpoints:
    - port: http-metrics
      path: /metrics
      interval: 30s
      scrapeTimeout: 10s
\`\`\`

\`\`\`bash
# Aplicar
kubectl apply -f service-monitor.yaml

# Verificar
kubectl get servicemonitor -n monitoring
\`\`\``,
        hints: [
          'A label "release: prometheus" deve corresponder ao que o Prometheus Operator espera',
          'Verifique serviceMonitorSelector no recurso Prometheus do Operator',
          'namespaceSelector define em quais namespaces buscar os Services'
        ],
        solution: `\`\`\`bash
# Verificar se Prometheus Operator esta instalado
kubectl get crd | grep monitoring.coreos.com

# Aplicar ServiceMonitor
kubectl apply -f service-monitor.yaml

# Verificar ServiceMonitor criado
kubectl get servicemonitor -n monitoring myapp-monitor -o yaml

# Verificar qual label o Prometheus Operator espera
kubectl get prometheus -n monitoring -o jsonpath='{.items[0].spec.serviceMonitorSelector}'
\`\`\``,
        verify: `\`\`\`bash
# Verificar que o CRD ServiceMonitor existe
kubectl get crd servicemonitors.monitoring.coreos.com
# Saida esperada: CRD com data de criacao

# Verificar ServiceMonitor
kubectl get servicemonitor -n monitoring
# Saida esperada: myapp-monitor na lista

# Verificar targets no Prometheus (apos ~1 min)
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job | contains("myapp"))'
# Saida esperada: target com job contendo "myapp"
\`\`\``
      },
      {
        title: 'Usar metric_relabel_configs para Filtrar Metricas',
        instruction: `Configure metric_relabel_configs para remover metricas desnecessarias que consomem espaco no TSDB.

\`\`\`yaml
# Adicionar ao scrape_config existente no prometheus.yml
scrape_configs:
  - job_name: 'kubernetes-pods'
    # ... kubernetes_sd_configs e relabel_configs ...

    metric_relabel_configs:
      # Remover metricas internas do Go runtime
      - source_labels: [__name__]
        action: drop
        regex: "go_.*"

      # Remover metricas do process
      - source_labels: [__name__]
        action: drop
        regex: "process_.*"

      # Remover metricas de debug do Prometheus
      - source_labels: [__name__]
        action: drop
        regex: "promhttp_.*"

      # Manter apenas metricas com prefixo da aplicacao
      # - source_labels: [__name__]
      #   action: keep
      #   regex: "myapp_.*|http_.*|node_.*"
\`\`\`

Compare a contagem de metricas antes e depois de aplicar os filtros.`,
        hints: [
          'metric_relabel_configs atua APOS o scrape — as metricas sao coletadas mas nao armazenadas',
          'Use com cuidado: filtrar demais pode remover metricas importantes',
          'Comece com drop de metricas que voce sabe que nao precisa (go_*, process_*)'
        ],
        solution: `\`\`\`bash
# Verificar contagem de metricas antes
curl -s 'http://localhost:9090/api/v1/label/__name__/values' | jq '.data | length'

# Recarregar Prometheus apos adicionar metric_relabel_configs
curl -X POST http://localhost:9090/-/reload

# Verificar contagem apos (deve ser menor)
curl -s 'http://localhost:9090/api/v1/label/__name__/values' | jq '.data | length'

# Verificar que metricas go_* foram removidas
curl -s 'http://localhost:9090/api/v1/label/__name__/values' | jq '[.data[] | select(startswith("go_"))] | length'
\`\`\``,
        verify: `\`\`\`bash
# Verificar que o Prometheus recarregou
curl -s http://localhost:9090/api/v1/status/config | jq '.data.yaml' | grep "metric_relabel"
# Saida esperada: conter metric_relabel_configs

# Verificar que metricas go_ foram removidas (se o filtro foi aplicado)
curl -s 'http://localhost:9090/api/v1/query?query=count({__name__=~"go_.*"})' | jq '.data.result[0].value[1]'
# Saida esperada: 0 (ou ausente, se removidas)
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Targets nao aparecem no Prometheus (service discovery nao funciona)',
      difficulty: 'easy',
      symptom: 'Voce configurou kubernetes_sd_configs mas nenhum target aparece na pagina Status > Targets do Prometheus.',
      diagnosis: `\`\`\`bash
# Verificar RBAC do Prometheus
kubectl auth can-i list pods --as=system:serviceaccount:monitoring:prometheus --all-namespaces
kubectl auth can-i list endpoints --as=system:serviceaccount:monitoring:prometheus --all-namespaces

# Verificar logs do Prometheus
kubectl logs -l app=prometheus -n monitoring --tail=30 | grep -i "error\\|discovery\\|sd"

# Verificar configuracao carregada
curl -s http://localhost:9090/api/v1/status/config | jq '.data.yaml' | head -50
\`\`\``,
      solution: `**Causas comuns:**

1. **RBAC insuficiente:**
\`\`\`bash
# Criar ClusterRole com permissoes necessarias
kubectl apply -f - <<EOF
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: prometheus
rules:
  - apiGroups: [""]
    resources: [nodes, pods, services, endpoints]
    verbs: [get, list, watch]
  - apiGroups: [networking.k8s.io]
    resources: [ingresses]
    verbs: [get, list, watch]
EOF
\`\`\`

2. **kubernetes_sd_configs nao configurado:** Verificar que existe um scrape_config com role: pod (ou outro role).

3. **relabel_configs com "keep" muito restritivo:** Um keep que nao corresponde a nenhum target remove todos.
\`\`\`bash
# Verificar dropped targets (targets descobertos mas removidos por relabel)
curl -s http://localhost:9090/api/v1/targets | jq '.data.droppedTargets | length'
\`\`\``
    },
    {
      title: 'Pod com annotation prometheus.io/scrape mas nao e scrapeado',
      difficulty: 'medium',
      symptom: 'O pod tem a annotation prometheus.io/scrape: "true", mas nao aparece nos targets do Prometheus. Outros pods com a mesma annotation sao scrapeados normalmente.',
      diagnosis: `\`\`\`bash
# Verificar annotations do pod
kubectl get pod <nome> -o jsonpath='{.metadata.annotations}'

# Verificar se o pod aparece nos dropped targets
curl -s http://localhost:9090/api/v1/targets | jq '.data.droppedTargets[] | select(.discoveredLabels.__meta_kubernetes_pod_name=="<nome>")'

# Verificar se o endpoint /metrics responde
kubectl port-forward pod/<nome> 8080:8080 &
curl -s http://localhost:8080/metrics | head -5
\`\`\``,
      solution: `**Causas comuns:**

1. **Annotation como booleano em vez de string:**
\`\`\`yaml
# ERRADO — YAML interpreta como booleano
prometheus.io/scrape: true

# CORRETO — deve ser string
prometheus.io/scrape: "true"
\`\`\`

2. **Porta errada na annotation:**
\`\`\`yaml
# Verificar qual porta expoe /metrics
prometheus.io/port: "8080"  # deve ser a porta do container, nao do service
\`\`\`

3. **Namespace excluido por relabel_configs:**
\`\`\`yaml
# Verificar se ha um drop do namespace
- source_labels: [__meta_kubernetes_namespace]
  action: drop
  regex: "seu-namespace"
\`\`\`

4. **Pod em estado nao-Ready:**
\`\`\`bash
kubectl get pod <nome> -o wide
# Pods nao-Ready podem ser filtrados dependendo da configuracao
\`\`\``
    },
    {
      title: 'ServiceMonitor nao gera targets no Prometheus Operator',
      difficulty: 'hard',
      symptom: 'Voce criou um ServiceMonitor mas ele nao aparece nos targets do Prometheus. O Prometheus Operator esta rodando.',
      diagnosis: `\`\`\`bash
# Verificar o ServiceMonitor
kubectl get servicemonitor -n monitoring
kubectl describe servicemonitor <nome> -n monitoring

# Verificar qual label o Prometheus espera
kubectl get prometheus -n monitoring -o jsonpath='{.items[0].spec.serviceMonitorSelector}'

# Verificar labels do ServiceMonitor
kubectl get servicemonitor <nome> -n monitoring -o jsonpath='{.metadata.labels}'

# Verificar logs do Prometheus Operator
kubectl logs -l app.kubernetes.io/name=prometheus-operator -n monitoring --tail=30
\`\`\``,
      solution: `**Causas comuns:**

1. **Label selector nao corresponde:**
\`\`\`bash
# Verificar qual label o Prometheus Operator espera
kubectl get prometheus -n monitoring -o yaml | grep -A5 serviceMonitorSelector

# Adicionar a label correta ao ServiceMonitor
kubectl label servicemonitor <nome> -n monitoring release=prometheus
\`\`\`

2. **namespaceSelector nao inclui o namespace:**
\`\`\`yaml
# ServiceMonitor precisa de namespaceSelector correto
spec:
  namespaceSelector:
    matchNames: [default]  # ou any: true para todos
\`\`\`

3. **Service nao existe ou labels nao coincidem:**
\`\`\`bash
# Verificar que o Service existe e tem as labels corretas
kubectl get svc -l app=myapp

# Verificar que o Service tem a porta referenciada
kubectl get svc myapp -o jsonpath='{.spec.ports}'
\`\`\`

4. **Prometheus nao tem permissao no namespace:**
\`\`\`bash
# Verificar RBAC
kubectl auth can-i list endpoints --as=system:serviceaccount:monitoring:prometheus -n <namespace>
\`\`\``
    }
  ]
};
