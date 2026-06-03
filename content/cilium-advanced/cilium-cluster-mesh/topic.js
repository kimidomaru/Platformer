window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['cilium-advanced/cilium-cluster-mesh'] = {
  theory: `
# ClusterMesh — Multi-Cluster Networking com Cilium

## Relevancia
ClusterMesh conecta multiplos clusters Kubernetes com networking transparente, permitindo service discovery cross-cluster, shared services, failover e network policies entre clusters. Essencial para arquiteturas multi-cluster, disaster recovery e alta disponibilidade global.

## Conceitos Fundamentais

### O que e ClusterMesh?

\`\`\`
ClusterMesh = networking multi-cluster nativo do Cilium

Permite:
  - Pods de clusters diferentes se comunicarem diretamente
  - Service discovery cross-cluster (sem DNS externo)
  - Network policies entre clusters
  - Shared services (service em um cluster acessivel de outros)
  - Global services (service com backends em multiplos clusters)

Requisitos:
  - Todos os clusters com Cilium instalado
  - Pod CIDRs nao sobrepostos entre clusters
  - Conectividade de rede entre clusters (VPN, peering, etc.)
  - Cilium versao compativel entre clusters
\`\`\`

### Arquitetura

\`\`\`
┌─────────────────────┐     ┌─────────────────────┐
│     Cluster A        │     │     Cluster B        │
│                      │     │                      │
│  ┌────────────────┐  │     │  ┌────────────────┐  │
│  │ Cilium Agent   │  │     │  │ Cilium Agent   │  │
│  │ + ClusterMesh  │◄─┼─────┼─▶│ + ClusterMesh  │  │
│  └────────────────┘  │     │  └────────────────┘  │
│         │            │     │         │            │
│  ┌──────▼─────────┐  │     │  ┌──────▼─────────┐  │
│  │ clustermesh-   │  │     │  │ clustermesh-   │  │
│  │ apiserver      │◄─┼─────┼─▶│ apiserver      │  │
│  │ (etcd +        │  │     │  │ (etcd +        │  │
│  │  kvstoremesh)  │  │     │  │  kvstoremesh)  │  │
│  └────────────────┘  │     │  └────────────────┘  │
│                      │     │                      │
│  Pod CIDR:           │     │  Pod CIDR:           │
│  10.1.0.0/16         │     │  10.2.0.0/16         │
└─────────────────────┘     └─────────────────────┘
\`\`\`

**Componentes:**

| Componente | Funcao |
|-----------|--------|
| **clustermesh-apiserver** | Expoe o estado do cluster (services, endpoints, identities) para outros clusters |
| **KVStoreMesh** | Sincroniza dados entre etcds dos clustermesh-apiservers |
| **Cilium Agent** | Consome dados remotos e aplica routing/policies |

### Habilitando ClusterMesh

\`\`\`bash
# Cluster A
cilium clustermesh enable --service-type LoadBalancer
cilium clustermesh status

# Cluster B
cilium clustermesh enable --service-type LoadBalancer
cilium clustermesh status

# Conectar clusters
cilium clustermesh connect --destination-context cluster-b
cilium clustermesh status --wait
\`\`\`

### Global Services

\`\`\`yaml
# Service com backends em MULTIPLOS clusters
# Anote o Service com shared=true
apiVersion: v1
kind: Service
metadata:
  name: api-server
  namespace: production
  annotations:
    io.cilium/global-service: "true"
spec:
  selector:
    app: api-server
  ports:
    - port: 80
      targetPort: 8080
\`\`\`

\`\`\`
Global Service:
  - Service existe em ambos os clusters com MESMO nome e namespace
  - Annotation io.cilium/global-service: "true"
  - Cilium combina endpoints de ambos os clusters
  - Trafego e distribuido entre todos os backends (ambos clusters)

Modos:
  global (padrao):  trafego vai para qualquer cluster
  preferred-local:  prefere backends locais, fallback remoto
\`\`\`

### Shared Services (Affinity)

\`\`\`yaml
# Service acessivel de outros clusters
# mas com preferencia por backends locais
apiVersion: v1
kind: Service
metadata:
  name: cache-service
  namespace: production
  annotations:
    io.cilium/global-service: "true"
    io.cilium/service-affinity: "local"
spec:
  selector:
    app: redis
  ports:
    - port: 6379
\`\`\`

\`\`\`
Service Affinity:
  "local":   prefere backends do cluster local
             fallback para remoto se local indisponivel
  "remote":  prefere backends remotos
  "none":    sem preferencia (distribui entre todos)

Caso de uso:
  - Cache (Redis): affinity=local (evitar latencia cross-cluster)
  - API critica: affinity=none (distribuir carga)
  - DR: affinity=local com failover automatico
\`\`\`

### Network Policies Cross-Cluster

\`\`\`yaml
# Policy que permite trafego de pods em OUTRO cluster
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: allow-remote-cluster
  namespace: production
spec:
  endpointSelector:
    matchLabels:
      app: api-server
  ingress:
    - fromEndpoints:
        - matchLabels:
            app: frontend
            # Pods com esse label de QUALQUER cluster
            # sao permitidos (identity-based, cross-cluster)
\`\`\`

\`\`\`
Cross-cluster policies:
  - Identities sao sincronizadas entre clusters
  - Policies baseadas em labels funcionam cross-cluster
  - Nao precisa referenciar o cluster remoto explicitamente
  - eBPF aplica as policies de forma transparente
\`\`\`

### Disaster Recovery com ClusterMesh

\`\`\`
Cenario: Cluster A (primario) falha completamente

Com ClusterMesh + Global Services:
  1. Client resolve DNS → Service IP
  2. Service tem backends em Cluster A e B
  3. Cluster A falha → Cilium remove endpoints de A
  4. Todo trafego vai automaticamente para Cluster B
  5. Cluster A volta → endpoints sao re-adicionados
  6. Trafego e redistribuido

Tempo de failover:
  - Deteccao: segundos (health check)
  - Convergencia: < 30 segundos
  - Sem intervencao manual
  - Sem mudanca de DNS
\`\`\`

### Requisitos e Limitacoes

\`\`\`
Requisitos:
  ✓ Pod CIDRs nao sobrepostos entre clusters
  ✓ Conectividade de rede (VPN, VPC peering, direct connect)
  ✓ Cilium mesma versao ou compativel
  ✓ Cluster names unicos
  ✓ Identidades compartilhadas

Limitacoes:
  ✗ Cada cluster precisa de seu proprio control plane
  ✗ Pod CIDRs devem ser planejados antecipadamente
  ✗ Latencia cross-cluster afeta performance
  ✗ Maximo recomendado: ~255 clusters
  ✗ Necessita de conectividade confiavel entre clusters
\`\`\`

## Comandos Essenciais

\`\`\`bash
# Status do ClusterMesh
cilium clustermesh status
cilium clustermesh status --wait

# Habilitar
cilium clustermesh enable --service-type LoadBalancer

# Conectar clusters
cilium clustermesh connect --destination-context <context>

# Desconectar
cilium clustermesh disconnect --destination-context <context>

# Verificar services globais
kubectl get svc -A -o json | jq '.items[] | select(.metadata.annotations["io.cilium/global-service"]=="true") | .metadata.name'

# Verificar endpoints remotos
cilium service list
cilium bpf lb list

# Verificar identidades remotas
cilium identity list | grep remote
\`\`\`

## Erros Comuns

1. **Pod CIDR overlap**: CIDRs sobrepostos entre clusters causam conflitos de roteamento. Planeje CIDRs antes de criar os clusters.
2. **Conectividade entre clusters**: ClusterMesh requer conectividade entre nodes. Verifique VPN/peering/firewall.
3. **Versao incompativel**: Cilium de versoes muito diferentes pode ter problemas de compatibilidade no ClusterMesh. Mantenha versoes proximas.
4. **Service nao sincroniza**: Verifique que clustermesh-apiserver esta rodando e conectado em ambos os clusters.
5. **Latencia alta em cross-cluster**: Use service-affinity=local para preferir backends locais e reduzir trafego cross-cluster.

## Killer.sh Style Challenge

**Cenario:** Configure ClusterMesh entre dois clusters e crie global services com failover automatico.

**Tarefas:**
1. Habilite ClusterMesh em ambos os clusters
2. Conecte os clusters
3. Crie um global service com backends em ambos os clusters
4. Configure service affinity para preferir backends locais
5. Simule falha de um cluster e valide failover
`,
  quiz: [
    {
      question: 'O que e ClusterMesh no Cilium?',
      options: [
        'Um tool para instalar Cilium em multiplos clusters',
        'Networking multi-cluster nativo que permite comunicacao transparente entre pods, service discovery cross-cluster, global services e network policies entre clusters',
        'Um service mesh como Istio',
        'Um sistema de backup entre clusters'
      ],
      correct: 1,
      explanation: 'ClusterMesh conecta multiplos clusters Kubernetes com Cilium, permitindo pods se comunicarem diretamente, services terem backends em multiplos clusters (global services), policies cross-cluster usando identidades sincronizadas, e failover automatico.',
      reference: 'Conceito relacionado: cilium-architecture — ClusterMesh estende o modelo de identity para multi-cluster.'
    },
    {
      question: 'Qual requisito e CRITICO para ClusterMesh funcionar?',
      options: [
        'Clusters devem estar no mesmo cloud provider',
        'Pod CIDRs NAO podem se sobrepor entre clusters, e deve haver conectividade de rede entre eles',
        'Todos os clusters devem ter o mesmo numero de nodes',
        'Clusters devem usar o mesmo namespace para tudo'
      ],
      correct: 1,
      explanation: 'Pod CIDRs sobrepostos causam conflitos de roteamento — cada cluster DEVE ter um range unico. Alem disso, os nodes precisam de conectividade de rede (VPN, VPC peering, direct connect) para trocar trafego. Cluster names tambem devem ser unicos.',
      reference: 'Conceito relacionado: cilium-cluster-mesh — planeje CIDRs antes de criar os clusters.'
    },
    {
      question: 'O que e um Global Service no ClusterMesh?',
      options: [
        'Um service disponivel na internet',
        'Um service com annotation io.cilium/global-service=true que combina endpoints de multiplos clusters, distribuindo trafego entre todos os backends',
        'Um service com NodePort global',
        'Um service que roda em todos os namespaces'
      ],
      correct: 1,
      explanation: 'Global Service e um Service que existe em multiplos clusters com o mesmo nome e namespace, anotado com io.cilium/global-service: "true". Cilium sincroniza endpoints de todos os clusters e distribui trafego entre eles. Ideal para HA e load distribution.',
      reference: 'Conceito relacionado: cilium-cluster-mesh — global services habilitam DR automatico.'
    },
    {
      question: 'O que faz a annotation io.cilium/service-affinity: "local"?',
      options: [
        'Bloqueia trafego de outros clusters',
        'Faz o service preferir backends do cluster LOCAL, usando backends remotos apenas como fallback quando nao ha backends locais disponiveis',
        'Forca todo trafego para o cluster remoto',
        'Desabilita o global service'
      ],
      correct: 1,
      explanation: 'service-affinity: "local" prioriza backends do cluster onde o pod cliente esta. Se os backends locais ficam indisponiveis, o trafego faz fallback automatico para backends remotos. Ideal para cache (evitar latencia) e DR (failover automatico).',
      reference: 'Conceito relacionado: cilium-cluster-mesh — affinity "local" reduz latencia cross-cluster.'
    },
    {
      question: 'Como funciona o failover automatico com ClusterMesh?',
      options: [
        'Requer mudanca manual de DNS',
        'Quando um cluster falha, Cilium remove seus endpoints do global service automaticamente, e todo trafego vai para backends dos clusters saudaveis — sem intervencao manual',
        'Precisa de um load balancer externo',
        'O failover leva horas para convergir'
      ],
      correct: 1,
      explanation: 'Com global services, Cilium monitora health dos backends em todos os clusters. Quando um cluster falha, seus endpoints sao removidos automaticamente (segundos). O trafego converge para clusters saudaveis em < 30s. Sem mudanca de DNS, sem intervencao manual.',
      reference: 'Conceito relacionado: sre-incident-mgmt — ClusterMesh reduz MTTR para falhas de cluster.'
    },
    {
      question: 'Como network policies funcionam entre clusters no ClusterMesh?',
      options: [
        'Nao funcionam — policies sao apenas locais',
        'Identidades sao sincronizadas entre clusters, entao policies baseadas em labels funcionam automaticamente para pods de qualquer cluster',
        'Precisam de IPs hardcoded dos outros clusters',
        'Precisam de policies separadas por cluster'
      ],
      correct: 1,
      explanation: 'ClusterMesh sincroniza identidades (baseadas em labels) entre clusters. CiliumNetworkPolicies que usam endpointSelector/fromEndpoints com labels funcionam para pods de qualquer cluster — nao precisa referenciar o cluster remoto. eBPF aplica policies transparentemente.',
      reference: 'Conceito relacionado: cilium-network-policies — identity-based policies sao cross-cluster.'
    },
    {
      question: 'Qual componente e responsavel por expor o estado do cluster para outros clusters?',
      options: [
        'Cilium Operator',
        'clustermesh-apiserver — expoe services, endpoints e identidades para consumo por clusters remotos, usando etcd e KVStoreMesh para sincronizacao',
        'kube-apiserver',
        'CoreDNS'
      ],
      correct: 1,
      explanation: 'clustermesh-apiserver e um componente dedicado que roda em cada cluster e expoe seu estado (services, endpoints, identities) via etcd/gRPC. KVStoreMesh sincroniza esses dados entre os clustermesh-apiservers dos diferentes clusters.',
      reference: 'Conceito relacionado: cilium-cluster-mesh — apiserver precisa estar acessivel entre clusters.'
    }
  ],
  flashcards: [
    {
      front: 'O que e ClusterMesh e o que permite?',
      back: '**ClusterMesh:**\nNetworking multi-cluster\nnativo do Cilium\n\n**Permite:**\n- Pods cross-cluster se comunicam\n- Service discovery cross-cluster\n- Global services (backends multi-cluster)\n- Network policies entre clusters\n- Failover automatico\n\n**Requisitos:**\n- Pod CIDRs nao sobrepostos\n- Conectividade entre clusters\n- Cilium versao compativel\n- Cluster names unicos\n\n**Habilitar:**\n```bash\ncilium clustermesh enable\ncilium clustermesh connect \\\n  --destination-context cluster-b\n```'
    },
    {
      front: 'Global Services?',
      back: '**Service com backends\nem MULTIPLOS clusters:**\n```yaml\nmetadata:\n  annotations:\n    io.cilium/global-service: \"true\"\n```\n\n**Requisitos:**\n- Mesmo nome e namespace\n  em ambos clusters\n- Annotation global-service\n\n**Modos de affinity:**\n- **none**: sem preferencia\n  (distribui entre todos)\n- **local**: prefere local\n  (fallback remoto)\n- **remote**: prefere remoto\n\n**Affinity local:**\n```yaml\nannotations:\n  io.cilium/global-service: \"true\"\n  io.cilium/service-affinity: \"local\"\n```'
    },
    {
      front: 'Failover automatico com ClusterMesh?',
      back: '**Cenario:**\nCluster A falha completamente\n\n**Fluxo automatico:**\n1. Health check detecta falha\n2. Endpoints do Cluster A removidos\n3. Trafego → Cluster B automaticamente\n4. Cluster A volta → re-adicionado\n5. Trafego redistribuido\n\n**Tempo:**\n- Deteccao: segundos\n- Convergencia: < 30s\n- Sem DNS change\n- Sem intervencao manual\n\n**Ideal para:**\n- Disaster Recovery\n- Alta disponibilidade\n- Blue/green entre clusters\n- Geographic distribution'
    },
    {
      front: 'Network Policies cross-cluster?',
      back: '**Como funciona:**\n- Identidades sincronizadas\n  entre clusters\n- Labels-based policies\n  funcionam cross-cluster\n- Nao precisa referenciar\n  cluster remoto\n\n**Exemplo:**\n```yaml\napiVersion: cilium.io/v2\nkind: CiliumNetworkPolicy\nspec:\n  endpointSelector:\n    matchLabels:\n      app: api-server\n  ingress:\n    - fromEndpoints:\n        - matchLabels:\n            app: frontend\n            # funciona para pods\n            # de QUALQUER cluster!\n```\n\n**eBPF aplica transparentemente**'
    },
    {
      front: 'Arquitetura do ClusterMesh?',
      back: '**clustermesh-apiserver:**\n- Roda em cada cluster\n- Expoe estado (services,\n  endpoints, identities)\n- Usa etcd interno\n\n**KVStoreMesh:**\n- Sincroniza dados entre\n  clustermesh-apiservers\n\n**Cilium Agent:**\n- Consome dados remotos\n- Aplica routing e policies\n\n**Requisitos de rede:**\n- Porta 2379 (etcd) entre\n  clustermesh-apiservers\n- Pod-to-pod connectivity\n  entre clusters\n\n**Limite:**\n~255 clusters recomendado'
    },
    {
      front: 'Comandos essenciais ClusterMesh?',
      back: '**Habilitar:**\n```bash\ncilium clustermesh enable \\\n  --service-type LoadBalancer\n```\n\n**Conectar:**\n```bash\ncilium clustermesh connect \\\n  --destination-context cluster-b\n```\n\n**Status:**\n```bash\ncilium clustermesh status\ncilium clustermesh status --wait\n```\n\n**Verificar:**\n```bash\n# Services globais\nkubectl get svc -A -o json | \\\n  jq \'.items[] | select(\n    .metadata.annotations[\n      \"io.cilium/global-service\"\n    ]==\"true\"\n  )\'\n\n# Endpoints remotos\ncilium service list\n```'
    }
  ],
  lab: {
    scenario: 'Voce precisa configurar ClusterMesh entre dois clusters e criar global services com failover automatico.',
    objective: 'Habilitar ClusterMesh, conectar clusters, criar global service e testar failover.',
    duration: '25-30 minutos',
    steps: [
      {
        title: 'Habilitar ClusterMesh',
        instruction: `Habilite ClusterMesh em ambos os clusters.

\`\`\`bash
# No contexto do Cluster A
kubectl config use-context cluster-a
cilium clustermesh enable --service-type LoadBalancer

# No contexto do Cluster B
kubectl config use-context cluster-b
cilium clustermesh enable --service-type LoadBalancer

# Verificar status em ambos
kubectl config use-context cluster-a
cilium clustermesh status
kubectl config use-context cluster-b
cilium clustermesh status
\`\`\``,
        hints: [
          'service-type pode ser LoadBalancer, NodePort ou ClusterIP (depende do ambiente)',
          'Cada cluster precisa de um cluster name unico',
          'Pod CIDRs NAO podem se sobrepor entre clusters'
        ],
        solution: `\`\`\`bash
# Cluster A
kubectl config use-context cluster-a
cilium clustermesh enable --service-type LoadBalancer

# Cluster B
kubectl config use-context cluster-b
cilium clustermesh enable --service-type LoadBalancer
\`\`\``,
        verify: `\`\`\`bash
# Verificar em ambos os clusters
cilium clustermesh status
# Saida esperada: ClusterMesh is enabled
#                  Service Type: LoadBalancer

kubectl get pods -n kube-system -l app.kubernetes.io/name=clustermesh-apiserver
# Saida esperada: clustermesh-apiserver-xxxxx Running
\`\`\``
      },
      {
        title: 'Conectar Clusters',
        instruction: `Conecte os dois clusters usando cilium clustermesh connect.

\`\`\`bash
# Do Cluster A, conectar ao Cluster B
kubectl config use-context cluster-a
cilium clustermesh connect --destination-context cluster-b

# Aguardar conexao
cilium clustermesh status --wait

# Verificar que ambos os clusters se veem
cilium clustermesh status
\`\`\``,
        hints: [
          'O connect precisa de acesso ao kubeconfig de ambos os clusters',
          'A conexao e bidirecional — basta conectar de um lado',
          'Use --wait para bloquear ate a conexao ser estabelecida'
        ],
        solution: `\`\`\`bash
kubectl config use-context cluster-a
cilium clustermesh connect --destination-context cluster-b
cilium clustermesh status --wait
\`\`\``,
        verify: `\`\`\`bash
cilium clustermesh status
# Saida esperada: Cluster: cluster-b
#                  Status: Connected
#                  Nodes: X
#                  Identities: X (synced)
\`\`\``
      },
      {
        title: 'Criar Global Service',
        instruction: `Crie um deployment e service global em ambos os clusters.

\`\`\`bash
# Em ambos os clusters, criar o mesmo deployment e service
for ctx in cluster-a cluster-b; do
  kubectl config use-context \$ctx
  kubectl create namespace global-demo
  kubectl create deployment web --image=nginx -n global-demo
  kubectl apply -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: web
  namespace: global-demo
  annotations:
    io.cilium/global-service: "true"
    io.cilium/service-affinity: "local"
spec:
  selector:
    app: web
  ports:
    - port: 80
      targetPort: 80
EOF
done
\`\`\``,
        hints: [
          'O Service deve ter MESMO nome e namespace em ambos clusters',
          'A annotation global-service: true e obrigatoria',
          'service-affinity: local faz preferir backends do cluster local'
        ],
        solution: `\`\`\`bash
# Em cada cluster:
kubectl create namespace global-demo
kubectl create deployment web --image=nginx -n global-demo
kubectl expose deployment web --port=80 -n global-demo
kubectl annotate svc web -n global-demo io.cilium/global-service=true
kubectl annotate svc web -n global-demo io.cilium/service-affinity=local
\`\`\``,
        verify: `\`\`\`bash
# Verificar service global
kubectl get svc web -n global-demo -o jsonpath='{.metadata.annotations}'
# Saida esperada: annotations com global-service: true

# Verificar endpoints incluem remotos
cilium service list | grep global-demo
# Saida esperada: service com backends locais E remotos
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'ClusterMesh nao conecta entre clusters',
      difficulty: 'hard',
      symptom: 'cilium clustermesh status mostra o cluster remoto como "not connected". Services globais nao funcionam.',
      diagnosis: `\`\`\`bash
# Verificar status detalhado
cilium clustermesh status

# Verificar clustermesh-apiserver
kubectl get pods -n kube-system -l app.kubernetes.io/name=clustermesh-apiserver
kubectl logs -n kube-system -l app.kubernetes.io/name=clustermesh-apiserver --tail=30

# Verificar conectividade
kubectl exec -n kube-system <cilium-pod> -- curl -k https://<remote-apiserver-ip>:2379/health

# Verificar secrets de conexao
kubectl get secrets -n kube-system | grep clustermesh
\`\`\``,
      solution: `**Causas comuns:**

1. **Firewall bloqueando porta 2379:** clustermesh-apiserver usa etcd na porta 2379. Abra entre clusters.

2. **Service nao acessivel:** Se usando LoadBalancer, verifique que o IP externo esta acessivel do outro cluster:
\`\`\`bash
kubectl get svc clustermesh-apiserver -n kube-system
\`\`\`

3. **Certificados expirados:** Reconecte os clusters:
\`\`\`bash
cilium clustermesh disconnect --destination-context <remote>
cilium clustermesh connect --destination-context <remote>
\`\`\`

4. **Cluster names duplicados:** Cada cluster DEVE ter nome unico. Verifique com cilium config view | grep cluster-name.`
    },
    {
      title: 'Global Service nao mostra endpoints remotos',
      difficulty: 'medium',
      symptom: 'Service anotado como global-service: true mas cilium service list mostra apenas endpoints locais.',
      diagnosis: `\`\`\`bash
# Verificar annotations
kubectl get svc <name> -n <ns> -o jsonpath='{.metadata.annotations}'

# Verificar ClusterMesh conectado
cilium clustermesh status

# Verificar service existe no cluster remoto
# (trocar de contexto)
kubectl config use-context <remote-cluster>
kubectl get svc <name> -n <ns>
kubectl get endpoints <name> -n <ns>

# Verificar identidades remotas
cilium identity list | grep remote
\`\`\``,
      solution: `**Solucoes:**

1. **Service com mesmo nome/namespace:** O service DEVE ter exatamente o mesmo nome e namespace em ambos os clusters.

2. **Annotation correta:** Verifique que e io.cilium/global-service (nao io.cilium.global-service):
\`\`\`bash
kubectl annotate svc <name> -n <ns> io.cilium/global-service=true --overwrite
\`\`\`

3. **Endpoints existem no remoto:** Verifique que o deployment remoto tem pods running:
\`\`\`bash
kubectl get pods -n <ns> -l app=<label> --context <remote>
\`\`\`

4. **Aguardar sincronizacao:** Pode levar alguns segundos para endpoints remotos aparecerem.`
    },
    {
      title: 'Pod CIDR overlap entre clusters',
      difficulty: 'easy',
      symptom: 'Apos conectar ClusterMesh, pods de um cluster nao conseguem acessar pods do outro. Conflitos de roteamento.',
      diagnosis: `\`\`\`bash
# Verificar CIDRs em cada cluster
kubectl get nodes -o jsonpath='{.items[*].spec.podCIDR}'

# Verificar IPAM do Cilium
cilium config view | grep cluster-pool

# Verificar sobreposicao
# Se Cluster A usa 10.0.0.0/16 e Cluster B tambem → OVERLAP!
\`\`\``,
      solution: `**Este e um problema de planejamento — nao pode ser corrigido facilmente apos a criacao dos clusters.**

**Prevencao:**
Planeje CIDRs antes de criar clusters:
\`\`\`
Cluster A: 10.1.0.0/16  (pods)  10.96.0.0/16  (services)
Cluster B: 10.2.0.0/16  (pods)  10.97.0.0/16  (services)
Cluster C: 10.3.0.0/16  (pods)  10.98.0.0/16  (services)
\`\`\`

**Se ja tem overlap:**
A unica solucao e recriar o cluster com CIDR diferente. Nao ha como mudar o pod CIDR de um cluster existente sem disrupcao significativa.

**Ferramenta:**
Use Cilium com IPAM multi-pool para planejar CIDRs desde o inicio.`
    }
  ]
};
