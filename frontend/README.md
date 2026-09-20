# DocMind Chat (70)

# DocMind AI implementation plan

## Outcome

- Replace the placeholder with a responsive dark PDF RAG chat workspace.

- Support multiple browser-saved conversations, each with its own `/chat/:threadId` URL.

- Connect document upload and chat actions to configurable FastAPI REST endpoints at `http://127.0.0.1:8000`.

## Interface

- Build a collapsible sidebar with New Chat, uploaded documents and status, conversation history, and Settings.

- Build the conversation surface with right-aligned user messages, left-aligned markdown answers, citations/source-page chips, and a thinking state directly after the submitted question.

- Keep the submitted question visible, scroll smoothly without unexpected jumps, and retain prior turns onscreen.

- Add a fixed-bottom composer with PDF upload, multiline input, Enter-to-send, Shift+Enter newline, and clear upload/API error states.

## Behavior

- Store threads, per-thread messages, and document metadata in browser storage with idempotent initialization.

- Route thread creation and selection through real page URLs and restore the selected thread after refresh.

- Send the complete thread history and selected document context to FastAPI; never synthesize an answer in the browser.

- Centralize endpoint paths and response normalization so the frontend can be adapted to the existing backend contract easily.

## Technical details

- Compose the visible transcript and composer from AI Elements primitives.

- Use semantic design tokens for the graphite/cyan/magenta glass interface and restrained motion.

- Add route-specific metadata and accessible labels, focus handling, responsive behavior, and reduced-motion support.

- Verify the preview on desktop and mobile, including thread switching, optimistic messages, upload state, keyboard submission, loading placement, and API-error handling.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/455accbb-6f62-4324-bec6-4564be816948).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
