import { createFileRoute } from "@tanstack/react-router";
import { ChatWorkspace } from "@/components/docmind/chat-workspace";

export const Route = createFileRoute("/chat/$threadId")({
  head: () => ({
    meta: [
      { title: "DocMind AI" },
      {
        name: "description",
        content:
          "Chat with your uploaded PDFs. DocMind AI returns grounded answers with page-level citations from your retrieval backend.",
      },
      { property: "og:title", content: "DocMind AI" },
      {
        property: "og:description",
        content: "Grounded answers from your own PDF documents, with page-level citations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatRoute,
});

function ChatRoute() {
  const { threadId } = Route.useParams();
  return <ChatWorkspace threadId={threadId} />;
}
