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

// The /login page renders a plain <form> that posts straight to NextAuth's
// /api/auth/callback/credentials endpoint, which requires a CSRF token that
// matches a paired cookie NextAuth sets. A Server Component can only READ
// cookies, not set them, so fetching /api/auth/csrf from inside the page
// itself would get back a token whose matching Set-Cookie never reaches the
// browser — every login would then fail CSRF validation silently. Doing
// that fetch here in middleware instead lets us forward the Set-Cookie onto
// the real outgoing response, and hand the plain token down to the page via
// a request header.
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

export default function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === "/login") {
    return attachCsrfToken(req);
  }
  return (protectedMiddleware as unknown as (req: NextRequest) => unknown)(req);
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/login"],
};
