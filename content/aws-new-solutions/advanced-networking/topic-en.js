window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['aws-new-solutions/advanced-networking'] = {
  theory: `# AWS Advanced Networking (SAP-C02)

## Exam Relevance
> Estimated weight **10-15%** in SAP-C02. Questions on Transit Gateway, Direct Connect, complex VPC design, and advanced hybrid connectivity.

## Transit Gateway — Central Network Hub

\`\`\`
                     Transit Gateway (TGW)
                     ┌─────────────────────┐
VPC-A (Prod) ────────┤                     ├───── On-Premises (Direct Connect)
VPC-B (Dev)  ────────┤   Route Tables      ├───── On-Premises (VPN Backup)
VPC-C (Shared) ──────┤   + Attachments     ├───── VPC in another region (TGW peering)
VPC-D (Data) ────────┤                     │
                     └─────────────────────┘
\`\`\`

### Creation and Configuration

\`\`\`bash
# Create Transit Gateway
aws ec2 create-transit-gateway \
  --description "Central hub for multi-VPC connectivity" \
  --options AmazonSideAsn=64512,AutoAcceptSharedAttachments=enable,DefaultRouteTableAssociation=enable

TGW_ID=$(aws ec2 describe-transit-gateways \
  --filters "Name=state,Values=available" \
  --query "TransitGateways[0].TransitGatewayId" \
  --output text)

# Attach VPC to Transit Gateway
aws ec2 create-transit-gateway-vpc-attachment \
  --transit-gateway-id $TGW_ID \
  --vpc-id vpc-prod-12345 \
  --subnet-ids subnet-a subnet-b subnet-c

# Create isolation Route Table (e.g., prod does not access dev)
aws ec2 create-transit-gateway-route-table \
  --transit-gateway-id $TGW_ID \
  --tag-specifications "ResourceType=transit-gateway-route-table,Tags=[{Key=Name,Value=prod-rt}]"
\`\`\`

## AWS Direct Connect — Dedicated Hybrid Connectivity

\`\`\`
On-Premises ─── Dedicated Connection ─── DX Location ─── AWS Region
              (1G or 10G physical)        (Point of
                                           Presence)
\`\`\`

### Direct Connect vs Site-to-Site VPN

| | Direct Connect | S2S VPN |
|-|---------------|---------|
| Bandwidth | 1G, 10G, 100G | Up to 1.25 Gbps (ECMP) |
| Latency | Consistent, low | Variable (internet) |
| Encryption | Not native (use MACsec or VPN over DX) | Native IPSec |
| Cost | High (setup + port + transfer) | Low |
| Availability | Requires explicit redundancy | Native failover |
| SLA | Up to 99.999% (redundant) | - |

### Pattern: DX + VPN for HA

\`\`\`
On-Premises ─── Direct Connect (primary) ─── AWS
            ╔══ Site-to-Site VPN (backup) ═══╝
BGP: DX has lower local-pref/shorter AS-PATH = preferred
     VPN is automatic failover if DX fails
\`\`\`

## Advanced VPC Design

### VPC Sharing (Resource Access Manager)

\`\`\`bash
# Share subnets from a VPC between accounts in the same Organization
aws ram create-resource-share \
  --name "shared-vpc-subnets" \
  --resource-arns \
    arn:aws:ec2:us-east-1:123456789012:subnet/subnet-shared-a \
    arn:aws:ec2:us-east-1:123456789012:subnet/subnet-shared-b \
  --principals 987654321098  # consumer account ID

# Consumer account can launch resources in shared subnets
# without having its own VPC — reduces VPC peering costs
\`\`\`

### PrivateLink for Service Exposure

\`\`\`bash
# Create VPC Endpoint Service (provider)
aws ec2 create-vpc-endpoint-service-configuration \
  --network-load-balancer-arns arn:aws:elasticloadbalancing:... \
  --acceptance-required false \
  --tag-specifications "ResourceType=vpc-endpoint-service,Tags=[{Key=Name,Value=my-service}]"

# Consumer creates Interface Endpoint
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
| Level | Instance (stateful) | Subnet (stateless) | VPC (L3-L7) |
| Rules | Allow only | Allow + Deny | Allow + Deny + IDS/IPS |
| Deep inspection | No | No | Yes (L7, FQDN) |
| Stateful | Yes | No | Yes |

## Common Mistakes

1. **DX without redundancy**: a single Direct Connect connection is a single point of failure — always configure redundant DX or DX + VPN backup.
2. **Transit Gateway without isolation route table**: by default, all attachments communicate. Configure route tables to isolate prod from dev.
3. **VPC Peering for many VPCs**: peering between N VPCs requires N*(N-1)/2 connections. For >5 VPCs, Transit Gateway is more efficient.
4. **PrivateLink without DNS**: creating Interface Endpoint without private DNS enabled — applications use the public IP of the service.

## Killer.sh Style Challenge (SAP-C02)

> A company has 15 VPCs across 3 AWS accounts (prod, dev, shared-services) and an on-premises connection. Design connectivity that: isolates prod from dev, allows all to access shared-services, connects on-premises to prod only.
>
> **Answer**: Transit Gateway per account + TGW peering between accounts. 3 Route Tables in the TGW: (1) prod-rt: route to shared + on-premises, no route to dev. (2) dev-rt: route to shared, no route to prod or on-premises. (3) shared-rt: route to prod and dev (bidirectional access). Direct Connect in prod account with propagation only to prod-rt. RAM to share TGW between accounts.
`,

  quiz: [
    {
      question: 'When should you use Transit Gateway instead of VPC Peering to connect multiple VPCs?',
      options: [
        'Transit Gateway is always cheaper than VPC Peering',
        'For more than 3-5 VPCs, Transit Gateway is more efficient because N VPCs only need N attachments to TGW vs N*(N-1)/2 peerings',
        'VPC Peering does not support cross-account connections, so TGW is required',
        'Transit Gateway allows greater bandwidth than VPC Peering'
      ],
      correct: 1,
      explanation: 'VPC Peering is non-transitive: for VPC-A, VPC-B, and VPC-C to communicate with each other, you need 3 peerings (A-B, B-C, A-C). For 10 VPCs: 45 peerings. Transit Gateway centralizes: each VPC makes only 1 attachment to the TGW, which routes to all. Additionally, TGW supports multiple route tables for isolation, which VPC Peering does not offer natively.',
      reference: 'Transit Gateway section — the practical rule: > 5 VPCs or need for isolation = Transit Gateway.'
    },
    {
      question: 'How do you ensure high availability of hybrid connectivity with Direct Connect?',
      options: [
        'Using only DX with 99.999% SLA is sufficient',
        'Configure two redundant Direct Connect connections (different DX locations) OR one DX as primary and Site-to-Site VPN as automatic backup via BGP',
        'DX has automatic redundancy — no additional configuration needed',
        'Replicate all data to the AWS region closest to on-premises'
      ],
      correct: 1,
      explanation: 'Direct Connect by itself does not have a high availability SLA without explicit redundancy. Options: (1) Dual DX in different locations = maximum HA, high cost. (2) DX as primary + Site-to-Site VPN as backup via BGP = good HA, lower cost. BGP automatically routes to the connection with the best local-preference (DX has shorter AS-PATH by default). The VPN automatically kicks in when DX fails.',
      reference: 'DX + VPN for HA section — configure BGP correctly: DX must have lower local-pref to be preferred.'
    }
  ],

  flashcards: [
    {
      front: 'What is AWS Transit Gateway and what are its main components?',
      back: '**Transit Gateway** = regional hub to connect VPCs, on-premises, and inter-region.\n\n**Components**:\n- **Attachments**: VPC, VPN, Direct Connect Gateway, TGW Peering\n- **Route Tables**: routing tables (isolate prod from dev)\n- **Associations**: each attachment associates to a route table\n- **Propagations**: routes learned via BGP propagate to route tables\n\n**Advantage vs VPC Peering**:\n- N VPCs = N attachments (not N*(N-1)/2)\n- Transitive (A→TGW→B→TGW→C)\n- Route tables for traffic isolation\n- Centralizes on-premises connectivity'
    },
    {
      front: 'How do you use AWS PrivateLink to expose a service to other VPCs or accounts without VPC Peering?',
      back: '**PrivateLink** = exposes service via private IP without opening the entire VPC peering.\n\n**Architecture**:\n```\nProvider:  NLB → Service Endpoint\n                  ↓ (VPC Endpoint Service)\nConsumer:         Interface Endpoint (private IP)\n                  ↓ (DNS resolves to private IP)\n             App uses service without knowing it is external\n```\n\n**Advantages**:\n- No problematic CIDR overlap\n- Consumer does not access the entire provider VPC\n- Cross-account and cross-region\n- More secure than VPC Peering\n\n**Use**: internal SaaS services, shared APIs between accounts.'
    }
  ],

  lab: {
    scenario: 'Explore how to configure VPC endpoints for AWS services via PrivateLink.',
    objective: 'Create a Gateway Endpoint for S3 and an Interface Endpoint for SSM, understanding endpoint types.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create Gateway Endpoint for S3',
        instruction: 'Create a VPC Gateway Endpoint for S3 (traffic stays on the AWS network without NAT Gateway).',
        hints: ['Gateway Endpoints: S3 and DynamoDB only', 'Free, does not use PrivateLink'],
        solution: `\`\`\`bash
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" \
  --query "Vpcs[0].VpcId" --output text)

RT_ID=$(aws ec2 describe-route-tables \
  --filters "Name=vpc-id,Values=$VPC_ID" "Name=association.main,Values=true" \
  --query "RouteTables[0].RouteTableId" --output text)

# Create Gateway Endpoint for S3 (free)
aws ec2 create-vpc-endpoint \
  --vpc-id $VPC_ID \
  --service-name com.amazonaws.us-east-1.s3 \
  --vpc-endpoint-type Gateway \
  --route-table-ids $RT_ID

echo "S3 Gateway Endpoint created - S3 traffic does not go through the internet"
\`\`\``,
        verify: `\`\`\`bash
aws ec2 describe-vpc-endpoints \
  --filters "Name=service-name,Values=com.amazonaws.us-east-1.s3" "Name=state,Values=available" \
  --query "VpcEndpoints[0].{ID:VpcEndpointId,Type:VpcEndpointType,State:State}" \
  --output table
# Expected: Gateway, available
\`\`\``
      },
      {
        title: 'Verify connectivity and clean up',
        instruction: 'Verify that the endpoint was added to the route table and understand the comparative cost.',
        hints: ['Gateway Endpoint = free; Interface Endpoint = ~$0.01/hour per AZ', 'Route table shows route to pl-63a5400a (S3)'],
        solution: `\`\`\`bash
# Verify route added in the route table
aws ec2 describe-route-tables \
  --route-table-ids $RT_ID \
  --query "RouteTables[0].Routes[?GatewayId!=null && contains(GatewayId,'vpce')]" \
  --output json

echo "=== Cost comparison (us-east-1) ==="
echo "Gateway Endpoint (S3, DynamoDB): FREE"
echo "Interface Endpoint (SSM, EC2, etc.): ~\$0.01/hour/AZ + \$0.01/GB"
echo ""
echo "For 100 instances in 3 AZs accessing SSM:"
echo "Interface Endpoint: 3 × \$0.01/hour = ~\$21.60/month + data"
echo "Without endpoint: traffic via NAT Gateway = \$0.045/GB (expensive for SSM logs)"

# Clean up
ENDPOINT_ID=$(aws ec2 describe-vpc-endpoints \
  --filters "Name=service-name,Values=com.amazonaws.us-east-1.s3" \
  --query "VpcEndpoints[0].VpcEndpointId" --output text)
aws ec2 delete-vpc-endpoints --vpc-endpoint-ids $ENDPOINT_ID 2>/dev/null
echo "Endpoint deleted"
\`\`\``,
        verify: `\`\`\`bash
aws ec2 describe-vpc-endpoints \
  --filters "Name=service-name,Values=com.amazonaws.us-east-1.s3" "Name=state,Values=available" \
  --query "VpcEndpoints" --output text
# Expected: (empty - endpoint deleted)
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Traffic from TGW-attached VPCs cannot communicate',
      difficulty: 'hard',
      symptom: 'Two VPCs were attached to the Transit Gateway but instances in VPC-A cannot ping VPC-B even though the attachment is "available".',
      diagnosis: `\`\`\`bash
# 1. Check route tables in VPCs (must point to TGW)
aws ec2 describe-route-tables --filters "Name=vpc-id,Values=vpc-a" \
  --query "RouteTables[].Routes[?TransitGatewayId!=null]" --output json

# 2. Check TGW route tables (must have routes for the CIDRs)
aws ec2 search-transit-gateway-routes \
  --transit-gateway-route-table-id tgw-rtb-xxx \
  --filters "Name=state,Values=active" --output table
\`\`\``,
      solution: `**Complete checklist**:

1. **Route Table in the VPC**: the source subnet needs a route to the destination CIDR via TGW:
\`\`\`bash
aws ec2 create-route --route-table-id rtb-vpc-a \
  --destination-cidr-block 10.2.0.0/16 \
  --transit-gateway-id tgw-xxx
\`\`\`

2. **TGW Route Table**: the VPC-A attachment must have a route to the VPC-B CIDR:
\`\`\`bash
aws ec2 create-transit-gateway-route \
  --transit-gateway-route-table-id tgw-rtb-xxx \
  --destination-cidr-block 10.2.0.0/16 \
  --transit-gateway-attachment-id tgw-attach-vpc-b
\`\`\`

3. **Security Groups**: allow traffic in the destination SG:
\`\`\`bash
aws ec2 authorize-security-group-ingress --group-id sg-vpc-b \
  --protocol icmp --port -1 --cidr 10.1.0.0/16
\`\`\`

4. **NACLs**: if NACLs are configured, check inbound and outbound rules (stateless).`
    }
  ]
};
