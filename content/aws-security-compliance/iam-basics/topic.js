window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['aws-security-compliance/iam-basics'] = {
  theory: `# IAM Fundamentals

## Relevancia no Exame
> O dominio **Security and Compliance** vale **30%** do CLF-C02 — o mais pesado! IAM e o servico mais importante da AWS e aparece em quase todas as questoes de seguranca.

## O que e IAM?

**AWS Identity and Access Management (IAM)** e o servico que controla QUEM pode acessar O QUE na sua conta AWS. E global — nao pertence a nenhuma Region especifica.

### Caracteristicas Fundamentais
- **Gratuito** — sem custos adicionais
- **Global** — usuarios e roles funcionam em todas as Regions
- **Granular** — controle detalhado por acao, recurso e condicao
- **Seguro por padrao** — novos usuarios nao tem NENHUMA permissao

## Componentes do IAM

### Root Account
- Criada automaticamente com a conta AWS
- Tem acesso TOTAL e IRRESTRITO a todos os recursos
- **NUNCA use para tarefas do dia-a-dia**
- Proteja com MFA imediatamente
- Use apenas para: criar primeiro usuario IAM, mudar plano de suporte, fechar conta

### Users (Usuarios)
- Representam uma pessoa ou aplicacao
- Tem credenciais (senha para console, access keys para CLI/API)
- Principio: **uma pessoa = um usuario IAM**
- Novos usuarios nao tem permissoes (implicit deny)

### Groups (Grupos)
- Colecao de usuarios IAM
- Aplicam policies a multiplos usuarios de uma vez
- Exemplo: grupo "Developers", grupo "Admins"
- Um usuario pode pertencer a multiplos grupos
- **Grupos NAO podem conter outros grupos**

### Policies (Politicas)
- Documentos JSON que definem permissoes
- Podem ser anexadas a Users, Groups ou Roles
- Tipos: AWS Managed, Customer Managed, Inline

\`\`\`json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::my-bucket/*"
    }
  ]
}
\`\`\`

### Roles (Funcoes)
- Identidade com permissoes temporarias
- NAO tem credenciais permanentes (sem senha ou access keys)
- Assumidas por: servicos AWS, usuarios, contas externas
- Casos de uso comuns:
  - EC2 instance assumindo role para acessar S3
  - Lambda function assumindo role para acessar DynamoDB
  - Cross-account access

## MFA — Multi-Factor Authentication

MFA adiciona uma camada extra de seguranca alem da senha:

| Tipo MFA | Descricao |
|----------|-----------|
| **Virtual MFA** | App no celular (Google Authenticator, Authy) |
| **Hardware MFA** | Dispositivo fisico (YubiKey, Gemalto) |
| **U2F Security Key** | Chave USB (YubiKey U2F) |

**Recomendacao**: Habilite MFA na root account E em todos os usuarios IAM.

## Boas Praticas IAM

1. **Nunca use a root account** para tarefas diarias
2. **Habilite MFA** na root account e em todos os usuarios
3. **Least privilege** — conceda apenas permissoes necessarias
4. **Use Groups** para atribuir permissoes (nao diretamente em usuarios)
5. **Use Roles** para servicos AWS (nunca access keys em EC2)
6. **Rotacione credenciais** regularmente
7. **Use IAM Access Analyzer** para identificar permissoes excessivas
8. **Crie password policy** forte (comprimento minimo, complexidade, rotacao)

## IAM Access Analyzer

Servico que analisa policies e identifica recursos compartilhados com entidades externas. Ajuda a encontrar permissoes excessivas e acessos nao intencionais.

## Credential Report e Access Advisor

- **Credential Report**: relatorio de todos os usuarios e status das credenciais (account-level)
- **Access Advisor**: mostra as permissoes concedidas a um usuario e quando foram usadas pela ultima vez (user-level)

## Erros Comuns

- Usar root account para tarefas diarias
- Nao habilitar MFA na root account
- Conceder permissoes diretamente em usuarios em vez de grupos
- Usar access keys em EC2 em vez de IAM Roles
- Nao seguir principio de least privilege
`,

  quiz: [
    {
      question: 'Qual e a melhor pratica para proteger a root account?',
      options: ['Deletar a root account', 'Habilitar MFA e nao usar para tarefas diarias', 'Compartilhar as credenciais com a equipe', 'Usar apenas para deploy de aplicacoes'],
      correct: 1,
      explanation: 'A root account nao pode ser deletada. A melhor pratica e habilitar MFA imediatamente e criar usuarios IAM para tarefas diarias. A root account deve ser usada apenas para tarefas que exigem root.',
      reference: 'Tarefas que exigem root: criar primeiro usuario IAM, mudar plano de suporte.'
    },
    {
      question: 'Qual componente IAM permite conceder permissoes temporarias a servicos AWS?',
      options: ['IAM User', 'IAM Group', 'IAM Role', 'IAM Policy'],
      correct: 2,
      explanation: 'IAM Roles fornecem credenciais temporarias. Sao ideais para servicos AWS (EC2 acessando S3) pois nao tem credenciais permanentes.',
      reference: 'Roles sao preferidas sobre access keys para servicos AWS.'
    },
    {
      question: 'IAM Groups podem conter outros groups?',
      options: ['Sim, ate 3 niveis de aninhamento', 'Sim, sem limite', 'Nao, groups so contem users', 'Sim, se forem da mesma conta'],
      correct: 2,
      explanation: 'IAM Groups podem conter apenas IAM Users. Groups NAO podem conter outros groups (nao ha aninhamento).',
      reference: 'Limitacao frequente no exame: groups sao planos, sem hierarquia.'
    },
    {
      question: 'Qual principio de seguranca define que usuarios devem ter apenas as permissoes necessarias?',
      options: ['Defense in depth', 'Least privilege', 'Zero trust', 'Separation of duties'],
      correct: 1,
      explanation: 'Least privilege (privilegio minimo) e o principio de conceder apenas as permissoes necessarias para realizar uma tarefa, nada mais.',
      reference: 'Aplica-se a users, groups e roles. Use Access Advisor para revisar.'
    },
    {
      question: 'Como um EC2 instance deve acessar outros servicos AWS (ex: S3)?',
      options: ['Access keys hardcoded no codigo', 'Access keys em variaveis de ambiente', 'IAM Role anexada ao instance', 'Credenciais da root account'],
      correct: 2,
      explanation: 'IAM Roles sao a forma segura de conceder permissoes a EC2. As credenciais sao temporarias e rotacionadas automaticamente. Nunca use access keys em EC2.',
      reference: 'Instance Profile e o wrapper que anexa a Role ao EC2.'
    },
    {
      question: 'Qual ferramenta IAM mostra quando as permissoes de um usuario foram usadas pela ultima vez?',
      options: ['Credential Report', 'IAM Access Advisor', 'IAM Access Analyzer', 'CloudTrail'],
      correct: 1,
      explanation: 'IAM Access Advisor mostra as permissoes concedidas e quando foram usadas por ultimo (user-level). Credential Report mostra status de credenciais de todos os usuarios (account-level).',
      reference: 'Use Access Advisor para implementar least privilege — remova permissoes nao usadas.'
    },
    {
      question: 'Qual e o comportamento padrao de um novo usuario IAM recem-criado?',
      options: ['Acesso total a todos os servicos', 'Acesso somente leitura', 'Nenhuma permissao (implicit deny)', 'Acesso apenas ao console'],
      correct: 2,
      explanation: 'Novos usuarios IAM nao tem NENHUMA permissao por padrao (implicit deny). Todas as permissoes devem ser explicitamente concedidas via policies.',
      reference: 'Principio de IAM: tudo e negado ate ser explicitamente permitido.'
    },
    {
      question: 'Qual tipo de MFA e um aplicativo no celular como Google Authenticator?',
      options: ['Hardware MFA', 'Virtual MFA device', 'U2F Security Key', 'SMS MFA'],
      correct: 1,
      explanation: 'Virtual MFA usa apps como Google Authenticator ou Authy no celular para gerar codigos TOTP (Time-based One-Time Password).',
      reference: 'AWS recomenda Virtual MFA para usuarios e Hardware MFA key para root account.'
    }
  ],

  flashcards: [
    { front: 'Quais sao os 4 componentes principais do IAM?', back: 'Users (pessoas/apps), Groups (colecao de users), Roles (permissoes temporarias para servicos) e Policies (documentos JSON com permissoes). IAM e global e gratuito.' },
    { front: 'O que e a root account e como protege-la?', back: 'Conta criada com a conta AWS, tem acesso total irrestrito. Protecao: habilitar MFA imediatamente, nunca usar para tarefas diarias, criar usuarios IAM para uso cotidiano.' },
    { front: 'Qual a diferenca entre IAM User e IAM Role?', back: 'User: identidade com credenciais permanentes (senha, access keys), representa uma pessoa. Role: identidade com credenciais temporarias, sem credenciais fixas, assumida por servicos/usuarios.' },
    { front: 'O que e o principio de Least Privilege?', back: 'Conceder apenas as permissoes necessarias para realizar uma tarefa, nada mais. Aplicar a users, groups e roles. Use IAM Access Advisor para revisar permissoes nao usadas.' },
    { front: 'Qual a diferenca entre Credential Report e Access Advisor?', back: 'Credential Report: relatorio account-level com status de credenciais de TODOS os usuarios. Access Advisor: user-level, mostra permissoes concedidas e quando foram usadas por ultimo.' },
    { front: 'Quais sao os tipos de IAM Policies?', back: 'AWS Managed (criadas pela AWS, ex: AdministratorAccess). Customer Managed (criadas por voce, reutilizaveis). Inline (embutidas diretamente em um user/group/role, nao reutilizaveis).' },
    { front: 'Por que usar IAM Roles em vez de access keys em EC2?', back: 'Roles fornecem credenciais temporarias e rotacionadas automaticamente. Access keys sao permanentes e podem vazar. Instance Profile anexa a Role ao EC2 automaticamente.' },
    { front: 'Quais sao as boas praticas de IAM?', back: 'Nunca usar root para tarefas diarias, MFA em tudo, least privilege, usar groups para permissoes, roles para servicos AWS, rotacionar credenciais, password policy forte.' }
  ],

  lab: {
    scenario: 'Voce precisa configurar IAM de forma segura para uma equipe de desenvolvimento.',
    objective: 'Criar usuarios, grupos e politicas IAM seguindo boas praticas.',
    duration: '15-20 minutos',
    steps: [
      {
        title: 'Criar Grupo e Usuarios IAM',
        instruction: 'Crie um grupo "Developers" e 2 usuarios IAM. Anexe a policy AmazonS3ReadOnlyAccess ao grupo.',
        hints: ['IAM > User Groups > Create group', 'Selecione a policy managed pela AWS'],
        solution: '```bash\n# Criar grupo\naws iam create-group --group-name Developers\n\n# Anexar policy ao grupo\naws iam attach-group-policy --group-name Developers \\\n  --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess\n\n# Criar usuarios\naws iam create-user --user-name dev-user-1\naws iam create-user --user-name dev-user-2\n\n# Adicionar usuarios ao grupo\naws iam add-user-to-group --group-name Developers --user-name dev-user-1\naws iam add-user-to-group --group-name Developers --user-name dev-user-2\n```',
        verify: '```bash\n# Verificar grupo e membros\naws iam get-group --group-name Developers\n# Saida esperada: GroupName: Developers, 2 users listados\n\n# Verificar policies do grupo\naws iam list-attached-group-policies --group-name Developers\n# Saida esperada: AmazonS3ReadOnlyAccess\n```'
      },
      {
        title: 'Criar IAM Role para EC2',
        instruction: 'Crie uma IAM Role que permita EC2 instances acessarem S3. Use a trust policy para EC2.',
        hints: ['A trust policy define QUEM pode assumir a role', 'O servico EC2 e ec2.amazonaws.com'],
        solution: '```bash\n# Criar trust policy (quem pode assumir)\ncat > trust-policy.json << EOF\n{\n  "Version": "2012-10-17",\n  "Statement": [\n    {\n      "Effect": "Allow",\n      "Principal": { "Service": "ec2.amazonaws.com" },\n      "Action": "sts:AssumeRole"\n    }\n  ]\n}\nEOF\n\n# Criar role\naws iam create-role --role-name EC2-S3-Role \\\n  --assume-role-policy-document file://trust-policy.json\n\n# Anexar policy de acesso S3\naws iam attach-role-policy --role-name EC2-S3-Role \\\n  --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess\n```',
        verify: '```bash\n# Verificar role\naws iam get-role --role-name EC2-S3-Role\n# Saida esperada: RoleName: EC2-S3-Role, trust policy com ec2.amazonaws.com\n\n# Verificar policies da role\naws iam list-attached-role-policies --role-name EC2-S3-Role\n# Saida esperada: AmazonS3ReadOnlyAccess\n```'
      },
      {
        title: 'Gerar Credential Report',
        instruction: 'Gere e analise o Credential Report da conta. Identifique usuarios sem MFA habilitado.',
        hints: ['IAM > Credential Report > Download', 'O report e um CSV com colunas de status'],
        solution: '```bash\n# Gerar report\naws iam generate-credential-report\n\n# Download report (base64)\naws iam get-credential-report --output text --query Content | base64 --decode > report.csv\n\n# Analisar (procurar mfa_active = false)\ncat report.csv | head -5\n```',
        verify: '```bash\n# Verificar conteudo do report\n# Colunas importantes: user, mfa_active, access_key_1_active\n# Saida esperada: CSV com todos os usuarios da conta\n# Identifique linhas com mfa_active=false\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Access Denied apesar de Policy Allow',
      difficulty: 'medium',
      symptom: 'Usuario tem policy com Allow mas recebe Access Denied ao acessar recurso.',
      diagnosis: '```\nVerificar ordem de avaliacao de policies:\n1. Explicit Deny (em qualquer policy) -> SEMPRE nega\n2. SCP (Organizations) -> pode restringir\n3. Resource-based policy -> permite ou nega\n4. Identity-based policy -> Allow\n5. Permissions boundary -> pode restringir\n6. Session policy -> pode restringir\n\nSe QUALQUER policy tem Deny explicito, o acesso e negado\nmesmo se outra policy tem Allow.\n```',
      solution: 'Verifique se existe um Deny explicito em QUALQUER policy anexada. Explicit Deny SEMPRE vence Allow. Use IAM Policy Simulator para testar. Verifique tambem SCPs se usar AWS Organizations.'
    },
    {
      title: 'Confundir Role com User na prova',
      difficulty: 'easy',
      symptom: 'Candidato sugere criar access keys para EC2 acessar S3 em vez de usar Role.',
      diagnosis: '```\nAccess Keys em EC2 (ERRADO):\n- Credenciais permanentes\n- Podem vazar se instancia comprometida\n- Precisam ser rotacionadas manualmente\n- Hardcoded no codigo ou env vars\n\nIAM Role em EC2 (CORRETO):\n- Credenciais temporarias (STS)\n- Rotacao automatica (a cada ~1h)\n- Sem credenciais no disco/codigo\n- Revogaveis instantaneamente\n```',
      solution: 'Sempre use IAM Roles para servicos AWS. Roles usam STS (Security Token Service) para gerar credenciais temporarias que expiram automaticamente. Access keys sao para acesso programatico de PESSOAS (CLI), nunca de servicos.'
    }
  ]
};
