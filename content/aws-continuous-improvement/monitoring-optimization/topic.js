window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['aws-continuous-improvement/monitoring-optimization'] = {
  theory: `# Monitoramento, Logging e Otimizacao

## Relevancia no Exame
> **Continuous Improvement for Existing Solutions** vale **25%** do SAP-C02. CloudWatch avancado, rastreamento distribuido X-Ray, conformidade Config, Trusted Advisor e revisoes Well-Architected sao topicos centrais.

## Amazon CloudWatch Avancado

### Metricas e Monitoramento
- **Custom Metrics**: publique metricas de aplicacao via API ou CloudWatch Agent (EC2, on-prem)
- **EMF (Embedded Metric Format)**: escreva logs estruturados que extraem metricas automaticamente
- **Anomaly Detection**: limites dinamicos baseados em ML para alarmes (adapta-se a padroes)
- **Contributor Insights**: identifique os principais contribuidores para dados de alta cardinalidade
- **Metric Math**: calculos entre metricas (soma, taxa, percentil)
- **Cross-Account Observability**: agregue metricas/logs/traces entre contas da Organization

### CloudWatch Logs Insights
- Linguagem de query para CloudWatch Logs: parse JSON/texto, filtro, agregacao
- Visualize com dashboards ou exporte para S3

### Alarmes
- Padrao: limite de metrica unica
- Alarmes compostos: logica AND/OR de multiplos alarmes (reduz ruido)
- Tratamento de dados ausentes: 'breaching', 'notBreaching', 'ignore', 'missing'

## AWS X-Ray

Rastreamento distribuido para microsservicos:
- **Segments**: segmento de trace de um servico
- **Subsegments**: detalhe dentro de um segmento (chamadas downstream)
- **Service Map**: topologia visual de servicos e conexoes
- **Sampling**: controla porcentagem de requests rastreados (padrao 5% + 1/seg reservoir)
- **X-Ray Groups**: filtra traces por expressao, regras de sampling separadas
- **X-Ray Analytics**: agrega dados de trace para analise de percentil

### Integracao
- Lambda, EC2/ECS/EKS (via daemon), API Gateway, ALB, SNS, SQS
- SDK instrumentado: Java, Python, Node.js, Go, .NET, Ruby

## AWS Config

Rastreie configuracoes de recursos e conformidade:
- **Config Rules**: avalie recursos contra boas praticas
  - Regras gerenciadas: fornecidas pela AWS (mais de 300)
  - Regras customizadas: logica baseada em Lambda
- **Conformance Packs**: pacote de regras Config para frameworks (CIS, PCI DSS, HIPAA)
- **Remediation Actions**: auto-remedie via documentos SSM Automation
- **Aggregator multi-conta**: visao de conformidade nivel organizacao
- **Config Recorder**: registra mudancas de configuracao (pode filtrar tipos de recurso)

## AWS Trusted Advisor

Recomendacoes automatizadas de boas praticas:
- **5 Categorias**: Otimizacao de Custo, Performance, Seguranca, Tolerancia a Falhas, Limites de Servico
- **Suporte Business/Enterprise**: acesso completo (todas verificacoes); Basic/Developer: verificacoes limitadas
- **Trusted Advisor API**: acesso programatico (depende de nivel de suporte)
- **CloudWatch Events**: alerta quando status de verificacao muda

## AWS Compute Optimizer

Recomendacoes de right-sizing baseadas em ML:
- Instancias EC2, Auto Scaling groups, funcoes Lambda, volumes EBS, ECS no Fargate
- Recomendacoes: sobre-provisionado / sub-provisionado / otimizado
- Considera metricas de CPU, memoria, rede (ultimos 14 dias padrao, ate 3 meses)
- Requer CloudWatch Agent para metricas de memoria

## AWS Well-Architected Tool

Revisoes de arquitetura baseadas no framework:
- **Pilares**: Excelencia Operacional, Seguranca, Confiabilidade, Eficiencia de Performance, Otimizacao de Custo, Sustentabilidade
- **Lenses**: visoes especializadas (Serverless, SaaS, Analytics, etc.)
- **Milestones**: snapshot da arquitetura em pontos no tempo
- **Custom Lenses**: crie questoes de revisao especificas da organizacao

## Erros Comuns

- Usar alarmes CloudWatch padrao quando alarmes compostos reduziriam o ruido
- Nao usar Contributor Insights para identificacao de problemas de alta cardinalidade
- Esquecer conformance packs do Config para frameworks de compliance
- Nao saber que Compute Optimizer requer CloudWatch Agent para recomendacoes baseadas em memoria
- Confundir sampling X-Ray (reduzir dados) com filtragem (excluir da analise)
`,

  quiz: [
    {
      question: 'O que o Anomaly Detection do CloudWatch faz diferente de alarmes com limite padrao?',
      options: ['E mais barato', 'Usa ML para criar limites dinamicos que se adaptam a padroes de metricas (hora do dia, dia da semana)', 'Funciona apenas para metricas EC2', 'Requer configuracao manual de limites superior/inferior'],
      correct: 1,
      explanation: 'Anomaly Detection usa machine learning para modelar o comportamento esperado de metricas com base em padroes historicos. Ajusta-se automaticamente para sazonalidade diaria/semanal. Sem necessidade de configurar limites manualmente.',
      reference: 'Anomaly Detection = limites dinamicos ML. Alarmes padrao = limites fixos. Use para metricas imprevisíveis.'
    },
    {
      question: 'Qual e o objetivo do CloudWatch Contributor Insights?',
      options: ['Rastrear comportamento de usuarios', 'Identificar os N principais contribuidores causando alto trafego/erros em dados de log de alta cardinalidade', 'Alertar sobre anomalias de metricas', 'Rastrear latencia de API'],
      correct: 1,
      explanation: 'Contributor Insights analisa dados de log para identificar os N principais contribuidores para um padrao. Exemplo: top 10 IPs causando erros 5xx, ou top 10 usuarios consumindo mais requests de API.',
      reference: 'Contributor Insights = top N contribuidores em dados de alta cardinalidade. Funciona com CloudWatch Logs.'
    },
    {
      question: 'Para que serve o sampling do AWS X-Ray?',
      options: ['Filtrar traces ruidosos', 'Controlar a porcentagem de requests rastreados para reduzir custos e volume de dados', 'Criptografar dados de trace', 'Amostrar metricas de CPU'],
      correct: 1,
      explanation: 'Sampling X-Ray: por padrao rastre 5% das requisicoes mais 1 por segundo (reservoir). Regras de sampling customizadas permitem taxas diferentes por servico/URL/metodo. Reduz custos de armazenamento mantendo visibilidade.',
      reference: 'Sampling = reduzir requests rastreados. Regras customizadas = taxas diferentes por servico. Padrao = 5% + 1/seg reservoir.'
    },
    {
      question: 'Qual a diferenca entre Config Rule e Conformance Pack?',
      options: ['Sao iguais', 'Config Rule = verificacao de conformidade individual; Conformance Pack = colecao de regras para um framework de compliance (CIS, PCI DSS)', 'Conformance Pack custa mais', 'Config Rules podem auto-remediar; Conformance Packs nao'],
      correct: 1,
      explanation: 'Config Rule: verificacao de conformidade de recurso unico. Conformance Pack: colecao de regras Config e acoes de remediacao empacotadas para frameworks de compliance. Pode ser implantado em toda a Organization.',
      reference: 'Config Rule = verificacao individual. Conformance Pack = pacote framework (CIS, PCI, HIPAA). Deploy na Org facilmente.'
    },
    {
      question: 'Qual fonte de dados adicional o Compute Optimizer requer para recomendacoes de memoria do Lambda e EC2?',
      options: ['Traces X-Ray', 'CloudWatch Agent (para metricas de memoria, nao disponivel por padrao)', 'Dados do Cost Explorer', 'Regras Config'],
      correct: 1,
      explanation: 'Compute Optimizer analisa CPU e rede por padrao. Utilizacao de memoria requer CloudWatch Agent instalado e configurado para publicar metricas de memoria. Sem ele, recomendacoes baseadas em memoria nao estao disponiveis.',
      reference: 'Compute Optimizer + memoria = CloudWatch Agent necessario. CPU/rede disponiveis por padrao.'
    },
    {
      question: 'O que e um alarme composto do CloudWatch?',
      options: ['Um alarme que monitora metricas compostas', 'Um alarme que combina multiplos alarmes com logica AND/OR para reduzir ruido de notificacoes', 'Um alarme para multiplas regioes', 'Um alarme para multiplas contas'],
      correct: 1,
      explanation: 'Alarmes compostos: avaliam o estado de multiplos outros alarmes usando logica AND/OR. Reduz ruido (alerta apenas quando multiplas condicoes estao simultaneamente em estado ALARM). Nao pode monitorar metricas diretamente.',
      reference: 'Alarme Composto = AND/OR de outros alarmes. Reduz ruido. Nao pode avaliar metricas diretamente (apenas estados de alarme).'
    },
    {
      question: 'O que o Trusted Advisor verifica na categoria Seguranca?',
      options: ['Apenas problemas IAM', 'Security groups com portas abertas, permissoes de bucket S3, MFA no root, access keys expostas, CloudTrail habilitado', 'Apenas configuracoes de criptografia', 'Apenas seguranca de rede'],
      correct: 1,
      explanation: 'Verificacoes de seguranca do Trusted Advisor incluem: Security Groups (portas irrestritas), permissoes de bucket S3, MFA no root, access keys expostas, status do CloudTrail, uso de IAM e mais. Acesso completo requer suporte Business/Enterprise.',
      reference: 'Trusted Advisor Seguranca = SGs, permissoes S3, MFA root, keys expostas, CloudTrail. Acesso completo = Business/Enterprise.'
    },
    {
      question: 'O que e o Embedded Metric Format (EMF) do CloudWatch?',
      options: ['Um formato de log JSON que o CloudWatch extrai automaticamente como metricas customizadas — sem chamadas PutMetricData separadas', 'Um formato de dashboard CloudWatch', 'Um formato de compressao de log', 'Um formato de namespace de metricas'],
      correct: 0,
      explanation: 'EMF: escreva logs JSON estruturados com um schema especifico. CloudWatch extrai automaticamente os valores numericos como metricas customizadas. Elimina chamadas separadas para PutMetricData. Funciona com Lambda, ECS, EC2.',
      reference: 'EMF = logs estruturados extraidos automaticamente como metricas. Sem PutMetricData necessario. Para Lambda e containers.'
    }
  ],

  flashcards: [
    { front: 'Features avancadas CloudWatch?', back: 'Custom Metrics (API/Agent). EMF (log estruturado -> metrica automatica). Anomaly Detection (limites ML). Contributor Insights (top N contribuidores). Alarmes Compostos (logica AND/OR). Cross-Account Observability. Metric Math.' },
    { front: 'Conceitos X-Ray?', back: 'Segments: request de um servico. Subsegments: chamadas downstream. Service Map: topologia visual. Sampling: padrao 5%+1/seg reservoir. Groups: filtro por expressao. Analytics: percentis agregados. Daemon: coleta e envia.' },
    { front: 'Features AWS Config?', back: 'Config Rules: gerenciadas (300+) ou customizadas (Lambda). Conformance Packs: pacotes de regras para CIS/PCI/HIPAA. Remediation: SSM Automation. Aggregator multi-conta. Recorder: rastreia mudancas de configuracao.' },
    { front: 'Categorias Trusted Advisor?', back: 'Otimizacao de Custo (recursos nao usados). Performance (tipos de instancia, CloudFront). Seguranca (SGs, S3, MFA, keys). Tolerancia a Falhas (backups, Multi-AZ). Limites de Servico. Business/Enterprise = acesso completo.' },
    { front: 'Compute Optimizer?', back: 'Right-sizing ML para EC2, ASG, Lambda, EBS, ECS Fargate. Status: Sobre-provisionado/Sub-provisionado/Otimizado. Padrao 14 dias (ate 3 meses). Memoria requer CloudWatch Agent. Nivel gratuito disponivel.' },
    { front: 'Pilares Well-Architected?', back: '6 pilares: Excelencia Operacional, Seguranca, Confiabilidade, Eficiencia de Performance, Otimizacao de Custo, Sustentabilidade. Lenses: Serverless, SaaS, Analytics, etc. Milestones: snapshot ao longo do tempo.' },
    { front: 'CloudWatch Contributor Insights?', back: 'Identifica os N principais contribuidores para padroes em dados de log (alta cardinalidade). Exemplo: top 10 IPs causando erros, top clientes consumindo requests. Funciona com CloudWatch Logs. Analise baseada em regras.' },
    { front: 'X-Ray vs CloudWatch?', back: 'X-Ray: rastreamento distribuido, fluxo de request entre servicos, breakdown de latencia, service map. CloudWatch: metricas/logs/alarmes, monitoramento de recursos. Use ambos: X-Ray para nivel de request, CloudWatch para nivel de sistema.' }
  ],

  lab: {
    scenario: 'Implemente monitoramento abrangente para uma aplicacao de microsservicos.',
    objective: 'Praticar metricas customizadas CloudWatch, rastreamento X-Ray e regras de conformidade Config.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Criar Metrica Customizada CloudWatch e Alarme',
        instruction: 'Publique uma metrica de negocio customizada (contagem de pedidos) e crie um alarme composto combinando-a com um alarme de taxa de erro.',
        hints: ['Metricas customizadas requerem PutMetricData ou CloudWatch Agent', 'Alarmes compostos usam ARNs de alarmes, nao metricas'],
        solution: '```bash\n# Publicar metrica customizada\naws cloudwatch put-metric-data \\\n  --namespace "MinhaApp/Pedidos" \\\n  --metric-name "ContagemPedidos" \\\n  --value 150 \\\n  --unit Count \\\n  --dimensions Servico=ServicoPedidos\n\n# Criar alarme na metrica customizada\naws cloudwatch put-metric-alarm \\\n  --alarm-name "AltoVolumePedidos" \\\n  --namespace "MinhaApp/Pedidos" \\\n  --metric-name "ContagemPedidos" \\\n  --threshold 1000 \\\n  --comparison-operator GreaterThanThreshold \\\n  --evaluation-periods 1 --period 300 \\\n  --statistic Sum\n\n# Criar alarme composto\naws cloudwatch put-composite-alarm \\\n  --alarm-name "AppDegradado" \\\n  --alarm-rule "ALARM(AltaTaxaErro) AND ALARM(AltaLatencia)"\n```',
        verify: '```bash\naws cloudwatch list-metrics --namespace "MinhaApp/Pedidos"\n# Esperado: metrica ContagemPedidos no namespace MinhaApp/Pedidos\n\naws cloudwatch describe-alarms --alarm-names AppDegradado\n# Esperado: alarme composto com regra AND\n```'
      },
      {
        title: 'Habilitar Rastreamento X-Ray para Lambda',
        instruction: 'Habilite rastreamento ativo X-Ray numa funcao Lambda e verifique se os traces aparecem no Service Map.',
        hints: ['X-Ray modo active rastre todas as requisicoes; PassThrough respeita sampling', 'Lambda precisa da politica AWSXRayDaemonWriteAccess'],
        solution: '```bash\n# Habilitar rastreamento X-Ray no Lambda\naws lambda update-function-configuration \\\n  --function-name ProcessadorPedidos \\\n  --tracing-config Mode=Active\n\n# Invocar funcao para gerar traces\naws lambda invoke \\\n  --function-name ProcessadorPedidos \\\n  --payload \'{"pedidoId":"teste-123"}\' \\\n  /tmp/resposta.json\n\n# Obter resumos de trace X-Ray\naws xray get-trace-summaries \\\n  --start-time $(date -d "5 minutes ago" +%s) \\\n  --end-time $(date +%s)\n```',
        verify: '```bash\naws lambda get-function-configuration \\\n  --function-name ProcessadorPedidos \\\n  --query "TracingConfig"\n# Esperado: {"Mode": "Active"}\n\naws xray get-service-graph \\\n  --start-time $(date -d "10 minutes ago" +%s) \\\n  --end-time $(date +%s)\n# Esperado: nos para funcao Lambda e chamadas downstream\n```'
      },
      {
        title: 'Criar Config Rule para Criptografia S3',
        instruction: 'Crie uma regra Config para verificar que todos os buckets S3 tem criptografia server-side habilitada e configure auto-remediacao.',
        hints: ['Use regra gerenciada s3-bucket-server-side-encryption-enabled', 'Remediacao usa documentos SSM Automation'],
        solution: '```bash\n# Criar regra Config\naws configservice put-config-rule --config-rule \'{\n  "ConfigRuleName": "s3-bucket-criptografia",\n  "Source": {\n    "Owner": "AWS",\n    "SourceIdentifier": "S3_BUCKET_SERVER_SIDE_ENCRYPTION_ENABLED"\n  }\n}\'\n\n# Adicionar acao de remediacao\naws configservice put-remediation-configurations --remediation-configurations \'[{\n  "ConfigRuleName": "s3-bucket-criptografia",\n  "TargetType": "SSM_DOCUMENT",\n  "TargetId": "AWSConfigRemediation-EnableS3BucketEncryption",\n  "Parameters": {\n    "AutomationAssumeRole": {"StaticValue":{"Values":["arn:aws:iam::CONTA:role/RoleRemediacao"]}},\n    "BucketName": {"ResourceValue":{"Value":"RESOURCE_ID"}}\n  },\n  "Automatic": true,\n  "MaximumAutomaticAttempts": 3\n}]\'\n```',
        verify: '```bash\naws configservice describe-config-rules \\\n  --config-rule-names s3-bucket-criptografia\n# Esperado: regra ACTIVE\n\naws configservice get-compliance-details-by-config-rule \\\n  --config-rule-name s3-bucket-criptografia\n# Esperado: lista de recursos COMPLIANT/NON_COMPLIANT\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Alarme CloudWatch Nao Disparando Apesar da Metrica Exceder o Limite',
      difficulty: 'medium',
      symptom: 'Alarme CloudWatch permanece em estado OK mesmo que valores de metricas claramente excedam o limite configurado.',
      diagnosis: '```\nChecklist de avaliacao de alarme:\n1. Tratamento de dados ausentes:\n   Se metrica nao publicada = dados ausentes\n   Padrao: tratar como ausente (nao breaching)\n   Verificar: aws cloudwatch describe-alarms --alarm-names ALARME\n   Campo: TreatMissingData\n\n2. Periodo de avaliacao vs periodo:\n   Alarme avalia N periodos consecutivos\n   Se metrica publicada com pouca frequencia, lacunas causam perdas\n   Exemplo: EvaluationPeriods=3, Period=60 = 3 minutos de dados necessarios\n\n3. Resolucao de metrica:\n   Metricas de alta resolucao: 1/5/10/30 segundos\n   Padrao: minimo 60 segundos\n   Periodo do alarme deve corresponder a resolucao da metrica\n\n4. Incompatibilidade namespace/dimensao:\n   Metrica do alarme deve corresponder exatamente a metrica publicada\n   Verificar: aws cloudwatch list-metrics --namespace NAMESPACE\n\n5. Alarme em estado INSUFFICIENT_DATA:\n   Pontos de dados insuficientes para avaliar\n```',
      solution: 'Verifique configuracao TreatMissingData (defina como breaching se lacunas devem disparar). Verifique que namespace e dimensoes da metrica correspondem exatamente. Garanta que metrica e publicada no periodo esperado. Para metricas de alta frequencia, use alarmes de alta resolucao. Verifique historico do alarme no console do CloudWatch para detalhes de avaliacao.'
    },
    {
      title: 'Traces X-Ray Ausentes para Alguns Servicos',
      difficulty: 'hard',
      symptom: 'X-Ray Service Map mostra alguns servicos mas dependencias downstream importantes estao ausentes. Traces estao incompletos.',
      diagnosis: '```\nChecklist de completude de trace X-Ray:\n1. SDK nao instrumentado:\n   Servico deve usar SDK X-Ray ou daemon\n   Verificar: SDK X-Ray esta incluido na aplicacao?\n\n2. Permissoes IAM:\n   Role do servico precisa de xray:PutTraceSegments, xray:PutTelemetryRecords\n   Lambda: use politica gerenciada AWSXRayDaemonWriteAccess\n\n3. Regras de sampling:\n   Se taxa de sampling = 0% para aquele servico, nenhum trace capturado\n   Verificar: aws xray get-sampling-rules\n\n4. Rastreamento Active vs PassThrough:\n   Lambda: PassThrough = rastreia apenas se upstream enviou header\n   Active = rastreia todas as requisicoes\n\n5. Propagacao de contexto ausente:\n   Servicos HTTP: verificar header X-Amzn-Trace-Id propagado\n   SQS: rastreamento X-Ray para SQS precisa de propagacao explicita\n\n6. Daemon X-Ray nao rodando:\n   ECS: container sidecar daemon esta rodando?\n   EC2: processo daemon esta rodando?\n```',
      solution: 'Instrumente todos os servicos com SDK X-Ray. Verifique que roles IAM tem permissao xray:PutTraceSegments. Verifique que regras de sampling nao estao excluindo servicos. Habilite rastreamento Active (nao PassThrough) para Lambda. Verifique propagacao de header de trace entre fronteiras de servico. Para ECS, confirme que container sidecar X-Ray daemon esta configurado.'
    }
  ]
};
