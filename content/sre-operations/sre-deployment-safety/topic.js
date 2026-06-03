window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['sre-operations/sre-deployment-safety'] = {
  theory: `# Deployment Safety: Progressive Delivery & Feature Flags

## Relevância
> Deployments são a principal causa de incidentes em produção. SREs responsáveis por deploys seguros usam progressive delivery (canary, blue-green, feature flags) para minimizar blast radius.

## Progressive Delivery

Progressive delivery entrega mudanças gradualmente, com capacidade de rollback rápido:

### Canary Deployment com Kubernetes

\`\`\`yaml
# 1. Stable deployment (90% do tráfego)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-stable
  labels:
    app: myapp
    track: stable
spec:
  replicas: 9      # 90% (9 de 10 pods)
  selector:
    matchLabels:
      app: myapp
      track: stable
  template:
    metadata:
      labels:
        app: myapp
        track: stable
    spec:
      containers:
        - name: myapp
          image: myapp:v1.0.0
---
# 2. Canary deployment (10% do tráfego)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-canary
  labels:
    app: myapp
    track: canary
spec:
  replicas: 1      # 10%
  selector:
    matchLabels:
      app: myapp
      track: canary
  template:
    metadata:
      labels:
        app: myapp
        track: canary
    spec:
      containers:
        - name: myapp
          image: myapp:v2.0.0
---
# 3. Service que envia para ambos (baseado no label app: myapp)
apiVersion: v1
kind: Service
metadata:
  name: myapp
spec:
  selector:
    app: myapp    # inclui stable e canary
  ports:
    - port: 80
\`\`\`

### Canary com Argo Rollouts

\`\`\`yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: myapp
spec:
  replicas: 10
  strategy:
    canary:
      steps:
        - setWeight: 10       # 10% canary
        - pause: {duration: 5m}
        - analysis:           # análise automática de métricas
            templates:
              - templateName: success-rate
        - setWeight: 30       # 30% canary
        - pause: {duration: 10m}
        - setWeight: 60
        - pause: {duration: 10m}
        - setWeight: 100      # promoção completa
      canaryService: myapp-canary
      stableService: myapp-stable
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
        - name: myapp
          image: myapp:v2.0.0
\`\`\`

\`\`\`bash
# Acompanhar o rollout
kubectl argo rollouts get rollout myapp --watch

# Promover manualmente (pular pause)
kubectl argo rollouts promote myapp

# Abort (rollback automático)
kubectl argo rollouts abort myapp

# Retomar após abort
kubectl argo rollouts retry rollout myapp
\`\`\`

## Feature Flags

Feature flags desacoplam deploy do release — o código chega em produção mas a feature fica desligada:

### OpenFeature + Flagd (padrão CNCF)

\`\`\`yaml
# flagd ConfigMap com feature flags
apiVersion: v1
kind: ConfigMap
metadata:
  name: flagd-config
data:
  flags.json: |
    {
      "flags": {
        "new-checkout-flow": {
          "state": "ENABLED",
          "variants": {
            "on": true,
            "off": false
          },
          "defaultVariant": "off",
          "targeting": {
            "if": [
              { "in": [{ "var": "email" }, ["admin@company.com", "beta@company.com"]] },
              "on",
              "off"
            ]
          }
        },
        "v2-api": {
          "state": "ENABLED",
          "variants": {
            "on": true,
            "off": false
          },
          "defaultVariant": "off"
        }
      }
    }
\`\`\`

\`\`\`python
# Uso em Python
from openfeature import api
from openfeature.contrib.provider.flagd import FlagdProvider

api.set_provider(FlagdProvider())
client = api.get_client()

# Avaliar feature flag
is_new_checkout = client.get_boolean_value(
    "new-checkout-flow",
    default_value=False,
    evaluation_context={"email": user.email}
)

if is_new_checkout:
    return new_checkout_flow()
else:
    return legacy_checkout()
\`\`\`

## Deployment Pre-checks & Smoke Tests

\`\`\`bash
# Pre-deploy checklist automatizada (script CI/CD)
#!/bin/bash
set -euo pipefail

echo "=== Deployment Safety Checks ==="

# 1. Verificar error rate atual (antes de deployer)
ERROR_RATE=$(curl -s "http://prometheus:9090/api/v1/query?query=rate(http_requests_total{status=~'5..'}[5m])/rate(http_requests_total[5m])*100" | jq -r '.data.result[0].value[1]')
if (( $(echo "\${ERROR_RATE} > 1" | bc -l) )); then
  echo "ERROR: Error rate \${ERROR_RATE}% > 1%. Aborting deploy."
  exit 1
fi

# 2. Verificar que não há incidente ativo
# (integrar com PagerDuty/OpsGenie API)

# 3. Verificar janela de manutenção
HOUR=$(date +%H)
if [[ $HOUR -ge 9 && $HOUR -le 18 ]]; then
  echo "WARNING: Deploy fora da janela preferencial (08-09 ou 18-20)"
fi

# 4. Smoke test pós-deploy
kubectl rollout status deployment/myapp -n production --timeout=300s

# 5. Health check
HEALTH=$(curl -sf http://myapp.production.svc/health | jq -r '.status')
if [[ "$HEALTH" != "ok" ]]; then
  echo "ERROR: Health check falhou. Iniciando rollback..."
  kubectl rollout undo deployment/myapp -n production
  exit 1
fi

echo "=== Deploy concluído com sucesso ==="
\`\`\`

## Erros Comuns de Deployment Safety

1. **Deploy em horário de pico**: sempre deployer em horários de baixo tráfego.
2. **Sem análise automática de canary**: promover canary manualmente sem ver métricas → perde o benefício.
3. **Feature flags sem expiração**: flags de longa data viram dívida técnica. Sempre defina um prazo de remoção.
4. **Rollback sem teste**: nunca testou o processo de rollback antes de precisar dele em produção.
`,

  quiz: [
    {
      question: 'Em um canary deployment com Kubernetes nativo (sem Argo Rollouts), como o tráfego é distribuído entre versões?',
      options: [
        'Via regras de weight no Service Kubernetes',
        'Proporcionalmente ao número de réplicas de cada Deployment (ambos selecionados pelo mesmo Service)',
        'Via annotations no Ingress que definem percentual de tráfego',
        'Via DNS round-robin entre dois Services separados'
      ],
      correct: 1,
      explanation: 'Com Kubernetes nativo, o Service seleciona todos os pods com o label comum (ex: app: myapp). O tráfego é distribuído pelo kube-proxy proporcionalmente ao número de pods — 9 pods da v1 e 1 pod da v2 resulta em ~10% de tráfego para o canary. Argo Rollouts e Istio permitem controle mais fino (ex: exato 10% independente do número de pods).',
      reference: 'Seção Canary Deployment — compare o approach nativo (by replicas) vs Argo Rollouts (by weight).'
    },
    {
      question: 'Qual é a principal vantagem de Feature Flags versus Canary Deployment para controlar releases?',
      options: [
        'Feature flags são sempre mais rápidos de implementar que canary',
        'Feature flags desacoplam deploy do release — o código está em produção mas a feature é controlada por configuração sem redeploy',
        'Feature flags permitem rollback mais rápido que canary',
        'Feature flags não requerem alterações no código da aplicação'
      ],
      correct: 1,
      explanation: 'Feature flags separam o deploy (colocar o código em produção) do release (ativar a feature para usuários). Isso permite: (1) deploy contínuo sem expor features incompletas, (2) A/B testing por usuário/grupo, (3) kill switch instantâneo sem redeploy, (4) rollout gradual por segmento de usuários. Canary controla versões diferentes de pods; feature flags controlam comportamento dentro do mesmo pod.',
      reference: 'Seção Feature Flags — entenda a diferença fundamental entre deploy e release.'
    },
    {
      question: 'Qual é o risco de não testar o processo de rollback antes de precisar dele em produção?',
      options: [
        'Rollback de Kubernetes sempre funciona automaticamente — não precisa de teste',
        'Em um incidente real, um processo de rollback não testado pode ser mais lento, falhar ou ter efeitos colaterais inesperados, prolongando o MTTR',
        'O único risco é perda de dados de auditoria',
        'Rollback não testado apenas consome mais recursos de CPU'
      ],
      correct: 1,
      explanation: 'Processos de rollback não testados frequentemente falham ou demoram mais do esperado durante incidentes reais (quando há pressão de tempo e stress cognitivo). Problemas comuns: banco de dados com schema migration não reversível, dependências de outros serviços na nova versão, processo de rollback desatualizado. SREs praticam rollback regularmente como "fire drills".',
      reference: 'Seção Deployment Pre-checks — inclua rollback tests na sua runbook de deployment.'
    }
  ],

  flashcards: [
    {
      front: 'Como implementar canary deployment nativo no Kubernetes sem ferramentas externas?',
      back: '**Conceito**: dois Deployments (stable e canary) selecionados pelo mesmo Service.\n\n**Ratio por réplicas**:\n- 9 pods stable (v1) + 1 pod canary (v2) = 10% canary\n\n**Service selector**:\n```yaml\nspec:\n  selector:\n    app: myapp      # seleciona AMBOS stable e canary\n                    # NÃO inclui "track: stable"\n```\n\n**Limitação**: controle de peso só por réplicas (não por percentual exato).\n\n**Para controle fino**: use Argo Rollouts, Flagger ou Istio (VirtualService com weight).'
    },
    {
      front: 'O que é progressive delivery e como difere de um rolling update?',
      back: '**Rolling Update** (padrão K8s):\n- Substitui pods um a um\n- Não tem análise automática de métricas\n- Se algo quebrar, o rollback é manual\n- Todos os usuários afetados simultaneamente\n\n**Progressive Delivery**:\n- Expõe nova versão para % crescente do tráfego\n- Análise automática de métricas em cada etapa\n- Rollback automático se métricas degradam\n- Controle granular: por usuário, região, percentual\n\nFerramentas: Argo Rollouts, Flagger (GitOps), Istio+Flagger.'
    }
  ],

  lab: {
    scenario: 'Implementar um canary deployment manual usando dois Deployments e verificar a distribuição de tráfego.',
    objective: 'Entender como canary funciona nativamente no Kubernetes antes de usar ferramentas como Argo Rollouts.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Deploy stable e canary',
        instruction: 'Crie dois Deployments (stable v1 com 9 réplicas e canary v2 com 1 réplica) e um Service que distribui para ambos.',
        hints: ['Label comum: app: myapp', 'Service seleciona por app: myapp (sem track)'],
        solution: `\`\`\`bash
kubectl create namespace canary-demo

# Stable (v1 = nginx:alpine, 9 replicas)
kubectl create deployment myapp-stable \
  --image=nginx:alpine \
  --replicas=9 \
  -n canary-demo

# Adicionar label comum ao pod template
kubectl patch deployment myapp-stable -n canary-demo \
  -p '{"spec":{"template":{"metadata":{"labels":{"app":"myapp","version":"v1"}}}}}'

# Canary (v2 = nginx:latest, 1 replica)
kubectl create deployment myapp-canary \
  --image=nginx:1.25 \
  --replicas=1 \
  -n canary-demo

kubectl patch deployment myapp-canary -n canary-demo \
  -p '{"spec":{"template":{"metadata":{"labels":{"app":"myapp","version":"v2"}}}}}'

# Service que seleciona ambos
kubectl expose deployment myapp-stable \
  --name=myapp \
  --port=80 \
  --selector="app=myapp" \
  -n canary-demo
\`\`\``,
        verify: `\`\`\`bash
kubectl get pods -n canary-demo --show-labels | grep myapp
# Esperado: 9 pods v1 e 1 pod v2

kubectl get svc myapp -n canary-demo
# Esperado: myapp service criado

# Verificar endpoints (deve incluir todos os 10 pods)
kubectl get endpoints myapp -n canary-demo
# Esperado: 10 addresses nos endpoints
\`\`\``
      },
      {
        title: 'Verificar distribuição de tráfego e promover canary',
        instruction: 'Gere tráfego e observe a distribuição. Depois promova o canary para 100%.',
        hints: ['for loop com curl para simular tráfego', 'Scale o stable para 0 para completar promoção'],
        solution: `\`\`\`bash
# Gerar 20 requests e contar versões (via Server header)
kubectl run tester --image=busybox -n canary-demo --restart=Never -- \
  sh -c "for i in \$(seq 20); do wget -qO- http://myapp/ | grep -o 'nginx/[0-9.]*'; done" 2>/dev/null || \
  echo "Verificar via kubectl logs tester -n canary-demo"

# Promover canary (aumentar para 5 e diminuir stable)
kubectl scale deployment myapp-canary --replicas=5 -n canary-demo
kubectl scale deployment myapp-stable --replicas=5 -n canary-demo

# Promoção completa
kubectl scale deployment myapp-canary --replicas=10 -n canary-demo
kubectl scale deployment myapp-stable --replicas=0 -n canary-demo

echo "Canary promovido para 100%"

# Limpeza
kubectl delete namespace canary-demo
\`\`\``,
        verify: `\`\`\`bash
kubectl get deployments -n canary-demo
# Após promoção:
# myapp-stable   0/0   0
# myapp-canary  10/10  10

kubectl get endpoints myapp -n canary-demo
# Todos os endpoints apontam para pods v2
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Canary recebendo mais tráfego do que o esperado',
      difficulty: 'medium',
      symptom: 'O canary tem 1 réplica (esperado ~10%) mas está recebendo ~30% do tráfego conforme logs.',
      diagnosis: `\`\`\`bash
# Verificar se stable está com todas as réplicas saudáveis
kubectl get pods -n production -l track=stable

# Verificar se pods stable têm readiness probe falhando
kubectl describe pod myapp-stable-xxx -n production | grep -A10 "Readiness:"

# Verificar endpoints efetivos
kubectl get endpoints myapp -n production
# Contar endpoints de cada versão
\`\`\``,
      solution: `**Causa**: pods do stable podem estar com readiness probe falhando e sendo removidos dos endpoints. Mesmo com replicas=9, se apenas 3 estão Ready, a distribuição é 3:1 (75% stable, 25% canary).

\`\`\`bash
# Verificar pods não Ready
kubectl get pods -n production -l app=myapp | grep -v Running

# Forçar rollback do stable para versão conhecida boa
kubectl rollout undo deployment/myapp-stable -n production

# Aguardar todos ficarem Ready
kubectl rollout status deployment/myapp-stable -n production

# Verificar distribuição real
kubectl get endpoints myapp -n production
\`\`\`

**Prevenção**: monitore o número real de endpoints Ready, não apenas replicas. Use Prometheus: \`kube_endpoint_address_available\`.`
    }
  ]
};
