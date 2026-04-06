"use client";

import { useState } from "react";
import { PencilLine, Sparkles } from "lucide-react";

import { useLanguage } from "@/hooks/use-language";
import type { DailyFocus } from "@/types";

interface TodayFocusCardProps {
  focus?: DailyFocus;
  aiSuggestion?: string;
  onSave: (mainFocus: string, secondaryFocuses: string[]) => void;
}

export function TodayFocusCard({
  focus,
  aiSuggestion,
  onSave,
}: TodayFocusCardProps) {
  const { t } = useLanguage();
  const [isEditing, setIsEditing] = useState(!focus);
  const [mainFocus, setMainFocus] = useState(focus?.mainFocus ?? "");
  const [secondary, setSecondary] = useState(
    focus?.secondaryFocuses.join("\n") ?? "",
  );

  const secondaryFocuses = secondary
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 2);

  return (
    <section className="app-surface-strong app-panel-lg">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="app-label">{t("focus.label")}</p>
          <h1 className="mt-3 text-[clamp(1.6rem,3vw,2.3rem)] font-semibold leading-tight tracking-[-0.035em] text-[color:var(--foreground)]">
            {focus?.mainFocus || t("focus.pickOne")}
          </h1>
          {focus?.secondaryFocuses.length ? (
            <div className="mt-3 space-y-1 text-sm text-[color:var(--muted)]">
              {focus.secondaryFocuses.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setIsEditing((current) => !current)}
          className="app-button-secondary text-sm"
        >
          <PencilLine className="h-4 w-4" />
          {isEditing ? t("common.close") : focus ? t("common.edit") : t("focus.set")}
        </button>
      </div>

      {aiSuggestion ? (
        <div className="mt-4 inline-flex max-w-full items-center gap-2 rounded-full bg-[color:var(--accent-soft)] px-3.5 py-2 text-sm text-[color:var(--accent-ink)]">
          <Sparkles className="h-4 w-4" />
          <span className="truncate">
            {t("focus.tip")}: {aiSuggestion}
          </span>
        </div>
      ) : null}

      {isEditing ? (
        <div className="app-surface-soft mt-5 grid gap-4 rounded-[20px] p-5">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-[color:var(--foreground)]">
              {t("focus.main")}
            </span>
            <input
              value={mainFocus}
              onChange={(event) => setMainFocus(event.target.value)}
              placeholder={t("focus.whatMatters")}
              className="app-input"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-[color:var(--foreground)]">
              {t("focus.supports")}
            </span>
            <textarea
              value={secondary}
              onChange={(event) => setSecondary(event.target.value)}
              placeholder={t("focus.supportsPlaceholder")}
              rows={2}
              className="app-input"
            />
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                onSave(mainFocus.trim(), secondaryFocuses);
                setIsEditing(false);
              }}
              className="app-button-primary text-sm"
            >
              {t("common.save")}
            </button>
            <button
              type="button"
              onClick={() => {
                setMainFocus(focus?.mainFocus ?? "");
                setSecondary(focus?.secondaryFocuses.join("\n") ?? "");
                setIsEditing(false);
              }}
              className="app-button-secondary text-sm"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
