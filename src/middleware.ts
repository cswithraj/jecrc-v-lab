import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge middleware: CSRF defence for the JSON API (Origin must match Host on state-changing requests)
 * and a fast redirect to /login for pages when no session cookie is present.
 * Full session validation happens server-side in getCurrentUser().
 */
const PUBLIC_PAGES = ["/", "/login"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api/")) {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const origin = req.headers.get("origin");
      const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
      if (origin && host && new URL(origin).host !== host) {
        return NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 });
      }
    }
    return NextResponse.next();
  }
  if (!PUBLIC_PAGES.includes(pathname) && !req.cookies.get("vlab_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/|brand/|icon.png|favicon.ico|monaco/).*)"] };
