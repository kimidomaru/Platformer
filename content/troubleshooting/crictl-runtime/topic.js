window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['troubleshooting/crictl-runtime'] = {
  theory: `# crictl & Debug no Nivel do Container Runtime

## Relevancia no Exame
> No CKA, **quando o API server nao responde**, \`kubectl\` fica inutil. E ai que entra o \`crictl\`: a ferramenta de linha de comando para falar direto com o **container runtime** (containerd/CRI-O) via **CRI** (Container Runtime Interface). Cenarios classicos: control plane como static pod em CrashLoop, kubelet que nao sobe, node NotReady. Saber ler logs de container sem o kubectl pode ser a diferenca entre resolver e travar.

## Por que crictl e nao kubectl/docker?

| Camada | Ferramenta | Quando usar |
|--------|-----------|-------------|
| API do Kubernetes | \`kubectl\` | Funciona so se o **API server** estiver de pe |
| Container Runtime (CRI) | \`crictl\` | Funciona mesmo com o **control plane caido** |
| Containerd nativo | \`ctr\` | Debug de baixo nivel do containerd (namespaces internos) |

> Desde a remocao do **dockershim** (K8s 1.24+), o runtime padrao e o **containerd**. O \`docker\` CLI nao enxerga mais os containers do Kubernetes. Use \`crictl\`.

\`\`\`
┌──────────────┐   API     ┌────────────┐  CRI (gRPC)  ┌─────────────┐
│   kubectl    │ ────────▶ │ API server │              │  containerd │
└──────────────┘           └────────────┘              └─────────────┘
                                  ▲                            ▲
                              (pode estar caido)        crictl fala aqui
                                                        direto, via socket
\`\`\`

## Configurando o crictl

O \`crictl\` precisa saber o endpoint do runtime. Sem isso, ele reclama ou tenta autodetectar.

\`\`\`bash
# Opcao 1: arquivo de config (recomendado)
cat /etc/crictl.yaml
# runtime-endpoint: unix:///run/containerd/containerd.sock
# image-endpoint: unix:///run/containerd/containerd.sock
# timeout: 10
# debug: false

# Criar/ajustar:
sudo crictl config runtime-endpoint unix:///run/containerd/containerd.sock

# Opcao 2: flag por comando
crictl --runtime-endpoint unix:///run/containerd/containerd.sock ps
\`\`\`

| Runtime | Socket padrao |
|---------|---------------|
| containerd | \`unix:///run/containerd/containerd.sock\` |
| CRI-O | \`unix:///var/run/crio/crio.sock\` |

> Pegadinha de prova: se \`crictl ps\` der erro de conexao, o endpoint provavelmente esta errado/ausente. Configure o \`runtime-endpoint\` antes de tudo.

## Mapa mental: Pod vs Sandbox vs Container

No mundo CRI, um Pod = um **sandbox** (a "caixa" de rede/namespace, o pause container) + 1..N **containers** de aplicacao.

| Conceito K8s | No crictl | Comando |
|--------------|-----------|---------|
| Pod | **PodSandbox** | \`crictl pods\` |
| Container | Container | \`crictl ps\` |
| Imagem | Image | \`crictl images\` |

## Comandos Essenciais

\`\`\`bash
# --- Listar ---
crictl ps                 # containers RODANDO
crictl ps -a              # TODOS (inclui Exited/CrashLoop) -- essencial p/ debug
crictl pods               # pod sandboxes
crictl images             # imagens no node

# Filtrar
crictl ps -a --name kube-apiserver
crictl pods --name etcd --namespace kube-system

# --- Inspecionar ---
crictl inspect <container-id>     # JSON do container (estado, mounts, args)
crictl inspectp <pod-id>          # JSON do pod sandbox (rede, labels)
crictl inspecti <image-id>        # JSON da imagem

# --- Logs (o mais importante no exame) ---
crictl logs <container-id>
crictl logs --tail 50 <container-id>
crictl logs -f <container-id>            # follow

# --- Estado e recursos ---
crictl stats                      # CPU/memoria por container
crictl statsp                     # por pod sandbox

# --- Executar dentro ---
crictl exec -it <container-id> sh

# --- Limpeza (cuidado!) ---
crictl stop <container-id>
crictl rm <container-id>
crictl rmi <image-id>             # remover imagem
\`\`\`

> O kubelet **recria** containers que voce parar/remover (reconciliacao). \`crictl stop\` num container de static pod e util para forcar um restart limpo.

## Cenario-chave: control plane como Static Pod

Os componentes do control plane (\`kube-apiserver\`, \`etcd\`, \`kube-controller-manager\`, \`kube-scheduler\`) rodam como **static pods**, gerenciados diretamente pelo **kubelet** a partir de \`/etc/kubernetes/manifests/\`.

Se o API server esta em CrashLoop, \`kubectl\` falha — mas o container existe no runtime:

\`\`\`bash
# 1. O kube-apiserver esta rodando? (kubectl nao funciona aqui!)
sudo crictl ps -a --name kube-apiserver
# STATE = Running? Exited? CrashLoopBackOff?

# 2. Ler os logs do container para achar a causa
APISERVER=$(sudo crictl ps -a --name kube-apiserver -q | head -1)
sudo crictl logs $APISERVER

# Erros tipicos: "--etcd-servers" inalcancavel, flag invalida,
# certificado expirado, porta ocupada.

# 3. O manifesto estatico tem erro de sintaxe?
sudo cat /etc/kubernetes/manifests/kube-apiserver.yaml

# 4. O kubelet esta processando o manifesto?
sudo journalctl -u kubelet -f
\`\`\`

> Fluxo mental: \`kubectl\` falhou → \`crictl ps -a\` para ver o estado do container → \`crictl logs\` para a causa → corrigir o manifesto em \`/etc/kubernetes/manifests/\` → kubelet recria o static pod automaticamente.

## Logs do runtime e do kubelet (systemd)

Quando nem o container sobe, o problema esta uma camada abaixo:

\`\`\`bash
# Logs do kubelet (quem chama o CRI)
sudo journalctl -u kubelet -f
sudo journalctl -u kubelet --since "10 min ago" --no-pager

# Logs do containerd (o runtime em si)
sudo journalctl -u containerd -f

# Status dos servicos
sudo systemctl status kubelet
sudo systemctl status containerd

# Reiniciar se necessario
sudo systemctl restart kubelet
\`\`\`

## crictl vs ctr (quando descer mais um nivel)

\`crictl\` enxerga so o que o **Kubernetes** criou (namespace CRI \`k8s.io\`). O \`ctr\` (nativo do containerd) enxerga tudo, mas exige especificar o namespace:

\`\`\`bash
# ctr precisa do namespace explicito
sudo ctr -n k8s.io containers list
sudo ctr -n k8s.io images list
sudo ctr namespaces list
\`\`\`

> Na prova, **prefira \`crictl\`** — e a interface CRI padrao e mais previsivel. \`ctr\` so quando precisar inspecionar coisas fora do escopo do CRI (ex.: pull manual de imagem, snapshots).

## Erros Comuns

1. **Usar \`docker ps\`** num cluster moderno e nao ver nada — o runtime e containerd; use \`crictl ps\`.
2. **Esquecer \`-a\`** em \`crictl ps\` — containers em CrashLoop estao \`Exited\`, so aparecem com \`-a\`.
3. **runtime-endpoint nao configurado** — \`crictl\` reclama de conexao; configure \`/etc/crictl.yaml\`.
4. **Esquecer \`sudo\`** — o socket do runtime exige root.
5. **Tentar \`kubectl logs\`** com API server caido — sem o control plane, so \`crictl logs\` funciona.
6. **Editar manifesto estatico e esperar \`kubectl apply\`** — static pods nao usam a API; basta salvar o arquivo em \`/etc/kubernetes/manifests/\` e o kubelet reage.

## Killer.sh Style Challenge

> O \`kubectl get nodes\` no control plane retorna "The connection to the server X was refused". Voce tem acesso SSH ao node.
>
> 1. Sem usar \`kubectl\`, descubra se o container \`kube-apiserver\` esta rodando.
> 2. Se nao estiver, leia os logs do container para identificar a causa raiz.
> 3. Suspeita: alguem alterou \`--etcd-servers\` no manifesto para uma porta errada. Verifique \`/etc/kubernetes/manifests/kube-apiserver.yaml\`.
> 4. Corrija o manifesto e confirme que o kubelet recriou o static pod e o \`kubectl\` voltou.
>
> Dica: \`sudo crictl ps -a --name kube-apiserver\` → \`sudo crictl logs <id>\` → editar o YAML → aguardar o kubelet (\`journalctl -u kubelet -f\`) → \`kubectl get nodes\`.
`,

  quiz: [
    {
      question: 'O API server esta em CrashLoopBackOff e "kubectl" retorna "connection refused". Qual ferramenta permite ler os logs do container kube-apiserver?',
      options: [
        'kubectl logs -n kube-system kube-apiserver',
        'docker logs kube-apiserver',
        'crictl logs <container-id> (falando direto com o containerd via CRI)',
        'journalctl -u kube-apiserver'
      ],
      correct: 2,
      explanation: 'Com o API server caido, kubectl nao funciona (ele depende da API). O kube-apiserver roda como container no runtime, entao crictl ps -a + crictl logs leem o container direto via CRI. docker nao enxerga containers do K8s (containerd e o runtime); e nao existe um servico systemd chamado kube-apiserver (ele e um static pod, nao um servico).',
      reference: 'Secao Cenario-chave: control plane como Static Pod.'
    },
    {
      question: 'Por que "crictl ps" sozinho pode nao mostrar um container que esta em CrashLoopBackOff?',
      options: [
        'crictl nao suporta containers do control plane',
        'Containers em CrashLoop estao no estado Exited; e preciso "crictl ps -a" para ve-los',
        'crictl so mostra pods, nao containers',
        'O container precisa de um label especial para aparecer'
      ],
      correct: 1,
      explanation: 'crictl ps lista apenas containers em execucao (Running). Um container em CrashLoopBackOff esta repetidamente Exited entre tentativas, entao so aparece com a flag -a (all). Esquecer o -a e um erro classico ao debugar crashes.',
      reference: 'Secao Comandos Essenciais e Erros Comuns (item 2).'
    },
    {
      question: 'Qual e o socket de runtime-endpoint padrao do containerd que o crictl precisa conhecer?',
      options: [
        'unix:///var/run/docker.sock',
        'unix:///run/containerd/containerd.sock',
        'tcp://localhost:2375',
        'unix:///var/run/crio/crio.sock'
      ],
      correct: 1,
      explanation: 'O containerd expoe o CRI no socket unix:///run/containerd/containerd.sock. Configure com "crictl config runtime-endpoint ..." ou em /etc/crictl.yaml. O socket do CRI-O e /var/run/crio/crio.sock; docker.sock e do Docker (nao usado pelo K8s moderno).',
      reference: 'Secao Configurando o crictl — tabela de sockets por runtime.'
    },
    {
      question: 'No modelo CRI, qual comando lista os Pod Sandboxes (a "caixa" de cada Pod), em vez dos containers de aplicacao?',
      options: [
        'crictl ps',
        'crictl images',
        'crictl pods',
        'crictl inspect'
      ],
      correct: 2,
      explanation: 'Um Pod no CRI = um PodSandbox (pause container, namespaces de rede) + 1..N containers. crictl pods lista os sandboxes; crictl ps lista os containers de aplicacao; crictl inspectp <pod-id> detalha um sandbox. Util quando o sandbox sobe mas o container da app falha (ou vice-versa).',
      reference: 'Secao Mapa mental: Pod vs Sandbox vs Container.'
    },
    {
      question: 'Voce corrigiu um erro no /etc/kubernetes/manifests/kube-apiserver.yaml. Como o cluster aplica essa mudanca?',
      options: [
        'Rodando kubectl apply -f no manifesto',
        'O kubelet detecta a mudanca no arquivo e recria o static pod automaticamente',
        'Reiniciando o containerd manualmente',
        'Executando crictl create com o novo manifesto'
      ],
      correct: 1,
      explanation: 'Static pods nao passam pela API. O kubelet observa o diretorio /etc/kubernetes/manifests/ e, ao detectar a alteracao no arquivo, recria o pod sozinho. Por isso kubectl apply nao se aplica aqui. Voce pode acompanhar com journalctl -u kubelet -f.',
      reference: 'Secao Cenario-chave e Erros Comuns (item 6).'
    },
    {
      question: 'Em um cluster Kubernetes 1.24+, por que "docker ps" nao mostra os containers dos Pods?',
      options: [
        'Porque o Docker esconde containers do sistema',
        'Porque desde a remocao do dockershim o runtime padrao e o containerd, e o Docker CLI nao gerencia esses containers',
        'Porque os containers estao em outro namespace de rede',
        'Porque e preciso rodar docker ps --all'
      ],
      correct: 1,
      explanation: 'A partir do K8s 1.24 o dockershim foi removido e o runtime padrao passou a ser o containerd (ou CRI-O). O Docker CLI fala com o daemon do Docker, que nao e quem roda os containers do Kubernetes. Por isso usa-se crictl (CRI) ou ctr (containerd nativo).',
      reference: 'Secao Por que crictl e nao kubectl/docker.'
    },
    {
      question: 'O "crictl ps" retorna um erro de conexao com o runtime. Qual e a primeira coisa a verificar?',
      options: [
        'Se o cluster tem nodes suficientes',
        'Se o runtime-endpoint esta configurado corretamente (/etc/crictl.yaml ou flag) e se voce esta usando sudo',
        'Se o kube-proxy esta rodando',
        'Se ha uma NetworkPolicy bloqueando'
      ],
      correct: 1,
      explanation: 'Erro de conexao do crictl quase sempre e endpoint errado/ausente ou falta de privilegio. Verifique runtime-endpoint em /etc/crictl.yaml (ou passe --runtime-endpoint) e rode com sudo, pois o socket do runtime exige root.',
      reference: 'Secao Configurando o crictl + Erros Comuns (itens 3 e 4).'
    }
  ],

  flashcards: [
    {
      front: 'Quando usar crictl em vez de kubectl?',
      back: '**kubectl** depende do API server estar de pe.\n\n**crictl** fala direto com o container runtime (containerd/CRI-O) via **CRI**, funcionando mesmo com o **control plane caido**.\n\nCenarios: kube-apiserver em CrashLoop, kubelet/node com problema, ler logs de container quando a API nao responde.\n\nLembre: containers do K8s moderno estao no **containerd**, nao no Docker — `docker ps` nao os mostra.'
    },
    {
      front: 'Os comandos crictl mais usados em debug',
      back: '```bash\ncrictl ps -a              # TODOS containers (inclui Exited)\ncrictl pods               # pod sandboxes\ncrictl logs <id>          # logs do container\ncrictl logs --tail 50 <id>\ncrictl inspect <id>       # JSON do container\ncrictl inspectp <pod-id>  # JSON do sandbox\ncrictl exec -it <id> sh\ncrictl stats              # CPU/mem\n```\n\nSempre com **sudo**. Nao esqueca o **-a** (CrashLoop = Exited).'
    },
    {
      front: 'Como configurar o runtime-endpoint do crictl?',
      back: 'Via arquivo `/etc/crictl.yaml`:\n```yaml\nruntime-endpoint: unix:///run/containerd/containerd.sock\nimage-endpoint: unix:///run/containerd/containerd.sock\ntimeout: 10\n```\n\nOu por comando:\n```bash\nsudo crictl config runtime-endpoint \\\n  unix:///run/containerd/containerd.sock\n```\n\nSockets: containerd = `/run/containerd/containerd.sock`; CRI-O = `/var/run/crio/crio.sock`.'
    },
    {
      front: 'Pod vs Sandbox vs Container no CRI',
      back: 'Um Pod no CRI = **1 PodSandbox** (pause container + namespaces de rede) + **1..N containers** de aplicacao.\n\n| K8s | crictl |\n|-----|--------|\n| Pod | `crictl pods` (sandbox) |\n| Container | `crictl ps` |\n| Imagem | `crictl images` |\n\n`crictl inspectp <pod>` = detalhe do sandbox; `crictl inspect <ctr>` = detalhe do container.'
    },
    {
      front: 'Fluxo: API server caido, control plane como static pod',
      back: '1. `kubectl` falha → use crictl.\n2. `sudo crictl ps -a --name kube-apiserver` → ver estado.\n3. `sudo crictl logs <id>` → achar a causa (etcd inalcancavel, flag invalida, cert expirado).\n4. Corrigir `/etc/kubernetes/manifests/kube-apiserver.yaml`.\n5. **kubelet recria** o static pod sozinho (sem kubectl apply).\n6. Acompanhar com `journalctl -u kubelet -f`.'
    },
    {
      front: 'crictl vs ctr — qual a diferenca?',
      back: '**crictl** — interface **CRI** padrao; ve so o que o Kubernetes criou; previsivel; preferida na prova.\n\n**ctr** — CLI **nativa do containerd**; ve tudo, mas exige namespace explicito:\n```bash\nsudo ctr -n k8s.io containers list\nsudo ctr -n k8s.io images list\n```\n\nUse `ctr` so para coisas fora do CRI (pull manual, snapshots). Para debug de Pods, fique no `crictl`.'
    },
    {
      front: 'Onde ver logs quando nem o container sobe?',
      back: 'Uma camada abaixo do CRI, nos servicos systemd:\n\n```bash\n# kubelet (chama o CRI / gerencia static pods)\nsudo journalctl -u kubelet -f\n\n# containerd (o runtime)\nsudo journalctl -u containerd -f\n\nsudo systemctl status kubelet\nsudo systemctl status containerd\n```\n\nSe o kubelet nao consegue iniciar o sandbox, a causa costuma estar nesses logs (CNI, cgroups, swap, certificados).'
    }
  ],

  lab: {
    scenario: 'Usar crictl para inspecionar containers e pods no node, ler logs de um container sem kubectl, e simular o debug de um static pod do control plane com manifesto quebrado.',
    objective: 'Ganhar fluencia em crictl para os cenarios de troubleshooting do CKA onde o kubectl/API server nao esta disponivel.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Configurar e explorar o crictl',
        instruction: 'No node do control plane, configure o runtime-endpoint e liste pods, containers e imagens do runtime.',
        hints: ['Use sudo — o socket exige root', 'crictl ps -a mostra tambem os Exited'],
        solution: `\`\`\`bash
# Configurar endpoint (se ainda nao estiver)
sudo crictl config runtime-endpoint unix:///run/containerd/containerd.sock
cat /etc/crictl.yaml

# Listar pod sandboxes do control plane
sudo crictl pods --namespace kube-system

# Listar containers em execucao
sudo crictl ps

# Listar TODOS (inclui Exited)
sudo crictl ps -a | head

# Imagens no node
sudo crictl images | head
\`\`\``,
        verify: `\`\`\`bash
sudo crictl ps --name kube-apiserver
# Esperado: 1 container kube-apiserver em estado Running

sudo crictl pods --name etcd --namespace kube-system
# Esperado: o pod sandbox do etcd listado
\`\`\``
      },
      {
        title: 'Ler logs e inspecionar um container do control plane',
        instruction: 'Pegue o ID do container do kube-apiserver e leia seus logs e detalhes, simulando um cenario sem kubectl.',
        hints: ['crictl ps -q retorna so o ID', 'crictl logs <id> e crictl inspect <id>'],
        solution: `\`\`\`bash
# Capturar o ID do kube-apiserver
APISERVER=$(sudo crictl ps -a --name kube-apiserver -q | head -1)
echo "Container ID: $APISERVER"

# Ler os ultimos logs
sudo crictl logs --tail 30 $APISERVER

# Inspecionar (estado, args, mounts)
sudo crictl inspect $APISERVER | head -40

# Ver consumo de recursos
sudo crictl stats --id $APISERVER
\`\`\``,
        verify: `\`\`\`bash
sudo crictl inspect $APISERVER | grep -i '"state"'
# Esperado: "state": "CONTAINER_RUNNING"

sudo crictl logs --tail 5 $APISERVER
# Esperado: linhas de log do apiserver (sem erro de conexao)
\`\`\``
      },
      {
        title: 'Simular e debugar um static pod quebrado',
        instruction: 'Introduza um erro no manifesto do kube-apiserver, observe a quebra via crictl, depois reverta e confirme a recuperacao. (Faca em ambiente de laboratorio!)',
        hints: ['Backup do manifesto ANTES de editar', 'O kubelet reage ao salvar o arquivo'],
        solution: `\`\`\`bash
# 1. Backup obrigatorio
sudo cp /etc/kubernetes/manifests/kube-apiserver.yaml /tmp/kube-apiserver.yaml.bak

# 2. Introduzir um erro proposital (porta de etcd invalida)
sudo sed -i 's#--etcd-servers=https://127.0.0.1:2379#--etcd-servers=https://127.0.0.1:9999#' \\
  /etc/kubernetes/manifests/kube-apiserver.yaml

# 3. Aguardar o kubelet recriar e o apiserver falhar; kubectl vai parar de responder
sleep 30
sudo crictl ps -a --name kube-apiserver

# 4. Ler os logs para "descobrir" a causa
BAD=$(sudo crictl ps -a --name kube-apiserver -q | head -1)
sudo crictl logs $BAD 2>&1 | tail -20
# Esperado: erros de conexao com etcd na porta 9999

# 5. Reverter
sudo cp /tmp/kube-apiserver.yaml.bak /etc/kubernetes/manifests/kube-apiserver.yaml

# 6. Aguardar recuperacao
sleep 40
\`\`\``,
        verify: `\`\`\`bash
# kubectl deve voltar a responder apos a reversao
kubectl get nodes
# Esperado: nodes Ready novamente

sudo crictl ps --name kube-apiserver
# Esperado: kube-apiserver Running de novo
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'kubectl falha com "connection refused" — control plane fora do ar',
      difficulty: 'hard',
      symptom: 'Qualquer comando kubectl no control plane retorna "The connection to the server <ip>:6443 was refused". Voce so tem SSH no node.',
      diagnosis: `\`\`\`bash
# kubectl nao funciona -> descer para o runtime
sudo crictl ps -a --name kube-apiserver
# STATE: Running? Exited? quantos restarts?

# Se Exited/CrashLoop, ler os logs
APISERVER=$(sudo crictl ps -a --name kube-apiserver -q | head -1)
sudo crictl logs $APISERVER 2>&1 | tail -30

# Conferir o manifesto estatico
sudo cat /etc/kubernetes/manifests/kube-apiserver.yaml

# Conferir o kubelet
sudo journalctl -u kubelet --since "10 min ago" --no-pager | tail -30
\`\`\``,
      solution: `**Causas tipicas e correcao:**

1. **Manifesto com erro** (flag invalida, indentacao, --etcd-servers errado): edite \`/etc/kubernetes/manifests/kube-apiserver.yaml\`. O kubelet recria o static pod ao salvar.

2. **etcd inalcancavel**: \`sudo crictl ps -a --name etcd\` + \`crictl logs\`. Se o etcd tambem caiu, resolva-o primeiro (o apiserver depende dele).

3. **Certificado expirado**: o log do apiserver mostra "x509: certificate has expired". Renove com \`sudo kubeadm certs renew apiserver\` (e relacionados).

4. **Porta 6443 ocupada**: outro processo segurando a porta.

\`\`\`bash
# Apos corrigir o manifesto, acompanhar a recriacao
sudo journalctl -u kubelet -f
# e validar
kubectl get nodes
\`\`\`

**Prevencao:** sempre faca backup do manifesto antes de editar (\`cp ... /tmp/...bak\`).`
    },
    {
      title: 'crictl retorna erro de conexao com o runtime',
      difficulty: 'easy',
      symptom: 'Ao rodar "crictl ps" aparece um aviso/erro do tipo "connection error: desc = transport: Error while dialing dial unix ... no such file or directory".',
      diagnosis: `\`\`\`bash
# O endpoint esta configurado?
cat /etc/crictl.yaml 2>/dev/null

# O socket do containerd existe?
ls -l /run/containerd/containerd.sock

# O containerd esta rodando?
sudo systemctl status containerd
\`\`\``,
      solution: `**Causa:** runtime-endpoint ausente/errado, ou containerd parado, ou falta de sudo.

\`\`\`bash
# 1. Configurar o endpoint correto
sudo crictl config runtime-endpoint unix:///run/containerd/containerd.sock

# 2. Se o socket nao existe, o containerd pode estar parado
sudo systemctl start containerd
sudo systemctl status containerd

# 3. Sempre usar sudo
sudo crictl ps
\`\`\`

**Dica:** se o node usa CRI-O em vez de containerd, o socket e \`unix:///var/run/crio/crio.sock\`. Verifique com \`sudo systemctl status crio\`.`
    },
    {
      title: 'Pod sandbox sobe mas o container da aplicacao nao inicia',
      difficulty: 'medium',
      symptom: 'crictl pods mostra o sandbox como Ready, mas crictl ps -a mostra o container da app repetidamente Exited. Sem kubectl confiavel para o describe.',
      diagnosis: `\`\`\`bash
# Achar o pod sandbox e o container
sudo crictl pods --name minha-app
sudo crictl ps -a --name minha-app

# Logs do container que falha
CID=$(sudo crictl ps -a --name minha-app -q | head -1)
sudo crictl logs $CID 2>&1 | tail -30

# Inspecionar motivo de saida / exit code
sudo crictl inspect $CID | grep -iA3 '"state"\\|exitCode\\|reason'
\`\`\`,`,
      solution: `**Interpretacao:** o sandbox (rede/namespace) esta OK, entao o problema e do **container da aplicacao**, nao da rede.

- **ExitCode 0 e reiniciando**: o processo termina sozinho (comando errado, falta de \`command\`/\`args\` de longa duracao).
- **ExitCode 1/2 + erro nos logs**: bug da app, config/secret faltando, dependencia indisponivel.
- **OOMKilled (reason)**: memoria insuficiente — ajustar limits.

\`\`\`bash
# Ver a imagem e os args efetivos
sudo crictl inspect $CID | grep -iA10 '"args"'

# Confirmar a imagem existe no node
sudo crictl images | grep minha-app
\`\`\`

Depois de identificar, corrija via manifesto/Deployment (quando o kubectl voltar) — o runtime apenas executa o que o kubelet pediu.`
    }
  ]
};
