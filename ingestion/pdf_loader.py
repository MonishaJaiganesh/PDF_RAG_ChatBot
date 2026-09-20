from pypdf import PdfReader

def load_pdf(pdf_path):
    reader = PdfReader(pdf_path)

    documents = []

    for page_number, page in enumerate(reader.pages, start=1):
        text = page.extract_text()

        documents.append({
            "page": page_number,
            "text": text
        })

    return documents


# Test the loader
if __name__ == "__main__":
    docs = load_pdf("data/sample.pdf")

    print(f"Total Pages: {len(docs)}")
    print("-" * 50)
    print(docs[0]["text"][:500])   # First 500 characters of page 1