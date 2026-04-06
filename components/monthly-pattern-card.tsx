import type { MonthlyPatternProfile } from "@/types";

export function MonthlyPatternCard({
  profile,
}: {
  profile: MonthlyPatternProfile;
}) {
  const lifeAreaEntries = Object.entries(profile.lifeAreaDistribution).filter(
    ([, value]) => value > 0,
  );

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-xl">
          <p className="app-label">Monthly pattern</p>
          <h1 className="mt-2 text-[clamp(1.8rem,3.4vw,2.6rem)] font-semibold tracking-[-0.035em] text-[color:var(--foreground)]">
            Month in review
          </h1>
          <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">Patterns that stood out.</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="app-surface app-panel">
          <div className="grid gap-4 lg:grid-cols-2">
            <PatternBlock title="Strongest" items={profile.strongestPatterns} />
            <PatternBlock title="Blockers" items={profile.blockers} />
            <PatternBlock title="Productive" items={profile.productiveConditions} />
            <PatternBlock title="Weaker" items={profile.weakerPatterns} />
          </div>
        </section>

        <section className="app-surface app-panel">
          <p className="text-sm font-medium text-[color:var(--foreground)]">Life-area balance</p>
          <div className="mt-4 space-y-3">
            {lifeAreaEntries.length > 0 ? (
              lifeAreaEntries.map(([lifeArea, count]) => (
                <div key={lifeArea}>
                  <div className="mb-1 flex items-center justify-between text-sm text-[color:var(--muted)]">
                    <span className="capitalize">{lifeArea}</span>
                    <span>{count}</span>
                  </div>
                  <div className="app-progress-track h-1.5 rounded-full">
                    <div
                      className="h-1.5 rounded-full bg-[color:var(--accent-strong)]"
                      style={{ width: `${Math.min((count / 8) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-[color:var(--muted)]">More entries will sharpen this view.</p>
            )}
          </div>

          <div className="app-surface-soft mt-6 rounded-[20px] p-4">
            <p className="text-sm font-medium text-[color:var(--foreground)]">Next month</p>
            <div className="mt-3 space-y-2 text-sm leading-6 text-[color:var(--muted)]">
              {profile.monthlyAdvice.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}

function PatternBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="app-surface-soft rounded-[20px] p-4">
      <p className="text-sm font-medium text-[color:var(--foreground)]">{title}</p>
      <div className="mt-3 space-y-2 text-sm leading-6 text-[color:var(--muted)]">
        {items.map((item) => (
          <p key={item}>{item}</p>
        ))}
      </div>
    </div>
  );
}
