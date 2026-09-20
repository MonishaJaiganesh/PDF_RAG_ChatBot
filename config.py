import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent


def _path_setting(name, default):
    value = os.getenv(name)
    path = Path(value) if value else default
    return path if path.is_absolute() else BASE_DIR / path


def _int_setting(name, default):
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


def _float_setting(name, default):
    try:
        return float(os.getenv(name, str(default)))
    except ValueError:
        return default


DATA_DIR = _path_setting("DATA_DIR", BASE_DIR / "data")
VECTORSTORE_DIR = _path_setting("VECTORSTORE_DIR", BASE_DIR / "vectorstore" / "chroma_db")
LOG_DIR = _path_setting("LOG_DIR", BASE_DIR / "logs")

CHROMA_COLLECTION_NAME = os.getenv("CHROMA_COLLECTION_NAME", "pdf_documents")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "nomic-embed-text")
RERANKER_MODEL = os.getenv(
    "RERANKER_MODEL",
    "cross-encoder/ms-marco-MiniLM-L-6-v2",
)
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_FALLBACK_MODEL = os.getenv(
    "GEMINI_FALLBACK_MODEL",
    "gemini-3.5-flash-lite",
)
OLLAMA_HOST = os.getenv("OLLAMA_HOST")

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
LOG_MAX_BYTES = _int_setting("LOG_MAX_BYTES", 10 * 1024 * 1024)
LOG_BACKUP_COUNT = _int_setting("LOG_BACKUP_COUNT", 5)

UPLOAD_MAX_BYTES = _int_setting("UPLOAD_MAX_BYTES", 25 * 1024 * 1024)
RETRIEVAL_TOP_K = _int_setting("RETRIEVAL_TOP_K", 4)
EVALUATION_TOP_K = _int_setting("EVALUATION_TOP_K", 8)
LIST_QUERY_TOP_K = _int_setting("LIST_QUERY_TOP_K", 20)

CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://localhost:8080,http://127.0.0.1:5173,http://127.0.0.1:8080",
    ).split(",")
    if origin.strip()
]
