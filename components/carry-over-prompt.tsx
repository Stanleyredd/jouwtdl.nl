"use client";

import { ArrowRightLeft, ArrowUpRight, Scissors, Trash2 } from "lucide-react";

import { useLanguage } from "@/hooks/use-language";
import type { DailyTask } from "@/types";

interface CarryOverPromptProps {
  task: DailyTask;
  onReschedule: () => void;
  onSplit: () => void;
  onConvertToWeeklyGoal: () => void;
  onDeprioritize: () => void;
}

export function CarryOverPrompt({
  task,
  onReschedule,
  onSplit,
  onConvertToWeeklyGoal,
  onDeprioritize,
}: CarryOverPromptProps) {
  const { t } = useLanguage();

  return (
    <article className="app-surface app-panel">
      <p className="app-label">{t("carryOver.label")}</p>
      <h3 className="mt-2 text-base font-semibold tracking-[-0.02em] text-[color:var(--foreground)]">
        {task.title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
        {t("carryOver.delayed", { count: task.carryOverCount })}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ActionButton icon={ArrowRightLeft} label={t("carryOver.reschedule")} onClick={onReschedule} />
        <ActionButton icon={Scissors} label={t("carryOver.split")} onClick={onSplit} />
        <ActionButton icon={ArrowUpRight} label={t("carryOver.moveToWeek")} onClick={onConvertToWeeklyGoal} />
        <ActionButton icon={Trash2} label={t("carryOver.lowerPriority")} onClick={onDeprioritize} />
      </div>
    </article>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof ArrowRightLeft;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-between gap-3 rounded-[18px] border border-[color:var(--border)] bg-[color:var(--surface-overlay)] px-4 py-3 text-sm text-[color:var(--foreground)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-hover)]"
    >
      <span>{label}</span>
      <Icon className="h-4 w-4 text-[color:var(--accent-ink)]" />
    </button>
  );
}
