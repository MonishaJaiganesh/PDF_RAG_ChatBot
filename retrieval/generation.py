import ollama
import time


def generate_answer(question, retrieved_documents):

    start_time = time.perf_counter()

    # Keep the context bounded while allowing summary questions more coverage.
    retrieved_documents = retrieved_documents[:4]

    if not retrieved_documents:
        return "I couldn't find the answer in the document."

    context = "\n\n".join(
        [
            f"Page {document['page']}:\n{document['text']}"
            for document in retrieved_documents
        ]
    )

    prompt = f"""You are a PDF question-answering assistant.

Answer using ONLY the context below.

If the answer is not present, say:
"I couldn't find the answer in the document."

Keep the answer concise and direct.

Context:
{context}

Question:
{question}

Answer:
"""

    prompt_time = time.perf_counter()

    response = ollama.chat(
        model="qwen3:8b",
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ],
        think=False,
        options={
            "temperature": 0,
            "num_predict": 100
        }
    )

    end_time = time.perf_counter()

    print(f"\nPrompt preparation: {prompt_time - start_time:.3f}s")
    print(f"LLM generation:     {end_time - prompt_time:.3f}s")
    print(f"Total generation:   {end_time - start_time:.3f}s")

    return response["message"]["content"]