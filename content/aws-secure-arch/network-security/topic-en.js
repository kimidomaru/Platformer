window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['aws-secure-arch/network-security'] = {
  theory: `# Network Security

## Exam Relevance
> **Design Secure Architectures** is worth **30%** of SAA-C03. Security Groups, NACLs, WAF, Shield, VPC endpoints, and network segmentation are core topics.

## Security Groups vs NACLs

| Feature | Security Groups | Network ACLs |
|---------|----------------|--------------|
| **Level** | Instance (ENI) | Subnet |
| **State** | Stateful (return traffic auto-allowed) | Stateless (must allow return traffic explicitly) |
| **Rules** | Allow only | Allow AND Deny |
| **Evaluation** | All rules evaluated together | Rules processed in order (lowest number first) |
| **Default** | Deny all inbound, allow all outbound | Allow all inbound and outbound |
| **Association** | Multiple SGs per instance | One NACL per subnet |

### Security Groups — Key Points
- Stateful: if inbound is allowed, outbound response is automatic
- Can reference other SGs (e.g., allow from sg-alb)
- Changes take effect immediately
- No deny rules — only allow

### NACLs — Key Points
- Stateless: must define BOTH inbound and outbound rules
- Rule numbers: processed low to high, first match wins
- Rule 100 Allow HTTP, Rule 200 Deny HTTP -> ALLOW (100 matches first)
- Ephemeral ports (1024-65535) must be allowed for return traffic
- Custom NACL denies all by default (unlike default NACL)

## AWS WAF (Web Application Firewall)

Protects ALB, CloudFront, API Gateway, AppSync, Cognito from web exploits.

### Components
- **Web ACL**: container for rules, associated with resources
- **Rules**: IP match, rate-based (DDoS/brute force), SQL injection, XSS, geo match, size constraints
- **Managed Rule Groups**: AWS Managed (AmazonIPReputationList, CommonRuleSet, SQLiRuleSet) and Marketplace
- **Rate-based rules**: block IPs exceeding threshold (e.g., 2000 requests/5 min)

## AWS Shield

| Feature | Shield Standard | Shield Advanced |
|---------|----------------|-----------------|
| **Cost** | Free (all accounts) | \\$3,000/month + data transfer |
| **Protection** | L3/L4 DDoS | L3/L4/L7 DDoS |
| **Support** | None | DRT (DDoS Response Team) 24/7 |
| **Cost protection** | No | Yes (credits for scaling costs) |
| **Visibility** | Basic | Real-time metrics, forensics |
| **Integration** | Automatic | WAF, CloudFront, ALB, NLB, EIP, Global Accelerator |

## AWS Firewall Manager

Centralized security management across AWS Organization:
- Manage WAF rules, Shield Advanced, Security Groups, Network Firewall, Route 53 DNS Firewall
- Auto-apply rules to new accounts/resources
- Requires AWS Organizations

## VPC Endpoints

| Type | Gateway Endpoint | Interface Endpoint |
|------|-----------------|-------------------|
| **Services** | S3 and DynamoDB only | 100+ AWS services |
| **Implementation** | Route table entry | ENI in subnet (PrivateLink) |
| **Cost** | Free | \\$0.01/hour + \\$0.01/GB data |
| **Security** | Endpoint policy | Endpoint policy + Security Groups |
| **DNS** | Uses public DNS | Private DNS (optional) |

## AWS PrivateLink

Expose your service to other VPCs/accounts privately:
- Service provider: NLB + VPC Endpoint Service
- Service consumer: Interface VPC Endpoint
- No VPC peering, internet, NAT, or VPN needed
- Traffic stays on AWS backbone

## AWS Network Firewall

Managed firewall deployed in a dedicated firewall subnet:
- Stateless rules: 5-tuple (src/dst IP, port, protocol), action: pass/drop/forward-to-stateful
- Stateful rules: Suricata-compatible IPS, domain list filtering, TLS inspection
- Integrates with Firewall Manager for Organization-wide deployment
- Use with Gateway Load Balancer for third-party appliance inspection

## Common Exam Mistakes

- Confusing stateful (SG) with stateless (NACL)
- Forgetting ephemeral ports for NACL return traffic
- Using VPC peering when PrivateLink is more appropriate
- Not knowing Gateway Endpoints are free (S3 + DynamoDB)
- Confusing Shield Standard (free, L3/L4) with Advanced (paid, L7+DRT)
`,

  quiz: [
    {
      question: 'What is the key difference between Security Groups and NACLs?',
      options: ['Security Groups are free, NACLs are paid', 'Security Groups are stateful, NACLs are stateless', 'NACLs only apply to EC2, Security Groups to all resources', 'Security Groups support deny rules, NACLs do not'],
      correct: 1,
      explanation: 'Security Groups are stateful (return traffic automatically allowed). NACLs are stateless (you must explicitly allow return traffic including ephemeral ports).',
      reference: 'Stateful = SG. Stateless = NACL. This distinction is tested frequently.'
    },
    {
      question: 'A NACL has Rule 100: Allow HTTP, Rule 200: Deny HTTP. What happens to HTTP traffic?',
      options: ['Denied (deny overrides allow)', 'Allowed (Rule 100 is processed first)', 'Depends on Security Group', 'Both rules cancel out'],
      correct: 1,
      explanation: 'NACL rules are processed in order from lowest to highest number. Rule 100 matches first and allows the traffic. Rule 200 is never evaluated.',
      reference: 'NACL = ordered rules (first match wins). SG = all rules evaluated together.'
    },
    {
      question: 'Which VPC Endpoint type is free and supports S3?',
      options: ['Interface Endpoint', 'Gateway Endpoint', 'PrivateLink Endpoint', 'Service Endpoint'],
      correct: 1,
      explanation: 'Gateway Endpoints are free and support only S3 and DynamoDB. They add a route table entry. Interface Endpoints use PrivateLink (ENI) and cost \\$0.01/hour.',
      reference: 'Gateway = free, S3+DynamoDB, route table. Interface = paid, 100+ services, ENI.'
    },
    {
      question: 'What does AWS Shield Advanced provide that Standard does not?',
      options: ['Basic DDoS protection', 'Layer 7 DDoS protection, DRT team, and cost protection', 'VPC firewall rules', 'WAF web ACL management'],
      correct: 1,
      explanation: 'Shield Advanced (\\$3000/mo) adds L7 DDoS protection, 24/7 DDoS Response Team (DRT), cost protection credits, and real-time attack visibility. Standard is free L3/L4 only.',
      reference: 'Standard = free L3/L4. Advanced = L7, DRT, cost protection, \\$3000/mo.'
    },
    {
      question: 'How does AWS PrivateLink work?',
      options: ['VPC peering with encryption', 'Service provider exposes via NLB, consumer accesses via Interface Endpoint', 'Direct Connect tunnel', 'S3 bucket sharing'],
      correct: 1,
      explanation: 'PrivateLink: provider creates NLB + Endpoint Service, consumer creates Interface VPC Endpoint. Traffic stays on AWS backbone. No internet, peering, or NAT needed.',
      reference: 'PrivateLink = NLB (provider) + Interface Endpoint (consumer). Private, no internet.'
    },
    {
      question: 'What is AWS Firewall Manager used for?',
      options: ['Managing EC2 firewalls', 'Centralized security policy management across an Organization', 'Replacing Security Groups', 'DDoS response'],
      correct: 1,
      explanation: 'Firewall Manager centrally manages WAF rules, Shield Advanced, Security Groups, Network Firewall, and DNS Firewall across all accounts in an AWS Organization.',
      reference: 'Firewall Manager = centralized policy. Requires AWS Organizations.'
    },
    {
      question: 'Which AWS WAF rule type helps protect against brute force or DDoS?',
      options: ['IP match rule', 'Rate-based rule', 'Geo match rule', 'Size constraint rule'],
      correct: 1,
      explanation: 'Rate-based rules block IPs that exceed a request threshold (e.g., 2000 requests per 5 minutes). Useful for brute force login attempts and HTTP flood DDoS.',
      reference: 'Rate-based = threshold blocking. IP match = specific IPs. Geo = country blocking.'
    },
    {
      question: 'What must you remember when configuring NACLs for web traffic?',
      options: ['Only allow port 80', 'Allow inbound port 80 AND outbound ephemeral ports (1024-65535)', 'NACLs handle return traffic automatically', 'Set Security Group rules instead'],
      correct: 1,
      explanation: 'NACLs are stateless. You must allow inbound HTTP (port 80) AND outbound ephemeral ports (1024-65535) for response traffic. Forgetting ephemeral ports breaks connectivity.',
      reference: 'Stateless = explicit rules for BOTH directions. Ephemeral ports for return traffic.'
    }
  ],

  flashcards: [
    { front: 'Security Groups vs NACLs?', back: 'SG: stateful, instance-level, allow only, all rules evaluated. NACL: stateless, subnet-level, allow+deny, ordered rules (first match wins). SG return traffic auto-allowed; NACL needs explicit ephemeral port rules.' },
    { front: 'What are the two VPC Endpoint types?', back: 'Gateway: free, S3+DynamoDB only, route table entry. Interface: PrivateLink, ENI in subnet, 100+ services, \\$0.01/hour+data, supports Security Groups.' },
    { front: 'AWS Shield Standard vs Advanced?', back: 'Standard: free, all accounts, L3/L4 DDoS auto-protection. Advanced: \\$3000/mo, L7 DDoS, DRT team 24/7, cost protection credits, real-time metrics, for ALB/NLB/CloudFront/EIP.' },
    { front: 'What is AWS PrivateLink?', back: 'Privately expose services across VPCs/accounts. Provider: NLB + Endpoint Service. Consumer: Interface VPC Endpoint. Traffic on AWS backbone, no internet/peering/NAT needed.' },
    { front: 'What does AWS WAF protect against?', back: 'Web exploits: SQL injection, XSS, HTTP floods (rate-based), IP reputation, geo blocking. Protects ALB, CloudFront, API Gateway, AppSync. Uses Web ACLs with managed + custom rules.' },
    { front: 'What is AWS Network Firewall?', back: 'Managed firewall in VPC: stateless rules (5-tuple), stateful rules (Suricata IPS), domain filtering, TLS inspection. Deployed in firewall subnet. Managed via Firewall Manager across Organization.' },
    { front: 'What is AWS Firewall Manager?', back: 'Centralized security policy across Organization: manages WAF, Shield Advanced, Security Groups, Network Firewall, DNS Firewall. Auto-applies to new accounts/resources.' },
    { front: 'NACL rule processing order?', back: 'Rules processed low to high number, first match wins. Rule 100 Allow, Rule 200 Deny = ALLOW (100 matches first). Always end with rule * DENY ALL as catch-all. Custom NACLs deny all by default.' }
  ],

  lab: {
    scenario: 'Configure network security layers for a web application in a VPC.',
    objective: 'Practice Security Groups, NACLs, and VPC Endpoints configuration.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Configure Security Group for Web Server',
        instruction: 'Create a Security Group that allows HTTP (80) and HTTPS (443) from anywhere, and SSH (22) from your IP only. Allow all outbound.',
        hints: ['Use --protocol tcp for each rule', 'Use your IP with /32 CIDR for SSH'],
        solution: '```bash\n# Create SG\naws ec2 create-security-group --group-name web-sg \\\n  --description "Web server SG" --vpc-id vpc-xxx\n\n# Allow HTTP from anywhere\naws ec2 authorize-security-group-ingress --group-id sg-xxx \\\n  --protocol tcp --port 80 --cidr 0.0.0.0/0\n\n# Allow HTTPS from anywhere\naws ec2 authorize-security-group-ingress --group-id sg-xxx \\\n  --protocol tcp --port 443 --cidr 0.0.0.0/0\n\n# Allow SSH from your IP only\naws ec2 authorize-security-group-ingress --group-id sg-xxx \\\n  --protocol tcp --port 22 --cidr YOUR_IP/32\n```',
        verify: '```bash\naws ec2 describe-security-groups --group-ids sg-xxx \\\n  --query "SecurityGroups[0].IpPermissions"\n# Expected: 3 inbound rules (80, 443, 22)\n# Outbound: default allow all\n```'
      },
      {
        title: 'Add NACL Rules with Ephemeral Ports',
        instruction: 'Create a custom NACL for a public subnet. Allow inbound HTTP/HTTPS and outbound ephemeral ports for return traffic.',
        hints: ['Custom NACLs deny all by default', 'Ephemeral ports: 1024-65535'],
        solution: '```bash\n# Create NACL\naws ec2 create-network-acl --vpc-id vpc-xxx\n\n# Inbound: Allow HTTP (rule 100)\naws ec2 create-network-acl-entry --network-acl-id acl-xxx \\\n  --rule-number 100 --protocol tcp --port-range From=80,To=80 \\\n  --cidr-block 0.0.0.0/0 --rule-action allow --ingress\n\n# Inbound: Allow HTTPS (rule 110)\naws ec2 create-network-acl-entry --network-acl-id acl-xxx \\\n  --rule-number 110 --protocol tcp --port-range From=443,To=443 \\\n  --cidr-block 0.0.0.0/0 --rule-action allow --ingress\n\n# Outbound: Allow ephemeral ports (rule 100)\naws ec2 create-network-acl-entry --network-acl-id acl-xxx \\\n  --rule-number 100 --protocol tcp --port-range From=1024,To=65535 \\\n  --cidr-block 0.0.0.0/0 --rule-action allow --egress\n```',
        verify: '```bash\naws ec2 describe-network-acls --network-acl-ids acl-xxx\n# Expected: 2 inbound allow rules (100, 110)\n# Expected: 1 outbound allow rule (100, ephemeral ports)\n# Default * rule: DENY ALL (catch-all)\n```'
      },
      {
        title: 'Create a Gateway Endpoint for S3',
        instruction: 'Create a Gateway VPC Endpoint for S3 to allow private access without internet. Associate it with a route table.',
        hints: ['Gateway endpoints are free', 'Use --service-name com.amazonaws.REGION.s3'],
        solution: '```bash\n# Create Gateway Endpoint for S3\naws ec2 create-vpc-endpoint \\\n  --vpc-id vpc-xxx \\\n  --service-name com.amazonaws.us-east-1.s3 \\\n  --route-table-ids rtb-xxx \\\n  --vpc-endpoint-type Gateway\n\n# This adds a route in rtb-xxx pointing S3 prefixes\n# to the endpoint (no internet/NAT needed)\n```',
        verify: '```bash\naws ec2 describe-vpc-endpoints \\\n  --filters Name=vpc-id,Values=vpc-xxx\n# Expected: Gateway endpoint for S3, state = available\n\naws ec2 describe-route-tables --route-table-ids rtb-xxx\n# Expected: route with destination pl-xxx (S3 prefix list)\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Web Server Accessible via SG but Blocked by NACL',
      difficulty: 'medium',
      symptom: 'EC2 web server has correct Security Group rules allowing HTTP, but clients cannot connect.',
      diagnosis: '```\nChecklist:\n1. Security Group: allows inbound port 80? YES\n2. NACL inbound: allows port 80? CHECK\n3. NACL outbound: allows ephemeral ports (1024-65535)? CHECK\n\nCommon cause: custom NACL missing outbound ephemeral ports\nNACLs are STATELESS - return traffic needs explicit rules\n\nVerify:\n  aws ec2 describe-network-acls --filters Name=association.subnet-id,Values=subnet-xxx\n  Check both Entries (ingress AND egress)\n```',
      solution: 'Add outbound NACL rule allowing TCP ports 1024-65535 to 0.0.0.0/0. NACLs are stateless, so even though SG auto-allows return traffic, the NACL blocks it without explicit ephemeral port rules.'
    },
    {
      title: 'Interface Endpoint DNS Resolution Not Working',
      difficulty: 'hard',
      symptom: 'Created an Interface VPC Endpoint but application still connects to service via public internet instead of privately.',
      diagnosis: '```\nChecklist:\n1. Private DNS enabled on endpoint? CHECK\n   (enableDnsSupport and enableDnsHostnames must be true on VPC)\n2. VPC DNS settings:\n   aws ec2 describe-vpc-attribute --vpc-id vpc-xxx \\\n     --attribute enableDnsSupport\n   aws ec2 describe-vpc-attribute --vpc-id vpc-xxx \\\n     --attribute enableDnsHostnames\n3. Security Group on endpoint allows traffic from source?\n4. Endpoint policy allows the required actions?\n\nTest DNS resolution:\n  nslookup SERVICE.REGION.amazonaws.com\n  Should resolve to private IP in your VPC\n```',
      solution: 'Enable Private DNS on the endpoint AND ensure VPC has enableDnsSupport=true and enableDnsHostnames=true. Also verify the endpoint Security Group allows inbound traffic from application instances. Without private DNS, you must use endpoint-specific DNS names.'
    }
  ]
};
