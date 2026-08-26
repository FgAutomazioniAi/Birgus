"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { FileText, Loader2, Maximize2, Minus, Paperclip, Send, X } from "lucide-react";

import { useTheme } from "@/components/organisms/theme-provider";
import { cn } from "@/lib/cn";
import type { ThemeId } from "@/lib/themes";

interface FloatingAssistantProps {
  enabled: boolean;
}

interface AssistantMessage {
  id: string;
  role: "USER" | "ASSISTANT" | string;
  contentText: string | null;
  createdAt?: string;
}

interface AssistantSessionResponse {
  id: string;
  knowledgeMode?: KnowledgeMode;
}

interface AssistantPostResponse {
  assistantMessage?: AssistantMessage;
  userMessage?: AssistantMessage;
}

interface AssistantDocument {
  id: string;
  documentId: string;
  fileName: string;
  contentType: string | null;
  sizeBytes: number | null;
  extractionStatus: string | null;
}

interface AssistantDocumentResponse {
  document?: AssistantDocument;
  documents?: AssistantDocument[];
}

type KnowledgeMode = "on_demand" | "saved" | "hybrid";

const knowledgeModeOptions: Array<{ value: KnowledgeMode; label: string }> = [
  { value: "hybrid", label: "Hybrid" },
  { value: "on_demand", label: "Fast" },
  { value: "saved", label: "Thinking" },
];

const assistantLogoByTheme: Record<ThemeId, string> = {
  predefinito: "/birgus-logo/cropped/blue.png",
  dark: "/birgus-logo/cropped/black.png",
  grafite: "/birgus-logo/cropped/black.png",
  lavanda: "/birgus-logo/cropped/blue.png",
  oceano: "/birgus-logo/cropped/azure.png",
  ambra: "/birgus-logo/cropped/violet.png",
};

export function FloatingAssistant({ enabled }: FloatingAssistantProps) {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [knowledgeMode, setKnowledgeMode] = useState<KnowledgeMode>("hybrid");
  const [isSending, setIsSending] = useState(false);
  const [isSavingKnowledgeMode, setIsSavingKnowledgeMode] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [documents, setDocuments] = useState<AssistantDocument[]>([]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const assistantLogoSrc = assistantLogoByTheme[theme] ?? assistantLogoByTheme.predefinito;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) {
        return;
      }

      setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  if (!enabled) {
    return null;
  }

  const ensureSession = async (): Promise<string> => {
    if (sessionId) {
      return sessionId;
    }

    const response = await fetch("/api/assistant/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        moduleKey: "conversational_assistant",
        title: "Chat Birgus",
        knowledgeMode,
      }),
    });
    if (!response.ok) {
      throw new Error("Impossibile aprire la chat.");
    }

    const payload = (await response.json()) as AssistantSessionResponse;
    setSessionId(payload.id);
    if (payload.knowledgeMode && ["hybrid", "on_demand", "saved"].includes(payload.knowledgeMode)) {
      setKnowledgeMode(payload.knowledgeMode);
    }
    return payload.id;
  };

  const updateKnowledgeMode = async (nextMode: KnowledgeMode) => {
    const previousMode = knowledgeMode;
    setKnowledgeMode(nextMode);
    setIsSavingKnowledgeMode(true);
    try {
      const activeSessionId = await ensureSession();
      const response = await fetch(`/api/assistant/sessions/${activeSessionId}/preferences`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ knowledgeMode: nextMode }),
      });
      const payload = (await response.json().catch(() => ({}))) as { knowledgeMode?: KnowledgeMode; message?: string };
      if (!response.ok) {
        throw new Error(typeof payload.message === "string" ? payload.message : "Modalita knowledge non aggiornata.");
      }
      if (payload.knowledgeMode) {
        setKnowledgeMode(payload.knowledgeMode);
      }
    } catch (error) {
      setKnowledgeMode(previousMode);
    } finally {
      setIsSavingKnowledgeMode(false);
    }
  };

  const uploadDocument = async (file: File | null) => {
    if (!file || isUploading) {
      return;
    }

    setIsUploading(true);
    try {
      const activeSessionId = await ensureSession();
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(`/api/assistant/sessions/${activeSessionId}/documents`, {
        method: "POST",
        body,
      });
      const payload = (await response.json().catch(() => ({}))) as AssistantDocumentResponse & { message?: string };
      if (!response.ok || !payload.document) {
        throw new Error(typeof payload.message === "string" ? payload.message : "Caricamento documento non riuscito.");
      }

      setDocuments((current) => [...current.filter((item) => item.id !== payload.document?.id), payload.document as AssistantDocument]);
    } catch {
      // Keep chatbot upload failures silent; the user can retry without a popup.
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const sendMessage = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const content = input.trim();
    if (!content || isSending) {
      return;
    }

    setIsSending(true);
    setInput("");
    const optimisticMessage: AssistantMessage = {
      id: `local-${Date.now()}`,
      role: "USER",
      contentText: content,
    };
    setMessages((current) => [...current, optimisticMessage]);

    try {
      const activeSessionId = await ensureSession();
      const response = await fetch(`/api/assistant/sessions/${activeSessionId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const payload = (await response.json().catch(() => ({}))) as AssistantPostResponse & { message?: string };
      if (!response.ok) {
        throw new Error(typeof payload.message === "string" ? payload.message : "Risposta assistente non riuscita.");
      }

      setMessages((current) => [
        ...current.filter((message) => message.id !== optimisticMessage.id),
        ...(payload.userMessage ? [payload.userMessage] : [optimisticMessage]),
        ...(payload.assistantMessage ? [payload.assistantMessage] : []),
      ]);
    } catch {
      setMessages((current) => current.filter((message) => message.id !== optimisticMessage.id));
      setInput(content);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div ref={rootRef} className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {isOpen ? (
        <section
          className={cn(
            "flex flex-col overflow-hidden rounded-lg border border-border-default bg-bg-surface shadow-2xl",
            isExpanded ? "h-[min(760px,calc(100vh-4rem))] w-[min(760px,calc(100vw-2rem))]" : "h-[560px] w-[380px] max-w-[calc(100vw-2rem)]",
          )}
          aria-label="Assistente Birgus"
        >
          <header className="flex items-center justify-between border-b border-border-default bg-bg-page px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-bg-surface ring-1 ring-brand-primary/15">
                <img
                  src={assistantLogoSrc}
                  alt="Birgus Assistant"
                  className="h-full w-full object-cover"
                />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">Birgus Assistant</p>
                <p className="text-xs text-text-muted">Chat con memoria della sessione</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor="floating-assistant-knowledge-mode">Knowledge mode</label>
              <select
                id="floating-assistant-knowledge-mode"
                name="floating-assistant-knowledge-mode"
                value={knowledgeMode}
                disabled={isSavingKnowledgeMode}
                className="h-8 rounded-md border border-border-default bg-bg-surface px-2 text-xs font-medium text-text-secondary outline-none focus:ring-2 focus:ring-ring-primary disabled:opacity-60"
                onChange={(event) => void updateKnowledgeMode(event.target.value as KnowledgeMode)}
              >
                {knowledgeModeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <button
                type="button"
                className="rounded-md p-2 text-text-muted hover:bg-bg-muted hover:text-text-primary"
                onClick={() => setIsExpanded((current) => !current)}
                aria-label={isExpanded ? "Riduci chat" : "Espandi chat"}
              >
                {isExpanded ? <Minus className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
              <button
                type="button"
                className="rounded-md p-2 text-text-muted hover:bg-bg-muted hover:text-text-primary"
                onClick={() => setIsOpen(false)}
                aria-label="Chiudi chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-bg-page p-4">
            {documents.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {documents.map((document) => (
                  <div
                    key={document.id}
                    className="flex max-w-full items-center gap-2 rounded-md border border-border-default bg-bg-surface px-2 py-1 text-xs text-text-secondary"
                    title={document.fileName}
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0 text-brand-primary" />
                    <span className="max-w-40 truncate">{document.fileName}</span>
                    {document.extractionStatus ? (
                      <span className="rounded bg-bg-muted px-1.5 py-0.5 text-[10px] uppercase text-text-muted">
                        {document.extractionStatus}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
            {messages.length === 0 ? (
              <div className="mt-auto rounded-lg border border-dashed border-border-default bg-bg-surface p-4 text-sm text-text-muted">
                Chiedimi informazioni su progetti, documenti o storici. puoi allegarmi documenti per analizzarli.
              </div>
            ) : null}
            {messages.map((message) => {
              const isUser = message.role === "USER";
              return (
                <div key={message.id} className={cn("flex", isUser ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-relaxed",
                      isUser
                        ? "bg-brand-primary text-text-inverse"
                        : "border border-border-default bg-bg-surface text-text-primary",
                    )}
                  >
                    {message.contentText || "..."}
                  </div>
                </div>
              );
            })}
            {isSending ? (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-lg border border-border-default bg-bg-surface px-3 py-2 text-sm text-text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Elaborazione
                </div>
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>

          <form className="shrink-0 space-y-2 border-t border-border-default bg-bg-surface p-3" onSubmit={sendMessage}>
            <label className="sr-only" htmlFor="floating-assistant-message">Messaggio</label>
            <input
              ref={fileInputRef}
              id="floating-assistant-document"
              name="floating-assistant-document"
              type="file"
              accept=".pdf,.txt,.md,.csv,.json,text/*,application/pdf"
              className="hidden"
              onChange={(event) => void uploadDocument(event.target.files?.[0] ?? null)}
            />
            <textarea
              id="floating-assistant-message"
              name="floating-assistant-message"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              rows={3}
              className="max-h-28 min-h-20 w-full resize-none rounded-md border border-border-default bg-bg-page px-3 py-2 text-sm leading-relaxed text-text-primary outline-none focus:ring-2 focus:ring-ring-primary"
              placeholder="Scrivi una domanda..."
            />
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={isUploading}
                className="flex h-9 items-center gap-2 rounded-md border border-border-default bg-bg-page px-3 text-xs font-medium text-text-secondary hover:bg-bg-muted hover:text-text-primary disabled:opacity-50"
                aria-label="Allega documento"
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                <span>Allega</span>
              </button>
              <button
                type="submit"
                disabled={isSending || !input.trim()}
                className="flex h-9 items-center gap-2 rounded-md bg-brand-primary px-3 text-xs font-semibold text-text-inverse hover:bg-brand-primary-hover disabled:opacity-50"
                aria-label="Invia"
              >
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span>Invia</span>
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={cn(
          "group relative flex h-14 w-14 items-center justify-center rounded-full border text-text-inverse shadow-2xl transition",
          theme === "dark"
            ? "border-white bg-white hover:bg-white"
            : "border-transparent bg-brand-primary hover:bg-brand-primary-hover",
        )}
        aria-label="Apri assistente"
      >
        <span className="absolute h-12 w-12 rounded-full bg-brand-primary/10 blur-md transition group-hover:bg-brand-primary/20" />
        <span className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-white/20">
          <img
            src={assistantLogoSrc}
            alt=""
            className={cn(
              "h-full w-full object-cover transition-transform duration-300 ease-out",
              isOpen ? "rotate-[0deg]" : "rotate-[45deg] group-hover:rotate-[0deg]",
            )}
            aria-hidden="true"
          />
        </span>
      </button>
    </div>
  );
}
