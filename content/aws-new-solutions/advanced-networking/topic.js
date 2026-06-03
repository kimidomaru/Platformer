window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['aws-new-solutions/advanced-networking'] = {
  theory: `# AWS Advanced Networking (SAP-C02)

## Relevância no Exame
> Peso estimado **10-15%** no SAP-C02. Questões sobre Transit Gateway, Direct Connect, VPC design complexo e conectividade híbrida avançada.

## Transit Gateway — Hub Central de Rede

\`\`\`
                     Transit Gateway (TGW)
                     ┌─────────────────────┐
VPC-A (Prod) ────────┤                     ├───── On-Premises (Direct Connect)
VPC-B (Dev)  ────────┤   Route Tables      ├───── On-Premises (VPN Backup)
VPC-C (Shared) ──────┤   + Attachments     ├───── VPC em outra região (peering TGW)
VPC-D (Data) ────────┤                     │
                     └─────────────────────┘
\`\`\`

### Criação e Configuração

\`\`\`bash
# Criar Transit Gateway
aws ec2 create-transit-gateway \
  --description "Central hub for multi-VPC connectivity" \
  --options AmazonSideAsn=64512,AutoAcceptSharedAttachments=enable,DefaultRouteTableAssociation=enable

TGW_ID=$(aws ec2 describe-transit-gateways \
  --filters "Name=state,Values=available" \
  --query "TransitGateways[0].TransitGatewayId" \
  --output text)

# Attachar VPC ao Transit Gateway
aws ec2 create-transit-gateway-vpc-attachment \
  --transit-gateway-id $TGW_ID \
  --vpc-id vpc-prod-12345 \
  --subnet-ids subnet-a subnet-b subnet-c

# Criar Route Table de isolamento (ex: prod não acessa dev)
aws ec2 create-transit-gateway-route-table \
  --transit-gateway-id $TGW_ID \
  --tag-specifications "ResourceType=transit-gateway-route-table,Tags=[{Key=Name,Value=prod-rt}]"
\`\`\`

## AWS Direct Connect — Conectividade Híbrida Dedicada

\`\`\`
On-Premises ─── Dedicated Connection ─── DX Location ─── AWS Region
              (1G ou 10G physical)        (Point of
                                           Presence)
\`\`\`

### Direct Connect vs Site-to-Site VPN

| | Direct Connect | S2S VPN |
|-|---------------|---------|
| Bandwidth | 1G, 10G, 100G | Até 1.25 Gbps (ECMP) |
| Latência | Consistente, baixa | Variável (internet) |
| Criptografia | Não nativa (usar MACsec ou VPN over DX) | IPSec nativo |
| Custo | Alto (setup + porta + transferência) | Baixo |
| Disponibilidade | Requer redundância explícita | Failover nativo |
| SLA | Até 99.999% (redundante) | - |

### Padrão: DX + VPN para HA

\`\`\`
On-Premises ─── Direct Connect (primary) ─── AWS
            ╔══ Site-to-Site VPN (backup) ═══╝
BGP: DX tem menor local-pref/AS-PATH mais curto = preferido
     VPN é failover automático se DX falha
\`\`\`

## VPC Design Avançado

### VPC Sharing (Resource Access Manager)

\`\`\`bash
# Compartilhar subnets de um VPC entre accounts da mesma Organization
aws ram create-resource-share \
  --name "shared-vpc-subnets" \
  --resource-arns \
    arn:aws:ec2:us-east-1:123456789012:subnet/subnet-shared-a \
    arn:aws:ec2:us-east-1:123456789012:subnet/subnet-shared-b \
  --principals 987654321098  # account ID da conta consumidora

# Conta consumidora pode lançar recursos nas subnets compartilhadas
# sem ter seu próprio VPC — reduz custos de VPC peering
\`\`\`

### PrivateLink para Exposição de Serviços

\`\`\`bash
# Criar VPC Endpoint Service (provedor)
aws ec2 create-vpc-endpoint-service-configuration \
  --network-load-balancer-arns arn:aws:elasticloadbalancing:... \
  --acceptance-required false \
  --tag-specifications "ResourceType=vpc-endpoint-service,Tags=[{Key=Name,Value=my-service}]"

# Consumidor cria Interface Endpoint
aws ec2 create-vpc-endpoint \
  --vpc-id vpc-consumer \
  --service-name com.amazonaws.vpce.us-east-1.vpce-svc-xxx \
  --vpc-endpoint-type Interface \
  --subnet-ids subnet-a subnet-b \
  --security-group-ids sg-xxx
\`\`\`

## Network Firewall vs Security Groups vs NACLs

| | Security Groups | NACLs | Network Firewall |
|-|----------------|-------|-----------------|
| Nível | Instância (stateful) | Subnet (stateless) | VPC (L3-L7) |
| Regras | Allow only | Allow + Deny | Allow + Deny + IDS/IPS |
| Deep inspection | Não | Não | Sim (L7, FQDN) |
| Stateful | Sim | Não | Sim |

## Erros Comuns

1. **DX sem redundância**: uma única conexão Direct Connect é ponto único de falha — sempre configurar DX redundante ou DX + VPN backup.
2. **Transit Gateway sem route table de isolamento**: por padrão, todos os attachments se comunicam. Configurar route tables para isolar prod de dev.
3. **VPC Peering para muitos VPCs**: peering entre N VPCs requer N*(N-1)/2 conexões. Para >5 VPCs, Transit Gateway é mais eficiente.
4. **PrivateLink sem DNS**: criar Interface Endpoint sem DNS privado habilitado — aplicações usam IP público do serviço.

## Killer.sh Style Challenge (SAP-C02)

> Uma empresa tem 15 VPCs em 3 AWS accounts (prod, dev, shared-services) e uma conexão on-premises. Projete conectividade que: isole prod de dev, permita acesso de todos ao shared-services, conecte on-premises ao prod apenas.
>
> **Resposta**: Transit Gateway por account + TGW peering entre accounts. 3 Route Tables no TGW: (1) prod-rt: rota para shared + on-premises, sem rota para dev. (2) dev-rt: rota para shared, sem rota para prod ou on-premises. (3) shared-rt: rota para prod e dev (acesso bidirecional). Direct Connect no account prod com propagação apenas para prod-rt. RAM para compartilhar TGW entre accounts.
`,

  quiz: [
    {
      question: 'Quando usar Transit Gateway em vez de VPC Peering para conectar múltiplos VPCs?',
      options: [
        'Transit Gateway é sempre mais barato que VPC Peering',
        'Para mais de 3-5 VPCs, Transit Gateway é mais eficiente pois N VPCs precisam apenas de N attachments ao TGW vs N*(N-1)/2 peerings',
        'VPC Peering não suporta conexão cross-account, então TGW é necessário',
        'Transit Gateway permite maior bandwidth que VPC Peering'
      ],
      correct: 1,
      explanation: 'VPC Peering é não-transitivo: para que VPC-A, VPC-B e VPC-C se comuniquem entre si, você precisa de 3 peerings (A-B, B-C, A-C). Para 10 VPCs: 45 peerings. Transit Gateway centraliza: cada VPC faz apenas 1 attachment ao TGW, que roteia para todos. Além disso, TGW suporta múltiplos route tables para isolamento, o que VPC Peering não oferece nativamente.',
      reference: 'Seção Transit Gateway — a regra prática: > 5 VPCs ou necessidade de isolamento = Transit Gateway.'
    },
    {
      question: 'Como garantir alta disponibilidade de conectividade híbrida com Direct Connect?',
      options: [
        'Usar apenas DX com SLA de 99.999% é suficiente',
        'Configurar dois Direct Connect redundantes (diferentes DX locations) OU um DX como primário e Site-to-Site VPN como backup automático via BGP',
        'DX tem redundância automática — não é necessário configuração adicional',
        'Replicar todos os dados para a região AWS mais próxima do on-premises'
      ],
      correct: 1,
      explanation: 'Direct Connect por si só não tem SLA de alta disponibilidade sem redundância explícita. Opções: (1) Dual DX em localizações diferentes = máxima HA, custo alto. (2) DX como primário + Site-to-Site VPN como backup via BGP = boa HA, custo menor. O BGP roteia automaticamente para a conexão com melhor local-preference (DX tem menor AS-PATH por padrão). O VPN entra automaticamente quando DX cai.',
      reference: 'Seção DX + VPN para HA — configure BGP correctly: DX deve ter menor local-pref para ser preferido.'
    }
  ],

  flashcards: [
    {
      front: 'O que é o AWS Transit Gateway e quais são seus componentes principais?',
      back: '**Transit Gateway** = hub regional para conectar VPCs, on-premises e inter-region.\n\n**Componentes**:\n- **Attachments**: VPC, VPN, Direct Connect Gateway, TGW Peering\n- **Route Tables**: tabelas de roteamento (isolar prod de dev)\n- **Associations**: cada attachment associa-se a uma route table\n- **Propagations**: rotas aprendidas via BGP propagam para route tables\n\n**Vantagem vs VPC Peering**:\n- N VPCs = N attachments (não N*(N-1)/2)\n- Transitivo (A→TGW→B→TGW→C)\n- Route tables para isolamento de tráfego\n- Centraliza conectividade on-premises'
    },
    {
      front: 'Como usar AWS PrivateLink para expor um serviço a outras VPCs ou accounts sem VPC Peering?',
      back: '**PrivateLink** = expõe serviço via IP privado sem abrir VPC peering inteiro.\n\n**Arquitetura**:\n```\nProvedor:  NLB → Service Endpoint\n                  ↓ (VPC Endpoint Service)\nConsumidor:       Interface Endpoint (IP privado)\n                  ↓ (DNS resolve para IP privado)\n             App usa serviço sem saber que é externo\n```\n\n**Vantagens**:\n- Sem sobreposição de CIDR problemática\n- Consumidor não acessa todo o VPC do provedor\n- Cross-account e cross-region\n- Mais seguro que VPC Peering\n\n**Uso**: serviços SaaS internos, APIs compartilhadas entre accounts.'
    }
  ],

  lab: {
    scenario: 'Explorar como configurar VPC endpoints para AWS services via PrivateLink.',
    objective: 'Criar Gateway Endpoint para S3 e Interface Endpoint para SSM, entendendo tipos de endpoints.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Criar Gateway Endpoint para S3',
        instruction: 'Crie um VPC Gateway Endpoint para S3 (tráfego permanece na rede AWS sem NAT Gateway).',
        hints: ['Gateway Endpoints: S3 e DynamoDB apenas', 'Gratuito, não usa PrivateLink'],
        solution: `\`\`\`bash
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" \
  --query "Vpcs[0].VpcId" --output text)

RT_ID=$(aws ec2 describe-route-tables \
  --filters "Name=vpc-id,Values=$VPC_ID" "Name=association.main,Values=true" \
  --query "RouteTables[0].RouteTableId" --output text)

# Criar Gateway Endpoint para S3 (gratuito)
aws ec2 create-vpc-endpoint \
  --vpc-id $VPC_ID \
  --service-name com.amazonaws.us-east-1.s3 \
  --vpc-endpoint-type Gateway \
  --route-table-ids $RT_ID

echo "S3 Gateway Endpoint criado - tráfego S3 não passa pela internet"
\`\`\``,
        verify: `\`\`\`bash
aws ec2 describe-vpc-endpoints \
  --filters "Name=service-name,Values=com.amazonaws.us-east-1.s3" "Name=state,Values=available" \
  --query "VpcEndpoints[0].{ID:VpcEndpointId,Type:VpcEndpointType,State:State}" \
  --output table
# Esperado: Gateway, available
\`\`\``
      },
      {
        title: 'Verificar conectividade e limpar',
        instruction: 'Verifique que o endpoint foi adicionado à route table e entenda o custo comparativo.',
        hints: ['Gateway Endpoint = gratuito; Interface Endpoint = ~$0.01/hora por AZ', 'Route table mostra rota para pl-63a5400a (S3)'],
        solution: `\`\`\`bash
# Verificar rota adicionada na route table
aws ec2 describe-route-tables \
  --route-table-ids $RT_ID \
  --query "RouteTables[0].Routes[?GatewayId!=null && contains(GatewayId,'vpce')]" \
  --output json

echo "=== Comparação de custos (us-east-1) ==="
echo "Gateway Endpoint (S3, DynamoDB): GRATUITO"
echo "Interface Endpoint (SSM, EC2, etc.): ~\$0.01/hora/AZ + \$0.01/GB"
echo ""
echo "Para 100 instâncias em 3 AZs acessando SSM:"
echo "Interface Endpoint: 3 × \$0.01/hora = ~\$21.60/mês + dados"
echo "Sem endpoint: tráfego via NAT Gateway = \$0.045/GB (caro para logs de SSM)"

# Limpar
ENDPOINT_ID=$(aws ec2 describe-vpc-endpoints \
  --filters "Name=service-name,Values=com.amazonaws.us-east-1.s3" \
  --query "VpcEndpoints[0].VpcEndpointId" --output text)
aws ec2 delete-vpc-endpoints --vpc-endpoint-ids $ENDPOINT_ID 2>/dev/null
echo "Endpoint deletado"
\`\`\``,
        verify: `\`\`\`bash
aws ec2 describe-vpc-endpoints \
  --filters "Name=service-name,Values=com.amazonaws.us-east-1.s3" "Name=state,Values=available" \
  --query "VpcEndpoints" --output text
# Esperado: (vazio - endpoint deletado)
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Tráfego de VPCs associados ao TGW não consegue se comunicar',
      difficulty: 'hard',
      symptom: 'Dois VPCs foram attachados ao Transit Gateway mas instâncias em VPC-A não conseguem fazer ping em VPC-B apesar do attachment estar "available".',
      diagnosis: `\`\`\`bash
# 1. Verificar route tables nos VPCs (precisam apontar para TGW)
aws ec2 describe-route-tables --filters "Name=vpc-id,Values=vpc-a" \
  --query "RouteTables[].Routes[?TransitGatewayId!=null]" --output json

# 2. Verificar TGW route tables (precisam ter rotas dos CIDRs)
aws ec2 search-transit-gateway-routes \
  --transit-gateway-route-table-id tgw-rtb-xxx \
  --filters "Name=state,Values=active" --output table
\`\`\``,
      solution: `**Checklist completo**:

1. **Route Table no VPC**: a subnet de origem precisa ter rota para o CIDR de destino via TGW:
\`\`\`bash
aws ec2 create-route --route-table-id rtb-vpc-a \
  --destination-cidr-block 10.2.0.0/16 \
  --transit-gateway-id tgw-xxx
\`\`\`

2. **TGW Route Table**: o attachment de VPC-A deve ter rota para o CIDR de VPC-B:
\`\`\`bash
aws ec2 create-transit-gateway-route \
  --transit-gateway-route-table-id tgw-rtb-xxx \
  --destination-cidr-block 10.2.0.0/16 \
  --transit-gateway-attachment-id tgw-attach-vpc-b
\`\`\`

3. **Security Groups**: liberar tráfego no SG de destino:
\`\`\`bash
aws ec2 authorize-security-group-ingress --group-id sg-vpc-b \
  --protocol icmp --port -1 --cidr 10.1.0.0/16
\`\`\`

4. **NACLs**: se NACLs estão configuradas, verificar regras de inbound e outbound (stateless).`
    }
  ]
};
