from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import uvicorn
import time
import uuid

from config import (
    CORS_ORIGINS,
    DATA_DIR,
    EVALUATION_TOP_K,
    LIST_QUERY_TOP_K,
    RETRIEVAL_TOP_K,
    UPLOAD_MAX_BYTES,
)
from logging_config import logger
from retrieval.gemini_generation import (
    generate_gemini_chat,
    generate_gemini_document_answer,
    generate_gemini_evaluation,
)
from retrieval.retriever import (
    is_conversational,
    is_evaluation_query,
    is_list_query,
    is_summary_query,
    retrieve_documents,
)

from vectorstore.chroma_store import (
    create_vector_store,
    delete_document_from_vector_store
)


# ==================================================
# FASTAPI APPLICATION
# ==================================================

app = FastAPI(
    title="PDF RAG API",
    description="API for querying PDF documents using RAG",
    version="1.0.0"
)


# ==================================================
# CORS
# ==================================================

app.add_middleware(
    CORSMiddleware,

    allow_origins=CORS_ORIGINS,

    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled API error method=%s path=%s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Check the application log."},
    )


# ==================================================
# REQUEST MODELS
# ==================================================

class QueryRequest(BaseModel):
    question: str
    document_id: str | None = None


# ==================================================
# ROOT ENDPOINT
# ==================================================

@app.get("/")
def root():

    return {
        "message": "PDF RAG API is running"
    }


# ==================================================
# QUERY PDF
# ==================================================

@app.post("/query")
def query_document(request: QueryRequest):

    total_start = time.perf_counter()

    if is_conversational(request.question):
        generation_start = time.perf_counter()
        answer = generate_gemini_chat(request.question)
        return {
            "question": request.question,
            "answer": answer,
            "sources": [],
            "latency": {
                "retrieval_seconds": 0,
                "generation_seconds": round(time.perf_counter() - generation_start, 2),
                "total_seconds": round(time.perf_counter() - total_start, 2),
            },
        }

    if not request.document_id and is_evaluation_query(request.question):
        raise HTTPException(
            status_code=400,
            detail="Select a PDF before asking for a resume evaluation.",
        )

    if not request.document_id:
        generation_start = time.perf_counter()
        answer = generate_gemini_chat(request.question)
        return {
            "question": request.question,
            "answer": answer,
            "sources": [],
            "latency": {
                "retrieval_seconds": 0,
                "generation_seconds": round(time.perf_counter() - generation_start, 2),
                "total_seconds": round(time.perf_counter() - total_start, 2),
            },
        }

    # ------------------------------------------------
    # RETRIEVAL
    # ------------------------------------------------

    retrieval_start = time.perf_counter()

    evaluation_query = is_evaluation_query(request.question)
    list_query = is_list_query(request.question)
    retrieved_documents = retrieve_documents(
        request.question,
        top_k=(
            EVALUATION_TOP_K
            if evaluation_query
            else LIST_QUERY_TOP_K
            if list_query
            else RETRIEVAL_TOP_K
        ),
        document_id=request.document_id
    )

    retrieval_time = (
        time.perf_counter()
        - retrieval_start
    )


    # ------------------------------------------------
    # LLM GENERATION
    # ------------------------------------------------

    generation_start = time.perf_counter()

    if evaluation_query:
        answer = generate_gemini_evaluation(request.question, retrieved_documents)
    else:
        answer = generate_gemini_document_answer(
            request.question,
            retrieved_documents,
        )

    generation_time = (
        time.perf_counter()
        - generation_start
    )


    # ------------------------------------------------
    # TOTAL LATENCY
    # ------------------------------------------------

    total_time = (
        time.perf_counter()
        - total_start
    )


    # ------------------------------------------------
    # SOURCES / CITATIONS
    # ------------------------------------------------

    sources = []

    for i, document in enumerate(
        retrieved_documents
    ):

        sources.append({

            "id": i + 1,

            "page": document["page"],

            "text": document["text"],
            "snippet": document["text"],
            "document": document.get("document"),

            # Semantic distance may not exist
            # for BM25-only results
            "distance": round(
                document.get("distance", 0),
                4
            ),

            # Hybrid RRF score
            "hybrid_score": round(
                document.get(
                    "hybrid_score",
                    0
                ),
                5
            ),

            "reranker_score": round(
                document.get(
                    "reranker_score",
                    0
                ),
                5
            ),

            "document_id": document.get(
                "document_id"
            )
        })


    # ------------------------------------------------
    # RESPONSE
    # ------------------------------------------------

    return {

        "question": request.question,

        "answer": answer,

        "sources": sources,

        "latency": {

            "retrieval_seconds": round(
                retrieval_time,
                2
            ),

            "generation_seconds": round(
                generation_time,
                2
            ),

            "total_seconds": round(
                total_time,
                2
            )
        }
    }


# ==================================================
# UPLOAD PDF
# ==================================================

@app.post("/upload")
async def upload_pdf(
    file: UploadFile = File(...)
):

    # ------------------------------------------------
    # VALIDATE FILE
    # ------------------------------------------------

    if not file.filename:

        return {
            "success": False,
            "message": "No file selected."
        }


    if not file.filename.lower().endswith(".pdf"):

        return {
            "success": False,
            "message": "Only PDF files are supported."
        }


    # ------------------------------------------------
    # CREATE DATA DIRECTORY
    # ------------------------------------------------

    DATA_DIR.mkdir(parents=True, exist_ok=True)


    # ------------------------------------------------
    # GENERATE UNIQUE DOCUMENT ID
    # ------------------------------------------------

    document_id = str(
        uuid.uuid4()
    )


    # ------------------------------------------------
    # SAVE PDF
    # ------------------------------------------------

    pdf_path = DATA_DIR / f"{document_id}.pdf"


    contents = await file.read()

    if len(contents) > UPLOAD_MAX_BYTES:
        logger.warning(
            "Rejected upload filename=%s size=%d max_size=%d",
            file.filename,
            len(contents),
            UPLOAD_MAX_BYTES,
        )
        return {
            "success": False,
            "message": "The PDF exceeds the configured upload size limit.",
        }


    with open(
        pdf_path,
        "wb"
    ) as f:

        f.write(contents)


    # ------------------------------------------------
    # PROCESS PDF
    #
    # PDF
    #  ↓
    # Chunks
    #  ↓
    # Embeddings
    #  ↓
    # ChromaDB
    # ------------------------------------------------

    try:

        result = create_vector_store(
            str(pdf_path),
            document_id=document_id,
            document_name=file.filename
        )

        return {

            "success": True,

            "filename": file.filename,

            "document_id": document_id,

            "chunks_added": result[
                "chunks_added"
            ],

            "message":
                "PDF uploaded and indexed successfully."
        }


    except Exception:

        # ------------------------------------------------
        # REMOVE PDF IF INDEXING FAILS
        # ------------------------------------------------

        if pdf_path.exists():

            pdf_path.unlink()


        logger.exception(
            "Failed to process PDF document_id=%s filename=%s",
            document_id,
            file.filename,
        )

        return {

            "success": False,

            "message":
                "Failed to process and index the PDF. Please check that it contains readable text."
        }


# ==================================================
# DELETE PDF
# ==================================================

@app.delete(
    "/documents/{document_id}"
)
def delete_document(
    document_id: str
):

    try:

        # ------------------------------------------------
        # DELETE VECTORS FROM CHROMADB
        # ------------------------------------------------

        deleted_chunks = (
            delete_document_from_vector_store(
                document_id
            )
        )


        # ------------------------------------------------
        # DELETE PHYSICAL PDF
        # ------------------------------------------------

        pdf_path = DATA_DIR / f"{document_id}.pdf"


        pdf_deleted = False


        if pdf_path.exists():

            pdf_path.unlink()

            pdf_deleted = True


        # ------------------------------------------------
        # RESPONSE
        # ------------------------------------------------

        return {

            "success": True,

            "document_id": document_id,

            "deleted_chunks":
                deleted_chunks,

            "pdf_deleted":
                pdf_deleted,

            "message":
                "Document deleted successfully."
        }


    except Exception as exc:

        logger.exception("Failed to delete PDF document_id=%s", document_id)

        return {

            "success": False,

            "document_id":
                document_id,

            "message":
                f"Failed to delete document: {str(exc)}"
        }


# ==================================================
# RUN SERVER
# ==================================================

if __name__ == "__main__":

    uvicorn.run(

        "api.main:app",

        host="127.0.0.1",

        port=8000,

        reload=False
    )

