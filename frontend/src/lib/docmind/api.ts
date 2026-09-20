import { joinUrl } from "./config";
import type { ApiSettings, Citation, ChatMessage } from "./types";

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    if (status !== undefined) this.status = status;
  }
}

type Json = Record<string, unknown>;

function asRecord(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : null;
}

function pickString(source: Json | null, keys: string[]): string | undefined {
  if (!source) return undefined;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function errorMessage(body: unknown, response: Response) {
  const record = asRecord(body);
  const detail = record?.["detail"];
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length) {
    const first = asRecord(detail[0]);
    const msg = first?.["msg"];
    if (typeof msg === "string") return msg;
  }
  const msg = pickString(record, ["message", "error"]);
  if (msg) return msg;
  if (typeof body === "string" && body.trim()) return body.slice(0, 300);
  return `Request failed with status ${response.status}`;
}

function networkError(error: unknown, url: string) {
  if (error instanceof ApiError) return error;
  return new ApiError(
    `Could not reach the backend at ${url}. Make sure the FastAPI server is running and allows requests from this origin.`
  );
}

/** Normalizes any reasonable citation/source shape from the backend. */
export function normalizeCitations(raw: unknown): Citation[] {
  const list = Array.isArray(raw) ? raw : [];

  const citations = list
    .map((item, index): Citation | null => {
      if (typeof item === "string") {
        return {
          id: `c-${index}`,
          label: item,
        };
      }

      const record = asRecord(item);
      if (!record) return null;

      const metadata = asRecord(record["metadata"]);

      const pageRaw =
        record["page"] ??
        record["page_number"] ??
        metadata?.["page"] ??
        metadata?.["page_number"];

      const page =
        typeof pageRaw === "number"
          ? pageRaw
          : typeof pageRaw === "string" && pageRaw.trim() !== ""
            ? Number(pageRaw)
            : undefined;

      const document =
        pickString(record, [
          "document",
          "source",
          "file_name",
          "filename",
          "title",
        ]) ??
        pickString(metadata, [
          "source",
          "file_name",
          "filename",
          "title",
        ]);

      const snippet = pickString(record, [
        "snippet",
        "text",
        "content",
        "chunk",
      ]);

      // Get retrieval distance from backend
      const distanceRaw = record["distance"];

      const distance =
        typeof distanceRaw === "number"
          ? distanceRaw
          : typeof distanceRaw === "string" &&
              distanceRaw.trim() !== ""
            ? Number(distanceRaw)
            : undefined;

      const label =
        document && page !== undefined && !Number.isNaN(page)
          ? `${document} · p.${page}`
          : (document ??
            (page !== undefined
              ? `Page ${page}`
              : `Source ${index + 1}`));

      const citation: Citation = {
        id: `c-${index}`,
        label,
      };

      if (page !== undefined && !Number.isNaN(page)) {
        citation.page = page;
      }

      if (document) {
        citation.document = document;
      }

      if (snippet) {
        citation.snippet = snippet;
      }

      if (distance !== undefined && !Number.isNaN(distance)) {
        citation.distance = distance;
      }

      return citation;
    })
    .filter((c): c is Citation => c !== null);

  const seen = new Set<string>();
  return citations.filter((citation) => {
    const key = `${citation.document ?? ""}|${citation.page ?? ""}|${citation.snippet ?? citation.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Normalizes the answer payload from a variety of FastAPI response shapes. */
export function normalizeChatResponse(body: unknown): {
  answer: string;
  citations: Citation[];
} {
  if (typeof body === "string") return { answer: body, citations: [] };
  const record = asRecord(body);
  const nested = asRecord(record?.["data"]) ?? asRecord(record?.["result"]);
  const answer =
    pickString(record, ["answer", "response", "output", "text", "message", "content"]) ??
    pickString(nested, ["answer", "response", "output", "text", "message", "content"]) ??
    "";
  const citationsRaw =
    record?.["citations"] ??
    record?.["sources"] ??
    record?.["source_documents"] ??
    record?.["context"] ??
    nested?.["citations"] ??
    nested?.["sources"];
  return { answer, citations: normalizeCitations(citationsRaw) };
}

export type UploadResult = { remoteId?: string; pages?: number };

export async function uploadDocument(
  file: File,
  settings: ApiSettings,
  signal?: AbortSignal
): Promise<UploadResult> {
  const url = joinUrl(settings.baseUrl, settings.uploadPath);
  const form = new FormData();
  form.append(settings.documentFieldName || "file", file, file.name);

  let response: Response;
  try {
    response = await fetch(url, { method: "POST", body: form, ...(signal ? { signal } : {}) });
  } catch (error) {
    throw networkError(error, url);
  }
  const body = await readBody(response);
  if (!response.ok) throw new ApiError(errorMessage(body, response), response.status);

  const record = asRecord(body);
  if (record?.["success"] === false) {
    throw new ApiError(errorMessage(body, response));
  }
  const remoteId = pickString(record, [
    "document_id",
    "documentId",
    "id",
    "file_id",
    "filename",
  ]);
  const pagesRaw = record?.["pages"] ?? record?.["num_pages"] ?? record?.["page_count"];
  const result: UploadResult = {};
  if (remoteId) result.remoteId = remoteId;
  if (typeof pagesRaw === "number") result.pages = pagesRaw;
  return result;
}

export type ChatRequest = {
  question: string;
  threadId: string;
  history: ChatMessage[];
  documentId?: string;
};

export async function sendChat(
  request: ChatRequest,
  settings: ApiSettings,
  signal?: AbortSignal
) {
  const url = joinUrl(settings.baseUrl, settings.chatPath);
  const payload = {
    question: request.question,
    thread_id: request.threadId,
    ...(request.documentId ? { document_id: request.documentId } : {}),
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      ...(signal ? { signal } : {}),
    });
  } catch (error) {
    throw networkError(error, url);
  }
  const body = await readBody(response);
  if (!response.ok) throw new ApiError(errorMessage(body, response), response.status);

  const normalized = normalizeChatResponse(body);
  if (!normalized.answer) {
    throw new ApiError(
      "The backend responded without an answer field. Adjust the response mapping in Settings or the backend contract."
    );
  }
  return normalized;
}

export async function deleteDocument(
  documentId: string,
  settings: ApiSettings,
  signal?: AbortSignal
) {
  const url = joinUrl(settings.baseUrl, `/documents/${encodeURIComponent(documentId)}`);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "DELETE",
      ...(signal ? { signal } : {}),
    });
  } catch (error) {
    throw networkError(error, url);
  }
  const body = await readBody(response);
  if (!response.ok) throw new ApiError(errorMessage(body, response), response.status);
}
