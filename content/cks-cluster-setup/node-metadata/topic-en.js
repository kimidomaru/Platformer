window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['cks-cluster-setup/node-metadata'] = {
  theory: `# Node Metadata Protection

## Exam Relevance
> CKS requires you to protect cloud provider metadata APIs from pod access. Appears in Cluster Setup domain. Expect to write NetworkPolicy rules to block 169.254.169.254.

## The Threat: Cloud Metadata API

All major cloud providers expose an **instance metadata service** accessible from within the VM at a link-local address:

| Cloud | Metadata Address | Notes |
|-------|-----------------|-------|
| AWS | 169.254.169.254 | IMDSv1 (GET) and IMDSv2 (PUT+GET) |
| GCP | 169.254.169.254 | Also: metadata.google.internal |
| Azure | 169.254.169.254 | Requires Metadata: true header |
| DigitalOcean | 169.254.169.254 | |
| Alibaba Cloud | 100.100.100.200 | Different address |

**Why this is dangerous:** The metadata API provides:
- IAM credentials (AWS: temporary STS tokens for the instance role)
- Service account keys (GCP)
- SSH keys, user-data scripts, bootstrap tokens
- Internal network topology

### The Attack

\`\`\`bash
# From any pod with network access (default in most clusters):
curl http://169.254.169.254/latest/meta-data/
# Returns instance metadata

# Get AWS IAM credentials (this is the critical attack)
curl http://169.254.169.254/latest/meta-data/iam/security-credentials/
# Returns: my-instance-role
curl http://169.254.169.254/latest/meta-data/iam/security-credentials/my-instance-role
# Returns: AccessKeyId, SecretAccessKey, Token — valid AWS credentials!

# Attacker can now call AWS APIs with node's permissions
AWS_ACCESS_KEY_ID=... aws s3 ls
AWS_ACCESS_KEY_ID=... aws iam list-roles
\`\`\`

### Real Attack: Tesla Kubernetes Breach (2018)
Tesla's Kubernetes Dashboard was exposed without authentication. Attackers accessed it, ran pods with metadata API access, stole AWS credentials, and used them to mine cryptocurrency and access Tesla's S3 data.

## Protection Methods

### Method 1: NetworkPolicy (CKS Primary Method)

Block all pod access to the metadata endpoint using NetworkPolicy:

\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: block-metadata
  namespace: default
spec:
  podSelector: {}           # applies to ALL pods in namespace
  policyTypes:
  - Egress
  egress:
  - to:
    - ipBlock:
        cidr: 0.0.0.0/0
        except:
        - 169.254.169.254/32   # block metadata API
  - to:
    - namespaceSelector: {}    # allow DNS resolution
    ports:
    - port: 53
      protocol: UDP
    - port: 53
      protocol: TCP
\`\`\`

**Apply to all namespaces:**
\`\`\`bash
# Create the NetworkPolicy in each namespace
for ns in $(kubectl get namespaces -o jsonpath='{.items[*].metadata.name}'); do
  kubectl apply -f block-metadata.yaml -n $ns
done

# Or use a namespace-level default via admission controller
\`\`\`

### Method 2: AWS IMDSv2 (Hop Limit)

AWS introduced IMDSv2 which requires a session token obtained via PUT. More importantly, the **hop limit** setting prevents pods from accessing the metadata:

\`\`\`bash
# AWS: Restrict metadata to IMDSv2 only + hop limit of 1
# (prevents access from within containers, which add a network hop)
aws ec2 modify-instance-metadata-options \
  --instance-id <instance-id> \
  --http-tokens required \
  --http-put-response-hop-limit 1 \
  --http-endpoint enabled

# IMDSv2 requires a session token (not accessible from pods with hop limit 1)
TOKEN=$(curl -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
curl -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/
\`\`\`

### Method 3: Node-level iptables

Block at the host network level using iptables:

\`\`\`bash
# On each node, block outbound to metadata from pod CIDR
iptables -I FORWARD -s <pod-cidr> -d 169.254.169.254 -j DROP

# Or using OUTPUT chain for host processes
iptables -A OUTPUT -d 169.254.169.254 -m owner --uid-owner root -j ACCEPT
iptables -A OUTPUT -d 169.254.169.254 -j DROP
\`\`\`

### Method 4: IRSA / Workload Identity (Best Practice)

Instead of using node-level IAM roles (accessible via metadata), use per-pod identity:

**AWS: IAM Roles for Service Accounts (IRSA)**
\`\`\`yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: my-app-sa
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789:role/my-app-role
\`\`\`

**GCP: Workload Identity**
\`\`\`yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: my-app-sa
  annotations:
    iam.gke.io/gcp-service-account: my-app@my-project.iam.gserviceaccount.com
\`\`\`

With IRSA/Workload Identity:
- Pods get short-lived credentials via projected token volumes
- No metadata API access needed
- Credentials are scoped per ServiceAccount (not per node)
- Audit trail per pod

## Testing Protection

\`\`\`bash
# Test if a pod can reach the metadata API
kubectl run test-metadata \
  --image=curlimages/curl \
  --restart=Never \
  --rm -it \
  -- curl -s --max-time 3 http://169.254.169.254/latest/meta-data/

# If protected: Should timeout or return error
# If unprotected: Returns metadata

# Test with timeout
kubectl run test --image=curlimages/curl --restart=Never --rm -it \
  -- curl -sv --max-time 5 http://169.254.169.254/ 2>&1 | grep -E "timeout|connected|refused"
\`\`\`

## Falco Detection

Detect metadata API access with Falco:

\`\`\`yaml
# Custom Falco rule
- rule: Metadata API Access
  desc: Detect access to cloud metadata API from a container
  condition: >
    outbound and fd.sip = "169.254.169.254"
  output: >
    Metadata API access from container
    (user=%user.name container=%container.name image=%container.image.repository
    connection=%fd.name)
  priority: WARNING
  tags: [network, cloud, mitre_credential_access]
\`\`\`

## Kubeadm Bootstrap Token Protection

An additional node metadata concern: kubeadm stores bootstrap tokens as Secrets. Ensure they are cleaned up after node join:

\`\`\`bash
# List bootstrap tokens
kubectl get secrets -n kube-system | grep bootstrap-token

# Delete expired tokens
kubectl delete secret -n kube-system bootstrap-token-<id>

# Bootstrap tokens auto-expire after 24 hours by default
# Verify: kubectl describe secret -n kube-system bootstrap-token-<id> | grep expiration
\`\`\`

## Common Mistakes

- **Only blocking in default namespace**: NetworkPolicy applies per-namespace — block in ALL namespaces
- **Missing DNS exception**: Blocking all egress breaks DNS — always allow port 53
- **Forgetting GCP metadata.google.internal**: GCP has a hostname alias for the metadata API
- **Not testing**: Always verify protection actually works with a test pod

## Killer.sh Style Challenge

> **Scenario**: A security audit found that pods in the "production" namespace can access the AWS metadata API. Create a NetworkPolicy that blocks all pods in the namespace from accessing 169.254.169.254 while still allowing all other traffic.
`,

  quiz: [
    {
      question: 'What is the cloud metadata API address used by AWS, GCP, and Azure?',
      options: [
        '169.254.169.254',
        '192.168.1.1',
        '10.96.0.1',
        '172.16.0.1'
      ],
      correct: 0,
      explanation: '169.254.169.254 is the link-local address used by AWS, GCP, and Azure for their instance metadata services. It is accessible from any process running on the VM/container host, making it a target for container escape attacks.',
      reference: 'Node Metadata — The Threat section.'
    },
    {
      question: 'What sensitive data can an attacker obtain from the AWS metadata API?',
      options: [
        'Temporary IAM credentials (AccessKeyId, SecretAccessKey, SessionToken) for the node\'s IAM role',
        'Only read-only instance information like AMI ID and region',
        'The root password for the EC2 instance',
        'The Kubernetes API server certificate'
      ],
      correct: 0,
      explanation: 'The AWS metadata API at /latest/meta-data/iam/security-credentials/<role-name> returns temporary AWS credentials including AccessKeyId, SecretAccessKey, and SessionToken. These can be used to call any AWS API with the permissions of the instance role.',
      reference: 'Node Metadata — The Attack section.'
    },
    {
      question: 'What is the CKS-recommended way to block pod access to the metadata API?',
      options: [
        'NetworkPolicy with egress rule excluding 169.254.169.254/32',
        'PodSecurityPolicy blocking hostNetwork',
        'RBAC restriction on network egress',
        'Firewall rule on the API server'
      ],
      correct: 0,
      explanation: 'NetworkPolicy is the Kubernetes-native way to restrict pod egress. Creating a NetworkPolicy with ipBlock.except: [169.254.169.254/32] blocks all pods in the namespace from reaching the metadata API while allowing other traffic.',
      reference: 'Node Metadata — Method 1: NetworkPolicy section.'
    },
    {
      question: 'A NetworkPolicy blocks all egress from pods. What critical exception must be included?',
      options: [
        'Port 53 (UDP and TCP) for DNS resolution',
        'Port 443 for HTTPS to the API server',
        'Port 10250 for kubelet communication',
        'Port 2379 for etcd access'
      ],
      correct: 0,
      explanation: 'DNS (port 53) must be allowed or all pod-to-service communication breaks. Even when creating a restrictive egress NetworkPolicy, always include an exception for DNS (port 53 UDP and TCP) to kube-dns.',
      reference: 'Node Metadata — NetworkPolicy section.'
    },
    {
      question: 'What is the AWS IMDSv2 hop limit protection?',
      options: [
        'Setting hop-limit to 1 prevents containers from accessing the metadata API since they add an extra network hop',
        'Limiting the number of API calls per second from instances',
        'Restricting metadata access to the first container started on the node',
        'Requiring multi-factor authentication for metadata access'
      ],
      correct: 0,
      explanation: 'IMDSv2 with hop-limit=1 means the metadata request TTL expires after one network hop. Since containers use virtual network interfaces (adding a hop), they cannot reach the metadata endpoint — only the host can. This is a cloud-level control.',
      reference: 'Node Metadata — Method 2: AWS IMDSv2 section.'
    },
    {
      question: 'What is IRSA (IAM Roles for Service Accounts) and why does it improve security?',
      options: [
        'Per-pod IAM credentials via projected tokens, eliminating the need for node-level IAM roles and metadata access',
        'A system that rotates IAM credentials stored in Kubernetes Secrets',
        'An IAM policy that restricts which Kubernetes resources can be created',
        'A service mesh feature for securing inter-pod communication'
      ],
      correct: 0,
      explanation: 'IRSA assigns IAM roles directly to Kubernetes ServiceAccounts via annotations. Pods receive short-lived credentials through projected token volumes, not via the metadata API. This means the node role can be minimized and there\'s no need for metadata API access for IAM.',
      reference: 'Node Metadata — Method 4: IRSA / Workload Identity section.'
    },
    {
      question: 'After creating a metadata-blocking NetworkPolicy, how do you verify it works?',
      options: [
        'kubectl run test --image=curlimages/curl --rm -it -- curl --max-time 3 http://169.254.169.254/',
        'kubectl describe networkpolicy block-metadata | grep "169.254"',
        'kubectl auth can-i connect --to=169.254.169.254',
        'nmap -p 80 169.254.169.254 from the control plane'
      ],
      correct: 0,
      explanation: 'The definitive test is to run a curl pod inside the affected namespace and attempt to connect to the metadata API. If the NetworkPolicy works, the connection should timeout (not return data). Always test after applying security controls.',
      reference: 'Node Metadata — Testing Protection section.'
    },
    {
      question: 'Why must metadata-blocking NetworkPolicies be applied to EVERY namespace?',
      options: [
        'NetworkPolicy is namespace-scoped — a policy in namespace "default" does not protect pods in namespace "production"',
        'NetworkPolicy is cluster-scoped and only needs to be created once',
        'Each NetworkPolicy only protects the first pod created after it',
        'NetworkPolicy has a maximum of 10 namespaces per rule'
      ],
      correct: 0,
      explanation: 'NetworkPolicy resources are namespace-scoped. A NetworkPolicy in "default" does not apply to pods in "production" or any other namespace. You must create the blocking policy in every namespace or use an admission controller (like Kyverno) to auto-generate them.',
      reference: 'Node Metadata — Method 1: NetworkPolicy section.'
    }
  ],

  flashcards: [
    {
      front: 'What is the cloud metadata API address and what sensitive data does it expose?',
      back: 'Address: 169.254.169.254 (link-local, accessible from any VM process)\n\nExposes:\n- AWS: IAM temporary credentials (AccessKeyId + SecretAccessKey + SessionToken)\n- GCP: Service account keys and tokens\n- Azure: MSI credentials\n- All clouds: SSH keys, user-data, network topology, bootstrap tokens'
    },
    {
      front: 'Write a NetworkPolicy to block metadata API access but allow all other egress',
      back: 'spec:\n  podSelector: {}     # all pods\n  policyTypes: [Egress]\n  egress:\n  - to:\n    - ipBlock:\n        cidr: 0.0.0.0/0\n        except:\n        - 169.254.169.254/32   # block metadata\n  - to:\n    - namespaceSelector: {}  # allow DNS\n    ports:\n    - port: 53\n      protocol: UDP\n    - port: 53\n      protocol: TCP'
    },
    {
      front: 'What is AWS IMDSv2 and how does the hop limit protect against container attacks?',
      back: 'IMDSv2: Enhanced metadata API requiring a PUT session token before GET requests.\n\nHop limit protection:\n--http-put-response-hop-limit 1\n\nWith TTL=1: packets expire after 1 hop\nHost → metadata: 0 hops (direct) ✓\nContainer → host NIC → metadata: 1+ hops ✗\n\nResult: containers cannot obtain the session token needed for IMDSv2, blocking metadata access.'
    },
    {
      front: 'What is IRSA and how does it eliminate the need for metadata API access?',
      back: 'IRSA (AWS) / Workload Identity (GCP): assigns IAM roles to Kubernetes ServiceAccounts.\n\nServiceAccount annotation:\neks.amazonaws.com/role-arn: arn:aws:iam::123:role/my-role\n\nPod receives:\n- Projected token volume with short-lived OIDC token\n- AWS SDK exchanges this token for STS credentials\n- No need to call 169.254.169.254\n\nBenefit: scoped per pod (not per node), auditable per ServiceAccount'
    },
    {
      front: 'How do you test if a NetworkPolicy successfully blocks metadata API access?',
      back: 'kubectl run test-metadata \\\n  --image=curlimages/curl \\\n  --restart=Never \\\n  --rm -it \\\n  -- curl -s --max-time 3 http://169.254.169.254/latest/meta-data/\n\nExpected (protected): curl: (28) Connection timed out\nExpected (unprotected): Returns instance metadata\n\nTest in the namespace where the NetworkPolicy was applied'
    },
    {
      front: 'What is the Tesla Kubernetes breach (2018) and what lessons does it teach?',
      back: 'Attack:\n1. Kubernetes Dashboard exposed without authentication\n2. Attackers ran pods with access to metadata API\n3. Retrieved AWS node role credentials\n4. Used credentials to mine crypto + access S3 data\n\nLessons:\n- Never expose Dashboard without authentication\n- Block metadata API access via NetworkPolicy\n- Minimize node IAM role permissions\n- Use IRSA instead of node roles\n- Monitor for unexpected AWS API calls'
    }
  ],

  lab: {
    scenario: 'A security audit found that pods in your cluster can access the cloud metadata API. You need to implement NetworkPolicy-based protection across all application namespaces.',
    objective: 'Create NetworkPolicies that block metadata API access (169.254.169.254) in multiple namespaces while preserving DNS and normal cluster communication.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Demonstrate the vulnerability',
        instruction: `First, show that pods can currently access the metadata endpoint.

\`\`\`bash
# Create a test namespace
kubectl create namespace metadata-test

# Try to access the metadata API from a pod
kubectl run metadata-attacker \
  --image=curlimages/curl \
  --restart=Never \
  --namespace=metadata-test \
  -- sleep 3600

# Wait for it to be running
kubectl wait pod/metadata-attacker -n metadata-test --for=condition=Ready --timeout=30s

# Execute the attack
kubectl exec -it metadata-attacker -n metadata-test -- \
  curl -s --max-time 5 http://169.254.169.254/latest/meta-data/ || echo "Connection failed (expected in cloud)"
\`\`\``,
        hints: [
          'On a real cloud cluster, this will return instance metadata — showing the vulnerability',
          'On a local cluster (minikube/kind), the address is not routable so you will see a timeout'
        ],
        solution: `\`\`\`bash
kubectl create namespace metadata-test
kubectl run metadata-attacker --image=curlimages/curl --restart=Never -n metadata-test -- sleep 3600
kubectl wait pod/metadata-attacker -n metadata-test --for=condition=Ready --timeout=30s
kubectl exec metadata-attacker -n metadata-test -- curl -s --max-time 3 http://169.254.169.254/ 2>&1
\`\`\``,
        verify: `\`\`\`bash
kubectl get pod metadata-attacker -n metadata-test
# Expected: Running

# Note the connection result (timeout = protected, data = vulnerable)
kubectl exec metadata-attacker -n metadata-test -- curl -s --max-time 2 http://169.254.169.254/ 2>&1 | head -3
\`\`\``
      },
      {
        title: 'Create the metadata-blocking NetworkPolicy',
        instruction: `Apply a NetworkPolicy that blocks access to 169.254.169.254 while preserving DNS.

\`\`\`yaml
# block-metadata.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: block-cloud-metadata
  namespace: metadata-test
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
  - to:
    - namespaceSelector: {}
    ports:
    - port: 53
      protocol: UDP
    - port: 53
      protocol: TCP
\`\`\`

\`\`\`bash
kubectl apply -f block-metadata.yaml
\`\`\``,
        hints: [
          'podSelector: {} means all pods in the namespace',
          'The DNS exception is critical — without it, pods cannot resolve service names',
          'The ipBlock rule allows all traffic EXCEPT 169.254.169.254'
        ],
        solution: `\`\`\`bash
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: block-cloud-metadata
  namespace: metadata-test
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
  - to:
    - namespaceSelector: {}
    ports:
    - port: 53
      protocol: UDP
    - port: 53
      protocol: TCP
EOF
\`\`\``,
        verify: `\`\`\`bash
kubectl get networkpolicy block-cloud-metadata -n metadata-test
# Expected: block-cloud-metadata   <none>   <time>

# Verify the NetworkPolicy has the correct spec
kubectl describe networkpolicy block-cloud-metadata -n metadata-test
# Expected: Egress rules with ipBlock exception for 169.254.169.254/32
\`\`\``
      },
      {
        title: 'Verify the protection works',
        instruction: `Test that the metadata API is now blocked and that normal DNS still works.

\`\`\`bash
# Test 1: metadata API should be blocked
kubectl exec metadata-attacker -n metadata-test -- \
  curl -s --max-time 5 http://169.254.169.254/ 2>&1

# Test 2: DNS should still work
kubectl exec metadata-attacker -n metadata-test -- \
  curl -s --max-time 5 http://kubernetes.default.svc.cluster.local/ 2>&1 | head -3

# Test 3: Normal internet access should still work (if allowed in your cluster)
kubectl exec metadata-attacker -n metadata-test -- \
  curl -s --max-time 5 https://www.google.com 2>&1 | head -3
\`\`\``,
        hints: [
          'metadata API should now timeout or be refused',
          'DNS must work — if not, check the DNS exception in the NetworkPolicy'
        ],
        solution: `\`\`\`bash
# Test metadata blocked
kubectl exec metadata-attacker -n metadata-test -- curl -s --max-time 3 http://169.254.169.254/ 2>&1

# Test DNS works
kubectl exec metadata-attacker -n metadata-test -- nslookup kubernetes.default.svc.cluster.local 2>&1 | grep Address
\`\`\``,
        verify: `\`\`\`bash
# Metadata should be blocked (timeout)
kubectl exec metadata-attacker -n metadata-test -- curl -s --max-time 3 http://169.254.169.254/ 2>&1
# Expected: curl: (28) Connection timed out after 3001 milliseconds

# DNS should work
kubectl exec metadata-attacker -n metadata-test -- nslookup kubernetes.default 2>&1
# Expected: Address: 10.96.0.1 (or whatever the API server ClusterIP is)
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Pods cannot resolve DNS after metadata blocking NetworkPolicy',
      difficulty: 'medium',
      symptom: 'After applying the block-cloud-metadata NetworkPolicy, pods in the namespace cannot connect to any service — even though they don\'t need metadata API access.',
      diagnosis: `\`\`\`bash
# Test DNS from an affected pod
kubectl exec <pod-name> -n <namespace> -- nslookup kubernetes.default 2>&1
# Expected if broken: connection timed out; no servers could be reached

# Check what NetworkPolicies exist in the namespace
kubectl get networkpolicy -n <namespace>

# Look at the Egress rules
kubectl describe networkpolicy block-cloud-metadata -n <namespace>

# Verify kube-dns is running
kubectl get pods -n kube-system -l k8s-app=kube-dns
\`\`\``,
      solution: `**The DNS exception is missing from the NetworkPolicy.**

The NetworkPolicy must explicitly allow DNS traffic (port 53) because once ANY Egress rule exists, all other egress is denied (NetworkPolicy is additive/whitelist-based).

**Fix: Add DNS exception:**
\`\`\`yaml
spec:
  egress:
  - to:
    - ipBlock:
        cidr: 0.0.0.0/0
        except:
        - 169.254.169.254/32
  # ADD THIS:
  - to:
    - namespaceSelector: {}    # allow DNS to any namespace (kube-system)
    ports:
    - port: 53
      protocol: UDP
    - port: 53
      protocol: TCP
\`\`\`

\`\`\`bash
kubectl apply -f block-metadata-fixed.yaml

# Test DNS again
kubectl exec <pod> -n <namespace> -- nslookup kubernetes.default
\`\`\``
    },
    {
      title: 'NetworkPolicy applies but pods still reach metadata API',
      difficulty: 'hard',
      symptom: 'The NetworkPolicy is created and looks correct, but pods can still curl 169.254.169.254 successfully.',
      diagnosis: `\`\`\`bash
# Verify the NetworkPolicy selector matches the pod
kubectl get pod <pod-name> -n <namespace> --show-labels

# Check if CNI plugin supports NetworkPolicy
kubectl get pods -A | grep -i "calico\\|cilium\\|weave\\|canal"
# If only flannel: NetworkPolicy is NOT enforced

# Check if there are conflicting NetworkPolicies
kubectl get networkpolicy -n <namespace> -o yaml | grep podSelector

# Check if the pod is using hostNetwork
kubectl get pod <pod-name> -n <namespace> -o yaml | grep hostNetwork

# Verify ipBlock format
kubectl get networkpolicy block-cloud-metadata -n <namespace> -o yaml | grep -A5 ipBlock
\`\`\``,
      solution: `**Most likely causes:**

**1. CNI plugin does not enforce NetworkPolicy:**
- Flannel alone does not support NetworkPolicy
- Need: Calico, Cilium, Weave, Canal, or similar
- Check: kubectl get pods -A | grep calico
- Fix: Install a NetworkPolicy-capable CNI

**2. Pod uses hostNetwork: true:**
- hostNetwork pods use the node's network namespace, bypassing pod network rules
- NetworkPolicy does NOT apply to hostNetwork pods
- Fix: Remove hostNetwork from the pod spec

**3. Incorrect IP range:**
- 169.254.169.254/32 is correct — verify the exact CIDR in the policy

**4. Policy not in same namespace as pod:**
- Check: kubectl get networkpolicy -n <pod-namespace>
- NetworkPolicy is namespace-scoped

\`\`\`bash
# Verify CNI supports NetworkPolicy
kubectl describe node <node> | grep -i cni
# Or check for policy enforcement
kubectl get pods -n kube-system | grep -E "calico|cilium|weave"
\`\`\``
    }
  ]
};
