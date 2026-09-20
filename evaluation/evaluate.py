from retrieval.retriever import (
    semantic_search,
    keyword_search,
    reciprocal_rank_fusion,
    remove_duplicate_chunks
)

from retrieval.reranker import (
    rerank_documents
)

from evaluation.questions import (
    EVALUATION_QUESTIONS
)


DOCUMENT_ID = "498817b5-38f8-4ae8-83d1-82fdd282b10a"

TOP_K = 5


# ==================================================
# RELEVANCE CHECK
# ==================================================

def is_relevant(text, expected_keywords):

    text = text.lower()

    return any(
        keyword.lower() in text
        for keyword in expected_keywords
    )


# ==================================================
# METRICS
# ==================================================

def calculate_metrics(
    results,
    expected_keywords,
    k=5
):

    results = results[:k]

    relevant_ranks = []

    for rank, result in enumerate(
        results,
        start=1
    ):

        if is_relevant(
            result["text"],
            expected_keywords
        ):

            relevant_ranks.append(rank)

    # ----------------------------------------------
    # Recall@K
    # ----------------------------------------------

    recall = (
        1.0
        if relevant_ranks
        else 0.0
    )

    # ----------------------------------------------
    # Precision@K
    # ----------------------------------------------

    relevant_count = len(
        relevant_ranks
    )

    precision = (
        relevant_count / len(results)
        if results
        else 0.0
    )

    # ----------------------------------------------
    # MRR
    # ----------------------------------------------

    if relevant_ranks:

        first_relevant_rank = (
            relevant_ranks[0]
        )

        mrr = 1 / first_relevant_rank

    else:

        mrr = 0.0

    return {
        "recall": recall,
        "precision": precision,
        "mrr": mrr,
        "first_relevant_rank": (
            relevant_ranks[0]
            if relevant_ranks
            else None
        )
    }


# ==================================================
# PRINT METRICS
# ==================================================

def print_metrics(
    name,
    metrics
):

    rank = metrics[
        "first_relevant_rank"
    ]

    rank_text = (
        str(rank)
        if rank is not None
        else "Not Found"
    )

    print(
        f"{name:<20}"
        f"Recall@5: {metrics['recall']:.2f} | "
        f"Precision@5: {metrics['precision']:.2f} | "
        f"MRR: {metrics['mrr']:.3f} | "
        f"First Relevant Rank: {rank_text}"
    )


# ==================================================
# EVALUATION
# ==================================================

def evaluate_question(
    question,
    expected_keywords
):

    # ==============================================
    # DENSE
    # ==============================================

    dense_results, _, _ = semantic_search(
        query=question,
        top_k=TOP_K,
        document_id=DOCUMENT_ID
    )

    # ==============================================
    # BM25
    # ==============================================

    bm25_results = keyword_search(
        query=question,
        top_k=TOP_K,
        document_id=DOCUMENT_ID
    )

    # ==============================================
    # HYBRID RRF
    # ==============================================

    hybrid_results = reciprocal_rank_fusion(
        dense_results,
        bm25_results
    )

    hybrid_results = remove_duplicate_chunks(
        hybrid_results,
        TOP_K
    )

    # ==============================================
    # RERANKER
    # ==============================================

    reranked_results = rerank_documents(
        query=question,
        documents=hybrid_results,
        top_k=TOP_K
    )

    # ==============================================
    # METRICS
    # ==============================================

    dense_metrics = calculate_metrics(
        dense_results,
        expected_keywords,
        TOP_K
    )

    bm25_metrics = calculate_metrics(
        bm25_results,
        expected_keywords,
        TOP_K
    )

    hybrid_metrics = calculate_metrics(
        hybrid_results,
        expected_keywords,
        TOP_K
    )

    reranker_metrics = calculate_metrics(
        reranked_results,
        expected_keywords,
        TOP_K
    )

    return {
        "Dense": dense_metrics,
        "BM25": bm25_metrics,
        "Hybrid RRF": hybrid_metrics,
        "Hybrid + Reranker": reranker_metrics
    }


# ==================================================
# MAIN
# ==================================================

def main():

    print("\n")
    print("=" * 100)
    print("RAG RETRIEVAL EVALUATION")
    print("=" * 100)

    all_results = {
        "Dense": [],
        "BM25": [],
        "Hybrid RRF": [],
        "Hybrid + Reranker": []
    }

    for item in EVALUATION_QUESTIONS:

        question = item["question"]

        expected_keywords = (
            item["expected_keywords"]
        )

        print("\n")
        print("-" * 100)

        print(
            f"Question: {question}"
        )

        print(
            f"Expected: {expected_keywords}"
        )

        results = evaluate_question(
            question,
            expected_keywords
        )

        print("\nMetrics")
        print("-" * 100)

        for name, metrics in results.items():

            print_metrics(
                name,
                metrics
            )

            all_results[name].append(
                metrics
            )

    # ==============================================
    # AVERAGE METRICS
    # ==============================================

    print("\n")
    print("=" * 100)
    print("AVERAGE RESULTS")
    print("=" * 100)

    print(
        f"{'Method':<25}"
        f"{'Recall@5':<15}"
        f"{'Precision@5':<18}"
        f"{'MRR':<10}"
    )

    print("-" * 70)

    for name, metrics_list in (
        all_results.items()
    ):

        avg_recall = sum(
            m["recall"]
            for m in metrics_list
        ) / len(metrics_list)

        avg_precision = sum(
            m["precision"]
            for m in metrics_list
        ) / len(metrics_list)

        avg_mrr = sum(
            m["mrr"]
            for m in metrics_list
        ) / len(metrics_list)

        print(
            f"{name:<25}"
            f"{avg_recall:<15.2f}"
            f"{avg_precision:<18.2f}"
            f"{avg_mrr:<10.3f}"
        )


if __name__ == "__main__":
    main()