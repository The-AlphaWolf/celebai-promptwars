/**
 * Renders the small markdown subset the assistant uses (### headings, - and 1.
 * lists, **bold**, *italic*) as React elements. No HTML is ever injected.
 */
const INLINE_TOKEN = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;

function parseInline(text) {
  return text.split(INLINE_TOKEN).map((part, index) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (/^\*[^*]+\*$/.test(part)) return <em key={index}>{part.slice(1, -1)}</em>;
    return part;
  });
}

export default function FormattedText({ text }) {
  if (!text) return null;
  return (
    <div className="msg-rich-content">
      {text.split('\n').map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={index} className="msg-space" />;
        if (trimmed.startsWith('#### ')) return <p key={index} className="msg-h4">{parseInline(trimmed.slice(5))}</p>;
        if (trimmed.startsWith('### ')) return <p key={index} className="msg-h3">{parseInline(trimmed.slice(4))}</p>;
        if (trimmed === '---') return <hr key={index} className="msg-hr" />;
        if (/^[-*] /.test(trimmed)) {
          return (
            <div key={index} className="msg-li">
              <span className="msg-bullet" aria-hidden="true">✦</span>
              <span>{parseInline(trimmed.slice(2))}</span>
            </div>
          );
        }
        const numbered = /^(\d+)\.\s+(.*)$/.exec(trimmed);
        if (numbered) {
          return (
            <div key={index} className="msg-num-li">
              <span className="msg-num-badge">{numbered[1]}</span>
              <span>{parseInline(numbered[2])}</span>
            </div>
          );
        }
        return <p key={index} className="msg-p">{parseInline(trimmed)}</p>;
      })}
    </div>
  );
}
