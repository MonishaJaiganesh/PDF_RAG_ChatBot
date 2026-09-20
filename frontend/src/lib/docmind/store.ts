import { useCallback, useSyncExternalStore } from "react";
import type { ChatMessage, DocMindState, DocumentMeta, Thread } from "./types";
import { DEFAULT_SETTINGS } from "./config";

const STORAGE_KEY = "docmind.state.v1";

const EMPTY: DocMindState = {
  threads: [],
  messages: {},
  documents: [],
  settings: DEFAULT_SETTINGS,
};

let state: DocMindState = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<DocMindState>;
    state = {
      threads: Array.isArray(parsed.threads) ? parsed.threads : [],
      messages:
        parsed.messages && typeof parsed.messages === "object" ? parsed.messages : {},
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    };
  } catch {
    state = EMPTY;
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota or private mode — keep in-memory state */
  }
}

function emit() {
  for (const listener of listeners) listener();
}

export function update(updater: (current: DocMindState) => DocMindState) {
  hydrate();
  const next = updater(state);
  if (next === state) return;
  state = next;
  persist();
  emit();
}

function subscribe(listener: () => void) {
  hydrate();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  hydrate();
  return state;
}

function getServerSnapshot() {
  return EMPTY;
}

export function useDocMindState(): DocMindState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useIsHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}

export function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

/** Idempotent: creates the thread only when it does not already exist. */
export function ensureThread(threadId: string) {
  update((current) => {
    if (current.threads.some((t) => t.id === threadId)) return current;
    const thread: Thread = {
      id: threadId,
      title: "New chat",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    return {
      ...current,
      threads: [thread, ...current.threads],
      messages: { ...current.messages, [threadId]: current.messages[threadId] ?? [] },
    };
  });
}

export function deleteThread(threadId: string) {
  update((current) => {
    const messages = { ...current.messages };
    delete messages[threadId];
    return {
      ...current,
      threads: current.threads.filter((t) => t.id !== threadId),
      messages,
    };
  });
}

export function renameThread(threadId: string, title: string) {
  update((current) => ({
    ...current,
    threads: current.threads.map((t) =>
      t.id === threadId ? { ...t, title, updatedAt: Date.now() } : t
    ),
  }));
}

function touch(threads: Thread[], threadId: string, title?: string) {
  return threads
    .map((t) =>
      t.id === threadId
        ? {
            ...t,
            updatedAt: Date.now(),
            title: title && t.title === "New chat" ? title : t.title,
          }
        : t
    )
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function appendMessage(threadId: string, message: ChatMessage) {
  ensureThread(threadId);
  update((current) => ({
    ...current,
    threads: touch(
      current.threads,
      threadId,
      message.role === "user" ? message.content.slice(0, 60) : undefined
    ),
    messages: {
      ...current.messages,
      [threadId]: [...(current.messages[threadId] ?? []), message],
    },
  }));
}

export function editMessage(threadId: string, messageId: string, content: string) {
  update((current) => {
    const threadMessages = current.messages[threadId] ?? [];
    const messageIndex = threadMessages.findIndex((message) => message.id === messageId);
    if (messageIndex === -1) return current;

    const editedMessage = {
      ...threadMessages[messageIndex],
      content,
      createdAt: Date.now(),
    };

    return {
      ...current,
      messages: {
        ...current.messages,
        [threadId]: [...threadMessages.slice(0, messageIndex), editedMessage],
      },
    };
  });
}

export function patchMessage(
  threadId: string,
  messageId: string,
  patch: Partial<ChatMessage>
) {
  update((current) => ({
    ...current,
    messages: {
      ...current.messages,
      [threadId]: (current.messages[threadId] ?? []).map((m) =>
        m.id === messageId ? { ...m, ...patch } : m
      ),
    },
  }));
}

export function addDocument(doc: DocumentMeta) {
  update((current) => ({ ...current, documents: [doc, ...current.documents] }));
}

export function patchDocument(id: string, patch: Partial<DocumentMeta>) {
  update((current) => ({
    ...current,
    documents: current.documents.map((d) => (d.id === id ? { ...d, ...patch } : d)),
  }));
}

export function removeDocument(id: string) {
  update((current) => ({
    ...current,
    documents: current.documents.filter((d) => d.id !== id),
  }));
}

export function saveSettings(settings: DocMindState["settings"]) {
  update((current) => ({ ...current, settings }));
}

export function useDocMindActions() {
  return useCallback(
    () => ({
      ensureThread,
      deleteThread,
      renameThread,
      appendMessage,
      patchMessage,
    }),
    []
  )();
}
