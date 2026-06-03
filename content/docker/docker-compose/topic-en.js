window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['docker/docker-compose'] = {
  theory: `
# Docker Compose for DevOps

## Relevance
Docker Compose is the standard tool for orchestrating multi-container stacks locally and in CI/CD pipelines. It's the intermediate step between "docker run" and Kubernetes — understanding Compose well helps understand K8s deployments, services, and configmaps.

## What is Docker Compose

Docker Compose defines and runs multi-container applications using a declarative YAML file. A typical DevOps stack includes app + database + cache + reverse proxy — all orchestrated with a single \`docker compose up\`.

\`\`\`yaml
# docker-compose.yml anatomy
version: "3.9"          # schema version (use 3.x)
services:               # containers that make up the stack
  api:                  # service name
    image: myapp:v1     # OR build: ./
    ports: [...]        # port mapping
    environment: [...]  # environment variables
    depends_on: [...]   # dependencies
    volumes: [...]      # mounts
    networks: [...]     # networks
volumes: {}             # named volumes
networks: {}            # custom networks
\`\`\`

## Essential Syntax

### Services: build vs image

\`\`\`yaml
services:
  # Option 1: use pre-built image
  database:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: \${DB_PASSWORD}  # from .env file

  # Option 2: build from local Dockerfile
  api:
    build:
      context: ./api              # directory with Dockerfile
      dockerfile: Dockerfile      # name (optional, default: Dockerfile)
      args:
        BUILD_ENV: production
    image: myapp/api:latest       # name for built image
\`\`\`

### Ports, volumes, and networks

\`\`\`yaml
services:
  api:
    ports:
      - "8080:8080"           # host:container
      - "127.0.0.1:9090:9090" # bind only on localhost (more secure)

    volumes:
      - api-data:/app/data      # named volume (persistent)
      - ./config:/app/config:ro # bind mount (read-only)
      - /tmp/logs:/app/logs     # absolute bind mount

    networks:
      - backend
      - frontend

volumes:
  api-data:
    driver: local
    # For cloud: driver: rexray/ebs (AWS EBS)

networks:
  backend:
    driver: bridge
    internal: true     # no external access (security)
  frontend:
    driver: bridge
\`\`\`

### depends_on and healthcheck

\`\`\`yaml
services:
  api:
    depends_on:
      database:
        condition: service_healthy  # waits for healthcheck to pass
      cache:
        condition: service_started  # waits only for start

  database:
    image: postgres:15-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${POSTGRES_USER} -d \${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s    # initial time before counting failures

  cache:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 3
\`\`\`

### Environment variables and .env

\`\`\`yaml
# docker-compose.yml
services:
  api:
    environment:
      # Option 1: direct value (avoid passwords here)
      LOG_LEVEL: info
      APP_ENV: production

      # Option 2: .env substitution (\${VAR} or \$VAR)
      DATABASE_URL: postgres://\${DB_USER}:\${DB_PASSWORD}@database:5432/\${DB_NAME}
      SECRET_KEY: \${APP_SECRET_KEY}

      # Option 3: inherit from host environment
      AWS_ACCESS_KEY_ID:   # no value = inherits from host
      AWS_SECRET_ACCESS_KEY:

    env_file:
      - .env              # default file
      - .env.local        # local overrides (in .gitignore)
\`\`\`

\`\`\`bash
# .env (commit without secrets)
DB_USER=myapp
DB_NAME=myapp_db
APP_ENV=development
LOG_LEVEL=debug

# .env.local (DO NOT commit — add to .gitignore)
DB_PASSWORD=supersecret123
APP_SECRET_KEY=dev-key-change-in-prod
\`\`\`

### Profiles — optional services

\`\`\`yaml
services:
  api:
    image: myapp:latest
    # no profile = always starts

  database:
    image: postgres:15-alpine
    # no profile = always starts

  adminer:
    image: adminer:latest
    profiles: ["tools"]    # only starts with --profile tools
    ports: ["8081:8080"]

  tests:
    build: ./tests
    profiles: ["ci"]       # only starts in CI
    depends_on: [api, database]
    command: pytest

# Usage:
# docker compose up                    # starts api + database
# docker compose --profile tools up    # + adminer
# docker compose --profile ci up       # + tests
\`\`\`

## Configuration Override by Environment

\`\`\`bash
# Recommended structure
docker-compose.yml           # base (shared)
docker-compose.override.yml  # dev (auto-loaded)
docker-compose.prod.yml      # prod (explicitly specified)
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
# docker-compose.override.yml (dev — auto merge)
services:
  api:
    build: ./api              # in dev, local build
    volumes:
      - ./api/src:/app/src    # hot reload
    ports:
      - "8080:8080"
    environment:
      LOG_LEVEL: debug

  database:
    ports:
      - "5432:5432"           # expose port for external tools in dev
\`\`\`

\`\`\`yaml
# docker-compose.prod.yml (prod)
services:
  api:
    image: myregistry.io/myapp/api:v1.2.3  # specific prod image
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
# Use specific prod file
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
\`\`\`

## Essential Commands

\`\`\`bash
# Start the stack
docker compose up -d          # background (detached)
docker compose up --build     # force rebuild images
docker compose up api         # start only one service

# Status and logs
docker compose ps             # status of all services
docker compose logs -f api    # api service logs (follow)
docker compose logs --tail 50 # last 50 lines of all

# Execute commands
docker compose exec api bash            # shell in api service
docker compose exec database psql -U admin -d myapp
docker compose run --rm api pytest      # run one-off (remove after)

# Management
docker compose stop           # stop without removing
docker compose down           # stop and remove containers (keep volumes)
docker compose down -v        # stop, remove containers AND volumes
docker compose restart api    # restart specific service

# Scaling
docker compose up --scale api=3  # 3 replicas of api

# Inspection
docker compose config         # show final config (after override merge)
docker compose top            # processes in all services
\`\`\`

## Real Stack: API + PostgreSQL + Redis + Nginx

\`\`\`yaml
# docker-compose.yml — complete example stack
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
    internal: true   # database and cache without external access
\`\`\`

## Common Mistakes

1. **Race condition in depends_on** — using only \`condition: service_started\` doesn't guarantee the service is ready; use \`service_healthy\` with a real healthcheck
2. **Secrets in docker-compose.yml** — hardcoded passwords, not using \${VAR} from .env
3. **Volumes not mounted** — relative vs absolute path; verify with \`docker compose config\`
4. **Port conflicts** — another service using the same host port
5. **Ignored network isolation** — use \`internal: true\` on backend networks for security

## Killer.sh Style Challenge

> **Scenario:** You have an application with 3 services (Python API, PostgreSQL, Redis). The team complains that in dev, tests fail because the API tries to connect to the database before it's ready. Create a docker-compose.yml with correct healthchecks and depends_on with \`condition: service_healthy\`. Add a \`tests\` service with profile \`ci\` that only runs when explicitly called.
`,
  quiz: [
    {
      question: 'Why does `depends_on` with only `condition: service_started` not solve race conditions in applications?',
      options: [
        'depends_on is ignored by Docker in recent versions',
        '`service_started` only guarantees the container started — not that the process inside is ready to accept connections. PostgreSQL, for example, can take seconds after starting to accept connections',
        'depends_on only works with condition: service_healthy',
        'depends_on only controls creation order, not initialization'
      ],
      correct: 1,
      explanation: '`service_started` means only that the container was created and started. The internal process (PostgreSQL, Redis, etc.) may still be initializing. To ensure the service is truly ready, configure a `healthcheck` on the dependent service and use `condition: service_healthy` — Docker will wait for the healthcheck to pass before starting the dependent service.',
      reference: 'Correct pattern: healthcheck with pg_isready (Postgres), redis-cli ping (Redis), or curl to /health endpoint (HTTP).'
    },
    {
      question: 'What is the purpose of docker-compose.override.yml files and how do they work?',
      options: [
        'Override is a backup file created automatically by Docker',
        'docker-compose.override.yml is automatically merged with docker-compose.yml when present — allows having shared base configurations and per-environment overrides (dev, prod, ci) without duplicating the entire configuration',
        'Override files are only used with the -f flag explicitly',
        'Only one override file can exist per project'
      ],
      correct: 1,
      explanation: 'Docker Compose has automatic merging: when running `docker compose up`, it loads `docker-compose.yml` and, if present, merges with `docker-compose.override.yml`. For other files (prod, ci), use `docker compose -f docker-compose.yml -f docker-compose.prod.yml`. The merge is smart: lists are concatenated, mappings are merged, scalar values are overwritten.',
      reference: 'Recommended structure: docker-compose.yml (base) + docker-compose.override.yml (dev, auto-merged) + docker-compose.prod.yml (prod, explicit).'
    },
    {
      question: 'How does variable substitution work in docker-compose.yml and what is the precedence order?',
      options: [
        'Only variables from the .env file are supported',
        'Precedence order is: shell variables > .env file > compose default (${VAR:-default}) — variables defined in the shell override .env',
        'Variables in the .env file always override shell variables',
        'Only ${VAR} is supported, not $VAR'
      ],
      correct: 1,
      explanation: 'Docker Compose resolves variables in order: 1) shell environment variable (highest priority), 2) .env file in the same directory, 3) default value defined in the ${VAR:-default} syntax. This allows: default values in .env for dev, and overrides via environment variables in CI/CD (export DB_PASSWORD=... before docker compose up).',
      reference: 'CI/CD tip: define sensitive variables as CI secrets (GitHub Actions secrets) and export them before running docker compose.'
    },
    {
      question: 'What does `docker compose run --rm api pytest` do differently from `docker compose exec api pytest`?',
      options: [
        'run and exec are identical',
        '`exec` runs in an ALREADY RUNNING container; `run` creates a NEW container specifically for that command and removes it with --rm — ideal for one-off tasks like migrations and tests',
        '`run` is faster because it doesn\'t create a new container',
        '`exec` only works with bash/sh, `run` works with any command'
      ],
      correct: 1,
      explanation: '`docker compose exec` runs a command in a container that is already running — the service needs to be running. `docker compose run` creates a new container, specifically to run that command, and with `--rm` removes the container when done. This is ideal for: database migrations (run --rm api python manage.py migrate), tests (run --rm tests pytest), and maintenance scripts.',
      reference: 'Common pattern: `docker compose run --rm api python manage.py migrate` for migrations in CI/CD before starting the application.'
    },
    {
      question: 'What are `profiles` in Docker Compose used for and when to use them?',
      options: [
        'Profiles define the log level of services',
        'Profiles group optional services that only start when the profile is specified — allows having dev services (adminer, mailhog), ci (tests) and tools in the same composefile without always running them all',
        'Profiles define resource limits per environment',
        'Profiles only work with Docker Swarm'
      ],
      correct: 1,
      explanation: 'Profiles allow marking services as optional. Services without a profile always start. Services with `profiles: ["tools"]` only start when `docker compose --profile tools up` is executed. Use cases: adminer (DB GUI), mailhog (fake email), test service — all useful at specific moments but not daily.',
      reference: 'CI usage: `docker compose --profile ci run tests` to run only tests without starting the entire dev stack.'
    },
    {
      question: 'Why use `networks: internal: true` for the database network in production?',
      options: [
        'Internal networks are faster',
        'A network with `internal: true` has no route to the outside world — the database container cannot make external requests or be accessed from outside the network, reducing attack surface',
        'Internal networks prevent port conflicts',
        'Containers in internal networks don\'t need authentication'
      ],
      correct: 1,
      explanation: 'Networks with `internal: true` in Docker are completely isolated: no container on that network can access the internet or be accessed externally. For production databases and cache, this is an important security layer — even if someone compromises the container, they cannot exfiltrate data to an external server.',
      reference: 'Recommended architecture: nginx + api on frontend network; api + database + cache on backend network (internal: true). Nginx is the only external entry point.'
    },
    {
      question: 'What is the difference between `docker compose down` and `docker compose down -v`?',
      options: [
        'No difference — both remove everything',
        '`down` stops and removes containers and created networks, but preserves named volumes; `down -v` also removes volumes — WARNING: this deletes database data in dev',
        '`down -v` is needed to remove built images',
        '`down` is for development, `down -v` is for production'
      ],
      correct: 1,
      explanation: '`docker compose down` stops containers, removes containers and networks created by Compose — but preserves named volumes (the database survives). `docker compose down -v` also removes named volumes (db-data, cache-data) — deleting all data. Useful to start fresh in dev, but NEVER in production.',
      reference: 'Tip: before `down -v`, always backup with `docker exec database pg_dump ... > backup.sql`.'
    }
  ],
  flashcards: [
    {
      front: 'depends_on with healthcheck — correct pattern',
      back: '**Problem:** depends_on with only `service_started` = race condition\n\n**Complete solution:**\n\`\`\`yaml\nservices:\n  api:\n    depends_on:\n      database:\n        condition: service_healthy  # waits for healthcheck\n\n  database:\n    image: postgres:15-alpine\n    healthcheck:\n      test: ["CMD-SHELL",\n        "pg_isready -U \${DB_USER} -d \${DB_NAME}"]\n      interval: 10s\n      timeout: 5s\n      retries: 5\n      start_period: 30s  # time to initialize\n\`\`\`\n\n**Common healthchecks:**\n- PostgreSQL: `pg_isready -U user -d db`\n- Redis: `redis-cli ping`\n- HTTP: `curl -f http://localhost:8080/health`\n- MySQL: `mysqladmin ping -h localhost`'
    },
    {
      front: 'Override structure by environment',
      back: '**Files:**\n```\ndocker-compose.yml          ← base\ndocker-compose.override.yml ← dev (auto-merge)\ndocker-compose.prod.yml     ← prod (explicit)\ndocker-compose.ci.yml       ← CI (explicit)\n```\n\n**Usage:**\n```bash\n# Dev (automatic merge)\ndocker compose up\n\n# Prod (explicit)\ndocker compose \\\n  -f docker-compose.yml \\\n  -f docker-compose.prod.yml up -d\n\n# CI\ndocker compose \\\n  -f docker-compose.yml \\\n  -f docker-compose.ci.yml run tests\n```\n\n**Merge rules:**\n- Scalars: override overwrites\n- Lists: concatenated\n- Mappings: recursively merged\n- volumes/ports: added\n\n**Validate merge:**\n```bash\ndocker compose config  # shows final config\n```'
    },
    {
      front: 'Environment variables — precedence and security',
      back: '**Precedence (highest to lowest):**\n1. Shell environment (`export VAR=val`)\n2. `.env` file in the directory\n3. Default in compose (`\${VAR:-default}`)\n\n**Security best practices:**\n```bash\n# .env (commit - dev values)\nDB_USER=myapp\nDB_NAME=myapp\nLOG_LEVEL=debug\n\n# .env.local (DO NOT commit)\nDB_PASSWORD=secret\nSECRET_KEY=dev-key\n```\n\n```yaml\n# .gitignore\n.env.local\n.env.production\n*.env.local\n```\n\n**In CI/CD (GitHub Actions):**\n```yaml\n- run: docker compose up -d\n  env:\n    DB_PASSWORD: \${{ secrets.DB_PASSWORD }}\n    SECRET_KEY: \${{ secrets.APP_SECRET }}\n```\n\n**Verify resolved variables:**\n```bash\ndocker compose config  # shows final values\n```'
    },
    {
      front: 'Profiles — optional services by context',
      back: '**Definition:**\n```yaml\nservices:\n  api:\n    image: myapp  # always starts\n\n  adminer:\n    image: adminer\n    profiles: ["tools"]  # only with --profile tools\n\n  tests:\n    build: ./tests\n    profiles: ["ci"]     # only in CI\n```\n\n**Usage:**\n```bash\n# Only services without profile\ndocker compose up\n\n# With tools\ndocker compose --profile tools up\n\n# CI\ndocker compose --profile ci run tests\n\n# Multiple profiles\ndocker compose --profile tools --profile monitoring up\n```\n\n**Use cases:**\n- `tools`: adminer, mailhog, redis-commander\n- `ci`: test service, linters\n- `monitoring`: prometheus, local grafana\n- `seed`: initial database population'
    },
    {
      front: 'Networks in Compose — isolation and security',
      back: '**Types:**\n```yaml\nnetworks:\n  frontend:\n    driver: bridge     # default\n  backend:\n    driver: bridge\n    internal: true     # no external access!\n```\n\n**Secure architecture:**\n```\nInternet\n   ↓\n[nginx]\n   ↓ frontend network\n[api]\n   ↓ backend network (internal: true)\n[database] [cache]\n```\n\n**Benefits of internal: true:**\n- DB cannot access the internet\n- DB is not accessible externally\n- Compromised container cannot exfiltrate data\n\n**Internal DNS:**\n- Services communicate by name\n- `api` → `http://database:5432`\n- `api` → `redis://cache:6379`\n- No fixed IP needed!\n\n**Inspect:**\n```bash\ndocker network ls\ndocker network inspect project_backend\n```'
    },
    {
      front: 'Essential Docker Compose commands',
      back: '**Lifecycle:**\n```bash\ndocker compose up -d           # start\ndocker compose up --build      # rebuild + start\ndocker compose stop            # stop (keep containers)\ndocker compose down            # remove containers\ndocker compose down -v         # remove + volumes\ndocker compose restart api     # restart service\n```\n\n**Monitoring:**\n```bash\ndocker compose ps              # status\ndocker compose logs -f api     # logs follow\ndocker compose top             # processes\ndocker compose stats           # resource usage\n```\n\n**Execution:**\n```bash\n# In running container\ndocker compose exec api bash\ndocker compose exec db psql -U admin\n\n# New one-off container\ndocker compose run --rm api pytest\ndocker compose run --rm api python manage.py migrate\n```\n\n**Debug:**\n```bash\ndocker compose config          # merged final config\ndocker compose config --services  # list services\n```'
    }
  ],
  lab: {
    scenario: 'You need to create a Docker Compose stack for a web application with a Python API (Flask), PostgreSQL database, and Redis cache. The stack must have correct healthchecks, environment variables via .env, and be split between base and development override configurations.',
    objective: 'Create a complete Docker Compose stack with healthchecks, .env, isolated networks, and per-environment override files.',
    duration: '20-30 minutes',
    steps: [
      {
        title: 'Create the base project structure and .env',
        instruction: `Create the directory structure and base configuration files, including the .env with environment variables.`,
        hints: [
          'Separate "public" variables (DB_NAME, LOG_LEVEL) in .env from sensitive ones (.env.local)',
          'Use descriptive and consistent variable names',
          'Add .env.local to .gitignore immediately'
        ],
        solution: `\`\`\`bash
# Create project structure
mkdir compose-lab && cd compose-lab
mkdir -p api database

# Create .env (dev values — can commit)
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

# Create .env.local (passwords — DO NOT commit!)
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

# Create a simple Flask app
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
# Verify created structure
ls -la
ls api/

# Verify files
cat .env
cat api/requirements.txt

# Verify .gitignore protects passwords
grep ".env.local" .gitignore && echo ".env.local is in .gitignore ✓" || echo "WARNING: .env.local NOT in .gitignore!"
\`\`\``
      },
      {
        title: 'Create base docker-compose.yml with healthchecks',
        instruction: `Create the docker-compose.yml file with the three services (api, database, cache), correct healthchecks, and isolated networks.`,
        hints: [
          'Use condition: service_healthy in the API\'s depends_on',
          'Configure service-specific healthchecks for PostgreSQL (pg_isready) and Redis (redis-cli ping)',
          'Put database and cache on the backend network with internal: true'
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

# Validate config
docker compose config
echo "Config valid!"
\`\`\``,
        verify: `\`\`\`bash
# Verify file was created
ls -la docker-compose.yml

# Validate syntax
docker compose config > /dev/null && echo "Syntax OK ✓"

# Verify internal: true is configured
docker compose config | grep -A2 "backend:"

# Start the stack
docker compose up -d

# Wait for healthchecks
sleep 15
docker compose ps
# Expected: all services "healthy" or "running"
\`\`\``
      },
      {
        title: 'Create docker-compose.override.yml for development',
        instruction: `Create the development override file with: API hot reload, exposed ports for local tools, and an adminer service with profile "tools".`,
        hints: [
          'In the override, add bind mount volumes for hot reload',
          'Expose the database port only in the override (not in base)',
          'Use profiles: ["tools"] for adminer'
        ],
        solution: `\`\`\`bash
cat > docker-compose.override.yml << 'EOF'
# Automatic override for development
services:
  api:
    ports:
      - "8080:8080"         # expose port in dev
    environment:
      FLASK_ENV: development
      FLASK_DEBUG: "1"
    volumes:
      - ./api:/app          # code hot reload

  database:
    ports:
      - "5432:5432"         # accessible by local tools (DBeaver, etc.)

  cache:
    ports:
      - "6379:6379"         # accessible by local redis-cli

  # Optional service with profile
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

# Verify merged final configs
docker compose config

# Start with override (automatic)
docker compose up -d

# Check status
docker compose ps

# Test endpoints
sleep 10
curl -s http://localhost:8080/health | python3 -m json.tool
curl -s http://localhost:8080/db-check | python3 -m json.tool
curl -s http://localhost:8080/cache-check | python3 -m json.tool
\`\`\``,
        verify: `\`\`\`bash
# Verify all services are running
docker compose ps
# Expected: api, database, cache - all UP and healthy

# Test health endpoint
curl -sf http://localhost:8080/health
# Expected: {"status": "ok", "env": "development"}

# Test database connection
curl -sf http://localhost:8080/db-check
# Expected: {"db": "connected"}

# Test adminer with profile
docker compose --profile tools up -d adminer
sleep 3
curl -sf http://localhost:8081 -o /dev/null -w "%{http_code}" | grep -q "200\|302" && echo "Adminer OK ✓"

# Cleanup
docker compose --profile tools down
docker compose down -v
echo "Lab complete!"
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'Service fails to connect to database even with depends_on',
      difficulty: 'medium',
      symptom: 'The API starts and immediately tries to connect to PostgreSQL, but fails with "connection refused" or "role does not exist", even with `depends_on: database` configured.',
      diagnosis: `\`\`\`bash
# 1. Check service status
docker compose ps
# database may be "starting" not "healthy"

# 2. Check database healthcheck
docker compose logs database | tail -20
docker inspect \$(docker compose ps -q database) | jq '.[].State.Health'

# 3. Check if healthcheck is configured in compose
docker compose config | grep -A 10 "healthcheck"

# 4. See api exit code
docker compose ps api
# If "Exited", api tried to connect before db was ready
\`\`\``,
      solution: `**Cause:** depends_on without healthcheck = race condition

**Solution — add healthcheck to database:**
\`\`\`yaml
services:
  api:
    depends_on:
      database:
        condition: service_healthy  # was: service_started

  database:
    image: postgres:15-alpine
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${DB_USER} -d \${DB_NAME}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s  # important for postgres to initialize
\`\`\`

**Alternative — retry in the application:**
\`\`\`python
import time
import psycopg2

def connect_with_retry(max_retries=5):
    for i in range(max_retries):
        try:
            return psycopg2.connect(...)
        except psycopg2.OperationalError:
            if i < max_retries - 1:
                time.sleep(2 ** i)  # exponential backoff
    raise Exception("Could not connect to database")
\`\`\`

**Verify after fixing:**
\`\`\`bash
docker compose down && docker compose up -d
docker compose ps  # wait for api to become "healthy"
\`\`\``
    },
    {
      title: 'Environment variables not substituted correctly',
      difficulty: 'easy',
      symptom: 'In docker-compose.yml, variables ${DB_PASSWORD} appear literally in the container or are empty. `docker compose config` shows "null" or the raw variable text.',
      diagnosis: `\`\`\`bash
# 1. Check if .env exists in the correct directory
ls -la .env
# MUST be in the same directory as docker-compose.yml

# 2. See which variables are being resolved
docker compose config | grep -E "password|user|secret"

# 3. Check current environment variables
docker compose exec api env | sort

# 4. Check syntax in docker-compose.yml
# Correct: \${DB_PASSWORD} or \$DB_PASSWORD
# WRONG: $\{DB_PASSWORD\} (escaped)
\`\`\``,
      solution: `**Cause 1 — .env in wrong directory:**
\`\`\`bash
# .env MUST be in the same directory as docker-compose.yml
pwd                          # check current directory
ls docker-compose.yml .env   # both must exist here
\`\`\`

**Cause 2 — Incorrect syntax:**
\`\`\`yaml
# WRONG
environment:
  - DB_PASS=\\\${DB_PASSWORD}  # over-escaped

# CORRECT
environment:
  - DB_PASS=\${DB_PASSWORD}    # simple substitution
  DB_PASS: \${DB_PASSWORD}     # mapping format
\`\`\`

**Cause 3 — Variable not defined in .env:**
\`\`\`bash
# Check the .env
cat .env | grep DB_PASSWORD

# Add if missing
echo "DB_PASSWORD=my-password" >> .env

# Use default in compose for dev
environment:
  DB_PASSWORD: \${DB_PASSWORD:-dev-password}
\`\`\`

**Validate after fixing:**
\`\`\`bash
docker compose config | grep -i password
# Should show the real value, not the variable
\`\`\``
    }
  ]
};
