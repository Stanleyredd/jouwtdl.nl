"use client";

import { Layers3, PencilLine, Trash2 } from "lucide-react";

import { useLanguage } from "@/hooks/use-language";
import { translateGoalStatus, translateLifeAreaName } from "@/lib/i18n";
import { percent } from "@/lib/utils";
import type { GoalStatus } from "@/types";

interface GoalCardProps {
  title: string;
  description: string;
  lifeArea: string;
  status: string;
  progress: number;
  meta?: string;
  parentLabel?: string;
  linkedCount?: number;
  onEdit?: () => void;
  onDelete?: () => void;
  children?: React.ReactNode;
}

export function GoalCard({
  title,
  description,
  lifeArea,
  status,
  progress,
  meta,
  parentLabel,
  linkedCount,
  onEdit,
  onDelete,
  children,
}: GoalCardProps) {
  const { t, language } = useLanguage();

  return (
    <article className="app-surface app-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--muted)]">
            <span className="capitalize">{translateLifeAreaName(lifeArea, language)}</span>
            <span>·</span>
            <span className="capitalize">
              {translateGoalStatus(status as GoalStatus, language)}
            </span>
            {meta ? (
              <>
                <span>·</span>
                <span>{meta}</span>
              </>
            ) : null}
            {parentLabel ? (
              <>
                <span>·</span>
                <span>{parentLabel}</span>
              </>
            ) : null}
          </div>
          <div>
            <h3 className="text-base font-semibold tracking-[-0.02em] text-[color:var(--foreground)]">
              {title}
            </h3>
            {description ? (
              <p className="mt-1 max-w-2xl text-sm leading-5 text-[color:var(--muted)]">
                {description}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onEdit ? (
            <button type="button" onClick={onEdit} className="app-icon-button">
              <PencilLine className="h-4 w-4" />
            </button>
          ) : null}
          {onDelete ? (
            <button type="button" onClick={onDelete} className="app-icon-button">
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div>
          <div className="flex items-center justify-between text-sm text-[color:var(--muted)]">
            <span>{t("goal.done")}</span>
            <span>{percent(progress)}</span>
          </div>
          <div className="app-progress-track mt-2 h-1.5 rounded-full">
            <div
              className="h-1.5 rounded-full bg-[color:var(--accent-strong)]"
              style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-[color:var(--muted)]">
          {typeof linkedCount === "number" ? (
            <span className="inline-flex items-center gap-2">
              <Layers3 className="h-3.5 w-3.5" />
              {t("goal.linked", { count: linkedCount })}
            </span>
          ) : null}
        </div>
      </div>

      {children ? <div className="mt-5">{children}</div> : null}
    </article>
  );
}
