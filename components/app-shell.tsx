"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, MoonStar, Settings2, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Footer } from "@/components/footer";
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
  const { isHydrated, isPlanningReady, storageError, planningError, journalError } =
    useAppState();
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isAuthPage = pathname === "/login" || pathname === "/signup";
  const isSetupPage = pathname === "/setup";
  const interfaceReady = isHydrated && isPlanningReady && (!user || isProfileReady);

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

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

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
      <div className="flex min-h-screen flex-col">
        <div className="flex-1 px-4 py-8 sm:px-6 sm:py-10">
          <main className="mx-auto flex min-h-[calc(100vh-9rem)] w-full max-w-[960px] items-center justify-center">
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
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex-1">
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

          <div className="flex min-h-screen min-w-0 flex-1 flex-col overflow-x-hidden">
            <div className="sticky top-0 z-20 px-1 pb-3 pt-3 backdrop-blur lg:hidden">
              <div className="mx-auto w-full max-w-[960px] space-y-4">
                <div className="relative px-3 pt-1">
                  <Link href="/" className="mx-auto flex w-fit flex-col items-center gap-3 text-center">
                    <Image
                      src="/brand/jouwtdl-mono.svg"
                      alt="JouwTDL logo"
                      width={72}
                      height={72}
                      className="h-[4.5rem] w-[4.5rem]"
                    />
                    <div className="space-y-1.5">
                      <p className="text-[2rem] font-semibold tracking-[-0.04em] text-[color:var(--foreground)]">
                        {t("app.name")}
                      </p>
                      <p className="text-[0.95rem] text-[color:var(--muted)]">
                        {t("app.tagline")}
                      </p>
                    </div>
                  </Link>

                  <button
                    type="button"
                    onClick={() => setIsMobileMenuOpen((open) => !open)}
                    className="app-icon-button absolute right-3 top-0 h-11 w-11"
                    aria-expanded={isMobileMenuOpen}
                    aria-label={
                      isMobileMenuOpen
                        ? language === "nl"
                          ? "Menu sluiten"
                          : "Close menu"
                        : language === "nl"
                          ? "Menu openen"
                          : "Open menu"
                    }
                  >
                    {isMobileMenuOpen ? (
                      <X className="h-4.5 w-4.5" strokeWidth={1.9} />
                    ) : (
                      <Menu className="h-4.5 w-4.5" strokeWidth={1.9} />
                    )}
                  </button>
                </div>

                <div className="app-surface rounded-[28px] px-3 py-3 shadow-[var(--shadow-soft)]">
                  <TopNavigation mobile />
                </div>
              </div>
            </div>

            {isMobileMenuOpen ? (
              <div className="fixed inset-0 z-30 lg:hidden">
                <button
                  type="button"
                  aria-label={language === "nl" ? "Sluit instellingen" : "Close settings"}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="absolute inset-0 bg-black/35 backdrop-blur-sm"
                />
                <div className="absolute inset-x-0 bottom-0 rounded-t-[32px] border border-b-0 border-[color:var(--border)] bg-[color:var(--surface-strong)] px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-4 shadow-[var(--shadow-lifted)]">
                  <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-[color:var(--border-strong)]" />
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold tracking-[-0.03em] text-[color:var(--foreground)]">
                        {language === "nl" ? "Instellingen" : "Settings"}
                      </p>
                      <p className="mt-1 text-sm text-[color:var(--muted)]">
                        {user?.email ?? t("auth.notLoggedIn")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="app-icon-button h-10 w-10 shrink-0"
                      aria-label={language === "nl" ? "Sluiten" : "Close"}
                    >
                      <X className="h-4.5 w-4.5" strokeWidth={1.9} />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div className="grid gap-2">
                      <LanguageToggle className="!w-full !justify-start !text-[color:var(--foreground)]" />
                      <ThemeToggle className="!w-full !justify-start !text-[color:var(--foreground)]" />
                    </div>

                    <div className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 py-4 text-sm shadow-[var(--shadow-soft)]">
                      <p className="font-medium text-[color:var(--foreground)]">
                        {user ? t("auth.loggedIn") : t("auth.loggedOut")}
                      </p>

                      {user ? (
                        <div className="mt-3 grid gap-2">
                          {!isSetupPage ? (
                            <Link
                              href="/settings/journal"
                              className="app-toggle-button inline-flex !w-full items-center justify-start gap-2 !text-[color:var(--foreground)]"
                            >
                              <Settings2 className="h-4 w-4 shrink-0 text-[color:var(--accent-strong)]" />
                              <span>{t("settings.journalLink")}</span>
                            </Link>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => void handleLogout()}
                            disabled={isLoggingOut}
                            className="app-toggle-button inline-flex !w-full items-center justify-start gap-2 !text-[color:var(--foreground)]"
                          >
                            <LogOut className="h-4 w-4 shrink-0 text-[color:var(--accent-strong)]" />
                            <span>{isLoggingOut ? t("auth.loggingOut") : t("auth.logout")}</span>
                          </button>
                        </div>
                      ) : null}

                      {profileError ? (
                        <p className="mt-3 text-xs leading-5 text-[color:var(--muted)]">
                          {translateRuntimeMessage(profileError, language)}
                        </p>
                      ) : null}
                    </div>

                    {!isHydrated ? (
                      <p className="px-1 text-xs text-[color:var(--muted)]">{t("common.loading")}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            <main className="flex-1 py-5 lg:py-7">
            {storageError ? (
              <div className="app-surface app-panel mb-5 text-sm text-[color:var(--muted)]">
                {translateRuntimeMessage(storageError, language)}
              </div>
            ) : null}

            {planningError ? (
              <div className="app-surface app-panel mb-5 text-sm text-[color:var(--muted)]">
                {translateRuntimeMessage(planningError, language)}
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
      <Footer />
    </div>
  );
}
