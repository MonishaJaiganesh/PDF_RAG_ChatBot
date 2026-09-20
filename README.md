# PDF RAG Chatbot

A chatbot that answers questions using information retrieved from PDF documents.

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
├── frontend-old/                # Previous frontend implementation
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

