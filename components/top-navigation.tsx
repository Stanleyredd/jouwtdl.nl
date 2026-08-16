"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookHeart,
  Brain,
  ChartColumn,
  FolderKanban,
  MoonStar,
  SunMedium,
} from "lucide-react";

import { useLanguage } from "@/hooks/use-language";
import { cn } from "@/lib/utils";

const navigationItems = [
  { href: "/", labelKey: "nav.today", icon: SunMedium },
  { href: "/journal", labelKey: "nav.journal", icon: BookHeart },
  { href: "/dreams", labelKey: "nav.dreams", icon: MoonStar },
  { href: "/planning", labelKey: "nav.planning", icon: FolderKanban },
  { href: "/dashboard", labelKey: "nav.dashboard", icon: ChartColumn },
  { href: "/tips", labelKey: "nav.tips", icon: Brain },
] as const;

export function TopNavigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const { t, language } = useLanguage();

  function isActivePath(href: string) {
    if (href === "/") {
      return pathname === "/";
    }

    if (href === "/planning") {
      return (
        pathname === "/planning" ||
        pathname.startsWith("/planning/") ||
        pathname === "/daily" ||
        pathname === "/weekly-planning" ||
        pathname === "/monthly-planning"
      );
    }

    if (href === "/dashboard") {
      return (
        pathname === "/dashboard" ||
        pathname === "/weekly-review" ||
        pathname === "/monthly-pattern"
      );
    }

    if (href === "/tips") {
      return pathname === "/tips" || pathname === "/ai-insights";
    }

    return pathname === href;
  }

  return (
    <nav
      className={cn(
        "flex gap-1.5",
        mobile
          ? "min-w-0 w-full snap-x snap-mandatory overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          : "flex-col rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface-overlay)] p-2.5 shadow-[var(--shadow-soft)]",
      )}
    >
      {navigationItems.map((item) => {
        const Icon = item.icon;
        const active = isActivePath(item.href);
        const label =
          mobile && item.href === "/planning"
            ? language === "nl"
              ? "Plan"
              : "Plan"
            : t(item.labelKey);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group flex shrink-0 items-center rounded-full transition",
              mobile
                ? "snap-start gap-2 px-4 py-3 text-[1.05rem] font-medium"
                : "gap-2.5 px-3 py-2.5 text-sm",
              active
                ? "bg-[color:var(--surface-overlay-strong)] text-[color:var(--foreground)] shadow-[var(--shadow-chip)]"
                : "text-[color:var(--muted)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]",
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={1.8} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
