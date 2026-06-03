window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['kcsa-cluster-security/worker-node-security'] = {
  theory: `# Worker Node Security

## Exam Relevance
> KCSA covers worker node security including kubelet hardening, OS-level security, and container runtime security. Expect questions about kubelet authorization, node isolation, and what can be done at the node level.

## Worker Node Components

\`\`\`
Worker Node
├── kubelet          ← Node agent, manages pods
├── kube-proxy       ← Network proxy, manages iptables/ipvs
├── Container Runtime ← containerd or CRI-O
└── OS               ← Linux kernel, processes, filesystem
\`\`\`

## Kubelet Security

The kubelet is the most critical worker node component from a security perspective. It runs as root and manages all pods on the node.

### Kubelet Authentication

\`\`\`bash
# /var/lib/kubelet/config.yaml or kubelet flags

authentication:
  anonymous:
    enabled: false              # DISABLE anonymous auth (default: true pre-1.17!)
  webhook:
    enabled: true               # Use API server webhook for auth
  x509:
    clientCAFile: /etc/kubernetes/pki/ca.crt  # cert-based auth

authorization:
  mode: Webhook                 # Use API server for authorization (not AlwaysAllow!)
\`\`\`

### Kubelet API Ports
| Port | Description | Risk if exposed |
|------|-------------|-----------------|
| **10250** | Kubelet HTTPS API | High — can exec, read logs, get pods |
| **10255** | Read-only HTTP (deprecated) | Medium — unauthenticated read access |
| **10248** | Healthz | Low — health check only |

\`\`\`bash
# Port 10250 with anonymous auth disabled — should require certs:
curl -sk https://<node-ip>:10250/pods
# Should return: 401 Unauthorized

# Port 10255 (if enabled and exposed) is unauthenticated:
curl http://<node-ip>:10255/pods
# Returns pod info without auth!
\`\`\`

### Key Kubelet Hardening Flags
\`\`\`yaml
# /var/lib/kubelet/config.yaml
authorization:
  mode: Webhook

authentication:
  anonymous:
    enabled: false

tlsCertFile: /var/lib/kubelet/pki/kubelet.crt
tlsPrivateKeyFile: /var/lib/kubelet/pki/kubelet.key

protectKernelDefaults: true        # fail if kernel defaults are wrong
readOnlyPort: 0                    # disable read-only port 10255
eventRecordQPS: 5                  # rate limit events
rotateCertificates: true           # automatically rotate kubelet certs
serverTLSBootstrap: true           # bootstrap TLS cert from API server
\`\`\`

## Node Isolation and Restriction

### NodeRestriction Admission Plugin

\`\`\`bash
# API server flag:
--enable-admission-plugins=NodeRestriction
\`\`\`

**What NodeRestriction does**:
- Kubelets can only modify/read resources for their OWN node
- Kubelets cannot modify node labels with prefix \`node-restriction.kubernetes.io/\`
- Prevents a compromised kubelet from affecting other nodes

### Node Selectors and Taints for Isolation

\`\`\`yaml
# Taint a sensitive node to prevent regular workloads
kubectl taint node <sensitive-node> dedicated=security:NoSchedule

# Only security pods tolerate this taint
tolerations:
- key: "dedicated"
  value: "security"
  effect: "NoSchedule"
\`\`\`

## OS-Level Security

### Minimal OS

- Use minimal, hardened OS images (e.g., Bottlerocket, Flatcar, Container-Optimized OS)
- Disable unnecessary services
- Remove unnecessary packages (no compilers, wget, curl in production)

### OS Hardening Checklist
\`\`\`
✅ Disable SSH root login
✅ Use SSH keys (not passwords)
✅ Enable automatic security updates
✅ Minimal installed packages
✅ Firewall (iptables/nftables/ufw)
✅ Disable unused kernel modules
✅ Mount /tmp with noexec,nosuid
✅ Enable auditd for system call logging
✅ SELinux or AppArmor (mandatory access control)
\`\`\`

### CIS Kubernetes Worker Node Benchmark

\`\`\`bash
# Run kube-bench on worker nodes specifically
kubectl apply -f kube-bench-node-job.yaml

# Key checks:
# [PASS] 4.1.1 Ensure kubelet service file permissions are 644
# [FAIL] 4.2.1 Ensure anonymous auth is disabled
# [PASS] 4.2.5 Ensure ReadOnlyPort is disabled
\`\`\`

## Container Runtime Security

### containerd Security

\`\`\`bash
# containerd configuration: /etc/containerd/config.toml
[plugins."io.containerd.grpc.v1.cri"]
  [plugins."io.containerd.grpc.v1.cri".containerd]
    [plugins."io.containerd.grpc.v1.cri".containerd.runtimes]
      [plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runc]
        runtime_type = "io.containerd.runc.v2"
        [plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runc.options]
          SystemdCgroup = true
\`\`\`

### Sandbox Runtimes for Isolation

| Runtime | Isolation | Use Case |
|---------|-----------|----------|
| **runc** | Linux namespaces/cgroups | Standard containers |
| **gVisor (runsc)** | User-space kernel | Untrusted workloads |
| **Kata Containers** | VM-based | Maximum isolation |

\`\`\`yaml
# Using gVisor with RuntimeClass
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: gvisor
handler: runsc

---
apiVersion: v1
kind: Pod
spec:
  runtimeClassName: gvisor    # use gVisor sandbox
  containers:
  - name: untrusted-app
    image: untrusted-workload
\`\`\`

## Node Access Control

### Restricting SSH Access
- Production nodes should NOT have SSH keys for operators
- Use bastion hosts / jump servers (not direct access)
- Use Kubernetes-native debugging (ephemeral containers, kubectl exec via API)
- Audit all SSH access

### Using kubectl for Debugging (instead of SSH)
\`\`\`bash
# Debug a node without SSH
kubectl debug node/<node-name> -it --image=ubuntu

# Check node resources
kubectl describe node <node-name>
kubectl top node <node-name>

# Cordon/drain for maintenance (prevents new pods from scheduling)
kubectl cordon <node-name>
kubectl drain <node-name> --ignore-daemonsets
kubectl uncordon <node-name>
\`\`\`

## Common Node Security Vulnerabilities

| Vulnerability | How It's Exploited | Mitigation |
|--------------|-------------------|------------|
| Kubelet read-only port (10255) | Unauthenticated pod info | readOnlyPort: 0 |
| Anonymous kubelet auth | Exec into pods without auth | anonymous.enabled: false |
| hostPID containers | Process access on host | PSS restricted, no hostPID |
| Privileged containers | Root on host | PSS restricted |
| Writable hostPath | Read/write host filesystem | No hostPath, PSS restricted |
| Exposed Docker socket | Full Docker API access (container escape) | No socket mounts |
`,
  quiz: [
    {
      question: 'What is the security risk of kubelet port 10255 being enabled?',
      options: [
        'It exposes pod and node information without authentication',
        'It allows executing commands in pods without RBAC',
        'It gives direct access to the container filesystem',
        'It exposes kubelet metrics to external monitoring systems'
      ],
      correct: 0,
      explanation: 'Port 10255 is the kubelet read-only port — it returns pod, node, and stats information without any authentication. It was deprecated in newer versions. Disable it with readOnlyPort: 0.',
      reference: 'Review "Kubelet API Ports" table and configuration example.'
    },
    {
      question: 'What does the NodeRestriction admission plugin prevent?',
      options: [
        'Kubelets from modifying resources for nodes other than their own',
        'Nodes from joining the cluster without approval',
        'NodePort services from being created by non-admin users',
        'Pods from running on control plane nodes'
      ],
      correct: 0,
      explanation: 'NodeRestriction limits what kubelets can do via the API. Each kubelet can only read/modify resources associated with its own node. This prevents a compromised kubelet from affecting other nodes or creating cluster-wide resources.',
      reference: 'Review "NodeRestriction Admission Plugin" section.'
    },
    {
      question: 'Which kubelet configuration disables anonymous authentication?',
      options: [
        'authentication.anonymous.enabled: false',
        'allowAnonymous: false',
        '--anonymous-auth=false flag on kubelet process',
        'authorization.mode: DenyAll'
      ],
      correct: 0,
      explanation: 'In kubelet config.yaml, authentication.anonymous.enabled: false disables anonymous access to the kubelet API. Combined with authorization.mode: Webhook, the kubelet properly authenticates all requests.',
      reference: 'Review "Kubelet Authentication" section.'
    },
    {
      question: 'What is a RuntimeClass in Kubernetes?',
      options: [
        'A resource that specifies which container runtime handler to use for pods (e.g., gVisor, Kata)',
        'A classification for container images by security risk level',
        'A label applied to pods to indicate their runtime requirements',
        'A Kubernetes admission controller that validates runtime security'
      ],
      correct: 0,
      explanation: 'RuntimeClass specifies a container runtime configuration (handler) to use. Create a RuntimeClass for gVisor (handler: runsc) or Kata Containers, then reference it in Pod spec with runtimeClassName.',
      reference: 'Review "Sandbox Runtimes for Isolation" section.'
    },
    {
      question: 'Why is mounting the Docker socket (/var/run/docker.sock) into a container a security risk?',
      options: [
        'It gives the container full Docker API access, allowing it to create privileged containers and escape to the host',
        'It allows the container to restart Docker, disrupting all other containers',
        'It exposes Docker credentials stored in the socket file',
        'It allows the container to access other containers\' logs'
      ],
      correct: 0,
      explanation: 'The Docker socket gives full control of the Docker daemon. A container with docker.sock access can run docker run --privileged to create privileged containers that escape to the host — effectively node-level access.',
      reference: 'Review "Common Node Security Vulnerabilities" table — Exposed Docker socket.'
    },
    {
      question: 'What is gVisor and when should you use it?',
      options: [
        'A user-space kernel sandbox runtime that provides stronger isolation for untrusted workloads',
        'A Kubernetes security admission controller',
        'A service mesh for securing pod-to-pod communication',
        'A static analysis tool for container images'
      ],
      correct: 0,
      explanation: 'gVisor (runsc) intercepts container system calls with a user-space kernel, providing isolation beyond standard Linux namespaces. Use for running untrusted or public workloads where a container escape would be catastrophic.',
      reference: 'Review "Sandbox Runtimes for Isolation" table.'
    },
    {
      question: 'What does "protectKernelDefaults: true" do in the kubelet configuration?',
      options: [
        'Makes the kubelet fail to start if kernel parameters are not at their default security values',
        'Prevents pods from modifying kernel parameters (sysctl)',
        'Enables kernel security modules (SELinux/AppArmor)',
        'Blocks containers from using kernel capabilities'
      ],
      correct: 0,
      explanation: 'With protectKernelDefaults: true, the kubelet checks that kernel parameters (like vm.panic_on_oom, kernel.panic) match expected security values. If they don\'t, the kubelet refuses to start — preventing misconfigured nodes.',
      reference: 'Review "Key Kubelet Hardening Flags" section.'
    },
    {
      question: 'What is the best practice for node access in production Kubernetes?',
      options: [
        'No direct SSH; use kubectl debug/exec via the API server for node troubleshooting',
        'Use root SSH with a shared key among the operations team',
        'Install a VNC server for graphical access to nodes',
        'Enable SSH with password authentication for emergency access'
      ],
      correct: 0,
      explanation: 'Best practice: no direct SSH to production nodes. Use kubectl exec, kubectl debug node, or ephemeral containers for troubleshooting via the API server (with full RBAC and audit logging). If SSH is needed, use bastion hosts with audit logging.',
      reference: 'Review "Using kubectl for Debugging (instead of SSH)" section.'
    }
  ],
  flashcards: [
    {
      front: 'What are the two kubelet ports and their security implications?',
      back: 'Port 10250: HTTPS kubelet API — requires authentication when properly configured. Port 10255: read-only HTTP (deprecated) — unauthenticated, exposes pod/node info. Disable with readOnlyPort: 0 in kubelet config.'
    },
    {
      front: 'What kubelet config settings harden authentication?',
      back: 'authentication.anonymous.enabled: false (disable anon), authentication.x509.clientCAFile (cert-based auth), authentication.webhook.enabled: true (API server webhook auth), authorization.mode: Webhook (not AlwaysAllow!).'
    },
    {
      front: 'What does the NodeRestriction admission plugin do?',
      back: 'Limits kubelets to only modifying resources for their own node. Prevents a compromised kubelet from reading/modifying other nodes\' resources. Enabled with --enable-admission-plugins=NodeRestriction on the API server.'
    },
    {
      front: 'What are container sandbox runtimes and when to use them?',
      back: 'gVisor (runsc): user-space kernel, stronger syscall isolation. Kata Containers: VM-based, maximum isolation. Use for untrusted workloads. Standard runc is sufficient for trusted workloads. Configured via RuntimeClass in Kubernetes.'
    },
    {
      front: 'What is the danger of mounting the Docker socket in a container?',
      back: 'docker.sock gives full Docker daemon API access. The container can docker run --privileged to create a privileged container that escapes to the node. Never mount /var/run/docker.sock into production containers.'
    },
    {
      front: 'What is a minimal OS for Kubernetes worker nodes?',
      back: 'Bottlerocket (AWS), Flatcar Container Linux, Container-Optimized OS (GCP) — designed for running containers: minimal packages, read-only OS partition, automatic updates, no shell by default, reduced attack surface.'
    }
  ],
  lab: {
    scenario: 'Audit worker node security by checking kubelet configuration, testing anonymous authentication, and exploring RuntimeClass for workload isolation.',
    objective: 'Understand kubelet security settings and how to verify node hardening.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Check kubelet configuration security',
        instruction: `Examine the kubelet configuration on a node. Check whether anonymous authentication is disabled and whether the read-only port is disabled.`,
        hints: [
          'kubectl get nodes -o yaml shows node conditions',
          'The kubelet config is at /var/lib/kubelet/config.yaml on nodes',
          'Use kubectl describe node to see node conditions and info'
        ],
        solution: `\`\`\`bash
# Check node status and conditions
kubectl get nodes
kubectl describe node <node-name>

# Check kubelet version and OS
kubectl get nodes -o wide

# Test if kubelet anonymous auth is disabled (from within a pod)
NODE_IP=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}')
echo "Testing kubelet on $NODE_IP"

kubectl run kubelet-test --image=curlimages/curl --rm -it --restart=Never \\
  -- curl -sk https://$NODE_IP:10250/pods --connect-timeout 3 2>&1 | head -5
# Expected with anonymous auth disabled: 401 Unauthorized
# Expected with anonymous auth enabled (bad): JSON pod list
\`\`\``,
        verify: `\`\`\`bash
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.nodeInfo.kubeletVersion}{"\n"}{end}'
# Expected: node names with their kubelet version

kubectl describe node $(kubectl get nodes -o jsonpath='{.items[0].metadata.name}') | grep -A3 "Conditions:"
# Expected: Ready=True and other conditions

kubectl get nodes -o jsonpath='{.items[0].status.addresses}'
# Expected: shows node IP addresses
\`\`\``
      },
      {
        title: 'Create a RuntimeClass for sandbox isolation',
        instruction: `Create a RuntimeClass for a hypothetical gVisor setup. Then demonstrate how to reference it in a Pod spec. Even without gVisor installed, you can practice the configuration.`,
        hints: [
          'RuntimeClass is in apiVersion: node.k8s.io/v1',
          'The handler must match a configured runtime on nodes',
          'Reference in Pod spec with runtimeClassName: <name>'
        ],
        solution: `\`\`\`bash
# Create a RuntimeClass (the handler must exist on nodes for pods to actually run)
cat <<EOF | kubectl apply -f -
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: secure-sandbox
handler: runc    # use runc as default (gVisor would be 'runsc')
overhead:
  podFixed:
    memory: "120Mi"  # overhead for gVisor (informational here)
scheduling:
  nodeClassification:
    tolerations:
    - key: "sandbox"
      operator: "Equal"
      value: "gvisor"
      effect: "NoSchedule"
EOF

# Create a pod using this RuntimeClass
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: sandbox-pod
spec:
  runtimeClassName: secure-sandbox
  containers:
  - name: app
    image: nginx
EOF
\`\`\``,
        verify: `\`\`\`bash
kubectl get runtimeclass
# Expected: secure-sandbox listed

kubectl get pod sandbox-pod
# Expected: Running (since we used runc which exists)

kubectl get pod sandbox-pod -o jsonpath='{.spec.runtimeClassName}'
# Expected: secure-sandbox

# Cleanup
kubectl delete pod sandbox-pod
kubectl delete runtimeclass secure-sandbox
\`\`\``
      },
      {
        title: 'Test NodeRestriction — what kubelets can and cannot do',
        instruction: `Verify that NodeRestriction admission plugin is working. Check that the API server has it enabled. Test the concept by checking RBAC restrictions on node-level service accounts.`,
        hints: [
          'Check API server flags for NodeRestriction',
          'kubectl auth can-i with --as=system:node:nodename to simulate node',
          'Nodes can get pods but not cluster-level resources'
        ],
        solution: `\`\`\`bash
# Check if NodeRestriction is enabled (from API server manifest on control plane)
# grep "NodeRestriction" /etc/kubernetes/manifests/kube-apiserver.yaml

# Test node RBAC restrictions
NODE_NAME=$(kubectl get nodes -o jsonpath='{.items[0].metadata.name}')
echo "Testing node: $NODE_NAME"

# Nodes should be able to read their own pods
kubectl auth can-i get pods \\
  --as="system:node:$NODE_NAME" \\
  --as-group="system:nodes" \\
  -n default
# Expected: yes (or determined by NodeRestriction - node can read pods scheduled on it)

# Nodes should NOT be able to list all nodes
kubectl auth can-i list nodes \\
  --as="system:node:$NODE_NAME" \\
  --as-group="system:nodes"
# Expected: no
\`\`\``,
        verify: `\`\`\`bash
NODE_NAME=$(kubectl get nodes -o jsonpath='{.items[0].metadata.name}')

# Verify NodeRestriction behavior
kubectl auth can-i get secrets \\
  --as="system:node:$NODE_NAME" \\
  --as-group="system:nodes" \\
  -n kube-system
# Expected: no (node can't read secrets in kube-system)

kubectl auth can-i get nodes \\
  --as="system:node:$NODE_NAME" \\
  --as-group="system:nodes"
# Expected: yes (node can get its own node object)
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Kubelet using AlwaysAllow authorization — critical vulnerability',
      difficulty: 'hard',
      symptom: 'Security scan reports: kubelet is using authorization mode AlwaysAllow. This means any authenticated request to the kubelet is authorized without checking RBAC.',
      diagnosis: `\`\`\`bash
# Check kubelet config on the node
cat /var/lib/kubelet/config.yaml | grep -A3 "authorization"
# Or check kubelet process flags:
ps aux | grep kubelet | grep authorization

# Test: if using AlwaysAllow, this curl should succeed (BAD):
curl -sk https://<node-ip>:10250/pods \\
  --cert /var/lib/kubelet/pki/kubelet-client-current.pem \\
  --key /var/lib/kubelet/pki/kubelet-client-current.pem 2>&1
\`\`\``,
      solution: `Change kubelet authorization mode to Webhook:

1. Edit /var/lib/kubelet/config.yaml:
\`\`\`yaml
authorization:
  mode: Webhook
  webhook:
    cacheAuthorizedTTL: 5m0s
    cacheUnauthorizedTTL: 30s
\`\`\`

2. Or if using flags, change:
\`\`\`bash
# Old (dangerous)
--authorization-mode=AlwaysAllow

# New (secure)
--authorization-mode=Webhook
\`\`\`

3. Restart kubelet:
\`\`\`bash
systemctl restart kubelet
systemctl status kubelet
\`\`\`

4. Verify with kube-bench:
\`\`\`bash
# This check should now pass:
# [PASS] 4.2.2 Ensure that the --authorization-mode argument is not set to AlwaysAllow
\`\`\``
    },
    {
      title: 'Node not joining cluster due to certificate issues',
      difficulty: 'medium',
      symptom: 'kubectl get nodes shows the node is in NotReady state. kubelet logs show: "x509: certificate signed by unknown authority" when trying to communicate with the API server.',
      diagnosis: `\`\`\`bash
# Check node status
kubectl get nodes
kubectl describe node <node-name>

# On the node: check kubelet logs
journalctl -u kubelet --no-pager | tail -30 | grep -E "error|certificate|x509"

# Check if kubelet config points to correct CA
cat /var/lib/kubelet/config.yaml | grep "clientCAFile\|tlsCertFile"

# Check certificate expiry
openssl x509 -in /var/lib/kubelet/pki/kubelet.crt -text -noout | grep "Not After"
\`\`\``,
      solution: `1. **Certificate Authority mismatch** — update kubelet CA file:
\`\`\`bash
# Copy the cluster CA from control plane
scp control-plane:/etc/kubernetes/pki/ca.crt /etc/kubernetes/pki/ca.crt
\`\`\`

2. **Expired kubelet certificate** — rotate it:
\`\`\`bash
# Delete expired cert files (kubelet will bootstrap new ones)
rm /var/lib/kubelet/pki/kubelet-client-*

# Ensure rotateCertificates: true in kubelet config
systemctl restart kubelet
# kubelet will request new cert using bootstrap token
\`\`\`

3. **Wrong API server address in kubeconfig**:
\`\`\`bash
cat /etc/kubernetes/kubelet.conf | grep server
# Should match your API server IP/hostname
\`\`\``
    }
  ]
};
