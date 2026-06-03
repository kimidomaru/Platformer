window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['kcsa-security-overview/cloud-provider-security'] = {
  theory: `# Cloud Provider Security

## Exam Relevance
> KCSA tests understanding of cloud provider security services, the shared responsibility model, and how managed Kubernetes (EKS, GKE, AKS) affects the security boundary. Expect questions about IAM, encryption, and what the cloud provider vs. customer manages.

## Shared Responsibility Model

**Foundational principle**: Security responsibilities are split between the cloud provider and the customer.

| Responsibility | Cloud Provider | Customer |
|---------------|----------------|----------|
| Physical data centers | ✅ | ❌ |
| Hardware (servers, network) | ✅ | ❌ |
| Hypervisor / virtualization | ✅ | ❌ |
| Storage infrastructure | ✅ | ❌ |
| OS updates (managed services) | ✅ | ❌ |
| Kubernetes control plane (managed K8s) | ✅ | ❌ |
| Worker node OS (unmanaged K8s) | ❌ | ✅ |
| Container images | ❌ | ✅ |
| Application code | ❌ | ✅ |
| IAM roles and policies | ❌ | ✅ |
| Network configuration (VPCs, SGs) | ❌ | ✅ |
| Data encryption configuration | ❌ | ✅ |
| Kubernetes RBAC | ❌ | ✅ |

> **For managed Kubernetes** (EKS, GKE, AKS): the cloud provider secures the control plane. The customer is still responsible for worker nodes, RBAC, NetworkPolicy, and workloads.

## IAM and Identity

**Identity and Access Management (IAM)** is the cloud provider's system for controlling who can do what to cloud resources.

### Key IAM Concepts
- **Users** — human identities
- **Roles** — assumed by services, EC2 instances, Kubernetes nodes
- **Policies** — JSON documents defining permissions (allow/deny)
- **Groups** — collections of users with shared policies
- **Service Accounts** (Cloud) — GCP-specific identity for workloads

### IAM for Kubernetes Nodes
Cloud-managed VMs often have an **IAM role attached**:
- Node IAM role in AWS (EC2 instance profile)
- Service Account in GCP
- Managed Identity in Azure

This role gives the node access to cloud services. If a pod can reach the metadata service (169.254.169.254), it can use the node's IAM credentials!

### Workload Identity (best practice)
Instead of sharing the node's IAM role, assign per-pod IAM credentials:
- **AWS**: IRSA (IAM Roles for Service Accounts) — uses OIDC
- **GCP**: Workload Identity — maps K8s SA to GCP SA
- **Azure**: AAD Pod Identity / Workload Identity

\`\`\`yaml
# AWS IRSA annotation on ServiceAccount
apiVersion: v1
kind: ServiceAccount
metadata:
  name: my-app-sa
  namespace: production
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789:role/my-app-role
\`\`\`

## Managed Kubernetes Security

### Amazon EKS
- Control plane is fully managed by AWS
- Worker nodes run on EC2 — customer manages OS updates
- **aws-auth ConfigMap** / Access Entries — maps IAM to RBAC
- **EKS Pod Identity** (newer) or IRSA for workload identity
- Private cluster option (no public API endpoint)

### Google GKE
- **Autopilot** mode: Google manages nodes too — higher security baseline
- **Standard** mode: customer manages nodes
- **Binary Authorization** — enforce image signing before deployment
- **Container Analysis** — image scanning in GCR/Artifact Registry
- Shielded Nodes, Confidential GKE Nodes

### Azure AKS
- Control plane managed by Azure
- **Azure AD** integration for authentication
- **Azure Policy** for admission control (based on OPA)
- **Defender for Containers** — runtime threat detection
- KEDA for event-driven autoscaling

## Cloud Security Services Relevant to Kubernetes

| Category | AWS | GCP | Azure |
|----------|-----|-----|-------|
| **Image scanning** | ECR image scanning (Trivy) | Container Analysis | Defender for Containers |
| **Secrets** | AWS Secrets Manager / KMS | Secret Manager / KMS | Azure Key Vault |
| **Policy enforcement** | AWS Config | Security Command Center | Azure Policy |
| **Audit logs** | CloudTrail | Cloud Audit Logs | Azure Monitor / Sentinel |
| **Runtime security** | AWS GuardDuty | Security Command Center | Defender for Containers |
| **Network security** | Security Groups, VPC | Firewall Rules, VPC | NSG, Azure Firewall |

## Encryption at Rest and in Transit

### Encryption at Rest
- Cloud provider encrypts physical disks by default (AES-256)
- Kubernetes etcd can be separately encrypted using EncryptionConfiguration
- Secrets in etcd — enable encryption at rest!
- Block storage (EBS, GCP PD, Azure Disk) — encrypted by default

### Encryption in Transit
- TLS 1.2+ for all API server communication
- Node-to-API server: mutual TLS (certificates)
- Pod-to-Pod: NOT encrypted by default (unless service mesh or VPN)
- Service mesh (Istio, Linkerd) adds mTLS between pods

## Cloud Network Security

\`\`\`
Internet
  ↓
Cloud Load Balancer / WAF
  ↓
VPC / Virtual Network
  ↓
Subnet (private/public)
  ↓
Security Group / Network Security Group (firewall)
  ↓
Kubernetes Node
  ↓
Pod Network (CNI)
  ↓
NetworkPolicy
\`\`\`

### Defense in Depth at Network Level
1. **VPC** — isolate cluster in private network
2. **Security Groups** — allow only necessary ports
3. **Private cluster** — no public API endpoint
4. **NetworkPolicy** — restrict pod communication
5. **Service mesh** — mTLS between services

## CSPM — Cloud Security Posture Management

Tools that continuously assess cloud configuration for security misconfigurations:
- **AWS Security Hub** + Prowler
- **GCP Security Command Center**
- **Azure Defender / Secure Score**
- **Open-source**: Trivy (cloud), Checkov, Terrascan

## Common Misconfiguration Risks

1. **Public S3 bucket** / storage bucket with sensitive data
2. **Overly permissive IAM** (AdministratorAccess on node role)
3. **Exposed etcd** (no auth, publicly accessible)
4. **Public API server endpoint** (no IP allowlist)
5. **Missing VPC flow logs** (no network visibility)
6. **Unencrypted secrets** in etcd or environment variables
`,
  quiz: [
    {
      question: 'In the shared responsibility model for managed Kubernetes (EKS/GKE/AKS), what is the customer responsible for?',
      options: [
        'Worker nodes, container images, RBAC, NetworkPolicy, and application code',
        'Everything — the cloud provider only manages physical hardware',
        'Only application code — the provider handles all infrastructure',
        'Only Kubernetes RBAC — the provider handles all other security'
      ],
      correct: 0,
      explanation: 'For managed Kubernetes, the cloud provider secures the control plane. The customer is responsible for: worker node hardening, container images, RBAC configuration, NetworkPolicy, workload security, and application code.',
      reference: 'Review "Shared Responsibility Model" table.'
    },
    {
      question: 'What is IRSA (IAM Roles for Service Accounts) in AWS EKS?',
      options: [
        'A mechanism to assign individual IAM roles to Kubernetes ServiceAccounts via OIDC federation',
        'A way to map AWS IAM users directly to Kubernetes users',
        'A tool for scanning IAM policies for overly permissive rules',
        'A Kubernetes admission controller for IAM policy enforcement'
      ],
      correct: 0,
      explanation: 'IRSA maps a Kubernetes ServiceAccount to an AWS IAM role using OIDC federation. Pods using the SA get temporary credentials for that specific role — eliminating the need to use the node\'s IAM role.',
      reference: 'Review "Workload Identity (best practice)" section.'
    },
    {
      question: 'What is the security risk of using a node IAM role for pod access to cloud services?',
      options: [
        'All pods on the node share the node\'s IAM role — a compromised pod can use node credentials',
        'Node IAM roles expire frequently and cause pod disruptions',
        'Node IAM roles bypass Kubernetes RBAC enforcement',
        'Using node IAM roles prevents encryption at rest from working'
      ],
      correct: 0,
      explanation: 'The node IAM role is accessible via the metadata service. Any pod on the node can use it. If one pod is compromised, the attacker gets the node\'s full IAM permissions. Workload Identity (IRSA, GKE Workload Identity) solves this.',
      reference: 'Review "IAM for Kubernetes Nodes" section.'
    },
    {
      question: 'What is CSPM (Cloud Security Posture Management)?',
      options: [
        'Continuous assessment of cloud configuration for security misconfigurations',
        'A standard for container image signing and verification',
        'A Kubernetes admission controller for cloud resource access',
        'A protocol for encrypted communication between cloud services'
      ],
      correct: 0,
      explanation: 'CSPM tools continuously scan cloud configurations (IAM, storage, networking) for misconfigurations. Examples: AWS Security Hub, GCP Security Command Center, Azure Defender, Checkov, Trivy (cloud scan).',
      reference: 'Review "CSPM — Cloud Security Posture Management" section.'
    },
    {
      question: 'Which cloud security control does Binary Authorization (GKE) provide?',
      options: [
        'Enforces that only signed/attested container images can be deployed to the cluster',
        'Encrypts binary data in Kubernetes Secrets with a cloud KMS key',
        'Provides two-factor authentication for kubectl access',
        'Scans container images for CVEs before admission'
      ],
      correct: 0,
      explanation: 'Binary Authorization is a GKE feature that requires images to have cryptographic attestations (from trusted sources) before being deployed. It implements supply chain security at the admission control level.',
      reference: 'Review "Google GKE" section — Binary Authorization.'
    },
    {
      question: 'Pod-to-pod traffic in Kubernetes is encrypted by default?',
      options: [
        'No — pod-to-pod traffic is NOT encrypted by default; requires service mesh (Istio/Linkerd) for mTLS',
        'Yes — Kubernetes uses TLS for all pod communication automatically',
        'Yes — the CNI plugin always encrypts pod traffic',
        'Only if NetworkPolicy is applied to both pods'
      ],
      correct: 0,
      explanation: 'Pod-to-pod traffic is NOT encrypted by default. The Kubernetes network model provides IP connectivity between pods but no encryption. Service meshes (Istio, Linkerd) add mTLS. Some CNI plugins (Cilium, Weave) offer optional encryption.',
      reference: 'Review "Encryption in Transit" section.'
    },
    {
      question: 'What is the most common cloud misconfiguration that leads to data breaches?',
      options: [
        'Publicly accessible storage buckets (S3, GCS) containing sensitive data',
        'Missing NetworkPolicy in Kubernetes namespaces',
        'Not using multi-stage Docker builds',
        'Running containers without resource limits'
      ],
      correct: 0,
      explanation: 'Misconfigured cloud storage buckets (publicly readable) are responsible for many major data breaches. CSPM tools flag these as high-severity findings.',
      reference: 'Review "Common Misconfiguration Risks" section.'
    },
    {
      question: 'What is the best practice for Kubernetes control plane network security in production?',
      options: [
        'Private cluster with no public API endpoint, or API server behind an allowlist',
        'Use NodePort services instead of LoadBalancer to avoid cloud exposure',
        'Disable TLS on the API server for performance',
        'Only allow access from within the same AZ'
      ],
      correct: 0,
      explanation: 'For production, the Kubernetes API server should not be publicly accessible. Use private clusters (all in VPC) or an IP allowlist to restrict who can reach the API endpoint.',
      reference: 'Review "Defense in Depth at Network Level" — Private cluster point.'
    }
  ],
  flashcards: [
    {
      front: 'What is the shared responsibility model for managed Kubernetes?',
      back: 'Cloud provider: physical hardware, virtualization, control plane (API server, etcd, scheduler). Customer: worker nodes, RBAC, NetworkPolicy, container images, application code, data encryption configuration, IAM policies.'
    },
    {
      front: 'What is Workload Identity and why is it better than node IAM roles?',
      back: 'Workload Identity (IRSA on AWS, Workload Identity on GCP) assigns per-pod IAM credentials via Kubernetes ServiceAccount annotations. Better than node roles because: scope limited per workload, compromised pod can\'t use other pods\' credentials, auditable per SA.'
    },
    {
      front: 'What is the cloud metadata service attack and how to prevent it?',
      back: 'Containers can reach 169.254.169.254 to get the node\'s IAM credentials. Prevention: NetworkPolicy to block 169.254.169.254/32, IMDSv2 (AWS) requiring a token hop that containers can\'t do, or Workload Identity to eliminate node-level credentials.'
    },
    {
      front: 'What does Binary Authorization (GKE) do?',
      back: 'Requires container images to have cryptographic attestations from trusted authorities before being deployed. Prevents deploying unsigned, unscanned, or unverified images — supply chain security at admission time.'
    },
    {
      front: 'What are CSPM tools and what do they check?',
      back: 'Cloud Security Posture Management tools continuously scan cloud configurations for misconfigurations. They check: overly permissive IAM, public storage buckets, unencrypted resources, missing audit logs, open security groups, exposed endpoints.'
    },
    {
      front: 'Is pod-to-pod traffic encrypted in Kubernetes by default?',
      back: 'No. Kubernetes provides IP connectivity but not encryption between pods. For encrypted pod-to-pod traffic, use a service mesh (Istio, Linkerd) for mTLS, or a CNI plugin with encryption (Cilium with WireGuard, Weave with NaCl).'
    }
  ],
  lab: {
    scenario: 'Explore cloud provider security concepts by examining how node identity works, verifying encryption capabilities, and reviewing the cluster\'s network isolation.',
    objective: 'Understand practical cloud-Kubernetes security integration points.',
    duration: '15-20 minutes',
    steps: [
      {
        title: 'Examine node metadata and cloud identity',
        instruction: `Check what cloud metadata the cluster nodes expose. Try to reach the metadata service from a pod and observe the security implications. Create a test pod and attempt to curl the metadata service.`,
        hints: [
          'kubectl run test-pod --image=curlimages/curl --rm -it -- sh',
          'curl http://169.254.169.254/ inside the pod',
          'In a lab (kubeadm), the metadata service may not be a cloud provider — this is expected'
        ],
        solution: `\`\`\`bash
# Create a test pod to simulate a compromised container
kubectl run metadata-test \\
  --image=curlimages/curl \\
  --restart=Never \\
  --rm -it \\
  -- curl -s --connect-timeout 3 http://169.254.169.254/ || echo "Not reachable (expected in non-cloud or protected env)"
\`\`\``,
        verify: `\`\`\`bash
# Check if any NetworkPolicy already blocks metadata service
kubectl get networkpolicies --all-namespaces | grep -i metadata

# Check node info for cloud provider
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.providerID}{"\n"}{end}'
# In cloud: shows provider ID (aws://..., gce://..., etc.)
# In kubeadm lab: empty
\`\`\``
      },
      {
        title: 'Review cluster encryption configuration',
        instruction: `Check if encryption at rest is configured for the cluster. Look at the API server flags or EncryptionConfiguration to determine if etcd data is encrypted.`,
        hints: [
          'Look for kube-apiserver in /etc/kubernetes/manifests/ on a control plane node',
          'The flag --encryption-provider-config indicates encryption is configured',
          'kubectl get secret test-secret and check if it\'s in base64 only'
        ],
        solution: `\`\`\`bash
# Create a test secret
kubectl create secret generic test-encryption \\
  --from-literal=password=mySecret123

# Check the secret (base64 encoded but not encrypted from kubectl)
kubectl get secret test-encryption -o jsonpath='{.data.password}' | base64 -d
echo

# In a real cluster, check API server args for encryption config
# (requires node access)
# grep encryption /etc/kubernetes/manifests/kube-apiserver.yaml
\`\`\``,
        verify: `\`\`\`bash
kubectl get secret test-encryption
# Expected: Opaque secret with 1 key

kubectl get secret test-encryption -o yaml | grep "password:"
# Expected: base64-encoded value (NOT the raw text)
# This confirms secrets are base64, not plaintext — but also not encrypted
# unless EncryptionConfiguration is enabled

# Cleanup
kubectl delete secret test-encryption
\`\`\``
      },
      {
        title: 'Check cloud-level audit capabilities',
        instruction: `Examine what audit logging is available in the cluster. Check if audit policy is configured on the API server. Understanding audit trails is a key Cloud + Cluster security control.`,
        hints: [
          'Audit policy is configured via --audit-log-path and --audit-policy-file on kube-apiserver',
          'kubectl get events shows cluster-level events (different from audit logs)',
          'Check /etc/kubernetes/audit/ on control plane for audit policy files'
        ],
        solution: `\`\`\`bash
# Check recent API server events (simulates audit trail review)
kubectl get events --all-namespaces --sort-by='.lastTimestamp' | tail -20

# Create an event to audit
kubectl create configmap audit-test --from-literal=key=value
kubectl get configmap audit-test
kubectl delete configmap audit-test

# In a real cluster with audit logging:
# kubectl get events -n kube-system | grep "Warning"
# journalctl -u kube-apiserver | grep "AUDIT"
\`\`\``,
        verify: `\`\`\`bash
kubectl get events --all-namespaces --sort-by='.lastTimestamp' | tail -5
# Expected: shows recent cluster events

# Check if audit log path is configured (requires node access)
# In most cloud managed K8s, this is pre-configured by the provider
kubectl version --short
# Expected: shows cluster version
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Pods can access cloud metadata service — security risk',
      difficulty: 'medium',
      symptom: 'Security scan reports: pods in the cluster can reach 169.254.169.254 and retrieve cloud IAM credentials. This is a critical security finding.',
      diagnosis: `\`\`\`bash
# Verify the vulnerability
kubectl run test --image=curlimages/curl --rm -it -- \\
  curl -s --connect-timeout 3 http://169.254.169.254/

# Check if any NetworkPolicy blocks it
kubectl get networkpolicies --all-namespaces

# On AWS: check if IMDSv2 is enforced
# aws ec2 describe-instances --instance-id <id> | grep HttpTokens
# Should be: "required" not "optional"
\`\`\``,
      solution: `Apply a NetworkPolicy to block metadata service access from all pods:
\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: block-cloud-metadata
  namespace: production
spec:
  podSelector: {}
  policyTypes:
    - Egress
  egress:
    - to:
      - ipBlock:
          cidr: 0.0.0.0/0
          except:
            - 169.254.169.254/32
            - 169.254.0.0/16    # block entire link-local range
\`\`\`

For AWS specifically, enforce IMDSv2 (hop limit = 1 prevents containers from using it):
\`\`\`bash
aws ec2 modify-instance-metadata-options \\
  --instance-id <node-instance-id> \\
  --http-tokens required \\
  --http-put-response-hop-limit 1
\`\`\``
    },
    {
      title: 'Kubernetes ServiceAccount using node IAM role — needs Workload Identity',
      difficulty: 'hard',
      symptom: 'Application pods are using the EC2/node IAM role to access S3/Secrets Manager. This gives all pods on the node excessive cloud permissions. Need to scope permissions per workload.',
      diagnosis: `\`\`\`bash
# From a pod, see what credentials are being used
kubectl exec <pod> -- curl -s \\
  http://169.254.169.254/latest/meta-data/iam/security-credentials/

# Check the pod's environment for AWS credentials
kubectl exec <pod> -- env | grep -i aws

# Check if IRSA is configured (AWS)
kubectl get serviceaccount <sa-name> -n <ns> -o yaml | grep "eks.amazonaws.com"
\`\`\``,
      solution: `Set up IRSA (AWS) or Workload Identity (GCP) for the ServiceAccount:

**AWS IRSA:**
\`\`\`bash
# 1. Create IAM role with trust policy referencing the OIDC provider
# (Done in AWS IAM console or Terraform)

# 2. Annotate the ServiceAccount
kubectl annotate serviceaccount <sa-name> -n <namespace> \\
  eks.amazonaws.com/role-arn=arn:aws:iam::<account>:role/<role-name>

# 3. Restart pods to pick up the new credentials
kubectl rollout restart deployment/<name> -n <namespace>

# 4. Verify (should now show the scoped role, not node role)
kubectl exec <new-pod> -- aws sts get-caller-identity
\`\`\``
    }
  ]
};
