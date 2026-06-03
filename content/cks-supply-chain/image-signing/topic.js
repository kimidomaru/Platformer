window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['cks-supply-chain/image-signing'] = {

  theory: `# Image Signing & Verification

## Relevancia no CKS
> O dominio "Supply Chain Security" vale **20%** do CKS. Assinatura de imagens garante integridade e proveniencia. Voce deve saber usar cosign para assinar/verificar imagens e integrar com admission controllers.

---

## Por que Assinar Imagens?

Sem assinatura, nao ha garantia de que:
- A imagem foi construida por uma fonte confiavel
- A imagem nao foi modificada em transito ou no registry
- A imagem passou por todos os checks de seguranca

---

## Cosign (Sigstore)

**Cosign** e a ferramenta padrao para assinatura de imagens OCI.

### Gerando Chaves

\`\`\`bash
# Gerar par de chaves
cosign generate-key-pair

# Saida:
# cosign.key (chave privada - proteger!)
# cosign.pub (chave publica - distribuir)
\`\`\`

### Assinando Imagens

\`\`\`bash
# Assinar imagem com chave
cosign sign --key cosign.key registry.example.com/app:v1.0

# Assinar com annotations
cosign sign --key cosign.key \\
  -a author="team-security" \\
  -a pipeline="ci-prod" \\
  registry.example.com/app:v1.0
\`\`\`

### Verificando Assinaturas

\`\`\`bash
# Verificar assinatura
cosign verify --key cosign.pub registry.example.com/app:v1.0

# Verificar com output JSON
cosign verify --key cosign.pub \\
  --output json registry.example.com/app:v1.0

# Verificar annotations especificas
cosign verify --key cosign.pub \\
  -a pipeline="ci-prod" \\
  registry.example.com/app:v1.0
\`\`\`

---

## Keyless Signing (OIDC)

Cosign suporta assinatura sem gerenciar chaves, usando identidade OIDC:

\`\`\`bash
# Keyless signing (usa OIDC provider como GitHub, Google)
COSIGN_EXPERIMENTAL=1 cosign sign registry.example.com/app:v1.0

# Verificacao keyless
COSIGN_EXPERIMENTAL=1 cosign verify \\
  --certificate-identity=user@example.com \\
  --certificate-oidc-issuer=https://accounts.google.com \\
  registry.example.com/app:v1.0
\`\`\`

Beneficios:
- Nao precisa gerenciar chaves privadas
- Identidade vinculada ao developer/CI
- Transparencia via Rekor (transparency log)

---

## Integrar com Admission Control

### Kyverno (Policy para Assinaturas)

\`\`\`yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-image-signature
spec:
  validationFailureAction: Enforce
  rules:
  - name: verify-cosign-signature
    match:
      any:
      - resources:
          kinds:
          - Pod
    verifyImages:
    - imageReferences:
      - "registry.example.com/*"
      attestors:
      - entries:
        - keys:
            publicKeys: |-
              -----BEGIN PUBLIC KEY-----
              MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...
              -----END PUBLIC KEY-----
\`\`\`

### OPA Gatekeeper

\`\`\`yaml
# Constraint para verificar que imagens vem de registry confiavel
# (verificacao de assinatura requer integracao custom)
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sAllowedRepos
metadata:
  name: require-signed-registry
spec:
  match:
    kinds:
    - apiGroups: [""]
      kinds: ["Pod"]
  parameters:
    repos:
    - "registry.example.com/signed/"
\`\`\`

---

## SLSA Framework

**SLSA** (Supply-chain Levels for Software Artifacts) define niveis de seguranca:

| Nivel | Requisitos |
|-------|-----------|
| SLSA 1 | Build process documentado |
| SLSA 2 | Build service confiavel, provenance basica |
| SLSA 3 | Build isolado, provenance verificavel |
| SLSA 4 | Build hermético, provenance completa |

---

## Attestations (in-toto)

\`\`\`bash
# Criar attestation com cosign
cosign attest --key cosign.key \\
  --predicate scan-results.json \\
  --type vuln \\
  registry.example.com/app:v1.0

# Verificar attestation
cosign verify-attestation --key cosign.pub \\
  --type vuln \\
  registry.example.com/app:v1.0
\`\`\`

Attestations provam que:
- A imagem passou por scan de vulnerabilidades
- O build seguiu um pipeline especifico
- Tests foram executados com sucesso

---

## Transparency Logs (Rekor)

Rekor e um log imutavel de assinaturas e attestations:

\`\`\`bash
# Buscar entradas no Rekor
rekor-cli search --email user@example.com

# Verificar uma entrada
rekor-cli verify --artifact <file> --signature <sig>
\`\`\`

---

## Notary v2 (notation)

Alternativa ao cosign para assinatura de imagens OCI:

\`\`\`bash
# Assinar com notation
notation sign registry.example.com/app:v1.0

# Verificar
notation verify registry.example.com/app:v1.0
\`\`\`

---

## Erros Comuns

1. **Nao verificar assinaturas em admission** — assinar sem enforcar nao protege
2. **Chave privada no repositorio** — proteger cosign.key como qualquer secret
3. **Verificar apenas registry, nao assinatura** — registry confiavel != imagem assinada
4. **Nao usar attestations** — assinatura prova autoria, attestation prova processo
5. **Ignorar SBOM na supply chain** — complementar assinatura com SBOM

---

## Killer.sh Style Challenge

> Gere um par de chaves cosign. Assine uma imagem no registry local. Configure um Kyverno ClusterPolicy para enforcement que bloqueie pods usando imagens nao assinadas. Teste com imagem assinada (deve funcionar) e nao assinada (deve falhar).
`,

  quiz: [
    {
      question: 'Qual ferramenta do Sigstore e usada para assinar imagens de container?',
      options: ['Rekor', 'Fulcio', 'cosign', 'notation'],
      correct: 2,
      explanation: 'cosign e a ferramenta do projeto Sigstore usada para assinar e verificar imagens OCI. Rekor e o transparency log e Fulcio e a CA para keyless signing.',
      reference: 'Conceito relacionado: Sigstore — ecossistema de assinatura.'
    },
    {
      question: 'O que e keyless signing no cosign?',
      options: [
        'Assinatura sem nenhuma autenticacao',
        'Assinatura usando identidade OIDC ao inves de chaves estaticas',
        'Assinatura com chave efemera armazenada no registry',
        'Assinatura sem criptografia'
      ],
      correct: 1,
      explanation: 'Keyless signing usa OIDC (Google, GitHub, etc.) para vincular a assinatura a uma identidade. A chave efemera e gerada e descartada; a identidade e registrada no Rekor.',
      reference: 'Conceito relacionado: cosign — keyless signing com OIDC.'
    },
    {
      question: 'O que sao attestations no contexto de supply chain?',
      options: [
        'Logs de deploy',
        'Provas criptograficas de que um artefato passou por processos especificos (scan, build, test)',
        'Certificados TLS para registries',
        'Assinaturas de desenvolvedores'
      ],
      correct: 1,
      explanation: 'Attestations sao declaracoes assinadas que provam que um artefato passou por processos especificos (scan de vulnerabilidades, pipeline de CI/CD, testes).',
      reference: 'Conceito relacionado: in-toto attestations.'
    },
    {
      question: 'Qual admission controller pode verificar assinaturas de imagens no Kubernetes?',
      options: ['PodSecurity', 'ImagePolicyWebhook', 'Kyverno com verifyImages', 'LimitRanger'],
      correct: 2,
      explanation: 'Kyverno tem suporte nativo a verificacao de assinaturas cosign via verifyImages nas policies. Gatekeeper requer integracao custom. ImagePolicyWebhook e generico.',
      reference: 'Conceito relacionado: Kyverno — verificacao de assinaturas.'
    },
    {
      question: 'O que e o SLSA framework?',
      options: [
        'Framework para scanning de vulnerabilidades',
        'Niveis de seguranca para a supply chain de software (build integrity)',
        'Framework para autenticacao de APIs',
        'Padrao para Dockerfiles seguros'
      ],
      correct: 1,
      explanation: 'SLSA (Supply-chain Levels for Software Artifacts) define 4 niveis de seguranca para a supply chain, desde build documentado (L1) ate build hermetico com provenance completa (L4).',
      reference: 'Conceito relacionado: SLSA — niveis de maturidade.'
    },
    {
      question: 'O que e o Rekor no ecossistema Sigstore?',
      options: [
        'Um registry de imagens',
        'Um transparency log imutavel que registra assinaturas e attestations',
        'Um scanner de vulnerabilidades',
        'Um admission controller'
      ],
      correct: 1,
      explanation: 'Rekor e um transparency log imutavel (append-only) que registra assinaturas e attestations. Permite verificar quando e por quem uma imagem foi assinada.',
      reference: 'Conceito relacionado: Rekor — transparency log.'
    },
    {
      question: 'Qual comando gera um par de chaves para uso com cosign?',
      options: ['cosign keygen', 'cosign generate-key-pair', 'cosign init-keys', 'cosign create-keys'],
      correct: 1,
      explanation: 'cosign generate-key-pair gera cosign.key (privada, proteger) e cosign.pub (publica, distribuir para verificacao).',
      reference: 'Conceito relacionado: cosign — geracao de chaves.'
    }
  ],

  flashcards: [
    { front: 'O que e cosign?', back: 'Ferramenta do projeto Sigstore para assinar e verificar imagens OCI. Suporta chaves estaticas e keyless signing via OIDC. Comandos: generate-key-pair, sign, verify.' },
    { front: 'O que e keyless signing?', back: 'Assinatura sem gerenciar chaves privadas. Usa identidade OIDC (Google, GitHub). Chave efemera gerada e descartada. Identidade registrada no transparency log (Rekor).' },
    { front: 'O que sao attestations?', back: 'Declaracoes assinadas sobre processos que um artefato passou: scan de vulnerabilidades, pipeline CI/CD, testes. Criadas com cosign attest e verificadas com cosign verify-attestation.' },
    { front: 'O que e SLSA?', back: 'Supply-chain Levels for Software Artifacts. 4 niveis: L1 (build documentado), L2 (build confiavel), L3 (build isolado, provenance verificavel), L4 (build hermetico).' },
    { front: 'Como integrar verificacao de assinatura no K8s?', back: 'Kyverno: verifyImages com chave publica. Gatekeeper: integracao custom. ImagePolicyWebhook: webhook externo. Todos atuam como admission controllers.' },
    { front: 'O que e Rekor?', back: 'Transparency log imutavel do Sigstore. Registra assinaturas e attestations. Permite auditoria: quando e por quem um artefato foi assinado.' },
    { front: 'Diferenca entre assinatura e attestation?', back: 'Assinatura prova QUEM criou/aprovou a imagem. Attestation prova O QUE aconteceu com a imagem (scanned, tested, built por pipeline X). Ambos sao complementares.' }
  ],

  lab: {
    scenario: 'Voce precisa implementar assinatura de imagens para garantir que apenas imagens verificadas possam rodar no cluster.',
    objective: 'Assinar imagens com cosign e configurar admission control para verificar assinaturas.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Gerar Chaves e Assinar Imagem',
        instruction: 'Gere um par de chaves cosign e assine uma imagem de teste.',
        hints: [
          'Use cosign generate-key-pair',
          'Proteja a chave privada',
          'Use cosign sign com --key'
        ],
        solution: '```bash\n# Instalar cosign (se necessario)\n# https://docs.sigstore.dev/cosign/installation/\n\n# Gerar par de chaves\ncosign generate-key-pair\n# Sera solicitada uma senha para a chave privada\n\n# Assinar imagem (substitua pelo seu registry)\ncosign sign --key cosign.key registry.example.com/app:v1.0\n\n# Se nao tem registry, pode assinar imagem local\n# cosign sign --key cosign.key --allow-insecure-registry localhost:5000/app:v1.0\n```',
        verify: '```bash\n# Verificar que as chaves foram criadas\nls -la cosign.key cosign.pub\n# Saida esperada: ambos os arquivos existem\n\n# Verificar a assinatura\ncosign verify --key cosign.pub registry.example.com/app:v1.0\n# Saida esperada: verificacao bem-sucedida com detalhes da assinatura\n```'
      },
      {
        title: 'Verificar Assinatura',
        instruction: 'Verifique a assinatura da imagem usando a chave publica e analise os detalhes.',
        hints: [
          'Use cosign verify com --key e a chave publica',
          'Tente verificar uma imagem nao assinada (deve falhar)',
          'Use --output json para detalhes'
        ],
        solution: '```bash\n# Verificar imagem assinada (deve funcionar)\ncosign verify --key cosign.pub registry.example.com/app:v1.0\n\n# Verificar imagem NAO assinada (deve falhar)\ncosign verify --key cosign.pub nginx:latest 2>&1 | head -5\n# Saida: erro de verificacao\n\n# Ver detalhes da assinatura\ncosign verify --key cosign.pub --output json registry.example.com/app:v1.0 | jq .\n```',
        verify: '```bash\n# Imagem assinada: retorna sucesso\ncosign verify --key cosign.pub registry.example.com/app:v1.0 && echo \"VERIFICADO\"\n# Saida esperada: VERIFICADO\n\n# Imagem nao assinada: retorna erro\ncosign verify --key cosign.pub nginx:latest 2>/dev/null && echo \"VERIFICADO\" || echo \"FALHOU\"\n# Saida esperada: FALHOU\n```'
      },
      {
        title: 'Configurar Admission Policy',
        instruction: 'Configure uma policy que permita apenas imagens assinadas (usando Kyverno ou restringindo registries).',
        hints: [
          'Kyverno tem suporte nativo a cosign via verifyImages',
          'Alternativa: restringir registries a um registry interno que so aceita imagens assinadas',
          'Use enforcementAction para testar antes de enforce'
        ],
        solution: '```bash\n# Opcao 1: Kyverno (se instalado)\nkubectl apply -f - <<EOF\napiVersion: kyverno.io/v1\nkind: ClusterPolicy\nmetadata:\n  name: require-signed-images\nspec:\n  validationFailureAction: Audit\n  rules:\n  - name: verify-signature\n    match:\n      any:\n      - resources:\n          kinds:\n          - Pod\n    verifyImages:\n    - imageReferences:\n      - \"registry.example.com/*\"\n      attestors:\n      - entries:\n        - keys:\n            publicKeys: |-\n              $(cat cosign.pub)\nEOF\n\n# Opcao 2: Restringir registries via Gatekeeper\n# (Ver topico opa-gatekeeper para detalhes)\n```',
        verify: '```bash\n# Verificar policy criada\nkubectl get clusterpolicy require-signed-images 2>/dev/null || echo \"Kyverno nao instalado\"\n\n# Se usando restricao de registry\nkubectl get k8sallowedrepos 2>/dev/null || echo \"Constraint nao encontrada\"\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Cosign Verify Falha com Imagem Valida',
      difficulty: 'easy',
      symptom: 'cosign verify retorna erro mesmo para imagem que foi assinada corretamente.',
      diagnosis: '```bash\n# Verificar que a chave publica corresponde a privada usada\ncosign verify --key cosign.pub registry.example.com/app:v1.0 2>&1\n\n# Verificar se a assinatura esta no registry\ncosign tree registry.example.com/app:v1.0\n\n# Verificar digest da imagem\ncrane digest registry.example.com/app:v1.0\n```',
      solution: 'Causas comuns: 1) Usando chave publica errada (diferente da privada usada para assinar). 2) Imagem foi re-tagged apos assinatura (digest mudou). 3) Registry nao suporta OCI artifacts (assinaturas). 4) Assinatura feita com versao diferente do cosign.'
    },
    {
      title: 'Kyverno Bloqueia Pods do Sistema',
      difficulty: 'hard',
      symptom: 'Apos habilitar policy de verificacao de assinatura com Enforce, pods do kube-system e outros namespaces do sistema falham ao iniciar.',
      diagnosis: '```bash\n# Verificar eventos de pods falhando\nkubectl get events -n kube-system --sort-by=.lastTimestamp | tail -20\n\n# Verificar policy\nkubectl get clusterpolicy require-signed-images -o yaml\n\n# Verificar se ha exclusoes para namespaces do sistema\nkubectl get clusterpolicy require-signed-images -o json | jq \'.spec.rules[].exclude\'\n```',
      solution: 'Sempre excluir namespaces do sistema da policy de assinatura. Adicionar exclude no Kyverno: exclude: {any: [{resources: {namespaces: [\"kube-system\", \"kube-node-lease\", \"kyverno\"]}}]}. Comecar com validationFailureAction: Audit antes de mudar para Enforce.'
    }
  ]
};
