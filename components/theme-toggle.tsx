"use client";

import { MoonStar, SunMedium } from "lucide-react";

import { useTheme } from "@/hooks/use-theme";
import { useLanguage } from "@/hooks/use-language";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme, isReady } = useTheme();
  const { t } = useLanguage();
  const label = `${t("theme.label")}: ${t(theme === "light" ? "theme.light" : "theme.dark")}`;
  const Icon = theme === "light" ? SunMedium : MoonStar;

  if (!isReady) {
    return (
      <span className={cn("app-toggle-button opacity-80", className)} aria-hidden="true">
        <span className="inline-flex items-center gap-2">
          <SunMedium className="h-4 w-4 shrink-0 text-[color:var(--accent-strong)]" />
          <span>{`${t("theme.label")}: ${t("theme.light")}`}</span>
        </span>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn("app-toggle-button", className)}
      aria-label={label}
      title={label}
    >
      <span className="inline-flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-[color:var(--accent-strong)]" />
        <span>{label}</span>
      </span>
    </button>
  );
}
