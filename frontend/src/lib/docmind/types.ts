export type Role = "user" | "assistant";

export type Citation = {
  id: string;
  label: string;
  page?: number;
  document?: string;
  snippet?: string;
  distance?: number;
};

export type ChatMessage = {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  citations?: Citation[];
  responseTime?: number;
  failed?: boolean;
};

export type DocStatus = "uploading" | "ready" | "error";

export type DocumentMeta = {
  id: string;
  name: string;
  size: number;
  status: DocStatus;
  error?: string;
  uploadedAt: number;
  /** identifier returned by the backend, used as document context */
  remoteId?: string;
  pages?: number;
};

export type Thread = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
};

export type ApiSettings = {
  baseUrl: string;
  uploadPath: string;
  chatPath: string;
  documentFieldName: string;
};

export type DocMindState = {
  threads: Thread[];
  messages: Record<string, ChatMessage[]>;
  documents: DocumentMeta[];
  settings: ApiSettings;
};
