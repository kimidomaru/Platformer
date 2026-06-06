window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['cilium-advanced/cilium-egress-gateway'] = {
  theory: `# Cilium Egress Gateway: IP de Saida Estavel

## Relevancia
> Sistemas externos legados — firewalls, bancos de dados, APIs de SaaS — frequentemente fazem **allowlist por IP de origem**. Mas IPs de Pod sao **efemeros** e mudam a cada reschedule. O **Egress Gateway** do Cilium resolve isso roteando o trafego de saida de Pods selecionados por um node-gateway, aplicando **SNAT** para um **IP fixo e previsivel**. E um requisito enterprise classico (integracao com o "mundo de fora").

## O problema

\`\`\`
Sem Egress Gateway:
  Pod (IP 10.0.3.47)  ----->  SNAT pelo node onde caiu  ----->  Firewall externo
  Pod reschedulado    ----->  outro node, outro IP       ----->  BLOQUEADO (IP nao allowlisted)

Com Egress Gateway:
  Pods selecionados   ----->  node-gateway (SNAT p/ 192.0.2.10)  ----->  Firewall (allowlist 192.0.2.10) OK
\`\`\`

Sem um IP de saida estavel, voce teria que liberar a faixa inteira de nodes no firewall — inseguro e fragil.

## Pre-requisitos

O Egress Gateway depende do datapath eBPF de mascaramento:

\`\`\`bash
helm upgrade cilium cilium/cilium -n kube-system \\
  --set egressGateway.enabled=true \\
  --set kubeProxyReplacement=true \\
  --set bpf.masquerade=true

kubectl -n kube-system rollout restart ds/cilium
\`\`\`

> Requer **kube-proxy replacement** e **BPF masquerade** habilitados. Sem eles, a policy nao tem efeito.

## CiliumEgressGatewayPolicy

A CRD seleciona **quais Pods**, para **quais destinos**, devem sair por **qual gateway/IP**.

\`\`\`yaml
apiVersion: cilium.io/v2
kind: CiliumEgressGatewayPolicy
metadata:
  name: db-egress
spec:
  # 1. Quais Pods? (por namespace/labels)
  selectors:
    - podSelector:
        matchLabels:
          app: payments
          io.kubernetes.pod.namespace: production
  # 2. Para quais destinos externos?
  destinationCIDRs:
    - "203.0.113.0/24"          # rede do banco de dados legado
  # 3. Por qual gateway e com qual IP de saida?
  egressGateway:
    nodeSelector:
      matchLabels:
        egress-node: "true"     # node(s) marcados como gateway
    egressIP: "192.0.2.10"       # IP fixo que o mundo externo vera (SNAT)
\`\`\`

\`\`\`bash
# Marcar o node-gateway
kubectl label node node-egress-1 egress-node=true

kubectl apply -f db-egress.yaml
\`\`\`

### Os 3 ingredientes da policy
| Campo | Define |
|-------|--------|
| \`selectors.podSelector\` | quais Pods de origem |
| \`destinationCIDRs\` | para quais redes externas a regra vale |
| \`egressGateway.nodeSelector\` + \`egressIP\` | por qual node sair e com qual IP (SNAT) |

> So o trafego dos Pods selecionados **com destino aos CIDRs listados** e desviado pelo gateway. Todo o resto sai normalmente. Isso evita criar um gargalo para todo o trafego.

## Validando

\`\`\`bash
# 1. Do Pod selecionado, bater num servico que ecoa o IP de origem
kubectl exec -n production deploy/payments -- curl -s https://ifconfig.me
# Esperado: 192.0.2.10 (o egressIP), nao o IP do node

# 2. Ver o mapeamento de egress no agente Cilium
kubectl exec -n kube-system ds/cilium -- cilium-dbg bpf egress list

# 3. Conferir a policy
kubectl get ciliumegressgatewaypolicy db-egress -o yaml
\`\`\`

## Alta disponibilidade

O node-gateway e um ponto de passagem. Se ele cair, o trafego desviado para os CIDRs para. Estrategias:

- **Multiplos nodes gateway** com o mesmo label e um \`egressIP\` que possa flutuar (VIP gerenciado externamente, ex.: via cloud ou keepalived).
- Versoes recentes do Cilium suportam **HA de egress gateway** (failover entre nodes elegiveis).
- Monitorar a saude do node-gateway e ter alarme — a falha e silenciosa do ponto de vista do Pod (apenas timeouts para aquele destino).

## Quando usar (e quando nao)

| Use | Nao use |
|-----|---------|
| Integrar com firewall/SaaS que filtra por IP de origem | Para todo o trafego de saida do cluster |
| Dar IP estavel a um conjunto especifico de Pods | Quando o destino nao se importa com o IP de origem |
| Compliance que exige origem previsivel | Como substituto de NetworkPolicy (sao coisas diferentes) |

## Erros Comuns

1. **Esquecer os pre-requisitos** (kube-proxy replacement + bpf.masquerade) — a policy nao surte efeito.
2. **Nenhum node com o label do nodeSelector** — sem gateway elegivel, o trafego nao e desviado.
3. **destinationCIDRs largo demais** (ex.: 0.0.0.0/0) — manda TODO o egress pelo gateway, criando gargalo.
4. **egressIP nao roteavel/atribuivel** ao node-gateway — o SNAT falha; o IP precisa pertencer/ser anunciavel pelo node.
5. **Confundir com NetworkPolicy** — egress gateway controla o IP de SAIDA; NetworkPolicy controla se a conexao e permitida.

## Killer.sh Style Challenge

> Um banco de dados externo em \`203.0.113.5\` so aceita conexoes do IP \`192.0.2.10\`.
>
> 1. Habilite o egress gateway no Cilium (com os pre-requisitos).
> 2. Marque um node como gateway com \`egress-node=true\`.
> 3. Crie uma CiliumEgressGatewayPolicy para que os Pods \`app=payments\` do namespace \`production\` saiam com \`egressIP: 192.0.2.10\` ao acessar \`203.0.113.0/24\`.
> 4. Valide do Pod que o IP de origem visto externamente e \`192.0.2.10\`.
>
> Dica: \`curl ifconfig.me\` de dentro do Pod e \`cilium-dbg bpf egress list\`.
`,

  quiz: [
    {
      question: 'Qual problema o Cilium Egress Gateway resolve?',
      options: [
        'Balanceamento de carga de Ingress',
        'Dar um IP de SAIDA estavel e previsivel a Pods selecionados, para integrar com sistemas externos que fazem allowlist por IP de origem',
        'Criptografar o trafego pod-a-pod',
        'Substituir o CoreDNS'
      ],
      correct: 1,
      explanation: 'IPs de Pod sao efemeros; sistemas externos (firewalls, SaaS, bancos legados) que filtram por IP de origem nao funcionam com isso. O Egress Gateway roteia o egress dos Pods selecionados por um node-gateway e faz SNAT para um egressIP fixo, que o mundo externo pode colocar em allowlist.',
      reference: 'Secoes O problema e CiliumEgressGatewayPolicy.'
    },
    {
      question: 'Quais sao os 3 ingredientes essenciais de uma CiliumEgressGatewayPolicy?',
      options: [
        'replicas, image e port',
        'podSelector (origem), destinationCIDRs (destinos) e egressGateway nodeSelector+egressIP (por onde/que IP)',
        'host, path e tls',
        'minReplicas, maxReplicas e targetCPU'
      ],
      correct: 1,
      explanation: 'A policy define: quais Pods (selectors.podSelector), para quais redes externas a regra vale (destinationCIDRs) e por qual node sair com qual IP de SNAT (egressGateway.nodeSelector + egressIP). So o trafego dos Pods selecionados com destino aos CIDRs e desviado.',
      reference: 'Secao Os 3 ingredientes da policy.'
    },
    {
      question: 'Quais pre-requisitos o Egress Gateway exige no Cilium?',
      options: [
        'Apenas Hubble habilitado',
        'kube-proxy replacement e BPF masquerade habilitados',
        'IPsec habilitado',
        'Gateway API instalada'
      ],
      correct: 1,
      explanation: 'O datapath do Egress Gateway depende do mascaramento eBPF: e necessario kubeProxyReplacement=true e bpf.masquerade=true. Sem esses pre-requisitos, a CiliumEgressGatewayPolicy nao surte efeito.',
      reference: 'Secao Pre-requisitos.'
    },
    {
      question: 'Por que definir destinationCIDRs como 0.0.0.0/0 e geralmente uma ma ideia?',
      options: [
        'Porque o Cilium rejeita esse valor',
        'Porque desvia TODO o trafego de saida do cluster pelo node-gateway, criando um gargalo e ponto unico de falha',
        'Porque so funciona com IPv6',
        'Porque desabilita o DNS'
      ],
      correct: 1,
      explanation: 'O egress gateway so deve desviar o trafego que realmente precisa de IP estavel (os CIDRs dos sistemas externos especificos). Usar 0.0.0.0/0 manda todo o egress por um unico node, concentrando banda e criando um ponto unico de falha desnecessario.',
      reference: 'Secao Erros Comuns (item 3) e Quando usar.'
    },
    {
      question: 'Como validar que um Pod selecionado esta saindo com o egressIP correto?',
      options: [
        'kubectl get pods -o wide',
        'Do Pod, acessar um servico que ecoa o IP de origem (ex.: curl ifconfig.me) e confirmar que retorna o egressIP',
        'kubectl describe node',
        'Verificar o numero de replicas'
      ],
      correct: 1,
      explanation: 'A validacao pratica e fazer o Pod selecionado bater em um servico que devolve o IP de origem visto externamente (curl ifconfig.me / ifconfig.co). Deve retornar o egressIP (ex.: 192.0.2.10), nao o IP do node. cilium-dbg bpf egress list mostra o mapeamento no datapath.',
      reference: 'Secao Validando.'
    },
    {
      question: 'O que acontece com o trafego desviado se o unico node-gateway cair?',
      options: [
        'O trafego automaticamente sai por qualquer node sem SNAT',
        'O trafego para aqueles destinos para (timeouts) ate haver failover; por isso recomenda-se HA/multiplos gateways',
        'Os Pods sao reiniciados',
        'O Cilium desabilita a policy sozinho'
      ],
      correct: 1,
      explanation: 'O node-gateway e um ponto de passagem. Se ele falha sem HA, o trafego dos Pods para os destinationCIDRs para silenciosamente (apenas timeouts para aquele destino). Por isso usa-se multiplos nodes elegiveis e/ou o suporte de HA de egress gateway das versoes recentes, alem de monitorar a saude do gateway.',
      reference: 'Secao Alta disponibilidade.'
    },
    {
      question: 'Qual a diferenca entre Egress Gateway e NetworkPolicy?',
      options: [
        'Sao a mesma coisa com nomes diferentes',
        'Egress Gateway controla o IP de SAIDA (SNAT) do trafego; NetworkPolicy controla SE a conexao e permitida',
        'NetworkPolicy faz SNAT; Egress Gateway faz allow/deny',
        'Egress Gateway so funciona para Ingress'
      ],
      correct: 1,
      explanation: 'Sao complementares e distintos: a NetworkPolicy decide se uma conexao e permitida (allow/deny). O Egress Gateway nao decide permissao — ele altera o IP de origem (SNAT para um egressIP estavel) do trafego que sai para os CIDRs definidos. Voce pode usar ambos juntos.',
      reference: 'Secao Quando usar e Erros Comuns (item 5).'
    }
  ],

  flashcards: [
    {
      front: 'Para que serve o Cilium Egress Gateway?',
      back: 'Da um **IP de saida estavel** (SNAT) a Pods selecionados, para integrar com sistemas externos que fazem **allowlist por IP de origem** (firewalls, SaaS, bancos legados).\n\nIPs de Pod sao efemeros; o egress gateway roteia o trafego por um node-gateway que aplica SNAT para um `egressIP` fixo e previsivel.'
    },
    {
      front: 'CiliumEgressGatewayPolicy — os 3 campos-chave',
      back: '```yaml\nspec:\n  selectors:\n    - podSelector:        # 1. quais Pods\n        matchLabels: {...}\n  destinationCIDRs:       # 2. para quais destinos\n    - "203.0.113.0/24"\n  egressGateway:\n    nodeSelector: {...}    # 3. por qual node\n    egressIP: "192.0.2.10" #    e qual IP (SNAT)\n```\n\nSo o trafego dos Pods selecionados COM destino aos CIDRs e desviado.'
    },
    {
      front: 'Pre-requisitos do Egress Gateway',
      back: 'Depende do datapath eBPF de mascaramento:\n\n```bash\nhelm upgrade cilium cilium/cilium -n kube-system \\\n  --set egressGateway.enabled=true \\\n  --set kubeProxyReplacement=true \\\n  --set bpf.masquerade=true\n```\n\nSem **kube-proxy replacement** + **bpf.masquerade**, a policy nao tem efeito.'
    },
    {
      front: 'Como validar o egressIP de um Pod?',
      back: '```bash\n# Do Pod selecionado:\nkubectl exec -n production deploy/payments -- \\\n  curl -s https://ifconfig.me\n# Esperado: 192.0.2.10 (egressIP), nao o IP do node\n\n# No agente Cilium:\ncilium-dbg bpf egress list\n```'
    },
    {
      front: 'Egress Gateway vs NetworkPolicy',
      back: '**Egress Gateway** — muda o **IP de saida** (SNAT para egressIP estavel) do trafego para certos CIDRs.\n\n**NetworkPolicy** — decide **se** a conexao e permitida (allow/deny).\n\nComplementares: um controla a identidade de saida, o outro controla a permissao. Podem ser usados juntos.'
    },
    {
      front: 'HA e armadilhas do Egress Gateway',
      back: '**HA**: o node-gateway e ponto de passagem; use multiplos nodes elegiveis e/ou o suporte de HA das versoes recentes; monitore a saude (falha = timeouts silenciosos).\n\n**Armadilhas**:\n- esquecer pre-requisitos (kube-proxy replacement/bpf.masquerade)\n- nenhum node com o label do nodeSelector\n- destinationCIDRs largo demais (0.0.0.0/0 = gargalo)\n- egressIP nao atribuivel ao node'
    }
  ],

  lab: {
    scenario: 'Habilitar o egress gateway, marcar um node como gateway e criar uma CiliumEgressGatewayPolicy para que Pods especificos saiam com um IP fixo ao acessar um destino externo.',
    objective: 'Dominar o fluxo selecionar Pods -> definir destino -> SNAT para egressIP estavel, e como validar o IP de saida.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Habilitar egress gateway e marcar o node',
        instruction: 'Habilite o egress gateway com os pre-requisitos e rotule um node como gateway de saida.',
        hints: ['kubeProxyReplacement + bpf.masquerade', 'kubectl label node ... egress-node=true'],
        solution: `\`\`\`bash
helm upgrade cilium cilium/cilium -n kube-system --reuse-values \\
  --set egressGateway.enabled=true \\
  --set kubeProxyReplacement=true \\
  --set bpf.masquerade=true

kubectl -n kube-system rollout restart ds/cilium
kubectl -n kube-system rollout status ds/cilium

# Escolher e marcar um node como gateway
GW=$(kubectl get nodes -o jsonpath='{.items[0].metadata.name}')
kubectl label node $GW egress-node=true --overwrite
\`\`\``,
        verify: `\`\`\`bash
kubectl get nodes -l egress-node=true
# Esperado: 1 node marcado

kubectl exec -n kube-system ds/cilium -- cilium status | grep -i 'kubeproxy\\|masquerad'
# Esperado: KubeProxyReplacement True; Masquerading BPF
\`\`\``
      },
      {
        title: 'Criar a CiliumEgressGatewayPolicy',
        instruction: 'Crie a app de origem e uma policy que faca os Pods dela sairem por um egressIP fixo ao acessar um CIDR externo.',
        hints: ['podSelector + destinationCIDRs + egressIP', 'Ajuste egressIP para um IP valido do node-gateway'],
        solution: `\`\`\`bash
kubectl create namespace production
kubectl -n production create deployment payments --image=curlimages/curl -- sleep 3600
kubectl -n production label deployment payments app=payments --overwrite

# Descobrir um IP do node-gateway para usar como egressIP
GW=$(kubectl get nodes -l egress-node=true -o jsonpath='{.items[0].metadata.name}')
EIP=$(kubectl get node $GW -o jsonpath='{.status.addresses[?(@.type=="InternalIP")].address}')

cat <<EOF | kubectl apply -f -
apiVersion: cilium.io/v2
kind: CiliumEgressGatewayPolicy
metadata:
  name: payments-egress
spec:
  selectors:
    - podSelector:
        matchLabels:
          app: payments
          io.kubernetes.pod.namespace: production
  destinationCIDRs:
    - "0.0.0.0/0"
  egressGateway:
    nodeSelector:
      matchLabels:
        egress-node: "true"
    egressIP: "$EIP"
EOF
\`\`\``,
        verify: `\`\`\`bash
kubectl get ciliumegressgatewaypolicy payments-egress
# Esperado: a policy listada

kubectl exec -n kube-system ds/cilium -- cilium-dbg bpf egress list
# Esperado: entrada mapeando os Pods de payments para o egressIP
\`\`\``
      },
      {
        title: 'Validar o IP de saida',
        instruction: 'Do Pod de payments, acesse um servico que ecoa o IP de origem e confirme que e o egressIP.',
        hints: ['curl ifconfig.me de dentro do Pod', 'Comparar com o IP do node-gateway'],
        solution: `\`\`\`bash
POD=$(kubectl -n production get pod -l app=payments -o jsonpath='{.items[0].metadata.name}')
kubectl -n production exec $POD -- curl -s https://ifconfig.me ; echo

# Comparar com o egressIP esperado (IP do node-gateway)
kubectl get nodes -l egress-node=true \\
  -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}'; echo
\`\`\``,
        verify: `\`\`\`bash
# O IP retornado pelo curl deve ser o egressIP (IP do node-gateway),
# nao o IP do node onde o Pod realmente roda.

# Limpeza
kubectl delete ciliumegressgatewaypolicy payments-egress
kubectl delete namespace production
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'A policy foi aplicada mas o Pod continua saindo com o IP do node, nao com o egressIP',
      difficulty: 'medium',
      symptom: 'curl ifconfig.me de dentro do Pod selecionado retorna o IP do node onde ele roda, e nao o egressIP configurado na CiliumEgressGatewayPolicy.',
      diagnosis: `\`\`\`bash
# 1. Pre-requisitos estao ativos?
kubectl exec -n kube-system ds/cilium -- cilium status | grep -i 'kubeproxy\\|masquerad'

# 2. Existe node elegivel para o nodeSelector?
kubectl get nodes -l egress-node=true

# 3. O Pod realmente casa o podSelector (labels + namespace)?
kubectl get pod <pod> -n production --show-labels

# 4. O destino batido esta dentro dos destinationCIDRs?
kubectl get ciliumegressgatewaypolicy <nome> -o jsonpath='{.spec.destinationCIDRs}'

# 5. Mapa de egress no datapath
kubectl exec -n kube-system ds/cilium -- cilium-dbg bpf egress list
\`\`\``,
      solution: `**Causas comuns:**

1. **Pre-requisitos ausentes** — sem \`kubeProxyReplacement=true\` e \`bpf.masquerade=true\`, o desvio nao acontece. Reaplique o Helm com essas flags e reinicie o DaemonSet.

2. **Nenhum node casa o nodeSelector** — o label do egressGateway.nodeSelector nao bate em nenhum node. Marque o node: \`kubectl label node <n> egress-node=true\`.

3. **podSelector nao casa** — faltou o label ou o \`io.kubernetes.pod.namespace\`. Confirme os labels do Pod e o namespace na policy.

4. **Destino fora dos destinationCIDRs** — voce testou um IP que nao esta nas faixas; a regra so se aplica aos CIDRs listados.

\`\`\`bash
# Apos corrigir, revalidar
kubectl exec -n kube-system ds/cilium -- cilium-dbg bpf egress list
kubectl -n production exec <pod> -- curl -s https://ifconfig.me
\`\`\`

**Prevencao:** valide cada um dos 3 ingredientes (origem, destino, gateway) isoladamente.`
    },
    {
      title: 'Trafego para o destino externo parou apos o node-gateway ficar indisponivel',
      difficulty: 'hard',
      symptom: 'Tudo funcionava, mas apos manutencao/queda do node marcado como gateway, os Pods selecionados passaram a ter timeouts somente para os destinos da policy. Outros destinos seguem normais.',
      diagnosis: `\`\`\`bash
# 1. O node-gateway esta saudavel?
kubectl get nodes -l egress-node=true
kubectl describe node <gw-node> | grep -A5 Conditions

# 2. Ha outro node elegivel para assumir?
kubectl get nodes -l egress-node=true -o name | wc -l

# 3. O datapath ainda aponta para o gateway caido?
kubectl exec -n kube-system ds/cilium -- cilium-dbg bpf egress list
\`\`\`,`,
      solution: `**Causa:** o node-gateway e o unico ponto de saida para os destinationCIDRs. Sem HA, a queda dele interrompe o trafego desviado (so para aqueles destinos), enquanto o resto do egress (que nao passa pelo gateway) continua normal — o que torna o diagnostico confuso.

**Correcoes/estrategias:**

1. **Multiplos nodes gateway** — rotule mais de um node com \`egress-node=true\` e use o suporte de **HA de egress gateway** das versoes recentes do Cilium para failover automatico entre nodes elegiveis.

2. **egressIP como VIP flutuante** — em vez de prender o egressIP a um unico node, use um IP virtual que possa migrar entre os nodes gateway (gerenciado por keepalived/cloud), para preservar o IP visto pelo firewall externo.

3. **Restaurar o node** — se for o unico gateway, recuperar/recriar o node restabelece o caminho.

\`\`\`bash
# Adicionar redundancia
kubectl label node <outro-node> egress-node=true --overwrite
\`\`\`

**Prevencao:** nunca opere egress gateway com um unico node em producao; monitore a saude do(s) gateway(s) e alarme em timeouts para os destinationCIDRs.`
    }
  ]
};
