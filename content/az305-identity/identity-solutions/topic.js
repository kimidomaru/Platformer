window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['az305-identity/identity-solutions'] = {
  theory: `# Design de Soluções de Identidade (AZ-305)

## Relevância no Exame
> Peso estimado **25-30%** no AZ-305. O exame avalia capacidade de **projetar** soluções de identidade — não apenas configurar, mas escolher a arquitetura certa para requisitos complexos.

## Conceitos Fundamentais

### Princípios de Design de Identidade

**Zero Trust Identity Model:**
- **Verificar explicitamente**: autenticar e autorizar sempre, baseado em todos os dados disponíveis
- **Usar menor privilégio**: JIT (Just-in-Time) e JEA (Just Enough Access)
- **Assumir violação**: minimizar blast radius, segmentar acesso

**Camadas de identidade:**
\`\`\`
Tenant/Directory (Entra ID)
  ├─ Usuários e Grupos
  ├─ Applications (App Registrations)
  ├─ Managed Identities
  ├─ Conditional Access (políticas de acesso)
  └─ Privileged Identity Management (PIM)
\`\`\`

### Privileged Identity Management (PIM)
Gerencia acesso privilegiado Just-in-Time:
- Usuários **ativam** roles quando precisam (ex: Global Admin por 1 hora)
- Aprovação por outro admin pode ser exigida
- MFA obrigatório na ativação
- Auditoria completa de quando/por que acessos foram ativados
- Requer **Entra ID P2**

**PIM vs RBAC direto:**

| Cenário | Usar |
|---------|------|
| Desenvolvedor precisa de Contributor sempre | RBAC direto |
| DBA precisa de acesso DB apenas durante incidentes | PIM |
| Security audit 1x/mês precisa de Reader | PIM (JIT) |

### Identidade Híbrida
Para organizações com AD on-premises + Azure:

| Método | Como funciona | Melhor quando |
|--------|--------------|--------------|
| **Password Hash Sync (PHS)** | Hash de senha replicado para Azure | Mais simples, sem dependência on-prem |
| **Pass-through Auth (PTA)** | Auth validada on-prem em tempo real | Compliance exige senha nunca no cloud |
| **Federation (AD FS)** | Token de auth do AD FS | Customização avançada, SSO complexo |

**Entra ID Connect Health**: monitora a sincronização e alertas de problemas.

### Multi-tenant Architecture
Cenários com múltiplos tenants:
- **B2B (Business-to-Business)**: parceiros externos usam identidade deles no seu tenant (Guest users)
- **B2C (Business-to-Consumer)**: clientes externos criam conta customizada (Entra External ID / Azure AD B2C)
- **Multi-tenant App**: aplicação registrada em um tenant pode ser usada por usuários de outros tenants

### External Identities (B2B vs B2C)

| | B2B | B2C |
|-|-----|-----|
| Usuário | Parceiros/funcionários externos | Clientes/consumidores finais |
| Identidade | Mantém própria identidade (Google, Microsoft, empresa) | Cria conta no seu tenant |
| Escala | Dezenas a milhares | Milhões |
| Customização | Limitada | Alta (branded flows, custom policies) |
| Licença | Entra ID (primeiros 50k MAU gratuitos) | Entra External ID (MAU-based) |

### Conditional Access — Design Avançado
Políticas que controlam quando/como usuários acessam recursos:

**Sinais avaliados:**
- Usuário/Grupo/Role
- Aplicação
- Localização (IP, país)
- Dispositivo (compliant, Hybrid AD Joined)
- Risco de sign-in (Identity Protection, P2)
- Real-time risk score

**Padrões de design:**

\`\`\`
Política 1: MFA para acesso de locais não-confiáveis
  IF: location NOT IN trusted IPs
  THEN: require MFA

Política 2: Bloquear países de alto risco
  IF: location = [KP, IR, ...]
  THEN: block

Política 3: Acesso admin = dispositivo compliant + MFA
  IF: user role = Global Admin
  THEN: require compliant device + MFA
\`\`\`

### App Registration vs Enterprise Application
- **App Registration**: definição da aplicação (como ela se autentica, quais permissões tem)
- **Enterprise Application**: instância da app no tenant (onde você configura acesso de usuários)
- App multi-tenant: um App Registration, múltiplas Enterprise Applications em diferentes tenants

## Design Patterns — Casos de Uso

### Padrão 1: Acesso Seguro para DevOps
\`\`\`
Developers → Entra ID → PIM para Contributor em Prod
                      → RBAC direto Contributor em Dev/Test
                      → Conditional Access: MFA + Compliant Device para Prod
\`\`\`

### Padrão 2: Hybrid Identity
\`\`\`
On-prem AD → Entra ID Connect (PHS) → Entra ID
               ↓                         ↓
         Sync usuários/grupos        Conditional Access
                                     App registrations
                                     SSO para SaaS
\`\`\`

### Padrão 3: External Partner Access
\`\`\`
Partner tenant → B2B invite → Guest em seu tenant
                              → RBAC limitado em recursos específicos
                              → Conditional Access: MFA obrigatório para guests
                              → Access Reviews trimestrais (P2)
\`\`\`

## Erros Comuns de Design

1. **RBAC direto para acesso privilegiado**: usar RBAC permanente para Global Admin/Contributor em Prod — o correto é PIM JIT.
2. **Sem Conditional Access para guests**: B2B sem Conditional Access pode deixar contas externas sem MFA.
3. **PHS quando compliance proíbe hash na nuvem**: usar PTA ou Federation se o compliance exige que senhas nunca saiam do datacenter.
4. **Aplicação usando service principal com secret**: secrets expiram e são difíceis de gerenciar — usar Managed Identity ou certificate-based auth.

## Killer.sh Style Challenge (AZ-305 Style)

> **Cenário de Design**: Uma empresa de serviços financeiros tem 2.000 funcionários no AD on-premises e precisa migrar para cloud híbrida. Requisitos:
> 1. Funcionários com senhas no on-premises — compliance exige que hashes de senha NUNCA sejam armazenados no cloud
> 2. Admins de TI precisam de acesso privilegiado apenas durante incidentes, com aprovação do CISO
> 3. 500 parceiros externos precisam acessar uma aplicação de relatórios
> 4. Acesso à aplicação apenas de dispositivos gerenciados corporativos
>
> **Projete a solução de identidade completa.**
>
> **Solução esperada:**
> 1. Entra ID Connect com **Pass-through Authentication** (não PHS — compliance proíbe hash no cloud)
> 2. **PIM** para roles de admin com aprovação obrigatória pelo CISO + MFA na ativação (requer P2)
> 3. **Azure AD B2B** para parceiros (Guest users, mantêm identidade própria, MAU-based billing)
> 4. **Conditional Access** policy: cloud app = App de Relatórios, grant = require Hybrid AD Joined OR Compliant Device
`,

  quiz: [
    {
      question: 'Uma empresa precisa garantir que administradores globais tenham acesso privilegiado apenas quando necessário, com aprovação de outro admin e auditoria completa. Qual recurso usar?',
      options: [
        'RBAC com Role Assignment permanente',
        'Privileged Identity Management (PIM)',
        'Conditional Access com MFA',
        'Azure Policy com Deny'
      ],
      correct: 1,
      explanation: 'PIM (Privileged Identity Management) implementa acesso JIT (Just-in-Time) para roles privilegiadas. Usuários são "eligible" para uma role mas precisam ativá-la quando necessário, podendo exigir aprovação de outro admin, MFA e justificativa. Toda ativação é auditada. Requer Entra ID P2.',
      reference: 'PIM = JIT para roles privilegiadas. RBAC permanente = acesso sempre ativo. Para admins, PIM é o padrão recomendado.'
    },
    {
      question: 'Compliance de uma empresa proíbe que hashes de senha sejam armazenados fora do datacenter on-premises. Qual método de sincronização do Entra ID Connect deve ser usado?',
      options: [
        'Password Hash Sync (PHS)',
        'Pass-through Authentication (PTA)',
        'Azure AD Connect Cloud Sync',
        'Direct Federation com SAML'
      ],
      correct: 1,
      explanation: 'Pass-through Authentication (PTA) valida senhas diretamente no AD on-premises em tempo real — a senha (ou seu hash) nunca é armazenada no Azure. Requer agentes PTA instalados on-premises que ficam online para processar as autenticações. PHS sincroniza o hash da senha para o Entra ID, o que viola o requisito de compliance.',
      reference: 'PHS = hash vai para Azure (simples mas hash está no cloud). PTA = auth validada on-prem em tempo real (hash nunca vai para Azure).'
    },
    {
      question: 'Qual é a diferença entre Azure AD B2B e Azure AD B2C (Entra External ID)?',
      options: [
        'B2B é para clientes; B2C é para parceiros de negócios',
        'B2B é para parceiros/funcionários externos que mantêm sua própria identidade; B2C é para consumidores finais que criam contas no seu tenant',
        'B2C só suporta identidades Microsoft; B2B suporta identidades externas',
        'Não há diferença técnica — apenas terminologia de licenciamento'
      ],
      correct: 1,
      explanation: 'B2B (Business-to-Business): parceiros usam sua identidade corporativa/Microsoft existente como guest no seu tenant. Escala de dezenas a milhares. B2C/External ID: consumidores criam conta específica no seu tenant, com fluxos customizados e branding da sua empresa. Escala de milhões de usuários. Casos de uso completamente diferentes.',
      reference: 'B2B = parceiros (guest users, mantêm identidade). B2C = consumidores (criam conta no seu tenant, escala de milhões).'
    },
    {
      question: 'Qual Conditional Access signal avalia o risco em tempo real de um sign-in (ex: login suspeito de localização incomum) e requer qual licença?',
      options: [
        'Location signal — Entra ID P1',
        'Identity Protection risk signal — Entra ID P2',
        'Device compliance — Entra ID P1',
        'User risk — Entra ID Free'
      ],
      correct: 1,
      explanation: 'O sinal de risco do Entra ID Identity Protection avalia em tempo real se um sign-in é suspeito (localização anômala, IP malicioso, credenciais vazadas). Ao integrar com Conditional Access, você pode exigir MFA ou bloquear sign-ins de alto risco. Requer Entra ID P2.',
      reference: 'P1: Conditional Access com sinais básicos (location, device, app). P2: adiciona Identity Protection (risk-based CA, PIM, Access Reviews).'
    },
    {
      question: 'Uma aplicação precisa acessar o Microsoft Graph API em nome da própria aplicação (não de um usuário). Qual tipo de permissão e autenticação usar?',
      options: [
        'Delegated permissions com user credential',
        'Application permissions com Client Credentials flow (service principal)',
        'User Impersonation com Managed Identity',
        'Shared Access Signature para APIs Microsoft'
      ],
      correct: 1,
      explanation: 'Para acesso "daemon" (sem usuário, a aplicação agindo por conta própria), use Application Permissions com o OAuth 2.0 Client Credentials Flow. A aplicação se autentica com seu próprio clientId + secret/certificate (ou Managed Identity). Delegated permissions são para quando a aplicação age EM NOME de um usuário específico.',
      reference: 'Delegated = em nome de usuário (usuário precisa consentir). Application = a própria app (admin consent necessário, não usuário individual).'
    }
  ],

  flashcards: [
    {
      front: 'O que é PIM (Privileged Identity Management) e quais são seus pilares?',
      back: '**PIM** gerencia acesso privilegiado Just-in-Time (JIT) no Entra ID e Azure RBAC.\n\n**3 pilares:**\n1. **Eligible assignments**: usuário pode ativar a role quando precisar\n2. **Time-bound**: acesso com duração limitada (ex: 1-8h)\n3. **Approval workflow**: ativação pode requerer aprovação\n\n**Benefícios:**\n- Reduz exposição de contas privilegiadas permanentes\n- Auditoria completa (quem ativou, quando, por quê)\n- MFA obrigatório na ativação\n\n**Licença**: Entra ID P2'
    },
    {
      front: 'Quais são os 3 métodos de sincronização do Entra ID Connect e quando usar cada um?',
      back: '**1. Password Hash Sync (PHS)** — recomendado pela Microsoft:\n- Hash da senha sincronizado para Azure\n- Auth acontece no cloud (sem dependência on-prem)\n- Mais resiliente (funciona se on-prem estiver down)\n\n**2. Pass-through Auth (PTA)**:\n- Auth validada no on-prem em tempo real\n- Hash nunca vai para Azure\n- Use quando compliance proíbe dados de senha no cloud\n\n**3. Federation (AD FS)**:\n- Token emitido pelo AD FS on-prem\n- Máxima customização e controle\n- Mais complexo e custoso de manter'
    },
    {
      front: 'Qual é o padrão de design Zero Trust para identidade?',
      back: '**Zero Trust** = "Never trust, always verify"\n\n**3 princípios:**\n1. **Verificar explicitamente**: sempre autenticar e autorizar baseado em TODOS os dados (identidade, localização, dispositivo, serviço, workload, etc.)\n2. **Menor privilégio**: JIT + JEA. PIM para roles privilegiadas. RBAC granular.\n3. **Assumir violação**: segmentar acesso, detectar anomalias, responder rapidamente\n\n**Controles de implementação:**\n- Conditional Access + MFA\n- PIM para roles privilegiadas\n- Identity Protection para risk-based access\n- Access Reviews periódicos (P2)'
    },
    {
      front: 'App Registration vs Enterprise Application no Entra ID — qual a diferença?',
      back: '**App Registration** (objeto global):\n- "Blueprint" da aplicação\n- Define como ela se autentica, quais permissões solicita\n- Criado no tenant onde a app é "dona"\n- Tem clientId, secret/certificate\n\n**Enterprise Application** (Service Principal — objeto local):\n- Instância da app no tenant\n- Aqui você gerencia: quem pode acessar, consentimento de permissões, SSO\n- Criada automaticamente ao registrar a app OU ao instalar uma app do Marketplace\n\nApp multi-tenant: 1 App Registration → N Enterprise Applications em N tenants'
    }
  ],

  lab: {
    scenario: 'Explore configurações de PIM e Conditional Access para entender o design de identidade segura.',
    objective: 'Verificar pré-requisitos de PIM e criar uma Conditional Access Policy de MFA para administradores.',
    duration: '15-20 minutos',
    steps: [
      {
        title: 'Verificar licença e habilitar PIM',
        instruction: 'Verifique se o tenant tem licença Entra ID P2 necessária para PIM e explore as configurações via CLI.',
        hints: ['\`az ad user show\` para ver detalhes do seu usuário', 'PIM requer P2 — verifique as licenças atribuídas'],
        solution: `\`\`\`bash
# Verificar licenças do tenant
az rest --method GET \\
  --url "https://graph.microsoft.com/v1.0/subscribedSkus" \\
  --query "value[].{SKU:skuPartNumber,Units:prepaidUnits.enabled}" \\
  -o table

# Verificar licenças do seu usuário
MY_ID=$(az ad signed-in-user show --query id -o tsv)
az rest --method GET \\
  --url "https://graph.microsoft.com/v1.0/users/$MY_ID/licenseDetails" \\
  --query "value[].servicePlans[?servicePlanName=='AAD_PREMIUM_P2'].servicePlanName" \\
  -o tsv

echo "Se 'AAD_PREMIUM_P2' aparecer, o tenant tem licença P2 para PIM"
\`\`\``,
        verify: `\`\`\`bash
echo "Para explorar PIM: Portal Azure → Microsoft Entra ID → Privileged Identity Management"
echo "PIM não pode ser totalmente configurado via CLI — o portal é necessário para ativações"
\`\`\``
      },
      {
        title: 'Criar Conditional Access Policy para Admins',
        instruction: 'Use o portal Azure (via instruções) ou a Graph API para criar uma política que exige MFA para Global Administrators.',
        hints: [
          'Via portal: Entra ID → Security → Conditional Access → New Policy',
          'Assignments: Users → Directory Roles → Global Administrator',
          'Grant: Require multi-factor authentication'
        ],
        solution: `\`\`\`bash
# Via Graph API (se permissões disponíveis)
az rest --method POST \\
  --url "https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies" \\
  --body '{
    "displayName": "Require MFA for Global Admins",
    "state": "enabledForReportingButNotEnforced",
    "conditions": {
      "users": {
        "includeRoles": ["62e90394-69f5-4237-9190-012177145e10"]
      },
      "applications": {
        "includeApplications": ["All"]
      }
    },
    "grantControls": {
      "operator": "OR",
      "builtInControls": ["mfa"]
    }
  }' \\
  --headers "Content-Type=application/json" 2>/dev/null || echo "Criar via portal: Entra ID → Security → Conditional Access"
\`\`\``,
        verify: `\`\`\`bash
# Listar políticas de Conditional Access
az rest --method GET \\
  --url "https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies" \\
  --query "value[].{Nome:displayName,Estado:state}" -o table 2>/dev/null || echo "Verificar via portal"
\`\`\``
      },
      {
        title: 'Revisar Access Reviews (conceitual)',
        instruction: 'Entenda quando usar Access Reviews e explore as opções via portal. Access Reviews automatizam auditoria periódica de quem tem acesso ao quê.',
        hints: ['Access Reviews requerem P2', 'Portal: Entra ID → Identity Governance → Access Reviews'],
        solution: `\`\`\`bash
# Access Reviews são configurados via portal ou MS Graph API
# Verificar se Identity Governance está disponível
az rest --method GET \\
  --url "https://graph.microsoft.com/v1.0/identityGovernance/accessReviews/definitions" \\
  --query "value[].{Nome:displayName,Status:status}" -o table 2>/dev/null || \\
  echo "Identity Governance (Access Reviews) requer licença P2 e configuração via portal"

echo "Casos de uso para Access Reviews:"
echo "1. Revisar trimestralmente quem tem acesso a recursos sensíveis"
echo "2. Identificar e remover guest users inativos"
echo "3. Auditar membros de grupos privilegiados (ex: Global Admins)"
\`\`\``,
        verify: `\`\`\`bash
echo "Access Reviews explorado via portal ou Graph API"
echo "Próximo passo: implementar no ambiente real com licença P2"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Conditional Access bloqueia usuários legítimos',
      difficulty: 'medium',
      symptom: 'Após criar uma Conditional Access policy, alguns usuários legítimos (incluindo um admin) estão sendo bloqueados ao tentar fazer login.',
      diagnosis: `\`\`\`bash
# Verificar Sign-in Logs para entender por que foi bloqueado
az rest --method GET \\
  --url "https://graph.microsoft.com/v1.0/auditLogs/signIns?\\$filter=conditionalAccessStatus eq 'failure'&\\$top=10" \\
  --query "value[].{User:userPrincipalName,App:appDisplayName,Status:conditionalAccessStatus,Error:status.failureReason}" \\
  -o table 2>/dev/null || echo "Verificar: Entra ID → Sign-in logs → Filter: CA status = Failure"
\`\`\``,
      solution: `**Prevenções e soluções:**

1. **Sempre usar "Report-only" mode primeiro**: ao criar a policy, colocar em estado "Report-only" por alguns dias — veja quem seria afetado sem bloquear ninguém.

2. **Excluir conta break-glass**: sempre criar 2 contas de "emergency access" (sem CA, sem MFA, com senhas longas em cofre físico) e excluir da policy.

3. **Excluir usuário/grupo específico temporariamente**: editar a policy → Exclude → adicionar o usuário bloqueado enquanto investiga.

4. **Verificar sign-in logs**: Entra ID → Sign-in Logs → filtrar por usuário e ver qual policy está bloqueando e por quê.

5. **Modo de break-glass**: se o admin está bloqueado, usar conta de emergency access para acesso.`
    },
    {
      title: 'Usuários no on-premises não aparecem no Entra ID após configurar Connect',
      difficulty: 'medium',
      symptom: 'Entra ID Connect foi instalado e configurado, mas usuários do AD on-premises não aparecem no Entra ID.',
      diagnosis: `\`\`\`bash
# Verificar status de sincronização (no servidor onde Connect está instalado)
# Via PowerShell no servidor Connect:
# Import-Module ADSync
# Get-ADSyncScheduler
# Start-ADSyncSyncCycle -PolicyType Delta

# Via portal: Entra ID → Entra ID Connect → Sync errors

# Verificar se o usuário tem atributos obrigatórios
# No AD on-prem, verificar: userPrincipalName, mail, proxyAddresses
\`\`\``,
      solution: `**Checklist de diagnóstico:**

1. **Verificar Sync Errors**: no portal Entra ID → Connect → Sync errors — erros são listados por atributo/usuário.

2. **Atributos obrigatórios**: verificar que o UPN do usuário on-prem usa um domínio verificado no Azure. Se UPN é \`user@contoso.local\` (domínio não-roteável), pode dar problema — configurar Alternate Login ID.

3. **OU não está no escopo de sync**: verificar que a OU dos usuários está selecionada na configuração de filtro do Connect.

4. **Conflito de atributos**: dois objetos com mesmo proxyAddress ou ImmutableId geram conflito — verificar na lista de sync errors.

5. **Forçar sincronização**: no servidor Connect, via PowerShell: \`Start-ADSyncSyncCycle -PolicyType Initial\` para sync completo.`
    }
  ]
};
