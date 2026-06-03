window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['storage/volumes'] = {
  theory: `# Tipos de Volume e StorageClasses

## Visao Geral

Volumes no Kubernetes permitem que dados persistam alem do ciclo de vida de um container. Diferente de um disco de container (que e efemero), volumes existem enquanto o Pod existir (ou mais, dependendo do tipo).

### Diagrama: Hierarquia de Volumes no Kubernetes

\`\`\`
┌──────────────────────────────────────────────────────────────────┐
│                    TIPOS DE VOLUME NO KUBERNETES                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────┐  ┌────────────────────────┐│
│  │       EFEMEROS (vida do Pod)    │  │  PERSISTENTES          ││
│  │  ┌───────────┐ ┌────────────┐  │  │  ┌──────────────────┐  ││
│  │  │ emptyDir  │ │ configMap  │  │  │  │ PersistentVolume │  ││
│  │  └───────────┘ └────────────┘  │  │  │     (PV)         │  ││
│  │  ┌───────────┐ ┌────────────┐  │  │  └────────┬─────────┘  ││
│  │  │  secret   │ │ downwardAPI│  │  │           │             ││
│  │  └───────────┘ └────────────┘  │  │  ┌────────▼─────────┐  ││
│  │  ┌───────────┐ ┌────────────┐  │  │  │PersistentVolume  │  ││
│  │  │ projected │ │CSI Ephem.  │  │  │  │  Claim (PVC)     │  ││
│  │  └───────────┘ └────────────┘  │  │  └────────┬─────────┘  ││
│  └─────────────────────────────────┘  │           │             ││
│                                       │  ┌────────▼─────────┐  ││
│  ┌─────────────────────────────────┐  │  │   StorageClass   │  ││
│  │     SEMI-PERSISTENTES           │  │  │ (provisionamento │  ││
│  │  ┌───────────┐                  │  │  │   dinamico)      │  ││
│  │  │ hostPath  │ (vida do Node)   │  │  └──────────────────┘  ││
│  │  └───────────┘                  │  └────────────────────────┘│
│  └─────────────────────────────────┘                            │
└──────────────────────────────────────────────────────────────────┘
\`\`\`

---

## emptyDir

Volume efemero criado quando o Pod e alocado em um node e deletado quando o Pod e removido. Util para dados temporarios compartilhados entre containers do mesmo Pod.

### Casos de uso principais

- **Cache temporario**: dados processados que podem ser recriados
- **Comunicacao entre containers**: sidecar pattern, logs compartilhados
- **Sorting/merge em disco**: operacoes que excedem a memoria disponivel

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: pod-compartilhado
spec:
  volumes:
  - name: dados-temp
    emptyDir: {}
  containers:
  - name: writer
    image: busybox:1.36
    command: ["sh", "-c", "while true; do date >> /dados/log.txt; sleep 5; done"]
    volumeMounts:
    - name: dados-temp
      mountPath: /dados
  - name: reader
    image: busybox:1.36
    command: ["sh", "-c", "while true; do cat /dados/log.txt; sleep 10; done"]
    volumeMounts:
    - name: dados-temp
      mountPath: /dados
\`\`\`

### emptyDir com limite de memoria (tmpfs)

\`\`\`yaml
volumes:
- name: cache
  emptyDir:
    medium: Memory
    sizeLimit: 256Mi
\`\`\`

Com \`medium: Memory\`, o volume usa **tmpfs** (RAM), sendo mais rapido mas consumindo memoria do node. Pontos importantes:

- O consumo conta contra o **limite de memoria do container**
- Se o Pod exceder o sizeLimit, ele e **expulso (evicted)** do node
- Os dados sao perdidos em qualquer reinicio do Pod
- Ideal para caches de alta performance e dados sensiveis temporarios

### emptyDir com sizeLimit em disco

\`\`\`yaml
volumes:
- name: temp-storage
  emptyDir:
    sizeLimit: 1Gi
\`\`\`

Sem \`medium: Memory\`, o sizeLimit controla o espaco em disco. O kubelet monitora periodicamente e evicta o Pod se o limite for excedido.

---

## hostPath

Monta um diretorio ou arquivo do sistema de arquivos do node no Pod. Util para acesso a recursos do node, mas **nao recomendado para dados de aplicacao em producao** (o Pod fica amarrado ao node).

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: pod-hostpath
spec:
  volumes:
  - name: host-log
    hostPath:
      path: /var/log/app
      type: DirectoryOrCreate
  containers:
  - name: app
    image: nginx:1.25
    volumeMounts:
    - name: host-log
      mountPath: /var/log/nginx
\`\`\`

### Tipos de hostPath

| Tipo | Descricao | Comportamento |
|------|-----------|---------------|
| "" (default) | Sem verificacao previa | Pode falhar em runtime |
| DirectoryOrCreate | Cria o diretorio se nao existir | Criado com permissao 0755, owner root |
| Directory | Diretorio deve existir | Falha se nao existir |
| FileOrCreate | Cria o arquivo se nao existir | Criado com permissao 0644, owner root |
| File | Arquivo deve existir | Falha se nao existir |
| Socket | Socket Unix deve existir | Falha se nao existir |
| BlockDevice | Dispositivo de bloco deve existir | Falha se nao existir |
| CharDevice | Dispositivo de caractere deve existir | Falha se nao existir |

### Riscos de Seguranca do hostPath

- Acesso ao sistema de arquivos do node = possivel **escape do container**
- Nao use hostPath em ambientes multi-tenant
- Se possivel, restrinja o uso via PodSecurityStandards ou OPA/Gatekeeper
- Pods com hostPath ficam **vinculados ao node** (sem portabilidade)

### Uso legitimo de hostPath

\`\`\`yaml
# DaemonSet para coleta de logs do node
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: log-agent
spec:
  selector:
    matchLabels:
      app: log-agent
  template:
    metadata:
      labels:
        app: log-agent
    spec:
      containers:
      - name: agent
        image: fluentd:v1.16
        volumeMounts:
        - name: varlog
          mountPath: /var/log
          readOnly: true
        - name: containers-log
          mountPath: /var/lib/docker/containers
          readOnly: true
      volumes:
      - name: varlog
        hostPath:
          path: /var/log
          type: Directory
      - name: containers-log
        hostPath:
          path: /var/lib/docker/containers
          type: Directory
\`\`\`

---

## ConfigMap Volume

Monta um ConfigMap como arquivos no sistema de arquivo do container. Cada chave do ConfigMap se torna um arquivo.

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: pod-configmap
spec:
  volumes:
  - name: config-vol
    configMap:
      name: app-config
      items:
      - key: app.properties
        path: application.properties
      - key: LOG_LEVEL
        path: log-level.txt
  containers:
  - name: app
    image: nginx:1.25
    volumeMounts:
    - name: config-vol
      mountPath: /etc/app
      readOnly: true
\`\`\`

### Atualizacao automatica de ConfigMap volumes

Quando um ConfigMap e atualizado, os arquivos montados sao atualizados automaticamente pelo kubelet (delay de **30-60 segundos** em media). Porem ha excecoes:

- ConfigMaps montados com **subPath NAO sao atualizados** automaticamente
- ConfigMaps com \`immutable: true\` nao podem ser alterados
- A aplicacao precisa recarregar os arquivos para usar os novos valores

---

## Secret Volume

Semelhante ao ConfigMap, mas para dados sensiveis. Os dados sao decodificados de base64 e montados como arquivos.

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: pod-secret
spec:
  volumes:
  - name: secret-vol
    secret:
      secretName: db-credentials
      defaultMode: 0400
  containers:
  - name: app
    image: myapp:1.0
    volumeMounts:
    - name: secret-vol
      mountPath: /etc/secrets
      readOnly: true
\`\`\`

### defaultMode e permissoes

O campo \`defaultMode\` define as permissoes Unix dos arquivos. Valores comuns:

| defaultMode | Permissao | Uso |
|-------------|-----------|-----|
| 0644 | rw-r--r-- | Padrao para ConfigMaps |
| 0400 | r-------- | Recomendado para Secrets |
| 0755 | rwxr-xr-x | Scripts executaveis |

---

## subPath - Montagem Parcial

O \`subPath\` permite montar um arquivo ou subdiretorio especifico de um volume sem substituir o diretorio inteiro.

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: pod-subpath
spec:
  volumes:
  - name: config
    configMap:
      name: nginx-config
  containers:
  - name: nginx
    image: nginx:1.25
    volumeMounts:
    - name: config
      mountPath: /etc/nginx/nginx.conf
      subPath: nginx.conf
\`\`\`

### Quando usar subPath

- Montar um arquivo especifico sem substituir todo o diretorio
- Evitar que uma montagem de volume "esconda" arquivos existentes no container
- Cada container pode usar um subPath diferente do mesmo volume

### Limitacao importante do subPath

- **NAO recebe atualizacoes automaticas** de ConfigMaps/Secrets
- Para receber atualizacoes, monte o volume inteiro (sem subPath) em outro diretorio e crie um symlink

---

## Projected Volume

Combina multiplas fontes (ConfigMaps, Secrets, ServiceAccountTokens, DownwardAPI) em um unico diretorio montado.

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: pod-projected
spec:
  volumes:
  - name: all-in-one
    projected:
      sources:
      - configMap:
          name: app-config
          items:
          - key: LOG_LEVEL
            path: log-level
      - secret:
          name: db-credentials
          items:
          - key: password
            path: db-password
            mode: 0400
      - serviceAccountToken:
          path: token
          expirationSeconds: 3600
          audience: api
      - downwardAPI:
          items:
          - path: pod-name
            fieldRef:
              fieldPath: metadata.name
          - path: pod-namespace
            fieldRef:
              fieldPath: metadata.namespace
          - path: labels
            fieldRef:
              fieldPath: metadata.labels
          - path: cpu-request
            resourceFieldRef:
              containerName: app
              resource: requests.cpu
  containers:
  - name: app
    image: myapp:1.0
    volumeMounts:
    - name: all-in-one
      mountPath: /run/secrets
\`\`\`

### DownwardAPI - Informacoes disponiveis

| Campo fieldRef | Descricao |
|----------------|-----------|
| metadata.name | Nome do Pod |
| metadata.namespace | Namespace do Pod |
| metadata.labels | Labels do Pod |
| metadata.annotations | Annotations do Pod |
| spec.nodeName | Nome do node |
| spec.serviceAccountName | Nome do ServiceAccount |
| status.podIP | IP do Pod |

| Campo resourceFieldRef | Descricao |
|-------------------------|-----------|
| requests.cpu | CPU request do container |
| limits.cpu | CPU limit do container |
| requests.memory | Memory request do container |
| limits.memory | Memory limit do container |

---

## CSI Ephemeral Volumes

Volumes efemeros fornecidos por drivers CSI. Criados e deletados com o ciclo de vida do Pod, sem necessidade de PV/PVC.

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: pod-csi-ephemeral
spec:
  containers:
  - name: app
    image: myapp:1.0
    volumeMounts:
    - name: ephemeral-data
      mountPath: /data
  volumes:
  - name: ephemeral-data
    csi:
      driver: inline.storage.kubernetes.io
      volumeAttributes:
        size: 5Gi
        type: ext4
\`\`\`

Exemplos praticos: secrets-store-csi-driver (para montar secrets de HashiCorp Vault, AWS Secrets Manager), drivers de armazenamento local efemero.

---

## Generic Ephemeral Volumes

Volumes efemeros que usam PVC automatico (criado e deletado com o Pod), mas com a flexibilidade de StorageClasses.

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: pod-generic-ephemeral
spec:
  containers:
  - name: app
    image: myapp:1.0
    volumeMounts:
    - name: scratch-data
      mountPath: /scratch
  volumes:
  - name: scratch-data
    ephemeral:
      volumeClaimTemplate:
        metadata:
          labels:
            type: scratch
        spec:
          accessModes: ["ReadWriteOnce"]
          storageClassName: fast-storage
          resources:
            requests:
              storage: 10Gi
\`\`\`

Diferente do emptyDir, suporta snapshots, restauracao, redimensionamento e qualquer feature da StorageClass.

---

## StorageClass em Detalhe

StorageClass define como o armazenamento e provisionado dinamicamente.

### Diagrama: Provisionamento Dinamico com StorageClass

\`\`\`
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│  Desenvolvedor│     │   PVC        │     │  StorageClass    │
│  cria PVC    │────>│ storageClass │────>│  provisioner:    │
│              │     │ Name: "fast" │     │  ebs.csi.aws.com │
└──────────────┘     └──────┬───────┘     └────────┬─────────┘
                            │                      │
                            │   Binding automatico  │  Provisiona volume
                            │                      │  no provedor cloud
                            │                      ▼
                     ┌──────▼───────┐     ┌──────────────────┐
                     │   PV         │<────│   AWS EBS Volume │
                     │ (criado auto)│     │   (gp3, 20Gi)    │
                     └──────────────┘     └──────────────────┘
\`\`\`

### Parametros comuns

\`\`\`yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-storage
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
  iops: "3000"
  throughput: "125"
  encrypted: "true"
reclaimPolicy: Delete
allowVolumeExpansion: true
volumeBindingMode: WaitForFirstConsumer
mountOptions:
- debug
\`\`\`

### Campos da StorageClass

| Campo | Descricao | Valores |
|-------|-----------|---------|
| provisioner | Driver que cria o volume | ebs.csi.aws.com, pd.csi.storage.gke.io, etc. |
| parameters | Parametros do provisioner | Especificos do driver |
| reclaimPolicy | O que fazer quando PVC e deletado | Delete (padrao), Retain |
| allowVolumeExpansion | Permitir expandir PVCs | true / false |
| volumeBindingMode | Quando provisionar | Immediate / WaitForFirstConsumer |
| mountOptions | Opcoes de mount | debug, noatime, ro, etc. |

### StorageClass padrao

Apenas uma StorageClass pode ter a annotation \`storageclass.kubernetes.io/is-default-class: "true"\`. PVCs sem \`storageClassName\` usam a classe padrao.

\`\`\`bash
# Ver StorageClasses (a padrao tem (default) ao lado)
kubectl get storageclass
# NAME                 PROVISIONER             RECLAIMPOLICY   VOLUMEBINDINGMODE
# standard (default)   rancher.io/local-path   Delete          WaitForFirstConsumer
# fast                 ebs.csi.aws.com         Delete          Immediate

# Definir uma StorageClass como padrao
kubectl patch storageclass fast -p \\
  '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'

# Remover padrao anterior
kubectl patch storageclass standard -p \\
  '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"false"}}}'
\`\`\`

---

## volumeBindingMode

Controla QUANDO o volume e provisionado e vinculado.

### Immediate

\`\`\`yaml
volumeBindingMode: Immediate
\`\`\`

O volume e provisionado **imediatamente** quando o PVC e criado, independente de haver um Pod. Problema: pode criar volumes em zonas onde nenhum Pod pode ser agendado.

### WaitForFirstConsumer

\`\`\`yaml
volumeBindingMode: WaitForFirstConsumer
\`\`\`

O volume e provisionado apenas quando um Pod que usa o PVC e agendado. O volume e criado na **mesma zona/topologia do Pod**. Recomendado para ambientes multi-zona.

| Cenario | Immediate | WaitForFirstConsumer |
|---------|-----------|----------------------|
| Multi-zona | Pode criar em zona errada | Cria na zona do Pod |
| Velocidade | PVC pronto imediatamente | PVC fica Pending ate Pod |
| Topologia | Ignora restricoes | Respeita affinity do Pod |
| Recomendado para | Single-zona simples | Producao multi-zona |

---

## allowVolumeExpansion - Expansao de Volumes

\`\`\`yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: expandable
provisioner: ebs.csi.aws.com
allowVolumeExpansion: true
\`\`\`

\`\`\`bash
# Expandir um PVC (StorageClass deve ter allowVolumeExpansion: true)
kubectl patch pvc meu-pvc \\
  -p '{"spec":{"resources":{"requests":{"storage":"20Gi"}}}}'

# Acompanhar a expansao
kubectl describe pvc meu-pvc
# Condition: FileSystemResizePending -> Done

# Para volumes que exigem reinicio do Pod para expandir o filesystem:
kubectl delete pod <pod-usando-pvc>
# O novo Pod ativara o resize do filesystem
\`\`\`

### Tipos de expansao

| Cenario | Comportamento |
|---------|---------------|
| Volume com Pod rodando | Expansao online (se suportado pelo driver) |
| Volume sem Pod | Expansao offline, resize do FS no proximo mount |
| Reducao de tamanho | **NAO suportado** - volumes so podem crescer |

---

## CSI (Container Storage Interface)

Padrao da industria para integrar sistemas de armazenamento de terceiros ao Kubernetes sem modificar o core.

### Diagrama: Arquitetura CSI

\`\`\`
┌───────────────────────────────────────────────────────────────┐
│                      KUBERNETES CLUSTER                       │
│                                                               │
│  ┌─────────────────┐          ┌─────────────────────────────┐│
│  │   kubelet        │          │  CSI Controller Plugin      ││
│  │  ┌─────────────┐ │          │  (Deployment)               ││
│  │  │CSI Node     │ │          │  - external-provisioner     ││
│  │  │Plugin       │ │          │  - external-attacher        ││
│  │  │(DaemonSet)  │ │          │  - external-resizer         ││
│  │  └──────┬──────┘ │          │  - external-snapshotter     ││
│  └─────────┼────────┘          └──────────┬──────────────────┘│
│            │                              │                   │
│            │  gRPC calls                  │  gRPC calls       │
│            ▼                              ▼                   │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │              CSI Driver (vendor-specific)                 │ │
│  │  AWS EBS | GCP PD | Azure Disk | Ceph | NFS | ...        │ │
│  └──────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
\`\`\`

### In-tree vs Out-of-tree (CSI Migration)

Drivers de armazenamento antigos eram compilados no binario do Kubernetes (in-tree). O CSI permite drivers externos (out-of-tree):

| Aspecto | In-tree (legado) | Out-of-tree (CSI) |
|---------|------------------|-------------------|
| Atualizacao | Requer atualizar K8s | Independente |
| Provisioners | kubernetes.io/* | *.csi.*.com |
| Manutencao | Time do K8s | Vendor do storage |
| Futuro | Sendo migrados para CSI | Padrao atual |

\`\`\`yaml
# Exemplo: StorageClass CSI para Ceph RBD
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: ceph-rbd
provisioner: rbd.csi.ceph.com
parameters:
  clusterID: "abc123"
  pool: "kubernetes"
  imageFormat: "2"
  imageFeatures: layering
  csi.storage.k8s.io/provisioner-secret-name: csi-rbd-secret
  csi.storage.k8s.io/provisioner-secret-namespace: ceph-csi
reclaimPolicy: Delete
allowVolumeExpansion: true
volumeBindingMode: Immediate
\`\`\`

\`\`\`bash
# Listar CSI drivers instalados
kubectl get csidrivers

# Ver informacoes do CSI node (capacidade, topologias)
kubectl get csinodes
kubectl describe csinode <nome-do-node>

# Ver volumeattachments (volumes attached a nodes)
kubectl get volumeattachments
\`\`\`

---

## Volume Propagation (mountPropagation)

Controla como as montagens sao propagadas entre o host e o container.

\`\`\`yaml
volumeMounts:
- name: host-mount
  mountPath: /mnt/data
  mountPropagation: Bidirectional
\`\`\`

| Modo | Descricao |
|------|-----------|
| None (padrao) | Montagens do host nao sao visiveis no container e vice-versa |
| HostToContainer | Montagens novas no host sao visiveis no container |
| Bidirectional | Montagens propagadas em ambas as direcoes (requer privileged) |

---

## Comparacao Completa dos Tipos de Volume

| Tipo | Escopo | Persistencia | Atualizacao Auto | Caso de Uso |
|------|--------|-------------|------------------|-------------|
| emptyDir | Pod | Efemero (vida do Pod) | N/A | Cache, comunicacao entre containers |
| emptyDir (Memory) | Pod | Efemero (RAM) | N/A | Cache de alta performance |
| hostPath | Node | Semi-persistente | N/A | DaemonSets, acesso ao node |
| configMap | Cluster | Enquanto ConfigMap existir | Sim (exceto subPath) | Configuracoes de aplicacao |
| secret | Namespace | Enquanto Secret existir | Sim (exceto subPath) | Credenciais, certificados |
| projected | Pod | Combinacao das fontes | Depende da fonte | Multiplas fontes em 1 dir |
| PVC (local) | Node | Persistente (Retain) | N/A | Lab, desenvolvimento |
| PVC (CSI) | Cluster | Persistente | N/A | Banco de dados, producao |
| CSI ephemeral | Pod | Efemero | N/A | Secrets de vault, temp storage |
| generic ephemeral | Pod | Efemero (com PVC) | N/A | Scratch space com SC features |
`,

  quiz: [
    {
      question: 'Qual tipo de volume e criado automaticamente quando um Pod e alocado e deletado quando o Pod termina?',
      options: [
        'hostPath',
        'persistentVolumeClaim',
        'emptyDir',
        'configMap'
      ],
      correct: 2,
      explanation: '"emptyDir" e criado quando um Pod e alocado em um node e e deletado permanentemente quando o Pod termina (por qualquer razao). E util para armazenar dados temporarios ou para compartilhar dados entre containers do mesmo Pod.'
    },
    {
      question: 'Qual e a diferenca entre volumeBindingMode "Immediate" e "WaitForFirstConsumer"?',
      options: [
        'Immediate cria o volume antes do PVC, WaitForFirstConsumer cria no momento do PVC',
        'Immediate provisiona o volume ao criar o PVC, WaitForFirstConsumer espera ate um Pod ser agendado para provisionar na zona correta',
        'Immediate e para volumes locais, WaitForFirstConsumer e para volumes em nuvem',
        'WaitForFirstConsumer e mais rapido pois pre-aloca o volume'
      ],
      correct: 1,
      explanation: '"Immediate" provisiona o PV imediatamente quando o PVC e criado, podendo criar o volume em uma zona diferente de onde o Pod sera agendado. "WaitForFirstConsumer" aguarda o Pod ser agendado e entao provisiona o PV na mesma zona/topologia do Pod. Recomendado para ambientes multi-zona.'
    },
    {
      question: 'Qual e a vantagem de usar "emptyDir.medium: Memory" em vez de emptyDir padrao?',
      options: [
        'O volume persiste apos o Pod ser reiniciado',
        'O volume usa tmpfs (RAM), sendo mais rapido, mas consumindo memoria do node e do limite do container',
        'O volume pode ser acessado por outros Pods no mesmo node',
        'O volume e automaticamente backupeado pelo Kubernetes'
      ],
      correct: 1,
      explanation: 'Com "medium: Memory", o emptyDir usa tmpfs (sistema de arquivos em memoria RAM). Isso e significativamente mais rapido para I/O, ideal para caches. A desvantagem e que consome memoria do node (conta no limite de memoria do container) e os dados sao perdidos em reinicio.'
    },
    {
      question: 'O que acontece quando um ConfigMap montado como volume e atualizado usando subPath?',
      options: [
        'O arquivo e atualizado automaticamente em 30-60 segundos',
        'O arquivo NAO e atualizado automaticamente - subPath nao recebe atualizacoes',
        'O Pod e reiniciado automaticamente para aplicar a mudanca',
        'O ConfigMap nao pode ser montado com subPath'
      ],
      correct: 1,
      explanation: 'Quando um ConfigMap e montado usando subPath, o arquivo NAO recebe atualizacoes automaticas. Esta e uma limitacao importante do subPath. Para receber atualizacoes, monte o volume inteiro (sem subPath) em um diretorio separado.'
    },
    {
      question: 'Qual tipo de hostPath cria automaticamente o diretorio com permissao 0755 se ele nao existir?',
      options: [
        'Directory',
        'File',
        'DirectoryOrCreate',
        'Auto'
      ],
      correct: 2,
      explanation: '"DirectoryOrCreate" cria o diretorio com permissao 0755 caso nao exista no node. "Directory" falharia se nao existir. "FileOrCreate" faz o mesmo para arquivos. Usando "" (vazio/padrao) nao ha verificacao previa.'
    },
    {
      question: 'Um Projected Volume pode combinar quais fontes?',
      options: [
        'Apenas ConfigMap e Secret',
        'ConfigMap, Secret, ServiceAccountToken e DownwardAPI',
        'ConfigMap, Secret e PersistentVolumeClaim',
        'Qualquer tipo de volume do Kubernetes'
      ],
      correct: 1,
      explanation: 'Projected Volume combina exatamente 4 fontes: ConfigMaps, Secrets, ServiceAccountTokens (com expiracao e audience configuraveis) e DownwardAPI (metadados do Pod como nome, namespace, labels, recursos). NAO suporta PVCs ou outros tipos de volume.'
    },
    {
      question: 'Qual campo do volumeMounts controla a propagacao de montagens entre host e container?',
      options: [
        'readOnly',
        'subPath',
        'mountPropagation',
        'volumeMode'
      ],
      correct: 2,
      explanation: '"mountPropagation" controla como montagens sao propagadas. "None" (padrao) isola completamente, "HostToContainer" propaga novas montagens do host para o container, e "Bidirectional" propaga em ambas as direcoes (requer privileged).'
    },
    {
      question: 'Qual e a principal vantagem dos CSI drivers (out-of-tree) sobre os drivers in-tree?',
      options: [
        'Sao mais rapidos na leitura de dados',
        'Podem ser atualizados independentemente do Kubernetes, sem modificar o core',
        'Suportam apenas volumes efemeros',
        'Nao requerem StorageClass para funcionar'
      ],
      correct: 1,
      explanation: 'CSI drivers sao plugins externos que podem ser desenvolvidos e atualizados independentemente do Kubernetes. Antes do CSI, os drivers eram compilados no binario do K8s (in-tree), exigindo atualizar o cluster inteiro para adicionar ou corrigir um driver de storage.'
    },
    {
      question: 'Como um Generic Ephemeral Volume difere de um emptyDir?',
      options: [
        'Nao difere, sao sinonimos',
        'Generic Ephemeral Volume usa PVC/StorageClass automatico, suportando snapshots, expansao e qualquer feature da StorageClass',
        'emptyDir persiste mais tempo que Generic Ephemeral Volume',
        'Generic Ephemeral Volume so funciona com CSI drivers'
      ],
      correct: 1,
      explanation: 'Generic Ephemeral Volumes criam automaticamente um PVC efemero que e deletado com o Pod. Diferente do emptyDir, eles suportam todas as features das StorageClasses como snapshots, restauracao, expansao e provisionamento dinamico. Sao definidos com spec.volumes[].ephemeral.volumeClaimTemplate.'
    },
    {
      question: 'Ao expandir um PVC, qual condicao aparece no PVC indicando que o filesystem precisa ser redimensionado?',
      options: [
        'VolumeResizeSuccessful',
        'FileSystemResizePending',
        'VolumeExpansionInProgress',
        'StorageClassExpansionReady'
      ],
      correct: 1,
      explanation: 'A condicao "FileSystemResizePending" indica que o volume foi expandido no backend de storage, mas o filesystem dentro do volume ainda precisa ser redimensionado. Em alguns drivers, isso acontece automaticamente; em outros, o Pod precisa ser reiniciado para que o resize ocorra no proximo mount.'
    }
  ],

  flashcards: [
    {
      front: 'Quais sao as diferencas entre emptyDir e hostPath?',
      back: 'emptyDir:\n- Criado vazio quando o Pod inicia\n- Deletado quando o Pod termina\n- Compartilhado entre containers do mesmo Pod\n- Nao vinculado a um path especifico do node\n\nhostPath:\n- Aponta para um path especifico do node\n- Persiste apos o Pod terminar (no node)\n- O Pod fica vinculado ao node\n- Risco de seguranca (acesso ao filesystem do node)\n- Nao recomendado para producao (exceto DaemonSets)'
    },
    {
      front: 'Quando usar WaitForFirstConsumer vs Immediate em StorageClass?',
      back: 'WaitForFirstConsumer (recomendado para producao):\n- Provisiona volume APOS o Pod ser agendado\n- Garante que o volume seja criado na mesma zona do Pod\n- Evita problemas de topologia multi-zona\n- PVC fica em Pending ate o Pod ser criado\n\nImmediate:\n- Provisiona ao criar o PVC, antes do Pod\n- Pode criar volume em zona diferente do Pod\n- Usar quando topologia nao e preocupacao\n- PVC fica Bound imediatamente'
    },
    {
      front: 'O que e subPath e qual sua limitacao principal?',
      back: 'subPath permite montar um ARQUIVO ou SUBDIRETORIO especifico de um volume, sem substituir o diretorio inteiro.\n\nUso: volumeMounts[].subPath: "arquivo.conf"\n\nLimitacao CRITICA:\n- Volumes montados com subPath NAO recebem atualizacoes automaticas de ConfigMaps/Secrets\n- Para atualizacoes, monte o volume inteiro em outro diretorio'
    },
    {
      front: 'O que e um Projected Volume e quais fontes ele pode combinar?',
      back: 'Projected Volume combina multiplas fontes em um unico mountPath:\n\n1. configMap: dados de ConfigMaps\n2. secret: dados de Secrets (com modo de arquivo)\n3. serviceAccountToken: token JWT com expiracao e audience configuraveis\n4. downwardAPI: metadados do Pod (nome, namespace, labels, annotations, recursos)\n\nNAO suporta PVCs ou outros tipos de volume.'
    },
    {
      front: 'Quais informacoes a DownwardAPI pode expor como volume?',
      back: 'Via fieldRef:\n- metadata.name (nome do Pod)\n- metadata.namespace\n- metadata.labels\n- metadata.annotations\n- spec.nodeName\n- spec.serviceAccountName\n- status.podIP\n\nVia resourceFieldRef:\n- requests.cpu / limits.cpu\n- requests.memory / limits.memory\n- requests.ephemeral-storage / limits.ephemeral-storage'
    },
    {
      front: 'Quais sao as configuracoes principais de uma StorageClass?',
      back: 'provisioner: driver que cria o volume (ex: ebs.csi.aws.com)\nparameters: parametros especificos do provisioner\nreclaimPolicy: Retain ou Delete (padrao: Delete)\nallowVolumeExpansion: true/false\nvolumeBindingMode: Immediate ou WaitForFirstConsumer\nmountOptions: opcoes de montagem (noatime, debug, etc.)\n\nAnnotation para classe padrao:\nstorageclass.kubernetes.io/is-default-class: "true"'
    },
    {
      front: 'Qual a diferenca entre CSI Ephemeral Volumes e Generic Ephemeral Volumes?',
      back: 'CSI Ephemeral:\n- Definido diretamente em spec.volumes[].csi\n- Depende do driver CSI suportar modo inline\n- Simples, sem PVC\n- Ex: secrets-store-csi-driver\n\nGeneric Ephemeral:\n- Definido em spec.volumes[].ephemeral.volumeClaimTemplate\n- Cria PVC automatico (deletado com o Pod)\n- Suporta TODAS as features de StorageClass\n- Ex: scratch space com snapshots'
    },
    {
      front: 'Como funciona o mountPropagation e quais sao os modos?',
      back: 'mountPropagation controla propagacao de mounts entre host e container:\n\n1. None (padrao): Isolamento total. Novas montagens no host ou container nao sao visiveis no outro\n\n2. HostToContainer: Novas montagens no host sao visiveis no container. Util para CSI drivers\n\n3. Bidirectional: Propagacao em ambas as direcoes. Requer container privilegiado. Usado por CSI node plugins'
    },
    {
      front: 'Como verificar os CSI drivers instalados no cluster?',
      back: 'kubectl get csidrivers\n# Lista os drivers CSI instalados\n\nkubectl get csinodes\n# Lista informacoes de CSI por node\n\nkubectl describe csinode <nome-do-node>\n# Detalha os drivers e topologias suportadas\n\nkubectl get volumeattachments\n# Lista volumes attached a nodes\n\nkubectl get storageclass\n# Lista StorageClasses (cada uma usa um provisioner/driver)'
    },
    {
      front: 'Qual a diferenca entre montar um ConfigMap como volume vs como variavel de ambiente?',
      back: 'Volume:\n- Cada chave vira um arquivo no mountPath\n- Atualizacoes sao refletidas automaticamente (30-60s)\n- Suporta items para selecionar/renomear chaves\n- Excecao: subPath NAO atualiza\n\nVariavel de ambiente (env/envFrom):\n- Injetado na inicializacao do container\n- NAO atualiza automaticamente (requer restart)\n- Mais simples para valores simples\n- Visivel em logs e kubectl describe pod'
    },
    {
      front: 'Por que hostPath e um risco de seguranca e quando e aceitavel usa-lo?',
      back: 'Riscos:\n- Acesso ao filesystem do node = possivel escape do container\n- Pods ficam vinculados ao node (sem portabilidade)\n- Dados nao sao replicados entre nodes\n- Nao funciona em ambientes multi-tenant\n\nUso aceitavel:\n- DaemonSets para coleta de logs (/var/log)\n- Acesso ao Docker socket (monitoramento)\n- Desenvolvimento local\n- Sempre com readOnly: true quando possivel'
    }
  ],

  lab: {
    scenario: 'Um time de desenvolvimento precisa configurar um Pod com multiplas fontes de configuracao: dados de ambiente vindo de ConfigMap, credenciais de um Secret, metadados do Pod via DownwardAPI, e um cache em memoria usando emptyDir. Voce tambem deve criar uma StorageClass personalizada e verificar as opcoes de binding.',
    objective: 'Usar emptyDir com medium Memory, montar ConfigMap e Secret como volumes, usar Projected Volume com DownwardAPI, criar StorageClass com WaitForFirstConsumer e verificar o comportamento de provisionamento',
    steps: [
      {
        title: 'Criar Pod com emptyDir e volumes de ConfigMap e Secret',
        instruction: 'Crie um ConfigMap chamado `app-cfg` com as chaves "app.conf" (contendo "mode=production") e "version" (contendo "1.0.0"). Crie um Secret chamado `app-secret` com a chave "api-key" (valor: "minha-chave-secreta"). Crie um Pod chamado `multi-vol-pod` com: (1) emptyDir com medium Memory montado em /cache, (2) ConfigMap montado em /etc/app, (3) Secret montado em /etc/secrets com defaultMode 0400.',
        hints: [
          'Use spec.volumes com tres entradas: emptyDir, configMap e secret',
          'spec.volumes[].emptyDir: {medium: "Memory", sizeLimit: "64Mi"}',
          'spec.containers[].volumeMounts precisa de tres entradas correspondentes'
        ],
        solution: '```bash\n# Criar ConfigMap\nkubectl create configmap app-cfg \\\n  --from-literal=version=1.0.0 \\\n  --from-literal="app.conf=mode=production"\n\n# Criar Secret\nkubectl create secret generic app-secret \\\n  --from-literal=api-key=minha-chave-secreta\n\n# Criar Pod com multiplos volumes\ncat <<EOF | kubectl apply -f -\napiVersion: v1\nkind: Pod\nmetadata:\n  name: multi-vol-pod\nspec:\n  volumes:\n  - name: cache-vol\n    emptyDir:\n      medium: Memory\n      sizeLimit: 64Mi\n  - name: config-vol\n    configMap:\n      name: app-cfg\n  - name: secret-vol\n    secret:\n      secretName: app-secret\n      defaultMode: 0400\n  containers:\n  - name: app\n    image: busybox:1.36\n    command: ["sleep", "3600"]\n    volumeMounts:\n    - name: cache-vol\n      mountPath: /cache\n    - name: config-vol\n      mountPath: /etc/app\n      readOnly: true\n    - name: secret-vol\n      mountPath: /etc/secrets\n      readOnly: true\nEOF\n\nkubectl wait pod multi-vol-pod --for=condition=Ready --timeout=60s\n```'
      },
      {
        title: 'Verificar os volumes montados dentro do Pod',
        instruction: 'Inspecione os volumes montados dentro do Pod multi-vol-pod. Verifique o conteudo de /etc/app (deve ter os arquivos do ConfigMap), /etc/secrets (deve ter o arquivo api-key) e /cache (deve estar vazio e montado em memoria). Verifique as permissoes dos arquivos do Secret.',
        hints: [
          'kubectl exec multi-vol-pod -- ls /etc/app para listar arquivos do ConfigMap',
          'kubectl exec multi-vol-pod -- cat /etc/secrets/api-key para ver o secret (decodificado)',
          'kubectl exec multi-vol-pod -- df -h /cache para ver que esta em tmpfs'
        ],
        solution: '```bash\n# Verificar arquivos do ConfigMap\nkubectl exec multi-vol-pod -- ls -la /etc/app\nkubectl exec multi-vol-pod -- cat /etc/app/version\nkubectl exec multi-vol-pod -- cat "/etc/app/app.conf"\n\n# Verificar Secret (ja decodificado do base64)\nkubectl exec multi-vol-pod -- ls -la /etc/secrets\n# Permissao deve ser -r-------- (0400)\nkubectl exec multi-vol-pod -- cat /etc/secrets/api-key\n\n# Verificar emptyDir em memoria\nkubectl exec multi-vol-pod -- df -h /cache\n# Deve mostrar tmpfs como filesystem\n\n# Escrever no cache e verificar\nkubectl exec multi-vol-pod -- sh -c "echo dados-em-memoria > /cache/temp.txt && cat /cache/temp.txt"\n```'
      },
      {
        title: 'Criar Pod com Projected Volume e DownwardAPI',
        instruction: 'Crie um Pod chamado `projected-pod` com um Projected Volume que combine: (1) o ConfigMap app-cfg, (2) o Secret app-secret com modo 0400, (3) DownwardAPI expondo o nome do Pod, namespace e labels. Monte tudo em /run/config.',
        hints: [
          'Use spec.volumes[].projected.sources com 3 entradas',
          'DownwardAPI usa fieldRef.fieldPath para metadata',
          'ServiceAccountToken pode ser adicionado como 4a fonte'
        ],
        solution: '```bash\ncat <<EOF | kubectl apply -f -\napiVersion: v1\nkind: Pod\nmetadata:\n  name: projected-pod\n  labels:\n    app: demo\n    env: lab\nspec:\n  volumes:\n  - name: all-config\n    projected:\n      sources:\n      - configMap:\n          name: app-cfg\n      - secret:\n          name: app-secret\n          items:\n          - key: api-key\n            path: api-key\n            mode: 0400\n      - downwardAPI:\n          items:\n          - path: pod-name\n            fieldRef:\n              fieldPath: metadata.name\n          - path: pod-namespace\n            fieldRef:\n              fieldPath: metadata.namespace\n          - path: labels\n            fieldRef:\n              fieldPath: metadata.labels\n  containers:\n  - name: app\n    image: busybox:1.36\n    command: ["sleep", "3600"]\n    volumeMounts:\n    - name: all-config\n      mountPath: /run/config\nEOF\n\nkubectl wait pod projected-pod --for=condition=Ready --timeout=60s\n\n# Verificar conteudo\nkubectl exec projected-pod -- ls -la /run/config/\nkubectl exec projected-pod -- cat /run/config/pod-name\nkubectl exec projected-pod -- cat /run/config/pod-namespace\nkubectl exec projected-pod -- cat /run/config/labels\nkubectl exec projected-pod -- cat /run/config/api-key\n```'
      },
      {
        title: 'Testar subPath e verificar limitacao de atualizacao',
        instruction: 'Crie um Pod chamado `subpath-pod` montando APENAS a chave "version" do ConfigMap app-cfg como /etc/version usando subPath. Atualize o ConfigMap mudando version para "2.0.0". Verifique que o arquivo NAO foi atualizado no Pod com subPath, mas FOI atualizado no projected-pod (sem subPath).',
        hints: [
          'Use volumeMounts[].subPath para montar arquivo especifico',
          'kubectl edit configmap app-cfg para alterar o valor',
          'Aguarde 60s e verifique ambos os pods'
        ],
        solution: '```bash\n# Criar Pod com subPath\ncat <<EOF | kubectl apply -f -\napiVersion: v1\nkind: Pod\nmetadata:\n  name: subpath-pod\nspec:\n  volumes:\n  - name: config\n    configMap:\n      name: app-cfg\n  containers:\n  - name: app\n    image: busybox:1.36\n    command: ["sleep", "3600"]\n    volumeMounts:\n    - name: config\n      mountPath: /etc/version\n      subPath: version\nEOF\n\nkubectl wait pod subpath-pod --for=condition=Ready --timeout=60s\n\n# Verificar valor atual\nkubectl exec subpath-pod -- cat /etc/version\n# Output: 1.0.0\n\n# Atualizar o ConfigMap\nkubectl patch configmap app-cfg -p \'{"data":{"version":"2.0.0"}}\'\n\n# Aguardar propagacao (60s)\nsleep 60\n\n# Verificar subPath: NAO deve ter atualizado\nkubectl exec subpath-pod -- cat /etc/version\n# Output: 1.0.0 (nao atualizado!)\n\n# Verificar projected-pod: DEVE ter atualizado\nkubectl exec projected-pod -- cat /run/config/version\n# Output: 2.0.0 (atualizado!)\n```'
      },
      {
        title: 'Criar StorageClass com WaitForFirstConsumer',
        instruction: 'Crie uma StorageClass chamada `local-storage` com volumeBindingMode WaitForFirstConsumer. Crie um PVC usando essa StorageClass e observe que o PVC fica em Pending ate um Pod ser criado.',
        hints: [
          'kubectl get storageclass para ver quais provisioners estao disponiveis',
          'PVC com WaitForFirstConsumer fica em Pending ate haver um Pod consumidor',
          'Crie um Pod usando o PVC e observe o PVC mudar para Bound'
        ],
        solution: '```bash\n# Ver StorageClasses disponiveis\nkubectl get storageclass\n\n# Criar StorageClass\ncat <<EOF | kubectl apply -f -\napiVersion: storage.k8s.io/v1\nkind: StorageClass\nmetadata:\n  name: local-storage\nprovisioner: rancher.io/local-path\nreclaimPolicy: Delete\nvolumeBindingMode: WaitForFirstConsumer\nallowVolumeExpansion: true\nEOF\n\n# Criar PVC\ncat <<EOF | kubectl apply -f -\napiVersion: v1\nkind: PersistentVolumeClaim\nmetadata:\n  name: pvc-wffc\nspec:\n  accessModes:\n  - ReadWriteOnce\n  resources:\n    requests:\n      storage: 256Mi\n  storageClassName: local-storage\nEOF\n\n# PVC fica em Pending (WaitForFirstConsumer)\nkubectl get pvc pvc-wffc\n# STATUS: Pending\n\n# Criar Pod que consume o PVC\ncat <<EOF | kubectl apply -f -\napiVersion: v1\nkind: Pod\nmetadata:\n  name: consumer-pod\nspec:\n  volumes:\n  - name: storage\n    persistentVolumeClaim:\n      claimName: pvc-wffc\n  containers:\n  - name: app\n    image: busybox:1.36\n    command: ["sleep", "3600"]\n    volumeMounts:\n    - name: storage\n      mountPath: /data\nEOF\n\n# PVC muda para Bound\nkubectl get pvc pvc-wffc -w\n\n# Limpar\nkubectl delete pod consumer-pod subpath-pod projected-pod multi-vol-pod\nkubectl delete pvc pvc-wffc\nkubectl delete configmap app-cfg\nkubectl delete secret app-secret\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Pod com erro "MountVolume.SetUp failed" ao tentar montar um volume',
      symptom: 'O Pod fica em estado ContainerCreating por muito tempo. "kubectl describe pod" mostra Events com "MountVolume.SetUp failed" ou "Unable to attach or mount volumes". O container nunca inicia.',
      diagnosis: '```bash\n# Ver o status do Pod\nkubectl get pod <nome> -o wide\n\n# Descrever o Pod para ver o erro exato\nkubectl describe pod <nome>\n# Procurar na secao Events:\n# "MountVolume.SetUp failed for volume"\n# "Unable to attach or mount volumes"\n# "hostPath type check failed"\n# "configmap not found"\n# "secret not found"\n\n# Para erros de hostPath - verificar se o path existe no node\nkubectl get pod <nome> -o jsonpath=\'{.spec.nodeName}\'\n\n# Para erros de ConfigMap ou Secret\nkubectl get configmap <nome-do-configmap> -n <namespace>\nkubectl get secret <nome-do-secret> -n <namespace>\n\n# Ver logs do kubelet no node (se tiver acesso)\njournalctl -u kubelet --since "5 minutes ago" | grep -i "mount\\|volume"\n```',
      solution: '```bash\n# Causa 1: hostPath - diretorio nao existe no node\n# Solucao A: Usar tipo DirectoryOrCreate\n# Editar o Pod e mudar hostPath.type para DirectoryOrCreate\n\n# Solucao B: Criar o diretorio manualmente no node\nkubectl debug node/<nome-node> -it --image=busybox \\\n  -- mkdir -p /caminho/no/node\n\n# Causa 2: ConfigMap ou Secret nao encontrado\n# Verificar namespace do Pod vs namespace do ConfigMap/Secret\nkubectl get pod <nome> -o jsonpath=\'{.metadata.namespace}\'\nkubectl get configmap -n <namespace>\n\n# Criar o recurso ausente\nkubectl create configmap <nome-ausente> \\\n  --from-literal=key=value \\\n  -n <namespace-do-pod>\n\n# Causa 3: PVC nao vinculado (para volumes do tipo PVC)\nkubectl get pvc -n <namespace>\n# Se STATUS for Pending, o PVC nao tem um PV disponivel\n\n# Verificar que o Pod passou a Running\nkubectl get pod <nome> -w\n```'
    },
    {
      title: 'Volume emptyDir causando eviction do Pod por uso excessivo de espaco',
      symptom: 'O Pod e terminado com motivo "The node was low on resource: ephemeral-storage" ou "Evicted". O Pod estava usando emptyDir e excedeu o espaco disponivel.',
      diagnosis: '```bash\n# Ver status do Pod evictado\nkubectl describe pod <nome>\n# Procurar: "The node was low on resource: ephemeral-storage"\n# Ou: "Pod ephemeral local storage usage exceeds"\n\n# Verificar ephemeral storage do node\nkubectl describe node <node-name> | grep -A5 "Allocated resources"\n\n# Verificar espaco em disco do node\nkubectl debug node/<node-name> -it --image=busybox -- df -h /\n\n# Ver uso de storage efemero por pod\nkubectl get pods -o jsonpath=\'{range .items[*]}{.metadata.name}{"\\t"}{.status.ephemeralContainerStatuses}{.status.containerStatuses[0].resources}{"\\n"}{end}\'\n```',
      solution: '```bash\n# Solucao 1: Definir sizeLimit no emptyDir\n# No spec do Pod:\n# volumes:\n# - name: temp-data\n#   emptyDir:\n#     sizeLimit: 500Mi\n\n# Solucao 2: Definir limites de ephemeral-storage no container\n# containers:\n# - name: app\n#   resources:\n#     limits:\n#       ephemeral-storage: 1Gi\n#     requests:\n#       ephemeral-storage: 500Mi\n\n# Solucao 3: Para cache, usar emptyDir com medium: Memory\n# (transfere pressao para memoria em vez de disco)\n# volumes:\n# - name: cache\n#   emptyDir:\n#     medium: Memory\n#     sizeLimit: 256Mi\n\n# Solucao 4: Usar PVC em vez de emptyDir para dados grandes\n# Migrar dados temporarios grandes para um PersistentVolumeClaim\n```'
    },
    {
      title: 'ConfigMap/Secret montado como volume nao atualiza automaticamente',
      symptom: 'Voce atualizou um ConfigMap ou Secret, mas os arquivos montados no Pod continuam com os valores antigos mesmo apos vários minutos.',
      diagnosis: '```bash\n# Verificar se o ConfigMap/Secret foi realmente atualizado\nkubectl get configmap <nome> -o yaml\nkubectl get secret <nome> -o jsonpath=\'{.data}\'\n\n# Verificar se o volume usa subPath\nkubectl get pod <nome> -o yaml | grep -A3 subPath\n\n# Verificar valor atual dentro do Pod\nkubectl exec <pod> -- cat /path/to/mounted/file\n\n# Verificar se o ConfigMap e immutable\nkubectl get configmap <nome> -o jsonpath=\'{.immutable}\'\n\n# Verificar cache TTL do kubelet (padrao ~60s)\n# O kubelet usa um cache interno para ConfigMaps/Secrets\n```',
      solution: '```bash\n# Causa 1: Volume montado com subPath\n# subPath NAO recebe atualizacoes automaticas\n# Solucao: remover subPath e montar o volume inteiro\n# Ou: reiniciar o Pod para forcar remount\nkubectl delete pod <pod-name>\n\n# Causa 2: ConfigMap marcado como immutable\n# ConfigMaps immutaveis nao podem ser alterados\n# Solucao: deletar e recriar o ConfigMap com novo nome\n# Atualizar o Pod para referenciar o novo nome\n\n# Causa 3: Cache do kubelet\n# Aguardar ate 2 minutos (propagation delay)\n# O kubelet sincroniza periodicamente\n# Pode ser acelerado reiniciando o kubelet (nao recomendado)\n\n# Causa 4: Aplicacao nao recarrega arquivos\n# Mesmo que o arquivo seja atualizado, a aplicacao precisa\n# reler o arquivo. Solucoes:\n# - Configurar hot-reload na aplicacao\n# - Usar inotifywait para detectar mudancas\n# - Reiniciar o Pod (ultima opcao)\nkubectl rollout restart deployment/<nome>\n```'
    }
  ]
};
