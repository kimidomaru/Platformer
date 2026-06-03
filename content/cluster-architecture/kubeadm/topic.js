window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['cluster-architecture/kubeadm'] = {
  theory: `# Kubeadm e Ciclo de Vida do Cluster

## Diagrama: Arquitetura de um Cluster Kubernetes

\`\`\`
┌──────────────────────────────────────────────────────────────────┐
│                     KUBERNETES CLUSTER                            │
│                                                                  │
│  ┌──────────────────────────────────────────────────────┐        │
│  │              CONTROL PLANE (Master)                   │        │
│  │                                                       │        │
│  │  ┌────────────┐  ┌──────────────────┐  ┌──────────┐  │        │
│  │  │ kube-      │  │ kube-controller- │  │ kube-    │  │        │
│  │  │ apiserver  │  │ manager          │  │ scheduler│  │        │
│  │  │ (Static    │  │ (Static Pod)     │  │ (Static  │  │        │
│  │  │  Pod)      │  │                  │  │  Pod)    │  │        │
│  │  └──────┬─────┘  └──────────────────┘  └──────────┘  │        │
│  │         │                                             │        │
│  │  ┌──────▼─────┐  ┌─────────────┐  ┌───────────────┐  │        │
│  │  │   etcd     │  │ kubelet     │  │ kube-proxy    │  │        │
│  │  │ (Static    │  │ (systemd)   │  │ (DaemonSet)   │  │        │
│  │  │  Pod)      │  │             │  │               │  │        │
│  │  └────────────┘  └─────────────┘  └───────────────┘  │        │
│  └──────────────────────────────────────────────────────┘        │
│                            │                                     │
│                   API Server :6443                                │
│                            │                                     │
│  ┌──────────────────────────────────────────────────────┐        │
│  │              WORKER NODE                              │        │
│  │                                                       │        │
│  │  ┌─────────────┐  ┌───────────────┐  ┌────────────┐  │        │
│  │  │ kubelet     │  │ kube-proxy    │  │ Container  │  │        │
│  │  │ (systemd)   │  │ (DaemonSet)   │  │ Runtime    │  │        │
│  │  │             │  │               │  │(containerd)│  │        │
│  │  └─────────────┘  └───────────────┘  └────────────┘  │        │
│  │                                                       │        │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐            │        │
│  │  │  Pod 1   │  │  Pod 2   │  │  Pod 3   │            │        │
│  │  └──────────┘  └──────────┘  └──────────┘            │        │
│  └──────────────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────────┘
\`\`\`

---

## O que e o kubeadm?

O **kubeadm** e a ferramenta oficial para bootstrapping de clusters Kubernetes. Ele automatiza a configuracao dos componentes do control plane, geracao de certificados, configuracao do kubeconfig e join de nos workers.

### O que o kubeadm FAZ e NAO faz

| kubeadm FAZ | kubeadm NAO faz |
|-------------|-----------------|
| Inicializa control plane | Instalar kubelet/kubectl |
| Gera certificados | Instalar container runtime |
| Cria Static Pods | Provisionar infraestrutura |
| Join de workers | Configurar rede (CNI) |
| Upgrade de cluster | Gerenciar add-ons (DNS, dashboard) |
| Renovar certificados | Alta disponibilidade automatica |
| Gera kubeconfigs | Monitoramento |

---

## Fluxo de Inicializacao: kubeadm init

### Diagrama: Fases do kubeadm init

\`\`\`
kubeadm init
    │
    ▼
┌─────────────────────────┐
│ 1. Preflight Checks     │  Verifica requisitos (CPU, RAM, swap, ports)
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 2. Gera Certificados    │  CA, API server, etcd, front-proxy, SA
│    /etc/kubernetes/pki/  │
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 3. Gera kubeconfigs      │  admin.conf, kubelet.conf, scheduler.conf,
│    /etc/kubernetes/       │  controller-manager.conf
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 4. Gera Static Pod       │  kube-apiserver, kube-controller-manager,
│    Manifests             │  kube-scheduler, etcd
│    /etc/kubernetes/       │  (kubelet inicia automaticamente)
│    manifests/            │
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 5. Bootstrap Tokens      │  Gera token para join de workers
│    + RBAC                │  Configura ClusterRoleBindings
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 6. Instala addons        │  CoreDNS, kube-proxy como DaemonSet
└───────────┬─────────────┘
            ▼
    Cluster pronto!
    (falta instalar CNI)
\`\`\`

### Pre-requisitos

\`\`\`bash
# Verificar se o sistema atende os requisitos
# - 2 CPUs minimo
# - 2GB RAM minimo
# - Conexao de rede entre os nos
# - Swap desabilitado
# - Portas necessarias abertas (6443, 10250, 2379-2380, etc.)
swapoff -a

# Verificar modulos necessarios
lsmod | grep br_netfilter
modprobe br_netfilter
modprobe overlay

# Configurar sysctl
cat <<EOF | tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF
sysctl --system
\`\`\`

### Portas necessarias

| Componente | Porta | Protocolo | Uso |
|------------|-------|-----------|-----|
| kube-apiserver | 6443 | TCP | API do cluster |
| etcd | 2379-2380 | TCP | Comunicacao client e peer |
| kubelet | 10250 | TCP | API do kubelet |
| kube-scheduler | 10259 | TCP | Health check |
| kube-controller-manager | 10257 | TCP | Health check |
| NodePort Services | 30000-32767 | TCP | Services expostos |

### Inicializar o Control Plane

\`\`\`bash
# Inicializacao basica
kubeadm init

# Inicializacao com pod CIDR especifico (necessario para CNI como Calico)
kubeadm init --pod-network-cidr=192.168.0.0/16

# Com API server advertise address especifica
kubeadm init \\
  --apiserver-advertise-address=192.168.1.100 \\
  --pod-network-cidr=10.244.0.0/16 \\
  --service-cidr=10.96.0.0/12 \\
  --kubernetes-version=v1.30.0

# Usando um arquivo de configuracao (recomendado)
kubeadm init --config=kubeadm-config.yaml

# Dry-run (simular sem executar)
kubeadm init --dry-run
\`\`\`

### Arquivo de Configuracao do kubeadm

\`\`\`yaml
apiVersion: kubeadm.k8s.io/v1beta3
kind: ClusterConfiguration
kubernetesVersion: v1.30.0
controlPlaneEndpoint: "192.168.1.100:6443"
networking:
  podSubnet: "10.244.0.0/16"
  serviceSubnet: "10.96.0.0/12"
  dnsDomain: "cluster.local"
apiServer:
  extraArgs:
    audit-log-path: /var/log/kubernetes/audit.log
    audit-log-maxage: "30"
    enable-admission-plugins: NodeRestriction,PodSecurity
  extraVolumes:
  - name: audit-log
    hostPath: /var/log/kubernetes
    mountPath: /var/log/kubernetes
    pathType: DirectoryOrCreate
etcd:
  local:
    dataDir: /var/lib/etcd
---
apiVersion: kubeadm.k8s.io/v1beta3
kind: InitConfiguration
localAPIEndpoint:
  advertiseAddress: "192.168.1.100"
  bindPort: 6443
nodeRegistration:
  criSocket: unix:///var/run/containerd/containerd.sock
  taints:
  - key: "node-role.kubernetes.io/control-plane"
    effect: "NoSchedule"
\`\`\`

### Pos-inicializacao

\`\`\`bash
# Configurar kubeconfig para o usuario root
export KUBECONFIG=/etc/kubernetes/admin.conf

# Ou para usuario nao-root (IMPORTANTE para o exame CKA!)
mkdir -p $HOME/.kube
cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
chown $(id -u):$(id -g) $HOME/.kube/config

# Instalar CNI (OBRIGATORIO - sem CNI, nodes ficam NotReady)
# Opcao 1: Flannel
kubectl apply -f https://github.com/flannel-io/flannel/releases/latest/download/kube-flannel.yml

# Opcao 2: Calico
kubectl apply -f https://docs.projectcalico.org/manifests/calico.yaml

# Opcao 3: Cilium
cilium install

# Verificar status do cluster
kubectl get nodes
kubectl get pods -n kube-system
\`\`\`

---

## Adicionando Nos Workers: kubeadm join

\`\`\`bash
# O comando join e exibido ao final do kubeadm init
kubeadm join <control-plane-host>:<port> \\
  --token <token> \\
  --discovery-token-ca-cert-hash sha256:<hash>

# Se o token expirou (validade padrao: 24h), gerar novo token
kubeadm token create --print-join-command

# Listar tokens existentes
kubeadm token list

# Gerar apenas o hash do CA cert (se perdeu o hash)
openssl x509 -pubkey -in /etc/kubernetes/pki/ca.crt | \\
  openssl rsa -pubin -outform der 2>/dev/null | \\
  openssl dgst -sha256 -hex | sed 's/^.* //'

# Para adicionar outro control plane (HA)
kubeadm join <control-plane-host>:<port> \\
  --token <token> \\
  --discovery-token-ca-cert-hash sha256:<hash> \\
  --control-plane \\
  --certificate-key <cert-key>
\`\`\`

---

## Upgrade do Cluster

### Diagrama: Fluxo de Upgrade (CKA - muito cobrado!)

\`\`\`
┌─────────────────────────────────────────────────────────────┐
│              PROCESSO DE UPGRADE DO CLUSTER                  │
│                                                              │
│  CONTROL PLANE:                                              │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │1. Update  │  │2. kubeadm    │  │3. Update kubelet     │  │
│  │  kubeadm  │─>│   upgrade    │─>│   & kubectl          │  │
│  │  package  │  │   apply      │  │   + restart kubelet  │  │
│  └──────────┘  └──────────────┘  └───────────────────────┘  │
│                                                              │
│  CADA WORKER NODE (um por vez):                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │1. drain  │  │2. Update │  │3. kubeadm│  │4. Update   │  │
│  │ o node   │─>│ kubeadm  │─>│ upgrade  │─>│ kubelet &  │  │
│  │(do ctrl) │  │ package  │  │ node     │  │ kubectl    │  │
│  └──────────┘  └──────────┘  └──────────┘  └─────┬──────┘  │
│                                                    │         │
│                                              ┌─────▼──────┐  │
│                                              │5. uncordon │  │
│                                              │  o node    │  │
│                                              │ (do ctrl)  │  │
│                                              └────────────┘  │
└─────────────────────────────────────────────────────────────┘
\`\`\`

### Regra de Compatibilidade de Versoes

| Componente | Relacao com API Server |
|------------|----------------------|
| kube-apiserver | Versao de referencia (N) |
| kube-controller-manager | N ou N-1 |
| kube-scheduler | N ou N-1 |
| kubelet | N, N-1 ou N-2 |
| kubectl | N, N-1 ou N+1 |
| etcd | Segue requisitos do K8s |

**Regra**: Sempre upgrade o control plane PRIMEIRO, depois os workers. O kubelet pode ser ate 2 versoes minor mais antigo que o API server.

### Passo 1: Upgrade do Control Plane

\`\`\`bash
# Verificar versoes disponiveis
kubeadm upgrade plan

# Atualizar o pacote kubeadm (Ubuntu/Debian)
apt-mark unhold kubeadm
apt-get update && apt-get install -y kubeadm=1.31.0-1.1
apt-mark hold kubeadm

# Verificar o plano de upgrade detalhado
kubeadm upgrade plan v1.31.0

# Aplicar o upgrade (apenas no PRIMEIRO control plane)
kubeadm upgrade apply v1.31.0

# Para control planes adicionais (HA), usar:
# kubeadm upgrade node

# Atualizar kubelet e kubectl no control plane
apt-mark unhold kubelet kubectl
apt-get install -y kubelet=1.31.0-1.1 kubectl=1.31.0-1.1
apt-mark hold kubelet kubectl

# Reiniciar o kubelet
systemctl daemon-reload
systemctl restart kubelet

# Verificar versao
kubectl get nodes
\`\`\`

### Passo 2: Upgrade dos Worker Nodes

\`\`\`bash
# ========== NO CONTROL PLANE ==========
# Drenar o worker (evacuar workloads)
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data

# ========== NO WORKER NODE ==========
# Atualizar kubeadm
apt-mark unhold kubeadm
apt-get install -y kubeadm=1.31.0-1.1
apt-mark hold kubeadm

# Aplicar upgrade no node (SEM versao - auto-detecta)
kubeadm upgrade node

# Atualizar kubelet e kubectl no worker
apt-mark unhold kubelet kubectl
apt-get install -y kubelet=1.31.0-1.1 kubectl=1.31.0-1.1
apt-mark hold kubelet kubectl

systemctl daemon-reload
systemctl restart kubelet

# ========== NO CONTROL PLANE ==========
# Reabilitar o node
kubectl uncordon <node-name>

# Verificar status
kubectl get nodes
\`\`\`

---

## Backup e Restore do etcd

### Backup do etcd (CKA - muito cobrado!)

\`\`\`bash
# Encontrar os parametros do etcd (do static pod manifest)
cat /etc/kubernetes/manifests/etcd.yaml | grep -E "listen-client|cert-file|key-file|trusted-ca"

# Backup do etcd
ETCDCTL_API=3 etcdctl snapshot save /opt/etcd-backup.db \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt \\
  --key=/etc/kubernetes/pki/etcd/server.key

# Verificar o backup
ETCDCTL_API=3 etcdctl snapshot status /opt/etcd-backup.db \\
  --write-out=table
\`\`\`

### Restore do etcd

\`\`\`bash
# 1. Parar o etcd (mover o manifesto)
mv /etc/kubernetes/manifests/etcd.yaml /tmp/

# 2. Restaurar o snapshot para um novo diretorio
ETCDCTL_API=3 etcdctl snapshot restore /opt/etcd-backup.db \\
  --data-dir=/var/lib/etcd-restored

# 3. Atualizar o manifesto do etcd para usar o novo data-dir
# Editar o arquivo antes de mover de volta
# Mudar: --data-dir=/var/lib/etcd-restored
# E o hostPath do volume: path: /var/lib/etcd-restored

# 4. Mover o manifesto de volta (kubelet recria o static pod)
mv /tmp/etcd.yaml /etc/kubernetes/manifests/

# 5. Verificar que o etcd reiniciou corretamente
kubectl get pods -n kube-system | grep etcd
kubectl get nodes
\`\`\`

---

## Gerenciamento de Certificados

Os certificados do cluster ficam em \`/etc/kubernetes/pki/\` e tem validade de **1 ano** por padrao.

\`\`\`bash
# Verificar expiracao dos certificados
kubeadm certs check-expiration

# Renovar todos os certificados
kubeadm certs renew all

# Renovar certificado especifico
kubeadm certs renew apiserver
kubeadm certs renew etcd-server

# Listar certificados disponiveis para renovacao
kubeadm certs renew --help

# Apos renovar, reiniciar os componentes do control plane
# (Static Pods: basta deletar - o kubelet recria automaticamente)
kubectl delete pod -n kube-system kube-apiserver-<node>
kubectl delete pod -n kube-system kube-controller-manager-<node>
kubectl delete pod -n kube-system kube-scheduler-<node>

# Ou mover/restaurar os manifestos
mv /etc/kubernetes/manifests/kube-apiserver.yaml /tmp/
sleep 5
mv /tmp/kube-apiserver.yaml /etc/kubernetes/manifests/
\`\`\`

### Estrutura de Certificados

\`\`\`
/etc/kubernetes/pki/
├── apiserver.crt                    # Certificado do API Server
├── apiserver.key                    # Chave privada do API Server
├── apiserver-kubelet-client.crt     # Cliente do API Server → kubelet
├── apiserver-kubelet-client.key
├── apiserver-etcd-client.crt        # Cliente do API Server → etcd
├── apiserver-etcd-client.key
├── ca.crt                           # CA raiz do cluster
├── ca.key                           # Chave da CA raiz
├── front-proxy-ca.crt               # CA do front proxy
├── front-proxy-ca.key
├── front-proxy-client.crt           # Cliente do front proxy
├── front-proxy-client.key
├── sa.key                           # Chave privada p/ ServiceAccount tokens
├── sa.pub                           # Chave publica p/ verificar SA tokens
└── etcd/
    ├── ca.crt                       # CA do etcd (separada)
    ├── ca.key
    ├── server.crt                   # Certificado do servidor etcd
    ├── server.key
    ├── peer.crt                     # Certificado peer-to-peer do etcd
    ├── peer.key
    ├── healthcheck-client.crt       # Cliente para health check
    └── healthcheck-client.key
\`\`\`

### Certificados: O que cada um protege

| Certificado | Protege |
|-------------|---------|
| ca.crt/key | CA raiz - assina todos os outros certificados |
| apiserver.crt | Autenticacao do API Server (TLS) |
| apiserver-kubelet-client | API Server autenticando no kubelet |
| apiserver-etcd-client | API Server autenticando no etcd |
| etcd/ca.crt | CA separada para o etcd |
| etcd/server.crt | Servidor etcd (TLS) |
| etcd/peer.crt | Comunicacao entre membros do etcd (HA) |
| front-proxy-ca/client | Aggregation layer (API extensions) |
| sa.key/pub | Assinatura e verificacao de ServiceAccount tokens |

---

## Arquivos kubeconfig

\`\`\`bash
# Locais padrao dos kubeconfigs
/etc/kubernetes/admin.conf               # Admin (cluster-admin)
/etc/kubernetes/scheduler.conf           # kube-scheduler
/etc/kubernetes/controller-manager.conf  # controller-manager
/etc/kubernetes/kubelet.conf             # kubelet do control plane

# Kubeconfig do usuario
~/.kube/config

# Verificar contexto atual
kubectl config current-context

# Listar contextos
kubectl config get-contexts

# Trocar de contexto
kubectl config use-context <context-name>

# Ver configuracao completa
kubectl config view

# Ver com secrets (certificados) visiveis
kubectl config view --raw

# Mesclar multiplos kubeconfigs
KUBECONFIG=~/.kube/config:/tmp/another.conf kubectl config view --flatten > ~/.kube/merged.conf

# Definir namespace padrao para o contexto atual
kubectl config set-context --current --namespace=meu-namespace
\`\`\`

### Estrutura de um kubeconfig

\`\`\`yaml
apiVersion: v1
kind: Config
clusters:
- cluster:
    certificate-authority-data: <CA-cert-base64>
    server: https://192.168.1.100:6443
  name: kubernetes
contexts:
- context:
    cluster: kubernetes
    user: kubernetes-admin
    namespace: default     # namespace padrao (opcional)
  name: kubernetes-admin@kubernetes
current-context: kubernetes-admin@kubernetes
users:
- name: kubernetes-admin
  user:
    client-certificate-data: <cert-base64>
    client-key-data: <key-base64>
\`\`\`

---

## HA Control Plane

Para um control plane em alta disponibilidade sao necessarios:
- **Minimo 3 control planes** (para quorum do etcd)
- **Load balancer** na frente dos API Servers
- **Stacked** (etcd nos mesmos nodes) ou **External** (etcd separado)

\`\`\`bash
# Inicializar o primeiro control plane com endpoint compartilhado
kubeadm init \\
  --control-plane-endpoint "load-balancer:6443" \\
  --upload-certs \\
  --pod-network-cidr=10.244.0.0/16

# Adicionar segundo control plane
kubeadm join load-balancer:6443 \\
  --token <token> \\
  --discovery-token-ca-cert-hash sha256:<hash> \\
  --control-plane \\
  --certificate-key <cert-key>

# Adicionar terceiro control plane (mesmo comando)
\`\`\`

### Topologias HA

| Topologia | etcd | Vantagem | Desvantagem |
|-----------|------|----------|-------------|
| Stacked | Nos mesmos nodes do control plane | Simples, menos infra | Menos resiliente |
| External | Em nodes separados | Mais resiliente | Mais complexo |

---

## Static Pods

Os componentes do control plane rodam como **Static Pods**, gerenciados diretamente pelo kubelet (sem passar pelo API Server para criacao):

\`\`\`bash
# Localizacao dos manifestos de static pods
ls /etc/kubernetes/manifests/
# kube-apiserver.yaml
# kube-controller-manager.yaml
# kube-scheduler.yaml
# etcd.yaml

# O kubelet monitora esse diretorio e:
# - Cria pods quando arquivos sao adicionados
# - Recria pods quando arquivos sao modificados
# - Remove pods quando arquivos sao deletados

# Para modificar um componente, editar o manifesto diretamente
vi /etc/kubernetes/manifests/kube-apiserver.yaml
# O kubelet detecta a mudanca e reinicia o pod automaticamente

# Verificar static pods
kubectl get pods -n kube-system

# O diretorio e configurado no kubelet:
# --pod-manifest-path=/etc/kubernetes/manifests/
# Ou via config: staticPodPath: /etc/kubernetes/manifests/
\`\`\`

### Criar um Static Pod customizado

\`\`\`bash
# Static Pods podem ser criados por QUALQUER no (nao apenas control plane)
# Basta colocar o manifesto no diretorio de static pods do kubelet

# Exemplo: criar um static pod de nginx em um worker
cat <<EOF > /etc/kubernetes/manifests/static-nginx.yaml
apiVersion: v1
kind: Pod
metadata:
  name: static-nginx
  namespace: default
spec:
  containers:
  - name: nginx
    image: nginx:1.25
    ports:
    - containerPort: 80
EOF

# O static pod aparece no API Server como mirror pod:
kubectl get pods
# static-nginx-<node-name>

# Para remover, deletar o arquivo:
rm /etc/kubernetes/manifests/static-nginx.yaml
\`\`\`

---

## Kubeadm Phases

O \`kubeadm init\` pode ser executado em fases individuais para maior controle:

\`\`\`bash
# Listar todas as fases
kubeadm init phase --help

# Executar fases individualmente
kubeadm init phase preflight
kubeadm init phase certs all
kubeadm init phase kubeconfig all
kubeadm init phase control-plane all
kubeadm init phase etcd local
kubeadm init phase upload-config all
kubeadm init phase upload-certs --upload-certs
kubeadm init phase mark-control-plane
kubeadm init phase bootstrap-token
kubeadm init phase addon all

# Util para:
# - Regenerar apenas os certificados
# - Recriar apenas os kubeconfigs
# - Debug de problemas especificos
\`\`\`
`,

  quiz: [
    {
      question: 'Qual a ordem correta para fazer upgrade de um cluster Kubernetes gerenciado com kubeadm?',
      options: [
        'kubelet -> kubeadm -> kubectl -> kubeadm upgrade apply',
        'kubeadm -> kubeadm upgrade apply -> kubelet -> kubectl',
        'kubeadm upgrade apply -> kubeadm -> kubelet -> kubectl',
        'kubectl -> kubelet -> kubeadm -> kubeadm upgrade apply'
      ],
      correct: 1,
      explanation: 'A ordem correta e: primeiro atualizar o binario kubeadm, depois executar "kubeadm upgrade apply" (que atualiza os componentes do control plane), e por ultimo atualizar kubelet e kubectl. O kubelet precisa ser reiniciado apos a atualizacao com systemctl daemon-reload && systemctl restart kubelet.'
    },
    {
      question: 'Onde ficam os manifestos YAML dos componentes do control plane em um cluster gerenciado por kubeadm?',
      options: [
        '/etc/kubernetes/components/',
        '/var/lib/kubernetes/manifests/',
        '/etc/kubernetes/manifests/',
        '/usr/lib/kubernetes/static-pods/'
      ],
      correct: 2,
      explanation: 'Os componentes do control plane (kube-apiserver, kube-controller-manager, kube-scheduler e etcd) rodam como Static Pods cujos manifestos ficam em /etc/kubernetes/manifests/. O kubelet monitora esse diretorio e gerencia os pods automaticamente.'
    },
    {
      question: 'O token gerado pelo kubeadm init expirou (validade padrao de 24h). Como gerar um novo comando de join para workers?',
      options: [
        'kubeadm init --regenerate-token',
        'kubeadm token create --print-join-command',
        'kubectl token create --join',
        'kubeadm join --new-token'
      ],
      correct: 1,
      explanation: '"kubeadm token create --print-join-command" gera um novo token e imprime o comando completo de join, incluindo o token e o hash do certificado CA. Sem --print-join-command, apenas o token e criado.'
    },
    {
      question: 'Antes de fazer upgrade de um worker node, qual e o passo necessario no control plane?',
      options: [
        'kubectl taint nodes <node> NoSchedule',
        'kubectl drain <node> --ignore-daemonsets --delete-emptydir-data',
        'kubectl cordon <node> e depois kubectl evict --all',
        'kubeadm node prepare <node>'
      ],
      correct: 1,
      explanation: '"kubectl drain" remove os pods do node (exceto DaemonSets) e marca o node como unschedulable (cordon). O flag --ignore-daemonsets e necessario pois DaemonSets nao podem ser removidos. --delete-emptydir-data permite remover pods com volumes emptyDir.'
    },
    {
      question: 'Qual comando faz backup do etcd em um cluster kubeadm?',
      options: [
        'kubectl backup etcd /opt/backup.db',
        'kubeadm etcd backup --output=/opt/backup.db',
        'ETCDCTL_API=3 etcdctl snapshot save /opt/backup.db --endpoints=... --cacert=... --cert=... --key=...',
        'etcdctl backup --data-dir=/var/lib/etcd --backup-dir=/opt/backup'
      ],
      correct: 2,
      explanation: 'O backup do etcd e feito com "etcdctl snapshot save" usando a API v3. E obrigatorio fornecer os certificados TLS (--cacert, --cert, --key) e o endpoint (--endpoints). Os certificados ficam em /etc/kubernetes/pki/etcd/. O ETCDCTL_API=3 e necessario.'
    },
    {
      question: 'Qual e a diferenca entre "kubeadm upgrade apply" e "kubeadm upgrade node"?',
      options: [
        'Sao sinonimos, fazem a mesma coisa',
        '"apply" e usado no PRIMEIRO control plane (aplica o upgrade), "node" e usado nos workers e control planes adicionais',
        '"apply" atualiza o kubeadm, "node" atualiza o kubelet',
        '"node" e para HA, "apply" e para single-node'
      ],
      correct: 1,
      explanation: '"kubeadm upgrade apply vX.Y.Z" e usado apenas no PRIMEIRO control plane e atualiza os componentes do cluster. "kubeadm upgrade node" e usado nos workers e control planes adicionais (HA). O "node" nao precisa da versao como argumento.'
    },
    {
      question: 'Qual certificado e a CA raiz que assina todos os outros certificados do cluster?',
      options: [
        '/etc/kubernetes/pki/apiserver.crt',
        '/etc/kubernetes/pki/ca.crt',
        '/etc/kubernetes/pki/front-proxy-ca.crt',
        '/etc/kubernetes/pki/etcd/ca.crt'
      ],
      correct: 1,
      explanation: '/etc/kubernetes/pki/ca.crt e a CA raiz do cluster Kubernetes. Ela assina os certificados do apiserver, kubelet-client, etc. O etcd tem sua propria CA separada (/etc/kubernetes/pki/etcd/ca.crt). O front-proxy-ca e para a aggregation layer.'
    },
    {
      question: 'Qual comando verifica a data de expiracao de todos os certificados do cluster?',
      options: [
        'kubectl get certificates -n kube-system',
        'openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -dates',
        'kubeadm certs check-expiration',
        'kubeadm verify-certs --all'
      ],
      correct: 2,
      explanation: '"kubeadm certs check-expiration" lista todos os certificados do cluster com suas datas de expiracao em formato tabular. E o comando mais eficiente para verificar todos de uma vez. Os certificados tem validade de 1 ano por padrao.'
    },
    {
      question: 'O que e um Static Pod e como ele difere de um Pod normal?',
      options: [
        'E um Pod que nao pode ser movido entre nodes',
        'E um Pod gerenciado diretamente pelo kubelet via manifesto em disco, sem passar pelo scheduler. Aparece no API Server como mirror pod',
        'E um Pod com recursos fixos que nao podem ser alterados',
        'E um Pod criado pelo kubeadm que nao pode ser deletado'
      ],
      correct: 1,
      explanation: 'Static Pods sao gerenciados pelo kubelet a partir de manifestos YAML em /etc/kubernetes/manifests/. O kubelet cria, monitora e recria esses Pods automaticamente. Eles aparecem no API Server como "mirror pods" (somente leitura). Os componentes do control plane (apiserver, scheduler, controller-manager, etcd) rodam como Static Pods.'
    },
    {
      question: 'Apos restaurar o etcd de um backup, qual passo e essencial antes de mover o manifesto de volta?',
      options: [
        'Reiniciar o kubelet',
        'Atualizar o manifesto do etcd para apontar para o novo data-dir (--data-dir e hostPath do volume)',
        'Recriar todos os certificados',
        'Executar kubeadm upgrade apply'
      ],
      correct: 1,
      explanation: 'O etcdctl snapshot restore cria um novo diretorio de dados. E necessario atualizar o manifesto do etcd (/etc/kubernetes/manifests/etcd.yaml) para que o --data-dir e o hostPath do volume apontem para o novo diretorio. Sem isso, o etcd tentaria usar o diretorio antigo.'
    }
  ],

  flashcards: [
    {
      front: 'Quais sao as 6 fases do kubeadm init?',
      back: '1. Preflight checks (verifica requisitos)\n2. Gera certificados (/etc/kubernetes/pki/)\n3. Gera kubeconfigs (/etc/kubernetes/*.conf)\n4. Gera Static Pod manifests (/etc/kubernetes/manifests/)\n5. Bootstrap tokens e RBAC\n6. Instala addons (CoreDNS, kube-proxy)\n\nApos init, falta instalar o CNI (Flannel, Calico, Cilium)!'
    },
    {
      front: 'Qual a ordem dos passos para upgrade de um worker node com kubeadm?',
      back: '1. kubectl drain <node> (no control plane)\n2. Atualizar kubeadm no worker\n3. kubeadm upgrade node (no worker)\n4. Atualizar kubelet e kubectl no worker\n5. systemctl daemon-reload && systemctl restart kubelet\n6. kubectl uncordon <node> (no control plane)\n\nRepetir para cada worker, um de cada vez!'
    },
    {
      front: 'Como fazer backup e restore do etcd?',
      back: 'BACKUP:\nETCDCTL_API=3 etcdctl snapshot save /opt/backup.db \\\n  --endpoints=https://127.0.0.1:2379 \\\n  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\\n  --cert=/etc/kubernetes/pki/etcd/server.crt \\\n  --key=/etc/kubernetes/pki/etcd/server.key\n\nRESTORE:\n1. mv /etc/kubernetes/manifests/etcd.yaml /tmp/\n2. etcdctl snapshot restore backup.db --data-dir=/var/lib/etcd-new\n3. Atualizar data-dir no manifesto\n4. mv /tmp/etcd.yaml /etc/kubernetes/manifests/'
    },
    {
      front: 'Onde ficam os arquivos kubeconfig principais de um cluster kubeadm?',
      back: '/etc/kubernetes/admin.conf - acesso admin (cluster-admin)\n/etc/kubernetes/scheduler.conf - kube-scheduler\n/etc/kubernetes/controller-manager.conf - controller-manager\n/etc/kubernetes/kubelet.conf - kubelet\n~/.kube/config - kubeconfig do usuario atual\n\nPara usuario nao-root:\nmkdir -p $HOME/.kube\ncp -i /etc/kubernetes/admin.conf $HOME/.kube/config\nchown $(id -u):$(id -g) $HOME/.kube/config'
    },
    {
      front: 'O que sao Static Pods e onde seus manifestos ficam?',
      back: 'Static Pods sao pods gerenciados diretamente pelo kubelet, sem passar pelo API Server para criacao.\n\nManifestos em: /etc/kubernetes/manifests/\n\nO kubelet:\n- Cria pods quando arquivos sao adicionados\n- Recria pods quando modificados\n- Remove quando deletados\n\nComponentes do control plane rodam como Static Pods:\n- kube-apiserver.yaml\n- kube-controller-manager.yaml\n- kube-scheduler.yaml\n- etcd.yaml\n\nAparecem no API Server como "mirror pods" (read-only)'
    },
    {
      front: 'Como gerar um novo comando de join para workers se o token expirou?',
      back: 'kubeadm token create --print-join-command\n\nIsso gera um novo token (validade 24h por padrao) e imprime o comando completo:\nkubeadm join <host>:<port> \\\n  --token <new-token> \\\n  --discovery-token-ca-cert-hash sha256:<hash>\n\nOutros comandos uteis:\n- kubeadm token list (listar tokens ativos)\n- kubeadm token create --ttl 0 (token sem expiracao)'
    },
    {
      front: 'Qual e a validade padrao dos certificados e como renova-los?',
      back: 'Validade padrao: 1 ano (365 dias)\n\nVerificar: kubeadm certs check-expiration\nRenovar todos: kubeadm certs renew all\nRenovar especifico: kubeadm certs renew apiserver\n\nApos renovar, reiniciar componentes:\nkubectl delete pod -n kube-system kube-apiserver-<node>\nOu: mover e restaurar o manifesto\n\nO CA raiz (ca.crt) tem validade de 10 anos'
    },
    {
      front: 'Qual a diferenca entre kubectl cordon e kubectl drain?',
      back: 'kubectl cordon <node>:\n- Marca o node como SchedulingDisabled\n- Pods existentes continuam rodando\n- Novos pods nao sao agendados\n\nkubectl drain <node>:\n- Faz cordon automaticamente\n- TAMBEM remove (evicts) os pods existentes\n- Respeita PodDisruptionBudgets\n- Flags importantes:\n  --ignore-daemonsets\n  --delete-emptydir-data\n  --force (pods standalone)\n  --timeout=120s'
    },
    {
      front: 'Quais portas precisam estar abertas em um cluster Kubernetes?',
      back: 'CONTROL PLANE:\n- 6443: kube-apiserver\n- 2379-2380: etcd (client + peer)\n- 10250: kubelet API\n- 10259: kube-scheduler\n- 10257: kube-controller-manager\n\nWORKER NODES:\n- 10250: kubelet API\n- 30000-32767: NodePort Services\n\nTODOS:\n- Porta do CNI (Calico: 179 BGP, Flannel: 8472 VXLAN)'
    },
    {
      front: 'Regra de compatibilidade de versoes entre componentes do K8s?',
      back: 'Referencia: kube-apiserver = versao N\n\n- controller-manager: N ou N-1\n- scheduler: N ou N-1\n- kubelet: N, N-1 ou N-2\n- kubectl: N, N-1 ou N+1\n\nImplicacoes:\n1. Upgrade control plane PRIMEIRO\n2. Workers podem ficar 2 versoes minor atras\n3. kubectl pode ser 1 versao acima do server\n4. NUNCA kubelet mais novo que apiserver'
    }
  ],

  lab: {
    scenario: 'Voce precisa simular o processo de upgrade de um cluster Kubernetes de v1.30 para v1.31 em um ambiente com kubeadm. O cluster tem 1 control plane e 1 worker node. Voce tambem precisa verificar e renovar os certificados do cluster e fazer backup/restore do etcd.',
    objective: 'Executar o processo completo de upgrade de cluster usando kubeadm, incluindo drain/uncordon de nodes, renovacao de certificados e backup/restore do etcd.',
    steps: [
      {
        title: 'Verificar estado atual do cluster e planejar upgrade',
        instruction: 'Verifique a versao atual de todos os nos, liste os pods do kube-system, e execute o planejamento de upgrade para ver quais versoes estao disponiveis.',
        hints: [
          'kubectl get nodes mostra a versao do kubelet de cada node',
          'kubectl version mostra a versao do server e client',
          'kubeadm upgrade plan requer que o kubeadm esteja atualizado primeiro'
        ],
        solution: '```bash\n# Versao atual dos nodes\nkubectl get nodes\n\n# Versao do cluster\nkubectl version\n\n# Status dos pods do control plane\nkubectl get pods -n kube-system\n\n# Verificar versao do kubeadm\nkubeadm version\n\n# Plano de upgrade\nkubeadm upgrade plan\n```'
      },
      {
        title: 'Fazer backup do etcd antes do upgrade',
        instruction: 'Antes de qualquer upgrade, faca um backup do etcd. Encontre os certificados necessarios no manifesto do etcd e salve o snapshot em /opt/etcd-backup.db. Verifique o backup.',
        hints: [
          'Os parametros de certificado estao no manifesto /etc/kubernetes/manifests/etcd.yaml',
          'Use ETCDCTL_API=3 etcdctl snapshot save',
          'Verifique com etcdctl snapshot status'
        ],
        solution: '```bash\n# Encontrar parametros no manifesto\ncat /etc/kubernetes/manifests/etcd.yaml | grep -E "listen-client|cert-file|key-file|trusted-ca"\n\n# Fazer backup\nETCDCTL_API=3 etcdctl snapshot save /opt/etcd-backup.db \\\n  --endpoints=https://127.0.0.1:2379 \\\n  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\\n  --cert=/etc/kubernetes/pki/etcd/server.crt \\\n  --key=/etc/kubernetes/pki/etcd/server.key\n\n# Verificar o backup\nETCDCTL_API=3 etcdctl snapshot status /opt/etcd-backup.db --write-out=table\n```'
      },
      {
        title: 'Verificar e renovar certificados',
        instruction: 'Verifique a data de expiracao de todos os certificados do cluster. Se algum certificado estiver proximo de expirar (menos de 30 dias), renove-o.',
        hints: [
          'kubeadm certs check-expiration lista todos os certificados',
          'Para renovar: kubeadm certs renew all',
          'Apos renovar, reiniciar os componentes do control plane'
        ],
        solution: '```bash\n# Verificar expiracao de todos os certificados\nkubeadm certs check-expiration\n\n# Se necessario, renovar todos\nkubeadm certs renew all\n\n# Verificar a renovacao\nkubeadm certs check-expiration\n\n# Reiniciar componentes se certificados foram renovados\nkubectl delete pod -n kube-system kube-apiserver-$(hostname)\nkubectl delete pod -n kube-system kube-controller-manager-$(hostname)\nkubectl delete pod -n kube-system kube-scheduler-$(hostname)\n\n# Aguardar pods recriarem\nkubectl get pods -n kube-system -w\n```'
      },
      {
        title: 'Fazer upgrade do control plane',
        instruction: 'Atualize o binario do kubeadm para a versao alvo, aplique o upgrade no control plane e em seguida atualize kubelet e kubectl no control plane node.',
        hints: [
          'Use apt-mark unhold antes de atualizar e apt-mark hold depois',
          'kubeadm upgrade apply vX.Y.Z aplica o upgrade',
          'Sempre reinicie o kubelet apos atualizar'
        ],
        solution: '```bash\n# Desbloquear e atualizar kubeadm\napt-mark unhold kubeadm\napt-get update\napt-get install -y kubeadm=1.31.0-1.1\napt-mark hold kubeadm\n\n# Verificar versao do kubeadm\nkubeadm version\n\n# Aplicar upgrade no control plane\nkubeadm upgrade apply v1.31.0\n\n# Atualizar kubelet e kubectl\napt-mark unhold kubelet kubectl\napt-get install -y kubelet=1.31.0-1.1 kubectl=1.31.0-1.1\napt-mark hold kubelet kubectl\n\n# Reiniciar kubelet\nsystemctl daemon-reload\nsystemctl restart kubelet\n\n# Verificar\nkubectl get nodes\n```'
      },
      {
        title: 'Drenar e fazer upgrade do worker node',
        instruction: 'Do control plane, drene o worker node para evacuar os workloads. No worker, atualize kubeadm, aplique o upgrade, atualize kubelet e kubectl. Reabilite o node.',
        hints: [
          'kubectl drain precisa de --ignore-daemonsets',
          'kubeadm upgrade node (sem versao) aplica o upgrade no worker',
          'Nao esqueca kubectl uncordon no final'
        ],
        solution: '```bash\n# NO CONTROL PLANE: drenar o worker\nkubectl drain worker-node-1 \\\n  --ignore-daemonsets \\\n  --delete-emptydir-data\n\n# NO WORKER NODE: atualizar kubeadm\napt-mark unhold kubeadm\napt-get install -y kubeadm=1.31.0-1.1\napt-mark hold kubeadm\n\n# Aplicar upgrade no worker\nkubeadm upgrade node\n\n# Atualizar kubelet e kubectl\napt-mark unhold kubelet kubectl\napt-get install -y kubelet=1.31.0-1.1 kubectl=1.31.0-1.1\napt-mark hold kubelet kubectl\n\nsystemctl daemon-reload\nsystemctl restart kubelet\n\n# NO CONTROL PLANE: reabilitar o node\nkubectl uncordon worker-node-1\n\n# Verificar\nkubectl get nodes\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Node em estado NotReady apos upgrade do kubelet',
      symptom: 'Apos atualizar o kubelet em um node e reiniciar o servico, o node fica em estado "NotReady" por varios minutos. Os pods ficam em Pending ou Terminating.',
      diagnosis: '```bash\n# 1. Verificar status do kubelet no node afetado\nsystemctl status kubelet\njournalctl -u kubelet -n 50 --no-pager\n\n# 2. Verificar eventos do node\nkubectl describe node <node-name>\n\n# 3. Verificar condicoes do node\nkubectl get node <node-name> -o jsonpath=\'{.status.conditions}\' | python3 -m json.tool\n\n# 4. Verificar conectividade com o control plane\ncurl -k https://<control-plane-ip>:6443/healthz\n\n# 5. Verificar se o container runtime esta funcionando\nsystemctl status containerd\ncrictl ps\n```',
      solution: '```bash\n# Causa 1: kubelet nao reiniciado corretamente\nsystemctl daemon-reload\nsystemctl restart kubelet\nsystemctl status kubelet\n\n# Causa 2: versao do kubelet incompativel\n# kubelet nao pode ser mais de 2 versoes minor mais novo que o apiserver\nkubelet --version\nkubectl version\n\n# Causa 3: problema com o container runtime\nsystemctl restart containerd\nsystemctl restart kubelet\n\n# Causa 4: certificado do kubelet invalido\nkubeadm certs check-expiration\n# Se necessario, recriar o kubelet.conf\nkubeadm init phase kubeconfig kubelet\n\n# Causa 5: CNI nao funcional\n# Verificar pods do CNI\nkubectl get pods -n kube-system -l k8s-app=flannel\nkubectl get pods -n kube-system -l k8s-app=calico-node\n\n# Monitorar\nkubectl get nodes -w\n```'
    },
    {
      title: 'kubeadm upgrade apply falha com erro de conectividade ao etcd',
      symptom: 'Durante o "kubeadm upgrade apply", o processo falha com erro: "unable to upgrade control plane: could not connect to etcd: context deadline exceeded".',
      diagnosis: '```bash\n# 1. Verificar se o etcd esta funcionando\nkubectl get pods -n kube-system | grep etcd\n\n# 2. Verificar logs do etcd\nkubectl logs -n kube-system etcd-<node-name> --tail=50\n\n# 3. Verificar saude do etcd diretamente\nETCDCTL_API=3 etcdctl \\\n  --endpoints=https://127.0.0.1:2379 \\\n  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\\n  --cert=/etc/kubernetes/pki/etcd/healthcheck-client.crt \\\n  --key=/etc/kubernetes/pki/etcd/healthcheck-client.key \\\n  endpoint health\n\n# 4. Verificar disco disponivel (etcd precisa de espaco)\ndf -h /var/lib/etcd\n\n# 5. Verificar certificados do etcd\nkubeadm certs check-expiration | grep etcd\n```',
      solution: '```bash\n# Causa 1: etcd com problemas - reiniciar o static pod\nmv /etc/kubernetes/manifests/etcd.yaml /tmp/\nsleep 10\nmv /tmp/etcd.yaml /etc/kubernetes/manifests/\n\n# Aguardar etcd reiniciar\nkubectl get pods -n kube-system -w\n\n# Causa 2: certificados do etcd expirados\nkubeadm certs renew etcd-server\nkubeadm certs renew etcd-peer\nkubeadm certs renew etcd-healthcheck-client\nkubectl delete pod -n kube-system etcd-<node>\n\n# Causa 3: disco cheio\ndf -h /var/lib/etcd\n# Liberar espaco ou aumentar o disco\n# Compactar etcd se necessario\nETCDCTL_API=3 etcdctl compact $(etcdctl endpoint status -w json | jq \'.[0].Status.header.revision\')\nETCDCTL_API=3 etcdctl defrag\n\n# Tentar o upgrade novamente\nkubeadm upgrade apply v1.31.0\n```'
    },
    {
      title: 'Componente do control plane nao inicia apos editar o manifesto do Static Pod',
      symptom: 'Voce editou um manifesto em /etc/kubernetes/manifests/ (ex: kube-apiserver.yaml) e agora o componente nao inicia. O cluster pode ficar inacessivel via kubectl.',
      diagnosis: '```bash\n# Se kubectl nao funciona, verificar diretamente pelo kubelet:\njournalctl -u kubelet --since "5 minutes ago" | grep -i "error\\|failed\\|apiserver"\n\n# Verificar se o container do static pod existe\ncrictl ps -a | grep apiserver\n\n# Ver logs do container do static pod\ncrictl logs <container-id>\n\n# Verificar se o YAML e valido\n# (erros de sintaxe impedem o kubelet de carregar o manifesto)\ncat /etc/kubernetes/manifests/kube-apiserver.yaml | python3 -c "import yaml,sys; yaml.safe_load(sys.stdin)"\n\n# Verificar o arquivo para mudancas problematicas\ndiff /etc/kubernetes/manifests/kube-apiserver.yaml /etc/kubernetes/tmp/kube-apiserver.yaml.bak\n```',
      solution: '```bash\n# Causa 1: YAML invalido (syntax error)\n# Corrigir o YAML e o kubelet recria automaticamente\nvi /etc/kubernetes/manifests/kube-apiserver.yaml\n\n# Causa 2: Flag invalida ou argumento incorreto\n# Verificar as flags no campo .spec.containers[0].command\n# Remover ou corrigir a flag problematica\n\n# Causa 3: Volume mount incorreto (path nao existe)\n# Verificar hostPath volumes e criar diretorios necessarios\nmkdir -p /caminho/necessario\n\n# Causa 4: Restaurar backup do manifesto\n# Se voce salvou uma copia antes de editar:\ncp /etc/kubernetes/tmp/kube-apiserver.yaml.bak /etc/kubernetes/manifests/kube-apiserver.yaml\n\n# Se nao tem backup, recriar via kubeadm:\nkubeadm init phase control-plane apiserver\n# Isso recria o manifesto padrao\n\n# Aguardar componente reiniciar\nsleep 30\nkubectl get pods -n kube-system\nkubectl get nodes\n```'
    }
  ]
};
