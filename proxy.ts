import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";
import { isProtectedPath } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/shared";

const authPages = new Set(["/login", "/signup"]);

export async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.next();
  }

  const { response, claims } = await updateSession(request);
  const pathname = request.nextUrl.pathname;
  const isAuthenticated = Boolean(claims?.sub);

  if (!isAuthenticated && isProtectedPath(pathname)) {
    const loginUrl = new URL("/login", request.url);
    const nextValue = `${pathname}${request.nextUrl.search}`;

    if (nextValue !== "/") {
      loginUrl.searchParams.set("next", nextValue);
    }

    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && authPages.has(pathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
