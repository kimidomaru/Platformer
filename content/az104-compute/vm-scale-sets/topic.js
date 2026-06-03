window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['az104-compute/vm-scale-sets'] = {
  theory: `# VM Scale Sets & Autoscaling

## Relevância no Exame
> Peso estimado **8-10%** no AZ-104. Autoscaling baseado em métricas e configuração de VMSS aparecem em cenários de alta disponibilidade.

## Conceitos Fundamentais

### VM Scale Sets (VMSS)
Gerencia um grupo de VMs idênticas com:
- **Autoscaling** baseado em métricas (CPU, memória, custom)
- **Rolling updates**: atualiza gradualmente sem downtime
- **Load Balancer ou Application Gateway** na frente
- **Uniform mode**: VMs idênticas (para workloads stateless)
- **Flex mode**: suporta diferentes tamanhos/imagens

### Autoscaling Rules
Condição → Ação:
\`\`\`
IF CPU média > 70% por 10 minutos
THEN adicionar 2 instâncias
WAIT 5 minutos antes de próxima avaliação (cooldown)

IF CPU média < 30% por 10 minutos
THEN remover 1 instância
\`\`\`

**Configurações importantes:**
- **Min count**: mínimo de VMs sempre ativas
- **Max count**: limite máximo de VMs
- **Default count**: quantidade inicial se métricas não estiverem disponíveis
- **Cooldown period**: tempo de espera após scale out/in antes de nova ação

### Upgrade Policy
Como VMs são atualizadas quando a imagem/configuração muda:
- **Automatic**: Azure atualiza instâncias automaticamente (imediato)
- **Rolling**: atualiza em lotes, mantendo % mínima de instâncias saudáveis
- **Manual**: você controla quando cada instância é atualizada

### Spot Instances no VMSS
- Usa capacidade excedente do Azure com até **90% de desconto**
- Pode ser evicted (removida) com 30 segundos de aviso
- Ideal para: processamento batch, renderização, workloads tolerantes a interrupção
- **Eviction policy**: Delete ou Deallocate

## Comandos Essenciais (Azure CLI)

\`\`\`bash
# Criar VMSS simples
az vmss create \\
  --name myVMSS \\
  --resource-group myRG \\
  --image Ubuntu2204 \\
  --vm-sku Standard_B2s \\
  --instance-count 2 \\
  --admin-username azureuser \\
  --generate-ssh-keys \\
  --load-balancer myLB

# Configurar autoscaling no VMSS
az monitor autoscale create \\
  --resource-group myRG \\
  --resource myVMSS \\
  --resource-type Microsoft.Compute/virtualMachineScaleSets \\
  --name myAutoscale \\
  --min-count 2 \\
  --max-count 10 \\
  --count 2

# Adicionar regra de scale out (CPU > 70%)
az monitor autoscale rule create \\
  --resource-group myRG \\
  --autoscale-name myAutoscale \\
  --condition "Percentage CPU > 70 avg 5m" \\
  --scale out 2 \\
  --cooldown 5

# Adicionar regra de scale in (CPU < 30%)
az monitor autoscale rule create \\
  --resource-group myRG \\
  --autoscale-name myAutoscale \\
  --condition "Percentage CPU < 30 avg 5m" \\
  --scale in 1 \\
  --cooldown 5

# Escalar manualmente
az vmss scale --name myVMSS --resource-group myRG --new-capacity 5

# Listar instâncias
az vmss list-instances --name myVMSS --resource-group myRG \\
  --query "[].{ID:instanceId,Estado:provisioningState}" -o table
\`\`\`

## Erros Comuns

1. **Min > Max**: configuração inválida que impede autoscaling.
2. **Cooldown muito curto**: scale out/in agitado (flapping) — aumentar cooldown para 5-10 minutos.
3. **Health probe não configurada**: VMSS com LB sem health probe não detecta instâncias ruins.
4. **Spot VMs em produção crítica**: spot pode ser evicted a qualquer momento — nunca use para workloads que não toleram interrupção.

## Killer.sh Style Challenge

> Uma aplicação web tem tráfego imprevisível com picos de 5x. Configure VMSS com autoscaling que mantenha pelo menos 2 instâncias sempre ativas, possa escalar até 20, e adicione 3 instâncias quando CPU > 75% por 5 minutos.
>
> **Resposta**: VMSS com min=2, max=20, default=2. Regra scale-out: CPU > 75%, avg 5m, scale out +3, cooldown 5m. Regra scale-in: CPU < 30%, avg 10m, scale in -1, cooldown 10m.
`,

  quiz: [
    {
      question: 'O que é o "cooldown period" em uma regra de autoscaling do Azure?',
      options: [
        'Tempo que a VM demora para inicializar depois de criada',
        'Período de espera após uma ação de scale out/in antes de executar a próxima avaliação de escala',
        'Tempo máximo que o autoscaling fica ativo antes de resetar',
        'Intervalo entre health checks das VMs'
      ],
      correct: 1,
      explanation: 'O cooldown period é um tempo de espera obrigatório após uma ação de scaling antes de executar outra. Isso previne "flapping" — escalar para cima e para baixo repetidamente em resposta a flutuações rápidas de métricas. Um cooldown de 5-10 minutos é comum para dar tempo das novas instâncias iniciarem e distribuírem a carga.',
      reference: 'Cooldown = proteção contra flapping. Muito curto = scale instável. Muito longo = reage lentamente a picos.'
    },
    {
      question: 'Qual é a diferença entre as upgrade policies "Automatic" e "Rolling" em um VMSS?',
      options: [
        'Automatic é mais seguro; Rolling é mais rápido',
        'Automatic atualiza todas as instâncias imediatamente; Rolling atualiza em lotes mantendo disponibilidade',
        'Rolling requer downtime; Automatic não',
        'Não há diferença prática entre os dois modos'
      ],
      correct: 1,
      explanation: 'Automatic atualiza todas as instâncias imediatamente após uma mudança de configuração/imagem — pode causar downtime se todas forem atualizadas ao mesmo tempo. Rolling atualiza em lotes (ex: 20% de instâncias por vez), mantendo um percentual mínimo de instâncias saudáveis durante a atualização — zero downtime.',
      reference: 'Produção = Rolling (gradual, sem downtime). Dev/Test = Automatic (mais simples). Manual = você controla quando atualizar.'
    }
  ],

  flashcards: [
    {
      front: 'Quais são as 4 configurações-chave do autoscaling em VMSS?',
      back: '1. **Min count** — mínimo de VMs sempre ativas (mesmo com CPU baixo)\n2. **Max count** — limite máximo que o autoscaling pode criar\n3. **Default count** — quantidade se métricas não estão disponíveis\n4. **Cooldown period** — tempo de espera após scale action antes de nova avaliação\n\nRegra prática: min ≥ 2 para HA, cooldown 5-10 min para estabilidade.'
    },
    {
      front: 'O que são Spot Instances no VMSS e quando usar?',
      back: '**Spot Instances** usam capacidade excedente do Azure com desconto de até **90%**.\n\n**Características:**\n- Podem ser **evicted** (removidas) com 30 segundos de aviso\n- Eviction policy: Delete ou Deallocate\n- Preço variável ou fixo (max price)\n\n**Quando usar:**\n✅ Processamento batch tolerante a interrupção\n✅ Renderização 3D, ML training\n✅ Testes de carga e performance\n\n**Nunca usar em:**\n❌ Web servers em produção\n❌ Bancos de dados\n❌ Qualquer workload que não pode ser interrompido'
    }
  ],

  lab: {
    scenario: 'Configure um VM Scale Set com autoscaling para a aplicação da TechNova.',
    objective: 'Criar VMSS, configurar autoscaling rules e verificar o comportamento.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Criar VMSS',
        instruction: 'Crie um VMSS Ubuntu com 2 instâncias iniciais.',
        hints: ['\`az vmss create\` com \`--instance-count 2\`'],
        solution: `\`\`\`bash
az group create --name rg-vmss-lab --location eastus
az vmss create \\
  --name app-vmss \\
  --resource-group rg-vmss-lab \\
  --image Ubuntu2204 \\
  --vm-sku Standard_B2s \\
  --instance-count 2 \\
  --admin-username azureuser \\
  --generate-ssh-keys
\`\`\``,
        verify: `\`\`\`bash
az vmss list-instances --name app-vmss --resource-group rg-vmss-lab \\
  --query "[].{ID:instanceId,Estado:provisioningState}" -o table
# Saída esperada: 2 instâncias com estado Succeeded
\`\`\``
      },
      {
        title: 'Configurar autoscaling',
        instruction: 'Configure autoscaling: min=2, max=5, scale out quando CPU > 70%.',
        hints: ['\`az monitor autoscale create\` depois \`az monitor autoscale rule create\`'],
        solution: `\`\`\`bash
VMSS_ID=$(az vmss show --name app-vmss --resource-group rg-vmss-lab --query id -o tsv)

az monitor autoscale create \\
  --resource-group rg-vmss-lab \\
  --resource $VMSS_ID \\
  --name vmss-autoscale \\
  --min-count 2 --max-count 5 --count 2

az monitor autoscale rule create \\
  --resource-group rg-vmss-lab \\
  --autoscale-name vmss-autoscale \\
  --condition "Percentage CPU > 70 avg 5m" \\
  --scale out 1 --cooldown 5

az monitor autoscale rule create \\
  --resource-group rg-vmss-lab \\
  --autoscale-name vmss-autoscale \\
  --condition "Percentage CPU < 30 avg 10m" \\
  --scale in 1 --cooldown 10
\`\`\``,
        verify: `\`\`\`bash
az monitor autoscale show --name vmss-autoscale --resource-group rg-vmss-lab \\
  --query "{Min:profiles[0].capacity.minimum,Max:profiles[0].capacity.maximum,Regras:length(profiles[0].rules)}" -o table
# Saída: Min=2, Max=5, Regras=2
\`\`\``
      },
      {
        title: 'Limpeza',
        instruction: 'Delete o Resource Group.',
        hints: [],
        solution: `\`\`\`bash
az group delete --name rg-vmss-lab --yes --no-wait
\`\`\``,
        verify: `\`\`\`bash
az group show --name rg-vmss-lab 2>/dev/null || echo "RG deletado"
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Autoscaling não está adicionando instâncias apesar de CPU alta',
      difficulty: 'medium',
      symptom: 'CPU das VMs está consistentemente acima de 80%, mas o VMSS não está adicionando novas instâncias.',
      diagnosis: `\`\`\`bash
# Verificar configuração de autoscale
az monitor autoscale show --name myAutoscale --resource-group myRG \\
  --query "{Min:profiles[0].capacity.minimum,Max:profiles[0].capacity.maximum,Default:profiles[0].capacity.default}" -o table

# Verificar instâncias atuais do VMSS
az vmss list-instances --name myVMSS --resource-group myRG --query "length(@)" -o tsv

# Verificar histórico de autoscale
az monitor activity-log list \\
  --resource-group myRG \\
  --query "[?contains(operationName.value,'autoscale')].{Hora:eventTimestamp,Op:operationName.value,Status:status.value}" \\
  -o table
\`\`\``,
      solution: `**Causas possíveis:**

1. **VMSS já está no máximo**: verificar se \`current count == max count\`. Aumentar o max.

2. **Métricas não disponíveis**: se o Azure Monitor não tem métricas recentes, usa o \`default count\` em vez de escalar. Verificar se o Log/Metric Diagnostics está habilitado.

3. **Regra mal configurada**: verificar a condição exata — "avg" vs "max", janela de tempo (5m, 10m), tipo de métrica.

4. **Cooldown ativo**: se scale out foi disparado recentemente, o cooldown pode estar impedindo nova ação.

5. **Quota de assinatura atingida**: verificar limite de cores/VMs na subscription com \`az vm list-usage --location eastus\`.`
    }
  ]
};
