window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['cks-supply-chain/image-hardening'] = {

  theory: `# Container Image Hardening

## Relevancia no CKS
> O dominio "Supply Chain Security" vale **20%** do CKS. Hardening de imagens reduz a superficie de ataque dos containers. Voce deve saber construir imagens seguras, usar multi-stage builds e base images minimas.

---

## Principios de Image Hardening

1. **Usar base images minimas** (distroless, alpine, scratch)
2. **Multi-stage builds** para separar build de runtime
3. **Rodar como non-root** (USER)
4. **Nao incluir ferramentas desnecessarias** (shells, debuggers)
5. **Pintar versoes** (nunca usar :latest)
6. **Minimizar layers** e remover cache

---

## Base Images Seguras

| Base Image | Tamanho | Shell? | Package Manager? | Uso |
|-----------|---------|--------|-----------------|-----|
| \`scratch\` | 0 MB | Nao | Nao | Binarios estaticos (Go) |
| \`distroless\` | ~2 MB | Nao | Nao | Apps compilados |
| \`alpine\` | ~5 MB | Sim (sh) | apk | Quando precisa de shell |
| \`ubuntu\` | ~75 MB | Sim (bash) | apt | Dev/debug (evitar em prod) |

\`\`\`dockerfile
# RUIM: imagem grande com muitas ferramentas
FROM ubuntu:22.04

# BOM: imagem minima
FROM gcr.io/distroless/static-debian12

# BOM: alpine quando precisa de shell
FROM alpine:3.19
\`\`\`

---

## Multi-Stage Builds

\`\`\`dockerfile
# Stage 1: Build
FROM golang:1.22 AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/server

# Stage 2: Runtime (imagem final)
FROM gcr.io/distroless/static-debian12
COPY --from=builder /app/server /server
USER 65534:65534
ENTRYPOINT ["/server"]
\`\`\`

Beneficios:
- Imagem final nao contem compilador, source code, ferramentas de build
- Tamanho drasticamente menor
- Superficie de ataque minimizada

---

## Rodar como Non-Root

\`\`\`dockerfile
# Criar usuario sem privilegios
FROM alpine:3.19
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copiar arquivos com ownership correto
COPY --chown=appuser:appgroup app /app/

# Mudar para non-root
USER appuser

CMD ["/app/server"]
\`\`\`

\`\`\`dockerfile
# Alternativa: usar UID numerico (mais seguro)
FROM alpine:3.19
RUN adduser -D -u 10001 appuser
USER 10001
\`\`\`

---

## Boas Praticas no Dockerfile

\`\`\`dockerfile
# 1. Pintar versoes (NAO usar :latest)
FROM nginx:1.25.4-alpine

# 2. Usar COPY ao inves de ADD (ADD pode baixar URLs e extrair tars)
COPY config.yaml /etc/app/

# 3. Nao armazenar secrets no Dockerfile
# RUIM:
# ENV DB_PASSWORD=secret123
# BOM: usar secrets do runtime

# 4. Limpar cache e arquivos temporarios na mesma layer
RUN apt-get update && \\
    apt-get install -y --no-install-recommends curl && \\
    apt-get clean && \\
    rm -rf /var/lib/apt/lists/*

# 5. Usar .dockerignore
# .dockerignore:
# .git
# .env
# node_modules
# *.md

# 6. Read-only filesystem
# No Kubernetes:
# securityContext:
#   readOnlyRootFilesystem: true

# 7. Healthcheck
HEALTHCHECK --interval=30s --timeout=3s \\
  CMD curl -f http://localhost:8080/health || exit 1
\`\`\`

---

## Dockerfile Linting com Hadolint

\`\`\`bash
# Instalar hadolint
docker run --rm -i hadolint/hadolint < Dockerfile

# Regras importantes:
# DL3006: Always tag the version of an image
# DL3008: Pin versions in apt-get install
# DL3009: Delete apt-get lists after installing
# DL3025: Use JSON notation for CMD
# DL4006: Set SHELL option -o pipefail
\`\`\`

---

## Verificacao de Imagem no Kubernetes

\`\`\`yaml
# Pod com configuracoes de seguranca
apiVersion: v1
kind: Pod
metadata:
  name: hardened-app
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 10001
    fsGroup: 10001
  containers:
  - name: app
    image: myregistry.com/app:v1.2.3
    imagePullPolicy: Always
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop: ["ALL"]
    volumeMounts:
    - name: tmp
      mountPath: /tmp
  volumes:
  - name: tmp
    emptyDir: {}
\`\`\`

---

## Erros Comuns

1. **Usar :latest** — imagens mudam sem controle
2. **ADD ao inves de COPY** — ADD pode executar operacoes inesperadas
3. **Rodar como root** — superficie de ataque maior
4. **Incluir ferramentas de debug em prod** — facilita pos-exploracao
5. **Secrets no Dockerfile** — ficam nas layers da imagem
6. **Nao usar .dockerignore** — pode incluir .env e .git na imagem
7. **Nao limpar cache** — aumenta tamanho e superficie de ataque

---

## Killer.sh Style Challenge

> Corrija o seguinte Dockerfile: usa ubuntu como base, roda como root, usa ADD, inclui ferramentas desnecessarias e usa :latest. Reescreva usando multi-stage build com distroless, non-root user e boas praticas.
`,

  quiz: [
    {
      question: 'Qual base image nao contem shell, package manager nem ferramentas de debug?',
      options: ['alpine', 'ubuntu-minimal', 'distroless', 'busybox'],
      correct: 2,
      explanation: 'Distroless (Google) contem apenas a aplicacao e suas dependencias de runtime. Nao possui shell, package manager ou ferramentas, minimizando a superficie de ataque.',
      reference: 'Conceito relacionado: Base images seguras.'
    },
    {
      question: 'Por que usar COPY ao inves de ADD no Dockerfile?',
      options: [
        'COPY e mais rapido',
        'ADD pode baixar URLs remotas e extrair tars automaticamente, introduzindo riscos',
        'COPY suporta mais formatos',
        'ADD nao funciona com multi-stage'
      ],
      correct: 1,
      explanation: 'ADD pode baixar URLs e extrair automaticamente arquivos tar, o que pode introduzir conteudo inesperado. COPY apenas copia arquivos locais, sendo mais previsivel e seguro.',
      reference: 'Conceito relacionado: Dockerfile — COPY vs ADD.'
    },
    {
      question: 'Qual a vantagem principal de multi-stage builds?',
      options: [
        'Builds mais rapidos',
        'A imagem final nao contem ferramentas de build, source code ou dependencias de compilacao',
        'Suporte a multiplas arquiteturas',
        'Cache melhor entre builds'
      ],
      correct: 1,
      explanation: 'Multi-stage builds separam o ambiente de build do runtime. A imagem final contem apenas o binario e dependencias de runtime, sem compilador, source code ou ferramentas.',
      reference: 'Conceito relacionado: Multi-stage builds — seguranca.'
    },
    {
      question: 'Por que e inseguro usar a tag :latest em imagens?',
      options: [
        ':latest e mais lento',
        'A imagem pode mudar sem controle, introduzindo vulnerabilidades ou breaking changes',
        ':latest nao e suportado em producao',
        ':latest nao funciona com pull policies'
      ],
      correct: 1,
      explanation: ':latest e uma tag mutavel que pode apontar para diferentes versoes da imagem ao longo do tempo. Pintar versoes especificas (ex: nginx:1.25.4) garante reprodutibilidade.',
      reference: 'Conceito relacionado: Image tags — versionamento.'
    },
    {
      question: 'Qual diretiva do Dockerfile define o usuario que executara o container?',
      options: ['RUN useradd', 'OWNER', 'USER', 'RUNAS'],
      correct: 2,
      explanation: 'A diretiva USER define qual usuario (e opcionalmente grupo) executara os comandos seguintes e o container. Ex: USER 10001:10001.',
      reference: 'Conceito relacionado: Dockerfile — USER.'
    },
    {
      question: 'O que o hadolint verifica?',
      options: [
        'Vulnerabilidades em imagens',
        'Boas praticas e problemas de seguranca em Dockerfiles',
        'Performance de containers',
        'Compatibilidade de arquitetura'
      ],
      correct: 1,
      explanation: 'Hadolint e um linter para Dockerfiles que verifica boas praticas (pintar versoes, usar COPY ao inves de ADD, limpar cache) e problemas de seguranca.',
      reference: 'Conceito relacionado: Dockerfile linting — hadolint.'
    },
    {
      question: 'Qual campo do securityContext impede que o container modifique seu filesystem?',
      options: ['noWrite: true', 'readOnlyRootFilesystem: true', 'immutable: true', 'readOnly: true'],
      correct: 1,
      explanation: 'readOnlyRootFilesystem: true torna o root filesystem do container read-only. Escritas devem usar emptyDir volumes montados em /tmp ou outros paths.',
      reference: 'Conceito relacionado: Container immutability — read-only filesystem.'
    }
  ],

  flashcards: [
    { front: 'Quais sao as base images mais seguras?', back: 'scratch (0MB, binarios estaticos), distroless (~2MB, sem shell/pkg manager), alpine (~5MB, com shell minimo). Em producao, preferir distroless ou scratch.' },
    { front: 'O que e multi-stage build?', back: 'Dockerfile com multiplos FROM. Primeiro stage compila/build, ultimo stage contem apenas o artefato final. Imagem final nao tem ferramentas de build, reduzindo superficie de ataque.' },
    { front: 'Por que rodar containers como non-root?', back: 'Root no container = root no host se houver escape. Non-root limita o impacto de exploits. Usar USER <uid> no Dockerfile e runAsNonRoot: true no K8s.' },
    { front: 'O que e .dockerignore?', back: 'Arquivo que define quais arquivos/diretorios NAO copiar para o build context. Evita incluir .git, .env, node_modules, secrets. Funciona como .gitignore.' },
    { front: 'Por que COPY e mais seguro que ADD?', back: 'ADD pode baixar URLs remotas e extrair tars automaticamente, introduzindo conteudo inesperado. COPY apenas copia arquivos locais, sendo previsivel e seguro.' },
    { front: 'O que o hadolint verifica?', back: 'Linter para Dockerfiles. Verifica: versoes pintadas (DL3006), apt lists removidos (DL3009), COPY vs ADD, JSON CMD format (DL3025), uso de pipefail (DL4006).' },
    { front: 'Como fazer container read-only no K8s?', back: 'securityContext.readOnlyRootFilesystem: true. Usar emptyDir volumes para diretorios que precisam de escrita (/tmp, /var/cache). Previne modificacao do container em runtime.' }
  ],

  lab: {
    scenario: 'Voce recebeu um Dockerfile inseguro e precisa aplicar hardening seguindo boas praticas de seguranca.',
    objective: 'Reescrever um Dockerfile inseguro usando multi-stage build, non-root user e base image minima.',
    duration: '15-20 minutos',
    steps: [
      {
        title: 'Analisar Dockerfile Inseguro',
        instruction: 'Identifique os problemas de seguranca no Dockerfile atual: usa ubuntu, roda como root, usa ADD, e inclui ferramentas desnecessarias.',
        hints: [
          'Procure por: base image grande, falta de USER, uso de ADD, :latest',
          'Use hadolint para analise automatica',
          'Liste cada problema encontrado'
        ],
        solution: '```bash\n# Criar Dockerfile inseguro para analise\ncat > /tmp/Dockerfile.insecure <<\'EOF\'\nFROM ubuntu:latest\nADD . /app\nRUN apt-get update && apt-get install -y curl wget vim netcat\nWORKDIR /app\nENV DB_PASSWORD=secret123\nCMD python3 app.py\nEOF\n\n# Analisar com hadolint\ndocker run --rm -i hadolint/hadolint < /tmp/Dockerfile.insecure\n\n# Problemas:\n# 1. ubuntu:latest (base grande, :latest)\n# 2. ADD ao inves de COPY\n# 3. Ferramentas desnecessarias (vim, netcat)\n# 4. Roda como root (sem USER)\n# 5. Secret no ENV\n# 6. Nao limpa apt cache\n```',
        verify: '```bash\n# Verificar que o arquivo foi criado\ncat /tmp/Dockerfile.insecure\n# Saida esperada: Dockerfile com os problemas listados\n```'
      },
      {
        title: 'Reescrever com Boas Praticas',
        instruction: 'Reescreva o Dockerfile usando multi-stage build, base image minima, non-root user e sem secrets.',
        hints: [
          'Use multi-stage: primeiro stage para build, segundo para runtime',
          'Use python:alpine ou distroless como base final',
          'Adicione USER e remova secrets do ENV'
        ],
        solution: '```bash\ncat > /tmp/Dockerfile.secure <<\'EOF\'\n# Stage 1: Build\nFROM python:3.12-slim AS builder\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install --no-cache-dir --user -r requirements.txt\nCOPY . .\n\n# Stage 2: Runtime\nFROM python:3.12-alpine\nRUN adduser -D -u 10001 appuser\nWORKDIR /app\nCOPY --from=builder --chown=10001:10001 /root/.local /home/appuser/.local\nCOPY --from=builder --chown=10001:10001 /app .\nENV PATH=/home/appuser/.local/bin:$PATH\nUSER 10001\nCMD [\"python3\", \"app.py\"]\nEOF\n\necho \"Dockerfile seguro criado\"\n```',
        verify: '```bash\n# Verificar melhorias\ngrep -c \"USER\" /tmp/Dockerfile.secure\n# Saida esperada: 1 (tem USER)\n\ngrep \"latest\" /tmp/Dockerfile.secure\n# Saida esperada: nenhuma linha (sem :latest)\n\ngrep \"ADD\" /tmp/Dockerfile.secure\n# Saida esperada: nenhuma linha (usa COPY)\n```'
      },
      {
        title: 'Deploy com Security Context',
        instruction: 'Crie um Pod no Kubernetes com securityContext adequado para a imagem hardened.',
        hints: [
          'Use runAsNonRoot, readOnlyRootFilesystem',
          'Drop ALL capabilities',
          'Use emptyDir para /tmp'
        ],
        solution: '```bash\nkubectl apply -f - <<EOF\napiVersion: v1\nkind: Pod\nmetadata:\n  name: hardened-app\nspec:\n  securityContext:\n    runAsNonRoot: true\n    runAsUser: 10001\n    fsGroup: 10001\n  containers:\n  - name: app\n    image: nginx:1.25-alpine\n    securityContext:\n      allowPrivilegeEscalation: false\n      readOnlyRootFilesystem: true\n      capabilities:\n        drop: [\"ALL\"]\n    volumeMounts:\n    - name: tmp\n      mountPath: /tmp\n    - name: cache\n      mountPath: /var/cache/nginx\n    - name: run\n      mountPath: /var/run\n  volumes:\n  - name: tmp\n    emptyDir: {}\n  - name: cache\n    emptyDir: {}\n  - name: run\n    emptyDir: {}\nEOF\n```',
        verify: '```bash\nkubectl get pod hardened-app\n# Saida esperada: Running\n\n# Verificar security context\nkubectl get pod hardened-app -o jsonpath=\"{.spec.containers[0].securityContext}\"\n# Saida esperada: inclui readOnlyRootFilesystem:true, allowPrivilegeEscalation:false\n\n# Verificar que roda como non-root\nkubectl exec hardened-app -- id\n# Saida esperada: uid != 0\n```'
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Container com Read-Only Filesystem Falha ao Iniciar',
      difficulty: 'easy',
      symptom: 'Pod com readOnlyRootFilesystem: true falha com erros de permissao ao tentar escrever em /tmp ou /var.',
      diagnosis: '```bash\nkubectl logs <pod-name>\n# Procurar por: Read-only file system, Permission denied\n\nkubectl describe pod <pod-name> | grep -A 5 readOnly\n```',
      solution: 'Montar emptyDir volumes nos diretorios que precisam de escrita: /tmp, /var/cache, /var/run, /var/log. Exemplo: volumes: [{name: tmp, emptyDir: {}}] com volumeMounts: [{name: tmp, mountPath: /tmp}].'
    },
    {
      title: 'Imagem Non-Root Falha com Permission Denied em Portas Baixas',
      difficulty: 'medium',
      symptom: 'Container rodando como non-root nao consegue bind na porta 80 ou 443.',
      diagnosis: '```bash\nkubectl logs <pod-name>\n# Erro: bind() to 0.0.0.0:80 failed (Permission denied)\n\n# Verificar usuario\nkubectl exec <pod-name> -- id\n# Saida: uid=10001 (non-root)\n```',
      solution: 'Portas abaixo de 1024 requerem root ou capability NET_BIND_SERVICE. Solucoes: 1) Usar porta alta (8080, 8443) e mapear via Service. 2) Adicionar capability: capabilities: {add: [\"NET_BIND_SERVICE\"]}. 3) Para nginx: configurar listen 8080 ao inves de listen 80.'
    }
  ]
};
