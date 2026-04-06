import { Inbox } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="app-surface app-panel text-sm text-[color:var(--muted)]">
      <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--accent-soft)] text-[color:var(--accent-ink)]">
        <Inbox className="h-5 w-5" />
      </div>
      <p className="text-base font-semibold text-[color:var(--foreground)]">{title}</p>
      <p className="mt-1 leading-6">{description}</p>
    </div>
  );
}
