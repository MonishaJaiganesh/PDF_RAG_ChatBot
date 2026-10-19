# PDF RAG Chatbot

A chatbot that answers questions using information retrieved from PDF documents.

## Project idea

This project is a PDF question-answering assistant built with retrieval-augmented
generation (RAG). Users upload a PDF, the application extracts and chunks its text,
creates embeddings, and stores the resulting document sections in a vector database.

When a user asks a question, the system combines semantic vector search with BM25
keyword search, merges the results, reranks the most relevant sections, and sends the
selected context to Gemini to generate a grounded answer with source information.

The project is designed for resumes and other structured documents. It supports PDF
upload and indexing, document-specific questions, project and skill discovery,
resume evaluation, document deletion, and configurable retrieval for normal and
comprehensive queries.

## Problem it solves

Important information in resumes and other PDF documents is often difficult to find
quickly. Manually reading long documents for project names, skills, experience,
certifications, or candidate strengths takes time and can lead to missed details.

Basic keyword search also struggles with natural-language questions and related
phrasing. This project solves that problem by combining keyword and semantic search,
reranking the most relevant document sections, and generating answers grounded in
the uploaded PDF. It helps users explore documents conversationally while keeping
answers tied to the source content instead of relying only on unsupported model
knowledge.

## Tech stack

- **Frontend:** React, TypeScript, TanStack Start, TanStack Router, Vite, Tailwind CSS, Radix UI, and Lucide React
- **Backend:** Python, FastAPI, Uvicorn, and Pydantic
- **PDF processing:** `pypdf` and LangChain text splitters
- **Retrieval:** Ollama embeddings, ChromaDB, BM25, Reciprocal Rank Fusion, and Cross-Encoder reranking
- **Generation:** Google Gemini API, with Ollama-based generation support
- **Storage:** ChromaDB persistent vector store and local PDF file storage
- **Configuration:** Python dotenv and environment variables
- **Evaluation:** Recall@K, Precision@K, and Mean Reciprocal Rank (MRR)

## Project structure

```text
pdf-rag-chatbot/
├── api/
│   └── main.py                  # FastAPI endpoints
├── data/                        # Local PDF documents (not committed)
├── evaluation/
│   ├── evaluate.py              # Retrieval evaluation runner
│   └── questions.py             # Evaluation questions and keywords
├── frontend/                    # TanStack Start frontend
│   ├── public/                  # Static assets
│   └── src/
│       ├── components/          # UI and DocMind components
│       ├── hooks/               # React hooks
│       ├── lib/docmind/         # API client and frontend state
│       └── routes/              # Application routes
├── ingestion/
│   ├── chunker.py               # PDF text chunking
│   ├── embedding.py             # Embedding generation
│   └── pdf_loader.py             # PDF loading
├── logs/                        # Application logs (not committed)
├── retrieval/
│   ├── gemini_generation.py     # Gemini response generation
│   ├── generation.py            # Ollama response generation
│   ├── reranker.py              # Cross-encoder reranking
│   └── retriever.py             # Dense, BM25, and hybrid retrieval
├── tests/                       # Automated tests
├── vectorstore/
│   ├── chroma_db/               # Local Chroma data (not committed)
│   ├── chroma_store.py          # Chroma persistence helpers
│   └── faiss_store.py            # FAISS persistence helpers
├── .env.example                 # Environment variable template
├── .gitignore                   # Git exclusions
├── config.py                    # Application configuration
├── logging_config.py            # Logging configuration
├── main.py                      # Backend application entry point
├── README.md                    # Project documentation
└── requirements.txt             # Python dependencies
```

## Production configuration and logs

Copy `.env.example` to `.env` and set deployment-specific values such as
`DATA_DIR`, `VECTORSTORE_DIR`, `LOG_DIR`, `CORS_ORIGINS`, model names, and
`GEMINI_API_KEY`. Relative paths are resolved from the repository root.

Application errors and stack traces are written to `logs/app.log`. The log
rotates when it reaches `LOG_MAX_BYTES` and keeps `LOG_BACKUP_COUNT` files.
Database lock, upload, deletion, Chroma, embedding, reranker, and Gemini
failures include useful context such as the document ID and operation.
