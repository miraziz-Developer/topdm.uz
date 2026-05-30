"use client";

import Link from "next/link";

/** Lightweight stylist markdown — bold, links, line breaks (no extra deps). */
export function StylistMarkdown({ content }: { content: string }) {
  const lines = content.split("\n");

  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        if (!line.trim() && i === lines.length - 1) return null;
        return (
          <p key={`${i}-${line.slice(0, 16)}`} className="whitespace-pre-wrap text-sm leading-relaxed text-text-200">
            <InlineMarkdown text={line} />
          </p>
        );
      })}
    </div>
  );
}

function InlineMarkdown({ text }: { text: string }) {
  const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = linkRe.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(<BoldChunks key={key++} text={text.slice(last, match.index)} />);
    }
    const href = match[2];
    const isInternal = href.startsWith("/");
    parts.push(
      isInternal ? (
        <Link
          key={key++}
          href={href}
          className="mt-2 inline-flex items-center gap-1 rounded-full border border-gold-500/40 bg-gold-500/10 px-3 py-1.5 text-xs font-semibold text-gold-600 transition hover:bg-gold-500/20"
        >
          {match[1]}
        </Link>
      ) : (
        <a key={key++} href={href} className="font-semibold text-electric-500 underline" target="_blank" rel="noreferrer">
          {match[1]}
        </a>
      ),
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    parts.push(<BoldChunks key={key++} text={text.slice(last)} />);
  }
  return <>{parts}</>;
}

function BoldChunks({ text }: { text: string }) {
  const boldRe = /\*\*([^*]+)\*\*/g;
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = boldRe.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <strong key={k++} className="font-semibold text-text-100">
        {m[1]}
      </strong>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}
