"use client";

import type { Session } from "next-auth";
import {
  SessionProvider,
  signOut as nextAuthSignOut,
  useSession,
} from "next-auth/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { AuthenticatedUser } from "@/lib/auth";
import type { JournalConfig, JournalPreset, UserProfile } from "@/types";

interface AuthContextValue {
  user: AuthenticatedUser | null;
  session: Session | null;
  supabase: null;
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

function getSessionUser(session: Session | null | undefined): AuthenticatedUser | null {
  if (!session?.user?.id) {
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email ?? null,
  };
}

function AuthProviderInner({
  children,
  initialUser,
}: {
  children: ReactNode;
  initialUser: AuthenticatedUser | null;
}) {
  const { data: session, status } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isProfileReady, setIsProfileReady] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const resolvedSession = session ?? null;
  const resolvedUser = useMemo(
    () => getSessionUser(resolvedSession) ?? (status === "loading" ? initialUser : null),
    [initialUser, resolvedSession, status],
  );
  const isReady = status !== "loading";

  const hydrateProfile = useCallback(async (nextUser: AuthenticatedUser | null) => {
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

      const result = await requestProfile("GET");

      logAuthProfileEvent("profile-load-result", {
        userId: nextUser.id,
        ok: result.ok,
        status: result.status,
        hasProfile: Boolean(result.data?.profile),
        error: result.data?.error ?? null,
      });

      if (!result.ok || !result.data?.profile) {
        throw new Error(
          result.data?.error ?? "Your profile could not be loaded right now.",
        );
      }

      setProfile(result.data.profile);
      setProfileError(null);

      logAuthProfileEvent("final-profile-state", {
        userId: nextUser.id,
        onboardingCompleted: result.data.profile.onboardingCompleted,
        journalPreset: result.data.profile.journalPreset,
        hasJournalConfig: Boolean(result.data.profile.journalConfig),
      });
    } catch (error) {
      console.error("[auth-provider]", "profile-load-failed", {
        userId: nextUser.id,
        error: serializeAuthError(error),
      });
      setProfile(null);
      setProfileError(
        error instanceof Error
          ? error.message
          : "Your profile could not be loaded right now.",
      );
    } finally {
      setIsProfileReady(true);
    }
  }, []);

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    void hydrateProfile(resolvedUser);
  }, [hydrateProfile, resolvedUser, status]);

  const value = useMemo<AuthContextValue>(() => {
    return {
      user: resolvedUser,
      session: resolvedSession,
      supabase: null,
      isConfigured: true,
      isReady,
      profile,
      isProfileReady,
      profileError,
      async refreshProfile() {
        await hydrateProfile(resolvedUser);
      },
      async saveProfile(input) {
        if (!resolvedUser) {
          return {
            profile: null,
            error: "You need to be logged in to save profile settings.",
          };
        }

        try {
          logAuthProfileEvent("profile-save-started", {
            userId: resolvedUser.id,
            input,
          });

          const result = await requestProfile("PUT", input);

          if (!result.ok || !result.data?.profile) {
            throw new Error(
              result.data?.error ?? "Your profile could not be saved right now.",
            );
          }

          setProfile(result.data.profile);
          setProfileError(null);
          setIsProfileReady(true);

          logAuthProfileEvent("profile-save-succeeded", {
            userId: resolvedUser.id,
            profile: result.data.profile,
          });

          return {
            profile: result.data.profile,
            error: null,
          };
        } catch (error) {
          console.error("[auth-provider]", "profile-save-failed", {
            userId: resolvedUser.id,
            error: serializeAuthError(error),
          });
          const message =
            error instanceof Error
              ? error.message
              : "Your profile could not be saved right now.";
          setProfileError(message);
          return {
            profile: null,
            error: message,
          };
        }
      },
      async signOut() {
        try {
          await nextAuthSignOut({
            redirect: false,
            callbackUrl: "/login",
          });

          setProfile(null);
          setProfileError(null);
          setIsProfileReady(true);

          return {
            error: null,
          };
        } catch (error) {
          console.error("[auth-provider]", "signout-failed", {
            error: serializeAuthError(error),
          });

          return {
            error:
              error instanceof Error
                ? error.message
                : "You could not be logged out right now.",
          };
        }
      },
    };
  }, [
    hydrateProfile,
    isProfileReady,
    isReady,
    profile,
    profileError,
    resolvedSession,
    resolvedUser,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({
  children,
  initialUser,
  initialSession,
}: {
  children: ReactNode;
  initialUser: AuthenticatedUser | null;
  initialSession: Session | null;
}) {
  return (
    <SessionProvider session={initialSession} refetchOnWindowFocus={false}>
      <AuthProviderInner initialUser={initialUser}>{children}</AuthProviderInner>
    </SessionProvider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}
