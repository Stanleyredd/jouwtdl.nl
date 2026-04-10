"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MoonStar } from "lucide-react";
import { useEffect, useState } from "react";

import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { TopNavigation } from "@/components/top-navigation";
import { useAuth } from "@/hooks/use-auth";
import { useAppState } from "@/hooks/use-app-state";
import { useLanguage } from "@/hooks/use-language";
import { translateRuntimeMessage } from "@/lib/i18n";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isHydrated, storageError, journalError } = useAppState();
  const {
    user,
    signOut,
    isConfigured,
    isReady: isAuthReady,
    profile,
    isProfileReady,
    profileError,
  } = useAuth();
  const { t, language } = useLanguage();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const isAuthPage = pathname === "/login" || pathname === "/signup";
  const isSetupPage = pathname === "/setup";
  const interfaceReady = isHydrated && (!user || isProfileReady);

  useEffect(() => {
    if (!isConfigured || !isAuthReady || !user || !isProfileReady) {
      return;
    }

    const onboardingCompleted = profile?.onboardingCompleted ?? false;

    if (!onboardingCompleted && !isSetupPage) {
      router.replace("/setup");
      return;
    }

    if (onboardingCompleted && isSetupPage) {
      router.replace("/");
    }
  }, [
    isAuthReady,
    isConfigured,
    isProfileReady,
    isSetupPage,
    profile?.onboardingCompleted,
    router,
    user,
  ]);

  async function handleLogout() {
    setIsLoggingOut(true);
    const result = await signOut();
    setIsLoggingOut(false);

    if (!result.error) {
      router.replace("/login");
      router.refresh();
    }
  }

  if (isAuthPage) {
    return (
      <div className="min-h-screen px-4 py-8 sm:px-6 sm:py-10">
        <main className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-[960px] items-center justify-center">
          <div className="w-full max-w-[480px]">
            <div className="mb-5 sm:mb-6">
              <Link href="/" className="inline-flex items-center gap-3 px-1 py-1">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--accent-soft)] text-[color:var(--accent-ink)] shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                  <MoonStar className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-[15px] font-semibold tracking-[-0.02em] text-[color:var(--foreground)]">
                    {t("app.name")}
                  </p>
                  <p className="text-xs text-[color:var(--muted)]">{t("app.tagline")}</p>
                </div>
              </Link>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2 sm:mb-5">
              <LanguageToggle className="app-toggle-button-compact sm:w-auto" />
              <ThemeToggle className="app-toggle-button-compact sm:w-auto" />
            </div>

            <div className="w-full max-w-[460px]">{children}</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-[1260px] gap-6 px-4 pb-8 pt-4 sm:px-6 lg:px-8">
        <aside className="hidden w-[216px] shrink-0 lg:block">
          <div className="sticky top-5 space-y-5">
            <Link href="/" className="flex items-center gap-3 px-1 py-1">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--accent-soft)] text-[color:var(--accent-ink)]">
                <MoonStar className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-[15px] font-semibold tracking-[-0.02em] text-[color:var(--foreground)]">
                  {t("app.name")}
                </p>
                <p className="text-xs text-[color:var(--muted)]">{t("app.tagline")}</p>
              </div>
            </Link>

            <TopNavigation />
            <div className="space-y-3">
              <div className="flex flex-col gap-2">
                <LanguageToggle />
                <ThemeToggle />
              </div>
              <div className="app-surface app-panel px-4 py-3 text-sm">
                <p className="font-medium text-[color:var(--foreground)]">
                  {user?.email ?? t("auth.notLoggedIn")}
                </p>
                <p className="mt-1 text-xs text-[color:var(--muted)]">
                  {user ? t("auth.loggedIn") : t("auth.loggedOut")}
                </p>
                {user ? (
                  <div className="mt-3 flex flex-wrap gap-3 text-sm font-medium">
                    {!isSetupPage ? (
                      <Link href="/settings/journal" className="text-[color:var(--foreground)]">
                        {t("settings.journalLink")}
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void handleLogout()}
                      disabled={isLoggingOut}
                      className="text-[color:var(--foreground)]"
                    >
                      {isLoggingOut ? t("auth.loggingOut") : t("auth.logout")}
                    </button>
                  </div>
                ) : null}
                {!isConfigured ? (
                  <p className="mt-3 text-xs leading-5 text-[color:var(--muted)]">
                    {t("auth.configMissing")}
                  </p>
                ) : null}
                {profileError ? (
                  <p className="mt-3 text-xs leading-5 text-[color:var(--muted)]">
                    {translateRuntimeMessage(profileError, language)}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <div className="sticky top-0 z-20 border-b border-[color:var(--border)] bg-[color:var(--shell-backdrop)] px-1 py-3 backdrop-blur lg:hidden">
            <div className="mb-3 flex items-center justify-between px-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--accent-soft)] text-[color:var(--accent-ink)]">
                  <MoonStar className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="text-lg font-semibold tracking-[-0.02em] text-[color:var(--foreground)]">
                    {t("app.name")}
                  </p>
                  <p className="text-xs text-[color:var(--muted)]">{t("app.tagline")}</p>
                </div>
              </div>
              {!isHydrated ? (
                <span className="text-xs text-[color:var(--muted)]">
                  {t("common.loading")}
                </span>
              ) : null}
            </div>
            <div className="mb-3 px-3">
              <div className="flex flex-col gap-2">
                <LanguageToggle />
                <ThemeToggle />
              </div>
            </div>
            <div className="mb-3 px-3">
              <div className="app-surface app-panel px-4 py-3 text-sm">
                <p className="font-medium text-[color:var(--foreground)]">
                  {user?.email ?? t("auth.notLoggedIn")}
                </p>
                <p className="mt-1 text-xs text-[color:var(--muted)]">
                  {user ? t("auth.loggedIn") : t("auth.loggedOut")}
                </p>
                {user ? (
                  <div className="mt-3 flex flex-wrap gap-3 text-sm font-medium">
                    {!isSetupPage ? (
                      <Link href="/settings/journal" className="text-[color:var(--foreground)]">
                        {t("settings.journalLink")}
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void handleLogout()}
                      disabled={isLoggingOut}
                      className="text-[color:var(--foreground)]"
                    >
                      {isLoggingOut ? t("auth.loggingOut") : t("auth.logout")}
                    </button>
                  </div>
                ) : null}
                {profileError ? (
                  <p className="mt-3 text-xs leading-5 text-[color:var(--muted)]">
                    {translateRuntimeMessage(profileError, language)}
                  </p>
                ) : null}
              </div>
            </div>
            <TopNavigation mobile />
          </div>

          <main className="flex-1 py-5 lg:py-7">
            {storageError ? (
              <div className="app-surface app-panel mb-5 text-sm text-[color:var(--muted)]">
                {translateRuntimeMessage(storageError, language)}
              </div>
            ) : null}

            {journalError ? (
              <div className="app-surface app-panel mb-5 text-sm text-[color:var(--muted)]">
                {translateRuntimeMessage(journalError, language)}
              </div>
            ) : null}

            <div className={interfaceReady ? "" : "pointer-events-none opacity-70"}>
              <div className="mx-auto w-full max-w-[960px]">{children}</div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
