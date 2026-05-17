"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useLanguage } from "@/hooks/use-language";
import { translateRuntimeMessage } from "@/lib/i18n";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language, t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  const nextPath =
    searchParams.get("next") || searchParams.get("callbackUrl") || "/";
  const isLogin = mode === "login";
  const accountCreated = searchParams.get("created") === "1";
  const authSwitchHref = `${isLogin ? "/signup" : "/login"}${
    nextPath !== "/" ? `?next=${encodeURIComponent(nextPath)}` : ""
  }`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setStatus("submitting");
    setMessage("");

    try {
      const normalizedEmail = email.trim().toLowerCase();

      if (isLogin) {
        const result = await signIn("credentials", {
          email: normalizedEmail,
          password,
          redirect: false,
          callbackUrl: nextPath,
        });

        if (!result || !result.ok || result.error) {
          throw new Error(
            result?.error === "CredentialsSignin"
              ? "Invalid email or password."
              : result?.error || "Login could not be completed right now.",
          );
        }

        setStatus("success");
        setMessage(t("auth.loginSuccess"));
        router.replace(result.url ?? nextPath);
        router.refresh();
        return;
      }

      const response = await fetch("/api/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
          password,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | {
            error?: string;
            message?: string;
          }
        | null;

      if (!response.ok) {
        throw new Error(
          data?.error ?? "Your account could not be created right now.",
        );
      }

      setStatus("success");
      setMessage(data?.message ?? t("auth.signupSuccess"));
      router.replace(
        `/login?created=1${nextPath !== "/" ? `&next=${encodeURIComponent(nextPath)}` : ""}`,
      );
      router.refresh();
    } catch (caughtError) {
      setStatus("error");
      setMessage(
        caughtError instanceof Error
          ? translateRuntimeMessage(caughtError.message, language)
          : t("auth.genericError"),
      );
    }
  }

  return (
    <section className="app-surface-strong app-panel-lg w-full max-w-[460px]">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[color:var(--foreground)]">
          {t(isLogin ? "auth.loginTitle" : "auth.signupTitle")}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
          {t(isLogin ? "auth.loginDescription" : "auth.signupDescription")}
        </p>
      </div>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-sm font-medium text-[color:var(--foreground)]" htmlFor="email">
            {t("auth.email")}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="app-input"
            placeholder="name@example.com"
            required
          />
        </div>

        <div className="space-y-2">
          <label
            className="text-sm font-medium text-[color:var(--foreground)]"
            htmlFor="password"
          >
            {t("auth.password")}
          </label>
          <input
            id="password"
            type="password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="app-input"
            placeholder="••••••••"
            minLength={6}
            required
          />
        </div>

        {message ? (
          <p
            className={`text-sm ${
              status === "error"
                ? "app-text-danger"
                : "text-[color:var(--accent-strong)]"
            }`}
          >
            {message}
          </p>
        ) : isLogin && accountCreated ? (
          <p className="text-sm text-[color:var(--accent-strong)]">
            {t("auth.accountCreated")}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={status === "submitting"}
          className="app-button-primary w-full justify-center text-sm"
        >
          {status === "submitting"
            ? t(isLogin ? "auth.loggingIn" : "auth.signingUp")
            : t(isLogin ? "auth.loginButton" : "auth.signupButton")}
        </button>
      </form>

      <p className="mt-5 text-sm text-[color:var(--muted)]">
        {isLogin ? t("auth.noAccount") : t("auth.haveAccount")}{" "}
        <Link
          href={authSwitchHref}
          className="font-medium text-[color:var(--foreground)]"
        >
          {t(isLogin ? "auth.goSignup" : "auth.goLogin")}
        </Link>
      </p>
    </section>
  );
}
