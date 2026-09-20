from importlib import import_module

from config import RERANKER_MODEL
from logging_config import logger

# ==================================================
# LOAD RERANKER MODEL
# ==================================================

reranker = None


def _get_reranker():
    """Load the model lazily so importing this module does not require the
    optional sentence-transformers dependency immediately.
    """
    global reranker

    if reranker is None:
        try:
            CrossEncoder = import_module(
                "sentence_transformers"
            ).CrossEncoder
        except ImportError as exc:
            raise ImportError(
                "Install the 'sentence-transformers' package to use reranking."
            ) from exc

        try:
            reranker = CrossEncoder(RERANKER_MODEL)
        except Exception:
            logger.exception("Failed to load reranker model=%s", RERANKER_MODEL)
            raise

    return reranker


# ==================================================
# RERANK DOCUMENTS
# ==================================================

def rerank_documents(
    query,
    documents,
    top_k=5
):

    if not documents:
        return []

    # ------------------------------------------------
    # Create query-document pairs
    # ------------------------------------------------

    pairs = [
        [
            query,
            document["text"]
        ]
        for document in documents
    ]

    # ------------------------------------------------
    # Calculate relevance scores
    # ------------------------------------------------

    try:
        scores = _get_reranker().predict(pairs)
    except Exception:
        logger.exception("Reranker prediction failed candidate_count=%d", len(pairs))
        raise

    # ------------------------------------------------
    # Attach scores
    # ------------------------------------------------

    reranked_documents = []

    for document, score in zip(
        documents,
        scores
    ):

        result = {
            **document,
            "reranker_score": float(score)
        }

        reranked_documents.append(
            result
        )

    # ------------------------------------------------
    # Sort by reranker score
    # ------------------------------------------------

    reranked_documents.sort(
        key=lambda x: x["reranker_score"],
        reverse=True
    )

    # ------------------------------------------------
    # Return final top-K
    # ------------------------------------------------

    return reranked_documents[:top_k]

if __name__ == "__main__":

    query = (
        "What programming languages "
        "does the candidate know?"
    )

    documents = [

        {
            "text": (
                "The candidate has experience "
                "with Python, Java, C++, SQL "
                "and JavaScript."
            )
        },

        {
            "text": (
                "The candidate completed a "
                "Bachelor of Engineering in "
                "Computer Science."
            )
        },

        {
            "text": (
                "The candidate worked on a "
                "PDF RAG chatbot using "
                "FastAPI and ChromaDB."
            )
        }
    ]

    results = rerank_documents(
        query,
        documents,
        top_k=3
    )

    print("\nReranker Results")
    print("=" * 60)

    for i, result in enumerate(
        results,
        start=1
    ):

        print(
            f"\n{i}. "
            f"Score: "
            f"{result['reranker_score']:.4f}"
        )

        print(
            result["text"]
        )