window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['az305-security/security-design'] = {
  theory: `# Design de Soluções de Segurança (AZ-305)

## Relevância no Exame
> Peso estimado **15-20%** no AZ-305. O exame avalia a capacidade de projetar soluções de segurança em camadas: identidade, rede, dados e aplicação.

## Defense in Depth (Defesa em Profundidade)

\`\`\`
Camada 1: Física (data center Microsoft)
Camada 2: Identidade (Azure AD, MFA, PIM)
Camada 3: Perímetro (DDoS, Azure Firewall)
Camada 4: Rede (NSG, Private Endpoints, VNet)
Camada 5: Compute (Defender for Servers, patch)
Camada 6: Aplicação (APIM, WAF, App Gateway)
Camada 7: Dados (Encryption, Key Vault, RBAC)
\`\`\`

## Azure Key Vault — Design

### Tipos de objetos no Key Vault

| Tipo | Uso | Exemplo |
|------|-----|---------|
| **Secrets** | Strings opacas | Passwords, connection strings |
| **Keys** | Chaves criptográficas | RSA, EC keys para cifragem |
| **Certificates** | Certificados TLS/SSL | App Service SSL, mTLS |

\`\`\`bash
# Criar Key Vault com soft-delete e purge protection
az keyvault create \
  --name mykeyvault \
  --resource-group myRG \
  --location eastus \
  --enable-soft-delete true \
  --retention-days 90 \
  --enable-purge-protection true \    # irreversível após habilitar
  --sku standard

# Adicionar segredo
az keyvault secret set \
  --vault-name mykeyvault \
  --name db-password \
  --value "P@ssword123!"

# Dar acesso a uma Managed Identity
az keyvault set-policy \
  --name mykeyvault \
  --object-id <managed-identity-object-id> \
  --secret-permissions get list
\`\`\`

## Managed Identity — Zero Secrets

\`\`\`
Sem Managed Identity:                Com Managed Identity:
App → armazena secret → usa secret   App → Managed Identity → Azure AD Token
      (risco: leak, rotação)               → Key Vault / Storage / SQL
                                           (sem secrets, sem rotação manual)
\`\`\`

### System-assigned vs User-assigned

| | System-assigned | User-assigned |
|-|----------------|--------------|
| Ciclo de vida | Ligado ao recurso | Independente |
| Compartilhamento | 1 recurso | N recursos |
| Caso de uso | VM individual, App Service único | Pool de VMs, Container Instances |

## Microsoft Defender for Cloud

\`\`\`bash
# Habilitar Defender for Containers (para AKS)
az security pricing create \
  --name Containers \
  --tier Standard \
  --resource-group myRG

# Habilitar Defender for Servers
az security pricing create \
  --name VirtualMachines \
  --tier Standard

# Ver recomendações de segurança
az security assessment list \
  --query "[?properties.status.code=='Unhealthy'].{Name:displayName,Severity:properties.metadata.severity}" \
  -o table
\`\`\`

## Azure WAF (Web Application Firewall)

WAF protege contra OWASP Top 10 vulnerabilidades:

\`\`\`bash
# Criar WAF Policy
az network application-gateway waf-policy create \
  --name myWAFPolicy \
  --resource-group myRG \
  --type OWASP \
  --version 3.2 \
  --state Enabled \
  --mode Prevention

# Adicionar regra customizada
az network application-gateway waf-policy custom-rule create \
  --policy-name myWAFPolicy \
  --resource-group myRG \
  --name BlockCountry \
  --priority 100 \
  --rule-type MatchRule \
  --action Block \
  --match-conditions '[{"matchVariable":"RemoteAddr","operator":"GeoMatch","matchValues":["CN","RU"]}]'
\`\`\`

## Padrão: Network Segmentation

\`\`\`
Internet → DDoS Protection Standard
         ↓
         Azure Firewall (Layer 7, FQDN filtering)
         ↓
         Application Gateway + WAF (Layer 7 HTTP)
         ↓
         AKS/App Service (Private Endpoint)
         ↓
         Azure SQL (Private Endpoint, firewall rules)
         ↓
         Key Vault (Private Endpoint, Access Policies)
\`\`\`

## Erros Comuns de Design

1. **Key Vault sem purge protection**: segredos podem ser deletados permanentemente por acidente ou ataque.
2. **Service principal com password em vez de Managed Identity**: passwords expiram e são difíceis de rotacionar; Managed Identity é gerenciada automaticamente.
3. **DDoS Basic suficiente para aplicações públicas**: Basic não tem resposta automática nem telemetria — Standard necessário para SLA.
4. **WAF em modo Detection em produção**: Detection apenas loga, não bloqueia. Use Prevention em produção.
5. **NSG sem regra de negação explícita**: NSG permite todo tráfego por padrão entre subnets no mesmo VNet sem regras.

## Killer.sh Style Challenge (AZ-305)

> Um banco digital precisa: aplicação web pública, API para parceiros externos, dados de clientes com LGPD, auditoria de todas as operações, proteção contra DDoS e ataques web.
>
> **Resposta**: Azure Front Door + DDoS Standard (proteção perimetral). Application Gateway + WAF v2 Prevention mode (proteção L7). App Service com Private Endpoint (sem IP público). Azure SQL com Private Endpoint + Transparent Data Encryption + Always Encrypted para dados sensíveis. Key Vault com purge protection para chaves de criptografia. Managed Identity para autenticação zero-secret. Activity Log + Microsoft Sentinel para SIEM e auditoria.
`,

  quiz: [
    {
      question: 'O que é o "purge protection" do Azure Key Vault e quando habilitá-lo?',
      options: [
        'Previne a criação de novos segredos durante manutenção',
        'Torna o Key Vault e seus objetos irrecuperáveis mesmo após serem deletados durante o período de soft-delete, prevenindo destruição definitiva por erros ou ataques',
        'Sincroniza automaticamente segredos entre múltiplos Key Vaults',
        'Criptografa segredos com chave gerenciada pelo cliente'
      ],
      correct: 1,
      explanation: 'Com purge protection habilitado, mesmo após deletar um secret ou o Key Vault inteiro, o conteúdo não pode ser "purgado" (deletado permanentemente) durante o período de soft-delete. Isso protege contra: exclusão acidental por um admin, ataques de ransomware, ou erros em scripts de automação. Atenção: uma vez habilitado, purge protection não pode ser desabilitado — é irreversível.',
      reference: 'Seção Key Vault — habilite purge protection em produção; é irreversível mas essencial para compliance.'
    },
    {
      question: 'Qual é a principal vantagem de Managed Identity sobre Service Principals com senhas para autenticação de aplicações no Azure?',
      options: [
        'Managed Identity tem permissões mais amplas que Service Principals',
        'Managed Identity não requer gerenciamento de secrets — o Azure gerencia automaticamente o ciclo de vida das credenciais, eliminando rotação manual e risco de leak',
        'Managed Identity funciona apenas dentro do Azure; Service Principal é necessário para ambientes híbridos',
        'Managed Identity é mais rápido para autenticação por usar um protocolo diferente'
      ],
      correct: 1,
      explanation: 'Service Principals com passwords/certificates exigem: armazenamento seguro das credenciais, rotação periódica, e há risco de leak em logs ou código. Managed Identity resolve isso completamente — o Azure gerencia automaticamente a identidade e as credenciais. A aplicação solicita um token ao IMDS (Instance Metadata Service) local, sem nunca ver uma senha. Não há segredos para vazar ou rotacionar.',
      reference: 'Seção Managed Identity — Managed Identity é o padrão recomendado para toda autenticação de serviço-para-serviço no Azure.'
    },
    {
      question: 'Um WAF configurado em modo Detection está em produção. Qual é o risco disso?',
      options: [
        'Modo Detection é mais caro que Prevention',
        'Em Detection, o WAF apenas loga as ameaças mas não as bloqueia — ataques reais continuam passando para a aplicação',
        'Detection mode não funciona com OWASP rules',
        'Detection mode causa falsos negativos apenas'
      ],
      correct: 1,
      explanation: 'O modo Detection do WAF registra todas as requisições suspeitas nos logs do Application Gateway, mas as encaminha para a aplicação sem bloquear. É útil para calibrar regras e identificar falsos positivos antes de ativar o bloqueio. Em produção, mantenha em Prevention mode que bloqueia ativamente os ataques. A transição recomendada: Detection por alguns dias para análise de falsos positivos → Prevention.',
      reference: 'Seção Azure WAF — Detection = log only. Prevention = block attacks. Sempre use Prevention em produção.'
    }
  ],

  flashcards: [
    {
      front: 'O que é Defense in Depth e como isso se aplica no Azure?',
      back: '**Defense in Depth** = múltiplas camadas de segurança, onde uma falha em uma camada não compromete toda a segurança.\n\n**7 camadas no Azure**:\n1. **Física**: data center Microsoft (responsabilidade Microsoft)\n2. **Identidade**: Entra ID, MFA, PIM, Conditional Access\n3. **Perímetro**: DDoS Standard, Azure Firewall Premium\n4. **Rede**: NSG, VNet segmentation, Private Endpoints\n5. **Compute**: Defender for Servers, patch management\n6. **Aplicação**: WAF, APIM, SAST/DAST\n7. **Dados**: TDE, Always Encrypted, Key Vault, RBAC granular'
    },
    {
      front: 'System-assigned vs User-assigned Managed Identity — quando usar cada um?',
      back: '**System-assigned**:\n- Ciclo de vida = ciclo de vida do recurso\n- Deletado quando o recurso é deletado\n- Ideal para: VMs individuais, App Services específicos\n- 1 recurso → 1 identidade\n\n**User-assigned**:\n- Ciclo de vida independente do recurso\n- Pode ser atribuída a múltiplos recursos\n- Ideal para: pools de VMs, Container Instances com autoscale, reutilização de permissões\n- 1 identidade → N recursos\n\n**Regra**: único recurso único → System. Pool/múltiplos recursos → User-assigned.'
    }
  ],

  lab: {
    scenario: 'Configurar Key Vault com Managed Identity para acesso zero-secrets a partir de uma aplicação.',
    objective: 'Demonstrar o padrão Managed Identity + Key Vault eliminando o uso de credentials hardcoded.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Criar Key Vault e adicionar segredo',
        instruction: 'Crie um Key Vault com soft-delete e adicione um segredo de banco de dados.',
        hints: ['--enable-purge-protection é irreversível', 'az keyvault secret set para adicionar segredos'],
        solution: `\`\`\`bash
SUFFIX=$(date +%s | tail -c 5)
az group create --name rg-security-lab --location eastus

az keyvault create \
  --name "technova-kv-\${SUFFIX}" \
  --resource-group rg-security-lab \
  --location eastus \
  --enable-soft-delete true \
  --retention-days 7

az keyvault secret set \
  --vault-name "technova-kv-\${SUFFIX}" \
  --name "db-connection-string" \
  --value "Server=mydb.database.windows.net;Database=prod;..."

echo "KV_NAME=technova-kv-\${SUFFIX}" > /tmp/securitylab.sh
echo "Key Vault criado e segredo adicionado"
\`\`\``,
        verify: `\`\`\`bash
source /tmp/securitylab.sh
az keyvault secret show --vault-name $KV_NAME --name db-connection-string \
  --query "{Name:name,Enabled:attributes.enabled}" -o table
# Esperado: db-connection-string, true
\`\`\``
      },
      {
        title: 'Criar VM com Managed Identity e dar acesso ao Key Vault',
        instruction: 'Crie uma VM com system-assigned Managed Identity e configure acesso ao Key Vault.',
        hints: ['az vm create --assign-identity', 'az keyvault set-policy para dar permissão'],
        solution: `\`\`\`bash
source /tmp/securitylab.sh

# Criar VM com Managed Identity
az vm create \
  --name app-vm \
  --resource-group rg-security-lab \
  --image Ubuntu2204 \
  --assign-identity \
  --generate-ssh-keys \
  --size Standard_B1s

# Obter object ID da Managed Identity
MI_OBJECT_ID=$(az vm show \
  --name app-vm \
  --resource-group rg-security-lab \
  --query "identity.principalId" -o tsv)

echo "Managed Identity Object ID: $MI_OBJECT_ID"

# Dar permissão de leitura de secrets ao Key Vault
az keyvault set-policy \
  --name $KV_NAME \
  --object-id $MI_OBJECT_ID \
  --secret-permissions get list

echo "VM pode agora acessar Key Vault sem credentials!"
echo "Na VM: curl 'http://169.254.169.254/metadata/identity/oauth2/token'"
\`\`\``,
        verify: `\`\`\`bash
source /tmp/securitylab.sh
az keyvault show --name $KV_NAME --resource-group rg-security-lab \
  --query "properties.accessPolicies[?contains(permissions.secrets, 'get')].objectId" -o tsv
# Esperado: o object ID da Managed Identity

az group delete --name rg-security-lab --yes --no-wait
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Aplicação com Managed Identity não consegue acessar Key Vault',
      difficulty: 'medium',
      symptom: 'Uma Azure Function com System-assigned Managed Identity retorna "Forbidden" ao tentar buscar um segredo do Key Vault, mesmo após configurar a Access Policy.',
      diagnosis: `\`\`\`bash
# Verificar Access Policies no Key Vault
az keyvault show --name mykeyvault --resource-group myRG \
  --query "properties.accessPolicies" -o json

# Verificar se a Managed Identity está habilitada na Function
az functionapp identity show \
  --name myfunction --resource-group myRG
\`\`\``,
      solution: `**Checklist de diagnóstico**:

1. **Managed Identity não habilitada**: verificar se system-assigned MI está habilitada na Function App:
\`\`\`bash
az functionapp identity assign --name myfunction --resource-group myRG
\`\`\`

2. **Access Policy com Object ID errado**: a Policy deve usar o Object ID do Service Principal da MI (não o Client ID):
\`\`\`bash
MI_OBJECT_ID=$(az functionapp identity show --name myfunction --resource-group myRG --query "principalId" -o tsv)
az keyvault set-policy --name mykeyvault --object-id $MI_OBJECT_ID --secret-permissions get
\`\`\`

3. **Key Vault com RBAC habilitado**: se o KV usa Azure RBAC (não Access Policies), dar role "Key Vault Secrets User":
\`\`\`bash
az role assignment create --assignee $MI_OBJECT_ID --role "Key Vault Secrets User" --scope /subscriptions/.../vaults/mykeyvault
\`\`\`

4. **Private Endpoint sem DNS**: se o Key Vault tem Private Endpoint, a Function precisa estar na mesma VNet ou ter acesso via Private DNS.`
    }
  ]
};
