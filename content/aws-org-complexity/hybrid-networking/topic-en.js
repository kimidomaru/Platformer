window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['aws-org-complexity/hybrid-networking'] = {
  theory: `# Hybrid & Multi-Region Networking

## Exam Relevance
> **Design for Organizational Complexity** is worth **26%** of SAP-C02. Hybrid connectivity patterns, Transit Gateway advanced features, Direct Connect resilience, and multi-Region networking are heavily tested.

## AWS Transit Gateway (TGW)

Central hub for connecting VPCs and on-premises networks at scale:
- **Route Tables**: TGW has its own route tables. Each attachment (VPC, VPN, DX GW) associated to a route table.
- **Peering**: connect TGWs across Regions (inter-Region TGW peering) — no bandwidth bottleneck
- **Multicast**: IP multicast support across attached VPCs
- **Network Manager**: global view of on-prem + cloud topology
- **TGW Connect**: SD-WAN integration over GRE (faster than VPN)

### TGW vs VPC Peering
| Factor | VPC Peering | Transit Gateway |
|--------|-------------|-----------------|
| **Scale** | N*(N-1)/2 connections | Hub-and-spoke, N connections |
| **Routing** | Non-transitive | Transitive |
| **Bandwidth** | No limit (within Region) | 50 Gbps per AZ per attachment |
| **Cross-Region** | Yes | Yes (TGW peering) |
| **Cost** | Data transfer only | Per attachment + data |

## AWS Direct Connect (DX)

Dedicated private connection from on-premises to AWS:
- **Dedicated Connection**: 1, 10, or 100 Gbps directly from AWS
- **Hosted Connection**: smaller speeds (50 Mbps – 10 Gbps) via DX partner
- **Virtual Interfaces (VIFs)**:
  - **Private VIF**: access VPC resources via private IP
  - **Public VIF**: access AWS public services (S3, DynamoDB) via DX
  - **Transit VIF**: connect to Transit Gateway (best for multi-VPC)
- **DX Gateway**: connect single DX to multiple VPCs in different Regions (same account)
- **LAG**: Link Aggregation Group — bundle multiple DX for higher bandwidth + redundancy

### DX Resilience Patterns

| Pattern | Availability | Design |
|---------|-------------|--------|
| **Single DX** | ~99.9% | Basic; single point of failure |
| **Dual DX (same location)** | ~99.95% | Two connections, same DX location |
| **Dual DX (different locations)** | ~99.99% | Maximum resilience |
| **DX + VPN backup** | ~99.95% | DX primary, VPN as failover |

BGP routing: use different BGP communities to prefer DX over VPN.

## Site-to-Site VPN

| Feature | Value |
|---------|-------|
| **Tunnels per VPN** | 2 (active/standby by default, active/active with ECMP on TGW) |
| **Bandwidth** | 1.25 Gbps per tunnel |
| **Encryption** | IKEv1/IKEv2, AES-128/256 |
| **Routing** | Static or BGP (dynamic) |
| **HA** | Use 2 customer gateways (2 physical devices) |

**Accelerated VPN**: routes VPN traffic through AWS Global Accelerator for better performance.

## AWS PrivateLink (VPC Endpoint Services)

Expose services to other VPCs/accounts without internet or VPC peering:
- **Interface Endpoint**: ENI in your VPC subnet — connects to supported AWS services or PrivateLink services
- **Gateway Endpoint**: S3 and DynamoDB only — no data transfer charges
- **PrivateLink**: service provider creates NLB, consumers create Interface Endpoint
- **DNS resolution**: must be enabled in the VPC for private DNS names to resolve

## AWS Global Accelerator

Improve global application availability and performance:
- **Anycast IPs**: 2 static IPs that route to nearest AWS edge location
- **TCP/UDP traffic**: not HTTP-only (unlike CloudFront)
- **Health checks**: automatic failover to healthy endpoints
- **Traffic dials**: shift traffic percentage between endpoint groups
- **Use cases**: multi-Region failover, gaming, IoT, non-HTTP workloads

### Global Accelerator vs CloudFront
| Factor | Global Accelerator | CloudFront |
|--------|-------------------|------------|
| **Protocol** | TCP/UDP | HTTP/HTTPS |
| **Caching** | No | Yes |
| **Use case** | Performance + HA | Content delivery |
| **IPs** | Static Anycast IPs | Dynamic |

## Network Firewall

Managed stateful firewall for VPCs:
- **Stateful inspection**: track connection state
- **Suricata rules**: open-source IDS/IPS rule format
- **Centralized inspection**: inspect traffic through TGW with firewall VPC
- **Integration**: CloudWatch, S3 for logs

## Common Exam Mistakes

- Using VPC peering for many VPCs (use TGW for hub-and-spoke)
- Not knowing DX Gateway enables one DX connection to reach multiple Regions
- Forgetting Accelerated VPN for latency-sensitive VPN over internet
- Confusing Global Accelerator (TCP/UDP, performance) with CloudFront (HTTP, caching)
- Not configuring dual customer gateways for VPN HA
`,

  quiz: [
    {
      question: 'When should you choose Transit Gateway over VPC Peering?',
      options: ['Always — TGW is always better', 'When you have many VPCs needing transitive connectivity (hub-and-spoke)', 'Only for cross-Region connections', 'Only when bandwidth exceeds 10 Gbps'],
      correct: 1,
      explanation: 'TGW is ideal for hub-and-spoke at scale: N connections instead of N*(N-1)/2 for full mesh. TGW supports transitive routing (VPC A -> TGW -> VPC B). VPC Peering is cheaper and simpler for small numbers of VPCs.',
      reference: 'TGW = transitive, hub-and-spoke. VPC Peering = non-transitive, simpler/cheaper for few VPCs.'
    },
    {
      question: 'What is the difference between Direct Connect Private VIF and Transit VIF?',
      options: ['No difference, they are the same', 'Private VIF connects to a single VPC; Transit VIF connects to a Transit Gateway (many VPCs)', 'Transit VIF is faster', 'Private VIF requires BGP'],
      correct: 1,
      explanation: 'Private VIF: connects DX directly to a single VPC. Transit VIF: connects DX to a Transit Gateway, which can then route to many VPCs. For multi-VPC connectivity, use DX Gateway + Transit VIF.',
      reference: 'Private VIF = one VPC. Transit VIF = TGW = many VPCs. DX Gateway = multi-Region.'
    },
    {
      question: 'What is the highest resiliency pattern for Direct Connect?',
      options: ['Single DX connection with VPN backup', 'Dual DX connections at the same DX location', 'Dual DX connections at different DX locations', 'DX with multiple VIFs'],
      correct: 2,
      explanation: 'Maximum resilience: two DX connections at different physical DX locations. This protects against DX location failure. Same-location dual gives ~99.95% vs ~99.99% for different locations.',
      reference: 'Max DX resilience = dual connections, different DX locations (~99.99%). Same location = 99.95%.'
    },
    {
      question: 'What does AWS Global Accelerator provide that CloudFront does NOT?',
      options: ['Content caching at edge', 'TCP/UDP optimization and static Anycast IPs for non-HTTP workloads', 'DDoS protection', 'Custom SSL certificates'],
      correct: 1,
      explanation: 'Global Accelerator: TCP/UDP support, static Anycast IPs, routes to nearest edge over AWS backbone. CloudFront: HTTP/HTTPS only, content caching. Use Global Accelerator for gaming, IoT, non-HTTP workloads.',
      reference: 'Global Accelerator = TCP/UDP, static IPs, performance. CloudFront = HTTP, caching, content delivery.'
    },
    {
      question: 'Which VPN feature enables both tunnels to be active simultaneously on Transit Gateway?',
      options: ['HA VPN', 'BGP routing', 'ECMP (Equal Cost Multi-Path)', 'Accelerated VPN'],
      correct: 2,
      explanation: 'By default, S2S VPN has 2 tunnels (active/standby). With TGW and ECMP enabled, both tunnels can be active simultaneously, effectively doubling bandwidth to 2.5 Gbps per VPN connection.',
      reference: 'ECMP on TGW = active/active VPN tunnels = 2x bandwidth (2.5 Gbps per connection).'
    },
    {
      question: 'What is the purpose of a DX Gateway?',
      options: ['Connect DX to the internet', 'Allow a single DX connection to reach VPCs in multiple AWS Regions', 'Encrypt Direct Connect traffic', 'Act as a VPN gateway'],
      correct: 1,
      explanation: 'DX Gateway: global resource that allows a single DX connection to connect to VPCs across multiple Regions. Without it, you would need a separate DX connection per Region.',
      reference: 'DX Gateway = one DX connection -> multiple Regions. Global resource, no additional cost.'
    },
    {
      question: 'What is the difference between Interface Endpoint and Gateway Endpoint?',
      options: ['Interface supports S3 and DynamoDB; Gateway supports all services', 'Gateway supports only S3 and DynamoDB (free); Interface supports most AWS services via ENI (cost per hour)', 'They are identical', 'Interface is faster'],
      correct: 1,
      explanation: 'Gateway Endpoint: free, only for S3 and DynamoDB, uses route table entries. Interface Endpoint: hourly cost, uses ENI in subnet, supports most AWS services and PrivateLink services.',
      reference: 'Gateway Endpoint = S3/DynamoDB, free, route table. Interface Endpoint = ENI, hourly cost, most services.'
    },
    {
      question: 'What is Accelerated Site-to-Site VPN?',
      options: ['VPN with hardware acceleration', 'VPN that uses AWS Global Accelerator to optimize routing over the AWS backbone instead of the public internet', 'A faster type of Direct Connect', 'VPN with ECMP enabled'],
      correct: 1,
      explanation: 'Accelerated VPN routes VPN traffic through Global Accelerator edge locations then over the AWS backbone. Reduces latency for customers far from AWS Regions. Works with Transit Gateway.',
      reference: 'Accelerated VPN = VPN over Global Accelerator backbone. Better latency than public internet.'
    }
  ],

  flashcards: [
    { front: 'Transit Gateway vs VPC Peering?', back: 'TGW: transitive routing, hub-and-spoke (N connections), supports TGW peering, 50 Gbps/AZ/attachment, per-attachment cost. VPC Peering: non-transitive, N*(N-1)/2 connections, data transfer only, simpler for few VPCs.' },
    { front: 'Direct Connect VIF types?', back: 'Private VIF: single VPC via private IP. Public VIF: AWS public services (S3, DynamoDB, etc.) via DX. Transit VIF: connect to TGW (many VPCs, many Regions). Use DX Gateway for multi-Region.' },
    { front: 'DX resilience patterns?', back: 'Single DX: 99.9%, SPOF. Dual DX same location: 99.95%. Dual DX different locations: 99.99% (maximum). DX + VPN backup: 99.95%. BGP communities to prefer DX over VPN.' },
    { front: 'Global Accelerator features?', back: '2 static Anycast IPs -> nearest edge location. TCP/UDP support (not just HTTP). Routes over AWS backbone. Traffic dials for percentage shifting. Health checks + automatic failover. For gaming, IoT, non-HTTP.' },
    { front: 'VPC Endpoints comparison?', back: 'Gateway Endpoint: S3 + DynamoDB only, free, route table entries, no VPC changes. Interface Endpoint: most services + PrivateLink, ENI in subnet, hourly+data cost, requires DNS resolution enabled.' },
    { front: 'Site-to-Site VPN key facts?', back: '2 tunnels per VPN (active/standby). 1.25 Gbps per tunnel. ECMP on TGW = active/active (2.5 Gbps). Accelerated VPN = Global Accelerator backbone. For HA: 2 customer gateways.' },
    { front: 'AWS Network Firewall?', back: 'Managed stateful VPC firewall. Suricata IDS/IPS rules. Centralized inspection via TGW + dedicated firewall VPC. Logs to CloudWatch/S3/Kinesis. For deep packet inspection across VPCs.' },
    { front: 'DX Gateway use case?', back: 'Connect ONE Direct Connect connection to VPCs in MULTIPLE Regions (global resource). Without DX Gateway, one DX per Region. Pair with Transit VIF for multi-VPC per Region.' }
  ],

  lab: {
    scenario: 'Design a resilient hybrid connectivity architecture for an enterprise with on-premises data center.',
    objective: 'Practice Transit Gateway setup, VPN configuration, and connectivity validation.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Create Transit Gateway and Attachments',
        instruction: 'Create a Transit Gateway and attach two VPCs to it, then verify transitive routing.',
        hints: ['TGW needs route table entries in VPC route tables', 'TGW propagates routes automatically if enabled'],
        solution: '```bash\n# Create Transit Gateway\naws ec2 create-transit-gateway \\\n  --description "Enterprise TGW" \\\n  --options AmazonSideAsn=64512,AutoAcceptSharedAttachments=enable,DefaultRouteTableAssociation=enable,DefaultRouteTablePropagation=enable\n\n# Attach VPC-A\naws ec2 create-transit-gateway-vpc-attachment \\\n  --transit-gateway-id tgw-xxxx \\\n  --vpc-id vpc-aaaa \\\n  --subnet-ids subnet-1111 subnet-2222\n\n# Attach VPC-B\naws ec2 create-transit-gateway-vpc-attachment \\\n  --transit-gateway-id tgw-xxxx \\\n  --vpc-id vpc-bbbb \\\n  --subnet-ids subnet-3333 subnet-4444\n\n# Update VPC route tables to route to TGW\naws ec2 create-route --route-table-id rtb-aaaa \\\n  --destination-cidr-block 10.1.0.0/16 \\\n  --transit-gateway-id tgw-xxxx\n```',
        verify: '```bash\naws ec2 describe-transit-gateway-attachments \\\n  --filters Name=transit-gateway-id,Values=tgw-xxxx\n# Expected: 2 attachments in state "available"\n\naws ec2 get-transit-gateway-route-table-propagations \\\n  --transit-gateway-route-table-id tgw-rtb-xxxx\n# Expected: both VPC CIDRs propagated\n```'
      },
      {
        title: 'Configure Site-to-Site VPN with BGP',
        instruction: 'Create a Customer Gateway and Site-to-Site VPN connected to the Transit Gateway with BGP routing.',
        hints: ['Customer Gateway needs the public IP of your on-prem router', 'BGP ASN for on-prem must differ from AWS side'],
        solution: '```bash\n# Create Customer Gateway\naws ec2 create-customer-gateway \\\n  --type ipsec.1 \\\n  --public-ip 203.0.113.1 \\\n  --bgp-asn 65000\n\n# Create Site-to-Site VPN attached to TGW\naws ec2 create-vpn-connection \\\n  --type ipsec.1 \\\n  --customer-gateway-id cgw-xxxx \\\n  --transit-gateway-id tgw-xxxx \\\n  --options TunnelOptions=[{PreSharedKey=MyKey1},{PreSharedKey=MyKey2}]\n```',
        verify: '```bash\naws ec2 describe-vpn-connections \\\n  --filters Name=transit-gateway-id,Values=tgw-xxxx\n# Expected: VPN in state "available"\n# VgwTelemetry: 2 tunnels, Status = UP\n\n# Download VPN config for on-prem router\naws ec2 get-vpn-connection-device-sample-configuration \\\n  --vpn-connection-id vpn-xxxx \\\n  --vpn-connection-device-type-id "Generic"\n```'
      },
      {
        title: 'Create VPC Interface Endpoint for Private S3 Access',
        instruction: 'Create an S3 Gateway Endpoint in a VPC so EC2 instances access S3 without traversing the internet.',
        hints: ['Gateway endpoints are free and do not require an ENI', 'Route table must be updated'],
        solution: '```bash\n# Create S3 Gateway Endpoint\naws ec2 create-vpc-endpoint \\\n  --vpc-id vpc-aaaa \\\n  --service-name com.amazonaws.us-east-1.s3 \\\n  --route-table-ids rtb-aaaa rtb-bbbb\n\n# For private API Gateway / other services: Interface Endpoint\naws ec2 create-vpc-endpoint \\\n  --vpc-id vpc-aaaa \\\n  --vpc-endpoint-type Interface \\\n  --service-name com.amazonaws.us-east-1.execute-api \\\n  --subnet-ids subnet-1111 \\\n  --security-group-ids sg-xxxx \\\n  --private-dns-enabled\n```',
        verify: '```bash\naws ec2 describe-vpc-endpoints \\\n  --filters Name=vpc-id,Values=vpc-aaaa\n# Expected: S3 gateway endpoint with State=available\n# Route table has pl-XXXXXX (S3 prefix list) as destination\n\n# Verify from EC2 instance (no public IP needed)\n# aws s3 ls (should work without internet gateway route)\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'TGW Routes Not Propagating Between VPCs',
      difficulty: 'medium',
      symptom: 'VPC A instances cannot reach VPC B instances despite both VPCs being attached to the same Transit Gateway.',
      diagnosis: '```\nChecklist for TGW connectivity:\n1. TGW Attachments:\n   aws ec2 describe-transit-gateway-attachments\n   State must be "available" (not pending/failed)\n\n2. TGW Route Table propagation:\n   aws ec2 get-transit-gateway-route-table-propagations \\\n     --transit-gateway-route-table-id tgw-rtb-xxxx\n   Both VPC CIDRs must appear\n\n3. VPC Route Tables:\n   Routes in VPC A subnet RT must point 10.1.0.0/16 -> TGW\n   Routes in VPC B subnet RT must point 10.0.0.0/16 -> TGW\n\n4. Security Groups:\n   Allow traffic from the other VPC CIDR\n\n5. Subnet selection:\n   TGW attachment subnets must be in each AZ that needs connectivity\n```',
      solution: 'Check all four layers: (1) TGW attachment state = available, (2) TGW route table has both VPC CIDRs, (3) VPC subnet route tables have routes pointing to TGW, (4) Security Groups allow the traffic. TGW is often misconfigured at the VPC route table level.'
    },
    {
      title: 'Direct Connect BGP Session Not Establishing',
      difficulty: 'hard',
      symptom: 'Direct Connect connection is up but BGP session fails to establish for the Virtual Interface.',
      diagnosis: '```\nBGP troubleshooting checklist:\n1. BGP ASN mismatch:\n   AWS VIF BGP ASN must match customer router config\n   Check: aws directconnect describe-virtual-interfaces\n   Field: asn (AWS side) vs customerRouterConfig\n\n2. BGP authentication:\n   MD5 key must match exactly on both sides\n\n3. BGP neighbor IP:\n   AWS peer IP from console vs configured on router\n   Example: AWS=169.254.x.1/30, Customer=169.254.x.2/30\n\n4. MTU mismatch:\n   Recommended: 1500 for Private VIF, 9001 for Jumbo frames\n   Mismatch causes session to flap\n\n5. VLAN tagging:\n   VLAN must match the VIF configuration\n\nMetrics:\n  CloudWatch: ConnectionBpsIngress (should show traffic)\n  BGP state: aws directconnect describe-virtual-interfaces\n  bGPpeers field\n```',
      solution: 'Verify BGP ASN, neighbor IPs (from AWS VIF config), MD5 auth key, VLAN ID, and MTU on the customer router. All parameters must match the AWS VIF configuration exactly. Use aws directconnect describe-virtual-interfaces to get the exact parameters AWS expects.'
    }
  ]
};
