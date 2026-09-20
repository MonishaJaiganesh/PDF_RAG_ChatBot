import { Link } from "@tanstack/react-router";
import {
  FileText,
  Loader2,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DocumentMeta, Thread } from "@/lib/docmind/types";

function formatSize(bytes: number) {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

type Props = {
  threads: Thread[];
  documents: DocumentMeta[];
  activeThreadId: string;
  activeDocId: string | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onNewChat: () => void;
  onDeleteThread: (id: string) => void;
  onSelectDocument: (id: string) => void;
  onRemoveDocument: (id: string) => void | Promise<void>;
  onOpenSettings: () => void;
};

export function DocMindSidebar({
  threads,
  documents,
  activeThreadId,
  activeDocId,
  collapsed,
  onToggleCollapsed,
  onNewChat,
  onDeleteThread,
  onSelectDocument,
  onRemoveDocument,
  onOpenSettings,
}: Props) {
  return (
    <aside
      aria-label="Workspace navigation"
      className={cn(
        "flex h-full flex-col gap-4 border-r border-border bg-sidebar/80 backdrop-blur-xl transition-[width] duration-300",
        collapsed ? "w-[68px] px-2 py-4" : "w-[286px] p-4"
      )}
    >
      <div className={cn("flex items-center gap-2", collapsed && "flex-col")}>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            aria-hidden
            className="bg-brand-gradient grid size-9 shrink-0 place-items-center rounded-xl text-sm font-bold text-primary-foreground"
          >
            D
          </span>
          {!collapsed && (
            <span className="truncate text-sm font-semibold tracking-tight">
              DocMind <span className="text-brand-gradient">AI</span>
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
        </Button>
      </div>

      <Button
        onClick={onNewChat}
        className={cn("justify-center gap-2", collapsed && "px-0")}
        aria-label="Start a new chat"
      >
        <Plus className="size-4" />
        {!collapsed && "New chat"}
      </Button>

      {!collapsed && (
        <div className="scroll-slim flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto pr-1">
          <section aria-labelledby="docs-heading">
            <h2
              id="docs-heading"
              className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Documents
            </h2>
            {documents.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                No PDFs yet. Upload one from the composer below.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {documents.map((doc) => {
                  const selected = activeDocId === doc.id;
                  return (
                    <li
                      key={doc.id}
                      className={cn(
                        "group flex items-start gap-2 rounded-lg border border-transparent bg-secondary/50 p-2 transition-colors",
                        selected && doc.status === "ready" && "border-primary/40 bg-primary/10"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectDocument(doc.id)}
                        disabled={doc.status !== "ready" || !doc.remoteId}
                        aria-pressed={selected}
                        className="flex min-w-0 flex-1 items-start gap-2 text-left disabled:opacity-70"
                      >
                        {doc.status === "uploading" ? (
                          <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />
                        ) : doc.status === "error" ? (
                          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                        ) : (
                          <FileText
                            className={cn(
                              "mt-0.5 size-4 shrink-0",
                              selected ? "text-primary" : "text-muted-foreground"
                            )}
                          />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-medium">
                            {doc.name}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {doc.status === "uploading"
                              ? "Indexing..."
                              : doc.status === "error"
                                ? (doc.error ?? "Upload failed")
                                : !doc.remoteId
                                  ? "Re-upload required"
                                : [formatSize(doc.size), selected ? "Current document" : "Tap to use"]
                                    .filter(Boolean)
                                    .join(" · ")}
                          </span>
                        </span>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${doc.name}`}
                        onClick={() => onRemoveDocument(doc.id)}
                        className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="history-heading">
            <h2
              id="history-heading"
              className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Conversations
            </h2>
            <ul className="space-y-1">
              {threads.map((thread) => {
                const active = thread.id === activeThreadId;
                return (
                  <li
                    key={thread.id}
                    className={cn(
                      "group flex items-center gap-1 rounded-lg px-1 transition-colors",
                      active ? "bg-secondary" : "hover:bg-secondary/60"
                    )}
                  >
                    <Link
                      to="/chat/$threadId"
                      params={{ threadId: thread.id }}
                      className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left text-xs"
                      aria-current={active ? "page" : undefined}
                    >
                      <MessageSquare
                        className={cn(
                          "size-3.5 shrink-0",
                          active ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                      <span className="truncate">{thread.title}</span>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete conversation ${thread.title}`}
                      onClick={() => onDeleteThread(thread.id)}
                      className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}

      <div className={cn("mt-auto", collapsed && "flex justify-center")}>
        <Button
          variant="ghost"
          size={collapsed ? "icon-sm" : "sm"}
          onClick={onOpenSettings}
          className={cn(!collapsed && "w-full justify-start gap-2")}
          aria-label="Open backend settings"
        >
          <Settings className="size-4" />
          {!collapsed && "Settings"}
        </Button>
      </div>
    </aside>
  );
}
