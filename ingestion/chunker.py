from langchain_text_splitters import RecursiveCharacterTextSplitter
from ingestion.pdf_loader import load_pdf


def create_chunks(pdf_path):

    documents = load_pdf(pdf_path)

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50
    )

    chunks = []

    for document in documents:

        split_texts = splitter.split_text(document["text"])

        for text in split_texts:
            chunks.append({
                "text": text,
                "page": document["page"]
            })

    return chunks


if __name__ == "__main__":

    chunks = create_chunks("data/sample.pdf")

    print(f"Total chunks: {len(chunks)}")

    for i, chunk in enumerate(chunks):
        print("\n" + "=" * 60)
        print(f"CHUNK {i + 1}")
        print(f"PAGE: {chunk['page']}")
        print("=" * 60)
        print(chunk["text"])