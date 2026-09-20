import { useEffect, useRef, useState } from "react";
import "./App.css";

const API_URL = "http://127.0.0.1:8000";

function App() {
  const [chats, setChats] = useState(() => {
    try {
      const saved = localStorage.getItem("pdf-rag-chats");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeChatId, setActiveChatId] = useState(null);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Save chat history
  useEffect(() => {
    localStorage.setItem("pdf-rag-chats", JSON.stringify(chats));
  }, [chats]);

  // Automatically scroll to newest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [chats, loading]);

  const activeChat = chats.find(
    (chat) => chat.id === activeChatId
  );

  // Create a new conversation
  const createNewChat = () => {
    const newChat = {
      id: Date.now(),
      title: "New conversation",
      messages: [],
    };

    setChats((previous) => [newChat, ...previous]);
    setActiveChatId(newChat.id);
    setQuestion("");

    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  // Select a previous conversation
  const selectChat = (chatId) => {
    setActiveChatId(chatId);
    setQuestion("");

    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  // Delete a conversation
  const deleteChat = (chatId, event) => {
    event.stopPropagation();

    setChats((previous) =>
      previous.filter((chat) => chat.id !== chatId)
    );

    if (activeChatId === chatId) {
      setActiveChatId(null);
    }
  };

  // Select PDF
  const handleFileChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (file.type !== "application/pdf") {
      alert("Please select a PDF file.");
      return;
    }

    setSelectedFile(file);
  };

  // Ask question
  const handleAskQuestion = async () => {
    const trimmedQuestion = question.trim();

    if (!trimmedQuestion || loading) {
      return;
    }

    let chatId = activeChatId;

    // Automatically create chat if none exists
    if (!chatId) {
      chatId = Date.now();

      const newChat = {
        id: chatId,
        title:
          trimmedQuestion.length > 35
            ? trimmedQuestion.substring(0, 35) + "..."
            : trimmedQuestion,
        messages: [],
      };

      setChats((previous) => [newChat, ...previous]);
      setActiveChatId(chatId);
    }

    const userMessage = {
      role: "user",
      content: trimmedQuestion,
    };

    // Immediately display user's question
    setChats((previous) =>
      previous.map((chat) => {
        if (chat.id !== chatId) {
          return chat;
        }

        return {
          ...chat,
          title:
            chat.messages.length === 0
              ? trimmedQuestion.length > 35
                ? trimmedQuestion.substring(0, 35) + "..."
                : trimmedQuestion
              : chat.title,
          messages: [...chat.messages, userMessage],
        };
      })
    );

    setQuestion("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: trimmedQuestion,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Backend request failed."
        );
      }

      const assistantMessage = {
        role: "assistant",
        content:
          data.answer ||
          "I couldn't generate an answer.",
        sources: data.sources || [],
      };

      setChats((previous) =>
        previous.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                messages: [
                  ...chat.messages,
                  assistantMessage,
                ],
              }
            : chat
        )
      );
    } catch (error) {
      console.error("RAG request error:", error);

      const errorMessage = {
        role: "assistant",
        content:
          "I couldn't connect to the RAG backend. Please make sure FastAPI and Ollama are running.",
        sources: [],
        error: true,
      };

      setChats((previous) =>
        previous.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                messages: [
                  ...chat.messages,
                  errorMessage,
                ],
              }
            : chat
        )
      );
    } finally {
      setLoading(false);

      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  // Enter = send
  // Shift + Enter = new line
  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleAskQuestion();
    }
  };

  return (
    <div className="app">

      {/* ================= SIDEBAR ================= */}

      <aside className="sidebar">

        <div className="sidebar-top">

          <div className="brand">
            <div className="brand-icon">
              ✦
            </div>

            <div>
              <div className="brand-name">
                DocMind AI
              </div>

              <div className="brand-subtitle">
                PDF Intelligence
              </div>
            </div>
          </div>

          <button
            className="new-chat-button"
            onClick={createNewChat}
          >
            <span className="plus">＋</span>
            <span>New chat</span>
          </button>

          {/* DOCUMENT */}

          <div className="sidebar-section">

            <div className="section-label">
              DOCUMENT
            </div>

            <label
              htmlFor="pdf-upload"
              className="document-upload"
            >

              <div className="document-icon">
                📄
              </div>

              <div className="document-info">

                <div className="document-title">
                  {selectedFile
                    ? selectedFile.name
                    : "Add a PDF"}
                </div>

                <div className="document-status">
                  {selectedFile
                    ? `${Math.round(
                        selectedFile.size / 1024
                      )} KB • Ready`
                    : "Click to browse"}
                </div>

              </div>

              {selectedFile && (
                <button
                  className="remove-file"
                  onClick={(event) => {
                    event.preventDefault();
                    setSelectedFile(null);
                  }}
                >
                  ×
                </button>
              )}

            </label>

            <input
              id="pdf-upload"
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileChange}
              hidden
            />

          </div>

          {/* CHAT HISTORY */}

          <div className="sidebar-section history-section">

            <div className="section-label">
              CHAT HISTORY
            </div>

            {chats.length === 0 ? (
              <div className="empty-history">
                Your conversations will appear here.
              </div>
            ) : (
              <div className="history-list">

                {chats.map((chat) => (
                  <div
                    key={chat.id}
                    className={`history-item ${
                      activeChatId === chat.id
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      selectChat(chat.id)
                    }
                  >

                    <span className="history-icon">
                      💬
                    </span>

                    <span className="history-title">
                      {chat.title}
                    </span>

                    <button
                      className="delete-chat"
                      onClick={(event) =>
                        deleteChat(chat.id, event)
                      }
                    >
                      ×
                    </button>

                  </div>
                ))}

              </div>
            )}

          </div>

        </div>

        {/* SIDEBAR BOTTOM */}

        <div className="sidebar-bottom">

          <div className="backend-status">
            <span className="status-dot"></span>
            <span>Backend connected</span>
          </div>

          <div className="stack-info">
            <span>ChromaDB</span>
            <span>•</span>
            <span>Ollama</span>
          </div>

        </div>

      </aside>

      {/* ================= MAIN ================= */}

      <main className="chat-area">

        {/* TOP BAR */}

        <header className="topbar">

          <div className="conversation-title">

            <div className="online-dot"></div>

            <span>
              {activeChat
                ? activeChat.title
                : "New conversation"}
            </span>

          </div>

          <div className="topbar-actions">
            <button
              title="New chat"
              onClick={createNewChat}
            >
              ＋
            </button>

            <button title="Settings">
              ⚙
            </button>
          </div>

        </header>

        {/* ================= MESSAGES ================= */}

        <div className="messages">

          {!activeChat ||
          activeChat.messages.length === 0 ? (
            <div className="welcome">

              <div className="welcome-icon">
                ✦
              </div>

              <h1>
                Ask anything about
                <span> your document</span>
              </h1>

              <p>
                Upload a PDF from the sidebar, then
                start a conversation. Your questions
                stay grounded in the document.
              </p>

              <div className="suggestions">

                <button
                  onClick={() =>
                    setQuestion(
                      "Summarize this document."
                    )
                  }
                >
                  Summarize this document
                </button>

                <button
                  onClick={() =>
                    setQuestion(
                      "What are the key takeaways?"
                    )
                  }
                >
                  What are the key takeaways?
                </button>

                <button
                  onClick={() =>
                    setQuestion(
                      "List the main topics covered."
                    )
                  }
                >
                  List the main topics covered
                </button>

              </div>

            </div>
          ) : (
            <div className="conversation">

              {activeChat.messages.map(
                (message, index) => (

                  <div
                    key={index}
                    className={`message-row ${message.role}`}
                  >

                    <div className="message-avatar">

                      {message.role === "user"
                        ? "You"
                        : "✦"}

                    </div>

                    <div className="message-body">

                      <div className="message-name">

                        {message.role === "user"
                          ? "You"
                          : "DocMind AI"}

                      </div>

                      <div
                        className={`message-text ${
                          message.error
                            ? "error-message"
                            : ""
                        }`}
                      >
                        {message.content}
                      </div>

                      {/* SOURCES */}

                      {message.role ===
                        "assistant" &&
                        message.sources &&
                        message.sources.length >
                          0 && (

                          <div className="sources">

                            <div className="sources-heading">
                              <span>▣</span>
                              Sources
                            </div>

                            <div className="source-list">

                              {[
                                ...new Map(
                                  message.sources.map(
                                    (source) => [
                                      source.page,
                                      source,
                                    ]
                                  )
                                ).values(),
                              ].map(
                                (
                                  source,
                                  sourceIndex
                                ) => (

                                  <div
                                    className="source-card"
                                    key={sourceIndex}
                                  >

                                    <div className="source-page">
                                      📄
                                    </div>

                                    <div>
                                      <div className="source-title">
                                        Page{" "}
                                        {source.page}
                                      </div>

                                      <div className="source-label">
                                        Retrieved context
                                      </div>
                                    </div>

                                  </div>

                                )
                              )}

                            </div>

                          </div>

                        )}

                    </div>

                  </div>

                )
              )}

            </div>
          )}

          {/* THINKING */}

          {loading && (
            <div className="message-row assistant">

              <div className="message-avatar">
                ✦
              </div>

              <div className="message-body">

                <div className="message-name">
                  DocMind AI
                </div>

                <div className="thinking">

                  <span className="thinking-dot"></span>
                  <span className="thinking-dot"></span>
                  <span className="thinking-dot"></span>

                  <span className="thinking-text">
                    Thinking about your document...
                  </span>

                </div>

              </div>

            </div>
          )}

          {/* Scroll target */}

          <div
            ref={messagesEndRef}
            className="messages-end"
          />

        </div>

        {/* ================= INPUT ================= */}

        <div className="input-wrapper">

          <div className="input-box">

            <textarea
              ref={inputRef}
              value={question}
              onChange={(event) =>
                setQuestion(event.target.value)
              }
              onKeyDown={handleKeyDown}
              placeholder={
                selectedFile
                  ? "Ask a question about your PDF..."
                  : "Upload a PDF to begin, or ask anyway..."
              }
              rows="1"
            />

            <button
              className="send-button"
              onClick={handleAskQuestion}
              disabled={
                loading ||
                !question.trim()
              }
            >
              {loading ? (
                <span className="loading-spinner"></span>
              ) : (
                "↑"
              )}
            </button>

          </div>

          <div className="input-hint">
            <span>Press</span>
            <kbd>Enter</kbd>
            <span>to send</span>
            <span>•</span>
            <kbd>Shift</kbd>
            <span>+</span>
            <kbd>Enter</kbd>
            <span>for new line</span>
          </div>

        </div>

      </main>

    </div>
  );
}

export default App;