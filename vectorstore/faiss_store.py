import faiss
import pickle
import os

from ingestion.chunker import create_chunks
from ingestion.embedding import create_embeddings


def create_vector_store(pdf_path):
    # Step 1: Create chunks from PDF
    chunks = create_chunks(pdf_path)

    # Step 2: Create embeddings for every chunk
    embeddings = create_embeddings(chunks)

    # Step 3: Convert embeddings into a FAISS-compatible matrix
    dimension = len(embeddings[0])

    index = faiss.IndexFlatL2(dimension)

    # Step 4: Add embeddings to FAISS
    index.add(embeddings)

    # Step 5: Create vectorstore directory
    os.makedirs("vectorstore", exist_ok=True)

    # Step 6: Save FAISS index
    faiss.write_index(index, "vectorstore/index.faiss")

    # Step 7: Save chunks separately
    with open("vectorstore/chunks.pkl", "wb") as f:
        pickle.dump(chunks, f)

    print(f"Vector store created successfully!")
    print(f"Total vectors: {index.ntotal}")
    print(f"Vector dimension: {dimension}")


if __name__ == "__main__":
    create_vector_store("data/sample.pdf")