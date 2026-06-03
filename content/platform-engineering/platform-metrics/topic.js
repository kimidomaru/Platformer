window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['platform-engineering/platform-metrics'] = {
  theory: `# Platform Metrics: DORA, SPACE & Developer Experience

## Relevância
> Platform engineers precisam medir o impacto da plataforma na produtividade dos times. DORA metrics são o padrão da indústria — aparece em entrevistas de Staff/Principal Engineer e em frameworks como SPACE e DevOps Research.

## DORA Metrics — O Padrão da Indústria

Desenvolvidas pelo DORA (DevOps Research and Assessment), estas 4 métricas diferenciam times de alto desempenho:

| Métrica | O que mede | Elite | High | Medium | Low |
|---------|-----------|-------|------|--------|-----|
| **Deployment Frequency** | Com que frequência implanta em produção | Múltiplas vezes/dia | 1x/semana a 1x/mês | 1x/mês a 1x/6meses | < 6 meses |
| **Lead Time for Changes** | Do commit até produção | < 1 hora | 1 dia a 1 semana | 1 semana a 1 mês | > 6 meses |
| **Change Failure Rate** | % de deploys que causam incidente | < 5% | 5-10% | 10-15% | > 15% |
| **Time to Restore (MTTR)** | Tempo para recuperar de incidente | < 1 hora | < 1 dia | 1 dia a 1 semana | > 6 meses |

### Coletando DORA com Prometheus + DORA Metrics Exporter

\`\`\`yaml
# Helm values para dora-metrics exporter
config:
  deploymentFrequency:
    source: github
    repositories:
      - org/repo-frontend
      - org/repo-backend
    branch: main

  leadTime:
    enabled: true
    pipelineIntegration: github-actions

  changeFailureRate:
    incidentSource: pagerduty
    deploymentSource: github
\`\`\`

\`\`\`promql
# DORA: Deployment Frequency (últimos 7 dias)
sum(increase(deployments_total{environment="production"}[7d]))

# DORA: Change Failure Rate
rate(deployments_total{status="failed"}[7d])
/ rate(deployments_total{environment="production"}[7d]) * 100

# DORA: MTTR (média de tempo de resolução de incidentes)
avg(incident_resolution_duration_seconds{severity!="low"})
\`\`\`

## Framework SPACE

SPACE é um framework mais abrangente que DORA, cobrindo 5 dimensões:

| Dimensão | Exemplos de Métricas |
|----------|---------------------|
| **S**atisfaction & wellbeing | Developer NPS, eNPS, burnout scores |
| **P**erformance | Qualidade das entregas, code review velocity |
| **A**ctivity | Commits, PRs, builds, deploy frequency |
| **C**ommunication & collaboration | PR review time, code ownership, team coupling |
| **E**fficiency & flow | Wait time, WIP items, flow efficiency |

## Platform Health Metrics

Além do DORA, plataformas internas precisam medir sua própria saúde:

\`\`\`promql
# Adoção da plataforma (namespaces usando o golden path vs total)
count(kube_namespace_labels{label_platform_version!=""})
/ count(kube_namespace_info) * 100

# Self-service success rate (requisições ao portal que tiveram sucesso)
rate(backstage_scaffold_task_completed_total[7d])
/ rate(backstage_scaffold_task_created_total[7d]) * 100

# Cognitive load: quantas ferramentas diferentes os devs precisam acessar por deploy
# (métrica qualitativa, coletada em pesquisa periódica)

# Tempo médio de onboarding de um novo dev até primeiro deploy
avg(time_to_first_deploy_seconds)
\`\`\`

### Developer Satisfaction Survey (periódica)

\`\`\`yaml
# Exemplo de perguntas do Developer Experience Survey (trimestral)
perguntas:
  - "Eu consigo fazer deploy sem precisar de ajuda de outra equipe? (1-5)"
  - "O tempo de build do meu projeto está aceitável? (1-5)"
  - "Eu sei onde encontrar a documentação de que preciso? (1-5)"
  - "A plataforma me ajuda a cumprir requisitos de segurança sem atrito? (1-5)"
  - "O que mais te frustra na plataforma hoje? (aberta)"
\`\`\`

## Erros Comuns em Platform Metrics

1. **Medir apenas atividade**: número de commits/PRs não indica produtividade — times com mais retrabalho têm mais commits.
2. **Gamificar métricas**: equipes que sabem que são medidas por deploy frequency começam a fazer deploys triviais.
3. **Ignorar métricas qualitativas**: DORA sem developer survey é incompleto — você pode ter alto deployment frequency com péssima experiência do desenvolvedor.
4. **Não definir baseline**: antes de melhorar, meça onde você está. Sem baseline, não há como provar melhoria.
`,

  quiz: [
    {
      question: 'Qual das 4 métricas DORA mede a estabilidade de um sistema (não a velocidade de entrega)?',
      options: [
        'Deployment Frequency e Lead Time for Changes',
        'Change Failure Rate e Time to Restore (MTTR)',
        'Lead Time for Changes e Time to Restore',
        'Deployment Frequency e Change Failure Rate'
      ],
      correct: 1,
      explanation: 'DORA divide as métricas em dois grupos: velocidade (Deployment Frequency, Lead Time for Changes) e estabilidade (Change Failure Rate, Time to Restore/MTTR). Times de elite conseguem ser rápidos E estáveis ao mesmo tempo — contrariando a crença de que velocidade e estabilidade são trade-offs.',
      reference: 'Tabela DORA Metrics — os primeiros dois medem throughput, os últimos dois medem estabilidade.'
    },
    {
      question: 'Um time tem Change Failure Rate de 25%. O que isso indica e qual é o nível DORA?',
      options: [
        '25% dos deploys falham; nível Elite (aceitável para frequência alta)',
        '25% dos deploys causam incidentes em produção; nível Low (abaixo de Medium que é 10-15%)',
        '25% das mudanças chegam com atraso; nível Medium',
        'O CFR de 25% está dentro do aceitável para times grandes'
      ],
      correct: 1,
      explanation: 'Change Failure Rate > 15% é classificado como nível Low no DORA. Significa que 1 em cada 4 deploys causa um incidente que requer hotfix ou rollback. Isso indica: falta de testes automatizados, sem canary/feature flags, ou processo de code review insuficiente. A meta para times Elite é < 5%.',
      reference: 'Tabela DORA Metrics — CFR ideal < 5% (Elite) ou 5-10% (High).'
    },
    {
      question: 'Por que medir apenas métricas de atividade (número de commits, PRs mergeados) é insuficiente para avaliar produtividade de desenvolvimento?',
      options: [
        'Porque commits e PRs não aparecem no JIRA automaticamente',
        'Porque times com muito retrabalho têm mais commits, mascarando baixa qualidade — atividade não é produtividade',
        'Porque métricas de atividade são facilmente manipuláveis apenas por gerentes',
        'Porque ferramentas de medição de commits são caras e difíceis de implementar'
      ],
      correct: 1,
      explanation: 'Métricas de atividade medem volume, não valor. Um time pode ter muitos commits porque está reescrevendo código com bugs, ou muitas PRs porque a granularidade é muito fina por imposição. O framework SPACE enfatiza que produtividade é multidimensional: satisfação + performance + atividade + comunicação + eficiência de fluxo.',
      reference: 'Seção Framework SPACE — atividade (A) é apenas uma das 5 dimensões.'
    }
  ],

  flashcards: [
    {
      front: 'Quais são as 4 métricas DORA e o que cada uma mede?',
      back: '1. **Deployment Frequency** — com que frequência deploy em produção (meta Elite: múltiplas vezes/dia)\n\n2. **Lead Time for Changes** — do commit até rodando em produção (meta Elite: < 1 hora)\n\n3. **Change Failure Rate** — % de deploys que causam incidente (meta Elite: < 5%)\n\n4. **Time to Restore (MTTR)** — tempo médio para recuperar de incidente (meta Elite: < 1 hora)\n\nVelocidade: DF + LT | Estabilidade: CFR + MTTR'
    },
    {
      front: 'Como medir o impacto de uma plataforma interna na experiência do desenvolvedor?',
      back: '**Métricas quantitativas**:\n- Time to first deploy (novo dev → primeiro deploy)\n- Self-service success rate (portal sem tickets manuais)\n- Platform adoption rate (times usando golden path)\n- Deployment frequency por time (melhorou após adotar plataforma?)\n\n**Métricas qualitativas**:\n- Developer NPS (Net Promoter Score)\n- Developer survey trimestral (1-5 por dimensão)\n- Support tickets abertos sobre a plataforma\n- Número de "workarounds" documentados\n\n**Regra**: combine quantitativo + qualitativo para ter o quadro completo.'
    }
  ],

  lab: {
    scenario: 'Criar um dashboard básico de DORA metrics usando métricas do cluster Kubernetes.',
    objective: 'Entender como medir Deployment Frequency e Change Failure Rate usando dados do próprio cluster.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Criar métricas de deployment com labels padronizados',
        instruction: 'Configure deployments com labels de versão para rastrear mudanças e falhas.',
        hints: ['Labels app.kubernetes.io/version rastreia versões', 'Annotation deployment-time para lead time'],
        solution: `\`\`\`bash
# Criar namespace de demo
kubectl create namespace dora-demo

# Deploy com labels padronizados DORA
cat << 'EOF' | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: webapp
  namespace: dora-demo
  labels:
    app: webapp
    app.kubernetes.io/version: "1.2.3"
    team: platform
  annotations:
    deployment.kubernetes.io/timestamp: "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    deployment.kubernetes.io/change-id: "pr-456"
spec:
  replicas: 2
  selector:
    matchLabels:
      app: webapp
  template:
    metadata:
      labels:
        app: webapp
        version: "1.2.3"
    spec:
      containers:
        - name: webapp
          image: nginx:alpine
EOF

echo "Deploy com DORA labels criado"
\`\`\``,
        verify: `\`\`\`bash
kubectl get deployment webapp -n dora-demo \
  -o jsonpath='{.metadata.labels}' | jq .
# Esperado: labels com app.kubernetes.io/version

kubectl get deployment webapp -n dora-demo \
  -o jsonpath='{.metadata.annotations}' | jq .
# Esperado: annotations com deployment timestamp
\`\`\``
      },
      {
        title: 'Simular deployment frequency e Change Failure Rate',
        instruction: 'Simule múltiplos deploys (bem-sucedidos e com falha) e calcule as métricas manualmente.',
        hints: ['kubectl rollout status com timeout detecta falha', 'Histórico com kubectl rollout history'],
        solution: `\`\`\`bash
# Simular 5 deploys (4 sucesso, 1 falha)
for version in 1.2.4 1.2.5 1.2.6; do
  echo "Deploying version $version..."
  kubectl set image deployment/webapp webapp=nginx:alpine \
    -n dora-demo && \
  kubectl rollout status deployment/webapp -n dora-demo --timeout=60s && \
  echo "Deploy $version: SUCCESS"
done

# Simular um deploy com falha (imagem inexistente)
kubectl set image deployment/webapp webapp=nginx:nonexistent-tag -n dora-demo
sleep 10
if ! kubectl rollout status deployment/webapp -n dora-demo --timeout=30s; then
  echo "Deploy FAILED - rolling back"
  kubectl rollout undo deployment/webapp -n dora-demo
fi

# Ver histórico de rollouts
kubectl rollout history deployment/webapp -n dora-demo

# Calcular Change Failure Rate manualmente
echo "Total deploys: 4 | Failed deploys: 1 | CFR: 25% (acima do ideal!)"

# Limpeza
kubectl delete namespace dora-demo
\`\`\``,
        verify: `\`\`\`bash
kubectl rollout history deployment/webapp -n dora-demo 2>/dev/null || \
  echo "Namespace limpo - verificar antes da deleção"
# Esperado: histórico com múltiplas revisões
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'DORA metrics mostram alta Deployment Frequency mas MTTR também alto',
      difficulty: 'medium',
      symptom: 'O time tem Deployment Frequency de 5x/dia (Elite) mas MTTR médio de 4 horas (Low). A liderança questiona se a velocidade está causando instabilidade.',
      diagnosis: `\`\`\`bash
# Correlacionar deploys com incidentes no Prometheus
# Verificar se incidentes ocorrem próximos a deploys
rate(deployments_total{environment="production"}[1h])
# vs
rate(incidents_created_total[1h])

# Verificar Change Failure Rate
rate(deployments_total{status="failed"}[30d])
/ rate(deployments_total[30d]) * 100
\`\`\``,
      solution: `**Diagnóstico**: alta frequência de deploy com alto MTTR geralmente indica:

1. **Deploys sem canary/feature flags**: cada deploy expõe 100% dos usuários imediatamente.

2. **Sem smoke tests automáticos pós-deploy**: falhas demoram a ser detectadas.

3. **Processo de rollback lento**: rollback manual que demora.

**Ações**:
1. Implementar canary deployment (expose 10% primeiro)
2. Adicionar smoke tests automáticos pós-deploy com rollback automático se falhar
3. Definir e testar runbook de rollback (meta: < 15 minutos)
4. Configurar alertas de error rate com threshold < 1% para trigger de rollback

**Meta**: manter alta frequência de deploy E melhorar MTTR para < 1 hora.`
    }
  ]
};
