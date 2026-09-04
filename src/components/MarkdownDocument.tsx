import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function MarkdownDocument({ content }: { content: string }) {
  return (
    <div className="space-y-4 text-sm leading-7 text-slate-800">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="mt-7 border-b border-slate-200 pb-3 text-2xl font-black text-slate-950 first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-6 text-xl font-black text-slate-950">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-5 text-lg font-black text-slate-900">{children}</h3>,
          p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
          ul: ({ children }) => <ul className="list-disc space-y-1 pl-6">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-1 pl-6">{children}</ol>,
          blockquote: ({ children }) => <blockquote className="border-l-4 border-blue-300 bg-blue-50 px-4 py-2 text-slate-700">{children}</blockquote>,
          table: ({ children }) => <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[640px] border-collapse text-left text-sm">{children}</table></div>,
          thead: ({ children }) => <thead className="bg-slate-900 text-white">{children}</thead>,
          th: ({ children }) => <th className="border border-slate-300 px-3 py-2.5 font-black">{children}</th>,
          td: ({ children }) => <td className="border border-slate-200 px-3 py-2.5 align-top">{children}</td>,
          code: ({ children }) => <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-800">{children}</code>,
          hr: () => <hr className="my-6 border-slate-200" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
