window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['app-environment/security'] = {
  theory: `# Security Contexts e ServiceAccounts no Kubernetes

## SecurityContext

SecurityContext define privilegios e configuracoes de seguranca para containers e Pods. Pode ser configurado em nivel de Pod (PodSecurityContext) ou em nivel de container.

### Campos principais do SecurityContext (container)

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: security-context-demo
spec:
  securityContext:           # PodSecurityContext - aplica a todos os containers
    runAsUser: 1000
    runAsGroup: 3000
    fsGroup: 2000
    runAsNonRoot: true
  containers:
  - name: app
    image: nginx:1.25
    securityContext:         # Container SecurityContext - sobrepoe o Pod
      runAsUser: 1001
      runAsNonRoot: true
      readOnlyRootFilesystem: true
      allowPrivilegeEscalation: false
      capabilities:
        add:
        - NET_ADMIN
        drop:
        - ALL
      privileged: false
\`\`\`

---

### Campos do PodSecurityContext

| Campo | Descricao |
|-------|-----------|
| runAsUser | UID para executar o container |
| runAsGroup | GID primario do container |
| fsGroup | GID para volumes montados (ownership de arquivos) |
| runAsNonRoot | Rejeita container que rodaria como root |
| sysctls | Parametros do kernel (ex: net.ipv4.ip_local_port_range) |
| seccompProfile | Perfil seccomp para filtrar syscalls |

---

### Capabilities Linux

As capabilities permitem controle granular de privilegios sem conceder root completo.

\`\`\`yaml
securityContext:
  capabilities:
    add:
    - NET_ADMIN      # Configuracao de rede
    - SYS_TIME       # Modificar clock do sistema
    drop:
    - ALL            # Remover todas as capabilities primeiro
    - NET_RAW        # Remover capacidade de criar raw sockets
\`\`\`

Boas praticas:
- Comece com \`drop: [ALL]\` e adicione apenas o necessario
- Evite \`privileged: true\` em producao
- Use \`readOnlyRootFilesystem: true\` sempre que possivel

---

### readOnlyRootFilesystem

Monta o filesystem raiz como somente leitura. Scrituras devem usar volumes.

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: readonly-demo
spec:
  containers:
  - name: app
    image: nginx:1.25
    securityContext:
      readOnlyRootFilesystem: true
    volumeMounts:
    - name: tmp-volume
      mountPath: /tmp
    - name: nginx-cache
      mountPath: /var/cache/nginx
    - name: nginx-run
      mountPath: /var/run
  volumes:
  - name: tmp-volume
    emptyDir: {}
  - name: nginx-cache
    emptyDir: {}
  - name: nginx-run
    emptyDir: {}
\`\`\`

---

## ServiceAccounts

ServiceAccounts fornecem identidade para processos que rodam dentro de Pods. Cada Pod usa um ServiceAccount para se autenticar na API do Kubernetes.

### Criar ServiceAccount

\`\`\`yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: my-app-sa
  namespace: default
automountServiceAccountToken: false
\`\`\`

\`\`\`bash
# Criar via kubectl
kubectl create serviceaccount my-app-sa -n default

# Verificar ServiceAccounts
kubectl get serviceaccount -n default

# ServiceAccount default existe em todo namespace
kubectl get sa default -n default
\`\`\`

### Usar ServiceAccount em um Pod

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: pod-with-sa
spec:
  serviceAccountName: my-app-sa
  automountServiceAccountToken: false  # Desabilitar mount automatico do token
  containers:
  - name: app
    image: nginx:1.25
\`\`\`

---

## RBAC para ServiceAccounts

Role-Based Access Control (RBAC) controla o que um ServiceAccount pode fazer na API do Kubernetes.

### Role (namespace-scoped)

\`\`\`yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: default
rules:
- apiGroups: [""]       # "" = core API group (pods, services, etc)
  resources: ["pods"]
  verbs: ["get", "watch", "list"]
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list"]
\`\`\`

### RoleBinding - conectar ServiceAccount ao Role

\`\`\`yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: pod-reader-binding
  namespace: default
subjects:
- kind: ServiceAccount
  name: my-app-sa
  namespace: default
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
\`\`\`

### ClusterRole e ClusterRoleBinding (cluster-scoped)

\`\`\`yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: node-reader
rules:
- apiGroups: [""]
  resources: ["nodes"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: node-reader-binding
subjects:
- kind: ServiceAccount
  name: my-app-sa
  namespace: default
roleRef:
  kind: ClusterRole
  name: node-reader
  apiGroup: rbac.authorization.k8s.io
\`\`\`

\`\`\`bash
# Verificar permissoes de um ServiceAccount
kubectl auth can-i list pods --as=system:serviceaccount:default:my-app-sa
kubectl auth can-i delete deployments --as=system:serviceaccount:default:my-app-sa -n production
\`\`\`

---

## Pod Security Standards (PSS)

Pod Security Standards definem tres niveis de politica de seguranca para Pods:

| Nivel | Descricao |
|-------|-----------|
| Privileged | Sem restricoes. Permite todo o acesso. |
| Baseline | Restricoes minimas que evitam escalacao de privilegios conhecida. |
| Restricted | Politica mais restritiva, seguindo melhores praticas de seguranca. |

### Restricted - o que e bloqueado

Nivel Restricted bloqueia Pods que:
- Usam \`privileged: true\`
- Montam HostPath volumes
- Usam hostNetwork, hostPID, hostIPC
- Nao definem \`runAsNonRoot: true\`
- Nao definem \`allowPrivilegeEscalation: false\`
- Nao fazem \`drop: [ALL]\` nas capabilities
- Nao usam \`readOnlyRootFilesystem: true\`

---

## Pod Security Admission (PSA)

O Pod Security Admission e o mecanismo que APLICA os Pod Security Standards em namespaces. Substitui o PodSecurityPolicy (removido no K8s 1.25).

### Modos de operacao

| Modo | Comportamento |
|------|---------------|
| enforce | Rejeita Pods que violam a politica |
| audit | Registra violations mas permite criacao |
| warn | Exibe warnings mas permite criacao |

### Configuracao via labels no namespace

\`\`\`yaml
apiVersion: v1
kind: Namespace
metadata:
  name: producao-restrita
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/enforce-version: latest
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/audit-version: latest
    pod-security.kubernetes.io/warn: restricted
    pod-security.kubernetes.io/warn-version: latest
\`\`\`

\`\`\`bash
# Adicionar PSA a namespace existente
kubectl label namespace meu-namespace \
  pod-security.kubernetes.io/enforce=baseline \
  pod-security.kubernetes.io/warn=restricted

# Verificar labels de seguranca do namespace
kubectl get namespace meu-namespace --show-labels

# Testar se um Pod seria aceito no namespace
kubectl apply --dry-run=server -f pod.yaml -n meu-namespace
\`\`\`

---

## Exemplo Completo: Aplicacao com Seguranca Configurada

\`\`\`yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: webapp-sa
  namespace: app-ns
automountServiceAccountToken: false
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: webapp-role
  namespace: app-ns
rules:
- apiGroups: [""]
  resources: ["configmaps"]
  verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: webapp-rolebinding
  namespace: app-ns
subjects:
- kind: ServiceAccount
  name: webapp-sa
  namespace: app-ns
roleRef:
  kind: Role
  name: webapp-role
  apiGroup: rbac.authorization.k8s.io
---
apiVersion: v1
kind: Pod
metadata:
  name: secure-webapp
  namespace: app-ns
spec:
  serviceAccountName: webapp-sa
  automountServiceAccountToken: false
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 3000
    fsGroup: 2000
  containers:
  - name: webapp
    image: nginx:1.25
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop:
        - ALL
    resources:
      requests:
        cpu: "100m"
        memory: "128Mi"
      limits:
        cpu: "500m"
        memory: "256Mi"
    volumeMounts:
    - name: tmp
      mountPath: /tmp
  volumes:
  - name: tmp
    emptyDir: {}
\`\`\`
`,

  quiz: [
    {
      question: 'Qual campo do PodSecurityContext define o GID do grupo de propriedade de volumes montados?',
      options: ['runAsGroup', 'fsGroup', 'supplementalGroups', 'runAsUser'],
      correct: 1,
      explanation: 'fsGroup define o GID que sera aplicado como dono dos volumes montados no Pod. Isso permite que os containers do Pod acessem os arquivos nos volumes com o grupo especificado. runAsGroup e o GID primario do processo do container.'
    },
    {
      question: 'O que acontece quando um Pod tenta ser criado em um namespace com label pod-security.kubernetes.io/enforce: restricted e o Pod usa privileged: true?',
      options: [
        'O Pod e criado mas um warning e exibido',
        'O Pod e criado mas o evento e registrado em audit',
        'O Pod e rejeitado na criacao com erro de violacao de politica',
        'O campo privileged e automaticamente alterado para false'
      ],
      correct: 2,
      explanation: 'O modo enforce rejeita Pods que violam a politica definida. privileged: true viola o nivel restricted (e ate o baseline). O Pod nao e criado e o erro descreve a violacao.'
    },
    {
      question: 'Qual e a melhor pratica para capabilities em containers de producao?',
      options: [
        'Adicionar todas as capabilities necessarias sem remover nenhuma',
        'Usar privileged: true para evitar problemas de permissao',
        'drop: [ALL] e entao add apenas as capabilities especificamente necessarias',
        'Nao configurar capabilities e usar o padrao do container runtime'
      ],
      correct: 2,
      explanation: 'A melhor pratica e comecar removendo TODAS as capabilities (drop: [ALL]) e depois adicionar apenas as especificamente necessarias. Isso segue o principio do minimo privilegio.'
    },
    {
      question: 'Como verificar se um ServiceAccount tem permissao para deletar Pods em um namespace especifico?',
      options: [
        'kubectl check sa my-sa delete pods -n my-ns',
        'kubectl auth can-i delete pods --as=system:serviceaccount:my-ns:my-sa -n my-ns',
        'kubectl get rolebinding -n my-ns | grep my-sa',
        'kubectl describe sa my-sa -n my-ns'
      ],
      correct: 1,
      explanation: 'kubectl auth can-i com --as=system:serviceaccount:<namespace>:<serviceaccount-name> verifica as permissoes de um ServiceAccount especifico. O formato correto do usuario e system:serviceaccount:namespace:name.'
    },
    {
      question: 'Qual recurso substituiu o PodSecurityPolicy (removido no K8s 1.25)?',
      options: [
        'NetworkPolicy',
        'Pod Security Admission com Pod Security Standards',
        'OPA Gatekeeper (nativo)',
        'SecurityContextConstraints'
      ],
      correct: 1,
      explanation: 'PodSecurityPolicy foi depreciado no K8s 1.21 e removido no 1.25. Foi substituido pelo Pod Security Admission (PSA), que e um admission controller nativo que aplica os Pod Security Standards (Privileged, Baseline, Restricted).'
    },
    {
      question: 'O que automountServiceAccountToken: false faz em um Pod?',
      options: [
        'Desabilita o uso de ServiceAccounts no Pod',
        'Impede que o token do ServiceAccount seja montado como volume no container',
        'Cria um token de curta duracao em vez de permanente',
        'Remove as permissoes RBAC do ServiceAccount'
      ],
      correct: 1,
      explanation: 'Por padrao, o Kubernetes monta o token do ServiceAccount em /var/run/secrets/kubernetes.io/serviceaccount/ em todo container. automountServiceAccountToken: false impede essa montagem automatica, reduzindo o risco de aplicacoes nao autorizadas acessarem a API do Kubernetes.'
    },
    {
      question: 'Qual e a diferenca entre Mode enforce e modo audit no Pod Security Admission?',
      options: [
        'enforce bloqueia, audit apenas registra a violacao sem bloquear',
        'enforce aplica em deployments, audit aplica em pods individuais',
        'enforce e mais rapido, audit e mais completo',
        'enforce funciona em cluster, audit funciona em namespace'
      ],
      correct: 0,
      explanation: 'enforce rejeita Pods que violam a politica (bloqueio real). audit registra a violacao nos logs de auditoria mas permite a criacao do Pod. warn exibe uma mensagem de aviso no terminal mas tambem permite a criacao. Os tres modos podem ser usados simultaneamente no mesmo namespace.'
    },
    {
      question: 'Como configurar um container para ser somente leitura no sistema de arquivos (exceto diretorios temporarios)?',
      options: [
        'securityContext.readOnly: true',
        'securityContext.readOnlyRootFilesystem: true e emptyDir volumes para /tmp e outros diretorios writeable necessarios',
        'securityContext.immutable: true',
        'Isso nao e possivel em Kubernetes'
      ],
      correct: 1,
      explanation: 'readOnlyRootFilesystem: true monta o filesystem do container como somente-leitura, impedindo que o container escreva fora dos volumes montados. Aplicacoes que precisam escrever em /tmp devem ter um emptyDir montado nesse path. Isso previne que malware persista apos um restart do container.'
    },
    {
      question: 'Qual e a forma correta de conceder ao ServiceAccount "my-sa" no namespace "dev" permissao para listar pods?',
      options: [
        'Criar uma Role com verbo "list" em pods e um RoleBinding vinculando a "my-sa"',
        'Editar o ServiceAccount para adicionar as permissoes diretamente',
        'Criar um ClusterRole e vincula-lo ao ServiceAccount',
        'Adicionar a permissao no ConfigMap do kube-apiserver'
      ],
      correct: 0,
      explanation: 'Para permissoes com escopo de namespace: criar Role (nao ClusterRole) com as regras desejadas e um RoleBinding que vincula a Role ao ServiceAccount. O RoleBinding deve estar NO MESMO namespace. Formato do subject: kind: ServiceAccount, name: my-sa, namespace: dev.'
    },
    {
      question: 'O que o campo allowPrivilegeEscalation: false previne?',
      options: [
        'O container de usar sudo',
        'Processos dentro do container de ganhar mais privilegios que o processo pai (ex: via setuid/setgid bits)',
        'O container de rodar como root',
        'O container de acessar o host network'
      ],
      correct: 1,
      explanation: 'allowPrivilegeEscalation: false previne que processos no container ganhem mais privilegios do que o processo pai via mecanismos como setuid, setgid ou file capabilities. Impede ataques de escalonamento de privilegios. Deve ser definido junto com runAsNonRoot: true e drop: [ALL] capabilities.'
    },
    {
      question: 'Como configurar um Pod para que seus containers nao possam executar como root?',
      options: [
        'spec.securityContext.runAsNonRoot: true',
        'spec.containers[].securityContext.noRoot: true',
        'spec.securityContext.runAsUser: 0',
        'spec.securityContext.preventRoot: true'
      ],
      correct: 0,
      explanation: 'runAsNonRoot: true faz o container runtime verificar que o container nao esta rodando como UID 0 (root). Se o container tentar rodar como root, o kubelet rejeita com erro. Pode ser definido tanto em pod-level (spec.securityContext) quanto em container-level (spec.containers[].securityContext).'
    },
    {
      question: 'Qual e o nivel mais restritivo do Pod Security Standards?',
      options: [
        'Privileged',
        'Baseline',
        'Restricted',
        'Locked'
      ],
      correct: 2,
      explanation: 'Os tres niveis sao, em ordem crescente de restricao: Privileged (sem restricoes), Baseline (previne escaladas conhecidas, permite root), Restricted (best-practices mais restritas: nao-root, sem privilege escalation, seccomp RuntimeDefault, etc.). Restricted e adequado para workloads sensiiveis, mas pode quebrar aplicacoes legadas.'
    },
    {
      question: 'Um Pod precisa montar /etc/hosts do node para modificar resolucao de nomes. Que campo usar?',
      options: [
        'spec.volumes com hostPath: /etc/hosts',
        'spec.hostAliases para adicionar entries sem montar o arquivo do host',
        'spec.dnsConfig.hosts',
        'spec.securityContext.hostNetwork: true'
      ],
      correct: 1,
      explanation: 'spec.hostAliases adiciona entries ao /etc/hosts do Pod sem precisar montar o /etc/hosts do node. E a forma segura e recomendada para adicionar mapeamentos hostname->IP customizados. Montar /etc/hosts do host e uma pratica insegura que viola muitas politicas de seguranca.'
    }
  ],

  flashcards: [
    {
      front: 'Qual e a diferenca entre PodSecurityContext e Container SecurityContext?',
      back: 'PodSecurityContext (spec.securityContext): aplica a TODOS os containers do Pod. Campos: runAsUser, runAsGroup, fsGroup, runAsNonRoot.\nContainer SecurityContext (spec.containers[].securityContext): aplica a UM container especifico e sobrepoe o PodSecurityContext. Campos adicionais: readOnlyRootFilesystem, allowPrivilegeEscalation, capabilities, privileged.'
    },
    {
      front: 'Quais sao os 3 niveis dos Pod Security Standards?',
      back: 'Privileged: sem restricoes, permite tudo (nivel mais permissivo)\nBaseline: previne escalacao de privilegios conhecida, permite maioria das apps\nRestricted: segue melhores praticas, requer runAsNonRoot, drop ALL capabilities, allowPrivilegeEscalation: false (nivel mais restritivo)'
    },
    {
      front: 'Como configurar Pod Security Admission em um namespace?',
      back: 'Via labels no namespace:\npod-security.kubernetes.io/enforce: <nivel>\npod-security.kubernetes.io/audit: <nivel>\npod-security.kubernetes.io/warn: <nivel>\n\nNiveis: privileged, baseline, restricted\nModos: enforce (bloqueia), audit (registra), warn (avisa)'
    },
    {
      front: 'O que e fsGroup e quando usar?',
      back: 'fsGroup e um GID suplementar aplicado aos volumes montados no Pod. O Kubernetes altera o dono dos arquivos no volume para o fsGroup especificado. Use quando a aplicacao precisa ter permissao de escrita em volumes compartilhados entre containers de grupos diferentes.'
    },
    {
      front: 'Como criar um ServiceAccount e associar a um Pod?',
      back: '1. kubectl create serviceaccount my-sa -n my-ns\n2. No Pod: spec.serviceAccountName: my-sa\n3. Opcional: automountServiceAccountToken: false para nao montar o token\n4. Para permissoes: criar Role + RoleBinding referenciando o ServiceAccount'
    },
    {
      front: 'Qual e o formato do usuario para kubectl auth can-i com ServiceAccount?',
      back: 'system:serviceaccount:<namespace>:<serviceaccount-name>\n\nExemplo:\nkubectl auth can-i list pods \\\n  --as=system:serviceaccount:default:my-sa\n\nPara namespace especifico:\nkubectl auth can-i delete pods \\\n  --as=system:serviceaccount:prod:my-sa \\\n  -n prod'
    },
    {
      front: 'O que readOnlyRootFilesystem: true implica para a aplicacao?',
      back: 'O filesystem raiz do container se torna somente leitura. A aplicacao NAO pode escrever em diretorios como /tmp, /var, etc. Para funcionar, monte volumes emptyDir nos paths que precisam de escrita:\nvolumeMounts: [{name: tmp, mountPath: /tmp}]\nvolumes: [{name: tmp, emptyDir: {}}]'
    }
  ],

  lab: {
    scenario: 'A equipe de seguranca exige que todos os Pods em producao sigam o nivel Restricted dos Pod Security Standards. Uma aplicacao legada precisa ser adaptada para rodar com as restricoes de seguranca exigidas, e um ServiceAccount com permissoes minimas precisa ser criado.',
    objective: 'Configurar Pod Security Admission em um namespace, adaptar um Pod para cumprir o nivel Restricted, criar ServiceAccount com RBAC minimo e validar as configuracoes.',
    steps: [
      {
        title: 'Configurar Pod Security Admission no namespace',
        instruction: `Crie o namespace \`secure-prod\` com Pod Security Admission configurado para:
- **enforce**: restricted (bloqueia Pods inseguros)
- **warn**: restricted (avisa no terminal)
- **audit**: restricted (registra violations)

Em seguida, tente criar um Pod sem SecurityContext e observe a mensagem de erro.`,
        hints: [
          'PSA e configurado via labels no namespace',
          'O label formato e: pod-security.kubernetes.io/<mode>: <level>',
          'Um Pod simples sem securityContext viola o nivel restricted'
        ],
        solution: `\`\`\`bash
# Criar namespace com PSA configurado
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Namespace
metadata:
  name: secure-prod
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/enforce-version: latest
    pod-security.kubernetes.io/warn: restricted
    pod-security.kubernetes.io/warn-version: latest
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/audit-version: latest
EOF

# Verificar labels
kubectl get namespace secure-prod --show-labels

# Tentar criar Pod inseguro (deve ser rejeitado)
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: insecure-pod
  namespace: secure-prod
spec:
  containers:
  - name: app
    image: nginx:1.25
EOF
# Esperado: Error from server (Forbidden): violates PodSecurity
\`\`\``
      },
      {
        title: 'Adaptar Pod para cumprir nivel Restricted',
        instruction: `Crie um Pod chamado \`secure-nginx\` no namespace \`secure-prod\` que cumpra todos os requisitos do nivel Restricted:
- runAsNonRoot: true
- runAsUser definido (ex: 1000)
- allowPrivilegeEscalation: false
- capabilities: drop ALL
- readOnlyRootFilesystem: true
- Volumes emptyDir para paths que precisam de escrita

Note que nginx precisa escrever em /var/cache/nginx, /var/run e /tmp.`,
        hints: [
          'Adicione volumes emptyDir para cada path que nginx precisa escrever',
          'O campo seccompProfile pode ser necessario: {type: RuntimeDefault}',
          'Use kubectl apply --dry-run=server para validar antes de aplicar'
        ],
        solution: `\`\`\`bash
cat <<EOF > secure-nginx.yaml
apiVersion: v1
kind: Pod
metadata:
  name: secure-nginx
  namespace: secure-prod
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 3000
    fsGroup: 2000
    seccompProfile:
      type: RuntimeDefault
  containers:
  - name: nginx
    image: nginx:1.25
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop:
        - ALL
    ports:
    - containerPort: 8080
    resources:
      requests:
        cpu: "100m"
        memory: "128Mi"
      limits:
        cpu: "500m"
        memory: "256Mi"
    volumeMounts:
    - name: tmp
      mountPath: /tmp
    - name: nginx-cache
      mountPath: /var/cache/nginx
    - name: nginx-run
      mountPath: /var/run
  volumes:
  - name: tmp
    emptyDir: {}
  - name: nginx-cache
    emptyDir: {}
  - name: nginx-run
    emptyDir: {}
EOF

# Validar sem aplicar
kubectl apply --dry-run=server -f secure-nginx.yaml

# Aplicar
kubectl apply -f secure-nginx.yaml

# Verificar
kubectl get pod secure-nginx -n secure-prod
\`\`\``
      },
      {
        title: 'Criar ServiceAccount com RBAC minimo',
        instruction: `Crie no namespace \`secure-prod\`:
1. ServiceAccount chamado \`webapp-sa\` com automountServiceAccountToken: false
2. Role chamada \`webapp-role\` com permissao apenas para GET e LIST em configmaps
3. RoleBinding conectando o ServiceAccount ao Role
4. Valide as permissoes com kubectl auth can-i`,
        hints: [
          'O apiGroup para core resources (configmaps) e "" (string vazia)',
          'kubectl auth can-i get configmaps --as=system:serviceaccount:secure-prod:webapp-sa -n secure-prod',
          'kubectl auth can-i delete configmaps deve retornar "no"'
        ],
        solution: `\`\`\`bash
cat <<EOF > webapp-rbac.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: webapp-sa
  namespace: secure-prod
automountServiceAccountToken: false
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: webapp-role
  namespace: secure-prod
rules:
- apiGroups: [""]
  resources: ["configmaps"]
  verbs: ["get", "list"]
- apiGroups: [""]
  resources: ["secrets"]
  verbs: ["get"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: webapp-rolebinding
  namespace: secure-prod
subjects:
- kind: ServiceAccount
  name: webapp-sa
  namespace: secure-prod
roleRef:
  kind: Role
  name: webapp-role
  apiGroup: rbac.authorization.k8s.io
EOF

kubectl apply -f webapp-rbac.yaml

# Validar permissoes
echo "Pode listar configmaps?"
kubectl auth can-i list configmaps \
  --as=system:serviceaccount:secure-prod:webapp-sa \
  -n secure-prod

echo "Pode deletar configmaps?"
kubectl auth can-i delete configmaps \
  --as=system:serviceaccount:secure-prod:webapp-sa \
  -n secure-prod

echo "Pode criar pods?"
kubectl auth can-i create pods \
  --as=system:serviceaccount:secure-prod:webapp-sa \
  -n secure-prod
\`\`\``
      },
      {
        title: 'Associar ServiceAccount ao Pod seguro e validar',
        instruction: `Atualize o Pod \`secure-nginx\` para usar o ServiceAccount \`webapp-sa\`. Como Pods nao podem ser modificados em execucao, delete o Pod e recrie com o ServiceAccount configurado.

Em seguida, verifique que o token NAO esta montado no container (devido ao automountServiceAccountToken: false) e que o Pod cumpre todas as restricoes de seguranca.`,
        hints: [
          'spec.serviceAccountName: webapp-sa',
          'kubectl exec no Pod e verifique: ls /var/run/secrets/',
          'kubectl get pod secure-nginx -n secure-prod -o yaml | grep -A 5 serviceAccount'
        ],
        solution: `\`\`\`bash
# Deletar Pod existente
kubectl delete pod secure-nginx -n secure-prod

# Recriar com ServiceAccount
cat <<EOF > secure-nginx-final.yaml
apiVersion: v1
kind: Pod
metadata:
  name: secure-nginx
  namespace: secure-prod
spec:
  serviceAccountName: webapp-sa
  automountServiceAccountToken: false
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 3000
    fsGroup: 2000
    seccompProfile:
      type: RuntimeDefault
  containers:
  - name: nginx
    image: nginx:1.25
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop:
        - ALL
    resources:
      requests:
        cpu: "100m"
        memory: "128Mi"
      limits:
        cpu: "500m"
        memory: "256Mi"
    volumeMounts:
    - name: tmp
      mountPath: /tmp
    - name: nginx-cache
      mountPath: /var/cache/nginx
    - name: nginx-run
      mountPath: /var/run
  volumes:
  - name: tmp
    emptyDir: {}
  - name: nginx-cache
    emptyDir: {}
  - name: nginx-run
    emptyDir: {}
EOF

kubectl apply -f secure-nginx-final.yaml
kubectl wait --for=condition=Ready pod/secure-nginx -n secure-prod --timeout=60s

# Verificar ServiceAccount associado
kubectl get pod secure-nginx -n secure-prod -o jsonpath='{.spec.serviceAccountName}'

# Verificar que token NAO esta montado
kubectl exec secure-nginx -n secure-prod -- ls /var/run/secrets/ 2>&1 || echo "Secrets nao montados - correto!"

# Verificar UID do processo
kubectl exec secure-nginx -n secure-prod -- id
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Pod rejeitado pelo Pod Security Admission apos migracao de namespace',
      symptom: 'Apos adicionar labels de Pod Security Admission ao namespace, novos Pods do Deployment falham com "Error from server (Forbidden): pods is forbidden: violates PodSecurity restricted: allowPrivilegeEscalation != false". Pods existentes continuam rodando.',
      diagnosis: `\`\`\`bash
# Verificar as politicas do namespace
kubectl get namespace <ns> --show-labels | grep pod-security

# Ver a mensagem de erro completa
kubectl describe replicaset -n <ns> | grep -A 10 "Error\\|Warning"

# Ver a spec de seguranca atual do Deployment
kubectl get deployment <deploy> -n <ns> -o yaml | grep -A 20 securityContext

# Verificar quais campos estao faltando para o nivel restricted
# Campos obrigatorios em restricted:
# - runAsNonRoot: true
# - allowPrivilegeEscalation: false
# - capabilities.drop: [ALL]
# - seccompProfile.type: RuntimeDefault ou Localhost

kubectl auth can-i --list --as=system:serviceaccount:<ns>:<sa> -n <ns>
\`\`\`

A PSA so bloqueia NOVOS Pods. Pods existentes (criados antes da politica) continuam rodando. Por isso o Deployment nao consegue criar novas replicas mas as antigas seguem ativas.`,
      solution: `**Passo 1**: Identificar todas as violacoes:
\`\`\`bash
# Usar modo warn primeiro para ver todas as violacoes sem bloquear
kubectl label namespace <ns> \
  pod-security.kubernetes.io/warn=restricted \
  --overwrite

kubectl rollout restart deployment/<deploy> -n <ns>
# Observar os warnings no terminal
\`\`\`

**Passo 2**: Corrigir o Deployment:
\`\`\`bash
kubectl patch deployment <deploy> -n <ns> --type=merge -p '{
  "spec": {
    "template": {
      "spec": {
        "securityContext": {
          "runAsNonRoot": true,
          "runAsUser": 1000,
          "seccompProfile": {"type": "RuntimeDefault"}
        },
        "containers": [{
          "name": "<container-name>",
          "securityContext": {
            "allowPrivilegeEscalation": false,
            "readOnlyRootFilesystem": true,
            "capabilities": {"drop": ["ALL"]}
          }
        }]
      }
    }
  }
}'
\`\`\`

**Passo 3**: Validar e aplicar enforce:
\`\`\`bash
# Testar com dry-run
kubectl apply --dry-run=server -f deployment.yaml -n <ns>

# Fazer rollout
kubectl rollout restart deployment/<deploy> -n <ns>
kubectl rollout status deployment/<deploy> -n <ns>
\`\`\``
    },
    {
      title: 'Permission denied - ServiceAccount sem permissao para acessar a API',
      symptom: 'Aplicacao dentro do Pod retorna "403 Forbidden" ou "User system:serviceaccount:default:default is not authorized to..." ao tentar chamar a API do Kubernetes. O Pod usa o ServiceAccount default sem RBAC configurado.',
      diagnosis: `\`\`\`bash
# Verificar qual ServiceAccount o Pod usa
kubectl get pod <pod> -o jsonpath='{.spec.serviceAccountName}'

# Verificar as permissoes do ServiceAccount
kubectl auth can-i list pods \
  --as=system:serviceaccount:<namespace>:<sa-name> \
  -n <namespace>

# Listar todos os RoleBindings do namespace
kubectl get rolebinding -n <namespace> -o yaml | \
  grep -A 5 "subjects"

# Verificar se token esta montado
kubectl exec <pod> -- ls /var/run/secrets/kubernetes.io/serviceaccount/

# Verificar o erro exato nos logs
kubectl logs <pod> | grep -i "forbidden\|unauthorized\|403"
\`\`\``,
      solution: `**Solucao 1**: Criar ServiceAccount dedicado com permissoes minimas:
\`\`\`bash
# Criar ServiceAccount dedicado
kubectl create serviceaccount app-sa -n <namespace>

# Criar Role com permissoes minimas necessarias
cat <<EOF | kubectl apply -f -
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: app-role
  namespace: <namespace>
rules:
- apiGroups: [""]
  resources: ["pods", "configmaps"]
  verbs: ["get", "list", "watch"]
EOF

# Criar RoleBinding
kubectl create rolebinding app-binding \
  --role=app-role \
  --serviceaccount=<namespace>:app-sa \
  -n <namespace>

# Atualizar o Deployment para usar o novo SA
kubectl set serviceaccount deployment/<deploy> app-sa -n <namespace>
\`\`\`

**Validar as permissoes antes de aplicar**:
\`\`\`bash
kubectl auth can-i list pods \
  --as=system:serviceaccount:<namespace>:app-sa \
  -n <namespace>
# Esperado: yes

kubectl auth can-i delete pods \
  --as=system:serviceaccount:<namespace>:app-sa \
  -n <namespace>
# Esperado: no (principio do minimo privilegio)
\`\`\``
    }
  ]
};
