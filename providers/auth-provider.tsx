"use client";

import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/shared";
import {
  ensureProfileForUser,
  updateProfileForUser,
} from "@/services/profile-service";
import type { Database } from "@/types/database";
import type { JournalConfig, JournalPreset, UserProfile } from "@/types";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  supabase: SupabaseClient<Database> | null;
  isConfigured: boolean;
  isReady: boolean;
  profile: UserProfile | null;
  isProfileReady: boolean;
  profileError: string | null;
  saveProfile: (input: {
    onboardingCompleted?: boolean;
    journalPreset?: JournalPreset | null;
    journalConfig?: JournalConfig | null;
  }) => Promise<{ profile: UserProfile | null; error: string | null }>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function requestProfile(
  method: "GET" | "PUT",
  input?: {
    onboardingCompleted?: boolean;
    journalPreset?: JournalPreset | null;
    journalConfig?: JournalConfig | null;
  },
) {
  const response = await fetch("/api/profile", {
    method,
    credentials: "include",
    headers:
      method === "PUT"
        ? {
            "Content-Type": "application/json",
          }
        : undefined,
    body: method === "PUT" ? JSON.stringify(input ?? {}) : undefined,
    cache: "no-store",
  });

  const data = (await response.json().catch(() => null)) as
    | {
        profile?: UserProfile;
        error?: string;
      }
    | null;

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

function logAuthProfileEvent(event: string, payload: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.debug("[auth-provider]", event, payload);
  console.debug("[auth-provider]", `${event}:details`, JSON.stringify(payload, null, 2));
}

function serializeAuthError(error: unknown) {
  if (!(error instanceof Error) && (typeof error !== "object" || error === null)) {
    return {
      message: String(error),
    };
  }

  const candidate = error as Error & {
    code?: string;
    details?: string;
    hint?: string;
    name?: string;
    status?: number;
  };

  return {
    name: candidate.name,
    message: candidate.message,
    code: candidate.code,
    details: candidate.details,
    hint: candidate.hint,
    status: candidate.status,
    keys: Object.keys(candidate),
  };
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function resolveClientSessionUser(
  supabase: SupabaseClient<Database>,
  fallbackUser: User,
) {
  for (const attempt of [1, 2]) {
    const { data, error } = await supabase.auth.getUser();

    logAuthProfileEvent("client-auth-check", {
      attempt,
      fallbackUserId: fallbackUser.id,
      resolvedUserId: data.user?.id ?? null,
      error: error
        ? {
            name: error.name,
            message: error.message,
            status: error.status,
            code: error.code,
          }
        : null,
    });

    if (data.user) {
      return data.user;
    }

    if (attempt === 1) {
      await wait(150);
    }
  }

  return fallbackUser;
}

export function AuthProvider({
  children,
  initialUser,
}: {
  children: ReactNode;
  initialUser: User | null;
}) {
  const isConfigured = isSupabaseConfigured();
  const supabase = useMemo(
    () => (isConfigured ? createClient() : null),
    [isConfigured],
  );
  const [user, setUser] = useState<User | null>(initialUser);
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(!isConfigured);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isProfileReady, setIsProfileReady] = useState(!isConfigured);
  const [profileError, setProfileError] = useState<string | null>(null);

  const hydrateProfile = useCallback(async (nextUser: User | null) => {
    if (!isConfigured) {
      setProfile(null);
      setProfileError(null);
      setIsProfileReady(true);
      return;
    }

    if (!nextUser) {
      setProfile(null);
      setProfileError(null);
      setIsProfileReady(true);
      return;
    }

    setIsProfileReady(false);
    setProfileError(null);

    try {
      logAuthProfileEvent("profile-load-started", {
        userId: nextUser.id,
      });

      let result:
        | Awaited<ReturnType<typeof requestProfile>>
        | null = null;

      try {
        result = await requestProfile("GET");
      } catch (requestError) {
        if (process.env.NODE_ENV === "development") {
          console.error("[auth-provider]", "profile-load-request-failed", {
            userId: nextUser.id,
            message:
              requestError instanceof Error
                ? requestError.message
                : "Unknown profile request failure.",
          });
        }
      }

      logAuthProfileEvent("profile-load-result", {
        userId: nextUser.id,
        ok: result?.ok ?? false,
        status: result?.status ?? null,
        hasProfile: Boolean(result?.data?.profile),
        error: result?.data?.error ?? null,
      });

      if (!result?.ok || !result.data?.profile) {
        if (supabase) {
          try {
            logAuthProfileEvent("profile-load-retry", {
              userId: nextUser.id,
              reason: "server-route-missed-or-failed",
            });

            const resolvedUser = await resolveClientSessionUser(supabase, nextUser);
            const fallbackProfile = await ensureProfileForUser(supabase, resolvedUser);
            setProfile(fallbackProfile);
            setProfileError(null);

            logAuthProfileEvent("final-profile-state", {
              userId: nextUser.id,
              source: "browser-fallback",
              onboardingCompleted: fallbackProfile.onboardingCompleted,
              journalPreset: fallbackProfile.journalPreset,
              hasJournalConfig: Boolean(fallbackProfile.journalConfig),
            });

            return;
          } catch (fallbackError) {
            if (process.env.NODE_ENV === "development") {
              console.error("[auth-provider]", "profile-load-failed", {
                userId: nextUser.id,
                status: result?.status ?? null,
                data: result?.data ?? null,
                fallbackError: serializeAuthError(fallbackError),
              });
            }
          }
        }

        throw new Error(
          result?.data?.error ?? "Your profile could not be loaded right now.",
        );
      }

      setProfile(result.data.profile);
      setProfileError(null);
      logAuthProfileEvent("final-profile-state", {
        userId: nextUser.id,
        source: "api",
        onboardingCompleted: result.data.profile.onboardingCompleted,
        journalPreset: result.data.profile.journalPreset,
        hasJournalConfig: Boolean(result.data.profile.journalConfig),
      });
    } catch (caughtError) {
      setProfile(null);
      setProfileError(
        caughtError instanceof Error
          ? caughtError.message
          : "Your profile could not be loaded right now.",
      );
    } finally {
      setIsProfileReady(true);
    }
  }, [isConfigured, supabase]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let isActive = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!isActive) {
        return;
      }

      const nextUser = data.session?.user ?? initialUser ?? null;
      setSession(data.session);
      setUser(nextUser);
      setIsReady(true);
      void hydrateProfile(nextUser);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      const nextUser = nextSession?.user ?? null;
      setSession(nextSession);
      setUser(nextUser);
      setIsReady(true);
      void hydrateProfile(nextUser);
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [hydrateProfile, initialUser, supabase]);

  const value = useMemo<AuthContextValue>(() => {
    return {
      user,
      session,
      supabase,
      isConfigured,
      isReady,
      profile,
      isProfileReady,
      profileError,
      async refreshProfile() {
        await hydrateProfile(user);
      },
      async saveProfile(input) {
        if (!user) {
          return {
            profile: null,
            error: "You need to be logged in to save profile settings.",
          };
        }

        try {
          logAuthProfileEvent("profile-save-started", {
            userId: user.id,
            input,
          });

          let result:
            | Awaited<ReturnType<typeof requestProfile>>
            | null = null;

          try {
            result = await requestProfile("PUT", input);
          } catch (requestError) {
            if (process.env.NODE_ENV === "development") {
              console.error("[auth-provider]", "profile-save-request-failed", {
                userId: user.id,
                message:
                  requestError instanceof Error
                    ? requestError.message
                    : "Unknown profile save request failure.",
              });
            }
          }

          if (!result?.ok || !result.data?.profile) {
            if (supabase) {
              try {
                logAuthProfileEvent("profile-save-retry", {
                  userId: user.id,
                  reason: "server-route-missed-or-failed",
                });

                const resolvedUser = await resolveClientSessionUser(supabase, user);
                const fallbackProfile = await updateProfileForUser(
                  supabase,
                  resolvedUser,
                  input,
                );

                setProfile(fallbackProfile);
                setProfileError(null);
                setIsProfileReady(true);

                logAuthProfileEvent("profile-save-succeeded", {
                  userId: user.id,
                  source: "browser-fallback",
                  profile: fallbackProfile,
                });

                return {
                  profile: fallbackProfile,
                  error: null,
                };
              } catch (fallbackError) {
                if (process.env.NODE_ENV === "development") {
                  console.error("[auth-provider]", "profile-save-failed", {
                    userId: user.id,
                    status: result?.status ?? null,
                    data: result?.data ?? null,
                    fallbackError: serializeAuthError(fallbackError),
                  });
                }
              }
            }

            throw new Error(
              result?.data?.error ?? "Your profile could not be saved right now.",
            );
          }

          setProfile(result.data.profile);
          setProfileError(null);
          setIsProfileReady(true);

          logAuthProfileEvent("profile-save-succeeded", {
            userId: user.id,
            source: "api",
            profile: result.data.profile,
          });

          return {
            profile: result.data.profile,
            error: null,
          };
        } catch (caughtError) {
          const message =
            caughtError instanceof Error
              ? caughtError.message
              : "Your profile could not be saved right now.";
          setProfileError(message);
          return {
            profile: null,
            error: message,
          };
        }
      },
      async signOut() {
        if (!supabase) {
          return {
            error:
              "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.",
          };
        }

        const { error } = await supabase.auth.signOut();

        if (!error) {
          setSession(null);
          setUser(null);
          setProfile(null);
          setProfileError(null);
          setIsProfileReady(true);
        }

        return {
          error: error?.message ?? null,
        };
      },
    };
  }, [
    hydrateProfile,
    isConfigured,
    isProfileReady,
    isReady,
    profile,
    profileError,
    session,
    supabase,
    user,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}
