window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['cilium-fundamentals/cilium-hubble'] = {
  theory: `
# Hubble — Observabilidade de Rede com eBPF

## Relevancia
Hubble e o componente de observabilidade do Cilium, oferecendo visibilidade completa de flows de rede, service maps, metricas e DNS queries em tempo real — tudo sem sidecar proxies. E essencial para debug, seguranca e troubleshooting de rede em clusters com Cilium.

## Conceitos Fundamentais

### Arquitetura do Hubble

\`\`\`
┌──────────────────────────────────────┐
│           hubble CLI                  │
│    (consulta via Relay ou local)     │
└──────────────┬───────────────────────┘
               │
┌──────────────▼───────────────────────┐
│         Hubble Relay                  │
│   (Deployment — agrega flows de      │
│    todos os nodes via gRPC)          │
└──────────────┬───────────────────────┘
               │
┌──────────────▼───────────────────────┐
│         Hubble UI                     │
│   (interface web — service maps,     │
│    flow table, namespace view)       │
└──────────────────────────────────────┘
               │
┌──────────────▼───────────────────────┐
│    Hubble Server (em cada Agent)      │
│   (coleta flows eBPF do datapath)    │
│   ┌─────────────────────────────┐    │
│   │  eBPF datapath events       │    │
│   │  (L3/L4/L7 flows)          │    │
│   └─────────────────────────────┘    │
└──────────────────────────────────────┘
\`\`\`

### Hubble CLI

\`\`\`bash
# Observar flows em tempo real
hubble observe

# Filtrar por namespace
hubble observe --namespace production

# Filtrar por pod
hubble observe --pod production/api-server

# Filtrar por verdict (allowed/dropped)
hubble observe --verdict DROPPED
hubble observe --verdict ALLOWED

# Filtrar por tipo
hubble observe --type l7
hubble observe --type drop
hubble observe --type trace

# Filtrar por protocolo
hubble observe --protocol tcp
hubble observe --protocol http

# Filtrar por HTTP
hubble observe --http-method GET
hubble observe --http-path "/api/.*"
hubble observe --http-status 500

# Combinar filtros
hubble observe --namespace production --verdict DROPPED --protocol http

# Output em JSON
hubble observe -o json

# Output compacto
hubble observe -o compact

# Seguir flows (streaming)
hubble observe -f
\`\`\`

### Hubble Status e Metricas

\`\`\`bash
# Status do Hubble
hubble status

# Listar nodes com Hubble
hubble list nodes

# Metricas do Hubble
hubble observe --print-raw-filters
\`\`\`

### Hubble Metricas para Prometheus

\`\`\`yaml
# Habilitar metricas do Hubble via Helm
# helm values:
hubble:
  enabled: true
  metrics:
    enabled:
      - dns
      - drop
      - tcp
      - flow
      - icmp
      - http
    serviceMonitor:
      enabled: true  # se usar Prometheus Operator
\`\`\`

**Metricas exportadas:**

| Metrica | Descricao |
|---------|-----------|
| hubble_flows_processed_total | Total de flows processados |
| hubble_drop_total | Drops por razao |
| hubble_dns_queries_total | Queries DNS |
| hubble_dns_responses_total | Respostas DNS |
| hubble_http_requests_total | Requests HTTP (com status) |
| hubble_http_request_duration_seconds | Latencia HTTP |
| hubble_tcp_flags_total | Flags TCP por tipo |

### Hubble UI — Service Map

\`\`\`bash
# Acessar Hubble UI
kubectl port-forward -n kube-system svc/hubble-ui 12000:80

# Abrir no navegador
# http://localhost:12000
\`\`\`

**Funcionalidades do UI:**
- Service dependency map visual
- Flow table com filtros
- Vista por namespace
- Detalhes de flows L3/L4/L7
- Indicacao de policy verdicts (allowed/denied)

### Casos de Uso do Hubble

\`\`\`
1. Debug de Conectividade:
   hubble observe --pod <pod> --verdict DROPPED
   → Identifica pacotes bloqueados e por que

2. Auditoria de DNS:
   hubble observe --type dns
   → Ve todas as queries DNS e respostas

3. Monitoramento L7:
   hubble observe --type l7 --protocol http
   → Ve requests HTTP com status codes

4. Service Dependency:
   Hubble UI → service map
   → Visualiza dependencias entre servicos

5. Security Audit:
   hubble observe --verdict DROPPED --namespace production
   → Identifica tentativas de acesso bloqueadas

6. Latencia:
   hubble observe --type l7 --protocol http -o json | jq '.flow.l7.latency'
   → Mede latencia por request
\`\`\`

### Hubble Flows — Anatomia

\`\`\`
Um flow Hubble contem:
  Timestamp:       quando o evento ocorreu
  Source:           pod/identity de origem
  Destination:     pod/identity de destino
  Verdict:         FORWARDED, DROPPED, AUDIT, ERROR
  Type:            L3/L4, L7, DNS, drop
  IP:              enderecos IP
  L4:              porta e protocolo
  L7:              HTTP method/path/status, DNS query
  Policy:          qual policy causou o verdict
  Drop reason:     motivo do drop (se aplicavel)
  Node:            node onde ocorreu
\`\`\`

## Comandos Essenciais

\`\`\`bash
# Status
hubble status
hubble list nodes

# Flows em tempo real
hubble observe -f --namespace production
hubble observe --pod default/nginx --verdict DROPPED

# DNS
hubble observe --type dns --namespace production

# HTTP
hubble observe --protocol http --http-status 5xx
hubble observe --protocol http --http-method POST

# Drops
hubble observe --verdict DROPPED -o json

# Service map
kubectl port-forward svc/hubble-ui -n kube-system 12000:80

# Metricas
curl -s localhost:9965/metrics | grep hubble_
\`\`\`

## Erros Comuns

1. **Hubble desabilitado**: Hubble nao vem habilitado por padrao em todas as instalacoes. Verifique helm values.
2. **Relay nao conecta**: Hubble Relay precisa de GRPC entre agents. Verifique porta 4244/TCP.
3. **UI sem dados**: Hubble UI precisa do Relay funcionando. Verifique hubble-relay pod e service.
4. **Metricas faltando**: Metricas precisam ser explicitamente habilitadas no Helm (hubble.metrics.enabled).
5. **Buffer overflow**: Em clusters com muito trafego, flows podem ser perdidos. Aumente buffer do ring.

## Killer.sh Style Challenge

**Cenario:** Use Hubble para diagnosticar e monitorar um problema de conectividade em producao.

**Tarefas:**
1. Encontre todos os flows DROPPED para um pod especifico
2. Identifique queries DNS falhando em um namespace
3. Analise latencia HTTP entre dois servicos
4. Configure metricas Hubble para Prometheus
`,
  quiz: [
    {
      question: 'O que e o Hubble no contexto do Cilium?',
      options: [
        'Um load balancer para services',
        'O componente de observabilidade do Cilium que fornece visibilidade de flows de rede, DNS, metricas e service maps usando dados do eBPF datapath',
        'Um CNI alternativo ao Cilium',
        'Um proxy sidecar para service mesh'
      ],
      correct: 1,
      explanation: 'Hubble e integrado ao Cilium Agent e coleta dados diretamente do eBPF datapath sem adicionar overhead de sidecar proxies. Fornece visibilidade L3/L4/L7, DNS queries, policy verdicts, service dependency maps e exporta metricas para Prometheus.',
      reference: 'Conceito relacionado: cilium-architecture — Hubble e integrado ao Agent, nao e um componente separado.'
    },
    {
      question: 'Qual a funcao do Hubble Relay?',
      options: [
        'Rotear trafego entre pods',
        'Agregar dados de flows de todos os Cilium Agents via gRPC, permitindo consulta centralizada pelo CLI e UI',
        'Armazenar policies no etcd',
        'Fazer load balancing de DNS'
      ],
      correct: 1,
      explanation: 'Hubble Relay e um Deployment que se conecta a todos os Cilium Agents via gRPC e agrega seus dados. Sem o Relay, o CLI so consegue ver flows do node local. Com Relay, voce ve flows de todo o cluster. Hubble UI depende do Relay para funcionar.',
      reference: 'Conceito relacionado: cilium-hubble — Relay precisa de porta 4244/TCP entre agents.'
    },
    {
      question: 'Como filtrar apenas pacotes DROPPED no Hubble?',
      options: [
        'hubble observe --filter drop',
        'hubble observe --verdict DROPPED mostra apenas flows que foram negados por policies ou por outras razoes',
        'hubble observe --type error',
        'hubble observe --show-drops'
      ],
      correct: 1,
      explanation: 'hubble observe --verdict DROPPED filtra apenas flows com verdict DROPPED. Outros verdicts incluem FORWARDED (permitido), AUDIT (monitorado), e ERROR. Voce pode combinar com --namespace ou --pod para mais especificidade. Adicione -o json para detalhes incluindo drop reason.',
      reference: 'Conceito relacionado: cilium-network-policies — drops geralmente indicam policies bloqueando.'
    },
    {
      question: 'Quais metricas o Hubble pode exportar para Prometheus?',
      options: [
        'Apenas metricas de CPU dos pods',
        'DNS queries/respostas, drops por razao, HTTP requests com status e latencia, TCP flags, e total de flows processados',
        'Apenas metricas de rede do node',
        'Apenas contagem de pods'
      ],
      correct: 1,
      explanation: 'Hubble exporta metricas ricas: hubble_dns_queries_total, hubble_drop_total (por razao), hubble_http_requests_total (com status code), hubble_http_request_duration_seconds, hubble_tcp_flags_total e hubble_flows_processed_total. Precisam ser habilitadas via Helm.',
      reference: 'Conceito relacionado: sre-observability — metricas Hubble complementam kube-state-metrics.'
    },
    {
      question: 'Como acessar o Hubble UI?',
      options: [
        'Via kubectl exec no pod do Hubble',
        'Via port-forward: kubectl port-forward svc/hubble-ui -n kube-system 12000:80, depois acessar localhost:12000',
        'Via NodePort padrao na porta 30000',
        'Atraves do Grafana'
      ],
      correct: 1,
      explanation: 'Hubble UI e acessado via port-forward para a porta 80 do service hubble-ui. Mostra service dependency maps, flow tables com filtros, vista por namespace e detalhes de flows L3/L4/L7. Requer hubble-ui e hubble-relay habilitados no Helm.',
      reference: 'Conceito relacionado: cilium-hubble — UI depende do Relay para exibir dados de todo o cluster.'
    },
    {
      question: 'O que contem um flow Hubble?',
      options: [
        'Apenas IP de origem e destino',
        'Timestamp, source/dest pod e identity, verdict, tipo (L3/L4/L7/DNS), IP, porta, protocolo, detalhes L7, policy aplicada e drop reason',
        'Apenas o nome do service',
        'Apenas metricas de throughput'
      ],
      correct: 1,
      explanation: 'Flows Hubble sao ricos em contexto: incluem informacao de identity (labels do pod), policy verdict com qual policy causou, detalhes L7 (HTTP method/path/status ou DNS query/response) e drop reason quando aplicavel. Tudo isso sem overhead de sidecar.',
      reference: 'Conceito relacionado: cilium-hubble — use -o json para ver todos os campos do flow.'
    },
    {
      question: 'Como monitorar queries DNS com o Hubble?',
      options: [
        'hubble observe --protocol dns',
        'hubble observe --type dns mostra todas as queries e respostas DNS, incluindo dominio, tipo de record e codigo de resposta',
        'hubble observe --port 53',
        'hubble dns list'
      ],
      correct: 1,
      explanation: 'hubble observe --type dns filtra especificamente eventos DNS. Mostra o dominio consultado, tipo de record (A, AAAA, CNAME), resposta e IPs retornados. Essencial para debug de problemas de resolucao DNS e para auditoria de quais dominios os pods acessam.',
      reference: 'Conceito relacionado: cilium-network-policies — DNS visibility ajuda a definir FQDN policies.'
    }
  ],
  flashcards: [
    {
      front: 'Arquitetura do Hubble?',
      back: '**Hubble Server (em cada Agent):**\n- Coleta flows do eBPF datapath\n- Armazena em ring buffer local\n- Eventos L3/L4/L7/DNS\n\n**Hubble Relay (Deployment):**\n- Agrega flows de TODOS agents\n- API gRPC centralizada\n- CLI e UI conectam aqui\n\n**Hubble UI (Deployment):**\n- Interface web\n- Service dependency map\n- Flow table com filtros\n- Vista por namespace\n\n**Hubble CLI:**\n- hubble observe (flows)\n- hubble status (saude)\n- hubble list nodes\n\n**Sem sidecar!**\nDados vem do eBPF diretamente'
    },
    {
      front: 'Principais filtros do hubble observe?',
      back: '**Por escopo:**\n```bash\n--namespace production\n--pod prod/api-server\n```\n\n**Por verdict:**\n```bash\n--verdict DROPPED\n--verdict ALLOWED\n```\n\n**Por tipo:**\n```bash\n--type l7\n--type dns\n--type drop\n```\n\n**Por HTTP:**\n```bash\n--http-method GET\n--http-path "/api/.*"\n--http-status 500\n```\n\n**Output:**\n```bash\n-o json    # detalhado\n-o compact # resumido\n-f         # streaming\n```'
    },
    {
      front: 'Metricas Hubble para Prometheus?',
      back: '**Habilitar via Helm:**\n```yaml\nhubble:\n  metrics:\n    enabled:\n      - dns\n      - drop\n      - tcp\n      - flow\n      - http\n```\n\n**Metricas:**\n- hubble_flows_processed_total\n- hubble_drop_total (por razao)\n- hubble_dns_queries_total\n- hubble_dns_responses_total\n- hubble_http_requests_total\n- hubble_http_request_duration_seconds\n- hubble_tcp_flags_total\n\n**ServiceMonitor:**\n```yaml\nserviceMonitor:\n  enabled: true\n```'
    },
    {
      front: 'Hubble UI funcionalidades?',
      back: '**Acessar:**\n```bash\nkubectl port-forward \\\n  svc/hubble-ui \\\n  -n kube-system 12000:80\n# http://localhost:12000\n```\n\n**Funcionalidades:**\n- Service dependency map visual\n- Flow table com filtros\n- Vista por namespace\n- Detalhes L3/L4/L7\n- Policy verdicts\n  (allowed/denied visualizado)\n\n**Requisitos:**\n- hubble.ui.enabled=true\n- hubble.relay.enabled=true\n- Relay precisa estar running\n\n**Ideal para:**\n- Entender dependencias\n- Debug visual de flows\n- Apresentacoes/demos'
    },
    {
      front: 'Casos de uso do Hubble?',
      back: '**1. Debug conectividade:**\n```bash\nhubble observe --pod <pod> \\\n  --verdict DROPPED\n```\n\n**2. Auditoria DNS:**\n```bash\nhubble observe --type dns\n```\n\n**3. Monitoramento HTTP:**\n```bash\nhubble observe --type l7 \\\n  --protocol http\n```\n\n**4. Service map:**\nHubble UI → visual\n\n**5. Security audit:**\n```bash\nhubble observe \\\n  --verdict DROPPED \\\n  --namespace production\n```\n\n**6. Latencia:**\n```bash\nhubble observe --type l7 \\\n  -o json | jq .flow.l7.latency\n```'
    },
    {
      front: 'Anatomia de um flow Hubble?',
      back: '**Campos do flow:**\n- **Timestamp**: quando ocorreu\n- **Source**: pod/identity origem\n- **Destination**: pod/identity destino\n- **Verdict**: FORWARDED/DROPPED/AUDIT\n- **Type**: L3/L4, L7, DNS, drop\n- **IP**: enderecos\n- **L4**: porta e protocolo\n- **L7**: HTTP method/path/status\n       DNS query/response\n- **Policy**: qual policy causou\n- **Drop reason**: motivo do drop\n- **Node**: node do evento\n\n**Ver completo:**\n```bash\nhubble observe -o json | jq .\n```'
    }
  ],
  lab: {
    scenario: 'Voce precisa usar o Hubble para diagnosticar problemas de conectividade e monitorar trafego de rede em tempo real.',
    objective: 'Usar hubble observe para filtrar flows, identificar drops, monitorar DNS e acessar Hubble UI.',
    duration: '15-20 minutos',
    steps: [
      {
        title: 'Verificar Status do Hubble',
        instruction: `Verifique que o Hubble esta habilitado e funcionando corretamente.

\`\`\`bash
# Status do Hubble
hubble status

# Listar nodes
hubble list nodes

# Verificar pods do Hubble
kubectl get pods -n kube-system -l app.kubernetes.io/name=hubble-relay
kubectl get pods -n kube-system -l app.kubernetes.io/name=hubble-ui
\`\`\``,
        hints: [
          'Se Hubble nao esta habilitado, use: helm upgrade cilium --set hubble.enabled=true',
          'Relay precisa estar Running para CLI funcionar com dados de todo o cluster',
          'Sem Relay, hubble observe mostra apenas flows do node local'
        ],
        solution: `\`\`\`bash
hubble status
hubble list nodes
kubectl get pods -n kube-system -l app.kubernetes.io/part-of=cilium
\`\`\``,
        verify: `\`\`\`bash
hubble status
# Saida esperada: Healthcheck (via localhost:4245): Ok
#                  Max Flows: XXXX

hubble list nodes
# Saida esperada: lista de nodes com status "Connected"
\`\`\``
      },
      {
        title: 'Observar Flows e Diagnosticar Drops',
        instruction: `Use hubble observe para monitorar trafego e identificar pacotes bloqueados.

\`\`\`bash
# Gerar trafego de teste
kubectl create namespace hubble-demo
kubectl create deployment web --image=nginx -n hubble-demo
kubectl expose deployment web --port=80 -n hubble-demo

# Observar todos os flows do namespace
hubble observe --namespace hubble-demo -f &

# Gerar trafego
kubectl run curl-test --image=curlimages/curl --rm -it -n hubble-demo -- curl -s http://web

# Observar drops
hubble observe --namespace hubble-demo --verdict DROPPED

# Observar DNS
hubble observe --namespace hubble-demo --type dns
\`\`\``,
        hints: [
          'Use -f para streaming em tempo real',
          'DROPPED flows indicam policy blocking ou problemas de rota',
          'DNS type mostra dominio, tipo de record e resposta'
        ],
        solution: `\`\`\`bash
kubectl create namespace hubble-demo
kubectl create deployment web --image=nginx -n hubble-demo
kubectl expose deployment web --port=80 -n hubble-demo
hubble observe --namespace hubble-demo --last 10
\`\`\``,
        verify: `\`\`\`bash
# Verificar que flows sao vistos
hubble observe --namespace hubble-demo --last 5
# Saida esperada: flows mostrando source, destination, verdict

# Verificar verdict dos flows
hubble observe --namespace hubble-demo --verdict FORWARDED --last 3
# Saida esperada: flows com verdict FORWARDED
\`\`\``
      },
      {
        title: 'Acessar Hubble UI',
        instruction: `Configure port-forward para acessar o Hubble UI e visualizar service maps.

\`\`\`bash
# Port-forward para Hubble UI
kubectl port-forward svc/hubble-ui -n kube-system 12000:80 &

# Abrir no navegador: http://localhost:12000

# Selecionar namespace hubble-demo no UI
# Visualizar service map e flows
\`\`\``,
        hints: [
          'Hubble UI mostra service map visual com dependencias',
          'Selecione o namespace desejado no dropdown',
          'Flows aparecem em tempo real na tabela abaixo do map'
        ],
        solution: `\`\`\`bash
kubectl port-forward svc/hubble-ui -n kube-system 12000:80 &
echo "Abrir http://localhost:12000 no navegador"
\`\`\``,
        verify: `\`\`\`bash
# Verificar que o service hubble-ui existe
kubectl get svc hubble-ui -n kube-system
# Saida esperada: hubble-ui   ClusterIP   ...   80/TCP

# Verificar que o pod esta rodando
kubectl get pods -n kube-system -l app.kubernetes.io/name=hubble-ui
# Saida esperada: hubble-ui-xxxxx   Running
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Hubble CLI mostra "connection refused"',
      difficulty: 'easy',
      symptom: 'Ao executar hubble observe, recebe erro "connection refused" ou "unable to connect to Hubble Relay".',
      diagnosis: `\`\`\`bash
# Verificar se Relay esta rodando
kubectl get pods -n kube-system -l app.kubernetes.io/name=hubble-relay

# Verificar service do Relay
kubectl get svc hubble-relay -n kube-system

# Verificar logs do Relay
kubectl logs -n kube-system -l app.kubernetes.io/name=hubble-relay --tail=20

# Verificar porta
kubectl get svc hubble-relay -n kube-system -o jsonpath='{.spec.ports[*].port}'
\`\`\``,
      solution: `**Solucoes:**

1. **Relay nao instalado:** Habilite no Helm:
\`\`\`bash
helm upgrade cilium cilium/cilium -n kube-system \\
  --set hubble.enabled=true \\
  --set hubble.relay.enabled=true
\`\`\`

2. **Port-forward para o Relay:**
\`\`\`bash
# Se o CLI nao encontra automaticamente
kubectl port-forward svc/hubble-relay -n kube-system 4245:80 &
hubble observe --server localhost:4245
\`\`\`

3. **Relay pod crashloop:** Verifique recursos e logs — pode precisar de mais memoria.`
    },
    {
      title: 'Hubble UI sem dados / servicos',
      difficulty: 'medium',
      symptom: 'Hubble UI abre mas nao mostra service map ou flows. A pagina esta vazia ou mostra "No data".',
      diagnosis: `\`\`\`bash
# Verificar Relay conectividade
hubble status

# Verificar pods do UI
kubectl logs -n kube-system -l app.kubernetes.io/name=hubble-ui --tail=20

# Verificar se Relay tem dados
hubble observe --last 5

# Verificar namespace selecionado no UI
\`\`\``,
      solution: `**Solucoes:**

1. **Selecionar namespace correto** no dropdown do UI — ele nao mostra todos por padrao.

2. **Gerar trafego:** O UI so mostra dados quando ha flows recentes:
\`\`\`bash
kubectl run curl-test --image=curlimages/curl --rm -it -- curl -s http://some-service
\`\`\`

3. **Verificar Relay:** UI depende do Relay. Se hubble status mostra erro, corrija o Relay primeiro.

4. **Backend URL:** Verifique se UI consegue alcançar o Relay:
\`\`\`bash
kubectl logs -n kube-system deploy/hubble-ui --tail=20 | grep -i relay
\`\`\``
    },
    {
      title: 'Metricas Hubble nao aparecem no Prometheus',
      difficulty: 'medium',
      symptom: 'Prometheus nao mostra metricas hubble_* apesar de estar configurado.',
      diagnosis: `\`\`\`bash
# Verificar se metricas estao habilitadas
helm get values cilium -n kube-system | grep -A10 metrics

# Verificar endpoint de metricas
kubectl get pods -n kube-system -l k8s-app=cilium -o wide
kubectl exec -n kube-system <cilium-pod> -- curl -s localhost:9965/metrics | grep hubble

# Verificar ServiceMonitor
kubectl get servicemonitor -n kube-system | grep hubble
\`\`\``,
      solution: `**Solucoes:**

1. **Habilitar metricas no Helm:**
\`\`\`bash
helm upgrade cilium cilium/cilium -n kube-system \\
  --set hubble.metrics.enabled="{dns,drop,tcp,flow,http}"
\`\`\`

2. **ServiceMonitor para Prometheus Operator:**
\`\`\`bash
helm upgrade cilium cilium/cilium -n kube-system \\
  --set hubble.metrics.serviceMonitor.enabled=true
\`\`\`

3. **Verificar scraping:** Se nao usa ServiceMonitor, adicione job manual no prometheus.yml apontando para porta 9965 dos cilium agents.`
    }
  ]
};
