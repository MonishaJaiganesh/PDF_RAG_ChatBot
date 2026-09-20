import type { ApiSettings } from "./types";

/**
 * Single place to adapt DocMind to an existing FastAPI backend.
 * Users can override these at runtime in Settings.
 */
export const DEFAULT_SETTINGS: ApiSettings = {
  baseUrl: "http://127.0.0.1:8000",
  uploadPath: "/upload",
  chatPath: "/query",
  documentFieldName: "file",
};

export function joinUrl(baseUrl: string, path: string) {
  const base = baseUrl.replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}
