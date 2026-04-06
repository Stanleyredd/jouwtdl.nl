"use client";

import Link from "next/link";
import { CalendarDays, CalendarRange, ClipboardCheck } from "lucide-react";

import { useLanguage } from "@/hooks/use-language";
import { PageHeader } from "@/components/page-header";

export default function PlanningPage() {
  const { t } = useLanguage();
  const planningOptions = [
    {
      href: "/planning/day",
      title: t("planning.day.title"),
      description: t("planning.day.description"),
      icon: ClipboardCheck,
    },
    {
      href: "/planning/week",
      title: t("planning.week.title"),
      description: t("planning.week.description"),
      icon: CalendarRange,
    },
    {
      href: "/planning/month",
      title: t("planning.month.title"),
      description: t("planning.month.description"),
      icon: CalendarDays,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t("planning.eyebrow")}
        title={t("planning.title")}
        description={t("planning.description")}
      />

      <div className="grid gap-4 md:grid-cols-3">
        {planningOptions.map((option) => {
          const Icon = option.icon;

          return (
            <Link
              key={option.href}
              href={option.href}
              className="app-surface app-panel block transition hover:translate-y-[-1px]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-base font-semibold text-[color:var(--foreground)]">
                    {option.title}
                  </p>
                  <p className="mt-2 text-sm leading-5 text-[color:var(--muted)]">
                    {option.description}
                  </p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--accent-soft)] text-[color:var(--accent-ink)]">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
