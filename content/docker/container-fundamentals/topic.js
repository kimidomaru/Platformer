window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['docker/container-fundamentals'] = {
  theory: `
# Fundamentos de Containers e Docker

## Relevancia
Containers sao a unidade basica de deploy em Kubernetes. Antes de orquestrar com K8s, e essencial entender como containers funcionam: namespaces, cgroups, layers, build otimizado, e seguranca basica. Este topico cobre o que um DevOps/SRE precisa saber alem do "docker run".

## Como Containers Funcionam (por baixo)

### Namespaces e cgroups

Containers NAO sao VMs. Sao processos isolados usando primitivas do kernel Linux:

\`\`\`
Namespaces (isolamento de recursos):
├── PID     → processos isolados (PID 1 no container)
├── Network → interface de rede propria (eth0)
├── Mount   → filesystem isolado
├── UTS     → hostname proprio
├── IPC     → comunicacao inter-processo isolada
└── User    → mapeamento de UIDs (user namespaces)

cgroups (controle de recursos):
├── cpu     → limite de CPU
├── memory  → limite de memoria
├── blkio   → limite de I/O de disco
└── net_cls → classificacao de pacotes de rede
\`\`\`

**Implicacao pratica:** um container mal configurado pode consumir toda a CPU/memoria do host se nao tiver resource limits — mesmo no Kubernetes.

### Docker Image: layers e Union Filesystem

\`\`\`
Imagem = stack de layers (cada instrucao no Dockerfile = 1 layer)

Layer 1: FROM ubuntu:22.04      [read-only]
Layer 2: RUN apt-get install    [read-only]
Layer 3: COPY app/ /app/        [read-only]
Layer 4: CMD ["node", "app.js"] [read-only]
         ↓
Quando roda: Container Layer     [read-write] ← unico layer mutavel
\`\`\`

**Por que importa:**
- Layers sao cacheados — builds rapidos se a ordem for correta
- Layers READ-ONLY sao compartilhados entre containers
- So o container layer e gravavel — e efemero (desaparece com \`docker stop\`)

## Dockerfile: Boas Praticas

### Ordem das instrucoes (cache eficiente)

\`\`\`dockerfile
# ERRADO: invalida o cache ao mudar qualquer arquivo da app
FROM node:18-alpine
WORKDIR /app
COPY . .                       # copia TUDO — invalida cache sempre
RUN npm install
CMD ["node", "server.js"]

# CORRETO: dependencias separadas do codigo
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./          # so package.json muda raramente
RUN npm ci --only=production   # cache reutilizado se package.json nao mudou
COPY src/ ./src/               # codigo muda frequentemente — ultimo
CMD ["node", "src/server.js"]
\`\`\`

### Multi-stage build — imagem menor e mais segura

\`\`\`dockerfile
# Stage 1: BUILD (com ferramentas de compilacao)
FROM golang:1.21 AS builder
WORKDIR /app
COPY go.* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/server ./cmd/server

# Stage 2: RUNTIME (sem ferramentas de build)
FROM gcr.io/distroless/static-debian12
COPY --from=builder /app/server /server
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/server"]
\`\`\`

**Resultado:** imagem final de ~10MB ao inves de ~800MB com a imagem de build completa.

### Dockerfile para aplicacoes Python (DevOps tools)

\`\`\`dockerfile
FROM python:3.11-slim AS base
WORKDIR /app

# Dependencias primeiro (cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Codigo depois
COPY src/ ./src/

# Usuario nao-root (seguranca)
RUN useradd --create-home --shell /bin/bash appuser
USER appuser

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

CMD ["python", "src/main.py"]
\`\`\`

## Comandos Essenciais

### Build e gerenciamento de imagens

\`\`\`bash
# Build com tag
docker build -t myapp:v1.0.0 .
docker build -t myapp:v1.0.0 -f Dockerfile.prod .  # Dockerfile especifico

# Build com build args
docker build --build-arg VERSION=1.0.0 --build-arg ENV=prod -t myapp:1.0.0 .

# Inspecionar imagem (layers, tamanho)
docker image inspect myapp:v1.0.0
docker history myapp:v1.0.0  # ver layers e tamanhos

# Listar e limpar
docker images -a
docker image prune -a  # remove imagens nao usadas (CUIDADO em producao)
\`\`\`

### Run e inspecao de containers

\`\`\`bash
# Run basico
docker run -d --name myapp -p 8080:8080 myapp:v1.0.0

# Com variaveis de ambiente e volume
docker run -d \
  --name myapp \
  -p 8080:8080 \
  -e DATABASE_URL=postgres://... \
  -v /host/data:/app/data \
  --memory="512m" \
  --cpus="1.0" \
  myapp:v1.0.0

# Exec no container em execucao
docker exec -it myapp bash
docker exec myapp ps aux
docker exec myapp env | grep DATABASE

# Logs e stats
docker logs myapp --tail 100 --follow
docker stats myapp  # uso de CPU, memoria, rede em tempo real
\`\`\`

### Registry operations

\`\`\`bash
# Push para registry
docker tag myapp:v1.0.0 myregistry.azurecr.io/myapp:v1.0.0
docker push myregistry.azurecr.io/myapp:v1.0.0

# Pull especifico
docker pull myregistry.azurecr.io/myapp:v1.0.0@sha256:abc123...

# Login em registry privado
docker login myregistry.azurecr.io
docker login -u user -p token ghcr.io
\`\`\`

## Seguranca de Containers

### Praticas essenciais

\`\`\`dockerfile
# 1. Usar imagens base oficiais e slim
FROM node:18-alpine   # nao FROM ubuntu + instalar node manualmente
FROM python:3.11-slim

# 2. Nunca rodar como root
RUN addgroup -g 1001 appgroup && adduser -u 1001 -G appgroup appuser
USER appuser

# 3. Copiar apenas o necessario (evitar segredos no contexto)
COPY src/ /app/src/
# NAO: COPY . .  (pode incluir .env, secrets)

# 4. Criar .dockerignore
# .dockerignore:
# .git
# .env
# *.md
# node_modules/
# __pycache__/
\`\`\`

\`\`\`bash
# Escanear vulnerabilidades
docker scout cves myapp:v1.0.0          # Docker Scout (nativo)
trivy image myapp:v1.0.0                # Trivy (open source)
grype myapp:v1.0.0                      # Grype (Anchore)

# Verificar se esta rodando como root
docker inspect myapp | jq '.[].Config.User'
# Esperado: "1001" ou "appuser", nao "" (root)
\`\`\`

### Seccomp e AppArmor (avancado)

\`\`\`bash
# Docker aplica seccomp por default (restringe syscalls perigosas)
# Verificar perfil aplicado:
docker inspect myapp | jq '.[].HostConfig.SecurityOpt'

# Rodar com perfil customizado
docker run --security-opt seccomp=/path/to/profile.json myapp:v1.0.0

# Para Kubernetes: usa SecurityContext + PodSecurityPolicy/PSA
\`\`\`

## Erros Comuns

1. **Imagem muito grande** — nao usar multi-stage, copiar node_modules, nao usar .dockerignore
2. **Rodar como root** — container sem USER instruction = root = risco de seguranca
3. **Secrets no Dockerfile** — ENV com senhas, COPY de .env files
4. **Cache ineficiente** — COPY . . antes do RUN npm install = rebuild sempre
5. **Sem HEALTHCHECK** — container sobe mas nao esta funcional

## Killer.sh Style Challenge

> **Cenario:** Voce recebe um Dockerfile de uma aplicacao Go que gera imagem de 1.2GB e demora 8 minutos para buildar. Reescreva-o usando multi-stage build, otimizacao de cache e usuario nao-root. A imagem final deve ser menor que 20MB e o rebuild (so o codigo mudou) deve levar menos de 30 segundos.
`,
  quiz: [
    {
      question: 'Por que a ordem das instrucoes no Dockerfile afeta drasticamente o tempo de build?',
      options: [
        'O Docker executa instrucoes em paralelo, entao a ordem nao importa',
        'Cada instrucao gera um layer; quando um layer muda, todos os layers subsequentes sao invalidados no cache — colocar instrucoes que mudam frequentemente no final maximiza o reuso do cache',
        'Instrucoes no inicio do Dockerfile sao executadas mais rapido',
        'A ordem afeta apenas o tamanho final da imagem, nao o tempo de build'
      ],
      correct: 1,
      explanation: 'O mecanismo de cache do Docker funciona por layers: quando um layer muda (ou quando o Docker detecta que ele pode ter mudado), todos os layers subsequentes sao reconstruidos. Por isso, colocar COPY package*.json e RUN npm install ANTES de COPY src/ garante que a instalacao de dependencias seja cacheada — e so e reexecutada quando package.json muda, nao quando o codigo muda.',
      reference: 'Regra pratica: "o que muda menos frequentemente, mais cedo no Dockerfile; o que muda mais frequentemente, mais tarde".'
    },
    {
      question: 'O que e um multi-stage build e qual e o principal beneficio para producao?',
      options: [
        'E um Dockerfile que usa varios FROM em sequencia para compilar o codigo em um stage e copiar apenas o binario final para uma imagem minimal — resultando em imagens menores sem ferramentas de build',
        'E a pratica de buildar em varios registries simultaneamente',
        'Multi-stage build e necessario apenas para linguagens compiladas como Go e C++',
        'E uma feature que reduz o numero de layers na imagem final'
      ],
      correct: 0,
      explanation: 'Multi-stage build usa multiplos blocos FROM no Dockerfile. O stage de build contem as ferramentas de compilacao (compiladores, SDKs). O stage final copia apenas os artefatos necessarios (binario compilado, assets estaticos). O resultado: a imagem final nao contem o compilador, SDK, ou qualquer ferramenta de desenvolvimento — reduzindo drasticamente o tamanho (de ~800MB para ~10MB para apps Go) e a superficie de ataque.',
      reference: 'Dica: `FROM gcr.io/distroless/static-debian12` e `FROM scratch` sao as bases mais minimas para o stage final — para binarios estaticos.'
    },
    {
      question: 'Qual e a diferenca entre containers e VMs no nivel do kernel?',
      options: [
        'Containers tem kernel proprio, VMs compartilham o kernel do host',
        'Containers sao processos isolados usando namespaces Linux (isolamento) e cgroups (recursos); VMs emulam hardware completo com kernel proprio — containers compartilham o kernel do host',
        'Containers e VMs sao equivalentes em seguranca e isolamento',
        'VMs usam namespaces, containers usam hypervisor'
      ],
      correct: 1,
      explanation: 'Containers sao processos do host isolados via namespaces (PID, network, mount, UTS, IPC) e com recursos controlados por cgroups. Compartilham o kernel do host — isso e mais leve mas implica: um exploit de kernel afeta todos os containers. VMs tem kernel proprio isolado via hypervisor (KVM, VMware) — isolamento mais forte mas overhead maior.',
      reference: 'Implicacao de seguranca: para workloads muito sensiveis, containers em VMs separadas (cada VM com seus containers) oferece isolamento em camadas.'
    },
    {
      question: 'Por que rodar containers como root e um risco de seguranca, mesmo em desenvolvimento?',
      options: [
        'Containers root sao mais lentos',
        'Se um atacante comprometer o processo no container que roda como root, pode potencialmente escapar do container para o host, especialmente com configuracoes incorretas de bind mounts ou privilegios adicionais',
        'Root dentro do container nao tem impacto fora dele — o isolamento e completo',
        'Rodar como root aumenta o consumo de memoria'
      ],
      correct: 1,
      explanation: 'Root dentro do container tem UID 0 — o mesmo UID 0 do host. Com configuracoes incorretas (bind mounts de /etc, privileged mode, capabilities extras), o root do container pode escrever arquivos do host como root ou escapar completamente. User namespaces mitigam isso (mapeiam UID 0 do container para um UID alto no host), mas a pratica padrao e sempre criar um usuario nao-root no Dockerfile.',
      reference: 'Pratica: `RUN useradd -u 1001 appuser && USER appuser` — sempre incluir no Dockerfile. Em Kubernetes: SecurityContext.runAsNonRoot: true.'
    },
    {
      question: 'O que e o ".dockerignore" e por que e importante para builds e seguranca?',
      options: [
        'E equivalente ao .gitignore — nao tem impacto em seguranca',
        'Define quais arquivos NAO sao enviados para o Docker daemon no build context — evita incluir .env, .git, senhas e arquivos grandes que aumentam o tempo de build e podem vazar em imagens',
        'E necessario apenas para imagens que serao publicadas em registries publicos',
        'O .dockerignore e lido pelo container em runtime, nao durante o build'
      ],
      correct: 1,
      explanation: 'Quando voce executa `docker build`, o Docker daemon recebe o "build context" — o diretorio inteiro (ou especificado). O .dockerignore exclui arquivos desse context. Sem ele: o diretorio .git pode ser incluido (exposicao de historico), .env com senhas pode ser COPY-ado acidentalmente, e node_modules de 500MB e enviado desnecessariamente aumentando o tempo de build.',
      reference: 'Template de .dockerignore minimo: .git, .env, *.md, node_modules/, __pycache__/, .pytest_cache/, *.test.js'
    },
    {
      question: 'Qual a diferenca pratica entre `docker run -v /host/path:/container/path` (bind mount) e um Docker Volume?',
      options: [
        'Bind mounts sao mais rapidos, volumes sao mais seguros',
        'Bind mount mapeia um diretorio especifico do host (voce controla onde); Docker Volume e gerenciado pelo Docker daemon em /var/lib/docker/volumes — volumes sao preferidos para dados de producao e sao mais portaveis',
        'Volumes so funcionam com docker-compose, bind mounts com docker run',
        'Nao ha diferenca pratica — sao aliases para a mesma feature'
      ],
      correct: 1,
      explanation: 'Bind mounts dependem de um path especifico do host — problematico em diferentes ambientes (dev vs prod) e potencialmente perigoso se o container puder escrever em paths sensiveis do host. Docker Volumes sao gerenciados pelo Docker (isolados, portaveis, com drivers para diferentes backends como NFS ou cloud storage). Para dados de aplicacao em producao, use volumes. Para dev (hot reload de codigo), bind mounts sao convenientes.',
      reference: 'Em Kubernetes: equivalentes sao hostPath (bind mount) e PersistentVolumes. hostPath e geralmente evitado em producao pelos mesmos motivos.'
    },
    {
      question: 'Como o `HEALTHCHECK` no Dockerfile melhora a operacao em producao e no Kubernetes?',
      options: [
        'O HEALTHCHECK substitui o liveness probe do Kubernetes',
        'O HEALTHCHECK define como verificar se o container esta saudavel; no Docker Compose e Swarm, containers unhealthy sao reiniciados; no Kubernetes, liveness/readiness probes sao usados em vez disso — mas HEALTHCHECK e bom para testes locais',
        'HEALTHCHECK e obrigatorio para o container iniciar',
        'HEALTHCHECK so funciona com aplicacoes HTTP'
      ],
      correct: 1,
      explanation: 'HEALTHCHECK instrui o Docker a executar um comando periodicamente para verificar a saude do container. Em Docker puro e Compose, isso determina quando restartar o container. No Kubernetes, os liveness e readiness probes no manifest substituem o HEALTHCHECK do Dockerfile — mas manter o HEALTHCHECK e boa pratica para testes locais e compatibilidade com outros orchestrators.',
      reference: 'Nota importante: o Kubernetes IGNORA o HEALTHCHECK do Dockerfile e usa apenas liveness/readiness probes definidos no PodSpec.'
    }
  ],
  flashcards: [
    {
      front: 'Namespaces vs cgroups — o que faz cada um',
      back: '**Namespaces = isolamento (o que o processo ve):**\n- PID: processos proprios (PID 1 isolado)\n- Network: interface de rede isolada\n- Mount: filesystem isolado\n- UTS: hostname proprio\n- IPC: comunicacao inter-processo\n- User: mapeamento de UIDs\n\n**cgroups = controle de recursos (quanto pode usar):**\n- cpu: limite de CPU\n- memory: limite de memoria\n- blkio: limite de I/O\n\n**Diferenca com VMs:**\n- Container: processo isolado, compartilha kernel\n- VM: kernel proprio, hypervisor completo\n\n**Consequencia pratica:**\n- Sem cgroups limits → container pode consumir\n  toda CPU/RAM do host\n- Sempre configurar resources.limits no K8s!'
    },
    {
      front: 'Otimizacao de cache no Dockerfile',
      back: '**Regra:** "muda menos → mais cedo; muda mais → mais tarde"\n\n**ERRADO (invalida cache sempre):**\n\`\`\`dockerfile\nCOPY . .\nRUN npm install\n\`\`\`\n\n**CORRETO (cache de dependencias):**\n\`\`\`dockerfile\nCOPY package*.json ./\nRUN npm ci --only=production\nCOPY src/ ./src/\n\`\`\`\n\n**Ordem recomendada:**\n1. FROM (base image)\n2. Instalacao de dependencias do OS\n3. COPY de arquivos de dependencias\n4. Instalacao de dependencias da app\n5. COPY do codigo fonte\n6. USER, EXPOSE, HEALTHCHECK, CMD\n\n**Quando o cache e invalidado:**\nQualquer mudanca em um layer invalida\ntodos os layers ABAIXO dele.'
    },
    {
      front: 'Multi-stage build — padrao para producao',
      back: '**Template para Go:**\n\`\`\`dockerfile\n# Stage 1: BUILD\nFROM golang:1.21 AS builder\nWORKDIR /app\nCOPY go.* ./\nRUN go mod download\nCOPY . .\nRUN CGO_ENABLED=0 go build -o /app/server .\n\n# Stage 2: RUNTIME (minimal)\nFROM gcr.io/distroless/static-debian12\nCOPY --from=builder /app/server /server\nUSER nonroot:nonroot\nENTRYPOINT ["/server"]\n\`\`\`\n\n**Resultado:** ~1GB builder → ~10MB final\n\n**Templates de base para runtime:**\n- `scratch` → binarios estaticos, 0 bytes\n- `distroless/static` → sem shell, ~2MB\n- `distroless/base` → com libc, ~20MB\n- `alpine` → com shell, ~5MB\n- `slim` variants → OS com menos pacotes\n\n**Beneficio de seguranca:**\nSem compilador, sem shell, menos\nvulnerabilidades na superficie de ataque.'
    },
    {
      front: 'Seguranca basica de containers — checklist',
      back: '**Dockerfile:**\n```\n[ ] Imagem base oficial e slim (alpine/slim)\n[ ] Usuario nao-root (USER instruction)\n[ ] .dockerignore presente\n[ ] HEALTHCHECK configurado\n[ ] Sem senhas/tokens hardcoded\n[ ] Multi-stage se necessario\n```\n\n**Runtime (docker run / K8s):**\n```\n[ ] --memory e --cpus definidos\n[ ] Nao usar --privileged\n[ ] Nao montar /etc ou /var/run/docker.sock\n[ ] Nao usar --net=host sem necessidade\n```\n\n**Scan de vulnerabilidades:**\n```bash\ntrivy image myapp:v1.0.0\ndocker scout cves myapp:v1.0.0\n```\n\n**Verificar usuario:**\n```bash\ndocker inspect myapp |\n  jq \'.[].Config.User\'\n# Esperado: "1001" ou "appuser"\n# Nao: "" (root)\n```'
    },
    {
      front: 'Docker Layer System — como funciona',
      back: '**Estrutura:**\n```\nFROM ubuntu:22.04    → Layer 1 [read-only]\nRUN apt-get update  → Layer 2 [read-only]\nCOPY app/ /app/     → Layer 3 [read-only]\nCMD ["./app"]       → Layer 4 [read-only]\n                      ↓\nContainer Runtime → Layer R/W (efemero)\n```\n\n**Compartilhamento de layers:**\n- Layers R/O sao compartilhados entre containers\n- 10 containers com mesma imagem = 10x Container Layer\n  mas apenas 1x os layers da imagem\n\n**Consequencias praticas:**\n- Dados escritos no container layer sao\n  PERDIDOS quando o container para\n- Use volumes para dados persistentes\n- Imagens maiores = mais dados em layers R/O\n- docker history mostra tamanho de cada layer\n\n**Cache hit = layer reutilizado do disco**\n**Cache miss = layer reconstruido**'
    },
    {
      front: 'Comandos essenciais de debug de containers',
      back: '**Logs:**\n```bash\ndocker logs <container> -f --tail 100\ndocker logs <container> --since 1h\n```\n\n**Exec (entrar no container):**\n```bash\ndocker exec -it <container> sh  # alpine\ndocker exec -it <container> bash  # ubuntu/debian\ndocker exec <container> env | grep API\n```\n\n**Inspecao:**\n```bash\ndocker inspect <container>  # config completa\ndocker stats <container>    # CPU, RAM, rede em tempo real\ndocker top <container>      # processos dentro\n```\n\n**Copia de arquivos:**\n```bash\ndocker cp <container>:/app/log.txt ./log.txt\ndocker cp ./config.yaml <container>:/app/config.yaml\n```\n\n**Limpar tudo (dev only!):**\n```bash\ndocker system prune -a --volumes\n# Remove: containers parados, imagens nao usadas,\n# volumes orfaos, networks nao usadas\n```'
    }
  ],
  lab: {
    scenario: 'Voce recebeu um repositorio com uma aplicacao Python Flask que tem um Dockerfile incorreto (imagem grande, root, sem .dockerignore). Vai otimizar o Dockerfile, adicionar seguranca, e garantir que a imagem final seja adequada para producao.',
    objective: 'Otimizar um Dockerfile real: multi-stage, usuario nao-root, cache eficiente, .dockerignore, HEALTHCHECK, e validar com trivy.',
    duration: '25-35 minutos',
    steps: [
      {
        title: 'Analisar o Dockerfile atual e identificar problemas',
        instruction: `Crie um Dockerfile de exemplo com problemas tipicos e analise-os usando comandos Docker.`,
        hints: [
          'Use `docker history` para ver o tamanho de cada layer',
          'Use `docker inspect` para ver se o container roda como root',
          'Analise a ordem das instrucoes para identificar ineficiencias de cache'
        ],
        solution: `\`\`\`bash
# Criar o projeto de exemplo com problemas
mkdir flask-app && cd flask-app

cat > requirements.txt << 'EOF'
flask==3.0.0
gunicorn==21.2.0
requests==2.31.0
EOF

cat > app.py << 'EOF'
from flask import Flask, jsonify
app = Flask(__name__)

@app.route('/health')
def health():
    return jsonify({"status": "ok"})

@app.route('/')
def index():
    return jsonify({"message": "Hello from Flask!"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
EOF

# Dockerfile RUIM (para analise)
cat > Dockerfile.bad << 'EOF'
FROM python:3.11
WORKDIR /app
COPY . .
RUN pip install -r requirements.txt
EXPOSE 5000
CMD ["python", "app.py"]
EOF

# Buildar e analisar
docker build -t flask-bad:v1 -f Dockerfile.bad .
docker history flask-bad:v1

# Verificar tamanho
docker images flask-bad:v1

# Verificar usuario (deve ser root - problema!)
docker run -d --name flask-test flask-bad:v1
docker exec flask-test whoami  # deve mostrar "root"
docker inspect flask-test | grep '"User"'
docker stop flask-test && docker rm flask-test
\`\`\``,
        verify: `\`\`\`bash
# Verificar que o Dockerfile ruim foi criado
ls Dockerfile.bad app.py requirements.txt

# Verificar que a imagem foi buildada
docker images flask-bad:v1
# Saida esperada: imagem com ~1GB ou mais

# Verificar usuario root
docker run --rm flask-bad:v1 whoami
# Saida esperada: root (problema identificado)
\`\`\``
      },
      {
        title: 'Criar .dockerignore e Dockerfile otimizado',
        instruction: `Crie um .dockerignore adequado e um Dockerfile otimizado com: cache eficiente, usuario nao-root, HEALTHCHECK, e imagem slim.`,
        hints: [
          'Copie requirements.txt ANTES de COPY . . para cachear a instalacao',
          'Use python:3.11-slim ao inves de python:3.11',
          'Crie um usuario com UID especifico para reproducibilidade'
        ],
        solution: `\`\`\`bash
# Criar .dockerignore
cat > .dockerignore << 'EOF'
.git
.gitignore
*.md
.env
.env.*
__pycache__/
*.pyc
*.pyo
.pytest_cache/
.coverage
Dockerfile*
docker-compose*
*.log
.DS_Store
EOF

# Dockerfile OTIMIZADO
cat > Dockerfile << 'EOF'
FROM python:3.11-slim AS base

# Metadados
LABEL maintainer="platform-team" \
      version="1.0.0" \
      description="Flask API"

WORKDIR /app

# Dependencias primeiro (cache eficiente)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Criar usuario nao-root
RUN useradd --create-home --uid 1001 --shell /bin/bash appuser

# Codigo depois (muda frequentemente)
COPY app.py .

# Permissoes corretas
RUN chown -R appuser:appuser /app

# Nao rodar como root
USER appuser

# Porta exposta (documentacao)
EXPOSE 5000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/health')" || exit 1

# Producao: usar gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "app:app"]
EOF

# Buildar a versao otimizada
docker build -t flask-good:v1 .

# Comparar tamanhos
docker images | grep flask
\`\`\``,
        verify: `\`\`\`bash
# Verificar que a imagem foi buildada
docker images flask-good:v1
# Saida esperada: ~200MB (slim) vs ~1GB (bad)

# Verificar usuario correto
docker run --rm flask-good:v1 whoami
# Saida esperada: appuser (nao root!)

# Verificar que .dockerignore foi criado
ls .dockerignore

# Verificar layers
docker history flask-good:v1 --no-trunc | head -10
\`\`\``
      },
      {
        title: 'Testar cache e eficiencia do build',
        instruction: `Verificar que o cache funciona corretamente: modificar apenas o codigo da app e confirmar que as dependencias nao sao reinstaladas.`,
        hints: [
          'Modifique apenas app.py (nao requirements.txt)',
          'O rebuild deve usar cache para a instalacao do pip',
          'Compare o tempo do primeiro build com o rebuild'
        ],
        solution: `\`\`\`bash
# Simular mudanca no codigo (nao nas dependencias)
cat >> app.py << 'EOF'

@app.route('/version')
def version():
    return jsonify({"version": "1.0.1"})
EOF

# Rebuild — deve usar cache para dependencias
time docker build -t flask-good:v1.0.1 .
# Observe: "CACHED" nas linhas de pip install

# Comparar: se mudarmos requirements.txt, cache e invalidado
echo "boto3==1.34.0" >> requirements.txt
time docker build -t flask-good:v1.0.2 .
# Agora pip install roda novamente (cache invalidado)

# Restaurar
sed -i '/boto3/d' requirements.txt

# Rodar e testar a aplicacao
docker run -d --name flask-prod \
  -p 5000:5000 \
  --memory="256m" \
  --cpus="0.5" \
  flask-good:v1.0.1

# Aguardar healthcheck
sleep 5
docker ps  # STATUS deve ser "healthy" ou "starting"

# Testar endpoints
curl http://localhost:5000/health
curl http://localhost:5000/

# Cleanup
docker stop flask-prod && docker rm flask-prod
\`\`\``,
        verify: `\`\`\`bash
# Verificar que o container esta rodando
docker run -d --name verify-flask -p 5001:5000 flask-good:v1.0.1
sleep 3

# Testar health endpoint
curl -sf http://localhost:5001/health
# Saida esperada: {"status":"ok"}

# Verificar que nao roda como root
docker exec verify-flask whoami
# Saida esperada: appuser

# Verificar resource limits
docker inspect verify-flask | grep -A 3 '"Memory"'
# (demonstracao — limits sao do run, nao do Dockerfile)

# Cleanup
docker stop verify-flask && docker rm verify-flask
echo "Verificacao concluida com sucesso!"
\`\`\``
      },
      {
        title: 'Escanear vulnerabilidades com Trivy',
        instruction: `Instale o Trivy e escaneie ambas as imagens (boa e ruim) para comparar a superficie de ataque.`,
        hints: [
          'Trivy pode ser instalado com curl ou via package manager',
          'Compare o numero de CVEs HIGH/CRITICAL entre as imagens',
          'Imagens slim/alpine tem menos vulnerabilidades'
        ],
        solution: `\`\`\`bash
# Instalar Trivy (Linux/Mac)
curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin

# OU via homebrew no Mac:
# brew install trivy

# Escanear a imagem ruim (python:3.11 full)
trivy image --severity HIGH,CRITICAL flask-bad:v1

# Escanear a imagem boa (python:3.11-slim)
trivy image --severity HIGH,CRITICAL flask-good:v1

# Comparar numero de vulnerabilidades
echo "=== Comparacao ==="
echo "Imagem BAD (total):"
trivy image --severity HIGH,CRITICAL --quiet flask-bad:v1 2>&1 | grep "Total:"

echo "Imagem GOOD (total):"
trivy image --severity HIGH,CRITICAL --quiet flask-good:v1 2>&1 | grep "Total:"
\`\`\``,
        verify: `\`\`\`bash
# Verificar que o trivy esta instalado
trivy --version
# Saida esperada: Version: X.X.X

# Verificar a imagem boa tem menos vulnerabilidades
trivy image --severity CRITICAL --quiet flask-good:v1 2>&1 | tail -5
# Saida esperada: significativamente menos CVEs que a imagem bad

# Cleanup final
docker rmi flask-bad:v1 flask-good:v1 flask-good:v1.0.1 flask-good:v1.0.2 2>/dev/null || true
echo "Lab completo!"
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Build falha com "Cannot connect to the Docker daemon"',
      difficulty: 'easy',
      symptom: 'Ao executar `docker build` ou `docker run`, o erro "Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?" aparece.',
      diagnosis: `\`\`\`bash
# 1. Verificar se o Docker daemon esta rodando
systemctl status docker
# ou
service docker status

# 2. Verificar se o socket existe
ls -la /var/run/docker.sock

# 3. Verificar permissoes do usuario
groups \$USER
# O usuario precisa estar no grupo 'docker'

# 4. Em Mac/Windows, verificar se o Docker Desktop esta aberto
docker info 2>&1 | head -5
\`\`\``,
      solution: `**Solucao 1 — Iniciar o Docker daemon:**
\`\`\`bash
sudo systemctl start docker
sudo systemctl enable docker  # iniciar automaticamente
\`\`\`

**Solucao 2 — Adicionar usuario ao grupo docker (Linux):**
\`\`\`bash
sudo usermod -aG docker \$USER
# Necessario fazer logout e login para efetivar
# OU:
newgrp docker  # aplicar sem logout
\`\`\`

**Solucao 3 — Mac/Windows:**
Abrir o Docker Desktop e aguardar inicializar (icon na barra de sistema).

**Verificar:**
\`\`\`bash
docker info  # deve mostrar informacoes do daemon
docker ps    # deve listar containers (vazio e OK)
\`\`\``
    },
    {
      title: 'Container inicia mas para imediatamente (exit code != 0)',
      difficulty: 'medium',
      symptom: 'Ao fazer `docker run myapp`, o container aparece brevemente em `docker ps -a` com status "Exited (1)" ou outro exit code nao-zero. `docker logs myapp` mostra erro.',
      diagnosis: `\`\`\`bash
# 1. Ver o exit code e logs
docker ps -a --filter name=myapp
docker logs myapp  # Ver a mensagem de erro

# 2. Rodar de forma interativa para debug
docker run --rm -it myapp sh
# Tentar executar o CMD manualmente dentro do container

# 3. Verificar o CMD/ENTRYPOINT
docker inspect myapp | jq '.[].Config.Cmd'
docker inspect myapp | jq '.[].Config.Entrypoint'

# 4. Verificar se os arquivos necessarios existem
docker run --rm -it myapp ls /app/
\`\`\``,
      solution: `**Causa comum 1 — Arquivo nao encontrado:**
\`\`\`bash
# Verificar se o COPY copiou os arquivos corretos
docker run --rm -it myapp find /app -type f
# Se faltam arquivos, revisar o Dockerfile e .dockerignore
\`\`\`

**Causa comum 2 — Permissao negada:**
\`\`\`bash
# Erro tipico: "Permission denied: /app/start.sh"
# Solucao no Dockerfile:
RUN chmod +x /app/start.sh
# OU garantir que o arquivo veio do repositorio com permissao de execucao
\`\`\`

**Causa comum 3 — Variavel de ambiente necessaria:**
\`\`\`bash
# Checar quais variaveis a app precisa
docker run --rm -e DATABASE_URL=postgres://... myapp
# OU inspecionar o entrypoint da imagem
\`\`\`

**Causa comum 4 — CMD em formato errado:**
\`\`\`dockerfile
# ERRADO: CMD com shell que nao existe no container
CMD python app.py  # usa /bin/sh -c
# CORRETO: exec form (sem shell)
CMD ["python", "app.py"]
\`\`\``
    }
  ]
};
