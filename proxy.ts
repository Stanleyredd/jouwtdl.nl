import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const authPages = new Set(["/login", "/signup"]);

export default withAuth(
  function proxy(request) {
    if (authPages.has(request.nextUrl.pathname) && request.nextauth.token) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/login",
    },
    callbacks: {
      authorized: ({ req, token }) => {
        if (authPages.has(req.nextUrl.pathname)) {
          return true;
        }

        return Boolean(token);
      },
    },
  },
);

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
