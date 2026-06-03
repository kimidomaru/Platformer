window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['cluster-architecture/etcd'] = {
  theory: `# ETCD - Backup, Restauracao e Administracao

## O que e o etcd?

O **etcd** e o banco de dados chave-valor distribuido usado pelo Kubernetes para armazenar todo o estado do cluster. Todos os objetos do Kubernetes (pods, services, deployments, secrets, configmaps, etc.) sao persistidos no etcd.

Por ser o "cerebro" do cluster, o backup do etcd e **critico para recuperacao de desastres**.

---

## Arquitetura Interna do etcd

### Modelo Chave-Valor

O etcd armazena dados em um modelo chave-valor hierarquico. No Kubernetes, as chaves seguem o padrao:

\`\`\`
/registry/<tipo-de-recurso>/<namespace>/<nome>

Exemplos:
/registry/pods/default/nginx-pod
/registry/deployments/kube-system/coredns
/registry/secrets/default/minha-senha
/registry/namespaces/production
\`\`\`

### Algoritmo Raft (Consenso Distribuido)

O etcd usa o algoritmo **Raft** para garantir consistencia em um cluster de multiplos membros:

| Conceito | Descricao |
|----------|-----------|
| Leader | Unico membro que aceita escritas e replica para os followers |
| Follower | Replica dados do leader, pode atender leituras |
| Candidate | Estado transitorio durante eleicao de leader |
| Quorum | Maioria simples necessaria para qualquer operacao de escrita |
| Term | Periodo de tempo identificado por um numero inteiro crescente |

**Formula do quorum:** \`(N/2) + 1\` membros devem estar disponiveis

| Membros | Quorum | Falhas toleradas |
|---------|--------|-----------------|
| 1 | 1 | 0 |
| 3 | 2 | 1 |
| 5 | 3 | 2 |
| 7 | 4 | 3 |

> **Recomendacao CKA**: Clusters de producao devem ter **3 ou 5 membros** de etcd. Nunca use numero par (reduz tolerancia a falhas).

---

## Topologias de etcd no Kubernetes

### Stacked etcd (Empilhado)

O etcd roda **dentro do mesmo node** que os componentes do control plane. E o padrao do kubeadm.

\`\`\`
Control Plane Node 1          Control Plane Node 2          Control Plane Node 3
+---------------------------+  +---------------------------+  +---------------------------+
| kube-apiserver            |  | kube-apiserver            |  | kube-apiserver            |
| kube-controller-manager   |  | kube-controller-manager   |  | kube-controller-manager   |
| kube-scheduler            |  | kube-scheduler            |  | kube-scheduler            |
| etcd (member 1) <---------|--|-> etcd (member 2) <--------|--|-> etcd (member 3)         |
+---------------------------+  +---------------------------+  +---------------------------+
\`\`\`

**Vantagens:** Menor complexidade operacional, menos infraestrutura
**Desvantagens:** Se o node cair, perde um membro do etcd E um control plane simultaneamente

### External etcd (Externo)

O etcd roda em **nodes dedicados**, separados do control plane.

\`\`\`
Control Plane Nodes              etcd Nodes
+--------------------+           +--------------------+
| kube-apiserver  ---|---------->| etcd (member 1)    |
| controller-mgr  ---|---------->| etcd (member 2)    |
| scheduler       ---|---------->| etcd (member 3)    |
+--------------------+           +--------------------+
\`\`\`

**Vantagens:** Maior resiliencia, falha do control plane nao afeta o etcd
**Desvantagens:** Mais complexo, requer mais servidores

---

## Arquitetura do etcd no Kubernetes (kubeadm)

Em um cluster kubeadm, o etcd roda como **Static Pod** no control plane:

\`\`\`bash
# Localizar o manifesto do etcd
cat /etc/kubernetes/manifests/etcd.yaml

# Verificar onde os dados sao armazenados
grep data-dir /etc/kubernetes/manifests/etcd.yaml
# Output: --data-dir=/var/lib/etcd
\`\`\`

O etcd usa **HTTPS** com autenticacao via certificados TLS. Os certificados ficam em:

\`\`\`
/etc/kubernetes/pki/etcd/
├── ca.crt          # CA do etcd
├── ca.key
├── server.crt      # Certificado do servidor etcd
├── server.key
├── peer.crt        # Certificado para comunicacao entre peers
├── peer.key
├── healthcheck-client.crt
└── healthcheck-client.key
\`\`\`

---

## Configurando o etcdctl

O **etcdctl** e o cliente CLI do etcd. Sempre use a versao da API 3:

\`\`\`bash
# Exportar variavel para usar API v3
export ETCDCTL_API=3

# Verificar a versao
etcdctl version

# As tres flags TLS sempre necessarias:
# --cacert=/etc/kubernetes/pki/etcd/ca.crt
# --cert=/etc/kubernetes/pki/etcd/server.crt  (ou healthcheck-client.crt)
# --key=/etc/kubernetes/pki/etcd/server.key   (ou healthcheck-client.key)

# Endpoint padrao (localhost)
# --endpoints=https://127.0.0.1:2379

# Dica CKA: crie um alias para economizar tempo no exame
alias etcdctl='ETCDCTL_API=3 etcdctl \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key'
\`\`\`

---

## Verificando Saude do etcd

\`\`\`bash
# Verificar saude do endpoint
ETCDCTL_API=3 etcdctl \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt \\
  --key=/etc/kubernetes/pki/etcd/server.key \\
  endpoint health

# Output esperado:
# https://127.0.0.1:2379 is healthy: successfully committed proposal: took = 1.5ms

# Status detalhado (mostra leader, DB size, etc.)
ETCDCTL_API=3 etcdctl \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt \\
  --key=/etc/kubernetes/pki/etcd/server.key \\
  endpoint status --write-out=table

# Listar membros do cluster etcd
ETCDCTL_API=3 etcdctl \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt \\
  --key=/etc/kubernetes/pki/etcd/server.key \\
  member list --write-out=table
\`\`\`

---

## Realizando Backup (Snapshot)

\`\`\`bash
# Criar snapshot do etcd
ETCDCTL_API=3 etcdctl \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt \\
  --key=/etc/kubernetes/pki/etcd/server.key \\
  snapshot save /opt/etcd-backup/snapshot-$(date +%Y%m%d-%H%M%S).db

# Verificar a integridade do snapshot
ETCDCTL_API=3 etcdctl snapshot status /opt/etcd-backup/snapshot.db

# Saida detalhada da verificacao
ETCDCTL_API=3 etcdctl \\
  snapshot status /opt/etcd-backup/snapshot.db \\
  --write-out=table

# Output:
# +----------+----------+------------+------------+
# |   HASH   | REVISION | TOTAL KEYS | TOTAL SIZE |
# +----------+----------+------------+------------+
# | fe01cf57 |       10 |          7 |      2.1 MB|
# +----------+----------+------------+------------+
\`\`\`

### Script de Backup Automatizado

\`\`\`bash
#!/bin/bash
# /usr/local/bin/etcd-backup.sh

BACKUP_DIR="/opt/etcd-backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
SNAPSHOT_FILE="\${BACKUP_DIR}/etcd-snapshot-\${TIMESTAMP}.db"
RETENTION_DAYS=7

mkdir -p \${BACKUP_DIR}

ETCDCTL_API=3 etcdctl \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt \\
  --key=/etc/kubernetes/pki/etcd/server.key \\
  snapshot save \${SNAPSHOT_FILE}

if [ $? -eq 0 ]; then
  echo "Backup criado com sucesso: \${SNAPSHOT_FILE}"
  find \${BACKUP_DIR} -name "*.db" -mtime +\${RETENTION_DAYS} -delete
else
  echo "ERRO: Falha ao criar backup!"
  exit 1
fi
\`\`\`

---

## Restaurando o etcd a partir de um Snapshot

**ATENCAO**: Restaurar o etcd substituira todo o estado do cluster pelo estado do backup.

### Processo de Restauracao

\`\`\`bash
# Passo 1: Parar o etcd (mover o manifesto do static pod)
mv /etc/kubernetes/manifests/etcd.yaml /tmp/etcd-backup.yaml

# Aguardar o pod do etcd parar
sleep 10

# Passo 2: Fazer backup do diretorio de dados atual
mv /var/lib/etcd /var/lib/etcd-old-$(date +%Y%m%d)

# Passo 3: Restaurar o snapshot para um novo diretorio
ETCDCTL_API=3 etcdctl \\
  snapshot restore /opt/etcd-backup/snapshot.db \\
  --data-dir=/var/lib/etcd \\
  --name=master \\
  --initial-cluster=master=https://127.0.0.1:2380 \\
  --initial-cluster-token=etcd-cluster-1 \\
  --initial-advertise-peer-urls=https://127.0.0.1:2380

# Passo 4: Ajustar permissoes do diretorio restaurado
chown -R etcd:etcd /var/lib/etcd

# Passo 5: Restaurar o manifesto do etcd
mv /tmp/etcd-backup.yaml /etc/kubernetes/manifests/etcd.yaml

# Passo 6: Aguardar o etcd iniciar e verificar
sleep 30
ETCDCTL_API=3 etcdctl \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt \\
  --key=/etc/kubernetes/pki/etcd/server.key \\
  endpoint health

# Passo 7: Verificar que o cluster voltou ao normal
kubectl get nodes
kubectl get pods -n kube-system
\`\`\`

### Restaurando para um Diretorio Diferente

\`\`\`bash
# Restaurar para /var/lib/etcd-restored
ETCDCTL_API=3 etcdctl \\
  snapshot restore /opt/backup/snapshot.db \\
  --data-dir=/var/lib/etcd-restored

# Atualizar o manifesto do etcd para usar o novo diretorio
vi /etc/kubernetes/manifests/etcd.yaml
# Buscar por data-dir e alterar o valor
# Buscar pelo hostPath e alterar para o novo path
\`\`\`

---

## Gerenciamento de Membros do etcd

### Adicionando um Novo Membro

\`\`\`bash
# Passo 1: Adicionar o novo membro ao cluster (executar em um membro existente)
ETCDCTL_API=3 etcdctl \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt \\
  --key=/etc/kubernetes/pki/etcd/server.key \\
  member add etcd-node3 \\
  --peer-urls=https://192.168.1.13:2380

# Output:
# Member abc123def added to cluster xyz456
# ETCD_NAME="etcd-node3"
# ETCD_INITIAL_CLUSTER="etcd-node1=https://192.168.1.11:2380,etcd-node2=https://192.168.1.12:2380,etcd-node3=https://192.168.1.13:2380"
# ETCD_INITIAL_CLUSTER_STATE="existing"

# Passo 2: Iniciar o novo membro com as variaveis geradas
# (executar no novo node)
\`\`\`

### Removendo um Membro com Falha

\`\`\`bash
# Listar membros para obter o ID
ETCDCTL_API=3 etcdctl member list --write-out=table

# Remover o membro com falha pelo seu ID
ETCDCTL_API=3 etcdctl \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt \\
  --key=/etc/kubernetes/pki/etcd/server.key \\
  member remove <member-id>

# Verificar que o membro foi removido
ETCDCTL_API=3 etcdctl member list
\`\`\`

---

## Encryption at Rest (Criptografia de Segredos)

O etcd armazena dados sem criptografia por padrao. Para proteger Secrets, configure **encryption at rest**:

### Criar a Configuracao de Criptografia

\`\`\`yaml
# /etc/kubernetes/enc/encryption-config.yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
  - resources:
      - secrets
    providers:
      - aescbc:
          keys:
            - name: key1
              secret: <base64-encoded-32-byte-key>
      - identity: {}
\`\`\`

\`\`\`bash
# Gerar uma chave de 32 bytes em base64
head -c 32 /dev/urandom | base64

# Criar o arquivo de configuracao
mkdir -p /etc/kubernetes/enc
# Colar o YAML acima com a chave gerada
\`\`\`

### Configurar o API Server para Usar Criptografia

\`\`\`bash
# Editar o manifesto do kube-apiserver
vi /etc/kubernetes/manifests/kube-apiserver.yaml

# Adicionar ao spec.containers[0].command:
# - --encryption-provider-config=/etc/kubernetes/enc/encryption-config.yaml

# Adicionar ao volumeMounts:
# - name: enc
#   mountPath: /etc/kubernetes/enc
#   readOnly: true

# Adicionar ao volumes:
# - name: enc
#   hostPath:
#     path: /etc/kubernetes/enc
#     type: DirectoryOrCreate
\`\`\`

\`\`\`bash
# Verificar que novos secrets sao criptografados
kubectl create secret generic teste-enc --from-literal=senha=super-secreta

# Verificar no etcd (deve aparecer criptografado)
ETCDCTL_API=3 etcdctl \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt \\
  --key=/etc/kubernetes/pki/etcd/server.key \\
  get /registry/secrets/default/teste-enc | hexdump -C | head

# Criptografar secrets existentes
kubectl get secrets -A -o json | kubectl replace -f -
\`\`\`

---

## Compactacao e Defragmentacao

O etcd acumula revisoes historicas que aumentam o uso de disco. A compactacao remove revisoes antigas:

\`\`\`bash
# Obter a revisao atual
ETCDCTL_API=3 etcdctl \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt \\
  --key=/etc/kubernetes/pki/etcd/server.key \\
  endpoint status --write-out=json | python3 -c \\
  "import json,sys; print(json.load(sys.stdin)[0]['Status']['header']['revision'])"

# Compactar ate a revisao atual (ex: revisao 5000)
ETCDCTL_API=3 etcdctl \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt \\
  --key=/etc/kubernetes/pki/etcd/server.key \\
  compact 5000

# Defragmentar para liberar espaco em disco
ETCDCTL_API=3 etcdctl \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt \\
  --key=/etc/kubernetes/pki/etcd/server.key \\
  defrag

# Verificar tamanho do DB antes e depois
ETCDCTL_API=3 etcdctl \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt \\
  --key=/etc/kubernetes/pki/etcd/server.key \\
  endpoint status --write-out=table
\`\`\`

---

## Verificando o Estado do etcd no Manifesto

\`\`\`bash
cat /etc/kubernetes/manifests/etcd.yaml
\`\`\`

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: etcd
  namespace: kube-system
spec:
  containers:
  - name: etcd
    image: registry.k8s.io/etcd:3.5.12-0
    command:
    - etcd
    - --data-dir=/var/lib/etcd
    - --listen-client-urls=https://127.0.0.1:2379
    - --advertise-client-urls=https://127.0.0.1:2379
    - --listen-peer-urls=https://127.0.0.1:2380
    - --cert-file=/etc/kubernetes/pki/etcd/server.crt
    - --key-file=/etc/kubernetes/pki/etcd/server.key
    - --trusted-ca-file=/etc/kubernetes/pki/etcd/ca.crt
    - --peer-cert-file=/etc/kubernetes/pki/etcd/peer.crt
    - --peer-key-file=/etc/kubernetes/pki/etcd/peer.key
    - --peer-trusted-ca-file=/etc/kubernetes/pki/etcd/ca.crt
    volumeMounts:
    - mountPath: /var/lib/etcd
      name: etcd-data
    - mountPath: /etc/kubernetes/pki/etcd
      name: etcd-certs
  volumes:
  - name: etcd-data
    hostPath:
      path: /var/lib/etcd
  - name: etcd-certs
    hostPath:
      path: /etc/kubernetes/pki/etcd
\`\`\`

---

## etcd Externo (External etcd)

Em setups de HA, o etcd pode rodar fora do control plane:

\`\`\`bash
# Conectar a um etcd externo
ETCDCTL_API=3 etcdctl \\
  --endpoints=https://192.168.1.10:2379,https://192.168.1.11:2379 \\
  --cacert=/etc/etcd/ca.crt \\
  --cert=/etc/etcd/etcd.crt \\
  --key=/etc/etcd/etcd.key \\
  endpoint status --write-out=table

# Quando ha etcd externo, o kube-apiserver usa a flag:
# --etcd-servers=https://192.168.1.10:2379,https://192.168.1.11:2379
grep etcd-servers /etc/kubernetes/manifests/kube-apiserver.yaml
\`\`\`

---

## Resumo de Portas do etcd

| Porta | Protocolo | Uso |
|-------|-----------|-----|
| 2379 | HTTPS | Comunicacao com clientes (API Server, etcdctl) |
| 2380 | HTTPS | Comunicacao entre peers (replicacao Raft) |
`,

  quiz: [
    {
      question: 'Qual variavel de ambiente deve ser exportada para usar o etcdctl com a API versao 3?',
      options: [
        'ETCD_VERSION=3',
        'ETCDCTL_VERSION=3',
        'ETCDCTL_API=3',
        'ETCD_API_VERSION=v3'
      ],
      correct: 2,
      explanation: '"export ETCDCTL_API=3" e obrigatorio para usar a API v3 do etcdctl. Sem essa variavel, o etcdctl usa a API v2 por padrao, que nao e compativel com o etcd usado pelo Kubernetes moderno.'
    },
    {
      question: 'Quais sao as tres flags TLS obrigatorias para qualquer comando etcdctl que se conecte ao etcd do Kubernetes?',
      options: [
        '--tls, --cert, --key',
        '--cacert, --cert, --key',
        '--ca, --certificate, --private-key',
        '--ssl-ca, --ssl-cert, --ssl-key'
      ],
      correct: 1,
      explanation: 'As tres flags TLS obrigatorias sao: --cacert (CA do etcd), --cert (certificado cliente) e --key (chave privada). Os arquivos ficam em /etc/kubernetes/pki/etcd/ em clusters kubeadm.'
    },
    {
      question: 'Qual comando cria um snapshot do etcd e salva em /backup/etcd.db?',
      options: [
        'etcdctl backup create /backup/etcd.db',
        'etcdctl snapshot save /backup/etcd.db',
        'etcdctl export /backup/etcd.db',
        'etcdctl dump --output=/backup/etcd.db'
      ],
      correct: 1,
      explanation: '"etcdctl snapshot save <caminho>" e o comando correto para criar um snapshot (backup) do etcd. Sempre inclua as flags TLS e o endpoint. Use "etcdctl snapshot status <arquivo>" para verificar a integridade do snapshot.'
    },
    {
      question: 'Durante a restauracao do etcd, por que e necessario parar o etcd antes de restaurar?',
      options: [
        'O etcd nao suporta escrita durante operacoes de leitura',
        'Para evitar corrupcao de dados, pois o etcd nao pode ter dois data-dirs ativos simultaneamente',
        'Porque o etcdctl precisa de acesso exclusivo ao filesystem',
        'Por requisito de licenca do etcd'
      ],
      correct: 1,
      explanation: 'O etcd nao pode ter dois processos acessando o mesmo data-dir simultaneamente. Durante a restauracao, estamos criando um novo data-dir a partir do snapshot. Se o etcd continuar rodando, pode haver corrupcao ou conflito de dados. O processo seguro e: parar etcd -> restaurar -> reiniciar etcd.'
    },
    {
      question: 'Como verificar a saude de todos os membros de um cluster etcd de 3 nos?',
      options: [
        'kubectl get pods -n kube-system | grep etcd',
        'etcdctl member status --all',
        'etcdctl --endpoints=<ip1>:2379,<ip2>:2379,<ip3>:2379 endpoint health',
        'etcdctl cluster-health --all-members'
      ],
      correct: 2,
      explanation: '"etcdctl endpoint health" com multiplos endpoints verifica a saude de cada membro. Use --endpoints para listar todos os IPs/portas do cluster etcd. Adicione --write-out=table para formatacao tabular.'
    },
    {
      question: 'Qual e o caminho padrao do data-dir do etcd em um cluster gerenciado por kubeadm?',
      options: [
        '/etc/etcd/data',
        '/var/etcd',
        '/var/lib/etcd',
        '/opt/kubernetes/etcd'
      ],
      correct: 2,
      explanation: 'O data-dir padrao do etcd em clusters kubeadm e /var/lib/etcd. Voce pode confirmar verificando o manifesto do static pod: grep data-dir /etc/kubernetes/manifests/etcd.yaml. Ao restaurar para um diretorio diferente, o manifesto tambem deve ser atualizado.'
    },
    {
      question: 'Apos restaurar o etcd para um novo data-dir (/var/lib/etcd-new), o que mais precisa ser atualizado?',
      options: [
        'Apenas reiniciar o kubelet',
        'Atualizar o --data-dir e o hostPath no manifesto /etc/kubernetes/manifests/etcd.yaml',
        'Executar kubeadm reset e reiniciar',
        'Criar um novo ServiceAccount para o etcd'
      ],
      correct: 1,
      explanation: 'Ao usar um novo data-dir, o manifesto do etcd (static pod) em /etc/kubernetes/manifests/etcd.yaml deve ser atualizado: (1) a flag --data-dir= deve apontar para o novo diretorio, e (2) o volume hostPath do etcd-data tambem deve ser atualizado para o novo caminho.'
    },
    {
      question: 'Quantos membros de etcd sao necessarios para tolerar 1 falha e manter o quorum?',
      options: [
        '2 membros',
        '3 membros',
        '4 membros',
        '6 membros'
      ],
      correct: 1,
      explanation: 'Com 3 membros, o quorum e 2. Se 1 membro falhar, os 2 restantes formam quorum e o cluster continua funcionando. A formula e (N/2)+1. Com 2 membros, o quorum tambem e 2, mas qualquer falha paralisa o cluster, por isso 3 e o minimo recomendado.'
    },
    {
      question: 'O que faz o comando "etcdctl defrag"?',
      options: [
        'Remove todas as chaves com TTL expirado',
        'Libera espaco em disco compactando o arquivo de banco de dados do etcd, recuperando espaco apos compactacao de revisoes',
        'Reorganiza os membros do cluster para otimizar latencia',
        'Remove snapshots antigos do diretorio de backup'
      ],
      correct: 1,
      explanation: 'Apos "etcdctl compact", o espaco das revisoes removidas ainda esta alocado no arquivo de dados. O "etcdctl defrag" recria o arquivo de banco de dados compactado, devolvendo espaco real ao disco. Execute sempre apos compact, de preferencia com o etcd parado ou durante janela de manutencao.'
    },
    {
      question: 'Qual e a diferenca entre topologia "stacked etcd" e "external etcd"?',
      options: [
        'Stacked usa NFS, external usa discos locais',
        'Stacked tem o etcd no mesmo node do control plane, external tem etcd em nodes dedicados separados',
        'Stacked suporta HA, external nao suporta',
        'External usa etcd v2, stacked usa etcd v3'
      ],
      correct: 1,
      explanation: 'Em "stacked etcd", o etcd roda como Static Pod no mesmo node dos componentes do control plane (padrao kubeadm). Em "external etcd", o etcd roda em nodes dedicados separados, oferecendo maior resiliencia porque a falha de um control plane nao derruba um membro do etcd simultaneamente.'
    }
  ],

  flashcards: [
    {
      front: 'Qual e o comando completo para fazer backup do etcd em um cluster kubeadm?',
      back: 'ETCDCTL_API=3 etcdctl \\\n  --endpoints=https://127.0.0.1:2379 \\\n  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\\n  --cert=/etc/kubernetes/pki/etcd/server.crt \\\n  --key=/etc/kubernetes/pki/etcd/server.key \\\n  snapshot save /backup/etcd-snapshot.db'
    },
    {
      front: 'Como verificar se um snapshot do etcd e valido?',
      back: 'ETCDCTL_API=3 etcdctl \\\n  snapshot status /backup/etcd-snapshot.db \\\n  --write-out=table\n\nRetorna: hash, revision, total de keys e tamanho do snapshot.'
    },
    {
      front: 'Qual a sequencia correta para restaurar o etcd?',
      back: '1. mv /etc/kubernetes/manifests/etcd.yaml /tmp/ (parar etcd)\n2. mv /var/lib/etcd /var/lib/etcd-old (backup dos dados)\n3. etcdctl snapshot restore <snapshot> --data-dir=/var/lib/etcd\n4. chown -R etcd:etcd /var/lib/etcd\n5. mv /tmp/etcd.yaml /etc/kubernetes/manifests/ (reiniciar etcd)\n6. Verificar: etcdctl endpoint health'
    },
    {
      front: 'Onde ficam os certificados TLS do etcd em um cluster kubeadm?',
      back: '/etc/kubernetes/pki/etcd/\n├── ca.crt (CA do etcd - usar em --cacert)\n├── server.crt (servidor - usar em --cert)\n├── server.key (usar em --key)\n├── peer.crt\n├── peer.key\n└── healthcheck-client.crt'
    },
    {
      front: 'Como listar todos os membros de um cluster etcd?',
      back: 'ETCDCTL_API=3 etcdctl \\\n  --endpoints=https://127.0.0.1:2379 \\\n  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\\n  --cert=/etc/kubernetes/pki/etcd/server.crt \\\n  --key=/etc/kubernetes/pki/etcd/server.key \\\n  member list --write-out=table'
    },
    {
      front: 'O que e o algoritmo Raft e por que o etcd o usa?',
      back: 'Raft e um algoritmo de consenso distribuido que garante consistencia em um cluster.\n\nO etcd usa Raft para:\n- Eleger um leader unico para aceitar escritas\n- Replicar as escritas para todos os followers antes de confirmar\n- Manter consistencia mesmo com falhas de membros\n\nQuorum = (N/2)+1 membros devem concordar para qualquer escrita.'
    },
    {
      front: 'Como configurar encryption at rest para Secrets no etcd?',
      back: '1. Gerar chave: head -c 32 /dev/urandom | base64\n2. Criar /etc/kubernetes/enc/encryption-config.yaml com provider aescbc\n3. Adicionar ao kube-apiserver: --encryption-provider-config=/etc/kubernetes/enc/encryption-config.yaml\n4. Montar o arquivo via volume no manifesto do apiserver\n5. Recriar secrets existentes: kubectl get secrets -A -o json | kubectl replace -f -'
    },
    {
      front: 'Quais sao as portas padrao do etcd e para que servem?',
      back: '2379: Comunicacao com clientes\n  - kube-apiserver, etcdctl\n  - Protocolo: HTTPS (nunca HTTP em prod)\n\n2380: Comunicacao entre peers\n  - Replicacao Raft entre membros\n  - Eleicao de leader\n  - Protocolo: HTTPS'
    },
    {
      front: 'O que e o endpoint do etcd e qual a porta padrao?',
      back: 'O endpoint e o endereco onde o etcd aceita conexoes de clientes.\n\nPorta padrao para clientes: 2379\nPorta padrao para peers (replicacao): 2380\n\nEndpoint padrao em kubeadm:\nhttps://127.0.0.1:2379\n\nSempre use https (nao http) em clusters Kubernetes.'
    },
    {
      front: 'Como verificar o data-dir atual do etcd em um cluster kubeadm?',
      back: '# Via manifesto do static pod\ngrep "data-dir" /etc/kubernetes/manifests/etcd.yaml\n\n# Ou ver o pod\nkubectl describe pod etcd-<node> -n kube-system | grep data-dir\n\n# Padrao: /var/lib/etcd'
    },
    {
      front: 'Como compactar e defragmentar o etcd para liberar espaco?',
      back: '# 1. Obter revisao atual\nREV=$(etcdctl endpoint status --write-out=json | \\\n  python3 -c "import json,sys; print(json.load(sys.stdin)[0][\'Status\'][\'header\'][\'revision\'])")\n\n# 2. Compactar ate a revisao atual\netcdctl compact $REV\n\n# 3. Defragmentar para liberar espaco em disco\netcdctl defrag\n\n# 4. Verificar tamanho do DB\netcdctl endpoint status --write-out=table'
    },
    {
      front: 'Qual a tolerancia a falhas de um cluster etcd com 3 vs 5 membros?',
      back: '3 membros:\n- Quorum: 2\n- Falhas toleradas: 1\n- Menor overhead de rede\n\n5 membros:\n- Quorum: 3\n- Falhas toleradas: 2\n- Maior resiliencia\n- Maior latencia de escrita\n\nRegra: sempre use numero impar. NUNCA use 2 ou 4 membros.'
    }
  ],

  lab: {
    scenario: 'O time de SRE precisa implementar uma estrategia completa de backup e recuperacao para o etcd do cluster de producao, alem de verificar a criptografia de segredos e a saude do cluster etcd.',
    objective: 'Executar backup completo do etcd, verificar saude e membros, simular desastre deletando recursos, restaurar o cluster usando o snapshot, e validar a configuracao de encryption at rest.',
    steps: [
      {
        title: 'Verificar saude e configuracao do etcd',
        instruction: 'Antes de qualquer backup, verifique a saude do etcd, liste seus membros e identifique o leader. Em seguida, anote o data-dir e os certificados usados.',
        hints: [
          'export ETCDCTL_API=3 antes de qualquer comando etcdctl',
          'Use endpoint status --write-out=table para ver o leader',
          'grep data-dir /etc/kubernetes/manifests/etcd.yaml mostra o diretorio de dados',
          'member list --write-out=table mostra todos os membros'
        ],
        solution: '```bash\n# Exportar variavel de ambiente\nexport ETCDCTL_API=3\n\n# Definir variaveis de certificados para reusar\nETCDCTL_CACERT=/etc/kubernetes/pki/etcd/ca.crt\nETCDCTL_CERT=/etc/kubernetes/pki/etcd/server.crt\nETCDCTL_KEY=/etc/kubernetes/pki/etcd/server.key\nETCDCTL_ENDPOINTS=https://127.0.0.1:2379\n\n# Verificar saude do endpoint\netcdctl \\\n  --endpoints=$ETCDCTL_ENDPOINTS \\\n  --cacert=$ETCDCTL_CACERT \\\n  --cert=$ETCDCTL_CERT \\\n  --key=$ETCDCTL_KEY \\\n  endpoint health\n\n# Status detalhado (inclui leader e DB size)\netcdctl \\\n  --endpoints=$ETCDCTL_ENDPOINTS \\\n  --cacert=$ETCDCTL_CACERT \\\n  --cert=$ETCDCTL_CERT \\\n  --key=$ETCDCTL_KEY \\\n  endpoint status --write-out=table\n\n# Listar membros do cluster\netcdctl \\\n  --endpoints=$ETCDCTL_ENDPOINTS \\\n  --cacert=$ETCDCTL_CACERT \\\n  --cert=$ETCDCTL_CERT \\\n  --key=$ETCDCTL_KEY \\\n  member list --write-out=table\n\n# Verificar data-dir e certificados no manifesto\ngrep "data-dir" /etc/kubernetes/manifests/etcd.yaml\nls -la /etc/kubernetes/pki/etcd/\n```'
      },
      {
        title: 'Criar recursos de teste e realizar backup do etcd',
        instruction: 'Crie um namespace "before-backup" com um deployment nginx e um configmap. Em seguida, crie o backup do etcd em /opt/etcd-backup/ e verifique a integridade do snapshot.',
        hints: [
          'mkdir -p /opt/etcd-backup antes de salvar o snapshot',
          'Use etcdctl snapshot save para criar o backup',
          'etcdctl snapshot status verifica integridade: mostra hash, revision, total keys e size',
          'O arquivo de snapshot geralmente tem extensao .db'
        ],
        solution: '```bash\n# Criar recursos de teste\nkubectl create namespace before-backup\nkubectl create deployment nginx-test \\\n  --image=nginx:1.25 \\\n  --replicas=2 \\\n  -n before-backup\nkubectl create configmap app-config \\\n  --from-literal=env=production \\\n  --from-literal=version=1.0 \\\n  -n before-backup\n\n# Verificar recursos criados\nkubectl get all -n before-backup\n\n# Criar diretorio de backup\nmkdir -p /opt/etcd-backup\n\n# Criar snapshot\nETCDCTL_API=3 etcdctl \\\n  --endpoints=https://127.0.0.1:2379 \\\n  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\\n  --cert=/etc/kubernetes/pki/etcd/server.crt \\\n  --key=/etc/kubernetes/pki/etcd/server.key \\\n  snapshot save /opt/etcd-backup/etcd-snapshot.db\n\n# Verificar snapshot\nETCDCTL_API=3 etcdctl \\\n  snapshot status /opt/etcd-backup/etcd-snapshot.db \\\n  --write-out=table\n\n# Confirmar o arquivo\nls -lh /opt/etcd-backup/\n```'
      },
      {
        title: 'Simular desastre - deletar recursos',
        instruction: 'Delete o namespace "before-backup" para simular a perda de dados. Confirme que os recursos sumiram. Em seguida, crie um novo namespace "after-disaster" para representar o estado pos-falha.',
        hints: [
          'kubectl delete namespace apaga todos os recursos dentro dele',
          'Use kubectl get namespace para confirmar a delecao',
          'Isso simula o estado que precisa ser restaurado'
        ],
        solution: '```bash\n# Deletar namespace com todos os recursos\nkubectl delete namespace before-backup\n\n# Confirmar que foi deletado\nkubectl get namespace\nkubectl get all -n before-backup 2>&1 || echo "Namespace deleted"\n\n# Criar recurso pos-desastre para demonstrar restauracao\nkubectl create namespace after-disaster\nkubectl create configmap disaster-config \\\n  --from-literal=created=after-disaster \\\n  -n after-disaster\n\n# Estado atual (sem before-backup)\nkubectl get namespaces\n```'
      },
      {
        title: 'Restaurar o etcd a partir do snapshot',
        instruction: 'Execute o processo completo de restauracao: pare o etcd movendo seu manifesto, restaure o snapshot, corrija as permissoes, e reinicie o etcd. Ao final, verifique que o namespace "before-backup" voltou e o namespace "after-disaster" nao existe mais.',
        hints: [
          'Mova /etc/kubernetes/manifests/etcd.yaml para pausar o etcd',
          'etcdctl snapshot restore cria um novo data-dir',
          'Corrija permissoes: chown -R etcd:etcd /var/lib/etcd',
          'Aguarde alguns segundos apos mover o manifesto de volta',
          'Use kubectl get namespaces para verificar o resultado'
        ],
        solution: '```bash\n# Passo 1: Parar o etcd\nmv /etc/kubernetes/manifests/etcd.yaml /tmp/etcd-backup.yaml\nsleep 15\n\n# Passo 2: Backup do data-dir atual\nmv /var/lib/etcd /var/lib/etcd-old\n\n# Passo 3: Restaurar o snapshot\nETCDCTL_API=3 etcdctl \\\n  snapshot restore /opt/etcd-backup/etcd-snapshot.db \\\n  --data-dir=/var/lib/etcd\n\n# Passo 4: Corrigir permissoes\nchown -R etcd:etcd /var/lib/etcd\n\n# Passo 5: Reiniciar o etcd\nmv /tmp/etcd-backup.yaml /etc/kubernetes/manifests/etcd.yaml\n\n# Aguardar o etcd iniciar\nsleep 30\n\n# Passo 6: Verificar saude\nETCDCTL_API=3 etcdctl \\\n  --endpoints=https://127.0.0.1:2379 \\\n  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\\n  --cert=/etc/kubernetes/pki/etcd/server.crt \\\n  --key=/etc/kubernetes/pki/etcd/server.key \\\n  endpoint health\n\n# Passo 7: Verificar resultado da restauracao\nkubectl get namespaces\n# before-backup deve existir novamente\n# after-disaster NAO deve existir\n\nkubectl get all -n before-backup\nkubectl get configmap -n before-backup\n```'
      },
      {
        title: 'Verificar encryption at rest e compactacao',
        instruction:
          'Verifique se o cluster tem encryption at rest configurada para Secrets. Crie um Secret e tente le-lo diretamente do etcd para verificar se esta criptografado. Em seguida, execute compactacao e defragmentacao do etcd.',

        hints: [
          'grep encryption-provider-config /etc/kubernetes/manifests/kube-apiserver.yaml',
          'Se nao houver criptografia, o Secret sera legivel em texto no etcd',
          'etcdctl get /registry/secrets/<namespace>/<nome> mostra o valor bruto',
          'etcdctl compact <revision> seguido de etcdctl defrag libera espaco'
        ],

        solution: '```bash\n# Verificar se encryption at rest esta configurada\ngrep "encryption-provider-config" /etc/kubernetes/manifests/kube-apiserver.yaml\n\n# Criar um Secret de teste\nkubectl create secret generic enc-test \\\n  --from-literal=senha=super-secreta-123\n\n# Tentar ler o Secret diretamente do etcd\nETCDCTL_API=3 etcdctl \\\n  --endpoints=https://127.0.0.1:2379 \\\n  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\\n  --cert=/etc/kubernetes/pki/etcd/server.crt \\\n  --key=/etc/kubernetes/pki/etcd/server.key \\\n  get /registry/secrets/default/enc-test | strings | grep -i senha\n# Se aparecer o valor: sem criptografia\n# Se aparecer dados binarios/hash: criptografia ativa\n\n# Verificar tamanho atual do DB\nETCDCTL_API=3 etcdctl \\\n  --endpoints=https://127.0.0.1:2379 \\\n  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\\n  --cert=/etc/kubernetes/pki/etcd/server.crt \\\n  --key=/etc/kubernetes/pki/etcd/server.key \\\n  endpoint status --write-out=table\n\n# Obter revisao atual e compactar\nREV=$(ETCDCTL_API=3 etcdctl \\\n  --endpoints=https://127.0.0.1:2379 \\\n  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\\n  --cert=/etc/kubernetes/pki/etcd/server.crt \\\n  --key=/etc/kubernetes/pki/etcd/server.key \\\n  endpoint status --write-out=json | python3 -c \\\n  "import json,sys; data=json.load(sys.stdin); print(data[0][\\"Status\\"][\\"header\\"][\\"revision\\"])" )\n\nETCDCTL_API=3 etcdctl \\\n  --endpoints=https://127.0.0.1:2379 \\\n  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\\n  --cert=/etc/kubernetes/pki/etcd/server.crt \\\n  --key=/etc/kubernetes/pki/etcd/server.key \\\n  compact $REV\n\n# Defragmentar\nETCDCTL_API=3 etcdctl \\\n  --endpoints=https://127.0.0.1:2379 \\\n  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\\n  --cert=/etc/kubernetes/pki/etcd/server.crt \\\n  --key=/etc/kubernetes/pki/etcd/server.key \\\n  defrag\n\n# Limpar\nkubectl delete secret enc-test\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'etcdctl: connection refused ao tentar fazer backup',
      symptom: 'Ao executar "etcdctl snapshot save", o comando falha com erro: "Error: dial tcp 127.0.0.1:2379: connect: connection refused" ou "context deadline exceeded". O backup nao e criado.',
      diagnosis: '```bash\n# 1. Verificar se o pod do etcd esta rodando\nkubectl get pods -n kube-system | grep etcd\n\n# 2. Verificar se o manifesto existe\nls /etc/kubernetes/manifests/etcd.yaml\n\n# 3. Verificar logs do etcd\nkubectl logs -n kube-system etcd-<node-name> --tail=30\n\n# 4. Verificar se o endpoint esta correto\ngrep "listen-client-urls" /etc/kubernetes/manifests/etcd.yaml\n\n# 5. Verificar se as flags TLS estao corretas\nls -la /etc/kubernetes/pki/etcd/\n\n# 6. Testar conexao com curl\ncurl -k https://127.0.0.1:2379/health \\\n  --cert /etc/kubernetes/pki/etcd/healthcheck-client.crt \\\n  --key /etc/kubernetes/pki/etcd/healthcheck-client.key \\\n  --cacert /etc/kubernetes/pki/etcd/ca.crt\n\n# 7. Verificar se a porta esta em uso\nss -tlnp | grep 2379\n```',
      solution: '```bash\n# Causa 1: ETCDCTL_API nao exportado ou endpoint errado\nexport ETCDCTL_API=3\n\n# Verificar o endpoint correto no manifesto\nGREP_ENDPOINT=$(grep "listen-client-urls" /etc/kubernetes/manifests/etcd.yaml | awk -F= \'{print $2}\')\necho "Endpoint: $GREP_ENDPOINT"\n\n# Usar o endpoint correto no comando\nETCDCTL_API=3 etcdctl \\\n  --endpoints=${GREP_ENDPOINT} \\\n  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\\n  --cert=/etc/kubernetes/pki/etcd/healthcheck-client.crt \\\n  --key=/etc/kubernetes/pki/etcd/healthcheck-client.key \\\n  endpoint health\n\n# Causa 2: Certificado incorreto (usar healthcheck-client em vez de server)\nETCDCTL_API=3 etcdctl \\\n  --endpoints=https://127.0.0.1:2379 \\\n  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\\n  --cert=/etc/kubernetes/pki/etcd/healthcheck-client.crt \\\n  --key=/etc/kubernetes/pki/etcd/healthcheck-client.key \\\n  snapshot save /opt/etcd-backup/snapshot.db\n\n# Causa 3: etcd parado - verificar e reiniciar static pod\nls /etc/kubernetes/manifests/ | grep etcd\n# Se nao estiver la, mover de volta:\nmv /tmp/etcd.yaml /etc/kubernetes/manifests/\nsleep 15\nkubectl get pods -n kube-system | grep etcd\n```'
    },
    {
      title: 'Cluster nao responde apos restauracao do etcd',
      symptom: 'Apos restaurar o etcd a partir de um snapshot e reiniciar o manifesto, o kubectl para de responder, os pods ficam em estado desconhecido e o API Server nao esta acessivel.',
      diagnosis: '```bash\n# 1. Verificar se o etcd iniciou corretamente\ntail -f /var/log/pods/kube-system_etcd-*/etcd/*.log\n\n# 2. Verificar se o manifesto do etcd tem o data-dir correto\ngrep data-dir /etc/kubernetes/manifests/etcd.yaml\n\n# 3. Verificar permissoes do data-dir\nls -la /var/lib/etcd\n\n# 4. Verificar se o API Server consegue conectar ao etcd\ntail -50 /var/log/pods/kube-system_kube-apiserver-*/kube-apiserver/*.log\n\n# 5. Verificar se o etcd esta ouvindo na porta\nss -tlnp | grep 2379\n\n# 6. Verificar crisp do kubelet\njournalctl -u kubelet --since "10 minutes ago" | grep -i "etcd\\|apiserver"\n```',
      solution: '```bash\n# Causa 1: Permissoes incorretas no data-dir restaurado\nchown -R etcd:etcd /var/lib/etcd\nchmod -R 700 /var/lib/etcd\n\n# Reiniciar etcd\nmv /etc/kubernetes/manifests/etcd.yaml /tmp/\nsleep 10\nmv /tmp/etcd.yaml /etc/kubernetes/manifests/\n\n# Causa 2: data-dir no manifesto nao coincide com o diretorio restaurado\n# Verificar e corrigir o manifesto\ngrep data-dir /etc/kubernetes/manifests/etcd.yaml\n# Se restaurou para /var/lib/etcd-restored, atualizar:\nsed -i \'s|--data-dir=/var/lib/etcd|--data-dir=/var/lib/etcd-restored|\' \\\n  /etc/kubernetes/manifests/etcd.yaml\n\n# Causa 3: Volumes do manifesto nao atualizados\n# O hostPath no volumes tambem precisa ser atualizado\nvi /etc/kubernetes/manifests/etcd.yaml\n# Atualizar a secao volumes.hostPath.path para o novo diretorio\n\n# Verificar recuperacao\nsleep 30\nETCDCTL_API=3 etcdctl \\\n  --endpoints=https://127.0.0.1:2379 \\\n  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\\n  --cert=/etc/kubernetes/pki/etcd/healthcheck-client.crt \\\n  --key=/etc/kubernetes/pki/etcd/healthcheck-client.key \\\n  endpoint health\n\nkubectl get nodes\n```'
    },
    {
      title: 'etcd com alta latencia e erros "etcdserver: request timed out"',
      symptom: 'O API Server lanca erros esporadicos como "etcdserver: request timed out" ou "context deadline exceeded". Operacoes kubectl ficam lentas ou travam. Os logs do etcd mostram avisos de "slow fdatasync" ou "failed to send out heartbeat on time".',
      diagnosis: '```bash\n# 1. Verificar latencia do disco no node do etcd\n# (alta latencia de I/O e a causa mais comum)\niostat -x 1 5\n# Ou:\ndd if=/dev/zero of=/var/lib/etcd/test-latency bs=4096 count=1000 oflag=dsync\nrm /var/lib/etcd/test-latency\n# Latencia > 10ms indica problema de disco\n\n# 2. Verificar tamanho do banco de dados do etcd\nETCDCTL_API=3 etcdctl \\\n  --endpoints=https://127.0.0.1:2379 \\\n  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\\n  --cert=/etc/kubernetes/pki/etcd/server.crt \\\n  --key=/etc/kubernetes/pki/etcd/server.key \\\n  endpoint status --write-out=table\n# dbSize muito grande indica necessidade de compactacao\n\n# 3. Ver logs do etcd para mensagens de lentidao\nkubectl logs -n kube-system etcd-<node> --tail=100 | grep -i "slow\\|timeout\\|heartbeat"\n\n# 4. Verificar uso de CPU e memoria no node\ntop -n 1\nfree -h\n\n# 5. Verificar se outros processos estao usando muito I/O\niotop -o\n```',
      solution: '```bash\n# Causa 1: Banco de dados grande - compactar e defragmentar\nREV=$(ETCDCTL_API=3 etcdctl \\\n  --endpoints=https://127.0.0.1:2379 \\\n  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\\n  --cert=/etc/kubernetes/pki/etcd/server.crt \\\n  --key=/etc/kubernetes/pki/etcd/server.key \\\n  endpoint status --write-out=json | python3 -c \\\n  "import json,sys; data=json.load(sys.stdin); print(data[0][\'Status\'][\'header\'][\'revision\'])")\n\nETCDCTL_API=3 etcdctl \\\n  --endpoints=https://127.0.0.1:2379 \\\n  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\\n  --cert=/etc/kubernetes/pki/etcd/server.crt \\\n  --key=/etc/kubernetes/pki/etcd/server.key \\\n  compact $REV\n\nETCDCTL_API=3 etcdctl \\\n  --endpoints=https://127.0.0.1:2379 \\\n  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\\n  --cert=/etc/kubernetes/pki/etcd/server.crt \\\n  --key=/etc/kubernetes/pki/etcd/server.key \\\n  defrag\n\n# Causa 2: Disco lento - mover data-dir para disco SSD dedicado\n# Parar etcd\nmv /etc/kubernetes/manifests/etcd.yaml /tmp/\nsleep 10\n\n# Mover dados para o novo disco (ex: SSD montado em /mnt/ssd)\nrsync -av /var/lib/etcd/ /mnt/ssd/etcd/\nchown -R etcd:etcd /mnt/ssd/etcd\n\n# Atualizar manifesto do etcd\nsed -i \'s|/var/lib/etcd|/mnt/ssd/etcd|g\' /tmp/etcd.yaml\n\n# Reiniciar etcd\nmv /tmp/etcd.yaml /etc/kubernetes/manifests/\n\n# Causa 3: Aumentar os timeouts do etcd no manifesto\n# Adicionar ao command do etcd:\n# - --heartbeat-interval=250 (padrao: 100ms)\n# - --election-timeout=2500 (padrao: 1000ms)\nvi /etc/kubernetes/manifests/etcd.yaml\n\n# Verificar melhora\nETCDCTL_API=3 etcdctl \\\n  --endpoints=https://127.0.0.1:2379 \\\n  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\\n  --cert=/etc/kubernetes/pki/etcd/server.crt \\\n  --key=/etc/kubernetes/pki/etcd/server.key \\\n  endpoint status --write-out=table\n```'
    }
  ]
};
