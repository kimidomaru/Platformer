window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['docker/docker-compose'] = {
  theory: `
# Docker Compose para DevOps

## Relevancia
Docker Compose e a ferramenta padrao para orquestrar stacks multi-container localmente e em pipelines CI/CD. E o passo intermediario entre "docker run" e Kubernetes — entender Compose bem ajuda a entender deployments, services e configmaps do K8s.

## O que e Docker Compose

Docker Compose define e executa aplicacoes multi-container usando um arquivo YAML declarativo. Uma stack tipica de DevOps inclui app + banco de dados + cache + proxy reverso — tudo orquestrado com um unico \`docker compose up\`.

\`\`\`yaml
# Anatomia do docker-compose.yml
version: "3.9"          # versao do schema (use 3.x)
services:               # containers que compoem a stack
  api:                  # nome do servico
    image: myapp:v1     # OU build: ./
    ports: [...]        # mapeamento de portas
    environment: [...]  # variaveis de ambiente
    depends_on: [...]   # dependencias
    volumes: [...]      # montagens
    networks: [...]     # redes
volumes: {}             # volumes nomeados
networks: {}            # redes customizadas
\`\`\`

## Sintaxe Essencial

### Servicos: build vs image

\`\`\`yaml
services:
  # Opção 1: usar imagem pre-buildada
  database:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: \${DB_PASSWORD}  # do arquivo .env

  # Opção 2: buildar do Dockerfile local
  api:
    build:
      context: ./api              # diretorio com Dockerfile
      dockerfile: Dockerfile      # nome (opcional, default: Dockerfile)
      args:
        BUILD_ENV: production
    image: myapp/api:latest       # nome para a imagem buildada
\`\`\`

### Portas, volumes e redes

\`\`\`yaml
services:
  api:
    ports:
      - "8080:8080"           # host:container
      - "127.0.0.1:9090:9090" # bind apenas no localhost (mais seguro)

    volumes:
      - api-data:/app/data      # volume nomeado (persistente)
      - ./config:/app/config:ro # bind mount (read-only)
      - /tmp/logs:/app/logs     # bind mount absoluto

    networks:
      - backend
      - frontend

volumes:
  api-data:
    driver: local
    # Para cloud: driver: rexray/ebs (AWS EBS)

networks:
  backend:
    driver: bridge
    internal: true     # sem acesso externo (seguranca)
  frontend:
    driver: bridge
\`\`\`

### depends_on e healthcheck

\`\`\`yaml
services:
  api:
    depends_on:
      database:
        condition: service_healthy  # aguarda healthcheck passar
      cache:
        condition: service_started  # aguarda apenas iniciar

  database:
    image: postgres:15-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${POSTGRES_USER} -d \${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s    # tempo inicial antes de contar falhas

  cache:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 3
\`\`\`

### Environment variables e .env

\`\`\`yaml
# docker-compose.yml
services:
  api:
    environment:
      # Opcao 1: valor direto (evitar senhas aqui)
      LOG_LEVEL: info
      APP_ENV: production

      # Opcao 2: substituicao do .env (\${VAR} ou $VAR)
      DATABASE_URL: postgres://\${DB_USER}:\${DB_PASSWORD}@database:5432/\${DB_NAME}
      SECRET_KEY: \${APP_SECRET_KEY}

      # Opcao 3: herdar do ambiente do host
      AWS_ACCESS_KEY_ID:   # sem valor = herda do host
      AWS_SECRET_ACCESS_KEY:

    env_file:
      - .env              # arquivo padrao
      - .env.local        # overrides locais (no .gitignore)
\`\`\`

\`\`\`bash
# .env (commitar sem segredos)
DB_USER=myapp
DB_NAME=myapp_db
APP_ENV=development
LOG_LEVEL=debug

# .env.local (NAO commitar — adicionar ao .gitignore)
DB_PASSWORD=supersecret123
APP_SECRET_KEY=dev-key-change-in-prod
\`\`\`

### Profiles — servicos opcionais

\`\`\`yaml
services:
  api:
    image: myapp:latest
    # sem profile = sempre sobe

  database:
    image: postgres:15-alpine
    # sem profile = sempre sobe

  adminer:
    image: adminer:latest
    profiles: ["tools"]    # so sobe com --profile tools
    ports: ["8081:8080"]

  tests:
    build: ./tests
    profiles: ["ci"]       # so sobe no CI
    depends_on: [api, database]
    command: pytest

# Uso:
# docker compose up                    # sobe api + database
# docker compose --profile tools up    # + adminer
# docker compose --profile ci up       # + tests
\`\`\`

## Override de Configuracao por Ambiente

\`\`\`bash
# Estrutura recomendada
docker-compose.yml           # base (compartilhado)
docker-compose.override.yml  # dev (carregado automaticamente)
docker-compose.prod.yml      # prod (especificado explicitamente)
docker-compose.ci.yml        # CI/CD
\`\`\`

\`\`\`yaml
# docker-compose.yml (base)
services:
  api:
    image: myapp/api
    environment:
      DATABASE_URL: postgres://\${DB_USER}:\${DB_PASSWORD}@database:5432/\${DB_NAME}
    depends_on:
      database:
        condition: service_healthy

  database:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: \${DB_NAME}
      POSTGRES_USER: \${DB_USER}
      POSTGRES_PASSWORD: \${DB_PASSWORD}
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  db-data:
\`\`\`

\`\`\`yaml
# docker-compose.override.yml (dev — merge automatico)
services:
  api:
    build: ./api              # em dev, build local
    volumes:
      - ./api/src:/app/src    # hot reload
    ports:
      - "8080:8080"
    environment:
      LOG_LEVEL: debug

  database:
    ports:
      - "5432:5432"           # expor porta para ferramentas externas em dev
\`\`\`

\`\`\`yaml
# docker-compose.prod.yml (prod)
services:
  api:
    image: myregistry.io/myapp/api:v1.2.3  # imagem especifica de prod
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: "1.0"
          memory: 512M
    restart: unless-stopped
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
\`\`\`

\`\`\`bash
# Usar arquivo especifico de prod
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
\`\`\`

## Comandos Essenciais

\`\`\`bash
# Subir a stack
docker compose up -d          # background (detached)
docker compose up --build     # force rebuild das imagens
docker compose up api         # subir apenas um servico

# Status e logs
docker compose ps             # status de todos os servicos
docker compose logs -f api    # logs do servico api (follow)
docker compose logs --tail 50 # ultimas 50 linhas de todos

# Executar comandos
docker compose exec api bash            # shell no servico api
docker compose exec database psql -U admin -d myapp
docker compose run --rm api pytest      # run one-off (remove apos executar)

# Gerenciamento
docker compose stop           # para sem remover
docker compose down           # para e remove containers (mantem volumes)
docker compose down -v        # para, remove containers E volumes
docker compose restart api    # reiniciar servico especifico

# Escalar
docker compose up --scale api=3  # 3 replicas do api

# Inspecao
docker compose config         # mostrar config final (apos merge de overrides)
docker compose top            # processos em todos os servicos
\`\`\`

## Stack Real: API + PostgreSQL + Redis + Nginx

\`\`\`yaml
# docker-compose.yml — stack completa de exemplo
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/certs:/etc/nginx/certs:ro
    depends_on:
      - api
    networks:
      - frontend

  api:
    build:
      context: .
      target: production      # multi-stage build target
    environment:
      DATABASE_URL: postgres://\${DB_USER}:\${DB_PASSWORD}@database:5432/\${DB_NAME}
      REDIS_URL: redis://cache:6379/0
      SECRET_KEY: \${SECRET_KEY}
    depends_on:
      database:
        condition: service_healthy
      cache:
        condition: service_healthy
    networks:
      - frontend
      - backend
    restart: unless-stopped
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  database:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: \${DB_NAME}
      POSTGRES_USER: \${DB_USER}
      POSTGRES_PASSWORD: \${DB_PASSWORD}
    volumes:
      - db-data:/var/lib/postgresql/data
      - ./database/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    networks:
      - backend
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${DB_USER} -d \${DB_NAME}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  cache:
    image: redis:7-alpine
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - cache-data:/data
    networks:
      - backend
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 3
    restart: unless-stopped

volumes:
  db-data:
  cache-data:

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true   # database e cache sem acesso externo
\`\`\`

## Erros Comuns

1. **Race condition em depends_on** — usar apenas \`condition: service_started\` nao garante que o servico esta pronto; use \`service_healthy\` com healthcheck real
2. **Secrets no docker-compose.yml** — senhas hardcoded, nao usar \${VAR} do .env
3. **Volumes nao montados** — path relativo vs absoluto; verificar com \`docker compose config\`
4. **Conflito de portas** — outro servico usando a mesma porta no host
5. **Rede isolada ignorada** — usar \`internal: true\` em redes de backend para seguranca

## Killer.sh Style Challenge

> **Cenario:** Voce tem uma aplicacao com 3 servicos (API Python, PostgreSQL, Redis). O time reclama que em dev os testes falham porque a API tenta conectar no banco antes dele estar pronto. Crie um docker-compose.yml com healthchecks corretos e depends_on com \`condition: service_healthy\`. Adicione um servico \`tests\` com profile \`ci\` que so executa quando explicitamente chamado.
`,
  quiz: [
    {
      question: 'Por que `depends_on` com apenas `condition: service_started` nao resolve race conditions em aplicacoes?',
      options: [
        'depends_on e ignorado pelo Docker em versoes recentes',
        '`service_started` garante apenas que o container iniciou — nao que o processo dentro esta pronto para aceitar conexoes. O PostgreSQL, por exemplo, pode levar segundos apos iniciar ate aceitar conexoes',
        'depends_on so funciona com condition: service_healthy',
        'depends_on apenas controla a ordem de criacao, nao de inicializacao'
      ],
      correct: 1,
      explanation: '`service_started` significa apenas que o container foi criado e iniciou. O processo interno (PostgreSQL, Redis, etc.) pode ainda estar inicializando. Para garantir que o servico esta realmente pronto, configure um `healthcheck` no servico dependido e use `condition: service_healthy` — assim o Docker aguarda o healthcheck passar antes de iniciar o servico dependente.',
      reference: 'Padrao correto: healthcheck com pg_isready (Postgres), redis-cli ping (Redis), ou curl do endpoint /health (HTTP).'
    },
    {
      question: 'Qual e o proposito dos arquivos docker-compose.override.yml e como eles funcionam?',
      options: [
        'Override e um arquivo de backup criado automaticamente pelo Docker',
        'docker-compose.override.yml e automaticamente mergeado com docker-compose.yml quando presente — permite ter configuracoes base compartilhadas e overrides por ambiente (dev, prod, ci) sem duplicar toda a configuracao',
        'Override arquivos so sao usados com o flag -f explicitamente',
        'Apenas um arquivo override pode existir por projeto'
      ],
      correct: 1,
      explanation: 'O Docker Compose tem merge automatico: ao executar `docker compose up`, ele carrega `docker-compose.yml` e, se existir, faz merge com `docker-compose.override.yml`. Para outros arquivos (prod, ci), usa-se `docker compose -f docker-compose.yml -f docker-compose.prod.yml`. O merge e inteligente: listas sao concatenadas, mappings sao merged, values escalares sao sobrescritos.',
      reference: 'Estrutura recomendada: docker-compose.yml (base) + docker-compose.override.yml (dev, auto-mergeado) + docker-compose.prod.yml (prod, explícito).'
    },
    {
      question: 'Como funciona a substituicao de variaveis no docker-compose.yml e qual e a ordem de precedencia?',
      options: [
        'Apenas variaveis do arquivo .env sao suportadas',
        'A ordem de precedencia e: variaveis do shell > arquivo .env > valor default no compose (${VAR:-default}) — variaveis definidas no shell sobrescrevem o .env',
        'Variaveis no arquivo .env sempre sobrescrevem as do shell',
        'So ${VAR} e suportado, nao $VAR'
      ],
      correct: 1,
      explanation: 'O Docker Compose resolve variaveis na ordem: 1) variavel de ambiente do shell (maior prioridade), 2) arquivo .env no mesmo diretorio, 3) valor default definido na sintaxe ${VAR:-default}. Isso permite: valores padrao no .env para dev, e overrides via variaveis de ambiente no CI/CD (export DB_PASSWORD=... antes do docker compose up).',
      reference: 'Dica CI/CD: defina variaveis sensiveis como segredos do CI (GitHub Actions secrets) e exporte-as antes de rodar docker compose.'
    },
    {
      question: 'O que faz `docker compose run --rm api pytest` diferente de `docker compose exec api pytest`?',
      options: [
        'run e exec sao identicos',
        '`exec` executa em um container JA EM EXECUCAO; `run` cria um NOVO container especificamente para aquele comando e o remove com --rm — ideal para tarefas one-off como migrations e testes',
        '`run` e mais rapido pois nao cria um novo container',
        '`exec` so funciona com bash/sh, `run` funciona com qualquer comando'
      ],
      correct: 1,
      explanation: '`docker compose exec` roda um comando em um container que ja esta em execucao — o servico precisa estar rodando. `docker compose run` cria um container novo, especificamente para rodar aquele comando, e com `--rm` remove o container ao terminar. Isso e ideal para: migrations de banco (run --rm api python manage.py migrate), testes (run --rm tests pytest), e scripts de manutencao.',
      reference: 'Padrao comum: `docker compose run --rm api python manage.py migrate` para migrations em CI/CD antes de subir a aplicacao.'
    },
    {
      question: 'Para que servem os `profiles` no Docker Compose e quando usar?',
      options: [
        'Profiles definem o nivel de log dos servicos',
        'Profiles agrupam servicos opcionais que so sobem quando o profile e especificado — permite ter servicos de dev (adminer, mailhog), ci (testes) e ferramentas na mesma composefile sem sempre rodar todos',
        'Profiles definem resource limits por ambiente',
        'Profiles so funcionam com Docker Swarm'
      ],
      correct: 1,
      explanation: 'Profiles permitem marcar servicos como opcionais. Servicos sem profile sempre sobem. Servicos com `profiles: ["tools"]` so sobem quando executado `docker compose --profile tools up`. Caso de uso: adminer (GUI do banco), mailhog (email fake), servico de testes — todos uteis em momentos especificos mas nao no dia-a-dia.',
      reference: 'Uso no CI: `docker compose --profile ci run tests` para rodar apenas os testes sem subir toda a stack de dev.'
    },
    {
      question: 'Por que usar `networks: internal: true` para a rede de banco de dados em producao?',
      options: [
        'Networks internas sao mais rapidas',
        'Uma network com `internal: true` nao tem rota para o mundo externo — o container do banco de dados nao consegue fazer requisicoes externas nem ser acessado por fora da network, reduzindo a superficie de ataque',
        'Networks internas evitam conflitos de porta',
        'Containers em networks internas nao precisam de autenticacao'
      ],
      correct: 1,
      explanation: 'Networks com `internal: true` no Docker sao completamente isoladas: nenhum container nessa rede pode acessar a internet ou ser acessado externamente. Para banco de dados e cache em producao, isso e uma camada de seguranca importante — mesmo que alguem invada o container, ele nao pode exfiltrar dados para um servidor externo.',
      reference: 'Arquitetura recomendada: nginx + api na rede frontend; api + database + cache na rede backend (internal: true). Nginx e a unica entrada externa.'
    },
    {
      question: 'Qual e a diferenca entre `docker compose down` e `docker compose down -v`?',
      options: [
        'Nao ha diferenca — ambos removem tudo',
        '`down` para e remove containers e redes criadas, mas preserva volumes nomeados; `down -v` tambem remove os volumes — CUIDADO: isso apaga os dados do banco em dev',
        '`down -v` e necessario para remover imagens buildadas',
        '`down` e para desenvolvimento, `down -v` e para producao'
      ],
      correct: 1,
      explanation: '`docker compose down` para os containers, remove os containers e as redes criadas pelo Compose — mas preserva os volumes nomeados (o banco de dados sobrevive). `docker compose down -v` tambem remove os volumes nomeados (db-data, cache-data) — apagando todos os dados. Util para comecar do zero em dev, mas NUNCA em producao.',
      reference: 'Dica: antes de `down -v`, sempre fazer backup com `docker exec database pg_dump ... > backup.sql`.'
    }
  ],
  flashcards: [
    {
      front: 'depends_on com healthcheck — padrao correto',
      back: '**Problema:** depends_on so com `service_started` = race condition\n\n**Solucao completa:**\n\`\`\`yaml\nservices:\n  api:\n    depends_on:\n      database:\n        condition: service_healthy  # aguarda healthcheck\n\n  database:\n    image: postgres:15-alpine\n    healthcheck:\n      test: ["CMD-SHELL",\n        "pg_isready -U \${DB_USER} -d \${DB_NAME}"]\n      interval: 10s\n      timeout: 5s\n      retries: 5\n      start_period: 30s  # tempo para inicializar\n\`\`\`\n\n**Healthchecks comuns:**\n- PostgreSQL: `pg_isready -U user -d db`\n- Redis: `redis-cli ping`\n- HTTP: `curl -f http://localhost:8080/health`\n- MySQL: `mysqladmin ping -h localhost`'
    },
    {
      front: 'Estrutura de override por ambiente',
      back: '**Arquivos:**\n```\ndocker-compose.yml          ← base\ndocker-compose.override.yml ← dev (auto-merge)\ndocker-compose.prod.yml     ← prod (explicito)\ndocker-compose.ci.yml       ← CI (explicito)\n```\n\n**Uso:**\n```bash\n# Dev (merge automatico)\ndocker compose up\n\n# Prod (explicito)\ndocker compose \\\n  -f docker-compose.yml \\\n  -f docker-compose.prod.yml up -d\n\n# CI\ndocker compose \\\n  -f docker-compose.yml \\\n  -f docker-compose.ci.yml run tests\n```\n\n**Regras de merge:**\n- Scalars: override sobrescreve\n- Lists: concatenadas\n- Mappings: merged recursivamente\n- volumes/ports: adicionados\n\n**Validar merge:**\n```bash\ndocker compose config  # mostra config final\n```'
    },
    {
      front: 'Variaveis de ambiente — precedencia e seguranca',
      back: '**Precedencia (maior para menor):**\n1. Shell environment (`export VAR=val`)\n2. Arquivo `.env` no diretorio\n3. Default no compose (`\${VAR:-default}`)\n\n**Boas praticas de seguranca:**\n```bash\n# .env (commitar - valores de dev)\nDB_USER=myapp\nDB_NAME=myapp\nLOG_LEVEL=debug\n\n# .env.local (NAO commitar)\nDB_PASSWORD=secret\nSECRET_KEY=dev-key\n```\n\n```yaml\n# .gitignore\n.env.local\n.env.production\n*.env.local\n```\n\n**Em CI/CD (GitHub Actions):**\n```yaml\n- run: docker compose up -d\n  env:\n    DB_PASSWORD: \${{ secrets.DB_PASSWORD }}\n    SECRET_KEY: \${{ secrets.APP_SECRET }}\n```\n\n**Verificar variaveis resolvidas:**\n```bash\ndocker compose config  # mostra valores finais\n```'
    },
    {
      front: 'Profiles — servicos opcionais por contexto',
      back: '**Definicao:**\n```yaml\nservices:\n  api:\n    image: myapp  # sempre sobe\n\n  adminer:\n    image: adminer\n    profiles: ["tools"]  # so com --profile tools\n\n  tests:\n    build: ./tests\n    profiles: ["ci"]     # so no CI\n```\n\n**Uso:**\n```bash\n# Apenas servicos sem profile\ndocker compose up\n\n# Com ferramentas\ndocker compose --profile tools up\n\n# CI\ndocker compose --profile ci run tests\n\n# Multiplos profiles\ndocker compose --profile tools --profile monitoring up\n```\n\n**Casos de uso:**\n- `tools`: adminer, mailhog, redis-commander\n- `ci`: servico de testes, linters\n- `monitoring`: prometheus, grafana local\n- `seed`: populacao inicial do banco'
    },
    {
      front: 'Networks no Compose — isolamento e seguranca',
      back: '**Tipos:**\n```yaml\nnetworks:\n  frontend:\n    driver: bridge     # padrao\n  backend:\n    driver: bridge\n    internal: true     # sem acesso externo!\n```\n\n**Arquitetura segura:**\n```\nInternet\n   ↓\n[nginx]\n   ↓ frontend network\n[api]\n   ↓ backend network (internal: true)\n[database] [cache]\n```\n\n**Beneficios do internal: true:**\n- DB nao acessa internet\n- DB nao e acessivel externamente\n- Container comprometido nao exfiltra dados\n\n**DNS interno:**\n- Servicos se comunicam pelo nome\n- `api` → `http://database:5432`\n- `api` → `redis://cache:6379`\n- Nao precisa de IP fixo!\n\n**Inspecionar:**\n```bash\ndocker network ls\ndocker network inspect projeto_backend\n```'
    },
    {
      front: 'Comandos essenciais do Docker Compose',
      back: '**Ciclo de vida:**\n```bash\ndocker compose up -d           # subir\ndocker compose up --build      # rebuild + subir\ndocker compose stop            # parar (manter containers)\ndocker compose down            # remover containers\ndocker compose down -v         # remover + volumes\ndocker compose restart api     # reiniciar servico\n```\n\n**Monitoramento:**\n```bash\ndocker compose ps              # status\ndocker compose logs -f api     # logs follow\ndocker compose top             # processos\ndocker compose stats           # uso de recursos\n```\n\n**Execucao:**\n```bash\n# Em container rodando\ndocker compose exec api bash\ndocker compose exec db psql -U admin\n\n# Novo container one-off\ndocker compose run --rm api pytest\ndocker compose run --rm api python manage.py migrate\n```\n\n**Debug:**\n```bash\ndocker compose config          # config mergeada final\ndocker compose config --services  # lista servicos\n```'
    }
  ],
  lab: {
    scenario: 'Voce precisa criar uma stack Docker Compose para uma aplicacao web com API Python (Flask), banco PostgreSQL, e cache Redis. A stack deve ter healthchecks corretos, variaveis de ambiente via .env, e ser dividida entre configuracoes base e override de desenvolvimento.',
    objective: 'Criar uma stack Docker Compose completa com healthchecks, .env, redes isoladas, e arquivos de override por ambiente.',
    duration: '20-30 minutos',
    steps: [
      {
        title: 'Criar a estrutura base do projeto e .env',
        instruction: `Crie a estrutura de diretorios e os arquivos de configuracao base, incluindo o .env com variaveis de ambiente.`,
        hints: [
          'Separe variaveis "publicas" (DB_NAME, LOG_LEVEL) do .env de variaveis sensiveis (.env.local)',
          'Use nomes de variaveis descritivos e consistentes',
          'Adicione .env.local ao .gitignore imediatamente'
        ],
        solution: `\`\`\`bash
# Criar estrutura do projeto
mkdir compose-lab && cd compose-lab
mkdir -p api database

# Criar .env (valores de dev — pode commitar)
cat > .env << 'EOF'
# Database
DB_NAME=devapp
DB_USER=devuser
DB_HOST=database
DB_PORT=5432

# Redis
REDIS_HOST=cache
REDIS_PORT=6379

# App
APP_ENV=development
LOG_LEVEL=debug
APP_PORT=8080
EOF

# Criar .env.local (senhas — NAO commitar!)
cat > .env.local << 'EOF'
DB_PASSWORD=dev-password-local
APP_SECRET_KEY=dev-secret-local-change-me
EOF

# .gitignore
cat > .gitignore << 'EOF'
.env.local
.env.production
.env.*.local
*.pyc
__pycache__/
EOF

# Criar uma app Flask simples
cat > api/app.py << 'EOF'
from flask import Flask, jsonify
import os
import psycopg2
import redis

app = Flask(__name__)

@app.route('/health')
def health():
    return jsonify({"status": "ok", "env": os.getenv("APP_ENV")})

@app.route('/db-check')
def db_check():
    try:
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST"),
            database=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD")
        )
        conn.close()
        return jsonify({"db": "connected"})
    except Exception as e:
        return jsonify({"db": "error", "message": str(e)}), 500

@app.route('/cache-check')
def cache_check():
    try:
        r = redis.Redis(host=os.getenv("REDIS_HOST"), port=6379)
        r.ping()
        return jsonify({"cache": "connected"})
    except Exception as e:
        return jsonify({"cache": "error", "message": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)
EOF

cat > api/requirements.txt << 'EOF'
flask==3.0.0
psycopg2-binary==2.9.9
redis==5.0.1
gunicorn==21.2.0
EOF

cat > api/Dockerfile << 'EOF'
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .
RUN useradd --uid 1001 --create-home appuser
USER appuser
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s CMD python -c \
  "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')" || exit 1
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "app:app"]
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verificar estrutura criada
ls -la
ls api/

# Verificar arquivos
cat .env
cat api/requirements.txt

# Verificar .gitignore protege senhas
grep ".env.local" .gitignore && echo ".env.local esta no .gitignore ✓" || echo "AVISO: .env.local NAO esta no .gitignore!"
\`\`\``
      },
      {
        title: 'Criar docker-compose.yml base com healthchecks',
        instruction: `Crie o arquivo docker-compose.yml com os tres servicos (api, database, cache), healthchecks corretos, e redes isoladas.`,
        hints: [
          'Use condition: service_healthy no depends_on da API',
          'Configure healthchecks especificos para PostgreSQL (pg_isready) e Redis (redis-cli ping)',
          'Coloque database e cache na rede backend com internal: true'
        ],
        solution: `\`\`\`bash
cat > docker-compose.yml << 'EOF'
services:
  api:
    build: ./api
    env_file:
      - .env
      - .env.local
    depends_on:
      database:
        condition: service_healthy
      cache:
        condition: service_healthy
    networks:
      - frontend
      - backend
    restart: unless-stopped

  database:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: \${DB_NAME}
      POSTGRES_USER: \${DB_USER}
      POSTGRES_PASSWORD: \${DB_PASSWORD}
    env_file:
      - .env
      - .env.local
    volumes:
      - db-data:/var/lib/postgresql/data
    networks:
      - backend
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${DB_USER} -d \${DB_NAME}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    restart: unless-stopped

  cache:
    image: redis:7-alpine
    command: redis-server --maxmemory 128mb --maxmemory-policy allkeys-lru
    volumes:
      - cache-data:/data
    networks:
      - backend
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 3
    restart: unless-stopped

volumes:
  db-data:
  cache-data:

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true
EOF

# Validar a config
docker compose config
echo "Config valida!"
\`\`\``,
        verify: `\`\`\`bash
# Verificar que o arquivo foi criado
ls -la docker-compose.yml

# Validar sintaxe
docker compose config > /dev/null && echo "Sintaxe OK ✓"

# Verificar que internal: true esta configurado
docker compose config | grep -A2 "backend:"

# Subir a stack
docker compose up -d

# Aguardar healthchecks
sleep 15
docker compose ps
# Saida esperada: todos os servicos "healthy" ou "running"
\`\`\``
      },
      {
        title: 'Criar docker-compose.override.yml para desenvolvimento',
        instruction: `Crie o arquivo override de desenvolvimento com: hot reload da API, portas expostas para ferramentas locais, e um servico adminer com profile "tools".`,
        hints: [
          'No override, adicione volumes de bind mount para hot reload',
          'Exponha a porta do banco apenas no override (nao no base)',
          'Use profiles: ["tools"] para o adminer'
        ],
        solution: `\`\`\`bash
cat > docker-compose.override.yml << 'EOF'
# Override automatico para desenvolvimento
services:
  api:
    ports:
      - "8080:8080"         # expor porta em dev
    environment:
      FLASK_ENV: development
      FLASK_DEBUG: "1"
    volumes:
      - ./api:/app          # hot reload do codigo

  database:
    ports:
      - "5432:5432"         # acessivel por ferramentas locais (DBeaver, etc.)

  cache:
    ports:
      - "6379:6379"         # acessivel por redis-cli local

  # Servico opcional com profile
  adminer:
    image: adminer:latest
    profiles: ["tools"]
    ports:
      - "8081:8080"
    networks:
      - backend
    environment:
      ADMINER_DEFAULT_SERVER: database
EOF

# Verificar merge final das configs
docker compose config

# Subir com override (automatico)
docker compose up -d

# Verificar status
docker compose ps

# Testar endpoints
sleep 10
curl -s http://localhost:8080/health | python3 -m json.tool
curl -s http://localhost:8080/db-check | python3 -m json.tool
curl -s http://localhost:8080/cache-check | python3 -m json.tool
\`\`\``,
        verify: `\`\`\`bash
# Verificar que todos os servicos estao rodando
docker compose ps
# Saida esperada: api, database, cache - todos UP e healthy

# Testar health endpoint
curl -sf http://localhost:8080/health
# Saida esperada: {"status": "ok", "env": "development"}

# Testar conexao com banco
curl -sf http://localhost:8080/db-check
# Saida esperada: {"db": "connected"}

# Testar adminer com profile
docker compose --profile tools up -d adminer
sleep 3
curl -sf http://localhost:8081 -o /dev/null -w "%{http_code}" | grep -q "200\|302" && echo "Adminer OK ✓"

# Limpar
docker compose --profile tools down
docker compose down -v
echo "Lab completo!"
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Servico falha ao conectar no banco mesmo com depends_on',
      difficulty: 'medium',
      symptom: 'A API inicia e imediatamente tenta conectar no PostgreSQL, mas falha com "connection refused" ou "role does not exist", mesmo com `depends_on: database` configurado.',
      diagnosis: `\`\`\`bash
# 1. Verificar o status dos servicos
docker compose ps
# O database pode estar "starting" nao "healthy"

# 2. Verificar healthcheck do database
docker compose logs database | tail -20
docker inspect \$(docker compose ps -q database) | jq '.[].State.Health'

# 3. Verificar se healthcheck esta configurado no compose
docker compose config | grep -A 10 "healthcheck"

# 4. Ver o exit code da api
docker compose ps api
# Se "Exited", a api tentou conectar antes do banco estar pronto
\`\`\``,
      solution: `**Causa:** depends_on sem healthcheck = race condition

**Solucao — adicionar healthcheck ao database:**
\`\`\`yaml
services:
  api:
    depends_on:
      database:
        condition: service_healthy  # era: service_started

  database:
    image: postgres:15-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${DB_USER} -d \${DB_NAME}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s  # importante para postgres inicializar
\`\`\`

**Alternativa — retry na aplicacao:**
\`\`\`python
import time
import psycopg2

def connect_with_retry(max_retries=5):
    for i in range(max_retries):
        try:
            return psycopg2.connect(...)
        except psycopg2.OperationalError:
            if i < max_retries - 1:
                time.sleep(2 ** i)  # backoff exponencial
    raise Exception("Could not connect to database")
\`\`\`

**Verificar apos corrigir:**
\`\`\`bash
docker compose down && docker compose up -d
docker compose ps  # aguardar api ficar "healthy"
\`\`\``
    },
    {
      title: 'Variaveis de ambiente nao sao substituidas corretamente',
      difficulty: 'easy',
      symptom: 'No docker-compose.yml, as variaveis ${DB_PASSWORD} aparecem literalmente no container ou ficam vazias. `docker compose config` mostra "null" ou o texto bruto da variavel.',
      diagnosis: `\`\`\`bash
# 1. Verificar se o .env existe no diretorio correto
ls -la .env
# DEVE estar no mesmo diretorio do docker-compose.yml

# 2. Ver quais variaveis estao sendo resolvidas
docker compose config | grep -E "password|user|secret"

# 3. Ver variaveis do ambiente atual
docker compose exec api env | sort

# 4. Verificar sintaxe no docker-compose.yml
# Correto: \${DB_PASSWORD} ou \$DB_PASSWORD
# ERRADO: $\{DB_PASSWORD\} (com escape)
\`\`\``,
      solution: `**Causa 1 — .env no diretorio errado:**
\`\`\`bash
# O .env DEVE estar no mesmo diretorio do docker-compose.yml
pwd                          # verificar diretorio atual
ls docker-compose.yml .env   # ambos devem existir aqui
\`\`\`

**Causa 2 — Sintaxe incorreta:**
\`\`\`yaml
# ERRADO
environment:
  - DB_PASS=\\\${DB_PASSWORD}  # escapado demais

# CORRETO
environment:
  - DB_PASS=\${DB_PASSWORD}    # substituicao simples
  DB_PASS: \${DB_PASSWORD}     # formato mapping
\`\`\`

**Causa 3 — Variavel nao definida no .env:**
\`\`\`bash
# Verificar o .env
cat .env | grep DB_PASSWORD

# Adicionar se faltar
echo "DB_PASSWORD=minha-senha" >> .env

# Usar default no compose para dev
environment:
  DB_PASSWORD: \${DB_PASSWORD:-dev-password}
\`\`\`

**Validar apos corrigir:**
\`\`\`bash
docker compose config | grep -i password
# Deve mostrar o valor real, nao a variavel
\`\`\``
    }
  ]
};
