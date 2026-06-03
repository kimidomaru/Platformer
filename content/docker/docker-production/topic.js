window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['docker/docker-production'] = {
  theory: `
# Docker em Producao

## Relevancia
Executar Docker em producao e muito diferente de desenvolvimento. Registries, versioning semantico, builds multi-arquitetura, resource limits, logging, e seguranca de imagens sao habilidades criticas para SREs e DevOps. Este topico cobre o que vai entre o "docker build" local e o deploy em producao real.

## Registries e Versionamento

### Estrategia de tags

\`\`\`bash
# Padrao recomendado: SemVer + git commit
docker build -t myapp:1.2.3 .                    # release
docker build -t myapp:1.2.3-beta.1 .             # pre-release
docker build -t myapp:1.2.3-abc1234 .            # commit hash

# Nunca usar "latest" em producao como unica tag
# latest nao e imutavel — aponta para o ultimo push
# Em CI/CD: taguear com commit SHA + versao

# Multi-tag no mesmo build
COMMIT_SHA=$(git rev-parse --short HEAD)
VERSION=$(git describe --tags --abbrev=0)

docker build -t myapp:\${VERSION} \
             -t myapp:\${COMMIT_SHA} \
             -t myapp:latest .
\`\`\`

### Registries comuns

\`\`\`bash
# Docker Hub
docker login
docker push myorg/myapp:v1.2.3

# GitHub Container Registry (GHCR)
echo \$GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
docker tag myapp:v1.2.3 ghcr.io/myorg/myapp:v1.2.3
docker push ghcr.io/myorg/myapp:v1.2.3

# AWS ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  123456789.dkr.ecr.us-east-1.amazonaws.com

# Azure ACR
az acr login --name myregistry
docker tag myapp:v1.2.3 myregistry.azurecr.io/myapp:v1.2.3
docker push myregistry.azurecr.io/myapp:v1.2.3
\`\`\`

### Image signing com Cosign (supply chain security)

\`\`\`bash
# Instalar cosign
curl -O https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-amd64
chmod +x cosign-linux-amd64 && mv cosign-linux-amd64 /usr/local/bin/cosign

# Assinar imagem (keyless com OIDC — GitHub Actions)
cosign sign --yes ghcr.io/myorg/myapp:v1.2.3

# Verificar assinatura
cosign verify --certificate-identity-regexp="https://github.com/myorg/myapp" \
              --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
              ghcr.io/myorg/myapp:v1.2.3

# Verificar digest (imutavel)
docker pull ghcr.io/myorg/myapp:v1.2.3@sha256:abc123...
\`\`\`

## Multi-arquitetura com Docker Buildx

\`\`\`bash
# Criar e usar um builder com suporte multi-plataforma
docker buildx create --name multiarch --use
docker buildx inspect --bootstrap

# Build para AMD64 e ARM64 simultaneamente
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag myregistry.io/myapp:v1.2.3 \
  --push \                           # envia direto ao registry
  .

# Verificar manifests (lista de arquiteturas)
docker buildx imagetools inspect myregistry.io/myapp:v1.2.3

# Para CI (GitHub Actions): usar docker/setup-buildx-action
# Para ambiente local: usar QEMU para emular ARM
docker run --rm --privileged multiarch/qemu-user-static --reset -p yes
\`\`\`

## Resource Limits e Restart Policies

### Limitacoes criticas em producao

\`\`\`bash
# NUNCA subir container sem resource limits em producao
docker run -d \
  --name myapp \
  --memory="512m" \          # limite de RAM
  --memory-swap="512m" \     # = memory = sem swap
  --cpus="1.0" \             # 1 CPU completo
  --cpu-shares=512 \         # peso relativo (default 1024)
  --pids-limit=100 \         # max processos (previne fork bombs)
  --restart unless-stopped \  # reiniciar automaticamente
  -p 8080:8080 \
  myapp:v1.2.3

# Verificar limites aplicados
docker stats myapp
docker inspect myapp | jq '.[].HostConfig | {Memory, NanoCpus, PidsLimit}'
\`\`\`

### Restart policies

\`\`\`
no             → nao reiniciar (default)
always         → sempre reiniciar (incluindo reboot do host)
unless-stopped → reiniciar exceto se parado manualmente
on-failure[:N] → reiniciar apenas se sair com erro (max N vezes)
\`\`\`

\`\`\`bash
# on-failure com limite (bom para jobs)
docker run --restart=on-failure:3 myapp

# unless-stopped (bom para servicos de longa duracao)
docker run --restart=unless-stopped myapp

# Verificar historico de restarts
docker inspect myapp | jq '.[].RestartCount'
\`\`\`

## Logging em Producao

### Drivers de log

\`\`\`bash
# Driver padrao: json-file (armazena localmente)
# Problema: sem rotacao por default = disco cheio!

# json-file com rotacao (minimo aceitavel)
docker run --log-driver json-file \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  myapp:v1.2.3

# Configurar globalmente em /etc/docker/daemon.json:
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}

# Para producao com centralização: usar journald + Loki, ou fluentd/fluent-bit
docker run --log-driver journald myapp
docker run --log-driver fluentd \
  --log-opt fluentd-address=localhost:24224 \
  myapp
\`\`\`

### Estrutura de logs recomendada

\`\`\`python
# Aplicacao deve logar para STDOUT/STDERR (nao para arquivos!)
# Docker captura STDOUT/STDERR automaticamente
import logging
import json
import sys

# Formato estruturado (JSON) para facilitar parsing
class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_entry = {
            "timestamp": self.formatTime(record),
            "level": record.levelname,
            "message": record.getMessage(),
            "service": "myapp",
            "version": "1.2.3"
        }
        return json.dumps(log_entry)

handler = logging.StreamHandler(sys.stdout)  # STDOUT
handler.setFormatter(JSONFormatter())
logging.basicConfig(handlers=[handler])
\`\`\`

## CI/CD Pipeline Completo com Docker

### GitHub Actions — build, scan e push

\`\`\`yaml
# .github/workflows/docker.yml
name: Docker Build and Push

on:
  push:
    branches: [main]
    tags: ["v*"]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: \${{ github.repository }}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
      id-token: write  # para cosign keyless signing

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to registry
        uses: docker/login-action@v3
        with:
          registry: \${{ env.REGISTRY }}
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}
          tags: |
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha,prefix=sha-

      - name: Build and push
        id: build
        uses: docker/build-push-action@v5
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: \${{ github.event_name != 'pull_request' }}
          tags: \${{ steps.meta.outputs.tags }}
          labels: \${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Scan with Trivy
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}:sha-\${{ github.sha }}
          format: sarif
          output: trivy-results.sarif
          severity: HIGH,CRITICAL
          exit-code: 1           # falha o build se encontrar CVEs criticos

      - name: Sign image with Cosign
        if: github.event_name != 'pull_request'
        uses: sigstore/cosign-installer@v3
        run: cosign sign --yes \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}@\${{ steps.build.outputs.digest }}
\`\`\`

## Docker em Producao: Configuracao do Daemon

### /etc/docker/daemon.json

\`\`\`json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2",
  "default-ulimits": {
    "nofile": {
      "Hard": 65536,
      "Soft": 65536
    }
  },
  "live-restore": true,
  "userland-proxy": false,
  "no-new-privileges": true,
  "icc": false
}
\`\`\`

**Explicacao das configuracoes criticas:**
- **live-restore**: containers continuam rodando durante restart do daemon
- **no-new-privileges**: impede escalacao de privilegios via setuid
- **icc: false**: desabilita comunicacao inter-container por padrao (use networks explicitas)

### Docker rootless (seguranca avancada)

\`\`\`bash
# Instalar Docker rootless (sem root do host)
curl -fsSL https://get.docker.com/rootless | sh

# Adicionar ao .bashrc
export PATH=/home/USER/bin:\$PATH
export DOCKER_HOST=unix:///run/user/1000/docker.sock

# Vantagem: mesmo que container escape, nao tem privilegios de root no host
dockerd-rootless-setuptool.sh install
\`\`\`

## Monitoramento e Observabilidade

### Metricas com cAdvisor

\`\`\`yaml
# docker-compose com monitoramento
services:
  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
    ports:
      - "8080:8080"
    command:
      - --housekeeping_interval=10s
      - --max_housekeeping_interval=15s

  node-exporter:
    image: prom/node-exporter:latest
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
    command:
      - --path.procfs=/host/proc
      - --path.sysfs=/host/sys
\`\`\`

\`\`\`bash
# Verificar metricas basicas do container
docker stats --no-stream --format \
  "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"

# Verificar eventos do Docker
docker events --filter type=container --since 1h
\`\`\`

## Erros Comuns em Producao

1. **Usar tag latest em producao** — nao e imutavel, deploys inconsistentes entre nodes
2. **Sem resource limits** — container mata o host consumindo toda a RAM
3. **Log driver sem rotacao** — disco cheio em dias/semanas
4. **restart: always** em vez de **unless-stopped** — container reinicia mesmo quando intencionalmente parado
5. **Secrets como ENV no Dockerfile** — aparecem em \`docker inspect\` e logs
6. **Nao escanear imagens** — vulnerabilidades criticas em producao sem saber

## Killer.sh Style Challenge

> **Cenario:** Sua empresa quer implementar um pipeline de CI/CD completo para uma API Go. Os requisitos sao: (1) imagens multi-arquitetura (AMD64 + ARM64), (2) tag com SemVer + commit SHA, (3) scan automatico de vulnerabilidades com falha em CRITICAL CVEs, (4) push para GHCR autenticado com GITHUB_TOKEN. Escreva o GitHub Actions workflow completo.
`,
  quiz: [
    {
      question: 'Por que usar "latest" como unica tag em producao e considerado uma ma pratica?',
      options: [
        'latest nao funciona em Kubernetes',
        'A tag "latest" nao e imutavel — qualquer novo push a sobrescreve. Em producao com multiplos nodes, diferentes nodes podem ter versoes diferentes da "latest", gerando inconsistencias. E impossivel fazer rollback para uma versao especifica',
        'latest so funciona no Docker Hub, nao em registries privados',
        'Imagens com tag latest sao automaticamente deletadas apos 30 dias'
      ],
      correct: 1,
      explanation: 'A tag "latest" e mutavel — ela aponta para o ultimo push. Se voce faz deploy de v1.0 como "latest" e depois v1.1, a tag "latest" agora aponta para v1.1. Se houver um bug em v1.1 e voce precisar fazer rollback, nao tem como "voltar para o latest anterior". Sempre use tags imutaveis (v1.0.0, sha-abc123) em producao, e opcionalmente mantenha "latest" como alias conveniente.',
      reference: 'Padrao recomendado: taguear com SemVer (v1.2.3) + commit SHA (sha-abc1234) em todo CI/CD push.'
    },
    {
      question: 'O que e Docker Buildx e qual o beneficio principal dos builds multi-plataforma?',
      options: [
        'Buildx e uma extensao que apenas acelera builds paralelos',
        'Buildx e o builder estendido do Docker que suporta builds multi-plataforma (linux/amd64, linux/arm64, etc.) e cache avancado — permitindo criar uma unica imagem que funciona em Intel/AMD e ARM (Apple M1/M2, AWS Graviton) com um unico comando',
        'Buildx e necessario apenas para imagens acima de 1GB',
        'Multi-plataforma so e relevante para mobile e IoT, nao para servidores'
      ],
      correct: 1,
      explanation: 'Docker Buildx usa BuildKit por baixo e suporta builds para multiplas arquiteturas em um unico comando. O resultado e um "manifest list" no registry — quando alguem faz `docker pull`, o Docker automaticamente pega a versao correta para a arquitetura do host. Com AWS Graviton (ARM64) sendo ate 40% mais barato que instancias Intel equivalentes, multi-arquitetura e cada vez mais relevante em producao.',
      reference: 'Pratica: `docker buildx build --platform linux/amd64,linux/arm64 --push` no CI/CD garante que a imagem funciona em qualquer cloud.'
    },
    {
      question: 'Qual a diferenca entre `--restart always` e `--restart unless-stopped`?',
      options: [
        'Sao identicos em comportamento',
        '`always` reinicia o container em QUALQUER situacao, incluindo quando voce para manualmente; `unless-stopped` reinicia automaticamente EXCETO se o container foi parado manualmente — ideal para servicos de producao',
        '`unless-stopped` so funciona com Docker Compose',
        '`always` e para producao, `unless-stopped` e para desenvolvimento'
      ],
      correct: 1,
      explanation: 'Com `always`, se voce rodar `docker stop myapp`, o container para — mas na proxima vez que o Docker daemon reiniciar (reboot do servidor), ele volta. Com `unless-stopped`, o Docker lembra que voce parou intencionalmente e NAO reinicia no proximo boot. Para manutencao planejada (para um container enquanto migra dados), `unless-stopped` e mais adequado pois respeita a intencao do operador.',
      reference: 'Regra pratica: use `unless-stopped` para servicos de producao. Use `always` apenas quando o container SEMPRE deve rodar, sem excecao.'
    },
    {
      question: 'Por que e critico configurar rotacao de logs no Docker daemon em producao?',
      options: [
        'Logs grandes diminuem a performance do container',
        'O driver json-file (padrao) armazena todos os logs em /var/lib/docker/containers/ sem limite por padrao — em dias ou semanas, pode encher o disco do servidor, causando falha em TODOS os containers no host',
        'Rotacao de logs e necessaria apenas para aplicacoes com mais de 1000 req/s',
        'O Docker deleta logs automaticamente apos 7 dias'
      ],
      correct: 1,
      explanation: 'O driver json-file grava os logs de STDOUT/STDERR de cada container em arquivos JSON em /var/lib/docker/containers/<id>/. Sem configurar max-size e max-file, esses arquivos crescem indefinidamente. Em producao com aplicacoes verbose, e facil encher discos de 100GB em menos de uma semana. Configurar `max-size: 10m` e `max-file: 3` garante no maximo 30MB de log por container.',
      reference: 'Configurar em /etc/docker/daemon.json para aplicar globalmente a todos os containers no host.'
    },
    {
      question: 'O que o campo `icc: false` no daemon.json do Docker faz?',
      options: [
        'Desabilita o Docker ICC (Integrated Container Console)',
        'Desabilita a comunicacao inter-container (Inter-Container Communication) na rede bridge padrao — forcando que containers se comuniquem apenas por redes Docker explicitamente criadas, aumentando o isolamento',
        'Impede containers de fazer requisicoes para a internet',
        'Desabilita o uso de volumes compartilhados entre containers'
      ],
      correct: 1,
      explanation: 'Por padrao, todos os containers conectados na rede bridge padrao (docker0) podem se comunicar entre si diretamente por IP — mesmo sem voce configurar isso explicitamente. `icc: false` desabilita esse comportamento. Containers so se comunicam via redes Docker nomeadas (criadas com docker network create ou no Compose), que voce controla explicitamente. E uma defesa em profundidade.',
      reference: 'Complemento: em Kubernetes, Network Policies fazem o equivalente — restringem comunicacao entre Pods por padrao.'
    },
    {
      question: 'Como funciona o cache do GitHub Actions (`cache-from: type=gha`) para builds Docker?',
      options: [
        'O GitHub armazena a imagem completa entre runs',
        'O cache gha armazena os layers do Docker build no cache do GitHub Actions — layers nao modificados sao reutilizados entre runs de CI, reduzindo drasticamente o tempo de build (especialmente quando so o codigo muda, nao as dependencias)',
        'O cache so funciona para imagens menores que 500MB',
        'type=gha e o mesmo que nao ter cache — e apenas um placeholder'
      ],
      correct: 1,
      explanation: 'O BuildKit suporta varios backends de cache. O `type=gha` usa o cache do GitHub Actions como backend de armazenamento de layers. Com `mode=max`, todos os layers intermediarios sao cacheados, nao apenas o final. Resultado pratico: um build que normalmente leva 8 minutos pode cair para 1-2 minutos em runs subsequentes quando apenas o codigo mudou.',
      reference: 'Outras opcoes de cache: `type=registry` (cache no proprio registry), `type=local` (disco local — bom para self-hosted runners).'
    },
    {
      question: 'O que e Container Image Signing (ex: Cosign) e por que e importante para supply chain security?',
      options: [
        'E uma forma de adicionar metadados de copyright as imagens',
        'Cosign assina criptograficamente a imagem (ou seu digest SHA256) com uma chave privada ou via OIDC keyless — permitindo verificar que a imagem foi gerada pelo CI oficial e nao foi adulterada entre o build e o deploy',
        'Signing e necessario apenas para imagens publicadas no Docker Hub',
        'Signing criptografa o conteudo da imagem para proteger segredos'
      ],
      correct: 1,
      explanation: 'Supply chain attacks (como o ataque SolarWinds) comprometem o processo de build, nao a aplicacao diretamente. Container signing com Cosign garante que: (1) a imagem foi gerada pelo seu CI/CD, (2) nao foi adulterada no registry, (3) a identidade do assinante e verificavel (via OIDC keyless, usa o contexto do GitHub Actions como identidade). Em Kubernetes, Kyverno e OPA podem verificar assinaturas antes de permitir o deploy.',
      reference: 'Padrao SLSA (Supply chain Levels for Software Artifacts): signing e parte do nivel 3+ de segurança de supply chain.'
    }
  ],
  flashcards: [
    {
      front: 'Estrategia de tags para producao',
      back: '**Nunca usar apenas "latest" em producao**\n\n**Tags imutaveis recomendadas:**\n```bash\n# SemVer (versao da release)\ndocker tag myapp:latest myapp:v1.2.3\n\n# Commit SHA (traceabilidade)\nCOMMIT=\$(git rev-parse --short HEAD)\ndocker tag myapp:latest myapp:sha-\${COMMIT}\n\n# Multi-tag no build\ndocker build \\\n  -t myapp:v1.2.3 \\\n  -t myapp:sha-abc1234 \\\n  -t myapp:latest .\n```\n\n**Por que "latest" e perigoso:**\n- Mutavel: novo push sobrescreve\n- Rollback impossivel\n- Nodes diferentes podem ter versoes\n  diferentes em producao\n\n**No CI/CD (GitHub Actions):**\n```yaml\n# docker/metadata-action gera tags automaticamente\ntags: |\n  type=semver,pattern={{version}}\n  type=sha,prefix=sha-\n```'
    },
    {
      front: 'Multi-arquitetura com Docker Buildx',
      back: '**Setup:**\n```bash\ndocker buildx create --name multiarch --use\ndocker buildx inspect --bootstrap\n```\n\n**Build multi-plataforma:**\n```bash\ndocker buildx build \\\n  --platform linux/amd64,linux/arm64 \\\n  --tag myapp:v1.2.3 \\\n  --push .\n```\n\n**Verificar manifests:**\n```bash\ndocker buildx imagetools inspect myapp:v1.2.3\n# Mostra: amd64 + arm64 digests separados\n```\n\n**No CI (GitHub Actions):**\n```yaml\n- uses: docker/setup-buildx-action@v3\n- uses: docker/build-push-action@v5\n  with:\n    platforms: linux/amd64,linux/arm64\n    push: true\n    cache-from: type=gha\n    cache-to: type=gha,mode=max\n```\n\n**Por que importa:**\n- AWS Graviton (ARM64): ~40% mais barato\n- Apple M1/M2: desenvolvedores com Mac\n- Raspberry Pi e edge devices'
    },
    {
      front: 'Resource limits em producao — obrigatorios',
      back: '**Sem limits = container pode matar o host!**\n\n```bash\ndocker run -d \\\n  --memory="512m" \\\n  --memory-swap="512m" \\ # = memory = sem swap\n  --cpus="1.0" \\\n  --pids-limit=100 \\\n  --restart unless-stopped \\\n  myapp:v1.2.3\n```\n\n**Restart policies:**\n```\nno             → nao reiniciar\nalways         → sempre (inclusive apos docker stop)\nunless-stopped → sempre EXCETO se parado manualmente ✓\non-failure:3   → so em erro, max 3x (jobs)\n```\n\n**Verificar limites:**\n```bash\ndocker stats myapp  # tempo real\ndocker inspect myapp | jq \\\n  \'.[].HostConfig | {\n    Memory,\n    NanoCpus,\n    PidsLimit\n  }\'\n```\n\n**Equivalente em K8s:**\n```yaml\nresources:\n  limits:\n    memory: 512Mi\n    cpu: "1.0"\n```'
    },
    {
      front: 'Logging em producao — configuracao correta',
      back: '**daemon.json (global para todos containers):**\n```json\n{\n  "log-driver": "json-file",\n  "log-opts": {\n    "max-size": "10m",\n    "max-file": "3"\n  }\n}\n```\n\n**Por container (override):**\n```bash\ndocker run --log-driver json-file \\\n  --log-opt max-size=10m \\\n  --log-opt max-file=3 \\\n  myapp\n```\n\n**Drivers para producao:**\n- `json-file` + rotacao: minimo aceitavel\n- `journald`: integra com systemd\n- `fluentd`/`fluent-bit`: centralizado\n- `awslogs`: direto ao CloudWatch\n\n**Regra da app:**\n- SEMPRE logar para STDOUT/STDERR\n- Nunca para arquivos dentro do container\n- Docker captura automaticamente\n\n**Ver logs:**\n```bash\ndocker logs myapp --tail 100 -f\ndocker logs myapp --since 1h\n```'
    },
    {
      front: 'daemon.json — configuracoes criticas de seguranca',
      back: '```json\n{\n  "log-driver": "json-file",\n  "log-opts": { "max-size": "10m" },\n  "storage-driver": "overlay2",\n  "live-restore": true,\n  "userland-proxy": false,\n  "no-new-privileges": true,\n  "icc": false\n}\n```\n\n**O que cada um faz:**\n\n`live-restore: true`\n→ Containers continuam rodando durante\n  restart do daemon Docker\n\n`no-new-privileges: true`\n→ Previne escalacao de privilegios via setuid\n  (mesmo que container tente)\n\n`icc: false`\n→ Containers na bridge padrao NAO podem\n  se comunicar entre si diretamente\n  (usa redes Docker explicitamente)\n\n`userland-proxy: false`\n→ Usa iptables em vez de proxy para ports\n  (melhor performance)\n\n**Aplicar mudancas:**\n```bash\nsudo systemctl reload docker\n# ou\nsudo kill -SIGHUP \$(pidof dockerd)\n```'
    },
    {
      front: 'CI/CD pipeline Docker — checklist completo',
      back: '**Stages obrigatorios:**\n```\n1. Checkout do codigo\n2. Setup Buildx (multi-arch)\n3. Login no registry\n4. Extrair metadata (tags, labels)\n5. Build + Push multi-plataforma\n6. Scan de vulnerabilidades (Trivy)\n7. Sign da imagem (Cosign)\n```\n\n**Tags automaticas (metadata-action):**\n```yaml\ntags: |\n  type=semver,pattern={{version}}\n  type=semver,pattern={{major}}.{{minor}}\n  type=sha,prefix=sha-\n  type=edge,branch=main\n```\n\n**Cache eficiente:**\n```yaml\ncache-from: type=gha\ncache-to: type=gha,mode=max\n```\n\n**Scan com falha em CRITICAL:**\n```yaml\n- uses: aquasecurity/trivy-action@master\n  with:\n    severity: HIGH,CRITICAL\n    exit-code: 1  # falha o build!\n```\n\n**Verificar digest imutavel:**\n```bash\ndocker pull myapp@sha256:abc123...\n```'
    }
  ],
  lab: {
    scenario: 'Voce precisa preparar uma aplicacao Flask para producao real: criar um pipeline CI/CD local simulado que testa a imagem, escaneia vulnerabilidades, e valida as configuracoes de producao (resource limits, restart policy, log rotation).',
    objective: 'Implementar um workflow completo de producao Docker: build otimizado, scan de seguranca, resource limits, logging configurado, e validacao de prontidao para producao.',
    duration: '30-40 minutos',
    steps: [
      {
        title: 'Criar build de producao com multi-stage e metadata',
        instruction: `Crie um Dockerfile de producao usando multi-stage build com labels de metadata, e simule o processo de tagging de CI/CD.`,
        hints: [
          'Use ARGs para passar versao e commit SHA no build',
          'Adicione LABELS padrao OCI (org.opencontainers.image.*)',
          'Multi-tag a imagem com versao + commit SHA'
        ],
        solution: `\`\`\`bash
# Criar o projeto de producao
mkdir prod-deploy && cd prod-deploy

cat > app.py << 'EOF'
from flask import Flask, jsonify
import os

app = Flask(__name__)

@app.route('/health')
def health():
    return jsonify({
        "status": "ok",
        "version": os.getenv("APP_VERSION", "unknown"),
        "commit": os.getenv("GIT_COMMIT", "unknown")
    })

@app.route('/')
def index():
    return jsonify({"message": "Production ready!"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
EOF

cat > requirements.txt << 'EOF'
flask==3.0.0
gunicorn==21.2.0
EOF

# Dockerfile com ARGs para CI/CD metadata
cat > Dockerfile << 'EOF'
FROM python:3.11-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

FROM python:3.11-slim

# Build args (passados pelo CI/CD)
ARG APP_VERSION=dev
ARG GIT_COMMIT=unknown
ARG BUILD_DATE

# Labels OCI padrao
LABEL org.opencontainers.image.version="\${APP_VERSION}" \
      org.opencontainers.image.revision="\${GIT_COMMIT}" \
      org.opencontainers.image.created="\${BUILD_DATE}" \
      org.opencontainers.image.title="Flask App" \
      org.opencontainers.image.source="https://github.com/myorg/myapp"

WORKDIR /app

# Copiar dependencias do builder
COPY --from=builder /root/.local /root/.local
COPY app.py .

# Variaveis de ambiente com os valores dos ARGs
ENV APP_VERSION=\${APP_VERSION} \
    GIT_COMMIT=\${GIT_COMMIT} \
    PATH=/root/.local/bin:\$PATH

RUN useradd --uid 1001 --create-home appuser && chown -R appuser /app
USER appuser

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD python -c \
  "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')" || exit 1

CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "2", "app:app"]
EOF

# Simular CI/CD: build com metadata
VERSION="v1.2.3"
COMMIT=\$(git init -q && git add . && git commit -m "init" -q && git rev-parse --short HEAD 2>/dev/null || echo "abc1234")
BUILD_DATE=\$(date -u +"%Y-%m-%dT%H:%M:%SZ")

docker build \
  --build-arg APP_VERSION=\${VERSION} \
  --build-arg GIT_COMMIT=\${COMMIT} \
  --build-arg BUILD_DATE=\${BUILD_DATE} \
  -t myapp:\${VERSION} \
  -t myapp:sha-\${COMMIT} \
  -t myapp:latest \
  .

# Verificar labels
docker inspect myapp:\${VERSION} | jq '.[].Config.Labels'
\`\`\``,
        verify: `\`\`\`bash
# Verificar que a imagem foi criada com multiplas tags
docker images myapp
# Saida esperada: v1.2.3, sha-*, latest

# Verificar labels OCI
docker inspect myapp:v1.2.3 | jq '.[].Config.Labels'
# Saida esperada: labels com version, revision, created, etc.

# Verificar metadata na API
docker run --rm -p 8080:8080 -d --name test-prod myapp:v1.2.3
sleep 3
curl -sf http://localhost:8080/health
# Saida esperada: {"status": "ok", "version": "v1.2.3", "commit": "..."}

docker stop test-prod && docker rm test-prod
\`\`\``
      },
      {
        title: 'Configurar resource limits e restart policy de producao',
        instruction: `Execute o container com resource limits corretos para producao, restart policy, e logging com rotacao. Valide cada configuracao.`,
        hints: [
          'Use --memory-swap igual a --memory para desabilitar swap',
          'Use --restart unless-stopped para servicos de longa duracao',
          'Configure log rotation para evitar disco cheio'
        ],
        solution: `\`\`\`bash
# Rodar com configuracoes de producao completas
docker run -d \
  --name myapp-prod \
  --memory="256m" \
  --memory-swap="256m" \
  --cpus="0.5" \
  --pids-limit=50 \
  --restart unless-stopped \
  --log-driver json-file \
  --log-opt max-size=5m \
  --log-opt max-file=3 \
  -p 8080:8080 \
  --read-only \
  --tmpfs /tmp \
  --security-opt no-new-privileges:true \
  myapp:v1.2.3

# Verificar configuracoes aplicadas
echo "=== Resource Limits ==="
docker inspect myapp-prod | jq '.[0].HostConfig | {
  Memory,
  MemorySwap,
  NanoCpus,
  PidsLimit,
  RestartPolicy,
  LogConfig
}'

echo "=== Stats em tempo real ==="
docker stats myapp-prod --no-stream --format \
  "CPU: {{.CPUPerc}} | MEM: {{.MemUsage}} | NET: {{.NetIO}}"

# Testar restart policy: simular falha
docker kill myapp-prod
sleep 3
docker ps | grep myapp-prod
# Deve ter reiniciado automaticamente!

echo "=== Restart count ==="
docker inspect myapp-prod | jq '.[0].RestartCount'
\`\`\``,
        verify: `\`\`\`bash
# Verificar que container esta rodando
docker ps | grep myapp-prod

# Verificar memory limit
docker inspect myapp-prod | jq '.[0].HostConfig.Memory'
# Saida esperada: 268435456 (256MB em bytes)

# Verificar restart policy
docker inspect myapp-prod | jq '.[0].HostConfig.RestartPolicy'
# Saida esperada: {"Name": "unless-stopped", "MaximumRetryCount": 0}

# Verificar log config
docker inspect myapp-prod | jq '.[0].HostConfig.LogConfig'
# Saida esperada: {"Type": "json-file", "Config": {"max-file": "3", "max-size": "5m"}}

# Verificar seguranca (read-only filesystem)
docker exec myapp-prod touch /readonly-test 2>&1 | grep -q "Read-only" && echo "Read-only FS ✓"
\`\`\``
      },
      {
        title: 'Escanear imagem e validar prontidao para producao',
        instruction: `Escanear a imagem com Trivy, gerar relatorio de vulnerabilidades, e criar um script de validacao pre-producao que verifica todos os criterios.`,
        hints: [
          'Use trivy com --exit-code 1 para falhar em CVEs CRITICAL',
          'Verifique que o container nao roda como root',
          'Valide que labels OCI estao presentes'
        ],
        solution: `\`\`\`bash
# Instalar trivy se necessario
which trivy || curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin

# Scan completo com relatorio
echo "=== Trivy Security Scan ==="
trivy image \
  --severity HIGH,CRITICAL \
  --format table \
  myapp:v1.2.3

# Scan como gate de CI (falha se encontrar CRITICAL)
echo "=== CI Gate: CRITICAL CVEs ==="
trivy image \
  --severity CRITICAL \
  --exit-code 1 \
  --quiet \
  myapp:v1.2.3
echo "Gate CRITICAL: OK (exit code \$?)"

# Script de validacao pre-producao
cat > validate-prod.sh << 'SCRIPT'
#!/bin/bash
set -e
IMAGE=\${1:-myapp:v1.2.3}
ERRORS=0

echo "Validando imagem: \$IMAGE"
echo "================================"

# 1. Verificar que nao roda como root
USER=\$(docker inspect \$IMAGE | jq -r '.[0].Config.User')
if [ -z "\$USER" ] || [ "\$USER" = "root" ]; then
  echo "FALHA: Container roda como root (User: '\$USER')"
  ERRORS=\$((ERRORS+1))
else
  echo "OK: Usuario nao-root (\$USER)"
fi

# 2. Verificar healthcheck
HEALTHCHECK=\$(docker inspect \$IMAGE | jq '.[0].Config.Healthcheck')
if [ "\$HEALTHCHECK" = "null" ]; then
  echo "AVISO: Sem HEALTHCHECK configurado"
else
  echo "OK: HEALTHCHECK configurado"
fi

# 3. Verificar labels OCI
VERSION_LABEL=\$(docker inspect \$IMAGE | jq -r '.[0].Config.Labels["org.opencontainers.image.version"]')
if [ "\$VERSION_LABEL" = "null" ] || [ -z "\$VERSION_LABEL" ]; then
  echo "AVISO: Label org.opencontainers.image.version ausente"
else
  echo "OK: Version label: \$VERSION_LABEL"
fi

# 4. Verificar porta exposta
PORTS=\$(docker inspect \$IMAGE | jq '.[0].Config.ExposedPorts')
if [ "\$PORTS" = "null" ]; then
  echo "AVISO: Nenhuma porta EXPOSE declarada"
else
  echo "OK: Portas expostas: \$PORTS"
fi

# 5. Scan de seguranca
echo ""
echo "=== Security Scan ==="
trivy image --severity CRITICAL --exit-code 1 --quiet \$IMAGE && \
  echo "OK: Sem CVEs CRITICAL" || \
  { echo "FALHA: CVEs CRITICAL encontradas!"; ERRORS=\$((ERRORS+1)); }

echo ""
echo "================================"
if [ \$ERRORS -eq 0 ]; then
  echo "RESULTADO: APROVADO para producao"
  exit 0
else
  echo "RESULTADO: REPROVADO (\$ERRORS erros)"
  exit 1
fi
SCRIPT

chmod +x validate-prod.sh
./validate-prod.sh myapp:v1.2.3
\`\`\``,
        verify: `\`\`\`bash
# Verificar que o script existe e e executavel
ls -la validate-prod.sh

# Rodar validacao
./validate-prod.sh myapp:v1.2.3
# Saida esperada: todos os checks OK ou AVISO (nao FALHA)

# Verificar o container prod rodando
docker ps | grep myapp-prod
curl -sf http://localhost:8080/health | python3 -m json.tool

# Cleanup
docker stop myapp-prod && docker rm myapp-prod
docker rmi myapp:v1.2.3 myapp:latest 2>/dev/null || true
echo "Lab completo! Imagem validada para producao."
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Container consumindo toda a memoria do host (OOM Kill)',
      difficulty: 'hard',
      symptom: 'O servidor fica lento e containers sao mortos aleatoriamente. `dmesg` mostra "oom-kill-process". `docker stats` mostra um container usando quase toda a RAM disponivel.',
      diagnosis: `\`\`\`bash
# 1. Verificar uso de memoria em tempo real
docker stats --no-stream
# ou
docker stats --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}"

# 2. Verificar se tem OOM kills recentes
docker inspect <container> | jq '.[].State.OOMKilled'
# true = foi morto por OOM

# 3. Verificar logs do sistema
dmesg | grep -i "oom\|killed process" | tail -20
journalctl -k | grep -i "oom" | tail -10

# 4. Verificar se container tem memory limit
docker inspect <container> | jq '.[].HostConfig.Memory'
# 0 = SEM LIMITE (problema!)

# 5. Ver consumo detalhado dentro do container
docker exec <container> cat /sys/fs/cgroup/memory/memory.usage_in_bytes
\`\`\``,
      solution: `**Solucao imediata — adicionar memory limit:**
\`\`\`bash
# Nao e possivel adicionar limits a um container em execucao
# Precisa recriar com limits

docker stop <container>
docker rm <container>

docker run -d \
  --name <container> \
  --memory="512m" \
  --memory-swap="512m" \
  --restart unless-stopped \
  [outras opcoes] \
  <image>
\`\`\`

**Configurar limite global no daemon.json:**
\`\`\`json
{
  "default-ulimits": {
    "nofile": { "Hard": 65536, "Soft": 65536 }
  }
}
\`\`\`

**Para evitar no futuro — configurar limites no Compose:**
\`\`\`yaml
services:
  api:
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "1.0"
        reservations:
          memory: 256M
\`\`\`

**Verificar apos corrigir:**
\`\`\`bash
docker inspect <container> | jq '.[].HostConfig.Memory'
# Esperado: 536870912 (512MB em bytes), nao 0
docker stats <container> --no-stream
\`\`\``
    },
    {
      title: 'Disco do servidor cheio por logs do Docker',
      difficulty: 'medium',
      symptom: 'Alerta de disco cheio no servidor. `df -h` mostra /var/lib/docker com 100% de uso. `du -sh /var/lib/docker/containers/` mostra GBs de uso.',
      diagnosis: `\`\`\`bash
# 1. Verificar uso do disco
df -h /var/lib/docker
du -sh /var/lib/docker/containers/

# 2. Ver os maiores arquivos de log
find /var/lib/docker/containers -name "*.log" \
  -exec ls -lh {} \; | sort -k5 -hr | head -10

# 3. Verificar configuracao de log dos containers
docker inspect <container> | jq '.[].HostConfig.LogConfig'
# Se "Config": {}, nao tem rotacao configurada

# 4. Ver todos os containers por tamanho
docker ps -a --format "{{.ID}} {{.Names}}" | while read id name; do
  size=\$(docker inspect \$id | jq '.[].SizeRootFs' 2>/dev/null)
  echo "\$size \$name"
done | sort -n -r | head -10
\`\`\``,
      solution: `**Limpeza emergencial (CUIDADO: irreversivel):**
\`\`\`bash
# Truncar logs sem parar containers (emergencia)
truncate -s 0 /var/lib/docker/containers/<id>/<id>-json.log

# Limpar imagens nao usadas
docker image prune -a --force

# Limpar tudo que nao esta em uso
docker system prune --force
# CUIDADO: remove containers parados, imagens nao usadas, redes

# Ver quanto espaco seria liberado
docker system df
\`\`\`

**Configurar rotacao permanente em /etc/docker/daemon.json:**
\`\`\`json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
\`\`\`

\`\`\`bash
# Aplicar configuracao
sudo systemctl reload docker

# Recriar containers existentes para aplicar
# (containers existentes herdam a config no proximo start)
docker stop <container> && docker start <container>
\`\`\`

**Verificar apos corrigir:**
\`\`\`bash
docker inspect <container> | jq '.[].HostConfig.LogConfig'
# Esperado: {"Type": "json-file", "Config": {"max-file": "3", "max-size": "10m"}}
\`\`\``
    }
  ]
};
