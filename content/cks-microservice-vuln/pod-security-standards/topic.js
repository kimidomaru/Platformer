window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['cks-microservice-vuln/pod-security-standards'] = {

  theory: `# Pod Security Standards & Admission

## Relevancia no CKS
> Dominio "Minimize Microservice Vulnerabilities" vale **20%** do exame. Pod Security Standards (PSS) e Pod Security Admission (PSA) sao os mecanismos nativos do Kubernetes para restringir Pods. Substitui o antigo PodSecurityPolicy (removido no v1.25).

---

## Pod Security Standards — Os 3 Niveis

O Kubernetes define tres niveis de seguranca cumulativos:

| Nivel | Objetivo | Uso Tipico |
|-------|----------|------------|
| **Privileged** | Sem restricoes | Workloads de infra (CNI, CSI drivers) |
| **Baseline** | Previne escalacao de privilegio conhecida | Maioria das aplicacoes |
| **Restricted** | Maximo endurecimento | Ambientes de alta seguranca |

### Privileged
Nenhuma restricao. Permite tudo: hostNetwork, hostPID, privileged containers, qualquer capability.

### Baseline
Bloqueia as configuracoes perigosas mais comuns:

\`\`\`yaml
# Campos BLOQUEADOS no nivel Baseline:
spec.hostNetwork: true          # bloqueado
spec.hostPID: true              # bloqueado
spec.hostIPC: true              # bloqueado
spec.containers[*].securityContext.privileged: true  # bloqueado
spec.volumes[*].hostPath        # bloqueado
spec.containers[*].ports[*].hostPort  # bloqueado (exceto range conhecido)
\`\`\`

Capabilities permitidas no Baseline: \`AUDIT_WRITE\`, \`CHOWN\`, \`DAC_OVERRIDE\`, \`FOWNER\`, \`FSETID\`, \`KILL\`, \`MKNOD\`, \`NET_BIND_SERVICE\`, \`SETFCAP\`, \`SETGID\`, \`SETPCAP\`, \`SETUID\`, \`SYS_CHROOT\`.

### Restricted
Tudo do Baseline mais:

\`\`\`yaml
# Campos OBRIGATORIOS no nivel Restricted:
spec.containers[*].securityContext:
  allowPrivilegeEscalation: false   # obrigatorio
  runAsNonRoot: true                # obrigatorio
  seccompProfile:
    type: RuntimeDefault            # ou Localhost
  capabilities:
    drop: ["ALL"]                   # obrigatorio
\`\`\`

---

## Pod Security Admission (PSA)

O PSA e o admission controller nativo que aplica os Pod Security Standards por namespace. Substituiu o PodSecurityPolicy.

### Modos de Aplicacao

| Modo | Comportamento |
|------|--------------|
| **enforce** | Rejeita Pods que violam o nivel |
| **audit** | Permite Pods mas registra violacao em audit log |
| **warn** | Permite Pods mas exibe warning ao usuario |

### Configuracao via Labels de Namespace

\`\`\`bash
# Aplicar nivel restricted com enforce
kubectl label namespace production \\
  pod-security.kubernetes.io/enforce=restricted \\
  pod-security.kubernetes.io/enforce-version=latest

# Aplicar baseline com audit + warn
kubectl label namespace staging \\
  pod-security.kubernetes.io/audit=baseline \\
  pod-security.kubernetes.io/warn=baseline
\`\`\`

### Combinar Modos (recomendado)

\`\`\`yaml
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/enforce-version: latest
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
\`\`\`

---

## Exemplo Pratico: Pod que Viola Restricted

\`\`\`yaml
# Este Pod sera REJEITADO em namespace com enforce=restricted
apiVersion: v1
kind: Pod
metadata:
  name: privileged-pod
spec:
  containers:
  - name: app
    image: nginx
    securityContext:
      privileged: true        # VIOLACAO: privileged
      runAsUser: 0             # VIOLACAO: root
\`\`\`

### Pod Compativel com Restricted

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: secure-pod
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    seccompProfile:
      type: RuntimeDefault
  containers:
  - name: app
    image: nginx
    securityContext:
      allowPrivilegeEscalation: false
      capabilities:
        drop: ["ALL"]
      readOnlyRootFilesystem: true
\`\`\`

---

## Namespaces Isentos

Os namespaces do sistema sao isentos por padrao:
- \`kube-system\`
- \`kube-public\`
- \`kube-node-lease\`

> **Dica CKS:** Nunca aplique \`enforce=restricted\` em \`kube-system\` — componentes do control plane precisam de privilegios elevados.

---

## Erros Comuns no Exame

1. **Esquecer de dropar ALL capabilities** — Restricted exige \`drop: ["ALL"]\`
2. **Nao setar seccompProfile** — Restricted exige RuntimeDefault ou Localhost
3. **Confundir enforce com audit** — enforce rejeita, audit apenas registra
4. **Aplicar em namespace errado** — kube-system com restricted quebra o cluster
`,

  quiz: [
    {
      question: 'Qual Pod Security Standard bloqueia hostNetwork, hostPID e containers privilegiados, mas NAO exige runAsNonRoot?',
      options: ['Privileged', 'Baseline', 'Restricted', 'Default'],
      correct: 1,
      explanation: 'Baseline bloqueia as configuracoes perigosas mais comuns (hostNetwork, hostPID, privileged), mas nao exige runAsNonRoot ou drop ALL capabilities. Isso e exigido apenas no nivel Restricted.',
      reference: 'Docs: kubernetes.io/docs/concepts/security/pod-security-standards/'
    },
    {
      question: 'Qual label de namespace configura o PSA para REJEITAR pods que violam o nivel restricted?',
      options: [
        'pod-security.kubernetes.io/warn=restricted',
        'pod-security.kubernetes.io/audit=restricted',
        'pod-security.kubernetes.io/enforce=restricted',
        'pod-security.kubernetes.io/deny=restricted'
      ],
      correct: 2,
      explanation: 'O modo "enforce" rejeita Pods que violam o nivel especificado. "audit" apenas registra e "warn" exibe warning. Nao existe modo "deny".',
      reference: 'PSA modes: enforce (rejeita), audit (registra), warn (avisa)'
    },
    {
      question: 'Quais campos sao OBRIGATORIOS para um Pod ser aceito no nivel Restricted? (selecione o conjunto correto)',
      options: [
        'runAsNonRoot + readOnlyRootFilesystem',
        'allowPrivilegeEscalation: false + runAsNonRoot + drop ALL + seccompProfile',
        'privileged: false + runAsUser: 1000',
        'runAsNonRoot + capabilities.add: NET_ADMIN'
      ],
      correct: 1,
      explanation: 'Restricted exige: allowPrivilegeEscalation: false, runAsNonRoot: true, capabilities.drop: ALL, e seccompProfile (RuntimeDefault ou Localhost). readOnlyRootFilesystem e recomendado mas nao obrigatorio pelo PSS.',
      reference: 'Restricted = Baseline + runAsNonRoot + no priv escalation + drop ALL + seccomp'
    },
    {
      question: 'O que acontece quando um Pod viola o nivel "audit" do PSA?',
      options: [
        'O Pod e rejeitado pelo API server',
        'O Pod e criado mas uma violacao e registrada no audit log',
        'O Pod e criado em modo sandbox',
        'O Pod e criado mas deletado apos 30 segundos'
      ],
      correct: 1,
      explanation: 'No modo audit, o Pod e criado normalmente, mas a violacao e registrada no audit log do API server. Isso permite avaliar o impacto antes de mudar para enforce.',
      reference: 'audit = permitir + registrar; warn = permitir + avisar usuario; enforce = rejeitar'
    },
    {
      question: 'Em qual versao do Kubernetes o PodSecurityPolicy (PSP) foi completamente removido?',
      options: ['v1.21', 'v1.23', 'v1.25', 'v1.27'],
      correct: 2,
      explanation: 'PSP foi deprecado no v1.21 e removido no v1.25. A partir do v1.25, Pod Security Admission (PSA) e o mecanismo nativo para restricao de Pods.',
      reference: 'PSP: deprecado v1.21 -> removido v1.25. PSA: beta v1.23 -> GA v1.25'
    },
    {
      question: 'Qual namespace NAO deve receber pod-security.kubernetes.io/enforce=restricted?',
      options: ['default', 'production', 'kube-system', 'staging'],
      correct: 2,
      explanation: 'kube-system contem componentes do control plane que precisam de privilegios elevados (hostNetwork, privileged). Aplicar restricted nesse namespace quebraria o cluster.',
      reference: 'Namespaces isentos por padrao: kube-system, kube-public, kube-node-lease'
    },
    {
      question: 'Qual capability e PERMITIDA no nivel Baseline mas nao no Restricted?',
      options: ['NET_ADMIN', 'SYS_ADMIN', 'NET_BIND_SERVICE', 'SYS_PTRACE'],
      correct: 2,
      explanation: 'NET_BIND_SERVICE esta na lista de capabilities permitidas do Baseline. No Restricted, todas as capabilities devem ser dropadas (drop: ALL). NET_ADMIN e SYS_ADMIN nao sao permitidas em nenhum nivel alem de Privileged.',
      reference: 'Baseline permite: AUDIT_WRITE, CHOWN, NET_BIND_SERVICE, etc. Restricted: drop ALL'
    },
    {
      question: 'Como verificar se um Pod seria aceito em um namespace com enforce=restricted SEM criar o Pod?',
      options: [
        'kubectl auth can-i create pods',
        'kubectl apply --dry-run=server -f pod.yaml',
        'kubectl validate -f pod.yaml',
        'kubectl check-pss pod.yaml --level=restricted'
      ],
      correct: 1,
      explanation: 'dry-run=server envia o request ao API server (incluindo admission controllers como PSA) mas nao persiste o objeto. Isso permite testar se o Pod seria aceito sem cria-lo.',
      reference: '--dry-run=server passa pelos admission controllers; --dry-run=client nao'
    }
  ],

  flashcards: [
    { front: 'Quais sao os 3 niveis do Pod Security Standards?', back: 'Privileged (sem restricoes), Baseline (bloqueia escalacao conhecida), Restricted (maximo endurecimento)' },
    { front: 'Quais sao os 3 modos do Pod Security Admission?', back: 'enforce (rejeita), audit (registra no audit log), warn (exibe warning ao usuario)' },
    { front: 'Qual label aplica PSA enforce restricted em um namespace?', back: 'pod-security.kubernetes.io/enforce=restricted' },
    { front: 'O que o nivel Restricted exige que o Baseline nao exige?', back: 'runAsNonRoot: true, allowPrivilegeEscalation: false, capabilities.drop: ALL, seccompProfile (RuntimeDefault ou Localhost)' },
    { front: 'Quando o PSP foi removido e o que o substituiu?', back: 'PodSecurityPolicy removido no K8s v1.25. Substituido por Pod Security Admission (PSA) + Pod Security Standards (PSS).' },
    { front: 'Quais namespaces sao isentos do PSA por padrao?', back: 'kube-system, kube-public, kube-node-lease' },
    { front: 'Como testar se um Pod seria aceito pelo PSA sem cria-lo?', back: 'kubectl apply --dry-run=server -f pod.yaml (passa pelos admission controllers sem persistir)' },
    { front: 'Qual a diferenca entre enforce e audit no PSA?', back: 'enforce rejeita o Pod (HTTP 403). audit permite o Pod mas registra a violacao no audit log do API server.' }
  ],

  lab: {
    scenario: 'Voce precisa configurar namespaces com diferentes niveis de Pod Security Standards e testar quais Pods sao aceitos ou rejeitados.',
    objective: 'Aplicar Pod Security Standards via PSA labels, testar enforce/audit/warn, e criar Pods compativeis com Restricted.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Criar namespace com enforce=restricted',
        instruction: 'Crie um namespace chamado \`secure-ns\` com PSA enforce=restricted, audit=restricted e warn=restricted.',
        hints: [
          'Use kubectl create namespace secure-ns primeiro.',
          'Depois aplique labels: kubectl label namespace secure-ns pod-security.kubernetes.io/enforce=restricted'
        ],
        solution: '```bash\nkubectl create namespace secure-ns\nkubectl label namespace secure-ns \\\n  pod-security.kubernetes.io/enforce=restricted \\\n  pod-security.kubernetes.io/audit=restricted \\\n  pod-security.kubernetes.io/warn=restricted\n```',
        verify: '```bash\n# Verificar labels do namespace\nkubectl get namespace secure-ns --show-labels\n# Saida esperada deve conter:\n# pod-security.kubernetes.io/enforce=restricted\n```'
      },
      {
        title: 'Testar rejeicao de Pod privilegiado',
        instruction: 'Tente criar um Pod privilegiado no namespace \`secure-ns\`. O Pod deve ser REJEITADO.',
        hints: [
          'kubectl run test --image=nginx --namespace=secure-ns --overrides=\'{"spec":{"containers":[{"name":"test","image":"nginx","securityContext":{"privileged":true}}]}}\''
        ],
        solution: '```bash\n# Deve falhar com erro de PSA\nkubectl run priv-test --image=nginx -n secure-ns \\\n  --overrides=\'{"spec":{"containers":[{"name":"priv-test","image":"nginx","securityContext":{"privileged":true}}]}}\'\n# Esperado: Error - pods "priv-test" is forbidden: violates PodSecurity "restricted"\n```',
        verify: '```bash\n# Confirmar que o Pod NAO foi criado\nkubectl get pods -n secure-ns\n# Saida esperada: No resources found\n```'
      },
      {
        title: 'Criar Pod compativel com Restricted',
        instruction: 'Crie um Pod chamado \`secure-app\` no namespace \`secure-ns\` que atenda todos os requisitos do nivel Restricted.',
        hints: [
          'Precisa: runAsNonRoot: true, allowPrivilegeEscalation: false, drop ALL capabilities, seccompProfile RuntimeDefault',
          'Use um YAML com todos os campos obrigatorios'
        ],
        solution: '```bash\ncat <<EOF | kubectl apply -f -\napiVersion: v1\nkind: Pod\nmetadata:\n  name: secure-app\n  namespace: secure-ns\nspec:\n  securityContext:\n    runAsNonRoot: true\n    runAsUser: 1000\n    seccompProfile:\n      type: RuntimeDefault\n  containers:\n  - name: app\n    image: nginx\n    securityContext:\n      allowPrivilegeEscalation: false\n      capabilities:\n        drop: [\"ALL\"]\n      readOnlyRootFilesystem: true\nEOF\n```',
        verify: '```bash\n# Pod deve estar Running\nkubectl get pod secure-app -n secure-ns\n# Saida esperada: secure-app   1/1   Running   0   ...\n\n# Verificar securityContext\nkubectl get pod secure-app -n secure-ns -o jsonpath=\'{.spec.containers[0].securityContext}\'\n```'
      },
      {
        title: 'Configurar namespace com audit-only para baseline',
        instruction: 'Crie um namespace \`audit-ns\` com audit=baseline (sem enforce). Crie um Pod privilegiado e verifique que ele e aceito mas a violacao e registrada.',
        hints: [
          'kubectl label namespace audit-ns pod-security.kubernetes.io/audit=baseline',
          'O Pod sera criado normalmente — verifique os audit logs'
        ],
        solution: '```bash\nkubectl create namespace audit-ns\nkubectl label namespace audit-ns \\\n  pod-security.kubernetes.io/audit=baseline \\\n  pod-security.kubernetes.io/warn=baseline\n\n# Criar pod privilegiado — sera aceito com warning\nkubectl run audit-test --image=nginx -n audit-ns \\\n  --overrides=\'{"spec":{"containers":[{"name":"audit-test","image":"nginx","securityContext":{"privileged":true}}]}}\'\n```',
        verify: '```bash\n# Pod DEVE existir (audit nao bloqueia)\nkubectl get pod audit-test -n audit-ns\n# Saida esperada: audit-test   1/1   Running   0   ...\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Pod rejeitado por PSA enforce',
      difficulty: 'medium',
      symptom: 'Erro ao criar Pod: "pods is forbidden: violates PodSecurity restricted". O Pod nao e criado.',
      diagnosis: '```bash\n# Ver qual nivel esta aplicado no namespace\nkubectl get namespace <ns> --show-labels | grep pod-security\n\n# Testar com dry-run para ver detalhes da violacao\nkubectl apply --dry-run=server -f pod.yaml -n <ns>\n\n# Violacoes comuns:\n# - allowPrivilegeEscalation nao setado como false\n# - capabilities.drop ALL ausente\n# - seccompProfile ausente\n# - runAsNonRoot ausente\n```',
      solution: 'Adicione os campos obrigatorios ao securityContext:\n\n```yaml\nspec:\n  securityContext:\n    runAsNonRoot: true\n    seccompProfile:\n      type: RuntimeDefault\n  containers:\n  - name: app\n    securityContext:\n      allowPrivilegeEscalation: false\n      capabilities:\n        drop: [\"ALL\"]\n```\n\nSe o Pod precisa de privilegios, use um namespace com nivel menos restritivo ou ajuste o nivel de enforce.'
    },
    {
      title: 'Workloads do kube-system falhando apos aplicar PSA',
      difficulty: 'hard',
      symptom: 'Componentes do control plane (kube-proxy DaemonSet, CoreDNS, etc.) nao conseguem ser recriados apos label enforce=restricted ser aplicado ao kube-system.',
      diagnosis: '```bash\n# Verificar se kube-system tem labels de PSA\nkubectl get namespace kube-system --show-labels\n\n# Ver eventos de falha\nkubectl get events -n kube-system --sort-by=.lastTimestamp\n\n# Verificar DaemonSets e Deployments com problemas\nkubectl get ds,deploy -n kube-system\n```',
      solution: 'Remova o label enforce do kube-system imediatamente:\n\n```bash\nkubectl label namespace kube-system \\\n  pod-security.kubernetes.io/enforce- \\\n  pod-security.kubernetes.io/audit- \\\n  pod-security.kubernetes.io/warn-\n```\n\n**Regra:** Nunca aplique enforce=restricted em kube-system. Use apenas audit/warn para visibilidade sem quebrar componentes criticos.'
    }
  ]
};
