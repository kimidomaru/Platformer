window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['cks-runtime-security/audit-logging'] = {

  theory: `# Kubernetes Audit Logging

## Relevancia no CKS
> O dominio "Monitoring, Logging and Runtime Security" vale **20%** do CKS. Audit logging registra todas as acoes na API do Kubernetes. Voce deve saber criar audit policies, configurar backends e analisar logs.

---

## O que e Audit Logging?

Audit logging registra **quem** fez **o que**, **quando**, em **qual recurso** e **o resultado**. E essencial para seguranca, compliance e forense.

---

## Audit Policy

A audit policy define **o que registrar** e com **qual nivel de detalhe**.

### Niveis de Audit

| Nivel | Registra | Dados |
|-------|---------|-------|
| \`None\` | Nada | - |
| \`Metadata\` | Request metadata | Quem, quando, recurso, resultado |
| \`Request\` | Metadata + request body | Inclui o conteudo do request |
| \`RequestResponse\` | Metadata + request + response body | Tudo (mais volume) |

### Stages

| Stage | Quando |
|-------|--------|
| \`RequestReceived\` | Request recebido (antes de processamento) |
| \`ResponseStarted\` | Headers da resposta enviados (long-running) |
| \`ResponseComplete\` | Resposta completa enviada |
| \`Panic\` | Erro de panic no API Server |

---

## Criando uma Audit Policy

\`\`\`yaml
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
  # Nao logar requests de health checks
  - level: None
    nonResourceURLs:
    - /healthz*
    - /readyz*
    - /livez*

  # Nao logar eventos do system
  - level: None
    users: ["system:kube-proxy"]
    verbs: ["watch"]
    resources:
    - group: ""
      resources: ["endpoints", "services", "services/status"]

  # Logar mudancas em secrets com nivel maximo
  - level: RequestResponse
    resources:
    - group: ""
      resources: ["secrets", "configmaps"]
    verbs: ["create", "update", "patch", "delete"]

  # Logar todas as mudancas em RBAC
  - level: RequestResponse
    resources:
    - group: "rbac.authorization.k8s.io"
      resources: ["clusterroles", "clusterrolebindings", "roles", "rolebindings"]

  # Logar acoes em pods (metadata apenas)
  - level: Metadata
    resources:
    - group: ""
      resources: ["pods"]
    verbs: ["create", "delete"]

  # Padrao: metadata para tudo mais
  - level: Metadata
    omitStages:
    - "RequestReceived"
\`\`\`

### Regras Importantes

- Regras sao avaliadas **em ordem** — a primeira que corresponde e aplicada
- \`omitStages\` exclui stages especificos do registro
- Regras mais especificas devem vir primeiro

---

## Configurando o API Server

\`\`\`yaml
# /etc/kubernetes/manifests/kube-apiserver.yaml
spec:
  containers:
  - command:
    - kube-apiserver
    - --audit-policy-file=/etc/kubernetes/audit/policy.yaml
    - --audit-log-path=/var/log/kubernetes/audit.log
    - --audit-log-maxage=30
    - --audit-log-maxbackup=10
    - --audit-log-maxsize=100
    volumeMounts:
    - name: audit-policy
      mountPath: /etc/kubernetes/audit
      readOnly: true
    - name: audit-log
      mountPath: /var/log/kubernetes
  volumes:
  - name: audit-policy
    hostPath:
      path: /etc/kubernetes/audit
      type: DirectoryOrCreate
  - name: audit-log
    hostPath:
      path: /var/log/kubernetes
      type: DirectoryOrCreate
\`\`\`

### Flags do Audit

| Flag | Descricao | Valor Recomendado |
|------|-----------|------------------|
| \`--audit-policy-file\` | Path da policy | /etc/kubernetes/audit/policy.yaml |
| \`--audit-log-path\` | Path do log | /var/log/kubernetes/audit.log |
| \`--audit-log-maxage\` | Dias para manter | 30 |
| \`--audit-log-maxbackup\` | Numero de backups | 10 |
| \`--audit-log-maxsize\` | Tamanho maximo (MB) | 100 |

---

## Audit Backends

### Log Backend (arquivo)
\`\`\`yaml
    - --audit-log-path=/var/log/kubernetes/audit.log
\`\`\`

### Webhook Backend (externo)
\`\`\`yaml
    - --audit-webhook-config-file=/etc/kubernetes/audit/webhook-config.yaml
    - --audit-webhook-batch-max-wait=5s
\`\`\`

\`\`\`yaml
# webhook-config.yaml
apiVersion: v1
kind: Config
clusters:
- cluster:
    server: https://audit-collector.example.com/audit
  name: audit-webhook
contexts:
- context:
    cluster: audit-webhook
  name: default
current-context: default
\`\`\`

---

## Estrutura do Audit Event

\`\`\`json
{
  "kind": "Event",
  "apiVersion": "audit.k8s.io/v1",
  "level": "RequestResponse",
  "stage": "ResponseComplete",
  "requestURI": "/api/v1/namespaces/default/secrets",
  "verb": "create",
  "user": {
    "username": "admin",
    "groups": ["system:masters"]
  },
  "sourceIPs": ["10.0.0.1"],
  "objectRef": {
    "resource": "secrets",
    "namespace": "default",
    "name": "my-secret",
    "apiVersion": "v1"
  },
  "responseStatus": {
    "code": 201
  },
  "requestReceivedTimestamp": "2024-01-15T10:30:00Z",
  "stageTimestamp": "2024-01-15T10:30:00Z"
}
\`\`\`

---

## Analisando Audit Logs

\`\`\`bash
# Filtrar por usuario
cat /var/log/kubernetes/audit.log | jq 'select(.user.username=="admin")'

# Filtrar por recurso
cat /var/log/kubernetes/audit.log | jq 'select(.objectRef.resource=="secrets")'

# Filtrar por verb (create, delete)
cat /var/log/kubernetes/audit.log | jq 'select(.verb=="delete")'

# Filtrar por codigo de resposta (403 = Forbidden)
cat /var/log/kubernetes/audit.log | jq 'select(.responseStatus.code==403)'

# Detectar acessos a secrets suspeitos
cat /var/log/kubernetes/audit.log | \\
  jq 'select(.objectRef.resource=="secrets" and .verb=="get" and .user.username!="system:apiserver")'
\`\`\`

---

## Erros Comuns

1. **Logar tudo em RequestResponse** — gera volume excessivo
2. **Nao excluir health checks** — polui o log com requests irrelevantes
3. **Nao montar volumes corretos** — API Server nao inicia
4. **Policy muito permissiva (None)** — perde eventos criticos
5. **Nao rotacionar logs** — disco cheio pode crashar o node

---

## Killer.sh Style Challenge

> Crie uma audit policy que: 1) Nao logue health checks, 2) Logue mudancas em secrets com nivel RequestResponse, 3) Logue todas as outras acoes com nivel Metadata. Configure o API Server para usar essa policy e verifique que audit logs sao gerados.
`,

  quiz: [
    {
      question: 'Qual nivel de audit registra tanto o request quanto o response body?',
      options: ['None', 'Metadata', 'Request', 'RequestResponse'],
      correct: 3,
      explanation: 'RequestResponse registra metadata + request body + response body. E o nivel mais completo mas tambem o que gera mais volume de logs.',
      reference: 'Conceito relacionado: Audit levels — niveis de detalhe.'
    },
    {
      question: 'Qual flag do API Server define o path da audit policy?',
      options: ['--audit-config', '--audit-policy-file', '--audit-rules', '--audit-file'],
      correct: 1,
      explanation: '--audit-policy-file define o path do arquivo YAML com a audit policy. E obrigatorio para habilitar audit logging.',
      reference: 'Conceito relacionado: API Server — configuracao de audit.'
    },
    {
      question: 'Por que e importante ordenar as regras de audit corretamente?',
      options: [
        'Regras fora de ordem causam erro',
        'A primeira regra que corresponde e aplicada, ignorando as seguintes',
        'A ultima regra tem prioridade',
        'Todas as regras que correspondem sao aplicadas'
      ],
      correct: 1,
      explanation: 'As regras sao avaliadas em ordem sequencial. A primeira que corresponde ao request e aplicada e as demais sao ignoradas. Regras mais especificas devem vir antes das genericas.',
      reference: 'Conceito relacionado: Audit Policy — ordenacao de regras.'
    },
    {
      question: 'Quais backends de audit o Kubernetes suporta?',
      options: [
        'Apenas arquivo de log',
        'Log (arquivo) e Webhook (externo)',
        'Apenas webhook',
        'Log, webhook e database'
      ],
      correct: 1,
      explanation: 'Kubernetes suporta dois backends: Log (arquivo no disco) via --audit-log-path e Webhook (envio para servico externo) via --audit-webhook-config-file.',
      reference: 'Conceito relacionado: Audit backends.'
    },
    {
      question: 'O que o campo omitStages faz na audit policy?',
      options: [
        'Remove recursos do audit',
        'Exclui stages especificos do registro para a regra',
        'Define stages obrigatorios',
        'Desabilita o audit para a regra'
      ],
      correct: 1,
      explanation: 'omitStages lista stages que nao serao registrados para a regra. Ex: omitStages: [\"RequestReceived\"] evita registrar o evento quando o request chega (antes do processamento).',
      reference: 'Conceito relacionado: Audit Policy — omitStages.'
    },
    {
      question: 'Como filtrar audit logs para encontrar acessos nao autorizados?',
      options: [
        'Filtrar por verb=unauthorized',
        'Filtrar por responseStatus.code==403 (Forbidden)',
        'Filtrar por level=Error',
        'Filtrar por stage=Denied'
      ],
      correct: 1,
      explanation: 'O codigo HTTP 403 indica Forbidden (nao autorizado). Filtrar audit logs por responseStatus.code==403 mostra tentativas de acesso negadas pelo RBAC.',
      reference: 'Conceito relacionado: Audit log analysis — detecao de incidentes.'
    },
    {
      question: 'Qual a consequencia de nao rotacionar audit logs?',
      options: [
        'Logs ficam mais lentos',
        'O disco pode encher e causar falha do node/API Server',
        'Logs sao automaticamente deletados',
        'Nenhuma, logs tem tamanho fixo'
      ],
      correct: 1,
      explanation: 'Sem rotacao (--audit-log-maxage, --audit-log-maxbackup, --audit-log-maxsize), logs crescem indefinidamente. Disco cheio pode causar falha do API Server e do node.',
      reference: 'Conceito relacionado: Audit logging — rotacao e retencao.'
    }
  ],

  flashcards: [
    { front: 'Quais sao os niveis de audit?', back: 'None (nada), Metadata (quem/quando/recurso), Request (metadata + request body), RequestResponse (metadata + request + response). Usar Metadata para maioria e RequestResponse para secrets/RBAC.' },
    { front: 'Quais sao os stages de audit?', back: 'RequestReceived (antes de processar), ResponseStarted (headers enviados), ResponseComplete (resposta completa), Panic (erro critico). Mais comum: ResponseComplete.' },
    { front: 'Como ordenar regras de audit policy?', back: 'Mais especificas primeiro (ex: None para healthchecks), depois regras por recurso (RequestResponse para secrets), e regra generica por ultimo (Metadata para tudo).' },
    { front: 'Quais flags configurar no API Server para audit?', back: '--audit-policy-file (policy YAML), --audit-log-path (caminho do log), --audit-log-maxage (dias), --audit-log-maxbackup (num backups), --audit-log-maxsize (MB).' },
    { front: 'Quais backends de audit existem?', back: 'Log (arquivo local): --audit-log-path. Webhook (externo): --audit-webhook-config-file. Ambos podem ser usados simultaneamente.' },
    { front: 'Como detectar tentativas de acesso nao autorizado nos audit logs?', back: 'Filtrar por responseStatus.code==403 (Forbidden). Tambem monitorar: acessos a secrets por usuarios incomuns, criacao de ClusterRoleBindings, verbs create/delete em RBAC.' },
    { front: 'O que sao volumes necessarios para audit no API Server?', back: 'Montar: 1) Diretorio da policy (/etc/kubernetes/audit) como readOnly. 2) Diretorio de logs (/var/log/kubernetes) com escrita. Ambos como hostPath no manifest do API Server.' }
  ],

  lab: {
    scenario: 'O cluster nao possui audit logging configurado. Voce precisa criar uma audit policy e configurar o API Server.',
    objective: 'Criar audit policy, configurar o API Server e verificar que logs sao gerados corretamente.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Criar Audit Policy',
        instruction: 'Crie uma audit policy que nao registre health checks, registre mudancas em secrets com nivel RequestResponse, e use Metadata para tudo mais.',
        hints: [
          'Crie o arquivo em /etc/kubernetes/audit/policy.yaml',
          'Coloque regras None primeiro (health checks)',
          'Use RequestResponse para secrets e RBAC',
          'Use Metadata como regra padrao final'
        ],
        solution: '```bash\nsudo mkdir -p /etc/kubernetes/audit\nsudo tee /etc/kubernetes/audit/policy.yaml <<EOF\napiVersion: audit.k8s.io/v1\nkind: Policy\nrules:\n- level: None\n  nonResourceURLs:\n  - /healthz*\n  - /readyz*\n  - /livez*\n- level: None\n  users: [\"system:kube-proxy\"]\n  verbs: [\"watch\"]\n- level: RequestResponse\n  resources:\n  - group: \"\"\n    resources: [\"secrets\"]\n- level: RequestResponse\n  resources:\n  - group: \"rbac.authorization.k8s.io\"\n    resources: [\"clusterroles\", \"clusterrolebindings\", \"roles\", \"rolebindings\"]\n- level: Metadata\n  omitStages:\n  - \"RequestReceived\"\nEOF\n```',
        verify: '```bash\n# Verificar arquivo criado\ncat /etc/kubernetes/audit/policy.yaml\n# Saida esperada: policy YAML valido com regras None, RequestResponse e Metadata\n\n# Validar YAML\npython3 -c \"import yaml; yaml.safe_load(open(\\\"/etc/kubernetes/audit/policy.yaml\\\"))\" && echo \"YAML valido\"\n```'
      },
      {
        title: 'Configurar API Server',
        instruction: 'Adicione as flags de audit ao manifest do API Server e monte os volumes necessarios.',
        hints: [
          'Edite /etc/kubernetes/manifests/kube-apiserver.yaml',
          'Adicione flags: --audit-policy-file, --audit-log-path, --audit-log-maxage/maxbackup/maxsize',
          'Adicione volumeMounts e volumes para policy e logs'
        ],
        solution: '```bash\n# Backup do manifest\nsudo cp /etc/kubernetes/manifests/kube-apiserver.yaml /tmp/kube-apiserver.yaml.bak\n\n# Editar manifest para adicionar:\n# Flags:\n#   - --audit-policy-file=/etc/kubernetes/audit/policy.yaml\n#   - --audit-log-path=/var/log/kubernetes/audit.log\n#   - --audit-log-maxage=30\n#   - --audit-log-maxbackup=10\n#   - --audit-log-maxsize=100\n# VolumeMounts:\n#   - name: audit-policy\n#     mountPath: /etc/kubernetes/audit\n#     readOnly: true\n#   - name: audit-log\n#     mountPath: /var/log/kubernetes\n# Volumes:\n#   - name: audit-policy\n#     hostPath:\n#       path: /etc/kubernetes/audit\n#       type: DirectoryOrCreate\n#   - name: audit-log\n#     hostPath:\n#       path: /var/log/kubernetes\n#       type: DirectoryOrCreate\n\nsudo vi /etc/kubernetes/manifests/kube-apiserver.yaml\n```',
        verify: '```bash\n# Aguardar API Server reiniciar\nkubectl wait --for=condition=Ready pod -l component=kube-apiserver -n kube-system --timeout=120s\n\n# Verificar que audit esta configurado\nps aux | grep kube-apiserver | grep audit-policy-file\n# Saida esperada: --audit-policy-file=/etc/kubernetes/audit/policy.yaml\n\n# Verificar que log esta sendo gerado\nsudo ls -la /var/log/kubernetes/audit.log\n# Saida esperada: arquivo existente com tamanho > 0\n```'
      },
      {
        title: 'Gerar e Analisar Audit Events',
        instruction: 'Gere eventos criando/deletando recursos e analise os audit logs.',
        hints: [
          'Crie e delete um secret para gerar eventos',
          'Use jq para filtrar o log',
          'Procure por eventos com verb=create e resource=secrets'
        ],
        solution: '```bash\n# Gerar eventos\nkubectl create secret generic audit-test --from-literal=key=value\nkubectl delete secret audit-test\n\n# Analisar logs\nsudo cat /var/log/kubernetes/audit.log | \\\n  jq \"select(.objectRef.resource==\\\"secrets\\\" and .objectRef.name==\\\"audit-test\\\")\" | \\\n  jq \"{verb: .verb, user: .user.username, resource: .objectRef.name, code: .responseStatus.code}\"\n```',
        verify: '```bash\n# Verificar que eventos de secrets foram registrados\nsudo cat /var/log/kubernetes/audit.log | \\\n  jq -r \"select(.objectRef.resource==\\\"secrets\\\") | .verb\" | sort | uniq -c\n# Saida esperada: create, delete e possivelmente get/list\n\n# Verificar que health checks NAO foram registrados\nsudo cat /var/log/kubernetes/audit.log | jq \"select(.requestURI | startswith(\\\"/healthz\\\"))\" | wc -l\n# Saida esperada: 0\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'API Server Nao Inicia Apos Habilitar Audit',
      difficulty: 'medium',
      symptom: 'Apos adicionar flags de audit ao manifest, o API Server nao reinicia.',
      diagnosis: '```bash\n# Verificar logs do container\nsudo crictl ps -a | grep kube-apiserver\nsudo crictl logs <container-id>\n\n# Verificar kubelet\nsudo journalctl -u kubelet --since \"5 minutes ago\" | grep apiserver\n\n# Verificar se o arquivo de policy existe\nsudo ls -la /etc/kubernetes/audit/policy.yaml\n\n# Verificar YAML da policy\nsudo python3 -c \"import yaml; yaml.safe_load(open(\\\"/etc/kubernetes/audit/policy.yaml\\\"))\"\n```',
      solution: 'Causas comuns: 1) Arquivo de policy nao existe no path montado. 2) YAML invalido na policy. 3) Volumes nao montados corretamente (verificar volumeMounts e volumes no manifest). 4) Diretorio de logs nao existe (usar type: DirectoryOrCreate). Restaurar backup e aplicar mudancas novamente.'
    },
    {
      title: 'Audit Logs Nao Registrando Eventos Esperados',
      difficulty: 'hard',
      symptom: 'Audit logging esta configurado mas eventos especificos (como acesso a secrets) nao aparecem nos logs.',
      diagnosis: '```bash\n# Verificar policy carregada\nsudo cat /etc/kubernetes/audit/policy.yaml\n\n# Gerar evento de teste\nkubectl create secret generic test-audit --from-literal=x=y\n\n# Procurar no log\nsudo tail -100 /var/log/kubernetes/audit.log | jq \"select(.objectRef.name==\\\"test-audit\\\")\"\n\n# Verificar se ha regra None capturando antes\nsudo cat /etc/kubernetes/audit/policy.yaml | head -20\n```',
      solution: 'A ordem das regras importa. Se uma regra None generica esta antes da regra de secrets, os eventos sao ignorados. Verificar: 1) Ordem das regras (None especificas primeiro, genericas por ultimo). 2) omitStages pode estar excluindo o stage desejado. 3) O recurso pode estar em outro apiGroup. 4) O log pode estar rotacionado (verificar arquivos antigos).'
    }
  ]
};
