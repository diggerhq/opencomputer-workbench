// Markdown for the request and the assistant's replies: paragraphs, inline
// and fenced code in monospace on the code tokens, links that open in a new
// tab. Raw HTML is skipped, never rendered. GitHub-flavored syntax (tables,
// task lists, strikethrough) through remark-gfm.
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

const PROSE = cn(
  "[&_p+p]:mt-3 [&_p+ul]:mt-2 [&_p+ol]:mt-2 [&_ul+p]:mt-3 [&_ol+p]:mt-3",
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li+li]:mt-1",
  "[&_h1]:text-md [&_h1]:font-medium [&_h2]:text-md [&_h2]:font-medium [&_h3]:font-medium",
  "[&_code]:font-mono [&_code]:text-sm",
  "[&_:not(pre)>code]:rounded-sm [&_:not(pre)>code]:bg-muted [&_:not(pre)>code]:px-1",
  "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-code [&_pre]:p-3 [&_pre]:text-code-foreground",
  "[&_blockquote]:border-l [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
  "[&_table]:text-sm [&_th]:text-left [&_th]:font-medium [&_td]:pr-3 [&_th]:pr-3",
  "[&_a]:text-accent [&_a:hover]:underline",
);

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn(PROSE, className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
