window.K8S_CONTENT_EN = window.K8S_CONTENT_EN || {};
window.K8S_CONTENT_EN['ai-engineering/rag-platform'] = {
  theory: `
# RAG: Documentation and Runbooks with AI

## Relevance
RAG (Retrieval Augmented Generation) solves the fundamental problem with LLMs: they don't know what's in your internal documentation, runbooks, ADRs (Architecture Decision Records), or the current state of your infrastructure. With RAG, you connect the LLM to your proprietary knowledge without retraining the model.

## What RAG Is (without math)

### Core concept

\`\`\`
Question → [Search] → Relevant documents → [LLM + documents] → Grounded answer
\`\`\`

Instead of relying solely on the LLM's training knowledge (which may be outdated and lacks your documents), RAG:

1. **Indexes** your documents (embeddings — numerical representations of meaning)
2. **Searches** for the most relevant ones for the question
3. **Injects** those documents into the LLM's context
4. The LLM **answers** based on real documents, not just training

### Practical analogy

\`\`\`
WITHOUT RAG: "How do I deploy service X?"
LLM answers with generic training patterns
— may be wrong for your specific environment

WITH RAG: "How do I deploy service X?"
→ Fetches service X runbook, deploy history, last relevant ADR
→ LLM answers based on YOUR real documents
— specific answer for your environment
\`\`\`

## Use Cases for DevOps/SRE

### 1. Runbook Search

Problem: runbooks scattered across Confluence, Notion, Google Docs, Git repositories.
With RAG: "What is the rollback procedure for the payments service?" → searches real runbooks.

### 2. Incident Similarity Search

Problem: new incident looks familiar but nobody remembers the postmortem.
With RAG: "We have OOMKilled pods in the payments namespace" → searches similar historical incidents.

### 3. Internal API Documentation Chat

Problem: developers don't know how to use the internal API.
With RAG: chatbot about your OpenAPI spec documentation.

### 4. Automated Onboarding

Problem: new engineers lost with scattered docs.
With RAG: "How do I set up the dev environment?" → answers based on team's real docs.

## RAG Stack for Platform Teams

### Option 1: Productivity Tools (no code)

\`\`\`
Notion AI           → RAG over Notion pages (native)
Confluence AI       → RAG over Confluence (native)
GitHub Copilot      → RAG over the repository (via @workspace)
Cursor              → RAG over local codebase
\`\`\`

### Option 2: Cursor for Codebase RAG

Cursor is a VS Code-based editor with native RAG over the codebase:

\`\`\`
Automatic repository indexing
Chat with real code context:
  "How does the authentication module handle refresh tokens?"
  → Cursor searches relevant code and answers based on it

Ideal for:
- Understanding unfamiliar codebases
- Answering questions about specific implementation
- Navigating large repositories
\`\`\`

### Option 3: Custom RAG (LangChain + Chroma/Qdrant)

For cases where you want full control:

\`\`\`python
# Minimal setup with LangChain + Chroma (local)
from langchain_community.document_loaders import DirectoryLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain.chains import RetrievalQA

# 1. Load documents
loader = DirectoryLoader('./runbooks/', glob='**/*.md')
docs = loader.load()

# 2. Split into chunks
splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200
)
chunks = splitter.split_documents(docs)

# 3. Create vector store
embeddings = OpenAIEmbeddings()
vectorstore = Chroma.from_documents(chunks, embeddings, persist_directory='./chroma_db')

# 4. Create QA chain
llm = ChatOpenAI(model='gpt-4o-mini', temperature=0)
qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    retriever=vectorstore.as_retriever(search_kwargs={'k': 4}),
    return_source_documents=True
)

# 5. Use it
result = qa_chain.invoke({'query': 'How to rollback the payments service?'})
print(result['result'])
print('Sources:', [doc.metadata['source'] for doc in result['source_documents']])
\`\`\`

### Vector Databases — options

\`\`\`
Chroma    → Local, zero infra, ideal for POC and small teams
Qdrant    → Self-hosted or cloud, production-ready, good performance
Pinecone  → Cloud managed, zero ops, more expensive
pgvector  → PostgreSQL extension, ideal if you already have Postgres
Weaviate  → Open source, good for structured data + text
\`\`\`

## Implementing RAG for Runbooks on Kubernetes

### Project structure

\`\`\`
runbook-rag/
├── ingest/
│   ├── load_confluence.py    # loads from Confluence API
│   ├── load_github.py        # loads from Git repos
│   └── load_files.py         # loads local files
├── vectorstore/
│   └── chroma_db/            # local vector database
├── api/
│   └── query.py              # search endpoint
└── config.yaml               # source configuration
\`\`\`

### Ingesting documents from Confluence

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

### Deploying RAG as a microservice on Kubernetes

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

## RAG Evaluation with RAGAS

RAGAS (RAG Assessment) is a framework for measuring the quality of your RAG system:

\`\`\`python
from ragas import evaluate
from ragas.metrics import (
    faithfulness,           # is the answer faithful to retrieved docs?
    answer_relevancy,       # is the answer relevant to the question?
    context_precision,      # are retrieved docs precise?
    context_recall          # were relevant docs retrieved?
)

# Evaluation dataset (questions + expected answers + context)
eval_dataset = [
    {
        'question': 'How to rollback the payments service?',
        'answer': rag_answer,
        'contexts': [doc.page_content for doc in retrieved_docs],
        'ground_truth': 'The payments rollback uses helm rollback...'
    }
]

result = evaluate(eval_dataset, metrics=[
    faithfulness,
    answer_relevancy,
    context_precision,
    context_recall
])
print(result)
# faithfulness: 0.92  (answer faithful to docs? good)
# answer_relevancy: 0.87 (relevant to question? good)
# context_precision: 0.78 (correct docs retrieved? can improve)
\`\`\`

### Interpreting metrics

\`\`\`
Faithfulness:
> 0.8 = good. LLM is answering based on the documents
< 0.6 = problem: LLM is "hallucinating" beyond the documents

Answer Relevancy:
> 0.8 = good. Answer responds to the question
< 0.6 = off-topic or too generic

Context Precision:
> 0.7 = good. Retrieved docs are relevant
< 0.5 = problem: bad search, retrieving noise with signal

Context Recall:
> 0.7 = good. Relevant docs are being found
< 0.5 = problem: important docs aren't indexed
\`\`\`

## RAG Best Practices for Infra Teams

### Document quality is fundamental

\`\`\`markdown
✅ Good for RAG:
- Runbooks with clear, structured steps
- Postmortems with documented root causes
- ADRs with context and clear decisions
- READMEs with real command examples

❌ Bad for RAG:
- Old, outdated documents
- Generic wiki pages without specific details
- Sensitive data (passwords, tokens) mixed in text
- Documents without metadata (date, author, service)
\`\`\`

### Strategic chunking

\`\`\`python
# For runbooks: split by section, not fixed size
# Avoids cutting in the middle of a procedure

splitter = RecursiveCharacterTextSplitter(
    chunk_size=800,          # smaller = more precise, larger = more context
    chunk_overlap=150,       # overlap ensures continuity between chunks
    separators=['\\n## ', '\\n### ', '\\n\\n', '\\n', ' ']  # prefer to break at headings
)
\`\`\`

### Metadata for filtering

\`\`\`python
# Add metadata to documents for filtering by service, date, type
docs_with_metadata = []
for doc in docs:
    doc.metadata.update({
        'service': extract_service_from_path(doc.metadata['source']),
        'doc_type': 'runbook',
        'last_updated': '2024-01-15',
        'team': 'platform-engineering'
    })
    docs_with_metadata.append(doc)

# Filtered search:
retriever = vectorstore.as_retriever(
    search_kwargs={
        'k': 4,
        'filter': {'service': 'payments', 'doc_type': 'runbook'}
    }
)
\`\`\`

## Common Mistakes

1. **Indexing everything without filtering** — including debug logs, configs with passwords, sensitive data
2. **Chunks too large** — losing search precision
3. **Not updating the index** — runbooks change, the index needs periodic re-indexing
4. **Not evaluating with RAGAS** — assuming it works without measuring quality
5. **Response without source** — always show which document the answer came from

## Killer.sh Style Challenge

> **Scenario:** Your team has 200+ runbooks in a Git repository and 500+ postmortems in Confluence. You want to create an internal chatbot that answers questions about incidents and recovery procedures. Describe:
> 1. The RAG system architecture (components and flow)
> 2. How to update the index when new runbooks are added
> 3. How to ensure sensitive data (credentials in configs) is not indexed
`,
  quiz: [
    {
      question: 'What fundamental problem does RAG solve for DevOps/SRE teams?',
      options: [
        'RAG makes LLMs faster and cheaper',
        'LLMs don\'t know your internal documentation, runbooks, and current infra state — RAG connects the model to your proprietary knowledge without needing to retrain',
        'RAG completely eliminates hallucinations in any context',
        'RAG allows LLMs to access the Kubernetes cluster in real time'
      ],
      correct: 1,
      explanation: 'The core problem is that LLMs are trained on public data up to a cutoff date. They don\'t know what\'s in your internal runbooks, postmortems, ADRs, or proprietary documentation. RAG solves this: indexes your documents, searches for those relevant to each question, and injects them as context so the LLM can answer based on your real knowledge.',
      reference: 'Related concept: knowledge cutoff is the problem that motivates RAG — the model doesn\'t know what happened after training, much less what exists only internally.'
    },
    {
      question: 'Which vector database is most appropriate for a RAG POC at a small team without additional infrastructure?',
      options: [
        'Pinecone — it\'s the most famous in the market',
        'Qdrant — it has the best performance',
        'Chroma — runs locally without additional infrastructure, ideal for POC and small teams',
        'pgvector — any team already has PostgreSQL'
      ],
      correct: 2,
      explanation: 'Chroma runs completely locally (or in memory), requires no additional infrastructure, and is the ideal choice for POC and proof of concept. For production at scale, Qdrant (self-hosted) or pgvector (if you already have Postgres) are better. Pinecone is excellent but has cost and external service dependency.',
      reference: 'Architecture decision: start with local Chroma, validate the utility of RAG, then migrate to Qdrant or pgvector for production.'
    },
    {
      question: 'What does the RAGAS "faithfulness" metric measure in a RAG system?',
      options: [
        'Whether the RAG system returns fast responses',
        'Whether the LLM\'s answer is grounded/based on the retrieved documents — or if the LLM is "hallucinating" beyond what the documents say',
        'Whether the indexed documents are high quality',
        'Whether the user\'s question is clear and well-formulated'
      ],
      correct: 1,
      explanation: 'Faithfulness measures whether the answer generated by the LLM is actually based on the retrieved documents. A low faithfulness (<0.6) indicates the LLM is inventing information beyond what the documents show — hallucinating with details not supported by the context. It is the most critical metric for RAG reliability.',
      reference: 'Metric combination: faithfulness + answer_relevancy + context_precision + context_recall give a complete view of RAG quality.'
    },
    {
      question: 'Why is adding metadata (service, type, date) to documents when indexing for RAG important?',
      options: [
        'Metadata improves indexing speed',
        'Metadata allows filtering searches by service/type/date — preventing a question about "payments" from returning "auth" runbooks or outdated documents',
        'Metadata is required for LangChain to work',
        'Metadata reduces the cost of embeddings'
      ],
      correct: 1,
      explanation: 'Metadata enables filtered search. Without filters, a question about "rollback" may return runbooks from all services. With metadata, you filter by service, document type, update date. This dramatically increases precision (context_precision in RAGAS) and avoids wrong answers based on documents from different contexts.',
      reference: 'Recommended practice: always index with at least: service, doc_type (runbook/postmortem/adr), last_updated, responsible_team.'
    },
    {
      question: 'Why is chunking with overlap (overlap between chunks) important in RAG for runbooks?',
      options: [
        'Overlap increases the number of indexed documents',
        'Overlap ensures information appearing at chunk boundaries isn\'t lost — avoids cutting in the middle of a critical procedure',
        'Overlap is only necessary for PDF documents',
        'Overlap reduces the cost of embeddings'
      ],
      correct: 1,
      explanation: 'When a runbook is divided into chunks, a critical procedure may be split between two chunks. Without overlap, the final part of step 3 and the beginning of step 4 are in different chunks without shared context. With 150-200 token overlap, both chunks contain the transition, ensuring the search retrieves the complete context of the procedure.',
      reference: 'Chunking tip: for runbooks, prefer hierarchical separators (## headings first) instead of fixed-size chunks — keeps complete procedures in the same chunk.'
    },
    {
      question: 'What is the practical difference between using Cursor/Copilot @workspace and building custom RAG for infrastructure documentation?',
      options: [
        'There is no difference — both do the same thing',
        'Cursor/Copilot @workspace only indexes code in Git repositories; custom RAG indexes any source (Confluence, runbooks, postmortems) with full control over filters, metadata, and quality evaluation',
        'Custom RAG is always better and should be the first choice',
        'Cursor only works with Python, RAG works with any language'
      ],
      correct: 1,
      explanation: 'Cursor and Copilot @workspace are excellent for RAG over code in Git repositories — zero configuration. But for scattered documentation (Confluence, Notion, postmortems in Google Docs, runbooks in various formats), custom RAG allows: indexing any source, adding specific metadata, filtering by service/date, evaluating quality with RAGAS, and controlling sensitive data privacy.',
      reference: 'Build vs buy decision: start with Cursor/Copilot for code. Build custom RAG only when you need non-Git sources or metadata control.'
    },
    {
      question: 'How to ensure credentials and sensitive data are not indexed in the RAG vector store?',
      options: [
        'Encrypt all documents before indexing',
        'Implement pre-processing filters that remove credential patterns, use .ragignore to exclude config files, and never index .env or secrets files',
        'Sensitive data is automatically removed by embeddings',
        'Only use public documents for RAG'
      ],
      correct: 1,
      explanation: 'Sensitive data in the vector store is a real risk — embeddings preserve enough semantics to recover critical information. Mitigations: (1) pre-indexing filter using regex to detect API key, password, token patterns; (2) .ragignore to exclude .env, secrets.yaml, kubeconfigs; (3) document scrubbing before indexing; (4) manual review of new sources before adding to the pipeline.',
      reference: 'Security practice: treat the vector store as sensitive data — controlled access, query auditing, and never expose chunk content directly.'
    }
  ],
  flashcards: [
    {
      front: 'RAG — concept and flow for DevOps',
      back: '**RAG = Retrieval Augmented Generation**\n\n**Flow:**\n\`\`\`\nUser question\n  ↓\n[Vector Search] → finds similar documents\n  ↓\nTop K relevant documents\n  ↓\n[LLM + documents as context]\n  ↓\nAnswer grounded in your docs\n\`\`\`\n\n**Problem it solves:**\nLLMs don\'t know your internal\ndocumentation, runbooks, postmortems,\nand environment-specific configs.\n\n**DevOps use cases:**\n- Runbook chatbot\n- Incident similarity search\n- Internal API docs chat\n- Automated onboarding\n- Postmortem search'
    },
    {
      front: 'Vector Databases — choosing for your case',
      back: '**Chroma** — local, zero infra\n→ POC, small team, no extra infra\n→ `pip install chromadb`\n\n**Qdrant** — self-hosted or cloud\n→ Production, high performance\n→ `docker run qdrant/qdrant`\n\n**pgvector** — PostgreSQL extension\n→ If you already have Postgres, zero new infra\n→ `CREATE EXTENSION vector`\n\n**Pinecone** — cloud managed\n→ Zero ops, pay per use\n→ External service dependency\n\n**Weaviate** — open source\n→ Structured data + text\n\n**Decision rule:**\n1. POC → local Chroma\n2. Prod + already have Postgres → pgvector\n3. Prod + want managed → Qdrant cloud\n4. Zero ops + budget → Pinecone'
    },
    {
      front: 'LangChain RAG — minimal setup',
      back: '**Dependencies:**\n`pip install langchain langchain-openai chromadb`\n\n**Pipeline:**\n\`\`\`python\n# 1. Load documents\nloader = DirectoryLoader("./docs/", glob="**/*.md")\ndocs = loader.load()\n\n# 2. Split into chunks\nsplitter = RecursiveCharacterTextSplitter(\n    chunk_size=800, chunk_overlap=150\n)\nchunks = splitter.split_documents(docs)\n\n# 3. Create embeddings and index\nvectorstore = Chroma.from_documents(\n    chunks, OpenAIEmbeddings(),\n    persist_directory="./chroma_db"\n)\n\n# 4. Query\nqa = RetrievalQA.from_chain_type(\n    llm=ChatOpenAI(temperature=0),\n    retriever=vectorstore.as_retriever(k=4)\n)\nresult = qa.invoke({"query": "question"})\n\`\`\`'
    },
    {
      front: 'RAGAS — RAG quality metrics',
      back: '**4 main metrics:**\n\n**Faithfulness**\nIs the answer based on retrieved docs?\n> 0.8 = good | < 0.6 = hallucinating\n\n**Answer Relevancy**\nDoes the answer address the question?\n> 0.8 = good | < 0.6 = off-topic\n\n**Context Precision**\nAre retrieved docs relevant?\n> 0.7 = good | < 0.5 = bad search\n\n**Context Recall**\nWere important docs found?\n> 0.7 = good | < 0.5 = incomplete indexing\n\n**How to use:**\n\`\`\`python\nfrom ragas import evaluate\nfrom ragas.metrics import faithfulness, answer_relevancy\n\nresult = evaluate(dataset, metrics=[\n    faithfulness, answer_relevancy\n])\nprint(result) # scores per metric\n\`\`\`'
    },
    {
      front: 'Indexing best practices for runbooks',
      back: '**Good documents for RAG:**\n✅ Structured runbooks with clear steps\n✅ Postmortems with documented root cause\n✅ ADRs with context and decision\n✅ READMEs with real examples\n\n**Bad documents for RAG:**\n❌ Old, outdated docs\n❌ Configs with credentials\n❌ Debug logs\n❌ Docs without date/author/service\n\n**Chunking for runbooks:**\n\`\`\`python\nsplitter = RecursiveCharacterTextSplitter(\n    chunk_size=800,\n    chunk_overlap=150,\n    separators=["\\n## ", "\\n### ", "\\n\\n"]\n)\n\`\`\`\nPrefer to break at headings, not\nin the middle of procedures.\n\n**Essential metadata:**\nservice, doc_type, last_updated, team'
    },
    {
      front: 'RAG on Kubernetes — production deployment',
      back: '**System components:**\n\`\`\`\nDocuments (Git/Confluence)\n  ↓ [Ingestion Job - K8s CronJob]\nVector Store (Qdrant/Chroma)\n  ↓ [RAG API - K8s Deployment]\nChatbot / Slack Bot / Web UI\n\`\`\`\n\n**CronJob for re-indexing:**\n\`\`\`yaml\napiVersion: batch/v1\nkind: CronJob\nmetadata:\n  name: rag-reindex\nspec:\n  schedule: "0 2 * * *"  # 2am daily\n  jobTemplate:\n    spec:\n      template:\n        spec:\n          containers:\n          - name: reindex\n            image: myco/rag-ingest:v1\n            env:\n            - name: CONFLUENCE_KEY\n              valueFrom:\n                secretKeyRef:\n                  name: ai-creds\n                  key: confluence-key\n\`\`\`\n\n**Security:**\n- Secret for API keys\n- PVC for vector store\n- Never index .env or secrets'
    }
  ],
  lab: {
    scenario: 'You will build a simple RAG system for searching your team\'s runbooks. The system will index Markdown files from a repository and allow natural language questions about procedures.',
    objective: 'Implement a complete RAG pipeline: document ingestion, vector store creation with Chroma, and query interface — with no external service dependency (everything local).',
    duration: '30-40 minutes',
    steps: [
      {
        title: 'Set up the local RAG environment',
        instruction: `Install dependencies and configure the environment for the RAG pipeline. We will use Chroma (local) and sentence-transformers (free embeddings, no API key required).`,
        hints: [
          'sentence-transformers uses open-source embedding models that run locally',
          'Chroma stores the vector database locally on disk',
          'You don\'t need an API key for the initial setup'
        ],
        solution: `\`\`\`bash
# Create project directory
mkdir runbook-rag && cd runbook-rag

# Install dependencies (Python 3.9+ environment)
pip install langchain langchain-community chromadb sentence-transformers

# Create directory structure
mkdir -p runbooks vectorstore

# Create sample runbooks for testing
cat > runbooks/payments-rollback.md << 'EOF'
# Payments Service Rollback

## When to use
Use this runbook when a payments deploy causes performance degradation
or 5xx errors above 1%.

## Prerequisites
- Kubernetes cluster access (namespace: payments-prod)
- Helm 3.x installed
- Access to config repository: github.com/myco/platform-config

## Rollback Procedure

### 1. Check the current version
\`\`\`bash
kubectl rollout history deployment/payments-api -n payments-prod
helm history payments-api -n payments-prod
\`\`\`

### 2. Execute the rollback
\`\`\`bash
# Via Helm (preferred)
helm rollback payments-api 0 -n payments-prod  # 0 = previous version

# Via kubectl (emergency)
kubectl rollout undo deployment/payments-api -n payments-prod
\`\`\`

### 3. Verify the rollback
\`\`\`bash
kubectl rollout status deployment/payments-api -n payments-prod
kubectl get pods -n payments-prod -l app=payments-api
\`\`\`

### 4. Notify the team
Send a message in #incidents with:
- Reverted version
- Rollback time
- Reason for rollback
EOF
\`\`\``,
        verify: `\`\`\`bash
# Verify library installation
python3 -c "import langchain; import chromadb; import sentence_transformers; print('OK')"
# Expected output: OK

# Verify runbook files
ls runbooks/
# Expected output:
# payments-rollback.md

wc -l runbooks/*.md
# Expected output: total more than 30 lines
\`\`\``
      },
      {
        title: 'Index runbooks in the vector store',
        instruction: `Create the ingestion script that loads runbooks, splits into chunks, generates embeddings, and stores in Chroma. Use local embeddings (no API key required).`,
        hints: [
          'HuggingFaceEmbeddings uses free local models',
          'chunk_overlap ensures continuity between chunks',
          'persist_directory saves the vector database to disk'
        ],
        solution: `\`\`\`python
# ingest.py
from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings

# 1. Load documents
print("Loading runbooks...")
loader = DirectoryLoader(
    './runbooks/',
    glob='**/*.md',
    loader_cls=TextLoader,
    loader_kwargs={'encoding': 'utf-8'}
)
docs = loader.load()
print(f"Loaded {len(docs)} documents")

# 2. Split into chunks
splitter = RecursiveCharacterTextSplitter(
    chunk_size=800,
    chunk_overlap=150,
    separators=['\\n## ', '\\n### ', '\\n\\n', '\\n', ' ']
)
chunks = splitter.split_documents(docs)
print(f"Created {len(chunks)} chunks")

# 3. Generate embeddings (local model, no API key)
print("Generating embeddings (may take a while on first run)...")
embeddings = HuggingFaceEmbeddings(
    model_name='sentence-transformers/all-MiniLM-L6-v2'
)

# 4. Create and persist the vector store
print("Creating vector store...")
vectorstore = Chroma.from_documents(
    documents=chunks,
    embedding=embeddings,
    persist_directory='./vectorstore'
)
vectorstore.persist()
print("Vector store created successfully!")
print(f"Total indexed documents: {vectorstore._collection.count()}")
\`\`\`

\`\`\`bash
# Run the ingestion script
python3 ingest.py
\`\`\``,
        verify: `\`\`\`bash
# Verify the vector store was created
ls vectorstore/
# Expected output: Chroma files (chroma.sqlite3, etc)

# Verify with Python
python3 - << 'EOF'
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings

embeddings = HuggingFaceEmbeddings(model_name='sentence-transformers/all-MiniLM-L6-v2')
vectorstore = Chroma(persist_directory='./vectorstore', embedding_function=embeddings)
count = vectorstore._collection.count()
print(f"Indexed documents: {count}")
# Expected output: Indexed documents: N (> 0)
EOF
\`\`\``
      },
      {
        title: 'Create RAG query interface',
        instruction: `Create the query script that uses the vector store to answer questions about the runbooks. Implement both with a local model (using only retrieved context) and with OpenAI (if available).`,
        hints: [
          'The retriever returns the K most similar documents',
          'You can use the context without an LLM (just return the relevant chunks)',
          'If you have OPENAI_API_KEY, you can generate a synthesized response'
        ],
        solution: `\`\`\`python
# query.py
import os
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings

# Load vector store
embeddings = HuggingFaceEmbeddings(model_name='sentence-transformers/all-MiniLM-L6-v2')
vectorstore = Chroma(persist_directory='./vectorstore', embedding_function=embeddings)

def search_runbooks(query: str, k: int = 3):
    """Search for documents relevant to the query"""
    docs = vectorstore.similarity_search(query, k=k)
    return docs

def answer_question(query: str):
    """Answer a question using RAG"""
    print(f"\\nQuestion: {query}")
    print("-" * 50)

    # Retrieve relevant documents
    relevant_docs = search_runbooks(query, k=3)

    print(f"Relevant documents found: {len(relevant_docs)}")
    for i, doc in enumerate(relevant_docs, 1):
        source = doc.metadata.get('source', 'unknown')
        print(f"\\n[Source {i}]: {source}")
        print(doc.page_content[:300] + "..." if len(doc.page_content) > 300 else doc.page_content)

    # If OpenAI API key is available, generate synthesized response
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
        print(f"\\nSynthesized answer:")
        print(result['result'])

if __name__ == '__main__':
    # Test with real questions
    questions = [
        "How to rollback the payments service?",
        "What is the database failover procedure?",
        "How to check the Patroni cluster status?"
    ]

    for question in questions:
        answer_question(question)
        print("\\n" + "=" * 60)
\`\`\`

\`\`\`bash
# Run query tests
python3 query.py
\`\`\``,
        verify: `\`\`\`bash
# Test the query script
python3 query.py 2>&1 | head -30

# Expected output:
# Question: How to rollback the payments service?
# --------------------------------------------------
# Relevant documents found: 3
# [Source 1]: runbooks/payments-rollback.md
# (runbook content)

# Verify that search returns relevant results
python3 - << 'EOF'
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings

embeddings = HuggingFaceEmbeddings(model_name='sentence-transformers/all-MiniLM-L6-v2')
vs = Chroma(persist_directory='./vectorstore', embedding_function=embeddings)
docs = vs.similarity_search("rollback payments", k=2)
assert len(docs) > 0, "No documents found"
print("Search working correctly!")
EOF
\`\`\``
      }
    ]
  },
  troubleshooting: [
    {
      title: 'RAG returns irrelevant documents for questions',
      difficulty: 'medium',
      symptom: 'The RAG system is returning document chunks that are not relevant to the user\'s question. For example, a question about "payments rollback" returns chunks from the "database failover" runbook.',
      diagnosis: `\`\`\`bash
# 1. Test the search directly to see scores
python3 - << 'EOF'
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings

embeddings = HuggingFaceEmbeddings(model_name='sentence-transformers/all-MiniLM-L6-v2')
vs = Chroma(persist_directory='./vectorstore', embedding_function=embeddings)

# Search with similarity scores
results = vs.similarity_search_with_score("rollback payments", k=5)
for doc, score in results:
    print(f"Score: {score:.4f} | Source: {doc.metadata.get('source', 'N/A')}")
    print(f"Preview: {doc.page_content[:100]}\\n")
EOF

# Score < 0.3 indicates low similarity (depending on model)
# Many results with similar scores indicate generic chunks
\`\`\``,
      solution: `**Causes and solutions:**

**1. Inadequate embedding model:**
The all-MiniLM-L6-v2 model is good for general use but may be imprecise for technical jargon.
\`\`\`python
# Test with a more powerful model
embeddings = HuggingFaceEmbeddings(
    model_name='sentence-transformers/all-mpnet-base-v2'
)
\`\`\`

**2. Chunks too large — loses precision:**
\`\`\`python
# Reduce chunk_size for more precision
splitter = RecursiveCharacterTextSplitter(
    chunk_size=400,    # smaller = more precise
    chunk_overlap=100
)
\`\`\`

**3. Add similarity threshold:**
\`\`\`python
# Only return docs with score above threshold
retriever = vectorstore.as_retriever(
    search_type='similarity_score_threshold',
    search_kwargs={'score_threshold': 0.5, 'k': 4}
)
\`\`\`

**4. Re-index with metadata and use filters:**
\`\`\`python
# Index with service tag
doc.metadata['service'] = 'payments'

# Filter by service in search
retriever = vectorstore.as_retriever(
    search_kwargs={'k': 3, 'filter': {'service': 'payments'}}
)
\`\`\``
    },
    {
      title: 'Re-indexing fails or vector store is corrupted',
      difficulty: 'easy',
      symptom: 'After adding new runbooks and running the ingestion script again, the new documents don\'t appear in searches. Or the ingestion script fails with "Collection already exists".',
      diagnosis: `\`\`\`bash
# 1. Check the vector store state
python3 - << 'EOF'
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings

embeddings = HuggingFaceEmbeddings(model_name='sentence-transformers/all-MiniLM-L6-v2')
vs = Chroma(persist_directory='./vectorstore', embedding_function=embeddings)
print(f"Total chunks: {vs._collection.count()}")
print(f"Collections: {vs._client.list_collections()}")
EOF

# 2. Check for write errors
ls -la vectorstore/
# Check permissions and disk space
\`\`\``,
      solution: `**Solution 1 — Incremental re-indexing:**
\`\`\`python
# Add only new documents (check by source)
existing_sources = set(
    doc['source'] for doc in vectorstore.get()['metadatas']
    if doc and 'source' in doc
)
new_docs = [doc for doc in all_docs if doc.metadata['source'] not in existing_sources]
if new_docs:
    vectorstore.add_documents(new_docs)
    print(f"Added {len(new_docs)} new documents")
\`\`\`

**Solution 2 — Full re-indexing (simpler):**
\`\`\`bash
# Delete the vector store and re-index everything
rm -rf ./vectorstore/
python3 ingest.py
\`\`\`

**Solution 3 — Versioned collection name:**
\`\`\`python
# Use a versioned collection name
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
