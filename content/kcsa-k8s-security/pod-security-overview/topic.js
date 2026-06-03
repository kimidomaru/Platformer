window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['kcsa-k8s-security/pod-security-overview'] = {

  theory: `# Pod Security Standards Overview

## Relevancia no KCSA
> O dominio "Kubernetes Security Fundamentals" vale **22%** do KCSA. Pod Security Standards (PSS) e o mecanismo nativo do Kubernetes para restringir configuracoes de seguranca de pods. Fortemente testado no exame.

---

## Pod Security Standards (PSS)

O **Pod Security Standards** define tres niveis de politica de seguranca para pods:

| Nivel | Restricao | Uso Recomendado |
|-------|-----------|-----------------|
| **Privileged** | Sem restricoes | Pods de sistema (CNI, monitoring) |
| **Baseline** | Restricoes minimas, previne escalacao | Aplicacoes genericas |
| **Restricted** | Seguindo boas praticas, mais restritivo | Aplicacoes criticas |

---

## Nivel Privileged

**Sem restricoes** — equivalente a nao ter politica.

- Permite: containers privilegiados, hostNetwork, hostPID, hostPath
- Uso legitimo: CNI plugins, drivers de hardware, agentes de monitoring que precisam de acesso ao node
- **Nunca usar para workloads de aplicacao**

---

## Nivel Baseline

**Restricoes minimas** — previne as configuracoes mais perigosas:

| Proibido | Motivo |
|----------|--------|
| \`privileged: true\` | Container tem acesso total ao host |
| \`hostNetwork: true\` | Acesso a rede do node |
| \`hostPID: true\` | Ver processos de outros namespaces |
| \`hostIPC: true\` | Acesso a IPC do node |
| \`hostPath volumes\` | Acesso direto ao sistema de arquivos do node |
| Capabilities perigosas | NET_ADMIN, SYS_ADMIN, etc. |
| \`allowPrivilegeEscalation\` nao explicitamente false | Permite sudo/setuid |

---

## Nivel Restricted

**Mais restritivo** — segue hardening de seguranca:

Tudo do Baseline **mais**:

| Obrigatorio | Valor |
|-------------|-------|
| \`runAsNonRoot: true\` | Nao rodar como root (UID 0) |
| \`allowPrivilegeEscalation: false\` | Bloquear sudo/setuid |
| \`capabilities.drop: ["ALL"]\` | Remover todas as capabilities |
| Seccomp | RuntimeDefault ou perfil customizado |
| Volume types | Apenas configmap, secret, pvc, projected, ephemeral |

---

## Pod Security Admission (PSA)

O **PSA** e o admission controller nativo que aplica PSS via **labels nos namespaces**:

\`\`\`bash
kubectl label namespace production \
  pod-security.kubernetes.io/enforce=restricted \
  pod-security.kubernetes.io/enforce-version=latest \
  pod-security.kubernetes.io/audit=restricted \
  pod-security.kubernetes.io/warn=restricted
\`\`\`

### Modos do PSA

| Modo | Comportamento | Label |
|------|--------------|-------|
| **enforce** | Rejeita pods que violam a politica | \`pod-security.kubernetes.io/enforce\` |
| **audit** | Permite mas registra no audit log | \`pod-security.kubernetes.io/audit\` |
| **warn** | Permite mas retorna aviso ao usuario | \`pod-security.kubernetes.io/warn\` |

**Estrategia de migração:**
1. Comecar com \`warn\` para identificar pods afetados
2. Adicionar \`audit\` para registrar violations
3. Corrigir os pods
4. Aplicar \`enforce\` para rejeitar violations

---

## SecurityContext

O **SecurityContext** configura opcoes de seguranca no nivel de Pod e Container:

### Pod-level SecurityContext

\`\`\`yaml
spec:
  securityContext:
    runAsNonRoot: true          # Nao rodar como UID 0
    runAsUser: 1000             # UID especifico
    runAsGroup: 3000            # GID especifico
    fsGroup: 2000               # GID do volume (ownership)
    seccompProfile:
      type: RuntimeDefault      # Perfil seccomp do runtime
    supplementalGroups: [1001]  # Grupos adicionais
\`\`\`

### Container-level SecurityContext

\`\`\`yaml
containers:
- name: app
  securityContext:
    allowPrivilegeEscalation: false    # Bloquear sudo/setuid
    readOnlyRootFilesystem: true       # Filesystem somente leitura
    runAsNonRoot: true
    runAsUser: 1000
    capabilities:
      drop:
      - ALL                    # Remover todas as capabilities
      add:
      - NET_BIND_SERVICE       # Adicionar apenas o necessario
    seccompProfile:
      type: RuntimeDefault
\`\`\`

---

## Linux Capabilities

Capabilities dividem os privilegios do root em unidades menores:

| Capability | Funcao | Risco |
|-----------|--------|-------|
| \`NET_ADMIN\` | Configurar rede | Alto — pode modificar routing, iptables |
| \`SYS_ADMIN\` | Privilegio root amplo | Muito alto — equivale a root |
| \`SYS_PTRACE\` | Debugar processos | Alto — pode ler memoria de outros processos |
| \`NET_BIND_SERVICE\` | Bindar portas < 1024 | Baixo — necessario para servidores web |
| \`CHOWN\` | Mudar ownership de arquivos | Medio |

**Best practice:** Drop ALL capabilities, adicionar apenas as estritamente necessarias.

---

## seccomp e AppArmor

### seccomp (Secure Computing Mode)

Filtra chamadas de sistema (syscalls) que o container pode fazer:

\`\`\`yaml
securityContext:
  seccompProfile:
    type: RuntimeDefault    # Perfil do runtime (mais seguro que Unconfined)
    # type: Localhost        # Perfil customizado
    # localhostProfile: profiles/myprofile.json
\`\`\`

| Tipo | Descricao |
|------|-----------|
| \`Unconfined\` | Sem restricoes (default inseguro) |
| \`RuntimeDefault\` | Perfil do runtime (Docker, containerd) |
| \`Localhost\` | Perfil customizado no node |

### AppArmor

Perfis MAC (Mandatory Access Control) que restringem o que o container pode acessar:

\`\`\`yaml
metadata:
  annotations:
    container.apparmor.security.beta.kubernetes.io/nginx: runtime/default
\`\`\`

---

## Exemplo Completo — Pod Restricted

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: secure-pod
  namespace: production
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    seccompProfile:
      type: RuntimeDefault
  containers:
  - name: app
    image: myapp:v1.0@sha256:abc123...
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop:
        - ALL
    resources:
      limits:
        cpu: 500m
        memory: 256Mi
      requests:
        cpu: 100m
        memory: 128Mi
    volumeMounts:
    - name: tmp
      mountPath: /tmp      # Writable path via emptyDir
  volumes:
  - name: tmp
    emptyDir: {}
\`\`\`

---

## Erros Comuns no KCSA

1. **Confundir PSP com PSA** — PodSecurityPolicy foi removida no K8s 1.25, PSA/PSS e o substituto
2. **Achar que Baseline bloqueia root** — Baseline nao exige runAsNonRoot, apenas Restricted
3. **Esquecer que readOnlyRootFilesystem requer volumes para /tmp e logs**
4. **Confundir os modos do PSA** — enforce rejeita, audit loga, warn avisa
5. **Capabilities drop ALL + add especifico** — adicionar apenas o absolutamente necessario
`,

  quiz: [
    {
      question: 'Qual nivel do Pod Security Standards e mais restritivo e exige runAsNonRoot?',
      options: ['Privileged', 'Baseline', 'Restricted', 'None'],
      correct: 2,
      explanation: 'Restricted e o nivel mais restritivo do PSS. Exige: runAsNonRoot, allowPrivilegeEscalation=false, drop ALL capabilities, seccomp profile. Baseline apenas previne as configuracoes mais perigosas (privileged, hostNetwork) mas permite root.',
      reference: 'PSS: Privileged (sem restricao) < Baseline (minimas) < Restricted (best practices). Restricted exige non-root, drop ALL.'
    },
    {
      question: 'Qual e o modo do PSA que REJEITA pods que violam a politica?',
      options: ['audit', 'warn', 'enforce', 'deny'],
      correct: 2,
      explanation: 'enforce rejeita (HTTP 403) pods que violam a politica PSS. audit permite mas registra no audit log. warn permite mas retorna aviso ao usuario. Estrategia de migracao: warn -> audit -> enforce.',
      reference: 'PSA modos: enforce (rejeita), audit (loga), warn (avisa). Labels: pod-security.kubernetes.io/enforce=restricted.'
    },
    {
      question: 'O que allowPrivilegeEscalation: false previne?',
      options: ['Container de usar mais CPU', 'Container de usar sudo, setuid e outros mecanismos de escalacao de privilegios', 'Pod de acessar o filesystem do host', 'Container de abrir portas < 1024'],
      correct: 1,
      explanation: 'allowPrivilegeEscalation: false previne que o processo do container ganhe mais privilegios que seu processo pai (bloqueia sudo, setuid, setcap). Obrigatorio no nivel Restricted do PSS.',
      reference: 'allowPrivilegeEscalation=false: bloqueia sudo, setuid, newuidmap. Obrigatorio em PSS Restricted.'
    },
    {
      question: 'Qual e a melhor pratica para gerenciar Linux Capabilities em containers?',
      options: ['Adicionar todas as capabilities necessarias', 'Manter as capabilities default', 'Drop ALL capabilities e adicionar apenas as estritamente necessarias', 'Usar SYS_ADMIN para simplificar'],
      correct: 2,
      explanation: 'Drop ALL capabilities remove todas as permissoes especiais do container, incluindo as do runtime por padrao. Depois adicionar apenas o necessario (ex: NET_BIND_SERVICE para bind < 1024). Principio do menor privilegio.',
      reference: 'Capabilities: drop: [ALL], add: [apenas o necessario]. SYS_ADMIN = equivalente a root = nunca em producao.'
    },
    {
      question: 'Qual substituiu o PodSecurityPolicy (PSP) removido no K8s 1.25?',
      options: ['NetworkPolicy', 'Pod Security Admission (PSA) com Pod Security Standards (PSS)', 'RBAC', 'OPA/Gatekeeper exclusivamente'],
      correct: 1,
      explanation: 'PodSecurityPolicy foi deprecada no K8s 1.21 e removida no K8s 1.25. Foi substituida pelo Pod Security Admission (PSA) com Pod Security Standards (PSS), que usa labels em namespaces para enforcar politicas.',
      reference: 'PSP: removido K8s 1.25. Substituto nativo: PSA (Pod Security Admission). Alternativas externas: OPA/Gatekeeper, Kyverno.'
    },
    {
      question: 'Como o PSA e configurado em um namespace?',
      options: ['Via arquivo de configuracao no API Server', 'Via labels no namespace com pod-security.kubernetes.io/enforce', 'Via RBAC Role no namespace', 'Via ConfigMap no kube-system'],
      correct: 1,
      explanation: 'PSA e configurado via labels no namespace: pod-security.kubernetes.io/enforce=restricted, pod-security.kubernetes.io/audit=baseline, pod-security.kubernetes.io/warn=restricted. Cada modo pode ter um nivel diferente.',
      reference: 'kubectl label namespace <ns> pod-security.kubernetes.io/enforce=restricted. Labels definem qual nivel PSS aplicar por modo.'
    },
    {
      question: 'O que seccomp RuntimeDefault faz?',
      options: ['Desabilita todas as syscalls', 'Aplica o perfil de syscalls seguras definido pelo container runtime (containerd/CRI-O)', 'Habilita todas as syscalls', 'Apenas monitora syscalls sem bloquear'],
      correct: 1,
      explanation: 'RuntimeDefault aplica o perfil seccomp padrão do runtime (containerd ou CRI-O), que bloqueia syscalls raramente usadas e potencialmente perigosas (ex: ptrace, reboot). E mais seguro que Unconfined sem precisar de perfil customizado.',
      reference: 'seccomp: Unconfined (inseguro) < RuntimeDefault (perfil do runtime) < Localhost (customizado). PSS Restricted exige pelo menos RuntimeDefault.'
    },
    {
      question: 'Por que readOnlyRootFilesystem: true requer volumes adicionais?',
      options: ['Para melhorar performance', 'Muitas aplicacoes precisam escrever em /tmp ou /var/log, que ficam bloqueados sem volumes emptyDir', 'Porque o Kubernetes exige volumes em todo pod', 'Para habilitar o sistema de arquivos de rede'],
      correct: 1,
      explanation: 'readOnlyRootFilesystem: true bloqueia escrita em qualquer caminho do sistema de arquivos do container. Aplicacoes que precisam escrever em /tmp, /var/log ou outros paths precisam de emptyDir ou PVC montados explicitamente.',
      reference: 'readOnlyRootFilesystem: true + emptyDir para /tmp. Ajuda a detectar containers que tentam modificar seu filesystem (indicador de comprometimento).'
    }
  ],

  flashcards: [
    { front: 'Quais sao os 3 niveis do Pod Security Standards?', back: 'Privileged: sem restricoes (uso: pods de sistema). Baseline: previne configuracoes mais perigosas (privileged, hostNetwork, hostPID). Restricted: best practices (non-root, drop ALL caps, seccomp). Da mais permissivo ao mais restritivo.' },
    { front: 'O que PSS Restricted exige?', back: 'runAsNonRoot: true, allowPrivilegeEscalation: false, capabilities.drop: [ALL], seccompProfile (RuntimeDefault ou Localhost), volumes: apenas configmap/secret/pvc/projected/ephemeral. Mais restritivo que Baseline.' },
    { front: 'Quais sao os modos do PSA e o que cada um faz?', back: 'enforce: rejeita pods que violam (HTTP 403). audit: permite mas registra no audit log. warn: permite mas retorna aviso ao kubectl. Podem ter niveis diferentes (ex: warn=restricted, enforce=baseline).' },
    { front: 'Como aplicar PSA em um namespace?', back: 'Labels: pod-security.kubernetes.io/enforce=restricted, /audit=restricted, /warn=restricted. Adicionar -version=latest para versao atual. Estrategia: comecar com warn, depois audit, depois enforce.' },
    { front: 'Linux Capabilities: o que sao e como gerenciar?', back: 'Dividem privilegios root em unidades menores (NET_ADMIN, SYS_ADMIN, etc.). Best practice: drop: [ALL] + add: [apenas o necessario]. SYS_ADMIN = equivalente a root (evitar). NET_BIND_SERVICE = bind porta < 1024 (aceitavel).' },
    { front: 'O que substituiu PodSecurityPolicy (PSP)?', back: 'PSP foi removida no K8s 1.25. Substituto nativo: Pod Security Admission (PSA) com PSS via labels de namespace. Alternativas externas: OPA/Gatekeeper (ConstraintTemplate + Constraint), Kyverno (ClusterPolicy).' },
    { front: 'readOnlyRootFilesystem + emptyDir: por que juntos?', back: 'readOnlyRootFilesystem=true bloqueia toda escrita no container. Aplicacoes precisam de /tmp, /var/log escritaveis. Solucao: montar emptyDir nos paths especificos. Beneficio: qualquer escrita inesperada indica comprometimento.' },
    { front: 'seccomp RuntimeDefault vs Unconfined?', back: 'Unconfined: sem filtro de syscalls (inseguro, default historico). RuntimeDefault: perfil do runtime bloqueia syscalls perigosas (ptrace, reboot, etc.). Localhost: perfil customizado. PSS Restricted exige RuntimeDefault ou Localhost.' }
  ],

  lab: {
    scenario: 'Voce e um Security Engineer configurando Pod Security Standards em um cluster de producao. Precisa aplicar PSA em namespaces e validar que pods inseguros sao rejeitados.',
    objective: 'Configurar Pod Security Admission, aplicar niveis PSS e verificar enforcement.',
    duration: '15-20 minutos',
    steps: [
      {
        title: 'Aplicar PSA em namespace de producao',
        instruction: 'Configure PSA com nivel Restricted em um namespace e teste que pods inseguros sao rejeitados.',
        hints: ['Use kubectl label namespace', 'Comece com warn antes de enforce para ver o impacto'],
        solution: '```bash\n# Criar namespace de producao\nkubectl create namespace psa-demo\n\n# Aplicar PSA em modo warn primeiro (seguro para testar)\nkubectl label namespace psa-demo \\\n  pod-security.kubernetes.io/warn=restricted \\\n  pod-security.kubernetes.io/warn-version=latest\n\n# Tentar criar pod sem securityContext (deve gerar warning)\nkubectl run insecure-pod --image=nginx -n psa-demo 2>&1\n# Deve mostrar Warning: violates PodSecurity\n\n# Ver os warnings\nkubectl get events -n psa-demo | grep -i security\n\n# Agora aplicar enforce\nkubectl label namespace psa-demo \\\n  pod-security.kubernetes.io/enforce=restricted \\\n  pod-security.kubernetes.io/enforce-version=latest\n```',
        verify: '```bash\n# Verificar labels do namespace\nkubectl get namespace psa-demo --show-labels | grep pod-security\n# Saida esperada: labels com enforce e warn configurados\n\n# Tentar criar pod inseguro (deve ser REJEITADO com enforce)\nkubectl run rejected-pod --image=nginx -n psa-demo 2>&1 | grep -c "Error\\|Forbidden\\|violates"\n# Saida esperada: 1 (foi rejeitado)\n```'
      },
      {
        title: 'Criar Pod com SecurityContext compliant com Restricted',
        instruction: 'Crie um Pod que satisfaca todos os requisitos do nivel Restricted do PSS.',
        hints: ['runAsNonRoot: true, allowPrivilegeEscalation: false, drop ALL', 'Use emptyDir para paths de escrita'],
        solution: '```bash\n# Criar pod compliant com PSS Restricted\nkubectl apply -f - <<EOF\napiVersion: v1\nkind: Pod\nmetadata:\n  name: secure-pod\n  namespace: psa-demo\nspec:\n  securityContext:\n    runAsNonRoot: true\n    runAsUser: 1000\n    seccompProfile:\n      type: RuntimeDefault\n  containers:\n  - name: app\n    image: nginx:1.25-alpine\n    securityContext:\n      allowPrivilegeEscalation: false\n      readOnlyRootFilesystem: true\n      capabilities:\n        drop:\n        - ALL\n    resources:\n      limits:\n        cpu: 100m\n        memory: 128Mi\n      requests:\n        cpu: 50m\n        memory: 64Mi\n    volumeMounts:\n    - name: tmp\n      mountPath: /tmp\n    - name: cache\n      mountPath: /var/cache/nginx\n    - name: pid\n      mountPath: /var/run\n  volumes:\n  - name: tmp\n    emptyDir: {}\n  - name: cache\n    emptyDir: {}\n  - name: pid\n    emptyDir: {}\nEOF\n```',
        verify: '```bash\nkubectl get pod secure-pod -n psa-demo\n# Saida esperada: Running (ou ContainerCreating brevemente)\n\nkubectl get pod secure-pod -n psa-demo -o jsonpath=\'{.spec.securityContext.runAsNonRoot}\'\n# Saida esperada: true\n```'
      },
      {
        title: 'Verificar PSS em namespaces do cluster',
        instruction: 'Audite quais namespaces no cluster tem PSA configurado e identifique namespaces sem protecao.',
        hints: ['kubectl get ns --show-labels | grep pod-security', 'Namespaces sem labels PSA permitem qualquer pod'],
        solution: '```bash\n# Ver todos os namespaces com labels PSA\nkubectl get namespaces --show-labels | grep pod-security\n\n# Namespaces SEM PSA (potencialmente inseguros)\nkubectl get namespaces -o json | \\\n  jq -r \'.items[] | select(.metadata.labels | to_entries | map(select(.key | startswith("pod-security"))) | length == 0) | .metadata.name\'\n\n# Pods em namespaces sem PSA que violam Restricted\nkubectl get pods --all-namespaces -o json | \\\n  jq \'.items[] | select(.spec.securityContext.runAsNonRoot != true) | .metadata.namespace + \"/\" + .metadata.name\' | head -10\n\n# Limpar\nkubectl delete namespace psa-demo\n```',
        verify: '```bash\n# Verificar namespaces do cluster\nkubectl get namespaces --show-labels | head -10\n# Saida esperada: lista de namespaces com e sem labels PSA\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Pod rejeitado com "violates PodSecurity" mas parece configurado corretamente',
      difficulty: 'medium',
      symptom: 'Um Deployment em um namespace com enforce=restricted esta sendo rejeitado com "pods violates PodSecurity", mas o SecurityContext parece correto visualmente.',
      diagnosis: '**1. Ver a mensagem de erro completa:**\n```bash\nkubectl describe pod <pod-name> -n <namespace> 2>&1 | grep -A10 "Error\\|Warning"\n# Ou via events:\nkubectl get events -n <namespace> | grep -i security\n```\n\n**2. Verificar cada campo obrigatorio do Restricted:**\n```bash\n# PSS Restricted exige TODOS estes campos:\nkubectl get pod <pod> -n <namespace> -o json | jq \'\n{\n  runAsNonRoot: .spec.securityContext.runAsNonRoot,\n  seccompProfile: .spec.securityContext.seccompProfile,\n  allowPrivEscalation: .spec.containers[0].securityContext.allowPrivilegeEscalation,\n  capsDrop: .spec.containers[0].securityContext.capabilities.drop\n}\'\n```\n\n**3. Usar o dry-run para ver warnings:**\n```bash\nkubectl apply --dry-run=server -f pod.yaml 2>&1\n# Mostra warnings de PSS antes de criar o pod\n```',
      solution: '**Campos mais frequentemente esquecidos no nivel Restricted:**\n\n```yaml\nspec:\n  securityContext:\n    runAsNonRoot: true         # OBRIGATORIO\n    seccompProfile:            # OBRIGATORIO\n      type: RuntimeDefault\n  containers:\n  - securityContext:\n      allowPrivilegeEscalation: false  # OBRIGATORIO\n      capabilities:\n        drop:\n        - ALL                  # OBRIGATORIO (exato: "ALL")\n```\n\n**Causas comuns de rejeicao:**\n- \`capabilities.drop\` com lista parcial em vez de \`["ALL"]\`\n- Falta de \`seccompProfile\` (comum quando so se configura no container, nao no pod level)\n- Volume type nao permitido (ex: hostPath)\n- \`allowPrivilegeEscalation\` ausente (default = nao explicito nao conta)\n\n**Verificar volumes permitidos:**\n```yaml\n# Restricted permite apenas:\nvolumes:\n- configMap  # ok\n- secret     # ok\n- persistentVolumeClaim  # ok\n- projected  # ok\n- emptyDir   # ok\n# NAO permite: hostPath, nfs, csi, etc.\n```'
    },
    {
      title: 'Pods do kube-system rejeitados apos aplicar PSA enforce no namespace',
      difficulty: 'easy',
      symptom: 'Apos aplicar PSA enforce=restricted no namespace kube-system, pods de sistema (CoreDNS, kube-proxy) param de funcionar ou nao conseguem ser recriados.',
      diagnosis: '**1. Verificar pods afetados:**\n```bash\nkubectl get pods -n kube-system\n# Identificar pods em Error ou que nao conseguem ser criados\n```\n\n**2. Ver o label PSA aplicado:**\n```bash\nkubectl get namespace kube-system --show-labels | grep pod-security\n```\n\n**3. Verificar o SecurityContext dos pods de sistema:**\n```bash\nkubectl get pod coredns-<id> -n kube-system -o json | jq .spec.securityContext\n# Pods de sistema frequentemente nao satisfazem Restricted\n```',
      solution: '**Nao aplicar PSA Restricted em kube-system!**\n\nPods de sistema precisam de configuracoes que violam o nivel Restricted (hostNetwork, privileged, capabilities especificas).\n\n**Remover o label incorreto:**\n```bash\nkubectl label namespace kube-system \\\n  pod-security.kubernetes.io/enforce- \\\n  pod-security.kubernetes.io/warn-\n```\n\n**Estrategia correta por namespace:**\n\n| Namespace | Nivel Recomendado | Razao |\n|-----------|------------------|-------|\n| kube-system | Privileged (ou nenhum) | Pods de sistema precisam de acesso ao host |\n| monitoring | Baseline | Agentes como Prometheus precisam de mais acesso |\n| production | Restricted | Workloads de aplicacao |\n| development | Baseline | Mais flexivel para dev |\n\n**Verificar que kube-system esta funcionando:**\n```bash\nkubectl get pods -n kube-system\n# Todos devem estar Running\n```'
    }
  ]
};
