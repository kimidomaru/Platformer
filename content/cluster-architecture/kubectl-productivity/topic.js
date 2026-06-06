window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['cluster-architecture/kubectl-productivity'] = {
  theory: `# kubectl: Velocidade, JSONPath & Output

## Relevancia no Exame
> O CKA/CKAD sao provas **cronometradas** e 100% praticas. Quem escreve YAML do zero perde. A diferenca entre passar e nao terminar esta em: gerar manifestos com \`--dry-run=client -o yaml\`, extrair dados com **JSONPath**, ordenar/formatar saidas e dominar comandos imperativos. Este topico e sobre **economizar minutos** em cada questao.

## Setup que economiza tempo (faca primeiro)

\`\`\`bash
# Alias universal
alias k=kubectl

# Autocompletion (bash)
source <(kubectl completion bash)
complete -o default -F __start_kubectl k

# Variavel para o "do" (dry-run + yaml) — gera manifestos rapido
export do="--dry-run=client -o yaml"

# Variavel para delecao rapida e sem espera
export now="--force --grace-period=0"

# Trocar de namespace sem digitar -n toda hora
kubectl config set-context --current --namespace=<ns>
\`\`\`

> Com isso, \`k run nginx --image=nginx $do\` cospe um manifesto pronto para editar. Na prova, edite a partir do gerado em vez de escrever do zero.

## Imperativo vs Declarativo

| Abordagem | Comando | Quando |
|-----------|---------|--------|
| Imperativo | \`kubectl create/run/expose ...\` | Rapido; objetos simples |
| Imperativo → YAML | \`... --dry-run=client -o yaml > f.yaml\` | Gerar base e editar |
| Declarativo | \`kubectl apply -f f.yaml\` | Objetos complexos; idempotente |

> **Regra de ouro da prova:** gere com imperativo, refine o YAML so no que faltar, aplique com \`apply\`.

## Geradores imperativos (decore os principais)

\`\`\`bash
# Pod
kubectl run nginx --image=nginx
kubectl run busybox --image=busybox --restart=Never --command -- sleep 3600
kubectl run tmp --image=busybox --rm -it --restart=Never -- sh   # pod descartavel

# Deployment
kubectl create deployment web --image=nginx --replicas=3

# Job e CronJob
kubectl create job hello --image=busybox -- echo hi
kubectl create cronjob nightly --image=busybox --schedule="0 2 * * *" -- echo run

# Service (expor um Deployment/Pod)
kubectl expose deployment web --port=80 --target-port=8080
kubectl expose pod nginx --port=80 --name=nginx-svc --type=NodePort

# ConfigMap e Secret
kubectl create configmap app-cfg --from-literal=KEY=val --from-file=./config.txt
kubectl create secret generic db --from-literal=password=s3cr3t

# RBAC
kubectl create serviceaccount ci
kubectl create role reader --verb=get,list,watch --resource=pods
kubectl create rolebinding ci-reader --role=reader --serviceaccount=default:ci

# Namespace e ResourceQuota
kubectl create namespace dev
kubectl create quota q --hard=cpu=2,memory=2Gi,pods=10 -n dev
\`\`\`

## Editar objetos existentes (sem reescrever YAML)

\`\`\`bash
kubectl set image deployment/web nginx=nginx:1.25
kubectl set resources deployment/web --limits=cpu=500m,memory=256Mi
kubectl set env deployment/web LOG_LEVEL=debug
kubectl scale deployment/web --replicas=5
kubectl label pod nginx tier=frontend
kubectl annotate pod nginx owner=team-a
kubectl patch deployment web -p '{"spec":{"replicas":4}}'
kubectl edit deployment web            # abre no editor (use com cuidado no tempo)
\`\`\`

## Formatos de saida (-o)

\`\`\`bash
kubectl get pods                    # tabela padrao
kubectl get pods -o wide            # + node, IP
kubectl get pod nginx -o yaml       # manifesto completo
kubectl get pod nginx -o json
kubectl get pods -o name            # pod/nginx pod/web... (otimo p/ scripts)
kubectl get pods --no-headers       # sem cabecalho
\`\`\`

## JSONPath (o diferencial de velocidade)

JSONPath extrai campos especificos sem grep/awk. Sintaxe: \`-o jsonpath='{...}'\`.

\`\`\`bash
# Um campo
kubectl get pod nginx -o jsonpath='{.status.podIP}'

# Todos os nomes (range implicito com [*])
kubectl get pods -o jsonpath='{.items[*].metadata.name}'

# Uma linha por item (range explicito)
kubectl get pods -o jsonpath='{range .items[*]}{.metadata.name}{"\\t"}{.status.phase}{"\\n"}{end}'

# Imagens de todos os pods
kubectl get pods -o jsonpath='{.items[*].spec.containers[*].image}'

# Filtro: nome do node de cada pod
kubectl get pods -o jsonpath='{range .items[*]}{.metadata.name}{" -> "}{.spec.nodeName}{"\\n"}{end}'

# Filtro por condicao [?(@.campo=="valor")]
kubectl get nodes -o jsonpath='{.items[?(@.spec.unschedulable)].metadata.name}'

# Versao do kubelet por node
kubectl get nodes -o jsonpath='{.items[*].status.nodeInfo.kubeletVersion}'
\`\`\`

> Tokens uteis: \`{range}...{end}\` para iterar, \`{"\\n"}\`/\`{"\\t"}\` para separadores, \`[?(@.x=="y")]\` para filtrar.

## custom-columns (tabela sob medida)

\`\`\`bash
kubectl get pods -o custom-columns=\\
NAME:.metadata.name,NODE:.spec.nodeName,PHASE:.status.phase

kubectl get pods -o custom-columns='NAME:.metadata.name,IMAGE:.spec.containers[*].image'
\`\`\`

## --sort-by (ordenar resultados)

\`\`\`bash
# Pods por numero de restarts (achar o mais instavel)
kubectl get pods --sort-by='.status.containerStatuses[0].restartCount'

# Eventos por timestamp
kubectl get events --sort-by='.lastTimestamp'

# Nodes por capacidade de CPU
kubectl get nodes --sort-by='.status.capacity.cpu'
\`\`\`

## Seletores: labels e fields

\`\`\`bash
# Por label
kubectl get pods -l app=web
kubectl get pods -l 'env in (prod,staging)'
kubectl get pods -l '!canary'                 # que NAO tem o label canary

# Por field
kubectl get pods --field-selector status.phase=Running
kubectl get pods --field-selector spec.nodeName=node-1
kubectl get events --field-selector type=Warning
\`\`\`

## kubectl explain (documentacao sem sair do terminal)

\`\`\`bash
kubectl explain pod.spec.containers
kubectl explain deployment.spec.strategy --recursive   # arvore completa de campos
kubectl explain pvc.spec.resources
\`\`\`

> Na prova voce nao tem o site da doc, mas tem \`kubectl explain\`. Use-o para lembrar a estrutura exata de um campo.

## Descoberta de recursos

\`\`\`bash
kubectl api-resources                          # todos os kinds + shortnames + apiGroup
kubectl api-resources --namespaced=true        # so namespaced
kubectl api-versions                           # versoes de API disponiveis
kubectl explain <recurso> | head -3            # apiVersion/kind corretos
\`\`\`

## Observar e comparar

\`\`\`bash
kubectl get pods -w                 # watch (acompanhar mudancas)
kubectl get pods -A                 # todos os namespaces
kubectl diff -f f.yaml              # o que o apply mudaria
kubectl rollout status deploy/web   # esperar rollout terminar
\`\`\`

## Dica de vim para a prova (YAML)

Adicione ao \`~/.vimrc\` no inicio da prova para nao sofrer com indentacao:

\`\`\`
set tabstop=2 shiftwidth=2 expandtab
\`\`\`

## Erros Comuns

1. **Escrever YAML do zero** quando \`$do\` (\`--dry-run=client -o yaml\`) geraria a base em segundos.
2. **\`--dry-run\` sem \`=client\`** — em versoes novas o default mudou; seja explicito (\`=client\`).
3. **Esquecer \`{range}{end}\`** no JSONPath e ver tudo numa linha so.
4. **Confundir label selector (\`-l\`) com field selector (\`--field-selector\`)** — campos sao limitados (poucos suportados, ex.: \`status.phase\`, \`spec.nodeName\`).
5. **Usar \`kubectl edit\`** para mudancas grandes sob pressao — set/patch costumam ser mais rapidos e menos sujeitos a erro de indentacao.
6. **Nao trocar o namespace do contexto** e digitar \`-n\` em todo comando.

## Killer.sh Style Challenge

> Sem escrever YAML manualmente:
>
> 1. Gere (sem aplicar) o manifesto de um Deployment \`api\` com imagem \`nginx:1.25\` e 3 replicas, salvando em \`api.yaml\`.
> 2. Liste todos os pods do namespace \`kube-system\` ordenados por numero de restarts.
> 3. Extraia, em uma linha por pod, o nome e o nodeName de todos os pods de \`kube-system\` usando JSONPath.
> 4. Mostre uma tabela custom-columns com NAME e IMAGE dos pods de \`kube-system\`.
>
> Dica: \`k create deployment api --image=nginx:1.25 --replicas=3 $do > api.yaml\`; \`--sort-by\`; \`-o jsonpath='{range .items[*]}...{end}'\`; \`-o custom-columns=...\`.
`,

  quiz: [
    {
      question: 'Qual a forma mais rapida de obter um manifesto YAML base de um Deployment sem escreve-lo a mao nem criar o objeto no cluster?',
      options: [
        'kubectl get deployment web -o yaml',
        'kubectl create deployment web --image=nginx --dry-run=client -o yaml',
        'kubectl apply -f deployment.yaml',
        'kubectl explain deployment'
      ],
      correct: 1,
      explanation: 'kubectl create ... --dry-run=client -o yaml gera o manifesto SEM enviar ao cluster (client-side) e imprime o YAML pronto para editar/salvar. get -o yaml so funciona para um objeto ja existente; apply cria de fato; explain so mostra documentacao de campos.',
      reference: 'Secao Imperativo vs Declarativo e Setup (variavel $do).'
    },
    {
      question: 'Voce precisa listar uma linha por pod com nome e fase. Qual JSONPath produz isso?',
      options: [
        "-o jsonpath='{.items[*].metadata.name}'",
        "-o jsonpath='{range .items[*]}{.metadata.name}{\"\\t\"}{.status.phase}{\"\\n\"}{end}'",
        "-o custom-columns=NAME:.metadata.name",
        "-o name"
      ],
      correct: 1,
      explanation: 'O bloco {range .items[*]}...{end} itera item a item, e {\"\\t\"}/{\"\\n\"} inserem separadores e quebra de linha. Sem o range, .items[*] coloca tudo numa unica linha. custom-columns tambem resolveria a tabela, mas a pergunta pede JSONPath.',
      reference: 'Secao JSONPath — uso de {range}{end} e separadores.'
    },
    {
      question: 'Qual comando encontra rapidamente o pod com MAIOR numero de restarts?',
      options: [
        "kubectl get pods -o wide",
        "kubectl get pods --field-selector status.phase=Running",
        "kubectl get pods --sort-by='.status.containerStatuses[0].restartCount'",
        "kubectl get pods -l restarts=high"
      ],
      correct: 2,
      explanation: '--sort-by aceita um caminho JSONPath e ordena a saida por ele. Ordenando por .status.containerStatuses[0].restartCount, o pod mais instavel aparece no fim da lista. field-selector filtra por fase (nao ordena por restart); labels nao refletem restarts automaticamente.',
      reference: 'Secao --sort-by.'
    },
    {
      question: 'Qual a diferenca entre "-l app=web" e "--field-selector spec.nodeName=node-1"?',
      options: [
        'Sao sinonimos; ambos filtram por label',
        '-l filtra por LABELS (metadata.labels); --field-selector filtra por CAMPOS do objeto, e so alguns campos sao suportados',
        '--field-selector e mais lento mas suporta qualquer campo',
        '-l so funciona com Deployments'
      ],
      correct: 1,
      explanation: 'O selector de label (-l) casa contra metadata.labels e suporta operadores (in, notin, !). O field-selector casa contra campos reais do objeto (ex.: status.phase, spec.nodeName, metadata.namespace), mas o conjunto de campos suportados e limitado por recurso. Confundir os dois e um erro comum.',
      reference: 'Secao Seletores: labels e fields + Erros Comuns (item 4).'
    },
    {
      question: 'Na prova voce nao lembra a estrutura exata de "pod.spec.containers". Como descobrir sem acessar a internet?',
      options: [
        'kubectl describe pod',
        'kubectl api-resources',
        'kubectl explain pod.spec.containers (opcionalmente --recursive)',
        'kubectl get pod -o yaml de um pod qualquer'
      ],
      correct: 2,
      explanation: 'kubectl explain mostra a documentacao dos campos direto do servidor da API, incluindo tipos e descricoes. Com --recursive ele imprime a arvore completa de campos. E a fonte oficial offline durante a prova. api-resources lista kinds, nao a estrutura de campos.',
      reference: 'Secao kubectl explain.'
    },
    {
      question: 'O que faz "export do=\'--dry-run=client -o yaml\'" combinado com "k run nginx --image=nginx $do"?',
      options: [
        'Cria o pod nginx imediatamente no cluster',
        'Imprime o manifesto YAML do pod sem cria-lo, permitindo redirecionar para um arquivo',
        'Valida o pod no servidor (server-side) e cria se valido',
        'Aplica o pod e mostra o diff'
      ],
      correct: 1,
      explanation: 'A variavel $do expande para --dry-run=client -o yaml, entao o comando gera o YAML localmente (sem tocar o cluster) e o imprime. E o atalho classico de prova: k run/create ... $do > arquivo.yaml para depois editar e aplicar.',
      reference: 'Secao Setup que economiza tempo.'
    },
    {
      question: 'Qual saida e ideal para usar o resultado de "kubectl get" como entrada de outro comando em script (ex.: deletar varios)?',
      options: [
        '-o wide',
        '-o yaml',
        '-o name (ex.: pod/nginx pod/web)',
        '--no-headers sozinho'
      ],
      correct: 2,
      explanation: '-o name produz identificadores no formato tipo/nome (pod/nginx), que podem ser passados diretamente a outro kubectl (ex.: kubectl delete $(kubectl get pods -l x=y -o name)). E mais robusto que recortar colunas de texto com awk.',
      reference: 'Secao Formatos de saida (-o).'
    }
  ],

  flashcards: [
    {
      front: 'Setup de velocidade no inicio da prova (alias, completion, $do)',
      back: '```bash\nalias k=kubectl\nsource <(kubectl completion bash)\ncomplete -o default -F __start_kubectl k\nexport do="--dry-run=client -o yaml"\nexport now="--force --grace-period=0"\nkubectl config set-context --current --namespace=<ns>\n```\n\nDepois: `k run nginx --image=nginx $do > pod.yaml` para gerar e editar.'
    },
    {
      front: 'Geradores imperativos essenciais',
      back: '```bash\nk run pod --image=nginx\nk create deployment web --image=nginx --replicas=3\nk create job j --image=busybox -- echo hi\nk create cronjob c --image=busybox --schedule="*/5 * * * *" -- date\nk expose deploy web --port=80 --target-port=8080\nk create configmap cm --from-literal=K=V\nk create secret generic s --from-literal=p=123\nk create role r --verb=get,list --resource=pods\n```'
    },
    {
      front: 'JSONPath: campo unico, lista e uma linha por item',
      back: '```bash\n# campo unico\n-o jsonpath=\'{.status.podIP}\'\n\n# todos os nomes (uma linha)\n-o jsonpath=\'{.items[*].metadata.name}\'\n\n# uma linha por item\n-o jsonpath=\'{range .items[*]}{.metadata.name}{\"\\t\"}{.status.phase}{\"\\n\"}{end}\'\n\n# filtro por condicao\n-o jsonpath=\'{.items[?(@.spec.unschedulable)].metadata.name}\'\n```'
    },
    {
      front: 'custom-columns vs --sort-by',
      back: '**custom-columns** — tabela sob medida:\n```bash\nk get pods -o custom-columns=\\\nNAME:.metadata.name,NODE:.spec.nodeName\n```\n\n**--sort-by** — ordena por um JSONPath:\n```bash\nk get pods --sort-by=\'.status.containerStatuses[0].restartCount\'\nk get events --sort-by=\'.lastTimestamp\'\n```'
    },
    {
      front: 'Label selector vs field selector',
      back: '**-l (label)** — casa metadata.labels, suporta operadores:\n```bash\nk get pods -l app=web\nk get pods -l \'env in (prod,staging)\'\nk get pods -l \'!canary\'\n```\n\n**--field-selector** — casa campos do objeto (conjunto limitado):\n```bash\nk get pods --field-selector status.phase=Running\nk get pods --field-selector spec.nodeName=node-1\n```'
    },
    {
      front: 'Como editar objetos sem reescrever YAML?',
      back: '```bash\nk set image deploy/web nginx=nginx:1.25\nk set resources deploy/web --limits=cpu=500m\nk set env deploy/web LOG=debug\nk scale deploy/web --replicas=5\nk label pod nginx tier=frontend\nk patch deploy web -p \'{\"spec\":{\"replicas\":4}}\'\n```\n\nMais rapido e seguro que `kubectl edit` sob pressao.'
    },
    {
      front: 'kubectl explain e descoberta de recursos',
      back: '```bash\nk explain pod.spec.containers\nk explain deploy.spec.strategy --recursive\nk api-resources              # kinds + shortnames + group\nk api-resources --namespaced=true\nk api-versions               # versoes de API\n```\n\n`explain` e a doc oficial **offline** durante a prova.'
    }
  ],

  lab: {
    scenario: 'Praticar o fluxo imperativo de geracao de manifestos e a extracao de dados com JSONPath, custom-columns e --sort-by, do jeito que acelera a prova.',
    objective: 'Construir memoria muscular para gerar recursos rapidamente e consultar o cluster sem escrever YAML do zero.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Setup e geracao imperativa de manifestos',
        instruction: 'Configure alias e a variavel $do, depois gere (sem aplicar) manifestos de Pod, Deployment e Service.',
        hints: ['export do="--dry-run=client -o yaml"', 'Redirecione a saida para arquivos'],
        solution: `\`\`\`bash
alias k=kubectl
export do="--dry-run=client -o yaml"

# Gerar manifestos SEM criar no cluster
k run nginx --image=nginx $do > pod.yaml
k create deployment web --image=nginx --replicas=3 $do > deploy.yaml
k create job hello --image=busybox $do -- echo hi > job.yaml

# Conferir o conteudo gerado
head -15 deploy.yaml

# Agora sim aplicar (de verdade) para os proximos passos
kubectl create deployment web --image=nginx --replicas=3
kubectl create deployment api --image=nginx --replicas=2
\`\`\``,
        verify: `\`\`\`bash
ls pod.yaml deploy.yaml job.yaml
# Esperado: os 3 arquivos gerados

kubectl get deploy
# Esperado: web (3) e api (2) criados
\`\`\``
      },
      {
        title: 'Output e seletores',
        instruction: 'Explore -o wide/name, label e field selectors para localizar pods rapidamente.',
        hints: ['-o name e otimo para pipelines', '--field-selector tem campos limitados'],
        solution: `\`\`\`bash
kubectl get pods -o wide
kubectl get pods -o name
kubectl get pods --no-headers | wc -l

# Por label (deployments criam o label app=<nome>)
kubectl get pods -l app=web

# Por field
kubectl get pods --field-selector status.phase=Running
kubectl get pods --field-selector spec.nodeName=$(kubectl get nodes -o jsonpath='{.items[0].metadata.name}')
\`\`\``,
        verify: `\`\`\`bash
kubectl get pods -l app=web --no-headers | wc -l
# Esperado: 3 (replicas do deployment web)

kubectl get pods -o name | head
# Esperado: linhas no formato pod/web-xxxx
\`\`\``
      },
      {
        title: 'JSONPath, custom-columns e --sort-by',
        instruction: 'Extraia nome+node por pod com JSONPath, monte uma tabela custom-columns e ordene por restarts.',
        hints: ['{range .items[*]}...{end}', "--sort-by aceita um caminho JSONPath"],
        solution: `\`\`\`bash
# Uma linha por pod: nome -> node
kubectl get pods -o jsonpath='{range .items[*]}{.metadata.name}{" -> "}{.spec.nodeName}{"\\n"}{end}'

# Tabela sob medida
kubectl get pods -o custom-columns=NAME:.metadata.name,NODE:.spec.nodeName,PHASE:.status.phase

# Ordenar por numero de restarts
kubectl get pods --sort-by='.status.containerStatuses[0].restartCount'

# Imagens de todos os pods
kubectl get pods -o jsonpath='{.items[*].spec.containers[*].image}'

# Versao do kubelet por node
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\\t"}{.status.nodeInfo.kubeletVersion}{"\\n"}{end}'
\`\`\``,
        verify: `\`\`\`bash
kubectl get pods -o custom-columns=NAME:.metadata.name,NODE:.spec.nodeName --no-headers | head
# Esperado: colunas NAME e NODE preenchidas

# Limpeza
kubectl delete deployment web api
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Comando --dry-run cria o objeto em vez de so imprimir o YAML',
      difficulty: 'easy',
      symptom: 'Voce rodou um create esperando apenas ver o YAML, mas o objeto foi efetivamente criado no cluster.',
      diagnosis: `\`\`\`bash
# Provavel: faltou =client no dry-run, ou faltou o -o yaml
kubectl create deployment x --image=nginx --dry-run -o yaml   # ambiguo em versoes antigas
\`\`\``,
      solution: `**Causa:** \`--dry-run\` sem o modo explicito. Em versoes modernas o correto e \`--dry-run=client\` (validacao/geracao local, nao toca o cluster). \`--dry-run=server\` envia ao servidor para validar (mas tambem nao persiste).

\`\`\`bash
# Forma correta
kubectl create deployment x --image=nginx --dry-run=client -o yaml

# Se o objeto foi criado por engano:
kubectl delete deployment x
\`\`\`

**Prevencao:** padronize com a variavel \`export do="--dry-run=client -o yaml"\` e use sempre \`$do\`.`
    },
    {
      title: 'JSONPath imprime tudo numa unica linha',
      difficulty: 'easy',
      symptom: 'A saida com -o jsonpath gruda todos os valores sem quebra de linha, dificultando a leitura.',
      diagnosis: `\`\`\`bash
# Sem range, [*] concatena tudo
kubectl get pods -o jsonpath='{.items[*].metadata.name}'
# pod1 pod2 pod3 (uma linha so)
\`\`\``,
      solution: `**Causa:** uso de \`{.items[*]...}\` sem o bloco \`{range}...{end}\`, que e o responsavel por iterar e permitir separadores por item.

\`\`\`bash
# Uma linha por item com \\n explicito
kubectl get pods -o jsonpath='{range .items[*]}{.metadata.name}{"\\n"}{end}'

# Com mais campos e tab
kubectl get pods -o jsonpath='{range .items[*]}{.metadata.name}{"\\t"}{.status.phase}{"\\n"}{end}'
\`\`\`

**Alternativa:** quando so quer uma tabela legivel, \`-o custom-columns=...\` costuma ser mais simples que JSONPath.`
    }
  ]
};
