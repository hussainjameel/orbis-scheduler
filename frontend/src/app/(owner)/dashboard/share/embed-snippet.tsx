// Fixed dark regardless of the app's own light/dark toggle — code blocks
// read as an editor surface, not a themed page element. Literal hex here
// (not project tokens) is the deliberate exception: this block is meant to
// look the same no matter which mode the rest of the page is in, so tying
// it to the token system would defeat the point. Values borrowed from the
// existing dark palette (surface-1 / text-primary) purely for visual
// coherence with the rest of the app, not because they respond to it.
export function EmbedSnippet({ snippet }: { snippet: string }) {
  return (
    <div className="min-w-0 flex-1 overflow-x-auto rounded-sm bg-[#1A1817] p-4">
      <pre className="text-sm">
        <code className="font-mono whitespace-pre-wrap break-all text-[#F5F2ED]">{snippet}</code>
      </pre>
    </div>
  );
}
