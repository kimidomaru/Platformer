window.K8S_CONTENT = window.K8S_CONTENT || {};
window.K8S_CONTENT['ai-engineering/rag-platform'] = {
  theory: `
# RAG: Documentacao e Runbooks com AI

## Relevancia
RAG (Retrieval Augmented Generation) resolve o problema fundamental de LLMs: eles nao sabem o que esta na sua documentacao interna, seus runbooks, suas ADRs (Architecture Decision Records) ou no estado atual da sua infraestrutura. Com RAG, voce conecta o LLM ao seu conhecimento proprietary sem retreinar o modelo.

## O que e RAG (sem matematica)

### Conceito central

\`\`\`
Pergunta → [Busca] → Documentos relevantes → [LLM + documentos] → Resposta fundamentada
\`\`\`

Em vez de confiar apenas no conhecimento de treinamento do LLM (que pode estar desatualizado e nao tem seus documentos), o RAG:

1. **Indexa** seus documentos (embeddings — representacoes numericas de significado)
2. **Busca** os mais relevantes para a pergunta
3. **Injeta** esses documentos no contexto do LLM
4. O LLM **responde** baseado nos documentos reais, nao apenas no treinamento

### Analogia pratica

\`\`\`
SEM RAG: "Como deployo o servico X?"
LLM responde com padroes genericos de treinamento
— pode estar errado para seu ambiente especifico

COM RAG: "Como deployo o servico X?"
→ Busca runbook do servico X, historico de deploys, ultima ADR relevante
→ LLM responde com base nos SEUS documentos reais
— resposta especifica para seu ambiente
\`\`\`

## Casos de Uso para DevOps/SRE

### 1. Busca em Runbooks

Problema: runbooks espalhados em Confluence, Notion, Google Docs, repositorios Git.
Com RAG: "Qual e o procedimento de rollback do servico payments?" → busca nos runbooks reais.

### 2. Incident Similarity Search

Problema: incidente novo parece familiar mas ninguem lembra o postmortem.
Com RAG: "Temos pods em OOMKilled no namespace payments" → busca incidentes similares do historico.

### 3. Chat com Documentacao de API Interna

Problema: desenvolvedores nao sabem como usar a API interna.
Com RAG: chatbot sobre a documentacao do seu OpenAPI spec.

### 4. Onboarding Automatizado

Problema: novos engenheiros perdidos com docs dispersas.
Com RAG: "Como configuro o ambiente de dev?" → responde com base nas docs reais do team.

## Stack de RAG para Times de Plataforma

### Opcao 1: Ferramentas de Produtividade (sem codigo)

\`\`\`
Notion AI           → RAG sobre paginas do Notion (nativo)
Confluence AI       → RAG sobre o Confluence (nativo)
GitHub Copilot      → RAG sobre o repositorio (via @workspace)
Cursor              → RAG sobre o codebase local
\`\`\`

### Opcao 2: Cursor para Codebase RAG

Cursor e um editor baseado em VS Code com RAG nativo sobre o codebase:

\`\`\`
Indexacao automatica do repositorio
Chat com contexto de codigo real:
  "Como o modulo de autenticacao lida com refresh tokens?"
  → Cursor busca o codigo relevante e responde baseado nele

Ideal para:
- Entender codebases desconhecidas
- Responder perguntas sobre implementacao especifica
- Navegar em repositorios grandes
\`\`\`

### Opcao 3: RAG Customizado (LangChain + Chroma/Qdrant)

Para casos onde voce quer controle total:

\`\`\`python
# Setup minimo com LangChain + Chroma (local)
from langchain_community.document_loaders import DirectoryLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain.chains import RetrievalQA

# 1. Carregar documentos
loader = DirectoryLoader('./runbooks/', glob='**/*.md')
docs = loader.load()

# 2. Dividir em chunks
splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200
)
chunks = splitter.split_documents(docs)

# 3. Criar vector store
embeddings = OpenAIEmbeddings()
vectorstore = Chroma.from_documents(chunks, embeddings, persist_directory='./chroma_db')

# 4. Criar chain de QA
llm = ChatOpenAI(model='gpt-4o-mini', temperature=0)
qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    retriever=vectorstore.as_retriever(search_kwargs={'k': 4}),
    return_source_documents=True
)

# 5. Usar
result = qa_chain.invoke({'query': 'Como fazer rollback do servico payments?'})
print(result['result'])
print('Fontes:', [doc.metadata['source'] for doc in result['source_documents']])
\`\`\`

### Vector Databases — opcoes

\`\`\`
Chroma    → Local, zero infra, ideal para POC e times pequenos
Qdrant    → Self-hosted ou cloud, production-ready, bom performance
Pinecone  → Cloud managed, zero ops, mais caro
pgvector  → Extensao PostgreSQL, ideal se ja tem Postgres
Weaviate  → Open source, bom para dados estruturados + texto
\`\`\`

## Implementando RAG para Runbooks em Kubernetes

### Estrutura do projeto

\`\`\`
runbook-rag/
├── ingest/
│   ├── load_confluence.py    # carrega do Confluence API
│   ├── load_github.py        # carrega de repos Git
│   └── load_files.py         # carrega arquivos locais
├── vectorstore/
│   └── chroma_db/            # banco vetorial local
├── api/
│   └── query.py              # endpoint de busca
└── config.yaml               # configuracao de fontes
\`\`\`

### Ingestao de documentos do Confluence

\`\`\`python
from atlassian import Confluence
from langchain_community.document_loaders import ConfluenceLoader

loader = ConfluenceLoader(
    url='https://mycompany.atlassian.net',
    username='user@company.com',
    api_key=os.getenv('CONFLUENCE_API_KEY'),
    space_key='RUNBOOKS',
    include_attachments=False
)
docs = loader.load()
\`\`\`

### Deploy do RAG como microservico no Kubernetes

\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: runbook-rag
  namespace: platform-tools
spec:
  replicas: 2
  selector:
    matchLabels:
      app: runbook-rag
  template:
    metadata:
      labels:
        app: runbook-rag
    spec:
      containers:
      - name: rag-api
        image: mycompany/runbook-rag:v1.0.0
        ports:
        - containerPort: 8080
        env:
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: ai-credentials
              key: openai-api-key
        - name: VECTOR_DB_PATH
          value: /data/chroma_db
        volumeMounts:
        - name: vector-data
          mountPath: /data
      volumes:
      - name: vector-data
        persistentVolumeClaim:
          claimName: rag-vector-store
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: rag-vector-store
  namespace: platform-tools
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
\`\`\`

## Avaliacao de RAG com RAGAS

RAGAS (RAG Assessment) e um framework para medir a qualidade do seu sistema RAG:

\`\`\`python
from ragas import evaluate
from ragas.metrics import (
    faithfulness,           # resposta e fiel aos documentos recuperados?
    answer_relevancy,       # resposta e relevante para a pergunta?
    context_precision,      # documentos recuperados sao precisos?
    context_recall          # documentos relevantes foram recuperados?
)

# Dataset de avaliacao (perguntas + respostas esperadas + contexto)
eval_dataset = [
    {
        'question': 'Como fazer rollback do servico payments?',
        'answer': resposta_do_rag,
        'contexts': [doc.page_content for doc in docs_recuperados],
        'ground_truth': 'O rollback do payments usa helm rollback...'
    }
]

result = evaluate(eval_dataset, metrics=[
    faithfulness,
    answer_relevancy,
    context_precision,
    context_recall
])
print(result)
# faithfulness: 0.92  (resposta fiel aos docs? bom)
# answer_relevancy: 0.87 (relevante para a pergunta? bom)
# context_precision: 0.78 (docs recuperados corretos? pode melhorar)
\`\`\`

### Metricas interpretadas

\`\`\`
Faithfulness (fidelidade):
> 0.8 = bom. LLM esta respondendo baseado nos documentos
< 0.6 = problema: LLM esta "alucinando" alem dos documentos

Answer Relevancy (relevancia):
> 0.8 = bom. Resposta responde a pergunta
< 0.6 = resposta off-topic ou muito generica

Context Precision (precisao do contexto):
> 0.7 = bom. Documentos recuperados sao relevantes
< 0.5 = problema: busca ruim, recuperando lixo junto com ouro

Context Recall (cobertura do contexto):
> 0.7 = bom. Documentos relevantes estao sendo encontrados
< 0.5 = problema: documentos importantes nao estao sendo indexados
\`\`\`

## Boas Praticas de RAG para Times de Infra

### Qualidade dos documentos e fundamental

\`\`\`markdown
✅ Bom para RAG:
- Runbooks com passos claros e estruturados
- Postmortems com causa raiz documentada
- ADRs com contexto e decisao clara
- README com exemplos de comandos reais

❌ Ruim para RAG:
- Documentos muito antigos e desatualizados
- Paginas de wiki genericas sem detalhes especificos
- Dados sensiveis (senhas, tokens) misturados no texto
- Documentos sem metadados (data, autor, servico)
\`\`\`

### Chunking estrategico

\`\`\`python
# Para runbooks: dividir por secao, nao por tamanho fixo
# Evita cortar no meio de um procedimento

splitter = RecursiveCharacterTextSplitter(
    chunk_size=800,          # menor = mais preciso, maior = mais contexto
    chunk_overlap=150,       # overlap garante continuidade entre chunks
    separators=['\n## ', '\n### ', '\n\n', '\n', ' ']  # preferir quebrar em headings
)
\`\`\`

### Metadados para filtros

\`\`\`python
# Adicionar metadados aos documentos para filtrar por servico, data, tipo
docs_com_metadata = []
for doc in docs:
    doc.metadata.update({
        'service': extract_service_from_path(doc.metadata['source']),
        'doc_type': 'runbook',
        'last_updated': '2024-01-15',
        'team': 'platform-engineering'
    })
    docs_com_metadata.append(doc)

# Busca com filtro:
retriever = vectorstore.as_retriever(
    search_kwargs={
        'k': 4,
        'filter': {'service': 'payments', 'doc_type': 'runbook'}
    }
)
\`\`\`

## Erros Comuns

1. **Indexar tudo sem filtrar** — incluir logs de debug, configs com senhas, dados sensiveis
2. **Chunks muito grandes** — perder precisao na busca
3. **Nao atualizar o indice** — runbooks mudam, o indice precisa ser re-indexado periodicamente
4. **Nao avaliar com RAGAS** — assumir que funciona sem medir qualidade
5. **Resposta sem fonte** — sempre mostrar de qual documento a resposta veio

## Killer.sh Style Challenge

> **Cenario:** Seu time tem 200+ runbooks em um repositorio Git e 500+ postmortems no Confluence. Voce quer criar um chatbot interno que responda perguntas sobre incidentes e procedimentos de recovery. Descreva:
> 1. A arquitetura do sistema RAG (componentes e fluxo)
> 2. Como atualizar o indice quando novos runbooks sao adicionados
> 3. Como garantir que dados sensiveis (credenciais em configs) nao sejam indexados
`,
  quiz: [
    {
      question: 'Qual e o problema fundamental que RAG resolve para times de DevOps/SRE?',
      options: [
        'RAG torna os LLMs mais rapidos e baratos',
        'LLMs nao conhecem sua documentacao interna, runbooks e estado atual da infra — RAG conecta o modelo ao seu conhecimento proprietary sem precisar retreinar',
        'RAG elimina alucinacoes completamente em qualquer contexto',
        'RAG permite que LLMs acessem o cluster Kubernetes em tempo real'
      ],
      correct: 1,
      explanation: 'O problema central e que LLMs sao treinados com dados publicos ate uma data de corte. Eles nao sabem o que esta nos seus runbooks internos, postmortems, ADRs ou documentacao proprietaria. RAG resolve isso: indexa seus documentos, busca os relevantes para cada pergunta, e injeta como contexto para o LLM responder com base no seu conhecimento real.',
      reference: 'Conceito relacionado: knowledge cutoff e o problema que motiva RAG — o modelo nao sabe do que aconteceu depois do treinamento, muito menos do que existe apenas internamente.'
    },
    {
      question: 'Qual banco vetorial e mais adequado para um POC de RAG em um time pequeno sem infraestrutura adicional?',
      options: [
        'Pinecone — e o mais famoso do mercado',
        'Qdrant — tem o melhor performance',
        'Chroma — roda localmente sem infraestrutura adicional, ideal para POC e times pequenos',
        'pgvector — qualquer time ja tem PostgreSQL'
      ],
      correct: 2,
      explanation: 'Chroma roda completamente local (ou em memoria), nao requer nenhuma infraestrutura adicional, e e a escolha ideal para POC e validacao de conceito. Para producao com escala, Qdrant (self-hosted) ou pgvector (se ja tem Postgres) sao melhores. Pinecone e excelente mas tem custo e dependencia de servico externo.',
      reference: 'Decisao de arquitetura: comece com Chroma local, valide a utilidade do RAG, depois migre para Qdrant ou pgvector para producao.'
    },
    {
      question: 'O que a metrica "faithfulness" do RAGAS mede em um sistema RAG?',
      options: [
        'Se o sistema RAG retorna respostas rapidas',
        'Se a resposta do LLM e fiel/fundamentada nos documentos recuperados — ou se o LLM esta "alucinando" alem do que os documentos dizem',
        'Se os documentos indexados sao de alta qualidade',
        'Se a pergunta do usuario e clara e bem formulada'
      ],
      correct: 1,
      explanation: 'Faithfulness mede se a resposta gerada pelo LLM e de fato baseada nos documentos que foram recuperados. Um faithfulness baixo (<0.6) indica que o LLM esta inventando informacoes alem do que os documentos mostram — alucinando com mais detalhes nao suportados pelo contexto. E a metrica mais critica para confiabilidade do RAG.',
      reference: 'Combinacao de metricas: faithfulness + answer_relevancy + context_precision + context_recall formam uma visao completa da qualidade do RAG.'
    },
    {
      question: 'Qual e a importancia de adicionar metadados (servico, tipo, data) aos documentos ao indexar para RAG?',
      options: [
        'Metadados melhoram a velocidade de indexacao',
        'Metadados permitem filtrar a busca por servico/tipo/data — evitando que uma pergunta sobre "payments" traga runbooks de "auth" ou documentos desatualizados',
        'Metadados sao obrigatorios para o LangChain funcionar',
        'Metadados reduzem o custo dos embeddings'
      ],
      correct: 1,
      explanation: 'Metadados permitem busca filtrada. Sem filtros, uma pergunta sobre "rollback" pode trazer runbooks de todos os servicos. Com metadados, voce filtra por servico, tipo de documento, data de atualizacao. Isso aumenta drasticamente a precisao (context_precision no RAGAS) e evita respostas erradas baseadas em documentos de contextos diferentes.',
      reference: 'Pratica recomendada: sempre indexar com pelo menos: servico, tipo_doc (runbook/postmortem/adr), data_atualizacao, time_responsavel.'
    },
    {
      question: 'Por que o chunking com overlap (sobreposicao entre chunks) e importante em RAG para runbooks?',
      options: [
        'Overlap aumenta o numero de documentos indexados',
        'Overlap garante que informacoes que aparecem na fronteira entre dois chunks nao se percam — evita cortar no meio de um procedimento critico',
        'Overlap e necessario apenas para documentos em PDFs',
        'Overlap reduz o custo de embeddings'
      ],
      correct: 1,
      explanation: 'Quando um runbook e dividido em chunks, um procedimento critico pode ser cortado entre dois chunks. Sem overlap, a parte final do passo 3 e o inicio do passo 4 ficam em chunks diferentes sem contexto compartilhado. Com overlap de 150-200 tokens, ambos os chunks contem a transicao, garantindo que a busca recupere o contexto completo do procedimento.',
      reference: 'Dica de chunking: para runbooks, prefira separadores hierarquicos (## headings primeiro) ao inves de chunks de tamanho fixo — mantem procedimentos completos no mesmo chunk.'
    },
    {
      question: 'Qual e a diferenca pratica entre usar Cursor/Copilot @workspace e construir um RAG customizado para documentacao de infraestrutura?',
      options: [
        'Nao ha diferenca — ambos fazem a mesma coisa',
        'Cursor/Copilot @workspace indexa apenas codigo em repositorios Git; RAG customizado indexa qualquer fonte (Confluence, runbooks, postmortems) com controle total de filtros, metadados e avaliacao de qualidade',
        'RAG customizado e sempre melhor e deve ser a primeira escolha',
        'Cursor so funciona com Python, RAG funciona com qualquer linguagem'
      ],
      correct: 1,
      explanation: 'Cursor e Copilot @workspace sao excelentes para RAG sobre codigo em repositorios Git — zero configuracao. Mas para documentacao dispersa (Confluence, Notion, postmortems em Google Docs, runbooks em formato variado), RAG customizado permite: indexar qualquer fonte, adicionar metadados especificos, filtrar por servico/data, avaliar qualidade com RAGAS, e controlar privacidade de dados sensiveis.',
      reference: 'Decisao de build vs buy: comece com Cursor/Copilot para codigo. Construa RAG customizado apenas quando precisar de fontes nao-Git ou controle de metadados.'
    },
    {
      question: 'Como garantir que credenciais e dados sensiveis nao sejam indexados no banco vetorial do RAG?',
      options: [
        'Criptografar todos os documentos antes de indexar',
        'Implementar filtros de pre-processamento que removem padroes de credenciais, usar .ragignore para excluir arquivos de configuracao, e nunca indexar arquivos .env ou secrets',
        'Dados sensiveis sao automaticamente removidos pelos embeddings',
        'Usar apenas documentos publicos para o RAG'
      ],
      correct: 1,
      explanation: 'Dados sensiveis no banco vetorial sao um risco real — embeddings preservam semantica suficiente para recuperar informacoes criticas. Mitigacoes: (1) filtro pre-indexacao que usa regex para detectar padroes de API keys, senhas, tokens; (2) .ragignore para excluir .env, secrets.yaml, kubeconfigs; (3) scrubbing de documentos antes de indexar; (4) review manual de novas fontes antes de adicionar ao pipeline.',
      reference: 'Pratica de seguranca: trate o banco vetorial como dado sensivel — acesso controlado, auditoria de queries, e nunca expor o conteudo dos chunks diretamente.'
    }
  ],
  flashcards: [
    {
      front: 'RAG — conceito e fluxo para DevOps',
      back: '**RAG = Retrieval Augmented Generation**\n\n**Fluxo:**\n\`\`\`\nPergunta do usuario\n  ↓\n[Vector Search] → busca documentos similares\n  ↓\nTop K documentos relevantes\n  ↓\n[LLM + documentos como contexto]\n  ↓\nResposta fundamentada nos seus docs\n\`\`\`\n\n**Problema que resolve:**\nLLMs nao conhecem sua documentacao\ninterna, runbooks, postmortems e\nconfigs especificas do seu ambiente.\n\n**Casos de uso DevOps:**\n- Chatbot sobre runbooks\n- Incident similarity search\n- Chat com docs de API interna\n- Onboarding automatizado\n- Busca em postmortems'
    },
    {
      front: 'Vector Databases — escolhendo para seu caso',
      back: '**Chroma** — local, zero infra\n→ POC, time pequeno, sem infra extra\n→ `pip install chromadb`\n\n**Qdrant** — self-hosted ou cloud\n→ Producao, alta performance\n→ `docker run qdrant/qdrant`\n\n**pgvector** — extensao PostgreSQL\n→ Se ja tem Postgres, zero infra nova\n→ `CREATE EXTENSION vector`\n\n**Pinecone** — cloud managed\n→ Zero ops, paga por uso\n→ Dependencia de servico externo\n\n**Weaviate** — open source\n→ Dados estruturados + texto\n\n**Regra de decisao:**\n1. POC → Chroma local\n2. Prod + ja tem Postgres → pgvector\n3. Prod + quer managed → Qdrant cloud\n4. Zero ops + budget → Pinecone'
    },
    {
      front: 'LangChain RAG — setup minimo',
      back: '**Dependencias:**\n`pip install langchain langchain-openai chromadb`\n\n**Pipeline:**\n\`\`\`python\n# 1. Carregar documentos\nloader = DirectoryLoader("./docs/", glob="**/*.md")\ndocs = loader.load()\n\n# 2. Dividir em chunks\nsplitter = RecursiveCharacterTextSplitter(\n    chunk_size=800, chunk_overlap=150\n)\nchunks = splitter.split_documents(docs)\n\n# 3. Criar embeddings e indexar\nvectorstore = Chroma.from_documents(\n    chunks, OpenAIEmbeddings(),\n    persist_directory="./chroma_db"\n)\n\n# 4. Query\nqa = RetrievalQA.from_chain_type(\n    llm=ChatOpenAI(temperature=0),\n    retriever=vectorstore.as_retriever(k=4)\n)\nresult = qa.invoke({"query": "pergunta"})\n\`\`\`'
    },
    {
      front: 'RAGAS — metricas de qualidade do RAG',
      back: '**4 metricas principais:**\n\n**Faithfulness (fidelidade)**\nResposta e baseada nos docs recuperados?\n> 0.8 = bom | < 0.6 = alucinando\n\n**Answer Relevancy (relevancia)**\nResposta responde a pergunta?\n> 0.8 = bom | < 0.6 = off-topic\n\n**Context Precision (precisao)**\nDocs recuperados sao relevantes?\n> 0.7 = bom | < 0.5 = busca ruim\n\n**Context Recall (cobertura)**\nDocs importantes foram encontrados?\n> 0.7 = bom | < 0.5 = indexacao incompleta\n\n**Como usar:**\n\`\`\`python\nfrom ragas import evaluate\nfrom ragas.metrics import faithfulness, answer_relevancy\n\nresult = evaluate(dataset, metrics=[\n    faithfulness, answer_relevancy\n])\nprint(result) # scores por metrica\n\`\`\`'
    },
    {
      front: 'Boas praticas de indexacao para runbooks',
      back: '**Documentos bons para RAG:**\n✅ Runbooks estruturados com passos claros\n✅ Postmortems com causa raiz documentada\n✅ ADRs com contexto e decisao\n✅ READMEs com exemplos reais\n\n**Documentos ruins para RAG:**\n❌ Docs antigas e desatualizadas\n❌ Configs com credenciais\n❌ Logs de debug\n❌ Docs sem data/autor/servico\n\n**Chunking para runbooks:**\n\`\`\`python\nsplitter = RecursiveCharacterTextSplitter(\n    chunk_size=800,\n    chunk_overlap=150,\n    separators=["\\n## ", "\\n### ", "\\n\\n"]\n)\n\`\`\`\nPrefira quebrar em headings, nao\nno meio de procedimentos.\n\n**Metadados essenciais:**\nservico, tipo_doc, data_atualizacao, time'
    },
    {
      front: 'RAG no Kubernetes — deploy em producao',
      back: '**Componentes do sistema:**\n\`\`\`\nDocumentos (Git/Confluence)\n  ↓ [Ingestion Job - CronJob K8s]\nVector Store (Qdrant/Chroma)\n  ↓ [RAG API - Deployment K8s]\nChatbot / Slack Bot / Web UI\n\`\`\`\n\n**CronJob para re-indexacao:**\n\`\`\`yaml\napiVersion: batch/v1\nkind: CronJob\nmetadata:\n  name: rag-reindex\nspec:\n  schedule: "0 2 * * *"  # 2am daily\n  jobTemplate:\n    spec:\n      template:\n        spec:\n          containers:\n          - name: reindex\n            image: myco/rag-ingest:v1\n            env:\n            - name: CONFLUENCE_KEY\n              valueFrom:\n                secretKeyRef:\n                  name: ai-creds\n                  key: confluence-key\n\`\`\`\n\n**Seguranca:**\n- Secret para API keys\n- PVC para vector store\n- Nunca indexar .env ou secrets'
    }
  ],
  lab: {
    scenario: 'Voce vai construir um sistema RAG simples para busca em runbooks do time. O sistema indexara arquivos Markdown de um repositorio e permitira perguntas em linguagem natural sobre os procedimentos.',
    objective: 'Implementar um pipeline RAG completo: ingestao de documentos, criacao de vector store com Chroma, e interface de query — sem dependencia de servicos externos (tudo local).',
    duration: '30-40 minutos',
    steps: [
      {
        title: 'Configurar o ambiente RAG local',
        instruction: `Instale as dependencias e configure o ambiente para o pipeline RAG. Usaremos Chroma (local) e sentence-transformers (embeddings gratuitos, sem API key necessaria).`,
        hints: [
          'sentence-transformers usa modelos de embedding open-source que rodam localmente',
          'Chroma armazena o banco vetorial localmente no disco',
          'Voce nao precisa de API key para o setup inicial'
        ],
        solution: `\`\`\`bash
# Criar diretorio do projeto
mkdir runbook-rag && cd runbook-rag

# Instalar dependencias (ambiente Python 3.9+)
pip install langchain langchain-community chromadb sentence-transformers

# Criar estrutura de diretorios
mkdir -p runbooks vectorstore

# Criar runbooks de exemplo para teste
cat > runbooks/payments-rollback.md << 'EOF'
# Rollback do Servico Payments

## Quando usar
Use esse runbook quando o deploy do payments causar degradacao de performance
ou erros 5xx acima de 1%.

## Pre-requisitos
- Acesso ao cluster Kubernetes (namespace: payments-prod)
- Helm 3.x instalado
- Acesso ao repositorio de config: github.com/myco/platform-config

## Procedimento de Rollback

### 1. Verificar a versao atual
\`\`\`bash
kubectl rollout history deployment/payments-api -n payments-prod
helm history payments-api -n payments-prod
\`\`\`

### 2. Executar o rollback
\`\`\`bash
# Via Helm (preferido)
helm rollback payments-api 0 -n payments-prod  # 0 = versao anterior

# Via kubectl (emergencia)
kubectl rollout undo deployment/payments-api -n payments-prod
\`\`\`

### 3. Verificar o rollback
\`\`\`bash
kubectl rollout status deployment/payments-api -n payments-prod
kubectl get pods -n payments-prod -l app=payments-api
\`\`\`

### 4. Notificar o time
Enviar mensagem no canal #incidents com:
- Versao revertida
- Horario do rollback
- Razao do rollback
EOF

cat > runbooks/database-failover.md << 'EOF'
# Failover do Banco de Dados PostgreSQL

## Quando usar
Quando o node primario do PostgreSQL ficar unavailable por mais de 5 minutos.

## Componentes
- PostgreSQL 14 com streaming replication
- Patroni para HA management
- Namespace: database-prod

## Procedimento de Failover Manual

### 1. Verificar o status do cluster Patroni
\`\`\`bash
kubectl exec -it patroni-0 -n database-prod -- patronictl list
\`\`\`

### 2. Iniciar failover
\`\`\`bash
kubectl exec -it patroni-0 -n database-prod -- \\
  patronictl failover postgres-cluster --master patroni-0 --candidate patroni-1
\`\`\`

### 3. Verificar o novo primario
\`\`\`bash
kubectl exec -it patroni-1 -n database-prod -- \\
  patronictl list
\`\`\`

## SLA
RTO: 2 minutos | RPO: 0 (replication sincrona)
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verificar instalacao das bibliotecas
python3 -c "import langchain; import chromadb; import sentence_transformers; print('OK')"
# Saida esperada: OK

# Verificar arquivos de runbook
ls runbooks/
# Saida esperada:
# database-failover.md  payments-rollback.md

wc -l runbooks/*.md
# Saida esperada: total de mais de 50 linhas
\`\`\``
      },
      {
        title: 'Indexar os runbooks no vector store',
        instruction: `Crie o script de ingestao que carrega os runbooks, divide em chunks, gera embeddings e armazena no Chroma. Use embeddings locais (sem API key necessaria).`,
        hints: [
          'HuggingFaceEmbeddings usa modelos locais gratuitos',
          'chunk_overlap garante continuidade entre chunks',
          'persist_directory salva o banco vetorial no disco'
        ],
        solution: `\`\`\`python
# ingest.py
from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings

# 1. Carregar documentos
print("Carregando runbooks...")
loader = DirectoryLoader(
    './runbooks/',
    glob='**/*.md',
    loader_cls=TextLoader,
    loader_kwargs={'encoding': 'utf-8'}
)
docs = loader.load()
print(f"Carregados {len(docs)} documentos")

# 2. Dividir em chunks
splitter = RecursiveCharacterTextSplitter(
    chunk_size=800,
    chunk_overlap=150,
    separators=['\\n## ', '\\n### ', '\\n\\n', '\\n', ' ']
)
chunks = splitter.split_documents(docs)
print(f"Criados {len(chunks)} chunks")

# 3. Gerar embeddings (modelo local, sem API key)
print("Gerando embeddings (pode demorar na primeira vez)...")
embeddings = HuggingFaceEmbeddings(
    model_name='sentence-transformers/all-MiniLM-L6-v2'
)

# 4. Criar e persistir o vector store
print("Criando vector store...")
vectorstore = Chroma.from_documents(
    documents=chunks,
    embedding=embeddings,
    persist_directory='./vectorstore'
)
vectorstore.persist()
print("Vector store criado com sucesso!")
print(f"Total de documentos indexados: {vectorstore._collection.count()}")
\`\`\`

\`\`\`bash
# Executar o script de ingestao
python3 ingest.py
\`\`\``,
        verify: `\`\`\`bash
# Verificar que o vector store foi criado
ls vectorstore/
# Saida esperada: arquivos do Chroma (chroma.sqlite3, etc)

# Verificar com Python
python3 - << 'EOF'
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings

embeddings = HuggingFaceEmbeddings(model_name='sentence-transformers/all-MiniLM-L6-v2')
vectorstore = Chroma(persist_directory='./vectorstore', embedding_function=embeddings)
count = vectorstore._collection.count()
print(f"Documentos indexados: {count}")
# Saida esperada: Documentos indexados: N (> 0)
EOF
\`\`\``
      },
      {
        title: 'Criar interface de query RAG',
        instruction: `Crie o script de query que usa o vector store para responder perguntas sobre os runbooks. Implemente tanto com modelo local (usando apenas o contexto recuperado) quanto com OpenAI (se disponivel).`,
        hints: [
          'O retriever retorna os K documentos mais similares',
          'Voce pode usar o contexto sem um LLM (apenas retornar os chunks relevantes)',
          'Se tiver OPENAI_API_KEY, pode gerar uma resposta sintetizada'
        ],
        solution: `\`\`\`python
# query.py
import os
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings

# Carregar vector store
embeddings = HuggingFaceEmbeddings(model_name='sentence-transformers/all-MiniLM-L6-v2')
vectorstore = Chroma(persist_directory='./vectorstore', embedding_function=embeddings)

def search_runbooks(query: str, k: int = 3):
    """Busca documentos relevantes para a query"""
    docs = vectorstore.similarity_search(query, k=k)
    return docs

def answer_question(query: str):
    """Responde uma pergunta usando RAG"""
    print(f"\\nPergunta: {query}")
    print("-" * 50)

    # Recuperar documentos relevantes
    relevant_docs = search_runbooks(query, k=3)

    print(f"Documentos relevantes encontrados: {len(relevant_docs)}")
    for i, doc in enumerate(relevant_docs, 1):
        source = doc.metadata.get('source', 'desconhecido')
        print(f"\\n[Fonte {i}]: {source}")
        print(doc.page_content[:300] + "..." if len(doc.page_content) > 300 else doc.page_content)

    # Se tiver OpenAI API key, gerar resposta sintetizada
    if os.getenv('OPENAI_API_KEY'):
        from langchain_openai import ChatOpenAI
        from langchain.chains import RetrievalQA

        llm = ChatOpenAI(model='gpt-4o-mini', temperature=0)
        qa = RetrievalQA.from_chain_type(
            llm=llm,
            retriever=vectorstore.as_retriever(search_kwargs={'k': 3}),
            return_source_documents=True
        )
        result = qa.invoke({'query': query})
        print(f"\\nResposta sintetizada:")
        print(result['result'])

if __name__ == '__main__':
    # Testar com perguntas reais
    perguntas = [
        "Como fazer rollback do servico payments?",
        "Qual e o procedimento de failover do banco de dados?",
        "Como verificar o status do cluster Patroni?"
    ]

    for pergunta in perguntas:
        answer_question(pergunta)
        print("\\n" + "=" * 60)
\`\`\`

\`\`\`bash
# Executar as queries de teste
python3 query.py
\`\`\``,
        verify: `\`\`\`bash
# Testar o script de query
python3 query.py 2>&1 | head -30

# Saida esperada:
# Pergunta: Como fazer rollback do servico payments?
# --------------------------------------------------
# Documentos relevantes encontrados: 3
# [Fonte 1]: runbooks/payments-rollback.md
# (conteudo do runbook de rollback)

# Verificar que a busca retorna resultados relevantes
python3 - << 'EOF'
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings

embeddings = HuggingFaceEmbeddings(model_name='sentence-transformers/all-MiniLM-L6-v2')
vs = Chroma(persist_directory='./vectorstore', embedding_function=embeddings)
docs = vs.similarity_search("rollback payments", k=2)
assert len(docs) > 0, "Nenhum documento encontrado"
assert 'payments' in docs[0].page_content.lower(), "Documento irrelevante retornado"
print("Busca funcionando corretamente!")
EOF
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'RAG retorna documentos irrelevantes para as perguntas',
      difficulty: 'medium',
      symptom: 'O sistema RAG esta retornando chunks de documentos que nao sao relevantes para a pergunta do usuario. Por exemplo, uma pergunta sobre "rollback do payments" retorna chunks do runbook de "database failover".',
      diagnosis: `\`\`\`bash
# 1. Testar a busca diretamente para ver os scores
python3 - << 'EOF'
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings

embeddings = HuggingFaceEmbeddings(model_name='sentence-transformers/all-MiniLM-L6-v2')
vs = Chroma(persist_directory='./vectorstore', embedding_function=embeddings)

# Busca com scores de similaridade
results = vs.similarity_search_with_score("rollback payments", k=5)
for doc, score in results:
    print(f"Score: {score:.4f} | Source: {doc.metadata.get('source', 'N/A')}")
    print(f"Preview: {doc.page_content[:100]}\\n")
EOF

# Score < 0.3 indica baixa similaridade (dependendo do modelo)
# Muitos resultados com scores similares indicam chunks genericos
\`\`\``,
      solution: `**Causas e solucoes:**

**1. Modelo de embedding inadequado:**
O modelo all-MiniLM-L6-v2 e bom para uso geral mas pode ser impreciso para jargao tecnico.
\`\`\`python
# Testar com modelo mais potente
embeddings = HuggingFaceEmbeddings(
    model_name='sentence-transformers/all-mpnet-base-v2'
)
\`\`\`

**2. Chunks muito grandes — perde precisao:**
\`\`\`python
# Reduzir chunk_size para maior precisao
splitter = RecursiveCharacterTextSplitter(
    chunk_size=400,    # menor = mais preciso
    chunk_overlap=100
)
\`\`\`

**3. Adicionar threshold de similaridade:**
\`\`\`python
# Retornar apenas docs com score acima do threshold
retriever = vectorstore.as_retriever(
    search_type='similarity_score_threshold',
    search_kwargs={'score_threshold': 0.5, 'k': 4}
)
\`\`\`

**4. Re-indexar com metadados e usar filtros:**
\`\`\`python
# Indexar com tag de servico
doc.metadata['service'] = 'payments'

# Filtrar por servico na busca
retriever = vectorstore.as_retriever(
    search_kwargs={'k': 3, 'filter': {'service': 'payments'}}
)
\`\`\``
    },
    {
      title: 'Re-indexacao falha ou vector store corrompido',
      difficulty: 'easy',
      symptom: 'Apos adicionar novos runbooks e rodar o script de ingestao novamente, os novos documentos nao aparecem nas buscas. Ou o script de ingestao falha com "Collection already exists".',
      diagnosis: `\`\`\`bash
# 1. Verificar o estado do vector store
python3 - << 'EOF'
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings

embeddings = HuggingFaceEmbeddings(model_name='sentence-transformers/all-MiniLM-L6-v2')
vs = Chroma(persist_directory='./vectorstore', embedding_function=embeddings)
print(f"Total de chunks: {vs._collection.count()}")
print(f"Collections: {vs._client.list_collections()}")
EOF

# 2. Verificar se ha erro de escrita
ls -la vectorstore/
# Verificar permissoes e espaco em disco
\`\`\``,
      solution: `**Solucao 1 — Re-indexacao incremental:**
\`\`\`python
# Adicionar apenas documentos novos (verificar por source)
existing_sources = set(
    doc['source'] for doc in vectorstore.get()['metadatas']
    if doc and 'source' in doc
)
new_docs = [doc for doc in all_docs if doc.metadata['source'] not in existing_sources]
if new_docs:
    vectorstore.add_documents(new_docs)
    print(f"Adicionados {len(new_docs)} novos documentos")
\`\`\`

**Solucao 2 — Re-indexacao completa (mais simples):**
\`\`\`bash
# Deletar o vector store e re-indexar tudo
rm -rf ./vectorstore/
python3 ingest.py
\`\`\`

**Solucao 3 — Collection com nome unico:**
\`\`\`python
# Usar nome de collection versionado
import datetime
collection_name = f"runbooks_{datetime.date.today().strftime('%Y%m%d')}"
vectorstore = Chroma(
    collection_name=collection_name,
    embedding_function=embeddings,
    persist_directory='./vectorstore'
)
\`\`\``
    }
  ]
};
