window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['az104-identity/entra-id'] = {
  theory: `# Microsoft Entra ID (Azure Active Directory)

## Relevância no Exame
> Domínio com **15-20% do peso** no AZ-104. Toda questão de autenticação, usuários, grupos e licenças passa por aqui. Praticamente obrigatório acertar.

## Conceitos Fundamentais

### O que é o Microsoft Entra ID?
O **Microsoft Entra ID** (antigo Azure Active Directory / Azure AD) é o serviço de **identidade e acesso baseado em nuvem** da Microsoft. Ele gerencia:
- Usuários e grupos
- Autenticação e autorização
- Single Sign-On (SSO) para apps SaaS
- Acesso condicional e MFA
- Sincronização com Active Directory on-premises (via Entra ID Connect)

### Tenant (Inquilino)
Um **tenant** é uma instância dedicada e isolada do Entra ID que uma organização recebe ao se registrar nos serviços Microsoft Cloud. Cada tenant tem um domínio padrão \`<nome>.onmicrosoft.com\`.

- Uma organização = um tenant (geralmente)
- Um tenant pode ter múltiplas **subscriptions** Azure
- Identidades vivem no tenant, não na subscription

### Tipos de Identidade

| Tipo | Descrição |
|------|-----------|
| **Member user** | Usuário nativo do tenant (criado no Entra ID) |
| **Guest user** | Usuário externo convidado via B2B (e-mail externo) |
| **Service Principal** | Identidade de aplicação/serviço |
| **Managed Identity** | Service principal gerenciado automaticamente pelo Azure |

### Licenças do Entra ID

| Plano | Recursos-chave |
|-------|----------------|
| **Free** | Usuários básicos, SSO, MFA básico |
| **P1** | Acesso Condicional, Grupos Dinâmicos, SSPR, Hybrid join |
| **P2** | PIM (Privileged Identity Management), Identity Protection, Access Reviews |

### Grupos

**Tipos de associação:**
- **Assigned**: membros adicionados manualmente
- **Dynamic User**: regra baseada em atributos do usuário (\`department eq "IT"\`)
- **Dynamic Device**: regra baseada em atributos do dispositivo

**Tipos de grupo:**
- **Security Group**: para controle de acesso a recursos
- **Microsoft 365 Group**: colaboração (Teams, SharePoint, Exchange)

### Multi-Factor Authentication (MFA)
- Configurado via **Conditional Access** (P1/P2) ou **Security Defaults** (free)
- Métodos: Authenticator App, TOTP, SMS, chamada telefônica, FIDO2 key
- **Per-user MFA** (legado): habilitar por usuário individualmente
- **Security Defaults**: habilita MFA para todos, bloqueia protocolos legados

### Self-Service Password Reset (SSPR)
Requer licença **P1** ou superior. Permite usuários resetarem senha sem helpdesk. Configura-se número de métodos de autenticação exigidos (1 ou 2).

### Entra ID Connect (Sync on-prem → cloud)
Sincroniza usuários/grupos do Active Directory local para o Entra ID:
- **Password Hash Sync (PHS)**: hash da senha sincronizado (mais simples, recomendado)
- **Pass-through Authentication (PTA)**: autenticação validada on-premises em tempo real
- **Federation (AD FS)**: autenticação delegada ao AD FS local

## Comandos Essenciais (Azure CLI)

\`\`\`bash
# Login no Azure
az login

# Listar usuários do Entra ID
az ad user list --output table

# Criar usuário
az ad user create \\
  --display-name "João Silva" \\
  --user-principal-name joao.silva@contoso.onmicrosoft.com \\
  --password "P@ssword123!" \\
  --force-change-password-next-sign-in true

# Atualizar atributos do usuário
az ad user update \\
  --id joao.silva@contoso.onmicrosoft.com \\
  --department "Engenharia" \\
  --job-title "SRE"

# Deletar usuário (vai para lixeira por 30 dias)
az ad user delete --id joao.silva@contoso.onmicrosoft.com

# Listar grupos
az ad group list --output table

# Criar grupo de segurança
az ad group create \\
  --display-name "DevOps-Team" \\
  --mail-nickname "devops-team"

# Adicionar membro ao grupo
az ad group member add \\
  --group "DevOps-Team" \\
  --member-id <object-id-do-usuario>

# Verificar membros do grupo
az ad group member list --group "DevOps-Team" --output table

# Listar service principals
az ad sp list --display-name "minha-app" --output table

# Criar service principal (app registration)
az ad sp create-for-rbac --name "minha-app-sp" --skip-assignment

# Listar guest users (tipo B2B)
az ad user list --filter "userType eq 'Guest'" --output table
\`\`\`

## Exemplos de Configuração

### Grupo Dinâmico via Portal
\`\`\`
Entra ID → Groups → New Group
Group type: Security
Membership type: Dynamic User
Dynamic query:
  Property: department
  Operator: Equals
  Value: Engineering
\`\`\`

### Conditional Access Policy (requer P1)
\`\`\`
Entra ID → Security → Conditional Access → New Policy
Name: Require MFA for Admins
Assignments:
  Users: Directory Roles → Global Administrator
  Cloud apps: All cloud apps
Conditions: (sem condições = sempre)
Grant: Grant access → Require multi-factor authentication
\`\`\`

## Erros Comuns

1. **Grupo dinâmico sem licença P1**: grupos dinâmicos exigem Entra ID P1
2. **Guest user não consegue acessar**: verificar External Collaboration Settings e políticas de acesso B2B
3. **Usuário deletado**: fica na lixeira por **30 dias** — recuperável via "Deleted users"
4. **SSPR não funciona**: verificar se licença P1 está atribuída e SSPR está habilitado
5. **Sincronização falha**: usuário criado no on-premises não aparece no cloud — verificar Entra ID Connect e atributos obrigatórios

## Killer.sh Style Challenge

> **Cenário**: A empresa tem 500 usuários no Active Directory on-premises. O departamento de TI precisa:
> 1. Sincronizar usuários para o Entra ID usando Password Hash Sync
> 2. Criar um grupo de segurança dinâmico que inclua automaticamente todos com \`department = "Finance"\`
> 3. Exigir MFA para todos os usuários do grupo Finance ao acessar o portal Azure
> 4. Configurar SSPR para que usuários possam redefinir senhas com 2 métodos de verificação
>
> **Quais licenças são necessárias? Quais passos e em que ordem?**
>
> **Resposta esperada**: Licença Entra ID P1 para grupos dinâmicos, SSPR e Conditional Access. Ordem: instalar Entra ID Connect com PHS → criar grupo dinâmico Finance → criar Conditional Access policy (target: Finance group, grant: require MFA) → habilitar SSPR com número mínimo de métodos = 2.
`,

  quiz: [
    {
      question: 'Qual é a diferença entre um "Member user" e um "Guest user" no Microsoft Entra ID?',
      options: [
        'Member users são internos ao tenant; Guest users são externos convidados via B2B',
        'Member users têm acesso apenas a aplicações; Guest users têm acesso administrativo',
        'Member users são sincronizados do AD local; Guest users são criados no portal Azure',
        'Não há diferença prática, apenas nomenclatura diferente'
      ],
      correct: 0,
      explanation: 'Member users são identidades nativas do tenant (criadas no Entra ID ou sincronizadas via Connect). Guest users são identidades externas convidadas via Azure AD B2B — eles mantêm sua própria identidade de origem e recebem acesso limitado ao tenant.',
      reference: 'Conceito relacionado: Azure RBAC — veja como permissões diferem entre Members e Guests.'
    },
    {
      question: 'Uma empresa quer que todos os usuários do departamento "Finance" sejam automaticamente adicionados a um grupo de segurança. Qual tipo de grupo deve ser criado?',
      options: [
        'Security Group com associação Assigned',
        'Security Group com associação Dynamic User',
        'Microsoft 365 Group com associação Dynamic User',
        'Security Group com associação Dynamic Device'
      ],
      correct: 1,
      explanation: 'Um Security Group com Dynamic User membership permite criar regras baseadas em atributos de usuário (como department eq "Finance"). Isso adiciona e remove automaticamente usuários conforme os atributos mudam. Requer licença Entra ID P1.',
      reference: 'Grupos dinâmicos exigem licença P1 — revise a tabela de licenças na seção de teoria.'
    },
    {
      question: 'Qual licença do Entra ID é necessária para usar Conditional Access Policies?',
      options: [
        'Free',
        'Microsoft 365 Basic',
        'Entra ID P1',
        'Entra ID P2'
      ],
      correct: 2,
      explanation: 'Conditional Access Policies requerem Entra ID P1 (ou superior). A versão Free oferece apenas Security Defaults, que são menos granulares. P2 adiciona Identity Protection e PIM, mas Conditional Access já está disponível no P1.',
      reference: 'Revise a tabela de licenças: Free vs P1 vs P2 e os recursos de cada plano.'
    },
    {
      question: 'Um usuário foi deletado do Entra ID por engano. Por quanto tempo ele pode ser recuperado da lixeira?',
      options: [
        '7 dias',
        '14 dias',
        '30 dias',
        '90 dias'
      ],
      correct: 2,
      explanation: 'Usuários deletados ficam na "lixeira" do Entra ID por 30 dias. Após esse período, são permanentemente removidos e não podem ser recuperados. Durante os 30 dias, é possível restaurar via "Deleted users" no portal ou via Azure CLI/PowerShell.',
      reference: 'Importante para o exame: sempre 30 dias para soft delete no Entra ID.'
    },
    {
      question: 'Qual método de sincronização do Entra ID Connect é recomendado pela Microsoft e não requer infraestrutura adicional on-premises para validar autenticações?',
      options: [
        'Pass-through Authentication (PTA)',
        'Federation com AD FS',
        'Password Hash Sync (PHS)',
        'Certificate-based Authentication (CBA)'
      ],
      correct: 2,
      explanation: 'Password Hash Sync (PHS) é o método recomendado pela Microsoft por ser mais simples, resiliente e não depender de infraestrutura on-premises em tempo real. O hash da senha é sincronizado para o Entra ID, então a autenticação acontece na nuvem mesmo se a conexão com on-premises cair.',
      reference: 'PTA valida no on-premises (requer agentes funcionando); AD FS é mais complexo. PHS é o mais simples e resiliente.'
    },
    {
      question: 'O que é uma Managed Identity no contexto do Azure?',
      options: [
        'Uma conta de usuário gerenciada pelo helpdesk de TI',
        'Um Service Principal cuja credencial é gerenciada automaticamente pelo Azure, sem necessidade de segredos manuais',
        'Um grupo do Entra ID com permissões administrativas',
        'Uma identidade federada de um provedor externo como Google ou GitHub'
      ],
      correct: 1,
      explanation: 'Managed Identities são Service Principals especiais onde o Azure gerencia automaticamente o ciclo de vida das credenciais (certificados/segredos). Usadas para que VMs, App Services, Functions etc. se autentiquem em outros serviços Azure sem armazenar segredos no código. Existem dois tipos: System-assigned (vive com o recurso) e User-assigned (reutilizável entre recursos).',
      reference: 'Managed Identities são fundamentais para o padrão de segurança "zero secrets" — revise Azure RBAC para ver como conceder acesso.'
    },
    {
      question: 'Qual é a principal diferença entre "Security Defaults" e "Conditional Access" para habilitar MFA?',
      options: [
        'Security Defaults exige P1; Conditional Access é gratuito',
        'Security Defaults é uma política granular por usuário; Conditional Access é para todos',
        'Security Defaults aplica MFA para todos sem granularidade; Conditional Access permite regras por usuário, app, localização e dispositivo',
        'Não há diferença, são nomes diferentes para o mesmo recurso'
      ],
      correct: 2,
      explanation: 'Security Defaults (gratuito) aplica um conjunto fixo de políticas de segurança para todos os usuários, incluindo MFA obrigatório para admins. Conditional Access (requer P1) permite criar políticas granulares: exigir MFA apenas para certos usuários, apps, localizações ou condições específicas. Não podem coexistir — ao criar uma Conditional Access Policy, Security Defaults deve ser desabilitado.',
      reference: 'Pegadinha do exame: Security Defaults e Conditional Access são mutuamente exclusivos — não pode ter os dois habilitados.'
    },
    {
      question: 'Uma organização precisa que funcionários do departamento de TI possam redefinir suas próprias senhas sem acionar o helpdesk. Qual recurso deve ser habilitado e qual licença é necessária?',
      options: [
        'Password Writeback — requer Entra ID Free',
        'Self-Service Password Reset (SSPR) — requer Entra ID P1',
        'Multi-Factor Authentication — requer Entra ID P2',
        'Privileged Identity Management — requer Entra ID P2'
      ],
      correct: 1,
      explanation: 'Self-Service Password Reset (SSPR) permite que usuários redefinam suas próprias senhas usando métodos de verificação configurados (email alternativo, telefone, app Authenticator, etc.). Requer licença Entra ID P1. Para sincronizar a senha de volta ao AD on-premises (Password Writeback), também é necessário configurar o Entra ID Connect.',
      reference: 'SSPR vs PIM: SSPR é para usuários comuns resetarem senha (P1); PIM é para gerenciar acesso privilegiado temporário (P2).'
    }
  ],

  flashcards: [
    {
      front: 'O que é um Tenant no Microsoft Entra ID?',
      back: 'Uma instância dedicada e isolada do Entra ID que uma organização recebe ao se registrar nos serviços Microsoft Cloud. Identificado por um domínio padrão \`<nome>.onmicrosoft.com\`. Uma organização geralmente tem um tenant, que pode conter múltiplas subscriptions Azure.'
    },
    {
      front: 'Quais são os 3 métodos de sincronização do Entra ID Connect?',
      back: '1. **Password Hash Sync (PHS)** — hash da senha sincronizado para o cloud (recomendado, mais resiliente)\n2. **Pass-through Authentication (PTA)** — autenticação validada no on-premises em tempo real\n3. **Federation (AD FS)** — autenticação delegada ao AD FS local (mais complexo)'
    },
    {
      front: 'Qual licença do Entra ID é necessária para cada recurso? (Grupos Dinâmicos / Conditional Access / PIM)',
      back: '- **Grupos Dinâmicos** → P1\n- **Conditional Access** → P1\n- **SSPR** → P1\n- **Hybrid Azure AD Join** → P1\n- **PIM** (Privileged Identity Management) → P2\n- **Identity Protection** → P2\n- **Access Reviews** → P2'
    },
    {
      front: 'Qual é a diferença entre System-Assigned e User-Assigned Managed Identity?',
      back: '- **System-Assigned**: vinculada a um recurso específico, é deletada quando o recurso é deletado. Não pode ser compartilhada.\n- **User-Assigned**: recurso independente, pode ser atribuída a múltiplos recursos Azure. Continua existindo quando os recursos que a usam são deletados.'
    },
    {
      front: 'Por quanto tempo um usuário deletado fica na lixeira do Entra ID?',
      back: '**30 dias**. Após esse período é permanentemente removido. Durante os 30 dias pode ser restaurado via portal Azure (Entra ID → Deleted users) ou via \`az ad user restore\`.'
    },
    {
      front: 'Qual é a diferença entre Security Defaults e Conditional Access para MFA?',
      back: '- **Security Defaults** (gratuito): aplica MFA para todos, sem granularidade, bloqueia protocolos legados\n- **Conditional Access** (P1): políticas granulares por usuário/grupo/app/localização/dispositivo\n- **Importante**: são mutuamente exclusivos — não podem coexistir no mesmo tenant'
    },
    {
      front: 'O que são External Collaboration Settings no Entra ID?',
      back: 'Configurações que controlam como Guest users (B2B) podem ser convidados para o tenant. Incluem:\n- Quem pode convidar guests (admins, members, guests, ninguém)\n- Restrições de domínio (allow/deny list)\n- Nível de acesso que guests têm ao diretório\nLocalização: Entra ID → External Identities → External Collaboration Settings'
    },
    {
      front: 'Qual comando Azure CLI cria um usuário no Entra ID?',
      back: '``\`bash\naz ad user create \\\n  --display-name "João Silva" \\\n  --user-principal-name joao@contoso.onmicrosoft.com \\\n  --password "P@ssword123!" \\\n  --force-change-password-next-sign-in true\n\```'
    }
  ],

  lab: {
    scenario: 'A startup TechNova precisa estruturar suas identidades no Azure. Você vai criar usuários, organizar grupos e validar políticas de acesso no Microsoft Entra ID.',
    objective: 'Criar e gerenciar usuários, grupos estáticos e dinâmicos, e validar configurações de segurança básica no Entra ID via Azure CLI.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Criar usuários no Entra ID',
        instruction: `Crie dois usuários para a empresa TechNova:
- **ana.devops** — DevOps Engineer, departamento "Engineering"
- **carlos.fin** — Financial Analyst, departamento "Finance"

Use a Azure CLI com os parâmetros de departamento corretos.`,
        hints: [
          'Use \`az ad user create\` com flags \`--display-name\`, \`--user-principal-name\`, \`--password\`',
          'Após criar, use \`az ad user update --id <upn> --department "Engineering"\` para definir o departamento',
          'O UPN deve ser no formato usuario@<seu-tenant>.onmicrosoft.com'
        ],
        solution: `\`\`\`bash
# Verificar domínio padrão do tenant
az account show --query tenantId -o tsv
az ad signed-in-user show --query userPrincipalName -o tsv

# Criar usuário de DevOps
az ad user create \\
  --display-name "Ana DevOps" \\
  --user-principal-name ana.devops@contoso.onmicrosoft.com \\
  --password "P@ssword123!" \\
  --force-change-password-next-sign-in false

# Atualizar departamento
az ad user update \\
  --id ana.devops@contoso.onmicrosoft.com \\
  --department "Engineering" \\
  --job-title "DevOps Engineer"

# Criar usuário de Finance
az ad user create \\
  --display-name "Carlos Finance" \\
  --user-principal-name carlos.fin@contoso.onmicrosoft.com \\
  --password "P@ssword123!" \\
  --force-change-password-next-sign-in false

az ad user update \\
  --id carlos.fin@contoso.onmicrosoft.com \\
  --department "Finance" \\
  --job-title "Financial Analyst"
\`\`\``,
        verify: `\`\`\`bash
# Verificar os dois usuários foram criados
az ad user list --filter "startswith(displayName,'Ana')" --query "[].{Name:displayName,UPN:userPrincipalName,Dept:department}" -o table
az ad user list --filter "startswith(displayName,'Carlos')" --query "[].{Name:displayName,UPN:userPrincipalName,Dept:department}" -o table

# Saída esperada para ana.devops:
# Name         UPN                                    Dept
# -----------  -------------------------------------  -----------
# Ana DevOps   ana.devops@contoso.onmicrosoft.com     Engineering

# Saída esperada para carlos.fin:
# Name            UPN                                  Dept
# --------------  -----------------------------------  -------
# Carlos Finance  carlos.fin@contoso.onmicrosoft.com   Finance
\`\`\``
      },
      {
        title: 'Criar grupo de segurança estático para Engineering',
        instruction: `Crie um grupo de segurança chamado **"Engineering-Team"** e adicione a Ana como membro. Este grupo será usado para controle de acesso a recursos Azure.`,
        hints: [
          'Use \`az ad group create\` para criar o grupo',
          'Use \`az ad group member add\` com o \`--member-id\` do Object ID do usuário',
          'Para obter o Object ID: \`az ad user show --id <upn> --query id -o tsv\`'
        ],
        solution: `\`\`\`bash
# Criar grupo de segurança
az ad group create \\
  --display-name "Engineering-Team" \\
  --mail-nickname "engineering-team" \\
  --description "Equipe de Engenharia da TechNova"

# Obter Object ID da Ana
ANA_ID=$(az ad user show --id ana.devops@contoso.onmicrosoft.com --query id -o tsv)
echo "Object ID da Ana: $ANA_ID"

# Adicionar Ana ao grupo
az ad group member add \\
  --group "Engineering-Team" \\
  --member-id $ANA_ID
\`\`\``,
        verify: `\`\`\`bash
# Verificar grupo criado
az ad group show --group "Engineering-Team" --query "{Name:displayName,ID:id}" -o table

# Verificar membros do grupo
az ad group member list --group "Engineering-Team" \\
  --query "[].{Name:displayName,UPN:userPrincipalName}" -o table

# Saída esperada:
# Name         UPN
# -----------  -------------------------------------
# Ana DevOps   ana.devops@contoso.onmicrosoft.com
\`\`\``
      },
      {
        title: 'Listar e filtrar usuários por atributo',
        instruction: `Use filtros OData para listar todos os usuários do departamento "Finance" — demonstrando como grupos dinâmicos funcionariam na prática. Depois verifique as propriedades completas do usuário carlos.fin.`,
        hints: [
          'Filtro OData: \`--filter "department eq \'Finance\'"\` ',
          'Use \`--query\` para selecionar campos específicos',
          '\`az ad user show\` retorna todos os atributos de um usuário específico'
        ],
        solution: `\`\`\`bash
# Listar todos usuários do departamento Finance
az ad user list \\
  --filter "department eq 'Finance'" \\
  --query "[].{Nome:displayName,UPN:userPrincipalName,Dept:department,Cargo:jobTitle}" \\
  -o table

# Ver detalhes completos do carlos.fin
az ad user show --id carlos.fin@contoso.onmicrosoft.com \\
  --query "{Nome:displayName,UPN:userPrincipalName,Dept:department,Tipo:userType,Conta:accountEnabled}" \\
  -o json

# Simular query de grupo dinâmico — ver quantos seriam incluídos
echo "Usuários que entrariam no grupo dinâmico Finance:"
az ad user list --filter "department eq 'Finance'" --query "length(@)" -o tsv
\`\`\``,
        verify: `\`\`\`bash
# Verificar que o filtro retorna carlos.fin
az ad user list --filter "department eq 'Finance'" --query "[].userPrincipalName" -o tsv
# Saída esperada:
# carlos.fin@contoso.onmicrosoft.com

# Verificar que Engineering retorna ana.devops
az ad user list --filter "department eq 'Engineering'" --query "[].userPrincipalName" -o tsv
# Saída esperada:
# ana.devops@contoso.onmicrosoft.com
\`\`\``
      },
      {
        title: 'Limpeza dos recursos criados',
        instruction: `Remova os usuários e grupo criados durante o lab para não deixar lixo no tenant.`,
        hints: [
          'Deletar usuários primeiro, depois o grupo',
          'Usuários deletados ficam na lixeira por 30 dias'
        ],
        solution: `\`\`\`bash
# Remover membros do grupo (opcional, o grupo será deletado)
ANA_ID=$(az ad user show --id ana.devops@contoso.onmicrosoft.com --query id -o tsv)
az ad group member remove --group "Engineering-Team" --member-id $ANA_ID

# Deletar grupo
az ad group delete --group "Engineering-Team"

# Deletar usuários (ficam na lixeira por 30 dias)
az ad user delete --id ana.devops@contoso.onmicrosoft.com
az ad user delete --id carlos.fin@contoso.onmicrosoft.com

echo "Limpeza concluída!"
\`\`\``,
        verify: `\`\`\`bash
# Verificar grupo foi removido
az ad group list --display-name "Engineering-Team" --query "length(@)" -o tsv
# Saída esperada: 0

# Verificar usuários aparecem em Deleted Users (soft delete)
az ad user list --filter "startswith(displayName,'Ana')" --query "[].displayName" -o tsv
# Saída esperada: (vazio — o usuário não aparece mais na lista ativa)
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Usuário não consegue redefinir própria senha (SSPR)',
      difficulty: 'easy',
      symptom: 'Usuários reclamam que ao clicar em "Forgot my password" no login recebem a mensagem: "Your administrator has not enabled this feature for your account".',
      diagnosis: `\`\`\`bash
# Verificar se SSPR está habilitado e para quais usuários
# (No portal: Entra ID → Password reset → Properties)

# Via PowerShell/Graph API — verificar configuração
az rest --method GET \\
  --url "https://graph.microsoft.com/v1.0/policies/authenticationMethodsPolicy" \\
  --query "registrationEnforcement"

# Verificar se o usuário tem licença adequada
az ad user show --id usuario@contoso.onmicrosoft.com \\
  --query "assignedLicenses"
\`\`\``,
      solution: `**Causas e soluções:**

1. **SSPR não habilitado**: No portal Azure → Entra ID → Password reset → Properties → Enabled: selecionar "All" ou "Selected" (grupo específico)

2. **Usuário não está no grupo SSPR**: Se SSPR está em "Selected", adicionar o usuário ao grupo configurado

3. **Sem licença P1**: SSPR exige Entra ID P1. Verificar Entra ID → Licenses → Assigned licenses → atribuir P1/P2 ao usuário

4. **Usuário sem métodos de autenticação registrados**: Mesmo com SSPR habilitado, o usuário precisa ter registrado pelo menos um método (email alternativo, telefone, app Authenticator). Instruir o usuário a acessar \`aka.ms/ssprsetup\` para registrar métodos.`
    },
    {
      title: 'Guest user (B2B) não consegue acessar recursos após convite aceito',
      difficulty: 'medium',
      symptom: 'Um parceiro externo aceita o convite B2B mas ao tentar acessar um Storage Account ou App recebe "Access Denied" ou "You don\'t have permission to view this page".',
      diagnosis: `\`\`\`bash
# Verificar se o guest user existe no tenant
az ad user list --filter "userType eq 'Guest'" \\
  --query "[].{Nome:displayName,UPN:userPrincipalName,Status:accountEnabled}" -o table

# Verificar o Object ID do guest
az ad user show --id guest@externaldomain.com#EXT#@contoso.onmicrosoft.com \\
  --query "{ID:id,UPN:userPrincipalName,Tipo:userType}" -o json

# Verificar atribuições de RBAC para o guest
az role assignment list --assignee <object-id-do-guest> --all -o table
\`\`\``,
      solution: `**Causas e soluções:**

1. **Falta de RBAC assignment**: O guest precisa de uma Role Assignment no recurso. Adicionar via:
   \`\`\`bash
   az role assignment create \\
     --assignee <object-id-do-guest> \\
     --role "Storage Blob Data Reader" \\
     --scope /subscriptions/<sub-id>/resourceGroups/<rg>/providers/Microsoft.Storage/storageAccounts/<sa>
   \`\`\`

2. **External Collaboration Settings muito restritivas**: Verificar Entra ID → External Identities → External Collaboration Settings. Pode estar bloqueando acesso ao diretório.

3. **Conditional Access bloqueando guests**: Se existe uma Conditional Access Policy que exige dispositivo compliant ou joined, guests externos não passam nessa condição. Criar uma política exclusiva para guests ou excluir guests da política problemática.

4. **UPN do guest em formato especial**: O UPN de um guest é \`email#EXT#@dominio.onmicrosoft.com\` — usar o Object ID como assignee é mais seguro que o UPN.`
    }
  ]
};
