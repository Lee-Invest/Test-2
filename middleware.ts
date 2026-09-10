import { withAuth } from "next-auth/middleware";
import { NextResponse, NextRequest } from "next/server";

const protectedMiddleware = withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = req.nextauth.token?.role as string | undefined;

    if (pathname.startsWith("/admin") && role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

// Every page renders <Nav>, which (once signed in) shows a "Sign out" form
// posting straight to NextAuth's /api/auth/callback/signout — same reasoning
// as the /login form: that endpoint requires a CSRF token paired with a
// cookie, and a Server Component can only READ cookies, never set them. So
// this fetch (and forwarding its Set-Cookie) has to happen here in
// middleware, for every route, not just /login.
async function attachCsrfToken(req: NextRequest) {
  const csrfRes = await fetch(new URL("/api/auth/csrf", req.nextUrl.origin), {
    headers: { cookie: req.headers.get("cookie") ?? "" },
  });
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  const setCookie =
    typeof csrfRes.headers.getSetCookie === "function"
      ? csrfRes.headers.getSetCookie()
      : [csrfRes.headers.get("set-cookie")].filter((v): v is string => Boolean(v));

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-csrf-token", csrfToken);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  for (const cookie of setCookie) res.headers.append("set-cookie", cookie);
  return res;
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/dashboard") || pathname.startsWith("/admin")) {
    const authResult = (await (protectedMiddleware as unknown as (req: NextRequest) => Promise<NextResponse>)(
      req
    )) as NextResponse;
    // A redirect (not authorized, or wrong role) short-circuits — no need
    // to also attach a CSRF token to a response the browser won't render.
    if (authResult.status >= 300 && authResult.status < 400) return authResult;
  }

  return attachCsrfToken(req);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
