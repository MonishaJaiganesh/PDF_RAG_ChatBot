import os
from dotenv import load_dotenv
from google import genai
from google.genai import errors

from config import GEMINI_FALLBACK_MODEL, GEMINI_MODEL
from logging_config import logger

load_dotenv()

_gemini_client = None


def _client():
    global _gemini_client

    if _gemini_client is not None:
        return _gemini_client

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured.")
    _gemini_client = genai.Client(api_key=api_key)
    return _gemini_client


def _generate_content(prompt):
    client = _client()
    try:
        return client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
        )
    except errors.ServerError as error:
        if error.code != 503:
            logger.exception("Gemini generation failed model=%s", GEMINI_MODEL)
            raise
        logger.warning("Gemini model unavailable; using fallback model=%s", GEMINI_FALLBACK_MODEL)
        try:
            return client.models.generate_content(
                model=GEMINI_FALLBACK_MODEL,
                contents=prompt,
            )
        except Exception:
            logger.exception("Gemini fallback generation failed model=%s", GEMINI_FALLBACK_MODEL)
            raise
    except Exception:
        logger.exception("Gemini generation failed model=%s", GEMINI_MODEL)
        raise


def generate_gemini_chat(question):
    response = _generate_content(
        "You are a friendly, concise assistant. Respond naturally to the user's "
        f"message without pretending it is about a PDF.\n\nUser: {question}"
    )
    return response.text or "I couldn't generate a response."


def generate_gemini_document_answer(question, retrieved_documents):
    if not retrieved_documents:
        return generate_gemini_chat(question)

    context = "\n\n".join(
        f"Page {document['page']}:\n{document['text']}"
        for document in retrieved_documents
    )

    prompt = f"""You are a helpful assistant with access to a PDF resume.

Use the resume context below when it is relevant to the user's question.

Rules:
- For questions about the resume, answer from the provided context only.
- When the user asks to list or name all items, scan every provided context section and include every distinct matching item; do not stop after the first match.
- If the context does not contain the answer, say that it is not demonstrated in the resume.
- For questions unrelated to the resume, answer naturally using your general knowledge.
- Never invent resume facts or claim unrelated information came from the resume.
- Keep the answer concise and direct.

Resume context:
{context}

Question:
{question}

Answer:
"""

    response = _generate_content(prompt)
    return response.text or "I couldn't generate a response."


def generate_gemini_evaluation(question, retrieved_documents):
    if not retrieved_documents:
        return "I couldn't find enough information in the document to evaluate it."

    context = "\n\n".join(
        f"Page {document['page']}:\n{document['text']}"
        for document in retrieved_documents
    )

    prompt = f"""You are an expert resume evaluator.

Use only the resume context below.

For evaluation questions:
- Analyze evidence present in the resume.
- Make professional judgments only from that evidence.
- Do not invent skills, experience, projects, or achievements.
- Clearly explain strengths, weaknesses, missing evidence, and recommendation.
- Give a score out of 10 when the user asks for a rating.

If the resume lacks evidence for a criterion, say that it is not demonstrated.

Resume context:
{context}

Question:
{question}

Answer:
"""

    response = _generate_content(prompt)
    return response.text or "I couldn't generate an evaluation."
