"use client";

import { Activity, HeartPulse, Layers3 } from "lucide-react";

import { AiInsightCard } from "@/components/ai-insight-card";
import { PageHeader } from "@/components/page-header";
import { WeeklyStateCard } from "@/components/weekly-state-card";
import { useAppState } from "@/hooks/use-app-state";
import { useLanguage } from "@/hooks/use-language";
import { toDateKey } from "@/lib/date";
import {
  generateAiInsights,
  getLifeAreaBalance,
  getMoodProductivityCorrelation,
  getStreaks,
  getStateOfWeek,
} from "@/services/analysis-service";

export default function AiInsightsPage() {
  const { t, language } = useLanguage();
  const { state, isHydrated, isJournalReady } = useAppState();

  if (!isHydrated || !isJournalReady) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow={t("tips.eyebrow")}
          title={t("tips.title")}
          description={t("tips.loading")}
        />
        <section className="app-surface app-panel">
          <div className="h-24 rounded-[18px] bg-[color:var(--surface-soft)]" />
        </section>
      </div>
    );
  }

  const today = toDateKey(new Date());
  const insights = generateAiInsights(state, today, language);
  const weeklyState = getStateOfWeek(state, today);
  const correlation = getMoodProductivityCorrelation(state, today, language);
  const lifeAreaBalance = getLifeAreaBalance(state, today, language);
  const streaks = getStreaks(state, today, language);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t("tips.eyebrow")}
        title={t("tips.title")}
        description={t("tips.description")}
      />

      <WeeklyStateCard state={weeklyState} />

      <section className="app-surface app-panel">
        <p className="text-sm font-semibold text-[color:var(--foreground)]">
          {t("tips.quickRead")}
        </p>
        <div className="mt-4 space-y-4 text-sm leading-5 text-[color:var(--muted)]">
          <div className="flex items-start gap-2">
            <HeartPulse className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--accent-strong)]" />
            <p>{correlation.summary}</p>
          </div>
          <div className="flex items-start gap-2">
            <Layers3 className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--accent-strong)]" />
            <p>{lifeAreaBalance.summary}</p>
          </div>
          <div className="flex items-start gap-2">
            <Activity className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--accent-strong)]" />
            <p>{streaks.supportiveCopy[0] ?? correlation.trend}</p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-[color:var(--foreground)]">
            {t("tips.listTitle")}
          </p>
          <p className="mt-1 text-sm text-[color:var(--muted)]">{t("tips.listHint")}</p>
        </div>

        <div className="space-y-3">
          {insights.map((insight) => (
            <AiInsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      </section>
    </div>
  );
}
