import { NextResponse, type NextRequest } from "next/server";

// Cheap gate: no session cookie => login page. The session itself is verified server-side
// on every request (expiry, deactivated account) in getCurrentUser().
export function middleware(req: NextRequest) {
  const hasCookie = req.cookies.has("transwin_session");
  const isLogin = req.nextUrl.pathname === "/login";
  if (!hasCookie && !isLogin) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|api/health).*)"],
};
