window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['az305-security/compliance-design'] = {
  theory: `# Design de Compliance & Regulatório (AZ-305)

## Relevância no Exame
> Peso estimado **10-15%** no AZ-305. Questões sobre GDPR, residência de dados, Microsoft Purview e Defender for Cloud Regulatory Compliance aparecem em cenários de design.

## Frameworks de Compliance no Azure

### Microsoft Defender for Cloud — Regulatory Compliance

\`\`\`bash
# Ver frameworks de compliance disponíveis
az security regulatory-compliance-standards list -o table

# Ver controles de um framework específico
az security regulatory-compliance-controls list \
  --standard-name "PCI-DSS-3.2.1" \
  --query "[?state=='Failed'].{Control:name,State:state}" -o table

# Ver score de compliance
az security secure-score-controls list \
  --query "[].{Control:displayName,Score:score.current,Max:score.max}" -o table
\`\`\`

**Frameworks disponíveis**: ISO 27001, SOC 2, PCI DSS, NIST SP 800-53, FedRAMP, CIS Benchmarks, LGPD, GDPR.

## Residência de Dados (Data Residency)

Para GDPR e regulamentações locais, dados devem permanecer em regiões específicas:

\`\`\`bash
# Criar storage account restrita a regiões EU
# Via Azure Policy: "Allowed locations"
az policy assignment create \
  --name eu-data-residency \
  --policy "/providers/Microsoft.Authorization/policyDefinitions/e56962a6-4747-49cd-b67b-bf8b01975c4f" \
  --scope /subscriptions/my-subscription-id \
  --params '{"listOfAllowedLocations": {"value": ["westeurope", "northeurope", "francecentral"]}}'
\`\`\`

## Microsoft Purview — Governança de Dados

\`\`\`
Microsoft Purview = plataforma de governança, risco e compliance

Componentes:
├─ Data Map: inventário automático de dados em fontes (SQL, Storage, Power BI)
├─ Data Catalog: descoberta e classificação de dados (PII, GDPR, etc.)
├─ Data Policy: controle de acesso baseado em classificação
├─ Information Protection: labels, DLP (Data Loss Prevention)
└─ Insider Risk Management: detectar comportamento de risco interno
\`\`\`

\`\`\`bash
# Criar Purview account
az purview account create \
  --account-name mypurview \
  --resource-group myRG \
  --location eastus \
  --managed-resource-group-name purview-managed-rg

# Registrar fonte de dados (Azure SQL)
az purview account register-data-source \
  --account-name mypurview \
  --resource-group myRG \
  --data-source-type AzureSqlDatabase \
  --data-source-name mydb
\`\`\`

## Encryption Strategy

### Encryption at Rest

| Tipo | Gerenciamento de Chave | Uso |
|------|----------------------|-----|
| **PMK** (Platform-managed) | Microsoft gerencia | Padrão, sem custo extra |
| **CMK** (Customer-managed) | Cliente gerencia no Key Vault | Compliance, auditar rotação |
| **BYOK** (Bring Your Own Key) | HSM do cliente | Máximo controle, regulatório |

\`\`\`bash
# Storage Account com CMK
az storage account update \
  --name mysa \
  --resource-group myRG \
  --encryption-key-source Microsoft.Keyvault \
  --encryption-key-vault https://mykeyvault.vault.azure.net \
  --encryption-key-name storage-encryption-key \
  --encryption-key-version <key-version>
\`\`\`

### Encryption in Transit

- TLS 1.2 mínimo em todos os serviços Azure
- App Service: configurar minimum TLS version
- Storage Account: Secure transfer required (HTTPS only)

\`\`\`bash
# Forçar TLS 1.2+ no Storage
az storage account update \
  --name mysa --resource-group myRG \
  --min-tls-version TLS1_2 \
  --https-only true
\`\`\`

## Azure Policy para Compliance Automático

\`\`\`bash
# Policy Initiative: aplicar múltiplos controles ISO 27001
az policy assignment create \
  --name iso-27001-compliance \
  --policy-set-definition /providers/Microsoft.Authorization/policySetDefinitions/89c6cddc-1c73-4ac1-b19c-54d1a15a42f9 \
  --scope /subscriptions/my-sub-id \
  --enforcement-mode Default

# Verificar compliance
az policy state list \
  --query "[?complianceState=='NonCompliant'].{Policy:policyDefinitionName,Resource:resourceId}" \
  -o table | head -20
\`\`\`

## Erros Comuns de Design

1. **PMK quando CMK é exigido**: regulamentações financeiras frequentemente exigem que o cliente controle as chaves de criptografia (CMK/BYOK).
2. **Sem inventário de dados pessoais**: GDPR/LGPD exige conhecer onde estão os dados pessoais — Purview automatiza esse inventário.
3. **TLS 1.0/1.1 ainda aceito**: protocolos legados com vulnerabilidades conhecidas. Forçar mínimo TLS 1.2.
4. **Logs de auditoria por apenas 30 dias**: compliance frequentemente exige 1-7 anos de retenção de logs.
5. **Política de compliance sem remediação**: Policy no modo Audit não remedia — configurar DeployIfNotExists para remediação automática.

## Killer.sh Style Challenge (AZ-305)

> Um banco precisar atender PCI DSS para dados de cartão. Requisitos: dados de cartão criptografados em repouso com chaves controladas pelo banco, TLS 1.2 mínimo, logs de acesso por 3 anos, alertas para acesso não autorizado, dados apenas no Brasil (LGPD).
>
> **Resposta**: Azure Policy "Allowed locations" = brazilsouth+brazilsoutheast. Azure SQL com Always Encrypted + CMK no Key Vault com BYOK (HSM). Storage Account com CMK + TLS 1.2+ forçado. Log Analytics workspace: SecurityEvent retention=1095 dias (3 anos). Defender for Cloud com PCI DSS initiative + Sentinel para alertas de acesso anômalo. Purview para classificação automática de dados de cartão.
`,

  quiz: [
    {
      question: 'Qual é a diferença entre PMK, CMK e BYOK no contexto de encryption at rest no Azure?',
      options: [
        'São apenas termos de marketing para o mesmo serviço',
        'PMK = Microsoft gerencia as chaves (padrão); CMK = cliente gerencia chaves no Key Vault (compliance); BYOK = cliente importa chaves de HSM próprio (máximo controle)',
        'PMK é para dados em repouso; CMK para dados em trânsito; BYOK para dados em uso',
        'BYOK é mais caro mas não oferece benefícios técnicos adicionais sobre CMK'
      ],
      correct: 1,
      explanation: 'PMK (Platform-managed keys): Microsoft cria, armazena e rota as chaves automaticamente — padrão, sem custo extra, transparente. CMK (Customer-managed keys): cliente cria e armazena no Azure Key Vault, controla a rotação e pode revogar acesso. BYOK (Bring Your Own Key): cliente gera chaves em HSM on-premises e importa para o Azure Key Vault — máximo controle, atende regulamentações que exigem que chaves nunca sejam geradas fora do controle do cliente.',
      reference: 'Seção Encryption Strategy — PMK para padrão, CMK para compliance, BYOK para regulamentações financeiras/soberania.'
    },
    {
      question: 'Para atender GDPR, uma empresa precisa garantir que dados pessoais de clientes europeus nunca saiam da União Europeia. Qual mecanismo Azure implementar?',
      options: [
        'Configurar manualmente cada recurso na região correta',
        'Azure Policy com a iniciativa "Allowed locations" restrita a regiões da UE, aplicada no Management Group',
        'Usar apenas Azure Germany (soberano) para dados europeus',
        'Configurar geo-replication apenas para regiões europeias'
      ],
      correct: 1,
      explanation: 'A Azure Policy "Allowed locations" (ID: e56962a6-...) bloqueia a criação de recursos em regiões não autorizadas. Aplicada no Management Group, garante que TODOS os recursos (presentes e futuros) só possam ser criados nas regiões aprovadas. Configuração manual por recurso é propensa a erros e não escala. Policy = governança automática e consistente.',
      reference: 'Seção Residência de Dados — Policy no Management Group garante compliance em escala para todas as subscriptions.'
    },
    {
      question: 'O que é o Microsoft Purview e qual problema ele resolve para compliance?',
      options: [
        'É um substituto do Azure Active Directory para autenticação',
        'É uma plataforma de governança de dados que automaticamente descobre, classifica e cataloga dados sensíveis (PII, PCI, etc.) em todo o ambiente Azure',
        'É uma ferramenta de monitoramento de performance de bancos de dados',
        'É o portal de compliance que substituiu o Trust Center da Microsoft'
      ],
      correct: 1,
      explanation: 'Microsoft Purview automatiza o inventário de dados: varre fontes (Azure SQL, Blob, Power BI, on-premises) e classifica automaticamente dados sensíveis usando ML (reconhece números de cartão, CPF, senhas, etc.). Isso é essencial para GDPR/LGPD: você precisa saber ONDE estão os dados pessoais para reportar violações (art. 33 do GDPR exige notificação em 72h). Sem Purview, esse mapeamento é manual e sujeito a erros.',
      reference: 'Seção Microsoft Purview — é a ferramenta de Data Governance do Azure. Fundamental para GDPR, LGPD e regulamentações de dados pessoais.'
    }
  ],

  flashcards: [
    {
      front: 'Quais são os principais frameworks de compliance disponíveis no Azure e como monitorar?',
      back: '**Frameworks disponíveis** (Defender for Cloud):\n- ISO 27001, ISO 27017, ISO 27018\n- SOC 1, SOC 2, SOC 3\n- PCI DSS 3.2.1\n- NIST SP 800-53, FedRAMP\n- GDPR, LGPD\n- CIS Microsoft Azure Foundations Benchmark\n- HIPAA/HITRUST\n\n**Monitorar**:\n```bash\naz security regulatory-compliance-standards list\naz security regulatory-compliance-controls list \\\n  --standard-name "ISO-27001"\n```\n\n**Portal**: Defender for Cloud → Regulatory Compliance → ver score e controles falhando.'
    },
    {
      front: 'O que é BYOK (Bring Your Own Key) e quando é necessário?',
      back: '**BYOK** = cliente gera chaves criptográficas em HSM (Hardware Security Module) próprio e as importa para o Azure Key Vault Managed HSM.\n\n**Quando usar**:\n- Regulamentações que exigem que chaves NUNCA saiam do controle do cliente (ex: banking regulations, defense)\n- Separação criptográfica completa do provedor cloud\n- Auditoria de todo ciclo de vida da chave\n\n**Fluxo**:\n1. Gerar KEK (Key Exchange Key) no cliente HSM\n2. Exportar em formato BYOK\n3. Importar no Azure Key Vault Managed HSM\n4. Chave original nunca tocou hardware Microsoft\n\n**Alternativa menos rigorosa**: CMK (Customer-Managed Key) onde o cliente cria a chave dentro do Azure Key Vault.'
    }
  ],

  lab: {
    scenario: 'Verificar compliance de uma subscription usando Microsoft Defender for Cloud e configurar uma Policy de residência de dados.',
    objective: 'Explorar Regulatory Compliance no Defender for Cloud e implementar controle de residência de dados via Policy.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Explorar Regulatory Compliance via CLI',
        instruction: 'Verifique os frameworks de compliance disponíveis e o estado atual da subscription.',
        hints: ['az security regulatory-compliance-standards list', 'az security secure-score-controls list'],
        solution: `\`\`\`bash
# Ver frameworks de compliance disponíveis
az security regulatory-compliance-standards list \
  --query "[].{Name:name,State:state}" -o table 2>/dev/null || \
  echo "Verificar via portal: Defender for Cloud → Regulatory Compliance"

# Ver controles falhando (se Defender habilitado)
az security regulatory-compliance-controls list \
  --standard-name "Azure-CIS-1.4.0" \
  --query "[?state=='Failed'].{Control:name}" -o table 2>/dev/null | head -10 || \
  echo "Selecionar um standard disponível"

# Ver Secure Score atual
az security secure-score-controls list \
  --query "[].{Control:displayName,Score:score.current,Max:score.max}" \
  -o table 2>/dev/null | head -10
\`\`\``,
        verify: `\`\`\`bash
echo "Compliance explorado via CLI"
echo "Para análise completa: Portal → Defender for Cloud → Regulatory Compliance"
echo "Score ideal: > 80% indica boa postura de segurança"
\`\`\``
      },
      {
        title: 'Criar Policy de Residência de Dados',
        instruction: 'Crie uma Azure Policy que restringe recursos a regiões específicas (simulando LGPD/GDPR).',
        hints: ['Policy built-in: e56962a6-4747-49cd-b67b-bf8b01975c4f (Allowed locations)', 'Assignment no resource group atual'],
        solution: `\`\`\`bash
az group create --name rg-compliance-lab --location eastus

# Criar assignment de Policy "Allowed locations" restrita a eastus e westus
SUB_ID=$(az account show --query id -o tsv)

az policy assignment create \
  --name data-residency-policy \
  --display-name "Data Residency - East/West US only" \
  --policy "e56962a6-4747-49cd-b67b-bf8b01975c4f" \
  --scope "/subscriptions/$SUB_ID/resourceGroups/rg-compliance-lab" \
  --params '{"listOfAllowedLocations": {"value": ["eastus", "westus2"]}}'

echo "Policy criada - recursos fora de eastus/westus2 serão bloqueados neste RG"
\`\`\``,
        verify: `\`\`\`bash
# Verificar se a policy foi criada
az policy assignment show \
  --name data-residency-policy \
  --scope "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/rg-compliance-lab" \
  --query "{Name:name,Policy:policyDefinitionId}" -o table

# Testar criação de recurso em região não permitida (deve falhar)
az storage account create --name blockedtest123 \
  --resource-group rg-compliance-lab \
  --location brazilsouth 2>&1 | grep -i "disallowed\|denied\|policy" || \
  echo "Policy pode demorar até 30min para ser aplicada"

az group delete --name rg-compliance-lab --yes --no-wait
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Policy de compliance não impedindo criação de recursos fora da região permitida',
      difficulty: 'easy',
      symptom: 'Uma Azure Policy "Allowed locations" foi criada e atribuída, mas recursos ainda estão sendo criados em regiões não autorizadas.',
      diagnosis: `\`\`\`bash
# Verificar estado da assignment
az policy assignment show --name my-location-policy \
  --scope /subscriptions/... \
  --query "{Name:name,Mode:policyDefinitionId,Enforcement:enforcementMode}" -o json

# Ver compliance state (leva até 30 min para atualizar)
az policy state list \
  --query "[?complianceState=='NonCompliant'].{Resource:resourceId}" -o table | head -10
\`\`\``,
      solution: `**Causas comuns**:

1. **EnforcementMode = DoNotEnforce**: verificar se a assignment está no modo de auditoria em vez de bloqueio:
\`\`\`bash
az policy assignment update --name my-location-policy \
  --scope /subscriptions/... \
  --enforcement-mode Default  # Default = enforce, DoNotEnforce = audit only
\`\`\`

2. **Escopo incorreto**: Policy atribuída no RG mas recursos criados em outro RG ou no nível da subscription.

3. **Atraso de propagação**: novas assignments levam até 30 minutos para serem aplicadas. Aguardar e testar novamente.

4. **Exemption criada**: verificar se há uma exemption que bypassa a policy para um recurso específico:
\`\`\`bash
az policy exemption list --scope /subscriptions/.../resourceGroups/myRG
\`\`\``
    }
  ]
};
