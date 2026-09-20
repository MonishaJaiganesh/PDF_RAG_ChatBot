import ollama
import numpy as np

from config import EMBEDDING_MODEL, OLLAMA_HOST
from logging_config import logger
from ingestion.chunker import create_chunks


def create_embeddings(chunks):
    embeddings = []

    for chunk in chunks:
        kwargs = {"model": EMBEDDING_MODEL, "input": chunk["text"]}
        if OLLAMA_HOST:
            kwargs["host"] = OLLAMA_HOST
        try:
            response = ollama.embed(**kwargs)
        except Exception:
            logger.exception("Embedding failed model=%s", EMBEDDING_MODEL)
            raise

        embeddings.append(response["embeddings"][0])

    return np.array(embeddings, dtype="float32")


if __name__ == "__main__":
    chunks = create_chunks("data/sample.pdf")

    embeddings = create_embeddings(chunks)

    print(f"Total chunks: {len(chunks)}")
    print(f"Total embeddings: {len(embeddings)}")
    print(f"Embedding dimensions: {len(embeddings[0])}")

    print("\nFirst chunk:")
    print(chunks[0]["text"])

    print("\nFirst embedding (first 10 values):")
    print(embeddings[0][:10])