import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  compact = false,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <section
      className={cn(
        "flex flex-wrap items-end justify-between gap-4",
        compact ? "" : "pb-1",
      )}
    >
      <div className="max-w-xl">
        <p className="app-label">{eyebrow}</p>
        <h1
          className={cn(
            "mt-2 font-semibold tracking-[-0.03em] text-[color:var(--foreground)]",
            compact ? "text-2xl sm:text-[1.8rem]" : "text-[clamp(1.7rem,3vw,2.2rem)]",
          )}
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-2 text-sm leading-5 text-[color:var(--muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </section>
  );
}
