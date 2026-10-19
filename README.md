# DocMind AI – PDF RAG Chatbot

An AI-powered PDF question-answering application built using **Retrieval-Augmented Generation (RAG)**. Upload PDF documents, ask questions in natural language, and receive context-aware answers with source page references.

## 🚀 Features

- Upload and process PDF documents
- Extract text and split it into overlapping chunks
- Generate embeddings using Ollama
- Store document vectors in ChromaDB
- Perform semantic search and BM25 keyword search
- Combine results using Reciprocal Rank Fusion (RRF)
- Rerank relevant chunks using a Cross-Encoder
- Generate grounded answers using Google Gemini
- Support document summaries and resume evaluation
- Delete uploaded documents and their indexed data

## 🏗️ Architecture

```text
             User
              |
              v
       React Frontend
              |
          HTTP Requests
              |
              v
       FastAPI Backend
              |
       +------+------+
       |             |
       v             v
  PDF Ingestion   Query Processing
       |             |
  Extract Text    Semantic Search
       |           + BM25 Search
  Chunk Text          |
       |              v
  Ollama Embeddings  RRF Fusion
       |              |
       v              v
    ChromaDB      Cross-Encoder
                      |
                      v
                Google Gemini
                      |
                      v
              Answer + Sources
```

## 🔄 How It Works

1. **PDF Upload:** The backend validates and saves the uploaded PDF.
2. **Text Extraction:** `pypdf` extracts text from individual pages.
3. **Chunking:** The extracted text is divided into overlapping chunks.
4. **Embedding:** Ollama converts each chunk into a numerical vector.
5. **Storage:** ChromaDB stores vectors, text chunks, and page metadata.
6. **Hybrid Retrieval:** Semantic search and BM25 retrieve relevant content.
7. **Reranking:** Reciprocal Rank Fusion combines results, and a Cross-Encoder ranks the candidates.
8. **Answer Generation:** Google Gemini generates an answer using the retrieved context.
9. **Source References:** The application returns the answer with document and page information.

## 🛠️ Tech Stack

| Component | Technologies |
|---|---|
| Frontend | React, TypeScript, TanStack Start, Vite |
| UI | Tailwind CSS, Radix UI |
| Backend | Python, FastAPI, Uvicorn |
| PDF Processing | pypdf, LangChain Text Splitters |
| Embeddings | Ollama, `nomic-embed-text` |
| Vector Database | ChromaDB |
| Retrieval | BM25, Reciprocal Rank Fusion |
| Reranking | Cross-Encoder |
| LLM | Google Gemini |

## 📂 Project Structure

```text
pdf-rag-chatbot/
├── api/              # FastAPI routes
├── frontend/         # React frontend
├── ingestion/        # PDF extraction and chunking
├── retrieval/        # Search, reranking and generation
├── vectorstore/      # ChromaDB storage
├── evaluation/       # Retrieval evaluation
├── data/             # Uploaded PDFs
├── config.py         # Application configuration
├── main.py           # Backend entry point
├── requirements.txt  # Python dependencies
└── README.md
```

## ⚙️ Setup and Installation

### Prerequisites

- Python 3.10+
- Node.js 18+
- npm
- [Ollama](https://ollama.com/)
- Google Gemini API key

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd pdf-rag-chatbot
```

### 2. Set Up the Backend

```bash
python -m venv .venv
```

Activate the environment on Windows:

```powershell
.venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r requirements.txt
```

### 3. Configure Environment Variables

Create a `.env` file from the provided template:

```powershell
Copy-Item .env.example .env
```

Add your Gemini API key:

```env
GEMINI_API_KEY=your-gemini-api-key
```

### 4. Install the Embedding Model

```bash
ollama pull nomic-embed-text
```

Ensure the Ollama service is running.

### 5. Start the Backend

From the repository root:

```bash
python -m uvicorn api.main:app --reload --port 8000
```

API documentation: http://localhost:8000/docs

### 6. Start the Frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local frontend URL shown in the terminal, typically http://localhost:5173.

## 🔌 API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/` | Health check |
| POST | `/upload` | Upload and index a PDF |
| POST | `/query` | Ask questions about a document |
| DELETE | `/documents/{document_id}` | Delete a document and its indexed chunks |

## 🔐 Security and Configuration

- Store API keys in `.env` and never commit secrets.
- Configure CORS for trusted frontend origins.
- Persist uploaded PDFs and ChromaDB data.
- Configure HTTPS before production deployment.

## 🎯 Key Learning Outcomes

- Implementing an end-to-end RAG pipeline
- Building hybrid semantic and keyword retrieval
- Improving retrieval quality through reranking
- Integrating local embedding models with a cloud LLM
- Developing APIs using FastAPI
- Connecting a React frontend to an AI backend

## 📌 Future Enhancements

- Deploy the frontend and backend to production.
- Add authentication and user-specific document management.
- Support multiple document formats.
- Add automated retrieval evaluation and performance monitoring.

