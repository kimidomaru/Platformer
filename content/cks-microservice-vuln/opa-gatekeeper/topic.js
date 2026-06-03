window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['cks-microservice-vuln/opa-gatekeeper'] = {

  theory: `# OPA Gatekeeper

## Relevancia no CKS
> O dominio "Minimize Microservice Vulnerabilities" vale **20%** do CKS. OPA Gatekeeper permite enforce de policies customizadas via admission control. Voce deve saber criar ConstraintTemplates, Constraints e usar dry-run.

---

## O que e OPA?

**OPA (Open Policy Agent)** e um policy engine de proposito geral. No Kubernetes, **Gatekeeper** e a integracao do OPA como admission controller.

\`\`\`text
Request --> Authentication --> Authorization --> Admission Controllers
                                                       |
                                                  Gatekeeper
                                                  (Validating Webhook)
                                                       |
                                                  OPA/Rego Policy
                                                       |
                                                  Allow / Deny
\`\`\`

---

## Arquitetura do Gatekeeper

| Componente | Funcao |
|-----------|--------|
| **ConstraintTemplate** | Define a logica da policy em Rego |
| **Constraint** | Instancia da template com parametros |
| **Audit** | Verifica recursos existentes contra policies |
| **Config** | Define quais recursos sincronizar para cache |

---

## ConstraintTemplate

Define a logica da policy usando a linguagem **Rego**:

\`\`\`yaml
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8srequiredlabels
spec:
  crd:
    spec:
      names:
        kind: K8sRequiredLabels
      validation:
        openAPIV3Schema:
          type: object
          properties:
            labels:
              type: array
              items:
                type: string
  targets:
  - target: admission.k8s.gatekeeper.sh
    rego: |
      package k8srequiredlabels

      violation[{"msg": msg, "details": {"missing_labels": missing}}] {
        provided := {label | input.review.object.metadata.labels[label]}
        required := {label | label := input.parameters.labels[_]}
        missing := required - provided
        count(missing) > 0
        msg := sprintf("Resource missing required labels: %v", [missing])
      }
\`\`\`

---

## Constraint

Instancia a template com parametros especificos:

\`\`\`yaml
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sRequiredLabels
metadata:
  name: require-team-label
spec:
  enforcementAction: deny
  match:
    kinds:
    - apiGroups: [""]
      kinds: ["Namespace"]
    - apiGroups: ["apps"]
      kinds: ["Deployment"]
  parameters:
    labels: ["team", "environment"]
\`\`\`

### Enforcement Actions

| Action | Comportamento |
|--------|-------------|
| \`deny\` | Bloqueia o recurso (padrao) |
| \`dryrun\` | Permite mas registra violacao |
| \`warn\` | Permite mas retorna warning |

---

## Policies Comuns

### Bloquear Containers Privilegiados

\`\`\`yaml
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8sblockprivileged
spec:
  crd:
    spec:
      names:
        kind: K8sBlockPrivileged
  targets:
  - target: admission.k8s.gatekeeper.sh
    rego: |
      package k8sblockprivileged

      violation[{"msg": msg}] {
        container := input.review.object.spec.containers[_]
        container.securityContext.privileged == true
        msg := sprintf("Container '%v' is privileged", [container.name])
      }

      violation[{"msg": msg}] {
        container := input.review.object.spec.initContainers[_]
        container.securityContext.privileged == true
        msg := sprintf("Init container '%v' is privileged", [container.name])
      }
\`\`\`

### Restringir Image Registry

\`\`\`yaml
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8sallowedrepos
spec:
  crd:
    spec:
      names:
        kind: K8sAllowedRepos
      validation:
        openAPIV3Schema:
          type: object
          properties:
            repos:
              type: array
              items:
                type: string
  targets:
  - target: admission.k8s.gatekeeper.sh
    rego: |
      package k8sallowedrepos

      violation[{"msg": msg}] {
        container := input.review.object.spec.containers[_]
        not startswith(container.image, input.parameters.repos[_])
        msg := sprintf("Container '%v' uses unauthorized image '%v'", [container.name, container.image])
      }
\`\`\`

\`\`\`yaml
# Constraint: permitir apenas imagens do registry interno
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sAllowedRepos
metadata:
  name: require-internal-registry
spec:
  match:
    kinds:
    - apiGroups: [""]
      kinds: ["Pod"]
  parameters:
    repos:
    - "registry.internal.com/"
    - "gcr.io/my-project/"
\`\`\`

---

## Audit

Gatekeeper audita periodicamente recursos existentes:

\`\`\`bash
# Ver violacoes encontradas pelo audit
kubectl get k8srequiredlabels require-team-label -o yaml

# O campo status.violations lista recursos nao conformes
# Mesmo recursos criados ANTES da policy sao reportados
\`\`\`

---

## Gatekeeper vs Kyverno

| Caracteristica | Gatekeeper | Kyverno |
|---------------|-----------|---------|
| Linguagem | Rego (OPA) | YAML nativo |
| Curva de aprendizado | Alta (Rego) | Baixa (YAML) |
| Mutation | Suportado (assign) | Nativo e simples |
| Policy Library | gatekeeper-library | kyverno policies |
| CKS Exam | Mais cobrado | Menos cobrado |

---

## Erros Comuns

1. **ConstraintTemplate sem Constraint** — a template sozinha nao enforce nada
2. **Nao testar com dryrun primeiro** — pode bloquear workloads criticos
3. **Esquecer initContainers** — policies devem validar containers E initContainers
4. **Rego syntax errors** — testar no OPA Playground antes
5. **Nao sincronizar recursos no Config** — Gatekeeper nao ve recursos nao sincronizados

---

## Killer.sh Style Challenge

> Crie uma ConstraintTemplate que bloqueia pods usando a tag \`:latest\` em imagens. Crie a Constraint aplicando a todos os namespaces exceto \`kube-system\`. Teste criando um pod com \`nginx:latest\` (deve falhar) e \`nginx:1.25\` (deve funcionar).
`,

  quiz: [
    {
      question: 'Qual linguagem o OPA Gatekeeper usa para definir policies?',
      options: ['YAML', 'JSON', 'Rego', 'Python'],
      correct: 2,
      explanation: 'Rego e a linguagem de policy do OPA (Open Policy Agent). No Gatekeeper, Rego e usado dentro de ConstraintTemplates para definir a logica de validacao.',
      reference: 'Conceito relacionado: OPA — linguagem Rego.'
    },
    {
      question: 'Qual recurso do Gatekeeper define a logica da policy?',
      options: ['Constraint', 'Policy', 'ConstraintTemplate', 'AdmissionPolicy'],
      correct: 2,
      explanation: 'ConstraintTemplate define a logica em Rego e o schema dos parametros. Constraint instancia a template com parametros especificos e define onde aplicar.',
      reference: 'Conceito relacionado: Gatekeeper — ConstraintTemplate vs Constraint.'
    },
    {
      question: 'O que enforcementAction: dryrun faz em uma Constraint?',
      options: [
        'Bloqueia o recurso e registra',
        'Permite o recurso mas registra a violacao para auditoria',
        'Desabilita a policy',
        'Envia alerta por email'
      ],
      correct: 1,
      explanation: 'dryrun permite que o recurso seja criado normalmente mas registra a violacao. Util para testar policies antes de enforcar com deny.',
      reference: 'Conceito relacionado: Gatekeeper — enforcement actions.'
    },
    {
      question: 'Qual tipo de admission controller o Gatekeeper implementa?',
      options: ['Mutating Webhook', 'Validating Webhook', 'Ambos', 'Nenhum'],
      correct: 1,
      explanation: 'Gatekeeper funciona primariamente como Validating Admission Webhook, verificando se requests atendem as policies definidas. Tambem suporta mutacao via assign.',
      reference: 'Conceito relacionado: Admission Controllers — tipos.'
    },
    {
      question: 'O que a funcionalidade de Audit do Gatekeeper faz?',
      options: [
        'Audita logs de acesso ao cluster',
        'Verifica periodicamente recursos existentes contra policies ativas',
        'Monitora metricas de performance',
        'Registra mudancas em resources'
      ],
      correct: 1,
      explanation: 'O Audit do Gatekeeper verifica periodicamente recursos ja existentes no cluster contra as policies. Isso permite detectar violacoes em recursos criados antes da policy.',
      reference: 'Conceito relacionado: Gatekeeper Audit — conformidade retroativa.'
    },
    {
      question: 'Qual a diferenca principal entre Gatekeeper e Kyverno?',
      options: [
        'Gatekeeper e mais rapido',
        'Gatekeeper usa Rego enquanto Kyverno usa YAML nativo para policies',
        'Kyverno nao suporta validacao',
        'Gatekeeper nao suporta mutacao'
      ],
      correct: 1,
      explanation: 'A diferenca principal e a linguagem: Gatekeeper usa Rego (mais poderoso mas mais complexo) e Kyverno usa YAML nativo (mais simples de aprender).',
      reference: 'Conceito relacionado: Policy engines — comparacao.'
    },
    {
      question: 'Por que e importante validar initContainers alem de containers nas policies?',
      options: [
        'initContainers usam mais memoria',
        'initContainers rodam antes dos containers e podem ter privilegios diferentes',
        'initContainers nao suportam RBAC',
        'initContainers sao opcionais'
      ],
      correct: 1,
      explanation: 'initContainers rodam antes dos containers principais e podem ter configuracoes de seguranca diferentes. Um atacante pode usar um initContainer privilegiado para comprometer o pod.',
      reference: 'Conceito relacionado: Pod Security — initContainers.'
    }
  ],

  flashcards: [
    { front: 'O que e OPA Gatekeeper?', back: 'Integracao do Open Policy Agent com Kubernetes como Validating Admission Webhook. Permite enforce de policies customizadas escritas em Rego via ConstraintTemplates e Constraints.' },
    { front: 'Qual a diferenca entre ConstraintTemplate e Constraint?', back: 'ConstraintTemplate define a LOGICA da policy em Rego e o schema de parametros. Constraint INSTANCIA a template com parametros especificos e define ONDE aplicar (match.kinds, namespaces).' },
    { front: 'Quais sao as enforcementActions disponiveis?', back: 'deny (bloqueia o recurso), dryrun (permite mas registra violacao), warn (permite mas retorna warning ao usuario). Sempre comece com dryrun para testar.' },
    { front: 'O que o Audit do Gatekeeper faz?', back: 'Verifica periodicamente recursos EXISTENTES contra policies ativas. Detecta violacoes em recursos criados antes da policy ser aplicada. Resultados ficam em status.violations da Constraint.' },
    { front: 'Cite 3 policies comuns do Gatekeeper', back: '1) Bloquear containers privilegiados. 2) Restringir registries de imagem permitidos. 3) Exigir labels obrigatorios. 4) Bloquear tag :latest. 5) Exigir resource limits.' },
    { front: 'O que e Rego?', back: 'Linguagem declarativa do OPA para definir policies. Usa regras como violation[{"msg": msg}] { ... }. Pode ser testada no OPA Playground antes de usar no Gatekeeper.' },
    { front: 'Gatekeeper vs Kyverno: quando usar cada?', back: 'Gatekeeper: policies complexas, mais cobrado no CKS, usa Rego. Kyverno: policies simples em YAML, curva de aprendizado menor, melhor para mutation. No exame CKS, foco em Gatekeeper.' }
  ],

  lab: {
    scenario: 'Voce precisa implementar policies de seguranca usando OPA Gatekeeper para enforce de padroes no cluster.',
    objective: 'Criar ConstraintTemplates e Constraints para bloquear containers privilegiados e exigir labels.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Instalar Gatekeeper (se nao instalado)',
        instruction: 'Verifique se o Gatekeeper esta instalado no cluster. Se nao, instale via manifest.',
        hints: [
          'Verifique pods no namespace gatekeeper-system',
          'Use kubectl apply para instalar',
          'Aguarde os pods ficarem Ready'
        ],
        solution: '```bash\n# Verificar se Gatekeeper esta instalado\nkubectl get pods -n gatekeeper-system\n\n# Se nao estiver, instalar\nkubectl apply -f https://raw.githubusercontent.com/open-policy-agent/gatekeeper/release-3.14/deploy/gatekeeper.yaml\n\n# Aguardar pods ficarem prontos\nkubectl wait --for=condition=Ready pods -l control-plane=controller-manager -n gatekeeper-system --timeout=120s\n```',
        verify: '```bash\n# Verificar pods do Gatekeeper\nkubectl get pods -n gatekeeper-system\n# Saida esperada: gatekeeper-audit e gatekeeper-controller-manager Running\n\n# Verificar CRDs\nkubectl get crd | grep gatekeeper\n# Saida esperada: constrainttemplates.templates.gatekeeper.sh\n```'
      },
      {
        title: 'Criar Policy para Bloquear Privileged',
        instruction: 'Crie uma ConstraintTemplate e Constraint que bloqueie pods com containers privilegiados.',
        hints: [
          'A ConstraintTemplate define a logica em Rego',
          'Verifique securityContext.privileged nos containers',
          'Nao esqueca de verificar initContainers tambem'
        ],
        solution: '```bash\n# Criar ConstraintTemplate\nkubectl apply -f - <<EOF\napiVersion: templates.gatekeeper.sh/v1\nkind: ConstraintTemplate\nmetadata:\n  name: k8sblockprivileged\nspec:\n  crd:\n    spec:\n      names:\n        kind: K8sBlockPrivileged\n  targets:\n  - target: admission.k8s.gatekeeper.sh\n    rego: |\n      package k8sblockprivileged\n      violation[{\"msg\": msg}] {\n        container := input.review.object.spec.containers[_]\n        container.securityContext.privileged == true\n        msg := sprintf(\"Container privilegiado nao permitido: %v\", [container.name])\n      }\nEOF\n\n# Criar Constraint\nkubectl apply -f - <<EOF\napiVersion: constraints.gatekeeper.sh/v1beta1\nkind: K8sBlockPrivileged\nmetadata:\n  name: block-privileged-containers\nspec:\n  enforcementAction: deny\n  match:\n    kinds:\n    - apiGroups: [\"\"]\n      kinds: [\"Pod\"]\n    excludedNamespaces: [\"kube-system\"]\nEOF\n```',
        verify: '```bash\n# Testar: pod privilegiado deve ser bloqueado\nkubectl run priv-test --image=nginx --restart=Never --overrides=\'{\"spec\":{\"containers\":[{\"name\":\"test\",\"image\":\"nginx\",\"securityContext\":{\"privileged\":true}}]}}\' 2>&1 | grep -i \"denied\\|privileged\"\n# Saida esperada: mensagem de erro com \"privilegiado nao permitido\"\n\n# Testar: pod normal deve funcionar\nkubectl run normal-test --image=nginx:1.25-alpine --restart=Never\nkubectl get pod normal-test\n# Saida esperada: Running\nkubectl delete pod normal-test\n```'
      },
      {
        title: 'Testar com Dry Run',
        instruction: 'Modifique a Constraint para usar dryrun e verifique que violacoes sao registradas sem bloquear recursos.',
        hints: [
          'Altere enforcementAction para dryrun',
          'Crie um pod privilegiado (deve ser permitido)',
          'Verifique violations no status da Constraint'
        ],
        solution: '```bash\n# Atualizar para dryrun\nkubectl patch k8sblockprivileged block-privileged-containers \\\n  --type=merge -p \'{\"spec\":{\"enforcementAction\":\"dryrun\"}}\'\n\n# Agora pod privilegiado sera permitido (mas registrado)\nkubectl run dryrun-test --image=nginx --restart=Never \\\n  --overrides=\'{\"spec\":{\"containers\":[{\"name\":\"test\",\"image\":\"nginx\",\"securityContext\":{\"privileged\":true}}]}}\'\n\n# Verificar violacoes registradas\nkubectl get k8sblockprivileged block-privileged-containers -o yaml | grep -A 10 violations\n\n# Cleanup\nkubectl delete pod dryrun-test\n```',
        verify: '```bash\n# Verificar enforcement action\nkubectl get k8sblockprivileged block-privileged-containers -o jsonpath=\'{.spec.enforcementAction}\'\n# Saida esperada: dryrun\n\n# Voltar para deny apos teste\nkubectl patch k8sblockprivileged block-privileged-containers \\\n  --type=merge -p \'{\"spec\":{\"enforcementAction\":\"deny\"}}\'\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Constraint Nao Bloqueia Recursos',
      difficulty: 'medium',
      symptom: 'ConstraintTemplate e Constraint foram criados mas pods nao conformes nao sao bloqueados.',
      diagnosis: '```bash\n# Verificar se a ConstraintTemplate esta Ready\nkubectl get constrainttemplate k8sblockprivileged -o yaml | grep -A 5 status\n\n# Verificar se o Constraint esta enforcing\nkubectl get k8sblockprivileged block-privileged-containers -o yaml | grep enforcementAction\n\n# Verificar se o webhook esta configurado\nkubectl get validatingwebhookconfigurations | grep gatekeeper\n\n# Verificar logs do Gatekeeper\nkubectl logs -n gatekeeper-system deployment/gatekeeper-controller-manager\n```',
      solution: 'Causas comuns: 1) enforcementAction esta em dryrun/warn ao inves de deny. 2) ConstraintTemplate com erro de Rego — verificar status.byPod para erros. 3) Constraint match.kinds nao inclui o tipo de recurso correto. 4) Namespace do recurso esta em excludedNamespaces. 5) Webhook do Gatekeeper nao esta ativo.'
    },
    {
      title: 'ConstraintTemplate com Erro de Rego',
      difficulty: 'hard',
      symptom: 'ConstraintTemplate foi criada mas a Constraint nao pode ser instanciada. Erros de syntax no Rego.',
      diagnosis: '```bash\n# Verificar status da ConstraintTemplate\nkubectl get constrainttemplate <name> -o yaml | grep -A 20 status\n\n# Verificar erros por pod\nkubectl get constrainttemplate <name> -o json | \\\n  jq \'.status.byPod[] | select(.errors != null)\'\n\n# Verificar logs do audit\nkubectl logs -n gatekeeper-system deployment/gatekeeper-audit\n```',
      solution: 'Erros comuns de Rego: 1) Package name nao corresponde ao nome da ConstraintTemplate. 2) Usar violation sem retornar {\"msg\": msg}. 3) Variaveis nao declaradas. 4) Syntax incorreta (Rego nao usa ; ou return). Teste no OPA Playground (play.openpolicyagent.org) antes de aplicar.'
    }
  ]
};
