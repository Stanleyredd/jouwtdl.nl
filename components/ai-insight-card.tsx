"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

import { useLanguage } from "@/hooks/use-language";
import type { AiInsight } from "@/types";

export function AiInsightCard({ insight }: { insight: AiInsight }) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const primarySuggestion = insight.suggestions[0];
  const hasMore =
    insight.suggestions.length > 1 || insight.detectedPatterns.length > 0;
  const shortSummary = insight.summary.split(". ")[0]?.trim() ?? insight.summary;

  return (
    <article className="app-surface app-panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="app-label">{insight.dateRange.label}</p>
          <h3 className="mt-2 text-base font-semibold tracking-[-0.02em] text-[color:var(--foreground)]">
            {insight.title}
          </h3>
        </div>
        <Sparkles className="h-4 w-4 text-[color:var(--accent-strong)]" />
      </div>

      <p className="mt-3 text-sm leading-5 text-[color:var(--muted)]">{shortSummary}</p>

      {primarySuggestion ? (
        <div className="app-surface-soft mt-4 rounded-[18px] px-4 py-3 text-sm leading-5 text-[color:var(--accent-ink)]">
          {primarySuggestion}
        </div>
      ) : null}

      {expanded ? (
        <div className="mt-4 space-y-2 text-sm leading-5 text-[color:var(--muted)]">
          {insight.suggestions.slice(1).map((suggestion) => (
            <p key={suggestion}>{suggestion}</p>
          ))}

          {insight.detectedPatterns.length > 0 ? (
            <div className="space-y-1 pt-1">
              {insight.detectedPatterns.map((pattern) => (
                <p key={pattern}>{pattern}</p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {hasMore ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="mt-4 text-sm text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]"
        >
          {expanded ? t("common.showLess") : t("common.showMore")}
        </button>
      ) : null}
    </article>
  );
}
