import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ensureThread, newId, useDocMindState, useIsHydrated } from "@/lib/docmind/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DocMind AI — Chat with your PDF documents" },
      {
        name: "description",
        content:
          "DocMind AI is a retrieval chat workspace for your PDFs: upload documents, ask questions, and get cited answers from your FastAPI backend.",
      },
      { property: "og:title", content: "DocMind AI — Chat with your PDF documents" },
      {
        property: "og:description",
        content: "Upload PDFs and get cited, grounded answers in a fast dark chat workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const hydrated = useIsHydrated();
  const state = useDocMindState();

  useEffect(() => {
    if (!hydrated) return;
    const existing = state.threads[0]?.id;
    const threadId = existing ?? newId();
    ensureThread(threadId);
    void navigate({ to: "/chat/$threadId", params: { threadId }, replace: true });
  }, [hydrated, navigate, state.threads]);

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          DocMind <span className="text-brand-gradient">AI</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Opening your workspace…</p>
      </div>
    </div>
  );
}
