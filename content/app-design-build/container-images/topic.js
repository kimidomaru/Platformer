window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['app-design-build/container-images'] = {
  theory: `# Container Images e Dockerfile

## O que sao Containers?

Containers sao **processos isolados** que compartilham o kernel do sistema operacional host. Diferente de maquinas virtuais, nao emulam hardware - apenas isolam o processo usando recursos nativos do Linux.

### Mecanismos de Isolamento

**Namespaces** controlam o que o processo consegue **ver**:
- \`pid\`: processos visiveis
- \`net\`: interfaces de rede
- \`mnt\`: sistema de arquivos
- \`uts\`: hostname
- \`ipc\`: comunicacao entre processos
- \`user\`: mapeamento de usuarios

**cgroups** (Control Groups) controlam o que o processo consegue **usar**:
- CPU (shares, quota, cpuset)
- Memoria (limit, swap)
- I/O de disco
- Rede (traffic shaping)

### Problema que Containers Resolvem

- **"Works on my machine"**: ambiente identico do dev ao prod
- **Dependency hell**: cada container tem suas proprias dependencias
- **Portabilidade**: roda em qualquer host com container runtime
- **Isolamento**: falha em um container nao afeta outros

---

## Componentes Docker

| Componente | Funcao |
|---|---|
| **Docker Client** | CLI que o usuario interage (\`docker build\`, \`docker run\`) |
| **Docker Engine (dockerd)** | Daemon que gerencia o ciclo de vida dos containers |
| **containerd** | Container runtime de alto nivel, gerencia imagens e containers |
| **runc** | Container runtime de baixo nivel, cria o container de fato usando namespaces e cgroups |
| **Registry** | Repositorio de imagens (Docker Hub, ECR, GCR, GHCR) |

Fluxo: \`docker run\` -> dockerd -> containerd -> runc -> processo isolado

---

## Nomenclatura de Imagens: registry/repository:tag

O formato completo de uma referencia de imagem e:

\`\`\`
[registry/][namespace/]repository[:tag][@sha256:digest]
\`\`\`

Exemplos praticos:

| Referencia | Registry | Namespace | Repositorio | Tag |
|---|---|---|---|---|
| \`nginx\` | docker.io | library | nginx | latest |
| \`nginx:1.25.3\` | docker.io | library | nginx | 1.25.3 |
| \`myuser/myapp:v2.0\` | docker.io | myuser | myapp | v2.0 |
| \`gcr.io/myproject/api:abc123\` | gcr.io | myproject | api | abc123 |
| \`harbor.empresa.com/backend/app:prod\` | harbor.empresa.com | backend | app | prod |

### Digest imutavel (@sha256)

Tags sao **mutaveis** (podem ser sobrescritas). Para garantir reproducibilidade absoluta, use o digest:

\`\`\`bash
# Referencia com digest - 100% imutavel
nginx@sha256:32fdf92b4e986e109e4db0865758020cb0c3b70d6ba80d02614d9e5b...

# Obter o digest de uma imagem
docker inspect nginx:1.25.3 --format '{{index .RepoDigests 0}}'
docker pull nginx:1.25.3 | grep Digest
\`\`\`

No Kubernetes, usar digest garante que exatamente o mesmo binario seja executado em todos os nodes, independente de atualizacoes do registry.

---

## Registries de Container

| Registry | Tipo | Observacoes para CKA |
|---|---|---|
| **Docker Hub** | Publico/Privado | Limite de rate para pulls anonimos (100/6h) |
| **Amazon ECR** | AWS | Autenticacao via IAM; token expira em 12h |
| **Google GCR / Artifact Registry** | GCP | Autenticacao via service account |
| **Azure ACR** | Azure | Autenticacao via service principal |
| **Harbor** | Self-hosted | Open source; scanning nativo com Trivy |
| **GHCR (GitHub)** | GitHub | ghcr.io; autenticacao via PAT |
| **Quay.io** | Red Hat | Popular em ambientes OpenShift |

### Especificacao OCI (Open Container Initiative)

A OCI define padroes abertos para:
- **OCI Image Spec**: formato das camadas e manifest.json
- **OCI Runtime Spec**: como criar e rodar containers (runc)
- **OCI Distribution Spec**: como servidores de registry devem se comportar (API)

Qualquer ferramenta compativel com OCI (Podman, Buildah, kaniko, ko) pode gerar imagens que rodam no Kubernetes sem modificacoes.

---

## Imagens: Estrutura em Camadas

Imagens sao **imutaveis** e compostas por **camadas read-only** empilhadas. Cada instrucao no Dockerfile gera uma nova camada.

### Copy-on-Write (COW)

Quando um container escreve em um arquivo da imagem, o sistema de arquivos (OverlayFS) copia esse arquivo para a **camada de escrita do container** antes de modificar. A imagem original permanece intacta.

\`\`\`
Container Layer (leitura/escrita) <- so este container ve
--------------------------------
Image Layer 3: COPY app /app    (read-only, compartilhada)
Image Layer 2: RUN apt-get      (read-only, compartilhada)
Image Layer 1: FROM ubuntu      (read-only, compartilhada)
\`\`\`

Multiplos containers podem compartilhar as mesmas camadas da imagem em memoria e disco, economizando recursos.

---

## Dockerfile: Instrucoes

### Instrucoes Basicas

\`\`\`dockerfile
# FROM: imagem base (sempre a primeira instrucao)
FROM python:3.11-slim

# ARG: variavel disponivel apenas durante o build
ARG APP_VERSION=1.0.0

# ENV: variavel de ambiente disponivel no container em execucao
ENV PYTHONUNBUFFERED=1 \\
    APP_HOME=/app

# WORKDIR: define o diretorio de trabalho (cria se nao existir)
WORKDIR /app

# COPY: copia arquivos do host para a imagem (preferida sobre ADD)
COPY requirements.txt .

# RUN: executa comando e cria nova camada
RUN pip install --no-cache-dir -r requirements.txt

# COPY do codigo apos instalar dependencias (otimiza cache)
COPY . .

# EXPOSE: documenta a porta (nao publica automaticamente)
EXPOSE 8080

# USER: define o usuario para execucao (seguranca: evitar root)
USER 1001

# CMD: comando padrao ao iniciar o container (pode ser sobrescrito)
CMD ["python", "main.py"]
\`\`\`

### ENTRYPOINT vs CMD

| | ENTRYPOINT | CMD |
|---|---|---|
| **Proposito** | Comando principal (nao sobrescrito facilmente) | Argumentos padrao |
| **Sobrescrita** | Requer \`--entrypoint\` flag | Qualquer argumento apos a imagem |
| **Combinacao** | ENTRYPOINT define o executavel, CMD define os args |

\`\`\`dockerfile
# Combinacao classica para scripts
ENTRYPOINT ["python"]
CMD ["app.py"]
# docker run myimage -> python app.py
# docker run myimage manage.py migrate -> python manage.py migrate
\`\`\`

---

## Multi-Stage Build

Reduz drasticamente o tamanho da imagem final separando o ambiente de build do ambiente de runtime:

\`\`\`dockerfile
# Estagio 1: build
FROM golang:1.21-alpine AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/app ./cmd/app

# Estagio 2: imagem final (sem toolchain de build)
FROM gcr.io/distroless/static-debian12
COPY --from=builder /bin/app /app
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/app"]
\`\`\`

Resultado: imagem de ~10MB ao inves de ~400MB.

### Multi-stage com cache de dependencias (Node.js)

\`\`\`dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
\`\`\`

---

## Boas Praticas de Build

### Otimizacao de Cache de Camadas

O Docker invalida o cache a partir da primeira camada modificada. Organize as instrucoes do **menos mutavel para o mais mutavel**:

\`\`\`dockerfile
# CORRETO: dependencias antes do codigo
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./        # muda raramente
RUN npm ci                   # cache preservado enquanto package.json nao muda
COPY . .                     # muda frequentemente
CMD ["node", "server.js"]
\`\`\`

### .dockerignore

Evita copiar arquivos desnecessarios para o contexto de build:

\`\`\`
node_modules
.git
.env
*.log
dist
coverage
__pycache__
*.pyc
.DS_Store
\`\`\`

### Seguranca e Boas Praticas

- Use imagens base minimas: \`alpine\`, \`distroless\`, \`slim\`
- Nunca execute como root: \`USER 1001\`
- Nao copie segredos para a imagem (nem via ARG - ficam no historico das camadas)
- Escaneie imagens com ferramentas de SAST: \`trivy image myapp:v1\`
- Use tags especificas ou digests em producao, nunca \`latest\`
- Combine multiplos comandos RUN para reduzir camadas:

\`\`\`dockerfile
# Ruim: 3 camadas separadas
RUN apt-get update
RUN apt-get install -y curl
RUN apt-get clean

# Bom: 1 camada, limpeza do cache na mesma instrucao
RUN apt-get update && \\
    apt-get install -y --no-install-recommends curl && \\
    apt-get clean && \\
    rm -rf /var/lib/apt/lists/*
\`\`\`

---

## Estrategias de Tagging

| Estrategia | Exemplo | Uso |
|---|---|---|
| **SemVer** | \`v1.2.3\` | Releases de producao |
| **Git SHA** | \`abc1234\` | Rastreabilidade de codigo |
| **Branch + SHA** | \`main-abc1234\` | CI/CD por branch |
| **Data** | \`20240315\` | Snapshots diarios |
| **latest** | \`latest\` | NUNCA em producao |

**Problema do \`latest\`**: e uma tag mutavel. Dois nodes podem ter versoes diferentes da mesma tag \`latest\` em cache, causando comportamento inconsistente no cluster.

---

## Image Pull Policies no Kubernetes

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: minha-app
spec:
  containers:
    - name: app
      image: minha-registry.io/app:v1.2.3
      imagePullPolicy: IfNotPresent
\`\`\`

| Policy | Comportamento | Quando usar |
|---|---|---|
| \`Always\` | Sempre faz pull ao criar/reiniciar o Pod | Tags mutaveis (\`latest\`), CI/CD, garantia de versao |
| \`IfNotPresent\` | Pull apenas se a imagem nao estiver no node | **Padrao para tags especificas**, economiza banda |
| \`Never\` | Nunca faz pull - imagem deve pre-existir | Air-gapped, imagens pre-carregadas nos nodes |

**Regra do Kubernetes**: se a tag for \`latest\` ou omitida, o padrao e \`Always\`. Se for uma tag especifica, o padrao e \`IfNotPresent\`.

\`\`\`bash
# Verificar qual imagePullPolicy esta sendo usada
kubectl get pod minha-app -o jsonpath='{.spec.containers[0].imagePullPolicy}'

# Forcado Always por nao ter tag especifica (perigoso em prod!)
# image: nginx  -> imagePullPolicy: Always (implicito)
\`\`\`

---

## imagePullSecrets

Para registries privados, crie um Secret do tipo \`docker-registry\` e referencie no Pod:

\`\`\`bash
# Criar secret a partir de credenciais
kubectl create secret docker-registry meu-registry-secret \\
  --docker-server=minha-registry.io \\
  --docker-username=meu-usuario \\
  --docker-password=minha-senha \\
  --docker-email=dev@empresa.com

# Alternativa: criar a partir do arquivo de config local do Docker
kubectl create secret generic meu-registry-secret \\
  --from-file=.dockerconfigjson=$HOME/.docker/config.json \\
  --type=kubernetes.io/dockerconfigjson
\`\`\`

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-privada
spec:
  imagePullSecrets:
    - name: meu-registry-secret
  containers:
    - name: app
      image: minha-registry.io/app-privada:v2.0.0
      imagePullPolicy: Always
\`\`\`

Associar o secret a uma ServiceAccount para aplicar automaticamente a todos os Pods que a usam:

\`\`\`bash
kubectl patch serviceaccount default \\
  -p '{"imagePullSecrets": [{"name": "meu-registry-secret"}]}'

# Verificar a SA
kubectl get serviceaccount default -o yaml
\`\`\`

**Importante**: o Secret deve estar no **mesmo namespace** do Pod. Secrets nao sao compartilhados entre namespaces.

---

## Init Containers para Preparacao de Imagem

Init containers podem ser usados para preparar artefatos antes do container principal iniciar:

\`\`\`yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-com-assets
spec:
  volumes:
    - name: assets
      emptyDir: {}
  initContainers:
    # Baixa assets/certificados antes do container principal
    - name: download-certs
      image: alpine/curl:8.2.1
      command:
        - /bin/sh
        - -c
        - |
          curl -o /certs/ca.crt https://pki.empresa.com/ca.crt
          curl -o /certs/client.crt https://pki.empresa.com/client.crt
      volumeMounts:
        - name: assets
          mountPath: /certs
      resources:
        requests:
          cpu: "50m"
          memory: "32Mi"
        limits:
          cpu: "100m"
          memory: "64Mi"
  containers:
    - name: app
      image: minha-api:v1.0.0
      volumeMounts:
        - name: assets
          mountPath: /etc/ssl/custom
          readOnly: true
\`\`\`

---

## Seguranca de Imagens: Conceitos de Scanning

Ferramentas como **Trivy**, **Snyk** e **Grype** analisam:
- CVEs (vulnerabilidades) nos pacotes do SO e dependencias
- Segredos expostos (tokens, chaves SSH)
- Configuracoes inseguras (rodar como root, SUID bits)
- Licencas de software

\`\`\`bash
# Escanear imagem com Trivy (ferramenta open source da Aqua)
trivy image minha-app:v1.0.0

# Falhar o build se houver vulnerabilidades criticas
trivy image --exit-code 1 --severity CRITICAL minha-app:v1.0.0

# Escanear o Dockerfile por configuracoes inseguras
trivy config ./Dockerfile
\`\`\`

Em producao, integre o scanning no pipeline de CI/CD e configure admission controllers (Kyverno, OPA Gatekeeper) para rejeitar imagens com vulnerabilidades criticas.
`,

  quiz: [
    {
      question: 'Qual mecanismo do Linux e responsavel por limitar o uso de CPU e memoria de um container?',
      options: [
        'Namespaces',
        'cgroups (Control Groups)',
        'OverlayFS',
        'seccomp'
      ],
      correct: 1,
      explanation: 'cgroups (Control Groups) controlam quanto de recurso (CPU, memoria, I/O) um processo pode consumir. Namespaces controlam o que o processo consegue ver (isolamento de visibilidade), nao o consumo de recursos.'
    },
    {
      question: 'Em um Dockerfile, qual a diferenca principal entre COPY e ADD?',
      options: [
        'COPY e mais rapido, ADD e mais lento',
        'ADD suporta URLs remotas e auto-extracao de arquivos tar; COPY apenas copia arquivos/diretorios locais',
        'COPY cria uma nova camada, ADD nao cria',
        'Nao ha diferenca, sao aliases'
      ],
      correct: 1,
      explanation: 'ADD tem funcionalidades extras: aceita URLs remotas e extrai automaticamente arquivos .tar.gz. Por isso, a pratica recomendada e usar COPY para operacoes simples (mais previsivel e seguro) e ADD apenas quando voce precisa dessas funcionalidades extras.'
    },
    {
      question: 'Qual o imagePullPolicy padrao quando um Pod especifica a imagem como "nginx:1.25.3"?',
      options: [
        'Always',
        'Never',
        'IfNotPresent',
        'OnFailure'
      ],
      correct: 2,
      explanation: 'Quando a tag e especifica (diferente de "latest" ou omitida), o Kubernetes usa IfNotPresent como padrao. Isso significa que o kubelet so fara o pull se a imagem nao estiver presente no cache do node, economizando banda e tempo.'
    },
    {
      question: 'Em um Multi-Stage Build, qual o principal beneficio de copiar apenas o binario final para o estagio de producao?',
      options: [
        'O build fica mais rapido',
        'A imagem final nao contem ferramentas de build, reduzindo tamanho e superficie de ataque',
        'Permite usar instrucoes FROM multiplas',
        'Facilita o debug em producao'
      ],
      correct: 1,
      explanation: 'O Multi-Stage Build permite que o estagio de build tenha todos os compiladores e ferramentas necessarias, mas a imagem final contem apenas o binario/artefato. Isso reduz dramaticamente o tamanho da imagem e elimina ferramentas que poderiam ser exploradas por atacantes.'
    },
    {
      question: 'Qual instrucao do Dockerfile define variaveis que existem APENAS durante o processo de build e nao ficam disponiveis no container em execucao?',
      options: [
        'ENV',
        'ARG',
        'RUN export',
        'SET'
      ],
      correct: 1,
      explanation: 'ARG define variaveis de build-time (disponivel durante o docker build via --build-arg). ENV define variaveis de runtime (disponivel dentro do container em execucao). Usar ENV para segredos e perigoso pois eles ficam visiveis no container; prefira ARG + secrets management para dados sensiveis de build.'
    },
    {
      question: 'Um Pod com imagePullSecrets configurado falha com "ImagePullBackOff". O secret existe no namespace. Qual e a causa mais provavel?',
      options: [
        'O nome do secret no Pod esta errado ou o secret tem credenciais invalidas',
        'Pods nao suportam imagePullSecrets',
        'O imagePullPolicy deve ser Never quando usando imagePullSecrets',
        'O secret precisa estar no namespace kube-system'
      ],
      correct: 0,
      explanation: 'ImagePullBackOff com imagePullSecrets configurado geralmente indica: (1) o nome do secret no spec.imagePullSecrets nao corresponde ao secret real, (2) as credenciais no secret estao incorretas ou expiradas, ou (3) a URL do servidor no secret nao corresponde ao registry da imagem. O secret deve estar no mesmo namespace do Pod.'
    },
    {
      question: 'Por que e recomendado colocar o COPY do codigo-fonte DEPOIS do RUN npm install no Dockerfile de uma aplicacao Node.js?',
      options: [
        'Ordem nao importa no Dockerfile',
        'O npm install requer que o codigo esteja presente primeiro',
        'Otimiza o cache de camadas: as dependencias mudam menos que o codigo, entao o cache do npm install e preservado enquanto apenas o codigo muda',
        'Evita erros de permissao'
      ],
      correct: 2,
      explanation: 'O Docker invalida o cache de uma camada quando ela ou qualquer camada anterior muda. Colocando COPY package*.json + RUN npm install antes do COPY . ., o cache do npm install so e invalidado quando o package.json muda, nao a cada alteracao de codigo. Isso acelera drasticamente os builds em desenvolvimento.'
    },
    {
      question: 'Qual a forma mais segura de garantir reproducibilidade absoluta de uma imagem em producao?',
      options: [
        'Usar a tag "latest" para sempre ter a versao mais recente',
        'Usar uma tag semantica como v1.2.3',
        'Referenciar a imagem pelo digest SHA256 (imagem@sha256:...)',
        'Usar imagePullPolicy: Never'
      ],
      correct: 2,
      explanation: 'Tags sao mutaveis - alguem pode sobrescrever a tag v1.2.3 com um novo conteudo. O digest SHA256 e calculado a partir do conteudo da imagem e e imutavel: se o conteudo mudar, o digest muda. Referenciar por digest garante que exatamente o mesmo binario seja executado sempre, em qualquer node.'
    },
    {
      question: 'Ao criar um imagePullSecret para um registry privado, em qual namespace ele deve existir?',
      options: [
        'Sempre no namespace kube-system',
        'No namespace default independente do Pod',
        'No mesmo namespace do Pod que vai usar a imagem',
        'Pode estar em qualquer namespace, Kubernetes compartilha automaticamente'
      ],
      correct: 2,
      explanation: 'Secrets sao recursos com escopo de namespace. O imagePullSecret deve existir no MESMO namespace do Pod que vai usa-lo. Se voce tem Pods em multiplos namespaces que precisam do mesmo registry privado, e necessario criar o Secret em cada namespace, ou associa-lo a uma ServiceAccount por namespace.'
    },
    {
      question: 'Qual o principal risco de usar ARG para passar segredos (como senhas ou tokens) durante o docker build?',
      options: [
        'ARG nao suporta valores com caracteres especiais',
        'O valor do ARG fica visivel no historico de camadas da imagem (docker history), mesmo sem ser copiado para o container',
        'ARG so funciona em builds locais, nao em CI/CD',
        'Nao ha riscos, ARG e o metodo recomendado para segredos de build'
      ],
      correct: 1,
      explanation: 'Mesmo que o ARG nao seja exportado como ENV, o valor passado durante o build fica armazenado nos metadados das camadas da imagem e e visivel via "docker history --no-trunc" ou inspecionando o manifest da imagem no registry. Para segredos de build, use Docker BuildKit secrets (--secret) ou injecao via secret manager externo.'
    }
  ],

  flashcards: [
    {
      front: 'O que sao Namespaces no contexto de containers?',
      back: 'Mecanismo do kernel Linux que controla o que um processo consegue VER. Tipos: pid (processos), net (rede), mnt (filesystem), uts (hostname), ipc (comunicacao entre processos), user (usuarios). Cada container tem seus proprios namespaces, criando a ilusao de um sistema isolado.'
    },
    {
      front: 'O que e Copy-on-Write (COW) em imagens de container?',
      back: 'Estrategia de otimizacao onde multiplos containers compartilham as mesmas camadas read-only da imagem. Quando um container precisa modificar um arquivo, o sistema (OverlayFS) cria uma copia na camada de escrita exclusiva do container antes de modificar. A imagem original permanece intacta e compartilhada.'
    },
    {
      front: 'Qual a diferenca entre ENTRYPOINT e CMD no Dockerfile?',
      back: 'ENTRYPOINT define o executavel principal do container (dificilmente sobrescrito, requer --entrypoint). CMD define argumentos padrao que PODEM ser sobrescritos passando argumentos apos o nome da imagem. Combinados: ENTRYPOINT ["python"], CMD ["app.py"] -> executa "python app.py" por padrao, mas "docker run img manage.py" executa "python manage.py".'
    },
    {
      front: 'O que e um Multi-Stage Build e qual seu principal beneficio?',
      back: 'Tecnica de Dockerfile que usa multiplos blocos FROM. Estagios anteriores compilam/buildam o artefato; o estagio final copia apenas o resultado. Beneficios: imagem final sem ferramentas de build (menor tamanho, menor superficie de ataque). Exemplo: Go app de ~400MB com toolchain para ~10MB com apenas o binario.'
    },
    {
      front: 'Quais sao as 3 opcoes de imagePullPolicy no Kubernetes e quando usar cada uma?',
      back: 'Always: sempre faz pull (use com tags mutaveis como "latest" ou em CI/CD). IfNotPresent: pull so se nao estiver no node (padrao para tags especificas, economiza banda). Never: nunca faz pull (imagem deve pre-existir no node, uso em ambientes air-gapped). Regra: sem tag especifica -> padrao Always; com tag especifica -> padrao IfNotPresent.'
    },
    {
      front: 'Como configurar acesso a um registry privado no Kubernetes?',
      back: 'Passo 1: criar Secret tipo docker-registry com kubectl create secret docker-registry <nome> --docker-server=... --docker-username=... --docker-password=... Passo 2: referenciar no Pod em spec.imagePullSecrets: [{name: <nome>}]. Alternativa: associar o secret a uma ServiceAccount para aplicar a todos os Pods que a usam automaticamente. O Secret deve estar no MESMO namespace do Pod.'
    },
    {
      front: 'Por que usar imagens base minimas (alpine, distroless, slim) em producao?',
      back: 'Tres beneficios principais: (1) Tamanho menor = pull mais rapido, menos espaco em disco no node. (2) Superficie de ataque reduzida = menos pacotes vulneraveis, menos ferramentas que um atacante poderia explorar. (3) Startup mais rapido. Desvantagem: sem shell interativo para debug (distroless). Solucao: usar imagens debug apenas em ambientes de desenvolvimento.'
    },
    {
      front: 'O que faz o arquivo .dockerignore e por que e importante?',
      back: 'Similar ao .gitignore, lista arquivos e diretorios excluidos do contexto de build enviado ao daemon Docker. Importante porque: (1) evita enviar node_modules, .git, .env (seguranca e velocidade), (2) previne que o cache seja invalidado desnecessariamente, (3) reduz o tamanho do contexto enviado ao daemon. Sempre adicionar: node_modules, .git, *.log, .env, dist.'
    },
    {
      front: 'Qual a diferenca entre tag e digest em uma referencia de imagem?',
      back: 'Tag (ex: v1.2.3): mutavel, pode ser sobrescrita apontando para um conteudo diferente. Digest (ex: @sha256:abc...): imutavel, e o hash SHA256 do conteudo da imagem. Se o conteudo mudar, o digest muda. Para reproducibilidade absoluta em producao, use digest. Obter com: docker inspect <imagem> --format "{{index .RepoDigests 0}}".'
    },
    {
      front: 'Quais estrategias de tagging sao recomendadas para producao?',
      back: 'Recomendadas: SemVer (v1.2.3) para releases, Git SHA (abc1234) para rastreabilidade de codigo, combinado branch+sha (main-abc1234) em CI/CD. EVITAR: "latest" em producao - e mutavel e pode causar versoes inconsistentes entre nodes do cluster. Em producao ideal: usar digest SHA256 ou SemVer com digest como fallback.'
    },
    {
      front: 'O que e a especificacao OCI e por que ela importa no Kubernetes?',
      back: 'OCI (Open Container Initiative) define padroes abertos para: Image Spec (formato de camadas e manifests), Runtime Spec (como criar e rodar containers, implementado pelo runc), Distribution Spec (API de registries). Importancia: qualquer runtime OCI-compativel (containerd, CRI-O) pode rodar imagens OCI, e ferramentas como Podman, Buildah ou kaniko geram imagens que rodam no Kubernetes sem modificacoes.'
    },
    {
      front: 'Como verificar vulnerabilidades em uma imagem de container antes de publicar?',
      back: 'Usar scanners de imagem: Trivy (open source, "trivy image myapp:v1"), Snyk, Grype. Eles verificam: CVEs em pacotes do SO e dependencias, segredos expostos, configuracoes inseguras (root, SUID). Integre no CI/CD: "trivy image --exit-code 1 --severity CRITICAL myapp:v1" falha o build se houver CVE critico. Em Kubernetes, use admission controllers (Kyverno/OPA) para rejeitar imagens com CVEs.'
    }
  ],

  lab: {
    scenario: 'Voce e responsavel por containerizar uma aplicacao Python Flask para o ambiente de producao. A aplicacao deve rodar com usuario nao-root, usar multi-stage build para minimizar o tamanho da imagem, e ser configurada para pull de um registry privado no Kubernetes.',
    objective: 'Criar um Dockerfile otimizado com multi-stage build, construir e publicar a imagem, deployar no Kubernetes com imagePullSecrets configurado corretamente, e verificar a politica de pull de imagens.',
    steps: [
      {
        title: 'Criar Dockerfile com Multi-Stage Build',
        instruction: `Crie um Dockerfile para uma aplicacao Python Flask com as seguintes caracteristicas:
- Estagio de build: instala dependencias
- Estagio final: imagem slim sem ferramentas desnecessarias
- Usuario nao-root (UID 1001)
- Health check configurado
- Variaveis de ambiente para producao
- .dockerignore configurado para excluir arquivos desnecessarios`,
        hints: [
          'Use python:3.11-slim como base em ambos os estagios',
          'Copie apenas o requirements.txt primeiro, instale deps, depois copie o codigo (otimiza cache)',
          'Use RUN adduser --disabled-password --gecos "" appuser para criar usuario nao-root',
          'HEALTHCHECK CMD curl -f http://localhost:8080/health || exit 1',
          'Crie .dockerignore com: __pycache__, *.pyc, .git, .env, *.log'
        ],
        solution: `\`\`\`dockerfile
# Estagio 1: instalacao de dependencias
FROM python:3.11-slim AS builder
WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir --target=/build/deps -r requirements.txt

# Estagio 2: imagem final de producao
FROM python:3.11-slim
WORKDIR /app

# Criar usuario nao-root
RUN adduser --disabled-password --gecos "" --uid 1001 appuser

# Copiar dependencias do estagio de build
COPY --from=builder /build/deps /usr/local/lib/python3.11/site-packages/

# Copiar codigo da aplicacao com ownership correto
COPY --chown=appuser:appuser . .

# Variaveis de ambiente
ENV PYTHONUNBUFFERED=1 \\
    PYTHONDONTWRITEBYTECODE=1 \\
    PORT=8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')" || exit 1

USER 1001
EXPOSE 8080
CMD ["python", "app.py"]
\`\`\`

\`\`\`bash
# Construir a imagem
docker build -t meu-registry.io/flask-app:v1.0.0 .

# Verificar tamanho das camadas
docker history meu-registry.io/flask-app:v1.0.0

# Verificar que roda como nao-root
docker run --rm meu-registry.io/flask-app:v1.0.0 id

# Inspecionar digest da imagem gerada
docker inspect meu-registry.io/flask-app:v1.0.0 --format '{{index .RepoDigests 0}}'

# Testar localmente
docker run --rm -p 8080:8080 meu-registry.io/flask-app:v1.0.0
\`\`\``
      },
      {
        title: 'Publicar imagem e configurar registry privado',
        instruction: `Autentique no registry privado, publique a imagem com tag semantica e git SHA, e crie o Secret do Kubernetes para autenticacao no registry privado.`,
        hints: [
          'Use docker login para autenticar no registry',
          'kubectl create secret docker-registry cria o secret no formato correto',
          'Verifique o secret criado com kubectl get secret <nome> -o jsonpath="{.data.\\.dockerconfigjson}" | base64 -d',
          'Publique com multiplas tags: versao semantica e git SHA para rastreabilidade'
        ],
        solution: `\`\`\`bash
# Autenticar no registry
docker login meu-registry.io -u meu-usuario -p minha-senha

# Publicar com tag semantica
docker push meu-registry.io/flask-app:v1.0.0

# Publicar tambem com git SHA para rastreabilidade
GIT_SHA=$(git rev-parse --short HEAD)
docker tag meu-registry.io/flask-app:v1.0.0 meu-registry.io/flask-app:\${GIT_SHA}
docker push meu-registry.io/flask-app:\${GIT_SHA}

# Criar Secret para autenticacao no Kubernetes
kubectl create secret docker-registry registry-creds \\
  --docker-server=meu-registry.io \\
  --docker-username=meu-usuario \\
  --docker-password=minha-senha \\
  --docker-email=dev@empresa.com \\
  --namespace=producao

# Verificar o secret foi criado
kubectl get secret registry-creds -n producao

# Inspecionar conteudo (confirmar server, username, password)
kubectl get secret registry-creds -n producao \\
  -o jsonpath="{.data.\\.dockerconfigjson}" | base64 -d | python3 -m json.tool

# Associar o secret a ServiceAccount default (aplica a todos os Pods)
kubectl patch serviceaccount default -n producao \\
  -p '{"imagePullSecrets": [{"name": "registry-creds"}]}'
\`\`\``
      },
      {
        title: 'Deployar no Kubernetes com imagePullSecrets',
        instruction: `Crie um Deployment no Kubernetes usando a imagem do registry privado, com imagePullSecrets configurado, limites de recursos definidos, e imagePullPolicy correto para producao.`,
        hints: [
          'Use imagePullPolicy: IfNotPresent para tags semanticas especificas',
          'Configure resources.requests e resources.limits para garantir QoS',
          'spec.imagePullSecrets e uma lista, nao um campo simples',
          'Verifique os eventos do Pod com kubectl describe pod se houver ImagePullBackOff',
          'Use securityContext no nivel do Pod para runAsNonRoot: true'
        ],
        solution: `\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: flask-app
  namespace: producao
  labels:
    app: flask-app
    version: v1.0.0
spec:
  replicas: 2
  selector:
    matchLabels:
      app: flask-app
  template:
    metadata:
      labels:
        app: flask-app
        version: v1.0.0
    spec:
      imagePullSecrets:
        - name: registry-creds
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
      containers:
        - name: flask-app
          image: meu-registry.io/flask-app:v1.0.0
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 8080
              name: http
          env:
            - name: PORT
              value: "8080"
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "256Mi"
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
\`\`\`

\`\`\`bash
# Aplicar o Deployment
kubectl apply -f deployment.yaml

# Verificar status do rollout
kubectl rollout status deployment/flask-app -n producao

# Se houver problema, verificar eventos do Pod
kubectl describe pod -l app=flask-app -n producao

# Ver logs do container
kubectl logs -l app=flask-app -n producao --tail=50

# Verificar imagePullPolicy efetivo
kubectl get pod -l app=flask-app -n producao -o jsonpath='{.items[0].spec.containers[0].imagePullPolicy}'
\`\`\``
      },
      {
        title: 'Verificar digest e politicas de seguranca',
        instruction: `Atualize o Deployment para usar o digest SHA256 da imagem em vez da tag semantica, garantindo reproducibilidade absoluta. Verifique que o container nao roda como root.`,
        hints: [
          'Obtenha o digest com: docker inspect --format "{{index .RepoDigests 0}}" ou kubectl describe pod e busque "Image ID"',
          'No YAML, substitua a tag pelo digest: image: registry/app@sha256:abc...',
          'kubectl exec para verificar o usuario corrente dentro do container',
          'kubectl auth can-i list pods --as=system:serviceaccount:producao:default para testar RBAC'
        ],
        solution: `\`\`\`bash
# Obter o digest da imagem publicada
DIGEST=$(docker inspect meu-registry.io/flask-app:v1.0.0 \\
  --format '{{index .RepoDigests 0}}' | cut -d@ -f2)
echo "Digest: $DIGEST"

# Verificar o digest diretamente no cluster (apos o Pod estar rodando)
kubectl get pod -l app=flask-app -n producao \\
  -o jsonpath='{.items[0].status.containerStatuses[0].imageID}'
\`\`\`

\`\`\`yaml
# Atualizar o Deployment para usar digest (100% imutavel)
# Substitua a linha de image no Deployment:
containers:
  - name: flask-app
    # Referencia imutavel por digest
    image: meu-registry.io/flask-app@sha256:32fdf92b4e986e109e4db0865758020cb0c3b70...
    imagePullPolicy: IfNotPresent
\`\`\`

\`\`\`bash
# Aplicar a atualizacao
kubectl apply -f deployment-digest.yaml

# Verificar que o Pod esta rodando como usuario correto (nao root)
kubectl exec -it -l app=flask-app -n producao -- id
# Esperado: uid=1001(appuser) gid=1001(appuser)

# Verificar securityContext no Pod
kubectl get pod -l app=flask-app -n producao \\
  -o jsonpath='{.items[0].spec.securityContext}'

# Confirmar que nao pode escalar privilegios
kubectl exec -it -l app=flask-app -n producao -- whoami
\`\`\``
      }
    ]
  },

  troubleshooting: [
    {
      title: 'Pod em ImagePullBackOff ao usar registry privado',
      symptom: 'kubectl get pods mostra STATUS "ImagePullBackOff" ou "ErrImagePull". kubectl describe pod mostra evento: "Failed to pull image: unauthorized: authentication required".',
      diagnosis: `**Passo 1: Verificar o evento detalhado do Pod**
\`\`\`bash
kubectl describe pod <nome-do-pod> -n <namespace>
# Procure na secao "Events" a mensagem de erro exata
# "unauthorized" = credenciais invalidas ou ausentes
# "not found" = imagem/repositorio nao existe
# "connection refused" = registry inacessivel
\`\`\`

**Passo 2: Confirmar que o Secret existe no namespace correto**
\`\`\`bash
kubectl get secret -n <namespace>
# O secret deve estar no MESMO namespace do Pod
# Secrets NAO sao compartilhados entre namespaces
\`\`\`

**Passo 3: Verificar o conteudo do Secret**
\`\`\`bash
kubectl get secret <nome-secret> -n <namespace> \\
  -o jsonpath="{.data.\\.dockerconfigjson}" | base64 -d
# Confirme que server, username e password estao corretos
# O server deve ser exatamente o mesmo prefixo da imagem
\`\`\`

**Passo 4: Verificar que o imagePullSecrets esta referenciando o nome correto**
\`\`\`bash
kubectl get pod <nome-pod> -n <namespace> -o jsonpath="{.spec.imagePullSecrets}"
# Nome deve ser identico ao do Secret
\`\`\`

**Passo 5: Testar credenciais manualmente**
\`\`\`bash
docker login <registry-server> -u <username> -p <password>
docker pull <imagem-completa>
\`\`\``,
      solution: `**Causa mais comum**: nome do secret no Pod nao corresponde ao secret real, ou credenciais expiradas.

**Recrear o Secret com credenciais corretas:**
\`\`\`bash
# Deletar o secret antigo
kubectl delete secret registry-creds -n <namespace>

# Recriar com credenciais corretas
kubectl create secret docker-registry registry-creds \\
  --docker-server=<REGISTRY_URL> \\
  --docker-username=<USERNAME> \\
  --docker-password=<PASSWORD> \\
  -n <namespace>
\`\`\`

**Se o secret estiver no namespace errado:**
\`\`\`bash
# Criar o secret no namespace correto do Pod
kubectl create secret docker-registry registry-creds \\
  --docker-server=<REGISTRY_URL> \\
  --docker-username=<USERNAME> \\
  --docker-password=<PASSWORD> \\
  -n <namespace-do-pod>
\`\`\`

**Forcar o Pod a fazer novo pull apos correcao:**
\`\`\`bash
kubectl rollout restart deployment/<nome-deployment> -n <namespace>
\`\`\``
    },
    {
      title: 'Pod com imagePullPolicy errado causando versao desatualizada',
      symptom: 'Apos publicar uma nova versao da imagem com a mesma tag (ex: :latest ou :staging), o Pod continua executando a versao antiga. kubectl describe pod mostra que a imagem esta sendo usada mas o codigo e o antigo.',
      diagnosis: `**Passo 1: Verificar qual imagePullPolicy esta configurado**
\`\`\`bash
kubectl get pod <nome-pod> -o jsonpath='{.spec.containers[0].imagePullPolicy}'
# Se for IfNotPresent e a tag for mutavel (latest, staging), o pull nao sera feito
\`\`\`

**Passo 2: Verificar qual imagem esta sendo usada de fato**
\`\`\`bash
# Ver o Image ID real (inclui o digest)
kubectl get pod <nome-pod> -o jsonpath='{.status.containerStatuses[0].imageID}'

# Comparar com o digest atual no registry
docker pull <imagem>:<tag> && docker inspect <imagem>:<tag> --format '{{index .RepoDigests 0}}'
\`\`\`

**Passo 3: Verificar se a tag e mutavel**
\`\`\`bash
# Tags mutaveis comuns: latest, main, staging, develop, production
kubectl get deployment <nome> -o jsonpath='{.spec.template.spec.containers[0].image}'
\`\`\``,
      solution: `**Para tags mutaveis, use imagePullPolicy: Always:**
\`\`\`bash
kubectl set image deployment/<nome> <container>=<registry>/<image>:<tag>
kubectl patch deployment/<nome> -p '{"spec":{"template":{"spec":{"containers":[{"name":"<container>","imagePullPolicy":"Always"}]}}}}'
\`\`\`

**Solucao definitiva: usar digest ou tags imutaveis em producao:**
\`\`\`yaml
# Em vez de tag mutavel
image: meu-registry.io/app:latest  # EVITAR em producao

# Use tag semantica imutavel
image: meu-registry.io/app:v1.2.3

# Ou melhor ainda: digest SHA256
image: meu-registry.io/app@sha256:abc123...
\`\`\`

**Forcar update imediato (quando tag mutavel e necessaria):**
\`\`\`bash
# Restart force o pull da imagem (com imagePullPolicy: Always)
kubectl rollout restart deployment/<nome> -n <namespace>

# Monitorar o rollout
kubectl rollout status deployment/<nome> -n <namespace>
\`\`\``
    },
    {
      title: 'Imagem muito grande causando lentidao no escalonamento',
      symptom: 'Novos Pods demoram muito para iniciar (varios minutos). kubectl describe pod mostra o container em estado "ContainerCreating" por longo periodo. O cluster nao consegue escalar rapidamente durante picos de trafego.',
      diagnosis: `**Passo 1: Verificar o tamanho da imagem**
\`\`\`bash
# No node (ou localmente)
docker images <imagem>:<tag> --format "{{.Size}}"

# Ver tamanho de cada camada
docker history <imagem>:<tag>
\`\`\`

**Passo 2: Verificar eventos do Pod durante o pull**
\`\`\`bash
kubectl describe pod <nome-pod>
# Procure eventos como:
# "Pulling image" -> "Successfully pulled image"
# O tempo entre esses eventos mostra quanto tempo o pull levou
\`\`\`

**Passo 3: Verificar se a imagem ja esta em cache nos nodes**
\`\`\`bash
# Verificar imagens em cache em um node especifico
kubectl debug node/<nome-node> -it --image=busybox -- crictl images | grep <nome-imagem>

# Verificar uso de disco nos nodes
kubectl top nodes
\`\`\``,
      solution: `**Reducao imediata de tamanho com multi-stage build:**
\`\`\`dockerfile
# Antes: imagem node completa (~1GB)
FROM node:20
WORKDIR /app
COPY . .
RUN npm install && npm run build

# Depois: multi-stage (~200MB -> ~50MB com alpine)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
USER node
CMD ["node", "dist/main.js"]
\`\`\`

**Pre-pull de imagens nos nodes (DaemonSet):**
\`\`\`yaml
# Usar image pull via DaemonSet para pre-aquecer o cache
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: image-prepull
spec:
  selector:
    matchLabels:
      app: image-prepull
  template:
    metadata:
      labels:
        app: image-prepull
    spec:
      initContainers:
        - name: pull-app-image
          image: meu-registry.io/app:v1.2.3
          command: ["sh", "-c", "echo imagem em cache"]
          resources:
            requests:
              cpu: "10m"
              memory: "16Mi"
            limits:
              cpu: "50m"
              memory: "32Mi"
      containers:
        - name: pause
          image: gcr.io/google_containers/pause:3.9
          resources:
            requests:
              cpu: "1m"
              memory: "8Mi"
\`\`\`

**Verificar reducao de tamanho apos otimizacao:**
\`\`\`bash
docker build -t meu-registry.io/app:v2.0.0 .
docker images meu-registry.io/app --format "table {{.Tag}}\\t{{.Size}}"
\`\`\``
    }
  ]
};
