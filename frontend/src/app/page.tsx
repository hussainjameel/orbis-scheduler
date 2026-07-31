import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="p-8">
      <h1 className="text-2xl text-text-primary">Orbis Scheduler</h1>
      <p className="text-sm text-text-secondary mb-4">09:30 — 10:00 · 30 Jul 2026</p>

      <div className="bg-surface-2 border border-border-default rounded-md p-4 max-w-sm">
        <p className="text-base text-text-primary mb-3">Sarah Chen</p>

        <div className="flex gap-2 items-center">
<Button>Approve</Button>
<Button variant="outline">Reject</Button>

          <span className="bg-pending text-pending-text rounded-full px-2.5 py-1 text-xs">
            Pending
          </span>
        </div>
      </div>
    </main>
  );
}