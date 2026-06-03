window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['storage/volumes'] = {
  theory: `# Volume Types & Storage Classes

## Exam Relevance
> Storage is tested in both CKA (~10%) and CKAD (~8%). You must know when to use emptyDir vs hostPath vs PVC-backed volumes, how StorageClasses work for dynamic provisioning, and how to mount volumes into pods correctly.

## Why Volumes?

Container filesystems are **ephemeral** — data disappears when the container restarts. Volumes solve this by providing a storage directory that outlives container restarts.

\`\`\`
Without volumes: container restart → all files lost
With volumes:    container restart → files persist in the volume
\`\`\`

## Volume Lifecycle vs Pod Lifecycle

| Volume Type | Survives Container Restart | Survives Pod Deletion |
|-------------|---------------------------|----------------------|
| emptyDir | Yes | No |
| hostPath | Yes | Yes (data on node) |
| PersistentVolume | Yes | Yes |
| ConfigMap/Secret vol | Yes (read-only) | N/A |

## emptyDir — Ephemeral Shared Storage

Created when the pod is assigned to a node. **Deleted when the pod is deleted.**

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: cache-pod
spec:
  containers:
  - name: app
    image: nginx:1.25
    volumeMounts:
    - name: cache
      mountPath: /tmp/cache
  volumes:
  - name: cache
    emptyDir: {}             # Empty dir, lives with the pod
    # emptyDir:
    #   medium: Memory       # RAM-backed (tmpfs) for speed
    #   sizeLimit: 128Mi     # Limit the emptyDir size
\`\`\`

**Use cases**: scratch space, inter-container file sharing, caching, logs collected by sidecar.

## hostPath — Node Filesystem Access

Mounts a directory from the **node's filesystem** into the pod. Data persists after pod deletion (on the node).

\`\`\`yaml
spec:
  containers:
  - name: app
    image: nginx:1.25
    volumeMounts:
    - name: host-data
      mountPath: /data
  volumes:
  - name: host-data
    hostPath:
      path: /mnt/data        # Path on the node
      type: DirectoryOrCreate  # Create if doesn't exist
\`\`\`

**hostPath type values:**

| Type | Behavior |
|------|----------|
| \`""\` (empty) | No checks |
| \`DirectoryOrCreate\` | Create dir if missing |
| \`Directory\` | Must exist |
| \`FileOrCreate\` | Create file if missing |
| \`File\` | File must exist |
| \`Socket\` | Unix socket must exist |

**⚠️ Caution**: hostPath ties the pod to a specific node. Not recommended for production — use PVs instead.

## ConfigMap as Volume

\`\`\`yaml
spec:
  containers:
  - name: app
    image: myapp:1.0
    volumeMounts:
    - name: config
      mountPath: /etc/config
  volumes:
  - name: config
    configMap:
      name: app-config
      # Optional: mount only specific keys as files
      items:
      - key: app.properties
        path: app.properties
\`\`\`

ConfigMap volumes are **automatically updated** when the ConfigMap changes (within ~1 minute). Environment variables from ConfigMaps are NOT updated without pod restart.

## Secret as Volume

\`\`\`yaml
spec:
  containers:
  - name: app
    image: myapp:1.0
    volumeMounts:
    - name: creds
      mountPath: /etc/secrets
      readOnly: true
  volumes:
  - name: creds
    secret:
      secretName: db-credentials
      defaultMode: 0400     # File permissions (octal)
\`\`\`

## Projected Volume — Combine Multiple Sources

\`\`\`yaml
volumes:
- name: all-in-one
  projected:
    sources:
    - configMap:
        name: app-config
    - secret:
        name: app-secret
    - serviceAccountToken:
        path: token
        expirationSeconds: 3600
\`\`\`

## StorageClass — Dynamic Provisioning

StorageClass defines the **provisioner** and **parameters** for dynamically provisioning PersistentVolumes.

\`\`\`yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"  # Make default
provisioner: kubernetes.io/no-provisioner   # local-path, gp2, standard, etc.
volumeBindingMode: WaitForFirstConsumer     # Delay binding until pod scheduled
reclaimPolicy: Retain                       # What happens when PVC is deleted
allowVolumeExpansion: true                  # Allow PVC resize
parameters:
  type: gp3                                 # Provisioner-specific
  fsType: ext4
\`\`\`

## Dynamic Provisioning Flow

\`\`\`
PVC created → Kubernetes checks storageClassName
→ StorageClass provisioner creates PV automatically
→ PV bound to PVC
→ Pod mounts PVC
\`\`\`

No need to pre-create PVs with dynamic provisioning!

\`\`\`yaml
# PVC that uses dynamic provisioning
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: auto-pvc
spec:
  accessModes:
  - ReadWriteOnce
  storageClassName: fast-ssd    # Triggers dynamic provisioning
  resources:
    requests:
      storage: 5Gi
\`\`\`

## volumeBindingMode

| Mode | Behavior |
|------|----------|
| \`Immediate\` | PV created/bound as soon as PVC is created |
| \`WaitForFirstConsumer\` | PV binding deferred until a pod using the PVC is scheduled (respects topology) |

## Checking StorageClasses

\`\`\`bash
# List storage classes
kubectl get storageclass
kubectl get sc                  # Short alias

# Default storage class is marked with (default)
# NAME       PROVISIONER                    RECLAIMPOLICY   VOLUMEBINDINGMODE   ALLOWVOLUMEEXPANSION
# standard   rancher.io/local-path          Delete          WaitForFirstConsumer true
# fast-ssd   kubernetes.io/no-provisioner   Retain          Immediate           false

# Check which StorageClass a PVC uses
kubectl get pvc my-pvc -o yaml | grep storageClassName

# Check what PV was bound to a PVC
kubectl get pvc
\`\`\`

## Inline Volumes vs PVC

\`\`\`yaml
# Inline volume (emptyDir, hostPath, etc.) — defined directly in pod
volumes:
- name: temp
  emptyDir: {}

# PVC volume — references a PersistentVolumeClaim
volumes:
- name: data
  persistentVolumeClaim:
    claimName: my-pvc
    readOnly: false
\`\`\`

## Common Errors

1. **Wrong mountPath** — path already used by the container image (conflicts with existing files)
2. **Volume not declared** — container has volumeMounts but the volume is not in spec.volumes
3. **Wrong StorageClass name** — PVC uses \`storageClassName: fast\` but class is named \`fast-ssd\` → PVC stays Pending
4. **No default StorageClass** — PVC without storageClassName stays Pending in clusters without a default SC
5. **hostPath permissions** — app runs as non-root but hostPath directory is owned by root
6. **emptyDir deleted on pod removal** — using emptyDir for data that needs persistence

## Killer.sh Style Challenge

**Task**:
1. Create a StorageClass named \`local-sc\` using provisioner \`kubernetes.io/no-provisioner\`
2. Create a PVC named \`data-pvc\` requesting 1Gi using \`local-sc\`
3. Create a pod \`data-pod\` that mounts \`data-pvc\` at \`/data\` and writes a file to it
4. Delete and recreate the pod — verify the file persists
`,
  quiz: [
    {
      question: 'What happens to emptyDir data when a pod is deleted?',
      options: [
        'Data is moved to the node filesystem for 24 hours',
        'Data is automatically backed up to the cluster etcd',
        'Data is permanently deleted with the pod',
        'Data persists until the namespace is deleted'
      ],
      correct: 2,
      explanation: 'emptyDir lives and dies with the pod. When the pod is deleted (not just the container restarting), the emptyDir data is permanently deleted. Use PersistentVolumes for data that must survive pod deletion.',
      reference: 'Volume Lifecycle vs Pod Lifecycle table in theory. emptyDir: Survives Pod Deletion = No.'
    },
    {
      question: 'You have a pod with a volumeMount but no corresponding entry in spec.volumes. What happens?',
      options: [
        'Kubernetes creates an emptyDir automatically',
        'The pod fails to start with a validation error',
        'The mount is silently ignored',
        'The pod starts but the container crashes on first write'
      ],
      correct: 1,
      explanation: 'Kubernetes validates that every volumeMount references a volume defined in spec.volumes. If the volume is missing, the pod fails to start with an error like "volume <name> not found in pod spec".',
      reference: 'Common Errors #2 — Volume not declared in spec.volumes.'
    },
    {
      question: 'What is the difference between hostPath and emptyDir?',
      options: [
        'hostPath is encrypted; emptyDir is not',
        'hostPath uses the node filesystem and data persists after pod deletion; emptyDir is pod-scoped and deleted with the pod',
        'hostPath supports ReadWriteMany; emptyDir only ReadWriteOnce',
        'They are identical — just different names for the same feature'
      ],
      correct: 1,
      explanation: 'hostPath mounts a directory from the node\'s filesystem. Data survives pod deletion since it lives on the node. emptyDir is created and deleted with the pod. hostPath also ties pods to specific nodes.',
      reference: 'hostPath vs emptyDir — the Volume Lifecycle table in theory.'
    },
    {
      question: 'When a ConfigMap is updated, how does a pod that mounts it as a volume see the changes?',
      options: [
        'The pod must be restarted to see changes',
        'Changes are visible immediately (within seconds)',
        'Changes are propagated automatically within approximately 1 minute',
        'Changes never propagate — the volume is a snapshot at pod creation time'
      ],
      correct: 2,
      explanation: 'ConfigMap-backed volumes are automatically updated by kubelet, typically within 1 minute. This is unlike environment variables from ConfigMaps, which require a pod restart to reflect changes.',
      reference: 'ConfigMap as Volume section — "automatically updated within ~1 minute".'
    },
    {
      question: 'What does volumeBindingMode: WaitForFirstConsumer do in a StorageClass?',
      options: [
        'The volume is created when the StorageClass is created',
        'Volume binding is delayed until a pod using the PVC is scheduled, respecting topology constraints',
        'The first pod to request storage gets priority',
        'Volumes are bound in FIFO order based on PVC creation time'
      ],
      correct: 1,
      explanation: 'WaitForFirstConsumer delays PV creation/binding until a pod referencing the PVC is scheduled to a node. This ensures the PV is created in the same zone/region as the node, which is critical for local storage.',
      reference: 'volumeBindingMode table in theory.'
    },
    {
      question: 'A PVC has storageClassName: premium but there is no StorageClass named "premium". What is the PVC status?',
      options: [
        'Bound — Kubernetes uses the default StorageClass as a fallback',
        'Pending — no provisioner can satisfy the PVC',
        'Failed — PVC is deleted after 30 seconds',
        'Available — waiting for a pod to use it'
      ],
      correct: 1,
      explanation: 'When a PVC references a non-existent StorageClass, it stays in Pending state permanently. There is no fallback to the default StorageClass — the exact name must match.',
      reference: 'Common Errors #3 — Wrong StorageClass name causes PVC to stay Pending.'
    },
    {
      question: 'How do you share files between two containers in the same pod?',
      options: [
        'Use a PersistentVolumeClaim mounted by both containers',
        'Use a NetworkFileSystem (NFS) volume',
        'Use an emptyDir volume mounted by both containers',
        'Containers automatically share a /tmp directory'
      ],
      correct: 2,
      explanation: 'emptyDir is the standard pattern for sharing files between containers in the same pod. Both containers declare volumeMounts referencing the same emptyDir volume name. It is created when the pod starts.',
      reference: 'emptyDir section — "inter-container file sharing" is a key use case.'
    },
    {
      question: 'What reclaimPolicy should you use to prevent data loss when a PVC is deleted?',
      options: [
        'Delete — removes PV when PVC is deleted',
        'Recycle — wipes and reuses the PV',
        'Retain — keeps PV and data after PVC deletion (requires manual cleanup)',
        'Preserve — automatic policy for all StorageClasses'
      ],
      correct: 2,
      explanation: 'Retain keeps the PV and all data when the PVC is deleted. The PV enters "Released" state and must be manually reclaimed. Delete (default for dynamic provisioning) deletes both PV and underlying storage when PVC is deleted.',
      reference: 'StorageClass YAML — reclaimPolicy: Retain in the theory.'
    }
  ],
  flashcards: [
    {
      front: 'What is the key difference between emptyDir and hostPath?',
      back: 'emptyDir: created empty when pod starts, DELETED when pod is deleted. For scratch space and inter-container sharing.\n\nhostPath: mounts a directory from the node filesystem. Data PERSISTS after pod deletion (stays on node). Ties pod to a specific node — avoid in production.'
    },
    {
      front: 'What are the 4 main volume types you must know for the exam?',
      back: '1. emptyDir — ephemeral, pod-scoped scratch space\n2. hostPath — node filesystem mount (persistent but node-tied)\n3. persistentVolumeClaim — references a PVC for durable storage\n4. configMap / secret — inject configuration as files\n\nAlso know: projected (combines multiple sources)'
    },
    {
      front: 'Does a ConfigMap volume auto-update when the ConfigMap changes?',
      back: 'Yes — ConfigMap and Secret volumes are automatically updated by kubelet within ~1 minute of the change.\n\nHowever, environment variables from ConfigMaps (envFrom / env.valueFrom) are NOT automatically updated — they require a pod restart.'
    },
    {
      front: 'What happens to a PVC that references a non-existent StorageClass?',
      back: 'The PVC stays in Pending state indefinitely. There is no fallback to the default StorageClass — the storageClassName must exactly match an existing StorageClass name.\n\nCheck: kubectl get storageclass to see available classes.'
    },
    {
      front: 'What is the purpose of a StorageClass in Kubernetes?',
      back: 'A StorageClass defines how to dynamically provision PersistentVolumes. It specifies:\n- provisioner: who creates the storage (e.g., AWS EBS, GCP PD, local-path)\n- parameters: provisioner-specific config (type, fsType, etc.)\n- reclaimPolicy: what happens when PVC is deleted (Delete or Retain)\n- volumeBindingMode: when to bind (Immediate or WaitForFirstConsumer)'
    },
    {
      front: 'What is the correct YAML structure to mount a PVC into a pod?',
      back: 'spec:\n  containers:\n  - name: app\n    volumeMounts:\n    - name: data        # Must match volume name below\n      mountPath: /data\n  volumes:\n  - name: data         # Volume name\n    persistentVolumeClaim:\n      claimName: my-pvc  # PVC that must exist in same namespace'
    },
    {
      front: 'What is volumeBindingMode: WaitForFirstConsumer?',
      back: 'Delays PV creation and PVC binding until a pod using the PVC is scheduled to a specific node. This ensures the PV is created in the correct topology zone (important for local storage and zone-specific cloud volumes).\n\nOpposite: Immediate — PV created when PVC is created, regardless of pod scheduling.'
    },
    {
      front: 'What kubectl commands list storage resources?',
      back: 'kubectl get storageclass (or kubectl get sc)\nkubectl get persistentvolume (or kubectl get pv)\nkubectl get persistentvolumeclaim (or kubectl get pvc)\nkubectl get pvc -n <namespace>\n\nCheck status: kubectl describe pvc <name>\nBound = PVC linked to PV and ready to use\nPending = waiting for provisioning or a matching PV'
    }
  ],
  lab: {
    scenario: 'You need to provide storage for a stateful application. You will configure different volume types: an emptyDir for cache, a hostPath for node-local data, and a StorageClass-backed PVC for durable storage.',
    objective: 'Practice creating and using emptyDir, hostPath, ConfigMap volume, and dynamic PVC volumes in pods.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Use emptyDir for Inter-Container Sharing',
        instruction: `Create a pod named \`shared-storage\` with:
- Container \`producer\` using \`busybox:1.36\` that writes the current timestamp every 5 seconds to \`/shared/output.txt\`
- Container \`consumer\` using \`busybox:1.36\` that tails \`/shared/output.txt\`
- An \`emptyDir\` volume named \`shared\` mounted at \`/shared\` in both containers

Verify the consumer can see data written by the producer.`,
        hints: [
          'producer command: ["sh", "-c", "while true; do date >> /shared/output.txt; sleep 5; done"]',
          'consumer command: ["sh", "-c", "tail -f /shared/output.txt"]',
          'Both volumeMounts must reference the same volume name',
          'kubectl logs shared-storage -c consumer to see the shared data'
        ],
        solution: `\`\`\`bash
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: shared-storage
spec:
  containers:
  - name: producer
    image: busybox:1.36
    command: ["sh", "-c", "while true; do date >> /shared/output.txt; sleep 5; done"]
    volumeMounts:
    - name: shared
      mountPath: /shared
  - name: consumer
    image: busybox:1.36
    command: ["sh", "-c", "tail -f /shared/output.txt"]
    volumeMounts:
    - name: shared
      mountPath: /shared
  volumes:
  - name: shared
    emptyDir: {}
EOF

kubectl get pod shared-storage
kubectl logs shared-storage -c consumer
\`\`\``,
        verify: `\`\`\`bash
# Pod should be Running with 2/2 containers
kubectl get pod shared-storage
# Expected: READY = 2/2, STATUS = Running

# Consumer should show timestamped lines from producer
kubectl logs shared-storage -c consumer
# Expected: multiple date/time lines like "Sun May 24 12:00:00 UTC 2025"

# Producer should be writing to the file
kubectl exec shared-storage -c producer -- cat /shared/output.txt
# Expected: multiple timestamp lines
\`\`\``
      },
      {
        title: 'Mount a ConfigMap as a Volume',
        instruction: `Create a ConfigMap and mount it as a volume into a pod:

1. Create ConfigMap \`app-config\` with key \`nginx.conf\` containing a basic nginx virtual host config
2. Create pod \`config-pod\` using \`nginx:1.25\` that mounts the ConfigMap at \`/etc/nginx/conf.d/\`
3. Verify nginx can read the config file from the mounted volume`,
        hints: [
          'kubectl create configmap app-config --from-literal=nginx.conf="server { listen 8080; }"',
          'In the volumes section, use: configMap: name: app-config',
          'To verify: kubectl exec config-pod -- cat /etc/nginx/conf.d/nginx.conf',
          'ConfigMap files are mounted as individual files named after the key'
        ],
        solution: `\`\`\`bash
# Create ConfigMap
kubectl create configmap app-config \
  --from-literal=nginx.conf='server { listen 8080; location / { return 200 "ok\n"; } }'

# Create pod that mounts the ConfigMap as a volume
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: config-pod
spec:
  containers:
  - name: nginx
    image: nginx:1.25
    volumeMounts:
    - name: config-volume
      mountPath: /etc/nginx/conf.d
  volumes:
  - name: config-volume
    configMap:
      name: app-config
EOF

kubectl get pod config-pod
# Verify file is mounted
kubectl exec config-pod -- cat /etc/nginx/conf.d/nginx.conf
kubectl exec config-pod -- ls /etc/nginx/conf.d/
\`\`\``,
        verify: `\`\`\`bash
# Pod should be Running
kubectl get pod config-pod
# Expected: STATUS = Running

# ConfigMap key should appear as a file
kubectl exec config-pod -- ls /etc/nginx/conf.d/
# Expected: nginx.conf

# File content should match the ConfigMap data
kubectl exec config-pod -- cat /etc/nginx/conf.d/nginx.conf
# Expected: server { listen 8080; location / { return 200 "ok\n"; } }
\`\`\``
      },
      {
        title: 'Create a StorageClass and Dynamic PVC',
        instruction: `In this step, explore StorageClasses and PVC binding:

1. List available StorageClasses and identify the default one
2. Create a PVC named \`dynamic-pvc\` with \`storageClassName\` set to the default StorageClass, requesting 100Mi ReadWriteOnce
3. Create a pod \`pvc-pod\` using \`nginx:1.25\` that mounts \`dynamic-pvc\` at \`/usr/share/nginx/html\`
4. Write a file to the mounted volume and verify it persists after pod restart`,
        hints: [
          'kubectl get sc — look for the StorageClass marked (default)',
          'PVC needs: accessModes, storageClassName, resources.requests.storage',
          'Pod volume references PVC with: persistentVolumeClaim: claimName: dynamic-pvc',
          'Write file: kubectl exec pvc-pod -- sh -c "echo hello > /usr/share/nginx/html/test.html"'
        ],
        solution: `\`\`\`bash
# Check available StorageClasses
kubectl get sc

# Get the default StorageClass name
SC_NAME=$(kubectl get sc -o jsonpath='{.items[?(@.metadata.annotations.storageclass\.kubernetes\.io/is-default-class=="true")].metadata.name}')
echo "Default StorageClass: $SC_NAME"

# Create PVC using default StorageClass
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: dynamic-pvc
spec:
  accessModes:
  - ReadWriteOnce
  storageClassName: \${SC_NAME}
  resources:
    requests:
      storage: 100Mi
EOF

# Create pod using the PVC
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: pvc-pod
spec:
  containers:
  - name: nginx
    image: nginx:1.25
    volumeMounts:
    - name: data
      mountPath: /usr/share/nginx/html
  volumes:
  - name: data
    persistentVolumeClaim:
      claimName: dynamic-pvc
EOF

kubectl get pvc dynamic-pvc
kubectl get pod pvc-pod

# Write data to the volume
kubectl exec pvc-pod -- sh -c "echo '<h1>Persistent Data</h1>' > /usr/share/nginx/html/index.html"
kubectl exec pvc-pod -- cat /usr/share/nginx/html/index.html
\`\`\``,
        verify: `\`\`\`bash
# PVC should be Bound
kubectl get pvc dynamic-pvc
# Expected: STATUS = Bound

# Pod should be Running
kubectl get pod pvc-pod
# Expected: STATUS = Running

# Data written to volume
kubectl exec pvc-pod -- cat /usr/share/nginx/html/index.html
# Expected: <h1>Persistent Data</h1>

# A PV was automatically created
kubectl get pv
# Expected: PV exists with status Bound and claim default/dynamic-pvc
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'PVC Stays in Pending State',
      difficulty: 'medium',
      symptom: 'A PVC has been created but stays in Pending state. Pods using the PVC also stay in Pending with error "persistentvolumeclaim not bound".',
      diagnosis: `\`\`\`bash
# Check PVC status
kubectl get pvc <pvc-name>
# STATUS = Pending (should be Bound)

# Get detailed reason for pending
kubectl describe pvc <pvc-name>
# Look for "Events:" section — usually shows the reason

# Check available PVs (static provisioning)
kubectl get pv
# Look for PVs with matching capacity, accessMode, and storageClass

# Check StorageClasses
kubectl get sc
# Is the referenced StorageClass present?
# Is there a default StorageClass if PVC has no storageClassName?

# Check provisioner events
kubectl get events -n <namespace> --sort-by='.lastTimestamp'
\`\`\``,
      solution: `**Cause A: No matching PV (static provisioning)**
\`\`\`bash
# The PVC needs a PV with matching:
# 1. storageClassName (or both empty)
# 2. accessModes (e.g., ReadWriteOnce)
# 3. capacity >= PVC request

kubectl get pv
# If no PVs exist or none match, create one:
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: PersistentVolume
metadata:
  name: my-pv
spec:
  capacity:
    storage: 1Gi
  accessModes:
  - ReadWriteOnce
  storageClassName: manual
  hostPath:
    path: /mnt/data
EOF
\`\`\`

**Cause B: Wrong storageClassName**
\`\`\`bash
# PVC: storageClassName: fast-ssd
# Actual: storageClassName: fast  (name mismatch)

kubectl get sc  # Check exact names
# Fix: delete PVC and recreate with correct storageClassName
kubectl delete pvc <pvc-name>
# Edit YAML and reapply
\`\`\`

**Cause C: No default StorageClass**
\`\`\`bash
# PVC has no storageClassName and no default SC exists
kubectl get sc
# Fix: annotate a StorageClass as default
kubectl patch sc <sc-name> -p \
  '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'
\`\`\``
    },
    {
      title: 'Pod Cannot Write to Volume — Permission Denied',
      difficulty: 'hard',
      symptom: 'A pod starts successfully but the application fails with "Permission denied" when writing to the mounted volume path. The pod may crash or log errors.',
      diagnosis: `\`\`\`bash
# Check pod status and events
kubectl describe pod <pod-name>
# Look for OOMKilled, CrashLoopBackOff, or error messages

# Check pod logs for permission errors
kubectl logs <pod-name>
# Look for: "Permission denied", "EACCES", "Operation not permitted"

# Check the volume mount and security context
kubectl get pod <pod-name> -o yaml | grep -A20 securityContext
kubectl get pod <pod-name> -o yaml | grep -A5 volumeMounts

# Exec into the pod and check permissions
kubectl exec <pod-name> -- ls -la /mountpath
kubectl exec <pod-name> -- id
# Shows UID/GID of the running process
\`\`\``,
      solution: `**Cause A: hostPath directory owned by root, app runs as non-root**
\`\`\`bash
# The app container runs as UID 1000 but /mnt/data on the node is owned by root
# Fix: set fsGroup in pod security context
spec:
  securityContext:
    fsGroup: 1000     # All volume mounts will be owned by GID 1000
    runAsUser: 1000
  containers:
  - name: app
    securityContext:
      runAsNonRoot: true
\`\`\`

**Cause B: Secret volume is read-only by default**
\`\`\`bash
# Secrets are mounted read-only — you cannot write to them
# Fix: use a separate emptyDir if you need writable temp space
volumes:
- name: secret-data
  secret:
    secretName: my-secret
- name: writable-cache
  emptyDir: {}
\`\`\`

**Cause C: PV provisioned as root, app runs as non-root**
\`\`\`bash
# For PVC-backed volumes, use fsGroup:
spec:
  securityContext:
    fsGroup: 1000
  # This changes ownership of mounted volumes to GID 1000
  # allowing the app user (UID 1000, GID 1000) to write
\`\`\``
    }
  ]
};
