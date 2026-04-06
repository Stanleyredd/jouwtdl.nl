import { percent } from "@/lib/utils";

interface ProgressCardProps {
  label: string;
  value: number;
  description?: string;
}

export function ProgressCard({ label, value, description }: ProgressCardProps) {
  return (
    <div className="app-surface app-panel">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-[color:var(--foreground)]">{label}</p>
        <span className="text-sm text-[color:var(--muted)]">{percent(value)}</span>
      </div>
      <div className="app-progress-track mt-3 h-1.5 rounded-full">
        <div
          className="h-1.5 rounded-full bg-[color:var(--accent-strong)]"
          style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
        />
      </div>
      {description ? (
        <p className="mt-2 text-sm leading-5 text-[color:var(--muted)]">{description}</p>
      ) : null}
    </div>
  );
}
