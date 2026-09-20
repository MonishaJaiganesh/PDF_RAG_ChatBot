import time
import re

import chromadb
import ollama
from rank_bm25 import BM25Okapi

from config import CHROMA_COLLECTION_NAME, EMBEDDING_MODEL, OLLAMA_HOST, VECTORSTORE_DIR
from logging_config import logger
from retrieval.reranker import rerank_documents
def __init__(self, corpus, k1=1.5, b=0.75):
    self.corpus = corpus
    self.k1 = k1
    self.b = b
    self.document_count = len(corpus)
    self.average_length = (
    sum(len(document) for document in corpus) / self.document_count
    if self.document_count else 0
    )
    self.document_frequency = {}
    for document in corpus:
            for token in set(document):
                self.document_frequency[token] = (
                    self.document_frequency.get(token, 0) + 1
                )

    def get_scores(self, query):
        import math

        scores = [0.0] * self.document_count
        for index, document in enumerate(self.corpus):
            frequencies = {}
            for token in document:
                frequencies[token] = frequencies.get(token, 0) + 1

            length = len(document)
            normalization = self.k1 * (
                1 - self.b + self.b * length / (self.average_length or 1)
            )
            for token in query:
                term_frequency = frequencies.get(token, 0)
                document_frequency = self.document_frequency.get(token, 0)
                if not term_frequency or not document_frequency:
                    continue
                idf = math.log(
                    1 + (self.document_count - document_frequency + 0.5)
                    / (document_frequency + 0.5)
                )
                scores[index] += idf * term_frequency * (self.k1 + 1) / (
                    term_frequency + normalization
                )
        return scores


# ==================================================
# CHROMA CONNECTION
# ==================================================

client = chromadb.PersistentClient(path=str(VECTORSTORE_DIR))

collection = client.get_collection(
    name=CHROMA_COLLECTION_NAME
)


# ==================================================
# QUERY CLASSIFICATION
# ==================================================

def is_conversational(query):
    normalized = query.strip().lower().rstrip(".!?")

    return normalized in {
        "hi",
        "hello",
        "hey",
        "thanks",
        "thank you",
        "bye",
    }


def is_summary_query(query):
    normalized = query.strip().lower().rstrip(".!?")

    return any(
        phrase in normalized
        for phrase in (
            "summarize this pdf",
            "summarise this pdf",
            "tell me about this resume",
            "what is this document about",
            "summarize this document",
            "summarise this document",
        )
    )


def is_list_query(query):
    normalized = query.strip().lower()

    return (
        any(phrase in normalized for phrase in ("list all", "all the", "every"))
        and any(term in normalized for term in ("project", "experience", "skill", "certification"))
    ) or any(
        phrase in normalized
        for phrase in (
            "list project names",
            "list all project names",
            "what are the projects",
            "name all projects",
        )
    )


def is_evaluation_query(query):
    normalized = query.strip().lower()

    return any(
        phrase in normalized
        for phrase in (
            "rate this resume",
            "review this resume",
            "evaluate this resume",
            "score this resume",
            "resume for",
            "suitable for",
            "fit for",
            "how good is this resume",
            "sde role",
            "software engineer role",
            "strengths and weaknesses",
        )
    )


# ==================================================
# TOKENIZATION
# ==================================================

def tokenize(text):
    """
    Simple tokenizer for BM25.

    Keeps useful technical tokens such as:
    - Python
    - FastAPI
    - PostgreSQL
    - ReactJS
    - C++
    - EMP-2047
    """

    text = text.lower()

    return re.findall(
        r"[a-zA-Z0-9_+#.-]+",
        text
    )


# ==================================================
# GET DOCUMENT CHUNKS
# ==================================================

def get_document_chunks(document_id=None):

    where = None

    if document_id:
        where = {
            "document_id": document_id
        }

    try:
        data = collection.get(where=where)
    except Exception:
        logger.exception("Chroma read failed document_id=%s", document_id)
        raise

    documents = data.get("documents", [])
    metadatas = data.get("metadatas", [])
    ids = data.get("ids", [])

    return documents, metadatas, ids


# ==================================================
# BM25 KEYWORD SEARCH
# ==================================================

def keyword_search(
    query,
    top_k=10,
    document_id=None
):

    documents, metadatas, ids = get_document_chunks(
        document_id
    )

    if not documents:
        return []

    # ----------------------------------------------
    # Tokenize documents
    # ----------------------------------------------

    tokenized_documents = [
        tokenize(document)
        for document in documents
    ]

    # ----------------------------------------------
    # Create BM25 index
    # ----------------------------------------------

    bm25 = BM25Okapi(
        tokenized_documents
    )

    # ----------------------------------------------
    # Tokenize query
    # ----------------------------------------------

    query_tokens = tokenize(query)

    # ----------------------------------------------
    # Calculate BM25 scores
    # ----------------------------------------------

    scores = bm25.get_scores(
        query_tokens
    )

    # ----------------------------------------------
    # Rank results
    # ----------------------------------------------

    ranked_indexes = sorted(
        range(len(scores)),
        key=lambda i: scores[i],
        reverse=True
    )

    results = []

    for rank, index in enumerate(
        ranked_indexes[:top_k],
        start=1
    ):

        metadata = metadatas[index]

        results.append({
            "id": ids[index],
            "text": documents[index],
            "page": metadata.get("page"),
            "document_id": metadata.get("document_id"),
            "document": metadata.get("document"),
            "keyword_score": float(
                scores[index]
            ),
            "keyword_rank": rank,
        })

    return results


# ==================================================
# DENSE VECTOR SEARCH
# ==================================================

def semantic_search(
    query,
    top_k=10,
    document_id=None
):

    # ----------------------------------------------
    # Create query embedding
    # ----------------------------------------------

    embedding_start = time.perf_counter()

    embed_kwargs = {"model": EMBEDDING_MODEL, "input": query}
    if OLLAMA_HOST:
        embed_kwargs["host"] = OLLAMA_HOST
    try:
        response = ollama.embed(**embed_kwargs)
    except Exception:
        logger.exception("Query embedding failed model=%s", EMBEDDING_MODEL)
        raise

    query_embedding = response[
        "embeddings"
    ][0]

    embedding_time = (
        time.perf_counter()
        - embedding_start
    )

    # ----------------------------------------------
    # Chroma query
    # ----------------------------------------------

    query_params = {
        "query_embeddings": [query_embedding],
        "n_results": top_k,
    }

    if document_id:
        query_params["where"] = {
            "document_id": document_id
        }

    retrieval_start = time.perf_counter()

    try:
        results = collection.query(**query_params)
    except Exception:
        logger.exception("Chroma query failed document_id=%s", document_id)
        raise

    chroma_time = (
        time.perf_counter()
        - retrieval_start
    )

    semantic_results = []

    if results["documents"]:

        for rank in range(
            len(results["documents"][0])
        ):

            metadata = results[
                "metadatas"
            ][0][rank]

            semantic_results.append({
                "id": results["ids"][0][rank],
                "text": results["documents"][0][rank],
                "page": metadata.get("page"),
                "document_id": metadata.get(
                    "document_id"
                ),
                "document": metadata.get(
                    "document"
                ),
                "distance": results[
                    "distances"
                ][0][rank],
                "semantic_rank": rank + 1,
            })

    return (
        semantic_results,
        embedding_time,
        chroma_time
    )


# ==================================================
# RECIPROCAL RANK FUSION
# ==================================================

def reciprocal_rank_fusion(
    semantic_results,
    keyword_results,
    rrf_k=60
):

    merged = {}

    # ----------------------------------------------
    # Semantic results
    # ----------------------------------------------

    for result in semantic_results:

        chunk_id = result["id"]

        merged[chunk_id] = {
            **result,
            "keyword_rank": None,
        }

    # ----------------------------------------------
    # Keyword results
    # ----------------------------------------------

    for result in keyword_results:

        chunk_id = result["id"]

        if chunk_id in merged:

            merged[chunk_id][
                "keyword_rank"
            ] = result["keyword_rank"]

            merged[chunk_id][
                "keyword_score"
            ] = result["keyword_score"]

        else:

            merged[chunk_id] = {
                **result,
                "semantic_rank": None,
                "distance": None,
            }

    # ----------------------------------------------
    # Calculate RRF
    # ----------------------------------------------

    for result in merged.values():

        score = 0.0

        semantic_rank = result.get(
            "semantic_rank"
        )

        keyword_rank = result.get(
            "keyword_rank"
        )

        if semantic_rank is not None:

            score += 1 / (
                rrf_k + semantic_rank
            )

        if keyword_rank is not None:

            score += 1 / (
                rrf_k + keyword_rank
            )

        result["hybrid_score"] = score

    # ----------------------------------------------
    # Sort
    # ----------------------------------------------

    return sorted(
        merged.values(),
        key=lambda x: x["hybrid_score"],
        reverse=True
    )


# ==================================================
# REMOVE DUPLICATES
# ==================================================

def remove_duplicate_chunks(
    results,
    top_k
):

    unique_results = []

    seen = set()

    for result in results:

        key = (
            result.get("document_id"),
            result["text"].strip()
        )

        if key in seen:
            continue

        seen.add(key)

        unique_results.append(
            result
        )

        if len(unique_results) >= top_k:
            break

    return unique_results


# ==================================================
# HYBRID RETRIEVAL
# ==================================================

def retrieve_documents(
    query,
    top_k=5,
    document_id=None
):

    if not document_id:
        return []

    total_start = time.perf_counter()

    # ----------------------------------------------
    # Retrieve more candidates than final top_k
    # ----------------------------------------------

    candidate_k = max(
        top_k * 5,
        10
    )

    # ----------------------------------------------
    # Dense retrieval
    # ----------------------------------------------

    (
        semantic_results,
        embedding_time,
        chroma_time
    ) = semantic_search(
        query=query,
        top_k=candidate_k,
        document_id=document_id
    )

    # ----------------------------------------------
    # BM25 retrieval
    # ----------------------------------------------

    bm25_start = time.perf_counter()

    keyword_results = keyword_search(
        query=query,
        top_k=candidate_k,
        document_id=document_id
    )

    bm25_time = (
        time.perf_counter()
        - bm25_start
    )

    # ----------------------------------------------
    # RRF
    # ----------------------------------------------

    rrf_start = time.perf_counter()

    hybrid_results = reciprocal_rank_fusion(
        semantic_results,
        keyword_results
    )

    rrf_time = (
        time.perf_counter()
        - rrf_start
    )

    # ----------------------------------------------
    # Remove duplicate chunks
    # ----------------------------------------------

    candidate_results = remove_duplicate_chunks(
        hybrid_results,
        candidate_k
    )

    # ----------------------------------------------
    # Rerank candidates
    # ----------------------------------------------

    print("\n--- RERANKER CANDIDATES ---")
    print("=" * 80)

    for i, result in enumerate(
        candidate_results,
        start=1
    ):
        print(
            f"\nCandidate {i}"
        )

        print(
            f"Page: {result.get('page')}"
        )

        print(
            f"RRF Score: "
            f"{result.get('hybrid_score', 0):.6f}"
        )

        print(
            f"Semantic Rank: "
            f"{result.get('semantic_rank')}"
        )

        print(
            f"BM25 Rank: "
            f"{result.get('keyword_rank')}"
        )

        print("-" * 80)

        print(
            result["text"][:1000]
        )

    print("=" * 80)

    reranker_start = time.perf_counter()

    final_results = rerank_documents(
        query=query,
        documents=candidate_results,
        top_k=top_k
    )

    reranker_time = (
        time.perf_counter()
        - reranker_start
    )

    total_time = (
        time.perf_counter()
        - total_start
    )

    # ==================================================
    # DEBUG INFORMATION
    # ==================================================

    print("\n" + "=" * 60)
    print("HYBRID RETRIEVAL")
    print("=" * 60)

    print(
        f"Query: {query}"
    )

    print(
        f"\nCandidates per retriever: {candidate_k}"
    )

    print(
        f"Dense results: {len(semantic_results)}"
    )

    print(
        f"BM25 results: {len(keyword_results)}"
    )

    print(
        f"Hybrid results: {len(hybrid_results)}"
    )

    print("\nTiming")
    print("-" * 60)

    print(
        f"Embedding: {embedding_time:.4f}s"
    )

    print(
        f"ChromaDB:  {chroma_time:.4f}s"
    )

    print(
        f"BM25:      {bm25_time:.4f}s"
    )

    print(
        f"RRF:       {rrf_time:.4f}s"
    )

    print(
        f"Reranker:  {reranker_time:.4f}s"
    )

    print(
        f"Total:     {total_time:.4f}s"
    )


    print("\nFinal Results")
    print("-" * 60)

    for index, result in enumerate(
        final_results,
        start=1
    ):

        print(
            f"{index}. "
            f"Page={result.get('page')} | "
            f"RRF={result.get('hybrid_score', 0):.6f} | "
            f"Reranker={result.get('reranker_score', 0):.4f} | "
            f"Semantic Rank={result.get('semantic_rank')} | "
            f"BM25 Rank={result.get('keyword_rank')}"
        )

    print("=" * 60)

    return final_results


# ==================================================
# TEST
# ==================================================

if __name__ == "__main__":

    query = input(
        "Ask a question about your PDF: "
    )

    # ------------------------------------------------
    # IMPORTANT:
    # Replace this with an actual document ID
    # ------------------------------------------------

    document_id = input(
        "Enter document ID: "
    )

    results = retrieve_documents(
        query=query,
        top_k=5,
        document_id=document_id
    )

    print("\nRetrieved Chunks")
    print("=" * 60)

    for index, result in enumerate(
        results,
        start=1
    ):

        print(
            f"\nResult {index}"
        )

        print(
            f"Page: {result.get('page')}"
        )

        print(
            f"Hybrid Score: "
            f"{result['hybrid_score']:.6f}"
        )

        print(
            f"Semantic Rank: "
            f"{result.get('semantic_rank')}"
        )

        print(
            f"BM25 Rank: "
            f"{result.get('keyword_rank')}"
        )

        print("-" * 60)

        print(
            result["text"]
        )