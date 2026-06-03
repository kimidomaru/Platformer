window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['cks-runtime-security/container-immutability'] = {

  theory: `# Container Immutability & Forensics

## Relevancia no CKS
> O dominio "Monitoring, Logging and Runtime Security" vale **20%** do CKS. Containers imutaveis nao podem ser modificados em runtime, reduzindo riscos de pos-exploracao. Voce deve saber configurar read-only filesystems e investigar containers comprometidos.

---

## Principio de Imutabilidade

Containers devem ser **imutaveis** em runtime:
- Nao modificar binarios ou configuracoes
- Nao instalar pacotes em runtime
- Nao executar comandos arbitrarios

\`\`\`text
Build Time → Runtime
(mutable)     (immutable)

Dockerfile    readOnlyRootFilesystem: true
COPY files    emptyDir para /tmp
RUN install   Sem kubectl exec em prod
\`\`\`

---

## Read-Only Root Filesystem

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: immutable-pod
spec:
  containers:
  - name: app
    image: nginx:1.25-alpine
    securityContext:
      readOnlyRootFilesystem: true
      allowPrivilegeEscalation: false
      runAsNonRoot: true
      runAsUser: 1000
    volumeMounts:
    - name: tmp
      mountPath: /tmp
    - name: cache
      mountPath: /var/cache/nginx
    - name: run
      mountPath: /var/run
  volumes:
  - name: tmp
    emptyDir: {}
  - name: cache
    emptyDir: {}
  - name: run
    emptyDir: {}
\`\`\`

### Por que emptyDir?

Aplicacoes frequentemente precisam escrever em:
- \`/tmp\` — arquivos temporarios
- \`/var/cache\` — cache
- \`/var/run\` — PID files, sockets
- \`/var/log\` — logs locais

Use \`emptyDir\` para esses paths mantendo o root filesystem read-only.

---

## Prevencao de Execucao em Runtime

### Restringir kubectl exec

\`\`\`yaml
# RBAC: negar exec/attach em pods
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: no-exec
rules:
- apiGroups: [""]
  resources: ["pods/exec", "pods/attach"]
  verbs: []  # nenhum verb = nenhuma permissao
\`\`\`

### Detectar Modificacoes com Drift Detection

\`\`\`bash
# Comparar filesystem do container com a imagem original
# Usando docker diff (se disponivel)
docker diff <container-id>

# Via crictl em ambientes K8s
crictl inspect <container-id>
\`\`\`

---

## Forensics: Investigando Containers Comprometidos

### 1. Nao Destruir Evidencias

\`\`\`bash
# NAO deletar o pod imediatamente
# Em vez disso, isolar o pod:

# Remover labels para tirar do Service (sem receber trafego)
kubectl label pod <pod> app-

# Adicionar NetworkPolicy para isolar
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: isolate-compromised
spec:
  podSelector:
    matchLabels:
      compromised: "true"
  policyTypes:
  - Ingress
  - Egress
EOF

# Marcar pod como comprometido
kubectl label pod <pod> compromised=true
\`\`\`

### 2. Coletar Evidencias

\`\`\`bash
# Copiar arquivos do container
kubectl cp <pod>:/var/log/app.log ./evidence/app.log
kubectl cp <pod>:/tmp/ ./evidence/tmp/

# Capturar estado do container
kubectl get pod <pod> -o yaml > evidence/pod-state.yaml
kubectl describe pod <pod> > evidence/pod-describe.txt
kubectl logs <pod> > evidence/pod-logs.txt
kubectl logs <pod> --previous > evidence/pod-logs-previous.txt

# Listar processos (se possivel)
kubectl exec <pod> -- ps aux > evidence/processes.txt

# Listar conexoes de rede
kubectl exec <pod> -- netstat -tulpn > evidence/network.txt
\`\`\`

### 3. Ephemeral Debug Containers

\`\`\`bash
# Atachar container de debug ao pod (sem modificar o original)
kubectl debug <pod> -it --image=busybox --target=<container> -- sh

# Debug com imagem completa
kubectl debug <pod> -it --image=ubuntu -- bash

# Criar copia do pod para analise
kubectl debug <pod> -it --copy-to=debug-pod --image=busybox -- sh
\`\`\`

### 4. Analisar Imagem

\`\`\`bash
# Ver historico de layers da imagem
docker history <image>

# Inspecionar imagem
docker inspect <image>

# Extrair filesystem para analise
docker save <image> | tar -xf - -C ./image-layers/

# Scan de malware/vulnerabilidades
trivy image <image>
\`\`\`

---

## Deteccao de Drift

Drift e qualquer mudanca no container em relacao a imagem original:

\`\`\`bash
# Detectar arquivos adicionados/modificados
# Com Falco (regra):
# - rule: Detect New File Written
#   condition: >
#     open_write and container and
#     fd.name startswith /usr/bin
#   output: "File written in /usr/bin (file=%fd.name container=%container.name)"

# Com Sysdig:
# sysdig -c fileslower container.name=<name>
\`\`\`

---

## Checklist de Imutabilidade

| Controle | Como Implementar |
|---------|-----------------|
| Read-only filesystem | readOnlyRootFilesystem: true |
| Sem privilege escalation | allowPrivilegeEscalation: false |
| Non-root | runAsNonRoot: true, runAsUser: 1000+ |
| Sem capabilities | capabilities: {drop: ["ALL"]} |
| Sem host namespaces | hostPID/hostNetwork/hostIPC: false |
| Image tag fixa | image: app:v1.2.3 (nao :latest) |
| Always pull | imagePullPolicy: Always |

---

## Erros Comuns

1. **Read-only sem emptyDir** — aplicacao falha ao tentar escrever
2. **Deletar pod comprometido** — perde evidencias forenses
3. **Nao isolar pod antes de investigar** — atacante pode pivotar
4. **Ignorar drift detection** — modificacoes passam despercebidas
5. **kubectl exec liberado em producao** — facilita pos-exploracao

---

## Killer.sh Style Challenge

> Um pod foi comprometido. Isole-o (remova do Service e bloqueie trafego via NetworkPolicy). Colete evidencias (logs, processos, arquivos). Use kubectl debug para investigar. Documente os achados.
`,

  quiz: [
    {
      question: 'Qual campo do securityContext torna o filesystem do container somente leitura?',
      options: ['immutableFs: true', 'readOnlyRootFilesystem: true', 'readOnly: true', 'noWrite: true'],
      correct: 1,
      explanation: 'readOnlyRootFilesystem: true torna o root filesystem do container read-only. Escritas sao permitidas apenas em volumes montados (como emptyDir).',
      reference: 'Conceito relacionado: Container immutability — read-only filesystem.'
    },
    {
      question: 'O que fazer PRIMEIRO ao descobrir que um pod foi comprometido?',
      options: [
        'Deletar o pod imediatamente',
        'Isolar o pod (remover labels e aplicar NetworkPolicy restritiva)',
        'Reiniciar o Deployment',
        'Escalar para zero replicas'
      ],
      correct: 1,
      explanation: 'Isolar o pod preserva as evidencias para forense. Remover labels do Service para de direcionar trafego, e NetworkPolicy bloqueia comunicacao do atacante.',
      reference: 'Conceito relacionado: Forensics — preservacao de evidencias.'
    },
    {
      question: 'Qual comando permite atachar um container de debug a um pod existente?',
      options: ['kubectl exec --debug', 'kubectl debug <pod> -it --image=busybox', 'kubectl attach --debug', 'kubectl inspect <pod>'],
      correct: 1,
      explanation: 'kubectl debug cria um ephemeral container no pod existente para investigacao. Nao modifica o container original e pode usar qualquer imagem de debug.',
      reference: 'Conceito relacionado: Ephemeral debug containers.'
    },
    {
      question: 'Por que usar emptyDir com readOnlyRootFilesystem?',
      options: [
        'emptyDir e mais rapido',
        'Aplicacoes precisam escrever em /tmp, /var/cache, etc., emptyDir fornece espaco writavel',
        'emptyDir e persistente',
        'E obrigatorio pelo Kubernetes'
      ],
      correct: 1,
      explanation: 'Aplicacoes frequentemente precisam escrever em /tmp, /var/cache, /var/run. emptyDir fornece volumes writaveis em paths especificos enquanto o root filesystem permanece read-only.',
      reference: 'Conceito relacionado: emptyDir — filesystem writavel seletivo.'
    },
    {
      question: 'Como prevenir que usuarios usem kubectl exec em producao?',
      options: [
        'Desabilitar kubectl',
        'RBAC: nao conceder acesso a pods/exec e pods/attach',
        'Remover kubectl dos nodes',
        'Configurar NetworkPolicy'
      ],
      correct: 1,
      explanation: 'Via RBAC, nao incluir pods/exec e pods/attach nos verbs da Role. Isso impede que usuarios executem comandos dentro dos containers em producao.',
      reference: 'Conceito relacionado: RBAC — restringir exec/attach.'
    },
    {
      question: 'O que e drift detection em containers?',
      options: [
        'Deteccao de versao desatualizada',
        'Deteccao de mudancas no filesystem do container em relacao a imagem original',
        'Deteccao de network issues',
        'Deteccao de memory leaks'
      ],
      correct: 1,
      explanation: 'Drift detection identifica arquivos adicionados, modificados ou deletados no container em runtime comparando com a imagem original. Pode indicar comprometimento.',
      reference: 'Conceito relacionado: Runtime security — drift detection.'
    },
    {
      question: 'Qual comando copia arquivos de um container para analise forense?',
      options: ['kubectl get files', 'kubectl cp <pod>:/path ./local/', 'kubectl export', 'kubectl download'],
      correct: 1,
      explanation: 'kubectl cp permite copiar arquivos de/para containers. Para forense: kubectl cp <pod>:/var/log/ ./evidence/ para preservar logs e evidencias.',
      reference: 'Conceito relacionado: kubectl cp — coleta de evidencias.'
    }
  ],

  flashcards: [
    { front: 'O que e container immutability?', back: 'Principio de que containers nao devem ser modificados em runtime. Implementado com readOnlyRootFilesystem: true, sem kubectl exec em prod, imagens fixas (nao :latest), e drift detection.' },
    { front: 'Quais paths precisam de emptyDir com read-only filesystem?', back: '/tmp (temporarios), /var/cache (cache de apps como nginx), /var/run (PID files, sockets), /var/log (logs locais). Montar emptyDir nesses paths.' },
    { front: 'Como isolar um pod comprometido?', back: '1) Remover labels do Service (kubectl label pod <pod> app-). 2) Aplicar NetworkPolicy bloqueando todo ingress/egress. 3) Marcar como comprometido. NAO deletar — preservar evidencias.' },
    { front: 'O que sao ephemeral debug containers?', back: 'Containers temporarios adicionados a um pod existente via kubectl debug. Permitem investigacao sem modificar o container original. Podem usar imagens de debug (busybox, ubuntu).' },
    { front: 'Como coletar evidencias de um pod comprometido?', back: 'kubectl cp (arquivos), kubectl logs (logs), kubectl exec -- ps aux (processos), kubectl get pod -o yaml (estado), kubectl debug (investigacao interativa).' },
    { front: 'O que e drift detection?', back: 'Deteccao de mudancas no filesystem do container vs imagem original. Ferramentas: Falco (regras de file write), Sysdig, docker diff. Modificacoes em /usr/bin ou /etc sao suspeitas.' },
    { front: 'Checklist de imutabilidade de container', back: 'readOnlyRootFilesystem: true, allowPrivilegeEscalation: false, runAsNonRoot: true, drop ALL capabilities, sem host namespaces, image tag fixa, imagePullPolicy: Always.' }
  ],

  lab: {
    scenario: 'Um pod no namespace default pode ter sido comprometido. Voce precisa investigar, coletar evidencias e remediar.',
    objective: 'Praticar procedimentos de forense em containers e configurar imutabilidade.',
    duration: '15-20 minutos',
    steps: [
      {
        title: 'Criar Pod Imutavel',
        instruction: 'Crie um pod com todas as configuracoes de imutabilidade: read-only filesystem, non-root, sem privilege escalation.',
        hints: [
          'Use readOnlyRootFilesystem: true',
          'Monte emptyDir para /tmp e /var/cache',
          'Drop ALL capabilities'
        ],
        solution: '```bash\nkubectl apply -f - <<EOF\napiVersion: v1\nkind: Pod\nmetadata:\n  name: immutable-app\n  labels:\n    app: secure\nspec:\n  securityContext:\n    runAsNonRoot: true\n    runAsUser: 1000\n  containers:\n  - name: app\n    image: nginx:1.25-alpine\n    securityContext:\n      readOnlyRootFilesystem: true\n      allowPrivilegeEscalation: false\n      capabilities:\n        drop: [\"ALL\"]\n    volumeMounts:\n    - name: tmp\n      mountPath: /tmp\n    - name: cache\n      mountPath: /var/cache/nginx\n    - name: run\n      mountPath: /var/run\n  volumes:\n  - name: tmp\n    emptyDir: {}\n  - name: cache\n    emptyDir: {}\n  - name: run\n    emptyDir: {}\nEOF\n```',
        verify: '```bash\n# Verificar pod rodando\nkubectl get pod immutable-app\n# Saida esperada: Running\n\n# Verificar que filesystem e read-only\nkubectl exec immutable-app -- touch /test-file 2>&1 | grep -i \"read-only\"\n# Saida esperada: Read-only file system\n\n# Verificar que /tmp e writavel\nkubectl exec immutable-app -- touch /tmp/test-file && echo \"tmp writavel\"\n# Saida esperada: tmp writavel\n```'
      },
      {
        title: 'Simular e Investigar Comprometimento',
        instruction: 'Simule um pod comprometido e pratique procedimentos de investigacao forense.',
        hints: [
          'Crie um pod normal (sem read-only) para simular comprometimento',
          'Use kubectl exec para simular atividade maliciosa',
          'Colete evidencias antes de qualquer acao destrutiva'
        ],
        solution: '```bash\n# Criar pod "comprometido"\nkubectl run compromised --image=nginx:1.25-alpine --restart=Never\n\n# Simular atividade maliciosa\nkubectl exec compromised -- sh -c \"echo hacked > /tmp/malware.txt\"\nkubectl exec compromised -- sh -c \"wget -q -O /dev/null http://example.com 2>/dev/null || true\"\n\n# Coletar evidencias\nmkdir -p /tmp/evidence\nkubectl get pod compromised -o yaml > /tmp/evidence/pod.yaml\nkubectl logs compromised > /tmp/evidence/logs.txt\nkubectl exec compromised -- ps aux > /tmp/evidence/processes.txt 2>/dev/null\nkubectl exec compromised -- ls -la /tmp/ > /tmp/evidence/tmp-files.txt\n```',
        verify: '```bash\n# Verificar evidencias coletadas\nls -la /tmp/evidence/\n# Saida esperada: pod.yaml, logs.txt, processes.txt, tmp-files.txt\n\n# Verificar conteudo de evidencia\ncat /tmp/evidence/tmp-files.txt | grep malware\n# Saida esperada: malware.txt encontrado\n```'
      },
      {
        title: 'Isolar Pod Comprometido',
        instruction: 'Isole o pod comprometido removendo-o do Service e aplicando NetworkPolicy restritiva.',
        hints: [
          'Remova labels que conectam ao Service',
          'Crie NetworkPolicy que bloqueia todo trafego',
          'Adicione label de comprometimento'
        ],
        solution: '```bash\n# Isolar: remover label de Service\nkubectl label pod compromised app- 2>/dev/null || true\n\n# Marcar como comprometido\nkubectl label pod compromised status=compromised\n\n# Aplicar NetworkPolicy de isolamento\nkubectl apply -f - <<EOF\napiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: isolate-pod\nspec:\n  podSelector:\n    matchLabels:\n      status: compromised\n  policyTypes:\n  - Ingress\n  - Egress\nEOF\n\n# Usar kubectl debug para investigar\nkubectl debug compromised -it --image=busybox -- sh\n```',
        verify: '```bash\n# Verificar labels\nkubectl get pod compromised --show-labels | grep compromised\n# Saida esperada: status=compromised\n\n# Verificar NetworkPolicy\nkubectl get networkpolicy isolate-pod\n# Saida esperada: isolate-pod com podSelector status=compromised\n\n# Verificar que pod esta isolado (sem ingress/egress)\nkubectl describe networkpolicy isolate-pod | grep -E \"Ingress|Egress\"\n# Saida esperada: sem regras (todo trafego bloqueado)\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Aplicacao Falha com Read-Only Filesystem',
      difficulty: 'easy',
      symptom: 'Pod com readOnlyRootFilesystem: true falha ao iniciar com erros de permissao.',
      diagnosis: '```bash\n# Verificar logs\nkubectl logs <pod>\n# Procurar: Read-only file system, Permission denied\n\n# Identificar paths de escrita\nkubectl exec <pod-sem-readonly> -- find / -writable -type d 2>/dev/null\n```',
      solution: 'Identificar quais paths a aplicacao precisa escrever e montar emptyDir. Paths comuns: /tmp, /var/cache, /var/run, /var/log. Para nginx: /var/cache/nginx, /var/run, /tmp. Para aplicacoes Java: /tmp (para temp files).'
    },
    {
      title: 'Kubectl Debug Nao Funciona',
      difficulty: 'medium',
      symptom: 'kubectl debug retorna erro ou o ephemeral container nao consegue acessar o filesystem do container alvo.',
      diagnosis: '```bash\n# Verificar versao do kubectl e cluster\nkubectl version\n# Ephemeral containers requerem K8s 1.23+\n\n# Verificar se feature gate esta habilitado\nkubectl get pod <pod> -o yaml | grep ephemeralContainers\n\n# Tentar com --share-processes\nkubectl debug <pod> -it --image=busybox --target=<container> --share-processes -- sh\n```',
      solution: 'Ephemeral containers requerem Kubernetes 1.23+. Se nao funcionar: 1) Verificar versao do cluster. 2) Usar --copy-to para criar copia do pod. 3) Usar --share-processes para compartilhar PID namespace. 4) Alternativa: kubectl cp para extrair arquivos sem debug container.'
    }
  ]
};
