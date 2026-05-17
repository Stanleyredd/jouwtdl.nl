import CredentialsProvider from "next-auth/providers/credentials";
import { getServerSession, type NextAuthOptions } from "next-auth";
import { redirect } from "next/navigation";

import { verifyUserCredentials } from "@/services/profile-repository";

export interface AuthenticatedUser {
  id: string;
  email: string | null;
}

function toSafeEmailIdentifier(email: string | null | undefined) {
  if (!email) {
    return "unknown";
  }

  const normalized = email.trim().toLowerCase();
  const [localPart, domain = ""] = normalized.split("@");
  const visibleLocal = localPart.slice(0, Math.min(localPart.length, 2));
  const maskedLocal = `${visibleLocal}${"*".repeat(Math.max(localPart.length - visibleLocal.length, 0))}`;

  return domain ? `${maskedLocal}@${domain}` : maskedLocal;
}

export function isProtectedPath(pathname: string) {
  return pathname !== "/login" && pathname !== "/signup";
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: {
          label: "Email",
          type: "email",
        },
        password: {
          label: "Password",
          type: "password",
        },
      },
      async authorize(credentials) {
        const email =
          typeof credentials?.email === "string" ? credentials.email.trim() : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";

        if (!email || !password) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("[auth]", "login-denied", {
              action: "login",
              email: toSafeEmailIdentifier(email),
              message: "Invalid email or password.",
            });
          }
          return null;
        }

        try {
          const user = await verifyUserCredentials({
            email,
            password,
          });

          if (!user) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
          };
        } catch (error) {
          console.error("[auth]", "login-failed", {
            action: "login",
            email: toSafeEmailIdentifier(email),
            message: error instanceof Error ? error.message : "Unknown auth error.",
          });
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        token.sub = user.id;
      }

      if (user?.email) {
        token.email = user.email;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ?? token.sub ?? "";
        session.user.email =
          typeof token.email === "string" ? token.email : session.user.email ?? null;
      }

      return session;
    },
  },
  secret: process.env.AUTH_SECRET,
};

export async function getAuthSession() {
  return getServerSession(authOptions);
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email ?? null,
  };
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
