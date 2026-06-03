window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['kcna-orchestration/storage-security-concepts'] = {
  theory: `# Storage & Security Concepts in Orchestration

## Exam Relevance
> KCNA covers the conceptual understanding of how orchestration platforms handle storage and security. Expect questions about PersistentVolumes, storage classes, RBAC concepts, secrets management, and network security principles.

## Storage in Orchestration

### The Problem with Container Storage
Containers are **ephemeral** — when a container restarts, its filesystem is lost. Orchestration platforms solve this with:
1. **Volumes** — storage attached to a pod's lifetime
2. **Persistent Volumes** — storage that outlives pods

### Storage Hierarchy in Kubernetes
\`\`\`
StorageClass          ← defines storage provider/provisioner
    ↓
PersistentVolume      ← actual storage resource (cluster-level)
    ↓
PersistentVolumeClaim ← pod's request for storage (namespace-level)
    ↓
Pod Volume            ← mounted storage in the container
\`\`\`

### Storage Types

| Type | Lifecycle | Use Case |
|------|-----------|----------|
| **emptyDir** | Pod lifetime | Temporary shared storage between containers |
| **hostPath** | Node lifetime | Access node filesystem (dangerous in prod) |
| **PersistentVolume** | Independent | Databases, stateful apps |
| **ConfigMap/Secret** | Independent | Configuration files, credentials |
| **NFS/Cloud volumes** | External | Shared, durable storage |

### Access Modes
| Mode | Short | Description |
|------|-------|-------------|
| ReadWriteOnce | RWO | One node can mount read-write |
| ReadOnlyMany | ROX | Many nodes can mount read-only |
| ReadWriteMany | RWX | Many nodes can mount read-write |
| ReadWriteOncePod | RWOP | One pod can mount read-write (K8s 1.22+) |

### Reclaim Policies
| Policy | Behavior when PVC is deleted |
|--------|------------------------------|
| **Retain** | PV kept, data preserved — manual cleanup |
| **Delete** | PV and underlying storage deleted |
| **Recycle** | Deprecated — basic scrub (rm -rf) |

### Dynamic Provisioning
\`\`\`
User creates PVC → StorageClass auto-provisions PV → PV bound to PVC
\`\`\`

StorageClass allows automatic PV creation when a PVC is submitted. The cloud provider (AWS EBS, GCP PD, Azure Disk) or storage system (Ceph, NFS) handles the actual provisioning.

## Security in Orchestration

Security in orchestration is layered — often called **defense in depth**.

### The 4Cs of Cloud Native Security
1. **Code** — application-level security (SAST, dependency scanning)
2. **Container** — image security, no root, minimal base image
3. **Cluster** — RBAC, NetworkPolicy, PodSecurity, audit logging
4. **Cloud** — provider-level security (IAM, VPC, firewalls)

### Authentication vs Authorization
| Concept | Definition | Kubernetes Implementation |
|---------|------------|---------------------------|
| **Authentication** | Who are you? | Certificates, tokens, OIDC |
| **Authorization** | What can you do? | RBAC (Role-Based Access Control) |
| **Admission** | Should this request proceed? | Admission controllers |

### RBAC Concepts
\`\`\`
Subject (who?)    → Role (what?)    → Resource (on what?)
User/Group/SA       Role/ClusterRole   pods, services, etc.
       ↕
  RoleBinding / ClusterRoleBinding
\`\`\`

**Role** = namespace-scoped permissions
**ClusterRole** = cluster-wide permissions
**RoleBinding** = grants a Role to a subject in a namespace
**ClusterRoleBinding** = grants a ClusterRole cluster-wide

### Principle of Least Privilege
Grant only the minimum permissions required. In Kubernetes:
- Use **namespaces** to isolate teams
- Use **RBAC** to limit API access
- Use **NetworkPolicy** to restrict pod communication
- Use **PodSecurity** to limit container capabilities

### Secrets Management
Kubernetes Secrets store sensitive data (passwords, tokens, certificates):

\`\`\`
Secret types:
- Opaque          ← generic key-value (base64 encoded, NOT encrypted)
- kubernetes.io/tls          ← TLS certificate + key
- kubernetes.io/dockerconfigjson  ← registry pull credentials
- kubernetes.io/service-account-token  ← SA tokens
\`\`\`

**Important**: Kubernetes Secrets are base64 encoded by default, NOT encrypted. Enable **Encryption at Rest** to encrypt etcd data.

External solutions for production:
- **HashiCorp Vault** — external secret store with dynamic secrets
- **AWS Secrets Manager / GCP Secret Manager** — cloud-native secrets
- **Sealed Secrets** — encrypted Secrets safe for GitOps
- **External Secrets Operator** — syncs external secrets to K8s

### Network Security
- **NetworkPolicy** — controls pod-to-pod and pod-to-external traffic (requires CNI support)
- **Service mesh** (Istio, Linkerd) — mTLS, traffic encryption, authorization policies
- **Ingress TLS** — HTTPS termination at the cluster edge
- **Pod-to-pod encryption** — via service mesh overlay

### Pod Security
Kubernetes Pod Security Standards (PSS) define three levels:
| Level | Description |
|-------|-------------|
| **Privileged** | No restrictions |
| **Baseline** | Prevents known privilege escalation |
| **Restricted** | Hardened, follows best practices |

Applied via namespace labels:
\`\`\`
pod-security.kubernetes.io/enforce: restricted
\`\`\`

## CNCF Security Projects

| Project | Purpose |
|---------|---------|
| **Falco** | Runtime threat detection |
| **OPA/Gatekeeper** | Policy enforcement (admission) |
| **cert-manager** | TLS certificate automation |
| **Vault** | Secrets management |
| **Notary/TUF** | Container image signing |
| **Trivy/Grype** | Image vulnerability scanning |

## Common Mistakes

- Storing secrets in plain environment variables or ConfigMaps
- Using root containers in production
- Not enabling NetworkPolicy (default is allow-all)
- Not enabling encryption at rest for etcd
- Overly broad RBAC roles (cluster-admin for everything)
- Using hostPath volumes (gives node filesystem access)
`,
  quiz: [
    {
      question: 'What is the purpose of a StorageClass in Kubernetes?',
      options: [
        'To define storage provisioner properties and enable dynamic PersistentVolume creation',
        'To classify pods by storage requirements',
        'To limit the storage quota per namespace',
        'To configure the etcd storage backend'
      ],
      correct: 0,
      explanation: 'StorageClass defines a type of storage (provisioner, parameters, reclaim policy). When a PVC references a StorageClass, the provisioner automatically creates a matching PV — this is dynamic provisioning.',
      reference: 'Review "Dynamic Provisioning" section.'
    },
    {
      question: 'Which PV access mode allows multiple nodes to mount the volume read-write simultaneously?',
      options: [
        'ReadWriteMany (RWX)',
        'ReadWriteOnce (RWO)',
        'ReadOnlyMany (ROX)',
        'ReadWriteOncePod (RWOP)'
      ],
      correct: 0,
      explanation: 'ReadWriteMany (RWX) allows multiple nodes to mount the volume read-write simultaneously. Not all storage backends support this — NFS and CephFS do; AWS EBS does not.',
      reference: 'Review "Access Modes" table in the Storage section.'
    },
    {
      question: 'What is the default state of Kubernetes Secrets in etcd?',
      options: [
        'Base64 encoded but NOT encrypted — requires enabling encryption at rest',
        'AES-256 encrypted by default',
        'Stored as plaintext — require external encryption tools',
        'SHA-256 hashed and immutable after creation'
      ],
      correct: 0,
      explanation: 'Kubernetes Secrets are base64 encoded (for safe transport), NOT encrypted by default. Anyone with etcd access can decode them. Enable EncryptionConfiguration to encrypt secrets at rest.',
      reference: 'Review "Secrets Management" section.'
    },
    {
      question: 'What is the difference between a Role and a ClusterRole in RBAC?',
      options: [
        'Role is namespace-scoped; ClusterRole is cluster-wide and can also grant namespace access',
        'Role is for humans; ClusterRole is for service accounts',
        'Role is read-only; ClusterRole includes write permissions',
        'Role is for pods; ClusterRole is for nodes'
      ],
      correct: 0,
      explanation: 'Role grants permissions within a single namespace. ClusterRole grants permissions cluster-wide (e.g., nodes, PersistentVolumes) or can be reused across namespaces via RoleBindings.',
      reference: 'Review "RBAC Concepts" section.'
    },
    {
      question: 'What are the 4Cs of Cloud Native Security?',
      options: [
        'Code, Container, Cluster, Cloud',
        'Control, Compliance, Configuration, Credentials',
        'Certificates, CORS, CI/CD, Containers',
        'CoreDNS, CNI, CRI, CRD'
      ],
      correct: 0,
      explanation: 'The 4Cs framework describes the security layers: Code (app security), Container (image security), Cluster (RBAC, NetworkPolicy), Cloud (provider IAM, VPCs). Each layer protects the next.',
      reference: 'Review "The 4Cs of Cloud Native Security" section.'
    },
    {
      question: 'What happens to data in a PV with Reclaim Policy "Retain" when its PVC is deleted?',
      options: [
        'The PV is kept and data is preserved, but must be manually reclaimed',
        'The PV and all data are automatically deleted',
        'The PV is immediately available for a new PVC to claim',
        'The PV is archived to cold storage'
      ],
      correct: 0,
      explanation: 'With Retain policy, deleting the PVC releases the PV but doesn\'t delete it. The PV status changes to "Released" and must be manually cleaned up and recycled before it can be reused.',
      reference: 'Review "Reclaim Policies" table.'
    },
    {
      question: 'Which CNCF project is used for runtime security threat detection in containers?',
      options: [
        'Falco',
        'OPA/Gatekeeper',
        'cert-manager',
        'Trivy'
      ],
      correct: 0,
      explanation: 'Falco is a CNCF runtime security tool that detects unexpected behavior based on kernel system calls. OPA/Gatekeeper is for admission policies; Trivy is for static image scanning.',
      reference: 'Review "CNCF Security Projects" table.'
    },
    {
      question: 'What does the Kubernetes Pod Security Standard "restricted" level enforce?',
      options: [
        'Hardened security following security best practices (no root, no privileged containers, etc.)',
        'No pods can access external networks',
        'Only cluster-admin users can create pods',
        'Pods are limited to 1 CPU and 1Gi memory'
      ],
      correct: 0,
      explanation: 'The "restricted" PSS level enforces security best practices: no privileged containers, no running as root, seccomp profiles required, capabilities dropped. The most restrictive of the three levels.',
      reference: 'Review "Pod Security" section — PSS levels table.'
    }
  ],
  flashcards: [
    {
      front: 'What is the storage lifecycle in Kubernetes?',
      back: 'StorageClass (defines provisioner) → PersistentVolume (actual storage, cluster-level) → PersistentVolumeClaim (request for storage, namespace-level) → Pod Volume (container mount).'
    },
    {
      front: 'What are the 3 PV reclaim policies and what do they do?',
      back: 'Retain: PV kept when PVC deleted, data preserved, manual cleanup needed. Delete: PV and underlying storage deleted with PVC. Recycle: deprecated, basic scrub before reuse.'
    },
    {
      front: 'Why are Kubernetes Secrets not truly secure by default?',
      back: 'Secrets are only base64-encoded in etcd — anyone with etcd read access can decode them. Enable EncryptionConfiguration to encrypt at rest. For true secret management, use HashiCorp Vault or cloud provider secrets managers.'
    },
    {
      front: 'What are the 4Cs of Cloud Native Security?',
      back: 'Code (application security, SAST), Container (image hardening, minimal base), Cluster (RBAC, NetworkPolicy, PodSecurity), Cloud (provider IAM, VPCs, security groups). Each layer protects inner layers.'
    },
    {
      front: 'What is the difference between authentication and authorization in Kubernetes?',
      back: 'Authentication: identity verification (who are you?) — uses certificates, tokens, OIDC. Authorization: permission check (what can you do?) — uses RBAC. Admission control runs after auth and checks resource validity.'
    },
    {
      front: 'What is dynamic provisioning and what does it require?',
      back: 'Dynamic provisioning automatically creates a PV when a PVC is submitted (no manual PV creation). Requires a StorageClass with a working provisioner (cloud provider plugin or CSI driver).'
    },
    {
      front: 'What CNCF tools address secrets management?',
      back: 'HashiCorp Vault (external dynamic secrets), Sealed Secrets (encrypted secrets in Git), External Secrets Operator (syncs cloud secrets to K8s), AWS/GCP/Azure Secrets Manager (cloud-native options).'
    }
  ],
  lab: {
    scenario: 'Explore Kubernetes storage and security concepts by creating a PersistentVolume, claiming it, verifying RBAC, and practicing Secrets management.',
    objective: 'Understand the PV/PVC lifecycle, RBAC permissions, and Secrets creation and consumption.',
    duration: '20-25 minutes',
    steps: [
      {
        title: 'Create PV, PVC, and consume storage in a Pod',
        instruction: `Create a PersistentVolume (hostPath, 1Gi, RWO, Retain policy) named \`lab-pv\`. Then create a PVC named \`lab-pvc\` in namespace \`storage-lab\` requesting 500Mi. Finally create a Pod that mounts the PVC at \`/data\`.`,
        hints: [
          'PV is cluster-scoped (no namespace)',
          'PVC is namespace-scoped — create the namespace first',
          'Selector in PVC or storageClassName must match the PV for static binding',
          'Use storageClassName: "" to prevent dynamic provisioning and force static binding'
        ],
        solution: `\`\`\`bash
kubectl create namespace storage-lab

cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: PersistentVolume
metadata:
  name: lab-pv
spec:
  capacity:
    storage: 1Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  storageClassName: manual
  hostPath:
    path: /tmp/lab-pv-data
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: lab-pvc
  namespace: storage-lab
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 500Mi
  storageClassName: manual
---
apiVersion: v1
kind: Pod
metadata:
  name: storage-pod
  namespace: storage-lab
spec:
  containers:
  - name: app
    image: busybox
    command: ["sh", "-c", "echo 'hello storage' > /data/test.txt && sleep 3600"]
    volumeMounts:
    - name: data
      mountPath: /data
  volumes:
  - name: data
    persistentVolumeClaim:
      claimName: lab-pvc
EOF
\`\`\``,
        verify: `\`\`\`bash
kubectl get pv lab-pv
# Expected: STATUS=Bound

kubectl get pvc lab-pvc -n storage-lab
# Expected: STATUS=Bound, VOLUME=lab-pv

kubectl get pod storage-pod -n storage-lab
# Expected: Running

kubectl exec storage-pod -n storage-lab -- cat /data/test.txt
# Expected: hello storage
\`\`\``
      },
      {
        title: 'Create a Secret and consume it in a Pod',
        instruction: `Create a Secret named \`db-creds\` in namespace \`storage-lab\` with keys \`username=admin\` and \`password=secret123\`. Create a Pod that exposes these as environment variables. Verify the Pod can read the values.`,
        hints: [
          'kubectl create secret generic db-creds --from-literal=...',
          'In Pod spec, use env.valueFrom.secretKeyRef',
          'Use kubectl exec to verify the env variables'
        ],
        solution: `\`\`\`bash
kubectl create secret generic db-creds \\
  --from-literal=username=admin \\
  --from-literal=password=secret123 \\
  -n storage-lab

cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: secret-pod
  namespace: storage-lab
spec:
  containers:
  - name: app
    image: busybox
    command: ["sleep", "3600"]
    env:
    - name: DB_USER
      valueFrom:
        secretKeyRef:
          name: db-creds
          key: username
    - name: DB_PASS
      valueFrom:
        secretKeyRef:
          name: db-creds
          key: password
EOF
\`\`\``,
        verify: `\`\`\`bash
kubectl get secret db-creds -n storage-lab
# Expected: TYPE=Opaque, DATA=2

# Confirm encoding (NOT encryption)
kubectl get secret db-creds -n storage-lab -o jsonpath='{.data.username}' | base64 -d
# Expected: admin

kubectl exec secret-pod -n storage-lab -- env | grep DB_
# Expected:
# DB_USER=admin
# DB_PASS=secret123
\`\`\``
      },
      {
        title: 'Explore RBAC — create Role and RoleBinding',
        instruction: `Create a ServiceAccount named \`reader-sa\` in namespace \`storage-lab\`. Create a Role named \`pod-reader\` that allows \`get, list, watch\` on pods. Bind the Role to the ServiceAccount. Verify the SA can list pods but not create them.`,
        hints: [
          'kubectl create serviceaccount reader-sa -n storage-lab',
          'kubectl create role pod-reader --verb=get,list,watch --resource=pods -n storage-lab',
          'kubectl create rolebinding ... --serviceaccount=storage-lab:reader-sa',
          'Use kubectl auth can-i to verify'
        ],
        solution: `\`\`\`bash
kubectl create serviceaccount reader-sa -n storage-lab

kubectl create role pod-reader \\
  --verb=get,list,watch \\
  --resource=pods \\
  -n storage-lab

kubectl create rolebinding pod-reader-binding \\
  --role=pod-reader \\
  --serviceaccount=storage-lab:reader-sa \\
  -n storage-lab
\`\`\``,
        verify: `\`\`\`bash
# Can the SA list pods?
kubectl auth can-i list pods \\
  --as=system:serviceaccount:storage-lab:reader-sa \\
  -n storage-lab
# Expected: yes

# Can the SA create pods?
kubectl auth can-i create pods \\
  --as=system:serviceaccount:storage-lab:reader-sa \\
  -n storage-lab
# Expected: no

# Can the SA list pods in a different namespace?
kubectl auth can-i list pods \\
  --as=system:serviceaccount:storage-lab:reader-sa \\
  -n default
# Expected: no (Role is namespace-scoped)
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'PVC stuck in Pending state',
      difficulty: 'easy',
      symptom: 'PVC remains in Pending status. Pods that reference it also fail to start.',
      diagnosis: `\`\`\`bash
# Check PVC events
kubectl describe pvc <pvc-name> -n <namespace>
# Look for: "no persistent volumes available for this claim"

# Check available PVs
kubectl get pv

# Check if StorageClass exists
kubectl get storageclass
kubectl describe storageclass <name>

# Check if PVC and PV specs are compatible
kubectl get pvc <name> -n <ns> -o yaml
kubectl get pv -o yaml
\`\`\``,
      solution: `Common causes and fixes:

1. **No matching PV** (static provisioning): Create a PV that matches the PVC's storageClassName, accessMode, and capacity.

2. **StorageClass doesn't exist** (dynamic provisioning):
\`\`\`bash
kubectl get storageclass
# If missing: create or fix the storageClassName in the PVC
\`\`\`

3. **No provisioner available**: The StorageClass exists but its provisioner is not running:
\`\`\`bash
kubectl get pods -n kube-system | grep <provisioner-name>
\`\`\`

4. **Capacity mismatch**: PVC requests more than PV capacity — adjust PV or PVC.`
    },
    {
      title: 'RBAC permission denied error',
      difficulty: 'medium',
      symptom: 'A Pod or user receives: "Error from server (Forbidden): pods is forbidden: User \"system:serviceaccount:...\" cannot list resource \"pods\"',
      diagnosis: `\`\`\`bash
# Extract the SA from the error message
# Format: system:serviceaccount:<namespace>:<sa-name>

# Check what permissions the SA has
kubectl auth can-i --list \\
  --as=system:serviceaccount:<namespace>:<sa-name> \\
  -n <namespace>

# Check RoleBindings for the SA
kubectl get rolebindings -n <namespace> -o yaml | grep -A5 <sa-name>
kubectl get clusterrolebindings -o yaml | grep -A5 <sa-name>

# Check if Role exists and has the right permissions
kubectl get role <role-name> -n <namespace> -o yaml
\`\`\``,
      solution: `Create a Role with the needed permissions and bind it to the ServiceAccount:
\`\`\`bash
# Create Role with required permissions
kubectl create role <role-name> \\
  --verb=get,list,watch \\
  --resource=pods \\
  -n <namespace>

# Bind to the ServiceAccount
kubectl create rolebinding <binding-name> \\
  --role=<role-name> \\
  --serviceaccount=<namespace>:<sa-name> \\
  -n <namespace>

# Verify
kubectl auth can-i list pods \\
  --as=system:serviceaccount:<namespace>:<sa-name> \\
  -n <namespace>
# Expected: yes
\`\`\``
    }
  ]
};
