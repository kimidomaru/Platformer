window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['storage/pv-pvc'] = {
  theory: `# Persistent Volumes e Persistent Volume Claims

## Visao Geral

O Kubernetes separa o **provisionamento de armazenamento** (responsabilidade do administrador ou do sistema) do **consumo de armazenamento** (responsabilidade do desenvolvedor). Isso e feito atraves de dois recursos:

- **PersistentVolume (PV)**: representa um recurso de armazenamento fisico no cluster, provisionado pelo administrador ou dinamicamente pelo StorageClass
- **PersistentVolumeClaim (PVC)**: e uma requisicao de armazenamento feita por um usuario ou aplicacao, que age como uma "assinatura" reivindicando um PV

### Diagrama: Relacionamento PV, PVC e Pod

\`\`\`
┌──────────────────────────────────────────────────────────────────┐
│                PROVISIONAMENTO DE STORAGE                         │
│                                                                  │
│  ADMINISTRADOR                        DESENVOLVEDOR              │
│  (ou StorageClass)                    (ou aplicacao)             │
│                                                                  │
│  ┌────────────────────┐               ┌──────────────────┐       │
│  │  PersistentVolume  │               │ PersistentVolume │       │
│  │  (PV)              │◄──── Bind ───>│ Claim (PVC)      │       │
│  │                    │               │                  │       │
│  │  capacity: 10Gi    │  Criterios:   │  request: 5Gi    │       │
│  │  accessModes: RWO  │  - Tamanho    │  accessModes: RWO│       │
│  │  storageClass: ssd │  - AccessMode │  storageClass:ssd│       │
│  │  nfs/ebs/local/... │  - Class      │                  │       │
│  └────────────────────┘  - Labels     └────────┬─────────┘       │
│                                                │                 │
│                                        ┌───────▼─────────┐       │
│  ┌────────────────────┐               │  Pod             │       │
│  │  StorageClass      │               │  volumes:        │       │
│  │  (provisionamento  │               │  - pvc:          │       │
│  │   dinamico)        │──── cria ───>│    claimName: pvc│       │
│  │  provisioner: ...  │   PV auto    │  containers:     │       │
│  └────────────────────┘               │  - volumeMounts: │       │
│                                       │    mountPath: /d │       │
│                                       └──────────────────┘       │
└──────────────────────────────────────────────────────────────────┘
\`\`\`

O PV pode ser um disco rigido em um node do cluster, um dispositivo de armazenamento em rede (NAS), ou um servico de armazenamento em nuvem como AWS EBS ou Google Cloud Persistent Disk. Os dados armazenados no PV permanecem disponiveis mesmo quando o container e reiniciado ou movido para outro node.

### Volumes Efemeros vs Persistentes

E importante entender a distincao:

| Tipo | Comportamento | Exemplo |
|------|--------------|---------|
| **Efemero (emptyDir)** | Criado e destruido junto com o Pod | Cache temporario, dados compartilhados entre containers de um Pod |
| **Persistente (PV/PVC)** | Dados mantidos mesmo apos remocao do Pod | Banco de dados, arquivos de aplicacao |

---

## Ciclo de Vida de um PV

\`\`\`
Provisioning --> Binding --> Using --> Releasing --> Reclaiming
\`\`\`

| Fase | Descricao |
|------|-----------|
| **Provisioning** | PV e criado (estaticamente pelo admin ou dinamicamente pelo StorageClass) |
| **Binding** | PV e ligado a um PVC compativel (capacidade >= solicitada, access mode compativel, mesma storageClass) |
| **Using** | O Pod usa o volume atraves do PVC. O PV esta protegido contra delecao (finalizer: kubernetes.io/pv-protection) |
| **Releasing** | O PVC e deletado, o PV fica no estado Released. O campo claimRef ainda aponta para o PVC antigo |
| **Reclaiming** | O PV e tratado conforme a Reclaim Policy (Retain, Delete ou Recycle) |

### Status do PV

| Status | Significado |
|--------|-------------|
| **Available** | PV esta livre e disponivel para binding |
| **Bound** | PV esta vinculado a um PVC |
| **Released** | PVC foi deletado, mas o PV ainda nao foi reivindicado pelo cluster |
| **Failed** | Falha no processo de reclaim automatico |

---

## Access Modes

| Modo | Abreviacao | Descricao |
|------|-----------|-----------|
| ReadWriteOnce | **RWO** | Leitura e escrita por um unico node |
| ReadOnlyMany | **ROX** | Somente leitura por multiplos nodes |
| ReadWriteMany | **RWX** | Leitura e escrita por multiplos nodes |
| ReadWriteOncePod | **RWOP** | Leitura e escrita por um unico Pod (desde K8s 1.22) |

### Compatibilidade por tipo de armazenamento

| Tipo de Storage | RWO | ROX | RWX |
|----------------|-----|-----|-----|
| AWS EBS | Sim | Nao | Nao |
| GCE PD | Sim | Sim | Nao |
| Azure Disk | Sim | Nao | Nao |
| NFS | Sim | Sim | Sim |
| CephFS | Sim | Sim | Sim |
| hostPath | Sim | Nao | Nao |

**Importante:** Os access modes definem como o volume pode ser montado em **nodes**, nao em Pods. Um volume RWO pode ser montado em multiplos Pods no mesmo node.

---

## Reclaim Policies

| Politica | Comportamento apos deletar o PVC |
|----------|----------------------------------|
| **Retain** | O PV vai para o estado "Released". Dados preservados. Requer intervencao manual para reutilizar. E a politica mais segura |
| **Delete** | O PV e o volume de armazenamento subjacente sao deletados automaticamente. Padrao em provisionamento dinamico |
| **Recycle** | **Deprecated.** Executava rm -rf no volume e o deixava disponivel novamente. Nao use |

### Recuperando um PV com Retain

Quando um PVC e deletado e o PV tem ReclaimPolicy Retain:

\`\`\`bash
# PV fica em Released - nao pode receber novo PVC automaticamente
kubectl get pv meu-pv
# STATUS: Released, CLAIM: default/pvc-antigo

# Para reutilizar, remover o claimRef:
kubectl patch pv meu-pv --type=json \\
  -p '[{"op":"remove","path":"/spec/claimRef"}]'

# PV volta para Available
kubectl get pv meu-pv
# STATUS: Available
\`\`\`

---

## Tipos de Armazenamento para PVs

O Kubernetes suporta diversos backends de armazenamento:

| Tipo | Descricao | Uso recomendado |
|------|-----------|----------------|
| **hostPath** | Diretorio no node do cluster | Testes e desenvolvimento (dados so disponiveis no node especifico) |
| **local** | Volume local nativo do Kubernetes | Similar ao hostPath mas com suporte a node affinity |
| **nfs** | Sistema de arquivos de rede | Armazenamento compartilhado entre nodes |
| **iscsi** | Conexao de blocos via rede IP (SAN) | Storage enterprise |
| **csi** | Container Storage Interface - plugins de terceiros | AWS EBS, GCE PD, Azure Disk, etc. |
| **cephfs** | Sistema de arquivos distribuido Ceph | Alta disponibilidade e escalabilidade |
| **fc** | Fibre Channel para redes de fibra optica | Datacenters com SAN de fibra |

**Diferenca hostPath vs local:** O \`local\` e um recurso nativo do Kubernetes com suporte a node affinity, enquanto o \`hostPath\` nao e recomendado em clusters multi-node.

---

## Provisionamento Estatico

O administrador cria PVs manualmente antes dos PVCs.

### PV com hostPath (testes)

\`\`\`yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-dados
  labels:
    storage: local
spec:
  capacity:
    storage: 10Gi
  volumeMode: Filesystem
  accessModes:
  - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  storageClassName: manual
  hostPath:
    path: /mnt/dados
\`\`\`

### PV com NFS (producao)

\`\`\`yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-nfs
  labels:
    storage: nfs
spec:
  capacity:
    storage: 10Gi
  accessModes:
  - ReadWriteMany        # NFS suporta RWX
  persistentVolumeReclaimPolicy: Retain
  nfs:
    server: 192.168.1.100  # IP do servidor NFS
    path: "/mnt/nfs"       # Compartilhamento NFS
  storageClassName: nfs
\`\`\`

**Nota:** O Kubernetes nao possui um provisionador NFS nativo. Para provisionamento dinamico com NFS, e necessario um provisionador externo como nfs-subdir-external-provisioner.

---

## PersistentVolumeClaim

O PVC define o que a aplicacao precisa de armazenamento. O Kubernetes tenta associar automaticamente o PVC a um PV compativel.

### Criterios de Binding (PVC → PV)

Para o binding ocorrer, o PV deve atender TODOS os criterios:
1. **Capacidade** >= ao solicitado pelo PVC
2. **Access Mode** compativel
3. **StorageClassName** igual (ou ambos sem class)
4. **Selector** de labels (se especificado no PVC)
5. **volumeMode** igual (Filesystem ou Block)

\`\`\`yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: pvc-app
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
  storageClassName: manual
  selector:               # Opcional: selecionar PV por labels
    matchLabels:
      storage: local
\`\`\`

\`\`\`bash
# Verificar status do PVC (deve ser Bound)
kubectl get pvc pvc-app

# Ver detalhes do binding
kubectl describe pvc pvc-app
\`\`\`

### storageClassName: "" vs omitido

| Configuracao | Comportamento |
|-------------|--------------|
| **Omitido** | PVC usa o StorageClass **padrao** do cluster (provisionamento dinamico) |
| **storageClassName: ""** | Desabilita provisionamento dinamico. Busca apenas PVs estaticos sem StorageClass |
| **storageClassName: "nome"** | Usa o StorageClass especificado |

---

## Usando PVC em um Pod

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-com-storage
spec:
  volumes:
  - name: meu-storage
    persistentVolumeClaim:
      claimName: pvc-app
  containers:
  - name: app
    image: nginx:1.25
    volumeMounts:
    - name: meu-storage
      mountPath: /usr/share/nginx/html
\`\`\`

**Campos importantes:**
- \`spec.volumes[].persistentVolumeClaim.claimName\`: nome do PVC que o Pod vai usar
- \`spec.containers[].volumeMounts[].mountPath\`: diretorio onde o volume sera montado no container
- \`spec.containers[].volumeMounts[].subPath\`: monta apenas um subdiretorio do volume (opcional)
- \`spec.containers[].volumeMounts[].readOnly\`: monta como somente leitura (opcional, padrao: false)

---

## StorageClass

Uma StorageClass descreve diferentes classes de armazenamento disponiveis no cluster. Ela define o **provisioner** que cria PVs automaticamente.

### Campos da StorageClass

| Campo | Descricao |
|-------|-----------|
| **provisioner** | Plugin responsavel por criar PVs (ex: kubernetes.io/aws-ebs, rancher.io/local-path) |
| **reclaimPolicy** | Politica padrao para PVs criados (Retain ou Delete) |
| **volumeBindingMode** | Immediate (bind imediato) ou WaitForFirstConsumer (aguarda Pod ser agendado) |
| **allowVolumeExpansion** | Permite expandir PVCs apos criacao |
| **parameters** | Parametros especificos do provisioner (tipo de disco, IOPS, etc.) |
| **mountOptions** | Opcoes de montagem para os volumes |

### Provisioners por ambiente

| Provisioner | Ambiente |
|-------------|----------|
| kubernetes.io/aws-ebs | AWS EBS |
| kubernetes.io/azure-disk | Azure Disk |
| kubernetes.io/gce-pd | Google Compute Engine |
| kubernetes.io/no-provisioner | Volumes locais (sem provisionamento automatico) |
| rancher.io/local-path | Kind (padrao) |
| kubernetes.io/host-path | Minikube (padrao) |

### Criando uma StorageClass

\`\`\`yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: standard
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"
provisioner: rancher.io/local-path
reclaimPolicy: Delete
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
\`\`\`

### volumeBindingMode explicado

| Modo | Comportamento |
|------|--------------|
| **Immediate** | PV e criado e vinculado ao PVC imediatamente apos a criacao do PVC |
| **WaitForFirstConsumer** | PV so e criado e vinculado quando um Pod que usa o PVC e agendado em um node. Garante que o volume seja criado no node correto |

\`\`\`bash
# Listar StorageClasses
kubectl get storageclass

# Ver detalhes
kubectl describe storageclass standard

# Exemplo de saida:
# NAME            PROVISIONER             RECLAIMPOLICY   VOLUMEBINDINGMODE      ALLOWVOLUMEEXPANSION
# standard (default)   rancher.io/local-path   Delete          WaitForFirstConsumer   false
\`\`\`

### PVC com provisionamento dinamico

\`\`\`yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: pvc-dinamico
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 20Gi
  storageClassName: standard
\`\`\`

O PV e criado automaticamente pelo provisioner ao criar o PVC (ou ao agendar o Pod, se volumeBindingMode for WaitForFirstConsumer).

---

## Volume Mode: Filesystem vs Block

| Modo | Descricao |
|------|-----------|
| **Filesystem** (padrao) | Volume montado como diretorio no container. O mais comum |
| **Block** | Volume exposto como dispositivo de bloco bruto (/dev/xvda). Usado para aplicacoes que gerenciam o filesystem diretamente |

\`\`\`yaml
spec:
  volumeMode: Block  # ou Filesystem (padrao)
\`\`\`

---

## Protecao contra Delecao

O Kubernetes protege PVs e PVCs em uso contra delecao acidental:

- **PV Protection**: Finalizer \`kubernetes.io/pv-protection\` impede delecao de PV enquanto esta Bound
- **PVC Protection**: Finalizer \`kubernetes.io/pvc-protection\` impede delecao de PVC enquanto um Pod esta usando

\`\`\`bash
# Tentar deletar PVC em uso -> fica em status Terminating
kubectl delete pvc pvc-app
kubectl get pvc pvc-app
# STATUS: Terminating (sera deletado quando o Pod parar de usar)
\`\`\`

---

## Expansao de Volume

Para expandir um PVC, o StorageClass deve ter \`allowVolumeExpansion: true\`.

\`\`\`bash
# Editar o PVC para aumentar o storage
kubectl edit pvc pvc-app
# Alterar spec.resources.requests.storage para o novo tamanho

# Ou via patch
kubectl patch pvc pvc-app -p '{"spec":{"resources":{"requests":{"storage":"20Gi"}}}}'

# Verificar o status da expansao
kubectl describe pvc pvc-app
# Conditions:
#   Type: FileSystemResizePending -> Resizing -> Done
\`\`\`

**Importante:**
- **Reducao de volume NAO e suportada** — so e possivel aumentar o tamanho
- Alguns drivers requerem que o Pod seja reiniciado para a expansao do filesystem
- Volumes em uso podem ser expandidos online (depende do driver CSI)

---

## Comandos Essenciais

\`\`\`bash
# === PersistentVolumes ===
kubectl get pv                              # Listar PVs
kubectl get pv -o wide                      # Com detalhes extras
kubectl describe pv <nome>                  # Detalhes completos
kubectl get pv -o custom-columns="NAME:.metadata.name,CAPACITY:.spec.capacity.storage,ACCESS:.spec.accessModes[0],STATUS:.status.phase,CLAIM:.spec.claimRef.name,STORAGECLASS:.spec.storageClassName"

# === PersistentVolumeClaims ===
kubectl get pvc                             # Listar PVCs no namespace atual
kubectl get pvc --all-namespaces            # Listar em todos os namespaces
kubectl describe pvc <nome>                 # Detalhes com eventos

# === StorageClasses ===
kubectl get storageclass                    # Listar StorageClasses
kubectl describe storageclass <nome>        # Detalhes do provisioner

# === Debug e verificacao ===
kubectl get events --sort-by=.lastTimestamp  # Eventos recentes
kubectl get pv,pvc                          # Listar PVs e PVCs juntos
\`\`\`
`,

  quiz: [
    {
      question: 'O que acontece com um PersistentVolume quando a ReclaimPolicy e "Retain" e o PVC associado e deletado?',
      options: [
        'O PV e deletado automaticamente junto com os dados',
        'O PV vai para o estado Released, os dados sao preservados e o PV precisa de intervencao manual para ser reutilizado',
        'O PV e automaticamente re-disponibilizado para novos PVCs',
        'O PV fica no estado Pending ate um novo PVC ser criado'
      ],
      correct: 1,
      explanation: 'Com ReclaimPolicy "Retain", ao deletar o PVC, o PV passa para o estado "Released". Os dados sao preservados, mas o PV nao pode ser reutilizado automaticamente. O admin deve remover o campo spec.claimRef do PV (via kubectl patch) para que ele volte ao estado "Available".'
    },
    {
      question: 'Qual Access Mode permite que multiplos nodes leiam E escrevam no mesmo volume simultaneamente?',
      options: [
        'ReadWriteOnce (RWO)',
        'ReadOnlyMany (ROX)',
        'ReadWriteMany (RWX)',
        'ReadWriteOncePod (RWOP)'
      ],
      correct: 2,
      explanation: 'ReadWriteMany (RWX) permite que multiplos nodes montem o volume para leitura e escrita. E suportado por sistemas de arquivos compartilhados como NFS e CephFS. Discos de bloco como EBS e GCE PD suportam apenas RWO. RWOP (desde K8s 1.22) restringe a um unico Pod.'
    },
    {
      question: 'Um PVC foi criado com storageClassName: "" (string vazia). O que isso significa?',
      options: [
        'O PVC usara o StorageClass padrao do cluster',
        'O PVC buscara apenas PVs sem StorageClass (provisionamento estatico sem class)',
        'O PVC ficara em Pending indefinidamente',
        'O PVC usara qualquer StorageClass disponivel'
      ],
      correct: 1,
      explanation: 'storageClassName: "" desabilita o provisionamento dinamico e forca o PVC a buscar apenas PVs estaticos sem StorageClass. Diferente de OMITIR o campo (usa o StorageClass padrao) e de especificar um nome (usa aquele StorageClass especifico).'
    },
    {
      question: 'O que e necessario para que um PVC seja vinculado (Bound) a um PV em provisionamento estatico?',
      options: [
        'O PV deve ter exatamente a mesma capacidade que o PVC solicitou',
        'O PV deve ter capacidade >= ao PVC, Access Mode compativel, StorageClass igual e volumeMode igual',
        'O PV deve estar no mesmo namespace que o PVC',
        'O administrador deve executar um comando de bind manualmente'
      ],
      correct: 1,
      explanation: 'Para o binding: (1) capacidade >= solicitada, (2) Access Mode compativel, (3) mesmo storageClassName, (4) mesmo volumeMode, (5) selector de labels (se especificado). PVs sao recursos de cluster (sem namespace), PVCs sao namespaced. O binding e automatico.'
    },
    {
      question: 'Qual e a diferenca entre provisionamento estatico e dinamico de PersistentVolumes?',
      options: [
        'Estatico usa discos locais, dinamico usa discos em nuvem',
        'No estatico o admin cria PVs manualmente antes do PVC. No dinamico o StorageClass cria o PV automaticamente quando o PVC e criado',
        'Estatico e mais rapido, dinamico e mais seguro',
        'Nao ha diferenca funcional, apenas de nomenclatura'
      ],
      correct: 1,
      explanation: 'Provisionamento estatico: admin cria PVs antecipadamente; PVCs buscam PV existente compativel. Provisionamento dinamico: ao criar PVC com storageClassName valido, o provisioner cria PV automaticamente. Ambos podem usar qualquer tipo de storage (local ou nuvem).'
    },
    {
      question: 'Para expandir um PVC em uso, qual configuracao deve estar habilitada no StorageClass?',
      options: [
        'allowVolumeExpansion: true',
        'enableExpansion: true',
        'volumeExpansionMode: dynamic',
        'resizable: enabled'
      ],
      correct: 0,
      explanation: '"allowVolumeExpansion: true" no StorageClass habilita expansao. Basta editar o PVC aumentando spec.resources.requests.storage. O status vai de FileSystemResizePending -> Resizing -> concluido. Reducao de volume NAO e suportada.'
    },
    {
      question: 'Qual o status de um PV que foi criado mas ainda nao foi vinculado a nenhum PVC?',
      options: [
        'Pending',
        'Unbound',
        'Available',
        'Free'
      ],
      correct: 2,
      explanation: 'Um PV nao vinculado fica em status "Available". Os status possiveis sao: Available (livre), Bound (vinculado a PVC), Released (PVC deletado, aguarda reclaim) e Failed (falha no reclaim automatico).'
    },
    {
      question: 'Qual campo de volumeBindingMode faz o PV ser criado apenas quando um Pod que usa o PVC e agendado?',
      options: [
        'Immediate',
        'WaitForFirstConsumer',
        'Lazy',
        'OnDemand'
      ],
      correct: 1,
      explanation: 'WaitForFirstConsumer atrasa o binding do PV ate que um Pod que use o PVC seja agendado em um node. Isso garante que o volume seja criado no node correto (importante para volumes locais). Immediate cria o binding imediatamente ao criar o PVC.'
    },
    {
      question: 'O que acontece se voce tentar deletar um PVC que esta sendo usado por um Pod?',
      options: [
        'O PVC e deletado imediatamente e o Pod falha',
        'O PVC fica em status Terminating ate o Pod parar de usa-lo',
        'O comando e rejeitado com erro "pvc in use"',
        'O Pod e automaticamente terminado para liberar o PVC'
      ],
      correct: 1,
      explanation: 'O Kubernetes tem protecao contra delecao de PVCs em uso (finalizer: kubernetes.io/pvc-protection). O PVC vai para status Terminating, mas so e efetivamente removido quando nenhum Pod o esta usando. O Pod continua funcionando normalmente.'
    },
    {
      question: 'Em um PV do tipo NFS, qual campo especifica o endereco do servidor NFS?',
      options: [
        'spec.nfs.address',
        'spec.nfs.server',
        'spec.nfs.host',
        'spec.nfs.endpoint'
      ],
      correct: 1,
      explanation: 'O campo spec.nfs.server recebe o IP ou hostname do servidor NFS. O campo spec.nfs.path especifica o diretorio compartilhado. NFS suporta RWX, sendo ideal para volumes compartilhados entre multiplos nodes.'
    }
  ],

  flashcards: [
    {
      front: 'Quais sao as fases do ciclo de vida de um PersistentVolume?',
      back: '1. Provisioning: PV e criado (manual pelo admin ou dinamico pelo StorageClass)\n2. Binding: PV vinculado a um PVC compativel (status: Bound)\n3. Using: Pod usa o volume via PVC. Protegido por finalizer pv-protection\n4. Releasing: PVC deletado, PV vai para Released. claimRef ainda existe\n5. Reclaiming: PV tratado conforme ReclaimPolicy (Retain/Delete/Recycle-deprecated)'
    },
    {
      front: 'Quais sao os Access Modes e o que cada um significa?',
      back: 'RWO (ReadWriteOnce): leitura/escrita por UM node\nROX (ReadOnlyMany): somente leitura por MULTIPLOS nodes\nRWX (ReadWriteMany): leitura/escrita por MULTIPLOS nodes\nRWOP (ReadWriteOncePod): leitura/escrita por UM Pod (K8s 1.22+)\n\nImportante: Access Modes controlam acesso por NODE, nao por Pod. Um volume RWO pode ser montado em multiplos Pods no MESMO node.\n\nSuporte: discos de bloco (EBS, GCE PD) = RWO. NFS/CephFS = RWX.'
    },
    {
      front: 'Quais sao as Reclaim Policies e o que cada uma faz?',
      back: 'Retain: PV vai para Released. Dados preservados. Admin deve remover claimRef para reutilizar. Mais seguro para producao.\n\nDelete: PV e storage subjacente sao deletados automaticamente. Padrao em provisionamento dinamico.\n\nRecycle: DEPRECATED desde K8s 1.28. Executava rm -rf no volume. NAO USE — use provisionamento dinamico com Delete.'
    },
    {
      front: 'Como verificar o binding entre PV e PVC?',
      back: 'kubectl get pv\n# Coluna CLAIM: nome do PVC, STATUS: Bound\n\nkubectl get pvc\n# Coluna VOLUME: nome do PV, STATUS: Bound\n\nkubectl describe pvc <nome>\n# Campo "Volume:" mostra o PV vinculado\n\nComando detalhado:\nkubectl get pv -o custom-columns="NAME:.metadata.name,CLAIM:.spec.claimRef.name,STATUS:.status.phase"'
    },
    {
      front: 'O que diferencia omitir storageClassName de definir como "" (string vazia) em um PVC?',
      back: 'Omitido: PVC usa o StorageClass PADRAO do cluster (provisionamento dinamico).\n\nstorageClassName: "": desabilita provisionamento dinamico; busca apenas PVs estaticos sem StorageClass.\n\nstorageClassName: "nome": usa o StorageClass especificado.\n\nDica CKA: Se o PVC fica Pending, verificar se o storageClassName esta correto e se existe.'
    },
    {
      front: 'Como recuperar um PV com ReclaimPolicy Retain apos o PVC ser deletado?',
      back: '1. PVC deletado -> PV vai para status Released\n2. Dados no volume estao preservados\n3. Remover claimRef:\n   kubectl patch pv <nome> --type=json \\\n     -p \'[{"op":"remove","path":"/spec/claimRef"}]\'\n4. PV volta para status Available\n5. Novo PVC pode ser vinculado\n\nOpcional: limpar dados antes de reutilizar.'
    },
    {
      front: 'Qual a diferenca entre hostPath e local para PVs?',
      back: 'hostPath: recurso simples que monta diretorio do node. Dados so no node especifico. NAO recomendado para multi-node. Sem node affinity.\n\nlocal: recurso nativo K8s com suporte a node affinity. Garante que o Pod seja agendado no node correto. Melhor para producao com dados locais.\n\nAmbos NAO sao replicados — dados perdidos se o node falhar.'
    },
    {
      front: 'O que e volumeBindingMode: WaitForFirstConsumer?',
      back: 'O PV so e criado/vinculado ao PVC quando um Pod que o usa e agendado em um node.\n\nBeneficios:\n- Garante que o volume seja criado no node correto\n- Evita binding em node diferente do Pod\n- Essencial para volumes locais e node-specific\n\nAlternativa: Immediate — binding acontece ao criar o PVC.'
    },
    {
      front: 'Quais campos do StorageClass sao mais importantes para o CKA?',
      back: 'provisioner: plugin que cria PVs (kubernetes.io/aws-ebs, rancher.io/local-path)\nreclaimPolicy: Retain ou Delete (padrao para PVs criados)\nvolumeBindingMode: Immediate ou WaitForFirstConsumer\nallowVolumeExpansion: true/false\nparameters: especificos do provisioner (tipo de disco, IOPS)\n\nAnotacao para default class:\nstorageclass.kubernetes.io/is-default-class: "true"'
    },
    {
      front: 'Como funciona a protecao contra delecao de PVCs em uso?',
      back: 'Finalizer: kubernetes.io/pvc-protection\n\nSe tentar deletar PVC em uso por Pod:\n1. PVC vai para status Terminating\n2. Dados continuam acessiveis pelo Pod\n3. PVC so e removido quando Pod para de usa-lo\n\nMesmo mecanismo para PVs (kubernetes.io/pv-protection).'
    },
    {
      front: 'Quais tipos de armazenamento NFS suporta e como configurar o PV?',
      back: 'NFS suporta RWO, ROX e RWX.\n\nPV NFS:\nspec:\n  nfs:\n    server: 192.168.1.100  # IP do servidor\n    path: "/mnt/nfs"       # compartilhamento\n\nK8s nao tem provisionador NFS nativo. Para provisionamento dinamico, use nfs-subdir-external-provisioner.\n\nServidor NFS: instalar nfs-kernel-server, configurar /etc/exports.'
    }
  ],

  lab: {
    scenario: 'Uma aplicacao de banco de dados precisa de armazenamento persistente para sobreviver ao reinicio de Pods. Voce deve criar um PV estatico, um PVC, montar em um Pod, gravar dados e verificar que os dados persistem apos reiniciar o Pod.',
    objective: 'Criar PV e PVC com provisionamento estatico, montar em um Pod e verificar persistencia de dados apos reinicio do Pod',
    steps: [
      {
        title: 'Criar PersistentVolume estatico',
        instruction: 'Crie um PersistentVolume chamado `pv-local` do tipo hostPath com capacidade de 1Gi, AccessMode ReadWriteOnce, ReclaimPolicy Retain e StorageClass "manual". O path do hostPath deve ser "/mnt/lab-data".',
        hints: [
          'Use apiVersion: v1 e kind: PersistentVolume',
          'spec.hostPath.path deve ser /mnt/lab-data',
          'Verifique o status com kubectl get pv - deve ser Available'
        ],
        solution: '```bash\ncat <<EOF | kubectl apply -f -\napiVersion: v1\nkind: PersistentVolume\nmetadata:\n  name: pv-local\spec:\n  capacity:\n    storage: 1Gi\n  volumeMode: Filesystem\n  accessModes:\n  - ReadWriteOnce\n  persistentVolumeReclaimPolicy: Retain\n  storageClassName: manual\n  hostPath:\n    path: /mnt/lab-data\nEOF\n\n# Verificar status do PV\nkubectl get pv pv-local\n# STATUS deve ser: Available\n```'
      },
      {
        title: 'Criar PVC e verificar o Binding',
        instruction: 'Crie um PersistentVolumeClaim chamado `pvc-app` solicitando 500Mi de armazenamento com AccessMode ReadWriteOnce e StorageClass "manual". Verifique que o PVC foi vinculado ao PV criado anteriormente.',
        hints: [
          'O PVC solicita 500Mi mas o PV tem 1Gi - o binding ocorre pois 1Gi >= 500Mi',
          'kubectl get pvc deve mostrar STATUS: Bound',
          'kubectl describe pvc pvc-app mostra o PV vinculado no campo Volume'
        ],
        solution: '```bash\ncat <<EOF | kubectl apply -f -\napiVersion: v1\nkind: PersistentVolumeClaim\nmetadata:\n  name: pvc-app\nspec:\n  accessModes:\n  - ReadWriteOnce\n  resources:\n    requests:\n      storage: 500Mi\n  storageClassName: manual\nEOF\n\n# Verificar binding\nkubectl get pvc pvc-app\n# STATUS deve ser: Bound\n\nkubectl get pv pv-local\n# STATUS deve ser: Bound, CLAIM deve mostrar default/pvc-app\n\nkubectl describe pvc pvc-app\n# Ver campo Volume: pv-local\n```'
      },
      {
        title: 'Usar PVC em Pod e verificar persistencia',
        instruction: 'Crie um Pod chamado `writer-pod` usando busybox:1.36 que monte o PVC em "/data" e escreva um arquivo com conteudo reconhecivel. Apos o Pod concluir, delete-o e crie um novo Pod chamado `reader-pod` que leia o mesmo arquivo para confirmar a persistencia.',
        hints: [
          'O primeiro Pod pode usar command: ["sh", "-c", "echo dados-persistidos > /data/test.txt && sleep 5"]',
          'Aguarde o primeiro Pod completar antes de criar o segundo',
          'O segundo Pod pode usar command: ["sh", "-c", "cat /data/test.txt"]'
        ],
        solution: '```bash\n# Pod que escreve dados\ncat <<EOF | kubectl apply -f -\napiVersion: v1\nkind: Pod\nmetadata:\n  name: writer-pod\nspec:\n  restartPolicy: Never\n  volumes:\n  - name: storage\n    persistentVolumeClaim:\n      claimName: pvc-app\n  containers:\n  - name: writer\n    image: busybox:1.36\n    command: ["sh", "-c", "echo dados-persistidos-$(date) > /data/test.txt && cat /data/test.txt && echo Escrita concluida"]\n    volumeMounts:\n    - name: storage\n      mountPath: /data\nEOF\n\n# Aguardar o Pod completar\nkubectl wait pod writer-pod --for=condition=Succeeded --timeout=60s\n\n# Ver os logs do writer\nkubectl logs writer-pod\n\n# Deletar o Pod\nkubectl delete pod writer-pod\n\n# Pod que le os dados persistidos\ncat <<EOF | kubectl apply -f -\napiVersion: v1\nkind: Pod\nmetadata:\n  name: reader-pod\nspec:\n  restartPolicy: Never\n  volumes:\n  - name: storage\n    persistentVolumeClaim:\n      claimName: pvc-app\n  containers:\n  - name: reader\n    image: busybox:1.36\n    command: ["sh", "-c", "cat /data/test.txt"]\n    volumeMounts:\n    - name: storage\n      mountPath: /data\nEOF\n\nkubectl wait pod reader-pod --for=condition=Succeeded --timeout=60s\nkubectl logs reader-pod\n# Deve mostrar o mesmo conteudo gravado pelo writer-pod\n```'
      },
      {
        title: 'Testar provisionamento dinamico com StorageClass',
        instruction: 'Crie um PVC chamado `pvc-dinamico` com 500Mi usando o StorageClass padrao do cluster (nao especifique storageClassName). Crie um Pod chamado `dynamic-pod` usando nginx que monte o PVC em `/usr/share/nginx/html`. Verifique que o PV foi criado automaticamente.',
        hints: [
          'Omita o campo storageClassName no PVC para usar o default',
          'kubectl get pv mostra PVs criados automaticamente',
          'kubectl get storageclass mostra qual e o StorageClass padrao (marcado com default)'
        ],
        solution: '```bash\n# Verificar StorageClass padrao\nkubectl get storageclass\n\n# Criar PVC sem especificar storageClassName (usa o padrao)\ncat <<EOF | kubectl apply -f -\napiVersion: v1\nkind: PersistentVolumeClaim\nmetadata:\n  name: pvc-dinamico\nspec:\n  accessModes:\n  - ReadWriteOnce\n  resources:\n    requests:\n      storage: 500Mi\nEOF\n\n# Criar Pod que usa o PVC\ncat <<EOF | kubectl apply -f -\napiVersion: v1\nkind: Pod\nmetadata:\n  name: dynamic-pod\nspec:\n  volumes:\n  - name: data\n    persistentVolumeClaim:\n      claimName: pvc-dinamico\n  containers:\n  - name: nginx\n    image: nginx:1.25\n    volumeMounts:\n    - name: data\n      mountPath: /usr/share/nginx/html\nEOF\n\n# Verificar que PV foi criado automaticamente\nkubectl get pv\nkubectl get pvc pvc-dinamico\n# STATUS: Bound\n```'
      },
      {
        title: 'Testar Reclaim Policy Retain e recuperar PV',
        instruction: 'Delete o PVC `pvc-app` e observe que o PV `pv-local` vai para status Released. Recupere o PV removendo o claimRef para que volte a Available. Crie um novo PVC e confirme o re-binding.',
        hints: [
          'kubectl delete pvc pvc-app para liberar o binding',
          'kubectl get pv para ver o status Released',
          'kubectl patch pv pv-local --type=json para remover claimRef'
        ],
        solution: '```bash\n# Deletar o PVC\nkubectl delete pod reader-pod 2>/dev/null\nkubectl delete pvc pvc-app\n\n# Verificar que PV ficou Released\nkubectl get pv pv-local\n# STATUS: Released, CLAIM: default/pvc-app\n\n# Recuperar o PV removendo claimRef\nkubectl patch pv pv-local --type=json \\\n  -p \'[{"op":"remove","path":"/spec/claimRef"}]\'\n\n# Verificar que PV voltou para Available\nkubectl get pv pv-local\n# STATUS: Available\n\n# Criar novo PVC para testar re-binding\ncat <<EOF | kubectl apply -f -\napiVersion: v1\nkind: PersistentVolumeClaim\nmetadata:\n  name: pvc-app-v2\nspec:\n  accessModes:\n  - ReadWriteOnce\n  resources:\n    requests:\n      storage: 500Mi\n  storageClassName: manual\nEOF\n\nkubectl get pvc pvc-app-v2\n# STATUS: Bound, VOLUME: pv-local\n\n# Limpar todos os recursos\nkubectl delete pvc pvc-app-v2 pvc-dinamico 2>/dev/null\nkubectl delete pod dynamic-pod 2>/dev/null\nkubectl delete pv pv-local 2>/dev/null\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'PVC preso em estado Pending sem ser vinculado a um PV',
      symptom: 'Um PVC foi criado mas permanece em estado "Pending" por varios minutos. Pods que dependem desse PVC tambem ficam em Pending com mensagem "waiting for a volume to be created". Nenhum PV e vinculado ao PVC.',
      diagnosis: '```bash\n# 1. Verificar o status do PVC\nkubectl get pvc <nome-do-pvc>\n# STATUS: Pending\n\n# 2. Descrever o PVC para ver o motivo\nkubectl describe pvc <nome-do-pvc>\n# Possiveis mensagens de evento:\n# "no persistent volumes available for this claim and no storage class is set"\n# "storageclass.storage.k8s.io <nome> not found"\n# "no volume plugin matched"\n# "waiting for first consumer to be created before binding"\n\n# 3. Verificar PVs disponiveis\nkubectl get pv\n# Ver se ha PVs com STATUS: Available e specs compativeis\n\n# 4. Comparar specs do PVC com PVs existentes\nkubectl get pvc <nome> -o jsonpath=\'{.spec.storageClassName}\'\nkubectl get pvc <nome> -o jsonpath=\'{.spec.accessModes}\'\nkubectl get pvc <nome> -o jsonpath=\'{.spec.resources.requests.storage}\'\n\n# 5. Verificar StorageClasses\nkubectl get storageclass\n\n# 6. Ver eventos do namespace\nkubectl get events --sort-by=.lastTimestamp\n```',
      solution: '```bash\n# Causa 1: Sem PV disponivel e sem StorageClass para provisionamento dinamico\n# Criar um PV compativel manualmente:\ncat <<EOF | kubectl apply -f -\napiVersion: v1\nkind: PersistentVolume\nmetadata:\n  name: pv-manual\nspec:\n  capacity:\n    storage: 5Gi\n  accessModes:\n  - ReadWriteOnce\n  persistentVolumeReclaimPolicy: Delete\n  storageClassName: <mesmo-storageClassName-do-PVC>\n  hostPath:\n    path: /mnt/fix-storage\nEOF\n\n# Causa 2: StorageClass nao existe\nkubectl get pvc <nome> -o jsonpath=\'{.spec.storageClassName}\'\nkubectl get storageclass\n# Corrigir: deletar PVC e recriar com storageClassName correto\n\n# Causa 3: Access Mode incompativel (PVC pede RWX, PV oferece RWO)\n# Criar PV com accessMode correto ou ajustar PVC\n\n# Causa 4: WaitForFirstConsumer - PVC espera um Pod ser agendado\n# Isso e normal! Crie o Pod que usa o PVC e ele sera vinculado\n\n# Causa 5: Capacidade insuficiente\n# PVC pede 100Gi mas PV disponivel tem apenas 10Gi\n# Criar PV com capacidade adequada\n\n# Verificar binding\nkubectl get pvc <nome-do-pvc>\n# STATUS deve mudar para Bound\n```'
    },
    {
      title: 'PV em estado Released nao pode ser reutilizado por novo PVC',
      symptom: 'Um PV com ReclaimPolicy Retain ficou em status Released apos o PVC original ser deletado. Novos PVCs nao conseguem se vincular a este PV, mesmo com specs compativeis. O PV continua mostrando a referencia ao PVC antigo.',
      diagnosis: '```bash\n# 1. Verificar o status do PV\nkubectl get pv <nome-do-pv>\n# STATUS: Released, CLAIM: default/pvc-antigo\n\n# 2. Ver o claimRef que impede o re-binding\nkubectl get pv <nome-do-pv> -o jsonpath=\'{.spec.claimRef}\'\n# Mostra: {"apiVersion":"v1","kind":"PersistentVolumeClaim",\n#   "name":"pvc-antigo","namespace":"default","uid":"..."}\n\n# 3. Verificar os dados no volume\nkubectl describe pv <nome-do-pv>\n# Ver Source: HostPath, NFS, etc.\n```',
      solution: '```bash\n# Remover o claimRef para liberar o PV\nkubectl patch pv <nome-do-pv> --type=json \\\n  -p \'[{"op":"remove","path":"/spec/claimRef"}]\'\n\n# Verificar que o PV voltou para Available\nkubectl get pv <nome-do-pv>\n# STATUS deve ser: Available\n\n# Agora um novo PVC pode se vincular ao PV\n# ATENCAO: os dados antigos ainda estao no volume!\n# Limpe os dados se necessario antes de reutilizar\n```'
    },
    {
      title: 'Pod nao inicia por erro de montagem de volume PVC',
      symptom: 'Pod fica em status ContainerCreating por muito tempo, ou em estado Warning com mensagem "Unable to attach or mount volumes". O Pod nao consegue montar o PVC mesmo com o PVC em status Bound.',
      diagnosis: '```bash\n# 1. Verificar o status do Pod\nkubectl get pod <nome-pod>\nkubectl describe pod <nome-pod>\n# Procurar em Events por:\n# "Unable to attach or mount volumes: timed out"\n# "FailedMount"\n# "MountVolume.SetUp failed"\n\n# 2. Verificar se o PVC esta Bound\nkubectl get pvc <nome-pvc>\n\n# 3. Verificar o PV vinculado\nkubectl describe pv <nome-pv>\n\n# 4. Verificar se o volume esta montado em outro node (RWO)\nkubectl get pod -o wide  # ver qual node\nkubectl get pv <nome-pv> -o jsonpath=\'{.spec.nodeAffinity}\'\n\n# 5. Ver eventos do node\nkubectl get events --field-selector involvedObject.kind=Node\n```',
      solution: '```bash\n# Causa 1: Volume RWO montado em node diferente\n# Mover o Pod para o node correto ou remover o Pod antigo\nkubectl delete pod <pod-no-outro-node>\n\n# Causa 2: hostPath nao existe no node\n# Criar o diretorio no node:\nssh <node> "sudo mkdir -p /mnt/dados"\n\n# Causa 3: Permissoes do diretorio\nssh <node> "sudo chmod 777 /mnt/dados"\n\n# Causa 4: NFS server inacessivel\n# Verificar conectividade ao server NFS\nssh <node> "showmount -e <nfs-server-ip>"\n\n# Causa 5: CSI driver nao instalado\nkubectl get csidrivers\n# Instalar o driver CSI necessario\n```'
    }
  ]
};
