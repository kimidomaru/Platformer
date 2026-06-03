window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['sre-fundamentals/sre-capacity-planning'] = {
  theory: `# Capacity Planning & Demand Forecasting

## Relevância
> Capacity planning é uma das funções centrais do SRE — evita tanto o over-provisioning (custo) quanto o under-provisioning (indisponibilidade). É cobrado em entrevistas SRE sênior e em certificações de cloud.

## O Processo de Capacity Planning

\`\`\`
1. MEDIR → coletar dados de utilização atual
2. MODELAR → projetar crescimento futuro
3. PLANEJAR → quando/quanto provisionar
4. PROVISIONAR → ajustar capacidade
5. MONITORAR → validar previsão vs realidade
\`\`\`

### Métricas Essenciais para Capacity

| Recurso | Métrica Primária | Sinal de Alerta |
|---------|-----------------|-----------------|
| CPU | % utilização média + p95 | > 70% sustained |
| Memória | Working set + cache | OOM kills > 0 |
| Armazenamento | Crescimento/dia + IOPS | > 80% filled |
| Rede | Mbps + packet loss | > 80% bandwidth |
| Database | QPS + latência + connections | Query time degradation |

## Demand Forecasting

### Modelos de Crescimento

**Linear**: tráfego cresce proporcionalmente ao tempo (ex: empresa estável)
\`\`\`
capacidade_necessária = capacidade_atual + (crescimento_mensal × meses)
\`\`\`

**Exponencial**: crescimento acelerado (ex: startup em hypergrowth)
\`\`\`
capacidade_necessária = capacidade_atual × (1 + taxa_crescimento)^n
\`\`\`

**Sazonal**: picos previsíveis (Black Friday, início de ano fiscal)
\`\`\`
# Manter histórico de pelo menos 2 ciclos para identificar padrões
peak_multiplier = max(tráfego_pico) / avg(tráfego_normal)
\`\`\`

### Queries PromQL para Capacity Planning

\`\`\`promql
# Taxa de crescimento de CPU (últimas 4 semanas, projetado para 4 semanas)
predict_linear(
  avg(rate(container_cpu_usage_seconds_total[5m]))[4w:1h],
  4 * 7 * 24 * 3600  # 4 semanas em segundos
)

# Quando o disco vai encher? (dias restantes)
predict_linear(
  node_filesystem_avail_bytes{mountpoint="/"}[7d],
  0
) / 86400

# Crescimento de pods no namespace (forecast 30 dias)
predict_linear(
  count(kube_pod_info{namespace="production"})[30d:1d],
  30 * 86400
)
\`\`\`

## Right-Sizing em Kubernetes

### Identificar recursos mal alocados

\`\`\`bash
# VPA (Vertical Pod Autoscaler) em modo Recommendation
kubectl describe vpa myapp-vpa -n production
# Verifica: recomendação vs request atual

# Verificar pods com resources sub-utilizados
kubectl top pods -n production | sort -k3 -n
# Comparar com os requests configurados no Deployment

# Checar OOM kills (memória sub-alocada)
kubectl get events -n production | grep OOMKilled
\`\`\`

\`\`\`yaml
# VPA em modo de recomendação (não altera automaticamente)
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: myapp-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: myapp
  updatePolicy:
    updateMode: "Off"        # Apenas recomenda, não altera
  resourcePolicy:
    containerPolicies:
      - containerName: myapp
        minAllowed:
          cpu: 50m
          memory: 64Mi
        maxAllowed:
          cpu: 2
          memory: 2Gi
\`\`\`

## Load Testing como Ferramenta de Capacity

\`\`\`bash
# k6 — load test para validar capacidade
cat > capacity-test.js << 'EOF'
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // ramp up para 100 VUs
    { duration: '5m', target: 100 },   // sustain em 100 VUs (baseline)
    { duration: '2m', target: 500 },   // ramp up para pico
    { duration: '5m', target: 500 },   // sustain em 500 VUs (stress)
    { duration: '2m', target: 0 },     // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% das requests < 500ms
    http_req_failed: ['rate<0.01'],    // < 1% de erros
  },
};

export default function () {
  const res = http.get('https://myapp.example.com/api/products');
  check(res, { 'status 200': (r) => r.status === 200 });
}
EOF

k6 run capacity-test.js
\`\`\`

## Erros Comuns

1. **Planejar apenas para CPU**: esquece memória, rede, storage, file descriptors — qualquer um pode ser o bottleneck.
2. **Usar médias sem p99**: a média esconde picos. Planeje para o p95/p99.
3. **Não incluir sazonalidade**: sistemas de e-commerce que não planejam para Black Friday.
4. **Overhead de headroom insuficiente**: planejar para 100% da capacidade — qualquer pico quebra. Mantenha 30-40% de headroom.
`,

  quiz: [
    {
      question: 'Qual função PromQL é usada para prever quando um recurso (como disco) vai atingir seu limite?',
      options: [
        'forecast_linear()',
        'predict_linear()',
        'extrapolate()',
        'project_growth()'
      ],
      correct: 1,
      explanation: 'predict_linear(serie[período], tempo_futuro) usa regressão linear para projetar o valor de uma série no futuro. Para prever quando o disco vai encher: predict_linear(node_filesystem_avail_bytes[7d], 0) retorna o timestamp Unix em que o valor chegará a 0. Dividindo por 86400 converte para dias.',
      reference: 'Seção Queries PromQL — predict_linear é fundamental para capacity planning proativo.'
    },
    {
      question: 'Qual é a finalidade do VPA (Vertical Pod Autoscaler) no modo "Off" (updateMode: Off)?',
      options: [
        'Desabilita completamente o VPA sem nenhum efeito',
        'Gera recomendações de recursos sem alterar automaticamente os pods',
        'Escala verticalmente apenas durante janelas de manutenção',
        'Funciona igual ao modo Auto mas sem eviction'
      ],
      correct: 1,
      explanation: 'Com updateMode: Off, o VPA monitora o consumo real e gera recomendações (visíveis em kubectl describe vpa), mas NÃO altera os pods automaticamente. Isso é ideal para capacity planning: você entende o que o VPA recomendaria, valida, e aplica manualmente quando conveniente. É o modo mais seguro para começar.',
      reference: 'Seção Right-Sizing — use updateMode: Off para recomendações sem risco de interrupção.'
    },
    {
      question: 'Por que planejar capacidade apenas com base na média de utilização de CPU é problemático?',
      options: [
        'A média é imprecisa em ambientes containerizados',
        'A média oculta picos — se o p95 de CPU for 3x a média, o sistema quebrará em picos mesmo dentro da "média normal"',
        'Média de CPU não está disponível no Prometheus',
        'Médias de CPU incluem apenas processos de sistema, não de aplicação'
      ],
      correct: 1,
      explanation: 'Médias escondem picos. Se a CPU média é 40% mas o p95 é 85%, 5% das requests ocorrem em condições de sobrecarga. O capacity planning deve ser baseado em percentis altos (p95, p99) e considerar headroom adicional (30-40%) para absorver picos inesperados sem degradação.',
      reference: 'Seção Demand Forecasting — planeje para p95/p99 e mantenha 30-40% de headroom.'
    }
  ],

  flashcards: [
    {
      front: 'Quais são as 5 etapas do processo de Capacity Planning?',
      back: '1. **MEDIR** → coletar dados de utilização atual (CPU, memória, rede, storage, QPS)\n2. **MODELAR** → projetar crescimento (linear, exponencial, sazonal)\n3. **PLANEJAR** → definir quando e quanto provisionar (com headroom de 30-40%)\n4. **PROVISIONAR** → ajustar capacidade (HPA, VPA, novos nodes, mais storage)\n5. **MONITORAR** → comparar previsão vs realidade, ajustar o modelo\n\nO ciclo se repete — cada iteração melhora a precisão do modelo.'
    },
    {
      front: 'Como usar predict_linear no PromQL para capacity planning?',
      back: '```promql\n# Prever uso de CPU em 30 dias\npredict_linear(\n  avg(rate(cpu_usage[5m]))[7d:1h],\n  30 * 86400\n)\n\n# Prever quando disco enche (dias)\npredict_linear(\n  node_filesystem_avail_bytes[7d],\n  0\n) / -86400\n\n# Crescimento de pods (30 dias)\npredict_linear(\n  count(kube_pod_info)[30d:1d],\n  30 * 86400\n)\n```\n\nParâmetros: `predict_linear(série[lookback], segundos_futuro)`'
    }
  ],

  lab: {
    scenario: 'Analisar utilização de recursos em um cluster e gerar recomendações de right-sizing.',
    objective: 'Usar VPA em modo recomendação e PromQL para identificar pods over/under-provisioned.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Analisar utilização atual',
        instruction: 'Use kubectl top e events para identificar pods com recursos mal alocados.',
        hints: ['kubectl top mostra uso real', 'OOM kills indicam memória insuficiente'],
        solution: `\`\`\`bash
# Ver utilização atual de pods
kubectl top pods -A --sort-by=cpu | head -20

# Ver OOM kills (memória insuficiente)
kubectl get events -A --field-selector reason=OOMKilling

# Comparar resources requests vs uso real
kubectl get pods -n production -o json | \
  jq '.items[] | {name: .metadata.name, requests: .spec.containers[].resources.requests}'
\`\`\``,
        verify: `\`\`\`bash
# Verificar que kubectl top está funcionando
kubectl top nodes
# Esperado: CPU e MEMORY usage por node
\`\`\``
      },
      {
        title: 'Criar VPA em modo recomendação',
        instruction: 'Criar um VPA para o deployment nginx em modo Off (apenas recomendações).',
        hints: ['updateMode: Off não altera pods', 'Verificar com kubectl describe vpa'],
        solution: `\`\`\`bash
# Verificar se VPA está instalado
kubectl get crd | grep verticalpodautoscaler

# Criar namespace de teste
kubectl create namespace capacity-test
kubectl create deployment nginx --image=nginx -n capacity-test
kubectl scale deployment nginx --replicas=3 -n capacity-test

# Criar VPA
cat << 'EOF' | kubectl apply -f -
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: nginx-vpa
  namespace: capacity-test
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: nginx
  updatePolicy:
    updateMode: "Off"
EOF

# Aguardar recomendação (pode levar alguns minutos)
sleep 60
kubectl describe vpa nginx-vpa -n capacity-test | grep -A20 "Recommendation:"
\`\`\``,
        verify: `\`\`\`bash
kubectl get vpa -n capacity-test
# Esperado: nginx-vpa  Off  ...

# Verificar se gerou recomendação
kubectl describe vpa nginx-vpa -n capacity-test | grep "Target:"
# Esperado (após alguns minutos): Target: cpu, memory recommendations

# Limpeza
kubectl delete namespace capacity-test
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Pods sendo OOMKilled repetidamente apesar de memory limits "suficientes"',
      difficulty: 'medium',
      symptom: 'Pods reiniciam frequentemente com OOMKilled. O limits de memória parece alto o suficiente (512Mi) mas os kills continuam.',
      diagnosis: `\`\`\`bash
# Verificar histórico de OOM kills
kubectl describe pod myapp-xxx -n production | grep -i "oom\|kill\|memory\|restart"

# Ver uso real de memória (working set vs limit)
kubectl top pod myapp-xxx -n production

# Ver métricas detalhadas no Prometheus
# container_memory_working_set_bytes vs container_spec_memory_limit_bytes
\`\`\``,
      solution: `**Causas comuns**:

1. **Memory leak na aplicação**: o pod vai crescendo até o limite. Solução: identificar o leak com profiling.

2. **JVM não respeita container limits**: JVM usa memória do host por padrão. Solução: \`-XX:MaxRAMPercentage=75.0\` ou \`-Xmx400m\` (para limit 512Mi).

3. **Requests muito menores que limits**: se requests=64Mi e limits=512Mi, o scheduler pode colocar muitos pods no mesmo node, que então competem por memória.

**Solução**:
\`\`\`bash
# Ajustar requests próximos ao limite (evitar bursting extremo)
kubectl set resources deployment myapp \
  --requests=memory=384Mi \
  --limits=memory=512Mi \
  -n production

# Usar VPA para ter recomendações baseadas em uso real
kubectl apply -f vpa-myapp.yaml
\`\`\``
    }
  ]
};
