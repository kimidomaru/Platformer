window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['aws-cloud-concepts/cloud-fundamentals'] = {
  theory: `# Cloud Computing Fundamentals

## Relevancia no Exame
> O dominio **Cloud Concepts** vale **24%** do CLF-C02. Este topico cobre a definicao de cloud computing, modelos de implantacao, beneficios e o AWS Well-Architected Framework.

## O que e Cloud Computing?

Cloud computing e a entrega sob demanda de recursos de TI pela internet com precificacao pay-as-you-go. Em vez de comprar, manter e operar datacenters fisicos, voce acessa servicos de tecnologia (compute, storage, databases) de um provedor de nuvem como a AWS.

### Caracteristicas Essenciais (NIST)

| Caracteristica | Descricao |
|----------------|-----------|
| **On-demand self-service** | Provisione recursos sem interacao humana com o provedor |
| **Broad network access** | Acesso via rede por mecanismos padrao (HTTP/HTTPS) |
| **Resource pooling** | Recursos compartilhados entre multiplos clientes (multi-tenant) |
| **Rapid elasticity** | Escale rapidamente para cima ou para baixo conforme demanda |
| **Measured service** | Uso monitorado e cobrado conforme consumo real |

## Modelos de Servico

### IaaS — Infrastructure as a Service
Fornece componentes basicos de TI na nuvem: networking, compute, storage. Maximo controle sobre os recursos.
- **Exemplo AWS**: Amazon EC2, Amazon VPC, Amazon EBS

### PaaS — Platform as a Service
Remove a necessidade de gerenciar infraestrutura subjacente. Foco em deploy e gerenciamento de aplicacoes.
- **Exemplo AWS**: AWS Elastic Beanstalk, AWS App Runner, Amazon RDS

### SaaS — Software as a Service
Produto completo executado e gerenciado pelo provedor. O usuario consome o software.
- **Exemplo AWS**: Amazon WorkSpaces, Amazon Chime, AWS Marketplace SaaS

## Modelos de Implantacao

### Cloud Publica
- Recursos compartilhados, acessados pela internet
- Sem investimento inicial em hardware
- Pay-as-you-go
- Exemplo: Rodar aplicacoes inteiramente na AWS

### Cloud Privada (On-Premises)
- Infraestrutura dedicada operada pela organizacao
- Controle total sobre seguranca e compliance
- Exemplo: VMware, OpenStack, AWS Outposts

### Cloud Hibrida
- Combina cloud publica com infraestrutura on-premises
- Conecta recursos locais a recursos na nuvem
- Exemplo: Manter dados sensiveis on-prem e burst para AWS

## Beneficios da Cloud Computing

### 1. Troca de CapEx por OpEx
Capital Expense (comprar servidores) vira Operational Expense (pagar pelo uso). Sem investimento inicial massivo.

### 2. Economia de Escala
A AWS agrega uso de milhares de clientes, conseguindo precos menores que voce conseguiria sozinho.

### 3. Pare de adivinhar capacidade
Sem necessidade de estimar demanda futura. Escale conforme necessario em minutos.

### 4. Aumente velocidade e agilidade
Novos recursos disponiveis em minutos em vez de semanas. Reduza o tempo de experimentacao.

### 5. Pare de gastar dinheiro com datacenters
Foque no negocio, nao na infraestrutura fisica.

### 6. Alcance global em minutos
Deploy em multiplas regioes ao redor do mundo com poucos cliques.

## AWS Well-Architected Framework

O framework define **6 pilares** para construir arquiteturas seguras, resilientes, eficientes e economicas:

| Pilar | Foco |
|-------|------|
| **Operational Excellence** | Automatizar operacoes, responder a eventos, melhorar processos |
| **Security** | Proteger dados, sistemas e ativos usando boas praticas de seguranca |
| **Reliability** | Recuperar de falhas, escalar para atender demanda |
| **Performance Efficiency** | Usar recursos de forma eficiente conforme demanda muda |
| **Cost Optimization** | Eliminar gastos desnecessarios |
| **Sustainability** | Minimizar impacto ambiental das cargas de trabalho |

### AWS Well-Architected Tool
Servico gratuito que ajuda a revisar suas arquiteturas contra as melhores praticas dos 6 pilares. Gera um relatorio com recomendacoes de melhoria.

## Erros Comuns no Exame

- Confundir IaaS com PaaS — EC2 e IaaS (voce gerencia o OS), Elastic Beanstalk e PaaS
- Achar que cloud hibrida = multi-cloud — hibrida e on-prem + cloud, multi-cloud e usar multiplos provedores
- Esquecer o pilar de Sustainability no Well-Architected (adicionado em 2021)
- Confundir CapEx vs OpEx — cloud e OpEx, datacenter proprio e CapEx
`,

  quiz: [
    {
      question: 'Qual das seguintes e uma caracteristica essencial de cloud computing segundo o NIST?',
      options: ['Precificacao fixa mensal', 'On-demand self-service', 'Hardware dedicado obrigatorio', 'Contratos de longo prazo'],
      correct: 1,
      explanation: 'On-demand self-service e uma das 5 caracteristicas essenciais do NIST: o usuario pode provisionar recursos sem interacao humana com o provedor.',
      reference: 'Conceito relacionado: NIST Definition of Cloud Computing'
    },
    {
      question: 'Amazon EC2 e um exemplo de qual modelo de servico?',
      options: ['SaaS', 'PaaS', 'IaaS', 'FaaS'],
      correct: 2,
      explanation: 'EC2 e IaaS — fornece maquinas virtuais onde voce gerencia o sistema operacional, patches e aplicacoes. A AWS gerencia a infraestrutura fisica.',
      reference: 'Diferenciar IaaS/PaaS/SaaS e frequente no CLF-C02.'
    },
    {
      question: 'Qual modelo de implantacao combina infraestrutura on-premises com recursos na nuvem?',
      options: ['Cloud publica', 'Cloud privada', 'Cloud hibrida', 'Multi-cloud'],
      correct: 2,
      explanation: 'Cloud hibrida conecta infraestrutura local (on-premises) com a nuvem publica, permitindo mover cargas de trabalho entre ambas.',
      reference: 'Nao confundir com multi-cloud (usar AWS + Azure, por exemplo).'
    },
    {
      question: 'Qual beneficio da cloud permite que voce evite adivinhacao sobre capacidade de infraestrutura?',
      options: ['Economia de escala', 'Elasticidade', 'Troca de CapEx por OpEx', 'Alcance global'],
      correct: 1,
      explanation: 'Elasticidade permite escalar para cima ou para baixo conforme a demanda real, eliminando a necessidade de estimar capacidade futura.',
      reference: 'Auto Scaling Groups sao o mecanismo primario de elasticidade no EC2.'
    },
    {
      question: 'Quantos pilares tem o AWS Well-Architected Framework?',
      options: ['4', '5', '6', '7'],
      correct: 2,
      explanation: 'O Well-Architected Framework tem 6 pilares: Operational Excellence, Security, Reliability, Performance Efficiency, Cost Optimization e Sustainability.',
      reference: 'O pilar Sustainability foi adicionado em 2021.'
    },
    {
      question: 'O que significa a mudanca de CapEx para OpEx na cloud?',
      options: ['Trocar licencas de software por open source', 'Trocar investimento inicial em hardware por pagamento conforme uso', 'Trocar servidores fisicos por containers', 'Trocar equipe propria por terceirizados'],
      correct: 1,
      explanation: 'CapEx e investimento antecipado em ativos fisicos. OpEx e pagamento pelo uso operacional. Cloud transforma custos de infraestrutura em despesas operacionais.',
      reference: 'Beneficio-chave testado com frequencia no CLF-C02.'
    },
    {
      question: 'AWS Elastic Beanstalk e um exemplo de qual modelo de servico?',
      options: ['IaaS', 'PaaS', 'SaaS', 'CaaS'],
      correct: 1,
      explanation: 'Elastic Beanstalk e PaaS — voce faz upload do codigo e o servico cuida do provisionamento, balanceamento de carga, auto scaling e monitoramento.',
      reference: 'Compare: EC2 (IaaS) vs Beanstalk (PaaS) vs Lambda (FaaS).'
    },
    {
      question: 'Qual pilar do Well-Architected Framework foca em minimizar o impacto ambiental?',
      options: ['Cost Optimization', 'Operational Excellence', 'Sustainability', 'Reliability'],
      correct: 2,
      explanation: 'Sustainability e o 6o pilar, adicionado em 2021, que foca em maximizar eficiencia e minimizar o impacto ambiental das cargas de trabalho.',
      reference: 'Pilar mais recente — pode aparecer como distrator se o candidato nao o conhece.'
    }
  ],

  flashcards: [
    { front: 'Quais sao os 3 modelos de servico de cloud computing?', back: 'IaaS (Infrastructure as a Service) — ex: EC2. PaaS (Platform as a Service) — ex: Elastic Beanstalk. SaaS (Software as a Service) — ex: Amazon WorkSpaces.' },
    { front: 'Quais sao os 3 modelos de implantacao de cloud?', back: 'Cloud publica (tudo na nuvem), cloud privada (on-premises dedicada) e cloud hibrida (combinacao de on-prem + nuvem publica).' },
    { front: 'Quais sao as 5 caracteristicas essenciais de cloud (NIST)?', back: 'On-demand self-service, broad network access, resource pooling (multi-tenant), rapid elasticity e measured service (pay-as-you-go).' },
    { front: 'Quais sao os 6 pilares do AWS Well-Architected Framework?', back: 'Operational Excellence, Security, Reliability, Performance Efficiency, Cost Optimization e Sustainability.' },
    { front: 'Qual a diferenca entre CapEx e OpEx?', back: 'CapEx (Capital Expenditure) = investimento antecipado em ativos (comprar servidores). OpEx (Operational Expenditure) = pagar pelo uso corrente (pay-as-you-go na cloud). Cloud transforma CapEx em OpEx.' },
    { front: 'O que e o AWS Well-Architected Tool?', back: 'Servico gratuito da AWS que ajuda a revisar arquiteturas contra as melhores praticas dos 6 pilares. Gera relatorios com recomendacoes de melhoria para suas workloads.' },
    { front: 'Qual a diferenca entre cloud hibrida e multi-cloud?', back: 'Hibrida = on-premises + cloud publica (um provedor). Multi-cloud = usar multiplos provedores de nuvem (AWS + Azure, por ex). Sao conceitos diferentes.' },
    { front: 'O que e "economia de escala" no contexto de cloud?', back: 'A AWS agrega o uso de milhares de clientes, obtendo custos unitarios menores. Esse beneficio e repassado como precos mais baixos do que manter infraestrutura propria.' }
  ],

  lab: {
    scenario: 'Neste lab conceitual, voce explorara o console AWS e identificara os modelos de servico em acao.',
    objective: 'Classificar servicos AWS por modelo (IaaS/PaaS/SaaS) e revisar o AWS Well-Architected Tool.',
    duration: '15-20 minutos',
    steps: [
      {
        title: 'Classificar Servicos AWS',
        instruction: 'Acesse o console AWS. Liste 3 servicos para cada modelo: IaaS, PaaS, SaaS. Dica: EC2, RDS, Elastic Beanstalk, Lambda, WorkSpaces, Lightsail.',
        hints: ['EC2 = IaaS (voce gerencia o OS)', 'Elastic Beanstalk = PaaS (upload code, AWS gerencia infra)', 'Lambda e FaaS, mas frequentemente categorizado como PaaS'],
        solution: '```\nIaaS: EC2, VPC, EBS\nPaaS: Elastic Beanstalk, RDS, App Runner\nSaaS: WorkSpaces, Chime, Connect\nFaaS (subset PaaS): Lambda\n```',
        verify: '```bash\n# No console AWS, acesse cada servico e verifique:\n# EC2 > Launch Instance — voce escolhe AMI e gerencia o OS = IaaS\n# Elastic Beanstalk > Create Application — upload code = PaaS\n# Resultado esperado: classificacao correta de pelo menos 6 servicos\n```'
      },
      {
        title: 'Explorar o Well-Architected Tool',
        instruction: 'No console AWS, navegue ate AWS Well-Architected Tool. Crie um workload de teste e responda as perguntas do pilar Security.',
        hints: ['Busque "Well-Architected" na barra de pesquisa do console', 'E gratuito — nao gera custos'],
        solution: '```\n1. Console AWS > Well-Architected Tool\n2. Create Workload > nome: "test-workload"\n3. Selecione o pilar "Security"\n4. Responda as perguntas (pode marcar "None of these")\n5. Revise o relatorio gerado com High/Medium risk items\n```',
        verify: '```bash\n# Verifique:\n# - Workload criado aparece na lista\n# - Relatorio mostra itens de risco\n# - Recomendacoes sao listadas por pilar\n# Resultado esperado: relatorio com improvement plan\n```'
      },
      {
        title: 'Identificar Beneficios na Pratica',
        instruction: 'Para cada beneficio de cloud, identifique qual servico/feature AWS o implementa: Elasticidade, Alcance Global, Pay-as-you-go.',
        hints: ['Auto Scaling = Elasticidade', 'Regions/AZs = Alcance Global', 'On-Demand pricing = Pay-as-you-go'],
        solution: '```\nElasticidade → Auto Scaling Groups + ELB\nAlcance Global → 30+ Regions, 90+ AZs, CloudFront edge locations\nPay-as-you-go → EC2 On-Demand, Lambda per-invocation, S3 per-GB\nCapEx→OpEx → Sem compra de hardware, pague pelo uso\nEconomia de Escala → Precos reduzidos conforme AWS cresce\n```',
        verify: '```bash\n# Verifique no console:\n# EC2 > Auto Scaling Groups — comprove elasticidade\n# Header do console > Region selector — veja as regioes disponiveis\n# Billing > Bills — veja cobranca por uso\n# Resultado esperado: mapeamento correto de 5 beneficios\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Confusao entre IaaS e PaaS',
      difficulty: 'easy',
      symptom: 'Candidato nao consegue classificar corretamente RDS — e IaaS ou PaaS?',
      diagnosis: '```\nPergunte-se: quem gerencia o OS?\n- EC2: VOCE gerencia o OS → IaaS\n- RDS: AWS gerencia o OS e o engine → PaaS\n- Mas RDS permite escolher engine e configurar parametros\n\nRegra pratica:\n- Se voce faz SSH no servidor → IaaS\n- Se voce NAO faz SSH → PaaS ou SaaS\n```',
      solution: 'RDS e PaaS — a AWS gerencia o OS, patching e backups. Voce escolhe o engine (MySQL, PostgreSQL) mas nao acessa o OS. DynamoDB e ainda mais "managed" (serverless). A chave e: quanto controle de infraestrutura voce TEM?'
    },
    {
      title: 'Confundir Well-Architected Pillars',
      difficulty: 'medium',
      symptom: 'Candidato confunde Reliability com Operational Excellence, ou esquece Sustainability.',
      diagnosis: '```\nMnemonico para os 6 pilares: SCORPS\n- S: Security\n- C: Cost Optimization\n- O: Operational Excellence\n- R: Reliability\n- P: Performance Efficiency\n- S: Sustainability\n\nDicas de diferenciacao:\n- Operational Excellence = processos, runbooks, IaC\n- Reliability = recuperacao de falhas, auto scaling\n- Performance Efficiency = usar o tipo certo de recurso\n```',
      solution: 'Memorize SCORPS. Reliability e sobre RECUPERAR de falhas (DR, multi-AZ). Operational Excellence e sobre OPERAR bem (automacao, IaC, CI/CD). Performance Efficiency e sobre ESCOLHER recursos certos. Cost Optimization e sobre NAO DESPERDICAR dinheiro.'
    }
  ]
};
