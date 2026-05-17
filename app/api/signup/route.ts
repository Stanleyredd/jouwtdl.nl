import { createUserWithPassword } from "@/services/profile-repository";

export const runtime = "nodejs";

function toSafeEmailIdentifier(email: string) {
  const normalized = email.trim().toLowerCase();
  const [localPart, domain = ""] = normalized.split("@");
  const visibleLocal = localPart.slice(0, Math.min(localPart.length, 2));
  const maskedLocal = `${visibleLocal}${"*".repeat(Math.max(localPart.length - visibleLocal.length, 0))}`;

  return domain ? `${maskedLocal}@${domain}` : maskedLocal;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !email.includes("@")) {
    return Response.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return Response.json(
      { error: "Use at least 8 characters for your password." },
      { status: 400 },
    );
  }

  try {
    await createUserWithPassword({
      email,
      password,
    });

    return Response.json(
      {
        ok: true,
        message: "Your account is ready. Log in to continue.",
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Your account could not be created right now.";
    const safeEmail = toSafeEmailIdentifier(email);
    const status =
      message === "An account with this email already exists." ? 409 : 500;

    console.error("[auth]", "signup-failed", {
      action: "signup",
      email: safeEmail,
      message,
    });

    return Response.json({ error: message }, { status });
  }
}
