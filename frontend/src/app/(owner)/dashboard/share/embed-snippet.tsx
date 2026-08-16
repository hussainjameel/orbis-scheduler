// Reverses the earlier "fixed dark regardless of theme" decision (see
// docs/DEVLOG.md, 2026-08-07) — theme tokens instead, so this reads as
// part of the page rather than an inserted editor surface. Same nested-box
// pattern the Booking link card's URL field already uses one card up.
export function EmbedSnippet({ snippet }: { snippet: string }) {
  return (
    <div className="min-w-0 overflow-x-auto rounded-sm border border-border-default bg-surface-1 p-4">
      <pre className="text-sm">
        <code className="font-mono whitespace-pre-wrap break-all text-text-primary">{snippet}</code>
      </pre>
    </div>
  );
}
