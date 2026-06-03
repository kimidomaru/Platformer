window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['storage/pv-pvc'] = {
  theory: `
# Persistent Volumes & Claims

## Exam Relevance
> Storage is 10% of the CKA exam. Expect tasks creating PersistentVolumes and PersistentVolumeClaims, binding them manually or via StorageClasses, and troubleshooting binding issues.

## Core Concepts

Kubernetes separates storage provisioning from consumption using three objects:

| Object | Role | Who manages it |
|--------|------|----------------|
| **PersistentVolume (PV)** | Storage resource in the cluster | Cluster admin |
| **PersistentVolumeClaim (PVC)** | Request for storage by an app | Developer |
| **StorageClass** | Template for dynamic provisioning | Cluster admin |

### PV Lifecycle

\`\`\`
Available → Bound → Released → Retained/Recycled/Deleted
\`\`\`

- **Available**: PV exists, not yet bound to a PVC
- **Bound**: PV is bound to exactly one PVC (1-to-1 relationship)
- **Released**: PVC was deleted; PV still has data (depends on reclaimPolicy)
- **Failed**: Dynamic provisioning failed

### Access Modes

| Mode | Short | Meaning |
|------|-------|---------|
| **ReadWriteOnce** | RWO | Mounted read-write by **one node** |
| **ReadOnlyMany** | ROX | Mounted read-only by **many nodes** |
| **ReadWriteMany** | RWX | Mounted read-write by **many nodes** |
| **ReadWriteOncePod** | RWOP | Mounted read-write by **one pod** (K8s 1.22+) |

> Not all volume types support all access modes. \`hostPath\` only supports RWO.

### Reclaim Policies

| Policy | Behavior when PVC is deleted |
|--------|------------------------------|
| **Retain** | PV stays; data preserved; manual cleanup needed |
| **Delete** | PV and underlying storage are deleted |
| **Recycle** | (Deprecated) Simple scrub: \`rm -rf /data/*\` |

### Binding Matching Rules

A PVC binds to a PV if **all** match:
1. **Capacity**: PV capacity ≥ PVC request
2. **Access modes**: PV supports all modes requested by PVC
3. **StorageClassName**: Both must have the same (or both empty)
4. **volumeMode**: Both must match (Filesystem or Block)
5. **Selector/Label**: PVC selector must match PV labels

## Essential Commands

\`\`\`bash
# List PVs and PVCs
kubectl get pv
kubectl get pvc -A

# Describe for binding details
kubectl describe pv my-pv
kubectl describe pvc my-pvc -n dev

# Check StorageClasses
kubectl get storageclass
kubectl describe storageclass standard

# Force delete a stuck PVC (remove finalizers)
kubectl patch pvc my-pvc -n dev \\
  -p '{"metadata":{"finalizers":null}}'
\`\`\`

## Complete YAML Examples

### Static Provisioning (PV + PVC)

\`\`\`yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-data
  labels:
    type: local-storage
spec:
  capacity:
    storage: 5Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  storageClassName: manual        # must match PVC storageClassName
  hostPath:
    path: /mnt/data               # only for single-node/dev clusters
\`\`\`

\`\`\`yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: pvc-data
  namespace: dev
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 2Gi                # PV must have >= 2Gi
  storageClassName: manual        # must match PV storageClassName
  selector:
    matchLabels:
      type: local-storage         # optional: target specific PV
\`\`\`

### Dynamic Provisioning (StorageClass + PVC)

\`\`\`yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast
provisioner: kubernetes.io/no-provisioner   # replace with actual provisioner
volumeBindingMode: WaitForFirstConsumer     # bind only when Pod is scheduled
reclaimPolicy: Delete
\`\`\`

\`\`\`yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: pvc-fast
  namespace: prod
spec:
  storageClassName: fast
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
# PV is automatically created by the provisioner
\`\`\`

### Pod Using a PVC

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: data-app
spec:
  volumes:
  - name: app-data
    persistentVolumeClaim:
      claimName: pvc-data       # must be in same namespace as pod
  containers:
  - name: app
    image: nginx
    volumeMounts:
    - name: app-data
      mountPath: /var/data      # path inside the container
\`\`\`

## StorageClass: volumeBindingMode

| Mode | Behavior |
|------|----------|
| **Immediate** (default) | PVC binds as soon as it's created |
| **WaitForFirstConsumer** | PVC binds only when a Pod using it is scheduled (respects topology constraints) |

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| PVC stuck in \`Pending\` | No matching PV | Check capacity, access modes, storageClassName |
| PV stuck in \`Released\` | Previous PVC deleted; Retain policy | Manually delete the PV and re-create, or remove \`claimRef\` |
| \`Multi-Attach error\` | Multiple nodes trying RWO | Change to RWX or ensure single-node access |
| PVC deleted but PV still exists | \`Retain\` reclaim policy | Expected — manually clean up data and delete PV |
| Pod in \`Pending\` — \`waiting for volume binding\` | WaitForFirstConsumer + node not scheduled | Normal — PVC binds when pod is scheduled |

## Killer.sh Style Challenge

> **Scenario**: Create a PersistentVolume \`pv-exam\` (2Gi, hostPath: \`/data/exam\`, RWO, Retain, storageClass: \`exam\`). Create a PVC \`pvc-exam\` in namespace \`exam\` that binds to it (1Gi request, same storageClass). Create a Pod that mounts the PVC at \`/data\`.

\`\`\`bash
# After creating PV and PVC via YAML:
kubectl get pv pv-exam          # Should show Bound
kubectl get pvc pvc-exam -n exam  # Should show Bound
kubectl describe pod exam-pod -n exam  # Verify volume mounted
\`\`\`
`,
  quiz: [
    {
      question: 'A PVC is stuck in `Pending` state. Which of the following is NOT a valid cause?',
      options: [
        'No PV with matching capacity exists',
        'The StorageClass name in PVC does not match any PV',
        'The PVC access mode is ReadWriteMany but the PV only supports ReadWriteOnce',
        'The PVC is in a different cluster region than the PV'
      ],
      correct: 3,
      explanation: 'PV/PVC binding is a cluster-internal mechanism based on capacity, access modes, storageClassName, and selectors. Region is not a standard PV/PVC binding criterion (though StorageClass topology might consider it).',
      reference: 'Study: 5 binding criteria — capacity, access modes, storageClassName, volumeMode, selector.'
    },
    {
      question: 'What happens to a PV with `persistentVolumeReclaimPolicy: Retain` when its PVC is deleted?',
      options: [
        'The PV and its data are automatically deleted',
        'The PV is immediately available for a new PVC to bind',
        'The PV moves to Released state; data is preserved; manual cleanup required',
        'The PV is recycled (data wiped) and made Available again'
      ],
      correct: 2,
      explanation: 'With `Retain`, when the PVC is deleted, the PV moves to `Released` state. The data is preserved but the PV is not automatically re-available for new PVCs. An admin must manually delete or re-create it.',
      reference: 'Reclaim policies: Retain (manual cleanup), Delete (auto-delete), Recycle (deprecated).'
    },
    {
      question: 'Which access mode allows a volume to be mounted read-write by multiple nodes simultaneously?',
      options: [
        'ReadWriteOnce (RWO)',
        'ReadOnlyMany (ROX)',
        'ReadWriteMany (RWX)',
        'ReadWriteOncePod (RWOP)'
      ],
      correct: 2,
      explanation: '`ReadWriteMany (RWX)` allows the volume to be mounted read-write by multiple nodes at the same time. This requires a distributed storage backend like NFS, CephFS, or cloud-native solutions.',
      reference: 'hostPath and many local volumes only support RWO. NFS supports RWX.'
    },
    {
      question: 'A PVC requests 3Gi of storage. A PV has 10Gi available. Both have the same access mode and storageClassName. What happens?',
      options: [
        'The PVC stays Pending because 3Gi ≠ 10Gi',
        'The PV is split: 3Gi goes to the PVC, 7Gi remains Available',
        'The PVC binds to the 10Gi PV; the full 10Gi PV is dedicated to this PVC',
        'The PVC binds but only 3Gi is usable'
      ],
      correct: 2,
      explanation: 'PV-PVC binding is all-or-nothing — the entire PV is dedicated to one PVC. The PVC gets access to the full 10Gi PV, even though it only requested 3Gi. There is no splitting.',
      reference: 'PV and PVC have a 1-to-1 binding relationship. A PV cannot be shared between PVCs.'
    },
    {
      question: 'What does `volumeBindingMode: WaitForFirstConsumer` do in a StorageClass?',
      options: [
        'Delays PV creation until an admin manually approves',
        'Delays PVC binding until a Pod using the PVC is scheduled, ensuring topology-aware placement',
        'Waits for the first node to be available before creating the PV',
        'Creates the PV immediately but delays mounting until the Pod starts'
      ],
      correct: 1,
      explanation: '`WaitForFirstConsumer` delays PVC binding until a Pod using the PVC is actually scheduled. This ensures the PV is created in the correct topology zone (e.g., same availability zone as the Pod\'s node).',
      reference: 'Use WaitForFirstConsumer for zone-aware storage (local-storage, cloud EBS, etc.).'
    },
    {
      question: 'A Pod is in Pending state with error: "persistentvolumeclaim not found". The PVC exists. What is the most likely cause?',
      options: [
        'The PVC capacity is too small for the Pod',
        'The PVC is in a different namespace than the Pod',
        'The StorageClass does not support the Pod\'s node',
        'The PVC access mode is incompatible with the node'
      ],
      correct: 1,
      explanation: 'PVCs are namespace-scoped. A Pod can only use a PVC in the same namespace. If the Pod is in namespace `prod` but the PVC is in namespace `dev`, the Pod cannot find it.',
      reference: 'PVCs are namespaced; PVs are cluster-scoped. Pods reference PVCs in the same namespace only.'
    },
    {
      question: 'Which command removes the finalizer that prevents a PVC from being deleted?',
      options: [
        'kubectl delete pvc my-pvc --force --grace-period=0',
        'kubectl patch pvc my-pvc -p \'{"metadata":{"finalizers":null}}\'',
        'kubectl annotate pvc my-pvc kubectl.kubernetes.io/last-applied=""',
        'kubectl edit pvc my-pvc and remove the finalizer manually'
      ],
      correct: 1,
      explanation: 'PVCs sometimes get stuck in terminating state due to finalizers (e.g., `kubernetes.io/pvc-protection`). Patching the finalizers to null forces removal. Options C and D also work but B is the most reliable single command.',
      reference: 'PVC protection finalizer prevents deletion while pods use it. Remove pod first, then PVC.'
    },
    {
      question: 'How do you bind a PVC to a specific PV (not just any matching PV)?',
      options: [
        'Set the PVC\'s `spec.volumeName` to the PV\'s name',
        'Add a label to the PV and use `spec.selector.matchLabels` in the PVC',
        'Both A and B are valid methods',
        'You cannot pre-select a PV — binding is automatic only'
      ],
      correct: 2,
      explanation: 'Both methods work: (A) `spec.volumeName` directly references a named PV; (B) PVC selectors match PV labels. Option A is more direct; Option B allows matching from a labeled set.',
      reference: 'For exam: use volumeName for direct binding. Use selectors for label-based selection.'
    }
  ],
  flashcards: [
    {
      front: 'What are the 4 PV lifecycle phases?',
      back: '1. **Available** — PV exists, not bound to any PVC\n2. **Bound** — PV is bound to exactly one PVC\n3. **Released** — PVC was deleted; PV retains data (depends on reclaimPolicy)\n4. **Failed** — dynamic provisioning failed\n\nPhase transitions are one-directional: Available → Bound → Released'
    },
    {
      front: 'What are the 5 criteria for PV-PVC binding?',
      back: '1. **Capacity**: PV capacity ≥ PVC request\n2. **Access modes**: PV supports all PVC modes\n3. **StorageClassName**: both must match (or both empty)\n4. **volumeMode**: Filesystem or Block — must match\n5. **Selector**: PVC label selector must match PV labels\n\nAll 5 must be satisfied for binding to occur.'
    },
    {
      front: 'Difference between RWO, ROX, RWX, RWOP access modes?',
      back: '| Mode | Full Name | Multi-node? |\n|------|-----------|-------------|\n| RWO | ReadWriteOnce | ❌ One node r/w |\n| ROX | ReadOnlyMany | ✅ Many nodes r/o |\n| RWX | ReadWriteMany | ✅ Many nodes r/w |\n| RWOP | ReadWriteOncePod | ❌ One pod r/w |\n\nhostPath: RWO only. NFS: RWX.'
    },
    {
      front: 'What is the difference between static and dynamic provisioning?',
      back: '**Static**: Admin pre-creates PVs → PVC binds to existing PV\n\n**Dynamic**: StorageClass + provisioner automatically creates PVs when a PVC is submitted\n\nFor dynamic: no PV creation needed, just PVC + StorageClass. For static: create PV first, then PVC.'
    },
    {
      front: 'A PV is in Released state. How do you make it Available again?',
      back: '**Retain policy**: PV is not auto-recycled.\n\nOption 1: Delete the PV and re-create it (data in underlying storage persists)\n\nOption 2: Remove the `claimRef` from the PV spec:\n```bash\nkubectl patch pv my-pv \\\n  -p \'{"spec":{"claimRef":null}}\'\n```\nPV then returns to Available status.'
    },
    {
      front: 'How do you mount a PVC in a Pod?',
      back: '```yaml\nspec:\n  volumes:\n  - name: my-vol\n    persistentVolumeClaim:\n      claimName: my-pvc    # PVC name\n  containers:\n  - name: app\n    volumeMounts:\n    - name: my-vol\n      mountPath: /data     # path in container\n```\n\nPVC must be in the same namespace as the Pod.'
    },
    {
      front: 'What does `WaitForFirstConsumer` volumeBindingMode do?',
      back: 'Delays PVC binding until a **Pod using the PVC is scheduled**.\n\n✅ Benefit: PV is created in the correct zone/topology (same AZ as the Pod\'s node)\n\n⚠️ Without it (`Immediate`): PV is created in a random zone, potentially forcing the Pod to a node in that zone.'
    },
    {
      front: 'What are the three reclaimPolicy options for a PV?',
      back: '| Policy | Action when PVC deleted |\n|--------|------------------------|\n| **Retain** | PV → Released; data preserved; manual cleanup |\n| **Delete** | PV + underlying storage deleted automatically |\n| **Recycle** | *Deprecated* — `rm -rf /data/*` then Available |\n\nDefault for dynamically provisioned PVs: **Delete**\nBest for production data: **Retain**'
    }
  ],
  lab: {
    scenario: 'You need to provision storage for applications using both static and dynamic methods, then troubleshoot binding issues.',
    objective: 'Create PVs, PVCs, StorageClasses, mount volumes in Pods, and resolve common binding failures.',
    duration: '25-30 minutes',
    steps: [
      {
        title: 'Static Provisioning — Create PV and PVC',
        instruction: `Create a **PersistentVolume** named \`pv-static\` with:
- Capacity: **2Gi**
- Access mode: **ReadWriteOnce**
- Reclaim policy: **Retain**
- StorageClass: **manual**
- Type: hostPath at \`/mnt/k8s-lab\`

Then create a **PVC** named \`pvc-static\` in namespace \`storage-lab\` requesting **1Gi** with the same storageClass. Verify the binding.`,
        hints: [
          'Create the namespace first: kubectl create namespace storage-lab',
          'PV is cluster-scoped (no namespace). PVC is namespace-scoped',
          'The PV capacity must be >= PVC request. storageClassName must match exactly',
          'Use \`kubectl get pv,pvc\` to check binding status'
        ],
        solution: `\`\`\`bash
kubectl create namespace storage-lab

# Create PV
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-static
spec:
  capacity:
    storage: 2Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  storageClassName: manual
  hostPath:
    path: /mnt/k8s-lab
EOF

# Create PVC
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: pvc-static
  namespace: storage-lab
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
  storageClassName: manual
EOF

# Check binding
kubectl get pv pv-static
kubectl get pvc pvc-static -n storage-lab
\`\`\``,
        verify: `\`\`\`bash
kubectl get pv pv-static
# Expected: STATUS=Bound, CLAIM=storage-lab/pvc-static

kubectl get pvc pvc-static -n storage-lab
# Expected: STATUS=Bound, VOLUME=pv-static

kubectl describe pvc pvc-static -n storage-lab | grep "Volume:"
# Expected: Volume: pv-static
\`\`\``
      },
      {
        title: 'Mount a PVC into a Pod',
        instruction: `Create a Pod named \`storage-pod\` in namespace \`storage-lab\` that:
- Uses image \`busybox\`
- Mounts the PVC \`pvc-static\` at path \`/data\`
- Runs command: \`while true; do echo "data" >> /data/log.txt; sleep 5; done\`

Verify the pod is running and that the file is being written to the volume.`,
        hints: [
          'Define a volume in spec.volumes referencing the PVC by claimName',
          'Mount it with volumeMounts.mountPath',
          'Use \`kubectl exec\` to verify file creation inside the container'
        ],
        solution: `\`\`\`bash
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: storage-pod
  namespace: storage-lab
spec:
  volumes:
  - name: app-data
    persistentVolumeClaim:
      claimName: pvc-static
  containers:
  - name: writer
    image: busybox
    command: ["/bin/sh", "-c"]
    args:
    - while true; do echo "data" >> /data/log.txt; sleep 5; done
    volumeMounts:
    - name: app-data
      mountPath: /data
EOF

kubectl get pod storage-pod -n storage-lab
kubectl exec -n storage-lab storage-pod -- cat /data/log.txt
\`\`\``,
        verify: `\`\`\`bash
kubectl get pod storage-pod -n storage-lab
# Expected: STATUS=Running

kubectl exec -n storage-lab storage-pod -- ls /data/
# Expected: log.txt

kubectl exec -n storage-lab storage-pod -- wc -l /data/log.txt
# Expected: increasing line count (file is being written to)
\`\`\``
      },
      {
        title: 'Troubleshoot a Stuck PVC',
        instruction: `Create a PVC named \`pvc-broken\` in namespace \`storage-lab\` requesting **10Gi**, access mode **ReadWriteMany**, storageClass **premium**. It will stay in Pending state (no matching PV exists). Diagnose why it is stuck, then fix it by creating a matching PV.`,
        hints: [
          'The PVC will be Pending because no PV satisfies all matching criteria',
          'Use \`kubectl describe pvc pvc-broken\` to see the exact reason',
          'You need to create a PV with >= 10Gi, RWX mode, and storageClass=premium',
          'hostPath PVs on a real cluster support RWO only; for RWX you would use NFS'
        ],
        solution: `\`\`\`bash
# Create the broken PVC
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: pvc-broken
  namespace: storage-lab
spec:
  accessModes:
    - ReadWriteMany
  resources:
    requests:
      storage: 10Gi
  storageClassName: premium
EOF

# Diagnose
kubectl describe pvc pvc-broken -n storage-lab
# Look for: "no persistent volumes available for this claim"

# Fix: Create a matching PV (using NFS-style path for RWX simulation)
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-premium
spec:
  capacity:
    storage: 20Gi
  accessModes:
    - ReadWriteMany
  persistentVolumeReclaimPolicy: Delete
  storageClassName: premium
  nfs:
    server: 192.168.1.100
    path: /exported/data
EOF

# Verify binding
kubectl get pvc pvc-broken -n storage-lab
\`\`\``,
        verify: `\`\`\`bash
kubectl describe pvc pvc-broken -n storage-lab | grep "Events:"
# Expected: Initially shows "no persistent volumes available"
# After PV creation:
kubectl get pvc pvc-broken -n storage-lab
# Expected: STATUS=Bound, VOLUME=pv-premium

kubectl get pv pv-premium
# Expected: STATUS=Bound, CLAIM=storage-lab/pvc-broken
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'PVC stuck in Pending — storageClassName mismatch',
      difficulty: 'easy',
      symptom: 'PVC `app-data` stays in `Pending` state. A PV with sufficient capacity and matching access mode exists, but the PVC is not binding to it.',
      diagnosis: `\`\`\`bash
# Check PVC details
kubectl describe pvc app-data -n <namespace>
# Look for events: "no persistent volumes available for this claim"
# Check: storageClassName field

# Check PV details
kubectl describe pv pv-data
# Look for: storageClassName field

# Compare storageClassNames
kubectl get pvc app-data -n <namespace> -o jsonpath='{.spec.storageClassName}'
kubectl get pv pv-data -o jsonpath='{.spec.storageClassName}'
\`\`\``,
      solution: `The PVC and PV have different \`storageClassName\` values. For binding, they must match exactly (including empty string).

\`\`\`bash
# Option 1: Update the PVC to match the PV's storageClass
# (Must delete and re-create since spec is immutable after creation)
kubectl delete pvc app-data -n <namespace>

cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: app-data
  namespace: <namespace>
spec:
  accessModes: [ReadWriteOnce]
  resources:
    requests:
      storage: 2Gi
  storageClassName: manual    # match PV's storageClassName
EOF

# Option 2: Update the PV's storageClassName (if PV is not yet bound)
kubectl patch pv pv-data -p '{"spec":{"storageClassName":"correct-class"}}'

# Verify
kubectl get pvc app-data -n <namespace>
# Expected: STATUS=Bound
\`\`\`

**Key lesson**: storageClassName must match EXACTLY. An empty string (\`""\`) and a missing field are NOT the same.`
    },
    {
      title: 'PV stuck in Released — cannot bind new PVC',
      difficulty: 'medium',
      symptom: 'PV `pv-old` is in `Released` state after its PVC was deleted (Retain policy). A new PVC with matching spec is created but stays in Pending — it cannot bind to the released PV.',
      diagnosis: `\`\`\`bash
# Check PV status
kubectl get pv pv-old
# Shows: STATUS=Released

# Check PV details — look for claimRef
kubectl describe pv pv-old
# Look for: Source: claimRef points to old deleted PVC
# "claimRef: namespace/old-pvc-name"

# This is why new PVCs cannot bind — the PV is still "claimed"
# even though the original PVC is gone
\`\`\``,
      solution: `With \`Retain\` policy, the PV keeps a \`claimRef\` to its previous PVC even after deletion. This prevents auto-binding to new PVCs.

\`\`\`bash
# Remove the claimRef to make the PV Available again
kubectl patch pv pv-old \\
  -p '{"spec":{"claimRef":null}}'

# Verify PV is now Available
kubectl get pv pv-old
# Expected: STATUS=Available

# The new PVC should now bind automatically
kubectl get pvc new-pvc -n <namespace>
# Expected: STATUS=Bound, VOLUME=pv-old
\`\`\`

**Important**: Before clearing the \`claimRef\`, ensure you have handled any data cleanup needed from the previous PVC's data. The Retain policy is designed to preserve data for manual recovery.`
    }
  ]
};
