window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['helm/helm-advanced'] = {
  theory: `# Helm Avançado: OCI, Library Charts, Subcharts & CI/CD

## Relevância
> Domínio avançado do Helm é o diferencial entre DevOps júnior e sênior. OCI registry, library charts e integração CI/CD são cobrados em entrevistas técnicas de plataforma.

## OCI Registry — Helm sem Chart Museum

A partir do Helm 3.8+, charts podem ser armazenados em registries OCI (mesma infraestrutura de imagens Docker):

\`\`\`bash
# Login no registry OCI
helm registry login registry.example.com --username user --password-stdin

# Empacotar o chart
helm package ./meu-chart          # gera meu-chart-1.0.0.tgz

# Push para OCI registry
helm push meu-chart-1.0.0.tgz oci://registry.example.com/charts

# Instalar de OCI registry
helm install myapp oci://registry.example.com/charts/meu-chart --version 1.0.0

# Pull (baixar sem instalar)
helm pull oci://registry.example.com/charts/meu-chart --version 1.0.0

# Listar versões no OCI registry (via crictl ou oras CLI)
oras repo tags registry.example.com/charts/meu-chart
\`\`\`

**Vantagens do OCI**: mesma infraestrutura de registry (Harbor, ECR, GCR, ACR), sem chart museum separado, suporte nativo a autenticação e RBAC.

## Library Charts

Library charts fornecem templates e helpers **sem criar recursos Kubernetes**. São reutilizados como dependências:

\`\`\`yaml
# minha-lib/Chart.yaml
apiVersion: v2
name: minha-lib
type: library          # ← tipo library, não application
version: 0.1.0
\`\`\`

\`\`\`yaml
# minha-lib/templates/_labels.tpl
{{- define "minha-lib.standardLabels" -}}
app.kubernetes.io/name: {{ .Values.name }}
app.kubernetes.io/version: {{ .Chart.AppVersion }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
environment: {{ .Values.environment | default "production" }}
{{- end }}

{{- define "minha-lib.containerResources" -}}
resources:
  requests:
    cpu: {{ .cpu.requests | default "100m" }}
    memory: {{ .memory.requests | default "128Mi" }}
  limits:
    cpu: {{ .cpu.limits | default "200m" }}
    memory: {{ .memory.limits | default "256Mi" }}
{{- end }}
\`\`\`

\`\`\`yaml
# app-chart/Chart.yaml — consumindo a library
dependencies:
  - name: minha-lib
    version: "0.1.x"
    repository: oci://registry.example.com/charts
\`\`\`

\`\`\`yaml
# app-chart/templates/deployment.yaml — usando helpers da library
metadata:
  labels:
    {{- include "minha-lib.standardLabels" . | nindent 4 }}
\`\`\`

## Subcharts & Dependências

Subcharts são charts completos incluídos como dependências:

\`\`\`yaml
# Chart.yaml
dependencies:
  - name: postgresql
    version: "12.x.x"
    repository: https://charts.bitnami.com/bitnami
    condition: postgresql.enabled        # habilitar/desabilitar via values
    alias: db                            # nome alternativo no values

  - name: redis
    version: "17.x.x"
    repository: https://charts.bitnami.com/bitnami
    condition: redis.enabled
    tags:                                # habilitar/desabilitar por tag
      - caching
\`\`\`

\`\`\`yaml
# values.yaml — configuração dos subcharts
postgresql:
  enabled: true
  auth:
    database: myapp
    username: appuser
    existingSecret: "postgres-secret"

redis:
  enabled: false

# Tags (alternativa a condition)
tags:
  caching: false
\`\`\`

\`\`\`bash
# Baixar dependências para charts/
helm dependency update ./meu-chart

# Listar dependências e status
helm dependency list ./meu-chart

# Build sem baixar (usa o que já está em charts/)
helm dependency build ./meu-chart
\`\`\`

## Values Schema Validation

\`\`\`json
{
  "$schema": "http://json-schema.org/draft-07/schema",
  "type": "object",
  "required": ["image", "service"],
  "properties": {
    "replicaCount": {
      "type": "integer",
      "minimum": 1,
      "maximum": 20,
      "description": "Número de réplicas do Deployment"
    },
    "image": {
      "type": "object",
      "required": ["repository"],
      "properties": {
        "repository": { "type": "string" },
        "tag": { "type": "string" },
        "pullPolicy": {
          "type": "string",
          "enum": ["Always", "IfNotPresent", "Never"]
        }
      }
    },
    "service": {
      "type": "object",
      "properties": {
        "type": { "type": "string", "enum": ["ClusterIP", "NodePort", "LoadBalancer"] },
        "port": { "type": "integer", "minimum": 1, "maximum": 65535 }
      }
    }
  }
}
\`\`\`

\`\`\`bash
# Schema é validado automaticamente no helm install/upgrade
helm install myapp ./chart --set replicaCount=100
# Error: replicaCount must be <= 20
\`\`\`

## Helm no CI/CD

\`\`\`yaml
# .github/workflows/deploy.yml
name: Deploy with Helm
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Helm
        uses: azure/setup-helm@v3
        with:
          version: '3.14.0'

      - name: Lint Chart
        run: helm lint ./chart

      - name: Render & Validate
        run: |
          helm template myapp ./chart \
            -f values-staging.yaml \
            | kubectl apply --dry-run=server -f -

      - name: Package & Push to OCI
        run: |
          helm package ./chart
          helm registry login \${{ env.REGISTRY }} --username \${{ secrets.USER }} --password \${{ secrets.TOKEN }}
          helm push chart-*.tgz oci://\${{ env.REGISTRY }}/charts

      - name: Deploy to Staging
        run: |
          helm upgrade --install myapp ./chart \
            --namespace staging \
            --create-namespace \
            -f values-staging.yaml \
            --wait \
            --timeout 5m
\`\`\`

## Erros Comuns

1. **helm dependency update não executado**: após adicionar dependência no Chart.yaml, esquecer de rodar dependency update → chart não encontrado.
2. **Conflito de values em subcharts**: valores do parent e subchart podem conflitar. Use alias para separar.
3. **Library chart sem type: library**: sem esse campo, templates do library são renderizados como manifestos inválidos.
4. **Schema JSON muito restritivo**: um schema que restringe valores necessários em CI bloqueia deploys.
`,

  quiz: [
    {
      question: 'O que diferencia um Chart do tipo "library" de um "application" no Helm?',
      options: [
        'Library charts têm mais templates que application charts',
        'Library charts fornecem apenas named templates e helpers, sem gerar recursos Kubernetes; application charts geram recursos',
        'Library charts só funcionam com Helm 2; application charts com Helm 3',
        'Library charts são instalados automaticamente; application charts precisam de helm install'
      ],
      correct: 1,
      explanation: 'Um chart do tipo library (type: library no Chart.yaml) contém apenas templates de suporte (defined templates em _helpers.tpl) que são reutilizados por outros charts via dependência. Ao contrário de application charts, um library chart não pode ser instalado diretamente — serve como "biblioteca" de funções Helm compartilhadas entre múltiplos charts da organização.',
      reference: 'Seção Library Charts — entenda como usar library charts para compartilhar labels, resources e outros helpers entre charts.'
    },
    {
      question: 'Qual é a vantagem de usar OCI registry para armazenar Helm charts em vez de um Chart Museum dedicado?',
      options: [
        'OCI é mais rápido para download de charts grandes',
        'Reutiliza a infraestrutura de registry de imagens existente (Harbor, ECR, GCR), sem servidor adicional',
        'OCI registry tem versionamento automático que Chart Museum não tem',
        'Apenas OCI registry suporta chart signing'
      ],
      correct: 1,
      explanation: 'OCI registry permite armazenar charts no mesmo registry de imagens Docker já utilizado pela organização (Harbor, ECR, ACR, GCR). Isso elimina a necessidade de operar um Chart Museum separado, aproveita autenticação e RBAC existentes, e integra naturalmente com pipelines CI/CD que já fazem push de imagens.',
      reference: 'Seção OCI Registry — helm push/pull usa o mesmo protocolo que docker push/pull para imagens.'
    },
    {
      question: 'Como usar `values.schema.json` no Helm e qual é seu efeito?',
      options: [
        'Define a versão do schema da API do Kubernetes usada no chart',
        'Valida automaticamente os values fornecidos durante helm install/upgrade contra um JSON Schema',
        'Documenta os values disponíveis mas não bloqueia installations',
        'Gera automaticamente o values.yaml a partir de tipos definidos'
      ],
      correct: 1,
      explanation: 'O arquivo values.schema.json na raiz do chart define um JSON Schema que é validado automaticamente durante helm install, upgrade e lint. Se os values fornecidos violarem o schema (tipo errado, valor fora do range, campo obrigatório ausente), o Helm falha com mensagem de erro clara. É essencial para charts de biblioteca que precisam garantir configuração correta.',
      reference: 'Seção Values Schema Validation — use required, enum e minimum/maximum para validar configs críticas.'
    },
    {
      question: 'Qual comando é necessário executar após adicionar uma dependência no Chart.yaml?',
      options: [
        'helm install --update-deps',
        'helm dependency update',
        'helm fetch dependencies',
        'helm chart download'
      ],
      correct: 1,
      explanation: 'helm dependency update baixa os subcharts listados em Chart.yaml para o diretório charts/ e gera/atualiza o Chart.lock. Sem executar este comando após adicionar ou mudar dependências, o helm install falha com "chart not found". Em CI/CD, geralmente se executa dependency update antes do lint e template.',
      reference: 'Seção Subcharts & Dependências — sempre execute dependency update após mudanças no Chart.yaml.'
    },
    {
      question: 'Como habilitar/desabilitar um subchart (ex: postgresql) condicionalmente nos values.yaml?',
      options: [
        'Remover o subchart do Chart.yaml quando não necessário',
        'Usar o campo "condition" no Chart.yaml apontando para um value booleano',
        'Adicionar uma annotation "helm.sh/enabled: false" no subchart',
        'Criar um arquivo .helmignore que exclui o subchart'
      ],
      correct: 1,
      explanation: 'No Chart.yaml, o campo condition: postgresql.enabled faz o Helm instalar o subchart apenas quando .Values.postgresql.enabled=true. O campo tags: permite agrupar múltiplos subcharts e habilitá-los juntos via .Values.tags.nome=true. Isso permite um único chart com componentes opcionais sem duplicação.',
      reference: 'Seção Subcharts & Dependências — condition e tags são mecanismos complementares para controle de subcharts.'
    }
  ],

  flashcards: [
    {
      front: 'Como fazer push de um chart para um OCI registry?',
      back: '```bash\n# 1. Empacotar\nhelm package ./meu-chart\n# Gera: meu-chart-1.0.0.tgz\n\n# 2. Login\nhelm registry login registry.example.com \\\n  --username user --password token\n\n# 3. Push\nhelm push meu-chart-1.0.0.tgz \\\n  oci://registry.example.com/charts\n\n# 4. Instalar do OCI\nhelm install myapp \\\n  oci://registry.example.com/charts/meu-chart \\\n  --version 1.0.0\n```\n\nNota: a URL começa com `oci://` em vez de `https://`.'
    },
    {
      front: 'Como compartilhar helpers Helm entre múltiplos charts usando library charts?',
      back: '**1. Criar library chart** (`type: library` no Chart.yaml)\n\n**2. Adicionar templates no _helpers.tpl** usando `{{- define "lib.nome" -}}`\n\n**3. Consumidor declara dependência**:\n```yaml\n# Chart.yaml do consumer\ndependencies:\n  - name: minha-lib\n    version: "0.1.x"\n    repository: oci://registry/charts\n```\n\n**4. Executar**: `helm dependency update`\n\n**5. Usar no consumer**: `{{- include "minha-lib.labels" . | nindent 4 }}`\n\nLibrary charts não podem ser instalados diretamente — só como dependência.'
    },
    {
      front: 'Como validar values com JSON Schema no Helm?',
      back: 'Criar `values.schema.json` na raiz do chart:\n```json\n{\n  "$schema": "http://json-schema.org/draft-07/schema",\n  "type": "object",\n  "required": ["image"],\n  "properties": {\n    "replicaCount": {\n      "type": "integer",\n      "minimum": 1,\n      "maximum": 20\n    },\n    "image": {\n      "type": "object",\n      "required": ["repository"]\n    }\n  }\n}\n```\n\nValidação automática no `helm install`, `upgrade` e `lint`.\nValor inválido → erro antes de tocar o cluster.'
    }
  ],

  lab: {
    scenario: 'Criar uma library chart com helpers padronizados e consumir em um application chart.',
    objective: 'Dominar library charts e dependency management no Helm.',
    duration: '20-25 minutos',
    steps: [
      {
        title: 'Criar a library chart',
        instruction: 'Crie um chart tipo library chamado `company-lib` com um helper de labels padronizadas.',
        hints: ['type: library no Chart.yaml', 'Helpers em templates/_labels.tpl'],
        solution: `\`\`\`bash
helm create company-lib
# Mudar type para library no Chart.yaml
sed -i 's/type: application/type: library/' company-lib/Chart.yaml

# Remover templates desnecessários (library não gera recursos)
rm -rf company-lib/templates/*.yaml company-lib/templates/tests/

# Criar helper
cat > company-lib/templates/_labels.tpl << 'EOF'
{{- define "company-lib.commonLabels" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
company.io/team: platform
{{- end }}
EOF

# Package a library
helm package ./company-lib
\`\`\``,
        verify: `\`\`\`bash
grep "type: library" company-lib/Chart.yaml
# Esperado: type: library

ls company-lib-*.tgz
# Esperado: company-lib-0.1.0.tgz

helm lint ./company-lib
# Esperado: 0 chart(s) failed
\`\`\``
      },
      {
        title: 'Criar application chart que usa a library',
        instruction: 'Crie um application chart `webapp` que declara a library como dependência e usa seus helpers.',
        hints: ['Copiar o .tgz da library para charts/', 'Referenciar com repository: file://../company-lib'],
        solution: `\`\`\`bash
helm create webapp

# Adicionar dependência no Chart.yaml
cat >> webapp/Chart.yaml << 'EOF'

dependencies:
  - name: company-lib
    version: "0.1.0"
    repository: "file://../company-lib"
EOF

# Atualizar dependências (copia o tgz para charts/)
helm dependency update ./webapp

# Usar o helper no deployment
# Editar webapp/templates/deployment.yaml e substituir labels por:
# labels:
#   {{- include "company-lib.commonLabels" . | nindent 4 }}

helm template myapp ./webapp --show-only templates/deployment.yaml
\`\`\``,
        verify: `\`\`\`bash
ls webapp/charts/
# Esperado: company-lib-0.1.0.tgz

helm template myapp ./webapp | grep "company.io/team"
# Esperado: company.io/team: platform

helm lint ./webapp
# Esperado: 0 chart(s) failed
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Dependência não encontrada após adicionar ao Chart.yaml',
      difficulty: 'easy',
      symptom: 'helm install falha com "Error: found in Chart.yaml, but missing in charts/ directory: postgresql".',
      diagnosis: `\`\`\`bash
# Verificar Chart.lock
cat Chart.lock

# Verificar o diretório charts/
ls charts/

# Tentar dependency update
helm dependency update . 2>&1
\`\`\``,
      solution: `**Causa**: após adicionar dependência no Chart.yaml, é obrigatório executar \`helm dependency update\` para baixar o subchart.

\`\`\`bash
# Solução
helm dependency update ./meu-chart

# Verificar resultado
helm dependency list ./meu-chart
# Esperado: postgresql  12.x.x  OK

# Agora o install funciona
helm install myapp ./meu-chart
\`\`\`

Em CI/CD, sempre adicione \`helm dependency update\` antes do \`helm install\` ou \`helm lint\`.`
    }
  ]
};
