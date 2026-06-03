window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['opa/opa-beyond-k8s'] = {
  theory: `# OPA Além do Kubernetes — Rego, Conftest e Integrações

## Relevância no Exame
> OPA além do Kubernetes é cobrado em KubeAstronaut e CKS. Foca em Rego como linguagem, uso do conftest em pipelines CI/CD, OPA standalone, comparativo com Kyverno e integração com Envoy.

## Conceitos Fundamentais

### Linguagem Rego — O Coração do OPA

Rego é uma linguagem declarativa desenvolvida especificamente para expressar políticas. Diferente de linguagens imperativas, você descreve **o que** deve ser verdade — não **como** verificar.

**Princípios Básicos**:
- Tudo é verdadeiro por padrão se definido
- Avaliação baseada em lógica (similar a Prolog/Datalog)
- Não há loops imperativos — use compreensão de listas
- Imutável: variáveis não podem ser reassinadas

\`\`\`rego
# Pacote define o namespace da política
package example.authz

# Regra padrão: deny
default allow = false

# Regra: permitir GET em /public/
allow {
  input.method == "GET"
  startswith(input.path, "/public/")
}

# Regra: permitir se usuário tem role admin
allow {
  input.user == data.users[_].name
  data.users[_].role == "admin"
}
\`\`\`

### Estrutura de Documentos em Rego

OPA trabalha com 3 documentos principais:

**input**: dados do request sendo avaliado (imutável)
\`\`\`json
{
  "method": "POST",
  "path": "/api/users",
  "user": "alice",
  "body": {"name": "bob"}
}
\`\`\`

**data**: base de conhecimento (políticas e dados externos)
\`\`\`json
{
  "users": [
    {"name": "alice", "role": "admin"},
    {"name": "bob", "role": "viewer"}
  ],
  "allowed_registries": ["docker.io/company", "ghcr.io/org"]
}
\`\`\`

**output (result)**: resultado da avaliação da política

### Sintaxe Rego — Construções Essenciais

#### Regras e Funções
\`\`\`rego
package k8s.security

# Regra booleana
is_privileged_container {
  container := input.spec.containers[_]
  container.securityContext.privileged == true
}

# Regra que retorna valor
image_registry(image) = registry {
  parts := split(image, "/")
  count(parts) > 1
  registry := parts[0]
}

# Função auxiliar
has_label(obj, key) {
  _ = obj.metadata.labels[key]
}

# Compreensão de lista
privileged_containers := [name |
  container := input.spec.containers[_]
  container.securityContext.privileged == true
  name := container.name
]
\`\`\`

#### Iteração com Wildcards
\`\`\`rego
# _ é wildcard — itera sobre todos os elementos
violation[{"msg": msg}] {
  container := input.review.object.spec.containers[_]
  not container.resources.limits.memory
  msg := sprintf("Container %v sem limits.memory", [container.name])
}

# Acessar por chave
violation[{"msg": msg}] {
  required_labels := {"team", "cost-center"}
  label := required_labels[_]
  not input.review.object.metadata.labels[label]
  msg := sprintf("Label obrigatória ausente: %v", [label])
}
\`\`\`

#### Sets e Operações de Conjuntos
\`\`\`rego
# Criar set
allowed_namespaces := {"production", "staging", "development"}

# Verificar pertencimento
valid_namespace {
  input.namespace == allowed_namespaces[_]
}

# Diferença de sets
missing_labels := required_labels - provided_labels
violation[{"msg": msg}] {
  count(missing_labels) > 0
  msg := sprintf("Labels ausentes: %v", [missing_labels])
}
\`\`\`

### OPA Standalone Server

OPA pode rodar como servidor HTTP para qualquer aplicação consultar:

\`\`\`bash
# Iniciar servidor OPA
opa run --server \\
  --addr :8181 \\
  --log-format json \\
  policy.rego data.json

# Consultar política via REST API
curl -X POST http://localhost:8181/v1/data/example/authz/allow \\
  -H "Content-Type: application/json" \\
  -d '{
    "input": {
      "method": "GET",
      "path": "/public/status",
      "user": "bob"
    }
  }'
# Resposta: {"result": true}
\`\`\`

### Bundle Server — Distribuindo Políticas

OPA suporta carregar políticas de um bundle server centralizado:

\`\`\`yaml
# opa-config.yaml
services:
  - name: policy-server
    url: https://policies.company.com

bundles:
  main:
    service: policy-server
    resource: /bundle.tar.gz
    polling:
      min_delay_seconds: 60
      max_delay_seconds: 120

decision_logs:
  service: policy-server
  resource: /logs

status:
  service: policy-server
\`\`\`

\`\`\`bash
# Criar bundle
opa build policy/ -o bundle.tar.gz

# Iniciar OPA com bundle
opa run --server --config-file opa-config.yaml
\`\`\`

### Conftest — OPA para CI/CD

Conftest usa OPA/Rego para testar arquivos de configuração em pipelines:

\`\`\`bash
# Instalar conftest
brew install conftest  # ou via binary

# Estrutura de diretórios
policy/
  k8s.rego          # políticas para K8s
  terraform.rego    # políticas para Terraform
  docker.rego       # políticas para Dockerfile
\`\`\`

#### Políticas Conftest para Kubernetes
\`\`\`rego
# policy/k8s.rego
package main

# Negar containers privilegiados
deny[msg] {
  input.kind == "Deployment"
  container := input.spec.template.spec.containers[_]
  container.securityContext.privileged == true
  msg := sprintf("Container %v não pode ser privilegiado", [container.name])
}

# Exigir resource limits
deny[msg] {
  input.kind == "Deployment"
  container := input.spec.template.spec.containers[_]
  not container.resources.limits.memory
  msg := sprintf("Container %v precisa de limits.memory", [container.name])
}

# Avisar sobre latest tag
warn[msg] {
  input.kind == "Deployment"
  container := input.spec.template.spec.containers[_]
  endswith(container.image, ":latest")
  msg := sprintf("Container %v usa tag :latest — use versão específica", [container.name])
}
\`\`\`

#### Usando Conftest no Pipeline
\`\`\`bash
# Testar manifesto Kubernetes
conftest test deployment.yaml

# Saída esperada com violação:
# FAIL - deployment.yaml - main - Container nginx não pode ser privilegiado

# Testar múltiplos arquivos
conftest test k8s/**/*.yaml

# Testar Dockerfile
conftest test Dockerfile --policy policy/docker.rego

# Testar Terraform
conftest test main.tf

# Output em JSON (para CI)
conftest test deployment.yaml -o json | jq '.[] | .failures[]'

# Usar namespace específico de política
conftest test deployment.yaml --namespace security
\`\`\`

#### Conftest em GitLab CI / GitHub Actions
\`\`\`yaml
# .github/workflows/policy-check.yaml
name: Policy Check
on: [push, pull_request]
jobs:
  policy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install conftest
        run: |
          wget https://github.com/open-policy-agent/conftest/releases/download/v0.46.0/conftest_0.46.0_Linux_x86_64.tar.gz
          tar xzf conftest_*.tar.gz
          sudo mv conftest /usr/local/bin/
      - name: Test K8s manifests
        run: conftest test k8s/ --policy policy/
\`\`\`

### OPA com Envoy — Service Mesh Authorization

OPA integra com Envoy como External Authorization Service (ext_authz):

\`\`\`yaml
# Configuração do Envoy como sidecar
# envoy-config.yaml
static_resources:
  listeners:
  - name: app_listener
    address: {socket_address: {address: 0.0.0.0, port_value: 8000}}
    filter_chains:
    - filters:
      - name: envoy.filters.network.http_connection_manager
        typed_config:
          http_filters:
          - name: envoy.filters.http.ext_authz
            typed_config:
              grpc_service:
                envoy_grpc:
                  cluster_name: opa_authz
          - name: envoy.filters.http.router
\`\`\`

\`\`\`rego
# Política OPA para autenticação HTTP via Envoy
package envoy.authz

import input.attributes.request.http as req

default allow = false

# Permitir health checks
allow {
  req.path == "/health"
  req.method == "GET"
}

# Verificar JWT claims
allow {
  token := req.headers["authorization"]
  decoded := io.jwt.decode(token)
  decoded[1].role == "admin"
  req.method != "DELETE"
}
\`\`\`

### OPA vs Kyverno vs Gatekeeper — Comparativo

| Feature | OPA Standalone | Gatekeeper | Kyverno |
|---------|---------------|------------|---------|
| Linguagem | Rego | Rego | YAML |
| K8s Native | Não | Sim | Sim |
| Curva de aprendizado | Alta (Rego) | Média (Rego) | Baixa (YAML) |
| Mutations | Via webhook | AssignMetadata/Assign | Seletor YAML |
| Generate resources | Não | Não | Sim |
| Audit | Manual | Nativo | Nativo |
| Não-K8s | Sim | Não | Não |
| Community | CNCF Graduated | CNCF Graduated | CNCF Incubating |

**Quando usar cada um**:
- **OPA Standalone**: precisar de policies em APIs, microserviços, CI/CD — não só K8s
- **Gatekeeper**: equipe com experiência Rego, precisar de CRDs nativos, audit contínuo
- **Kyverno**: equipe prefere YAML, precisar de geração de recursos, onboarding rápido

## Comandos Essenciais

### OPA CLI
\`\`\`bash
# Instalar OPA
curl -L -o opa https://openpolicyagent.org/downloads/v0.65.0/opa_linux_amd64_static
chmod 755 opa
sudo mv opa /usr/local/bin/

# Avaliar política localmente
opa eval -d policy.rego -i input.json "data.example.authz.allow"

# REPL interativo para debugging
opa run --stdin-input policy.rego

# Testar políticas (opa test)
opa test policy/ -v

# Checar sintaxe Rego
opa check policy.rego

# Criar bundle
opa build policy/ -o bundle.tar.gz

# Inspecionar bundle
opa inspect bundle.tar.gz
\`\`\`

### Rego Playground e Debugging
\`\`\`bash
# Usar trace para debugging
opa eval --data policy.rego \\
         --input input.json \\
         --explain full \\
         "data.example.allow"

# Usar print() em Rego para debug (OPA 0.34+)
allow {
  print("User:", input.user)
  input.user == "admin"
}
\`\`\`

### Conftest
\`\`\`bash
# Pull políticas de OCI registry
conftest pull ghcr.io/company/policies:latest

# Atualizar políticas
conftest update

# Verificar com múltiplas policies
conftest test file.yaml --policy policy1/ --policy policy2/

# Modo verbose
conftest test deployment.yaml --verbose
\`\`\`

## Exemplos YAML / Rego

### Rego: Política de Segurança Completa para Pods
\`\`\`rego
package k8s.pod.security

# Impedir execução como root
deny[msg] {
  input.kind == "Pod"
  container := input.spec.containers[_]
  container.securityContext.runAsUser == 0
  msg := sprintf("Container %v não pode executar como UID 0 (root)", [container.name])
}

# Exigir readOnlyRootFilesystem
deny[msg] {
  input.kind == "Pod"
  container := input.spec.containers[_]
  not container.securityContext.readOnlyRootFilesystem
  msg := sprintf("Container %v deve ter readOnlyRootFilesystem: true", [container.name])
}

# Proibir hostNetwork
deny[msg] {
  input.kind == "Pod"
  input.spec.hostNetwork == true
  msg := "Pod não pode usar hostNetwork"
}

# Proibir hostPath volumes
deny[msg] {
  input.kind == "Pod"
  volume := input.spec.volumes[_]
  volume.hostPath
  msg := sprintf("Volume %v usa hostPath — não permitido", [volume.name])
}
\`\`\`

### Rego: Validação de Labels e Custo
\`\`\`rego
package company.governance

required_labels := {"team", "cost-center", "environment"}

allowed_environments := {"production", "staging", "development", "testing"}

# Verificar labels obrigatórias
deny[msg] {
  input.kind == "Deployment"
  label := required_labels[_]
  not input.metadata.labels[label]
  msg := sprintf("Label obrigatória ausente no Deployment: %v", [label])
}

# Verificar valor de environment
deny[msg] {
  input.kind == "Deployment"
  env := input.metadata.labels.environment
  not allowed_environments[env]
  msg := sprintf("Valor inválido para environment: %v. Permitidos: %v", [env, allowed_environments])
}

# Verificar formato do cost-center
deny[msg] {
  input.kind == "Deployment"
  cost_center := input.metadata.labels["cost-center"]
  not re_match("^CC-[0-9]{3,6}\$", cost_center)
  msg := sprintf("cost-center '%v' deve seguir formato CC-XXX (ex: CC-001)", [cost_center])
}
\`\`\`

### Teste de Política com OPA
\`\`\`rego
# policy_test.rego
package k8s.pod.security_test

import data.k8s.pod.security

# Teste: deve negar container privilegiado
test_deny_privileged_container {
  deny["Container nginx não pode ser privilegiado"] with input as {
    "kind": "Pod",
    "spec": {
      "containers": [{
        "name": "nginx",
        "securityContext": {"privileged": true}
      }]
    }
  }
}

# Teste: deve permitir container não-privilegiado
test_allow_non_privileged {
  count(deny) == 0 with input as {
    "kind": "Pod",
    "spec": {
      "containers": [{
        "name": "nginx",
        "securityContext": {
          "privileged": false,
          "readOnlyRootFilesystem": true,
          "runAsUser": 1000
        }
      }]
    }
  }
}
\`\`\`

## Erros Comuns

### 1. Rego retorna undefined em vez de false
**Causa**: Regra não definida retorna undefined (não false).
**Solução**: Usar \`default allow = false\` para garantir valor padrão explícito.

### 2. Variável usada antes de ser definida no bloco
**Causa**: Ordem das declarações em Rego não importa — OPA avalia como conjunto de fatos.
**Solução**: Verificar se há typo no nome da variável ou referência a campo inexistente.

### 3. Conftest falha com "no policies found"
**Causa**: Política não tem package main ou está em namespace errado.
**Solução**: Verificar \`package main\` no início do arquivo .rego ou usar \`--namespace\` para especificar.

### 4. OPA server não recarrega políticas
**Causa**: Políticas carregadas na inicialização não são recarregadas automaticamente.
**Solução**: Usar bundle server com \`polling\` configurado ou reiniciar o servidor.

### 5. Performance lenta em políticas com grandes datasets
**Causa**: Iteração sem índice em datasets grandes.
**Solução**: Usar \`data[key]\` com chave ao invés de iterar com \`_\` quando possível.

## Killer.sh Style Challenge

**Contexto**: O time de segurança precisa de policy-as-code no pipeline CI/CD:
1. Instalar conftest
2. Criar política Rego que: nega containers privilegiados, exige limits.memory, avisa sobre tag :latest
3. Testar a política contra um Deployment com problemas
4. Corrigir o Deployment para passar em todas as verificações
5. Integrar o check no GitHub Actions com falha no PR em caso de deny`,

  quiz: [
    {
      question: 'Qual é o comportamento de uma regra Rego que retorna "undefined"?',
      options: [
        'É equivalente a retornar "false" — a regra falha',
        'É diferente de false — a regra não foi definida para aquele input',
        'Causa um erro de execução no OPA',
        'É equivalente a retornar "true" — a regra é verdadeira por padrão'
      ],
      correct: 1,
      explanation: 'Em Rego, "undefined" significa que a regra simplesmente não se aplica ao input dado — é diferente de false. Por isso, é recomendado usar "default allow = false" para garantir valor padrão explícito. Sem o default, uma regra allow undefined seria interpretada como "não sei" ao invés de "não permitido".',
      reference: 'Conceito: Linguagem Rego — sintaxe Rego na teoria.'
    },
    {
      question: 'O que o comando "conftest test deployment.yaml" faz?',
      options: [
        'Valida o YAML contra o schema do Kubernetes',
        'Executa políticas Rego em ./policy/ contra o arquivo e reporta deny/warn/pass',
        'Aplica o deployment no cluster após validação',
        'Testa conectividade com o cluster Kubernetes'
      ],
      correct: 1,
      explanation: 'conftest test executa políticas Rego (por padrão em ./policy/) contra o arquivo de configuração. Retorna FAIL para regras deny[], WARN para warn[] e PASS quando nenhuma violação. É usado em pipelines CI/CD para bloquear PRs com configurações inseguras.',
      reference: 'Conceito: Conftest — seção "Conftest: OPA para CI/CD" na teoria.'
    },
    {
      question: 'Qual é a principal diferença entre Kyverno e Gatekeeper ao lidar com políticas?',
      options: [
        'Kyverno usa Rego; Gatekeeper usa YAML declarativo',
        'Kyverno usa políticas YAML nativas; Gatekeeper usa políticas Rego',
        'Kyverno é apenas para mutations; Gatekeeper é apenas para validations',
        'Kyverno não suporta Kubernetes; Gatekeeper é exclusivo para K8s'
      ],
      correct: 1,
      explanation: 'Kyverno usa políticas YAML (ClusterPolicy, Policy) com sintaxe declarativa sem linguagem de programação separada. Gatekeeper usa Rego — uma linguagem de policy declarativa mais poderosa porém com curva de aprendizado maior. Kyverno é mais acessível para times que conhecem YAML; Gatekeeper é mais expressivo para casos complexos.',
      reference: 'Conceito: OPA vs Kyverno vs Gatekeeper — tabela comparativa na teoria.'
    },
    {
      question: 'Em Rego, o que o símbolo "_" (underscore) representa em uma expressão como "container := input.spec.containers[_]"?',
      options: [
        'O índice numérico do último elemento do array',
        'Um wildcard que itera sobre todos os elementos do array',
        'Uma variável ignorada que não pode ser referenciada',
        'O valor padrão quando o elemento não existe'
      ],
      correct: 1,
      explanation: 'O underscore _ é um wildcard em Rego que representa "qualquer elemento". "containers[_]" significa "qualquer container do array". OPA avaliará a regra para cada combinação possível. Se a violação se aplicar a qualquer container, ela é adicionada ao resultado. É a forma Rego de iterar sem loops imperativos.',
      reference: 'Conceito: Sintaxe Rego — wildcards na teoria.'
    },
    {
      question: 'Como o OPA standalone difere do Gatekeeper em termos de casos de uso?',
      options: [
        'OPA standalone só funciona em Linux; Gatekeeper em qualquer OS',
        'OPA standalone pode ser usado para APIs, microserviços, Terraform e outros — não apenas K8s; Gatekeeper é exclusivo para K8s',
        'OPA standalone não suporta Rego; Gatekeeper sim',
        'OPA standalone é open source; Gatekeeper é comercial'
      ],
      correct: 1,
      explanation: 'OPA standalone é um motor de políticas genérico que pode ser integrado a qualquer sistema que possa fazer chamadas HTTP: APIs REST, microserviços, pipelines CI/CD, Terraform (via Sentinel), Envoy, etc. Gatekeeper é OPA especializado apenas para Kubernetes (ValidatingAdmissionWebhook).',
      reference: 'Conceito: OPA Standalone Server — seção na teoria.'
    },
    {
      question: 'Qual é a função do "data" document no OPA?',
      options: [
        'Contém o request sendo avaliado (imutável durante a avaliação)',
        'Contém a base de conhecimento: políticas externas, listas de permissão, configurações',
        'Contém o resultado da avaliação da política',
        'Contém logs de decisões anteriores do OPA'
      ],
      correct: 1,
      explanation: 'No OPA, "data" é o documento de base de conhecimento — contém dados externos que as políticas consultam: listas de usuários permitidos, registries aprovados, configurações, etc. É separado do "input" (request imutável). Políticas podem combinar input + data para decisões contextuais.',
      reference: 'Conceito: Estrutura de Documentos em Rego — seção na teoria.'
    },
    {
      question: 'Como integrar conftest em um pipeline GitHub Actions para bloquear PRs com violações?',
      options: [
        'Usando kubectl apply --dry-run com conftest como validador',
        'Criando um step que executa conftest test e falhando o job se houver saída FAIL',
        'Configurando um webhook do GitHub para chamar o OPA server',
        'Usando GitOps com ArgoCD que chama conftest automaticamente'
      ],
      correct: 1,
      explanation: 'conftest retorna exit code 1 quando há falhas (deny[]). Em GitHub Actions, basta adicionar um step com "run: conftest test k8s/" — o job falha automaticamente se conftest retornar exit code 1, bloqueando o PR. É a forma mais simples de policy-as-code em CI/CD.',
      reference: 'Conceito: Conftest em CI/CD — seção "Conftest em GitLab CI / GitHub Actions" na teoria.'
    },
    {
      question: 'O que é um OPA Bundle e qual seu objetivo?',
      options: [
        'Um conjunto de Constraints aplicadas simultaneamente',
        'Um arquivo .tar.gz contendo políticas e dados que o OPA carrega de um servidor centralizado',
        'Um pacote Helm para instalar o OPA',
        'Um conjunto de testes Rego executados em conjunto'
      ],
      correct: 1,
      explanation: 'Um Bundle é um arquivo .tar.gz contendo arquivos .rego (políticas) e .json (dados). O OPA pode carregar bundles de um servidor centralizado (Bundle Server) e atualizá-los periodicamente via polling. Isso permite distribuir políticas centralizadas para múltiplas instâncias OPA sem reiniciar.',
      reference: 'Conceito: Bundle Server — seção "Bundle Server: Distribuindo Políticas" na teoria.'
    }
  ],

  flashcards: [
    {
      front: 'Quais são os 3 documentos principais do OPA e para que servem?',
      back: 'input:\n- Request sendo avaliado\n- Imutável durante avaliação\n- Fornecido pelo caller (app, K8s, Envoy)\n- Ex: {method: "GET", user: "alice"}\n\ndata:\n- Base de conhecimento\n- Políticas externas e dados auxiliares\n- Ex: lista de usuários, registries permitidos\n- Pode ser carregado de bundle server\n\nresult (output):\n- Resultado da avaliação\n- Ex: allow = true/false\n- Ex: deny = ["mensagem de erro"]\n- Ex: violations = [{msg: "..."}]'
    },
    {
      front: 'Qual é a diferença entre "deny" e "warn" em políticas Conftest?',
      back: 'deny[msg] {\n  # Viola a política\n  # Causa FAIL no conftest\n  # Exit code 1 → bloqueia CI/CD\n  # Mensagem mostrada como FAIL\n}\n\nwarn[msg] {\n  # Condição de aviso\n  # Causa WARN no conftest\n  # Exit code 0 → não bloqueia CI/CD\n  # Mensagem mostrada como WARN\n}\n\nUso típico:\n- deny: violações de segurança críticas\n  (privileged: true, hostNetwork, etc)\n- warn: boas práticas não obrigatórias\n  (tag :latest, sem liveness probe, etc)'
    },
    {
      front: 'Como escrever testes para políticas Rego?',
      back: '# Arquivo: policy_test.rego\npackage example_test\nimport data.example\n\n# Teste positivo: deve negar\ntest_deny_privileged {\n  # Passa input simulado e verifica resultado\n  example.deny["msg"] with input as {\n    "kind": "Pod",\n    "spec": {"containers": [{\n      "name": "app",\n      "securityContext": {"privileged": true}\n    }]}\n  }\n}\n\n# Teste negativo: não deve negar\ntest_allow_safe_pod {\n  count(example.deny) == 0 with input as {\n    "kind": "Pod",\n    "spec": {"containers": [{\n      "name": "app",\n      "securityContext": {"privileged": false}\n    }]}\n  }\n}\n\n# Executar testes\nopa test policy/ -v'
    },
    {
      front: 'Comparativo OPA vs Kyverno vs Gatekeeper — quando usar cada um?',
      back: 'OPA Standalone:\n✅ Políticas além do K8s (APIs, Terraform, Envoy)\n✅ Máxima expressividade (Rego)\n✅ Reutilizar mesma política em múltiplos sistemas\n❌ Requer integração manual com K8s\n❌ Curva Rego é alta\n\nGatekeeper:\n✅ OPA nativo no K8s com CRDs\n✅ Audit automático contínuo\n✅ Mutations via AssignMetadata/Assign\n❌ Rego ainda necessário\n❌ Somente K8s\n\nKyverno:\n✅ Políticas em YAML puro\n✅ Pode GERAR recursos (ClusterRole, ConfigMap)\n✅ Onboarding muito rápido\n❌ Menos expressivo que Rego\n❌ Somente K8s'
    },
    {
      front: 'Como o Conftest é usado em pipelines CI/CD para policy-as-code?',
      back: 'Fluxo:\n1. Developer cria/modifica manifesto K8s\n2. Push para branch → dispara CI\n3. conftest test k8s/ executa políticas Rego\n4. Se deny[] → exit code 1 → CI falha → PR bloqueado\n5. Se warn[] → CI passa com aviso\n6. PR só é mergeado após corrigir violações\n\nComandos:\nconftest test deployment.yaml\nconftest test k8s/ --policy policy/\nconftest pull ghcr.io/org/policies:latest\n\nIntegração GitHub Actions:\n- name: Policy Check\n  run: conftest test k8s/\n  # Job falha automaticamente se exit code 1\n\nBenefícios:\n- Previne problemas no cluster\n- Feedback imediato ao developer\n- Políticas versionadas junto ao código'
    },
    {
      front: 'Como o OPA integra com Envoy para autorização de service mesh?',
      back: 'Arquitetura:\n1. Envoy como sidecar de cada serviço\n2. Envoy envia requests para OPA via ext_authz (gRPC)\n3. OPA avalia política com HTTP attributes\n4. OPA retorna allow/deny\n5. Envoy passa ou bloqueia o request\n\nVantagens:\n- Políticas centralizadas em OPA\n- Aplicadas a qualquer serviço sem modificar código\n- JWT validation, RBAC, rate limiting por policy\n- Observabilidade: OPA decision logs\n\nPolítica Rego para Envoy:\npackage envoy.authz\nimport input.attributes.request.http as req\ndefault allow = false\nallow {\n  req.path == "/health"\n  req.method == "GET"\n}'
    },
    {
      front: 'O que são wildcards e compreensão de listas em Rego?',
      back: 'Wildcard _ (qualquer elemento):\n# Itera sobre todos os containers\ncontainer := input.spec.containers[_]\n\n# Itera sobre todos os volumes\nvolume := input.spec.volumes[_]\n\nCompreensão de lista:\n# Coletar nomes de containers sem limits\nno_limits := [name |\n  container := input.spec.containers[_]\n  not container.resources.limits.memory\n  name := container.name\n]\n\nCompreensão de set:\nprivileged_containers := {name |\n  container := input.spec.containers[_]\n  container.securityContext.privileged\n  name := container.name\n}\n\n# Verificar se set não está vazio\nviolation {\n  count(privileged_containers) > 0\n}'
    },
    {
      front: 'Como usar o OPA Bundle Server para distribuir políticas?',
      back: 'Bundle = arquivo .tar.gz com:\n- Arquivos .rego (políticas)\n- .json (dados externos)\n- manifest.json (metadados)\n\nCriar bundle:\nopa build policy/ data/ -o bundle.tar.gz\n\nConfig OPA para consumir bundle:\nservices:\n  - name: bundle-server\n    url: https://bundles.company.com\nbundles:\n  main:\n    service: bundle-server\n    resource: /v1/bundle.tar.gz\n    polling:\n      min_delay_seconds: 30\n      max_delay_seconds: 120\n\nVantagens:\n- Políticas atualizadas sem restart\n- Versioning centralizado\n- Múltiplos OPAs com mesma política\n- Assinatura de bundle (segurança)\nopa build --signing-key private.pem policy/'
    }
  ],

  lab: {
    scenario: 'O time de segurança quer implementar policy-as-code no pipeline de deploys. Antes de qualquer manifesto chegar ao cluster, ele deve passar por validação de políticas Rego via conftest. Você deve criar as políticas e integrá-las ao workflow.',
    objective: 'Instalar conftest, criar políticas Rego de segurança para K8s, testar contra manifestos com problemas, corrigir os manifestos e validar que passam nas políticas.',
    duration: '25-35 minutos',
    steps: [
      {
        title: 'Instalar Conftest e Criar Estrutura de Políticas',
        instruction: `Instale o conftest e crie a estrutura de diretórios para políticas:

1. Instale o conftest (via binário ou package manager)
2. Crie o diretório \`policy/\` com um arquivo \`k8s.rego\`
3. A política deve:
   - Negar containers privilegiados
   - Negar containers sem \`limits.memory\`
   - Avisar (warn) sobre imagens com tag \`:latest\`
   - Negar uso de \`hostNetwork: true\``,
        hints: [
          'conftest usa package main por padrão',
          'deny[] para erros, warn[] para avisos',
          'O wildcard _ itera sobre todos os elementos de um array',
          'sprintf formata mensagens com contexto útil'
        ],
        solution: `\`\`\`bash
# Instalar conftest
CONFTEST_VERSION=0.46.0
wget https://github.com/open-policy-agent/conftest/releases/download/v\${CONFTEST_VERSION}/conftest_\${CONFTEST_VERSION}_Linux_x86_64.tar.gz
tar xzf conftest_\${CONFTEST_VERSION}_Linux_x86_64.tar.gz
sudo mv conftest /usr/local/bin/
conftest --version

# Criar estrutura
mkdir -p policy

# Criar política Rego
cat > policy/k8s.rego << 'EOF'
package main

# Negar containers privilegiados
deny[msg] {
  input.kind == "Deployment"
  container := input.spec.template.spec.containers[_]
  container.securityContext.privileged == true
  msg := sprintf("SECURITY: Container '%v' não pode ser privilegiado", [container.name])
}

# Negar containers sem limits.memory
deny[msg] {
  input.kind == "Deployment"
  container := input.spec.template.spec.containers[_]
  not container.resources.limits.memory
  msg := sprintf("RESOURCES: Container '%v' deve ter limits.memory definido", [container.name])
}

# Negar hostNetwork
deny[msg] {
  input.kind == "Deployment"
  input.spec.template.spec.hostNetwork == true
  msg := "NETWORK: Deployment não pode usar hostNetwork: true"
}

# Avisar sobre tag :latest
warn[msg] {
  input.kind == "Deployment"
  container := input.spec.template.spec.containers[_]
  endswith(container.image, ":latest")
  msg := sprintf("IMAGE: Container '%v' usa tag :latest — prefira versão específica", [container.name])
}
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verificar instalação
conftest --version
# Saída esperada: conftest version 0.46.0

# Verificar arquivo de política
ls policy/
# Saída esperada: k8s.rego

# Checar sintaxe Rego (sem erros = OK)
# Via OPA se disponível:
# opa check policy/k8s.rego

# Teste rápido com YAML inline
echo 'kind: Deployment
metadata:
  name: test
spec:
  template:
    spec:
      containers:
        - name: app
          image: nginx:latest
          securityContext:
            privileged: false' | conftest test - --policy policy/
# Saída esperada: WARN - IMAGE: Container 'app' usa tag :latest
# (e FAIL por limits.memory ausente)
\`\`\``
      },
      {
        title: 'Testar Manifestos Problemáticos e Corrigir',
        instruction: `Crie dois manifestos de teste:
1. \`bad-deployment.yaml\` — com múltiplas violações (privilegiado, sem limits, :latest, hostNetwork)
2. \`good-deployment.yaml\` — conforme com todas as políticas

Execute conftest em ambos e valide que:
- bad-deployment tem FAILs e WARNs
- good-deployment passa sem erros`,
        hints: [
          'conftest retorna exit code 1 se houver deny, 0 se apenas warn ou pass',
          'Use "conftest test --no-color" para output limpo em logs',
          'good-deployment precisa: sem privileged, limits.memory definido, imagem com tag específica, sem hostNetwork'
        ],
        solution: `\`\`\`bash
# Criar manifesto com problemas
cat > bad-deployment.yaml << 'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bad-app
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: bad-app
  template:
    metadata:
      labels:
        app: bad-app
    spec:
      hostNetwork: true
      containers:
        - name: app
          image: nginx:latest
          securityContext:
            privileged: true
          # Sem resources.limits!
EOF

# Testar manifesto problemático
conftest test bad-deployment.yaml
# Esperado: múltiplos FAILs

# Criar manifesto correto
cat > good-deployment.yaml << 'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: good-app
  namespace: default
  labels:
    team: platform
    cost-center: CC-001
spec:
  replicas: 1
  selector:
    matchLabels:
      app: good-app
  template:
    metadata:
      labels:
        app: good-app
    spec:
      hostNetwork: false
      containers:
        - name: app
          image: nginx:1.25.3
          securityContext:
            privileged: false
            readOnlyRootFilesystem: true
            runAsNonRoot: true
            runAsUser: 1000
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi
EOF

# Testar manifesto correto
conftest test good-deployment.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verificar que bad-deployment falha com exit code 1
conftest test bad-deployment.yaml; echo "Exit: \$?"
# Saída esperada:
# FAIL - bad-deployment.yaml - main - SECURITY: Container 'app' não pode ser privilegiado
# FAIL - bad-deployment.yaml - main - RESOURCES: Container 'app' deve ter limits.memory
# FAIL - bad-deployment.yaml - main - NETWORK: Deployment não pode usar hostNetwork: true
# WARN - bad-deployment.yaml - main - IMAGE: Container 'app' usa tag :latest
# Exit: 1

# Verificar que good-deployment passa com exit code 0
conftest test good-deployment.yaml; echo "Exit: \$?"
# Saída esperada:
# 1 test, 0 failures  (ou similar)
# Exit: 0

# Testar ambos juntos
conftest test bad-deployment.yaml good-deployment.yaml
# Saída esperada: good-deployment.yaml passa, bad-deployment.yaml falha
\`\`\``
      },
      {
        title: 'Criar Política Avançada com Testes Rego',
        instruction: `Crie uma política mais avançada com testes automatizados:

1. Adicione uma nova política \`policy/governance.rego\` que valida labels obrigatórias (team, cost-center) em Deployments
2. Crie um arquivo de testes \`policy/governance_test.rego\`
3. Execute \`opa test policy/\` para validar os testes
4. Execute conftest contra os manifestos criados no passo anterior`,
        hints: [
          'Arquivos de teste Rego devem terminar em _test.rego',
          'Funções de teste começam com test_',
          'Use "with input as {...}" para simular inputs nos testes',
          'opa test executa testes Rego nativo (não conftest)'
        ],
        solution: `\`\`\`bash
# Criar política de governance
cat > policy/governance.rego << 'EOF'
package main

required_labels := {"team", "cost-center"}

# Verificar labels obrigatórias em Deployments
deny[msg] {
  input.kind == "Deployment"
  label := required_labels[_]
  not input.metadata.labels[label]
  msg := sprintf("GOVERNANCE: Label obrigatória ausente: '%v'", [label])
}
EOF

# Criar testes para a política
cat > policy/governance_test.rego << 'EOF'
package main_test

import data.main

# Teste: deve negar deployment sem labels
test_deny_missing_labels {
  main.deny["GOVERNANCE: Label obrigatória ausente: 'team'"] with input as {
    "kind": "Deployment",
    "metadata": {
      "name": "test",
      "labels": {"cost-center": "CC-001"}  # falta team!
    },
    "spec": {
      "template": {
        "spec": {
          "containers": [{
            "name": "app",
            "image": "nginx:1.25",
            "securityContext": {"privileged": false},
            "resources": {"limits": {"memory": "128Mi"}}
          }]
        }
      }
    }
  }
}

# Teste: deve passar com labels corretas
test_pass_with_required_labels {
  result := main.deny with input as {
    "kind": "Deployment",
    "metadata": {
      "name": "test",
      "labels": {
        "team": "backend",
        "cost-center": "CC-001"
      }
    },
    "spec": {
      "template": {
        "spec": {
          "containers": [{
            "name": "app",
            "image": "nginx:1.25",
            "securityContext": {"privileged": false},
            "resources": {"limits": {"memory": "128Mi"}}
          }]
        }
      }
    }
  }
  # Nenhum deny de governance deve ser disparado
  count([r | r := result[_]; startswith(r, "GOVERNANCE:")]) == 0
}
EOF

# Instalar OPA para rodar testes
curl -L -o opa https://openpolicyagent.org/downloads/v0.65.0/opa_linux_amd64_static
chmod +x opa
sudo mv opa /usr/local/bin/

# Executar testes Rego
opa test policy/ -v

# Executar conftest em ambos os deployments com nova política
conftest test bad-deployment.yaml good-deployment.yaml
\`\`\``,
        verify: `\`\`\`bash
# Verificar testes Rego passam
opa test policy/ -v
# Saída esperada:
# PASS: test_deny_missing_labels (Xms)
# PASS: test_pass_with_required_labels (Xms)
# -------
# PASS: 2/2 tests

# Verificar que good-deployment agora falha por labels ausentes
conftest test good-deployment.yaml
# Saída esperada: FAIL - GOVERNANCE: Label obrigatória ausente
# (good-deployment não tem team/cost-center labels)

# Adicionar labels ao good-deployment e testar novamente
kubectl patch --local -f good-deployment.yaml \\
  --type merge \\
  -p '{"metadata":{"labels":{"team":"platform","cost-center":"CC-001"}}}' \\
  -o yaml > good-deployment-labeled.yaml

conftest test good-deployment-labeled.yaml; echo "Exit: \$?"
# Saída esperada: Exit: 0 (passa todas as políticas)
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Conftest retorna "no policies found" ao testar arquivos',
      difficulty: 'easy',
      symptom: 'Ao executar "conftest test deployment.yaml", o output mostra "no policies found" e o resultado é sempre PASS, mesmo com manifestos claramente incorretos.',
      diagnosis: `\`\`\`bash
# Verificar diretório de política atual
ls policy/ 2>/dev/null || echo "Diretório policy/ não encontrado"

# Verificar package da política
head -3 policy/k8s.rego
# Deve começar com: package main

# Ver onde conftest busca políticas
conftest test deployment.yaml --verbose

# Listar políticas disponíveis
conftest test deployment.yaml --trace

# Verificar estrutura de diretórios
find . -name "*.rego" -type f
\`\`\``,
      solution: `**Causa 1**: Diretório policy/ não existe no diretório atual.
\`\`\`bash
# Criar diretório e adicionar política
mkdir -p policy
# ... criar arquivos .rego

# Ou especificar caminho explícito
conftest test deployment.yaml --policy /caminho/para/policy/
\`\`\`

**Causa 2**: Package incorreto — deve ser "package main" para conftest usar por default.
\`\`\`rego
# ERRADO:
package k8s.security

# CORRETO (padrão conftest):
package main

deny[msg] { ... }
\`\`\`
Ou usar namespace específico:
\`\`\`bash
conftest test deployment.yaml --namespace k8s.security
\`\`\`

**Causa 3**: Arquivo .rego com erro de sintaxe — conftest ignora silenciosamente.
\`\`\`bash
# Checar sintaxe
opa check policy/k8s.rego
# Se retornar erro: corrigir o erro Rego antes de usar conftest
\`\`\``
    },
    {
      title: 'Política Rego sempre retorna undefined ao invés de false para "allow"',
      difficulty: 'medium',
      symptom: 'Uma política OPA para permitir/negar acesso sempre retorna "undefined" ao consultar "data.myapp.authz.allow", mesmo quando todas as condições deveriam ser false. A aplicação interpreta undefined como "permissão não encontrada" e usa comportamento padrão inseguro.',
      diagnosis: `\`\`\`bash
# Avaliar a política com input de teste
opa eval -d policy.rego -i input.json "data.myapp.authz.allow"
# Se retornar {} vazio: undefined

# Verificar se a regra default está definida
grep "default allow" policy.rego

# Rodar com trace para ver fluxo de avaliação
opa eval -d policy.rego -i input.json \\
  --explain full "data.myapp.authz.allow"

# Testar input específico interativamente
opa run policy.rego
# > data.myapp.authz.allow with input as {"user": "alice"}
\`\`\``,
      solution: `**Causa**: Falta de regra "default" — em Rego, regras não definidas retornam undefined (não false).

\`\`\`rego
# PROBLEMÁTICO — sem default:
package myapp.authz

allow {
  input.user == "admin"
}
# Para user="alice": allow = undefined (não false!)

# CORRETO — com default explícito:
package myapp.authz

default allow = false  # <- CRÍTICO: define comportamento padrão

allow {
  input.user == "admin"
}
# Para user="alice": allow = false
# Para user="admin": allow = true
\`\`\`

**Boas práticas**:
\`\`\`rego
# Sempre definir defaults para regras booleanas principais
default allow = false
default deny = false

# Para sets de violações, usar diretamente (set vazio = sem violações):
deny[msg] { ... }  # vazio = nenhuma violação (não precisa de default)
\`\`\`

**Verificar depois da correção**:
\`\`\`bash
opa eval -d policy.rego \\
  -i <(echo '{"user": "bob"}') \\
  "data.myapp.authz.allow"
# Saída esperada: {"result": false}  (não undefined!)
\`\`\``
    }
  ]
};
