"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/cn";

export type ContentView = "rendered" | "text";

function toPlainText(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/^```[^\n]*\n?|```$/g, ""))
    .replace(/!?(\[[^\]]*\])\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/(?:\*\*|__|\*|_|~~|`)/g, "")
    .replace(/^\s*[-*+]\s+/gm, "- ")
    .trim();
}

export function MarkdownContent({ content, className, view: controlledView }: { content: string; className?: string; view?: ContentView }) {
  const [localView, setLocalView] = useState<ContentView>("rendered");
  const view = controlledView ?? localView;

  return (
    <div className={cn(className)}>
      {controlledView === undefined ? (
        <div className="mb-2 inline-flex overflow-hidden rounded-md border border-border-default bg-bg-surface" role="group" aria-label="Formato risposta">
          <button type="button" onClick={() => setLocalView("rendered")} className={cn("h-7 px-2 text-xs font-semibold", view === "rendered" ? "bg-brand-primary text-text-inverse" : "text-text-muted hover:bg-bg-muted hover:text-text-primary")} title="Vista Markdown formattata">.md</button>
          <button type="button" onClick={() => setLocalView("text")} className={cn("h-7 border-l border-border-default px-2 text-xs font-semibold", view === "text" ? "bg-brand-primary text-text-inverse" : "text-text-muted hover:bg-bg-muted hover:text-text-primary")} title="Vista testo semplice">.txt</button>
        </div>
      ) : null}
      {view === "rendered" ? (
        <div className="markdown-content max-h-72 overflow-auto text-sm leading-6 text-text-secondary">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => <h1 className="mb-3 text-xl font-bold text-text-primary">{children}</h1>,
              h2: ({ children }) => <h2 className="mb-2 mt-4 text-lg font-bold text-text-primary">{children}</h2>,
              h3: ({ children }) => <h3 className="mb-2 mt-3 text-base font-bold text-text-primary">{children}</h3>,
              p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
              ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
              ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
              blockquote: ({ children }) => <blockquote className="mb-3 border-l-2 border-brand-primary pl-3 italic text-text-muted">{children}</blockquote>,
              a: ({ children, href }) => <a className="font-medium text-brand-primary underline" href={href} target="_blank" rel="noreferrer">{children}</a>,
              strong: ({ children }) => <strong className="font-bold text-text-primary">{children}</strong>,
              code: ({ children }) => <code className="rounded bg-bg-muted px-1 py-0.5 font-mono text-xs text-text-primary">{children}</code>,
              pre: ({ children }) => <pre className="mb-3 overflow-auto rounded-md border border-border-default bg-bg-surface p-3 text-xs leading-5">{children}</pre>,
              table: ({ children }) => <div className="mb-3 overflow-x-auto"><table className="min-w-full border-collapse text-xs">{children}</table></div>,
              th: ({ children }) => <th className="border border-border-default bg-bg-muted px-2 py-1 text-left font-bold text-text-primary">{children}</th>,
              td: ({ children }) => <td className="border border-border-default px-2 py-1 align-top">{children}</td>,
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      ) : (
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-border-default bg-bg-surface p-3 text-xs leading-5 text-text-secondary">
          {toPlainText(content)}
        </pre>
      )}
    </div>
  );
}
