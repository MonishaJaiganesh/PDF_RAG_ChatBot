import chromadb

from config import CHROMA_COLLECTION_NAME, VECTORSTORE_DIR
from logging_config import logger
from ingestion.chunker import create_chunks
from ingestion.embedding import create_embeddings


def create_vector_store(pdf_path, document_id, document_name=None):

    # 1. Load and chunk the PDF
    chunks = create_chunks(pdf_path)

    if not chunks:
        raise ValueError("The PDF contains no extractable text.")

    # 2. Generate embeddings
    embeddings = create_embeddings(chunks)

    # 3. Create persistent Chroma database
    client = chromadb.PersistentClient(path=str(VECTORSTORE_DIR))

    # 4. Get or create collection
    collection = client.get_or_create_collection(
        name=CHROMA_COLLECTION_NAME
    )

    # 5. Prepare Chroma data
    ids = []
    documents = []
    metadatas = []

    for i, chunk in enumerate(chunks):

        # Unique ID for every document chunk
        ids.append(
            f"{document_id}_chunk_{i}"
        )

        documents.append(
            chunk["text"]
        )

        metadatas.append({
            "page": chunk["page"],
            "document_id": document_id,
            "document": document_name or pdf_path.split("/")[-1].split("\\")[-1]
        })

    # 6. Store in ChromaDB
    collection.add(
        ids=ids,
        embeddings=embeddings.tolist(),
        documents=documents,
        metadatas=metadatas
    )

    logger.info(
        "Vector store updated document_id=%s chunks_added=%d collection=%s",
        document_id,
        len(chunks),
        CHROMA_COLLECTION_NAME,
    )

    return {
        "chunks_added": len(chunks),
        "document_id": document_id
    }

def delete_document_from_vector_store(document_id):

    client = chromadb.PersistentClient(path=str(VECTORSTORE_DIR))

    collection = client.get_collection(
        name=CHROMA_COLLECTION_NAME
    )

    # Find chunks belonging to this document
    existing = collection.get(
        where={
            "document_id": document_id
        }
    )

    deleted_count = len(existing["ids"])

    # Delete those chunks
    collection.delete(
        where={
            "document_id": document_id
        }
    )

    logger.info(
        "Deleted vector chunks document_id=%s deleted_chunks=%d",
        document_id,
        deleted_count,
    )

    return deleted_count

if __name__ == "__main__":

    create_vector_store(
        "data/sample.pdf",
        "test-document"
    )