import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check, Clock3, Copy, Menu, Paperclip, Pencil, Quote, TriangleAlert } from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputTextarea,
  PromptInputTools,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { DocMindSidebar } from "@/components/docmind/sidebar";
import { SettingsDialog } from "@/components/docmind/settings-dialog";
import { ApiError, deleteDocument, sendChat, uploadDocument } from "@/lib/docmind/api";
import {
  appendMessage,
  addDocument,
  deleteThread,
  ensureThread,
  editMessage,
  newId,
  patchDocument,
  removeDocument,
  useDocMindState,
  useIsHydrated,
} from "@/lib/docmind/store";
import type { ChatMessage } from "@/lib/docmind/types";
import { cn } from "@/lib/utils";

function formatResponseTime(seconds: number) {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

export function ChatWorkspace({ threadId }: { threadId: string }) {
  const navigate = useNavigate();
  const state = useDocMindState();
  const hydrated = useIsHydrated();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messages = useMemo(
    () => state.messages[threadId] ?? [],
    [state.messages, threadId]
  );

  useEffect(() => {
    if (hydrated) ensureThread(threadId);
  }, [hydrated, threadId]);

  useEffect(() => {
    if (
      activeDocId &&
      !state.documents.some(
        (d) => d.id === activeDocId && d.status === "ready" && d.remoteId
      )
    ) {
      setActiveDocId(null);
    }
  }, [activeDocId, state.documents]);

  useEffect(() => {
    setActiveDocId(null);
  }, [threadId]);

  const handleRemoveDocument = useCallback(async (id: string) => {
    const document = state.documents.find((item) => item.id === id);
    if (!document) return;
    if (!window.confirm(`Delete ${document.name}? This removes its indexed content.`)) return;
    try {
      if (document.remoteId) await deleteDocument(document.remoteId, state.settings);
      removeDocument(id);
      setActiveDocId((current) => (current === id ? null : current));
    } catch (error) {
      setErrorText(error instanceof ApiError ? error.message : "Could not delete the document.");
    }
  }, [state.documents, state.settings]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId, pending]);

  const startNewChat = useCallback(() => {
    const id = newId();
    ensureThread(id);
    setMobileNavOpen(false);
    void navigate({ to: "/chat/$threadId", params: { threadId: id } });
  }, [navigate]);

  const handleDeleteThread = useCallback(
    (id: string) => {
      deleteThread(id);
      if (id === threadId) {
        const next = state.threads.find((t) => t.id !== id);
        if (next) {
          void navigate({ to: "/chat/$threadId", params: { threadId: next.id } });
        } else {
          startNewChat();
        }
      }
    },
    [navigate, startNewChat, state.threads, threadId]
  );

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      setErrorText(null);
      for (const file of Array.from(files)) {
        if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
          setErrorText(`${file.name} is not a PDF.`);
          continue;
        }
        const id = newId();
        addDocument({
          id,
          name: file.name,
          size: file.size,
          status: "uploading",
          uploadedAt: Date.now(),
        });
        try {
          const result = await uploadDocument(file, state.settings);
          patchDocument(id, { status: "ready", ...result });
          setActiveDocId(id);
        } catch (error) {
          const message =
            error instanceof ApiError ? error.message : "Upload failed. Please try again.";
          patchDocument(id, { status: "error", error: message });
          setErrorText(message);
        }
      }
    },
    [state.settings]
  );

  const handleCopyMessage = useCallback(async (message: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedMessageId(message.id);
      window.setTimeout(() => setCopiedMessageId(null), 1600);
    } catch {
      setErrorText("Could not copy the prompt to the clipboard.");
    }
  }, []);

  const handleEditMessage = useCallback((message: ChatMessage) => {
    setInput(message.content);
    setEditingMessageId(message.id);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  const handleSubmit = useCallback(async () => {
    const question = input.trim();
    if (!question || pending) return;
    setErrorText(null);
    setInput("");

    const existingMessage = editingMessageId
      ? messages.find((message) => message.id === editingMessageId)
      : undefined;
    const userMessage: ChatMessage = {
      id: existingMessage?.id ?? newId(),
      role: "user",
      content: question,
      createdAt: Date.now(),
    };
    const existingMessageIndex = existingMessage
      ? messages.findIndex((message) => message.id === existingMessage.id)
      : -1;
    const history = existingMessage
      ? [...messages.slice(0, existingMessageIndex), userMessage]
      : [...messages, userMessage];
    if (existingMessage) {
      editMessage(threadId, existingMessage.id, question);
    } else {
      appendMessage(threadId, userMessage);
    }
    setEditingMessageId(null);
    setPending(true);
    const requestStart = performance.now();

    try {
      const activeDocument = state.documents.find(
        (document) =>
          document.id === activeDocId && document.status === "ready" && document.remoteId
      );
      if (activeDocId && !activeDocument?.remoteId) {
        throw new ApiError("Re-upload this PDF to reconnect it to the backend before asking questions.");
      }
      const chatRequest = {
        question,
        threadId,
        history,
        ...(activeDocument?.remoteId
          ? { documentId: activeDocument.remoteId }
          : {}),
      };
      const { answer, citations } = await sendChat(
        chatRequest,
        state.settings
      );
      setErrorText(null);
      const responseTime = (performance.now() - requestStart) / 1000;
      appendMessage(threadId, {
        id: newId(),
        role: "assistant",
        content: answer,
        createdAt: Date.now(),
        responseTime,
        ...(citations.length ? { citations } : {}),
      });
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Something went wrong talking to the backend.";
      setErrorText(message);
      appendMessage(threadId, {
        id: newId(),
        role: "assistant",
        content: message,
        createdAt: Date.now(),
        failed: true,
      });
    } finally {
      setPending(false);
    }
  }, [activeDocId, editingMessageId, input, messages, pending, state.documents, state.settings, threadId]);

  const sidebar = (
    <DocMindSidebar
      threads={state.threads}
      documents={state.documents}
      activeThreadId={threadId}
      activeDocId={activeDocId}
      collapsed={collapsed}
      onToggleCollapsed={() => setCollapsed((v) => !v)}
      onNewChat={startNewChat}
      onDeleteThread={handleDeleteThread}
      onSelectDocument={setActiveDocId}
      onRemoveDocument={handleRemoveDocument}
      onOpenSettings={() => setSettingsOpen(true)}
    />
  );

  const readyCount = state.documents.filter((d) => d.status === "ready").length;

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      <div className="hidden md:block">{sidebar}</div>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden
          />
          <div className="relative z-10 h-full" onClick={() => setMobileNavOpen(false)}>
            {sidebar}
          </div>
        </div>
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="glass-panel z-10 flex items-center gap-3 rounded-none border-x-0 border-t-0 px-4 py-3">
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">
              {state.threads.find((t) => t.id === threadId)?.title ?? "New chat"}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {activeDocId
                ? `Current document: ${state.documents.find((document) => document.id === activeDocId)?.name ?? "Unknown"}`
                : readyCount > 0
                  ? "Select a document to start asking questions"
                  : "Upload a PDF to ground the answers"}
            </p>
          </div>
        </header>

        <Conversation className="min-h-0 flex-1">
          <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-4 pb-40 pt-8">
            {messages.length === 0 && !pending ? (
              <div className="mx-auto max-w-md pt-16 text-center">
                <h2 className="text-2xl font-semibold tracking-tight">
                  Ask your <span className="text-brand-gradient">documents</span>
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Upload a PDF, then ask anything. Answers come from your FastAPI retrieval
                  service with page-level citations.
                </p>
              </div>
            ) : null}

            {messages.map((message) => (
              <Message
                key={message.id}
                from={message.role}
                className={cn(message.role === "user" && "justify-end")}
              >
                  <MessageContent
                    className={cn(
                      "max-w-[85%]",
                      message.role === "user"
                        ? "rounded-2xl bg-primary px-4 py-2.5 text-primary-foreground"
                        : "bg-transparent px-0",
                      message.failed && "border border-destructive/40 bg-destructive/10 px-4 py-3"
                    )}
                  >
                  {message.role === "assistant" ? (
                    <>
                      {message.failed ? (
                        <p className="flex items-start gap-2 text-sm text-destructive">
                          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                          {message.content}
                        </p>
                      ) : (
                        <MessageResponse>{message.content}</MessageResponse>
                      )}
                      {message.responseTime !== undefined ? (
                        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock3 className="size-3.5" />
                          Responded in {formatResponseTime(message.responseTime)}
                        </p>
                      ) : null}
                      {message.citations?.length ? (
                        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-muted-foreground" aria-label="Sources">
                          <Quote className="size-3.5 text-primary" />
                          Sources
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                  )}
                </MessageContent>
                {message.role === "user" ? (
                  <MessageActions className="justify-end opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <MessageAction
                      tooltip={copiedMessageId === message.id ? "Copied" : "Copy prompt"}
                      label="Copy prompt"
                      onClick={() => void handleCopyMessage(message)}
                    >
                      {copiedMessageId === message.id ? (
                        <Check className="size-3.5" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </MessageAction>
                    <MessageAction
                      tooltip="Edit prompt"
                      label="Edit prompt"
                      onClick={() => handleEditMessage(message)}
                    >
                      <Pencil className="size-3.5" />
                    </MessageAction>
                  </MessageActions>
                ) : null}
              </Message>
            ))}

            {pending && (
              <Message from="assistant">
                <MessageContent className="bg-transparent px-0">
                  <Shimmer className="text-sm">Thinking...</Shimmer>
                </MessageContent>
              </Message>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="pointer-events-none sticky bottom-0 px-4 pb-4">
          <div className="pointer-events-auto mx-auto w-full max-w-3xl">
            {errorText && (
              <p
                role="alert"
                className="mb-2 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                {errorText}
              </p>
            )}
            <PromptInput
              className="glass-panel rounded-2xl"
              onSubmit={(_message, event) => {
                event.preventDefault();
                void handleSubmit();
              }}
            >
              <PromptInputTextarea
                ref={textareaRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask about your PDFs…  (Enter to send, Shift+Enter for a new line)"
                aria-label="Message DocMind AI"
              />
              <PromptInputFooter>
                <PromptInputTools>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    multiple
                    className="sr-only"
                    onChange={(event) => {
                      void handleFiles(event.target.files);
                      event.target.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="size-4" />
                    Upload PDF
                  </Button>
                </PromptInputTools>
                <PromptInputSubmit
                  {...(pending ? { status: "submitted" as const } : {})}
                  disabled={pending || input.trim().length === 0}
                />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </div>
      </main>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={state.settings}
      />
    </div>
  );
}
