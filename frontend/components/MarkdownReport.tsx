import type { ReactElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { mergeClasses } from "@/lib/cx.mjs";

export interface MarkdownReportProps {
  children: string;
  density?: "compact" | "default";
  className?: string;
}

export default function MarkdownReport({ children, density = "default", className }: MarkdownReportProps): ReactElement {
  const tablePadding = density === "compact" ? "px-snug py-tight" : "px-snug py-snug";
  return (
    <div className={mergeClasses("max-w-none text-base text-text-secondary", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          h1: ({ children: content }) => <h1 className="mb-base mt-section font-display text-3xl font-semibold text-text first:mt-0">{content}</h1>,
          h2: ({ children: content }) => <h2 className="mb-snug mt-section border-b border-border pb-snug text-2xl font-medium text-text">{content}</h2>,
          h3: ({ children: content }) => <h3 className="mb-snug mt-loose text-xl font-medium text-text">{content}</h3>,
          p: ({ children: content }) => <p className="mb-base leading-relaxed last:mb-0">{content}</p>,
          ul: ({ children: content }) => <ul className="mb-base list-disc space-y-tight pl-loose">{content}</ul>,
          ol: ({ children: content }) => <ol className="mb-base list-decimal space-y-tight pl-loose">{content}</ol>,
          li: ({ children: content }) => <li className="pl-tight">{content}</li>,
          a: ({ href, children: content }) => <a href={href} className="font-medium text-text underline decoration-border-strong underline-offset-4 hover:decoration-text">{content}</a>,
          code: ({ className: codeClass, children: content, ...props }) => <code className={mergeClasses("rounded-xs bg-surface-sunken px-tight py-hair font-mono text-sm text-text", codeClass)} {...props}>{content}</code>,
          pre: ({ children: content }) => <pre className="mb-base overflow-x-auto rounded-md border border-border bg-surface-sunken p-base text-sm">{content}</pre>,
          blockquote: ({ children: content }) => <blockquote className="mb-base border-l-2 border-l-border-strong pl-base text-text-muted">{content}</blockquote>,
          table: ({ children: content }) => <div className="-mx-base mb-base overflow-x-auto px-base"><table className="w-full min-w-max border-collapse text-sm">{content}</table></div>,
          thead: ({ children: content }) => <thead className="border-y border-border bg-surface-raised text-2xs uppercase text-text-muted">{content}</thead>,
          th: ({ children: content }) => <th className={mergeClasses("text-left font-medium", tablePadding)}>{content}</th>,
          td: ({ children: content }) => <td className={mergeClasses("border-b border-border text-text-secondary", tablePadding)}>{content}</td>,
          hr: () => <hr className="my-section border-0 border-t border-border" />,
          strong: ({ children: content }) => <strong className="font-semibold text-text">{content}</strong>,
          em: ({ children: content }) => <em>{content}</em>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
