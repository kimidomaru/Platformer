window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['cilium-advanced/cilium-encryption'] = {
  theory: `# Cilium: Criptografia Transparente (WireGuard & IPsec)

## Relevancia
> Em ambientes regulados (PCI-DSS, HIPAA) ou redes nao confiaveis, o trafego **pod-a-pod** precisa ser criptografado em transito. O Cilium oferece **criptografia transparente** no nivel de dados, sem alterar a aplicacao, via **WireGuard** (recomendado) ou **IPsec**. E um dos pedidos enterprise mais comuns e estava ausente na maioria das stacks de estudo.

## Por que criptografia transparente?

- **Compliance** — muitos frameworks exigem cifragem em transito tambem dentro do cluster (east-west).
- **Zero-trust** — nao confie na rede entre nodes (multi-tenant, cloud, on-prem com switches compartilhados).
- **Transparente** — a app nao muda; o dataplane do Cilium cifra/decifra automaticamente entre nodes.

\`\`\`
Pod A (node1)  --[ texto claro ]-->  agente Cilium (node1)
                                          |
                                    [ WireGuard tunnel ]   <- cifrado na rede
                                          v
Pod B (node2)  <--[ texto claro ]--  agente Cilium (node2)
\`\`\`

## WireGuard (recomendado)

Moderno, simples, rapido e **no kernel**. Chaves geradas e rotacionadas automaticamente pelo Cilium; cada node tem um par de chaves e a chave publica e anunciada via CiliumNode.

\`\`\`bash
# Habilitar no install/upgrade
helm upgrade cilium cilium/cilium -n kube-system \\
  --set encryption.enabled=true \\
  --set encryption.type=wireguard

kubectl -n kube-system rollout restart ds/cilium
\`\`\`

\`\`\`bash
# Verificar status da criptografia
kubectl exec -n kube-system ds/cilium -- cilium status | grep Encryption
# Esperado: Encryption: Wireguard [cilium_wg0 ...]

# Detalhe por node (peers e chaves)
kubectl exec -n kube-system ds/cilium -- cilium-dbg encrypt status
\`\`\`

> O Cilium cria a interface \`cilium_wg0\`. O trafego pod-a-pod **entre nodes** passa por ela cifrado. Trafego dentro do mesmo node nao precisa de cifra (nao sai pela rede).

## node-to-node encryption (encryptNode)

Por padrao, o WireGuard cifra o trafego **pod-a-pod**. Para cifrar tambem o trafego **host/node-a-node** (ex.: trafego de processos host-network), habilite explicitamente:

\`\`\`bash
helm upgrade cilium cilium/cilium -n kube-system \\
  --set encryption.enabled=true \\
  --set encryption.type=wireguard \\
  --set encryption.nodeEncryption=true
\`\`\`

| Escopo | Padrao WireGuard | Com nodeEncryption |
|--------|------------------|--------------------|
| Pod-a-pod entre nodes | cifrado | cifrado |
| Host-network / node-a-node | **claro** | cifrado |

## IPsec (alternativa legada/FIPS)

Use IPsec quando precisar de algoritmos validados FIPS ou compatibilidade especifica. E mais complexo (exige um Secret com a chave PSK e rotacao manual/gerenciada).

\`\`\`bash
# Criar a chave IPsec
kubectl create -n kube-system secret generic cilium-ipsec-keys \\
  --from-literal=keys="3 rfc4106(gcm(aes)) $(openssl rand -hex 20) 128"

helm upgrade cilium cilium/cilium -n kube-system \\
  --set encryption.enabled=true \\
  --set encryption.type=ipsec
\`\`\`

## WireGuard vs IPsec

| | WireGuard | IPsec |
|---|-----------|-------|
| Complexidade | baixa (chaves automaticas) | alta (Secret PSK, rotacao) |
| Performance | alta (kernel, moderno) | boa, mas mais overhead |
| FIPS | nao | sim (algoritmos validados) |
| Recomendacao Cilium | **padrao** | quando exigido por compliance |

## Validando que o trafego esta cifrado

\`\`\`bash
# 1. Status geral
kubectl exec -n kube-system ds/cilium -- cilium status | grep -i encryption

# 2. Capturar trafego na interface fisica do node e confirmar que NAO ha texto claro
#    (deve aparecer protocolo WireGuard/UDP 51871, nao HTTP em claro)
tcpdump -ni eth0 'udp port 51871' -c 5      # WireGuard
# Para IPsec, procurar protocolo ESP:
tcpdump -ni eth0 'esp' -c 5

# 3. Confirmar handshake/peers do WireGuard
kubectl exec -n kube-system ds/cilium -- cilium-dbg encrypt status
\`\`\`

## Erros Comuns

1. **Esquecer de reiniciar os agentes** apos habilitar — o DaemonSet precisa recarregar.
2. **Assumir que host-network esta cifrado** — sem \`nodeEncryption\`, so o pod-a-pod e cifrado.
3. **MTU** — o overhead do tunel reduz a MTU efetiva; problemas de path MTU podem causar timeouts em payloads grandes.
4. **Misturar tipos** — alternar entre wireguard e ipsec exige cuidado; nao rode os dois ao mesmo tempo.
5. **IPsec sem o Secret correto** — chave malformada deixa os agentes em erro.

## Killer.sh Style Challenge

> Em um cluster Cilium com 2+ nodes:
>
> 1. Habilite criptografia transparente com WireGuard.
> 2. Confirme via \`cilium status\` que Encryption: Wireguard esta ativo.
> 3. Faca dois Pods em nodes diferentes trocarem trafego HTTP.
> 4. Capture o trafego na interface do node e comprove que ele esta cifrado (WireGuard UDP), nao em texto claro.
>
> Dica: \`--set encryption.enabled=true --set encryption.type=wireguard\`, depois \`cilium-dbg encrypt status\` e \`tcpdump\`.
`,

  quiz: [
    {
      question: 'Qual e o metodo de criptografia transparente RECOMENDADO pelo Cilium para a maioria dos casos?',
      options: [
        'IPsec, por ser validado FIPS',
        'WireGuard, por ser simples, rapido e com chaves gerenciadas automaticamente',
        'TLS no nivel da aplicacao',
        'mTLS via sidecar'
      ],
      correct: 1,
      explanation: 'O Cilium recomenda WireGuard como padrao: roda no kernel, e moderno e performatico, e o Cilium gerencia/rotaciona as chaves automaticamente (cada node tem um par, chave publica anunciada via CiliumNode). IPsec fica reservado para quando ha exigencia FIPS ou compatibilidade especifica.',
      reference: 'Secoes WireGuard e WireGuard vs IPsec.'
    },
    {
      question: 'Com WireGuard habilitado no modo padrao, qual trafego NAO e criptografado?',
      options: [
        'Trafego pod-a-pod entre nodes diferentes',
        'Trafego host-network / node-a-node (a menos que nodeEncryption seja habilitado)',
        'Nenhum — tudo e cifrado por padrao',
        'Apenas trafego DNS'
      ],
      correct: 1,
      explanation: 'Por padrao o WireGuard cifra o trafego pod-a-pod entre nodes. O trafego de processos host-network (node-a-node) so e cifrado se voce habilitar explicitamente encryption.nodeEncryption=true. Trafego dentro do mesmo node nao precisa de cifra (nao sai pela rede).',
      reference: 'Secao node-to-node encryption (encryptNode).'
    },
    {
      question: 'Qual interface o Cilium cria ao habilitar WireGuard?',
      options: [
        'cilium_vxlan',
        'cilium_wg0',
        'wg-crypt0',
        'cilium_host'
      ],
      correct: 1,
      explanation: 'O Cilium cria a interface cilium_wg0 para o tunel WireGuard. O trafego pod-a-pod entre nodes e roteado por ela de forma cifrada. Voce confirma com cilium status (linha Encryption) e cilium-dbg encrypt status.',
      reference: 'Secao WireGuard.'
    },
    {
      question: 'Em que cenario o IPsec ainda e preferivel ao WireGuard no Cilium?',
      options: [
        'Sempre, por ser mais rapido',
        'Quando ha exigencia de algoritmos validados FIPS ou compatibilidade especifica de compliance',
        'Em clusters de node unico',
        'Quando nao ha kube-proxy'
      ],
      correct: 1,
      explanation: 'IPsec e a escolha quando o compliance exige algoritmos criptograficos validados FIPS. O custo e maior complexidade: exige um Secret com a chave PSK e gestao de rotacao, ao contrario do WireGuard que gerencia chaves automaticamente.',
      reference: 'Secoes IPsec e WireGuard vs IPsec.'
    },
    {
      question: 'Como comprovar na pratica que o trafego entre nodes esta realmente cifrado?',
      options: [
        'Olhando os logs da aplicacao',
        'Capturando o trafego na interface fisica do node com tcpdump e confirmando WireGuard (UDP) ou ESP, sem payload em texto claro',
        'Verificando o numero de replicas dos Pods',
        'Rodando kubectl top nodes'
      ],
      correct: 1,
      explanation: 'A validacao definitiva e capturar na interface fisica (ex.: tcpdump -ni eth0 udp port 51871 para WireGuard, ou esp para IPsec). Voce deve ver o protocolo de tunel cifrado, e nao requisicoes HTTP em texto claro. cilium-dbg encrypt status confirma peers/handshakes.',
      reference: 'Secao Validando que o trafego esta cifrado.'
    },
    {
      question: 'Por que payloads grandes podem ter timeouts apos habilitar criptografia transparente?',
      options: [
        'O WireGuard limita o numero de conexoes',
        'O overhead do tunel reduz a MTU efetiva; problemas de path MTU podem fragmentar/derrubar pacotes grandes',
        'A criptografia desabilita o TCP',
        'Os Pods perdem o IP'
      ],
      correct: 1,
      explanation: 'Encapsular em um tunel adiciona cabecalhos e reduz a MTU disponivel para o payload. Se o path MTU nao for tratado corretamente, pacotes grandes podem ser descartados, causando timeouts intermitentes. Ajustar a MTU do Cilium resolve.',
      reference: 'Secao Erros Comuns (item 3).'
    },
    {
      question: 'Quem gerencia as chaves criptograficas no modo WireGuard do Cilium?',
      options: [
        'O administrador, manualmente via Secret',
        'O proprio Cilium, gerando e rotacionando as chaves automaticamente por node',
        'O cert-manager',
        'O kube-apiserver'
      ],
      correct: 1,
      explanation: 'No WireGuard, o Cilium gera um par de chaves por node automaticamente e anuncia a chave publica via o objeto CiliumNode. Nao ha Secret manual. Isso contrasta com o IPsec, onde voce cria e gerencia o Secret cilium-ipsec-keys.',
      reference: 'Secao WireGuard.'
    }
  ],

  flashcards: [
    {
      front: 'Como habilitar criptografia transparente com WireGuard no Cilium?',
      back: '```bash\nhelm upgrade cilium cilium/cilium -n kube-system \\\n  --set encryption.enabled=true \\\n  --set encryption.type=wireguard\nkubectl -n kube-system rollout restart ds/cilium\n```\n\nO Cilium cria `cilium_wg0` e gerencia as chaves automaticamente. Verifique com `cilium status | grep Encryption`.'
    },
    {
      front: 'Escopo padrao do WireGuard vs nodeEncryption',
      back: '| Trafego | Padrao | nodeEncryption=true |\n|---------|--------|---------------------|\n| Pod-a-pod entre nodes | cifrado | cifrado |\n| Host-network / node-a-node | **claro** | cifrado |\n\nPor padrao so o pod-a-pod e cifrado. Para cifrar host-network, ligue `encryption.nodeEncryption=true`.'
    },
    {
      front: 'WireGuard vs IPsec no Cilium',
      back: '**WireGuard** (padrao): chaves automaticas, kernel, rapido, simples. Sem FIPS.\n\n**IPsec**: exige Secret `cilium-ipsec-keys` (PSK), rotacao gerenciada, mais overhead, **valida FIPS**.\n\nEscolha IPsec so quando o compliance exigir algoritmos validados FIPS.'
    },
    {
      front: 'Como verificar o status da criptografia?',
      back: '```bash\n# resumo\nkubectl exec -n kube-system ds/cilium -- \\\n  cilium status | grep Encryption\n# Encryption: Wireguard [cilium_wg0 ...]\n\n# detalhe (peers/chaves)\nkubectl exec -n kube-system ds/cilium -- \\\n  cilium-dbg encrypt status\n```'
    },
    {
      front: 'Como PROVAR que o trafego esta cifrado na rede?',
      back: 'Capturar na interface fisica do node:\n\n```bash\n# WireGuard (UDP 51871)\ntcpdump -ni eth0 \'udp port 51871\' -c 5\n# IPsec (protocolo ESP)\ntcpdump -ni eth0 \'esp\' -c 5\n```\n\nDeve aparecer o protocolo de tunel cifrado, nunca HTTP/payload em texto claro.'
    },
    {
      front: 'Setup de IPsec no Cilium',
      back: '```bash\nkubectl create -n kube-system secret generic cilium-ipsec-keys \\\n  --from-literal=keys="3 rfc4106(gcm(aes)) $(openssl rand -hex 20) 128"\n\nhelm upgrade cilium cilium/cilium -n kube-system \\\n  --set encryption.enabled=true \\\n  --set encryption.type=ipsec\n```\n\nDiferente do WireGuard, a chave (PSK) e gerenciada manualmente via Secret.'
    },
    {
      front: 'Armadilhas da criptografia transparente',
      back: '1. Esquecer de **reiniciar** os agentes apos habilitar.\n2. Achar que **host-network** esta cifrado sem `nodeEncryption`.\n3. **MTU**: overhead do tunel pode causar timeout em payloads grandes (path MTU).\n4. **IPsec** com Secret malformado deixa o agente em erro.\n5. Nao rodar WireGuard e IPsec ao mesmo tempo.'
    }
  ],

  lab: {
    scenario: 'Habilitar WireGuard no Cilium, verificar o status da criptografia e comprovar com captura de pacotes que o trafego pod-a-pod entre nodes esta cifrado.',
    objective: 'Dominar a habilitacao e a VALIDACAO da criptografia transparente — o ponto que cai em auditorias de compliance.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Habilitar WireGuard e confirmar status',
        instruction: 'Habilite a criptografia WireGuard via Helm e confirme que o Cilium reporta Encryption: Wireguard.',
        hints: ['encryption.type=wireguard', 'cilium status | grep Encryption'],
        solution: `\`\`\`bash
helm upgrade cilium cilium/cilium -n kube-system \\
  --reuse-values \\
  --set encryption.enabled=true \\
  --set encryption.type=wireguard

kubectl -n kube-system rollout restart ds/cilium
kubectl -n kube-system rollout status ds/cilium

kubectl exec -n kube-system ds/cilium -- cilium status | grep -i encryption
\`\`\``,
        verify: `\`\`\`bash
kubectl exec -n kube-system ds/cilium -- cilium status | grep -i encryption
# Esperado: Encryption: Wireguard [cilium_wg0 (Pubkey: ...)]

kubectl exec -n kube-system ds/cilium -- cilium-dbg encrypt status
# Esperado: lista de peers WireGuard (1 por outro node)
\`\`\``
      },
      {
        title: 'Gerar trafego pod-a-pod entre nodes',
        instruction: 'Crie dois Pods forcando-os para nodes diferentes e gere trafego HTTP entre eles.',
        hints: ['Use nodeName ou anti-affinity', 'curl de um pod para o IP do outro'],
        solution: `\`\`\`bash
# Servidor
kubectl run server --image=nginx
kubectl expose pod server --port=80

# Cliente em outro node (ajuste o nodeName conforme seu cluster)
NODE2=$(kubectl get nodes -o jsonpath='{.items[1].metadata.name}')
kubectl run client --image=curlimages/curl --overrides="{\\"spec\\":{\\"nodeName\\":\\"$NODE2\\"}}" \\
  --command -- sleep 3600

# Gerar trafego
kubectl exec client -- curl -s http://server.default.svc.cluster.local | head -3
\`\`\``,
        verify: `\`\`\`bash
kubectl get pod server client -o wide
# Esperado: server e client em NODES diferentes

kubectl exec client -- curl -s -o /dev/null -w "%{http_code}\\n" http://server
# Esperado: 200
\`\`\``
      },
      {
        title: 'Comprovar que o trafego esta cifrado',
        instruction: 'Capture o trafego na interface fisica do node e confirme que ele aparece como WireGuard, nao HTTP em claro.',
        hints: ['tcpdump na eth0 do node', 'WireGuard usa UDP 51871'],
        solution: `\`\`\`bash
# No node onde roda o client (via debug pod ou SSH):
# Capturar pacotes WireGuard
tcpdump -ni eth0 'udp port 51871' -c 5

# Para contraste, tentar achar HTTP em claro (NAO deve achar payload do nginx)
tcpdump -ni eth0 -A 'tcp port 80' -c 5 | grep -i 'nginx\\|HTTP' || echo "Nenhum texto claro encontrado (esperado)"
\`\`\``,
        verify: `\`\`\`bash
# Esperado: pacotes UDP 51871 (WireGuard) ao gerar trafego entre os pods
# e ausencia de payload HTTP em texto claro na interface fisica

# Limpeza
kubectl delete pod server client
kubectl delete svc server
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Habilitei a criptografia mas o trafego continua em texto claro',
      difficulty: 'medium',
      symptom: 'Apos setar encryption.enabled=true, a captura de pacotes ainda mostra payload HTTP em claro entre Pods, ou cilium status nao mostra Encryption ativo.',
      diagnosis: `\`\`\`bash
# 1. Os agentes recarregaram a config?
kubectl exec -n kube-system ds/cilium -- cilium status | grep -i encryption
kubectl -n kube-system get pods -l k8s-app=cilium

# 2. Os Pods estao no MESMO node? (trafego intra-node nao usa o tunel)
kubectl get pods -o wide

# 3. O trafego e host-network? (nao cifrado sem nodeEncryption)
kubectl get pod <pod> -o jsonpath='{.spec.hostNetwork}'
\`\`\``,
      solution: `**Causas comuns:**

1. **Agentes nao reiniciados** — habilitar a flag exige recarregar o DaemonSet:
\`\`\`bash
kubectl -n kube-system rollout restart ds/cilium
\`\`\`

2. **Pods no mesmo node** — trafego intra-node nao sai pela rede e nao passa pelo tunel WireGuard. Force os Pods para nodes diferentes para validar.

3. **Trafego host-network** — processos com hostNetwork: true so sao cifrados com \`encryption.nodeEncryption=true\`. Habilite-o se precisar cobrir esse trafego.

4. **Capturou na interface errada** — capture na interface FISICA do node (eth0), nao na interface do Pod/lxc, para ver os pacotes ja encapsulados.

**Prevencao:** valide sempre com Pods em nodes distintos e com tcpdump na interface fisica.`
    },
    {
      title: 'Timeouts intermitentes em requisicoes grandes apos habilitar WireGuard',
      difficulty: 'hard',
      symptom: 'Conexoes pequenas funcionam, mas uploads/downloads grandes ou respostas volumosas travam ou dao timeout depois que a criptografia foi habilitada.',
      diagnosis: `\`\`\`bash
# Sintoma classico de path MTU: pequeno ok, grande falha
# 1. Verificar a MTU configurada no Cilium
kubectl exec -n kube-system ds/cilium -- cilium status --verbose | grep -i mtu

# 2. Testar com tamanhos crescentes
kubectl exec client -- ping -M do -s 1400 <ip-server>
kubectl exec client -- ping -M do -s 1472 <ip-server>   # pode falhar
\`\`\`,`,
      solution: `**Causa:** o encapsulamento WireGuard adiciona overhead de cabecalho, reduzindo a MTU efetiva. Se o path MTU discovery nao funcionar (ICMP bloqueado em algum ponto), pacotes grandes sao descartados silenciosamente -> timeout.

**Correcoes:**

1. **Ajustar a MTU do Cilium** para acomodar o overhead do tunel:
\`\`\`bash
helm upgrade cilium cilium/cilium -n kube-system --reuse-values \\
  --set MTU=1380     # exemplo; ajuste conforme a rede subjacente
kubectl -n kube-system rollout restart ds/cilium
\`\`\`

2. **Garantir que ICMP (necessario p/ PMTUD) nao esteja bloqueado** entre nodes por firewalls/NetworkPolicies.

3. **TCP MSS clamping** — em alguns ambientes, ajustar o MSS resolve sem mexer na MTU global.

**Prevencao:** ao habilitar qualquer tunel/cifra, planeje a MTU desde o inicio considerando o overhead (WireGuard ~ 80 bytes).`
    }
  ]
};
