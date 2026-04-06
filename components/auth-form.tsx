"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { translateRuntimeMessage } from "@/lib/i18n";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { supabase, isConfigured } = useAuth();
  const { language, t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  const nextPath = searchParams.get("next") || "/";
  const isLogin = mode === "login";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !isConfigured) {
      setStatus("error");
      setMessage(t("auth.configMissing"));
      return;
    }

    setStatus("submitting");
    setMessage("");

    try {
      const authResult = isLogin
        ? await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          })
        : await supabase.auth.signUp({
            email: email.trim(),
            password,
          });

      if (authResult.error) {
        throw authResult.error;
      }

      const session = authResult.data.session;

      if (!isLogin && !session) {
        setStatus("success");
        setMessage(t("auth.checkEmail"));
        return;
      }

      setStatus("success");
      setMessage(t(isLogin ? "auth.loginSuccess" : "auth.signupSuccess"));
      router.replace(nextPath);
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
        <p className="app-label">{t("app.name")}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[color:var(--foreground)]">
          {t(isLogin ? "auth.loginTitle" : "auth.signupTitle")}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
          {t(isLogin ? "auth.loginDescription" : "auth.signupDescription")}
        </p>
      </div>

      {!isConfigured ? (
        <div className="mt-5 rounded-[18px] border border-[color:var(--border)] bg-[color:var(--surface-overlay)] px-4 py-3 text-sm leading-6 text-[color:var(--muted)]">
          {t("auth.configMissing")}
        </div>
      ) : null}

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
        ) : null}

        <button
          type="submit"
          disabled={status === "submitting" || !isConfigured}
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
          href={isLogin ? "/signup" : "/login"}
          className="font-medium text-[color:var(--foreground)]"
        >
          {t(isLogin ? "auth.goSignup" : "auth.goLogin")}
        </Link>
      </p>
    </section>
  );
}
