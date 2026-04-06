"use client";

import { useLanguage } from "@/hooks/use-language";
import {
  translateWeeklyState,
  translateWeeklyStateDescription,
} from "@/lib/i18n";
import type { WeeklyState } from "@/types";

export function WeeklyStateCard({ state }: { state: WeeklyState }) {
  const { t, language } = useLanguage();

  return (
    <section className="app-surface app-panel">
      <p className="app-label">{t("dashboard.thisWeek")}</p>
      <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[color:var(--foreground)]">
        {translateWeeklyState(state, language)}
      </h2>
      <p className="mt-2 text-sm leading-5 text-[color:var(--muted)]">
        {translateWeeklyStateDescription(state, language)}
      </p>
    </section>
  );
}
